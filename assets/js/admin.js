// assets/js/admin.js
import { AuthService } from './auth.js';
import { UIService } from './ui-service.js';
import { AdminService } from './admin-service.js';

let currentSettingsListener = null;
let currentStatsListener = null;

document.addEventListener('DOMContentLoaded', async () => {
    const loader = document.getElementById('adminLoader');
    const content = document.getElementById('adminContent');

    // Initialize auth
    AuthService.observeAuth(async (user) => {
        if (user) {
            // Await role verification
            const role = await AuthService.getUserRole(user.uid);
            if (role !== 'admin') {
                window.location.href = '../index.html';
                return;
            }

            initializeAdmin();

            loader.classList.add('d-none');
            loader.classList.remove('d-flex');
            content.classList.remove('d-none');
            content.classList.add('fade-in');
        } else {
            window.location.href = '../index.html';
        }
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        UIService.showConfirm(
            "Log Out & Close Queue?",
            "Logging out will automatically set the establishment to <b class='text-danger'>CLOSED</b>.<br><br>Are you sure you want to end your session?",
            "Log Out",
            async () => {
                await AdminService.saveStatus('closed');
                await AuthService.logout();
                window.location.href = '../index.html';
            }
        );
    });
});

function initializeAdmin() {
    setupOverviewTab();
    setupTellersTab();
    setupTicketOverrideTab();
}

// OVERVIEW TAB
function setupOverviewTab() {
    // Status buttons
    document.querySelectorAll('input[name="status"]').forEach(radio => {
        radio.addEventListener('change', async () => {
            await AdminService.saveStatus(radio.id.replace('btn', '').toLowerCase());
        });
    });

    // Queue limit
    const limitSwitch = document.getElementById('limitSwitch');
    const maxInput = document.getElementById('maxTicketInput');
    const saveLimitBtn = document.getElementById('saveLimitBtn');

    limitSwitch.addEventListener('change', async () => {
        maxInput.disabled = !limitSwitch.checked;

        if (!limitSwitch.checked) {
            maxInput.value = '';
            saveLimitBtn.disabled = true;
            await AdminService.saveMaxTickets(null);
            UIService.showModal('info', 'Limit Removed', 'The queue is now accepting UNLIMITED tickets.');
        } else {
            saveLimitBtn.disabled = false;
        }
    });

    saveLimitBtn.addEventListener('click', async () => {
        if (limitSwitch.checked) {
            const max = parseInt(maxInput.value);
            if (!max || max <= 0) {
                UIService.showModal('error', 'Invalid Input', 'Please enter a valid number greater than 0.');
                return;
            }
            await AdminService.saveMaxTickets(max);
            UIService.showModal('success', 'Limit Saved', `The queue is now strictly limited to ${max} tickets today.`);
        }
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
        document.getElementById('statTotal').textContent = stats.total;
    });

    // Live Queue Activity Table
    const queueTableBody = document.getElementById('overviewQueueTable');
    const queuePagination = document.getElementById('queuePagination');

    let activeTicketsData = [];
    let currentQueuePage = 1;
    const ticketsPerPage = 10;

    AdminService.listenToActiveTickets((tickets) => {
        activeTicketsData = tickets;
        renderQueueTable();
    });

    function renderQueueTable() {
        if (activeTicketsData.length === 0) {
            queueTableBody.innerHTML = `<tr><td colspan="2" class="text-center py-4 text-muted">No active tickets</td></tr>`;
            if (queuePagination) queuePagination.innerHTML = '';
            return;
        }

        const totalPages = Math.ceil(activeTicketsData.length / ticketsPerPage);

        if (currentQueuePage > totalPages) currentQueuePage = totalPages;
        if (currentQueuePage < 1) currentQueuePage = 1;

        const startIndex = (currentQueuePage - 1) * ticketsPerPage;
        const endIndex = startIndex + ticketsPerPage;
        const paginatedTickets = activeTicketsData.slice(startIndex, endIndex);

        queueTableBody.innerHTML = paginatedTickets.map(t => {
            const badgeClass = t.status === 'Serving' ? 'bg-success shadow-sm' : 'bg-primary';
            const prioBadge = t.isPriority || t.isUpgraded ? `<span class="badge bg-warning text-dark border border-warning ms-2" style="font-size: 0.6rem;">PRIO</span>` : '';

            return `
            <tr>
                <td class="ps-4 fw-bold">
                    ${t.ticketNumber} ${prioBadge}
                </td>
                <td>
                    <span class="badge ${badgeClass}">${t.status}</span>
                    ${t.counterName && t.status === 'Serving' ? `<small class="text-muted d-block mt-1" style="font-size: 0.65rem;">at ${t.counterName}</small>` : ''}
                </td>
            </tr>
            `;
        }).join('');

        renderPaginationControls(totalPages);
    }

    function renderPaginationControls(totalPages) {
        if (!queuePagination) return;
        if (totalPages <= 1) {
            queuePagination.innerHTML = '';
            return;
        }

        let html = `<nav><ul class="pagination pagination-sm mb-0 shadow-sm justify-content-end">`;

        html += `<li class="page-item ${currentQueuePage === 1 ? 'disabled' : ''}">
                <button class="page-link text-dark" onclick="changeQueuePage(${currentQueuePage - 1})">Prev</button>
             </li>`;

        for (let i = 1; i <= totalPages; i++) {
            const activeClass = currentQueuePage === i ? 'active' : '';
            html += `<li class="page-item ${activeClass}">
                    <button class="page-link ${currentQueuePage === i ? 'bg-primary-q border-primary-q text-white' : 'text-dark'}" onclick="changeQueuePage(${i})">${i}</button>
                 </li>`;
        }

        html += `<li class="page-item ${currentQueuePage === totalPages ? 'disabled' : ''}">
                <button class="page-link text-dark" onclick="changeQueuePage(${currentQueuePage + 1})">Next</button>
             </li>`;

        html += `</ul></nav>`;
        queuePagination.innerHTML = html;
    }

    window.changeQueuePage = function (newPage) {
        currentQueuePage = newPage;
        renderQueueTable();
    };

    // Teller Stats Table
    const perTellerTbody = document.getElementById('perTellerTbody');
    AdminService.listenToTellerStats((stats) => {
        perTellerTbody.innerHTML = stats.length === 0
            ? `<tr><td colspan="4" class="text-center py-4 text-muted">No Online Teller</td></tr>`
            : stats.map(s => `
                <tr>
                    <td class="ps-4 fw-bold">${s.name}</td>
                    <td class="text-center">${s.queued}</td>
                    <td class="text-center">${s.processed}</td>
                    <td class="text-center">${s.cancelled}</td>
                </tr>
            `).join('');
    });
}

