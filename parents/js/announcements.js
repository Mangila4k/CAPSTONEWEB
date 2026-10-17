/**
 * Parent Announcements & Meetings Module
 * Handles viewing announcements, PTA meetings, and RSVP responses for Parents
 */

import { AnnouncementsService } from '../../js/announcements_service.js';

(function () {
    'use strict';

    // State
    let currentParent = null;
    let allAnnouncements = [];
    let currentTabFilter = 'all';
    let currentSearchTerm = '';
    let currentMeetingTypeFilter = 'all';
    let currentRsvpFilter = 'all';

    // DOM Elements
    const feedContainer = document.getElementById('parentAnnouncementsFeed');
    const searchInput = document.getElementById('parentAnnouncementSearch');
    const meetingTypeSelect = document.getElementById('parentMeetingTypeFilter');
    const rsvpStatusSelect = document.getElementById('parentRsvpFilter');
    const categoryTabs = document.getElementById('parentCategoryTabs');
    const alertContainer = document.getElementById('alertContainer');
    const currentDateDisplay = document.getElementById('currentDateDisplay');
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');

    // Stats Elements
    const statParentTotal = document.getElementById('statParentTotal');
    const statParentMeetingsCount = document.getElementById('statParentMeetingsCount');
    const statParentAttendingCount = document.getElementById('statParentAttendingCount');
    const statParentPendingRsvps = document.getElementById('statParentPendingRsvps');

    // Init
    document.addEventListener('DOMContentLoaded', async () => {
        initSession();
        initDateDisplay();
        initMobileMenu();
        setupEventListeners();
        await loadAnnouncements();
    });

    function initSession() {
        try {
            const rawUser = localStorage.getItem('currentUser');
            if (rawUser) {
                currentParent = JSON.parse(rawUser);
            }
        } catch (e) {
            console.warn('Session parse note:', e);
        }

        if (!currentParent) {
            const savedName = localStorage.getItem('hes_parent_name') || 'Parent / Guardian';
            currentParent = {
                id: 'parent-current',
                displayName: savedName,
                firstName: savedName,
                role: 'parent',
                email: ''
            };
        }

        // Child name display
        const childName = localStorage.getItem('hes_parent_child_name') || currentParent.student_name || 'Your Student';
        const parentStudentName = document.getElementById('parentStudentName');
        const sidebarChildName = document.getElementById('sidebarChildName');
        if (parentStudentName) parentStudentName.textContent = childName;
        if (sidebarChildName) sidebarChildName.textContent = childName;
    }

    function initDateDisplay() {
        if (currentDateDisplay) {
            const now = new Date();
            const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
            currentDateDisplay.innerHTML = `<i class="fas fa-calendar-alt"></i> ${now.toLocaleDateString('en-US', options)}`;
        }
    }

    function initMobileMenu() {
        if (menuToggle && sidebar) {
            menuToggle.addEventListener('click', () => {
                sidebar.classList.toggle('active');
            });
            document.addEventListener('click', (e) => {
                if (window.innerWidth <= 992 && !sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                    sidebar.classList.remove('active');
                }
            });
        }
    }

    function setupEventListeners() {
        // Tab switching
        if (categoryTabs) {
            categoryTabs.querySelectorAll('.tab-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    categoryTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    currentTabFilter = btn.getAttribute('data-filter');
                    applyFiltersAndRender();
                });
            });
        }

        // Quick stat card clicks
        const cardParentMeetings = document.getElementById('cardParentMeetings');
        if (cardParentMeetings) {
            cardParentMeetings.addEventListener('click', () => {
                setActiveTab('parent_meetings');
            });
        }

        // Search Input with debounce
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                currentSearchTerm = e.target.value.trim().toLowerCase();
                applyFiltersAndRender();
            });
        }

        // Select Filters
        if (meetingTypeSelect) {
            meetingTypeSelect.addEventListener('change', (e) => {
                currentMeetingTypeFilter = e.target.value;
                applyFiltersAndRender();
            });
        }

        if (rsvpStatusSelect) {
            rsvpStatusSelect.addEventListener('change', (e) => {
                currentRsvpFilter = e.target.value;
                applyFiltersAndRender();
            });
        }
    }

    function setActiveTab(tabFilterKey) {
        if (!categoryTabs) return;
        categoryTabs.querySelectorAll('.tab-btn').forEach(b => {
            if (b.getAttribute('data-filter') === tabFilterKey) {
                b.classList.add('active');
            } else {
                b.classList.remove('active');
            }
        });
        currentTabFilter = tabFilterKey;
        applyFiltersAndRender();
    }

    async function loadAnnouncements() {
        try {
            allAnnouncements = await AnnouncementsService.getAnnouncements({
                targetRole: 'parent'
            });
            updateStats();
            applyFiltersAndRender();
        } catch (error) {
            console.error('Error loading parent announcements:', error);
            if (feedContainer) {
                feedContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h3>Unable to load notices</h3>
                        <p>Please check your connection or refresh the page.</p>
                    </div>
                `;
            }
        }
    }

    function updateStats() {
        const total = allAnnouncements.length;
        const ptaCount = allAnnouncements.filter(a => 
            a.meeting_type === 'pta_assembly' || a.meeting_type === 'homeroom_meeting' || a.target_audience === 'parents' || a.target_audience === 'parent_teacher_meeting'
        ).length;

        let attendingCount = 0;
        let pendingCount = 0;

        allAnnouncements.forEach(a => {
            if (a.requires_rsvp) {
                const userRsvp = AnnouncementsService.getUserRSVP(a.id, currentParent);
                if (userRsvp && userRsvp.status === 'attending') {
                    attendingCount++;
                } else if (!userRsvp) {
                    pendingCount++;
                }
            }
        });

        if (statParentTotal) statParentTotal.textContent = total;
        if (statParentMeetingsCount) statParentMeetingsCount.textContent = ptaCount;
        if (statParentAttendingCount) statParentAttendingCount.textContent = attendingCount;
        if (statParentPendingRsvps) statParentPendingRsvps.textContent = pendingCount;
    }

    function applyFiltersAndRender() {
        if (!feedContainer) return;

        let filtered = [...allAnnouncements];

        // 1. Tab Filter
        if (currentTabFilter === 'parent_meetings') {
            filtered = filtered.filter(a => 
                a.meeting_type === 'pta_assembly' || 
                a.meeting_type === 'homeroom_meeting' || 
                a.target_audience === 'parent_teacher_meeting' ||
                a.target_audience === 'parents'
            );
        } else if (currentTabFilter === 'general') {
            filtered = filtered.filter(a => a.category === 'general' || a.meeting_type === 'none');
        } else if (currentTabFilter === 'urgent') {
            filtered = filtered.filter(a => (a.priority || '').toLowerCase() === 'urgent');
        }

        // 2. Meeting Type Select Filter
        if (currentMeetingTypeFilter !== 'all') {
            filtered = filtered.filter(a => a.meeting_type === currentMeetingTypeFilter);
        }

        // 3. RSVP Filter
        if (currentRsvpFilter !== 'all') {
            filtered = filtered.filter(a => {
                const userRsvp = AnnouncementsService.getUserRSVP(a.id, currentParent);
                if (currentRsvpFilter === 'attending') return userRsvp && userRsvp.status === 'attending';
                if (currentRsvpFilter === 'declined') return userRsvp && userRsvp.status === 'declined';
                if (currentRsvpFilter === 'pending') return a.requires_rsvp && !userRsvp;
                return true;
            });
        }

        // 4. Search Filter
        if (currentSearchTerm) {
            filtered = filtered.filter(a => 
                (a.title || '').toLowerCase().includes(currentSearchTerm) ||
                (a.content || '').toLowerCase().includes(currentSearchTerm) ||
                (a.venue || '').toLowerCase().includes(currentSearchTerm) ||
                (a.author_name || '').toLowerCase().includes(currentSearchTerm) ||
                (a.agenda && Array.isArray(a.agenda) && a.agenda.some(item => item.toLowerCase().includes(currentSearchTerm)))
            );
        }

        renderFeed(filtered);
    }

    function renderFeed(items) {
        if (!feedContainer) return;

        if (items.length === 0) {
            feedContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-times"></i>
                    <h3>No announcements found</h3>
                    <p>There are currently no notices or meetings matching your selected filters.</p>
                </div>
            `;
            return;
        }

        feedContainer.innerHTML = items.map(item => createAnnouncementCardHtml(item)).join('');

        // Attach RSVP Button Listeners
        feedContainer.querySelectorAll('.btn-rsvp').forEach(btn => {
            btn.addEventListener('click', async () => {
                const ancId = btn.getAttribute('data-id');
                const status = btn.getAttribute('data-status');
                await handleRSVP(ancId, status);
            });
        });
    }

    function createAnnouncementCardHtml(item) {
        const isMeeting = item.category === 'meeting' || (item.meeting_type && item.meeting_type !== 'none');
        const userRsvp = AnnouncementsService.getUserRSVP(item.id, currentParent);
        const rsvpCounts = AnnouncementsService.getRSVPCounts(item.id);

        // Target badge
        let audienceBadge = '';
        if (item.target_audience === 'parents') {
            audienceBadge = '<span class="badge badge-parent"><i class="fas fa-user-friends"></i> Parents / PTA</span>';
        } else if (item.target_audience === 'parent_teacher_meeting') {
            audienceBadge = '<span class="badge badge-joint"><i class="fas fa-handshake"></i> Parent-Teacher Conference</span>';
        } else if (item.target_audience === 'all') {
            audienceBadge = '<span class="badge badge-all"><i class="fas fa-school"></i> School-Wide Notice</span>';
        }

        // Priority badge
        let priorityBadge = '';
        if (item.priority === 'urgent') {
            priorityBadge = '<span class="badge badge-urgent"><i class="fas fa-fire"></i> Urgent</span>';
        } else if (item.priority === 'important') {
            priorityBadge = '<span class="badge badge-important"><i class="fas fa-exclamation-circle"></i> Important</span>';
        }

        // Meeting Type Badge
        let meetingBadge = '';
        if (item.meeting_type === 'pta_assembly') {
            meetingBadge = '<span class="badge badge-meeting"><i class="fas fa-users"></i> General PTA Assembly</span>';
        } else if (item.meeting_type === 'homeroom_meeting') {
            meetingBadge = '<span class="badge badge-meeting"><i class="fas fa-chalkboard-teacher"></i> Homeroom Conference</span>';
        } else if (isMeeting) {
            meetingBadge = '<span class="badge badge-meeting"><i class="fas fa-calendar-alt"></i> Meeting Notice</span>';
        }

        // Date formatting
        let dateFormatted = 'Recently';
        if (item.date_created) {
            try {
                const d = new Date(item.date_created);
                dateFormatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            } catch (e) {}
        }

        // Meeting schedule box HTML
        let meetingBoxHtml = '';
        if (isMeeting && (item.meeting_date || item.venue || item.meeting_link)) {
            let meetingDateStr = item.meeting_date || 'To be announced';
            try {
                if (item.meeting_date && item.meeting_date.includes('-')) {
                    const md = new Date(item.meeting_date);
                    meetingDateStr = md.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                }
            } catch(e) {}

            meetingBoxHtml = `
                <div class="meeting-schedule-card">
                    <div class="meeting-detail-row">
                        <div class="detail-item">
                            <i class="fas fa-calendar-day text-accent"></i>
                            <div>
                                <small>Date</small>
                                <strong>${meetingDateStr}</strong>
                            </div>
                        </div>
                        <div class="detail-item">
                            <i class="fas fa-clock text-accent"></i>
                            <div>
                                <small>Time</small>
                                <strong>${item.meeting_time || 'Check Details'}</strong>
                            </div>
                        </div>
                        <div class="detail-item">
                            <i class="fas fa-map-marker-alt text-danger"></i>
                            <div>
                                <small>Venue / Classroom</small>
                                <strong>${item.venue || 'Campus Assigned Room'}</strong>
                            </div>
                        </div>
                    </div>
                    ${item.meeting_link ? `
                        <div class="meeting-link-box">
                            <i class="fas fa-video"></i>
                            <a href="${item.meeting_link}" target="_blank" rel="noopener noreferrer" class="btn-join-meet">
                                <i class="fas fa-external-link-alt"></i> Join Google Meet / Online Link
                            </a>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        // Agenda items
        let agendaHtml = '';
        if (item.agenda && Array.isArray(item.agenda) && item.agenda.length > 0) {
            agendaHtml = `
                <div class="agenda-section">
                    <h4><i class="fas fa-list-check"></i> Meeting Agenda:</h4>
                    <ul class="agenda-list">
                        ${item.agenda.map(point => `<li><i class="fas fa-check-circle"></i> <span>${point}</span></li>`).join('')}
                    </ul>
                </div>
            `;
        }

        // RSVP Box HTML
        let rsvpSectionHtml = '';
        if (item.requires_rsvp) {
            let rsvpStatusBadge = '';
            if (userRsvp) {
                if (userRsvp.status === 'attending') {
                    rsvpStatusBadge = '<div class="rsvp-feedback success"><i class="fas fa-check-circle"></i> You confirmed attendance for this meeting.</div>';
                } else if (userRsvp.status === 'declined') {
                    rsvpStatusBadge = '<div class="rsvp-feedback danger"><i class="fas fa-times-circle"></i> You indicated that you cannot attend.</div>';
                }
            }

            rsvpSectionHtml = `
                <div class="rsvp-section-box">
                    <div class="rsvp-header">
                        <span class="rsvp-title"><i class="fas fa-envelope-open-text"></i> Parent Attendance Confirmation (RSVP):</span>
                        <span class="rsvp-counts-pill">
                            <span title="Parents attending"><i class="fas fa-user-check text-emerald"></i> ${rsvpCounts.attending} Attending</span>
                        </span>
                    </div>
                    ${rsvpStatusBadge}
                    <div class="rsvp-actions">
                        <button type="button" class="btn-rsvp btn-rsvp-attend ${userRsvp && userRsvp.status === 'attending' ? 'active' : ''}" data-id="${item.id}" data-status="attending">
                            <i class="fas fa-check"></i> Yes, I Will Attend
                        </button>
                        <button type="button" class="btn-rsvp btn-rsvp-decline ${userRsvp && userRsvp.status === 'declined' ? 'active' : ''}" data-id="${item.id}" data-status="declined">
                            <i class="fas fa-times"></i> Cannot Attend
                        </button>
                    </div>
                </div>
            `;
        }

        return `
            <div class="announcement-card ${item.priority === 'urgent' ? 'card-urgent' : (isMeeting ? 'meeting-card' : '')}" id="anc-card-${item.id}">
                <div class="card-top-bar">
                    <div class="badge-group">
                        ${meetingBadge}
                        ${audienceBadge}
                        ${priorityBadge}
                    </div>
                    <div class="announcement-meta">
                        <span class="meta-date"><i class="far fa-clock"></i> ${dateFormatted}</span>
                    </div>
                </div>

                <div class="card-main">
                    <h3 class="card-title">${item.title}</h3>
                    <div class="card-author">
                        <i class="fas fa-user-tie"></i> Posted by: <strong>${item.author_name || 'Administration'}</strong>
                    </div>
                    <p class="card-body-text">${item.content}</p>

                    ${meetingBoxHtml}
                    ${agendaHtml}
                    ${rsvpSectionHtml}
                </div>
            </div>
        `;
    }

    async function handleRSVP(announcementId, status) {
        try {
            await AnnouncementsService.submitRSVP(announcementId, currentParent, status);
            const statusText = status === 'attending' ? 'confirmed your attendance' : 'declined the meeting invitation';
            showAlert(`Thank you! You have successfully ${statusText}.`, 'success');
            updateStats();
            applyFiltersAndRender();
        } catch (e) {
            console.error('RSVP submission error:', e);
            showAlert('Failed to update RSVP status. Please try again.', 'error');
        }
    }

    function showAlert(message, type = 'info') {
        if (!alertContainer) return;
        const div = document.createElement('div');
        div.className = `alert-box alert-${type}`;
        div.style.cssText = `
            padding: 12px 18px;
            border-radius: 10px;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 14px;
            font-weight: 500;
            animation: fadeIn 0.3s ease-in-out;
            ${type === 'success' ? 'background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0;' : ''}
            ${type === 'error' ? 'background: #fef2f2; color: #991b1b; border: 1px solid #fecaca;' : ''}
            ${type === 'info' ? 'background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe;' : ''}
        `;
        const icon = type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle');
        div.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
        alertContainer.innerHTML = '';
        alertContainer.appendChild(div);
        setTimeout(() => {
            if (div.parentNode) div.remove();
        }, 4500);
    }
})();
