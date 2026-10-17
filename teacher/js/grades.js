/**
 * Teacher Grade Management & Automatic Calculation Engine
 * HES - Placido L. Señor National High School
 * Powered by Supabase
 */

import { supabase } from '../../supabase/config.js';

(function() {
    'use strict';

    console.log('📊 Teacher Grade Management & Auto-Calculation Engine initialized');

    // ============================================
    // OFFICIAL DEPED TRANSMUTATION TABLE (DepEd Order No. 8, s. 2015)
    // ============================================
    const DEPED_TRANSMUTATION_TABLE = [
        { min: 100.00, max: 100.00, grade: 100 },
        { min: 98.40, max: 99.99, grade: 99 },
        { min: 96.80, max: 98.39, grade: 98 },
        { min: 95.20, max: 96.79, grade: 97 },
        { min: 93.60, max: 95.19, grade: 96 },
        { min: 92.00, max: 93.59, grade: 95 },
        { min: 90.40, max: 91.99, grade: 94 },
        { min: 88.80, max: 90.39, grade: 93 },
        { min: 87.20, max: 88.79, grade: 92 },
        { min: 85.60, max: 87.19, grade: 91 },
        { min: 84.00, max: 85.59, grade: 90 },
        { min: 82.40, max: 83.99, grade: 89 },
        { min: 80.80, max: 82.39, grade: 88 },
        { min: 79.20, max: 80.79, grade: 87 },
        { min: 77.60, max: 79.19, grade: 86 },
        { min: 76.00, max: 77.59, grade: 85 },
        { min: 74.40, max: 75.99, grade: 84 },
        { min: 72.80, max: 74.39, grade: 83 },
        { min: 71.20, max: 72.79, grade: 82 },
        { min: 69.60, max: 71.19, grade: 81 },
        { min: 68.00, max: 69.59, grade: 80 },
        { min: 66.40, max: 67.99, grade: 79 },
        { min: 64.80, max: 66.39, grade: 78 },
        { min: 63.20, max: 64.79, grade: 77 },
        { min: 61.60, max: 63.19, grade: 76 },
        { min: 60.00, max: 61.59, grade: 75 }, // Passing benchmark
        { min: 56.00, max: 59.99, grade: 74 },
        { min: 52.00, max: 55.99, grade: 73 },
        { min: 48.00, max: 51.99, grade: 72 },
        { min: 44.00, max: 47.99, grade: 71 },
        { min: 40.00, max: 43.99, grade: 70 },
        { min: 36.00, max: 39.99, grade: 69 },
        { min: 32.00, max: 35.99, grade: 68 },
        { min: 28.00, max: 31.99, grade: 67 },
        { min: 24.00, max: 27.99, grade: 66 },
        { min: 20.00, max: 23.99, grade: 65 },
        { min: 16.00, max: 19.99, grade: 64 },
        { min: 12.00, max: 15.99, grade: 63 },
        { min: 8.00,  max: 11.99, grade: 62 },
        { min: 4.00,  max: 7.99,  grade: 61 },
        { min: 0.00,  max: 3.99,  grade: 60 }
    ];

    function transmuteScore(rawScore) {
        if (isNaN(rawScore) || rawScore === null) return null;
        const clamped = Math.max(0, Math.min(100, parseFloat(rawScore)));
        for (const bracket of DEPED_TRANSMUTATION_TABLE) {
            if (clamped >= bracket.min && clamped <= bracket.max) {
                return bracket.grade;
            }
        }
        return clamped >= 60 ? 75 : 60;
    }

    function getDescriptor(grade) {
        if (!grade || isNaN(grade)) return '—';
        const num = parseFloat(grade);
        if (num >= 90) return 'Outstanding';
        if (num >= 85) return 'Very Satisfactory';
        if (num >= 80) return 'Satisfactory';
        if (num >= 75) return 'Fairly Satisfactory';
        return 'Did Not Meet Expectations';
    }

    // ============================================
    // DOM ELEMENTS
    // ============================================
    const teacherName = document.getElementById('teacherName');
    const teacherInitial = document.getElementById('teacherInitial');
    const logoutBtn = document.getElementById('logoutBtn');
    const alertContainer = document.getElementById('alertContainer');
    const dateBadge = document.querySelector('.date-badge');

    // Quick Stats
    const totalClasses = document.getElementById('totalClasses');
    const totalSubjects = document.getElementById('totalSubjects');
    const totalStudents = document.getElementById('totalStudents');
    const gradedCount = document.getElementById('gradedCount');

    // Filters
    const filterForm = document.getElementById('filterForm');
    const sectionSelect = document.getElementById('section_id');
    const subjectSelect = document.getElementById('subject_id');
    const quarterSelect = document.getElementById('quarter');
    const schoolYearSelect = document.getElementById('school_year');
    const loadStudentsBtn = document.getElementById('loadStudentsBtn');

    // Grading Workspace Containers
    const gradingWorkspace = document.getElementById('gradingWorkspace');
    const emptyPlaceholderCard = document.getElementById('emptyPlaceholderCard');
    const weightsToolbar = document.getElementById('weightsToolbar');
    const tabComponentMode = document.getElementById('tabComponentMode');
    const tabQuarterMode = document.getElementById('tabQuarterMode');
    const formulaText = document.getElementById('formulaText');

    // Weights Inputs
    const weightWWInput = document.getElementById('weightWW');
    const weightPTInput = document.getElementById('weightPT');
    const weightQAInput = document.getElementById('weightQA');
    const transmuteCheckbox = document.getElementById('transmuteCheckbox');

    // Live Statistics Panel
    const statClassAverage = document.getElementById('statClassAverage');
    const statHighest = document.getElementById('statHighest');
    const statLowest = document.getElementById('statLowest');
    const statPassedCount = document.getElementById('statPassedCount');
    const statFailedCount = document.getElementById('statFailedCount');
    const statPassingRate = document.getElementById('statPassingRate');

    // Table & Form
    const gradesForm = document.getElementById('gradesForm');
    const gradeTableHead = document.getElementById('gradeTableHead');
    const gradeTableBody = document.getElementById('gradeTableBody');
    const saveGradesBtn = document.getElementById('saveGradesBtn');
    const tableTitleHeader = document.getElementById('tableTitleHeader');
    const quarterBadge = document.getElementById('quarterBadge');
    const sectionBadge = document.getElementById('sectionBadge');
    const tableSubtitle = document.getElementById('tableSubtitle');

    // Hidden form fields
    const formSectionId = document.getElementById('formSectionId');
    const formSubjectId = document.getElementById('formSubjectId');
    const formQuarter = document.getElementById('formQuarter');
    const formSchoolYear = document.getElementById('formSchoolYear');

    // ============================================
    // STATE
    // ============================================
    let sessionUser = null;
    let teacherRecord = null;
    let allSections = [];
    let allSubjects = [];
    let teacherSchedules = [];
    let assignedSections = [];
    let assignedSubjectsMap = {}; // sectionId -> array of subjects

    let selectedSectionId = '';
    let selectedSubjectId = '';
    let selectedQuarter = '1';
    let selectedSchoolYear = '2025-2026';

    let currentGradingMode = 'components'; // 'components' | 'quarters'
    let weightWW = 30;
    let weightPT = 50;
    let weightQA = 20;
    let useTransmutation = true;

    let studentsList = []; // Array of enrolled student objects
    let existingGradesMap = {}; // studentId_quarter -> grade record
    let studentScoresCache = {}; // studentId -> { ww, pt, qa, q1, q2, q3, q4, computedGrade, remarks }

    // ============================================
    // INITIALIZATION & SESSION
    // ============================================
    document.addEventListener('DOMContentLoaded', async function() {
        initDateBadge();
        if (!initAuth()) return;
        await loadTeacherContext();
        setupFilterListeners();
        setupKeyboardNavigation();
    });

    function initDateBadge() {
        if (!dateBadge) return;
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateBadge.innerHTML = `<i class="fas fa-calendar-alt"></i> ${now.toLocaleDateString('en-US', options)}`;
    }

    function initAuth() {
        try {
            const stored = localStorage.getItem('currentUser');
            if (stored) sessionUser = JSON.parse(stored);
        } catch (e) {
            console.error('Session parse error:', e);
        }

        if (!sessionUser) {
            console.warn('⚠️ No active teacher session, redirecting...');
            window.location.replace('../auth/login.html');
            return false;
        }

        const role = (sessionUser.role || '').toLowerCase();
        if (role !== 'teacher' && role !== 'admin') {
            const routes = {
                'student': '../student/dashboard.html',
                'parent': '../parents/dashboard.html',
                'registrar': '../registrar/dashboard.html'
            };
            window.location.replace(routes[role] || '../auth/login.html');
            return false;
        }

        const displayName = sessionUser.name || sessionUser.displayName || 
            `${sessionUser.firstName || sessionUser.first_name || ''} ${sessionUser.lastName || sessionUser.last_name || ''}`.trim() || 
            (sessionUser.email ? sessionUser.email.split('@')[0] : 'Teacher');

        if (teacherName) teacherName.textContent = displayName;
        if (teacherInitial) teacherInitial.textContent = displayName.charAt(0).toUpperCase();

        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.removeItem('currentUser');
                localStorage.removeItem('hes_teacher_avatar');
                localStorage.removeItem('hes_teacher_name');
                window.location.replace('../auth/login.html');
            });
        }

        return true;
    }

    // ============================================
    // LOAD TEACHER CONTEXT & SCHEDULES
    // ============================================
    async function loadTeacherContext() {
        try {
            // 1. Fetch teacher record
            const targetUserId = sessionUser.id || sessionUser.uid;
            if (targetUserId) {
                const { data: tData } = await supabase
                    .from('teachers')
                    .select('*')
                    .or(`user_id.eq.${targetUserId},id.eq.${targetUserId}`)
                    .maybeSingle();

                if (tData) {
                    teacherRecord = tData;
                    console.log('👨‍🏫 Teacher record loaded:', teacherRecord.id);
                }
            }

            // 2. Fetch all sections & subjects in parallel
            const [sectionsRes, subjectsRes] = await Promise.all([
                supabase.from('sections').select('*').order('grade_level', { ascending: true }),
                supabase.from('subjects').select('*').order('grade_level', { ascending: true })
            ]);

            allSections = sectionsRes.data || [];
            allSubjects = subjectsRes.data || [];

            // 3. Fetch schedules for this teacher
            const teacherId = teacherRecord?.id || targetUserId;
            if (teacherId) {
                const { data: schedRows } = await supabase
                    .from('schedules')
                    .select('*')
                    .or(`teacher_id.eq.${teacherId},teacher_id.eq.${targetUserId}`);

                teacherSchedules = schedRows || [];
            }

            // Map assigned sections and subjects
            const assignedSecIds = new Set();
            assignedSubjectsMap = {};

            teacherSchedules.forEach(sched => {
                if (sched.section_id) {
                    assignedSecIds.add(sched.section_id);
                    if (sched.subject_id) {
                        if (!assignedSubjectsMap[sched.section_id]) {
                            assignedSubjectsMap[sched.section_id] = [];
                        }
                        if (!assignedSubjectsMap[sched.section_id].includes(sched.subject_id)) {
                            assignedSubjectsMap[sched.section_id].push(sched.subject_id);
                        }
                    }
                }
            });

            // If teacher has assigned sections in schedules, use them; otherwise, fallback to all sections
            if (assignedSecIds.size > 0) {
                assignedSections = allSections.filter(sec => assignedSecIds.has(sec.id));
            } else {
                assignedSections = allSections;
            }

            // Update top stats
            if (totalClasses) totalClasses.textContent = assignedSections.length;
            if (totalSubjects) {
                const uniqueSubIds = new Set(teacherSchedules.map(s => s.subject_id).filter(Boolean));
                totalSubjects.textContent = uniqueSubIds.size > 0 ? uniqueSubIds.size : allSubjects.length;
            }

            // Populate dropdowns
            populateSectionDropdown();

        } catch (error) {
            console.error('Error loading teacher context:', error);
            showAlert('error', 'Failed to load teacher schedules: ' + error.message);
        }
    }

    function populateSectionDropdown() {
        if (!sectionSelect) return;

        sectionSelect.innerHTML = '<option value="">Select Section / Class</option>';
        assignedSections.forEach(sec => {
            const opt = document.createElement('option');
            opt.value = sec.id;
            const strandText = sec.strand ? ` (${sec.strand})` : '';
            opt.textContent = `${sec.grade_level ? sec.grade_level + ' - ' : ''}${sec.name}${strandText}`;
            sectionSelect.appendChild(opt);
        });

        // If at least one section exists, auto-select first one to make it fast
        if (assignedSections.length > 0) {
            sectionSelect.value = assignedSections[0].id;
            selectedSectionId = assignedSections[0].id;
            populateSubjectDropdown(selectedSectionId);
        }
    }

    function populateSubjectDropdown(sectionId) {
        if (!subjectSelect) return;

        subjectSelect.innerHTML = '<option value="">Select Subject</option>';
        if (!sectionId) return;

        let availableSubjectIds = assignedSubjectsMap[sectionId] || [];
        let filteredSubjects = [];

        if (availableSubjectIds.length > 0) {
            filteredSubjects = allSubjects.filter(sub => availableSubjectIds.includes(sub.id));
        }

        // If no subjects specifically filtered for this section, display all subjects matching section's grade level or all
        if (filteredSubjects.length === 0) {
            const secObj = allSections.find(s => s.id === sectionId);
            if (secObj && secObj.grade_level) {
                filteredSubjects = allSubjects.filter(s => {
                    return !s.grade_level || s.grade_level.includes(secObj.grade_level) || secObj.grade_level.includes(s.grade_level);
                });
            }
            if (filteredSubjects.length === 0) {
                filteredSubjects = allSubjects;
            }
        }

        filteredSubjects.forEach(sub => {
            const opt = document.createElement('option');
            opt.value = sub.id;
            opt.textContent = `${sub.name} ${sub.code ? `(${sub.code})` : ''}`;
            subjectSelect.appendChild(opt);
        });

        if (filteredSubjects.length > 0) {
            subjectSelect.value = filteredSubjects[0].id;
            selectedSubjectId = filteredSubjects[0].id;
        }
    }

    function setupFilterListeners() {
        if (sectionSelect) {
            sectionSelect.addEventListener('change', function() {
                selectedSectionId = this.value;
                populateSubjectDropdown(selectedSectionId);
            });
        }

        if (filterForm) {
            filterForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                selectedSectionId = sectionSelect.value;
                selectedSubjectId = subjectSelect.value;
                selectedQuarter = quarterSelect.value;
                selectedSchoolYear = schoolYearSelect.value;

                if (!selectedSectionId || !selectedSubjectId) {
                    showAlert('warning', 'Please select both Section and Subject to load grades.');
                    return;
                }

                await loadRosterAndGrades();
            });
        }

        if (quarterSelect) {
            quarterSelect.addEventListener('change', function() {
                selectedQuarter = this.value;
                if (formQuarter) formQuarter.value = this.value;
                if (quarterBadge) quarterBadge.textContent = `${this.value}${getOrdinalSuffix(this.value)} Quarter`;
                if (studentsList.length > 0) {
                    loadExistingGrades().then(() => renderGradesTable());
                }
            });
        }

        if (schoolYearSelect) {
            schoolYearSelect.addEventListener('change', function() {
                selectedSchoolYear = this.value;
                if (formSchoolYear) formSchoolYear.value = this.value;
                if (studentsList.length > 0) {
                    loadExistingGrades().then(() => renderGradesTable());
                }
            });
        }
    }

    function getOrdinalSuffix(numStr) {
        const n = parseInt(numStr);
        if (n === 1) return 'st';
        if (n === 2) return 'nd';
        if (n === 3) return 'rd';
        return 'th';
    }

    // ============================================
    // LOAD ROSTER & EXISTING GRADES FROM SUPABASE
    // ============================================
    async function loadRosterAndGrades() {
        if (loadStudentsBtn) {
            loadStudentsBtn.disabled = true;
            loadStudentsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        }

        try {
            // Update hidden inputs
            if (formSectionId) formSectionId.value = selectedSectionId;
            if (formSubjectId) formSubjectId.value = selectedSubjectId;
            if (formQuarter) formQuarter.value = selectedQuarter;
            if (formSchoolYear) formSchoolYear.value = selectedSchoolYear;

            // Update badge labels
            const secObj = allSections.find(s => s.id === selectedSectionId);
            const subObj = allSubjects.find(s => s.id === selectedSubjectId);
            if (sectionBadge) sectionBadge.textContent = secObj ? secObj.name : 'Selected Section';
            if (quarterBadge) quarterBadge.textContent = `${selectedQuarter}${getOrdinalSuffix(selectedQuarter)} Quarter`;

            // 1. Fetch Students matching this section
            const { data: secStudents, error: stuErr } = await supabase
                .from('students')
                .select('*')
                .eq('section_id', selectedSectionId)
                .order('last_name', { ascending: true });

            if (stuErr) throw stuErr;

            let loadedStudents = secStudents || [];

            // If no students assigned specifically to this section yet, query all active enrolled students as fallback
            if (loadedStudents.length === 0) {
                const { data: allActiveStudents } = await supabase
                    .from('students')
                    .select('*')
                    .order('last_name', { ascending: true })
                    .limit(30);

                if (allActiveStudents && allActiveStudents.length > 0) {
                    loadedStudents = allActiveStudents;
                }
            }

            studentsList = loadedStudents;
            if (totalStudents) totalStudents.textContent = studentsList.length;

            // 2. Fetch Existing Grades for this class & subject
            await loadExistingGrades();

            // 3. Initialize student score cache
            initScoresCache();

            // 4. Show workspace & render table
            if (emptyPlaceholderCard) emptyPlaceholderCard.style.display = 'none';
            if (gradingWorkspace) gradingWorkspace.style.display = 'block';

            renderGradesTable();
            updateLiveClassStats();

            showAlert('success', `Loaded ${studentsList.length} students for ${subObj?.name || 'Subject'}.`);

        } catch (error) {
            console.error('Error loading roster and grades:', error);
            showAlert('error', 'Error loading class data: ' + error.message);
        } finally {
            if (loadStudentsBtn) {
                loadStudentsBtn.disabled = false;
                loadStudentsBtn.innerHTML = '<i class="fas fa-search"></i> Load Class Roster';
            }
        }
    }

    async function loadExistingGrades() {
        existingGradesMap = {};
        if (!selectedSubjectId || studentsList.length === 0) return;

        try {
            const studentIds = studentsList.map(s => s.id);
            const { data: gradesData, error } = await supabase
                .from('grades')
                .select('*')
                .eq('subject_id', selectedSubjectId)
                .eq('school_year', selectedSchoolYear)
                .in('student_id', studentIds);

            if (!error && gradesData) {
                gradesData.forEach(row => {
                    const key = `${row.student_id}_q${row.quarter}`;
                    existingGradesMap[key] = row;
                });
            }
        } catch (e) {
            console.warn('Existing grades fetch warning:', e);
        }
    }

    function initScoresCache() {
        studentScoresCache = {};
        studentsList.forEach(student => {
            const q1Rec = existingGradesMap[`${student.id}_q1`];
            const q2Rec = existingGradesMap[`${student.id}_q2`];
            const q3Rec = existingGradesMap[`${student.id}_q3`];
            const q4Rec = existingGradesMap[`${student.id}_q4`];
            const currentQuarterRec = existingGradesMap[`${student.id}_q${selectedQuarter}`];

            const baseGrade = currentQuarterRec ? parseFloat(currentQuarterRec.grade) : null;

            studentScoresCache[student.id] = {
                ww: baseGrade !== null ? Math.min(100, Math.round(baseGrade)) : '',
                pt: baseGrade !== null ? Math.min(100, Math.round(baseGrade)) : '',
                qa: baseGrade !== null ? Math.min(100, Math.round(baseGrade)) : '',
                q1: q1Rec ? q1Rec.grade : '',
                q2: q2Rec ? q2Rec.grade : '',
                q3: q3Rec ? q3Rec.grade : '',
                q4: q4Rec ? q4Rec.grade : '',
                computedGrade: baseGrade !== null ? baseGrade : null,
                remarks: currentQuarterRec?.remarks || (baseGrade !== null ? (baseGrade >= 75 ? 'Passed' : 'Failed') : '')
            };
        });
    }

    // ============================================
    // RENDER GRADES TABLE (COMPONENTS VS QUARTERS)
    // ============================================
    function renderGradesTable() {
        if (!gradeTableHead || !gradeTableBody) return;

        if (studentsList.length === 0) {
            gradeTableHead.innerHTML = '';
            gradeTableBody.innerHTML = `
                <tr>
                    <td colspan="7">
                        <div class="no-data">
                            <i class="fas fa-users-slash"></i>
                            <h3>No Students Found</h3>
                            <p>No students enrolled in this section yet. You can enroll students in the Admin or Registrar portal.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        if (currentGradingMode === 'components') {
            renderComponentTable();
        } else {
            renderQuarterTable();
        }
    }

    function renderComponentTable() {
        gradeTableHead.innerHTML = `
            <tr>
                <th style="width: 40px;" class="center-col">#</th>
                <th>Student Information</th>
                <th style="width: 110px;" class="center-col">WW (${weightWW}%)</th>
                <th style="width: 110px;" class="center-col">PT (${weightPT}%)</th>
                <th style="width: 110px;" class="center-col">QA (${weightQA}%)</th>
                <th style="width: 130px;" class="center-col">
                    <i class="fas fa-magic" style="color: #f59e0b; margin-right: 4px;"></i>
                    Computed Grade
                </th>
                <th style="width: 130px;" class="center-col">Remarks</th>
            </tr>
        `;

        gradeTableBody.innerHTML = studentsList.map((student, idx) => {
            const cache = studentScoresCache[student.id] || {};
            const initial = student.first_name ? student.first_name.charAt(0).toUpperCase() : 'S';
            const fullName = `${student.last_name || ''}, ${student.first_name || ''} ${student.middle_name ? student.middle_name.charAt(0) + '.' : ''}`.trim() || 'Student Name';
            const lrn = student.lrn || 'LRN: Pending';

            const compGrade = cache.computedGrade;
            const hasGrade = compGrade !== null && compGrade !== '' && !isNaN(compGrade);
            const isPassing = hasGrade && parseFloat(compGrade) >= 75;
            const gradePillClass = hasGrade ? (isPassing ? 'passing-pill' : 'failing-pill') : 'empty-pill';
            const displayGrade = hasGrade ? parseFloat(compGrade).toFixed(2) : '—';

            const remarksBadge = hasGrade 
                ? (isPassing ? '<span class="badge-status badge-passed"><i class="fas fa-check"></i> Passed</span>' 
                            : '<span class="badge-status badge-failed"><i class="fas fa-times"></i> Failed</span>')
                : '<span class="badge-status badge-none">—</span>';

            const descriptor = hasGrade ? `<span class="badge-descriptor">${getDescriptor(compGrade)}</span>` : '';

            return `
                <tr data-student-id="${student.id}" class="grade-row">
                    <td class="row-index">${idx + 1}</td>
                    <td>
                        <div class="student-info">
                            ${student.avatar_url ? `
                                <div class="student-avatar-img">
                                    <img src="${student.avatar_url}" alt="${fullName}" onerror="this.onerror=null;this.parentElement.className='student-avatar';this.parentElement.textContent='${initial}';">
                                </div>
                            ` : `
                                <div class="student-avatar">${initial}</div>
                            `}
                            <div class="student-details">
                                <h4>${fullName}</h4>
                                <div class="student-meta">
                                    <span><i class="fas fa-id-card"></i> ${lrn}</span>
                                    <span><i class="fas fa-venus-mars"></i> ${student.gender || 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                    </td>
                    <td class="center-col">
                        <input type="number" 
                               class="score-input comp-ww" 
                               data-student-id="${student.id}"
                               data-type="ww"
                               value="${cache.ww ?? ''}"
                               min="0" max="100" step="any"
                               placeholder="0-100">
                    </td>
                    <td class="center-col">
                        <input type="number" 
                               class="score-input comp-pt" 
                               data-student-id="${student.id}"
                               data-type="pt"
                               value="${cache.pt ?? ''}"
                               min="0" max="100" step="any"
                               placeholder="0-100">
                    </td>
                    <td class="center-col">
                        <input type="number" 
                               class="score-input comp-qa" 
                               data-student-id="${student.id}"
                               data-type="qa"
                               value="${cache.qa ?? ''}"
                               min="0" max="100" step="any"
                               placeholder="0-100">
                    </td>
                    <td class="center-col computed-grade-cell">
                        <div class="computed-grade-pill ${gradePillClass}" id="computedPill_${student.id}">
                            ${displayGrade}
                        </div>
                    </td>
                    <td class="center-col" id="remarksCell_${student.id}">
                        ${remarksBadge}
                        ${descriptor}
                    </td>
                </tr>
            `;
        }).join('');

        attachInputListeners();
    }

    function renderQuarterTable() {
        gradeTableHead.innerHTML = `
            <tr>
                <th style="width: 40px;" class="center-col">#</th>
                <th>Student Information</th>
                <th style="width: 95px;" class="center-col">Q1</th>
                <th style="width: 95px;" class="center-col">Q2</th>
                <th style="width: 95px;" class="center-col">Q3</th>
                <th style="width: 95px;" class="center-col">Q4</th>
                <th style="width: 130px;" class="center-col">
                    <i class="fas fa-magic" style="color: #f59e0b; margin-right: 4px;"></i>
                    Final Rating
                </th>
                <th style="width: 130px;" class="center-col">Remarks</th>
            </tr>
        `;

        gradeTableBody.innerHTML = studentsList.map((student, idx) => {
            const cache = studentScoresCache[student.id] || {};
            const initial = student.first_name ? student.first_name.charAt(0).toUpperCase() : 'S';
            const fullName = `${student.last_name || ''}, ${student.first_name || ''} ${student.middle_name ? student.middle_name.charAt(0) + '.' : ''}`.trim() || 'Student Name';
            const lrn = student.lrn || 'LRN: Pending';

            const quarters = [cache.q1, cache.q2, cache.q3, cache.q4].map(v => parseFloat(v)).filter(v => !isNaN(v));
            const hasFinal = quarters.length > 0;
            const finalRating = hasFinal ? (quarters.reduce((a, b) => a + b, 0) / quarters.length) : null;
            const isPassing = hasFinal && finalRating >= 75;
            const gradePillClass = hasFinal ? (isPassing ? 'passing-pill' : 'failing-pill') : 'empty-pill';
            const displayRating = hasFinal ? finalRating.toFixed(2) : '—';

            const remarksBadge = hasFinal 
                ? (isPassing ? '<span class="badge-status badge-passed"><i class="fas fa-check"></i> Passed</span>' 
                            : '<span class="badge-status badge-failed"><i class="fas fa-times"></i> Failed</span>')
                : '<span class="badge-status badge-none">—</span>';

            const descriptor = hasFinal ? `<span class="badge-descriptor">${getDescriptor(finalRating)}</span>` : '';

            return `
                <tr data-student-id="${student.id}" class="grade-row">
                    <td class="row-index">${idx + 1}</td>
                    <td>
                        <div class="student-info">
                            ${student.avatar_url ? `
                                <div class="student-avatar-img">
                                    <img src="${student.avatar_url}" alt="${fullName}" onerror="this.onerror=null;this.parentElement.className='student-avatar';this.parentElement.textContent='${initial}';">
                                </div>
                            ` : `
                                <div class="student-avatar">${initial}</div>
                            `}
                            <div class="student-details">
                                <h4>${fullName}</h4>
                                <div class="student-meta">
                                    <span><i class="fas fa-id-card"></i> ${lrn}</span>
                                    <span><i class="fas fa-venus-mars"></i> ${student.gender || 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                    </td>
                    <td class="center-col">
                        <input type="number" class="score-input quarter-q1" data-student-id="${student.id}" data-type="q1" value="${cache.q1 ?? ''}" min="0" max="100" step="any" placeholder="—">
                    </td>
                    <td class="center-col">
                        <input type="number" class="score-input quarter-q2" data-student-id="${student.id}" data-type="q2" value="${cache.q2 ?? ''}" min="0" max="100" step="any" placeholder="—">
                    </td>
                    <td class="center-col">
                        <input type="number" class="score-input quarter-q3" data-student-id="${student.id}" data-type="q3" value="${cache.q3 ?? ''}" min="0" max="100" step="any" placeholder="—">
                    </td>
                    <td class="center-col">
                        <input type="number" class="score-input quarter-q4" data-student-id="${student.id}" data-type="q4" value="${cache.q4 ?? ''}" min="0" max="100" step="any" placeholder="—">
                    </td>
                    <td class="center-col computed-grade-cell">
                        <div class="computed-grade-pill ${gradePillClass}" id="computedPill_${student.id}">
                            ${displayRating}
                        </div>
                    </td>
                    <td class="center-col" id="remarksCell_${student.id}">
                        ${remarksBadge}
                        ${descriptor}
                    </td>
                </tr>
            `;
        }).join('');

        attachInputListeners();
    }

    // ============================================
    // REAL-TIME AUTO CALCULATION CORE
    // ============================================
    function attachInputListeners() {
        const inputs = document.querySelectorAll('.score-input');
        inputs.forEach(input => {
            input.addEventListener('input', function() {
                const studentId = this.dataset.studentId;
                const type = this.dataset.type;
                const value = this.value.trim();

                // Validate range 0-100
                if (value !== '') {
                    const num = parseFloat(value);
                    if (num < 0) this.value = 0;
                    if (num > 100) this.value = 100;
                    
                    if (num >= 75) {
                        this.classList.add('passing');
                        this.classList.remove('failing');
                    } else {
                        this.classList.add('failing');
                        this.classList.remove('passing');
                    }
                } else {
                    this.classList.remove('passing', 'failing');
                }

                // Update cache
                if (!studentScoresCache[studentId]) {
                    studentScoresCache[studentId] = {};
                }
                studentScoresCache[studentId][type] = value;

                // Run instant automatic calculation for this student
                calculateStudentGrade(studentId);

                // Update overall class live analytics
                updateLiveClassStats();
            });
        });
    }

    function calculateStudentGrade(studentId) {
        const cache = studentScoresCache[studentId];
        if (!cache) return;

        const pill = document.getElementById(`computedPill_${studentId}`);
        const remarksCell = document.getElementById(`remarksCell_${studentId}`);
        if (!pill || !remarksCell) return;

        let computedResult = null;

        if (currentGradingMode === 'components') {
            const rawWW = parseFloat(cache.ww);
            const rawPT = parseFloat(cache.pt);
            const rawQA = parseFloat(cache.qa);

            const hasWW = !isNaN(rawWW);
            const hasPT = !isNaN(rawPT);
            const hasQA = !isNaN(rawQA);

            if (hasWW || hasPT || hasQA) {
                // Weighted raw score calculation
                const totalWeight = (hasWW ? weightWW : 0) + (hasPT ? weightPT : 0) + (hasQA ? weightQA : 0);
                if (totalWeight > 0) {
                    const weightedSum = (hasWW ? rawWW * (weightWW / 100) : 0) +
                                      (hasPT ? rawPT * (weightPT / 100) : 0) +
                                      (hasQA ? rawQA * (weightQA / 100) : 0);

                    const normalizedRaw = (weightedSum / (totalWeight / 100));

                    if (useTransmutation) {
                        computedResult = transmuteScore(normalizedRaw);
                    } else {
                        computedResult = parseFloat(normalizedRaw.toFixed(2));
                    }
                }
            }
        } else {
            // 4-Quarter Final Rating Mode
            const quarters = [cache.q1, cache.q2, cache.q3, cache.q4]
                .map(v => parseFloat(v))
                .filter(v => !isNaN(v));

            if (quarters.length > 0) {
                const avg = quarters.reduce((a, b) => a + b, 0) / quarters.length;
                computedResult = parseFloat(avg.toFixed(2));
            }
        }

        cache.computedGrade = computedResult;

        // UI Update with Animation
        if (computedResult !== null) {
            const isPassing = computedResult >= 75;
            cache.remarks = isPassing ? 'Passed' : 'Failed';

            pill.textContent = computedResult.toFixed(2);
            pill.className = `computed-grade-pill ${isPassing ? 'passing-pill' : 'failing-pill'} grade-pulse`;
            setTimeout(() => pill.classList.remove('grade-pulse'), 400);

            remarksCell.innerHTML = `
                <span class="badge-status ${isPassing ? 'badge-passed' : 'badge-failed'}">
                    <i class="fas fa-${isPassing ? 'check' : 'times'}"></i> ${cache.remarks}
                </span>
                <span class="badge-descriptor">${getDescriptor(computedResult)}</span>
            `;
        } else {
            cache.remarks = '';
            pill.textContent = '—';
            pill.className = 'computed-grade-pill empty-pill';
            remarksCell.innerHTML = '<span class="badge-status badge-none">—</span>';
        }
    }

    // ============================================
    // LIVE CLASS STATISTICS ANALYTICS
    // ============================================
    function updateLiveClassStats() {
        const validGrades = [];
        let passed = 0;
        let failed = 0;

        Object.values(studentScoresCache).forEach(cache => {
            if (cache.computedGrade !== null && cache.computedGrade !== '' && !isNaN(cache.computedGrade)) {
                const val = parseFloat(cache.computedGrade);
                validGrades.push(val);
                if (val >= 75) passed++;
                else failed++;
            }
        });

        if (gradedCount) gradedCount.textContent = validGrades.length;

        if (validGrades.length === 0) {
            if (statClassAverage) statClassAverage.textContent = '—';
            if (statHighest) statHighest.textContent = '—';
            if (statLowest) statLowest.textContent = '—';
            if (statPassedCount) statPassedCount.textContent = '0';
            if (statFailedCount) statFailedCount.textContent = '0';
            if (statPassingRate) statPassingRate.textContent = '0%';
            return;
        }

        const avg = validGrades.reduce((a, b) => a + b, 0) / validGrades.length;
        const highest = Math.max(...validGrades);
        const lowest = Math.min(...validGrades);
        const passRate = ((passed / validGrades.length) * 100).toFixed(1);

        if (statClassAverage) statClassAverage.textContent = avg.toFixed(2);
        if (statHighest) statHighest.textContent = highest.toFixed(2);
        if (statLowest) statLowest.textContent = lowest.toFixed(2);
        if (statPassedCount) statPassedCount.textContent = passed;
        if (statFailedCount) statFailedCount.textContent = failed;
        if (statPassingRate) statPassingRate.textContent = `${passRate}%`;
    }

    // ============================================
    // KEYBOARD NAVIGATION (Enter / Arrow Down / Arrow Up)
    // ============================================
    function setupKeyboardNavigation() {
        document.addEventListener('keydown', function(e) {
            const active = document.activeElement;
            if (!active || !active.classList.contains('score-input')) return;

            const currentType = active.dataset.type;
            const row = active.closest('tr');
            if (!row) return;

            if (e.key === 'Enter' || e.key === 'ArrowDown') {
                e.preventDefault();
                const nextRow = row.nextElementSibling;
                if (nextRow) {
                    const targetInput = nextRow.querySelector(`.score-input[data-type="${currentType}"]`);
                    if (targetInput) {
                        targetInput.focus();
                        targetInput.select();
                    }
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prevRow = row.previousElementSibling;
                if (prevRow) {
                    const targetInput = prevRow.querySelector(`.score-input[data-type="${currentType}"]`);
                    if (targetInput) {
                        targetInput.focus();
                        targetInput.select();
                    }
                }
            }
        });
    }

    // ============================================
    // MODE SWITCHER & WEIGHT PRESETS
    // ============================================
    window.switchGradingMode = function(mode) {
        currentGradingMode = mode;
        if (mode === 'components') {
            tabComponentMode.classList.add('active');
            tabQuarterMode.classList.remove('active');
            if (weightsToolbar) weightsToolbar.style.display = 'flex';
            if (tableSubtitle) tableSubtitle.textContent = 'Enter component scores below. Final grades and remarks compute automatically in real time.';
        } else {
            tabComponentMode.classList.remove('active');
            tabQuarterMode.classList.add('active');
            if (weightsToolbar) weightsToolbar.style.display = 'none';
            if (tableSubtitle) tableSubtitle.textContent = 'Enter quarterly grades (Q1 - Q4) below. Final rating and remarks calculate automatically.';
        }

        renderGradesTable();
        // Recalculate all students
        studentsList.forEach(s => calculateStudentGrade(s.id));
        updateLiveClassStats();
    };

    window.applyWeightPreset = function(presetKey) {
        document.querySelectorAll('.btn-preset').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.preset === presetKey);
        });

        if (presetKey === 'languages') {
            weightWW = 30;
            weightPT = 50;
            weightQA = 20;
        } else if (presetKey === 'math-sci') {
            weightWW = 40;
            weightPT = 40;
            weightQA = 20;
        } else if (presetKey === 'mapeh-tvl') {
            weightWW = 20;
            weightPT = 60;
            weightQA = 20;
        }

        if (weightWWInput) weightWWInput.value = weightWW;
        if (weightPTInput) weightPTInput.value = weightPT;
        if (weightQAInput) weightQAInput.value = weightQA;

        updateFormulaBanner();
        renderGradesTable();
        studentsList.forEach(s => calculateStudentGrade(s.id));
        updateLiveClassStats();
    };

    window.updateCustomWeights = function() {
        const ww = parseFloat(weightWWInput.value) || 0;
        const pt = parseFloat(weightPTInput.value) || 0;
        const qa = parseFloat(weightQAInput.value) || 0;

        weightWW = ww;
        weightPT = pt;
        weightQA = qa;

        // Deselect presets if custom
        document.querySelectorAll('.btn-preset').forEach(btn => btn.classList.remove('active'));

        updateFormulaBanner();
        studentsList.forEach(s => calculateStudentGrade(s.id));
        updateLiveClassStats();
    };

    window.toggleTransmutation = function() {
        useTransmutation = transmuteCheckbox ? transmuteCheckbox.checked : true;
        updateFormulaBanner();
        studentsList.forEach(s => calculateStudentGrade(s.id));
        updateLiveClassStats();
    };

    function updateFormulaBanner() {
        if (!formulaText) return;
        const transText = useTransmutation ? 'Automatically transmuted to DepEd 75-100 passing standard' : 'Direct weighted percentage score';
        formulaText.innerHTML = `Formula: Quarterly Grade = (WW × ${weightWW}%) + (PT × ${weightPT}%) + (QA × ${weightQA}%) &nbsp;•&nbsp; ${transText}`;
    }

    // ============================================
    // BATCH ACTIONS (QUICK FILL, CLEAR, EXPORT)
    // ============================================
    window.setQuickScores = function(targetScore) {
        const inputs = document.querySelectorAll('.score-input');
        inputs.forEach(input => {
            if (input.value === '') {
                input.value = targetScore;
                input.dispatchEvent(new Event('input'));
            }
        });
        showAlert('success', `Quick-filled empty fields with score of ${targetScore}.`);
    };

    window.clearAllScores = function() {
        if (!confirm('Are you sure you want to clear all grade inputs for this class?')) return;
        const inputs = document.querySelectorAll('.score-input');
        inputs.forEach(input => {
            input.value = '';
            input.dispatchEvent(new Event('input'));
        });
        showAlert('warning', 'Cleared all input fields.');
    };

    window.exportGradesCSV = function() {
        if (studentsList.length === 0) {
            showAlert('warning', 'No students to export.');
            return;
        }

        const secObj = allSections.find(s => s.id === selectedSectionId);
        const subObj = allSubjects.find(s => s.id === selectedSubjectId);
        const secName = secObj ? secObj.name : 'Section';
        const subName = subObj ? subObj.name : 'Subject';

        let csvContent = 'data:text/csv;charset=utf-8,';
        csvContent += `Placido L. Senor National High School - Grade Sheet\n`;
        csvContent += `Subject:,"${subName}",Section:,"${secName}",Quarter:,${selectedQuarter},School Year:,${selectedSchoolYear}\n\n`;

        if (currentGradingMode === 'components') {
            csvContent += `#,LRN,Student Name,Written Works (${weightWW}%),Performance Tasks (${weightPT}%),Quarterly Assessment (${weightQA}%),Computed Grade,Remarks,Descriptor\n`;
            studentsList.forEach((s, idx) => {
                const cache = studentScoresCache[s.id] || {};
                const fullName = `"${s.last_name || ''}, ${s.first_name || ''}"`;
                const comp = cache.computedGrade !== null ? cache.computedGrade.toFixed(2) : '';
                const remarks = cache.remarks || '';
                const desc = getDescriptor(cache.computedGrade);
                csvContent += `${idx + 1},${s.lrn || ''},${fullName},${cache.ww || ''},${cache.pt || ''},${cache.qa || ''},${comp},${remarks},"${desc}"\n`;
            });
        } else {
            csvContent += `#,LRN,Student Name,Q1,Q2,Q3,Q4,Final Rating,Remarks,Descriptor\n`;
            studentsList.forEach((s, idx) => {
                const cache = studentScoresCache[s.id] || {};
                const fullName = `"${s.last_name || ''}, ${s.first_name || ''}"`;
                const comp = cache.computedGrade !== null ? cache.computedGrade.toFixed(2) : '';
                const remarks = cache.remarks || '';
                const desc = getDescriptor(cache.computedGrade);
                csvContent += `${idx + 1},${s.lrn || ''},${fullName},${cache.q1 || ''},${cache.q2 || ''},${cache.q3 || ''},${cache.q4 || ''},${comp},${remarks},"${desc}"\n`;
            });
        }

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `Grades_${secName.replace(/\s+/g, '_')}_${subName.replace(/\s+/g, '_')}_Q${selectedQuarter}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // ============================================
    // SAVE GRADES TO SUPABASE (UPSERT)
    // ============================================
    if (gradesForm) {
        gradesForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            if (studentsList.length === 0 || !selectedSubjectId) {
                showAlert('warning', 'Please select a class and subject first.');
                return;
            }

            const teacherId = teacherRecord?.id || sessionUser?.id || sessionUser?.uid;
            const rowsToUpsert = [];

            if (currentGradingMode === 'components') {
                // Save current quarter grade
                const qNum = parseInt(selectedQuarter, 10);

                studentsList.forEach(student => {
                    const cache = studentScoresCache[student.id];
                    if (cache && cache.computedGrade !== null && !isNaN(cache.computedGrade)) {
                        rowsToUpsert.push({
                            student_id: student.id,
                            subject_id: selectedSubjectId,
                            section_id: selectedSectionId || null,
                            teacher_id: teacherId,
                            school_year: selectedSchoolYear,
                            quarter: qNum,
                            grade: parseFloat(cache.computedGrade.toFixed(2)),
                            remarks: cache.remarks || (cache.computedGrade >= 75 ? 'Passed' : 'Failed'),
                            updated_at: new Date().toISOString()
                        });
                    }
                });
            } else {
                // 4-Quarter mode: save each entered quarter
                studentsList.forEach(student => {
                    const cache = studentScoresCache[student.id];
                    if (!cache) return;

                    [1, 2, 3, 4].forEach(qNum => {
                        const val = cache[`q${qNum}`];
                        if (val !== '' && val !== null && val !== undefined && !isNaN(parseFloat(val))) {
                            const numVal = parseFloat(val);
                            rowsToUpsert.push({
                                student_id: student.id,
                                subject_id: selectedSubjectId,
                                section_id: selectedSectionId || null,
                                teacher_id: teacherId,
                                school_year: selectedSchoolYear,
                                quarter: qNum,
                                grade: parseFloat(numVal.toFixed(2)),
                                remarks: numVal >= 75 ? 'Passed' : 'Failed',
                                updated_at: new Date().toISOString()
                            });
                        }
                    });
                });
            }

            if (rowsToUpsert.length === 0) {
                showAlert('warning', 'No computed grades to save. Please enter scores for at least one student.');
                return;
            }

            // Disable submit button with spinner
            const originalHTML = saveGradesBtn.innerHTML;
            saveGradesBtn.disabled = true;
            saveGradesBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving Grades to Supabase...';

            try {
                // Supabase upsert using unique constraint on (student_id, subject_id, school_year, quarter)
                const { data, error } = await supabase
                    .from('grades')
                    .upsert(rowsToUpsert, {
                        onConflict: 'student_id,subject_id,school_year,quarter'
                    });

                if (error) throw error;

                showAlert('success', `✅ Successfully saved ${rowsToUpsert.length} calculated grades to the database!`);
                console.log('✅ Upserted grades:', rowsToUpsert.length);

                // Reload existing grades from database to refresh cache
                await loadExistingGrades();
                initScoresCache();
                renderGradesTable();
                updateLiveClassStats();

            } catch (err) {
                console.error('Error saving grades:', err);
                showAlert('error', 'Error saving grades to database: ' + err.message);
            } finally {
                saveGradesBtn.disabled = false;
                saveGradesBtn.innerHTML = originalHTML;
            }
        });
    }

    // ============================================
    // TOAST ALERTS
    // ============================================
    function showAlert(type, message) {
        if (!alertContainer) return;
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        const icon = type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-triangle' : 'times-circle';
        alertDiv.innerHTML = `<i class="fas fa-${icon}"></i> <span>${message}</span>`;
        alertContainer.prepend(alertDiv);

        setTimeout(() => {
            alertDiv.style.opacity = '0';
            alertDiv.style.transition = 'opacity 0.4s ease';
            setTimeout(() => alertDiv.remove(), 400);
        }, 5000);
    }

})();