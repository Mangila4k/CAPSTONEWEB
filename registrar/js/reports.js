/**
 * Reports - Interactive JavaScript (Supabase Integrated)
 * Live data querying and generation
 */

import { supabase } from '../../supabase/config.js';

(async function() {
    'use strict';

    console.log('📊 Reports page initializing with Supabase...');

    // ============================================
    // DOM ELEMENTS
    // ============================================

    const adminName = document.getElementById('adminName');
    const adminInitial = document.getElementById('adminInitial');
    const logoutBtn = document.getElementById('logoutBtn');
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const alertContainer = document.getElementById('alertContainer');

    // Stats
    const totalStudentsEl = document.getElementById('totalStudents');
    const totalEnrollmentsEl = document.getElementById('totalEnrollments');
    const enrolledCountEl = document.getElementById('enrolledCount');
    const monthlyCountEl = document.getElementById('monthlyCount');
    const pendingBadge = document.getElementById('pendingEnrollmentsBadge');

    // Report elements
    const reportForm = document.getElementById('reportForm');
    const reportType = document.getElementById('reportType');
    const dateFrom = document.getElementById('dateFrom');
    const dateTo = document.getElementById('dateTo');
    const gradeFilter = document.getElementById('gradeFilter');
    const statusFilter = document.getElementById('statusFilter');
    const reportTitle = document.getElementById('reportTitle');
    const dateRange = document.getElementById('dateRange');
    const reportHead = document.getElementById('reportHead');
    const reportBody = document.getElementById('reportBody');
    const reportFoot = document.getElementById('reportFoot');
    const exportExcelBtn = document.getElementById('exportExcelBtn');
    const printBtn = document.getElementById('printBtn');

    // Printable Document Elements
    const levelFilter = document.getElementById('levelFilter');
    const strandFilter = document.getElementById('strandFilter');
    const strandFilterGroup = document.getElementById('strandFilterGroup');
    const printDocDept = document.getElementById('printDocDept');
    const reportLevelTabs = document.getElementById('reportLevelTabs');
    const badgeAllCount = document.getElementById('badgeAllCount');
    const badgeJhsCount = document.getElementById('badgeJhsCount');
    const badgeShsCount = document.getElementById('badgeShsCount');
    const printReportTitle = document.getElementById('printReportTitle');
    const printDatePeriod = document.getElementById('printDatePeriod');
    const printGeneratedDate = document.getElementById('printGeneratedDate');
    const printRegistrarName = document.getElementById('printRegistrarName');
    const signRegistrarName = document.getElementById('signRegistrarName');
    let currentRegistrarDisplayName = 'Registrar';

    // ============================================
    // SESSION & PROFILE
    // ============================================

    try {
        const currentUserStr = localStorage.getItem('currentUser');
        if (currentUserStr) {
            const user = JSON.parse(currentUserStr);
            const name = user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (user.displayName || (user.email ? user.email.split('@')[0] : 'Registrar'));
            if (adminName) adminName.textContent = name;
            if (adminInitial) adminInitial.textContent = name.charAt(0).toUpperCase();
        } else {
            const storedName = localStorage.getItem('registrarName') || 'Registrar';
            if (adminName) adminName.textContent = storedName;
            if (adminInitial) adminInitial.textContent = storedName.charAt(0).toUpperCase();
        }
    } catch(e) {}

    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            console.log('🚪 Registrar logging out...');
            localStorage.removeItem('currentUser');
            localStorage.removeItem('registrarName');
            localStorage.removeItem('hes_registrar_avatar');
            localStorage.removeItem('hes_registrar_name');
            try {
                await supabase.auth.signOut();
            } catch(err) {}
            window.location.replace('../auth/login.html');
        });
    }

    // Set Current Date Badge
    const dateBadge = document.getElementById('dateBadge');
    if (dateBadge) {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateBadge.innerHTML = `<i class="fas fa-calendar-alt"></i> ${now.toLocaleDateString('en-US', options)}`;
    }

    // Mobile Menu Toggle
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
        });

        document.addEventListener('click', function(e) {
            if (window.innerWidth <= 768) {
                if (!sidebar.contains(e.target) && e.target !== menuToggle) {
                    sidebar.classList.remove('active');
                }
            }
        });
    }

    function getDefaultDateFrom() {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        return date.toISOString().split('T')[0];
    }

    function getDefaultDateTo() {
        return new Date().toISOString().split('T')[0];
    }

    // ============================================
    // LOAD STATS
    // ============================================

    async function loadStats() {
        try {
            const [
                { count: totalStCount },
                { count: totalEnCount },
                { count: approvedCount },
                { count: pendingCount }
            ] = await Promise.all([
                supabase.from('students').select('*', { count: 'exact', head: true }),
                supabase.from('enrollments').select('*', { count: 'exact', head: true }),
                supabase.from('enrollments').select('*', { count: 'exact', head: true }).or('status.ilike.enrolled,status.ilike.approved,status.eq.approved,status.eq.enrolled'),
                supabase.from('enrollments').select('*', { count: 'exact', head: true }).or('status.ilike.pending,status.eq.Pending,status.eq.pending')
            ]);

            // Monthly enrollments (this calendar month)
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            const { count: monthlyEnCount } = await supabase
                .from('enrollments')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', startOfMonth);

            if (totalStudentsEl) totalStudentsEl.textContent = totalStCount || 0;
            if (totalEnrollmentsEl) totalEnrollmentsEl.textContent = totalEnCount || 0;
            if (enrolledCountEl) enrolledCountEl.textContent = approvedCount || 0;
            if (monthlyCountEl) monthlyCountEl.textContent = monthlyEnCount || 0;

            if (pendingBadge) {
                if (pendingCount && pendingCount > 0) {
                    pendingBadge.textContent = pendingCount;
                    pendingBadge.style.display = 'inline-flex';
                } else {
                    pendingBadge.style.display = 'none';
                }
            }
        } catch(err) {
            console.warn('Error loading stats for reports:', err);
        }
    }

    // ============================================
    // POPULATE GRADE FILTER
    // ============================================

        // Helper functions for JHS vs SHS separation
    function isJhs(grade) {
        if (!grade) return false;
        const g = grade.toString().toLowerCase();
        return g.includes('7') || g.includes('8') || g.includes('9') || g.includes('10') || g.includes('jhs') || g.includes('junior');
    }

    function isShs(grade) {
        if (!grade) return false;
        const g = grade.toString().toLowerCase();
        return g.includes('11') || g.includes('12') || g.includes('shs') || g.includes('senior');
    }

    function populateGradeFilter(selectedLevel = 'all') {
        if (!gradeFilter) return;
        const currentVal = gradeFilter.value;
        gradeFilter.innerHTML = '';

        if (selectedLevel === 'jhs') {
            gradeFilter.innerHTML = `
                <option value="">All JHS Grades (Grades 7–10)</option>
                <option value="Grade 7">Grade 7</option>
                <option value="Grade 8">Grade 8</option>
                <option value="Grade 9">Grade 9</option>
                <option value="Grade 10">Grade 10</option>
            `;
            if (strandFilterGroup) strandFilterGroup.style.display = 'none';
        } else if (selectedLevel === 'shs') {
            gradeFilter.innerHTML = `
                <option value="">All SHS Grades (Grades 11–12)</option>
                <option value="Grade 11">Grade 11</option>
                <option value="Grade 12">Grade 12</option>
            `;
            if (strandFilterGroup) strandFilterGroup.style.display = 'block';
        } else {
            gradeFilter.innerHTML = `
                <option value="">All Grades</option>
                <optgroup label="Junior High School">
                    <option value="Grade 7">Grade 7</option>
                    <option value="Grade 8">Grade 8</option>
                    <option value="Grade 9">Grade 9</option>
                    <option value="Grade 10">Grade 10</option>
                </optgroup>
                <optgroup label="Senior High School">
                    <option value="Grade 11">Grade 11</option>
                    <option value="Grade 12">Grade 12</option>
                </optgroup>
            `;
            if (strandFilterGroup) strandFilterGroup.style.display = 'block';
        }

        if (currentVal && gradeFilter.querySelector(`option[value="${currentVal}"]`)) {
            gradeFilter.value = currentVal;
        }
    }

    function setActiveTab(level) {
        document.querySelectorAll('.level-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.level === level);
        });
    }

    // Tab click handlers
    document.querySelectorAll('.level-tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const lvl = this.dataset.level || 'all';
            if (levelFilter) levelFilter.value = lvl;
            populateGradeFilter(lvl);
            setActiveTab(lvl);
            generateReport();
        });
    });

    if (levelFilter) {
        levelFilter.addEventListener('change', function() {
            const lvl = this.value || 'all';
            populateGradeFilter(lvl);
            setActiveTab(lvl);
            generateReport();
        });
    }

    // ============================================
    // GENERATE REPORT (FROM SUPABASE)
    // ============================================

    let currentReportRows = [];
    let currentHeaders = [];

    async function generateReport() {
        const fromVal = (dateFrom && dateFrom.value) ? dateFrom.value : getDefaultDateFrom();
        const toVal = (dateTo && dateTo.value) ? dateTo.value : getDefaultDateTo();
        const type = (reportType && reportType.value) || 'enrollment_summary';
        const levelVal = (levelFilter && levelFilter.value) || 'all';
        const gradeVal = (gradeFilter && gradeFilter.value) || '';
        const strandVal = (strandFilter && strandFilter.value) || '';
        const statusVal = (statusFilter && statusFilter.value) || '';

        // Format dates
        const fromDate = new Date(fromVal + 'T00:00:00');
        const toDate = new Date(toVal + 'T23:59:59');
        const dateRangeFormatted = `${fromDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${toDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

        // Display date range
        if (dateRange) {
            dateRange.innerHTML = `<i class="fas fa-calendar-alt"></i> Report Period: ${dateRangeFormatted}`;
        }

        // Update printable header & signatories metadata
        if (printRegistrarName) printRegistrarName.textContent = currentRegistrarDisplayName;
        if (signRegistrarName) signRegistrarName.textContent = currentRegistrarDisplayName.toUpperCase();
        if (printDatePeriod) printDatePeriod.textContent = dateRangeFormatted;
        if (printGeneratedDate) {
            const now = new Date();
            printGeneratedDate.textContent = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        }

        // Loading UI
        if (reportHead) reportHead.innerHTML = '<tr><th>Loading columns...</th></tr>';
        if (reportBody) {
            reportBody.innerHTML = `
                <tr>
                    <td>
                        <div class="no-data" style="text-align: center; padding: 30px;">
                            <i class="fas fa-spinner fa-spin" style="font-size: 24px; color: #1B2A4A; margin-bottom: 8px;"></i>
                            <p>Querying Supabase database...</p>
                        </div>
                    </td>
                </tr>
            `;
        }
        if (reportFoot) reportFoot.innerHTML = '';

        try {
            // SPECIAL REPORT TYPE: System Activities & Audit Logs
            if (type === 'system_activities') {
                if (reportTitle) reportTitle.textContent = 'Recent Activities & Audit Logs';
                if (printReportTitle) printReportTitle.textContent = 'OFFICIAL RECENT ACTIVITIES & AUDIT LOGS REPORT';
                if (printDocDept) printDocDept.textContent = 'INSTITUTIONAL AUDIT TRAIL & SYSTEM ACTIVITIES';

                let actQuery = supabase
                    .from('activity_logs')
                    .select('*')
                    .order('timestamp', { ascending: false });

                if (fromVal) actQuery = actQuery.gte('timestamp', `${fromVal}T00:00:00`);
                if (toVal) actQuery = actQuery.lte('timestamp', `${toVal}T23:59:59`);

                const { data: actLogs, error: actErr } = await actQuery;
                if (actErr) throw actErr;

                let activities = actLogs || [];
                currentHeaders = ['#', 'Date & Time', 'Role', 'Action / Activity', 'Details & Notes'];
                currentReportRows = [];

                if (activities.length === 0) {
                    if (reportHead) reportHead.innerHTML = '<tr><th>No Activity Logs Found</th></tr>';
                    if (reportBody) {
                        reportBody.innerHTML = `
                            <tr>
                                <td>
                                    <div class="no-data">
                                        <i class="fas fa-stream"></i>
                                        <h3>No Activities Found</h3>
                                        <p>No activity records logged during the selected date period.</p>
                                    </div>
                                </td>
                            </tr>
                        `;
                    }
                    if (reportFoot) reportFoot.innerHTML = '';
                    return;
                }

                let html = '';
                activities.forEach((item, index) => {
                    const dt = item.timestamp ? new Date(item.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';
                    const role = (item.role || 'system').toLowerCase();
                    const action = item.action || 'Logged Activity';
                    const details = item.details || '—';

                    currentReportRows.push([index + 1, dt, role.toUpperCase(), action, details]);
                    const roleClass = role === 'admin' ? 'status-pill-enrolled' : (role === 'teacher' ? 'status-pill-pending' : 'status-pill-enrolled');

                    html += `
                        <tr>
                            <td class="col-num">${index + 1}</td>
                            <td class="col-date"><span class="report-date-cell"><i class="far fa-calendar-alt"></i> ${dt}</span></td>
                            <td class="col-status"><span class="status-pill ${roleClass}">${role.toUpperCase()}</span></td>
                            <td class="col-name"><strong style="color: #0b2b4a;">${action}</strong></td>
                            <td class="col-school"><span class="report-school-cell" title="${details}">${details}</span></td>
                        </tr>
                    `;
                });

                if (reportHead) {
                    reportHead.innerHTML = `
                        <tr>
                            <th class="col-num">#</th>
                            <th class="col-date">Date & Time</th>
                            <th class="col-status">Role</th>
                            <th class="col-name">Action / Activity</th>
                            <th class="col-school">Details & Description</th>
                        </tr>
                    `;
                }
                if (reportBody) reportBody.innerHTML = html;
                if (reportFoot) {
                    reportFoot.innerHTML = `
                        <tr class="report-footer-row">
                            <td colspan="${currentHeaders.length}">
                                <div class="report-footer-bar">
                                    <div class="report-footer-left">
                                        <span class="report-total-badge">
                                            <i class="fas fa-stream"></i> Total Recorded Activities: <strong>${activities.length}</strong>
                                        </span>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    `;
                }
                return;
            }

            // Build Query for Enrollments / Student List / Rejected Applications
            let query = supabase
                .from('enrollments')
                .select('*')
                .order('created_at', { ascending: false });

            // Apply date filters
            if (fromVal) query = query.gte('created_at', `${fromVal}T00:00:00`);
            if (toVal) query = query.lte('created_at', `${toVal}T23:59:59`);

            // Apply Grade filter (if specifically selected)
            if (gradeVal) query = query.ilike('grade_level', `%${gradeVal}%`);

            // Apply Status filter
            if (type === 'rejected_applications') {
                query = query.or('status.ilike.rejected,status.eq.rejected,status.eq.Rejected');
            } else if (type === 'student_list') {
                query = query.or('status.ilike.enrolled,status.ilike.approved,status.eq.approved,status.eq.enrolled');
            } else if (statusVal) {
                if (statusVal.toLowerCase() === 'enrolled' || statusVal.toLowerCase() === 'approved') {
                    query = query.or('status.ilike.enrolled,status.ilike.approved,status.eq.approved,status.eq.enrolled');
                } else if (statusVal.toLowerCase() === 'pending') {
                    query = query.or('status.ilike.pending,status.eq.pending,status.eq.Pending');
                } else if (statusVal.toLowerCase() === 'rejected') {
                    query = query.or('status.ilike.rejected,status.eq.rejected,status.eq.Rejected');
                }
            }

            const { data: rawEnrollments, error: qErr } = await query;
            if (qErr) throw qErr;

            let allRecords = rawEnrollments || [];

            // Classify into JHS and SHS
            let jhsList = allRecords.filter(r => isJhs(r.grade_level || r.grade));
            let shsList = allRecords.filter(r => isShs(r.grade_level || r.grade));

            // If a strand filter is specified for Senior High
            if (strandVal) {
                shsList = shsList.filter(r => (r.strand || '').toLowerCase().includes(strandVal.toLowerCase()));
            }

            // Update Level Tabs Counter Badges
            if (badgeAllCount) badgeAllCount.textContent = (jhsList.length + shsList.length);
            if (badgeJhsCount) badgeJhsCount.textContent = jhsList.length;
            if (badgeShsCount) badgeShsCount.textContent = shsList.length;

            // Determine active level
            let activeLevel = levelVal;

            // Set Title and Print Header based on Report Type & Department Level
            let baseTitle = type === 'student_list' ? 'Student Official Masterlist' : (type === 'rejected_applications' ? 'Rejected Applications Report' : 'Enrollment Summary Report');
            let basePrintTitle = type === 'student_list' ? 'OFFICIAL STUDENTS MASTERLIST REPORT' : (type === 'rejected_applications' ? 'OFFICIAL REJECTED APPLICATIONS REPORT' : 'OFFICIAL ENROLLMENT REPORT');

            if (activeLevel === 'jhs') {
                if (reportTitle) reportTitle.textContent = `${baseTitle} — Junior High School (Grades 7–10)`;
                if (printReportTitle) printReportTitle.textContent = `${basePrintTitle} (JUNIOR HIGH SCHOOL)`;
                if (printDocDept) printDocDept.textContent = 'JUNIOR HIGH SCHOOL DEPARTMENT • GRADES 7 TO 10';
            } else if (activeLevel === 'shs') {
                if (reportTitle) reportTitle.textContent = `${baseTitle} — Senior High School (Grades 11–12)`;
                if (printReportTitle) printReportTitle.textContent = `${basePrintTitle} (SENIOR HIGH SCHOOL)`;
                if (printDocDept) printDocDept.textContent = 'SENIOR HIGH SCHOOL DEPARTMENT • GRADES 11 TO 12';
            } else {
                if (reportTitle) reportTitle.textContent = `${baseTitle} — All Levels (JHS & SHS Separated)`;
                if (printReportTitle) printReportTitle.textContent = `${basePrintTitle} (JHS & SHS DEPARTMENTS)`;
                if (printDocDept) printDocDept.textContent = 'BASIC EDUCATION DEPARTMENT • JUNIOR & SENIOR HIGH SCHOOL';
            }

            currentHeaders = ['#', 'Enrollment ID', 'Student Name', 'Grade Level', 'Track / Strand', 'Previous School', 'Status', 'Date Submitted'];
            currentReportRows = [];

            // Check if there are no records matching
            const totalCount = activeLevel === 'jhs' ? jhsList.length : (activeLevel === 'shs' ? shsList.length : (jhsList.length + shsList.length));
            if (totalCount === 0) {
                if (reportHead) reportHead.innerHTML = '<tr><th>No Records Found</th></tr>';
                if (reportBody) {
                    reportBody.innerHTML = `
                        <tr>
                            <td>
                                <div class="no-data">
                                    <i class="fas fa-chart-bar"></i>
                                    <h3>No Records Found</h3>
                                    <p>No enrollment records match the selected level, date, and filters.</p>
                                </div>
                            </td>
                        </tr>
                    `;
                }
                if (reportFoot) reportFoot.innerHTML = '';
                return;
            }

            // Function to build a row
            function buildRow(e, index, isJuniorHigh) {
                const name = (e.first_name || e.firstName)
                    ? `${e.first_name || e.firstName} ${e.last_name || e.lastName || ''}`.trim()
                    : (e.student_name || e.email || 'N/A');
                const grade = e.grade_level || e.grade || (isJuniorHigh ? 'Grade 8' : 'Grade 11');
                const rawStrand = e.strand || '';
                const strandDisplay = isJuniorHigh
                    ? '<span class="report-jhs-chip">JHS Curriculum</span>'
                    : (rawStrand && rawStrand !== 'N/A' && rawStrand !== '—'
                        ? `<span class="report-strand-chip">${rawStrand}</span>`
                        : '<span class="report-empty-cell">General SHS</span>');
                const prevSchool = e.previous_school || 'N/A';
                const rawStatus = (e.status || 'pending').toLowerCase();
                const isApproved = rawStatus === 'approved' || rawStatus === 'enrolled';
                const isRejected = rawStatus === 'rejected';
                const statusPillClass = isApproved ? 'status-pill-enrolled' : (isRejected ? 'status-pill-rejected' : 'status-pill-pending');
                const dotPulse = isApproved ? 'pulse-green' : (isRejected ? 'pulse-red' : 'pulse-amber');
                const displayStatus = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);
                const dateStr = e.created_at ? new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
                const shortId = e.id ? e.id.substring(0, 8).toUpperCase() : `ENR-${index + 1}`;

                currentReportRows.push([
                    index + 1,
                    shortId,
                    name,
                    grade,
                    isJuniorHigh ? 'JHS Curriculum' : (rawStrand || 'General SHS'),
                    prevSchool,
                    displayStatus,
                    dateStr
                ]);

                return `
                    <tr>
                        <td class="col-num">${index + 1}</td>
                        <td class="col-id"><span class="report-id-chip">${shortId}</span></td>
                        <td class="col-name"><span class="report-student-name">${name}</span></td>
                        <td class="col-grade"><span class="report-grade-cell"><i class="fas fa-graduation-cap"></i> ${grade}</span></td>
                        <td class="col-strand">${strandDisplay}</td>
                        <td class="col-school"><span class="report-school-cell" title="${prevSchool}">${prevSchool}</span></td>
                        <td class="col-status">
                            <span class="status-pill ${statusPillClass}">
                                <span class="status-dot ${dotPulse}"></span>
                                ${displayStatus}
                            </span>
                        </td>
                        <td class="col-date">
                            <span class="report-date-cell"><i class="far fa-calendar-alt"></i> ${dateStr}</span>
                        </td>
                    </tr>
                `;
            }

            let html = '';

            // Render based on level
            if (activeLevel === 'jhs') {
                jhsList.forEach((e, idx) => {
                    html += buildRow(e, idx, true);
                });
            } else if (activeLevel === 'shs') {
                shsList.forEach((e, idx) => {
                    html += buildRow(e, idx, false);
                });
            } else {
                // ALL: Separate into JHS section and SHS section!
                if (jhsList.length > 0) {
                    html += `
                        <tr class="dept-section-row">
                            <td colspan="8">
                                <div class="dept-section-banner">
                                    <span class="dept-section-title"><i class="fas fa-school"></i> JUNIOR HIGH SCHOOL DEPARTMENT (GRADES 7 – 10)</span>
                                    <span class="dept-badge-pill">${jhsList.length} Enrollees</span>
                                </div>
                            </td>
                        </tr>
                    `;
                    jhsList.forEach((e, idx) => {
                        html += buildRow(e, idx, true);
                    });
                }

                if (shsList.length > 0) {
                    html += `
                        <tr class="dept-section-row">
                            <td colspan="8">
                                <div class="dept-section-banner">
                                    <span class="dept-section-title"><i class="fas fa-graduation-cap"></i> SENIOR HIGH SCHOOL DEPARTMENT (GRADES 11 – 12)</span>
                                    <span class="dept-badge-pill">${shsList.length} Enrollees</span>
                                </div>
                            </td>
                        </tr>
                    `;
                    shsList.forEach((e, idx) => {
                        html += buildRow(e, jhsList.length + idx, false);
                    });
                }
            }

            // Set headers with alignment classes
            if (reportHead) {
                reportHead.innerHTML = `
                    <tr>
                        <th class="col-num">#</th>
                        <th class="col-id">Enrollment ID</th>
                        <th class="col-name">Student Name</th>
                        <th class="col-grade">Grade Level</th>
                        <th class="col-strand">${activeLevel === 'jhs' ? 'Curriculum' : 'Track / Strand'}</th>
                        <th class="col-school">Previous School</th>
                        <th class="col-status">Status</th>
                        <th class="col-date">Date Submitted</th>
                    </tr>
                `;
            }

            // Set body
            if (reportBody) reportBody.innerHTML = html;

            // Set footer
            if (reportFoot) {
                const displayedRecords = activeLevel === 'jhs' ? jhsList : (activeLevel === 'shs' ? shsList : [...jhsList, ...shsList]);
                const enrolledCount = displayedRecords.filter(r => (r.status || '').toLowerCase() === 'enrolled' || (r.status || '').toLowerCase() === 'approved').length;
                const pendingCount = displayedRecords.filter(r => (r.status || '').toLowerCase() === 'pending').length;
                const rejectedCount = displayedRecords.filter(r => (r.status || '').toLowerCase() === 'rejected').length;

                reportFoot.innerHTML = `
                    <tr class="report-footer-row">
                        <td colspan="${currentHeaders.length}">
                            <div class="report-footer-bar">
                                <div class="report-footer-left">
                                    <span class="report-total-badge">
                                        <i class="fas fa-database"></i> Total Records: <strong>${displayedRecords.length}</strong>
                                        ${activeLevel === 'all' ? `(JHS: ${jhsList.length} | SHS: ${shsList.length})` : ''}
                                    </span>
                                </div>
                                <div class="report-footer-right">
                                    <span class="report-status-summary">
                                        <span class="summary-pill green">Enrolled / Approved: ${enrolledCount}</span>
                                        <span class="summary-pill amber">Pending: ${pendingCount}</span>
                                        <span class="summary-pill red">Rejected: ${rejectedCount}</span>
                                    </span>
                                </div>
                            </div>
                        </td>
                    </tr>
                `;
            }
        } catch(err) {
            console.error('Error generating report:', err);
            if (reportBody) {
                reportBody.innerHTML = `
                    <tr>
                        <td>
                            <div class="no-data">
                                <i class="fas fa-exclamation-circle" style="color: #ef4444;"></i>
                                <h3>Error Generating Report</h3>
                                <p>${err.message || 'Failed to query enrollment data.'}</p>
                            </div>
                        </td>
                    </tr>
                `;
            }
        }
    }

    // Report Form Submit
    if (reportForm) {
        reportForm.addEventListener('submit', function(e) {
            e.preventDefault();
            generateReport();
        });
    }

    // Export Excel / CSV
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', function() {
            if (!currentReportRows || currentReportRows.length === 0) {
                showAlert('❌ No records available to export.', 'error');
                return;
            }

            let csv = currentHeaders.map(h => `"${h}"`).join(',') + '\n';
            currentReportRows.forEach(row => {
                csv += row.map(cell => `"${cell}"`).join(',') + '\n';
            });

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `enrollment_report_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
            URL.revokeObjectURL(link.href);

            showAlert('✅ Report downloaded as CSV successfully!', 'success');
        });
    }

        // Suppress browser default title/header during print
    window.addEventListener('beforeprint', function() {
        window.__prevDocumentTitle = document.title;
        document.title = ' ';
    });

    window.addEventListener('afterprint', function() {
        if (window.__prevDocumentTitle) {
            document.title = window.__prevDocumentTitle;
        }
    });

    // Dedicated Print Buttons for JHS, SHS, and All (Long Paper)
    const printJhsBtn = document.getElementById('printJhsBtn');
    const printShsBtn = document.getElementById('printShsBtn');

    async function printDepartment(deptLevel) {
        if (levelFilter) levelFilter.value = deptLevel;
        populateGradeFilter(deptLevel);
        setActiveTab(deptLevel);
        await generateReport();

        const oldTitle = document.title;
        document.title = ' ';
        window.print();
        setTimeout(() => {
            document.title = oldTitle;
        }, 1000);
    }

    if (printJhsBtn) {
        printJhsBtn.addEventListener('click', async function() {
            await printDepartment('jhs');
        });
    }

    if (printShsBtn) {
        printShsBtn.addEventListener('click', async function() {
            await printDepartment('shs');
        });
    }

    if (printBtn) {
        printBtn.addEventListener('click', function() {
            const oldTitle = document.title;
            document.title = ' ';
            window.print();
            setTimeout(() => {
                document.title = oldTitle;
            }, 800);
        });
    }

    // Show Alert
    function showAlert(message, type = 'success') {
        if (!alertContainer) return;
        alertContainer.innerHTML = '';
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            ${message}
        `;
        alertContainer.appendChild(alertDiv);
        setTimeout(() => {
            alertDiv.style.opacity = '0';
            setTimeout(() => alertDiv.remove(), 300);
        }, 5000);
    }

    // Set Default Form Values
    if (dateFrom) dateFrom.value = getDefaultDateFrom();
    if (dateTo) dateTo.value = getDefaultDateTo();
    populateGradeFilter();

    // Initial load
    await loadStats();
    await generateReport();

    console.log('✅ Reports initialized successfully with live Supabase data.');

})();