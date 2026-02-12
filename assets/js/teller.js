import { AuthService } from './auth.js';
import { UIService } from './ui-service.js';
import { QueueService } from './queue-service.js';

// --- DOM ELEMENTS ---
const elements = {
    loader: document.getElementById('tellerLoader'),
    content: document.getElementById('tellerContent'),

    // Header Info
    displayCounter: document.getElementById('displayCounterName'),
    sidebarCounter: document.getElementById('sidebarCounterName'),
    breakToggle: document.getElementById('breakToggle'),
    logoutBtn: document.getElementById('logoutBtn'),

    // Panels
    idlePanel: document.getElementById('idlePanel'),
    servingPanel: document.getElementById('servingPanel'),

    // Serving Info
    currentTicketNum: document.getElementById('currentTicketNum'),
    currentOwner: document.getElementById('currentOwner'),
    serveTimer: document.getElementById('serveTimer'),

    // Buttons
    btnCallNext: document.getElementById('btnCallNext'),

    // Lists
    waitingList: document.getElementById('waitingList'),
    waitingCount: document.getElementById('waitingCount'),
    transferList: document.getElementById('transferList')
};

// --- STATE ---
let currentUser = null;
let currentTicket = null;
let timerInterval = null;
let waitingTickets = [];

// --- INITIALIZATION ---
AuthService.observeAuth(async (user) => {
    if (user) {
        const role = await AuthService.getUserRole(user.uid);
        if (role === 'teller') {
            currentUser = user;
            // Fetch Teller Profile (Counter Name)
            // Assuming user.displayName or a Firestore profile has the counter name
            // For now, we mock it or fetch it:
            const counterName = "Counter " + user.email.split('@')[0]; // Simple fallback

            initDashboard(counterName);
        } else {
            handleUnauthorized();
        }
    } else {
        handleUnauthorized();
    }
});

function initDashboard(counterName) {
    // 1. Set Counter Name in UI
    elements.displayCounter.textContent = counterName;
    elements.sidebarCounter.textContent = counterName;

    // 2. Hide Loader
    elements.loader.classList.add('d-none');
    elements.content.classList.remove('d-none');

    // 3. Start Listening to Queue
    QueueService.listenToWaitingList((tickets) => {
        waitingTickets = tickets;
        renderWaitingList();
    });

    console.log("Teller Dashboard Initialized");
}

async function handleUnauthorized() {
    await AuthService.logout();
    window.location.href = "../index.html";
}

// --- CORE FUNCTIONS ---

// 1. Call Next Ticket
elements.btnCallNext.addEventListener('click', async () => {
    // UI Loading state could go here
    elements.btnCallNext.disabled = true;
    elements.btnCallNext.textContent = "Calling...";

    try {
        const ticket = await QueueService.callNextTicket(currentUser.email, elements.displayCounter.textContent);

        if (ticket) {
            startSession(ticket);
        } else {
            UIService.showModal('info', 'Queue Empty', 'There are no tickets waiting.');
        }
    } catch (e) {
        console.error(e);
        UIService.showModal('error', 'Error', 'Failed to call ticket.');
    } finally {
        elements.btnCallNext.disabled = false;
        elements.btnCallNext.innerHTML = '<i class="bi bi-bell-fill me-2"></i>CALL NEXT TICKET';
    }
});

// 2. Start Serving Session
function startSession(ticket) {
    currentTicket = ticket;

    // Update UI
    elements.currentTicketNum.textContent = ticket.ticketNumber || ticket.id;
    elements.currentOwner.textContent = ticket.ownerName || "Guest";

    // Switch Panels
    elements.idlePanel.classList.add('d-none');
    elements.servingPanel.classList.remove('d-none'); // Show serving panel
    elements.servingPanel.classList.add('fade-in');

    // Start Timer
    let seconds = 0;
    elements.serveTimer.textContent = "00:00";
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        seconds++;
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        elements.serveTimer.textContent = `${m}:${s}`;
    }, 1000);
}

// 3. End Session (Complete / Cancel)
// Note: This function is called by the window object because buttons use onclick="handleAction()"
window.handleAction = async (action) => {
    if (!currentTicket) return;

    try {
        if (action === 'complete') {
            await QueueService.completeTicket(currentTicket.id);
            UIService.showModal('success', 'Success', 'Transaction Completed!');
        } else {
            // Cancel / No Show
            await QueueService.cancelTicket(currentTicket.id, action);
        }
    } catch (e) {
        console.error(e);
        UIService.showModal('error', 'Error', 'Failed to update ticket.');
    } finally {
        resetToIdle();
    }
};

function resetToIdle() {
    currentTicket = null;
    clearInterval(timerInterval);
    elements.servingPanel.classList.add('d-none');
    elements.idlePanel.classList.remove('d-none');
    elements.idlePanel.classList.add('fade-in');
}

// --- RENDER FUNCTIONS ---

function renderWaitingList() {
    elements.waitingCount.textContent = waitingTickets.length + " Waiting";
    elements.waitingList.innerHTML = '';

    if (waitingTickets.length === 0) {
        elements.waitingList.innerHTML = `
            <div class="text-center py-5 mt-4">
                <div class="text-muted opacity-25 mb-2"><i class="bi bi-inbox-fill display-4"></i></div>
                <h6 class="fw-bold text-muted">Queue is Empty</h6>
                <p class="text-muted small">Relax and wait for new tickets.</p>
            </div>`;
        return;
    }

    waitingTickets.forEach(t => {
        const item = document.createElement('a');
        item.href = "#";
        item.className = "list-group-item list-group-item-action py-3 border-bottom";
        item.innerHTML = `
            <div class="d-flex w-100 justify-content-between align-items-center">
                <div>
                    <h5 class="mb-1 fw-bold text-dark">${t.ticketNumber}</h5>
                    <small class="text-muted">${t.ownerName || 'Guest'}</small>
                </div>
                <small class="text-primary-q fw-bold">WAITING</small>
            </div>
        `;
        elements.waitingList.appendChild(item);
    });
}

// --- TRANSFER LOGIC ---
window.openTransferList = async () => {
    // 1. Show the modal (Bootstrap handles this via data-bs-target)
    const modal = new bootstrap.Modal(document.getElementById('transferModal'));
    modal.show();

    // 2. Load Counters
    elements.transferList.innerHTML = '<div class="text-center"><div class="spinner-border spinner-border-sm"></div></div>';

    const counters = await QueueService.getActiveCounters();

    elements.transferList.innerHTML = ''; // Clear loader
    counters.forEach(c => {
        if (c.name === elements.displayCounter.textContent) return; // Don't show self

        const btn = document.createElement('button');
        btn.className = "btn btn-outline-secondary py-3 fw-bold rounded-3 text-start px-4 mb-2 w-100";
        btn.innerHTML = `<i class="bi bi-box-arrow-in-right me-2"></i> ${c.name}`;
        btn.onclick = () => confirmTransfer(c.name, modal);
        elements.transferList.appendChild(btn);
    });
};

async function confirmTransfer(targetCounter, modalInstance) {
    if(!currentTicket) return;

    await QueueService.transferTicket(currentTicket.id, targetCounter);

    modalInstance.hide();
    UIService.showModal('success', 'Transferred', `Ticket transferred to ${targetCounter}`);
    resetToIdle();
}

// --- LOGOUT LOGIC ---
elements.logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    UIService.showConfirm(
        "End Session?",
        "Are you sure you want to log out?",
        "LOGOUT",
        async () => {
            elements.content.classList.add('d-none');
            elements.loader.classList.remove('d-none');
            await AuthService.logout();
            window.location.href = "../index.html";
        }
    );
});