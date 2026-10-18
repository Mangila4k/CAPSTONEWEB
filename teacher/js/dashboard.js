/**
 * Teacher Dashboard - Supabase Integration
 */

import { supabase } from '../../supabase/config.js';
import {
    formatTime,
    formatDate,
    getTodayDateString,
    getLocalTimeString,
    getTeacherProfileAndSchedule,
    evaluateAttendanceStatus,
    recordTeacherAttendance
} from './schedule-helper.js';

(function() {
    'use strict';

    console.log('📚 Teacher Dashboard ready');

    // ============================================
    // DOM ELEMENTS
    // ============================================

    const teacherName = document.getElementById('teacherName');
    const teacherInitial = document.getElementById('teacherInitial');
    const logoutBtn = document.getElementById('logoutBtn');

    // Stats
    const totalStudents = document.getElementById('totalStudents');
    const totalSections = document.getElementById('totalSections');
    const totalSubjects = document.getElementById('totalSubjects');
    const totalGradeLevels = document.getElementById('totalGradeLevels');

    // Sections
    const sectionsList = document.getElementById('sectionsList');

    // Subjects
    const subjectsContainer = document.getElementById('subjectsContainer');

    // Alert container
    const alertContainer = document.getElementById('alertContainer');

    // ============================================
    // STATE
    // ============================================

    let sessionUser = null;
    let currentScheduleContext = null;
    let currentTeacherRecord = null;
    let teacherSchedules = [];
    let sections = [];
    let teacherSubjects = [];
    let subjectsByGrade = {};
    let handledGradeLevels = [];

    // Grade order
    const gradeOrder = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];

    // ============================================
    // SESSION CHECK
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
            } catch(err) {}
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
    // LOAD DASHBOARD DATA FROM SUPABASE
    // ============================================

    async function loadDashboardData() {
        try {
            await resolveTeacherRecord();
            await loadTeacherClassesAndSubjects();
            await updateStats();
            renderSections();
            renderSubjects();
            await loadFacultyAttendanceAndSchedule();
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            showAlert('❌ Error loading dashboard: ' + error.message, 'error');
        }
    }

    // ============================================
    // LOAD TEACHER CLASSES AND SUBJECTS (DYNAMIC)
    // ============================================

    async function loadTeacherClassesAndSubjects() {
        const teacher = await resolveTeacherRecord();
        const teacherId = teacher.id;
        const teacherUserId = teacher.user_id || sessionUser.id;

        // 1. Fetch schedules assigned strictly to this teacher
        teacherSchedules = [];
        try {
            let sQuery = supabase.from('schedules').select('*');
            if (teacherUserId && teacherUserId !== teacherId) {
                sQuery = sQuery.or(`teacher_id.eq.${teacherId},teacher_id.eq.${teacherUserId}`);
            } else {
                sQuery = sQuery.eq('teacher_id', teacherId);
            }
            const { data: sRows, error: sErr } = await sQuery;
            if (!sErr && sRows) {
                teacherSchedules = sRows;
            }
        } catch (e) {
            console.warn('Error fetching teacher schedules:', e);
        }

        // 2. Fetch sections assigned to teacher (via teaching schedules or as class adviser)
        const scheduledSectionIds = [...new Set(teacherSchedules.map(s => s.section_id).filter(Boolean))];
        const teacherSectionMap = new Map();

        // 2a. Fetch sections from schedules
        if (scheduledSectionIds.length > 0) {
            try {
                const { data: secRows, error: secErr } = await supabase
                    .from('sections')
                    .select('*')
                    .in('id', scheduledSectionIds);
                if (!secErr && secRows) {
                    secRows.forEach(sec => teacherSectionMap.set(sec.id, sec));
                }
            } catch (e) {
                console.warn('Error fetching scheduled sections:', e);
            }
        }

        // 2b. Fetch advisory sections
        try {
            const conds = [];
            if (teacherId) conds.push(`adviser_id.eq.${teacherId}`);
            if (teacherUserId && teacherUserId !== teacherId) conds.push(`adviser_id.eq.${teacherUserId}`);

            const lastName = sessionUser.lastName || sessionUser.last_name;
            if (lastName && lastName.length >= 3) {
                conds.push(`adviser_name.ilike.%${lastName}%`);
            }
            if (conds.length > 0) {
                const { data: advRows } = await supabase
                    .from('sections')
                    .select('*')
                    .or(conds.join(','));
                if (advRows) {
                    advRows.forEach(sec => teacherSectionMap.set(sec.id, sec));
                }
            }
        } catch (e) {
            console.warn('Error fetching advisory sections:', e);
        }

        sections = Array.from(teacherSectionMap.values()).sort((a, b) => (a.grade_level || '').localeCompare(b.grade_level || ''));
        console.log('📋 Teacher handling sections:', sections.length);

        // 3. Fetch subjects assigned strictly to this teacher
        const scheduledSubjectIds = [...new Set(teacherSchedules.map(s => s.subject_id).filter(Boolean))];
        teacherSubjects = [];
        subjectsByGrade = {};

        if (scheduledSubjectIds.length > 0) {
            try {
                const { data: subRows, error: subErr } = await supabase
                    .from('subjects')
                    .select('*')
                    .in('id', scheduledSubjectIds)
                    .order('name', { ascending: true });

                if (!subErr && subRows) {
                    teacherSubjects = subRows;
                    subRows.forEach(sub => {
                        let gradeName = sub.grade_level || 'General';
                        const parsedNum = parseInt(String(gradeName).replace(/[^0-9]/g, ''));
                        if (!isNaN(parsedNum) && parsedNum >= 7 && parsedNum <= 12) {
                            gradeName = `Grade ${parsedNum}`;
                        }
                        if (!subjectsByGrade[gradeName]) {
                            subjectsByGrade[gradeName] = [];
                        }
                        subjectsByGrade[gradeName].push(sub);
                    });
                }
            } catch (e) {
                console.warn('Error fetching teacher subjects:', e);
            }
        }
        console.log('📚 Teacher assigned subjects:', teacherSubjects.length);

        // 4. Distinct grade levels handled by this teacher
        const gradeLevelSet = new Set();
        sections.forEach(sec => {
            if (sec.grade_level) {
                const num = parseInt(String(sec.grade_level).replace(/[^0-9]/g, ''));
                gradeLevelSet.add(!isNaN(num) ? `Grade ${num}` : sec.grade_level);
            }
        });
        teacherSubjects.forEach(sub => {
            if (sub.grade_level) {
                const num = parseInt(String(sub.grade_level).replace(/[^0-9]/g, ''));
                gradeLevelSet.add(!isNaN(num) ? `Grade ${num}` : sub.grade_level);
            }
        });
        handledGradeLevels = Array.from(gradeLevelSet);
    }

    // ============================================
    // UPDATE STATS (DYNAMIC PER TEACHER)
    // ============================================

    async function updateStats() {
        // Enrolled students belonging to the teacher's handled sections
        let enrolledStudentCount = 0;
        const allTeacherSectionIds = sections.map(s => s.id).filter(Boolean);

        if (allTeacherSectionIds.length > 0) {
            try {
                const { count: studentCount, error: stErr } = await supabase
                    .from('students')
                    .select('id', { count: 'exact', head: true })
                    .in('section_id', allTeacherSectionIds);

                if (!stErr && studentCount !== null) {
                    enrolledStudentCount = studentCount;
                }
            } catch (e) {
                console.warn('Error counting students for teacher sections:', e);
            }
        }

        if (totalStudents) totalStudents.textContent = enrolledStudentCount;
        if (totalSections) totalSections.textContent = sections.length;
        if (totalSubjects) totalSubjects.textContent = teacherSubjects.length;
        if (totalGradeLevels) totalGradeLevels.textContent = handledGradeLevels.length;
    }

    // ============================================
    // RENDER SECTIONS
    // ============================================

    function renderSections() {
        if (!sectionsList) return;

        if (sections.length === 0) {
            sectionsList.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-layer-group"></i>
                    <p>No sections assigned yet</p>
                    <span style="font-size:0.75rem; color:#94a3b8; display:block; margin-top:4px;">Classes assigned by the administrator will appear here</span>
                </div>
            `;
            return;
        }

        sectionsList.innerHTML = sections.map(section => {
            const gradeName = section.grade_level || 'N/A';
            const strandText = section.strand ? ` (${section.strand})` : '';
            const isAdvisory = section.adviser_id === currentTeacherRecord?.id || 
                section.adviser_id === currentTeacherRecord?.user_id || 
                (section.adviser_name && sessionUser.lastName && section.adviser_name.toLowerCase().includes(sessionUser.lastName.toLowerCase()));
            const badgeLabel = isAdvisory ? 'Advisory' : 'Class';
            const badgeClass = isAdvisory ? 'badge primary' : 'badge';

            return `
                <div class="section-item">
                    <div class="section-info">
                        <h4>${section.name || 'Unknown Section'}</h4>
                        <p><i class="fas fa-tag"></i> ${gradeName}${strandText}</p>
                    </div>
                    <span class="${badgeClass}">${badgeLabel}</span>
                </div>
            `;
        }).join('');
    }

    // ============================================
    // RENDER SUBJECTS
    // ============================================

    function renderSubjects() {
        if (!subjectsContainer) return;

        if (teacherSubjects.length === 0 || Object.keys(subjectsByGrade).length === 0) {
            subjectsContainer.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-book"></i>
                    <p>No subjects assigned yet.</p>
                    <span style="font-size:0.75rem; color:#94a3b8; display:block; margin-top:4px;">Assigned teaching subjects will appear here</span>
                </div>
            `;
            return;
        }

        function getSubjectIcon(name) {
            const n = (name || '').toLowerCase();
            if (n.includes('computer') || n.includes('programming') || n.includes('servicing') || n.includes('ict') || n.includes('tech')) return 'fa-laptop-code';
            if (n.includes('science') || n.includes('biology') || n.includes('chemistry') || n.includes('physics') || n.includes('earth')) return 'fa-flask';
            if (n.includes('math') || n.includes('algebra') || n.includes('geometry') || n.includes('calculus') || n.includes('statistics')) return 'fa-calculator';
            if (n.includes('english') || n.includes('reading') || n.includes('literature') || n.includes('writing') || n.includes('purposes')) return 'fa-book-open';
            if (n.includes('filipino') || n.includes('komunikasyon') || n.includes('panitikan')) return 'fa-language';
            if (n.includes('history') || n.includes('society') || n.includes('politics') || n.includes('araling') || n.includes('humss')) return 'fa-landmark';
            if (n.includes('pe') || n.includes('physical') || n.includes('hope') || n.includes('mapeh') || n.includes('health')) return 'fa-running';
            if (n.includes('art') || n.includes('music')) return 'fa-palette';
            if (n.includes('values') || n.includes('esp') || n.includes('ethics') || n.includes('philosophy')) return 'fa-heart';
            return 'fa-book';
        }

        let html = '<div class="subjects-accordion">';

        gradeOrder.forEach(gradeName => {
            const subjects = subjectsByGrade[gradeName] || [];
            if (subjects.length === 0) return;

            const gradeId = gradeName.replace(/\s/g, '_');

            html += `
                <div class="grade-section">
                    <div class="grade-header" onclick="window.toggleGrade('${gradeId}')">
                        <div class="grade-title">
                            <i class="fas fa-graduation-cap"></i>
                            <span>${gradeName}</span>
                            <span class="subject-count">(${subjects.length} subjects)</span>
                        </div>
                        <i class="fas fa-chevron-down toggle-icon" id="icon_${gradeId}"></i>
                    </div>
                    <div class="grade-content" id="content_${gradeId}">
                        <div class="subject-list">
                            ${subjects.map(subject => {
                                const icon = getSubjectIcon(subject.name);
                                const category = subject.subject_type || 'Core';
                                const catClass = category.toLowerCase();
                                return `
                                    <div class="subject-item">
                                        <div class="subject-left">
                                            <div class="subject-item-icon">
                                                <i class="fas ${icon}"></i>
                                            </div>
                                            <div class="subject-info">
                                                <h4>${subject.name || subject.code || 'Unknown Subject'}</h4>
                                                <div>
                                                    ${subject.code ? `<span class="subject-code-tag-sm">${subject.code}</span>` : ''}
                                                    ${subject.semester ? `<span style="font-size:0.75rem; color:#6b7280; margin-left:4px;">· ${subject.semester}</span>` : ''}
                                                </div>
                                            </div>
                                        </div>
                                        <div class="subject-badges-col">
                                            <span class="subject-cat-tag ${catClass}">${category}</span>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        subjectsContainer.innerHTML = html;
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
    // FACULTY ATTENDANCE & ADJUSTED SCHEDULE
    // ============================================

    async function loadFacultyAttendanceAndSchedule() {
        try {
            const schedSubtitle = document.getElementById('fawScheduleSubtitle');
            const dayBadge = document.getElementById('fawDayBadge');
            const shiftBadge = document.getElementById('fawShiftBadge');
            const timeInDisplay = document.getElementById('fawTimeInDisplay');
            const timeInStatusTag = document.getElementById('fawTimeInStatusTag');
            const timeInNote = document.getElementById('fawTimeInNote');
            const timeOutDisplay = document.getElementById('fawTimeOutDisplay');
            const timeOutStatusTag = document.getElementById('fawTimeOutStatusTag');
            const timeOutNote = document.getElementById('fawTimeOutNote');
            const quickInBtn = document.getElementById('fawQuickTimeInBtn');
            const quickOutBtn = document.getElementById('fawQuickTimeOutBtn');
            const activityText = document.getElementById('fawActivityText');

            currentScheduleContext = await getTeacherProfileAndSchedule(supabase, sessionUser);
            const { teacherRecord, teacherProfile, adjustedSchedule, todayAttendance } = currentScheduleContext;
            const teacher = teacherRecord || teacherProfile || {};

            // Check if admin attached an official schedule document for this teacher
            const dashScheduleBadge = document.getElementById('dashScheduleBadge');
            if (dashScheduleBadge) {
                const teacherId = teacher.id || sessionUser?.id;
                const hasDoc = !!teacher.teacher_load_url ||
                    !!localStorage.getItem(`hes_teacher_load_doc_${teacherId}`) ||
                    (sessionUser?.id ? !!localStorage.getItem(`hes_teacher_load_doc_${sessionUser.id}`) : false);
                if (hasDoc) {
                    dashScheduleBadge.style.display = 'inline-flex';
                }
            }

            if (dayBadge) {
                dayBadge.innerHTML = `<i class="far fa-calendar-day"></i> ${adjustedSchedule.day || adjustedSchedule.dayName || 'Today'}`;
            }

            if (shiftBadge) {
                shiftBadge.style.display = 'none';
            }

            if (schedSubtitle) {
                if (adjustedSchedule.isDefaultFallback || !adjustedSchedule.hasClasses) {
                    schedSubtitle.textContent = 'Daily Faculty Attendance Record';
                } else {
                    schedSubtitle.textContent = `Assigned Teaching Schedule: ${adjustedSchedule.classesCount} class period(s) for ${adjustedSchedule.day || adjustedSchedule.dayName}`;
                }
            }

            function formatTimeString(t) {
                if (!t) return '--:-- --';
                try {
                    if (typeof t === 'string' && (t.includes('T') || t.includes('-'))) {
                        const d = new Date(t);
                        if (!isNaN(d.getTime())) {
                            return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                        }
                    }
                    if (typeof t === 'string' && (t.toUpperCase().includes('AM') || t.toUpperCase().includes('PM'))) return t;
                    if (typeof t === 'string' && t.includes(':')) {
                        const [h, m] = t.split(':').map(Number);
                        const period = h >= 12 ? 'PM' : 'AM';
                        const h12 = h % 12 || 12;
                        return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
                    }
                } catch(e) {}
                return t;
            }

            // Handle Time-In Display
            if (todayAttendance?.time_in) {
                const formattedIn = formatTimeString(todayAttendance.time_in);
                if (timeInDisplay) timeInDisplay.textContent = formattedIn;
                if (timeInStatusTag) {
                    timeInStatusTag.textContent = 'PRESENT';
                    timeInStatusTag.className = 'faw-tag success';
                }
                if (timeInNote) {
                    const method = todayAttendance.verification_mode || 'Direct Validation';
                    timeInNote.textContent = `Time-In validated (${method})`;
                }
                if (quickInBtn) {
                    quickInBtn.disabled = true;
                    quickInBtn.innerHTML = '<i class="fas fa-check"></i> Timed In';
                    quickInBtn.style.opacity = '0.7';
                    quickInBtn.style.cursor = 'default';
                }
            } else {
                if (timeInDisplay) timeInDisplay.textContent = '--:-- --';
                if (timeInStatusTag) {
                    timeInStatusTag.textContent = 'PENDING';
                    timeInStatusTag.className = 'faw-tag pending';
                }
                if (timeInNote) {
                    timeInNote.textContent = 'Ready for Time-In validation';
                }
                if (quickInBtn) {
                    quickInBtn.disabled = false;
                    quickInBtn.innerHTML = '<i class="fas fa-check-circle"></i> Validate Time-In';
                    quickInBtn.style.opacity = '1';
                    quickInBtn.style.cursor = 'pointer';
                }
            }

            // Handle Time-Out Display
            if (todayAttendance?.time_out) {
                const formattedOut = formatTimeString(todayAttendance.time_out);
                if (timeOutDisplay) timeOutDisplay.textContent = formattedOut;
                if (timeOutStatusTag) {
                    timeOutStatusTag.textContent = 'COMPLETED';
                    timeOutStatusTag.className = 'faw-tag success';
                }
                if (timeOutNote) {
                    const method = todayAttendance.verification_mode || 'Direct Validation';
                    timeOutNote.textContent = `Time-Out validated (${method})`;
                }
                if (quickOutBtn) {
                    quickOutBtn.disabled = true;
                    quickOutBtn.innerHTML = '<i class="fas fa-check"></i> Timed Out';
                    quickOutBtn.style.opacity = '0.7';
                    quickOutBtn.style.cursor = 'default';
                }
            } else if (todayAttendance?.time_in) {
                if (timeOutDisplay) timeOutDisplay.textContent = '--:-- --';
                if (timeOutStatusTag) {
                    timeOutStatusTag.textContent = 'READY';
                    timeOutStatusTag.className = 'faw-tag warning';
                }
                if (timeOutNote) {
                    timeOutNote.textContent = 'Ready for Time-Out validation';
                }
                if (quickOutBtn) {
                    quickOutBtn.disabled = false;
                    quickOutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Validate Time-Out';
                    quickOutBtn.style.opacity = '1';
                    quickOutBtn.style.cursor = 'pointer';
                }
            } else {
                if (timeOutDisplay) timeOutDisplay.textContent = '--:-- --';
                if (timeOutStatusTag) {
                    timeOutStatusTag.textContent = 'PENDING';
                    timeOutStatusTag.className = 'faw-tag pending';
                }
                if (timeOutNote) {
                    timeOutNote.textContent = 'Validate Time-In first';
                }
                if (quickOutBtn) {
                    quickOutBtn.disabled = true;
                    quickOutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Validate Time-Out';
                    quickOutBtn.style.opacity = '0.5';
                    quickOutBtn.style.cursor = 'not-allowed';
                }
            }

            // Activity log note for this teacher (scoped to today's activity)
            try {
                const teacherUserId = teacher.user_id || sessionUser.id;
                const todayDateStr = getTodayDateString();

                if (todayAttendance?.time_in && activityText) {
                    const inTime = formatTimeString(todayAttendance.time_in);
                    const outTime = todayAttendance.time_out ? ` | Time-Out: ${formatTimeString(todayAttendance.time_out)}` : '';
                    const mode = todayAttendance.verification_mode || 'Direct Validation';
                    activityText.textContent = `Today's attendance active: Time-In recorded at ${inTime}${outTime} via ${mode}.`;
                } else {
                    // Check if an activity log was recorded today
                    const { data: actLogs } = await supabase
                        .from('activity_logs')
                        .select('*')
                        .eq('user_id', teacherUserId)
                        .gte('timestamp', `${todayDateStr}T00:00:00`)
                        .order('timestamp', { ascending: false })
                        .limit(1);

                    if (actLogs && actLogs.length > 0 && activityText) {
                        const latest = actLogs[0];
                        activityText.textContent = `${latest.action}: ${latest.details || 'Biometric validation completed.'}`;
                    } else if (activityText) {
                        activityText.textContent = 'Ready for Time-In validation. Today\'s activities will appear here upon validation.';
                    }
                }
            } catch(e) {
                console.warn('Dashboard activity log note:', e);
            }

            // Load recent attendance history in the top widget
            await loadRecentAttendanceHistory(teacher);

        } catch(err) {
            console.error('Error loading faculty attendance & schedule:', err);
        }
    }

    // ============================================
    // RECENT ATTENDANCE HISTORY (TOP WIDGET)
    // ============================================
    async function loadRecentAttendanceHistory(teacher) {
        const historyTbody = document.getElementById('fawHistoryTableBody');
        const historyBadge = document.getElementById('fawHistoryCountBadge');
        if (!historyTbody) return;

        try {
            const teacherId = teacher?.id || sessionUser?.id;
            const recordsMap = new Map();

            // 1. Fetch from teacher_attendance table
            if (teacherId) {
                let query = supabase
                    .from('teacher_attendance')
                    .select('*');

                if (teacher?.user_id && teacher.user_id !== teacher.id) {
                    query = query.or(`teacher_id.eq.${teacher.id},teacher_id.eq.${teacher.user_id}`);
                } else {
                    query = query.eq('teacher_id', teacherId);
                }

                const { data: dbRows, error } = await query
                    .order('date', { ascending: false })
                    .limit(10);

                if (!error && dbRows) {
                    dbRows.forEach(r => {
                        recordsMap.set(r.date, {
                            date: r.date,
                            time_in: r.time_in ? formatTime(r.time_in) : '—',
                            time_out: r.time_out ? formatTime(r.time_out) : '—',
                            status: r.status || (r.time_out ? 'Completed' : (r.time_in ? 'Present' : 'Pending')),
                            method: r.verification_mode || 'Direct Validation'
                        });
                    });
                }
            }

            // 2. Fallback / Merge from attendance table
            try {
                let genQuery = supabase.from('attendance').select('*').order('date', { ascending: false }).limit(10);
                if (teacher?.user_id && teacher.user_id !== teacher.id) {
                    genQuery = genQuery.or(`teacher_id.eq.${teacher.id},user_id.eq.${teacher.user_id}`);
                } else if (teacherId) {
                    genQuery = genQuery.or(`teacher_id.eq.${teacherId},user_id.eq.${teacherId}`);
                }
                const { data: genRows } = await genQuery;
                if (genRows) {
                    genRows.forEach(r => {
                        const existing = recordsMap.get(r.date);
                        if (!existing) {
                            recordsMap.set(r.date, {
                                date: r.date,
                                time_in: r.time_in ? formatTime(r.time_in) : '—',
                                time_out: r.time_out ? formatTime(r.time_out) : '—',
                                status: r.status === 'present' ? 'Present' : (r.status || 'Present'),
                                method: 'Direct Validation'
                            });
                        } else {
                            if ((!existing.time_in || existing.time_in === '—') && r.time_in) {
                                existing.time_in = formatTime(r.time_in);
                            }
                            if ((!existing.time_out || existing.time_out === '—') && r.time_out) {
                                existing.time_out = formatTime(r.time_out);
                            }
                        }
                    });
                }
            } catch (gErr) {
                console.warn('General attendance query note:', gErr);
            }

            // 3. Merge with local storage cache to reflect immediate validation
            if (teacherId) {
                try {
                    const cacheKey = 'hes_teacher_attendance_' + teacherId;
                    const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
                    cached.forEach(c => {
                        const existing = recordsMap.get(c.date);
                        const cIn = c.time_in ? formatTime(c.time_in) : null;
                        const cOut = c.time_out ? formatTime(c.time_out) : null;
                        if (!existing) {
                            recordsMap.set(c.date, {
                                date: c.date,
                                time_in: cIn || '—',
                                time_out: cOut || '—',
                                status: c.status || (cOut ? 'Completed' : 'Present'),
                                method: c.validationMethod || 'Direct Validation'
                            });
                        } else {
                            if (cIn && (existing.time_in === '—' || existing.time_in === '--:-- --')) {
                                existing.time_in = cIn;
                            }
                            if (cOut && (existing.time_out === '—' || existing.time_out === '--:-- --')) {
                                existing.time_out = cOut;
                            }
                            if (c.validationMethod) existing.method = c.validationMethod;
                            if (c.status) existing.status = c.status;
                        }
                    });
                } catch(e) {}
            }

            const recordsList = Array.from(recordsMap.values()).sort((a, b) => new Date(b.date) - new Date(a.date));

            if (recordsList.length === 0) {
                historyTbody.innerHTML = `
                    <tr>
                        <td colspan="4" style="text-align: center; color: #94a3b8; padding: 18px 12px;">
                            <i class="fas fa-calendar-times" style="font-size: 1.25rem; margin-bottom: 4px; display: block; opacity: 0.6;"></i>
                            No recent attendance records found. Time-In or face attendance will appear here.
                        </td>
                    </tr>
                `;
                if (historyBadge) historyBadge.textContent = '0 records';
                return;
            }

            if (historyBadge) {
                historyBadge.textContent = `${recordsList.length} record${recordsList.length > 1 ? 's' : ''}`;
            }

            const todayDateStr = getTodayDateString();
            historyTbody.innerHTML = recordsList.slice(0, 5).map(r => {
                const d = new Date(r.date + (r.date.includes('T') ? '' : 'T00:00:00'));
                const formattedDate = isNaN(d.getTime()) ? r.date : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                const isToday = r.date === todayDateStr;
                const isFaceMethod = (r.method || '').toLowerCase().includes('face');
                const methodIcon = isFaceMethod ? 'fa-camera' : 'fa-shield-check';

                return `
                    <tr>
                        <td>
                            <strong>${formattedDate}</strong>
                            ${isToday ? '<span style="display:inline-block; margin-left:6px; font-size:0.68rem; font-weight:700; color:#2563eb; background:#eff6ff; padding:1px 6px; border-radius:10px; border:1px solid #bfdbfe;">TODAY</span>' : ''}
                        </td>
                        <td style="font-weight: 600; color: #1e293b;">${r.time_in}</td>
                        <td style="font-weight: 600; color: #1e293b;">${r.time_out}</td>
                        <td>
                            <span class="faw-history-method">
                                <i class="fas ${methodIcon}"></i> ${r.method}
                            </span>
                        </td>
                    </tr>
                `;
            }).join('');

        } catch (err) {
            console.error('Error loading recent attendance history:', err);
            historyTbody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; color: #ef4444; padding: 14px;">
                        <i class="fas fa-exclamation-triangle"></i> Failed to load history
                    </td>
                </tr>
            `;
        }
    }

    function setupAttendanceActions() {
        const quickInBtn = document.getElementById('fawQuickTimeInBtn');
        const quickOutBtn = document.getElementById('fawQuickTimeOutBtn');

        if (quickInBtn) {
            quickInBtn.addEventListener('click', async () => {
                if (!currentScheduleContext) return;
                quickInBtn.disabled = true;
                quickInBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Validating...';

                try {
                    const result = await recordTeacherAttendance(supabase, {
                        teacherRecord: currentScheduleContext.teacherRecord || currentScheduleContext.teacherProfile,
                        user: sessionUser,
                        displayName: (sessionUser.firstName ? `${sessionUser.firstName} ${sessionUser.lastName || ''}`.trim() : 'Teacher'),
                        actionType: 'time_in',
                        validationMethod: 'Direct Validation',
                        adjustedSchedule: currentScheduleContext.adjustedSchedule || currentScheduleContext.todaySchedule
                    });

                    showAlert(`✅ Time-In recorded at ${result.timeFormatted}!`, 'success');
                    await loadFacultyAttendanceAndSchedule();
                } catch(err) {
                    console.error('Validation error:', err);
                    showAlert('❌ Time-In validation failed: ' + err.message, 'error');
                    quickInBtn.disabled = false;
                    quickInBtn.innerHTML = '<i class="fas fa-check-circle"></i> Validate Time-In';
                }
            });
        }

        if (quickOutBtn) {
            quickOutBtn.addEventListener('click', async () => {
                if (!currentScheduleContext) return;
                quickOutBtn.disabled = true;
                quickOutBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Validating...';

                try {
                    const result = await recordTeacherAttendance(supabase, {
                        teacherRecord: currentScheduleContext.teacherRecord || currentScheduleContext.teacherProfile,
                        user: sessionUser,
                        displayName: (sessionUser.firstName ? `${sessionUser.firstName} ${sessionUser.lastName || ''}`.trim() : 'Teacher'),
                        actionType: 'time_out',
                        validationMethod: 'Direct Validation',
                        adjustedSchedule: currentScheduleContext.adjustedSchedule || currentScheduleContext.todaySchedule
                    });

                    showAlert(`✅ Time-Out recorded at ${result.timeFormatted}!`, 'success');
                    await loadFacultyAttendanceAndSchedule();
                } catch(err) {
                    console.error('Validation error:', err);
                    showAlert('❌ Time-Out validation failed: ' + err.message, 'error');
                    quickOutBtn.disabled = false;
                    quickOutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Validate Time-Out';
                }
            });
        }
    }

    // Auto-refresh attendance whenever window regains focus, tab becomes visible, page restores, or storage changes
    window.addEventListener('focus', () => {
        loadFacultyAttendanceAndSchedule();
    });
    window.addEventListener('pageshow', () => {
        loadFacultyAttendanceAndSchedule();
    });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            loadFacultyAttendanceAndSchedule();
        }
    });
    window.addEventListener('storage', (e) => {
        if (e.key && (e.key.startsWith('hes_teacher_attendance') || e.key === 'currentUser')) {
            loadFacultyAttendanceAndSchedule();
        }
    });
    window.addEventListener('teacher-attendance-updated', () => {
        console.log('🔄 Teacher attendance updated event received');
        loadFacultyAttendanceAndSchedule();
    });

    try {
        supabase
            .channel('teacher_dashboard_attendance_sync')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'teacher_attendance'
            }, () => {
                console.log('🔄 Live teacher attendance change received');
                loadFacultyAttendanceAndSchedule();
            })
            .subscribe();
    } catch(e) {
        console.warn('Realtime subscription notice:', e);
    }

    // Initialize
    setupAttendanceActions();
    loadDashboardData();

    console.log('✅ Teacher Dashboard initialized!');
})();