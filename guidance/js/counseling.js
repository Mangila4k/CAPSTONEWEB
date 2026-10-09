// ===== GUIDANCE COUNSELING SESSIONS CONTROLLER =====
import { supabase } from '../../supabase/config.js';

document.addEventListener('DOMContentLoaded', async function() {
    'use strict';

    // 1. Session Check
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

    // Set Counselor Profile in Sidebar
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
    const sessionCardsContainer = document.getElementById('sessionCardsContainer');
    const sessionSearch = document.getElementById('sessionSearch');
    const statusFilter = document.getElementById('statusFilter');
    const typeFilter = document.getElementById('typeFilter');
    const openNewSessionBtn = document.getElementById('openNewSessionBtn');
    const alertContainer = document.getElementById('alertContainer');

    // New Session Modal Elements
    const newSessionModal = document.getElementById('newSessionModal');
    const closeNewSessionModalBtn = document.getElementById('closeNewSessionModalBtn');
    const cancelNewSessionBtn = document.getElementById('cancelNewSessionBtn');
    const newSessionForm = document.getElementById('newSessionForm');
    const newSessionStudentSelect = document.getElementById('newSessionStudentSelect');
    const newSessionDate = document.getElementById('newSessionDate');
    const newSessionTime = document.getElementById('newSessionTime');
    const newSessionType = document.getElementById('newSessionType');
    const newSessionPurpose = document.getElementById('newSessionPurpose');
    const newSessionNotes = document.getElementById('newSessionNotes');

    // Update Session Modal Elements
    const updateSessionModal = document.getElementById('updateSessionModal');
    const closeUpdateSessionModalBtn = document.getElementById('closeUpdateSessionModalBtn');
    const cancelUpdateSessionBtn = document.getElementById('cancelUpdateSessionBtn');
    const updateSessionTitle = document.getElementById('updateSessionTitle');
    const updateSessionBody = document.getElementById('updateSessionBody');
    const saveSessionNotesBtn = document.getElementById('saveSessionNotesBtn');

    let allSessions = [];
    let studentsList = [];
    let currentUpdatingSession = null;

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

    // 2. Load Students
    async function loadStudents() {
        try {
            const { data, error } = await supabase
                .from('students')
                .select('*')
                .order('last_name', { ascending: true });

            if (error) throw error;
            studentsList = data || [];

            newSessionStudentSelect.innerHTML = `
                <option value="">-- Choose Student --</option>
                ${studentsList.map(s => `
                    <option value="${s.id}">
                        ${s.last_name || ''}, ${s.first_name || ''} (LRN: ${s.lrn || 'N/A'}) - ${s.grade_level || 'Grade 11'}
                    </option>
                `).join('')}
            `;

            // Check URL params
            const urlParams = new URLSearchParams(window.location.search);
            const passedStudentId = urlParams.get('student_id');
            const passedViolationId = urlParams.get('violation_id');

            if (passedStudentId) {
                newSessionStudentSelect.value = passedStudentId;
                if (newSessionDate) newSessionDate.value = new Date(Date.now() + 86400000).toISOString().split('T')[0];
                newSessionModal.classList.add('active');
            }

        } catch (err) {
            console.error('Error loading students:', err);
        }
    }

    // 3. Load Counseling Sessions
    async function loadSessions() {
        try {
            const { data, error } = await supabase
                .from('counseling_sessions')
                .select('*')
                .order('session_date', { ascending: false });

            if (error) throw error;
            allSessions = data || [];
            renderSessions();

        } catch (err) {
            console.error('Error loading counseling sessions:', err);
            sessionCardsContainer.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--danger);">Failed to load sessions.</div>`;
        }
    }

    // 4. Render Sessions
    function renderSessions() {
        const query = (sessionSearch.value || '').trim().toLowerCase();
        const stat = (statusFilter.value || 'all');
        const stype = (typeFilter.value || 'all');

        const filtered = allSessions.filter(s => {
            const matchesQuery = !query || 
                (s.student_name && s.student_name.toLowerCase().includes(query)) ||
                (s.purpose && s.purpose.toLowerCase().includes(query)) ||
                (s.counselor_name && s.counselor_name.toLowerCase().includes(query));

            const matchesStat = stat === 'all' || s.status === stat;
            const matchesType = stype === 'all' || s.session_type === stype;

            return matchesQuery && matchesStat && matchesType;
        });

        if (filtered.length === 0) {
            sessionCardsContainer.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 40px; background: #fff; border-radius: 14px; border: 1px solid var(--border-color);">
                    <i class="fas fa-calendar-check" style="font-size: 32px; color: var(--accent); margin-bottom: 10px; display: block;"></i>
                    No counseling sessions found. Click "Schedule New Session" to book one.
                </div>
            `;
            return;
        }

        sessionCardsContainer.innerHTML = filtered.map(s => {
            const dateObj = new Date(s.session_date);
            const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

            let cardStatusClass = 'status-scheduled';
            let badgeClass = 'badge-reported';
            if (s.status === 'Completed') {
                cardStatusClass = 'status-completed';
                badgeClass = 'badge-resolved';
            } else if (s.status === 'In Progress') {
                cardStatusClass = 'status-inprogress';
                badgeClass = 'badge-in-progress';
            }

            return `
                <div class="session-card ${cardStatusClass}">
                    <div class="session-card-header">
                        <span class="session-badge-type"><i class="fas fa-hand-holding-heart" style="color: var(--accent);"></i> ${s.session_type || 'Counseling'}</span>
                        <span class="badge ${badgeClass}" style="font-size: 11px;">${s.status || 'Scheduled'}</span>
                    </div>

                    <div class="session-student-info">
                        <h4>${s.student_name || 'Student'}</h4>
                        <p>LRN: ${s.lrn || 'N/A'} · ${s.grade_level || 'Grade 11'}</p>
                    </div>

                    <div class="session-meta-row">
                        <div><i class="fas fa-calendar-alt"></i> ${dateStr}</div>
                        <div><i class="fas fa-clock"></i> ${s.session_time || '09:00 AM'}</div>
                    </div>

                    <div class="session-notes-snippet">
                        <strong>Focus:</strong> ${s.purpose || 'General counseling'}<br>
                        ${s.notes ? `<span style="font-size: 11.5px; color: var(--text-muted); display: block; margin-top: 4px;">"${s.notes.substring(0, 100)}${s.notes.length > 100 ? '...' : ''}"</span>` : ''}
                    </div>

                    <div class="session-card-actions">
                        <button class="btn-primary btn-update-session" data-id="${s.id}" style="flex: 1; padding: 7px 12px; font-size: 12px; justify-content: center;">
                            <i class="fas fa-pen-to-square"></i> Notes & Status
                        </button>
                        <button class="btn-icon btn-icon-danger btn-delete-session" data-id="${s.id}" title="Delete Session">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Attach event listeners
        document.querySelectorAll('.btn-update-session').forEach(btn => {
            btn.addEventListener('click', () => {
                const sid = btn.getAttribute('data-id');
                const target = allSessions.find(s => s.id === sid);
                if (target) openUpdateSessionModal(target);
            });
        });

        document.querySelectorAll('.btn-delete-session').forEach(btn => {
            btn.addEventListener('click', () => {
                const sid = btn.getAttribute('data-id');
                deleteSession(sid);
            });
        });
    }

    sessionSearch.addEventListener('input', renderSessions);
    statusFilter.addEventListener('change', renderSessions);
    typeFilter.addEventListener('change', renderSessions);

    // 5. Schedule New Session Modal
    if (openNewSessionBtn) {
        openNewSessionBtn.addEventListener('click', () => {
            if (newSessionDate) newSessionDate.value = new Date().toISOString().split('T')[0];
            newSessionModal.classList.add('active');
        });
    }

    if (closeNewSessionModalBtn) closeNewSessionModalBtn.addEventListener('click', () => newSessionModal.classList.remove('active'));
    if (cancelNewSessionBtn) cancelNewSessionBtn.addEventListener('click', () => newSessionModal.classList.remove('active'));

    if (newSessionForm) {
        newSessionForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const sid = newSessionStudentSelect.value;
            const student = studentsList.find(s => s.id === sid);
            if (!student) {
                showAlert('Please select a student from the list.', 'error');
                return;
            }

            const fullName = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student';
            const sDate = newSessionDate.value;
            const sTime = newSessionTime.value;
            const sType = newSessionType.value;
            const sPurpose = newSessionPurpose.value.trim();
            const sNotes = newSessionNotes.value.trim();

            const saveBtn = document.getElementById('saveNewSessionBtn');
            saveBtn.disabled = true;
            saveBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Booking...`;

            try {
                const { data, error } = await supabase
                    .from('counseling_sessions')
                    .insert([{
                        student_id: student.id,
                        student_name: fullName,
                        lrn: student.lrn || '',
                        grade_level: student.grade_level || 'Grade 11',
                        counselor_name: displayName,
                        session_date: sDate,
                        session_time: sTime,
                        session_type: sType,
                        purpose: sPurpose,
                        notes: sNotes,
                        status: 'Scheduled'
                    }])
                    .select()
                    .single();

                if (error) throw error;

                allSessions.unshift(data);
                renderSessions();
                newSessionModal.classList.remove('active');
                newSessionForm.reset();
                showAlert(`✅ Counseling session booked for ${fullName}!`, 'success');

            } catch (err) {
                console.error('Error booking session:', err);
                showAlert('Failed to book session: ' + err.message, 'error');
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = `<i class="fas fa-calendar-check"></i> Book Session`;
            }
        });
    }

    // 6. Update Session Modal
    function openUpdateSessionModal(s) {
        currentUpdatingSession = s;
        updateSessionTitle.innerHTML = `<i class="fas fa-notes-medical"></i> Counseling Session: ${s.student_name}`;

        const dateStr = s.session_date ? new Date(s.session_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A';

        updateSessionBody.innerHTML = `
            <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 10px; padding: 14px; margin-bottom: 18px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <strong style="color: var(--primary); font-size: 14.5px;">${s.student_name}</strong>
                    <span class="session-badge-type">${s.session_type || 'Counseling'}</span>
                </div>
                <div style="font-size: 12px; color: var(--text-muted);">
                    Scheduled for: <strong>${dateStr}</strong> at <strong>${s.session_time || '09:00 AM'}</strong> · Counselor: ${s.counselor_name || displayName}
                </div>
                <div style="font-size: 12.5px; color: var(--primary); margin-top: 6px;">
                    <strong>Purpose:</strong> ${s.purpose || 'Guidance'}
                </div>
            </div>

            <div class="form-group">
                <label for="updateStatusSelect">Session Progress & Outcome <span class="req">*</span></label>
                <select id="updateStatusSelect" class="form-select">
                    <option value="Scheduled" ${s.status === 'Scheduled' ? 'selected' : ''}>Scheduled</option>
                    <option value="In Progress" ${s.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                    <option value="Completed" ${s.status === 'Completed' ? 'selected' : ''}>Completed / Successfully Concluded</option>
                    <option value="Cancelled" ${s.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                    <option value="No Show" ${s.status === 'No Show' ? 'selected' : ''}>No Show / Student Absent</option>
                </select>
            </div>

            <div class="form-group">
                <label for="updateNotes">Counselor Session Observations & Discussion Notes</label>
                <textarea id="updateNotes" class="form-control" rows="3" placeholder="Key insights, student self-reflection, areas of improvement discussed...">${s.notes || ''}</textarea>
            </div>

            <div class="form-group">
                <label for="updateActionPlan">Student Action Plan / Restorative Commitment</label>
                <textarea id="updateActionPlan" class="form-control" rows="2" placeholder="Specific goals agreed upon by student (e.g. daily attendance checklist, peer mediation)...">${s.action_plan || ''}</textarea>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label for="updateFollowUpDate">Next Follow-Up Date (if required)</label>
                    <input type="date" id="updateFollowUpDate" class="form-control" value="${s.follow_up_date || ''}">
                </div>
                <div class="form-group">
                    <label for="updateBehavioralAgreement">Behavioral Agreement Status</label>
                    <select id="updateBehavioralAgreement" class="form-select">
                        <option value="None" ${(!s.behavioral_agreement || s.behavioral_agreement === 'None') ? 'selected' : ''}>No Contract Needed</option>
                        <option value="Signed Contract" ${s.behavioral_agreement === 'Signed Contract' ? 'selected' : ''}>Behavioral Contract Signed</option>
                        <option value="Pending Parent Signature" ${s.behavioral_agreement === 'Pending Parent Signature' ? 'selected' : ''}>Pending Parent Signature</option>
                    </select>
                </div>
            </div>
        `;

        updateSessionModal.classList.add('active');
    }

    if (closeUpdateSessionModalBtn) closeUpdateSessionModalBtn.addEventListener('click', () => updateSessionModal.classList.remove('active'));
    if (cancelUpdateSessionBtn) cancelUpdateSessionBtn.addEventListener('click', () => updateSessionModal.classList.remove('active'));

    if (saveSessionNotesBtn) {
        saveSessionNotesBtn.addEventListener('click', async () => {
            if (!currentUpdatingSession) return;

            const newSt = document.getElementById('updateStatusSelect').value;
            const newNotes = document.getElementById('updateNotes').value;
            const newPlan = document.getElementById('updateActionPlan').value;
            const newFollowUp = document.getElementById('updateFollowUpDate').value || null;
            const newAgree = document.getElementById('updateBehavioralAgreement').value;

            saveSessionNotesBtn.disabled = true;
            saveSessionNotesBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Saving...`;

            try {
                const { error } = await supabase
                    .from('counseling_sessions')
                    .update({
                        status: newSt,
                        notes: newNotes,
                        action_plan: newPlan,
                        follow_up_date: newFollowUp,
                        behavioral_agreement: newAgree,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', currentUpdatingSession.id);

                if (error) throw error;

                currentUpdatingSession.status = newSt;
                currentUpdatingSession.notes = newNotes;
                currentUpdatingSession.action_plan = newPlan;
                currentUpdatingSession.follow_up_date = newFollowUp;
                currentUpdatingSession.behavioral_agreement = newAgree;

                renderSessions();
                updateSessionModal.classList.remove('active');
                showAlert('Counseling session updated successfully!', 'success');

            } catch (err) {
                console.error('Error saving session notes:', err);
                showAlert('Failed to save session: ' + err.message, 'error');
            } finally {
                saveSessionNotesBtn.disabled = false;
                saveSessionNotesBtn.innerHTML = `<i class="fas fa-save"></i> Save Session Notes`;
            }
        });
    }

    // 7. Delete Session
    async function deleteSession(id) {
        if (!confirm('Are you sure you want to delete this counseling session?')) return;

        try {
            const { error } = await supabase
                .from('counseling_sessions')
                .delete()
                .eq('id', id);

            if (error) throw error;

            allSessions = allSessions.filter(s => s.id !== id);
            renderSessions();
            showAlert('Session record removed successfully.', 'success');

        } catch (err) {
            console.error('Error deleting session:', err);
            showAlert('Failed to delete session: ' + err.message, 'error');
        }
    }

    // Initial Load
    await loadStudents();
    await loadSessions();
});
