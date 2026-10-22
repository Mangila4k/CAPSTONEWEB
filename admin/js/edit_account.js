// ===== EDIT ACCOUNT JAVASCRIPT (SUPABASE POWERED) =====
import { supabase } from '../../supabase/config.js';

document.addEventListener('DOMContentLoaded', async function() {
    // DOM Elements
    const fullnameInput = document.getElementById('fullname');
    const emailInput = document.getElementById('email');
    const roleSelect = document.getElementById('role');
    const idNumberInput = document.getElementById('id_number');
    const previewName = document.getElementById('previewName');
    const previewEmail = document.getElementById('previewEmail');
    const previewRole = document.getElementById('previewRole');
    const previewInitial = document.getElementById('previewInitial');
    const editForm = document.getElementById('editAccountForm');
    const passwordForm = document.getElementById('passwordForm');
    const alertContainer = document.getElementById('alertContainer');
    
    const resetCheckbox = document.getElementById('resetPasswordCheckbox');
    const newPassword = document.getElementById('newPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    const resetBtn = document.getElementById('resetPasswordBtn');
    const strengthBar = document.getElementById('strengthBar');
    const strengthText = document.getElementById('strengthText');
    const passwordMatch = document.getElementById('passwordMatch');
    const passwordFields = document.getElementById('passwordFields');

    // State
    let accountId = null;
    let accountData = null;

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

    function updatePreview() {
        const fullname = (fullnameInput ? fullnameInput.value.trim() : '') || 'User Name';
        if (previewName) previewName.textContent = fullname;
        
        const initial = fullname.charAt(0).toUpperCase() || 'U';
        if (previewInitial) previewInitial.textContent = initial;

        const email = (emailInput ? emailInput.value.trim() : '') || 'user@plshs.edu.ph';
        if (previewEmail) previewEmail.innerHTML = `<i class="fas fa-envelope"></i> ${email}`;

        const role = (roleSelect ? roleSelect.value : '') || 'Student';
        if (previewRole) {
            previewRole.textContent = role;
            previewRole.className = `preview-role role-${role.toLowerCase()}`;
        }
    }

    window.togglePassword = function() {
        if (newPassword) {
            newPassword.type = newPassword.type === 'password' ? 'text' : 'password';
        }
    };

    function checkPasswordStrength() {
        if (!newPassword || !strengthBar || !strengthText) return;
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
            strengthBar.style.width = '0';
            strengthText.innerHTML = '<i class="fas fa-info-circle"></i> <span>Minimum 6 characters</span>';
            return;
        }

        if (strength <= 2) {
            strengthBar.style.width = '30%';
            strengthBar.style.backgroundColor = '#ef4444';
            strengthLabel = 'Weak';
            strengthColor = '#ef4444';
        } else if (strength <= 4) {
            strengthBar.style.width = '65%';
            strengthBar.style.backgroundColor = '#f59e0b';
            strengthLabel = 'Medium';
            strengthColor = '#f59e0b';
        } else {
            strengthBar.style.width = '100%';
            strengthBar.style.backgroundColor = '#10b981';
            strengthLabel = 'Strong';
            strengthColor = '#10b981';
        }

        strengthText.innerHTML = `<i class="fas fa-shield-alt"></i> <span style="color: ${strengthColor};">Password strength: ${strengthLabel}</span>`;
    }

    function checkPasswordMatch() {
        if (!newPassword || !confirmPassword || !passwordMatch) return;
        const password = newPassword.value;
        const confirm = confirmPassword.value;

        if (confirm.length === 0) {
            passwordMatch.innerHTML = '<i class="fas fa-info-circle"></i> <span>Re-enter new password</span>';
        } else if (password === confirm) {
            passwordMatch.innerHTML = '<i class="fas fa-check-circle" style="color: #10b981;"></i> <span style="color: #10b981;">Passwords match</span>';
        } else {
            passwordMatch.innerHTML = '<i class="fas fa-exclamation-circle" style="color: #ef4444;"></i> <span style="color: #ef4444;">Passwords do not match</span>';
        }
    }

    // ===== LOAD ACCOUNT DATA =====
    async function loadAccount() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            accountId = urlParams.get('id');

            if (!accountId) {
                // Fallback to first user
                const { data: firstUser } = await supabase.from('users').select('id').limit(1).maybeSingle();
                if (firstUser) accountId = firstUser.id;
            }

            if (!accountId) {
                showAlert('No account specified to edit.', 'error');
                return;
            }

            // Fetch from Supabase
            const { data: user, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', accountId)
                .single();

            if (error || !user) throw new Error('Account not found in database.');
            accountData = user;

            const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
            const roleFormatted = user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Student';

            if (fullnameInput) fullnameInput.value = fullName;
            if (emailInput) emailInput.value = user.email || '';
            if (roleSelect) roleSelect.value = roleFormatted;

            // Resolve ID number
            let idNum = '';
            if (user.role === 'teacher') {
                const { data: t } = await supabase.from('teachers').select('employee_id').eq('user_id', user.id).maybeSingle();
                idNum = t?.employee_id || '';
            } else if (user.role === 'student' && user.email) {
                const { data: s } = await supabase.from('students').select('lrn').eq('email', user.email).maybeSingle();
                idNum = s?.lrn || '';
            }
            if (!idNum) idNum = `HES-${(user.role || 'USR').substring(0, 3).toUpperCase()}-${user.id.substring(0, 5).toUpperCase()}`;
            if (idNumberInput) idNumberInput.value = idNum;

            updatePreview();
        } catch (err) {
            console.error('Error loading account for edit:', err);
            showAlert('Failed to load account details: ' + err.message, 'error');
        }
    }

    // ===== EVENT LISTENERS =====
    if (fullnameInput) fullnameInput.addEventListener('input', updatePreview);
    if (emailInput) emailInput.addEventListener('input', updatePreview);
    if (roleSelect) roleSelect.addEventListener('change', updatePreview);

    if (resetCheckbox) {
        resetCheckbox.addEventListener('change', function() {
            const isChecked = this.checked;
            if (newPassword) newPassword.disabled = !isChecked;
            if (confirmPassword) confirmPassword.disabled = !isChecked;
            if (resetBtn) resetBtn.disabled = !isChecked;
            if (passwordFields) passwordFields.classList.toggle('active', isChecked);
            
            if (!isChecked) {
                if (newPassword) newPassword.value = '';
                if (confirmPassword) confirmPassword.value = '';
                if (strengthBar) strengthBar.style.width = '0';
                if (strengthText) strengthText.innerHTML = '<i class="fas fa-info-circle"></i> <span>Minimum 6 characters</span>';
                if (passwordMatch) passwordMatch.innerHTML = '<i class="fas fa-info-circle"></i> <span>Re-enter new password</span>';
            }
        });
    }

    if (newPassword) {
        newPassword.addEventListener('input', function() {
            if (resetCheckbox && resetCheckbox.checked) {
                checkPasswordStrength();
                checkPasswordMatch();
            }
        });
    }

    if (confirmPassword) {
        confirmPassword.addEventListener('input', function() {
            if (resetCheckbox && resetCheckbox.checked) {
                checkPasswordMatch();
            }
        });
    }

    // ===== FORM SUBMISSION: UPDATE ACCOUNT =====
    if (editForm) {
        editForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const fullname = fullnameInput.value.trim();
            const email = emailInput.value.trim();
            const role = roleSelect.value;
            const idNumber = idNumberInput ? idNumberInput.value.trim() : '';

            let errors = [];
            if (!fullname) errors.push('Full name is required');
            if (!email) errors.push('Email address is required');
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Invalid email format');
            if (!role) errors.push('Role is required');

            if (errors.length > 0) {
                showAlert(errors.join('<br>'), 'error');
                return;
            }

            const nameParts = fullname.split(' ');
            const firstName = nameParts[0] || fullname;
            const lastName = nameParts.slice(1).join(' ') || '';

            const submitBtn = editForm.querySelector('button[type="submit"]');
            try {
                if (submitBtn) submitBtn.disabled = true;

                const { error } = await supabase
                    .from('users')
                    .update({
                        first_name: firstName,
                        last_name: lastName,
                        email: email,
                        role: role.toLowerCase(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', accountId);

                if (error) throw error;

                // Sync students and enrollments table if student
                const roleLower = role.toLowerCase();
                const wasStudent = accountData?.role?.toLowerCase() === 'student' || accountData?.student_id;
                if (roleLower === 'student' || wasStudent) {
                    try {
                        const studentUpdate = {
                            first_name: firstName,
                            last_name: lastName,
                            email: email,
                            updated_at: new Date().toISOString()
                        };
                        if (idNumber && !idNumber.startsWith('HES-')) {
                            studentUpdate.lrn = idNumber;
                        }

                        if (accountData?.student_id) {
                            await supabase
                                .from('students')
                                .update(studentUpdate)
                                .eq('id', accountData.student_id);
                        }

                        // Also update students by matching email (current and previous)
                        const searchEmails = [accountData?.email, email].filter(Boolean);
                        for (const em of searchEmails) {
                            await supabase
                                .from('students')
                                .update(studentUpdate)
                                .eq('email', em);
                        }

                        // Sync enrollment records as well
                        const enrUpdate = {
                            first_name: firstName,
                            last_name: lastName,
                            email: email,
                            updated_at: new Date().toISOString()
                        };
                        for (const em of searchEmails) {
                            await supabase
                                .from('enrollments')
                                .update(enrUpdate)
                                .eq('email', em);
                        }
                        if (accountData?.student_id) {
                            await supabase
                                .from('enrollments')
                                .update(enrUpdate)
                                .eq('student_id', accountData.student_id);
                        }
                    } catch (sSyncErr) {
                        console.warn('Student profile sync notice:', sSyncErr);
                    }
                }

                // Sync teachers and sections table if teacher
                if (roleLower === 'teacher') {
                    try {
                        if (idNumber && !idNumber.startsWith('HES-')) {
                            const { data: existingT } = await supabase
                                .from('teachers')
                                .select('id')
                                .eq('user_id', accountId)
                                .maybeSingle();

                            if (existingT) {
                                await supabase
                                    .from('teachers')
                                    .update({ employee_id: idNumber, updated_at: new Date().toISOString() })
                                    .eq('user_id', accountId);
                            } else {
                                await supabase
                                    .from('teachers')
                                    .insert([{
                                        user_id: accountId,
                                        employee_id: idNumber
                                    }]);
                            }
                        }

                        // Update sections where teacher is adviser
                        await supabase
                            .from('sections')
                            .update({ adviser_name: fullname })
                            .eq('adviser_id', accountId);

                        const oldFullName = `${accountData?.first_name || ''} ${accountData?.last_name || ''}`.trim();
                        if (oldFullName && oldFullName !== fullname) {
                            await supabase
                                .from('sections')
                                .update({ adviser_name: fullname })
                                .eq('adviser_name', oldFullName);
                        }
                    } catch (tSyncErr) {
                        console.warn('Teacher sync notice:', tSyncErr);
                    }
                }

                // Update session if editing current user
                try {
                    const sessionStr = localStorage.getItem('currentUser');
                    if (sessionStr) {
                        const session = JSON.parse(sessionStr);
                        if (session && (session.id === accountId || session.email === accountData?.email || session.email === email)) {
                            session.first_name = firstName;
                            session.last_name = lastName;
                            session.firstName = firstName;
                            session.lastName = lastName;
                            session.displayName = fullname;
                            session.email = email;
                            session.role = roleLower;
                            localStorage.setItem('currentUser', JSON.stringify(session));
                            if (roleLower === 'admin') {
                                localStorage.setItem('hes_admin_name', fullname);
                            }
                        }
                    }
                } catch(e) {}

                // Broadcast update event to all open tabs / pages
                try {
                    localStorage.setItem('hes_account_updated', JSON.stringify({
                        id: accountId,
                        fullname: fullname,
                        email: email,
                        role: roleLower,
                        timestamp: Date.now()
                    }));
                } catch(e) {}

                // Update accountData reference
                accountData.first_name = firstName;
                accountData.last_name = lastName;
                accountData.email = email;
                accountData.role = roleLower;

                showAlert('✅ Account updated successfully and synced with database!', 'success');
                updatePreview();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } catch (err) {
                console.error('Error updating account:', err);
                showAlert('Failed to update account: ' + err.message, 'error');
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }

    // ===== FORM SUBMISSION: RESET PASSWORD =====
    if (passwordForm) {
        passwordForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            if (!resetCheckbox || !resetCheckbox.checked) {
                showAlert('Please check the "Reset user password" checkbox first.', 'error');
                return;
            }

            const password = newPassword.value;
            const confirm = confirmPassword.value;
            let errors = [];

            if (!password) errors.push('New password is required');
            if (password && password.length < 6) errors.push('Password must be at least 6 characters');
            if (password !== confirm) errors.push('Passwords do not match');

            if (errors.length > 0) {
                showAlert(errors.join('<br>'), 'error');
                return;
            }

            try {
                if (resetBtn) resetBtn.disabled = true;

                const { error } = await supabase
                    .from('users')
                    .update({
                        password: password,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', accountId);

                if (error) throw error;

                showAlert('✅ Password reset successfully in database!', 'success');
                
                newPassword.value = '';
                confirmPassword.value = '';
                if (strengthBar) strengthBar.style.width = '0';
                resetCheckbox.checked = false;
                newPassword.disabled = true;
                confirmPassword.disabled = true;
                if (passwordFields) passwordFields.classList.remove('active');
                
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } catch (err) {
                console.error('Error resetting password:', err);
                showAlert('Failed to reset password: ' + err.message, 'error');
            } finally {
                if (resetBtn) resetBtn.disabled = false;
            }
        });
    }

    // ===== INIT =====
    await loadAccount();
});