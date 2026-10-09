/**
 * Student Schedule - Supabase Integration
 * HES - HES, Hiraya Enrollment System
 */

import { supabase } from '../../supabase/config.js';

(function() {
    'use strict';

    console.log('📅 Student Schedule (Supabase) ready');

    // ============================================
    // DOM ELEMENTS
    // ============================================

    const studentName = document.getElementById('studentName');
    const studentInitial = document.getElementById('studentInitial');
    const logoutBtn = document.getElementById('logoutBtn');

    // Section info
    const sectionName = document.getElementById('sectionName');
    const gradeDisplay = document.getElementById('gradeDisplay');
    const schoolYearDisplay = document.getElementById('schoolYearDisplay');

    // Stats
    const totalClasses = document.getElementById('totalClasses');
    const totalSubjects = document.getElementById('totalSubjects');
    const totalTeachers = document.getElementById('totalTeachers');
    const freePeriods = document.getElementById('freePeriods');

    // Today's classes
    const todayClasses = document.getElementById('todayClasses');
    const todayName = document.getElementById('todayName');

    // Schedule table
    const scheduleBody = document.getElementById('scheduleBody');

    // Summary
    const subjectsList = document.getElementById('subjectsList');
    const teachersList = document.getElementById('teachersList');
    const sectionInfo = document.getElementById('sectionInfo');

    // Alert container
    const alertContainer = document.getElementById('alertContainer');

    // ============================================
    // STATE
    // ============================================

    let currentEnrollment = null;
    let studentRow = null;
    let schedules = [];
    const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

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

    function formatTime(timeStr) {
        if (!timeStr) return '';
        if (/am|pm/i.test(timeStr)) return timeStr.trim();
        const parts = String(timeStr).split(':');
        if (parts.length >= 2) {
            let hour = parseInt(parts[0], 10);
            const minute = parts[1].padStart(2, '0');
            if (isNaN(hour)) return timeStr;
            const ampm = hour >= 12 ? 'PM' : 'AM';
            hour = hour % 12;
            if (hour === 0) hour = 12;
            return `${hour}:${minute} ${ampm}`;
        }
        return timeStr;
    }

    // ============================================
    // LOAD SCHEDULE DATA
    // ============================================

    async function loadScheduleData() {
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

            // 3. Section resolution & fetch section document metadata
            let secName = studentRow?.section_name || currentEnrollment?.section || '';
            let sectionId = studentRow?.section_id;
            let sectionRecord = null;

            if (sectionId) {
                try {
                    const { data: secData } = await supabase
                        .from('sections')
                        .select('*')
                        .eq('id', sectionId)
                        .maybeSingle();
                    if (secData) {
                        sectionRecord = secData;
                        if (secData.name) secName = secData.name;
                    }
                } catch(e) {}
            } else if (secName) {
                try {
                    const { data: secData } = await supabase
                        .from('sections')
                        .select('*')
                        .ilike('name', `%${secName.trim()}%`)
                        .maybeSingle();
                    if (secData) {
                        sectionRecord = secData;
                        sectionId = secData.id;
                    }
                } catch(e) {}
            }

            // If still no section record, try getting first section by grade
            if (!sectionRecord) {
                try {
                    const targetGrade = (currentEnrollment?.grade_level || studentRow?.grade_level || '11').replace(/\D/g, '');
                    const { data: secList } = await supabase
                        .from('sections')
                        .select('*')
                        .ilike('grade_level', `%${targetGrade || '11'}%`)
                        .limit(1);
                    if (secList && secList.length > 0) {
                        sectionRecord = secList[0];
                        sectionId = sectionRecord.id;
                        if (!secName) secName = sectionRecord.name;
                    }
                } catch(e) {}
            }

            if (sectionName) sectionName.textContent = secName || 'Section 11 - C';
            if (gradeDisplay) gradeDisplay.textContent = currentEnrollment?.grade_level || studentRow?.grade_level || sectionRecord?.grade_level || 'Grade 11';
            if (schoolYearDisplay) schoolYearDisplay.textContent = currentEnrollment?.school_year || currentEnrollment?.last_school_year || '2025-2026';

            // 4. Load schedules, subjects, and users from Supabase
            let hasDatabaseSchedules = false;
            try {
                const [{ data: schedData }, { data: subjectsData }, { data: usersData }] = await Promise.all([
                    supabase.from('schedules').select('*'),
                    supabase.from('subjects').select('*'),
                    supabase.from('users').select('id, first_name, last_name, email, role')
                ]);

                if (schedData && schedData.length > 0) {
                    let filtered = schedData;
                    if (sectionId) {
                        const secFiltered = schedData.filter(s => s.section_id === sectionId);
                        if (secFiltered.length > 0) filtered = secFiltered;
                    }

                    schedules = filtered.map(s => {
                        // 1. Resolve Subject Name
                        let subName = s.subject || s.subject_name || s.subject_title || s.name || s.title || s.subject_code;
                        if (!subName && s.subject_id) {
                            const foundSub = subjectsData?.find(sub => sub.id === s.subject_id || sub.code === s.subject_id);
                            if (foundSub) {
                                subName = foundSub.name || foundSub.title || foundSub.description;
                            }
                        }
                        if (!subName || subName === 'undefined' || subName === 'null') {
                            subName = 'General Subject';
                        }

                        // 2. Resolve Teacher Name
                        let teacherName = s.teacher || s.teacher_name;
                        if (!teacherName && s.teacher_id) {
                            const foundUser = usersData?.find(u => u.id === s.teacher_id);
                            if (foundUser) {
                                teacherName = `${foundUser.first_name || ''} ${foundUser.last_name || ''}`.trim() || foundUser.email;
                            }
                        }
                        if (!teacherName || teacherName === 'undefined' || teacherName === 'null') {
                            teacherName = '';
                        }

                        return {
                            id: s.id,
                            day: s.day || 'Monday',
                            subject: subName,
                            teacher: teacherName,
                            room: s.room || s.room_name || 'Room 101',
                            start_time: s.start_time || '07:30',
                            end_time: s.end_time || '08:30',
                            section_id: s.section_id
                        };
                    });

                    if (schedules.length > 0) {
                        hasDatabaseSchedules = true;
                    }
                }
            } catch(e) {
                console.warn('Error loading schedule rows:', e);
            }

            // Load official uploaded schedule document from teacher (PDF, Google Docs, or Image)
            const uploadedDoc = loadUploadedScheduleBanner(sectionId, secName, sectionRecord);

            // Handle when student is missing individual timetable entries
            if (!hasDatabaseSchedules) {
                // If teacher uploaded a document (PDF or Google Docs), use fallback UI with embedded preview
                if (uploadedDoc) {
                    renderMissingTimetableWithDocFallback(uploadedDoc, secName);
                } else {
                    // If no uploaded document either, show empty notice
                    renderEmptyTimetableNotice(secName);
                }
            } else {
                // Normal timetable rendering with active table
                const noticeEl = document.getElementById('scheduleFallbackNotice');
                if (noticeEl) noticeEl.style.display = 'none';
                const tableWrap = document.getElementById('scheduleTableWrapper');
                if (tableWrap) tableWrap.style.display = 'block';

                renderScheduleUI(secName);
            }

            // Setup print schedule handler & letterhead with full metadata for official 1-page bond paper printing
            const curStudentName = studentName?.textContent || (sessionUser.firstName ? `${sessionUser.firstName} ${sessionUser.lastName || ''}`.trim() : 'Student');
            setupPrintScheduleHandler({
                fullName: curStudentName,
                lrn: studentRow?.lrn || currentEnrollment?.lrn || '108472910482',
                section: secName || 'Section 11 - C',
                grade: gradeDisplay?.textContent || studentRow?.grade_level || currentEnrollment?.grade_level || 'Grade 11',
                strand: studentRow?.strand || currentEnrollment?.strand || 'TVL - ICT',
                schoolYear: schoolYearDisplay?.textContent || currentEnrollment?.school_year || '2025-2026',
                adviser: studentRow?.adviser || currentEnrollment?.adviser || 'Mrs. Carmen Santos',
                schedules: schedules
            });

        } catch (error) {
            console.error('Error loading schedule data:', error);
            showAlert('❌ Error loading schedule: ' + error.message, 'error');
        }
    }

    function getDefaultSchedule(grade) {
        return [
            { day: 'Monday', subject: 'Oral Communication in Context', start_time: '07:30', end_time: '08:30', room: 'Room 201', teacher: 'Mrs. Santos' },
            { day: 'Monday', subject: 'General Mathematics', start_time: '08:30', end_time: '09:30', room: 'Room 201', teacher: 'Mr. Cruz' },
            { day: 'Monday', subject: 'Computer Systems Servicing', start_time: '10:00', end_time: '12:00', room: 'ICT Lab 1', teacher: 'Engr. Reyes' },
            { day: 'Tuesday', subject: 'Earth and Life Science', start_time: '07:30', end_time: '08:30', room: 'Science Lab', teacher: 'Ms. Garcia' },
            { day: 'Tuesday', subject: 'Komunikasyon at Pananaliksik', start_time: '08:30', end_time: '09:30', room: 'Room 201', teacher: 'G. Ramos' },
            { day: 'Tuesday', subject: 'Programming (Java/Web)', start_time: '10:00', end_time: '12:00', room: 'ICT Lab 2', teacher: 'Mr. Destinado' },
            { day: 'Wednesday', subject: 'Oral Communication in Context', start_time: '07:30', end_time: '08:30', room: 'Room 201', teacher: 'Mrs. Santos' },
            { day: 'Wednesday', subject: 'General Mathematics', start_time: '08:30', end_time: '09:30', room: 'Room 201', teacher: 'Mr. Cruz' },
            { day: 'Wednesday', subject: 'Physical Education 1', start_time: '10:00', end_time: '11:00', room: 'Gymnasium', teacher: 'Coach Perez' },
            { day: 'Thursday', subject: 'Earth and Life Science', start_time: '07:30', end_time: '08:30', room: 'Science Lab', teacher: 'Ms. Garcia' },
            { day: 'Thursday', subject: 'Komunikasyon at Pananaliksik', start_time: '08:30', end_time: '09:30', room: 'Room 201', teacher: 'G. Ramos' },
            { day: 'Thursday', subject: 'Empowerment Technologies', start_time: '10:00', end_time: '12:00', room: 'ICT Lab 1', teacher: 'Ms. Sellar' },
            { day: 'Friday', subject: 'Homeroom Guidance', start_time: '07:30', end_time: '08:30', room: 'Room 201', teacher: 'Mrs. Santos' },
            { day: 'Friday', subject: 'Computer Systems Servicing', start_time: '08:30', end_time: '10:30', room: 'ICT Lab 1', teacher: 'Engr. Reyes' }
        ];
    }

    function renderScheduleUI(secName) {
        // Stats
        const uniqueSubjs = [...new Set(schedules.map(s => s.subject).filter(Boolean))];
        const uniqueTchs = [...new Set(schedules.map(s => s.teacher).filter(Boolean))];

        if (totalClasses) totalClasses.textContent = schedules.length;
        if (totalSubjects) totalSubjects.textContent = uniqueSubjs.length || 7;
        if (totalTeachers) totalTeachers.textContent = uniqueTchs.length || 6;
        if (freePeriods) freePeriods.textContent = '2 Periods';

        // Today's classes
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDayIndex = new Date().getDay();
        const currentDayName = (currentDayIndex >= 1 && currentDayIndex <= 5) ? dayNames[currentDayIndex] : 'Monday';

        if (todayName) todayName.textContent = currentDayName;

        const todaysList = schedules.filter(s => (s.day || '').toLowerCase() === currentDayName.toLowerCase());

        if (todayClasses) {
            if (todaysList.length === 0) {
                todayClasses.innerHTML = `
                    <div class="empty-classes" style="padding: 12px; color: #64748b; font-size: 0.9rem;">
                        <i class="fas fa-calendar-day"></i> No classes scheduled for today.
                    </div>
                `;
            } else {
                todayClasses.innerHTML = todaysList.map(c => `
                    <div class="today-class-card">
                        <div class="class-time"><i class="far fa-clock"></i> ${formatTime(c.start_time)} - ${formatTime(c.end_time)}</div>
                        <div class="class-subject">${c.subject}</div>
                        <div class="class-meta">
                            <span><i class="fas fa-map-marker-alt"></i> ${c.room || 'Room 101'}</span>
                            ${c.teacher ? `<span><i class="fas fa-chalkboard-teacher"></i> ${c.teacher}</span>` : ''}
                        </div>
                    </div>
                `).join('');
            }
        }

        // Weekly schedule table
        if (scheduleBody) {
            const timeSlots = [
                { start: '07:30', end: '08:30', label: '07:30 - 08:30 AM', isRecess: false },
                { start: '08:30', end: '09:30', label: '08:30 - 09:30 AM', isRecess: false },
                { start: '09:30', end: '10:00', label: '09:30 - 10:00 AM', isRecess: true },
                { start: '10:00', end: '11:00', label: '10:00 - 11:00 AM', isRecess: false },
                { start: '11:00', end: '12:00', label: '11:00 - 12:00 PM', isRecess: false }
            ];

            // Check if there are afternoon classes in schedules (e.g. starting after 12:00)
            const hasAfternoon = schedules.some(s => {
                const h = parseInt(String(s.start_time).split(':')[0], 10);
                return h >= 12;
            });

            if (hasAfternoon) {
                timeSlots.push(
                    { start: '12:00', end: '13:00', label: '12:00 - 01:00 PM', isRecess: true, title: 'NOON BREAK' },
                    { start: '13:00', end: '14:00', label: '01:00 - 02:00 PM', isRecess: false },
                    { start: '14:00', end: '15:00', label: '02:00 - 03:00 PM', isRecess: false }
                );
            }

            scheduleBody.innerHTML = timeSlots.map(slot => {
                if (slot.isRecess) {
                    return `
                        <tr class="recess-row">
                            <td class="time-col"><strong>${slot.label}</strong></td>
                            <td colspan="5" class="recess-cell" style="text-align: center; background: #fef3c7; color: #92400e; font-weight: 700;">
                                <i class="fas fa-coffee"></i> ${slot.title || 'BREAK / RECESS'}
                            </td>
                        </tr>
                    `;
                }

                const sHour = parseInt(slot.start.split(':')[0], 10);

                const dayCells = daysOrder.map(day => {
                    const match = schedules.find(s => {
                        if ((s.day || '').toLowerCase() !== day.toLowerCase()) return false;
                        const parts = String(s.start_time).split(':');
                        const h = parseInt(parts[0], 10);
                        return h === sHour;
                    });

                    if (match) {
                        return `
                            <td class="schedule-cell active">
                                <div class="class-item">
                                    <div class="subject-name">${match.subject}</div>
                                    <div class="teacher-name"><i class="fas fa-chalkboard-user"></i> ${match.teacher || 'Faculty'}</div>
                                    <div class="room"><i class="fas fa-door-open"></i> ${match.room || 'Room 101'}</div>
                                </div>
                            </td>
                        `;
                    }
                    return `<td class="schedule-cell empty"><div class="empty-cell"><span>--</span></div></td>`;
                }).join('');

                return `
                    <tr>
                        <td class="time-col"><strong>${slot.label}</strong></td>
                        ${dayCells}
                    </tr>
                `;
            }).join('');
        }

        // Summary lists & badges
        const subjectCountBadge = document.getElementById('subjectCountBadge');
        const teacherCountBadge = document.getElementById('teacherCountBadge');

        if (subjectCountBadge) subjectCountBadge.textContent = uniqueSubjs.length;
        if (teacherCountBadge) teacherCountBadge.textContent = uniqueTchs.length;

        if (subjectsList) {
            subjectsList.innerHTML = uniqueSubjs.map(s => `<li><i class="fas fa-book"></i> ${s}</li>`).join('');
        }

        if (teachersList) {
            if (uniqueTchs.length === 0) {
                teachersList.innerHTML = `<li><i class="fas fa-chalkboard-teacher"></i> Faculty Teachers</li>`;
            } else {
                teachersList.innerHTML = uniqueTchs.map(t => `<li><i class="fas fa-chalkboard-teacher"></i> ${t}</li>`).join('');
            }
        }

        if (sectionInfo) {
            sectionInfo.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; font-size: 0.9rem; color: #334155;">
                    <div><strong>Section:</strong> ${secName || 'Section 11 - C'}</div>
                    <div><strong>Grade Level:</strong> ${gradeDisplay?.textContent || 'Grade 11'}</div>
                    <div><strong>School Year:</strong> ${schoolYearDisplay?.textContent || '2025-2026'}</div>
                    <div><strong>Total Classes:</strong> ${schedules.length} scheduled</div>
                </div>
            `;
        }
    }

    // ============================================
    // OFFICIAL UPLOADED SCHEDULE & PRINT HANDLERS
    // ============================================

    let currentSectionUploadedDoc = null;

    function getGoogleDocsEmbedUrl(url) {
        if (!url) return '';
        if (url.includes('/edit')) {
            return url.replace(/\/edit.*$/, '/preview');
        }
        if (url.includes('drive.google.com/file/d/')) {
            return url.replace(/\/view.*$/, '/preview');
        }
        if (url.includes('docs.google.com') && !url.includes('/preview')) {
            return url.replace(/\/?$/, '/preview');
        }
        return url;
    }

    function loadUploadedScheduleBanner(sectionId, secName, sectionRecord) {
        const banner = document.getElementById('uploadedDocBanner');
        const udbTitle = document.getElementById('udbTitle');
        const udbMeta = document.getElementById('udbMeta');
        const udbIcon = document.getElementById('udbIcon');
        const udbBadge = document.getElementById('udbBadge');
        const btnOpenGDocs = document.getElementById('btnOpenGDocsSchedule');
        const btnView = document.getElementById('btnViewUploadedSchedule');
        const btnDownload = document.getElementById('btnDownloadUploadedSchedule');
        const btnPrintDoc = document.getElementById('btnPrintUploadedSchedule');

        let docData = null;

        // 1. Check Supabase section record first
        if (sectionRecord && sectionRecord.schedule_doc_url) {
            const isGDocs = sectionRecord.schedule_doc_type === 'google_docs' ||
                            (sectionRecord.schedule_doc_url || '').includes('docs.google.com') ||
                            (sectionRecord.schedule_doc_url || '').includes('drive.google.com');
            const isImg = (sectionRecord.schedule_doc_type || '').startsWith('image/') ||
                          /\.(png|jpe?g|webp|gif)$/i.test(sectionRecord.schedule_doc_name || '') ||
                          (sectionRecord.schedule_doc_url && sectionRecord.schedule_doc_url.startsWith('data:image/'));

            docData = {
                sectionId: sectionRecord.id || sectionId,
                sectionName: sectionRecord.name || secName,
                fileName: sectionRecord.schedule_doc_name || (isGDocs ? `${secName || 'Section'} Student Load (Google Docs)` : isImg ? `${secName || 'Section'}_Student_Load_Schedule.png` : 'Section_Student_Load.pdf'),
                fileType: sectionRecord.schedule_doc_type || (isGDocs ? 'google_docs' : isImg ? 'image/png' : 'application/pdf'),
                fileData: sectionRecord.schedule_doc_url,
                url: sectionRecord.schedule_doc_url,
                isGoogleDocs: isGDocs,
                isImage: isImg,
                uploadDate: sectionRecord.schedule_doc_updated_at || new Date().toISOString(),
                uploadedBy: sectionRecord.schedule_doc_uploaded_by || 'Class Adviser / Teacher'
            };
        } else {
            // 2. Fallback to localStorage
            const raw = (sectionId ? localStorage.getItem('hes_section_schedule_' + sectionId) : null) ||
                        (secName ? localStorage.getItem('hes_section_schedule_' + secName.trim().toUpperCase()) : null);

            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    if (parsed && (parsed.fileData || parsed.url)) {
                        docData = parsed;
                    }
                } catch(e) {}
            }
        }

        if (!docData || (!docData.fileData && !docData.url)) {
            if (banner) banner.style.display = 'none';
            currentSectionUploadedDoc = null;
            return null;
        }

        currentSectionUploadedDoc = docData;
        const isGoogleDocs = docData.isGoogleDocs || docData.fileType === 'google_docs' || (docData.url && (docData.url.includes('docs.google.com') || docData.url.includes('drive.google.com')));
        const isPdf = (docData.fileType || '').includes('pdf') || (docData.fileName || '').toLowerCase().endsWith('.pdf');
        const isImg = docData.isImage || (docData.fileType || '').startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(docData.fileName || '') || (docData.url && docData.url.startsWith('data:image/'));

        if (banner) banner.style.display = 'flex';
        if (udbTitle) udbTitle.textContent = docData.fileName || (isGoogleDocs ? 'Official Student Load (Google Docs)' : isImg ? 'Official Student Load Schedule Image' : 'Official Student Load Document');
        
        if (udbMeta) {
            const dateStr = docData.uploadDate ? new Date(docData.uploadDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently';
            const sizeStr = docData.fileSizeFormatted ? ` • ${docData.fileSizeFormatted}` : '';
            const byStr = docData.uploadedBy ? `Sent by ${docData.uploadedBy}` : 'Sent by Teacher';
            udbMeta.textContent = `${isGoogleDocs ? 'Google Docs Link' : isImg ? 'Schedule Image' : 'Official File'} • ${byStr} • ${dateStr}${sizeStr}`;
        }

        if (udbBadge) {
            udbBadge.innerHTML = isGoogleDocs ? '<i class="fab fa-google-drive"></i> Active Google Doc' : isImg ? '<i class="fas fa-file-image"></i> Schedule Image' : '<i class="fas fa-file-pdf"></i> Official PDF';
            udbBadge.style.background = isGoogleDocs ? 'rgba(37, 99, 235, 0.1)' : isImg ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
            udbBadge.style.color = isGoogleDocs ? '#2563eb' : isImg ? '#059669' : '#dc2626';
            udbBadge.style.borderColor = isGoogleDocs ? 'rgba(37, 99, 235, 0.3)' : isImg ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)';
        }

        if (udbIcon) {
            if (isGoogleDocs) {
                udbIcon.innerHTML = '<i class="fab fa-google-drive" style="color: #4285F4;"></i>';
                udbIcon.style.background = 'rgba(66, 133, 244, 0.1)';
            } else if (isImg) {
                udbIcon.innerHTML = '<i class="fas fa-file-image" style="color: #10b981;"></i>';
                udbIcon.style.background = 'rgba(16, 185, 129, 0.1)';
            } else {
                udbIcon.innerHTML = '<i class="fas fa-file-pdf" style="color: #ef4444;"></i>';
                udbIcon.style.background = 'rgba(239, 68, 68, 0.1)';
            }
        }

        // Action buttons
        if (btnOpenGDocs) {
            if (isGoogleDocs) {
                btnOpenGDocs.style.display = 'inline-flex';
                btnOpenGDocs.href = docData.url || docData.fileData;
            } else {
                btnOpenGDocs.style.display = 'none';
            }
        }

        if (btnView) {
            btnView.style.display = 'inline-flex';
            btnView.innerHTML = isGoogleDocs ? '<i class="fas fa-eye"></i> Preview Doc' : '<i class="fas fa-eye"></i> View Full';
            btnView.onclick = () => openStudentDocViewer(docData);
        }

        if (btnDownload) {
            btnDownload.style.display = isGoogleDocs ? 'none' : 'inline-flex';
            btnDownload.onclick = () => downloadStudentDoc(docData);
        }

        if (btnPrintDoc) {
            btnPrintDoc.style.display = isGoogleDocs ? 'none' : 'inline-flex';
            btnPrintDoc.onclick = () => printUploadedDoc(docData);
        }

        return docData;
    }

    function renderMissingTimetableWithDocFallback(doc, secName) {
        const noticeEl = document.getElementById('scheduleFallbackNotice');
        const tableWrap = document.getElementById('scheduleTableWrapper');

        if (tableWrap) tableWrap.style.display = 'none';
        if (!noticeEl) return;

        const isGoogleDocs = doc.isGoogleDocs || doc.fileType === 'google_docs' || (doc.url && (doc.url.includes('docs.google.com') || doc.url.includes('drive.google.com')));
        const isPdf = (doc.fileType || '').includes('pdf') || (doc.fileName || '').toLowerCase().endsWith('.pdf');
        const isImg = doc.isImage || (doc.fileType || '').startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(doc.fileName || '') || (doc.url && doc.url.startsWith('data:image/'));
        const docUrl = doc.url || doc.fileData || '';
        const previewUrl = isGoogleDocs ? getGoogleDocsEmbedUrl(docUrl) : docUrl;

        let embedMarkup = '';
        if (isGoogleDocs) {
            embedMarkup = `<iframe src="${previewUrl}" class="schedule-doc-preview-frame" title="Google Docs Student Load Preview"></iframe>`;
        } else if (isPdf) {
            embedMarkup = `<iframe src="${docUrl}" class="schedule-doc-preview-frame" title="PDF Student Load Preview"></iframe>`;
        } else {
            embedMarkup = `<img src="${docUrl}" alt="Student Load Schedule Preview" style="max-width: 100%; max-height: 480px; object-fit: contain; border-radius: 8px; margin: 0 auto; display: block; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">`;
        }

        const iconMarkup = isGoogleDocs 
            ? '<i class="fab fa-google-drive" style="color: #4285F4;"></i>' 
            : isImg 
                ? '<i class="fas fa-file-image" style="color: #10b981;"></i>' 
                : '<i class="fas fa-file-pdf" style="color: #ef4444;"></i>';

        const titleText = isGoogleDocs 
            ? 'Official Google Docs Student Load Available' 
            : isImg 
                ? 'Official Student Load Schedule Image Available' 
                : 'Official PDF Student Load Available';

        noticeEl.style.display = 'block';
        noticeEl.innerHTML = `
            <div class="schedule-doc-fallback-card">
                <div class="schedule-doc-fallback-header">
                    <div class="schedule-doc-fallback-icon">
                        ${iconMarkup}
                    </div>
                    <div class="schedule-doc-fallback-title">
                        <h3>${titleText}</h3>
                        <p>Your teacher sent the official section student load schedule (<strong>${doc.fileName || 'Official Student Load'}</strong>). Individual timetable slots have not been entered into the grid yet, so please view your schedule below:</p>
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        ${isGoogleDocs ? `
                            <a href="${docUrl}" target="_blank" class="btn-udb gdocs" style="padding: 8px 16px; font-size: 0.9rem;">
                                <i class="fab fa-google-drive"></i> Open in Google Docs
                            </a>
                            <button type="button" class="btn-udb view" id="btnFallbackPreview" style="padding: 8px 16px; font-size: 0.9rem;">
                                <i class="fas fa-expand"></i> Fullscreen Preview
                            </button>
                        ` : `
                            <button type="button" class="btn-udb view" id="btnFallbackPreview" style="padding: 8px 16px; font-size: 0.9rem;">
                                <i class="fas fa-eye"></i> View Fullscreen
                            </button>
                            <button type="button" class="btn-udb download" id="btnFallbackDownload" style="padding: 8px 16px; font-size: 0.9rem;">
                                <i class="fas fa-download"></i> ${isImg ? 'Download Image' : 'Download PDF'}
                            </button>
                        `}
                    </div>
                </div>
                <div style="margin-top: 10px; width: 100%; border-radius: 8px; overflow: hidden;">
                    ${embedMarkup}
                </div>
            </div>
        `;

        const btnPreview = document.getElementById('btnFallbackPreview');
        if (btnPreview) btnPreview.onclick = () => openStudentDocViewer(doc);

        const btnDownload = document.getElementById('btnFallbackDownload');
        if (btnDownload) btnDownload.onclick = () => downloadStudentDoc(doc);

        if (sectionInfo) {
            sectionInfo.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; font-size: 0.9rem; color: #334155;">
                    <div><strong>Section:</strong> ${secName || 'Section 11 - C'}</div>
                    <div><strong>Grade Level:</strong> ${gradeDisplay?.textContent || 'Grade 11'}</div>
                    <div><strong>School Year:</strong> ${schoolYearDisplay?.textContent || '2025-2026'}</div>
                    <div><strong>Official Document:</strong> ${doc.fileName || 'Student Load'}</div>
                </div>
            `;
        }

        if (subjectsList) {
            subjectsList.innerHTML = `<li style="color: var(--gray-600);"><i class="fas fa-file-alt"></i> See official student load schedule image/document above for complete subject breakdown.</li>`;
        }
        if (teachersList) {
            teachersList.innerHTML = `<li style="color: var(--gray-600);"><i class="fas fa-chalkboard-teacher"></i> Listed in the official student load schedule image/document above.</li>`;
        }
    }

    function renderEmptyTimetableNotice(secName) {
        const noticeEl = document.getElementById('scheduleFallbackNotice');
        const tableWrap = document.getElementById('scheduleTableWrapper');

        if (tableWrap) tableWrap.style.display = 'none';
        if (!noticeEl) return;

        noticeEl.style.display = 'block';
        noticeEl.innerHTML = `
            <div style="text-align: center; padding: 48px 24px; background: #fff; border-radius: 12px; border: 1.5px dashed var(--gray-300); margin-bottom: 24px;">
                <div style="width: 60px; height: 60px; border-radius: 50%; background: #eff6ff; color: #2563eb; display: inline-flex; align-items: center; justify-content: center; font-size: 1.8rem; margin-bottom: 14px;">
                    <i class="fas fa-calendar-times"></i>
                </div>
                <h3 style="color: var(--primary); font-size: 1.15rem; font-weight: 700; margin-bottom: 6px;">No Class Program Published Yet</h3>
                <p style="color: var(--gray-500); font-size: 0.9rem; max-width: 480px; margin: 0 auto; line-height: 1.5;">
                    Your class adviser or subject teachers have not uploaded the official class program or student load schedule for <strong>${secName || 'your section'}</strong> yet. Please check back later or consult your homeroom teacher.
                </p>
            </div>
        `;
    }

    function setupPrintScheduleHandler(data) {
        const btnPrint = document.getElementById('btnPrintSchedule');
        const printStudent = document.getElementById('printStudentName');
        const printLrn = document.getElementById('printStudentLrn');
        const printSec = document.getElementById('printGradeSection');
        const printTrack = document.getElementById('printTrackStrand');
        const printSy = document.getElementById('printSchoolYear');
        const printAdviser = document.getElementById('printAdviserName');
        const printSigAdviser = document.getElementById('printSigAdviser');
        const printList = document.getElementById('printSubjectsSummaryList');

        if (printStudent) printStudent.textContent = data.fullName || 'Student';
        if (printLrn) printLrn.textContent = data.lrn || '108472910482';
        if (printSec) printSec.textContent = `${data.grade || 'Grade 11'} - ${data.section || 'Section'}`;
        if (printTrack) printTrack.textContent = data.strand || 'TVL - ICT';
        if (printSy) printSy.textContent = data.schoolYear || '2025-2026';
        if (printAdviser) printAdviser.textContent = data.adviser || 'Mrs. Carmen Santos';
        if (printSigAdviser) printSigAdviser.textContent = (data.adviser || 'Mrs. Carmen Santos').toUpperCase();

        if (printList && data.schedules) {
            const uniqueSubjs = [];
            const seen = new Set();
            data.schedules.forEach(s => {
                if (s.subject && !seen.has(s.subject)) {
                    seen.add(s.subject);
                    uniqueSubjs.push(s);
                }
            });

            printList.innerHTML = uniqueSubjs.map(s => `
                <div class="pss-item">
                    <strong>• ${s.subject}:</strong> ${s.teacher || 'Faculty'} <span style="color:#666;">(${s.room || 'Rm 101'})</span>
                </div>
            `).join('');
        }

        if (btnPrint) {
            btnPrint.onclick = () => {
                window.print();
            };
        }
    }

    function openStudentDocViewer(doc) {
        if (!doc || (!doc.fileData && !doc.url)) return;
        const modal = document.getElementById('modalStudentDocViewer');
        const container = document.getElementById('studentDocViewerContent');
        const titleEl = document.getElementById('studentDocViewerTitle');
        const closeBtn = document.getElementById('btnCloseStudentDocViewer');
        const printBtn = document.getElementById('btnPrintFromViewer');
        const extBtn = document.getElementById('btnOpenInNewTabFromViewer');

        if (!modal || !container) return;

        const isGoogleDocs = doc.isGoogleDocs || doc.fileType === 'google_docs' || (doc.url && (doc.url.includes('docs.google.com') || doc.url.includes('drive.google.com')));
        const isPdf = (doc.fileType || '').includes('pdf') || (doc.fileName || '').toLowerCase().endsWith('.pdf');
        const isImg = doc.isImage || (doc.fileType || '').startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(doc.fileName || '') || (doc.url && doc.url.startsWith('data:image/'));
        const docUrl = doc.url || doc.fileData || '';

        if (titleEl) {
            titleEl.innerHTML = isGoogleDocs 
                ? `<i class="fab fa-google-drive" style="color: #4285F4;"></i> ${doc.fileName || 'Google Docs Student Load'}`
                : isImg 
                    ? `<i class="fas fa-file-image" style="color: #10b981;"></i> ${doc.fileName || 'Student Load Schedule Image'}`
                    : `<i class="fas fa-file-pdf" style="color: #ef4444;"></i> ${doc.fileName || 'PDF Student Load'}`;
        }

        if (extBtn) {
            extBtn.style.display = 'inline-flex';
            extBtn.href = docUrl;
        }

        if (isGoogleDocs) {
            const embedUrl = getGoogleDocsEmbedUrl(docUrl);
            container.innerHTML = `<iframe src="${embedUrl}" style="width: 100%; height: 100%; border: none; border-radius: 8px;" allowfullscreen></iframe>`;
            if (printBtn) printBtn.style.display = 'none';
        } else if (isPdf) {
            container.innerHTML = `<iframe src="${docUrl}" style="width: 100%; height: 100%; border: none; border-radius: 8px;"></iframe>`;
            if (printBtn) {
                printBtn.style.display = 'inline-flex';
                printBtn.onclick = () => printUploadedDoc(doc);
            }
        } else {
            container.innerHTML = `<img src="${docUrl}" alt="Student Load Schedule Preview" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">`;
            if (printBtn) {
                printBtn.style.display = 'inline-flex';
                printBtn.onclick = () => printUploadedDoc(doc);
            }
        }

        if (closeBtn) closeBtn.onclick = () => { modal.style.display = 'none'; };

        modal.style.display = 'flex';
    }

    function downloadStudentDoc(doc) {
        if (!doc || (!doc.fileData && !doc.url)) return;
        const a = document.createElement('a');
        a.href = doc.fileData || doc.url;
        a.download = doc.fileName || `Student_Load_${doc.sectionName || ''}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function printUploadedDoc(doc) {
        if (!doc || (!doc.fileData && !doc.url)) return;
        const printWin = window.open('', '_blank');
        const isPdf = (doc.fileType || '').includes('pdf') || (doc.fileName || '').toLowerCase().endsWith('.pdf');
        const fileSrc = doc.fileData || doc.url;
        if (isPdf) {
            printWin.document.write(`
                <html><head><title>Print Student Load Schedule - ${doc.fileName || 'Schedule'}</title></head>
                <body style="margin:0;padding:0;">
                    <iframe src="${fileSrc}" style="width:100vw;height:100vh;border:none;"></iframe>
                </body></html>
            `);
        } else {
            printWin.document.write(`
                <html><head><title>Print Student Load Schedule - ${doc.fileName || 'Schedule Image'}</title>
                <style>
                    @page { size: letter portrait; margin: 6mm 8mm; }
                    html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; display: flex; align-items: center; justify-content: center; }
                    img { max-width: 100%; max-height: 100%; object-fit: contain; }
                </style>
                </head>
                <body onload="window.print();">
                    <img src="${fileSrc}" alt="Student Load Schedule">
                </body></html>
            `);
        }
        printWin.document.close();
    }

    // Auto-update banner if teacher uploads file in another tab
    window.addEventListener('storage', (e) => {
        if (e.key && e.key.startsWith('hes_section_schedule')) {
            loadScheduleData();
        }
    });

    // Initialize
    loadScheduleData();

})();