/**
 * HES Admin - View Student Profile (Supabase Dynamic Integration)
 */

import { supabase } from '../../supabase/config.js';

(function() {
    'use strict';

    console.log('👤 Admin View Student Profile (Supabase) ready');

    // ============================================
    // ROLE & SESSION GUARD
    // ============================================

    let currentUser = null;
    const currentUserStr = localStorage.getItem('currentUser');
    if (currentUserStr) {
        try {
            currentUser = JSON.parse(currentUserStr);
        } catch (e) {
            console.warn('Session parse error:', e);
        }
    }

    if (!currentUser) {
        currentUser = {
            role: 'admin',
            email: 'admin@hiraya.edu.ph',
            displayName: localStorage.getItem('hes_admin_name') || 'Admin',
            firstName: localStorage.getItem('hes_admin_name') || 'Admin'
        };
    }

    // ============================================
    // DOM ELEMENTS
    // ============================================

    const alertContainer = document.getElementById('alertContainer');
    const avatarInitial = document.getElementById('avatarInitial');
    const studentName = document.getElementById('studentName');
    const studentEmail = document.getElementById('studentEmail');
    const studentIdNumber = document.getElementById('studentIdNumber');
    const studentRegistered = document.getElementById('studentRegistered');
    const studentDaysActive = document.getElementById('studentDaysActive');
    const statusBadge = document.getElementById('statusBadge');
    const personalInfoGrid = document.getElementById('personalInfoGrid');
    const currentEnrollmentCard = document.getElementById('currentEnrollmentCard');
    const enrollmentInfoGrid = document.getElementById('enrollmentInfoGrid');
    const historyContainer = document.getElementById('historyContainer');

    // Mobile Menu
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');

    // ============================================
    // STATE
    // ============================================

    let currentStudent = null;
    let currentEnrollment = null;
    let enrollmentHistory = [];

    // ============================================
    // HELPER FUNCTIONS
    // ============================================

    function showAlert(message, type = 'error') {
        if (!alertContainer) return;
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        const icon = type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle';
        alertDiv.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
        alertContainer.appendChild(alertDiv);

        setTimeout(() => {
            alertDiv.style.opacity = '0';
            setTimeout(() => alertDiv.remove(), 300);
        }, 5000);
    }

    function formatDate(dateString) {
        if (!dateString) return 'Not specified';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return dateString;
            return date.toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
            });
        } catch {
            return dateString;
        }
    }

    function calculateAge(birthdate) {
        if (!birthdate) return null;
        try {
            const birth = new Date(birthdate);
            if (isNaN(birth.getTime())) return null;
            const today = new Date();
            let age = today.getFullYear() - birth.getFullYear();
            const m = today.getMonth() - birth.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
                age--;
            }
            return age >= 0 ? age : null;
        } catch {
            return null;
        }
    }

    function calculateDaysActive(createdAt) {
        if (!createdAt) return 1;
        try {
            const created = new Date(createdAt);
            if (isNaN(created.getTime())) return 1;
            const today = new Date();
            const diffTime = Math.abs(today - created);
            return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
        } catch {
            return 1;
        }
    }

    // ============================================
    // LOAD STUDENT DETAILS FROM SUPABASE
    // ============================================

    async function loadStudentDetails() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const targetId = urlParams.get('id') || urlParams.get('student_id') || '';

            // 1. Fetch Student from Supabase
            let student = null;
            if (targetId) {
                try {
                    const { data: sData } = await supabase
                        .from('students')
                        .select('*')
                        .or(`id.eq.${targetId},lrn.eq.${targetId}`)
                        .maybeSingle();
                    if (sData) student = sData;
                } catch(e) {}
            }

            if (!student) {
                try {
                    const { data: sList } = await supabase
                        .from('students')
                        .select('*')
                        .limit(1);
                    if (sList && sList.length > 0) student = sList[0];
                } catch(e) {}
            }

            if (!student) {
                showAlert('No student profile found in database.', 'error');
                return;
            }

            currentStudent = student;

            // Update Edit Student button URL in header action bar
            const editBtn = document.getElementById('editStudentHeaderBtn');
            if (editBtn) {
                editBtn.href = `edit_student.html?id=${encodeURIComponent(student.id)}`;
            }

            // 2. Fetch Enrollments for this student
            let enrollments = [];
            try {
                const { data: eData } = await supabase
                    .from('enrollments')
                    .select('*')
                    .or(`student_id.eq.${student.id},email.eq.${student.email}`)
                    .order('created_at', { ascending: false });
                if (eData) enrollments = eData;
            } catch(e) {}

            enrollmentHistory = enrollments;
            currentEnrollment = enrollments.length > 0 ? enrollments[0] : null;

            // Render all UI components
            renderProfile();
            renderPersonalInfo();
            renderCurrentEnrollment();
            renderHistory();
            await renderStudentViolations();

        } catch (error) {
            console.error('❌ Error loading student details:', error);
            showAlert('Failed to load student details: ' + error.message, 'error');
        }
    }

    // ============================================
    // RENDER PROFILE CARD
    // ============================================

    function renderProfile() {
        const student = currentStudent;
        if (!student) return;

        const fName = (student.first_name || '').trim();
        const lName = (student.last_name || '').trim();
        const fullName = `${fName} ${lName}`.trim() || 'Student';
        const initial = fullName.charAt(0).toUpperCase() || 'S';
        const daysActive = calculateDaysActive(student.created_at);

        if (avatarInitial) avatarInitial.textContent = initial;
        if (studentName) studentName.textContent = fullName;
        if (studentEmail) studentEmail.textContent = student.email || '—';
        if (studentIdNumber) studentIdNumber.textContent = student.lrn || 'Not assigned';
        if (studentRegistered) studentRegistered.textContent = formatDate(student.created_at);
        if (studentDaysActive) studentDaysActive.textContent = daysActive;

        const statusRaw = (currentEnrollment?.status || '').toLowerCase();
        const isApproved = currentEnrollment ? (statusRaw === 'approved' || statusRaw === 'enrolled') : student.documents_status === 'complete';
        const statusText = isApproved ? 'Enrolled' : 'Pending Verification';
        const statusClass = isApproved ? 'badge-enrolled' : 'badge-pending';

        if (statusBadge) {
            statusBadge.className = `profile-badge ${statusClass}`;
            statusBadge.innerHTML = `
                <i class="fas fa-${isApproved ? 'check-circle' : 'clock'}"></i>
                Current Status: ${statusText}
            `;
        }
    }

    // ============================================
    // RENDER PERSONAL INFO
    // ============================================

    function renderPersonalInfo() {
        if (!personalInfoGrid || !currentStudent) return;
        const student = currentStudent;

        const bDate = student.date_of_birth || student.birth_date;
        const age = calculateAge(bDate);
        const gender = student.gender || 'Not specified';
        const genderIcon = gender.toLowerCase() === 'male' ? 'mars' : (gender.toLowerCase() === 'female' ? 'venus' : 'user');

        personalInfoGrid.innerHTML = `
            <div class="info-item">
                <div class="info-label">First Name</div>
                <div class="info-value">
                    <i class="fas fa-user"></i>
                    ${student.first_name || 'Not specified'}
                </div>
            </div>
            <div class="info-item">
                <div class="info-label">Middle Name</div>
                <div class="info-value">
                    <i class="fas fa-user"></i>
                    ${student.middle_name || '—'}
                </div>
            </div>
            <div class="info-item">
                <div class="info-label">Last Name</div>
                <div class="info-value">
                    <i class="fas fa-user"></i>
                    ${student.last_name || 'Not specified'}
                </div>
            </div>
            <div class="info-item">
                <div class="info-label">Birthdate</div>
                <div class="info-value">
                    <i class="fas fa-cake-candles"></i>
                    ${bDate ? formatDate(bDate) : 'Not specified'}
                    ${age !== null ? `<span class="age-text" style="color: #64748b; font-size: 13px; margin-left: 6px;">(Age: ${age} years)</span>` : ''}
                </div>
            </div>
            <div class="info-item">
                <div class="info-label">Gender</div>
                <div class="info-value">
                    <i class="fas fa-${genderIcon}"></i>
                    ${gender}
                </div>
            </div>
            <div class="info-item">
                <div class="info-label">Student LRN / ID Number</div>
                <div class="info-value">
                    <i class="fas fa-qrcode"></i>
                    ${student.lrn || 'Not assigned'}
                </div>
            </div>
        `;
    }

    // ============================================
    // RENDER CURRENT ENROLLMENT
    // ============================================

    function renderCurrentEnrollment() {
        if (!enrollmentInfoGrid) return;

        const student = currentStudent;
        const enr = currentEnrollment;

        const gradeName = enr?.grade_level || student?.grade_level || 'Grade 11';
        const strand = enr?.strand || student?.strand || (gradeName.includes('11') || gradeName.includes('12') ? 'TVL-ICT' : '');
        const schoolYear = enr?.school_year || enr?.last_school_year || '2025-2026';
        const form138 = student?.form_138_url;

        let strandHtml = '';
        if (strand) {
            strandHtml = `
                <div class="info-item">
                    <div class="info-label">Strand</div>
                    <div class="info-value">
                        <i class="fas fa-tag"></i>
                        ${strand}
                    </div>
                </div>
            `;
        }

        let form138Html = '';
        if (form138) {
            form138Html = `
                <div class="info-item" style="grid-column: 1 / -1; border-bottom: none;">
                    <div class="info-label">Form 138 (Report Card)</div>
                    <div class="info-value">
                        <i class="fas fa-file-pdf" style="color: #dc2626;"></i>
                        <a href="${form138}" target="_blank" class="document-link" style="color: #0b2b4a; font-weight: 600; text-decoration: underline;">
                            View Submitted Document
                        </a>
                    </div>
                </div>
            `;
        }

        enrollmentInfoGrid.innerHTML = `
            <div class="info-item">
                <div class="info-label">Grade Level</div>
                <div class="info-value">
                    <i class="fas fa-layer-group"></i>
                    ${gradeName}
                </div>
            </div>
            ${strandHtml}
            <div class="info-item">
                <div class="info-label">School Year</div>
                <div class="info-value">
                    <i class="fas fa-calendar"></i>
                    ${schoolYear}
                </div>
            </div>
            <div class="info-item">
                <div class="info-label">Enrollment Date</div>
                <div class="info-value">
                    <i class="fas fa-clock"></i>
                    ${formatDate(enr?.created_at || student?.created_at)}
                </div>
            </div>
            ${form138Html}
        `;

        // Update view link in card header
        if (currentEnrollmentCard) {
            const viewLink = currentEnrollmentCard.querySelector('.view-link');
            if (viewLink) {
                viewLink.href = `view_enrollment.html?id=${encodeURIComponent(enr?.id || student?.id)}`;
            }
        }
    }

    // ============================================
    // RENDER ENROLLMENT HISTORY
    // ============================================

    function renderHistory() {
        if (!historyContainer) return;

        if (enrollmentHistory.length === 0) {
            historyContainer.innerHTML = `
                <div class="no-data" style="text-align: center; padding: 30px; color: #94a3b8;">
                    <i class="fas fa-file-signature" style="font-size: 32px; margin-bottom: 8px; color: #cbd5e1;"></i>
                    <h3 style="color: #64748b; font-size: 15px;">No Enrollment Records</h3>
                    <p style="margin: 0; font-size: 13px;">This student has no prior enrollment history recorded.</p>
                </div>
            `;
            return;
        }

        let html = `
            <table class="enrollments-table" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr>
                        <th>School Year</th>
                        <th>Grade Level</th>
                        <th>Strand</th>
                        <th>Status</th>
                        <th>Applied Date</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
        `;

        enrollmentHistory.forEach(record => {
            const rawStatus = (record.status || '').toLowerCase();
            let statusText = 'Pending';
            let statusClass = 'badge-pending';
            if (rawStatus === 'approved' || rawStatus === 'enrolled') {
                statusText = 'Enrolled';
                statusClass = 'badge-enrolled';
            } else if (rawStatus === 'rejected') {
                statusText = 'Rejected';
                statusClass = 'badge-rejected';
            }

            html += `
                <tr>
                    <td style="font-weight: 600;">${record.school_year || record.last_school_year || '2025-2026'}</td>
                    <td>${record.grade_level || 'Grade 11'}</td>
                    <td>${record.strand ? `<span class="strand-tag">${record.strand}</span>` : '—'}</td>
                    <td>
                        <span class="badge ${statusClass}">
                            ${statusText}
                        </span>
                    </td>
                    <td>${formatDate(record.created_at)}</td>
                    <td>
                        <a href="view_enrollment.html?id=${encodeURIComponent(record.id)}" class="view-link" style="color: #0b2b4a; font-weight: 600;">
                            View <i class="fas fa-eye"></i>
                        </a>
                    </td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        `;

        historyContainer.innerHTML = html;
    }

    // ============================================
    // RENDER GUIDANCE & DISCIPLINARY RECORDS
    // ============================================
    async function renderStudentViolations() {
        const container = document.getElementById('studentViolationsContainer');
        if (!container || !currentStudent) return;

        try {
            let query = supabase.from('student_violations').select('*');
            if (currentStudent.id && currentStudent.lrn) {
                query = query.or(`student_id.eq.${currentStudent.id},lrn.eq.${currentStudent.lrn}`);
            } else if (currentStudent.id) {
                query = query.eq('student_id', currentStudent.id);
            } else if (currentStudent.lrn) {
                query = query.eq('lrn', currentStudent.lrn);
            }

            const { data: vList, error: vErr } = await query.order('incident_date', { ascending: false });

            if (vErr || !vList || vList.length === 0) {
                container.innerHTML = `
                    <div style="background: #ecfdf5; border: 1.5px solid #a7f3d0; border-radius: 10px; padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <i class="fas fa-check-circle" style="color: #10b981; font-size: 24px;"></i>
                            <div>
                                <strong style="color: #065f46; font-size: 14px; display: block;">Clean Disciplinary Record</strong>
                                <span style="font-size: 12.5px; color: #047857;">This student has no recorded offenses or pending guidance referrals.</span>
                            </div>
                        </div>
                        <a href="guidance_violations.html" style="padding: 6px 14px; border-radius: 6px; background: #0b2b4a; color: #fff; text-decoration: none; font-size: 12px; font-weight: 600;">
                            <i class="fas fa-plus"></i> Log Violation
                        </a>
                    </div>
                `;
                return;
            }

            let html = `
                <table class="enrollments-table" style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead>
                        <tr style="background: #f8fafc; border-bottom: 1.5px solid #e2e8f0;">
                            <th style="padding: 10px 14px; text-align: left;">Incident / Violation</th>
                            <th style="padding: 10px 14px; text-align: left;">Offense Level</th>
                            <th style="padding: 10px 14px; text-align: left;">Date</th>
                            <th style="padding: 10px 14px; text-align: left;">Guidance Action Taken</th>
                            <th style="padding: 10px 14px; text-align: left;">Status</th>
                            <th style="padding: 10px 14px; text-align: right;">Action</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            vList.forEach(v => {
                const rawStatus = (v.status || 'Pending').toLowerCase();
                let statusBadgeStyle = 'background: #f1f5f9; color: #475569;';
                if (rawStatus === 'resolved') statusBadgeStyle = 'background: #d1fae5; color: #065f46;';
                else if (rawStatus.includes('counseling')) statusBadgeStyle = 'background: #e0e7ff; color: #3730a3;';
                else if (rawStatus.includes('progress')) statusBadgeStyle = 'background: #fef3c7; color: #854d0e;';

                const formattedDate = v.incident_date ? new Date(v.incident_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';

                html += `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 12px 14px;">
                            <strong style="color: #0f172a; display: block;">${v.violation_title || 'Incident'}</strong>
                            <small style="color: #64748b;">${v.violation_category || 'General'}</small>
                        </td>
                        <td style="padding: 12px 14px;">
                            <span style="padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 700; background: #dbeafe; color: #1e40af;">
                                ${v.offense_level || '1st Offense'}
                            </span>
                        </td>
                        <td style="padding: 12px 14px; color: #475569;">${formattedDate}</td>
                        <td style="padding: 12px 14px;">
                            <span style="font-weight: 600; color: #0b2b4a;">${v.action_taken || 'Pending Review'}</span>
                            ${v.sanction_details ? `<small style="display: block; color: #64748b;">${v.sanction_details}</small>` : ''}
                        </td>
                        <td style="padding: 12px 14px;">
                            <span style="padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; ${statusBadgeStyle}">
                                ${v.status || 'Pending'}
                            </span>
                        </td>
                        <td style="padding: 12px 14px; text-align: right;">
                            <a href="guidance_violations.html" style="padding: 5px 10px; border-radius: 6px; background: #1B2A4A; color: #fff; text-decoration: none; font-size: 11.5px; font-weight: 600;">
                                <i class="fas fa-gavel"></i> Update Action
                            </a>
                        </td>
                    </tr>
                `;
            });

            html += `</tbody></table>`;
            container.innerHTML = html;

        } catch (e) {
            console.warn('Error loading student violations:', e);
            container.innerHTML = `<p style="color: #64748b; font-size: 12px;">No guidance records found.</p>`;
        }
    }

    // ============================================
    // DELETE STUDENT (WITH MANDATORY REASON PROMPT & TRANSFER DESTINATION)
    // ============================================
    window.openDeleteStudentModal = function() {
        if (!currentStudent) return;
        const modal = document.getElementById('modalDeleteStudent');
        const targetName = document.getElementById('deleteTargetStudentName');
        const sName = `${currentStudent.first_name || ''} ${currentStudent.last_name || ''}`.trim() || 'this student';

        if (targetName) targetName.textContent = sName;

        // Reset or set defaults
        const effDateInput = document.getElementById('effectiveDateView');
        if (effDateInput) {
            effDateInput.value = new Date().toISOString().split('T')[0];
        }

        const catSelect = document.getElementById('deleteReasonCategory');
        const transferGroup = document.getElementById('transferDetailsGroupView');
        const destInput = document.getElementById('destinationSchoolView');
        if (catSelect && transferGroup) {
            const isTransfer = catSelect.value === 'Transferred to Another School';
            transferGroup.style.display = isTransfer ? 'block' : 'none';
            if (destInput) {
                if (isTransfer) destInput.setAttribute('required', 'required');
                else destInput.removeAttribute('required');
            }
        }

        if (modal) modal.style.display = 'flex';
    };

    window.closeDeleteStudentModal = function() {
        const modal = document.getElementById('modalDeleteStudent');
        if (modal) modal.style.display = 'none';
        const notes = document.getElementById('deleteReasonNotes');
        if (notes) notes.value = '';
        const destInput = document.getElementById('destinationSchoolView');
        if (destInput) destInput.value = '';
    };

    // Listen for reason category change to toggle transfer destination school field
    const deleteReasonCatSelect = document.getElementById('deleteReasonCategory');
    const transferDetailsGroupView = document.getElementById('transferDetailsGroupView');
    const destinationSchoolView = document.getElementById('destinationSchoolView');

    if (deleteReasonCatSelect && transferDetailsGroupView) {
        deleteReasonCatSelect.addEventListener('change', function() {
            if (this.value === 'Transferred to Another School') {
                transferDetailsGroupView.style.display = 'block';
                if (destinationSchoolView) destinationSchoolView.setAttribute('required', 'required');
            } else {
                transferDetailsGroupView.style.display = 'none';
                if (destinationSchoolView) destinationSchoolView.removeAttribute('required');
            }
        });
    }

    window.confirmDeleteWithReason = async function() {
        if (!currentStudent) return;

        const category = document.getElementById('deleteReasonCategory')?.value || 'Transferred to Another School';
        const destSchool = document.getElementById('destinationSchoolView')?.value.trim() || '';
        const effDate = document.getElementById('effectiveDateView')?.value || new Date().toISOString().split('T')[0];
        const notes = document.getElementById('deleteReasonNotes')?.value.trim() || '';
        const removalMode = document.querySelector('input[name="removalModeView"]:checked')?.value || 'archive';

        if (category === 'Transferred to Another School' && !destSchool) {
            alert('Please specify the destination school or receiving institution where the student is transferring.');
            document.getElementById('destinationSchoolView')?.focus();
            return;
        }

        const sName = `${currentStudent.first_name || ''} ${currentStudent.last_name || ''}`.trim() || 'this student';
        const sLrn = currentStudent.lrn || 'N/A';
        const confirmBtn = document.getElementById('btnConfirmDeleteWithReason');

        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        }

        try {
            showAlert('Processing removal record and registering audit log...', 'info');

            // 1. If Transfer, record in transferees registry
            if (category === 'Transferred to Another School') {
                try {
                    await supabase.from('transferees').insert([{
                        student_id: currentStudent.id,
                        type: 'Transferred Out',
                        from_school: 'Placido L. Señor National High School',
                        to_school: destSchool,
                        reason: notes ? `${category}: ${notes}` : category,
                        status: 'Transferred',
                        requested_date: new Date(effDate).toISOString(),
                        created_at: new Date().toISOString()
                    }]);
                    console.log('✅ Formally recorded to transferees registry');
                } catch (tErr) {
                    console.warn('Transferees table insert warning:', tErr);
                }
            }

            // 2. Perform Removal or Archival
            if (removalMode === 'permanent') {
                const { error: delErr } = await supabase
                    .from('students')
                    .delete()
                    .eq('id', currentStudent.id);

                if (delErr) throw delErr;

                if (currentStudent.user_id) {
                    try {
                        await supabase.from('users').delete().eq('id', currentStudent.user_id);
                    } catch (uDelErr) {
                        console.warn('User account delete warning:', uDelErr);
                    }
                }
            } else {
                // Archive / Mark as Transferred Out (Safe soft delete preserving records)
                const { error: updErr } = await supabase
                    .from('students')
                    .update({
                        documents_status: `Archived: ${category}${destSchool ? ' -> ' + destSchool : ''}`,
                        student_type: category.includes('Transfer') ? 'Transferee' : 'Inactive',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', currentStudent.id);

                if (updErr) {
                    console.warn('Update student status warning:', updErr);
                }
            }

            // 3. Log to activity_logs table
            try {
                await supabase.from('activity_logs').insert([{
                    user_id: currentUser?.id && currentUser.id.length === 36 ? currentUser.id : null,
                    role: 'admin',
                    action: `Student ${removalMode === 'permanent' ? 'Deleted' : 'Archived / Transferred Out'}`,
                    details: `Student: ${sName} (LRN: ${sLrn}) | Reason: ${category}${destSchool ? ' | Destination: ' + destSchool : ''}${notes ? ' | Notes: ' + notes : ''} | Mode: ${removalMode === 'permanent' ? 'Permanent Delete' : 'Archived / Inactive'} | Date: ${effDate}`,
                    timestamp: new Date().toISOString()
                }]);
            } catch(logErr) {
                console.warn('Activity log fallback:', logErr);
            }

            window.closeDeleteStudentModal();
            showAlert(`✅ Student "${sName}" ${removalMode === 'permanent' ? 'permanently removed' : 'marked as ' + (category.includes('Transfer') ? 'Transferred Out' : 'Inactive')} successfully! Reason recorded: "${category}".`, 'success');

            setTimeout(() => {
                window.location.href = 'student.html';
            }, 1500);

        } catch (error) {
            console.error('❌ Error removing student with reason:', error);
            showAlert('Failed to remove student: ' + error.message, 'error');
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Confirm Removal';
            }
        }
    };

    // ============================================
    // MOBILE MENU
    // ============================================

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            sidebar.classList.toggle('active');
        });
    }

    document.addEventListener('click', function(e) {
        if (sidebar && sidebar.classList.contains('active') && !sidebar.contains(e.target) && (!menuToggle || !menuToggle.contains(e.target))) {
            sidebar.classList.remove('active');
        }
    });

    // ============================================
    // INIT
    // ============================================

    loadStudentDetails();

})();