// assets/js/admin.js
import { AuthService } from './auth.js';
import { UIService } from './ui-service.js';
import { AdminService } from './admin-service.js';

let currentSettingsListener = null;
let currentTellersListener = null;
let currentStatsListener = null;

document.addEventListener('DOMContentLoaded', async () => {
    const loader = document.getElementById('adminLoader');
    const content = document.getElementById('adminContent');

    AuthService.observeAuth(async (user) => {
        if (!user) return window.location.href = '../index.html';

        const role = await AuthService.getUserRole(user.uid);
        if (role !== 'admin') return window.location.href = '../index.html';

        loader.classList.add('d-none');
        content.classList.remove('d-none');
        content.classList.add('fade-in');

        initializeAdmin();
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        UIService.showConfirm("Log Out", "End your session?", "Log Out", async () => {
            await AuthService.logout();
            window.location.href = '../index.html';
        });
    });
});

function initializeAdmin() {
    setupOverviewTab();
    setupTellersTab();
    setupTicketOverrideTab();
}

// ====================== OVERVIEW TAB ======================
function setupOverviewTab() {
    // Status buttons
    document.querySelectorAll('input[name="status"]').forEach(radio => {
        radio.addEventListener('change', async () => {
            await AdminService.saveStatus(radio.id.replace('btn', '').toLowerCase());
        });
    });

    // Max tickets limit
    const limitSwitch = document.getElementById('limitSwitch');
    const maxInput = document.getElementById('maxTicketInput');
    const saveLimitBtn = document.getElementById('saveLimitBtn');

    limitSwitch.addEventListener('change', () => {
        maxInput.disabled = !limitSwitch.checked;
        saveLimitBtn.disabled = !limitSwitch.checked;
    });

    saveLimitBtn.addEventListener('click', async () => {
        const max = parseInt(maxInput.value) || null;
        await AdminService.saveMaxTickets(max);
        UIService.showModal('success', 'Saved', 'Maximum tickets updated.');
    });

    // Real-time settings
    currentSettingsListener = AdminService.listenToSettings((settings) => {
        const activeBtn = document.getElementById(`btn${settings.status.charAt(0).toUpperCase() + settings.status.slice(1)}`);
        if (activeBtn) activeBtn.checked = true;

        if (settings.maxTickets !== null && settings.maxTickets !== undefined) {
            limitSwitch.checked = true;
            maxInput.disabled = false;
            maxInput.value = settings.maxTickets;
            saveLimitBtn.disabled = false;
        } else {
            limitSwitch.checked = false;
            maxInput.disabled = true;
            maxInput.value = '';
            saveLimitBtn.disabled = true;
        }
    });

    // Live stats
    currentStatsListener = AdminService.listenToStats((stats) => {
        document.getElementById('statWaiting').textContent = stats.waiting;
        document.getElementById('statProcessed').textContent = stats.processed;
        document.getElementById('statCancelled').textContent = stats.cancelled || 0;
        document.getElementById('statNoShow').textContent = stats.noshow || 0;
        document.getElementById('statTotal').textContent = stats.total;
    });


    // Live Queue Activity Table
    const queueTableBody = document.getElementById('overviewQueueTable');
    AdminService.listenToActiveTickets((tickets) => {
        queueTableBody.innerHTML = tickets.length === 0 
            ? `<tr><td colspan="2" class="text-center py-4 text-muted">No active tickets</td></tr>`
            : tickets.map(t => `
                <tr>
                    <td class="ps-4 fw-bold">${t.ticketNumber}</td>
                    <td><span class="badge ${t.status === 'serving' ? 'bg-success' : 'bg-primary'}">${t.status === 'serving' ? 'Serving' : 'Waiting'}</span></td>
                </tr>
            `).join('');
    });

    // Per Teller Stats Table
    const tellerStatsContainer = document.createElement('div');
    tellerStatsContainer.innerHTML = `
        <h6 class="text-muted text-uppercase fw-bold small ls-2 mb-3 mt-4">Per Teller Stats</h6>
        <div class="card shadow-sm border-0 rounded-4">
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0" id="perTellerTable">
                    <thead class="bg-light">
                        <tr>
                            <th class="ps-4">Teller / Counter</th>
                            <th class="text-center">Queued</th>
                            <th class="text-center">Processed</th>
                            <th class="text-center">Cancelled</th>
                            <th class="text-center">No-Show</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
        </div>
    `;
    document.querySelector('#overview').appendChild(tellerStatsContainer);

    const perTellerTbody = document.getElementById('perTellerTable').querySelector('tbody');
    AdminService.listenToTellerStats((stats) => {
        perTellerTbody.innerHTML = stats.length === 0 
            ? `<tr><td colspan="5" class="text-center py-4 text-muted">No teller data yet</td></tr>`
            : stats.map(s => `
                <tr>
                    <td class="ps-4 fw-bold">${s.name}</td>
                    <td class="text-center">${s.queued}</td>
                    <td class="text-center">${s.processed}</td>
                    <td class="text-center">${s.cancelled}</td>
                    <td class="text-center">${s.noshow}</td>
                </tr>
            `).join('');
    });
}

