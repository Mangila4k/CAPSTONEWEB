/**
 * Student Enrollment Form - Supabase Integration
 * HES - HES, Hiraya Enrollment System
 */

import { supabase } from '../../supabase/config.js';
import { EmailNotificationService } from '../../js/email_service.js';

// ============================================================
// REQUIREMENTS DATA
// ============================================================
const requirementsData = {
    'Grade 7': {
        'new': [
            { name: '2x2 ID Picture for Official School ID (White Background)', required: true, can_follow: false, field: 'two_by_two_picture' },
            { name: 'Form 137 (Permanent Record)', required: true, can_follow: false, field: 'form_137' },
            { name: 'Report Card', required: true, can_follow: false, field: 'report_card' },
            { name: 'Certificate of Completion (Elementary)', required: true, can_follow: false, field: 'certificate_of_completion' },
            { name: 'PSA Birth Certificate', required: true, can_follow: false, field: 'psa_birth_cert' },
            { name: 'Good Moral Certificate', required: true, can_follow: false, field: 'good_moral_cert' }
        ],
        'transferee': [
            { name: '2x2 ID Picture for Official School ID (White Background)', required: true, can_follow: false, field: 'two_by_two_picture' },
            { name: 'Form 137 (Permanent Record)', required: true, can_follow: false, field: 'form_137' },
            { name: 'Report Card', required: true, can_follow: false, field: 'report_card' },
            { name: 'Certificate of Completion (Elementary)', required: true, can_follow: false, field: 'certificate_of_completion' },
            { name: 'PSA Birth Certificate', required: true, can_follow: false, field: 'psa_birth_cert' },
            { name: 'Good Moral Certificate', required: true, can_follow: false, field: 'good_moral_cert' }
        ]
    },
    'Grade 8': {
        'continuing': [
            { name: '2x2 ID Picture for Official School ID (White Background)', required: true, can_follow: false, field: 'two_by_two_picture' },
            { name: 'Report Card', required: true, can_follow: false, field: 'report_card' }
        ],
        'transferee': [
            { name: '2x2 ID Picture for Official School ID (White Background)', required: true, can_follow: false, field: 'two_by_two_picture' },
            { name: 'Form 137 (Permanent Record)', required: true, can_follow: false, field: 'form_137' },
            { name: 'Report Card', required: true, can_follow: false, field: 'report_card' },
            { name: 'Certificate of Completion', required: true, can_follow: false, field: 'certificate_of_completion' },
            { name: 'PSA Birth Certificate', required: true, can_follow: false, field: 'psa_birth_cert' },
            { name: 'Good Moral Certificate', required: true, can_follow: false, field: 'good_moral_cert' }
        ]
    },
    'Grade 9': {
        'continuing': [
            { name: '2x2 ID Picture for Official School ID (White Background)', required: true, can_follow: false, field: 'two_by_two_picture' },
            { name: 'Report Card', required: true, can_follow: false, field: 'report_card' }
        ],
        'transferee': [
            { name: '2x2 ID Picture for Official School ID (White Background)', required: true, can_follow: false, field: 'two_by_two_picture' },
            { name: 'Form 137 (Permanent Record)', required: true, can_follow: false, field: 'form_137' },
            { name: 'Report Card', required: true, can_follow: false, field: 'report_card' },
            { name: 'Certificate of Completion', required: true, can_follow: false, field: 'certificate_of_completion' },
            { name: 'PSA Birth Certificate', required: true, can_follow: false, field: 'psa_birth_cert' },
            { name: 'Good Moral Certificate', required: true, can_follow: false, field: 'good_moral_cert' }
        ]
    },
    'Grade 10': {
        'continuing': [
            { name: '2x2 ID Picture for Official School ID (White Background)', required: true, can_follow: false, field: 'two_by_two_picture' },
            { name: 'Report Card', required: true, can_follow: false, field: 'report_card' }
        ],
        'transferee': [
            { name: '2x2 ID Picture for Official School ID (White Background)', required: true, can_follow: false, field: 'two_by_two_picture' },
            { name: 'Form 137 (Permanent Record)', required: true, can_follow: false, field: 'form_137' },
            { name: 'Report Card', required: true, can_follow: false, field: 'report_card' },
            { name: 'Certificate of Completion', required: true, can_follow: false, field: 'certificate_of_completion' },
            { name: 'PSA Birth Certificate', required: true, can_follow: false, field: 'psa_birth_cert' },
            { name: 'Good Moral Certificate', required: true, can_follow: false, field: 'good_moral_cert' }
        ]
    },
    'Grade 11': {
        'same_school': [
            { name: '2x2 ID Picture for Official School ID (White Background)', required: true, can_follow: false, field: 'two_by_two_picture' },
            { name: 'Report Card', required: true, can_follow: false, field: 'report_card' }
        ],
        'different_school': [
            { name: '2x2 ID Picture for Official School ID (White Background)', required: true, can_follow: false, field: 'two_by_two_picture' },
            { name: 'Form 137 (Permanent Record)', required: true, can_follow: false, field: 'form_137' },
            { name: 'Report Card', required: true, can_follow: false, field: 'report_card' },
            { name: 'Certificate of Completion (Junior High)', required: true, can_follow: false, field: 'certificate_of_completion' },
            { name: 'PSA Birth Certificate', required: true, can_follow: false, field: 'psa_birth_cert' },
            { name: 'Good Moral Certificate', required: true, can_follow: false, field: 'good_moral_cert' }
        ]
    },
    'Grade 12': {
        'continuing': [
            { name: '2x2 ID Picture for Official School ID (White Background)', required: true, can_follow: false, field: 'two_by_two_picture' },
            { name: 'Report Card', required: true, can_follow: false, field: 'report_card' }
        ],
        'transferee': [
            { name: '2x2 ID Picture for Official School ID (White Background)', required: true, can_follow: false, field: 'two_by_two_picture' },
            { name: 'Form 137 (Permanent Record)', required: true, can_follow: false, field: 'form_137' },
            { name: 'Report Card', required: true, can_follow: false, field: 'report_card' },
            { name: 'Certificate of Completion', required: true, can_follow: false, field: 'certificate_of_completion' },
            { name: 'PSA Birth Certificate', required: true, can_follow: false, field: 'psa_birth_cert' },
            { name: 'Good Moral Certificate', required: true, can_follow: false, field: 'good_moral_cert' }
        ]
    }
};

