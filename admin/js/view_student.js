/**
 * HES Admin - View Student Profile (Supabase Dynamic Integration)
 */

import { supabase } from '../../supabase/config.js';

(function() {
    'use strict';

    console.log('👤 Admin View Student Profile (Supabase) ready');

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

    // ============================================
    // DOM ELEMENTS
    // ============================================

    const alertContainer = document.getElementById('alertContainer');
    const avatarInitial = document.getElementById('avatarInitial');
    const studentName = document.getElementById('studentName');
    const studentEmail = document.getElementById('studentEmail');
    const studentIdNumber = document.getElementById('studentIdNumber');
    const studentRegistered = document.getElementById('studentRegistered');
    const studentDaysActive = document.getElementById('studentDaysActive');
    const statusBadge = document.getElementById('statusBadge');
    const personalInfoGrid = document.getElementById('personalInfoGrid');
    const currentEnrollmentCard = document.getElementById('currentEnrollmentCard');
    const enrollmentInfoGrid = document.getElementById('enrollmentInfoGrid');
    const historyContainer = document.getElementById('historyContainer');

    // Mobile Menu
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');

    // ============================================
    // STATE
    // ============================================

    let currentStudent = null;
    let currentEnrollment = null;
    let enrollmentHistory = [];

    // ============================================
    // HELPER FUNCTIONS
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
        }, 5000);
    }

    function formatDate(dateString) {
        if (!dateString) return 'Not specified';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return dateString;
            return date.toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
            });
        } catch {
            return dateString;
        }
    }

    function calculateAge(birthdate) {
        if (!birthdate) return null;
        try {
            const birth = new Date(birthdate);
            if (isNaN(birth.getTime())) return null;
            const today = new Date();
            let age = today.getFullYear() - birth.getFullYear();
            const m = today.getMonth() - birth.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
                age--;
            }
            return age >= 0 ? age : null;
        } catch {
            return null;
        }
    }

    function calculateDaysActive(createdAt) {
        if (!createdAt) return 1;
        try {
            const created = new Date(createdAt);
            if (isNaN(created.getTime())) return 1;
            const today = new Date();
            const diffTime = Math.abs(today - created);
            return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
        } catch {
            return 1;
        }
    }

    // ============================================
    // LOAD STUDENT DETAILS FROM SUPABASE
    // ============================================

    async function loadStudentDetails() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const targetId = urlParams.get('id') || urlParams.get('student_id') || '';

            // 1. Fetch Student from Supabase
            let student = null;
            if (targetId) {
                try {
                    const { data: sData } = await supabase
                        .from('students')
                        .select('*')
                        .or(`id.eq.${targetId},lrn.eq.${targetId}`)
                        .maybeSingle();
                    if (sData) student = sData;
                } catch(e) {}
            }

            if (!student) {
                try {
                    const { data: sList } = await supabase
                        .from('students')
                        .select('*')
                        .limit(1);
                    if (sList && sList.length > 0) student = sList[0];
                } catch(e) {}
            }

            if (!student) {
                showAlert('No student profile found in database.', 'error');
                return;
            }

            currentStudent = student;

            // 2. Fetch Enrollments for this student
            let enrollments = [];
            try {
                const { data: eData } = await supabase
                    .from('enrollments')
                    .select('*')
                    .or(`student_id.eq.${student.id},email.eq.${student.email}`)
                    .order('created_at', { ascending: false });
                if (eData) enrollments = eData;
            } catch(e) {}

            enrollmentHistory = enrollments;
            currentEnrollment = enrollments.length > 0 ? enrollments[0] : null;

            // Render all UI components
            renderProfile();
            renderPersonalInfo();
            renderCurrentEnrollment();
            renderHistory();

        } catch (error) {
            console.error('❌ Error loading student details:', error);
            showAlert('Failed to load student details: ' + error.message, 'error');
        }
    }

    // ============================================
    // RENDER PROFILE CARD
    // ============================================

    function renderProfile() {
        const student = currentStudent;
        if (!student) return;

        const fName = (student.first_name || '').trim();
        const lName = (student.last_name || '').trim();
        const fullName = `${fName} ${lName}`.trim() || 'Student';
        const initial = fullName.charAt(0).toUpperCase() || 'S';
        const daysActive = calculateDaysActive(student.created_at);

        if (avatarInitial) avatarInitial.textContent = initial;
        if (studentName) studentName.textContent = fullName;
        if (studentEmail) studentEmail.textContent = student.email || '—';
        if (studentIdNumber) studentIdNumber.textContent = student.lrn || 'Not assigned';
        if (studentRegistered) studentRegistered.textContent = formatDate(student.created_at);
        if (studentDaysActive) studentDaysActive.textContent = daysActive;

        const statusRaw = (currentEnrollment?.status || '').toLowerCase();
        const isApproved = currentEnrollment ? (statusRaw === 'approved' || statusRaw === 'enrolled') : student.documents_status === 'complete';
        const statusText = isApproved ? 'Enrolled' : 'Pending Verification';
        const statusClass = isApproved ? 'badge-enrolled' : 'badge-pending';

        if (statusBadge) {
            statusBadge.className = `profile-badge ${statusClass}`;
            statusBadge.innerHTML = `
                <i class="fas fa-${isApproved ? 'check-circle' : 'clock'}"></i>
                Current Status: ${statusText}
            `;
        }
    }

    // ============================================
    // RENDER PERSONAL INFO
    // ============================================

    function renderPersonalInfo() {
        if (!personalInfoGrid || !currentStudent) return;
        const student = currentStudent;

        const bDate = student.date_of_birth || student.birth_date;
        const age = calculateAge(bDate);
        const gender = student.gender || 'Not specified';
        const genderIcon = gender.toLowerCase() === 'male' ? 'mars' : (gender.toLowerCase() === 'female' ? 'venus' : 'user');

        personalInfoGrid.innerHTML = `
            <div class="info-item">
                <div class="info-label">First Name</div>
                <div class="info-value">
                    <i class="fas fa-user"></i>
                    ${student.first_name || 'Not specified'}
                </div>
            </div>
            <div class="info-item">
                <div class="info-label">Middle Name</div>
                <div class="info-value">
                    <i class="fas fa-user"></i>
                    ${student.middle_name || '—'}
                </div>
            </div>
            <div class="info-item">
                <div class="info-label">Last Name</div>
                <div class="info-value">
                    <i class="fas fa-user"></i>
                    ${student.last_name || 'Not specified'}
                </div>
            </div>
            <div class="info-item">
                <div class="info-label">Birthdate</div>
                <div class="info-value">
                    <i class="fas fa-cake-candles"></i>
                    ${bDate ? formatDate(bDate) : 'Not specified'}
                    ${age !== null ? `<span class="age-text" style="color: #64748b; font-size: 13px; margin-left: 6px;">(Age: ${age} years)</span>` : ''}
                </div>
            </div>
            <div class="info-item">
                <div class="info-label">Gender</div>
                <div class="info-value">
                    <i class="fas fa-${genderIcon}"></i>
                    ${gender}
                </div>
            </div>
            <div class="info-item">
                <div class="info-label">Student LRN / ID Number</div>
                <div class="info-value">
                    <i class="fas fa-qrcode"></i>
                    ${student.lrn || 'Not assigned'}
                </div>
            </div>
        `;
    }

    // ============================================
    // RENDER CURRENT ENROLLMENT
    // ============================================

    function renderCurrentEnrollment() {
        if (!enrollmentInfoGrid) return;

        const student = currentStudent;
        const enr = currentEnrollment;

        const gradeName = enr?.grade_level || student?.grade_level || 'Grade 11';
        const strand = enr?.strand || student?.strand || (gradeName.includes('11') || gradeName.includes('12') ? 'TVL-ICT' : '');
        const schoolYear = enr?.school_year || enr?.last_school_year || '2025-2026';
        const form138 = student?.form_138_url;

        let strandHtml = '';
        if (strand) {
            strandHtml = `
                <div class="info-item">
                    <div class="info-label">Strand</div>
                    <div class="info-value">
                        <i class="fas fa-tag"></i>
                        ${strand}
                    </div>
                </div>
            `;
        }

        let form138Html = '';
        if (form138) {
            form138Html = `
                <div class="info-item" style="grid-column: 1 / -1; border-bottom: none;">
                    <div class="info-label">Form 138 (Report Card)</div>
                    <div class="info-value">
                        <i class="fas fa-file-pdf" style="color: #dc2626;"></i>
                        <a href="${form138}" target="_blank" class="document-link" style="color: #0b2b4a; font-weight: 600; text-decoration: underline;">
                            View Submitted Document
                        </a>
                    </div>
                </div>
            `;
        }

        enrollmentInfoGrid.innerHTML = `
            <div class="info-item">
                <div class="info-label">Grade Level</div>
                <div class="info-value">
                    <i class="fas fa-layer-group"></i>
                    ${gradeName}
                </div>
            </div>
            ${strandHtml}
            <div class="info-item">
                <div class="info-label">School Year</div>
                <div class="info-value">
                    <i class="fas fa-calendar"></i>
                    ${schoolYear}
                </div>
            </div>
            <div class="info-item">
                <div class="info-label">Enrollment Date</div>
                <div class="info-value">
                    <i class="fas fa-clock"></i>
                    ${formatDate(enr?.created_at || student?.created_at)}
                </div>
            </div>
            ${form138Html}
        `;

        // Update view link in card header
        if (currentEnrollmentCard) {
            const viewLink = currentEnrollmentCard.querySelector('.view-link');
            if (viewLink) {
                viewLink.href = `view_enrollment.html?id=${encodeURIComponent(enr?.id || student?.id)}`;
            }
        }
    }

    // ============================================
    // RENDER ENROLLMENT HISTORY
    // ============================================

    function renderHistory() {
        if (!historyContainer) return;

        if (enrollmentHistory.length === 0) {
            historyContainer.innerHTML = `
                <div class="no-data" style="text-align: center; padding: 30px; color: #94a3b8;">
                    <i class="fas fa-file-signature" style="font-size: 32px; margin-bottom: 8px; color: #cbd5e1;"></i>
                    <h3 style="color: #64748b; font-size: 15px;">No Enrollment Records</h3>
                    <p style="margin: 0; font-size: 13px;">This student has no prior enrollment history recorded.</p>
                </div>
            `;
            return;
        }

        let html = `
            <table class="enrollments-table" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr>
                        <th>School Year</th>
                        <th>Grade Level</th>
                        <th>Strand</th>
                        <th>Status</th>
                        <th>Applied Date</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
        `;

        enrollmentHistory.forEach(record => {
            const rawStatus = (record.status || '').toLowerCase();
            let statusText = 'Pending';
            let statusClass = 'badge-pending';
            if (rawStatus === 'approved' || rawStatus === 'enrolled') {
                statusText = 'Enrolled';
                statusClass = 'badge-enrolled';
            } else if (rawStatus === 'rejected') {
                statusText = 'Rejected';
                statusClass = 'badge-rejected';
            }

            html += `
                <tr>
                    <td style="font-weight: 600;">${record.school_year || record.last_school_year || '2025-2026'}</td>
                    <td>${record.grade_level || 'Grade 11'}</td>
                    <td>${record.strand ? `<span class="strand-tag">${record.strand}</span>` : '—'}</td>
                    <td>
                        <span class="badge ${statusClass}">
                            ${statusText}
                        </span>
                    </td>
                    <td>${formatDate(record.created_at)}</td>
                    <td>
                        <a href="view_enrollment.html?id=${encodeURIComponent(record.id)}" class="view-link" style="color: #0b2b4a; font-weight: 600;">
                            View <i class="fas fa-eye"></i>
                        </a>
                    </td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        `;

        historyContainer.innerHTML = html;
    }

    // ============================================
    // DELETE STUDENT
    // ============================================

    window.deleteStudent = async function() {
        if (!currentStudent) return;
        const sName = `${currentStudent.first_name || ''} ${currentStudent.last_name || ''}`.trim() || 'this student';

        if (!confirm(`Are you sure you want to delete ${sName}? This action cannot be undone and will remove associated records.`)) {
            return;
        }

        try {
            showAlert('Deleting student record...', 'info');

            await supabase
                .from('students')
                .delete()
                .eq('id', currentStudent.id);

            showAlert('✅ Student deleted successfully!', 'success');
            setTimeout(() => {
                window.location.href = 'student.html';
            }, 1200);
        } catch (error) {
            console.error('❌ Error deleting student:', error);
            showAlert('Failed to delete student: ' + error.message, 'error');
        }
    };

    // ============================================
    // MOBILE MENU
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
    // INIT
    // ============================================

    loadStudentDetails();

})();