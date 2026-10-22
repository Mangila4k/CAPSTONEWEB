// ===== TEACHER LOAD (ASSIGNED BY ADMIN) JAVASCRIPT =====
import { supabase } from '../../supabase/config.js';

(function() {
    'use strict';

    let sessionUser = null;
    let currentTeacherRecord = null;
    let assignedSchedules = [];
    let myIndividualWorkloads = []; 
    let scannedSchedules = []; // Holds the auto-generated schedule from OCR
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
        } else if (type === 'info') {
            alert.style.background = '#eff6ff';
            alert.style.color = '#1e40af';
            alert.style.border = '1px solid #bfdbfe';
            alert.innerHTML = `<i class="fas fa-info-circle" style="color: #3b82f6;"></i> <span>${message}</span>`;
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

    // ===== LOAD TEACHER RECORD, SCHEDULES, & TEACHER WORKLOADS =====
    async function loadTeacherLoadData() {
        try {
            let teacherRecord = null;
            if (sessionUser?.id) {
                const { data: tData } = await supabase.from('teachers').select('*').eq('user_id', sessionUser.id).maybeSingle();
                if (tData) {
                    teacherRecord = tData;
                } else {
                    const { data: tById } = await supabase.from('teachers').select('*').eq('id', sessionUser.id).maybeSingle();
                    if (tById) teacherRecord = tById;
                }
            }

            currentTeacherRecord = teacherRecord;
            const empId = teacherRecord?.employee_id || sessionUser?.employee_id || 'TCH-2026-001';
            const spec = teacherRecord?.specialization || teacherRecord?.subject || 'Secondary Education';
            
            if (bannerEmployeeId) bannerEmployeeId.textContent = empId;
            if (bannerSpecialization) bannerSpecialization.textContent = spec;
            if (printEmployeeId) printEmployeeId.textContent = empId;
            if (printSpecialization) printSpecialization.textContent = spec;

            const teacherId = teacherRecord?.id || sessionUser?.id;
            
            // 1. Fetch Manual Schedules (from DB)
            let schedulesData = [];
            if (teacherId) {
                const { data: sRows } = await supabase.from('schedules').select('*').eq('teacher_id', teacherId);
                if (sRows) schedulesData = sRows;
            }

            const subjectIds = [...new Set(schedulesData.map(s => s.subject_id).filter(Boolean))];
            const sectionIds = [...new Set(schedulesData.map(s => s.section_id).filter(Boolean))];
            const subjectMap = {};
            const sectionMap = {};

            if (subjectIds.length > 0) {
                const { data: subs } = await supabase.from('subjects').select('id, name, code, grade_level').in('id', subjectIds);
                (subs || []).forEach(sub => { subjectMap[sub.id] = sub; });
            }
            if (sectionIds.length > 0) {
                const { data: secs } = await supabase.from('sections').select('*').in('id', sectionIds);
                (secs || []).forEach(sec => { sectionMap[sec.id] = sec; });
            }

            assignedSchedules = schedulesData.map((s, idx) => {
                const sub = subjectMap[s.subject_id] || {};
                const sec = sectionMap[s.section_id] || {};
                const startStr = s.start_time || '07:30:00';
                const endStr = s.end_time || '08:30:00';
                const mins = calculateDurationMinutes(startStr, endStr);

                return {
                    id: s.id || `sch-${idx}`,
                    subject_name: s.subject || sub.name || 'Subject',
                    subject_code: sub.code || '',
                    section_name: sec.name || 'Assigned Section',
                    grade_level: sec.grade_level || sub.grade_level || '',
                    day: s.day || 'Monday',
                    start_time: startStr,
                    end_time: endStr,
                    time_formatted: `${formatTime(startStr)} - ${formatTime(endStr)}`,
                    room: s.room || sec.room || 'Room 101',
                    duration_minutes: mins
                };
            });

            // 2. Fetch Teacher Workloads (Documents)
            if (teacherId) {
                const { data: twData } = await supabase.from('teacher_workloads').select('*').eq('teacher_id', teacherId).order('created_at', { ascending: false });
                if (twData) myIndividualWorkloads = twData;
            }

            renderAdminWorkloads();

            // 3. IF there are no manual schedules, but there is a workload image, SCAN IT!
            if (assignedSchedules.length === 0 && myIndividualWorkloads.length > 0) {
                const latestWorkload = myIndividualWorkloads[0];
                const isImage = (latestWorkload.file_type || '').startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(latestWorkload.file_name || '');
                
                if (isImage && typeof Tesseract !== 'undefined') {
                    showAlert('info', 'Scanning your uploaded workload to automatically build your timetable...');
                    await scanWorkloadImage(latestWorkload.file_url);
                } else {
                    showAlert('error', 'Please upload a clear Image (JPG/PNG) of your workload to auto-generate the timetable. PDFs cannot be scanned automatically.');
                }
            } else {
                updateLoadStatistics(assignedSchedules);
                renderTeachingLoadTable();
                renderVisualTimetableGrid();
            }

        } catch (err) {
            console.error('Error loading teacher load:', err);
            showAlert('error', 'Failed to load teacher load: ' + err.message);
        }
    }

    // ===== OCR SCANNER ENGINE =====
    async function scanWorkloadImage(imageUrl) {
        try {
            const worker = await Tesseract.createWorker('eng');
            
            // Define expected subjects/rooms to help the parser
            const knownSections = ['STEM', 'ABM', 'HUMSS', 'GAS', 'TVL', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];
            const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

            const { data: { text } } = await worker.recognize(imageUrl);
            await worker.terminate();

            console.log("📄 OCR Text:", text);

            // Parse the text
            const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            
            let parsedSchedules = [];
            let currentDay = 'Monday';
            
            // Very basic heuristic parser
            lines.forEach(line => {
                // Check if line is a day header
                const foundDay = days.find(d => line.toUpperCase().includes(d.toUpperCase()));
                if (foundDay) {
                    currentDay = foundDay;
                    return;
                }

                // Look for time patterns like "7:30 - 8:30" or "07:30-08:30"
                const timeMatch = line.match(/(\d{1,2}:\d{2})\s*[-to]+\s*(\d{1,2}:\d{2})/i);
                
                // Look for a subject/section
                const foundSubject = knownSections.find(s => line.toUpperCase().includes(s.toUpperCase())) || 'Class';

                if (timeMatch) {
                    let startStr = timeMatch[1];
                    let endStr = timeMatch[2];
                    
                    // Convert to 24h for consistency if needed (basic check)
                    if (!startStr.includes(':00')) startStr += ':00';
                    if (!endStr.includes(':00')) endStr += ':00';

                    // Clean up the text to find a potential subject name (remove time, day, room)
                    let subjectName = line.replace(timeMatch[0], '').replace(/Room\s*\d+/i, '').replace(/\s+/g, ' ').trim();
                    if (subjectName.length < 3) subjectName = foundSubject;

                    parsedSchedules.push({
                        id: `ocr-${Date.now()}-${Math.random()}`,
                        subject_name: subjectName,
                        section_name: 'Assigned Section', // OCR might not reliably grab this
                        day: currentDay,
                        start_time: startStr,
                        end_time: endStr,
                        time_formatted: `${formatTime(startStr)} - ${formatTime(endStr)}`,
                        room: 'TBA',
                        duration_minutes: calculateDurationMinutes(startStr, endStr),
                        is_ocr_scanned: true
                    });
                }
            });

            if (parsedSchedules.length > 0) {
                scannedSchedules = parsedSchedules;
                // Merge with manually assigned (or use scanned if manual is empty)
                assignedSchedules = parsedSchedules; 
                showAlert('success', `Successfully scanned and extracted ${parsedSchedules.length} classes from your workload!`);
            } else {
                showAlert('error', 'Could not read the timetable from the image. Please ensure the image is clear and has a standard format (Time - Subject).');
            }

            updateLoadStatistics(assignedSchedules);
            renderTeachingLoadTable();
            renderVisualTimetableGrid();

        } catch (err) {
            console.error('OCR Scan Error:', err);
            showAlert('error', 'Failed to scan workload image: ' + err.message);
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

    // ===== RENDER ADMIN WORKLOADS =====
    function renderAdminWorkloads() {
        const noDocNotice = document.getElementById('noAdminDocNotice');
        const container = adminDocCard?.parentElement;
        document.querySelectorAll('.dynamic-workload-card').forEach(el => el.remove());

        if (myIndividualWorkloads.length === 0) {
            if (adminDocCard) adminDocCard.style.display = 'none';
            if (noDocNotice) noDocNotice.style.display = 'flex';
            return;
        }

        if (noDocNotice) noDocNotice.style.display = 'none';
        if (adminDocCard) adminDocCard.style.display = 'none';

        let gridContainer = document.getElementById('adminWorkloadsGrid');
        if (!gridContainer) {
            gridContainer = document.createElement('div');
            gridContainer.id = 'adminWorkloadsGrid';
            gridContainer.className = 'dynamic-workload-card';
            gridContainer.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; margin-bottom: 24px;';
            
            const loadTable = document.querySelector('.load-table-card');
            if (loadTable && loadTable.parentNode) {
                loadTable.parentNode.insertBefore(gridContainer, loadTable);
            }
        }

        gridContainer.innerHTML = '';

        myIndividualWorkloads.forEach(workload => {
            const url = workload.file_url;
            const isGDocs = (url || '').includes('docs.google.com');
            const isImg = (workload.file_type || '').startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(workload.file_name || '') || (url || '').startsWith('data:image/');
            const fileName = workload.file_name || 'Official Teacher Workload';
            const dateStr = workload.created_at ? new Date(workload.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently';

            let iconHtml = '<i class="fas fa-file-pdf" style="color: #ef4444;"></i>';
            if (isGDocs) iconHtml = '<i class="fab fa-google-drive" style="color: #4285F4;"></i>';
            else if (isImg) iconHtml = '<i class="fas fa-file-image" style="color: #10b981;"></i>';

            const card = document.createElement('div');
            card.className = 'admin-doc-card';
            card.style.display = 'flex';
            card.innerHTML = `
                <div class="admin-doc-left">
                    <div class="admin-doc-icon" style="background: ${isGDocs ? '#eff6ff' : isImg ? '#ecfdf5' : '#fef2f2'}; color: inherit;">
                        ${iconHtml}
                    </div>
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <strong style="color: var(--primary); font-size: 1rem;">My Official Workload</strong>
                            <span class="admin-verified-badge" style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-size: 0.7rem;"><i class="fas fa-check-circle"></i> Admin Uploaded</span>
                        </div>
                        <p style="color: var(--gray-500); font-size: 0.8rem; margin: 4px 0 0 0;">
                            ${fileName} • Uploaded ${dateStr}
                        </p>
                    </div>
                </div>
                <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 12px;">
                    ${isGDocs ? `<a href="${url}" target="_blank" style="padding: 6px 10px; border-radius: 6px; font-weight: 600; background: #1a73e8; color: #fff; text-decoration: none; font-size: 0.78rem;"><i class="fab fa-google-drive"></i> Open Docs</a>` : ''}
                    <button type="button" class="btn-preview-sec-doc" data-url="${url}" data-name="${fileName}" style="padding: 6px 10px; border-radius: 6px; font-weight: 600; background: var(--primary); color: #fff; border: none; cursor: pointer; font-size: 0.78rem;">
                        <i class="fas fa-eye"></i> View
                    </button>
                </div>
            `;
            gridContainer.appendChild(card);
        });

        gridContainer.querySelectorAll('.btn-preview-sec-doc').forEach(btn => {
            btn.onclick = () => {
                openDocViewer(btn.dataset.url, btn.dataset.name);
            };
        });
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
                    <td colspan="7" style="text-align: center; padding: 40px 20px; color: var(--gray-500);">
                        <div style="font-size: 2.2rem; color: var(--gray-300); margin-bottom: 8px;">
                            <i class="fas fa-calendar-times"></i>
                        </div>
                        <h4 style="color: var(--primary); font-size: 1.05rem; margin-bottom: 4px;">No Teaching Load Found</h4>
                        <p style="font-size: 0.85rem; max-width: 440px; margin: 0 auto; line-height: 1.5;">
                            ${selectedDayFilter !== 'all' ? `No classes assigned on ${selectedDayFilter}.` : 'The school administration has not configured your teaching schedule yet.'}
                        </p>
                    </td>
                </tr>
            `;
            return;
        }

        const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        filtered.sort((a, b) => {
            const dA = dayOrder.indexOf(a.day);
            const dB = dayOrder.indexOf(b.day);
            if (dA !== dB) return dA - dB;
            return a.start_time.localeCompare(b.start_time);
        });

        teachingLoadTableBody.innerHTML = filtered.map((item, idx) => {
            let gradeText = (item.grade_level || '').toString().trim();
            if (gradeText && !gradeText.toLowerCase().startsWith('grade')) {
                gradeText = `Grade ${gradeText}`;
            }

            return `
            <tr>
                <td style="font-weight: 700; color: var(--gray-400);">${idx + 1}</td>
                <td>
                    <div style="font-weight: 700; color: var(--primary); font-size: 0.94rem;">${item.subject_name}</div>
                    ${item.subject_code ? `<span class="badge" style="background: rgba(11,43,74,0.08); color: var(--primary); font-size: 0.72rem; padding: 2px 6px; border-radius: 4px;">${item.subject_code}</span>` : ''}
                </td>
                <td>
                    <div style="font-weight: 600; color: var(--gray-800);">${gradeText || '—'}</div>
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
                    <span style="font-weight: 600; color: var(--gray-800);"><i class="fas fa-users-rectangle text-primary"></i> ${item.section_name || '—'}</span>
                </td>
                <td>
                    <span class="admin-verified-badge"><i class="fas fa-check-circle"></i> Assigned</span>
                </td>
            </tr>
            `;
        }).join('');
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

        if (btnCloseAdminDocViewer && modalAdminDocViewer) {
            btnCloseAdminDocViewer.addEventListener('click', () => {
                modalAdminDocViewer.style.display = 'none';
            });
        }
    }

    // ===== DOCUMENT VIEWER =====
    function openDocViewer(url, name) {
        if (!url) return;
        if (!modalAdminDocViewer || !adminDocViewerContent) return;

        const isGDocs = url.includes('docs.google.com') || url.includes('drive.google.com');
        const isPdf = name.toLowerCase().endsWith('.pdf') || url.startsWith('data:application/pdf');
        
        if (adminDocViewerTitle) {
            adminDocViewerTitle.innerHTML = isGDocs 
                ? `<i class="fab fa-google-drive" style="color: #4285F4;"></i> ${name}`
                : isPdf 
                    ? `<i class="fas fa-file-pdf" style="color: #ef4444;"></i> ${name}`
                    : `<i class="fas fa-file-image" style="color: #10b981;"></i> ${name}`;
        }

        if (btnAdminDocViewerExternal) {
            btnAdminDocViewerExternal.href = url;
        }

        if (isGDocs) {
            let embedUrl = url;
            if (embedUrl.includes('/edit')) embedUrl = embedUrl.replace('/edit', '/preview');
            adminDocViewerContent.innerHTML = `<iframe src="${embedUrl}" style="width: 100%; height: 100%; border: none; border-radius: 8px;"></iframe>`;
        } else if (isPdf) {
            adminDocViewerContent.innerHTML = `<iframe src="${url}" style="width: 100%; height: 100%; border: none; border-radius: 8px;"></iframe>`;
        } else {
            adminDocViewerContent.innerHTML = `<img src="${url}" alt="Workload" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">`;
        }

        modalAdminDocViewer.style.display = 'flex';
    }

    // Auto-update if storage updates
    window.addEventListener('storage', (e) => {
        if (e.key && e.key.includes('teacher_load')) {
            loadTeacherLoadData();
        }
    });

})();