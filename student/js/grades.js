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
    const gradeCount = document.getElementById('gradeCount');
    const gradeLevelDisplay = document.getElementById('gradeLevelDisplay');
    const schoolYearStat = document.getElementById('schoolYearStat');

    // Subjects table
    const gradesTableBody = document.getElementById('gradesTableBody');
    const generalAverageCell = document.getElementById('generalAverageCell');
    const generalRemarksCell = document.getElementById('generalRemarksCell');
    const notEnrolledCard = document.getElementById('notEnrolledCard');

    const alertContainer = document.getElementById('alertContainer');

    // ============================================
    // STATE
    // ============================================

    let currentEnrollment = null;
    let studentRow = null;
    let subjectsList = [];
    let gradesData = {};

    // ============================================
    // SESSION CHECK
    // ============================================

    let sessionUser = null;
    try {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            sessionUser = JSON.parse(stored);
        }
    } catch(e) {}

    if (!sessionUser) {
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
    // LOAD STUDENT DATA
    // ============================================

    async function loadStudentData() {
        try {
            const userEmail = sessionUser.email || '';
            const userUid = sessionUser.uid || '';

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

            try {
                const { data: dbSubjects } = await supabase.from('subjects').select('*');
                if (dbSubjects && dbSubjects.length > 0) {
                    subjectsList = dbSubjects.filter(s => {
                        return (s.grade_level === gradeName || s.grade_level?.includes(gradeName.replace('Grade ', ''))) &&
                               (!s.strand || s.strand === strandName || s.strand === 'General' || !strandName);
                    });
                }
            } catch (e) {}

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
                    'Filipino', 'English', 'Mathematics', 'Science', 'Araling Panlipunan (AP / Social Studies)',
                    'MAPEH', 'Edukasyon sa Pagpapakatao (EsP / Values Education)', 'Technology and Livelihood Education (TLE)'
                ];

                subjectsList = defaultSubjects.map((name, idx) => ({
                    id: 'sub_' + (idx + 1),
                    name: name,
                    code: 'SUB' + (idx + 101)
                }));
            }

            gradesData = {};
            const stuTargetId = student?.id || sessionUser?.id || sessionUser?.uid;
            try {
                if (stuTargetId) {
                    const { data: dbGrades } = await supabase.from('grades').select('*').eq('student_id', stuTargetId);
                    if (dbGrades && dbGrades.length > 0) {
                        dbGrades.forEach(g => {
                            if (!gradesData[g.subject_id]) gradesData[g.subject_id] = {};
                            gradesData[g.subject_id][g.quarter] = parseFloat(g.grade);
                        });
                    }
                }
            } catch (err) {}

            renderSubjectsTable();

        } catch (error) {
            console.error('Error loading subjects:', error);
            showAlert('❌ Error loading subjects: ' + error.message, 'error');
        }
    }

    // ============================================
    // RENDER SUBJECTS TABLE & CALCULATE AVERAGES
    // ============================================

    function renderSubjectsTable() {
        if (!gradesTableBody) return;
        gradesTableBody.innerHTML = '';

        if (subjectsList.length === 0) {
            gradesTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem; color: var(--gray-500);">No subjects found.</td></tr>`;
            return;
        }

        let totalFinalGrades = 0;
        let subjectsWithFinalGrade = 0;

        subjectsList.forEach(subject => {
            const grades = gradesData[subject.id] || {};
            
            let q1 = grades[1] !== undefined ? grades[1] : null;
            let q2 = grades[2] !== undefined ? grades[2] : null;
            let q3 = grades[3] !== undefined ? grades[3] : null;
            let q4 = grades[4] !== undefined ? grades[4] : null;

            // STRICT RULE: Only compute Final Grade if ALL 4 quarters are present
            const hasAllQuarters = (q1 !== null && q2 !== null && q3 !== null && q4 !== null);

            let finalGrade = '—';
            let remarksHtml = `<span style="background: var(--gray-200); color: var(--gray-600); padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 600;">Pending</span>`;

            if (hasAllQuarters) {
                const avg = (q1 + q2 + q3 + q4) / 4;
                finalGrade = avg.toFixed(0); // Round to nearest whole number for display
                
                totalFinalGrades += avg;
                subjectsWithFinalGrade++;

                if (avg >= 75) {
                    remarksHtml = `<span style="display:inline-flex; align-items:center; gap:4px; color: #059669; font-size: 0.85rem; font-weight: 700;"><i class="fas fa-check-circle"></i> Passed</span>`;
                } else {
                    remarksHtml = `<span style="display:inline-flex; align-items:center; gap:4px; color: #dc2626; font-size: 0.85rem; font-weight: 700;"><i class="fas fa-times-circle"></i> Failed</span>`;
                }
            }

            // Format display values (show — if null)
            const formatQ = (val) => val !== null ? val : '—';
            const qColor = (val) => val !== null ? 'color: var(--gray-800); font-weight: 600;' : 'color: var(--gray-400);';

            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--gray-200)';
            tr.innerHTML = `
                <td style="padding: 1rem 1.5rem; font-size: 0.9rem; color: var(--gray-800); font-weight: 500;">
                    ${subject.name || subject.subject_name || 'Subject'}
                </td>
                <td style="padding: 1rem; text-align: center; font-size: 0.9rem; ${qColor(q1)}">${formatQ(q1)}</td>
                <td style="padding: 1rem; text-align: center; font-size: 0.9rem; ${qColor(q2)}">${formatQ(q2)}</td>
                <td style="padding: 1rem; text-align: center; font-size: 0.9rem; ${qColor(q3)}">${formatQ(q3)}</td>
                <td style="padding: 1rem; text-align: center; font-size: 0.9rem; ${qColor(q4)}">${formatQ(q4)}</td>
                <td style="padding: 1rem; text-align: center; font-size: 0.95rem; font-weight: 700; color: var(--gray-800);">${finalGrade}</td>
                <td style="padding: 1rem 1.5rem;">${remarksHtml}</td>
            `;
            gradesTableBody.appendChild(tr);
        });

        // Update the badges and General Average
        if (subjectsCount) subjectsCount.textContent = subjectsList.length;
        if (gradeCount) gradeCount.textContent = `${subjectsWithFinalGrade} subjects evaluated`;

        if (subjectsWithFinalGrade > 0) {
            const generalAvg = totalFinalGrades / subjectsWithFinalGrade;
            
            if (generalAverageCell) {
                generalAverageCell.textContent = generalAvg.toFixed(0) + '%';
                generalAverageCell.style.color = generalAvg >= 75 ? '#059669' : '#dc2626';
            }

            if (generalRemarksCell) {
                let honorText = '';
                if (generalAvg >= 98) honorText = 'With Highest Honors';
                else if (generalAvg >= 95) honorText = 'With High Honors';
                else if (generalAvg >= 90) honorText = 'With Honors';
                else if (generalAvg >= 75) honorText = 'Passed';
                else honorText = 'Failed';

                generalRemarksCell.innerHTML = `<span style="background: ${generalAvg >= 75 ? '#d1fae5' : '#fee2e2'}; color: ${generalAvg >= 75 ? '#065f46' : '#991b1b'}; padding: 6px 14px; border-radius: 20px; font-size: 0.85rem; font-weight: 700;">${honorText}</span>`;
            }
        } else {
            // If no subjects have all 4 quarters
            if (generalAverageCell) {
                generalAverageCell.textContent = '—';
                generalAverageCell.style.color = 'var(--gray-400)';
            }
            if (generalRemarksCell) {
                generalRemarksCell.innerHTML = `<span style="background: var(--gray-200); color: var(--gray-600); padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 600;">Pending</span>`;
            }
        }
    }

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