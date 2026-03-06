// assets/js/ui-service.js

import { Modal } from 'bootstrap';

export const UIService = {

    showModal: (type, title, message, onCloseCallback = null) => {
        let btnClass = 'btn-primary-q';
        let headerColor = 'text-dark';

        if (type === 'success') {
            btnClass = 'btn-success';
            headerColor = 'text-success';
        } else if (type === 'error') {
            btnClass = 'btn-danger';
            headerColor = 'text-danger';
        }

        const modalId = 'global-dynamic-modal';
        const existingEl = document.getElementById(modalId);
        if (existingEl) existingEl.remove();

        const modalHTML = `
        <div class="modal fade" id="${modalId}" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false">
            <div class="modal-dialog modal-dialog-centered modal-sm px-4">
                <div class="modal-content border-0 shadow-lg rounded-4">
                    <div class="modal-body p-4 text-center">
                        <h5 class="fw-bold mb-2 ${headerColor}">${title}</h5>
                        <p class="text-muted small mb-4 lh-sm">${message}</p>
                        <button type="button" id="${modalId}-btn" class="btn ${btnClass} w-100 py-2 rounded-3 fw-bold" data-bs-dismiss="modal">OKAY</button>
                    </div>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const modalEl = document.getElementById(modalId);
        if (modalEl) {
            const bsModal = new Modal(modalEl);
            modalEl.addEventListener('hidden.bs.modal', () => {
                if (onCloseCallback) onCloseCallback();
                bsModal.dispose();
                modalEl.remove();
            }, { once: true });
            bsModal.show();
        }
    },

    showConfirm: (title, message, confirmText, onConfirm) => {
        const modalId = 'global-confirm-modal';
        const existingEl = document.getElementById(modalId);
        if (existingEl) existingEl.remove();

        const modalHTML = `
        <div class="modal fade" id="${modalId}" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false">
            <div class="modal-dialog modal-dialog-centered modal-sm px-4">
                <div class="modal-content border-0 shadow-lg rounded-4">
                    <div class="modal-body p-4 text-center">
                        <h5 class="fw-bold mb-2 text-dark">${title}</h5>
                        <p class="text-muted small mb-4 lh-sm">${message}</p>
                        
                        <div class="d-flex gap-2">
                            <button type="button" class="btn btn-outline-secondary w-50 py-2 rounded-3 fw-bold" data-bs-dismiss="modal">
                                NO
                            </button>
                            <button type="button" id="${modalId}-yes" class="btn btn-primary-q w-50 py-2 rounded-3 fw-bold">
                                ${confirmText || 'YES'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const modalEl = document.getElementById(modalId);
        if (modalEl) {
            const bsModal = new Modal(modalEl);
            const yesBtn = document.getElementById(`${modalId}-yes`);

            if (yesBtn) {
                yesBtn.onclick = () => {
                    bsModal.hide();
                    if (onConfirm) onConfirm();
                };
            }

            modalEl.addEventListener('hidden.bs.modal', () => {
                bsModal.dispose();
                modalEl.remove();
            }, { once: true });

            bsModal.show();
        }
    }
};