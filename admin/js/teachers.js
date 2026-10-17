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

    // Attach Schedule Modal Elements
    const attachScheduleModal = document.getElementById('attachScheduleModal');
    const btnCloseScheduleModal = document.getElementById('btnCloseScheduleModal');
    const btnCancelScheduleModal = document.getElementById('btnCancelScheduleModal');
    const modalTeacherAvatar = document.getElementById('modalTeacherAvatar');
    const modalTeacherName = document.getElementById('modalTeacherName');
    const modalTeacherId = document.getElementById('modalTeacherId');
    const modalTeacherEmail = document.getElementById('modalTeacherEmail');

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

    // Preview Modal Elements
    const schedulePreviewModal = document.getElementById('schedulePreviewModal');
    const btnClosePreviewModal = document.getElementById('btnClosePreviewModal');
    const previewModalTitle = document.getElementById('previewModalTitle');
    const previewModalContainer = document.getElementById('previewModalContainer');
    const btnOpenScheduleExternal = document.getElementById('btnOpenScheduleExternal');

    let teachers = [];
    let currentSelectedTeacher = null;
    let currentSelectedFile = null;

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

    // Check if teacher has an attached workload schedule
    function getTeacherScheduleDoc(teacher) {
        if (!teacher) return null;
        if (teacher.teacher_load_url) {
            return {
                url: teacher.teacher_load_url,
                fileName: teacher.teacher_load_name || 'Teacher_Workload.pdf',
                fileType: teacher.teacher_load_file_type || 'application/pdf',
                updatedAt: teacher.teacher_load_updated_at || new Date().toISOString()
            };
        }

        // Check local storage specific to this teacher
        const localKeys = [
            `hes_teacher_load_doc_${teacher.id}`,
            teacher.user_id ? `hes_teacher_load_doc_${teacher.user_id}` : null
        ].filter(Boolean);

        for (const k of localKeys) {
            const raw = localStorage.getItem(k);
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    if (parsed && (parsed.url || parsed.fileData)) {
                        return {
                            url: parsed.url || parsed.fileData,
                            fileName: parsed.fileName || 'Teacher_Workload.pdf',
                            fileType: parsed.fileType || 'application/pdf',
                            updatedAt: parsed.uploadDate || new Date().toISOString()
                        };
                    }
                } catch (e) {}
            }
        }
        return null;
    }

    // Render table
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
            const scheduleDoc = getTeacherScheduleDoc(teacher);
            const hasSchedule = !!scheduleDoc;

            // Sections tags
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

            // Status badge & Schedule badge
            const statusBadge = hasSections
                ? `<span class="badge badge-success"><i class="fas fa-check-circle"></i> Adviser</span>`
                : `<span class="badge badge-secondary"><i class="fas fa-clock"></i> Available</span>`;

            const scheduleBadge = hasSchedule
                ? `<span class="badge-pdf-attached" title="Schedule Attached: ${scheduleDoc.fileName}"><i class="fas fa-file-pdf"></i> Schedule PDF</span>`
                : '';

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
                            ${scheduleBadge}
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
                                <button type="button" class="manage-item schedule-item attach-schedule ${hasSchedule ? 'has-schedule' : ''}" data-id="${teacher.id}" title="${hasSchedule ? 'Manage / View Workload Schedule (PDF)' : 'Attach Workload Schedule (PDF)'}">
                                    <i class="fas ${hasSchedule ? 'fa-file-circle-check' : 'fa-file-pdf'}"></i>
                                    <span>${hasSchedule ? 'Workload (PDF)' : 'Attach Workload'}</span>
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

        // Toggle Manage dropdown menu
        tableBody.querySelectorAll('.btn-manage').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const dropdown = this.closest('.manage-dropdown');
                const row = this.closest('tr');
                const isOpen = dropdown.classList.contains('show');

                // Close all other open dropdowns
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

        // Attach action handlers
        tableBody.querySelectorAll('.attach-schedule').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const dropdown = this.closest('.manage-dropdown');
                if (dropdown) dropdown.classList.remove('show');
                const id = this.dataset.id;
                openAttachScheduleModal(id);
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

        try {
            const [
                { data: teacherRows, error: tErr },
                { data: userRows, error: uErr },
                { data: sectionRows, error: sErr }
            ] = await Promise.all([
                supabase.from('teachers').select('*'),
                supabase.from('users').select('*').eq('role', 'teacher'),
                supabase.from('sections').select('*')
            ]);

            if (tErr) console.warn('Teachers query warning:', tErr);

            const users = userRows || [];
            const sections = sectionRows || [];
            const teacherTableData = teacherRows || [];

            const combinedTeachers = [];
            const processedUserIds = new Set();

            teacherTableData.forEach(t => {
                const matchedUser = users.find(u => u.id === t.user_id);
                if (matchedUser) processedUserIds.add(matchedUser.id);

                const fullName = matchedUser ? `${matchedUser.first_name || ''} ${matchedUser.last_name || ''}`.trim() : (t.fullname || 'Faculty Teacher');
                const email = matchedUser ? matchedUser.email : (t.email || 'teacher@hiraya.edu.ph');

                // Find assigned sections (by teacher ID, user ID, or adviser full name)
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
                    teacher_load_url: t.teacher_load_url || null,
                    teacher_load_name: t.teacher_load_name || null,
                    teacher_load_file_type: t.teacher_load_file_type || null,
                    teacher_load_updated_at: t.teacher_load_updated_at || null,
                    avatar_url: t.avatar_url || t.profile_picture || matchedUser?.profile_picture || matchedUser?.avatar_url || null
                });
            });

            // Add any user with role=teacher not yet in teachers table
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
                        teacher_load_url: null,
                        teacher_load_name: null,
                        teacher_load_file_type: null,
                        teacher_load_updated_at: null,
                        avatar_url: u.profile_picture || u.avatar_url || null
                    });
                }
            });

            teachers = combinedTeachers;
            updateStats();
            renderTable();
        } catch (err) {
            console.error('Error loading teachers:', err);
            showAlert('Failed to load teachers from database: ' + err.message, 'error');
        }
    }

    // ============================================
    // ATTACH SCHEDULE MODAL WORKFLOW
    // ============================================

    function openAttachScheduleModal(teacherId) {
        const teacher = teachers.find(t => t.id === teacherId);
        if (!teacher) return;

        currentSelectedTeacher = teacher;
        currentSelectedFile = null;

        if (modalTeacherName) modalTeacherName.textContent = teacher.fullname;
        if (modalTeacherAvatar) modalTeacherAvatar.textContent = (teacher.fullname || 'T').charAt(0).toUpperCase();
        if (modalTeacherId) modalTeacherId.innerHTML = `<i class="fas fa-id-badge"></i> ${teacher.id_number || 'N/A'}`;
        if (modalTeacherEmail) modalTeacherEmail.innerHTML = `<i class="fas fa-envelope"></i> ${teacher.email}`;

        // Reset file selection
        if (scheduleFileInput) scheduleFileInput.value = '';
        if (selectedFileInfo) selectedFileInfo.style.display = 'none';

        // Check existing schedule doc
        const existingDoc = getTeacherScheduleDoc(teacher);
        if (existingDoc && (existingDoc.url || existingDoc.fileData)) {
            if (modalExistingDocBox) modalExistingDocBox.style.display = 'block';
            if (modalExistingDocName) modalExistingDocName.textContent = existingDoc.fileName || 'Teacher_Workload.pdf';
            if (modalExistingDocMeta) {
                const dateStr = existingDoc.updatedAt ? new Date(existingDoc.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently';
                modalExistingDocMeta.textContent = `Uploaded: ${dateStr} • Visible strictly to this teacher`;
            }
        } else {
            if (modalExistingDocBox) modalExistingDocBox.style.display = 'none';
        }

        if (attachScheduleModal) attachScheduleModal.style.display = 'flex';
    }

    function closeAttachScheduleModal() {
        if (attachScheduleModal) attachScheduleModal.style.display = 'none';
        currentSelectedTeacher = null;
        currentSelectedFile = null;
        if (scheduleFileInput) scheduleFileInput.value = '';
        if (selectedFileInfo) selectedFileInfo.style.display = 'none';
    }

    // Drag and drop & file selection handlers
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

        // Size check (max 20MB)
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

    // Submit Attach Schedule
    if (btnSubmitAttachSchedule) {
        btnSubmitAttachSchedule.addEventListener('click', async function() {
            if (!currentSelectedTeacher) return;
            if (!currentSelectedFile) {
                alert('Please select a schedule document (PDF or Image) to attach.');
                return;
            }

            const originalBtnHtml = btnSubmitAttachSchedule.innerHTML;
            btnSubmitAttachSchedule.disabled = true;
            btnSubmitAttachSchedule.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading & Attaching...';

            try {
                const file = currentSelectedFile;
                const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
                const fileType = file.type || (isPdf ? 'application/pdf' : 'image/png');

                // Read file as base64 DataURL (ensures 100% offline & fallback access)
                const dataUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });

                let publicUrl = null;

                // Try uploading to Supabase Storage bucket 'teacher-schedules'
                try {
                    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                    const storagePath = `${currentSelectedTeacher.id}/${Date.now()}_${cleanFileName}`;

                    const { data: uploadData, error: upErr } = await supabase
                        .storage
                        .from('teacher-schedules')
                        .upload(storagePath, file, {
                            cacheControl: '3600',
                            upsert: true
                        });

                    if (!upErr && uploadData) {
                        const { data: pubData } = supabase
                            .storage
                            .from('teacher-schedules')
                            .getPublicUrl(storagePath);
                        if (pubData && pubData.publicUrl) {
                            publicUrl = pubData.publicUrl;
                        }
                    }
                } catch (stErr) {
                    console.warn('Storage bucket upload notice (fallback to DataURL):', stErr);
                }

                const finalUrl = publicUrl || dataUrl;
                const uploadIso = new Date().toISOString();

                // 1. Update Supabase teachers table
                try {
                    await supabase
                        .from('teachers')
                        .update({
                            teacher_load_url: finalUrl,
                            teacher_load_name: file.name,
                            teacher_load_file_type: fileType,
                            teacher_load_updated_at: uploadIso
                        })
                        .eq('id', currentSelectedTeacher.id);
                } catch (dbErr) {
                    console.warn('Teachers table update error:', dbErr);
                }

                // 2. Cache in localStorage strictly for this specific teacher
                const docPayload = {
                    teacherId: currentSelectedTeacher.id,
                    userId: currentSelectedTeacher.user_id,
                    fileName: file.name,
                    fileType: fileType,
                    url: finalUrl,
                    fileData: dataUrl,
                    uploadDate: uploadIso,
                    issuedBy: 'Administration'
                };

                localStorage.setItem(`hes_teacher_load_doc_${currentSelectedTeacher.id}`, JSON.stringify(docPayload));
                if (currentSelectedTeacher.user_id) {
                    localStorage.setItem(`hes_teacher_load_doc_${currentSelectedTeacher.user_id}`, JSON.stringify(docPayload));
                }

                // Update in-memory state
                currentSelectedTeacher.teacher_load_url = finalUrl;
                currentSelectedTeacher.teacher_load_name = file.name;
                currentSelectedTeacher.teacher_load_file_type = fileType;
                currentSelectedTeacher.teacher_load_updated_at = uploadIso;

                showAlert(`✅ Official schedule document (${file.name}) attached successfully for ${currentSelectedTeacher.fullname}! Only this teacher can see it in their portal.`, 'success');
                closeAttachScheduleModal();
                renderTable();
            } catch (err) {
                console.error('Error attaching schedule:', err);
                alert('Failed to attach schedule: ' + err.message);
            } finally {
                btnSubmitAttachSchedule.disabled = false;
                btnSubmitAttachSchedule.innerHTML = originalBtnHtml;
            }
        });
    }

    // Remove Existing Schedule
    if (btnRemoveExistingDoc) {
        btnRemoveExistingDoc.addEventListener('click', async function() {
            if (!currentSelectedTeacher) return;
            if (!confirm(`Are you sure you want to remove the workload schedule for ${currentSelectedTeacher.fullname}?`)) {
                return;
            }

            try {
                // Update Supabase
                await supabase
                    .from('teachers')
                    .update({
                        teacher_load_url: null,
                        teacher_load_name: null,
                        teacher_load_file_type: null,
                        teacher_load_updated_at: new Date().toISOString()
                    })
                    .eq('id', currentSelectedTeacher.id);

                // Remove from local storage
                localStorage.removeItem(`hes_teacher_load_doc_${currentSelectedTeacher.id}`);
                if (currentSelectedTeacher.user_id) {
                    localStorage.removeItem(`hes_teacher_load_doc_${currentSelectedTeacher.user_id}`);
                }

                currentSelectedTeacher.teacher_load_url = null;
                currentSelectedTeacher.teacher_load_name = null;
                currentSelectedTeacher.teacher_load_file_type = null;

                if (modalExistingDocBox) modalExistingDocBox.style.display = 'none';

                showAlert(`Schedule removed for ${currentSelectedTeacher.fullname}.`, 'success');
                renderTable();
            } catch (err) {
                console.error('Error removing schedule:', err);
                alert('Failed to remove schedule: ' + err.message);
            }
        });
    }

    // Preview Existing Schedule PDF / Image
    if (btnPreviewExistingDoc) {
        btnPreviewExistingDoc.addEventListener('click', function() {
            if (!currentSelectedTeacher) return;
            const doc = getTeacherScheduleDoc(currentSelectedTeacher);
            if (!doc || !doc.url) return;

            openSchedulePreview(doc.url, doc.fileName || 'Teacher_Workload.pdf');
        });
    }

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

    // Modal close listeners
    if (btnCloseScheduleModal) btnCloseScheduleModal.addEventListener('click', closeAttachScheduleModal);
    if (btnCancelScheduleModal) btnCancelScheduleModal.addEventListener('click', closeAttachScheduleModal);

    if (btnClosePreviewModal) {
        btnClosePreviewModal.addEventListener('click', () => {
            if (schedulePreviewModal) schedulePreviewModal.style.display = 'none';
        });
    }

    // Close on overlay backdrop click
    window.addEventListener('click', (e) => {
        if (e.target === attachScheduleModal) closeAttachScheduleModal();
        if (e.target === schedulePreviewModal && schedulePreviewModal) schedulePreviewModal.style.display = 'none';
    });

    // Delete teacher
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
            const { error: tDelErr } = await supabase
                .from('teachers')
                .delete()
                .eq('id', id);

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

    // Show alert
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

    // Event listeners
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

    // Initial load
    await loadTeachers();
});
