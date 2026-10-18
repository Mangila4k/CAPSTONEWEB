/**
 * Student Requirements - Supabase Integration
 * HES - HES, Hiraya Enrollment System
 *
 * Reads document URLs from BOTH the enrollments and students tables.
 * Filters records by the CURRENT school year so each year has its own record.
 */

import { supabase } from '../../supabase/config.js';

(function () {
    'use strict';

    console.log('📋 Student Requirements (Supabase) ready');

    // ============================================
    // DOM ELEMENTS
    // ============================================

    const studentName = document.getElementById('studentName');
    const studentInitial = document.getElementById('studentInitial');
    const logoutBtn = document.getElementById('logoutBtn');

    const requirementsList = document.getElementById('requirementsList');
    const submittedCount = document.getElementById('submittedCount');
    const missingCount = document.getElementById('missingCount');
    const totalCount = document.getElementById('totalCount');

    // Class info elements
    const gradeDisplay = document.getElementById('gradeDisplay');
    const sectionDisplay = document.getElementById('sectionDisplay');
    const strandDisplay = document.getElementById('strandDisplay');
    const statusDisplay = document.getElementById('statusDisplay');
    const schoolYearDisplay = document.getElementById('schoolYearDisplay');
    const classInfoCard = document.getElementById('classInfoCard');
    const statsContainer = document.getElementById('statsContainer');

    // Title element for requirements list
    const requirementsTitle = document.querySelector('.subjects-card h3');

    const uploadModal = document.getElementById('uploadModal');
    const requirementKeyInput = document.getElementById('requirement_key');
    const requirementLabel = document.getElementById('requirement_label');
    const fileInput = document.getElementById('requirement_file');
    const selectedFile = document.getElementById('selectedFile');
    const uploadForm = document.getElementById('uploadForm');
    const submitUpload = document.getElementById('submitUpload');

    const alertContainer = document.getElementById('alertContainer');

    // ============================================
    // STATE
    // ============================================

    let targetRow = null;
    let targetTable = 'enrollments';
    let requirementsData = [];

    // Master list of all possible requirements
    const allRequirements = {
        two_by_two: {
            key: 'two_by_two_picture',
            code: 'REQ-1',
            title: '2x2 ID Picture for Official School ID (White Background)',
            description: 'JPG or PNG (Formal attire with plain white background). Uploaded photo is used by the Registrar to generate your official school ID card with QR code upon enrollment approval.',
            dbField: 'two_by_two_picture_url'
        },
        form_137: {
            key: 'form_137',
            code: 'REQ-2',
            title: 'Form 137 (Permanent Record)',
            description: 'PDF, JPG, JPEG, or PNG',
            dbField: 'form_137_url'
        },
        report_card: {
            key: 'report_card',
            code: 'REQ-3',
            title: 'Report Card',
            description: 'PDF, JPG, JPEG, or PNG',
            dbField: 'report_card_url' 
        },
        cert_completion: {
            key: 'certificate_of_completion',
            code: 'REQ-4',
            title: 'Certificate of Completion (Elementary)',
            description: 'PDF, JPG, JPEG, or PNG',
            dbField: 'certificate_of_completion_url'
        },
        psa_birth: {
            key: 'psa_birth_cert',
            code: 'REQ-5',
            title: 'PSA Birth Certificate',
            description: 'PDF, JPG, JPEG, or PNG',
            dbField: 'psa_birth_url' 
        },
        good_moral: {
            key: 'good_moral_cert',
            code: 'REQ-6',
            title: 'Good Moral Certificate',
            description: 'PDF, JPG, JPEG, or PNG',
            dbField: 'good_moral_url'
        }
    };

    // ============================================
    // SESSION CHECK
    // ============================================

    let sessionUser = null;
    try {
        const stored = localStorage.getItem('currentUser');
        if (stored) sessionUser = JSON.parse(stored);
    } catch (e) {
        console.error('Failed to parse currentUser:', e);
    }

    console.log('🔑 Session user:', sessionUser);

    if (!sessionUser) {
        console.warn('⚠️ No active user session found, redirecting to login...');
        window.location.replace('../auth/login.html');
        return;
    }

    const role = String(sessionUser.role || '').toLowerCase();
    if (role && role !== 'student') {
        console.warn('⚠️ User role is not student:', role);
        const routes = {
            admin: '../admin/dashboard.html',
            teacher: '../teacher/dashboard.html',
            parent: '../parents/dashboard.html',
            registrar: '../registrar/dashboard.html'
        };
        window.location.replace(routes[role] || '../auth/login.html');
        return;
    }

    function getStudentInitials(name) {
        if (!name || typeof name !== 'string') return 'S';
        const cleanName = name.replace(/^(mr\.?|mrs\.?|ms\.?|dr\.?)\s+/i, '').trim();
        const words = cleanName.split(/[\s,&-]+/).filter(w => w.length > 0);
        if (words.length === 0) return 'S';
        if (words.length === 1) return words[0].charAt(0).toUpperCase();
        return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
    }

    function sanitizeStudentName(name, email) {
        if (!name && email) return email.split('@')[0];
        return (name || '').trim();
    }

    let displayName =
        sessionUser.displayName ||
        (sessionUser.firstName
            ? `${sessionUser.firstName} ${sessionUser.lastName || ''}`.trim()
            : sessionUser.email
            ? sessionUser.email.split('@')[0]
            : 'Student');
    displayName = sanitizeStudentName(displayName, sessionUser.email);

    if (studentName) studentName.textContent = displayName;
    if (studentInitial) studentInitial.textContent = getStudentInitials(displayName);

    // ============================================
    // LOGOUT
    // ============================================

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function (e) {
            e.preventDefault();
            localStorage.removeItem('currentUser');
            localStorage.removeItem('hes_student_avatar');
            localStorage.removeItem('hes_student_name');
            try {
                await supabase.auth.signOut();
            } catch (err) {
                console.warn('Sign out error:', err);
            }
            window.location.replace('../auth/login.html');
        });
    }

    // ============================================
    // LOAD & MERGE DATA
    // ============================================

    async function loadRequirementsData() {
        try {
            const email = (sessionUser.email || '').trim().toLowerCase();
            if (!email) {
                requirementsData = [];
                renderRequirements();
                updateProgress();
                return;
            }

            // 1. Fetch ALL enrollments to find the most recent school year
            const { data: allEnrollments } = await supabase
                .from('enrollments')
                .select('*')
                .ilike('email', email)
                .order('created_at', { ascending: false });

            // 2. Identify the current school year based on the newest record
            let currentSY = null;
            if (allEnrollments && allEnrollments.length > 0) {
                currentSY = allEnrollments[0].school_year || allEnrollments[0].last_school_year;
            }

            if (!currentSY) {
                console.error('❌ No active school year found.');
                showAlert('❌ Could not determine your current school year. Please contact the registrar.', 'error');
                requirementsData = [];
                renderRequirements();
                updateProgress();
                return;
            }

            // 3. Filter records to ONLY this specific school year
            const enrollRows = allEnrollments.filter(r => {
                const sy = r.school_year || r.last_school_year;
                return sy === currentSY;
            });

            let studentRows = [];
            const { data: rawStudentRows } = await supabase
                .from('students')
                .select('*')
                .ilike('email', email);
            
            if (rawStudentRows) {
                studentRows = rawStudentRows.filter(r => {
                    const sy = r.school_year || r.last_school_year;
                    return !sy || sy === currentSY;
                });
            }

            if (enrollRows.length === 0) {
                console.error('❌ No specific enrollment found for school year:', currentSY);
                showAlert(`❌ Could not find your enrollment record for ${currentSY}.`, 'error');
                requirementsData = [];
                renderRequirements();
                updateProgress();
                return;
            }

            // 4. Pick the primary row for UI info
            let primaryRow = enrollRows[0];
            let primaryTable = 'enrollments';

            // 5. Determine Student Type
            const studentTypeRaw = String(primaryRow.student_type || '').toLowerCase();
            const isNewOrTransferee = 
                studentTypeRaw.includes('new') || 
                studentTypeRaw.includes('transferee') || 
                studentTypeRaw.includes('transfer');

            // 6. Build dynamic list
            let activeDefs = [];
            if (isNewOrTransferee) {
                activeDefs = [
                    allRequirements.two_by_two,
                    allRequirements.form_137,
                    allRequirements.report_card,
                    allRequirements.cert_completion,
                    allRequirements.psa_birth,
                    allRequirements.good_moral
                ];
            } else {
                activeDefs = [
                    allRequirements.two_by_two,
                    allRequirements.report_card
                ];
            }

            // 7. Build merged document object by checking ONLY this year's rows
            const mergedDocs = {};
            activeDefs.forEach(def => {
                let foundUrl = null;
                
                // Check filtered enrollments first
                for (const row of enrollRows) {
                    if (row[def.dbField]) { foundUrl = row[def.dbField]; break; }
                }
                
                // If still not found, check filtered students table
                if (!foundUrl) {
                    for (const row of studentRows) {
                        if (row[def.dbField]) { foundUrl = row[def.dbField]; break; }
                    }
                }
                
                // Fallback for specific column name variations
                if (!foundUrl) {
                    if (def.key === 'report_card') {
                        for (const r of [...enrollRows, ...studentRows]) {
                            if (r.report_card_url || r.form_138_url) { 
                                foundUrl = r.report_card_url || r.form_138_url; 
                                break; 
                            }
                        }
                    }
                    if (def.key === 'psa_birth_cert') {
                        for (const r of [...enrollRows, ...studentRows]) {
                            if (r.psa_birth_url || r.psa_birth_cert_url) { 
                                foundUrl = r.psa_birth_url || r.psa_birth_cert_url; 
                                break; 
                            }
                        }
                    }
                    if (def.key === 'good_moral_cert') {
                        for (const r of [...enrollRows, ...studentRows]) {
                            if (r.good_moral_url || r.good_moral_cert_url) { 
                                foundUrl = r.good_moral_url || r.good_moral_cert_url; 
                                break; 
                            }
                        }
                    }
                }

                mergedDocs[def.dbField] = foundUrl;
            });

            // Update UI
            const reqContent = document.getElementById('requirementsContent');
            const noEnrollCard = document.getElementById('noEnrollmentCard');
            if (reqContent) reqContent.style.display = 'block';
            if (noEnrollCard) noEnrollCard.style.display = 'none';
            if (classInfoCard) classInfoCard.style.display = 'flex';
            if (statsContainer) statsContainer.style.display = 'grid';

            // Class Info
            const grade = primaryRow.grade_level || 'Grade 11';
            const strand = primaryRow.strand || 'TVL-ICT';
            const rawSt = String(primaryRow.status || 'pending').toLowerCase();
            const isEnrolled = rawSt === 'enrolled' || rawSt === 'approved';
            const statusText = isEnrolled ? 'Enrolled' : (rawSt === 'rejected' ? 'Rejected' : 'Pending');
            
            if (gradeDisplay) gradeDisplay.textContent = grade;
            if (strandDisplay) strandDisplay.textContent = strand;
            if (statusDisplay) statusDisplay.textContent = statusText;
            if (schoolYearDisplay) schoolYearDisplay.textContent = currentSY;

            // Update the Requirements Title to include the Grade Level
            if (requirementsTitle) {
                requirementsTitle.innerHTML = `<i class="fas fa-folder-open"></i> ${grade} Required Documents & Requirements`;
            }

            // Section
            let sectionName = primaryRow.section || null;
            const targetSecId = primaryRow.section_id;
            if (targetSecId) {
                try {
                    const { data: secRow } = await supabase.from('sections').select('name').eq('id', targetSecId).maybeSingle();
                    if (secRow && secRow.name) sectionName = secRow.name;
                } catch (secErr) {}
            }
            if (sectionDisplay) sectionDisplay.textContent = sectionName || 'Unassigned';
            
            // Update Student Name
            let fullName = `${primaryRow.first_name || ''} ${primaryRow.last_name || ''}`.trim();
            fullName = sanitizeStudentName(fullName, sessionUser.email);
            if (fullName) {
                if (studentName) studentName.textContent = fullName;
                if (studentInitial) studentInitial.textContent = getStudentInitials(fullName);
            }

            // 8. Map to requirements list
            requirementsData = activeDefs.map(def => {
                const fileUrl = mergedDocs[def.dbField];
                const isSubmitted = !!fileUrl;
                return {
                    ...def,
                    fileUrl,
                    isSubmitted,
                    status: isSubmitted ? 'Uploaded' : 'Missing'
                };
            });

            // Save the target row for uploads (must be the current year's row)
            targetRow = primaryRow;
            targetTable = primaryTable;

            renderRequirements();
            updateProgress();

        } catch (error) {
            console.error('❌ loadRequirementsData error:', error);
            showAlert('❌ Error loading requirements: ' + error.message, 'error');
        }
    }

    // ============================================
    // RENDER
    // ============================================

    function renderRequirements() {
        if (!requirementsList) return;
        requirementsList.innerHTML = '';

        if (requirementsData.length === 0) {
            requirementsList.innerHTML = `
                <div class="no-data" style="grid-column: 1/-1; padding: 30px; text-align: center; color: var(--gray-400);">
                    <i class="fas fa-file-alt" style="font-size: 2rem; margin-bottom: 0.5rem; display: block;"></i>
                    <p>No requirements listed for this school year.</p>
                </div>
            `;
            return;
        }

        requirementsData.forEach((item, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'subject-item';

            const reqCode = item.code || `REQ-${index + 1}`;
            const isSubmitted = item.isSubmitted;
            const statusClass = isSubmitted ? 'status-verified' : 'status-missing';
            const statusIcon = isSubmitted
                ? '<i class="fas fa-check-circle"></i>'
                : '<i class="fas fa-circle-exclamation"></i>';

            let actionHtml = '';
            if (isSubmitted) {
                actionHtml = `
                    <div class="req-actions-pill">
                        <a href="${item.fileUrl}" target="_blank" class="view-grade-btn" title="View Document">
                            <i class="fas fa-eye"></i> View
                        </a>
                        <button type="button" class="view-grade-btn btn-reupload-icon" data-key="${item.key}" data-label="${item.title}" title="Re-upload Document">
                            <i class="fas fa-arrow-rotate-right"></i>
                        </button>
                    </div>
                `;
            } else {
                actionHtml = `
                    <button type="button" class="view-grade-btn btn-upload-req" data-key="${item.key}" data-label="${item.title}">
                        <i class="fas fa-cloud-arrow-up"></i> Upload
                    </button>
                `;
            }

            itemDiv.innerHTML = `
                <div class="subject-info">
                    <h4>${item.title}</h4>
                    <div class="req-meta">
                        <span class="req-code">${reqCode}</span>
                        <span class="req-status-pill ${statusClass}">${statusIcon} <span>${item.status}</span></span>
                    </div>
                </div>
                ${actionHtml}
            `;

            requirementsList.appendChild(itemDiv);
        });

        document.querySelectorAll('.btn-upload-req, .btn-reupload-icon').forEach(btn => {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                openUploadModal(this.dataset.key, this.dataset.label);
            });
        });
    }

    // ============================================
    // PROGRESS
    // ============================================

    function updateProgress() {
        const total = requirementsData.length;
        const submitted = requirementsData.filter(r => r.isSubmitted).length;
        const missing = total - submitted;

        if (totalCount) totalCount.textContent = total;
        if (submittedCount) submittedCount.textContent = submitted;
        if (missingCount) missingCount.textContent = missing;

        console.log(`📊 Progress: ${submitted}/${total} uploaded, ${missing} missing`);
    }

    // ============================================
    // MODAL
    // ============================================

    function openUploadModal(key, label) {
        if (requirementKeyInput) requirementKeyInput.value = key;
        if (requirementLabel) requirementLabel.textContent = label;
        if (fileInput) fileInput.value = '';
        if (selectedFile) selectedFile.textContent = 'No file selected';
        if (uploadModal) uploadModal.style.display = 'flex';
    }

    function closeUploadModal() {
        if (uploadModal) uploadModal.style.display = 'none';
    }

    window.openUploadModal = openUploadModal;
    window.closeUploadModal = closeUploadModal;

    const closeModalBtn = document.querySelector('.close-modal');
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeUploadModal);

    const cancelUploadBtn = document.getElementById('cancelUpload');
    if (cancelUploadBtn) cancelUploadBtn.addEventListener('click', closeUploadModal);

    if (fileInput) {
        fileInput.addEventListener('change', function () {
            if (this.files && this.files.length > 0) {
                if (selectedFile) selectedFile.textContent = this.files[0].name;
            }
        });
    }

    // ============================================
    // UPLOAD
    // ============================================

    if (uploadForm) {
        uploadForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const key = requirementKeyInput?.value;
            const file = fileInput?.files?.[0];

            if (!file) {
                showAlert('⚠️ Please select a file to upload', 'error');
                return;
            }

            if (!targetRow?.id) {
                showAlert('❌ Record not found. Please refresh the page.', 'error');
                return;
            }

            if (submitUpload) {
                submitUpload.disabled = true;
                submitUpload.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
            }

            try {
                const def = Object.values(allRequirements).find(d => d.key === key);
                if (!def) throw new Error('Unknown requirement key: ' + key);

                const safeEmail = (sessionUser.email || 'student')
                    .replace(/[^a-z0-9]/gi, '_')
                    .toLowerCase();
                const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
                const filePath = `student_requirements/${safeEmail}_${key}_${Date.now()}.${ext}`;

                console.log('⬆️ Uploading to storage:', filePath);

                const { error: uploadErr } = await supabase.storage
                    .from('student_documents')
                    .upload(filePath, file, { upsert: true, contentType: file.type });

                if (uploadErr) throw uploadErr;

                const { data: urlData } = supabase.storage
                    .from('student_documents')
                    .getPublicUrl(filePath);

                const publicUrl = urlData?.publicUrl;
                if (!publicUrl) throw new Error('Could not get public URL');
                console.log('🔗 Public URL:', publicUrl);

                // Save to the specific row for this school year
                console.log(`💾 Updating ${targetTable}.${def.dbField} for id=${targetRow.id}`);
                const { error: dbErr } = await supabase
                    .from(targetTable)
                    .update({
                        [def.dbField]: publicUrl,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', targetRow.id);

                if (dbErr) throw dbErr;

                showAlert(`✅ ${def.title} uploaded successfully!`, 'success');
                closeUploadModal();
                await loadRequirementsData();
            } catch (err) {
                console.error('❌ Upload error:', err);
                showAlert('❌ Error uploading document: ' + (err.message || err), 'error');
            } finally {
                if (submitUpload) {
                    submitUpload.disabled = false;
                    submitUpload.innerHTML = 'Submit Upload';
                }
            }
        });
    }

    // ============================================
    // ALERT
    // ============================================

    function showAlert(message, type = 'success') {
        if (!alertContainer) return;
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.innerHTML = `<i class="fas fa-${
            type === 'success' ? 'check-circle' : 'exclamation-circle'
        }"></i> <span>${message}</span>`;
        alertContainer.appendChild(alertDiv);
        setTimeout(() => alertDiv.remove(), 4000);
    }

    // ============================================
    // DATE BADGE
    // ============================================

    const dateBadge = document.querySelector('.date-badge');
    if (dateBadge) {
        const now = new Date();
        dateBadge.innerHTML = `<i class="fas fa-calendar-alt"></i> ${now.toLocaleDateString(
            'en-US',
            { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
        )}`;
    }

    // ============================================
    // INIT
    // ============================================

    loadRequirementsData();
})();