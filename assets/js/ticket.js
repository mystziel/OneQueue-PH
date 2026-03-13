// assets/js/ticket.js
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, updateDoc, serverTimestamp, collection, query, where, getDocs, limit } from "firebase/firestore";
import { UIService } from './ui-service.js';
import { QueueService } from './queue-service.js';

let positionListener = null;

// Init auth
document.addEventListener("DOMContentLoaded", () => {
    onAuthStateChanged(auth, (user) => {
        if (user) initializeTicketPage(user);
        else window.location.href = '../index.html';
    });
});

// Setup ticket listener
function initializeTicketPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const ticketId = urlParams.get('ticketId');

    if (!ticketId) return;

    // Cache DOM elements
    const loader = document.getElementById('ticketLoader');
    const content = document.getElementById('ticketContent');
    const statusEl = document.getElementById('queueStatus');
    const typeBadge = document.getElementById('ticketType');
    const ticketNumEl = document.getElementById('ticketNum');
    const alertBox = statusEl.closest('.alert');

    let isTicketClosed = false; // ---> NEW: Flag to prevent double popups

    // ---> FIX: Assign the listener to a variable so we can turn it off later
    const unsubscribe = onSnapshot(doc(db, "tickets", ticketId), (docSnap) => {
        // If the document doesn't exist OR we already closed the ticket, ignore the update!
        if (!docSnap.exists() || isTicketClosed) return;

        const t = docSnap.data();

        // Display ticket number
        ticketNumEl.textContent = t.ticketNumber;

        // Calculate exact wait time
        const now = Date.now();
        const createdTime = t.createdAt?.toMillis ? t.createdAt.toMillis() : now;
        const waitTimeMins = (now - createdTime) / 60000;

        // Update lane badge
        if (t.isPriority) {
            typeBadge.textContent = "PRIORITY LANE";
            typeBadge.className = "badge bg-warning text-dark px-3 py-2 rounded-pill";
        } else if (t.isUpgraded || waitTimeMins >= 30) {
            typeBadge.textContent = "PRIORITY LANE";
            typeBadge.className = "badge bg-info text-white px-3 py-2 rounded-pill";
        } else {
            typeBadge.textContent = "REGULAR LANE";
            typeBadge.className = "badge bg-danger px-3 py-2 rounded-pill";
        }

        // Handle live states
        if (t.status === "Waiting") {
            if (!positionListener) {
                positionListener = QueueService.listenToGlobalQueue(ticketId, (pos) => {
                    if (pos === 0) statusEl.innerHTML = `<span class="fw-bold text-success">You are next!</span>`;
                    else if (pos > 0 && pos < 10) statusEl.innerHTML = `<span class="fw-bold">${pos}</span> people ahead`;
                    else statusEl.innerHTML = `<span class="text-muted">10+ people ahead</span>`;
                });
            }
        } else if (t.status === "Serving") {
            if (positionListener) { positionListener(); positionListener = null; }
            statusEl.innerHTML = `<span class="d-block small text-muted mb-1 text-uppercase fw-bold">Please Proceed To</span><span class="fw-bold fs-1 text-success">${t.counterName || 'COUNTER'}</span>`;
        } else {
            isTicketClosed = true;
            unsubscribe();

            if (positionListener) { positionListener(); positionListener = null; }

            const isSuccess = (t.status === 'Processed' || t.status === 'complete');
            let displayStatus = t.status.toUpperCase();
            let message = '';

            // Format success vs specific cancellation reasons
            if (isSuccess) {
                message = 'Your transaction has been successfully processed. Thank you for using OneQueue PH!';
            } else {
                if (t.status === 'noshow') {
                    displayStatus = 'NO SHOW';
                    message = 'Your ticket was closed by the teller.<br>Reason: <b class="text-danger">Customer No Show</b>';
                } else if (t.status === 'unavailable') {
                    displayStatus = 'UNAVAILABLE';
                    message = 'Your ticket was closed by the teller.<br>Reason: <b class="text-danger">Documents Unavailable</b>';
                } else {
                    message = 'Your ticket has been cancelled.';
                }
            }

            // Update the text box
            statusEl.textContent = displayStatus;

            // Show the single modal
            UIService.showModal(
                isSuccess ? 'success' : 'error',
                isSuccess ? 'Transaction Complete' : 'Ticket Closed',
                message,
                () => { window.location.href = 'citizen-dashboard.html'; }
            );
        }

        // Style status box
        alertBox.className = 'alert border-0 py-3 rounded-4 ';
        if (t.status === 'Serving') alertBox.classList.add('alert-success', 'text-success', 'shadow-sm');
        else if (t.status === 'Cancelled' || t.status === 'noshow' || t.status === 'unavailable') alertBox.classList.add('alert-danger', 'text-danger');
        else alertBox.classList.add('alert-warning', 'text-warning-emphasis');

        // Reveal UI
        loader.classList.add('d-none');
        content.classList.remove('d-none');
    });
}

// Handle manual cancellation
window.confirmCancel = function() {
    UIService.showConfirm("Cancel Ticket?", "Are you sure you want to leave the queue?", "Yes, Cancel", async () => {
        const ticketId = new URLSearchParams(window.location.search).get('ticketId');

        await updateDoc(doc(db, "tickets", ticketId), {
            status: "Cancelled",
            cancelledAt: serverTimestamp()
        });
    });
};