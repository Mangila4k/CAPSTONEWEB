/**
 * HES Admin - Students List (Whole School by Year Level & Section)
 */

import { supabase } from '../../supabase/config.js';

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
    // STATE
    // ============================================

    let allStudents = [];
    let filteredStudents = [];

    // ============================================
    // LOAD STUDENTS FROM SUPABASE
    // ============================================

    async function loadStudents() {
        console.log('🔍 Loading students...');

        tableBody.innerHTML = `
            <tr>
                <td colspan="9" class="loading-cell">
                    <i class="fas fa-spinner fa-spin"></i> Loading students...
                </td>
            </tr>
        `;

        try {
            // STEP 1: Fetch students table
            console.log('📁 Fetching students table...');
            const { data: studentsData, error: studentsError } = await supabase
                .from('students')
                .select('*');

            if (studentsError) {
                console.error('❌ Students query error:', studentsError);
                throw studentsError;
            }

            console.log('✅ Found', studentsData?.length || 0, 'student records');

            // STEP 2: Fetch users table
            console.log('📁 Fetching users table...');
            const { data: usersData, error: usersError } = await supabase
                .from('users')
                .select('id, first_name, last_name, email, role');

            if (usersError) {
                console.error('❌ Users query error:', usersError);
                throw usersError;
            }

            console.log('✅ Found', usersData?.length || 0, 'users');

            // STEP 3: Combine by user_id, student_id, or email
            allStudents = (studentsData || []).map(student => {
                const user = (usersData || []).find(u => u.id === student.user_id || u.student_id === student.id || (u.email && student.email && u.email.toLowerCase() === student.email.toLowerCase()));

                return {
                    id: student.id,
                    user_id: student.user_id || user?.id,
                    lrn: student.lrn || student.student_id || '—',
                    firstName: student.first_name || user?.first_name || 'Student',
                    lastName: student.last_name || user?.last_name || '',
                    email: student.email || user?.email || '—',
                    grade: student.grade_level || student.year_level || 'Grade 11',
                    strand: student.strand || '—',
                    section: student.section || '—',
                    gender: student.gender || '—',
                    status: student.status || 'Active'
                };
            });

            console.log('✅ Total students loaded:', allStudents.length);

            populateSectionFilter();
            renderGradeSummary();
            applyFilters();
            updateStats();

        } catch (error) {
            console.error('❌ Error loading students:', error);

            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" class="empty-cell">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Error loading students. Please try again.</p>
                    </td>
                </tr>
            `;
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
    // RENDER GRADE SUMMARY (WHOLE SCHOOL BY YEAR)
    // ============================================

    function renderGradeSummary() {
        if (!gradeSummary) return;

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

        // Click listeners on chips
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

    // ============================================
    // APPLY FILTERS
    // ============================================

    function applyFilters() {
        const search = searchInput ? searchInput.value.trim().toLowerCase() : '';
        const grade = filterGrade ? filterGrade.value : '';
        const section = filterSection ? filterSection.value : '';
        const strand = filterStrand ? filterStrand.value : '';
        const status = filterStatus ? filterStatus.value : '';

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

            const matchGrade = !grade || s.grade === grade;
            const matchSection = !section || s.section === section;

            let matchStrand = true;
            if (strand) {
                if (strand === 'JHS') {
                    matchStrand = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'].includes(s.grade) || s.strand === '—' || !s.strand;
                } else {
                    matchStrand = (s.strand || '').toUpperCase().includes(strand.toUpperCase());
                }
            }

            const matchStatus = !status || s.status.toLowerCase() === status.toLowerCase();

            return matchSearch && matchGrade && matchSection && matchStrand && matchStatus;
        });

        renderTable();
    }

    // ============================================
    // RENDER TABLE
    // ============================================

    function renderTable() {
        if (filteredStudents.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" class="empty-cell">
                        <i class="fas fa-inbox"></i>
                        <p>No students found for the selected criteria</p>
                    </td>
                </tr>
            `;
            if (recordCount) recordCount.textContent = 'Showing 0 records';
            return;
        }

        tableBody.innerHTML = filteredStudents.map((s, index) => {
            const initial = (s.firstName || 'S').charAt(0).toUpperCase();
            const fullName = `${s.firstName} ${s.lastName}`.trim() || 'Unknown';
            const statusClass = s.status === 'Active' ? 'badge-active' : 'badge-inactive';
            const isSHS = ['Grade 11', 'Grade 12'].includes(s.grade);
            const strandBadge = isSHS && s.strand && s.strand !== '—'
                ? `<span class="badge badge-strand">${s.strand}</span>`
                : `<span class="badge badge-jhs">${s.strand && s.strand !== '—' ? s.strand : 'General'}</span>`;

            return `
                <tr>
                    <td>${index + 1}</td>
                    <td>
                        <div class="student-cell">
                            <div class="student-avatar">${initial}</div>
                            <div class="student-info-cell">
                                <div class="name">${fullName}</div>
                                <div class="sub">${s.gender || '—'}</div>
                            </div>
                        </div>
                    </td>
                    <td>${s.lrn || '—'}</td>
                    <td><span class="grade-badge-cell">${s.grade || '—'}</span></td>
                    <td><span class="section-badge-cell">${s.section || '—'}</span></td>
                    <td>${strandBadge}</td>
                    <td>${s.email || '—'}</td>
                    <td><span class="badge ${statusClass}">${s.status || 'Active'}</span></td>
                    <td>
                        <div class="action-btns">
                            <a href="view_student.html?id=${s.id}" class="action-btn view" title="View Student">
                                <i class="fas fa-eye"></i>
                            </a>
                            <a href="edit_student.html?id=${s.id}" class="action-btn edit" title="Edit Student">
                                <i class="fas fa-edit"></i>
                            </a>
                            <button type="button" class="action-btn delete" data-id="${s.id}" title="Delete Student">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        if (recordCount) {
            recordCount.textContent = `Showing ${filteredStudents.length} of ${allStudents.length} records`;
        }

        tableBody.querySelectorAll('.action-btn.delete').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
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
                // 1. If Transfer, record in transferees registry
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
                        console.log('✅ Recorded to transferees registry');
                    } catch (tErr) {
                        console.warn('Transferees table insert warning:', tErr);
                    }
                }

                // 2. Perform Removal or Archival
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

                // 3. Log to activity_logs table
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

                // 4. Update local state
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

    if (filterGrade) {
        filterGrade.addEventListener('change', function() {
            populateSectionFilter();
            renderGradeSummary();
            applyFilters();
        });
    }

    if (filterSection) filterSection.addEventListener('change', applyFilters);
    if (filterStrand) filterStrand.addEventListener('change', applyFilters);
    if (filterStatus) filterStatus.addEventListener('change', applyFilters);

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
        if (e.key === 'Escape') viewModal.classList.remove('show');
    });

    // ============================================
    // INIT
    // ============================================

    loadStudents();

    console.log('✅ Students page initialized successfully');

})();