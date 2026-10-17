/**
 * HES Admin - View Enrollment Details (Supabase Dynamic Integration)
 * Requirements read STRICTLY from ENROLLMENTS table.
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
    const avatarEl = document.getElementById('studentAvatar') || document.querySelector('.student-avatar-large');
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
    let currentAddress = null;
    let currentParent = null;
    let currentSection = null;
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
            const targetId = (urlParams.get('id') || urlParams.get('enrollment_id') || '').trim();

            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId);

            // 1. Query Enrollments
            let enr = null;
            if (targetId && isUuid) {
                try {
                    const { data: eData } = await supabase
                        .from('enrollments')
                        .select('*')
                        .eq('id', targetId)
                        .maybeSingle();
                    if (eData) enr = eData;
                } catch(e) {}

                if (!enr) {
                    try {
                        const { data: eData } = await supabase
                            .from('enrollments')
                            .select('*')
                            .eq('student_id', targetId)
                            .order('created_at', { ascending: false })
                            .limit(1)
                            .maybeSingle();
                        if (eData) enr = eData;
                    } catch(e) {}
                }
            } else if (targetId) {
                try {
                    const { data: eList } = await supabase
                        .from('enrollments')
                        .select('*')
                        .or(`email.ilike.${targetId},lrn.eq.${targetId}`)
                        .order('created_at', { ascending: false })
                        .limit(1);
                    if (eList && eList.length > 0) enr = eList[0];
                } catch(e) {}
            }

            // Fallback: latest enrollment
            if (!enr) {
                try {
                    const { data: fallbackList } = await supabase
                        .from('enrollments')
                        .select('*')
                        .order('created_at', { ascending: false })
                        .limit(1);
                    if (fallbackList && fallbackList.length > 0) {
                        enr = fallbackList[0];
                    }
                } catch(e) {}
            }

            // 2. Fetch associated student record
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

            if (!student && targetId && isUuid) {
                try {
                    const { data: sData } = await supabase
                        .from('students')
                        .select('*')
                        .eq('id', targetId)
                        .maybeSingle();
                    if (sData) student = sData;
                } catch(e) {}
            }

            // If no enrollment but student found, synthesize enrollment
            if (!enr && student) {
                enr = {
                    id: student.id,
                    student_id: student.id,
                    first_name: student.first_name,
                    last_name: student.last_name,
                    email: student.email,
                    grade_level: student.grade_level || 'Grade 11',
                    strand: student.strand || 'TVL-ICT',
                    school_year: '2026-2027',
                    status: student.documents_status === 'complete' ? 'approved' : 'pending',
                    created_at: student.created_at || new Date().toISOString()
                };
            }

            if (!enr) {
                showAlert('No enrollment applications found in the database.', 'error');
                if (studentName) studentName.textContent = 'No records found';
                if (enrollmentInfoGrid) enrollmentInfoGrid.innerHTML = '<div style="text-align: center; padding: 24px; color: #64748b; grid-column: 1/-1;">No enrollment application available.</div>';
                if (historyBody) historyBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 24px; color: #94a3b8;">No enrollment history recorded.</td></tr>';
                return;
            }

            currentEnrollment = enr;
            currentStudent = student;

            // 3. Query Address
            currentAddress = null;
            if (student?.id) {
                try {
                    const { data: addrData } = await supabase
                        .from('addresses')
                        .select('*')
                        .eq('student_id', student.id)
                        .maybeSingle();
                    if (addrData) currentAddress = addrData;
                } catch(e) {}
            }

            // 4. Query Parents / Guardians
            currentParent = null;
            if (student?.id) {
                try {
                    const { data: parData } = await supabase
                        .from('parents_guardians')
                        .select('*')
                        .eq('student_id', student.id)
                        .maybeSingle();
                    if (parData) currentParent = parData;
                } catch(e) {}
            }

            // 5. Fetch all enrollment history for this student
            try {
                let hQuery = supabase.from('enrollments').select('*');
                if (student?.id) {
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

            // 6. Query Section & Adviser
            currentSection = null;
            if (student?.section_id) {
                try {
                    const { data: secData } = await supabase
                        .from('sections')
                        .select('id, name, grade_level, strand, adviser_name, room')
                        .eq('id', student.section_id)
                        .maybeSingle();
                    if (secData) currentSection = secData;
                } catch(e) {}
            }

            // 7. Compute Requirements — STRICTLY FROM ENROLLMENTS TABLE
            buildRequirementsList(enr);

            // Render all UI components
            renderStudentInfo();
            const adminGenBtn = document.getElementById('adminGenerateIdBtn');
            if (adminGenBtn && currentEnrollment) {
                adminGenBtn.href = `generate_id.html?enrollment_id=${currentEnrollment.id || ''}${currentEnrollment.student_id ? '&id=' + currentEnrollment.student_id : (student?.id ? '&id=' + student.id : '')}&email=${encodeURIComponent(currentEnrollment.email || '')}`;
            }
            renderEnrollmentInfo();
            renderRequirements();
            renderHistory();
            updateActionButtons();

        } catch (error) {
            console.error('❌ Error loading enrollment details:', error);
            showAlert('Failed to load enrollment details: ' + error.message, 'error');
        }
    }

    // ============================================
    // BUILD REQUIREMENTS DATA — STRICTLY FROM ENROLLMENTS TABLE
    // ============================================

    function buildRequirementsList(enr) {
        submittedRequirements = [];
        missingRequirements = [];

        if (!enr) return;

        const rawStudentType = String(enr.student_type || '').toLowerCase();
        const isTransferee =
            rawStudentType.includes('transfer') ||
            rawStudentType.includes('different') ||
            rawStudentType.includes('transferee');

        const gradeLevelStr = String(enr.grade_level || '');
        const isSeniorHigh =
            gradeLevelStr.includes('11') ||
            gradeLevelStr.includes('12');

        // Helper: treat null/undefined/empty strings as "missing"
        const has = (v) => typeof v === 'string' && v.trim().length > 0;

        // 1. Report Card / Form 138 — required for ALL grade levels
        const form138Url = has(enr.form_138_url) ? enr.form_138_url
                         : has(enr.report_card_url) ? enr.report_card_url
                         : null;

        if (form138Url) {
            submittedRequirements.push({
                name: 'Report Card (Form 138)',
                is_required: true,
                can_be_followed: false,
                file_path: form138Url
            });
        } else {
            missingRequirements.push({
                name: 'Report Card (Form 138)',
                is_required: true,
                can_be_followed: false,
                file_path: null
            });
        }

        // 2. PSA Birth Certificate — required for ALL grade levels
        const psaUrl = has(enr.psa_birth_cert_url) ? enr.psa_birth_cert_url : null;

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

        // 3. Good Moral Certificate — required for ALL grade levels
        const goodMoralUrl = has(enr.good_moral_cert_url) ? enr.good_moral_cert_url : null;

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

        // 4. 2x2 ID Picture — required for ALL grade levels
        const twoByTwoUrl = has(enr.two_by_two_picture_url) ? enr.two_by_two_picture_url : null;

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

        // 5. Form 137 — required ONLY for transferees
        if (isTransferee) {
            const form137Url = has(enr.form_137_url) ? enr.form_137_url : null;

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

        // 6. JHS Certificate of Completion
        const jhsCertUrl = has(enr.certificate_of_completion_url) ? enr.certificate_of_completion_url : null;

        if (isSeniorHigh) {
            if (jhsCertUrl) {
                submittedRequirements.push({
                    name: 'JHS Certificate of Completion',
                    is_required: false,
                    can_be_followed: true,
                    file_path: jhsCertUrl
                });
            } else {
                missingRequirements.push({
                    name: 'JHS Certificate of Completion',
                    is_required: false,
                    can_be_followed: true,
                    file_path: null
                });
            }
        } else if (jhsCertUrl) {
            submittedRequirements.push({
                name: 'JHS Certificate of Completion',
                is_required: false,
                can_be_followed: false,
                file_path: jhsCertUrl
            });
        }
    }

    // ============================================
    // RENDER STUDENT INFO CARD
    // ============================================

    function renderStudentInfo() {
        const enr = currentEnrollment || {};
        const student = currentStudent || {};

        const fName = (student.first_name || enr.first_name || '').trim();
        const lName = (student.last_name || enr.last_name || '').trim();
        const mName = (student.middle_name || '').trim();
        const suffix = (student.suffix || '').trim();
        let fullName = `${fName} ${mName ? mName + ' ' : ''}${lName}${suffix ? ' ' + suffix : ''}`.trim();
        if (!fullName) fullName = 'Student Applicant';

        const email = enr.email || student.email || '—';
        const lrn = student.lrn || student.student_id_number || enr.lrn || 'Pending LRN';

        if (studentName) studentName.textContent = fullName;
        if (studentEmail) studentEmail.textContent = email;
        if (studentIdNumber) studentIdNumber.textContent = lrn;
        if (totalEnrollmentsEl) totalEnrollmentsEl.textContent = enrollmentHistory.length;

        const createdAt = enr.created_at || student.created_at;
        const sinceYear = createdAt ? new Date(createdAt).getFullYear() : 2026;
        if (sinceYearEl) sinceYearEl.textContent = sinceYear;

        if (avatarEl) {
            avatarEl.textContent = fullName.charAt(0).toUpperCase() || 'S';
        }

        if (viewFullProfileLink) {
            const profileTargetId = student.id || enr.student_id || enr.id;
            viewFullProfileLink.href = profileTargetId ? `view_student.html?id=${encodeURIComponent(profileTargetId)}` : 'student.html';
        }
    }

    // ============================================
    // RENDER ENROLLMENT INFO GRID
    // ============================================

    function renderEnrollmentInfo() {
        if (!enrollmentInfoGrid || !currentEnrollment) return;

        const enr = currentEnrollment || {};
        const student = currentStudent || {};
        const addr = currentAddress || {};
        const par = currentParent || {};

        const gradeLevel = enr.grade_level || student.grade_level || 'Grade 11';
        const strand = enr.strand || student.strand || (gradeLevel.includes('11') || gradeLevel.includes('12') ? 'TVL-ICT' : 'Junior High');
        const schoolYear = enr.school_year || enr.last_school_year || '2026-2027';

        const rawStatus = (enr.status || 'Pending').trim().toLowerCase();
        let status = 'Pending';
        let statusClass = 'pending';

        if (rawStatus === 'approved' || rawStatus === 'enrolled') {
            status = 'Enrolled';
            statusClass = 'enrolled';
        } else if (rawStatus === 'rejected') {
            status = 'Rejected';
            statusClass = 'rejected';
        }

        const rawStudentType = enr.student_type || student.student_type || (gradeLevel.includes('7') ? 'New Student' : 'Continuing');
        const typeMap = {
            'new': 'New Student (From Elementary)',
            'continuing': 'Continuing Student',
            'transferee': 'Transferee',
            'same_school': 'From PLSNHS',
            'different_school': 'Transferee (From another school)'
        };
        const studentType = typeMap[rawStudentType] || rawStudentType;

        const rawPrevSchool = (enr.previous_school || student.previous_school || '').trim();
        const prevSchool = (rawPrevSchool && rawPrevSchool !== 'N/A') ? rawPrevSchool : 'Placido L. Señor National High School (PLSNHS)';

        const rawGpa = (enr.general_average || student.general_average || '').toString().trim();
        const gpa = (rawGpa && rawGpa !== 'N/A') ? rawGpa : '—';

        const rawDob = enr.date_of_birth || enr.dob || student.date_of_birth || student.birth_date;
        const birthDate = rawDob ? formatDate(rawDob) : '—';
        const gender = enr.gender || student.gender || '—';
        const contactNum = enr.contact_number || enr.guardian_contact || student.contact_number || student.phone || '—';

        let fullAddress = enr.address || student.address || enr.guardian_address;
        if (!fullAddress && (addr.barangay || addr.city)) {
            fullAddress = [addr.street, addr.barangay, addr.city, addr.province, addr.zip_code].filter(Boolean).join(', ');
        }
        if (!fullAddress) fullAddress = '—';

        const parentName = enr.guardian_name || enr.mother_name || enr.father_name || par.guardian_name || par.father_name || par.mother_name || student.parent_name || '—';
        const parentContact = enr.guardian_contact || par.guardian_contact || par.father_contact || par.mother_contact || student.parent_contact || contactNum;
        const relationship = enr.guardian_relationship || par.guardian_relationship || 'Parent / Guardian';

        enrollmentInfoGrid.innerHTML = `
            <div class="info-item">
                <div class="info-label">Student Type</div>
                <div class="info-value"><i class="fas fa-user-tag"></i> ${studentType}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Grade Level</div>
                <div class="info-value"><i class="fas fa-layer-group"></i> ${gradeLevel}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Section</div>
                <div class="info-value"><i class="fas fa-users-rectangle" style="color: #2563eb;"></i> ${currentSection ? `<strong>${currentSection.name}</strong>${currentSection.room ? ` (Rm ${currentSection.room})` : ''}` : '<span style="color: #94a3b8; font-style: italic;">Unassigned</span>'}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Class Adviser</div>
                <div class="info-value"><i class="fas fa-chalkboard-user" style="color: #059669;"></i> ${currentSection && currentSection.adviser_name ? `<strong>${currentSection.adviser_name}</strong>` : '<span style="color: #94a3b8; font-style: italic;">No Adviser Assigned</span>'}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Strand / Track</div>
                <div class="info-value"><i class="fas fa-tag"></i> ${strand}</div>
            </div>
            <div class="info-item">
                <div class="info-label">School Year</div>
                <div class="info-value"><i class="fas fa-calendar-alt"></i> ${schoolYear}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Enrollment Status</div>
                <div class="info-value">
                    <span class="status-badge-small status-${statusClass}" style="padding: 4px 12px; border-radius: 20px; font-weight: 600;">
                        ${status}
                    </span>
                </div>
            </div>
            <div class="info-item">
                <div class="info-label">Application Date</div>
                <div class="info-value"><i class="fas fa-clock"></i> ${formatDate(enr.created_at)}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Previous School</div>
                <div class="info-value"><i class="fas fa-school"></i> ${prevSchool}</div>
            </div>
            <div class="info-item">
                <div class="info-label">General Average</div>
                <div class="info-value"><i class="fas fa-chart-line"></i> ${gpa}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Date of Birth / Gender</div>
                <div class="info-value"><i class="fas fa-birthday-cake"></i> ${birthDate} (${gender})</div>
            </div>
            <div class="info-item">
                <div class="info-label">Contact Number</div>
                <div class="info-value"><i class="fas fa-phone"></i> ${contactNum}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Complete Address</div>
                <div class="info-value"><i class="fas fa-map-marker-alt"></i> ${fullAddress}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Guardian / Relationship</div>
                <div class="info-value"><i class="fas fa-user-friends"></i> ${parentName} (${relationship}) - ${parentContact}</div>
            </div>
        `;
    }

    // ============================================
    // RENDER REQUIREMENTS SECTION
    // ============================================

    function renderRequirements() {
        if (!requirementsContainer) return;

        const enr = currentEnrollment || {};
        const student = currentStudent || {};

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

        const gLevel = enr.grade_level || student.grade_level || 'Grade 11';
        const sType = enr.previous_school ? 'Transferee' : (enr.student_type || 'Regular / Continuing');

        if (reqGradeLevel) reqGradeLevel.textContent = gLevel;
        if (reqStudentType) reqStudentType.textContent = sType;
        if (requirementsCount) requirementsCount.textContent = `${submittedCount}/${totalReq} Requirements`;
        if (progressPercentage) progressPercentage.textContent = `${percentage}%`;
        if (progressFill) progressFill.style.width = `${percentage}%`;

        if (summarySubmitted) summarySubmitted.textContent = submittedCount;
        if (summaryMissing) summaryMissing.textContent = missingCount;
        if (summaryComplete) summaryComplete.textContent = `${percentage}%`;

        let html = '';

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
                                        <button class="btn-view-file"
                                                data-file-path="${String(req.file_path).replace(/"/g, '&quot;')}"
                                                data-req-name="${String(req.name).replace(/"/g, '&quot;')}"
                                                style="display: inline-flex; align-items: center; gap: 4px; padding: 5px 12px; border-radius: 6px; background: #0b2b4a; color: #FFD700; border: none; cursor: pointer; font-size: 0.82rem; font-weight: 600;">
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
                                    <button class="btn-notify" data-req-name="${String(req.name).replace(/"/g, '&quot;')}" style="display: inline-flex; align-items: center; gap: 4px; padding: 5px 12px; border-radius: 6px; background: #fff; color: #0b2b4a; border: 1px solid #0b2b4a; cursor: pointer; font-size: 0.82rem; font-weight: 600;">
                                        <i class="fas fa-bell"></i> Notify
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        if (submittedRequirements.length === 0 && missingRequirements.length === 0) {
            html = '<div style="text-align: center; padding: 20px; color: #64748b;">No requirement data found.</div>';
        }

        requirementsContainer.innerHTML = html;

        // Attach event listeners (safe for base64 data-URIs)
        requirementsContainer.querySelectorAll('.btn-view-file').forEach(btn => {
            btn.addEventListener('click', function () {
                window.viewFile(this.dataset.filePath, this.dataset.reqName);
            });
        });
        requirementsContainer.querySelectorAll('.btn-notify').forEach(btn => {
            btn.addEventListener('click', function () {
                window.notifyRequirement(this.dataset.reqName);
            });
        });
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
                    <td style="font-weight: 600;">${record.school_year || record.last_school_year || '2026-2027'}</td>
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
    // FILE PREVIEW MODAL — HANDLES base64 & URLs
    // ============================================

    window.viewFile = function(filePath, reqName) {
        if (!filePath) {
            showAlert('No file URL available.', 'error');
            return;
        }

        // 🔥 FIX: Do NOT decodeURIComponent standard web URLs (http/https)
        // Decoding it breaks the Supabase Storage URL (which has %2F for slashes)
        const isDataUri = /^data:/i.test(filePath);
        let finalPath = filePath;
        
        if (!isDataUri && !filePath.startsWith('http')) {
            try {
                finalPath = decodeURIComponent(filePath);
            } catch {
                finalPath = filePath;
            }
        }

        const name = reqName ? String(reqName) : 'Document';

        if (modalFileName) modalFileName.textContent = name;
        if (downloadFileBtn) {
            downloadFileBtn.href = finalPath;
            downloadFileBtn.target = '_blank';
        }

        if (modalBody) {
            // 🔥 FIX: Better image detection
            const isImage =
                isDataUri ||
                finalPath.startsWith('http') || 
                /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(finalPath);

            if (isImage) {
                modalBody.innerHTML = `
                    <div style="text-align: center; padding: 10px;">
                        <img src="${finalPath}" alt="${name}" style="max-width: 100%; max-height: 450px; border-radius: 8px; object-fit: contain; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'padding:20px;color:#dc2626;text-align:center;\\'><i class=\\'fas fa-file-pdf\\' style=\\'font-size:54px;margin-bottom:12px;\\'></i><br>Preview not available. Click Download to open.</div>'">
                    </div>
                `;
            } else {
                modalBody.innerHTML = `
                    <div style="text-align: center; padding: 30px;">
                        <i class="fas fa-file-pdf" style="font-size: 54px; color: #dc2626; margin-bottom: 12px;"></i>
                        <p style="font-size: 15px; font-weight: 600; color: #1e293b;">${name}</p>
                        <a href="${finalPath}" target="_blank" style="display: inline-block; margin-top: 10px; padding: 8px 18px; border-radius: 8px; background: #0b2b4a; color: #FFD700; text-decoration: none; font-weight: 600;">
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

    window.notifyRequirement = async function(requirementName) {
        const student = currentStudent;
        const enr = currentEnrollment;
        const sName = student ? `${student.first_name || ''} ${student.last_name || ''}`.trim() : (enr ? `${enr.first_name || ''} ${enr.last_name || ''}`.trim() : 'Student');

        if (!confirm(`Send notification to ${sName} regarding missing requirement "${requirementName}"?`)) return;

        try {
            const targetId = student?.user_id || student?.id || enr?.student_id || enr?.user_id || null;
            const targetEmail = student?.email || enr?.email || null;
            const notifMsg = `Notice for ${sName}: Please submit your "${requirementName}" to finalize your enrollment application.`;

            await supabase.from('notifications').insert([{
                user_id: targetId,
                role: 'student',
                title: 'Missing Requirement Notice',
                message: notifMsg,
                type: 'document_reminder',
                read: false,
                is_read: false,
                created_at: new Date().toISOString()
            }]);

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

    // ============================================
    // APPROVE & REJECT ACTIONS
    // ============================================

    function updateActionButtons() {
        const enr = currentEnrollment;
        const student = currentStudent;
        const btnApprove = document.getElementById('btnApproveEnrollment');
        const btnReject = document.getElementById('btnRejectEnrollment');
        const adminGenBtn = document.getElementById('adminGenerateIdBtn');
        const statusBadge = document.getElementById('enrollmentStatusBadge');

        const rawStatus = (enr?.status || 'pending').trim().toLowerCase();
        const isEnrolled = rawStatus === 'approved' || rawStatus === 'enrolled';
        const isRejected = rawStatus === 'rejected';

        if (statusBadge) {
            statusBadge.textContent = isEnrolled ? 'Enrolled' : (isRejected ? 'Rejected' : 'Pending');
            statusBadge.className = `status-badge-small status-${isEnrolled ? 'enrolled' : (isRejected ? 'rejected' : 'pending')}`;
            statusBadge.style.background = isEnrolled ? '#d1fae5' : (isRejected ? '#fee2e2' : '#fef3c7');
            statusBadge.style.color = isEnrolled ? '#065f46' : (isRejected ? '#991b1b' : '#92400e');
        }

        if (btnApprove) btnApprove.style.display = isEnrolled ? 'none' : 'inline-flex';
        if (btnReject) btnReject.style.display = isRejected ? 'none' : 'inline-flex';

        if (adminGenBtn) {
            if (isEnrolled && enr) {
                adminGenBtn.style.display = 'inline-flex';
                adminGenBtn.href = `generate_id.html?enrollment_id=${enr.id || ''}${enr.student_id ? '&id=' + enr.student_id : (student?.id ? '&id=' + student.id : '')}&email=${encodeURIComponent(enr.email || '')}`;
            } else {
                adminGenBtn.style.display = 'none';
            }
        }
    }

    async function handleApproveEnrollment() {
        if (!currentEnrollment) return;
        const enr = currentEnrollment;
        const student = currentStudent;

        const fName = (student?.first_name || enr.first_name || '').trim();
        const lName = (student?.last_name || enr.last_name || '').trim();
        let fullName = `${fName} ${lName}`.trim() || 'Student Applicant';

        if (missingRequirements && missingRequirements.length > 0) {
            const proceed = confirm(`⚠️ Notice: ${fullName} has ${missingRequirements.length} missing requirement(s):\n- ${missingRequirements.map(r => r.name).join('\n- ')}\n\nDo you still wish to APPROVE this enrollment and generate student login credentials?`);
            if (!proceed) return;
        } else {
            if (!confirm(`Are you sure you want to APPROVE enrollment for ${fullName}?`)) return;
        }

        try {
            showAlert('Processing enrollment approval & provisioning student account...', 'info');

            const email = (enr.email || student?.email || '').trim().toLowerCase();
            let lastName = lName;
            let firstName = fName;
            const gradeName = enr.grade_level || student?.grade_level || 'Grade 11';
            const strand = enr.strand || student?.strand || '';

            if (!lastName && fullName) {
                const parts = fullName.split(' ');
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

            let studentTableId = enr.student_id || student?.id;
            const studentPayload = {
                first_name: firstName,
                last_name: lastName,
                middle_name: enr.middle_name || student?.middle_name || null,
                email: email,
                grade_level: gradeName,
                strand: strand || null,
                lrn: enr.lrn || student?.lrn || ('141525' + String(Date.now()).slice(-6)),
                date_of_birth: enr.date_of_birth || enr.dob || student?.date_of_birth || '2008-01-01',
                contact_number: enr.contact_number || enr.guardian_contact || student?.contact_number || '09000000000',
                enrollment_id: enr.id,
                two_by_two_picture_url: enr.two_by_two_picture_url || student?.two_by_two_picture_url || null,
                avatar_url: enr.two_by_two_picture_url || student?.avatar_url || null,
                documents_status: 'complete',
                updated_at: new Date().toISOString()
            };

            if (studentTableId) {
                await supabase.from('students').update(studentPayload).eq('id', studentTableId);
            } else if (email) {
                studentPayload.created_at = new Date().toISOString();
                const { data: createdStudent } = await supabase
                    .from('students').insert([studentPayload]).select();

                if (createdStudent && createdStudent.length > 0) {
                    studentTableId = createdStudent[0].id;
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
                .eq('id', enr.id);

            currentEnrollment.status = 'enrolled';
            if (studentTableId) currentEnrollment.student_id = studentTableId;

            const credsMsg = `Congratulations ${firstName}! Your enrollment application for ${gradeName} (${strand || 'General'}) S.Y. ${enr.school_year || '2026-2027'} has been approved by the Administration.\n\nYour Student Portal Login Credentials:\n• Username (Gmail): ${email}\n• Initial Password: ${lastName}\n\nYou can now log in to the HES Student Portal. Upon your first login, please visit "My Profile" to update your password.`;

            const targetStudentId = studentUserId || studentTableId || null;
            await supabase.from('notifications').insert([{
                user_id: targetStudentId,
                role: 'student',
                title: '🎉 Enrollment Approved!',
                message: credsMsg,
                type: 'action',
                enrollment_id: enr.id,
                read: false,
                is_read: false,
                created_at: new Date().toISOString()
            }]);

            const credsPayload = {
                email,
                lastName,
                firstName,
                studentFullName: fullName,
                gradeLevel: gradeName,
                strand: strand || '',
                schoolYear: enr.school_year || '2026-2027',
                enrollmentId: enr.id,
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

            window.showCredentialsModal(credsPayload);
            showAlert(`✅ Enrollment for ${fullName} approved! Account created (Username: ${email}, Password: ${lastName}).`, 'success');

            renderEnrollmentInfo();
            updateActionButtons();

        } catch (err) {
            console.error('❌ Error approving enrollment:', err);
            showAlert('Failed to approve enrollment: ' + err.message, 'error');
        }
    }

    async function handleRejectEnrollment() {
        if (!currentEnrollment) return;
        const enr = currentEnrollment;
        const fullName = studentName?.textContent || 'Student';

        const reason = prompt(`Please enter reason for rejecting enrollment for ${fullName}:`, 'Incomplete requirements or invalid documents.');
        if (reason === null) return;

        try {
            showAlert('Updating application status...', 'info');

            await supabase
                .from('enrollments')
                .update({
                    status: 'rejected',
                    updated_at: new Date().toISOString()
                })
                .eq('id', enr.id);

            currentEnrollment.status = 'rejected';

            const targetId = enr.student_id || null;
            const rejMsg = `Notice for ${fullName}: Your enrollment application was not approved. Reason: ${reason}`;

            await supabase.from('notifications').insert([{
                user_id: targetId,
                role: 'student',
                title: '⚠️ Enrollment Update',
                message: rejMsg,
                type: 'enrollment_status',
                enrollment_id: enr.id,
                is_read: false,
                read: false,
                created_at: new Date().toISOString()
            }]);

            showAlert(`Application for ${fullName} has been marked as rejected.`, 'warning');
            renderEnrollmentInfo();
            updateActionButtons();

        } catch (err) {
            console.error('❌ Error rejecting enrollment:', err);
            showAlert('Failed to reject enrollment: ' + err.message, 'error');
        }
    }

    const btnApprove = document.getElementById('btnApproveEnrollment');
    const btnReject = document.getElementById('btnRejectEnrollment');
    if (btnApprove) btnApprove.addEventListener('click', handleApproveEnrollment);
    if (btnReject) btnReject.addEventListener('click', handleRejectEnrollment);

    document.addEventListener('click', function(e) {
        if (e.target === filePreviewModal) window.closeFileModal();
        const credModal = document.getElementById('credentialsModal');
        if (e.target === credModal) window.closeCredentialsModal();
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