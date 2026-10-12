/**
 * HES Homepage - Interactive JavaScript
 */

(function() {
    'use strict';

    console.log('🏫 HES Homepage ready');

    // ============================================
    // DOM ELEMENTS
    // ============================================

    const loginNavBtn = document.querySelector('.btn-outline-sm');
    const enrollBtn = document.querySelector('.btn-enroll');

    // ============================================
    // LOGIN BUTTON - ALWAYS REDIRECT TO LOGIN PAGE
    // ============================================

    if (loginNavBtn) {
        loginNavBtn.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = 'login.html';
        });
    }

    // ============================================
    // ENROLL NOW BUTTON
    // ============================================

    if (enrollBtn) {
        enrollBtn.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = '../student/enrollment.html';
        });
    }

    // ============================================
    // PAGE NAVIGATION (SPA)
    // ============================================
    
    const pages = {
        home: document.getElementById('page-home'),
        features: document.getElementById('page-features'),
        about: document.getElementById('page-about'),
        contact: document.getElementById('page-contact')
    };

    function navigateTo(pageId) {
        Object.values(pages).forEach(page => {
            if (page) page.classList.remove('active');
        });
        
        const targetPage = pages[pageId];
        if (targetPage) {
            targetPage.classList.add('active');
        }
        
        document.querySelectorAll('.nav-links a[data-page], .footer-col a[data-page]').forEach(link => {
            link.classList.remove('active');
            if (link.dataset.page === pageId) {
                link.classList.add('active');
            }
        });
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    document.querySelectorAll('.nav-links a[data-page], .footer-col a[data-page]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.dataset.page;
            if (page && pages[page]) {
                navigateTo(page);
            }
        });
    });

    // Hash navigation on initial load or URL change
    function handleHashNavigation() {
        const hash = (window.location.hash || '').replace('#', '');
        if (hash && pages[hash]) {
            navigateTo(hash);
        }
    }

    window.addEventListener('hashchange', handleHashNavigation);
    handleHashNavigation();

    // ============================================
    // STATISTICS - Animate on scroll
    // ============================================
    
    function animateStats() {
        const statNumbers = document.querySelectorAll('.stat-number');
        
        statNumbers.forEach(stat => {
            stat.classList.add('animate');
            
            const text = stat.textContent;
            const num = parseInt(text.replace(/[^0-9]/g, ''));
            
            if (!isNaN(num) && num > 0) {
                const suffix = text.replace(/[0-9]/g, '');
                let current = 0;
                const increment = Math.max(1, Math.ceil(num / 25));
                const duration = 800;
                const steps = Math.ceil(num / increment);
                const intervalTime = duration / steps;
                
                const interval = setInterval(() => {
                    current += increment;
                    if (current >= num) {
                        current = num;
                        clearInterval(interval);
                    }
                    stat.textContent = current + suffix;
                }, intervalTime);
            }
        });
    }

    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateStats();
                    observer.disconnect();
                }
            });
        }, { threshold: 0.3 });
        
        const statsWrap = document.querySelector('.about-stats-wrap');
        if (statsWrap) {
            observer.observe(statsWrap);
        }
    } else {
        setTimeout(animateStats, 500);
    }

    // ============================================
    // TOAST NOTIFICATION
    // ============================================
    
    function showToast(message, type = 'info') {
        const existingToasts = document.querySelectorAll('.pls-toast');
        existingToasts.forEach(t => t.remove());
        
        const toast = document.createElement('div');
        toast.className = 'pls-toast';
        const colors = {
            success: '#10b981',
            info: '#0b2b4a',
            warning: '#f59e0b',
            error: '#ef4444'
        };
        toast.style.cssText = `
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: ${colors[type] || colors.info};
            color: white;
            padding: 14px 28px;
            border-radius: 14px;
            font-weight: 500;
            font-size: 0.95rem;
            box-shadow: 0 12px 40px rgba(0,0,0,0.3);
            z-index: 9999;
            animation: slideInToast 0.4s ease;
            max-width: 400px;
            display: flex;
            align-items: center;
            gap: 10px;
            cursor: default;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(40px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    if (!document.getElementById('toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            @keyframes slideInToast {
                from { transform: translateX(60px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    // ============================================
    // CONSOLE WELCOME
    // ============================================
    
    console.log('🎯 HES Features:');
    console.log('  📌 Click "Home", "Features", "About", "Contact" to navigate');
    console.log('  🔐 Login button redirects to login page');
    console.log('  📊 Stats animate when scrolled into view');
    console.log('  🍞 Toast notifications for feedback');
    console.log('✅ Ready na!');

})();