/**
 * Parents Attendance - Supabase Integration
 * HES - HES, Hiraya Enrollment System
 * Matching Student Attendance Design & Filtering with Child Name Visibility
 */

import { supabase } from '../../supabase/config.js';

(function() {
    'use strict';

    console.log('📅 Parents Attendance (With Child Name) ready');

    // ============================================
    // DOM ELEMENTS
    // ============================================

    // Profile & Header
    const sidebarParentName = document.getElementById('sidebarParentName');
    const parentInitial = document.getElementById('parentInitial');
    const logoutBtn = document.getElementById('logoutBtn');
    const currentDateDisplay = document.getElementById('currentDateDisplay');

    // Child Info Card
    const studentNameDisplay = document.getElementById('studentNameDisplay');
    const lrnDisplay = document.getElementById('lrnDisplay');
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
    const studentFilter = document.getElementById('studentFilter');
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
    let registeredChildren = [];
    let enrollmentsMap = {};

    // ============================================
    // SESSION CHECK
    // ============================================

    let sessionUser = null;
    try {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            sessionUser = JSON.parse(stored);
        }
    } catch(e) {}

    if (!sessionUser) {
        window.location.replace('../auth/login.html');
        return;
    }

    if (sessionUser.role && sessionUser.role !== 'parent') {
        const routes = {
            'admin': '../admin/dashboard.html',
            'teacher': '../teacher/dashboard.html',
            'student': '../student/dashboard.html',
            'registrar': '../registrar/dashboard.html'
        };
        window.location.replace(routes[sessionUser.role] || '../auth/login.html');
        return;
    }

    // Set Parent Name & Initial
    let parentDisplayName = (sessionUser.firstName ? `${sessionUser.firstName} ${sessionUser.lastName || ''}`.trim() : (sessionUser.email ? sessionUser.email.split('@')[0] : 'Parent'));
    if (!parentDisplayName || parentDisplayName.toLowerCase() === 'parent') {
        parentDisplayName = sessionUser.lastName ? `Mr. & Mrs. ${sessionUser.lastName}` : 'Parent Guardian';
    }

    if (sidebarParentName) sidebarParentName.textContent = parentDisplayName;
    if (parentInitial) parentInitial.textContent = parentDisplayName.charAt(0).toUpperCase();

    // Set Header Date
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

    // Preserved shared attendance stores across portals

    // ============================================
    // LOGOUT
    // ============================================

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            localStorage.removeItem('currentUser');
            localStorage.removeItem('hes_parent_avatar');
            localStorage.removeItem('hes_parent_name');
            try {
                await supabase.auth.signOut();
            } catch(err) {}
            window.location.replace('../auth/login.html');
        });
    }

    // ============================================
    // UTILITY HELPERS
    // ============================================

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

    // ============================================
    // LOAD CHILDREN & ATTENDANCE DATA FROM SUPABASE
    // ============================================

    async function loadAttendanceModule() {
        try {
            const userLastName = sessionUser.lastName || '';
            const userEmail = sessionUser.email || '';

            // 1. Fetch Students from Supabase
            let students = [];
            try {
                let query = supabase.from('students').select('*');
                if (userEmail && userLastName) {
                    query = query.or(`email.ilike.%${userLastName}%,last_name.ilike.%${userLastName}%,parent_name.ilike.%${userLastName}%`);
                } else if (userLastName) {
                    query = query.or(`last_name.ilike.%${userLastName}%,parent_name.ilike.%${userLastName}%`);
                }
                const { data: sData, error: sErr } = await query;
                if (!sErr && sData && sData.length > 0) {
                    students = sData;
                }
            } catch(e) {}

            if (students.length === 0) {
                try {
                    const { data: fallbackStudents } = await supabase.from('students').select('*').limit(3);
                    if (fallbackStudents && fallbackStudents.length > 0) {
                        students = fallbackStudents;
                    }
                } catch(e) {}
            }

            registeredChildren = students.map(s => ({
                id: s.id,
                name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Student',
                lrn: s.lrn || '',
                grade: s.grade_level || 'Grade 11',
                strand: s.strand || (s.grade_level?.includes('11') || s.grade_level?.includes('12') ? 'TVL-ICT' : 'Junior High'),
                section: s.section || 'Section A',
                schoolYear: '2025-2026',
                status: 'Approved'
            }));

            // 2. Fetch Enrollments
            const studentIds = registeredChildren.map(c => c.id);
            try {
                if (studentIds.length > 0) {
                    const { data: enrData } = await supabase
                        .from('enrollments')
                        .select('*')
                        .in('student_id', studentIds);
                    if (enrData) {
                        enrData.forEach(e => {
                            enrollmentsMap[e.student_id] = e;
                            const matchedChild = registeredChildren.find(c => c.id === e.student_id);
                            if (matchedChild) {
                                if (e.lrn) matchedChild.lrn = e.lrn;
                                if (e.grade_level || e.grade) matchedChild.grade = e.grade_level || e.grade;
                                if (e.strand) matchedChild.strand = e.strand;
                                if (e.section) matchedChild.section = e.section;
                                if (e.school_year || e.schoolYear) matchedChild.schoolYear = e.school_year || e.schoolYear;
                                if (e.status) matchedChild.status = e.status.charAt(0).toUpperCase() + e.status.slice(1);
                            }
                        });
                    }
                }
            } catch(e) {}

            // Populate Student Dropdown
            populateStudentDropdown(registeredChildren);

            // 3. Fetch Attendance records from Supabase & Teacher Shared Stores
            let records = [];
            try {
                if (studentIds.length > 0) {
                    const { data: attData, error: attErr } = await supabase
                        .from('attendance')
                        .select('*')
                        .in('student_id', studentIds)
                        .order('date', { ascending: false });
                    if (!attErr && Array.isArray(attData) && attData.length > 0) {
                        records = attData.map(r => {
                            const child = registeredChildren.find(c => String(c.id) === String(r.student_id));
                            return {
                                ...r,
                                student_name: child?.name || 'Student',
                                grade: child?.grade || '',
                                lrn: child?.lrn || ''
                            };
                        });
                    }
                }
            } catch(e) {
                console.warn('Attendance database query notice:', e);
            }

            // Load shared teacher-scanned attendance records for children
            try {
                const sharedList = [];
                const norm = v => (v || '').toString().toLowerCase().trim();
                const childIdSet = new Set(registeredChildren.map(c => norm(c.id)));
                const childLrnSet = new Set(registeredChildren.map(c => norm(c.lrn)).filter(Boolean));
                const childNameSet = new Set(registeredChildren.map(c => norm(c.name)).filter(Boolean));

                function matchesChild(rec) {
                    if (!rec) return false;
                    const rId = norm(rec.student_id || rec.studentId || rec.id);
                    const rLrn = norm(rec.lrn);
                    const rName = norm(rec.student_name || rec.name || rec.studentName || rec.full_name);

                    if (rId && childIdSet.has(rId)) return true;
                    if (rLrn && childLrnSet.has(rLrn)) return true;
                    if (rName) {
                        for (const cName of childNameSet) {
                            if (!cName) continue;
                            if (rName === cName || rName.includes(cName) || cName.includes(rName)) return true;
                            const parts = cName.split(/\s+/).filter(Boolean);
                            if (parts.length >= 2) {
                                const flipped = `${parts[parts.length - 1]}, ${parts.slice(0, -1).join(' ')}`;
                                const reversed = `${parts[parts.length - 1]} ${parts.slice(0, -1).join(' ')}`;
                                if (rName.includes(flipped) || flipped.includes(rName) || rName.includes(reversed)) return true;
                            }
                        }
                    }
                    return false;
                }

                const centralRaw = localStorage.getItem('hes_attendance_records');
                if (centralRaw) {
                    const list = JSON.parse(centralRaw);
                    if (Array.isArray(list)) list.forEach(r => { if (matchesChild(r)) sharedList.push(r); });
                }

                const hesStuRaw = localStorage.getItem('hes_student_attendance');
                if (hesStuRaw) {
                    const list = JSON.parse(hesStuRaw);
                    if (Array.isArray(list)) list.forEach(r => { if (matchesChild(r)) sharedList.push(r); });
                }

                registeredChildren.forEach(c => {
                    [norm(c.id), norm(c.lrn), norm(c.name)].filter(Boolean).forEach(key => {
                        const direct = localStorage.getItem(`hes_student_attendance_${key}`);
                        if (direct) {
                            const dObj = JSON.parse(direct);
                            if (Array.isArray(dObj)) dObj.forEach(r => { if (matchesChild(r) || !r.student_id) sharedList.push(r); });
                            else if (dObj && typeof dObj === 'object') {
                                if (matchesChild(dObj) || !dObj.student_id) sharedList.push(dObj);
                            }
                        }
                    });
                });

                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && (k.startsWith('hes_qr_scans_') || k === 'todayScans')) {
                        const sData = JSON.parse(localStorage.getItem(k) || '[]');
                        if (Array.isArray(sData)) {
                            sData.forEach(r => {
                                if (matchesChild(r)) {
                                    sharedList.push({
                                        id: r.id,
                                        student_id: r.studentId || r.student_id,
                                        lrn: r.lrn,
                                        student_name: r.name || r.student_name,
                                        date: r.date,
                                        status: r.status,
                                        time_in: r.time || r.time_in,
                                        qr_code: r.qr_code || r.qrCode || r.rawQr || '',
                                        remarks: r.remarks || (r.status === 'Late' ? 'Late arrival recorded via QR Scanner' : 'On-time QR scan')
                                    });
                                }
                            });
                        }
                    }
                }

                // Merge into records map
                const map = new Map();
                records.forEach(r => {
                    if (r?.date) {
                        const clean = (r.status || 'present').charAt(0).toUpperCase() + (r.status || 'present').slice(1).toLowerCase();
                        map.set(`${r.student_id}_${r.date}`, { ...r, status: clean, time_in: r.time_in || r.timeIn || null });
                    }
                });
                sharedList.forEach(r => {
                    if (r?.date) {
                        const stuId = r.student_id || r.studentId || registeredChildren[0]?.id;
                        const child = registeredChildren.find(c => String(c.id) === String(stuId) || (c.lrn && String(c.lrn) === String(r.lrn)));
                        const clean = (r.status || 'Present').charAt(0).toUpperCase() + (r.status || 'Present').slice(1).toLowerCase();
                        const key = `${child?.id || stuId}_${r.date}`;
                        const existing = map.get(key) || {};
                        map.set(key, {
                            ...existing,
                            ...r,
                            student_id: child?.id || stuId,
                            student_name: child?.name || r.student_name || r.name || 'Student',
                            grade: child?.grade || r.grade_level || '',
                            lrn: child?.lrn || r.lrn || '',
                            status: clean,
                            time_in: r.time_in || r.time || existing.time_in || null,
                            remarks: r.remarks || existing.remarks || ''
                        });
                    }
                });

                records = Array.from(map.values()).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
            } catch (e) {}

            const childNames = registeredChildren.map(c => c.name).join(', ') || 'No registered children';
            const attendanceChildBanner = document.getElementById('attendanceChildBanner');
            if (attendanceChildBanner) attendanceChildBanner.textContent = childNames;

            const sidebarChildName = document.getElementById('sidebarChildName');
            if (sidebarChildName) sidebarChildName.textContent = registeredChildren[0]?.name || 'Student';

            if (registeredChildren.length > 0) {
                localStorage.setItem('hes_parent_child_name', childNames);
            }

            rawAttendanceRecords = records;
            updateChildInfoCard();
            applyFilters();

        } catch (error) {
            console.error('❌ Error initializing parents attendance:', error);
            applyFilters();
        }
    }

    // ============================================
    // POPULATE STUDENT DROPDOWN
    // ============================================

    function populateStudentDropdown(children) {
        if (!studentFilter) return;

        let optionsHtml = '<option value="all">All Children</option>';
        children.forEach(c => {
            optionsHtml += `<option value="${c.id}">${c.name} (${c.grade || '—'} - ${c.strand || '—'})</option>`;
        });
        studentFilter.innerHTML = optionsHtml;
    }

    // ============================================
    // UPDATE CHILD INFO CARD
    // ============================================

    function updateChildInfoCard() {
        const selId = studentFilter ? studentFilter.value : 'all';
        const attendanceChildBanner = document.getElementById('attendanceChildBanner');

        if (selId === 'all') {
            const firstChild = registeredChildren[0];
            const childNames = registeredChildren.map(c => c.name).join(', ');
            if (studentNameDisplay) studentNameDisplay.textContent = registeredChildren.length > 0 ? childNames : 'All Children';
            if (lrnDisplay) lrnDisplay.textContent = firstChild?.lrn || (registeredChildren.length > 1 ? 'Multiple' : '—');
            if (gradeDisplay) gradeDisplay.textContent = firstChild?.grade || '—';
            if (strandDisplay) strandDisplay.textContent = firstChild?.strand || '—';
            if (statusDisplay) statusDisplay.textContent = firstChild?.status || 'Enrolled';
            if (schoolYearDisplay) schoolYearDisplay.textContent = firstChild?.schoolYear || '2025-2026';
            if (attendanceChildBanner && childNames) attendanceChildBanner.textContent = childNames;
            if (todayDateSubtitle) {
                const subLabel = registeredChildren.length === 1 ? registeredChildren[0].name : (registeredChildren.length > 1 ? `${registeredChildren.map(c => c.name).join(', ')}` : 'All Children');
                todayDateSubtitle.textContent = `${subLabel} • ${today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
            }
        } else {
            const child = registeredChildren.find(c => String(c.id) === String(selId));
            if (child) {
                if (studentNameDisplay) studentNameDisplay.textContent = child.name;
                if (lrnDisplay) lrnDisplay.textContent = child.lrn || '—';
                if (gradeDisplay) gradeDisplay.textContent = child.grade || '—';
                if (strandDisplay) strandDisplay.textContent = child.strand || '—';
                if (statusDisplay) statusDisplay.textContent = child.status || 'Enrolled';
                if (schoolYearDisplay) schoolYearDisplay.textContent = child.schoolYear || '2025-2026';
                if (attendanceChildBanner) attendanceChildBanner.textContent = child.name;
                if (todayDateSubtitle) {
                    todayDateSubtitle.textContent = `${child.name} • ${today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
                }
            }
        }
    }

    // ============================================
    // FILTER & RENDER
    // ============================================

    function applyFilters() {
        const selStudent = studentFilter ? studentFilter.value : 'all';
        const monthVal = monthFilter ? monthFilter.value : 'all';
        const statusVal = statusFilter ? statusFilter.value : 'all';
        const searchVal = attendanceSearch ? attendanceSearch.value.trim().toLowerCase() : '';

        const currentMonthIdx = new Date().getMonth();

        filteredRecords = rawAttendanceRecords.filter(record => {
            // Student Filter
            if (selStudent !== 'all' && String(record.student_id) !== String(selStudent)) {
                return false;
            }

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
                const studentFmt = (record.student_name || '').toLowerCase();
                const remarksFmt = (record.remarks || '').toLowerCase();
                const statusFmt = (record.status || '').toLowerCase();
                if (!dateFmt.includes(searchVal) && !dayFmt.includes(searchVal) && !studentFmt.includes(searchVal) && !remarksFmt.includes(searchVal) && !statusFmt.includes(searchVal)) {
                    return false;
                }
            }

            return true;
        });

        // Compute stats for currently selected student scope
        const scopeRecords = selStudent === 'all' ? rawAttendanceRecords : rawAttendanceRecords.filter(r => String(r.student_id) === String(selStudent));

        renderStats(scopeRecords);
        renderTodayHighlight(scopeRecords);
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
        const todayStr = now.toISOString().split('T')[0];
        const todayRecord = records.find(r => r.date === todayStr);

        // 1. If today has an authentic attendance log for this child, display it immediately!
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
            if (todaySessionValue) todaySessionValue.textContent = todayRecord.student_name || 'Your Child';
            if (todaySessionSub) todaySessionSub.textContent = todayRecord.teacher_name ? `Recorded by Teacher ${todayRecord.teacher_name}` : 'Recorded by Class Adviser';
            if (todayRemarks) todayRemarks.textContent = todayRecord.remarks || (stLower === 'late' ? 'Late arrival recorded.' : 'Present in class.');
            return;
        }

        // 2. Only if no attendance was recorded today, check weekend
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

        if (todayStatusBadgeContainer) {
            todayStatusBadgeContainer.innerHTML = `<span class="status-badge status-pending"><i class="fas fa-clock"></i> Not Yet Recorded Today</span>`;
        }
        if (todayStandingText) todayStandingText.textContent = 'Not Yet Recorded';
        if (todayStandingSub) todayStandingSub.textContent = 'Awaiting adviser roll call';
        if (todaySessionValue) todaySessionValue.textContent = 'Regular School Day';
        if (todaySessionSub) todaySessionSub.textContent = 'Morning & Afternoon Classes';
        if (todayRemarks) todayRemarks.textContent = 'Attendance has not been recorded by the teacher for today yet.';
        return;

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
        if (todayStandingSub) todayStandingSub.textContent = 'Official DepEd attendance log';
        if (todaySessionValue) todaySessionValue.textContent = 'Regular School Day';
        if (todaySessionSub) todaySessionSub.textContent = 'Marked by Class Adviser';
        if (todayRemarks) todayRemarks.textContent = todayRecord.remarks || 'Present in class.';
    }

    // ============================================
    // RENDER TABLE WITH CHILD NAME COLUMN
    // ============================================

    function renderTable(records) {
        if (!attendanceTableBody) return;

        const selStudent = studentFilter ? studentFilter.value : 'all';
        let studentScopeName = 'all children';
        if (selStudent !== 'all') {
            const matchedChild = registeredChildren.find(c => String(c.id) === String(selStudent));
            if (matchedChild) studentScopeName = matchedChild.name;
        }

        if (recordCountBadge) {
            recordCountBadge.textContent = `Showing ${records.length} of ${rawAttendanceRecords.length} records`;
        }

        if (records.length === 0) {
            attendanceTableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        <i class="fas fa-calendar-times"></i>
                        <h4>No Attendance Records Found</h4>
                        <p>No attendance logs match your selected filter criteria for ${studentScopeName}.</p>
                    </td>
                </tr>
            `;
            return;
        }

        attendanceTableBody.innerHTML = records.map(item => {
            const dateFmt = formatDate(item.date);
            const dayFmt = getDayOfWeek(item.date);
            const timeInFmt = formatTime(item.time_in || item.timeIn);
            const timeOutFmt = formatTime(item.time_out || item.timeOut);
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

            const qrBadgeHtml = (item.qr_code || (item.remarks && item.remarks.includes('QR')))
                ? `<div style="display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 600; background: #e0e7ff; color: #4338ca; border-radius: 4px; padding: 2px 6px; margin-top: 4px;" title="Scanned & verified via Student ID QR Code: ${item.qr_code || 'QR Verified'}"><i class="fas fa-qrcode"></i> QR Verified</div>`
                : '';
            const teacherNote = item.teacher_name 
                ? `<div style="font-size: 11px; color: #0284c7; margin-top: 4px; font-weight: 500;"><i class="fas fa-chalkboard-teacher"></i> Recorded by: Teacher ${item.teacher_name}</div>` 
                : `<div style="font-size: 11px; color: #64748b; margin-top: 4px;"><i class="fas fa-user-check"></i> Recorded with Teacher</div>`;
            const baseRemarks = item.remarks ? item.remarks : (stLower === 'present' ? 'On time' : '—');
            const remarksFmt = `<div>${baseRemarks}</div>${teacherNote}`;

            return `
                <tr>
                    <td class="date-cell"><i class="far fa-calendar text-primary" style="margin-right: 6px;"></i> ${dateFmt}</td>
                    <td class="student-cell" style="font-weight: 700; color: #0b2b4a; white-space: nowrap;">
                        <i class="fas fa-user-graduate" style="color: #0B4F2E; margin-right: 6px;"></i> ${item.student_name || 'Student'}
                    </td>
                    <td class="day-cell">${dayFmt}</td>
                    <td>
                        <span class="status-badge ${badgeClass}">
                            <i class="fas ${icon}"></i> ${status}
                        </span>
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
        csvContent += 'Date,Student Name,Day,Status,Remarks\r\n';

        filteredRecords.forEach(r => {
            const dateFmt = formatDate(r.date);
            const dayFmt = getDayOfWeek(r.date);
            const studentFmt = `"${(r.student_name || 'Student').replace(/"/g, '""')}"`;
            const st = r.status || 'Present';
            const rem = `"${(r.remarks || '').replace(/"/g, '""')}"`;
            csvContent += `${dateFmt},${studentFmt},${dayFmt},${st},${rem}\r\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `HES_Attendance_${parentDisplayName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showAlert('Attendance exported successfully as CSV!', 'success');
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================

    if (studentFilter) {
        studentFilter.addEventListener('change', () => {
            updateChildInfoCard();
            applyFilters();
        });
    }

    if (monthFilter) monthFilter.addEventListener('change', applyFilters);
    if (statusFilter) statusFilter.addEventListener('change', applyFilters);
    if (attendanceSearch) attendanceSearch.addEventListener('input', applyFilters);

    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
            if (studentFilter) studentFilter.value = 'all';
            if (monthFilter) monthFilter.value = 'all';
            if (statusFilter) statusFilter.value = 'all';
            if (attendanceSearch) attendanceSearch.value = '';
            updateChildInfoCard();
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
            console.log('🔄 Live attendance event detected, refreshing parent attendance view...');
            loadAttendanceRecords();
        }
    });

    window.addEventListener('focus', () => {
        loadAttendanceRecords();
    });

    // Init
    loadAttendanceModule();

})();