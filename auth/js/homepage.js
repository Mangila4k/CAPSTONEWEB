(function () {
    'use strict';

    console.log('🏫 HES Homepage ready');

    // ===== 1. INITIALIZE SUPABASE DIRECTLY =====
    const SUPABASE_URL = 'https://tuujlqrfyuazvbvoribz.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_dYaVB2zNcNNj5gwjzJ4ZRw_N55Djq0D';
    
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // ===== NAVIGATION LOGIC =====
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
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const page = this.dataset.page;
            if (page && pages[page]) {
                navigateTo(page);
            }
        });
    });

    function handleHashNavigation() {
        const hash = (window.location.hash || '').replace('#', '');
        if (hash && pages[hash]) {
            navigateTo(hash);
        }
    }

    window.addEventListener('hashchange', handleHashNavigation);
    handleHashNavigation();

    // ===== STATS ANIMATION =====
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

    // ===== TOAST NOTIFICATION =====
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

    // ===== FETCH AND RENDER ACTIVITIES FROM SUPABASE =====
    async function loadHomeActivities() {
        const container = document.getElementById('homeActivitiesGrid');
        if (!container) return;

        try {
            const { data, error } = await supabase
                .from('activities')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(3);

            if (error) throw error;

            if (!data || data.length === 0) {
                container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #cbd5e1;">
                    <i class="fas fa-camera" style="font-size: 32px; margin-bottom: 10px; opacity: 0.5;"></i>
                    <p style="font-size: 1.1rem; margin: 0;">No school activities posted yet.</p>
                    <p style="font-size: 0.9rem; opacity: 0.7;">Check back soon for exciting updates!</p>
                </div>`;
                return;
            }

            // Render the activity cards
            container.innerHTML = data.map(act => `
                <div class="activity-home-card" style="width: 100%; max-width: 400px; background: rgba(26, 34, 90, 0.85); border-radius: 20px; overflow: hidden; border: 1px solid rgba(191, 219, 254, 0.25); box-shadow: 0 10px 30px rgba(10, 14, 42, 0.3); display: flex; flex-direction: column; transition: transform 0.3s ease, box-shadow 0.3s ease;">
                    
                    <!-- Image Container -->
                    <div style="height: 300px; position: relative; background: #0d112d;">
                        
                        <!-- The Image (contain mode shows the whole picture) -->
                        <img src="${act.image_url}" alt="${act.title}" style="width: 100%; height: 100%; object-fit: contain; transition: transform 0.4s ease;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                        
                        <!-- Top-Right Text Overlay with dark gradient for readability -->
                        <div style="position: absolute; top: 0; right: 0; padding: 1.5rem; background: linear-gradient(to bottom left, rgba(13, 17, 50, 0.85) 0%, rgba(13, 17, 50, 0.2) 60%, transparent 100%); border-bottom-left-radius: 30px; pointer-events: none; z-index: 2;">
                            <h3 style="margin: 0; font-size: 1.8rem; font-weight: 900; color: #ffffff; line-height: 1.1; text-shadow: 0 2px 10px rgba(0,0,0,0.8); letter-spacing: -0.5px;">
                                SportsFest 2026
                            </h3>
                        </div>

                        <!-- Date Badge (Top Left) -->
                        <div style="position: absolute; top: 12px; left: 12px; background: rgba(0,0,0,0.6); color: #fff; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; backdrop-filter: blur(4px); z-index: 2;">
                            <i class="far fa-calendar"></i> ${new Date(act.created_at).toLocaleDateString()}
                        </div>

                    </div>

                </div>
            `).join('');

        } catch (err) {
            console.error('Error loading activities:', err);
            container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #cbd5e1;">
                <i class="fas fa-exclamation-triangle" style="font-size: 32px; margin-bottom: 10px; color: #f59e0b;"></i>
                <p>Unable to load activities at this time. Please try again later.</p>
            </div>`;
        }
    }

    // Load activities immediately
    document.addEventListener('DOMContentLoaded', () => {
        loadHomeActivities();
    });

    console.log('🎯 HES Features:');
    console.log('  📌 Click "Home", "Features", "About", "Contact" to navigate');
    console.log('  🔐 Login button redirects to login page');
    console.log('  📊 Stats animate when scrolled into view');
    console.log('  🖼️ Activities loaded from Supabase');
    console.log('✅ Ready na!');

})();