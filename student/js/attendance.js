/**
 * Student Attendance - Supabase Integration
 * HES - HES, Hiraya Enrollment System
 * Exclusive attendance tracking for active logged-in student
 */

import { supabase } from '../../supabase/config.js';

(function () {
    'use strict';

    console.log('📅 Student Attendance (Supabase) ready');

    // ============================================
    // DOM ELEMENTS
    // ============================================

    // Sidebar & Profile
    const studentName = document.getElementById('studentName');
    const studentInitial = document.getElementById('studentInitial');
    const logoutBtn = document.getElementById('logoutBtn');
    const currentDateDisplay = document.getElementById('currentDateDisplay');

    // Current Enrollment Card Info
    const gradeDisplay = document.getElementById('gradeDisplay');
    const strandDisplay = document.getElementById('strandDisplay');
    const statusDisplay = document.getElementById('statusDisplay');
    const schoolYearDisplay = document.getElementById('schoolYearDisplay');

    // KPI Stats
    const attendanceRate = document.getElementById('attendanceRate');
    const rateProgressFill = document.getElementById('rateProgressFill');
    const rateLabel = document.getElementById('rateLabel');
    const presentDaysCount = document.getElementById('presentDaysCount');
    const presentDetailLabel = document.getElementById('presentDetailLabel');
    const lateDaysCount = document.getElementById('lateDaysCount');
    const lateDetailLabel = document.getElementById('lateDetailLabel');
    const absentDaysCount = document.getElementById('absentDaysCount');
    const absentDetailLabel = document.getElementById('absentDetailLabel');

    // Today's Status
    const todayStatusBadgeContainer = document.getElementById('todayStatusBadgeContainer');
    const todayDateSubtitle = document.getElementById('todayDateSubtitle');
    const todayStandingText = document.getElementById('todayStandingText');
    const todayStandingSub = document.getElementById('todayStandingSub');
    const todaySessionValue = document.getElementById('todaySessionValue');
    const todaySessionSub = document.getElementById('todaySessionSub');
    const todayRemarks = document.getElementById('todayRemarks');

    // Filters & Table
    const recordCountBadge = document.getElementById('recordCountBadge');
    const monthFilter = document.getElementById('monthFilter');
    const statusFilter = document.getElementById('statusFilter');
    const attendanceSearch = document.getElementById('attendanceSearch');
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');
    const exportAttendanceBtn = document.getElementById('exportAttendanceBtn');
    const attendanceTableBody = document.getElementById('attendanceTableBody');
    const alertContainer = document.getElementById('alertContainer');

    // ============================================
    // STATE
    // ============================================

    let rawAttendanceRecords = [];
    let filteredRecords = [];
    let studentProfile = null;
    let enrollmentRecord = null;

    // ============================================
    // SESSION CHECK
    // ============================================

    let sessionUser = null;
    try {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            sessionUser = JSON.parse(stored);
        }
    } catch (e) {
        console.error('Error reading currentUser from localStorage', e);
    }

    if (!sessionUser) {
        console.warn('⚠️ No active user session found, redirecting to login...');
        window.location.replace('../auth/login.html');
        return;
    }

    // Role check
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

    // ============================================
    // UTILITY HELPERS
    // ============================================

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

    function showAlert(message, type = 'info') {
        if (!alertContainer) return;
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        const icon = type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle');
        alert.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
        alertContainer.appendChild(alert);
        setTimeout(() => {
            alert.style.opacity = '0';
            setTimeout(() => alert.remove(), 300);
        }, 4000);
    }

    function formatDate(dateStr) {
        if (!dateStr) return 'N/A';
        try {
            const d = new Date(dateStr + 'T00:00:00');
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch {
            return dateStr;
        }
    }

    function getDayOfWeek(dateStr) {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr + 'T00:00:00');
            if (isNaN(d.getTime())) return '';
            return d.toLocaleDateString('en-US', { weekday: 'long' });
        } catch {
            return '';
        }
    }

    function formatTime(timeStr) {
        if (!timeStr || timeStr === '—' || timeStr === '-') return '—';
        if (timeStr.includes('AM') || timeStr.includes('PM')) return timeStr;
        try {
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

    // Set header date badge
    const today = new Date();
    if (currentDateDisplay) {
        currentDateDisplay.textContent = today.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }

    if (todayDateSubtitle) {
        todayDateSubtitle.textContent = today.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
    }

    // ============================================
    // INITIAL DISPLAY SETUP
    // ============================================

    let studentDisplayName = sessionUser.displayName || 
        (sessionUser.firstName ? `${sessionUser.firstName} ${sessionUser.lastName || ''}`.trim() : 
        (sessionUser.email ? sessionUser.email.split('@')[0] : 'Student'));
    studentDisplayName = sanitizeStudentName(studentDisplayName, sessionUser.email);

    if (studentName) studentName.textContent = studentDisplayName;
    if (studentInitial) studentInitial.textContent = getStudentInitials(studentDisplayName);

    // Initial enrollment values from active student session
    let lrnVal = sessionUser.lrn || '—';
    let gradeVal = sessionUser.grade || sessionUser.grade_level || 'Grade 8';
    let sectionVal = sessionUser.section || '';
    let strandVal = sessionUser.strand || (gradeVal.includes('11') || gradeVal.includes('12') ? 'TVL-ICT' : 'N/A');
    let syVal = sessionUser.school_year || sessionUser.schoolYear || '2025-2026';
    let statusVal = sessionUser.status || 'Enrolled';

    if (gradeDisplay) gradeDisplay.textContent = gradeVal;
    if (strandDisplay) strandDisplay.textContent = strandVal;
    if (statusDisplay) statusDisplay.textContent = statusVal;
    if (schoolYearDisplay) schoolYearDisplay.textContent = syVal;

    // Real records only: start with empty list until database and shared queries resolve
    rawAttendanceRecords = [];
    applyFilters();

    // ============================================
    // LOGOUT
    // ============================================

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function (e) {
            e.preventDefault();
            localStorage.removeItem('currentUser');
            localStorage.removeItem('hes_student_avatar');
            localStorage.removeItem('hes_student_name');
            try {
                await supabase.auth.signOut();
            } catch (err) {}
            window.location.replace('../auth/login.html');
        });
    }

    // ============================================
    // DATE HELPERS
    // ============================================

    function getTodayDateString() {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function isWeekend(dateStr) {
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
    // LOAD STUDENT & ATTENDANCE DATA FROM SUPABASE & REAL-TIME TEACHER STORES
    // ============================================

    async function loadAttendanceModule() {
        try {
            const userEmail = (sessionUser.email || '').trim().toLowerCase();
            const userUid = (sessionUser.uid || sessionUser.id || '').toString().trim();
            const userTableId = (sessionUser.student_id || sessionUser.studentTableId || '').toString().trim();
            const userLrn = (sessionUser.lrn || '').toString().trim();

            let allStudentProfiles = [];

            // 1. Query Student Profile (supporting multiple rows / aliases)
            try {
                let orParts = [];
                if (userEmail) orParts.push(`email.ilike.${userEmail}`);
                if (userUid) orParts.push(`id.eq.${userUid}`);
                if (userTableId) orParts.push(`id.eq.${userTableId}`);
                if (userLrn) orParts.push(`lrn.eq.${userLrn}`);

                if (orParts.length > 0) {
                    const { data: sData } = await supabase.from('students').select('*').or(orParts.join(','));
                    if (sData && sData.length > 0) {
                        allStudentProfiles = sData;
                        studentProfile = sData[0];
                        const full = `${studentProfile.first_name || ''} ${studentProfile.last_name || ''}`.trim();
                        if (full) {
                            const clean = sanitizeStudentName(full, userEmail);
                            studentDisplayName = clean;
                            if (studentName) studentName.textContent = clean;
                            if (studentInitial) studentInitial.textContent = getStudentInitials(clean);
                        }
                    }
                }
            } catch (err) {
                console.warn('Student query notice:', err);
            }

            // 2. Query Student Enrollment
            try {
                const studentIdCandidates = [
                    studentProfile?.id,
                    userTableId,
                    userUid,
                    ...allStudentProfiles.map(s => s.id)
                ].filter(Boolean);

                let enrOrParts = [];
                if (userEmail) enrOrParts.push(`email.ilike.${userEmail}`);
                studentIdCandidates.forEach(sid => enrOrParts.push(`student_id.eq.${sid}`));
                if (userLrn) enrOrParts.push(`lrn.eq.${userLrn}`);

                if (enrOrParts.length > 0) {
                    const { data: enrData } = await supabase
                        .from('enrollments')
                        .select('*')
                        .or(enrOrParts.join(','))
                        .order('created_at', { ascending: false });

                    if (enrData && enrData.length > 0) {
                        enrollmentRecord = enrData[0];
                    }
                }
            } catch (err) {
                console.warn('Enrollment query notice:', err);
            }

            // Resolve Section Name if section_id is present
            let resolvedSection = enrollmentRecord?.section || studentProfile?.section || sectionVal;
            const secIdToLookup = studentProfile?.section_id || enrollmentRecord?.section_id;
            if (secIdToLookup) {
                try {
                    const { data: secRow } = await supabase.from('sections').select('name').eq('id', secIdToLookup).maybeSingle();
                    if (secRow?.name) resolvedSection = secRow.name;
                } catch (_) {}
            }

            // Update Current Enrollment Card details
            lrnVal = studentProfile?.lrn || sessionUser.lrn || enrollmentRecord?.lrn || lrnVal;
            gradeVal = enrollmentRecord?.grade_level || enrollmentRecord?.grade || studentProfile?.grade_level || gradeVal;
            sectionVal = resolvedSection;
            strandVal = enrollmentRecord?.strand || studentProfile?.strand || (gradeVal.includes('11') || gradeVal.includes('12') ? 'TVL-ICT' : 'N/A');
            syVal = enrollmentRecord?.school_year || enrollmentRecord?.schoolYear || syVal;
            statusVal = enrollmentRecord?.status ? (enrollmentRecord.status.charAt(0).toUpperCase() + enrollmentRecord.status.slice(1)) : (sessionUser.status || 'Enrolled');

            if (gradeDisplay) gradeDisplay.textContent = gradeVal;
            if (strandDisplay) strandDisplay.textContent = strandVal;
            if (statusDisplay) statusDisplay.textContent = statusVal;
            if (schoolYearDisplay) schoolYearDisplay.textContent = syVal;

            // 3. Query Exclusive Student Attendance Records from Supabase
            let onlineRecords = [];
            const studentValidIds = new Set([
                studentProfile?.id,
                userTableId,
                userUid,
                sessionUser?.student_id,
                sessionUser?.studentTableId,
                sessionUser?.id,
                sessionUser?.uid,
                ...allStudentProfiles.map(s => s.id)
            ].filter(Boolean).map(String));

            if (studentValidIds.size > 0) {
                try {
                    const orList = Array.from(studentValidIds).map(id => `student_id.eq.${id}`).join(',');
                    const { data: attData, error: attError } = await supabase
                        .from('attendance')
                        .select('*')
                        .or(orList)
                        .order('date', { ascending: false });

                    if (!attError && Array.isArray(attData) && attData.length > 0) {
                        onlineRecords = attData;
                    }
                } catch (err) {
                    console.warn('Attendance database query notice:', err);
                }
            }

            // 4. Load Teacher-Recorded Attendance from Shared Stores
            const sharedRecords = [];
            const norm = v => (v || '').toString().toLowerCase().trim();

            const studentMatchValues = new Set([
                userUid,
                userTableId,
                sessionUser?.id,
                sessionUser?.uid,
                sessionUser?.student_id,
                sessionUser?.studentTableId,
                sessionUser?.lrn,
                lrnVal,
                studentProfile?.id,
                studentProfile?.lrn,
                enrollmentRecord?.student_id,
                enrollmentRecord?.lrn,
                ...allStudentProfiles.map(s => s.id),
                ...allStudentProfiles.map(s => s.lrn)
            ].filter(Boolean).map(norm));

            const studentNameSet = new Set();
            if (studentDisplayName) studentNameSet.add(norm(studentDisplayName));
            if (sessionUser?.displayName) studentNameSet.add(norm(sessionUser.displayName));
            if (sessionUser?.firstName || sessionUser?.lastName) {
                studentNameSet.add(norm(`${sessionUser.firstName || ''} ${sessionUser.lastName || ''}`));
            }
            if (sessionUser?.first_name || sessionUser?.last_name) {
                studentNameSet.add(norm(`${sessionUser.first_name || ''} ${sessionUser.last_name || ''}`));
            }
            if (sessionUser?.name) studentNameSet.add(norm(sessionUser.name));
            allStudentProfiles.forEach(p => {
                const full = `${p.first_name || ''} ${p.last_name || ''}`.trim();
                if (full) studentNameSet.add(norm(full));
                if (p.full_name) studentNameSet.add(norm(p.full_name));
            });
            if (enrollmentRecord) {
                const enrFull = `${enrollmentRecord.first_name || ''} ${enrollmentRecord.last_name || ''}`.trim();
                if (enrFull) studentNameSet.add(norm(enrFull));
            }

            function matchesCurrentStudent(rec) {
                if (!rec) return false;
                const recStuId = norm(rec.student_id || rec.studentId || rec.id);
                const recLrn = norm(rec.lrn);
                const recEmail = norm(rec.email || rec.student_email);
                const recName = norm(rec.student_name || rec.name || rec.studentName || rec.full_name);

                // 1. Direct ID match
                if (recStuId && studentMatchValues.has(recStuId)) return true;

                // 2. Direct LRN match
                if (recLrn && studentMatchValues.has(recLrn)) return true;

                // 3. Email match
                if (userEmail && recEmail && userEmail === recEmail) return true;

                // 4. Name match (exact, contains, flipped last/first)
                if (recName) {
                    for (const sName of studentNameSet) {
                        if (!sName) continue;
                        if (recName === sName || recName.includes(sName) || sName.includes(recName)) return true;
                        const parts = sName.split(/\s+/).filter(Boolean);
                        if (parts.length >= 2) {
                            const flipped = `${parts[parts.length - 1]}, ${parts.slice(0, -1).join(' ')}`;
                            const reversed = `${parts[parts.length - 1]} ${parts.slice(0, -1).join(' ')}`;
                            if (recName.includes(flipped) || flipped.includes(recName) || recName.includes(reversed)) return true;
                        }
                    }
                }

                return false;
            }

            // A. Check hes_attendance_records
            try {
                const centralRaw = localStorage.getItem('hes_attendance_records');
                if (centralRaw) {
                    const list = JSON.parse(centralRaw);
                    if (Array.isArray(list)) {
                        list.forEach(r => {
                            if (matchesCurrentStudent(r)) sharedRecords.push(r);
                        });
                    }
                }
            } catch (e) {}

            // B. Check hes_student_attendance
            try {
                const hesStuRaw = localStorage.getItem('hes_student_attendance');
                if (hesStuRaw) {
                    const list = JSON.parse(hesStuRaw);
                    if (Array.isArray(list)) {
                        list.forEach(r => {
                            if (matchesCurrentStudent(r)) sharedRecords.push(r);
                        });
                    }
                }
            } catch (e) {}

            // C. Check direct student keys (IDs, LRNs, email, names)
            const directKeysToCheck = new Set([
                ...Array.from(studentMatchValues),
                userEmail,
                ...Array.from(studentNameSet)
            ].filter(Boolean));

            directKeysToCheck.forEach(val => {
                try {
                    const directRaw = localStorage.getItem(`hes_student_attendance_${val}`);
                    if (directRaw) {
                        const directObj = JSON.parse(directRaw);
                        if (Array.isArray(directObj)) {
                            directObj.forEach(r => {
                                if (matchesCurrentStudent(r) || !r.student_id) sharedRecords.push(r);
                            });
                        } else if (directObj && typeof directObj === 'object') {
                            if (matchesCurrentStudent(directObj) || !directObj.student_id) sharedRecords.push(directObj);
                        }
                    }
                } catch (e) {}
            });

            // D. Check hes_qr_scans_* and todayScans
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && (k.startsWith('hes_qr_scans_') || k === 'todayScans')) {
                        const scanData = JSON.parse(localStorage.getItem(k) || '[]');
                        if (Array.isArray(scanData)) {
                            scanData.forEach(r => {
                                if (matchesCurrentStudent(r)) {
                                    sharedRecords.push({
                                        id: r.id,
                                        student_id: r.studentId || r.student_id,
                                        lrn: r.lrn,
                                        student_name: r.name || r.student_name,
                                        date: r.date,
                                        status: r.status,
                                        time_in: r.time || r.time_in,
                                        qr_code: r.qr_code || r.qrCode || r.rawQr || '',
                                        teacher_name: r.teacher_name || localStorage.getItem('hes_teacher_name') || 'Class Adviser',
                                        remarks: r.remarks || (r.status === 'Late' ? 'Late arrival recorded via QR Scanner' : 'On-time QR scan')
                                    });
                                }
                            });
                        }
                    }
                }
            } catch (e) {}

            // E. Check date rosters: hes_student_attendance_YYYY-MM-DD
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith('hes_student_attendance_20')) {
                        const dateStr = k.replace('hes_student_attendance_', '');
                        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                            const dateMap = JSON.parse(localStorage.getItem(k) || '{}');
                            if (dateMap && typeof dateMap === 'object') {
                                Object.keys(dateMap).forEach(key => {
                                    const entry = dateMap[key];
                                    const normKey = norm(key);
                                    if (studentMatchValues.has(normKey) || (userEmail && normKey === userEmail) || studentNameSet.has(normKey)) {
                                        sharedRecords.push({
                                            student_id: key,
                                            date: dateStr,
                                            status: entry.status || 'Present',
                                            time_in: entry.timeIn || entry.time_in || '08:00 AM',
                                            teacher_name: entry.teacher_name || localStorage.getItem('hes_teacher_name') || 'Class Adviser',
                                            remarks: entry.remarks || 'Recorded in class roster'
                                        });
                                    }
                                });
                            }
                        }
                    }
                }
            } catch (e) {}

            // Merge online and shared records
            const mergedMap = new Map();

            onlineRecords.forEach(r => {
                if (r && r.date) {
                    const cleanStatus = (r.status || 'present').charAt(0).toUpperCase() + (r.status || 'present').slice(1).toLowerCase();
                    mergedMap.set(r.date, {
                        ...r,
                        status: cleanStatus,
                        time_in: r.time_in || r.timeIn || null,
                        teacher_name: r.teacher_name || (r.teacher_id ? 'Assigned Teacher' : null)
                    });
                }
            });

            sharedRecords.forEach(r => {
                if (r && r.date) {
                    const cleanStatus = (r.status || 'Present').charAt(0).toUpperCase() + (r.status || 'Present').slice(1).toLowerCase();
                    const existing = mergedMap.get(r.date) || {};
                    mergedMap.set(r.date, {
                        ...existing,
                        ...r,
                        status: cleanStatus,
                        time_in: r.time_in || r.time || existing.time_in || null,
                        teacher_name: r.teacher_name || existing.teacher_name || localStorage.getItem('hes_teacher_name') || 'Class Adviser',
                        remarks: r.remarks || existing.remarks || ''
                    });
                }
            });

            // Authentic records only - keep all real records
            rawAttendanceRecords = Array.from(mergedMap.values()).sort((a, b) => {
                return (b.date || '').localeCompare(a.date || '');
            });

            applyFilters();

        } catch (error) {
            console.error('❌ Error initializing student attendance:', error);
            applyFilters();
        }
    }

    // ============================================
    // FILTER & RENDER
    // ============================================

    function applyFilters() {
        const monthVal = monthFilter ? monthFilter.value : 'all';
        const statusVal = statusFilter ? statusFilter.value : 'all';
        const searchVal = attendanceSearch ? attendanceSearch.value.trim().toLowerCase() : '';

        const currentMonthIdx = new Date().getMonth();

        filteredRecords = rawAttendanceRecords.filter(record => {
            const rDate = new Date(record.date + 'T00:00:00');
            const rMonth = isNaN(rDate.getTime()) ? -1 : rDate.getMonth();

            // Month Filter
            if (monthVal === 'current' && rMonth !== currentMonthIdx) return false;
            if (monthVal !== 'all' && monthVal !== 'current' && rMonth !== parseInt(monthVal, 10)) return false;

            // Status Filter
            if (statusVal !== 'all' && (record.status || '').toLowerCase() !== statusVal.toLowerCase()) return false;

            // Search Filter
            if (searchVal) {
                const dateFmt = formatDate(record.date).toLowerCase();
                const dayFmt = getDayOfWeek(record.date).toLowerCase();
                const remarksFmt = (record.remarks || '').toLowerCase();
                const statusFmt = (record.status || '').toLowerCase();
                const teacherFmt = (record.teacher_name || '').toLowerCase();
                if (!dateFmt.includes(searchVal) && !dayFmt.includes(searchVal) && !remarksFmt.includes(searchVal) && !statusFmt.includes(searchVal) && !teacherFmt.includes(searchVal)) {
                    return false;
                }
            }

            return true;
        });

        renderStats(rawAttendanceRecords);
        renderTodayHighlight(rawAttendanceRecords);
        renderTable(filteredRecords);
    }

    // ============================================
    // RENDER STATS & METRICS
    // ============================================

    function renderStats(records) {
        if (!records || records.length === 0) {
            if (attendanceRate) attendanceRate.textContent = '--%';
            if (rateProgressFill) rateProgressFill.style.width = '0%';
            if (rateLabel) rateLabel.innerHTML = '<i class="fas fa-calendar-times" style="color: #64748b;"></i> No records yet';
            if (presentDaysCount) presentDaysCount.textContent = '0';
            if (presentDetailLabel) presentDetailLabel.innerHTML = '<i class="fas fa-calendar-times"></i> 0 days attended';
            if (lateDaysCount) lateDaysCount.textContent = '0';
            if (lateDetailLabel) lateDetailLabel.innerHTML = '<i class="fas fa-check-circle text-success"></i> No tardy records';
            if (absentDaysCount) absentDaysCount.textContent = '0';
            if (absentDetailLabel) absentDetailLabel.innerHTML = '<i class="fas fa-info-circle"></i> 0 Absent / 0 Excused';
            return;
        }

        const totalDays = records.length;
        let onTimeCount = 0;
        let lateCount = 0;
        let absentCount = 0;
        let excusedCount = 0;

        records.forEach(r => {
            const st = (r.status || '').toLowerCase().trim();
            if (st === 'present') onTimeCount++;
            else if (st === 'late') lateCount++;
            else if (st === 'absent') absentCount++;
            else if (st === 'excused') excusedCount++;
        });

        // DepEd SF2 Standard: Total Days in Attendance = On-Time Present + Late (Tardy) Arrivals
        const totalPresentDays = onTimeCount + lateCount;
        const attendedDays = totalPresentDays + excusedCount;
        const rate = totalDays > 0 ? ((attendedDays / totalDays) * 100).toFixed(1) : '0.0';

        if (attendanceRate) attendanceRate.textContent = `${rate}%`;
        if (rateProgressFill) rateProgressFill.style.width = `${Math.min(100, Math.max(0, parseFloat(rate)))}%`;

        if (rateLabel) {
            if (rate >= 95) {
                if (lateCount === 0) {
                    rateLabel.innerHTML = `<i class="fas fa-check-double text-success"></i> Outstanding Attendance (${attendedDays}/${totalDays} days)`;
                } else if (onTimeCount === 0) {
                    rateLabel.innerHTML = `<i class="fas fa-clock text-warning"></i> 100% Attended (${lateCount} late arrival${lateCount > 1 ? 's' : ''})`;
                } else {
                    rateLabel.innerHTML = `<i class="fas fa-check-double text-success"></i> ${rate}% Attendance (${attendedDays}/${totalDays} days, ${lateCount} late)`;
                }
            } else if (rate >= 80) {
                if (lateCount > 0) {
                    rateLabel.innerHTML = `<i class="fas fa-check text-info"></i> Good Attendance (${attendedDays}/${totalDays} days, ${lateCount} late)`;
                } else {
                    rateLabel.innerHTML = `<i class="fas fa-check text-info"></i> Good Attendance Standing (${attendedDays}/${totalDays} days)`;
                }
            } else {
                rateLabel.innerHTML = `<i class="fas fa-exclamation-circle text-danger"></i> Needs Improvement (${attendedDays}/${totalDays} days)`;
            }
        }

        // Present Days card: Total days present in class
        if (presentDaysCount) presentDaysCount.textContent = totalPresentDays;
        if (presentDetailLabel) {
            if (totalPresentDays === 0) {
                presentDetailLabel.innerHTML = `<i class="fas fa-calendar-times"></i> 0 days in attendance`;
            } else if (lateCount === 0) {
                presentDetailLabel.innerHTML = `<i class="fas fa-calendar-check text-success"></i> ${onTimeCount} on-time & marked present`;
            } else if (onTimeCount === 0) {
                presentDetailLabel.innerHTML = `<i class="fas fa-clock text-warning"></i> 0 on-time • ${lateCount} late arrival${lateCount > 1 ? 's' : ''}`;
            } else {
                presentDetailLabel.innerHTML = `<i class="fas fa-calendar-check text-success"></i> ${onTimeCount} on-time • ${lateCount} late`;
            }
        }

        // Late Arrivals card: Dynamic tardy count & descriptive label
        if (lateDaysCount) lateDaysCount.textContent = lateCount;
        if (lateDetailLabel) {
            if (lateCount === 0) {
                lateDetailLabel.innerHTML = `<i class="fas fa-check-circle text-success"></i> No tardy records`;
            } else if (lateCount === 1) {
                lateDetailLabel.innerHTML = `<i class="fas fa-clock text-warning"></i> 1 late arrival recorded`;
            } else {
                lateDetailLabel.innerHTML = `<i class="fas fa-clock text-warning"></i> ${lateCount} late arrivals recorded`;
            }
        }

        // Absences & Excused card
        if (absentDaysCount) absentDaysCount.textContent = absentCount + excusedCount;
        if (absentDetailLabel) {
            if (absentCount === 0 && excusedCount === 0) {
                absentDetailLabel.innerHTML = `<i class="fas fa-shield-alt text-success"></i> 0 Absent / 0 Excused`;
            } else {
                absentDetailLabel.innerHTML = `<i class="fas fa-info-circle"></i> ${absentCount} Absent / ${excusedCount} Excused`;
            }
        }
    }

    // ============================================
    // RENDER TODAY HIGHLIGHT
    // ============================================

    function renderTodayHighlight(records) {
        const now = new Date();
        const isWeekend = now.getDay() === 0 || now.getDay() === 6;
        const todayStr = getTodayDateString();
        const todayRecord = records.find(r => r.date === todayStr);
        const sessionLabel = (gradeVal && sectionVal) ? `${gradeVal} - ${sectionVal}` : 'Regular School Day';

        // 1. If an authentic attendance record exists for today, display it immediately!
        if (todayRecord) {
            const status = todayRecord.status || 'Present';
            const stLower = status.toLowerCase();
            let badgeClass = 'status-present';
            let icon = 'fa-check-circle';

            if (stLower === 'late') {
                badgeClass = 'status-late';
                icon = 'fa-clock';
            } else if (stLower === 'absent') {
                badgeClass = 'status-absent';
                icon = 'fa-times-circle';
            } else if (stLower === 'excused') {
                badgeClass = 'status-excused';
                icon = 'fa-file-medical';
            }

            if (todayStatusBadgeContainer) {
                todayStatusBadgeContainer.innerHTML = `<span class="status-badge ${badgeClass}"><i class="fas ${icon}"></i> ${status}</span>`;
            }

            if (todayStandingText) todayStandingText.textContent = status;
            if (todayStandingSub) todayStandingSub.textContent = todayRecord.time_in ? `Scanned / Logged at ${todayRecord.time_in}` : 'Official DepEd attendance log';
            if (todaySessionValue) todaySessionValue.textContent = sessionLabel;
            const tName = todayRecord.teacher_name || localStorage.getItem('hes_teacher_name') || 'Class Adviser';
            if (todaySessionSub) todaySessionSub.textContent = `Recorded by Teacher ${tName}`;
            if (todayRemarks) todayRemarks.textContent = todayRecord.remarks || (stLower === 'late' ? 'Late arrival recorded.' : 'In attendance with teacher.');
            return;
        }

        // 2. Only if no attendance was taken today, check if it's weekend break
        if (isWeekend) {
            if (todayStatusBadgeContainer) {
                todayStatusBadgeContainer.innerHTML = `<span class="status-badge status-weekend" style="background: #e0f2fe; color: #0369a1; font-weight: 600; padding: 6px 14px; border-radius: 20px; border: 1px solid #bae6fd;"><i class="fas fa-calendar-times"></i> Weekend (No Classes)</span>`;
            }
            if (todayStandingText) todayStandingText.textContent = 'Weekend';
            if (todayStandingSub) todayStandingSub.textContent = 'No classes scheduled';
            if (todaySessionValue) todaySessionValue.textContent = 'Academic Break';
            if (todaySessionSub) todaySessionSub.textContent = 'Saturday / Sunday';
            if (todayRemarks) todayRemarks.textContent = 'No classes scheduled on weekends.';
            return;
        }

        // 3. Weekday awaiting attendance
        if (todayStatusBadgeContainer) {
            todayStatusBadgeContainer.innerHTML = `<span class="status-badge status-pending"><i class="fas fa-clock"></i> Not Yet Recorded Today</span>`;
        }
        if (todayStandingText) todayStandingText.textContent = 'Not Yet Recorded';
        if (todayStandingSub) todayStandingSub.textContent = 'Awaiting adviser roll call';
        if (todaySessionValue) todaySessionValue.textContent = sessionLabel;
        if (todaySessionSub) todaySessionSub.textContent = 'Morning & Afternoon Classes';
        if (todayRemarks) todayRemarks.textContent = 'Your teacher has not recorded attendance for today yet.';
    }

    // ============================================
    // RENDER TABLE
    // ============================================

    function renderTable(records) {
        if (!attendanceTableBody) return;

        if (recordCountBadge) {
            recordCountBadge.textContent = `Showing ${records.length} of ${rawAttendanceRecords.length} records`;
        }

        if (records.length === 0) {
            attendanceTableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="empty-state">
                        <i class="fas fa-calendar-times"></i>
                        <h4>No Attendance Records Found</h4>
                        <p>No official attendance records have been logged for this period yet.</p>
                    </td>
                </tr>
            `;
            return;
        }

        attendanceTableBody.innerHTML = records.map(item => {
            const dateFmt = formatDate(item.date);
            const dayFmt = getDayOfWeek(item.date);
            const status = item.status || 'Present';
            const stLower = status.toLowerCase();

            let badgeClass = 'status-present';
            let icon = 'fa-check-circle';

            if (stLower === 'late') {
                badgeClass = 'status-late';
                icon = 'fa-clock';
            } else if (stLower === 'absent') {
                badgeClass = 'status-absent';
                icon = 'fa-times-circle';
            } else if (stLower === 'excused') {
                badgeClass = 'status-excused';
                icon = 'fa-file-medical';
            }

            const timeInHtml = item.time_in ? `<div style="font-size: 11px; color: #64748b; margin-top: 3px;"><i class="far fa-clock"></i> ${item.time_in}</div>` : '';
            const qrBadgeHtml = (item.qr_code || (item.remarks && item.remarks.includes('QR')))
                ? `<div style="display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 600; background: #e0e7ff; color: #4338ca; border-radius: 4px; padding: 2px 6px; margin-top: 4px;" title="Scanned & verified via Student ID QR Code: ${item.qr_code || 'QR Verified'}"><i class="fas fa-qrcode"></i> QR Verified</div>`
                : '';
            const teacherNote = item.teacher_name 
                ? `<div style="font-size: 11px; color: #0284c7; margin-top: 4px; font-weight: 500;"><i class="fas fa-chalkboard-teacher"></i> Recorded by: <strong>Teacher ${item.teacher_name}</strong></div>`
                : `<div style="font-size: 11px; color: #64748b; margin-top: 4px;"><i class="fas fa-user-check"></i> Recorded with Teacher</div>`;
            const baseRemarks = item.remarks ? item.remarks : (stLower === 'present' ? 'Present in class' : (stLower === 'late' ? 'Late arrival recorded' : 'Official attendance log'));
            const remarksFmt = `<div>${baseRemarks}</div>${teacherNote}`;

            return `
                <tr>
                    <td class="date-cell"><i class="far fa-calendar text-primary" style="margin-right: 6px;"></i> ${dateFmt}</td>
                    <td class="day-cell">${dayFmt}</td>
                    <td>
                        <span class="status-badge ${badgeClass}">
                            <i class="fas ${icon}"></i> ${status}
                        </span>
                        ${timeInHtml}
                        ${qrBadgeHtml}
                    </td>
                    <td class="remarks-cell">${remarksFmt}</td>
                </tr>
            `;
        }).join('');
    }

    // ============================================
    // CSV EXPORT
    // ============================================

    function exportToCSV() {
        if (!filteredRecords || filteredRecords.length === 0) {
            showAlert('No records available to export.', 'error');
            return;
        }

        let csvContent = 'data:text/csv;charset=utf-8,';
        csvContent += 'Date,Day,Status,Time In,Remarks\r\n';

        filteredRecords.forEach(r => {
            const dateFmt = formatDate(r.date);
            const dayFmt = getDayOfWeek(r.date);
            const st = r.status || 'Present';
            const timeStr = r.time_in || '—';
            const rem = `"${(r.remarks || '').replace(/"/g, '""')}"`;
            csvContent += `${dateFmt},${dayFmt},${st},${timeStr},${rem}\r\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `HES_Attendance_${studentDisplayName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showAlert('Attendance exported successfully as CSV!', 'success');
    }

    // ============================================
    // EVENT LISTENERS & LIVE SYNC
    // ============================================

    if (monthFilter) monthFilter.addEventListener('change', applyFilters);
    if (statusFilter) statusFilter.addEventListener('change', applyFilters);
    if (attendanceSearch) attendanceSearch.addEventListener('input', applyFilters);

    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
            if (monthFilter) monthFilter.value = 'all';
            if (statusFilter) statusFilter.value = 'all';
            if (attendanceSearch) attendanceSearch.value = '';
            applyFilters();
            showAlert('Filters reset to default.', 'info');
        });
    }

    if (exportAttendanceBtn) {
        exportAttendanceBtn.addEventListener('click', exportToCSV);
    }

    // Dynamic real-time sync: when teacher scans QR or marks attendance in any tab
    window.addEventListener('storage', (e) => {
        if (!e.key || 
            e.key === 'hes_latest_attendance_event' || 
            e.key === 'hes_attendance_records' || 
            e.key === 'hes_student_attendance' || 
            e.key.startsWith('hes_qr_scans_') || 
            e.key.startsWith('hes_student_attendance_')) {
            console.log('🔄 Live attendance event detected, refreshing student attendance...');
            loadAttendanceModule();
        }
    });

    window.addEventListener('focus', () => {
        loadAttendanceModule();
    });

    // Initial async data fetch
    loadAttendanceModule();

})();
