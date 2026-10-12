// ===== HES REGISTRAR AVATAR & INITIALS SYNC =====
(function() {
    function getRegistrarInitials(name) {
        if (!name || typeof name !== 'string') return 'JM';
        const cleanName = name.replace(/^(mr\.?|mrs\.?|ms\.?|dr\.?|prof\.?|engr\.?|atty\.?)\s+/i, '').trim();
        const words = cleanName.split(/[\s,&-]+/).filter(w => w.length > 0 && !['and', 'the', 'of', '&'].includes(w.toLowerCase()));
        if (words.length === 0) return 'JM';
        if (words.length === 1) return words[0].substring(0, Math.min(2, words[0].length)).toUpperCase();
        return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
    }

    function syncRegistrarAvatarAndName() {
        try {
            let registrarDisplayName = '';

            // 1. Check active user session
            const currentUserStr = localStorage.getItem('currentUser');
            if (currentUserStr) {
                try {
                    const user = JSON.parse(currentUserStr);
                    if (user) {
                        if (user.displayName) {
                            registrarDisplayName = user.displayName.trim();
                        } else if (user.firstName || user.lastName) {
                            registrarDisplayName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
                        } else if (user.first_name || user.last_name) {
                            registrarDisplayName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
                        }
                    }
                } catch(e) {}
            }

            // 2. Fallback to saved registrar name or default to Justine Mangila
            if (!registrarDisplayName) {
                registrarDisplayName = localStorage.getItem('hes_registrar_name') || 'Justine Mangila';
            }

            const savedAvatar = localStorage.getItem('hes_registrar_avatar');

            // Set full name in all registrar name elements
            document.querySelectorAll('.admin-name, #adminName').forEach(el => {
                el.textContent = registrarDisplayName;
            });

            // Set role explicitly to Registrar
            document.querySelectorAll('.admin-role, #adminRole').forEach(el => {
                el.innerHTML = '<i class="fas fa-id-badge"></i> Registrar';
            });

            const initials = getRegistrarInitials(registrarDisplayName);

            document.querySelectorAll('.admin-avatar').forEach(avatar => {
                if (savedAvatar) {
                    avatar.innerHTML = `
                        <img src="${savedAvatar}" alt="Registrar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">
                        <div class="online-dot"></div>
                    `;
                } else {
                    avatar.innerHTML = `
                        <div class="avatar-initial" id="adminInitial">${initials}</div>
                        <div class="online-dot"></div>
                    `;
                }
            });


            // Update sidebar enrollments links with pending badge if found
            document.querySelectorAll('.nav-items a[href*="enrollments.html"]').forEach(link => {
                let badge = link.querySelector('#pendingEnrollmentsBadge') || link.querySelector('.nav-badge');
                if (!badge) {
                    badge = document.createElement('span');
                    badge.id = 'pendingEnrollmentsBadge';
                    badge.className = 'nav-badge';
                    badge.style.display = 'none';
                    badge.textContent = '0';
                    link.appendChild(badge);
                }
            });

            // Update sidebar requirements links with pending badge if found
            document.querySelectorAll('.nav-items a[href*="requirements.html"]').forEach(link => {
                let badge = link.querySelector('#pendingRequirementsBadge');
                if (!badge) {
                    badge = document.createElement('span');
                    badge.id = 'pendingRequirementsBadge';
                    badge.className = 'nav-badge';
                    badge.style.display = 'none';
                    badge.textContent = '0';
                    link.appendChild(badge);
                }
            });

            // Try to load and render pending badge from localStorage or Supabase
            const cachedPending = localStorage.getItem('hes_pending_enrollments_count');
            if (cachedPending && parseInt(cachedPending, 10) > 0) {
                document.querySelectorAll('#pendingEnrollmentsBadge').forEach(b => {
                    b.textContent = cachedPending;
                    b.style.display = 'inline-flex';
                });
            }

            const cachedReqs = localStorage.getItem('hes_pending_requirements_count');
            if (cachedReqs && parseInt(cachedReqs, 10) > 0) {
                document.querySelectorAll('#pendingRequirementsBadge').forEach(b => {
                    b.textContent = cachedReqs;
                    b.style.display = 'inline-flex';
                });
            }

            if (window.supabase) {
                window.supabase
                    .from('enrollments')
                    .select('*', { count: 'exact', head: true })
                    .or('status.ilike.pending,status.eq.Pending,status.eq.pending')
                    .then(({ count }) => {
                        if (count !== null && count !== undefined) {
                            try { localStorage.setItem('hes_pending_enrollments_count', String(count)); } catch(e) {}
                            document.querySelectorAll('#pendingEnrollmentsBadge, .nav-badge').forEach(b => {
                                if (count > 0) {
                                    b.textContent = count;
                                    b.style.display = 'inline-flex';
                                } else {
                                    b.style.display = 'none';
                                }
                            });
                        }
                    })
                    .catch(() => {});
            }

        } catch(e) {
            console.warn('Registrar avatar sync error:', e);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', syncRegistrarAvatarAndName);
    } else {
        syncRegistrarAvatarAndName();
    }

    window.syncRegistrarAvatarAndName = syncRegistrarAvatarAndName;
})();

