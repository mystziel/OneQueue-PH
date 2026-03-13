// assets/js/teller.js
import { AuthService } from './auth.js';
import { UIService } from './ui-service.js';
import { QueueService } from './queue-service.js';
import { db } from './firebase-config.js';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";

let currentUser = null;
let currentTicket = null;
let timerInterval = null;
let waitingTickets = [];
let notifiedTickets = new Set();

// SMS SERVICE
const SMSService = {
    apiKey: 'sk-2b10yvivixgpcjk6vdbl5ulxquotnh5u',
    apiUrl: 'https://smsapiph.onrender.com/api/v1/send/sms',

    send: async (userName, mobile, message) => {
        let formattedMobile = mobile.replace(/\s/g, '');
        if (formattedMobile.startsWith('09')) {
            formattedMobile = '+63' + formattedMobile.substring(1);
        }

        try {
            const response = await fetch(SMSService.apiUrl, {
                method: 'POST',
                headers: {
                    'x-api-key': SMSService.apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    recipient: formattedMobile,
                    message: message
                })
            });

            const data = await response.json();

            if (response.ok) {
                console.log(` SMS Sent to ${userName}: ${message}`, data);
                console.log("Sending to:", formattedMobile);
            } else {
                console.error(` SMS Failed:`, data);
            }
        } catch (error) {
            console.error(" SMS Network Error:", error);
        }
    },

    processQueueNotifications: (tickets) => {
        tickets.forEach((t, index) => {
            const position = index + 1;
            const mobile = t.userMobile;
            const name = t.userName || "Customer";

            if (!mobile || mobile === "No Mobile Provided") return;

            // Unique key: ticketId + current position
            const notificationKey = `${t.id}_${position}`;

            if (!notifiedTickets.has(notificationKey)) {
                let message = "";

                if (position === 1) {
                    message = `OneQueue PH: Hello ${name}, you are NEXT! Please check the website for your counter.`;
                } else if (position === 5) {
                    message = `OneQueue PH: Hi ${name}, you are 5th in line. Your turn is coming up soon.`;
                } else if (position === 10) {
                    message = `OneQueue PH: Hi ${name}, you are now 10th in line. Thank you for waiting.`;
                }

                if (message) {
                    SMSService.send(name, mobile, message);
                    notifiedTickets.add(notificationKey);
                }
            }
        });
    }
};

// Sync availability status
async function updateTellerStatus(uid, status) {
    try {
        await updateDoc(doc(db, "users", uid), { tellerStatus: status });
    } catch (e) {
        console.error("Status Sync Error:", e);
    }
}

// Init auth
AuthService.observeAuth(async (user) => {
    if (user) {
        const role = await AuthService.getUserRole(user.uid);
        if (role !== 'teller') return window.location.href = "../index.html";

        currentUser = user;

        const userDocSnap = await getDoc(doc(db, "users", user.uid));
        const userData = userDocSnap.data();

        document.getElementById('displayCounterName').textContent = userData?.counterName || "Counter --";
        document.getElementById('sidebarCounterName').textContent = userData?.counterName || "Counter --";
        document.getElementById('sidebarTellerName').textContent = userData?.name || "Teller";

        await updateTellerStatus(user.uid, 'online');
        initDashboard();

        const loader = document.getElementById('tellerLoader');
        const content = document.getElementById('tellerContent');
        loader.classList.add('d-none');
        content.classList.remove('d-none');
        content.classList.add('fade-in');

    } else {
        window.location.href = "../index.html";
    }
});

// Setup dashboard data
function initDashboard() {
    restoreActiveSession(currentUser.email);

    QueueService.listenToWaitingList((tickets) => {
        waitingTickets = tickets;
        renderWaitingList();
        SMSService.processQueueNotifications(tickets);
    });
}

// Handle break toggle
document.getElementById('breakToggle').addEventListener('change', async (e) => {
    const isBreak = e.target.checked;
    const btn = document.getElementById('btnCallNext');
    const label = document.querySelector('label[for="breakToggle"]');

    if (isBreak) {
        btn.disabled = true;
        btn.classList.add('opacity-50');
        label.textContent = "ON BREAK";
        await updateTellerStatus(currentUser.uid, 'break');
    } else {
        btn.disabled = false;
        btn.classList.remove('opacity-50');
        label.textContent = "TAKE A BREAK";
        await updateTellerStatus(currentUser.uid, 'online');
    }
});

// Call next customer
document.getElementById('btnCallNext').addEventListener('click', async () => {
    if (document.getElementById('breakToggle').checked) return;

    const btn = document.getElementById('btnCallNext');
    btn.disabled = true;
    btn.textContent = "CALLING...";

    try {
        const counter = document.getElementById('displayCounterName').textContent;
        const ticket = await QueueService.callNextTicket(currentUser.email, counter);

        if (ticket) {
            startSession(ticket);
        } else {
            UIService.showModal('info', 'Empty', 'No customers in line.');
        }
    } catch (e) {
        UIService.showModal('error', 'Error', 'Failed to call ticket.');
    } finally {
        btn.disabled = document.getElementById('breakToggle').checked;
        btn.innerHTML = '<i class="bi bi-bell-fill me-2"></i>CALL NEXT TICKET';
    }
});

