// ===== ADD TEACHER JAVASCRIPT (Supabase Integration) =====

import { supabase } from '../../supabase/config.js';

document.addEventListener('DOMContentLoaded', function() {
    'use strict';

    // DOM Elements
    const fullnameInput = document.getElementById('fullname');
    const emailInput = document.getElementById('email');
    const specializationInput = document.getElementById('specialization');
    const advisoryGradeLevelSelect = document.getElementById('advisoryGradeLevel');
    const advisorySectionSelect = document.getElementById('advisorySection');
    const advisorySectionHint = document.getElementById('advisorySectionHint');
    const passwordInput = document.getElementById('password');
    const confirmInput = document.getElementById('confirm_password');
    const strengthBar = document.getElementById('strengthBar');
    const strengthText = document.getElementById('strengthText');
    const passwordMatch = document.getElementById('passwordMatch');
    const previewName = document.getElementById('previewName');
    const previewEmail = document.getElementById('previewEmail');
    const previewSpecialization = document.getElementById('previewSpecialization');
    const previewAdvisoryText = document.getElementById('previewAdvisoryText');
    const previewInitial = document.getElementById('previewInitial');
    const teacherForm = document.getElementById('teacherForm');
    const alertContainer = document.getElementById('alertContainer');

    // State for sections
    let allSections = [];

    // ===== FUNCTIONS =====

    // Update live preview
    function updatePreview() {
        const fullname = (fullnameInput?.value.trim()) || 'New Teacher';
        if (previewName) previewName.textContent = fullname;
        
        const initial = fullname.charAt(0).toUpperCase() || 'T';
        if (previewInitial) previewInitial.textContent = initial;

        const email = (emailInput?.value.trim()) || 'teacher@plshs.edu.ph';
        if (previewEmail) previewEmail.innerHTML = `<i class="fas fa-envelope"></i> ${email}`;

        const specialization = (specializationInput?.value.trim()) || 'Specialization not set';
        if (previewSpecialization) previewSpecialization.innerHTML = `<i class="fas fa-book"></i> ${specialization}`;

        // Advisory Assignment in Preview
        if (previewAdvisoryText) {
            const secId = advisorySectionSelect?.value;
            const gradeVal = advisoryGradeLevelSelect?.value;

            if (secId) {
                const foundSec = allSections.find(s => s.id === secId);
                const secName = foundSec ? `${foundSec.grade_level || gradeVal} - ${foundSec.name}` : 'Section Assigned';
                previewAdvisoryText.innerHTML = `<strong>Class Adviser:</strong> ${secName}`;
            } else if (gradeVal) {
                previewAdvisoryText.innerHTML = `<strong>Class Adviser:</strong> ${gradeVal} (Section pending)`;
            } else {
                previewAdvisoryText.innerHTML = `Class Adviser: None (Subject Teacher)`;
            }
        }
    }

    // Load sections from Supabase
    async function loadSections() {
        try {
            const { data, error } = await supabase
                .from('sections')
                .select('id, name, grade_level, strand, adviser_id, adviser_name')
                .order('grade_level', { ascending: true })
                .order('name', { ascending: true });

            if (error) throw error;
            allSections = data || [];
        } catch (err) {
            console.warn('Could not load sections for advisory assignment:', err);
        }
    }

    // Populate sections dropdown based on selected grade level
    function updateSectionOptions() {
        if (!advisorySectionSelect) return;

        const selectedGrade = (advisoryGradeLevelSelect?.value || '').trim();

        if (!selectedGrade) {
            advisorySectionSelect.innerHTML = '<option value="">-- Select Year Level First --</option>';
            advisorySectionSelect.disabled = true;
            if (advisorySectionHint) {
                advisorySectionHint.innerHTML = '<i class="fas fa-info-circle"></i> Select a year level to view sections';
            }
            updatePreview();
            return;
        }

        // Filter sections matching the grade level
        const filtered = allSections.filter(sec => {
            const secGrade = (sec.grade_level || '').trim();
            // Match "Grade 7" with "Grade 7" or "7"
            return secGrade.toLowerCase() === selectedGrade.toLowerCase() ||
                   secGrade.replace(/\D/g, '') === selectedGrade.replace(/\D/g, '');
        });

        if (filtered.length === 0) {
            advisorySectionSelect.innerHTML = `<option value="">-- No sections found in ${selectedGrade} --</option>`;
            advisorySectionSelect.disabled = true;
            if (advisorySectionHint) {
                advisorySectionHint.innerHTML = `<i class="fas fa-exclamation-circle" style="color: #f59e0b;"></i> No active sections found under ${selectedGrade}`;
            }
        } else {
            let optionsHtml = `<option value="">-- Select Section in ${selectedGrade} (Optional) --</option>`;
            filtered.forEach(sec => {
                const strandText = sec.strand ? ` [${sec.strand}]` : '';
                const adviserText = sec.adviser_name ? ` (Current Adviser: ${sec.adviser_name})` : ' (Vacant)';
                optionsHtml += `<option value="${sec.id}">${sec.name}${strandText}${adviserText}</option>`;
            });

            advisorySectionSelect.innerHTML = optionsHtml;
            advisorySectionSelect.disabled = false;
            if (advisorySectionHint) {
                advisorySectionHint.innerHTML = `<i class="fas fa-check-circle" style="color: #10b981;"></i> Showing ${filtered.length} section${filtered.length > 1 ? 's' : ''} in ${selectedGrade}`;
            }
        }

        updatePreview();
    }

    // Toggle password visibility
    window.togglePassword = function() {
        const passInput = document.getElementById('password');
        const toggleBtn = document.querySelector('.toggle-password i');
        
        if (passInput && toggleBtn) {
            if (passInput.type === 'password') {
                passInput.type = 'text';
                toggleBtn.className = 'fas fa-eye-slash';
            } else {
                passInput.type = 'password';
                toggleBtn.className = 'fas fa-eye';
            }
        }
    };

    // Check password strength
    function checkPasswordStrength() {
        if (!passwordInput) return;
        
        const password = passwordInput.value;
        let strength = 0;
        let strengthLabel = '';
        let strengthColor = '';

        if (password.length >= 8) strength += 1;
        if (password.match(/[a-z]+/)) strength += 1;
        if (password.match(/[A-Z]+/)) strength += 1;
        if (password.match(/[0-9]+/)) strength += 1;
        if (password.match(/[!@#$%^&*(),.?":{}|<>]+/)) strength += 1;

        if (password.length === 0) {
            if (strengthBar) strengthBar.style.width = '0';
            if (strengthText) {
                strengthText.innerHTML = `<i class="fas fa-info-circle"></i> <span>Minimum 8 characters with uppercase, lowercase, number & special character</span>`;
            }
            return;
        }

        if (strength <= 2) {
            if (strengthBar) {
                strengthBar.style.width = '25%';
                strengthBar.style.backgroundColor = '#ef4444';
            }
            strengthLabel = 'Weak';
            strengthColor = '#ef4444';
        } else if (strength <= 4) {
            if (strengthBar) {
                strengthBar.style.width = '60%';
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

    // Check password match
    function checkPasswordMatch() {
        if (!passwordInput || !confirmInput || !passwordMatch) return;
        
        const password = passwordInput.value;
        const confirm = confirmInput.value;

        if (confirm.length > 0) {
            if (password === confirm) {
                passwordMatch.innerHTML = `<i class="fas fa-check-circle" style="color: #10b981;"></i> <span style="color: #10b981;">Passwords match</span>`;
            } else {
                passwordMatch.innerHTML = `<i class="fas fa-exclamation-circle" style="color: #ef4444;"></i> <span style="color: #ef4444;">Passwords do not match</span>`;
            }
        } else {
            passwordMatch.innerHTML = `<i class="fas fa-info-circle"></i> <span>Re-enter your password</span>`;
        }
    }

    // Show alert messages
    function showAlert(message, type = 'error') {
        if (!alertContainer) return;
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        const icon = type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle';
        alertDiv.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
        alertContainer.appendChild(alertDiv);

        setTimeout(function() {
            alertDiv.style.opacity = '0';
            setTimeout(() => {
                alertDiv.remove();
            }, 300);
        }, 5000);
    }

    // ===== EVENT LISTENERS =====

    if (fullnameInput) fullnameInput.addEventListener('input', updatePreview);
    if (emailInput) emailInput.addEventListener('input', updatePreview);
    if (specializationInput) specializationInput.addEventListener('input', updatePreview);

    if (advisoryGradeLevelSelect) {
        advisoryGradeLevelSelect.addEventListener('change', function() {
            updateSectionOptions();
        });
    }

    if (advisorySectionSelect) {
        advisorySectionSelect.addEventListener('change', function() {
            updatePreview();
        });
    }

    if (passwordInput) {
        passwordInput.addEventListener('input', function() {
            checkPasswordStrength();
            checkPasswordMatch();
        });
    }

    if (confirmInput) {
        confirmInput.addEventListener('input', checkPasswordMatch);
    }

    // ===== FORM SUBMIT =====

    if (teacherForm) {
        teacherForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const fullname = fullnameInput.value.trim();
            const email = emailInput.value.trim().toLowerCase();
            const password = passwordInput.value;
            const confirm = confirmInput.value;
            const phone = document.getElementById('phone')?.value.trim() || '';
            const specialization = specializationInput?.value.trim() || 'General';
            const selectedSectionId = advisorySectionSelect?.value || null;
            const selectedGradeLevel = advisoryGradeLevelSelect?.value || null;

            let errors = [];

            if (!fullname) errors.push('Full name is required');
            if (!email) errors.push('Email address is required');
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                errors.push('Invalid email format');
            }

            if (!password) {
                errors.push('Password is required');
            } else if (password.length < 6) {
                errors.push('Password must be at least 6 characters');
            }

            if (password !== confirm) {
                errors.push('Passwords do not match');
            }

            if (errors.length > 0) {
                showAlert(errors.join('<br>'), 'error');
                return;
            }

            const submitBtn = teacherForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding Teacher...';
            }

            try {
                // Check if user already exists
                const { data: existingUsers, error: checkErr } = await supabase
                    .from('users')
                    .select('id, email')
                    .ilike('email', email);

                if (checkErr) throw checkErr;

                if (existingUsers && existingUsers.length > 0) {
                    throw new Error('An account with this email address already exists.');
                }

                // Split name
                const nameParts = fullname.split(' ');
                const firstName = nameParts[0] || fullname;
                const lastName = nameParts.slice(1).join(' ') || '';

                // Insert into users table
                const { data: newUser, error: userErr } = await supabase
                    .from('users')
                    .insert([{
                        first_name: firstName,
                        last_name: lastName,
                        email: email,
                        password: password,
                        role: 'teacher'
                    }])
                    .select()
                    .single();

                if (userErr) throw userErr;

                // Generate random unique employee ID
                const randomNum = Math.floor(100000 + Math.random() * 900000);
                const employeeId = `HES-TCH-${randomNum}`;

                // Insert into teachers table
                const { data: newTeacher, error: teacherErr } = await supabase
                    .from('teachers')
                    .insert([{
                        user_id: newUser.id,
                        employee_id: employeeId,
                        specialization: specialization,
                        phone: phone,
                        address: null
                    }])
                    .select()
                    .single();

                if (teacherErr) throw teacherErr;

                let advisoryInfoMsg = '';

                // If an advisory section was selected, assign this teacher as official adviser
                if (selectedSectionId) {
                    const teacherIdentifier = newTeacher?.id || newUser.id;
                    const { error: secErr } = await supabase
                        .from('sections')
                        .update({
                            adviser_id: teacherIdentifier,
                            adviser_name: fullname
                        })
                        .eq('id', selectedSectionId);

                    if (secErr) {
                        console.warn('Advisory section assignment error:', secErr);
                    } else {
                        const assignedSec = allSections.find(s => s.id === selectedSectionId);
                        const secLabel = assignedSec ? `${assignedSec.grade_level || selectedGradeLevel} - ${assignedSec.name}` : selectedSectionId;
                        advisoryInfoMsg = `<br><strong>Advisory Class:</strong> ${secLabel}`;
                    }
                }

                showAlert(`✅ Teacher "${fullname}" added successfully!<br><strong>Assigned ID:</strong> ${employeeId}${advisoryInfoMsg}<br>Redirecting to Teachers list...`, 'success');

                setTimeout(() => {
                    window.location.href = 'teachers.html';
                }, 1500);

            } catch (err) {
                console.error('Error adding teacher:', err);
                showAlert('❌ ' + (err.message || 'Failed to add teacher.'), 'error');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fas fa-save"></i> Add Teacher';
                }
            }
        });
    }

    // Initialize
    (async function init() {
        await loadSections();
        updatePreview();
    })();
});