/**
 * Admin Guidance & Violations Management JS - Supabase Integration
 * Implements "Add Action (Guidance)" and violation tracking
 */

import { supabase } from '../../supabase/config.js';

(function() {
    'use strict';

    console.log('⚖️ Guidance & Violations Management module initialized');

    // DOM Elements
    const alertContainer = document.getElementById('alertContainer');
    const violationsTableBody = document.getElementById('violationsTableBody');
    const recordCountText = document.getElementById('recordCountText');

    // KPI Elements
    const kpiTotal = document.getElementById('kpiTotal');
    const kpiPending = document.getElementById('kpiPending');
    const kpiCounseling = document.getElementById('kpiCounseling');
    const kpiResolved = document.getElementById('kpiResolved');

    // Filters
    const gvSearchInput = document.getElementById('gvSearchInput');
    const gvFilterStatus = document.getElementById('gvFilterStatus');
    const gvFilterOffense = document.getElementById('gvFilterOffense');
    const gvFilterGrade = document.getElementById('gvFilterGrade');
    const btnResetFilters = document.getElementById('btnResetFilters');

    // Modals
    const modalAddViolation = document.getElementById('modalAddViolation');
    const modalAddAction = document.getElementById('modalAddAction');
    const btnOpenAddViolationModal = document.getElementById('btnOpenAddViolationModal');
    const addStudentSelect = document.getElementById('addStudentSelect');
    const formAddViolation = document.getElementById('formAddViolation');
    const formAddAction = document.getElementById('formAddAction');

    // Add Action Modal Fields
    const actionViolationId = document.getElementById('actionViolationId');
    const actionStudentName = document.getElementById('actionStudentName');
    const actionOffenseBadge = document.getElementById('actionOffenseBadge');
    const actionIncidentTitle = document.getElementById('actionIncidentTitle');
    const actionParentEmergencyText = document.getElementById('actionParentEmergencyText');
    const actionDecisionSelect = document.getElementById('actionDecisionSelect');
    const actionSanctions = document.getElementById('actionSanctions');
    const actionStatus = document.getElementById('actionStatus');
    const actionResolutionDate = document.getElementById('actionResolutionDate');
    const actionCounselorNotes = document.getElementById('actionCounselorNotes');
    const actionParentNotified = document.getElementById('actionParentNotified');

    // State
    let allViolations = [];
    let allStudents = [];
    let selectedViolation = null;

    // 1. Initialize & Fetch Data
    async function init() {
        await Promise.all([loadStudents(), loadViolations()]);
    }

    async function loadStudents() {
        try {
            const { data, error } = await supabase
                .from('students')
                .select('id, lrn, first_name, last_name, grade_level, strand, parent_name, parent_contact, parent_email, parent_facebook')
                .order('last_name', { ascending: true });

            if (error) throw error;
            allStudents = data || [];

            // Populate Student Select Dropdown
            if (addStudentSelect) {
                addStudentSelect.innerHTML = '<option value="">-- Choose Student --</option>';
                allStudents.forEach(s => {
                    const fullName = `${s.last_name || ''}, ${s.first_name || ''}`.trim();
                    const opt = document.createElement('option');
                    opt.value = s.id;
                    opt.textContent = `${fullName} (LRN: ${s.lrn || 'N/A'} - ${s.grade_level || 'Grade N/A'})`;
                    addStudentSelect.appendChild(opt);
                });
            }
        } catch (err) {
            console.error('Error loading students:', err);
        }
    }

    async function loadViolations() {
        try {
            const { data, error } = await supabase
                .from('student_violations')
                .select('*')
                .order('incident_date', { ascending: false });

            if (error) throw error;
            allViolations = data || [];
            updateKPIs();
            renderTable();
        } catch (err) {
            console.error('Error loading violations:', err);
            showAlert('Failed to load violations: ' + err.message, 'error');
            if (violationsTableBody) {
                violationsTableBody.innerHTML = `
                    <tr>
                        <td colspan="9" style="text-align: center; color: #ef4444; padding: 30px;">
                            <i class="fas fa-exclamation-triangle"></i> Error loading violations from database.
                        </td>
                    </tr>
                `;
            }
        }
    }

    // 2. Update KPIs
    function updateKPIs() {
        const total = allViolations.length;
        const pending = allViolations.filter(v => (v.status || '').toLowerCase() === 'pending' || (v.status || '').toLowerCase() === 'under investigation').length;
        const counseling = allViolations.filter(v => (v.status || '').toLowerCase().includes('counseling')).length;
        const resolved = allViolations.filter(v => (v.status || '').toLowerCase() === 'resolved' || (v.status || '').toLowerCase() === 'dismissed').length;

        if (kpiTotal) kpiTotal.textContent = total;
        if (kpiPending) kpiPending.textContent = pending;
        if (kpiCounseling) kpiCounseling.textContent = counseling;
        if (kpiResolved) kpiResolved.textContent = resolved;
    }

    // 3. Render Table
    function renderTable() {
        if (!violationsTableBody) return;

        const searchTerm = (gvSearchInput?.value || '').toLowerCase().trim();
        const statusFilter = gvFilterStatus?.value || '';
        const offenseFilter = gvFilterOffense?.value || '';
        const gradeFilter = gvFilterGrade?.value || '';

        const filtered = allViolations.filter(v => {
            const matchesSearch = !searchTerm || 
                (v.student_name || '').toLowerCase().includes(searchTerm) || 
                (v.lrn || '').toLowerCase().includes(searchTerm) || 
                (v.violation_title || '').toLowerCase().includes(searchTerm);

            const matchesStatus = !statusFilter || (v.status || '').toLowerCase() === statusFilter.toLowerCase();
            const matchesOffense = !offenseFilter || (v.offense_level || '').toLowerCase() === offenseFilter.toLowerCase();
            const matchesGrade = !gradeFilter || (v.grade_level || '').toLowerCase() === gradeFilter.toLowerCase();

            return matchesSearch && matchesStatus && matchesOffense && matchesGrade;
        });

        if (recordCountText) {
            recordCountText.textContent = `Showing ${filtered.length} of ${allViolations.length} records`;
        }

        if (filtered.length === 0) {
            violationsTableBody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 40px; color: #64748b;">
                        <i class="fas fa-folder-open" style="font-size: 28px; margin-bottom: 8px; display: block; color: #cbd5e1;"></i>
                        No disciplinary violations match the selected filters.
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        filtered.forEach(v => {
            const rawStatus = (v.status || 'Pending').toLowerCase();
            let statusClass = 'pending';
            if (rawStatus === 'resolved' || rawStatus === 'dismissed') statusClass = 'resolved';
            else if (rawStatus.includes('counseling')) statusClass = 'counseling';
            else if (rawStatus.includes('progress')) statusClass = 'in-progress';

            const rawOffense = (v.offense_level || '1st Offense').toLowerCase();
            let offenseClass = 'level-1';
            if (rawOffense.includes('2nd')) offenseClass = 'level-2';
            else if (rawOffense.includes('3rd') || rawOffense.includes('habitual')) offenseClass = 'level-3';

            const formattedDate = v.incident_date ? new Date(v.incident_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';

            html += `
                <tr>
                    <td>
                        <strong style="color: #0f172a; display: block;">${escapeHtml(v.student_name || 'Unnamed')}</strong>
                        <span style="font-size: 11.5px; color: #64748b; font-family: monospace;">LRN: ${escapeHtml(v.lrn || 'N/A')}</span>
                    </td>
                    <td>
                        <span style="font-weight: 500;">${escapeHtml(v.grade_level || 'Grade N/A')}</span>
                        ${v.section ? `<span style="font-size: 11.5px; color: #64748b; display: block;">${escapeHtml(v.section)}</span>` : ''}
                    </td>
                    <td>
                        <strong style="color: #1e293b; display: block;">${escapeHtml(v.violation_title || 'Incident')}</strong>
                        <span style="font-size: 11.5px; color: #64748b;">${escapeHtml(v.violation_category || 'Discipline')}</span>
                    </td>
                    <td>
                        <span class="badge-offense ${offenseClass}">
                            ${escapeHtml(v.offense_level || '1st Offense')}
                        </span>
                    </td>
                    <td>${formattedDate}</td>
                    <td>
                        <span style="font-weight: 600; color: #0b2b4a;">
                            ${escapeHtml(v.action_taken || 'Pending Review')}
                        </span>
                        ${v.sanction_details ? `<span style="display: block; font-size: 11px; color: #64748b;">${escapeHtml(v.sanction_details)}</span>` : ''}
                    </td>
                    <td>
                        ${v.parent_notified ? 
                            `<span style="color: #10b981; font-weight: 600; font-size: 12px;"><i class="fas fa-check-circle"></i> Notified</span>` : 
                            `<span style="color: #94a3b8; font-size: 12px;"><i class="fas fa-clock"></i> Pending</span>`
                        }
                    </td>
                    <td>
                        <span class="badge-status ${statusClass}">
                            ${escapeHtml(v.status || 'Pending')}
                        </span>
                    </td>
                    <td style="text-align: right; white-space: nowrap;">
                        <button type="button" class="btn-action-guidance" onclick="window.openAddActionModal('${v.id}')" title="Add or update guidance decision & sanction">
                            <i class="fas fa-gavel"></i> Add Action
                        </button>
                    </td>
                </tr>
            `;
        });

        violationsTableBody.innerHTML = html;
    }

    // 4. Modal Open/Close Controls
    window.closeAddModal = function() {
        if (modalAddViolation) modalAddViolation.style.display = 'none';
        if (formAddViolation) formAddViolation.reset();
    };

    window.closeActionModal = function() {
        if (modalAddAction) modalAddAction.style.display = 'none';
        if (formAddAction) formAddAction.reset();
        selectedViolation = null;
    };

    if (btnOpenAddViolationModal) {
        btnOpenAddViolationModal.addEventListener('click', function() {
            if (modalAddViolation) modalAddViolation.style.display = 'flex';
            const today = new Date().toISOString().split('T')[0];
            const dateInput = document.getElementById('addIncidentDate');
            if (dateInput) dateInput.value = today;
        });
    }

    // 5. Open "Add Action (Guidance)" Modal
    window.openAddActionModal = function(violationId) {
        const item = allViolations.find(v => v.id === violationId);
        if (!item || !modalAddAction) return;

        selectedViolation = item;
        if (actionViolationId) actionViolationId.value = item.id;
        if (actionStudentName) actionStudentName.textContent = item.student_name || 'Student';
        if (actionIncidentTitle) actionIncidentTitle.textContent = `Incident: ${item.violation_title || 'Disciplinary violation'} (${item.incident_date || 'No date'})`;
        
        if (actionOffenseBadge) {
            actionOffenseBadge.textContent = item.offense_level || '1st Offense';
            const raw = (item.offense_level || '').toLowerCase();
            actionOffenseBadge.className = 'badge-offense ' + (raw.includes('2nd') ? 'level-2' : (raw.includes('3rd') ? 'level-3' : 'level-1'));
        }

        // Fetch parent details from matching student
        const matchedStudent = allStudents.find(s => s.id === item.student_id || (s.lrn && s.lrn === item.lrn));
        if (actionParentEmergencyText) {
            if (matchedStudent) {
                const pName = matchedStudent.parent_name || 'Parent';
                const pContact = matchedStudent.parent_contact || 'No phone';
                const pEmail = matchedStudent.parent_email || 'No email';
                const pFb = matchedStudent.parent_facebook ? `• FB: ${matchedStudent.parent_facebook}` : '';
                actionParentEmergencyText.innerHTML = `<strong>${pName}:</strong> ${pContact} • ${pEmail} ${pFb}`;
            } else {
                actionParentEmergencyText.textContent = 'Parent contact details not linked';
            }
        }

        // Pre-fill existing guidance decision data
        if (actionDecisionSelect) actionDecisionSelect.value = item.action_taken || 'Verbal Warning';
        if (actionSanctions) actionSanctions.value = item.sanction_details || '';
        if (actionStatus) actionStatus.value = item.status || 'Resolved';
        if (actionResolutionDate) actionResolutionDate.value = item.resolution_date || (item.status === 'Resolved' ? new Date().toISOString().split('T')[0] : '');
        if (actionCounselorNotes) actionCounselorNotes.value = item.counselor_notes || '';
        if (actionParentNotified) actionParentNotified.checked = !!item.parent_notified;

        modalAddAction.style.display = 'flex';
    };

    // 6. Submit "Add Action (Guidance)"
    if (formAddAction) {
        formAddAction.addEventListener('submit', async function(e) {
            e.preventDefault();
            if (!selectedViolation) return;

            const submitBtn = document.getElementById('btnSubmitAddAction');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving Decision...';
            }

            try {
                const decision = actionDecisionSelect.value;
                const sanctions = actionSanctions.value.trim();
                const status = actionStatus.value;
                const resolutionDate = actionResolutionDate.value || null;
                const counselorNotes = actionCounselorNotes.value.trim();
                const parentNotified = actionParentNotified.checked;

                const updatePayload = {
                    action_taken: decision,
                    sanction_details: sanctions,
                    status: status,
                    counselor_notes: counselorNotes,
                    parent_notified: parentNotified,
                    updated_at: new Date().toISOString()
                };

                if (resolutionDate) {
                    updatePayload.resolution_date = resolutionDate;
                }
                if (parentNotified && !selectedViolation.parent_notified) {
                    updatePayload.parent_notified_date = new Date().toISOString();
                }

                const { error } = await supabase
                    .from('student_violations')
                    .update(updatePayload)
                    .eq('id', selectedViolation.id);

                if (error) throw error;

                showAlert('✅ Guidance decision & action recorded successfully!', 'success');
                closeActionModal();
                await loadViolations();

            } catch (err) {
                console.error('Error saving guidance action:', err);
                showAlert('Failed to save guidance action: ' + err.message, 'error');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fas fa-check-double"></i> Save Guidance Action';
                }
            }
        });
    }

    // 7. Submit "Log New Violation"
    if (formAddViolation) {
        formAddViolation.addEventListener('submit', async function(e) {
            e.preventDefault();

            const studentId = addStudentSelect.value;
            const matchedStudent = allStudents.find(s => s.id === studentId);
            if (!matchedStudent) {
                showAlert('Please select a student from the list.', 'error');
                return;
            }

            const title = document.getElementById('addTitle')?.value.trim();
            const category = document.getElementById('addCategory')?.value;
            const offenseLevel = document.getElementById('addOffenseLevel')?.value;
            const incidentDate = document.getElementById('addIncidentDate')?.value;
            const location = document.getElementById('addLocation')?.value.trim();
            const reportedBy = document.getElementById('addReportedBy')?.value.trim();
            const reporterRole = document.getElementById('addReporterRole')?.value;
            const description = document.getElementById('addDescription')?.value.trim();
            const actionTaken = document.getElementById('addActionTaken')?.value.trim();

            const submitBtn = document.getElementById('btnSubmitAddViolation');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving Violation...';
            }

            try {
                const sName = `${matchedStudent.first_name || ''} ${matchedStudent.last_name || ''}`.trim();
                const newRecord = {
                    student_id: matchedStudent.id,
                    lrn: matchedStudent.lrn || '',
                    student_name: sName,
                    grade_level: matchedStudent.grade_level || '',
                    strand: matchedStudent.strand || '',
                    violation_title: title,
                    violation_category: category,
                    violation_type: category,
                    offense_level: offenseLevel,
                    incident_date: incidentDate,
                    incident_location: location,
                    reported_by: reportedBy,
                    reporter_role: reporterRole,
                    description: description,
                    action_taken: actionTaken || 'Pending Guidance Review',
                    status: actionTaken ? 'Under Investigation' : 'Pending',
                    parent_notified: false
                };

                const { error } = await supabase
                    .from('student_violations')
                    .insert([newRecord]);

                if (error) throw error;

                showAlert(`✅ Incident report logged for ${sName}!`, 'success');
                closeAddModal();
                await loadViolations();

            } catch (err) {
                console.error('Error logging violation:', err);
                showAlert('Failed to log violation: ' + err.message, 'error');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fas fa-save"></i> Save Violation Record';
                }
            }
        });
    }

    // 8. Filters & Search Listeners
    if (gvSearchInput) gvSearchInput.addEventListener('input', renderTable);
    if (gvFilterStatus) gvFilterStatus.addEventListener('change', renderTable);
    if (gvFilterOffense) gvFilterOffense.addEventListener('change', renderTable);
    if (gvFilterGrade) gvFilterGrade.addEventListener('change', renderTable);

    if (btnResetFilters) {
        btnResetFilters.addEventListener('click', function() {
            if (gvSearchInput) gvSearchInput.value = '';
            if (gvFilterStatus) gvFilterStatus.value = '';
            if (gvFilterOffense) gvFilterOffense.value = '';
            if (gvFilterGrade) gvFilterGrade.value = '';
            renderTable();
        });
    }

    // 9. Print Export Report
    window.printViolationsReport = function() {
        const printWin = window.open('', '_blank', 'width=900,height=700');
        let tableRows = '';
        allViolations.forEach((v, i) => {
            tableRows += `
                <tr>
                    <td>${i + 1}</td>
                    <td><strong>${escapeHtml(v.student_name)}</strong><br><small>LRN: ${escapeHtml(v.lrn)}</small></td>
                    <td>${escapeHtml(v.grade_level || 'N/A')}</td>
                    <td>${escapeHtml(v.violation_title)}</td>
                    <td>${escapeHtml(v.offense_level)}</td>
                    <td>${escapeHtml(v.incident_date)}</td>
                    <td>${escapeHtml(v.action_taken || 'Pending')}</td>
                    <td>${escapeHtml(v.status || 'Pending')}</td>
                </tr>
            `;
        });

        printWin.document.write(`
            <html>
            <head>
                <title>Guidance Disciplinary Summary Report</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 24px; color: #1e293b; }
                    h2 { margin: 0 0 4px; color: #0b2b4a; }
                    p { margin: 0 0 16px; font-size: 13px; color: #64748b; }
                    table { width: 100%; border-collapse: collapse; font-size: 12px; }
                    th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
                    th { background: #f1f5f9; font-weight: bold; }
                </style>
            </head>
            <body>
                <h2>Hiraya Enrollment System - Guidance & Counseling Office</h2>
                <p>Student Disciplinary Cases & Guidance Actions Report • Generated: ${new Date().toLocaleDateString()}</p>
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Student Name</th>
                            <th>Grade Level</th>
                            <th>Violation Title</th>
                            <th>Offense Level</th>
                            <th>Incident Date</th>
                            <th>Guidance Action Taken</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
                <script>window.onload = function() { window.print(); }</script>
            </body>
            </html>
        `);
        printWin.document.close();
    };

    function showAlert(msg, type) {
        if (!alertContainer) return;
        alertContainer.innerHTML = `
            <div style="padding: 12px 18px; border-radius: 8px; margin-bottom: 20px; font-size: 13.5px; font-weight: 500; ${type === 'error' ? 'background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca;' : 'background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0;'}">
                ${msg}
            </div>
        `;
        setTimeout(() => {
            alertContainer.innerHTML = '';
        }, 5000);
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Initialize
    init();
})();
