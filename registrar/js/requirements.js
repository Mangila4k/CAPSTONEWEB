/**
 * REGISTRAR - STUDENT REQUIREMENTS TRACKER
 * Placido L. Señor National High School (PLS-NSHS)
 * Real-time monitoring and follow-up of student document submissions
 */

import { supabase } from '../../supabase/config.js';
import { EmailNotificationService } from '../../js/email_service.js';

async function initRequirementsPage() {
    // ===== STATE =====
    let allStudents = [];
    let filteredStudents = [];
    let currentLevelFilter = 'all'; // 'all', 'jhs', 'shs'
    let currentStatusFilter = 'all'; // 'all', 'incomplete', 'complete'
    let currentGradeFilter = '';
    let currentDocFilter = 'all';
    let searchQuery = '';
    let remindersCount = 0;

    // Active Modal Context
    let activeStudent = null;

    // ===== DOM ELEMENTS =====
    const tableBody = document.getElementById('requirementsTableBody');
    const searchInput = document.getElementById('reqSearchInput');
    const statusFilter = document.getElementById('reqStatusFilter');
    const gradeFilter = document.getElementById('reqGradeFilter');
    const docFilter = document.getElementById('reqDocFilter');
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');
    const printReportBtn = document.getElementById('printReportBtn');
    const bulkRemindBtn = document.getElementById('bulkRemindBtn');
    
    // KPI Badges
    const statTotalEl = document.getElementById('statTotalStudents');
    const statCompleteEl = document.getElementById('statCompleteRequirements');
    const statIncompleteEl = document.getElementById('statIncompleteRequirements');
    const statRemindersEl = document.getElementById('statRemindersSent');
    const tableCountBadge = document.getElementById('tableCountBadge');

    // Level Pills
    const levelPills = document.querySelectorAll('.level-pill');
    const quickChips = document.querySelectorAll('.quick-chip');

    // Modals
    const detailModal = document.getElementById('requirementDetailModal');
    const closeDetailModalBtn = document.getElementById('closeDetailModalBtn');
    const closeDetailFooterBtn = document.getElementById('closeDetailFooterBtn');

    const reminderModal = document.getElementById('requirementNoticeModal');
    const closeNoticeModalBtn = document.getElementById('closeNoticeModalBtn');
    const cancelNoticeBtn = document.getElementById('cancelNoticeBtn');
    const sendNoticeBtn = document.getElementById('sendNoticeConfirmBtn');

    // Reminder Modal Inputs
    const noticeStudentName = document.getElementById('noticeStudentName');
    const noticeStudentEmail = document.getElementById('noticeStudentEmail');
    const noticeSubjectInput = document.getElementById('noticeSubjectInput');
    const noticeMessageInput = document.getElementById('noticeMessageInput');
    const noticeMissingList = document.getElementById('noticeMissingList');

    // ============================================
    // REQUIREMENTS SPECIFICATION BY GRADE LEVEL
    // ============================================
    const requirementsConfig = {
        'Grade 7': [
            { key: 'form_138', name: 'Form 138 / Report Card', required: true, icon: 'fa-file-lines' },
            { key: 'psa_birth_cert', name: 'PSA Birth Certificate', required: true, icon: 'fa-certificate' },
            { key: 'good_moral', name: 'Good Moral Certificate', required: true, icon: 'fa-award' },
            { key: 'two_by_two_picture', name: '2x2 ID Photo', required: true, icon: 'fa-image' },
            { key: 'completion_cert', name: 'Elementary Completion Cert', required: true, icon: 'fa-graduation-cap' }
        ],
        'Grade 8': [
            { key: 'form_138', name: 'Form 138 / Report Card', required: true, icon: 'fa-file-lines' },
            { key: 'psa_birth_cert', name: 'PSA Birth Certificate', required: true, icon: 'fa-certificate' },
            { key: 'good_moral', name: 'Good Moral Certificate', required: true, icon: 'fa-award' },
            { key: 'two_by_two_picture', name: '2x2 ID Photo', required: true, icon: 'fa-image' }
        ],
        'Grade 9': [
            { key: 'form_138', name: 'Form 138 / Report Card', required: true, icon: 'fa-file-lines' },
            { key: 'psa_birth_cert', name: 'PSA Birth Certificate', required: true, icon: 'fa-certificate' },
            { key: 'good_moral', name: 'Good Moral Certificate', required: true, icon: 'fa-award' },
            { key: 'two_by_two_picture', name: '2x2 ID Photo', required: true, icon: 'fa-image' }
        ],
        'Grade 10': [
            { key: 'form_138', name: 'Form 138 / Report Card', required: true, icon: 'fa-file-lines' },
            { key: 'psa_birth_cert', name: 'PSA Birth Certificate', required: true, icon: 'fa-certificate' },
            { key: 'good_moral', name: 'Good Moral Certificate', required: true, icon: 'fa-award' },
            { key: 'two_by_two_picture', name: '2x2 ID Photo', required: true, icon: 'fa-image' }
        ],
        'Grade 11': [
            { key: 'form_138', name: 'Form 138 / Report Card', required: true, icon: 'fa-file-lines' },
            { key: 'psa_birth_cert', name: 'PSA Birth Certificate', required: true, icon: 'fa-certificate' },
            { key: 'good_moral', name: 'Good Moral Certificate', required: true, icon: 'fa-award' },
            { key: 'two_by_two_picture', name: '2x2 ID Photo', required: true, icon: 'fa-image' },
            { key: 'jhs_completion', name: 'JHS Completion / Diploma', required: true, icon: 'fa-graduation-cap' }
        ],
        'Grade 12': [
            { key: 'form_138', name: 'Form 138 / Report Card', required: true, icon: 'fa-file-lines' },
            { key: 'psa_birth_cert', name: 'PSA Birth Certificate', required: true, icon: 'fa-certificate' },
            { key: 'good_moral', name: 'Good Moral Certificate', required: true, icon: 'fa-award' },
            { key: 'two_by_two_picture', name: '2x2 ID Photo', required: true, icon: 'fa-image' }
        ]
    };

    // ============================================
    // LOAD STUDENTS & ASSESS REQUIREMENTS
    // ============================================
    async function loadRequirementsData() {
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 48px;">
                        <i class="fas fa-spinner fa-spin" style="font-size: 28px; color: #0b2b4a; margin-bottom: 12px;"></i>
                        <p style="color: #64748b; margin: 0; font-size: 14px;">Analyzing student enrollment requirements and submission records...</p>
                    </td>
                </tr>
            `;
        }

        try {
            // Fetch students, enrollments, documents, and student_documents in parallel
            const [
                { data: studentsRows, error: sErr },
                { data: enrollmentsRows, error: eErr },
                { data: userRows, error: uErr },
                { data: docRows, error: dErr },
                { data: sDocRows, error: sdErr },
                { data: sectionsRows }
            ] = await Promise.all([
                supabase.from('students').select('*').order('created_at', { ascending: false }),
                supabase.from('enrollments').select('*').order('created_at', { ascending: false }),
                supabase.from('users').select('*').eq('role', 'student'),
                supabase.from('documents').select('*'),
                supabase.from('student_documents').select('*'),
                supabase.from('sections').select('id, name, grade_level, strand')
            ]);

            if (sErr) throw sErr;

            const sList = studentsRows || [];
            const eList = enrollmentsRows || [];
            const uList = userRows || [];
            const dList = docRows || [];
            const sdList = sDocRows || [];
            const secMap = new Map((sectionsRows || []).map(sec => [sec.id, sec]));

            const processedIds = new Set();
            const evaluatedStudents = [];

            // 1. Process from students table
            sList.forEach(st => {
                processedIds.add(st.id);

                // Match enrollment
                const matchedEnr = eList.find(e => 
                    (e.student_id && e.student_id === st.id) ||
                    (st.enrollment_id && e.id === st.enrollment_id) ||
                    (st.email && e.email && st.email.toLowerCase().trim() === e.email.toLowerCase().trim())
                );

                // Match user
                const matchedUser = uList.find(u => 
                    (st.email && u.email && st.email.toLowerCase().trim() === u.email.toLowerCase().trim()) ||
                    st.id === u.id
                );

                const fName = (st.first_name || (matchedUser ? matchedUser.first_name : '') || (matchedEnr ? matchedEnr.first_name : '') || '').trim();
                const lName = (st.last_name || (matchedUser ? matchedUser.last_name : '') || (matchedEnr ? matchedEnr.last_name : '') || '').trim();
                const mName = (st.middle_name || '').trim();
                const fullName = fName ? `${fName} ${mName ? mName + ' ' : ''}${lName}`.trim() : (st.email || 'Student');

                const grade = st.grade_level || (matchedEnr ? matchedEnr.grade_level : '') || 'Grade 7';
                const strand = st.strand || (matchedEnr ? matchedEnr.strand : '') || '';
                const type = st.student_type || (matchedEnr ? matchedEnr.student_type : '') || 'New';
                const email = st.email || (matchedUser ? matchedUser.email : (matchedEnr ? matchedEnr.email : ''));
                const lrn = st.lrn || 'N/A';
                const isTransferee = String(type).toLowerCase().includes('transfer') || String(type).toLowerCase().includes('different');

                // Collect all documents for this student
                const studentDocs = [
                    ...dList.filter(d => matchedEnr && d.enrollment_id === matchedEnr.id),
                    ...sdList.filter(sd => sd.student_id === st.id)
                ];

                // Evaluate requirements
                const reqEvaluation = evaluateStudentRequirements({
                    grade,
                    isTransferee,
                    student: st,
                    enrollment: matchedEnr,
                    documents: studentDocs
                });

                const studentSecId = st.section_id || (matchedEnr ? matchedEnr.section_id : null);
                const studentSecObj = studentSecId && secMap.has(studentSecId) ? secMap.get(studentSecId) : null;
                const studentSecName = studentSecObj ? studentSecObj.name : null;

                evaluatedStudents.push({
                    id: st.id,
                    student_id: st.id,
                    enrollment_id: matchedEnr ? matchedEnr.id : null,
                    first_name: fName,
                    last_name: lName,
                    fullname: fullName,
                    lrn: lrn,
                    email: email,
                    grade_level: grade,
                    strand: strand,
                    section_id: studentSecId,
                    section_name: studentSecName,
                    student_type: type,
                    isTransferee: isTransferee,
                    avatar_url: st.two_by_two_picture_url || st.avatar_url || (matchedEnr ? matchedEnr.two_by_two_picture_url : ''),
                    evaluation: reqEvaluation,
                    created_at: st.created_at || (matchedEnr ? matchedEnr.created_at : new Date().toISOString())
                });
            });

            // 2. Process enrollments not linked to a student record yet
            eList.forEach(enr => {
                if (enr.student_id && processedIds.has(enr.student_id)) return;
                const alreadyIncluded = evaluatedStudents.some(es => 
                    (enr.email && es.email && enr.email.toLowerCase().trim() === es.email.toLowerCase().trim()) ||
                    (es.enrollment_id && es.enrollment_id === enr.id)
                );
                if (alreadyIncluded) return;

                const fName = (enr.first_name || '').trim();
                const lName = (enr.last_name || '').trim();
                const mName = (enr.middle_name || '').trim();
                const fullName = fName ? `${fName} ${mName ? mName + ' ' : ''}${lName}`.trim() : (enr.email || 'Applicant');

                const grade = enr.grade_level || 'Grade 7';
                const strand = enr.strand || '';
                const type = enr.student_type || 'New';
                const isTransferee = String(type).toLowerCase().includes('transfer') || String(type).toLowerCase().includes('different');

                const enrSecId = enr.section_id || null;
                const enrSecObj = enrSecId && secMap.has(enrSecId) ? secMap.get(enrSecId) : null;
                const enrSecName = enrSecObj ? enrSecObj.name : null;

                const studentDocs = dList.filter(d => d.enrollment_id === enr.id);

                const reqEvaluation = evaluateStudentRequirements({
                    grade,
                    isTransferee,
                    student: null,
                    enrollment: enr,
                    documents: studentDocs
                });

                evaluatedStudents.push({
                    id: enr.id,
                    student_id: enr.student_id || enr.id,
                    enrollment_id: enr.id,
                    first_name: fName,
                    last_name: lName,
                    fullname: fullName,
                    lrn: enr.lrn || 'N/A',
                    email: enr.email || '',
                    grade_level: grade,
                    strand: strand,
                    section_id: enrSecId,
                    section_name: enrSecName,
                    student_type: type,
                    isTransferee: isTransferee,
                    avatar_url: enr.two_by_two_picture_url || '',
                    evaluation: reqEvaluation,
                    created_at: enr.created_at || new Date().toISOString()
                });
            });

            allStudents = evaluatedStudents;
            applyFilters();
            updateStats();

            // Direct routing from notifications: auto-open student checklist modal or filter
            try {
                const urlParams = new URLSearchParams(window.location.search);
                const targetStudentId = urlParams.get('student_id') || urlParams.get('id');
                const targetSearch = urlParams.get('search');

                if (targetStudentId) {
                    const targetStudent = allStudents.find(s => 
                        String(s.id) === String(targetStudentId) || 
                        String(s.student_id) === String(targetStudentId) || 
                        String(s.lrn) === String(targetStudentId)
                    );
                    if (targetStudent) {
                        setTimeout(() => openDetailModal(targetStudent), 150);
                    }
                } else if (targetSearch && searchInput) {
                    searchInput.value = targetSearch;
                    searchQuery = targetSearch.toLowerCase();
                    applyFilters();
                }
            } catch(e) {}

        } catch (error) {
            console.error('Error fetching requirements data:', error);
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="6">
                            <div class="empty-table-state">
                                <i class="fas fa-triangle-exclamation" style="color: #ef4444;"></i>
                                <h3>Unable to Load Requirements</h3>
                                <p>${error.message || 'Error connecting to database'}</p>
                                <button type="button" class="btn-header btn-header-primary" onclick="window.location.reload()">
                                    <i class="fas fa-redo"></i> Try Again
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }
        }
    }

    // ============================================
    // EVALUATE STUDENT REQUIREMENTS
    // ============================================
    function evaluateStudentRequirements({ grade, isTransferee, student, enrollment, documents }) {
        const rawConfig = requirementsConfig[grade] || requirementsConfig['Grade 7'];
        let reqList = [...rawConfig];

        // If transferee, ensure Form 137 is mandatory
        if (isTransferee) {
            if (!reqList.some(r => r.key === 'form_137')) {
                reqList.push({ key: 'form_137', name: 'Form 137 (Permanent Record)', required: true, icon: 'fa-folder-closed' });
            } else {
                reqList = reqList.map(r => r.key === 'form_137' ? { ...r, required: true } : r);
            }
        }

        const isExplicitComplete = (student?.documents_status || '').toLowerCase() === 'complete';
        const docItems = [];
        let submittedCount = 0;
        let missingCount = 0;

        reqList.forEach(req => {
            let isSubmitted = false;
            let fileUrl = null;

            if (isExplicitComplete) {
                isSubmitted = true;
            }

            // Check student table direct columns
            if (req.key === 'form_138') {
                if (student?.form_138_url) { isSubmitted = true; fileUrl = student.form_138_url; }
                else if (enrollment?.form_138_url) { isSubmitted = true; fileUrl = enrollment.form_138_url; }
            } else if (req.key === 'psa_birth_cert') {
                if (student?.psa_birth_url) { isSubmitted = true; fileUrl = student.psa_birth_url; }
                else if (enrollment?.psa_birth_url) { isSubmitted = true; fileUrl = enrollment.psa_birth_url; }
            } else if (req.key === 'good_moral') {
                if (student?.good_moral_url) { isSubmitted = true; fileUrl = student.good_moral_url; }
                else if (enrollment?.good_moral_url) { isSubmitted = true; fileUrl = enrollment.good_moral_url; }
            } else if (req.key === 'two_by_two_picture') {
                if (student?.two_by_two_picture_url || student?.avatar_url) {
                    isSubmitted = true;
                    fileUrl = student.two_by_two_picture_url || student.avatar_url;
                } else if (enrollment?.two_by_two_picture_url) {
                    isSubmitted = true;
                    fileUrl = enrollment.two_by_two_picture_url;
                }
            }

            // Check documents and student_documents tables
            if (!isSubmitted && documents && documents.length > 0) {
                documents.forEach(d => {
                    const dt = (d.document_type || '').toLowerCase();
                    const fn = (d.file_name || '').toLowerCase();
                    const url = d.file_url || d.url;

                    if (req.key === 'form_138') {
                        if (dt.includes('report card') || dt.includes('form 138') || fn.includes('form138') || fn.includes('card') || d.report_card) {
                            isSubmitted = true;
                            fileUrl = url || d.report_card;
                        }
                    } else if (req.key === 'psa_birth_cert') {
                        if (dt.includes('psa') || dt.includes('birth') || fn.includes('psa') || fn.includes('birth') || d.birth_certificate) {
                            isSubmitted = true;
                            fileUrl = url || d.birth_certificate;
                        }
                    } else if (req.key === 'good_moral') {
                        if (dt.includes('good moral') || fn.includes('moral') || d.good_moral) {
                            isSubmitted = true;
                            fileUrl = url || d.good_moral;
                        }
                    } else if (req.key === 'two_by_two_picture') {
                        if (dt.includes('photo') || dt.includes('picture') || dt.includes('2x2') || fn.includes('photo') || fn.includes('picture') || d.photo) {
                            isSubmitted = true;
                            fileUrl = url || d.photo;
                        }
                    } else if (req.key === 'completion_cert' || req.key === 'jhs_completion') {
                        if (dt.includes('completion') || dt.includes('diploma') || fn.includes('completion') || fn.includes('diploma')) {
                            isSubmitted = true;
                            fileUrl = url;
                        }
                    } else if (req.key === 'form_137') {
                        if (dt.includes('form 137') || fn.includes('form137') || fn.includes('permanent')) {
                            isSubmitted = true;
                            fileUrl = url;
                        }
                    }
                });
            }

            // Check localStorage physical submission override
            const overrideKey = `hes_req_verified_${student?.id || enrollment?.id}_${req.key}`;
            if (localStorage.getItem(overrideKey) === 'true') {
                isSubmitted = true;
            }

            if (isSubmitted) {
                submittedCount++;
            } else if (req.required) {
                missingCount++;
            }

            docItems.push({
                key: req.key,
                name: req.name,
                required: req.required,
                icon: req.icon,
                isSubmitted: isSubmitted,
                fileUrl: fileUrl
            });
        });

        const totalRequired = reqList.filter(r => r.required).length;
        const isComplete = missingCount === 0;
        const percent = totalRequired > 0 ? Math.round((submittedCount / totalRequired) * 100) : 100;

        return {
            docItems,
            submittedCount,
            missingCount,
            totalRequired,
            isComplete,
            percent: Math.min(100, percent)
        };
    }

    // ============================================
    // FILTER LOGIC
    // ============================================
    function applyFilters() {
        const query = (searchQuery || '').toLowerCase().trim();
        const level = currentLevelFilter;
        const status = currentStatusFilter;
        const grade = currentGradeFilter;
        const doc = currentDocFilter;

        filteredStudents = allStudents.filter(item => {
            // 1. Level Filter (JHS vs SHS)
            if (level !== 'all') {
                const gNum = parseInt((item.grade_level || '').replace(/\D/g, ''), 10);
                const isSHS = gNum >= 11;
                if (level === 'shs' && !isSHS) return false;
                if (level === 'jhs' && isSHS) return false;
            }

            // 2. Status Filter
            if (status === 'incomplete' && item.evaluation.isComplete) return false;
            if (status === 'complete' && !item.evaluation.isComplete) return false;

            // 3. Grade Filter
            if (grade && item.grade_level !== grade) return false;

            // 4. Missing Specific Document Filter
            if (doc !== 'all') {
                const missingDoc = item.evaluation.docItems.find(d => d.key === doc);
                if (!missingDoc || missingDoc.isSubmitted) return false;
            }

            // 5. Search Query
            if (query) {
                const matchName = item.fullname.toLowerCase().includes(query);
                const matchLrn = (item.lrn || '').toLowerCase().includes(query);
                const matchEmail = (item.email || '').toLowerCase().includes(query);
                const matchGrade = (item.grade_level || '').toLowerCase().includes(query);
                const matchSection = (item.section_name || '').toLowerCase().includes(query);
                if (!matchName && !matchLrn && !matchEmail && !matchGrade && !matchSection) return false;
            }

            return true;
        });

        renderTable();
        updateLevelBadges();
    }

    // ============================================
    // RENDER TABLE
    // ============================================
    function renderTable() {
        if (!tableBody) return;

        if (tableCountBadge) {
            tableCountBadge.innerHTML = `Showing <strong>${filteredStudents.length}</strong> of <strong>${allStudents.length}</strong> students`;
        }

        if (filteredStudents.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6">
                        <div class="empty-table-state">
                            <i class="fas fa-folder-open"></i>
                            <h3>No Students Found</h3>
                            <p>No student records matched your selected criteria or active document filters.</p>
                            <button type="button" class="btn-header btn-header-outline" id="emptyResetBtn">
                                <i class="fas fa-undo"></i> Reset Filters
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            const emptyReset = document.getElementById('emptyResetBtn');
            if (emptyReset) emptyReset.addEventListener('click', resetAllFilters);
            return;
        }

        let html = '';

        filteredStudents.forEach((student, index) => {
            const ev = student.evaluation;
            const gNum = parseInt((student.grade_level || '').replace(/\D/g, ''), 10);
            const isSHS = gNum >= 11;
            const levelClass = isSHS ? 'shs' : 'jhs';
            const levelLabel = isSHS ? 'SHS' : 'JHS';

            // Student type badge class
            const typeStr = (student.student_type || 'New').toLowerCase();
            let typeBadgeClass = 'new';
            let typeLabel = student.student_type || 'New';
            if (typeStr.includes('transfer')) {
                typeBadgeClass = 'transferee';
                typeLabel = 'Transferee';
            } else if (typeStr.includes('old') || typeStr.includes('continuing')) {
                typeBadgeClass = 'old';
                typeLabel = 'Continuing';
            } else {
                typeLabel = 'New';
            }

            // Compact micro checklist chips (all fit in single row)
            let pillsHtml = '';
            ev.docItems.forEach(doc => {
                const isSub = doc.isSubmitted;
                const statusCls = isSub ? 'submitted' : (doc.required ? 'missing' : 'optional');
                const iconCls = isSub ? 'fa-check' : (doc.required ? 'fa-xmark' : 'fa-circle-minus');
                const docLabel = getShortDocName(doc.key);
                pillsHtml += `
                    <span class="req-pill ${statusCls}" title="${doc.name}: ${isSub ? 'Submitted / Verified' : 'Missing / Action Required'}">
                        <i class="fas ${iconCls}"></i>${docLabel}
                    </span>
                `;
            });

            // Overall Status Pill & Progress Bar
            const statusClass = ev.isComplete ? 'complete' : (ev.submittedCount > 0 ? 'partial' : 'incomplete');
            const statusLabel = ev.isComplete ? 'All Verified' : (ev.missingCount === 1 ? '1 Missing' : `${ev.missingCount} Missing`);
            const fillClass = ev.isComplete ? 'complete' : (ev.percent >= 50 ? 'incomplete' : 'danger');

            html += `
                <tr data-student-id="${student.id}">
                    <!-- 1. Student Info -->
                    <td>
                        <div class="student-cell">
                            <div class="student-avatar" title="${student.fullname}">
                                ${student.avatar_url ? `
                                    <img src="${student.avatar_url}" alt="${student.fullname}" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';">
                                    <span style="display:none;">${getInitials(student.fullname)}</span>
                                ` : `
                                    <span>${getInitials(student.fullname)}</span>
                                `}
                            </div>
                            <div class="student-details">
                                <span class="student-name">${student.fullname}</span>
                                <div class="student-sub">
                                    <span class="student-lrn">${student.lrn}</span>
                                    <span class="sub-dot">&bull;</span>
                                    <span class="student-email" title="${student.email || ''}">${student.email || 'No email provided'}</span>
                                </div>
                            </div>
                        </div>
                    </td>

                    <!-- 2. Level & Grade -->
                    <td>
                        <div class="grade-cell">
                            <div class="grade-head">
                                <span class="level-tag ${levelClass}">${levelLabel}</span>
                                <span class="grade-text">${student.grade_level}</span>
                            </div>
                            <div style="display: flex; gap: 4px; align-items: center; flex-wrap: wrap; margin-top: 3px;">
                                ${student.section_name 
                                    ? `<span class="section-tag" style="background: #e0f2fe; color: #0284c7; font-weight: 600; font-size: 11px; padding: 1.5px 7px; border-radius: 9999px; border: 1px solid #bae6fd; display: inline-flex; align-items: center; gap: 3px;"><i class="fas fa-users" style="font-size: 9px;"></i> ${student.section_name}</span>` 
                                    : `<span style="font-size: 10.5px; color: #94a3b8; font-style: italic;">No Section</span>`
                                }
                                ${student.strand ? `<span class="strand-text" style="margin: 0; font-size: 11px;">${student.strand}</span>` : ''}
                            </div>
                        </div>
                    </td>

                    <!-- 3. Student Type -->
                    <td>
                        <span class="type-badge ${typeBadgeClass}">${typeLabel}</span>
                    </td>

                    <!-- 4. Checklist Micro-Badges -->
                    <td>
                        <div class="req-checklist-row">
                            ${pillsHtml}
                        </div>
                    </td>

                    <!-- 5. Submission Status & Progress -->
                    <td>
                        <div class="progress-col">
                            <div class="status-badge-wrap">
                                <span class="overall-status-pill ${statusClass}">
                                    <i class="fas ${ev.isComplete ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i>
                                    ${statusLabel}
                                </span>
                                <span class="progress-text">${ev.percent}%</span>
                            </div>
                            <div class="progress-bar-bg">
                                <div class="progress-bar-fill ${fillClass}" style="width: ${ev.percent}%;"></div>
                            </div>
                        </div>
                    </td>

                    <!-- 6. Actions (Fully visible, zero horizontal overflow) -->
                    <td style="text-align: right;">
                        <div class="action-buttons-wrap">
                            <button type="button" class="btn-action-icon view open-detail-btn" data-index="${index}" title="View Checklist & Verify">
                                <i class="fas fa-list-check"></i>
                            </button>
                            ${!ev.isComplete ? `
                                <button type="button" class="btn-action-icon remind open-remind-btn" data-index="${index}" title="Send Missing Requirements Notice">
                                    <i class="fas fa-paper-plane"></i>
                                </button>
                            ` : `
                                <button type="button" class="btn-action-icon verified open-detail-btn" data-index="${index}" title="Verified Complete">
                                    <i class="fas fa-check-double"></i>
                                </button>
                            `}
                            ${student.enrollment_id ? `
                                <a href="view_enrollment.html?id=${student.enrollment_id}" class="btn-action-icon link" title="Open Enrollment Application">
                                    <i class="fas fa-arrow-up-right-from-square"></i>
                                </a>
                            ` : `
                                <a href="students.html?search=${encodeURIComponent(student.lrn !== 'N/A' ? student.lrn : student.fullname)}" class="btn-action-icon link" title="Open Student Profile">
                                    <i class="fas fa-user-graduate"></i>
                                </a>
                            `}
                        </div>
                    </td>
                </tr>
            `;
        });

        tableBody.innerHTML = html;

        // Bind Action Buttons
        tableBody.querySelectorAll('.open-detail-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.index, 10);
                openDetailModal(filteredStudents[idx]);
            });
        });

        tableBody.querySelectorAll('.open-remind-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.index, 10);
                openReminderModal(filteredStudents[idx]);
            });
        });
    }

    // ============================================
    // SHORT LABELS & INITIALS
    // ============================================
    function getShortDocName(key) {
        switch (key) {
            case 'form_138': return 'F-138';
            case 'psa_birth_cert': return 'PSA';
            case 'good_moral': return 'Moral';
            case 'two_by_two_picture': return '2x2';
            case 'completion_cert': return 'Diploma';
            case 'jhs_completion': return 'Diploma';
            case 'form_137': return 'F-137';
            default: return key.replace(/_/g, ' ');
        }
    }

    function getInitials(name) {
        if (!name) return 'S';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }

    // ============================================
    // UPDATE KPI STATS & LIVE SIDEBAR BADGE
    // ============================================
    function updateStats() {
        const total = allStudents.length;
        const complete = allStudents.filter(s => s.evaluation.isComplete).length;
        const incomplete = total - complete;

        if (statTotalEl) statTotalEl.textContent = total;
        if (statCompleteEl) statCompleteEl.textContent = complete;
        if (statIncompleteEl) statIncompleteEl.textContent = incomplete;
        if (statRemindersEl) statRemindersEl.textContent = remindersCount;

        // Requirements page is active: registrar has seen their requirements notification, so the red number disappears
        const reqBadges = document.querySelectorAll('#pendingRequirementsBadge');
        reqBadges.forEach(b => {
            b.style.setProperty('display', 'none', 'important');
            b.classList.add('hidden');
            b.setAttribute('data-count', '0');
            b.textContent = '';
        });

        try {
            localStorage.setItem('hes_seen_requirements_at', String(Date.now()));
            localStorage.removeItem('hes_pending_requirements_count');
        } catch(e) {}
    }

    function updateLevelBadges() {
        const jhsCount = allStudents.filter(s => {
            const gNum = parseInt((s.grade_level || '').replace(/\D/g, ''), 10);
            return gNum < 11;
        }).length;

        const shsCount = allStudents.filter(s => {
            const gNum = parseInt((s.grade_level || '').replace(/\D/g, ''), 10);
            return gNum >= 11;
        }).length;

        const bAll = document.getElementById('badgeCountAll');
        const bJhs = document.getElementById('badgeCountJhs');
        const bShs = document.getElementById('badgeCountShs');

        if (bAll) bAll.textContent = allStudents.length;
        if (bJhs) bJhs.textContent = jhsCount;
        if (bShs) bShs.textContent = shsCount;
    }

    // ============================================
    // DETAIL MODAL (CHECKLIST & OFFICE RECEIPT)
    // ============================================
    function openDetailModal(student) {
        if (!student || !detailModal) return;
        activeStudent = student;

        const bannerName = document.getElementById('modalStudentName');
        const bannerSub = document.getElementById('modalStudentSub');
        const bannerAvatar = document.getElementById('modalStudentAvatar');
        const bannerStatus = document.getElementById('modalOverallStatus');
        const checklistContainer = document.getElementById('modalChecklistItems');

        if (bannerName) bannerName.textContent = student.fullname;
        const sectionBadgeHtml = student.section_name 
            ? ` • <span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 9999px; font-weight: 600; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;"><i class="fas fa-users" style="font-size: 9px;"></i> ${student.section_name}</span>`
            : '';
        if (bannerSub) bannerSub.innerHTML = `<strong>${student.grade_level}</strong>${sectionBadgeHtml} ${student.strand ? '• ' + student.strand : ''} • LRN: ${student.lrn}`;
        if (bannerAvatar) {
            bannerAvatar.innerHTML = student.avatar_url
                ? `<img src="${student.avatar_url}" alt="${student.fullname}" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';"><span style="display:none;">${getInitials(student.fullname)}</span>`
                : `<span>${getInitials(student.fullname)}</span>`;
        }

        const ev = student.evaluation;
        if (bannerStatus) {
            bannerStatus.innerHTML = `
                <span class="overall-status-pill ${ev.isComplete ? 'complete' : 'incomplete'}">
                    <i class="fas ${ev.isComplete ? 'fa-check-circle' : 'fa-clock'}"></i>
                    ${ev.isComplete ? 'Complete (All Documents Submitted)' : `${ev.missingCount} Requirements Pending`}
                </span>
            `;
        }

        let itemsHtml = '';
        ev.docItems.forEach(doc => {
            const isSub = doc.isSubmitted;
            itemsHtml += `
                <div class="checklist-item ${isSub ? 'submitted' : 'missing'}" data-key="${doc.key}">
                    <div class="checklist-doc-info">
                        <div class="checklist-doc-icon">
                            <i class="fas ${isSub ? 'fa-check' : doc.icon}"></i>
                        </div>
                        <div>
                            <div class="checklist-doc-title">${doc.name}</div>
                            <div class="checklist-doc-meta">
                                ${isSub ? '<span style="color: #16a34a; font-weight: 600;"><i class="fas fa-check-circle"></i> Submitted & Verified</span>' : '<span style="color: #dc2626; font-weight: 600;"><i class="fas fa-clock"></i> Not Yet Submitted</span>'}
                                ${doc.required ? ' &bull; Mandatory Requirement' : ' &bull; Optional Document'}
                            </div>
                        </div>
                    </div>
                    <div class="checklist-actions">
                        ${isSub && doc.fileUrl ? `
                            <a href="${doc.fileUrl}" target="_blank" rel="noopener noreferrer" class="btn-doc-view" title="Preview Attached Document">
                                <i class="fas fa-eye"></i> View
                            </a>
                        ` : ''}
                        ${!isSub ? `
                            <button type="button" class="btn-doc-receive mark-received-btn" data-key="${doc.key}" data-name="${doc.name}" title="Mark that student submitted physical document to office">
                                <i class="fas fa-check"></i> Mark Received
                            </button>
                            <button type="button" class="btn-doc-remind single-remind-btn" data-key="${doc.key}" data-name="${doc.name}" title="Send notice for this document">
                                <i class="fas fa-bell"></i> Remind
                            </button>
                        ` : `
                            <span style="font-size: 11.5px; color: #16a34a; font-weight: 700; padding: 4px 8px; background: #dcfce7; border-radius: 6px;">
                                <i class="fas fa-shield-check"></i> On File
                            </span>
                        `}
                    </div>
                </div>
            `;
        });

        if (checklistContainer) checklistContainer.innerHTML = itemsHtml;

        // Bind Mark Received buttons
        checklistContainer.querySelectorAll('.mark-received-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const docKey = btn.dataset.key;
                const docName = btn.dataset.name;
                await markRequirementReceived(student, docKey, docName);
            });
        });

        // Bind single remind buttons
        checklistContainer.querySelectorAll('.single-remind-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                closeDetailModal();
                openReminderModal(student, btn.dataset.name);
            });
        });

        detailModal.classList.add('active');
    }

    function closeDetailModal() {
        if (detailModal) detailModal.classList.remove('active');
    }

    // ============================================
    // MARK REQUIREMENT AS RECEIVED (OFFICE VERIFICATION)
    // ============================================
    async function markRequirementReceived(student, docKey, docName) {
        const confirmMsg = `Confirm marking "${docName}" as received for ${student.fullname}?\n\nThis confirms the physical hard copy document has been submitted to the Registrar's Office.`;
        if (!confirm(confirmMsg)) return;

        try {
            // 1. Save to local storage override
            const overrideKey = `hes_req_verified_${student.id}_${docKey}`;
            localStorage.setItem(overrideKey, 'true');

            // 2. Update Supabase if students row exists
            const payload = {};
            if (docKey === 'form_138') payload.form_138_url = 'physical_copy_verified';
            else if (docKey === 'psa_birth_cert') payload.psa_birth_url = 'physical_copy_verified';
            else if (docKey === 'good_moral') payload.good_moral_url = 'physical_copy_verified';
            else if (docKey === 'two_by_two_picture') payload.two_by_two_picture_url = 'physical_copy_verified';

            if (Object.keys(payload).length > 0) {
                await supabase.from('students').update(payload).eq('id', student.id);
            }

            // 3. Post audit notification
            try {
                await supabase.from('notifications').insert([{
                    user_id: student.student_id,
                    role: 'student',
                    title: `✅ Requirement Verified: ${docName}`,
                    message: `The Registrar's Office has verified receipt of your physical copy of ${docName}.`,
                    type: 'requirement',
                    read: false
                }]);
            } catch(e) {}

            alert(`✅ ${docName} marked as received for ${student.fullname}!`);
            closeDetailModal();
            await loadRequirementsData();

        } catch (err) {
            console.error('Error marking document as received:', err);
            alert('Failed to update requirement: ' + err.message);
        }
    }

    // ============================================
    // REMINDER / NOTICE MODAL
    // ============================================
    function openReminderModal(student, specificDocName = null) {
        if (!student || !reminderModal) return;
        activeStudent = student;

        const ev = student.evaluation;
        const missingDocs = ev.docItems.filter(d => !d.isSubmitted && d.required);
        const missingNames = specificDocName || missingDocs.map(d => d.name).join(', ') || 'Pending Enrollment Requirements';

        if (noticeStudentName) noticeStudentName.textContent = student.fullname;
        if (noticeStudentEmail) noticeStudentEmail.textContent = student.email || 'No email registered (In-App Notification Only)';

        if (noticeSubjectInput) {
            noticeSubjectInput.value = specificDocName 
                ? `⚠️ Action Required: Missing ${specificDocName}`
                : `📋 Official Notice: Incomplete Enrollment Requirements`;
        }

        if (noticeMessageInput) {
            noticeMessageInput.value = `Dear ${student.fullname},\n\nOur records at Placido L. Señor National High School (PLS-NSHS) indicate that you have not yet submitted the following mandatory enrollment requirement(s):\n• ${missingNames}\n\nPlease submit original physical copies to the Registrar's Office or upload clear digital scans via your Student Portal as soon as possible to finalize your official admission.`;
        }

        if (noticeMissingList) {
            let listHtml = '';
            missingDocs.forEach(d => {
                listHtml += `<li><i class="fas fa-triangle-exclamation" style="color: #ef4444;"></i> ${d.name}</li>`;
            });
            noticeMissingList.innerHTML = listHtml || `<li><i class="fas fa-triangle-exclamation" style="color: #ef4444;"></i> ${missingNames}</li>`;
        }

        reminderModal.classList.add('active');
    }

    function closeReminderModal() {
        if (reminderModal) reminderModal.classList.remove('active');
    }

    // ============================================
    // SEND REMINDER (IN-APP + GMAIL OPTION)
    // ============================================
    async function handleSendReminder() {
        if (!activeStudent) return;

        const subject = noticeSubjectInput?.value?.trim() || '📢 Requirement Notice';
        const message = noticeMessageInput?.value?.trim() || 'Please submit your pending enrollment requirements.';
        const targetEmail = activeStudent.email;
        const studentName = activeStudent.fullname;

        try {
            // 1. Post in-app notification to student
            try {
                await supabase.from('notifications').insert([{
                    user_id: activeStudent.student_id || activeStudent.id,
                    role: 'student',
                    title: subject,
                    message: message,
                    type: 'requirement_reminder',
                    read: false
                }]);
            } catch (err) {
                console.warn('In-app notification insert notice:', err);
            }

            // 2. Track reminder in local storage
            remindersCount++;
            if (statRemindersEl) statRemindersEl.textContent = remindersCount;

            closeReminderModal();
            alert(`✅ Reminder posted to ${studentName}'s Student Portal dashboard!`);

            // 3. Offer direct Gmail dispatch if student has email
            if (targetEmail && targetEmail.includes('@')) {
                const openGmail = confirm(`✉️ Notification posted! Would you also like to open Gmail Compose to send this notice directly to ${studentName} (${targetEmail})?`);
                if (openGmail) {
                    const missingNames = activeStudent.evaluation.docItems.filter(d => !d.isSubmitted && d.required).map(d => d.name).join(', ') || 'Enrollment Requirement';
                    const emailData = EmailNotificationService.buildMissingRequirementsEmail({
                        studentName: studentName,
                        firstName: activeStudent.first_name,
                        lastName: activeStudent.last_name,
                        email: targetEmail,
                        missingRequirement: missingNames,
                        gradeLevel: activeStudent.grade_level
                    });
                    EmailNotificationService.sendViaGmailWeb(emailData);
                }
            }

        } catch (err) {
            console.error('Error dispatching requirement reminder:', err);
            alert('Failed to send notice: ' + err.message);
        }
    }

    // ============================================
    // BULK REMIND (ALL FILTERED INCOMPLETE STUDENTS)
    // ============================================
    async function handleBulkRemind() {
        const incompleteStudents = filteredStudents.filter(s => !s.evaluation.isComplete);
        if (incompleteStudents.length === 0) {
            alert('🎉 Great news! All students in the current view have already completed and submitted their requirements.');
            return;
        }

        const confirmBulk = confirm(`Send missing requirement notifications to all ${incompleteStudents.length} student(s) with pending submissions in the current view?`);
        if (!confirmBulk) return;

        let sentCount = 0;
        for (const st of incompleteStudents) {
            const missingNames = st.evaluation.docItems.filter(d => !d.isSubmitted && d.required).map(d => d.name).join(', ');
            try {
                await supabase.from('notifications').insert([{
                    user_id: st.student_id || st.id,
                    role: 'student',
                    title: '⚠️ Notice: Pending Enrollment Requirements',
                    message: `Dear ${st.fullname}, please be reminded to submit your pending requirement(s): ${missingNames} to the Registrar's Office as soon as possible.`,
                    type: 'requirement_reminder',
                    read: false
                }]);
                sentCount++;
            } catch(e) {}
        }

        remindersCount += sentCount;
        if (statRemindersEl) statRemindersEl.textContent = remindersCount;
        alert(`✅ Bulk notifications sent to ${sentCount} student portal dashboards!`);
    }

    // ============================================
    // RESET ALL FILTERS
    // ============================================
    function resetAllFilters() {
        searchQuery = '';
        currentLevelFilter = 'all';
        currentStatusFilter = 'all';
        currentGradeFilter = '';
        currentDocFilter = 'all';

        if (searchInput) searchInput.value = '';
        if (statusFilter) statusFilter.value = 'all';
        if (gradeFilter) gradeFilter.value = '';
        if (docFilter) docFilter.value = 'all';

        levelPills.forEach(p => p.classList.toggle('active', p.dataset.level === 'all'));
        quickChips.forEach(c => c.classList.toggle('active', c.dataset.status === 'all'));

        applyFilters();
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            applyFilters();
        });
    }

    if (statusFilter) {
        statusFilter.addEventListener('change', (e) => {
            currentStatusFilter = e.target.value;
            quickChips.forEach(c => c.classList.toggle('active', c.dataset.status === currentStatusFilter));
            applyFilters();
        });
    }

    if (gradeFilter) {
        gradeFilter.addEventListener('change', (e) => {
            currentGradeFilter = e.target.value;
            applyFilters();
        });
    }

    if (docFilter) {
        docFilter.addEventListener('change', (e) => {
            currentDocFilter = e.target.value;
            applyFilters();
        });
    }

    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', resetAllFilters);
    }

    if (bulkRemindBtn) {
        bulkRemindBtn.addEventListener('click', handleBulkRemind);
    }

    if (printReportBtn) {
        printReportBtn.addEventListener('click', () => {
            window.print();
        });
    }

    // Level Pills (All, JHS, SHS)
    levelPills.forEach(pill => {
        pill.addEventListener('click', () => {
            levelPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            currentLevelFilter = pill.dataset.level;
            applyFilters();
        });
    });

    // Quick Status Chips
    quickChips.forEach(chip => {
        chip.addEventListener('click', () => {
            quickChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentStatusFilter = chip.dataset.status;
            if (statusFilter) statusFilter.value = currentStatusFilter;
            applyFilters();
        });
    });

    // Detail Modal Closes
    if (closeDetailModalBtn) closeDetailModalBtn.addEventListener('click', closeDetailModal);
    if (closeDetailFooterBtn) closeDetailFooterBtn.addEventListener('click', closeDetailModal);
    if (detailModal) {
        detailModal.addEventListener('click', (e) => {
            if (e.target === detailModal) closeDetailModal();
        });
    }

    // Reminder Modal Closes & Actions
    if (closeNoticeModalBtn) closeNoticeModalBtn.addEventListener('click', closeReminderModal);
    if (cancelNoticeBtn) cancelNoticeBtn.addEventListener('click', closeReminderModal);
    if (sendNoticeBtn) sendNoticeBtn.addEventListener('click', handleSendReminder);
    if (reminderModal) {
        reminderModal.addEventListener('click', (e) => {
            if (e.target === reminderModal) closeReminderModal();
        });
    }

    // ESC key closes modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeDetailModal();
            closeReminderModal();
        }
    });

    // Mobile Menu Toggle
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });

        document.addEventListener('click', (e) => {
            if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                sidebar.classList.remove('active');
            }
        });
    }

    // Initial Load
    await loadRequirementsData();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRequirementsPage);
} else {
    initRequirementsPage();
}

