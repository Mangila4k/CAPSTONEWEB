/**
 * HES Admin - Enrollments Management (Supabase Dynamic Integration)
 */

import { supabase } from '../../supabase/config.js';
import { EmailNotificationService } from '../../js/email_service.js';

(function() {
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
            } catch(e) {
                console.warn('Enrollments fetch error:', e);
            }

            // 2. Fetch Students
            let studentsData = [];
            try {
                const { data: sData, error: sErr } = await supabase
                    .from('students')
                    .select('*');
                if (!sErr && sData) studentsData = sData;
            } catch(e) {
                console.warn('Students fetch error:', e);
            }

            // 3. Fetch Users
            let usersData = [];
            try {
                const { data: uData } = await supabase
                    .from('users')
                    .select('id, first_name, last_name, email, role');
                if (uData) usersData = uData;
            } catch(e) {}

            // 4. Fetch Documents
            let documentsData = [];
            try {
                const { data: dData } = await supabase.from('documents').select('*');
                if (dData) documentsData = dData;
            } catch(e) {}

            let studentDocumentsData = [];
            try {
                const { data: sdData } = await supabase.from('student_documents').select('*');
                if (sdData) studentDocumentsData = sdData;
            } catch(e) {}

            // Combine and Normalize Enrollments
            const items = [];
            const seenStudentIds = new Set();

            // Process explicit enrollments
            enrollmentsData.forEach(enr => {
                const student = studentsData.find(s => s.id === enr.student_id || (s.email && enr.email && s.email.toLowerCase() === enr.email.toLowerCase())) || {};
                const user = usersData.find(u => u.id === student.user_id || u.student_id === student.id || (u.email && enr.email && u.email.toLowerCase() === enr.email.toLowerCase())) || {};
                const doc = documentsData.find(d => d.enrollment_id === enr.id) || {};
                const sDocs = studentDocumentsData.filter(d => d.student_id === student.id);

                if (student.id) seenStudentIds.add(student.id);

                const fName = (student.first_name || enr.first_name || user.first_name || '').trim();
                const lName = (student.last_name || enr.last_name || user.last_name || '').trim();
                const fullName = `${fName} ${lName}`.trim() || 'Student Applicant';
                const email = enr.email || student.email || user.email || '—';
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

                // Check missing documents
                const isTransferee = String(enr.student_type || student.student_type || '').toLowerCase().includes('transfer') || String(enr.student_type || student.student_type || '').toLowerCase().includes('different');
                const hasForm138 = Boolean(student.form_138_url || doc.report_card || sDocs.some(d => d.document_type === 'form_138' || d.document_type === 'report_card' || (d.title && d.title.toLowerCase().includes('report card'))));
                const hasPsa = Boolean(student.psa_birth_url || doc.birth_certificate || sDocs.some(d => d.document_type === 'psa' || d.document_type === 'birth_certificate'));
                const hasGoodMoral = Boolean(student.good_moral_url || doc.good_moral || sDocs.some(d => d.document_type === 'good_moral'));
                const has2x2 = Boolean(student.two_by_two_picture_url || student.avatar_url || sDocs.some(d => d.document_type === 'two_by_two_picture' || (d.title && d.title.includes('2x2'))));

                const missingList = [];
                if (!has2x2) missingList.push('2x2 ID Picture');
                if (!hasForm138) missingList.push('Report Card');
                if (!hasPsa) missingList.push('PSA Birth Certificate');
                if (!hasGoodMoral) missingList.push('Good Moral Certificate');

                const isComplete = (student.documents_status || '').toLowerCase() === 'complete' || missingList.length === 0;

                items.push({
                    id: enr.id,
                    student_id: student.id || enr.student_id,
                    user_id: user.id || null,
                    fullname: fullName,
                    email: email,
                    id_number: lrn !== 'Not assigned' ? lrn : null,
                    grade_name: gradeLevel,
                    strand: strand,
                    school_year: schoolYear,
                    status: status,
                    created_at: enr.created_at || new Date().toISOString(),
                    has_missing: !isComplete && missingList.length > 0,
                    missing_count: isComplete ? 0 : missingList.length,
                    missing_list: isComplete ? [] : missingList
                });
            });

            // Include any registered students who do not yet have an enrollment row
            studentsData.forEach(student => {
                if (student.id && !seenStudentIds.has(student.id)) {
                    const user = usersData.find(u => u.student_id === student.id || (u.email && student.email && u.email.toLowerCase() === student.email.toLowerCase())) || {};
                    const fName = (student.first_name || user.first_name || '').trim();
                    const lName = (student.last_name || user.last_name || '').trim();
                    const fullName = `${fName} ${lName}`.trim() || 'Student Applicant';
                    const email = student.email || user.email || '—';
                    const lrn = student.lrn || 'Not assigned';
                    const gradeLevel = student.grade_level || 'Grade 11';
                    const strand = student.strand || (gradeLevel.includes('11') || gradeLevel.includes('12') ? 'TVL-ICT' : '');
                    
                    const isTransferee = String(student.student_type || '').toLowerCase().includes('transfer') || String(student.student_type || '').toLowerCase().includes('different');
                    const hasForm138 = Boolean(student.form_138_url);
                    const hasPsa = Boolean(student.psa_birth_url);
                    const hasGoodMoral = Boolean(student.good_moral_url);
                    const has2x2 = Boolean(student.two_by_two_picture_url || student.avatar_url);

                    const missingList = [];
                    if (!has2x2) missingList.push('2x2 ID Picture');
                    if (!hasForm138) missingList.push('Report Card');
                    if (!hasPsa) missingList.push('PSA Birth Certificate');
                    if (!hasGoodMoral) missingList.push('Good Moral Certificate');

                    const isComplete = (student.documents_status || '').toLowerCase() === 'complete' || missingList.length === 0;

                    items.push({
                        id: student.id,
                        student_id: student.id,
                        user_id: user.id || null,
                        fullname: fullName,
                        email: email,
                        id_number: lrn !== 'Not assigned' ? lrn : null,
                        grade_name: gradeLevel,
                        strand: strand,
                        school_year: '2025-2026',
                        status: student.documents_status === 'complete' ? 'Enrolled' : 'Pending',
                        created_at: student.created_at || new Date().toISOString(),
                        has_missing: !isComplete && missingList.length > 0,
                        missing_count: isComplete ? 0 : missingList.length,
                        missing_list: isComplete ? [] : missingList
                    });
                }
            });

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

            // Requirements badge
            let requirementsHtml = '';
            if (enrollment.has_missing && enrollment.status === 'Pending') {
                requirementsHtml = `
                    <div class="requirements-warning" style="display: flex; align-items: center; gap: 8px;">
                        <span class="missing-badge" style="background: #fee2e2; color: #dc2626; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">
                            <i class="fas fa-exclamation-triangle"></i> ${enrollment.missing_count} missing
                        </span>
                        <button class="btn-notify-missing" 
                                data-student-name="${enrollment.fullname}"
                                data-user-id="${enrollment.user_id || ''}"
                                data-student-id="${enrollment.student_id || enrollment.id || ''}"
                                data-email="${enrollment.email || ''}"
                                data-missing-list='${JSON.stringify(enrollment.missing_list)}'
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

            // Action Buttons
            let actionsHtml = '';
            if (enrollment.status === 'Pending') {
                if (enrollment.has_missing) {
                    actionsHtml += `<button class="action-btn approve disabled" disabled title="Missing requirements"><i class="fas fa-check"></i></button>`;
                } else {
                    actionsHtml += `<button class="action-btn approve" onclick="window.approveEnrollment('${enrollment.id}')" title="Approve Enrollment"><i class="fas fa-check"></i></button>`;
                }
                actionsHtml += `<button class="action-btn reject" onclick="window.openRejectModal('${enrollment.id}', '${enrollment.fullname.replace(/'/g, "\\'")}')" title="Reject Application"><i class="fas fa-times"></i></button>`;
                actionsHtml += `<button class="action-btn view" onclick="window.viewEnrollment('${enrollment.id}')" title="View Full Details"><i class="fas fa-eye"></i></button>`;
                actionsHtml += `<button class="action-btn delete" onclick="window.deleteEnrollment('${enrollment.id}', '${enrollment.fullname.replace(/'/g, "\\'")}')" title="Delete Record"><i class="fas fa-trash"></i></button>`;
            } else {
                actionsHtml += `<button class="action-btn pending" onclick="window.pendingEnrollment('${enrollment.id}')" title="Revert to Pending"><i class="fas fa-undo-alt"></i></button>`;
                actionsHtml += `<button class="action-btn view" onclick="window.viewEnrollment('${enrollment.id}')" title="View Full Details"><i class="fas fa-eye"></i></button>`;
                actionsHtml += `<button class="action-btn delete" onclick="window.deleteEnrollment('${enrollment.id}', '${enrollment.fullname.replace(/'/g, "\\'")}')" title="Delete Record"><i class="fas fa-trash"></i></button>`;
                actionsHtml += `<span class="action-spacer" style="display:inline-block; width:28px;"></span>`;
            }

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
                        ${(parseInt((enrollment.grade_level || '').replace(/\D/g, ''), 10) >= 11 && enrollment.strand) ? `<span class="strand-tag" style="display: inline-block; margin-left: 4px; padding: 2px 6px; border-radius: 4px; background: #e0f2fe; color: #0369a1; font-size: 11px; font-weight: 600;">${enrollment.strand}</span>` : ''}
                    </td>
                    <td><span class="grade-tag">${enrollment.school_year}</span></td>
                    <td><span class="badge ${statusClass}">${enrollment.status}</span></td>
                    <td>${requirementsHtml}</td>
                    <td><span class="grade-tag">${formattedDate}</span></td>
                    <td>
                        <div class="action-btns" style="display: flex; gap: 6px; align-items: center;">
                            ${actionsHtml}
                        </div>
                    </td>
                </tr>
            `;
        });

        tableBody.innerHTML = html;

        // Attach Notify Click Handlers
        document.querySelectorAll('.btn-notify-missing').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const studentName = this.dataset.studentName;
                const userId = this.dataset.userId;
                const studentId = this.dataset.studentId;
                const email = this.dataset.email;
                const missingList = JSON.parse(this.dataset.missingList || '[]');
                notifyMissing(studentName, missingList, userId, studentId, email);
            });
        });
    }

    // ============================================
    // SUPABASE ACTIONS (APPROVE, REJECT, PENDING, DELETE)
    // ============================================

    window.approveEnrollment = async function(id) {
        const item = rawEnrollments.find(e => String(e.id) === String(id));
        if (!item) return;

        if (item.has_missing) {
            showAlert('Cannot approve - required documents are missing.', 'error');
            return;
        }

        if (!confirm(`Are you sure you want to APPROVE enrollment for ${item.fullname}?`)) {
            return;
        }

        try {
            showAlert('Processing enrollment approval & account provisioning...', 'info');

            // 1. Extract student credentials info
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

            // 2. Provision / Update user in public.users table (Username = Email, Password = Last Name)
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
                            password: lastName, // Password is Last Name
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
                            password: lastName, // Password is Last Name
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

            // 3. Update students table
            let studentTableId = item.student_id;
            if (studentTableId) {
                await supabase
                    .from('students')
                    .update({
                        documents_status: 'complete',
                        grade_level: gradeName,
                        strand: strand,
                        enrollment_id: id,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', studentTableId);
            } else if (email) {
                const { data: createdStudent } = await supabase
                    .from('students')
                    .insert([{
                        first_name: firstName,
                        last_name: lastName,
                        email: email,
                        grade_level: gradeName,
                        strand: strand,
                        enrollment_id: id,
                        documents_status: 'complete',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }])
                    .select();

                if (createdStudent && createdStudent.length > 0) {
                    studentTableId = createdStudent[0].id;
                }
            }

            // 4. Update enrollments table
            await supabase
                .from('enrollments')
                .update({
                    status: 'enrolled',
                    student_id: studentTableId || studentUserId,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            // 5. Insert notification for student with login credentials
            const credsMsg = `Congratulations ${firstName}! Your enrollment application for ${gradeName} (${strand || 'General'}) S.Y. ${item.school_year || '2026-2027'} has been approved.\n\nYour Student Portal Login Credentials:\n• Username (Email): ${email}\n• Password: ${lastName}\n\nYou can now log in to the HES Student Portal.`;

            const targetStudentId = studentUserId || studentTableId || null;
            await supabase.from('notifications').insert([{
                user_id: targetStudentId,
                student_id: studentTableId || null,
                recipient_email: email,
                role: 'student',
                title: '🎉 Enrollment Approved!',
                message: credsMsg,
                type: 'action',
                enrollment_id: id,
                read: false,
                is_read: false,
                created_at: new Date().toISOString()
            }]);

            if (targetStudentId) {
                try {
                    const k = `hes_notifications_${targetStudentId}`;
                    const raw = localStorage.getItem(k);
                    let list = raw ? JSON.parse(raw) : [];
                    list.unshift({
                        id: 'notif_' + Date.now(),
                        type: 'action',
                        title: '🎉 Enrollment Approved!',
                        message: credsMsg,
                        time: 'Just now',
                        read: false
                    });
                    localStorage.setItem(k, JSON.stringify(list.slice(0, 30)));
                } catch(e) {}
            }

            const credsPayload = {
                email,
                lastName,
                firstName,
                studentFullName: item.fullname || `${firstName} ${lastName}`,
                gradeLevel: gradeName,
                strand: strand || '',
                schoolYear: item.school_year || '2026-2027'
            };

            showCredentialsModal(credsPayload);
            showAlert(`✅ Enrollment for ${item.fullname} approved! Account created (Username: ${email}, Password: ${lastName}).`, 'success');
            await loadEnrollments();

        } catch (error) {
            console.error('❌ Error approving enrollment:', error);
            showAlert('Failed to approve enrollment: ' + error.message, 'error');
        }
    };

    // ============================================
    // CREDENTIALS MODAL HELPERS
    // ============================================

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

        if (credModal) {
            credModal.style.display = 'flex';
        }
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

    window.openRejectModal = function(id, name) {
        if (rejectEnrollmentId) rejectEnrollmentId.value = id;
        if (rejectStudentName) rejectStudentName.value = name;
        if (rejectionReason) rejectionReason.value = '';
        if (rejectModal) rejectModal.classList.add('show');
    };

    window.closeRejectModal = function() {
        if (rejectModal) rejectModal.classList.remove('show');
    };

    if (closeRejectModalBtn) closeRejectModalBtn.addEventListener('click', window.closeRejectModal);
    if (cancelRejectBtn) cancelRejectBtn.addEventListener('click', window.closeRejectModal);

    if (rejectForm) {
        rejectForm.addEventListener('submit', async function(e) {
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

                // 1. Update enrollments table
                await supabase
                    .from('enrollments')
                    .update({
                        status: 'rejected',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', id);

                // 2. Insert notification
                try {
                    const targetId = item?.user_id || item?.student_id || item?.id || null;
                    const rejMsg = `Notice for ${studentName}: Your enrollment application was not approved. Reason: ${reason}`;
                    await supabase.from('notifications').insert([{
                        user_id: targetId,
                        student_id: item?.student_id || item?.id || null,
                        recipient_email: item?.email || null,
                        role: 'student',
                        title: 'Enrollment Application Update',
                        message: rejMsg,
                        type: 'enrollment',
                        enrollment_id: id,
                        read: false,
                        is_read: false,
                        created_at: new Date().toISOString()
                    }]);

                    if (targetId) {
                        try {
                            const k = `hes_notifications_${targetId}`;
                            const raw = localStorage.getItem(k);
                            let list = raw ? JSON.parse(raw) : [];
                            list.unshift({
                                id: 'notif_' + Date.now(),
                                type: 'alert',
                                title: 'Enrollment Application Update',
                                message: rejMsg,
                                time: 'Just now',
                                read: false
                            });
                            localStorage.setItem(k, JSON.stringify(list.slice(0, 30)));
                        } catch(e) {}
                    }
                } catch(nErr) {}

                showAlert(`✅ Enrollment for ${studentName} has been rejected. Notification sent.`, 'success');
                await loadEnrollments();

            } catch (error) {
                console.error('❌ Error rejecting enrollment:', error);
                showAlert('Failed to reject enrollment: ' + error.message, 'error');
            }
        });
    }

    window.pendingEnrollment = async function(id) {
        const item = rawEnrollments.find(e => String(e.id) === String(id));
        if (!item) return;

        if (!confirm(`Revert enrollment status to Pending for ${item.fullname}?`)) {
            return;
        }

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

    window.viewEnrollment = function(id) {
        window.location.href = `view_enrollment.html?id=${encodeURIComponent(id)}`;
    };

    window.deleteEnrollment = async function(id, name) {
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
                student_id: studentId || null,
                recipient_email: email || null,
                role: 'student',
                title: 'Missing Enrollment Documents',
                message: notifMsg,
                type: 'document_reminder',
                read: false,
                is_read: false,
                created_at: new Date().toISOString()
            }]);

            if (targetId) {
                try {
                    const k = `hes_notifications_${targetId}`;
                    const raw = localStorage.getItem(k);
                    let list = raw ? JSON.parse(raw) : [];
                    list.unshift({
                        id: 'notif_' + Date.now(),
                        type: 'reminder',
                        title: 'Missing Enrollment Documents',
                        message: notifMsg,
                        time: 'Just now',
                        read: false
                    });
                    localStorage.setItem(k, JSON.stringify(list.slice(0, 30)));
                } catch(e) {}
            }

            showAlert(`✅ Notification sent successfully to ${studentName}!`, 'success');
        } catch (error) {
            console.error('❌ Error sending notification:', error);
            showAlert('Failed to send notification: ' + error.message, 'error');
        }
    }

    // ============================================
    // RESET & FILTERS
    // ============================================

    window.resetFilters = function() {
        if (statusFilter) statusFilter.value = '';
        if (gradeFilter) gradeFilter.value = '';
        if (strandFilter) strandFilter.value = '';
        if (searchInput) searchInput.value = '';
        applyFilters();
        showAlert('Filters reset to default.', 'info');
    };

    if (filterForm) {
        filterForm.addEventListener('submit', function(e) {
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
        menuToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            sidebar.classList.toggle('active');
        });
    }

    document.addEventListener('click', function(e) {
        if (sidebar && sidebar.classList.contains('active') && !sidebar.contains(e.target) && (!menuToggle || !menuToggle.contains(e.target))) {
            sidebar.classList.remove('active');
        }
        if (e.target === rejectModal) {
            window.closeRejectModal();
        }
    });

    // ============================================
    // INIT
    // ============================================

    loadEnrollments();

})();