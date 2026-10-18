/**
 * Student Enrollment Form - Supabase Integration
 * HES - Hiraya Enrollment System
 *
 * Allows re-enrollment if the student is Passed/Failed or changing school years.
 * Respects the Admin's Enrollment Window (Open/Closed) toggle — now backed by
 * the app_settings table (global + realtime).
 */

import { supabase } from '../../supabase/config.js';

// ============================================================
// REQUIREMENTS DATA
// ============================================================
const requirementsData = {
    'Grade 7': {
        'new': [
            { name: '2x2 ID Picture for Official School ID (White Background)', required: true, field: 'two_by_two_picture' },
            { name: 'Form 137 (Permanent Record)', required: true, field: 'form_137' },
            { name: 'Report Card', required: true, field: 'report_card' },
            { name: 'Certificate of Completion (Elementary)', required: true, field: 'certificate_of_completion' },
            { name: 'PSA Birth Certificate', required: true, field: 'psa_birth_cert' },
            { name: 'Good Moral Certificate', required: true, field: 'good_moral_cert' }
        ],
        'transferee': [
            { name: '2x2 ID Picture for Official School ID (White Background)', required: true, field: 'two_by_two_picture' },
            { name: 'Form 137 (Permanent Record)', required: true, field: 'form_137' },
            { name: 'Report Card', required: true, field: 'report_card' },
            { name: 'Certificate of Completion (Elementary)', required: true, field: 'certificate_of_completion' },
            { name: 'PSA Birth Certificate', required: true, field: 'psa_birth_cert' },
            { name: 'Good Moral Certificate', required: true, field: 'good_moral_cert' }
        ],
        'continuing': [
            { name: '2x2 ID Picture for Official School ID (White Background)', required: true, field: 'two_by_two_picture' },
            { name: 'Report Card', required: true, field: 'report_card' }
        ],
        'repeater': [
            { name: 'Report Card', required: true, field: 'report_card' }
        ]
    },
    'Grade 8': {
        'continuing': [
            { name: '2x2 ID Picture for Official School ID (White Background)', required: true, field: 'two_by_two_picture' },
            { name: 'Report Card', required: true, field: 'report_card' }
        ],
        'transferee': [
            { name: '2x2 ID Picture for Official School ID (White Background)', required: true, field: 'two_by_two_picture' },
            { name: 'Form 137 (Permanent Record)', required: true, field: 'form_137' },
            { name: 'Report Card', required: true, field: 'report_card' },
            { name: 'Certificate of Completion', required: true, field: 'certificate_of_completion' },
            { name: 'PSA Birth Certificate', required: true, field: 'psa_birth_cert' },
            { name: 'Good Moral Certificate', required: true, field: 'good_moral_cert' }
        ],
        'repeater': [
            { name: 'Report Card', required: true, field: 'report_card' }
        ]
    },
    'Grade 9': {
        'continuing': [
            { name: '2x2 ID Picture for Official School ID (White Background)', required: true, field: 'two_by_two_picture' },
            { name: 'Report Card', required: true, field: 'report_card' }
        ],
        'transferee': [
            { name: '2x2 ID Picture for Official School ID (White Background)', required: true, field: 'two_by_two_picture' },
            { name: 'Form 137 (Permanent Record)', required: true, field: 'form_137' },
            { name: 'Report Card', required: true, field: 'report_card' },
            { name: 'Certificate of Completion', required: true, field: 'certificate_of_completion' },
            { name: 'PSA Birth Certificate', required: true, field: 'psa_birth_cert' },
            { name: 'Good Moral Certificate', required: true, field: 'good_moral_cert' }
        ],
        'repeater': [
            { name: 'Report Card', required: true, field: 'report_card' }
        ]
    },
    'Grade 10': {
        'continuing': [
            { name: '2x2 ID Picture for Official School ID (White Background)', required: true, field: 'two_by_two_picture' },
            { name: 'Report Card', required: true, field: 'report_card' }
        ],
        'transferee': [
            { name: '2x2 ID Picture for Official School ID (White Background)', required: true, field: 'two_by_two_picture' },
            { name: 'Form 137 (Permanent Record)', required: true, field: 'form_137' },
            { name: 'Report Card', required: true, field: 'report_card' },
            { name: 'Certificate of Completion', required: true, field: 'certificate_of_completion' },
            { name: 'PSA Birth Certificate', required: true, field: 'psa_birth_cert' },
            { name: 'Good Moral Certificate', required: true, field: 'good_moral_cert' }
        ],
        'repeater': [
            { name: 'Report Card', required: true, field: 'report_card' }
        ]
    },
    'Grade 11': {
        'same_school': [
            { name: '2x2 ID Picture for Official School ID (White Background)', required: true, field: 'two_by_two_picture' },
            { name: 'Report Card', required: true, field: 'report_card' }
        ],
        'continuing': [
            { name: '2x2 ID Picture for Official School ID (White Background)', required: true, field: 'two_by_two_picture' },
            { name: 'Report Card', required: true, field: 'report_card' }
        ],
        'different_school': [
            { name: '2x2 ID Picture for Official School ID (White Background)', required: true, field: 'two_by_two_picture' },
            { name: 'Form 137 (Permanent Record)', required: true, field: 'form_137' },
            { name: 'Report Card', required: true, field: 'report_card' },
            { name: 'Certificate of Completion (Junior High)', required: true, field: 'certificate_of_completion' },
            { name: 'PSA Birth Certificate', required: true, field: 'psa_birth_cert' },
            { name: 'Good Moral Certificate', required: true, field: 'good_moral_cert' }
        ],
        'transferee': [
            { name: '2x2 ID Picture for Official School ID (White Background)', required: true, field: 'two_by_two_picture' },
            { name: 'Form 137 (Permanent Record)', required: true, field: 'form_137' },
            { name: 'Report Card', required: true, field: 'report_card' },
            { name: 'Certificate of Completion (Junior High)', required: true, field: 'certificate_of_completion' },
            { name: 'PSA Birth Certificate', required: true, field: 'psa_birth_cert' },
            { name: 'Good Moral Certificate', required: true, field: 'good_moral_cert' }
        ],
        'repeater': [
            { name: 'Report Card', required: true, field: 'report_card' }
        ]
    },
    'Grade 12': {
        'continuing': [
            { name: '2x2 ID Picture for Official School ID (White Background)', required: true, field: 'two_by_two_picture' },
            { name: 'Report Card', required: true, field: 'report_card' }
        ],
        'transferee': [
            { name: '2x2 ID Picture for Official School ID (White Background)', required: true, field: 'two_by_two_picture' },
            { name: 'Form 137 (Permanent Record)', required: true, field: 'form_137' },
            { name: 'Report Card', required: true, field: 'report_card' },
            { name: 'Certificate of Completion', required: true, field: 'certificate_of_completion' },
            { name: 'PSA Birth Certificate', required: true, field: 'psa_birth_cert' },
            { name: 'Good Moral Certificate', required: true, field: 'good_moral_cert' }
        ],
        'repeater': [
            { name: 'Report Card', required: true, field: 'report_card' }
        ]
    }
};

