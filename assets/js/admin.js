import { AuthService } from './auth.js';
import { UIService } from './ui-service.js';

document.addEventListener('DOMContentLoaded', async () => {

    //Authentication
    AuthService.observeAuth(async (user) => {
        const loader = document.getElementById('adminLoader');
        const content = document.getElementById('adminContent');

        if (!user) {
            window.location.href = '../index.html';
            return;
        }

        const role = await AuthService.getUserRole(user.uid);
        if (role === 'admin') {
            if (loader) loader.classList.add('d-none'); // Hide loader
            if (content) {
                content.classList.remove('d-none'); // Show header + nav
                content.classList.add('fade-in');
            }
            loadDummyData();
        } else {
            window.location.href = '../index.html';
        }

        //Simulations (to be deleted and replaced)
        loadDummyData();
    });

    //Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            UIService.showConfirm(
                "Log Out",
                "Are you sure you want to end your session?",
                "Log Out",
                async () => {
                    await AuthService.logout();

                    window.location.href = '../index.html';
                }
            );
        });
    }

    //Simulations (to be deleted)
    function loadDummyData() {
        const tableBody = document.getElementById('allTellersTable');
        const queueTable = document.getElementById('overviewQueueTable');

        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td class="ps-4 fw-bold">Juan Dela Cruz (Demo)</td>
                    <td><span class="badge bg-light text-dark border">Window 1</span></td>
                    <td class="mobile-hide text-muted small">juan@demo.com</td>
                    <td class="text-end pe-4">
                        <button class="btn btn-sm btn-light text-primary me-1" onclick="openEditModal('1', 'Juan Dela Cruz', 'juan@demo.com', 'Window 1')"><i class="bi bi-pencil-square"></i></button>
                        <button class="btn btn-sm btn-light text-danger" onclick="deleteTeller('1')"><i class="bi bi-trash3"></i></button>
                    </td>
                </tr>
            `;
        }

        if (queueTable) {
            queueTable.innerHTML = `
                <tr>
                    <td class="ps-4 fw-bold">A-001</td>
                    <td><span class="badge bg-primary">Serving</span></td>
                </tr>
                <tr>
                    <td class="ps-4 fw-bold">A-002</td>
                    <td><span class="badge bg-warning text-dark">Waiting</span></td>
                </tr>
            `;
            // Update stats visually
            if(document.getElementById('statTotal')) document.getElementById('statTotal').innerText = "2";
            if(document.getElementById('statWaiting')) document.getElementById('statWaiting').innerText = "1";
            if(document.getElementById('statProcessed')) document.getElementById('statProcessed').innerText = "0";
        }
    }

    window.openEditModal = (id, name, email, counter) => {
        const modalEl = document.getElementById('editTellerModal');
        if (modalEl) {
            const modal = new bootstrap.Modal(modalEl);
            document.getElementById('editTellerId').value = id;
            document.getElementById('editName').value = name;
            document.getElementById('editEmail').value = email;
            document.getElementById('editCounter').value = counter;
            modal.show();
        }
    };

    window.deleteTeller = (id) => {
        UIService.showConfirm("Delete Teller?", "This is a simulation.", "Delete", () => {
            UIService.showModal('success', 'Simulation', `Teller ${id} deleted (Simulated).`);
        });
    };

    window.resetQueueSystem = () => {
        UIService.showConfirm(
            "Reset System?",
            "This will simulate deleting all tickets.",
            "Delete All",
            () => {
                UIService.showModal('success', 'Reset Complete', 'System reset simulation successful.');
            }
        );
    };

    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', (e) => {
            e.preventDefault();

            // Close any open modals
            const modals = document.querySelectorAll('.modal.show');
            modals.forEach(m => {
                const bsModal = bootstrap.Modal.getInstance(m);
                if(bsModal) bsModal.hide();
            });

            UIService.showModal('success', 'Success', 'Form submitted (Simulation Mode).');
        });
    });
});