/**
 * Student Assessments & Classwork (Google Classroom Experience)
 * Placido L. Señor National High School (Hiraya Enrollment System)
 */

import { supabase } from '../../supabase/config.js';

(function() {
    'use strict';

    console.log('🎒 Student Assessments (Google Classroom) ready');

    // ============================================
    // STATE
    // ============================================
    let sessionUser = null;
    let studentRow = null;
    let assessments = [];
    let studentSubmissions = {}; // assessmentId -> submission object
    let currentAssessment = null;
    let currentTab = 'all'; // 'all', 'todo', 'passed', 'graded', 'missing'
    let selectedFileToUpload = null;
    let isEditingSubmission = false;

    // ============================================
    // DOM ELEMENTS
    // ============================================
    const studentName = document.getElementById('studentName');
    const studentInitial = document.getElementById('studentInitial');
    const logoutBtn = document.getElementById('logoutBtn');
    const alertContainer = document.getElementById('alertContainer');

    // Tabs & Counters
    const tabAll = document.getElementById('tabAll');
    const tabTodo = document.getElementById('tabTodo');
    const tabPassed = document.getElementById('tabPassed');
    const tabGraded = document.getElementById('tabGraded');
    const tabMissing = document.getElementById('tabMissing');

    const countAll = document.getElementById('countAll');
    const countTodo = document.getElementById('countTodo');
    const countPassed = document.getElementById('countPassed');
    const countGraded = document.getElementById('countGraded');
    const countMissing = document.getElementById('countMissing');

    // Filters
    const searchAssessmentInput = document.getElementById('searchAssessmentInput');
    const filterSubjectSelect = document.getElementById('filterSubjectSelect');

    // Grid Container
    const assessmentsGrid = document.getElementById('studentAssessmentsGrid');

    // Classroom Modal Elements
    const classroomModal = document.getElementById('classroomModal');
    const btnCloseModal = document.getElementById('btnCloseModal');
    const modalTopTitle = document.getElementById('modalTopTitle');

    // Left Panel Elements
    const detailSubjectBadge = document.getElementById('detailSubjectBadge');
    const detailTitle = document.getElementById('detailTitle');
    const detailTeacher = document.getElementById('detailTeacher');
    const detailDue = document.getElementById('detailDue');
    const detailPoints = document.getElementById('detailPoints');
    const detailInstructions = document.getElementById('detailInstructions');
    const detailReferences = document.getElementById('detailReferences');

    // Right Panel Elements ("Your Work")
    const yourWorkStatusBadge = document.getElementById('yourWorkStatusBadge');
    const gradedSection = document.getElementById('gradedSection');
    const gradedScoreDisplay = document.getElementById('gradedScoreDisplay');
    const teacherRemarksBox = document.getElementById('teacherRemarksBox');

    const submissionForm = document.getElementById('submissionForm');
    const submissionNotice = document.getElementById('submissionNotice');
    const submissionNoticeText = document.getElementById('submissionNoticeText');
    const studentAnswerText = document.getElementById('studentAnswerText');
    const studentLinkInput = document.getElementById('studentLinkInput');
    const studentFileInput = document.getElementById('studentFileInput');
    const attachedFilePill = document.getElementById('attachedFilePill');
    const attachedFileName = document.getElementById('attachedFileName');
    const btnRemoveFile = document.getElementById('btnRemoveFile');
    const btnTurnIn = document.getElementById('btnTurnIn');
    const btnUnsubmit = document.getElementById('btnUnsubmit');
    const submittedWorkPreview = document.getElementById('submittedWorkPreview');

    // ============================================
    // AUTH & SESSION CHECK
    // ============================================
    try {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            sessionUser = JSON.parse(stored);
        }
    } catch(e) {}

    if (!sessionUser) {
        console.warn('⚠️ No active student session, redirecting...');
        window.location.replace('../auth/login.html');
        return;
    }

    if (sessionUser.role && sessionUser.role !== 'student') {
        const routes = {
            'admin': '../admin/dashboard.html',
            'teacher': '../teacher/dashboard.html',
            'parent': '../parents/dashboard.html',
            'registrar': '../registrar/dashboard.html'
        };
        window.location.replace(routes[sessionUser.role] || '../auth/login.html');
        return;
    }

    // Set student display name & initials
    let studentDisplayName = sessionUser.firstName ? `${sessionUser.firstName} ${sessionUser.lastName || ''}`.trim() : (sessionUser.email ? sessionUser.email.split('@')[0] : 'Student');
    if (studentName) studentName.textContent = studentDisplayName;
    if (studentInitial) studentInitial.textContent = getInitials(studentDisplayName);

    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            localStorage.removeItem('currentUser');
            localStorage.removeItem('hes_student_avatar');
            localStorage.removeItem('hes_student_name');
            try {
                await supabase.auth.signOut();
            } catch(err) {}
            window.location.replace('../auth/login.html');
        });
    }

    // ============================================
    // INITIALIZATION
    // ============================================
    async function init() {
        try {
            await fetchStudentRecord();
            await loadClasswork();
            setupEventListeners();

            // Check if directed from a notification with a specific assessment ID
            const urlParams = new URLSearchParams(window.location.search);
            const targetAssessId = urlParams.get('id');
            if (targetAssessId && assessments.some(a => String(a.id) === String(targetAssessId))) {
                setTimeout(() => openClassroomModal(targetAssessId), 250);
            }
        } catch(err) {
            console.error('Initialization error:', err);
            showAlert('❌ Failed to load assessments: ' + err.message, 'error');
        }
    }

    // Fetch Student DB Row
    async function fetchStudentRecord() {
        try {
            const userEmail = sessionUser.email || '';
            const userUid = sessionUser.uid || sessionUser.id || '';
            const studentTableId = sessionUser.student_id || sessionUser.studentTableId || '';

            let query = supabase.from('students').select('*');
            if (studentTableId) {
                query = query.or(`id.eq.${studentTableId},email.eq.${userEmail}`);
            } else {
                query = query.or(`email.eq.${userEmail},id.eq.${userUid}`);
            }

            const { data } = await query;
            if (data && data.length > 0) {
                // If studentTableId matches one, pick that one preferentially
                studentRow = (studentTableId && data.find(s => s.id === studentTableId)) || data[0];
                const fullName = `${studentRow.first_name || ''} ${studentRow.last_name || ''}`.trim();
                if (fullName) {
                    studentDisplayName = fullName;
                    if (studentName) studentName.textContent = fullName;
                    if (studentInitial) studentInitial.textContent = getInitials(fullName);
                }
            }
        } catch(e) {
            console.warn('Student query notice:', e);
        }
    }

    // Load Assessments & Student Submissions
    async function loadClasswork() {
        try {
            showLoadingState();

            // 1. Fetch assessments that apply to this student's section or all published
            let query = supabase
                .from('assessments')
                .select('*')
                .eq('status', 'published')
                .order('due_date', { ascending: true });

            const { data: allAssessments, error: assessErr } = await query;
            if (assessErr) throw assessErr;

            // Filter for student's section or year level
            const studentGrade = (studentRow?.grade_level || sessionUser?.grade_level || sessionUser?.grade || '').toLowerCase().trim();
            const studentSecId = studentRow?.section_id || sessionUser?.section_id || sessionUser?.sectionId || '';
            const studentSecName = (studentRow?.section || sessionUser?.section || '').toLowerCase().trim();

            assessments = (allAssessments || []).filter(a => {
                // 1. Explicit section match by section_id
                if (a.section_id) {
                    // Must strictly match student's enrolled section
                    if (studentSecId && String(a.section_id) === String(studentSecId)) return true;
                    if (studentSecName && a.section_name && a.section_name.toLowerCase().includes(studentSecName)) return true;
                    // If student does not belong to this section, strictly exclude!
                    return false;
                }

                // 2. Year level target without section_id (e.g. "All Grade 8")
                if (a.section_name && studentGrade) {
                    if (a.section_name.toLowerCase().includes(studentGrade)) return true;
                }

                // 3. School-wide assessments (no section or general)
                if (!a.section_id && (!a.section_name || a.section_name.toLowerCase() === 'general' || a.section_name.toLowerCase() === 'all students')) {
                    return true;
                }

                return false;
            });

            // 2. Fetch submissions made by this student
            const studentId = studentRow?.id || sessionUser.uid || sessionUser.id;
            const studentEmail = sessionUser.email || '';

            let subQuery = supabase
                .from('assessment_submissions')
                .select('*');

            if (studentId && studentEmail) {
                subQuery = subQuery.or(`student_id.eq.${studentId},student_email.eq.${studentEmail}`);
            } else if (studentId) {
                subQuery = subQuery.eq('student_id', studentId);
            } else if (studentEmail) {
                subQuery = subQuery.eq('student_email', studentEmail);
            }

            const { data: subsData, error: subsErr } = await subQuery;
            if (!subsErr && subsData) {
                studentSubmissions = {};
                subsData.forEach(sub => {
                    studentSubmissions[sub.assessment_id] = sub;
                });
            }

            populateSubjectFilter();
            updateTabCounts();
            renderClassworkGrid();

        } catch(err) {
            console.error('Error loading classwork:', err);
            showAlert('❌ Failed to load classwork: ' + err.message, 'error');
            assessmentsGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-circle text-danger"></i>
                    <h3>Error Loading Classwork</h3>
                    <p>${err.message}</p>
                    <button class="btn-turn-in" style="width: auto; margin: 15px auto;" onclick="window.location.reload()"><i class="fas fa-redo"></i> Retry</button>
                </div>
            `;
        }
    }

    function showLoadingState() {
        if (!assessmentsGrid) return;
        assessmentsGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-spinner fa-spin" style="color: var(--primary);"></i>
                <h3>Loading Classwork...</h3>
                <p>Gathering your assignments, activities, and quizzes</p>
            </div>
        `;
    }

    // Populate distinct subjects in filter
    function populateSubjectFilter() {
        if (!filterSubjectSelect) return;
        const uniqueSubjects = new Set();
        assessments.forEach(a => {
            if (a.subject_name) uniqueSubjects.add(a.subject_name);
        });

        filterSubjectSelect.innerHTML = '<option value="">All Subjects</option>';
        uniqueSubjects.forEach(sub => {
            const opt = document.createElement('option');
            opt.value = sub;
            opt.textContent = sub;
            filterSubjectSelect.appendChild(opt);
        });
    }

    // Determine status of an assessment for this student
    function getAssessmentState(assessment) {
        const sub = studentSubmissions[assessment.id];
        const now = new Date();
        const hasDueDate = !!assessment.due_date;
        const isPastDue = hasDueDate && new Date(assessment.due_date) < now;

        if (sub) {
            if (sub.status === 'graded') {
                return {
                    statusKey: 'graded',
                    label: `Graded (${sub.score}/${assessment.total_points || 100})`,
                    cssClass: 'graded',
                    icon: 'fas fa-check-double',
                    submission: sub
                };
            }
            if (sub.status === 'late') {
                return {
                    statusKey: 'passed',
                    label: 'Turned In Late',
                    cssClass: 'late',
                    icon: 'fas fa-clock',
                    submission: sub
                };
            }
            return {
                statusKey: 'passed',
                label: 'Turned In',
                cssClass: 'turned-in',
                icon: 'fas fa-check-circle',
                submission: sub
            };
        }

        if (isPastDue) {
            return {
                statusKey: 'missing',
                label: 'Missing (Past Due)',
                cssClass: 'missing',
                icon: 'fas fa-exclamation-circle',
                submission: null
            };
        }

        return {
            statusKey: 'todo',
            label: 'Assigned',
            cssClass: 'assigned',
            icon: 'fas fa-clipboard',
            submission: null
        };
    }

    // Update Tab Count Badges
    function updateTabCounts() {
        let total = assessments.length;
        let todo = 0;
        let passed = 0;
        let graded = 0;
        let missing = 0;

        assessments.forEach(a => {
            const state = getAssessmentState(a);
            if (state.statusKey === 'todo') todo++;
            if (state.statusKey === 'passed') passed++;
            if (state.statusKey === 'graded') graded++;
            if (state.statusKey === 'missing') missing++;
        });

        if (countAll) countAll.textContent = total;
        if (countTodo) countTodo.textContent = todo;
        if (countPassed) countPassed.textContent = passed;
        if (countGraded) countGraded.textContent = graded;
        if (countMissing) countMissing.textContent = missing;
    }

    // Render Classwork Grid
    function renderClassworkGrid() {
        if (!assessmentsGrid) return;

        const searchTerm = (searchAssessmentInput?.value || '').trim().toLowerCase();
        const selSubject = filterSubjectSelect?.value || '';

        const filtered = assessments.filter(a => {
            const state = getAssessmentState(a);

            // Tab filter
            if (currentTab === 'todo' && state.statusKey !== 'todo') return false;
            if (currentTab === 'passed' && state.statusKey !== 'passed') return false;
            if (currentTab === 'graded' && state.statusKey !== 'graded') return false;
            if (currentTab === 'missing' && state.statusKey !== 'missing') return false;

            // Search filter
            const matchesSearch = !searchTerm ||
                (a.title && a.title.toLowerCase().includes(searchTerm)) ||
                (a.subject_name && a.subject_name.toLowerCase().includes(searchTerm)) ||
                (a.description && a.description.toLowerCase().includes(searchTerm));

            // Subject filter
            const matchesSubject = !selSubject || a.subject_name === selSubject;

            return matchesSearch && matchesSubject;
        });

        if (filtered.length === 0) {
            let emptyMsg = "You don't have any assessments in this section.";
            if (currentTab === 'todo') emptyMsg = "Woohoo! No pending assignments to do right now.";
            if (currentTab === 'passed') emptyMsg = "You haven't turned in any assessments yet.";
            if (currentTab === 'graded') emptyMsg = "No assessments have been graded yet.";
            if (currentTab === 'missing') emptyMsg = "Awesome! You have no missing assignments.";

            assessmentsGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-clipboard-check" style="color: var(--primary);"></i>
                    <h3>All Caught Up</h3>
                    <p>${emptyMsg}</p>
                </div>
            `;
            return;
        }

        assessmentsGrid.innerHTML = '';

        filtered.forEach(assessment => {
            const state = getAssessmentState(assessment);
            const typeCategory = (assessment.type || 'assignment').toLowerCase();

            // Due Date text
            let dueText = 'No due date';
            let isOverdue = false;
            if (assessment.due_date) {
                const due = new Date(assessment.due_date);
                isOverdue = due < new Date();
                dueText = `Due ${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
            }

            const card = document.createElement('div');
            card.className = 'student-card';
            card.innerHTML = `
                <div class="card-subject-stripe ${typeCategory}"></div>
                <div class="student-card-content">
                    <div class="card-header-row">
                        <div class="card-subject-tag">
                            <i class="${getTypeIcon(assessment.type)}"></i> ${escapeHtml(assessment.subject_name || 'General')}
                        </div>
                        <span class="card-status-badge ${state.cssClass}">
                            <i class="${state.icon}"></i> ${state.label}
                        </span>
                    </div>

                    <h3 class="card-title">${escapeHtml(assessment.title)}</h3>
                    <div class="card-teacher">
                        <i class="fas fa-user-tie"></i> Teacher: ${escapeHtml(assessment.teacher_name || 'Teacher')}
                    </div>

                    <div class="card-due-box ${isOverdue && state.statusKey === 'missing' ? 'is-missing' : ''}">
                        <span><i class="fas fa-calendar-alt"></i> ${dueText}</span>
                        ${state.statusKey === 'graded' && state.submission ? `
                            <span class="grade-pill-display">${state.submission.score} / ${assessment.total_points || 100} pts</span>
                        ` : `
                            <span style="font-weight: 600; color: var(--gray-600);">${assessment.total_points || 100} pts</span>
                        `}
                    </div>
                </div>
            `;

            card.addEventListener('click', () => openClassroomModal(assessment.id));
            assessmentsGrid.appendChild(card);
        });
    }

    function getTypeIcon(type) {
        const t = (type || '').toLowerCase();
        if (t.includes('quiz')) return 'fas fa-question-circle';
        if (t.includes('activity')) return 'fas fa-pencil-alt';
        if (t.includes('project')) return 'fas fa-project-diagram';
        if (t.includes('exam')) return 'fas fa-file-invoice';
        return 'fas fa-tasks';
    }

    // ============================================
    // GOOGLE CLASSROOM MODAL (DETAIL & PASS WORK)
    // ============================================
    function openClassroomModal(assessmentId) {
        const assessment = assessments.find(a => a.id === assessmentId);
        if (!assessment || !classroomModal) return;

        currentAssessment = assessment;
        selectedFileToUpload = null;
        isEditingSubmission = false;

        modalTopTitle.innerHTML = `<i class="fas fa-book-reader"></i> ${escapeHtml(assessment.subject_name || 'Classwork')}`;

        // Populate Left Panel (Instructions)
        detailSubjectBadge.textContent = `${assessment.type || 'Assignment'} • ${assessment.subject_name || 'General'}`;
        detailTitle.textContent = assessment.title;
        detailTeacher.textContent = assessment.teacher_name || 'Teacher';
        detailPoints.textContent = `${assessment.total_points || 100} points`;

        if (assessment.due_date) {
            const due = new Date(assessment.due_date);
            detailDue.innerHTML = `<i class="fas fa-clock"></i> Due ${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
        } else {
            detailDue.innerHTML = `<i class="fas fa-infinity"></i> No due date`;
        }

        detailInstructions.textContent = assessment.description || 'No detailed instructions provided.';

        // Teacher Attachments / Reference Material
        if (assessment.attachment_url) {
            detailReferences.innerHTML = `
                <div class="reference-materials">
                    <div class="instructions-title"><i class="fas fa-paperclip"></i> Teacher Materials & Resources</div>
                    <a href="${escapeHtml(assessment.attachment_url)}" target="_blank" class="reference-card">
                        <i class="fas fa-file-download"></i>
                        <div>
                            <div>${escapeHtml(assessment.attachment_name || 'View Reference Resource')}</div>
                            <small style="color: var(--gray-400); font-weight: normal;">Click to open/download</small>
                        </div>
                    </a>
                </div>
            `;
        } else {
            detailReferences.innerHTML = '';
        }

        // Render Right Panel ("Your Work")
        renderYourWorkPanel();

        classroomModal.classList.add('active');
    }

    function closeClassroomModal() {
        if (classroomModal) classroomModal.classList.remove('active');
        currentAssessment = null;
        selectedFileToUpload = null;
        isEditingSubmission = false;
    }

    // Render "Your Work" Side Card
    function renderYourWorkPanel() {
        if (!currentAssessment) return;

        const assessment = currentAssessment;
        const sub = studentSubmissions[assessment.id];
        const state = getAssessmentState(assessment);

        // Reset UI elements
        attachedFilePill.style.display = 'none';
        if (studentFileInput) studentFileInput.value = '';
        if (studentAnswerText) studentAnswerText.value = '';
        if (studentLinkInput) studentLinkInput.value = '';

        yourWorkStatusBadge.className = `card-status-badge ${state.cssClass}`;
        yourWorkStatusBadge.innerHTML = `<i class="${state.icon}"></i> ${state.label}`;

        // Case 1: GRADED
        if (sub && sub.status === 'graded') {
            gradedSection.style.display = 'block';
            gradedScoreDisplay.textContent = `${sub.score} / ${assessment.total_points || 100}`;
            
            if (sub.feedback) {
                teacherRemarksBox.style.display = 'block';
                teacherRemarksBox.innerHTML = `<strong>Teacher Feedback:</strong><br>${escapeHtml(sub.feedback)}`;
            } else {
                teacherRemarksBox.style.display = 'none';
            }

            // Show what was submitted
            submissionNotice.style.display = 'block';
            submissionNoticeText.innerHTML = `Your work was graded on ${formatDate(sub.graded_at || sub.updated_at)}`;
            
            showSubmittedWorkPreview(sub);
            submissionForm.style.display = 'none';
            btnTurnIn.style.display = 'none';
            btnUnsubmit.style.display = 'none';
            return;
        }

        gradedSection.style.display = 'none';

        // Case 2: TURNED IN (PASSED) - NOT GRADED YET (Can Unsubmit and Pass Again)
        if (sub && !isEditingSubmission) {
            submissionNotice.style.display = 'flex';
            const passDateStr = formatDate(sub.submitted_at);
            submissionNoticeText.innerHTML = `<strong>Turned In:</strong> Passed on ${passDateStr}`;

            showSubmittedWorkPreview(sub);
            submissionForm.style.display = 'none';
            btnTurnIn.style.display = 'none';

            // Show Unsubmit button so student can come back and edit/pass again
            btnUnsubmit.style.display = 'flex';
            btnUnsubmit.innerHTML = '<i class="fas fa-undo-alt"></i> Unsubmit / Edit Work';
            return;
        }

        // Case 3: NOT YET SUBMITTED OR IN "UNSUBMIT / EDIT" MODE
        submissionNotice.style.display = 'none';
        submittedWorkPreview.style.display = 'none';
        submissionForm.style.display = 'block';
        btnUnsubmit.style.display = 'none';
        btnTurnIn.style.display = 'flex';

        if (sub && isEditingSubmission) {
            btnTurnIn.innerHTML = '<i class="fas fa-check-circle"></i> Pass Assessment Again (Re-turn In)';
            if (studentAnswerText) studentAnswerText.value = sub.submission_text || '';
            if (studentLinkInput) studentLinkInput.value = sub.link_url || '';
            if (sub.file_name) {
                attachedFilePill.style.display = 'flex';
                attachedFileName.textContent = sub.file_name;
            }
        } else {
            btnTurnIn.innerHTML = '<i class="fas fa-check-circle"></i> Turn In / Pass Assessment';
        }
    }

    // Display summary of submitted work
    function showSubmittedWorkPreview(sub) {
        submittedWorkPreview.style.display = 'block';
        let html = '';

        if (sub.submission_text) {
            html += `
                <div style="margin-bottom: 12px;">
                    <label style="font-size: 0.78rem; font-weight: 700; color: var(--gray-600); text-transform: uppercase;">Your Written Response:</label>
                    <div style="background: var(--gray-50); border: 1px solid var(--gray-200); border-radius: 6px; padding: 10px; font-size: 0.88rem; margin-top: 4px; white-space: pre-wrap;">${escapeHtml(sub.submission_text)}</div>
                </div>
            `;
        }

        if (sub.file_url) {
            html += `
                <div style="margin-bottom: 10px;">
                    <label style="font-size: 0.78rem; font-weight: 700; color: var(--gray-600); text-transform: uppercase;">Attached File:</label>
                    <a href="${escapeHtml(sub.file_url)}" target="_blank" style="display: flex; align-items: center; gap: 8px; background: white; border: 1px solid var(--gray-300); border-radius: 6px; padding: 8px 12px; margin-top: 4px; text-decoration: none; color: var(--primary); font-size: 0.85rem; font-weight: 600;">
                        <i class="fas fa-file-alt text-primary"></i>
                        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(sub.file_name || 'Download Submitted File')}</span>
                    </a>
                </div>
            `;
        }

        if (sub.link_url) {
            html += `
                <div style="margin-bottom: 10px;">
                    <label style="font-size: 0.78rem; font-weight: 700; color: var(--gray-600); text-transform: uppercase;">Submitted Link:</label>
                    <a href="${escapeHtml(sub.link_url)}" target="_blank" style="display: flex; align-items: center; gap: 8px; background: white; border: 1px solid var(--gray-300); border-radius: 6px; padding: 8px 12px; margin-top: 4px; text-decoration: none; color: var(--info); font-size: 0.85rem; font-weight: 600;">
                        <i class="fas fa-external-link-alt text-info"></i>
                        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(sub.link_url)}</span>
                    </a>
                </div>
            `;
        }

        if (!sub.submission_text && !sub.file_url && !sub.link_url) {
            html += `<p style="font-size: 0.85rem; color: var(--gray-500); font-style: italic;">Turned in without attachments.</p>`;
        }

        submittedWorkPreview.innerHTML = html;
    }

    // ============================================
    // PASS / TURN IN ASSESSMENT ACTION
    // ============================================
    async function handleTurnIn() {
        if (!currentAssessment) return;

        const textAnswer = studentAnswerText?.value.trim() || '';
        const linkVal = studentLinkInput?.value.trim() || '';

        // If nothing entered and no file attached, confirm if student wants to turn in blank
        if (!textAnswer && !linkVal && !selectedFileToUpload && !studentSubmissions[currentAssessment.id]?.file_url) {
            const confirmBlank = confirm("You haven't attached any files or written answer. Do you still want to Turn In / Pass this assessment?");
            if (!confirmBlank) return;
        }

        btnTurnIn.disabled = true;
        btnTurnIn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Turning In / Passing...';

        try {
            let uploadedUrl = studentSubmissions[currentAssessment.id]?.file_url || null;
            let uploadedName = studentSubmissions[currentAssessment.id]?.file_name || null;

            // Handle file upload if new file was selected
            if (selectedFileToUpload) {
                try {
                    const ext = selectedFileToUpload.name.split('.').pop();
                    const cleanName = `sub_${studentRow?.id || 'st'}_${Date.now()}.${ext}`;
                    const filePath = `submissions/${cleanName}`;

                    const { error: upErr } = await supabase.storage
                        .from('assessments')
                        .upload(filePath, selectedFileToUpload, { upsert: true });

                    if (!upErr) {
                        const { data: publicUrlData } = supabase.storage
                            .from('assessments')
                            .getPublicUrl(filePath);

                        uploadedUrl = publicUrlData?.publicUrl || uploadedUrl;
                        uploadedName = selectedFileToUpload.name;
                    }
                } catch(fileErr) {
                    console.warn('Storage upload notice (falling back):', fileErr);
                }
            }

            // Determine if passed on time or late
            const now = new Date();
            const isLate = currentAssessment.due_date && new Date(currentAssessment.due_date) < now;
            const subStatus = isLate ? 'late' : 'submitted';

            const studentId = studentRow?.id || sessionUser.uid || sessionUser.id;
            const studentEmail = sessionUser.email || '';
            const studentLrn = studentRow?.lrn || '';

            const payload = {
                assessment_id: currentAssessment.id,
                student_id: studentId,
                student_name: studentDisplayName,
                student_email: studentEmail,
                student_lrn: studentLrn,
                status: subStatus,
                submission_text: textAnswer || null,
                file_url: uploadedUrl,
                file_name: uploadedName,
                link_url: linkVal || null,
                submitted_at: now.toISOString(),
                updated_at: now.toISOString()
            };

            const existingSub = studentSubmissions[currentAssessment.id];

            if (existingSub) {
                // UPDATE / RE-PASS
                const { data, error } = await supabase
                    .from('assessment_submissions')
                    .update(payload)
                    .eq('id', existingSub.id)
                    .select();

                if (error) throw error;
                studentSubmissions[currentAssessment.id] = data[0];
                showAlert('🎉 You have successfully passed your assessment again!', 'success');
            } else {
                // INSERT NEW PASS
                payload.created_at = now.toISOString();
                const { data, error } = await supabase
                    .from('assessment_submissions')
                    .insert([payload])
                    .select();

                if (error) throw error;
                studentSubmissions[currentAssessment.id] = data[0];

                // Notify Teacher that student passed an assessment
                notifyTeacherOfSubmission(currentAssessment, studentDisplayName);

                showAlert('🎉 Assessment turned in successfully! You have passed your work.', 'success');
            }

            isEditingSubmission = false;
            selectedFileToUpload = null;

            updateTabCounts();
            renderYourWorkPanel();
            renderClassworkGrid();

        } catch(err) {
            console.error('Turn in error:', err);
            showAlert('❌ Failed to pass assessment: ' + err.message, 'error');
        } finally {
            btnTurnIn.disabled = false;
            btnTurnIn.innerHTML = '<i class="fas fa-check-circle"></i> Turn In / Pass Assessment';
        }
    }

    // Unsubmit / Edit Submission Action
    function handleUnsubmit() {
        const confirmUnsubmit = confirm('Unsubmit to add or change your work? You can come back and pass again anytime before the teacher grades it.');
        if (!confirmUnsubmit) return;

        isEditingSubmission = true;
        renderYourWorkPanel();
        showAlert('ℹ️ Submission unlocked. Make your edits and click Pass Assessment Again!', 'info');
    }

    // Send notification to teacher
    async function notifyTeacherOfSubmission(assessment, studentName) {
        try {
            if (assessment.teacher_id) {
                await supabase.from('notifications').insert([{
                    user_id: assessment.teacher_id,
                    role: 'teacher',
                    title: `Work Turned In: ${assessment.title}`,
                    message: `${studentName} has passed / turned in their assessment for ${assessment.subject_name || 'Class'}.`,
                    type: 'submission',
                    read: false,
                    is_read: false,
                    created_at: new Date().toISOString()
                }]);
            }
        } catch(e) {
            console.warn('Could not notify teacher:', e);
        }
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================
    function setupEventListeners() {
        // Tab click listeners
        const tabs = [
            { el: tabAll, key: 'all' },
            { el: tabTodo, key: 'todo' },
            { el: tabPassed, key: 'passed' },
            { el: tabGraded, key: 'graded' },
            { el: tabMissing, key: 'missing' }
        ];

        tabs.forEach(tab => {
            if (tab.el) {
                tab.el.addEventListener('click', () => {
                    tabs.forEach(t => t.el?.classList.remove('active'));
                    tab.el.classList.add('active');
                    currentTab = tab.key;
                    renderClassworkGrid();
                });
            }
        });

        // Search & Subject filter
        if (searchAssessmentInput) searchAssessmentInput.addEventListener('input', renderClassworkGrid);
        if (filterSubjectSelect) filterSubjectSelect.addEventListener('change', renderClassworkGrid);

        // Modal Close
        if (btnCloseModal) btnCloseModal.addEventListener('click', closeClassroomModal);
        if (classroomModal) {
            classroomModal.addEventListener('click', (e) => {
                if (e.target === classroomModal) closeClassroomModal();
            });
        }

        // File Input handler
        if (studentFileInput) {
            studentFileInput.addEventListener('change', function() {
                if (this.files && this.files.length > 0) {
                    selectedFileToUpload = this.files[0];
                    attachedFilePill.style.display = 'flex';
                    attachedFileName.textContent = selectedFileToUpload.name;
                }
            });
        }

        // Remove attached file
        if (btnRemoveFile) {
            btnRemoveFile.addEventListener('click', () => {
                selectedFileToUpload = null;
                if (studentFileInput) studentFileInput.value = '';
                attachedFilePill.style.display = 'none';
            });
        }

        // Turn In / Pass button
        if (btnTurnIn) btnTurnIn.addEventListener('click', handleTurnIn);

        // Unsubmit button
        if (btnUnsubmit) btnUnsubmit.addEventListener('click', handleUnsubmit);
    }

    // ============================================
    // UTILITIES
    // ============================================
    function formatDate(isoStr) {
        if (!isoStr) return '--';
        try {
            return new Date(isoStr).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
            });
        } catch(e) {
            return isoStr;
        }
    }

    function getInitials(name) {
        if (!name) return 'S';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }

    function showAlert(msg, type = 'success') {
        const popup = document.createElement('div');
        popup.className = `alert-popup ${type}`;
        popup.innerHTML = `<span>${msg}</span>`;
        document.body.appendChild(popup);
        setTimeout(() => {
            popup.remove();
        }, 4000);
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Start
    init();

})();