// ============================================================
// DOM REFS
// ============================================================
const $ = (id) => document.getElementById(id);

const gradeRadios = document.querySelectorAll('input[name="gradeLevel"]');
const studentTypeGroup = $('studentTypeGroup');
const studentTypeSelect = $('student_type');
const strandDiv = $('strandDiv');
const tvlSpecializationDiv = $('tvlSpecializationDiv');
const schoolYearInput = $('school_year');
const requirementsSection = $('requirementsSection');
const requirementsList = $('requirementsList');
const enrollmentForm = $('enrollmentForm');
const alertContainer = $('alertContainer');
const existingEnrollmentDiv = $('existingEnrollment');
const enrollmentDisplay = $('enrollmentDisplay');
const logoutBtn = $('logoutBtn');
const backBtn = $('backBtn');
const submitBtn = $('submitBtn');

let sessionUser = null;
try {
    const stored = localStorage.getItem('currentUser');
    if (stored) {
        sessionUser = JSON.parse(stored);
    }
} catch(e) {}

// Auto-fill student name & email if session exists
if (sessionUser) {
    if ($('firstName') && sessionUser.firstName) $('firstName').value = sessionUser.firstName;
    if ($('lastName') && sessionUser.lastName) $('lastName').value = sessionUser.lastName;
    if ($('email') && sessionUser.email) $('email').value = sessionUser.email;
}

// Auto-populate school year
if (schoolYearInput) {
    const today = new Date();
    const year = today.getFullYear();
    schoolYearInput.value = year + '-' + (year + 1);
}

