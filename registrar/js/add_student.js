/**
 * HES Registrar - Add / Enroll Student Logic (New Student & Transferee)
 * Placido L. Señor National High School
 */

import { supabase } from '../../supabase/config.js';
import { EmailNotificationService } from '../../js/email_service.js';

(function() {
    'use strict';

    console.log('📋 Registrar Add/Enroll Student module loaded');

    // ============================================
    // SESSION VERIFICATION
    // ============================================

    let currentUser = null;
    try {
        const stored = localStorage.getItem('currentUser');
        if (stored) currentUser = JSON.parse(stored);
    } catch (e) {
        console.warn('Session parse error:', e);
    }

    if (!currentUser) {
        currentUser = {
            role: 'registrar',
            email: 'registrar@hiraya.edu.ph',
            displayName: 'Registrar Officer',
            firstName: 'Registrar'
        };
    }

    // Set Registrar header display
    const adminInitial = document.getElementById('adminInitial');
    const adminName = document.getElementById('adminName');
    const regName = currentUser.firstName ? `${currentUser.firstName} ${currentUser.lastName || ''}`.trim() : (currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'Registrar'));
    if (adminInitial) adminInitial.textContent = regName.charAt(0).toUpperCase();
    if (adminName) adminName.textContent = regName;

    // Mobile sidebar toggle
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('active');
        });
    }

    // ============================================
    // DOM REFERENCES
    // ============================================

    const alertContainer = document.getElementById('alertContainer');
    const enrollForm = document.getElementById('enrollStudentForm');
    const submitBtn = document.getElementById('submitEnrollBtn');

    // Type Selector
    const typeNew = document.getElementById('typeNew');
    const typeTransferee = document.getElementById('typeTransferee');
    const cardTypeNew = document.getElementById('cardTypeNew');
    const cardTypeTransferee = document.getElementById('cardTypeTransferee');
    const transfereeSection = document.getElementById('transfereeSection');

    // Transferee inputs
    const prevSchool = document.getElementById('prevSchool');
    const prevSchoolAddress = document.getElementById('prevSchoolAddress');
    const prevGrade = document.getElementById('prevGrade');
    const lastSchoolYear = document.getElementById('lastSchoolYear');
    const generalAverage = document.getElementById('generalAverage');
    const sf10Status = document.getElementById('sf10Status');
    const transferReason = document.getElementById('transferReason');

    // Academic inputs
    const gradeLevel = document.getElementById('gradeLevel');
    const strandGroup = document.getElementById('strandGroup');
    const strand = document.getElementById('strand');
    const sectionSelect = document.getElementById('sectionSelect');
    const schoolYear = document.getElementById('schoolYear');
    const enrollmentStatus = document.getElementById('enrollmentStatus');

    // Student Info inputs
    const lrn = document.getElementById('lrn');
    const btnGenLrn = document.getElementById('btnGenLrn');
    const autoGenLrnBtn = document.getElementById('autoGenLrnBtn');
    const studentEmail = document.getElementById('studentEmail');
    const autoGenEmailBtn = document.getElementById('autoGenEmailBtn');
    const firstName = document.getElementById('firstName');
    const middleName = document.getElementById('middleName');
    const lastName = document.getElementById('lastName');
    const suffix = document.getElementById('suffix');
    const dob = document.getElementById('dob');
    const age = document.getElementById('age');
    const gender = document.getElementById('gender');
    const birthplace = document.getElementById('birthplace');
    const nationality = document.getElementById('nationality');
    const religion = document.getElementById('religion');
    const contactNumber = document.getElementById('contactNumber');
    const address = document.getElementById('address');

    // Parent & Guardian inputs
    const fatherName = document.getElementById('fatherName');
    const fatherOccupation = document.getElementById('fatherOccupation');
    const motherName = document.getElementById('motherName');
    const motherOccupation = document.getElementById('motherOccupation');
    const guardianName = document.getElementById('guardianName');
    const guardianRelationship = document.getElementById('guardianRelationship');
    const guardianContact = document.getElementById('guardianContact');
    const guardianEmail = document.getElementById('guardianEmail');
    const guardianAddress = document.getElementById('guardianAddress');

    // Photo Upload
    const photoDropZone = document.getElementById('photoDropZone');
    const twoByTwoPhotoInput = document.getElementById('twoByTwoPhotoInput');
    const photoPreviewImg = document.getElementById('photoPreviewImg');
    const photoPlaceholder = document.getElementById('photoPlaceholder');
    const photoStatusText = document.getElementById('photoStatusText');

    // Preview Elements
    const summaryAvatar = document.getElementById('summaryAvatar');
    const summaryName = document.getElementById('summaryName');
    const summaryTypePill = document.getElementById('summaryTypePill');
    const summaryLrn = document.getElementById('summaryLrn');
    const summaryGrade = document.getElementById('summaryGrade');
    const summaryStrandRow = document.getElementById('summaryStrandRow');
    const summaryStrand = document.getElementById('summaryStrand');
    const summarySection = document.getElementById('summarySection');
    const summarySY = document.getElementById('summarySY');
    const summaryPrevSchoolRow = document.getElementById('summaryPrevSchoolRow');
    const summaryPrevSchool = document.getElementById('summaryPrevSchool');
    const summaryStatus = document.getElementById('summaryStatus');
    const summaryCredEmail = document.getElementById('summaryCredEmail');
    const summaryCredPass = document.getElementById('summaryCredPass');
    const previewGmailDestEmail = document.getElementById('previewGmailDestEmail');
    const sendCredsGmailPreviewBtn = document.getElementById('sendCredsGmailPreviewBtn');
    const copyCredsPreviewBtn = document.getElementById('copyCredsPreviewBtn');
    const sendMailtoPreviewBtn = document.getElementById('sendMailtoPreviewBtn');

    // Right-side Already Enrolled Student Lookup
    const lookupToggleHeader = document.getElementById('lookupToggleHeader');
    const lookupChevron = document.getElementById('lookupChevron');
    const lookupContent = document.getElementById('lookupContent');
    const existingStudentSelect = document.getElementById('existingStudentSelect');
    const enrolledStudentDetailBox = document.getElementById('enrolledStudentDetailBox');
    const lookupStudentName = document.getElementById('lookupStudentName');
    const lookupStudentLrn = document.getElementById('lookupStudentLrn');
    const lookupStudentEmail = document.getElementById('lookupStudentEmail');
    const lookupStudentPass = document.getElementById('lookupStudentPass');
    const sendEnrolledGmailBtn = document.getElementById('sendEnrolledGmailBtn');

    // Success Modal
    const successModal = document.getElementById('successModal');
    const modalStudentName = document.getElementById('modalStudentName');
    const modalStudentType = document.getElementById('modalStudentType');
    const modalStudentLrn = document.getElementById('modalStudentLrn');
    const modalStudentEmail = document.getElementById('modalStudentEmail');
    const modalStudentPass = document.getElementById('modalStudentPass');
    const modalGmailUsername = document.getElementById('modalGmailUsername');
    const modalGmailPassword = document.getElementById('modalGmailPassword');
    const sendCredsGmailModalBtn = document.getElementById('sendCredsGmailModalBtn');
    const sendCredsMailtoModalBtn = document.getElementById('sendCredsMailtoModalBtn');
    const copyCredsBtn = document.getElementById('copyCredsBtn');
    const printReceiptBtn = document.getElementById('printReceiptBtn');
    const btnEnrollAnother = document.getElementById('btnEnrollAnother');

    // State
    let allSections = [];
    let enrolledStudentsList = [];
    let selectedLookupStudent = null;
    let lastEnrolledData = null;
    let uploadedPhotoDataUrl = null;

    // ============================================
    // ALERT SYSTEM
    // ============================================

    function showAlert(message, type = 'error') {
        if (!alertContainer) return;
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.style.cssText = `
            padding: 14px 18px;
            border-radius: 10px;
            margin-bottom: 18px;
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 14px;
            font-weight: 500;
            background: ${type === 'error' ? '#fef2f2' : '#f0fdf4'};
            border: 1.5px solid ${type === 'error' ? '#fecaca' : '#bbf7d0'};
            color: ${type === 'error' ? '#991b1b' : '#166534'};
            box-shadow: 0 4px 12px rgba(0,0,0,0.05);
            animation: fadeInSlide 0.25s ease;
        `;
        alertDiv.innerHTML = `
            <i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'check-circle'}" style="font-size: 18px;"></i>
            <span style="flex: 1;">${message}</span>
        `;
        alertContainer.innerHTML = '';
        alertContainer.appendChild(alertDiv);

        window.scrollTo({ top: 0, behavior: 'smooth' });

        setTimeout(() => {
            alertDiv.style.opacity = '0';
            setTimeout(() => alertDiv.remove(), 300);
        }, 6000);
    }

    // ============================================
    // STUDENT TYPE SWITCHING (New vs Transferee)
    // ============================================

    function setStudentType(type) {
        if (type === 'Transferee') {
            typeTransferee.checked = true;
            cardTypeTransferee.classList.add('active', 'transferee-active');
            cardTypeNew.classList.remove('active');
            transfereeSection.style.display = 'block';

            if (summaryTypePill) {
                summaryTypePill.textContent = 'Transferee (Transfer In)';
                summaryTypePill.className = 'type-badge-pill pill-transferee';
            }
            if (summaryPrevSchoolRow) summaryPrevSchoolRow.style.display = 'flex';
            if (prevSchool) prevSchool.required = true;
        } else {
            typeNew.checked = true;
            cardTypeNew.classList.add('active');
            cardTypeTransferee.classList.remove('active', 'transferee-active');
            transfereeSection.style.display = 'none';

            if (summaryTypePill) {
                summaryTypePill.textContent = 'New Student';
                summaryTypePill.className = 'type-badge-pill pill-new';
            }
            if (summaryPrevSchoolRow) summaryPrevSchoolRow.style.display = 'none';
            if (prevSchool) prevSchool.required = false;
        }
        updatePreview();
    }

    if (cardTypeNew) cardTypeNew.addEventListener('click', () => setStudentType('New Student'));
    if (cardTypeTransferee) cardTypeTransferee.addEventListener('click', () => setStudentType('Transferee'));
    if (typeNew) typeNew.addEventListener('change', () => setStudentType('New Student'));
    if (typeTransferee) typeTransferee.addEventListener('change', () => setStudentType('Transferee'));

    // ============================================
    // LOAD SECTIONS & SYNC GRADE / STRAND
    // ============================================

    async function loadSections() {
        try {
            const { data, error } = await supabase
                .from('sections')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;
            allSections = data || [];
            updateSectionDropdown();
        } catch (err) {
            console.warn('Could not load sections:', err);
        }
    }

    function updateSectionDropdown() {
        if (!sectionSelect) return;
        const currentGrade = gradeLevel ? gradeLevel.value : '';
        const currentStrand = strand ? strand.value : '';

        sectionSelect.innerHTML = '<option value="">-- Assign Later (Pending) --</option>';

        if (!currentGrade) return;

        const filtered = allSections.filter(sec => {
            const gradeMatch = String(sec.grade_level || '').toLowerCase().includes(currentGrade.replace('Grade ', '').toLowerCase()) ||
                String(sec.grade_level || '').toLowerCase() === currentGrade.toLowerCase();

            if (!gradeMatch) return false;

            if (['Grade 11', 'Grade 12'].includes(currentGrade) && currentStrand) {
                return !sec.strand || sec.strand.toLowerCase() === currentStrand.toLowerCase();
            }
            return true;
        });

        filtered.forEach(sec => {
            const opt = document.createElement('option');
            opt.value = sec.id;
            opt.textContent = `${sec.name} ${sec.strand ? '(' + sec.strand + ')' : ''} ${sec.room ? '• Rm ' + sec.room : ''}`;
            opt.dataset.sectionName = sec.name;
            sectionSelect.appendChild(opt);
        });
    }

    if (gradeLevel) {
        gradeLevel.addEventListener('change', () => {
            const val = gradeLevel.value;
            const isSHS = ['Grade 11', 'Grade 12'].includes(val);
            if (strandGroup) strandGroup.style.display = isSHS ? 'block' : 'none';
            if (strand) strand.required = isSHS;
            if (summaryStrandRow) summaryStrandRow.style.display = isSHS ? 'flex' : 'none';

            updateSectionDropdown();
            updatePreview();
        });
    }

    if (strand) {
        strand.addEventListener('change', () => {
            updateSectionDropdown();
            updatePreview();
        });
    }

    if (sectionSelect) {
        sectionSelect.addEventListener('change', updatePreview);
    }

    // ============================================
    // AUTO-GENERATE LRN & EMAIL HELPERS
    // ============================================

    function generateRandomLrn() {
        const prefix = '119516'; // PLSNHS DepEd ID prefix
        const rand = Math.floor(100000 + Math.random() * 900000);
        return `${prefix}${rand}`;
    }

    function triggerLrnGeneration() {
        const generated = generateRandomLrn();
        if (lrn) {
            lrn.value = generated;
            updatePreview();
        }
    }

    if (btnGenLrn) btnGenLrn.addEventListener('click', triggerLrnGeneration);
    if (autoGenLrnBtn) autoGenLrnBtn.addEventListener('click', triggerLrnGeneration);

    function suggestStudentEmail() {
        const fn = firstName ? firstName.value.trim().toLowerCase().replace(/[^a-z0-9]/g, '') : '';
        const ln = lastName ? lastName.value.trim().toLowerCase().replace(/[^a-z0-9]/g, '') : '';

        if (!fn || !ln) {
            showAlert('Please enter First Name and Last Name first before generating email.', 'error');
            return;
        }

        const domain = 'plsnhs.edu.ph';
        const suggested = `${fn}.${ln}@${domain}`;
        if (studentEmail) {
            studentEmail.value = suggested;
            updatePreview();
        }
    }

    if (autoGenEmailBtn) autoGenEmailBtn.addEventListener('click', suggestStudentEmail);

    // ============================================
    // AUTO-CALCULATE AGE FROM DATE OF BIRTH
    // ============================================

    if (dob) {
        dob.addEventListener('change', function() {
            if (!this.value) return;
            const birthDate = new Date(this.value);
            const today = new Date();
            let calculatedAge = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                calculatedAge--;
            }
            if (calculatedAge >= 5 && calculatedAge <= 40 && age) {
                age.value = calculatedAge;
            }
            updatePreview();
        });
    }

    // ============================================
    // 2x2 PHOTO UPLOAD (Drag & Drop or File Input)
    // ============================================

    if (photoDropZone && twoByTwoPhotoInput) {
        photoDropZone.addEventListener('click', () => twoByTwoPhotoInput.click());

        photoDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            photoDropZone.style.borderColor = '#0b2b4a';
            photoDropZone.style.background = '#e8edf5';
        });

        photoDropZone.addEventListener('dragleave', () => {
            photoDropZone.style.borderColor = '#cbd5e1';
            photoDropZone.style.background = '#f8fafc';
        });

        photoDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            photoDropZone.style.borderColor = '#cbd5e1';
            photoDropZone.style.background = '#f8fafc';
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                processPhotoFile(e.dataTransfer.files[0]);
            }
        });

        twoByTwoPhotoInput.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                processPhotoFile(this.files[0]);
            }
        });
    }

    function processPhotoFile(file) {
        if (!file.type.startsWith('image/')) {
            showAlert('Please upload a valid image file (JPG, PNG).', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = function(evt) {
            uploadedPhotoDataUrl = evt.target.result;
            if (photoPreviewImg) {
                photoPreviewImg.src = uploadedPhotoDataUrl;
                photoPreviewImg.style.display = 'inline-block';
            }
            if (photoPlaceholder) photoPlaceholder.style.display = 'none';
            if (photoStatusText) photoStatusText.textContent = `Attached: ${file.name}`;

            if (summaryAvatar) {
                summaryAvatar.innerHTML = `<img src="${uploadedPhotoDataUrl}" alt="Photo">`;
            }
        };
        reader.readAsDataURL(file);
    }

    // ============================================
    // LIVE PREVIEW SYNCHRONIZATION
    // ============================================

    function updatePreview() {
        const fn = firstName ? firstName.value.trim() : '';
        const ln = lastName ? lastName.value.trim() : '';
        const mn = middleName ? middleName.value.trim() : '';
        const sfx = suffix ? suffix.value.trim() : '';

        const full = `${fn} ${mn ? mn.charAt(0) + '. ' : ''}${ln} ${sfx}`.trim();
        if (summaryName) summaryName.textContent = full || 'Student Name';

        if (!uploadedPhotoDataUrl && summaryAvatar) {
            summaryAvatar.textContent = (fn || 'S').charAt(0).toUpperCase();
        }

        if (summaryLrn) summaryLrn.textContent = (lrn && lrn.value.trim()) ? lrn.value.trim() : '—';
        if (summaryGrade) summaryGrade.textContent = (gradeLevel && gradeLevel.value) ? gradeLevel.value : '—';
        if (summaryStrand) summaryStrand.textContent = (strand && strand.value) ? strand.value : '—';

        if (summarySection) {
            if (sectionSelect && sectionSelect.value) {
                const selectedOpt = sectionSelect.options[sectionSelect.selectedIndex];
                summarySection.textContent = selectedOpt ? selectedOpt.textContent : 'Assigned';
            } else {
                summarySection.textContent = 'To Be Assigned';
            }
        }

        if (summarySY) summarySY.textContent = (schoolYear && schoolYear.value) ? schoolYear.value : '2026-2027';
        if (summaryPrevSchool) summaryPrevSchool.textContent = (prevSchool && prevSchool.value.trim()) ? prevSchool.value.trim() : '—';

        if (summaryStatus) {
            const st = enrollmentStatus ? enrollmentStatus.value : 'enrolled';
            summaryStatus.textContent = st === 'enrolled' ? 'Enrolled (Active)' : 'Pending Review';
            summaryStatus.style.color = st === 'enrolled' ? '#10b981' : '#f59e0b';
        }

        const em = studentEmail ? studentEmail.value.trim() : '';
        const defaultEmail = (fn && ln ? `${fn.toLowerCase().replace(/\s+/g, '')}.${ln.toLowerCase().replace(/\s+/g, '')}@plsnhs.edu.ph` : 'student@email.com');
        const displayEmail = em || defaultEmail;
        const defaultPass = ln || '<Student\'s Last Name>';

        if (summaryCredEmail) summaryCredEmail.textContent = displayEmail;
        if (summaryCredPass) summaryCredPass.textContent = defaultPass;
        if (previewGmailDestEmail) previewGmailDestEmail.textContent = displayEmail;
    }

    // Bind real-time input listeners
    [firstName, lastName, middleName, suffix, lrn, studentEmail, schoolYear, prevSchool, enrollmentStatus].forEach(el => {
        if (el) {
            el.addEventListener('input', updatePreview);
            el.addEventListener('change', updatePreview);
        }
    });

    // ============================================
    // FORM SUBMISSION & DATABASE INSERTION
    // ============================================

    if (enrollForm) {
        enrollForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            // 1. Basic validation
            const isTransfereeStudent = typeTransferee ? typeTransferee.checked : false;
            const currentStudentType = isTransfereeStudent ? 'Transferee' : 'New Student';

            const fn = firstName ? firstName.value.trim() : '';
            const ln = lastName ? lastName.value.trim() : '';
            const mn = middleName ? middleName.value.trim() : '';
            const sfx = suffix ? suffix.value.trim() : '';
            const lrnVal = lrn ? lrn.value.trim() : '';
            const emailVal = studentEmail ? studentEmail.value.trim() : '';
            const dobVal = dob ? dob.value : null;
            const ageVal = age ? parseInt(age.value, 10) : null;
            const genderVal = gender ? gender.value : '';
            const addressVal = address ? address.value.trim() : '';
            const gradeVal = gradeLevel ? gradeLevel.value : '';
            const strandVal = (['Grade 11', 'Grade 12'].includes(gradeVal) && strand) ? strand.value : null;
            const sectionVal = sectionSelect ? sectionSelect.value || null : null;
            const syVal = schoolYear ? schoolYear.value.trim() : '2026-2027';
            const statusVal = enrollmentStatus ? enrollmentStatus.value : 'enrolled';

            if (!fn || !ln) {
                showAlert('Please provide both the student First Name and Last Name.', 'error');
                return;
            }

            if (!lrnVal || lrnVal.length < 10) {
                showAlert('Please provide a valid 12-digit Learner Reference Number (LRN). You can click "Auto-Generate".', 'error');
                return;
            }

            if (!emailVal) {
                showAlert('Please provide a student email address for portal authentication.', 'error');
                return;
            }

            if (!dobVal) {
                showAlert('Please specify the student\'s Date of Birth.', 'error');
                return;
            }

            if (!gradeVal) {
                showAlert('Please select an applying Grade Level.', 'error');
                return;
            }

            if (['Grade 11', 'Grade 12'].includes(gradeVal) && !strandVal) {
                showAlert('Please select a Senior High School Strand for Grade 11/12.', 'error');
                return;
            }

            // Transferee-specific validation
            const prevSchoolName = prevSchool ? prevSchool.value.trim() : '';
            const prevGradeVal = prevGrade ? prevGrade.value : '';
            const lastSyVal = lastSchoolYear ? lastSchoolYear.value.trim() : '';
            const gpaVal = generalAverage && generalAverage.value ? parseFloat(generalAverage.value) : null;
            const sf10StatusVal = sf10Status ? sf10Status.value : 'Under Request from Origin School';
            const transferReasonVal = transferReason ? transferReason.value.trim() : '';

            if (isTransfereeStudent && !prevSchoolName) {
                showAlert('Please specify the Previous School Name for the Transferee student.', 'error');
                if (prevSchool) prevSchool.focus();
                return;
            }

            // Guardian info
            const gName = guardianName ? guardianName.value.trim() : (fatherName?.value.trim() || motherName?.value.trim() || 'Parent');
            const gRel = guardianRelationship ? guardianRelationship.value : 'Parent';
            const gContact = guardianContact ? guardianContact.value.trim() : (contactNumber?.value.trim() || '—');
            const gEmail = guardianEmail ? guardianEmail.value.trim() : null;
            const gAddr = guardianAddress ? guardianAddress.value.trim() : addressVal;

            // Disable submit button
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enrolling Student into Database...';
            }

            try {
                console.log(`🚀 Registrar enrolling ${currentStudentType}:`, { fn, ln, gradeVal, strandVal, lrnVal });

                // STEP 1: Insert into public.students
                const studentPayload = {
                    lrn: lrnVal,
                    first_name: fn,
                    last_name: ln,
                    middle_name: mn || null,
                    suffix: sfx || null,
                    email: emailVal,
                    contact_number: contactNumber?.value.trim() || gContact || '—',
                    date_of_birth: dobVal,
                    age: ageVal,
                    gender: genderVal || null,
                    civil_status: 'Single',
                    nationality: nationality?.value.trim() || 'Filipino',
                    religion: religion?.value.trim() || null,
                    address: addressVal,
                    grade_level: gradeVal,
                    strand: strandVal,
                    section_id: sectionVal,
                    student_type: currentStudentType,
                    parent_name: gName,
                    parent_contact: gContact,
                    parent_email: gEmail,
                    two_by_two_picture_url: uploadedPhotoDataUrl || null,
                    avatar_url: uploadedPhotoDataUrl || null,
                    documents_status: isTransfereeStudent ? `Transferee: ${sf10StatusVal}` : 'complete',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                const { data: createdStudentArr, error: studentErr } = await supabase
                    .from('students')
                    .insert([studentPayload])
                    .select();

                if (studentErr) {
                    console.error('Students insert error:', studentErr);
                    throw studentErr;
                }

                const createdStudent = createdStudentArr && createdStudentArr.length > 0 ? createdStudentArr[0] : null;
                const studentId = createdStudent ? createdStudent.id : null;

                // STEP 2: Insert into public.enrollments
                const enrollmentPayload = {
                    student_id: studentId,
                    first_name: fn,
                    last_name: ln,
                    middle_name: mn || null,
                    email: emailVal,
                    grade_level: gradeVal,
                    strand: strandVal,
                    student_type: currentStudentType,
                    previous_school: isTransfereeStudent ? prevSchoolName : 'Placido L. Señor National High School (PLSNHS)',
                    previous_grade: isTransfereeStudent ? (prevGradeVal || 'Grade 6') : 'N/A',
                    last_school_year: isTransfereeStudent ? (lastSyVal || '2025-2026') : syVal,
                    general_average: gpaVal,
                    status: statusVal,
                    school_year: syVal,
                    dob: dobVal,
                    date_of_birth: dobVal,
                    age: ageVal,
                    gender: genderVal || null,
                    birthplace: birthplace?.value.trim() || null,
                    nationality: nationality?.value.trim() || 'Filipino',
                    religion: religion?.value.trim() || null,
                    address: addressVal,
                    contact_number: contactNumber?.value.trim() || gContact,
                    mother_name: motherName?.value.trim() || null,
                    mother_occupation: motherOccupation?.value.trim() || null,
                    father_name: fatherName?.value.trim() || null,
                    father_occupation: fatherOccupation?.value.trim() || null,
                    guardian_name: gName,
                    guardian_relationship: gRel,
                    guardian_contact: gContact,
                    guardian_email: gEmail,
                    guardian_address: gAddr,
                    two_by_two_picture_url: uploadedPhotoDataUrl || null,
                    enrolled_date: statusVal === 'enrolled' ? new Date().toISOString() : null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                const { data: createdEnrArr, error: enrErr } = await supabase
                    .from('enrollments')
                    .insert([enrollmentPayload])
                    .select();

                if (enrErr) {
                    console.warn('Enrollment record insert warning:', enrErr);
                }

                const createdEnrollmentId = createdEnrArr && createdEnrArr.length > 0 ? createdEnrArr[0].id : null;

                // Link enrollment_id in students table if created
                if (studentId && createdEnrollmentId) {
                    try {
                        await supabase
                            .from('students')
                            .update({ enrollment_id: createdEnrollmentId })
                            .eq('id', studentId);
                    } catch (e) {
                        console.warn('Link enrollment_id warning:', e);
                    }
                }

                // STEP 3: Upsert User Account in public.users table
                // Username = studentEmail, Default Password = student last name
                try {
                    const defaultPassword = ln;
                    const { data: existingUser } = await supabase
                        .from('users')
                        .select('id')
                        .ilike('email', emailVal)
                        .maybeSingle();

                    if (existingUser) {
                        await supabase
                            .from('users')
                            .update({
                                role: 'student',
                                student_id: studentId,
                                first_name: fn,
                                last_name: ln,
                                password: defaultPassword,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', existingUser.id);
                    } else {
                        await supabase
                            .from('users')
                            .insert([{
                                email: emailVal,
                                password: defaultPassword,
                                role: 'student',
                                first_name: fn,
                                last_name: ln,
                                student_id: studentId,
                                contact_number: contactNumber?.value.trim() || gContact,
                                address: addressVal,
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString()
                            }]);
                    }
                    console.log('✅ User account provisioned for student portal access');
                } catch (uErr) {
                    console.warn('User provision warning:', uErr);
                }

                // STEP 4: If Transferee, insert into public.transferees
                if (isTransfereeStudent && studentId) {
                    try {
                        await supabase
                            .from('transferees')
                            .insert([{
                                student_id: studentId,
                                type: 'Transferred In',
                                from_school: prevSchoolName,
                                to_school: 'Placido L. Señor National High School',
                                reason: transferReasonVal ? `${transferReasonVal} (SF10: ${sf10StatusVal})` : `Inward transfer admission from ${prevSchoolName}`,
                                status: statusVal === 'enrolled' ? 'Enrolled' : 'Pending',
                                requested_date: new Date().toISOString(),
                                created_at: new Date().toISOString()
                            }]);
                        console.log('✅ Formally recorded into transferees table');
                    } catch (tErr) {
                        console.warn('Transferees table record warning:', tErr);
                    }
                }

                // STEP 5: Log to activity_logs
                try {
                    await supabase
                        .from('activity_logs')
                        .insert([{
                            role: 'registrar',
                            user_id: currentUser?.id && currentUser.id.length === 36 ? currentUser.id : null,
                            action: `Registrar enrolled ${currentStudentType}: ${fn} ${ln} (${gradeVal}${strandVal ? ' ' + strandVal : ''})`,
                            details: `LRN: ${lrnVal}, Email: ${emailVal}${isTransfereeStudent ? ', From: ' + prevSchoolName : ''}`,
                            created_at: new Date().toISOString()
                        }]);
                } catch (actErr) {
                    console.warn('Activity log insert warning:', actErr);
                }

                // STEP 6: Send Welcome Notification with credentials
                try {
                    const welcomeMsg = `Welcome to Placido L. Señor National High School, ${fn}!\n\n` +
                        `Your enrollment as a ${currentStudentType} for ${gradeVal}${strandVal ? ' (' + strandVal + ')' : ''} has been officially approved and recorded by the Registrar.\n\n` +
                        `Your Portal Login Credentials:\n` +
                        `• Email: ${emailVal}\n` +
                        `• Default Password: ${ln}\n\n` +
                        `Please keep your DepEd LRN (${lrnVal}) secure for ID and enrollment verification.`;

                    await supabase
                        .from('notifications')
                        .insert([{
                            student_id: studentId,
                            recipient_email: emailVal,
                            role: 'student',
                            title: `🎉 Official Enrollment Approval (${currentStudentType})`,
                            message: welcomeMsg,
                            type: 'action',
                            enrollment_id: createdEnrollmentId,
                            read: false,
                            is_read: false,
                            created_at: new Date().toISOString()
                        }]);
                } catch (nErr) {
                    console.warn('Notification insert warning:', nErr);
                }

                // STEP 6b: Notify Admin and Registrar (only Admin and Registrar, no other role)
                try {
                    const notifTitle = `📋 New Student Enrolled (${currentStudentType})`;
                    const notifMessage = `${fn} ${ln} was enrolled in ${gradeVal}${strandVal ? ' (' + strandVal + ')' : ''} by Registrar.`;
                    await supabase
                        .from('notifications')
                        .insert([
                            {
                                role: 'admin',
                                title: notifTitle,
                                message: notifMessage,
                                type: 'new_enrollment',
                                enrollment_id: createdEnrollmentId,
                                read: false,
                                is_read: false,
                                created_at: new Date().toISOString()
                            },
                            {
                                role: 'registrar',
                                title: notifTitle,
                                message: notifMessage,
                                type: 'new_enrollment',
                                enrollment_id: createdEnrollmentId,
                                read: false,
                                is_read: false,
                                created_at: new Date().toISOString()
                            }
                        ]);
                    // Cross-tab sync for both
                    localStorage.setItem('hes_latest_notification', JSON.stringify({
                        role: 'all',
                        roles: ['admin', 'registrar'],
                        title: notifTitle,
                        message: notifMessage,
                        type: 'new_enrollment',
                        enrollment_id: createdEnrollmentId,
                        timestamp: Date.now()
                    }));
                } catch (nrErr) {
                    console.warn('Admin/Registrar notification warning:', nrErr);
                }

                // STEP 7: Show Success Modal
                const studentFullName = `${fn} ${ln}`;
                if (modalStudentName) modalStudentName.textContent = studentFullName;
                if (modalStudentType) {
                    modalStudentType.textContent = currentStudentType;
                    modalStudentType.className = isTransfereeStudent ? 'type-badge-pill pill-transferee' : 'type-badge-pill pill-new';
                }
                if (modalStudentLrn) modalStudentLrn.textContent = lrnVal;
                if (modalStudentEmail) modalStudentEmail.textContent = emailVal;
                if (modalStudentPass) modalStudentPass.textContent = ln;
                if (modalGmailUsername) modalGmailUsername.textContent = emailVal;
                if (modalGmailPassword) modalGmailPassword.textContent = ln;

                // Cache for modal action buttons
                lastEnrolledData = {
                    studentName: studentFullName,
                    firstName: fn,
                    lastName: ln,
                    email: emailVal,
                    gradeLevel: gradeVal,
                    strand: strandVal,
                    schoolYear: syVal,
                    lrn: lrnVal
                };

                if (successModal) successModal.classList.add('active');

            } catch (err) {
                console.error('❌ Error submitting enrollment:', err);
                showAlert(`Failed to enroll student: ${err.message || 'Database error'}. Please check fields and try again.`, 'error');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fas fa-user-check"></i> Complete Student Enrollment';
                }
            }
        });
    }

    // ============================================
    // RIGHT-SIDE GMAIL ACTIONS & ALREADY ENROLLED LOOKUP
    // ============================================

    function triggerGmailCredentials(studentData) {
        if (!studentData || !studentData.email) {
            showAlert('Please enter at least the student\'s name and email address to send Gmail credentials.', 'error');
            return false;
        }
        const emailPayload = EmailNotificationService.buildCredentialsEmail({
            studentName: studentData.studentName || `${studentData.firstName || ''} ${studentData.lastName || ''}`.trim(),
            firstName: studentData.firstName || 'Student',
            lastName: studentData.lastName || '',
            email: studentData.email,
            gradeLevel: studentData.gradeLevel || 'Junior/Senior High',
            strand: studentData.strand || '',
            schoolYear: studentData.schoolYear || '2026-2027'
        });
        EmailNotificationService.sendViaGmailWeb(emailPayload);
        return true;
    }

    if (sendCredsGmailPreviewBtn) {
        sendCredsGmailPreviewBtn.addEventListener('click', function() {
            const fn = firstName ? firstName.value.trim() : '';
            const ln = lastName ? lastName.value.trim() : '';
            const em = studentEmail ? studentEmail.value.trim() : '';
            const gr = gradeLevel ? gradeLevel.value : '';
            const st = strand ? strand.value : '';
            const sy = schoolYear ? schoolYear.value.trim() : '2026-2027';

            if (!em || !ln) {
                showAlert('Please fill in the student\'s name and email address in the form to generate and dispatch login credentials.', 'error');
                if (!em && studentEmail) studentEmail.focus();
                else if (!ln && lastName) lastName.focus();
                return;
            }

            const studentData = {
                studentName: `${fn} ${ln}`.trim(),
                firstName: fn,
                lastName: ln,
                email: em,
                gradeLevel: gr,
                strand: st,
                schoolYear: sy
            };

            triggerGmailCredentials(studentData);
            showAlert(`Gmail compose opened in a new tab! Official login credentials (Username: ${em}, Password: ${ln}) ready to send.`, 'success');
        });
    }

    if (copyCredsPreviewBtn) {
        copyCredsPreviewBtn.addEventListener('click', function() {
            const fn = firstName ? firstName.value.trim() : '';
            const ln = lastName ? lastName.value.trim() : '';
            const em = studentEmail ? studentEmail.value.trim() : '';
            const gr = gradeLevel ? gradeLevel.value : '';
            const idLrn = lrn ? lrn.value.trim() : '';

            if (!em && !ln) {
                showAlert('No student details to copy yet. Please fill in the student\'s name and email.', 'error');
                return;
            }

            const credText = `Placido L. Señor National High School (PLSNHS)\nOfficial Student Portal Credentials\n\nStudent: ${fn} ${ln}\nLRN: ${idLrn || 'Pending'}\nGrade Level: ${gr || 'Junior/Senior High'}\nLogin Username / Email: ${em}\nDefault Password: ${ln}\nStudent Portal: http://localhost:5500/auth/login.html`;

            navigator.clipboard.writeText(credText).then(() => {
                copyCredsPreviewBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                setTimeout(() => {
                    copyCredsPreviewBtn.innerHTML = '<i class="fas fa-copy"></i> Copy Details';
                }, 2000);
            }).catch(() => {
                alert(credText);
            });
        });
    }

    if (sendMailtoPreviewBtn) {
        sendMailtoPreviewBtn.addEventListener('click', function() {
            const fn = firstName ? firstName.value.trim() : '';
            const ln = lastName ? lastName.value.trim() : '';
            const em = studentEmail ? studentEmail.value.trim() : '';
            const gr = gradeLevel ? gradeLevel.value : '';
            const st = strand ? strand.value : '';
            const sy = schoolYear ? schoolYear.value.trim() : '2026-2027';

            if (!em || !ln) {
                showAlert('Please fill in the student\'s name and email address first.', 'error');
                return;
            }

            const emailPayload = EmailNotificationService.buildCredentialsEmail({
                studentName: `${fn} ${ln}`.trim(),
                firstName: fn,
                lastName: ln,
                email: em,
                gradeLevel: gr,
                strand: st,
                schoolYear: sy
            });
            EmailNotificationService.sendViaMailto(emailPayload);
        });
    }

    // Toggle Already Enrolled Collapsible Card
    if (lookupToggleHeader && lookupContent) {
        lookupToggleHeader.addEventListener('click', function() {
            const isHidden = lookupContent.style.display === 'none' || !lookupContent.style.display;
            lookupContent.style.display = isHidden ? 'block' : 'none';
            if (lookupChevron) lookupChevron.classList.toggle('rotated', isHidden);
        });
    }

    // Load Enrolled Students for Lookup
    async function loadEnrolledStudentsForLookup() {
        if (!existingStudentSelect) return;
        try {
            const [studentsRes, usersRes] = await Promise.all([
                supabase.from('students').select('id, lrn, first_name, last_name, email, grade_level, strand').order('last_name', { ascending: true }).limit(100),
                supabase.from('users').select('id, email, password, first_name, last_name, role').eq('role', 'student')
            ]);

            const studentsData = studentsRes.data || [];
            const usersData = usersRes.data || [];

            enrolledStudentsList = studentsData.map(st => {
                const matchedUser = usersData.find(u => 
                    (st.email && u.email && u.email.toLowerCase() === st.email.toLowerCase()) ||
                    st.id === u.id
                );
                const effectivePassword = (matchedUser && matchedUser.password) ? matchedUser.password : (st.last_name || 'student123');
                const effectiveEmail = st.email || (matchedUser ? matchedUser.email : '');
                return {
                    ...st,
                    password: effectivePassword,
                    email: effectiveEmail,
                    fullName: `${st.first_name || ''} ${st.last_name || ''}`.trim()
                };
            });

            existingStudentSelect.innerHTML = '<option value="">-- Choose Enrolled Student --</option>';
            enrolledStudentsList.forEach(st => {
                const opt = document.createElement('option');
                opt.value = st.id;
                opt.textContent = `${st.last_name}, ${st.first_name} (${st.lrn || 'No LRN'}) - ${st.grade_level || 'Enrolled'}`;
                existingStudentSelect.appendChild(opt);
            });
        } catch (err) {
            console.warn('Could not load enrolled students list:', err);
        }
    }

    if (existingStudentSelect) {
        existingStudentSelect.addEventListener('change', function() {
            const chosenId = this.value;
            selectedLookupStudent = enrolledStudentsList.find(s => s.id === chosenId);

            if (!selectedLookupStudent) {
                if (enrolledStudentDetailBox) enrolledStudentDetailBox.style.display = 'none';
                return;
            }

            if (lookupStudentName) lookupStudentName.textContent = selectedLookupStudent.fullName;
            if (lookupStudentLrn) lookupStudentLrn.textContent = selectedLookupStudent.lrn || '—';
            if (lookupStudentEmail) lookupStudentEmail.textContent = selectedLookupStudent.email || '—';
            if (lookupStudentPass) lookupStudentPass.textContent = selectedLookupStudent.password || selectedLookupStudent.last_name;
            if (enrolledStudentDetailBox) enrolledStudentDetailBox.style.display = 'flex';
        });
    }

    if (sendEnrolledGmailBtn) {
        sendEnrolledGmailBtn.addEventListener('click', function() {
            if (!selectedLookupStudent) return;
            if (!selectedLookupStudent.email) {
                showAlert('This enrolled student has no email address registered in the database.', 'error');
                return;
            }

            const emailPayload = EmailNotificationService.buildCredentialsEmail({
                studentName: selectedLookupStudent.fullName,
                firstName: selectedLookupStudent.first_name,
                lastName: selectedLookupStudent.last_name,
                email: selectedLookupStudent.email,
                gradeLevel: selectedLookupStudent.grade_level,
                strand: selectedLookupStudent.strand,
                schoolYear: '2026-2027'
            });

            EmailNotificationService.sendViaGmailWeb(emailPayload);
            showAlert(`Gmail compose opened for ${selectedLookupStudent.fullName}! Credentials: (Username: ${selectedLookupStudent.email}, Password: ${selectedLookupStudent.password || selectedLookupStudent.last_name})`, 'success');
        });
    }

    // ============================================
    // MODAL ACTIONS
    // ============================================

    if (sendCredsGmailModalBtn) {
        sendCredsGmailModalBtn.addEventListener('click', function() {
            if (!lastEnrolledData) {
                const lrnVal = modalStudentLrn ? modalStudentLrn.textContent : '';
                const emailVal = modalStudentEmail ? modalStudentEmail.textContent : '';
                const passVal = modalStudentPass ? modalStudentPass.textContent : '';
                const nameVal = modalStudentName ? modalStudentName.textContent : '';
                lastEnrolledData = {
                    studentName: nameVal,
                    firstName: nameVal.split(' ')[0],
                    lastName: passVal,
                    email: emailVal,
                    lrn: lrnVal
                };
            }
            triggerGmailCredentials(lastEnrolledData);
        });
    }

    if (sendCredsMailtoModalBtn) {
        sendCredsMailtoModalBtn.addEventListener('click', function() {
            if (!lastEnrolledData) return;
            const emailPayload = EmailNotificationService.buildCredentialsEmail(lastEnrolledData);
            EmailNotificationService.sendViaMailto(emailPayload);
        });
    }

    if (copyCredsBtn) {
        copyCredsBtn.addEventListener('click', function() {
            const lrnVal = modalStudentLrn ? modalStudentLrn.textContent : '';
            const emailVal = modalStudentEmail ? modalStudentEmail.textContent : '';
            const passVal = modalStudentPass ? modalStudentPass.textContent : '';
            const nameVal = modalStudentName ? modalStudentName.textContent : '';

            const credText = `Placido L. Señor National High School (PLSNHS)\nOfficial Student Portal Credentials\n\nStudent: ${nameVal}\nLRN: ${lrnVal}\nUsername / Email: ${emailVal}\nDefault Password: ${passVal}\nPortal: HES Student Login`;

            navigator.clipboard.writeText(credText).then(() => {
                copyCredsBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                setTimeout(() => {
                    copyCredsBtn.innerHTML = '<i class="fas fa-copy"></i> Copy Credentials';
                }, 2500);
            }).catch(() => {
                alert(credText);
            });
        });
    }

    if (printReceiptBtn) {
        printReceiptBtn.addEventListener('click', function() {
            window.print();
        });
    }

    if (btnEnrollAnother) {
        btnEnrollAnother.addEventListener('click', function() {
            if (successModal) successModal.classList.remove('active');
            if (enrollForm) enrollForm.reset();
            uploadedPhotoDataUrl = null;
            if (photoPreviewImg) photoPreviewImg.style.display = 'none';
            if (photoPlaceholder) photoPlaceholder.style.display = 'inline-flex';
            if (photoStatusText) photoStatusText.textContent = 'No photo uploaded';
            setStudentType('New Student');
            updatePreview();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // Initialize
    loadSections();
    updatePreview();
    loadEnrolledStudentsForLookup();

})();

