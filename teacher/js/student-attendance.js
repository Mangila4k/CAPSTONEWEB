/**
 * HES Teacher Dashboard - Student Attendance Management
 * Features:
 * - Comprehensive filtering by Grade Level (Year 7-12), Section, and Strand (JHS, STEM, ABM, HUMSS, TVL-ICT, TVL-HE, GAS)
 * - Real-time student roster and status manipulation (Present, Late, Absent, Excused)
 * - Automatic student notification generation on save
 * - Strict weekend block: Saturday and Sunday attendance disabled
 * - Supabase sync with offline-resilient local cache
 */

import { supabase } from '../../supabase/config.js';

(function() {
    'use strict';

    console.log('🌟 Student Attendance Management Module loaded');

    // ============================================
    // DOM ELEMENTS
    // ============================================
    const teacherName = document.getElementById('teacherName');
    const teacherInitial = document.getElementById('teacherInitial');
    const logoutBtn = document.getElementById('logoutBtn');
    const currentDateBadge = document.getElementById('currentDateBadge');
    const phTimeDisplay = document.getElementById('phTimeDisplay');
    const alertContainer = document.getElementById('alertContainer');

    // Weekend Elements
    const studentWeekendBanner = document.getElementById('studentWeekendBanner');
    const studentWeekendText = document.getElementById('studentWeekendText');
    const btnJumpToWeekday = document.getElementById('btnJumpToWeekday');

    // Filters
    const filterYearLevel = document.getElementById('filterYearLevel');
    const filterStrand = document.getElementById('filterStrand');
    const filterSection = document.getElementById('filterSection');
    const studentAttDate = document.getElementById('studentAttDate');
    const studentDateWeekday = document.getElementById('studentDateWeekday');
    const studentSearch = document.getElementById('studentSearch');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');

    // KPI Summary
    const stuStatTotal = document.getElementById('stuStatTotal');
    const stuStatPresent = document.getElementById('stuStatPresent');
    const stuStatLate = document.getElementById('stuStatLate');
    const stuStatAbsent = document.getElementById('stuStatAbsent');
    const stuStatExcused = document.getElementById('stuStatExcused');
    const stuStatRate = document.getElementById('stuStatRate');

    // Table & Batch Actions
    const tableHeaderTitle = document.getElementById('tableHeaderTitle');
    const activeFilterSummary = document.getElementById('activeFilterSummary');
    const btnMarkAllPresent = document.getElementById('btnMarkAllPresent');
    const btnMarkAllLate = document.getElementById('btnMarkAllLate');
    const btnMarkAllAbsent = document.getElementById('btnMarkAllAbsent');
    const btnSaveStudentAttendance = document.getElementById('btnSaveStudentAttendance');
    const studentAttendanceTableBody = document.getElementById('studentAttendanceTableBody');

    // ============================================
    // STATE
    // ============================================
    let sessionUser = null;
    let teacherId = null;
    let displayName = 'Teacher';

    let allStudents = [];
    let allSections = [];
    let filteredStudents = [];
    let studentAttendanceMap = {}; // studentId -> { status, timeIn, remarks, notified, saved }
    let isSelectedDateWeekend = false;

    // Default Roster if Supabase is offline / empty
    const DEFAULT_SECTIONS = [
        { id: 'sec_g7_diamond', name: 'Diamond', grade_level: 'Grade 7', year_level: 'Grade 7', strand: 'JHS', track: 'Junior High' },
        { id: 'sec_g7_emerald', name: 'Emerald', grade_level: 'Grade 7', year_level: 'Grade 7', strand: 'JHS', track: 'Junior High' },
        { id: 'sec_g8_ruby', name: 'Ruby', grade_level: 'Grade 8', year_level: 'Grade 8', strand: 'JHS', track: 'Junior High' },
        { id: 'sec_g8_sapphire', name: 'Sapphire', grade_level: 'Grade 8', year_level: 'Grade 8', strand: 'JHS', track: 'Junior High' },
        { id: 'sec_g9_gold', name: 'Gold', grade_level: 'Grade 9', year_level: 'Grade 9', strand: 'JHS', track: 'Junior High' },
        { id: 'sec_g9_silver', name: 'Silver', grade_level: 'Grade 9', year_level: 'Grade 9', strand: 'JHS', track: 'Junior High' },
        { id: 'sec_g10_rizal', name: 'Rizal', grade_level: 'Grade 10', year_level: 'Grade 10', strand: 'JHS', track: 'Junior High' },
        { id: 'sec_g10_bonifacio', name: 'Bonifacio', grade_level: 'Grade 10', year_level: 'Grade 10', strand: 'JHS', track: 'Junior High' },
        { id: 'sec_g11_stem_a', name: 'STEM A - Newton', grade_level: 'Grade 11', year_level: 'Grade 11', strand: 'STEM', track: 'Academic' },
        { id: 'sec_g11_abm_a', name: 'ABM A - Gates', grade_level: 'Grade 11', year_level: 'Grade 11', strand: 'ABM', track: 'Academic' },
        { id: 'sec_g11_humss_a', name: 'HUMSS A - Plato', grade_level: 'Grade 11', year_level: 'Grade 11', strand: 'HUMSS', track: 'Academic' },
        { id: 'sec_g11_tvl_ict', name: 'TVL A - Turing', grade_level: 'Grade 11', year_level: 'Grade 11', strand: 'TVL-ICT', track: 'TVL' },
        { id: 'sec_g12_stem_a', name: 'STEM A - Einstein', grade_level: 'Grade 12', year_level: 'Grade 12', strand: 'STEM', track: 'Academic' },
        { id: 'sec_g12_abm_a', name: 'ABM A - Drucker', grade_level: 'Grade 12', year_level: 'Grade 12', strand: 'ABM', track: 'Academic' },
        { id: 'sec_g12_humss_a', name: 'HUMSS A - Aristotle', grade_level: 'Grade 12', year_level: 'Grade 12', strand: 'HUMSS', track: 'Academic' },
        { id: 'sec_g12_tvl_ict', name: 'TVL A - Lovelace', grade_level: 'Grade 12', year_level: 'Grade 12', strand: 'TVL-ICT', track: 'TVL' }
    ];

    const DEFAULT_STUDENTS = [];

    // ============================================
    // AUTH & SESSION
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
        console.warn('⚠️ No active session, redirecting to login...');
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
            console.log('🚪 Logging out...');
            localStorage.removeItem('currentUser');
            localStorage.removeItem('hes_teacher_avatar');
            localStorage.removeItem('hes_teacher_name');
            try {
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

    function getLatestClassDayString() {
        const d = new Date();
        const day = d.getDay();
        if (day === 0) { // Sunday -> previous Friday
            d.setDate(d.getDate() - 2);
        } else if (day === 6) { // Saturday -> previous Friday
            d.setDate(d.getDate() - 1);
        }
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const dateNum = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${dateNum}`;
    }

    function updateLiveClock() {
        const now = new Date();
        const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        
        if (currentDateBadge) {
            currentDateBadge.innerHTML = `<i class="fas fa-calendar-alt"></i> ${now.toLocaleDateString('en-US', dateOptions)}`;
        }
        if (phTimeDisplay) {
            const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
            phTimeDisplay.textContent = now.toLocaleTimeString('en-US', timeOptions) + ' (PST)';
        }
    }

    updateLiveClock();
    setInterval(updateLiveClock, 1000);

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
            <i class="fas fa-${icon}"></i>
            <div style="flex:1;">${message}</div>
            <button type="button" style="background:none; border:none; color:inherit; cursor:pointer; font-size:1.1rem;" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;

        alertContainer.prepend(alertEl);
        setTimeout(() => {
            if (document.getElementById(alertId)) {
                alertEl.style.opacity = '0';
                setTimeout(() => alertEl.remove(), 300);
            }
        }, 5000);
    }

    // ============================================
    // LOAD DATA (SECTIONS & STUDENTS)
    // ============================================
    async function loadSectionsAndStudents() {
        try {
            // 1. Fetch Sections from Supabase
            let loadedSections = [];
            const { data: secData, error: secErr } = await supabase
                .from('sections')
                .select('*')
                .order('grade_level', { ascending: true });

            if (!secErr && secData && secData.length > 0) {
                loadedSections = secData.map(s => ({
                    id: s.id,
                    name: s.name || s.section_name,
                    grade_level: s.grade_level || s.year_level || 'Grade 7',
                    year_level: s.grade_level || s.year_level || 'Grade 7',
                    strand: s.strand || (s.grade_level && s.grade_level.includes('11') || s.grade_level.includes('12') ? 'STEM' : 'JHS'),
                    track: s.track || 'Academic'
                }));
            } else {
                loadedSections = DEFAULT_SECTIONS;
            }
            allSections = loadedSections;

            // 2. Fetch Students from Supabase
            let loadedStudents = [];
            const { data: stuData, error: stuErr } = await supabase
                .from('students')
                .select('*')
                .order('last_name', { ascending: true });

            if (!stuErr && stuData && stuData.length > 0) {
                loadedStudents = stuData.map(s => {
                    const secObj = allSections.find(sec => sec.id === s.section_id || sec.name === s.section);
                    const grade = s.grade_level || s.year_level || (secObj ? secObj.grade_level : 'Grade 7');
                    const strand = s.strand || (secObj ? secObj.strand : (grade.includes('11') || grade.includes('12') ? 'STEM' : 'JHS'));
                    const sectionName = s.section || (secObj ? secObj.name : 'Diamond');

                    return {
                        id: s.id,
                        full_name: s.full_name || `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Student',
                        lrn: s.lrn || s.student_id || ('LRN-' + String(s.id).substring(0, 8)),
                        grade_level: grade,
                        year_level: grade,
                        section: sectionName,
                        strand: strand,
                        gender: s.gender || 'Not specified'
                    };
                });
            } else {
                loadedStudents = [];
            }
            allStudents = loadedStudents;

            console.log(` Loaded ${allSections.length} sections and ${allStudents.length} students.`);

            // Setup filters & initial date
            const todayStr = getLocalDateString();
            const initialDate = isWeekend(todayStr) ? getLatestClassDayString() : todayStr;
            if (studentAttDate) {
                studentAttDate.value = initialDate;
            }
            populateSectionDropdown();
            handleDateChange();

        } catch (err) {
            console.error('Error loading roster:', err);
            allSections = DEFAULT_SECTIONS;
            allStudents = [];
            populateSectionDropdown();
            handleDateChange();
        }
    }

    // ============================================
    // SECTION DROPDOWN LOGIC (Cascading)
    // ============================================
    function populateSectionDropdown() {
        if (!filterSection) return;

        const selectedYear = filterYearLevel ? filterYearLevel.value : '';
        const selectedStrand = filterStrand ? filterStrand.value : '';

        // Filter available sections based on chosen Grade Level and Strand
        const matchingSections = allSections.filter(sec => {
            const matchesYear = !selectedYear || sec.grade_level === selectedYear || sec.year_level === selectedYear;
            const matchesStrand = !selectedStrand || sec.strand === selectedStrand || (selectedStrand === 'JHS' && (sec.grade_level.includes('7') || sec.grade_level.includes('8') || sec.grade_level.includes('9') || sec.grade_level.includes('10')));
            return matchesYear && matchesStrand;
        });

        const currentVal = filterSection.value;
        filterSection.innerHTML = '<option value="">All Sections</option>';

        // Collect unique section names
        const uniqueSecNames = [...new Set(matchingSections.map(s => s.name))];
        uniqueSecNames.forEach(secName => {
            const opt = document.createElement('option');
            opt.value = secName;
            opt.textContent = `Section: ${secName}`;
            filterSection.appendChild(opt);
        });

        if (uniqueSecNames.includes(currentVal)) {
            filterSection.value = currentVal;
        }
    }

    // ============================================
    // DATE HANDLING & WEEKEND CHECK
    // ============================================
    function handleDateChange() {
        const chosenDate = studentAttDate ? studentAttDate.value : getLocalDateString();
        isSelectedDateWeekend = isWeekend(chosenDate);

        // Update weekday pill
        if (studentDateWeekday && chosenDate) {
            const d = new Date(chosenDate + 'T00:00:00');
            const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
            studentDateWeekday.textContent = dayName;
            if (isSelectedDateWeekend) {
                studentDateWeekday.classList.add('weekend');
                studentDateWeekday.textContent = `${dayName} (Weekend)`;
            } else {
                studentDateWeekday.classList.remove('weekend');
            }
        }

        // Show or hide weekend warning banner
        if (studentWeekendBanner) {
            if (isSelectedDateWeekend) {
                const d = new Date(chosenDate + 'T00:00:00');
                const fullDayName = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
                if (studentWeekendText) {
                    studentWeekendText.innerHTML = `
                        <strong>${fullDayName}</strong> is a weekend. School attendance cannot be recorded or marked on Saturday or Sunday.
                        Please select an official class day (Monday to Friday) or click the button below to jump to the latest school day.
                    `;
                }
                studentWeekendBanner.style.display = 'flex';
            } else {
                studentWeekendBanner.style.display = 'none';
            }
        }

        // Disable/enable batch action buttons
        if (btnMarkAllPresent) btnMarkAllPresent.disabled = isSelectedDateWeekend;
        if (btnMarkAllLate) btnMarkAllLate.disabled = isSelectedDateWeekend;
        if (btnMarkAllAbsent) btnMarkAllAbsent.disabled = isSelectedDateWeekend;
        if (btnSaveStudentAttendance) btnSaveStudentAttendance.disabled = isSelectedDateWeekend;

        // Load existing attendance for this date & re-render
        loadAttendanceForDate(chosenDate);
    }

    // ============================================
    // ATTENDANCE DATA SYNC FOR DATE
    // ============================================
    async function loadAttendanceForDate(dateStr) {
        studentAttendanceMap = {};

        // If weekend, keep empty/locked
        if (isWeekend(dateStr)) {
            applyFiltersAndRender();
            return;
        }

        try {
            // Read from local cache first
            const cachedRaw = localStorage.getItem(`hes_student_attendance_${dateStr}`);
            if (cachedRaw) {
                studentAttendanceMap = JSON.parse(cachedRaw);
            }

            // Fetch from Supabase
            const { data, error } = await supabase
                .from('attendance')
                .select('*')
                .eq('date', dateStr);

            if (!error && data && data.length > 0) {
                data.forEach(row => {
                    const stuId = row.student_id || row.user_id || row.lrn;
                    if (stuId) {
                        studentAttendanceMap[stuId] = {
                            status: row.status || 'Present',
                            timeIn: row.time_in || '07:30 AM',
                            remarks: row.remarks || '',
                            notified: true,
                            saved: true
                        };
                    }
                });
            }
        } catch (err) {
            console.warn('Attendance load fallback:', err);
        }

        applyFiltersAndRender();
    }

    // ============================================
    // FILTERING & RENDERING
    // ============================================
    function applyFiltersAndRender() {
        const yearVal = (filterYearLevel ? filterYearLevel.value : '').toLowerCase().trim();
        const strandVal = (filterStrand ? filterStrand.value : '').toLowerCase().trim();
        const sectionVal = (filterSection ? filterSection.value : '').toLowerCase().trim();
        const searchVal = (studentSearch ? studentSearch.value : '').toLowerCase().trim();

        filteredStudents = allStudents.filter(student => {
            // Year filter
            if (yearVal) {
                const sYear = (student.grade_level || student.year_level || '').toLowerCase();
                if (!sYear.includes(yearVal)) return false;
            }

            // Strand filter
            if (strandVal) {
                const sStrand = (student.strand || '').toLowerCase();
                if (strandVal === 'jhs') {
                    const sYear = (student.grade_level || '').toLowerCase();
                    const isJHS = sStrand === 'jhs' || sYear.includes('7') || sYear.includes('8') || sYear.includes('9') || sYear.includes('10');
                    if (!isJHS) return false;
                } else if (!sStrand.includes(strandVal)) {
                    return false;
                }
            }

            // Section filter
            if (sectionVal) {
                const sSec = (student.section || '').toLowerCase();
                if (sSec !== sectionVal && !sSec.includes(sectionVal)) return false;
            }

            // Search filter
            if (searchVal) {
                const name = (student.full_name || '').toLowerCase();
                const lrn = (student.lrn || '').toLowerCase();
                const sec = (student.section || '').toLowerCase();
                const strand = (student.strand || '').toLowerCase();
                if (!name.includes(searchVal) && !lrn.includes(searchVal) && !sec.includes(searchVal) && !strand.includes(searchVal)) {
                    return false;
                }
            }

            return true;
        });

        // Update active summary text
        if (activeFilterSummary) {
            const parts = [];
            if (yearVal) parts.push(filterYearLevel.value);
            if (strandVal) parts.push(filterStrand.value);
            if (sectionVal) parts.push(`Section ${filterSection.value}`);
            if (searchVal) parts.push(`"${studentSearch.value}"`);
            activeFilterSummary.textContent = parts.length > 0 ? `Filtered by: ${parts.join(' • ')} (${filteredStudents.length} students)` : `Showing all sections (${filteredStudents.length} students)`;
        }

        renderStudentTable();
        updateKpiCounters();
    }

    function getAvatarColor(name) {
        const colors = [
            'linear-gradient(135deg, #0b2b4a 0%, #1e40af 100%)',
            'linear-gradient(135deg, #065f46 0%, #10b981 100%)',
            'linear-gradient(135deg, #3730a3 0%, #6366f1 100%)',
            'linear-gradient(135deg, #92400e 0%, #f59e0b 100%)',
            'linear-gradient(135deg, #6b21a8 0%, #a855f7 100%)',
            'linear-gradient(135deg, #9f1239 0%, #f43f5e 100%)',
            'linear-gradient(135deg, #0369a1 0%, #0ea5e9 100%)'
        ];
        let hash = 0;
        for (let i = 0; i < (name || '').length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const idx = Math.abs(hash) % colors.length;
        return colors[idx];
    }

    function formatGradeSection(grade, section) {
        const cleanG = (grade || 'Grade 7').trim();
        let cleanS = (section || 'Diamond').trim();
        
        // Clean up duplicated grade prefix in section name (e.g. "Grade 11 - Diamond" or "11 - C")
        if (cleanS.startsWith(cleanG + ' - ')) {
            cleanS = cleanS.substring((cleanG + ' - ').length);
        } else if (/^\d+\s*-\s*/.test(cleanS)) {
            cleanS = cleanS.replace(/^\d+\s*-\s*/, 'Sec ');
        }
        
        return `<span class="badge-grade-sec"><i class="fas fa-layer-group"></i> ${cleanG} &bull; ${cleanS}</span>`;
    }

    function formatStrandBadge(strand) {
        const s = (strand || 'JHS').trim();
        const upper = s.toUpperCase();
        let cssClass = 'strand-jhs';
        
        if (upper.includes('STEM')) cssClass = 'strand-stem';
        else if (upper.includes('ABM')) cssClass = 'strand-abm';
        else if (upper.includes('HUMSS')) cssClass = 'strand-humss';
        else if (upper.includes('TVL') || upper.includes('ICT') || upper.includes('HE')) cssClass = 'strand-tvl';
        else if (upper.includes('GAS')) cssClass = 'strand-gas';
        
        return `<span class="badge-strand ${cssClass}">${s}</span>`;
    }

    function renderStudentTable() {
        if (!studentAttendanceTableBody) return;

        if (filteredStudents.length === 0) {
            studentAttendanceTableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-5">
                        <div class="empty-state">
                            <i class="fas fa-user-slash fa-3x"></i>
                            <h3>No Students Found</h3>
                            <p>No students match the selected Year Level, Strand, Section, or Search criteria.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        filteredStudents.forEach((student, index) => {
            const studentId = student.id || student.lrn;
            const att = studentAttendanceMap[studentId] || {
                status: isSelectedDateWeekend ? 'Weekend' : 'Present',
                timeIn: isSelectedDateWeekend ? '--:--' : '07:30 AM',
                remarks: '',
                notified: false,
                saved: false
            };

            const isPresent = att.status === 'Present';
            const isLate = att.status === 'Late';
            const isAbsent = att.status === 'Absent';
            const isExcused = att.status === 'Excused';

            const initial = (student.full_name || 'S').charAt(0).toUpperCase();
            const avatarBg = getAvatarColor(student.full_name || 'Student');

            let notifyHtml = '';
            if (isSelectedDateWeekend) {
                notifyHtml = `<span class="notify-badge weekend"><i class="fas fa-ban"></i> Weekend</span>`;
            } else if (att.notified || att.saved) {
                notifyHtml = `<span class="notify-badge sent"><i class="fas fa-check-circle"></i> Notified</span>`;
            } else {
                notifyHtml = `<span class="notify-badge pending"><i class="fas fa-clock"></i> Pending</span>`;
            }

            html += `
                <tr data-student-id="${studentId}">
                    <td style="color: var(--gray-500); font-weight: 700; text-align: center;">${index + 1}</td>
                    <td>
                        <div class="student-cell">
                            <div class="student-avatar" style="background: ${avatarBg};">${initial}</div>
                            <div>
                                <div class="student-name-text">${student.full_name}</div>
                                <div class="student-lrn-text">LRN: ${student.lrn}</div>
                            </div>
                        </div>
                    </td>
                    <td>
                        ${formatGradeSection(student.grade_level, student.section)}
                    </td>
                    <td style="text-align: center;">
                        ${formatStrandBadge(student.strand)}
                    </td>
                    <td>
                        <div class="status-pill-group">
                            <button type="button" class="status-btn ${isPresent ? 'active status-present' : ''}" 
                                onclick="window.setStudentStatus('${studentId}', 'Present')" ${isSelectedDateWeekend ? 'disabled' : ''}>
                                <i class="fas fa-check"></i> Present
                            </button>
                            <button type="button" class="status-btn ${isLate ? 'active status-late' : ''}" 
                                onclick="window.setStudentStatus('${studentId}', 'Late')" ${isSelectedDateWeekend ? 'disabled' : ''}>
                                <i class="fas fa-clock"></i> Late
                            </button>
                            <button type="button" class="status-btn ${isAbsent ? 'active status-absent' : ''}" 
                                onclick="window.setStudentStatus('${studentId}', 'Absent')" ${isSelectedDateWeekend ? 'disabled' : ''}>
                                <i class="fas fa-times"></i> Absent
                            </button>
                            <button type="button" class="status-btn ${isExcused ? 'active status-excused' : ''}" 
                                onclick="window.setStudentStatus('${studentId}', 'Excused')" ${isSelectedDateWeekend ? 'disabled' : ''}>
                                <i class="fas fa-shield-alt"></i> Excused
                            </button>
                        </div>
                    </td>
                    <td style="text-align: center;">
                        <input type="text" class="table-time-input" value="${att.timeIn || '07:30 AM'}" 
                            onchange="window.updateStudentTime('${studentId}', this.value)" 
                            ${isSelectedDateWeekend || isAbsent ? 'disabled' : ''}>
                    </td>
                    <td>
                        <input type="text" class="table-remarks-input" placeholder="Add remarks..." 
                            value="${att.remarks || ''}" 
                            onchange="window.updateStudentRemarks('${studentId}', this.value)"
                            ${isSelectedDateWeekend ? 'disabled' : ''}>
                    </td>
                    <td style="text-align: center;">
                        ${notifyHtml}
                    </td>
                </tr>
            `;
        });

        studentAttendanceTableBody.innerHTML = html;
    }

    function updateKpiCounters() {
        const total = filteredStudents.length;
        let present = 0;
        let late = 0;
        let absent = 0;
        let excused = 0;

        filteredStudents.forEach(student => {
            const studentId = student.id || student.lrn;
            const att = studentAttendanceMap[studentId] || { status: isSelectedDateWeekend ? 'Weekend' : 'Present' };
            const st = (att.status || '').toLowerCase();
            if (st === 'present') present++;
            else if (st === 'late') late++;
            else if (st === 'absent') absent++;
            else if (st === 'excused') excused++;
            else if (!isSelectedDateWeekend) present++;
        });

        const presentPlusLate = present + late;
        const rate = total > 0 && !isSelectedDateWeekend ? Math.round((presentPlusLate / total) * 100) : 0;

        if (stuStatTotal) stuStatTotal.textContent = total;
        if (stuStatPresent) stuStatPresent.textContent = present;
        if (stuStatLate) stuStatLate.textContent = late;
        if (stuStatAbsent) stuStatAbsent.textContent = absent;
        if (stuStatExcused) stuStatExcused.textContent = excused;
        if (stuStatRate) stuStatRate.textContent = `${rate}%`;
    }

    // ============================================
    // STATUS TOGGLES & BATCH ACTIONS
    // ============================================
    window.setStudentStatus = function(studentId, newStatus) {
        if (isSelectedDateWeekend) {
            showAlert('📅 Attendance cannot be modified on weekends.', 'warning');
            return;
        }

        if (!studentAttendanceMap[studentId]) {
            studentAttendanceMap[studentId] = {};
        }

        studentAttendanceMap[studentId].status = newStatus;
        if (newStatus === 'Present' && (!studentAttendanceMap[studentId].timeIn || studentAttendanceMap[studentId].timeIn === '--:--')) {
            studentAttendanceMap[studentId].timeIn = '07:30 AM';
        } else if (newStatus === 'Late') {
            studentAttendanceMap[studentId].timeIn = '08:15 AM';
        } else if (newStatus === 'Absent') {
            studentAttendanceMap[studentId].timeIn = '--:--';
        }

        studentAttendanceMap[studentId].saved = false;
        studentAttendanceMap[studentId].notified = false;

        renderStudentTable();
        updateKpiCounters();
    };

    window.updateStudentTime = function(studentId, newTime) {
        if (!studentAttendanceMap[studentId]) studentAttendanceMap[studentId] = {};
        studentAttendanceMap[studentId].timeIn = newTime;
        studentAttendanceMap[studentId].saved = false;
    };

    window.updateStudentRemarks = function(studentId, remarks) {
        if (!studentAttendanceMap[studentId]) studentAttendanceMap[studentId] = {};
        studentAttendanceMap[studentId].remarks = remarks;
        studentAttendanceMap[studentId].saved = false;
    };

    function markAllFiltered(status) {
        if (isSelectedDateWeekend) {
            showAlert('📅 Cannot modify attendance on Saturday or Sunday.', 'warning');
            return;
        }

        if (filteredStudents.length === 0) {
            showAlert('⚠️ No students currently visible to mark.', 'warning');
            return;
        }

        filteredStudents.forEach(student => {
            const studentId = student.id || student.lrn;
            if (!studentAttendanceMap[studentId]) studentAttendanceMap[studentId] = {};
            studentAttendanceMap[studentId].status = status;
            if (status === 'Present') studentAttendanceMap[studentId].timeIn = '07:30 AM';
            else if (status === 'Late') studentAttendanceMap[studentId].timeIn = '08:15 AM';
            else if (status === 'Absent') studentAttendanceMap[studentId].timeIn = '--:--';
            studentAttendanceMap[studentId].saved = false;
            studentAttendanceMap[studentId].notified = false;
        });

        renderStudentTable();
        updateKpiCounters();
        showAlert(` Marked all ${filteredStudents.length} visible students as ${status}. Click "Save & Notify Students" to finalize.`, 'info');
    }

    if (btnMarkAllPresent) btnMarkAllPresent.addEventListener('click', () => markAllFiltered('Present'));
    if (btnMarkAllLate) btnMarkAllLate.addEventListener('click', () => markAllFiltered('Late'));
    if (btnMarkAllAbsent) btnMarkAllAbsent.addEventListener('click', () => markAllFiltered('Absent'));

    // ============================================
    // SAVE & NOTIFY STUDENTS
    // ============================================
    if (btnSaveStudentAttendance) {
        btnSaveStudentAttendance.addEventListener('click', async function() {
            if (isSelectedDateWeekend) {
                showAlert('📅 Attendance cannot be saved on weekends (Saturday / Sunday).', 'warning');
                return;
            }

            if (filteredStudents.length === 0) {
                showAlert('⚠️ No students in view to save attendance for.', 'warning');
                return;
            }

            const chosenDate = studentAttDate ? studentAttDate.value : getLocalDateString();
            btnSaveStudentAttendance.disabled = true;
            btnSaveStudentAttendance.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving & Notifying...';

            try {
                const attendanceUpserts = [];
                const notificationInserts = [];

                filteredStudents.forEach(student => {
                    const studentId = student.id || student.lrn;
                    const att = studentAttendanceMap[studentId] || {
                        status: 'Present',
                        timeIn: '07:30 AM',
                        remarks: ''
                    };

                    const status = att.status || 'Present';
                    const timeIn = att.timeIn || '07:30 AM';
                    const remarks = att.remarks || (status === 'Late' ? 'Late arrival' : (status === 'Absent' ? 'Unexcused absence' : 'On time'));

                    // Attendance row
                    attendanceUpserts.push({
                        student_id: student.id,
                        lrn: student.lrn,
                        student_name: student.full_name,
                        grade_level: student.grade_level,
                        section: student.section,
                        strand: student.strand,
                        date: chosenDate,
                        status: status,
                        time_in: timeIn,
                        remarks: remarks,
                        recorded_by: teacherId,
                        teacher_name: displayName,
                        updated_at: new Date().toISOString()
                    });

                    // Student Notification
                    const notifTitle = `Attendance: Marked as ${status}`;
                    const notifMsg = `Teacher ${displayName} recorded your attendance as "${status}" for ${chosenDate} (Time: ${timeIn}). Remarks: ${remarks}.`;

                    notificationInserts.push({
                        user_id: student.id,
                        student_id: student.id,
                        recipient_email: student.email || null,
                        role: 'student',
                        title: notifTitle,
                        message: notifMsg,
                        type: 'attendance',
                        is_read: false,
                        read: false,
                        created_at: new Date().toISOString()
                    });

                    // Mark local state as notified
                    studentAttendanceMap[studentId].saved = true;
                    studentAttendanceMap[studentId].notified = true;

                    // Sync student local notification cache
                    try {
                        const stuNotifsRaw = localStorage.getItem(`hes_notifications_${student.id}`);
                        let stuNotifs = stuNotifsRaw ? JSON.parse(stuNotifsRaw) : [];
                        stuNotifs.unshift({
                            id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                            title: notifTitle,
                            message: notifMsg,
                            type: 'attendance',
                            date: new Date().toISOString(),
                            read: false
                        });
                        localStorage.setItem(`hes_notifications_${student.id}`, JSON.stringify(stuNotifs.slice(0, 30)));
                    } catch(e) {}
                });

                // 1. Upsert attendance to Supabase
                try {
                    await supabase
                        .from('attendance')
                        .upsert(attendanceUpserts, { onConflict: 'student_id,date' });
                } catch (err) {
                    console.warn('Supabase attendance upsert notice:', err);
                }

                // 2. Insert notifications to Supabase
                try {
                    await supabase
                        .from('notifications')
                        .insert(notificationInserts);
                } catch (err) {
                    console.warn('Supabase notification insert notice:', err);
                }

                // 3. Save to local attendance cache
                localStorage.setItem(`hes_student_attendance_${chosenDate}`, JSON.stringify(studentAttendanceMap));

                showAlert(`🎉 Attendance successfully saved! Notifications sent to all ${filteredStudents.length} students.`, 'success');
                renderStudentTable();
                updateKpiCounters();

            } catch (err) {
                console.error('Save error:', err);
                showAlert('❌ Error saving attendance: ' + err.message, 'error');
            } finally {
                btnSaveStudentAttendance.disabled = false;
                btnSaveStudentAttendance.innerHTML = '<i class="fas fa-paper-plane"></i> Save & Notify Students';
            }
        });
    }

    // ============================================
    // EVENT LISTENERS (FILTERS & SEARCH)
    // ============================================
    if (filterYearLevel) {
        filterYearLevel.addEventListener('change', function() {
            populateSectionDropdown();
            applyFiltersAndRender();
        });
    }

    if (filterStrand) {
        filterStrand.addEventListener('change', function() {
            populateSectionDropdown();
            applyFiltersAndRender();
        });
    }

    if (filterSection) {
        filterSection.addEventListener('change', function() {
            applyFiltersAndRender();
        });
    }

    if (studentAttDate) {
        studentAttDate.addEventListener('change', function() {
            handleDateChange();
        });
    }

    if (btnJumpToWeekday) {
        btnJumpToWeekday.addEventListener('click', function() {
            const classDay = getLatestClassDayString();
            if (studentAttDate) {
                studentAttDate.value = classDay;
                handleDateChange();
                showAlert(`📅 Jumped to latest class day: ${classDay}`, 'info');
            }
        });
    }

    if (studentSearch) {
        studentSearch.addEventListener('input', function() {
            if (clearSearchBtn) {
                clearSearchBtn.style.display = studentSearch.value ? 'flex' : 'none';
            }
            applyFiltersAndRender();
        });
    }

    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', function() {
            if (studentSearch) studentSearch.value = '';
            clearSearchBtn.style.display = 'none';
            applyFiltersAndRender();
        });
    }

    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', function() {
            if (filterYearLevel) filterYearLevel.value = '';
            if (filterStrand) filterStrand.value = '';
            populateSectionDropdown();
            if (filterSection) filterSection.value = '';
            if (studentSearch) studentSearch.value = '';
            if (clearSearchBtn) clearSearchBtn.style.display = 'none';
            if (studentAttDate) studentAttDate.value = getLocalDateString();
            handleDateChange();
            showAlert('🔄 All filters reset to default.', 'info');
        });
    }

    // ============================================
    // INITIALIZATION
    // ============================================
    loadSectionsAndStudents();

    console.log('✅ Student Attendance Management initialized successfully');

})();
