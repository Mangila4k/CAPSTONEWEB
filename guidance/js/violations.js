// ===== GUIDANCE VIOLATIONS CONTROLLER =====
import { supabase } from '../../supabase/config.js';

document.addEventListener('DOMContentLoaded', async function() {
    'use strict';

    // 1. Check Session & Role
    let currentUser = null;
    try {
        const raw = localStorage.getItem('currentUser');
        if (raw) currentUser = JSON.parse(raw);
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

    // DOM Elements
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const statusFilter = document.getElementById('statusFilter');
    const offenseFilter = document.getElementById('offenseFilter');
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');
    const violationsTableBody = document.getElementById('violationsTableBody');
    const totalCasesCount = document.getElementById('totalCasesCount');
    const alertContainer = document.getElementById('alertContainer');

    // Modals
    const caseModal = document.getElementById('caseModal');
    const closeCaseModalBtn = document.getElementById('closeCaseModalBtn');
    const closeModalBottomBtn = document.getElementById('closeModalBottomBtn');
    const modalCaseBody = document.getElementById('modalCaseBody');
    const saveCaseChangesBtn = document.getElementById('saveCaseChangesBtn');

    const callSlipModal = document.getElementById('callSlipModal');
    const closeCallSlipModalBtn = document.getElementById('closeCallSlipModalBtn');
    const closeCallSlipBottomBtn = document.getElementById('closeCallSlipBottomBtn');
    const callSlipModalBody = document.getElementById('callSlipModalBody');
    const sendCallSlipBtn = document.getElementById('sendCallSlipBtn');

    let allViolations = [];
    let currentActiveCase = null;
    let currentCallSlipViolation = null;

    // Toast Alert
    function showAlert(message, type = 'success') {
        if (!alertContainer) return;
        const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';
        alertContainer.innerHTML = `
            <div class="alert alert-${type}">
                <i class="fas ${icon}"></i>
                <span>${message}</span>
            </div>
        `;
        setTimeout(() => {
            if (alertContainer) alertContainer.innerHTML = '';
        }, 5000);
    }

    // Fetch Violations
    async function loadViolations() {
        try {
            const { data, error } = await supabase
                .from('student_violations')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            allViolations = data || [];
            renderViolations();

            // Check if URL has ?id=...
            const urlParams = new URLSearchParams(window.location.search);
            const targetId = urlParams.get('id');
            if (targetId) {
                const target = allViolations.find(v => v.id === targetId);
                if (target) openCaseModal(target);
            }

        } catch (err) {
            console.error('Error fetching violations:', err);
            violationsTableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--danger); padding: 30px;">Error loading violations.</td></tr>`;
        }
    }

    // Filter & Render
    function renderViolations() {
        const query = (searchInput.value || '').trim().toLowerCase();
        const cat = (categoryFilter.value || 'all').toLowerCase();
        const stat = (statusFilter.value || 'all').toLowerCase();
        const off = (offenseFilter.value || 'all').toLowerCase();

        const filtered = allViolations.filter(v => {
            const matchesQuery = !query || 
                (v.student_name && v.student_name.toLowerCase().includes(query)) ||
                (v.lrn && v.lrn.toLowerCase().includes(query)) ||
                (v.violation_title && v.violation_title.toLowerCase().includes(query)) ||
                (v.violation_type && v.violation_type.toLowerCase().includes(query));

            const matchesCat = cat === 'all' || (v.violation_category || '').toLowerCase() === cat;
            const matchesStat = stat === 'all' || (v.status || '').toLowerCase() === stat;
            const matchesOff = off === 'all' || (v.offense_level || '').toLowerCase() === off;

            return matchesQuery && matchesCat && matchesStat && matchesOff;
        });

        if (totalCasesCount) totalCasesCount.textContent = filtered.length;

        if (filtered.length === 0) {
            violationsTableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 40px;">
                        <i class="fas fa-check-circle" style="font-size: 32px; color: var(--success); margin-bottom: 10px; display: block;"></i>
                        No violations matched your search criteria.
                    </td>
                </tr>
            `;
            return;
        }

        violationsTableBody.innerHTML = filtered.map(v => {
            const isMajor = (v.violation_category || '').toLowerCase() === 'major';
            const catBadge = isMajor 
                ? `<span class="badge badge-major"><i class="fas fa-triangle-exclamation"></i> Major</span>`
                : `<span class="badge badge-minor"><i class="fas fa-circle-info"></i> Minor</span>`;

            let offClass = 'offense-1';
            const offLvl = (v.offense_level || '1st Offense').toLowerCase();
            if (offLvl.includes('2nd')) offClass = 'offense-2';
            else if (offLvl.includes('3rd')) offClass = 'offense-3';
            else if (offLvl.includes('4th')) offClass = 'offense-4';

            let statusClass = 'status-reported';
            let statusIcon = '<i class="fas fa-bell"></i>';
            const st = (v.status || 'Reported').toLowerCase();
            if (st.includes('resolved')) {
                statusClass = 'status-resolved';
                statusIcon = '<i class="fas fa-check-circle"></i>';
            } else if (st.includes('counseling')) {
                statusClass = 'status-counseling';
                statusIcon = '<i class="fas fa-user-clock"></i>';
            } else if (st.includes('progress') || st.includes('investigation')) {
                statusClass = 'status-progress';
                statusIcon = '<i class="fas fa-spinner fa-spin-pulse"></i>';
            }

            const dateStr = v.incident_date ? new Date(v.incident_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
            const initial = (v.student_name || 'S').trim()[0] ? (v.student_name || 'S').trim()[0].toUpperCase() : 'S';
            const gradeStr = v.grade_level || 'Grade 11';
            const strandStr = v.strand ? ` (${v.strand})` : '';

            return `
                <tr>
                    <td>
                        <div class="student-meta">
                            <div class="student-mini-avatar">${initial}</div>
                            <div class="student-info-text">
                                <strong>${v.student_name || 'Unknown Student'}</strong>
                                <div class="student-sub">
                                    <span class="lrn-tag">LRN: ${v.lrn || 'N/A'}</span>
                                    <span class="grade-tag">${gradeStr}${strandStr}</span>
                                </div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <strong class="violation-title">${v.violation_type || 'General Offense'}</strong>
                        <div class="violation-desc" title="${(v.violation_title || v.description || '').replace(/"/g, '&quot;')}">
                            ${v.violation_title || v.description || 'No additional details.'}
                        </div>
                    </td>
                    <td>${catBadge}</td>
                    <td><span class="offense-pill ${offClass}">${v.offense_level || '1st Offense'}</span></td>
                    <td>
                        <div class="date-cell">
                            <i class="far fa-calendar-alt"></i>
                            <span>${dateStr}</span>
                        </div>
                    </td>
                    <td class="reporter-cell">
                        <strong>${v.reported_by || 'Staff'}</strong>
                        <div class="reporter-role">${v.reporter_role || 'Teacher'}</div>
                    </td>
                    <td><span class="status-badge ${statusClass}">${statusIcon} ${v.status || 'Reported'}</span></td>
                    <td style="text-align: right;">
                        <div class="table-actions">
                            <a href="reports.html?student_id=${v.student_id || ''}&tab=student" class="btn-action-icon action-dossier" title="View Full Student Guidance Report">
                                <i class="fas fa-file-lines"></i>
                            </a>
                            <button class="btn-action-icon action-view btn-view-case" data-id="${v.id}" title="View & Manage Incident Case">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn-action-icon action-call-slip btn-call-slip" data-id="${v.id}" title="Send Parent Call Slip">
                                <i class="fas fa-envelope-open-text"></i>
                            </button>
                            <button class="btn-action-icon action-delete btn-delete-case" data-id="${v.id}" title="Delete Record">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Attach event listeners to action buttons
        document.querySelectorAll('.btn-view-case').forEach(btn => {
            btn.addEventListener('click', () => {
                const vid = btn.getAttribute('data-id');
                const target = allViolations.find(v => v.id === vid);
                if (target) openCaseModal(target);
            });
        });

        document.querySelectorAll('.btn-call-slip').forEach(btn => {
            btn.addEventListener('click', () => {
                const vid = btn.getAttribute('data-id');
                const target = allViolations.find(v => v.id === vid);
                if (target) openCallSlipModal(target);
            });
        });

        document.querySelectorAll('.btn-delete-case').forEach(btn => {
            btn.addEventListener('click', () => {
                const vid = btn.getAttribute('data-id');
                deleteCase(vid);
            });
        });
    }

    // Filter Listeners
    searchInput.addEventListener('input', renderViolations);
    categoryFilter.addEventListener('change', renderViolations);
    statusFilter.addEventListener('change', renderViolations);
    offenseFilter.addEventListener('change', renderViolations);

    resetFiltersBtn.addEventListener('click', () => {
        searchInput.value = '';
        categoryFilter.value = 'all';
        statusFilter.value = 'all';
        offenseFilter.value = 'all';
        renderViolations();
    });

    // Open Case Modal
    function openCaseModal(v) {
        currentActiveCase = v;
        const modalCaseTitle = document.getElementById('modalCaseTitle');
        modalCaseTitle.innerHTML = `<i class="fas fa-folder-open"></i> Case #${v.id.substring(0, 8)} - ${v.student_name}`;

        const isMajor = (v.violation_category || '').toLowerCase() === 'major';
        const dateStr = v.incident_date ? new Date(v.incident_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';

        modalCaseBody.innerHTML = `
            <div class="incident-detail-grid">
                <div class="detail-item">
                    <div class="detail-label">Student Information</div>
                    <div class="detail-value">
                        <strong>${v.student_name}</strong><br>
                        <span style="font-size: 12px; color: var(--text-muted);">LRN: ${v.lrn || 'N/A'} · ${v.grade_level || 'Grade 11'} (${v.strand || 'TVL'})</span>
                    </div>
                </div>

                <div class="detail-item">
                    <div class="detail-label">Violation Category & Level</div>
                    <div class="detail-value">
                        <span class="badge ${isMajor ? 'badge-major' : 'badge-minor'}">${v.violation_category || 'Minor'}</span>
                        <span class="offense-pill offense-2" style="margin-left: 6px;">${v.offense_level || '1st Offense'}</span>
                    </div>
                </div>

                <div class="detail-item">
                    <div class="detail-label">Incident Date & Location</div>
                    <div class="detail-value">
                        ${dateStr}<br>
                        <span style="font-size: 12px; color: var(--text-muted);"><i class="fas fa-location-dot"></i> ${v.incident_location || 'Campus Grounds'} (${v.incident_time || 'Class hours'})</span>
                    </div>
                </div>

                <div class="detail-item">
                    <div class="detail-label">Reported By</div>
                    <div class="detail-value">
                        <strong>${v.reported_by}</strong> (${v.reporter_role || 'Teacher'})
                    </div>
                </div>

                <div class="detail-item detail-item-full">
                    <div class="detail-label">Incident Description & Narrative</div>
                    <div class="detail-value" style="background: #fff; border: 1px solid var(--border-color); padding: 10px 12px; border-radius: 6px; font-size: 13px; line-height: 1.5;">
                        ${v.description || 'No detailed narrative provided.'}
                    </div>
                </div>

                ${v.witnesses ? `
                <div class="detail-item detail-item-full">
                    <div class="detail-label">Witnesses / Notes</div>
                    <div class="detail-value" style="font-size: 12.5px;">${v.witnesses}</div>
                </div>
                ` : ''}
            </div>

            <!-- Editable Guidance Interventions & Status Form -->
            <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 18px; margin-top: 16px;">
                <h4 style="font-size: 14.5px; font-weight: 700; color: var(--primary); margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-hand-holding-heart" style="color: var(--accent);"></i> Guidance Counselor Action & Case Disposition
                </h4>

                <div class="form-row">
                    <div class="form-group">
                        <label for="editCaseStatus">Case Status <span class="req">*</span></label>
                        <select id="editCaseStatus" class="form-select">
                            <option value="Reported" ${v.status === 'Reported' ? 'selected' : ''}>Reported</option>
                            <option value="Under Investigation" ${v.status === 'Under Investigation' ? 'selected' : ''}>Under Investigation</option>
                            <option value="Counseling Scheduled" ${v.status === 'Counseling Scheduled' ? 'selected' : ''}>Counseling Scheduled</option>
                            <option value="In Progress" ${v.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                            <option value="Resolved" ${v.status === 'Resolved' ? 'selected' : ''}>Resolved / Dismissed</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="editActionTaken">Sanction / Prescribed Action</label>
                        <select id="editActionTaken" class="form-select">
                            <option value="Verbal Warning" ${v.action_taken === 'Verbal Warning' ? 'selected' : ''}>Verbal Warning</option>
                            <option value="Written Reprimand" ${v.action_taken === 'Written Reprimand' ? 'selected' : ''}>Written Reprimand</option>
                            <option value="Guidance Counseling" ${v.action_taken === 'Guidance Counseling' ? 'selected' : ''}>Guidance Counseling</option>
                            <option value="Parent-Teacher Conference" ${v.action_taken === 'Parent-Teacher Conference' ? 'selected' : ''}>Parent-Teacher Conference</option>
                            <option value="Community Service" ${v.action_taken === 'Community Service' ? 'selected' : ''}>Community Service</option>
                            <option value="Suspension" ${v.action_taken === 'Suspension' ? 'selected' : ''}>Suspension</option>
                            <option value="Behavioral Agreement" ${v.action_taken === 'Behavioral Agreement' ? 'selected' : ''}>Behavioral Agreement</option>
                        </select>
                    </div>
                </div>

                <div class="form-group">
                    <label for="editSanctionDetails">Sanction / Intervention Details</label>
                    <input type="text" id="editSanctionDetails" class="form-control" value="${v.sanction_details || ''}" placeholder="e.g. 2 hours library assistance or signed behavioral contract">
                </div>

                <div class="form-group">
                    <label for="editCounselorNotes">Counselor Notes & Behavioral Progress</label>
                    <textarea id="editCounselorNotes" class="form-control" rows="3" placeholder="Enter session reflections, student agreements, follow-up recommendations...">${v.counselor_notes || ''}</textarea>
                </div>

                <div style="display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap;">
                    <button type="button" class="btn-secondary" id="btnQuickScheduleCounseling" style="font-size: 12.5px;">
                        <i class="fas fa-calendar-plus" style="color: var(--accent);"></i> Create Counseling Session
                    </button>
                    <button type="button" class="btn-secondary" id="btnQuickCallSlip" style="font-size: 12.5px;">
                        <i class="fas fa-envelope-open-text" style="color: var(--warning);"></i> Generate Parent Call Slip
                    </button>
                </div>
            </div>
        `;

        caseModal.classList.add('active');

        // Quick action listeners inside modal
        document.getElementById('btnQuickScheduleCounseling').addEventListener('click', () => {
            caseModal.classList.remove('active');
            window.location.href = `counseling.html?student_id=${v.student_id || ''}&student_name=${encodeURIComponent(v.student_name)}&violation_id=${v.id}`;
        });

        document.getElementById('btnQuickCallSlip').addEventListener('click', () => {
            caseModal.classList.remove('active');
            openCallSlipModal(v);
        });
    }

    // Save Case Changes
    if (saveCaseChangesBtn) {
        saveCaseChangesBtn.addEventListener('click', async () => {
            if (!currentActiveCase) return;

            const newStatus = document.getElementById('editCaseStatus').value;
            const newAction = document.getElementById('editActionTaken').value;
            const newDetails = document.getElementById('editSanctionDetails').value;
            const newNotes = document.getElementById('editCounselorNotes').value;

            saveCaseChangesBtn.disabled = true;
            saveCaseChangesBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Saving...`;

            try {
                const { error } = await supabase
                    .from('student_violations')
                    .update({
                        status: newStatus,
                        action_taken: newAction,
                        sanction_details: newDetails,
                        counselor_notes: newNotes,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', currentActiveCase.id);

                if (error) throw error;

                // Update local array
                currentActiveCase.status = newStatus;
                currentActiveCase.action_taken = newAction;
                currentActiveCase.sanction_details = newDetails;
                currentActiveCase.counselor_notes = newNotes;

                renderViolations();
                caseModal.classList.remove('active');
                showAlert('Case details updated successfully!', 'success');

            } catch (err) {
                console.error('Error saving case:', err);
                showAlert('Failed to save case changes: ' + err.message, 'error');
            } finally {
                saveCaseChangesBtn.disabled = false;
                saveCaseChangesBtn.innerHTML = `<i class="fas fa-save"></i> Save Updates`;
            }
        });
    }

    // Close Case Modal
    if (closeCaseModalBtn) closeCaseModalBtn.addEventListener('click', () => caseModal.classList.remove('active'));
    if (closeModalBottomBtn) closeModalBottomBtn.addEventListener('click', () => caseModal.classList.remove('active'));

    // Open Parent Call Slip Modal
    function openCallSlipModal(v) {
        currentCallSlipViolation = v;
        const todayStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

        callSlipModalBody.innerHTML = `
            <div class="call-slip-container">
                <div class="call-slip-header">
                    <h4><i class="fas fa-school"></i> HIRAYA GUIDANCE OFFICE · CALL SLIP</h4>
                    <span style="font-size: 12px; color: #92400e; font-weight: 600;">Date: ${todayStr}</span>
                </div>
                <p style="font-size: 13px; color: #78350f; line-height: 1.5; margin-bottom: 12px;">
                    Dear Parent / Guardian of <strong>${v.student_name}</strong> (${v.grade_level || 'Grade 11'} - ${v.strand || 'TVL'}),
                </p>
                <p style="font-size: 12.5px; color: #78350f; line-height: 1.5; margin-bottom: 12px;">
                    You are respectfully requested to attend a conference at the Guidance Office regarding:
                    <strong>${v.violation_type || 'Disciplinary Concern'}</strong> (${v.offense_level || '1st Offense'}) on:
                </p>

                <div class="form-row" style="margin-bottom: 12px;">
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="color: #78350f;">Requested Date</label>
                        <input type="date" id="callSlipDate" class="form-control" value="${new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0]}">
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="color: #78350f;">Requested Time</label>
                        <input type="time" id="callSlipTime" class="form-control" value="09:00">
                    </div>
                </div>

                <div class="form-group" style="margin-bottom: 0;">
                    <label style="color: #78350f;">Special Instructions / Counselor Message</label>
                    <textarea id="callSlipMessage" class="form-control" rows="2">Please proceed to the Guidance Office Building A, Room 102. Your presence and cooperation in guiding your child is greatly valued.</textarea>
                </div>
            </div>
        `;

        callSlipModal.classList.add('active');
    }

    // Send Parent Call Slip
    if (sendCallSlipBtn) {
        sendCallSlipBtn.addEventListener('click', async () => {
            if (!currentCallSlipViolation) return;

            const reqDate = document.getElementById('callSlipDate').value;
            const reqTime = document.getElementById('callSlipTime').value;
            const reqMsg = document.getElementById('callSlipMessage').value;

            sendCallSlipBtn.disabled = true;
            sendCallSlipBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Sending...`;

            try {
                // 1. Update violation parent_notified status
                await supabase
                    .from('student_violations')
                    .update({
                        parent_notified: true,
                        parent_notified_date: new Date().toISOString()
                    })
                    .eq('id', currentCallSlipViolation.id);

                // 2. Post a system notification to parents
                await supabase
                    .from('notifications')
                    .insert({
                        role: 'parent',
                        title: `📌 Guidance Call Slip: ${currentCallSlipViolation.student_name}`,
                        message: `Guidance Conference requested on ${reqDate} at ${reqTime} regarding ${currentCallSlipViolation.violation_type}. ${reqMsg}`,
                        type: 'guidance_call_slip',
                        is_read: false
                    });

                currentCallSlipViolation.parent_notified = true;
                callSlipModal.classList.remove('active');
                showAlert(`✅ Parent call slip dispatched successfully for ${currentCallSlipViolation.student_name}!`, 'success');

            } catch (err) {
                console.error('Error sending call slip:', err);
                showAlert('Failed to dispatch call slip: ' + err.message, 'error');
            } finally {
                sendCallSlipBtn.disabled = false;
                sendCallSlipBtn.innerHTML = `<i class="fas fa-paper-plane"></i> Send Notification Notice`;
            }
        });
    }

    if (closeCallSlipModalBtn) closeCallSlipModalBtn.addEventListener('click', () => callSlipModal.classList.remove('active'));
    if (closeCallSlipBottomBtn) closeCallSlipBottomBtn.addEventListener('click', () => callSlipModal.classList.remove('active'));

    // Delete Case
    async function deleteCase(id) {
        if (!confirm('Are you sure you want to permanently delete this violation incident report? This action cannot be undone.')) {
            return;
        }

        try {
            const { error } = await supabase
                .from('student_violations')
                .delete()
                .eq('id', id);

            if (error) throw error;

            allViolations = allViolations.filter(v => v.id !== id);
            renderViolations();
            showAlert('Violation report deleted successfully.', 'success');

        } catch (err) {
            console.error('Error deleting violation:', err);
            showAlert('Failed to delete violation: ' + err.message, 'error');
        }
    }

    // Initial Load
    await loadViolations();
});
