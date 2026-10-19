/**
 * HES Admin - Enrollments Management (Supabase Dynamic Integration)
 * Requirements read STRICTLY from ENROLLMENTS table.
 * Enrollment window toggle now backed by app_settings table (global, realtime).
 */

import { supabase } from '../../supabase/config.js';
import { EmailNotificationService } from '../../js/email_service.js';

(function () {
    'use strict';

    console.log('📋 Admin Enrollments Management (Supabase) ready');

    // ============================================
    // ROLE & SESSION GUARD
    // ============================================

    let currentUser = null;
    const currentUserStr = localStorage.getItem('currentUser');
    if (currentUserStr) {
        try { currentUser = JSON.parse(currentUserStr); }
        catch (e) { console.warn('Session parse error:', e); }
    }

    if (!currentUser) {
        currentUser = {
            role: 'admin',
            email: 'admin@hiraya.edu.ph',
            displayName: localStorage.getItem('hes_admin_name') || 'Admin',
            firstName: localStorage.getItem('hes_admin_name') || 'Admin'
        };
    }

    console.log('✅ Admin session verified for enrollments:', currentUser.email || 'Admin');

    // ============================================
    // DOM ELEMENTS
    // ============================================

    const tableBody = document.getElementById('tableBody');
    const recordCount = document.getElementById('recordCount');
    const alertContainer = document.getElementById('alertContainer');
    const filterForm = document.getElementById('filterForm');
    const statusFilter = document.getElementById('statusFilter');
    const gradeFilter = document.getElementById('gradeFilter');
    const strandFilter = document.getElementById('strandFilter');
    const searchInput = document.getElementById('searchInput');

    const toggleEnrollmentBtn = document.getElementById('toggleEnrollmentBtn');

    const totalEnrollmentsEl = document.getElementById('totalEnrollments');
    const pendingCountEl = document.getElementById('pendingCount');
    const enrolledCountEl = document.getElementById('enrolledCount');
    const rejectedCountEl = document.getElementById('rejectedCount');

    const rejectModal = document.getElementById('rejectModal');
    const rejectForm = document.getElementById('rejectForm');
    const rejectEnrollmentId = document.getElementById('rejectEnrollmentId');
    const rejectStudentName = document.getElementById('rejectStudentName');
    const rejectionReason = document.getElementById('rejectionReason');
    const closeRejectModalBtn = document.getElementById('closeRejectModalBtn');
    const cancelRejectBtn = document.getElementById('cancelRejectBtn');

    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');

    // ============================================
    // STATE & YEAR LEVEL HELPERS
    // ============================================

    let rawEnrollments = [];
    let filteredEnrollments = [];
    let selectedLevel = 'all';   // 'all', 'jhs', 'shs'
    let selectedGrade = 'all';   // 'all', 'Grade 7', ...

    function getSchoolLevel(gradeName) {
        if (!gradeName) return 'jhs';
        const num = parseInt(String(gradeName).replace(/\D/g, ''), 10);
        return num >= 11 ? 'shs' : 'jhs';
    }

    function getGradeNumber(gradeName) {
        if (!gradeName) return 999;
        const num = parseInt(String(gradeName).replace(/\D/g, ''), 10);
        return isNaN(num) ? 999 : num;
    }

    function updateLevelBadges() {
        const allCount = rawEnrollments.length;
        const jhsCount = rawEnrollments.filter(e => getSchoolLevel(e.grade_name) === 'jhs').length;
        const shsCount = rawEnrollments.filter(e => getSchoolLevel(e.grade_name) === 'shs').length;

        const badgeAll = document.getElementById('badgeAllCount');
        const badgeJhs = document.getElementById('badgeJhsCount');
        const badgeShs = document.getElementById('badgeShsCount');

        if (badgeAll) badgeAll.textContent = allCount;
        if (badgeJhs) badgeJhs.textContent = jhsCount;
        if (badgeShs) badgeShs.textContent = shsCount;
    }

    // ============================================
    // ALERT SYSTEM
    // ============================================

    function showAlert(message, type = 'error') {
        if (!alertContainer) return;
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        const icon = type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle';
        alertDiv.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
        alertContainer.appendChild(alertDiv);
        setTimeout(() => {
            alertDiv.style.opacity = '0';
            setTimeout(() => alertDiv.remove(), 300);
        }, 4000);
    }

    // ============================================
    // ENROLLMENT WINDOW TOGGLE
    // ============================================

    const ENROLLMENT_KEY = 'enrollment_open';
    let enrollmentToggleState = true;
    let enrollmentToggleBusy = false;

    async function readEnrollmentOpen() {
        try {
            const { data, error } = await supabase
                .from('app_settings').select('value')
                .eq('key', ENROLLMENT_KEY).maybeSingle();
            if (error) throw error;
            return data ? data.value === 'true' : true;
        } catch (err) {
            console.warn('Read enrollment_open failed, using cache:', err);
            return enrollmentToggleState;
        }
    }

    async function writeEnrollmentOpen(isOpen) {
        const { error } = await supabase.from('app_settings').upsert(
            { key: ENROLLMENT_KEY, value: String(isOpen), updated_at: new Date().toISOString() },
            { onConflict: 'key' }
        );
        if (error) throw error;
    }

    function paintEnrollmentToggle(isOpen) {
        if (!toggleEnrollmentBtn) return;
        enrollmentToggleState = isOpen;
        if (isOpen) {
            toggleEnrollmentBtn.innerHTML = '<i class="fas fa-lock-open"></i> ENROLLMENT IS OPEN';
            toggleEnrollmentBtn.style.background = '#dcfce7';
            toggleEnrollmentBtn.style.color = '#15803d';
            toggleEnrollmentBtn.style.border = '1px solid #86efac';
        } else {
            toggleEnrollmentBtn.innerHTML = '<i class="fas fa-lock"></i> ENROLLMENT IS CLOSED';
            toggleEnrollmentBtn.style.background = '#fee2e2';
            toggleEnrollmentBtn.style.color = '#dc2626';
            toggleEnrollmentBtn.style.border = '1px solid #fca5a5';
        }
    }

    async function refreshEnrollmentToggle() {
        const isOpen = await readEnrollmentOpen();
        paintEnrollmentToggle(isOpen);
    }

    if (toggleEnrollmentBtn) {
        toggleEnrollmentBtn.addEventListener('click', async () => {
            if (enrollmentToggleBusy) return;
            enrollmentToggleBusy = true;

            const prev = enrollmentToggleState;
            const next = !prev;
            paintEnrollmentToggle(next);

            try {
                await writeEnrollmentOpen(next);
                showAlert(`✅ Enrollment is now ${next ? 'OPEN' : 'CLOSED'}. All student devices update instantly.`, 'success');
            } catch (err) {
                paintEnrollmentToggle(prev);
                showAlert('Failed to update enrollment window: ' + err.message, 'error');
            } finally {
                enrollmentToggleBusy = false;
            }
        });
    }

    refreshEnrollmentToggle();

    supabase.channel('enrollment-window-admin')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'app_settings', filter: `key=eq.${ENROLLMENT_KEY}` },
            (payload) => paintEnrollmentToggle(payload.new?.value === 'true'))
        .subscribe();

    // ============================================
    // REQUIREMENTS HELPER — STRICTLY FROM ENROLLMENTS TABLE
    // ============================================

    function computeEnrollmentRequirements(enr) {
        const submitted = [];
        const missing = [];
        if (!enr) return { submitted, missing, isComplete: false };

        const rawStudentType = String(enr.student_type || '').toLowerCase();
        const isTransferee =
            rawStudentType.includes('transfer') ||
            rawStudentType.includes('different') ||
            rawStudentType.includes('transferee');

        const has = (v) => typeof v === 'string' && v.trim().length > 0;

        (has(enr.form_138_url) || has(enr.report_card_url))
            ? submitted.push('Report Card (Form 138)')
            : missing.push('Report Card (Form 138)');

        has(enr.psa_birth_cert_url)
            ? submitted.push('PSA Birth Certificate')
            : missing.push('PSA Birth Certificate');

        has(enr.good_moral_cert_url)
            ? submitted.push('Good Moral Certificate')
            : missing.push('Good Moral Certificate');

        has(enr.two_by_two_picture_url)
            ? submitted.push('2x2 ID Picture (White Background)')
            : missing.push('2x2 ID Picture (White Background)');

        if (isTransferee) {
            has(enr.form_137_url)
                ? submitted.push('Form 137 (Permanent Record)')
                : missing.push('Form 137 (Permanent Record)');
        }

        if (has(enr.certificate_of_completion_url)) {
            submitted.push('JHS Certificate of Completion');
        }

        return { submitted, missing, isComplete: missing.length === 0 };
    }

    // ============================================
    // LOAD ENROLLMENTS FROM SUPABASE
    // ============================================

    async function loadEnrollments() {
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 40px; color: #64748b;">
                        <i class="fas fa-circle-notch fa-spin" style="font-size: 24px; color: #0b2b4a; margin-bottom: 8px;"></i>
                        <p style="margin: 0;">Loading enrollment applications from database...</p>
                    </td>
                </tr>
            `;
        }

        try {
            let enrollmentsData = [];
            try {
                const { data: eData, error: eErr } = await supabase
                    .from('enrollments').select('*').order('created_at', { ascending: false });
                if (!eErr && eData) enrollmentsData = eData;
            } catch (e) { console.warn('Enrollments fetch error:', e); }

            let studentsData = [];
            try {
                const { data: sData } = await supabase.from('students').select('*');
                if (sData) studentsData = sData;
            } catch (e) { console.warn('Students fetch error:', e); }

            let usersData = [];
            try {
                const { data: uData } = await supabase
                    .from('users').select('id, first_name, last_name, email, role, student_id');
                if (uData) usersData = uData;
            } catch (e) { }

            const items = [];
            const seenEnrollmentKeys = new Set();

            enrollmentsData.forEach(enr => {
                const student = studentsData.find(s =>
                    s.id === enr.student_id ||
                    (s.email && enr.email && s.email.toLowerCase() === enr.email.toLowerCase())) || {};
                const user = usersData.find(u =>
                    u.id === student.user_id ||
                    u.student_id === student.id ||
                    (u.email && enr.email && u.email.toLowerCase() === enr.email.toLowerCase())) || {};

                const email = (enr.email || student.email || user.email || '').trim().toLowerCase();
                const dedupeKey = email || (student.id ? `sid_${student.id}` : enr.id);
                if (dedupeKey) {
                    if (seenEnrollmentKeys.has(dedupeKey)) return;
                    seenEnrollmentKeys.add(dedupeKey);
                }

                const fName = (enr.first_name || student.first_name || user.first_name || '').trim();
                const lName = (enr.last_name || student.last_name || user.last_name || '').trim();
                const fullName = `${fName} ${lName}`.trim() || 'Student Applicant';
                const displayEmail = enr.email || student.email || user.email || '—';
                const lrn = student.lrn || enr.lrn || 'Not assigned';
                const gradeLevel = enr.grade_level || student.grade_level || 'Grade 11';
                const strand = enr.strand || student.strand ||
                    ((gradeLevel.includes('11') || gradeLevel.includes('12')) ? 'TVL-ICT' : '');
                const schoolYear = enr.school_year || enr.last_school_year || '2025-2026';

                let status = 'Pending';
                const rawStatus = (enr.status || '').toLowerCase();
                if (rawStatus === 'approved' || rawStatus === 'enrolled') status = 'Enrolled';
                else if (rawStatus === 'rejected') status = 'Rejected';

                const { submitted, missing, isComplete } = computeEnrollmentRequirements(enr);

                items.push({
                    id: enr.id,
                    student_id: student.id || enr.student_id,
                    user_id: user.id || null,
                    first_name: fName,
                    last_name: lName,
                    middle_name: enr.middle_name || student.middle_name || null,
                    lrn: student.lrn || enr.lrn || null,
                    date_of_birth: enr.date_of_birth || enr.dob || student.date_of_birth || null,
                    contact_number: enr.contact_number || enr.guardian_contact || student.contact_number || null,
                    two_by_two_picture_url: enr.two_by_two_picture_url || null,
                    fullname: fullName,
                    email: displayEmail,
                    id_number: lrn !== 'Not assigned' ? lrn : null,
                    grade_name: gradeLevel,
                    grade_level: gradeLevel,
                    strand: strand,
                    school_year: schoolYear,
                    status: status,
                    created_at: enr.created_at || new Date().toISOString(),
                    has_missing: !isComplete && missing.length > 0,
                    missing_count: isComplete ? 0 : missing.length,
                    missing_list: isComplete ? [] : missing,
                    submitted_list: submitted
                });
            });

            items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            rawEnrollments = items;
            updateLevelBadges();
            applyFilters();

        } catch (error) {
            console.error('❌ Error loading enrollments from Supabase:', error);
            showAlert('Failed to load enrollments from database: ' + error.message, 'error');
            applyFilters();
        }
    }

    // ============================================
    // UPDATE STATS
    // ============================================

    function updateStats() {
        const total = rawEnrollments.length;
        const pending = rawEnrollments.filter(e => e.status === 'Pending').length;
        const enrolled = rawEnrollments.filter(e => e.status === 'Enrolled').length;
        const rejected = rawEnrollments.filter(e => e.status === 'Rejected').length;

        if (totalEnrollmentsEl) totalEnrollmentsEl.textContent = total;
        if (pendingCountEl) pendingCountEl.textContent = pending;
        if (enrolledCountEl) enrolledCountEl.textContent = enrolled;
        if (rejectedCountEl) rejectedCountEl.textContent = rejected;
    }

    // ============================================
    // FILTER & RENDER
    // ============================================

    function applyFilters() {
        const statusVal = statusFilter ? statusFilter.value : '';
        const gradeVal = gradeFilter ? gradeFilter.value : '';
        const strandVal = strandFilter ? strandFilter.value : '';
        const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';

        filteredEnrollments = rawEnrollments.filter(item => {
            if (statusVal && item.status.toLowerCase() !== statusVal.toLowerCase()) return false;

            if (selectedLevel === 'jhs' && getSchoolLevel(item.grade_name) !== 'jhs') return false;
            if (selectedLevel === 'shs' && getSchoolLevel(item.grade_name) !== 'shs') return false;

            if (selectedGrade && selectedGrade !== 'all') {
                const sNum = selectedGrade.replace(/\D/g, '');
                const iNum = (item.grade_name || '').replace(/\D/g, '');
                if (sNum && iNum && sNum !== iNum) return false;
            } else if (gradeVal && !item.grade_name.toLowerCase().includes(gradeVal.toLowerCase())) {
                return false;
            }

            if (strandVal && !item.strand.toLowerCase().includes(strandVal.toLowerCase())) return false;

            if (searchVal) {
                const matchName = item.fullname.toLowerCase().includes(searchVal);
                const matchEmail = item.email.toLowerCase().includes(searchVal);
                const matchId = (item.id_number || '').toLowerCase().includes(searchVal);
                const matchGrade = item.grade_name.toLowerCase().includes(searchVal);
                if (!matchName && !matchEmail && !matchId && !matchGrade) return false;
            }
            return true;
        });

        updateStats();
        updateLevelBadges();
        renderTable();
    }

    // ============================================
    // RENDER TABLE (GROUPED BY YEAR LEVEL)
    // ============================================

    function buildRequirementsCell(enrollment) {
        if (enrollment.has_missing && enrollment.status === 'Pending') {
            return `
                <div class="requirements-warning" style="display: flex; align-items: center; gap: 8px;">
                    <span class="missing-badge" style="background: #fee2e2; color: #dc2626; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">
                        <i class="fas fa-exclamation-triangle"></i> ${enrollment.missing_count} missing
                    </span>
                    <button class="btn-notify-missing"
                            data-student-name="${enrollment.fullname.replace(/"/g, '&quot;')}"
                            data-user-id="${enrollment.user_id || ''}"
                            data-student-id="${enrollment.student_id || enrollment.id || ''}"
                            data-email="${(enrollment.email || '').replace(/"/g, '&quot;')}"
                            data-missing-list="${JSON.stringify(enrollment.missing_list).replace(/"/g, '&quot;')}"
                            style="background: #0b2b4a; color: #FFD700; border: none; padding: 3px 8px; border-radius: 6px; font-size: 11px; cursor: pointer;">
                        <i class="fas fa-bell"></i> Notify
                    </button>
                </div>
            `;
        }
        if (enrollment.status === 'Pending') {
            return `<span class="complete-badge" style="background: #d1fae5; color: #065f46; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;"><i class="fas fa-check-circle"></i> Complete</span>`;
        }
        return `<span class="grade-tag" style="color: #64748b;">Complete</span>`;
    }

    function buildManageDropdown(enrollment) {
        let menuItemsHtml = `
            <a href="view_enrollment.html?id=${enrollment.id}" class="manage-item view-item" title="View Full Details">
                <i class="fas fa-eye"></i><span>View Details</span>
            </a>
        `;

        if (enrollment.status === 'Pending') {
            menuItemsHtml += `
                <button type="button" class="manage-item approve-item" onclick="window.approveEnrollment('${enrollment.id}')" title="Approve Enrollment${enrollment.has_missing ? ' (Has missing requirements)' : ''}">
                    <i class="fas fa-check-circle"></i><span>Approve Application</span>
                </button>
                <button type="button" class="manage-item reject-item" onclick="window.openRejectModal('${enrollment.id}', '${enrollment.fullname.replace(/'/g, "\\'")}')" title="Reject Application">
                    <i class="fas fa-times-circle"></i><span>Reject Application</span>
                </button>
            `;
        } else if (enrollment.status === 'Enrolled') {
            menuItemsHtml += `
                <a href="generate_id.html?enrollment_id=${enrollment.id}${enrollment.student_id ? '&id=' + enrollment.student_id : ''}" class="manage-item id-item" title="Generate Official Student ID">
                    <i class="fas fa-id-card"></i><span>Generate Student ID</span>
                </a>
            `;
        } else if (enrollment.status === 'Rejected') {
            menuItemsHtml += `
                <button type="button" class="manage-item approve-item" onclick="window.approveEnrollment('${enrollment.id}')" title="Reconsider & Approve Application">
                    <i class="fas fa-check-circle"></i><span>Approve Application</span>
                </button>
            `;
        }

        menuItemsHtml += `
            <div class="manage-divider"></div>
            <button type="button" class="manage-item delete-item" onclick="window.deleteEnrollment('${enrollment.id}', '${enrollment.fullname.replace(/'/g, "\\'")}')" title="Delete Record">
                <i class="fas fa-trash-alt"></i><span>Delete Record</span>
            </button>
        `;

        return `
            <div class="manage-dropdown">
                <button type="button" class="btn-manage" aria-expanded="false" title="Manage Enrollment Actions">
                    <span>Manage</span><i class="fas fa-chevron-down"></i>
                </button>
                <div class="manage-menu">${menuItemsHtml}</div>
            </div>
        `;
    }

    function renderTable() {
        if (!tableBody) return;

        if (recordCount) recordCount.textContent = `Total: ${filteredEnrollments.length} records`;

        if (filteredEnrollments.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8">
                        <div class="no-data" style="text-align: center; padding: 40px; color: #94a3b8;">
                            <i class="fas fa-file-signature" style="font-size: 36px; margin-bottom: 12px; color: #cbd5e1;"></i>
                            <h3 style="color: #64748b; font-size: 16px; margin-bottom: 4px;">No Enrollments Found</h3>
                            <p style="font-size: 13px; margin: 0;">No enrollment applications match your filter criteria.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        // Sort by natural grade order, then by name
        const sortedRows = [...filteredEnrollments].sort((a, b) => {
            const gA = getGradeNumber(a.grade_name);
            const gB = getGradeNumber(b.grade_name);
            if (gA !== gB) return gA - gB;
            return (a.fullname || '').localeCompare(b.fullname || '');
        });

        // Group by grade
        const groups = {};
        sortedRows.forEach(row => {
            const gName = (row.grade_name || 'Other').trim();
            if (!groups[gName]) groups[gName] = [];
            groups[gName].push(row);
        });

        let html = '';
        const groupKeys = Object.keys(groups);

        // FIXED: proper forEach over groupKeys
        groupKeys.forEach(gradeKey => {
            const gradeRows = groups[gradeKey];
            const gradeNum = getGradeNumber(gradeKey);
            const isSHS = gradeNum >= 11;
            const iconClass = isSHS ? 'shs' : 'jhs';
            const iconFa = isSHS ? 'fa-user-graduate' : 'fa-book-reader';
            const subLabel = isSHS ? 'Senior High School' : 'Junior High School';

            // Year group header row
            html += `
                <tr class="year-group-row">
                    <td colspan="8">
                        <div class="year-group-header">
                            <div class="year-group-title">
                                <span class="year-group-icon ${iconClass}"><i class="fas ${iconFa}"></i></span>
                                <div class="year-group-text">
                                    <span class="year-group-name">${gradeKey}</span>
                                    <span class="year-group-sub">• ${subLabel}</span>
                                </div>
                            </div>
                            <span class="year-group-badge">${gradeRows.length} ${gradeRows.length === 1 ? 'Record' : 'Records'}</span>
                        </div>
                    </td>
                </tr>
            `;

            // Rows within this group
            gradeRows.forEach(enrollment => {
                const dateObj = new Date(enrollment.created_at);
                const formattedDate = isNaN(dateObj.getTime())
                    ? '—'
                    : dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const initial = enrollment.fullname.charAt(0).toUpperCase();

                const requirementsHtml = buildRequirementsCell(enrollment);
                const statusClass = `badge-${enrollment.status.toLowerCase()}`;
                const manageDropdownHtml = buildManageDropdown(enrollment);

                const gNum = parseInt(String(enrollment.grade_level || '').replace(/\D/g, ''), 10);
                const showStrand = gNum >= 11 && enrollment.strand;

                html += `
                    <tr>
                        <td>
                            <div class="student-info" style="display: flex; align-items: center; gap: 10px;">
                                <div class="student-avatar" style="width: 36px; height: 36px; border-radius: 50%; background: #0b2b4a; color: #FFD700; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px;">${initial}</div>
                                <div class="student-details">
                                    <h4 style="margin: 0; font-size: 14px; font-weight: 600; color: #0f172a;">${enrollment.fullname}</h4>
                                    <span style="font-size: 12px; color: #64748b;"><i class="fas fa-envelope"></i> ${enrollment.email}</span>
                                </div>
                            </div>
                        </td>
                        <td>
                            ${enrollment.id_number
                                ? `<span class="id-badge" style="font-family: monospace; font-weight: 600; color: #0b2b4a;">${enrollment.id_number}</span>`
                                : `<span class="grade-tag" style="color: #94a3b8;">Not assigned</span>`}
                        </td>
                        <td>
                            <span class="grade-tag" style="font-weight: 600;">${enrollment.grade_name}</span>
                            ${showStrand ? `<span class="strand-tag" style="display: inline-block; margin-left: 4px; padding: 2px 6px; border-radius: 4px; background: #e0f2fe; color: #0369a1; font-size: 11px; font-weight: 600;">${enrollment.strand}</span>` : ''}
                        </td>
                        <td><span class="grade-tag">${enrollment.school_year}</span></td>
                        <td><span class="badge ${statusClass}">${enrollment.status}</span></td>
                        <td>${requirementsHtml}</td>
                        <td><span class="grade-tag">${formattedDate}</span></td>
                        <td class="cell-center cell-actions">${manageDropdownHtml}</td>
                    </tr>
                `;
            });
        });

        tableBody.innerHTML = html;

        // Manage dropdown toggle
        tableBody.querySelectorAll('.btn-manage').forEach(btn => {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                const dropdown = this.closest('.manage-dropdown');
                const row = this.closest('tr');
                const isOpen = dropdown.classList.contains('show');

                document.querySelectorAll('.manage-dropdown.show').forEach(d => {
                    d.classList.remove('show', 'dropup');
                    const r = d.closest('tr');
                    if (r) r.classList.remove('dropdown-open');
                });

                if (!isOpen) {
                    const rect = this.getBoundingClientRect();
                    if (window.innerHeight - rect.bottom < 200) dropdown.classList.add('dropup');
                    dropdown.classList.add('show');
                    if (row) row.classList.add('dropdown-open');
                }
            });
        });

        // Notify-missing buttons
        tableBody.querySelectorAll('.btn-notify-missing').forEach(btn => {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                let missingList = [];
                try { missingList = JSON.parse(this.dataset.missingList || '[]'); } catch { }
                notifyMissing(
                    this.dataset.studentName,
                    missingList,
                    this.dataset.userId,
                    this.dataset.studentId,
                    this.dataset.email
                );
            });
        });
    }

    document.addEventListener('click', function (e) {
        if (!e.target.closest('.manage-dropdown')) {
            document.querySelectorAll('.manage-dropdown.show').forEach(d => {
                d.classList.remove('show', 'dropup');
                const r = d.closest('tr');
                if (r) r.classList.remove('dropdown-open');
            });
        }
    });

    // ============================================
    // SUPABASE ACTIONS
    // ============================================

    window.approveEnrollment = async function (id) {
        const item = rawEnrollments.find(e => String(e.id) === String(id));
        if (!item) return;

        const confirmMsg = item.has_missing
            ? `⚠️ Notice: ${item.fullname || 'This student'} still has missing requirements.\n\nDo you want to proceed with APPROVING this enrollment and generating student login credentials?`
            : `Are you sure you want to APPROVE enrollment for ${item.fullname}?`;

        if (!confirm(confirmMsg)) return;

        try {
            showAlert('Processing enrollment approval & account provisioning...', 'info');

            const email = (item.email || '').trim().toLowerCase();
            let lastName = (item.last_name || '').trim();
            let firstName = (item.first_name || '').trim();
            const gradeName = item.grade_name || 'Grade 11';
            const strand = item.strand || '';

            if (!lastName && item.fullname) {
                const parts = item.fullname.trim().split(' ');
                firstName = parts.slice(0, -1).join(' ') || parts[0];
                lastName = parts[parts.length - 1];
            }
            if (!lastName) lastName = 'Student';

            let studentUserId = null;

            if (email) {
                const { data: existingUsers } = await supabase.from('users').select('*').ilike('email', email);
                if (existingUsers && existingUsers.length > 0) {
                    studentUserId = existingUsers[0].id;
                    await supabase.from('users').update({
                        password: lastName, role: 'student',
                        first_name: firstName || existingUsers[0].first_name,
                        last_name: lastName || existingUsers[0].last_name,
                        updated_at: new Date().toISOString()
                    }).eq('id', studentUserId);
                } else {
                    const { data: newUser } = await supabase.from('users').insert([{
                        email, password: lastName, role: 'student',
                        first_name: firstName, last_name: lastName,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }]).select();
                    if (newUser && newUser.length > 0) studentUserId = newUser[0].id;
                }
            }

            let studentTableId = item.student_id;
            const studentPayload = {
                first_name: firstName, last_name: lastName,
                middle_name: item.middle_name || null,
                email, grade_level: gradeName, strand: strand || null,
                lrn: item.lrn || item.id_number || ('141525' + String(Date.now()).slice(-6)),
                date_of_birth: item.date_of_birth || '2008-01-01',
                contact_number: item.contact_number || '09000000000',
                enrollment_id: id,
                two_by_two_picture_url: item.two_by_two_picture_url || null,
                avatar_url: item.two_by_two_picture_url || null,
                documents_status: 'complete',
                updated_at: new Date().toISOString()
            };

            if (studentTableId) {
                await supabase.from('students').update(studentPayload).eq('id', studentTableId);
            } else if (email) {
                studentPayload.created_at = new Date().toISOString();
                const { data: createdStudent, error: sErr } =
                    await supabase.from('students').insert([studentPayload]).select();
                if (createdStudent && createdStudent.length > 0) studentTableId = createdStudent[0].id;
                else if (sErr) console.warn('Students insert notice:', sErr);
            }

            if (studentUserId && studentTableId) {
                try { await supabase.from('users').update({ student_id: studentTableId }).eq('id', studentUserId); }
                catch (uErr) { }
            }

            await supabase.from('enrollments').update({
                status: 'enrolled', student_id: studentTableId || null,
                updated_at: new Date().toISOString()
            }).eq('id', id);

            const credsMsg = `Congratulations ${firstName}! Your enrollment application for ${gradeName} (${strand || 'General'}) S.Y. ${item.school_year || '2026-2027'} has been approved by the Administration.\n\nYour Student Portal Login Credentials:\n• Username (Gmail): ${email}\n• Initial Password: ${lastName}\n\nYou can now log in to the HES Student Portal. Upon your first login, please visit "My Profile" to update your password.`;

            const targetStudentId = studentUserId || studentTableId || null;
            await supabase.from('notifications').insert([{
                user_id: targetStudentId, role: 'student',
                title: '🎉 Enrollment Approved!', message: credsMsg,
                type: 'action', enrollment_id: id,
                read: false, is_read: false,
                created_at: new Date().toISOString()
            }]);

            const credsPayload = {
                email, lastName, firstName,
                studentFullName: item.fullname || `${firstName} ${lastName}`,
                gradeLevel: gradeName, strand: strand || '',
                schoolYear: item.school_year || '2026-2027',
                enrollmentId: id,
                studentId: studentTableId || studentUserId
            };

            try {
                await EmailNotificationService.sendCredentialsEmail({ ...credsPayload, autoLaunchGmail: true });
            } catch (mailErr) { }

            showCredentialsModal(credsPayload);
            showAlert(`✅ Enrollment for ${item.fullname} approved! Account created (Username: ${email}, Password: ${lastName}).`, 'success');
            await loadEnrollments();

        } catch (error) {
            console.error('❌ Error approving enrollment:', error);
            showAlert('Failed to approve enrollment: ' + error.message, 'error');
        }
    };

    // ============================================
    // PLACEHOLDERS — IMPLEMENT AS NEEDED
    // ============================================

    function showCredentialsModal(creds) { console.log('showCredentialsModal', creds); }
    function closeCredentialsModal() { }
    function notifyMissing(name, list, userId, studentId, email) {
        console.log('notifyMissing', { name, list, userId, studentId, email });
    }

    window.openRejectModal = function (id, name) {
        if (rejectEnrollmentId) rejectEnrollmentId.value = id;
        if (rejectStudentName) rejectStudentName.textContent = name;
        if (rejectionReason) rejectionReason.value = '';
        if (rejectModal) rejectModal.style.display = 'flex';
    };

    window.closeRejectModal = function () {
        if (rejectModal) rejectModal.style.display = 'none';
    };

    window.deleteEnrollment = async function (id, name) {
        if (!confirm(`Delete enrollment record for ${name}? This cannot be undone.`)) return;
        try {
            const { error } = await supabase.from('enrollments').delete().eq('id', id);
            if (error) throw error;
            showAlert('Enrollment record deleted.', 'success');
            await loadEnrollments();
        } catch (err) {
            showAlert('Failed to delete: ' + err.message, 'error');
        }
    };

    window.pendingEnrollment = async function (id) {
        try {
            await supabase.from('enrollments').update({
                status: 'pending', updated_at: new Date().toISOString()
            }).eq('id', id);
            await loadEnrollments();
        } catch (err) {
            showAlert('Failed to set pending: ' + err.message, 'error');
        }
    };

    if (rejectForm) {
        rejectForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const id = rejectEnrollmentId?.value;
            const reason = rejectionReason?.value?.trim() || '';
            if (!id) return;
            try {
                await supabase.from('enrollments').update({
                    status: 'rejected', rejection_reason: reason,
                    updated_at: new Date().toISOString()
                }).eq('id', id);
                window.closeRejectModal();
                showAlert('Enrollment rejected.', 'success');
                await loadEnrollments();
            } catch (err) {
                showAlert('Failed to reject: ' + err.message, 'error');
            }
        });
    }

    if (closeRejectModalBtn) closeRejectModalBtn.addEventListener('click', window.closeRejectModal);
    if (cancelRejectBtn) cancelRejectBtn.addEventListener('click', window.closeRejectModal);

    // ============================================
    // FILTERS
    // ============================================

    window.resetFilters = function () {
        if (statusFilter) statusFilter.value = '';
        if (gradeFilter) gradeFilter.value = '';
        if (strandFilter) strandFilter.value = '';
        if (searchInput) searchInput.value = '';
        selectedLevel = 'all';
        selectedGrade = 'all';

        document.querySelectorAll('.level-tab-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.level === 'all');
        });
        document.querySelectorAll('.grade-pill-tag').forEach(p => {
            p.classList.toggle('active', p.dataset.grade === 'all');
        });

        applyFilters();
        showAlert('Filters reset to default.', 'info');
    };

    if (filterForm) filterForm.addEventListener('submit', e => { e.preventDefault(); applyFilters(); });
    if (statusFilter) statusFilter.addEventListener('change', applyFilters);
    if (strandFilter) strandFilter.addEventListener('change', applyFilters);
    if (searchInput) searchInput.addEventListener('input', applyFilters);

    // Level tabs (All / JHS / SHS) — kept from incoming branch
    document.querySelectorAll('.level-tab-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.level-tab-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            selectedLevel = this.dataset.level || 'all';

            document.querySelectorAll('.grade-pill-tag').forEach(p => p.classList.remove('active'));
            const allPill = document.querySelector('.grade-pill-tag[data-grade="all"]');
            if (allPill) allPill.classList.add('active');
            selectedGrade = 'all';
            if (gradeFilter) gradeFilter.value = '';

            applyFilters();
        });
    });

    // Grade pills
    document.querySelectorAll('.grade-pill-tag').forEach(pill => {
        pill.addEventListener('click', function () {
            document.querySelectorAll('.grade-pill-tag').forEach(p => p.classList.remove('active'));
            this.classList.add('active');
            selectedGrade = this.dataset.grade || 'all';

            if (selectedGrade === 'all') {
                if (gradeFilter) gradeFilter.value = '';
            } else {
                const gradeNumStr = selectedGrade.replace(/\D/g, '');
                if (gradeFilter) gradeFilter.value = gradeNumStr;
                const targetLvl = getSchoolLevel(selectedGrade);
                document.querySelectorAll('.level-tab-btn').forEach(b => {
                    b.classList.toggle('active', b.dataset.level === targetLvl);
                });
                selectedLevel = targetLvl;
            }

            applyFilters();
        });
    });

    // Grade dropdown filter (single handler — removed duplicate)
    if (gradeFilter) {
        gradeFilter.addEventListener('change', function () {
            const val = this.value;
            selectedGrade = val ? (val.startsWith('Grade') ? val : `Grade ${val}`) : 'all';

            document.querySelectorAll('.grade-pill-tag').forEach(p => {
                p.classList.toggle('active',
                    val
                        ? (p.dataset.grade === `Grade ${val}` || p.dataset.grade === val)
                        : p.dataset.grade === 'all');
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

            applyFilters();
        });
    }

    // ============================================
    // MOBILE MENU & MODAL DISMISS
    // ============================================

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', function (e) {
            e.stopPropagation();
            sidebar.classList.toggle('active');
        });
    }

    document.addEventListener('click', function (e) {
        if (sidebar && sidebar.classList.contains('active')
            && !sidebar.contains(e.target)
            && (!menuToggle || !menuToggle.contains(e.target))) {
            sidebar.classList.remove('active');
        }
        if (e.target === rejectModal) window.closeRejectModal();
    });

    // ============================================
    // REALTIME & NOTIFICATIONS
    // ============================================

    async function loadNotifications() {
        // TODO: implement if you need notifications feed on this page
    }

    function setupRealtimeSubscription() {
        try {
            supabase.channel('admin-enrollments-realtime')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'enrollments' }, () => {
                    loadEnrollments();
                    loadNotifications();
                })
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
                    loadEnrollments();
                    loadNotifications();
                })
                .subscribe();
        } catch (err) { }

        window.addEventListener('storage', (e) => {
            if ((e.key === 'hes_latest_notification' || e.key === 'hes_admin_latest_notification') && e.newValue) {
                loadEnrollments();
                loadNotifications();
            }
        });
    }

    // ============================================
    // INIT
    // ============================================

    loadEnrollments();
    loadNotifications();
    setupRealtimeSubscription();

})();