// assets/js/admin-service.js
import { db, auth } from './firebase-config.js';
import { firebaseConfig } from './firebase-config.js';
import { collection, doc, setDoc, onSnapshot, query, where, getDocs, deleteDoc, updateDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword, signOut, sendEmailVerification, sendPasswordResetEmail } from "firebase/auth";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { UIService } from "./ui-service.js";

export const AdminService = {

    // Sync global settings
    listenToSettings: (callback) => {
        const settingsRef = doc(db, "settings", "global");
        return onSnapshot(settingsRef, (snap) => {
            if (snap.exists()) {
                callback(snap.data());
            } else {
                setDoc(settingsRef, { status: "closed", maxTickets: null }).catch(err => console.error("Error setting default status:", err));
                callback({ status: "closed", maxTickets: null });
            }
        });
    },

    // Update establishment status
    saveStatus: async (newStatus) => {
        const settingsRef = doc(db, "settings", "global");
        await setDoc(settingsRef, { status: newStatus }, { merge: true });
    },

    // Update daily ticket limit
    saveMaxTickets: async (max) => {
        const settingsRef = doc(db, "settings", "global");
        await setDoc(settingsRef, { maxTickets: max || null }, { merge: true });
    },

    // Stats
    listenToStats: (callback) => {
        const q = collection(db, "tickets");
        return onSnapshot(q, (snapshot) => {
            let waiting = 0, processed = 0, cancelled = 0, total = 0; // Removed noshow

            const startOfDayMillis = new Date().setHours(0, 0, 0, 0);

            snapshot.forEach(doc => {
                const t = doc.data();
                const ticketTime = t.createdAt ? t.createdAt.toMillis() : Date.now();

                if (ticketTime >= startOfDayMillis) {
                    total++;
                    if (t.status === "Waiting") waiting++;
                    else if (t.status === "Serving" || t.status === "Processed" || t.status === "complete") processed++;
                    else if (t.status === "Cancelled" || t.status === "unavailable" || t.status === "noshow") cancelled++;
                }
            });

            callback({ waiting, processed, cancelled, total });
        });
    },

    // Tellers
    createTeller: async (name, email, password, counterName) => {
        // Bypass admin logout
        const secondaryApp = initializeApp(firebaseConfig, "Secondary" + Date.now());
        const secondaryAuth = getAuth(secondaryApp);

        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        const uid = userCredential.user.uid;

        // Send verification email
        await sendEmailVerification(userCredential.user);

        await setDoc(doc(db, "users", uid), {
            name,
            email,
            role: "teller",
            counterName,
            createdAt: new Date(),
            setupComplete: true
        });

        await signOut(secondaryAuth);
        await deleteApp(secondaryApp);

        return { success: true, uid };
    },

    // Fetch teller list
    listenToTellers: (callback) => {
        const q = query(collection(db, "users"), where("role", "==", "teller"));
        return onSnapshot(q, (snapshot) => {
            const tellers = snapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data()
            }));
            callback(tellers);
        });
    },

    // Modify teller profile
    updateTeller: async (uid, name, counterName) => {
        const userRef = doc(db, "users", uid);
        await updateDoc(userRef, { name, counterName });
    },

    // Trigger password reset
    sendTellerPasswordReset: async (tellerEmail) => {
        await sendPasswordResetEmail(auth, tellerEmail);
    },

    // Remove teller profile
    deleteTeller: async (uid) => {
        await deleteDoc(doc(db, "users", uid));
        UIService.showModal(
            'info',
            'Teller Profile Deleted',
            'The teller profile is now DELETED'
        );
    },

    // Search specific ticket
    findTicketByNumber: async (ticketNumber) => {
        const q = query(collection(db, "tickets"), where("ticketNumber", "==", ticketNumber));
        const snap = await getDocs(q);
        return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
    },

    // Force priority status
    upgradeToPriority: async (ticketId) => {
        const ticketRef = doc(db, "tickets", ticketId);
        await updateDoc(ticketRef, "isPriority", true, "status", "Waiting");
    },

    // Delete all tickets
    resetAllTickets: async () => {
        const snapshot = await getDocs(collection(db, "tickets"));
        const deletePromises = snapshot.docs.map(docSnap => deleteDoc(doc(db, "tickets", docSnap.id)));
        await Promise.all(deletePromises);
    },

    // Fetch active queue
    listenToActiveTickets: (callback) => {
        const q = query(collection(db, "tickets"), where("status", "in", ["Waiting", "Serving"]));
        return onSnapshot(q, (snapshot) => {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const startOfDayMillis = startOfDay.getTime();

            const tickets = [];
            snapshot.forEach(docSnap => {
                const t = docSnap.data();
                const ticketTime = t.createdAt ? t.createdAt.toMillis() : Date.now();
                if (ticketTime >= startOfDayMillis) {
                    tickets.push({ id: docSnap.id, ...t });
                }
            });

            tickets.sort((a, b) => {
                if (a.status === "Serving" && b.status !== "Serving") return -1;
                if (b.status === "Serving" && a.status !== "Serving") return 1;
                return a.ticketNumber.localeCompare(b.ticketNumber);
            });

            callback(tickets);
        });
    },

    // Calculate teller performance
    listenToTellerStats: (callback) => {
        const q = collection(db, "tickets");
        return onSnapshot(q, (snapshot) => {
            const tellerMap = {};
            const startOfDayMillis = new Date().setHours(0, 0, 0, 0);

            snapshot.forEach(docSnap => {
                const t = docSnap.data();
                const ticketTime = t.createdAt ? t.createdAt.toMillis() : Date.now();

                if (ticketTime >= startOfDayMillis) {
                    const tellerKey = t.counterName || 'Unassigned';
                    if (!tellerMap[tellerKey]) tellerMap[tellerKey] = { name: tellerKey, queued: 0, processed: 0, cancelled: 0 };

                    const stat = tellerMap[tellerKey];
                    if (t.status === "Waiting") stat.queued++;
                    else if (t.status === "Serving" || t.status === "Processed" || t.status === "complete") stat.processed++;
                    else if (t.status === "Cancelled" || t.status === "unavailable" || t.status === "noshow") stat.cancelled++;
                }
            });

            callback(Object.values(tellerMap));
        });
    }
};