/**
 * HES Admin - Enrollments Management (Supabase Dynamic Integration)
 * Requirements read STRICTLY from ENROLLMENTS table.
 */

import { supabase } from '../../supabase/config.js';
import { EmailNotificationService } from '../../js/email_service.js';

(function () {
    'use strict';

    console.log('📋 Admin Enrollments Management (Supabase) ready');

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

    console.log('✅ Admin session verified for enrollments:', currentUser.email || 'Admin');

    // ============================================
    // DOM ELEMENTS
    // ============================================

    const tableBody = document.getElementById('tableBody');
    const recordCount = document.getElementById('recordCount');
    const alertContainer = document.getElementById('alertContainer');
    const filterForm = document.getElementById('filterForm');
    const statusFilter = document.getElementById('statusFilter');
    const gradeFilter = document.getElementById('gradeFilter');
    const strandFilter = document.getElementById('strandFilter');
    const searchInput = document.getElementById('searchInput');

    // Stats Counters
    const totalEnrollmentsEl = document.getElementById('totalEnrollments');
    const pendingCountEl = document.getElementById('pendingCount');
    const enrolledCountEl = document.getElementById('enrolledCount');
    const rejectedCountEl = document.getElementById('rejectedCount');

    // Reject Modal Elements
    const rejectModal = document.getElementById('rejectModal');
    const rejectForm = document.getElementById('rejectForm');
    const rejectEnrollmentId = document.getElementById('rejectEnrollmentId');
    const rejectStudentName = document.getElementById('rejectStudentName');
    const rejectionReason = document.getElementById('rejectionReason');
    const closeRejectModalBtn = document.getElementById('closeRejectModalBtn');
    const cancelRejectBtn = document.getElementById('cancelRejectBtn');

    // Mobile Menu
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');

    // ============================================
    // STATE
    // ============================================

    let rawEnrollments = [];
    let filteredEnrollments = [];

    // ============================================
    // ALERT SYSTEM
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
        }, 4000);
    }

    // ============================================
    // REQUIREMENTS HELPER — STRICTLY FROM ENROLLMENTS TABLE
    // ============================================

    function computeEnrollmentRequirements(enr) {
        const submitted = [];
        const missing = [];

        if (!enr) {
            return { submitted, missing, isComplete: false };
        }

        const rawStudentType = String(enr.student_type || '').toLowerCase();
        const isTransferee =
            rawStudentType.includes('transfer') ||
            rawStudentType.includes('different') ||
            rawStudentType.includes('transferee');

        const gradeLevelStr = String(enr.grade_level || '');
        const isSeniorHigh =
            gradeLevelStr.includes('11') ||
            gradeLevelStr.includes('12');

        const has = (v) => typeof v === 'string' && v.trim().length > 0;

        // 1. Report Card / Form 138 (required for all)
        if (has(enr.form_138_url) || has(enr.report_card_url)) {
            submitted.push('Report Card (Form 138)');
        } else {
            missing.push('Report Card (Form 138)');
        }

        // 2. PSA Birth Certificate (required for all)
        if (has(enr.psa_birth_cert_url)) {
            submitted.push('PSA Birth Certificate');
        } else {
            missing.push('PSA Birth Certificate');
        }

        // 3. Good Moral Certificate (required for all)
        if (has(enr.good_moral_cert_url)) {
            submitted.push('Good Moral Certificate');
        } else {
            missing.push('Good Moral Certificate');
        }

        // 4. 2x2 ID Picture (required for all)
        if (has(enr.two_by_two_picture_url)) {
            submitted.push('2x2 ID Picture (White Background)');
        } else {
            missing.push('2x2 ID Picture (White Background)');
        }

        // 5. Form 137 (transferees only)
        if (isTransferee) {
            if (has(enr.form_137_url)) {
                submitted.push('Form 137 (Permanent Record)');
            } else {
                missing.push('Form 137 (Permanent Record)');
            }
        }

        // 6. JHS Certificate of Completion
        //    - SHS (11/12): optional/followable → NOT counted as blocking missing
        //    - JHS (7-10): only shown if present, NOT counted as missing
        if (has(enr.certificate_of_completion_url)) {
            submitted.push('JHS Certificate of Completion');
        }

        const isComplete = missing.length === 0;

        return { submitted, missing, isComplete };
    }

    // ============================================
    // LOAD ENROLLMENTS FROM SUPABASE
    // ============================================

    async function loadEnrollments() {
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 40px; color: #64748b;">
                        <i class="fas fa-circle-notch fa-spin" style="font-size: 24px; color: #0b2b4a; margin-bottom: 8px;"></i>
                        <p style="margin: 0;">Loading enrollment applications from database...</p>
                    </td>
                </tr>
            `;
        }

        try {
            // 1. Fetch Enrollments
            let enrollmentsData = [];
            try {
                const { data: eData, error: eErr } = await supabase
                    .from('enrollments')
                    .select('*')
                    .order('created_at', { ascending: false });
                if (!eErr && eData) enrollmentsData = eData;
            } catch (e) {
                console.warn('Enrollments fetch error:', e);
            }

            // 2. Fetch Students (for name/email/LRN enrichment only — NOT for requirements)
            let studentsData = [];
            try {
                const { data: sData, error: sErr } = await supabase
                    .from('students')
                    .select('*');
                if (!sErr && sData) studentsData = sData;
            } catch (e) {
                console.warn('Students fetch error:', e);
            }

            // 3. Fetch Users (for user_id linking only)
            let usersData = [];
            try {
                const { data: uData } = await supabase
                    .from('users')
                    .select('id, first_name, last_name, email, role, student_id');
                if (uData) usersData = uData;
            } catch (e) { }

            // Combine and Normalize Enrollments
            const items = [];
            const seenStudentIds = new Set();
            const seenEnrollmentKeys = new Set();

            // Process explicit enrollments (prevent duplicate copies per student)
            enrollmentsData.forEach(enr => {
                const student = studentsData.find(s => s.id === enr.student_id || (s.email && enr.email && s.email.toLowerCase() === enr.email.toLowerCase())) || {};
                const user = usersData.find(u => u.id === student.user_id || u.student_id === student.id || (u.email && enr.email && u.email.toLowerCase() === enr.email.toLowerCase())) || {};

                const email = (enr.email || student.email || user.email || '').trim().toLowerCase();
                const dedupeKey = email || (student.id ? `sid_${student.id}` : enr.id);
                if (dedupeKey) {
                    if (seenEnrollmentKeys.has(dedupeKey)) return;
                    seenEnrollmentKeys.add(dedupeKey);
                }

                if (student.id) seenStudentIds.add(student.id);

                const fName = (enr.first_name || student.first_name || user.first_name || '').trim();
                const lName = (enr.last_name || student.last_name || user.last_name || '').trim();
                const fullName = `${fName} ${lName}`.trim() || 'Student Applicant';
                const displayEmail = enr.email || student.email || user.email || '—';
                const lrn = student.lrn || enr.lrn || 'Not assigned';
                const gradeLevel = enr.grade_level || student.grade_level || 'Grade 11';
                const strand = enr.strand || student.strand || (gradeLevel.includes('11') || gradeLevel.includes('12') ? 'TVL-ICT' : '');
                const schoolYear = enr.school_year || enr.last_school_year || '2025-2026';

                // Status mapping
                let status = 'Pending';
                const rawStatus = (enr.status || '').toLowerCase();
                if (rawStatus === 'approved' || rawStatus === 'enrolled') status = 'Enrolled';
                else if (rawStatus === 'rejected') status = 'Rejected';
                else status = 'Pending';

                // ===== REQUIREMENTS: STRICTLY FROM ENROLLMENTS TABLE =====
                const { submitted, missing, isComplete } = computeEnrollmentRequirements(enr);

                items.push({
                    id: enr.id,
                    student_id: student.id || enr.student_id,
                    user_id: user.id || null,
                    first_name: fName,
                    last_name: lName,
                    middle_name: enr.middle_name || student.middle_name || null,
                    lrn: student.lrn || enr.lrn || null,
                    date_of_birth: enr.date_of_birth || enr.dob || student.date_of_birth || null,
                    contact_number: enr.contact_number || enr.guardian_contact || student.contact_number || null,
                    two_by_two_picture_url: enr.two_by_two_picture_url || null,
                    fullname: fullName,
                    email: displayEmail,
                    id_number: lrn !== 'Not assigned' ? lrn : null,
                    grade_name: gradeLevel,
                    grade_level: gradeLevel,
                    strand: strand,
                    school_year: schoolYear,
                    status: status,
                    created_at: enr.created_at || new Date().toISOString(),
                    has_missing: !isComplete && missing.length > 0,
                    missing_count: isComplete ? 0 : missing.length,
                    missing_list: isComplete ? [] : missing,
                    submitted_list: submitted
                });
            });

            // NOTE: Students without an enrollment row are intentionally EXCLUDED here.
            // If you want to show them, add them with has_missing=false and a
            // "No enrollment form" flag — but they have no requirements to display.

            // Sort newest first
            items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            rawEnrollments = items;
            applyFilters();

        } catch (error) {
            console.error('❌ Error loading enrollments from Supabase:', error);
            showAlert('Failed to load enrollments from database: ' + error.message, 'error');
            applyFilters();
        }
    }

    // ============================================
    // UPDATE STATS
    // ============================================

    function updateStats() {
        const total = rawEnrollments.length;
        const pending = rawEnrollments.filter(e => e.status === 'Pending').length;
        const enrolled = rawEnrollments.filter(e => e.status === 'Enrolled').length;
        const rejected = rawEnrollments.filter(e => e.status === 'Rejected').length;

        if (totalEnrollmentsEl) totalEnrollmentsEl.textContent = total;
        if (pendingCountEl) pendingCountEl.textContent = pending;
        if (enrolledCountEl) enrolledCountEl.textContent = enrolled;
        if (rejectedCountEl) rejectedCountEl.textContent = rejected;
    }

    // ============================================
    // FILTER & RENDER
    // ============================================

    function applyFilters() {
        const statusVal = statusFilter ? statusFilter.value : '';
        const gradeVal = gradeFilter ? gradeFilter.value : '';
        const strandVal = strandFilter ? strandFilter.value : '';
        const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';

        filteredEnrollments = rawEnrollments.filter(item => {
            if (statusVal && item.status.toLowerCase() !== statusVal.toLowerCase()) return false;
            if (gradeVal && !item.grade_name.toLowerCase().includes(gradeVal.toLowerCase())) return false;
            if (strandVal && !item.strand.toLowerCase().includes(strandVal.toLowerCase())) return false;
            if (searchVal) {
                const matchName = item.fullname.toLowerCase().includes(searchVal);
                const matchEmail = item.email.toLowerCase().includes(searchVal);
                const matchId = (item.id_number || '').toLowerCase().includes(searchVal);
                const matchGrade = item.grade_name.toLowerCase().includes(searchVal);
                if (!matchName && !matchEmail && !matchId && !matchGrade) return false;
            }
            return true;
        });

        updateStats();
        renderTable();
    }

    // ============================================
    // RENDER TABLE
    // ============================================

    function renderTable() {
        if (!tableBody) return;

        if (recordCount) {
            recordCount.textContent = `Total: ${filteredEnrollments.length} records`;
        }

        if (filteredEnrollments.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8">
                        <div class="no-data" style="text-align: center; padding: 40px; color: #94a3b8;">
                            <i class="fas fa-file-signature" style="font-size: 36px; margin-bottom: 12px; color: #cbd5e1;"></i>
                            <h3 style="color: #64748b; font-size: 16px; margin-bottom: 4px;">No Enrollments Found</h3>
                            <p style="font-size: 13px; margin: 0;">No enrollment applications match your filter criteria.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        filteredEnrollments.forEach(enrollment => {
            const dateObj = new Date(enrollment.created_at);
            const formattedDate = isNaN(dateObj.getTime()) ? '—' : dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const initial = enrollment.fullname.charAt(0).toUpperCase();

            // Requirements badge — driven entirely by enrollments table
            let requirementsHtml = '';
            if (enrollment.has_missing && enrollment.status === 'Pending') {
                requirementsHtml = `
                    <div class="requirements-warning" style="display: flex; align-items: center; gap: 8px;">
                        <span class="missing-badge" style="background: #fee2e2; color: #dc2626; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">
                            <i class="fas fa-exclamation-triangle"></i> ${enrollment.missing_count} missing
                        </span>
                        <button class="btn-notify-missing" 
                                data-student-name="${enrollment.fullname.replace(/"/g, '&quot;')}"
                                data-user-id="${enrollment.user_id || ''}"
                                data-student-id="${enrollment.student_id || enrollment.id || ''}"
                                data-email="${(enrollment.email || '').replace(/"/g, '&quot;')}"
                                data-missing-list="${JSON.stringify(enrollment.missing_list).replace(/"/g, '&quot;')}"
                                style="background: #0b2b4a; color: #FFD700; border: none; padding: 3px 8px; border-radius: 6px; font-size: 11px; cursor: pointer;">
                            <i class="fas fa-bell"></i> Notify
                        </button>
                    </div>
                `;
            } else if (enrollment.status === 'Pending') {
                requirementsHtml = `<span class="complete-badge" style="background: #d1fae5; color: #065f46; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;"><i class="fas fa-check-circle"></i> Complete</span>`;
            } else {
                requirementsHtml = `<span class="grade-tag" style="color: #64748b;">Complete</span>`;
            }

            // Status badge
            const statusLower = enrollment.status.toLowerCase();
            const statusClass = `badge-${statusLower}`;

            // Action Menu Items for Manage Dropdown
            let menuItemsHtml = `
                <a href="view_enrollment.html?id=${enrollment.id}" class="manage-item view-item" title="View Full Details">
                    <i class="fas fa-eye"></i>
                    <span>View Details</span>
                </a>
            `;

            if (enrollment.status === 'Pending') {
                menuItemsHtml += `
                    <button type="button" class="manage-item approve-item" onclick="window.approveEnrollment('${enrollment.id}')" title="Approve Enrollment${enrollment.has_missing ? ' (Has missing requirements)' : ''}">
                        <i class="fas fa-check-circle"></i>
                        <span>Approve Application</span>
                    </button>
                    <button type="button" class="manage-item reject-item" onclick="window.openRejectModal('${enrollment.id}', '${enrollment.fullname.replace(/'/g, "\\'")}')" title="Reject Application">
                        <i class="fas fa-times-circle"></i>
                        <span>Reject Application</span>
                    </button>
                `;
            } else if (enrollment.status === 'Enrolled') {
                menuItemsHtml += `
                    <a href="generate_id.html?enrollment_id=${enrollment.id}${enrollment.student_id ? '&id=' + enrollment.student_id : ''}" class="manage-item id-item" title="Generate Official Student ID">
                        <i class="fas fa-id-card"></i>
                        <span>Generate Student ID</span>
                    </a>
                `;
            } else if (enrollment.status === 'Rejected') {
                menuItemsHtml += `
                    <button type="button" class="manage-item approve-item" onclick="window.approveEnrollment('${enrollment.id}')" title="Reconsider & Approve Application">
                        <i class="fas fa-check-circle"></i>
                        <span>Approve Application</span>
                    </button>
                `;
            }

            menuItemsHtml += `
                <div class="manage-divider"></div>
                <button type="button" class="manage-item delete-item" onclick="window.deleteEnrollment('${enrollment.id}', '${enrollment.fullname.replace(/'/g, "\\'")}')" title="Delete Record">
                    <i class="fas fa-trash-alt"></i>
                    <span>Delete Record</span>
                </button>
            `;

            const manageDropdownHtml = `
                <div class="manage-dropdown">
                    <button type="button" class="btn-manage" aria-expanded="false" title="Manage Enrollment Actions">
                        <span>Manage</span>
                        <i class="fas fa-chevron-down"></i>
                    </button>
                    <div class="manage-menu">
                        ${menuItemsHtml}
                    </div>
                </div>
            `;

            const gradeNum = parseInt(String(enrollment.grade_level || '').replace(/\D/g, ''), 10);
            const showStrand = gradeNum >= 11 && enrollment.strand;

            html += `
                <tr>
                    <td>
                        <div class="student-info" style="display: flex; align-items: center; gap: 10px;">
                            <div class="student-avatar" style="width: 36px; height: 36px; border-radius: 50%; background: #0b2b4a; color: #FFD700; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px;">${initial}</div>
                            <div class="student-details">
                                <h4 style="margin: 0; font-size: 14px; font-weight: 600; color: #0f172a;">${enrollment.fullname}</h4>
                                <span style="font-size: 12px; color: #64748b;"><i class="fas fa-envelope"></i> ${enrollment.email}</span>
                            </div>
                        </div>
                    </td>
                    <td>
                        ${enrollment.id_number ? `<span class="id-badge" style="font-family: monospace; font-weight: 600; color: #0b2b4a;">${enrollment.id_number}</span>` : `<span class="grade-tag" style="color: #94a3b8;">Not assigned</span>`}
                    </td>
                    <td>
                        <span class="grade-tag" style="font-weight: 600;">${enrollment.grade_name}</span>
                        ${showStrand ? `<span class="strand-tag" style="display: inline-block; margin-left: 4px; padding: 2px 6px; border-radius: 4px; background: #e0f2fe; color: #0369a1; font-size: 11px; font-weight: 600;">${enrollment.strand}</span>` : ''}
                    </td>
                    <td><span class="grade-tag">${enrollment.school_year}</span></td>
                    <td><span class="badge ${statusClass}">${enrollment.status}</span></td>
                    <td>${requirementsHtml}</td>
                    <td><span class="grade-tag">${formattedDate}</span></td>
                    <td class="cell-center cell-actions">
                        ${manageDropdownHtml}
                    </td>
                </tr>
            `;
        });

        tableBody.innerHTML = html;

        // Manage Dropdown Toggles
        tableBody.querySelectorAll('.btn-manage').forEach(btn => {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                const dropdown = this.closest('.manage-dropdown');
                const row = this.closest('tr');
                const isOpen = dropdown.classList.contains('show');

                document.querySelectorAll('.manage-dropdown.show').forEach(d => {
                    d.classList.remove('show');
                    d.classList.remove('dropup');
                    const r = d.closest('tr');
                    if (r) r.classList.remove('dropdown-open');
                });

                if (!isOpen) {
                    const rect = this.getBoundingClientRect();
                    const spaceBelow = window.innerHeight - rect.bottom;
                    if (spaceBelow < 200) {
                        dropdown.classList.add('dropup');
                    } else {
                        dropdown.classList.remove('dropup');
                    }
                    dropdown.classList.add('show');
                    if (row) row.classList.add('dropdown-open');
                }
            });
        });

        // Notify Click Handlers
        document.querySelectorAll('.btn-notify-missing').forEach(btn => {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                const studentName = this.dataset.studentName;
                const userId = this.dataset.userId;
                const studentId = this.dataset.studentId;
                const email = this.dataset.email;
                let missingList = [];
                try {
                    missingList = JSON.parse(this.dataset.missingList || '[]');
                } catch {
                    missingList = [];
                }
                notifyMissing(studentName, missingList, userId, studentId, email);
            });
        });
    }

    // Close dropdowns when clicking anywhere outside
    document.addEventListener('click', function (e) {
        if (!e.target.closest('.manage-dropdown')) {
            document.querySelectorAll('.manage-dropdown.show').forEach(d => {
                d.classList.remove('show');
                d.classList.remove('dropup');
                const r = d.closest('tr');
                if (r) r.classList.remove('dropdown-open');
            });
        }
    });

    // ============================================
    // SUPABASE ACTIONS
    // ============================================

    window.approveEnrollment = async function (id) {
        const item = rawEnrollments.find(e => String(e.id) === String(id));
        if (!item) return;

        const confirmMsg = item.has_missing
            ? `⚠️ Notice: ${item.fullname || 'This student'} still has missing requirements.\n\nDo you want to proceed with APPROVING this enrollment and generating student login credentials?`
            : `Are you sure you want to APPROVE enrollment for ${item.fullname}?`;

        if (!confirm(confirmMsg)) return;

        try {
            showAlert('Processing enrollment approval & account provisioning...', 'info');

            const email = (item.email || '').trim().toLowerCase();
            let lastName = (item.last_name || '').trim();
            let firstName = (item.first_name || '').trim();
            const gradeName = item.grade_name || 'Grade 11';
            const strand = item.strand || '';

            if (!lastName && item.fullname) {
                const parts = item.fullname.trim().split(' ');
                firstName = parts.slice(0, -1).join(' ') || parts[0];
                lastName = parts[parts.length - 1];
            }
            if (!lastName) lastName = 'Student';

            let studentUserId = null;

            if (email) {
                const { data: existingUsers } = await supabase
                    .from('users')
                    .select('*')
                    .ilike('email', email);

                if (existingUsers && existingUsers.length > 0) {
                    studentUserId = existingUsers[0].id;
                    await supabase
                        .from('users')
                        .update({
                            password: lastName,
                            role: 'student',
                            first_name: firstName || existingUsers[0].first_name,
                            last_name: lastName || existingUsers[0].last_name,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', studentUserId);
                } else {
                    const { data: newUser } = await supabase
                        .from('users')
                        .insert([{
                            email: email,
                            password: lastName,
                            role: 'student',
                            first_name: firstName,
                            last_name: lastName,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        }])
                        .select();

                    if (newUser && newUser.length > 0) {
                        studentUserId = newUser[0].id;
                    }
                }
            }

            let studentTableId = item.student_id;
            const studentPayload = {
                first_name: firstName,
                last_name: lastName,
                middle_name: item.middle_name || null,
                email: email,
                grade_level: gradeName,
                strand: strand || null,
                lrn: item.lrn || item.id_number || ('141525' + String(Date.now()).slice(-6)),
                date_of_birth: item.date_of_birth || '2008-01-01',
                contact_number: item.contact_number || '09000000000',
                enrollment_id: id,
                two_by_two_picture_url: item.two_by_two_picture_url || null,
                avatar_url: item.two_by_two_picture_url || null,
                documents_status: 'complete',
                updated_at: new Date().toISOString()
            };

            if (studentTableId) {
                await supabase.from('students').update(studentPayload).eq('id', studentTableId);
            } else if (email) {
                studentPayload.created_at = new Date().toISOString();
                const { data: createdStudent, error: sErr } = await supabase
                    .from('students').insert([studentPayload]).select();

                if (createdStudent && createdStudent.length > 0) {
                    studentTableId = createdStudent[0].id;
                } else if (sErr) {
                    console.warn('Students insert notice:', sErr);
                }
            }

            if (studentUserId && studentTableId) {
                try {
                    await supabase.from('users').update({ student_id: studentTableId }).eq('id', studentUserId);
                } catch (uErr) {
                    console.warn('Users update notice:', uErr);
                }
            }

            await supabase
                .from('enrollments')
                .update({
                    status: 'enrolled',
                    student_id: studentTableId || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            const credsMsg = `Congratulations ${firstName}! Your enrollment application for ${gradeName} (${strand || 'General'}) S.Y. ${item.school_year || '2026-2027'} has been approved by the Administration.\n\nYour Student Portal Login Credentials:\n• Username (Gmail): ${email}\n• Initial Password: ${lastName}\n\nYou can now log in to the HES Student Portal. Upon your first login, please visit "My Profile" to update your password.`;

            const targetStudentId = studentUserId || studentTableId || null;
            await supabase.from('notifications').insert([{
                user_id: targetStudentId,
                role: 'student',
                title: '🎉 Enrollment Approved!',
                message: credsMsg,
                type: 'action',
                enrollment_id: id,
                read: false,
                is_read: false,
                created_at: new Date().toISOString()
            }]);

            const credsPayload = {
                email,
                lastName,
                firstName,
                studentFullName: item.fullname || `${firstName} ${lastName}`,
                gradeLevel: gradeName,
                strand: strand || '',
                schoolYear: item.school_year || '2026-2027',
                enrollmentId: id,
                studentId: studentTableId || studentUserId
            };

            try {
                await EmailNotificationService.sendCredentialsEmail({
                    ...credsPayload,
                    autoLaunchGmail: true
                });
            } catch (mailErr) {
                console.warn('Email dispatch notice:', mailErr);
            }

            showCredentialsModal(credsPayload);
            showAlert(`✅ Enrollment for ${item.fullname} approved! Account created (Username: ${email}, Password: ${lastName}).`, 'success');
            await loadEnrollments();

        } catch (error) {
            console.error('❌ Error approving enrollment:', error);
            showAlert('Failed to approve enrollment: ' + error.message, 'error');
        }
    };

    let activeCredentialsData = null;

    function showCredentialsModal(creds) {
        activeCredentialsData = creds;
        const credModal = document.getElementById('credentialsModal');
        const credName = document.getElementById('credStudentName');
        const credUser = document.getElementById('credUsername');
        const credPass = document.getElementById('credPassword');

        if (credName) credName.textContent = creds.studentFullName || `${creds.firstName} ${creds.lastName}`;
        if (credUser) credUser.textContent = creds.email;
        if (credPass) credPass.textContent = creds.lastName;

        const genIdBtn = document.getElementById('modalGenerateIdBtn');
        if (genIdBtn) {
            genIdBtn.href = `generate_id.html?enrollment_id=${creds.enrollmentId || ''}&id=${creds.studentId || ''}&email=${encodeURIComponent(creds.email || '')}`;
        }

        if (credModal) credModal.style.display = 'flex';
    }

    function closeCredentialsModal() {
        const credModal = document.getElementById('credentialsModal');
        if (credModal) credModal.style.display = 'none';
    }

    const closeCredBtn = document.getElementById('closeCredentialsBtn');
    const dismissCredBtn = document.getElementById('dismissCredentialsBtn');
    const copyUserBtn = document.getElementById('copyUsernameBtn');
    const copyPassBtn = document.getElementById('copyPasswordBtn');
    const sendGmailCredBtn = document.getElementById('sendGmailCredBtn');
    const copyEmailTextBtn = document.getElementById('copyEmailTextBtn');
    const sendMailtoCredBtn = document.getElementById('sendMailtoCredBtn');

    if (closeCredBtn) closeCredBtn.addEventListener('click', closeCredentialsModal);
    if (dismissCredBtn) dismissCredBtn.addEventListener('click', closeCredentialsModal);

    if (copyUserBtn) {
        copyUserBtn.addEventListener('click', () => {
            const userText = document.getElementById('credUsername')?.textContent || '';
            navigator.clipboard.writeText(userText).then(() => {
                showAlert('📋 Username copied to clipboard!', 'success');
            });
        });
    }

    if (copyPassBtn) {
        copyPassBtn.addEventListener('click', () => {
            const passText = document.getElementById('credPassword')?.textContent || '';
            navigator.clipboard.writeText(passText).then(() => {
                showAlert('📋 Password copied to clipboard!', 'success');
            });
        });
    }

    if (sendGmailCredBtn) {
        sendGmailCredBtn.addEventListener('click', () => {
            if (!activeCredentialsData) return;
            const emailData = EmailNotificationService.buildCredentialsEmail(activeCredentialsData);
            EmailNotificationService.sendViaGmailWeb(emailData);
            showAlert(`📧 Opening Gmail compose to send credentials to ${activeCredentialsData.email}...`, 'success');
        });
    }

    if (copyEmailTextBtn) {
        copyEmailTextBtn.addEventListener('click', async () => {
            if (!activeCredentialsData) return;
            const emailData = EmailNotificationService.buildCredentialsEmail(activeCredentialsData);
            const success = await EmailNotificationService.copyEmailText(emailData);
            if (success) {
                showAlert('📋 Full credentials email text copied to clipboard!', 'success');
            } else {
                showAlert('⚠️ Could not copy email text.', 'error');
            }
        });
    }

    if (sendMailtoCredBtn) {
        sendMailtoCredBtn.addEventListener('click', () => {
            if (!activeCredentialsData) return;
            const emailData = EmailNotificationService.buildCredentialsEmail(activeCredentialsData);
            EmailNotificationService.sendViaMailto(emailData);
        });
    }

    window.openRejectModal = function (id, name) {
        if (rejectEnrollmentId) rejectEnrollmentId.value = id;
        if (rejectStudentName) rejectStudentName.value = name;
        if (rejectionReason) rejectionReason.value = '';
        if (rejectModal) rejectModal.classList.add('show');
    };

    window.closeRejectModal = function () {
        if (rejectModal) rejectModal.classList.remove('show');
    };

    if (closeRejectModalBtn) closeRejectModalBtn.addEventListener('click', window.closeRejectModal);
    if (cancelRejectBtn) cancelRejectBtn.addEventListener('click', window.closeRejectModal);

    if (rejectForm) {
        rejectForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const id = rejectEnrollmentId ? rejectEnrollmentId.value : '';
            const reason = rejectionReason ? rejectionReason.value.trim() : '';

            if (!reason) {
                showAlert('Please provide a reason for rejecting this application.', 'error');
                return;
            }

            const item = rawEnrollments.find(r => String(r.id) === String(id));
            const studentName = item ? item.fullname : 'Student';

            try {
                window.closeRejectModal();
                showAlert('Processing enrollment rejection...', 'info');

                await supabase
                    .from('enrollments')
                    .update({
                        status: 'rejected',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', id);

                try {
                    const targetId = item?.user_id || item?.student_id || item?.id || null;
                    const rejMsg = `Notice for ${studentName}: Your enrollment application was not approved. Reason: ${reason}`;
                    await supabase.from('notifications').insert([{
                        user_id: targetId,
                        role: 'student',
                        title: 'Enrollment Application Update',
                        message: rejMsg,
                        type: 'enrollment',
                        enrollment_id: id,
                        read: false,
                        is_read: false,
                        created_at: new Date().toISOString()
                    }]);
                } catch (nErr) { }

                showAlert(`✅ Enrollment for ${studentName} has been rejected. Notification sent.`, 'success');
                await loadEnrollments();

            } catch (error) {
                console.error('❌ Error rejecting enrollment:', error);
                showAlert('Failed to reject enrollment: ' + error.message, 'error');
            }
        });
    }

    window.pendingEnrollment = async function (id) {
        const item = rawEnrollments.find(e => String(e.id) === String(id));
        if (!item) return;

        if (!confirm(`Revert enrollment status to Pending for ${item.fullname}?`)) return;

        try {
            await supabase
                .from('enrollments')
                .update({
                    status: 'pending',
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            showAlert(`🔄 Enrollment status for ${item.fullname} reverted to Pending.`, 'success');
            await loadEnrollments();
        } catch (error) {
            console.error('❌ Error reverting enrollment:', error);
            showAlert('Failed to update status: ' + error.message, 'error');
        }
    };

    window.viewEnrollment = function (id) {
        window.location.href = `view_enrollment.html?id=${encodeURIComponent(id)}`;
    };

    window.deleteEnrollment = async function (id, name) {
        if (!confirm(`Are you sure you want to permanently DELETE the enrollment record for ${name || 'this student'}?\n\nThis action cannot be undone.`)) {
            return;
        }

        try {
            showAlert('Deleting enrollment record...', 'info');

            const { error: delErr } = await supabase
                .from('enrollments')
                .delete()
                .eq('id', id);

            if (delErr) throw delErr;

            showAlert('✅ Enrollment record deleted successfully.', 'success');
            await loadEnrollments();
        } catch (error) {
            console.error('❌ Error deleting enrollment:', error);
            showAlert('Failed to delete enrollment: ' + error.message, 'error');
        }
    };

    async function notifyMissing(studentName, missingList, userId, studentId, email) {
        const missingText = missingList.map(req => `• ${req}`).join('\n');

        if (!confirm(`Send notification to ${studentName} about missing requirements?\n\nRequired documents:\n${missingText}`)) {
            return;
        }

        try {
            const targetId = userId || studentId || null;
            const notifMsg = `Dear ${studentName}, please submit your missing document requirements:\n${missingText}`;

            await supabase.from('notifications').insert([{
                user_id: targetId,
                role: 'student',
                title: 'Missing Enrollment Documents',
                message: notifMsg,
                type: 'document_reminder',
                read: false,
                is_read: false,
                created_at: new Date().toISOString()
            }]);

            showAlert(`✅ Notification sent successfully to ${studentName}!`, 'success');
        } catch (error) {
            console.error('❌ Error sending notification:', error);
            showAlert('Failed to send notification: ' + error.message, 'error');
        }
    }

    // ============================================
    // RESET & FILTERS
    // ============================================

    window.resetFilters = function () {
        if (statusFilter) statusFilter.value = '';
        if (gradeFilter) gradeFilter.value = '';
        if (strandFilter) strandFilter.value = '';
        if (searchInput) searchInput.value = '';
        applyFilters();
        showAlert('Filters reset to default.', 'info');
    };

    if (filterForm) {
        filterForm.addEventListener('submit', function (e) {
            e.preventDefault();
            applyFilters();
        });
    }

    if (statusFilter) statusFilter.addEventListener('change', applyFilters);
    if (gradeFilter) gradeFilter.addEventListener('change', applyFilters);
    if (strandFilter) strandFilter.addEventListener('change', applyFilters);
    if (searchInput) searchInput.addEventListener('input', applyFilters);

    // ============================================
    // MOBILE MENU & MODAL DISMISS
    // ============================================

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', function (e) {
            e.stopPropagation();
            sidebar.classList.toggle('active');
        });
    }

    document.addEventListener('click', function (e) {
        if (sidebar && sidebar.classList.contains('active') && !sidebar.contains(e.target) && (!menuToggle || !menuToggle.contains(e.target))) {
            sidebar.classList.remove('active');
        }
        if (e.target === rejectModal) {
            window.closeRejectModal();
        }
    });

    // ============================================
    // REALTIME & NOTIFICATIONS
    // ============================================

    function playNotificationChime() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, ctx.currentTime);
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
            osc.start();
            osc.stop(ctx.currentTime + 0.35);
        } catch (e) { }
    }

    function setupRealtimeSubscription() {
        try {
            supabase
                .channel('admin-enrollments-realtime')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'enrollments'
                }, (payload) => {
                    console.log('⚡ Realtime enrollment update:', payload);
                    loadEnrollments();
                    loadNotifications();
                    if (payload.eventType === 'INSERT') {
                        playNotificationChime();
                        showAlert(`🔔 New enrollment submitted: ${payload.new?.first_name || ''} ${payload.new?.last_name || ''}`, 'info');
                    }
                })
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications'
                }, (payload) => {
                    const notif = payload.new;
                    if (!notif.role || notif.role === 'admin' || notif.role === 'all') {
                        playNotificationChime();
                        showAlert(`🔔 ${notif.title || 'Notification'}: ${notif.message || ''}`, 'info');
                        loadEnrollments();
                        loadNotifications();
                    }
                })
                .subscribe();
        } catch (err) {
            console.warn('Realtime subscription notice in admin enrollments:', err);
        }

        window.addEventListener('storage', (e) => {
            if ((e.key === 'hes_latest_notification' || e.key === 'hes_admin_latest_notification') && e.newValue) {
                try {
                    const data = JSON.parse(e.newValue);
                    if (!data.role || data.role === 'admin' || data.role === 'all' || (data.roles && data.roles.includes('admin'))) {
                        loadEnrollments();
                        loadNotifications();
                        playNotificationChime();
                        showAlert(`🔔 ${data.title || 'New Enrollment'}: ${data.message || ''}`, 'info');
                    }
                } catch (err) { }
            }
        });
    }

    // ============================================
    // NOTIFICATIONS SYSTEM
    // ============================================

    const notificationBtn = document.getElementById('notificationBtn');
    const notificationDropdown = document.getElementById('notificationDropdown');
    const notificationList = document.getElementById('notificationList');
    const notifCount = document.getElementById('notifCount');
    const markAllReadBtn = document.getElementById('markAllReadBtn');
    let adminNotifs = [];

    async function loadNotifications() {
        if (!notificationList) return;
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .or('role.eq.admin,role.eq.all,role.is.null')
                .order('created_at', { ascending: false })
                .limit(30);

            if (!error && data) {
                adminNotifs = data;
            } else {
                adminNotifs = [];
            }
        } catch (e) {
            adminNotifs = [];
        }

        const unread = adminNotifs.filter(n => !n.is_read && !n.read).length;
        if (notifCount) {
            if (unread > 0) {
                notifCount.textContent = unread > 99 ? '99+' : unread;
                notifCount.style.display = 'flex';
            } else {
                notifCount.style.display = 'none';
            }
        }

        if (adminNotifs.length === 0) {
            notificationList.innerHTML = `
                <div class="empty-notifications" style="text-align: center; padding: 24px; color: #94a3b8;">
                    <i class="fas fa-bell-slash" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
                    <p style="margin: 0; font-size: 13px;">No notifications yet</p>
                </div>
            `;
            return;
        }

        notificationList.innerHTML = adminNotifs.map(notif => {
            const isRead = notif.is_read || notif.read;
            const enrollmentLink = (notif.enrollment_id || notif.enrollmentId) ? `view_enrollment.html?id=${notif.enrollment_id || notif.enrollmentId}` : null;
            const timeStr = notif.created_at ? new Date(notif.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'Just now';

            return `
                <div class="notif-item ${isRead ? 'read' : 'unread'}" style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: background 0.15s; background: ${isRead ? '#ffffff' : '#f0fdf4'}; border-radius: 8px; margin-bottom: 4px;" data-id="${notif.id}">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                        <strong style="font-size: 13px; color: #0f172a;">${notif.title || 'Notification'}</strong>
                        <span style="font-size: 11px; color: #94a3b8; white-space: nowrap;">${timeStr}</span>
                    </div>
                    <div style="font-size: 12px; color: #475569; margin-top: 2px;">${notif.message || ''}</div>
                    ${enrollmentLink ? `
                        <div style="margin-top: 6px;">
                            <a href="${enrollmentLink}" style="display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 700; color: #1B2A4A; background: #e0e7ff; padding: 3px 10px; border-radius: 6px; text-decoration: none;">
                                <i class="fas fa-eye"></i> View Student Information
                            </a>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        notificationList.querySelectorAll('.notif-item').forEach(item => {
            item.addEventListener('click', async function (e) {
                if (e.target.closest('a')) return;
                const id = this.dataset.id;
                const notif = adminNotifs.find(n => String(n.id) === String(id));
                if (notif && !notif.is_read && !notif.read) {
                    notif.is_read = true;
                    try {
                        await supabase.from('notifications').update({ read: true, is_read: true }).eq('id', id);
                    } catch (err) { }
                    loadNotifications();
                }
                if (notif && (notif.enrollment_id || notif.enrollmentId)) {
                    window.location.href = `view_enrollment.html?id=${notif.enrollment_id || notif.enrollmentId}`;
                }
            });
        });
    }

    if (notificationBtn && notificationDropdown) {
        notificationBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            const isOpen = notificationDropdown.style.display === 'block';
            notificationDropdown.style.display = isOpen ? 'none' : 'block';
        });

        document.addEventListener('click', function (e) {
            if (!notificationDropdown.contains(e.target) && !notificationBtn.contains(e.target)) {
                notificationDropdown.style.display = 'none';
            }
        });
    }

    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', async function (e) {
            e.stopPropagation();
            try {
                await supabase.from('notifications').update({ read: true, is_read: true }).or('role.eq.admin,role.eq.all,role.is.null');
                adminNotifs.forEach(n => { n.is_read = true; n.read = true; });
                loadNotifications();
                showAlert('✅ All notifications marked as read', 'success');
            } catch (err) {
                showAlert('❌ Error: ' + err.message, 'error');
            }
        });
    }

    // ============================================
    // INIT
    // ============================================

    loadEnrollments();
    loadNotifications();
    setupRealtimeSubscription();

})();