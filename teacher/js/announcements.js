/**
 * Teacher Announcements & Meetings Module
 * Handles notice filtering, RSVP submissions, and meeting coordination
 */

import { AnnouncementsService } from '../../js/announcements_service.js';

(function () {
    'use strict';

    // State
    let currentTeacher = null;
    let allAnnouncements = [];
    let currentTabFilter = 'all';
    let currentSearchTerm = '';
    let currentMeetingTypeFilter = 'all';
    let currentRsvpFilter = 'all';

    // DOM Elements
    const feedContainer = document.getElementById('announcementsFeed');
    const searchInput = document.getElementById('announcementSearch');
    const meetingTypeSelect = document.getElementById('meetingTypeFilter');
    const rsvpStatusSelect = document.getElementById('rsvpStatusFilter');
    const categoryTabs = document.getElementById('categoryTabs');
    const alertContainer = document.getElementById('alertContainer');
    const currentDateBadge = document.getElementById('currentDateBadge');

    // Stats Elements
    const statTotalNotices = document.getElementById('statTotalNotices');
    const statFacultyMeetings = document.getElementById('statFacultyMeetings');
    const statPtaMeetings = document.getElementById('statPtaMeetings');
    const statPendingRsvps = document.getElementById('statPendingRsvps');

    // Modal Elements
    const postModal = document.getElementById('postModal');
    const openPostModalBtn = document.getElementById('openPostModalBtn');
    const closePostModalBtn = document.getElementById('closePostModalBtn');
    const cancelPostBtn = document.getElementById('cancelPostBtn');
    const postAnnouncementForm = document.getElementById('postAnnouncementForm');
    const postMeetingType = document.getElementById('postMeetingType');
    const meetingFieldsContainer = document.getElementById('meetingFieldsContainer');

    // Init
    document.addEventListener('DOMContentLoaded', async () => {
        initSession();
        initDateDisplay();
        setupEventListeners();
        await loadAnnouncements();
    });

    function initSession() {
        try {
            const rawUser = localStorage.getItem('currentUser');
            if (rawUser) {
                currentTeacher = JSON.parse(rawUser);
            }
        } catch (e) {
            console.warn('Session parse note:', e);
        }

        if (!currentTeacher) {
            const savedName = localStorage.getItem('hes_teacher_name') || 'Teacher';
            currentTeacher = {
                id: 'teacher-current',
                displayName: savedName,
                firstName: savedName,
                role: 'teacher',
                email: 'teacher@hiraya.edu.ph'
            };
        }
    }

    function initDateDisplay() {
        if (currentDateBadge) {
            const now = new Date();
            const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
            currentDateBadge.innerHTML = `<i class="fas fa-calendar-alt"></i> ${now.toLocaleDateString('en-US', options)}`;
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
        const cardTeacherMeetings = document.getElementById('cardTeacherMeetingsFilter');
        if (cardTeacherMeetings) {
            cardTeacherMeetings.addEventListener('click', () => {
                setActiveTab('teacher_meetings');
            });
        }

        const cardPtaMeetings = document.getElementById('cardPtaMeetingsFilter');
        if (cardPtaMeetings) {
            cardPtaMeetings.addEventListener('click', () => {
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

        // Modal Controls
        if (openPostModalBtn) {
            openPostModalBtn.addEventListener('click', () => {
                if (postModal) postModal.style.display = 'flex';
            });
        }

        if (closePostModalBtn) {
            closePostModalBtn.addEventListener('click', () => {
                if (postModal) postModal.style.display = 'none';
            });
        }

        if (cancelPostBtn) {
            cancelPostBtn.addEventListener('click', () => {
                if (postModal) postModal.style.display = 'none';
            });
        }

        // Meeting Type toggle inside post modal
        if (postMeetingType) {
            postMeetingType.addEventListener('change', (e) => {
                const isNone = e.target.value === 'none';
                document.querySelectorAll('.meeting-fields').forEach(el => {
                    el.style.display = isNone ? 'none' : 'grid';
                });
            });
        }

        // Post Announcement Form Submit
        if (postAnnouncementForm) {
            postAnnouncementForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await handlePostAnnouncement();
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
                targetRole: 'teacher'
            });
            updateStats();
            applyFiltersAndRender();
        } catch (error) {
            console.error('Error loading announcements:', error);
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
        const facultyCount = allAnnouncements.filter(a => 
            a.meeting_type === 'faculty_meeting' || a.target_audience === 'teachers'
        ).length;
        const ptaCount = allAnnouncements.filter(a => 
            a.meeting_type === 'pta_assembly' || a.meeting_type === 'homeroom_meeting' || a.target_audience === 'parent_teacher_meeting'
        ).length;

        let pendingCount = 0;
        allAnnouncements.forEach(a => {
            if (a.requires_rsvp) {
                const userRsvp = AnnouncementsService.getUserRSVP(a.id, currentTeacher);
                if (!userRsvp) pendingCount++;
            }
        });

        if (statTotalNotices) statTotalNotices.textContent = total;
        if (statFacultyMeetings) statFacultyMeetings.textContent = facultyCount;
        if (statPtaMeetings) statPtaMeetings.textContent = ptaCount;
        if (statPendingRsvps) statPendingRsvps.textContent = pendingCount;
    }

    function applyFiltersAndRender() {
        if (!feedContainer) return;

        let filtered = [...allAnnouncements];

        // 1. Tab Filter
        if (currentTabFilter === 'teacher_meetings') {
            filtered = filtered.filter(a => 
                a.meeting_type === 'faculty_meeting' || 
                (a.category === 'meeting' && (a.target_audience === 'teachers' || a.target_audience === 'teacher'))
            );
        } else if (currentTabFilter === 'parent_meetings') {
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
                const userRsvp = AnnouncementsService.getUserRSVP(a.id, currentTeacher);
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
            btn.addEventListener('click', async (e) => {
                const ancId = btn.getAttribute('data-id');
                const status = btn.getAttribute('data-status');
                handleRSVP(ancId, status);
            });
        });
    }

    function createAnnouncementCardHtml(item) {
        const isMeeting = item.category === 'meeting' || (item.meeting_type && item.meeting_type !== 'none');
        const userRsvp = AnnouncementsService.getUserRSVP(item.id, currentTeacher);
        const rsvpCounts = AnnouncementsService.getRSVPCounts(item.id);

        // Badge determination
        let audienceBadge = '';
        if (item.target_audience === 'teachers') {
            audienceBadge = '<span class="badge badge-teacher"><i class="fas fa-chalkboard-teacher"></i> Faculty Only</span>';
        } else if (item.target_audience === 'parents') {
            audienceBadge = '<span class="badge badge-parent"><i class="fas fa-user-friends"></i> Parents / PTA</span>';
        } else if (item.target_audience === 'parent_teacher_meeting') {
            audienceBadge = '<span class="badge badge-joint"><i class="fas fa-handshake"></i> Parent-Teacher Conference</span>';
        } else {
            audienceBadge = '<span class="badge badge-all"><i class="fas fa-globe"></i> General Community</span>';
        }

        let priorityBadge = '';
        if (item.priority === 'urgent') {
            priorityBadge = '<span class="badge badge-urgent"><i class="fas fa-exclamation-triangle"></i> Urgent Action</span>';
        } else if (item.priority === 'important') {
            priorityBadge = '<span class="badge badge-important"><i class="fas fa-bell"></i> Important</span>';
        }

        // Formatted Created Date
        let dateFormatted = 'Recently';
        if (item.date_created) {
            const d = new Date(item.date_created);
            dateFormatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }

        // Agenda items
        let agendaHtml = '';
        if (item.agenda && Array.isArray(item.agenda) && item.agenda.length > 0) {
            agendaHtml = `
                <div class="agenda-section">
                    <div class="agenda-title"><i class="fas fa-list-check"></i> Meeting Agenda & Objectives:</div>
                    <ul class="agenda-list">
                        ${item.agenda.map(a => `<li><i class="fas fa-circle-check"></i> <span>${escapeHtml(a)}</span></li>`).join('')}
                    </ul>
                </div>
            `;
        }

        // Meeting details bar
        let meetingDetailsHtml = '';
        if (isMeeting && (item.meeting_date || item.venue || item.meeting_link)) {
            let mDate = item.meeting_date ? new Date(item.meeting_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }) : 'TBA';
            meetingDetailsHtml = `
                <div class="meeting-details-box">
                    <div class="meeting-detail-item">
                        <i class="fas fa-calendar-day text-accent"></i>
                        <div>
                            <strong>Date & Time</strong>
                            <span>${mDate} ${item.meeting_time ? `• ${escapeHtml(item.meeting_time)}` : ''}</span>
                        </div>
                    </div>
                    ${item.venue ? `
                        <div class="meeting-detail-item">
                            <i class="fas fa-location-dot text-blue"></i>
                            <div>
                                <strong>Venue</strong>
                                <span>${escapeHtml(item.venue)}</span>
                            </div>
                        </div>
                    ` : ''}
                    ${item.meeting_link ? `
                        <div class="meeting-detail-item">
                            <i class="fas fa-video text-emerald"></i>
                            <div>
                                <strong>Online Access</strong>
                                <div><a href="${item.meeting_link}" target="_blank" class="link-online-meet"><i class="fas fa-external-link-alt"></i> Join Online Session</a></div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        // RSVP Section
        let rsvpSectionHtml = '';
        if (item.requires_rsvp) {
            const isAttending = userRsvp && userRsvp.status === 'attending';
            const isDeclined = userRsvp && userRsvp.status === 'declined';
            const isAcknowledged = userRsvp && userRsvp.status === 'acknowledged';

            let statusMessage = '<span class="rsvp-status-badge status-pending"><i class="fas fa-clock"></i> RSVP Requested</span>';
            if (isAttending) {
                statusMessage = '<span class="rsvp-status-badge status-confirmed"><i class="fas fa-check-circle"></i> You are attending</span>';
            } else if (isDeclined) {
                statusMessage = '<span class="rsvp-status-badge status-declined"><i class="fas fa-times-circle"></i> Cannot attend</span>';
            } else if (isAcknowledged) {
                statusMessage = '<span class="rsvp-status-badge status-ack"><i class="fas fa-thumbs-up"></i> Acknowledged</span>';
            }

            rsvpSectionHtml = `
                <div class="rsvp-panel">
                    <div class="rsvp-header">
                        <div class="rsvp-summary">
                            <span class="rsvp-badge-count"><i class="fas fa-user-check"></i> ${rsvpCounts.attending} Confirmed Attendees</span>
                            ${statusMessage}
                        </div>
                        <div class="rsvp-actions">
                            <button class="btn-rsvp btn-rsvp-attend ${isAttending ? 'active' : ''}" data-id="${item.id}" data-status="attending">
                                <i class="fas fa-check"></i> ${isAttending ? 'Attending' : 'Attend'}
                            </button>
                            <button class="btn-rsvp btn-rsvp-decline ${isDeclined ? 'active' : ''}" data-id="${item.id}" data-status="declined">
                                <i class="fas fa-times"></i> ${isDeclined ? 'Declined' : 'Cannot Attend'}
                            </button>
                            <button class="btn-rsvp btn-rsvp-ack ${isAcknowledged ? 'active' : ''}" data-id="${item.id}" data-status="acknowledged">
                                <i class="fas fa-thumbs-up"></i> Acknowledge
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="announcement-card ${item.priority === 'urgent' ? 'card-urgent' : ''}" id="anc-card-${item.id}">
                <div class="anc-card-header">
                    <div class="anc-badges">
                        ${audienceBadge}
                        ${priorityBadge}
                        <span class="badge badge-date"><i class="fas fa-clock"></i> ${dateFormatted}</span>
                    </div>
                    <div class="anc-author">
                        <i class="fas fa-user-circle"></i>
                        <span>${escapeHtml(item.author_name || 'Academic Administration')}</span>
                    </div>
                </div>

                <div class="anc-card-body">
                    <h2 class="anc-title">${escapeHtml(item.title)}</h2>
                    <p class="anc-content">${escapeHtml(item.content)}</p>
                    ${meetingDetailsHtml}
                    ${agendaHtml}
                </div>

                ${rsvpSectionHtml}
            </div>
        `;
    }

    function handleRSVP(announcementId, status) {
        try {
            AnnouncementsService.submitRSVP(announcementId, currentTeacher, status);
            showAlert('Your response has been recorded successfully!', 'success');
            updateStats();
            applyFiltersAndRender();
        } catch (e) {
            console.error('RSVP Error:', e);
            showAlert('Failed to record response. Please try again.', 'error');
        }
    }

    async function handlePostAnnouncement() {
        const title = document.getElementById('postTitle').value.trim();
        const content = document.getElementById('postContent').value.trim();
        const target_audience = document.getElementById('postTargetAudience').value;
        const meeting_type = document.getElementById('postMeetingType').value;
        const priority = document.getElementById('postPriority').value;
        const requires_rsvp = document.getElementById('postRequiresRsvp').checked;

        const meeting_date = document.getElementById('postMeetingDate').value;
        const meeting_time = document.getElementById('postMeetingTime').value.trim();
        const venue = document.getElementById('postVenue').value.trim();
        const meeting_link = document.getElementById('postMeetingLink').value.trim();

        if (!title || !content) {
            showAlert('Please fill in both title and description.', 'error');
            return;
        }

        // Split bullet points if any in description as agenda
        const agendaLines = content.split('\n')
            .map(line => line.replace(/^[-*•\d.]+\s*/, '').trim())
            .filter(line => line.length > 5);

        const payload = {
            title,
            content,
            target_audience,
            meeting_type,
            priority,
            requires_rsvp,
            meeting_date,
            meeting_time,
            venue,
            meeting_link,
            author_name: currentTeacher.displayName || currentTeacher.firstName || 'Teacher Adviser',
            author_role: 'teacher',
            agenda: agendaLines.slice(0, 5)
        };

        try {
            await AnnouncementsService.createAnnouncement(payload);
            showAlert('Announcement / Meeting notice posted successfully!', 'success');
            if (postModal) postModal.style.display = 'none';
            if (postAnnouncementForm) postAnnouncementForm.reset();
            await loadAnnouncements();
        } catch (e) {
            console.error('Create announcement error:', e);
            showAlert('Failed to publish announcement. Please try again.', 'error');
        }
    }

    function showAlert(message, type = 'info') {
        if (!alertContainer) return;
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : (type === 'error' ? 'exclamation-circle' : 'info-circle')}"></i>
            <span>${message}</span>
        `;
        alertContainer.appendChild(alertDiv);
        setTimeout(() => {
            alertDiv.style.opacity = '0';
            setTimeout(() => alertDiv.remove(), 300);
        }, 4000);
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

})();