// ============================================================
// DOM REFS
// ============================================================
const $ = (id) => document.getElementById(id);

const gradeRadios = document.querySelectorAll('input[name="gradeLevel"]');
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

// ============================================================
// ENROLLMENT WINDOW CHECK — SUPABASE-BACKED (app_settings)
// ============================================================
const ENROLLMENT_KEY = 'enrollment_open';
let enrollmentIsOpen = true;

async function checkEnrollmentWindow() {
    try {
        const { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', ENROLLMENT_KEY)
            .maybeSingle();
        if (error) throw error;
        return data ? data.value === 'true' : true;  // fail-open
    } catch (e) {
        console.warn('Could not read enrollment window, assuming OPEN:', e);
        return true;
    }
}

function applyEnrollmentWindow(isOpen) {
    enrollmentIsOpen = isOpen;

    const closedMessageHTML = `
        <div style="background: white; border-radius: 12px; padding: 30px 22px; border: 1px solid #e2e8f0; margin-top: 10px; text-align: center;">
            <div style="font-size: 40px; color: #dc2626; margin-bottom: 12px;"><i class="fas fa-lock"></i></div>
            <h3 style="color: #0f172a; margin-bottom: 8px; font-size: 18px;">Enrollment is now closed</h3>
            <p style="color: #64748b; font-size: 14px; max-width: 400px; margin: 0 auto;">You can enroll now through walk-in at the school registrar's office.</p>
        </div>
    `;

    if (!isOpen) {
        if (existingEnrollmentDiv) existingEnrollmentDiv.style.display = 'block';
        if (enrollmentForm) enrollmentForm.style.display = 'none';
        if (enrollmentDisplay) enrollmentDisplay.innerHTML = closedMessageHTML;
    } else {
        if (enrollmentDisplay) enrollmentDisplay.innerHTML = '';
        if (existingEnrollmentDiv) existingEnrollmentDiv.style.display = 'none';
        if (enrollmentForm) enrollmentForm.style.display = 'block';
        // Re-check for existing enrollment now that the form is visible
        loadExistingEnrollment();
    }
}

// Inject the Student Type selection UI above the Grade Level
const gradeSection = document.querySelector('input[name="gradeLevel"]').closest('.form-group');
const typeSelectorHTML = `
    <div class="form-group" id="studentTypeSelectionGroup" style="margin-bottom: 24px;">
        <label style="font-size: 15px; font-weight: 700; color: #1a225a; margin-bottom: 12px; display: block;">
            Select Student Type <span>*</span>
        </label>
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
            <button type="button" class="btn-type-select" data-type="new" style="flex: 1; padding: 15px; border: 2px solid #e2e8f0; border-radius: 10px; background: #fff; cursor: pointer; text-align: center; transition: all 0.2s; min-width: 100px;">
                <i class="fas fa-user-plus" style="font-size: 24px; color: #0b2b4a; margin-bottom: 8px; display: block;"></i>
                <strong style="color: #0b2b4a;">New Student</strong>
            </button>
            <button type="button" class="btn-type-select" data-type="old" style="flex: 1; padding: 15px; border: 2px solid #e2e8f0; border-radius: 10px; background: #fff; cursor: pointer; text-align: center; transition: all 0.2s; min-width: 100px;">
                <i class="fas fa-user-graduate" style="font-size: 24px; color: #0b2b4a; margin-bottom: 8px; display: block;"></i>
                <strong style="color: #0b2b4a;">Old Student</strong>
            </button>
            <button type="button" class="btn-type-select" data-type="repeater" style="flex: 1; padding: 15px; border: 2px solid #e2e8f0; border-radius: 10px; background: #fff; cursor: pointer; text-align: center; transition: all 0.2s; min-width: 100px;">
                <i class="fas fa-rotate-left" style="font-size: 24px; color: #0b2b4a; margin-bottom: 8px; display: block;"></i>
                <strong style="color: #0b2b4a;">Repeater</strong>
            </button>
            <button type="button" class="btn-type-select" data-type="transferee" style="flex: 1; padding: 15px; border: 2px solid #e2e8f0; border-radius: 10px; background: #fff; cursor: pointer; text-align: center; transition: all 0.2s; min-width: 100px;">
                <i class="fas fa-school" style="font-size: 24px; color: #0b2b4a; margin-bottom: 8px; display: block;"></i>
                <strong style="color: #0b2b4a;">Transferee</strong>
            </button>
        </div>
        <input type="hidden" id="global_student_type" value="">
        <input type="hidden" id="is_repeater_flag" value="false">
    </div>
`;

if (gradeSection) {
    gradeSection.insertAdjacentHTML('beforebegin', typeSelectorHTML);
}

const globalTypeInput = $('global_student_type');
const repeaterFlagInput = $('is_repeater_flag');
const typeButtons = document.querySelectorAll('.btn-type-select');

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

// ============================================================
// UI HELPER FUNCTIONS
// ============================================================

function getSelectedGrade() {
    const checked = document.querySelector('input[name="gradeLevel"]:checked');
    return checked ? checked.value : '';
}

function getSelectedStrand() {
    const checked = document.querySelector('input[name="strand"]:checked');
    if (!checked) return '';
    if (checked.value === 'TVL') {
        const specChecked = document.querySelector('input[name="tvl_specialization"]:checked');
        if (specChecked) return specChecked.value;
        return 'TVL_NEED_SPEC';
    }
    return checked.value;
}

function showAlert(message, type = 'success') {
    if (!alertContainer) return;
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> <span>${message}</span>`;
    alertContainer.appendChild(alertDiv);
    setTimeout(() => {
        alertDiv.style.opacity = '0';
        setTimeout(() => alertDiv.remove(), 300);
    }, 5000);
}

function highlightTypeButton(type) {
    typeButtons.forEach(b => {
        b.style.borderColor = '#e2e8f0';
        b.style.background = '#fff';
        b.style.boxShadow = 'none';
    });
    const btn = document.querySelector(`.btn-type-select[data-type="${type}"]`);
    if (btn) {
        btn.style.borderColor = '#0b2b4a';
        btn.style.background = '#eff6ff';
        btn.style.boxShadow = '0 0 0 3px rgba(11,43,74,0.1)';
    }
}

// ============================================================
// HANDLE TYPE SELECTION (Manual)
// ============================================================
typeButtons.forEach(btn => {
    btn.addEventListener('click', async function() {
        const type = this.dataset.type;
        highlightTypeButton(type);

        if (type === 'old') {
            const email = $('email')?.value.trim();
            if (!email) {
                showAlert('⚠️ Please enter your Email Address first to verify your Old Student status.', 'error');
                highlightTypeButton(null);
                globalTypeInput.value = '';
                return;
            }

            const { data, error } = await supabase.from('enrollments').select('id').ilike('email', email).limit(1);
            if (error || !data || data.length === 0) {
                showAlert(`⚠️ No past record found for ${email}. Please select "New Student" or "Transferee".`, 'error');
                highlightTypeButton(null);
                globalTypeInput.value = '';
                return;
            }
            
            globalTypeInput.value = 'continuing';
            repeaterFlagInput.value = 'false';
            showAlert('✅ Old Student verified!', 'success');
        } else if (type === 'repeater') {
            globalTypeInput.value = 'repeater';
            repeaterFlagInput.value = 'true';
            showAlert('✅ Repeater selected. Only Report Card required.', 'success');
        } else {
            globalTypeInput.value = type;
            repeaterFlagInput.value = 'false';
        }

        updateRequirements();
    });
});

// ============================================================
// AUTO-DETECT ON EMAIL OR NAME BLUR
// ============================================================
async function autoIdentifyStudent() {
    const email = $('email')?.value.trim();
    const fName = $('firstName')?.value.trim();
    const lName = $('lastName')?.value.trim();

    if (!email && !fName) return;

    // 1. Check if the student is in the students table (to check their academic_status)
    let studentQuery = supabase.from('students').select('id, academic_status');
    
    if (email) {
        studentQuery = studentQuery.ilike('email', email);
    } else if (fName && lName) {
        studentQuery = studentQuery.ilike('first_name', fName).ilike('last_name', lName);
    } else if (fName) {
        studentQuery = studentQuery.ilike('first_name', fName);
    }

    const { data: studentData } = await studentQuery.limit(1);

    if (studentData && studentData.length > 0) {
        const st = studentData[0];
        
        // Check if Admin marked them as Failed
        if (st.academic_status === 'Failed') {
            highlightTypeButton('repeater');
            globalTypeInput.value = 'repeater';
            repeaterFlagInput.value = 'true';
            showAlert(`⚠️ Student is marked as "Failed". Auto-selected "Repeater".`, 'error');
            updateRequirements();
            return;
        }
    }

    // 2. If not failed, check if they have past enrollment records to mark as Old Student
    let enrollQuery = supabase.from('enrollments').select('id');
    if (email) {
        enrollQuery = enrollQuery.ilike('email', email);
    } else if (fName && lName) {
        enrollQuery = enrollQuery.ilike('first_name', fName).ilike('last_name', lName);
    } else if (fName) {
        enrollQuery = enrollQuery.ilike('first_name', fName);
    }

    const { data: enrollData } = await enrollQuery.limit(1);

    if (enrollData && enrollData.length > 0) {
        highlightTypeButton('old');
        globalTypeInput.value = 'continuing';
        repeaterFlagInput.value = 'false';
        showAlert(`✅ Welcome back! Record found. Auto-selected "Old Student".`, 'success');
        updateRequirements();
    }
}

// Attach auto-identify listeners
['email', 'firstName', 'lastName'].forEach(id => {
    const el = $(id);
    if (el) {
        el.addEventListener('blur', autoIdentifyStudent);
    }
});

// ============================================================
// UPDATE REQUIREMENTS
// ============================================================
function updateRequirements() {
    const gradeName = getSelectedGrade();
    const studentType = globalTypeInput.value;

    if (gradeName && studentType) {
        const typeKey = (studentType === 'old') ? 'continuing' : studentType;

        if (requirementsData[gradeName] && requirementsData[gradeName][typeKey]) {
            requirementsSection.style.display = 'block';
            const requirements = requirementsData[gradeName][typeKey];

            requirementsList.innerHTML = '';
            requirements.forEach(req => {
                const reqDiv = document.createElement('div');
                reqDiv.className = 'requirement-item';

                const isPhoto = req.field === 'two_by_two_picture';
                const iconClass = isPhoto ? 'fa-id-badge' : 'fa-file';
                const acceptTypes = isPhoto ? '.jpg,.jpeg,.png' : '.pdf,.jpg,.jpeg,.png';
                const formatHint = isPhoto ? 'JPG or PNG (Formal attire with plain white background).' : 'PDF, JPG, JPEG, or PNG';

                reqDiv.innerHTML = `
                    <div class="requirement-name">
                        <span><i class="fas ${iconClass}"></i> ${req.name}</span>
                        <div><span class="req-badge badge-required">Required</span></div>
                    </div>
                    <div class="file-upload-area" onclick="document.getElementById('${req.field}').click()">
                        <i class="fas ${isPhoto ? 'fa-camera' : 'fa-cloud-upload-alt'}"></i> Click to upload
                        <p style="font-size: 11px; color: #666; margin-top: 5px;">${formatHint}</p>
                    </div>
                    <input type="file" name="${req.field}" id="${req.field}" accept="${acceptTypes}" style="display: none;" required>
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
    } else {
        requirementsSection.style.display = 'none';
    }
}