// ====================== TELLERS TAB ======================
function setupTellersTab() {
    const form = document.getElementById('createTellerForm');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('tellerName').value.trim();
        const email = document.getElementById('tellerEmail').value.trim();
        const password = document.getElementById('tellerPass').value;
        const counter = document.getElementById('tellerCounter').value.trim();

        if (!name || !email || !password || !counter) {
            UIService.showModal('error', 'Missing Fields', 'Please fill everything.');
            return;
        }

        const btn = form.querySelector('button');
        btn.disabled = true;
        btn.textContent = 'Creating...';

        try {
            await AdminService.createTeller(name, email, password, counter);
            UIService.showModal('success', 'Teller Created Successfully!', 
                `${name} can now log in with <b>${email}</b>.<br><br>Refreshing...`, 
                () => window.location.reload());
            form.reset();
        } catch (err) {
            UIService.showModal('error', 'Error', err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Create Account';
        }
    });

    // Live tellers list
    const tbody = document.getElementById('allTellersTable');
    AdminService.listenToTellers((tellers) => {
        tbody.innerHTML = tellers.length === 0 
            ? `<tr><td colspan="4" class="text-center py-4 text-muted">No tellers yet</td></tr>`
            : tellers.map(t => `
                <tr>
                    <td class="ps-4 fw-bold">${t.name}</td>
                    <td><span class="badge bg-light text-dark border">${t.counterName}</span></td>
                    <td class="mobile-hide text-muted small">${t.email}</td>
                    <td class="text-end pe-4">
                        <button class="btn btn-sm btn-light text-primary me-1" onclick="editTeller('${t.id}', '${t.name}', '${t.email}', '${t.counterName}')">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                        <button class="btn btn-sm btn-light text-danger" onclick="deleteTeller('${t.id}')">
                            <i class="bi bi-trash3"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
    });
}

// ====================== TICKET OVERRIDE TAB ======================
function setupTicketOverrideTab() {
    const searchInput = document.getElementById('searchTicket');
    const findBtn = document.getElementById('findTicketBtn');
    const resultDiv = document.getElementById('ticketResult');
    const resNum = document.getElementById('resNum');
    const resOwner = document.getElementById('resOwner');
    const upgradeBtn = document.getElementById('upgradeBtn');

    let currentFoundTicket = null;

    findBtn.addEventListener('click', async () => {
        const ticketNumber = searchInput.value.trim().toUpperCase();
        if (!ticketNumber) return UIService.showModal('error', 'Missing Ticket', 'Please enter a ticket number');

        findBtn.disabled = true;
        findBtn.textContent = 'Searching...';

        try {
            const ticket = await AdminService.findTicketByNumber(ticketNumber);
            if (!ticket) {
                UIService.showModal('error', 'Not Found', `Ticket ${ticketNumber} does not exist.`);
                resultDiv.classList.add('d-none');
                return;
            }

            currentFoundTicket = ticket;
            resNum.textContent = ticket.ticketNumber || ticket.id;
            resOwner.textContent = ticket.ownerName || 'Guest';
            resultDiv.classList.remove('d-none');
        } catch (err) {
            UIService.showModal('error', 'Error', err.message);
        } finally {
            findBtn.disabled = false;
            findBtn.textContent = 'Find';
        }
    });

    upgradeBtn.addEventListener('click', async () => {
        if (!currentFoundTicket) return;
        await AdminService.upgradeToPriority(currentFoundTicket.id);
        UIService.showModal('success', 'Upgraded!', `Ticket ${currentFoundTicket.ticketNumber} is now Priority.`);
        resultDiv.classList.add('d-none');
        searchInput.value = '';
    });

    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-outline-danger btn-sm fw-bold shadow-sm rounded-pill px-3 mt-2';
    cancelBtn.textContent = 'CANCEL TICKET';
    cancelBtn.style.display = 'none';
    resultDiv.appendChild(cancelBtn);

    cancelBtn.addEventListener('click', async () => {
        if (!currentFoundTicket) return;
        UIService.showConfirm("Cancel Ticket?", "Are you sure?", "Yes, Cancel", async () => {
            await AdminService.cancelFoundTicket(currentFoundTicket.id);
            UIService.showModal('success', 'Cancelled', `Ticket ${currentFoundTicket.ticketNumber} cancelled.`);
            resultDiv.classList.add('d-none');
            searchInput.value = '';
        });
    });

    // Show cancel button when result appears
    const observer = new MutationObserver(() => {
        cancelBtn.style.display = resultDiv.classList.contains('d-none') ? 'none' : 'inline-block';
    });
    observer.observe(resultDiv, { attributes: true });
}

// ====================== GLOBAL FUNCTIONS ======================
window.editTeller = (id, name, email, counter) => {
    const modal = new bootstrap.Modal(document.getElementById('editTellerModal'));
    document.getElementById('editTellerId').value = id;
    document.getElementById('editName').value = name;
    document.getElementById('editCounter').value = counter;
    document.getElementById('editEmail').value = email;
    modal.show();
};

window.deleteTeller = (id) => {
    UIService.showConfirm("Delete Teller?", "This cannot be undone.", "Delete", async () => {
        await AdminService.deleteTeller(id);
    });
};

window.resetQueueSystem = async () => {
    UIService.showConfirm(
        "Delete ALL Tickets?",
        "This will permanently delete every ticket.<br><span class='text-danger'>This cannot be undone.</span>",
        "YES, DELETE ALL",
        async () => {
            await AdminService.resetAllTickets();
            UIService.showModal('success', 'System Reset', 'All tickets deleted.');
        }
    );
};