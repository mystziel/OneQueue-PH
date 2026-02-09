// auth.js
import { auth, db } from './firebase-config.js';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    signOut,
    sendEmailVerification,
    onAuthStateChanged
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

export const AuthService = {

    // 1. Login User & Check Verification
    login: async (email, password) => {
        try {
            // Attempt to sign in
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // --- CRITICAL STEP: Check Email Verification ---
            if (!user.emailVerified) {
                await signOut(auth); // Force them to log out immediately
                return {
                    success: false,
                    code: 'auth/email-not-verified',
                    message: 'Please verify your email address before logging in.'
                };
            }

            // If verified, get their role
            const role = await AuthService.getUserRole(user.uid);

            return { success: true, user, role };

        } catch (error) {
            return { success: false, code: error.code, message: error.message };
        }
    },

    // 2. Register new Citizen
    register: async (email, password) => {
        try {
            // Create Auth User
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Create Firestore Profile (Default: Citizen)
            await setDoc(doc(db, "users", user.uid), {
                email: email,
                role: 'citizen',
                createdAt: new Date(),
                setupComplete: false // Useful flag for later
            });

            // Send Verification Email immediately
            await sendEmailVerification(user);

            // Note: We return success here so the UI can show the "Check your email" modal.
            // The user is technically logged in by Firebase here, but our
            // 'observeAuth' in index.js should prevent them from accessing
            // the dashboard because user.emailVerified is false.
            return { success: true, user };

        } catch (error) {
            return { success: false, code: error.code, message: error.message };
        }
    },

    // 3. Helper: Get User Role from Firestore
    getUserRole: async (uid) => {
        try {
            const docRef = doc(db, "users", uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return docSnap.data().role || 'citizen';
            }
            return 'citizen';
        } catch (e) {
            console.error("Role Fetch Error:", e);
            return 'citizen';
        }
    },

    // 4. Send Password Reset
    resetPassword: async (email) => {
        try {
            await sendPasswordResetEmail(auth, email);
            return { success: true };
        } catch (error) {
            return { success: false, code: error.code, message: error.message };
        }
    },

    // 5. Logout
    logout: async () => {
        try {
            await signOut(auth);
            return { success: true };
        } catch (error) {
            return { success: false, code: error.code, message: error.message };
        }
    },

    // 6. Auth State Observer
    observeAuth: (callback) => {
        onAuthStateChanged(auth, callback);
    }
};