// Start active transaction
function startSession(ticket, isRestore = false) {
    currentTicket = ticket;
    document.getElementById('currentTicketNum').textContent = ticket.ticketNumber;
    document.getElementById('currentOwner').textContent = ticket.userName || ticket.ownerName || "Guest";
    document.getElementById('idlePanel').classList.add('d-none');
    document.getElementById('servingPanel').classList.remove('d-none');

    // No-Show reminder
    let reminderEl = document.getElementById('noShowReminder');
    if (!reminderEl) {
        reminderEl = document.createElement('div');
        reminderEl.id = 'noShowReminder';
        reminderEl.className = 'text-danger fw-bold opacity-50 d-none mt-1 transition-opacity';
        reminderEl.style.fontSize = '0.7rem';
        reminderEl.innerHTML = '<i class="bi bi-info-circle me-1"></i>Eligible for No Show';
        document.getElementById('serveTimer').parentNode.appendChild(reminderEl);
    }

    reminderEl.classList.add('d-none');

    let sec = 0;

    // Calculate elapsed time on refresh
    if (isRestore && ticket.calledAt) {
        const calledTime = ticket.calledAt.toMillis ? ticket.calledAt.toMillis() : Date.now();
        sec = Math.floor((Date.now() - calledTime) / 1000);
        if (sec < 0) sec = 0;
    }

    // Unhide reminder immediately if restored session is already past 1 min
    if (sec >= 60) reminderEl.classList.remove('d-none');

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        sec++;
        const m = Math.floor(sec / 60).toString().padStart(2, '0');
        const s = (sec % 60).toString().padStart(2, '0');
        document.getElementById('serveTimer').textContent = `${m}:${s}`;

        // Trigger reminder at exactly 60 seconds
        if (sec === 60) reminderEl.classList.remove('d-none');
    }, 1000);
}

// Recover interrupted sessions
async function restoreActiveSession(tellerEmail) {
    try {
        const q = query(
            collection(db, "tickets"),
            where("status", "==", "Serving"),
            where("calledBy", "==", tellerEmail)
        );

        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const ticketDoc = snapshot.docs[0];
            const ticketData = { id: ticketDoc.id, ...ticketDoc.data() };

            console.log("Active session restored:", ticketData.ticketNumber);
            startSession(ticketData, true);
        }
    } catch (error) {
        console.error("Error restoring session:", error);
    }
}

// Render queue list
function renderWaitingList() {
    const list = document.getElementById('waitingList');
    document.getElementById('waitingCount').textContent = `${waitingTickets.length} Waiting`;
    list.innerHTML = '';

    if (waitingTickets.length === 0) {
        list.innerHTML = '<div class="text-center py-5 text-muted">Empty</div>';
        return;
    }

    // Limit to top 10
    const top10 = waitingTickets.slice(0, 10);

    top10.forEach((t, index) => {
        const isNext = index === 0;
        const item = document.createElement('div');
        item.className = `list-group-item py-3 ${isNext ? 'bg-primary-subtle border-start border-primary border-4' : ''}`;

        item.innerHTML = `
            <div class="d-flex align-items-center w-100">
                <div>
                    <h5 class="mb-0 fw-bold">${t.ticketNumber}</h5>
                    <small class="text-muted">${t.userName}</small>
                </div>
                <span class="badge ${isNext ? 'bg-primary' : 'bg-light text-dark border'} rounded-pill ms-auto">
                    ${isNext ? 'NEXT' : 'POS ' + (index + 1)}
                </span>
            </div>`;
        list.appendChild(item);
    });
}

// End or cancel transaction
window.handleAction = async (action) => {
    if (!currentTicket) return;

    // Prevent double-clicks
    const btnCallNext = document.getElementById('btnCallNext');
    btnCallNext.disabled = true;

    try {
        if (action === 'complete') {
            await QueueService.completeTicket(currentTicket.id);
            UIService.showModal('success', 'Transaction Complete', `Ticket <b>${currentTicket.ticketNumber}</b> has been processed successfully.`);
        } else {
            await QueueService.cancelTicket(currentTicket.id, action);

            // Format reason text
            let reasonText = "Cancelled";
            if (action === 'noshow') reasonText = "Customer No Show";
            else if (action === 'unavailable') reasonText = "Documents Unavailable";
            else if (action === 'other') reasonText = "Other Reason";

            UIService.showModal('info', 'Session Ended', `Ticket <b>${currentTicket.ticketNumber}</b> was closed.<br>Reason: <span class="text-danger fw-bold">${reasonText}</span>`);
        }
    } catch (e) {
        console.error("Action Error:", e);
        UIService.showModal('error', 'Error', 'Failed to update ticket status. Please check your connection.');
    } finally {
        // Idle
        document.getElementById('servingPanel').classList.add('d-none');
        document.getElementById('idlePanel').classList.remove('d-none');
        currentTicket = null;
        clearInterval(timerInterval);

        btnCallNext.disabled = document.getElementById('breakToggle').checked;
    }
};

// Handle logout
document.getElementById('logoutBtn').addEventListener('click', () => {
    UIService.showConfirm(
        "Log Out?",
        "Are you sure you want to end your session and go <b class='text-danger'>OFFLINE</b>?",
        "Log Out",
        async () => {
            await updateTellerStatus(currentUser.uid, 'offline');
            await AuthService.logout();
            window.location.href = "../index.html";
        }
    );
});