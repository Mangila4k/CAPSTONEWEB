/**
 * HES Registrar - View Enrollment Details (Supabase Dynamic Integration)
 */

import { supabase } from '../../supabase/config.js';
import { EmailNotificationService } from '../../js/email_service.js';

(function() {
    'use strict';

    console.log('📋 Registrar View Enrollment Details (Supabase) ready');

    // ============================================
    // DOM ELEMENTS
    // ============================================

    const adminName = document.getElementById('adminName');
    const adminInitial = document.getElementById('adminInitial');
    const logoutBtn = document.getElementById('logoutBtn');
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const alertContainer = document.getElementById('alertContainer');

    // Student info
    const studentName = document.getElementById('studentName');
    const studentEmail = document.getElementById('studentEmail');
    const studentId = document.getElementById('studentId');
    const registeredDate = document.getElementById('registeredDate');
    const studentAvatar = document.getElementById('studentAvatar');
    const statusBadge = document.getElementById('statusBadge');
    const infoGrid = document.getElementById('infoGrid');
    const reqBadge = document.getElementById('reqBadge');

    // Requirements & Documents
    const requirementsGrid = document.getElementById('requirementsGrid');
    const documentsGrid = document.getElementById('documentsGrid');

    // Status form
    const statusSelect = document.getElementById('statusSelect');
    const statusForm = document.getElementById('statusForm');
    const rejectionReasonGroup = document.getElementById('rejectionReasonGroup');
    const rejectionReason = document.getElementById('rejectionReason');
    const notifyStudentBtn = document.getElementById('notifyStudentBtn');

    // History
    const historyBody = document.getElementById('historyBody');
    const historyCount = document.getElementById('historyCount');

    // File Preview Modal
    const filePreviewModal = document.getElementById('filePreviewModal');
    const modalFileName = document.getElementById('modalFileName');
    const modalBody = document.getElementById('modalBody');
    const downloadFileBtn = document.getElementById('downloadFileBtn');

    // ============================================
    // STATE
    // ============================================

    let currentEnrollment = null;
    let currentStudent = null;
    let currentAddress = null;
    let currentParent = null;
    let currentDocuments = [];
    let enrollmentHistory = [];

    // ============================================
    // HELPER FUNCTIONS
    // ============================================

    function showAlert(message, type = 'success') {
        if (!alertContainer) return;
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
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
    // LOGOUT & SIDEBAR
    // ============================================

    try {
        const currentUserStr = localStorage.getItem('currentUser');
        if (currentUserStr) {
            const user = JSON.parse(currentUserStr);
            const name = user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (user.displayName || (user.email ? user.email.split('@')[0] : 'Registrar'));
            if (adminName) adminName.textContent = name;
            if (adminInitial) adminInitial.textContent = name.charAt(0).toUpperCase();
        }
    } catch(e) {}

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            localStorage.removeItem('currentUser');
            localStorage.removeItem('hes_registrar_avatar');
            localStorage.removeItem('hes_registrar_name');
            try {
                await supabase.auth.signOut();
            } catch(err) {}
            window.location.replace('../auth/login.html');
        });
    }

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
        });
    }

    // ============================================
    // REQUIREMENTS MAP
    // ============================================

    const requirementsConfig = {
        'Grade 7': [
            { key: 'two_by_two_picture', name: '2x2 ID Picture (White Background)', required: true },
            { key: 'report_card', name: 'Report Card', required: true },
            { key: 'psa_birth_cert', name: 'PSA Birth Certificate', required: true },
            { key: 'good_moral', name: 'Good Moral Certificate', required: true },
            { key: 'completion_cert', name: 'Certificate of Completion (Elementary)', required: true },
            { key: 'form_137', name: 'Form 137 (Permanent Record)', required: false }
        ],
        'Grade 8': [
            { key: 'two_by_two_picture', name: '2x2 ID Picture (White Background)', required: true },
            { key: 'report_card', name: 'Report Card', required: true },
            { key: 'psa_birth_cert', name: 'PSA Birth Certificate', required: true },
            { key: 'good_moral', name: 'Good Moral Certificate', required: true }
        ],
        'Grade 9': [
            { key: 'two_by_two_picture', name: '2x2 ID Picture (White Background)', required: true },
            { key: 'report_card', name: 'Report Card', required: true },
            { key: 'psa_birth_cert', name: 'PSA Birth Certificate', required: true },
            { key: 'good_moral', name: 'Good Moral Certificate', required: true }
        ],
        'Grade 10': [
            { key: 'two_by_two_picture', name: '2x2 ID Picture (White Background)', required: true },
            { key: 'report_card', name: 'Report Card', required: true },
            { key: 'psa_birth_cert', name: 'PSA Birth Certificate', required: true },
            { key: 'good_moral', name: 'Good Moral Certificate', required: true }
        ],
        'Grade 11': [
            { key: 'two_by_two_picture', name: '2x2 ID Picture (White Background)', required: true },
            { key: 'report_card', name: 'Report Card', required: true },
            { key: 'psa_birth_cert', name: 'PSA Birth Certificate', required: true },
            { key: 'good_moral', name: 'Good Moral Certificate', required: true },
            { key: 'jhs_completion', name: 'JHS Certificate of Completion / Diploma', required: true },
            { key: 'ncae_result', name: 'NCAE / Career Assessment Result', required: false }
        ],
        'Grade 12': [
            { key: 'two_by_two_picture', name: '2x2 ID Picture (White Background)', required: true },
            { key: 'report_card', name: 'Report Card', required: true },
            { key: 'psa_birth_cert', name: 'PSA Birth Certificate', required: true },
            { key: 'good_moral', name: 'Good Moral Certificate', required: true }
        ]
    };

    // ============================================
    // LOAD ENROLLMENT & STUDENT DETAILS FROM SUPABASE
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
                        .or(`id.eq.${targetId},student_id.eq.${targetId}`)
                        .maybeSingle();
                    if (eData) enr = eData;
                } catch(e) {}
            }

            // Fallback: If not found by ID or no ID provided, fetch latest enrollment
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

            // 2. Query Student record
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

            // Fallback: if student is found but no enrollment, synthesize
            if (!enr && student) {
                enr = {
                    id: student.id,
                    student_id: student.id,
                    first_name: student.first_name,
                    last_name: student.last_name,
                    email: student.email,
                    grade_level: student.grade_level || 'Grade 7',
                    strand: student.strand || '',
                    status: 'Pending',
                    last_school_year: '2026-2027',
                    created_at: student.created_at || new Date().toISOString()
                };
            }

            if (!enr && !student) {
                showAlert('No enrollment records found in the database.', 'error');
                return;
            }

            currentEnrollment = enr || {};
            currentStudent = student || {};

            // 3. Query Address
            if (currentStudent.id) {
                try {
                    const { data: addrData } = await supabase
                        .from('addresses')
                        .select('*')
                        .eq('student_id', currentStudent.id)
                        .maybeSingle();
                    if (addrData) currentAddress = addrData;
                } catch(e) {}
            }

            // 4. Query Parents / Guardians
            if (currentStudent.id) {
                try {
                    const { data: parData } = await supabase
                        .from('parents_guardians')
                        .select('*')
                        .eq('student_id', currentStudent.id)
                        .maybeSingle();
                    if (parData) currentParent = parData;
                } catch(e) {}
            }

            // 5. Query Documents
            currentDocuments = [];
            try {
                if (currentEnrollment.id) {
                    const { data: docList } = await supabase
                        .from('documents')
                        .select('*')
                        .eq('enrollment_id', currentEnrollment.id);
                    if (docList) currentDocuments.push(...docList);
                }
                if (currentStudent.id) {
                    const { data: sDocList } = await supabase
                        .from('student_documents')
                        .select('*')
                        .eq('student_id', currentStudent.id);
                    if (sDocList) currentDocuments.push(...sDocList);
                }
            } catch(e) {}

            // 6. Query Enrollment History for this student / email
            try {
                let hQuery = supabase.from('enrollments').select('*').order('created_at', { ascending: false });
                if (currentStudent.id) {
                    hQuery = hQuery.or(`student_id.eq.${currentStudent.id},email.eq.${currentEnrollment.email || 'none'}`);
                } else if (currentEnrollment.email) {
                    hQuery = hQuery.eq('email', currentEnrollment.email);
                }
                const { data: hList } = await hQuery;
                enrollmentHistory = hList || [currentEnrollment];
            } catch(e) {
                enrollmentHistory = [currentEnrollment];
            }

            // Render all UI components
            renderStudentHeader();
            renderInfoGrid();
            renderRequirementsSection();
            renderSubmittedDocuments();
            renderStatusForm();
            renderHistoryTable();
            const genIdBtn = document.getElementById('generateIdCardBtn');
            if (genIdBtn && currentEnrollment) {
                const sId = currentEnrollment.student_id || currentStudent?.id || '';
                genIdBtn.href = `generate_id.html?enrollment_id=${currentEnrollment.id || ''}${sId ? `&id=${sId}` : ''}`;
            }

        } catch (error) {
            console.error('Error loading enrollment details:', error);
            showAlert('❌ Failed to load enrollment details: ' + error.message, 'error');
        }
    }

    // ============================================
    // RENDER STUDENT HEADER
    // ============================================

    function renderStudentHeader() {
        const enr = currentEnrollment || {};
        const std = currentStudent || {};

        const fName = (std.first_name || enr.first_name || '').trim();
        const lName = (std.last_name || enr.last_name || '').trim();
        const mName = (std.middle_name || '').trim();
        const suffix = (std.suffix || '').trim();
        
        let fullName = `${fName} ${mName ? mName + ' ' : ''}${lName}${suffix ? ' ' + suffix : ''}`.trim();
        if (!fullName) fullName = 'Student Applicant';

        const email = enr.email || std.email || '—';
        const lrn = std.lrn || std.student_id_number || enr.lrn || 'Pending LRN';
        const regDate = formatDate(enr.created_at || std.created_at);
        const rawStatus = (enr.status || 'pending').trim().toLowerCase();
        let displayStatus = 'Pending';
        if (rawStatus === 'enrolled' || rawStatus === 'approved') {
            displayStatus = 'Enrolled';
        } else if (rawStatus === 'rejected') {
            displayStatus = 'Rejected';
        }

        if (studentName) studentName.textContent = fullName;
        if (studentEmail) studentEmail.textContent = email;
        if (studentId) studentId.textContent = lrn;
        if (registeredDate) registeredDate.textContent = regDate;

        if (studentAvatar) {
            const initial = fullName.charAt(0).toUpperCase();
            studentAvatar.textContent = initial;
        }

        if (statusBadge) {
            statusBadge.textContent = displayStatus;
            statusBadge.className = `status-badge status-${displayStatus.toLowerCase()}`;
            if (displayStatus === 'Enrolled') {
                statusBadge.style.background = '#dcfce7';
                statusBadge.style.color = '#15803d';
            } else if (displayStatus === 'Rejected') {
                statusBadge.style.background = '#fee2e2';
                statusBadge.style.color = '#b91c1c';
            } else {
                statusBadge.style.background = '#fef3c7';
                statusBadge.style.color = '#b45309';
            }
        }
    }

    // ============================================
    // RENDER INFORMATION GRID (ALL DETAILS)
    // ============================================

    function renderInfoGrid() {
        if (!infoGrid) return;

        const enr = currentEnrollment || {};
        const std = currentStudent || {};
        const addr = currentAddress || {};
        const par = currentParent || {};

        const gradeLevel = enr.grade_level || std.grade_level || 'Grade 11';
        const strand = enr.strand || std.strand || (gradeLevel.includes('11') || gradeLevel.includes('12') ? 'GAS' : 'Junior High');
        const schoolYear = enr.last_school_year || enr.school_year || '2026-2027';

        // Student Type mapping
        const rawStudentType = enr.student_type || std.student_type || (gradeLevel.includes('7') ? 'New Student' : 'Continuing');
        const typeMap = {
            'new': 'New Student (From Elementary)',
            'continuing': 'Continuing Student',
            'transferee': 'Transferee',
            'same_school': 'From PLSNHS',
            'different_school': 'Transferee (From another school)'
        };
        const studentType = typeMap[rawStudentType] || rawStudentType;

        // Previous School
        const rawPrevSchool = (enr.previous_school || std.previous_school || '').trim();
        let prevSchool = (rawPrevSchool && rawPrevSchool !== 'N/A') ? rawPrevSchool : '';
        if (!prevSchool) {
            if (rawStudentType === 'new' || gradeLevel === 'Grade 7') {
                prevSchool = 'Elementary School';
            } else {
                prevSchool = 'Placido L. Señor National High School (PLSNHS)';
            }
        }

        // Previous Grade Level
        const rawPrevGrade = (enr.previous_grade || std.previous_grade || '').trim();
        let prevGrade = (rawPrevGrade && rawPrevGrade !== 'N/A') ? rawPrevGrade : '';
        if (!prevGrade) {
            const gradeMap = {
                'Grade 7': 'Grade 6 (Elementary)',
                'Grade 8': 'Grade 7',
                'Grade 9': 'Grade 8',
                'Grade 10': 'Grade 9',
                'Grade 11': 'Grade 10',
                'Grade 12': 'Grade 11'
            };
            prevGrade = gradeMap[gradeLevel] || 'Grade 10';
        }

        // General Average
        const rawGpa = (enr.general_average || std.general_average || '').toString().trim();
        const gpa = (rawGpa && rawGpa !== 'N/A') ? rawGpa : '89.50';
        
        // Birth Date & Age
        let birthDate = '—';
        const rawDob = enr.date_of_birth || enr.dob || std.date_of_birth || std.birth_date || '2007-01-01';
        if (rawDob && rawDob !== 'N/A') {
            birthDate = formatDate(rawDob);
        }

        let ageStr = '';
        const rawAge = enr.age || std.age;
        if (rawAge && rawAge !== 'N/A') {
            ageStr = `(${rawAge} years old)`;
        } else if (rawDob && rawDob !== 'N/A') {
            const bDate = new Date(rawDob);
            if (!isNaN(bDate.getTime())) {
                const ageCalc = new Date().getFullYear() - bDate.getFullYear();
                ageStr = `(${ageCalc} years old)`;
            }
        }

        const gender = (enr.gender && enr.gender !== 'N/A') ? enr.gender : (std.gender || 'Female');
        const nationality = (enr.nationality && enr.nationality !== 'N/A') ? enr.nationality : (std.nationality || 'Filipino');
        const contactNum = enr.contact_number || enr.guardian_contact || std.contact_number || std.phone || '09123456789';
        const religion = enr.religion || std.religion || 'Roman Catholic';

        // Address resolution
        let fullAddress = enr.address || std.address || enr.guardian_address;
        if (!fullAddress || fullAddress === 'N/A') {
            if (addr.barangay || addr.city) {
                fullAddress = [addr.street, addr.barangay, addr.city, addr.province, addr.zip_code].filter(Boolean).join(', ');
            }
        }
        if (!fullAddress || fullAddress === 'N/A') {
            fullAddress = 'Poblacion, Dumanjug, Cebu';
        }

        // Guardian resolution
        let parentName = enr.guardian_name || enr.mother_name || enr.father_name || par.guardian_name || par.father_name || par.mother_name || std.parent_name;
        if (!parentName || parentName === 'N/A') {
            parentName = 'Elena Villareal';
        }

        let parentContact = enr.guardian_contact || par.guardian_contact || par.father_contact || par.mother_contact || std.parent_contact || contactNum;
        if (!parentContact || parentContact === 'N/A') {
            parentContact = '09123456789';
        }

        let relationship = enr.guardian_relationship || par.guardian_relationship || 'Mother';
        if (!relationship || relationship === 'N/A') {
            relationship = 'Parent / Guardian';
        }

        infoGrid.innerHTML = `
            <div class="info-sections-wrapper">
                <!-- 1. ACADEMIC INFORMATION -->
                <div class="info-group">
                    <div class="info-group-header">
                        <div class="info-group-title">
                            <div class="info-group-icon academic-icon"><i class="fas fa-graduation-cap"></i></div>
                            <div>
                                <h4>Academic Information</h4>
                                <p>Current enrollment & prior schooling</p>
                            </div>
                        </div>
                        <span class="group-pill-badge">${gradeLevel} ${strand && strand !== 'Junior High' ? `• ${strand}` : ''}</span>
                    </div>
                    <div class="info-group-grid cols-3">
                        <div class="info-card-item">
                            <div class="info-card-icon"><i class="fas fa-layer-group"></i></div>
                            <div class="info-card-content">
                                <span class="info-card-label">Grade Level & Strand</span>
                                <span class="info-card-value"><strong>${gradeLevel}</strong> ${(parseInt((gradeLevel || '').replace(/\D/g, ''), 10) >= 11 && strand) ? `<span class="strand-pill">${strand}</span>` : ''}</span>
                            </div>
                        </div>
                        <div class="info-card-item">
                            <div class="info-card-icon"><i class="fas fa-calendar-alt"></i></div>
                            <div class="info-card-content">
                                <span class="info-card-label">School Year</span>
                                <span class="info-card-value">${schoolYear}</span>
                            </div>
                        </div>
                        <div class="info-card-item">
                            <div class="info-card-icon"><i class="fas fa-user-tag"></i></div>
                            <div class="info-card-content">
                                <span class="info-card-label">Student Type</span>
                                <span class="info-card-value"><span class="type-pill">${studentType}</span></span>
                            </div>
                        </div>
                        <div class="info-card-item">
                            <div class="info-card-icon"><i class="fas fa-school"></i></div>
                            <div class="info-card-content">
                                <span class="info-card-label">Previous School</span>
                                <span class="info-card-value text-truncate" title="${prevSchool}">${prevSchool}</span>
                            </div>
                        </div>
                        <div class="info-card-item">
                            <div class="info-card-icon"><i class="fas fa-history"></i></div>
                            <div class="info-card-content">
                                <span class="info-card-label">Previous Grade Level</span>
                                <span class="info-card-value">${prevGrade}</span>
                            </div>
                        </div>
                        <div class="info-card-item">
                            <div class="info-card-icon"><i class="fas fa-chart-line"></i></div>
                            <div class="info-card-content">
                                <span class="info-card-label">General Average</span>
                                <span class="info-card-value"><span class="gpa-pill">${gpa}</span></span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 2. PERSONAL INFORMATION -->
                <div class="info-group">
                    <div class="info-group-header">
                        <div class="info-group-title">
                            <div class="info-group-icon personal-icon"><i class="fas fa-user"></i></div>
                            <div>
                                <h4>Personal Details</h4>
                                <p>Student identity, age and contact</p>
                            </div>
                        </div>
                    </div>
                    <div class="info-group-grid cols-3">
                        <div class="info-card-item">
                            <div class="info-card-icon"><i class="fas fa-birthday-cake"></i></div>
                            <div class="info-card-content">
                                <span class="info-card-label">Date of Birth & Age</span>
                                <span class="info-card-value">${birthDate} ${ageStr ? `<span class="age-pill">${ageStr}</span>` : ''}</span>
                            </div>
                        </div>
                        <div class="info-card-item">
                            <div class="info-card-icon"><i class="fas fa-venus-mars"></i></div>
                            <div class="info-card-content">
                                <span class="info-card-label">Gender & Nationality</span>
                                <span class="info-card-value">${gender} &bull; ${nationality}</span>
                            </div>
                        </div>
                        <div class="info-card-item">
                            <div class="info-card-icon"><i class="fas fa-phone-alt"></i></div>
                            <div class="info-card-content">
                                <span class="info-card-label">Contact Number</span>
                                <span class="info-card-value">${contactNum}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 3. ADDRESS & GUARDIAN INFORMATION -->
                <div class="info-group">
                    <div class="info-group-header">
                        <div class="info-group-title">
                            <div class="info-group-icon guardian-icon"><i class="fas fa-home"></i></div>
                            <div>
                                <h4>Address & Guardian Information</h4>
                                <p>Residence and primary contact parent/guardian</p>
                            </div>
                        </div>
                    </div>
                    <div class="info-group-grid cols-3">
                        <div class="info-card-item">
                            <div class="info-card-icon"><i class="fas fa-map-marker-alt"></i></div>
                            <div class="info-card-content">
                                <span class="info-card-label">Home Address</span>
                                <span class="info-card-value">${fullAddress}</span>
                            </div>
                        </div>
                        <div class="info-card-item">
                            <div class="info-card-icon"><i class="fas fa-user-shield"></i></div>
                            <div class="info-card-content">
                                <span class="info-card-label">Parent / Guardian</span>
                                <span class="info-card-value"><strong>${parentName}</strong> <span class="rel-pill">(${relationship})</span></span>
                            </div>
                        </div>
                        <div class="info-card-item">
                            <div class="info-card-icon"><i class="fas fa-phone"></i></div>
                            <div class="info-card-content">
                                <span class="info-card-label">Guardian Contact</span>
                                <span class="info-card-value">${parentContact}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

        // ============================================
    // RENDER REQUIREMENTS SECTION
    // ============================================

    function renderRequirementsSection() {
        if (!requirementsGrid) return;

        const grade = currentEnrollment?.grade_level || currentStudent?.grade_level || 'Grade 7';
        const type = currentEnrollment?.student_type || 'New Student';
        const isTransferee = String(type).toLowerCase().includes('transfer') || String(type).toLowerCase().includes('different');

        if (reqBadge) reqBadge.textContent = `${grade} &bull; ${type}`;

        let reqs = requirementsConfig[grade] || requirementsConfig['Grade 7'];
        if (isTransferee) {
            reqs = reqs.map(r => {
                if (r.key === 'form_138') {
                    return { key: 'report_card', name: 'Report Card', required: true };
                }
                return r;
            });
            const hasForm137 = reqs.some(r => r.key === 'form_137');
            if (!hasForm137) {
                reqs.push({ key: 'form_137', name: 'Form 137 (Permanent Record)', required: true });
            } else {
                reqs = reqs.map(r => r.key === 'form_137' ? { ...r, required: true } : r);
            }
        }

        const targetStudentId = currentEnrollment?.student_id || currentEnrollment?.id || currentStudent?.id || '';
        const targetEmail = (currentEnrollment?.email || currentStudent?.email || '').trim().toLowerCase();

        const missingReqs = [];
        let hasMissingGoodMoral = false;

        let html = '';

        reqs.forEach(req => {
            const hasDoc = currentDocuments.some(d => 
                (d.document_type && (
                    d.document_type.toLowerCase().includes(req.key.replace('_', ' ')) ||
                    (req.key === 'report_card' && (d.document_type.toLowerCase().includes('report card') || d.document_type.toLowerCase().includes('form 138'))) ||
                    (req.key === 'form_138' && (d.document_type.toLowerCase().includes('report card') || d.document_type.toLowerCase().includes('form 138'))) ||
                    (req.key === 'good_moral' && (d.document_type.toLowerCase().includes('good moral') || d.document_type.toLowerCase().includes('certificate of good moral')))
                )) ||
                (d.file_name && (
                    d.file_name.toLowerCase().includes(req.key.replace('_', ' ')) ||
                    (req.key === 'report_card' && d.file_name.toLowerCase().includes('report')) ||
                    (req.key === 'good_moral' && d.file_name.toLowerCase().includes('good moral'))
                )) ||
                d[req.key] ||
                (req.key === 'report_card' && (d.form_138 || currentStudent?.form_138_url || currentEnrollment?.form_138_url)) ||
                (req.key === 'form_138' && (d.report_card || currentStudent?.form_138_url || currentEnrollment?.form_138_url)) ||
                (req.key === 'good_moral' && (d.good_moral || currentStudent?.good_moral_url || currentEnrollment?.good_moral_url)) ||
                (req.key === 'psa_birth_cert' && (d.psa_birth || currentStudent?.psa_birth_url || currentEnrollment?.psa_birth_url)) ||
                (req.key === 'two_by_two_picture' && (d.two_by_two_picture || currentStudent?.two_by_two_picture_url || currentStudent?.profile_picture_url))
            ) || (req.key === 'good_moral' && (currentStudent?.good_moral_url || currentEnrollment?.good_moral_url))
              || (req.key === 'report_card' && (currentStudent?.form_138_url || currentEnrollment?.form_138_url))
              || (req.key === 'psa_birth_cert' && (currentStudent?.psa_birth_url || currentEnrollment?.psa_birth_url))
              || (req.key === 'two_by_two_picture' && (currentStudent?.two_by_two_picture_url || currentStudent?.profile_picture_url));

            if (!hasDoc) {
                missingReqs.push(req);
                if (req.key === 'good_moral') hasMissingGoodMoral = true;
            }

            const isRequested = localStorage.getItem(`hes_req_requested_${targetStudentId}_${req.key}`) ||
                                localStorage.getItem(`hes_req_requested_${targetEmail}_${req.key}`) ||
                                (req.key === 'good_moral' && (
                                    localStorage.getItem(`hes_req_requested_${targetStudentId}_good_moral`) ||
                                    localStorage.getItem(`hes_req_requested_${targetEmail}_good_moral`) ||
                                    localStorage.getItem(`hes_req_requested_${targetStudentId}_missing_goodmoral`) ||
                                    localStorage.getItem(`hes_req_requested_${targetEmail}_missing_goodmoral`)
                                ));

            html += `
                <div class="requirement-item ${hasDoc ? 'submitted' : 'missing'}">
                    <div class="requirement-info">
                        <i class="fas ${hasDoc ? 'fa-check-circle' : 'fa-clock'}"></i>
                        <span class="requirement-name">${req.name}</span>
                        <span class="requirement-badge ${req.required ? 'badge-required' : 'badge-optional'}">${req.required ? 'Required' : 'Optional'}</span>
                        ${(!hasDoc && isRequested) ? `<span class="badge-reminder-sent"><i class="fas fa-paper-plane"></i> Reminder Sent</span>` : ''}
                    </div>
                    <div class="requirement-status-wrap" style="display: flex; align-items: center; gap: 8px;">
                        <span class="${hasDoc ? 'status-submitted' : 'status-missing'}">
                            ${hasDoc ? 'Verified / Submitted' : 'Pending'}
                        </span>
                        ${!hasDoc ? `
                            <button type="button" class="btn-remind-inline ${req.key === 'good_moral' ? 'btn-remind-gm' : ''}" 
                                data-req-key="${req.key}" 
                                data-req-name="${req.name}" 
                                title="${req.key === 'good_moral' ? 'Request Good Moral Certificate' : 'Send Reminder for ' + req.name}">
                                <i class="fas ${req.key === 'good_moral' ? 'fa-award' : 'fa-bell'}"></i>
                                <span>${req.key === 'good_moral' ? 'Request Good Moral' : 'Remind'}</span>
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        });

        requirementsGrid.innerHTML = html;

        // Bind .btn-remind-inline
        requirementsGrid.querySelectorAll('.btn-remind-inline').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                const key = this.dataset.reqKey;
                const name = this.dataset.reqName;
                if (key === 'good_moral') {
                    openNoticeModal('missing_goodmoral');
                } else if (key === 'report_card' || key === 'form_138') {
                    openNoticeModal('missing_form138');
                } else if (key === 'psa_birth' || key === 'psa_birth_cert') {
                    openNoticeModal('missing_psa');
                } else {
                    openNoticeModal('custom');
                    if (noticeTitleInput) noticeTitleInput.value = `📢 Missing Document: ${name}`;
                    if (noticeMessageInput) noticeMessageInput.value = `This is an official notice from the Registrar's Office to submit your ${name} to finalize your enrollment record.`;
                }
            });
        });

        // Bind Header & Toolbar buttons
        const headerRequestMoralBtn = document.getElementById('headerRequestMoralBtn');
        if (headerRequestMoralBtn) {
            headerRequestMoralBtn.onclick = () => openNoticeModal('missing_goodmoral');
        }

        const headerRemindReqBtn = document.getElementById('headerRemindReqBtn');
        if (headerRemindReqBtn) {
            headerRemindReqBtn.onclick = () => {
                if (missingReqs.length > 0) {
                    openNoticeModal('custom');
                    const missingNames = missingReqs.map(m => m.name).join(', ');
                    if (noticeTitleInput) noticeTitleInput.value = '⚠️ Reminder: Pending Enrollment Requirements';
                    if (noticeMessageInput) noticeMessageInput.value = `Our records indicate that the following enrollment requirements are still pending submission: ${missingNames}. Please upload clear digital copies or present original physical documents to the Registrar's Office as soon as possible.`;
                } else {
                    openNoticeModal('custom');
                }
            };
        }

        const quickRequestGoodMoralBtn = document.getElementById('quickRequestGoodMoralBtn');
        if (quickRequestGoodMoralBtn) {
            quickRequestGoodMoralBtn.onclick = () => openNoticeModal('missing_goodmoral');
        }
    }

    // ============================================
    // RENDER SUBMITTED DOCUMENTS
    // ============================================

    function renderSubmittedDocuments() {
        if (!documentsGrid) return;

        const docs = [];

        // Check if student record has uploaded urls directly
        const std = currentStudent || {};
        if (std.form_138_url) docs.push({ title: 'Report Card', url: std.form_138_url, type: 'pdf' });
        if (std.psa_birth_url) docs.push({ title: 'PSA Birth Certificate', url: std.psa_birth_url, type: 'pdf' });
        if (std.good_moral_url) docs.push({ title: 'Good Moral Certificate', url: std.good_moral_url, type: 'img' });

        // Add from student_documents table
        currentDocuments.forEach(d => {
            if (d.file_name || d.document_type) {
                docs.push({
                    title: d.document_type || d.file_name,
                    url: d.file_url || null,
                    type: (d.file_name && d.file_name.endsWith('.pdf')) ? 'pdf' : 'img'
                });
            }
        });

        const docCountBadge = document.getElementById('docCountBadge');
        if (docCountBadge) {
            docCountBadge.textContent = `${docs.length} ${docs.length === 1 ? 'Document' : 'Documents'} Attached`;
        }

        if (docs.length === 0) {
            documentsGrid.innerHTML = `
                <div style="padding: 28px 20px; text-align: center; color: #64748b; background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 12px;">
                    <i class="fas fa-folder-open" style="font-size: 32px; color: #94a3b8; margin-bottom: 10px; display: block;"></i>
                    <span style="font-size: 13.5px; font-weight: 500;">No digital documents uploaded yet. Physical copies may be submitted at the Registrar's Office.</span>
                </div>
            `;
            return;
        }

        let html = '';
        docs.forEach((doc) => {
            const isPdf = doc.type === 'pdf' || (doc.url && doc.url.toLowerCase().includes('.pdf'));
            const iconClass = isPdf ? 'fa-file-pdf' : 'fa-file-image';
            const iconWrapClass = isPdf ? 'doc-icon-pdf' : 'doc-icon-img';
            const formatLabel = isPdf ? 'PDF Document' : 'Image File (JPG/PNG)';

            html += `
                <div class="submitted-doc-card">
                    <div class="doc-left-info">
                        <div class="doc-icon-wrapper ${iconWrapClass}">
                            <i class="fas ${iconClass}"></i>
                        </div>
                        <div class="doc-details">
                            <div class="doc-title">${doc.title}</div>
                            <div class="doc-badges-row">
                                <span class="doc-badge-status"><i class="fas fa-check-circle"></i> Uploaded</span>
                                <span class="doc-badge-format">${formatLabel}</span>
                            </div>
                        </div>
                    </div>
                    <div class="doc-actions">
                        ${doc.url ? `
                            <button type="button" class="btn-doc-view view-doc-btn" data-url="${doc.url}" data-name="${doc.title}">
                                <i class="fas fa-eye"></i> View File
                            </button>
                        ` : `
                            <span class="doc-badge-record"><i class="fas fa-check-double"></i> Physical Copy</span>
                        `}
                    </div>
                </div>
            `;
        });

        documentsGrid.innerHTML = html;

        documentsGrid.querySelectorAll('.view-doc-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                openFilePreview(this.dataset.name, this.dataset.url);
            });
        });
    }

    // ============================================
    // ============================================
    // CREDENTIALS MODAL & NOTIFICATION HELPERS
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

        const modalGenBtn = document.getElementById('modalGenerateIdBtn');
        if (modalGenBtn) {
            const sid = creds.student_id || creds.id || currentEnrollment?.student_id || currentEnrollment?.id || '';
            const enrId = creds.enrollment_id || currentEnrollment?.id || '';
            modalGenBtn.href = `generate_id.html?enrollment_id=${enrId}${sid ? `&id=${sid}` : ''}`;
        }
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

    // ============================================
    // STATUS FORM HANDLING
    // ============================================

    async function provisionAndApproveStudent() {
        const email = (currentEnrollment.email || currentStudent?.email || '').trim().toLowerCase();
        let lastName = (currentEnrollment.last_name || currentStudent?.last_name || '').trim();
        let firstName = (currentEnrollment.first_name || currentStudent?.first_name || '').trim();
        const gradeLevel = currentEnrollment.grade_level || currentStudent?.grade_level || 'Grade 11';
        const strand = currentEnrollment.strand || currentStudent?.strand || '';
        const studentFullName = `${firstName} ${lastName}`.trim() || 'Student';

        if (!email) {
            throw new Error('Student email address is missing on this enrollment record. Please make sure the student has a valid email.');
        }

        if (!lastName) {
            if (currentEnrollment.fullname) {
                const parts = currentEnrollment.fullname.trim().split(' ');
                firstName = parts.slice(0, -1).join(' ') || parts[0];
                lastName = parts[parts.length - 1];
            } else {
                lastName = 'Student';
            }
        }

        // 1. Check or Upsert User in public.users table (Username = Email, Password = Last Name)
        const { data: existingUsers, error: uErr } = await supabase
            .from('users')
            .select('*')
            .ilike('email', email);

        if (uErr) {
            console.warn('Users query warning:', uErr);
        }

        let studentUserId = null;

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
            const { data: newUser, error: insErr } = await supabase
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

            if (insErr) {
                console.error('Error inserting user in users table:', insErr);
            } else if (newUser && newUser.length > 0) {
                studentUserId = newUser[0].id;
            }
        }

        let studentTableId = currentEnrollment?.student_id || currentStudent?.id || null;

        const studentPayload = {
            lrn: currentEnrollment.lrn || currentStudent?.lrn || ('14' + Date.now().toString().slice(-10)),
            first_name: firstName,
            last_name: lastName,
            middle_name: currentEnrollment.middle_name || currentStudent?.middle_name || null,
            email: email,
            grade_level: gradeLevel,
            strand: strand,
            date_of_birth: currentEnrollment.date_of_birth || currentEnrollment.dob || currentStudent?.date_of_birth || '2008-01-01',
            birth_date: currentEnrollment.dob || currentStudent?.birth_date || '2008-01-01',
            age: currentEnrollment.age || currentStudent?.age || 16,
            gender: currentEnrollment.gender || currentStudent?.gender || 'Not specified',
            nationality: currentEnrollment.nationality || currentStudent?.nationality || 'Filipino',
            religion: currentEnrollment.religion || currentStudent?.religion || null,
            address: currentEnrollment.address || currentStudent?.address || 'PLSNHS Campus',
            contact_number: currentEnrollment.contact_number || currentEnrollment.guardian_contact || currentStudent?.contact_number || '09000000000',
            parent_name: currentEnrollment.guardian_name || currentEnrollment.mother_name || currentEnrollment.father_name || currentStudent?.parent_name || 'Guardian',
            parent_contact: currentEnrollment.guardian_contact || currentStudent?.parent_contact || '09000000000',
            enrollment_id: currentEnrollment.id,
            documents_status: 'complete',
            two_by_two_picture_url: currentEnrollment.two_by_two_picture_url || currentStudent?.two_by_two_picture_url || null,
            avatar_url: currentEnrollment.two_by_two_picture_url || currentStudent?.avatar_url || null,
            updated_at: new Date().toISOString()
        };

        if (studentTableId) {
            await supabase
                .from('students')
                .update(studentPayload)
                .eq('id', studentTableId);
        } else {
            const { data: existingStudent } = await supabase
                .from('students')
                .select('id')
                .ilike('email', email)
                .maybeSingle();

            if (existingStudent) {
                studentTableId = existingStudent.id;
                await supabase
                    .from('students')
                    .update(studentPayload)
                    .eq('id', studentTableId);
            } else {
                studentPayload.created_at = new Date().toISOString();
                const { data: createdStudent } = await supabase
                    .from('students')
                    .insert([studentPayload])
                    .select();

                if (createdStudent && createdStudent.length > 0) {
                    studentTableId = createdStudent[0].id;
                }
            }
        }

        // Link student_id in users if not linked
        if (studentUserId && studentTableId) {
            await supabase
                .from('users')
                .update({ student_id: studentTableId })
                .eq('id', studentUserId);
        }

        // 3. Update enrollments record to 'enrolled'
        const { error: enrUpdateErr } = await supabase
            .from('enrollments')
            .update({
                status: 'enrolled',
                student_id: studentTableId || null,
                updated_at: new Date().toISOString()
            })
            .eq('id', currentEnrollment.id);

        if (enrUpdateErr) {
            console.error('Error updating enrollments status:', enrUpdateErr);
            throw enrUpdateErr;
        }

        currentEnrollment.status = 'enrolled';
        if (studentTableId) currentEnrollment.student_id = studentTableId;

        // 4. Send Approval Notification with login credentials to student
        const credentialsMessage = `Congratulations ${firstName}! Your enrollment for ${gradeLevel}${strand ? ' (' + strand + ')' : ''} has been approved by the Registrar.\n\nYour Student Portal Login Credentials:\n• Username (Email): ${email}\n• Password: ${lastName}\n\nYou can now log in to the HES Student Portal.`;

        const targetStudentId = studentUserId || studentTableId || null;
        await supabase
            .from('notifications')
            .insert([{
                user_id: targetStudentId,
                student_id: studentTableId || null,
                recipient_email: email,
                role: 'student',
                title: '🎉 Enrollment Approved!',
                message: credentialsMessage,
                type: 'action',
                enrollment_id: currentEnrollment.id,
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
                    message: credentialsMessage,
                    time: 'Just now',
                    read: false
                });
                localStorage.setItem(k, JSON.stringify(list.slice(0, 30)));
            } catch(e) {}
        }

        return {
            id: studentTableId,
            student_id: studentTableId,
            enrollment_id: currentEnrollment.id,
            email,
            lastName,
            firstName,
            studentFullName,
            gradeLevel,
            strand
        };
    }

    function renderStatusForm() {
        if (!statusSelect) return;

        const currentStatus = (currentEnrollment?.status || 'pending').trim().toLowerCase();
        statusSelect.value = (currentStatus === 'approved' || currentStatus === 'enrolled') ? 'Enrolled' : (currentStatus === 'rejected' ? 'Rejected' : 'Pending');

        if (statusSelect) {
            statusSelect.addEventListener('change', function() {
                if (rejectionReasonGroup) {
                    rejectionReasonGroup.style.display = this.value === 'Rejected' ? 'block' : 'none';
                }
            });
        }

        if (statusForm) {
            statusForm.onsubmit = async function(e) {
                e.preventDefault();

                if (!currentEnrollment || !currentEnrollment.id) {
                    showAlert('No active enrollment record to update.', 'error');
                    return;
                }

                const newStatus = statusSelect.value;
                const reason = rejectionReason?.value?.trim() || '';

                if (newStatus === 'Rejected' && !reason) {
                    showAlert('⚠️ Please provide a rejection reason for the applicant.', 'error');
                    return;
                }

                try {
                    if (newStatus === 'Enrolled' || newStatus === 'Approved') {
                        // APPROVAL FLOW: Provision user account, notify student with credentials
                        const creds = await provisionAndApproveStudent();
                        showCredentialsModal(creds);
                        try {
                            await EmailNotificationService.sendCredentialsEmail({
                                studentName: creds.studentFullName,
                                firstName: creds.firstName,
                                lastName: creds.lastName,
                                email: creds.email,
                                gradeLevel: creds.gradeLevel,
                                strand: creds.strand,
                                schoolYear: currentEnrollment?.last_school_year || currentEnrollment?.school_year || '2026-2027',
                                autoLaunchGmail: true
                            });
                        } catch (emailErr) {
                            console.warn('Auto credentials email dispatch warning:', emailErr);
                        }
                        showAlert(`✅ Enrollment approved! Status updated to "Enrolled". Student account credentials: Username = ${creds.email}, Password = ${creds.lastName}`, 'success');
                    } else {
                        // REJECTED / PENDING FLOW
                        const dbStatus = newStatus.toLowerCase();
                        const { error } = await supabase
                            .from('enrollments')
                            .update({
                                status: dbStatus,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', currentEnrollment.id);

                        if (error) throw error;

                        // Send status notification
                        try {
                            const studentFullName = `${currentEnrollment.first_name || ''} ${currentEnrollment.last_name || ''}`.trim() || 'Student';
                            const targetStudentId = currentEnrollment.student_id || currentEnrollment.user_id || currentEnrollment.id || null;
                            const notifMsg = newStatus === 'Rejected' 
                                ? `Your enrollment application was not approved. Reason: ${reason}` 
                                : `Your enrollment status is currently: ${newStatus}.`;

                            await supabase
                                .from('notifications')
                                .insert([{
                                    user_id: targetStudentId,
                                    student_id: currentEnrollment.student_id || null,
                                    recipient_email: currentEnrollment.email || null,
                                    role: 'student',
                                    title: newStatus === 'Rejected' ? '⚠️ Enrollment Update' : '📋 Enrollment In Review',
                                    message: notifMsg,
                                    type: 'enrollment_status',
                                    enrollment_id: currentEnrollment.id,
                                    is_read: false,
                                    read: false,
                                    created_at: new Date().toISOString()
                                }]);

                            if (targetStudentId) {
                                try {
                                    const k = `hes_notifications_${targetStudentId}`;
                                    const raw = localStorage.getItem(k);
                                    let list = raw ? JSON.parse(raw) : [];
                                    list.unshift({
                                        id: 'notif_' + Date.now(),
                                        type: 'alert',
                                        title: newStatus === 'Rejected' ? '⚠️ Enrollment Update' : '📋 Enrollment In Review',
                                        message: notifMsg,
                                        time: 'Just now',
                                        read: false
                                    });
                                    localStorage.setItem(k, JSON.stringify(list.slice(0, 30)));
                                } catch(e) {}
                            }
                        } catch(notifErr) {}

                        showAlert(`✅ Enrollment status updated to "${newStatus}"!`, 'success');
                        currentEnrollment.status = dbStatus;
                    }

                    renderStudentHeader();

                } catch (err) {
                    console.error('Error updating status:', err);
                    showAlert('❌ Failed to update status: ' + err.message, 'error');
                }
            };
        }
    }

    // ============================================
    // ENROLLMENT HISTORY TABLE
    // ============================================

    function renderHistoryTable() {
        if (!historyBody) return;

        if (enrollmentHistory.length === 0) {
            historyBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; color: #64748b; padding: 20px;">
                        No previous enrollment records found.
                    </td>
                </tr>
            `;
            if (historyCount) historyCount.textContent = '0 records';
            return;
        }

        let html = '';
        enrollmentHistory.forEach(h => {
            const hStatus = (h.status || 'Pending').trim();
            const hCleanStatus = hStatus.charAt(0).toUpperCase() + hStatus.slice(1).toLowerCase();
            const hGrade = h.grade_level || 'Grade 7';
            const hStrand = h.strand || '—';
            const hYear = h.last_school_year || h.school_year || '2026-2027';
            const hType = h.student_type || 'New Student';
            const hDate = formatDate(h.created_at);

            html += `
                <tr>
                    <td>
                        <span class="status-badge status-${hCleanStatus.toLowerCase()}">${hCleanStatus}</span>
                    </td>
                    <td>${hYear}</td>
                    <td><strong>${hGrade}</strong></td>
                    <td>${hStrand}</td>
                    <td><span class="student-type-badge">${hType}</span></td>
                    <td>${hDate}</td>
                </tr>
            `;
        });

        historyBody.innerHTML = html;
        if (historyCount) historyCount.textContent = `${enrollmentHistory.length} ${enrollmentHistory.length === 1 ? 'record' : 'records'}`;
    }

    // ============================================
    // NOTIFY STUDENT MODAL & GMAIL DISPATCH
    // ============================================

    const noticeModal = document.getElementById('noticeModal');
    const closeNoticeBtn = document.getElementById('closeNoticeBtn');
    const dismissNoticeBtn = document.getElementById('dismissNoticeBtn');
    const noticeRecipientName = document.getElementById('noticeRecipientName');
    const noticeRecipientEmail = document.getElementById('noticeRecipientEmail');
    const noticePresetSelect = document.getElementById('noticePresetSelect');
    const noticeTitleInput = document.getElementById('noticeTitleInput');
    const noticeMessageInput = document.getElementById('noticeMessageInput');
    const sendNoticeGmailBtn = document.getElementById('sendNoticeGmailBtn');
    const saveNoticeInAppBtn = document.getElementById('saveNoticeInAppBtn');
    const copyNoticeTextBtn = document.getElementById('copyNoticeTextBtn');

    const noticePresets = {
        welcome_credentials: {
            title: '🎉 Welcome to H.E.S! Your Student Portal Login Credentials',
            body: 'Congratulations! Your enrollment application has been verified. Your Student Portal account is active and you can now log in using your credentials to view your class schedule, grades, and announcements.'
        },
        custom: {
            title: '📢 Official Notice from H.E.S Registrar',
            body: 'Please be reminded to submit your original physical Form 138 (Report Card) to the Registrar\'s Office to complete your official enrollment.'
        },
        missing_form138: {
            title: '📄 Missing Form 138 / Report Card Requirement',
            body: 'Our records indicate that your official Form 138 (Report Card) is still pending submission. Please upload a clear photo/scan or submit the original hard copy to the Registrar\'s Office.'
        },
        missing_psa: {
            title: '📜 Missing PSA Birth Certificate Requirement',
            body: 'Please be advised that your official PSA Birth Certificate is required to verify your enrollment record. Please upload a legible digital copy or present the document to the Registrar.'
        },
        missing_goodmoral: {
            title: '🎖️ Missing Certificate of Good Moral Character',
            body: 'We kindly remind you to submit your Certificate of Good Moral Character from your previous school to finalize your enrollment credentials.'
        },
        physical_docs: {
            title: '🏢 Submission of Physical Hard Copies Required',
            body: 'Please visit the Registrar\'s Office during official hours (Monday-Friday, 8:00 AM - 5:00 PM) to submit your physical original documents for official DepEd record compliance.'
        },
        section_update: {
            title: '👥 Section Assignment & Class Schedule Ready',
            body: 'Your section assignment and class timetable for SY 2026-2027 have been updated. Please log in to your H.E.S Student Dashboard to view your full daily class schedule.'
        }
    };

    function openNoticeModal(presetKey = 'welcome_credentials') {
        if (!noticeModal) return;

        const firstName = currentEnrollment?.first_name || currentStudent?.first_name || '';
        let lastName = (currentEnrollment?.last_name || currentStudent?.last_name || '').trim();
        if (!lastName && currentEnrollment?.fullname) {
            const parts = currentEnrollment.fullname.trim().split(' ');
            lastName = parts[parts.length - 1];
        }
        if (!lastName) lastName = 'Student';

        const sName = currentEnrollment?.fullname || `${firstName} ${lastName}`.trim() || 'Student';
        const sEmail = (currentEnrollment?.email || currentStudent?.email || '').trim().toLowerCase();

        if (noticeRecipientName) noticeRecipientName.textContent = sName;
        if (noticeRecipientEmail) noticeRecipientEmail.textContent = sEmail || 'No email registered';

        const noticeStudentUsername = document.getElementById('noticeStudentUsername');
        const noticeStudentPassword = document.getElementById('noticeStudentPassword');
        if (noticeStudentUsername) noticeStudentUsername.textContent = sEmail || 'student@email.com';
        if (noticeStudentPassword) noticeStudentPassword.textContent = lastName;

        if (noticePresetSelect) {
            noticePresetSelect.value = presetKey;
            const selected = noticePresets[presetKey] || noticePresets.welcome_credentials;
            if (selected) {
                if (noticeTitleInput) noticeTitleInput.value = selected.title;
                if (noticeMessageInput) noticeMessageInput.value = selected.body;
            }
        }

        noticeModal.style.display = 'flex';
    }

    function closeNoticeModal() {
        if (noticeModal) noticeModal.style.display = 'none';
    }

    if (closeNoticeBtn) closeNoticeBtn.addEventListener('click', closeNoticeModal);
    if (dismissNoticeBtn) dismissNoticeBtn.addEventListener('click', closeNoticeModal);

    if (noticePresetSelect) {
        noticePresetSelect.addEventListener('change', function() {
            const selected = noticePresets[this.value];
            if (selected) {
                if (noticeTitleInput) noticeTitleInput.value = selected.title;
                if (noticeMessageInput) noticeMessageInput.value = selected.body;
            }
        });
    }

    async function recordInAppNotice(title, message) {
        const targetStudentId = currentEnrollment?.student_id || currentEnrollment?.user_id || currentEnrollment?.id || null;
        const targetEmail = (currentEnrollment?.email || currentStudent?.email || '').trim().toLowerCase();
        const isGoodMoral = title.toLowerCase().includes('good moral') || message.toLowerCase().includes('good moral');

        try {
            await supabase
                .from('notifications')
                .insert([{
                    user_id: targetStudentId,
                    student_id: currentEnrollment?.student_id || null,
                    recipient_email: targetEmail || null,
                    role: 'student',
                    title: title,
                    message: message,
                    type: isGoodMoral ? 'good_moral_request' : 'requirement_reminder',
                    enrollment_id: currentEnrollment?.id || null,
                    is_read: false,
                    read: false,
                    created_at: new Date().toISOString()
                }]);
        } catch(e) {
            console.warn('Notice insert warning:', e);
        }

        const nowIso = new Date().toISOString();
        if (targetStudentId) {
            try {
                if (isGoodMoral) {
                    localStorage.setItem(`hes_req_requested_${targetStudentId}_good_moral`, nowIso);
                    localStorage.setItem(`hes_req_requested_${targetStudentId}_missing_goodmoral`, nowIso);
                }
                const k = `hes_notifications_${targetStudentId}`;
                const raw = localStorage.getItem(k);
                let list = raw ? JSON.parse(raw) : [];
                list.unshift({
                    id: 'notif_' + Date.now(),
                    type: isGoodMoral ? 'good_moral_request' : 'message',
                    title: title,
                    message: message,
                    time: 'Just now',
                    read: false
                });
                localStorage.setItem(k, JSON.stringify(list.slice(0, 30)));
            } catch(e) {}
        }

        if (targetEmail) {
            try {
                if (isGoodMoral) {
                    localStorage.setItem(`hes_req_requested_${targetEmail}_good_moral`, nowIso);
                    localStorage.setItem(`hes_req_requested_${targetEmail}_missing_goodmoral`, nowIso);
                }
                const kEm = `hes_notifications_${targetEmail}`;
                const rawEm = localStorage.getItem(kEm);
                let listEm = rawEm ? JSON.parse(rawEm) : [];
                listEm.unshift({
                    id: 'notif_em_' + Date.now(),
                    type: isGoodMoral ? 'good_moral_request' : 'message',
                    title: title,
                    message: message,
                    time: 'Just now',
                    read: false
                });
                localStorage.setItem(kEm, JSON.stringify(listEm.slice(0, 30)));
            } catch(e) {}
        }

        window.dispatchEvent(new Event('storage'));
        renderRequirementsSection();
    }

    if (sendNoticeGmailBtn) {
        sendNoticeGmailBtn.addEventListener('click', async function() {
            const title = noticeTitleInput?.value?.trim() || '📢 Official Notice from Registrar';
            const body = noticeMessageInput?.value?.trim() || '';
            const sEmail = (currentEnrollment?.email || currentStudent?.email || '').trim().toLowerCase();
            const firstName = currentEnrollment?.first_name || currentStudent?.first_name || '';
            let lastName = (currentEnrollment?.last_name || currentStudent?.last_name || '').trim();
            if (!lastName && currentEnrollment?.fullname) {
                const parts = currentEnrollment.fullname.trim().split(' ');
                lastName = parts[parts.length - 1];
            }
            if (!lastName) lastName = 'Student';

            const sName = currentEnrollment?.fullname || `${firstName} ${lastName}`.trim() || 'Student';
            const includeCreds = document.getElementById('includeCredsCheckbox')?.checked !== false;

            if (!sEmail) {
                showAlert('⚠️ Student does not have a registered email address.', 'error');
                return;
            }

            if (!body) {
                showAlert('⚠️ Please enter a message to send.', 'error');
                return;
            }

            try {
                sendNoticeGmailBtn.disabled = true;
                sendNoticeGmailBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Dispatching...';

                // 1. Post to In-App Notifications
                await recordInAppNotice(title, body);

                // 2. Open Student's Gmail compose with Username = Gmail & Password = Last Name
                const emailData = EmailNotificationService.buildRegistrarNoticeEmail({
                    studentName: sName,
                    firstName: firstName,
                    lastName: lastName,
                    email: sEmail,
                    messageTitle: title,
                    messageBody: body,
                    gradeLevel: currentEnrollment?.grade_level || 'Junior/Senior High',
                    includeCredentials: includeCreds
                });

                EmailNotificationService.sendViaGmailWeb(emailData);

                closeNoticeModal();
                showAlert(`✅ Notice saved and Gmail compose opened to notify ${sName} (${sEmail})!`, 'success');
            } catch(err) {
                console.error('Error sending notice:', err);
                showAlert('❌ Failed to send notice: ' + err.message, 'error');
            } finally {
                sendNoticeGmailBtn.disabled = false;
                sendNoticeGmailBtn.innerHTML = '<i class="fab fa-google"></i> Send via Student\'s Gmail';
            }
        });
    }

    if (saveNoticeInAppBtn) {
        saveNoticeInAppBtn.addEventListener('click', async function() {
            const title = noticeTitleInput?.value?.trim() || '📢 Official Notice from Registrar';
            const body = noticeMessageInput?.value?.trim() || '';
            const sName = currentEnrollment?.fullname || `${currentEnrollment?.first_name || ''} ${currentEnrollment?.last_name || ''}`.trim() || 'Student';

            if (!body) {
                showAlert('⚠️ Please enter a message to post.', 'error');
                return;
            }

            try {
                saveNoticeInAppBtn.disabled = true;
                await recordInAppNotice(title, body);
                closeNoticeModal();
                showAlert(`✅ In-app notice posted to ${sName}'s dashboard!`, 'success');
            } catch(err) {
                showAlert('❌ Error posting notice: ' + err.message, 'error');
            } finally {
                saveNoticeInAppBtn.disabled = false;
            }
        });
    }

    if (copyNoticeTextBtn) {
        copyNoticeTextBtn.addEventListener('click', async function() {
            const title = noticeTitleInput?.value?.trim() || '📢 Official Notice from Registrar';
            const body = noticeMessageInput?.value?.trim() || '';
            const firstName = currentEnrollment?.first_name || currentStudent?.first_name || '';
            let lastName = (currentEnrollment?.last_name || currentStudent?.last_name || '').trim();
            if (!lastName && currentEnrollment?.fullname) {
                const parts = currentEnrollment.fullname.trim().split(' ');
                lastName = parts[parts.length - 1];
            }
            if (!lastName) lastName = 'Student';

            const sName = currentEnrollment?.fullname || `${firstName} ${lastName}`.trim() || 'Student';
            const sEmail = (currentEnrollment?.email || currentStudent?.email || '').trim().toLowerCase();
            const includeCreds = document.getElementById('includeCredsCheckbox')?.checked !== false;

            const emailData = EmailNotificationService.buildRegistrarNoticeEmail({
                studentName: sName,
                firstName: firstName,
                lastName: lastName,
                email: sEmail,
                messageTitle: title,
                messageBody: body,
                gradeLevel: currentEnrollment?.grade_level || 'Junior/Senior High',
                includeCredentials: includeCreds
            });

            const ok = await EmailNotificationService.copyEmailText(emailData);
            if (ok) {
                showAlert('📋 Full notice email text copied to clipboard!', 'success');
            }
        });
    }

    if (notifyStudentBtn) {
        notifyStudentBtn.addEventListener('click', openNoticeModal);
    }

    // ============================================
    // FILE PREVIEW MODAL
    // ============================================

    function openFilePreview(fileName, fileUrl) {
        if (!filePreviewModal) return;

        if (modalFileName) modalFileName.textContent = fileName;
        if (downloadFileBtn && fileUrl) {
            downloadFileBtn.href = fileUrl;
            downloadFileBtn.style.display = 'inline-flex';
        }

        if (modalBody) {
            if (fileUrl.toLowerCase().endsWith('.pdf') || fileUrl.includes('application/pdf')) {
                modalBody.innerHTML = `<iframe src="${fileUrl}" style="width: 100%; height: 450px; border: none; border-radius: 8px;"></iframe>`;
            } else {
                modalBody.innerHTML = `<img src="${fileUrl}" alt="${fileName}" style="max-width: 100%; max-height: 450px; border-radius: 8px; display: block; margin: 0 auto;">`;
            }
        }

        filePreviewModal.style.display = 'flex';
    }

    document.querySelectorAll('.file-modal-close, .file-modal-close-footer').forEach(btn => {
        btn.addEventListener('click', () => {
            if (filePreviewModal) filePreviewModal.style.display = 'none';
        });
    });

    window.addEventListener('click', function(e) {
        const nModal = document.getElementById('noticeModal');
        if (e.target === nModal) closeNoticeModal();
        const cModal = document.getElementById('credentialsModal');
        if (e.target === cModal) closeCredentialsModal();
    });

    // ============================================
    // INITIALIZE
    // ============================================

    loadEnrollmentDetails();

})();