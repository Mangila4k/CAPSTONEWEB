// ===== PROFILE JAVASCRIPT (SUPABASE POWERED) =====
import { supabase } from '../../supabase/config.js';

document.addEventListener('DOMContentLoaded', async function() {
    'use strict';

    // DOM Elements
    const alertContainer = document.getElementById('alertContainer');
    const profileForm = document.getElementById('profileForm');
    const emailChangeForm = document.getElementById('emailChangeForm');
    const passwordForm = document.getElementById('passwordForm');
    const uploadForm = document.getElementById('uploadForm');

    // Profile Card UI Elements
    const profileInitial = document.getElementById('profileInitial');
    const profileName = document.getElementById('profileName');
    const daysActiveEl = document.getElementById('daysActive');
    const emailValueText = document.getElementById('emailValueText');
    const profileIdNumber = document.getElementById('profileIdNumber');
    const profilePhone = document.getElementById('profilePhone');
    const profileMemberSince = document.getElementById('profileMemberSince');
    const adminAvatar = document.getElementById('adminAvatar');
    const adminName = document.getElementById('adminName');

    // Input fields
    const editAdminFirstName = document.getElementById('editAdminFirstName');
    const editAdminLastName = document.getElementById('editAdminLastName');
    const editAdminGender = document.getElementById('editAdminGender');
    const editAdminAddress = document.getElementById('editAdminAddress');
    const idNumberInput = document.getElementById('idNumber');
    const phoneInput = document.getElementById('phone');

    // Password Elements
    const changePasswordCheckbox = document.getElementById('changePasswordCheckbox');
    const passwordFields = document.getElementById('passwordFields');
    const currentPassword = document.getElementById('currentPassword');
    const newPassword = document.getElementById('newPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    const strengthFill = document.getElementById('passwordStrengthFill');
    const strengthText = document.getElementById('passwordStrengthText');
    const matchText = document.getElementById('passwordMatchText');

    // State
    let currentUser = null;
    let userData = null;

    // Alert helper
    function showAlert(message, type = 'error') {
        if (!alertContainer) return;
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        const icon = type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle';
        alertDiv.innerHTML = `<i class="fas ${icon}"></i> <div>${message}</div>`;
        alertContainer.appendChild(alertDiv);

        setTimeout(() => {
            alertDiv.style.opacity = '0';
            setTimeout(() => {
                alertDiv.remove();
            }, 300);
        }, 5000);
    }

    function calculateDaysActive(createdDateStr) {
        if (!createdDateStr) return 1;
        const createdDate = new Date(createdDateStr);
        const today = new Date();
        const diffTime = Math.abs(today - createdDate);
        return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    function formatDate(dateString) {
        if (!dateString) return '—';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }

    // ===== LOAD PROFILE DATA =====
    async function loadProfile() {
        try {
            const stored = localStorage.getItem('currentUser');
            if (stored) {
                currentUser = JSON.parse(stored);
            }

            if (!currentUser || !currentUser.email) {
                currentUser = {
                    email: 'admin@hiraya.edu.ph',
                    firstName: 'System',
                    lastName: 'Admin',
                    role: 'admin',
                    created_at: '2026-09-01'
                };
            }

            // Immediate population from session
            const fName = currentUser.firstName || currentUser.first_name || 'System';
            const lName = currentUser.lastName || currentUser.last_name || 'Admin';
            const initFullName = `${fName} ${lName}`.trim() || (currentUser.email ? currentUser.email.split('@')[0] : 'Admin');
            const initInitial = initFullName.charAt(0).toUpperCase() || 'A';
            const initDays = calculateDaysActive(currentUser.created_at || '2026-09-01');
            const initIdNum = currentUser.id_number || `HES-ADM-${String(currentUser.id || '00001').substring(0, 5).toUpperCase()}`;
            const initMemberSince = formatDate(currentUser.created_at || '2026-09-01');
            const initPhone = currentUser.phone || currentUser.contact_number || '09123456789';
            const initAddress = currentUser.address || '';
            const initGender = currentUser.gender || '';

            if (profileInitial) profileInitial.textContent = initInitial;
            if (profileName) profileName.textContent = initFullName;
            if (daysActiveEl) daysActiveEl.textContent = initDays;
            if (emailValueText) emailValueText.textContent = currentUser.email || 'admin@hiraya.edu.ph';
            if (profileIdNumber) profileIdNumber.textContent = initIdNum;
            if (profilePhone) profilePhone.textContent = initPhone;
            if (profileMemberSince) profileMemberSince.textContent = initMemberSince;
            if (adminAvatar) adminAvatar.textContent = initInitial;
            if (adminName) adminName.textContent = initFullName;

            if (editAdminFirstName && !editAdminFirstName.value) editAdminFirstName.value = fName;
            if (editAdminLastName && !editAdminLastName.value) editAdminLastName.value = lName;
            if (editAdminGender && !editAdminGender.value) editAdminGender.value = initGender;
            if (editAdminAddress && !editAdminAddress.value) editAdminAddress.value = initAddress;
            if (idNumberInput && !idNumberInput.value) idNumberInput.value = initIdNum;
            if (phoneInput && !phoneInput.value) phoneInput.value = initPhone !== 'Not set' ? initPhone : '';

            // Fetch latest record from Supabase
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('email', currentUser.email)
                .maybeSingle();

            if (data) {
                userData = data;
                const dbFirst = userData.first_name || fName;
                const dbLast = userData.last_name || lName;
                const freshFullName = `${dbFirst} ${dbLast}`.trim() || initFullName;
                const freshInitial = freshFullName.charAt(0).toUpperCase() || 'A';
                const freshDays = calculateDaysActive(userData.created_at);
                const freshIdNum = userData.id_number || `HES-ADM-${String(userData.id || '00001').substring(0, 5).toUpperCase()}`;
                const freshMemberSince = formatDate(userData.created_at || '2026-09-01');
                const freshPhone = userData.phone || userData.contact_number || initPhone;
                const freshAddr = userData.address || initAddress;
                const freshGender = userData.gender || initGender;

                if (profileInitial) profileInitial.textContent = freshInitial;
                if (profileName) profileName.textContent = freshFullName;
                if (daysActiveEl) daysActiveEl.textContent = freshDays;
                if (emailValueText) emailValueText.textContent = userData.email;
                if (profileIdNumber) profileIdNumber.textContent = freshIdNum;
                if (profilePhone) profilePhone.textContent = freshPhone;
                if (profileMemberSince) profileMemberSince.textContent = freshMemberSince;
                if (adminAvatar) adminAvatar.textContent = freshInitial;
                if (adminName) adminName.textContent = freshFullName;

                if (editAdminFirstName) editAdminFirstName.value = dbFirst;
                if (editAdminLastName) editAdminLastName.value = dbLast;
                if (editAdminGender) editAdminGender.value = freshGender;
                if (editAdminAddress) editAdminAddress.value = freshAddr;
                if (idNumberInput) idNumberInput.value = freshIdNum;
                if (phoneInput) phoneInput.value = freshPhone;

                renderAdminAccountInfoView(freshFullName, userData.email, freshIdNum, freshGender, freshPhone, freshAddr);
            } else {
                renderAdminAccountInfoView(initFullName, currentUser.email, initIdNum, initGender, initPhone, initAddress);
            }
        } catch (err) {
            console.error('Error loading profile:', err);
        }
    }

    function renderAdminAccountInfoView(fullName, email, idNum, gender, phone, address) {
        const viewAdminFullName = document.getElementById('viewAdminFullName');
        const viewAdminEmail = document.getElementById('viewAdminEmail');
        const viewAdminEmployeeId = document.getElementById('viewAdminEmployeeId');
        const viewAdminGender = document.getElementById('viewAdminGender');
        const viewAdminPhone = document.getElementById('viewAdminPhone');
        const viewAdminRole = document.getElementById('viewAdminRole');
        const viewAdminAddress = document.getElementById('viewAdminAddress');

        if (viewAdminFullName) viewAdminFullName.textContent = fullName || '-';
        if (viewAdminEmail) viewAdminEmail.textContent = email || '-';
        if (viewAdminEmployeeId) viewAdminEmployeeId.textContent = idNum || 'HES-ADM-00001';
        if (viewAdminGender) viewAdminGender.textContent = gender || 'Not specified';
        if (viewAdminPhone) viewAdminPhone.textContent = phone && phone !== 'Not set' ? phone : 'Not provided';
        if (viewAdminRole) viewAdminRole.textContent = 'System Administrator';
        if (viewAdminAddress) viewAdminAddress.textContent = address && address !== 'Not set' ? address : 'Not provided';
    }

    // ===== EDIT TOGGLE HANDLER (View Mode vs Edit Mode) =====
    const editAdminInfoToggleBtn = document.getElementById('editAdminInfoToggleBtn');
    const adminInfoViewContainer = document.getElementById('adminInfoViewContainer');
    const adminInfoEditContainer = document.getElementById('adminInfoEditContainer');
    const cancelAdminEditBtn = document.getElementById('cancelAdminEditBtn');

    function setAdminEditMode(isEditing) {
        if (!adminInfoViewContainer || !adminInfoEditContainer || !editAdminInfoToggleBtn) return;
        if (isEditing) {
            adminInfoViewContainer.style.display = 'none';
            adminInfoEditContainer.style.display = 'block';
            editAdminInfoToggleBtn.innerHTML = '<i class="fas fa-times"></i> Cancel';
            editAdminInfoToggleBtn.classList.add('is-editing');
        } else {
            adminInfoViewContainer.style.display = 'block';
            adminInfoEditContainer.style.display = 'none';
            editAdminInfoToggleBtn.innerHTML = '<i class="fas fa-edit"></i> Edit';
            editAdminInfoToggleBtn.classList.remove('is-editing');
        }
    }

    if (editAdminInfoToggleBtn) {
        editAdminInfoToggleBtn.addEventListener('click', function() {
            const isCurrentlyEditing = adminInfoEditContainer && adminInfoEditContainer.style.display !== 'none';
            setAdminEditMode(!isCurrentlyEditing);
        });
    }

    if (cancelAdminEditBtn) {
        cancelAdminEditBtn.addEventListener('click', function() {
            setAdminEditMode(false);
        });
    }

    // ===== PASSWORD STRENGTH & VALIDATION =====
    function checkPasswordStrength() {
        if (!newPassword || !strengthFill || !strengthText) return;
        const pwd = newPassword.value;
        let score = 0;

        if (pwd.length >= 8) score++;
        if (/[A-Z]/.test(pwd)) score++;
        if (/[a-z]/.test(pwd)) score++;
        if (/[0-9]/.test(pwd)) score++;
        if (/[!@#$%^&*]/.test(pwd)) score++;

        // Update list indicators
        const setReq = (id, valid) => {
            const el = document.getElementById(id);
            if (el) {
                el.style.color = valid ? '#10b981' : '#64748b';
                const icon = el.querySelector('i');
                if (icon) icon.className = valid ? 'fas fa-check-circle' : 'fas fa-circle';
            }
        };

        setReq('req-length', pwd.length >= 8);
        setReq('req-upper', /[A-Z]/.test(pwd));
        setReq('req-lower', /[a-z]/.test(pwd));
        setReq('req-number', /[0-9]/.test(pwd));
        setReq('req-special', /[!@#$%^&*]/.test(pwd));

        if (pwd.length === 0) {
            strengthFill.style.width = '0';
            strengthText.innerHTML = '<i class="fas fa-info-circle"></i> <span>Enter new password</span>';
            return;
        }

        if (score <= 2) {
            strengthFill.style.width = '25%';
            strengthFill.style.backgroundColor = '#ef4444';
            strengthText.innerHTML = '<i class="fas fa-shield-alt"></i> <span style="color:#ef4444;">Weak</span>';
        } else if (score <= 4) {
            strengthFill.style.width = '65%';
            strengthFill.style.backgroundColor = '#f59e0b';
            strengthText.innerHTML = '<i class="fas fa-shield-alt"></i> <span style="color:#f59e0b;">Medium</span>';
        } else {
            strengthFill.style.width = '100%';
            strengthFill.style.backgroundColor = '#10b981';
            strengthText.innerHTML = '<i class="fas fa-shield-alt"></i> <span style="color:#10b981;">Strong</span>';
        }
    }

    function checkPasswordMatch() {
        if (!newPassword || !confirmPassword || !matchText) return;
        const pwd = newPassword.value;
        const confirm = confirmPassword.value;

        if (confirm.length === 0) {
            matchText.innerHTML = '<i class="fas fa-info-circle"></i> Re-enter new password';
        } else if (pwd === confirm) {
            matchText.innerHTML = '<i class="fas fa-check-circle" style="color: #10b981;"></i> <span style="color: #10b981;">Passwords match</span>';
        } else {
            matchText.innerHTML = '<i class="fas fa-exclamation-circle" style="color: #ef4444;"></i> <span style="color: #ef4444;">Passwords do not match</span>';
        }
    }

    // Global password visibility toggle
    window.togglePasswordVisibility = function(fieldId, btnEl) {
        const input = document.getElementById(fieldId);
        if (!input) return;
        const icon = btnEl ? btnEl.querySelector('i') : null;
        if (input.type === 'password') {
            input.type = 'text';
            if (icon) {
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            }
        } else {
            input.type = 'password';
            if (icon) {
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        }
    };

    // ===== EVENT LISTENERS =====

    if (changePasswordCheckbox) {
        changePasswordCheckbox.addEventListener('change', function() {
            const checked = this.checked;
            if (currentPassword) currentPassword.disabled = !checked;
            if (newPassword) newPassword.disabled = !checked;
            if (confirmPassword) confirmPassword.disabled = !checked;
            if (changePasswordBtn) changePasswordBtn.disabled = !checked;
            if (passwordFields) passwordFields.classList.toggle('active', checked);
            const toggleCard = document.getElementById('passwordToggleCard');
            if (toggleCard) toggleCard.classList.toggle('active', checked);
        });
    }

    if (newPassword) {
        newPassword.addEventListener('input', function() {
            checkPasswordStrength();
            checkPasswordMatch();
        });
    }

    if (confirmPassword) {
        confirmPassword.addEventListener('input', checkPasswordMatch);
    }

    // ===== FORM: EDIT PROFILE =====
    if (profileForm) {
        profileForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const firstName = editAdminFirstName ? editAdminFirstName.value.trim() : '';
            const lastName = editAdminLastName ? editAdminLastName.value.trim() : '';
            const gender = editAdminGender ? editAdminGender.value : '';
            const phone = phoneInput ? phoneInput.value.trim() : '';
            const address = editAdminAddress ? editAdminAddress.value.trim() : '';
            const idNumber = idNumberInput ? idNumberInput.value.trim() : '';

            if (!firstName || !lastName) {
                showAlert('First name and last name are required.', 'error');
                return;
            }

            const submitBtn = document.getElementById('saveAdminProfileBtn') || profileForm.querySelector('button[type="submit"]');
            try {
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
                }

                const userUid = sessionUser?.uid || sessionUser?.id || userData?.id || currentUser?.id;
                const userEmail = sessionUser?.email || currentUser?.email || userData?.email;

                if (userUid || userEmail) {
                    const userPayload = {
                        first_name: firstName,
                        last_name: lastName,
                        updated_at: new Date().toISOString()
                    };
                    if (phone) userPayload.contact_number = phone;
                    if (address) userPayload.address = address;

                    let uUpdate = supabase
                        .from('users')
                        .update(userPayload);

                    if (userUid) {
                        uUpdate = uUpdate.eq('id', userUid);
                    } else {
                        uUpdate = uUpdate.eq('email', userEmail);
                    }

                    const { error } = await uUpdate;
                    if (error) {
                        console.error('Supabase profile update error:', error);
                        throw new Error(error.message || 'Failed to update profile in database');
                    }
                }

                // Update session
                const fullname = `${firstName} ${lastName}`.trim();
                currentUser.first_name = firstName;
                currentUser.last_name = lastName;
                currentUser.firstName = firstName;
                currentUser.lastName = lastName;
                currentUser.displayName = fullname;
                currentUser.gender = gender;
                currentUser.phone = phone;
                currentUser.address = address;
                currentUser.id_number = idNumber;
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                localStorage.setItem('hes_admin_name', fullname);

                if (userData) {
                    userData.first_name = firstName;
                    userData.last_name = lastName;
                    userData.gender = gender;
                    userData.phone = phone;
                    userData.address = address;
                    userData.id_number = idNumber;
                }

                renderAdminAccountInfoView(fullname, userEmail, idNumber, gender, phone, address);
                setAdminEditMode(false);

                if (window.syncAdminAvatarAndName) {
                    window.syncAdminAvatarAndName();
                }

                showAlert('✅ Account information saved successfully!', 'success');
                await loadProfile();
            } catch (err) {
                console.error('Error updating profile:', err);
                showAlert('Failed to update profile: ' + err.message, 'error');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
                }
            }
        });
    }

    // ===== FORM: CHANGE PASSWORD =====
    if (passwordForm) {
        passwordForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const curr = currentPassword ? currentPassword.value : '';
            const next = newPassword ? newPassword.value : '';
            const conf = confirmPassword ? confirmPassword.value : '';

            if (!next || next.length < 6) {
                showAlert('New password must be at least 6 characters long.', 'error');
                return;
            }

            if (next !== conf) {
                showAlert('Passwords do not match.', 'error');
                return;
            }

            try {
                if (changePasswordBtn) changePasswordBtn.disabled = true;

                if (userData && userData.id) {
                    const { error } = await supabase
                        .from('users')
                        .update({
                            password: next,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', userData.id);

                    if (error) throw error;
                }

                showAlert('✅ Password changed successfully!', 'success');
                passwordForm.reset();
                if (changePasswordCheckbox) {
                    changePasswordCheckbox.checked = false;
                    if (currentPassword) currentPassword.disabled = true;
                    if (newPassword) newPassword.disabled = true;
                    if (confirmPassword) confirmPassword.disabled = true;
                    if (passwordFields) passwordFields.classList.remove('active');
                    const toggleCard = document.getElementById('passwordToggleCard');
                    if (toggleCard) toggleCard.classList.remove('active');
                }
            } catch (err) {
                console.error('Error changing password:', err);
                showAlert('Failed to change password: ' + err.message, 'error');
            } finally {
                if (changePasswordBtn) changePasswordBtn.disabled = false;
            }
        });
    }

    // ===== FORM: CHANGE EMAIL =====
    if (emailChangeForm) {
        emailChangeForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const newEmail = document.getElementById('newEmail')?.value?.trim();

            if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
                showAlert('Please enter a valid new email address.', 'error');
                return;
            }

            try {
                // Check if email taken
                const { data: existing } = await supabase
                    .from('users')
                    .select('id')
                    .eq('email', newEmail)
                    .maybeSingle();

                if (existing) {
                    showAlert('This email address is already in use.', 'error');
                    return;
                }

                if (userData && userData.id) {
                    const { error } = await supabase
                        .from('users')
                        .update({
                            email: newEmail,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', userData.id);

                    if (error) throw error;
                }

                currentUser.email = newEmail;
                localStorage.setItem('currentUser', JSON.stringify(currentUser));

                showAlert('✅ Email address updated successfully!', 'success');
                emailChangeForm.reset();
                await loadProfile();
            } catch (err) {
                console.error('Error updating email:', err);
                showAlert('Failed to update email: ' + err.message, 'error');
            }
        });
    }

    // ============================================
    // ADMIN DOCUMENTS MANAGEMENT
    // ============================================

    const defaultAdminDocs = [
        {
            id: 'adoc_1',
            title: 'DepEd Administrator Appointment Order',
            type: 'Appointment',
            filename: 'Admin_Appointment_Order_2026.pdf',
            size: '1.5 MB',
            date: '2026-06-01',
            format: 'pdf',
            status: 'Verified',
            dataUrl: null
        },
        {
            id: 'adoc_2',
            title: 'Official DepEd Central Office ID',
            type: 'Valid ID',
            filename: 'DepEd_Official_Admin_ID.png',
            size: '920 KB',
            date: '2026-06-02',
            format: 'img',
            status: 'Verified',
            dataUrl: null
        }
    ];

    let adminDocs = [];
    try {
        const savedADocs = localStorage.getItem('hes_admin_documents');
        if (savedADocs) {
            adminDocs = JSON.parse(savedADocs);
        } else {
            adminDocs = [...defaultAdminDocs];
            localStorage.setItem('hes_admin_documents', JSON.stringify(adminDocs));
        }
    } catch(e) {
        adminDocs = [...defaultAdminDocs];
    }

    function persistAdminDocs() {
        try {
            localStorage.setItem('hes_admin_documents', JSON.stringify(adminDocs));
        } catch(e) {}
    }

    const adminUploadTriggerBtn = document.getElementById('adminUploadTriggerBtn');
    const adminDocFileInput = document.getElementById('adminDocFileInput');
    const adminDocUploadForm = document.getElementById('adminDocUploadForm');
    const adminDocSelectedName = document.getElementById('adminDocSelectedName');
    const adminDocTypeSelect = document.getElementById('adminDocTypeSelect');
    const adminDocCustomTitle = document.getElementById('adminDocCustomTitle');
    const adminDocCancelBtn = document.getElementById('adminDocCancelBtn');
    const adminDocSaveBtn = document.getElementById('adminDocSaveBtn');
    const adminDocList = document.getElementById('adminDocList');
    const adminDocCount = document.getElementById('adminDocCount');

    // Preview Modal
    const docPreviewModal = document.getElementById('docPreviewModal');
    const docPreviewTitle = document.getElementById('docPreviewTitle');
    const docPreviewContainer = document.getElementById('docPreviewContainer');
    const closeDocPreviewBtn = document.getElementById('closeDocPreviewBtn');
    const dismissDocPreviewBtn = document.getElementById('dismissDocPreviewBtn');
    const docDownloadBtn = document.getElementById('docDownloadBtn');

    let currentPendingAdminFile = null;

    if (adminUploadTriggerBtn && adminDocFileInput) {
        adminUploadTriggerBtn.addEventListener('click', () => adminDocFileInput.click());
    }

    if (adminDocFileInput) {
        adminDocFileInput.addEventListener('change', function() {
            if (this.files && this.files.length > 0) {
                handleAdminFileSelected(this.files[0]);
            }
        });
    }

    function handleAdminFileSelected(file) {
        currentPendingAdminFile = file;
        if (adminDocSelectedName) adminDocSelectedName.textContent = `${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
        if (adminDocCustomTitle) adminDocCustomTitle.value = file.name.replace(/\.[^/.]+$/, '');
        if (adminDocUploadForm) adminDocUploadForm.style.display = 'block';
    }

    if (adminDocCancelBtn) {
        adminDocCancelBtn.addEventListener('click', () => {
            currentPendingAdminFile = null;
            if (adminDocFileInput) adminDocFileInput.value = '';
            if (adminDocUploadForm) adminDocUploadForm.style.display = 'none';
        });
    }

    if (adminDocSaveBtn) {
        adminDocSaveBtn.addEventListener('click', () => {
            if (!currentPendingAdminFile) {
                showAlert('No document selected.', 'error');
                return;
            }

            const title = (adminDocCustomTitle && adminDocCustomTitle.value.trim()) || currentPendingAdminFile.name;
            const type = (adminDocTypeSelect && adminDocTypeSelect.value) || 'Other Document';
            const sizeInMb = (currentPendingAdminFile.size / (1024 * 1024)).toFixed(2);
            const sizeStr = currentPendingAdminFile.size > 1024 * 1024 ? `${sizeInMb} MB` : `${Math.round(currentPendingAdminFile.size / 1024)} KB`;
            const isPdf = currentPendingAdminFile.name.toLowerCase().endsWith('.pdf') || currentPendingAdminFile.type === 'application/pdf';
            const format = isPdf ? 'pdf' : (currentPendingAdminFile.type.startsWith('image/') ? 'img' : 'doc');

            const reader = new FileReader();
            reader.onload = function(evt) {
                const dataUrl = evt.target.result;
                const newDoc = {
                    id: 'adoc_' + Date.now(),
                    title: title,
                    type: type,
                    filename: currentPendingAdminFile.name,
                    size: sizeStr,
                    date: new Date().toISOString().split('T')[0],
                    format: format,
                    status: 'Verified',
                    dataUrl: dataUrl
                };

                adminDocs.unshift(newDoc);
                persistAdminDocs();
                renderAdminDocs();

                currentPendingAdminFile = null;
                if (adminDocFileInput) adminDocFileInput.value = '';
                if (adminDocUploadForm) adminDocUploadForm.style.display = 'none';

                showAlert(`✅ Document "${title}" uploaded to your profile!`, 'success');
            };
            reader.readAsDataURL(currentPendingAdminFile);
        });
    }

    function renderAdminDocs() {
        if (!adminDocList) return;

        if (adminDocCount) {
            adminDocCount.textContent = `${adminDocs.length} ${adminDocs.length === 1 ? 'File' : 'Files'}`;
        }

        if (adminDocs.length === 0) {
            adminDocList.innerHTML = `
                <div class="empty-docs-state" style="text-align:center; padding: 24px 10px; color: #64748b;">
                    <i class="fas fa-folder-open" style="font-size: 32px; color: #94a3b8; margin-bottom: 8px;"></i>
                    <p style="font-size: 13px;">No documents uploaded yet. Upload your Appointment, ID, or Credentials above.</p>
                </div>
            `;
            return;
        }

        let html = '';
        adminDocs.forEach(doc => {
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
                        <button type="button" class="doc-btn btn-view-adoc" data-id="${doc.id}" title="Preview Document">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button type="button" class="doc-btn doc-btn-danger btn-delete-adoc" data-id="${doc.id}" title="Delete Document">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        adminDocList.innerHTML = html;

        adminDocList.querySelectorAll('.btn-view-adoc').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = this.dataset.id;
                openAdminDocPreview(id);
            });
        });

        adminDocList.querySelectorAll('.btn-delete-adoc').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = this.dataset.id;
                deleteAdminDoc(id);
            });
        });
    }

    function openAdminDocPreview(id) {
        const doc = adminDocs.find(d => d.id === id);
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

    function closeAdminDocPreview() {
        if (docPreviewModal) {
            docPreviewModal.classList.remove('active');
            docPreviewModal.style.display = 'none';
        }
    }

    if (closeDocPreviewBtn) closeDocPreviewBtn.addEventListener('click', closeAdminDocPreview);
    if (dismissDocPreviewBtn) dismissDocPreviewBtn.addEventListener('click', closeAdminDocPreview);

    window.addEventListener('click', function(e) {
        if (e.target === docPreviewModal) {
            closeAdminDocPreview();
        }
    });

    function deleteAdminDoc(id) {
        const doc = adminDocs.find(d => d.id === id);
        if (!doc) return;
        if (confirm(`Are you sure you want to delete "${doc.title}"?`)) {
            adminDocs = adminDocs.filter(d => d.id !== id);
            persistAdminDocs();
            renderAdminDocs();
            showAlert('Document removed from profile.', 'success');
        }
    }

    // ===== MODALS & MOBILE MENU =====
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
        });
    }

    window.openImageModal = function() {
        const modal = document.getElementById('imageModal');
        if (modal) modal.classList.add('show');
    };

    window.closeImageModal = function() {
        const modal = document.getElementById('imageModal');
        if (modal) modal.classList.remove('show');
    };

    window.removeProfilePic = function() {
        showAlert('Profile picture reset to default avatar.', 'info');
        window.closeImageModal();
    };

    // Load initial profile data
    await loadProfile();
    renderAdminDocs();
});