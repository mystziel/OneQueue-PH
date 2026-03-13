/* global Html5Qrcode */

// assets/js/c-dashboard.js
import { UIService } from './ui-service.js';
import { AuthService } from "./auth.js";
import { db, auth } from './firebase-config.js';
import { doc, setDoc, getDoc, collection, addDoc, query, where, getCountFromServer, serverTimestamp, getDocs, limit } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

let html5QrcodeScanner = null;
let currentUser = null;

// Init auth
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const role = await AuthService.getUserRole(user.uid);
        if (role !== 'citizen') return window.location.href = '../index.html';

        currentUser = user;

        // Check if they already have an active ticket
        const q = query(
            collection(db, "tickets"),
            where("userId", "==", user.uid),
            where("status", "in", ["Waiting", "Serving"]),
            limit(1)
        );
        const activeSnap = await getDocs(q);

        // Active ticket = force redirect immediately
        if (!activeSnap.empty) {
            return window.location.href = `ticket.html?ticketId=${activeSnap.docs[0].id}`;
        }

        await loadUserProfile(user.uid);
        hideLoadingScreen();
    } else {
        window.location.href = "../index.html";
    }
});

// Hide loader
function hideLoadingScreen() {
    const loader = document.getElementById("mainLoader");
    const content = document.getElementById("mainContent");
    if (loader && content) {
        loader.classList.add("d-none");
        loader.classList.remove("d-flex");
        content.classList.remove("d-none");
        content.classList.add("fade-in");
    }
}

// Load profile
async function loadUserProfile(uid) {
    try {
        const userDocRef = doc(db, "users", uid);
        const userDocSnap = await getDoc(userDocRef);

        let needsSetup = true;

        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();

            if (userData.setupComplete) needsSetup = false;

            document.getElementById("DName").textContent = userData.name || "Setup Profile Required";
            document.getElementById("DMobile").textContent = userData.mobile || "--";

            const priorityBadge = document.getElementById("priorityBadge");
            priorityBadge.className = userData.isPriority
                ? "badge bg-warning text-dark border border-warning mt-2"
                : "badge bg-secondary-subtle text-secondary border border-secondary-subtle mt-2";
            priorityBadge.textContent = userData.isPriority ? "PRIORITY" : "REGULAR";

            const inName = document.getElementById("inputName");
            const inMobile = document.getElementById("inputMobile");
            const inBday = document.getElementById("inputBirthday");

            if (inName) inName.value = userData.name || "";
            if (inMobile) inMobile.value = userData.mobile || "";

            if (inBday && userData.birthday) {
                inBday.value = userData.birthday;
                inBday.dispatchEvent(new Event('input'));
            }

            if (userData.sex) {
                const sexRadio = document.querySelector(`input[name="sex"][value="${userData.sex}"]`);
                if (sexRadio) {
                    sexRadio.checked = true;
                    sexRadio.dispatchEvent(new Event('change'));
                }
            }

            const isActuallySenior = document.getElementById("checkSenior")?.checked;
            const checkPWD = document.getElementById("checkPWD");
            if (userData.isPriority && !isActuallySenior && checkPWD) {
                checkPWD.checked = true;
            }
        }

        // Open setup
        if (needsSetup) {
            setTimeout(() => {
                const setupModal = new bootstrap.Modal(document.getElementById("setupProfileModal"));
                setupModal.show();
            }, 500);
        }

    } catch (error) {
        console.error("Error loading profile:", error);
    }
}

// Save profile
async function saveProfileToFirestore(uid, profileData) {
    try {
        await setDoc(doc(db, "users", uid), {
            email: currentUser?.email || "",
            role: 'citizen',
            ...profileData,
            setupComplete: true,
            updatedAt: serverTimestamp()
        }, { merge: true });
        return true;
    } catch (error) {
        UIService.showModal('error', 'Save Error', 'Failed to save profile. Error: ' + error.message);
        return false;
    }
}

// Save ticket
async function saveTicketToFirestore(ticketData) {
    try {
        const ticketDocRef = await addDoc(collection(db, "tickets"), {
            ...ticketData,
            createdAt: serverTimestamp(),
            status: "Waiting"
        });
        return ticketDocRef.id;
    } catch (error) {
        UIService.showModal('error', 'Ticket Error', 'Failed to create ticket. Please try again.');
        return null;
    }
}