// Grade and Strand Listeners
gradeRadios.forEach(radio => {
    radio.addEventListener('change', function() {
        const gradeName = getSelectedGrade();
        
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
        
        updateRequirements();
    });
});

document.querySelectorAll('input[name="strand"]').forEach(radio => {
    radio.addEventListener('change', function() {
        if (this.value === 'TVL') {
            if (tvlSpecializationDiv) tvlSpecializationDiv.style.display = 'block';
        } else {
            if (tvlSpecializationDiv) {
                tvlSpecializationDiv.style.display = 'none';
                document.querySelectorAll('input[name="tvl_specialization"]').forEach(r => r.checked = false);
            }
        }
    });
});

// ============================================================
// LOAD EXISTING ENROLLMENT (If any)
// ============================================================
function renderExistingEnrollmentCard(enr) {
    if (!existingEnrollmentDiv || !enrollmentDisplay) return;

    const rawStatus = (enr.status || 'pending').toLowerCase();
    const isEnrolled = rawStatus === 'enrolled' || rawStatus === 'approved';
    const statusText = isEnrolled ? 'OFFICIALLY ENROLLED' : (rawStatus === 'rejected' ? 'REJECTED' : 'PENDING REVIEW');
    const badgeClass = isEnrolled ? 'status-approved' : (rawStatus === 'rejected' ? 'status-rejected' : 'status-pending');
    
    enrollmentDisplay.innerHTML = `
        <div style="background: white; border-radius: 12px; padding: 22px; border: 1px solid #e2e8f0; margin-top: 10px;">
            <span class="enrollment-badge ${badgeClass}" style="font-size: 13px; font-weight: 700; padding: 6px 16px; border-radius: 20px;">
                <i class="fas ${isEnrolled ? 'fa-check-circle' : 'fa-hourglass-half'}"></i> ${statusText}
            </span>
            <p style="margin-top: 10px; font-size: 14px;">You already have an application for <strong>${enr.grade_level}</strong> (SY ${enr.school_year}).</p>
            ${isEnrolled ? `<a href="dashboard.html" class="btn btn-submit" style="margin-top: 15px; display: inline-block; text-decoration: none; padding: 10px 20px; background: #0b2b4a; color: #fff; border-radius: 8px;">Go to Dashboard</a>` : ''}
        </div>
    `;

    if (existingEnrollmentDiv) existingEnrollmentDiv.style.display = 'block';
    if (enrollmentForm) enrollmentForm.style.display = 'none';
}

