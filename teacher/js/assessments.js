/**
 * Teacher Assessments Management - Supabase Integration
 * Placido L. Señor National High School (Hiraya Enrollment System)
 */

import { supabase } from '../../supabase/config.js';

(function() {
    'use strict';

    console.log('📝 Teacher Assessments Manager ready');

    // ============================================
    // STATE
    // ============================================
    let sessionUser = null;
    let teacherRow = null;
    let sections = [];
    let subjects = [];
    let assessments = [];
    let submissionsMap = {}; // assessmentId -> [submissions]
    let currentViewingAssessment = null;
    let sectionStudents = []; // students in currentViewingAssessment's section

    // ============================================
    // DOM ELEMENTS
    // ============================================
    const teacherName = document.getElementById('teacherName');
    const teacherInitial = document.getElementById('teacherInitial');
    const logoutBtn = document.getElementById('logoutBtn');
    const alertContainer = document.getElementById('alertContainer');

    // Stats
    const statTotalAssessments = document.getElementById('statTotalAssessments');
    const statActiveAssessments = document.getElementById('statActiveAssessments');
    const statTotalPassed = document.getElementById('statTotalPassed');
    const statPendingGrading = document.getElementById('statPendingGrading');

    // Filters
    const searchAssessmentInput = document.getElementById('searchAssessmentInput');
    const filterSectionSelect = document.getElementById('filterSectionSelect');
    const filterSubjectSelect = document.getElementById('filterSubjectSelect');
    const filterTypeSelect = document.getElementById('filterTypeSelect');
    const filterStatusSelect = document.getElementById('filterStatusSelect');

    // Grid Container
    const assessmentsGrid = document.getElementById('assessmentsGrid');

    // Create / Edit Modal Elements
    const assessmentModal = document.getElementById('assessmentModal');
    const modalTitle = document.getElementById('modalTitle');
    const assessmentForm = document.getElementById('assessmentForm');
    const assessmentIdInput = document.getElementById('assessmentId');
    const titleInput = document.getElementById('assessmentTitle');
    const typeInput = document.getElementById('assessmentType');
    const sectionSelect = document.getElementById('assessmentSection');
    const subjectSelect = document.getElementById('assessmentSubject');
    const pointsInput = document.getElementById('assessmentPoints');
    const dueDateInput = document.getElementById('assessmentDueDate');
    const dueTimeInput = document.getElementById('assessmentDueTime');
    const instructionsInput = document.getElementById('assessmentInstructions');
    const linkInput = document.getElementById('assessmentLink');
    const fileInput = document.getElementById('assessmentFile');
    const fileSelectedLabel = document.getElementById('fileSelectedLabel');
    const allowLateCheckbox = document.getElementById('allowLateCheckbox');
    const statusSelect = document.getElementById('assessmentStatus');
    const btnSaveAssessment = document.getElementById('btnSaveAssessment');
    const btnOpenCreateModal = document.getElementById('btnOpenCreateModal');
    const btnCloseModal = document.getElementById('btnCloseModal');
    const btnCancelModal = document.getElementById('btnCancelModal');

    // Submissions Review Modal Elements
    const submissionsModal = document.getElementById('submissionsModal');
    const btnCloseSubsModal = document.getElementById('btnCloseSubsModal');
    const subsAssessmentTitle = document.getElementById('subsAssessmentTitle');
    const subsMetaInfo = document.getElementById('subsMetaInfo');
    const kpiTotalEnrolled = document.getElementById('kpiTotalEnrolled');
    const kpiPassed = document.getElementById('kpiPassed');
    const kpiGraded = document.getElementById('kpiGraded');
    const kpiMissing = document.getElementById('kpiMissing');
    const subsFilterSelect = document.getElementById('subsFilterSelect');
    const subsTableBody = document.getElementById('subsTableBody');

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
        console.warn('⚠️ No active teacher session, redirecting...');
        window.location.replace('../auth/login.html');
        return;
    }

    if (sessionUser.role && sessionUser.role !== 'teacher') {
        const routes = {
            'admin': '../admin/dashboard.html',
            'student': '../student/dashboard.html',
            'parent': '../parents/dashboard.html',
            'registrar': '../registrar/dashboard.html'
        };
        window.location.replace(routes[sessionUser.role] || '../auth/login.html');
        return;
    }

    // Set teacher display name & initial
    const displayName = (sessionUser.firstName ? `${sessionUser.firstName} ${sessionUser.lastName || ''}`.trim() : (sessionUser.email ? sessionUser.email.split('@')[0] : 'Teacher'));
    if (teacherName) teacherName.textContent = displayName;
    if (teacherInitial) teacherInitial.textContent = displayName.charAt(0).toUpperCase();

    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            localStorage.removeItem('currentUser');
            localStorage.removeItem('hes_teacher_avatar');
            localStorage.removeItem('hes_teacher_name');
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
            await fetchTeacherRecord();
            await Promise.all([
                fetchSections(),
                fetchSubjects()
            ]);
            populateDropdowns();
            await loadAssessments();
            setupEventListeners();
        } catch(err) {
            console.error('Initialization error:', err);
            showAlert('❌ Failed to load assessments data: ' + err.message, 'error');
        }
    }

    // Fetch Teacher DB Row
    async function fetchTeacherRecord() {
        try {
            const { data } = await supabase
                .from('teachers')
                .select('*')
                .eq('user_id', sessionUser.id || sessionUser.uid);

            if (data && data.length > 0) {
                teacherRow = data[0];
            }
        } catch(e) {
            console.warn('Could not fetch teacher row:', e);
        }
    }

    // Fetch Sections
    async function fetchSections() {
        try {
            const { data, error } = await supabase
                .from('sections')
                .select('*')
                .order('grade_level', { ascending: true });

            if (!error && data) {
                sections = data;
            }
        } catch(e) {
            console.warn('Could not fetch sections:', e);
        }
    }

    // Fetch Subjects
    async function fetchSubjects() {
        try {
            const { data, error } = await supabase
                .from('subjects')
                .select('*')
                .order('name', { ascending: true });

            if (!error && data) {
                subjects = data;
            }
        } catch(e) {
            console.warn('Could not fetch subjects:', e);
        }
    }

    // Populate Filter and Modal Dropdowns
    function populateDropdowns() {
        // Group sections by Year Level (grade_level)
        function getGradeNum(g) {
            const m = (g || '').match(/\d+/);
            return m ? parseInt(m[0], 10) : 999;
        }

        const sectionsByGrade = {};
        sections.forEach(s => {
            const gl = s.grade_level || 'Other';
            if (!sectionsByGrade[gl]) sectionsByGrade[gl] = [];
            sectionsByGrade[gl].push(s);
        });

        const sortedGrades = Object.keys(sectionsByGrade).sort((a, b) => getGradeNum(a) - getGradeNum(b));

        // Filter sections & year levels
        if (filterSectionSelect) {
            filterSectionSelect.innerHTML = '<option value="">All Year Levels & Sections</option>';
            sortedGrades.forEach(gl => {
                const group = document.createElement('optgroup');
                group.label = `── ${gl} ──`;

                // Option for entire year level
                const yearOpt = document.createElement('option');
                yearOpt.value = `year:${gl}`;
                yearOpt.textContent = `All ${gl} (Entire Year Level)`;
                group.appendChild(yearOpt);

                // Individual sections under this year level
                sectionsByGrade[gl].sort((a, b) => a.name.localeCompare(b.name)).forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.id;
                    opt.textContent = `${s.name}`;
                    group.appendChild(opt);
                });

                filterSectionSelect.appendChild(group);
            });
        }

        // Modal sections & year levels
        if (sectionSelect) {
            sectionSelect.innerHTML = '<option value="">Select Year Level / Section</option>';
            sortedGrades.forEach(gl => {
                const group = document.createElement('optgroup');
                group.label = `── ${gl} ──`;

                // Option for entire year level
                const yearOpt = document.createElement('option');
                yearOpt.value = `year:${gl}`;
                yearOpt.dataset.isYear = 'true';
                yearOpt.dataset.gradeLevel = gl;
                yearOpt.dataset.name = `All ${gl}`;
                yearOpt.textContent = `⭐ All ${gl} (Entire Year Level)`;
                group.appendChild(yearOpt);

                // Individual sections under this year level
                sectionsByGrade[gl].sort((a, b) => a.name.localeCompare(b.name)).forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.id;
                    opt.dataset.isYear = 'false';
                    opt.dataset.gradeLevel = gl;
                    opt.dataset.name = `${gl} - ${s.name}`;
                    opt.textContent = `${gl} - ${s.name}`;
                    group.appendChild(opt);
                });

                sectionSelect.appendChild(group);
            });
        }

        // Filter subjects
        if (filterSubjectSelect) {
            filterSubjectSelect.innerHTML = '<option value="">All Subjects</option>';
            subjects.forEach(sub => {
                const opt = document.createElement('option');
                opt.value = sub.id;
                opt.textContent = sub.name;
                filterSubjectSelect.appendChild(opt);
            });
        }

        // Modal subjects
        if (subjectSelect) {
            subjectSelect.innerHTML = '<option value="">Select Subject</option>';
            subjects.forEach(sub => {
                const opt = document.createElement('option');
                opt.value = sub.id;
                opt.dataset.name = sub.name;
                opt.textContent = sub.name;
                subjectSelect.appendChild(opt);
            });
        }
    }

    // ============================================
    // LOAD ASSESSMENTS & SUBMISSIONS
    // ============================================
    async function loadAssessments() {
        try {
            showAssessmentsLoading();

            // Load all assessments
            let query = supabase
                .from('assessments')
                .select('*')
                .order('created_at', { ascending: false });

            const { data, error } = await query;
            if (error) throw error;

            assessments = data || [];

            // Load all submissions for these assessments
            if (assessments.length > 0) {
                const assessmentIds = assessments.map(a => a.id);
                const { data: subsData, error: subsErr } = await supabase
                    .from('assessment_submissions')
                    .select('*')
                    .in('assessment_id', assessmentIds);

                submissionsMap = {};
                if (!subsErr && subsData) {
                    subsData.forEach(sub => {
                        if (!submissionsMap[sub.assessment_id]) {
                            submissionsMap[sub.assessment_id] = [];
                        }
                        submissionsMap[sub.assessment_id].push(sub);
                    });
                }
            } else {
                submissionsMap = {};
            }

            updateDashboardKPIs();
            renderAssessmentsList();

        } catch(err) {
            console.error('Error loading assessments:', err);
            showAlert('❌ Failed to load assessments: ' + err.message, 'error');
            assessmentsGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"><i class="fas fa-exclamation-circle text-danger"></i></div>
                    <h3>Error Loading Assessments</h3>
                    <p>${err.message}</p>
                    <button class="btn-primary" onclick="window.location.reload()"><i class="fas fa-redo"></i> Retry</button>
                </div>
            `;
        }
    }

    // Loading State
    function showAssessmentsLoading() {
        if (!assessmentsGrid) return;
        assessmentsGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon"><i class="fas fa-spinner fa-spin" style="color: var(--primary);"></i></div>
                <h3>Loading Assessments...</h3>
                <p>Retrieving classwork and student submissions</p>
            </div>
        `;
    }

    // Update Top Stat Cards
    function updateDashboardKPIs() {
        const total = assessments.length;
        const now = new Date();

        let activeCount = 0;
        let totalPassedCount = 0;
        let pendingGradingCount = 0;

        assessments.forEach(a => {
            const isDuePassed = a.due_date && new Date(a.due_date) < now;
            if (a.status === 'published' && !isDuePassed) {
                activeCount++;
            }

            const subs = submissionsMap[a.id] || [];
            subs.forEach(s => {
                if (s.status === 'submitted' || s.status === 'late' || s.status === 'resubmitted' || s.status === 'graded') {
                    totalPassedCount++;
                }
                if (s.status === 'submitted' || s.status === 'late' || s.status === 'resubmitted') {
                    pendingGradingCount++;
                }
            });
        });

        if (statTotalAssessments) statTotalAssessments.textContent = total;
        if (statActiveAssessments) statActiveAssessments.textContent = activeCount;
        if (statTotalPassed) statTotalPassed.textContent = totalPassedCount;
        if (statPendingGrading) statPendingGrading.textContent = pendingGradingCount;
    }

    // Render Filtered Assessments Grid
    function renderAssessmentsList() {
        if (!assessmentsGrid) return;

        const searchTerm = (searchAssessmentInput?.value || '').trim().toLowerCase();
        const selSection = filterSectionSelect?.value || '';
        const selSubject = filterSubjectSelect?.value || '';
        const selType = filterTypeSelect?.value || '';
        const selStatus = filterStatusSelect?.value || '';

        const filtered = assessments.filter(a => {
            const matchesSearch = !searchTerm ||
                (a.title && a.title.toLowerCase().includes(searchTerm)) ||
                (a.subject_name && a.subject_name.toLowerCase().includes(searchTerm)) ||
                (a.section_name && a.section_name.toLowerCase().includes(searchTerm)) ||
                (a.description && a.description.toLowerCase().includes(searchTerm));

            const matchesSection = !selSection || 
                (selSection.startsWith('year:')
                    ? (a.section_name && a.section_name.toLowerCase().includes(selSection.replace('year:', '').toLowerCase()))
                    : a.section_id === selSection);
            const matchesSubject = !selSubject || a.subject_id === selSubject;
            const matchesType = !selType || (a.type && a.type.toLowerCase() === selType.toLowerCase());
            const matchesStatus = !selStatus || (a.status && a.status.toLowerCase() === selStatus.toLowerCase());

            return matchesSearch && matchesSection && matchesSubject && matchesType && matchesStatus;
        });

        if (filtered.length === 0) {
            assessmentsGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"><i class="fas fa-clipboard-list"></i></div>
                    <h3>No Assessments Found</h3>
                    <p>You haven't created any assessments matching your filters yet. Create your first assignment or quiz for students to complete and pass!</p>
                    <button class="btn-primary" id="btnEmptyCreate">
                        <i class="fas fa-plus"></i> Create Assessment
                    </button>
                </div>
            `;
            const btnEmptyCreate = document.getElementById('btnEmptyCreate');
            if (btnEmptyCreate) btnEmptyCreate.addEventListener('click', openCreateModal);
            return;
        }

        assessmentsGrid.innerHTML = '';

        filtered.forEach(assessment => {
            const subs = submissionsMap[assessment.id] || [];
            const passedSubs = subs.filter(s => s.status !== 'assigned');
            const gradedSubs = subs.filter(s => s.status === 'graded');
            const pendingSubs = passedSubs.length - gradedSubs.length;

            // Due Date formatting
            let dueDateFormatted = 'No due date';
            let isOverdue = false;
            if (assessment.due_date) {
                const due = new Date(assessment.due_date);
                isOverdue = due < new Date();
                dueDateFormatted = due.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                });
            }

            const typeClass = (assessment.type || 'assignment').toLowerCase().replace(/\s+/g, '-');
            const statusClass = (assessment.status || 'published').toLowerCase();

            const card = document.createElement('div');
            card.className = 'assessment-card';
            card.innerHTML = `
                <div class="assessment-card-header">
                    <div class="card-top-row">
                        <span class="badge-type ${typeClass}">
                            <i class="${getTypeIcon(assessment.type)}"></i> ${assessment.type || 'Assignment'}
                        </span>
                        <span class="badge-status ${statusClass}">
                            ${assessment.status ? assessment.status.toUpperCase() : 'PUBLISHED'}
                        </span>
                    </div>
                    <h3 class="assessment-title">${escapeHtml(assessment.title)}</h3>
                    <div class="meta-tags">
                        <span class="meta-tag"><i class="fas fa-layer-group"></i> ${escapeHtml(assessment.section_name || 'General')}</span>
                        <span class="meta-tag"><i class="fas fa-book"></i> ${escapeHtml(assessment.subject_name || 'General')}</span>
                        <span class="meta-tag"><i class="fas fa-award"></i> ${assessment.total_points || 100} pts</span>
                    </div>
                </div>

                <div class="assessment-card-body">
                    <p class="assessment-desc">${escapeHtml(assessment.description || 'No detailed instructions provided.')}</p>
                    
                    <div class="assessment-info-row">
                        <div class="info-item">
                            <i class="fas fa-calendar-alt ${isOverdue ? 'text-danger' : ''}"></i>
                            <span>Due: <strong>${dueDateFormatted}</strong></span>
                        </div>
                        ${assessment.attachment_url ? `
                            <div class="info-item">
                                <i class="fas fa-paperclip text-primary"></i>
                                <a href="${escapeHtml(assessment.attachment_url)}" target="_blank" style="color: var(--primary); text-decoration: underline; font-size: 0.8rem;">Resource</a>
                            </div>
                        ` : ''}
                    </div>

                    <div class="submission-tracker">
                        <div class="tracker-header">
                            <span><i class="fas fa-user-check text-success"></i> Passed by Students</span>
                            <span><strong>${passedSubs.length}</strong> passed ${pendingSubs > 0 ? `<span style="color: var(--warning); font-size: 0.78rem;">(${pendingSubs} to grade)</span>` : ''}</span>
                        </div>
                        <div class="tracker-bar">
                            <div class="tracker-fill" style="width: ${Math.min(100, Math.max(10, passedSubs.length * 15))}%;"></div>
                        </div>
                    </div>
                </div>

                <div class="assessment-card-footer">
                    <button class="btn-view-subs" data-id="${assessment.id}">
                        <i class="fas fa-tasks"></i> View Submissions (${passedSubs.length})
                    </button>
                    <div class="card-actions-menu">
                        <button class="btn-icon-action btn-edit-assessment" data-id="${assessment.id}" title="Edit Assessment">
                            <i class="fas fa-pen"></i>
                        </button>
                        <button class="btn-icon-action delete btn-delete-assessment" data-id="${assessment.id}" title="Delete Assessment">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
            `;

            assessmentsGrid.appendChild(card);
        });

        // Attach action handlers
        document.querySelectorAll('.btn-view-subs').forEach(btn => {
            btn.addEventListener('click', () => openSubmissionsModal(btn.dataset.id));
        });

        document.querySelectorAll('.btn-edit-assessment').forEach(btn => {
            btn.addEventListener('click', () => openEditModal(btn.dataset.id));
        });

        document.querySelectorAll('.btn-delete-assessment').forEach(btn => {
            btn.addEventListener('click', () => deleteAssessment(btn.dataset.id));
        });
    }

    function getTypeIcon(type) {
        const t = (type || '').toLowerCase();
        if (t.includes('quiz')) return 'fas fa-question-circle';
        if (t.includes('activity')) return 'fas fa-pen-alt';
        if (t.includes('mastery')) return 'fas fa-check-circle';
        if (t.includes('project')) return 'fas fa-project-diagram';
        if (t.includes('exam')) return 'fas fa-file-invoice';
        if (t.includes('homework')) return 'fas fa-book-reader';
        return 'fas fa-tasks';
    }

    // ============================================
    // CREATE / EDIT ASSESSMENT
    // ============================================
    function openCreateModal() {
        if (!assessmentModal) return;
        modalTitle.innerHTML = '<i class="fas fa-plus-circle"></i> Create New Assessment';
        assessmentForm.reset();
        if (assessmentIdInput) assessmentIdInput.value = '';
        if (fileSelectedLabel) {
            fileSelectedLabel.textContent = 'No file chosen';
            const pill = fileSelectedLabel.closest('.dropzone-file-pill');
            if (pill) pill.classList.remove('has-file');
        }

        // Default due date to 7 days from now at 11:59 PM
        const defaultDue = new Date();
        defaultDue.setDate(defaultDue.getDate() + 7);
        if (dueDateInput) dueDateInput.value = defaultDue.toISOString().split('T')[0];
        if (dueTimeInput) dueTimeInput.value = '23:59';
        if (allowLateCheckbox) allowLateCheckbox.checked = true;
        if (statusSelect) statusSelect.value = 'published';

        assessmentModal.classList.add('active');
    }

    function openEditModal(id) {
        const target = assessments.find(a => a.id === id);
        if (!target || !assessmentModal) return;

        modalTitle.innerHTML = '<i class="fas fa-edit"></i> Edit Assessment';
        if (assessmentIdInput) assessmentIdInput.value = target.id;
        if (titleInput) titleInput.value = target.title || '';
        if (typeInput) {
            typeInput.value = target.type || target.title || 'Activity';
            if (!typeInput.value || typeInput.selectedIndex === -1) {
                const targetKey = (target.type || target.title || '').toLowerCase();
                for (let i = 0; i < typeInput.options.length; i++) {
                    const optVal = typeInput.options[i].value.toLowerCase();
                    const optText = typeInput.options[i].text.toLowerCase();
                    if (targetKey.includes(optVal) || optText.includes(targetKey)) {
                        typeInput.selectedIndex = i;
                        break;
                    }
                }
            }
        }
        if (sectionSelect) {
            if (target.section_id) {
                sectionSelect.value = target.section_id;
            } else if (target.section_name && target.section_name.toLowerCase().includes('grade')) {
                const m = target.section_name.match(/Grade\s*\d+/i);
                if (m) {
                    sectionSelect.value = `year:${m[0]}`;
                }
            } else {
                sectionSelect.value = '';
            }
        }
        if (subjectSelect) subjectSelect.value = target.subject_id || '';
        if (pointsInput) pointsInput.value = target.total_points || 100;
        if (instructionsInput) instructionsInput.value = target.description || '';
        if (linkInput) linkInput.value = target.attachment_url || '';
        if (statusSelect) statusSelect.value = target.status || 'published';
        if (allowLateCheckbox) allowLateCheckbox.checked = target.allow_late !== false;
        if (fileSelectedLabel) {
            fileSelectedLabel.textContent = target.attachment_name || (target.attachment_url ? 'Existing attachment' : 'No file chosen');
            const pill = fileSelectedLabel.closest('.dropzone-file-pill');
            if (pill) {
                if (target.attachment_name || target.attachment_url) {
                    pill.classList.add('has-file');
                } else {
                    pill.classList.remove('has-file');
                }
            }
        }

        if (target.due_date) {
            const d = new Date(target.due_date);
            if (dueDateInput) dueDateInput.value = d.toISOString().split('T')[0];
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            if (dueTimeInput) dueTimeInput.value = `${hh}:${mm}`;
        }

        assessmentModal.classList.add('active');
    }

    function closeModal() {
        if (assessmentModal) assessmentModal.classList.remove('active');
    }

    // Save Assessment
    async function handleSaveAssessment(e) {
        e.preventDefault();

        const id = assessmentIdInput?.value;
        const type = typeInput?.value || 'Activity';
        const selectedTypeOpt = typeInput?.selectedOptions?.[0];
        const title = selectedTypeOpt ? selectedTypeOpt.text : type;
        let sectionId = null;
        let sectionName = 'General';
        const selSectionOpt = sectionSelect?.selectedOptions?.[0];
        if (selSectionOpt) {
            if (selSectionOpt.dataset.isYear === 'true') {
                sectionId = null;
                sectionName = `All ${selSectionOpt.dataset.gradeLevel || 'Students'}`;
            } else {
                sectionId = sectionSelect.value || null;
                sectionName = selSectionOpt.dataset.name || selSectionOpt.text || 'General';
            }
        }

        if (!sectionSelect?.value) {
            showAlert('⚠️ Please select a Year Level or Section', 'error');
            return;
        }

        const subjectId = subjectSelect?.value || null;
        const points = parseInt(pointsInput?.value, 10) || 100;
        const dueDateVal = dueDateInput?.value;
        const dueTimeVal = dueTimeInput?.value || '23:59';
        const instructions = instructionsInput?.value.trim();
        const link = linkInput?.value.trim();
        const status = statusSelect?.value || 'published';
        const allowLate = allowLateCheckbox ? allowLateCheckbox.checked : true;

        if (!type) {
            showAlert('⚠️ Please select an assessment type', 'error');
            return;
        }

        let dueTimestamp = null;
        if (dueDateVal) {
            dueTimestamp = new Date(`${dueDateVal}T${dueTimeVal}:00`).toISOString();
        }

        let subjectName = 'General';
        const selSubjectOpt = subjectSelect?.selectedOptions?.[0];
        if (selSubjectOpt && selSubjectOpt.dataset.name) {
            subjectName = selSubjectOpt.dataset.name;
        }

        btnSaveAssessment.disabled = true;
        btnSaveAssessment.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        try {
            let uploadedFileUrl = link;
            let uploadedFileName = '';

            // Handle file upload if present
            const file = fileInput?.files?.[0];
            if (file) {
                try {
                    const fileExt = file.name.split('.').pop();
                    const fileName = `teacher_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                    const filePath = `assessments/${fileName}`;

                    const { error: uploadError } = await supabase.storage
                        .from('assessments')
                        .upload(filePath, file, { upsert: true });

                    if (!uploadError) {
                        const { data: publicUrlData } = supabase.storage
                            .from('assessments')
                            .getPublicUrl(filePath);
                        uploadedFileUrl = publicUrlData?.publicUrl || uploadedFileUrl;
                        uploadedFileName = file.name;
                    }
                } catch(fileErr) {
                    console.warn('Storage upload notice (falling back):', fileErr);
                }
            }

            const payload = {
                title,
                type,
                section_id: sectionId,
                section_name: sectionName,
                subject_id: subjectId,
                subject_name: subjectName,
                total_points: points,
                due_date: dueTimestamp,
                description: instructions,
                attachment_url: uploadedFileUrl || null,
                attachment_name: uploadedFileName || null,
                status,
                allow_late: allowLate,
                teacher_id: sessionUser.id || sessionUser.uid,
                teacher_name: displayName,
                updated_at: new Date().toISOString()
            };

            if (id) {
                // UPDATE
                const { error } = await supabase
                    .from('assessments')
                    .update(payload)
                    .eq('id', id);

                if (error) throw error;
                showAlert('✅ Assessment updated successfully!', 'success');
            } else {
                // INSERT
                payload.created_at = new Date().toISOString();
                const { data: inserted, error } = await supabase
                    .from('assessments')
                    .insert([payload])
                    .select();

                if (error) throw error;

                // Send notification to students regarding which section or year level they belong to
                if (status === 'published') {
                    notifyStudentsOfNewAssessment({
                        sectionId,
                        sectionName,
                        subjectName,
                        title,
                        points,
                        dueStr: dueDateFormattedPreview(dueTimestamp)
                    });
                }

                showAlert('✅ Assessment published and students notified!', 'success');
            }

            closeModal();
            await loadAssessments();

        } catch(err) {
            console.error('Error saving assessment:', err);
            showAlert('❌ Error saving assessment: ' + err.message, 'error');
        } finally {
            btnSaveAssessment.disabled = false;
            btnSaveAssessment.innerHTML = '<i class="fas fa-check"></i> Save & Publish';
        }
    }

    function dueDateFormattedPreview(isoStr) {
        if (!isoStr) return 'No due date';
        try {
            return new Date(isoStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
        } catch(e) {
            return isoStr;
        }
    }

    // Broadcast notification to students regarding which section or year level they belong to
    async function notifyStudentsOfNewAssessment({ sectionId, sectionName, subjectName, title, points, dueStr }) {
        try {
            const isYearLevel = !sectionId || (sectionName && sectionName.toLowerCase().startsWith('all grade'));
            let students = [];

            if (isYearLevel) {
                // Extract grade level name, e.g. "Grade 8" from "All Grade 8"
                const m = (sectionName || '').match(/Grade\s*\d+/i);
                const gradeLevelMatch = m ? m[0] : '';

                let query = supabase
                    .from('students')
                    .select('id, email, first_name, last_name, grade_level, section_id');

                if (gradeLevelMatch) {
                    query = query.ilike('grade_level', `%${gradeLevelMatch}%`);
                }

                const { data: matchedStudents, error: sErr } = await query;
                if (sErr) console.warn('Students query warning:', sErr);
                students = matchedStudents || [];
            } else {
                // Specific Section
                const { data: matchedStudents, error: sErr } = await supabase
                    .from('students')
                    .select('id, email, first_name, last_name, grade_level, section_id')
                    .eq('section_id', sectionId);
                if (sErr) console.warn('Students query warning:', sErr);
                students = matchedStudents || [];
            }

            console.log(`📢 Target audience: ${students.length} students for ${sectionName}`);

            // Fetch user account IDs from `users` table where role = 'student' to ensure match with auth user session IDs
            let userMap = {};
            try {
                const { data: usersData } = await supabase
                    .from('users')
                    .select('id, email, student_id')
                    .eq('role', 'student');

                if (usersData) {
                    usersData.forEach(u => {
                        if (u.student_id) userMap[u.student_id] = u.id;
                        if (u.email) userMap[u.email.toLowerCase()] = u.id;
                    });
                }
            } catch(uErr) {
                console.warn('Users table mapping notice:', uErr);
            }

            // Notification title and message informing student of the specific year level or section
            const targetScope = isYearLevel ? `Year Level: ${sectionName}` : `Section: ${sectionName}`;
            const notifTitle = `New Assessment: ${title} (${targetScope})`;
            const notifMessage = isYearLevel
                ? `Teacher ${displayName} posted a new assessment (${points} pts) for your Year Level (${sectionName}) in ${subjectName || 'General'}. Due: ${dueStr}. Please check your Assessments page to view instructions and submit.`
                : `Teacher ${displayName} posted a new assessment (${points} pts) for your section (${sectionName}) in ${subjectName || 'General'}. Due: ${dueStr}. Please check your Assessments page to view instructions and submit.`;

            const notifs = [];
            const targetedUserIds = new Set();

            students.forEach(s => {
                const sId = s.id;
                const authUid = userMap[s.id] || (s.email ? userMap[s.email.toLowerCase()] : null);

                // Add record for student ID
                notifs.push({
                    user_id: sId,
                    role: 'student',
                    title: notifTitle,
                    message: notifMessage,
                    type: 'assessment',
                    read: false,
                    is_read: false,
                    created_at: new Date().toISOString()
                });
                targetedUserIds.add(sId);

                // If auth user account ID differs, also add for auth user account ID
                if (authUid && authUid !== sId) {
                    notifs.push({
                        user_id: authUid,
                        role: 'student',
                        title: notifTitle,
                        message: notifMessage,
                        type: 'assessment',
                        read: false,
                        is_read: false,
                        created_at: new Date().toISOString()
                    });
                    targetedUserIds.add(authUid);
                }

                if (s.email) {
                    targetedUserIds.add(s.email.toLowerCase());
                }
            });

            // Also add a general broadcast notification for students in this year level/section
            if (students.length === 0) {
                notifs.push({
                    user_id: null,
                    role: 'student',
                    title: notifTitle,
                    message: notifMessage,
                    type: 'assessment',
                    read: false,
                    is_read: false,
                    created_at: new Date().toISOString()
                });
            }

            // Batch insert to Supabase notifications table
            for (let i = 0; i < notifs.length; i += 100) {
                const chunk = notifs.slice(i, i + 100);
                const { error: insErr } = await supabase
                    .from('notifications')
                    .insert(chunk);
                if (insErr) {
                    console.warn('Notification insert chunk notice:', insErr);
                }
            }

            // Update localStorage for real-time notification update
            targetedUserIds.forEach(targetId => {
                try {
                    const localKey = `hes_notifications_${targetId}`;
                    const raw = localStorage.getItem(localKey);
                    let list = [];
                    if (raw) list = JSON.parse(raw);
                    list.unshift({
                        id: 'notif_assess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                        title: notifTitle,
                        message: notifMessage,
                        type: 'assessment',
                        time: 'Just now',
                        read: false,
                        created_at: new Date().toISOString()
                    });
                    localStorage.setItem(localKey, JSON.stringify(list));
                } catch(e) {}
            });

            // Fire storage update event for live notification bell badge
            localStorage.setItem('hes_latest_notification', JSON.stringify({
                time: Date.now(),
                title: notifTitle,
                message: notifMessage,
                target: sectionName
            }));

        } catch(e) {
            console.warn('Could not broadcast notification to students:', e);
        }
    }

    // Delete Assessment
    async function deleteAssessment(id) {
        const target = assessments.find(a => a.id === id);
        if (!target) return;

        const confirmDelete = confirm(`Are you sure you want to delete "${target.title}"?\nAll student submissions and grades for this assessment will also be removed.`);
        if (!confirmDelete) return;

        try {
            const { error } = await supabase
                .from('assessments')
                .delete()
                .eq('id', id);

            if (error) throw error;

            showAlert('🗑️ Assessment deleted successfully', 'success');
            await loadAssessments();
        } catch(err) {
            console.error('Delete error:', err);
            showAlert('❌ Failed to delete assessment: ' + err.message, 'error');
        }
    }

    // ============================================
    // VIEW SUBMISSIONS & GRADING (CLASSROOM STYLE)
    // ============================================
    async function openSubmissionsModal(assessmentId) {
        const assessment = assessments.find(a => a.id === assessmentId);
        if (!assessment || !submissionsModal) return;

        currentViewingAssessment = assessment;

        subsAssessmentTitle.textContent = assessment.title;
        subsMetaInfo.innerHTML = `
            <span><i class="fas fa-layer-group"></i> ${escapeHtml(assessment.section_name || 'Section')}</span> • 
            <span><i class="fas fa-book"></i> ${escapeHtml(assessment.subject_name || 'Subject')}</span> • 
            <span><i class="fas fa-star text-warning"></i> Total: <strong>${assessment.total_points || 100} pts</strong></span> • 
            <span><i class="fas fa-clock"></i> Due: <strong>${dueDateFormattedPreview(assessment.due_date)}</strong></span>
        `;

        submissionsModal.classList.add('active');
        subsTableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 40px;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 1.5rem; color: var(--primary);"></i>
                    <p style="margin-top: 10px; color: var(--gray-500);">Loading students and passed submissions...</p>
                </td>
            </tr>
        `;

        try {
            // 1. Fetch all students in this section (or all students if no specific section)
            let studentsQuery = supabase.from('students').select('*').order('last_name', { ascending: true });
            if (assessment.section_id) {
                studentsQuery = studentsQuery.eq('section_id', assessment.section_id);
            }
            const { data: stData, error: stErr } = await studentsQuery;
            if (stErr) throw stErr;

            sectionStudents = stData || [];

            // If section has no direct students mapped, also fetch all students as fallback
            if (sectionStudents.length === 0) {
                const { data: allSt } = await supabase.from('students').select('*').limit(20);
                sectionStudents = allSt || [];
            }

            // 2. Refresh submissions for this assessment
            const { data: currentSubs, error: subsErr } = await supabase
                .from('assessment_submissions')
                .select('*')
                .eq('assessment_id', assessment.id);

            if (!subsErr && currentSubs) {
                submissionsMap[assessment.id] = currentSubs;
            }

            renderSubmissionsTable();

        } catch(err) {
            console.error('Error fetching submissions modal data:', err);
            subsTableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 30px; color: var(--danger);">
                        <i class="fas fa-exclamation-triangle"></i> Error loading submissions: ${err.message}
                    </td>
                </tr>
            `;
        }
    }

    function closeSubmissionsModal() {
        if (submissionsModal) submissionsModal.classList.remove('active');
        currentViewingAssessment = null;
    }

    function renderSubmissionsTable() {
        if (!currentViewingAssessment || !subsTableBody) return;

        const assessment = currentViewingAssessment;
        const subs = submissionsMap[assessment.id] || [];
        const filterVal = subsFilterSelect?.value || 'all';

        // Map students to submissions
        const rows = sectionStudents.map(student => {
            const submission = subs.find(s => 
                (s.student_id && s.student_id === student.id) ||
                (s.student_email && s.student_email.toLowerCase() === (student.email || '').toLowerCase()) ||
                (s.student_lrn && s.student_lrn === student.lrn)
            );

            let status = 'missing';
            if (submission) {
                status = submission.status || 'submitted';
            }

            return {
                student,
                submission,
                status
            };
        });

        // Update KPIs
        const totalEnrolled = rows.length;
        const passedCount = rows.filter(r => r.submission && r.status !== 'missing').length;
        const gradedCount = rows.filter(r => r.status === 'graded').length;
        const missingCount = totalEnrolled - passedCount;

        if (kpiTotalEnrolled) kpiTotalEnrolled.textContent = totalEnrolled;
        if (kpiPassed) kpiPassed.textContent = passedCount;
        if (kpiGraded) kpiGraded.textContent = gradedCount;
        if (kpiMissing) kpiMissing.textContent = missingCount;

        // Apply Status Filter
        const filteredRows = rows.filter(r => {
            if (filterVal === 'passed') return r.submission && r.status !== 'missing';
            if (filterVal === 'graded') return r.status === 'graded';
            if (filterVal === 'pending_grade') return r.submission && r.status !== 'graded';
            if (filterVal === 'missing') return !r.submission || r.status === 'missing';
            return true;
        });

        if (filteredRows.length === 0) {
            subsTableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 35px; color: var(--gray-500);">
                        <i class="fas fa-inbox" style="font-size: 2rem; color: var(--gray-300); margin-bottom: 8px; display: block;"></i>
                        No students match this submission filter.
                    </td>
                </tr>
            `;
            return;
        }

        subsTableBody.innerHTML = '';

        filteredRows.forEach(item => {
            const st = item.student;
            const sub = item.submission;
            const studentFullName = `${st.first_name || ''} ${st.last_name || ''}`.trim() || st.email || 'Student';
            const studentInitialChar = (st.first_name || st.email || 'S').charAt(0).toUpperCase();

            // Status Badge
            let statusBadge = `<span class="badge-status" style="background: #fee2e2; color: #b91c1c;"><i class="fas fa-times-circle"></i> Not Passed / Missing</span>`;
            if (sub) {
                if (sub.status === 'graded') {
                    statusBadge = `<span class="badge-status" style="background: #e0f2fe; color: #0284c7;"><i class="fas fa-check-double"></i> Graded (${sub.score}/${assessment.total_points})</span>`;
                } else if (sub.status === 'late') {
                    statusBadge = `<span class="badge-status" style="background: #fef3c7; color: #b45309;"><i class="fas fa-clock"></i> Turned In Late</span>`;
                } else {
                    statusBadge = `<span class="badge-status" style="background: #dcfce7; color: #15803d;"><i class="fas fa-check-circle"></i> Passed (Turned In)</span>`;
                }
            }

            // Submitted Work details
            let workHtml = `<span style="color: var(--gray-400); font-style: italic;">No work submitted yet</span>`;
            let submittedTimeHtml = '--';

            if (sub) {
                if (sub.submitted_at) {
                    submittedTimeHtml = new Date(sub.submitted_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                    });
                }

                let attachments = [];
                if (sub.file_url) {
                    attachments.push(`<a href="${escapeHtml(sub.file_url)}" target="_blank" style="color: var(--primary); font-weight: 600; text-decoration: underline; display: inline-flex; align-items: center; gap: 4px;"><i class="fas fa-file-download"></i> ${escapeHtml(sub.file_name || 'Download File')}</a>`);
                }
                if (sub.link_url) {
                    attachments.push(`<a href="${escapeHtml(sub.link_url)}" target="_blank" style="color: var(--info); font-weight: 600; text-decoration: underline; display: inline-flex; align-items: center; gap: 4px;"><i class="fas fa-external-link-alt"></i> External Link</a>`);
                }

                workHtml = `
                    <div>
                        ${sub.submission_text ? `<div style="background: var(--gray-100); padding: 8px 12px; border-radius: 6px; font-size: 0.85rem; margin-bottom: 6px; max-height: 80px; overflow-y: auto;">${escapeHtml(sub.submission_text)}</div>` : ''}
                        ${attachments.length > 0 ? `<div style="display: flex; gap: 10px; flex-wrap: wrap;">${attachments.join(' ')}</div>` : ''}
                        ${!sub.submission_text && attachments.length === 0 ? '<span style="color: var(--gray-500);">Marked as Passed</span>' : ''}
                    </div>
                `;
            }

            // Grading Column
            let gradingHtml = '';
            if (sub) {
                const currentScore = sub.score !== null && sub.score !== undefined ? sub.score : '';
                const currentFeedback = sub.feedback || '';

                gradingHtml = `
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <input type="number" class="grade-input-box" id="score_${sub.id}" value="${currentScore}" min="0" max="${assessment.total_points || 100}" placeholder="Pts">
                            <span style="font-size: 0.85rem; color: var(--gray-500); font-weight: 600;">/ ${assessment.total_points || 100}</span>
                        </div>
                        <input type="text" class="form-control" id="feedback_${sub.id}" value="${escapeHtml(currentFeedback)}" placeholder="Add remarks / feedback..." style="font-size: 0.8rem; padding: 6px 10px;">
                        <button class="btn-save-grade" data-sub-id="${sub.id}" data-st-id="${st.id}">
                            <i class="fas fa-save"></i> Return Grade
                        </button>
                    </div>
                `;
            } else {
                gradingHtml = `<span style="color: var(--gray-400); font-size: 0.82rem;">Awaiting submission</span>`;
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="student-info-cell">
                        <div class="student-mini-avatar">${studentInitialChar}</div>
                        <div>
                            <div class="student-cell-name">${escapeHtml(studentFullName)}</div>
                            <div class="student-cell-lrn">LRN: ${escapeHtml(st.lrn || 'N/A')}</div>
                        </div>
                    </div>
                </td>
                <td>
                    ${statusBadge}
                    <div style="font-size: 0.75rem; color: var(--gray-400); margin-top: 4px;">Time: ${submittedTimeHtml}</div>
                </td>
                <td style="max-width: 280px;">
                    ${workHtml}
                </td>
                <td style="min-width: 190px;">
                    ${gradingHtml}
                </td>
            `;

            subsTableBody.appendChild(tr);
        });

        // Attach Save Grade listeners
        document.querySelectorAll('.btn-save-grade').forEach(btn => {
            btn.addEventListener('click', () => {
                const subId = btn.dataset.subId;
                const studentId = btn.dataset.stId;
                saveStudentGrade(subId, studentId, btn);
            });
        });
    }

    // Save Grade & Return to Student
    async function saveStudentGrade(submissionId, studentId, btnElement) {
        const scoreInput = document.getElementById(`score_${submissionId}`);
        const feedbackInput = document.getElementById(`feedback_${submissionId}`);

        const scoreVal = scoreInput?.value;
        const feedbackVal = feedbackInput?.value.trim();

        if (scoreVal === '' || isNaN(scoreVal)) {
            showAlert('⚠️ Please enter a valid score', 'error');
            return;
        }

        const score = parseFloat(scoreVal);
        const maxPts = currentViewingAssessment?.total_points || 100;

        if (score < 0 || score > maxPts) {
            showAlert(`⚠️ Score must be between 0 and ${maxPts}`, 'error');
            return;
        }

        btnElement.disabled = true;
        btnElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        try {
            const { error } = await supabase
                .from('assessment_submissions')
                .update({
                    score: score,
                    feedback: feedbackVal || null,
                    status: 'graded',
                    graded_at: new Date().toISOString(),
                    graded_by: displayName,
                    updated_at: new Date().toISOString()
                })
                .eq('id', submissionId);

            if (error) throw error;

            // Notify Student that their assessment has been graded
            if (studentId) {
                await supabase.from('notifications').insert([{
                    user_id: studentId,
                    role: 'student',
                    title: `Assessment Graded: ${currentViewingAssessment.title}`,
                    message: `Teacher ${displayName} graded your assessment. Score: ${score}/${maxPts}. Feedback: ${feedbackVal || 'Completed'}`,
                    type: 'grade',
                    read: false,
                    is_read: false,
                    created_at: new Date().toISOString()
                }]);
            }

            showAlert(`✅ Grade of ${score}/${maxPts} returned to student!`, 'success');

            // Refresh data in memory
            const { data: updatedSubs } = await supabase
                .from('assessment_submissions')
                .select('*')
                .eq('assessment_id', currentViewingAssessment.id);

            if (updatedSubs) {
                submissionsMap[currentViewingAssessment.id] = updatedSubs;
            }

            updateDashboardKPIs();
            renderSubmissionsTable();
            renderAssessmentsList();

        } catch(err) {
            console.error('Grading error:', err);
            showAlert('❌ Failed to save grade: ' + err.message, 'error');
            btnElement.disabled = false;
            btnElement.innerHTML = '<i class="fas fa-save"></i> Return Grade';
        }
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================
    function setupEventListeners() {
        // Modal Open / Close
        if (btnOpenCreateModal) btnOpenCreateModal.addEventListener('click', openCreateModal);
        if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
        if (btnCancelModal) btnCancelModal.addEventListener('click', closeModal);
        if (btnCloseSubsModal) btnCloseSubsModal.addEventListener('click', closeSubmissionsModal);

        // Form Submit
        if (assessmentForm) assessmentForm.addEventListener('submit', handleSaveAssessment);

        // File selection label & dropzone drag-and-drop
        if (fileInput) {
            fileInput.addEventListener('change', function() {
                if (this.files && this.files.length > 0) {
                    if (fileSelectedLabel) {
                        fileSelectedLabel.textContent = this.files[0].name;
                        const pill = fileSelectedLabel.closest('.dropzone-file-pill');
                        if (pill) pill.classList.add('has-file');
                    }
                }
            });
        }

        const dropzone = document.querySelector('.file-upload-dropzone');
        if (dropzone && fileInput) {
            ['dragenter', 'dragover'].forEach(eventName => {
                dropzone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropzone.classList.add('drag-over');
                });
            });
            ['dragleave', 'drop'].forEach(eventName => {
                dropzone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropzone.classList.remove('drag-over');
                });
            });
            dropzone.addEventListener('drop', (e) => {
                const files = e.dataTransfer?.files;
                if (files && files.length > 0) {
                    fileInput.files = files;
                    if (fileSelectedLabel) {
                        fileSelectedLabel.textContent = files[0].name;
                        const pill = fileSelectedLabel.closest('.dropzone-file-pill');
                        if (pill) pill.classList.add('has-file');
                    }
                }
            });
        }

        // Filters
        if (searchAssessmentInput) searchAssessmentInput.addEventListener('input', renderAssessmentsList);
        if (filterSectionSelect) filterSectionSelect.addEventListener('change', renderAssessmentsList);
        if (filterSubjectSelect) filterSubjectSelect.addEventListener('change', renderAssessmentsList);
        if (filterTypeSelect) filterTypeSelect.addEventListener('change', renderAssessmentsList);
        if (filterStatusSelect) filterStatusSelect.addEventListener('change', renderAssessmentsList);

        if (subsFilterSelect) subsFilterSelect.addEventListener('change', renderSubmissionsTable);

        // Close on backdrop click
        if (assessmentModal) {
            assessmentModal.addEventListener('click', function(e) {
                if (e.target === assessmentModal) closeModal();
            });
        }

        if (submissionsModal) {
            submissionsModal.addEventListener('click', function(e) {
                if (e.target === submissionsModal) closeSubmissionsModal();
            });
        }
    }

    // ============================================
    // UTILITIES
    // ============================================
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
