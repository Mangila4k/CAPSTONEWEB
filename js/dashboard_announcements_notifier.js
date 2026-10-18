import { supabase } from '../supabase/config.js';

(function () {
    'use strict';

    console.log('📢 Dashboard Announcements Notifier loaded');


    let currentUser = null;
    let userRole = 'student';
    let userId = null;
    let userValidIds = new Set();
    let userGradeLevel = '';
    let userSectionName = '';
    let userSectionId = '';
    let allAnnouncements = [];
    let allNotifications = [];
    let currentNotifFilter = 'all';
    let currentViewingItem = null;

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

    // Storage keys helper for general announcements (supporting user ID, user email, and role)
    function getStorageKeys(prefix) {
        const keys = [];
        if (userId) keys.push(`${prefix}_${userId}`);
        if (currentUser && currentUser.email) keys.push(`${prefix}_${currentUser.email.toLowerCase()}`);
        if (userRole) keys.push(`${prefix}_${userRole}`);
        keys.push(`${prefix}_default`);
        return keys;
    }

    // Storage keys helper for personal notifications (strictly user-specific, never shared by role)
    function getPersonalStorageKeys(prefix) {
        const keys = [];
        if (userId) keys.push(`${prefix}_${userId}`);
        userValidIds.forEach(id => {
            if (id && id !== userId) keys.push(`${prefix}_${id}`);
        });
        if (currentUser && currentUser.email) keys.push(`${prefix}_${currentUser.email.toLowerCase()}`);
        return keys;
    }

    // Clean up any stale global/role-level personal notification keys
    try {
        localStorage.removeItem('hes_read_personal_notifications_student');
        localStorage.removeItem('hes_read_personal_notifications_default');
        localStorage.removeItem('hes_unread_personal_notifications_student');
        localStorage.removeItem('hes_unread_personal_notifications_default');
    } catch (e) { }

    // Read tracking helpers
    function getReadAnnouncements() {
        const set = new Set();
        try {
            const keys = getStorageKeys('hes_read_announcements');
            keys.forEach(k => {
                const raw = localStorage.getItem(k);
                if (raw) {
                    try {
                        const parsed = JSON.parse(raw);
                        if (Array.isArray(parsed)) parsed.forEach(id => set.add(String(id)));
                    } catch (e) { }
                }
            });
        } catch (e) { }
        return Array.from(set);
    }

    function markAnnouncementRead(id) {
        if (!id) return;
        const idStr = String(id);
        try {
            const list = getReadAnnouncements();
            if (!list.includes(idStr)) list.push(idStr);
            const keys = getStorageKeys('hes_read_announcements');
            keys.forEach(k => {
                localStorage.setItem(k, JSON.stringify(list));
            });
        } catch (e) { }
    }

    function markAnnouncementUnread(id) {
        if (!id) return;
        const idStr = String(id);
        try {
            const list = getReadAnnouncements().filter(x => x !== idStr);
            const keys = getStorageKeys('hes_read_announcements');
            keys.forEach(k => {
                localStorage.setItem(k, JSON.stringify(list));
            });
            // Remove from dismissed list so user can see banner / unread alert again
            const dismissed = getDismissedAnnouncements().filter(x => x !== idStr);
            const dKeys = getStorageKeys('hes_dismissed_announcements');
            dKeys.forEach(k => {
                localStorage.setItem(k, JSON.stringify(dismissed));
            });
        } catch (e) { }
    }

    // Personal notifications read tracking (strictly per-user in localStorage across sessions!)
    function getReadPersonalNotifications() {
        const set = new Set();
        try {
            const keys = getPersonalStorageKeys('hes_read_personal_notifications');
            keys.forEach(k => {
                const raw = localStorage.getItem(k);
                if (raw) {
                    try {
                        const parsed = JSON.parse(raw);
                        if (Array.isArray(parsed)) parsed.forEach(id => set.add(String(id)));
                    } catch (e) { }
                }
            });
        } catch (e) { }
        return Array.from(set);
    }

    function getUnreadPersonalNotifications() {
        const set = new Set();
        try {
            const keys = getPersonalStorageKeys('hes_unread_personal_notifications');
            keys.forEach(k => {
                const raw = localStorage.getItem(k);
                if (raw) {
                    try {
                        const parsed = JSON.parse(raw);
                        if (Array.isArray(parsed)) parsed.forEach(id => set.add(String(id)));
                    } catch (e) { }
                }
            });
        } catch (e) { }
        return Array.from(set);
    }

    function markPersonalNotificationRead(id) {
        if (!id) return;
        const idStr = String(id);
        try {
            const readList = getReadPersonalNotifications();
            if (!readList.includes(idStr)) readList.push(idStr);
            const rKeys = getPersonalStorageKeys('hes_read_personal_notifications');
            rKeys.forEach(k => localStorage.setItem(k, JSON.stringify(readList)));

            const unreadList = getUnreadPersonalNotifications().filter(x => x !== idStr);
            const uKeys = getPersonalStorageKeys('hes_unread_personal_notifications');
            uKeys.forEach(k => localStorage.setItem(k, JSON.stringify(unreadList)));
        } catch (e) { }
    }

    function markPersonalNotificationUnread(id) {
        if (!id) return;
        const idStr = String(id);
        try {
            const readList = getReadPersonalNotifications().filter(x => x !== idStr);
            const rKeys = getPersonalStorageKeys('hes_read_personal_notifications');
            rKeys.forEach(k => localStorage.setItem(k, JSON.stringify(readList)));

            const unreadList = getUnreadPersonalNotifications();
            if (!unreadList.includes(idStr)) unreadList.push(idStr);
            const uKeys = getPersonalStorageKeys('hes_unread_personal_notifications');
            uKeys.forEach(k => localStorage.setItem(k, JSON.stringify(unreadList)));
        } catch (e) { }
    }

    async function togglePersonalNotificationRead(id, newStatus) {
        if (!id) return;
        const idStr = String(id);
        const targetNotif = allNotifications.find(n => String(n.id) === idStr);
        if (targetNotif) {
            targetNotif.read = Boolean(newStatus);
            targetNotif.is_read = Boolean(newStatus);
        }

        if (newStatus) {
            markPersonalNotificationRead(idStr);
        } else {
            markPersonalNotificationUnread(idStr);
        }

        updateBadgeAndDropdown();

        try {
            await supabase.from('notifications').update({ read: Boolean(newStatus), is_read: Boolean(newStatus) }).eq('id', id);
        } catch (e) {
            console.warn('Personal notif Supabase update notice:', e);
        }
    }

    function markAllAnnouncementsRead() {
        try {
            const list = getReadAnnouncements();
            allAnnouncements.forEach(a => {
                const idStr = String(a.id);
                if (!list.includes(idStr)) list.push(idStr);
            });
            const keys = getStorageKeys('hes_read_announcements');
            keys.forEach(k => {
                localStorage.setItem(k, JSON.stringify(list));
            });
        } catch (e) { }
    }

    // Dismissed tracking helpers (persisted in localStorage across sessions!)
    function getDismissedAnnouncements() {
        const set = new Set();
        try {
            const keys = getStorageKeys('hes_dismissed_announcements');
            keys.forEach(k => {
                const raw = localStorage.getItem(k);
                if (raw) {
                    try {
                        const parsed = JSON.parse(raw);
                        if (Array.isArray(parsed)) parsed.forEach(id => set.add(String(id)));
                    } catch (e) { }
                }
            });
            // Legacy single ID from sessionStorage
            const legacySession = sessionStorage.getItem(`hes_dismissed_announcement_${userRole}`);
            if (legacySession) set.add(String(legacySession));
        } catch (e) { }
        return Array.from(set);
    }

    function markAnnouncementDismissed(id) {
        if (!id) return;
        const idStr = String(id);
        try {
            const list = getDismissedAnnouncements();
            if (!list.includes(idStr)) list.push(idStr);
            const keys = getStorageKeys('hes_dismissed_announcements');
            keys.forEach(k => {
                localStorage.setItem(k, JSON.stringify(list));
            });
            // Also maintain legacy sessionStorage for any legacy readers
            sessionStorage.setItem(`hes_dismissed_announcement_${userRole}`, idStr);
        } catch (e) { }
    }

    // Banner dismissal timestamp tracking
    function getBannerDismissedTimestamp() {
        try {
            const keys = getStorageKeys('hes_banner_dismissed_at');
            for (const k of keys) {
                const val = localStorage.getItem(k);
                if (val) return Number(val);
            }
        } catch (e) { }
        return 0;
    }

    function setBannerDismissedTimestamp(ts = Date.now()) {
        try {
            const keys = getStorageKeys('hes_banner_dismissed_at');
            keys.forEach(k => {
                localStorage.setItem(k, String(ts));
            });
        } catch (e) { }
    }

    // Dismiss banner element smoothly with transition
    function dismissBannerElement() {
        const banner = document.getElementById('dashboardAnnouncementBanner');
        if (banner) {
            banner.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
            banner.style.opacity = '0';
            banner.style.transform = 'translateY(-10px)';
            setTimeout(() => {
                if (banner && banner.parentNode) banner.remove();
            }, 250);
        }
    }

    // Initialize user session
    function initUser() {
        userValidIds.clear();
        try {
            const stored = localStorage.getItem('currentUser');
            if (stored) {
                currentUser = JSON.parse(stored);
                userRole = (currentUser.role || 'student').toLowerCase();
                userId = currentUser.id || currentUser.uid || currentUser.user_id || currentUser.student_id || currentUser.lrn || null;

                [currentUser.id, currentUser.uid, currentUser.user_id, currentUser.student_id, currentUser.studentTableId, currentUser.lrn].forEach(val => {
                    if (val && typeof val === 'string' && val.trim()) userValidIds.add(val.trim());
                });

                userGradeLevel = currentUser.grade_level || currentUser.grade || '';
                userSectionName = currentUser.section || '';
                userSectionId = currentUser.section_id || '';
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
    }

    // Ensure Notification Bell exists in header
    function ensureNotificationBell() {
        let wrapper = document.querySelector('.notification-wrapper');
        if (wrapper) {
            // Ensure dropdown filter bar exists in already-rendered dropdown
            const dropdown = wrapper.querySelector('.notification-dropdown');
            if (dropdown && !dropdown.querySelector('.dropdown-filter-bar')) {
                const header = dropdown.querySelector('.dropdown-header');
                const filterBar = document.createElement('div');
                filterBar.className = 'dropdown-filter-bar';
                filterBar.id = 'notifFilterBar';
                filterBar.innerHTML = `
                    <button type="button" class="notif-filter-tab active" data-filter="all">
                        <span>All</span> <span class="notif-filter-count" id="notifCountAll">0</span>
                    </button>
                    <button type="button" class="notif-filter-tab" data-filter="unread">
                        <span>Unread</span> <span class="notif-filter-count" id="notifCountUnread">0</span>
                    </button>
                `;
                if (header && header.nextSibling) {
                    dropdown.insertBefore(filterBar, header.nextSibling);
                } else if (header) {
                    dropdown.appendChild(filterBar);
                }
            }
            return wrapper;
        }

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
                    <button type="button" id="markAllReadBtn" class="mark-all-read" title="Mark all as read">
                        <i class="fas fa-check-double"></i> Mark all read
                    </button>
                </div>
                <div class="dropdown-filter-bar" id="notifFilterBar">
                    <button type="button" class="notif-filter-tab active" data-filter="all">
                        <span>All</span> <span class="notif-filter-count" id="notifCountAll">0</span>
                    </button>
                    <button type="button" class="notif-filter-tab" data-filter="unread">
                        <span>Unread</span> <span class="notif-filter-count" id="notifCountUnread">0</span>
                    </button>
                </div>
                <div class="dropdown-body" id="notificationList">
                    <div class="empty-notifications">
                        <i class="fas fa-bell-slash"></i>
                        <p>No new notices yet</p>
                    </div>
                </div>
            </div>
        `;

        const dateBadge = actions.querySelector('.date-badge');
        if (dateBadge) {
            actions.insertBefore(wrapper, dateBadge);
        } else {
            actions.appendChild(wrapper);
        }
        return wrapper;
    }

    // Ensure Announcement & Notification Detail Modal exists in DOM
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
                        <span class="notif-status-badge read" id="modalAnnounceStatusBadge"><i class="fas fa-check-circle"></i> Read</span>
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

                    <div id="modalActionContainer" style="display: none; margin-top: 16px; padding: 14px 18px; background: #eff6ff; border-radius: 12px; border: 1px solid #bfdbfe; align-items: center; justify-content: space-between; gap: 14px;">
                        <div>
                            <strong style="font-size: 0.86rem; color: #1e40af; display: flex; align-items: center; gap: 6px;"><i class="fas fa-arrow-up-right-from-square"></i> Related Portal Action</strong>
                            <span style="font-size: 0.78rem; color: #3b82f6;" id="modalActionHint">Click to view student record or portal item.</span>
                        </div>
                        <a href="#" class="btn-modal-action-link" id="modalActionBtn">
                            <span id="modalActionBtnText">View Details</span> <i class="fas fa-arrow-right"></i>
                        </a>
                    </div>
                </div>
                <div class="announcement-modal-footer">
                    <span style="font-size: 0.8rem; color: #64748b;">
                        <i class="fas fa-shield-alt" style="color: #10b981;"></i> Placido L. Señor National High School
                    </span>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <button type="button" class="btn-toggle-read-status" id="modalToggleReadBtn" title="Toggle read or return to unread">
                            <i class="fas fa-envelope"></i> <span id="modalToggleReadBtnText">Mark as Unread</span>
                        </button>
                        <button type="button" class="btn-read-announcement" id="closeAnnounceModalBtn2">
                            <i class="fas fa-check"></i> Close
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Toggle Read / Unread Status button in modal
        const toggleReadBtn = modal.querySelector('#modalToggleReadBtn');
        if (toggleReadBtn) {
            toggleReadBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!currentViewingItem) return;
                const { item, isPersonalNotif } = currentViewingItem;
                const statusBadge = document.getElementById('modalAnnounceStatusBadge');
                const toggleReadBtnText = document.getElementById('modalToggleReadBtnText');

                if (isPersonalNotif) {
                    const isCurrentlyRead = Boolean(item.read || item.is_read);
                    const newStatus = !isCurrentlyRead;
                    await togglePersonalNotificationRead(item.id, newStatus);
                    if (newStatus) {
                        if (statusBadge) {
                            statusBadge.className = 'notif-status-badge read';
                            statusBadge.innerHTML = `<i class="fas fa-check-circle"></i> Read`;
                        }
                        toggleReadBtn.innerHTML = `<i class="fas fa-envelope"></i> <span id="modalToggleReadBtnText">Mark as Unread</span>`;
                    } else {
                        if (statusBadge) {
                            statusBadge.className = 'notif-status-badge unread';
                            statusBadge.innerHTML = `<i class="fas fa-bell"></i> Unread`;
                        }
                        toggleReadBtn.innerHTML = `<i class="fas fa-check"></i> <span id="modalToggleReadBtnText">Mark as Read</span>`;
                    }
                } else {
                    const readIds = getReadAnnouncements();
                    const isCurrentlyRead = readIds.includes(String(item.id));
                    if (isCurrentlyRead) {
                        markAnnouncementUnread(item.id);
                        if (statusBadge) {
                            statusBadge.className = 'notif-status-badge unread';
                            statusBadge.innerHTML = `<i class="fas fa-bell"></i> Unread`;
                        }
                        toggleReadBtn.innerHTML = `<i class="fas fa-check"></i> <span id="modalToggleReadBtnText">Mark as Read</span>`;
                    } else {
                        markAnnouncementRead(item.id);
                        if (statusBadge) {
                            statusBadge.className = 'notif-status-badge read';
                            statusBadge.innerHTML = `<i class="fas fa-check-circle"></i> Read`;
                        }
                        toggleReadBtn.innerHTML = `<i class="fas fa-envelope"></i> <span id="modalToggleReadBtnText">Mark as Unread</span>`;
                    }
                    updateBadgeAndDropdown();
                }
            });
        }

        // Close listeners
        modal.querySelectorAll('#closeAnnounceModalBtn, #closeAnnounceModalBtn2').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.classList.remove('active', 'show');
                updateBadgeAndDropdown();
            });
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active', 'show');
                updateBadgeAndDropdown();
            }
        });

        return modal;
    }

    // Open Announcement & Notification Viewer Modal
    function openAnnouncementModal(item, isPersonalNotif = false) {
        const modal = ensureAnnouncementModal();
        if (!modal || !item) return;

        currentViewingItem = { item, isPersonalNotif: Boolean(isPersonalNotif) };
        modal.dataset.currentId = String(item.id);
        modal.dataset.isPersonal = isPersonalNotif ? 'true' : 'false';

        // Check current read status
        const readIds = getReadAnnouncements();
        const wasRead = isPersonalNotif ? Boolean(item.read || item.is_read) : readIds.includes(String(item.id));

        // Mark as read upon viewing
        if (isPersonalNotif) {
            togglePersonalNotificationRead(item.id, true);
        } else {
            markAnnouncementRead(item.id);
            markAnnouncementDismissed(item.id);
            setBannerDismissedTimestamp(Date.now());
            dismissBannerElement();
        }

        const headerTitle = document.getElementById('modalAnnounceHeaderTitle');
        const authorRole = document.getElementById('modalAnnounceAuthorRole');
        const authorName = document.getElementById('modalAnnounceAuthorName');
        const priority = document.getElementById('modalAnnouncePriority');
        const statusBadge = document.getElementById('modalAnnounceStatusBadge');
        const dateEl = document.getElementById('modalAnnounceDate');
        const titleEl = document.getElementById('modalAnnounceTitle');
        const contentEl = document.getElementById('modalAnnounceContent');
        const meetingBox = document.getElementById('modalMeetingBox');
        const actionContainer = document.getElementById('modalActionContainer');
        const actionBtn = document.getElementById('modalActionBtn');
        const actionBtnText = document.getElementById('modalActionBtnText');
        const toggleReadBtn = document.getElementById('modalToggleReadBtn');

        if (statusBadge) {
            statusBadge.className = 'notif-status-badge read';
            statusBadge.innerHTML = `<i class="fas fa-check-circle"></i> Read`;
        }

        if (toggleReadBtn) {
            toggleReadBtn.innerHTML = `<i class="fas fa-envelope"></i> <span id="modalToggleReadBtnText">Mark as Unread</span>`;
        }

        if (isPersonalNotif) {
            const role = (item.role || item.sender || 'NOTICE').toUpperCase();
            if (headerTitle) headerTitle.textContent = `${item.title || 'System Notification'}`;
            if (authorRole) {
                authorRole.textContent = role;
                authorRole.className = 'announcement-badge badge-official';
            }
            if (authorName) authorName.textContent = item.sender || 'Placido L. Señor National High School';
            if (priority) {
                const pri = (item.priority || 'NORMAL').toUpperCase();
                priority.textContent = pri;
                if (pri === 'URGENT') priority.className = 'announcement-badge badge-urgent';
                else priority.className = 'announcement-badge badge-official';
            }
            if (dateEl) {
                try {
                    dateEl.textContent = new Date(item.created_at || Date.now()).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
                    });
                } catch (e) {
                    dateEl.textContent = 'Recent';
                }
            }
            if (titleEl) titleEl.textContent = item.title || 'System Notification';
            if (contentEl) contentEl.textContent = item.message || item.content || 'No details provided.';

            if (meetingBox) meetingBox.style.display = 'none';

            // Action link detection
            let link = item.action_url || item.actionUrl || item.link;
            let label = item.action_label || 'View Related Details';
            const inStudentDir = window.location.pathname.toLowerCase().includes('/student/');
            const isAssessNotice = item.type === 'assessment' || (item.title && item.title.toLowerCase().includes('assessment'));
            const isGradeNotice = (item.type && item.type.includes('grade')) || (item.title && item.title.toLowerCase().includes('grade'));
            const isAttNotice = (item.type && item.type.includes('attendance')) || (item.title && item.title.toLowerCase().includes('attendance'));
            const isGuidanceNotice = (item.type && (item.type.includes('guidance') || item.type.includes('violation') || item.type.includes('counseling'))) || (item.role === 'guidance');
            const isReqNotice = (item.type && (item.type.includes('requirement') || item.type.includes('document'))) || (item.title && item.title.toLowerCase().includes('requirement'));

            if (isAssessNotice) {
                link = inStudentDir ? 'assessments.html' : 'student/assessments.html';
                label = 'Open Assessment & Pass Work';
            } else if (isGradeNotice) {
                link = inStudentDir ? 'grades.html' : 'student/grades.html';
                label = 'View My Grades';
            } else if (isAttNotice) {
                link = inStudentDir ? 'attendance.html' : 'student/attendance.html';
                label = 'View Attendance Record';
            } else if (isGuidanceNotice) {
                link = inStudentDir ? 'guidance.html' : 'student/guidance.html';
                label = 'View Guidance Records';
            } else if (isReqNotice) {
                link = inStudentDir ? 'requirements.html' : 'student/requirements.html';
                label = 'Submit Requirements';
            } else if (!link && item.enrollment_id) {
                link = `../registrar/view_enrollment.html?id=${item.enrollment_id}`;
                label = 'View Enrollment Information';
            } else if (!link && item.violation_id) {
                link = `violations.html?id=${item.violation_id}`;
                label = 'View Guidance Record';
            }

            if (actionContainer && actionBtn) {
                if (link) {
                    actionContainer.style.display = 'flex';
                    actionBtn.href = link;
                    if (actionBtnText) actionBtnText.textContent = label;
                } else {
                    actionContainer.style.display = 'none';
                }
            }
        } else {
            // Announcement details
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

            if (actionContainer) actionContainer.style.display = 'none';
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
            // Asynchronously resolve student info if logged in as student
            if (userRole === 'student' && currentUser) {
                try {
                    const lookupEmail = (currentUser.email || '').trim().toLowerCase();
                    const lookupUid = currentUser.id || currentUser.uid || '';
                    if (lookupEmail || lookupUid) {
                        let stQ = supabase.from('students').select('id, section_id, grade_level, lrn');
                        if (lookupEmail && lookupUid) {
                            stQ = stQ.or(`email.ilike.${lookupEmail},id.eq.${lookupUid}`);
                        } else if (lookupEmail) {
                            stQ = stQ.ilike('email', lookupEmail);
                        } else {
                            stQ = stQ.eq('id', lookupUid);
                        }
                        const { data: stData } = await stQ;
                        if (Array.isArray(stData)) {
                            stData.forEach(st => {
                                if (st.id) userValidIds.add(String(st.id));
                                if (st.lrn) userValidIds.add(String(st.lrn));
                                if (st.section_id && !userSectionId) userSectionId = st.section_id;
                                if (st.grade_level && !userGradeLevel) userGradeLevel = st.grade_level;
                            });

                            if (userSectionId && !userSectionName) {
                                try {
                                    const { data: secData } = await supabase.from('sections').select('name').eq('id', userSectionId).maybeSingle();
                                    if (secData?.name) userSectionName = secData.name;
                                } catch (_) {}
                            }
                        }

                        // Also query users table to ensure auth uid / student_id are present in userValidIds
                        try {
                            let uQ = supabase.from('users').select('id, student_id');
                            if (lookupEmail && lookupUid) {
                                uQ = uQ.or(`email.ilike.${lookupEmail},id.eq.${lookupUid}`);
                            } else if (lookupEmail) {
                                uQ = uQ.ilike('email', lookupEmail);
                            } else {
                                uQ = uQ.eq('id', lookupUid);
                            }
                            const { data: uData } = await uQ;
                            if (Array.isArray(uData)) {
                                uData.forEach(u => {
                                    if (u.id) userValidIds.add(String(u.id));
                                    if (u.student_id) userValidIds.add(String(u.student_id));
                                });
                            }
                        } catch (_) {}
                    }
                } catch (stErr) {
                    console.warn('Student record lookup notice:', stErr);
                }
            }

            let query = supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(60);
            const orClauses = [];

            userValidIds.forEach(id => {
                orClauses.push(`user_id.eq.${id}`);
            });
            if (currentUser?.email) {
                orClauses.push(`user_id.eq.${currentUser.email}`);
            }

            orClauses.push(`and(user_id.is.null,role.eq.${userRole})`);
            orClauses.push(`and(user_id.is.null,role.is.null)`);
            orClauses.push(`and(user_id.is.null,role.eq.all)`);
            if (userRole === 'student') {
                orClauses.push(`and(type.eq.assessment,role.eq.student)`);
            }

            if (orClauses.length > 0) {
                query = query.or(orClauses.join(','));
            }

            const { data: notifData } = await query;
            if (Array.isArray(notifData)) {
                const readPersonalIds = getReadPersonalNotifications();
                const unreadPersonalIds = getUnreadPersonalNotifications();

                allNotifications = notifData.filter(n => {
                    // 1. Explicitly targeted to this user (matches any ID or email)
                    if (n.user_id && userValidIds.has(String(n.user_id))) return true;
                    if (n.user_id && currentUser?.email && String(n.user_id).toLowerCase() === currentUser.email.toLowerCase()) return true;

                    // 2. Assessment notification broadcast: check if student belongs to the mentioned year level or section
                    if (n.type === 'assessment' && userRole === 'student') {
                        if (!n.user_id) {
                            const notifText = `${n.title || ''} ${n.message || ''}`.toLowerCase();
                            // If notification targets a specific section, student MUST be in that section
                            if (notifText.includes('section:')) {
                                if (userSectionName && notifText.includes(userSectionName.toLowerCase())) return true;
                                return false; // Exclude student if not in this section!
                            }
                            // If notification targets a specific year level
                            if (notifText.includes('year level:')) {
                                if (userGradeLevel && notifText.includes(userGradeLevel.toLowerCase())) return true;
                                return false;
                            }
                            if (userGradeLevel && notifText.includes(userGradeLevel.toLowerCase())) return true;
                            if (userSectionName && notifText.includes(userSectionName.toLowerCase())) return true;
                            return false;
                        }
                    }

                    // 3. Broadcast notifications with NO user_id
                    if (!n.user_id) {
                        if (!n.role || n.role === 'all' || (userRole && n.role.toLowerCase() === userRole.toLowerCase())) {
                            return true;
                        }
                    }
                    // Reject cross-user notifications (e.g. notifications with other students' user_ids)
                    return false;
                }).map(n => {
                    const nid = String(n.id);
                    let isRead = Boolean(n.read || n.is_read);
                    if (readPersonalIds.includes(nid)) {
                        isRead = true;
                    } else if (unreadPersonalIds.includes(nid)) {
                        isRead = false;
                    }
                    return {
                        ...n,
                        read: isRead,
                        is_read: isRead
                    };
                });

                // Also merge any localStorage student notifications (strictly per student keys)
                userValidIds.forEach(vId => {
                    try {
                        const localKey = `hes_notifications_${vId}`;
                        const raw = localStorage.getItem(localKey);
                        if (raw) {
                            const localList = JSON.parse(raw);
                            if (Array.isArray(localList)) {
                                localList.forEach(loc => {
                                    if (!allNotifications.some(n => String(n.id) === String(loc.id) || (n.title === loc.title && n.message === loc.message))) {
                                        const locId = String(loc.id);
                                        let isRead = Boolean(loc.read || loc.is_read);
                                        if (readPersonalIds.includes(locId)) isRead = true;
                                        else if (unreadPersonalIds.includes(locId)) isRead = false;
                                        allNotifications.unshift({
                                            ...loc,
                                            read: isRead,
                                            is_read: isRead
                                        });
                                    }
                                });
                            }
                        }
                    } catch (e) { }
                });

                allNotifications.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
            }
        } catch (e) {
            console.warn('Personal notifications query notice:', e);
        }

        return allAnnouncements;
    }

    // Render Dashboard Banner Widget
    function renderDashboardBanner() {
        // Find most relevant announcement from Admin or Registrar
        const adminOrRegistrarNotices = allAnnouncements.filter(a => {
            const r = (a.author_role || '').toLowerCase();
            return r === 'admin' || r === 'registrar';
        });

        if (adminOrRegistrarNotices.length === 0) {
            const existingBanner = document.getElementById('dashboardAnnouncementBanner');
            if (existingBanner) existingBanner.remove();
            return;
        }

        const readIds = getReadAnnouncements();
        const dismissedIds = getDismissedAnnouncements();
        const lastDismissedAt = getBannerDismissedTimestamp();

        // The banner ONLY evaluates the single latest announcement (index 0).
        // It NEVER cycles through older archived announcements when one is dismissed!
        const latestNotice = adminOrRegistrarNotices[0];
        if (!latestNotice) {
            const existingBanner = document.getElementById('dashboardAnnouncementBanner');
            if (existingBanner) existingBanner.remove();
            return;
        }

        const noticeId = String(latestNotice.id);
        const noticeTime = new Date(latestNotice.date_created || 0).getTime();

        const isDismissed = dismissedIds.includes(noticeId);
        const isRead = readIds.includes(noticeId);
        const isOlderThanDismissal = lastDismissedAt > 0 && noticeTime <= lastDismissedAt;

        if (isDismissed || isRead || isOlderThanDismissal) {
            // Once addressed, seen, or dismissed, do not show banner at all!
            const existingBanner = document.getElementById('dashboardAnnouncementBanner');
            if (existingBanner) existingBanner.remove();
            return;
        }

        const targetNotice = latestNotice;

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
        banner.dataset.announcementId = String(targetNotice.id);
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
            // Once addressed via View Full Announcement, dismiss all current notices from banner
            markAnnouncementRead(targetNotice.id);
            markAnnouncementDismissed(targetNotice.id);
            allAnnouncements.forEach(a => markAnnouncementDismissed(a.id));
            setBannerDismissedTimestamp(Date.now());
            dismissBannerElement();
            openAnnouncementModal(targetNotice);
            updateBadgeAndDropdown();
        });

        banner.querySelector('#btnBannerDismiss').addEventListener('click', () => {
            // Once dismissed, dismiss all current notices so older ones never cycle into view
            markAnnouncementDismissed(targetNotice.id);
            markAnnouncementRead(targetNotice.id);
            allAnnouncements.forEach(a => markAnnouncementDismissed(a.id));
            setBannerDismissedTimestamp(Date.now());
            dismissBannerElement();
            updateBadgeAndDropdown();
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
        const countAllEl = document.getElementById('notifCountAll');
        const countUnreadEl = document.getElementById('notifCountUnread');

        const readIds = getReadAnnouncements();

        // Calculate unread items
        const unreadAnnouncements = allAnnouncements.filter(a => !readIds.includes(String(a.id)));
        const unreadPersonal = allNotifications.filter(n => !n.read && !n.is_read);

        const totalUnread = unreadAnnouncements.length + unreadPersonal.length;
        const totalAll = allAnnouncements.length + allNotifications.length;

        // Update tab filter numbers
        if (countAllEl) countAllEl.textContent = String(totalAll);
        if (countUnreadEl) countUnreadEl.textContent = String(totalUnread);

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
            let filteredAnnouncements = allAnnouncements;
            let filteredPersonal = allNotifications;

            if (currentNotifFilter === 'unread') {
                filteredAnnouncements = unreadAnnouncements;
                filteredPersonal = unreadPersonal;
            }

            if (filteredAnnouncements.length === 0 && filteredPersonal.length === 0) {
                if (currentNotifFilter === 'unread') {
                    notifList.innerHTML = `
                        <div class="empty-notifications">
                            <i class="fas fa-check-double" style="color: #10b981;"></i>
                            <p style="font-weight: 700; color: #1e293b;">You're all caught up!</p>
                            <span style="font-size: 0.78rem; color: #64748b; display: block; margin-top: 4px;">No unread notices. Click "All" to review past notices.</span>
                        </div>
                    `;
                } else {
                    notifList.innerHTML = `
                        <div class="empty-notifications">
                            <i class="fas fa-bell-slash"></i>
                            <p>No announcements or notifications</p>
                        </div>
                    `;
                }
                return;
            }

            let html = '';

            // 1. Announcements (Admin & Registrar notices prominent)
            filteredAnnouncements.forEach(item => {
                const isUnread = !readIds.includes(String(item.id));
                const isRegistrar = item.author_role === 'registrar';
                const isUrgent = (item.priority || '').toLowerCase() === 'urgent';

                let iconClass = isRegistrar ? 'registrar-icon' : 'admin-icon';
                if (isUrgent) iconClass = 'urgent-icon';

                let badgeClass = isRegistrar ? 'registrar-badge' : 'admin-badge';
                if (isUrgent) badgeClass = 'urgent-badge';

                const authorBadge = isRegistrar ? 'REGISTRAR' : 'ADMIN';

                html += `
                    <div class="notif-item ${isUnread ? 'unread' : 'read'}" data-item-id="${item.id}" data-item-type="announcement">
                        <div class="notif-item-icon ${iconClass}">
                            <i class="fas ${isUrgent ? 'fa-exclamation-triangle' : 'fa-bullhorn'}"></i>
                        </div>
                        <div class="notif-item-content">
                            <div class="notif-item-header">
                                <span class="notif-item-badge ${badgeClass}">${authorBadge}</span>
                                <span class="notif-item-time">${formatTimeAgo(item.date_created || item.created_at)}</span>
                            </div>
                            <div class="notif-item-title">${item.title}</div>
                            <div class="notif-item-snippet">${item.content || item.message || ''}</div>
                            <div class="notif-item-meta-bar">
                                <span class="notif-status-badge ${isUnread ? 'unread' : 'read'}">
                                    <i class="fas ${isUnread ? 'fa-bell' : 'fa-check'}"></i> ${isUnread ? 'Unread' : 'Read'}
                                </span>
                                <button type="button" class="notif-item-action-btn ${isUnread ? '' : 'btn-return-unread'}" data-action="toggle_read" data-id="${item.id}" data-type="announcement" title="${isUnread ? 'Mark as read' : 'Return to unread'}">
                                    <i class="fas ${isUnread ? 'fa-check' : 'fa-arrow-rotate-left'}"></i>
                                    <span>${isUnread ? 'Mark read' : 'Return to unread'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });

            // 2. Personal notifications
            filteredPersonal.forEach(n => {
                const isUnread = (!n.read && !n.is_read);
                const nType = (n.type || '').toLowerCase();
                const nRole = (n.role || '').toLowerCase();
                const nTitle = (n.title || '').toLowerCase();
                const nSender = (n.sender || '').toLowerCase();
                const inStudentDir = window.location.pathname.toLowerCase().includes('/student/');

                let iconClass = 'admin-icon';
                let badgeClass = 'admin-badge';
                let iconTag = '<i class="fas fa-bell"></i>';
                let typeBadge = (n.type || n.role || 'NOTICE').toUpperCase();
                let actionHtml = '';

                // A. GUIDANCE NOTIFICATIONS
                if (nType.includes('guidance') || nType.includes('violation') || nType.includes('counseling') || nRole === 'guidance' || nSender.includes('guidance')) {
                    iconClass = 'guidance-icon';
                    badgeClass = 'guidance-badge';
                    iconTag = '<i class="fas fa-scale-balanced"></i>';
                    typeBadge = 'GUIDANCE';
                    const guidanceUrl = inStudentDir ? 'guidance.html' : 'student/guidance.html';
                    actionHtml = `
                        <div style="margin: 6px 0 3px;">
                            <a href="${guidanceUrl}" class="notif-assessment-link" style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.76rem; font-weight: 700; color: #d97706; text-decoration: none;">
                                <i class="fas fa-arrow-up-right-from-square"></i> View Guidance Record &rarr;
                            </a>
                        </div>
                    `;
                }
                // B. TEACHER NOTIFICATIONS (Assessments, Grades, Attendance)
                else if (nType === 'assessment' || nType.includes('grade') || nType.includes('attendance') || nRole === 'teacher' || nSender.includes('teacher') || nTitle.includes('assessment') || nTitle.includes('grade')) {
                    iconClass = 'assessment-icon';
                    badgeClass = 'assessment-badge';
                    if (nType === 'assessment' || nTitle.includes('assessment')) {
                        iconTag = '<i class="fas fa-file-signature"></i>';
                        typeBadge = 'TEACHER · ASSESSMENT';
                        const assessUrl = inStudentDir ? 'assessments.html' : 'student/assessments.html';
                        actionHtml = `
                            <div style="margin: 6px 0 3px;">
                                <a href="${assessUrl}" class="notif-assessment-link" style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.76rem; font-weight: 700; color: #4f46e5; text-decoration: none;">
                                    <i class="fas fa-file-signature"></i> Open Assessment & Turn In Work &rarr;
                                </a>
                            </div>
                        `;
                    } else if (nType.includes('grade') || nTitle.includes('grade')) {
                        iconTag = '<i class="fas fa-star"></i>';
                        typeBadge = 'TEACHER · GRADES';
                        const gradesUrl = inStudentDir ? 'grades.html' : 'student/grades.html';
                        actionHtml = `
                            <div style="margin: 6px 0 3px;">
                                <a href="${gradesUrl}" class="notif-assessment-link" style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.76rem; font-weight: 700; color: #4f46e5; text-decoration: none;">
                                    <i class="fas fa-chart-line"></i> View My Grades &rarr;
                                </a>
                            </div>
                        `;
                    } else {
                        iconTag = '<i class="fas fa-clipboard-check"></i>';
                        typeBadge = 'TEACHER · ATTENDANCE';
                        const attUrl = inStudentDir ? 'attendance.html' : 'student/attendance.html';
                        actionHtml = `
                            <div style="margin: 6px 0 3px;">
                                <a href="${attUrl}" class="notif-assessment-link" style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.76rem; font-weight: 700; color: #4f46e5; text-decoration: none;">
                                    <i class="fas fa-calendar-check"></i> View Attendance Records &rarr;
                                </a>
                            </div>
                        `;
                    }
                }
                // C. REGISTRAR NOTIFICATIONS (Enrollments, Requirements, Verification)
                else if (nType.includes('requirement') || nType.includes('enrollment') || nType.includes('document') || nRole === 'registrar' || nSender.includes('registrar') || nTitle.includes('enrollment') || nTitle.includes('requirement')) {
                    iconClass = 'registrar-icon';
                    badgeClass = 'registrar-badge';
                    iconTag = '<i class="fas fa-file-invoice"></i>';
                    typeBadge = 'REGISTRAR';
                    if (nType.includes('requirement') || nTitle.includes('requirement') || nTitle.includes('document')) {
                        const reqUrl = inStudentDir ? 'requirements.html' : 'student/requirements.html';
                        actionHtml = `
                            <div style="margin: 6px 0 3px;">
                                <a href="${reqUrl}" class="notif-assessment-link" style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.76rem; font-weight: 700; color: #059669; text-decoration: none;">
                                    <i class="fas fa-cloud-arrow-up"></i> Submit Documents &rarr;
                                </a>
                            </div>
                        `;
                    }
                }
                // D. ADMIN NOTIFICATIONS
                else {
                    const isUrgent = (n.priority || '').toLowerCase() === 'urgent';
                    iconClass = isUrgent ? 'urgent-icon' : 'admin-icon';
                    badgeClass = isUrgent ? 'urgent-badge' : 'admin-badge';
                    iconTag = isUrgent ? '<i class="fas fa-triangle-exclamation"></i>' : '<i class="fas fa-shield-halved"></i>';
                    typeBadge = 'ADMIN';
                }

                html += `
                    <div class="notif-item ${isUnread ? 'unread' : 'read'}" data-item-id="${n.id}" data-item-type="personal">
                        <div class="notif-item-icon ${iconClass}">
                            ${iconTag}
                        </div>
                        <div class="notif-item-content">
                            <div class="notif-item-header">
                                <span class="notif-item-badge ${badgeClass}">${typeBadge}</span>
                                <span class="notif-item-time">${formatTimeAgo(n.created_at)}</span>
                            </div>
                            <div class="notif-item-title">${n.title || 'Official Notification'}</div>
                            <div class="notif-item-snippet">${n.message || n.content || ''}</div>
                            ${actionHtml}
                            <div class="notif-item-meta-bar">
                                <span class="notif-status-badge ${isUnread ? 'unread' : 'read'}">
                                    <i class="fas ${isUnread ? 'fa-bell' : 'fa-check'}"></i> ${isUnread ? 'Unread' : 'Read'}
                                </span>
                                <button type="button" class="notif-item-action-btn ${isUnread ? '' : 'btn-return-unread'}" data-action="toggle_read" data-id="${n.id}" data-type="personal" title="${isUnread ? 'Mark as read' : 'Return to unread'}">
                                    <i class="fas ${isUnread ? 'fa-check' : 'fa-arrow-rotate-left'}"></i>
                                    <span>${isUnread ? 'Mark read' : 'Return to unread'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });

            notifList.innerHTML = html;

            // Click listener for notification items to view full detail
            notifList.querySelectorAll('.notif-item').forEach(el => {
                el.addEventListener('click', (e) => {
                    if (e.target.closest('.notif-item-action-btn')) return;
                    const id = el.getAttribute('data-item-id');
                    const type = el.getAttribute('data-item-type');
                    if (type === 'personal') {
                        const item = allNotifications.find(n => String(n.id) === String(id));
                        if (item) {
                            openAnnouncementModal(item, true);
                            const dropdown = document.getElementById('notificationDropdown');
                            if (dropdown) dropdown.classList.remove('active', 'show');
                        }
                    } else {
                        const item = allAnnouncements.find(a => String(a.id) === String(id));
                        if (item) {
                            openAnnouncementModal(item, false);
                            const dropdown = document.getElementById('notificationDropdown');
                            if (dropdown) dropdown.classList.remove('active', 'show');
                        }
                    }
                });
            });

            // Click listener for quick action buttons (mark read or return to unread)
            notifList.querySelectorAll('.notif-item-action-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const id = btn.getAttribute('data-id');
                    const type = btn.getAttribute('data-type');
                    if (type === 'personal') {
                        const targetNotif = allNotifications.find(n => String(n.id) === String(id));
                        if (targetNotif) {
                            const currentlyRead = Boolean(targetNotif.read || targetNotif.is_read);
                            await togglePersonalNotificationRead(id, !currentlyRead);
                        }
                    } else {
                        const readIds = getReadAnnouncements();
                        const isCurrentlyRead = readIds.includes(String(id));
                        if (isCurrentlyRead) {
                            markAnnouncementUnread(id);
                        } else {
                            markAnnouncementRead(id);
                        }
                        updateBadgeAndDropdown();
                    }
                });
            });
        }
    }

    // Bind Dropdown Toggle & Mark All Read & Filter Tabs
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

            // Bind Filter Tabs (All / Unread)
            dropdown.querySelectorAll('.notif-filter-tab').forEach(tab => {
                tab.addEventListener('click', (e) => {
                    e.stopPropagation();
                    dropdown.querySelectorAll('.notif-filter-tab').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    currentNotifFilter = tab.getAttribute('data-filter') || 'all';
                    updateBadgeAndDropdown();
                });
            });
        }

        if (markAllReadBtn) {
            markAllReadBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                // 1. Announcements
                markAllAnnouncementsRead();
                allAnnouncements.forEach(a => markAnnouncementDismissed(a.id));
                setBannerDismissedTimestamp(Date.now());
                dismissBannerElement();

                // 2. Personal notifications - persist in localStorage and memory
                const unreadNotifIds = allNotifications.filter(n => !n.read && !n.is_read).map(n => String(n.id));
                unreadNotifIds.forEach(id => markPersonalNotificationRead(id));
                allNotifications.forEach(n => { n.read = true; n.is_read = true; });

                // 3. Immediately clear badge and refresh dropdown UI
                updateBadgeAndDropdown();

                // 4. Update Supabase in background
                try {
                    if (unreadNotifIds.length > 0) {
                        await supabase.from('notifications').update({ read: true, is_read: true }).in('id', unreadNotifIds);
                    }
                    if (userValidIds.size > 0) {
                        await supabase.from('notifications').update({ read: true, is_read: true }).in('user_id', Array.from(userValidIds));
                    } else if (userId) {
                        await supabase.from('notifications').update({ read: true, is_read: true }).eq('user_id', userId);
                    }
                } catch (e) {
                    console.warn('Mark all read Supabase notice:', e);
                }
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
            if (item) {
                markAnnouncementRead(item.id);
                markAnnouncementDismissed(item.id);
                setBannerDismissedTimestamp(Date.now());
                dismissBannerElement();
                openAnnouncementModal(item);
                updateBadgeAndDropdown();
            }
        },
        dismissAnnouncement: (id) => {
            markAnnouncementDismissed(id);
            markAnnouncementRead(id);
            setBannerDismissedTimestamp(Date.now());
            dismissBannerElement();
            updateBadgeAndDropdown();
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
