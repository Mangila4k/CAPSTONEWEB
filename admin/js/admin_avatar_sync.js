// ===== HES ADMIN AVATAR & INITIALS SYNC =====
(function() {
    function getAdminInitials(name) {
        if (!name || typeof name !== 'string') return 'A';
        const cleanName = name.replace(/^(mr\.?|mrs\.?|ms\.?|dr\.?|prof\.?|engr\.?|atty\.?)\s+/i, '').trim();
        const words = cleanName.split(/[\s,&-]+/).filter(w => w.length > 0 && !['and', 'the', 'of', '&'].includes(w.toLowerCase()));
        if (words.length === 0) return 'A';
        if (words.length === 1) return words[0].substring(0, Math.min(2, words[0].length)).toUpperCase();
        return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
    }

    function syncAdminAvatarAndName() {
        try {
            let adminDisplayName = '';
            
            // 1. Check active user session first
            const currentUserStr = localStorage.getItem('currentUser');
            if (currentUserStr) {
                try {
                    const user = JSON.parse(currentUserStr);
                    if (user) {
                        if (user.firstName || user.lastName) {
                            adminDisplayName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
                        } else if (user.first_name || user.last_name) {
                            adminDisplayName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
                        } else if (user.displayName) {
                            adminDisplayName = user.displayName.trim();
                        } else if (user.email) {
                            adminDisplayName = user.email.split('@')[0];
                        }
                    }
                } catch(e) {}
            }

            // 2. Check saved admin name if not set
            if (!adminDisplayName) {
                adminDisplayName = localStorage.getItem('hes_admin_name') || 'Admin';
            }

            const savedAvatar = localStorage.getItem('hes_admin_avatar');

            document.querySelectorAll('.admin-name').forEach(el => {
                el.textContent = adminDisplayName;
            });

            const initials = getAdminInitials(adminDisplayName);

            document.querySelectorAll('.admin-avatar').forEach(avatar => {
                if (savedAvatar) {
                    avatar.innerHTML = `
                        <img src="${savedAvatar}" alt="Admin" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">
                        <div class="online-dot"></div>
                    `;
                } else {
                    avatar.innerHTML = `
                        <div class="avatar-initial" id="adminAvatar">${initials}</div>
                        <div class="online-dot"></div>
                    `;
                }
            });
        } catch(e) {
            console.warn('Admin avatar sync error:', e);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', syncAdminAvatarAndName);
    } else {
        syncAdminAvatarAndName();
    }

    // Expose for immediate re-sync
    window.syncAdminAvatarAndName = syncAdminAvatarAndName;

    // ===== SIDEBAR SCROLL PRESERVATION (ZERO-FLICKER) =====
    (function initSidebarScrollPreservation() {
        if (window.HESSidebarScrollInitialized) return;
        window.HESSidebarScrollInitialized = true;

        const STORAGE_KEY = 'hes_sidebar_scroll_admin';

        function restoreScroll() {
            const navMenu = document.querySelector('.sidebar .nav-menu') || document.querySelector('.nav-menu');
            if (!navMenu) return;

            const savedPos = sessionStorage.getItem(STORAGE_KEY);
            if (savedPos !== null) {
                const pos = parseInt(savedPos, 10);
                if (!isNaN(pos) && pos >= 0) {
                    navMenu.style.scrollBehavior = 'auto';
                    navMenu.scrollTop = pos;
                }
            }

            let debounceTimer;
            navMenu.addEventListener('scroll', function () {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    sessionStorage.setItem(STORAGE_KEY, navMenu.scrollTop);
                }, 60);
            }, { passive: true });

            // Ensure every link is 100% clickable and remembers scroll position
            navMenu.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', function () {
                    sessionStorage.setItem(STORAGE_KEY, navMenu.scrollTop);
                }, { passive: true });
            });


        }

        // Run immediately if .nav-menu is already in DOM to set scrollTop before paint
        restoreScroll();

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', restoreScroll, { once: true });
        }

        window.addEventListener('pageshow', restoreScroll, { once: true });
    })();
})();

