// assets/js/admin-service.js
import { db, auth } from './firebase-config.js';
import { firebaseConfig } from './firebase-config.js';

import { 
    collection, doc, setDoc, onSnapshot, 
    query, where, getDocs, deleteDoc, updateDoc 
} from "firebase/firestore";

import { 
    createUserWithEmailAndPassword, updatePassword, signOut 
} from "firebase/auth";

import { initializeApp, deleteApp } from "firebase/app";
import { getAuth } from "firebase/auth";

export const AdminService = {

    // ==================== SETTINGS (Overview) ====================
    listenToSettings: (callback) => {
        const settingsRef = doc(db, "settings", "global");
        return onSnapshot(settingsRef, (snap) => {
            if (snap.exists()) {
                callback(snap.data());
            } else {
                setDoc(settingsRef, { status: "closed", maxTickets: null });
                callback({ status: "closed", maxTickets: null });
            }
        });
    },

    saveStatus: async (newStatus) => {
        const settingsRef = doc(db, "settings", "global");
        await setDoc(settingsRef, { status: newStatus }, { merge: true });
    },

    saveMaxTickets: async (max) => {
        const settingsRef = doc(db, "settings", "global");
        await setDoc(settingsRef, { maxTickets: max || null }, { merge: true });
    },

    // ==================== STATS ====================
    listenToStats: (callback) => {
        const q = collection(db, "tickets");
        return onSnapshot(q, (snapshot) => {
            let waiting = 0, processed = 0, cancelled = 0, noshow = 0,total = 0;

            snapshot.forEach(doc => {
                const t = doc.data();
                total++;
                if (t.status === "waiting") waiting++;
                else if (t.status === "completed") processed++;
                else if (t.status === "cancelled") cancelled++;
                else if (t.status === "noshow") noshow++;
            });

            callback({ waiting, processed, cancelled, noshow, total });
        });
    },

    // ==================== TELLERS ====================
    createTeller: async (name, email, password, counterName) => {
        const secondaryApp = initializeApp(firebaseConfig, "Secondary" + Date.now());
        const secondaryAuth = getAuth(secondaryApp);

        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        const uid = userCredential.user.uid;

        await setDoc(doc(db, "users", uid), {
            name,
            email,
            role: "teller",
            counterName,
            createdAt: new Date(),
            setupComplete: true
        });

        await signOut(secondaryAuth);
        deleteApp(secondaryApp);

        return { success: true, uid };
    },

    listenToTellers: (callback) => {
        const q = query(collection(db, "users"), where("role", "==", "teller"));
        return onSnapshot(q, (snapshot) => {
            const tellers = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(tellers);
        });
    },

    updateTeller: async (uid, name, counterName, newPassword = null) => {
        const userRef = doc(db, "users", uid);
        await updateDoc(userRef, { name, counterName });

        if (newPassword) {
            await updatePassword(auth.currentUser, newPassword);
        }
    },

    deleteTeller: async (uid) => {
        await deleteDoc(doc(db, "users", uid));
        
        UIService.showModal(
            'info', 
            'Teller Profile Deleted', 
            'The teller profile was removed from the database.<br><br>' +
            '<b>Next step:</b> Go to Firebase Console → Authentication and manually delete the user account.'
        );
    },

    // ==================== TICKET OVERRIDE ====================
    findTicketByNumber: async (ticketNumber) => {
        const q = query(collection(db, "tickets"), where("ticketNumber", "==", ticketNumber));
        const snap = await getDocs(q);
        return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
    },

    upgradeToPriority: async (ticketId) => {
        const ticketRef = doc(db, "tickets", ticketId);
        await updateDoc(ticketRef, { priority: true, status: "waiting" });
    },

    cancelFoundTicket: async (ticketId) => {
        const ticketRef = doc(db, "tickets", ticketId);
        await updateDoc(ticketRef, { 
            status: "cancelled",
            cancelledAt: new Date()
        });
    },

    resetAllTickets: async () => {
        const snapshot = await getDocs(collection(db, "tickets"));
        const deletePromises = snapshot.docs.map(docSnap => 
            deleteDoc(doc(db, "tickets", docSnap.id))
        );
        await Promise.all(deletePromises);
    },

    // ==================== LIVE QUEUE TABLE ====================
    listenToActiveTickets: (callback) => {
        const q = query(collection(db, "tickets"), where("status", "in", ["waiting", "serving"]));
        return onSnapshot(q, (snapshot) => {
            const tickets = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })).sort((a, b) => a.ticketNumber.localeCompare(b.ticketNumber));
            callback(tickets);
        });
    },

    // ==================== PER TELLER STATS ====================
    listenToTellerStats: (callback) => {
        const q = collection(db, "tickets");
        return onSnapshot(q, (snapshot) => {
            const tellerMap = {};

            snapshot.forEach(docSnap => {
                const t = docSnap.data();
                const tellerKey = t.counterName || 'Unassigned';

                if (!tellerMap[tellerKey]) {
                    tellerMap[tellerKey] = { name: tellerKey, queued: 0, processed: 0, cancelled: 0, noshow: 0 };
                }

                const stat = tellerMap[tellerKey];
                if (t.status === "completed") stat.processed++;
                else if (t.status === "waiting") stat.queued++;
                else if (t.status === "cancelled") stat.cancelled++;
                else if (t.status === "noshow") stat.noshow++;
            });

            callback(Object.values(tellerMap));
        });
    }
};