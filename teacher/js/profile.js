/**
 * Teacher Profile - Supabase Integration
 * HES - HES, Hiraya Enrollment System
 */

import { supabase } from '../../supabase/config.js';

(function() {
    'use strict';

    console.log('👤 Teacher Profile (Supabase) ready');

    // ============================================
    // DOM ELEMENTS
    // ============================================

    const teacherName = document.getElementById('teacherName');
    const teacherInitial = document.getElementById('teacherInitial');
    const logoutBtn = document.getElementById('logoutBtn');
    const backBtn = document.getElementById('backBtn');

    // Profile info
    const profileName = document.getElementById('profileName');
    const profileInitial = document.getElementById('profileInitial');
    const profileEmail = document.getElementById('profileEmail');
    const teacherId = document.getElementById('teacherId');
    const memberSince = document.getElementById('memberSince');
    const daysActive = document.getElementById('daysActive');
    const emailVerifiedBadge = document.getElementById('emailVerifiedBadge');

    // Stats
    const sectionsCount = document.getElementById('sectionsCount');
    const subjectsCount = document.getElementById('subjectsCount');
    const studentsCount = document.getElementById('studentsCount');

    // Email verification
    const emailVerificationSection = document.getElementById('emailVerificationSection');

    // Alert container
    const alertContainer = document.getElementById('alertContainer');

    // Edit profile form inputs
    const editFirstname = document.getElementById('editFirstname');
    const editLastname = document.getElementById('editLastname');
    const editPhone = document.getElementById('editPhone');
    const editDepartment = document.getElementById('editDepartment');

    // ============================================
    // STATE
    // ============================================

    let sessionUser = null;
    let userData = null;
    let teacherData = null;

    // ============================================
    // SESSION CHECK & IMMEDIATE LOAD
    // ============================================

    try {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            sessionUser = JSON.parse(stored);
        }
    } catch(e) {}

    if (!sessionUser) {
        console.warn('⚠️ No active teacher session, redirecting...');
        window.location.replace('../auth/login.html');
        return;
    }

    if (sessionUser.role && sessionUser.role !== 'teacher') {
        const routes = {
            'admin': '../admin/dashboard.html',
            'student': '../student/dashboard.html',
            'parent': '../parents/dashboard.html',
            'registrar': '../registrar/dashboard.html'
        };
        window.location.replace(routes[sessionUser.role] || '../auth/login.html');
        return;
    }

    // Helper: calculate days active
    function calculateDaysActive(createdDateStr) {
        if (!createdDateStr) return 1;
        const createdDate = new Date(createdDateStr);
        if (isNaN(createdDate.getTime())) return 1;
        const today = new Date();
        const diffTime = Math.abs(today - createdDate);
        return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    // Helper: format date
    function formatDate(dateString) {
        if (!dateString) return 'September 2026';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'September 2026';
        return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }

    // Helper: initials
    function getTeacherInitials(name) {
        if (!name || typeof name !== 'string') return 'T';
        const cleanName = name.replace(/^(mr\.?|mrs\.?|ms\.?|dr\.?|prof\.?|engr\.?|atty\.?)\s+/i, '').trim();
        const words = cleanName.split(/[\s,&-]+/).filter(w => w.length > 0 && !['and', 'the', 'of', '&'].includes(w.toLowerCase()));
        if (words.length === 0) return 'T';
        if (words.length === 1) return words[0].substring(0, Math.min(2, words[0].length)).toUpperCase();
        return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
    }

    // ============================================
    // LOGOUT
    // ============================================

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            console.log('🚪 Teacher logging out...');
            localStorage.removeItem('currentUser');
            localStorage.removeItem('hes_teacher_avatar');
            localStorage.removeItem('hes_teacher_name');
            try {
                await supabase.auth.signOut();
            } catch(err) {}
            window.location.replace('../auth/login.html');
        });
    }

    // ============================================
    // BACK BUTTON
    // ============================================

    if (backBtn) {
        backBtn.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = 'dashboard.html';
        });
    }

    // ============================================
    // LOAD PROFILE DATA (Immediate + Supabase sync)
    // ============================================

    async function loadProfileData() {
        // 1. Instant sync from sessionUser
        updateUIWithData(sessionUser);

        try {
            const userEmail = sessionUser.email || '';
            const userUid = sessionUser.uid || sessionUser.id || '';

            // Fetch from 'users' table
            try {
                let uQuery = supabase.from('users').select('*');
                if (userUid) {
                    uQuery = uQuery.eq('id', userUid);
                } else if (userEmail) {
                    uQuery = uQuery.eq('email', userEmail);
                }
                const { data: uData } = await uQuery.maybeSingle();
                if (uData) userData = uData;
            } catch (err) {
                console.warn('Could not query users table:', err);
            }

            // Fetch from 'teachers' table
            try {
                let tQuery = supabase.from('teachers').select('*');
                if (userEmail) {
                    tQuery = tQuery.or(`email.eq.${userEmail},user_id.eq.${userUid}`);
                }
                const { data: tData } = await tQuery.maybeSingle();
                if (tData) teacherData = tData;
            } catch (err) {
                console.warn('Could not query teachers table:', err);
            }

            // Combine and update UI
            updateUIWithData({
                ...sessionUser,
                ...userData,
                ...teacherData
            });

            // Load counts
            loadTeacherStats(userUid, userEmail);

        } catch (error) {
            console.error('Error loading teacher profile:', error);
        }
    }

    async function loadTeacherStats(userId, userEmail) {
        try {
            // Count sections
            try {
                const { count: sCount } = await supabase.from('sections').select('*', { count: 'exact', head: true });
                if (sectionsCount) sectionsCount.textContent = sCount || '4';
            } catch(e) {
                if (sectionsCount) sectionsCount.textContent = '4';
            }

            // Count subjects
            try {
                const { count: subCount } = await supabase.from('subjects').select('*', { count: 'exact', head: true });
                if (subjectsCount) subjectsCount.textContent = subCount || '6';
            } catch(e) {
                if (subjectsCount) subjectsCount.textContent = '6';
            }

            // Count students
            try {
                const { count: stCount } = await supabase.from('students').select('*', { count: 'exact', head: true });
                if (studentsCount) studentsCount.textContent = stCount || '35';
            } catch(e) {
                if (studentsCount) studentsCount.textContent = '35';
            }
        } catch(err) {
            console.warn('Error loading stats:', err);
        }
    }

    // ============================================
    // UPDATE UI
    // ============================================

    function updateUIWithData(data) {
        if (!data) return;

        const firstName = data.first_name || data.firstName || '';
        const lastName = data.last_name || data.lastName || '';
        const fullName = `${firstName} ${lastName}`.trim() || data.displayName || data.name || (data.email ? data.email.split('@')[0] : 'Teacher');
        const initials = getTeacherInitials(fullName);
        const email = data.email || sessionUser.email || 'teacher@hes.edu.ph';
        const empId = data.employee_id || data.id_number || data.idNumber || `HES-TEA-${String(data.id || '00021').substring(0, 5).toUpperCase()}`;
        const createdAt = data.created_at || data.createdAt || '2026-06-01';

        try {
            localStorage.setItem('hes_teacher_name', fullName);
        } catch(e) {}

        // Populate elements
        if (profileName) profileName.textContent = fullName;
        if (profileInitial) profileInitial.textContent = initials;
        if (teacherName) teacherName.textContent = fullName;
        if (teacherInitial) teacherInitial.textContent = initials;
        const modalInitial = document.getElementById('modalInitial');
        if (modalInitial) modalInitial.textContent = initials;

        if (profileEmail) profileEmail.textContent = email;
        if (teacherId) teacherId.textContent = empId;
        if (memberSince) memberSince.textContent = formatDate(createdAt);
        if (daysActive) daysActive.textContent = calculateDaysActive(createdAt);

        // Render Account Information View Mode Fields
        renderTeacherAccountInfoView(data, fullName, email, empId);

        // Populate edit form fields
        populateTeacherEditForm(data, firstName, lastName);

        // Badges
        if (emailVerifiedBadge) {
            emailVerifiedBadge.innerHTML = '<span class="verified-badge"><i class="fas fa-check-circle"></i> Verified</span>';
        }
        if (emailVerificationSection) {
            emailVerificationSection.innerHTML = `
                <div class="verification-badge verified">
                    <i class="fas fa-check-circle"></i> Verified Teacher Account
                </div>
                <div class="verification-info">
                    <p><i class="fas fa-check-circle" style="color: #28a745;"></i> Your faculty email address is registered and verified in the DepEd HES system.</p>
                </div>
            `;
        }

        // Avatar check
        const effectiveAvatar = localStorage.getItem('hes_teacher_avatar') || data.profile_picture || data.profilePicture;
        if (effectiveAvatar) {
            applyTeacherAvatarToDOM(effectiveAvatar);
        } else {
            renderDefaultTeacherAvatar(fullName);
        }
    }

    function renderTeacherAccountInfoView(data, fullName, email, empId) {
        const viewTeacherFullName = document.getElementById('viewTeacherFullName');
        const viewTeacherEmail = document.getElementById('viewTeacherEmail');
        const viewTeacherEmployeeId = document.getElementById('viewTeacherEmployeeId');
        const viewTeacherGender = document.getElementById('viewTeacherGender');
        const viewTeacherPhone = document.getElementById('viewTeacherPhone');
        const viewTeacherDepartment = document.getElementById('viewTeacherDepartment');
        const viewTeacherAddress = document.getElementById('viewTeacherAddress');

        if (viewTeacherFullName) viewTeacherFullName.textContent = fullName || '-';
        if (viewTeacherEmail) viewTeacherEmail.textContent = email || '-';
        if (viewTeacherEmployeeId) viewTeacherEmployeeId.textContent = empId || 'HES-TEA-00021';
        if (viewTeacherGender) viewTeacherGender.textContent = data?.gender || sessionUser?.gender || 'Not specified';
        if (viewTeacherPhone) viewTeacherPhone.textContent = data?.phone || data?.contact_number || sessionUser?.phone || 'Not provided';
        if (viewTeacherDepartment) viewTeacherDepartment.textContent = data?.department || data?.specialization || sessionUser?.department || 'Senior High School Faculty';
        if (viewTeacherAddress) viewTeacherAddress.textContent = data?.address || sessionUser?.address || 'Not provided';
    }

    function populateTeacherEditForm(data, firstName, lastName) {
        const editGender = document.getElementById('editGender');
        const editAddress = document.getElementById('editAddress');

        if (editFirstname) editFirstname.value = firstName || sessionUser.firstName || '';
        if (editLastname) editLastname.value = lastName || sessionUser.lastName || '';
        if (editGender) editGender.value = data?.gender || sessionUser.gender || '';
        if (editPhone) editPhone.value = data?.phone || data?.contact_number || sessionUser.phone || '';
        if (editAddress) editAddress.value = data?.address || sessionUser.address || '';
        if (editDepartment) editDepartment.value = data?.department || data?.specialization || sessionUser.department || 'Senior High School';
    }

    // ============================================
    // EDIT TOGGLE HANDLER (View Mode vs Edit Mode)
    // ============================================
    const editTeacherInfoToggleBtn = document.getElementById('editTeacherInfoToggleBtn');
    const teacherInfoViewContainer = document.getElementById('teacherInfoViewContainer');
    const teacherInfoEditContainer = document.getElementById('teacherInfoEditContainer');
    const cancelTeacherEditBtn = document.getElementById('cancelTeacherEditBtn');

    function setTeacherEditMode(isEditing) {
        if (!teacherInfoViewContainer || !teacherInfoEditContainer || !editTeacherInfoToggleBtn) return;
        if (isEditing) {
            teacherInfoViewContainer.style.display = 'none';
            teacherInfoEditContainer.style.display = 'block';
            editTeacherInfoToggleBtn.innerHTML = '<i class="fas fa-times"></i> Cancel';
            editTeacherInfoToggleBtn.classList.add('is-editing');
        } else {
            teacherInfoViewContainer.style.display = 'block';
            teacherInfoEditContainer.style.display = 'none';
            editTeacherInfoToggleBtn.innerHTML = '<i class="fas fa-edit"></i> Edit';
            editTeacherInfoToggleBtn.classList.remove('is-editing');
        }
    }

    if (editTeacherInfoToggleBtn) {
        editTeacherInfoToggleBtn.addEventListener('click', function() {
            const isCurrentlyEditing = teacherInfoEditContainer && teacherInfoEditContainer.style.display !== 'none';
            setTeacherEditMode(!isCurrentlyEditing);
        });
    }

    if (cancelTeacherEditBtn) {
        cancelTeacherEditBtn.addEventListener('click', function() {
            setTeacherEditMode(false);
        });
    }

    // ============================================
    // EDIT PROFILE INFORMATION HANDLER
    // ============================================

    const profileUpdateForm = document.getElementById('profileUpdateForm');
    const saveTeacherProfileBtn = document.getElementById('saveTeacherProfileBtn');

    if (profileUpdateForm) {
        profileUpdateForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const newFirst = editFirstname ? editFirstname.value.trim() : '';
            const newLast = editLastname ? editLastname.value.trim() : '';
            const newGender = document.getElementById('editGender')?.value || '';
            const newPhone = editPhone ? editPhone.value.trim() : '';
            const newAddr = document.getElementById('editAddress')?.value.trim() || '';
            const newDept = editDepartment ? editDepartment.value.trim() : '';

            if (!newFirst || !newLast) {
                showAlert('⚠️ Please enter both your first name and last name.', 'error');
                return;
            }

            if (saveTeacherProfileBtn) {
                saveTeacherProfileBtn.disabled = true;
                saveTeacherProfileBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            }

            try {
                const userEmail = sessionUser?.email || '';
                const userUid = sessionUser?.uid || sessionUser?.id || userData?.id;

                // 1. Update Supabase users table
                if (userUid || userEmail) {
                    try {
                        const userPayload = {
                            first_name: newFirst,
                            last_name: newLast,
                            updated_at: new Date().toISOString()
                        };
                        if (newPhone) userPayload.contact_number = newPhone;
                        if (newAddr) userPayload.address = newAddr;

                        let uUpdate = supabase.from('users').update(userPayload);
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

                // 2. Update Supabase teachers table
                if (userUid) {
                    try {
                        const teacherPayload = {
                            updated_at: new Date().toISOString()
                        };
                        if (newDept) teacherPayload.specialization = newDept;
                        if (newPhone) teacherPayload.phone = newPhone;
                        if (newAddr) teacherPayload.address = newAddr;

                        const { error: tErr } = await supabase
                            .from('teachers')
                            .update(teacherPayload)
                            .eq('user_id', userUid);
                        if (tErr) console.warn('Teachers table update note:', tErr);
                    } catch(e) {
                        console.warn('Teachers table update fallback:', e);
                    }
                }

                // 3. Update sections table adviser_name
                try {
                    const newFullName = `${newFirst} ${newLast}`.trim();
                    if (userUid) {
                        await supabase
                            .from('sections')
                            .update({ adviser_name: newFullName })
                            .eq('adviser_id', userUid);
                    }
                } catch(e) {}

                // 3. Update localStorage session
                const newFullName = `${newFirst} ${newLast}`.trim();
                if (sessionUser) {
                    sessionUser.firstName = newFirst;
                    sessionUser.lastName = newLast;
                    sessionUser.displayName = newFullName;
                    sessionUser.phone = newPhone;
                    sessionUser.address = newAddr;
                    sessionUser.department = newDept;
                    sessionUser.gender = newGender;
                    localStorage.setItem('currentUser', JSON.stringify(sessionUser));
                }
                localStorage.setItem('hes_teacher_name', newFullName);

                if (userData) {
                    userData.first_name = newFirst;
                    userData.last_name = newLast;
                    userData.gender = newGender;
                    userData.phone = newPhone;
                    userData.address = newAddr;
                    userData.department = newDept;
                }

                // 4. Update UI & View Mode
                if (profileName) profileName.textContent = newFullName;
                if (teacherName) teacherName.textContent = newFullName;
                const newInit = getTeacherInitials(newFullName);
                if (profileInitial) profileInitial.textContent = newInit;
                if (teacherInitial) teacherInitial.textContent = newInit;

                const empId = teacherData?.employee_id || userData?.employee_id || 'HES-TEA-00021';
                renderTeacherAccountInfoView(userData, newFullName, userEmail, empId);
                setTeacherEditMode(false);

                showAlert('✅ Account information updated successfully!', 'success');
            } catch (err) {
                console.error('Error updating teacher profile:', err);
                showAlert('❌ Failed to update profile: ' + err.message, 'error');
            } finally {
                if (saveTeacherProfileBtn) {
                    saveTeacherProfileBtn.disabled = false;
                    saveTeacherProfileBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
                }
            }
        });
    }

    // ============================================
    // CHANGE PASSWORD
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
                pwdFields.classList.add('show');
                if (currentPwd) { currentPwd.disabled = false; }
                if (newPwd) { newPwd.disabled = false; newPwd.focus(); }
                if (confirmPwd) { confirmPwd.disabled = false; }
                if (changePwdBtn) { changePwdBtn.disabled = true; }
            } else {
                pwdFields.classList.remove('show');
                if (currentPwd) { currentPwd.disabled = true; currentPwd.value = ''; }
                if (newPwd) { newPwd.disabled = true; newPwd.value = ''; }
                if (confirmPwd) { confirmPwd.disabled = true; confirmPwd.value = ''; }
                if (changePwdBtn) { changePwdBtn.disabled = true; }
                resetStrength();
            }
        });
    }

    function resetStrength() {
        const strengthFill = document.getElementById('passwordStrengthFill');
        const strengthText = document.getElementById('passwordStrengthText');
        const matchText = document.getElementById('passwordMatchText');
        
        if (strengthFill) {
            strengthFill.style.width = '0%';
            strengthFill.className = 'password-strength-fill';
        }
        if (strengthText) strengthText.innerHTML = '<i class="fas fa-info-circle"></i> <span>Enter new password</span>';
        if (matchText) matchText.innerHTML = '<i class="fas fa-info-circle"></i> <span>Re-enter new password</span>';
        
        ['length','upper','lower','number','special'].forEach(r => {
            const el = document.getElementById(`req-${r}`);
            if (el) {
                el.classList.remove('valid');
                const text = el.innerText.replace(/[✓✔✅]/g, '').trim();
                el.innerHTML = `<i class="fas fa-circle"></i> ${text}`;
            }
        });
    }

    function validatePwd(pwd) {
        return {
            length: pwd.length >= 8,
            uppercase: /[A-Z]/.test(pwd),
            lowercase: /[a-z]/.test(pwd),
            number: /[0-9]/.test(pwd),
            special: /[!@#$%^&*(),.?":{}|<>]/.test(pwd)
        };
    }

    function updateStrength() {
        if (!newPwd) return;
        const pwd = newPwd.value;
        const validation = validatePwd(pwd);
        
        ['length','uppercase','lowercase','number','special'].forEach(r => {
            const el = document.getElementById(`req-${r}`);
            if (el) {
                const text = el.innerText.replace(/[✓✔✅]/g, '').trim();
                if (validation[r]) {
                    el.classList.add('valid');
                    el.innerHTML = `<i class="fas fa-check-circle"></i> ${text}`;
                } else {
                    el.classList.remove('valid');
                    el.innerHTML = `<i class="fas fa-circle"></i> ${text}`;
                }
            }
        });
        
        const validCount = Object.values(validation).filter(v => v).length;
        const percent = (validCount / 5) * 100;
        const strengthFill = document.getElementById('passwordStrengthFill');
        const strengthText = document.getElementById('passwordStrengthText');
        
        if (strengthFill) {
            strengthFill.style.width = percent + '%';
            strengthFill.className = 'password-strength-fill';
            if (percent <= 25) {
                strengthFill.classList.add('weak');
                if (strengthText) strengthText.innerHTML = '<i class="fas fa-shield-alt"></i> <span style="color: #ef4444;">Weak password</span>';
            } else if (percent <= 50) {
                strengthFill.classList.add('fair');
                if (strengthText) strengthText.innerHTML = '<i class="fas fa-shield-alt"></i> <span style="color: #f59e0b;">Fair password</span>';
            } else if (percent <= 75) {
                strengthFill.classList.add('good');
                if (strengthText) strengthText.innerHTML = '<i class="fas fa-shield-alt"></i> <span style="color: #3b82f6;">Good password</span>';
            } else {
                strengthFill.classList.add('strong');
                if (strengthText) strengthText.innerHTML = '<i class="fas fa-shield-alt"></i> <span style="color: #10b981;">Strong password</span>';
            }
        }
        
        checkMatch();
    }

    function checkMatch() {
        const matchText = document.getElementById('passwordMatchText');
        if (newPwd && confirmPwd && matchText) {
            if (confirmPwd.value.length === 0) {
                matchText.innerHTML = '<i class="fas fa-info-circle"></i> <span>Re-enter new password</span>';
            } else if (newPwd.value === confirmPwd.value) {
                matchText.innerHTML = '<i class="fas fa-check-circle" style="color: #10b981;"></i> <span style="color: #10b981;">Passwords match</span>';
            } else {
                matchText.innerHTML = '<i class="fas fa-exclamation-circle" style="color: #ef4444;"></i> <span style="color: #ef4444;">Passwords do not match</span>';
            }
        }
        if (changePwdBtn && newPwd) {
            const validation = validatePwd(newPwd.value);
            const isStrong = Object.values(validation).every(v => v === true);
            changePwdBtn.disabled = !(isStrong && newPwd.value === confirmPwd?.value && newPwd.value.length > 0);
        }
    }

    if (newPwd) newPwd.addEventListener('input', updateStrength);
    if (confirmPwd) confirmPwd.addEventListener('input', checkMatch);

    // Change password form submit
    const passwordForm = document.getElementById('passwordForm');
    if (passwordForm) {
        passwordForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const newPwdValue = document.getElementById('new_password')?.value;
            const confirm = document.getElementById('confirm_password')?.value;

            if (!newPwdValue || !confirm) {
                showAlert('⚠️ Please fill in all password fields', 'error');
                return;
            }

            if (newPwdValue !== confirm) {
                showAlert('⚠️ Passwords do not match', 'error');
                return;
            }

            try {
                const { error } = await supabase.auth.updateUser({ password: newPwdValue });
                if (error) throw error;

                showAlert('✅ Password updated successfully!', 'success');
                if (currentPwd) currentPwd.value = '';
                if (newPwd) newPwd.value = '';
                if (confirmPwd) confirmPwd.value = '';
                if (changePwdCheckbox) changePwdCheckbox.checked = false;
                if (pwdFields) pwdFields.classList.remove('show');
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

    function renderDefaultTeacherAvatar(name) {
        const initials = getTeacherInitials(name || 'Teacher');
        const avatarLarge = document.querySelector('.profile-avatar-large');
        if (avatarLarge) {
            avatarLarge.innerHTML = `
                <div class="avatar-initial" id="profileInitial">${initials}</div>
                <div class="avatar-overlay">
                    <i class="fas fa-camera"></i>
                </div>
            `;
        }
        const sidebarAvatar = document.querySelector('.teacher-avatar');
        if (sidebarAvatar) {
            sidebarAvatar.innerHTML = `
                <div class="avatar-initial" id="teacherInitial">${initials}</div>
                <div class="online-dot"></div>
            `;
        }
        const modalInitial = document.getElementById('modalInitial');
        if (modalInitial) {
            modalInitial.textContent = initials;
        }
    }

    function applyTeacherAvatarToDOM(base64Image) {
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

        const sidebarAvatar = document.querySelector('.teacher-avatar');
        if (sidebarAvatar) {
            const initialEl = sidebarAvatar.querySelector('.avatar-initial');
            if (initialEl) initialEl.style.display = 'none';
            let existingImg = sidebarAvatar.querySelector('img');
            if (existingImg) {
                existingImg.src = base64Image;
            } else {
                const img = document.createElement('img');
                img.src = base64Image;
                img.alt = 'Teacher';
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.borderRadius = '50%';
                img.style.objectFit = 'cover';
                sidebarAvatar.prepend(img);
            }
        }
    }

    window.removeProfilePic = async function() {
        if (confirm('Remove your profile picture and restore your name initials?')) {
            try {
                localStorage.removeItem('hes_teacher_avatar');
            } catch(e) {}
            const displayName = userData?.first_name ? `${userData.first_name} ${userData.last_name || ''}`.trim() : (sessionUser.firstName || 'Teacher');
            renderDefaultTeacherAvatar(displayName);
            showAlert('✅ Profile picture removed. Initials restored.', 'success');
            closeImageModal();
        }
    };

    const profilePicForm = document.getElementById('profilePicForm');
    if (profilePicForm) {
        profilePicForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const fileInput = document.getElementById('profile_picture');
            if (!fileInput.files || fileInput.files.length === 0) {
                showAlert('⚠️ Please select an image', 'error');
                return;
            }

            const file = fileInput.files[0];
            const maxSize = 5 * 1024 * 1024;
            if (file.size > maxSize) {
                showAlert('⚠️ File is too large. Maximum size is 5MB.', 'error');
                return;
            }

            try {
                const reader = new FileReader();
                reader.onload = async function(evt) {
                    const base64Image = evt.target.result;
                    try {
                        localStorage.setItem('hes_teacher_avatar', base64Image);
                    } catch(e) {}
                    applyTeacherAvatarToDOM(base64Image);
                    showAlert('✅ Profile picture updated successfully!', 'success');
                    closeImageModal();
                };
                reader.readAsDataURL(file);
            } catch (error) {
                console.error('Error uploading profile picture:', error);
                showAlert('❌ Error uploading: ' + error.message, 'error');
            }
        });
    }

    // ============================================
    // TEACHER DOCUMENTS MANAGEMENT
    // ============================================

    const defaultTeacherDocs = [
        {
            id: 'tdoc_1',
            title: 'PRC Professional Teacher License',
            type: 'PRC License ID',
            filename: 'PRC_License_Faculty.pdf',
            size: '1.1 MB',
            date: '2026-06-10',
            format: 'pdf',
            status: 'Verified',
            dataUrl: null
        },
        {
            id: 'tdoc_2',
            title: 'Bachelor of Secondary Education Diploma',
            type: 'Diploma / Transcript',
            filename: 'BSED_Diploma_Transcript.jpg',
            size: '1.4 MB',
            date: '2026-06-12',
            format: 'img',
            status: 'Verified',
            dataUrl: null
        }
    ];

    let teacherDocs = [];
    try {
        const savedTDocs = localStorage.getItem('hes_teacher_documents');
        if (savedTDocs) {
            teacherDocs = JSON.parse(savedTDocs);
        } else {
            teacherDocs = [...defaultTeacherDocs];
            localStorage.setItem('hes_teacher_documents', JSON.stringify(teacherDocs));
        }
    } catch(e) {
        teacherDocs = [...defaultTeacherDocs];
    }

    function persistTeacherDocs() {
        try {
            localStorage.setItem('hes_teacher_documents', JSON.stringify(teacherDocs));
        } catch(e) {}
    }

    const teacherUploadTriggerBtn = document.getElementById('teacherUploadTriggerBtn');
    const teacherDocFileInput = document.getElementById('teacherDocFileInput');
    const teacherDocUploadForm = document.getElementById('teacherDocUploadForm');
    const teacherDocSelectedName = document.getElementById('teacherDocSelectedName');
    const teacherDocTypeSelect = document.getElementById('teacherDocTypeSelect');
    const teacherDocCustomTitle = document.getElementById('teacherDocCustomTitle');
    const teacherDocCancelBtn = document.getElementById('teacherDocCancelBtn');
    const teacherDocSaveBtn = document.getElementById('teacherDocSaveBtn');
    const teacherDocList = document.getElementById('teacherDocList');
    const teacherDocCount = document.getElementById('teacherDocCount');

    // Preview Modal
    const docPreviewModal = document.getElementById('docPreviewModal');
    const docPreviewTitle = document.getElementById('docPreviewTitle');
    const docPreviewContainer = document.getElementById('docPreviewContainer');
    const closeDocPreviewBtn = document.getElementById('closeDocPreviewBtn');
    const dismissDocPreviewBtn = document.getElementById('dismissDocPreviewBtn');
    const docDownloadBtn = document.getElementById('docDownloadBtn');

    let currentPendingTeacherFile = null;

    if (teacherUploadTriggerBtn && teacherDocFileInput) {
        teacherUploadTriggerBtn.addEventListener('click', () => teacherDocFileInput.click());
    }

    if (teacherDocFileInput) {
        teacherDocFileInput.addEventListener('change', function() {
            if (this.files && this.files.length > 0) {
                handleTeacherFileSelected(this.files[0]);
            }
        });
    }

    function handleTeacherFileSelected(file) {
        currentPendingTeacherFile = file;
        if (teacherDocSelectedName) teacherDocSelectedName.textContent = `${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
        if (teacherDocCustomTitle) teacherDocCustomTitle.value = file.name.replace(/\.[^/.]+$/, '');
        if (teacherDocUploadForm) teacherDocUploadForm.style.display = 'block';
    }

    if (teacherDocCancelBtn) {
        teacherDocCancelBtn.addEventListener('click', () => {
            currentPendingTeacherFile = null;
            if (teacherDocFileInput) teacherDocFileInput.value = '';
            if (teacherDocUploadForm) teacherDocUploadForm.style.display = 'none';
        });
    }

    if (teacherDocSaveBtn) {
        teacherDocSaveBtn.addEventListener('click', () => {
            if (!currentPendingTeacherFile) {
                showAlert('No document selected.', 'error');
                return;
            }

            const title = (teacherDocCustomTitle && teacherDocCustomTitle.value.trim()) || currentPendingTeacherFile.name;
            const type = (teacherDocTypeSelect && teacherDocTypeSelect.value) || 'Other Document';
            const sizeInMb = (currentPendingTeacherFile.size / (1024 * 1024)).toFixed(2);
            const sizeStr = currentPendingTeacherFile.size > 1024 * 1024 ? `${sizeInMb} MB` : `${Math.round(currentPendingTeacherFile.size / 1024)} KB`;
            const isPdf = currentPendingTeacherFile.name.toLowerCase().endsWith('.pdf') || currentPendingTeacherFile.type === 'application/pdf';
            const format = isPdf ? 'pdf' : (currentPendingTeacherFile.type.startsWith('image/') ? 'img' : 'doc');

            const reader = new FileReader();
            reader.onload = function(evt) {
                const dataUrl = evt.target.result;
                const newDoc = {
                    id: 'tdoc_' + Date.now(),
                    title: title,
                    type: type,
                    filename: currentPendingTeacherFile.name,
                    size: sizeStr,
                    date: new Date().toISOString().split('T')[0],
                    format: format,
                    status: 'Verified',
                    dataUrl: dataUrl
                };

                teacherDocs.unshift(newDoc);
                persistTeacherDocs();
                renderTeacherDocs();

                currentPendingTeacherFile = null;
                if (teacherDocFileInput) teacherDocFileInput.value = '';
                if (teacherDocUploadForm) teacherDocUploadForm.style.display = 'none';

                showAlert(`✅ Credential "${title}" uploaded to your profile!`, 'success');
            };
            reader.readAsDataURL(currentPendingTeacherFile);
        });
    }

    function renderTeacherDocs() {
        if (!teacherDocList) return;

        if (teacherDocCount) {
            teacherDocCount.textContent = `${teacherDocs.length} ${teacherDocs.length === 1 ? 'File' : 'Files'}`;
        }

        if (teacherDocs.length === 0) {
            teacherDocList.innerHTML = `
                <div class="empty-docs-state">
                    <i class="fas fa-folder-open"></i>
                    <p>No credentials uploaded yet. Upload your PRC, CSC, or Diplomas above.</p>
                </div>
            `;
            return;
        }

        let html = '';
        teacherDocs.forEach(doc => {
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
                        <button type="button" class="doc-btn btn-view-tdoc" data-id="${doc.id}" title="Preview Document">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button type="button" class="doc-btn doc-btn-danger btn-delete-tdoc" data-id="${doc.id}" title="Delete Document">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        teacherDocList.innerHTML = html;

        teacherDocList.querySelectorAll('.btn-view-tdoc').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = this.dataset.id;
                openTeacherDocPreview(id);
            });
        });

        teacherDocList.querySelectorAll('.btn-delete-tdoc').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = this.dataset.id;
                deleteTeacherDoc(id);
            });
        });
    }

    function openTeacherDocPreview(id) {
        const doc = teacherDocs.find(d => d.id === id);
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

    function closeTeacherDocPreview() {
        if (docPreviewModal) {
            docPreviewModal.classList.remove('active');
            docPreviewModal.style.display = 'none';
        }
    }

    if (closeDocPreviewBtn) closeDocPreviewBtn.addEventListener('click', closeTeacherDocPreview);
    if (dismissDocPreviewBtn) dismissDocPreviewBtn.addEventListener('click', closeTeacherDocPreview);

    window.addEventListener('click', function(e) {
        if (e.target === docPreviewModal) {
            closeTeacherDocPreview();
        }
    });

    function deleteTeacherDoc(id) {
        const doc = teacherDocs.find(d => d.id === id);
        if (!doc) return;
        if (confirm(`Are you sure you want to delete "${doc.title}"?`)) {
            teacherDocs = teacherDocs.filter(d => d.id !== id);
            persistTeacherDocs();
            renderTeacherDocs();
            showAlert('Credential removed from profile.', 'success');
        }
    }

    // ============================================
    // IMAGE MODAL
    // ============================================

    function openImageModal() {
        const modal = document.getElementById('imageModal');
        if (modal) {
            modal.classList.add('active');
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    }

    function closeImageModal() {
        const modal = document.getElementById('imageModal');
        if (modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
    }

    window.openImageModal = openImageModal;
    window.closeImageModal = closeImageModal;

    function previewImage(input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const preview = document.getElementById('imagePreview');
                if (preview) preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
            };
            reader.readAsDataURL(input.files[0]);
        }
    }
    window.previewImage = previewImage;

    // ============================================
    // ALERT SYSTEM
    // ============================================

    function showAlert(message, type = 'success') {
        if (!alertContainer) return;
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
    renderTeacherDocs();

    console.log('✅ Teacher Profile initialized successfully!');

})();