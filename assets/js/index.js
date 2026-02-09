//index.js
import { AuthService } from './auth.js';
import { UIService } from './ui-service.js';

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. Initialization & Splash Screen ---
    const splash = document.getElementById('splash-screen');

    AuthService.observeAuth(async (user) => {
        if (user && user.emailVerified) {
            const role = await AuthService.getUserRole(user.uid);
            handleRedirect(role);
        }

        setTimeout(() => {
            if (splash) {
                splash.style.opacity = '0';
                setTimeout(() => splash.remove(), 500);
            }
        }, 1000);
    });

    // --- 2. View Switching Logic ---
    const views = {
        login: document.getElementById('login-view'),
        register: document.getElementById('register-view'),
        forgot: document.getElementById('forgot-view')
    };

    const switchView = (viewName) => {
        // Hide all
        Object.values(views).forEach(el => {
            if(el) {
                el.classList.add('d-none');
                el.classList.remove('fade-in'); // Reset animation
            }
        });

        // Show target
        const target = views[viewName];
        if (target) {
            target.classList.remove('d-none');
            // Small delay to re-trigger CSS animation if needed
            setTimeout(() => target.classList.add('fade-in'), 10);
        }
    };

    // Bind Navigation Buttons
    document.getElementById('btnGoToRegister')?.addEventListener('click', () => switchView('register'));
    document.getElementById('btnGoToForgot')?.addEventListener('click', () => switchView('forgot'));
    document.getElementById('btnBackToLoginReg')?.addEventListener('click', () => switchView('login'));
    document.getElementById('btnBackToLoginForgot')?.addEventListener('click', () => switchView('login'));


    // --- 3. Logic Handlers ---

    // LOGIN
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const btn = loginForm.querySelector('button[type="submit"]');

            setLoading(btn, true, 'Logging In...');

            const result = await AuthService.login(email, password);

            setLoading(btn, false, 'LOG IN');

            if (result.success) {
                handleRedirect(result.role);
            } else {
                handleAuthError(result);
            }
        });
    }

    // REGISTER
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('regEmail').value;
            const password = document.getElementById('regPassword').value;
            const confirm = document.getElementById('regConfirmPassword').value;
            const btn = registerForm.querySelector('button[type="submit"]');

            if (password !== confirm) {
                UIService.showModal('error', 'Validation Error', 'Passwords do not match.');
                return;
            }

            if (password.length < 6) {
                UIService.showModal('error', 'Weak Password', 'Password must be at least 6 characters.');
                return;
            }

            setLoading(btn, true, 'Creating Account...');

            const result = await AuthService.register(email, password);

            setLoading(btn, false, 'SIGN UP');

            if (result.success) {
                UIService.showModal(
                    'success',
                    'Verification Sent',
                    `We have sent a verification link to <b>${email}</b>.<br>Please check your inbox before logging in.`,
                    () => switchView('login')
                );
                registerForm.reset();
            } else {
                handleAuthError(result);
            }
        });
    }

    // FORGOT PASSWORD
    const forgotForm = document.getElementById('forgotForm');
    if (forgotForm) {
        forgotForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('forgotEmail').value;
            const btn = forgotForm.querySelector('button[type="submit"]');

            setLoading(btn, true, 'Sending...');

            const result = await AuthService.resetPassword(email);

            setLoading(btn, false, 'SEND EMAIL');

            if (result.success) {
                UIService.showModal('success', 'Email Sent', 'If an account exists, you will receive a reset link shortly.', () => switchView('login'));
                forgotForm.reset();
            } else {
                handleAuthError(result);
            }
        });
    }

    // --- Helpers ---
    function setLoading(btn, isLoading, text) {
        if (isLoading) {
            btn.disabled = true;
            btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> ${text}`;
        } else {
            btn.disabled = false;
            btn.innerText = text;
        }
    }

    function handleRedirect(role) {
        switch (role) {
            case 'admin':
                window.location.href = 'pages/admin-dashboard.html';
                break;
            case 'teller':
                window.location.href = 'pages/teller-dashboard.html';
                break;
            default: // citizen
                window.location.href = 'pages/citizen-dashboard.html';
                break;
        }
    }

    function handleAuthError(result) {
        let msg = "An unexpected error occurred.";

        switch (result.code) {
            case 'auth/email-not-verified':
                msg = result.message;
                break;
            case 'auth/user-not-found':
            case 'auth/wrong-password':
            case 'auth/invalid-credential':
                msg = "Invalid email or password.";
                break;
            case 'auth/email-already-in-use':
                msg = "This email is already registered. Please login.";
                break;
            case 'auth/too-many-requests':
                msg = "Too many failed attempts. Please try again later.";
                break;
            case 'auth/email-not-verified':
                msg = result.message;
                break;
            default:
                msg = result.message || msg;
        }

        UIService.showModal('error', 'Action Failed', msg);
    }
});