function getStudentTypeOptions(gradeName) {
    const map = {
        'Grade 7': { 'new': 'New Student (From Elementary)', 'transferee': 'Transferee (From another school)' },
        'Grade 8': { 'continuing': 'Continuing Student', 'transferee': 'Transferee (From another school)' },
        'Grade 9': { 'continuing': 'Continuing Student', 'transferee': 'Transferee (From another school)' },
        'Grade 10': { 'continuing': 'Continuing Student', 'transferee': 'Transferee (From another school)' },
        'Grade 11': {
            'same_school': 'From PLSNHS',
            'different_school': 'From a different school (Transferee)'
        },
        'Grade 12': { 'continuing': 'Continuing Student (From Grade 11)', 'transferee': 'Transferee (From another school)' }
    };
    return map[gradeName] || {};
}

function getSelectedGrade() {
    const checked = document.querySelector('input[name="gradeLevel"]:checked');
    return checked ? checked.value : '';
}

function getSelectedStrand() {
    const checked = document.querySelector('input[name="strand"]:checked');
    if (!checked) return '';
    if (checked.value === 'TVL') {
        const specChecked = document.querySelector('input[name="tvl_specialization"]:checked');
        if (specChecked) {
            return specChecked.value;
        }
        return 'TVL_NEED_SPEC';
    }
    return checked.value;
}

