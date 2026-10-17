/**
 * Student Requirements - Supabase Integration
 * HES - HES, Hiraya Enrollment System
 */

import { supabase } from '../../supabase/config.js';

(function() {
    'use strict';

    console.log('📋 Student Requirements (Supabase) ready');

    // ============================================
    // DOM ELEMENTS
    // ============================================

    const studentName = document.getElementById('studentName');
    const studentInitial = document.getElementById('studentInitial');
    const logoutBtn = document.getElementById('logoutBtn');

    // Requirement elements
    const requirementsList = document.getElementById('requirementsList');
    const submittedCount = document.getElementById('submittedCount');
    const missingCount = document.getElementById('missingCount');
    const totalCount = document.getElementById('totalCount');

    // Class info elements (matches report card / grades.js)
    const gradeDisplay = document.getElementById('gradeDisplay');
    const sectionDisplay = document.getElementById('sectionDisplay');
    const strandDisplay = document.getElementById('strandDisplay');
    const statusDisplay = document.getElementById('statusDisplay');
    const schoolYearDisplay = document.getElementById('schoolYearDisplay');
    const classInfoCard = document.getElementById('classInfoCard');
    const statsContainer = document.getElementById('statsContainer');

    // Modal elements
    const uploadModal = document.getElementById('uploadModal');
    const requirementKeyInput = document.getElementById('requirement_key');
    const requirementLabel = document.getElementById('requirement_label');
    const fileInput = document.getElementById('requirement_file');
    const selectedFile = document.getElementById('selectedFile');
    const uploadForm = document.getElementById('uploadForm');
    const submitUpload = document.getElementById('submitUpload');
    const uploadProgress = document.getElementById('uploadProgress');
    const uploadProgressFill = document.getElementById('uploadProgressFill');

    // Alert container
    const alertContainer = document.getElementById('alertContainer');

    // ============================================
    // STATE
    // ============================================

    let studentRow = null;
    let requirementsData = [];

    const requirementDefs = [
        {
            key: 'two_by_two_picture',
            code: 'REQ-1',
            title: '2x2 ID Picture (White Background)',
            description: 'Recent 2x2 colored ID picture taken in formal attire with plain white background.',
            required: true,
            dbField: 'two_by_two_picture_url'
        },
        {
            key: 'psa_birth',
            code: 'REQ-2',
            title: 'PSA Official Birth Certificate',
            description: 'Original or clear photocopy of Philippine Statistics Authority (PSA) Birth Certificate.',
            required: true,
            dbField: 'psa_birth_url'
        },
        {
            key: 'report_card',
            code: 'REQ-3',
            title: 'Report Card (Form 138)',
            description: 'Original Report Card from previous grade level signed by the Principal.',
            required: true,
            dbField: 'form_138_url'
        },
        {
            key: 'good_moral',
            code: 'REQ-4',
            title: 'Certificate of Good Moral Character',
            description: 'Official Certificate of Good Moral Character issued by previous school.',
            required: true,
            dbField: 'good_moral_url'
        }
    ];

    // ============================================
    // SESSION CHECK (Supabase / localStorage)
    // ============================================

    let sessionUser = null;
    try {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            sessionUser = JSON.parse(stored);
        }
    } catch(e) {}

    if (!sessionUser) {
        console.warn('⚠️ No active user session found, redirecting to login...');
        window.location.replace('../auth/login.html');
        return;
    }

    if (sessionUser.role && sessionUser.role !== 'student') {
        const routes = {
            'admin': '../admin/dashboard.html',
            'teacher': '../teacher/dashboard.html',
            'parent': '../parents/dashboard.html',
            'registrar': '../registrar/dashboard.html'
        };
        window.location.replace(routes[sessionUser.role] || '../auth/login.html');
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
        if (!name && email) {
            return email.split('@')[0];
        }
        return (name || '').trim();
    }

    let displayName = sessionUser.displayName || 
        (sessionUser.firstName ? `${sessionUser.firstName} ${sessionUser.lastName || ''}`.trim() : 
        (sessionUser.email ? sessionUser.email.split('@')[0] : 'Student'));
    displayName = sanitizeStudentName(displayName, sessionUser.email);

    if (studentName) studentName.textContent = displayName;
    if (studentInitial) studentInitial.textContent = getStudentInitials(displayName);

    // ============================================
    // LOGOUT
    // ============================================

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            localStorage.removeItem('currentUser');
            localStorage.removeItem('hes_student_avatar');
            localStorage.removeItem('hes_student_name');
            try {
                await supabase.auth.signOut();
            } catch(err) {}
            window.location.replace('../auth/login.html');
        });
    }

    // ============================================
    // LOAD REQUIREMENTS DATA FROM SUPABASE
    // ============================================

    async function loadRequirementsData() {
        try {
            const userEmail = sessionUser.email || '';
            const userUid = sessionUser.uid || '';

            // 1. Fetch student
            try {
                const { data: sRows } = await supabase
                    .from('students')
                    .select('*')
                    .or(`email.eq.${userEmail},id.eq.${userUid}`);

                if (sRows && sRows.length > 0) {
                    studentRow = sRows[0];
                    let fullName = `${studentRow.first_name || ''} ${studentRow.last_name || ''}`.trim();
                    fullName = sanitizeStudentName(fullName, userEmail);
                    if (fullName) {
                        if (studentName) studentName.textContent = fullName;
                        if (studentInitial) studentInitial.textContent = getStudentInitials(fullName);
                    }
                }
            } catch(e) {}

            // 2. Fetch student_documents
            let uploadedDocs = [];
            if (studentRow?.id) {
                try {
                    const { data: docs } = await supabase
                        .from('student_documents')
                        .select('*')
                        .eq('student_id', studentRow.id);
                    if (docs) uploadedDocs = docs;
                } catch(e) {}
            }

            // 3. Fetch enrollment to show status and grade
            let enrollment = null;
            try {
                let eq = supabase.from('enrollments').select('*');
                if (userEmail && studentRow?.id) {
                    eq = eq.or(`email.eq.${userEmail},student_id.eq.${studentRow.id}`);
                } else if (userEmail) {
                    eq = eq.eq('email', userEmail);
                } else if (studentRow?.id) {
                    eq = eq.eq('student_id', studentRow.id);
                }
                const { data: eRows } = await eq.order('created_at', { ascending: false }).limit(1);
                if (eRows && eRows.length > 0) enrollment = eRows[0];
            } catch(e) {}

            const reqContent = document.getElementById('requirementsContent');
            const noEnrollCard = document.getElementById('noEnrollmentCard');

            if (reqContent) reqContent.style.display = 'block';
            if (noEnrollCard) noEnrollCard.style.display = 'none';
            if (classInfoCard) classInfoCard.style.display = 'flex';
            if (statsContainer) statsContainer.style.display = 'grid';

            const grade = enrollment?.grade_level || enrollment?.grade || studentRow?.grade_level || 'Grade 11';
            const strand = enrollment?.strand || studentRow?.strand || 'TVL-ICT';
            const rawSt = (enrollment?.status || studentRow?.status || 'pending').toLowerCase();
            const isEnrolled = rawSt === 'enrolled' || rawSt === 'approved';
            const statusText = isEnrolled ? 'Enrolled' : (rawSt === 'rejected' ? 'Rejected' : 'Pending');
            const sy = enrollment?.school_year || enrollment?.last_school_year || '2025-2026';

            // Resolve Section Name
            let sectionName = studentRow?.section || enrollment?.section || null;
            const targetSecId = studentRow?.section_id || enrollment?.section_id;
            if (targetSecId) {
                try {
                    const { data: secRow } = await supabase
                        .from('sections')
                        .select('name')
                        .eq('id', targetSecId)
                        .maybeSingle();
                    if (secRow && secRow.name) {
                        sectionName = secRow.name;
                    }
                } catch(secErr) {}
            }

            if (gradeDisplay) gradeDisplay.textContent = grade;
            if (sectionDisplay) sectionDisplay.textContent = sectionName || 'Unassigned';
            if (strandDisplay) strandDisplay.textContent = strand;
            if (statusDisplay) statusDisplay.textContent = statusText;
            if (schoolYearDisplay) schoolYearDisplay.textContent = sy;

            const isTransfereeStudent = String(enrollment?.student_type || studentRow?.student_type || '').toLowerCase().includes('transfer') || String(enrollment?.student_type || studentRow?.student_type || '').toLowerCase().includes('different');

            // Check local uploaded documents
            let localDocs = [];
            try {
                const s = localStorage.getItem('hes_student_documents');
                if (s) {
                    const parsed = JSON.parse(s);
                    if (Array.isArray(parsed)) localDocs = parsed;
                }
            } catch(e) {}

            
            // Check if Good Moral has been requested by Registrar
            const userEmailLower = (userEmail || '').toLowerCase();
            const studentIdVal = studentRow?.id || sessionUser?.uid || '';
            let isGoodMoralRequested = false;
            let gmNoticeMessage = "The Registrar's Office has requested your Certificate of Good Moral Character from your previous school to finalize your official enrollment credentials. Please upload a clear photo or scanned copy below.";

            if (
                localStorage.getItem(`hes_req_requested_${studentIdVal}_good_moral`) ||
                localStorage.getItem(`hes_req_requested_${userEmailLower}_good_moral`) ||
                localStorage.getItem(`hes_req_requested_${studentIdVal}_missing_goodmoral`) ||
                localStorage.getItem(`hes_req_requested_${userEmailLower}_missing_goodmoral`)
            ) {
                isGoodMoralRequested = true;
            }

            // Check Supabase notifications
            try {
                let nQuery = supabase.from('notifications').select('*');
                if (studentIdVal && userEmailLower) {
                    nQuery = nQuery.or(`user_id.eq.${studentIdVal},student_id.eq.${studentIdVal},recipient_email.ilike.${userEmailLower}`);
                } else if (studentIdVal) {
                    nQuery = nQuery.or(`user_id.eq.${studentIdVal},student_id.eq.${studentIdVal}`);
                } else if (userEmailLower) {
                    nQuery = nQuery.ilike('recipient_email', userEmailLower);
                }
                const { data: nList } = await nQuery.order('created_at', { ascending: false }).limit(20);
                if (nList) {
                    const gmNotif = nList.find(n => 
                        n.type === 'good_moral_request' || 
                        (n.title && n.title.toLowerCase().includes('good moral')) ||
                        (n.message && n.message.toLowerCase().includes('good moral'))
                    );
                    if (gmNotif) {
                        isGoodMoralRequested = true;
                        if (gmNotif.message) gmNoticeMessage = gmNotif.message;
                    }
                }
            } catch(e) {}

            // Check local notifications list
            try {
                const localNotifs = JSON.parse(localStorage.getItem(`hes_notifications_${studentIdVal}`) || '[]');
                const gmItem = localNotifs.find(n => 
                    n.type === 'good_moral_request' || 
                    (n.title && n.title.toLowerCase().includes('good moral'))
                );
                if (gmItem) {
                    isGoodMoralRequested = true;
                    if (gmItem.message) gmNoticeMessage = gmItem.message;
                }
            } catch(e) {}

            // 4. Assemble requirements status
            requirementsData = requirementDefs.map(def => {
                let currentTitle = def.title;
                let currentDesc = def.description;

                if (def.key === 'form_138' && isTransfereeStudent) {
                    currentTitle = 'Report Card';
                    currentDesc = 'Original Report Card from previous school showing passing quarterly grades.';
                }

                let fileUrl = studentRow ? studentRow[def.dbField] : null;
                let isSubmitted = !!fileUrl;
                let status = isSubmitted ? 'Verified' : 'Missing';

                const isRcKey = def.key === 'report_card' || def.key === 'form_138';
                const docMatch = uploadedDocs.find(d => 
                    d.document_type === currentTitle || 
                    d.document_type === def.title || 
                    d.document_type === def.key ||
                    (isRcKey && (d.document_type === 'Report Card' || d.document_type === 'report_card' || d.document_type === 'form_138' || (d.title && d.title.toLowerCase().includes('report card'))))
                ) || localDocs.find(d => 
                    d.type === currentTitle || 
                    d.type === def.title || 
                    d.title === currentTitle ||
                    (isRcKey && (d.type === 'Report Card' || d.type === 'Form 138 / Report Card' || (d.title && d.title.toLowerCase().includes('report card')))) ||
                    (def.key === 'two_by_two_picture' && (d.type === '2x2 ID Picture' || (d.title && d.title.includes('2x2'))))
                );

                if (docMatch) {
                    fileUrl = docMatch.file_url || docMatch.dataUrl || fileUrl;
                    isSubmitted = true;
                    status = docMatch.verified ? 'Verified' : (docMatch.status || 'Under Review');
                }

                return {
                    ...def,
                    title: currentTitle,
                    description: currentDesc,
                    fileUrl: fileUrl,
                    isSubmitted: isSubmitted,
                    status: status
                };
            });

            renderRequirements();
            updateProgress();

        } catch (error) {
            console.error('Error loading requirements data:', error);
            showAlert('❌ Error loading requirements: ' + error.message, 'error');
        }
    }

    // ============================================
    // RENDER REQUIREMENTS LIST
    // ============================================
    // RENDER REQUIREMENTS LIST (REPORT CARD THEMED)
    // ============================================

    function renderRequirements() {
        if (!requirementsList) return;
        requirementsList.innerHTML = '';

        if (requirementsData.length === 0) {
            requirementsList.innerHTML = `
                <div class="no-data" style="grid-column: 1/-1; padding: 30px; text-align: center; color: var(--gray-400);">
                    <i class="fas fa-file-alt" style="font-size: 2rem; margin-bottom: 0.5rem; display: block;"></i>
                    <p>No requirements listed for your enrollment status.</p>
                </div>
            `;
            return;
        }

        requirementsData.forEach((item, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'subject-item';

            const reqCode = item.code || `REQ-${index + 1}`;
            const isVerified = item.status === 'Verified';
            const isReview = item.status === 'Under Review';
            const statusClass = isVerified ? 'status-verified' : (isReview ? 'status-review' : 'status-missing');
            const statusIcon = isVerified ? '<i class="fas fa-check-circle"></i>' : (isReview ? '<i class="fas fa-clock"></i>' : '<i class="fas fa-circle-exclamation"></i>');

            let actionHtml = '';
            if (item.isSubmitted && item.fileUrl) {
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
                        ${item.isRequested ? `<span class="req-status-pill status-urgent"><i class="fas fa-bell"></i> Requested</span>` : ''}
                    </div>
                </div>
                ${actionHtml}
            `;

            requirementsList.appendChild(itemDiv);
        });

        // Attach upload button events
        document.querySelectorAll('.btn-upload-req, .btn-reupload-icon').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                const key = this.dataset.key;
                const label = this.dataset.label;
                openUploadModal(key, label);
            });
        });
    }

    // ============================================
    // PROGRESS UPDATE
    // ============================================

    function updateProgress() {
        const total = requirementsData.length;
        const submitted = requirementsData.filter(r => r.isSubmitted).length;
        const missing = total - submitted;

        if (totalCount) totalCount.textContent = total;
        if (submittedCount) submittedCount.textContent = submitted;
        if (missingCount) missingCount.textContent = missing;
    }

    // ============================================
    // MODAL HANDLERS
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
        fileInput.addEventListener('change', function() {
            if (this.files && this.files.length > 0) {
                if (selectedFile) selectedFile.textContent = this.files[0].name;
            }
        });
    }

    // Handle Upload Form Submit
    if (uploadForm) {
        uploadForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const key = requirementKeyInput?.value;
            const file = fileInput?.files?.[0];

            if (!file) {
                showAlert('⚠️ Please select a file to upload', 'error');
                return;
            }

            if (submitUpload) {
                submitUpload.disabled = true;
                submitUpload.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
            }

            try {
                const reader = new FileReader();
                reader.onload = async function(evt) {
                    const dataUrl = evt.target.result;
                    
                    // Match requirement and update in Supabase / state
                    const targetReq = requirementsData.find(r => r.key === key);
                    if (targetReq) {
                        targetReq.isSubmitted = true;
                        targetReq.status = 'Under Review';
                        targetReq.fileUrl = dataUrl;

                        // Update in Supabase student record if available
                        if (studentRow?.id && targetReq.dbField) {
                            try {
                                await supabase
                                    .from('students')
                                    .update({ [targetReq.dbField]: dataUrl })
                                    .eq('id', studentRow.id);
                            } catch(err) {
                                console.warn('Could not update student doc column in Supabase:', err);
                            }
                        }
                    }

                    if (key === 'good_moral') {
                        const studentIdVal = studentRow?.id || sessionUser?.uid || '';
                        const userEmailLower = (sessionUser?.email || '').toLowerCase();
                        localStorage.removeItem(`hes_req_requested_${studentIdVal}_good_moral`);
                        localStorage.removeItem(`hes_req_requested_${userEmailLower}_good_moral`);
                        localStorage.removeItem(`hes_req_requested_${studentIdVal}_missing_goodmoral`);
                        localStorage.removeItem(`hes_req_requested_${userEmailLower}_missing_goodmoral`);
                        const statusAlert = document.getElementById('statusAlert');
                        if (statusAlert) { statusAlert.style.display = 'none'; statusAlert.innerHTML = ''; }
                    }
                    showAlert(`✅ ${targetReq ? targetReq.title : 'Document'} uploaded successfully!`, 'success');
                    renderRequirements();
                    updateProgress();
                    closeUploadModal();

                    if (submitUpload) {
                        submitUpload.disabled = false;
                        submitUpload.innerHTML = 'Submit Upload';
                    }
                };
                reader.readAsDataURL(file);

            } catch (err) {
                console.error('Upload error:', err);
                showAlert('❌ Error uploading document: ' + err.message, 'error');
                if (submitUpload) {
                    submitUpload.disabled = false;
                    submitUpload.innerHTML = 'Submit Upload';
                }
            }
        });
    }

    function showAlert(message, type = 'success') {
        if (!alertContainer) return;
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> <span>${message}</span>`;
        alertContainer.appendChild(alertDiv);
        setTimeout(() => alertDiv.remove(), 4000);
    }

    // Set current date badge
    const dateBadge = document.querySelector('.date-badge');
    if (dateBadge) {
        const now = new Date();
        dateBadge.innerHTML = `<i class="fas fa-calendar-alt"></i> ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
    }

    // Initialize
    loadRequirementsData();

})();

    // React immediately to registrar requests in other tabs
    window.addEventListener('storage', function(e) {
        if (!e.key || e.key.includes('hes_req_requested') || e.key.includes('hes_notifications')) {
            loadRequirementsData();
        }
    });
