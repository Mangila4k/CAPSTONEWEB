(function () {
    'use strict';

    console.log('🏫 HES Homepage ready');

    const loginNavBtn = document.querySelector('.btn-outline-sm');
    const enrollBtn = document.querySelector('.btn-enroll');


    if (loginNavBtn) {
        loginNavBtn.addEventListener('click', function (e) {
            e.preventDefault();
            window.location.href = 'login.html';
        });
    }

    if (enrollBtn) {
        enrollBtn.addEventListener('click', function (e) {
            e.preventDefault();
            window.location.href = '../student/enrollment.html';
        });
    }


    const pages = {
        home: document.getElementById('page-home'),
        features: document.getElementById('page-features'),
        about: document.getElementById('page-about'),
        contact: document.getElementById('page-contact')
    };

    function switchGradeTab(targetGrade) {
        const pills = document.querySelectorAll('.grade-tab-pill');
        const panes = {
            grade7: document.getElementById('pane-grade7'),
            grade8: document.getElementById('pane-grade8'),
            grade9: document.getElementById('pane-grade9'),
            grade10: document.getElementById('pane-grade10'),
            grade11: document.getElementById('pane-grade11'),
            grade12: document.getElementById('pane-grade12')
        };

        pills.forEach(p => {
            if (p.dataset.gradeTarget === targetGrade) {
                p.classList.add('active');
            } else {
                p.classList.remove('active');
            }
        });

        if (targetGrade === 'all') {
            Object.values(panes).forEach(pane => {
                if (pane) pane.classList.add('active');
            });
        } else {
            Object.entries(panes).forEach(([key, pane]) => {
                if (!pane) return;
                if (key === targetGrade) {
                    pane.classList.add('active');
                } else {
                    pane.classList.remove('active');
                }
            });
        }
    }

    // Tab Pill Click Events
    document.querySelectorAll('.grade-tab-pill').forEach(pill => {
        pill.addEventListener('click', function () {
            const target = this.dataset.gradeTarget;
            switchGradeTab(target);
        });
    });

    function navigateTo(pageId) {
        if (pageId === 'sections' || pageId === 'grade7' || pageId === 'grade8' || pageId === 'grade9' || pageId === 'grade10' || pageId === 'grade11' || pageId === 'grade12') {
            Object.values(pages).forEach(page => {
                if (page) page.classList.remove('active');
            });
            if (pages.home) pages.home.classList.add('active');

            document.querySelectorAll('.nav-links a[data-page], .footer-col a[data-page]').forEach(link => {
                link.classList.remove('active');
                if (link.dataset.page === 'sections' || link.dataset.page === pageId) {
                    link.classList.add('active');
                }
            });

            if (pageId === 'grade12') {
                switchGradeTab('grade12');
            } else if (pageId === 'grade11') {
                switchGradeTab('grade11');
            } else if (pageId === 'grade10') {
                switchGradeTab('grade10');
            } else if (pageId === 'grade9') {
                switchGradeTab('grade9');
            } else if (pageId === 'grade8') {
                switchGradeTab('grade8');
            } else if (pageId === 'grade7') {
                switchGradeTab('grade7');
            }

            const sectionsEl = document.getElementById('sections') || document.getElementById('grade7');
            if (sectionsEl) {
                setTimeout(() => {
                    sectionsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
            }
            return;
        }

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

    const validSpecialPages = ['sections', 'grade7', 'grade8', 'grade9', 'grade10', 'grade11', 'grade12'];

    document.querySelectorAll('.nav-links a[data-page], .footer-col a[data-page]').forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const page = this.dataset.page;
            if (page && (pages[page] || validSpecialPages.includes(page))) {
                navigateTo(page);
            }
        });
    });

    function handleHashNavigation() {
        const hash = (window.location.hash || '').replace('#', '');
        if (hash && (pages[hash] || validSpecialPages.includes(hash))) {
            navigateTo(hash);
        }
    }

    window.addEventListener('hashchange', handleHashNavigation);
    handleHashNavigation();

    // Section Search & Filter for Grade 7 & Grade 8
    document.querySelectorAll('.grade-filter-input').forEach(input => {
        input.addEventListener('input', function () {
            const query = this.value.toLowerCase().trim();
            const tableId = this.dataset.table;
            const rows = document.querySelectorAll(`#${tableId} tr`);
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(query) ? '' : 'none';
            });
        });
    });

    const grade7SearchInput = document.getElementById('grade7SearchInput');
    if (grade7SearchInput) {
        grade7SearchInput.addEventListener('input', function () {
            const query = this.value.toLowerCase().trim();
            const rows = document.querySelectorAll('#grade7TableBody tr');
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(query) ? '' : 'none';
            });
        });
    }


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


    console.log('🎯 HES Features:');
    console.log('  📌 Click "Home", "Features", "About", "Contact" to navigate');
    console.log('  🔐 Login button redirects to login page');
    console.log('  📊 Stats animate when scrolled into view');
    console.log('  🍞 Toast notifications for feedback');
    console.log('✅ Ready na!');

})();