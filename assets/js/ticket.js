// Ticket page logic - reads URL parameters and displays ticket info
document.addEventListener("DOMContentLoaded", () => {
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const ticketNumber = urlParams.get('ticketNumber');
    const ticketType = urlParams.get('type');
    const queueStatus = urlParams.get('status');

    // Update the UI with ticket information
    if (ticketNumber) {
        const ticketNumEl = document.getElementById('ticketNum');
        if (ticketNumEl) {
            ticketNumEl.textContent = ticketNumber;
        }
    }

    if (ticketType) {
        const ticketTypeEl = document.getElementById('ticketType');
        if (ticketTypeEl) {
            ticketTypeEl.textContent = ticketType.toUpperCase() + " LANE";
        }
    }

    if (queueStatus) {
        const queueStatusEl = document.getElementById('queueStatus');
        if (queueStatusEl) {
            queueStatusEl.textContent = queueStatus;
        }
    }

    // If no parameters provided, show error
    if (!ticketNumber || !ticketType) {
        const ticketNumEl = document.getElementById('ticketNum');
        const queueStatusEl = document.getElementById('queueStatus');
        
        if (ticketNumEl) ticketNumEl.textContent = "--";
        if (queueStatusEl) queueStatusEl.textContent = "Invalid Ticket";
    }
});

// Function to confirm cancel ticket
window.confirmCancel = function() {
    if (typeof UIService !== 'undefined') {
        UIService.showConfirm(
            "Cancel Ticket?",
            "Are you sure you want to cancel your ticket and leave the queue?",
            "Cancel Ticket",
            () => {
                // Redirect to citizen dashboard
                window.location.href = 'citizen-dashboard.html';
            }
        );
    } else {
        // Fallback if UIService is not available
        if (confirm("Are you sure you want to cancel your ticket and leave the queue?")) {
            window.location.href = 'citizen-dashboard.html';
        }
    }
};

