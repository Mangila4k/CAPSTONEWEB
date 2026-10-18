/**
 * Teacher My Classes - Supabase Integration
 */

import { supabase } from '../../supabase/config.js';

(function() {
    'use strict';

    console.log('📚 My Classes ready');

    // ============================================
    // DOM ELEMENTS
    // ============================================

    const teacherName = document.getElementById('teacherName');
    const teacherInitial = document.getElementById('teacherInitial');
    const logoutBtn = document.getElementById('logoutBtn');

    // Stats
    const totalSections = document.getElementById('totalSections');
    const totalSubjects = document.getElementById('totalSubjects');
    const totalStudents = document.getElementById('totalStudents');

    // Containers
    const advisoryContainer = document.getElementById('advisoryContainer');
    const subjectsContainer = document.getElementById('subjectsContainer');
    const scheduleContainer = document.getElementById('scheduleContainer');

    // Alert container
    const alertContainer = document.getElementById('alertContainer');

    // ============================================
    // STATE
    // ============================================

    let sessionUser = null;
    let currentTeacherRecord = null;
    let advisorySections = [];
    let allTeacherSections = [];
    let teacherSubjects = [];
    let schedules = [];
    let studentsBySection = {};

    const gradeOrder = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];
    const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    // ============================================
    // SESSION CHECK & AUTH
    // ============================================

    try {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            sessionUser = JSON.parse(stored);
        }
    } catch (e) {}

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

    const firstNm = sessionUser.firstName || sessionUser.first_name || '';
    const lastNm = sessionUser.lastName || sessionUser.last_name || '';
    const displayName = (firstNm || lastNm) ? `${firstNm} ${lastNm}`.trim() : (sessionUser.displayName || sessionUser.name || (sessionUser.email ? sessionUser.email.split('@')[0] : 'Teacher'));
    if (teacherName) teacherName.textContent = displayName;
    if (teacherInitial) teacherInitial.textContent = displayName.charAt(0).toUpperCase();

    // ============================================
    // LOGOUT
    // ============================================

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            console.log('🚪 Teacher logging out...');
            localStorage.removeItem('currentUser');
            localStorage.removeItem('hes_teacher_avatar');
            localStorage.removeItem('hes_teacher_name');
            try {
                await supabase.auth.signOut();
            } catch (err) {}
            window.location.replace('../auth/login.html');
        });
    }

    // ============================================
    // RESOLVE TEACHER RECORD
    // ============================================

    async function resolveTeacherRecord() {
        if (currentTeacherRecord) return currentTeacherRecord;
        const currentUserId = sessionUser.id || sessionUser.uid;
        const userEmail = sessionUser.email || '';

        try {
            let { data: tData } = await supabase
                .from('teachers')
                .select('*')
                .or(`user_id.eq.${currentUserId},id.eq.${currentUserId}`)
                .maybeSingle();

            if (!tData && userEmail) {
                const { data: uData } = await supabase
                    .from('users')
                    .select('id')
                    .eq('email', userEmail)
                    .maybeSingle();

                if (uData) {
                    const { data: matchedT } = await supabase
                        .from('teachers')
                        .select('*')
                        .eq('user_id', uData.id)
                        .maybeSingle();
                    tData = matchedT;
                }
            }

            currentTeacherRecord = tData || {
                id: currentUserId,
                user_id: currentUserId,
                employee_id: sessionUser.employee_id || 'HES-TCH-001',
                specialization: sessionUser.specialization || 'Faculty'
            };
        } catch (e) {
            console.warn('Error resolving teacher record:', e);
            currentTeacherRecord = { id: currentUserId, user_id: currentUserId };
        }
        return currentTeacherRecord;
    }

    // ============================================
    // LOAD ALL DATA (DYNAMIC SUPABASE)
    // ============================================

    async function loadAllData() {
        try {
            const teacher = await resolveTeacherRecord();
            const teacherId = teacher.id;
            const teacherUserId = teacher.user_id || sessionUser.id;

            // 1. Fetch schedules assigned strictly to this teacher
            schedules = [];
            try {
                let sQuery = supabase.from('schedules').select('*');
                if (teacherUserId && teacherUserId !== teacherId) {
                    sQuery = sQuery.or(`teacher_id.eq.${teacherId},teacher_id.eq.${teacherUserId}`);
                } else {
                    sQuery = sQuery.eq('teacher_id', teacherId);
                }
                const { data: sRows, error: sErr } = await sQuery;
                if (!sErr && sRows) {
                    schedules = sRows;
                }
            } catch (e) {
                console.warn('Error loading schedules:', e);
            }

            // 2. Fetch sections: scheduled + advisory
            const scheduledSecIds = [...new Set(schedules.map(s => s.section_id).filter(Boolean))];
            const sectionMap = new Map();

            if (scheduledSecIds.length > 0) {
                try {
                    const { data: secRows } = await supabase.from('sections').select('*').in('id', scheduledSecIds);
                    if (secRows) secRows.forEach(sec => sectionMap.set(sec.id, sec));
                } catch (e) {}
            }

            // Advisory sections
            advisorySections = [];
            try {
                const conds = [];
                if (teacherId) conds.push(`adviser_id.eq.${teacherId}`);
                if (teacherUserId && teacherUserId !== teacherId) conds.push(`adviser_id.eq.${teacherUserId}`);

                const lastName = sessionUser.lastName || sessionUser.last_name;
                if (lastName && lastName.length >= 3) {
                    conds.push(`adviser_name.ilike.%${lastName}%`);
                }

                if (conds.length > 0) {
                    const { data: advRows } = await supabase.from('sections').select('*').or(conds.join(','));
                    if (advRows) {
                        advRows.forEach(sec => {
                            sectionMap.set(sec.id, sec);
                            advisorySections.push(sec);
                        });
                    }
                }
            } catch (e) {}

            allTeacherSections = Array.from(sectionMap.values());

            // 3. Fetch subjects taught by teacher
            const scheduledSubIds = [...new Set(schedules.map(s => s.subject_id).filter(Boolean))];
            teacherSubjects = [];
            const subjectMap = new Map();

            if (scheduledSubIds.length > 0) {
                try {
                    const { data: subRows } = await supabase.from('subjects').select('*').in('id', scheduledSubIds).order('name', { ascending: true });
                    if (subRows) {
                        teacherSubjects = subRows;
                        subRows.forEach(sub => subjectMap.set(sub.id, sub));
                    }
                } catch (e) {}
            }

            // Enrich schedules with subject and section metadata
            schedules.forEach(s => {
                const sec = sectionMap.get(s.section_id);
                const sub = subjectMap.get(s.subject_id);
                s.sectionName = sec ? sec.name : 'Unknown Section';
                s.gradeName = sec ? sec.grade_level : (sub ? sub.grade_level : 'N/A');
                s.subjectName = sub ? sub.name : 'Unknown Subject';
                s.dayName = s.day || 'Monday';
                s.startTime = s.start_time;
                s.endTime = s.end_time;
            });

            // 4. Load students for teacher's sections
            studentsBySection = {};
            const allSecIds = Array.from(sectionMap.keys());
            if (allSecIds.length > 0) {
                try {
                    const { data: stuRows } = await supabase
                        .from('students')
                        .select('id, first_name, last_name, lrn, section_id, avatar_url')
                        .in('section_id', allSecIds);

                    if (stuRows) {
                        stuRows.forEach(stu => {
                            if (!studentsBySection[stu.section_id]) {
                                studentsBySection[stu.section_id] = [];
                            }
                            studentsBySection[stu.section_id].push({
                                id: stu.id,
                                name: `${stu.first_name || ''} ${stu.last_name || ''}`.trim() || 'Student',
                                idNumber: stu.lrn || 'N/A',
                                avatar: stu.avatar_url || null
                            });
                        });
                    }
                } catch (e) {}
            }

            // 5. Update UI
            updateStats();
            renderSections();
            renderSubjects();
            renderSchedule();

        } catch (error) {
            console.error('Error loading classes data:', error);
            showAlert('❌ Error loading classes: ' + error.message, 'error');
        }
    }

    // ============================================
    // UPDATE STATS
    // ============================================

    function updateStats() {
        if (totalSections) totalSections.textContent = advisorySections.length > 0 ? advisorySections.length : allTeacherSections.length;
        if (totalSubjects) totalSubjects.textContent = teacherSubjects.length;

        let studentCount = 0;
        // Count students under advisory (or handling sections if no advisory)
        const targetSections = advisorySections.length > 0 ? advisorySections : allTeacherSections;
        targetSections.forEach(sec => {
            const list = studentsBySection[sec.id] || [];
            studentCount += list.length;
        });
        if (totalStudents) totalStudents.textContent = studentCount;
    }

    // ============================================
    // RENDER SECTIONS
    // ============================================

    function renderSections() {
        if (!advisoryContainer) return;

        const displayList = advisorySections.length > 0 ? advisorySections : allTeacherSections;

        if (displayList.length === 0) {
            advisoryContainer.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-users"></i>
                    <h3>No Classes Assigned</h3>
                    <p>You have not been assigned as an adviser or instructor to any section yet.</p>
                </div>
            `;
            return;
        }

        advisoryContainer.innerHTML = displayList.map(section => {
            const studentList = studentsBySection[section.id] || [];
            const studentCount = studentList.length;
            const topStudents = studentList.slice(0, 5);
            const isAdvisory = advisorySections.some(a => a.id === section.id);
            const badgeText = isAdvisory ? 'Adviser' : 'Teaching Section';

            return `
                <div class="class-card">
                    <div class="class-header">
                        <h3><i class="fas fa-users"></i> ${section.name || 'Unknown Section'}</h3>
                        <span class="class-badge">${badgeText}</span>
                    </div>
                    <div class="class-body">
                        <div class="class-info">
                            <div class="class-info-item">
                                <div class="class-info-value">${section.grade_level || 'N/A'}</div>
                                <div class="class-info-label">Grade Level</div>
                            </div>
                            <div class="class-info-item">
                                <div class="class-info-value">${studentCount}</div>
                                <div class="class-info-label">Enrolled Students</div>
                            </div>
                        </div>

                        <div class="student-list">
                            <h4>Enrolled Students</h4>
                            ${topStudents.length > 0 ? topStudents.map(student => `
                                <div class="student-item">
                                    <div class="student-avatar">${student.name.charAt(0).toUpperCase()}</div>
                                    <div class="student-name">${student.name}</div>
                                    <div class="student-id">${student.idNumber}</div>
                                </div>
                            `).join('') : '<p class="no-students">No students enrolled yet</p>'}
                            ${studentCount > 0 ? `
                                <a href="view-section.html?id=${section.id || ''}" class="view-all-link">View All Students & Attendance <i class="fas fa-arrow-right"></i></a>
                            ` : ''}
                        </div>

                        <div class="class-actions">
                            <a href="grades.html" class="class-action-btn btn-grades"><i class="fas fa-star"></i> Grades</a>
                            <a href="view-section.html?id=${section.id || ''}" class="class-action-btn btn-students"><i class="fas fa-clipboard-check"></i> Attendance & Section</a>
                            <a href="class-program.html" class="class-action-btn btn-schedule"><i class="fas fa-calendar-alt"></i> Class Program</a>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ============================================
    // RENDER SUBJECTS
    // ============================================

    function renderSubjects() {
        if (!subjectsContainer) return;

        if (teacherSubjects.length === 0) {
            subjectsContainer.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-book"></i>
                    <h3>No Subjects Assigned</h3>
                    <p>You are not assigned to teach any subjects yet.</p>
                    <p style="font-size: 13px; margin-top: 10px;">Subjects will appear here once teaching schedules are assigned.</p>
                </div>
            `;
            return;
        }

        const subjectsByGrade = {};
        teacherSubjects.forEach(subject => {
            let grade = subject.grade_level || 'General';
            const num = parseInt(String(grade).replace(/[^0-9]/g, ''));
            if (!isNaN(num) && num >= 7 && num <= 12) grade = `Grade ${num}`;

            if (!subjectsByGrade[grade]) {
                subjectsByGrade[grade] = [];
            }
            subjectsByGrade[grade].push(subject);
        });

        let html = '<div class="subjects-accordion">';

        gradeOrder.forEach(gradeName => {
            const subjectList = subjectsByGrade[gradeName] || [];
            if (subjectList.length === 0) return;

            const gradeId = gradeName.replace(/\s/g, '_');

            html += `
                <div class="grade-section">
                    <div class="grade-header" onclick="window.toggleGrade('${gradeId}')">
                        <div class="grade-title">
                            <i class="fas fa-graduation-cap"></i>
                            <span>${gradeName}</span>
                            <span class="subject-count">(${subjectList.length} subject${subjectList.length > 1 ? 's' : ''})</span>
                        </div>
                        <i class="fas fa-chevron-down toggle-icon" id="icon_${gradeId}"></i>
                    </div>
                    <div class="grade-content" id="content_${gradeId}">
                        <div class="subject-list">
                            ${subjectList.map(subject => `
                                <div class="subject-item">
                                    <div class="subject-info">
                                        <h4>${subject.name || subject.code || 'Unknown Subject'}</h4>
                                        <p><i class="fas fa-layer-group"></i> ${subject.code ? subject.code + ' · ' : ''}Grade: ${gradeName}</p>
                                    </div>
                                    <div class="subject-actions">
                                        <a href="grades.html" class="subject-action-btn grades"><i class="fas fa-star"></i> Grades</a>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        subjectsContainer.innerHTML = html;
    }

    // ============================================
    // RENDER SCHEDULE
    // ============================================

    function renderSchedule() {
        if (!scheduleContainer) return;

        if (schedules.length === 0) {
            scheduleContainer.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-calendar-alt"></i>
                    <h3>No Schedule Found</h3>
                    <p>You don't have any class schedule assigned yet.</p>
                    <p style="font-size: 13px; margin-top: 10px;">Please contact the administrator to set up your teaching schedule.</p>
                </div>
            `;
            return;
        }

        const scheduleByDay = {};
        daysOrder.forEach(day => {
            scheduleByDay[day] = schedules.filter(s => (s.dayName || '').toLowerCase() === day.toLowerCase());
        });

        Object.keys(scheduleByDay).forEach(day => {
            scheduleByDay[day].sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
        });

        let html = `
            <div class="schedule-grid">
                ${daysOrder.map(day => `
                    <div class="day-column">
                        <div class="day-header">${day}</div>
                        ${scheduleByDay[day] && scheduleByDay[day].length > 0 ? 
                            scheduleByDay[day].map(s => `
                                <div class="time-slot">
                                    <div class="time">${formatTime(s.startTime)} - ${formatTime(s.endTime)}</div>
                                    <div class="class-name">${s.subjectName || 'Unknown Subject'}</div>
                                    <div class="section-name"><i class="fas fa-users"></i> ${s.sectionName || 'N/A'}</div>
                                    <div class="grade-name"><i class="fas fa-graduation-cap"></i> ${s.gradeName || 'N/A'}</div>
                                    ${s.room ? `<div class="room-name"><i class="fas fa-door-open"></i> ${s.room}</div>` : ''}
                                </div>
                            `).join('') 
                            : `<div class="empty-slot">No classes scheduled</div>`
                        }
                    </div>
                `).join('')}
            </div>
        `;

        scheduleContainer.innerHTML = html;
    }

    // ============================================
    // TOGGLE GRADE SECTION
    // ============================================

    window.toggleGrade = function(gradeId) {
        const content = document.getElementById('content_' + gradeId);
        const icon = document.getElementById('icon_' + gradeId);

        if (content) {
            content.classList.toggle('active');
            if (icon) icon.classList.toggle('rotated');
        }
    };

    // ============================================
    // HELPERS
    // ============================================

    function formatTime(timeStr) {
        if (!timeStr) return 'N/A';
        try {
            if (timeStr.includes('AM') || timeStr.includes('PM')) return timeStr;
            const [hours, minutes] = timeStr.split(':');
            const h = parseInt(hours, 10);
            const ampm = h >= 12 ? 'PM' : 'AM';
            const h12 = h % 12 || 12;
            return `${h12}:${minutes || '00'} ${ampm}`;
        } catch {
            return timeStr;
        }
    }

    // ============================================
    // TAB SWITCHING
    // ============================================

    function setupTabs() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const tabId = this.getAttribute('data-tab');

                tabBtns.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active-tab'));

                this.classList.add('active');
                const target = document.getElementById(tabId);
                if (target) target.classList.add('active-tab');
            });
        });
    }

    // ============================================
    // SET CURRENT DATE
    // ============================================

    const dateBadge = document.querySelector('.date-badge');
    if (dateBadge) {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateBadge.innerHTML = `<i class="fas fa-calendar-alt"></i> ${now.toLocaleDateString('en-US', options)}`;
    }

    // ============================================
    // ALERT SYSTEM
    // ============================================

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

    // Initialize
    setupTabs();
    loadAllData();

    console.log('✅ My Classes initialized with Supabase!');
})();