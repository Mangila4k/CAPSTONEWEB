/**
 * Student Grades - Supabase Integration
 * HES - HES, Hiraya Enrollment System
 */

import { supabase } from '../../supabase/config.js';

(function() {
    'use strict';

    console.log('📊 Student Grades (Supabase) ready');

    // ============================================
    // DOM ELEMENTS
    // ============================================

    const studentName = document.getElementById('studentName');
    const studentInitial = document.getElementById('studentInitial');
    const logoutBtn = document.getElementById('logoutBtn');

    // Class info
    const gradeDisplay = document.getElementById('gradeDisplay');
    const strandDisplay = document.getElementById('strandDisplay');
    const statusDisplay = document.getElementById('statusDisplay');
    const schoolYearDisplay = document.getElementById('schoolYearDisplay');

    // Stats
    const subjectsCount = document.getElementById('subjectsCount');
    const gradeLevelDisplay = document.getElementById('gradeLevelDisplay');
    const schoolYearStat = document.getElementById('schoolYearStat');

    // Subjects container
    const subjectsGrid = document.getElementById('subjectsGrid');
    const noGradesMsg = document.getElementById('noGradesMsg');
    const notEnrolledCard = document.getElementById('notEnrolledCard');

    // Modal
    const gradeModal = document.getElementById('gradeModal');
    const modalSubjectTitle = document.getElementById('modalSubjectTitle');
    const modalBody = document.getElementById('modalBody');

    const alertContainer = document.getElementById('alertContainer');

    // ============================================
    // STATE
    // ============================================

    let currentEnrollment = null;
    let studentRow = null;
    let subjectsList = [];
    let gradesData = {};

    const quarterNames = ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'];

    // ============================================
    // SESSION CHECK (Supabase / localStorage)
    // ============================================

    let sessionUser = null;
    try {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            sessionUser = JSON.parse(stored);
        }
    } catch(e) {}

    if (!sessionUser) {
        console.warn('⚠️ No active user session found, redirecting to login...');
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

    function getStudentInitials(name) {
        if (!name || typeof name !== 'string') return 'S';
        const cleanName = name.replace(/^(mr\.?|mrs\.?|ms\.?|dr\.?)\s+/i, '').trim();
        const words = cleanName.split(/[\s,&-]+/).filter(w => w.length > 0);
        if (words.length === 0) return 'S';
        if (words.length === 1) return words[0].charAt(0).toUpperCase();
        return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
    }

    function sanitizeStudentName(name, email) {
        if (!name && email) {
            return email.split('@')[0];
        }
        return (name || '').trim();
    }

    let displayName = sessionUser.displayName || 
        (sessionUser.firstName ? `${sessionUser.firstName} ${sessionUser.lastName || ''}`.trim() : 
        (sessionUser.email ? sessionUser.email.split('@')[0] : 'Student'));
    displayName = sanitizeStudentName(displayName, sessionUser.email);

    if (studentName) studentName.textContent = displayName;
    if (studentInitial) studentInitial.textContent = getStudentInitials(displayName);

    // ============================================
    // LOGOUT
    // ============================================

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
    // LOAD STUDENT DATA & GRADES FROM SUPABASE
    // ============================================

    async function loadStudentData() {
        try {
            const userEmail = sessionUser.email || '';
            const userUid = sessionUser.uid || '';

            // 1. Fetch student
            try {
                const { data: sRows } = await supabase
                    .from('students')
                    .select('*')
                    .or(`email.eq.${userEmail},id.eq.${userUid}`);

                if (sRows && sRows.length > 0) {
                    studentRow = sRows[0];
                    let fullName = `${studentRow.first_name || ''} ${studentRow.last_name || ''}`.trim();
                    fullName = sanitizeStudentName(fullName, userEmail);
                    if (fullName) {
                        if (studentName) studentName.textContent = fullName;
                        if (studentInitial) studentInitial.textContent = getStudentInitials(fullName);
                    }
                }
            } catch(e) {}

            // 2. Fetch latest enrollment
            const studentId = studentRow?.id || userUid;
            try {
                let query = supabase.from('enrollments').select('*');
                if (userEmail && studentId) {
                    query = query.or(`email.eq.${userEmail},student_id.eq.${studentId}`);
                } else if (userEmail) {
                    query = query.eq('email', userEmail);
                }
                const { data: enrRows } = await query.order('created_at', { ascending: false }).limit(1);
                if (enrRows && enrRows.length > 0) {
                    currentEnrollment = enrRows[0];
                }
            } catch(e) {}

            renderEnrollmentInfo(currentEnrollment, studentRow);
            await loadSubjectsAndGrades(currentEnrollment, studentRow);

        } catch (error) {
            console.error('Error loading student grades data:', error);
            showAlert('❌ Error loading data: ' + error.message, 'error');
        }
    }

    // ============================================
    // RENDER ENROLLMENT INFO
    // ============================================

    function renderEnrollmentInfo(enrollment, student) {
        const classCard = document.querySelector('.class-info-card');
        if (classCard) classCard.style.display = 'flex';
        const statsCont = document.querySelector('.stats-container');
        if (statsCont) statsCont.style.display = 'grid';
        const subCard = document.querySelector('.subjects-card');
        if (subCard) subCard.style.display = 'block';
        if (notEnrolledCard) notEnrolledCard.style.display = 'none';

        const grade = enrollment?.grade_level || enrollment?.grade || student?.grade_level || 'Grade 11';
        const strand = enrollment?.strand || student?.strand || 'TVL-ICT';
        const status = enrollment?.status ? (enrollment.status.charAt(0).toUpperCase() + enrollment.status.slice(1)) : 'Enrolled';
        const sy = enrollment?.school_year || enrollment?.last_school_year || '2025-2026';

        if (gradeDisplay) gradeDisplay.textContent = grade;
        if (strandDisplay) strandDisplay.textContent = strand;
        if (statusDisplay) statusDisplay.textContent = status;
        if (schoolYearDisplay) schoolYearDisplay.textContent = sy;
        if (gradeLevelDisplay) gradeLevelDisplay.textContent = grade;
        if (schoolYearStat) schoolYearStat.textContent = sy;
    }

    // ============================================
    // LOAD SUBJECTS AND GRADES
    // ============================================

    async function loadSubjectsAndGrades(enrollment, student) {
        try {
            subjectsList = [];
            const gradeName = enrollment?.grade_level || student?.grade_level || 'Grade 11';
            const strandName = enrollment?.strand || student?.strand || 'TVL-ICT';

            // 1. Fetch subjects from Supabase
            try {
                const { data: dbSubjects } = await supabase
                    .from('subjects')
                    .select('*');

                if (dbSubjects && dbSubjects.length > 0) {
                    subjectsList = dbSubjects.filter(s => {
                        return (s.grade_level === gradeName || s.grade_level?.includes(gradeName.replace('Grade ', ''))) &&
                               (!s.strand || s.strand === strandName || s.strand === 'General' || !strandName);
                    });
                }
            } catch (e) {
                console.warn('Subjects fetch error:', e);
            }

            // Fallback subjects if empty
            if (subjectsList.length === 0) {
                const isSHS = gradeName.includes('11') || gradeName.includes('12');
                const defaultSubjects = isSHS ? [
                    'Oral Communication in Context',
                    'Komunikasyon at Pananaliksik sa Wika at Kulturang Pilipino',
                    'General Mathematics',
                    'Earth and Life Science',
                    'Personal Development',
                    'Physical Education and Health 1',
                    'Empowerment Technologies (ICT for Professional Tracks)',
                    'Computer Systems Servicing NC II'
                ] : [
                    'Filipino',
                    'English',
                    'Mathematics',
                    'Science',
                    'Araling Panlipunan (AP / Social Studies)',
                    'MAPEH',
                    'Edukasyon sa Pagpapakatao (EsP / Values Education)',
                    'Technology and Livelihood Education (TLE)'
                ];

                subjectsList = defaultSubjects.map((name, idx) => ({
                    id: 'sub_' + (idx + 1),
                    name: name,
                    code: 'SUB' + (idx + 101)
                }));
            }

            // Fetch real grades from Supabase for this student
            gradesData = {};
            const stuTargetId = student?.id || sessionUser?.id || sessionUser?.uid;
            try {
                if (stuTargetId) {
                    const { data: dbGrades } = await supabase
                        .from('grades')
                        .select('*')
                        .eq('student_id', stuTargetId);

                    if (dbGrades && dbGrades.length > 0) {
                        dbGrades.forEach(g => {
                            if (!gradesData[g.subject_id]) {
                                gradesData[g.subject_id] = {};
                            }
                            gradesData[g.subject_id][g.quarter] = parseFloat(g.grade);
                        });
                    }
                }
            } catch (err) {
                console.warn('Real grades fetch notice:', err);
            }

            renderSubjects();

            if (noGradesMsg) noGradesMsg.style.display = 'none';
            if (subjectsCount) subjectsCount.textContent = subjectsList.length;

        } catch (error) {
            console.error('Error loading subjects:', error);
            showAlert('❌ Error loading subjects: ' + error.message, 'error');
        }
    }

    // ============================================
    // RENDER SUBJECTS
    // ============================================

    function renderSubjects() {
        if (!subjectsGrid) return;
        subjectsGrid.innerHTML = '';

        if (subjectsList.length === 0) {
            subjectsGrid.innerHTML = `
                <div class="no-data" style="grid-column: 1/-1; padding: 30px;">
                    <i class="fas fa-book"></i>
                    <p>No subjects found for your grade level.</p>
                </div>
            `;
            return;
        }

        subjectsList.forEach(subject => {
            const subjectGrades = gradesData[subject.id] || {};
            const hasGrades = Object.values(subjectGrades).some(g => g > 0);

            const itemDiv = document.createElement('div');
            itemDiv.className = 'subject-item';
            itemDiv.innerHTML = `
                <div class="subject-info">
                    <h4>${subject.name || subject.subject_name || 'Subject'}</h4>
                    ${subject.code ? `<span style="font-size: 0.75rem; color: var(--gray-400); font-weight: 600;">${subject.code}</span>` : ''}
                </div>
                <button type="button" class="view-grade-btn" data-subject-id="${subject.id}" data-subject-name="${subject.name || subject.subject_name || 'Subject'}">
                    <i class="fas fa-eye"></i> View Grades
                </button>
            `;
            subjectsGrid.appendChild(itemDiv);
        });

        document.querySelectorAll('.view-grade-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const subjectId = this.dataset.subjectId;
                const subjectName = this.dataset.subjectName;
                openGradeModal(subjectId, subjectName);
            });
        });
    }

    // ============================================
    // GRADE MODAL
    // ============================================

    function openGradeModal(subjectId, subjectName) {
        if (modalSubjectTitle) modalSubjectTitle.textContent = `${subjectName} - Grades`;

        const grades = gradesData[subjectId] || {};
        let html = '';
        let total = 0;
        let count = 0;

        for (let i = 1; i <= 4; i++) {
            const grade = grades[i] || null;
            const hasGrade = grade && grade > 0;
            let gradeClass = '';
            if (hasGrade) {
                if (grade >= 90) gradeClass = 'high';
                else if (grade >= 75) gradeClass = 'medium';
                else gradeClass = 'low';
                total += grade;
                count++;
            }

            html += `
                <div class="grade-item">
                    <span class="quarter-label">${quarterNames[i-1]}</span>
                    <span class="grade-value ${hasGrade ? gradeClass : ''}">${hasGrade ? grade : '—'}</span>
                </div>
            `;
        }

        const average = count > 0 ? (total / count).toFixed(2) : null;

        html += `
            <div class="average-display">
                <div class="avg-label">Overall Average</div>
                <div class="avg-value">${average !== null ? average + '%' : 'No grades'}</div>
            </div>
        `;

        if (modalBody) modalBody.innerHTML = html;
        if (gradeModal) gradeModal.classList.add('show');
    }

    function closeModal() {
        if (gradeModal) gradeModal.classList.remove('show');
    }

    if (gradeModal) {
        gradeModal.addEventListener('click', function(e) {
            if (e.target === this) closeModal();
        });
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeModal();
    });

    window.closeModal = closeModal;

    function showAlert(message, type = 'success') {
        if (!alertContainer) return;
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> <span>${message}</span>`;
        alertContainer.appendChild(alertDiv);
        setTimeout(() => alertDiv.remove(), 4000);
    }

    // Set current date badge
    const dateBadge = document.querySelector('.date-badge');
    if (dateBadge) {
        const now = new Date();
        dateBadge.innerHTML = `<i class="fas fa-calendar-alt"></i> ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
    }

    // Initialize
    loadStudentData();

})();