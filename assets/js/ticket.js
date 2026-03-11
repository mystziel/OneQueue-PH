// Ticket page logic - reads URL parameters and validates ticket from Firebase
import { db } from './firebase-config.js';
import { doc, getDoc } from "firebase/firestore";

document.addEventListener("DOMContentLoaded", async () => {
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const ticketNumber = urlParams.get('ticketNumber');
    const ticketType = urlParams.get('type');
    const queueStatus = urlParams.get('status');
    const ticketId = urlParams.get('ticketId');

    // Try to fetch ticket data from Firebase if ticketId is provided
    if (ticketId) {
        try {
            const ticketDocRef = doc(db, "tickets", ticketId);
            const ticketDocSnap = await getDoc(ticketDocRef);
            
            if (ticketDocSnap.exists()) {
                const ticketData = ticketDocSnap.data();
                
                // Use Firebase data if available
                const ticketNumEl = document.getElementById('ticketNum');
                const ticketTypeEl = document.getElementById('ticketType');
                const queueStatusEl = document.getElementById('queueStatus');
                
                if (ticketNumEl) {
                    ticketNumEl.textContent = ticketData.ticketNumber || ticketNumber;
                }
                if (ticketTypeEl) {
                    ticketTypeEl.textContent = (ticketData.laneType || ticketType).toUpperCase() + " LANE";
                }
                if (queueStatusEl) {
                    queueStatusEl.textContent = ticketData.status || queueStatus || "Waiting";
                }
                
                console.log("Ticket loaded from Firebase:", ticketData);
                return;
            }
        } catch (error) {
            console.error("Error fetching ticket from Firebase:", error);
            // Fall back to URL parameters
        }
    }
    
    // Fallback: Use URL parameters if Firebase fetch fails or no ticketId
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

