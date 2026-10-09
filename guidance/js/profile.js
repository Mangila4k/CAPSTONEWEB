// ===== GUIDANCE COUNSELOR PROFILE CONTROLLER =====
import { supabase } from '../../supabase/config.js';

document.addEventListener('DOMContentLoaded', async function() {
    'use strict';

    // 1. Session Check
    let currentUser = null;
    try {
        const raw = localStorage.getItem('currentUser');
        if (raw) currentUser = JSON.parse(raw);
    } catch (e) {
        console.warn('Session parse warning:', e);
    }

    if (!currentUser) {
        window.location.replace('../auth/login.html');
        return;
    }

    // Set Counselor Profile in Sidebar
    const counselorNameEl = document.getElementById('counselorName');
    const counselorAvatarEl = document.getElementById('counselorAvatar');
    const displayName = currentUser.displayName || `${currentUser.firstName || 'Sarah'} ${currentUser.lastName || 'Counselor'}`.trim() || 'Guidance Counselor';
    
    if (counselorNameEl) counselorNameEl.textContent = displayName;
    if (counselorAvatarEl) counselorAvatarEl.textContent = (displayName[0] || 'G').toUpperCase();

    // Mobile Sidebar Toggle
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }

    // DOM Elements
    const alertContainer = document.getElementById('alertContainer');
    const profileCardName = document.getElementById('profileCardName');
    const profileCardEmail = document.getElementById('profileCardEmail');
    const profileCardPhone = document.getElementById('profileCardPhone');
    const profileLargeAvatar = document.getElementById('profileLargeAvatar');

    const profFirstName = document.getElementById('profFirstName');
    const profLastName = document.getElementById('profLastName');
    const profEmail = document.getElementById('profEmail');
    const profContact = document.getElementById('profContact');
    const profileForm = document.getElementById('profileForm');
    const saveProfileBtn = document.getElementById('saveProfileBtn');

    const passwordForm = document.getElementById('passwordForm');
    const newPassword = document.getElementById('newPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    const changePasswordBtn = document.getElementById('changePasswordBtn');

    function showAlert(message, type = 'success') {
        if (!alertContainer) return;
        const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';
        alertContainer.innerHTML = `
            <div class="alert alert-${type}">
                <i class="fas ${icon}"></i>
                <span>${message}</span>
            </div>
        `;
        setTimeout(() => {
            if (alertContainer) alertContainer.innerHTML = '';
        }, 5000);
    }

    // 2. Load User Profile from Database
    async function loadProfile() {
        try {
            const { data: user, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', currentUser.id)
                .maybeSingle();

            if (user) {
                const fName = user.first_name || currentUser.firstName || 'Sarah';
                const lName = user.last_name || currentUser.lastName || 'Counselor';
                const email = user.email || currentUser.email || 'guidance@hiraya.edu.ph';
                const phone = user.contact_number || '09123456789';
                const full = `${fName} ${lName}`.trim();

                if (profFirstName) profFirstName.value = fName;
                if (profLastName) profLastName.value = lName;
                if (profEmail) profEmail.value = email;
                if (profContact) profContact.value = phone;

                if (profileCardName) profileCardName.textContent = full;
                if (profileCardEmail) profileCardEmail.textContent = email;
                if (profileCardPhone) profileCardPhone.textContent = phone;
                if (profileLargeAvatar) profileLargeAvatar.textContent = (full[0] || 'S').toUpperCase();
            }
        } catch (err) {
            console.warn('Profile load warning:', err);
        }
    }

    // 3. Save Profile
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const fn = profFirstName.value.trim();
            const ln = profLastName.value.trim();
            const phone = profContact.value.trim();
            const full = `${fn} ${ln}`.trim();

            saveProfileBtn.disabled = true;
            saveProfileBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Saving...`;

            try {
                const { error } = await supabase
                    .from('users')
                    .update({
                        first_name: fn,
                        last_name: ln,
                        contact_number: phone,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', currentUser.id);

                if (error) throw error;

                // Update session
                currentUser.firstName = fn;
                currentUser.lastName = ln;
                currentUser.displayName = full;
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                localStorage.setItem('hes_guidance_name', full);

                if (counselorNameEl) counselorNameEl.textContent = full;
                if (counselorAvatarEl) counselorAvatarEl.textContent = (full[0] || 'G').toUpperCase();
                if (profileCardName) profileCardName.textContent = full;
                if (profileCardPhone) profileCardPhone.textContent = phone;
                if (profileLargeAvatar) profileLargeAvatar.textContent = (full[0] || 'S').toUpperCase();

                showAlert('Profile updated successfully!', 'success');

            } catch (err) {
                console.error('Error updating profile:', err);
                showAlert('Failed to update profile: ' + err.message, 'error');
            } finally {
                saveProfileBtn.disabled = false;
                saveProfileBtn.innerHTML = `<i class="fas fa-save"></i> Update Profile Details`;
            }
        });
    }

    // 4. Change Password
    if (passwordForm) {
        passwordForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const p1 = newPassword.value;
            const p2 = confirmPassword.value;

            if (p1 !== p2) {
                showAlert('Passwords do not match. Please re-enter.', 'error');
                return;
            }

            if (p1.length < 6) {
                showAlert('Password must be at least 6 characters long.', 'error');
                return;
            }

            changePasswordBtn.disabled = true;
            changePasswordBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Changing Password...`;

            try {
                const { error } = await supabase
                    .from('users')
                    .update({
                        password: p1,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', currentUser.id);

                if (error) throw error;

                passwordForm.reset();
                showAlert('✅ Password updated successfully! Keep your credentials secure.', 'success');

            } catch (err) {
                console.error('Error changing password:', err);
                showAlert('Failed to change password: ' + err.message, 'error');
            } finally {
                changePasswordBtn.disabled = false;
                changePasswordBtn.innerHTML = `<i class="fas fa-key"></i> Change Password`;
            }
        });
    }

    // Initial Load
    await loadProfile();
});