async function loadExistingEnrollment() {
    // 1. FIRST — always check the enrollment window from Supabase
    const isOpen = await checkEnrollmentWindow();
    enrollmentIsOpen = isOpen;

    if (!isOpen) {
        applyEnrollmentWindow(false);
        return; // Stop — enrollment is closed
    }

    // 2. Enrollment is open — check for existing applications
    const userEmail = $('email')?.value.trim() || sessionUser?.email;
    if (!userEmail) {
        // No email yet — just show the form
        if (existingEnrollmentDiv) existingEnrollmentDiv.style.display = 'none';
        if (enrollmentForm) enrollmentForm.style.display = 'block';
        return;
    }

    const { data } = await supabase
        .from('enrollments')
        .select('*')
        .ilike('email', userEmail)
        .order('created_at', { ascending: false });

    if (data && data.length > 0) {
        const currentSY = schoolYearInput?.value.trim() || '';
        
        // Only block if they have a pending/enrolled/approved record for the *current* school year.
        const blockRecord = data.find(r => 
            (r.school_year === currentSY || r.last_school_year === currentSY) && 
            ['enrolled', 'approved', 'pending'].includes((r.status || '').toLowerCase())
        );

        if (blockRecord) {
            renderExistingEnrollmentCard(blockRecord);
        } else {
            // If they don't have a block record for this year, show the form!
            if (existingEnrollmentDiv) existingEnrollmentDiv.style.display = 'none';
            if (enrollmentForm) enrollmentForm.style.display = 'block';
        }
    } else {
        // No records at all — show the form
        if (existingEnrollmentDiv) existingEnrollmentDiv.style.display = 'none';
        if (enrollmentForm) enrollmentForm.style.display = 'block';
    }
}

