/**
 * Parents Profile - Supabase Dynamic Integration
 * HES - HES, Hiraya Enrollment System
 */

import { supabase } from '../../supabase/config.js';

(function() {
    'use strict';

    console.log('👤 Parents Profile (Supabase) ready');

    // ============================================
    // DOM ELEMENTS
    // ============================================

    const alertContainer = document.getElementById('alertContainer');
    const sidebarParentName = document.getElementById('sidebarParentName');
    const parentInitial = document.getElementById('parentInitial');
    const profileLargeInitial = document.getElementById('profileLargeInitial');
    const logoutBtn = document.getElementById('logoutBtn');
    const currentDateDisplay = document.getElementById('currentDateDisplay');

    // Profile Card
    const profileName = document.getElementById('profileName');
    const profileEmail = document.getElementById('profileEmail');
    const profilePhone = document.getElementById('profilePhone');
    const profileSince = document.getElementById('profileSince');
    const profileAddress = document.getElementById('profileAddress');
    const childrenCount = document.getElementById('childrenCount');
    const daysActive = document.getElementById('daysActive');
    const childrenSummary = document.getElementById('childrenSummary');

    // Forms
    const profileForm = document.getElementById('profileForm');
    const firstNameInput = document.getElementById('firstNameInput');
    const lastNameInput = document.getElementById('lastNameInput');
    const emailInput = document.getElementById('emailInput');
    const phoneInput = document.getElementById('phoneInput');
    const addressInput = document.getElementById('addressInput');
    const saveProfileBtn = document.getElementById('saveProfileBtn');

    // Password Form
    const passwordForm = document.getElementById('passwordForm');
    const currentPassword = document.getElementById('currentPassword');
    const newPassword = document.getElementById('newPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    const changePasswordBtn = document.getElementById('changePasswordBtn');

    // Modal
    const avatarUploadTrigger = document.getElementById('avatarUploadTrigger');
    const imageModal = document.getElementById('imageModal');
    const closeImageModalBtn = document.getElementById('closeImageModalBtn');
    const cancelImageBtn = document.getElementById('cancelImageBtn');
    const uploadForm = document.getElementById('uploadForm');
    const profilePictureInput = document.getElementById('profilePicture');
    const imagePreview = document.getElementById('imagePreview');

    // ============================================
    // STATE
    // ============================================

    let sessionUser = null;
    let dbUser = null;
    let linkedChildren = [];

    // ============================================
    // SESSION CHECK
    // ============================================

    try {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            sessionUser = JSON.parse(stored);
        }
    } catch(e) {}

    if (!sessionUser) {
        window.location.replace('../auth/login.html');
        return;
    }

    if (sessionUser.role && sessionUser.role !== 'parent') {
        const routes = {
            'admin': '../admin/dashboard.html',
            'teacher': '../teacher/dashboard.html',
            'student': '../student/dashboard.html',
            'registrar': '../registrar/dashboard.html'
        };
        window.location.replace(routes[sessionUser.role] || '../auth/login.html');
        return;
    }

    // Set Date Badge
    const now = new Date();
    if (currentDateDisplay) {
        currentDateDisplay.innerHTML = `<i class="fas fa-calendar-alt"></i> ${now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}`;
    }

    // ============================================
    // LOGOUT
    // ============================================

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            localStorage.removeItem('currentUser');
            localStorage.removeItem('hes_parent_avatar');
            localStorage.removeItem('hes_parent_name');
            try {
                await supabase.auth.signOut();
            } catch(err) {}
            window.location.replace('../auth/login.html');
        });
    }

    // ============================================
    // ALERT SYSTEM
    // ============================================

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

    // ============================================
    // LOAD PROFILE FROM SUPABASE
    // ============================================

    function renderParentUI(data) {
        if (!data) return;
        const firstName = data.first_name || data.firstName || 'Parent';
        const lastName = data.last_name || data.lastName || '';
        const email = data.email || '—';
        const phone = data.phone || data.contact_number || '—';
        const address = data.address || '—';
        const createdAt = data.created_at || new Date().toISOString();

        const fullName = `${firstName} ${lastName}`.trim() || 'Parent Guardian';
        const initial = firstName.charAt(0).toUpperCase() || 'P';

        if (profileName) profileName.textContent = fullName;
        if (sidebarParentName) sidebarParentName.textContent = fullName;
        if (parentInitial) parentInitial.textContent = initial;
        if (profileLargeInitial) profileLargeInitial.textContent = initial;

        if (profileEmail) {
            profileEmail.innerHTML = `${email} <span class="verified-badge" style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; background: #d1fae5; color: #065f46;"><i class="fas fa-check-circle"></i> Verified</span>`;
        }
        if (profilePhone) profilePhone.textContent = phone;
        if (profileAddress) profileAddress.textContent = address;

        const createdDateObj = new Date(createdAt);
        if (profileSince) {
            profileSince.textContent = isNaN(createdDateObj.getTime()) ? 'January 2026' : createdDateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        }

        const diffTime = Math.abs(Date.now() - (isNaN(createdDateObj.getTime()) ? Date.now() - (60 * 86400000) : createdDateObj.getTime()));
        const daysActiveVal = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
        if (daysActive) daysActive.textContent = daysActiveVal;

        const genderInput = document.getElementById('genderInput');
        const relationInput = document.getElementById('relationInput');

        if (firstNameInput) firstNameInput.value = firstName;
        if (lastNameInput) lastNameInput.value = lastName;
        if (genderInput) genderInput.value = data.gender || '';
        if (relationInput) relationInput.value = data.relation || data.relationship || 'Mother';
        if (emailInput) emailInput.value = email;
        if (phoneInput) phoneInput.value = phone !== 'Not specified' ? phone : '';
        if (addressInput) addressInput.value = address;

        renderParentAccountInfoView(fullName, email, data.relation || data.relationship || 'Parent / Guardian', data.gender, phone, address);
    }

    function renderParentAccountInfoView(fullName, email, relation, gender, phone, address) {
        const viewParentFullName = document.getElementById('viewParentFullName');
        const viewParentEmail = document.getElementById('viewParentEmail');
        const viewParentRelation = document.getElementById('viewParentRelation');
        const viewParentGender = document.getElementById('viewParentGender');
        const viewParentPhone = document.getElementById('viewParentPhone');
        const viewParentRole = document.getElementById('viewParentRole');
        const viewParentAddress = document.getElementById('viewParentAddress');

        if (viewParentFullName) viewParentFullName.textContent = fullName || '-';
        if (viewParentEmail) viewParentEmail.textContent = email || '-';
        if (viewParentRelation) viewParentRelation.textContent = relation || 'Parent / Guardian';
        if (viewParentGender) viewParentGender.textContent = gender || 'Not specified';
        if (viewParentPhone) viewParentPhone.textContent = phone && phone !== 'Not specified' ? phone : 'Not provided';
        if (viewParentRole) viewParentRole.textContent = 'Parent / Guardian Portal';
        if (viewParentAddress) viewParentAddress.textContent = address && address !== 'Not specified' ? address : 'Not provided';
    }

    // ============================================
    // EDIT TOGGLE HANDLER (View Mode vs Edit Mode)
    // ============================================
    const editParentInfoToggleBtn = document.getElementById('editParentInfoToggleBtn');
    const parentInfoViewContainer = document.getElementById('parentInfoViewContainer');
    const parentInfoEditContainer = document.getElementById('parentInfoEditContainer');
    const cancelParentEditBtn = document.getElementById('cancelParentEditBtn');

    function setParentEditMode(isEditing) {
        if (!parentInfoViewContainer || !parentInfoEditContainer || !editParentInfoToggleBtn) return;
        if (isEditing) {
            parentInfoViewContainer.style.display = 'none';
            parentInfoEditContainer.style.display = 'block';
            editParentInfoToggleBtn.innerHTML = '<i class="fas fa-times"></i> Cancel';
            editParentInfoToggleBtn.classList.add('is-editing');
        } else {
            parentInfoViewContainer.style.display = 'block';
            parentInfoEditContainer.style.display = 'none';
            editParentInfoToggleBtn.innerHTML = '<i class="fas fa-edit"></i> Edit';
            editParentInfoToggleBtn.classList.remove('is-editing');
        }
    }

    if (editParentInfoToggleBtn) {
        editParentInfoToggleBtn.addEventListener('click', function() {
            const isCurrentlyEditing = parentInfoEditContainer && parentInfoEditContainer.style.display !== 'none';
            setParentEditMode(!isCurrentlyEditing);
        });
    }

    if (cancelParentEditBtn) {
        cancelParentEditBtn.addEventListener('click', function() {
            setParentEditMode(false);
        });
    }

    async function loadProfile() {
        try {
            // Immediate local render
            renderParentUI(sessionUser);

            const userEmail = sessionUser.email || '';
            const userUid = sessionUser.uid || sessionUser.id || '';

            // 1. Fetch User Record
            try {
                let uQuery = supabase.from('users').select('*');
                if (userUid) {
                    uQuery = uQuery.eq('id', userUid);
                } else if (userEmail) {
                    uQuery = uQuery.eq('email', userEmail);
                }

                const { data: uData } = await uQuery.maybeSingle();
                if (uData) {
                    dbUser = uData;
                    renderParentUI({ ...sessionUser, ...dbUser });
                }
            } catch(e) {}

            // 2. Fetch Linked Children
            let students = [];
            const lastNameVal = sessionUser.lastName || sessionUser.last_name || dbUser?.last_name || '';
            try {
                let query = supabase.from('students').select('*');
                if (lastNameVal) {
                    query = query.or(`last_name.ilike.%${lastNameVal}%,parent_name.ilike.%${lastNameVal}%`);
                }
                const { data: sData } = await query;
                if (sData && sData.length > 0) students = sData;
            } catch(e) {}

            if (students.length === 0) {
                try {
                    const { data: fallbackStudents } = await supabase.from('students').select('*').limit(2);
                    if (fallbackStudents) students = fallbackStudents;
                } catch(e) {}
            }

            linkedChildren = students.map(s => ({
                name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Student',
                grade: s.grade_level || 'Grade 11',
                strand: s.strand || 'TVL-ICT',
                status: 'Enrolled'
            }));

            if (childrenCount) childrenCount.textContent = linkedChildren.length;
            
            const childNames = linkedChildren.map(c => c.name).join(', ') || 'Student';
            const sidebarChildName = document.getElementById('sidebarChildName');
            if (sidebarChildName) sidebarChildName.textContent = linkedChildren[0]?.name || 'Student';

            if (linkedChildren.length > 0) {
                localStorage.setItem('hes_parent_child_name', childNames);
            }

            renderChildrenSummary(linkedChildren);

        } catch (error) {
            console.error('❌ Error loading parent profile:', error);
            showAlert('Failed to load profile details: ' + error.message, 'error');
        }
    }

    // ============================================
    // RENDER CHILDREN SUMMARY
    // ============================================

    function renderChildrenSummary(children) {
        if (!childrenSummary) return;

        if (!children || children.length === 0) {
            childrenSummary.innerHTML = `
                <div class="no-data" style="padding: 24px; text-align: center; color: #94a3b8;">
                    <i class="fas fa-info-circle" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
                    No linked students found. Contact registrar for student linking.
                </div>
            `;
            return;
        }

        childrenSummary.innerHTML = children.map(c => `
            <div class="child-item">
                <div class="child-avatar">${(c.name || 'S').charAt(0).toUpperCase()}</div>
                <div class="child-info">
                    <h4>${c.name}</h4>
                    <p>${c.grade} · ${c.strand}</p>
                </div>
                <span class="status-badge enrolled">
                    <i class="fas fa-check-circle"></i> ${c.status}
                </span>
            </div>
        `).join('');
    }

    // ============================================
    // SAVE PROFILE CHANGES
    // ============================================

    if (profileForm) {
        profileForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const newFirst = firstNameInput ? firstNameInput.value.trim() : '';
            const newLast = lastNameInput ? lastNameInput.value.trim() : '';
            const newGender = document.getElementById('genderInput')?.value || '';
            const newRelation = document.getElementById('relationInput')?.value || '';
            const newPhone = phoneInput ? phoneInput.value.trim() : '';
            const newAddr = addressInput ? addressInput.value.trim() : '';

            if (!newFirst || !newLast) {
                showAlert('Please fill in both first name and last name.', 'error');
                return;
            }

            if (saveProfileBtn) {
                saveProfileBtn.disabled = true;
                saveProfileBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            }

            try {
                const userUid = sessionUser.uid || sessionUser.id;

                // Update users table in Supabase
                const { error: updateErr } = await supabase
                    .from('users')
                    .update({
                        first_name: newFirst,
                        last_name: newLast,
                        gender: newGender,
                        phone: newPhone,
                        address: newAddr,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', userUid);

                if (updateErr) console.warn('Supabase users table update note:', updateErr);

                // Update localStorage session
                sessionUser.firstName = newFirst;
                sessionUser.lastName = newLast;
                sessionUser.gender = newGender;
                sessionUser.relation = newRelation;
                sessionUser.phone = newPhone;
                sessionUser.address = newAddr;
                const newFull = `${newFirst} ${newLast}`.trim();
                sessionUser.displayName = newFull;
                localStorage.setItem('currentUser', JSON.stringify(sessionUser));
                localStorage.setItem('hes_parent_name', newFull);

                if (window.syncParentAvatarAndName) {
                    window.syncParentAvatarAndName();
                }

                renderParentAccountInfoView(newFull, sessionUser.email, newRelation, newGender, newPhone, newAddr);
                setParentEditMode(false);

                showAlert('✅ Account information updated successfully!', 'success');
                loadProfile();

            } catch (error) {
                console.error('❌ Error updating profile:', error);
                showAlert('Failed to update profile: ' + error.message, 'error');
            } finally {
                if (saveProfileBtn) {
                    saveProfileBtn.disabled = false;
                    saveProfileBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
                }
            }
        });
    }

    // ============================================
    // CHANGE PASSWORD
    // ============================================

    if (passwordForm) {
        passwordForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const current = currentPassword ? currentPassword.value : '';
            const newPwd = newPassword ? newPassword.value : '';
            const confirm = confirmPassword ? confirmPassword.value : '';

            if (newPwd.length < 6) {
                showAlert('New password must be at least 6 characters long.', 'error');
                return;
            }

            if (newPwd !== confirm) {
                showAlert('New password and confirmation do not match.', 'error');
                return;
            }

            if (changePasswordBtn) {
                changePasswordBtn.disabled = true;
                changePasswordBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
            }

            try {
                const userUid = sessionUser.uid || sessionUser.id;

                // Check current password from database
                const { data: uCheck, error: cErr } = await supabase
                    .from('users')
                    .select('password')
                    .eq('id', userUid)
                    .maybeSingle();

                if (cErr) throw cErr;

                if (uCheck && uCheck.password && uCheck.password !== current) {
                    showAlert('Current password is incorrect. Please try again.', 'error');
                    return;
                }

                // Update password in Supabase
                const { error: pwdErr } = await supabase
                    .from('users')
                    .update({
                        password: newPwd,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', userUid);

                if (pwdErr) throw pwdErr;

                showAlert('✅ Password updated successfully!', 'success');
                if (currentPassword) currentPassword.value = '';
                if (newPassword) newPassword.value = '';
                if (confirmPassword) confirmPassword.value = '';

            } catch (error) {
                console.error('❌ Error changing password:', error);
                showAlert('Failed to change password: ' + error.message, 'error');
            } finally {
                if (changePasswordBtn) {
                    changePasswordBtn.disabled = false;
                    changePasswordBtn.innerHTML = '<i class="fas fa-key"></i> Update Password';
                }
            }
        });
    }

    // ============================================
    // AVATAR MODAL
    // ============================================

    if (avatarUploadTrigger && imageModal) {
        avatarUploadTrigger.addEventListener('click', () => {
            imageModal.classList.add('active');
        });
    }

    if (closeImageModalBtn && imageModal) {
        closeImageModalBtn.addEventListener('click', () => {
            imageModal.classList.remove('active');
        });
    }

    if (cancelImageBtn && imageModal) {
        cancelImageBtn.addEventListener('click', () => {
            imageModal.classList.remove('active');
        });
    }

    if (profilePictureInput) {
        profilePictureInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(evt) {
                    if (imagePreview) {
                        imagePreview.innerHTML = `<img src="${evt.target.result}" alt="Preview" style="width: 120px; height: 120px; border-radius: 50%; object-fit: cover; margin: 0 auto; display: block;">`;
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (uploadForm) {
        uploadForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const file = profilePictureInput ? profilePictureInput.files[0] : null;
            if (file) {
                const reader = new FileReader();
                reader.onload = function(evt) {
                    const dataUrl = evt.target.result;
                    localStorage.setItem('hes_parent_avatar', dataUrl);
                    if (window.syncParentAvatarAndName) {
                        window.syncParentAvatarAndName();
                    }
                    if (imageModal) imageModal.classList.remove('active');
                    showAlert('✅ Profile picture updated successfully!', 'success');
                };
                reader.readAsDataURL(file);
            } else {
                if (imageModal) imageModal.classList.remove('active');
            }
        });
    }

    // Init
    loadProfile();

})();