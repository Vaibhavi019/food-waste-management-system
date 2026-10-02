// Mobile nav toggle
document.addEventListener('DOMContentLoaded', () => {
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');

    if (navToggle && navLinks) {
        navToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });

        // Close nav when clicking a link (mobile)
        navLinks.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
            });
        });
    }

    // Auto-dismiss alerts after 5 seconds
    const alerts = document.querySelectorAll('.alert');
    alerts.forEach(alert => {
        setTimeout(() => {
            alert.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            alert.style.opacity = '0';
            alert.style.transform = 'translateY(-10px)';
            setTimeout(() => alert.remove(), 500);
        }, 5000);
    });

    // Set minimum datetime for expiry fields to "now"
    const expiryInput = document.getElementById('expiryTime');
    if (expiryInput) {
        const now = new Date();
        const offset = now.getTimezoneOffset();
        const local = new Date(now.getTime() - offset * 60000);
        expiryInput.min = local.toISOString().slice(0, 16);
    }

    // Theme Toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const iconLight = themeToggle.querySelector('.theme-icon-light');
        const iconDark = themeToggle.querySelector('.theme-icon-dark');
        
        if (currentTheme === 'dark') {
            iconLight.style.display = 'none';
            iconDark.style.display = 'inline';
        }

        themeToggle.addEventListener('click', () => {
            let theme = document.documentElement.getAttribute('data-theme');
            if (theme === 'dark') {
                document.documentElement.removeAttribute('data-theme');
                localStorage.setItem('theme', 'light');
                iconLight.style.display = 'inline';
                iconDark.style.display = 'none';
            } else {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
                iconLight.style.display = 'none';
                iconDark.style.display = 'inline';
            }
        });
    }
});