// Start scanner
window.startScan = async function() {
    try {
        // 1. Strict Profile Validation
        const userDocSnap = await getDoc(doc(db, "users", currentUser.uid));

        if (!userDocSnap.exists() || !userDocSnap.data().setupComplete) {
            return UIService.showModal('error', 'Profile Incomplete', 'Please set up your profile before joining the queue.');
        }

        const userData = userDocSnap.data();

        // Enforce valid mobile number
        if (!userData.mobile || !/^[0-9]{11}$/.test(userData.mobile)) {
            return UIService.showModal('error', 'Profile Error', 'A valid 11-digit mobile number is required. Please edit your profile.');
        }

        // Enforce age requirement
        if (!userData.birthday) {
            return UIService.showModal('error', 'Profile Error', 'Birthdate is required. Please edit your profile.');
        }

        const birthDateObj = new Date(userData.birthday);
        const todayObj = new Date();
        let computedAge = todayObj.getFullYear() - birthDateObj.getFullYear();
        const m = todayObj.getMonth() - birthDateObj.getMonth();
        if (m < 0 || (m === 0 && todayObj.getDate() < birthDateObj.getDate())) computedAge--;

        if (computedAge < 16) {
            return UIService.showModal('error', 'Age Restriction', 'You must be at least 16 years old to join the queue.');
        }

        // 2. Validate Establishment Status
        const settingsSnap = await getDoc(doc(db, "settings", "global"));
        let status = "closed";
        let maxTickets = null;

        if (settingsSnap.exists()) {
            const data = settingsSnap.data();
            status = data.status || "closed";
            maxTickets = data.maxTickets;
        }

        if (status === "closed") {
            return UIService.showModal('error', 'Establishment Closed', 'The establishment is currently closed.');
        } else if (status === "break") {
            return UIService.showModal('info', 'On Break', 'The establishment is currently on break.');
        }

        // Validate capacity limit
        if (maxTickets) {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            const q = query(collection(db, "tickets"), where("createdAt", ">=", startOfDay));
            const countSnap = await getCountFromServer(q);

            if (countSnap.data().count >= maxTickets) {
                return UIService.showModal('error', 'Queue Full', `Maximum limit of ${maxTickets} tickets reached.`);
            }
        }

    } catch (error) {
        return UIService.showModal('error', 'Network Error', 'Could not verify status.');
    }

    const scanModalEl = document.getElementById('scanModal');
    const readerEl = document.getElementById('reader');

    if (!scanModalEl || !readerEl) return UIService.showModal('error', 'Error', 'Scanner not initialized.');

    new bootstrap.Modal(scanModalEl).show();
    html5QrcodeScanner = new Html5Qrcode("reader");

    const config = {
        fps: 10,
        aspectRatio: 1.0,
        qrbox: (vw, vh) => ({ width: Math.floor(Math.min(vw, vh) * 0.75), height: Math.floor(Math.min(vw, vh) * 0.75) })
    };

    html5QrcodeScanner.start({ facingMode: "environment" }, config, onScanSuccess, onScanFailure)
        .catch(() => UIService.showModal('error', 'Camera Error', 'Unable to access camera.'));
};

// Process QR
async function handleScannedQR(qrData) {
    try {
        const settingsSnap = await getDoc(doc(db, "settings", "global"));

        if (settingsSnap.exists()) {
            const data = settingsSnap.data();

            if (data.status !== "open") return UIService.showModal('error', 'Queue Not Open', 'The establishment is not accepting tickets.');

            if (data.maxTickets) {
                const startOfDay = new Date();
                startOfDay.setHours(0, 0, 0, 0);

                const countSnap = await getCountFromServer(query(collection(db, "tickets"), where("createdAt", ">=", startOfDay)));
                if (countSnap.data().count >= data.maxTickets) {
                    return UIService.showModal('error', 'Queue Full', `Limit of ${data.maxTickets} tickets reached.`);
                }
            }
        }

        // Validate QR format
        if (!qrData.startsWith("kiosk_")) return UIService.showModal('error', 'Invalid QR', 'Invalid queue QR code.');

        const kioskId = qrData.replace("kiosk_", "");

        const userDocSnap = await getDoc(doc(db, "users", currentUser.uid));
        const userData = userDocSnap.exists() ? userDocSnap.data() : {};
        const isPriority = userData.isPriority === true;

        const userName = userData.name || document.getElementById("DName")?.textContent || "Unknown";
        const userMobile = userData.mobile || document.getElementById("DMobile")?.textContent || "";

        const laneType = isPriority ? "Priority" : "Regular";
        const ticketNumber = (isPriority ? "P-" : "R-") + Math.floor(100 + Math.random() * 900);

        // Queue logic
        const executeJoinQueue = async () => {
            const ticketId = await saveTicketToFirestore({
                ticketNumber, laneType, kioskId, userId: currentUser.uid, userName, userMobile, isPriority
            });

            if (ticketId) {
                const params = new URLSearchParams({ ticketId, ticketNumber, type: laneType, status: "Waiting" });
                window.location.href = `ticket.html?${params.toString()}`;
            }
        };

        const msg = isPriority
            ? "You are required to bring valid proof of priority status on the day of queueing."
            : "Do you want to join the queue for this kiosk?";

        UIService.showConfirm("Join Queue?", msg, "JOIN", executeJoinQueue);

    } catch (err) {
        console.error("QR Error:", err);
        UIService.showModal('error', 'Error', 'Failed to process QR code.');
    }
}

// Stop scanner
window.stopScan = function() {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().then(() => {
            html5QrcodeScanner.clear();
            html5QrcodeScanner = null;
        }).catch(() => html5QrcodeScanner = null);
    }
};

