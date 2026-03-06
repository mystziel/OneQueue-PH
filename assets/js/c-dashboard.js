// assets/js/c-dashboard.js
import { UIService } from './ui-service.js';
import { AuthService } from "./auth";

let html5QrcodeScanner = null;

document.addEventListener("DOMContentLoaded", () => {

    //Loading Screen
    const loader = document.getElementById("mainLoader");
    const content = document.getElementById("mainContent");

    setTimeout(() => {
        loader.classList.add("d-none");
        loader.classList.remove("d-flex");
        content.classList.remove("d-none");
    }, 1500);

    //Logout
    const logoutBtn = document.getElementById("logoutBtn");

    if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();

            UIService.showConfirm(
                "Log Out?",
                "Are you sure you want to end your session?",
                "Log Out",
                async () => {

                    await AuthService.logout();

                    window.location.href = "../index.html";
                }
            );
        });
    }

    //Edit Profile Button
    const editProfileBtn = document.getElementById("editProfileBtn");
    const setupProfileModal = document.getElementById("setupProfileModal");
    const profileForm = document.getElementById("profileForm");

    if (editProfileBtn && setupProfileModal) {
        editProfileBtn.addEventListener("click", () => {
            const bsModal = new bootstrap.Modal(setupProfileModal);
            bsModal.show();
        });
    }

    //Profile Form Submit
    if (profileForm) {
        profileForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const name = document.getElementById("inputName").value;
            const mobileInput = document.getElementById("inputMobile");
            const mobile = mobileInput.value.replace(/\s/g, ''); // Remove all spaces
            const birthday = document.getElementById("inputBirthday").value;
            const sex = document.querySelector('input[name="sex"]:checked').value;
            const isPriority = document.getElementById("CPriority").checked;
            const isPregnant = document.getElementById("checkPregnant")?.checked || false;

            // Validate mobile number: exactly 11 digits
            if (!/^[0-9]{11}$/.test(mobile)) {
                UIService.showModal('error', 'Invalid Mobile', 'Mobile number must be exactly 11 digits (e.g., 09123456789).');
                return;
            }

            // Update the input value with the cleaned mobile (no spaces)
            mobileInput.value = mobile;

            console.log("Profile updated:", { name, mobile, birthday, sex, isPriority, isPregnant });

            // TODO: Save profile data to Firebase/Firestore
            // For now, show success message
            UIService.showModal('success', 'Profile Updated', 'Your profile has been saved successfully.');

            // Hide modal
            const bsModal = bootstrap.Modal.getInstance(setupProfileModal);
            if (bsModal) {
                bsModal.hide();
            }

            // Update the displayed profile info
            document.getElementById("DName").textContent = name;
            document.getElementById("DMobile").textContent = mobile;
            
            // Update priority badge
            const priorityBadge = document.getElementById("priorityBadge");
            if (isPriority || isPregnant) {
                priorityBadge.className = "badge bg-warning text-dark border border-warning mt-2";
                priorityBadge.textContent = isPregnant ? "Pregnant" : "Priority";
            } else {
                priorityBadge.className = "badge bg-secondary-subtle text-secondary border border-secondary-subtle mt-2";
                priorityBadge.textContent = "Regular";
            }
        });
    }
});

// --- QR Scanner Functions ---

window.startScan = function() {
    const scanModalEl = document.getElementById('scanModal');
    const readerEl = document.getElementById('reader');
    
    if (!scanModalEl || !readerEl) {
        UIService.showModal('error', 'Error', 'Scanner not initialized properly.');
        return;
    }

    // Show the modal using Bootstrap
    const scanModal = new bootstrap.Modal(scanModalEl);
    scanModal.show();

    // Initialize QR scanner
    html5QrcodeScanner = new Html5Qrcode("reader");
    
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    
    html5QrcodeScanner.start(
        { facingMode: "environment" },
        config,
        onScanSuccess,
        onScanFailure
    ).catch(err => {
        console.error("Error starting scanner:", err);
        UIService.showModal('error', 'Camera Error', 'Unable to access camera. Please ensure camera permissions are granted.');
    });
};

window.stopScan = function() {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().then(() => {
            html5QrcodeScanner.clear();
            html5QrcodeScanner = null;
        }).catch(err => {
            console.error("Error stopping scanner:", err);
            html5QrcodeScanner = null;
        });
    }
};

function onScanSuccess(decodedText, decodedResult) {
    // Stop scanning when QR is detected
    window.stopScan();
    
    // Hide the modal
    const scanModalEl = document.getElementById('scanModal');
    if (scanModalEl) {
        const bsModal = bootstrap.Modal.getInstance(scanModalEl);
        if (bsModal) {
            bsModal.hide();
        }
    }

    console.log("QR Code scanned:", decodedText);
    
    // Process the scanned QR code
    handleScannedQR(decodedText);
}

function onScanFailure(error) {
    // Handle scan failure silently - this is called continuously when no QR is detected
    // console.warn(`Code scan error = ${error}`);
}

function handleScannedQR(qrData) {
    // Parse QR data - expected format: kiosk_{kioskId}
    try {
        if (qrData.startsWith("kiosk_")) {
            const kioskId = qrData.replace("kiosk_", "");
            
            // Show confirmation to join queue
            UIService.showConfirm(
                "Join Queue?",
                "Do you want to join the queue for this kiosk?",
                "JOIN",
                () => {
                    // TODO: Implement queue joining logic here
                    // This would typically call a QueueService to add the user to the queue
                    console.log("Joining queue for kiosk:", kioskId);
                    
                    UIService.showModal('success', 'Success', 'You have joined the queue! Check your history for updates.');
                }
            );
        } else {
            UIService.showModal('error', 'Invalid QR', 'This QR code is not valid for joining a queue.');
        }
    } catch (err) {
        console.error("Error processing QR:", err);
        UIService.showModal('error', 'Error', 'Failed to process QR code.');
    }
}