// ============================================================
// SUBMIT
// ============================================================
async function submitEnrollment(e) {
    e.preventDefault();

    // Final safety check: block submission if closed (Supabase-backed)
    const isOpen = await checkEnrollmentWindow();
    if (!isOpen) {
        applyEnrollmentWindow(false);
        showAlert('❌ Enrollment is currently closed. Please enroll through walk-in.', 'error');
        return;
    }

    const gradeName = getSelectedGrade();
    const studentType = globalTypeInput.value;
    const isRepeater = repeaterFlagInput.value === 'true';
    const schoolYear = schoolYearInput.value.trim();

    if (!studentType) { showAlert('⚠️ Please select a Student Type (New, Old, Repeater, or Transferee).', 'error'); return; }
    if (!gradeName) { showAlert('⚠️ Please select your grade level.', 'error'); return; }
    if (!schoolYear) { showAlert('⚠️ Please enter the school year.', 'error'); return; }

    let strand = '';
    if (['Grade 11', 'Grade 12'].includes(gradeName)) {
        strand = getSelectedStrand();
        if (!strand) { showAlert('⚠️ Please select your strand.', 'error'); return; }
        if (strand === 'TVL_NEED_SPEC') { showAlert('⚠️ Please select a TVL Specialization.', 'error'); return; }
    }

    const typeKey = (studentType === 'old') ? 'continuing' : studentType;
    const requirements = requirementsData[gradeName]?.[typeKey] || [];
    
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
        const userEmail = $('email')?.value.trim();
        const firstName = $('firstName')?.value.trim();
        const lastName = $('lastName')?.value.trim();

        // --- RE-ENROLLMENT LOGIC ---
        // Check if they have an existing record that is PENDING or ENROLLED for the SAME school year.
        // If it's a DIFFERENT school year, we allow them to submit.
        const { data: existingCheck } = await supabase
            .from('enrollments')
            .select('*')
            .ilike('email', userEmail)
            .eq('school_year', schoolYear)
            .order('created_at', { ascending: false })
            .limit(1);

        if (existingCheck && existingCheck.length > 0) {
            const cur = existingCheck[0];
            const curStatus = (cur.status || '').toLowerCase();
            // Block only if it's the EXACT same school year and not rejected
            if (curStatus === 'enrolled' || curStatus === 'approved' || curStatus === 'pending') {
                showAlert(`⚠️ You already have an application for ${schoolYear} (Status: ${curStatus.toUpperCase()}).`, 'error');
                renderExistingEnrollmentCard(cur);
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = 'Submit Enrollment';
                }
                return;
            }
        }

        // 1. Resolve student_id
        let resolvedStudentId = null;
        const { data: stByEmail } = await supabase.from('students').select('id').ilike('email', userEmail).limit(1);
        if (stByEmail && stByEmail.length > 0) resolvedStudentId = stByEmail[0].id;

        // 2. Upload Files
        showAlert('📤 Uploading your documents...', 'info');
        const BUCKET = 'student_documents';
        const FOLDER = 'student_requirements';
        const safeEmail = userEmail.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const tsBase = Date.now();

        const uploadFile = async (inputId, labelKey) => {
            const input = document.getElementById(inputId);
            if (!input || !input.files || !input.files[0]) return null;
            const file = input.files[0];
            const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
            const path = `${FOLDER}/${safeEmail}_${labelKey}_${tsBase}.${ext}`;
            const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
            if (error) return null;
            const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
            return data?.publicUrl || null;
        };

        const [
            twoByTwoUrl, form137Url, reportCardUrl, 
            certCompletionUrl, psaBirthCertUrl, goodMoralCertUrl
        ] = await Promise.all([
            uploadFile('two_by_two_picture', 'two_by_two_picture'),
            uploadFile('form_137', 'form_137'),
            uploadFile('report_card', 'report_card'),
            uploadFile('certificate_of_completion', 'certificate_of_completion'),
            uploadFile('psa_birth_cert', 'psa_birth_cert'),
            uploadFile('good_moral_cert', 'good_moral_cert')
        ]);

        // 3. Insert to DB
        const finalStudentType = isRepeater ? 'repeater' : ((studentType === 'old') ? 'continuing' : studentType);

        const { error: enrError } = await supabase.from('enrollments').insert([{
            student_id: resolvedStudentId,
            email: userEmail,
            first_name: firstName,
            last_name: lastName,
            student_type: finalStudentType,
            grade_level: gradeName,
            strand: strand || null,
            school_year: schoolYear,
            last_school_year: schoolYear,
            status: 'pending',
            two_by_two_picture_url: twoByTwoUrl,
            form_137_url: form137Url,
            report_card_url: reportCardUrl,
            certificate_of_completion_url: certCompletionUrl,
            psa_birth_cert_url: psaBirthCertUrl,
            good_moral_cert_url: goodMoralCertUrl,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }]);

        if (enrError) throw enrError;

        showAlert('✅ Enrollment submitted successfully!', 'success');
        setTimeout(() => window.location.href = '../auth/login.html', 1500);

    } catch (error) {
        console.error('❌ Error:', error);
        showAlert('❌ Error submitting enrollment: ' + error.message, 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Submit Enrollment';
        }
    }
}