function showAlert(message, type = 'success') {
    if (!alertContainer) return;
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        <span>${message}</span>
    `;
    alertContainer.appendChild(alertDiv);

    setTimeout(() => {
        alertDiv.style.opacity = '0';
        setTimeout(() => alertDiv.remove(), 300);
    }, 5000);
}

function updateStudentTypeOptions() {
    const gradeName = getSelectedGrade();

    if (gradeName) {
        const options = getStudentTypeOptions(gradeName);
        studentTypeSelect.innerHTML = '<option value="">-- Select Student Type --</option>';

        for (const [value, label] of Object.entries(options)) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            studentTypeSelect.appendChild(option);
        }

        studentTypeGroup.style.display = 'block';

        if (gradeName === 'Grade 11' || gradeName === 'Grade 12') {
            strandDiv.style.display = 'block';
            const tvlRadio = document.querySelector('input[name="strand"][value="TVL"]');
            if (tvlRadio && tvlRadio.checked && tvlSpecializationDiv) {
                tvlSpecializationDiv.style.display = 'block';
            }
        } else {
            strandDiv.style.display = 'none';
            document.querySelectorAll('input[name="strand"]').forEach(r => r.checked = false);
            if (tvlSpecializationDiv) {
                tvlSpecializationDiv.style.display = 'none';
                document.querySelectorAll('input[name="tvl_specialization"]').forEach(r => r.checked = false);
            }
        }

        requirementsSection.style.display = 'none';
        requirementsList.innerHTML = '';

    } else {
        studentTypeGroup.style.display = 'none';
        strandDiv.style.display = 'none';
        if (tvlSpecializationDiv) {
            tvlSpecializationDiv.style.display = 'none';
            document.querySelectorAll('input[name="tvl_specialization"]').forEach(r => r.checked = false);
        }
        requirementsSection.style.display = 'none';
    }
}

function updateRequirements() {
    const gradeName = getSelectedGrade();
    const studentType = studentTypeSelect.value;

    if (gradeName && studentType && requirementsData[gradeName] && requirementsData[gradeName][studentType]) {
        requirementsSection.style.display = 'block';
        const requirements = requirementsData[gradeName][studentType];

        requirementsList.innerHTML = '';
        requirements.forEach(req => {
            const reqDiv = document.createElement('div');
            reqDiv.className = 'requirement-item';

            const isPhoto = req.field === 'two_by_two_picture';
            const iconClass = isPhoto ? 'fa-id-badge' : 'fa-file';
            const acceptTypes = isPhoto ? '.jpg,.jpeg,.png' : '.pdf,.jpg,.jpeg,.png';
            const formatHint = isPhoto ? 'JPG or PNG (Formal attire with plain white background). Uploaded photo is used by the Registrar to generate your official school ID card with QR code upon enrollment approval.' : 'PDF, JPG, JPEG, or PNG';

            let badgeHtml = req.required ? 
                '<span class="req-badge badge-required">Required</span>' : 
                '<span class="req-badge badge-optional">Optional</span>';

            reqDiv.innerHTML = `
                <div class="requirement-name">
                    <span><i class="fas ${iconClass}"></i> ${req.name}</span>
                    <div>${badgeHtml}</div>
                </div>
                <div class="file-upload-area" onclick="document.getElementById('${req.field}').click()">
                    <i class="fas ${isPhoto ? 'fa-camera' : 'fa-cloud-upload-alt'}"></i> Click to upload
                    <p style="font-size: 11px; color: #666; margin-top: 5px;">${formatHint}</p>
                </div>
                <input type="file" name="${req.field}" id="${req.field}" accept="${acceptTypes}" style="display: none;" 
                       ${req.required ? 'required' : ''}>
                <div class="file-name" id="${req.field}_name"></div>
            `;
            requirementsList.appendChild(reqDiv);
        });

        document.querySelectorAll('input[type="file"]').forEach(input => {
            input.addEventListener('change', function() {
                const fileNameDiv = document.getElementById(this.id + '_name');
                if (this.files && this.files.length > 0) {
                    fileNameDiv.innerHTML = '<i class="fas fa-check-circle" style="color: #28a745;"></i> ' + this.files[0].name;
                } else {
                    fileNameDiv.innerHTML = '';
                }
            });
        });

    } else {
        requirementsSection.style.display = 'none';
    }
}

gradeRadios.forEach(radio => {
    radio.addEventListener('change', function() {
        updateStudentTypeOptions();
        studentTypeSelect.value = '';
        requirementsSection.style.display = 'none';
    });
});

document.querySelectorAll('input[name="strand"]').forEach(radio => {
    radio.addEventListener('change', function() {
        if (this.value === 'TVL') {
            if (tvlSpecializationDiv) {
                tvlSpecializationDiv.style.display = 'block';
            }
        } else {
            if (tvlSpecializationDiv) {
                tvlSpecializationDiv.style.display = 'none';
                document.querySelectorAll('input[name="tvl_specialization"]').forEach(r => r.checked = false);
            }
        }
    });
});

if (studentTypeSelect) {
    studentTypeSelect.addEventListener('change', updateRequirements);
}

// ============================================================
// LOAD EXISTING ENROLLMENT FROM SUPABASE
// ============================================================
async function loadExistingEnrollment() {
    // Always ensure the enrollment form is visible directly
    if (existingEnrollmentDiv) existingEnrollmentDiv.style.display = 'none';
    if (enrollmentForm) enrollmentForm.style.display = 'block';

    const userEmail = sessionUser?.email || '';
    const userUid = sessionUser?.id || sessionUser?.uid || '';

    // If guest / new student, keep the empty form ready for enrollment
    if (!userEmail && !userUid) {
        return;
    }
}

// ============================================================
// SUBMIT ENROLLMENT TO SUPABASE
// ============================================================
async function submitEnrollment(e) {
    e.preventDefault();

    const gradeName = getSelectedGrade();
    if (!gradeName) {
        showAlert('⚠️ Please select your grade level', 'error');
        return;
    }

    const studentType = studentTypeSelect.value;
    if (!studentType) {
        showAlert('⚠️ Please select your student type', 'error');
        return;
    }

    const schoolYear = schoolYearInput.value.trim();
    if (!schoolYear) {
        showAlert('⚠️ Please enter the school year', 'error');
        return;
    }

    let strand = '';
    if (gradeName === 'Grade 11' || gradeName === 'Grade 12') {
        const selectedStrand = getSelectedStrand();
        if (!selectedStrand) {
            showAlert('⚠️ Please select your strand', 'error');
            return;
        }
        if (selectedStrand === 'TVL_NEED_SPEC') {
            showAlert('⚠️ Please select a TVL Specialization (Cookery or ICT)', 'error');
            return;
        }
        strand = selectedStrand;
    }

    const requirements = requirementsData[gradeName]?.[studentType] || [];
    const missingFiles = [];

    requirements.forEach(req => {
        if (req.required) {
            const fileInput = document.getElementById(req.field);
            if (fileInput && (!fileInput.files || fileInput.files.length === 0)) {
                missingFiles.push(req.name);
            }
        }
    });

    if (missingFiles.length > 0) {
        showAlert(`⚠️ Please upload: ${missingFiles.join(', ')}`, 'error');
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    }

    try {
        const lastName = document.getElementById('lastName')?.value.trim() || sessionUser?.lastName || '';
        const firstName = document.getElementById('firstName')?.value.trim() || sessionUser?.firstName || '';
        const middleName = document.getElementById('middleName')?.value.trim() || '';
        const userEmail = document.getElementById('email')?.value.trim() || sessionUser?.email || '';

        if (!userEmail) {
            showAlert('⚠️ Please enter your email address', 'error');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-paper-plane" style="margin-right:8px;"></i> Submit Enrollment';
            }
            return;
        }

        const dob = document.getElementById('dob')?.value || null;
        const ageVal = parseInt(document.getElementById('age')?.value, 10) || null;
        const birthplace = document.getElementById('birthplace')?.value.trim() || '';
        const gender = document.getElementById('gender')?.value || '';
        const nationality = document.getElementById('nationality')?.value.trim() || 'Filipino';
        const religion = document.getElementById('religion')?.value.trim() || '';
        const address = document.getElementById('address')?.value.trim() || '';

        const motherName = document.getElementById('motherName')?.value.trim() || '';
        const motherOccupation = document.getElementById('motherOccupation')?.value.trim() || '';
        const fatherName = document.getElementById('fatherName')?.value.trim() || '';
        const fatherOccupation = document.getElementById('fatherOccupation')?.value.trim() || '';

        const guardian = document.getElementById('guardian')?.value.trim() || '';
        const guardianRelationship = document.getElementById('guardianRelationship')?.value || 'Parent / Guardian';
        const guardianContact = document.getElementById('guardianContact')?.value.trim() || '';
        const guardianEmail = document.getElementById('guardianEmail')?.value.trim() || '';
        const guardianAddress = document.getElementById('guardianAddress')?.value.trim() || '';

        const enrolledStudentType = document.getElementById('student_type')?.value || studentType || (gradeName.includes('7') ? 'New Student' : 'Continuing');
        const previousSchool = document.getElementById('previousSchool')?.value.trim() || (enrolledStudentType === 'Transferee' ? 'Previous School' : 'Placido L. Señor National High School (PLSNHS)');
        const previousGrade = document.getElementById('previousGrade')?.value.trim() || 'N/A';
        const studentId = sessionUser?.id || sessionUser?.uid || null;

        // 1a. Read 2x2 picture as Data URL for official ID generation
        let twoByTwoDataUrl = null;
        const picInputForDb = document.getElementById('two_by_two_picture');
        if (picInputForDb && picInputForDb.files && picInputForDb.files[0]) {
            try {
                twoByTwoDataUrl = await new Promise((resolve) => {
                    const r = new FileReader();
                    r.onload = (e) => resolve(e.target.result);
                    r.onerror = () => resolve(null);
                    r.readAsDataURL(picInputForDb.files[0]);
                });
            } catch(e) {
                console.warn('Could not encode 2x2 picture:', e);
            }
        }

        // 1. Insert enrollment in Supabase
        const { data: newEnr, error: enrError } = await supabase
            .from('enrollments')
            .insert([{
                student_id: studentId,
                email: userEmail,
                first_name: firstName,
                last_name: lastName,
                middle_name: middleName,
                dob: dob,
                date_of_birth: dob || null,
                age: ageVal,
                birthplace: birthplace,
                gender: gender,
                nationality: nationality,
                religion: religion,
                address: address,
                contact_number: guardianContact,
                mother_name: motherName,
                mother_occupation: motherOccupation,
                father_name: fatherName,
                father_occupation: fatherOccupation,
                guardian_name: guardian,
                guardian_relationship: guardianRelationship,
                guardian_contact: guardianContact,
                guardian_email: guardianEmail,
                guardian_address: guardianAddress,
                student_type: enrolledStudentType,
                grade_level: gradeName,
                strand: strand || null,
                previous_school: previousSchool,
                previous_grade: previousGrade,
                last_school_year: schoolYear,
                status: 'pending',
                two_by_two_picture_url: twoByTwoDataUrl,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }])
            .select();

        if (enrError) throw enrError;

        const createdEnrollmentId = (newEnr && newEnr[0]) ? newEnr[0].id : null;
        const studentFullName = `${firstName} ${lastName}`.trim() || 'Applicant';
        const notifTitle = '📋 New Enrollment Submission';
        const notifMessage = `New enrollment application from ${studentFullName} (${gradeName}${strand ? ' - ' + strand : ''}).`;

        // 1b. Save uploaded 2x2 picture to avatar & documents storage
        const twoByTwoInput = document.getElementById('two_by_two_picture');
        if (twoByTwoInput && twoByTwoInput.files && twoByTwoInput.files[0]) {
            try {
                const picFile = twoByTwoInput.files[0];
                const reader = new FileReader();
                reader.onload = function(evt) {
                    const dataUrl = evt.target.result;
                    if (dataUrl) {
                        localStorage.setItem('hes_student_avatar', dataUrl);
                        let curDocs = [];
                        try {
                            const saved = localStorage.getItem('hes_student_documents');
                            if (saved) curDocs = JSON.parse(saved);
                        } catch(e) {}
                        curDocs = curDocs.filter(d => d.type !== '2x2 ID Picture');
                        curDocs.unshift({
                            id: 'sdoc_2x2_' + Date.now(),
                            title: '2x2 ID Picture for Official School ID (White Background)',
                            type: '2x2 ID Picture',
                            filename: picFile.name,
                            size: Math.round(picFile.size / 1024) + ' KB',
                            date: new Date().toISOString().split('T')[0],
                            format: 'img',
                            status: 'Pending Verification',
                            dataUrl: dataUrl
                        });
                        localStorage.setItem('hes_student_documents', JSON.stringify(curDocs));
                    }
                };
                reader.readAsDataURL(picFile);
            } catch(picErr) {
                console.warn('2x2 picture save notice:', picErr);
            }
        }

        // 1c. Save uploaded Report Card / Form 138 if provided
        const rcInput = document.getElementById('report_card') || document.getElementById('form_138');
        if (rcInput && rcInput.files && rcInput.files[0]) {
            try {
                const rcFile = rcInput.files[0];
                const isTransDoc = rcInput.id === 'report_card';
                const docType = isTransDoc ? 'Report Card' : 'Form 138 / Report Card';
                const docTitle = isTransDoc ? 'Report Card' : 'Form 138 (Report Card)';
                const isPdf = rcFile.name.toLowerCase().endsWith('.pdf');
                let curDocs = [];
                try {
                    const saved = localStorage.getItem('hes_student_documents');
                    if (saved) curDocs = JSON.parse(saved);
                } catch(e) {}
                curDocs = curDocs.filter(d => d.type !== 'Report Card' && d.type !== 'Form 138 / Report Card');
                curDocs.unshift({
                    id: 'sdoc_rc_' + Date.now(),
                    title: docTitle,
                    type: docType,
                    filename: rcFile.name,
                    size: Math.round(rcFile.size / 1024) + ' KB',
                    date: new Date().toISOString().split('T')[0],
                    format: isPdf ? 'pdf' : 'img',
                    status: 'Pending Verification',
                    dataUrl: null
                });
                localStorage.setItem('hes_student_documents', JSON.stringify(curDocs));
            } catch(rcErr) {
                console.warn('Report card save notice:', rcErr);
            }
        }

        // 2. Notify Registrar via notifications table in Supabase
        try {
            await supabase
                .from('notifications')
                .insert([{
                    role: 'registrar',
                    title: notifTitle,
                    message: notifMessage,
                    type: 'new_enrollment',
                    enrollment_id: createdEnrollmentId,
                    is_read: false,
                    read: false,
                    created_at: new Date().toISOString()
                }]);
        } catch(notifErr) {
            console.warn('Notification insert warning:', notifErr);
        }

        // 3. Dispatch storage event for instant cross-tab synchronization
        try {
            localStorage.setItem('hes_latest_notification', JSON.stringify({
                role: 'registrar',
                title: notifTitle,
                message: notifMessage,
                type: 'new_enrollment',
                enrollment_id: createdEnrollmentId,
                timestamp: Date.now()
            }));
        } catch(storageErr) {}

        // 4. Prepare Gmail confirmation data & Show Confirmation Modal
        const trackingRef = `HES-ENR-${(createdEnrollmentId ? createdEnrollmentId.toString().slice(0, 8) : Date.now().toString().slice(-6)).toUpperCase()}`;
        const emailConfirmPayload = {
            studentName: studentFullName,
            firstName,
            lastName,
            email: userEmail,
            gradeLevel: gradeName,
            strand: strand || null,
            studentType: enrolledStudentType,
            schoolYear: schoolYear || '2026-2027',
            trackingId: trackingRef
        };

        const emailData = EmailNotificationService.buildEnrollmentConfirmationEmail(emailConfirmPayload);

        const modal = document.getElementById('enrollmentConfirmationModal');
        const trackingEl = document.getElementById('confirmTrackingId');
        const nameEl = document.getElementById('confirmStudentName');
        const emailEl = document.getElementById('confirmEmail');
        const gradeEl = document.getElementById('confirmGradeStrand');
        const syEl = document.getElementById('confirmSY');

        if (trackingEl) trackingEl.textContent = trackingRef;
        if (nameEl) nameEl.textContent = studentFullName;
        if (emailEl) emailEl.textContent = userEmail;
        if (gradeEl) gradeEl.textContent = `${gradeName}${strand ? ' - ' + strand : ''}`;
        if (syEl) syEl.textContent = schoolYear || '2026-2027';

        if (modal) {
            modal.style.display = 'flex';
        }

        const gmailBtn = document.getElementById('sendEnrollmentGmailBtn');
        const copyReceiptBtn = document.getElementById('copyEnrollmentReceiptBtn');
        const mailtoBtn = document.getElementById('sendMailtoReceiptBtn');
        const doneBtn = document.getElementById('doneEnrollmentBtn');

        if (gmailBtn) {
            gmailBtn.onclick = () => {
                EmailNotificationService.sendViaGmailWeb(emailData);
                showAlert(`📧 Opening Gmail compose for ${userEmail}...`, 'success');
            };
        }

        if (copyReceiptBtn) {
            copyReceiptBtn.onclick = async () => {
                const ok = await EmailNotificationService.copyEmailText(emailData);
                if (ok) showAlert('📋 Enrollment receipt copied to clipboard!', 'success');
            };
        }

        if (mailtoBtn) {
            mailtoBtn.onclick = () => {
                EmailNotificationService.sendViaMailto(emailData);
            };
        }

        if (doneBtn) {
            doneBtn.onclick = () => {
                if (sessionUser) {
                    window.location.href = 'dashboard.html';
                } else {
                    window.location.href = '../auth/login.html';
                }
            };
        }

        showAlert('✅ Enrollment submitted successfully! You can send your confirmation receipt to Gmail.', 'success');

    } catch (error) {
        console.error('❌ Error submitting enrollment:', error);
        showAlert('❌ Error: ' + error.message, 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane" style="margin-right:8px;"></i> Submit Enrollment';
        }
    }
}

if (enrollmentForm) {
    enrollmentForm.addEventListener('submit', submitEnrollment);
}

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

if (backBtn) {
    backBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (sessionUser) {
            window.location.href = 'dashboard.html';
        } else {
            window.location.href = '../auth/homepage.html';
        }
    });
}

// Initialize
loadExistingEnrollment();