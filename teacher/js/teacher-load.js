// ===== TEACHER LOAD (ASSIGNED BY ADMIN) JAVASCRIPT =====
import { supabase } from '../../supabase/config.js';

(function() {
    'use strict';

    let sessionUser = null;
    let currentTeacherRecord = null;
    let assignedSchedules = [];
    let currentAdminDoc = null;
    let selectedDayFilter = 'all';

    // DOM Elements
    const alertContainer = document.getElementById('alertContainer');
    const teacherNameEl = document.getElementById('teacherName');
    const teacherInitialEl = document.getElementById('teacherInitial');
    const bannerTeacherName = document.getElementById('bannerTeacherName');
    const bannerAvatarInitial = document.getElementById('bannerAvatarInitial');
    const bannerEmployeeId = document.getElementById('bannerEmployeeId');
    const bannerSpecialization = document.getElementById('bannerSpecialization');

    const printFacultyName = document.getElementById('printFacultyName');
    const printEmployeeId = document.getElementById('printEmployeeId');
    const printSpecialization = document.getElementById('printSpecialization');
    const sigTeacherName = document.getElementById('sigTeacherName');

    const statTeachingHours = document.getElementById('statTeachingHours');
    const statTeachingMinutes = document.getElementById('statTeachingMinutes');
    const statTotalClasses = document.getElementById('statTotalClasses');
    const statTotalSections = document.getElementById('statTotalSections');
    const statTotalSubjects = document.getElementById('statTotalSubjects');
    const scheduleCountBadge = document.getElementById('scheduleCountBadge');

    const teachingLoadTableBody = document.getElementById('teachingLoadTableBody');
    const visualTimetableContainer = document.getElementById('visualTimetableContainer');

    const adminDocCard = document.getElementById('adminDocCard');
    const adminDocIcon = document.getElementById('adminDocIcon');
    const adminDocTitle = document.getElementById('adminDocTitle');
    const adminDocMeta = document.getElementById('adminDocMeta');
    const btnAdminDocOpenGDocs = document.getElementById('btnAdminDocOpenGDocs');
    const btnAdminDocPreview = document.getElementById('btnAdminDocPreview');
    const btnAdminDocDownload = document.getElementById('btnAdminDocDownload');
    const btnAdminDocPrint = document.getElementById('btnAdminDocPrint');

    const modalAdminDocViewer = document.getElementById('modalAdminDocViewer');
    const btnCloseAdminDocViewer = document.getElementById('btnCloseAdminDocViewer');
    const btnAdminDocViewerExternal = document.getElementById('btnAdminDocViewerExternal');
    const adminDocViewerContent = document.getElementById('adminDocViewerContent');
    const adminDocViewerTitle = document.getElementById('adminDocViewerTitle');

    const btnPrintTeacherLoad = document.getElementById('btnPrintTeacherLoad');
    const btnRefreshLoad = document.getElementById('btnRefreshLoad');
    const dateBadge = document.getElementById('dateBadge');
    const logoutBtn = document.getElementById('logoutBtn');

    // ===== INITIALIZATION =====
    document.addEventListener('DOMContentLoaded', async () => {
        initDateBadge();
        initAuth();
        setupDayFilterChips();
        setupActionButtons();
        await loadTeacherLoadData();
    });

    function initDateBadge() {
        if (!dateBadge) return;
        const now = new Date();
        const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
        dateBadge.innerHTML = `<i class="fas fa-calendar-alt"></i> ${now.toLocaleDateString('en-US', options)}`;
    }

    function initAuth() {
        try {
            const raw = localStorage.getItem('currentUser');
            if (raw) sessionUser = JSON.parse(raw);
        } catch (e) {
            console.error('Session user parse error:', e);
        }

        if (!sessionUser) {
            window.location.replace('../auth/login.html');
            return;
        }

        const role = (sessionUser.role || '').toLowerCase();
        if (role !== 'teacher' && role !== 'admin') {
            window.location.replace('../auth/login.html');
            return;
        }

        const fullName = sessionUser.name || sessionUser.displayName || 
            `${sessionUser.firstName || sessionUser.first_name || ''} ${sessionUser.lastName || sessionUser.last_name || ''}`.trim() || 
            'Teacher';
        const initial = fullName.charAt(0).toUpperCase() || 'T';

        if (teacherNameEl) teacherNameEl.textContent = fullName;
        if (teacherInitialEl) teacherInitialEl.textContent = initial;
        if (bannerTeacherName) bannerTeacherName.textContent = fullName;
        if (bannerAvatarInitial) bannerAvatarInitial.textContent = initial;
        if (printFacultyName) printFacultyName.textContent = fullName;
        if (sigTeacherName) sigTeacherName.textContent = fullName.toUpperCase();

        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.removeItem('currentUser');
                window.location.replace('../auth/login.html');
            });
        }
    }

    function showAlert(type, message) {
        if (!alertContainer) return;
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.style.cssText = 'padding: 12px 18px; border-radius: 8px; margin-bottom: 16px; display: flex; align-items: center; gap: 10px; font-size: 0.9rem; animation: slideDown 0.3s ease;';
        
        if (type === 'success') {
            alert.style.background = '#ecfdf5';
            alert.style.color = '#065f46';
            alert.style.border = '1px solid #a7f3d0';
            alert.innerHTML = `<i class="fas fa-check-circle" style="color: #10b981;"></i> <span>${message}</span>`;
        } else {
            alert.style.background = '#fef2f2';
            alert.style.color = '#991b1b';
            alert.style.border = '1px solid #fecaca';
            alert.innerHTML = `<i class="fas fa-exclamation-circle" style="color: #ef4444;"></i> <span>${message}</span>`;
        }

        alertContainer.appendChild(alert);
        setTimeout(() => {
            alert.style.opacity = '0';
            alert.style.transition = 'opacity 0.4s ease';
            setTimeout(() => alert.remove(), 400);
        }, 5000);
    }

    // ===== LOAD TEACHER RECORD & ADMIN SCHEDULES =====
    async function loadTeacherLoadData() {
        try {
            // 1. Fetch teacher record
            let teacherRecord = null;
            if (sessionUser?.id) {
                const { data: tData } = await supabase
                    .from('teachers')
                    .select('*')
                    .eq('user_id', sessionUser.id)
                    .maybeSingle();

                if (tData) {
                    teacherRecord = tData;
                } else {
                    const { data: tById } = await supabase
                        .from('teachers')
                        .select('*')
                        .eq('id', sessionUser.id)
                        .maybeSingle();
                    if (tById) teacherRecord = tById;
                }
            }

            currentTeacherRecord = teacherRecord;

            // Update profile metadata
            const empId = teacherRecord?.employee_id || sessionUser?.employee_id || 'TCH-2026-001';
            const spec = teacherRecord?.specialization || teacherRecord?.subject || 'Secondary Education';
            
            if (bannerEmployeeId) bannerEmployeeId.textContent = empId;
            if (bannerSpecialization) bannerSpecialization.textContent = spec;
            if (printEmployeeId) printEmployeeId.textContent = empId;
            if (printSpecialization) printSpecialization.textContent = spec;

            // 2. Fetch admin-assigned schedules for this teacher
            let schedulesData = [];
            const teacherId = teacherRecord?.id || sessionUser?.id;

            if (teacherId) {
                const { data: sRows, error: sErr } = await supabase
                    .from('schedules')
                    .select('*')
                    .eq('teacher_id', teacherId);

                if (!sErr && sRows && sRows.length > 0) {
                    schedulesData = sRows;
                } else if (teacherRecord?.user_id && teacherRecord.user_id !== teacherId) {
                    // Try by user_id
                    const { data: sByUser } = await supabase
                        .from('schedules')
                        .select('*')
                        .eq('teacher_id', teacherRecord.user_id);
                    if (sByUser) schedulesData = sByUser;
                }
            }

            // 3. Fetch subjects and sections metadata
            const subjectIds = [...new Set(schedulesData.map(s => s.subject_id).filter(Boolean))];
            const sectionIds = [...new Set(schedulesData.map(s => s.section_id).filter(Boolean))];

            const subjectMap = {};
            const sectionMap = {};

            const promises = [];
            if (subjectIds.length > 0) {
                promises.push(
                    supabase.from('subjects').select('id, name, code, grade_level').in('id', subjectIds)
                        .then(({ data }) => {
                            (data || []).forEach(sub => { subjectMap[sub.id] = sub; });
                        })
                );
            }
            if (sectionIds.length > 0) {
                promises.push(
                    supabase.from('sections').select('id, name, grade_level, strand, room').in('id', sectionIds)
                        .then(({ data }) => {
                            (data || []).forEach(sec => { sectionMap[sec.id] = sec; });
                        })
                );
            }

            await Promise.all(promises);

            // 4. Map & enrich schedules
            assignedSchedules = schedulesData.map((s, idx) => {
                const sub = subjectMap[s.subject_id] || {};
                const sec = sectionMap[s.section_id] || {};

                const startStr = s.start_time || '07:30:00';
                const endStr = s.end_time || '08:30:00';
                const mins = calculateDurationMinutes(startStr, endStr);

                return {
                    id: s.id || `sch-${idx}`,
                    index: idx + 1,
                    subject_name: s.subject || sub.name || 'Subject',
                    subject_code: sub.code || '',
                    section_name: sec.name || 'Assigned Section',
                    grade_level: sec.grade_level || sub.grade_level || '',
                    day: s.day || 'Monday',
                    start_time: startStr,
                    end_time: endStr,
                    time_formatted: `${formatTime(startStr)} - ${formatTime(endStr)}`,
                    room: s.room || sec.room || 'Room 101',
                    duration_minutes: mins,
                    is_admin_assigned: true
                };
            });

            // 5. Update Statistics
            updateLoadStatistics(assignedSchedules);

            // 6. Check Admin-issued schedule document
            checkAdminLoadDocument(teacherRecord, sessionUser);

            // 7. Render Table & Visual Grid
            renderTeachingLoadTable();
            renderVisualTimetableGrid();

        } catch (err) {
            console.error('Error loading teacher load:', err);
            showAlert('error', 'Failed to load teacher load: ' + err.message);
            if (teachingLoadTableBody) {
                teachingLoadTableBody.innerHTML = `
                    <tr>
                        <td colspan="8" style="text-align: center; padding: 32px; color: #ef4444;">
                            <i class="fas fa-exclamation-triangle"></i> Error loading official teacher load.
                        </td>
                    </tr>
                `;
            }
        }
    }

    // ===== DURATION & TIME UTILS =====
    function calculateDurationMinutes(startTime, endTime) {
        try {
            const [sh, sm] = String(startTime).split(':').map(Number);
            const [eh, em] = String(endTime).split(':').map(Number);
            const sTotal = (sh * 60) + (sm || 0);
            const eTotal = (eh * 60) + (em || 0);
            const diff = eTotal - sTotal;
            return diff > 0 ? diff : 60;
        } catch (e) {
            return 60;
        }
    }

    function formatTime(timeStr) {
        if (!timeStr) return '';
        const parts = String(timeStr).split(':');
        let hours = parseInt(parts[0], 10);
        const minutes = parts[1] || '00';
        if (isNaN(hours)) return timeStr;
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
    }

    // ===== UPDATE STATISTICS =====
    function updateLoadStatistics(schedules) {
        const totalClasses = schedules.length;
        const totalMinutes = schedules.reduce((sum, s) => sum + s.duration_minutes, 0);
        const totalHours = (totalMinutes / 60).toFixed(1);

        const uniqueSections = new Set(schedules.map(s => s.section_name)).size;
        const uniqueSubjects = new Set(schedules.map(s => s.subject_name)).size;

        if (statTeachingHours) statTeachingHours.textContent = `${totalHours} hrs`;
        if (statTeachingMinutes) statTeachingMinutes.textContent = `${totalMinutes.toLocaleString()} minutes / week`;
        if (statTotalClasses) statTotalClasses.textContent = totalClasses;
        if (statTotalSections) statTotalSections.textContent = uniqueSections;
        if (statTotalSubjects) statTotalSubjects.textContent = uniqueSubjects;
        if (scheduleCountBadge) scheduleCountBadge.textContent = `${totalClasses} classes assigned`;
    }

    // ===== CHECK ADMIN LOAD DOCUMENT (STRICT PRIVACY: ONLY THIS TEACHER) =====
    function checkAdminLoadDocument(teacherRecord, sessionUser) {
        let docData = null;
        const teacherId = teacherRecord?.id;
        const userId = sessionUser?.id || teacherRecord?.user_id;
        const employeeId = teacherRecord?.employee_id;

        // Purge any old global key to prevent leakage across different teachers
        try { localStorage.removeItem('hes_teacher_load_admin_doc'); } catch(e) {}

        // Priority 1: Check database column teacher_load_url from Supabase for THIS specific teacher
        if (teacherRecord && teacherRecord.teacher_load_url) {
            const isGDoc = (teacherRecord.teacher_load_url || '').includes('docs.google.com');
            const isImg = /\.(png|jpe?g|webp|gif)$/i.test(teacherRecord.teacher_load_name || '') || (teacherRecord.teacher_load_url || '').startsWith('data:image/');
            docData = {
                teacherId: teacherId,
                userId: userId,
                fileName: teacherRecord.teacher_load_name || (isGDoc ? 'Official Teacher Load (Google Docs)' : isImg ? 'Official_Teacher_Load_Schedule.png' : 'Official_Teacher_Load.pdf'),
                url: teacherRecord.teacher_load_url,
                fileData: teacherRecord.teacher_load_url,
                fileType: teacherRecord.teacher_load_file_type || (isImg ? 'image/png' : 'application/pdf'),
                isGoogleDocs: isGDoc,
                isImage: isImg,
                uploadDate: teacherRecord.teacher_load_updated_at || new Date().toISOString()
            };
        }

        // Priority 2: Check strictly scoped local storage keys for THIS teacher
        if (!docData) {
            const keys = [
                teacherId ? `hes_teacher_load_doc_${teacherId}` : null,
                userId ? `hes_teacher_load_doc_${userId}` : null,
                employeeId ? `hes_teacher_load_doc_${employeeId}` : null
            ].filter(Boolean);

            for (const k of keys) {
                const raw = localStorage.getItem(k);
                if (raw) {
                    try {
                        const parsed = JSON.parse(raw);
                        // Strict validation: Must belong to this teacher!
                        if (parsed && (parsed.fileData || parsed.url)) {
                            const isMatch = (!parsed.teacherId || parsed.teacherId === teacherId) &&
                                            (!parsed.userId || parsed.userId === userId);
                            if (isMatch) {
                                docData = parsed;
                                break;
                            }
                        }
                    } catch(e) {}
                }
            }
        }

        const noDocNotice = document.getElementById('noAdminDocNotice');

        if (!docData) {
            if (adminDocCard) adminDocCard.style.display = 'none';
            if (noDocNotice) noDocNotice.style.display = 'flex';
            currentAdminDoc = null;
            return;
        }

        if (noDocNotice) noDocNotice.style.display = 'none';
        currentAdminDoc = docData;
        const isGDocs = docData.isGoogleDocs || (docData.url && docData.url.includes('docs.google.com'));
        const isPdf = (docData.fileType || '').includes('pdf') || (docData.fileName || '').toLowerCase().endsWith('.pdf');
        const isImg = docData.isImage || (docData.fileType || '').startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(docData.fileName || '') || (docData.fileData && docData.fileData.startsWith('data:image/'));

        if (adminDocCard) adminDocCard.style.display = 'flex';
        if (adminDocTitle) adminDocTitle.textContent = docData.fileName || 'Official Teacher Load Schedule';
        
        if (adminDocMeta) {
            const dateStr = docData.uploadDate ? new Date(docData.uploadDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently';
            adminDocMeta.textContent = `${isGDocs ? 'Google Docs Memo' : isImg ? 'Schedule Image' : 'PDF Document'} • Issued on ${dateStr} • Placido L. Señor NHS Administration`;
        }

        if (adminDocIcon) {
            if (isGDocs) {
                adminDocIcon.innerHTML = '<i class="fab fa-google-drive" style="color: #4285F4;"></i>';
                adminDocIcon.style.background = '#eff6ff';
            } else if (isImg) {
                adminDocIcon.innerHTML = '<i class="fas fa-file-image" style="color: #10b981;"></i>';
                adminDocIcon.style.background = '#ecfdf5';
            } else {
                adminDocIcon.innerHTML = '<i class="fas fa-file-pdf" style="color: #ef4444;"></i>';
                adminDocIcon.style.background = '#fef2f2';
            }
        }

        if (btnAdminDocOpenGDocs) {
            if (isGDocs) {
                btnAdminDocOpenGDocs.style.display = 'inline-flex';
                btnAdminDocOpenGDocs.href = docData.url || docData.fileData;
            } else {
                btnAdminDocOpenGDocs.style.display = 'none';
            }
        }

        if (btnAdminDocDownload) {
            btnAdminDocDownload.style.display = isGDocs ? 'none' : 'inline-flex';
        }
        if (btnAdminDocPrint) {
            btnAdminDocPrint.style.display = isGDocs ? 'none' : 'inline-flex';
        }
    }

    // ===== RENDER TEACHING LOAD TABLE =====
    function renderTeachingLoadTable() {
        if (!teachingLoadTableBody) return;

        let filtered = assignedSchedules;
        if (selectedDayFilter !== 'all') {
            filtered = assignedSchedules.filter(s => (s.day || '').toLowerCase() === selectedDayFilter.toLowerCase());
        }

        if (filtered.length === 0) {
            teachingLoadTableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 40px 20px; color: var(--gray-500);">
                        <div style="font-size: 2.2rem; color: var(--gray-300); margin-bottom: 8px;">
                            <i class="fas fa-calendar-times"></i>
                        </div>
                        <h4 style="color: var(--primary); font-size: 1.05rem; margin-bottom: 4px;">No Teaching Load Found</h4>
                        <p style="font-size: 0.85rem; max-width: 440px; margin: 0 auto; line-height: 1.5;">
                            ${selectedDayFilter !== 'all' ? `No classes assigned on ${selectedDayFilter}.` : 'The school administration has not configured your teaching schedule yet. Please check back later or consult your department head.'}
                        </p>
                    </td>
                </tr>
            `;
            return;
        }

        // Sort by Day then Start Time
        const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        filtered.sort((a, b) => {
            const dA = dayOrder.indexOf(a.day);
            const dB = dayOrder.indexOf(b.day);
            if (dA !== dB) return dA - dB;
            return a.start_time.localeCompare(b.start_time);
        });

        teachingLoadTableBody.innerHTML = filtered.map((item, idx) => `
            <tr>
                <td style="font-weight: 700; color: var(--gray-400);">${idx + 1}</td>
                <td>
                    <div style="font-weight: 700; color: var(--primary); font-size: 0.94rem;">${item.subject_name}</div>
                    ${item.subject_code ? `<span class="badge" style="background: rgba(11,43,74,0.08); color: var(--primary); font-size: 0.72rem; padding: 2px 6px; border-radius: 4px;">${item.subject_code}</span>` : ''}
                </td>
                <td>
                    <div style="font-weight: 600; color: var(--gray-800);">${item.section_name}</div>
                    ${item.grade_level ? `<div style="font-size: 0.78rem; color: var(--gray-500);">Grade ${item.grade_level}</div>` : ''}
                </td>
                <td>
                    <span class="badge" style="background: var(--gray-100); color: var(--primary); font-weight: 600; padding: 4px 10px; border-radius: 6px;">
                        ${item.day}
                    </span>
                </td>
                <td>
                    <div style="font-weight: 600; color: var(--primary);"><i class="far fa-clock text-primary"></i> ${item.time_formatted}</div>
                </td>
                <td>
                    <span><i class="fas fa-door-open text-primary"></i> ${item.room}</span>
                </td>
                <td>
                    <span style="font-weight: 700; color: var(--gray-700);">${item.duration_minutes} mins</span>
                </td>
                <td>
                    <span class="admin-verified-badge"><i class="fas fa-check-circle"></i> Assigned</span>
                </td>
            </tr>
        `).join('');
    }

    // ===== RENDER VISUAL TIMETABLE GRID =====
    function renderVisualTimetableGrid() {
        if (!visualTimetableContainer) return;

        const days = selectedDayFilter === 'all' 
            ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] 
            : [selectedDayFilter];

        const timeSlots = [
            { start: '07:30', end: '08:30', label: '07:30 - 08:30 AM' },
            { start: '08:30', end: '09:30', label: '08:30 - 09:30 AM' },
            { start: '09:30', end: '10:00', label: '09:30 - 10:00 AM', isRecess: true, title: 'RECESS / BREAK' },
            { start: '10:00', end: '11:00', label: '10:00 - 11:00 AM' },
            { start: '11:00', end: '12:00', label: '11:00 - 12:00 PM' },
            { start: '12:00', end: '13:00', label: '12:00 - 01:00 PM', isRecess: true, title: 'NOON BREAK' },
            { start: '13:00', end: '14:00', label: '01:00 - 02:00 PM' },
            { start: '14:00', end: '15:00', label: '02:00 - 03:00 PM' },
            { start: '15:00', end: '16:00', label: '03:00 - 04:00 PM' },
            { start: '16:00', end: '17:00', label: '04:00 - 05:00 PM' }
        ];

        let html = `
            <div style="overflow-x: auto;">
                <table class="timetable-table" style="width: 100%; border-collapse: collapse; min-width: 650px;">
                    <thead>
                        <tr>
                            <th style="width: 130px; background: var(--primary); color: #fff; padding: 10px; text-align: center; font-size: 0.82rem;">Time Slot</th>
                            ${days.map(d => `<th style="background: var(--primary); color: #fff; padding: 10px; text-align: center; font-size: 0.84rem;">${d}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
        `;

        timeSlots.forEach(slot => {
            if (slot.isRecess) {
                html += `
                    <tr>
                        <td style="padding: 6px; text-align: center; font-weight: 700; font-size: 0.78rem; background: #fef3c7; color: #92400e; border: 1px solid #fde68a;">
                            ${slot.label}
                        </td>
                        <td colspan="${days.length}" style="text-align: center; font-weight: 700; font-size: 0.8rem; background: #fffbeb; color: #b45309; border: 1px solid #fde68a;">
                            <i class="fas fa-coffee"></i> ${slot.title}
                        </td>
                    </tr>
                `;
                return;
            }

            const slotHour = parseInt(slot.start.split(':')[0], 10);

            html += `<tr>`;
            html += `<td style="padding: 10px; font-weight: 600; font-size: 0.8rem; text-align: center; background: #f8fafc; border: 1px solid var(--gray-200); color: var(--primary);">${slot.label}</td>`;

            days.forEach(day => {
                const match = assignedSchedules.find(s => {
                    if ((s.day || '').toLowerCase() !== day.toLowerCase()) return false;
                    const h = parseInt(String(s.start_time).split(':')[0], 10);
                    return h === slotHour;
                });

                if (match) {
                    html += `
                        <td style="padding: 8px; border: 1px solid var(--gray-200); background: #eff6ff; vertical-align: top;">
                            <div style="background: #fff; border-left: 3.5px solid #2563eb; border-radius: 6px; padding: 8px 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                                <div style="font-weight: 700; color: #1e3a8a; font-size: 0.88rem;">${match.subject_name}</div>
                                <div style="font-size: 0.78rem; color: #475569; margin-top: 2px;">
                                    <i class="fas fa-users" style="color: #2563eb;"></i> ${match.section_name}
                                </div>
                                <div style="font-size: 0.75rem; color: #64748b; margin-top: 2px;">
                                    <i class="fas fa-door-open"></i> ${match.room}
                                </div>
                            </div>
                        </td>
                    `;
                } else {
                    html += `<td style="padding: 8px; border: 1px solid var(--gray-200); text-align: center; color: var(--gray-300); font-size: 0.75rem;">—</td>`;
                }
            });

            html += `</tr>`;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        visualTimetableContainer.innerHTML = html;
    }

    // ===== DAY FILTER CHIPS =====
    function setupDayFilterChips() {
        const chips = document.querySelectorAll('.day-chip');
        chips.forEach(chip => {
            chip.addEventListener('click', () => {
                chips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                selectedDayFilter = chip.getAttribute('data-day') || 'all';
                renderTeachingLoadTable();
                renderVisualTimetableGrid();
            });
        });
    }

    // ===== ACTION BUTTONS & MODALS =====
    function setupActionButtons() {
        if (btnPrintTeacherLoad) {
            btnPrintTeacherLoad.addEventListener('click', () => {
                window.print();
            });
        }

        if (btnRefreshLoad) {
            btnRefreshLoad.addEventListener('click', async () => {
                btnRefreshLoad.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
                await loadTeacherLoadData();
                btnRefreshLoad.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
                showAlert('success', 'Teacher load refreshed successfully!');
            });
        }

        if (btnAdminDocPreview) {
            btnAdminDocPreview.addEventListener('click', () => {
                openAdminDocViewer(currentAdminDoc);
            });
        }

        if (btnAdminDocDownload) {
            btnAdminDocDownload.addEventListener('click', () => {
                downloadAdminDoc(currentAdminDoc);
            });
        }

        if (btnAdminDocPrint) {
            btnAdminDocPrint.addEventListener('click', () => {
                printAdminDoc(currentAdminDoc);
            });
        }

        if (btnCloseAdminDocViewer && modalAdminDocViewer) {
            btnCloseAdminDocViewer.addEventListener('click', () => {
                modalAdminDocViewer.style.display = 'none';
            });
        }
    }

    // ===== DOCUMENT VIEWER & ACTIONS =====
    function openAdminDocViewer(doc) {
        if (!doc || (!doc.fileData && !doc.url)) return;
        if (!modalAdminDocViewer || !adminDocViewerContent) return;

        const isGDocs = doc.isGoogleDocs || (doc.url && doc.url.includes('docs.google.com'));
        const isPdf = (doc.fileType || '').includes('pdf') || (doc.fileName || '').toLowerCase().endsWith('.pdf');
        const fileUrl = doc.url || doc.fileData;

        if (adminDocViewerTitle) {
            adminDocViewerTitle.innerHTML = isGDocs 
                ? `<i class="fab fa-google-drive" style="color: #4285F4;"></i> ${doc.fileName || 'Google Docs Teacher Load'}`
                : isPdf 
                    ? `<i class="fas fa-file-pdf" style="color: #ef4444;"></i> ${doc.fileName || 'PDF Teacher Load'}`
                    : `<i class="fas fa-file-image" style="color: #10b981;"></i> ${doc.fileName || 'Schedule Image'}`;
        }

        if (btnAdminDocViewerExternal) {
            btnAdminDocViewerExternal.href = fileUrl;
        }

        if (isGDocs) {
            let embedUrl = fileUrl;
            if (embedUrl.includes('/edit')) embedUrl = embedUrl.replace('/edit', '/preview');
            adminDocViewerContent.innerHTML = `<iframe src="${embedUrl}" style="width: 100%; height: 100%; border: none; border-radius: 8px;"></iframe>`;
        } else if (isPdf) {
            adminDocViewerContent.innerHTML = `<iframe src="${fileUrl}" style="width: 100%; height: 100%; border: none; border-radius: 8px;"></iframe>`;
        } else {
            adminDocViewerContent.innerHTML = `<img src="${fileUrl}" alt="Teacher Load Schedule" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">`;
        }

        modalAdminDocViewer.style.display = 'flex';
    }

    function downloadAdminDoc(doc) {
        if (!doc || (!doc.fileData && !doc.url)) return;
        const a = document.createElement('a');
        a.href = doc.fileData || doc.url;
        a.download = doc.fileName || 'Official_Teacher_Load_Schedule';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function printAdminDoc(doc) {
        if (!doc || (!doc.fileData && !doc.url)) return;
        const printWin = window.open('', '_blank');
        const isPdf = (doc.fileType || '').includes('pdf') || (doc.fileName || '').toLowerCase().endsWith('.pdf');
        const fileSrc = doc.fileData || doc.url;

        if (isPdf) {
            printWin.document.write(`
                <html><head><title>Print Teacher Load - ${doc.fileName || 'Schedule'}</title></head>
                <body style="margin:0;padding:0;">
                    <iframe src="${fileSrc}" style="width:100vw;height:100vh;border:none;"></iframe>
                </body></html>
            `);
        } else {
            printWin.document.write(`
                <html><head><title>Print Teacher Load - ${doc.fileName || 'Schedule Image'}</title>
                <style>
                    @page { size: letter portrait; margin: 6mm 8mm; }
                    html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; display: flex; align-items: center; justify-content: center; }
                    img { max-width: 100%; max-height: 100%; object-fit: contain; }
                </style>
                </head>
                <body onload="window.print();">
                    <img src="${fileSrc}" alt="Teacher Load Schedule">
                </body></html>
            `);
        }
        printWin.document.close();
    }

    // Auto-update if storage updates
    window.addEventListener('storage', (e) => {
        if (e.key && e.key.includes('teacher_load')) {
            loadTeacherLoadData();
        }
    });

})();
