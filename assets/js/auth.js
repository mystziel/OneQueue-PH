// assets/js/auth.js
import { auth, db } from './firebase-config.js';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    signOut,
    sendEmailVerification,
    onAuthStateChanged
} from "firebase/auth";
import { doc, getDoc, setDoc, query, collection, where, getDocs } from "firebase/firestore";

export const AuthService = {

    // Authenticate user
    login: async (email, password) => {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Enforce verification
            if (!user.emailVerified) {
                let appendMsg = "";

                try {
                    await sendEmailVerification(user);
                    appendMsg = " We have just sent a new verification link to your inbox. Please check your spam folder.";
                } catch (verifyError) {
                    if (verifyError.code === 'auth/too-many-requests') {
                        appendMsg = " Please check your inbox or spam folder for the link we sent recently.";
                    } else {
                        appendMsg = " Please verify your email.";
                    }
                }

                // Block access
                await signOut(auth);
                return {
                    success: false,
                    code: 'auth/email-not-verified',
                    message: 'Your email is not verified.' + appendMsg
                };
            }

            const role = await AuthService.getUserRole(user.uid);

            return { success: true, user, role };

        } catch (error) {
            return { success: false, code: error.code, message: error.message };
        }
    },

    // Register citizen
    register: async (email, password) => {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            await setDoc(doc(db, "users", user.uid), {
                email: email,
                role: 'citizen',
                createdAt: new Date(),
                setupComplete: false
            });

            // Trigger verification
            await sendEmailVerification(user);
            return { success: true, user };

        } catch (error) {
            return { success: false, code: error.code, message: error.message };
        }
    },

    // Fetch role
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

    // Reset password
    resetPassword: async (email) => {
        try {
            const q = query(collection(db, "users"), where("email", "==", email));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const userData = querySnapshot.docs[0].data();

                // Restrict tellers
                if (userData.role === 'teller') {
                    return {
                        success: false,
                        code: 'auth/unauthorized',
                        message: 'Tellers cannot reset their own passwords. Please contact the Administrator.'
                    };
                }
            }

            // Send link
            await sendPasswordResetEmail(auth, email);
            return { success: true };

        } catch (error) {
            return { success: false, code: error.code, message: error.message };
        }
    },

    // End session
    logout: async () => {
        try {
            await signOut(auth);
            return { success: true };
        } catch (error) {
            return { success: false, code: error.code, message: error.message };
        }
    },

    // Track auth
    observeAuth: (callback) => {
        onAuthStateChanged(auth, callback);
    }
};