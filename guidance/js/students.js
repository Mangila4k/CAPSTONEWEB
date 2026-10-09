/**
 * Guidance Student Conduct Directory & Emergency Parent QR Logic
 * HES - Hiraya Enrollment System
 */

import { supabase } from '../../supabase/config.js';

(function () {
    'use strict';

    console.log('🧑‍🎓 Guidance Student Conduct Directory initializing...');

    // DOM Elements
    const counselorAvatar = document.getElementById('counselorAvatar') || document.getElementById('counselorInitial');
    const counselorName = document.getElementById('counselorName');
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const logoutBtn = document.getElementById('logoutBtn');
    const alertContainer = document.getElementById('alertContainer');

    // KPI Elements
    const statTotalStudents = document.getElementById('statTotalStudents');
    const statGoodStanding = document.getElementById('statGoodStanding');
    const statInCounseling = document.getElementById('statInCounseling');
    const statWithViolations = document.getElementById('statWithViolations');

    // Filters & Tables
    const searchInput = document.getElementById('searchInput');
    const filterGrade = document.getElementById('filterGrade');
    const filterStanding = document.getElementById('filterStanding');
    const btnResetFilters = document.getElementById('btnResetFilters');
    const studentCountBadge = document.getElementById('studentCountBadge');
    const studentsTableBody = document.getElementById('studentsTableBody');

    // QR Modal Elements
    const modalStudentQR = document.getElementById('modalStudentQR');
    const qrCanvasContainer = document.getElementById('qrCanvasContainer');
    const qrModalStudentName = document.getElementById('qrModalStudentName');
    const qrModalMeta = document.getElementById('qrModalMeta');
    const qrModalParentName = document.getElementById('qrModalParentName');
    const qrModalParentPhone = document.getElementById('qrModalParentPhone');
    const qrModalParentEmail = document.getElementById('qrModalParentEmail');
    const qrModalParentFB = document.getElementById('qrModalParentFB');
    const qrBtnCall = document.getElementById('qrBtnCall');
    const qrBtnEmail = document.getElementById('qrBtnEmail');
    const qrBtnFB = document.getElementById('qrBtnFB');
    const qrStudentConductSummary = document.getElementById('qrStudentConductSummary');

    let currentUser = null;
    let allStudents = [];
    let allViolations = [];
    let allSessions = [];
    let currentQRCodeInstance = null;

    function checkAuth() {
        try {
            const stored = localStorage.getItem('currentUser');
            if (stored) currentUser = JSON.parse(stored);
        } catch (e) {
            console.error('Session parse error:', e);
        }

        if (!currentUser) {
            window.location.replace('../auth/login.html');
            return false;
        }

        const role = (currentUser.role || '').toLowerCase();
        if (role !== 'guidance' && role !== 'admin') {
            window.location.replace('../auth/login.html');
            return false;
        }

        const displayName = currentUser.displayName ||
            `${currentUser.firstName || currentUser.first_name || ''} ${currentUser.lastName || currentUser.last_name || ''}`.trim() ||
            'Sarah (Counselor)';

        if (counselorName) counselorName.textContent = displayName;
        if (counselorAvatar) counselorAvatar.textContent = (displayName.charAt(0) || 'G').toUpperCase();

        return true;
    }

    // ============================================
    // 2. DATA INITIALIZATION
    // ============================================
    async function init() {
        try {
            const [studentsRes, violationsRes, sessionsRes] = await Promise.all([
                supabase.from('students').select('*').order('last_name', { ascending: true }),
                supabase.from('student_violations').select('*'),
                supabase.from('counseling_sessions').select('*')
            ]);

            allStudents = studentsRes.data || [];
            allViolations = violationsRes.data || [];
            allSessions = sessionsRes.data || [];

            updateStats();
            applyFilters();
        } catch (err) {
            console.error('Error loading student directory:', err);
            showAlert('Failed to load student directory: ' + err.message, 'danger');
        }
    }

    function updateStats() {
        const total = allStudents.length;

        let goodStandingCount = 0;
        let inCounselingCount = 0;
        let withViolationsCount = 0;

        allStudents.forEach(stu => {
            const standing = getStudentStanding(stu);
            if (standing === 'With Violations') withViolationsCount++;
            else if (standing === 'In Counseling') inCounselingCount++;
            else goodStandingCount++;
        });

        if (statTotalStudents) statTotalStudents.textContent = total;
        if (statGoodStanding) statGoodStanding.textContent = goodStandingCount;
        if (statInCounseling) statInCounseling.textContent = inCounselingCount;
        if (statWithViolations) statWithViolations.textContent = withViolationsCount;
    }

    function getStudentStanding(stu) {
        const studentViolations = allViolations.filter(v =>
            (v.student_id && v.student_id === stu.id) ||
            (v.lrn && v.lrn === stu.lrn)
        );
        const hasActiveViolations = studentViolations.some(v => (v.status || '').toLowerCase() !== 'resolved');
        if (hasActiveViolations) return 'With Violations';

        const studentSessions = allSessions.filter(s =>
            (s.student_id && s.student_id === stu.id) ||
            (s.lrn && s.lrn === stu.lrn)
        );
        const hasActiveSessions = studentSessions.some(s => {
            const st = (s.status || '').toLowerCase();
            return st === 'scheduled' || st === 'follow-up needed';
        });
        if (hasActiveSessions) return 'In Counseling';

        return 'Good Standing';
    }

    // ============================================
    // 4. FILTERING & RENDERING
    // ============================================
    function applyFilters() {
        const search = (searchInput ? searchInput.value : '').toLowerCase().trim();
        const gradeVal = filterGrade ? filterGrade.value : '';
        const standingVal = filterStanding ? filterStanding.value : '';

        const filtered = allStudents.filter(stu => {
            const fullName = `${stu.last_name || ''} ${stu.first_name || ''} ${stu.middle_name || ''}`.toLowerCase();
            const parentName = (stu.parent_name || stu.guardian_name || '').toLowerCase();
            const lrn = (stu.lrn || '').toLowerCase();
            const strand = (stu.strand || stu.track || '').toLowerCase();

            const matchesSearch = !search ||
                fullName.includes(search) ||
                parentName.includes(search) ||
                lrn.includes(search) ||
                strand.includes(search);

            const matchesGrade = !gradeVal || (stu.grade_level || '').toLowerCase() === gradeVal.toLowerCase();

            const studentStanding = getStudentStanding(stu);
            const matchesStanding = !standingVal || studentStanding.toLowerCase() === standingVal.toLowerCase();

            return matchesSearch && matchesGrade && matchesStanding;
        });

        renderStudentsTable(filtered);
    }

    function renderStudentsTable(records) {
        if (!studentsTableBody) return;

        if (studentCountBadge) {
            studentCountBadge.textContent = `Showing ${records.length} of ${allStudents.length} students`;
        }

        if (records.length === 0) {
            studentsTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-cell">
                        <i class="fas fa-users-slash"></i>
                        <p>No student records match the search filter.</p>
                    </td>
                </tr>
            `;
            return;
        }

        studentsTableBody.innerHTML = records.map(stu => {
            const fullName = `${stu.last_name || ''}, ${stu.first_name || ''} ${stu.middle_name || ''}`.trim();
            const standing = getStudentStanding(stu);
            const parentName = stu.parent_name || stu.guardian_name || 'Guardian Not Listed';
            const parentPhone = stu.parent_contact || stu.emergency_contact || '—';
            const parentEmail = stu.parent_email || '—';
            const parentFB = stu.parent_facebook || '—';

            const firstName = stu.first_name || '';
            const lastName = stu.last_name || '';
            const initials = ((firstName.charAt(0) || '') + (lastName.charAt(0) || '')).toUpperCase() || 'S';

            let standingBadgeHtml = '';
            if (standing === 'With Violations') {
                standingBadgeHtml = `<span class="badge-status badge-danger"><i class="fas fa-triangle-exclamation"></i> Active Violations</span>`;
            } else if (standing === 'In Counseling') {
                standingBadgeHtml = `<span class="badge-status badge-warning"><i class="fas fa-user-clock"></i> In Counseling</span>`;
            } else {
                standingBadgeHtml = `<span class="badge-status badge-success"><i class="fas fa-shield-check"></i> Good Standing</span>`;
            }

            return `
                <tr>
                    <td>
                        <div class="student-cell">
                            <div class="student-avatar">${escapeHtml(initials)}</div>
                            <div class="student-info-cell">
                                <span class="name">${escapeHtml(fullName)}</span>
                                <span class="sub">LRN: <strong>${escapeHtml(stu.lrn || '—')}</strong> • ${escapeHtml(stu.gender || '—')}</span>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div class="grade-cell">
                            <div class="grade-title">${escapeHtml(stu.grade_level || 'Grade 11')}</div>
                            <div class="grade-sub">${escapeHtml(stu.strand || stu.track || 'TVL')} • Sec: ${escapeHtml(stu.section || 'N/A')}</div>
                        </div>
                    </td>
                    <td>
                        ${standingBadgeHtml}
                    </td>
                    <td>
                        <div class="parent-info-cell">
                            <div class="name">${escapeHtml(parentName)}</div>
                            <div class="sub">Rel: ${escapeHtml(stu.parent_relationship || stu.guardian_relationship || 'Parent')}</div>
                        </div>
                    </td>
                    <td>
                        <div class="contact-stack">
                            <div class="contact-item"><i class="fas fa-phone-alt contact-icon-phone"></i> <span>${escapeHtml(parentPhone)}</span></div>
                            <div class="contact-item"><i class="fas fa-envelope contact-icon-email"></i> <span>${escapeHtml(parentEmail)}</span></div>
                            <div class="contact-item"><i class="fab fa-facebook contact-icon-fb"></i> <span>${escapeHtml(parentFB)}</span></div>
                        </div>
                    </td>
                    <td style="text-align: right;">
                        <div class="table-actions">
                            <a href="reports.html?student_id=${stu.id}&tab=student" class="btn-table-action btn-action-report" title="View / Print Student Guidance & Conduct Report">
                                <i class="fas fa-file-lines"></i> Student Report
                            </a>
                            <button class="btn-table-action btn-action-qr" onclick="window.openStudentQRModal('${stu.id}')" title="View Emergency ID & Parent QR Card">
                                <i class="fas fa-qrcode"></i> Parent QR
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // ============================================
    // 5. EMERGENCY ID & PARENT QR MODAL
    // ============================================
    window.openStudentQRModal = function (id) {
        const stu = allStudents.find(s => s.id === id);
        if (!stu) return;

        const fullName = `${stu.first_name || ''} ${stu.last_name || ''}`.trim();
        const parentName = stu.parent_name || stu.guardian_name || 'Guardian';
        const parentPhone = stu.parent_contact || stu.emergency_contact || 'None';
        const parentEmail = stu.parent_email || 'None';
        const parentFB = stu.parent_facebook || '';

        if (qrModalStudentName) qrModalStudentName.textContent = fullName;
        if (qrModalMeta) qrModalMeta.textContent = `LRN: ${stu.lrn || '—'} • ${stu.grade_level || ''} (${stu.strand || ''})`;
        if (qrModalParentName) qrModalParentName.textContent = parentName;
        if (qrModalParentPhone) qrModalParentPhone.textContent = parentPhone;
        if (qrModalParentEmail) qrModalParentEmail.textContent = parentEmail;
        if (qrModalParentFB) qrModalParentFB.textContent = parentFB || 'Not specified';

        // Set action buttons
        if (qrBtnCall) {
            qrBtnCall.href = parentPhone && parentPhone !== 'None' ? `tel:${parentPhone}` : '#';
            qrBtnCall.style.display = (parentPhone && parentPhone !== 'None') ? 'inline-flex' : 'none';
        }
        if (qrBtnEmail) {
            qrBtnEmail.href = parentEmail && parentEmail !== 'None' ? `mailto:${parentEmail}?subject=Hiraya Guidance Office Notice regarding ${encodeURIComponent(fullName)}` : '#';
            qrBtnEmail.style.display = (parentEmail && parentEmail !== 'None') ? 'inline-flex' : 'none';
        }
        if (qrBtnFB) {
            if (parentFB && parentFB.startsWith('http')) {
                qrBtnFB.href = parentFB;
                qrBtnFB.style.display = 'inline-flex';
            } else if (parentFB && parentFB !== 'None') {
                qrBtnFB.href = `https://facebook.com/${encodeURIComponent(parentFB)}`;
                qrBtnFB.style.display = 'inline-flex';
            } else {
                qrBtnFB.style.display = 'none';
            }
        }

        // Render conduct history summary
        const studentViolations = allViolations.filter(v => (v.student_id && v.student_id === stu.id) || (v.lrn && v.lrn === stu.lrn));
        const studentSessions = allSessions.filter(s => (s.student_id && s.student_id === stu.id) || (s.lrn && s.lrn === stu.lrn));

        if (qrStudentConductSummary) {
            qrStudentConductSummary.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <strong style="color: #0f172a;"><i class="fas fa-scale-balanced" style="color: #4338ca;"></i> Guidance & Conduct Record:</strong>
                    <span>${studentViolations.length} Violations • ${studentSessions.length} Counseling Sessions</span>
                </div>
                ${studentViolations.length > 0 ? `
                    <div style="font-size: 11.5px; color: #475569;">
                        <strong>Latest Incident:</strong> ${escapeHtml(studentViolations[0].violation_title)} (${escapeHtml(studentViolations[0].offense_level)}) - <em>${escapeHtml(studentViolations[0].status)}</em>
                    </div>
                ` : `
                    <div style="font-size: 11.5px; color: #059669;">
                        <i class="fas fa-check-circle"></i> Clean behavioral standing. No disciplinary infractions recorded.
                    </div>
                `}
            `;
        }

        // Render QR Code
        if (qrCanvasContainer && typeof QRCode !== 'undefined') {
            qrCanvasContainer.innerHTML = '';
            const qrDataPayload = JSON.stringify({
                system: "HES-Hiraya",
                type: "Student Emergency & Parent Contact",
                student: fullName,
                lrn: stu.lrn || '',
                grade: stu.grade_level || '',
                parent_name: parentName,
                parent_phone: parentPhone,
                parent_email: parentEmail,
                parent_fb: parentFB
            });

            currentQRCodeInstance = new QRCode(qrCanvasContainer, {
                text: qrDataPayload,
                width: 140,
                height: 140,
                colorDark: "#1E3A8A",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.M
            });
        }

        if (modalStudentQR) {
            modalStudentQR.classList.add('show');
            modalStudentQR.style.display = 'flex';
        }
    };

    window.closeQRModal = function () {
        if (modalStudentQR) {
            modalStudentQR.classList.remove('show');
            modalStudentQR.style.display = 'none';
        }
    };

    // ============================================
    // 6. HELPERS & LISTENERS
    // ============================================
    function escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function showAlert(message, type = 'info') {
        if (!alertContainer) return;
        alertContainer.innerHTML = `
            <div style="padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; font-size: 13.5px; display: flex; align-items: center; gap: 10px; background: ${type === 'danger' ? '#fee2e2' : (type === 'success' ? '#d1fae5' : '#e0f2fe')}; color: ${type === 'danger' ? '#991b1b' : (type === 'success' ? '#065f46' : '#075985')}; border: 1px solid ${type === 'danger' ? '#fecaca' : (type === 'success' ? '#a7f3d0' : '#bae6fd')};">
                <i class="fas ${type === 'danger' ? 'fa-triangle-exclamation' : (type === 'success' ? 'fa-circle-check' : 'fa-circle-info')}"></i>
                <span>${message}</span>
            </div>
        `;
        setTimeout(() => {
            if (alertContainer) alertContainer.innerHTML = '';
        }, 5000);
    }

    function setupEvents() {
        if (menuToggle && sidebar) {
            menuToggle.addEventListener('click', () => {
                sidebar.classList.toggle('open');
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.removeItem('currentUser');
                window.location.replace('../auth/login.html');
            });
        }

        if (searchInput) searchInput.addEventListener('input', applyFilters);
        if (filterGrade) filterGrade.addEventListener('change', applyFilters);
        if (filterStanding) filterStanding.addEventListener('change', applyFilters);

        if (btnResetFilters) {
            btnResetFilters.addEventListener('click', () => {
                if (searchInput) searchInput.value = '';
                if (filterGrade) filterGrade.value = '';
                if (filterStanding) filterStanding.value = '';
                applyFilters();
            });
        }

        if (modalStudentQR) {
            modalStudentQR.addEventListener('click', (e) => {
                if (e.target === modalStudentQR) {
                    window.closeQRModal();
                }
            });
        }
    }

    // Initialize
    if (checkAuth()) {
        setupEvents();
        init();
    }
})();
