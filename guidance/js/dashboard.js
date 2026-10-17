// ===== GUIDANCE DASHBOARD JAVASCRIPT =====
import { supabase } from '../../supabase/config.js';

document.addEventListener('DOMContentLoaded', async function() {
    'use strict';

    // 1. Check Session & Role
    let currentUser = null;
    try {
        const raw = localStorage.getItem('currentUser');
        if (raw) {
            currentUser = JSON.parse(raw);
        }
    } catch (e) {
        console.warn('Session parse warning:', e);
    }

    if (!currentUser) {
        window.location.replace('../auth/login.html');
        return;
    }

    // Set Counselor profile in Sidebar
    const counselorNameEl = document.getElementById('counselorName');
    const counselorAvatarEl = document.getElementById('counselorAvatar');
    const displayName = currentUser.displayName || `${currentUser.firstName || 'Sarah'} ${currentUser.lastName || 'Counselor'}`.trim() || 'Guidance Counselor';
    
    if (counselorNameEl) counselorNameEl.textContent = displayName;
    if (counselorAvatarEl) counselorAvatarEl.textContent = (displayName[0] || 'G').toUpperCase();

    // Mobile Sidebar Toggle
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }

    // Set Current Date in Date Badge
    const dateBadge = document.querySelector('.date-badge, #currentDateDisplay, #dateBadge');
    if (dateBadge) {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateBadge.innerHTML = `<i class="fas fa-calendar-alt"></i> ${now.toLocaleDateString('en-US', options)}`;
    }

    // 2. Fetch Data from Supabase
    await loadDashboardStats();
    await loadRecentViolations();
    await loadUpcomingCounseling();

    // Load Stats
    async function loadDashboardStats() {
        try {
            const { data: violations, error } = await supabase
                .from('student_violations')
                .select('*');

            if (error) throw error;

            const allViolations = violations || [];
            const total = allViolations.length;
            const minor = allViolations.filter(v => (v.violation_category || '').toLowerCase() === 'minor').length;
            const major = allViolations.filter(v => (v.violation_category || '').toLowerCase() === 'major').length;
            const resolved = allViolations.filter(v => (v.status || '').toLowerCase() === 'resolved').length;

            const { data: sessions } = await supabase
                .from('counseling_sessions')
                .select('*');

            const totalSessions = (sessions || []).length;

            document.getElementById('statTotalViolations').textContent = total;
            document.getElementById('statMinorViolations').textContent = minor;
            document.getElementById('statMajorViolations').textContent = major;
            document.getElementById('statCounselingSessions').textContent = totalSessions;
            document.getElementById('statResolvedCases').textContent = resolved;

        } catch (err) {
            console.error('Error fetching stats:', err);
        }
    }

    // Load Recent Violations
    async function loadRecentViolations() {
        const tbody = document.getElementById('recentViolationsTableBody');
        if (!tbody) return;

        try {
            const { data: violations, error } = await supabase
                .from('student_violations')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(6);

            if (error) throw error;

            if (!violations || violations.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">
                            <i class="fas fa-check-circle" style="color: var(--success); font-size: 24px; margin-bottom: 8px; display: block;"></i>
                            No student violation reports recorded yet.
                        </td>
                    </tr>
                `;
                return;
            }

            tbody.innerHTML = violations.map(v => {
                const isMajor = (v.violation_category || '').toLowerCase() === 'major';
                const catBadge = isMajor 
                    ? `<span class="badge badge-major"><i class="fas fa-triangle-exclamation"></i> Major</span>`
                    : `<span class="badge badge-minor"><i class="fas fa-circle-info"></i> Minor</span>`;
                
                let statusClass = 'badge-reported';
                const st = (v.status || 'Reported').toLowerCase();
                if (st.includes('resolved')) statusClass = 'badge-resolved';
                else if (st.includes('counseling')) statusClass = 'badge-counseling';
                else if (st.includes('progress') || st.includes('investigation')) statusClass = 'badge-in-progress';

                const incidentDateStr = v.incident_date ? new Date(v.incident_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent';

                return `
                    <tr>
                        <td>
                            <div class="student-meta">
                                <div class="student-mini-avatar">${(v.student_name || 'S')[0]}</div>
                                <div class="student-info-text">
                                    <strong>${v.student_name || 'Unknown Student'}</strong>
                                    <span>${v.grade_level || 'Grade 11'} · ${v.strand || 'TVL'} (${v.section || 'Class'})</span>
                                </div>
                            </div>
                        </td>
                        <td>
                            <strong style="color: var(--primary); font-size: 13px;">${v.violation_type || 'General Violation'}</strong>
                            <div style="font-size: 11.5px; color: var(--text-muted);">${v.offense_level || '1st Offense'}</div>
                        </td>
                        <td>${catBadge}</td>
                        <td style="font-size: 12.5px; color: var(--text-muted);">${incidentDateStr}</td>
                        <td><span class="badge ${statusClass}">${v.status || 'Reported'}</span></td>
                        <td>
                            <a href="violations.html?id=${v.id}" class="btn-secondary" style="padding: 5px 12px; font-size: 12px;">
                                View <i class="fas fa-arrow-right"></i>
                            </a>
                        </td>
                    </tr>
                `;
            }).join('');

        } catch (err) {
            console.error('Error loading recent violations:', err);
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger);">Failed to load recent violations.</td></tr>`;
        }
    }

    // Load Upcoming Counseling
    async function loadUpcomingCounseling() {
        const container = document.getElementById('upcomingCounselingList');
        if (!container) return;

        try {
            const { data: sessions, error } = await supabase
                .from('counseling_sessions')
                .select('*')
                .order('session_date', { ascending: true })
                .limit(4);

            if (error) throw error;

            if (!sessions || sessions.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 20px; color: var(--text-muted);">
                        <i class="fas fa-calendar-xmark" style="font-size: 24px; margin-bottom: 6px; display: block; opacity: 0.5;"></i>
                        No scheduled sessions at this time.
                    </div>
                `;
                return;
            }

            container.innerHTML = sessions.map(s => {
                const dateObj = new Date(s.session_date);
                const monthStr = dateObj.toLocaleDateString('en-US', { month: 'short' });
                const dayStr = dateObj.getDate();

                return `
                    <div class="counseling-item">
                        <div class="counseling-time-box">
                            <span class="time">${s.session_time || '09:00 AM'}</span>
                            <span class="date">${monthStr} ${dayStr}</span>
                        </div>
                        <div class="counseling-details">
                            <h4>${s.student_name || 'Student'}</h4>
                            <p>${s.session_type || 'Counseling'}: ${s.purpose || 'Behavior guidance'}</p>
                            <span class="badge ${s.status === 'Completed' ? 'badge-resolved' : 'badge-counseling'}" style="font-size: 11px;">
                                ${s.status || 'Scheduled'}
                            </span>
                        </div>
                    </div>
                `;
            }).join('');

        } catch (err) {
            console.error('Error loading counseling sessions:', err);
            container.innerHTML = `<p style="color: var(--danger); font-size: 12px; text-align: center;">Error loading sessions.</p>`;
        }
    }
});
