/**
 * Faculty QR Attendance System
 * Handles Teacher Personal QR Attendance with Dynamic Adjusted Schedules, Camera Scanner, and Activity Logging
 */

import { supabase } from '../../supabase/config.js';
import { formatTime, formatDate, getTodayDateString, getLocalTimeString, getTeacherProfileAndSchedule, evaluateAttendanceStatus, recordTeacherAttendance } from './schedule-helper.js';

(function() {
    'use strict';

    console.log('🌟 Faculty QR Attendance System ready with Dynamic Adjusted Schedules');

    // ============================================
    // DOM ELEMENTS - GENERAL & HEADER
    // ============================================
    const teacherName = document.getElementById('teacherName');
    const teacherInitial = document.getElementById('teacherInitial');
    const logoutBtn = document.getElementById('logoutBtn');
    const phTimeDisplay = document.getElementById('phTimeDisplay');
    const alertContainer = document.getElementById('alertContainer');
    const dateBadge = document.querySelector('.date-badge');

    // DOM Elements - Adjusted Schedule Banner
    const scheduleBannerCard = document.getElementById('scheduleBannerCard');
    const currentDayText = document.getElementById('currentDayText');
    const scheduleTitleText = document.getElementById('scheduleTitleText');
    const scheduleSummaryText = document.getElementById('scheduleSummaryText');
    const cutoffTimeDisplay = document.getElementById('cutoffTimeDisplay');
    const scheduleStatusPill = document.getElementById('scheduleStatusPill');
    const scheduleClassesChips = document.getElementById('scheduleClassesChips');
    const activityTimelineList = document.getElementById('activityTimelineList');

    // DOM Elements - Stats & Info
    const totalDays = document.getElementById('totalDays');
    const presentDays = document.getElementById('presentDays');
    const lateDays = document.getElementById('lateDays');
    const absentDays = document.getElementById('absentDays');
    const attendanceInfo = document.getElementById('attendanceInfo');
    const timeInDisplay = document.getElementById('timeInDisplay');
    const timeOutDisplay = document.getElementById('timeOutDisplay');
    const statusDisplay = document.getElementById('statusDisplay');
    const qrContainer = document.getElementById('qrContainer');
    const historyList = document.getElementById('historyList');

    // DOM Elements - Scanner
    const startCameraBtn = document.getElementById('startCameraBtn');
    const stopCameraBtn = document.getElementById('stopCameraBtn');
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const ctx = canvas ? canvas.getContext('2d') : null;
    const scanResult = document.getElementById('scanResult');

    // ============================================
    // STATE
    // ============================================
    let sessionUser = null;
    let teacherRecord = null;
    let todaySchedule = null;
    let teacherId = null;
    let displayName = 'Teacher';
    let facultyCurrentAttendance = null;
    let facultyAttendanceHistory = [];
    let cameraStream = null;
    let isScanning = false;
    let scanThrottle = false;

    // ============================================
    // SESSION & AUTH
    // ============================================
    try {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            sessionUser = JSON.parse(stored);
        }
    } catch(e) {
        console.error('Error reading currentUser:', e);
    }

    if (!sessionUser) {
        console.warn('⚠️ No active teacher session, redirecting...');
        window.location.replace('../auth/login.html');
        return;
    }

    if (sessionUser.role && sessionUser.role !== 'teacher' && sessionUser.role !== 'admin') {
        const routes = {
            'admin': '../admin/dashboard.html',
            'student': '../student/dashboard.html',
            'parent': '../parents/dashboard.html',
            'registrar': '../registrar/dashboard.html'
        };
        window.location.replace(routes[sessionUser.role] || '../auth/login.html');
        return;
    }

    teacherId = sessionUser.id || sessionUser.uid;
    displayName = sessionUser.firstName ? `${sessionUser.firstName} ${sessionUser.lastName || ''}`.trim() : (sessionUser.displayName || (sessionUser.email ? sessionUser.email.split('@')[0] : 'Teacher'));
    if (teacherName) teacherName.textContent = displayName;
    if (typeof window.syncTeacherAvatarAndName === 'function') {
        window.syncTeacherAvatarAndName();
    } else if (teacherInitial) {
        const words = displayName.split(/\s+/);
        const initials = words.length > 1 ? (words[0][0] + words[words.length - 1][0]).toUpperCase() : displayName.substring(0, 2).toUpperCase();
        teacherInitial.textContent = initials;
    }

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
                if (cameraStream) {
                    cameraStream.getTracks().forEach(track => track.stop());
                }
                await supabase.auth.signOut();
            } catch(err) {}
            window.location.replace('../auth/login.html');
        });
    }

    // ============================================
    // DATE & TIME HELPERS
    // ============================================
    function getLocalDateString() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function getLocalTimeString() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }

    function formatTime(timeStr) {
        if (!timeStr || timeStr === '—' || timeStr === '--:--') return '—';
        try {
            if (timeStr.includes('AM') || timeStr.includes('PM')) return timeStr;
            const parts = timeStr.split(':');
            const h = parseInt(parts[0], 10);
            const m = parts[1] || '00';
            const ampm = h >= 12 ? 'PM' : 'AM';
            const h12 = h % 12 || 12;
            return `${h12}:${m} ${ampm}`;
        } catch {
            return timeStr;
        }
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

    function isWeekendToday() {
        const day = new Date().getDay();
        return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
    }

    function showAlert(message, type = 'info') {
        if (!alertContainer) return;
        const alertId = 'alert_' + Date.now();
        const iconMap = {
            'success': 'check-circle',
            'error': 'exclamation-circle',
            'warning': 'exclamation-triangle',
            'info': 'info-circle'
        };
        const icon = iconMap[type] || 'info-circle';

        const alertEl = document.createElement('div');
        alertEl.className = `alert alert-${type}`;
        alertEl.id = alertId;
        alertEl.style.animation = 'slideDown 0.3s ease-out';
        alertEl.innerHTML = `
            <div style="display:flex; align-items:center; gap: 10px; width: 100%;">
                <i class="fas fa-${icon}"></i>
                <div style="flex:1;">${message}</div>
                <button type="button" style="background:none; border:none; color:inherit; cursor:pointer; font-size:1.1rem;" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        alertContainer.prepend(alertEl);
        setTimeout(() => {
            if (document.getElementById(alertId)) {
                alertEl.style.opacity = '0';
                setTimeout(() => alertEl.remove(), 300);
            }
        }, 5000);
    }

    function renderAdjustedScheduleUI() {
        if (!todaySchedule) return;
        if (currentDayText) currentDayText.textContent = todaySchedule.dayName;
        if (scheduleTitleText) {
            scheduleTitleText.innerHTML = `<i class="fas fa-calendar-check"></i> ${todaySchedule.scheduleType}`;
        }
        if (scheduleSummaryText) {
            scheduleSummaryText.innerHTML = `<strong>${todaySchedule.summary}</strong> • Official Adjusted Teaching Schedule`;
        }
        if (cutoffTimeDisplay) {
            cutoffTimeDisplay.textContent = 'Active Duty';
        }
        if (scheduleClassesChips) {
            if (todaySchedule.classes && todaySchedule.classes.length > 0) {
                scheduleClassesChips.style.display = 'flex';
                scheduleClassesChips.innerHTML = todaySchedule.classes.map(c => `
                    <div class="class-chip-item">
                        <i class="fas fa-book-open"></i>
                        <strong>${formatTime(c.start_time)} - ${formatTime(c.end_time)}</strong>
                        <span>${c.subjects?.name || 'Subject'} (${c.sections?.name || 'Section'})</span>
                        <span style="opacity:0.8;">• ${c.room || 'Room'}</span>
                    </div>
                `).join('');
            } else {
                scheduleClassesChips.style.display = 'flex';
                scheduleClassesChips.innerHTML = `
                    <div class="class-chip-item">
                        <i class="fas fa-briefcase"></i>
                        <strong>${todaySchedule.summary}</strong>
                        <span>Official Faculty Advisory / Department Planning Duty</span>
                    </div>
                `;
            }
        }
    }

    function updateLiveClock() {
        const now = new Date();
        const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        
        if (dateBadge) {
            dateBadge.innerHTML = `<i class="fas fa-calendar-alt"></i> ${now.toLocaleDateString('en-US', dateOptions)}`;
        }
        if (phTimeDisplay) {
            const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
            phTimeDisplay.textContent = now.toLocaleDateString('en-US', dateOptions) + ' • ' + now.toLocaleTimeString('en-US', timeOptions);
        }

        if (todaySchedule && scheduleStatusPill) {
            scheduleStatusPill.className = 'schedule-pill on-time';
            scheduleStatusPill.textContent = 'Active Window';
        }
    }

    updateLiveClock();
    setInterval(updateLiveClock, 1000);

    // ============================================
    // DATA SYNC & CACHE
    // ============================================
    function getLocalTeacherAttendanceCache() {
        try {
            const raw = localStorage.getItem('hes_teacher_attendance_' + teacherId);
            return raw ? JSON.parse(raw) : [];
        } catch(e) {
            return [];
        }
    }

    function saveLocalTeacherAttendanceCache(records) {
        try {
            localStorage.setItem('hes_teacher_attendance_' + teacherId, JSON.stringify(records));
        } catch(e) {}
    }

    function syncToAdminAttendance(record) {
        try {
            const stored = localStorage.getItem('hes_teacher_attendance');
            let records = stored ? JSON.parse(stored) : [];
            const today = getTodayDateString();
            const timeInFmt = (record.time_in || record.timeIn) ? formatTime(record.time_in || record.timeIn) : '—';
            const timeOutFmt = (record.time_out || record.timeOut) ? formatTime(record.time_out || record.timeOut) : '—';

            const existingIdx = records.findIndex(r => (r.name === displayName || r.teacher_id === teacherId) && r.date === today);
            if (existingIdx >= 0) {
                records[existingIdx].timeIn = timeInFmt;
                if (record.time_out || record.timeOut) records[existingIdx].timeOut = timeOutFmt;
                records[existingIdx].status = record.status || 'Present';
            } else {
                records.unshift({
                    id: Date.now(),
                    name: displayName,
                    teacher_id: teacherId,
                    id_number: sessionUser.employee_id || ('HES-TCH-' + (teacherId ? String(teacherId).substring(0, 6).toUpperCase() : '001')),
                    dept: sessionUser.department || sessionUser.specialization || 'Faculty',
                    date: today,
                    timeIn: timeInFmt,
                    timeOut: timeOutFmt,
                    status: record.status || 'Present',
                    remarks: record.status === 'Late' ? 'Late arrival' : 'On time'
                });
            }
            localStorage.setItem('hes_teacher_attendance', JSON.stringify(records));
        } catch(e) {}
    }

    async function loadFacultyAttendanceData() {
        const today = getTodayDateString();
        let loadedRecords = [];

        try {
            // 1. Resolve teacher record and today's adjusted schedule
            const profileAndSched = await getTeacherProfileAndSchedule(supabase, sessionUser);
            teacherRecord = profileAndSched.teacherRecord;
            todaySchedule = profileAndSched.todaySchedule;
            teacherId = teacherRecord.id;

            renderAdjustedScheduleUI();

            // 2. Fetch from both teacher_attendance and attendance tables
            const [
                { data: tAttData },
                { data: genAttData }
            ] = await Promise.all([
                supabase.from('teacher_attendance').select('*').eq('teacher_id', teacherId).order('date', { ascending: false }),
                supabase.from('attendance').select('*').eq('teacher_id', teacherId).order('date', { ascending: false })
            ]);

            const recordsMap = new Map();
            (tAttData || []).forEach(r => {
                recordsMap.set(r.date, {
                    id: r.id,
                    teacher_id: r.teacher_id,
                    date: r.date,
                    time_in: r.time_in ? new Date(r.time_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : null,
                    time_out: r.time_out ? new Date(r.time_out).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : null,
                    status: r.in_status || 'Present',
                    raw: r
                });
            });

            (genAttData || []).forEach(r => {
                if (!recordsMap.has(r.date)) {
                    recordsMap.set(r.date, {
                        id: r.id,
                        teacher_id: r.teacher_id,
                        date: r.date,
                        time_in: r.time_in,
                        time_out: r.time_out,
                        status: r.status || 'Present',
                        raw: r
                    });
                }
            });

            loadedRecords = Array.from(recordsMap.values()).sort((a, b) => new Date(b.date) - new Date(a.date));
            saveLocalTeacherAttendanceCache(loadedRecords);
        } catch(err) {
            console.warn('Error loading attendance from DB, reading cache:', err);
            loadedRecords = getLocalTeacherAttendanceCache();
        }

        facultyAttendanceHistory = loadedRecords;
        facultyCurrentAttendance = loadedRecords.find(r => r.date === today) || null;

        updateFacultyAttendanceUI();
        renderFacultyHistory();
        updateFacultyStats();
        await loadAttendanceActivities();
    }

    function updateFacultyAttendanceUI() {
        if (!qrContainer) return;

        if (!facultyCurrentAttendance || (!facultyCurrentAttendance.time_in && !facultyCurrentAttendance.timeIn)) {
            if (attendanceInfo) attendanceInfo.style.display = 'none';
            qrContainer.innerHTML = `
                <div class="qr-container">
                    <h3><i class="fas fa-qrcode"></i> Time In QR Code</h3>
                    <p>Generate a QR code or directly confirm your Time In</p>
                    <div class="qr-actions" style="text-align: center; padding: 25px 15px;">
                        <button onclick="window.generateQR('time_in')" class="btn-generate-timein">
                            <i class="fas fa-qrcode"></i> Generate Time In QR Code
                        </button>
                        <button onclick="window.recordAttendance('time_in')" class="btn-scanner" style="margin-top: 12px; background: #10b981; font-size: 0.95rem; padding: 10px 20px; display: inline-flex; align-items: center; gap: 8px;">
                            <i class="fas fa-check-circle"></i> Quick Record Time In Now
                        </button>
                        <p class="info-text" style="margin-top: 15px;">
                            <i class="fas fa-info-circle"></i> Evaluated against today's adjusted schedule: <strong>${todaySchedule?.summary || 'Standard Shift'}</strong>.
                            <br><span style="color: var(--primary);">Cutoff start: <strong>${formatTime(todaySchedule?.earliestStartTime || '08:00:00')}</strong> (+15m Grace)</span>
                        </p>
                    </div>
                </div>
            `;
            return;
        }

        const timeIn = facultyCurrentAttendance.time_in || facultyCurrentAttendance.timeIn;
        const timeOut = facultyCurrentAttendance.time_out || facultyCurrentAttendance.timeOut;
        const status = facultyCurrentAttendance.status || 'Present';

        if (attendanceInfo) {
            attendanceInfo.style.display = 'block';
            if (timeInDisplay) timeInDisplay.textContent = timeIn ? formatTime(timeIn) : 'Not yet recorded';
            if (timeOutDisplay) timeOutDisplay.textContent = timeOut ? formatTime(timeOut) : 'Not yet recorded';
            if (statusDisplay) statusDisplay.innerHTML = `<span class="status-badge status-${status}">${status}</span>`;
        }

        const isCompleted = timeIn && timeOut;
        const hasTimeInOnly = timeIn && !timeOut;

        if (isCompleted) {
            qrContainer.innerHTML = `
                <div class="qr-container">
                    <i class="fas fa-check-circle success-icon"></i>
                    <h3 style="color: var(--success); font-size: 1.4rem;">Attendance Completed for Today</h3>
                    <p style="margin: 8px 0;">You have successfully recorded both Time In and Time Out for today.</p>
                    <div style="background: var(--gray-50); border: 1px solid var(--gray-200); border-radius: var(--radius); padding: 15px; max-width: 340px; margin: 15px auto; text-align: left;">
                        <div style="display:flex; justify-content:space-between; margin-bottom: 6px;">
                            <strong>⏰ Time In:</strong> <span>${formatTime(timeIn)}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom: 6px;">
                            <strong>⏰ Time Out:</strong> <span>${formatTime(timeOut)}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom: 6px;">
                            <strong>📊 Status:</strong> <span class="status-badge status-${status}">${status}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <strong>📅 Schedule:</strong> <span style="font-size: 12px; color: var(--gray-600);">${todaySchedule?.summary || 'Adjusted Shift'}</span>
                        </div>
                    </div>
                    <p class="info-text"><i class="fas fa-calendar-check"></i> Attendance activity has been verified and logged in system audit records.</p>
                </div>
            `;
        } else if (hasTimeInOnly) {
            qrContainer.innerHTML = `
                <div class="qr-container">
                    <h3><i class="fas fa-qrcode"></i> Time Out QR Code</h3>
                    <p>Your Time In was recorded at <strong>${formatTime(timeIn)}</strong>. Generate QR or confirm Time Out when leaving.</p>
                    <div class="qr-actions" style="text-align: center; padding: 25px 15px;">
                        <button onclick="window.generateQR('time_out')" class="btn-generate-timeout">
                            <i class="fas fa-qrcode"></i> Generate Time Out QR Code
                        </button>
                        <button onclick="window.recordAttendance('time_out')" class="btn-scanner" style="margin-top: 12px; background: #0284c7; font-size: 0.95rem; padding: 10px 20px; display: inline-flex; align-items: center; gap: 8px;">
                            <i class="fas fa-sign-out-alt"></i> Quick Record Time Out Now
                        </button>
                        <p class="info-text" style="margin-top: 15px;">
                            <i class="fas fa-info-circle"></i> Generate QR code or click Quick Record to log your official Time Out.
                        </p>
                    </div>
                </div>
            `;
        }
    }


    function renderFacultyHistory() {
        if (!historyList) return;

        if (!facultyAttendanceHistory || facultyAttendanceHistory.length === 0) {
            historyList.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-calendar-alt"></i>
                    <p>No attendance records found</p>
                    <p class="info-text">Generate a QR code or scan to start recording your attendance</p>
                </div>
            `;
            return;
        }

        const recent = facultyAttendanceHistory.slice(0, 10);
        let html = `
            <div class="table-container">
                <table class="data-table" style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: var(--gray-100); text-align: left;">
                            <th style="padding: 12px 16px; border-bottom: 1px solid var(--gray-200);">Date</th>
                            <th style="padding: 12px 16px; border-bottom: 1px solid var(--gray-200);">Time In</th>
                            <th style="padding: 12px 16px; border-bottom: 1px solid var(--gray-200);">Time Out</th>
                            <th style="padding: 12px 16px; border-bottom: 1px solid var(--gray-200);">Status</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        recent.forEach(record => {
            const date = record.date || 'N/A';
            const timeIn = record.time_in || record.timeIn ? formatTime(record.time_in || record.timeIn) : '--:--';
            const timeOut = record.time_out || record.timeOut ? formatTime(record.time_out || record.timeOut) : '--:--';
            const status = record.status || 'Present';

            html += `
                <tr style="border-bottom: 1px solid var(--gray-100);">
                    <td style="padding: 12px 16px; font-weight: 500;">${formatDate(date)}</td>
                    <td style="padding: 12px 16px;">${timeIn}</td>
                    <td style="padding: 12px 16px;">${timeOut}</td>
                    <td style="padding: 12px 16px;"><span class="status-badge status-${status}">${status}</span></td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;
        historyList.innerHTML = html;
    }

    function updateFacultyStats() {
        let total = facultyAttendanceHistory.length;
        let present = 0;
        let late = 0;
        let absent = 0;

        facultyAttendanceHistory.forEach(item => {
            const st = (item.status || '').toLowerCase();
            if (st === 'present') present++;
            else if (st === 'late') late++;
            else if (st === 'absent') absent++;
            else present++;
        });

        if (totalDays) totalDays.textContent = total;
        if (presentDays) presentDays.textContent = present;
        if (lateDays) lateDays.textContent = late;
        if (absentDays) absentDays.textContent = absent;
    }

    // ============================================
    // LOAD ATTENDANCE ACTIVITY LOGS
    // ============================================
    async function loadAttendanceActivities() {
        if (!activityTimelineList) return;

        try {
            const { data: logs, error } = await supabase
                .from('activity_logs')
                .select('*')
                .or(`user_id.eq.${teacherRecord.user_id},user_id.eq.${teacherRecord.id}`)
                .order('timestamp', { ascending: false })
                .limit(10);

            let activities = logs || [];

            if (activities.length === 0) {
                try {
                    const localLogs = localStorage.getItem('hes_teacher_attendance_' + teacherId);
                    if (localLogs) {
                        const parsed = JSON.parse(localLogs);
                        parsed.slice(0, 5).forEach(p => {
                            if (p.time_in) {
                                activities.push({
                                    id: 'local_' + p.date + '_in',
                                    action: `Teacher Time-In (${p.status || 'Present'})`,
                                    details: `Teacher ${displayName} recorded Time-In at ${formatTime(p.time_in)}. Adjusted Schedule: ${todaySchedule?.summary || 'Standard Shift'}. Status: ${p.status || 'Present'}.`,
                                    timestamp: p.timestamp || (p.date + 'T08:00:00Z'),
                                    role: 'teacher'
                                });
                            }
                            if (p.time_out) {
                                activities.push({
                                    id: 'local_' + p.date + '_out',
                                    action: 'Teacher Time-Out (Completed)',
                                    details: `Teacher ${displayName} recorded Time-Out at ${formatTime(p.time_out)}. Official shift session completed.`,
                                    timestamp: p.timestamp || (p.date + 'T17:00:00Z'),
                                    role: 'teacher'
                                });
                            }
                        });
                    }
                } catch(e) {}
            }

            if (activities.length === 0) {
                activityTimelineList.innerHTML = `
                    <div style="text-align: center; padding: 24px; color: #94a3b8;">
                        <i class="fas fa-clipboard-list" style="font-size: 24px; margin-bottom: 6px;"></i>
                        <p style="margin:0;">No attendance activities logged yet today. Validate your Time-In to start today's activity stream.</p>
                    </div>
                `;
                return;
            }

            let html = '';
            activities.forEach(item => {
                const isTimeIn = (item.action || '').toLowerCase().includes('time-in') || (item.action || '').toLowerCase().includes('time in');
                const isLate = (item.action || '').toLowerCase().includes('late');
                const dotClass = isLate ? 'warning' : 'success';
                const iconClass = isTimeIn ? 'fa-sign-in-alt' : 'fa-sign-out-alt';
                const itemDate = item.timestamp ? new Date(item.timestamp) : new Date();
                const timeFmt = itemDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
                const dateFmt = formatDate(item.timestamp ? item.timestamp.split('T')[0] : getTodayDateString());

                html += `
                    <div class="timeline-entry">
                        <div class="timeline-dot ${dotClass}">
                            <i class="fas ${iconClass}"></i>
                        </div>
                        <div class="timeline-box">
                            <div class="timeline-top">
                                <span class="timeline-action-title">${item.action}</span>
                                <span class="timeline-time-rel"><i class="far fa-clock"></i> ${dateFmt} • ${timeFmt}</span>
                            </div>
                            <div class="timeline-desc">${item.details}</div>
                            <div class="timeline-meta-tags">
                                <span class="timeline-tag ${isLate ? 'tag-warning' : 'tag-success'}">${isLate ? 'Late Arrival' : 'On Time / Verified'}</span>
                                <span class="timeline-tag tag-info">Schedule: ${todaySchedule?.summary || 'Adjusted Shift'}</span>
                                <span class="timeline-tag"><i class="fas fa-shield-alt"></i> Authenticated</span>
                            </div>
                        </div>
                    </div>
                `;
            });

            activityTimelineList.innerHTML = html;

        } catch (err) {
            console.warn('Error loading attendance activities:', err);
        }
    }

    // ============================================
    // GENERATE FACULTY QR CODE
    // ============================================
    window.generateQR = function(type) {
        if (!sessionUser) {
            showAlert('⚠️ Please login first', 'error');
            return;
        }

        const today = getTodayDateString();
        const timeIn = facultyCurrentAttendance ? (facultyCurrentAttendance.time_in || facultyCurrentAttendance.timeIn) : null;
        const timeOut = facultyCurrentAttendance ? (facultyCurrentAttendance.time_out || facultyCurrentAttendance.timeOut) : null;

        if (timeIn && timeOut) {
            showAlert('⚠️ Attendance is already completed for today', 'warning');
            return;
        }

        if (type === 'time_in' && timeIn) {
            showAlert('⚠️ Time In is already recorded for today', 'warning');
            return;
        }

        if (type === 'time_out' && !timeIn) {
            showAlert('⚠️ Please record Time In first before generating Time Out QR code', 'warning');
            return;
        }

        const payload = {
            system: 'HES_QR_ATTENDANCE',
            teacher_id: teacherId,
            teacher_name: displayName,
            action: type,
            date: today,
            timestamp: Date.now()
        };

        const qrDataString = JSON.stringify(payload);
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrDataString)}`;
        const actionTitle = type === 'time_in' ? 'Time In' : 'Time Out';
        const evalStatus = evaluateAttendanceStatus(getLocalTimeString(), todaySchedule);

        qrContainer.innerHTML = `
            <div class="qr-container" style="animation: fadeIn 0.4s ease;">
                <h3><i class="fas fa-qrcode"></i> ${actionTitle} QR Code</h3>
                <p>Scan this QR code using the camera scanner or click "Confirm & Record ${actionTitle} Now"</p>
                
                <div class="qr-code">
                    <img src="${qrCodeUrl}" alt="${actionTitle} QR Code" style="width: 220px; height: 220px;">
                </div>

                <div class="qr-info">
                    <h4>${displayName} — ${actionTitle}</h4>
                    <p>📱 Use the camera scanner above or another device to scan</p>
                    <p class="expiry-text" style="color:var(--success)!important;"><i class="fas fa-check-circle"></i> Validated for today's faculty attendance</p>
                    <p class="expiry-text"><i class="fas fa-clock"></i> Valid for today (${formatDate(today)}) • Schedule: ${todaySchedule?.summary || 'Standard Shift'}</p>
                    
                    <div style="display:flex; justify-content:center; gap: 12px; margin-top: 15px; flex-wrap: wrap;">
                        <button onclick="window.recordAttendance('${type}')" class="btn-scanner" style="background: var(--success); font-size: 0.95rem; padding: 10px 20px;">
                            <i class="fas fa-check-circle"></i> Confirm & Record ${actionTitle} Now
                        </button>
                        <button onclick="window.generateQR('${type}')" class="btn-scanner" style="background: var(--gray-700); font-size: 0.95rem; padding: 10px 18px;">
                            <i class="fas fa-sync-alt"></i> Refresh QR
                        </button>
                    </div>
                </div>
            </div>
        `;

        showAlert(`✅ ${actionTitle} QR code generated! You can scan it or click Confirm to record.`, 'success');
    };

    window.recordAttendance = async function(type) {
        try {
            const recordRes = await recordTeacherAttendance(supabase, {
                teacherRecord,
                displayName,
                actionType: type,
                validationMethod: 'Faculty QR Code',
                adjustedSchedule: todaySchedule
            });

            showAlert(`🎉 ${recordRes.actionLabel} recorded at ${recordRes.timeFormatted} (${recordRes.status})!`, 'success');

            if (scanResult) {
                scanResult.className = 'scan-result success';
                scanResult.innerHTML = `<strong><i class="fas fa-check-circle"></i> Success!</strong> ${recordRes.actionLabel} recorded for ${displayName} at ${recordRes.timeFormatted} (Status: ${recordRes.status}).`;
            }

            await loadFacultyAttendanceData();
        } catch (error) {
            console.error('Error recording faculty attendance:', error);
            showAlert('❌ Failed to record attendance: ' + error.message, 'error');
        }
    };

    // ============================================
    // QR SCANNER (CAMERA & IMAGE)
    // ============================================
    function loadJsQR() {
        return new Promise((resolve, reject) => {
            if (typeof window.jsQR !== 'undefined') {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    window.startCamera = async function() {
        if (isWeekendToday()) {
            showAlert('📅 Camera scanning is disabled on weekends (Saturday & Sunday).', 'warning');
            return;
        }

        try {
            await loadJsQR();

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                showAlert('❌ Camera not supported by this browser', 'error');
                return;
            }

            const constraints = {
                video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
            };

            cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
            if (video) {
                video.srcObject = cameraStream;
                await video.play();
            }

            if (startCameraBtn) startCameraBtn.style.display = 'none';
            if (stopCameraBtn) stopCameraBtn.style.display = 'inline-block';
            isScanning = true;

            scanQRCode();
            showAlert('📷 Camera started. Point at your QR code.', 'success');

        } catch (error) {
            console.error('Camera error:', error);
            showAlert('❌ Failed to access camera: ' + error.message, 'error');
        }
    };

    window.stopCamera = function() {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
        }
        if (video) {
            video.srcObject = null;
        }
        if (startCameraBtn) startCameraBtn.style.display = 'inline-block';
        if (stopCameraBtn) stopCameraBtn.style.display = 'none';
        isScanning = false;
    };

    function scanQRCode() {
        if (!isScanning) return;

        if (video && video.readyState === video.HAVE_ENOUGH_DATA && canvas && ctx) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            if (typeof window.jsQR === 'function') {
                const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: 'dontInvert',
                });

                if (code && code.data && !scanThrottle) {
                    scanThrottle = true;
                    setTimeout(() => { scanThrottle = false; }, 2000);
                    handleScannedData(code.data);
                    window.stopCamera();
                    return;
                }
            }
        }

        if (isScanning) {
            requestAnimationFrame(scanQRCode);
        }
    }

    function handleScannedData(data) {
        console.log('🔍 QR Data scanned:', data);
        try {
            let parsed = null;
            try {
                parsed = JSON.parse(data);
            } catch(e) {
                if (data.includes('token=')) {
                    const url = new URL(data);
                    const token = url.searchParams.get('token');
                    if (token) {
                        const decoded = atob(token);
                        const parts = decoded.split('_');
                        parsed = { action: parts[2] || 'time_in' };
                    }
                }
            }

            if (parsed && (parsed.action === 'time_in' || parsed.action === 'time_out')) {
                showAlert(`✅ QR Code detected! Recording ${parsed.action === 'time_in' ? 'Time In' : 'Time Out'}...`, 'success');
                window.recordAttendance(parsed.action);
            } else if (parsed && parsed.system === 'HES_QR_ATTENDANCE') {
                const action = parsed.action || 'time_in';
                window.recordAttendance(action);
            } else {
                const action = (data.toLowerCase().includes('time_out') || (facultyCurrentAttendance && facultyCurrentAttendance.time_in)) ? 'time_out' : 'time_in';
                showAlert(`✅ QR scanned! Recording ${action === 'time_in' ? 'Time In' : 'Time Out'}...`, 'success');
                window.recordAttendance(action);
            }
        } catch(err) {
            console.error('Error handling scanned data:', err);
            showAlert('⚠️ Scanned QR is not valid for attendance', 'warning');
        }
    }

    window.switchTab = function(tab) {
        const cameraTab = document.getElementById('cameraScannerTab');
        const uploadTab = document.getElementById('uploadScannerTab');
        const tabs = document.querySelectorAll('.scanner-header .tab-btn');

        tabs.forEach(t => t.classList.remove('active'));

        if (tab === 'camera') {
            if (cameraTab) cameraTab.classList.add('active-tab');
            if (uploadTab) uploadTab.classList.remove('active-tab');
            if (tabs[0]) tabs[0].classList.add('active');
        } else {
            if (uploadTab) uploadTab.classList.add('active-tab');
            if (cameraTab) cameraTab.classList.remove('active-tab');
            if (tabs[1]) tabs[1].classList.add('active');
            if (isScanning) window.stopCamera();
        }
    };
    window.switchScannerTab = window.switchTab;

    window.uploadImage = async function(input) {
        if (isWeekendToday()) {
            showAlert('📅 Image upload scanning is disabled on weekends (Saturday & Sunday).', 'warning');
            return;
        }

        const file = input.files[0];
        if (!file) return;

        await loadJsQR();

        const reader = new FileReader();
        reader.onload = function(e) {
            const previewImg = document.getElementById('previewImg');
            const previewImage = document.getElementById('previewImage');
            if (previewImg && previewImage) {
                previewImg.src = e.target.result;
                previewImage.style.display = 'block';
            }

            const img = new Image();
            img.onload = function() {
                const canvas2 = document.createElement('canvas');
                const ctx2 = canvas2.getContext('2d');
                canvas2.width = img.naturalWidth || img.width;
                canvas2.height = img.naturalHeight || img.height;
                ctx2.drawImage(img, 0, 0, canvas2.width, canvas2.height);

                const imageData = ctx2.getImageData(0, 0, canvas2.width, canvas2.height);
                if (typeof window.jsQR === 'function') {
                    const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
                        inversionAttempts: 'dontInvert',
                    });

                    if (code && code.data) {
                        handleScannedData(code.data);
                    } else {
                        showAlert('⚠️ No QR code recognized in the uploaded image. Please try a clearer picture.', 'warning');
                    }
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    };

    // ============================================
    // INITIALIZATION
    // ============================================
    loadFacultyAttendanceData();

    console.log('✅ Faculty QR Attendance fully initialized');

})();