if (enrollmentForm) enrollmentForm.addEventListener('submit', submitEnrollment);

if (logoutBtn) {
    logoutBtn.addEventListener('click', async function(e) {
        e.preventDefault();
        localStorage.removeItem('currentUser');
        try { await supabase.auth.signOut(); } catch(err) {}
        window.location.replace('../auth/login.html');
    });
}

// Trigger existing enrollment check on email blur
const emailInputField = document.getElementById('email');
if (emailInputField) {
    emailInputField.addEventListener('blur', loadExistingEnrollment);
}

// ============================================================
// REALTIME — react live when admin toggles the window
// ============================================================
supabase.channel('enrollment-window-student')
    .on('postgres_changes',
        { event: '*', schema: 'public', table: 'app_settings', filter: `key=eq.${ENROLLMENT_KEY}` },
        (payload) => {
            const isOpen = payload.new?.value === 'true';
            enrollmentIsOpen = isOpen;
            if (!isOpen) {
                applyEnrollmentWindow(false);
                showAlert('⚠️ Enrollment has just been closed. Please enroll through walk-in.', 'error');
            } else {
                applyEnrollmentWindow(true);
                showAlert('✅ Enrollment has been re-opened. You may continue.', 'success');
            }
        })
    .subscribe();

// Initialize — check the window BEFORE loading existing enrollment
(async () => {
    const isOpen = await checkEnrollmentWindow();
    enrollmentIsOpen = isOpen;

    if (!isOpen) {
        applyEnrollmentWindow(false);
    } else {
        loadExistingEnrollment();
    }
})();