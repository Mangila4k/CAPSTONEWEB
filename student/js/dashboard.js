/**
 * Student Dashboard - Supabase Integration
 * HES - HES, Hiraya Enrollment System
 */

import { supabase } from '../../supabase/config.js';

(function() {
    'use strict';

    console.log('📊 Student Dashboard (Supabase) ready');

    // ============================================
    // DOM ELEMENTS
    // ============================================

    // Header & Date Badge
    const studentName = document.getElementById('studentName');
    const studentInitial = document.getElementById('studentInitial');
    const studentNameHeader = document.getElementById('studentNameHeader');
    const logoutBtn = document.getElementById('logoutBtn');
    const currentDateDisplay = document.getElementById('currentDateDisplay');

    // Banner elements
    const bannerInitial = document.getElementById('bannerInitial');
    const bannerStudentName = document.getElementById('bannerStudentName');
    const bannerLRN = document.getElementById('bannerLRN');
    const bannerGradeSection = document.getElementById('bannerGradeSection');
    const bannerStrand = document.getElementById('bannerStrand');
    const bannerSchoolYear = document.getElementById('bannerSchoolYear');

    // Stats
    const enrollmentDisplay = document.getElementById('enrollmentDisplay');
    const enrollmentStatus = document.getElementById('enrollmentStatus');
    const subjectsCount = document.getElementById('subjectsCount');
    const averageGrade = document.getElementById('averageGrade');
    const attendanceRate = document.getElementById('attendanceRate');
    const rateProgressFill = document.getElementById('rateProgressFill');
    const attendanceRateLabel = document.getElementById('attendanceRateLabel');

    // Activities
    const recentActivities = document.getElementById('recentActivities');

    // Set today date
    const today = new Date();
    if (currentDateDisplay) {
        currentDateDisplay.textContent = today.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
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
        console.warn('⚠️ No active student session, redirecting...');
        window.location.replace('../auth/login.html');
        return;
    }

    // Check if another role is accessing student dashboard
    if (sessionUser && sessionUser.role && sessionUser.role !== 'student') {
        const routes = {
            'admin': '../admin/dashboard.html',
            'teacher': '../teacher/dashboard.html',
            'parent': '../parents/dashboard.html',
            'registrar': '../registrar/dashboard.html'
        };
        window.location.replace(routes[sessionUser.role] || '../auth/login.html');
        return;
    }

    // Pre-populate student name from session immediately
    let studentDisplayName = sessionUser.displayName || 
        (sessionUser.firstName ? `${sessionUser.firstName} ${sessionUser.lastName || ''}`.trim() : (sessionUser.email ? sessionUser.email.split('@')[0] : 'Student'));

    if (studentName) studentName.textContent = studentDisplayName;
    if (studentNameHeader) studentNameHeader.textContent = studentDisplayName;
    if (studentInitial) studentInitial.textContent = getStudentInitials(studentDisplayName);
    if (bannerStudentName) bannerStudentName.textContent = studentDisplayName;
    if (bannerInitial) bannerInitial.textContent = getStudentInitials(studentDisplayName);

    // ============================================
    // PASSWORD SECURITY BANNER (Initial Credentials Prompt)
    // ============================================
    const pwdBanner = document.getElementById('passwordSecurityBanner');
    const dismissPwdBtn = document.getElementById('dismissPwdBannerBtn');
    const emailKey = (sessionUser.email || '').toLowerCase();
    const uidKey = sessionUser.id || sessionUser.uid || '';

    const isPwdAlreadyChanged = localStorage.getItem(`hes_password_changed_${emailKey}`) === 'true' ||
                                localStorage.getItem(`hes_password_changed_${uidKey}`) === 'true';
    const isBannerDismissed = localStorage.getItem(`hes_dismiss_pwd_banner_${emailKey}`) === 'true';

    if (pwdBanner && !isPwdAlreadyChanged && !isBannerDismissed) {
        pwdBanner.style.display = 'block';
    }

    if (dismissPwdBtn && pwdBanner) {
        dismissPwdBtn.addEventListener('click', () => {
            pwdBanner.style.display = 'none';
            if (emailKey) {
                localStorage.setItem(`hes_dismiss_pwd_banner_${emailKey}`, 'true');
            }
        });
    }

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

    // ============================================
    // LOAD DASHBOARD DATA FROM SUPABASE
    // ============================================

    let currentStudentRow = null;

    async function loadDashboardData() {
        try {
            const userEmail = sessionUser.email || '';
            const userUid = sessionUser.uid || '';

            // 1. Fetch student info
            let studentRow = null;
            let allStudentRows = [];
            try {
                let orParts = [];
                if (userEmail) orParts.push(`email.ilike.${userEmail}`);
                if (userUid) orParts.push(`id.eq.${userUid}`);
                if (sessionUser?.student_id) orParts.push(`id.eq.${sessionUser.student_id}`);
                if (sessionUser?.lrn) orParts.push(`lrn.eq.${sessionUser.lrn}`);
                const { data: studentsData } = await supabase
                    .from('students')
                    .select('*')
                    .or(orParts.join(','));

                if (studentsData && studentsData.length > 0) {
                    allStudentRows = studentsData;
                    studentRow = studentsData[0];
                    currentStudentRow = studentRow;
                    let fullName = `${studentRow.first_name || ''} ${studentRow.last_name || ''}`.trim();
                    fullName = sanitizeStudentName(fullName, userEmail);
                    if (fullName) {
                        studentDisplayName = fullName;
                        try {
                            localStorage.setItem('hes_student_name', fullName);
                        } catch(e) {}
                        if (studentName) studentName.textContent = fullName;
                        if (studentNameHeader) studentNameHeader.textContent = fullName;
                        if (studentInitial) studentInitial.textContent = getStudentInitials(fullName);
                        if (bannerStudentName) bannerStudentName.textContent = fullName;
                        if (bannerInitial) bannerInitial.textContent = getStudentInitials(fullName);
                    }
                }
            } catch(e) {
                console.warn('Student query error:', e);
            }

            // 2. Fetch enrollments
            let enrollments = [];
            const studentId = studentRow?.id || userUid;

            try {
                let query = supabase
                    .from('enrollments')
                    .select('*');

                if (userEmail && studentId) {
                    query = query.or(`email.eq.${userEmail},student_id.eq.${studentId}`);
                } else if (userEmail) {
                    query = query.eq('email', userEmail);
                } else if (studentId) {
                    query = query.eq('student_id', studentId);
                }

                const { data, error } = await query.order('created_at', { ascending: false });

                if (!error && data) {
                    enrollments = data;
                }
            } catch (err) {
                console.warn('Enrollment query error:', err);
            }

            // 3. Fallback to localStorage dummy data if empty
            if (enrollments.length === 0) {
                try {
                    const localSaved = localStorage.getItem('hes_enrollments');
                    if (localSaved) {
                        const parsed = JSON.parse(localSaved);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            enrollments = parsed;
                        }
                    }
                } catch(e) {}
            }

            // Latest enrollment
            const latest = enrollments[0] || null;
            
            // Update enrollment display
            if (latest) {
                const rawSt = (latest.status || 'pending').toLowerCase();
                const displayStatus = (rawSt === 'enrolled' || rawSt === 'approved') ? 'Enrolled' : (rawSt === 'rejected' ? 'Rejected' : 'Pending');
                const grade = latest.grade_level || latest.grade || studentRow?.grade_level || 'Not Enrolled';
                if (enrollmentDisplay) enrollmentDisplay.textContent = grade;
                if (enrollmentStatus) {
                    enrollmentStatus.innerHTML = `<i class="fas fa-circle" style="font-size: 8px; margin-right: 5px;"></i> ${displayStatus}`;
                    if (displayStatus === 'Enrolled') {
                        enrollmentStatus.style.color = '#10b981';
                    } else if (displayStatus === 'Pending') {
                        enrollmentStatus.style.color = '#f59e0b';
                    } else {
                        enrollmentStatus.style.color = '#ef4444';
                    }
                }
                sessionUser.status = displayStatus;
                try {
                    localStorage.setItem('currentUser', JSON.stringify(sessionUser));
                } catch(e) {}
            } else {
                if (enrollmentDisplay) enrollmentDisplay.textContent = studentRow?.grade_level || 'Not Enrolled';
                if (enrollmentStatus) {
                    enrollmentStatus.innerHTML = `<i class="fas fa-circle" style="font-size: 8px; margin-right: 5px;"></i> No Record`;
                    enrollmentStatus.style.color = '#6c757d';
                }
            }

            // Update Banner details
            const lrnVal = studentRow?.lrn || sessionUser.lrn || latest?.lrn || '—';
            const gradeVal = latest?.grade_level || latest?.grade || studentRow?.grade_level || 'Grade 7';
            
            let sectionVal = latest?.section || studentRow?.section || '';
            const secIdToLookup = studentRow?.section_id || latest?.section_id;
            if (secIdToLookup) {
                try {
                    const { data: sData } = await supabase.from('sections').select('name').eq('id', secIdToLookup).maybeSingle();
                    if (sData?.name) sectionVal = sData.name;
                } catch(e) {}
            }
            if (!sectionVal) sectionVal = 'Unassigned';

            const strandVal = latest?.strand || studentRow?.strand || (gradeVal.includes('11') || gradeVal.includes('12') ? 'STEM' : '—');
            const syVal = latest?.school_year || latest?.schoolYear || '2025-2026';

            if (bannerLRN) bannerLRN.innerHTML = `<i class="fas fa-id-card"></i> LRN: ${lrnVal}`;
            if (bannerGradeSection) bannerGradeSection.textContent = `${gradeVal} • ${sectionVal}`;
            if (bannerStrand) bannerStrand.textContent = strandVal;
            if (bannerSchoolYear) bannerSchoolYear.textContent = syVal;

            // Fetch subjects count for this student's grade level & strand (dynamic, not hardcoded)
            try {
                const gradeNum = (gradeVal || '').replace(/\D/g, ''); // e.g. "Grade 8" -> "8"
                if (gradeNum) {
                    let subQuery = supabase
                        .from('subjects')
                        .select('*', { count: 'exact', head: true })
                        .eq('grade_level', gradeNum);
                    
                    if ((gradeNum === '11' || gradeNum === '12') && strandVal && strandVal !== '—') {
                        subQuery = subQuery.or(`strand.eq.${strandVal},strand.is.null`);
                    }

                    const { count: sCount, error: sErr } = await subQuery;
                    if (!sErr && sCount !== null) {
                        if (subjectsCount) subjectsCount.textContent = String(sCount);
                    } else {
                        if (subjectsCount) subjectsCount.textContent = latest ? '8' : '0';
                    }
                } else {
                    if (subjectsCount) subjectsCount.textContent = latest ? '8' : '0';
                }
            } catch(e) {
                if (subjectsCount) subjectsCount.textContent = latest ? '8' : '0';
            }

            // Average grade - dynamically calculate from student grades table or enrollment record
            let avg = '--';
            try {
                const studentLookupId = studentRow?.id || studentId;
                let gQuery = supabase.from('grades').select('grade');
                if (studentLookupId) {
                    gQuery = gQuery.eq('student_id', studentLookupId);
                } else if (userEmail) {
                    gQuery = gQuery.eq('email', userEmail);
                }
                const { data: gData } = await gQuery;
                if (gData && gData.length > 0) {
                    const numericGrades = gData.map(g => Number(g.grade)).filter(g => !isNaN(g) && g > 0);
                    if (numericGrades.length > 0) {
                        const sum = numericGrades.reduce((a, b) => a + b, 0);
                        avg = `${(sum / numericGrades.length).toFixed(2)}%`;
                    }
                } else if (latest?.general_average) {
                    avg = `${latest.general_average}%`;
                }
            } catch(e) {}
            if (averageGrade) averageGrade.textContent = avg;

            // 4. Fetch Student Attendance (Database + Teacher Live Scans)
            let attendanceRecords = [];

            try {
                const studentLookupIds = new Set([
                    studentRow?.id,
                    studentId,
                    sessionUser?.id,
                    sessionUser?.uid,
                    sessionUser?.student_id,
                    ...allStudentRows.map(s => s.id)
                ].filter(Boolean).map(String));

                if (studentLookupIds.size > 0) {
                    const orList = Array.from(studentLookupIds).map(id => `student_id.eq.${id}`).join(',');
                    const { data: attData, error: attErr } = await supabase
                        .from('attendance')
                        .select('*')
                        .or(orList)
                        .order('date', { ascending: false });

                    if (!attErr && Array.isArray(attData) && attData.length > 0) {
                        attendanceRecords = attData;
                    }
                }
            } catch (e) {}

            // Load shared teacher-scanned attendance records
            try {
                const sharedList = [];
                const norm = v => (v || '').toString().toLowerCase().trim();

                const studentMatchValues = new Set([
                    studentRow?.id,
                    studentRow?.lrn,
                    studentId,
                    sessionUser?.id,
                    sessionUser?.uid,
                    sessionUser?.student_id,
                    sessionUser?.studentTableId,
                    sessionUser?.lrn,
                    lrnVal,
                    ...allStudentRows.map(s => s.id),
                    ...allStudentRows.map(s => s.lrn)
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
                allStudentRows.forEach(p => {
                    const full = `${p.first_name || ''} ${p.last_name || ''}`.trim();
                    if (full) studentNameSet.add(norm(full));
                    if (p.full_name) studentNameSet.add(norm(p.full_name));
                });
                if (latest) {
                    const lFull = `${latest.first_name || ''} ${latest.last_name || ''}`.trim();
                    if (lFull) studentNameSet.add(norm(lFull));
                }

                function matchesStu(rec) {
                    if (!rec) return false;
                    const rId = norm(rec.student_id || rec.studentId || rec.id);
                    const rLrn = norm(rec.lrn);
                    const rEmail = norm(rec.email || rec.student_email);
                    const rName = norm(rec.student_name || rec.name || rec.studentName || rec.full_name);

                    if (rId && studentMatchValues.has(rId)) return true;
                    if (rLrn && studentMatchValues.has(rLrn)) return true;
                    if (userEmail && rEmail && norm(userEmail) === rEmail) return true;

                    if (rName) {
                        for (const sName of studentNameSet) {
                            if (!sName) continue;
                            if (rName === sName || rName.includes(sName) || sName.includes(rName)) return true;
                            const parts = sName.split(/\s+/).filter(Boolean);
                            if (parts.length >= 2) {
                                const flipped = `${parts[parts.length - 1]}, ${parts.slice(0, -1).join(' ')}`;
                                const reversed = `${parts[parts.length - 1]} ${parts.slice(0, -1).join(' ')}`;
                                if (rName.includes(flipped) || flipped.includes(rName) || rName.includes(reversed)) return true;
                            }
                        }
                    }
                    return false;
                }

                // Check hes_attendance_records
                const centralRaw = localStorage.getItem('hes_attendance_records');
                if (centralRaw) {
                    const list = JSON.parse(centralRaw);
                    if (Array.isArray(list)) list.forEach(r => { if (matchesStu(r)) sharedList.push(r); });
                }

                // Check hes_student_attendance
                const hesStuRaw = localStorage.getItem('hes_student_attendance');
                if (hesStuRaw) {
                    const list = JSON.parse(hesStuRaw);
                    if (Array.isArray(list)) list.forEach(r => { if (matchesStu(r)) sharedList.push(r); });
                }

                // Check direct student keys
                const directKeys = new Set([...Array.from(studentMatchValues), norm(userEmail), ...Array.from(studentNameSet)].filter(Boolean));
                directKeys.forEach(val => {
                    const dRaw = localStorage.getItem(`hes_student_attendance_${val}`);
                    if (dRaw) {
                        const dObj = JSON.parse(dRaw);
                        if (Array.isArray(dObj)) dObj.forEach(r => { if (matchesStu(r) || !r.student_id) sharedList.push(r); });
                        else if (dObj && typeof dObj === 'object') {
                            if (matchesStu(dObj) || !dObj.student_id) sharedList.push(dObj);
                        }
                    }
                });

                // Check qr scans
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && (k.startsWith('hes_qr_scans_') || k === 'todayScans')) {
                        const sData = JSON.parse(localStorage.getItem(k) || '[]');
                        if (Array.isArray(sData)) {
                            sData.forEach(r => {
                                if (matchesStu(r)) {
                                    sharedList.push({
                                        id: r.id,
                                        student_id: r.studentId || r.student_id,
                                        lrn: r.lrn,
                                        student_name: r.name || r.student_name,
                                        date: r.date,
                                        status: r.status,
                                        time_in: r.time || r.time_in,
                                        teacher_name: r.teacher_name || localStorage.getItem('hes_teacher_name') || 'Class Adviser',
                                        remarks: r.remarks || (r.status === 'Late' ? 'Late arrival recorded via QR Scanner' : 'On-time QR scan')
                                    });
                                }
                            });
                        }
                    }
                }

                // Check date rosters
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
                                    if (studentMatchValues.has(normKey) || (userEmail && normKey === norm(userEmail)) || studentNameSet.has(normKey)) {
                                        sharedList.push({
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

                // Merge into attendanceRecords map
                const map = new Map();
                attendanceRecords.forEach(r => {
                    if (r?.date) {
                        const clean = (r.status || 'present').charAt(0).toUpperCase() + (r.status || 'present').slice(1).toLowerCase();
                        map.set(r.date, { ...r, status: clean, time_in: r.time_in || r.timeIn || null, teacher_name: r.teacher_name || null });
                    }
                });
                sharedList.forEach(r => {
                    if (r?.date) {
                        const clean = (r.status || 'Present').charAt(0).toUpperCase() + (r.status || 'Present').slice(1).toLowerCase();
                        const existing = map.get(r.date) || {};
                        map.set(r.date, {
                            ...existing,
                            ...r,
                            status: clean,
                            time_in: r.time_in || r.time || existing.time_in || null,
                            teacher_name: r.teacher_name || existing.teacher_name || localStorage.getItem('hes_teacher_name') || 'Class Adviser',
                            remarks: r.remarks || existing.remarks || ''
                        });
                    }
                });

                attendanceRecords = Array.from(map.values()).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
            } catch (e) {}

            // Calculate attendance rate from real records
            if (attendanceRecords.length > 0) {
                const totalDays = attendanceRecords.length;
                let attended = 0;
                attendanceRecords.forEach(r => {
                    const st = (r.status || '').toLowerCase();
                    if (st === 'present' || st === 'late' || st === 'excused') attended++;
                });
                const rate = ((attended / totalDays) * 100).toFixed(0);
                if (attendanceRate) attendanceRate.textContent = `${rate}%`;
                if (rateProgressFill) rateProgressFill.style.width = `${Math.min(100, Math.max(0, rate))}%`;
                if (attendanceRateLabel) {
                    attendanceRateLabel.innerHTML = `<i class="fas fa-check-circle text-success"></i> ${attended}/${totalDays} Days Present`;
                }
            } else {
                if (attendanceRate) attendanceRate.textContent = '--%';
                if (rateProgressFill) rateProgressFill.style.width = '0%';
                if (attendanceRateLabel) {
                    attendanceRateLabel.innerHTML = `<i class="fas fa-calendar-times" style="color: #64748b;"></i> No records yet`;
                }
            }

            // Recent attendance activities
            renderRecentActivities(attendanceRecords.slice(0, 5));

        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    }



    // ============================================
    // RENDER RECENT ATTENDANCE ACTIVITIES
    // ============================================

    function renderRecentActivities(attendanceLogs) {
        if (!recentActivities) return;

        if (!attendanceLogs || attendanceLogs.length === 0) {
            recentActivities.innerHTML = `
                <div class="activity-item">
                    <div class="activity-content" style="text-align: center; padding: 30px;">
                        <i class="fas fa-calendar-times" style="font-size: 40px; color: #999; opacity: 0.3; margin-bottom: 10px;"></i>
                        <p style="color: #999;">No attendance records found yet.</p>
                        <a href="attendance.html" style="color: #0b2b4a; text-decoration: none; font-weight: 600; display: inline-block; margin-top: 10px;">
                            View Attendance Page <i class="fas fa-arrow-right"></i>
                        </a>
                    </div>
                </div>
            `;
            return;
        }

        recentActivities.innerHTML = attendanceLogs.map((item, index) => {
            const st = item.status || 'Present';
            const stLower = st.toLowerCase();
            const statusClass = stLower === 'present' ? 'dot-approved' : 
                               (stLower === 'late' ? 'dot-pending' : 'dot-completed');
            const statusTextClass = stLower === 'present' ? 'status-approved' : 
                                   (stLower === 'late' ? 'status-pending' : 'status-rejected');
            
            let dateStr = item.date || 'N/A';
            try {
                const d = new Date(item.date + 'T00:00:00');
                if (!isNaN(d.getTime())) {
                    dateStr = d.toLocaleDateString('en-US', { 
                        weekday: 'short',
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                    });
                }
            } catch(e) {}

            const timeInStr = item.time_in || item.timeIn || '—';
            const timeOutStr = item.time_out || item.timeOut || '—';

            return `
                <div class="activity-item">
                    <div class="activity-dot ${statusClass}"></div>
                    <div class="activity-content">
                        <div class="activity-title">
                            Daily Attendance - ${dateStr}
                            ${index === 0 ? '<span style="margin-left: 10px; font-size: 11px; background: #10b981; color: white; padding: 2px 8px; border-radius: 12px; font-weight: 600;">Latest</span>' : ''}
                        </div>
                        <div class="activity-time">
                            <i class="far fa-clock"></i> In: <strong>${timeInStr}</strong> | Out: <strong>${timeOutStr}</strong> • ${item.remarks || 'On time'}
                            ${item.teacher_name ? `<div style="font-size: 11px; color: #0284c7; margin-top: 2px;"><i class="fas fa-chalkboard-teacher"></i> Recorded by: Teacher ${item.teacher_name}</div>` : ''}
                        </div>
                    </div>
                    <div class="activity-status ${statusTextClass}">
                        ${st}
                    </div>
                </div>
            `;
        }).join('');
    }

    // ============================================
    // NOTIFICATIONS & ANNOUNCEMENTS
    // ============================================
    // Notifications and announcements are unified globally via dashboard_announcements_notifier.js
    async function syncNotifications() {
        if (window.DashboardAnnouncements && typeof window.DashboardAnnouncements.refresh === 'function') {
            try {
                await window.DashboardAnnouncements.refresh();
            } catch (e) {
                console.warn('Dashboard announcements sync notice:', e);
            }
        }
    }

    window.addEventListener('focus', function() {
        loadDashboardData();
        syncNotifications();
    });

    window.addEventListener('storage', function(e) {
        if (!e.key || 
            e.key === 'hes_latest_attendance_event' || 
            e.key === 'hes_attendance_records' || 
            e.key === 'hes_student_attendance' || 
            e.key.startsWith('hes_qr_scans_') || 
            e.key.startsWith('hes_student_attendance_')) {
            console.log('🔄 Dashboard live attendance refresh...');
            loadDashboardData();
        }
    });

    // Initialize sequentially
    async function init() {
        await loadDashboardData();
        await syncNotifications();
    }
    init();

})();