/**
 * HES Admin - Students List (Whole School by Year Level & Section)
 */

import { supabase } from '../../supabase/config.js';
import { EmailNotificationService } from '../../js/email_service.js';

(function() {
    'use strict';

    console.log('🎓 Admin Students page ready');

    // ============================================
    // CHECK ADMIN SESSION
    // ============================================

    let currentUser = null;
    const currentUserStr = localStorage.getItem('currentUser');
    if (currentUserStr) {
        try {
            currentUser = JSON.parse(currentUserStr);
        } catch (e) {
            console.warn('Session parse error:', e);
        }
    }

    if (!currentUser) {
        currentUser = {
            role: 'admin',
            email: 'admin@hiraya.edu.ph',
            displayName: localStorage.getItem('hes_admin_name') || 'Admin',
            firstName: localStorage.getItem('hes_admin_name') || 'Admin'
        };
    }

    console.log('✅ Admin session verified:', currentUser.email || 'Admin');

    // ============================================
    // DOM ELEMENTS
    // ============================================

    const adminAvatar = document.getElementById('adminAvatar');
    const adminName = document.getElementById('adminName');
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');

    const searchInput = document.getElementById('searchInput');
    const filterGrade = document.getElementById('filterGrade');
    const filterSection = document.getElementById('filterSection');
    const filterStrand = document.getElementById('filterStrand');
    const filterStatus = document.getElementById('filterStatus');
    const filterStudentType = document.getElementById('filterStudentType');
    const refreshBtn = document.getElementById('refreshBtn');
    const gradeSummary = document.getElementById('gradeSummary');

    const totalStudents = document.getElementById('totalStudents');
    const activeStudents = document.getElementById('activeStudents');
    const maleStudents = document.getElementById('maleStudents');
    const femaleStudents = document.getElementById('femaleStudents');

    const tableBody = document.getElementById('studentsTableBody');
    const recordCount = document.getElementById('recordCount');

    const viewModal = document.getElementById('viewModal');
    const closeViewModal = document.getElementById('closeViewModal');
    const viewModalBody = document.getElementById('viewModalBody');

    // Whole school grade levels
    const gradeLevels = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];

    // ============================================
    // DISPLAY ADMIN INFO
    // ============================================

    let adminFirstName = currentUser.firstName || currentUser.first_name || currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'Admin');
    if (adminAvatar) adminAvatar.textContent = adminFirstName.charAt(0).toUpperCase();
    if (adminName) adminName.textContent = adminFirstName;

    // ============================================
    // MOBILE MENU TOGGLE
    // ============================================

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            sidebar.classList.toggle('active');
        });
    }

    document.addEventListener('click', function(e) {
        if (sidebar && sidebar.classList.contains('active') && !sidebar.contains(e.target) && (!menuToggle || !menuToggle.contains(e.target))) {
            sidebar.classList.remove('active');
        }
    });

    // ============================================
    // STATE & YEAR LEVEL HELPERS
    // ============================================

    let allStudents = [];
    let filteredStudents = [];
    let selectedLevel = 'all'; // 'all', 'jhs', 'shs'
    let selectedGrade = 'all'; // 'all', 'Grade 7', 'Grade 8', etc.

    function getSchoolLevel(gradeName) {
        if (!gradeName || gradeName === '—' || gradeName === 'Unassigned') return 'other';
        const num = parseInt(String(gradeName).replace(/\D/g, ''), 10);
        if (isNaN(num)) return 'other';
        return num >= 11 ? 'shs' : 'jhs';
    }

    function getGradeNumber(gradeName) {
        if (!gradeName || gradeName === '—' || gradeName === 'Unassigned') return 999;
        const num = parseInt(String(gradeName).replace(/\D/g, ''), 10);
        return isNaN(num) ? 999 : num;
    }

    function updateLevelBadges() {
        const allCount = allStudents.length;
        const jhsCount = allStudents.filter(s => getSchoolLevel(s.grade) === 'jhs').length;
        const shsCount = allStudents.filter(s => getSchoolLevel(s.grade) === 'shs').length;

        const badgeAll = document.getElementById('badgeAllCount');
        const badgeJhs = document.getElementById('badgeJhsCount');
        const badgeShs = document.getElementById('badgeShsCount');

        if (badgeAll) badgeAll.textContent = allCount;
        if (badgeJhs) badgeJhs.textContent = jhsCount;
        if (badgeShs) badgeShs.textContent = shsCount;
    }

    // ============================================
    // LOAD STUDENTS FROM SUPABASE
    // ============================================

    async function loadStudents() {
        console.log('🔍 Loading students...');

        // If we have cached students, show them immediately to avoid stuck spinner
        if (allStudents.length === 0) {
            try {
                const cachedStr = localStorage.getItem('hes_admin_students_cache');
                if (cachedStr) {
                    const parsed = JSON.parse(cachedStr);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        allStudents = parsed;
                        populateSectionFilter();
                        renderGradeSummary();
                        applyFilters();
                        updateStats();
                    }
                }
            } catch (e) {
                console.warn('Cache read notice:', e);
            }
        }

        if (allStudents.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" class="loading-cell">
                        <i class="fas fa-spinner fa-spin"></i> Loading students...
                    </td>
                </tr>
            `;
        }

        try {
            // STEP 1: Fetch students table
            console.log('📁 Fetching students table...');
            const { data: studentsData, error: studentsError } = await supabase
                .from('students')
                .select('*')
                .order('last_name', { ascending: true });

            if (studentsError) {
                console.error('❌ Students query error:', studentsError);
                throw studentsError;
            }

            console.log('✅ Found', studentsData?.length || 0, 'student records');

            // STEP 2: Fetch users table (non-fatal)
            let usersData = [];
            try {
                const { data: uData, error: usersError } = await supabase
                    .from('users')
                    .select('id, first_name, last_name, email, role');
                if (!usersError && uData) {
                    usersData = uData;
                }
            } catch (uErr) {
                console.warn('Users table query notice (non-fatal):', uErr);
            }

            // STEP 2.5: Fetch sections table to resolve section_id (non-fatal)
            let sectionsMap = new Map();
            try {
                const { data: sectionsData } = await supabase
                    .from('sections')
                    .select('id, name, grade_level, strand');
                if (sectionsData) {
                    sectionsMap = new Map(sectionsData.map(sec => [sec.id, sec]));
                }
            } catch (secErr) {
                console.warn('Could not load sections in student.js:', secErr);
            }

            // STEP 3: Combine by user_id, student_id, or email
            allStudents = (studentsData || []).map(student => {
                const user = (usersData || []).find(u => u.id === student.user_id || u.student_id === student.id || (u.email && student.email && u.email.toLowerCase() === student.email.toLowerCase()));
                const secObj = student.section_id ? sectionsMap.get(student.section_id) : null;
                const sectionName = secObj ? secObj.name : (student.section && student.section !== '—' ? student.section : '—');

                return {
                    id: student.id,
                    user_id: student.user_id || user?.id,
                    lrn: student.lrn || student.student_id || '—',
                    firstName: student.first_name || user?.first_name || 'Student',
                    lastName: student.last_name || user?.last_name || '',
                    email: student.email || user?.email || '—',
                    password: user?.password || student.last_name || '',
                    grade: student.grade_level || student.year_level || secObj?.grade_level || '—',
                    strand: student.strand || secObj?.strand || '—',
                    section_id: student.section_id || null,
                    section: sectionName,
                    gender: student.gender || '—',
                    student_type: student.student_type || 'New Student',
                    academic_status: student.academic_status || 'Unassigned',
                    avatar_url: student.two_by_two_picture_url || student.avatar_url || null,
                    status: student.status || 'Active'
                };
            });

            console.log('✅ Total students loaded:', allStudents.length);

            // Save to local cache for instant subsequent loading
            try {
                localStorage.setItem('hes_admin_students_cache', JSON.stringify(allStudents));
            } catch (cErr) {}

            populateSectionFilter();
            renderGradeSummary();
            applyFilters();
            updateStats();

        } catch (error) {
            console.error('❌ Error loading students:', error);

            if (allStudents.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="9" class="empty-cell">
                            <i class="fas fa-exclamation-triangle"></i>
                            <p>Error loading students. Please try refreshing.</p>
                        </td>
                    </tr>
                `;
            }
        }
    }

    // ============================================
    // POPULATE SECTION FILTER DROPDOWN
    // ============================================

    function populateSectionFilter() {
        if (!filterSection) return;

        const currentSelectedGrade = filterGrade ? filterGrade.value : '';
        const relevantStudents = currentSelectedGrade 
            ? allStudents.filter(s => s.grade === currentSelectedGrade)
            : allStudents;

        const distinctSections = Array.from(
            new Set(relevantStudents.map(s => s.section).filter(sec => sec && sec !== '—'))
        ).sort();

        const currentVal = filterSection.value;
        let html = '<option value="">All Sections</option>';

        distinctSections.forEach(sec => {
            html += `<option value="${sec}" ${sec === currentVal ? 'selected' : ''}>${sec}</option>`;
        });

        filterSection.innerHTML = html;
    }

    // ============================================
    // RENDER GRADE SUMMARY / BADGES
    // ============================================

    function renderGradeSummary() {
        updateLevelBadges();

        if (gradeSummary) {
            const activeGrade = filterGrade ? filterGrade.value : '';
            const total = allStudents.length;

            let html = `
                <div class="grade-summary-item ${activeGrade === '' ? 'active' : ''}" data-grade="">
                    <span class="grade-name">All School</span>
                    <span class="grade-count">${total}</span>
                </div>
            `;

            gradeLevels.forEach(grade => {
                const count = allStudents.filter(s => s.grade === grade).length;
                const isActive = activeGrade === grade;
                html += `
                    <div class="grade-summary-item ${isActive ? 'active' : ''}" data-grade="${grade}">
                        <span class="grade-name">${grade}</span>
                        <span class="grade-count">${count}</span>
                    </div>
                `;
            });

            gradeSummary.innerHTML = html;

            gradeSummary.querySelectorAll('.grade-summary-item').forEach(chip => {
                chip.addEventListener('click', function() {
                    const selectedGrade = this.dataset.grade;
                    if (filterGrade) {
                        filterGrade.value = selectedGrade;
                    }
                    populateSectionFilter();
                    renderGradeSummary();
                    applyFilters();
                });
            });
        }
    }

    // ============================================
    // APPLY FILTERS
    // ============================================

    function applyFilters() {
        const search = searchInput ? searchInput.value.trim().toLowerCase() : '';
        const grade = filterGrade ? filterGrade.value : '';
        const section = filterSection ? filterSection.value : '';
        const strand = filterStrand ? filterStrand.value : '';
        const status = filterStatus ? filterStatus.value : '';
        const studentType = filterStudentType ? filterStudentType.value : '';

        filteredStudents = allStudents.filter(s => {
            const fullName = `${s.firstName} ${s.lastName}`.toLowerCase();
            const lrn = (s.lrn || '').toLowerCase();
            const email = (s.email || '').toLowerCase();
            const secName = (s.section || '').toLowerCase();

            const matchSearch = !search ||
                fullName.includes(search) ||
                lrn.includes(search) ||
                email.includes(search) ||
                secName.includes(search);

            if (!matchSearch) return false;

            // Macro Level filter (JHS vs SHS)
            if (selectedLevel === 'jhs' && getSchoolLevel(s.grade) !== 'jhs') return false;
            if (selectedLevel === 'shs' && getSchoolLevel(s.grade) !== 'shs') return false;

            // Specific Grade Level filter (via Pill or Select)
            if (selectedGrade && selectedGrade !== 'all') {
                if (selectedGrade === 'Unassigned') {
                    if (s.grade && s.grade !== '—' && s.grade.toLowerCase() !== 'unassigned') return false;
                } else {
                    const sNum = selectedGrade.replace(/\D/g, '');
                    const iNum = (s.grade || '').replace(/\D/g, '');
                    if (sNum && iNum) {
                        if (sNum !== iNum) return false;
                    } else if (s.grade !== selectedGrade) {
                        return false;
                    }
                }
            } else if (grade) {
                if (s.grade !== grade) return false;
            }

            if (section && s.section !== section) return false;

            if (strand) {
                if (strand === 'JHS') {
                    const isJHS = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'].includes(s.grade) || s.strand === '—' || !s.strand;
                    if (!isJHS) return false;
                } else if (!(s.strand || '').toUpperCase().includes(strand.toUpperCase())) {
                    return false;
                }
            }

            if (status && s.status.toLowerCase() !== status.toLowerCase()) return false;

            if (studentType) {
                const sType = String(s.student_type || '').toLowerCase();
                if (studentType === 'Transferee' && !sType.includes('transfer')) return false;
                if (studentType === 'New Student' && sType.includes('transfer')) return false;
                if (studentType === 'Repeater' && !sType.includes('repeater')) return false;
            }

            return true;
        });

        updateLevelBadges();
        renderTable();
    }

    // ============================================
    // RENDER TABLE (GROUPED BY YEAR LEVEL)
    // ============================================

    function renderTable() {
        if (filteredStudents.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="10" class="empty-cell">
                        <i class="fas fa-inbox"></i>
                        <p>No students found for the selected criteria</p>
                    </td>
                </tr>
            `;
            if (recordCount) recordCount.textContent = 'Showing 0 records';
            return;
        }

        const avatarGradients = [
            'linear-gradient(135deg, #4f46e5, #7c3aed)',
            'linear-gradient(135deg, #0284c7, #2563eb)',
            'linear-gradient(135deg, #059669, #10b981)',
            'linear-gradient(135deg, #d97706, #f59e0b)',
            'linear-gradient(135deg, #db2777, #f43f5e)',
            'linear-gradient(135deg, #7c3aed, #9333ea)',
            'linear-gradient(135deg, #0d9488, #06b6d4)'
        ];

        // Sort students by natural academic year level order (Grade 7 -> 12 -> Unassigned), then by student name
        const sortedStudents = [...filteredStudents].sort((a, b) => {
            const gA = getGradeNumber(a.grade);
            const gB = getGradeNumber(b.grade);
            if (gA !== gB) return gA - gB;
            const nameA = `${a.firstName} ${a.lastName}`.trim().toLowerCase();
            const nameB = `${b.firstName} ${b.lastName}`.trim().toLowerCase();
            return nameA.localeCompare(nameB);
        });

        // Group students by Year Level
        const groups = {};
        sortedStudents.forEach(s => {
            const gKey = (s.grade && s.grade !== '—' && s.grade.toLowerCase() !== 'unassigned') ? s.grade : 'Unassigned Year Level';
            if (!groups[gKey]) groups[gKey] = [];
            groups[gKey].push(s);
        });

        let runningIndex = 1;
        let html = '';

        Object.keys(groups).forEach(gradeKey => {
            const groupStudents = groups[gradeKey];
            const schoolLvl = getSchoolLevel(gradeKey);
            const isShs = schoolLvl === 'shs';
            const isJhs = schoolLvl === 'jhs';
            const subLabel = isShs ? 'Senior High School' : (isJhs ? 'Junior High School' : 'Pending Placement');
            const iconClass = isShs ? 'shs' : (isJhs ? 'jhs' : 'other');
            const iconFa = isShs ? 'fa-graduation-cap' : (isJhs ? 'fa-school' : 'fa-circle-question');

            // Year Level Section Header Row
            html += `
                <tr class="year-group-row">
                    <td colspan="9">
                        <div class="year-group-header">
                            <div class="year-group-title">
                                <span class="year-group-icon ${iconClass}"><i class="fas ${iconFa}"></i></span>
                                <div class="year-group-text">
                                    <span class="year-group-name">${gradeKey}</span>
                                    <span class="year-group-sub">• ${subLabel}</span>
                                </div>
                            </div>
                            <span class="year-group-badge">${groupStudents.length} ${groupStudents.length === 1 ? 'Student' : 'Students'}</span>
                        </div>
                    </td>
                </tr>
            `;

            groupStudents.forEach(s => {
                const initial = (s.firstName || 'S').charAt(0).toUpperCase();
                const fullName = `${s.firstName} ${s.lastName}`.trim() || 'Unknown';
                const grad = avatarGradients[(runningIndex - 1) % avatarGradients.length];
                const isSHS = ['Grade 11', 'Grade 12'].includes(s.grade);

                // Strand styling
                const strandKey = (s.strand || '').toUpperCase();
                let strandClass = 'strand-general';
                if (strandKey.includes('TVL') || strandKey.includes('ICT')) strandClass = 'strand-ict';
                else if (strandKey.includes('STEM')) strandClass = 'strand-stem';
                else if (strandKey.includes('HUMSS')) strandClass = 'strand-humss';
                else if (strandKey.includes('GAS')) strandClass = 'strand-gas';
                else if (strandKey.includes('ABM')) strandClass = 'strand-abm';

                const strandDisplay = s.strand && s.strand !== '—' ? s.strand : (isSHS ? 'Unspecified' : 'General');
                const strandBadge = `<span class="strand-chip ${strandClass}">${strandDisplay}</span>`;

                // Student Type Badge
                const isTransferee = String(s.student_type || '').toLowerCase().includes('transfer');
                const typeBadge = isTransferee 
                    ? `<span class="student-type-pill pill-transferee" title="Transferee Student"><i class="fas fa-right-left"></i> Transferee</span>`
                    : `<span class="student-type-pill pill-new" title="New Enrolled Student"><i class="fas fa-sparkles"></i> New</span>`;

                // Gender icon & label
                const isMale = (s.gender || '').toLowerCase() === 'male';
                const isFemale = (s.gender || '').toLowerCase() === 'female';
                const genderIcon = isMale ? 'fa-mars' : (isFemale ? 'fa-venus' : 'fa-circle-user');
                const genderClass = isMale ? 'gender-male' : (isFemale ? 'gender-female' : 'gender-neutral');

                // Status Badge
                const isActive = (s.status || 'Active').toLowerCase() === 'active';
                const statusBadge = `
                    <span class="student-status-pill ${isActive ? 'status-active' : 'status-inactive'}">
                        <span class="status-dot"></span>
                        ${s.status || 'Active'}
                    </span>
                `;

                html += `
                    <tr class="student-row" data-id="${s.id}">
                        <td class="cell-center cell-index">${runningIndex++}</td>
                        <td class="cell-student">
                            <div class="student-cell">
                                <div class="student-avatar" style="background: ${grad}" title="${fullName}">
                                    ${s.avatar_url ? `
                                        <img src="${s.avatar_url}" alt="${fullName}" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';">
                                        <span style="display:none;">${initial}</span>
                                    ` : `
                                        <span>${initial}</span>
                                    `}
                                </div>
                                <div class="student-info-cell">
                                    <div class="student-name-row">
                                        <span class="student-full-name">${fullName}</span>
                                        ${typeBadge}
                                    </div>
                                    <div class="student-sub-row">
                                        <span class="student-gender-chip ${genderClass}">
                                            <i class="fas ${genderIcon}"></i> ${s.gender || '—'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </td>
                        <td class="cell-center cell-lrn">
                            <span class="lrn-code-pill" title="LRN: ${s.lrn || 'None'}">
                                ${s.lrn && s.lrn !== '—' ? s.lrn : '<span class="text-muted">—</span>'}
                            </span>
                        </td>
                        <td class="cell-center cell-grade">
                            <span class="grade-pill grade-${(s.grade || '').toLowerCase().replace(/\s+/g, '-')}">
                                ${s.grade || '—'}
                            </span>
                        </td>
                        <td class="cell-center cell-section">
                            ${s.section && s.section !== '—' 
                                ? `<span class="section-pill"><i class="fas fa-users"></i> ${s.section}</span>` 
                                : `<span class="section-pill unassigned">—</span>`}
                        </td>
                        <td class="cell-center cell-strand">${strandBadge}</td>
                        <td class="cell-email">
                            ${s.email && s.email !== '—' 
                                ? `<a href="mailto:${s.email}" class="student-email-link" title="${s.email}"><i class="far fa-envelope"></i> <span>${s.email}</span></a>` 
                                : `<span class="text-muted">—</span>`}
                        </td>
                        <td class="cell-center cell-status">${statusBadge}</td>
                        <td class="cell-center cell-actions">
                            <div class="manage-dropdown">
                                <button type="button" class="btn-manage" aria-expanded="false" title="Manage Student Record">
                                    <span>Manage</span>
                                    <i class="fas fa-chevron-down"></i>
                                </button>
                                <div class="manage-menu">
                                    <a href="view_student.html?id=${s.id}" class="manage-item view-item" title="View Student Profile">
                                        <i class="fas fa-eye"></i>
                                        <span>View Profile</span>
                                    </a>
                                    <a href="edit_student.html?id=${s.id}" class="manage-item edit-item" title="Edit Student Record">
                                        <i class="fas fa-pen-to-square"></i>
                                        <span>Edit Record</span>
                                    </a>
                                    <button type="button" class="manage-item gmail-item notify-gmail" data-id="${s.id}" title="Send Login Credentials to Student's Gmail">
                                        <i class="fab fa-google"></i>
                                        <span>Send to Gmail</span>
                                    </button>
                                    <div class="manage-divider"></div>
                                    <button type="button" class="manage-item delete-item delete" data-id="${s.id}" title="Delete Student Record">
                                        <i class="fas fa-trash-can"></i>
                                        <span>Delete Student</span>
                                    </button>
                                </div>
                            </div>
                        </td>
                    </tr>
                `;
            });
        });

        tableBody.innerHTML = html;

        if (recordCount) {
            recordCount.textContent = `Showing ${filteredStudents.length} of ${allStudents.length} records`;
        }

        // Academic Status Dropdown Change Listener
        tableBody.querySelectorAll('.academic-status-select').forEach(select => {
            select.addEventListener('change', async function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const studentId = this.dataset.id;
                const newStatus = this.value;

                // Optimistic UI update
                this.className = `academic-status-select ${newStatus === 'Passed' ? 'badge-passed' : (newStatus === 'Failed' ? 'badge-failed' : 'badge-unassigned')}`;

                try {
                    const { error } = await supabase
                        .from('students')
                        .update({ academic_status: newStatus })
                        .eq('id', studentId);

                    if (error) throw error;

                    // Update local state
                    const student = allStudents.find(s => s.id === studentId);
                    if (student) student.academic_status = newStatus;

                    showAlert(`✅ Student academic status updated to ${newStatus.toUpperCase()}`, 'success');
                } catch (err) {
                    console.error('Update academic status error:', err);
                    showAlert('❌ Failed to update status: ' + err.message, 'error');
                    applyFilters(); // Revert UI on error
                }
            });
        });

        // Manage Dropdown Toggle
        tableBody.querySelectorAll('.btn-manage').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const dropdown = this.closest('.manage-dropdown');
                const row = this.closest('tr');
                const isOpen = dropdown.classList.contains('show');

                document.querySelectorAll('.manage-dropdown.show').forEach(d => {
                    d.classList.remove('show');
                    d.classList.remove('dropup');
                    const r = d.closest('tr');
                    if (r) r.classList.remove('dropdown-open');
                });

                if (!isOpen) {
                    const rect = this.getBoundingClientRect();
                    const spaceBelow = window.innerHeight - rect.bottom;
                    if (spaceBelow < 190) {
                        dropdown.classList.add('dropup');
                    } else {
                        dropdown.classList.remove('dropup');
                    }
                    dropdown.classList.add('show');
                    if (row) row.classList.add('dropdown-open');
                }
            });
        });

        // Gmail Notification
        tableBody.querySelectorAll('.notify-gmail').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const dropdown = this.closest('.manage-dropdown');
                if (dropdown) dropdown.classList.remove('show');

                const st = allStudents.find(s => s.id === this.dataset.id);
                if (!st || !st.email || st.email === '—') {
                    showAlert('This student does not have a registered email address.', 'error');
                    return;
                }
                const emailPayload = EmailNotificationService.buildCredentialsEmail({
                    studentName: `${st.firstName} ${st.lastName}`.trim(),
                    firstName: st.firstName,
                    lastName: st.password || st.lastName,
                    email: st.email,
                    gradeLevel: st.grade,
                    strand: st.strand !== '—' ? st.strand : '',
                    schoolYear: '2026-2027'
                });
                EmailNotificationService.sendViaGmailWeb(emailPayload);
                showAlert(`Gmail compose opened for ${st.firstName} ${st.lastName}!`, 'success');
            });
        });

        // Delete Student
        tableBody.querySelectorAll('.delete').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const dropdown = this.closest('.manage-dropdown');
                if (dropdown) dropdown.classList.remove('show');
                openDeleteModal(this.dataset.id);
            });
        });
    }

    // ============================================
    // UPDATE STATS
    // ============================================

    function updateStats() {
        const total = allStudents.length;
        const active = allStudents.filter(s => s.status === 'Active').length;
        const males = allStudents.filter(s => (s.gender || '').toLowerCase() === 'male').length;
        const females = allStudents.filter(s => (s.gender || '').toLowerCase() === 'female').length;

        if (totalStudents) totalStudents.textContent = total;
        if (activeStudents) activeStudents.textContent = active;
        if (maleStudents) maleStudents.textContent = males;
        if (femaleStudents) femaleStudents.textContent = females;
    }

    // ============================================
    // VIEW STUDENT DETAILS MODAL
    // ============================================

    function viewStudent(id) {
        const student = allStudents.find(s => s.id === id);
        if (!student) return;

        const initial = (student.firstName || 'S').charAt(0).toUpperCase();
        const fullName = `${student.firstName} ${student.lastName}`.trim() || 'Unknown';
        const isSHS = ['Grade 11', 'Grade 12'].includes(student.grade);
        const strandLabel = isSHS && student.strand && student.strand !== '—'
            ? student.strand 
            : (student.strand && student.strand !== '—' ? student.strand : 'Basic Education / Junior High');

        viewModalBody.innerHTML = `
            <div class="view-detail">
                <div class="view-avatar">${initial}</div>
                <div class="view-name">
                    <h3>${fullName}</h3>
                    <p>${student.email}</p>
                    <span class="badge badge-strand">${strandLabel}</span>
                </div>
            </div>

            <div class="view-grid">
                <div class="view-item">
                    <label>LRN (Student ID)</label>
                    <span>${student.lrn || '—'}</span>
                </div>
                <div class="view-item">
                    <label>Gender</label>
                    <span>${student.gender || '—'}</span>
                </div>
                <div class="view-item">
                    <label>Year / Grade Level</label>
                    <span>${student.grade || '—'}</span>
                </div>
                <div class="view-item">
                    <label>Section</label>
                    <span>${student.section || '—'}</span>
                </div>
                <div class="view-item">
                    <label>Strand / Track</label>
                    <span>${student.strand || 'General / JHS'}</span>
                </div>
                <div class="view-item">
                    <label>Enrollment Status</label>
                    <span>${student.status || 'Active'}</span>
                </div>
                <div class="view-item" style="grid-column: 1 / -1;">
                    <label>Official Email</label>
                    <span>${student.email || '—'}</span>
                </div>
            </div>

            <!-- Credentials Gmail Notification Card in Modal -->
            <div style="margin-top: 16px; background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 10px; padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                <div style="font-size: 12.5px; color: #991b1b; line-height: 1.4;">
                    <strong>Student Login Credentials:</strong><br>
                    Username: <span style="font-family: monospace; font-weight: 700;">${student.email || '—'}</span> &bull; 
                    Password: <span style="font-family: monospace; font-weight: 700;">${student.password || student.lastName}</span>
                </div>
                <button type="button" id="viewModalGmailBtn" style="padding: 8px 14px; background: #EA4335; color: white; border: none; border-radius: 8px; font-weight: 700; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 6px; white-space: nowrap; box-shadow: 0 2px 6px rgba(234,67,53,0.3);">
                    <i class="fab fa-google"></i> Send to Gmail
                </button>
            </div>

            <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; padding-top: 16px; border-top: 1px solid #e9edf4;">
                <a href="view_student.html?id=${student.id}" class="btn-refresh" style="text-decoration: none; padding: 8px 14px; font-size: 13px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1e293b;">
                    <i class="fas fa-id-card"></i> View Full Profile
                </a>
                <a href="edit_student.html?id=${student.id}" class="btn-refresh" style="text-decoration: none; padding: 8px 14px; font-size: 13px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; border: 1px solid #bfdbfe; border-radius: 8px; background: #eff6ff; color: #2563eb;">
                    <i class="fas fa-edit"></i> Edit Student
                </a>
                <button type="button" class="btn-refresh" onclick="window.triggerDeleteFromViewModal('${student.id}')" style="padding: 8px 14px; font-size: 13px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; border: 1px solid #fecaca; border-radius: 8px; background: #fef2f2; color: #dc2626; cursor: pointer;">
                    <i class="fas fa-trash-alt"></i> Delete / Transfer
                </button>
            </div>
        `;

        const viewGmailBtn = viewModalBody.querySelector('#viewModalGmailBtn');
        if (viewGmailBtn) {
            viewGmailBtn.addEventListener('click', function() {
                if (!student.email || student.email === '—') {
                    showAlert('This student has no registered email.', 'error');
                    return;
                }
                const emailPayload = EmailNotificationService.buildCredentialsEmail({
                    studentName: fullName,
                    firstName: student.firstName,
                    lastName: student.password || student.lastName,
                    email: student.email,
                    gradeLevel: student.grade,
                    strand: student.strand !== '—' ? student.strand : '',
                    schoolYear: '2026-2027'
                });
                EmailNotificationService.sendViaGmailWeb(emailPayload);
                showAlert(`Gmail compose opened for ${fullName}!`, 'success');
            });
        }

        viewModal.classList.add('show');
    }

    // ============================================
    // ALERT TOAST HELPER
    // ============================================

    function showAlert(message, type = 'error') {
        const alertContainer = document.getElementById('alertContainer');
        if (!alertContainer) return;
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.style.cssText = `
            padding: 12px 18px;
            border-radius: 10px;
            margin-bottom: 18px;
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 13.5px;
            font-weight: 500;
            background: ${type === 'success' ? '#f0fdf4' : (type === 'error' ? '#fef2f2' : '#eff6ff')};
            color: ${type === 'success' ? '#166534' : (type === 'error' ? '#991b1b' : '#1e40af')};
            border: 1px solid ${type === 'success' ? '#bbf7d0' : (type === 'error' ? '#fecaca' : '#bfdbfe')};
            animation: fadeIn 0.3s ease;
        `;
        const icon = type === 'error' ? 'fa-exclamation-circle' : (type === 'success' ? 'fa-check-circle' : 'fa-info-circle');
        alertDiv.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
        alertContainer.prepend(alertDiv);

        setTimeout(() => {
            alertDiv.style.opacity = '0';
            alertDiv.style.transition = 'opacity 0.3s ease';
            setTimeout(() => alertDiv.remove(), 300);
        }, 5000);
    }

    // ============================================
    // DELETE / TRANSFER REASON MODAL LOGIC
    // ============================================

    const deleteReasonModal = document.getElementById('deleteReasonModal');
    const closeDeleteModal = document.getElementById('closeDeleteModal');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const deleteStudentForm = document.getElementById('deleteStudentForm');
    const deleteReasonCategory = document.getElementById('deleteReasonCategory');
    const transferDetailsGroup = document.getElementById('transferDetailsGroup');
    const destinationSchool = document.getElementById('destinationSchool');
    const effectiveDate = document.getElementById('effectiveDate');
    const deleteRemarks = document.getElementById('deleteRemarks');
    const deleteStudentId = document.getElementById('deleteStudentId');
    const deleteStudentUserId = document.getElementById('deleteStudentUserId');
    const delStudentAvatar = document.getElementById('delStudentAvatar');
    const delStudentName = document.getElementById('delStudentName');
    const delStudentMeta = document.getElementById('delStudentMeta');
    const delStudentStatus = document.getElementById('delStudentStatus');
    const confirmDeleteSubmitBtn = document.getElementById('confirmDeleteSubmitBtn');

    function openDeleteModal(studentId) {
        const student = allStudents.find(s => s.id === studentId);
        if (!student) {
            showAlert('Student record not found.', 'error');
            return;
        }

        const initial = (student.firstName || 'S').charAt(0).toUpperCase();
        const fullName = `${student.firstName} ${student.lastName}`.trim() || 'Student';

        if (deleteStudentId) deleteStudentId.value = student.id;
        if (deleteStudentUserId) deleteStudentUserId.value = student.user_id || '';
        if (delStudentAvatar) delStudentAvatar.textContent = initial;
        if (delStudentName) delStudentName.textContent = fullName;
        if (delStudentMeta) delStudentMeta.textContent = `LRN: ${student.lrn || '—'} • ${student.grade || 'Grade 11'} (${student.section || 'Unassigned'})`;
        if (delStudentStatus) {
            delStudentStatus.textContent = student.status || 'Active';
            delStudentStatus.className = `badge ${student.status === 'Active' ? 'badge-active' : 'badge-inactive'}`;
        }

        if (effectiveDate) {
            effectiveDate.value = new Date().toISOString().split('T')[0];
        }

        if (deleteReasonCategory) {
            deleteReasonCategory.value = 'Transferred to Another School';
        }

        if (transferDetailsGroup && destinationSchool) {
            transferDetailsGroup.style.display = 'block';
            destinationSchool.required = true;
            destinationSchool.value = '';
        }

        if (deleteRemarks) deleteRemarks.value = '';

        const defaultModeRadio = document.querySelector('input[name="removalMode"][value="archive"]');
        if (defaultModeRadio) defaultModeRadio.checked = true;

        if (deleteReasonModal) {
            deleteReasonModal.style.display = 'flex';
            deleteReasonModal.classList.add('show');
        }
    }

    function closeDeleteModalDialog() {
        if (deleteReasonModal) {
            deleteReasonModal.style.display = 'none';
            deleteReasonModal.classList.remove('show');
        }
    }

    window.triggerDeleteFromViewModal = function(studentId) {
        if (viewModal) viewModal.classList.remove('show');
        openDeleteModal(studentId);
    };

    if (deleteReasonCategory) {
        deleteReasonCategory.addEventListener('change', function() {
            const isTransfer = this.value === 'Transferred to Another School';
            if (transferDetailsGroup) {
                transferDetailsGroup.style.display = isTransfer ? 'block' : 'none';
            }
            if (destinationSchool) {
                destinationSchool.required = isTransfer;
                if (!isTransfer) destinationSchool.value = '';
            }
        });
    }

    if (closeDeleteModal) closeDeleteModal.addEventListener('click', closeDeleteModalDialog);
    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', closeDeleteModalDialog);
    if (deleteReasonModal) {
        deleteReasonModal.addEventListener('click', function(e) {
            if (e.target === this) closeDeleteModalDialog();
        });
    }

    if (deleteStudentForm) {
        deleteStudentForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const studentId = deleteStudentId ? deleteStudentId.value : null;
            const userId = deleteStudentUserId ? deleteStudentUserId.value : null;
            if (!studentId) return;

            const student = allStudents.find(s => s.id === studentId);
            const studentFullName = student ? `${student.firstName} ${student.lastName}`.trim() : 'Student';
            const studentLrn = student?.lrn || '—';

            const reason = deleteReasonCategory ? deleteReasonCategory.value : 'Administrative Removal';
            const destSchool = destinationSchool ? destinationSchool.value.trim() : '';
            const effDate = effectiveDate ? effectiveDate.value : new Date().toISOString().split('T')[0];
            const remarks = deleteRemarks ? deleteRemarks.value.trim() : '';
            const modeInput = document.querySelector('input[name="removalMode"]:checked');
            const removalMode = modeInput ? modeInput.value : 'archive';

            if (confirmDeleteSubmitBtn) {
                confirmDeleteSubmitBtn.disabled = true;
                confirmDeleteSubmitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            }

            try {
                if (reason === 'Transferred to Another School') {
                    try {
                        await supabase.from('transferees').insert([{
                            student_id: studentId,
                            type: 'Transferred Out',
                            from_school: 'Placido L. Señor National High School',
                            to_school: destSchool || 'Another School',
                            reason: remarks ? `${reason}: ${remarks}` : reason,
                            status: 'Transferred',
                            requested_date: new Date(effDate).toISOString(),
                            created_at: new Date().toISOString()
                        }]);
                    } catch (tErr) {
                        console.warn('Transferees table insert warning:', tErr);
                    }
                }

                if (removalMode === 'permanent') {
                    const { error: delErr } = await supabase
                        .from('students')
                        .delete()
                        .eq('id', studentId);

                    if (delErr) throw delErr;

                    if (userId) {
                        try {
                            await supabase.from('users').delete().eq('id', userId);
                        } catch (uDelErr) {
                            console.warn('User account delete warning:', uDelErr);
                        }
                    }
                } else {
                    const { error: updErr } = await supabase
                        .from('students')
                        .update({
                            documents_status: `Archived: ${reason}${destSchool ? ' -> ' + destSchool : ''}`,
                            student_type: reason.includes('Transfer') ? 'Transferee' : 'Inactive',
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', studentId);

                    if (updErr) {
                        console.warn('Update students fallback:', updErr);
                    }
                }

                try {
                    await supabase.from('activity_logs').insert([{
                        user_id: currentUser?.id && currentUser.id.length === 36 ? currentUser.id : null,
                        role: 'admin',
                        action: `Student ${removalMode === 'permanent' ? 'Deleted' : 'Archived / Transferred Out'}`,
                        details: `Student: ${studentFullName} (LRN: ${studentLrn}) | Reason: ${reason}${destSchool ? ' | Destination: ' + destSchool : ''}${remarks ? ' | Remarks: ' + remarks : ''} | Mode: ${removalMode === 'permanent' ? 'Permanent Delete' : 'Archived / Inactive'} | Date: ${effDate}`,
                        timestamp: new Date().toISOString()
                    }]);
                } catch(logErr) {
                    console.warn('activity_logs logging warning:', logErr);
                }

                if (removalMode === 'permanent') {
                    allStudents = allStudents.filter(s => s.id !== studentId);
                } else {
                    const found = allStudents.find(s => s.id === studentId);
                    if (found) {
                        found.status = reason.includes('Transfer') ? 'Transferred Out' : 'Inactive';
                    }
                }

                closeDeleteModalDialog();
                showAlert(`✅ Student "${studentFullName}" ${removalMode === 'permanent' ? 'permanently removed' : 'marked as ' + (reason.includes('Transfer') ? 'Transferred Out' : 'Inactive')} successfully! Reason recorded: "${reason}".`, 'success');

                applyFilters();
                updateStats();

            } catch (err) {
                console.error('Error during student removal:', err);
                showAlert('Failed to process student removal: ' + (err.message || err), 'error');
            } finally {
                if (confirmDeleteSubmitBtn) {
                    confirmDeleteSubmitBtn.disabled = false;
                    confirmDeleteSubmitBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Confirm Removal';
                }
            }
        });
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================

    if (searchInput) searchInput.addEventListener('input', applyFilters);

    // Setup Level Navigation Tabs (All, Junior High, Senior High)
    document.querySelectorAll('.level-tab-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.level-tab-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            selectedLevel = this.dataset.level || 'all';

            // Reset grade pill
            document.querySelectorAll('.grade-pill-tag').forEach(p => p.classList.remove('active'));
            const allPill = document.querySelector('.grade-pill-tag[data-grade="all"]');
            if (allPill) allPill.classList.add('active');
            selectedGrade = 'all';
            if (filterGrade) filterGrade.value = '';

            populateSectionFilter();
            applyFilters();
        });
    });

    // Setup Fast Grade Pills (All, Grade 7, Grade 8, etc.)
    document.querySelectorAll('.grade-pill-tag').forEach(pill => {
        pill.addEventListener('click', function () {
            document.querySelectorAll('.grade-pill-tag').forEach(p => p.classList.remove('active'));
            this.classList.add('active');
            selectedGrade = this.dataset.grade || 'all';

            if (selectedGrade === 'all') {
                if (filterGrade) filterGrade.value = '';
            } else {
                if (filterGrade) filterGrade.value = selectedGrade;
                const targetLvl = getSchoolLevel(selectedGrade);
                document.querySelectorAll('.level-tab-btn').forEach(b => {
                    b.classList.toggle('active', b.dataset.level === targetLvl);
                });
                selectedLevel = targetLvl;
            }

            populateSectionFilter();
            applyFilters();
        });
    });

    if (filterGrade) {
        filterGrade.addEventListener('change', function() {
            const val = this.value;
            selectedGrade = val || 'all';

            document.querySelectorAll('.grade-pill-tag').forEach(p => {
                p.classList.toggle('active', (val ? p.dataset.grade === val : p.dataset.grade === 'all'));
            });

            if (val) {
                const targetLvl = getSchoolLevel(val);
                document.querySelectorAll('.level-tab-btn').forEach(b => {
                    b.classList.toggle('active', b.dataset.level === targetLvl);
                });
                selectedLevel = targetLvl;
            } else {
                document.querySelectorAll('.level-tab-btn').forEach(b => {
                    b.classList.toggle('active', b.dataset.level === 'all');
                });
                selectedLevel = 'all';
            }

            populateSectionFilter();
            applyFilters();
        });
    }

    if (filterSection) filterSection.addEventListener('change', applyFilters);
    if (filterStrand) filterStrand.addEventListener('change', applyFilters);
    if (filterStatus) filterStatus.addEventListener('change', applyFilters);
    if (filterStudentType) filterStudentType.addEventListener('change', applyFilters);

    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            const icon = this.querySelector('i');
            if (icon) icon.classList.add('fa-spin');
            loadStudents().finally(() => {
                setTimeout(() => {
                    if (icon) icon.classList.remove('fa-spin');
                }, 500);
            });
        });
    }

    if (closeViewModal) {
        closeViewModal.addEventListener('click', function() {
            viewModal.classList.remove('show');
        });
    }

    if (viewModal) {
        viewModal.addEventListener('click', function(e) {
            if (e.target === this) this.classList.remove('show');
        });
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            viewModal.classList.remove('show');
            document.querySelectorAll('.manage-dropdown.show').forEach(d => {
                d.classList.remove('show');
                d.classList.remove('dropup');
                const r = d.closest('tr');
                if (r) r.classList.remove('dropdown-open');
            });
        }
    });

    document.addEventListener('click', function(e) {
        if (!e.target.closest('.manage-dropdown')) {
            document.querySelectorAll('.manage-dropdown.show').forEach(d => {
                d.classList.remove('show');
                d.classList.remove('dropup');
                const r = d.closest('tr');
                if (r) r.classList.remove('dropdown-open');
            });
        }
    });

    // ============================================
    // LIVE REFRESH (SUPABASE REALTIME & CROSS-TAB)
    // ============================================

    try {
        supabase
            .channel('schema-db-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, payload => {
                console.log('🔄 Realtime update detected on students table:', payload);
                loadStudents();
            })
            .subscribe();
    } catch (e) {
        console.warn('Realtime subscription not available:', e);
    }

    window.addEventListener('storage', function(e) {
        if (!e.key || e.key.includes('hes_enrollment_updated') || e.key.includes('hes_latest_notification')) {
            console.log('🔄 Storage event detected, refreshing list...');
            loadStudents();
        }
    });

    // ============================================
    // INIT
    // ============================================

    loadStudents();

    console.log('✅ Students page initialized successfully');

})();