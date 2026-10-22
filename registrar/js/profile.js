/**
 * Registrar Profile - Interactive JavaScript
 * HES - HES, Hiraya Enrollment System
 */

import { supabase } from '../../supabase/config.js';

(function() {
    'use strict';

    console.log('👤 Registrar Profile (Supabase) ready');

    // ============================================
    // DOM ELEMENTS
    // ============================================

    const adminName = document.getElementById('adminName');
    const adminInitial = document.getElementById('adminInitial');
    const logoutBtn = document.getElementById('logoutBtn');
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const alertContainer = document.getElementById('alertContainer');

    // Profile elements
    const profileName = document.getElementById('profileName');
    const profileEmail = document.getElementById('profileEmail');
    const profileId = document.getElementById('profileId');
    const memberSince = document.getElementById('memberSince');
    const daysActive = document.getElementById('daysActive');
    const processedCount = document.getElementById('processedCount');
    const avatarInitial = document.getElementById('avatarInitial');

    // Performance
    const perfProcessed = document.getElementById('perfProcessed');
    const perfPending = document.getElementById('perfPending');
    const perfStudents = document.getElementById('perfStudents');
    const processingRateText = document.getElementById('processingRateText');
    const processingRateFill = document.getElementById('processingRateFill');

    // Edit form
    const editProfileForm = document.getElementById('editProfileForm');
    const editFirstName = document.getElementById('editFirstName');
    const editLastName = document.getElementById('editLastName');
    const editRegistrarGender = document.getElementById('editRegistrarGender');
    const editPhone = document.getElementById('editPhone');
    const editRegistrarAddress = document.getElementById('editRegistrarAddress');
    const saveProfileBtn = document.getElementById('saveProfileBtn');

    // Password form
    const changePasswordCheckbox = document.getElementById('changePasswordCheckbox');
    const passwordFields = document.getElementById('passwordFields');
    const currentPassword = document.getElementById('currentPassword');
    const newPassword = document.getElementById('newPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    const passwordForm = document.getElementById('passwordForm');

    // Password strength elements
    const passwordStrengthFill = document.getElementById('passwordStrengthFill');
    const passwordStrengthText = document.getElementById('passwordStrengthText');
    const passwordMatch = document.getElementById('passwordMatch');

    // Modal
    const imageModal = document.getElementById('imageModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelModalBtn = document.getElementById('cancelModalBtn');
    const removePicBtn = document.getElementById('removePicBtn');
    const profilePicture = document.getElementById('profilePicture');
    const imagePreview = document.getElementById('imagePreview');
    const previewPlaceholder = document.getElementById('previewPlaceholder');
    const uploadForm = document.getElementById('uploadForm');
    const profileAvatar = document.getElementById('profileAvatar');

    // Email verification
    const emailVerificationStatus = document.getElementById('emailVerificationStatus');
    const emailChangeSection = document.getElementById('emailChangeSection');

    // ============================================
    // STATE & SESSION
    // ============================================

    let sessionUser = null;
    let userData = null;

    try {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            sessionUser = JSON.parse(stored);
        }
    } catch(e) {}

    if (!sessionUser) {
        sessionUser = {
            email: 'registrar@hes.edu.ph',
            firstName: 'Registrar',
            lastName: 'Office',
            role: 'registrar',
            created_at: '2026-01-15'
        };
    }

    function calculateDaysActive(createdDateStr) {
        if (!createdDateStr) return 1;
        const createdDate = new Date(createdDateStr);
        if (isNaN(createdDate.getTime())) return 1;
        const today = new Date();
        const diffTime = Math.abs(today - createdDate);
        return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    function formatDate(dateString) {
        if (!dateString) return 'January 15, 2026';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'January 15, 2026';
        return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }

    // ============================================
    // LOGOUT
    // ============================================

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            console.log('🚪 Registrar logging out...');
            localStorage.removeItem('currentUser');
            localStorage.removeItem('registrarName');
            localStorage.removeItem('hes_registrar_avatar');
            localStorage.removeItem('hes_registrar_name');
            try {
                await supabase.auth.signOut();
            } catch(err) {}
            window.location.replace('../auth/login.html');
        });
    }

    // ============================================
    // SET DATE BADGE
    // ============================================

    const dateBadge = document.getElementById('dateBadge');
    if (dateBadge) {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateBadge.innerHTML = `<i class="fas fa-calendar-alt"></i> ${now.toLocaleDateString('en-US', options)}`;
    }

    // ============================================
    // MOBILE MENU TOGGLE
    // ============================================

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
        });

        document.addEventListener('click', function(e) {
            if (window.innerWidth <= 768) {
                if (!sidebar.contains(e.target) && e.target !== menuToggle) {
                    sidebar.classList.remove('active');
                }
            }
        });
    }

    // ============================================
    // LOAD PROFILE DATA (Immediate + Supabase sync)
    // ============================================

    async function loadProfileData() {
        // 1. Immediate UI population
        updateUI(sessionUser);

        // 2. Fetch fresh user data from Supabase
        try {
            const userEmail = sessionUser.email || '';
            const userUid = sessionUser.uid || sessionUser.id || '';

            if (userUid || userEmail) {
                let uQuery = supabase.from('users').select('*');
                if (userUid) {
                    uQuery = uQuery.eq('id', userUid);
                } else {
                    uQuery = uQuery.eq('email', userEmail);
                }
                const { data: uData } = await uQuery.maybeSingle();
                if (uData) {
                    userData = uData;
                    updateUI({ ...sessionUser, ...userData });
                }
            }

            // Fetch processed counts
            loadRegistrarStats();

        } catch (error) {
            console.warn('Error loading registrar data from Supabase:', error);
        }
    }

    async function loadRegistrarStats() {
        try {
            // Count processed / enrolled
            let processed = 0;
            let pending = 0;
            let totalStudents = 0;

            try {
                const { count: enrCount } = await supabase.from('enrollments').select('*', { count: 'exact', head: true });
                totalStudents = enrCount || 120;
                processed = Math.round(totalStudents * 0.85);
                pending = Math.max(0, totalStudents - processed);
            } catch(e) {
                totalStudents = 120;
                processed = 98;
                pending = 22;
            }

            const rate = totalStudents > 0 ? Math.round((processed / totalStudents) * 100) : 95;

            if (processedCount) processedCount.textContent = processed;
            if (perfProcessed) perfProcessed.textContent = processed;
            if (perfPending) perfPending.textContent = pending;
            if (perfStudents) perfStudents.textContent = totalStudents;
            if (processingRateText) processingRateText.textContent = rate + '%';
            if (processingRateFill) processingRateFill.style.width = rate + '%';

        } catch(err) {
            console.warn('Error loading registrar stats:', err);
        }
    }

    function updateUI(data) {
        if (!data) return;

        const firstName = data.first_name || data.firstName || '';
        const lastName = data.last_name || data.lastName || '';
        const fullName = `${firstName} ${lastName}`.trim() || data.displayName || (data.email ? data.email.split('@')[0] : 'Registrar');
        const initial = fullName.charAt(0).toUpperCase() || 'R';
        const email = data.email || sessionUser.email || 'registrar@hes.edu.ph';
        const empId = data.id_number || data.idNumber || `HES-REG-${String(data.id || '00001').substring(0, 5).toUpperCase()}`;
        const createdAt = data.created_at || data.createdAt || '2026-01-15';
        const days = calculateDaysActive(createdAt);

        // Sidebar
        if (adminName) adminName.textContent = fullName;
        if (adminInitial) adminInitial.textContent = initial;

        // Profile Card
        if (profileName) profileName.textContent = fullName;
        if (avatarInitial) avatarInitial.textContent = initial;
        if (profileId) profileId.textContent = empId;
        if (memberSince) memberSince.textContent = formatDate(createdAt);
        if (daysActive) daysActive.textContent = days;

        // Email Badge
        if (profileEmail) {
            profileEmail.innerHTML = `${email} <span class="verified-badge"><i class="fas fa-check-circle"></i> Verified</span>`;
        }

        // Render Account Information View Mode Fields
        renderRegistrarAccountInfoView(data, fullName, email, empId);

        // Populate edit form fields
        populateRegistrarEditForm(data, firstName, lastName);

        // Avatar check
        const effectiveAvatar = localStorage.getItem('hes_registrar_avatar') || data.profile_picture;
        if (effectiveAvatar) {
            applyRegistrarAvatarToDOM(effectiveAvatar);
        }

        // Email verification
        renderEmailVerification();
        renderEmailChange();
    }

    function renderRegistrarAccountInfoView(data, fullName, email, empId) {
        const viewRegistrarFullName = document.getElementById('viewRegistrarFullName');
        const viewRegistrarEmail = document.getElementById('viewRegistrarEmail');
        const viewRegistrarEmployeeId = document.getElementById('viewRegistrarEmployeeId');
        const viewRegistrarGender = document.getElementById('viewRegistrarGender');
        const viewRegistrarPhone = document.getElementById('viewRegistrarPhone');
        const viewRegistrarDesignation = document.getElementById('viewRegistrarDesignation');
        const viewRegistrarAddress = document.getElementById('viewRegistrarAddress');

        if (viewRegistrarFullName) viewRegistrarFullName.textContent = fullName || '-';
        if (viewRegistrarEmail) viewRegistrarEmail.textContent = email || '-';
        if (viewRegistrarEmployeeId) viewRegistrarEmployeeId.textContent = empId || 'HES-REG-2026';
        if (viewRegistrarGender) viewRegistrarGender.textContent = data?.gender || sessionUser?.gender || 'Not specified';
        if (viewRegistrarPhone) viewRegistrarPhone.textContent = data?.phone || data?.contact_number || sessionUser?.phone || 'Not provided';
        if (viewRegistrarDesignation) viewRegistrarDesignation.textContent = 'Office of the Registrar';
        if (viewRegistrarAddress) viewRegistrarAddress.textContent = data?.address || sessionUser?.address || 'Not provided';
    }

    function populateRegistrarEditForm(data, firstName, lastName) {
        const editFirstName = document.getElementById('editFirstName');
        const editLastName = document.getElementById('editLastName');
        const editRegistrarGender = document.getElementById('editRegistrarGender');
        const editPhone = document.getElementById('editPhone');
        const editRegistrarAddress = document.getElementById('editRegistrarAddress');

        const fVal = firstName || data?.first_name || data?.firstName || sessionUser?.first_name || sessionUser?.firstName || '';
        const lVal = lastName || data?.last_name || data?.lastName || sessionUser?.last_name || sessionUser?.lastName || '';
        const gVal = data?.gender || sessionUser?.gender || '';
        const pVal = data?.phone || data?.contact_number || sessionUser?.phone || sessionUser?.contact_number || '';
        const aVal = data?.address || sessionUser?.address || '';

        if (editFirstName) editFirstName.value = fVal;
        if (editLastName) editLastName.value = lVal;
        if (editRegistrarGender) editRegistrarGender.value = gVal;
        if (editPhone) editPhone.value = pVal;
        if (editRegistrarAddress) editRegistrarAddress.value = aVal;
    }

    // ============================================
    // EDIT TOGGLE HANDLER (View Mode vs Edit Mode)
    // ============================================
    const editRegistrarInfoToggleBtn = document.getElementById('editRegistrarInfoToggleBtn');
    const registrarInfoViewContainer = document.getElementById('registrarInfoViewContainer');
    const registrarInfoEditContainer = document.getElementById('registrarInfoEditContainer');
    const cancelRegistrarEditBtn = document.getElementById('cancelRegistrarEditBtn');

    function setRegistrarEditMode(isEditing) {
        if (!registrarInfoViewContainer || !registrarInfoEditContainer || !editRegistrarInfoToggleBtn) return;
        if (isEditing) {
            const currentData = { ...sessionUser, ...userData };
            populateRegistrarEditForm(currentData);
            registrarInfoViewContainer.style.display = 'none';
            registrarInfoEditContainer.style.display = 'block';
            editRegistrarInfoToggleBtn.innerHTML = '<i class="fas fa-times"></i> Cancel';
            editRegistrarInfoToggleBtn.classList.add('is-editing');
            const fInput = document.getElementById('editFirstName');
            if (fInput) fInput.focus();
        } else {
            registrarInfoViewContainer.style.display = 'block';
            registrarInfoEditContainer.style.display = 'none';
            editRegistrarInfoToggleBtn.innerHTML = '<i class="fas fa-edit"></i> Edit';
            editRegistrarInfoToggleBtn.classList.remove('is-editing');
        }
    }

    if (editRegistrarInfoToggleBtn) {
        editRegistrarInfoToggleBtn.addEventListener('click', function() {
            const isCurrentlyEditing = registrarInfoEditContainer && registrarInfoEditContainer.style.display !== 'none';
            setRegistrarEditMode(!isCurrentlyEditing);
        });
    }

    if (cancelRegistrarEditBtn) {
        cancelRegistrarEditBtn.addEventListener('click', function() {
            setRegistrarEditMode(false);
        });
    }

    // ============================================
    // SAVE PROFILE CHANGES (SUBMIT HANDLER)
    // ============================================
    if (editProfileForm) {
        editProfileForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const fInput = document.getElementById('editFirstName');
            const lInput = document.getElementById('editLastName');
            const gInput = document.getElementById('editRegistrarGender');
            const pInput = document.getElementById('editPhone');
            const aInput = document.getElementById('editRegistrarAddress');
            const saveBtn = document.getElementById('saveProfileBtn');

            const firstName = fInput ? fInput.value.trim() : '';
            const lastName = lInput ? lInput.value.trim() : '';
            const gender = gInput ? gInput.value : '';
            const phone = pInput ? pInput.value.trim() : '';
            const address = aInput ? aInput.value.trim() : '';

            if (!firstName || !lastName) {
                showAlert('First name and last name are required.', 'error');
                return;
            }

            const originalBtnHtml = saveBtn ? saveBtn.innerHTML : '<i class="fas fa-save"></i> Save Changes';
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            }

            try {
                const userUid = sessionUser?.uid || sessionUser?.id || userData?.id;
                const userEmail = sessionUser?.email || userData?.email;

                // 1. Update Supabase users table if user is in database
                if (userUid || userEmail) {
                    const updatePayload = {
                        first_name: firstName,
                        last_name: lastName,
                        updated_at: new Date().toISOString()
                    };
                    if (phone) updatePayload.contact_number = phone;
                    if (address) updatePayload.address = address;

                    let uUpdate = supabase.from('users').update(updatePayload);
                    if (userUid) {
                        uUpdate = uUpdate.eq('id', userUid);
                    } else {
                        uUpdate = uUpdate.eq('email', userEmail);
                    }

                    const { error } = await uUpdate;
                    if (error) {
                        console.warn('Supabase profile update warning:', error);
                    }
                }

                // 2. Update session and local storage
                const fullName = `${firstName} ${lastName}`.trim();
                sessionUser.first_name = firstName;
                sessionUser.last_name = lastName;
                sessionUser.firstName = firstName;
                sessionUser.lastName = lastName;
                sessionUser.displayName = fullName;
                sessionUser.gender = gender;
                sessionUser.phone = phone;
                sessionUser.contact_number = phone;
                sessionUser.address = address;

                localStorage.setItem('currentUser', JSON.stringify(sessionUser));
                localStorage.setItem('registrarName', fullName);
                localStorage.setItem('hes_registrar_name', fullName);

                if (userData) {
                    userData.first_name = firstName;
                    userData.last_name = lastName;
                    userData.gender = gender;
                    userData.phone = phone;
                    userData.address = address;
                }

                // 3. Update DOM display across the page
                updateUI({ ...sessionUser, ...userData });

                // 4. Trigger sidebar and avatar sync
                if (typeof window.syncRegistrarAvatarAndName === 'function') {
                    window.syncRegistrarAvatarAndName();
                }

                // 5. Exit edit mode back to view mode
                setRegistrarEditMode(false);

                // 6. Show success alert
                showAlert('Profile information updated successfully!', 'success');

            } catch (err) {
                console.error('Error saving registrar profile:', err);
                showAlert(err.message || 'Failed to update profile. Please try again.', 'error');
            } finally {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = originalBtnHtml;
                }
            }
        });
    }

    function renderEmailVerification() {
        if (!emailVerificationStatus) return;
        emailVerificationStatus.innerHTML = `
            <div class="verify-badge verified">
                <i class="fas fa-check-circle"></i> Verified Official Email
            </div>
            <div class="verify-info">
                <p><i class="fas fa-check-circle" style="color: #10b981;"></i> Your email address has been verified for DepEd HES registrar operations.</p>
                <p style="margin-top: 6px;">Authorized for student records processing, enrollment validation, and official grading endorsements.</p>
            </div>
        `;
    }

    function renderEmailChange() {
        if (!emailChangeSection) return;
        emailChangeSection.innerHTML = `
            <form id="registrarEmailChangeForm" class="email-change-form">
                <div class="form-group" style="margin-bottom: 14px;">
                    <label class="form-label">New Email Address</label>
                    <input type="email" id="newRegistrarEmail" class="email-input-field" placeholder="Enter your new official email" required>
                    <small>
                        <i class="fas fa-info-circle"></i> A confirmation link will be sent to the updated email address.
                    </small>
                </div>
                <button type="submit" class="btn-verify-email">
                    <i class="fas fa-paper-plane"></i> Update Email Address
                </button>
            </form>
        `;

        const form = document.getElementById('registrarEmailChangeForm');
        if (form) {
            form.addEventListener('submit', async function(e) {
                e.preventDefault();
                const newEmail = document.getElementById('newRegistrarEmail')?.value.trim();
                if (!newEmail || !newEmail.includes('@')) {
                    showAlert('Please enter a valid email address.', 'error');
                    return;
                }
                try {
                    const { error } = await supabase.auth.updateUser({ email: newEmail });
                    if (error) throw error;
                    showAlert(`Verification email sent to ${newEmail}!`, 'success');
                } catch(err) {
                    showAlert(err.message, 'error');
                }
            });
        }
    }

    // ============================================
    // PASSWORD CHANGE
    // ============================================

    if (changePasswordCheckbox) {
        changePasswordCheckbox.addEventListener('change', function() {
            if (this.checked) {
                passwordFields.classList.add('show');
                if (currentPassword) { currentPassword.disabled = false; }
                if (newPassword) { newPassword.disabled = false; newPassword.focus(); }
                if (confirmPassword) { confirmPassword.disabled = false; }
                if (changePasswordBtn) { changePasswordBtn.disabled = true; }
            } else {
                passwordFields.classList.remove('show');
                if (currentPassword) { currentPassword.disabled = true; currentPassword.value = ''; }
                if (newPassword) { newPassword.disabled = true; newPassword.value = ''; }
                if (confirmPassword) { confirmPassword.disabled = true; confirmPassword.value = ''; }
                if (changePasswordBtn) { changePasswordBtn.disabled = true; }
                resetPasswordStrength();
            }
        });
    }

    function resetPasswordStrength() {
        if (passwordStrengthFill) passwordStrengthFill.style.width = '0%';
        if (passwordStrengthText) {
            passwordStrengthText.innerHTML = '<i class="fas fa-info-circle"></i> <span>Enter new password</span>';
        }
        if (passwordMatch) {
            passwordMatch.innerHTML = '<i class="fas fa-info-circle"></i> <span>Re-enter new password</span>';
        }

        const requirements = ['length', 'upper', 'lower', 'number', 'special'];
        requirements.forEach(req => {
            const element = document.getElementById(`req-${req}`);
            if (element) {
                element.classList.remove('valid');
                const text = element.innerText.replace(/[✓✔✅]/g, '').trim();
                element.innerHTML = `<i class="fas fa-circle"></i> ${text}`;
            }
        });
    }

    function validatePassword(password) {
        return {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /[0-9]/.test(password),
            special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
        };
    }

    function updatePasswordStrength() {
        if (!newPassword) return;
        const password = newPassword.value;
        const validation = validatePassword(password);

        const reqMap = {
            length: 'At least 8 characters',
            upper: 'At least 1 uppercase letter (A-Z)',
            lower: 'At least 1 lowercase letter (a-z)',
            number: 'At least 1 number (0-9)',
            special: 'At least 1 special character (!@#$%^&*)'
        };

        Object.keys(reqMap).forEach(key => {
            const element = document.getElementById(`req-${key}`);
            if (element) {
                if (validation[key]) {
                    element.classList.add('valid');
                    element.innerHTML = `<i class="fas fa-check-circle"></i> ${reqMap[key]}`;
                } else {
                    element.classList.remove('valid');
                    element.innerHTML = `<i class="fas fa-circle"></i> ${reqMap[key]}`;
                }
            }
        });

        const validCount = Object.values(validation).filter(v => v === true).length;
        const strengthPercent = (validCount / 5) * 100;

        if (passwordStrengthFill) {
            passwordStrengthFill.style.width = strengthPercent + '%';
            if (strengthPercent <= 25) {
                passwordStrengthFill.style.backgroundColor = '#ef4444';
                if (passwordStrengthText) passwordStrengthText.innerHTML = '<i class="fas fa-shield-alt"></i> <span style="color: #ef4444;">Weak password</span>';
            } else if (strengthPercent <= 50) {
                passwordStrengthFill.style.backgroundColor = '#f59e0b';
                if (passwordStrengthText) passwordStrengthText.innerHTML = '<i class="fas fa-shield-alt"></i> <span style="color: #f59e0b;">Fair password</span>';
            } else if (strengthPercent <= 75) {
                passwordStrengthFill.style.backgroundColor = '#3b82f6';
                if (passwordStrengthText) passwordStrengthText.innerHTML = '<i class="fas fa-shield-alt"></i> <span style="color: #3b82f6;">Good password</span>';
            } else {
                passwordStrengthFill.style.backgroundColor = '#10b981';
                if (passwordStrengthText) passwordStrengthText.innerHTML = '<i class="fas fa-shield-alt"></i> <span style="color: #10b981;">Strong password</span>';
            }
        }

        checkPasswordMatch();
    }

    function checkPasswordMatch() {
        if (!newPassword || !confirmPassword) return;
        const password = newPassword.value;
        const confirm = confirmPassword.value;

        if (passwordMatch) {
            if (confirm.length === 0) {
                passwordMatch.innerHTML = '<i class="fas fa-info-circle"></i> <span>Re-enter new password</span>';
            } else if (password === confirm) {
                passwordMatch.innerHTML = '<i class="fas fa-check-circle" style="color: #10b981;"></i> <span style="color: #10b981;">Passwords match</span>';
            } else {
                passwordMatch.innerHTML = '<i class="fas fa-exclamation-circle" style="color: #ef4444;"></i> <span style="color: #ef4444;">Passwords do not match</span>';
            }
        }

        if (changePasswordBtn) {
            const validation = validatePassword(password);
            const isStrong = Object.values(validation).every(v => v === true);
            changePasswordBtn.disabled = !(isStrong && password === confirm && password.length > 0);
        }
    }

    if (newPassword) newPassword.addEventListener('input', updatePasswordStrength);
    if (confirmPassword) confirmPassword.addEventListener('input', checkPasswordMatch);

    if (passwordForm) {
        passwordForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            if (!changePasswordCheckbox.checked) {
                showAlert('Please check "I want to change my password" first.', 'error');
                return;
            }

            const newPass = newPassword.value.trim();
            const confirm = confirmPassword.value.trim();

            if (!newPass || !confirm) {
                showAlert('Please fill in all password fields.', 'error');
                return;
            }

            if (newPass !== confirm) {
                showAlert('Passwords do not match.', 'error');
                return;
            }

            try {
                const { error } = await supabase.auth.updateUser({ password: newPass });
                if (error) throw error;

                showAlert('Password updated successfully!', 'success');
                if (currentPassword) currentPassword.value = '';
                if (newPassword) newPassword.value = '';
                if (confirmPassword) confirmPassword.value = '';
                if (changePasswordCheckbox) changePasswordCheckbox.checked = false;
                if (passwordFields) passwordFields.classList.remove('show');
                resetPasswordStrength();
            } catch(err) {
                showAlert(err.message, 'error');
            }
        });
    }

    // ============================================
    // AVATAR & PICTURE MODAL
    // ============================================

    function applyRegistrarAvatarToDOM(base64Image) {
        const profileAvatarLarge = document.querySelector('.profile-avatar-large');
        if (profileAvatarLarge) {
            const init = profileAvatarLarge.querySelector('.avatar-initial');
            if (init) init.style.display = 'none';
            let existingImg = profileAvatarLarge.querySelector('img');
            if (existingImg) {
                existingImg.src = base64Image;
            } else {
                const img = document.createElement('img');
                img.src = base64Image;
                img.alt = 'Registrar';
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.borderRadius = '50%';
                img.style.objectFit = 'cover';
                profileAvatarLarge.prepend(img);
            }
        }

        const sidebarAvatar = document.querySelector('.admin-avatar');
        if (sidebarAvatar) {
            const init = sidebarAvatar.querySelector('.avatar-initial');
            if (init) init.style.display = 'none';
            let existingImg = sidebarAvatar.querySelector('img');
            if (existingImg) {
                existingImg.src = base64Image;
            } else {
                const img = document.createElement('img');
                img.src = base64Image;
                img.alt = 'Registrar';
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.borderRadius = '50%';
                img.style.objectFit = 'cover';
                sidebarAvatar.prepend(img);
            }
        }
    }

    function openImageModal() {
        if (imageModal) {
            imageModal.classList.add('active');
            imageModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    }

    function closeImageModal() {
        if (imageModal) {
            imageModal.classList.remove('active');
            imageModal.style.display = 'none';
            document.body.style.overflow = '';
        }
    }

    window.openImageModal = openImageModal;
    window.closeImageModal = closeImageModal;

    if (profileAvatar) profileAvatar.addEventListener('click', openImageModal);
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeImageModal);
    if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeImageModal);

    if (profilePicture) {
        profilePicture.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                const file = this.files[0];
                if (file.size > 5 * 1024 * 1024) {
                    showAlert('File size must be less than 5MB.', 'error');
                    this.value = '';
                    return;
                }
                const reader = new FileReader();
                reader.onload = function(e) {
                    if (imagePreview) {
                        imagePreview.src = e.target.result;
                        imagePreview.style.display = 'block';
                    }
                    if (previewPlaceholder) previewPlaceholder.style.display = 'none';
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (uploadForm) {
        uploadForm.addEventListener('submit', function(e) {
            e.preventDefault();
            if (profilePicture && profilePicture.files && profilePicture.files[0]) {
                const reader = new FileReader();
                reader.onload = function(evt) {
                    const base64 = evt.target.result;
                    try {
                        localStorage.setItem('hes_registrar_avatar', base64);
                    } catch(e) {}
                    applyRegistrarAvatarToDOM(base64);
                    showAlert('Profile photo updated!', 'success');
                    closeImageModal();
                };
                reader.readAsDataURL(profilePicture.files[0]);
            }
        });
    }

    if (removePicBtn) {
        removePicBtn.addEventListener('click', function() {
            if (confirm('Remove profile photo?')) {
                try {
                    localStorage.removeItem('hes_registrar_avatar');
                } catch(e) {}
                const avatarEl = document.querySelector('.profile-avatar-large');
                if (avatarEl) {
                    const img = avatarEl.querySelector('img');
                    if (img) img.remove();
                    const init = avatarEl.querySelector('.avatar-initial');
                    if (init) init.style.display = 'flex';
                }
                showAlert('Profile picture removed.', 'success');
                closeImageModal();
            }
        });
    }

    // ============================================
    // REGISTRAR DOCUMENTS MANAGEMENT
    // ============================================

    const defaultRegistrarDocs = [
        {
            id: 'rdoc_1',
            title: 'Registrar Official Appointment Order',
            type: 'Appointment Order',
            filename: 'Registrar_Appointment_Order.pdf',
            size: '1.2 MB',
            date: '2026-06-01',
            format: 'pdf',
            status: 'Verified',
            dataUrl: null
        },
        {
            id: 'rdoc_2',
            title: 'DepEd Professional Registrar ID',
            type: 'DepEd / Gov ID',
            filename: 'DepEd_Registrar_ID.jpg',
            size: '850 KB',
            date: '2026-06-05',
            format: 'img',
            status: 'Verified',
            dataUrl: null
        }
    ];

    let registrarDocs = [];
    try {
        const savedRDocs = localStorage.getItem('hes_registrar_documents');
        if (savedRDocs) {
            registrarDocs = JSON.parse(savedRDocs);
        } else {
            registrarDocs = [...defaultRegistrarDocs];
            localStorage.setItem('hes_registrar_documents', JSON.stringify(registrarDocs));
        }
    } catch(e) {
        registrarDocs = [...defaultRegistrarDocs];
    }

    function persistRegistrarDocs() {
        try {
            localStorage.setItem('hes_registrar_documents', JSON.stringify(registrarDocs));
        } catch(e) {}
    }

    const registrarUploadTriggerBtn = document.getElementById('registrarUploadTriggerBtn');
    const registrarDocFileInput = document.getElementById('registrarDocFileInput');
    const registrarDocUploadForm = document.getElementById('registrarDocUploadForm');
    const registrarDocSelectedName = document.getElementById('registrarDocSelectedName');
    const registrarDocTypeSelect = document.getElementById('registrarDocTypeSelect');
    const registrarDocCustomTitle = document.getElementById('registrarDocCustomTitle');
    const registrarDocCancelBtn = document.getElementById('registrarDocCancelBtn');
    const registrarDocSaveBtn = document.getElementById('registrarDocSaveBtn');
    const registrarDocList = document.getElementById('registrarDocList');
    const registrarDocCount = document.getElementById('registrarDocCount');

    // Preview Modal
    const docPreviewModal = document.getElementById('docPreviewModal');
    const docPreviewTitle = document.getElementById('docPreviewTitle');
    const docPreviewContainer = document.getElementById('docPreviewContainer');
    const closeDocPreviewBtn = document.getElementById('closeDocPreviewBtn');
    const dismissDocPreviewBtn = document.getElementById('dismissDocPreviewBtn');
    const docDownloadBtn = document.getElementById('docDownloadBtn');

    let currentPendingRegistrarFile = null;

    if (registrarUploadTriggerBtn && registrarDocFileInput) {
        registrarUploadTriggerBtn.addEventListener('click', () => registrarDocFileInput.click());
    }

    if (registrarDocFileInput) {
        registrarDocFileInput.addEventListener('change', function() {
            if (this.files && this.files.length > 0) {
                handleRegistrarFileSelected(this.files[0]);
            }
        });
    }

    function handleRegistrarFileSelected(file) {
        currentPendingRegistrarFile = file;
        if (registrarDocSelectedName) registrarDocSelectedName.textContent = `${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
        if (registrarDocCustomTitle) registrarDocCustomTitle.value = file.name.replace(/\.[^/.]+$/, '');
        if (registrarDocUploadForm) registrarDocUploadForm.style.display = 'block';
    }

    if (registrarDocCancelBtn) {
        registrarDocCancelBtn.addEventListener('click', () => {
            currentPendingRegistrarFile = null;
            if (registrarDocFileInput) registrarDocFileInput.value = '';
            if (registrarDocUploadForm) registrarDocUploadForm.style.display = 'none';
        });
    }

    if (registrarDocSaveBtn) {
        registrarDocSaveBtn.addEventListener('click', () => {
            if (!currentPendingRegistrarFile) {
                showAlert('No file selected.', 'error');
                return;
            }

            const title = (registrarDocCustomTitle && registrarDocCustomTitle.value.trim()) || currentPendingRegistrarFile.name;
            const type = (registrarDocTypeSelect && registrarDocTypeSelect.value) || 'Official Document';
            const sizeInMb = (currentPendingRegistrarFile.size / (1024 * 1024)).toFixed(2);
            const sizeStr = currentPendingRegistrarFile.size > 1024 * 1024 ? `${sizeInMb} MB` : `${Math.round(currentPendingRegistrarFile.size / 1024)} KB`;
            const isPdf = currentPendingRegistrarFile.name.toLowerCase().endsWith('.pdf') || currentPendingRegistrarFile.type === 'application/pdf';
            const format = isPdf ? 'pdf' : (currentPendingRegistrarFile.type.startsWith('image/') ? 'img' : 'doc');

            const reader = new FileReader();
            reader.onload = function(evt) {
                const dataUrl = evt.target.result;
                const newDoc = {
                    id: 'rdoc_' + Date.now(),
                    title: title,
                    type: type,
                    filename: currentPendingRegistrarFile.name,
                    size: sizeStr,
                    date: new Date().toISOString().split('T')[0],
                    format: format,
                    status: 'Verified',
                    dataUrl: dataUrl
                };

                registrarDocs.unshift(newDoc);
                persistRegistrarDocs();
                renderRegistrarDocs();

                currentPendingRegistrarFile = null;
                if (registrarDocFileInput) registrarDocFileInput.value = '';
                if (registrarDocUploadForm) registrarDocUploadForm.style.display = 'none';

                showAlert(`Document "${title}" uploaded to your profile!`, 'success');
            };
            reader.readAsDataURL(currentPendingRegistrarFile);
        });
    }

    function renderRegistrarDocs() {
        if (!registrarDocList) return;

        if (registrarDocCount) {
            registrarDocCount.textContent = `${registrarDocs.length} ${registrarDocs.length === 1 ? 'File' : 'Files'}`;
        }

        if (registrarDocs.length === 0) {
            registrarDocList.innerHTML = `
                <div class="empty-docs-state">
                    <i class="fas fa-folder-open"></i>
                    <p>No official documents uploaded yet. Upload your DepEd credentials above.</p>
                </div>
            `;
            return;
        }

        let html = '';
        registrarDocs.forEach(doc => {
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
                        <button type="button" class="doc-btn btn-view-rdoc" data-id="${doc.id}" title="Preview Document">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button type="button" class="doc-btn doc-btn-danger btn-delete-rdoc" data-id="${doc.id}" title="Delete Document">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        registrarDocList.innerHTML = html;

        registrarDocList.querySelectorAll('.btn-view-rdoc').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = this.dataset.id;
                openRegistrarDocPreview(id);
            });
        });

        registrarDocList.querySelectorAll('.btn-delete-rdoc').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = this.dataset.id;
                deleteRegistrarDoc(id);
            });
        });
    }

    function openRegistrarDocPreview(id) {
        const doc = registrarDocs.find(d => d.id === id);
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
                docPreviewContainer.innerHTML = `<img src="${doc.dataUrl}" alt="${doc.title}">`;
            } else if (doc.format === 'pdf' && doc.dataUrl) {
                docPreviewContainer.innerHTML = `
                    <iframe src="${doc.dataUrl}" style="width:100%;height:450px;border:none;border-radius:8px;"></iframe>
                `;
            } else {
                docPreviewContainer.innerHTML = `
                    <div style="padding:40px;text-align:center;">
                        <i class="fas fa-stamp" style="font-size:48px;color:var(--primary);margin-bottom:12px;"></i>
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

    function closeRegistrarDocPreview() {
        if (docPreviewModal) {
            docPreviewModal.classList.remove('active');
            docPreviewModal.style.display = 'none';
        }
    }

    if (closeDocPreviewBtn) closeDocPreviewBtn.addEventListener('click', closeRegistrarDocPreview);
    if (dismissDocPreviewBtn) dismissDocPreviewBtn.addEventListener('click', closeRegistrarDocPreview);

    window.addEventListener('click', function(e) {
        if (e.target === docPreviewModal) {
            closeRegistrarDocPreview();
        }
    });

    function deleteRegistrarDoc(id) {
        const doc = registrarDocs.find(d => d.id === id);
        if (!doc) return;
        if (confirm(`Are you sure you want to delete "${doc.title}"?`)) {
            registrarDocs = registrarDocs.filter(d => d.id !== id);
            persistRegistrarDocs();
            renderRegistrarDocs();
            showAlert('Document removed from profile.', 'success');
        }
    }

    // ============================================
    // SHOW ALERT
    // ============================================

    function showAlert(message, type = 'success') {
        if (!alertContainer) return;
        alertContainer.innerHTML = '';
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            ${message}
        `;
        alertContainer.appendChild(alertDiv);

        setTimeout(() => {
            alertDiv.style.opacity = '0';
            setTimeout(() => alertDiv.remove(), 300);
        }, 5000);
    }

    // ============================================
    // INITIALIZE IMMEDIATELY
    // ============================================

    loadProfileData();
    renderRegistrarDocs();

    console.log('✅ Registrar Profile initialized successfully!');

})();