/**
 * HES Admin - Edit Student (Supabase Dynamic Integration)
 */

import { supabase } from '../../supabase/config.js';

(function() {
    'use strict';

    console.log('✏️ Admin Edit Student (Supabase) ready');

    // ============================================
    // ROLE & SESSION GUARD
    // ============================================

    let currentUser = null;
    const currentUserStr = localStorage.getItem('currentUser');
    if (currentUserStr) {
        try {
            currentUser = JSON.parse(currentUserStr);
        } catch (e) {
            console.warn('Session parse error:', e);
        }
    }

    if (!currentUser) {
        currentUser = {
            role: 'admin',
            email: 'admin@hiraya.edu.ph',
            displayName: localStorage.getItem('hes_admin_name') || 'Admin',
            firstName: localStorage.getItem('hes_admin_name') || 'Admin'
        };
    }

    // ============================================
    // DOM ELEMENTS
    // ============================================

    const firstnameInput = document.getElementById('firstname');
    const middlenameInput = document.getElementById('middlename');
    const lastnameInput = document.getElementById('lastname');
    const birthdateInput = document.getElementById('birthdate');
    const genderSelect = document.getElementById('gender');
    const emailInput = document.getElementById('email');
    const previewName = document.getElementById('previewName');
    const previewEmail = document.getElementById('previewEmail');
    const previewInitial = document.getElementById('previewInitial');
    const previewAge = document.getElementById('previewAge');
    const previewGender = document.getElementById('previewGender');
    const editForm = document.getElementById('editStudentForm');
    const alertContainer = document.getElementById('alertContainer');
    
    const resetCheckbox = document.getElementById('resetPasswordCheckbox');
    const newPassword = document.getElementById('newPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    const resetBtn = document.getElementById('resetPasswordBtn');
    const strengthBar = document.getElementById('strengthBar');
    const strengthText = document.getElementById('strengthText');
    const passwordMatch = document.getElementById('passwordMatch');
    const passwordFields = document.getElementById('passwordFields');

    // Mobile Menu
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');

    // ============================================
    // STATE
    // ============================================

    let currentStudent = null;
    let currentUserId = null;

    // ============================================
    // FUNCTIONS
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

    function calculateAge(birthdate) {
        if (!birthdate) return 'Unknown';
        try {
            const birth = new Date(birthdate);
            if (isNaN(birth.getTime())) return 'Unknown';
            const today = new Date();
            let age = today.getFullYear() - birth.getFullYear();
            const m = today.getMonth() - birth.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
                age--;
            }
            return (age >= 0 ? age : 0) + ' years old';
        } catch {
            return 'Unknown';
        }
    }

    function updatePreview() {
        const firstname = firstnameInput ? firstnameInput.value.trim() : '';
        const middlename = middlenameInput ? middlenameInput.value.trim() : '';
        const lastname = lastnameInput ? lastnameInput.value.trim() : '';
        const fullname = `${firstname} ${middlename ? middlename + ' ' : ''}${lastname}`.trim();
        
        if (previewName) previewName.textContent = fullname || 'Student Name';
        
        const initial = firstname.charAt(0).toUpperCase() || 'S';
        if (previewInitial) previewInitial.textContent = initial;

        const email = emailInput ? emailInput.value.trim() : 'student@plshs.edu.ph';
        if (previewEmail) previewEmail.innerHTML = `<i class="fas fa-envelope"></i> ${email}`;

        const birthdate = birthdateInput ? birthdateInput.value : '';
        if (previewAge) previewAge.textContent = birthdate ? calculateAge(birthdate) : 'Unknown age';

        const gender = genderSelect ? genderSelect.value : 'Not set';
        if (previewGender) previewGender.textContent = gender || 'Not set';
    }

    // Toggle password visibility
    window.togglePassword = function() {
        const passwordInput = document.getElementById('newPassword');
        const toggleBtn = document.querySelector('.toggle-password i');
        
        if (passwordInput && toggleBtn) {
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                toggleBtn.className = 'fas fa-eye-slash';
            } else {
                passwordInput.type = 'password';
                toggleBtn.className = 'fas fa-eye';
            }
        }
    };

    function checkPasswordStrength() {
        if (!newPassword) return;
        const password = newPassword.value;
        let strength = 0;
        let strengthLabel = '';
        let strengthColor = '';

        if (password.length >= 6) strength += 1;
        if (password.match(/[a-z]+/)) strength += 1;
        if (password.match(/[A-Z]+/)) strength += 1;
        if (password.match(/[0-9]+/)) strength += 1;
        if (password.match(/[!@#$%^&*(),.?":{}|<>]+/)) strength += 1;

        if (password.length === 0) {
            if (strengthBar) strengthBar.style.width = '0';
            if (strengthText) strengthText.innerHTML = '<i class="fas fa-info-circle"></i> <span>Minimum 6 characters</span>';
            return;
        }

        if (strength <= 2) {
            if (strengthBar) {
                strengthBar.style.width = '30%';
                strengthBar.style.backgroundColor = '#ef4444';
            }
            strengthLabel = 'Weak';
            strengthColor = '#ef4444';
        } else if (strength <= 4) {
            if (strengthBar) {
                strengthBar.style.width = '65%';
                strengthBar.style.backgroundColor = '#f59e0b';
            }
            strengthLabel = 'Medium';
            strengthColor = '#f59e0b';
        } else {
            if (strengthBar) {
                strengthBar.style.width = '100%';
                strengthBar.style.backgroundColor = '#10b981';
            }
            strengthLabel = 'Strong';
            strengthColor = '#10b981';
        }

        if (strengthText) {
            strengthText.innerHTML = `<i class="fas fa-shield-alt"></i> <span style="color: ${strengthColor};">Password strength: ${strengthLabel}</span>`;
        }
    }

    function checkPasswordMatch() {
        if (!newPassword || !confirmPassword || !passwordMatch) return;
        const password = newPassword.value;
        const confirm = confirmPassword.value;

        if (confirm.length === 0) {
            passwordMatch.innerHTML = '<i class="fas fa-info-circle"></i> <span>Re-enter new password</span>';
            return;
        }

        if (password === confirm) {
            passwordMatch.innerHTML = '<i class="fas fa-check-circle" style="color: #10b981;"></i> <span style="color: #10b981;">Passwords match</span>';
        } else {
            passwordMatch.innerHTML = '<i class="fas fa-times-circle" style="color: #ef4444;"></i> <span style="color: #ef4444;">Passwords do not match</span>';
        }
    }

    // ============================================
    // LOAD STUDENT FROM SUPABASE
    // ============================================

    async function loadStudent() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const targetId = urlParams.get('id') || urlParams.get('student_id') || '';

            let student = null;
            if (targetId) {
                try {
                    const { data: sData } = await supabase
                        .from('students')
                        .select('*')
                        .or(`id.eq.${targetId},lrn.eq.${targetId}`)
                        .maybeSingle();
                    if (sData) student = sData;
                } catch(e) {}
            }

            if (!student) {
                const { data: sList } = await supabase.from('students').select('*').limit(1);
                if (sList && sList.length > 0) student = sList[0];
            }

            if (!student) {
                showAlert('No student profile found.', 'error');
                return;
            }

            currentStudent = student;

            // Fetch user record for this student
            try {
                const { data: uData } = await supabase
                    .from('users')
                    .select('*')
                    .or(`student_id.eq.${student.id},email.eq.${student.email}`)
                    .maybeSingle();
                if (uData) currentUserId = uData.id;
            } catch(e) {}

            // Populate form
            if (firstnameInput) firstnameInput.value = student.first_name || '';
            if (middlenameInput) middlenameInput.value = student.middle_name || '';
            if (lastnameInput) lastnameInput.value = student.last_name || '';
            if (birthdateInput) birthdateInput.value = student.date_of_birth || student.birth_date || '';
            if (genderSelect) genderSelect.value = student.gender || 'Male';
            if (emailInput) emailInput.value = student.email || '';

            updatePreview();

        } catch (error) {
            console.error('❌ Error loading student profile:', error);
            showAlert('Failed to load student: ' + error.message, 'error');
        }
    }

    // ============================================
    // SAVE STUDENT FORM
    // ============================================

    if (editForm) {
        editForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            if (!currentStudent) return;

            const firstname = firstnameInput ? firstnameInput.value.trim() : '';
            const middlename = middlenameInput ? middlenameInput.value.trim() : '';
            const lastname = lastnameInput ? lastnameInput.value.trim() : '';
            const birthdate = birthdateInput ? birthdateInput.value : '';
            const gender = genderSelect ? genderSelect.value : 'Male';
            const email = emailInput ? emailInput.value.trim() : '';

            if (!firstname || !lastname || !email) {
                showAlert('Please fill in all required fields (First Name, Last Name, Email).', 'error');
                return;
            }

            const submitBtn = editForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            }

            try {
                // 1. Update students table
                const { error: sErr } = await supabase
                    .from('students')
                    .update({
                        first_name: firstname,
                        middle_name: middlename,
                        last_name: lastname,
                        date_of_birth: birthdate || null,
                        birth_date: birthdate || null,
                        gender: gender,
                        email: email,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', currentStudent.id);

                if (sErr) throw sErr;

                // 2. Update users table if user exists
                if (currentUserId) {
                    await supabase
                        .from('users')
                        .update({
                            first_name: firstname,
                            last_name: lastname,
                            email: email,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', currentUserId);
                }

                showAlert('✅ Student information updated successfully!', 'success');
                updatePreview();
                window.scrollTo({ top: 0, behavior: 'smooth' });

            } catch (error) {
                console.error('❌ Error updating student:', error);
                showAlert('Failed to save changes: ' + error.message, 'error');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
                }
            }
        });
    }

    // ============================================
    // PASSWORD RESET
    // ============================================

    if (resetCheckbox) {
        resetCheckbox.addEventListener('change', function() {
            const isChecked = this.checked;
            if (newPassword) newPassword.disabled = !isChecked;
            if (confirmPassword) confirmPassword.disabled = !isChecked;
            if (resetBtn) resetBtn.disabled = !isChecked;
            if (passwordFields) passwordFields.classList.toggle('active', isChecked);
            if (isChecked && newPassword) newPassword.focus();
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

    if (resetBtn) {
        resetBtn.addEventListener('click', async function(e) {
            e.preventDefault();

            if (!resetCheckbox.checked) {
                showAlert('Please check the "Reset student password" checkbox first.', 'error');
                return;
            }

            const password = newPassword ? newPassword.value : '';
            const confirm = confirmPassword ? confirmPassword.value : '';

            if (!password || password.length < 6) {
                showAlert('New password must be at least 6 characters long.', 'error');
                return;
            }

            if (password !== confirm) {
                showAlert('Passwords do not match.', 'error');
                return;
            }

            resetBtn.disabled = true;
            resetBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resetting...';

            try {
                const targetEmail = emailInput ? emailInput.value.trim() : (currentStudent?.email || '');

                const { error: pErr } = await supabase
                    .from('users')
                    .update({
                        password: password,
                        updated_at: new Date().toISOString()
                    })
                    .or(`student_id.eq.${currentStudent.id},email.eq.${targetEmail}`);

                if (pErr) throw pErr;

                showAlert('✅ Student password reset successfully!', 'success');

                if (newPassword) newPassword.value = '';
                if (confirmPassword) confirmPassword.value = '';
                if (resetCheckbox) resetCheckbox.checked = false;
                if (newPassword) newPassword.disabled = true;
                if (confirmPassword) confirmPassword.disabled = true;
                if (passwordFields) passwordFields.classList.remove('active');

            } catch (error) {
                console.error('❌ Error resetting password:', error);
                showAlert('Failed to reset password: ' + error.message, 'error');
            } finally {
                resetBtn.disabled = false;
                resetBtn.innerHTML = '<i class="fas fa-key"></i> Reset Password';
            }
        });
    }

    // Input listeners for preview
    [firstnameInput, middlenameInput, lastnameInput, birthdateInput, genderSelect, emailInput].forEach(el => {
        if (el) el.addEventListener('input', updatePreview);
    });

    // ============================================
    // MOBILE MENU
    // ============================================

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            sidebar.classList.toggle('active');
        });
    }

    document.addEventListener('click', function(e) {
        if (sidebar && sidebar.classList.contains('active') && !sidebar.contains(e.target) && (!menuToggle || !menuToggle.contains(e.target))) {
            sidebar.classList.remove('active');
        }
    });

    // ============================================
    // INIT
    // ============================================

    loadStudent();

})();