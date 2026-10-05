/**
 * Admin Announcements & Meetings Management Module
 * Allows administrators to create, edit, delete, broadcast, and track school announcements,
 * faculty meetings, parent-teacher assemblies (PTA), attendee confirmations (RSVPs),
 * and notify the targeted users (from the `users` table) via in-app notifications and Gmail.
 */

import { AnnouncementsService } from '../../js/announcements_service.js';
import { EmailNotificationService } from '../../js/email_service.js';
import { supabase } from '../../supabase/config.js';

(function () {
    'use strict';

    // ===== Audience -> user roles (users.role) =====
    const AUDIENCE_ROLE_MAP = {
        parents: ['parent'],
        teachers: ['teacher'],
        students: ['student'],
        parent_teacher_meeting: ['parent', 'teacher'],
        both: ['parent', 'teacher'],
        all: ['parent', 'teacher', 'student']
    };

    const AUDIENCE_LABELS = {
        parents: 'Parents',
        teachers: 'Teachers',
        students: 'Students',
        parent_teacher_meeting: 'Parents & Teachers',
        both: 'Parents & Teachers',
        all: 'Entire School'
    };

    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // State
    let currentAdmin = null;
    let allAnnouncements = [];
    let currentTabFilter = 'all';
    let currentSearchTerm = '';
    let currentTargetAudience = 'all';
    let currentMeetingTypeFilter = 'all';
    let currentPriorityFilter = 'all';

    // Roster State
    let currentRosterList = [];
    let currentRosterAnnouncement = null;

    // Gmail Broadcast State
    let currentGmailAnnouncement = null;
    let activeGmailEmailData = null;

    // DOM Elements
    const feedContainer = document.getElementById('announcementsFeed');
    const searchInput = document.getElementById('announcementSearch');
    const targetAudienceFilter = document.getElementById('targetAudienceFilter');
    const meetingTypeFilter = document.getElementById('meetingTypeFilter');
    const priorityFilter = document.getElementById('priorityFilter');
    const categoryTabs = document.getElementById('categoryTabs');
    const alertContainer = document.getElementById('alertContainer');
    const currentDateBadge = document.getElementById('currentDateBadge');
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');

    // Stats Elements
    const statTotalNotices = document.getElementById('statTotalNotices');
    const statPtaMeetings = document.getElementById('statPtaMeetings');
    const statFacultyMeetings = document.getElementById('statFacultyMeetings');
    const statTotalRsvps = document.getElementById('statTotalRsvps');

    // Create Modal Elements
    const createModal = document.getElementById('createModal');
    const openCreateModalBtn = document.getElementById('openCreateModalBtn');
    const closeCreateModalBtn = document.getElementById('closeCreateModalBtn');
    const cancelCreateBtn = document.getElementById('cancelCreateBtn');
    const createAnnouncementForm = document.getElementById('createAnnouncementForm');
    const createMeetingType = document.getElementById('createMeetingType');
    const createMeetingFields = document.getElementById('createMeetingFields');
    const addCreateAgendaBtn = document.getElementById('addCreateAgendaBtn');
    const createAgendaList = document.getElementById('createAgendaList');
    const createSendGmailNotice = document.getElementById('createSendGmailNotice');
    const createGmailOptions = document.getElementById('createGmailOptions');
    const createGmailAudience = document.getElementById('createGmailAudience');
    const createGmailCustomInput = document.getElementById('createGmailCustomInput');

    // Edit Modal Elements
    const editModal = document.getElementById('editModal');
    const closeEditModalBtn = document.getElementById('closeEditModalBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const editAnnouncementForm = document.getElementById('editAnnouncementForm');
    const editMeetingType = document.getElementById('editMeetingType');
    const editMeetingFields = document.getElementById('editMeetingFields');
    const addEditAgendaBtn = document.getElementById('addEditAgendaBtn');
    const editAgendaList = document.getElementById('editAgendaList');

    // Roster Modal Elements
    const rosterModal = document.getElementById('rosterModal');
    const closeRosterModalBtn = document.getElementById('closeRosterModalBtn');
    const closeRosterModalBtn2 = document.getElementById('closeRosterModalBtn2');
    const rosterModalTitle = document.getElementById('rosterModalTitle');
    const rosterMeetingSubtitle = document.getElementById('rosterMeetingSubtitle');
    const rosterTableBody = document.getElementById('rosterTableBody');
    const rosterSearchInput = document.getElementById('rosterSearchInput');
    const rosterStatusFilter = document.getElementById('rosterStatusFilter');
    const exportRosterCsvBtn = document.getElementById('exportRosterCsvBtn');

    // Gmail Broadcast Modal Elements
    const gmailBroadcastModal = document.getElementById('gmailBroadcastModal');
    const closeGmailModalBtn = document.getElementById('closeGmailModalBtn');
    const closeGmailModalBtn2 = document.getElementById('closeGmailModalBtn2');
    const gmailModalSubtitle = document.getElementById('gmailModalSubtitle');
    const gmailBroadcastAudience = document.getElementById('gmailBroadcastAudience');
    const gmailRecipientCountText = document.getElementById('gmailRecipientCountText');
    const gmailCustomEmailWrap = document.getElementById('gmailCustomEmailWrap');
    const gmailCustomEmailInput = document.getElementById('gmailCustomEmailInput');
    const gmailPreviewBox = document.getElementById('gmailPreviewBox');
    const copyGmailPreviewBtn = document.getElementById('copyGmailPreviewBtn');
    const gmailMailtoBtn = document.getElementById('gmailMailtoBtn');
    const launchGmailWebBtn = document.getElementById('launchGmailWebBtn');

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
                currentAdmin = JSON.parse(rawUser);
            }
        } catch (e) {
            console.warn('Session parse note:', e);
        }

        if (!currentAdmin) {
            const savedName = localStorage.getItem('hes_admin_name') || 'School Administrator';
            currentAdmin = {
                id: 'admin-current',
                displayName: savedName,
                firstName: savedName,
                role: 'admin',
                email: 'admin@hiraya.edu.ph'
            };
        }
    }

    function getAdminDisplayName() {
        if (!currentAdmin) return 'Administrator';
        if (currentAdmin.displayName) return currentAdmin.displayName;
        const full = [currentAdmin.first_name || currentAdmin.firstName, currentAdmin.last_name || currentAdmin.lastName]
            .filter(Boolean).join(' ').trim();
        return full || 'Administrator';
    }

    function initDateDisplay() {
        if (currentDateBadge) {
            const now = new Date();
            const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
            currentDateBadge.innerHTML = `<i class="fas fa-calendar-alt"></i> ${now.toLocaleDateString('en-US', options)}`;
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

        // Quick KPI filter clicks
        const cardPtaFilter = document.getElementById('cardPtaFilter');
        if (cardPtaFilter) {
            cardPtaFilter.addEventListener('click', () => {
                setActiveTab('parent_meetings');
            });
        }

        const cardFacultyFilter = document.getElementById('cardFacultyFilter');
        if (cardFacultyFilter) {
            cardFacultyFilter.addEventListener('click', () => {
                setActiveTab('teacher_meetings');
            });
        }

        // Search input
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                currentSearchTerm = e.target.value.trim().toLowerCase();
                applyFiltersAndRender();
            });
        }

        // Select filters
        if (targetAudienceFilter) {
            targetAudienceFilter.addEventListener('change', (e) => {
                currentTargetAudience = e.target.value;
                applyFiltersAndRender();
            });
        }

        if (meetingTypeFilter) {
            meetingTypeFilter.addEventListener('change', (e) => {
                currentMeetingTypeFilter = e.target.value;
                applyFiltersAndRender();
            });
        }

        if (priorityFilter) {
            priorityFilter.addEventListener('change', (e) => {
                currentPriorityFilter = e.target.value;
                applyFiltersAndRender();
            });
        }

        // Create Modal Controls
        if (openCreateModalBtn) {
            openCreateModalBtn.addEventListener('click', () => {
                if (createModal) {
                    createModal.style.display = 'flex';
                    const dateInput = document.getElementById('createMeetingDate');
                    if (dateInput && !dateInput.value) {
                        const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                        dateInput.value = nextWeek.toISOString().split('T')[0];
                    }
                }
            });
        }

        if (closeCreateModalBtn) {
            closeCreateModalBtn.addEventListener('click', () => {
                if (createModal) createModal.style.display = 'none';
            });
        }

        if (cancelCreateBtn) {
            cancelCreateBtn.addEventListener('click', () => {
                if (createModal) createModal.style.display = 'none';
            });
        }

        // Toggle Meeting fields on type change
        if (createMeetingType) {
            createMeetingType.addEventListener('change', (e) => {
                const isNone = e.target.value === 'none';
                if (createMeetingFields) {
                    createMeetingFields.style.display = isNone ? 'none' : 'block';
                }
            });
        }

        // Create Gmail Toggle
        if (createSendGmailNotice) {
            createSendGmailNotice.addEventListener('change', (e) => {
                if (createGmailOptions) {
                    createGmailOptions.style.display = e.target.checked ? 'block' : 'none';
                }
            });
        }

        if (createGmailAudience) {
            createGmailAudience.addEventListener('change', (e) => {
                if (createGmailCustomInput) {
                    createGmailCustomInput.style.display = e.target.value === 'custom' ? 'block' : 'none';
                }
            });
        }

        // Dynamic Agenda Builder for Create Modal
        if (addCreateAgendaBtn && createAgendaList) {
            addCreateAgendaBtn.addEventListener('click', () => {
                addAgendaItemRow(createAgendaList);
            });
            createAgendaList.addEventListener('click', (e) => {
                if (e.target.classList.contains('btn-remove-agenda')) {
                    const row = e.target.closest('.agenda-input-row');
                    if (row && createAgendaList.children.length > 1) {
                        row.remove();
                    } else if (row) {
                        row.querySelector('input').value = '';
                    }
                }
            });
        }

        // Form Submit: Create Announcement
        if (createAnnouncementForm) {
            createAnnouncementForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await handleCreateAnnouncement();
            });
        }

        // Edit Modal Controls
        if (closeEditModalBtn) {
            closeEditModalBtn.addEventListener('click', () => {
                if (editModal) editModal.style.display = 'none';
            });
        }

        if (cancelEditBtn) {
            cancelEditBtn.addEventListener('click', () => {
                if (editModal) editModal.style.display = 'none';
            });
        }

        if (editMeetingType) {
            editMeetingType.addEventListener('change', (e) => {
                const isNone = e.target.value === 'none';
                if (editMeetingFields) {
                    editMeetingFields.style.display = isNone ? 'none' : 'block';
                }
            });
        }

        // Dynamic Agenda Builder for Edit Modal
        if (addEditAgendaBtn && editAgendaList) {
            addEditAgendaBtn.addEventListener('click', () => {
                addAgendaItemRow(editAgendaList);
            });
            editAgendaList.addEventListener('click', (e) => {
                if (e.target.classList.contains('btn-remove-agenda')) {
                    const row = e.target.closest('.agenda-input-row');
                    if (row && editAgendaList.children.length > 1) {
                        row.remove();
                    } else if (row) {
                        row.querySelector('input').value = '';
                    }
                }
            });
        }

        // Form Submit: Edit Announcement
        if (editAnnouncementForm) {
            editAnnouncementForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await handleUpdateAnnouncement();
            });
        }

        // Roster Modal Controls
        if (closeRosterModalBtn) {
            closeRosterModalBtn.addEventListener('click', () => {
                if (rosterModal) rosterModal.style.display = 'none';
            });
        }

        if (closeRosterModalBtn2) {
            closeRosterModalBtn2.addEventListener('click', () => {
                if (rosterModal) rosterModal.style.display = 'none';
            });
        }

        if (rosterSearchInput) {
            rosterSearchInput.addEventListener('input', renderRosterTable);
        }

        if (rosterStatusFilter) {
            rosterStatusFilter.addEventListener('change', renderRosterTable);
        }

        if (exportRosterCsvBtn) {
            exportRosterCsvBtn.addEventListener('click', exportRosterToCsv);
        }

        // Gmail Broadcast Modal Controls
        if (closeGmailModalBtn) {
            closeGmailModalBtn.addEventListener('click', () => {
                if (gmailBroadcastModal) gmailBroadcastModal.style.display = 'none';
            });
        }

        if (closeGmailModalBtn2) {
            closeGmailModalBtn2.addEventListener('click', () => {
                if (gmailBroadcastModal) gmailBroadcastModal.style.display = 'none';
            });
        }

        if (gmailBroadcastAudience) {
            gmailBroadcastAudience.addEventListener('change', updateGmailModalPreview);
        }

        if (gmailCustomEmailInput) {
            gmailCustomEmailInput.addEventListener('input', updateGmailModalPreview);
        }

        if (copyGmailPreviewBtn) {
            copyGmailPreviewBtn.addEventListener('click', async () => {
                if (activeGmailEmailData) {
                    const ok = await EmailNotificationService.copyEmailText(activeGmailEmailData);
                    if (ok) showAlert('📋 Meeting email text copied to clipboard!', 'success');
                }
            });
        }

        if (launchGmailWebBtn) {
            launchGmailWebBtn.addEventListener('click', () => {
                if (activeGmailEmailData) {
                    EmailNotificationService.sendViaGmailWeb(activeGmailEmailData);
                    showAlert('📧 Opening Gmail compose in a new tab...', 'success');
                    if (gmailBroadcastModal) gmailBroadcastModal.style.display = 'none';
                }
            });
        }

        if (gmailMailtoBtn) {
            gmailMailtoBtn.addEventListener('click', () => {
                if (activeGmailEmailData) {
                    EmailNotificationService.sendViaMailto(activeGmailEmailData);
                }
            });
        }
    }

    function addAgendaItemRow(container, value = '') {
        const row = document.createElement('div');
        row.className = 'agenda-input-row';
        row.innerHTML = `
            <input type="text" class="form-input agenda-item-input" placeholder="e.g. Next Agenda Topic..." value="${escapeHtml(value)}">
            <button type="button" class="btn-remove-agenda" title="Remove">&times;</button>
        `;
        container.appendChild(row);
        row.querySelector('input').focus();
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
                targetRole: 'admin'
            });
            updateStats();
            applyFiltersAndRender();
        } catch (error) {
            console.error('Error loading admin announcements:', error);
            if (feedContainer) {
                feedContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h3>Unable to load notices</h3>
                        <p>Please check your connection or database configuration and refresh.</p>
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
        const facultyCount = allAnnouncements.filter(a =>
            a.meeting_type === 'faculty_meeting' || a.meeting_type === 'department_meeting' || a.target_audience === 'teachers'
        ).length;

        let totalRsvps = 0;
        allAnnouncements.forEach(a => {
            const counts = AnnouncementsService.getRSVPCounts(a.id);
            totalRsvps += counts.attending;
        });

        if (statTotalNotices) statTotalNotices.textContent = total;
        if (statPtaMeetings) statPtaMeetings.textContent = ptaCount;
        if (statFacultyMeetings) statFacultyMeetings.textContent = facultyCount;
        if (statTotalRsvps) statTotalRsvps.textContent = totalRsvps;
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
        } else if (currentTabFilter === 'teacher_meetings') {
            filtered = filtered.filter(a =>
                a.meeting_type === 'faculty_meeting' ||
                a.meeting_type === 'department_meeting' ||
                a.target_audience === 'teachers'
            );
        } else if (currentTabFilter === 'general') {
            filtered = filtered.filter(a => a.category === 'general' || a.meeting_type === 'none');
        } else if (currentTabFilter === 'urgent') {
            filtered = filtered.filter(a => (a.priority || '').toLowerCase() === 'urgent');
        }

        // 2. Target Audience Select Filter
        if (currentTargetAudience !== 'all') {
            filtered = filtered.filter(a => (a.target_audience || 'all').toLowerCase() === currentTargetAudience.toLowerCase());
        }

        // 3. Meeting Type Select Filter
        if (currentMeetingTypeFilter !== 'all') {
            filtered = filtered.filter(a => a.meeting_type === currentMeetingTypeFilter);
        }

        // 4. Priority Select Filter
        if (currentPriorityFilter !== 'all') {
            filtered = filtered.filter(a => (a.priority || 'normal').toLowerCase() === currentPriorityFilter.toLowerCase());
        }

        // 5. Search Filter
        if (currentSearchTerm) {
            filtered = filtered.filter(a =>
                (a.title || '').toLowerCase().includes(currentSearchTerm) ||
                (a.content || '').toLowerCase().includes(currentSearchTerm) ||
                (a.venue || '').toLowerCase().includes(currentSearchTerm) ||
                (a.author_name || '').toLowerCase().includes(currentSearchTerm) ||
                (Array.isArray(a.agenda) && a.agenda.some(item => String(item).toLowerCase().includes(currentSearchTerm)))
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

        // Attach action listeners
        feedContainer.querySelectorAll('.btn-edit-action').forEach(btn => {
            btn.addEventListener('click', () => {
                openEditModal(btn.getAttribute('data-id'));
            });
        });

        feedContainer.querySelectorAll('.btn-delete-action').forEach(btn => {
            btn.addEventListener('click', () => {
                handleDeleteAnnouncement(btn.getAttribute('data-id'));
            });
        });

        feedContainer.querySelectorAll('.btn-view-roster').forEach(btn => {
            btn.addEventListener('click', () => {
                openRosterModal(btn.getAttribute('data-id'));
            });
        });

        feedContainer.querySelectorAll('.btn-gmail-action').forEach(btn => {
            btn.addEventListener('click', () => {
                openGmailBroadcastModal(btn.getAttribute('data-id'));
            });
        });
    }

    function createAnnouncementCardHtml(item) {
        const isMeeting = item.category === 'meeting' || (item.meeting_type && item.meeting_type !== 'none');
        const rsvpCounts = AnnouncementsService.getRSVPCounts(item.id);

        // Target audience badge
        let audienceBadge = '';
        if (item.target_audience === 'parents') {
            audienceBadge = '<span class="badge badge-parent"><i class="fas fa-user-friends"></i> Parents / PTA</span>';
        } else if (item.target_audience === 'teachers') {
            audienceBadge = '<span class="badge badge-teacher"><i class="fas fa-chalkboard-teacher"></i> Faculty & Staff</span>';
        } else if (item.target_audience === 'parent_teacher_meeting') {
            audienceBadge = '<span class="badge badge-joint"><i class="fas fa-handshake"></i> Parent-Teacher Conference</span>';
        } else if (item.target_audience === 'students') {
            audienceBadge = '<span class="badge badge-teacher"><i class="fas fa-user-graduate"></i> Students</span>';
        } else {
            audienceBadge = '<span class="badge badge-all"><i class="fas fa-school"></i> School-Wide Notice</span>';
        }

        // Priority badge
        let priorityBadge = '';
        if (item.priority === 'urgent') {
            priorityBadge = '<span class="badge badge-urgent"><i class="fas fa-fire"></i> Urgent</span>';
        } else if (item.priority === 'important') {
            priorityBadge = '<span class="badge badge-important"><i class="fas fa-exclamation-circle"></i> Important</span>';
        }

        // Meeting type badge
        let meetingBadge = '';
        if (item.meeting_type === 'pta_assembly') {
            meetingBadge = '<span class="badge badge-meeting"><i class="fas fa-users"></i> General PTA Assembly</span>';
        } else if (item.meeting_type === 'faculty_meeting') {
            meetingBadge = '<span class="badge badge-meeting"><i class="fas fa-chalkboard-teacher"></i> Faculty Meeting</span>';
        } else if (item.meeting_type === 'homeroom_meeting') {
            meetingBadge = '<span class="badge badge-meeting"><i class="fas fa-door-open"></i> Homeroom Conference</span>';
        } else if (item.meeting_type === 'department_meeting') {
            meetingBadge = '<span class="badge badge-meeting"><i class="fas fa-sitemap"></i> Department Session</span>';
        } else if (item.meeting_type === 'emergency_meeting') {
            meetingBadge = '<span class="badge badge-urgent"><i class="fas fa-exclamation-triangle"></i> Emergency Meeting</span>';
        } else if (isMeeting) {
            meetingBadge = '<span class="badge badge-meeting"><i class="fas fa-calendar-alt"></i> Scheduled Meeting</span>';
        }

        // Date formatting
        let dateFormatted = 'Recently';
        if (item.date_created) {
            try {
                const d = new Date(item.date_created);
                dateFormatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            } catch (e) { }
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
            } catch (e) { }

            const safeLink = /^https?:\/\//i.test(item.meeting_link || '') ? item.meeting_link : '';

            meetingBoxHtml = `
                <div class="meeting-schedule-card">
                    <div class="meeting-detail-row">
                        <div class="detail-item">
                            <i class="fas fa-calendar-day text-accent"></i>
                            <div>
                                <small>Date</small>
                                <strong>${escapeHtml(meetingDateStr)}</strong>
                            </div>
                        </div>
                        <div class="detail-item">
                            <i class="fas fa-clock text-accent"></i>
                            <div>
                                <small>Time</small>
                                <strong>${escapeHtml(item.meeting_time || 'Check Details')}</strong>
                            </div>
                        </div>
                        <div class="detail-item">
                            <i class="fas fa-map-marker-alt text-danger"></i>
                            <div>
                                <small>Venue / Classroom</small>
                                <strong>${escapeHtml(item.venue || 'Campus Assigned Room')}</strong>
                            </div>
                        </div>
                    </div>
                    ${safeLink ? `
                        <div class="meeting-link-box">
                            <span style="font-size: 13px; color: var(--text-secondary);"><i class="fas fa-video text-accent"></i> Online Meeting URL:</span>
                            <a href="${escapeHtml(safeLink)}" target="_blank" rel="noopener noreferrer" class="btn-join-meet">
                                <i class="fas fa-external-link-alt"></i> Open Google Meet / Video Link
                            </a>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        // Agenda checklist HTML
        let agendaHtml = '';
        if (item.agenda && Array.isArray(item.agenda) && item.agenda.length > 0) {
            agendaHtml = `
                <div class="agenda-section">
                    <h4><i class="fas fa-list-check"></i> Meeting Agenda:</h4>
                    <ul class="agenda-list">
                        ${item.agenda.map(point => `<li><i class="fas fa-check-circle"></i> <span>${escapeHtml(point)}</span></li>`).join('')}
                    </ul>
                </div>
            `;
        }

        // Admin RSVP Summary Box
        let rsvpSectionHtml = '';
        if (item.requires_rsvp) {
            rsvpSectionHtml = `
                <div class="admin-rsvp-summary-box">
                    <div class="rsvp-stat-pills">
                        <span class="rsvp-pill attending"><i class="fas fa-user-check"></i> <strong>${rsvpCounts.attending}</strong> Attending</span>
                        <span class="rsvp-pill declined"><i class="fas fa-user-times"></i> <strong>${rsvpCounts.declined}</strong> Declined</span>
                        <span class="rsvp-pill total"><i class="fas fa-users"></i> <strong>${rsvpCounts.total}</strong> Total Responses</span>
                    </div>
                    <button type="button" class="btn-view-roster" data-id="${escapeHtml(item.id)}">
                        <i class="fas fa-clipboard-list"></i> View Attendees Roster
                    </button>
                </div>
            `;
        }

        return `
            <div class="announcement-card ${item.priority === 'urgent' ? 'card-urgent' : (item.target_audience === 'parents' ? 'card-pta' : (isMeeting ? 'meeting-card' : ''))}" id="anc-card-${escapeHtml(item.id)}">
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
                    <div class="card-header-row">
                        <h3 class="card-title">${escapeHtml(item.title)}</h3>
                        <div class="card-actions-dropdown">
                            <button type="button" class="btn-card-action btn-gmail-action" data-id="${escapeHtml(item.id)}" title="Notify Attendees via Gmail (For Necessary Meetings)" style="background: #fef2f2; color: #991b1b; border: 1px solid #fecaca;">
                                <i class="fab fa-google" style="color: #EA4335;"></i> Notify via Gmail
                            </button>
                            <button type="button" class="btn-card-action btn-edit-action" data-id="${escapeHtml(item.id)}" title="Edit Announcement">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button type="button" class="btn-card-action btn-delete-action" data-id="${escapeHtml(item.id)}" title="Delete Announcement">
                                <i class="fas fa-trash-alt"></i> Delete
                            </button>
                        </div>
                    </div>

                    <div class="card-author">
                        <i class="fas fa-user-shield"></i> Posted by: <strong>${escapeHtml(item.author_name || 'Administration')}</strong> (${escapeHtml(item.author_role || 'Admin')})
                    </div>

                    <p class="card-body-text">${escapeHtml(item.content)}</p>

                    ${meetingBoxHtml}
                    ${agendaHtml}
                    ${rsvpSectionHtml}
                </div>
            </div>
        `;
    }

    // =====================================================================
    // AUDIENCE RESOLUTION (users table)
    // =====================================================================

    /**
     * Returns the users from the `users` table whose role matches the Target Audience.
     * NOTE: the password column is intentionally never selected.
     */
    async function getAudienceUsers(audienceType = 'parents') {
        const roles = AUDIENCE_ROLE_MAP[audienceType] || AUDIENCE_ROLE_MAP.parents;
        try {
            const { data, error } = await supabase
                .from('users')
                .select('id, email, first_name, last_name, role')
                .in('role', roles);

            if (error) throw error;
            return data || [];
        } catch (e) {
            console.error('Failed to load audience users from users table:', e);
            return [];
        }
    }

    /** Valid, de-duplicated Gmail recipients for the Target Audience. */
    async function getAudienceEmails(audienceType = 'parents') {
        const users = await getAudienceUsers(audienceType);
        const emails = users
            .map(u => (u.email || '').trim())
            .filter(e => EMAIL_RE.test(e));
        return [...new Set(emails)];
    }

    /**
     * Creates one in-app notification row per targeted user.
     * Returns the number of users notified.
     */
    async function notifyTargetUsers(announcement) {
        const users = await getAudienceUsers(announcement.target_audience);
        if (users.length === 0) return 0;

        const isMeeting = announcement.meeting_type && announcement.meeting_type !== 'none';
        let message = announcement.content || '';
        if (isMeeting) {
            const schedule = [announcement.meeting_date, announcement.meeting_time, announcement.venue]
                .filter(Boolean).join(' • ');
            if (schedule) message = `${schedule}\n${message}`;
        }

        const rows = users.map(u => ({
            user_id: u.id,
            role: u.role,
            announcement_id: String(announcement.id),
            type: isMeeting ? 'meeting' : 'announcement',
            title: announcement.title,
            message: message.slice(0, 500),
            priority: announcement.priority || 'normal',
            read: false,
            is_read: false
        }));

        // Insert in chunks to stay within request limits
        for (let i = 0; i < rows.length; i += 500) {
            const { error } = await supabase.from('notifications').insert(rows.slice(i, i + 500));
            if (error) throw error;
        }
        return rows.length;
    }

    // =====================================================================
    // CREATE
    // =====================================================================

    async function handleCreateAnnouncement() {
        const title = document.getElementById('createTitle').value.trim();
        const category = document.getElementById('createCategory').value;
        const target_audience = document.getElementById('createTargetAudience').value;
        const meeting_type = document.getElementById('createMeetingType').value;
        const meeting_date = document.getElementById('createMeetingDate').value;
        const meeting_time = document.getElementById('createMeetingTime').value.trim();
        const venue = document.getElementById('createVenue').value.trim();
        const meeting_link = document.getElementById('createMeetingLink').value.trim();
        const content = document.getElementById('createContent').value.trim();
        const priority = document.getElementById('createPriority').value;
        const requires_rsvp = document.getElementById('createRequiresRsvp').checked;
        const sendGmail = createSendGmailNotice ? createSendGmailNotice.checked : false;

        // Collect agenda items
        const agenda = [];
        if (createAgendaList) {
            createAgendaList.querySelectorAll('.agenda-item-input').forEach(input => {
                const val = input.value.trim();
                if (val) agenda.push(val);
            });
        }

        if (!title || !content) {
            showAlert('Please fill in both the announcement title and details.', 'error');
            return;
        }

        const payload = {
            title,
            category,
            target_audience,
            meeting_type,
            meeting_date,
            meeting_time,
            venue,
            meeting_link,
            content,
            priority,
            requires_rsvp,
            agenda,
            author_name: getAdminDisplayName(),
            author_role: 'admin',
            author_id: currentAdmin ? currentAdmin.id : null
        };

        try {
            const created = await AnnouncementsService.createAnnouncement(payload);

            // 1) In-app notifications to every user matching the Target Audience
            let notifiedCount = 0;
            let notifyFailed = false;
            try {
                notifiedCount = await notifyTargetUsers(created);
            } catch (notifyErr) {
                notifyFailed = true;
                console.error('Notification dispatch failed:', notifyErr);
            }

            if (notifyFailed) {
                showAlert(`Published "${created.title}", but the in-app notifications could not be sent. Check the notifications table.`, 'error');
            } else {
                showAlert(`Published "${created.title}" and notified ${notifiedCount} user(s) (${AUDIENCE_LABELS[target_audience] || target_audience}).`, 'success');
            }

            // 2) Optional Gmail notice for necessary meetings
            if (sendGmail) {
                const audienceSetting = createGmailAudience ? createGmailAudience.value : 'auto';
                let targetEmailsGroup = target_audience;
                let toEmail = '';
                let bccEmails = [];

                if (audienceSetting === 'custom') {
                    toEmail = (createGmailCustomInput ? createGmailCustomInput.value : '').trim();
                } else {
                    if (audienceSetting !== 'auto') targetEmailsGroup = audienceSetting;
                    bccEmails = await getAudienceEmails(targetEmailsGroup);
                }

                const emailData = EmailNotificationService.buildMeetingAnnouncementEmail({
                    title: created.title,
                    content: created.content,
                    category: created.category,
                    target_audience: created.target_audience,
                    meeting_type: created.meeting_type,
                    priority: created.priority,
                    meeting_date: created.meeting_date,
                    meeting_time: created.meeting_time,
                    venue: created.venue,
                    meeting_link: created.meeting_link,
                    agenda: created.agenda,
                    author_name: created.author_name,
                    requires_rsvp: created.requires_rsvp,
                    toEmail,
                    bccEmails
                });

                EmailNotificationService.sendViaGmailWeb(emailData);
                showAlert(`📧 Opening Gmail compose to broadcast to ${bccEmails.length || 1} recipient(s)...`, 'info');
            }

            if (createAnnouncementForm) createAnnouncementForm.reset();
            if (createGmailOptions) createGmailOptions.style.display = 'none';
            if (createGmailCustomInput) createGmailCustomInput.style.display = 'none';
            if (createMeetingFields) createMeetingFields.style.display = 'block';
            if (createModal) createModal.style.display = 'none';
            await loadAnnouncements();
        } catch (e) {
            console.error('Create announcement error:', e);
            showAlert('Failed to publish announcement. Please try again.', 'error');
        }
    }

    // =====================================================================
    // EDIT
    // =====================================================================

    function openEditModal(id) {
        const item = allAnnouncements.find(a => String(a.id) === String(id));
        if (!item) return;

        document.getElementById('editAnnouncementId').value = item.id;
        document.getElementById('editTitle').value = item.title || '';
        document.getElementById('editCategory').value = item.category || 'meeting';
        document.getElementById('editTargetAudience').value = item.target_audience || 'all';
        document.getElementById('editMeetingType').value = item.meeting_type || 'none';
        document.getElementById('editMeetingDate').value = item.meeting_date || '';
        document.getElementById('editMeetingTime').value = item.meeting_time || '';
        document.getElementById('editVenue').value = item.venue || '';
        document.getElementById('editMeetingLink').value = item.meeting_link || '';
        document.getElementById('editContent').value = item.content || '';
        document.getElementById('editPriority').value = item.priority || 'normal';
        document.getElementById('editRequiresRsvp').checked = Boolean(item.requires_rsvp);

        // Show/hide meeting fields
        if (editMeetingFields) {
            editMeetingFields.style.display = (item.meeting_type || 'none') === 'none' ? 'none' : 'block';
        }

        // Populate agenda points
        if (editAgendaList) {
            editAgendaList.innerHTML = '';
            if (item.agenda && Array.isArray(item.agenda) && item.agenda.length > 0) {
                item.agenda.forEach(point => addAgendaItemRow(editAgendaList, point));
            } else {
                addAgendaItemRow(editAgendaList, '');
            }
        }

        if (editModal) editModal.style.display = 'flex';
    }

    async function handleUpdateAnnouncement() {
        const id = document.getElementById('editAnnouncementId').value;
        const title = document.getElementById('editTitle').value.trim();
        const category = document.getElementById('editCategory').value;
        const target_audience = document.getElementById('editTargetAudience').value;
        const meeting_type = document.getElementById('editMeetingType').value;
        const meeting_date = document.getElementById('editMeetingDate').value;
        const meeting_time = document.getElementById('editMeetingTime').value.trim();
        const venue = document.getElementById('editVenue').value.trim();
        const meeting_link = document.getElementById('editMeetingLink').value.trim();
        const content = document.getElementById('editContent').value.trim();
        const priority = document.getElementById('editPriority').value;
        const requires_rsvp = document.getElementById('editRequiresRsvp').checked;

        const agenda = [];
        if (editAgendaList) {
            editAgendaList.querySelectorAll('.agenda-item-input').forEach(input => {
                const val = input.value.trim();
                if (val) agenda.push(val);
            });
        }

        if (!title || !content) {
            showAlert('Please fill in both the announcement title and details.', 'error');
            return;
        }

        const payload = {
            title,
            category,
            target_audience,
            meeting_type,
            meeting_date,
            meeting_time,
            venue,
            meeting_link,
            content,
            priority,
            requires_rsvp,
            agenda
        };

        try {
            await AnnouncementsService.updateAnnouncement(id, payload);

            // Keep existing notifications in sync with the edited title/message
            try {
                const isMeeting = meeting_type && meeting_type !== 'none';
                let message = content;
                if (isMeeting) {
                    const schedule = [meeting_date, meeting_time, venue].filter(Boolean).join(' • ');
                    if (schedule) message = `${schedule}\n${content}`;
                }
                await supabase
                    .from('notifications')
                    .update({
                        title,
                        message: message.slice(0, 500),
                        priority,
                        type: isMeeting ? 'meeting' : 'announcement'
                    })
                    .eq('announcement_id', String(id));
            } catch (syncErr) {
                console.warn('Notification sync skipped:', syncErr);
            }

            showAlert('Announcement updated successfully.', 'success');
            if (editModal) editModal.style.display = 'none';
            await loadAnnouncements();
        } catch (e) {
            console.error('Update announcement error:', e);
            showAlert('Failed to update announcement. Please try again.', 'error');
        }
    }

    // =====================================================================
    // DELETE
    // =====================================================================

    async function handleDeleteAnnouncement(id) {
        const item = allAnnouncements.find(a => String(a.id) === String(id));
        const itemTitle = item ? item.title : 'this announcement';

        if (!confirm(`Are you sure you want to delete "${itemTitle}"? This will permanently remove the notice, its user notifications, and all RSVP logs.`)) {
            return;
        }

        try {
            await AnnouncementsService.deleteAnnouncement(id);

            // Remove the matching in-app notifications
            try {
                await supabase.from('notifications').delete().eq('announcement_id', String(id));
            } catch (cleanupErr) {
                console.warn('Notification cleanup skipped:', cleanupErr);
            }

            showAlert('Announcement removed successfully.', 'success');
            await loadAnnouncements();
        } catch (e) {
            console.error('Delete announcement error:', e);
            showAlert('Failed to delete announcement.', 'error');
        }
    }

    // =====================================================================
    // ROSTER
    // =====================================================================

    async function openRosterModal(id) {
        const item = allAnnouncements.find(a => String(a.id) === String(id));
        if (!item) return;

        currentRosterAnnouncement = item;
        if (rosterModalTitle) rosterModalTitle.textContent = `Attendees Roster: ${item.title}`;
        if (rosterMeetingSubtitle) {
            let sched = item.meeting_date || 'Date TBD';
            if (item.meeting_time) sched += ` (${item.meeting_time})`;
            rosterMeetingSubtitle.textContent = `Schedule: ${sched} | Venue: ${item.venue || 'Campus Assigned Room'}`;
        }

        if (rosterSearchInput) rosterSearchInput.value = '';
        if (rosterStatusFilter) rosterStatusFilter.value = 'all';

        // Load RSVPs
        currentRosterList = await AnnouncementsService.getRSVPList(id);
        renderRosterTable();

        if (rosterModal) rosterModal.style.display = 'flex';
    }

    function renderRosterTable() {
        if (!rosterTableBody) return;

        const q = (rosterSearchInput ? rosterSearchInput.value : '').toLowerCase().trim();
        const statusVal = rosterStatusFilter ? rosterStatusFilter.value : 'all';

        let list = [...currentRosterList];

        if (statusVal !== 'all') {
            list = list.filter(r => r.status === statusVal);
        }

        if (q) {
            list = list.filter(r =>
                (r.userName || '').toLowerCase().includes(q) ||
                (r.email || '').toLowerCase().includes(q) ||
                (r.userRole || '').toLowerCase().includes(q)
            );
        }

        if (list.length === 0) {
            rosterTableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 30px; color: var(--text-muted);">
                        <i class="fas fa-user-slash" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
                        No attendee RSVP records found for this filter.
                    </td>
                </tr>
            `;
            return;
        }

        rosterTableBody.innerHTML = list.map((r, idx) => {
            let statusBadge = '<span class="rsvp-pill attending"><i class="fas fa-check"></i> Attending</span>';
            if (r.status === 'declined') {
                statusBadge = '<span class="rsvp-pill declined"><i class="fas fa-times"></i> Cannot Attend</span>';
            }

            let dateFormatted = 'N/A';
            if (r.timestamp) {
                try {
                    const d = new Date(r.timestamp);
                    dateFormatted = d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                } catch (e) { }
            }

            return `
                <tr>
                    <td>${idx + 1}</td>
                    <td><strong>${escapeHtml(r.userName)}</strong></td>
                    <td><span class="badge badge-all">${escapeHtml((r.userRole || '').toUpperCase())}</span></td>
                    <td>${escapeHtml(r.email || '—')}</td>
                    <td>${statusBadge}</td>
                    <td><small style="color: var(--text-muted);">${dateFormatted}</small></td>
                </tr>
            `;
        }).join('');
    }

    function exportRosterToCsv() {
        if (!currentRosterAnnouncement || currentRosterList.length === 0) {
            showAlert('No attendee records available to export.', 'error');
            return;
        }

        const headers = ['#', 'Attendee Name', 'Role', 'Email', 'Response Status', 'Confirmation Timestamp'];
        const rows = currentRosterList.map((r, idx) => [
            idx + 1,
            `"${(r.userName || '').replace(/"/g, '""')}"`,
            `"${(r.userRole || '').replace(/"/g, '""')}"`,
            `"${(r.email || '').replace(/"/g, '""')}"`,
            r.status,
            `"${r.timestamp || ''}"`
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `Meeting_Attendees_Roster_${currentRosterAnnouncement.id}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // =====================================================================
    // GMAIL BROADCAST MODAL
    // =====================================================================

    async function openGmailBroadcastModal(id) {
        const item = allAnnouncements.find(a => String(a.id) === String(id));
        if (!item) return;

        currentGmailAnnouncement = item;

        if (gmailModalSubtitle) {
            gmailModalSubtitle.textContent = `Meeting: "${item.title}" | Target: ${(item.target_audience || 'All').toUpperCase()}`;
        }

        // Default the recipient group from the announcement's Target Audience
        if (gmailBroadcastAudience) {
            const aud = item.target_audience;
            let preset = 'both';
            if (aud === 'parent_teacher_meeting') preset = 'both';
            else if (['parents', 'teachers', 'students', 'all'].includes(aud)) preset = aud;

            // Only set the value if the option exists in the dropdown
            const hasOption = Array.from(gmailBroadcastAudience.options).some(o => o.value === preset);
            gmailBroadcastAudience.value = hasOption ? preset : 'both';
        }

        await updateGmailModalPreview();

        if (gmailBroadcastModal) gmailBroadcastModal.style.display = 'flex';
    }

    async function updateGmailModalPreview() {
        if (!currentGmailAnnouncement) return;

        const audienceChoice = gmailBroadcastAudience ? gmailBroadcastAudience.value : 'parents';
        const isCustom = audienceChoice === 'custom';

        if (gmailCustomEmailWrap) {
            gmailCustomEmailWrap.style.display = isCustom ? 'block' : 'none';
        }

        let toEmail = '';
        let bccEmails = [];

        if (isCustom) {
            toEmail = (gmailCustomEmailInput ? gmailCustomEmailInput.value : '').trim();
            if (gmailRecipientCountText) {
                gmailRecipientCountText.textContent = toEmail ? `1 Custom Recipient (${toEmail})` : 'Enter custom email above';
            }
        } else {
            if (gmailRecipientCountText) gmailRecipientCountText.textContent = 'Fetching recipient emails...';
            bccEmails = await getAudienceEmails(audienceChoice);
            if (gmailRecipientCountText) {
                gmailRecipientCountText.textContent = `${bccEmails.length} Email Recipients (${AUDIENCE_LABELS[audienceChoice] || audienceChoice})`;
            }
        }

        activeGmailEmailData = EmailNotificationService.buildMeetingAnnouncementEmail({
            title: currentGmailAnnouncement.title,
            content: currentGmailAnnouncement.content,
            category: currentGmailAnnouncement.category,
            target_audience: currentGmailAnnouncement.target_audience,
            meeting_type: currentGmailAnnouncement.meeting_type,
            priority: currentGmailAnnouncement.priority,
            meeting_date: currentGmailAnnouncement.meeting_date,
            meeting_time: currentGmailAnnouncement.meeting_time,
            venue: currentGmailAnnouncement.venue,
            meeting_link: currentGmailAnnouncement.meeting_link,
            agenda: currentGmailAnnouncement.agenda,
            author_name: currentGmailAnnouncement.author_name,
            requires_rsvp: currentGmailAnnouncement.requires_rsvp,
            toEmail,
            bccEmails
        });

        if (gmailPreviewBox) {
            const bccDisplay = activeGmailEmailData.bcc
                ? `\nBCC: ${activeGmailEmailData.bcc.substring(0, 80)}${activeGmailEmailData.bcc.length > 80 ? '...' : ''}`
                : '';
            gmailPreviewBox.textContent = `TO: ${activeGmailEmailData.to || '[Recipients via BCC]'}${bccDisplay}\nSUBJECT: ${activeGmailEmailData.subject}\n\n${activeGmailEmailData.body}`;
        }
    }

    // =====================================================================
    // HELPERS
    // =====================================================================

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
            ${type === 'success' ? 'background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0;' : ''}
            ${type === 'error' ? 'background: #fef2f2; color: #991b1b; border: 1px solid #fecaca;' : ''}
            ${type === 'info' ? 'background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe;' : ''}
        `;
        const icon = type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle');
        div.innerHTML = `<i class="fas ${icon}"></i> <span>${escapeHtml(message)}</span>`;
        alertContainer.innerHTML = '';
        alertContainer.appendChild(div);
        setTimeout(() => {
            if (div.parentNode) div.remove();
        }, 6000);
    }

    function escapeHtml(str) {
        if (str === null || str === undefined || str === '') return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
})();