// assets/js/c-dashboard.js
import { UIService } from './ui-service.js';
import {AuthService} from "./auth";

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
});