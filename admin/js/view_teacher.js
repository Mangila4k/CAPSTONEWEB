// ===== VIEW TEACHER JAVASCRIPT (Supabase Dynamic Integration) =====

import { supabase } from '../../supabase/config.js';

document.addEventListener('DOMContentLoaded', async function() {
    'use strict';

    // DOM Elements
    const alertContainer = document.getElementById('alertContainer');
    const avatarInitial = document.getElementById('avatarInitial');
    const teacherName = document.getElementById('teacherName');
    const teacherEmail = document.getElementById('teacherEmail');
    const teacherIdNumber = document.getElementById('teacherIdNumber');
    const teacherRegistered = document.getElementById('teacherRegistered');
    const teacherDaysActive = document.getElementById('teacherDaysActive');

    const statSections = document.getElementById('statSections');
    const statStudents = document.getElementById('statStudents');
    const statSubjects = document.getElementById('statSubjects');

    const sectionsContainer = document.getElementById('sectionsContainer');
    const subjectsContainer = document.getElementById('subjectsContainer');

    // Get teacher ID from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const teacherId = urlParams.get('id');

    // ===== FUNCTIONS =====

    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            month: 'long', 
            day: 'numeric', 
            year: 'numeric'
        });
    }

    function calculateDaysActive(createdAt) {
        if (!createdAt) return 0;
        const created = new Date(createdAt);
        const today = new Date();
        const diffTime = Math.abs(today - created);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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

    // Load teacher profile dynamically
    async function loadTeacherProfile() {
        if (!teacherId) {
            showAlert('No teacher ID specified in the URL.', 'error');
            return;
        }

        try {
            // 1. Fetch teacher record
            let teacherRecord = null;
            let userRecord = null;

            const { data: tData } = await supabase
                .from('teachers')
                .select('*')
                .eq('id', teacherId)
                .maybeSingle();

            if (tData) {
                teacherRecord = tData;
                if (tData.user_id) {
                    const { data: uData } = await supabase
                        .from('users')
                        .select('*')
                        .eq('id', tData.user_id)
                        .maybeSingle();
                    userRecord = uData;
                }
            } else {
                // Try searching by user ID
                const { data: uData } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', teacherId)
                    .maybeSingle();

                if (uData) {
                    userRecord = uData;
                    const { data: tByUser } = await supabase
                        .from('teachers')
                        .select('*')
                        .eq('user_id', uData.id)
                        .maybeSingle();
                    teacherRecord = tByUser;
                }
            }

            if (!userRecord && !teacherRecord) {
                showAlert('Teacher not found in database.', 'error');
                return;
            }

            const fullName = userRecord ? `${userRecord.first_name || ''} ${userRecord.last_name || ''}`.trim() : (teacherRecord?.fullname || 'Faculty Teacher');
            const email = userRecord?.email || teacherRecord?.email || 'N/A';
            const employeeId = teacherRecord?.employee_id || 'HES-TCH-0000';
            const createdAt = teacherRecord?.created_at || userRecord?.created_at || new Date().toISOString();
            const initial = fullName.charAt(0).toUpperCase() || 'T';
            const daysActive = calculateDaysActive(createdAt);

            if (avatarInitial) avatarInitial.textContent = initial;
            if (teacherName) teacherName.textContent = fullName;
            if (teacherEmail) teacherEmail.textContent = email;
            if (teacherIdNumber) teacherIdNumber.textContent = employeeId;
            if (teacherRegistered) teacherRegistered.textContent = formatDate(createdAt);
            if (teacherDaysActive) teacherDaysActive.textContent = daysActive;

            // 2. Fetch assigned sections
            const teacherKey = teacherRecord?.id || teacherId;
            const userKey = userRecord?.id || teacherId;

            const { data: sectionsData } = await supabase
                .from('sections')
                .select('*')
                .or(`adviser_id.eq.${teacherKey},adviser_id.eq.${userKey}`);

            const sections = sectionsData || [];

            // 3. Fetch students count under advisory
            let totalStudentsCount = 0;
            if (sections.length > 0) {
                const sectionIds = sections.map(s => s.id);
                const { count: sCount } = await supabase
                    .from('students')
                    .select('*', { count: 'exact', head: true })
                    .in('section_id', sectionIds);

                totalStudentsCount = sCount || 0;
            }

            // 4. Fetch subjects taught
            const { data: subjectsData } = await supabase
                .from('subjects')
                .select('*')
                .limit(6);

            const subjects = subjectsData || [];

            // Update stats
            if (statSections) statSections.textContent = sections.length;
            if (statStudents) statStudents.textContent = totalStudentsCount;
            if (statSubjects) statSubjects.textContent = subjects.length;

            // Render sections
            if (sectionsContainer) {
                if (sections.length === 0) {
                    sectionsContainer.innerHTML = `
                        <div class="no-data" style="text-align: center; padding: 24px; color: #64748b;">
                            <i class="fas fa-layer-group" style="font-size: 28px; color: #cbd5e1; margin-bottom: 8px;"></i>
                            <p style="margin: 0;">No advisory sections currently assigned to this teacher.</p>
                        </div>
                    `;
                } else {
                    let sHtml = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px;">';
                    sections.forEach(sec => {
                        sHtml += `
                            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
                                <h4 style="margin: 0 0 6px 0; color: #0f172a; font-size: 14px;">${sec.name || 'Section'}</h4>
                                <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b;">Grade: ${sec.grade_level || 'Grade 11'} ${sec.strand ? '• ' + sec.strand : ''}</p>
                                <a href="view_section.html?id=${sec.id}" class="badge badge-info" style="text-decoration: none; display: inline-block;">View Section &rarr;</a>
                            </div>
                        `;
                    });
                    sHtml += '</div>';
                    sectionsContainer.innerHTML = sHtml;
                }
            }

            // Render subjects
            if (subjectsContainer) {
                if (subjects.length === 0) {
                    subjectsContainer.innerHTML = `
                        <div class="no-data" style="text-align: center; padding: 24px; color: #64748b;">
                            <i class="fas fa-book-open" style="font-size: 28px; color: #cbd5e1; margin-bottom: 8px;"></i>
                            <p style="margin: 0;">No subjects registered for this department.</p>
                        </div>
                    `;
                } else {
                    let subHtml = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px;">';
                    subjects.forEach(sub => {
                        subHtml += `
                            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
                                <strong style="font-size: 13px; color: #1e293b; display: block; margin-bottom: 4px;">${sub.name}</strong>
                                <span style="font-size: 11.5px; color: #64748b;">Grade ${sub.grade_level || '—'} ${sub.strand ? '(' + sub.strand + ')' : ''}</span>
                            </div>
                        `;
                    });
                    subHtml += '</div>';
                    subjectsContainer.innerHTML = subHtml;
                }
            }

            // 5. Fetch Teacher Load Schedules & Admin Document
            await loadTeacherSchedulesAndDoc(teacherRecord?.id || teacherId, userRecord?.id);

        } catch (err) {
            console.error('Error loading teacher profile:', err);
            showAlert('Failed to load teacher profile: ' + err.message, 'error');
        }
    }

    async function loadTeacherSchedulesAndDoc(tId, uId) {
        const badgeEl = document.getElementById('adminTeacherLoadBadge');
        const tbodyEl = document.getElementById('adminTeacherLoadTableBody');
        const uploadBox = document.getElementById('adminUploadedLoadBox');
        const docNameEl = document.getElementById('adminDocFileName');
        const docMetaEl = document.getElementById('adminDocMeta');
        const iconBox = document.getElementById('adminDocIconBox');
        const fileInput = document.getElementById('inputAdminTeacherLoadFile');
        const triggerBtn = document.getElementById('btnTriggerUploadTeacherLoad');
        const previewBtn = document.getElementById('btnAdminDocPreviewInView');
        const deleteBtn = document.getElementById('btnAdminDocDeleteInView');
        const modal = document.getElementById('modalAdminDocViewerInTeacher');
        const modalContent = document.getElementById('modalAdminDocViewerContent');
        const modalTitle = document.getElementById('modalAdminDocViewerTitle');
        const closeModalBtn = document.getElementById('btnCloseModalAdminDocViewer');

        // Fetch schedules
        let schedules = [];
        try {
            const { data: sRows } = await supabase
                .from('schedules')
                .select('*')
                .eq('teacher_id', tId);
            if (sRows && sRows.length > 0) {
                schedules = sRows;
            } else if (uId) {
                const { data: sByUser } = await supabase
                    .from('schedules')
                    .select('*')
                    .eq('teacher_id', uId);
                if (sByUser) schedules = sByUser;
            }
        } catch (e) {
            console.warn('Error fetching schedules:', e);
        }

        // Fetch section and subject names
        const secIds = [...new Set(schedules.map(s => s.section_id).filter(Boolean))];
        const subIds = [...new Set(schedules.map(s => s.subject_id).filter(Boolean))];
        const secMap = {};
        const subMap = {};

        if (secIds.length > 0) {
            const { data: secs } = await supabase.from('sections').select('id, name, grade_level, room').in('id', secIds);
            (secs || []).forEach(s => { secMap[s.id] = s; });
        }
        if (subIds.length > 0) {
            const { data: subs } = await supabase.from('subjects').select('id, name, code').in('id', subIds);
            (subs || []).forEach(s => { subMap[s.id] = s; });
        }

        if (badgeEl) badgeEl.textContent = `${schedules.length} classes assigned`;

        if (tbodyEl) {
            if (schedules.length === 0) {
                tbodyEl.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 24px; color: #64748b;">
                            <i class="fas fa-calendar-times" style="font-size: 24px; color: #cbd5e1; margin-bottom: 6px;"></i>
                            <p style="margin: 4px 0 0 0;">No classes currently scheduled for this teacher.</p>
                            <a href="sections.html" style="font-size: 12px; color: #2563eb; text-decoration: underline; margin-top: 4px; display: inline-block;">Assign in Section Schedules &rarr;</a>
                        </td>
                    </tr>
                `;
            } else {
                tbodyEl.innerHTML = schedules.map((item, idx) => {
                    const sec = secMap[item.section_id] || {};
                    const sub = subMap[item.subject_id] || {};
                    const subjTitle = item.subject || sub.name || 'Subject';
                    const secTitle = sec.name || 'Section';
                    const formatTime = (t) => {
                        if (!t) return '';
                        const [h, m] = t.split(':');
                        const hr = parseInt(h, 10);
                        const ampm = hr >= 12 ? 'PM' : 'AM';
                        const hr12 = hr % 12 || 12;
                        return `${hr12}:${m || '00'} ${ampm}`;
                    };
                    const timeStr = `${formatTime(item.start_time)} - ${formatTime(item.end_time)}`;

                    return `
                        <tr style="border-bottom: 1px solid #e2e8f0;">
                            <td style="padding: 10px 12px; color: #64748b; font-weight: 700;">${idx + 1}</td>
                            <td style="padding: 10px 12px; font-weight: 700; color: #0b2b4a;">
                                ${subjTitle} ${sub.code ? `<span class="badge badge-info" style="font-size: 10px;">${sub.code}</span>` : ''}
                            </td>
                            <td style="padding: 10px 12px; color: #1e293b;">
                                ${secTitle} ${sec.grade_level ? `<span style="font-size: 11px; color: #64748b;">(Grade ${sec.grade_level})</span>` : ''}
                            </td>
                            <td style="padding: 10px 12px;">
                                <span class="badge badge-info" style="padding: 3px 8px;">${item.day || 'Monday'}</span>
                            </td>
                            <td style="padding: 10px 12px; font-weight: 600; color: #0b2b4a;">${timeStr}</td>
                            <td style="padding: 10px 12px; color: #64748b;">${item.room || sec.room || 'Room 101'}</td>
                            <td style="padding: 10px 12px;">
                                <a href="create_schedule.html?section_id=${item.section_id || ''}" class="badge badge-warning" style="text-decoration: none; padding: 4px 8px; font-size: 11.5px;">
                                    <i class="fas fa-edit"></i> Edit in Section
                                </a>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }

        // Check for official teacher load document
        let activeDoc = null;
        const localDocKey = `hes_teacher_load_doc_${tId}`;
        const rawLocal = localStorage.getItem(localDocKey) || (uId ? localStorage.getItem(`hes_teacher_load_doc_${uId}`) : null);
        if (rawLocal) {
            try { activeDoc = JSON.parse(rawLocal); } catch(e) {}
        }

        function renderActiveDocUI() {
            if (activeDoc && (activeDoc.fileData || activeDoc.url)) {
                if (uploadBox) uploadBox.style.display = 'block';
                if (docNameEl) docNameEl.textContent = activeDoc.fileName || 'Teacher_Load_Schedule';
                if (docMetaEl) {
                    const dateStr = activeDoc.uploadDate ? new Date(activeDoc.uploadDate).toLocaleDateString() : 'Recently';
                    docMetaEl.textContent = `Issued by Administration • ${dateStr}`;
                }
                if (iconBox) {
                    const isImg = (activeDoc.fileType || '').startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(activeDoc.fileName || '') || (activeDoc.fileData && activeDoc.fileData.startsWith('data:image/'));
                    iconBox.innerHTML = isImg ? '<i class="fas fa-file-image text-success"></i>' : '<i class="fas fa-file-pdf text-danger"></i>';
                }
            } else {
                if (uploadBox) uploadBox.style.display = 'none';
            }
        }

        renderActiveDocUI();

        // Upload triggers
        if (triggerBtn && fileInput) {
            triggerBtn.onclick = () => fileInput.click();
        }

        if (fileInput) {
            fileInput.onchange = (e) => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;
                if (file.size > 15 * 1024 * 1024) {
                    alert('File exceeds 15MB size limit.');
                    return;
                }

                const reader = new FileReader();
                reader.onload = async function(evt) {
                    const dataUrl = evt.target.result;
                    const isImg = (file.type || '').startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(file.name);
                    const fileType = file.type || (isImg ? 'image/png' : 'application/pdf');

                    activeDoc = {
                        teacherId: tId,
                        fileName: file.name,
                        fileType: fileType,
                        fileData: dataUrl,
                        url: dataUrl,
                        isImage: isImg,
                        uploadDate: new Date().toISOString(),
                        issuedBy: 'Administration'
                    };

                    localStorage.setItem(localDocKey, JSON.stringify(activeDoc));
                    if (uId) localStorage.setItem(`hes_teacher_load_doc_${uId}`, JSON.stringify(activeDoc));
                    localStorage.setItem('hes_teacher_load_admin_doc', JSON.stringify(activeDoc));

                    try {
                        await supabase.from('teachers').update({
                            teacher_load_url: dataUrl,
                            teacher_load_name: file.name,
                            teacher_load_updated_at: new Date().toISOString()
                        }).eq('id', tId);
                    } catch(err) {}

                    renderActiveDocUI();
                    showAlert('Official Teacher Load document/image uploaded and published to faculty!', 'success');
                };
                reader.readAsDataURL(file);
            };
        }

        // Preview & Delete
        if (previewBtn) {
            previewBtn.onclick = () => {
                if (!activeDoc || (!activeDoc.fileData && !activeDoc.url)) return;
                if (modal && modalContent) {
                    const isImg = activeDoc.isImage || (activeDoc.fileType || '').startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(activeDoc.fileName || '');
                    if (isImg) {
                        modalContent.innerHTML = `<img src="${activeDoc.fileData || activeDoc.url}" alt="Schedule Preview" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px;">`;
                    } else {
                        modalContent.innerHTML = `<iframe src="${activeDoc.fileData || activeDoc.url}" style="width: 100%; height: 100%; border: none;"></iframe>`;
                    }
                    if (modalTitle) modalTitle.textContent = activeDoc.fileName || 'Teacher Load Document';
                    modal.style.display = 'flex';
                }
            };
        }

        if (deleteBtn) {
            deleteBtn.onclick = async () => {
                if (!confirm('Are you sure you want to remove this official teacher load document?')) return;
                activeDoc = null;
                localStorage.removeItem(localDocKey);
                if (uId) localStorage.removeItem(`hes_teacher_load_doc_${uId}`);
                try {
                    await supabase.from('teachers').update({
                        teacher_load_url: null,
                        teacher_load_name: null,
                        teacher_load_updated_at: new Date().toISOString()
                    }).eq('id', tId);
                } catch(e) {}
                renderActiveDocUI();
                showAlert('Teacher Load document removed.', 'success');
            };
        }

        if (closeModalBtn && modal) {
            closeModalBtn.onclick = () => { modal.style.display = 'none'; };
        }
    }

    await loadTeacherProfile();
});