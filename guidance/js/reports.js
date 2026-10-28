// ===== GUIDANCE REPORTS & ANALYTICS CONTROLLER =====
import { supabase } from '../../supabase/config.js';

document.addEventListener('DOMContentLoaded', async function() {
    'use strict';

    // 1. Session Check
    let currentUser = null;
    try {
        const raw = localStorage.getItem('currentUser');
        if (raw) currentUser = JSON.parse(raw);
    } catch (e) {
        console.warn('Session parse warning:', e);
    }

    if (!currentUser) {
        window.location.replace('../auth/login.html');
        return;
    }

    // Set Counselor Profile in Sidebar
    const counselorNameEl = document.getElementById('counselorName');
    const counselorAvatarEl = document.getElementById('counselorAvatar');
    const displayName = currentUser.displayName || `${currentUser.firstName || 'Sarah'} ${currentUser.lastName || 'Counselor'}`.trim() || 'Guidance Counselor';
    
    if (counselorNameEl) counselorNameEl.textContent = displayName;
    if (counselorAvatarEl) counselorAvatarEl.textContent = (displayName[0] || 'G').toUpperCase();

    // Mobile Sidebar Toggle
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }


    // State
    let allViolations = [];
    let allStudents = [];
    let allSessions = [];
    let currentSelectedStudent = null;
    let severityChartInstance = null;
    let offenseChartInstance = null;

    // DOM Elements - Navigation & Views
    const tabBtnWholeSchool = document.getElementById('tabBtnWholeSchool');
    const tabBtnStudentReport = document.getElementById('tabBtnStudentReport');
    const viewWholeSchool = document.getElementById('viewWholeSchool');
    const viewStudentReport = document.getElementById('viewStudentReport');

    // DOM Elements - Whole School
    const reportTotalIncidents = document.getElementById('reportTotalIncidents');
    const reportMinorCount = document.getElementById('reportMinorCount');
    const reportMajorCount = document.getElementById('reportMajorCount');
    const reportResolvedRate = document.getElementById('reportResolvedRate');
    const reportTableBody = document.getElementById('reportTableBody');
    const matrixSearchInput = document.getElementById('matrixSearchInput');
    const matrixCategoryFilter = document.getElementById('matrixCategoryFilter');
    const btnExportCSV = document.getElementById('btnExportCSV');
    const btnPrintReport = document.getElementById('btnPrintReport');
    const btnPrintSchoolBondPaper = document.getElementById('btnPrintSchoolBondPaper');
    const wholeSchoolBondPaper = document.getElementById('wholeSchoolBondPaper');
    const wholeSchoolPrintTableBody = document.getElementById('wholeSchoolPrintTableBody');
    const paperKpiTotal = document.getElementById('paperKpiTotal');
    const paperKpiMinor = document.getElementById('paperKpiMinor');
    const paperKpiMajor = document.getElementById('paperKpiMajor');
    const paperKpiRate = document.getElementById('paperKpiRate');
    const wholeSchoolPrintDate = document.getElementById('wholeSchoolPrintDate');
    const sigSchoolCounselor = document.getElementById('sigSchoolCounselor');

    // DOM Elements - Student Report View
    const btnHeaderPrintByStudent = document.getElementById('btnHeaderPrintByStudent');
    const studentSelectDropdown = document.getElementById('studentSelectDropdown');
    const paperSizeSelect = document.getElementById('paperSizeSelect');
    const btnPrintStudentReport = document.getElementById('btnPrintStudentReport');
    const btnExportStudentCSV = document.getElementById('btnExportStudentCSV');
    const studentReportEmptyState = document.getElementById('studentReportEmptyState');
    const studentDossierCard = document.getElementById('studentDossierCard');

    // Dossier Card Fields
    const dossierDocRef = document.getElementById('dossierDocRef');
    const dossierStudentName = document.getElementById('dossierStudentName');
    const dossierStudentLRN = document.getElementById('dossierStudentLRN');
    const dossierStudentRole = document.getElementById('dossierStudentRole');
    const dossierStudentEnrollStatus = document.getElementById('dossierStudentEnrollStatus');
    const dossierStudentGradeSec = document.getElementById('dossierStudentGradeSec');
    const dossierStudentStrand = document.getElementById('dossierStudentStrand');
    const dossierStudentGenderAge = document.getElementById('dossierStudentGenderAge');
    const dossierStudentParent = document.getElementById('dossierStudentParent');
    const dossierStudentContact = document.getElementById('dossierStudentContact');
    const dossierMetaStanding = document.getElementById('dossierMetaStanding');
    const dossierReportDate = document.getElementById('dossierReportDate');
    const dossierConductBanner = document.getElementById('dossierConductBanner');
    const dossierConductIcon = document.getElementById('dossierConductIcon');
    const dossierConductTitle = document.getElementById('dossierConductTitle');
    const dossierConductSub = document.getElementById('dossierConductSub');
    const dossierTotalViolations = document.getElementById('dossierTotalViolations');
    const dossierTotalCounseling = document.getElementById('dossierTotalCounseling');
    const dossierViolationsContainer = document.getElementById('dossierViolationsContainer');
    const dossierCounselingContainer = document.getElementById('dossierCounselingContainer');
    const sigCounselorName = document.getElementById('sigCounselorName');
    const sigStudentNameLine = document.getElementById('sigStudentNameLine');

    if (sigCounselorName) sigCounselorName.textContent = displayName;
    if (sigSchoolCounselor) sigSchoolCounselor.textContent = displayName;

    // Set Current Date in Date Badge (Mirroring Dashboard)
    const dateBadge = document.querySelector('.date-badge, #currentDateDisplay, #dateBadge');
    if (dateBadge) {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateBadge.innerHTML = `<i class="fas fa-calendar-alt"></i> ${now.toLocaleDateString('en-US', options)}`;
    }

    // ============================================
    // TAB NAVIGATION HANDLERS
    // ============================================
    function switchTab(tab) {
        if (tab === 'student') {
            if (tabBtnStudentReport) tabBtnStudentReport.classList.add('active');
            if (tabBtnWholeSchool) tabBtnWholeSchool.classList.remove('active');
            if (viewStudentReport) viewStudentReport.style.display = 'block';
            if (viewWholeSchool) viewWholeSchool.style.display = 'none';
        } else {
            if (tabBtnWholeSchool) tabBtnWholeSchool.classList.add('active');
            if (tabBtnStudentReport) tabBtnStudentReport.classList.remove('active');
            if (viewWholeSchool) viewWholeSchool.style.display = 'block';
            if (viewStudentReport) viewStudentReport.style.display = 'none';
        }
    }

    if (tabBtnWholeSchool) {
        tabBtnWholeSchool.addEventListener('click', () => switchTab('school'));
    }
    if (tabBtnStudentReport) {
        tabBtnStudentReport.addEventListener('click', () => switchTab('student'));
    }

    // ============================================
    // LOAD ALL DATA FROM SUPABASE
    // ============================================
    async function loadReportData() {
        try {
            const [violationsRes, studentsRes, sessionsRes] = await Promise.all([
                supabase.from('student_violations').select('*').order('incident_date', { ascending: false }),
                supabase.from('students').select('*').order('last_name', { ascending: true }),
                supabase.from('counseling_sessions').select('*').order('session_date', { ascending: false })
            ]);

            allViolations = violationsRes.data || [];
            allStudents = studentsRes.data || [];
            allSessions = sessionsRes.data || [];

            // 1. Render Whole-School Analytics
            computeWholeSchoolMetrics();
            renderCharts();
            renderWholeSchoolTable();
            renderWholeSchoolPrintTable();

            // 2. Populate Student Selector
            populateStudentDropdown();

            // 3. Check URL parameters for direct student report navigation
            handleUrlParameters();

        } catch (err) {
            console.error('Error loading report data:', err);
            if (reportTableBody) {
                reportTableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--danger);">Failed to load discipline reports: ${err.message}</td></tr>`;
            }
        }
    }

    // ============================================
    // WHOLE-SCHOOL METRICS & TABLES
    // ============================================
    function computeWholeSchoolMetrics() {
        const total = allViolations.length;
        const minor = allViolations.filter(v => (v.violation_category || '').toLowerCase() === 'minor').length;
        const major = allViolations.filter(v => (v.violation_category || '').toLowerCase() === 'major').length;
        const resolved = allViolations.filter(v => (v.status || '').toLowerCase() === 'resolved').length;
        const rate = total > 0 ? Math.round((resolved / total) * 100) : 100;

        if (reportTotalIncidents) reportTotalIncidents.textContent = total;
        if (reportMinorCount) reportMinorCount.textContent = minor;
        if (reportMajorCount) reportMajorCount.textContent = major;
        if (reportResolvedRate) reportResolvedRate.textContent = `${rate}%`;

        const severityCenterTotal = document.getElementById('severityCenterTotal');
        if (severityCenterTotal) severityCenterTotal.textContent = total;

        // Bond Paper Printable KPIs & Metadata Sync
        if (paperKpiTotal) paperKpiTotal.textContent = total;
        if (paperKpiMinor) paperKpiMinor.textContent = minor;
        if (paperKpiMajor) paperKpiMajor.textContent = major;
        if (paperKpiRate) paperKpiRate.textContent = `${rate}%`;
        if (wholeSchoolPrintDate) wholeSchoolPrintDate.textContent = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        if (sigSchoolCounselor) sigSchoolCounselor.textContent = displayName;
    }

    function renderCharts() {
        const minor = allViolations.filter(v => (v.violation_category || '').toLowerCase() === 'minor').length;
        const major = allViolations.filter(v => (v.violation_category || '').toLowerCase() === 'major').length;

        const severityCenterTotal = document.getElementById('severityCenterTotal');
        if (severityCenterTotal) severityCenterTotal.textContent = (minor + major);

        const severityCtx = document.getElementById('severityChart');
        if (severityCtx) {
            if (severityChartInstance) severityChartInstance.destroy();
            severityChartInstance = new Chart(severityCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Minor Infractions', 'Major Violations'],
                    datasets: [{
                        data: [minor, major],
                        backgroundColor: ['#f59e0b', '#ef4444'],
                        borderWidth: 3,
                        borderColor: '#ffffff',
                        hoverOffset: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                font: { family: 'Inter', size: 12, weight: '600' },
                                color: '#334155',
                                padding: 16,
                                usePointStyle: true,
                                pointStyle: 'circle'
                            }
                        },
                        tooltip: {
                            backgroundColor: '#1B2A4A',
                            titleFont: { family: 'Inter', size: 13, weight: '700' },
                            bodyFont: { family: 'Inter', size: 12 },
                            padding: 10,
                            cornerRadius: 8
                        }
                    },
                    cutout: '72%'
                }
            });
        }

        const off1 = allViolations.filter(v => (v.offense_level || '').includes('1st')).length;
        const off2 = allViolations.filter(v => (v.offense_level || '').includes('2nd')).length;
        const off3 = allViolations.filter(v => (v.offense_level || '').includes('3rd')).length;
        const off4 = allViolations.filter(v => (v.offense_level || '').includes('4th') || (v.offense_level || '').includes('Expulsion')).length;

        const offenseCtx = document.getElementById('offenseLevelChart');
        if (offenseCtx) {
            if (offenseChartInstance) offenseChartInstance.destroy();
            const maxVal = Math.max(off1, off2, off3, off4);
            offenseChartInstance = new Chart(offenseCtx, {
                type: 'bar',
                data: {
                    labels: ['1st Offense', '2nd Offense', '3rd Offense', '4th+ Offense'],
                    datasets: [{
                        label: 'Number of Incidents',
                        data: [off1, off2, off3, off4],
                        backgroundColor: ['#0284c7', '#f59e0b', '#ea580c', '#ef4444'],
                        borderRadius: 6,
                        borderSkipped: false,
                        maxBarThickness: 38
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: '#1B2A4A',
                            titleFont: { family: 'Inter', size: 13, weight: '700' },
                            bodyFont: { family: 'Inter', size: 12 },
                            padding: 10,
                            cornerRadius: 8
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: {
                                font: { family: 'Inter', size: 12, weight: '600' },
                                color: '#475569'
                            }
                        },
                        y: {
                            beginAtZero: true,
                            suggestedMax: Math.max(2, maxVal + 1),
                            ticks: {
                                precision: 0,
                                font: { family: 'Inter', size: 11 },
                                color: '#64748b',
                                stepSize: 1
                            },
                            grid: {
                                color: 'rgba(226, 232, 240, 0.6)',
                                drawBorder: false
                            }
                        }
                    }
                }
            });
        }
    }

    function renderWholeSchoolTable() {
        if (!reportTableBody) return;

        const query = matrixSearchInput ? matrixSearchInput.value.toLowerCase().trim() : '';
        const catFilter = matrixCategoryFilter ? matrixCategoryFilter.value : 'all';

        let list = allViolations;
        if (catFilter !== 'all') {
            list = list.filter(v => (v.violation_category || '').toLowerCase() === catFilter);
        }
        if (query) {
            list = list.filter(v => {
                const sName = (v.student_name || '').toLowerCase();
                const lrn = (v.lrn || '').toLowerCase();
                const vType = (v.violation_type || v.violation_title || '').toLowerCase();
                const strand = (v.strand || '').toLowerCase();
                return sName.includes(query) || lrn.includes(query) || vType.includes(query) || strand.includes(query);
            });
        }

        if (list.length === 0) {
            reportTableBody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; color: var(--text-muted); padding: 42px 20px;">
                        <i class="fas fa-folder-open" style="font-size: 32px; color: #cbd5e1; display: block; margin-bottom: 10px;"></i>
                        <strong style="color: #334155; font-size: 14px;">No matching discipline records found</strong>
                        <p style="font-size: 12.5px; margin: 4px 0 0; color: #94a3b8;">Try clearing the search or category filter.</p>
                    </td>
                </tr>
            `;
            return;
        }

        reportTableBody.innerHTML = list.map(v => {
            const dateStr = v.incident_date ? new Date(v.incident_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
            const isMajor = (v.violation_category || '').toLowerCase() === 'major';
            const catBadge = isMajor 
                ? `<span class="badge-cat-major"><i class="fas fa-circle-exclamation"></i> Major</span>`
                : `<span class="badge-cat-minor"><i class="fas fa-triangle-exclamation"></i> Minor</span>`;

            const rawStatus = (v.status || 'Reported').trim();
            const statusLow = rawStatus.toLowerCase();
            let statusBadge = `<span class="badge-status-reported"><i class="fas fa-flag"></i> ${rawStatus}</span>`;
            if (statusLow.includes('counseling')) {
                statusBadge = `<span class="badge-status-counseling"><i class="fas fa-calendar-check"></i> ${rawStatus}</span>`;
            } else if (statusLow.includes('resolve') || statusLow.includes('closed')) {
                statusBadge = `<span class="badge-status-resolved"><i class="fas fa-circle-check"></i> ${rawStatus}</span>`;
            } else if (statusLow.includes('progress') || statusLow.includes('investigat')) {
                statusBadge = `<span class="badge-status-progress"><i class="fas fa-clock"></i> ${rawStatus}</span>`;
            }

            const initial = ((v.student_name || 'S').trim()[0] || 'S').toUpperCase();

            return `
                <tr>
                    <td>
                        <div class="date-cell">
                            <i class="fas fa-calendar-alt"></i>
                            <span>${dateStr}</span>
                        </div>
                    </td>
                    <td>
                        <div class="student-name-cell">
                            <span class="avatar-pill">${initial}</span>
                            <span class="name-text">${v.student_name || 'Learner'}</span>
                        </div>
                    </td>
                    <td><span class="lrn-tag">${v.lrn || 'N/A'}</span></td>
                    <td><span class="grade-strand-tag">${v.grade_level || 'Grade 11'} (${v.strand || 'TVL'})</span></td>
                    <td>${catBadge}</td>
                    <td><strong style="color: #1e293b;">${v.violation_type || v.violation_title || 'Infraction'}</strong></td>
                    <td style="color: #475569;">${v.action_taken || 'Guidance Counseling'}</td>
                    <td>${statusBadge}</td>
                    <td style="text-align: right;">
                        <button type="button" class="btn-print-row-student" data-student-id="${v.student_id || ''}" data-student-name="${(v.student_name || '').replace(/"/g, '&quot;')}" data-lrn="${v.lrn || ''}" title="Print official report for this student on bond paper">
                            <i class="fas fa-print"></i> Print
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        // Attach listeners to "Print by Student" row buttons
        document.querySelectorAll('.btn-print-row-student').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const sId = btn.getAttribute('data-student-id');
                const sName = btn.getAttribute('data-student-name');
                const lrn = btn.getAttribute('data-lrn');
                openAndPrintStudentReport(sId, sName, lrn);
            });
        });
    }

    function openAndPrintStudentReport(studentId, studentName, lrn) {
        let targetStudent = null;
        if (studentId) {
            targetStudent = allStudents.find(s => s.id === studentId || s.student_id === studentId);
        }
        if (!targetStudent && lrn) {
            targetStudent = allStudents.find(s => s.lrn === lrn);
        }
        if (!targetStudent && studentName) {
            const cleanName = studentName.toLowerCase().trim();
            targetStudent = allStudents.find(s => {
                const sFullName = `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase();
                const sRevName = `${s.last_name || ''}, ${s.first_name || ''}`.toLowerCase();
                return (cleanName.includes((s.last_name || '___').toLowerCase()) && cleanName.includes((s.first_name || '___').toLowerCase())) ||
                       sFullName.includes(cleanName) || sRevName.includes(cleanName);
            });
        }

        // Fallback synthetic student if not yet in directory
        if (!targetStudent) {
            const parts = (studentName || 'Student').split(' ');
            targetStudent = {
                id: studentId || `stu_${Date.now()}`,
                first_name: parts[0] || 'Student',
                last_name: parts.slice(1).join(' ') || '',
                lrn: lrn || 'N/A',
                grade_level: 'Grade 11',
                strand: 'TVL',
                gender: 'Learner',
                parent_name: 'Not Provided'
            };
            allStudents.push(targetStudent);
            populateStudentDropdown();
        }

        switchTab('student');
        renderStudentReport(targetStudent.id);
        setTimeout(() => {
            printStudentBondPaper();
        }, 500);
    }

    function renderWholeSchoolPrintTable() {
        if (!wholeSchoolPrintTableBody) return;

        if (allViolations.length === 0) {
            wholeSchoolPrintTableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: #64748b; padding: 24px;">
                        No recorded behavioral infractions or disciplinary cases for Academic Year 2025–2026.
                    </td>
                </tr>
            `;
            return;
        }

        const printList = allViolations.slice(0, 10);
        const rowsHtml = printList.map((v) => {
            const dateStr = v.incident_date ? new Date(v.incident_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
            const isMajor = (v.violation_category || '').toLowerCase() === 'major';
            return `
                <tr>
                    <td>${dateStr}</td>
                    <td><strong>${v.student_name || 'Student'}</strong></td>
                    <td>${v.lrn || 'N/A'}</td>
                    <td>${v.grade_level || 'Grade 11'} (${v.strand || 'TVL'})</td>
                    <td><strong style="color: ${isMajor ? '#991b1b' : '#92400e'};">${isMajor ? 'Major' : 'Minor'}</strong></td>
                    <td>${v.violation_type || v.violation_title || 'Incident'}</td>
                    <td>${v.action_taken || 'Guidance Counseling'}</td>
                </tr>
            `;
        }).join('');

        const extraNote = allViolations.length > 10 
            ? `<tr><td colspan="7" style="text-align: center; font-size: 8px; color: #475569; padding: 2.5px 6px; background: #f8fafc; font-style: italic;">* Showing 10 most recent recorded cases. Total incidents on record: ${allViolations.length}. Full archive maintained in Guidance Information System.</td></tr>`
            : '';

        wholeSchoolPrintTableBody.innerHTML = rowsHtml + extraNote;
    }

    // ============================================
    // STUDENT INDIVIDUAL GUIDANCE REPORT
    // ============================================
    function populateStudentDropdown() {
        if (!studentSelectDropdown) return;

        studentSelectDropdown.innerHTML = `
            <option value="">-- Search & Choose Student to Generate Report --</option>
            ${allStudents.map(s => {
                const fullName = `${s.last_name || ''}, ${s.first_name || ''} ${s.middle_name || ''}`.trim() || 'Student';
                const lrnStr = s.lrn ? ` (LRN: ${s.lrn})` : '';
                const gradeStr = s.grade_level ? ` • ${s.grade_level}` : '';
                const strandStr = s.strand ? ` - ${s.strand}` : '';
                return `<option value="${s.id}">${fullName}${lrnStr}${gradeStr}${strandStr}</option>`;
            }).join('')}
        `;

        studentSelectDropdown.addEventListener('change', function() {
            const sid = this.value;
            if (sid) {
                renderStudentReport(sid);
            } else {
                currentSelectedStudent = null;
                if (studentReportEmptyState) studentReportEmptyState.style.display = 'block';
                if (studentDossierCard) studentDossierCard.style.display = 'none';
                if (btnPrintStudentReport) btnPrintStudentReport.disabled = true;
                if (btnExportStudentCSV) btnExportStudentCSV.disabled = true;
            }
        });
    }

    function renderStudentReport(studentId) {
        const student = allStudents.find(s => s.id === studentId || s.lrn === studentId);
        if (!student) return;

        currentSelectedStudent = student;
        if (studentSelectDropdown) studentSelectDropdown.value = student.id;

        // 1. Filter student specific violations
        const studentViolations = allViolations.filter(v => 
            v.student_id === student.id || 
            (student.lrn && v.lrn === student.lrn) ||
            (v.student_name && v.student_name.toLowerCase().includes((student.last_name || '').toLowerCase()) && v.student_name.toLowerCase().includes((student.first_name || '').toLowerCase()))
        );

        // 2. Filter student specific counseling sessions
        const studentSessions = allSessions.filter(c => 
            c.student_id === student.id || 
            (student.lrn && c.lrn === student.lrn) ||
            (c.student_name && c.student_name.toLowerCase().includes((student.last_name || '').toLowerCase()) && c.student_name.toLowerCase().includes((student.first_name || '').toLowerCase()))
        );

        // 3. Populate Demographic Header
        const fullName = `${student.first_name || ''} ${student.middle_name || ''} ${student.last_name || ''}`.trim() || 'Student';
        const bDate = student.date_of_birth || student.birth_date;
        let ageStr = '—';
        if (bDate) {
            try {
                const birth = new Date(bDate);
                const age = Math.floor((new Date() - birth) / (365.25 * 24 * 60 * 60 * 1000));
                ageStr = `${student.gender || 'Not specified'} (${age} yrs old)`;
            } catch(e) {}
        } else if (student.gender) {
            ageStr = student.gender;
        }

        if (dossierStudentName) dossierStudentName.textContent = fullName;
        if (dossierStudentLRN) dossierStudentLRN.textContent = student.lrn || 'Not Assigned';
        if (dossierStudentRole) dossierStudentRole.innerHTML = `<i class="fas fa-user-graduate"></i> Bona Fide Student`;
        if (dossierStudentEnrollStatus) dossierStudentEnrollStatus.innerHTML = `<i class="fas fa-check-circle"></i> Officially Enrolled Student`;
        if (dossierStudentGradeSec) dossierStudentGradeSec.textContent = `${student.grade_level || 'Grade 11'} - ${student.section || student.section_id || 'Section A'}`;
        if (dossierStudentStrand) dossierStudentStrand.textContent = student.strand || student.track || 'Senior High TVL';
        if (dossierStudentGenderAge) dossierStudentGenderAge.textContent = ageStr;
        if (dossierStudentParent) dossierStudentParent.textContent = student.parent_name || student.guardian_name || 'Not Provided';
        if (dossierStudentContact) dossierStudentContact.textContent = student.parent_contact || student.emergency_contact || student.contact_number || '—';
        if (sigStudentNameLine) sigStudentNameLine.textContent = `${fullName} (Student)`;
        
        // Dossier Control & Metadata (By Student)
        const refSuffix = student.lrn ? student.lrn.slice(-6) : (student.id || '000000').substring(0, 6).toUpperCase();
        if (dossierDocRef) dossierDocRef.textContent = `PLSNHS-GCO-SF2026-BYSTUDENT-${refSuffix}`;
        if (dossierReportDate) dossierReportDate.textContent = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

        // 4. Calculate Conduct Standing
        const totalV = studentViolations.length;
        const totalC = studentSessions.length;
        const majorV = studentViolations.filter(v => (v.violation_category || '').toLowerCase() === 'major').length;
        const unresolvedV = studentViolations.filter(v => (v.status || '').toLowerCase() !== 'resolved').length;

        if (dossierTotalViolations) dossierTotalViolations.textContent = totalV;
        if (dossierTotalCounseling) dossierTotalCounseling.textContent = totalC;

        if (totalV === 0) {
            dossierConductBanner.className = 'conduct-status-banner clean';
            dossierConductIcon.className = 'fas fa-shield-check';
            dossierConductTitle.textContent = 'Clean Disciplinary Record (Exemplary Standing)';
            dossierConductSub.textContent = 'Student has zero recorded offenses and maintains an exemplary conduct record.';
            if (dossierMetaStanding) {
                dossierMetaStanding.textContent = 'Clean Record (Good Standing)';
                dossierMetaStanding.style.color = '#065f46';
            }
        } else if (majorV > 0 || unresolvedV > 0) {
            dossierConductBanner.className = 'conduct-status-banner violations';
            dossierConductIcon.className = 'fas fa-triangle-exclamation';
            dossierConductTitle.textContent = `Active Disciplinary Record (${unresolvedV} Pending Case${unresolvedV !== 1 ? 's' : ''})`;
            dossierConductSub.textContent = 'Student is under active guidance review and restitution sanctions. Requires counselor clearance.';
            if (dossierMetaStanding) {
                dossierMetaStanding.textContent = 'Active Disciplinary Review';
                dossierMetaStanding.style.color = '#991b1b';
            }
        } else {
            dossierConductBanner.className = 'conduct-status-banner monitoring';
            dossierConductIcon.className = 'fas fa-user-clock';
            dossierConductTitle.textContent = 'Restored Conduct Standing (Resolved Minor Infractions)';
            dossierConductSub.textContent = 'Prior infractions have been successfully resolved through guidance counseling and behavioral agreements.';
            if (dossierMetaStanding) {
                dossierMetaStanding.textContent = 'Restored Conduct Standing';
                dossierMetaStanding.style.color = '#92400e';
            }
        }

        // 5. Render Section I: Violations Registry (DepEd Form Format)
        if (studentViolations.length === 0) {
            dossierViolationsContainer.innerHTML = `
                <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 4px; padding: 5px 12px; color: #065f46; display: flex; align-items: center; gap: 8px; margin-bottom: 7px;">
                    <i class="fas fa-circle-check" style="font-size: 14px; color: #10b981;"></i>
                    <div style="font-size: 9.5px;">
                        <strong style="color: #065f46;">NO DISCIPLINARY OFFENSE RECORDED:</strong>
                        <span style="color: #047857;">Student has maintained an exemplary disciplinary standing with zero recorded rule violations.</span>
                    </div>
                </div>
            `;
        } else {
            dossierViolationsContainer.innerHTML = `
                <table class="dossier-table">
                    <thead>
                        <tr>
                            <th style="width: 6%; text-align: center;">No.</th>
                            <th style="width: 14%;">Incident Date</th>
                            <th style="width: 25%;">Offense Description</th>
                            <th style="width: 11%;">Severity</th>
                            <th style="width: 12%;">Offense Level</th>
                            <th style="width: 22%;">Guidance Action / Sanction</th>
                            <th style="width: 10%;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${studentViolations.map((v, idx) => {
                            const dStr = v.incident_date ? new Date(v.incident_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
                            const isMaj = (v.violation_category || '').toLowerCase() === 'major';
                            return `
                                <tr>
                                    <td style="text-align: center; font-weight: 700;">${idx + 1}</td>
                                    <td>${dStr}</td>
                                    <td>
                                        <strong>${v.violation_title || v.violation_type || 'Incident'}</strong>
                                        ${v.description ? `<div style="font-size: 8.5px; color: #64748b; margin-top: 1px;">${v.description}</div>` : ''}
                                    </td>
                                    <td><strong style="color: ${isMaj ? '#dc2626' : '#d97706'};">${isMaj ? 'Major' : 'Minor'}</strong></td>
                                    <td>${v.offense_level || '1st Offense'}</td>
                                    <td>
                                        <div>${v.action_taken || 'Parent Conference'}</div>
                                        ${v.sanction_details ? `<small style="color: #64748b; font-size: 8px;">${v.sanction_details}</small>` : ''}
                                    </td>
                                    <td><strong>${v.status || 'Reported'}</strong></td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `;
        }

        // 6. Render Section II: Counseling Interventions Registry
        if (studentSessions.length === 0) {
            dossierCounselingContainer.innerHTML = `
                <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 4px; padding: 5px 12px; color: #64748b; font-size: 9.5px; margin-bottom: 7px;">
                    <i class="fas fa-info-circle"></i> No formal counseling sessions or behavioral intervention referrals on record for this learner.
                </div>
            `;
        } else {
            dossierCounselingContainer.innerHTML = `
                <table class="dossier-table">
                    <thead>
                        <tr>
                            <th style="width: 6%; text-align: center;">No.</th>
                            <th style="width: 14%;">Session Date</th>
                            <th style="width: 20%;">Counseling Modality</th>
                            <th style="width: 32%;">Counselor Observations & Summary</th>
                            <th style="width: 28%;">Restorative Agreement / Plan</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${studentSessions.map((c, idx) => {
                            const cDate = c.session_date ? new Date(c.session_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
                            return `
                                <tr>
                                    <td style="text-align: center; font-weight: 700;">${idx + 1}</td>
                                    <td>${cDate}</td>
                                    <td><strong>${c.session_type || 'Individual Counseling'}</strong></td>
                                    <td>${c.remarks || c.notes || 'Routine behavioral reflection and peer relationship assessment.'}</td>
                                    <td>${c.agreement || 'Student committed to upholding classroom standards and positive peer interaction.'}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `;
        }

        // 7. Update Buttons
        if (btnPrintStudentReport) btnPrintStudentReport.disabled = false;
        if (btnExportStudentCSV) btnExportStudentCSV.disabled = false;

        // 8. Reveal Dossier
        if (studentReportEmptyState) studentReportEmptyState.style.display = 'none';
        if (studentDossierCard) studentDossierCard.style.display = 'block';
    }

    // ============================================
    // PAPER SIZING & PRINT HANDLERS
    // ============================================
    function applyPaperSize(size) {
        const sheets = document.querySelectorAll('.bond-paper-sheet');
        sheets.forEach(sheet => {
            sheet.classList.remove('paper-letter', 'paper-folio', 'paper-a4');
            sheet.classList.add(`paper-${size}`);
        });

        const styleEl = document.getElementById('dynamicPaperPrintStyle');
        if (styleEl) {
            let sizeRule = 'letter portrait';
            if (size === 'folio') sizeRule = '8.5in 13in portrait';
            else if (size === 'a4') sizeRule = 'a4 portrait';
            styleEl.textContent = `
                @page {
                    size: ${sizeRule};
                    margin: 5mm 10mm 5mm 10mm;
                }
            `;
        }
    }

    if (paperSizeSelect) {
        paperSizeSelect.addEventListener('change', function() {
            applyPaperSize(this.value);
        });
    }

    function printSchoolBondPaper() {
        document.body.classList.add('printing-school');
        document.body.classList.remove('printing-student');
        if (wholeSchoolBondPaper) wholeSchoolBondPaper.style.display = 'block';

        window.print();

        setTimeout(() => {
            document.body.classList.remove('printing-school');
            if (wholeSchoolBondPaper) wholeSchoolBondPaper.style.display = 'none';
        }, 1000);
    }

    function printStudentBondPaper() {
        if (!currentSelectedStudent) {
            alert('Please select a student from the dropdown before printing.');
            return;
        }

        document.body.classList.add('printing-student');
        document.body.classList.remove('printing-school');

        window.print();

        setTimeout(() => {
            document.body.classList.remove('printing-student');
        }, 1000);
    }

    // ============================================
    // URL PARAMETERS HANDLER
    // ============================================
    function handleUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const studentIdParam = urlParams.get('student_id') || urlParams.get('id');
        const tabParam = urlParams.get('tab');
        const shouldPrint = urlParams.get('print') === 'true' || urlParams.get('print') === '1';

        if (tabParam === 'student' || studentIdParam) {
            switchTab('student');
        }

        if (studentIdParam) {
            renderStudentReport(studentIdParam);
            if (shouldPrint) {
                setTimeout(() => printStudentBondPaper(), 600);
            }
        }
    }

    // ============================================
    // PRINT & EXPORT LISTENERS
    // ============================================
    if (btnHeaderPrintByStudent) {
        btnHeaderPrintByStudent.addEventListener('click', () => {
            switchTab('student');
            if (currentSelectedStudent) {
                printStudentBondPaper();
            } else {
                if (studentSelectDropdown) {
                    studentSelectDropdown.focus();
                    studentSelectDropdown.style.boxShadow = '0 0 0 3px rgba(29, 78, 216, 0.4)';
                    setTimeout(() => {
                        if (studentSelectDropdown) studentSelectDropdown.style.boxShadow = '';
                    }, 2500);
                }
                alert('Please select a student from the dropdown list to generate and print their individual report on bond paper.');
            }
        });
    }

    if (btnPrintReport) {
        btnPrintReport.addEventListener('click', () => {
            if (tabBtnStudentReport && tabBtnStudentReport.classList.contains('active')) {
                printStudentBondPaper();
            } else {
                printSchoolBondPaper();
            }
        });
    }

    if (btnPrintSchoolBondPaper) {
        btnPrintSchoolBondPaper.addEventListener('click', () => {
            printSchoolBondPaper();
        });
    }

    if (btnPrintStudentReport) {
        btnPrintStudentReport.addEventListener('click', () => {
            printStudentBondPaper();
        });
    }

    // Whole-School CSV Export
    if (btnExportCSV) {
        btnExportCSV.addEventListener('click', () => {
            if (allViolations.length === 0) {
                alert('No data available to export.');
                return;
            }

            const headers = ['Incident Date', 'Student Name', 'LRN', 'Grade Level', 'Strand', 'Category', 'Violation Type', 'Offense Level', 'Reported By', 'Action Taken', 'Status'];
            const rows = allViolations.map(v => [
                v.incident_date || '',
                `"${(v.student_name || '').replace(/"/g, '""')}"`,
                v.lrn || '',
                v.grade_level || '',
                v.strand || '',
                v.violation_category || '',
                `"${(v.violation_type || '').replace(/"/g, '""')}"`,
                v.offense_level || '',
                `"${(v.reported_by || '').replace(/"/g, '""')}"`,
                `"${(v.action_taken || '').replace(/"/g, '""')}"`,
                v.status || ''
            ]);

            const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement('a');
            link.setAttribute('href', encodedUri);
            link.setAttribute('download', `HES_Guidance_Discipline_Matrix_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    // Individual Student CSV Export
    if (btnExportStudentCSV) {
        btnExportStudentCSV.addEventListener('click', () => {
            if (!currentSelectedStudent) {
                alert('Please select a student first.');
                return;
            }

            const sName = `${currentSelectedStudent.first_name || ''} ${currentSelectedStudent.last_name || ''}`.trim() || 'Student';
            const studentViolations = allViolations.filter(v => v.student_id === currentSelectedStudent.id || (currentSelectedStudent.lrn && v.lrn === currentSelectedStudent.lrn));

            const headers = ['Student Name', 'LRN', 'Grade & Section', 'Incident Date', 'Category', 'Violation Title', 'Offense Level', 'Action Taken', 'Sanction Details', 'Status'];
            const rows = studentViolations.length > 0 
                ? studentViolations.map(v => [
                    `"${sName}"`,
                    currentSelectedStudent.lrn || '',
                    `"${currentSelectedStudent.grade_level || ''} - ${currentSelectedStudent.section || ''}"`,
                    v.incident_date || '',
                    v.violation_category || '',
                    `"${(v.violation_title || v.violation_type || '').replace(/"/g, '""')}"`,
                    v.offense_level || '',
                    `"${(v.action_taken || '').replace(/"/g, '""')}"`,
                    `"${(v.sanction_details || '').replace(/"/g, '""')}"`,
                    v.status || ''
                ])
                : [[
                    `"${sName}"`,
                    currentSelectedStudent.lrn || '',
                    `"${currentSelectedStudent.grade_level || ''} - ${currentSelectedStudent.section || ''}"`,
                    'N/A', 'CLEAN RECORD', 'Zero Recorded Offenses', 'N/A', 'Good Standing', 'None', 'Cleared'
                ]];

            const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement('a');
            link.setAttribute('href', encodedUri);
            link.setAttribute('download', `Guidance_Report_${sName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    // Matrix Table Search & Category Filter Listeners
    if (matrixSearchInput) {
        matrixSearchInput.addEventListener('input', () => {
            renderWholeSchoolTable();
        });
    }

    if (matrixCategoryFilter) {
        matrixCategoryFilter.addEventListener('change', () => {
            renderWholeSchoolTable();
        });
    }

    // Initialize Page
    await loadReportData();
});
