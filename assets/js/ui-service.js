// assets/js/ui-service.js
import { Modal } from 'bootstrap';

export const UIService = {

    // Dynamic alert modal
    showModal: (type, title, message, onCloseCallback = null) => {
        const modalId = 'global-dynamic-modal';

        document.getElementById(modalId)?.remove();

        const style = {
            success: { btn: 'btn-success', text: 'text-success' },
            error: { btn: 'btn-danger', text: 'text-danger' }
        }[type] || { btn: 'btn-primary-q', text: 'text-dark' };

        document.body.insertAdjacentHTML('beforeend', `
        <div class="modal fade" id="${modalId}" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false">
            <div class="modal-dialog modal-dialog-centered mx-auto" style="max-width: 350px;">
                <div class="modal-content border-0 shadow-lg rounded-4">
                    <div class="modal-body p-4 text-center">
                        <h5 class="fw-bold mb-2 ${style.text}">${title}</h5>
                        <p class="text-muted small mb-4 lh-sm">${message}</p>
                        <button type="button" class="btn ${style.btn} w-100 py-2 rounded-3 fw-bold" data-bs-dismiss="modal">OKAY</button>
                    </div>
                </div>
            </div>
        </div>`);

        const modalEl = document.getElementById(modalId);
        const bsModal = new Modal(modalEl);

        modalEl.addEventListener('hidden.bs.modal', () => {
            if (onCloseCallback) onCloseCallback();
            bsModal.dispose();
            modalEl.remove();
        }, { once: true });

        bsModal.show();
    },

    // Dynamic confirm modal
    showConfirm: (title, message, confirmText, onConfirm) => {
        const modalId = 'global-confirm-modal';

        document.getElementById(modalId)?.remove();

        document.body.insertAdjacentHTML('beforeend', `
        <div class="modal fade" id="${modalId}" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false">
            <div class="modal-dialog modal-dialog-centered mx-auto" style="max-width: 400px;">
                <div class="modal-content border-0 shadow-lg rounded-4">
                    <div class="modal-body p-4 text-center">
                        <h5 class="fw-bold mb-2 text-dark">${title}</h5>
                        <p class="text-muted small mb-4 lh-sm">${message}</p>
                        <div class="d-flex gap-2">
                            <button type="button" class="btn btn-outline-secondary w-50 py-2 rounded-3 fw-bold" data-bs-dismiss="modal">NO</button>
                            <button type="button" id="${modalId}-yes" class="btn btn-primary-q w-50 py-2 rounded-3 fw-bold">${confirmText || 'YES'}</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>`);

        const modalEl = document.getElementById(modalId);
        const bsModal = new Modal(modalEl);

        document.getElementById(`${modalId}-yes`).onclick = () => {
            bsModal.hide();
            if (onConfirm) onConfirm();
        };

        modalEl.addEventListener('hidden.bs.modal', () => {
            bsModal.dispose();
            modalEl.remove();
        }, { once: true });

        bsModal.show();
    }
};