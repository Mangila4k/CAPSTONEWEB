// ===== TEACHERS JAVASCRIPT (Dynamic Supabase Integration) =====

import { supabase } from '../../supabase/config.js';

document.addEventListener('DOMContentLoaded', async function() {
    'use strict';

    // DOM Elements
    const alertContainer = document.getElementById('alertContainer');
    const tableBody = document.getElementById('tableBody');
    const recordCount = document.getElementById('recordCount');
    const statusFilter = document.getElementById('statusFilter');
    const searchInput = document.getElementById('searchInput');

    // Workload Records Elements
    const workloadsTableBody = document.getElementById('workloadsTableBody');
    const workloadRecordCount = document.getElementById('workloadRecordCount');
    
    // Teacher Workloads Elements
    const teacherWorkloadsTableBody = document.getElementById('teacherWorkloadsTableBody');
    const btnUploadTeacherWorkload = document.getElementById('btnUploadTeacherWorkload');

    // Attach Schedule Modal Elements
    const attachScheduleModal = document.getElementById('attachScheduleModal');
    const btnCloseScheduleModal = document.getElementById('btnCloseScheduleModal');
    const btnCancelScheduleModal = document.getElementById('btnCancelScheduleModal');
    
    // Grade and Section Dropdowns
    const uploadGradeSelect = document.getElementById('uploadGradeSelect');
    const uploadSectionSelect = document.getElementById('uploadSectionSelect');

    const modalExistingDocBox = document.getElementById('modalExistingDocBox');
    const modalExistingDocName = document.getElementById('modalExistingDocName');
    const modalExistingDocMeta = document.getElementById('modalExistingDocMeta');
    const btnPreviewExistingDoc = document.getElementById('btnPreviewExistingDoc');
    const btnRemoveExistingDoc = document.getElementById('btnRemoveExistingDoc');

    const scheduleDropZone = document.getElementById('scheduleDropZone');
    const scheduleFileInput = document.getElementById('scheduleFileInput');
    const selectedFileInfo = document.getElementById('selectedFileInfo');
    const selectedFileName = document.getElementById('selectedFileName');
    const selectedFileSize = document.getElementById('selectedFileSize');
    const btnSubmitAttachSchedule = document.getElementById('btnSubmitAttachSchedule');

    // Teacher Workload Modal Elements
    const teacherWorkloadModal = document.getElementById('teacherWorkloadModal');
    const btnCloseTeacherWorkloadModal = document.getElementById('btnCloseTeacherWorkloadModal');
    const btnCancelTeacherWorkload = document.getElementById('btnCancelTeacherWorkload');
    const uploadTeacherSelect = document.getElementById('uploadTeacherSelect');
    const teacherScheduleDropZone = document.getElementById('teacherScheduleDropZone');
    const teacherScheduleFileInput = document.getElementById('teacherScheduleFileInput');
    const teacherSelectedFileInfo = document.getElementById('teacherSelectedFileInfo');
    const teacherSelectedFileName = document.getElementById('teacherSelectedFileName');
    const teacherSelectedFileSize = document.getElementById('teacherSelectedFileSize');
    const btnSubmitTeacherWorkload = document.getElementById('btnSubmitTeacherWorkload');

    // Preview Modal Elements
    const schedulePreviewModal = document.getElementById('schedulePreviewModal');
    const btnClosePreviewModal = document.getElementById('btnClosePreviewModal');
    const previewModalTitle = document.getElementById('previewModalTitle');
    const previewModalContainer = document.getElementById('previewModalContainer');
    const btnOpenScheduleExternal = document.getElementById('btnOpenScheduleExternal');

    let teachers = [];
    let allSections = []; 
    let allTeacherWorkloads = []; // Store fetched teacher workloads
    let currentSelectedSection = null;
    let currentSelectedFile = null;
    
    // Teacher Workload state
    let currentSelectedTeacher = null;
    let currentSelectedTeacherFile = null;

    // Update statistics
    function updateStats() {
        const total = teachers.length;
        const withSections = teachers.filter(t => t.section_count > 0).length;
        const withoutSections = total - withSections;

        const elTotal = document.getElementById('totalTeachers');
        const elWith = document.getElementById('withSections');
        const elWithout = document.getElementById('withoutSections');

        if (elTotal) elTotal.textContent = total;
        if (elWith) elWith.textContent = withSections;
        if (elWithout) elWithout.textContent = withoutSections;
    }

    // Render Teachers Table
    function renderTable() {
        if (!tableBody) return;

        const status = statusFilter ? statusFilter.value : 'all';
        const search = searchInput ? searchInput.value.toLowerCase().trim() : '';

        let filtered = [...teachers];

        if (status === 'with-sections') {
            filtered = filtered.filter(t => t.section_count > 0);
        } else if (status === 'without-sections') {
            filtered = filtered.filter(t => t.section_count === 0);
        }

        if (search) {
            filtered = filtered.filter(t => 
                (t.fullname || '').toLowerCase().includes(search) ||
                (t.email || '').toLowerCase().includes(search) ||
                (t.id_number || '').toLowerCase().includes(search) ||
                (t.specialization || '').toLowerCase().includes(search)
            );
        }

        if (recordCount) {
            recordCount.textContent = `Total: ${filtered.length} teachers`;
        }

        if (filtered.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6">
                        <div class="no-data" style="text-align: center; padding: 40px; color: #64748b;">
                            <i class="fas fa-chalkboard-user" style="font-size: 36px; margin-bottom: 12px; color: #94a3b8;"></i>
                            <h3 style="font-size: 16px; margin-bottom: 6px; color: #1e293b;">No Teachers Found</h3>
                            <p style="font-size: 13px; margin: 0;">${search ? 'No faculty members matched your search.' : 'Click "Add New Teacher" to register a faculty member.'}</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        filtered.forEach(teacher => {
            const initial = (teacher.fullname || 'T').charAt(0).toUpperCase();
            const joinedDate = new Date(teacher.created_at || Date.now());
            const formattedDate = joinedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const hasSections = teacher.section_count > 0;

            let sectionsHtml = '';
            if (hasSections && teacher.sections) {
                const sectionList = Array.isArray(teacher.sections) ? teacher.sections : teacher.sections.split(', ');
                sectionsHtml = `
                    <div class="section-tags" style="display: flex; gap: 4px; flex-wrap: wrap;">
                        ${sectionList.map(s => `<span class="badge badge-info" style="font-size: 11px;">${s}</span>`).join('')}
                    </div>
                `;
            } else {
                sectionsHtml = `<span class="badge badge-warning" style="font-size: 11px;">No sections assigned</span>`;
            }

            const statusBadge = hasSections
                ? `<span class="badge badge-success"><i class="fas fa-check-circle"></i> Adviser</span>`
                : `<span class="badge badge-secondary"><i class="fas fa-clock"></i> Available</span>`;

            html += `
                <tr>
                    <td>
                        <div class="teacher-info" style="display: flex; align-items: center; gap: 12px;">
                            <div class="teacher-avatar" style="width: 38px; height: 38px; border-radius: 50%; background: #1B2A4A; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; position: relative; overflow: hidden; flex-shrink: 0;" title="${teacher.fullname}">
                                ${teacher.avatar_url ? `
                                    <img src="${teacher.avatar_url}" alt="${teacher.fullname}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';">
                                    <span style="display:none;">${initial}</span>
                                ` : `
                                    <span>${initial}</span>
                                `}
                            </div>
                            <div class="teacher-details">
                                <h4 style="margin: 0; font-size: 14px; font-weight: 600; color: #0f172a;">${teacher.fullname}</h4>
                                <span style="font-size: 12px; color: #64748b;"><i class="fas fa-calendar-alt"></i> Joined: ${formattedDate}</span>
                            </div>
                        </div>
                    </td>
                    <td><i class="fas fa-envelope" style="color: #94a3b8; margin-right: 6px;"></i> ${teacher.email}</td>
                    <td>
                        <span class="badge badge-info">
                            ${teacher.id_number || teacher.employee_id || 'N/A'}
                        </span>
                    </td>
                    <td>${sectionsHtml}</td>
                    <td>
                        <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
                            ${statusBadge}
                        </div>
                    </td>
                    <td class="cell-actions">
                        <div class="manage-dropdown">
                            <button type="button" class="btn-manage" aria-expanded="false" title="Manage Teacher">
                                <span>Manage</span>
                                <i class="fas fa-chevron-down"></i>
                            </button>
                            <div class="manage-menu">
                                <a href="view_teacher.html?id=${teacher.id}" class="manage-item view-item" title="View Teacher">
                                    <i class="fas fa-eye"></i>
                                    <span>View Teacher</span>
                                </a>
                                <a href="edit_teacher.html?id=${teacher.id}" class="manage-item edit-item" title="Edit Teacher">
                                    <i class="fas fa-edit"></i>
                                    <span>Edit Teacher</span>
                                </a>
                                <button type="button" class="manage-item schedule-item" onclick="document.getElementById('uploadGradeSelect').focus(); document.getElementById('attachScheduleModal').style.display='flex';" title="Upload Section Workload">
                                    <i class="fas fa-file-upload"></i>
                                    <span>Upload Workloads</span>
                                </button>
                                <a href="register_face.html?id=${teacher.id}" class="manage-item face-item" title="Register / Re-scan Face Biometrics">
                                    <i class="fas fa-camera"></i>
                                    <span>Face Biometrics</span>
                                </a>
                                <div class="manage-divider"></div>
                                <button type="button" class="manage-item delete-item delete" data-id="${teacher.id}" title="Delete Teacher">
                                    <i class="fas fa-trash"></i>
                                    <span>Delete Teacher</span>
                                </button>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        });

        tableBody.innerHTML = html;

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
                    if (spaceBelow < 220) {
                        dropdown.classList.add('dropup');
                    } else {
                        dropdown.classList.remove('dropup');
                    }
                    dropdown.classList.add('show');
                    if (row) row.classList.add('dropdown-open');
                }
            });
        });

        tableBody.querySelectorAll('.delete').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const dropdown = this.closest('.manage-dropdown');
                if (dropdown) dropdown.classList.remove('show');
                const id = this.dataset.id;
                deleteTeacher(id);
            });
        });
    }

    // Render Section Workloads Records Table
    function renderWorkloadsTable() {
        if (!workloadsTableBody) return;

        const uploadedWorkloads = allSections.filter(s => s.schedule_doc_url);

        if (workloadRecordCount) {
            workloadRecordCount.textContent = `Total: ${uploadedWorkloads.length} records`;
        }

        if (uploadedWorkloads.length === 0) {
            workloadsTableBody.innerHTML = `
                <tr>
                    <td colspan="5">
                        <div class="no-data" style="text-align: center; padding: 40px; color: #64748b;">
                            <i class="fas fa-file-upload" style="font-size: 36px; margin-bottom: 12px; color: #94a3b8;"></i>
                            <h3 style="font-size: 16px; margin-bottom: 6px; color: #1e293b;">No Section Workloads Uploaded</h3>
                            <p style="font-size: 13px; margin: 0;">Click "Upload Workloads per Section" to add a schedule.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        uploadedWorkloads.sort((a, b) => new Date(b.schedule_doc_updated_at || 0) - new Date(a.schedule_doc_updated_at || 0));

        let html = '';
        uploadedWorkloads.forEach(sec => {
            const dateStr = sec.schedule_doc_updated_at ? new Date(sec.schedule_doc_updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unknown Date';
            const uploadedBy = sec.schedule_doc_uploaded_by || 'Admin';

            html += `
                <tr>
                    <td><span style="font-weight: 600; color: #475569;"><i class="far fa-calendar-alt" style="color: #94a3b8; margin-right: 6px;"></i> ${dateStr}</span></td>
                    <td><span class="badge badge-info" style="font-size: 12px;">${sec.grade_level ? `${sec.grade_level} - ` : ''}${sec.name}</span></td>
                    <td><i class="fas fa-file-pdf" style="color: #dc2626; margin-right: 6px;"></i> ${sec.schedule_doc_name || 'Schedule_Document.pdf'}</td>
                    <td><span style="font-weight: 500;"><i class="fas fa-user-shield" style="color: #0f766e; margin-right: 6px;"></i> ${uploadedBy}</span></td>
                    <td>
                        <div style="display: flex; gap: 6px;">
                            <button type="button" class="btn-preview-record" data-url="${sec.schedule_doc_url}" data-name="${sec.schedule_doc_name || 'Schedule'}" style="padding: 5px 10px; background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; border-radius: 6px; font-size: 11.5px; font-weight: 600; cursor: pointer;">
                                <i class="fas fa-eye"></i> View
                            </button>
                            <button type="button" class="btn-delete-record" data-id="${sec.id}" data-name="${sec.name}" style="padding: 5px 10px; background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; border-radius: 6px; font-size: 11.5px; font-weight: 600; cursor: pointer;">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        workloadsTableBody.innerHTML = html;

        workloadsTableBody.querySelectorAll('.btn-preview-record').forEach(btn => {
            btn.addEventListener('click', function() {
                openSchedulePreview(this.dataset.url, this.dataset.name);
            });
        });

        workloadsTableBody.querySelectorAll('.btn-delete-record').forEach(btn => {
            btn.addEventListener('click', async function() {
                const secId = this.dataset.id;
                const secName = this.dataset.name;
                
                if (!confirm(`Are you sure you want to delete the uploaded workload for Section ${secName}?`)) return;

                try {
                    await supabase.from('sections').update({
                        schedule_doc_url: null,
                        schedule_doc_name: null,
                        schedule_doc_type: null,
                        schedule_doc_updated_at: null,
                        schedule_doc_uploaded_by: null,
                        shared_at: null,
                        shared_by: null
                    }).eq('id', secId);

                    showAlert(`Workload schedule removed for Section ${secName}.`, 'success');
                    await loadTeachers(); 
                } catch (err) {
                    console.error('Error deleting workload:', err);
                    showAlert('Failed to delete workload: ' + err.message, 'error');
                }
            });
        });
    }
    
    // NEW: Render Teacher Individual Workloads Table
    function renderTeacherWorkloadsTable() {
        if (!teacherWorkloadsTableBody) return;
        
        if (allTeacherWorkloads.length === 0) {
            teacherWorkloadsTableBody.innerHTML = `
                <tr>
                    <td colspan="4">
                        <div class="no-data" style="text-align: center; padding: 40px; color: #64748b;">
                            <i class="fas fa-file-upload" style="font-size: 36px; margin-bottom: 12px; color: #94a3b8;"></i>
                            <h3 style="font-size: 16px; margin-bottom: 6px; color: #1e293b;">No Teacher Workloads Uploaded</h3>
                            <p style="font-size: 13px; margin: 0;">Click "Upload Workload" to assign a workload to a teacher.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        // Sort by newest first
        allTeacherWorkloads.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        
        let html = '';
        allTeacherWorkloads.forEach(workload => {
            const teacher = teachers.find(t => t.id === workload.teacher_id);
            const teacherName = teacher ? teacher.fullname : 'Unknown Teacher';
            const teacherEmail = teacher ? teacher.email : '';
            const initial = teacherName.charAt(0).toUpperCase();
            const dateStr = workload.created_at ? new Date(workload.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently';
            
            html += `
                <tr>
                    <td>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div class="teacher-avatar" style="width: 32px; height: 32px; border-radius: 50%; background: #1B2A4A; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px;">
                                ${initial}
                            </div>
                            <div>
                                <div style="font-weight: 600; color: #0f172a;">${teacherName}</div>
                                <div style="font-size: 11px; color: #64748b;">${teacherEmail}</div>
                            </div>
                        </div>
                    </td>
                    <td><i class="fas fa-file-pdf" style="color: #dc2626; margin-right: 6px;"></i> ${workload.file_name || 'Teacher_Workload.pdf'}</td>
                    <td><span style="font-weight: 600; color: #475569;">${dateStr}</span></td>
                    <td>
                        <div style="display: flex; gap: 6px;">
                            <button type="button" class="btn-preview-teacher-record" data-url="${workload.file_url}" data-name="${workload.file_name || 'Workload'}" style="padding: 5px 10px; background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; border-radius: 6px; font-size: 11.5px; font-weight: 600; cursor: pointer;">
                                <i class="fas fa-eye"></i> View
                            </button>
                            <button type="button" class="btn-delete-teacher-record" data-id="${workload.id}" data-name="${teacherName}" style="padding: 5px 10px; background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; border-radius: 6px; font-size: 11.5px; font-weight: 600; cursor: pointer;">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        teacherWorkloadsTableBody.innerHTML = html;
        
        teacherWorkloadsTableBody.querySelectorAll('.btn-preview-teacher-record').forEach(btn => {
            btn.addEventListener('click', function() {
                openSchedulePreview(this.dataset.url, this.dataset.name);
            });
        });
        
        teacherWorkloadsTableBody.querySelectorAll('.btn-delete-teacher-record').forEach(btn => {
            btn.addEventListener('click', async function() {
                const id = this.dataset.id;
                const name = this.dataset.name;
                
                if (!confirm(`Are you sure you want to delete the workload for ${name}?`)) return;

                try {
                    await supabase.from('teacher_workloads').delete().eq('id', id);

                    showAlert(`Workload removed for ${name}.`, 'success');
                    await loadTeachers(); 
                } catch (err) {
                    console.error('Error deleting teacher workload:', err);
                    showAlert('Failed to delete teacher workload: ' + err.message, 'error');
                }
            });
        });
    }

    // Load teachers dynamically from Supabase
    async function loadTeachers() {
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: #64748b;">
                        <i class="fas fa-spinner fa-spin" style="font-size: 24px; color: #1B2A4A; margin-bottom: 8px;"></i>
                        <p style="margin: 0;">Loading faculty members from database...</p>
                    </td>
                </tr>
            `;
        }
        if (workloadsTableBody) {
            workloadsTableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 40px; color: #64748b;">
                        <i class="fas fa-spinner fa-spin" style="font-size: 24px; color: #1B2A4A; margin-bottom: 8px;"></i>
                        <p style="margin: 0;">Loading workload records...</p>
                    </td>
                </tr>
            `;
        }
        if (teacherWorkloadsTableBody) {
            teacherWorkloadsTableBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 40px; color: #64748b;">
                        <i class="fas fa-spinner fa-spin" style="font-size: 24px; color: #1B2A4A; margin-bottom: 8px;"></i>
                        <p style="margin: 0;">Loading teacher workloads...</p>
                    </td>
                </tr>
            `;
        }

        try {
            const [
                { data: teacherRows, error: tErr },
                { data: userRows, error: uErr },
                { data: sectionRows, error: sErr },
                { data: workloadRows, error: wErr }
            ] = await Promise.all([
                supabase.from('teachers').select('*'),
                supabase.from('users').select('*').eq('role', 'teacher'),
                supabase.from('sections').select('*'),
                supabase.from('teacher_workloads').select('*')
            ]);

            if (tErr) console.warn('Teachers query warning:', tErr);
            if (wErr) console.warn('Teacher Workloads query warning:', wErr);

            const users = userRows || [];
            const sections = sectionRows || [];
            const teacherTableData = teacherRows || [];

            allSections = sections; 
            allTeacherWorkloads = workloadRows || [];

            const combinedTeachers = [];
            const processedUserIds = new Set();

            teacherTableData.forEach(t => {
                const matchedUser = users.find(u => u.id === t.user_id);
                if (matchedUser) processedUserIds.add(matchedUser.id);

                const fullName = matchedUser ? `${matchedUser.first_name || ''} ${matchedUser.last_name || ''}`.trim() : (t.fullname || 'Faculty Teacher');
                const email = matchedUser ? matchedUser.email : (t.email || 'teacher@hiraya.edu.ph');

                const assignedSections = sections.filter(sec => 
                    sec.adviser_id === t.id || 
                    sec.adviser_id === t.user_id ||
                    (sec.adviser_name && fullName && sec.adviser_name.trim().toLowerCase() === fullName.trim().toLowerCase())
                );

                combinedTeachers.push({
                    id: t.id,
                    user_id: t.user_id,
                    fullname: fullName,
                    email: email,
                    id_number: t.employee_id || 'HES-TCH-0000',
                    specialization: t.specialization || 'General',
                    phone: t.phone || '',
                    created_at: t.created_at || (matchedUser ? matchedUser.created_at : new Date().toISOString()),
                    section_count: assignedSections.length,
                    sections: assignedSections.map(s => `${s.grade_level ? `${s.grade_level} - ` : ''}${s.name}`).join(', '),
                    avatar_url: t.avatar_url || t.profile_picture || matchedUser?.profile_picture || matchedUser?.avatar_url || null
                });
            });

            users.forEach(u => {
                if (!processedUserIds.has(u.id)) {
                    const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email;
                    const assignedSections = sections.filter(sec => 
                        sec.adviser_id === u.id ||
                        (sec.adviser_name && fullName && sec.adviser_name.trim().toLowerCase() === fullName.trim().toLowerCase())
                    );

                    combinedTeachers.push({
                        id: u.id,
                        user_id: u.id,
                        fullname: fullName,
                        email: u.email,
                        id_number: 'HES-TCH-PEND',
                        specialization: 'Faculty',
                        phone: '',
                        created_at: u.created_at || new Date().toISOString(),
                        section_count: assignedSections.length,
                        sections: assignedSections.map(s => `${s.grade_level ? `${s.grade_level} - ` : ''}${s.name}`).join(', '),
                        avatar_url: u.profile_picture || u.avatar_url || null
                    });
                }
            });

            teachers = combinedTeachers;
            
            // Populate Teacher Workload Select Dropdown
            if (uploadTeacherSelect) {
                uploadTeacherSelect.innerHTML = '<option value="">-- Choose Teacher --</option>' +
                    teachers.map(t => `<option value="${t.id}">${t.fullname}</option>`).join('');
            }
            
            updateStats();
            renderTable();
            renderWorkloadsTable();
            renderTeacherWorkloadsTable();
        } catch (err) {
            console.error('Error loading teachers:', err);
            showAlert('Failed to load teachers from database: ' + err.message, 'error');
        }
    }

    // ============================================
    // SECTION SCHEDULE MODAL WORKFLOW
    // ============================================

    function openAttachScheduleModal() {
        currentSelectedSection = null;
        currentSelectedFile = null;
        if (modalExistingDocBox) modalExistingDocBox.style.display = 'none';

        if (uploadGradeSelect) uploadGradeSelect.value = '';
        if (uploadSectionSelect) uploadSectionSelect.innerHTML = '<option value="">-- Choose Section --</option>';
        
        if (scheduleFileInput) scheduleFileInput.value = '';
        if (selectedFileInfo) selectedFileInfo.style.display = 'none';

        if (attachScheduleModal) attachScheduleModal.style.display = 'flex';
    }

    function closeAttachScheduleModal() {
        if (attachScheduleModal) attachScheduleModal.style.display = 'none';
        currentSelectedSection = null;
        currentSelectedFile = null;
        if (scheduleFileInput) scheduleFileInput.value = '';
        if (selectedFileInfo) selectedFileInfo.style.display = 'none';
    }

    if (uploadGradeSelect) {
        uploadGradeSelect.addEventListener('change', function() {
            const selectedGrade = this.value;
            uploadSectionSelect.innerHTML = '<option value="">-- Choose Section --</option>';
            if (modalExistingDocBox) modalExistingDocBox.style.display = 'none';
            currentSelectedSection = null;

            if (!selectedGrade) return;

            const filteredSections = allSections.filter(s => s.grade_level === selectedGrade);

            if (filteredSections.length === 0) {
                uploadSectionSelect.innerHTML = '<option value="">No sections found for this grade</option>';
                return;
            }

            filteredSections.forEach(sec => {
                const opt = document.createElement('option');
                opt.value = sec.id;
                opt.textContent = sec.name;
                uploadSectionSelect.appendChild(opt);
            });
        });
    }

    if (uploadSectionSelect) {
        uploadSectionSelect.addEventListener('change', function() {
            const sectionId = this.value;
            if (!sectionId) {
                if (modalExistingDocBox) modalExistingDocBox.style.display = 'none';
                currentSelectedSection = null;
                return;
            }

            currentSelectedSection = allSections.find(s => s.id === sectionId);
            if (!currentSelectedSection) return;

            if (currentSelectedSection.schedule_doc_url) {
                if (modalExistingDocBox) modalExistingDocBox.style.display = 'block';
                if (modalExistingDocName) modalExistingDocName.textContent = currentSelectedSection.schedule_doc_name || 'Section_Schedule.pdf';
                if (modalExistingDocMeta) {
                    const dateStr = currentSelectedSection.schedule_doc_updated_at ? new Date(currentSelectedSection.schedule_doc_updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently';
                    modalExistingDocMeta.textContent = `Uploaded: ${dateStr}`;
                }
            } else {
                if (modalExistingDocBox) modalExistingDocBox.style.display = 'none';
            }
        });
    }

    if (scheduleDropZone && scheduleFileInput) {
        scheduleDropZone.addEventListener('click', () => scheduleFileInput.click());

        scheduleDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            scheduleDropZone.classList.add('dragover');
        });

        scheduleDropZone.addEventListener('dragleave', () => {
            scheduleDropZone.classList.remove('dragover');
        });

        scheduleDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            scheduleDropZone.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleFileSelection(e.dataTransfer.files[0]);
            }
        });

        scheduleFileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                handleFileSelection(e.target.files[0]);
            }
        });
    }

    function handleFileSelection(file) {
        if (!file) return;
        if (file.size > 20 * 1024 * 1024) {
            alert('File exceeds 20MB size limit.');
            return;
        }

        currentSelectedFile = file;
        const sizeFormatted = (file.size / (1024 * 1024)).toFixed(2) + ' MB';

        if (selectedFileName) selectedFileName.textContent = file.name;
        if (selectedFileSize) selectedFileSize.textContent = `(${sizeFormatted})`;
        if (selectedFileInfo) selectedFileInfo.style.display = 'block';
    }

    if (btnSubmitAttachSchedule) {
        btnSubmitAttachSchedule.addEventListener('click', async function() {
            if (!currentSelectedSection) {
                alert('Please select a Grade and Section first.');
                return;
            }
            if (!currentSelectedFile) {
                alert('Please select a schedule document (PDF or Image) to attach.');
                return;
            }

            const originalBtnHtml = btnSubmitAttachSchedule.innerHTML;
            btnSubmitAttachSchedule.disabled = true;
            btnSubmitAttachSchedule.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';

            try {
                const file = currentSelectedFile;
                const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
                const fileType = file.type || (isPdf ? 'application/pdf' : 'image/png');

                const dataUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });

                let publicUrl = null;
                try {
                    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                    const storagePath = `section_schedules/${currentSelectedSection.id}/${Date.now()}_${cleanFileName}`;

                    const { data: uploadData, error: upErr } = await supabase
                        .storage
                        .from('teacher-schedules')
                        .upload(storagePath, file, { cacheControl: '3600', upsert: true });

                    if (!upErr && uploadData) {
                        const { data: pubData } = supabase.storage.from('teacher-schedules').getPublicUrl(storagePath);
                        if (pubData && pubData.publicUrl) publicUrl = pubData.publicUrl;
                    }
                } catch (stErr) {
                    console.warn('Storage upload notice (fallback to DataURL):', stErr);
                }

                const finalUrl = publicUrl || dataUrl;
                const uploadIso = new Date().toISOString();

                const { error: secErr } = await supabase
                    .from('sections')
                    .update({
                        schedule_doc_url: finalUrl,
                        schedule_doc_name: file.name,
                        schedule_doc_type: fileType,
                        schedule_doc_updated_at: uploadIso,
                        schedule_doc_uploaded_by: 'Admin'
                    })
                    .eq('id', currentSelectedSection.id);

                if (secErr) console.warn('Section update error:', secErr);

                const docPayload = {
                    sectionId: currentSelectedSection.id,
                    sectionName: currentSelectedSection.name,
                    fileName: file.name,
                    fileType: fileType,
                    url: finalUrl,
                    fileData: dataUrl,
                    uploadDate: uploadIso,
                    uploadedBy: 'Admin'
                };

                localStorage.setItem(`hes_section_schedule_${currentSelectedSection.id}`, JSON.stringify(docPayload));
                localStorage.setItem(`hes_section_schedule_${currentSelectedSection.name.toUpperCase()}`, JSON.stringify(docPayload));

                currentSelectedSection.schedule_doc_url = finalUrl;
                currentSelectedSection.schedule_doc_name = file.name;
                currentSelectedSection.schedule_doc_type = fileType;
                currentSelectedSection.schedule_doc_updated_at = uploadIso;
                currentSelectedSection.schedule_doc_uploaded_by = 'Admin';

                showAlert(`✅ Official schedule document attached to Section ${currentSelectedSection.name}!`, 'success');
                closeAttachScheduleModal();
                await loadTeachers();
            } catch (err) {
                console.error('Error attaching schedule:', err);
                alert('Failed to attach schedule: ' + err.message);
            } finally {
                btnSubmitAttachSchedule.disabled = false;
                btnSubmitAttachSchedule.innerHTML = originalBtnHtml;
            }
        });
    }

    if (btnRemoveExistingDoc) {
        btnRemoveExistingDoc.addEventListener('click', async function() {
            if (!currentSelectedSection) return;
            if (!confirm(`Are you sure you want to remove the workload schedule for Section ${currentSelectedSection.name}?`)) {
                return;
            }

            try {
                await supabase
                    .from('sections')
                    .update({
                        schedule_doc_url: null,
                        schedule_doc_name: null,
                        schedule_doc_type: null,
                        schedule_doc_updated_at: new Date().toISOString()
                    })
                    .eq('id', currentSelectedSection.id);

                localStorage.removeItem(`hes_section_schedule_${currentSelectedSection.id}`);
                localStorage.removeItem(`hes_section_schedule_${currentSelectedSection.name.toUpperCase()}`);

                currentSelectedSection.schedule_doc_url = null;
                currentSelectedSection.schedule_doc_name = null;
                currentSelectedSection.schedule_doc_type = null;

                if (modalExistingDocBox) modalExistingDocBox.style.display = 'none';

                showAlert(`Schedule removed for Section ${currentSelectedSection.name}.`, 'success');
                await loadTeachers();
            } catch (err) {
                console.error('Error removing schedule:', err);
                alert('Failed to remove schedule: ' + err.message);
            }
        });
    }

    if (btnPreviewExistingDoc) {
        btnPreviewExistingDoc.addEventListener('click', function() {
            if (!currentSelectedSection || !currentSelectedSection.schedule_doc_url) return;
            const doc = {
                url: currentSelectedSection.schedule_doc_url,
                fileName: currentSelectedSection.schedule_doc_name || 'Section_Schedule.pdf'
            };
            openSchedulePreview(doc.url, doc.fileName);
        });
    }

    // ============================================
    // NEW: TEACHER WORKLOAD MODAL WORKFLOW
    // ============================================
    
    function openTeacherWorkloadModal() {
        currentSelectedTeacher = null;
        currentSelectedTeacherFile = null;
        
        if (uploadTeacherSelect) uploadTeacherSelect.value = '';
        if (teacherScheduleFileInput) teacherScheduleFileInput.value = '';
        if (teacherSelectedFileInfo) teacherSelectedFileInfo.style.display = 'none';
        
        if (teacherWorkloadModal) teacherWorkloadModal.style.display = 'flex';
    }
    
    function closeTeacherWorkloadModal() {
        if (teacherWorkloadModal) teacherWorkloadModal.style.display = 'none';
        currentSelectedTeacher = null;
        currentSelectedTeacherFile = null;
        if (teacherScheduleFileInput) teacherScheduleFileInput.value = '';
        if (teacherSelectedFileInfo) teacherSelectedFileInfo.style.display = 'none';
    }
    
    if (uploadTeacherSelect) {
        uploadTeacherSelect.addEventListener('change', function() {
            currentSelectedTeacher = teachers.find(t => t.id === this.value) || null;
        });
    }
    
    if (teacherScheduleDropZone && teacherScheduleFileInput) {
        teacherScheduleDropZone.addEventListener('click', () => teacherScheduleFileInput.click());

        teacherScheduleDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            teacherScheduleDropZone.classList.add('dragover');
        });

        teacherScheduleDropZone.addEventListener('dragleave', () => {
            teacherScheduleDropZone.classList.remove('dragover');
        });

        teacherScheduleDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            teacherScheduleDropZone.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleTeacherFileSelection(e.dataTransfer.files[0]);
            }
        });

        teacherScheduleFileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                handleTeacherFileSelection(e.target.files[0]);
            }
        });
    }
    
    function handleTeacherFileSelection(file) {
        if (!file) return;
        if (file.size > 20 * 1024 * 1024) {
            alert('File exceeds 20MB size limit.');
            return;
        }

        currentSelectedTeacherFile = file;
        const sizeFormatted = (file.size / (1024 * 1024)).toFixed(2) + ' MB';

        if (teacherSelectedFileName) teacherSelectedFileName.textContent = file.name;
        if (teacherSelectedFileSize) teacherSelectedFileSize.textContent = `(${sizeFormatted})`;
        if (teacherSelectedFileInfo) teacherSelectedFileInfo.style.display = 'block';
    }
    
    if (btnSubmitTeacherWorkload) {
        btnSubmitTeacherWorkload.addEventListener('click', async function() {
            if (!currentSelectedTeacher) {
                alert('Please select a teacher first.');
                return;
            }
            if (!currentSelectedTeacherFile) {
                alert('Please select a workload document (PDF or Image) to upload.');
                return;
            }

            const originalBtnHtml = btnSubmitTeacherWorkload.innerHTML;
            btnSubmitTeacherWorkload.disabled = true;
            btnSubmitTeacherWorkload.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';

            try {
                const file = currentSelectedTeacherFile;
                const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
                const fileType = file.type || (isPdf ? 'application/pdf' : 'image/png');

                const dataUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });

                let publicUrl = null;
                try {
                    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                    const storagePath = `teacher_individual_workloads/${currentSelectedTeacher.id}/${Date.now()}_${cleanFileName}`;

                    const { data: uploadData, error: upErr } = await supabase
                        .storage
                        .from('teacher-schedules')
                        .upload(storagePath, file, { cacheControl: '3600', upsert: true });

                    if (!upErr && uploadData) {
                        const { data: pubData } = supabase.storage.from('teacher-schedules').getPublicUrl(storagePath);
                        if (pubData && pubData.publicUrl) publicUrl = pubData.publicUrl;
                    }
                } catch (stErr) {
                    console.warn('Storage upload notice (fallback to DataURL):', stErr);
                }

                const finalUrl = publicUrl || dataUrl;
                const uploadIso = new Date().toISOString();

                // 1. Insert into the NEW teacher_workloads table
                const { error: insErr } = await supabase
                    .from('teacher_workloads')
                    .insert([{
                        teacher_id: currentSelectedTeacher.id,
                        file_name: file.name,
                        file_url: finalUrl,
                        file_type: fileType,
                        uploaded_by: 'Admin',
                        created_at: uploadIso
                    }]);

                if (insErr) throw insErr;

                showAlert(`✅ Official workload document uploaded for ${currentSelectedTeacher.fullname}!`, 'success');
                closeTeacherWorkloadModal();
                await loadTeachers();
            } catch (err) {
                console.error('Error uploading teacher workload:', err);
                alert('Failed to upload teacher workload: ' + err.message);
            } finally {
                btnSubmitTeacherWorkload.disabled = false;
                btnSubmitTeacherWorkload.innerHTML = originalBtnHtml;
            }
        });
    }

    // ============================================
    // GENERAL PREVIEW FUNCTIONS
    // ============================================

    function openSchedulePreview(url, title) {
        if (!schedulePreviewModal || !previewModalContainer) return;

        const isPdf = (title || '').toLowerCase().endsWith('.pdf') || (url || '').startsWith('data:application/pdf') || (url || '').includes('.pdf');

        if (previewModalTitle) {
            previewModalTitle.innerHTML = `<i class="fas ${isPdf ? 'fa-file-pdf' : 'fa-file-image'}" style="color: ${isPdf ? '#fca5a5' : '#86efac'};"></i> ${title}`;
        }

        if (btnOpenScheduleExternal) {
            btnOpenScheduleExternal.href = url;
        }

        if (isPdf) {
            previewModalContainer.innerHTML = `<iframe src="${url}" style="width: 100%; height: 100%; border: none;"></iframe>`;
        } else {
            previewModalContainer.innerHTML = `<img src="${url}" alt="Schedule Preview" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
        }

        schedulePreviewModal.style.display = 'flex';
    }

    if (btnCloseScheduleModal) btnCloseScheduleModal.addEventListener('click', closeAttachScheduleModal);
    if (btnCancelScheduleModal) btnCancelScheduleModal.addEventListener('click', closeAttachScheduleModal);
    
    if (btnCloseTeacherWorkloadModal) btnCloseTeacherWorkloadModal.addEventListener('click', closeTeacherWorkloadModal);
    if (btnCancelTeacherWorkload) btnCancelTeacherWorkload.addEventListener('click', closeTeacherWorkloadModal);

    if (btnClosePreviewModal) {
        btnClosePreviewModal.addEventListener('click', () => {
            if (schedulePreviewModal) schedulePreviewModal.style.display = 'none';
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target === attachScheduleModal) closeAttachScheduleModal();
        if (e.target === teacherWorkloadModal) closeTeacherWorkloadModal();
        if (e.target === schedulePreviewModal && schedulePreviewModal) schedulePreviewModal.style.display = 'none';
    });

    async function deleteTeacher(id) {
        const teacher = teachers.find(t => t.id === id);
        if (!teacher) return;

        if (teacher.section_count > 0) {
            showAlert('Cannot delete teacher because they are assigned as adviser to an active section.', 'error');
            return;
        }

        if (!confirm(`Are you sure you want to delete teacher "${teacher.fullname}"?`)) {
            return;
        }

        try {
            const { error: tDelErr } = await supabase.from('teachers').delete().eq('id', id);
            if (tDelErr) throw tDelErr;

            if (teacher.user_id) {
                await supabase.from('users').delete().eq('id', teacher.user_id);
            }

            showAlert(`✅ Teacher "${teacher.fullname}" deleted successfully!`, 'success');
            await loadTeachers();
        } catch (err) {
            console.error('Error deleting teacher:', err);
            showAlert('Failed to delete teacher: ' + err.message, 'error');
        }
    }

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

    if (statusFilter) statusFilter.addEventListener('change', renderTable);
    if (searchInput) searchInput.addEventListener('input', renderTable);

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

    const btnGlobalUpload = document.getElementById('btnGlobalUpload');
    if (btnGlobalUpload) {
        btnGlobalUpload.addEventListener('click', openAttachScheduleModal);
    }
    
    if (btnUploadTeacherWorkload) {
        btnUploadTeacherWorkload.addEventListener('click', openTeacherWorkloadModal);
    }

    await loadTeachers();
});