/**
 * Teacher View Section - Supabase Integration & Attendance Manager
 * Exclusively empowers teachers to record section attendance and notify students
 */

import { supabase } from '../../supabase/config.js';

(function() {
    'use strict';

    console.log('📋 Section Details & Attendance Manager ready');

    // ============================================
    // DOM ELEMENTS
    // ============================================

    const teacherName = document.getElementById('teacherName');
    const teacherInitial = document.getElementById('teacherInitial');
    const logoutBtn = document.getElementById('logoutBtn');
    const alertContainer = document.getElementById('alertContainer');

    // Section header elements
    const sectionName = document.getElementById('sectionName');
    const sectionGrade = document.getElementById('sectionGrade');
    const adviserName = document.getElementById('adviserName');
    const isAdviserBadge = document.getElementById('isAdviserBadge');

    // Stats
    const totalStudents = document.getElementById('totalStudents');
    const totalSubjects = document.getElementById('totalSubjects');
    const attendanceRate = document.getElementById('attendanceRate');
    const subjectsTaught = document.getElementById('subjectsTaught');

    // Tabs
    const tabAttendanceBtn = document.getElementById('tabAttendanceBtn');
    const tabStudentsBtn = document.getElementById('tabStudentsBtn');
    const tabScheduleBtn = document.getElementById('tabScheduleBtn');
    const sectionAttendancePanel = document.getElementById('sectionAttendancePanel');
    const sectionStudentsPanel = document.getElementById('sectionStudentsPanel');
    const sectionSchedulePanel = document.getElementById('sectionSchedulePanel');
    const tabStudentCount = document.getElementById('tabStudentCount');

    // Attendance Manager controls
    const sectionAttDate = document.getElementById('sectionAttDate');
    const dateWeekdayBadge = document.getElementById('dateWeekdayBadge');
    const weekendNoticeBanner = document.getElementById('weekendNoticeBanner');
    const markAllPresentBtn = document.getElementById('markAllPresentBtn');
    const saveSectionAttendanceBtn = document.getElementById('saveSectionAttendanceBtn');
    const sectionAttendanceBody = document.getElementById('sectionAttendanceBody');

    // Attendance counter pills
    const countPresent = document.getElementById('countPresent');
    const countLate = document.getElementById('countLate');
    const countAbsent = document.getElementById('countAbsent');
    const countExcused = document.getElementById('countExcused');

    // Student directory & schedule
    const studentsBody = document.getElementById('studentsBody');
    const studentCountBadge = document.getElementById('studentCountBadge');
    const scheduleList = document.getElementById('scheduleList');
    const scheduleCountBadge = document.getElementById('scheduleCountBadge');

    // ============================================
    // STATE
    // ============================================

    let sessionUser = null;
    let teacherId = null;
    let currentSectionId = null;
    let sectionData = null;
    let enrolledStudents = [];
    let classSchedules = [];
    let allSubjects = [];
    let allTeachers = [];
    let currentUploadedSchedule = null;
    let sectionAttendanceState = {}; // student_id -> { status, timeIn, timeOut, remarks }
    let isWeekendSelected = false;

    // ============================================
    // AUTH CHECK
    // ============================================

    try {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            sessionUser = JSON.parse(stored);
        }
    } catch (e) {
        console.error('Session error:', e);
    }

    if (!sessionUser) {
        window.location.replace('../auth/login.html');
        return;
    }

    if (sessionUser.role && sessionUser.role !== 'teacher' && sessionUser.role !== 'admin') {
        window.location.replace('../auth/login.html');
        return;
    }

    teacherId = sessionUser.id || sessionUser.uid;
    const displayName = (sessionUser.firstName ? `${sessionUser.firstName} ${sessionUser.lastName || ''}`.trim() : (sessionUser.email ? sessionUser.email.split('@')[0] : 'Teacher'));
    if (teacherName) teacherName.textContent = displayName;
    if (teacherInitial) teacherInitial.textContent = displayName.charAt(0).toUpperCase();

    // ============================================
    // LOGOUT
    // ============================================

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
    // HELPERS & ALERTS
    // ============================================

    function showAlert(message, type = 'success') {
        if (!alertContainer) return;
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.style.margin = '15px 0';
        const icon = type === 'success' ? 'fa-check-circle' : (type === 'warning' ? 'fa-exclamation-triangle' : 'fa-exclamation-circle');
        alertDiv.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
        alertContainer.appendChild(alertDiv);

        setTimeout(() => {
            alertDiv.style.opacity = '0';
            setTimeout(() => alertDiv.remove(), 300);
        }, 5000);
    }

    function formatDate(dateStr) {
        if (!dateStr) return 'N/A';
        try {
            const d = new Date(dateStr + 'T00:00:00');
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        } catch {
            return dateStr;
        }
    }

    function checkIsWeekend(dateStr) {
        if (!dateStr) return false;
        try {
            const d = new Date(dateStr + 'T00:00:00');
            const day = d.getDay();
            return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
        } catch {
            return false;
        }
    }

    // ============================================
    // INITIAL DATE SETUP
    // ============================================

    const todayObj = new Date();
    const todayStr = today.toISOString().split('T')[0];
    if (sectionAttDate) {
        sectionAttDate.value = todayStr;
    }

    // ============================================
    // TAB MANAGEMENT
    // ============================================

    function switchSectionTab(targetTab) {
        const tabs = [
            { btn: tabAttendanceBtn, panel: sectionAttendancePanel },
            { btn: tabStudentsBtn, panel: sectionStudentsPanel },
            { btn: tabScheduleBtn, panel: sectionSchedulePanel }
        ];

        tabs.forEach(t => {
            if (t.btn && t.panel) {
                if (t.btn.id === targetTab) {
                    t.btn.classList.add('active');
                    t.btn.style.background = 'var(--primary)';
                    t.btn.style.color = '#fff';
                    t.panel.style.display = 'block';
                } else {
                    t.btn.classList.remove('active');
                    t.btn.style.background = '#fff';
                    t.btn.style.color = 'var(--gray-700)';
                    t.panel.style.display = 'none';
                }
            }
        });
    }

    if (tabAttendanceBtn) tabAttendanceBtn.addEventListener('click', () => switchSectionTab('tabAttendanceBtn'));
    if (tabStudentsBtn) tabStudentsBtn.addEventListener('click', () => switchSectionTab('tabStudentsBtn'));
    if (tabScheduleBtn) tabScheduleBtn.addEventListener('click', () => switchSectionTab('tabScheduleBtn'));

    // ============================================
    // LOAD SECTION DETAILS
    // ============================================

    async function initializeSection() {
        const urlParams = new URLSearchParams(window.location.search);
        currentSectionId = urlParams.get('id');

        try {
            // 1. Fetch section info from Supabase
            let secDoc = null;
            if (currentSectionId) {
                const { data } = await supabase
                    .from('sections')
                    .select('*')
                    .eq('id', currentSectionId)
                    .maybeSingle();
                secDoc = data;
            }

            // Fallback to first available section if no ID specified
            if (!secDoc) {
                const { data: allSecs } = await supabase
                    .from('sections')
                    .select('*')
                    .limit(1);
                if (allSecs && allSecs.length > 0) {
                    secDoc = allSecs[0];
                    currentSectionId = secDoc.id;
                }
            }

            if (!secDoc) {
                secDoc = {
                    id: currentSectionId || 'SEC-STEM-11A',
                    name: 'Grade 11 - STEM A',
                    grade_level: 'Grade 11',
                    strand: 'STEM',
                    adviser_id: teacherId,
                    adviser_name: displayName
                };
            }

            sectionData = secDoc;
            renderSectionHeader(secDoc);

            // 2. Load enrolled students for this section
            await loadEnrolledStudents(currentSectionId);

            // 3. Load schedules for this section
            await loadSectionSchedules(currentSectionId);
            setupScheduleHandlers();

            // 4. Load attendance for the active date
            handleDateSelectionChange();

        } catch (err) {
            console.error('Error initializing section:', err);
            showAlert('Failed to load section: ' + err.message, 'error');
        }
    }

    function renderSectionHeader(sec) {
        const secTitle = sec.name || sec.section_name || 'Section Overview';
        const gradeText = sec.grade_level || sec.grade || 'Grade 11';
        const strandText = sec.strand ? ` • ${sec.strand}` : '';
        const advName = sec.adviser_name || sec.adviserName || (sec.adviser_id === teacherId ? displayName : 'Teacher Faculty');

        if (sectionName) sectionName.textContent = secTitle;
        if (sectionGrade) sectionGrade.textContent = `${gradeText}${strandText}`;
        if (adviserName) adviserName.textContent = advName;

        const isUserAdviser = (sec.adviser_id === teacherId) || (sec.adviser_name && sec.adviser_name.toLowerCase() === displayName.toLowerCase());
        if (isAdviserBadge) {
            isAdviserBadge.style.display = isUserAdviser ? 'inline-flex' : 'none';
        }
    }

    // ============================================
    // LOAD ENROLLED STUDENTS
    // ============================================

    async function loadEnrolledStudents(sectionId) {
        let list = [];
        try {
            // Query Supabase students matching section
            const { data: stuData } = await supabase
                .from('students')
                .select('*')
                .eq('section_id', sectionId)
                .order('last_name', { ascending: true });

            if (stuData && stuData.length > 0) {
                list = stuData.map(s => ({
                    id: s.id,
                    lrn: s.lrn || '109876543201',
                    fullname: `${s.last_name || ''}, ${s.first_name || ''} ${s.middle_name ? s.middle_name.charAt(0) + '.' : ''}`.trim(),
                    email: s.email || 'N/A',
                    gender: s.gender || 'N/A',
                    status: s.status || 'Enrolled',
                    avatar: s.avatar_url || null
                }));
            }
        } catch (e) {
            console.warn('Students query notice:', e);
        }

        // If no students returned from section_id, query general enrolled students
        if (list.length === 0) {
            try {
                const { data: allStudents } = await supabase
                    .from('students')
                    .select('*')
                    .limit(15);

                if (allStudents && allStudents.length > 0) {
                    list = allStudents.map(s => ({
                        id: s.id,
                        lrn: s.lrn || '109876543201',
                        fullname: `${s.last_name || ''}, ${s.first_name || ''}`.trim() || s.name || 'Student',
                        email: s.email || 'N/A',
                        gender: s.gender || 'N/A',
                        status: 'Enrolled',
                        avatar: s.avatar_url || null
                    }));
                }
            } catch (err) {}
        }

        // Fallback realistic roster if database is completely empty
        if (list.length === 0) {
            list = [
                { id: 'STU-001', lrn: '109876543201', fullname: 'Aquino, Christian Paul D.', email: 'c.aquino@student.hes.edu', status: 'Enrolled' },
                { id: 'STU-002', lrn: '109876543202', fullname: 'Bautista, Maria Angela S.', email: 'm.bautista@student.hes.edu', status: 'Enrolled' },
                { id: 'STU-003', lrn: '109876543203', fullname: 'Cruz, John Kenneth L.', email: 'jk.cruz@student.hes.edu', status: 'Enrolled' },
                { id: 'STU-004', lrn: '109876543204', fullname: 'Dela Cruz, Juan M.', email: 'j.delacruz@student.hes.edu', status: 'Enrolled' },
                { id: 'STU-005', lrn: '109876543205', fullname: 'Flores, Jasmine Nicole R.', email: 'j.flores@student.hes.edu', status: 'Enrolled' },
                { id: 'STU-006', lrn: '109876543206', fullname: 'Gonzales, Gabriel K.', email: 'g.gonzales@student.hes.edu', status: 'Enrolled' },
                { id: 'STU-007', lrn: '109876543207', fullname: 'Mendoza, Princess Joyce V.', email: 'pj.mendoza@student.hes.edu', status: 'Enrolled' },
                { id: 'STU-008', lrn: '109876543208', fullname: 'Navarro, Ethan James C.', email: 'e.navarro@student.hes.edu', status: 'Enrolled' }
            ];
        }

        // Sort alphabetically by last name
        list.sort((a, b) => a.fullname.localeCompare(b.fullname));
        enrolledStudents = list;

        // Update counts
        if (totalStudents) totalStudents.textContent = list.length;
        if (studentCountBadge) studentCountBadge.textContent = `${list.length} students`;
        if (tabStudentCount) tabStudentCount.textContent = list.length;

        renderStudentDirectory(list);
    }

    function renderStudentDirectory(list) {
        if (!studentsBody) return;

        if (list.length === 0) {
            studentsBody.innerHTML = `
                <tr>
                    <td colspan="3">
                        <div class="no-data">
                            <i class="fas fa-user-graduate"></i>
                            <p>No students enrolled in this section.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        studentsBody.innerHTML = list.map(student => {
            const initial = student.fullname.charAt(0).toUpperCase();
            return `
                <tr>
                    <td>
                        <div class="student-info" style="display: flex; align-items: center; gap: 12px;">
                            <div class="student-avatar" style="width: 38px; height: 38px; border-radius: 50%; background: var(--primary); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700;">
                                ${initial}
                            </div>
                            <div class="student-details">
                                <h4 style="font-weight: 600; font-size: 0.95rem; margin-bottom: 2px;">${student.fullname}</h4>
                                <div class="student-meta" style="font-size: 0.8rem; color: var(--gray-500); display: flex; gap: 12px;">
                                    <span><i class="fas fa-id-card"></i> ${student.lrn}</span>
                                    <span><i class="fas fa-envelope"></i> ${student.email}</span>
                                </div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="status-badge" style="background: #dcfce7; color: #15803d; font-weight: 600; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem;">
                            <i class="fas fa-check-circle"></i> ${student.status}
                        </span>
                    </td>
                    <td>
                        <div class="action-btns">
                            <a href="view-student.html?id=${student.id}" class="action-btn view" title="View Student Profile" style="padding: 6px 12px; background: var(--gray-100); border-radius: 6px; color: var(--primary); text-decoration: none; font-size: 0.85rem; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
                                <i class="fas fa-eye"></i> View
                            </a>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // ============================================
    // LOAD SECTION SCHEDULES & DOCUMENT UPLOAD
    // ============================================

    function formatTimeDisplay(t) {
        if (!t) return '--:--';
        try {
            if (t.toUpperCase().includes('AM') || t.toUpperCase().includes('PM')) return t;
            const parts = t.split(':');
            const h = parseInt(parts[0], 10);
            const m = parts[1] || '00';
            const period = h >= 12 ? 'PM' : 'AM';
            const h12 = h % 12 || 12;
            return `${String(h12).padStart(2, '0')}:${m} ${period}`;
        } catch(e) {
            return t;
        }
    }

    async function loadSectionSchedules(sectionId) {
        try {
            // 1. Load subjects and teachers for period dropdown & mapping
            const [{ data: sRows }, { data: subjRows }, { data: tchrRows }] = await Promise.all([
                supabase.from('schedules').select('*').eq('section_id', sectionId),
                supabase.from('subjects').select('*').order('name', { ascending: true }),
                supabase.from('teachers').select('id, employee_id, user_id, users(first_name, last_name, email)')
            ]);

            allSubjects = subjRows || [];
            allTeachers = tchrRows || [];
            populatePeriodFormSelects();

            // 2. Map schedules
            if (sRows && sRows.length > 0) {
                // Sort by day order and start time
                const dayWeight = { 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6, 'Sunday': 7 };
                classSchedules = sRows.sort((a, b) => {
                    const dDiff = (dayWeight[a.day] || 99) - (dayWeight[b.day] || 99);
                    if (dDiff !== 0) return dDiff;
                    return (a.start_time || '').localeCompare(b.start_time || '');
                }).map(s => {
                    const sub = allSubjects.find(sub => sub.id === s.subject_id);
                    const tch = allTeachers.find(t => t.id === s.teacher_id || t.user_id === s.teacher_id);
                    const teacherName = tch?.users ? `${tch.users.first_name || ''} ${tch.users.last_name || ''}`.trim() : (s.teacher_name || 'Faculty');
                    return {
                        id: s.id,
                        section_id: s.section_id,
                        subject_id: s.subject_id,
                        subject: sub ? (sub.name || sub.code) : (s.subject || s.subject_name || 'General Subject'),
                        subject_code: sub?.code || '',
                        teacher_id: s.teacher_id,
                        teacher: teacherName,
                        day: s.day || 'Monday',
                        start_time: s.start_time || '07:30:00',
                        end_time: s.end_time || '08:30:00',
                        room: s.room || 'Room 101'
                    };
                });
            } else {
                classSchedules = [];
            }

            if (totalSubjects) totalSubjects.textContent = classSchedules.length;
            if (subjectsTaught) subjectsTaught.textContent = classSchedules.length > 0 ? new Set(classSchedules.map(c => c.subject)).size : 0;
            if (scheduleCountBadge) scheduleCountBadge.textContent = `${classSchedules.length} classes`;

            renderSchedule(classSchedules);

            // 3. Load uploaded official schedule document
            loadUploadedScheduleDoc(sectionId);

        } catch (e) {
            console.warn('Schedule load notice:', e);
        }
    }

    function populatePeriodFormSelects() {
        const subSelect = document.getElementById('periodSubjectSelect');
        const tchSelect = document.getElementById('periodTeacherSelect');

        if (subSelect && allSubjects.length > 0) {
            subSelect.innerHTML = '<option value="">Select Subject...</option>' + 
                allSubjects.map(s => `<option value="${s.id}">${s.name || s.code} (${s.code || 'Core'})</option>`).join('');
        }

        if (tchSelect && allTeachers.length > 0) {
            tchSelect.innerHTML = '<option value="">Assign Teacher (Optional)...</option>' +
                allTeachers.map(t => {
                    const name = t.users ? `${t.users.first_name || ''} ${t.users.last_name || ''}`.trim() : (t.employee_id || 'Teacher');
                    return `<option value="${t.id}">${name} (${t.employee_id || 'Faculty'})</option>`;
                }).join('');
        }
    }

    async function loadUploadedScheduleDoc(sectionId) {
        const secName = sectionData?.name || '';
        let docData = null;

        // 1. Try from database section record first
        if (sectionData?.schedule_doc_url) {
            const isGDocs = sectionData.schedule_doc_type === 'google_docs' || (sectionData.schedule_doc_url || '').includes('docs.google.com') || (sectionData.schedule_doc_url || '').includes('drive.google.com');
            const isImg = (sectionData.schedule_doc_type || '').startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(sectionData.schedule_doc_name || '') || (sectionData.schedule_doc_url && sectionData.schedule_doc_url.startsWith('data:image/'));

            docData = {
                sectionId: currentSectionId,
                sectionName: secName,
                fileName: sectionData.schedule_doc_name || (isGDocs ? `${secName} Student Load (Google Docs)` : isImg ? `${secName}_Student_Load.png` : 'Student_Load.pdf'),
                fileType: sectionData.schedule_doc_type || (isGDocs ? 'google_docs' : isImg ? 'image/png' : 'application/pdf'),
                fileData: sectionData.schedule_doc_url,
                url: sectionData.schedule_doc_url,
                isGoogleDocs: isGDocs,
                isImage: isImg,
                uploadDate: sectionData.schedule_doc_updated_at || new Date().toISOString(),
                uploadedBy: sectionData.schedule_doc_uploaded_by || 'Teacher'
            };
        } else {
            // 2. Fallback to localStorage
            const raw = localStorage.getItem('hes_section_schedule_' + sectionId) ||
                        (secName ? localStorage.getItem('hes_section_schedule_' + secName.trim().toUpperCase()) : null);
            if (raw) {
                try {
                    docData = JSON.parse(raw);
                } catch(e) {}
            }
        }

        const uploadedBox = document.getElementById('uploadedScheduleBox');
        const dropzone = document.getElementById('scheduleUploadDropzone');
        const activeBadge = document.getElementById('docActiveBadge');
        const fileNameEl = document.getElementById('docFileName');
        const metaEl = document.getElementById('docMetaInfo');
        const iconBox = document.getElementById('docIconBox');
        const openGDocBtn = document.getElementById('btnOpenGDocLink');
        const previewBtn = document.getElementById('btnPreviewUploadedDoc');
        const downloadBtn = document.getElementById('btnDownloadUploadedDoc');

        if (docData && (docData.fileData || docData.url)) {
            currentUploadedSchedule = docData;
            const isGDocs = docData.isGoogleDocs || docData.fileType === 'google_docs' || (docData.url && (docData.url.includes('docs.google.com') || docData.url.includes('drive.google.com')));
            const isImg = docData.isImage || (docData.fileType || '').startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(docData.fileName || '') || (docData.fileData && docData.fileData.startsWith('data:image/'));

            if (uploadedBox) uploadedBox.style.display = 'block';
            if (dropzone) dropzone.style.display = 'none';
            if (activeBadge) {
                activeBadge.style.display = 'inline-flex';
                activeBadge.innerHTML = isGDocs 
                    ? '<i class="fab fa-google-drive"></i> Active Google Doc' 
                    : isImg 
                        ? '<i class="fas fa-file-image"></i> Active Schedule Image' 
                        : '<i class="fas fa-file-pdf"></i> Active PDF Document';
                activeBadge.style.background = isGDocs ? '#eff6ff' : isImg ? '#ecfdf5' : '#fef2f2';
                activeBadge.style.color = isGDocs ? '#1d4ed8' : isImg ? '#047857' : '#b91c1c';
                activeBadge.style.borderColor = isGDocs ? '#bfdbfe' : isImg ? '#a7f3d0' : '#fecaca';
            }
            if (fileNameEl) fileNameEl.textContent = docData.fileName || (isGDocs ? `${secName} Student Load (Google Docs)` : isImg ? `${secName}_Student_Load.png` : 'Student_Load.pdf');
            if (metaEl) {
                const dateStr = docData.uploadDate ? new Date(docData.uploadDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently';
                const sizeStr = docData.fileSizeFormatted ? ` • ${docData.fileSizeFormatted}` : '';
                const byStr = docData.uploadedBy ? `Assigned by ${docData.uploadedBy}` : 'Assigned by Teacher';
                metaEl.textContent = `${isGDocs ? 'Google Docs Student Load' : isImg ? 'Schedule Image' : 'PDF Document'} • Sent on ${dateStr}${sizeStr} • ${byStr}`;
            }
            if (iconBox) {
                if (isGDocs) {
                    iconBox.innerHTML = '<i class="fab fa-google-drive" style="color: #4285F4; font-size: 1.6rem;"></i>';
                } else if (isImg) {
                    iconBox.innerHTML = '<i class="fas fa-file-image text-success"></i>';
                } else {
                    iconBox.innerHTML = '<i class="fas fa-file-pdf text-danger"></i>';
                }
            }

            if (openGDocBtn) {
                if (isGDocs) {
                    openGDocBtn.style.display = 'inline-flex';
                    openGDocBtn.href = docData.url || docData.fileData;
                } else {
                    openGDocBtn.style.display = 'none';
                }
            }
            if (downloadBtn) {
                downloadBtn.style.display = isGDocs ? 'none' : 'inline-flex';
            }
            if (previewBtn) {
                previewBtn.style.display = 'inline-flex';
            }
        } else {
            currentUploadedSchedule = null;
            if (uploadedBox) uploadedBox.style.display = 'none';
            if (dropzone) dropzone.style.display = 'block';
            if (activeBadge) activeBadge.style.display = 'none';
            if (openGDocBtn) openGDocBtn.style.display = 'none';
        }
    }

    function renderSchedule(schedules) {
        if (!scheduleList) return;
        if (schedules.length === 0) {
            scheduleList.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-calendar-times"></i>
                    <h3>No Timetable Periods Yet</h3>
                    <p>No individual class periods have been added for this section. Click "+ Add Class Period" or send the student load schedule image/document above.</p>
                </div>
            `;
            return;
        }

        scheduleList.innerHTML = schedules.map(item => `
            <div class="schedule-item" style="display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; border-bottom: 1px solid var(--gray-200); background: #fff; transition: background 0.2s;">
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span style="font-weight: 700; color: var(--primary); font-size: 0.96rem;">${item.subject || 'Subject'}</span>
                        ${item.subject_code ? `<span class="badge" style="background: rgba(11,43,74,0.08); color: var(--primary); font-size: 0.72rem; padding: 2px 8px; border-radius: 4px;">${item.subject_code}</span>` : ''}
                    </div>
                    <div style="color: var(--gray-500); font-size: 0.85rem; margin-top: 4px; display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
                        <span><i class="fas fa-clock text-primary"></i> ${formatTimeDisplay(item.start_time)} - ${formatTimeDisplay(item.end_time)}</span>
                        <span><i class="fas fa-door-open text-primary"></i> ${item.room || 'Room 101'}</span>
                        <span><i class="fas fa-chalkboard-teacher text-primary"></i> ${item.teacher || 'Faculty'}</span>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="badge" style="background: var(--gray-100); color: var(--primary); font-weight: 600; padding: 6px 12px; border-radius: 8px;">
                        ${item.day}
                    </span>
                    <button type="button" onclick="window.editSchedulePeriod('${item.id}')" title="Edit Period" style="background: #fff; border: 1px solid var(--gray-300); color: var(--primary); width: 32px; height: 32px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button type="button" onclick="window.deleteSchedulePeriod('${item.id}')" title="Delete Period" style="background: #fff; border: 1px solid #fca5a5; color: #ef4444; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    // Schedule actions: Upload, Edit, Delete, View, Download, Print
    function setupScheduleHandlers() {
        const fileInput = document.getElementById('scheduleFileInput');
        const triggerBtn = document.getElementById('btnTriggerUpload');
        const dropzone = document.getElementById('areaFileDropzone');
        const replaceBtn = document.getElementById('btnReplaceDoc');
        const deleteBtn = document.getElementById('btnDeleteDoc');
        const previewBtn = document.getElementById('btnPreviewUploadedDoc');
        const downloadBtn = document.getElementById('btnDownloadUploadedDoc');
        const addPeriodBtn = document.getElementById('btnAddPeriodBtn');
        const modalPeriod = document.getElementById('modalSchedulePeriod');
        const closePeriodBtn = document.getElementById('btnClosePeriodModal');
        const cancelPeriodBtn = document.getElementById('btnCancelPeriodModal');
        const formPeriod = document.getElementById('formSchedulePeriod');
        const modalDocViewer = document.getElementById('modalDocViewer');
        const closeDocViewer = document.getElementById('btnCloseDocViewer');
        const printModalDoc = document.getElementById('btnPrintModalDoc');

        // Method Toggles: File vs Google Docs
        const btnToggleMethodFile = document.getElementById('btnToggleMethodFile');
        const btnToggleMethodGDocs = document.getElementById('btnToggleMethodGDocs');
        const areaFileDropzone = document.getElementById('areaFileDropzone');
        const areaGDocsInput = document.getElementById('areaGDocsInput');
        const gdocsUrlInput = document.getElementById('gdocsUrlInput');
        const btnSaveGDocsLink = document.getElementById('btnSaveGDocsLink');

        if (btnToggleMethodFile && btnToggleMethodGDocs) {
            btnToggleMethodFile.addEventListener('click', () => {
                btnToggleMethodFile.style.background = 'var(--primary)';
                btnToggleMethodFile.style.color = '#fff';
                btnToggleMethodFile.style.borderColor = 'var(--primary)';
                btnToggleMethodGDocs.style.background = '#fff';
                btnToggleMethodGDocs.style.color = 'var(--gray-700)';
                btnToggleMethodGDocs.style.borderColor = 'var(--gray-300)';
                if (areaFileDropzone) areaFileDropzone.style.display = 'block';
                if (areaGDocsInput) areaGDocsInput.style.display = 'none';
            });

            btnToggleMethodGDocs.addEventListener('click', () => {
                btnToggleMethodGDocs.style.background = '#1a73e8';
                btnToggleMethodGDocs.style.color = '#fff';
                btnToggleMethodGDocs.style.borderColor = '#1a73e8';
                btnToggleMethodFile.style.background = '#fff';
                btnToggleMethodFile.style.color = 'var(--gray-700)';
                btnToggleMethodFile.style.borderColor = 'var(--gray-300)';
                if (areaFileDropzone) areaFileDropzone.style.display = 'none';
                if (areaGDocsInput) areaGDocsInput.style.display = 'block';
                if (gdocsUrlInput) gdocsUrlInput.focus();
            });
        }

        if (btnSaveGDocsLink && gdocsUrlInput) {
            btnSaveGDocsLink.addEventListener('click', async () => {
                const url = gdocsUrlInput.value.trim();
                if (!url) {
                    alert('Please enter a valid Google Docs or Google Drive link.');
                    return;
                }
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    alert('Please enter a full URL starting with https://');
                    return;
                }

                btnSaveGDocsLink.disabled = true;
                btnSaveGDocsLink.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Attaching...';

                const secName = sectionData?.name || 'Section';
                const teacherName = (sessionUser.firstName ? `${sessionUser.firstName} ${sessionUser.lastName || ''}`.trim() : 'Teacher');

                const payload = {
                    sectionId: currentSectionId,
                    sectionName: secName,
                    fileName: `${secName} Student Load (Google Docs)`,
                    fileType: 'google_docs',
                    url: url,
                    fileData: url,
                    isGoogleDocs: true,
                    uploadDate: new Date().toISOString(),
                    uploadedBy: teacherName
                };

                // 1. Update in Supabase sections table
                try {
                    await supabase.from('sections').update({
                        schedule_doc_url: url,
                        schedule_doc_name: `${secName} Student Load (Google Docs)`,
                        schedule_doc_type: 'google_docs',
                        schedule_doc_uploaded_by: teacherName,
                        schedule_doc_updated_at: new Date().toISOString()
                    }).eq('id', currentSectionId);
                    if (sectionData) {
                        sectionData.schedule_doc_url = url;
                        sectionData.schedule_doc_name = `${secName} Student Load (Google Docs)`;
                        sectionData.schedule_doc_type = 'google_docs';
                        sectionData.schedule_doc_uploaded_by = teacherName;
                    }
                } catch(err) {
                    console.warn('Database sections update error:', err);
                }

                // 2. Save to localStorage
                localStorage.setItem('hes_section_schedule_' + currentSectionId, JSON.stringify(payload));
                localStorage.setItem('hes_section_schedule_' + secName.trim().toUpperCase(), JSON.stringify(payload));
                localStorage.setItem('hes_section_schedule_last_sync', Date.now().toString());

                // 3. Activity log
                try {
                    await supabase.from('activity_logs').insert([{
                        user_id: sessionUser.id,
                        role: 'teacher',
                        action: 'Section Student Load Shared',
                        details: `Teacher ${teacherName} shared official Google Docs student load for Section ${secName}.`,
                        timestamp: new Date().toISOString()
                    }]);
                } catch(e) {}

                btnSaveGDocsLink.disabled = false;
                btnSaveGDocsLink.innerHTML = '<i class="fas fa-link"></i> Attach Google Doc';
                gdocsUrlInput.value = '';

                loadUploadedScheduleDoc(currentSectionId);
                showAlert(`✅ Official Google Docs student load linked successfully! Students in Section ${secName} can now access and view it.`, 'success');
            });
        }

        if (triggerBtn && fileInput) triggerBtn.addEventListener('click', () => fileInput.click());
        if (dropzone && fileInput) {
            dropzone.addEventListener('click', (e) => {
                if (e.target !== triggerBtn) fileInput.click();
            });
            dropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropzone.style.borderColor = 'var(--primary)';
                dropzone.style.background = '#f0fdf4';
            });
            dropzone.addEventListener('dragleave', () => {
                dropzone.style.borderColor = 'var(--gray-300)';
                dropzone.style.background = 'var(--gray-50)';
            });
            dropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropzone.style.borderColor = 'var(--gray-300)';
                dropzone.style.background = 'var(--gray-50)';
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    processScheduleFile(e.dataTransfer.files[0]);
                }
            });
        }
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    processScheduleFile(e.target.files[0]);
                }
            });
        }
        if (replaceBtn && fileInput) replaceBtn.addEventListener('click', () => fileInput.click());
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                if (!confirm('Are you sure you want to remove the uploaded student load schedule for this section?')) return;
                const secName = sectionData?.name || '';
                try {
                    await supabase.from('sections').update({
                        schedule_doc_url: null,
                        schedule_doc_name: null,
                        schedule_doc_type: null,
                        schedule_doc_uploaded_by: null,
                        schedule_doc_updated_at: new Date().toISOString()
                    }).eq('id', currentSectionId);
                    if (sectionData) {
                        sectionData.schedule_doc_url = null;
                        sectionData.schedule_doc_name = null;
                        sectionData.schedule_doc_type = null;
                    }
                } catch(e) {}

                localStorage.removeItem('hes_section_schedule_' + currentSectionId);
                if (secName) localStorage.removeItem('hes_section_schedule_' + secName.trim().toUpperCase());
                localStorage.setItem('hes_section_schedule_last_sync', Date.now().toString());

                loadUploadedScheduleDoc(currentSectionId);
                showAlert('Student load schedule removed successfully.', 'success');
            });
        }
        if (previewBtn) previewBtn.addEventListener('click', () => openDocViewer(currentUploadedSchedule));
        if (downloadBtn) downloadBtn.addEventListener('click', () => downloadScheduleDoc(currentUploadedSchedule));
        if (closeDocViewer && modalDocViewer) closeDocViewer.addEventListener('click', () => modalDocViewer.style.display = 'none');
        if (printModalDoc) printModalDoc.addEventListener('click', () => printScheduleDoc(currentUploadedSchedule));

        // Add / Edit Period modal
        if (addPeriodBtn && modalPeriod) {
            addPeriodBtn.addEventListener('click', () => {
                document.getElementById('editPeriodId').value = '';
                document.getElementById('modalPeriodTitle').innerHTML = '<i class="fas fa-calendar-plus"></i> Add Class Period';
                formPeriod.reset();
                modalPeriod.style.display = 'flex';
            });
        }
        if (closePeriodBtn && modalPeriod) closePeriodBtn.addEventListener('click', () => modalPeriod.style.display = 'none');
        if (cancelPeriodBtn && modalPeriod) cancelPeriodBtn.addEventListener('click', () => modalPeriod.style.display = 'none');

        if (formPeriod) {
            formPeriod.addEventListener('submit', async (e) => {
                e.preventDefault();
                await handleSavePeriod();
            });
        }
    }

    function processScheduleFile(file) {
        if (!file) return;
        if (file.size > 15 * 1024 * 1024) {
            alert('File exceeds maximum allowed size of 15MB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = async function(evt) {
            const dataUrl = evt.target.result;
            const sizeKb = Math.round(file.size / 1024);
            const sizeFormatted = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;
            const secName = sectionData?.name || 'Section';
            const teacherName = (sessionUser.firstName ? `${sessionUser.firstName} ${sessionUser.lastName || ''}`.trim() : 'Teacher');
            const isImg = (file.type || '').startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(file.name);
            const fileType = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

            const payload = {
                sectionId: currentSectionId,
                sectionName: secName,
                fileName: file.name,
                fileType: fileType,
                fileSize: file.size,
                fileSizeFormatted: sizeFormatted,
                fileData: dataUrl,
                isImage: isImg,
                uploadDate: new Date().toISOString(),
                uploadedBy: teacherName
            };

            // 1. Save to Supabase sections table
            try {
                await supabase.from('sections').update({
                    schedule_doc_url: dataUrl,
                    schedule_doc_name: file.name,
                    schedule_doc_type: fileType,
                    schedule_doc_uploaded_by: teacherName,
                    schedule_doc_updated_at: new Date().toISOString()
                }).eq('id', currentSectionId);
                if (sectionData) {
                    sectionData.schedule_doc_url = dataUrl;
                    sectionData.schedule_doc_name = file.name;
                    sectionData.schedule_doc_type = fileType;
                    sectionData.schedule_doc_uploaded_by = teacherName;
                }
            } catch(e) {
                console.warn('Database sections file update error:', e);
            }

            // 2. Save to localStorage
            localStorage.setItem('hes_section_schedule_' + currentSectionId, JSON.stringify(payload));
            localStorage.setItem('hes_section_schedule_' + secName.trim().toUpperCase(), JSON.stringify(payload));
            localStorage.setItem('hes_section_schedule_last_sync', Date.now().toString());

            // 3. Log activity log
            try {
                await supabase.from('activity_logs').insert([{
                    user_id: sessionUser.id,
                    role: 'teacher',
                    action: 'Section Student Load Uploaded',
                    details: `Teacher ${teacherName} sent/uploaded official student load schedule (${file.name}) for Section ${secName}.`,
                    timestamp: new Date().toISOString()
                }]);
            } catch(e) {}

            loadUploadedScheduleDoc(currentSectionId);
            showAlert(`✅ Official student load schedule ${isImg ? 'image' : 'file'} "${file.name}" sent successfully! Students can now view, download, and print it.`, 'success');
        };
        reader.readAsDataURL(file);
    }

    function openDocViewer(doc) {
        if (!doc || (!doc.fileData && !doc.url)) return;
        const modal = document.getElementById('modalDocViewer');
        const container = document.getElementById('docViewerContent');
        const titleEl = document.getElementById('docViewerTitle');
        if (!modal || !container) return;

        const isGDocs = doc.isGoogleDocs || doc.fileType === 'google_docs' || (doc.url && (doc.url.includes('docs.google.com') || doc.url.includes('drive.google.com')));
        const isPdf = (doc.fileType || '').includes('pdf') || (doc.fileName || '').toLowerCase().endsWith('.pdf');
        const isImg = doc.isImage || (doc.fileType || '').startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(doc.fileName || '') || (doc.fileData && doc.fileData.startsWith('data:image/'));

        if (titleEl) {
            titleEl.innerHTML = isGDocs 
                ? `<i class="fab fa-google-drive" style="color: #4285F4;"></i> ${doc.fileName || 'Google Docs Student Load'}`
                : isImg 
                    ? `<i class="fas fa-file-image" style="color: #10b981;"></i> ${doc.fileName || 'Schedule Image'}`
                    : `<i class="fas fa-file-pdf" style="color: #ef4444;"></i> ${doc.fileName || 'PDF Student Load'}`;
        }

        if (isGDocs) {
            let embedUrl = doc.url || doc.fileData;
            if (embedUrl.includes('/edit')) {
                embedUrl = embedUrl.replace('/edit', '/preview');
            }
            container.innerHTML = `
                <div style="width: 100%; height: 100%; display: flex; flex-direction: column;">
                    <div style="padding: 10px 14px; background: #eff6ff; border-bottom: 1px solid #bfdbfe; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.85rem; color: #1e40af; font-weight: 600;">
                            <i class="fab fa-google-drive"></i> Google Docs Student Load
                        </span>
                        <a href="${doc.url || doc.fileData}" target="_blank" rel="noopener noreferrer" style="font-size: 0.85rem; color: #1d4ed8; text-decoration: underline; font-weight: 600;">
                            Open in New Tab <i class="fas fa-external-link-alt"></i>
                        </a>
                    </div>
                    <iframe src="${embedUrl}" style="flex: 1; width: 100%; border: none;"></iframe>
                </div>
            `;
        } else if (isPdf) {
            container.innerHTML = `<iframe src="${doc.fileData || doc.url}" style="width: 100%; height: 100%; border: none; border-radius: 8px;"></iframe>`;
        } else {
            container.innerHTML = `<img src="${doc.fileData || doc.url}" alt="Student Load Schedule Preview" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">`;
        }
        modal.style.display = 'flex';
    }

    function downloadScheduleDoc(doc) {
        if (!doc || (!doc.fileData && !doc.url)) return;
        const a = document.createElement('a');
        a.href = doc.fileData || doc.url;
        a.download = doc.fileName || `Section_Student_Load_${doc.sectionName || ''}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function printScheduleDoc(doc) {
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

    async function handleSavePeriod() {
        const editId = document.getElementById('editPeriodId').value;
        const subjectId = document.getElementById('periodSubjectSelect').value;
        const day = document.getElementById('periodDaySelect').value;
        const room = document.getElementById('periodRoomInput').value.trim();
        const startTime = document.getElementById('periodStartTime').value;
        const endTime = document.getElementById('periodEndTime').value;
        const teacherIdVal = document.getElementById('periodTeacherSelect').value || null;

        if (!subjectId || !day || !room || !startTime || !endTime) {
            alert('Please fill out all required fields.');
            return;
        }

        const saveBtn = document.getElementById('btnSavePeriod');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        }

        try {
            const rowData = {
                section_id: currentSectionId,
                subject_id: subjectId,
                day: day,
                room: room,
                start_time: startTime.length === 5 ? startTime + ':00' : startTime,
                end_time: endTime.length === 5 ? endTime + ':00' : endTime,
                teacher_id: teacherIdVal
            };

            if (editId) {
                const { error } = await supabase
                    .from('schedules')
                    .update(rowData)
                    .eq('id', editId);
                if (error) throw error;
                showAlert('✅ Class period updated successfully!', 'success');
            } else {
                const { error } = await supabase
                    .from('schedules')
                    .insert([rowData]);
                if (error) throw error;
                showAlert('✅ New class period added to schedule!', 'success');
            }

            document.getElementById('modalSchedulePeriod').style.display = 'none';
            await loadSectionSchedules(currentSectionId);

        } catch (err) {
            console.error('Save period error:', err);
            showAlert('❌ Failed to save period: ' + err.message, 'error');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Period';
            }
        }
    }

    window.deleteSchedulePeriod = async function(id) {
        if (!confirm('Are you sure you want to delete this class period from the schedule?')) return;
        try {
            const { error } = await supabase.from('schedules').delete().eq('id', id);
            if (error) throw error;
            showAlert('Class period removed from schedule.', 'success');
            await loadSectionSchedules(currentSectionId);
        } catch(e) {
            showAlert('Failed to delete period: ' + e.message, 'error');
        }
    };

    window.editSchedulePeriod = function(id) {
        const item = classSchedules.find(s => s.id === id);
        if (!item) return;
        document.getElementById('editPeriodId').value = item.id;
        document.getElementById('modalPeriodTitle').innerHTML = '<i class="fas fa-edit"></i> Edit Class Period';
        if (item.subject_id) document.getElementById('periodSubjectSelect').value = item.subject_id;
        document.getElementById('periodDaySelect').value = item.day || 'Monday';
        document.getElementById('periodRoomInput').value = item.room || '';
        document.getElementById('periodStartTime').value = (item.start_time || '').slice(0, 5);
        document.getElementById('periodEndTime').value = (item.end_time || '').slice(0, 5);
        if (item.teacher_id) document.getElementById('periodTeacherSelect').value = item.teacher_id;
        document.getElementById('modalSchedulePeriod').style.display = 'flex';
    };

    // ============================================
    // SECTION ATTENDANCE CONTROLS & LOGIC
    // ============================================

    async function handleDateSelectionChange() {
        const selectedDate = sectionAttDate ? sectionAttDate.value : todayStr;
        isWeekendSelected = checkIsWeekend(selectedDate);

        const d = new Date(selectedDate + 'T00:00:00');
        const dayName = isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { weekday: 'long' });

        if (dateWeekdayBadge) {
            if (isWeekendSelected) {
                dateWeekdayBadge.textContent = `${dayName} (Weekend)`;
                dateWeekdayBadge.style.background = '#fee2e2';
                dateWeekdayBadge.style.color = '#b91c1c';
            } else {
                dateWeekdayBadge.textContent = dayName;
                dateWeekdayBadge.style.background = '#e0f2fe';
                dateWeekdayBadge.style.color = '#0369a1';
            }
        }

        if (weekendNoticeBanner) {
            weekendNoticeBanner.style.display = isWeekendSelected ? 'block' : 'none';
        }

        if (markAllPresentBtn) markAllPresentBtn.disabled = isWeekendSelected;
        if (saveSectionAttendanceBtn) saveSectionAttendanceBtn.disabled = isWeekendSelected;

        // Fetch existing attendance for this date from Supabase
        await loadAttendanceForDate(selectedDate);
    }

    if (sectionAttDate) {
        sectionAttDate.addEventListener('change', handleDateSelectionChange);
    }

    async function loadAttendanceForDate(dateStr) {
        sectionAttendanceState = {};

        if (isWeekendSelected) {
            // For weekends: No student has attendance
            enrolledStudents.forEach(stu => {
                sectionAttendanceState[stu.id] = {
                    status: 'Weekend',
                    timeIn: '—',
                    timeOut: '—',
                    remarks: 'Weekend (No Classes)'
                };
            });
            renderAttendanceTable();
            updateCounters();
            return;
        }

        let dbRecords = [];
        try {
            const { data, error } = await supabase
                .from('attendance')
                .select('*')
                .eq('date', dateStr);

            if (!error && data) {
                dbRecords = data;
            }
        } catch (e) {
            console.warn('Attendance load error:', e);
        }

        // Also check localStorage
        let localRecords = [];
        try {
            const raw = localStorage.getItem('hes_student_attendance');
            if (raw) localRecords = JSON.parse(raw);
        } catch (e) {}

        // Populate state for each enrolled student
        enrolledStudents.forEach(stu => {
            const dbMatch = dbRecords.find(r => r.student_id === stu.id || r.lrn === stu.lrn);
            const localMatch = localRecords.find(r => (r.lrn === stu.lrn || r.student_id === stu.id) && r.date === dateStr);
            const record = dbMatch || localMatch;

            if (record) {
                sectionAttendanceState[stu.id] = {
                    status: record.status || 'Present',
                    timeIn: record.time_in || record.timeIn || '07:30 AM',
                    timeOut: record.time_out || record.timeOut || '04:30 PM',
                    remarks: record.remarks || (record.status === 'Present' ? 'On time' : '')
                };
            } else {
                // Default initial state: Present
                sectionAttendanceState[stu.id] = {
                    status: 'Present',
                    timeIn: '07:30 AM',
                    timeOut: '04:30 PM',
                    remarks: 'On time'
                };
            }
        });

        renderAttendanceTable();
        updateCounters();
    }

    function renderAttendanceTable() {
        if (!sectionAttendanceBody) return;

        if (enrolledStudents.length === 0) {
            sectionAttendanceBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 30px;">
                        <div class="no-data">
                            <i class="fas fa-user-graduate"></i>
                            <p>No students enrolled in this section.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        if (isWeekendSelected) {
            sectionAttendanceBody.innerHTML = enrolledStudents.map(student => {
                const initial = student.fullname.charAt(0).toUpperCase();
                return `
                    <tr style="border-bottom: 1px solid var(--gray-200); opacity: 0.6; background: #fafafa;">
                        <td style="padding: 12px 16px;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div style="width: 34px; height: 34px; border-radius: 50%; background: var(--gray-300); color: var(--gray-700); display: flex; align-items: center; justify-content: center; font-weight: 700;">
                                    ${initial}
                                </div>
                                <div>
                                    <strong style="color: var(--gray-700); font-size: 0.95rem;">${student.fullname}</strong>
                                    <div style="font-size: 0.8rem; color: var(--gray-400);">LRN: ${student.lrn}</div>
                                </div>
                            </div>
                        </td>
                        <td style="padding: 12px 16px;">
                            <span class="status-badge" style="background: #e0f2fe; color: #0369a1; font-weight: 600; padding: 6px 14px; border-radius: 20px; font-size: 0.82rem; border: 1px solid #bae6fd;">
                                <i class="fas fa-calendar-times"></i> Weekend (No Classes)
                            </span>
                        </td>
                        <td style="padding: 12px 16px; color: var(--gray-400); font-weight: 600;">—</td>
                        <td style="padding: 12px 16px; color: var(--gray-400); font-style: italic; font-size: 0.88rem;">No attendance recorded on weekends</td>
                    </tr>
                `;
            }).join('');
            return;
        }

        sectionAttendanceBody.innerHTML = enrolledStudents.map(student => {
            const initial = student.fullname.charAt(0).toUpperCase();
            const state = sectionAttendanceState[student.id] || { status: 'Present', timeIn: '07:30 AM', timeOut: '04:30 PM', remarks: 'On time' };
            const curStatus = state.status;

            return `
                <tr style="border-bottom: 1px solid var(--gray-200);">
                    <td style="padding: 12px 16px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="width: 36px; height: 36px; border-radius: 50%; background: var(--primary); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0;">
                                ${initial}
                            </div>
                            <div>
                                <strong style="color: var(--gray-900); font-size: 0.95rem;">${student.fullname}</strong>
                                <div style="font-size: 0.8rem; color: var(--gray-500);"><i class="fas fa-id-card"></i> ${student.lrn}</div>
                            </div>
                        </div>
                    </td>
                    <td style="padding: 12px 16px;">
                        <div class="att-status-group" data-student-id="${student.id}">
                            <button type="button" class="att-status-btn btn-present ${curStatus === 'Present' ? 'active' : ''}" onclick="window.setStudentStatus('${student.id}', 'Present')">
                                <i class="fas fa-check-circle"></i> Present
                            </button>
                            <button type="button" class="att-status-btn btn-late ${curStatus === 'Late' ? 'active' : ''}" onclick="window.setStudentStatus('${student.id}', 'Late')">
                                <i class="fas fa-clock"></i> Late
                            </button>
                            <button type="button" class="att-status-btn btn-absent ${curStatus === 'Absent' ? 'active' : ''}" onclick="window.setStudentStatus('${student.id}', 'Absent')">
                                <i class="fas fa-times-circle"></i> Absent
                            </button>
                            <button type="button" class="att-status-btn btn-excused ${curStatus === 'Excused' ? 'active' : ''}" onclick="window.setStudentStatus('${student.id}', 'Excused')">
                                <i class="fas fa-file-medical"></i> Excused
                            </button>
                        </div>
                    </td>
                    <td style="padding: 12px 16px;">
                        <input type="text" class="att-time-input" id="timein_${student.id}" value="${state.timeIn}" onchange="window.updateStudentTime('${student.id}', this.value)" placeholder="07:30 AM" ${curStatus === 'Absent' || curStatus === 'Excused' ? 'disabled' : ''}>
                    </td>
                    <td style="padding: 12px 16px;">
                        <input type="text" class="att-remarks-input" id="remarks_${student.id}" value="${state.remarks}" onchange="window.updateStudentRemarks('${student.id}', this.value)" placeholder="e.g. On time, Medical reason">
                    </td>
                </tr>
            `;
        }).join('');
    }

    window.setStudentStatus = function(studentId, newStatus) {
        if (isWeekendSelected) return;

        if (!sectionAttendanceState[studentId]) {
            sectionAttendanceState[studentId] = { status: newStatus, timeIn: '07:30 AM', timeOut: '04:30 PM', remarks: '' };
        } else {
            sectionAttendanceState[studentId].status = newStatus;
        }

        // Auto default time and remarks
        const timeInput = document.getElementById(`timein_${studentId}`);
        const remarksInput = document.getElementById(`remarks_${studentId}`);

        if (newStatus === 'Present') {
            sectionAttendanceState[studentId].timeIn = '07:30 AM';
            if (!sectionAttendanceState[studentId].remarks || sectionAttendanceState[studentId].remarks === 'Unexcused') {
                sectionAttendanceState[studentId].remarks = 'On time';
            }
            if (timeInput) { timeInput.value = '07:30 AM'; timeInput.disabled = false; }
            if (remarksInput) remarksInput.value = sectionAttendanceState[studentId].remarks;
        } else if (newStatus === 'Late') {
            sectionAttendanceState[studentId].timeIn = '08:15 AM';
            sectionAttendanceState[studentId].remarks = 'Late arrival';
            if (timeInput) { timeInput.value = '08:15 AM'; timeInput.disabled = false; }
            if (remarksInput) remarksInput.value = 'Late arrival';
        } else if (newStatus === 'Absent') {
            sectionAttendanceState[studentId].timeIn = '—';
            sectionAttendanceState[studentId].remarks = 'Unexcused';
            if (timeInput) { timeInput.value = '—'; timeInput.disabled = true; }
            if (remarksInput) remarksInput.value = 'Unexcused';
        } else if (newStatus === 'Excused') {
            sectionAttendanceState[studentId].timeIn = '—';
            sectionAttendanceState[studentId].remarks = 'Official excuse / Certificate';
            if (timeInput) { timeInput.value = '—'; timeInput.disabled = true; }
            if (remarksInput) remarksInput.value = 'Official excuse / Certificate';
        }

        // Update active class on status group buttons
        const group = document.querySelector(`.att-status-group[data-student-id="${studentId}"]`);
        if (group) {
            group.querySelectorAll('.att-status-btn').forEach(btn => btn.classList.remove('active'));
            const targetBtn = group.querySelector(`.btn-${newStatus.toLowerCase()}`);
            if (targetBtn) targetBtn.classList.add('active');
        }

        updateCounters();
    };

    window.updateStudentTime = function(studentId, val) {
        if (sectionAttendanceState[studentId]) {
            sectionAttendanceState[studentId].timeIn = val;
        }
    };

    window.updateStudentRemarks = function(studentId, val) {
        if (sectionAttendanceState[studentId]) {
            sectionAttendanceState[studentId].remarks = val;
        }
    };

    function updateCounters() {
        if (isWeekendSelected) {
            if (countPresent) countPresent.textContent = '0';
            if (countLate) countLate.textContent = '0';
            if (countAbsent) countAbsent.textContent = '0';
            if (countExcused) countExcused.textContent = '0';
            if (attendanceRate) attendanceRate.textContent = '0%';
            return;
        }

        let pres = 0, late = 0, abs = 0, exc = 0;
        Object.values(sectionAttendanceState).forEach(st => {
            if (st.status === 'Present') pres++;
            else if (st.status === 'Late') late++;
            else if (st.status === 'Absent') abs++;
            else if (st.status === 'Excused') exc++;
        });

        if (countPresent) countPresent.textContent = pres;
        if (countLate) countLate.textContent = late;
        if (countAbsent) countAbsent.textContent = abs;
        if (countExcused) countExcused.textContent = exc;

        const total = enrolledStudents.length;
        const rate = total > 0 ? Math.round(((pres + late + exc) / total) * 100) : 0;
        if (attendanceRate) attendanceRate.textContent = `${rate}%`;
    }

    if (markAllPresentBtn) {
        markAllPresentBtn.addEventListener('click', () => {
            if (isWeekendSelected) {
                showAlert('⚠️ Cannot mark attendance on weekends (Saturday & Sunday).', 'warning');
                return;
            }

            enrolledStudents.forEach(stu => {
                window.setStudentStatus(stu.id, 'Present');
            });
            showAlert('✅ All students marked as Present (07:30 AM).', 'success');
        });
    }

    // ============================================
    // SAVE ATTENDANCE & DISPATCH NOTIFICATIONS
    // ============================================

    if (saveSectionAttendanceBtn) {
        saveSectionAttendanceBtn.addEventListener('click', async () => {
            const selectedDate = sectionAttDate ? sectionAttDate.value : todayStr;

            if (checkIsWeekend(selectedDate)) {
                showAlert('📅 Attendance recording is disabled on weekends (Saturday & Sunday).', 'warning');
                return;
            }

            if (enrolledStudents.length === 0) {
                showAlert('⚠️ No enrolled students found in this section to record attendance for.', 'warning');
                return;
            }

            saveSectionAttendanceBtn.disabled = true;
            saveSectionAttendanceBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Saving & Notifying...`;

            try {
                const recordsToInsert = [];
                const notificationsToInsert = [];
                const localRecords = [];

                enrolledStudents.forEach(stu => {
                    const st = sectionAttendanceState[stu.id] || { status: 'Present', timeIn: '07:30 AM', timeOut: '04:30 PM', remarks: 'On time' };
                    const timeInVal = (st.status === 'Absent' || st.status === 'Excused') ? null : (st.timeIn || '07:30 AM');
                    const timeOutVal = (st.status === 'Absent' || st.status === 'Excused') ? null : (st.timeOut || '04:30 PM');

                    // Database row
                    recordsToInsert.push({
                        student_id: stu.id,
                        teacher_id: teacherId,
                        date: selectedDate,
                        time_in: timeInVal,
                        time_out: timeOutVal,
                        status: st.status,
                        remarks: st.remarks || (st.status === 'Present' ? 'On time' : ''),
                        created_at: new Date().toISOString()
                    });

                    // Notification payload for student
                    notificationsToInsert.push({
                        user_id: stu.id,
                        student_id: stu.id,
                        recipient_email: stu.email || null,
                        role: 'student',
                        title: 'Attendance Notification',
                        message: `Your attendance for ${formatDate(selectedDate)} has been marked as: ${st.status.toUpperCase()} by Teacher ${displayName}. Remarks: ${st.remarks || 'None'}`,
                        type: 'attendance',
                        read: false,
                        is_read: false,
                        created_at: new Date().toISOString()
                    });

                    // Local attendance cache format
                    localRecords.push({
                        id: `ATT-${selectedDate}-${stu.lrn}`,
                        student_id: stu.id,
                        lrn: stu.lrn,
                        name: stu.fullname,
                        date: selectedDate,
                        time_in: timeInVal || '—',
                        time_out: timeOutVal || '—',
                        timeIn: timeInVal || '—',
                        timeOut: timeOutVal || '—',
                        status: st.status,
                        remarks: st.remarks || (st.status === 'Present' ? 'On time' : '')
                    });

                    // Update individual student cache
                    try {
                        const sKey = `hes_student_attendance_${stu.lrn}`;
                        let sHistory = [];
                        const raw = localStorage.getItem(sKey);
                        if (raw) sHistory = JSON.parse(raw);
                        const exIdx = sHistory.findIndex(h => h.date === selectedDate);
                        const rec = {
                            id: `ATT-${selectedDate}-${stu.lrn}`,
                            date: selectedDate,
                            time_in: timeInVal || '—',
                            time_out: timeOutVal || '—',
                            timeIn: timeInVal || '—',
                            timeOut: timeOutVal || '—',
                            status: st.status,
                            remarks: st.remarks || ''
                        };
                        if (exIdx >= 0) sHistory[exIdx] = rec;
                        else sHistory.unshift(rec);
                        localStorage.setItem(sKey, JSON.stringify(sHistory));
                    } catch (e) {}

                    // Update individual student local notifications
                    try {
                        const notifKey = `hes_notifications_${stu.id}`;
                        let notifs = [];
                        const rawN = localStorage.getItem(notifKey);
                        if (rawN) notifs = JSON.parse(rawN);
                        notifs.unshift({
                            id: 'NOTIF-' + Date.now() + '-' + stu.id,
                            title: 'Attendance Notification',
                            message: `Your attendance for ${formatDate(selectedDate)} was recorded as ${st.status} by Teacher ${displayName}.`,
                            time: 'Just now',
                            read: false,
                            created_at: new Date().toISOString()
                        });
                        localStorage.setItem(notifKey, JSON.stringify(notifs));
                    } catch (e) {}
                });

                // 1. Delete existing records for this date and section in Supabase
                try {
                    const studentIds = enrolledStudents.map(s => s.id);
                    await supabase
                        .from('attendance')
                        .delete()
                        .eq('date', selectedDate)
                        .in('student_id', studentIds);

                    // 2. Insert fresh records
                    await supabase
                        .from('attendance')
                        .insert(recordsToInsert);
                } catch (dbErr) {
                    console.warn('Supabase attendance sync notice:', dbErr);
                }

                // 3. Insert notifications in Supabase
                try {
                    await supabase
                        .from('notifications')
                        .insert(notificationsToInsert);
                } catch (notifErr) {
                    console.warn('Supabase notifications sync notice:', notifErr);
                }

                // 4. Update overall shared local attendance store
                try {
                    const existingRaw = localStorage.getItem('hes_student_attendance');
                    let allLocal = existingRaw ? JSON.parse(existingRaw) : [];
                    // Remove existing for this date
                    allLocal = allLocal.filter(a => a.date !== selectedDate);
                    // Add new records
                    allLocal = [...localRecords, ...allLocal];
                    localStorage.setItem('hes_student_attendance', JSON.stringify(allLocal));

                    // Also update hes_attendance_records
                    const rawCentral = localStorage.getItem('hes_attendance_records');
                    let centralRecords = rawCentral ? JSON.parse(rawCentral) : [];
                    centralRecords = centralRecords.filter(a => a.date !== selectedDate);
                    localRecords.forEach(lr => {
                        centralRecords.unshift({
                            ...lr,
                            student_id: lr.student_id,
                            studentId: lr.student_id,
                            date: selectedDate,
                            recorded_by: teacherId,
                            teacher_name: displayName,
                            updated_at: new Date().toISOString()
                        });
                    });
                    localStorage.setItem('hes_attendance_records', JSON.stringify(centralRecords.slice(0, 1000)));

                    // Broadcast cross-tab attendance event
                    localStorage.setItem('hes_latest_attendance_event', JSON.stringify({
                        date: selectedDate,
                        timestamp: Date.now()
                    }));
                } catch (e) {}

                showAlert(`🎉 Section attendance for ${formatDate(selectedDate)} saved successfully! All ${enrolledStudents.length} students have been notified of their attendance status.`, 'success');

            } catch (err) {
                console.error('Error saving attendance:', err);
                showAlert('❌ Failed to save attendance: ' + err.message, 'error');
            } finally {
                saveSectionAttendanceBtn.disabled = false;
                saveSectionAttendanceBtn.innerHTML = `<i class="fas fa-save"></i> Save & Notify Students`;
            }
        });
    }

    // ============================================
    // INITIAL LOAD
    // ============================================

    initializeSection();

})();