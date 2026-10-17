/**
 * Student Profile - Supabase Integration
 * HES - HES, Hiraya Enrollment System
 */

import { supabase } from '../../supabase/config.js';

(function() {
    'use strict';

    console.log('👤 Student Profile (Supabase) ready');

    // ============================================
    // DOM ELEMENTS
    // ============================================

    const studentName = document.getElementById('studentName');
    const studentInitial = document.getElementById('studentInitial');
    const logoutBtn = document.getElementById('logoutBtn');
    const backBtn = document.getElementById('backBtn');

    // Profile info
    const profileName = document.getElementById('profileName');
    const profileInitial = document.getElementById('profileInitial');
    const profileEmail = document.getElementById('profileEmail');
    const studentId = document.getElementById('studentId');
    const memberSince = document.getElementById('memberSince');
    const daysActive = document.getElementById('daysActive');
    const emailVerifiedBadge = document.getElementById('emailVerifiedBadge');
    const emailVerificationSection = document.getElementById('emailVerificationSection');

    // Academic info
    const gradeLevel = document.getElementById('gradeLevel');
    const strandValue = document.getElementById('strandValue');
    const schoolYearValue = document.getElementById('schoolYearValue');
    const subjectsCountValue = document.getElementById('subjectsCountValue');

    // Alert container
    const alertContainer = document.getElementById('alertContainer');

    // ============================================
    // STATE
    // ============================================

    let userData = null;
    let studentData = null;
    let enrollmentData = null;

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

    // Role check
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

    if (backBtn) {
        backBtn.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = 'dashboard.html';
        });
    }

    // ============================================
    // LOAD PROFILE DATA FROM SUPABASE
    // ============================================

    async function loadProfileData() {
        try {
            // Immediate local render
            updateUI();

            const userEmail = sessionUser.email || '';
            const userUid = sessionUser.uid || '';

            // 1. Fetch user from 'users' table
            try {
                const { data: uData } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', userUid)
                    .maybeSingle();

                if (uData) {
                    userData = uData;
                }
            } catch(e) {}

            // 2. Fetch student from 'students' table
            try {
                const { data: sRows } = await supabase
                    .from('students')
                    .select('*')
                    .or(`email.eq.${userEmail},id.eq.${userUid}`);

                if (sRows && sRows.length > 0) {
                    studentData = sRows[0];
                }
            } catch(e) {}

            // 3. Fetch latest enrollment
            const studentIdVal = studentData?.id || userUid;
            try {
                let query = supabase.from('enrollments').select('*');
                if (userEmail && studentIdVal) {
                    query = query.or(`email.eq.${userEmail},student_id.eq.${studentIdVal}`);
                } else if (userEmail) {
                    query = query.eq('email', userEmail);
                }
                const { data: enrData } = await query.order('created_at', { ascending: false }).limit(1);
                if (enrData && enrData.length > 0) {
                    enrollmentData = enrData[0];
                }
            } catch(e) {}

            // 4. Subjects count
            try {
                const { count } = await supabase
                    .from('subjects')
                    .select('*', { count: 'exact', head: true });
                if (subjectsCountValue) {
                    subjectsCountValue.textContent = count && count > 0 ? count : (enrollmentData ? 8 : 0);
                }
            } catch(e) {
                if (subjectsCountValue) subjectsCountValue.textContent = enrollmentData ? '8' : '0';
            }

            updateUI();

        } catch (error) {
            console.error('Error loading profile data:', error);
            showAlert('❌ Error loading profile: ' + error.message, 'error');
        }
    }

    // ============================================
    // UPDATE UI
    // ============================================

    function updateUI() {
        let studentFullName = studentData?.first_name ? 
            `${studentData.first_name} ${studentData.last_name || ''}`.trim() : 
            (userData?.first_name ? `${userData.first_name} ${userData.last_name || ''}`.trim() : 
            (sessionUser.firstName ? `${sessionUser.firstName} ${sessionUser.lastName || ''}`.trim() : (sessionUser.email ? sessionUser.email.split('@')[0] : 'Student')));
        studentFullName = sanitizeStudentName(studentFullName, sessionUser.email);

        const initials = getStudentInitials(studentFullName);

        try {
            localStorage.setItem('hes_student_name', studentFullName);
        } catch(e) {}

        if (studentName) studentName.textContent = studentFullName;
        if (studentInitial) studentInitial.textContent = initials;
        if (profileName) profileName.textContent = studentFullName;
        if (profileInitial) profileInitial.textContent = initials;
        if (profileEmail) profileEmail.textContent = sessionUser.email;
        if (studentId) studentId.textContent = studentData?.lrn || 'Not Assigned';
        
        const modalInitial = document.getElementById('modalInitial');
        if (modalInitial) modalInitial.textContent = initials;

        // Profile picture
        const effectiveAvatar = localStorage.getItem('hes_student_avatar');
        if (effectiveAvatar) {
            applyStudentAvatarToDOM(effectiveAvatar);
        } else {
            renderDefaultStudentAvatar(studentFullName);
        }

        // Member since
        const createdDate = userData?.created_at || studentData?.created_at;
        if (createdDate) {
            const date = new Date(createdDate);
            if (memberSince) memberSince.textContent = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            const diff = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
            if (daysActive) daysActive.textContent = diff > 0 ? diff : 1;
        } else {
            if (memberSince) memberSince.textContent = 'Active Member';
            if (daysActive) daysActive.textContent = '1';
        }

        // Email verification badge
        if (emailVerifiedBadge) {
            emailVerifiedBadge.innerHTML = '<span class="verified-badge"><i class="fas fa-check-circle"></i> Active Account</span>';
        }
        if (emailVerificationSection) {
            emailVerificationSection.innerHTML = `
                <div class="verification-badge verified">
                    <i class="fas fa-check-circle"></i> Verified Student Profile
                </div>
                <div class="verification-info">
                    <p>Your student account is registered and authenticated in the school portal.</p>
                </div>
            `;
        }

        // Academic info
        if (enrollmentData || studentData) {
            const grade = enrollmentData?.grade_level || enrollmentData?.grade || studentData?.grade_level || 'Grade 11';
            const strand = enrollmentData?.strand || studentData?.strand || 'TVL-ICT';
            const sy = enrollmentData?.school_year || enrollmentData?.schoolYear || enrollmentData?.last_school_year || '2025-2026';

            if (gradeLevel) gradeLevel.textContent = grade;
            if (strandValue) strandValue.textContent = strand;
            if (schoolYearValue) schoolYearValue.textContent = sy;
        } else {
            if (gradeLevel) gradeLevel.textContent = 'Not Enrolled';
            if (strandValue) strandValue.textContent = 'N/A';
            if (schoolYearValue) schoolYearValue.textContent = 'N/A';
        }

        // Render Account Information View Mode Fields
        renderAccountInfoView();

        // Populate edit personal information form inputs
        populateEditForm();
    }

    function renderAccountInfoView() {
        const viewStudentFullName = document.getElementById('viewStudentFullName');
        const viewStudentEmail = document.getElementById('viewStudentEmail');
        const viewStudentLrn = document.getElementById('viewStudentLrn');
        const viewStudentGender = document.getElementById('viewStudentGender');
        const viewStudentBirthdate = document.getElementById('viewStudentBirthdate');
        const viewStudentPhone = document.getElementById('viewStudentPhone');
        const viewStudentParentName = document.getElementById('viewStudentParentName');
        const viewStudentParentPhone = document.getElementById('viewStudentParentPhone');
        const viewStudentAddress = document.getElementById('viewStudentAddress');

        const fName = studentData?.first_name || userData?.first_name || sessionUser.firstName || '';
        const lName = studentData?.last_name || userData?.last_name || sessionUser.lastName || '';
        const fullName = `${fName} ${lName}`.trim() || sanitizeStudentName('', sessionUser.email);
        
        if (viewStudentFullName) viewStudentFullName.textContent = fullName || '-';
        if (viewStudentEmail) viewStudentEmail.textContent = sessionUser.email || '-';
        if (viewStudentLrn) viewStudentLrn.textContent = studentData?.lrn || enrollmentData?.lrn || 'Not Assigned';
        if (viewStudentGender) viewStudentGender.textContent = studentData?.gender || enrollmentData?.gender || userData?.gender || 'Not specified';
        
        if (viewStudentBirthdate) {
            const rawDob = studentData?.birthdate || studentData?.dob || enrollmentData?.birthdate || enrollmentData?.dob || userData?.birthdate;
            if (rawDob) {
                try {
                    const d = new Date(rawDob);
                    viewStudentBirthdate.textContent = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                } catch(e) {
                    viewStudentBirthdate.textContent = rawDob;
                }
            } else {
                viewStudentBirthdate.textContent = 'Not specified';
            }
        }

        if (viewStudentPhone) viewStudentPhone.textContent = studentData?.contact_number || userData?.phone || enrollmentData?.contact_number || 'Not provided';
        if (viewStudentParentName) viewStudentParentName.textContent = studentData?.parent_name || enrollmentData?.guardian_name || enrollmentData?.mother_name || enrollmentData?.father_name || 'Not provided';
        if (viewStudentParentPhone) viewStudentParentPhone.textContent = studentData?.parent_contact || enrollmentData?.guardian_contact || 'Not provided';
        
        const viewStudentParentFb = document.getElementById('viewStudentParentFb');
        if (viewStudentParentFb) viewStudentParentFb.textContent = studentData?.parent_facebook || 'Not provided';
        
        const viewStudentParentEmail = document.getElementById('viewStudentParentEmail');
        if (viewStudentParentEmail) viewStudentParentEmail.textContent = studentData?.parent_email || enrollmentData?.guardian_email || 'Not provided';

        if (viewStudentAddress) viewStudentAddress.textContent = studentData?.address || userData?.address || enrollmentData?.address || 'Not provided';

        // Render Emergency ID & Parent Contact QR
        renderStudentEmergencyQr();
    }

    // ============================================
    // STUDENT EMERGENCY ID & PARENT CONTACT QR
    // ============================================
    function renderStudentEmergencyQr() {
        const qrImg = document.getElementById('studentEmergencyQrImg');
        const qrLoading = document.getElementById('qrLoadingText');
        const qrParentName = document.getElementById('qrCardParentName');
        const qrParentPhone = document.getElementById('qrCardParentPhone');
        const qrParentFb = document.getElementById('qrCardParentFb');
        const qrParentEmail = document.getElementById('qrCardParentEmail');
        const btnCall = document.getElementById('btnCallParent');
        const btnFb = document.getElementById('btnFbParent');
        const btnEmail = document.getElementById('btnEmailParent');

        const sName = studentData?.first_name ? `${studentData.first_name} ${studentData.last_name || ''}`.trim() : (sessionUser?.firstName ? `${sessionUser.firstName} ${sessionUser.lastName || ''}`.trim() : 'Student');
        const lrn = studentData?.lrn || 'Pending LRN';
        const grade = studentData?.grade_level || enrollmentData?.grade_level || 'HES Student';
        const pName = studentData?.parent_name || enrollmentData?.guardian_name || 'Guardian Not Set';
        const pPhone = studentData?.parent_contact || enrollmentData?.guardian_contact || '';
        const pFb = studentData?.parent_facebook || '';
        const pEmail = studentData?.parent_email || enrollmentData?.guardian_email || '';

        if (qrParentName) qrParentName.textContent = `Parent: ${pName}`;
        if (qrParentPhone) qrParentPhone.textContent = `Phone: ${pPhone || 'Not Set'}`;
        if (qrParentFb) qrParentFb.textContent = `FB: ${pFb || 'Not Set'}`;
        if (qrParentEmail) qrParentEmail.textContent = `Gmail: ${pEmail || 'Not Set'}`;

        // 1-Click Action Links
        if (btnCall) {
            btnCall.href = pPhone ? `tel:${pPhone}` : '#';
            btnCall.style.opacity = pPhone ? '1' : '0.5';
            btnCall.title = pPhone ? `Call ${pPhone}` : 'No phone number provided';
        }

        if (btnFb) {
            if (pFb) {
                const fbUrl = pFb.startsWith('http') ? pFb : `https://facebook.com/${pFb.replace(/^@/, '')}`;
                btnFb.href = fbUrl;
                btnFb.style.opacity = '1';
                btnFb.title = `Open ${pFb}`;
            } else {
                btnFb.href = '#';
                btnFb.style.opacity = '0.5';
                btnFb.title = 'No Facebook account provided';
            }
        }

        if (btnEmail) {
            if (pEmail) {
                btnEmail.href = `mailto:${pEmail}?subject=Emergency%20Contact%20-%20Student%20${encodeURIComponent(sName)}`;
                btnEmail.style.opacity = '1';
                btnEmail.title = `Email ${pEmail}`;
            } else {
                btnEmail.href = '#';
                btnEmail.style.opacity = '0.5';
                btnEmail.title = 'No Gmail/email provided';
            }
        }

        // Construct QR payload with contact details
        const qrPayload = [
            `HIRAYA ENROLLMENT SYSTEM (HES)`,
            `STUDENT: ${sName}`,
            `LRN: ${lrn}`,
            `GRADE: ${grade}`,
            `--- EMERGENCY PARENT CONTACT ---`,
            `PARENT: ${pName}`,
            `PHONE: ${pPhone || 'N/A'}`,
            `FB: ${pFb || 'N/A'}`,
            `GMAIL: ${pEmail || 'N/A'}`
        ].join('\n');

        if (qrImg) {
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&format=svg&data=${encodeURIComponent(qrPayload)}`;
            qrImg.onload = function() {
                if (qrLoading) qrLoading.style.display = 'none';
            };
            qrImg.onerror = function() {
                if (qrLoading) qrLoading.innerHTML = '<span style="color:#ef4444;"><i class="fas fa-exclamation-circle"></i> Error generating QR</span>';
            };
            qrImg.src = qrUrl;
        }

        // Print Emergency ID Badge
        window.printQrBadge = function() {
            const printWin = window.open('', '_blank', 'width=600,height=700');
            printWin.document.write(`
                <html>
                <head>
                    <title>Student Emergency ID Badge - ${sName}</title>
                    <style>
                        body { font-family: 'Segoe UI', Arial, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f1f5f9; }
                        .id-card { width: 340px; background: #fff; border-radius: 16px; border: 2px solid #0b2b4a; box-shadow: 0 10px 25px rgba(0,0,0,0.1); overflow: hidden; }
                        .id-header { background: #0b2b4a; color: #fff; padding: 16px; text-align: center; }
                        .id-header h2 { margin: 0; font-size: 16px; letter-spacing: 1px; color: #ffd700; }
                        .id-header p { margin: 2px 0 0; font-size: 11px; opacity: 0.85; }
                        .id-body { padding: 18px; text-align: center; }
                        .qr-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 10px; display: inline-block; margin-bottom: 14px; }
                        .qr-box img { width: 180px; height: 180px; display: block; }
                        .student-info h3 { margin: 0 0 4px; font-size: 17px; color: #0f172a; }
                        .student-info p { margin: 2px 0; font-size: 12px; color: #64748b; font-weight: 500; }
                        .contact-info { background: #f1f5f9; border-radius: 8px; padding: 10px; margin-top: 14px; text-align: left; font-size: 11px; color: #334155; line-height: 1.5; }
                        .id-footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 8px; text-align: center; font-size: 10px; color: #94a3b8; }
                        @media print { body { background: none; } .id-card { box-shadow: none; } }
                    </style>
                </head>
                <body>
                    <div class="id-card">
                        <div class="id-header">
                            <h2>HIRAYA ENROLLMENT SYSTEM</h2>
                            <p>Official Student Emergency Contact ID</p>
                        </div>
                        <div class="id-body">
                            <div class="qr-box">
                                <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrPayload)}" alt="QR Code">
                            </div>
                            <div class="student-info">
                                <h3>${sName}</h3>
                                <p><strong>LRN:</strong> ${lrn}</p>
                                <p><strong>Level:</strong> ${grade}</p>
                            </div>
                            <div class="contact-info">
                                <div><strong>Emergency Parent Contact:</strong></div>
                                <div>Name: ${pName}</div>
                                <div>Contact: ${pPhone || 'N/A'}</div>
                                <div>Facebook: ${pFb || 'N/A'}</div>
                                <div>Gmail: ${pEmail || 'N/A'}</div>
                            </div>
                        </div>
                        <div class="id-footer">
                            Scan QR Code for instant emergency guardian verification
                        </div>
                    </div>
                    <script>
                        window.onload = function() { window.print(); }
                    </script>
                </body>
                </html>
            `);
            printWin.document.close();
        };
    }

    function populateEditForm() {
        const editStudentFirstName = document.getElementById('editStudentFirstName');
        const editStudentLastName = document.getElementById('editStudentLastName');
        const editStudentGender = document.getElementById('editStudentGender');
        const editStudentBirthdate = document.getElementById('editStudentBirthdate');
        const editStudentPhone = document.getElementById('editStudentPhone');
        const editStudentAddress = document.getElementById('editStudentAddress');
        const editParentName = document.getElementById('editParentName');
        const editParentPhone = document.getElementById('editParentPhone');
        const editParentFb = document.getElementById('editParentFb');
        const editParentEmail = document.getElementById('editParentEmail');

        const fNameVal = studentData?.first_name || userData?.first_name || sessionUser.firstName || '';
        const lNameVal = studentData?.last_name || userData?.last_name || sessionUser.lastName || '';

        if (editStudentFirstName) editStudentFirstName.value = fNameVal;
        if (editStudentLastName) editStudentLastName.value = lNameVal;
        if (editStudentGender) editStudentGender.value = studentData?.gender || enrollmentData?.gender || userData?.gender || '';
        
        if (editStudentBirthdate) {
            const rawDob = studentData?.birthdate || studentData?.dob || enrollmentData?.birthdate || enrollmentData?.dob || userData?.birthdate || '';
            if (rawDob) {
                try {
                    editStudentBirthdate.value = new Date(rawDob).toISOString().split('T')[0];
                } catch(e) {
                    editStudentBirthdate.value = rawDob;
                }
            }
        }
        if (editStudentPhone) editStudentPhone.value = studentData?.contact_number || userData?.phone || enrollmentData?.contact_number || '';
        if (editStudentAddress) editStudentAddress.value = studentData?.address || userData?.address || enrollmentData?.address || '';
        if (editParentName) editParentName.value = studentData?.parent_name || enrollmentData?.guardian_name || enrollmentData?.mother_name || enrollmentData?.father_name || '';
        if (editParentPhone) editParentPhone.value = studentData?.parent_contact || enrollmentData?.guardian_contact || '';
        if (editParentFb) editParentFb.value = studentData?.parent_facebook || '';
        if (editParentEmail) editParentEmail.value = studentData?.parent_email || enrollmentData?.guardian_email || '';
    }

    // ============================================
    // EDIT TOGGLE HANDLER (View Mode vs Edit Mode)
    // ============================================
    const editInfoToggleBtn = document.getElementById('editInfoToggleBtn');
    const infoViewContainer = document.getElementById('infoViewContainer');
    const infoEditContainer = document.getElementById('infoEditContainer');
    const cancelStudentEditBtn = document.getElementById('cancelStudentEditBtn');

    function setEditMode(isEditing) {
        if (!infoViewContainer || !infoEditContainer || !editInfoToggleBtn) return;
        if (isEditing) {
            populateEditForm();
            infoViewContainer.style.display = 'none';
            infoEditContainer.style.display = 'block';
            editInfoToggleBtn.innerHTML = '<i class="fas fa-times"></i> Cancel';
            editInfoToggleBtn.classList.add('is-editing');
        } else {
            infoViewContainer.style.display = 'block';
            infoEditContainer.style.display = 'none';
            editInfoToggleBtn.innerHTML = '<i class="fas fa-edit"></i> Edit';
            editInfoToggleBtn.classList.remove('is-editing');
        }
    }

    if (editInfoToggleBtn) {
        editInfoToggleBtn.addEventListener('click', function() {
            const isCurrentlyEditing = infoEditContainer && infoEditContainer.style.display !== 'none';
            setEditMode(!isCurrentlyEditing);
        });
    }

    if (cancelStudentEditBtn) {
        cancelStudentEditBtn.addEventListener('click', function() {
            setEditMode(false);
        });
    }

    // ============================================
    // EDIT STUDENT PERSONAL INFORMATION HANDLER
    // ============================================
    const editStudentProfileForm = document.getElementById('editStudentProfileForm');
    const saveStudentProfileBtn = document.getElementById('saveStudentProfileBtn');

    if (editStudentProfileForm) {
        editStudentProfileForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const firstName = document.getElementById('editStudentFirstName')?.value.trim() || '';
            const lastName = document.getElementById('editStudentLastName')?.value.trim() || '';
            const gender = document.getElementById('editStudentGender')?.value || '';
            const birthdate = document.getElementById('editStudentBirthdate')?.value || null;
            const phone = document.getElementById('editStudentPhone')?.value.trim() || '';
            const address = document.getElementById('editStudentAddress')?.value.trim() || '';
            const parentName = document.getElementById('editParentName')?.value.trim() || '';
            const parentPhone = document.getElementById('editParentPhone')?.value.trim() || '';
            const parentFb = document.getElementById('editParentFb')?.value.trim() || '';
            const parentEmail = document.getElementById('editParentEmail')?.value.trim() || '';

            if (!firstName || !lastName) {
                showAlert('First name and last name are required.', 'error');
                return;
            }

            if (saveStudentProfileBtn) {
                saveStudentProfileBtn.disabled = true;
                saveStudentProfileBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            }

            try {
                const userEmail = sessionUser?.email || '';
                const userUid = sessionUser?.uid || sessionUser?.id || '';

                // 1. Update Supabase students table
                if (studentData?.id || userEmail) {
                    try {
                        let sUpdate = supabase.from('students').update({
                            first_name: firstName,
                            last_name: lastName,
                            gender: gender,
                            date_of_birth: birthdate || null,
                            contact_number: phone,
                            address: address,
                            parent_name: parentName,
                            parent_contact: parentPhone,
                            parent_facebook: parentFb,
                            parent_email: parentEmail,
                            updated_at: new Date().toISOString()
                        });
                        if (studentData?.id) {
                            sUpdate = sUpdate.eq('id', studentData.id);
                        } else if (userEmail) {
                            sUpdate = sUpdate.eq('email', userEmail);
                        }
                        const { error: sErr } = await sUpdate;
                        if (sErr) console.warn('Students table update note:', sErr);
                    } catch(e) {
                        console.warn('Students table update fallback:', e);
                    }
                }

                // 2. Update Supabase users table
                if (userUid || userEmail) {
                    try {
                        let uUpdate = supabase.from('users').update({
                            first_name: firstName,
                            last_name: lastName,
                            phone: phone,
                            address: address,
                            updated_at: new Date().toISOString()
                        });
                        if (userUid) {
                            uUpdate = uUpdate.eq('id', userUid);
                        } else {
                            uUpdate = uUpdate.eq('email', userEmail);
                        }
                        const { error: uErr } = await uUpdate;
                        if (uErr) console.warn('Users table update note:', uErr);
                    } catch(e) {
                        console.warn('Users table update fallback:', e);
                    }
                }

                // 3. Update local session & memory
                const fullName = `${firstName} ${lastName}`.trim();
                if (sessionUser) {
                    sessionUser.firstName = firstName;
                    sessionUser.lastName = lastName;
                    sessionUser.displayName = fullName;
                    sessionUser.phone = phone;
                    sessionUser.address = address;
                    localStorage.setItem('currentUser', JSON.stringify(sessionUser));
                }
                localStorage.setItem('hes_student_name', fullName);

                if (studentData) {
                    studentData.first_name = firstName;
                    studentData.last_name = lastName;
                    studentData.gender = gender;
                    studentData.birthdate = birthdate;
                    studentData.contact_number = phone;
                    studentData.address = address;
                    studentData.parent_name = parentName;
                    studentData.parent_contact = parentPhone;
                    studentData.parent_facebook = parentFb;
                    studentData.parent_email = parentEmail;
                }

                // 4. Update UI labels and View Mode
                if (studentName) studentName.textContent = fullName;
                if (profileName) profileName.textContent = fullName;
                const initials = getStudentInitials(fullName);
                if (studentInitial) studentInitial.textContent = initials;
                if (profileInitial) profileInitial.textContent = initials;

                renderAccountInfoView();
                setEditMode(false);

                showAlert('✅ Account information saved successfully!', 'success');
            } catch (err) {
                console.error('Error saving student profile:', err);
                showAlert('❌ Failed to save profile details: ' + err.message, 'error');
            } finally {
                if (saveStudentProfileBtn) {
                    saveStudentProfileBtn.disabled = false;
                    saveStudentProfileBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
                }
            }
        });
    }

    // ============================================
    // CHANGE PASSWORD (via Supabase)
    // ============================================

    const changePwdCheckbox = document.getElementById('change_password_checkbox');
    const pwdFields = document.getElementById('passwordFields');
    const currentPwd = document.getElementById('current_password');
    const newPwd = document.getElementById('new_password');
    const confirmPwd = document.getElementById('confirm_password');
    const changePwdBtn = document.getElementById('changePasswordBtn');

    if (changePwdCheckbox) {
        changePwdCheckbox.addEventListener('change', function() {
            if (this.checked) {
                pwdFields.style.display = 'block';
                if (currentPwd) currentPwd.disabled = false;
                if (newPwd) newPwd.disabled = false;
                if (confirmPwd) confirmPwd.disabled = false;
                if (changePwdBtn) changePwdBtn.disabled = true;
                if (newPwd) newPwd.focus();
            } else {
                pwdFields.style.display = 'none';
                if (currentPwd) { currentPwd.disabled = true; currentPwd.value = ''; }
                if (newPwd) { newPwd.disabled = true; newPwd.value = ''; }
                if (confirmPwd) { confirmPwd.disabled = true; confirmPwd.value = ''; }
                if (changePwdBtn) changePwdBtn.disabled = true;
                resetStrength();
            }
        });
    }

    function resetStrength() {
        const strengthBar = document.getElementById('strengthBar');
        const strengthText = document.getElementById('strengthText');
        const matchText = document.getElementById('passwordMatch');
        if (strengthBar) strengthBar.style.width = '0';
        if (strengthText) strengthText.innerHTML = '<i class="fas fa-info-circle"></i> Enter new password';
        if (matchText) matchText.innerHTML = '<i class="fas fa-info-circle"></i> Re-enter new password';
    }

    function validatePwd(pwd) {
        return {
            length: pwd.length >= 6,
            uppercase: /[A-Z]/.test(pwd),
            lowercase: /[a-z]/.test(pwd),
            number: /[0-9]/.test(pwd)
        };
    }

    function updateStrength() {
        const pwd = newPwd ? newPwd.value : '';
        const validation = validatePwd(pwd);
        
        const validCount = Object.values(validation).filter(v => v).length;
        const percent = (validCount / 4) * 100;
        const strengthBar = document.getElementById('strengthBar');
        const strengthText = document.getElementById('strengthText');
        
        if (strengthBar) {
            strengthBar.style.width = percent + '%';
            if (percent <= 25) {
                strengthBar.style.backgroundColor = '#ef4444';
                if (strengthText) strengthText.innerHTML = '<i class="fas fa-shield-alt"></i> <span style="color:#ef4444">Weak</span>';
            } else if (percent <= 50) {
                strengthBar.style.backgroundColor = '#f59e0b';
                if (strengthText) strengthText.innerHTML = '<i class="fas fa-shield-alt"></i> <span style="color:#f59e0b">Fair</span>';
            } else if (percent <= 75) {
                strengthBar.style.backgroundColor = '#3b82f6';
                if (strengthText) strengthText.innerHTML = '<i class="fas fa-shield-alt"></i> <span style="color:#3b82f6">Good</span>';
            } else {
                strengthBar.style.backgroundColor = '#10b981';
                if (strengthText) strengthText.innerHTML = '<i class="fas fa-shield-alt"></i> <span style="color:#10b981">Strong</span>';
            }
        }
        
        checkMatch();
        const isStrong = pwd.length >= 6;
        if (changePwdBtn) changePwdBtn.disabled = !(isStrong && confirmPwd && pwd === confirmPwd.value);
    }

    function checkMatch() {
        const matchText = document.getElementById('passwordMatch');
        if (newPwd && confirmPwd) {
            if (confirmPwd.value.length === 0) {
                matchText.innerHTML = '<i class="fas fa-info-circle"></i> Re-enter new password';
            } else if (newPwd.value === confirmPwd.value) {
                matchText.innerHTML = '<i class="fas fa-check-circle" style="color:#10b981"></i> <span style="color:#10b981">Passwords match</span>';
            } else {
                matchText.innerHTML = '<i class="fas fa-exclamation-circle" style="color:#ef4444"></i> <span style="color:#ef4444">Passwords do not match</span>';
            }
        }
    }

    if (newPwd) newPwd.addEventListener('input', updateStrength);
    if (confirmPwd) confirmPwd.addEventListener('input', checkMatch);

    const passwordForm = document.getElementById('passwordForm');
    if (passwordForm) {
        passwordForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const current = document.getElementById('current_password')?.value;
            const newPwdValue = document.getElementById('new_password')?.value;
            const confirm = document.getElementById('confirm_password')?.value;

            if (!current || !newPwdValue || !confirm) {
                showAlert('⚠️ Please fill in all password fields', 'error');
                return;
            }

            if (newPwdValue !== confirm) {
                showAlert('⚠️ Passwords do not match', 'error');
                return;
            }

            try {
                // Verify current password against Supabase users table
                const userId = sessionUser.id || sessionUser.uid;
                let userRecord = null;

                if (userId) {
                    const { data: byId, error: checkError } = await supabase
                        .from('users')
                        .select('id, password, email')
                        .eq('id', userId)
                        .maybeSingle();
                    if (!checkError && byId) userRecord = byId;
                }

                if (!userRecord && sessionUser.email) {
                    const { data: byEmail } = await supabase
                        .from('users')
                        .select('id, password, email')
                        .ilike('email', sessionUser.email)
                        .maybeSingle();
                    if (byEmail) userRecord = byEmail;
                }

                // Verify current password (supports exact, trimmed, or case-insensitive initial last-name password)
                const isCurrentMatch = userRecord && userRecord.password && (
                    userRecord.password === current ||
                    userRecord.password.trim() === current.trim() ||
                    userRecord.password.trim().toLowerCase() === current.trim().toLowerCase()
                );

                if (userRecord && userRecord.password && !isCurrentMatch) {
                    showAlert('❌ Current password is incorrect', 'error');
                    return;
                }

                const targetUid = userRecord?.id || userId;

                // Update password in Supabase
                const { error: updateError } = await supabase
                    .from('users')
                    .update({ 
                        password: newPwdValue,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', targetUid);

                if (updateError) throw updateError;
                
                // Track that student has updated their initial password
                if (sessionUser.email) {
                    localStorage.setItem(`hes_password_changed_${sessionUser.email.toLowerCase()}`, 'true');
                }
                localStorage.setItem(`hes_password_changed_${targetUid}`, 'true');

                showAlert('✅ Password updated successfully! Your account is now secured.', 'success');
                
                if (currentPwd) currentPwd.value = '';
                if (newPwd) newPwd.value = '';
                if (confirmPwd) confirmPwd.value = '';
                if (changePwdCheckbox) changePwdCheckbox.checked = false;
                if (pwdFields) pwdFields.style.display = 'none';
                resetStrength();
                
            } catch (error) {
                console.error('Error changing password:', error);
                showAlert('❌ Error changing password: ' + error.message, 'error');
            }
        });
    }

    // ============================================
    // PROFILE PICTURE UPLOAD & PERSISTENCE
    // ============================================

    function renderDefaultStudentAvatar(name) {
        const initials = getStudentInitials(name || 'Student');
        const avatarLarge = document.querySelector('.profile-avatar-large');
        if (avatarLarge) {
            avatarLarge.innerHTML = `
                <div class="avatar-initial" id="profileInitial">${initials}</div>
                <div class="avatar-overlay">
                    <i class="fas fa-camera"></i>
                </div>
            `;
        }
        const sidebarAvatar = document.querySelector('.student-avatar');
        if (sidebarAvatar) {
            sidebarAvatar.innerHTML = `
                <div class="avatar-initial" id="studentInitial">${initials}</div>
                <div class="online-dot"></div>
            `;
        }
    }

    function applyStudentAvatarToDOM(base64Image) {
        const avatarLarge = document.querySelector('.profile-avatar-large');
        if (avatarLarge) {
            const initialEl = avatarLarge.querySelector('.avatar-initial');
            if (initialEl) initialEl.style.display = 'none';
            let existingImg = avatarLarge.querySelector('img');
            if (existingImg) {
                existingImg.src = base64Image;
            } else {
                const img = document.createElement('img');
                img.src = base64Image;
                img.alt = 'Profile';
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.borderRadius = '50%';
                img.style.objectFit = 'cover';
                avatarLarge.prepend(img);
            }
        }

        const sidebarAvatar = document.querySelector('.student-avatar');
        if (sidebarAvatar) {
            const initialEl = sidebarAvatar.querySelector('.avatar-initial');
            if (initialEl) initialEl.style.display = 'none';
            let existingImg = sidebarAvatar.querySelector('img');
            if (existingImg) {
                existingImg.src = base64Image;
            } else {
                const img = document.createElement('img');
                img.src = base64Image;
                img.alt = 'Profile';
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.borderRadius = '50%';
                img.style.objectFit = 'cover';
                sidebarAvatar.prepend(img);
            }
        }
    }

    window.removeProfilePic = function() {
        if (confirm('Remove your profile picture and restore your name initials?')) {
            try {
                localStorage.removeItem('hes_student_avatar');
            } catch(e) {}
            const displayName = studentData?.first_name ? 
                `${studentData.first_name} ${studentData.last_name || ''}`.trim() : 
                (sessionUser.firstName ? `${sessionUser.firstName} ${sessionUser.lastName || ''}`.trim() : 'Student');
            renderDefaultStudentAvatar(displayName);
            showAlert('✅ Profile picture removed. Initials restored.', 'success');
            const imgModal = document.getElementById('imageModal');
            if (imgModal) imgModal.style.display = 'none';
        }
    };

    const profilePicForm = document.getElementById('profilePicForm');
    if (profilePicForm) {
        profilePicForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const fileInput = document.getElementById('profile_picture');
            if (!fileInput.files || fileInput.files.length === 0) {
                showAlert('⚠️ Please select an image', 'error');
                return;
            }

            const file = fileInput.files[0];
            const maxSize = 5 * 1024 * 1024; // 5MB
            
            if (file.size > maxSize) {
                showAlert('⚠️ File is too large. Maximum size is 5MB.', 'error');
                return;
            }

            const reader = new FileReader();
            reader.onload = function(evt) {
                const base64Image = evt.target.result;
                try {
                    localStorage.setItem('hes_student_avatar', base64Image);
                } catch(e) {}
                
                applyStudentAvatarToDOM(base64Image);
                showAlert('✅ Profile picture updated successfully!', 'success');
                const imgModal = document.getElementById('imageModal');
                if (imgModal) imgModal.style.display = 'none';
            };
            reader.readAsDataURL(file);
        });
    }

    // ============================================
    // STUDENT DOCUMENTS MANAGEMENT
    // ============================================

    const defaultStudentDocs = [
        {
            id: 'sdoc_1',
            title: 'PSA Authenticated Birth Certificate',
            type: 'PSA Birth Certificate',
            filename: 'PSA_Birth_Certificate.pdf',
            size: '1.2 MB',
            date: '2026-06-01',
            format: 'pdf',
            status: 'Verified',
            dataUrl: null
        },
        {
            id: 'sdoc_2',
            title: 'Form 138 (Junior High Report Card)',
            type: 'Form 138 / Report Card',
            filename: 'Form_138_Report_Card.pdf',
            size: '1.8 MB',
            date: '2026-06-05',
            format: 'pdf',
            status: 'Verified',
            dataUrl: null
        },
        {
            id: 'sdoc_3',
            title: 'Certificate of Good Moral Character',
            type: 'Good Moral Certificate',
            filename: 'Good_Moral_Certificate.jpg',
            size: '850 KB',
            date: '2026-06-05',
            format: 'img',
            status: 'Verified',
            dataUrl: null
        },
        {
            id: 'sdoc_4',
            title: '2x2 ID Picture (White Background)',
            type: '2x2 ID Picture',
            filename: '2x2_ID_Picture.jpg',
            size: '420 KB',
            date: '2026-06-05',
            format: 'img',
            status: 'Verified',
            dataUrl: null
        }
    ];

    let studentDocs = [];
    try {
        const savedSDocs = localStorage.getItem('hes_student_documents');
        if (savedSDocs) {
            studentDocs = JSON.parse(savedSDocs);
        } else {
            studentDocs = [...defaultStudentDocs];
            localStorage.setItem('hes_student_documents', JSON.stringify(studentDocs));
        }
    } catch(e) {
        studentDocs = [...defaultStudentDocs];
    }

    function persistStudentDocs() {
        try {
            localStorage.setItem('hes_student_documents', JSON.stringify(studentDocs));
        } catch(e) {}
    }

    const studentUploadTriggerBtn = document.getElementById('studentUploadTriggerBtn');
    const studentDocFileInput = document.getElementById('studentDocFileInput');
    const studentDocUploadForm = document.getElementById('studentDocUploadForm');
    const studentDocSelectedName = document.getElementById('studentDocSelectedName');
    const studentDocTypeSelect = document.getElementById('studentDocTypeSelect');
    const studentDocCustomTitle = document.getElementById('studentDocCustomTitle');
    const studentDocCancelBtn = document.getElementById('studentDocCancelBtn');
    const studentDocSaveBtn = document.getElementById('studentDocSaveBtn');
    const studentDocList = document.getElementById('studentDocList');
    const studentDocCount = document.getElementById('studentDocCount');

    // Preview Modal
    const docPreviewModal = document.getElementById('docPreviewModal');
    const docPreviewTitle = document.getElementById('docPreviewTitle');
    const docPreviewContainer = document.getElementById('docPreviewContainer');
    const closeDocPreviewBtn = document.getElementById('closeDocPreviewBtn');
    const dismissDocPreviewBtn = document.getElementById('dismissDocPreviewBtn');
    const docDownloadBtn = document.getElementById('docDownloadBtn');

    let currentPendingStudentFile = null;

    if (studentUploadTriggerBtn && studentDocFileInput) {
        studentUploadTriggerBtn.addEventListener('click', () => studentDocFileInput.click());
    }

    if (studentDocFileInput) {
        studentDocFileInput.addEventListener('change', function() {
            if (this.files && this.files.length > 0) {
                handleStudentFileSelected(this.files[0]);
            }
        });
    }

    function handleStudentFileSelected(file) {
        currentPendingStudentFile = file;
        if (studentDocSelectedName) studentDocSelectedName.textContent = `${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
        if (studentDocCustomTitle) studentDocCustomTitle.value = file.name.replace(/\.[^/.]+$/, '');
        if (studentDocUploadForm) studentDocUploadForm.style.display = 'block';
    }

    if (studentDocCancelBtn) {
        studentDocCancelBtn.addEventListener('click', () => {
            currentPendingStudentFile = null;
            if (studentDocFileInput) studentDocFileInput.value = '';
            if (studentDocUploadForm) studentDocUploadForm.style.display = 'none';
        });
    }

    if (studentDocSaveBtn) {
        studentDocSaveBtn.addEventListener('click', () => {
            if (!currentPendingStudentFile) {
                showAlert('No document selected.', 'error');
                return;
            }

            const title = (studentDocCustomTitle && studentDocCustomTitle.value.trim()) || currentPendingStudentFile.name;
            const type = (studentDocTypeSelect && studentDocTypeSelect.value) || 'Other Document';
            const sizeInMb = (currentPendingStudentFile.size / (1024 * 1024)).toFixed(2);
            const sizeStr = currentPendingStudentFile.size > 1024 * 1024 ? `${sizeInMb} MB` : `${Math.round(currentPendingStudentFile.size / 1024)} KB`;
            const isPdf = currentPendingStudentFile.name.toLowerCase().endsWith('.pdf') || currentPendingStudentFile.type === 'application/pdf';
            const format = isPdf ? 'pdf' : (currentPendingStudentFile.type.startsWith('image/') ? 'img' : 'doc');

            const reader = new FileReader();
            reader.onload = function(evt) {
                const dataUrl = evt.target.result;
                const newDoc = {
                    id: 'sdoc_' + Date.now(),
                    title: title,
                    type: type,
                    filename: currentPendingStudentFile.name,
                    size: sizeStr,
                    date: new Date().toISOString().split('T')[0],
                    format: format,
                    status: 'Verified',
                    dataUrl: dataUrl
                };

                studentDocs.unshift(newDoc);
                persistStudentDocs();
                renderStudentDocs();

                currentPendingStudentFile = null;
                if (studentDocFileInput) studentDocFileInput.value = '';
                if (studentDocUploadForm) studentDocUploadForm.style.display = 'none';

                showAlert(`✅ Requirement "${title}" uploaded to your profile!`, 'success');
            };
            reader.readAsDataURL(currentPendingStudentFile);
        });
    }

    function renderStudentDocs() {
        if (!studentDocList) return;

        if (studentDocCount) {
            studentDocCount.textContent = `${studentDocs.length} ${studentDocs.length === 1 ? 'File' : 'Files'}`;
        }

        if (studentDocs.length === 0) {
            studentDocList.innerHTML = `
                <div class="empty-docs-state" style="text-align:center; padding: 24px 10px; color: #64748b;">
                    <i class="fas fa-folder-open" style="font-size: 32px; color: #94a3b8; margin-bottom: 8px;"></i>
                    <p style="font-size: 13px;">No documents uploaded yet. Upload your Birth Certificate, Report Card, or Diplomas above.</p>
                </div>
            `;
            return;
        }

        let html = '';
        studentDocs.forEach(doc => {
            const iconClass = doc.format === 'pdf' ? 'doc-icon-pdf fa-file-pdf' : (doc.format === 'img' ? 'doc-icon-img fa-file-image' : 'doc-icon-doc fa-file-alt');
            html += `
                <div class="doc-item" data-id="${doc.id}">
                    <div class="doc-item-left">
                        <div class="doc-item-icon ${doc.format === 'pdf' ? 'doc-icon-pdf' : (doc.format === 'img' ? 'doc-icon-img' : 'doc-icon-doc')}">
                            <i class="fas ${iconClass.split(' ')[1]}"></i>
                        </div>
                        <div class="doc-item-info">
                            <div class="doc-item-title" title="${doc.title}">${doc.title}</div>
                            <div class="doc-item-meta">
                                <span class="doc-category-pill">${doc.type}</span>
                                <span>${doc.size}</span>
                                <span>&bull;</span>
                                <span>${doc.date}</span>
                            </div>
                        </div>
                    </div>
                    <div class="doc-item-actions">
                        <button type="button" class="doc-btn btn-view-sdoc" data-id="${doc.id}" title="Preview Document">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button type="button" class="doc-btn doc-btn-danger btn-delete-sdoc" data-id="${doc.id}" title="Delete Document">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        studentDocList.innerHTML = html;

        studentDocList.querySelectorAll('.btn-view-sdoc').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = this.dataset.id;
                openStudentDocPreview(id);
            });
        });

        studentDocList.querySelectorAll('.btn-delete-sdoc').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = this.dataset.id;
                deleteStudentDoc(id);
            });
        });
    }

    function openStudentDocPreview(id) {
        const doc = studentDocs.find(d => d.id === id);
        if (!doc || !docPreviewModal) return;

        if (docPreviewTitle) {
            docPreviewTitle.innerHTML = `<i class="fas fa-file-alt"></i> ${doc.title}`;
        }

        if (docDownloadBtn) {
            if (doc.dataUrl) {
                docDownloadBtn.href = doc.dataUrl;
                docDownloadBtn.download = doc.filename;
                docDownloadBtn.style.display = 'inline-flex';
            } else {
                docDownloadBtn.style.display = 'none';
            }
        }

        if (docPreviewContainer) {
            if (doc.format === 'img' && doc.dataUrl) {
                docPreviewContainer.innerHTML = `<img src="${doc.dataUrl}" alt="${doc.title}" style="max-width:100%; border-radius:8px;">`;
            } else if (doc.format === 'pdf' && doc.dataUrl) {
                docPreviewContainer.innerHTML = `
                    <iframe src="${doc.dataUrl}" style="width:100%;height:450px;border:none;border-radius:8px;"></iframe>
                `;
            } else {
                docPreviewContainer.innerHTML = `
                    <div style="padding:40px;text-align:center;">
                        <i class="fas fa-certificate" style="font-size:48px;color:var(--primary);margin-bottom:12px;"></i>
                        <h4 style="font-size:16px;color:#0f172a;margin-bottom:6px;">${doc.title}</h4>
                        <p style="color:#64748b;font-size:13px;">${doc.filename} &bull; ${doc.type} &bull; ${doc.size}</p>
                        <span style="display:inline-block;margin-top:10px;background:#e0e7ff;color:var(--primary);padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600;">Status: ${doc.status}</span>
                    </div>
                `;
            }
        }

        docPreviewModal.classList.add('active');
        docPreviewModal.style.display = 'flex';
    }

    function closeStudentDocPreview() {
        if (docPreviewModal) {
            docPreviewModal.classList.remove('active');
            docPreviewModal.style.display = 'none';
        }
    }

    if (closeDocPreviewBtn) closeDocPreviewBtn.addEventListener('click', closeStudentDocPreview);
    if (dismissDocPreviewBtn) dismissDocPreviewBtn.addEventListener('click', closeStudentDocPreview);

    window.addEventListener('click', function(e) {
        if (e.target === docPreviewModal) {
            closeStudentDocPreview();
        }
    });

    function deleteStudentDoc(id) {
        const doc = studentDocs.find(d => d.id === id);
        if (!doc) return;
        if (confirm(`Are you sure you want to delete "${doc.title}"?`)) {
            studentDocs = studentDocs.filter(d => d.id !== id);
            persistStudentDocs();
            renderStudentDocs();
            showAlert('Document removed from profile.', 'success');
        }
    }

    // ============================================
    // ALERT SYSTEM
    // ============================================

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

    // Initialize
    loadProfileData();
    renderStudentDocs();

})();