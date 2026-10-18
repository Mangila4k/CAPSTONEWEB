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

    // 3. Counseling Sessions Logic (Right Sidebar)
    let allCounselingSessions = [];
    let currentCounselingFilter = 'upcoming';

    // Load Upcoming Counseling
    async function loadUpcomingCounseling() {
        const container = document.getElementById('upcomingCounselingList');
        if (!container) return;

        try {
            const { data: sessions, error } = await supabase
                .from('counseling_sessions')
                .select('*')
                .order('session_date', { ascending: true })
                .limit(20);

            if (error) throw error;
            allCounselingSessions = sessions || [];
            renderCounselingList();
            setupCounselingFilterPills();
        } catch (err) {
            console.error('Error loading counseling sessions:', err);
            container.innerHTML = `<p style="color: var(--danger); font-size: 12px; text-align: center;">Error loading sessions.</p>`;
        }
    }

    // Render Counseling List with Filtering
    function renderCounselingList() {
        const container = document.getElementById('upcomingCounselingList');
        if (!container) return;

        let filtered = allCounselingSessions;
        if (currentCounselingFilter === 'upcoming') {
            filtered = allCounselingSessions.filter(s => (s.status || '').toLowerCase() !== 'completed' && (s.status || '').toLowerCase() !== 'cancelled');
        }

        if (!filtered || filtered.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 24px 16px; color: var(--text-muted);">
                    <i class="fas ${currentCounselingFilter === 'upcoming' ? 'fa-calendar-check' : 'fa-calendar-xmark'}" style="font-size: 24px; margin-bottom: 8px; display: block; opacity: 0.6; color: var(--accent);"></i>
                    <p style="margin: 0; font-size: 13px; font-weight: 600;">${currentCounselingFilter === 'upcoming' ? 'No pending upcoming sessions' : 'No counseling records found'}</p>
                    <span style="font-size: 11.5px; opacity: 0.75;">Click "All Records" to review past counseling files.</span>
                </div>
            `;
            return;
        }

        container.innerHTML = filtered.slice(0, 5).map(s => {
            const dateObj = new Date(s.session_date);
            const monthStr = dateObj.toLocaleDateString('en-US', { month: 'short' });
            const dayStr = dateObj.getDate();
            const isCompleted = (s.status || '').toLowerCase() === 'completed';

            return `
                <div class="counseling-item" data-session-id="${s.id}" title="Click to view full counseling details and notes" style="cursor: pointer; transition: all 0.2s ease;">
                    <div class="counseling-time-box">
                        <span class="time">${s.session_time || '09:00 AM'}</span>
                        <span class="date">${monthStr} ${dayStr}</span>
                    </div>
                    <div class="counseling-details" style="flex: 1; min-width: 0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                            <h4 style="margin: 0; font-size: 13.5px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${s.student_name || 'Student'}</h4>
                            <span class="badge ${isCompleted ? 'badge-resolved' : 'badge-counseling'}" style="font-size: 10.5px; flex-shrink: 0;">
                                <i class="fas ${isCompleted ? 'fa-check' : 'fa-clock'}"></i> ${s.status || 'Scheduled'}
                            </span>
                        </div>
                        <p style="margin: 3px 0 0 0; font-size: 12px; color: var(--text-muted); display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;">
                            <strong style="color: var(--primary);">${s.session_type || 'Counseling'}:</strong> ${s.purpose || 'Behavior guidance'}
                        </p>
                    </div>
                    <div style="align-self: center; color: var(--text-muted); font-size: 11px; margin-left: 4px; opacity: 0.6;">
                        <i class="fas fa-chevron-right"></i>
                    </div>
                </div>
            `;
        }).join('');

        // Attach Click to Open Detail Modal
        container.querySelectorAll('.counseling-item').forEach(item => {
            item.addEventListener('click', () => {
                const sid = item.getAttribute('data-session-id');
                const target = allCounselingSessions.find(s => String(s.id) === String(sid));
                if (target) openCounselingDetailModal(target);
            });
        });
    }

    // Filter Pills Event Binding
    function setupCounselingFilterPills() {
        const pills = document.querySelectorAll('#counselingFilterPills .counseling-pill');
        pills.forEach(pill => {
            pill.onclick = (e) => {
                e.stopPropagation();
                pills.forEach(p => {
                    p.classList.remove('active');
                    p.style.background = 'transparent';
                    p.style.color = '#64748b';
                });
                pill.classList.add('active');
                pill.style.background = '#0b2b4a';
                pill.style.color = '#ffffff';
                currentCounselingFilter = pill.getAttribute('data-filter') || 'upcoming';
                renderCounselingList();
            };
        });
    }

    // Counseling Session Detail Modal Viewer
    function openCounselingDetailModal(s) {
        const modal = document.getElementById('counselingDetailModal');
        const modalTitle = document.getElementById('counselingModalTitle');
        const modalBody = document.getElementById('counselingModalBody');
        const statusActions = document.getElementById('counselingModalStatusActions');
        const closeBtn = document.getElementById('closeCounselingModalBtn');
        const dismissBtn = document.getElementById('dismissCounselingModalBtn');

        if (!modal || !modalBody) return;

        const isCompleted = (s.status || '').toLowerCase() === 'completed';
        const sessionDateStr = s.session_date ? new Date(s.session_date).toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
        }) : 'Scheduled Date';

        if (modalTitle) {
            modalTitle.innerHTML = `<i class="fas fa-hand-holding-heart" style="color: var(--accent);"></i> Session: ${s.student_name || 'Student'}`;
        }

        modalBody.innerHTML = `
            <div style="display: flex; align-items: center; gap: 14px; padding: 14px; background: #f8fafc; border-radius: 12px; border: 1px solid var(--border-color); margin-bottom: 18px;">
                <div style="width: 44px; height: 44px; border-radius: 50%; background: #0b2b4a; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px;">
                    ${(s.student_name || 'S')[0].toUpperCase()}
                </div>
                <div style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <h4 style="margin: 0; font-size: 16px; color: var(--primary); font-weight: 700;">${s.student_name || 'Student'}</h4>
                        <span class="badge ${isCompleted ? 'badge-resolved' : 'badge-counseling'}" id="modalSessionStatusBadge" style="font-size: 11px;">
                            <i class="fas ${isCompleted ? 'fa-check' : 'fa-clock'}"></i> ${s.status || 'Scheduled'}
                        </span>
                    </div>
                    <div style="font-size: 12.5px; color: var(--text-muted); margin-top: 2px;">
                        LRN: ${s.lrn || 'N/A'} · ${s.grade_level || 'Grade 11'} (${s.section || 'General'})
                    </div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 18px;">
                <div style="padding: 10px 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <span style="font-size: 11px; color: #94a3b8; display: block; text-transform: uppercase; font-weight: 700;">Date & Time</span>
                    <strong style="font-size: 13px; color: #1e293b;"><i class="fas fa-calendar-day" style="color: var(--accent);"></i> ${sessionDateStr}</strong>
                    <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;"><i class="fas fa-clock"></i> ${s.session_time || '09:00 AM'}</div>
                </div>
                <div style="padding: 10px 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <span style="font-size: 11px; color: #94a3b8; display: block; text-transform: uppercase; font-weight: 700;">Session Type</span>
                    <strong style="font-size: 13px; color: #1e293b;"><i class="fas fa-hand-holding-heart" style="color: #ec4899;"></i> ${s.session_type || 'Individual Counseling'}</strong>
                    <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;"><i class="fas fa-location-dot"></i> Guidance Counseling Room</div>
                </div>
            </div>

            <div style="margin-bottom: 16px;">
                <label style="font-size: 12px; font-weight: 700; color: #475569; display: block; margin-bottom: 4px; text-transform: uppercase;">Focus & Intervention Purpose:</label>
                <div style="padding: 12px 14px; background: #eff6ff; border-radius: 8px; border: 1px solid #bfdbfe; font-size: 13px; color: #1e3a8a; line-height: 1.45;">
                    <i class="fas fa-bullseye" style="color: #3b82f6; margin-right: 6px;"></i> ${s.purpose || 'Behavioral reflection and restorative dialogue.'}
                </div>
            </div>

            <div>
                <label style="font-size: 12px; font-weight: 700; color: #475569; display: block; margin-bottom: 4px; text-transform: uppercase;">Counselor Clinical & Session Notes:</label>
                <div style="padding: 12px 14px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 13px; color: #334155; line-height: 1.5; min-height: 60px;">
                    ${s.notes || 'No counseling notes logged for this session yet. You can update records in the Counseling Sessions manager.'}
                </div>
            </div>
        `;

        if (statusActions) {
            statusActions.innerHTML = `
                <button type="button" class="btn-toggle-session-status" id="btnToggleCounselingStatus" style="font-size: 12.5px; padding: 7px 14px; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-weight: 600; border: 1px solid #cbd5e1; background: ${isCompleted ? '#f1f5f9' : '#10b981'}; color: ${isCompleted ? '#334155' : '#ffffff'};">
                    <i class="fas ${isCompleted ? 'fa-arrow-rotate-left' : 'fa-check'}"></i> 
                    <span>${isCompleted ? 'Return to Scheduled' : 'Mark as Completed'}</span>
                </button>
            `;

            const btnToggle = statusActions.querySelector('#btnToggleCounselingStatus');
            if (btnToggle) {
                btnToggle.onclick = async () => {
                    const newStatus = isCompleted ? 'Scheduled' : 'Completed';
                    s.status = newStatus;
                    try {
                        await supabase.from('counseling_sessions').update({ status: newStatus }).eq('id', s.id);
                    } catch (e) {
                        console.warn('Status update notice:', e);
                    }
                    renderCounselingList();
                    openCounselingDetailModal(s);
                };
            }
        }

        modal.classList.add('active', 'show');

        // Close listeners
        const closeModal = () => modal.classList.remove('active', 'show');
        if (closeBtn) closeBtn.onclick = closeModal;
        if (dismissBtn) dismissBtn.onclick = closeModal;
        modal.onclick = (e) => {
            if (e.target === modal) closeModal();
        };
    }
});