// TELLERS TAB
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

            UIService.showModal('success', 'Teller Created!', `${name} can now log in.`);
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

    // Handle the Edit Teller Form Submission
    const editForm = document.getElementById('editTellerForm');
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const id = document.getElementById('editTellerId').value;
            const name = document.getElementById('editName').value.trim();
            const counter = document.getElementById('editCounter').value.trim();

            const btn = editForm.querySelector('button[type="submit"]');
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Saving...';

            try {
                await AdminService.updateTeller(id, name, counter);

                UIService.showModal('success', 'Updated', 'Teller profile updated successfully.');
                bootstrap.Modal.getInstance(document.getElementById('editTellerModal')).hide();
                editForm.reset();
            } catch (err) {
                UIService.showModal('error', 'Error', err.message);
            } finally {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        });
    }

    // Teller's Reset Password
    const sendResetEmailBtn = document.getElementById('sendResetEmailBtn');
    const resetEmailFeedback = document.getElementById('resetEmailFeedback');

    if (sendResetEmailBtn) {
        sendResetEmailBtn.addEventListener('click', async () => {
            const email = document.getElementById('editEmail').value;
            if (!email) return;

            const originalText = sendResetEmailBtn.innerHTML;
            sendResetEmailBtn.disabled = true;
            sendResetEmailBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Sending...';

            try {
                // Email Trigger
                await AdminService.sendTellerPasswordReset(email);

                sendResetEmailBtn.classList.add('d-none');
                resetEmailFeedback.classList.remove('d-none');

            } catch (err) {
                UIService.showModal('error', 'Error', err.message);
                sendResetEmailBtn.disabled = false;
                sendResetEmailBtn.innerHTML = originalText;
            }
        });
    }
}

// TICKET OVERRIDE TAB
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
        if (!ticketNumber) return UIService.showModal('error', 'Missing Ticket', 'Please enter a ticket number.');

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
}

// GLOBAL FUNCTIONS
window.editTeller = (id, name, email, counter) => {
    const modal = new bootstrap.Modal(document.getElementById('editTellerModal'));

    document.getElementById('editTellerId').value = id;
    document.getElementById('editName').value = name;
    document.getElementById('editCounter').value = counter;
    document.getElementById('editEmail').value = email;

    const sendResetEmailBtn = document.getElementById('sendResetEmailBtn');
    const resetEmailFeedback = document.getElementById('resetEmailFeedback');

    sendResetEmailBtn.classList.remove('d-none');
    sendResetEmailBtn.disabled = false;
    sendResetEmailBtn.innerHTML = '<i class="bi bi-envelope-at-fill me-2"></i>SEND RESET EMAIL';
    resetEmailFeedback.classList.add('d-none');

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