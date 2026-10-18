/**
 * Teacher View Student - Supabase Integration
 * Displays student profile, subject grades, and guidance/behavioral records
 * Provides direct referral action to Guidance Incident Reporting
 */

import { supabase } from '../../supabase/config.js';

(async function () {
    'use strict';

    console.log('👤 Teacher View Student (Supabase) ready');

    // ============================================
    // DOM ELEMENTS
    // ============================================
    const teacherName = document.getElementById('teacherName');
    const teacherInitial = document.getElementById('teacherInitial');
    const logoutBtn = document.getElementById('logoutBtn');

    // Profile elements
    const studentName = document.getElementById('studentName');
    const studentNameHeader = document.getElementById('studentNameHeader');
    const studentInitial = document.getElementById('studentInitial');
    const studentEmail = document.getElementById('studentEmail');
    const studentIdEl = document.getElementById('studentId');
    const studentGrade = document.getElementById('studentGrade');
    const studentSection = document.getElementById('studentSection');
    const studentSchoolYear = document.getElementById('studentSchoolYear');
    const studentStrand = document.getElementById('studentStrand');
    const enrollmentStatus = document.getElementById('enrollmentStatus');
    const memberSince = document.getElementById('memberSince');
    const memberYear = document.getElementById('memberYear');

    // Stats
    const averageGrade = document.getElementById('averageGrade');
    const subjectsCount = document.getElementById('subjectsCount');
    const quartersCount = document.getElementById('quartersCount');

    // Quarter averages
    const q1Avg = document.getElementById('q1Avg');
    const q2Avg = document.getElementById('q2Avg');
    const q3Avg = document.getElementById('q3Avg');
    const q4Avg = document.getElementById('q4Avg');

    // Grades table
    const gradesBody = document.getElementById('gradesBody');
    const gradesCountBadge = document.getElementById('gradesCountBadge');

    // Violations table & Refer button
    const violationsBody = document.getElementById('violationsBody');
    const violationsCountBadge = document.getElementById('violationsCountBadge');
    const referGuidanceBtn = document.getElementById('referGuidanceBtn');

    // Alert container
    const alertContainer = document.getElementById('alertContainer');

    // ============================================
    // SESSION CHECK & AUTH
    // ============================================
    let sessionUser = null;
    try {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            sessionUser = JSON.parse(stored);
        }
    } catch (e) {
        console.warn('Error reading currentUser:', e);
    }

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
            'registrar': '../registrar/dashboard.html',
            'guidance': '../guidance/dashboard.html'
        };
        window.location.replace(routes[sessionUser.role] || '../auth/login.html');
        return;
    }

    const teacherDisplayName = (sessionUser.firstName || sessionUser.first_name)
        ? `${sessionUser.firstName || sessionUser.first_name} ${sessionUser.lastName || sessionUser.last_name || ''}`.trim()
        : (sessionUser.name || (sessionUser.email ? sessionUser.email.split('@')[0] : 'Teacher'));

    if (teacherName) teacherName.textContent = teacherDisplayName;
    if (teacherInitial) teacherInitial.textContent = teacherDisplayName.charAt(0).toUpperCase();

    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function (e) {
            e.preventDefault();
            try {
                await supabase.auth.signOut();
            } catch (err) {}
            localStorage.removeItem('currentUser');
            localStorage.removeItem('hes_teacher_avatar');
            localStorage.removeItem('hes_teacher_name');
            window.location.replace('../auth/login.html');
        });
    }

    // Set Current Date badge if present
    const dateBadge = document.querySelector('.date-badge');
    if (dateBadge) {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateBadge.innerHTML = `<i class="fas fa-calendar-alt"></i> ${now.toLocaleDateString('en-US', options)}`;
    }

    // Alert notification helper
    function showAlert(message, type = 'success') {
        if (!alertContainer) return;
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            ${message}
        `;
        alertContainer.appendChild(alertDiv);

        setTimeout(() => {
            alertDiv.style.opacity = '0';
            setTimeout(() => alertDiv.remove(), 300);
        }, 5000);
    }

    // ============================================
    // LOAD TARGET STUDENT
    // ============================================
    const urlParams = new URLSearchParams(window.location.search);
    const targetStudentId = urlParams.get('id') || urlParams.get('student_id');

    if (!targetStudentId) {
        showAlert('⚠️ No student ID specified in URL. Please select a student from Classes.', 'error');
        if (studentName) studentName.textContent = 'No Student Selected';
        if (studentNameHeader) studentNameHeader.textContent = 'No Student Selected';
        return;
    }

    let currentStudent = null;
    let sectionData = null;
    let subjectsMap = {};

    async function loadStudent() {
        try {
            // 1. Fetch student by ID or LRN
            let { data: student, error } = await supabase
                .from('students')
                .select('*')
                .eq('id', targetStudentId)
                .maybeSingle();

            if (!student) {
                const { data: studentByLrn } = await supabase
                    .from('students')
                    .select('*')
                    .eq('lrn', targetStudentId)
                    .maybeSingle();
                student = studentByLrn;
            }

            // Fallback realistic student roster if not yet in database
            if (!student) {
                const fallbackRoster = [
                    { id: 'STU-001', lrn: '109876543201', first_name: 'Christian Paul', last_name: 'Aquino', email: 'c.aquino@student.hes.edu', grade_level: 'Grade 11', strand: 'STEM', documents_status: 'complete' },
                    { id: 'STU-002', lrn: '109876543202', first_name: 'Maria Angela', last_name: 'Bautista', email: 'm.bautista@student.hes.edu', grade_level: 'Grade 11', strand: 'ABM', documents_status: 'complete' },
                    { id: 'STU-003', lrn: '109876543203', first_name: 'John Kenneth', last_name: 'Cruz', email: 'jk.cruz@student.hes.edu', grade_level: 'Grade 11', strand: 'HUMSS', documents_status: 'complete' },
                    { id: 'STU-004', lrn: '109876543204', first_name: 'Juan', last_name: 'Dela Cruz', email: 'j.delacruz@student.hes.edu', grade_level: 'Grade 11', strand: 'TVL-ICT', documents_status: 'complete' },
                    { id: 'STU-005', lrn: '109876543205', first_name: 'Jasmine Nicole', last_name: 'Flores', email: 'j.flores@student.hes.edu', grade_level: 'Grade 11', strand: 'GAS', documents_status: 'complete' }
                ];
                student = fallbackRoster.find(s => s.id === targetStudentId || s.lrn === targetStudentId);
            }

            if (!student) {
                showAlert('❌ Student record not found in system.', 'error');
                if (studentName) studentName.textContent = 'Student Not Found';
                if (studentNameHeader) studentNameHeader.textContent = 'Student Not Found';
                return;
            }

            currentStudent = student;
            const fullName = `${student.first_name || ''} ${student.last_name || ''}`.trim() || student.fullname || 'Student';
            const initial = fullName.charAt(0).toUpperCase();

            // Render profile header & metadata
            if (studentName) studentName.textContent = fullName;
            if (studentNameHeader) studentNameHeader.textContent = fullName;
            if (studentInitial) studentInitial.textContent = initial;
            if (studentEmail) studentEmail.textContent = student.email || 'N/A';
            if (studentIdEl) studentIdEl.textContent = student.lrn || student.id || 'N/A';
            if (studentGrade) studentGrade.textContent = student.grade_level || 'N/A';
            if (studentStrand) studentStrand.textContent = student.strand || 'N/A';
            if (studentSchoolYear) studentSchoolYear.textContent = '2024-2025';

            // Enrollment status badge
            if (enrollmentStatus) {
                const isEnrolled = student.documents_status === 'complete' || (student.status && student.status.toLowerCase() === 'enrolled');
                enrollmentStatus.textContent = isEnrolled ? 'Enrolled' : (student.status || 'Enrolled');
                enrollmentStatus.className = 'status-badge status-enrolled';
            }

            // Member since
            if (student.created_at && memberSince) {
                const date = new Date(student.created_at);
                memberSince.textContent = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                if (memberYear) memberYear.textContent = date.getFullYear();
            } else if (memberSince) {
                memberSince.textContent = 'SY 2024-2025';
                if (memberYear) memberYear.textContent = '2024';
            }

            // Avatar photo
            const avatarContainer = document.querySelector('.profile-avatar-large');
            if (avatarContainer) {
                const photoUrl = student.two_by_two_picture_url || student.avatar_url;
                if (photoUrl) {
                    avatarContainer.innerHTML = `<img src="${photoUrl}" alt="${fullName}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                } else {
                    avatarContainer.innerHTML = `<div class="avatar-initial" id="studentInitial">${initial}</div>`;
                }
            }

            // 2. Fetch assigned section name & adviser
            if (student.section_id) {
                try {
                    const { data: sec } = await supabase
                        .from('sections')
                        .select('id, name, adviser_name, grade_level, strand')
                        .eq('id', student.section_id)
                        .maybeSingle();

                    if (sec) {
                        sectionData = sec;
                        if (studentSection) studentSection.textContent = sec.name;
                    }
                } catch (secErr) {
                    console.warn('Section fetch notice:', secErr);
                }
            }
            if (!studentSection.textContent || studentSection.textContent === 'N/A') {
                studentSection.textContent = student.section || 'N/A';
            }

            // 3. Setup Guidance Referral Button
            if (referGuidanceBtn) {
                referGuidanceBtn.onclick = function () {
                    const tName = encodeURIComponent(teacherDisplayName);
                    const sId = encodeURIComponent(currentStudent.id || '');
                    const tId = encodeURIComponent(sessionUser.uid || sessionUser.id || '');
                    window.location.href = `../guidance/add_violation.html?student_id=${sId}&teacher_name=${tName}&role=Teacher&teacher_id=${tId}`;
                };
            }

            // 4. Concurrently load grades and behavioral records
            await Promise.all([
                loadSubjectsAndGrades(currentStudent),
                loadGuidanceViolations(currentStudent)
            ]);

            // Setup real-time listener for disciplinary records
            setupViolationsRealtime(currentStudent);

        } catch (err) {
            console.error('Error loading student profile:', err);
            showAlert('❌ Failed to load student details: ' + (err.message || err), 'error');
        }
    }

    // ============================================
    // LOAD GRADES & SUBJECTS
    // ============================================
    async function loadSubjectsAndGrades(student) {
        try {
            // Load subjects lookup
            const { data: subjects } = await supabase
                .from('subjects')
                .select('id, name, code');

            subjectsMap = {};
            if (subjects) {
                subjects.forEach(s => {
                    subjectsMap[s.id] = s.name || s.code;
                });
            }

            // Load student grades
            const { data: grades, error } = await supabase
                .from('grades')
                .select('*')
                .eq('student_id', student.id)
                .order('quarter', { ascending: true });

            const gradesList = grades || [];
            renderGrades(gradesList);
            calculateGradeStats(gradesList);

        } catch (err) {
            console.warn('Grades fetch notice:', err);
            renderGrades([]);
            calculateGradeStats([]);
        }
    }

    function renderGrades(gradesList) {
        if (!gradesBody) return;

        if (gradesCountBadge) {
            gradesCountBadge.textContent = `${gradesList.length} records`;
        }

        if (gradesList.length === 0) {
            gradesBody.innerHTML = `
                <tr>
                    <td colspan="4">
                        <div class="no-data">
                            <i class="fas fa-star" style="font-size: 2rem; color: var(--gray-400); margin-bottom: 8px;"></i>
                            <h3>No Grades Recorded</h3>
                            <p>This student does not have any recorded grades yet for the current term.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        gradesBody.innerHTML = gradesList.map(g => {
            const gradeVal = parseFloat(g.grade) || 0;
            let gradeClass = 'grade-medium';
            let remarks = g.remarks || 'Passed';

            if (gradeVal >= 90) {
                gradeClass = 'grade-high';
                if (!g.remarks) remarks = 'Outstanding';
            } else if (gradeVal >= 75) {
                gradeClass = 'grade-medium';
                if (!g.remarks) remarks = 'Passed';
            } else if (gradeVal > 0) {
                gradeClass = 'grade-low';
                if (!g.remarks) remarks = 'Needs Improvement';
            } else {
                remarks = '—';
            }

            const subjectTitle = g.subject_name || subjectsMap[g.subject_id] || 'Subject Course';
            const quarterDisplay = typeof g.quarter === 'number' ? `Quarter ${g.quarter}` : (g.quarter || '1st Quarter');

            return `
                <tr>
                    <td><strong>${subjectTitle}</strong></td>
                    <td>${quarterDisplay}</td>
                    <td>
                        ${gradeVal > 0 ? `<span class="${gradeClass}">${gradeVal.toFixed(1)}</span>` : '—'}
                    </td>
                    <td><span class="status-badge" style="font-size: 0.8rem;">${remarks}</span></td>
                </tr>
            `;
        }).join('');
    }

    function calculateGradeStats(gradesList) {
        const validGrades = gradesList.filter(g => parseFloat(g.grade) > 0);

        if (validGrades.length > 0) {
            const sum = validGrades.reduce((acc, g) => acc + parseFloat(g.grade), 0);
            const gpa = (sum / validGrades.length).toFixed(1);
            if (averageGrade) averageGrade.textContent = gpa;
        } else {
            if (averageGrade) averageGrade.textContent = '—';
        }

        // Unique subjects
        const subjSet = new Set(gradesList.map(g => g.subject_id).filter(Boolean));
        if (subjectsCount) subjectsCount.textContent = subjSet.size || gradesList.length || '0';

        // Quarters with grades
        const qSet = new Set(validGrades.map(g => g.quarter).filter(Boolean));
        if (quartersCount) quartersCount.textContent = qSet.size || '0';

        // Quarter averages
        function calcQAvg(quarterVal) {
            const qList = validGrades.filter(g => g.quarter === quarterVal || g.quarter === `${quarterVal}st Quarter` || g.quarter === `${quarterVal}nd Quarter` || g.quarter === `${quarterVal}rd Quarter` || g.quarter === `${quarterVal}th Quarter`);
            if (qList.length === 0) return '—';
            const s = qList.reduce((acc, g) => acc + parseFloat(g.grade), 0);
            return (s / qList.length).toFixed(1);
        }

        if (q1Avg) q1Avg.textContent = calcQAvg(1);
        if (q2Avg) q2Avg.textContent = calcQAvg(2);
        if (q3Avg) q3Avg.textContent = calcQAvg(3);
        if (q4Avg) q4Avg.textContent = calcQAvg(4);
    }

    // ============================================
    // LOAD GUIDANCE & BEHAVIORAL VIOLATIONS
    // ============================================
    async function loadGuidanceViolations(student) {
        if (!violationsBody) return;

        try {
            // Query student_violations table for student_id or LRN
            let query = supabase
                .from('student_violations')
                .select('*');

            if (student.id && student.lrn) {
                query = query.or(`student_id.eq.${student.id},lrn.eq.${student.lrn}`);
            } else if (student.id) {
                query = query.eq('student_id', student.id);
            } else {
                query = query.eq('lrn', student.lrn);
            }

            const { data: violations, error } = await query.order('incident_date', { ascending: false });

            if (error) {
                console.warn('Violations load notice:', error);
            }

            const list = violations || [];
            renderViolations(list);

        } catch (err) {
            console.error('Error fetching guidance violations:', err);
            renderViolations([]);
        }
    }

    function renderViolations(list) {
        if (!violationsBody) return;

        if (violationsCountBadge) {
            violationsCountBadge.textContent = `${list.length} incident${list.length === 1 ? '' : 's'}`;
            if (list.length > 0) {
                violationsCountBadge.style.background = '#fee2e2';
                violationsCountBadge.style.color = '#991b1b';
            } else {
                violationsCountBadge.style.background = '#dcfce7';
                violationsCountBadge.style.color = '#15803d';
            }
        }

        if (list.length === 0) {
            violationsBody.innerHTML = `
                <tr>
                    <td colspan="5">
                        <div class="no-data" style="text-align: center; padding: 32px 16px;">
                            <i class="fas fa-shield-alt" style="color: #10b981; font-size: 2.2rem; margin-bottom: 8px; display: block;"></i>
                            <h3 style="font-size: 1rem; font-weight: 700; color: #1e293b; margin-bottom: 4px;">Clean Behavioral Record</h3>
                            <p style="font-size: 0.85rem; color: var(--gray-500); margin: 0;">No disciplinary incidents or guidance referrals recorded for this student.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        violationsBody.innerHTML = list.map(v => {
            // Category badge styling
            let catBg = '#fef3c7';
            let catColor = '#b45309';
            const cat = (v.violation_category || 'Minor').toLowerCase();
            if (cat === 'major') {
                catBg = '#fee2e2';
                catColor = '#b91c1c';
            } else if (cat === 'severe') {
                catBg = '#450a0a';
                catColor = '#ffffff';
            }

            // Status badge styling
            let statusBg = '#e0f2fe';
            let statusColor = '#0369a1';
            const st = (v.status || 'Pending').toLowerCase();
            if (st.includes('resolved') || st.includes('closed')) {
                statusBg = '#dcfce7';
                statusColor = '#15803d';
            } else if (st.includes('counseling')) {
                statusBg = '#fef3c7';
                statusColor = '#b45309';
            } else if (st.includes('investigation') || st.includes('pending')) {
                statusBg = '#fee2e2';
                statusColor = '#b91c1c';
            }

            const dateStr = v.incident_date ? new Date(v.incident_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
            const timeStr = v.incident_time ? ` · ${v.incident_time}` : '';
            const reporter = v.reported_by || 'Teacher / Faculty';
            const role = v.reporter_role || 'Teacher';

            return `
                <tr>
                    <td style="white-space: nowrap;">
                        <strong>${dateStr}</strong>
                        <div style="font-size: 0.78rem; color: var(--gray-500);">${timeStr || (v.incident_location || '')}</div>
                    </td>
                    <td>
                        <strong style="color: var(--gray-900); font-size: 0.92rem;">${v.violation_title || v.violation_type || 'Disciplinary Incident'}</strong>
                        ${v.description ? `<p style="font-size: 0.8rem; color: var(--gray-600); margin-top: 3px; max-width: 320px; line-height: 1.35;">${v.description.length > 90 ? v.description.substring(0, 90) + '...' : v.description}</p>` : ''}
                    </td>
                    <td>
                        <span style="display: inline-block; background: ${catBg}; color: ${catColor}; padding: 3px 8px; border-radius: 4px; font-weight: 700; font-size: 0.78rem; text-transform: uppercase;">
                            ${v.violation_category || 'Minor'}
                        </span>
                        <div style="font-size: 0.78rem; color: var(--gray-600); margin-top: 3px; font-weight: 500;">
                            ${v.offense_level || '1st Offense'}
                        </div>
                    </td>
                    <td>
                        <div style="font-weight: 600; color: var(--gray-800); font-size: 0.9rem;">${reporter}</div>
                        <span style="display: inline-block; background: #f1f5f9; color: var(--primary); font-size: 0.75rem; padding: 2px 7px; border-radius: 4px; font-weight: 600; margin-top: 2px;">
                            <i class="fas fa-user-check" style="font-size: 0.7rem; margin-right: 3px;"></i>${role}
                        </span>
                    </td>
                    <td>
                        <span style="display: inline-block; background: ${statusBg}; color: ${statusColor}; padding: 4px 10px; border-radius: 12px; font-weight: 600; font-size: 0.8rem;">
                            ${v.status || 'Reported'}
                        </span>
                        ${v.action_taken ? `<div style="font-size: 0.76rem; color: var(--gray-500); margin-top: 3px;">${v.action_taken}</div>` : ''}
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Real-time listener for violations table
    function setupViolationsRealtime(student) {
        try {
            supabase
                .channel(`student-violations-${student.id}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'student_violations'
                }, () => {
                    console.log('🔄 Disciplinary records updated in real-time');
                    loadGuidanceViolations(student);
                })
                .subscribe();
        } catch (rtErr) {
            console.warn('Real-time subscription notice:', rtErr);
        }
    }

    // Initialize
    await loadStudent();

})();