// Scan success
async function onScanSuccess(decodedText) {
    window.stopScan();

    const scanModalEl = document.getElementById('scanModal');
    if (scanModalEl) {
        const bsModal = bootstrap.Modal.getInstance(scanModalEl);
        if (bsModal) bsModal.hide();
    }

    await handleScannedQR(decodedText);
}

// Scan failure
function onScanFailure() {
    // Ignore
}

// Setup UI
document.addEventListener("DOMContentLoaded", () => {

    // Handle logout
    document.getElementById("logoutBtn")?.addEventListener("click", (e) => {
        e.preventDefault();
        UIService.showConfirm("Log Out?", "Are you sure you want to end your session?", "Log Out", async () => {
            await AuthService.logout();
            window.location.href = "../index.html";
        });
    });

    // Profile modal
    const setupProfileModal = document.getElementById("setupProfileModal");
    document.getElementById("editProfileBtn")?.addEventListener("click", () => {
        new bootstrap.Modal(setupProfileModal).show();
    });

    // Cache elements
    const birthdayInput = document.getElementById("inputBirthday");
    const ageDisplay = document.getElementById("ageDisplay");
    const checkSenior = document.getElementById("checkSenior");
    const labelSenior = document.getElementById("labelSenior");
    const sexRadios = document.querySelectorAll('input[name="sex"]');
    const pregnancyOption = document.getElementById("pregnancyOption");
    const checkPregnant = document.getElementById("checkPregnant");

    // Calculate age
    if (birthdayInput) {
        birthdayInput.addEventListener('input', (e) => {
            if (e.target.value) {
                const birthDate = new Date(e.target.value);
                const today = new Date();
                let age = today.getFullYear() - birthDate.getFullYear();
                const m = today.getMonth() - birthDate.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;

                ageDisplay.textContent = `Age: ${age} years old`;

                if (age >= 60) {
                    checkSenior.checked = true;
                    labelSenior.classList.add('bg-secondary', 'text-white');
                } else {
                    checkSenior.checked = false;
                    labelSenior.classList.remove('bg-secondary', 'text-white');
                }
            } else {
                ageDisplay.textContent = 'Age: --';
                checkSenior.checked = false;
                labelSenior.classList.remove('bg-secondary', 'text-white');
            }
        });
    }

    // Toggle pregnancy
    sexRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'female') {
                pregnancyOption.classList.remove('d-none');
            } else {
                pregnancyOption.classList.add('d-none');
                checkPregnant.checked = false;
            }
        });
    });

    // Submit form
    const profileForm = document.getElementById("profileForm");
    if (profileForm) {
        profileForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const name = document.getElementById("inputName").value;
            const mobileInput = document.getElementById("inputMobile");
            const mobile = mobileInput.value.replace(/\s/g, '');
            const birthday = document.getElementById("inputBirthday").value;
            const sex = document.querySelector('input[name="sex"]:checked').value;

            // Enforce age
            const birthDateObj = new Date(birthday);
            const todayObj = new Date();
            let computedAge = todayObj.getFullYear() - birthDateObj.getFullYear();
            const m = todayObj.getMonth() - birthDateObj.getMonth();
            if (m < 0 || (m === 0 && todayObj.getDate() < birthDateObj.getDate())) computedAge--;

            if (computedAge < 16) return UIService.showModal('error', 'Age Restriction', 'You must be at least 16 years old.');

            // Determine priority
            const isPriority = (computedAge >= 60) || document.getElementById("checkPWD").checked || (document.getElementById("checkPregnant")?.checked || false);

            // Validate mobile
            if (!/^[0-9]{11}$/.test(mobile)) return UIService.showModal('error', 'Invalid Mobile', 'Must be exactly 11 digits.');
            mobileInput.value = mobile;

            // Save data
            const executeSave = async () => {
                if (!currentUser) return;

                const saveSuccess = await saveProfileToFirestore(currentUser.uid, { name, mobile, birthday, sex, isPriority });

                if (saveSuccess) {
                    UIService.showModal('success', 'Profile Updated', 'Profile saved successfully.');
                    bootstrap.Modal.getInstance(setupProfileModal)?.hide();

                    document.getElementById("DName").textContent = name;
                    document.getElementById("DMobile").textContent = mobile;

                    const priorityBadge = document.getElementById("priorityBadge");
                    priorityBadge.className = isPriority
                        ? "badge bg-warning text-dark border border-warning mt-2"
                        : "badge bg-secondary-subtle text-secondary border border-secondary-subtle mt-2";
                    priorityBadge.textContent = isPriority ? "PRIORITY" : "REGULAR";
                }
            };

            // Confirm priority
            if (isPriority) {
                UIService.showConfirm(
                    "Verification Required",
                    "By claiming Priority, you must present valid proof at the counter or your ticket will be cancelled.",
                    "I Understand",
                    executeSave
                );
            } else {
                await executeSave();
            }
        });
    }
});