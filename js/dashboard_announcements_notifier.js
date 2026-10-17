import { supabase } from '../supabase/config.js';

(function () {
    'use strict';

    console.log('📢 Dashboard Announcements Notifier loaded');


    let currentUser = null;
    let userRole = 'student';
    let userId = null;
    let allAnnouncements = [];
    let allNotifications = [];
    let dismissedBannerId = null;

    function isAudienceMatch(audience, role) {
        if (!audience) return true;
        const aud = audience.toLowerCase().trim();
        const r = (role || '').toLowerCase().trim();

        if (aud === 'all') return true;
        if (r === 'admin' || r === 'registrar') return true; // School administrators see all notices

        if (r === 'student') return aud === 'students' || aud === 'student' || aud === 'all';
        if (r === 'teacher') return aud === 'teachers' || aud === 'teacher' || aud === 'parent_teacher_meeting' || aud === 'both' || aud === 'all';
        if (r === 'parent') return aud === 'parents' || aud === 'parent' || aud === 'parent_teacher_meeting' || aud === 'both' || aud === 'all';
        if (r === 'guidance') return aud === 'all' || aud === 'guidance';

        return false;
    }

    // Time formatting helper
    function formatTimeAgo(dateString) {
        if (!dateString) return 'Recent';
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHours / 24);

            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
            if (diffDays === 1) return 'Yesterday';
            if (diffDays < 7) return `${diffDays}d ago`;
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } catch (e) {
            return 'Recent';
        }
    }

    // Read tracking helpers
    function getReadAnnouncements() {
        try {
            const raw = localStorage.getItem(`hes_read_announcements_${userId || userRole}`);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function markAnnouncementRead(id) {
        try {
            const list = getReadAnnouncements();
            if (!list.includes(String(id))) {
                list.push(String(id));
                localStorage.setItem(`hes_read_announcements_${userId || userRole}`, JSON.stringify(list));
            }
        } catch (e) { }
    }

    function markAllAnnouncementsRead() {
        try {
            const list = allAnnouncements.map(a => String(a.id));
            localStorage.setItem(`hes_read_announcements_${userId || userRole}`, JSON.stringify(list));
        } catch (e) { }
    }

    // Initialize user session
    function initUser() {
        try {
            const stored = localStorage.getItem('currentUser');
            if (stored) {
                currentUser = JSON.parse(stored);
                userRole = (currentUser.role || 'student').toLowerCase();
                userId = currentUser.id || currentUser.user_id || null;
            }
        } catch (e) { }

        // Fallback detection from URL
        if (!currentUser) {
            const path = window.location.pathname.toLowerCase();
            if (path.includes('/teacher/')) userRole = 'teacher';
            else if (path.includes('/parents/')) userRole = 'parent';
            else if (path.includes('/student/')) userRole = 'student';
            else if (path.includes('/guidance/')) userRole = 'guidance';
            else if (path.includes('/registrar/')) userRole = 'registrar';
            else if (path.includes('/admin/')) userRole = 'admin';
        }

        try {
            dismissedBannerId = sessionStorage.getItem(`hes_dismissed_announcement_${userRole}`);
        } catch (e) { }
    }

    // Ensure Notification Bell exists in header
    function ensureNotificationBell() {
        let wrapper = document.querySelector('.notification-wrapper');
        if (wrapper) return wrapper;

        // Try finding header actions or page header (never inject into greetings/banners)
        let pageHeader = document.querySelector('.page-header, .top-header');
        if (!pageHeader) {
            const mainContent = document.querySelector('main.main-content, main, .main-content');
            if (mainContent) {
                pageHeader = document.createElement('div');
                pageHeader.className = 'page-header dynamic-header';
                pageHeader.innerHTML = `<div></div><div class="header-actions"></div>`;
                mainContent.prepend(pageHeader);
            } else {
                return null;
            }
        }

        let actions = pageHeader.querySelector('.header-actions');
        if (!actions) {
            actions = document.createElement('div');
            actions.className = 'header-actions';
            pageHeader.appendChild(actions);
        }

        wrapper = document.createElement('div');
        wrapper.className = 'notification-wrapper';
        wrapper.innerHTML = `
            <button type="button" class="notification-btn" id="notificationBtn" title="Announcements & Notifications">
                <i class="fas fa-bell"></i>
                <span class="notif-count empty" id="notifCount">0</span>
            </button>
            <div class="notification-dropdown" id="notificationDropdown">
                <div class="dropdown-header">
                    <h4><i class="fas fa-bullhorn" style="color: #facc15;"></i> Announcements & Alerts</h4>
                    <button type="button" id="markAllReadBtn" class="mark-all-read">Mark all as read</button>
                </div>
                <div class="dropdown-body" id="notificationList">
                    <div class="empty-notifications">
                        <i class="fas fa-bell-slash"></i>
                        <p>No new notices yet</p>
                    </div>
                </div>
            </div>
        `;

        actions.prepend(wrapper);
        return wrapper;
    }

    // Ensure Announcement Viewer Modal exists in DOM
    function ensureAnnouncementModal() {
        let modal = document.getElementById('announcementViewerModal');
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = 'announcementViewerModal';
        modal.className = 'announcement-modal-backdrop';
        modal.innerHTML = `
            <div class="announcement-modal-card">
                <div class="announcement-modal-header">
                    <h3><i class="fas fa-bullhorn" style="color: #facc15;"></i> <span id="modalAnnounceHeaderTitle">Official School Notice</span></h3>
                    <button type="button" class="announcement-modal-close" id="closeAnnounceModalBtn" title="Close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="announcement-modal-body">
                    <div class="modal-meta-row">
                        <span class="announcement-badge badge-official" id="modalAnnounceAuthorRole">ADMINISTRATION</span>
                        <span class="announcement-badge" id="modalAnnouncePriority">NORMAL</span>
                        <span style="font-size: 0.82rem; font-weight: 600; color: #475569;" id="modalAnnounceAuthorName">—</span>
                        <span style="font-size: 0.78rem; color: #94a3b8; margin-left: auto;" id="modalAnnounceDate">—</span>
                    </div>

                    <h2 style="font-size: 1.25rem; font-weight: 800; color: #0b2b4a; margin: 0 0 14px 0; line-height: 1.35;" id="modalAnnounceTitle">
                        Notice Title
                    </h2>

                    <div class="modal-content-text" id="modalAnnounceContent">
                        Content text here...
                    </div>

                    <div class="modal-meeting-box" id="modalMeetingBox" style="display: none;">
                        <h5><i class="fas fa-calendar-check" style="color: #2563eb;"></i> Meeting & Session Details</h5>
                        <div class="meeting-info-grid">
                            <div class="meeting-info-item"><i class="fas fa-calendar-day" style="color: #0284c7;"></i> <strong id="modalMeetingDate">—</strong></div>
                            <div class="meeting-info-item"><i class="fas fa-clock" style="color: #0284c7;"></i> <strong id="modalMeetingTime">—</strong></div>
                            <div class="meeting-info-item"><i class="fas fa-map-marker-alt" style="color: #dc2626;"></i> <span id="modalMeetingVenue">—</span></div>
                            <div class="meeting-info-item" id="modalMeetingLinkRow" style="display: none;">
                                <i class="fas fa-video" style="color: #10b981;"></i> 
                                <a href="#" target="_blank" id="modalMeetingLinkBtn" style="color: #2563eb; font-weight: 700; text-decoration: underline;">Join Online Meeting</a>
                            </div>
                        </div>

                        <div id="modalAgendaContainer" style="margin-top: 14px; display: none;">
                            <strong style="font-size: 0.84rem; color: #1e293b;"><i class="fas fa-list-check"></i> Session Agenda:</strong>
                            <ul class="modal-agenda-list" id="modalAgendaList"></ul>
                        </div>
                    </div>
                </div>
                <div class="announcement-modal-footer">
                    <span style="font-size: 0.8rem; color: #64748b;">
                        <i class="fas fa-shield-alt" style="color: #10b981;"></i> Placido L. Señor National High School
                    </span>
                    <button type="button" class="btn-read-announcement" id="closeAnnounceModalBtn2">
                        <i class="fas fa-check"></i> Understood
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close listeners
        modal.querySelectorAll('#closeAnnounceModalBtn, #closeAnnounceModalBtn2').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.classList.remove('active', 'show');
            });
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active', 'show');
        });

        return modal;
    }

    // Open Announcement Viewer Modal
    function openAnnouncementModal(item) {
        const modal = ensureAnnouncementModal();
        if (!modal || !item) return;

        markAnnouncementRead(item.id);

        const headerTitle = document.getElementById('modalAnnounceHeaderTitle');
        const authorRole = document.getElementById('modalAnnounceAuthorRole');
        const authorName = document.getElementById('modalAnnounceAuthorName');
        const priority = document.getElementById('modalAnnouncePriority');
        const dateEl = document.getElementById('modalAnnounceDate');
        const titleEl = document.getElementById('modalAnnounceTitle');
        const contentEl = document.getElementById('modalAnnounceContent');
        const meetingBox = document.getElementById('modalMeetingBox');

        const roleText = (item.author_role || 'ADMIN').toUpperCase();
        if (authorRole) {
            authorRole.textContent = roleText === 'REGISTRAR' ? 'REGISTRAR OFFICE' : 'ADMINISTRATION';
            authorRole.className = roleText === 'REGISTRAR' ? 'announcement-badge badge-registrar' : 'announcement-badge badge-official';
        }

        if (authorName) authorName.textContent = item.author_name || (roleText === 'REGISTRAR' ? 'Registrar Office' : 'School Administration');
        if (headerTitle) headerTitle.textContent = `${roleText === 'REGISTRAR' ? 'Registrar' : 'Admin'} Official Notice`;

        if (priority) {
            const pri = (item.priority || 'normal').toUpperCase();
            priority.textContent = pri;
            if (pri === 'URGENT') priority.className = 'announcement-badge badge-urgent';
            else if (pri === 'IMPORTANT') priority.className = 'announcement-badge';
            else priority.className = 'announcement-badge badge-official';
        }

        if (dateEl) {
            try {
                dateEl.textContent = new Date(item.date_created || item.created_at || Date.now()).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric'
                });
            } catch (e) {
                dateEl.textContent = 'Today';
            }
        }

        if (titleEl) titleEl.textContent = item.title || 'Announcement';
        if (contentEl) contentEl.textContent = item.content || item.message || '';

        // Meeting fields
        const isMeeting = item.category === 'meeting' || (item.meeting_type && item.meeting_type !== 'none');
        if (meetingBox) {
            if (isMeeting) {
                meetingBox.style.display = 'block';
                const mDate = document.getElementById('modalMeetingDate');
                const mTime = document.getElementById('modalMeetingTime');
                const mVenue = document.getElementById('modalMeetingVenue');
                const mLinkRow = document.getElementById('modalMeetingLinkRow');
                const mLinkBtn = document.getElementById('modalMeetingLinkBtn');
                const agendaBox = document.getElementById('modalAgendaContainer');
                const agendaList = document.getElementById('modalAgendaList');

                if (mDate) mDate.textContent = item.meeting_date || 'TBA';
                if (mTime) mTime.textContent = item.meeting_time || 'TBA';
                if (mVenue) mVenue.textContent = item.venue || 'Campus Grounds / Hall';

                if (mLinkRow && mLinkBtn) {
                    if (item.meeting_link) {
                        mLinkRow.style.display = 'flex';
                        mLinkBtn.href = item.meeting_link;
                    } else {
                        mLinkRow.style.display = 'none';
                    }
                }

                if (agendaBox && agendaList) {
                    let agendaItems = Array.isArray(item.agenda) ? item.agenda : [];
                    if (typeof item.agenda === 'string') {
                        try { agendaItems = JSON.parse(item.agenda); } catch (e) { }
                    }
                    if (agendaItems.length > 0) {
                        agendaBox.style.display = 'block';
                        agendaList.innerHTML = agendaItems.map(a => `<li>${a}</li>`).join('');
                    } else {
                        agendaBox.style.display = 'none';
                    }
                }
            } else {
                meetingBox.style.display = 'none';
            }
        }

        modal.classList.add('active', 'show');

        // Refresh badges
        updateBadgeAndDropdown();
    }

    // Display Realtime Toast
    function showToast(announcement) {
        const toast = document.createElement('div');
        toast.className = 'announcement-toast';
        const role = (announcement.author_role || 'ADMIN').toUpperCase();
        toast.innerHTML = `
            <div class="announcement-toast-icon">
                <i class="fas fa-bullhorn"></i>
            </div>
            <div>
                <div class="announcement-toast-title">📢 New ${role} Announcement</div>
                <div class="announcement-toast-msg"><strong>${announcement.title || ''}</strong></div>
            </div>
            <button class="announcement-toast-close" title="Dismiss"><i class="fas fa-times"></i></button>
        `;

        toast.addEventListener('click', (e) => {
            if (e.target.closest('.announcement-toast-close')) {
                toast.remove();
            } else {
                openAnnouncementModal(announcement);
                toast.remove();
            }
        });

        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 7000);
    }

    // Fetch announcements from Supabase + localStorage
    async function fetchAnnouncements() {
        let list = [];

        // 1. Supabase
        try {
            const { data, error } = await supabase
                .from('announcements')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20);

            if (!error && Array.isArray(data)) {
                list = data.map(item => ({
                    id: String(item.id),
                    title: item.title || 'Announcement',
                    content: item.content || item.description || '',
                    category: item.category || 'general',
                    target_audience: item.target_audience || 'all',
                    meeting_type: item.meeting_type || 'none',
                    priority: item.priority || 'normal',
                    date_created: item.created_at || new Date().toISOString(),
                    meeting_date: item.meeting_date || '',
                    meeting_time: item.meeting_time || '',
                    venue: item.venue || '',
                    meeting_link: item.meeting_link || '',
                    author_name: item.author_name || 'Administration',
                    author_role: (item.author_role || 'admin').toLowerCase(),
                    agenda: item.agenda || []
                }));
            }
        } catch (e) {
            console.warn('Supabase announcements query note:', e);
        }

        // 2. LocalStorage fallback
        try {
            const localRaw = localStorage.getItem('hes_announcements');
            if (localRaw) {
                const localList = JSON.parse(localRaw);
                localList.forEach(loc => {
                    if (!list.some(s => String(s.id) === String(loc.id))) {
                        list.push({
                            ...loc,
                            author_role: (loc.author_role || 'admin').toLowerCase()
                        });
                    }
                });
            }
        } catch (e) { }

        // Sort descending
        list.sort((a, b) => new Date(b.date_created || 0) - new Date(a.date_created || 0));

        // Filter for this user
        allAnnouncements = list.filter(item => isAudienceMatch(item.target_audience, userRole));

        // Fetch user personal notifications from Supabase
        try {
            let query = supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(25);
            if (userId) {
                query = query.or(`user_id.eq.${userId},role.eq.${userRole},role.is.null`);
            } else {
                query = query.or(`role.eq.${userRole},role.is.null`);
            }
            const { data: notifData } = await query;
            if (Array.isArray(notifData)) {
                allNotifications = notifData;
            }
        } catch (e) { }

        return allAnnouncements;
    }

    // Render Dashboard Banner Widget
    function renderDashboardBanner() {
        // Find most relevant announcement from Admin or Registrar
        const adminOrRegistrarNotices = allAnnouncements.filter(a => {
            const r = (a.author_role || '').toLowerCase();
            return r === 'admin' || r === 'registrar';
        });

        if (adminOrRegistrarNotices.length === 0) return;

        // Pick top notice that hasn't been explicitly dismissed in session
        const readIds = getReadAnnouncements();
        let targetNotice = adminOrRegistrarNotices.find(a => String(a.id) !== String(dismissedBannerId));

        if (!targetNotice) {
            // If the dismissed one was the only one, don't show
            return;
        }

        // Locate insertion container
        const existingBanner = document.getElementById('dashboardAnnouncementBanner');
        if (existingBanner) existingBanner.remove();

        const alertContainer = document.getElementById('alertContainer');
        const mainContent = document.querySelector('.main-content, main');
        if (!mainContent) return;

        const roleText = targetNotice.author_role === 'registrar' ? 'Registrar' : 'Admin';
        const priorityText = (targetNotice.priority || 'normal').toLowerCase();

        let bannerClass = 'dashboard-announcement-banner';
        if (priorityText === 'urgent') bannerClass += ' priority-urgent';
        else if (priorityText === 'important') bannerClass += ' priority-important';
        if (targetNotice.author_role === 'registrar') bannerClass += ' from-registrar';

        const banner = document.createElement('div');
        banner.id = 'dashboardAnnouncementBanner';
        banner.className = bannerClass;

        const badgeClass = targetNotice.author_role === 'registrar' ? 'badge-registrar' : 'badge-official';

        banner.innerHTML = `
            <div class="announcement-banner-icon">
                <i class="fas fa-bullhorn"></i>
            </div>
            <div class="announcement-banner-content">
                <div class="announcement-banner-meta">
                    <span class="announcement-badge ${badgeClass}"><i class="fas fa-shield-alt"></i> Official Notice from ${roleText}</span>
                    ${priorityText === 'urgent' ? '<span class="announcement-badge badge-urgent"><i class="fas fa-exclamation-circle"></i> Urgent</span>' : ''}
                    <span class="announcement-banner-author"><i class="fas fa-user-tie"></i> ${targetNotice.author_name || roleText}</span>
                    <span class="announcement-banner-date">${formatTimeAgo(targetNotice.date_created)}</span>
                </div>
                <h3 class="announcement-banner-title">${targetNotice.title}</h3>
                <p class="announcement-banner-text">${targetNotice.content}</p>
                <div class="announcement-banner-actions">
                    <button type="button" class="btn-read-announcement" id="btnBannerViewMore">
                        <i class="fas fa-envelope-open-text"></i> View Full Announcement
                    </button>
                    <button type="button" class="btn-dismiss-announcement" id="btnBannerDismiss">
                        <i class="fas fa-times"></i> Dismiss
                    </button>
                </div>
            </div>
        `;

        // Handlers
        banner.querySelector('#btnBannerViewMore').addEventListener('click', () => {
            openAnnouncementModal(targetNotice);
        });

        banner.querySelector('#btnBannerDismiss').addEventListener('click', () => {
            dismissedBannerId = targetNotice.id;
            sessionStorage.setItem(`hes_dismissed_announcement_${userRole}`, String(dismissedBannerId));
            banner.style.opacity = '0';
            banner.style.transform = 'translateY(-10px)';
            setTimeout(() => banner.remove(), 250);
        });

        if (alertContainer && alertContainer.parentNode) {
            alertContainer.parentNode.insertBefore(banner, alertContainer.nextSibling);
        } else {
            const pageHeader = mainContent.querySelector('.page-header, .top-header, .dashboard-greeting');
            if (pageHeader && pageHeader.nextSibling) {
                mainContent.insertBefore(banner, pageHeader.nextSibling);
            } else {
                mainContent.prepend(banner);
            }
        }
    }

    // Update Notification Bell Count & Dropdown List
    function updateBadgeAndDropdown() {
        const notifCount = document.getElementById('notifCount');
        const notifBtn = document.getElementById('notificationBtn');
        const notifList = document.getElementById('notificationList');

        const readIds = getReadAnnouncements();

        // Calculate unread announcements
        const unreadAnnouncements = allAnnouncements.filter(a => !readIds.includes(String(a.id)));
        const unreadPersonal = allNotifications.filter(n => !n.read && !n.is_read);

        const totalUnread = unreadAnnouncements.length + unreadPersonal.length;

        if (notifCount) {
            if (totalUnread > 0) {
                notifCount.textContent = totalUnread > 99 ? '99+' : String(totalUnread);
                notifCount.classList.remove('empty');
                notifCount.style.display = 'flex';
                if (notifBtn) notifBtn.classList.add('has-unread');
            } else {
                notifCount.textContent = '';
                notifCount.classList.add('empty');
                notifCount.style.display = 'none';
                if (notifBtn) notifBtn.classList.remove('has-unread');
            }
        }

        // Render Dropdown List
        if (notifList) {
            if (allAnnouncements.length === 0 && allNotifications.length === 0) {
                notifList.innerHTML = `
                    <div class="empty-notifications">
                        <i class="fas fa-bell-slash"></i>
                        <p>No announcements or notifications</p>
                    </div>
                `;
                return;
            }

            let html = '';

            // 1. Announcements (Admin & Registrar notices prominent)
            allAnnouncements.forEach(item => {
                const isUnread = !readIds.includes(String(item.id));
                const isRegistrar = item.author_role === 'registrar';
                const isUrgent = (item.priority || '').toLowerCase() === 'urgent';

                let iconClass = isRegistrar ? 'registrar-icon' : 'admin-icon';
                if (isUrgent) iconClass = 'urgent-icon';

                let badgeClass = isRegistrar ? 'registrar-badge' : 'admin-badge';
                if (isUrgent) badgeClass = 'urgent-badge';

                const authorBadge = isRegistrar ? 'REGISTRAR' : 'ADMIN';

                html += `
                    <div class="notif-item ${isUnread ? 'unread' : ''}" data-announcement-id="${item.id}">
                        <div class="notif-item-icon ${iconClass}">
                            <i class="fas ${isUrgent ? 'fa-exclamation-triangle' : 'fa-bullhorn'}"></i>
                        </div>
                        <div class="notif-item-content">
                            <div class="notif-item-header">
                                <span class="notif-item-badge ${badgeClass}">${authorBadge}</span>
                                <span class="notif-item-time">${formatTimeAgo(item.date_created)}</span>
                            </div>
                            <div class="notif-item-title">${item.title}</div>
                            <div class="notif-item-snippet">${item.content}</div>
                        </div>
                    </div>
                `;
            });

            // 2. Personal notifications
            allNotifications.forEach(n => {
                html += `
                    <div class="notif-item ${(!n.read && !n.is_read) ? 'unread' : ''}" data-notif-id="${n.id}">
                        <div class="notif-item-icon admin-icon">
                            <i class="fas fa-bell"></i>
                        </div>
                        <div class="notif-item-content">
                            <div class="notif-item-header">
                                <span class="notif-item-badge admin-badge">NOTICE</span>
                                <span class="notif-item-time">${formatTimeAgo(n.created_at)}</span>
                            </div>
                            <div class="notif-item-title">${n.title || 'System Notification'}</div>
                            <div class="notif-item-snippet">${n.message || ''}</div>
                        </div>
                    </div>
                `;
            });

            notifList.innerHTML = html;

            // Click listener for announcement items
            notifList.querySelectorAll('[data-announcement-id]').forEach(el => {
                el.addEventListener('click', () => {
                    const id = el.getAttribute('data-announcement-id');
                    const item = allAnnouncements.find(a => String(a.id) === String(id));
                    if (item) {
                        markAnnouncementRead(item.id);
                        openAnnouncementModal(item);
                        const dropdown = document.getElementById('notificationDropdown');
                        if (dropdown) dropdown.classList.remove('active', 'show');
                        updateBadgeAndDropdown();
                    }
                });
            });

            // Click listener for personal notifications
            notifList.querySelectorAll('[data-notif-id]').forEach(el => {
                el.addEventListener('click', async () => {
                    const id = el.getAttribute('data-notif-id');
                    el.classList.remove('unread');
                    const targetNotif = allNotifications.find(n => String(n.id) === String(id));
                    if (targetNotif) {
                        targetNotif.read = true;
                        targetNotif.is_read = true;
                    }
                    updateBadgeAndDropdown();
                    try {
                        await supabase.from('notifications').update({ read: true, is_read: true }).eq('id', id);
                    } catch (e) { }
                });
            });
        }
    }

    // Bind Dropdown Toggle & Mark All Read
    function setupDropdownInteractions() {
        const notifBtn = document.getElementById('notificationBtn');
        const dropdown = document.getElementById('notificationDropdown');
        const markAllReadBtn = document.getElementById('markAllReadBtn');

        if (notifBtn && dropdown) {
            notifBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropdown.classList.toggle('show');
                dropdown.classList.toggle('active');
            };

            dropdown.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            document.addEventListener('click', (e) => {
                if (!e.target.closest('.notification-wrapper')) {
                    dropdown.classList.remove('show', 'active');
                }
            });
        }

        if (markAllReadBtn) {
            markAllReadBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                markAllAnnouncementsRead();

                // Mark personal notifications read in Supabase
                try {
                    if (userId) {
                        await supabase.from('notifications').update({ read: true, is_read: true }).eq('user_id', userId);
                    }
                } catch (e) { }

                allNotifications.forEach(n => { n.read = true; n.is_read = true; });
                updateBadgeAndDropdown();
            });
        }
    }

    // Realtime Supabase Channel
    function initRealtime() {
        try {
            const channel = supabase.channel('dashboard-announcements-broadcast')
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, payload => {
                    const newNotice = payload.new;
                    if (isAudienceMatch(newNotice.target_audience, userRole)) {
                        showToast(newNotice);
                        fetchAnnouncements().then(() => {
                            renderDashboardBanner();
                            updateBadgeAndDropdown();
                        });
                    }
                })
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => {
                    const newNotif = payload.new;
                    if (!newNotif.user_id || newNotif.user_id === userId || newNotif.role === userRole) {
                        fetchAnnouncements().then(() => {
                            updateBadgeAndDropdown();
                        });
                    }
                })
                .subscribe();
        } catch (e) {
            console.warn('Realtime subscription notice:', e);
        }
    }

    // Main Run function
    async function start() {
        if (window.location.pathname.toLowerCase().includes('/admin/dashboard.html')) {
            return;
        }
        initUser();
        ensureNotificationBell();
        ensureAnnouncementModal();
        setupDropdownInteractions();

        await fetchAnnouncements();
        renderDashboardBanner();
        updateBadgeAndDropdown();

        initRealtime();
    }

    // Expose helpers on window
    window.DashboardAnnouncements = {
        refresh: async () => {
            await fetchAnnouncements();
            renderDashboardBanner();
            updateBadgeAndDropdown();
        },
        viewAnnouncement: (id) => {
            const item = allAnnouncements.find(a => String(a.id) === String(id));
            if (item) openAnnouncementModal(item);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
