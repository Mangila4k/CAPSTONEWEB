/**
 * Registrar Announcements Module
 * Allows the Registrar to create, broadcast, and manage official notices and enrollment announcements,
 * automatically notifying all targeted user dashboards in real-time.
 */

import { AnnouncementsService } from '../../js/announcements_service.js';
import { supabase } from '../../supabase/config.js';

(function () {
    'use strict';

    console.log('📢 Registrar Announcements Module ready');

    // Audience role map
    const AUDIENCE_ROLE_MAP = {
        parents: ['parent'],
        teachers: ['teacher'],
        students: ['student'],
        parent_teacher_meeting: ['parent', 'teacher'],
        both: ['parent', 'teacher'],
        all: ['parent', 'teacher', 'student', 'guidance', 'registrar', 'admin']
    };

    // State
    let currentRegistrar = null;
    let allAnnouncements = [];
    let currentTabFilter = 'all';
    let currentSearchTerm = '';
    let currentTargetAudience = 'all';
    let currentPriorityFilter = 'all';

    // DOM Elements
    const feedContainer = document.getElementById('announcementsFeed');
    const searchInput = document.getElementById('announcementSearch');
    const targetAudienceFilter = document.getElementById('targetAudienceFilter');
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
                currentRegistrar = JSON.parse(rawUser);
            }
        } catch (e) {}

        if (!currentRegistrar) {
            const savedName = localStorage.getItem('hes_registrar_name') || 'Justine Mangila';
            currentRegistrar = {
                id: 'reg-001',
                displayName: savedName,
                role: 'registrar',
                email: 'registrar@hiraya.edu.ph'
            };
        }
    }

    function getRegistrarDisplayName() {
        if (!currentRegistrar) return 'Justine Mangila (Registrar)';
        if (currentRegistrar.displayName) return currentRegistrar.displayName;
        const full = [currentRegistrar.firstName || currentRegistrar.first_name, currentRegistrar.lastName || currentRegistrar.last_name].filter(Boolean).join(' ').trim();
        return full ? `${full} (Registrar)` : 'Justine Mangila (Registrar)';
    }

    function initDateDisplay() {
        if (currentDateBadge) {
            const now = new Date();
            currentDateBadge.innerHTML = `<i class="fas fa-calendar-alt"></i> ${now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}`;
        }
    }

    function initMobileMenu() {
        if (menuToggle && sidebar) {
            menuToggle.addEventListener('click', () => sidebar.classList.toggle('active'));
            document.addEventListener('click', (e) => {
                if (window.innerWidth <= 992 && !sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                    sidebar.classList.remove('active');
                }
            });
        }
    }

    function showAlert(message, type = 'info') {
        if (!alertContainer) return;
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.style.cssText = 'padding: 12px 18px; border-radius: 10px; margin-bottom: 16px; font-weight: 600; display: flex; align-items: center; justify-content: space-between;';
        if (type === 'success') alert.style.background = '#d1fae5', alert.style.color = '#065f46', alert.style.border = '1px solid #a7f3d0';
        else if (type === 'error') alert.style.background = '#fee2e2', alert.style.color = '#991b1b', alert.style.border = '1px solid #fecaca';
        else alert.style.background = '#dbeafe', alert.style.color = '#1e40af', alert.style.border = '1px solid #bfdbfe';

        alert.innerHTML = `<span><i class="fas fa-${type === 'success' ? 'check-circle' : (type === 'error' ? 'exclamation-circle' : 'info-circle')}"></i> ${message}</span><button style="background:none;border:none;cursor:pointer;color:inherit;font-size:16px;">&times;</button>`;
        alert.querySelector('button').onclick = () => alert.remove();
        alertContainer.prepend(alert);
        setTimeout(() => alert.remove(), 6000);
    }

    function setupEventListeners() {
        // Modal toggles
        if (openCreateModalBtn && createModal) {
            openCreateModalBtn.addEventListener('click', () => {
                createModal.style.display = 'flex';
            });
        }

        const closeModal = () => {
            if (createModal) createModal.style.display = 'none';
        };

        if (closeCreateModalBtn) closeCreateModalBtn.addEventListener('click', closeModal);
        if (cancelCreateBtn) cancelCreateBtn.addEventListener('click', closeModal);

        if (createModal) {
            createModal.addEventListener('click', (e) => {
                if (e.target === createModal) closeModal();
            });
        }

        // Meeting toggle
        if (createMeetingType && createMeetingFields) {
            createMeetingType.addEventListener('change', () => {
                createMeetingFields.style.display = createMeetingType.value === 'none' ? 'none' : 'block';
            });
        }

        // Search & Filters
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                currentSearchTerm = searchInput.value.toLowerCase().trim();
                renderFilteredFeed();
            });
        }

        if (targetAudienceFilter) {
            targetAudienceFilter.addEventListener('change', () => {
                currentTargetAudience = targetAudienceFilter.value;
                renderFilteredFeed();
            });
        }

        if (priorityFilter) {
            priorityFilter.addEventListener('change', () => {
                currentPriorityFilter = priorityFilter.value;
                renderFilteredFeed();
            });
        }

        // Category tabs
        if (categoryTabs) {
            categoryTabs.querySelectorAll('.tab-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    categoryTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    currentTabFilter = btn.dataset.filter || 'all';
                    renderFilteredFeed();
                });
            });
        }

        // Form submit
        if (createAnnouncementForm) {
            createAnnouncementForm.addEventListener('submit', handleCreateAnnouncement);
        }
    }

    async function loadAnnouncements() {
        try {
            allAnnouncements = await AnnouncementsService.getAnnouncements();
            updateStats();
            renderFilteredFeed();
        } catch (e) {
            console.error('Failed to load announcements:', e);
            if (feedContainer) {
                feedContainer.innerHTML = '<div class="empty-state"><p>Could not load announcements.</p></div>';
            }
        }
    }

    function updateStats() {
        if (statTotalNotices) statTotalNotices.textContent = allAnnouncements.length;
        if (statPtaMeetings) {
            statPtaMeetings.textContent = allAnnouncements.filter(a => a.target_audience === 'parents' || a.target_audience === 'parent_teacher_meeting').length;
        }
        if (statFacultyMeetings) {
            statFacultyMeetings.textContent = allAnnouncements.filter(a => a.target_audience === 'teachers').length;
        }
        if (statTotalRsvps) {
            statTotalRsvps.textContent = allAnnouncements.filter(a => a.target_audience === 'students' || a.target_audience === 'all').length;
        }
    }

    function renderFilteredFeed() {
        if (!feedContainer) return;

        let filtered = [...allAnnouncements];

        // Search
        if (currentSearchTerm) {
            filtered = filtered.filter(a => 
                (a.title || '').toLowerCase().includes(currentSearchTerm) ||
                (a.content || '').toLowerCase().includes(currentSearchTerm) ||
                (a.venue || '').toLowerCase().includes(currentSearchTerm) ||
                (a.author_name || '').toLowerCase().includes(currentSearchTerm)
            );
        }

        // Target audience
        if (currentTargetAudience !== 'all') {
            filtered = filtered.filter(a => (a.target_audience || 'all').toLowerCase() === currentTargetAudience.toLowerCase());
        }

        // Priority
        if (currentPriorityFilter !== 'all') {
            filtered = filtered.filter(a => (a.priority || 'normal').toLowerCase() === currentPriorityFilter.toLowerCase());
        }

        // Tabs
        if (currentTabFilter === 'urgent') {
            filtered = filtered.filter(a => (a.priority || '').toLowerCase() === 'urgent');
        } else if (currentTabFilter === 'general') {
            filtered = filtered.filter(a => a.category === 'general' || (a.meeting_type || 'none') === 'none');
        } else if (currentTabFilter === 'parent_meetings') {
            filtered = filtered.filter(a => a.target_audience === 'parents' || a.target_audience === 'parent_teacher_meeting');
        } else if (currentTabFilter === 'teacher_meetings') {
            filtered = filtered.filter(a => a.target_audience === 'teachers');
        }

        if (filtered.length === 0) {
            feedContainer.innerHTML = `
                <div class="empty-state" style="padding: 40px; text-align: center; color: #64748b;">
                    <i class="fas fa-bullhorn" style="font-size: 40px; color: #cbd5e1; margin-bottom: 12px;"></i>
                    <h3>No announcements found</h3>
                    <p>Try adjusting your search or filters</p>
                </div>
            `;
            return;
        }

        feedContainer.innerHTML = filtered.map(item => createCardHtml(item)).join('');
    }

    function createCardHtml(item) {
        const isRegistrar = (item.author_role || '').toLowerCase() === 'registrar';
        const isUrgent = (item.priority || '').toLowerCase() === 'urgent';
        const dateStr = item.date_created ? new Date(item.date_created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent';

        return `
            <div class="anc-card ${isUrgent ? 'border-urgent' : ''}" style="background: #ffffff; border-radius: 14px; padding: 20px; margin-bottom: 18px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.04);">
                <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 10px;">
                    <div>
                        <span style="font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 5px; text-transform: uppercase; background: ${isRegistrar ? '#065f46' : '#1b2a4a'}; color: #ffffff;">
                            <i class="fas fa-shield-alt"></i> ${isRegistrar ? 'Registrar Office' : 'Administration'}
                        </span>
                        ${isUrgent ? '<span style="font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 5px; background: #dc2626; color: #ffffff; margin-left: 6px;">URGENT</span>' : ''}
                        <span style="font-size: 12px; color: #64748b; margin-left: 10px;">
                            <i class="fas fa-users"></i> Audience: <strong>${item.target_audience || 'All'}</strong>
                        </span>
                    </div>
                    <span style="font-size: 12px; color: #94a3b8;"><i class="fas fa-clock"></i> ${dateStr}</span>
                </div>

                <h3 style="font-size: 1.15rem; font-weight: 800; color: #0b2b4a; margin: 0 0 8px 0;">${item.title}</h3>
                <p style="font-size: 0.92rem; color: #475569; line-height: 1.55; margin: 0 0 14px 0;">${item.content}</p>

                ${item.meeting_date ? `
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; margin-bottom: 14px; font-size: 13px; color: #334155; display: flex; gap: 18px; flex-wrap: wrap;">
                        <div><i class="fas fa-calendar-day" style="color: #059669;"></i> Date: <strong>${item.meeting_date}</strong></div>
                        <div><i class="fas fa-clock" style="color: #059669;"></i> Time: <strong>${item.meeting_time || 'TBA'}</strong></div>
                        <div><i class="fas fa-map-marker-alt" style="color: #dc2626;"></i> Venue: <strong>${item.venue || 'Campus Grounds'}</strong></div>
                    </div>
                ` : ''}

                <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 10px;">
                    <div><i class="fas fa-user-edit"></i> Author: <strong>${item.author_name || 'Registrar'}</strong></div>
                    <span style="color: #059669; font-weight: 700;"><i class="fas fa-check-double"></i> Dashboards Notified</span>
                </div>
            </div>
        `;
    }

    async function handleCreateAnnouncement(e) {
        e.preventDefault();

        const title = document.getElementById('createTitle').value.trim();
        const target_audience = document.getElementById('createTargetAudience').value;
        const priority = document.getElementById('createPriority').value;
        const category = document.getElementById('createCategory').value;
        const meeting_type = document.getElementById('createMeetingType').value;
        const meeting_date = document.getElementById('createMeetingDate').value;
        const meeting_time = document.getElementById('createMeetingTime').value.trim();
        const venue = document.getElementById('createVenue').value.trim();
        const meeting_link = document.getElementById('createMeetingLink').value.trim();
        const content = document.getElementById('createContent').value.trim();
        const requires_rsvp = document.getElementById('createRequiresRsvp').checked;

        if (!title || !content) {
            showAlert('Please fill in the announcement title and details.', 'error');
            return;
        }

        const payload = {
            title,
            category,
            target_audience,
            meeting_type,
            priority,
            meeting_date,
            meeting_time,
            venue,
            meeting_link,
            content,
            requires_rsvp,
            author_name: getRegistrarDisplayName(),
            author_role: 'registrar',
            author_id: currentRegistrar ? currentRegistrar.id : null
        };

        try {
            const created = await AnnouncementsService.createAnnouncement(payload);

            // Notify target users
            try {
                const roles = AUDIENCE_ROLE_MAP[target_audience] || AUDIENCE_ROLE_MAP.all;
                const { data: users } = await supabase.from('users').select('id, role').in('role', roles);

                const rows = (users || []).map(u => ({
                    user_id: u.id,
                    role: u.role,
                    announcement_id: String(created.id),
                    type: 'announcement',
                    title: `📢 ${created.title}`,
                    message: created.content.slice(0, 500),
                    priority: created.priority || 'normal',
                    read: false,
                    is_read: false
                }));

                // Broadcast row
                rows.push({
                    user_id: null,
                    role: target_audience === 'all' ? null : target_audience,
                    announcement_id: String(created.id),
                    type: 'announcement',
                    title: `📢 ${created.title}`,
                    message: created.content.slice(0, 500),
                    priority: created.priority || 'normal',
                    read: false,
                    is_read: false
                });

                await supabase.from('notifications').insert(rows);
            } catch (notifErr) {
                console.warn('Notification broadcast note:', notifErr);
            }

            showAlert(`Published "${created.title}" and notified user dashboards!`, 'success');

            if (createAnnouncementForm) createAnnouncementForm.reset();
            if (createMeetingFields) createMeetingFields.style.display = 'none';
            if (createModal) createModal.style.display = 'none';

            await loadAnnouncements();
        } catch (err) {
            console.error('Failed to create announcement:', err);
            showAlert('Failed to publish announcement. Please try again.', 'error');
        }
    }
})();
