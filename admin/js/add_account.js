// ===== ADD ACCOUNT JAVASCRIPT (SUPABASE POWERED) =====
import { supabase } from '../../supabase/config.js';

document.addEventListener('DOMContentLoaded', function() {
    'use strict';

    // DOM Elements
    const fullnameInput = document.getElementById('fullname');
    const emailInput = document.getElementById('email');
    const roleSelect = document.getElementById('role');
    const passwordInput = document.getElementById('password');
    const confirmInput = document.getElementById('confirm_password');
    const togglePasswordBtn = document.getElementById('togglePasswordBtn');
    const strengthBar = document.getElementById('strengthBar');
    const strengthText = document.getElementById('strengthText');
    const passwordMatch = document.getElementById('passwordMatch');
    const previewName = document.getElementById('previewName');
    const previewEmail = document.getElementById('previewEmail');
    const previewRole = document.getElementById('previewRole');
    const previewInitial = document.getElementById('previewInitial');
    const idPreview = document.getElementById('id_number_preview');
    const previewIDNumber = document.getElementById('previewIDNumber');
    const accountForm = document.getElementById('accountForm');
    const alertContainer = document.getElementById('alertContainer');
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
        });
    }

    // ===== FUNCTIONS =====

    function getPreviewIDNumber(role) {
        if (role === 'Teacher') {
            return 'HES-TCH-XXXXX';
        } else if (role === 'Registrar') {
            return 'HES-RGR-XXXXX';
        } else if (role === 'Guidance') {
            return 'HES-GDC-XXXXX';
        } else if (role === 'Admin') {
            return 'HES-ADM-XXXXX';
        } else if (role === 'Student') {
            return 'HES-STU-XXXXX';
        } else if (role === 'Parent') {
            return 'HES-PAR-XXXXX';
        } else if (role === 'Principal') {
            return 'HES-PRN-XXXXX';
        }
        return 'Will be auto-generated';
    }

    function generateActualIDNumber(role) {
        const rand = Math.floor(10000 + Math.random() * 90000);
        if (role === 'Teacher') {
            return `HES-TCH-${rand}`;
        } else if (role === 'Registrar') {
            return `HES-RGR-${rand}`;
        } else if (role === 'Guidance') {
            return `HES-GDC-${rand}`;
        } else if (role === 'Admin') {
            return `HES-ADM-${rand}`;
        } else if (role === 'Student') {
            return `HES-STU-${rand}`;
        } else if (role === 'Parent') {
            return `HES-PAR-${rand}`;
        } else if (role === 'Principal') {
            return `HES-PRN-${rand}`;
        }
        return `HES-ACC-${rand}`;
    }

    function updateIDPreview() {
        const role = roleSelect ? roleSelect.value : '';
        const idValue = getPreviewIDNumber(role);
        if (idPreview) idPreview.value = idValue;
        if (previewIDNumber) previewIDNumber.textContent = idValue;
    }

    function updatePreview() {
        const fullname = (fullnameInput ? fullnameInput.value.trim() : '') || 'New User';
        if (previewName) previewName.textContent = fullname;

        const initial = fullname.charAt(0).toUpperCase() || 'U';
        if (previewInitial) previewInitial.textContent = initial;

        const email = (emailInput ? emailInput.value.trim() : '') || 'user@plshs.edu.ph';
        if (previewEmail) previewEmail.innerHTML = `<i class="fas fa-envelope"></i> ${email}`;

        const role = roleSelect ? roleSelect.value : '';
        if (previewRole) {
            if (role) {
                let roleDisplay = role;
                if (role === 'Admin') roleDisplay = 'Administrator';
                else if (role === 'Teacher') roleDisplay = 'Teacher (Faculty)';
                else if (role === 'Registrar') roleDisplay = 'Registrar';
                else if (role === 'Guidance') roleDisplay = 'Guidance Counselor';
                else if (role === 'Student') roleDisplay = 'Student';
                else if (role === 'Parent') roleDisplay = 'Parent / Guardian';
                else if (role === 'Principal') roleDisplay = 'School Principal';

                previewRole.textContent = roleDisplay;
                previewRole.className = 'preview-role-badge ' + role.toLowerCase();
            } else {
                previewRole.textContent = 'Select Role';
                previewRole.className = 'preview-role-badge';
            }
        }

        updateIDPreview();
    }

    function checkPasswordStrength() {
        if (!passwordInput || !strengthBar || !strengthText) return;
        const password = passwordInput.value;
        let strength = 0;
        let strengthLabel = '';
        let strengthColor = '';

        if (password.length >= 6) strength += 1;
        if (password.length >= 8) strength += 1;
        if (password.match(/[a-z]+/)) strength += 1;
        if (password.match(/[A-Z]+/)) strength += 1;
        if (password.match(/[0-9]+/)) strength += 1;
        if (password.match(/[!@#$%^&*(),.?":{}|<>]+/)) strength += 1;

        if (password.length === 0) {
            strengthBar.style.width = '0';
            strengthText.innerHTML = '<i class="fas fa-info-circle"></i> <span>Minimum 6 characters (recommended: 8+ with mixed case & numbers)</span>';
            return;
        }

        if (strength <= 2) {
            strengthBar.style.width = '25%';
            strengthBar.style.backgroundColor = '#ef4444';
            strengthLabel = 'Weak';
            strengthColor = '#ef4444';
        } else if (strength <= 4) {
            strengthBar.style.width = '60%';
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
        if (!passwordInput || !confirmInput || !passwordMatch) return;
        const password = passwordInput.value;
        const confirm = confirmInput.value;

        if (confirm.length === 0) {
            passwordMatch.innerHTML = '<i class="fas fa-info-circle"></i> <span>Re-enter your password</span>';
        } else if (password === confirm) {
            passwordMatch.innerHTML = '<i class="fas fa-check-circle" style="color: #10b981;"></i> <span style="color: #10b981;">Passwords match</span>';
        } else {
            passwordMatch.innerHTML = '<i class="fas fa-exclamation-circle" style="color: #ef4444;"></i> <span style="color: #ef4444;">Passwords do not match</span>';
        }
    }

    function togglePassword() {
        if (!passwordInput) return;
        const toggleIcon = togglePasswordBtn ? togglePasswordBtn.querySelector('i') : null;
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            if (toggleIcon) toggleIcon.className = 'fas fa-eye-slash';
        } else {
            passwordInput.type = 'password';
            if (toggleIcon) toggleIcon.className = 'fas fa-eye';
        }
    }

    if (togglePasswordBtn) togglePasswordBtn.addEventListener('click', togglePassword);

    function showAlert(message, type = 'error') {
        if (!alertContainer) return;
        alertContainer.innerHTML = '';
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        const icon = type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle';
        alertDiv.innerHTML = `<i class="fas ${icon}"></i> <div>${message}</div>`;
        alertContainer.appendChild(alertDiv);

        setTimeout(function() {
            alertDiv.style.opacity = '0';
            setTimeout(() => {
                alertDiv.remove();
            }, 300);
        }, 6000);
    }

    // ===== EVENT LISTENERS =====
    if (roleSelect) roleSelect.addEventListener('change', updatePreview);
    if (fullnameInput) fullnameInput.addEventListener('input', updatePreview);
    if (emailInput) emailInput.addEventListener('input', updatePreview);

    if (passwordInput) {
        passwordInput.addEventListener('input', function() {
            checkPasswordStrength();
            checkPasswordMatch();
        });
    }

    if (confirmInput) confirmInput.addEventListener('input', checkPasswordMatch);

    // ===== FORM SUBMISSION =====
    if (accountForm) {
        accountForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const fullname = fullnameInput.value.trim();
            const email = emailInput.value.trim();
            const role = roleSelect.value;
            const password = passwordInput.value;
            const confirm = confirmInput.value;

            let errors = [];
            if (!fullname) errors.push('Full name is required');
            if (!email) errors.push('Email address is required');
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Invalid email format');
            if (!role) errors.push('Role is required');

            if (!password) {
                errors.push('Password is required');
            } else if (password.length < 6) {
                errors.push('Password must be at least 6 characters long');
            }

            if (password !== confirm) {
                errors.push('Passwords do not match');
            }

            if (errors.length > 0) {
                showAlert(errors.join('<br>'), 'error');
                return;
            }

            // Split name into first and last name (Postgres last_name is NOT NULL)
            const nameParts = fullname.split(/\s+/).filter(Boolean);
            const firstName = nameParts[0] || fullname;
            const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : firstName;
            const generatedID = generateActualIDNumber(role);

            const submitBtn = accountForm.querySelector('button[type="submit"]');
            const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '<i class="fas fa-save"></i> Create Account';

            try {
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';
                }

                // 1. Check if email already exists
                const { data: existingUser, error: checkErr } = await supabase
                    .from('users')
                    .select('id, email')
                    .ilike('email', email)
                    .maybeSingle();

                if (checkErr) {
                    console.warn('Check existing user warning:', checkErr);
                }

                if (existingUser) {
                    throw new Error('An account with this email address already exists. Please use a different email.');
                }

                const roleLower = role.toLowerCase();

                // 2. Insert into users table
                const { data: newUser, error: userErr } = await supabase
                    .from('users')
                    .insert([{
                        first_name: firstName,
                        last_name: lastName,
                        email: email,
                        password: password,
                        role: roleLower
                    }])
                    .select()
                    .single();

                if (userErr) throw userErr;

                // 3. Role-specific auxiliary records
                if (roleLower === 'teacher') {
                    const { error: teacherErr } = await supabase
                        .from('teachers')
                        .insert([{
                            user_id: newUser.id,
                            employee_id: generatedID,
                            specialization: 'General'
                        }]);
                    if (teacherErr) console.warn('Teacher insert warning:', teacherErr);
                } else if (roleLower === 'student') {
                    const randomLrn = Math.floor(100000000000 + Math.random() * 900000000000).toString();
                    const { data: stdData, error: sErr } = await supabase
                        .from('students')
                        .insert([{
                            lrn: randomLrn,
                            first_name: firstName,
                            last_name: lastName,
                            email: email,
                            date_of_birth: '2008-01-01',
                            contact_number: '09000000000',
                            student_type: 'New Student'
                        }])
                        .select()
                        .maybeSingle();

                    if (!sErr && stdData && stdData.id) {
                        await supabase
                            .from('users')
                            .update({ student_id: stdData.id })
                            .eq('id', newUser.id);
                    }
                }

                // 4. Log activity if activity_logs exists
                try {
                    await supabase
                        .from('activity_logs')
                        .insert([{
                            action: `Created new ${role} account for ${fullname} (${email})`,
                            role: 'admin',
                            details: `Assigned ID: ${generatedID}`
                        }]);
                } catch (actErr) {
                    console.warn('Activity log error:', actErr);
                }

                showAlert(`✅ Account created successfully!<br><strong>Assigned ID:</strong> ${generatedID}<br>Redirecting to Accounts list...`, 'success');

                setTimeout(() => {
                    window.location.href = 'manage_accounts.html';
                }, 1500);
            } catch (err) {
                console.error('Error creating account:', err);
                showAlert('Failed to create account: ' + (err.message || err), 'error');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnHtml;
                }
            }
        });
    }

    // Pre-select role if provided in URL (e.g. ?role=guidance or ?role=registrar)
    const urlParams = new URLSearchParams(window.location.search);
    const initialRole = urlParams.get('role');
    if (initialRole && roleSelect) {
        for (let opt of roleSelect.options) {
            if (opt.value.toLowerCase() === initialRole.toLowerCase()) {
                roleSelect.value = opt.value;
                break;
            }
        }
    }

    updatePreview();
});