/**
 * HES Admin - Enrollments Management (Supabase Dynamic Integration)
 * Requirements read STRICTLY from ENROLLMENTS table.
 * Enrollment window toggle now backed by app_settings table (global, realtime).
 * + Generative Report by Grade (summary table, detail cards, print, CSV export)
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

    // Enrollment Toggle
    const toggleEnrollmentBtn = document.getElementById('toggleEnrollmentBtn');

    // Stats Counters
    const totalEnrollmentsEl = document.getElementById('totalEnrollments');
    const pendingCountEl = document.getElementById('pendingCount');
    const enrolledCountEl = document.getElementById('enrolledCount');
    const rejectedCountEl = document.getElementById('rejectedCount');

    // Reject Modal Elements
    const rejectModal = document.getElementById('rejectModal');
    const rejectForm = document.getElementById('rejectForm');
    const rejectEnrollmentId = document.getElementById('rejectEnrollmentId');
    const rejectStudentName = document.getElementById('rejectStudentName');
    const rejectionReason = document.getElementById('rejectionReason');
    const closeRejectModalBtn = document.getElementById('closeRejectModalBtn');
    const cancelRejectBtn = document.getElementById('cancelRejectBtn');

    // Mobile Menu
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');

    // ============================================
    // STATE & YEAR LEVEL HELPERS
    // ============================================

    let rawEnrollments = [];
    let filteredEnrollments = [];
    let selectedLevel = 'all';
    let selectedGrade = 'all';

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
        const icon = type === 'error' ? 'fa-exclamation-circle' : (type === 'success' ? 'fa-check-circle' : 'fa-info-circle');
        alertDiv.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
        alertContainer.appendChild(alertDiv);

        setTimeout(() => {
            alertDiv.style.opacity = '0';
            setTimeout(() => alertDiv.remove(), 300);
        }, 4000);
    }

    // ============================================
    // ENROLLMENT WINDOW TOGGLE — SUPABASE-BACKED (app_settings)
    // ============================================

    const ENROLLMENT_KEY = 'enrollment_open';
    let enrollmentToggleState = true;
    let enrollmentToggleBusy = false;

    async function readEnrollmentOpen() {
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', ENROLLMENT_KEY)
                .maybeSingle();
            if (error) throw error;
            return data ? data.value === 'true' : true;
        } catch (err) {
            console.warn('Read enrollment_open failed, using cache:', err);
            return enrollmentToggleState;
        }
    }

    async function writeEnrollmentOpen(isOpen) {
        const { error } = await supabase
            .from('app_settings')
            .upsert(
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
                showAlert(
                    `✅ Enrollment is now ${next ? 'OPEN' : 'CLOSED'}. All student devices update instantly.`,
                    'success'
                );
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
            (payload) => {
                const isOpen = payload.new?.value === 'true';
                paintEnrollmentToggle(isOpen);
            })
        .subscribe();

    // ============================================
    // REQUIREMENTS HELPER — STRICTLY FROM ENROLLMENTS TABLE
    // ============================================

    function computeEnrollmentRequirements(enr) {
        const submitted = [];
        const missing = [];

        if (!enr) {
            return { submitted, missing, isComplete: false };
        }

        const rawStudentType = String(enr.student_type || '').toLowerCase();
        const isTransferee =
            rawStudentType.includes('transfer') ||
            rawStudentType.includes('different') ||
            rawStudentType.includes('transferee');

        const has = (v) => typeof v === 'string' && v.trim().length > 0;

        if (has(enr.form_138_url) || has(enr.report_card_url)) {
            submitted.push('Report Card (Form 138)');
        } else {
            missing.push('Report Card (Form 138)');
        }

        if (has(enr.psa_birth_cert_url)) {
            submitted.push('PSA Birth Certificate');
        } else {
            missing.push('PSA Birth Certificate');
        }

        if (has(enr.good_moral_cert_url)) {
            submitted.push('Good Moral Certificate');
        } else {
            missing.push('Good Moral Certificate');
        }

        if (has(enr.two_by_two_picture_url)) {
            submitted.push('2x2 ID Picture (White Background)');
        } else {
            missing.push('2x2 ID Picture (White Background)');
        }

        if (isTransferee) {
            if (has(enr.form_137_url)) {
                submitted.push('Form 137 (Permanent Record)');
            } else {
                missing.push('Form 137 (Permanent Record)');
            }
        }

        if (has(enr.certificate_of_completion_url)) {
            submitted.push('JHS Certificate of Completion');
        }

        const isComplete = missing.length === 0;

        return { submitted, missing, isComplete };
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
                    .from('enrollments')
                    .select('*')
                    .order('created_at', { ascending: false });
                if (!eErr && eData) enrollmentsData = eData;
            } catch (e) { console.warn('Enrollments fetch error:', e); }

            let studentsData = [];
            try {
                const { data: sData, error: sErr } = await supabase.from('students').select('*');
                if (!sErr && sData) studentsData = sData;
            } catch (e) { console.warn('Students fetch error:', e); }

            let usersData = [];
            try {
                const { data: uData } = await supabase.from('users').select('id, first_name, last_name, email, role, student_id');
                if (uData) usersData = uData;
            } catch (e) { }

            const items = [];
            const seenEnrollmentKeys = new Set();

            enrollmentsData.forEach(enr => {
                const student = studentsData.find(s => s.id === enr.student_id || (s.email && enr.email && s.email.toLowerCase() === enr.email.toLowerCase())) || {};
                const user = usersData.find(u => u.id === student.user_id || u.student_id === student.id || (u.email && enr.email && u.email.toLowerCase() === enr.email.toLowerCase())) || {};

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
                const strand = enr.strand || student.strand || (gradeLevel.includes('11') || gradeLevel.includes('12') ? 'TVL-ICT' : '');
                const schoolYear = enr.school_year || enr.last_school_year || '2025-2026';

                let status = 'Pending';
                const rawStatus = (enr.status || '').toLowerCase();
                if (rawStatus === 'approved' || rawStatus === 'enrolled') status = 'Enrolled';
                else if (rawStatus === 'rejected') status = 'Rejected';
                else status = 'Pending';

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

    function renderTable() {
        if (!tableBody) return;

        if (recordCount) {
            recordCount.textContent = `Total: ${filteredEnrollments.length} records`;
        }

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

        const sortedRows = [...filteredEnrollments].sort((a, b) => {
            const gA = getGradeNumber(a.grade_name);
            const gB = getGradeNumber(b.grade_name);
            if (gA !== gB) return gA - gB;
            return (a.fullname || '').localeCompare(b.fullname || '');
        });

        const groups = {};
        sortedRows.forEach(row => {
            const gName = (row.grade_name || 'Other').trim();
            if (!groups[gName]) groups[gName] = [];
            groups[gName].push(row);
        });

        let html = '';
        const groupKeys = Object.keys(groups);

        groupKeys.forEach(gradeKey => {
            const gradeRows = groups[gradeKey];
            const isShs = getSchoolLevel(gradeKey) === 'shs';
            const subLabel = isShs ? 'Senior High School' : 'Junior High School';
            const iconClass = isShs ? 'shs' : 'jhs';
            const iconFa = isShs ? 'fa-graduation-cap' : 'fa-school';

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

            gradeRows.forEach(enrollment => {
                const dateObj = new Date(enrollment.created_at);
                const formattedDate = isNaN(dateObj.getTime()) ? '—' : dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const initial = enrollment.fullname.charAt(0).toUpperCase();

                let requirementsHtml = '';
                if (enrollment.has_missing && enrollment.status === 'Pending') {
                    requirementsHtml = `
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
                } else if (enrollment.status === 'Pending') {
                    requirementsHtml = `<span class="complete-badge" style="background: #d1fae5; color: #065f46; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;"><i class="fas fa-check-circle"></i> Complete</span>`;
                } else {
                    requirementsHtml = `<span class="grade-tag" style="color: #64748b;">Complete</span>`;
                }

                const statusLower = enrollment.status.toLowerCase();
                const statusClass = `badge-${statusLower}`;

                let menuItemsHtml = `
                    <a href="view_enrollment.html?id=${enrollment.id}" class="manage-item view-item" title="View Full Details">
                        <i class="fas fa-eye"></i>
                        <span>View Details</span>
                    </a>
                `;

                if (enrollment.status === 'Pending') {
                    menuItemsHtml += `
                        <button type="button" class="manage-item approve-item" onclick="window.approveEnrollment('${enrollment.id}')" title="Approve Enrollment${enrollment.has_missing ? ' (Has missing requirements)' : ''}">
                            <i class="fas fa-check-circle"></i>
                            <span>Approve Application</span>
                        </button>
                        <button type="button" class="manage-item reject-item" onclick="window.openRejectModal('${enrollment.id}', '${enrollment.fullname.replace(/'/g, "\\'")}')" title="Reject Application">
                            <i class="fas fa-times-circle"></i>
                            <span>Reject Application</span>
                        </button>
                    `;
                } else if (enrollment.status === 'Enrolled') {
                    menuItemsHtml += `
                        <a href="generate_id.html?enrollment_id=${enrollment.id}${enrollment.student_id ? '&id=' + enrollment.student_id : ''}" class="manage-item id-item" title="Generate Official Student ID">
                            <i class="fas fa-id-card"></i>
                            <span>Generate Student ID</span>
                        </a>
                    `;
                } else if (enrollment.status === 'Rejected') {
                    menuItemsHtml += `
                        <button type="button" class="manage-item approve-item" onclick="window.approveEnrollment('${enrollment.id}')" title="Reconsider & Approve Application">
                            <i class="fas fa-check-circle"></i>
                            <span>Approve Application</span>
                        </button>
                    `;
                }

                menuItemsHtml += `
                    <div class="manage-divider"></div>
                    <button type="button" class="manage-item delete-item" onclick="window.deleteEnrollment('${enrollment.id}', '${enrollment.fullname.replace(/'/g, "\\'")}')" title="Delete Record">
                        <i class="fas fa-trash-alt"></i>
                        <span>Delete Record</span>
                    </button>
                `;

                const manageDropdownHtml = `
                    <div class="manage-dropdown">
                        <button type="button" class="btn-manage" aria-expanded="false" title="Manage Enrollment Actions">
                            <span>Manage</span>
                            <i class="fas fa-chevron-down"></i>
                        </button>
                        <div class="manage-menu">
                            ${menuItemsHtml}
                        </div>
                    </div>
                `;

                const gradeNum = parseInt(String(enrollment.grade_level || '').replace(/\D/g, ''), 10);
                const showStrand = gradeNum >= 11 && enrollment.strand;

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
                            ${enrollment.id_number ? `<span class="id-badge" style="font-family: monospace; font-weight: 600; color: #0b2b4a;">${enrollment.id_number}</span>` : `<span class="grade-tag" style="color: #94a3b8;">Not assigned</span>`}
                        </td>
                        <td>
                            <span class="grade-tag" style="font-weight: 600;">${enrollment.grade_name}</span>
                            ${showStrand ? `<span class="strand-tag" style="display: inline-block; margin-left: 4px; padding: 2px 6px; border-radius: 4px; background: #e0f2fe; color: #0369a1; font-size: 11px; font-weight: 600;">${enrollment.strand}</span>` : ''}
                        </td>
                        <td><span class="grade-tag">${enrollment.school_year}</span></td>
                        <td><span class="badge ${statusClass}">${enrollment.status}</span></td>
                        <td>${requirementsHtml}</td>
                        <td><span class="grade-tag">${formattedDate}</span></td>
                        <td class="cell-center cell-actions">
                            ${manageDropdownHtml}
                        </td>
                    </tr>
                `;
            });
        });

        tableBody.innerHTML = html;

        tableBody.querySelectorAll('.btn-manage').forEach(btn => {
            btn.addEventListener('click', function (e) {
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
                    if (spaceBelow < 200) {
                        dropdown.classList.add('dropup');
                    } else {
                        dropdown.classList.remove('dropup');
                    }
                    dropdown.classList.add('show');
                    if (row) row.classList.add('dropdown-open');
                }
            });
        });

        document.querySelectorAll('.btn-notify-missing').forEach(btn => {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                const studentName = this.dataset.studentName;
                const userId = this.dataset.userId;
                const studentId = this.dataset.studentId;
                const email = this.dataset.email;
                let missingList = [];
                try { missingList = JSON.parse(this.dataset.missingList || '[]'); } catch { missingList = []; }
                notifyMissing(studentName, missingList, userId, studentId, email);
            });
        });
    }

    document.addEventListener('click', function (e) {
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
    // SUPABASE ACTIONS (Approve, Reject, Delete, etc.)
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
                        email: email, password: lastName, role: 'student',
                        first_name: firstName, last_name: lastName,
                        created_at: new Date().toISOString(), updated_at: new Date().toISOString()
                    }]).select();
                    if (newUser && newUser.length > 0) studentUserId = newUser[0].id;
                }
            }

            let studentTableId = item.student_id;
            const studentPayload = {
                first_name: firstName, last_name: lastName, middle_name: item.middle_name || null,
                email: email, grade_level: gradeName, strand: strand || null,
                lrn: item.lrn || item.id_number || ('141525' + String(Date.now()).slice(-6)),
                date_of_birth: item.date_of_birth || '2008-01-01',
                contact_number: item.contact_number || '09000000000',
                enrollment_id: id, two_by_two_picture_url: item.two_by_two_picture_url || null,
                avatar_url: item.two_by_two_picture_url || null, documents_status: 'complete',
                updated_at: new Date().toISOString()
            };

            if (studentTableId) {
                await supabase.from('students').update(studentPayload).eq('id', studentTableId);
            } else if (email) {
                studentPayload.created_at = new Date().toISOString();
                const { data: createdStudent, error: sErr } = await supabase.from('students').insert([studentPayload]).select();
                if (createdStudent && createdStudent.length > 0) studentTableId = createdStudent[0].id;
                else if (sErr) console.warn('Students insert notice:', sErr);
            }

            if (studentUserId && studentTableId) {
                try { await supabase.from('users').update({ student_id: studentTableId }).eq('id', studentUserId); } catch (uErr) { }
            }

            await supabase.from('enrollments').update({
                status: 'enrolled', student_id: studentTableId || null, updated_at: new Date().toISOString()
            }).eq('id', id);

            const credsMsg = `Congratulations ${firstName}! Your enrollment application for ${gradeName} (${strand || 'General'}) S.Y. ${item.school_year || '2026-2027'} has been approved by the Administration.\n\nYour Student Portal Login Credentials:\n• Username (Gmail): ${email}\n• Initial Password: ${lastName}\n\nYou can now log in to the HES Student Portal. Upon your first login, please visit "My Profile" to update your password.`;

            const targetStudentId = studentUserId || studentTableId || null;
            await supabase.from('notifications').insert([{
                user_id: targetStudentId, role: 'student', title: '🎉 Enrollment Approved!',
                message: credsMsg, type: 'action', enrollment_id: id, read: false, is_read: false,
                created_at: new Date().toISOString()
            }]);

            const credsPayload = {
                email, lastName, firstName, studentFullName: item.fullname || `${firstName} ${lastName}`,
                gradeLevel: gradeName, strand: strand || '', schoolYear: item.school_year || '2026-2027',
                enrollmentId: id, studentId: studentTableId || studentUserId
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
    // CREDENTIALS MODAL
    // ============================================

    let activeCredentialsData = null;
    const credentialsModal = document.getElementById('credentialsModal');
    const credStudentName = document.getElementById('credStudentName');
    const credUsername = document.getElementById('credUsername');
    const credPassword = document.getElementById('credPassword');
    const closeCredentialsBtn = document.getElementById('closeCredentialsBtn');
    const dismissCredentialsBtn = document.getElementById('dismissCredentialsBtn');
    const modalGenerateIdBtn = document.getElementById('modalGenerateIdBtn');

    function showCredentialsModal(creds) {
        activeCredentialsData = creds;
        if (credStudentName) credStudentName.textContent = creds.studentFullName || 'Student';
        if (credUsername) credUsername.textContent = creds.email || '—';
        if (credPassword) credPassword.textContent = creds.lastName || '—';
        if (modalGenerateIdBtn && creds.enrollmentId) {
            modalGenerateIdBtn.href = `generate_id.html?enrollment_id=${creds.enrollmentId}${creds.studentId ? '&id=' + creds.studentId : ''}`;
        }
        if (credentialsModal) credentialsModal.style.display = 'flex';
    }

    function closeCredentialsModal() {
        if (credentialsModal) credentialsModal.style.display = 'none';
        activeCredentialsData = null;
    }

    if (closeCredentialsBtn) closeCredentialsBtn.addEventListener('click', closeCredentialsModal);
    if (dismissCredentialsBtn) dismissCredentialsBtn.addEventListener('click', closeCredentialsModal);

    const copyUsernameBtn = document.getElementById('copyUsernameBtn');
    const copyPasswordBtn = document.getElementById('copyPasswordBtn');
    const copyEmailTextBtn = document.getElementById('copyEmailTextBtn');
    const sendGmailCredBtn = document.getElementById('sendGmailCredBtn');
    const sendMailtoCredBtn = document.getElementById('sendMailtoCredBtn');

    if (copyUsernameBtn) copyUsernameBtn.addEventListener('click', async () => {
        if (!activeCredentialsData) return;
        try { await navigator.clipboard.writeText(activeCredentialsData.email); showAlert('Username copied.', 'success'); } catch { }
    });
    if (copyPasswordBtn) copyPasswordBtn.addEventListener('click', async () => {
        if (!activeCredentialsData) return;
        try { await navigator.clipboard.writeText(activeCredentialsData.lastName); showAlert('Password copied.', 'success'); } catch { }
    });
    if (copyEmailTextBtn) copyEmailTextBtn.addEventListener('click', async () => {
        if (!activeCredentialsData) return;
        const c = activeCredentialsData;
        const text = `Congratulations ${c.firstName}!\n\nYour enrollment has been approved.\n\nUsername: ${c.email}\nPassword: ${c.lastName}\n\nLogin at the PLSNSH Student Portal.`;
        try { await navigator.clipboard.writeText(text); showAlert('Credentials email text copied.', 'success'); } catch { }
    });
    if (sendGmailCredBtn) sendGmailCredBtn.addEventListener('click', async () => {
        if (!activeCredentialsData) return;
        try { await EmailNotificationService.sendCredentialsEmail({ ...activeCredentialsData, autoLaunchGmail: true }); } catch { }
    });
    if (sendMailtoCredBtn) sendMailtoCredBtn.addEventListener('click', () => {
        if (!activeCredentialsData) return;
        const c = activeCredentialsData;
        const subject = encodeURIComponent('PLSNSH Enrollment Approved — Login Credentials');
        const body = encodeURIComponent(`Congratulations ${c.firstName}!\n\nUsername: ${c.email}\nPassword: ${c.lastName}`);
        window.location.href = `mailto:${c.email}?subject=${subject}&body=${body}`;
    });

    // ============================================
    // REJECT MODAL
    // ============================================

    window.openRejectModal = function (id, name) {
        if (!rejectModal) return;
        if (rejectEnrollmentId) rejectEnrollmentId.value = id;
        if (rejectStudentName) rejectStudentName.value = name;
        if (rejectionReason) rejectionReason.value = '';
        rejectModal.style.display = 'flex';
    };

    window.closeRejectModal = function () {
        if (rejectModal) rejectModal.style.display = 'none';
    };

    if (closeRejectModalBtn) closeRejectModalBtn.addEventListener('click', window.closeRejectModal);
    if (cancelRejectBtn) cancelRejectBtn.addEventListener('click', window.closeRejectModal);

    if (rejectForm) {
        rejectForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = rejectEnrollmentId ? rejectEnrollmentId.value : '';
            const reason = rejectionReason ? rejectionReason.value.trim() : '';
            if (!id || !reason) {
                showAlert('Please provide a reason for rejection.', 'error');
                return;
            }

            const item = rawEnrollments.find(x => String(x.id) === String(id));
            try {
                await supabase.from('enrollments').update({
                    status: 'rejected',
                    rejection_reason: reason,
                    updated_at: new Date().toISOString()
                }).eq('id', id);

                if (item) {
                    const targetId = item.user_id || item.student_id || null;
                    await supabase.from('notifications').insert([{
                        user_id: targetId, role: 'student',
                        title: '⚠️ Enrollment Application Rejected',
                        message: `Your enrollment application has been rejected. Reason: ${reason}`,
                        type: 'warning', enrollment_id: id, read: false, is_read: false,
                        created_at: new Date().toISOString()
                    }]);
                }

                window.closeRejectModal();
                showAlert('Enrollment rejected.', 'success');
                await loadEnrollments();
            } catch (err) {
                showAlert('Failed to reject enrollment: ' + err.message, 'error');
            }
        });
    }

    // ============================================
    // DELETE
    // ============================================

    window.deleteEnrollment = async function (id, name) {
        if (!confirm(`Are you sure you want to DELETE the enrollment record for ${name}?\n\nThis action cannot be undone.`)) return;
        try {
            await supabase.from('enrollments').delete().eq('id', id);
            showAlert(`Enrollment for ${name} deleted.`, 'success');
            await loadEnrollments();
        } catch (err) {
            showAlert('Failed to delete enrollment: ' + err.message, 'error');
        }
    };

    // ============================================
    // NOTIFY MISSING (student)
    // ============================================

    async function notifyMissing(studentName, missingList, userId, studentId, email) {
        if (!missingList || missingList.length === 0) return;
        const list = missingList.map(m => `• ${m}`).join('\n');
        if (!confirm(`Send a notification to ${studentName} about ${missingList.length} missing requirement(s)?\n\n${list}`)) return;

        try {
            await supabase.from('notifications').insert([{
                user_id: userId || studentId || null,
                role: 'student',
                title: '📋 Missing Enrollment Requirements',
                message: `Hi ${studentName}, your enrollment application still needs the following:\n\n${list}\n\nPlease submit these as soon as possible so we can process your enrollment.`,
                type: 'warning',
                read: false,
                is_read: false,
                created_at: new Date().toISOString()
            }]);
            showAlert(`Notification sent to ${studentName}.`, 'success');
        } catch (err) {
            showAlert('Failed to send notification: ' + err.message, 'error');
        }
    }

    // ============================================
    // FILTERS & LEVEL NAV
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

    if (filterForm) filterForm.addEventListener('submit', function (e) { e.preventDefault(); applyFilters(); });
    if (statusFilter) statusFilter.addEventListener('change', applyFilters);
    if (strandFilter) strandFilter.addEventListener('change', applyFilters);
    if (searchInput) searchInput.addEventListener('input', applyFilters);

    // Level tabs
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

    if (gradeFilter) {
        gradeFilter.addEventListener('change', function () {
            const val = this.value;
            selectedGrade = val ? (val.startsWith('Grade') ? val : `Grade ${val}`) : 'all';

            document.querySelectorAll('.grade-pill-tag').forEach(p => {
                p.classList.toggle('active', (val ? (p.dataset.grade === `Grade ${val}` || p.dataset.grade === val) : p.dataset.grade === 'all'));
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
        if (sidebar && sidebar.classList.contains('active') && !sidebar.contains(e.target) && (!menuToggle || !menuToggle.contains(e.target))) {
            sidebar.classList.remove('active');
        }
        if (e.target === rejectModal) window.closeRejectModal();
        if (e.target === credentialsModal) closeCredentialsModal();
    });

    // ============================================
    // REALTIME & NOTIFICATIONS
    // ============================================

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

    async function loadNotifications() { /* your existing notification logic */ }

    // ============================================
    // GENERATIVE ENROLLMENT REPORT BY GRADE
    // ============================================

    const reportModal = document.getElementById('reportModal');
    const reportContent = document.getElementById('reportContent');
    const reportMeta = document.getElementById('reportMeta');
    const generateReportBtn = document.getElementById('generateReportBtn');
    const closeReportBtn = document.getElementById('closeReportBtn');
    const dismissReportBtn = document.getElementById('dismissReportBtn');
    const printReportBtn = document.getElementById('printReportBtn');
    const downloadCsvBtn = document.getElementById('downloadCsvBtn');

    const GRADE_ORDER = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];

    function buildGradeReport() {
        const groups = {};
        rawEnrollments.forEach(e => {
            const g = (e.grade_name || 'Unassigned').trim() || 'Unassigned';
            if (!groups[g]) groups[g] = [];
            groups[g].push(e);
        });

        const orderedGrades = [
            ...GRADE_ORDER.filter(g => groups[g]),
            ...Object.keys(groups).filter(g => !GRADE_ORDER.includes(g)).sort()
        ];

        const summary = orderedGrades.map(grade => {
            const rows = groups[grade];
            const total = rows.length;
            const pending = rows.filter(r => r.status === 'Pending').length;
            const enrolled = rows.filter(r => r.status === 'Enrolled').length;
            const rejected = rows.filter(r => r.status === 'Rejected').length;

            const missingCount = rows.filter(r => r.has_missing).length;
            const completeCount = total - missingCount;

            const strandMap = {};
            rows.forEach(r => {
                if (r.strand) strandMap[r.strand] = (strandMap[r.strand] || 0) + 1;
            });

            const level = getSchoolLevel(grade) === 'shs' ? 'SHS' : 'JHS';

            return {
                grade, level, total, pending, enrolled, rejected,
                missingCount, completeCount, strandMap, rows
            };
        });

        const grand = summary.reduce((acc, g) => {
            acc.total += g.total;
            acc.pending += g.pending;
            acc.enrolled += g.enrolled;
            acc.rejected += g.rejected;
            acc.missing += g.missingCount;
            acc.complete += g.completeCount;
            return acc;
        }, { total: 0, pending: 0, enrolled: 0, rejected: 0, missing: 0, complete: 0 });

        const jhsTotal = summary.filter(s => s.level === 'JHS').reduce((a, s) => a + s.total, 0);
        const shsTotal = summary.filter(s => s.level === 'SHS').reduce((a, s) => a + s.total, 0);

        return { summary, grand, jhsTotal, shsTotal };
    }

    function renderGradeReport() {
        const { summary, grand, jhsTotal, shsTotal } = buildGradeReport();
        const now = new Date();
        const stamp = now.toLocaleString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric',
            hour: 'numeric', minute: '2-digit'
        });

        if (reportMeta) {
            reportMeta.innerHTML = `
                <i class="fas fa-info-circle"></i>
                <strong>Generated:</strong> ${stamp} &nbsp;|&nbsp;
                <strong>Total Records:</strong> ${grand.total} &nbsp;|&nbsp;
                <strong>JHS:</strong> ${jhsTotal} &nbsp;|&nbsp;
                <strong>SHS:</strong> ${shsTotal}
            `;
        }

        if (!summary.length) {
            reportContent.innerHTML = `
                <div style="text-align:center; padding: 40px; color:#94a3b8;">
                    <i class="fas fa-file-signature" style="font-size:36px; margin-bottom:12px; color:#cbd5e1;"></i>
                    <h3 style="color:#64748b; font-size:16px; margin-bottom:4px;">No Enrollments Found</h3>
                    <p style="font-size:13px; margin:0;">There are no enrollment records to report on yet.</p>
                </div>`;
            return;
        }

        const thStyle = 'text-align:left; padding:10px 12px; background:#1B2A4A; color:#fff; font-size:11.5px; text-transform:uppercase; letter-spacing:.4px; font-weight:700; border:1px solid #1B2A4A;';
        const tdStyle = 'padding:9px 12px; border:1px solid #e2e8f0; font-size:13px; color:#0f172a;';
        const tdNum = 'padding:9px 12px; border:1px solid #e2e8f0; font-size:13px; text-align:center; font-weight:600; color:#0f172a;';

        const statusPill = (val, color, bg) =>
            `<span style="display:inline-block; min-width:26px; padding:2px 8px; border-radius:999px; background:${bg}; color:${color}; font-weight:700; font-size:12px;">${val}</span>`;

        const summaryRows = summary.map(s => {
            const levelColor = s.level === 'SHS' ? '#7c3aed' : '#0284c7';
            const levelBg = s.level === 'SHS' ? '#f3e8ff' : '#e0f2fe';
            return `
                <tr>
                    <td style="${tdStyle} font-weight:700;">
                        <i class="fas ${s.level === 'SHS' ? 'fa-graduation-cap' : 'fa-school'}" style="color:${levelColor}; margin-right:6px;"></i>
                        ${s.grade}
                    </td>
                    <td style="${tdNum}">
                        <span style="display:inline-block; padding:2px 8px; border-radius:999px; background:${levelBg}; color:${levelColor}; font-weight:700; font-size:11px;">${s.level}</span>
                    </td>
                    <td style="${tdNum}">${s.total}</td>
                    <td style="${tdNum}">${statusPill(s.pending, '#b45309', '#fef3c7')}</td>
                    <td style="${tdNum}">${statusPill(s.enrolled, '#065f46', '#d1fae5')}</td>
                    <td style="${tdNum}">${statusPill(s.rejected, '#991b1b', '#fee2e2')}</td>
                    <td style="${tdNum}">${s.completeCount}</td>
                    <td style="${tdNum}">${s.missingCount > 0
                    ? `<span style="color:#dc2626; font-weight:700;"><i class="fas fa-exclamation-triangle"></i> ${s.missingCount}</span>`
                    : `<span style="color:#059669;">0</span>`}</td>
                </tr>
            `;
        }).join('');

        const totalRow = `
            <tr style="background:#f1f5f9;">
                <td style="${tdStyle} font-weight:800; color:#0b2b4a;">GRAND TOTAL</td>
                <td style="${tdNum}">—</td>
                <td style="${tdNum} font-weight:800;">${grand.total}</td>
                <td style="${tdNum} font-weight:800;">${grand.pending}</td>
                <td style="${tdNum} font-weight:800;">${grand.enrolled}</td>
                <td style="${tdNum} font-weight:800;">${grand.rejected}</td>
                <td style="${tdNum} font-weight:800;">${grand.complete}</td>
                <td style="${tdNum} font-weight:800; color:${grand.missing > 0 ? '#dc2626' : '#059669'};">${grand.missing}</td>
            </tr>
        `;

        const detailCards = summary.map(s => {
            const levelColor = s.level === 'SHS' ? '#7c3aed' : '#0284c7';
            const levelBg = s.level === 'SHS' ? '#f3e8ff' : '#e0f2fe';
            const strands = Object.entries(s.strandMap);
            const strandHtml = strands.length
                ? strands.map(([name, count]) => `
                    <div style="display:flex; justify-content:space-between; padding:6px 10px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; font-size:12.5px; margin-bottom:4px;">
                        <span style="color:#0f172a; font-weight:600;">${name}</span>
                        <span style="color:${levelColor}; font-weight:700;">${count}</span>
                    </div>`).join('')
                : `<div style="font-size:12px; color:#94a3b8; font-style:italic;">No strand data (JHS or unspecified)</div>`;

            const completionPct = s.total ? Math.round((s.completeCount / s.total) * 100) : 0;

            return `
                <div style="border:1px solid #e2e8f0; border-radius:10px; padding:14px 16px; margin-bottom:12px; background:#fff;">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="display:inline-flex; width:30px; height:30px; border-radius:8px; background:${levelBg}; color:${levelColor}; align-items:center; justify-content:center; font-size:14px;">
                                <i class="fas ${s.level === 'SHS' ? 'fa-graduation-cap' : 'fa-school'}"></i>
                            </span>
                            <div>
                                <div style="font-weight:800; font-size:15px; color:#0b2b4a;">${s.grade}</div>
                                <div style="font-size:11px; color:#64748b; text-transform:uppercase; letter-spacing:.4px;">${s.level} • ${s.total} record${s.total === 1 ? '' : 's'}</div>
                            </div>
                        </div>
                        <div style="display:flex; gap:6px; flex-wrap:wrap;">
                            <span style="padding:3px 9px; border-radius:999px; background:#fef3c7; color:#b45309; font-weight:700; font-size:11.5px;">Pending: ${s.pending}</span>
                            <span style="padding:3px 9px; border-radius:999px; background:#d1fae5; color:#065f46; font-weight:700; font-size:11.5px;">Enrolled: ${s.enrolled}</span>
                            <span style="padding:3px 9px; border-radius:999px; background:#fee2e2; color:#991b1b; font-weight:700; font-size:11.5px;">Rejected: ${s.rejected}</span>
                        </div>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                        <div>
                            <div style="font-size:11px; text-transform:uppercase; color:#475569; font-weight:700; margin-bottom:6px; letter-spacing:.4px;">
                                <i class="fas fa-layer-group" style="color:${levelColor};"></i> Strand Distribution
                            </div>
                            ${strandHtml}
                        </div>
                        <div>
                            <div style="font-size:11px; text-transform:uppercase; color:#475569; font-weight:700; margin-bottom:6px; letter-spacing:.4px;">
                                <i class="fas fa-clipboard-check" style="color:${levelColor};"></i> Requirements
                            </div>
                            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:8px 10px; font-size:12.5px; margin-bottom:6px;">
                                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                                    <span style="color:#0f172a;">Complete</span>
                                    <span style="color:#059669; font-weight:700;">${s.completeCount}</span>
                                </div>
                                <div style="display:flex; justify-content:space-between;">
                                    <span style="color:#0f172a;">Missing items</span>
                                    <span style="color:${s.missingCount > 0 ? '#dc2626' : '#059669'}; font-weight:700;">${s.missingCount}</span>
                                </div>
                            </div>
                            <div style="height:8px; background:#e2e8f0; border-radius:999px; overflow:hidden;">
                                <div style="height:100%; width:${completionPct}%; background:linear-gradient(90deg, #10b981, #059669); transition: width .4s;"></div>
                            </div>
                            <div style="font-size:11px; color:#64748b; margin-top:4px; text-align:right;">${completionPct}% complete</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        reportContent.innerHTML = `
            <h4 style="margin: 0 0 10px; font-size:14px; font-weight:800; color:#0b2b4a; display:flex; align-items:center; gap:8px;">
                <i class="fas fa-table"></i> Summary by Grade Level
            </h4>
            <div style="overflow-x:auto; margin-bottom:24px; border-radius:8px; overflow:hidden; border:1px solid #e2e8f0;">
                <table style="width:100%; border-collapse:collapse; min-width:640px;">
                    <thead>
                        <tr>
                            <th style="${thStyle}">Grade Level</th>
                            <th style="${thStyle} text-align:center;">Level</th>
                            <th style="${thStyle} text-align:center;">Total</th>
                            <th style="${thStyle} text-align:center;">Pending</th>
                            <th style="${thStyle} text-align:center;">Enrolled</th>
                            <th style="${thStyle} text-align:center;">Rejected</th>
                            <th style="${thStyle} text-align:center;">Complete</th>
                            <th style="${thStyle} text-align:center;">Missing</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${summaryRows}
                        ${totalRow}
                    </tbody>
                </table>
            </div>

            <h4 style="margin: 0 0 12px; font-size:14px; font-weight:800; color:#0b2b4a; display:flex; align-items:center; gap:8px;">
                <i class="fas fa-list-ul"></i> Detailed Breakdown
            </h4>
            ${detailCards}
        `;
    }

    function openReportModal() {
        if (!reportModal) return;
        renderGradeReport();
        reportModal.style.display = 'flex';
    }

    function closeReportModal() {
        if (reportModal) reportModal.style.display = 'none';
    }

    function exportReportCsv() {
        const { summary, grand } = buildGradeReport();
        if (!summary.length) {
            showAlert('No enrollment data to export.', 'error');
            return;
        }

        const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const lines = [];

        lines.push(['Grade Level', 'Level', 'Total', 'Pending', 'Enrolled', 'Rejected', 'Complete Requirements', 'Missing Requirements', 'Strands'].map(esc).join(','));

        summary.forEach(s => {
            const strands = Object.entries(s.strandMap).map(([k, v]) => `${k}: ${v}`).join('; ');
            lines.push([
                s.grade, s.level, s.total, s.pending, s.enrolled, s.rejected,
                s.completeCount, s.missingCount, strands || '—'
            ].map(esc).join(','));
        });

        lines.push([
            'GRAND TOTAL', '—', grand.total, grand.pending, grand.enrolled, grand.rejected,
            grand.complete, grand.missing, '—'
        ].map(esc).join(','));

        const csv = '\uFEFF' + lines.join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const stamp = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `enrollment-report-by-grade_${stamp}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showAlert('✅ Report exported to CSV.', 'success');
    }

    function printReport() {
        if (!reportContent) return;
        const { summary, grand, jhsTotal, shsTotal } = buildGradeReport();
        const stamp = new Date().toLocaleString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
        });

        const win = window.open('', '_blank');
        win.document.write(`
            <html>
            <head>
                <title>Enrollment Report by Grade — PLSNSH</title>
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #0f172a; }
                    h1 { font-size: 20px; color: #0b2b4a; margin: 0 0 4px; }
                    .meta { font-size: 12px; color: #64748b; margin-bottom: 20px; border-bottom: 2px solid #0b2b4a; padding-bottom: 10px; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; }
                    th { background: #1B2A4A; color: #fff; padding: 8px 10px; text-align: left; }
                    td { padding: 6px 10px; border: 1px solid #e2e8f0; }
                    tr:nth-child(even) td { background: #f8fafc; }
                    .total-row td { background: #f1f5f9 !important; font-weight: 800; }
                    h2 { font-size: 15px; color: #0b2b4a; margin: 20px 0 8px; }
                    .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 12px; page-break-inside: avoid; }
                    .card h3 { margin: 0 0 6px; font-size: 13px; color: #0b2b4a; }
                    .row { display: flex; justify-content: space-between; font-size: 12px; padding: 2px 0; }
                    @media print { body { padding: 0; } }
                </style>
            </head>
            <body>
                <h1>Enrollment Report by Grade Level</h1>
                <div class="meta">
                    Placido L. Señor National High School &nbsp;|&nbsp;
                    Generated: ${stamp} &nbsp;|&nbsp;
                    Total: ${grand.total} &nbsp;|&nbsp; JHS: ${jhsTotal} &nbsp;|&nbsp; SHS: ${shsTotal}
                </div>

                <h2>Summary by Grade Level</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Grade Level</th><th>Level</th><th>Total</th>
                            <th>Pending</th><th>Enrolled</th><th>Rejected</th>
                            <th>Complete</th><th>Missing</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${summary.map(s => `
                            <tr>
                                <td><strong>${s.grade}</strong></td>
                                <td>${s.level}</td>
                                <td>${s.total}</td>
                                <td>${s.pending}</td>
                                <td>${s.enrolled}</td>
                                <td>${s.rejected}</td>
                                <td>${s.completeCount}</td>
                                <td>${s.missingCount}</td>
                            </tr>`).join('')}
                        <tr class="total-row">
                            <td>GRAND TOTAL</td><td>—</td>
                            <td>${grand.total}</td><td>${grand.pending}</td>
                            <td>${grand.enrolled}</td><td>${grand.rejected}</td>
                            <td>${grand.complete}</td><td>${grand.missing}</td>
                        </tr>
                    </tbody>
                </table>

                <h2>Detailed Breakdown</h2>
                ${summary.map(s => `
                    <div class="card">
                        <h3>${s.grade} (${s.level}) — ${s.total} record${s.total === 1 ? '' : 's'}</h3>
                        <div class="row"><span>Pending</span><strong>${s.pending}</strong></div>
                        <div class="row"><span>Enrolled</span><strong>${s.enrolled}</strong></div>
                        <div class="row"><span>Rejected</span><strong>${s.rejected}</strong></div>
                        <div class="row"><span>Complete Requirements</span><strong>${s.completeCount}</strong></div>
                        <div class="row"><span>Missing Requirements</span><strong>${s.missingCount}</strong></div>
                        ${Object.keys(s.strandMap).length
                        ? `<div style="margin-top:6px; padding-top:6px; border-top:1px dashed #cbd5e1;">
                                 <div style="font-size:11px; color:#64748b; margin-bottom:4px;">Strand Distribution:</div>
                                 ${Object.entries(s.strandMap).map(([k, v]) => `<div class="row"><span>${k}</span><strong>${v}</strong></div>`).join('')}
                               </div>`
                        : ''}
                    </div>`).join('')}
            </body>
            </html>
        `);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); }, 400);
    }

    if (generateReportBtn) generateReportBtn.addEventListener('click', openReportModal);
    if (closeReportBtn) closeReportBtn.addEventListener('click', closeReportModal);
    if (dismissReportBtn) dismissReportBtn.addEventListener('click', closeReportModal);
    if (printReportBtn) printReportBtn.addEventListener('click', printReport);
    if (downloadCsvBtn) downloadCsvBtn.addEventListener('click', exportReportCsv);

    if (reportModal) {
        reportModal.addEventListener('click', (e) => {
            if (e.target === reportModal) closeReportModal();
        });
    }

    // ============================================
    // INIT
    // ============================================

    loadEnrollments();
    loadNotifications();
    setupRealtimeSubscription();

})();