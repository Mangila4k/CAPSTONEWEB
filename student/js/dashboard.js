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

    // Notifications
    const notifBtn = document.getElementById('notificationBtn');
    const notifDropdown = document.getElementById('notificationDropdown');
    const notifList = document.getElementById('notificationList');
    const notifCount = document.getElementById('notifCount');
    const markAllBtn = document.getElementById('markAllReadBtn');

    // Student Type
    const studentTypeBadge = document.getElementById('studentTypeBadge');
    const studentTypeIcon = document.getElementById('studentTypeIcon');
    const studentTypeTitle = document.getElementById('studentTypeTitle');
    const studentTypeDesc = document.getElementById('studentTypeDesc');
    const studentTypeSub = document.getElementById('studentTypeSub');

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
            try {
                const { data: studentsData } = await supabase
                    .from('students')
                    .select('*')
                    .or(`email.eq.${userEmail},id.eq.${userUid}`);

                if (studentsData && studentsData.length > 0) {
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

            // Fetch subjects count
            try {
                const { count } = await supabase
                    .from('subjects')
                    .select('*', { count: 'exact', head: true });
                if (subjectsCount) {
                    subjectsCount.textContent = count && count > 0 ? count : (latest ? 8 : 0);
                }
            } catch(e) {
                if (subjectsCount) subjectsCount.textContent = latest ? 8 : 0;
            }

            // Average grade
            const avg = latest?.general_average ? `${latest.general_average}%` : (latest ? '88.50%' : '--');
            if (averageGrade) averageGrade.textContent = avg;

            // 4. Fetch Student Attendance
            let attendanceRecords = [];

            try {
                let attQuery = supabase.from('attendance').select('*');
                if (studentId) {
                    attQuery = attQuery.eq('student_id', studentId);
                } else if (userEmail) {
                    attQuery = attQuery.eq('email', userEmail);
                }
                const { data: attData, error: attErr } = await attQuery.order('date', { ascending: false });
                if (!attErr && attData && attData.length > 0) {
                    attendanceRecords = attData;
                }
            } catch (e) {}

            // Check local synced attendance
            if (attendanceRecords.length === 0) {
                try {
                    const storedAdminAtt = localStorage.getItem('hes_student_attendance');
                    if (storedAdminAtt) {
                        const parsed = JSON.parse(storedAdminAtt);
                        if (Array.isArray(parsed)) {
                            const myMatches = parsed.filter(item => {
                                const matchLRN = item.lrn && String(item.lrn) === String(lrnVal);
                                const matchName = item.name && item.name.toLowerCase() === studentDisplayName.toLowerCase();
                                const matchId = item.student_id && String(item.student_id) === String(studentId);
                                return matchLRN || matchName || matchId;
                            });
                            if (myMatches.length > 0) {
                                attendanceRecords = myMatches;
                            }
                        }
                    }
                } catch(e) {}
            }

            function isWeekend(dateStr) {
                if (!dateStr) return false;
                try {
                    const d = new Date(dateStr + 'T00:00:00');
                    const day = d.getDay();
                    return day === 0 || day === 6;
                } catch {
                    return false;
                }
            }

            // Fallback generation if no records yet
            if (attendanceRecords.length === 0) {
                attendanceRecords = generateStudentAttendanceSnippet(studentDisplayName, lrnVal);
            }

            // Strictly filter out any weekend attendance records
            attendanceRecords = attendanceRecords.filter(r => !isWeekend(r.date));

            // Calculate attendance rate
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
                if (attendanceRate) attendanceRate.textContent = '100%';
                if (rateProgressFill) rateProgressFill.style.width = '100%';
                if (attendanceRateLabel) {
                    attendanceRateLabel.innerHTML = `<i class="fas fa-check-circle text-success"></i> Perfect Standing`;
                }
            }

            // Student Type
            determineStudentType(enrollments, studentRow);

            // Recent attendance activities
            renderRecentActivities(attendanceRecords.slice(0, 5));

        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    }

    // ============================================
    // GENERATE ATTENDANCE SNIPPET HELPER
    // ============================================

    function generateStudentAttendanceSnippet(studentName, lrn) {
        const logs = [];
        const todayObj = new Date();
        const todayStr = todayObj.toISOString().split('T')[0];
        let dayOffset = 0;
        let count = 0;

        while (count < 10 && dayOffset < 20) {
            const d = new Date(todayObj);
            d.setDate(todayObj.getDate() - dayOffset);
            dayOffset++;

            const dayOfWeek = d.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) continue;

            const dateStr = d.toISOString().split('T')[0];
            const hash = (d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate() + (lrn.charCodeAt(lrn.length - 1) || 7));
            const roll = hash % 100;

            let status = 'Present';
            let timeIn = '07:20 AM';
            let timeOut = '04:30 PM';
            let remarks = 'On time';

            if (dateStr === todayStr && dayOfWeek !== 0 && dayOfWeek !== 6) {
                timeIn = '07:18 AM';
                timeOut = '04:30 PM';
                status = 'Present';
                remarks = 'On time';
            } else if (roll < 10) {
                status = 'Late';
                timeIn = '08:15 AM';
                timeOut = '04:30 PM';
                remarks = 'Traffic';
            } else if (roll === 12) {
                status = 'Excused';
                timeIn = '—';
                timeOut = '—';
                remarks = 'Official reason';
            } else {
                status = 'Present';
                timeIn = '07:25 AM';
                timeOut = '04:30 PM';
                remarks = 'On time';
            }

            logs.push({
                date: dateStr,
                time_in: timeIn,
                time_out: timeOut,
                timeIn: timeIn,
                timeOut: timeOut,
                status: status,
                remarks: remarks
            });
            count++;
        }
        return logs;
    }

    // ============================================
    // DETERMINE STUDENT TYPE
    // ============================================

    function determineStudentType(enrollments, studentRow) {
        const count = enrollments.length;
        let icon = 'fa-star';
        let color = '#0b2b4a';
        let display = 'New Student';
        let description = 'First time enrollee';
        let subText = '<i class="fas fa-graduation-cap"></i> First time enrollment';

        if (count > 1) {
            icon = 'fa-undo-alt';
            display = 'Continuing Student';
            description = 'Continuing student - progressing to next grade level';
            subText = '<i class="fas fa-user-graduate"></i> Academic progression';
        }

        const hasOldSchool = enrollments.some(e => e.previous_school || e.previousSchool);
        if (hasOldSchool && count <= 1) {
            icon = 'fa-exchange-alt';
            display = 'Transferee Student';
            description = 'Transferred from another school - requirements verified';
            subText = '<i class="fas fa-school"></i> Transferred from previous school';
        }

        if (studentTypeBadge) {
            studentTypeBadge.style.background = color;
            studentTypeBadge.innerHTML = `<i class="fas ${icon}"></i> ${display}`;
        }

        if (studentTypeIcon) {
            studentTypeIcon.style.background = color;
            studentTypeIcon.innerHTML = `<i class="fas ${icon}"></i>`;
        }

        if (studentTypeTitle) {
            studentTypeTitle.textContent = display;
        }

        if (studentTypeDesc) {
            studentTypeDesc.textContent = description;
        }

        if (studentTypeSub) {
            studentTypeSub.innerHTML = subText;
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
    // LOAD NOTIFICATIONS (from Supabase or Local)
    // ============================================

    async function loadNotifications() {
        let notifications = [];

        // 1. Gather all valid IDs and emails for this student
        const validUids = new Set([
            sessionUser?.uid,
            sessionUser?.id,
            sessionUser?.user_id,
            sessionUser?.student_id,
            currentStudentRow?.id,
            currentStudentRow?.user_id,
            currentStudentRow?.student_id
        ].filter(Boolean).map(String));

        const validEmails = new Set([
            sessionUser?.email,
            currentStudentRow?.email
        ].filter(Boolean).map(e => e.trim().toLowerCase()));

        // Build student name tokens for personalization verification
        const studentNameTokens = new Set();
        const namesToProcess = [
            studentDisplayName,
            currentStudentRow?.first_name,
            currentStudentRow?.last_name,
            sessionUser?.firstName,
            sessionUser?.lastName,
            sessionUser?.displayName
        ];
        namesToProcess.filter(Boolean).forEach(n => {
            n.toLowerCase().split(/[\s,.-]+/).forEach(tok => {
                if (tok.length >= 3) studentNameTokens.add(tok);
            });
        });

        // Helper: verify that a notification is strictly meant for this student
        function isForThisStudent(notif) {
            if (!notif) return false;

            const notifUid = notif.user_id ? String(notif.user_id) : '';
            const notifStudentId = notif.student_id ? String(notif.student_id) : '';
            const notifEmail = (notif.recipient_email || notif.email) ? String(notif.recipient_email || notif.email).toLowerCase().trim() : '';

            // If explicitly matches this student's IDs or email
            if (notifUid && validUids.has(notifUid)) return true;
            if (notifStudentId && validUids.has(notifStudentId)) return true;
            if (notifEmail && validEmails.has(notifEmail)) return true;

            // If explicitly targeted to ANOTHER user/email, strictly reject!
            if (notifUid && !validUids.has(notifUid)) return false;
            if (notifStudentId && !validUids.has(notifStudentId)) return false;
            if (notifEmail && !validEmails.has(notifEmail)) return false;

            // Check if title or message contains personalized salutations for someone else
            const fullText = `${notif.title || ''} ${notif.message || ''}`.toLowerCase();
            const salutationMatch = fullText.match(/(?:dear|notice for|congratulations|attention to|hello|hi|student:?)\s+([a-z]+(?:\s+[a-z]+)?)/i);
            if (salutationMatch && salutationMatch[1]) {
                const addressedName = salutationMatch[1].trim().toLowerCase();
                let matchFound = false;
                for (const tok of studentNameTokens) {
                    if (addressedName.includes(tok)) {
                        matchFound = true;
                        break;
                    }
                }
                if (!matchFound) {
                    // Belongs to another student (e.g. Mylene when logged in as Jorvin) -> REJECT!
                    return false;
                }
            }

            // For general announcements without specific targeting
            const generalTypes = ['broadcast', 'announcement', 'general', 'update', 'system'];
            if (generalTypes.includes(notif.type) && !notif.user_id && !notif.student_id) {
                return true;
            }

            // If it was a personal notification type (document reminder, enrollment notice, attendance) but lacked user IDs
            return false;
        }

        // 2. Fetch from Supabase
        try {
            const orClauses = [];
            validUids.forEach(id => {
                orClauses.push(`user_id.eq.${id}`);
                orClauses.push(`student_id.eq.${id}`);
            });
            validEmails.forEach(em => {
                orClauses.push(`recipient_email.eq.${em}`);
            });

            // Also allow system broadcasts
            orClauses.push('and(role.eq.student,user_id.is.null,student_id.is.null,recipient_email.is.null,type.in.(broadcast,announcement,general,update))');

            let query = supabase
                .from('notifications')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(30);

            if (orClauses.length > 0) {
                query = query.or(orClauses.join(','));
            }

            const { data } = await query;
            
            if (data && data.length > 0) {
                data.forEach(n => {
                    if (isForThisStudent(n)) {
                        notifications.push({
                            id: n.id,
                            type: n.type || 'action',
                            title: n.title,
                            message: n.message,
                            time: new Date(n.created_at).toLocaleDateString(),
                            read: n.read === true || n.is_read === true
                        });
                    }
                });
            }
        } catch(e) {
            console.warn('Notifications fetch warning:', e);
        }

        // 3. Fetch from localStorage student notifications (strictly per-student keys)
        try {
            const keysToCheck = new Set([...validUids, ...validEmails]);
            keysToCheck.forEach(kId => {
                const localRaw = localStorage.getItem(`hes_notifications_${kId}`);
                if (localRaw) {
                    const localList = JSON.parse(localRaw);
                    if (Array.isArray(localList)) {
                        localList.forEach(loc => {
                            if (isForThisStudent(loc) && !notifications.some(n => String(n.id) === String(loc.id) || n.message === loc.message)) {
                                notifications.unshift({
                                    id: loc.id || 'loc_' + Math.random().toString(36).substr(2, 6),
                                    type: loc.type || 'action',
                                    title: loc.title,
                                    message: loc.message,
                                    time: loc.time || 'Today',
                                    read: loc.read || false
                                });
                            }
                        });
                    }
                }
            });
        } catch(e) {}

        // Fallback generic announcement if none found
        if (notifications.length === 0) {
            notifications = [
                { id: 1, type: 'update', title: '📢 Enrollment Period Open', message: 'Welcome to HES! The enrollment period for SY 2026-2027 is now open.', time: 'Today', read: false },
                { id: 2, type: 'reminder', title: '⏰ Requirements Submission', message: 'Please ensure all your enrollment requirements are submitted on time.', time: 'Today', read: false }
            ];
        }
        
        renderNotifications(notifications, validUids);
        updateNotificationCount(notifications.filter(n => !n.read).length);
    }

    function renderNotifications(notifications, validUids) {
        if (!notifList) return;

        if (notifications.length === 0) {
            notifList.innerHTML = `
                <div class="empty-notifications">
                    <i class="fas fa-bell-slash"></i>
                    <p>No notifications yet</p>
                </div>
            `;
            return;
        }
        
        const icons = {
            update: 'fa-bullhorn',
            action: 'fa-check-circle',
            reminder: 'fa-clock',
            alert: 'fa-exclamation-triangle',
            warning: 'fa-exclamation-triangle',
            message: 'fa-envelope',
            document_reminder: 'fa-file-alt',
            attendance: 'fa-clipboard-check',
            good_moral_request: 'fa-award',
            requirement_reminder: 'fa-clipboard-list'
        };
        
        notifList.innerHTML = notifications.map(notif => {
            const isReqNotice = notif.type === 'good_moral_request' || notif.type === 'requirement_reminder' || (notif.title && notif.title.toLowerCase().includes('good moral'));
            return `
            <div class="notif-item ${notif.read ? 'read' : 'unread'}" data-id="${notif.id}">
                <div class="notif-icon notif-${notif.type}">
                    <i class="fas ${icons[notif.type] || 'fa-bell'}"></i>
                </div>
                <div class="notif-content">
                    <div class="notif-title">${notif.title}</div>
                    <div class="notif-message">${notif.message}</div>
                    ${isReqNotice ? `<div style="margin-top: 5px;"><a href="requirements.html" style="display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 700; color: #0284c7; text-decoration: none;"><i class="fas fa-cloud-arrow-up"></i> Upload Document &rarr;</a></div>` : ''}
                    <div class="notif-time">${notif.time}</div>
                </div>
                ${!notif.read ? `<button type="button" class="mark-read-btn" data-id="${notif.id}" title="Mark as read"><i class="fas fa-check"></i></button>` : ''}
            </div>
            `;
        }).join('');
        
        // Click on entire notification item to mark read and reduce count
        document.querySelectorAll('.notif-item').forEach(item => {
            item.addEventListener('click', async function(e) {
                if (e.target.closest('a') || e.target.closest('.mark-read-btn')) return;
                const notifId = this.dataset.id;
                if (this.classList.contains('unread')) {
                    this.classList.remove('unread');
                    this.classList.add('read');
                    const btn = this.querySelector('.mark-read-btn');
                    if (btn) btn.remove();
                    const unread = document.querySelectorAll('.notif-item.unread').length;
                    updateNotificationCount(unread);
                    try { await supabase.from('notifications').update({ read: true, is_read: true }).eq('id', notifId); } catch(e) {}
                }
            });
        });

        document.querySelectorAll('.mark-read-btn').forEach(btn => {
            btn.addEventListener('click', async function(e) {
                e.stopPropagation();
                const notifId = this.dataset.id;
                const item = this.closest('.notif-item');
                item.classList.remove('unread');
                item.classList.add('read');
                this.remove();
                const unread = document.querySelectorAll('.notif-item.unread').length;
                updateNotificationCount(unread);

                // Update in Supabase if not a string id
                try {
                    await supabase.from('notifications').update({ read: true, is_read: true }).eq('id', notifId);
                } catch(e) {}

                // Update local storage
                if (validUids) {
                    validUids.forEach(id => {
                        try {
                            const k = `hes_notifications_${id}`;
                            const raw = localStorage.getItem(k);
                            if (raw) {
                                const list = JSON.parse(raw);
                                list.forEach(n => {
                                    if (String(n.id) === String(notifId)) n.read = true;
                                });
                                localStorage.setItem(k, JSON.stringify(list));
                            }
                        } catch(e) {}
                    });
                }
            });
        });
    }

    function updateNotificationCount(count) {
        if (!notifCount) return;
        if (count > 0) {
            notifCount.textContent = count > 99 ? '99+' : String(count);
            notifCount.classList.remove('empty');
            notifCount.style.display = 'flex';
        } else {
            notifCount.textContent = '';
            notifCount.classList.add('empty');
            notifCount.style.display = 'none';
        }
    }

    // ============================================
    // NOTIFICATION DROPDOWN
    // ============================================

    if (notifBtn) {
        notifBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (notifDropdown) {
                notifDropdown.classList.toggle('show');
            }
        });
    }

    document.addEventListener('click', function(e) {
        if (notifDropdown && notifBtn) {
            if (!notifDropdown.contains(e.target) && !notifBtn.contains(e.target)) {
                notifDropdown.classList.remove('show');
            }
        }
    });

    if (markAllBtn) {
        markAllBtn.addEventListener('click', async function() {
            document.querySelectorAll('.notif-item.unread').forEach(item => {
                item.classList.remove('unread');
                item.classList.add('read');
                const btn = item.querySelector('.mark-read-btn');
                if (btn) btn.remove();
            });
            updateNotificationCount(0);

            const uid = sessionUser?.uid || sessionUser?.id || currentStudentRow?.id;
            if (uid) {
                try {
                    await supabase.from('notifications').update({ read: true, is_read: true }).eq('user_id', uid);
                } catch(e) {}
                try {
                    const k = `hes_notifications_${uid}`;
                    const raw = localStorage.getItem(k);
                    if (raw) {
                        const list = JSON.parse(raw);
                        list.forEach(n => n.read = true);
                        localStorage.setItem(k, JSON.stringify(list));
                    }
                } catch(e) {}
            }
        });
    }

    // Real-time synchronization when registrar or system posts a new notification
    window.addEventListener('storage', function(e) {
        if (e.key && (e.key.startsWith('hes_notifications') || e.key === 'hes_latest_notification')) {
            loadNotifications();
        }
    });

    window.addEventListener('focus', function() {
        loadNotifications();
    });

    // Initialize sequentially
    async function init() {
        await loadDashboardData();
        await loadNotifications();
    }
    init();

})();