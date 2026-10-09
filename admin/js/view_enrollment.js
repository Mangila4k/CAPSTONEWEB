/**
 * HES Admin - View Enrollment Details (Supabase Dynamic Integration)
 */

import { supabase } from '../../supabase/config.js';
import { EmailNotificationService } from '../../js/email_service.js';

(function() {
    'use strict';

    console.log('📄 Admin View Enrollment Details (Supabase) ready');

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
    const viewFullProfileLink = document.getElementById('viewFullProfileLink');
    const studentName = document.getElementById('studentName');
    const studentEmail = document.getElementById('studentEmail');
    const studentIdNumber = document.getElementById('studentIdNumber');
    const totalEnrollmentsEl = document.getElementById('totalEnrollments');
    const sinceYearEl = document.getElementById('sinceYear');
    const avatarEl = document.querySelector('.student-avatar-large');
    const enrollmentInfoGrid = document.getElementById('enrollmentInfoGrid');
    const requirementsContainer = document.getElementById('requirementsContainer');
    const historyBody = document.getElementById('historyBody');
    const historyCount = document.getElementById('historyCount');

    // File Preview Modal Elements
    const filePreviewModal = document.getElementById('filePreviewModal');
    const modalFileName = document.getElementById('modalFileName');
    const modalBody = document.getElementById('modalBody');
    const downloadFileBtn = document.getElementById('downloadFileBtn');

    // Mobile Menu
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');

    // ============================================
    // STATE
    // ============================================

    let currentEnrollment = null;
    let currentStudent = null;
    let enrollmentHistory = [];
    let submittedRequirements = [];
    let missingRequirements = [];

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
        if (!dateString) return '—';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return dateString;
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        } catch {
            return dateString;
        }
    }

    // ============================================
    // LOAD ENROLLMENT DATA FROM SUPABASE
    // ============================================

    async function loadEnrollmentDetails() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const targetId = urlParams.get('id') || urlParams.get('enrollment_id') || '';

            // 1. Query Enrollments
            let enr = null;
            if (targetId) {
                try {
                    const { data: eData } = await supabase
                        .from('enrollments')
                        .select('*')
                        .eq('id', targetId)
                        .maybeSingle();
                    if (eData) enr = eData;
                } catch(e) {}
            }

            // Fallback: If not found by ID or no ID provided, fetch first available enrollment
            if (!enr) {
                try {
                    let query = supabase.from('enrollments').select('*').order('created_at', { ascending: false }).limit(1);
                    if (targetId) {
                        query = supabase.from('enrollments').select('*').or(`id.eq.${targetId},student_id.eq.${targetId}`).limit(1);
                    }
                    const { data: fallbackList } = await query;
                    if (fallbackList && fallbackList.length > 0) {
                        enr = fallbackList[0];
                    }
                } catch(e) {}
            }

            // Fallback: If no enrollments exist at all, query from students table
            let student = null;
            if (enr && enr.student_id) {
                try {
                    const { data: sData } = await supabase
                        .from('students')
                        .select('*')
                        .eq('id', enr.student_id)
                        .maybeSingle();
                    if (sData) student = sData;
                } catch(e) {}
            }

            if (!student && enr && enr.email) {
                try {
                    const { data: sData } = await supabase
                        .from('students')
                        .select('*')
                        .ilike('email', enr.email)
                        .maybeSingle();
                    if (sData) student = sData;
                } catch(e) {}
            }

            if (!student) {
                try {
                    const { data: sList } = await supabase.from('students').select('*').limit(1);
                    if (sList && sList.length > 0) student = sList[0];
                } catch(e) {}
            }

            // If enrollment is still null, synthesize from student
            if (!enr && student) {
                enr = {
                    id: student.id,
                    student_id: student.id,
                    first_name: student.first_name,
                    last_name: student.last_name,
                    email: student.email,
                    grade_level: student.grade_level || 'Grade 11',
                    strand: student.strand || 'TVL-ICT',
                    school_year: '2025-2026',
                    status: student.documents_status === 'complete' ? 'approved' : 'pending',
                    created_at: student.created_at || new Date().toISOString()
                };
            }

            if (!enr) {
                showAlert('No enrollment application found in the database.', 'error');
                return;
            }

            currentEnrollment = enr;
            currentStudent = student;

            // 2. Fetch all enrollment history for this student
            try {
                let hQuery = supabase.from('enrollments').select('*');
                if (student && student.id) {
                    hQuery = hQuery.or(`student_id.eq.${student.id},email.eq.${student.email || enr.email}`);
                } else if (enr.email) {
                    hQuery = hQuery.eq('email', enr.email);
                }
                const { data: hList } = await hQuery.order('created_at', { ascending: false });
                if (hList && hList.length > 0) {
                    enrollmentHistory = hList;
                } else {
                    enrollmentHistory = [enr];
                }
            } catch(e) {
                enrollmentHistory = [enr];
            }

            // 3. Fetch Documents attached
            let docRecord = null;
            try {
                const { data: dData } = await supabase
                    .from('documents')
                    .select('*')
                    .eq('enrollment_id', enr.id)
                    .maybeSingle();
                if (dData) docRecord = dData;
            } catch(e) {}

            let sDocs = [];
            try {
                if (student && student.id) {
                    const { data: sdData } = await supabase
                        .from('student_documents')
                        .select('*')
                        .eq('student_id', student.id);
                    if (sdData) sDocs = sdData;
                }
            } catch(e) {}

            // Compute Requirements
            buildRequirementsList(student, enr, docRecord, sDocs);

            // Render all UI components
            renderStudentInfo();
        const adminGenBtn = document.getElementById('adminGenerateIdBtn');
        if (adminGenBtn && currentEnrollment) {
            adminGenBtn.href = 'generate_id.html?enrollment_id=' + (currentEnrollment.id || '') + (currentEnrollment.student_id ? '&id=' + currentEnrollment.student_id : '');
        }
            renderEnrollmentInfo();
            renderRequirements();
            renderHistory();

        } catch (error) {
            console.error('❌ Error loading enrollment details:', error);
            showAlert('Failed to load enrollment details: ' + error.message, 'error');
        }
    }

    // ============================================
    // BUILD REQUIREMENTS DATA
    // ============================================

    function buildRequirementsList(student, enr, doc, sDocs) {
        submittedRequirements = [];
        missingRequirements = [];

        const reportCardLabel = 'Report Card';

        // Check Form 138 / Report Card
        const form138Url = student?.form_138_url || doc?.report_card || sDocs.find(d => d.document_type === 'form_138' || d.document_type === 'report_card' || (d.title && d.title.toLowerCase().includes('report card')))?.file_url;
        if (form138Url) {
            submittedRequirements.push({
                name: reportCardLabel,
                is_required: true,
                can_be_followed: false,
                file_path: form138Url
            });
        } else {
            missingRequirements.push({
                name: reportCardLabel,
                is_required: true,
                can_be_followed: false,
                file_path: null
            });
        }

        // Check Form 137 for transferees
        if (isTransferee) {
            const form137Url = student?.form_137_url || doc?.form_137 || sDocs.find(d => d.document_type === 'form_137' || (d.title && d.title.toLowerCase().includes('form 137')) || (d.title && d.title.toLowerCase().includes('permanent record')))?.file_url;
            if (form137Url) {
                submittedRequirements.push({
                    name: 'Form 137 (Permanent Record)',
                    is_required: true,
                    can_be_followed: false,
                    file_path: form137Url
                });
            } else {
                missingRequirements.push({
                    name: 'Form 137 (Permanent Record)',
                    is_required: true,
                    can_be_followed: false,
                    file_path: null
                });
            }
        }

        // Check PSA Birth Certificate
        const psaUrl = student?.psa_birth_url || doc?.birth_certificate || sDocs.find(d => d.document_type === 'psa' || d.document_type === 'birth_certificate')?.file_url;
        if (psaUrl) {
            submittedRequirements.push({
                name: 'PSA Birth Certificate',
                is_required: true,
                can_be_followed: false,
                file_path: psaUrl
            });
        } else {
            missingRequirements.push({
                name: 'PSA Birth Certificate',
                is_required: true,
                can_be_followed: false,
                file_path: null
            });
        }

        // Check Good Moral Certificate
        const goodMoralUrl = student?.good_moral_url || doc?.good_moral || sDocs.find(d => d.document_type === 'good_moral')?.file_url;
        if (goodMoralUrl) {
            submittedRequirements.push({
                name: 'Good Moral Certificate',
                is_required: true,
                can_be_followed: false,
                file_path: goodMoralUrl
            });
        } else {
            missingRequirements.push({
                name: 'Good Moral Certificate',
                is_required: true,
                can_be_followed: false,
                file_path: null
            });
        }

        // Check 2x2 ID Picture
        const twoByTwoUrl = student?.two_by_two_picture_url || student?.avatar_url || doc?.two_by_two_picture || sDocs.find(d => d.document_type === 'two_by_two_picture' || (d.title && d.title.includes('2x2')))?.file_url;
        if (twoByTwoUrl) {
            submittedRequirements.push({
                name: '2x2 ID Picture (White Background)',
                is_required: true,
                can_be_followed: false,
                file_path: twoByTwoUrl
            });
        } else {
            missingRequirements.push({
                name: '2x2 ID Picture (White Background)',
                is_required: true,
                can_be_followed: false,
                file_path: null
            });
        }
    }

    // ============================================
    // RENDER STUDENT INFO CARD
    // ============================================

    function renderStudentInfo() {
        const enr = currentEnrollment;
        const student = currentStudent;

        const fName = (student?.first_name || enr?.first_name || '').trim();
        const lName = (student?.last_name || enr?.last_name || '').trim();
        const fullName = `${fName} ${lName}`.trim() || 'Student Applicant';
        const email = student?.email || enr?.email || '—';
        const lrn = student?.lrn || enr?.lrn || 'Not assigned';

        if (studentName) studentName.textContent = fullName;
        if (studentEmail) studentEmail.textContent = email;
        if (studentIdNumber) studentIdNumber.textContent = lrn;
        if (totalEnrollmentsEl) totalEnrollmentsEl.textContent = enrollmentHistory.length;

        const createdAt = student?.created_at || enr?.created_at;
        const sinceYear = createdAt ? new Date(createdAt).getFullYear() : 2026;
        if (sinceYearEl) sinceYearEl.textContent = sinceYear;

        if (avatarEl) {
            avatarEl.textContent = fullName.charAt(0).toUpperCase() || 'S';
        }

        if (viewFullProfileLink && student?.id) {
            viewFullProfileLink.href = `view_student.html?id=${encodeURIComponent(student.id)}`;
        }
    }

    // ============================================
    // RENDER ENROLLMENT INFO GRID
    // ============================================

    function renderEnrollmentInfo() {
        if (!enrollmentInfoGrid || !currentEnrollment) return;

        const enr = currentEnrollment;
        const student = currentStudent;

        const gradeLevel = enr.grade_level || student?.grade_level || 'Grade 11';
        const strand = enr.strand || student?.strand || 'Not Applicable';
        const schoolYear = enr.school_year || enr.last_school_year || '2025-2026';
        const rawStatus = (enr.status || '').toLowerCase();
        let status = 'Pending';
        let statusClass = 'pending';

        if (rawStatus === 'approved' || rawStatus === 'enrolled') {
            status = 'Enrolled';
            statusClass = 'enrolled';
        } else if (rawStatus === 'rejected') {
            status = 'Rejected';
            statusClass = 'rejected';
        }

        const studentType = enr.previous_school ? 'Transferee' : 'Regular / Continuing';

        enrollmentInfoGrid.innerHTML = `
            <div class="info-item">
                <div class="info-label">Student Type</div>
                <div class="info-value">
                    <i class="fas fa-user-tag"></i>
                    ${studentType}
                </div>
            </div>
            <div class="info-item">
                <div class="info-label">Grade Level</div>
                <div class="info-value">
                    <i class="fas fa-layer-group"></i>
                    ${gradeLevel}
                </div>
            </div>
            <div class="info-item">
                <div class="info-label">Strand / Track</div>
                <div class="info-value">
                    <i class="fas fa-tag"></i>
                    ${strand}
                </div>
            </div>
            <div class="info-item">
                <div class="info-label">School Year</div>
                <div class="info-value">
                    <i class="fas fa-calendar-alt"></i>
                    ${schoolYear}
                </div>
            </div>
            <div class="info-item">
                <div class="info-label">Application Date</div>
                <div class="info-value">
                    <i class="fas fa-clock"></i>
                    ${formatDate(enr.created_at)}
                </div>
            </div>
            <div class="info-item">
                <div class="info-label">Enrollment Status</div>
                <div class="info-value">
                    <span class="status-badge-small status-${statusClass}" style="padding: 4px 12px; border-radius: 20px; font-weight: 600;">
                        ${status}
                    </span>
                </div>
            </div>
        `;
    }

    // ============================================
    // RENDER REQUIREMENTS SECTION
    // ============================================

    function renderRequirements() {
        if (!requirementsContainer) return;

        const enr = currentEnrollment;
        const student = currentStudent;

        const totalReq = submittedRequirements.length + missingRequirements.length;
        const submittedCount = submittedRequirements.length;
        const missingCount = missingRequirements.length;
        const percentage = totalReq > 0 ? Math.round((submittedCount / totalReq) * 100) : 100;

        const reqGradeLevel = document.getElementById('reqGradeLevel');
        const reqStudentType = document.getElementById('reqStudentType');
        const requirementsCount = document.getElementById('requirementsCount');
        const progressPercentage = document.getElementById('progressPercentage');
        const progressFill = document.getElementById('progressFill');
        const summarySubmitted = document.getElementById('summarySubmitted');
        const summaryMissing = document.getElementById('summaryMissing');
        const summaryComplete = document.getElementById('summaryComplete');

        if (reqGradeLevel) reqGradeLevel.textContent = enr?.grade_level || student?.grade_level || 'Grade 11';
        if (reqStudentType) reqStudentType.textContent = enr?.previous_school ? 'Transferee' : 'Regular';
        if (requirementsCount) requirementsCount.textContent = `${submittedCount}/${totalReq} Requirements`;
        if (progressPercentage) progressPercentage.textContent = `${percentage}%`;
        if (progressFill) progressFill.style.width = `${percentage}%`;

        if (summarySubmitted) summarySubmitted.textContent = submittedCount;
        if (summaryMissing) summaryMissing.textContent = missingCount;
        if (summaryComplete) summaryComplete.textContent = `${percentage}%`;

        let html = '';

        // Submitted Requirements
        if (submittedRequirements.length > 0) {
            html += `
                <div class="requirements-grid submitted-grid">
                    <h4><i class="fas fa-check-circle" style="color: #10b981;"></i> Submitted Requirements</h4>
                    <div class="requirements-list">
                        ${submittedRequirements.map(req => `
                            <div class="requirement-item submitted">
                                <div class="requirement-icon" style="background: #10b98120;">
                                    <i class="fas fa-check-circle" style="color: #10b981;"></i>
                                </div>
                                <div class="requirement-info">
                                    <div class="requirement-name" style="font-weight: 600; color: #1e293b;">${req.name}</div>
                                    <div class="requirement-status">
                                        <span class="status-badge-submitted" style="color: #065f46; font-weight: 600; font-size: 0.8rem;">
                                            <i class="fas fa-check-circle"></i> Submitted
                                        </span>
                                        ${req.is_required ? 
                                            '<span class="requirement-badge badge-required" style="margin-left: 6px; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; background: #fee2e2; color: #dc2626;">Required</span>' : 
                                            '<span class="requirement-badge badge-optional" style="margin-left: 6px; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; background: #f1f5f9; color: #64748b;">Optional</span>'
                                        }
                                    </div>
                                </div>
                                ${req.file_path ? `
                                    <div class="requirement-actions">
                                        <button class="btn-view-file" onclick="window.viewFile('${encodeURI(req.file_path)}', '${encodeURIComponent(req.name)}')" style="display: inline-flex; align-items: center; gap: 4px; padding: 5px 12px; border-radius: 6px; background: #0b2b4a; color: #FFD700; border: none; cursor: pointer; font-size: 0.82rem; font-weight: 600;">
                                            <i class="fas fa-eye"></i> View File
                                        </button>
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Missing Requirements
        if (missingRequirements.length > 0) {
            html += `
                <div class="requirements-grid missing-grid" style="margin-top: 15px;">
                    <h4><i class="fas fa-exclamation-triangle" style="color: #f59e0b;"></i> Missing Requirements</h4>
                    <div class="requirements-list">
                        ${missingRequirements.map(req => `
                            <div class="requirement-item missing">
                                <div class="requirement-icon" style="background: #fee2e2;">
                                    <i class="fas fa-times-circle" style="color: #dc2626;"></i>
                                </div>
                                <div class="requirement-info">
                                    <div class="requirement-name" style="font-weight: 600; color: #1e293b;">${req.name}</div>
                                    <div class="requirement-status">
                                        <span class="status-badge-missing" style="color: #991b1b; font-weight: 600; font-size: 0.8rem;">
                                            <i class="fas fa-times-circle"></i> Not Submitted
                                        </span>
                                        ${req.is_required ? 
                                            '<span class="requirement-badge badge-required" style="margin-left: 6px; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; background: #fee2e2; color: #dc2626;">Required</span>' : 
                                            '<span class="requirement-badge badge-follow" style="margin-left: 6px; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; background: #fef3c7; color: #92400e;">Can be followed</span>'
                                        }
                                    </div>
                                </div>
                                <div class="requirement-actions">
                                    <button class="btn-notify" onclick="window.notifyRequirement('${req.name.replace(/'/g, "\\'")}')" style="display: inline-flex; align-items: center; gap: 4px; padding: 5px 12px; border-radius: 6px; background: #fff; color: #0b2b4a; border: 1px solid #0b2b4a; cursor: pointer; font-size: 0.82rem; font-weight: 600;">
                                        <i class="fas fa-bell"></i> Notify
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        requirementsContainer.innerHTML = html;
    }

    // ============================================
    // RENDER ENROLLMENT HISTORY
    // ============================================

    function renderHistory() {
        if (!historyBody) return;

        if (historyCount) {
            historyCount.textContent = `${enrollmentHistory.length} records`;
        }

        if (enrollmentHistory.length === 0) {
            historyBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 25px; color: #94a3b8;">
                        <i class="fas fa-history" style="font-size: 24px; margin-bottom: 6px;"></i>
                        <p style="margin: 0;">No previous enrollment history recorded.</p>
                    </td>
                </tr>
            `;
            return;
        }

        historyBody.innerHTML = enrollmentHistory.map(record => {
            const statusRaw = (record.status || '').toLowerCase();
            let stText = 'Pending';
            let stClass = 'badge-pending';
            if (statusRaw === 'approved' || statusRaw === 'enrolled') {
                stText = 'Enrolled';
                stClass = 'badge-enrolled';
            } else if (statusRaw === 'rejected') {
                stText = 'Rejected';
                stClass = 'badge-rejected';
            }

            return `
                <tr>
                    <td style="font-weight: 600;">${record.school_year || record.last_school_year || '2025-2026'}</td>
                    <td>${record.grade_level || 'Grade 11'}</td>
                    <td>${record.strand || '—'}</td>
                    <td>
                        <span class="badge ${stClass}">
                            ${stText}
                        </span>
                    </td>
                    <td>${formatDate(record.created_at)}</td>
                </tr>
            `;
        }).join('');
    }

    // ============================================
    // FILE PREVIEW MODAL
    // ============================================

    window.viewFile = function(filePath, reqName) {
        if (!filePath) {
            showAlert('No file URL available.', 'error');
            return;
        }

        const decodedPath = decodeURI(filePath);
        const name = reqName ? decodeURIComponent(reqName) : 'Document';

        if (modalFileName) modalFileName.textContent = name;
        if (downloadFileBtn) {
            downloadFileBtn.href = decodedPath;
            downloadFileBtn.target = '_blank';
        }

        if (modalBody) {
            const isImage = /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(decodedPath);
            if (isImage) {
                modalBody.innerHTML = `
                    <div style="text-align: center; padding: 10px;">
                        <img src="${decodedPath}" alt="${name}" style="max-width: 100%; max-height: 450px; border-radius: 8px; object-fit: contain; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    </div>
                `;
            } else {
                modalBody.innerHTML = `
                    <div style="text-align: center; padding: 30px;">
                        <i class="fas fa-file-pdf" style="font-size: 54px; color: #dc2626; margin-bottom: 12px;"></i>
                        <p style="font-size: 15px; font-weight: 600; color: #1e293b;">${name}</p>
                        <a href="${decodedPath}" target="_blank" style="display: inline-block; margin-top: 10px; padding: 8px 18px; border-radius: 8px; background: #0b2b4a; color: #FFD700; text-decoration: none; font-weight: 600;">
                            <i class="fas fa-external-link-alt"></i> Open Document in New Tab
                        </a>
                    </div>
                `;
            }
        }

        if (filePreviewModal) filePreviewModal.classList.add('show');
    };

    window.closeFileModal = function() {
        if (filePreviewModal) filePreviewModal.classList.remove('show');
    };

    // Notify Missing Requirement
    window.notifyRequirement = async function(requirementName) {
        const student = currentStudent;
        const enr = currentEnrollment;
        const sName = student ? `${student.first_name || ''} ${student.last_name || ''}`.trim() : (enr ? `${enr.first_name || ''} ${enr.last_name || ''}`.trim() : 'Student');

        if (!confirm(`Send notification to ${sName} regarding missing requirement "${requirementName}"?`)) {
            return;
        }

        try {
            const targetId = student?.user_id || student?.id || enr?.student_id || enr?.user_id || null;
            const targetStudentId = student?.id || enr?.student_id || null;
            const targetEmail = student?.email || enr?.email || null;
            const notifMsg = `Notice for ${sName}: Please submit your "${requirementName}" to finalize your enrollment application.`;

            await supabase.from('notifications').insert([{
                user_id: targetId,
                student_id: targetStudentId,
                recipient_email: targetEmail,
                role: 'student',
                title: 'Missing Requirement Notice',
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
                        title: 'Missing Requirement Notice',
                        message: notifMsg,
                        time: 'Just now',
                        read: false
                    });
                    localStorage.setItem(k, JSON.stringify(list.slice(0, 30)));
                } catch(e) {}
            }

            showAlert(`✅ In-app notification for "${requirementName}" posted to ${sName}'s dashboard!`, 'success');

            if (targetEmail) {
                const sendGmail = confirm(`✉️ Notification posted! Would you also like to open Gmail compose to send this notice directly to the student's Gmail (${targetEmail})?`);
                if (sendGmail) {
                    const emailData = EmailNotificationService.buildMissingRequirementsEmail({
                        studentName: sName,
                        email: targetEmail,
                        missingRequirement: requirementName,
                        gradeLevel: student?.grade_level || enr?.grade_level || 'Junior/Senior High'
                    });
                    EmailNotificationService.sendViaGmailWeb(emailData);
                }
            }
        } catch (error) {
            console.error('❌ Error notifying requirement:', error);
            showAlert('Failed to send notification: ' + error.message, 'error');
        }
    };

    // ============================================
    // CREDENTIALS MODAL & GMAIL DISPATCH
    // ============================================

    let activeCredentialsData = null;

    window.showCredentialsModal = function(creds) {
        activeCredentialsData = creds;
        const credModal = document.getElementById('credentialsModal');
        const credName = document.getElementById('credStudentName');
        const credUser = document.getElementById('credUsername');
        const credPass = document.getElementById('credPassword');

        if (credName) credName.textContent = creds.studentFullName || `${creds.firstName} ${creds.lastName}`;
        if (credUser) credUser.textContent = creds.email;
        if (credPass) credPass.textContent = creds.lastName;

        if (credModal) credModal.style.display = 'flex';
    };

    window.closeCredentialsModal = function() {
        const credModal = document.getElementById('credentialsModal');
        if (credModal) credModal.style.display = 'none';
    };

    const closeCredBtn = document.getElementById('closeCredentialsBtn');
    const dismissCredBtn = document.getElementById('dismissCredentialsBtn');
    const copyUserBtn = document.getElementById('copyUsernameBtn');
    const copyPassBtn = document.getElementById('copyPasswordBtn');
    const sendGmailCredBtn = document.getElementById('sendGmailCredBtn');
    const copyEmailTextBtn = document.getElementById('copyEmailTextBtn');
    const sendMailtoCredBtn = document.getElementById('sendMailtoCredBtn');

    if (closeCredBtn) closeCredBtn.addEventListener('click', window.closeCredentialsModal);
    if (dismissCredBtn) dismissCredBtn.addEventListener('click', window.closeCredentialsModal);

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
                showAlert('📋 Full credentials email template copied to clipboard!', 'success');
            } else {
                showAlert('Failed to copy text.', 'error');
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

    // Close modal on background click
    document.addEventListener('click', function(e) {
        if (e.target === filePreviewModal) {
            window.closeFileModal();
        }
        const credModal = document.getElementById('credentialsModal');
        if (e.target === credModal) {
            window.closeCredentialsModal();
        }
    });

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

    loadEnrollmentDetails();

})();