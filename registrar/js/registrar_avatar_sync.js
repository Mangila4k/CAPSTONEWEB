// ===== HES REGISTRAR AVATAR, INITIALS & SMART NOTIFICATION SYNC =====
(function() {
    'use strict';

    function getRegistrarInitials(name) {
        if (!name || typeof name !== 'string') return 'JM';
        const cleanName = name.replace(/^(mr\.?|mrs\.?|ms\.?|dr\.?|prof\.?|engr\.?|atty\.?)\s+/i, '').trim();
        const words = cleanName.split(/[\s,&-]+/).filter(w => w.length > 0 && !['and', 'the', 'of', '&'].includes(w.toLowerCase()));
        if (words.length === 0) return 'JM';
        if (words.length === 1) return words[0].substring(0, Math.min(2, words[0].length)).toUpperCase();
        return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
    }

    // =========================================================================
    // 1. NOTIFICATION CATEGORY IDENTIFIER & SIDEBAR MATCHER
    // =========================================================================
    function getNotificationCategory(notif) {
        if (!notif) {
            return {
                id: 'general',
                label: 'Notice',
                icon: 'fa-bell',
                sidebarBadgeId: null,
                sidebarName: null,
                targetUrl: null
            };
        }

        const type = String(notif.type || '').toLowerCase();
        const title = String(notif.title || '').toLowerCase();
        const message = String(notif.message || '').toLowerCase();

        // 1. Requirement Notification
        if (
            type.includes('requirement') ||
            type.includes('missing_doc') ||
            type.includes('document') ||
            title.includes('requirement') ||
            title.includes('missing doc') ||
            title.includes('credentials') ||
            title.includes('form 138') ||
            title.includes('psa') ||
            title.includes('good moral') ||
            message.includes('requirement') ||
            message.includes('document')
        ) {
            const studentId = notif.student_id || notif.studentId || notif.user_id;
            return {
                id: 'requirement',
                label: 'Requirements',
                icon: 'fa-clipboard-check',
                sidebarBadgeId: 'pendingRequirementsBadge',
                sidebarName: 'Requirements',
                targetUrl: studentId ? `requirements.html?student_id=${studentId}` : 'requirements.html'
            };
        }

        // 2. Enrollment Notification
        if (
            type.includes('enrollment') ||
            type.includes('enrolled') ||
            type.includes('admission') ||
            title.includes('enrollment') ||
            title.includes('enrolled') ||
            message.includes('enrollment application') ||
            message.includes('enrolled') ||
            notif.enrollment_id ||
            notif.enrollmentId
        ) {
            const enrollId = notif.enrollment_id || notif.enrollmentId;
            return {
                id: 'enrollment',
                label: 'Enrollments',
                icon: 'fa-file-signature',
                sidebarBadgeId: 'pendingEnrollmentsBadge',
                sidebarName: 'Enrollments',
                targetUrl: enrollId ? `view_enrollment.html?id=${enrollId}` : 'enrollments.html'
            };
        }

        // 3. Announcement Notification
        if (type.includes('announcement') || title.includes('announcement')) {
            return {
                id: 'announcement',
                label: 'Announcements',
                icon: 'fa-bullhorn',
                sidebarBadgeId: null,
                sidebarName: 'Announcements',
                targetUrl: 'announcements.html'
            };
        }

        return {
            id: 'general',
            label: 'Notice',
            icon: 'fa-info-circle',
            sidebarBadgeId: null,
            sidebarName: null,
            targetUrl: null
        };
    }

    function renderCategoryTag(category) {
        return `<span class="notif-category-tag tag-${category.id}"><i class="fas ${category.icon}"></i> ${category.label}</span>`;
    }

    // =========================================================================
    // 2. SIDEBAR BADGE MANAGEMENT & "SEEN" DISAPPEAR LOGIC
    // =========================================================================
    const pathname = (window.location.pathname || '').toLowerCase();
    const isRequirementsPage = pathname.includes('requirements.html');
    const isEnrollmentsPage = pathname.includes('enrollments.html') || pathname.includes('view_enrollment.html');

    function updateBadgeElement(badgeId, count, isCurrentSection) {
        document.querySelectorAll(`#${badgeId}`).forEach(badge => {
            const num = parseInt(count, 10) || 0;
            if (isCurrentSection || num <= 0) {
                badge.style.setProperty('display', 'none', 'important');
                badge.classList.add('hidden');
                badge.setAttribute('data-count', '0');
                badge.textContent = '';
            } else {
                badge.textContent = num > 99 ? '99+' : String(num);
                badge.setAttribute('data-count', String(num));
                badge.classList.remove('hidden');
                badge.style.removeProperty('display');
                badge.style.display = 'inline-flex';
            }
        });
    }

    function updateSidebarBadges(enrollmentCount, requirementCount) {
        updateBadgeElement('pendingEnrollmentsBadge', enrollmentCount, isEnrollmentsPage);
        updateBadgeElement('pendingRequirementsBadge', requirementCount, isRequirementsPage);
    }

    async function getSupabase() {
        if (window.supabase) return window.supabase;
        for (let i = 0; i < 20; i++) {
            if (window.supabase) return window.supabase;
            await new Promise(r => setTimeout(r, 100));
        }
        try {
            const mod = await import('../../supabase/config.js');
            if (mod && mod.supabase) {
                window.supabase = mod.supabase;
                return mod.supabase;
            }
        } catch(e) {}
        try {
            const mod = await import('../supabase/config.js');
            if (mod && mod.supabase) {
                window.supabase = mod.supabase;
                return mod.supabase;
            }
        } catch(e) {}
        return null;
    }

    // Mark current section as seen immediately upon page visit
    async function markCurrentPageAsSeen() {
        const now = Date.now();
        if (isRequirementsPage) {
            localStorage.setItem('hes_seen_requirements_at', String(now));
            localStorage.removeItem('hes_pending_requirements_count');
            updateBadgeElement('pendingRequirementsBadge', 0, true);

            // Mark any unread requirement notifications as read in Supabase in background
            const sb = await getSupabase();
            if (sb) {
                sb.from('notifications')
                    .update({ is_read: true, read: true })
                    .or('role.eq.registrar,role.eq.all,role.is.null')
                    .ilike('type', '%requirement%')
                    .then(() => {})
                    .catch(() => {});
            }
        }

        if (isEnrollmentsPage) {
            localStorage.setItem('hes_seen_enrollments_at', String(now));
            localStorage.removeItem('hes_pending_enrollments_count');
            updateBadgeElement('pendingEnrollmentsBadge', 0, true);

            // Mark any unread enrollment notifications as read in Supabase in background
            const sb = await getSupabase();
            if (sb) {
                sb.from('notifications')
                    .update({ is_read: true, read: true })
                    .or('role.eq.registrar,role.eq.all,role.is.null')
                    .ilike('type', '%enrollment%')
                    .then(() => {})
                    .catch(() => {});
            }
        }
    }

    // Sync notification counts from Supabase / localStorage
    async function syncNotificationCounts() {
        // If on Requirements page, requirements badge is always hidden
        if (isRequirementsPage) {
            updateBadgeElement('pendingRequirementsBadge', 0, true);
        }
        // If on Enrollments page, enrollments badge is always hidden
        if (isEnrollmentsPage) {
            updateBadgeElement('pendingEnrollmentsBadge', 0, true);
        }

        const sb = await getSupabase();
        if (!sb) return;

        try {
            const { data, error } = await sb
                .from('notifications')
                .select('*')
                .or('role.eq.registrar,role.eq.all,role.is.null')
                .order('created_at', { ascending: false })
                .limit(40);

            if (error || !data) return;

            const seenReqTime = parseInt(localStorage.getItem('hes_seen_requirements_at') || '0', 10);
            const seenEnrollTime = parseInt(localStorage.getItem('hes_seen_enrollments_at') || '0', 10);

            let unreadEnrollmentCount = 0;
            let unreadRequirementCount = 0;

            data.forEach(notif => {
                const isRead = notif.is_read === true || notif.read === true;
                if (isRead) return;

                const notifTime = notif.created_at ? new Date(notif.created_at).getTime() : 0;
                const cat = getNotificationCategory(notif);

                if (cat.id === 'requirement') {
                    // Only count if newer than when registrar last visited/seen requirements page
                    if (notifTime > seenReqTime) {
                        unreadRequirementCount++;
                    }
                } else if (cat.id === 'enrollment') {
                    // Only count if newer than when registrar last visited/seen enrollments page
                    if (notifTime > seenEnrollTime) {
                        unreadEnrollmentCount++;
                    }
                }
            });

            // Update sidebar badges
            updateSidebarBadges(unreadEnrollmentCount, unreadRequirementCount);

            // Update top bell badge if present
            const totalUnread = data.filter(n => !(n.is_read === true || n.read === true)).length;
            const notifCountEl = document.getElementById('notifCount');
            if (notifCountEl) {
                if (totalUnread > 0) {
                    notifCountEl.textContent = totalUnread > 99 ? '99+' : String(totalUnread);
                    notifCountEl.style.display = 'flex';
                } else {
                    notifCountEl.style.display = 'none';
                }
            }

        } catch (err) {
            console.warn('Sync notification counts notice:', err);
        }
    }

    // =========================================================================
    // 3. REGISTRAR AVATAR & NAME SYNC
    // =========================================================================
    function syncRegistrarAvatarAndName() {
        try {
            let registrarDisplayName = '';

            // Check active user session
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

            // Ensure sidebar badges exist in DOM
            document.querySelectorAll('.nav-items a[href*="enrollments.html"]').forEach(link => {
                let badge = link.querySelector('#pendingEnrollmentsBadge');
                if (!badge) {
                    badge = document.createElement('span');
                    badge.id = 'pendingEnrollmentsBadge';
                    badge.className = 'nav-badge hidden';
                    badge.setAttribute('data-count', '0');
                    badge.style.setProperty('display', 'none', 'important');
                    badge.textContent = '';
                    link.appendChild(badge);
                }
            });

            document.querySelectorAll('.nav-items a[href*="requirements.html"]').forEach(link => {
                let badge = link.querySelector('#pendingRequirementsBadge');
                if (!badge) {
                    badge = document.createElement('span');
                    badge.id = 'pendingRequirementsBadge';
                    badge.className = 'nav-badge hidden';
                    badge.setAttribute('data-count', '0');
                    badge.style.setProperty('display', 'none', 'important');
                    badge.textContent = '';
                    link.appendChild(badge);
                }
            });

            // Apply immediate page-seen rules
            markCurrentPageAsSeen();

            // Run notification sync
            syncNotificationCounts();

        } catch(e) {
            console.warn('Registrar avatar sync error:', e);
        }
    }

    // =========================================================================
    // 4. COMMON NOTIFICATION BELL & DROPDOWN HELPER
    // =========================================================================
    function initNotificationDropdownUI() {
        const notificationBtn = document.getElementById('notificationBtn');
        const notificationDropdown = document.getElementById('notificationDropdown');
        const markAllReadBtn = document.getElementById('markAllReadBtn');
        const notificationList = document.getElementById('notificationList');
        const notifCount = document.getElementById('notifCount');

        if (!notificationBtn || !notificationDropdown) return;

        // Toggle dropdown
        notificationBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            notificationDropdown.classList.toggle('show');
            if (notificationDropdown.classList.contains('show')) {
                loadAndRenderNotifications();
            }
        });

        // Click outside closes dropdown
        document.addEventListener('click', function(e) {
            if (!notificationDropdown.contains(e.target) && !notificationBtn.contains(e.target)) {
                notificationDropdown.classList.remove('show');
            }
        });

        // Mark all as read
        if (markAllReadBtn) {
            markAllReadBtn.addEventListener('click', async function(e) {
                e.stopPropagation();
                try {
                    const sb = await getSupabase();
                    if (sb) {
                        await sb
                            .from('notifications')
                            .update({ is_read: true, read: true })
                            .or('role.eq.registrar,role.eq.all,role.is.null');
                    }

                    // Reset seen timestamps
                    const now = Date.now();
                    localStorage.setItem('hes_seen_requirements_at', String(now));
                    localStorage.setItem('hes_seen_enrollments_at', String(now));
                    localStorage.removeItem('hes_pending_requirements_count');
                    localStorage.removeItem('hes_pending_enrollments_count');

                    // Immediately hide both badges and bell count
                    updateBadgeElement('pendingEnrollmentsBadge', 0, true);
                    updateBadgeElement('pendingRequirementsBadge', 0, true);
                    if (notifCount) notifCount.style.display = 'none';

                    // Re-render dropdown items as read
                    if (notificationList) {
                        notificationList.querySelectorAll('.notif-item').forEach(el => {
                            el.classList.remove('unread');
                            el.classList.add('read');
                            const readBtn = el.querySelector('.mark-read-btn');
                            if (readBtn) readBtn.remove();
                        });
                    }

                    // Broadcast cross-tab update
                    localStorage.setItem('hes_notif_refresh_trigger', String(now));

                } catch (err) {
                    console.error('Error marking all as read:', err);
                }
            });
        }

        async function loadAndRenderNotifications() {
            if (!notificationList) return;
            const sb = await getSupabase();
            if (!sb) return;

            try {
                const { data, error } = await sb
                    .from('notifications')
                    .select('*')
                    .or('role.eq.registrar,role.eq.all,role.is.null')
                    .order('created_at', { ascending: false })
                    .limit(30);

                if (error || !data || data.length === 0) {
                    notificationList.innerHTML = `
                        <div class="empty-notifications">
                            <i class="fas fa-bell-slash"></i>
                            <p>No notifications yet</p>
                        </div>
                    `;
                    return;
                }

                notificationList.innerHTML = data.map(notif => {
                    const isRead = notif.is_read === true || notif.read === true;
                    const cat = getNotificationCategory(notif);
                    const notifId = notif.id;
                    const title = notif.title || 'New Notification';
                    const message = notif.message || '';
                    const timeAgo = formatTimeAgo(notif.created_at);

                    return `
                        <div class="notif-item ${isRead ? 'read' : 'unread'}" data-id="${notifId}" data-category="${cat.id}">
                            <div class="notif-icon notif-${cat.id}">
                                <i class="fas ${cat.icon}"></i>
                            </div>
                            <div class="notif-content">
                                <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 3px;">
                                    ${renderCategoryTag(cat)}
                                    <span class="notif-time"><i class="far fa-clock"></i> ${timeAgo}</span>
                                </div>
                                <div class="notif-title">${title}</div>
                                <div class="notif-message">${message}</div>
                                ${cat.targetUrl ? `
                                    <div style="margin-top: 5px;">
                                        <a href="${cat.targetUrl}" class="notif-view-student-btn" style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; color: #1B2A4A; background: #e0e7ff; padding: 2px 8px; border-radius: 6px; text-decoration: none;">
                                            <i class="fas fa-arrow-right"></i> Open ${cat.label}
                                        </a>
                                    </div>
                                ` : ''}
                            </div>
                            ${!isRead ? `
                                <button type="button" class="mark-read-btn" data-id="${notifId}" title="Mark as read & clear alert">
                                    <i class="fas fa-check"></i>
                                </button>
                            ` : ''}
                        </div>
                    `;
                }).join('');

                // Single mark as read click
                notificationList.querySelectorAll('.mark-read-btn').forEach(btn => {
                    btn.addEventListener('click', async function(e) {
                        e.stopPropagation();
                        const id = this.dataset.id;
                        const itemEl = this.closest('.notif-item');
                        const catId = itemEl?.dataset.category;
                        const client = await getSupabase();

                        try {
                            if (client) {
                                await client
                                    .from('notifications')
                                    .update({ is_read: true, read: true })
                                    .eq('id', id);
                            }

                            if (itemEl) {
                                itemEl.classList.remove('unread');
                                itemEl.classList.add('read');
                            }
                            this.remove();

                            // "If you see that it is their notification then the red number should disappear"
                            if (catId === 'requirement') {
                                localStorage.setItem('hes_seen_requirements_at', String(Date.now()));
                                updateBadgeElement('pendingRequirementsBadge', 0, false);
                            } else if (catId === 'enrollment') {
                                localStorage.setItem('hes_seen_enrollments_at', String(Date.now()));
                                updateBadgeElement('pendingEnrollmentsBadge', 0, false);
                            }

                            // Update bell unread count
                            const remainingUnread = notificationList.querySelectorAll('.notif-item.unread').length;
                            if (notifCount) {
                                if (remainingUnread > 0) {
                                    notifCount.textContent = remainingUnread > 99 ? '99+' : String(remainingUnread);
                                    notifCount.style.display = 'flex';
                                } else {
                                    notifCount.style.display = 'none';
                                }
                            }

                            localStorage.setItem('hes_notif_refresh_trigger', String(Date.now()));

                        } catch (err) {
                            console.error('Error marking notification as read:', err);
                        }
                    });
                });

                // Clicking the notification row redirects directly to where the notification points
                notificationList.querySelectorAll('.notif-item').forEach(item => {
                    item.addEventListener('click', async function(e) {
                        if (e.target.closest('.mark-read-btn')) return;
                        const id = this.dataset.id;
                        const catId = this.dataset.category;
                        const client = await getSupabase();

                        try {
                            if (client && this.classList.contains('unread')) {
                                await client
                                    .from('notifications')
                                    .update({ is_read: true, read: true })
                                    .eq('id', id);
                            }

                            // "If you see that it is their notification then the red number should disappear"
                            if (catId === 'requirement') {
                                localStorage.setItem('hes_seen_requirements_at', String(Date.now()));
                                updateBadgeElement('pendingRequirementsBadge', 0, false);
                                const viewBtn = this.querySelector('.notif-view-student-btn');
                                window.location.href = viewBtn?.getAttribute('href') || 'requirements.html';
                            } else if (catId === 'enrollment') {
                                localStorage.setItem('hes_seen_enrollments_at', String(Date.now()));
                                updateBadgeElement('pendingEnrollmentsBadge', 0, false);
                                const viewBtn = this.querySelector('.notif-view-student-btn');
                                window.location.href = viewBtn?.getAttribute('href') || 'enrollments.html';
                            }
                        } catch(err) {
                            console.error('Error clicking notification:', err);
                        }
                    });
                });

            } catch (err) {
                console.error('Error loading notifications:', err);
            }
        }
    }

    function formatTimeAgo(dateStr) {
        if (!dateStr) return 'Just now';
        try {
            const date = new Date(dateStr);
            const now = new Date();
            const diffMs = now - date;
            const diffSec = Math.floor(diffMs / 1000);
            const diffMin = Math.floor(diffSec / 60);
            const diffHour = Math.floor(diffMin / 60);
            const diffDay = Math.floor(diffHour / 24);

            if (diffMin < 1) return 'Just now';
            if (diffMin < 60) return `${diffMin}m ago`;
            if (diffHour < 24) return `${diffHour}h ago`;
            if (diffDay === 1) return 'Yesterday';
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } catch(e) {
            return 'Recently';
        }
    }

    // =========================================================================
    // 5. LIFECYCLE & CROSS-TAB SYNC
    // =========================================================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            syncRegistrarAvatarAndName();
            initNotificationDropdownUI();
        });
    } else {
        syncRegistrarAvatarAndName();
        initNotificationDropdownUI();
    }

    // Listen for cross-tab notification updates
    window.addEventListener('storage', function(e) {
        if (!e.key) return;
        if (
            e.key.includes('hes_seen_requirements') ||
            e.key.includes('hes_seen_enrollments') ||
            e.key.includes('hes_notif_refresh_trigger') ||
            e.key.includes('hes_pending_requirements_count') ||
            e.key.includes('hes_pending_enrollments_count')
        ) {
            syncNotificationCounts();
        }
    });

    // Expose global interface for other scripts
    window.RegistrarNotificationSync = {
        getNotificationCategory,
        renderCategoryTag,
        updateSidebarBadges,
        markCurrentPageAsSeen,
        syncNotificationCounts,
        initNotificationDropdownUI
    };

    window.syncRegistrarAvatarAndName = syncRegistrarAvatarAndName;

})();
