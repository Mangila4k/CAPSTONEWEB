/**
 * Teacher View Section - Supabase Integration & Attendance Manager
 * Exclusively empowers teachers to record section attendance and notify students
 */

import { supabase } from '../../supabase/config.js';

(function () {
    'use strict';

    console.log('📋 Section Details & Attendance Manager ready');

    // ============================================
    // DOM ELEMENTS
    // ============================================

    const teacherName        = document.getElementById('teacherName');
    const teacherInitial     = document.getElementById('teacherInitial');
    const logoutBtn          = document.getElementById('logoutBtn');
    const alertContainer     = document.getElementById('alertContainer');

    // Section header (Robust fallbacks for sectionName)
    const sectionName  = document.getElementById('sectionName');
    const sectionTitle = document.getElementById('sectionTitle');
    const sectionGrade       = document.getElementById('sectionGrade');
    const adviserName        = document.getElementById('adviserName');
    const isAdviserBadge     = document.getElementById('isAdviserBadge');

    // Stats
    const totalStudents      = document.getElementById('totalStudents');
    const totalSubjects      = document.getElementById('totalSubjects');
    const attendanceRate     = document.getElementById('attendanceRate');
    const subjectsTaught     = document.getElementById('subjectsTaught');

    // Tabs
    const tabAttendanceBtn      = document.getElementById('tabAttendanceBtn');
    const tabStudentsBtn        = document.getElementById('tabStudentsBtn');
    const tabScheduleBtn        = document.getElementById('tabScheduleBtn');
    const sectionAttendancePanel = document.getElementById('sectionAttendancePanel');
    const sectionStudentsPanel   = document.getElementById('sectionStudentsPanel');
    const sectionSchedulePanel   = document.getElementById('sectionSchedulePanel');
    const tabStudentCount        = document.getElementById('tabStudentCount');

    // Attendance Manager
    const sectionAttDate        = document.getElementById('sectionAttDate');
    const dateWeekdayBadge      = document.getElementById('dateWeekdayBadge');
    const weekendNoticeBanner   = document.getElementById('weekendNoticeBanner');
    const markAllPresentBtn     = document.getElementById('markAllPresentBtn');
    const saveSectionAttendanceBtn = document.getElementById('saveSectionAttendanceBtn');
    const sectionAttendanceBody = document.getElementById('sectionAttendanceBody');

    // Attendance counters
    const countPresent  = document.getElementById('countPresent');
    const countLate     = document.getElementById('countLate');
    const countAbsent   = document.getElementById('countAbsent');
    const countExcused  = document.getElementById('countExcused');

    // Student directory & schedule
    const studentsBody        = document.getElementById('studentsBody');
    const studentCountBadge   = document.getElementById('studentCountBadge');
    const scheduleList        = document.getElementById('scheduleList');
    const scheduleCountBadge  = document.getElementById('scheduleCountBadge');

    // ============================================
    // STATE
    // ============================================

    let sessionUser             = null;
    let teacherId               = null;
    let currentSectionId        = null;
    let sectionData             = null;
    let enrolledStudents        = [];
    let classSchedules          = [];
    let allSubjects             = [];
    let allTeachers             = [];
    let currentUploadedSchedule = null;
    let sectionAttendanceState  = {}; // student_id -> { status, timeIn, timeOut, remarks }
    let isWeekendSelected       = false;

    // ============================================
    // AUTH CHECK
    // ============================================

    try {
        const stored = localStorage.getItem('currentUser');
        if (stored) sessionUser = JSON.parse(stored);
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
    const displayName = (
        sessionUser.firstName
            ? `${sessionUser.firstName} ${sessionUser.lastName || ''}`.trim()
            : (sessionUser.email ? sessionUser.email.split('@')[0] : 'Teacher')
    );
    if (teacherName)    teacherName.textContent    = displayName;
    if (teacherInitial) teacherInitial.textContent = displayName.charAt(0).toUpperCase();

    // ============================================
    // LOGOUT
    // ============================================

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function (e) {
            e.preventDefault();
            localStorage.removeItem('currentUser');
            localStorage.removeItem('hes_teacher_avatar');
            localStorage.removeItem('hes_teacher_name');
            try { await supabase.auth.signOut(); } catch (_) {}
            window.location.replace('../auth/login.html');
        });
    }

    // ============================================
    // HELPERS & ALERTS
    // ============================================

    function showAlert(message, type = 'success') {
        if (!alertContainer) {
            console.log(`[${type.toUpperCase()}] ${message}`);
            return;
        }
        const icon = type === 'success' ? 'fa-check-circle'
                   : type === 'warning' ? 'fa-exclamation-triangle'
                   : 'fa-exclamation-circle';

        const alertDiv = document.createElement('div');
        alertDiv.className    = `alert alert-${type}`;
        alertDiv.style.margin = '15px 0';
        alertDiv.innerHTML    = `<i class="fas ${icon}"></i> <span>${message}</span>`;
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
            return d.toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
            });
        } catch { return dateStr; }
    }

    function checkIsWeekend(dateStr) {
        if (!dateStr) return false;
        try {
            const day = new Date(dateStr + 'T00:00:00').getDay();
            return day === 0 || day === 6;
        } catch { return false; }
    }

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    function hasRealSection() {
        return !!(currentSectionId && UUID_RE.test(currentSectionId));
    }

    function isMissingColumnError(msg) {
        return /column .* does not exist|Could not find the .* column/i.test(msg || '');
    }

    // ============================================
    // INITIAL DATE
    // ============================================

    const todayObj = new Date();
    const todayStr = todayObj.toISOString().split('T')[0];
    if (sectionAttDate) sectionAttDate.value = todayStr;

    // ============================================
    // TAB MANAGEMENT
    // ============================================

    function switchSectionTab(targetTab) {
        const tabs = [
            { btn: tabAttendanceBtn, panel: sectionAttendancePanel },
            { btn: tabStudentsBtn,   panel: sectionStudentsPanel },
            { btn: tabScheduleBtn,   panel: sectionSchedulePanel },
        ];

        tabs.forEach(({ btn, panel }) => {
            if (!btn || !panel) return;
            if (btn.id === targetTab) {
                btn.classList.add('active');
                btn.style.background = 'var(--primary)';
                btn.style.color      = '#fff';
                panel.style.display  = 'block';
            } else {
                btn.classList.remove('active');
                btn.style.background = '#fff';
                btn.style.color      = 'var(--gray-700)';
                panel.style.display  = 'none';
            }
        });
    }

    if (tabAttendanceBtn) tabAttendanceBtn.addEventListener('click', () => switchSectionTab('tabAttendanceBtn'));
    if (tabStudentsBtn)   tabStudentsBtn.addEventListener('click',   () => switchSectionTab('tabStudentsBtn'));
    if (tabScheduleBtn)   tabScheduleBtn.addEventListener('click',   () => switchSectionTab('tabScheduleBtn'));

    // ============================================
    // LOAD SECTION DETAILS
    // ============================================

    async function initializeSection() {
        const urlParams = new URLSearchParams(window.location.search);
        currentSectionId = urlParams.get('id');

        try {
            const SAFE_COLS = `
                id, name, grade_level, strand, adviser_id, room,
                adviser_name, created_at, updated_at,
                schedule_doc_name, schedule_doc_type,
                schedule_doc_uploaded_by, schedule_doc_updated_at,
                shared_at, shared_by
            `;

            let secDoc = null;
            if (currentSectionId && UUID_RE.test(currentSectionId)) {
                const { data, error } = await supabase
                    .from('sections')
                    .select(SAFE_COLS)
                    .eq('id', currentSectionId)
                    .maybeSingle();
                if (error) console.warn('[sections] load error:', error.message);
                secDoc = data || null;
            }

            if (!secDoc && !currentSectionId) {
                const { data: allSecs, error } = await supabase
                    .from('sections')
                    .select(SAFE_COLS)
                    .order('created_at', { ascending: true })
                    .limit(1);
                if (error) console.warn('[sections] fallback error:', error.message);
                if (allSecs?.length) {
                    secDoc = allSecs[0];
                    currentSectionId = secDoc.id;
                }
            }

            if (!secDoc) {
                sectionData = null;
                if (sectionName)  sectionName.textContent  = 'No Section Selected';
                if (sectionGrade) sectionGrade.textContent = '—';
                if (adviserName)  adviserName.textContent  = '—';
                if (isAdviserBadge) isAdviserBadge.style.display = 'none';
                showAlert('No section found. Add a valid ?id=<uuid> query parameter or create a section first.', 'warning');
                return;
            }

            sectionData = secDoc;
            renderSectionHeader(secDoc);

            await loadEnrolledStudents(currentSectionId);
            await loadSectionSchedules(currentSectionId);
            setupScheduleHandlers();
            handleDateSelectionChange();
        } catch (err) {
            console.error('Error initializing section:', err);
            showAlert('Failed to load section: ' + err.message, 'error');
        }
    }

    function renderSectionHeader(sec) {
    if (!sec) return;

    const shortName = sec.name || 'Section';
    const gradeText = sec.grade_level || 'Grade';
    const strand    = sec.strand ? ` · ${sec.strand}` : '';
    const advName   = sec.adviser_name || (sec.adviser_id === teacherId ? displayName : '—');

    if (sectionName)  sectionName.textContent  = shortName;   // subtitle text
    if (sectionTitle) sectionTitle.textContent = shortName;   // big <h1> heading

    if (sectionGrade) sectionGrade.textContent = `${gradeText}${strand}`;
    if (adviserName)  adviserName.textContent  = advName;

    let isUserAdviser = false;
    if (sec.adviser_id) {
        isUserAdviser = String(sec.adviser_id) === String(teacherId);
    } else if (sec.adviser_name && displayName) {
        isUserAdviser = sec.adviser_name.trim().toLowerCase() === displayName.trim().toLowerCase();
    }
    if (isAdviserBadge) isAdviserBadge.style.display = isUserAdviser ? 'inline-flex' : 'none';
}

    // ============================================
    // LOAD ENROLLED STUDENTS (Progressive Fallback)
    // ============================================

    async function loadEnrolledStudents(sectionId) {
        let list = [];

        const attempts = [
            'id, lrn, first_name, middle_name, last_name, email, gender, avatar_url, status, section_id',
            'id, lrn, first_name, middle_name, last_name, email, gender, avatar_url, section_id',
            'id, lrn, first_name, middle_name, last_name, email, section_id',
            'id, lrn, first_name, last_name, email, section_id',
            'id, lrn, first_name, last_name, section_id',
            'id, first_name, last_name, section_id',
            'id, first_name, last_name',
        ];

        let stuData = null;
        let lastErr = null;

        for (const cols of attempts) {
            const { data, error } = await supabase
                .from('students')
                .select(cols)
                .eq('section_id', sectionId)
                .order('last_name', { ascending: true });

            if (!error) { stuData = data || []; lastErr = null; break; }

            lastErr = error;
            if (!isMissingColumnError(error.message)) break;
        }

        if (lastErr) {
            console.warn('[students] query error:', lastErr.message);
            showAlert('⚠️ Students query failed: ' + lastErr.message, 'warning');
        } else if (stuData?.length) {
            list = stuData.map(s => ({
                id:       s.id,
                lrn:      s.lrn || '',
                fullname: `${s.last_name || ''}, ${s.first_name || ''} ${s.middle_name ? s.middle_name[0] + '.' : ''}`.trim() || 'Student',
                email:    s.email || 'N/A',
                gender:   s.gender || 'N/A',
                status:   s.status || 'Enrolled',
                avatar:   s.avatar_url || null,
            }));
        }

        list.sort((a, b) => a.fullname.localeCompare(b.fullname));
        enrolledStudents = list;

        if (totalStudents)     totalStudents.textContent     = list.length;
        if (studentCountBadge) studentCountBadge.textContent = `${list.length} students`;
        if (tabStudentCount)   tabStudentCount.textContent   = list.length;

        renderStudentDirectory(list);
    }

    function renderStudentDirectory(list) {
        if (!studentsBody) return;

        if (!list.length) {
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
                        <div class="student-info" style="display:flex;align-items:center;gap:12px;">
                            <div class="student-avatar" style="width:38px;height:38px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;">
                                ${initial}
                            </div>
                            <div class="student-details">
                                <h4 style="font-weight:600;font-size:0.95rem;margin-bottom:2px;">${student.fullname}</h4>
                                <div class="student-meta" style="font-size:0.8rem;color:var(--gray-500);display:flex;gap:12px;">
                                    <span><i class="fas fa-id-card"></i> ${student.lrn || '—'}</span>
                                    <span><i class="fas fa-envelope"></i> ${student.email}</span>
                                </div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="status-badge" style="background:#dcfce7;color:#15803d;font-weight:600;padding:4px 10px;border-radius:20px;font-size:0.8rem;">
                            <i class="fas fa-check-circle"></i> ${student.status}
                        </span>
                    </td>
                    <td>
                        <div class="action-btns">
                            <a href="view-student.html?id=${student.id}" class="action-btn view" title="View Student Profile" style="padding:6px 12px;background:var(--gray-100);border-radius:6px;color:var(--primary);text-decoration:none;font-size:0.85rem;font-weight:600;display:inline-flex;align-items:center;gap:6px;">
                                <i class="fas fa-eye"></i> View
                            </a>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // ============================================
    // SCHEDULES
    // ============================================

    function formatTimeDisplay(t) {
        if (!t) return '--:--';
        try {
            if (t.toUpperCase().includes('AM') || t.toUpperCase().includes('PM')) return t;
            const [hh, mm = '00'] = t.split(':');
            const h = parseInt(hh, 10);
            const period = h >= 12 ? 'PM' : 'AM';
            const h12 = h % 12 || 12;
            return `${String(h12).padStart(2, '0')}:${mm} ${period}`;
        } catch { return t; }
    }

    async function loadSectionSchedules(sectionId) {
        try {
            const [{ data: sRows }, { data: subjRows }, { data: tchrRows }] = await Promise.all([
                supabase.from('schedules').select('*').eq('section_id', sectionId),
                supabase.from('subjects').select('*').order('name', { ascending: true }),
                supabase.from('teachers').select('id, employee_id, user_id, users(first_name, last_name, email)'),
            ]);

            allSubjects = subjRows || [];
            allTeachers = tchrRows || [];
            populatePeriodFormSelects();

            if (sRows?.length) {
                const dayWeight = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7 };
                classSchedules = sRows.sort((a, b) => {
                    const d = (dayWeight[a.day] || 99) - (dayWeight[b.day] || 99);
                    if (d !== 0) return d;
                    return (a.start_time || '').localeCompare(b.start_time || '');
                }).map(s => {
                    const sub = allSubjects.find(x => x.id === s.subject_id);
                    const tch = allTeachers.find(t => t.id === s.teacher_id || t.user_id === s.teacher_id);
                    const tname = tch?.users
                        ? `${tch.users.first_name || ''} ${tch.users.last_name || ''}`.trim()
                        : (s.teacher_name || 'Faculty');
                    return {
                        id:           s.id,
                        section_id:   s.section_id,
                        subject_id:   s.subject_id,
                        subject:      sub ? (sub.name || sub.code) : (s.subject || s.subject_name || 'General Subject'),
                        subject_code: sub?.code || '',
                        teacher_id:   s.teacher_id,
                        teacher:      tname,
                        day:          s.day || 'Monday',
                        start_time:   s.start_time || '07:30:00',
                        end_time:     s.end_time   || '08:30:00',
                        room:         s.room       || 'Room 101',
                    };
                });
            } else {
                classSchedules = [];
            }

            if (totalSubjects)     totalSubjects.textContent     = classSchedules.length;
            if (subjectsTaught)    subjectsTaught.textContent    = classSchedules.length > 0 ? new Set(classSchedules.map(c => c.subject)).size : 0;
            if (scheduleCountBadge) scheduleCountBadge.textContent = `${classSchedules.length} classes`;

            renderSchedule(classSchedules);
            await loadUploadedScheduleDoc(sectionId);
        } catch (e) {
            console.warn('Schedule load notice:', e.message);
        }
    }

    function populatePeriodFormSelects() {
        const subSelect = document.getElementById('periodSubjectSelect');
        const tchSelect = document.getElementById('periodTeacherSelect');

        if (subSelect && allSubjects.length) {
            subSelect.innerHTML = '<option value="">Select Subject...</option>' +
                allSubjects.map(s => `<option value="${s.id}">${s.name || s.code} (${s.code || 'Core'})</option>`).join('');
        }
        if (tchSelect && allTeachers.length) {
            tchSelect.innerHTML = '<option value="">Assign Teacher (Optional)...</option>' +
                allTeachers.map(t => {
                    const name = t.users
                        ? `${t.users.first_name || ''} ${t.users.last_name || ''}`.trim()
                        : (t.employee_id || 'Teacher');
                    return `<option value="${t.id}">${name} (${t.employee_id || 'Faculty'})</option>`;
                }).join('');
        }
    }

    async function fetchScheduleDocUrl(sectionId) {
        const { data, error } = await supabase
            .from('sections')
            .select('schedule_doc_url')
            .eq('id', sectionId)
            .maybeSingle();
        if (error) {
            console.warn('[sections] doc url fetch:', error.message);
            return null;
        }
        return data?.schedule_doc_url || null;
    }

    async function loadUploadedScheduleDoc(sectionId) {
        const secShortName = sectionData?.name || 'Section';
        let docData = null;

        const docUrl = await fetchScheduleDocUrl(sectionId);

        if (docUrl) {
            const isGDocs = sectionData?.schedule_doc_type === 'google_docs'
                         || docUrl.includes('docs.google.com')
                         || docUrl.includes('drive.google.com');
            const isImg   = (sectionData?.schedule_doc_type || '').startsWith('image/')
                         || /\.(png|jpe?g|webp|gif)$/i.test(sectionData?.schedule_doc_name || '')
                         || docUrl.startsWith('data:image/');

            docData = {
                sectionId,
                sectionName:  secShortName,
                fileName:     sectionData?.schedule_doc_name || (isGDocs
                                  ? `${secShortName} Student Load (Google Docs)`
                                  : isImg ? `${secShortName}_Student_Load.png`
                                          : 'Student_Load.pdf'),
                fileType:     sectionData?.schedule_doc_type || (isGDocs ? 'google_docs'
                                  : isImg ? 'image/png' : 'application/pdf'),
                fileData:     docUrl,
                url:          docUrl,
                isGoogleDocs: isGDocs,
                isImage:      isImg,
                uploadDate:   sectionData?.schedule_doc_updated_at || new Date().toISOString(),
                uploadedBy:   sectionData?.schedule_doc_uploaded_by || 'Teacher',
            };
        }

        if (docData) {
            try {
                localStorage.setItem('hes_section_schedule_' + sectionId, JSON.stringify(docData));
                localStorage.setItem('hes_section_schedule_' + secShortName.trim().toUpperCase(), JSON.stringify(docData));
                localStorage.setItem('hes_section_schedule_last_sync', Date.now().toString());
            } catch (_) {}
        }

        const uploadedBox  = document.getElementById('uploadedScheduleBox');
        const dropzone     = document.getElementById('scheduleUploadDropzone');
        const activeBadge  = document.getElementById('docActiveBadge');
        const fileNameEl   = document.getElementById('docFileName');
        const metaEl       = document.getElementById('docMetaInfo');
        const iconBox      = document.getElementById('docIconBox');
        const openGDocBtn  = document.getElementById('btnOpenGDocLink');
        const previewBtn   = document.getElementById('btnPreviewUploadedDoc');
        const downloadBtn  = document.getElementById('btnDownloadUploadedDoc');

        if (docData) {
            currentUploadedSchedule = docData;
            const { isGoogleDocs: isGDocs, isImage: isImg } = docData;

            if (uploadedBox) uploadedBox.style.display = 'block';
            if (dropzone)    dropzone.style.display    = 'none';
            if (activeBadge) {
                activeBadge.style.display = 'inline-flex';
                activeBadge.innerHTML = isGDocs
                    ? '<i class="fab fa-google-drive"></i> Active Google Doc'
                    : isImg
                        ? '<i class="fas fa-file-image"></i> Active Schedule Image'
                        : '<i class="fas fa-file-pdf"></i> Active PDF Document';
                activeBadge.style.background  = isGDocs ? '#eff6ff' : isImg ? '#ecfdf5' : '#fef2f2';
                activeBadge.style.color       = isGDocs ? '#1d4ed8' : isImg ? '#047857' : '#b91c1c';
                activeBadge.style.borderColor = isGDocs ? '#bfdbfe' : isImg ? '#a7f3d0' : '#fecaca';
            }
            if (fileNameEl) fileNameEl.textContent = docData.fileName;
            if (metaEl) {
                const dateStr = docData.uploadDate
                    ? new Date(docData.uploadDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'Recently';
                const byStr = docData.uploadedBy ? `Assigned by ${docData.uploadedBy}` : 'Assigned by Teacher';
                metaEl.textContent = `${isGDocs ? 'Google Docs Student Load' : isImg ? 'Schedule Image' : 'PDF Document'} • Sent on ${dateStr} • ${byStr}`;
            }
            if (iconBox) {
                iconBox.innerHTML = isGDocs
                    ? '<i class="fab fa-google-drive" style="color:#4285F4;font-size:1.6rem;"></i>'
                    : isImg
                        ? '<i class="fas fa-file-image text-success"></i>'
                        : '<i class="fas fa-file-pdf text-danger"></i>';
            }
            if (openGDocBtn) {
                if (isGDocs) {
                    openGDocBtn.style.display = 'inline-flex';
                    openGDocBtn.href = docData.url;
                } else {
                    openGDocBtn.style.display = 'none';
                }
            }
            if (downloadBtn) downloadBtn.style.display = isGDocs ? 'none' : 'inline-flex';
            if (previewBtn)  previewBtn.style.display  = 'inline-flex';
        } else {
            currentUploadedSchedule = null;
            if (uploadedBox) uploadedBox.style.display = 'none';
            if (dropzone)    dropzone.style.display    = 'block';
            if (activeBadge) activeBadge.style.display = 'none';
            if (openGDocBtn) openGDocBtn.style.display = 'none';
        }
    }

    function renderSchedule(schedules) {
        if (!scheduleList) return;
        if (!schedules.length) {
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
            <div class="schedule-item" style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid var(--gray-200);background:#fff;transition:background 0.2s;">
                <div style="flex:1;">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                        <span style="font-weight:700;color:var(--primary);font-size:0.96rem;">${item.subject || 'Subject'}</span>
                        ${item.subject_code ? `<span class="badge" style="background:rgba(11,43,74,0.08);color:var(--primary);font-size:0.72rem;padding:2px 8px;border-radius:4px;">${item.subject_code}</span>` : ''}
                    </div>
                    <div style="color:var(--gray-500);font-size:0.85rem;margin-top:4px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
                        <span><i class="fas fa-clock text-primary"></i> ${formatTimeDisplay(item.start_time)} - ${formatTimeDisplay(item.end_time)}</span>
                        <span><i class="fas fa-door-open text-primary"></i> ${item.room || 'Room 101'}</span>
                        <span><i class="fas fa-chalkboard-teacher text-primary"></i> ${item.teacher || 'Faculty'}</span>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:10px;">
                    <span class="badge" style="background:var(--gray-100);color:var(--primary);font-weight:600;padding:6px 12px;border-radius:8px;">${item.day}</span>
                    <button type="button" onclick="window.editSchedulePeriod('${item.id}')" title="Edit Period" style="background:#fff;border:1px solid var(--gray-300);color:var(--primary);width:32px;height:32px;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button type="button" onclick="window.deleteSchedulePeriod('${item.id}')" title="Delete Period" style="background:#fff;border:1px solid #fca5a5;color:#ef4444;width:32px;height:32px;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    // ============================================
    // SCHEDULE HANDLERS
    // ============================================

    function setupScheduleHandlers() {
        const fileInput       = document.getElementById('scheduleFileInput');
        const triggerBtn      = document.getElementById('btnTriggerUpload');
        const dropzone        = document.getElementById('areaFileDropzone');
        const replaceBtn      = document.getElementById('btnReplaceDoc');
        const deleteBtn       = document.getElementById('btnDeleteDoc');
        const previewBtn      = document.getElementById('btnPreviewUploadedDoc');
        const downloadBtn     = document.getElementById('btnDownloadUploadedDoc');
        const addPeriodBtn    = document.getElementById('btnAddPeriodBtn');
        const modalPeriod     = document.getElementById('modalSchedulePeriod');
        const closePeriodBtn  = document.getElementById('btnClosePeriodModal');
        const cancelPeriodBtn = document.getElementById('btnCancelPeriodModal');
        const formPeriod      = document.getElementById('formSchedulePeriod');
        const modalDocViewer  = document.getElementById('modalDocViewer');
        const closeDocViewer  = document.getElementById('btnCloseDocViewer');
        const printModalDoc   = document.getElementById('btnPrintModalDoc');

        const btnToggleMethodFile  = document.getElementById('btnToggleMethodFile');
        const btnToggleMethodGDocs = document.getElementById('btnToggleMethodGDocs');
        const areaFileDropzone     = document.getElementById('areaFileDropzone');
        const areaGDocsInput       = document.getElementById('areaGDocsInput');
        const gdocsUrlInput        = document.getElementById('gdocsUrlInput');
        const btnSaveGDocsLink     = document.getElementById('btnSaveGDocsLink');

        if (btnToggleMethodFile && btnToggleMethodGDocs) {
            btnToggleMethodFile.addEventListener('click', () => {
                btnToggleMethodFile.style.background  = 'var(--primary)';
                btnToggleMethodFile.style.color       = '#fff';
                btnToggleMethodFile.style.borderColor = 'var(--primary)';
                btnToggleMethodGDocs.style.background  = '#fff';
                btnToggleMethodGDocs.style.color       = 'var(--gray-700)';
                btnToggleMethodGDocs.style.borderColor = 'var(--gray-300)';
                if (areaFileDropzone) areaFileDropzone.style.display = 'block';
                if (areaGDocsInput)   areaGDocsInput.style.display   = 'none';
            });
            btnToggleMethodGDocs.addEventListener('click', () => {
                btnToggleMethodGDocs.style.background  = '#1a73e8';
                btnToggleMethodGDocs.style.color       = '#fff';
                btnToggleMethodGDocs.style.borderColor = '#1a73e8';
                btnToggleMethodFile.style.background  = '#fff';
                btnToggleMethodFile.style.color       = 'var(--gray-700)';
                btnToggleMethodFile.style.borderColor = 'var(--gray-300)';
                if (areaFileDropzone) areaFileDropzone.style.display = 'none';
                if (areaGDocsInput)   areaGDocsInput.style.display   = 'block';
                if (gdocsUrlInput)    gdocsUrlInput.focus();
            });
        }

        if (btnSaveGDocsLink && gdocsUrlInput) {
            btnSaveGDocsLink.addEventListener('click', async () => {
                if (!hasRealSection()) { showAlert('❌ No valid section loaded.', 'error'); return; }

                const url = gdocsUrlInput.value.trim();
                if (!url) { alert('Please enter a valid Google Docs or Google Drive link.'); return; }
                if (!/^https?:\/\//i.test(url)) { alert('Please enter a full URL starting with https://'); return; }

                btnSaveGDocsLink.disabled = true;
                btnSaveGDocsLink.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Attaching...';

                const secShortName = sectionData?.name || 'Section';
                const teacherNm    = displayName;
                const nowIso       = new Date().toISOString();

                try {
                    const { error } = await supabase.from('sections').update({
                        schedule_doc_url:        url,
                        schedule_doc_name:       `${secShortName} Student Load (Google Docs)`,
                        schedule_doc_type:       'google_docs',
                        schedule_doc_uploaded_by: teacherNm,
                        schedule_doc_updated_at: nowIso,
                        shared_at:               nowIso,
                        shared_by:               teacherNm,
                    }).eq('id', currentSectionId);
                    if (error) throw error;

                    Object.assign(sectionData, {
                        schedule_doc_url:        url,
                        schedule_doc_name:       `${secShortName} Student Load (Google Docs)`,
                        schedule_doc_type:       'google_docs',
                        schedule_doc_uploaded_by: teacherNm,
                        schedule_doc_updated_at: nowIso,
                    });

                    try {
                        await supabase.from('activity_logs').insert([{
                            user_id: sessionUser.id,
                            role:    'teacher',
                            action:  'Section Student Load Shared',
                            details: `Teacher ${teacherNm} shared official Google Docs student load for Section ${secShortName}.`,
                            timestamp: nowIso,
                        }]);
                    } catch (_) {}

                    gdocsUrlInput.value = '';
                    await loadUploadedScheduleDoc(currentSectionId);
                    showAlert(`✅ Official Google Docs student load linked successfully!`, 'success');
                } catch (err) {
                    console.error('GDocs save failed:', err);
                    showAlert('❌ Failed: ' + err.message, 'error');
                } finally {
                    btnSaveGDocsLink.disabled = false;
                    btnSaveGDocsLink.innerHTML = '<i class="fas fa-link"></i> Attach Google Doc';
                }
            });
        }

        if (triggerBtn && fileInput) triggerBtn.addEventListener('click', () => fileInput.click());
        if (dropzone && fileInput) {
            dropzone.addEventListener('click', e => {
                if (e.target !== triggerBtn) fileInput.click();
            });
            dropzone.addEventListener('dragover', e => {
                e.preventDefault();
                dropzone.style.borderColor = 'var(--primary)';
                dropzone.style.background  = '#f0fdf4';
            });
            dropzone.addEventListener('dragleave', () => {
                dropzone.style.borderColor = 'var(--gray-300)';
                dropzone.style.background  = 'var(--gray-50)';
            });
            dropzone.addEventListener('drop', e => {
                e.preventDefault();
                dropzone.style.borderColor = 'var(--gray-300)';
                dropzone.style.background  = 'var(--gray-50)';
                if (e.dataTransfer.files?.[0]) processScheduleFile(e.dataTransfer.files[0]);
            });
        }
        if (fileInput) {
            fileInput.addEventListener('change', e => {
                if (e.target.files?.[0]) processScheduleFile(e.target.files[0]);
            });
        }
        if (replaceBtn && fileInput) replaceBtn.addEventListener('click', () => fileInput.click());

        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                if (!hasRealSection()) { showAlert('❌ No valid section loaded.', 'error'); return; }
                if (!confirm('Are you sure you want to remove the uploaded student load schedule for this section?')) return;

                const nowIso = new Date().toISOString();
                try {
                    const { error } = await supabase.from('sections').update({
                        schedule_doc_url:        null,
                        schedule_doc_name:       null,
                        schedule_doc_type:       null,
                        schedule_doc_uploaded_by: null,
                        schedule_doc_updated_at: nowIso,
                    }).eq('id', currentSectionId);
                    if (error) throw error;

                    Object.assign(sectionData, {
                        schedule_doc_url:        null,
                        schedule_doc_name:       null,
                        schedule_doc_type:       null,
                        schedule_doc_updated_at: nowIso,
                    });

                    await loadUploadedScheduleDoc(currentSectionId);
                    showAlert('Student load schedule removed successfully.', 'success');
                } catch (err) {
                    console.error('Schedule delete failed:', err);
                    showAlert('❌ Failed: ' + err.message, 'error');
                }
            });
        }

        if (previewBtn)  previewBtn.addEventListener('click', () => openDocViewer(currentUploadedSchedule));
        if (downloadBtn) downloadBtn.addEventListener('click', () => downloadScheduleDoc(currentUploadedSchedule));
        if (closeDocViewer && modalDocViewer) closeDocViewer.addEventListener('click', () => modalDocViewer.style.display = 'none');
        if (printModalDoc) printModalDoc.addEventListener('click', () => printScheduleDoc(currentUploadedSchedule));

        if (addPeriodBtn && modalPeriod) {
            addPeriodBtn.addEventListener('click', () => {
                if (!hasRealSection()) { showAlert('❌ No valid section loaded.', 'error'); return; }
                document.getElementById('editPeriodId').value = '';
                document.getElementById('modalPeriodTitle').innerHTML = '<i class="fas fa-calendar-plus"></i> Add Class Period';
                formPeriod.reset();
                modalPeriod.style.display = 'flex';
            });
        }
        if (closePeriodBtn  && modalPeriod) closePeriodBtn.addEventListener('click',  () => modalPeriod.style.display = 'none');
        if (cancelPeriodBtn && modalPeriod) cancelPeriodBtn.addEventListener('click', () => modalPeriod.style.display = 'none');

        if (formPeriod) {
            formPeriod.addEventListener('submit', async e => {
                e.preventDefault();
                await handleSavePeriod();
            });
        }
    }

    // ============================================
    // SCHEDULE FILE UPLOAD (Storage-backed)
    // ============================================

    async function uploadScheduleToStorage(file, sectionId) {
        const ext  = (file.name.split('.').pop() || 'bin').toLowerCase();
        const path = `section_schedules/${sectionId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

        const { error: upErr } = await supabase
            .storage
            .from('teacher-schedules')
            .upload(path, file, {
                contentType: file.type || 'application/octet-stream',
                upsert: false,
            });
        if (upErr) throw upErr;

        const { data: pub } = supabase.storage.from('teacher-schedules').getPublicUrl(path);
        if (!pub?.publicUrl) throw new Error('Could not resolve public URL for uploaded file.');
        return pub.publicUrl;
    }

    async function processScheduleFile(file) {
        if (!file) return;
        if (file.size > 15 * 1024 * 1024) { alert('File exceeds maximum allowed size of 15MB.'); return; }
        if (!hasRealSection()) { showAlert('❌ No valid section loaded.', 'error'); return; }

        const secShortName = sectionData?.name || 'Section';
        const teacherNm    = displayName;
        const fileType     = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
        const isImg        = fileType.startsWith('image/');
        const nowIso       = new Date().toISOString();

        try {
            const publicUrl = await uploadScheduleToStorage(file, currentSectionId);

            const { error } = await supabase.from('sections').update({
                schedule_doc_url:        publicUrl,
                schedule_doc_name:       file.name,
                schedule_doc_type:       fileType,
                schedule_doc_uploaded_by: teacherNm,
                schedule_doc_updated_at: nowIso,
                shared_at:               nowIso,
                shared_by:               teacherNm,
            }).eq('id', currentSectionId);
            if (error) throw error;

            Object.assign(sectionData, {
                schedule_doc_url:        publicUrl,
                schedule_doc_name:       file.name,
                schedule_doc_type:       fileType,
                schedule_doc_uploaded_by: teacherNm,
                schedule_doc_updated_at: nowIso,
            });

            try {
                await supabase.from('activity_logs').insert([{
                    user_id: sessionUser.id,
                    role:    'teacher',
                    action:  'Section Student Load Uploaded',
                    details: `Teacher ${teacherNm} sent/uploaded official student load schedule (${file.name}) for Section ${secShortName}.`,
                    timestamp: nowIso,
                }]);
            } catch (_) {}

            await loadUploadedScheduleDoc(currentSectionId);
            showAlert(`✅ Official student load schedule ${isImg ? 'image' : 'file'} "${file.name}" sent successfully! Students can now view, download, and print it.`, 'success');
        } catch (err) {
            console.error('Schedule upload failed:', err);
            showAlert('❌ Upload failed: ' + (err.message || err), 'error');
        }
    }

    function openDocViewer(doc) {
        if (!doc || (!doc.fileData && !doc.url)) return;
        const modal     = document.getElementById('modalDocViewer');
        const container = document.getElementById('docViewerContent');
        const titleEl   = document.getElementById('docViewerTitle');
        if (!modal || !container) return;

        const isGDocs = doc.isGoogleDocs || doc.fileType === 'google_docs'
                     || (doc.url || '').includes('docs.google.com')
                     || (doc.url || '').includes('drive.google.com');
        const isPdf   = (doc.fileType || '').includes('pdf') || (doc.fileName || '').toLowerCase().endsWith('.pdf');
        const isImg   = doc.isImage || (doc.fileType || '').startsWith('image/')
                     || /\.(png|jpe?g|webp|gif)$/i.test(doc.fileName || '')
                     || (doc.fileData || '').startsWith('data:image/');

        if (titleEl) {
            titleEl.innerHTML = isGDocs
                ? `<i class="fab fa-google-drive" style="color:#4285F4;"></i> ${doc.fileName || 'Google Docs Student Load'}`
                : isImg
                    ? `<i class="fas fa-file-image" style="color:#10b981;"></i> ${doc.fileName || 'Schedule Image'}`
                    : `<i class="fas fa-file-pdf" style="color:#ef4444;"></i> ${doc.fileName || 'PDF Student Load'}`;
        }

        if (isGDocs) {
            let embedUrl = doc.url || doc.fileData;
            if (embedUrl.includes('/edit')) embedUrl = embedUrl.replace('/edit', '/preview');
            container.innerHTML = `
                <div style="width:100%;height:100%;display:flex;flex-direction:column;">
                    <div style="padding:10px 14px;background:#eff6ff;border-bottom:1px solid #bfdbfe;display:flex;justify-content:space-between;align-items:center;">
                        <span style="font-size:0.85rem;color:#1e40af;font-weight:600;"><i class="fab fa-google-drive"></i> Google Docs Student Load</span>
                        <a href="${doc.url}" target="_blank" rel="noopener noreferrer" style="font-size:0.85rem;color:#1d4ed8;text-decoration:underline;font-weight:600;">Open in New Tab <i class="fas fa-external-link-alt"></i></a>
                    </div>
                    <iframe src="${embedUrl}" style="flex:1;width:100%;border:none;"></iframe>
                </div>
            `;
        } else if (isPdf) {
            container.innerHTML = `<iframe src="${doc.fileData || doc.url}" style="width:100%;height:100%;border:none;border-radius:8px;"></iframe>`;
        } else {
            container.innerHTML = `<img src="${doc.fileData || doc.url}" alt="Student Load Schedule Preview" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:8px;box-shadow:0 4px 10px rgba(0,0,0,0.1);">`;
        }

        modal.style.display = 'flex';
    }

    function downloadScheduleDoc(doc) {
        if (!doc || (!doc.fileData && !doc.url)) return;
        const a = document.createElement('a');
        a.href     = doc.fileData || doc.url;
        a.download = doc.fileName || `Section_Student_Load_${doc.sectionName || ''}`;
        a.target   = '_blank';
        a.rel      = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function printScheduleDoc(doc) {
        if (!doc || (!doc.fileData && !doc.url)) return;
        const win = window.open('', '_blank');
        if (!win) { showAlert('⚠️ Popup blocked — please allow popups to print.', 'warning'); return; }
        const isPdf   = (doc.fileType || '').includes('pdf') || (doc.fileName || '').toLowerCase().endsWith('.pdf');
        const fileSrc = doc.fileData || doc.url;

        if (isPdf) {
            win.document.write(`
                <html><head><title>Print Student Load Schedule - ${doc.fileName || 'Schedule'}</title></head>
                <body style="margin:0;padding:0;">
                    <iframe src="${fileSrc}" style="width:100vw;height:100vh;border:none;"></iframe>
                </body></html>
            `);
        } else {
            win.document.write(`
                <html><head><title>Print Student Load Schedule - ${doc.fileName || 'Schedule Image'}</title>
                <style>
                    @page { size: letter portrait; margin: 6mm 8mm; }
                    html, body { margin:0;padding:0;width:100%;height:100%;overflow:hidden;display:flex;align-items:center;justify-content:center; }
                    img { max-width:100%;max-height:100%;object-fit:contain; }
                </style>
                </head>
                <body onload="window.print();">
                    <img src="${fileSrc}" alt="Student Load Schedule">
                </body></html>
            `);
        }
        win.document.close();
    }

    // ============================================
    // SAVE / EDIT / DELETE PERIODS
    // ============================================

    async function handleSavePeriod() {
        if (!hasRealSection()) { showAlert('❌ No valid section loaded.', 'error'); return; }

        const editId       = document.getElementById('editPeriodId').value;
        const subjectId    = document.getElementById('periodSubjectSelect').value;
        const day          = document.getElementById('periodDaySelect').value;
        const room         = document.getElementById('periodRoomInput').value.trim();
        const startTime    = document.getElementById('periodStartTime').value;
        const endTime      = document.getElementById('periodEndTime').value;
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
                day,
                room,
                start_time: startTime.length === 5 ? startTime + ':00' : startTime,
                end_time:   endTime.length === 5   ? endTime   + ':00' : endTime,
                teacher_id: teacherIdVal,
            };

            if (editId) {
                const { error } = await supabase.from('schedules').update(rowData).eq('id', editId);
                if (error) throw error;
                showAlert('✅ Class period updated successfully!', 'success');
            } else {
                const { error } = await supabase.from('schedules').insert([rowData]);
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

    window.deleteSchedulePeriod = async function (id) {
        if (!hasRealSection()) { showAlert('❌ No valid section loaded.', 'error'); return; }
        if (!confirm('Are you sure you want to delete this class period from the schedule?')) return;
        try {
            const { error } = await supabase.from('schedules').delete().eq('id', id);
            if (error) throw error;
            showAlert('Class period removed from schedule.', 'success');
            await loadSectionSchedules(currentSectionId);
        } catch (e) {
            showAlert('Failed to delete period: ' + e.message, 'error');
        }
    };

    window.editSchedulePeriod = function (id) {
        const item = classSchedules.find(s => s.id === id);
        if (!item) return;
        document.getElementById('editPeriodId').value = item.id;
        document.getElementById('modalPeriodTitle').innerHTML = '<i class="fas fa-edit"></i> Edit Class Period';
        if (item.subject_id) document.getElementById('periodSubjectSelect').value = item.subject_id;
        document.getElementById('periodDaySelect').value  = item.day || 'Monday';
        document.getElementById('periodRoomInput').value  = item.room || '';
        document.getElementById('periodStartTime').value  = (item.start_time || '').slice(0, 5);
        document.getElementById('periodEndTime').value    = (item.end_time || '').slice(0, 5);
        if (item.teacher_id) document.getElementById('periodTeacherSelect').value = item.teacher_id;
        document.getElementById('modalSchedulePeriod').style.display = 'flex';
    };

    // ============================================
    // ATTENDANCE — DATE CHANGE
    // ============================================

    async function handleDateSelectionChange() {
        const selectedDate = sectionAttDate ? sectionAttDate.value : todayStr;
        isWeekendSelected = checkIsWeekend(selectedDate);

        const d = new Date(selectedDate + 'T00:00:00');
        const dayName = isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { weekday: 'long' });

        if (dateWeekdayBadge) {
            if (isWeekendSelected) {
                dateWeekdayBadge.textContent  = `${dayName} (Weekend)`;
                dateWeekdayBadge.style.background = '#fee2e2';
                dateWeekdayBadge.style.color      = '#b91c1c';
            } else {
                dateWeekdayBadge.textContent  = dayName;
                dateWeekdayBadge.style.background = '#e0f2fe';
                dateWeekdayBadge.style.color      = '#0369a1';
            }
        }
        if (weekendNoticeBanner) {
            weekendNoticeBanner.style.display = isWeekendSelected ? 'block' : 'none';
        }
        if (markAllPresentBtn)        markAllPresentBtn.disabled        = isWeekendSelected;
        if (saveSectionAttendanceBtn) saveSectionAttendanceBtn.disabled = isWeekendSelected;

        await loadAttendanceForDate(selectedDate);
    }

    if (sectionAttDate) sectionAttDate.addEventListener('change', handleDateSelectionChange);

    async function loadAttendanceForDate(dateStr) {
        sectionAttendanceState = {};

        if (isWeekendSelected) {
            enrolledStudents.forEach(stu => {
                sectionAttendanceState[stu.id] = {
                    status: 'Weekend', timeIn: '—', timeOut: '—', remarks: 'Weekend (No Classes)',
                };
            });
            renderAttendanceTable();
            updateCounters();
            return;
        }

        if (!hasRealSection()) {
            enrolledStudents.forEach(stu => {
                sectionAttendanceState[stu.id] = {
                    status: 'Present', timeIn: '07:30 AM', timeOut: '04:30 PM', remarks: 'On time',
                };
            });
            renderAttendanceTable();
            updateCounters();
            return;
        }

        let dbRecords = [];
        try {
            const studentIds = enrolledStudents.map(s => s.id);

            let { data, error } = await supabase
                .from('attendance')
                .select('*')
                .eq('section_id', currentSectionId)
                .eq('date', dateStr);

            if (error && /section_id/i.test(error.message || '')) {
                console.warn('[attendance] section_id column missing — falling back to student-scoped query');
                const retry = await supabase
                    .from('attendance')
                    .select('*')
                    .eq('date', dateStr)
                    .in('student_id', studentIds.length ? studentIds : ['__none__']);
                data  = retry.data;
                error = retry.error;
            }

            if (error) console.warn('[attendance] load error:', error.message);
            else if (data) {
                dbRecords = data.filter(r =>
                    studentIds.includes(r.student_id) ||
                    enrolledStudents.some(s => s.lrn && s.lrn === r.lrn)
                );
            }
        } catch (e) {
            console.warn('[attendance] load exception:', e.message);
        }

        let localRecords = [];
        try {
            const raw = localStorage.getItem('hes_student_attendance');
            if (raw) {
                localRecords = (JSON.parse(raw) || []).filter(r =>
                    r.date === dateStr &&
                    (!r.section_id || r.section_id === currentSectionId)
                );
            }
        } catch (_) {}

        enrolledStudents.forEach(stu => {
            const dbMatch    = dbRecords.find(r => r.student_id === stu.id || (stu.lrn && r.lrn === stu.lrn));
            const localMatch = localRecords.find(r => r.student_id === stu.id || (stu.lrn && r.lrn === stu.lrn));
            const record     = dbMatch || localMatch;

            if (record) {
                sectionAttendanceState[stu.id] = {
                    status:  record.status || 'Present',
                    timeIn:  record.time_in  || record.timeIn  || '07:30 AM',
                    timeOut: record.time_out || record.timeOut || '04:30 PM',
                    remarks: record.remarks  || (record.status === 'Present' ? 'On time' : ''),
                };
            } else {
                sectionAttendanceState[stu.id] = {
                    status: 'Present', timeIn: '07:30 AM', timeOut: '04:30 PM', remarks: 'On time',
                };
            }
        });

        renderAttendanceTable();
        updateCounters();
    }

    // ============================================
    // ATTENDANCE TABLE RENDER
    // ============================================

    function renderAttendanceTable() {
        if (!sectionAttendanceBody) return;

        if (!enrolledStudents.length) {
            sectionAttendanceBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align:center;padding:30px;">
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
                    <tr style="border-bottom:1px solid var(--gray-200);opacity:0.6;background:#fafafa;">
                        <td style="padding:12px 16px;">
                            <div style="display:flex;align-items:center;gap:10px;">
                                <div style="width:34px;height:34px;border-radius:50%;background:var(--gray-300);color:var(--gray-700);display:flex;align-items:center;justify-content:center;font-weight:700;">
                                    ${initial}
                                </div>
                                <div>
                                    <strong style="color:var(--gray-700);font-size:0.95rem;">${student.fullname}</strong>
                                    <div style="font-size:0.8rem;color:var(--gray-400);">LRN: ${student.lrn || '—'}</div>
                                </div>
                            </div>
                        </td>
                        <td style="padding:12px 16px;">
                            <span class="status-badge" style="background:#e0f2fe;color:#0369a1;font-weight:600;padding:6px 14px;border-radius:20px;font-size:0.82rem;border:1px solid #bae6fd;">
                                <i class="fas fa-calendar-times"></i> Weekend (No Classes)
                            </span>
                        </td>
                        <td style="padding:12px 16px;color:var(--gray-400);font-weight:600;">—</td>
                        <td style="padding:12px 16px;color:var(--gray-400);font-style:italic;font-size:0.88rem;">No attendance recorded on weekends</td>
                    </tr>
                `;
            }).join('');
            return;
        }

        sectionAttendanceBody.innerHTML = enrolledStudents.map(student => {
            const initial   = student.fullname.charAt(0).toUpperCase();
            const st        = sectionAttendanceState[student.id] || { status: 'Present', timeIn: '07:30 AM', timeOut: '04:30 PM', remarks: 'On time' };
            const curStatus = st.status;

            return `
                <tr style="border-bottom:1px solid var(--gray-200);">
                    <td style="padding:12px 16px;">
                        <div style="display:flex;align-items:center;gap:10px;">
                            <div style="width:36px;height:36px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;">
                                ${initial}
                            </div>
                            <div>
                                <strong style="color:var(--gray-900);font-size:0.95rem;">${student.fullname}</strong>
                                <div style="font-size:0.8rem;color:var(--gray-500);"><i class="fas fa-id-card"></i> ${student.lrn || '—'}</div>
                            </div>
                        </div>
                    </td>
                    <td style="padding:12px 16px;">
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
                    <td style="padding:12px 16px;">
                        <input type="text" class="att-time-input" id="timein_${student.id}" value="${st.timeIn}" onchange="window.updateStudentTime('${student.id}', this.value)" placeholder="07:30 AM" ${curStatus === 'Absent' || curStatus === 'Excused' ? 'disabled' : ''}>
                    </td>
                    <td style="padding:12px 16px;">
                        <input type="text" class="att-remarks-input" id="remarks_${student.id}" value="${st.remarks}" onchange="window.updateStudentRemarks('${student.id}', this.value)" placeholder="e.g. On time, Medical reason">
                    </td>
                </tr>
            `;
        }).join('');
    }

    window.setStudentStatus = function (studentId, newStatus) {
        if (isWeekendSelected) return;
        if (!sectionAttendanceState[studentId]) {
            sectionAttendanceState[studentId] = { status: newStatus, timeIn: '07:30 AM', timeOut: '04:30 PM', remarks: '' };
        } else {
            sectionAttendanceState[studentId].status = newStatus;
        }

        const timeInput    = document.getElementById(`timein_${studentId}`);
        const remarksInput = document.getElementById(`remarks_${studentId}`);

        if (newStatus === 'Present') {
            sectionAttendanceState[studentId].timeIn = '07:30 AM';
            if (!sectionAttendanceState[studentId].remarks || sectionAttendanceState[studentId].remarks === 'Unexcused') {
                sectionAttendanceState[studentId].remarks = 'On time';
            }
            if (timeInput)    { timeInput.value = '07:30 AM'; timeInput.disabled = false; }
            if (remarksInput) remarksInput.value = sectionAttendanceState[studentId].remarks;
        } else if (newStatus === 'Late') {
            sectionAttendanceState[studentId].timeIn  = '08:15 AM';
            sectionAttendanceState[studentId].remarks = 'Late arrival';
            if (timeInput)    { timeInput.value = '08:15 AM'; timeInput.disabled = false; }
            if (remarksInput) remarksInput.value = 'Late arrival';
        } else if (newStatus === 'Absent') {
            sectionAttendanceState[studentId].timeIn  = '—';
            sectionAttendanceState[studentId].remarks = 'Unexcused';
            if (timeInput)    { timeInput.value = '—'; timeInput.disabled = true; }
            if (remarksInput) remarksInput.value = 'Unexcused';
        } else if (newStatus === 'Excused') {
            sectionAttendanceState[studentId].timeIn  = '—';
            sectionAttendanceState[studentId].remarks = 'Official excuse / Certificate';
            if (timeInput)    { timeInput.value = '—'; timeInput.disabled = true; }
            if (remarksInput) remarksInput.value = 'Official excuse / Certificate';
        }

        const group = document.querySelector(`.att-status-group[data-student-id="${studentId}"]`);
        if (group) {
            group.querySelectorAll('.att-status-btn').forEach(btn => btn.classList.remove('active'));
            const targetBtn = group.querySelector(`.btn-${newStatus.toLowerCase()}`);
            if (targetBtn) targetBtn.classList.add('active');
        }
        updateCounters();
    };

    window.updateStudentTime = function (studentId, val) {
        if (sectionAttendanceState[studentId]) sectionAttendanceState[studentId].timeIn = val;
    };
    window.updateStudentRemarks = function (studentId, val) {
        if (sectionAttendanceState[studentId]) sectionAttendanceState[studentId].remarks = val;
    };

    function updateCounters() {
        if (isWeekendSelected) {
            if (countPresent) countPresent.textContent = '0';
            if (countLate)    countLate.textContent    = '0';
            if (countAbsent)  countAbsent.textContent  = '0';
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
        if (countLate)    countLate.textContent    = late;
        if (countAbsent)  countAbsent.textContent  = abs;
        if (countExcused) countExcused.textContent = exc;

        const total = enrolledStudents.length;
        const rate  = total > 0 ? Math.round(((pres + late + exc) / total) * 100) : 0;
        if (attendanceRate) attendanceRate.textContent = `${rate}%`;
    }

    if (markAllPresentBtn) {
        markAllPresentBtn.addEventListener('click', () => {
            if (isWeekendSelected) {
                showAlert('⚠️ Cannot mark attendance on weekends (Saturday & Sunday).', 'warning');
                return;
            }
            enrolledStudents.forEach(stu => window.setStudentStatus(stu.id, 'Present'));
            showAlert('✅ All students marked as Present (07:30 AM).', 'success');
        });
    }

    // ============================================
    // SAVE ATTENDANCE & NOTIFY STUDENTS
    // ============================================

    if (saveSectionAttendanceBtn) {
        saveSectionAttendanceBtn.addEventListener('click', async () => {
            const selectedDate = sectionAttDate ? sectionAttDate.value : todayStr;

            if (!hasRealSection()) {
                showAlert('❌ No valid section loaded.', 'error');
                return;
            }
            if (checkIsWeekend(selectedDate)) {
                showAlert('📅 Attendance recording is disabled on weekends (Saturday & Sunday).', 'warning');
                return;
            }
            if (!enrolledStudents.length) {
                showAlert('⚠️ No enrolled students found in this section to record attendance for.', 'warning');
                return;
            }

            saveSectionAttendanceBtn.disabled = true;
            saveSectionAttendanceBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Saving & Notifying...`;

            try {
                const recordsToInsert       = [];
                const notificationsToInsert = [];
                const localRecords          = [];

                enrolledStudents.forEach(stu => {
                    const st = sectionAttendanceState[stu.id] || { status: 'Present', timeIn: '07:30 AM', timeOut: '04:30 PM', remarks: 'On time' };
                    const timeInVal  = (st.status === 'Absent' || st.status === 'Excused') ? null : (st.timeIn  || '07:30 AM');
                    const timeOutVal = (st.status === 'Absent' || st.status === 'Excused') ? null : (st.timeOut || '04:30 PM');

                    recordsToInsert.push({
                        section_id: currentSectionId,
                        student_id: stu.id,
                        teacher_id: teacherId,
                        date:       selectedDate,
                        time_in:    timeInVal,
                        time_out:   timeOutVal,
                        status:     st.status,
                        remarks:    st.remarks || (st.status === 'Present' ? 'On time' : ''),
                        created_at: new Date().toISOString(),
                    });

                    notificationsToInsert.push({
                        user_id:         stu.id,
                        student_id:      stu.id,
                        recipient_email: stu.email && stu.email !== 'N/A' ? stu.email : null,
                        role:            'student',
                        title:           'Attendance Notification',
                        message:         `Your attendance for ${formatDate(selectedDate)} has been marked as: ${st.status.toUpperCase()} by Teacher ${displayName}. Remarks: ${st.remarks || 'None'}`,
                        type:            'attendance',
                        read:            false,
                        is_read:         false,
                        created_at:      new Date().toISOString(),
                    });

                    localRecords.push({
                        id:         `ATT-${selectedDate}-${stu.lrn || stu.id}`,
                        section_id: currentSectionId,
                        student_id: stu.id,
                        lrn:        stu.lrn,
                        name:       stu.fullname,
                        date:       selectedDate,
                        time_in:    timeInVal  || '—',
                        time_out:   timeOutVal || '—',
                        timeIn:     timeInVal  || '—',
                        timeOut:    timeOutVal || '—',
                        status:     st.status,
                        remarks:    st.remarks || (st.status === 'Present' ? 'On time' : ''),
                    });

                    try {
                        if (stu.lrn) {
                            const sKey = `hes_student_attendance_${stu.lrn}`;
                            let hist = [];
                            const raw = localStorage.getItem(sKey);
                            if (raw) hist = JSON.parse(raw);
                            const exIdx = hist.findIndex(h => h.date === selectedDate);
                            const rec = {
                                id: `ATT-${selectedDate}-${stu.lrn}`,
                                date: selectedDate,
                                time_in:  timeInVal  || '—',
                                time_out: timeOutVal || '—',
                                timeIn:   timeInVal  || '—',
                                timeOut:  timeOutVal || '—',
                                status:   st.status,
                                remarks:  st.remarks || '',
                            };
                            if (exIdx >= 0) hist[exIdx] = rec;
                            else hist.unshift(rec);
                            localStorage.setItem(sKey, JSON.stringify(hist));
                        }

                        const notifKey = `hes_notifications_${stu.id}`;
                        let notifs = [];
                        const rawN = localStorage.getItem(notifKey);
                        if (rawN) notifs = JSON.parse(rawN);
                        notifs.unshift({
                            id:         'NOTIF-' + Date.now() + '-' + stu.id,
                            title:      'Attendance Notification',
                            message:    `Your attendance for ${formatDate(selectedDate)} was recorded as ${st.status} by Teacher ${displayName}.`,
                            time:       'Just now',
                            read:       false,
                            created_at: new Date().toISOString(),
                        });
                        localStorage.setItem(notifKey, JSON.stringify(notifs));
                    } catch (_) {}
                });

                try {
                    const studentIds = enrolledStudents.map(s => s.id);
                    const { error: delErr } = await supabase
                        .from('attendance')
                        .delete()
                        .eq('section_id', currentSectionId)
                        .eq('date', selectedDate)
                        .in('student_id', studentIds);
                    if (delErr && /section_id/i.test(delErr.message || '')) {
                        console.warn('[attendance] section_id column missing on delete — retrying without it');
                        await supabase.from('attendance')
                            .delete()
                            .eq('date', selectedDate)
                            .in('student_id', studentIds);
                    } else if (delErr) {
                        console.warn('[attendance] delete error:', delErr.message);
                    }
                } catch (e) {
                    console.warn('[attendance] delete exception:', e.message);
                }

                try {
                    const { error: insErr } = await supabase.from('attendance').insert(recordsToInsert);
                    if (insErr && /section_id/i.test(insErr.message || '')) {
                        console.warn('[attendance] section_id column missing on insert — retrying without it');
                        const stripped = recordsToInsert.map(({ section_id, ...rest }) => rest);
                        const retry = await supabase.from('attendance').insert(stripped);
                        if (retry.error) console.warn('[attendance] insert retry error:', retry.error.message);
                    } else if (insErr) {
                        console.warn('[attendance] insert error:', insErr.message);
                    }
                } catch (e) {
                    console.warn('[attendance] insert exception:', e.message);
                }

                try {
                    const { error: notifErr } = await supabase.from('notifications').insert(notificationsToInsert);
                    if (notifErr) console.warn('[notifications] insert error:', notifErr.message);
                } catch (e) {
                    console.warn('[notifications] insert exception:', e.message);
                }

                try {
                    const existingRaw = localStorage.getItem('hes_student_attendance');
                    let allLocal = existingRaw ? JSON.parse(existingRaw) : [];
                    allLocal = allLocal.filter(a => a.date !== selectedDate || a.section_id !== currentSectionId);
                    allLocal = [...localRecords, ...allLocal];
                    localStorage.setItem('hes_student_attendance', JSON.stringify(allLocal));

                    const rawCentral = localStorage.getItem('hes_attendance_records');
                    let central = rawCentral ? JSON.parse(rawCentral) : [];
                    central = central.filter(a => a.date !== selectedDate || a.section_id !== currentSectionId);
                    localRecords.forEach(lr => {
                        central.unshift({
                            ...lr,
                            studentId: lr.student_id,
                            recorded_by: teacherId,
                            teacher_name: displayName,
                            updated_at: new Date().toISOString(),
                        });
                    });
                    localStorage.setItem('hes_attendance_records', JSON.stringify(central.slice(0, 1000)));

                    localStorage.setItem('hes_latest_attendance_event', JSON.stringify({
                        date: selectedDate,
                        section_id: currentSectionId,
                        timestamp: Date.now(),
                    }));
                } catch (_) {}

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