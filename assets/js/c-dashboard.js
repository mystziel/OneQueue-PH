// assets/js/c-dashboard.js

// Loading
document.addEventListener("DOMContentLoaded", () => {
    const mainLoader = document.getElementById("mainLoader");
    const mainContent = document.getElementById("mainContent");

    setTimeout(() => {
        hideLoader();
    }, 2000);

    function hideLoader() {
        mainLoader.style.transition = "opacity 0.5s ease";
        mainLoader.style.opacity = "0";

        setTimeout(() => {
            mainLoader.classList.add("d-none");
            mainLoader.classList.remove("d-flex");

            mainContent.classList.remove("d-none");

            mainContent.classList.add("fade-in");
        }, 500);
    }
});