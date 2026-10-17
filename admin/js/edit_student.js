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
    
    // Academic Placement Elements
    const editStudentGradeLevel = document.getElementById('editStudentGradeLevel');
    const editStudentSection = document.getElementById('editStudentSection');
    const editStudentSectionHint = document.getElementById('editStudentSectionHint');
    const previewSection = document.getElementById('previewSection');

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
    let allSections = [];

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

    async function loadSections() {
        try {
            const { data, error } = await supabase
                .from('sections')
                .select('id, name, grade_level, strand, adviser_name')
                .order('grade_level', { ascending: true })
                .order('name', { ascending: true });
            if (!error && data) allSections = data;
        } catch(e) {
            console.warn('Error loading sections in edit_student:', e);
        }
    }

    function updateSectionDropdown(selectedGrade, preselectedSectionId = null) {
        if (!editStudentSection) return;

        if (!selectedGrade) {
            editStudentSection.innerHTML = '<option value="">-- Select Grade Level First --</option>';
            editStudentSection.disabled = true;
            if (editStudentSectionHint) {
                editStudentSectionHint.innerHTML = '<i class="fas fa-info-circle"></i> Assign student class section';
            }
            updatePreview();
            return;
        }

        const filtered = allSections.filter(sec => {
            const secGrade = (sec.grade_level || '').trim();
            return secGrade.toLowerCase() === selectedGrade.toLowerCase() ||
                   secGrade.replace(/\D/g, '') === selectedGrade.replace(/\D/g, '');
        });

        if (filtered.length === 0) {
            editStudentSection.innerHTML = `<option value="">-- No sections found in ${selectedGrade} --</option>`;
            editStudentSection.disabled = true;
            if (editStudentSectionHint) {
                editStudentSectionHint.innerHTML = `<i class="fas fa-exclamation-circle" style="color: #f59e0b;"></i> No active sections found under ${selectedGrade}`;
            }
        } else {
            let optionsHtml = '<option value="">-- No Section (Unassigned) --</option>';
            filtered.forEach(sec => {
                const adviserText = sec.adviser_name ? ` (Adviser: ${sec.adviser_name})` : '';
                const isSelected = preselectedSectionId && preselectedSectionId === sec.id ? 'selected' : '';
                optionsHtml += `<option value="${sec.id}" ${isSelected}>${sec.name}${adviserText}</option>`;
            });
            editStudentSection.innerHTML = optionsHtml;
            editStudentSection.disabled = false;
            if (editStudentSectionHint) {
                editStudentSectionHint.innerHTML = `<i class="fas fa-check-circle" style="color: #10b981;"></i> ${filtered.length} section${filtered.length > 1 ? 's' : ''} available in ${selectedGrade}`;
            }
        }

        updatePreview();
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

        const secId = editStudentSection?.value;
        const gradeVal = editStudentGradeLevel?.value;
        if (previewSection) {
            if (secId) {
                const found = allSections.find(s => s.id === secId);
                previewSection.textContent = found ? `${found.grade_level || gradeVal} - ${found.name}` : 'Section Assigned';
            } else if (gradeVal) {
                previewSection.textContent = `${gradeVal} (Unassigned)`;
            } else {
                previewSection.textContent = 'Unassigned';
            }
        }
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
            const targetId = (urlParams.get('id') || urlParams.get('student_id') || '').trim();
            const validUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId);

            let student = null;
            if (targetId) {
                try {
                    if (validUUID) {
                        const { data: sData } = await supabase
                            .from('students')
                            .select('*')
                            .eq('id', targetId)
                            .maybeSingle();
                        if (sData) student = sData;
                    } else {
                        const { data: sData } = await supabase
                            .from('students')
                            .select('*')
                            .or(`lrn.eq.${targetId},email.eq.${targetId}`)
                            .maybeSingle();
                        if (sData) student = sData;
                    }
                } catch(e) {
                    console.warn('Student query error:', e);
                }

                // Fallback to enrollments table if not yet in students table
                if (!student) {
                    try {
                        let eQuery = supabase.from('enrollments').select('*');
                        if (validUUID) {
                            eQuery = eQuery.or(`id.eq.${targetId},student_id.eq.${targetId}`);
                        } else {
                            eQuery = eQuery.or(`email.eq.${targetId},lrn.eq.${targetId}`);
                        }
                        const { data: enrData } = await eQuery.maybeSingle();
                        if (enrData) {
                            student = {
                                id: enrData.student_id || enrData.id,
                                first_name: enrData.first_name,
                                middle_name: enrData.middle_name,
                                last_name: enrData.last_name,
                                email: enrData.email,
                                lrn: enrData.lrn || 'Pending Assignment',
                                date_of_birth: enrData.birth_date || enrData.date_of_birth,
                                gender: enrData.gender,
                                grade_level: enrData.grade_level,
                                strand: enrData.strand,
                                created_at: enrData.created_at
                            };
                        }
                    } catch (e) {}
                }
            }

            if (!student) {
                const { data: sList } = await supabase.from('students').select('*').order('created_at', { ascending: false }).limit(1);
                if (sList && sList.length > 0) student = sList[0];
            }

            if (!student) {
                const { data: eList } = await supabase.from('enrollments').select('*').order('created_at', { ascending: false }).limit(1);
                if (eList && eList.length > 0) {
                    const enrData = eList[0];
                    student = {
                        id: enrData.student_id || enrData.id,
                        first_name: enrData.first_name,
                        middle_name: enrData.middle_name,
                        last_name: enrData.last_name,
                        email: enrData.email,
                        lrn: enrData.lrn || 'Pending Assignment',
                        date_of_birth: enrData.birth_date || enrData.date_of_birth,
                        gender: enrData.gender,
                        grade_level: enrData.grade_level,
                        strand: enrData.strand,
                        created_at: enrData.created_at
                    };
                }
            }

            if (!student) {
                showAlert('No student profile found.', 'error');
                return;
            }

            currentStudent = student;

            // Update cancel button link
            const cancelBtn = document.getElementById('cancelEditStudentBtn');
            if (cancelBtn) {
                cancelBtn.href = `view_student.html?id=${encodeURIComponent(student.id)}`;
            }

            // Fetch user record for this student
            try {
                const isStudentIdUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(student.id);
                let uQuery = supabase.from('users').select('*');
                if (isStudentIdUUID && student.email) {
                    uQuery = uQuery.or(`student_id.eq.${student.id},email.eq.${student.email}`);
                } else if (isStudentIdUUID) {
                    uQuery = uQuery.eq('student_id', student.id);
                } else if (student.email) {
                    uQuery = uQuery.eq('email', student.email);
                }
                const { data: uData } = await uQuery.maybeSingle();
                if (uData) currentUserId = uData.id;
            } catch(e) {}

            // Load sections first to populate section dropdown
            await loadSections();

            // Populate form
            if (firstnameInput) firstnameInput.value = student.first_name || '';
            if (middlenameInput) middlenameInput.value = student.middle_name || '';
            if (lastnameInput) lastnameInput.value = student.last_name || '';
            if (birthdateInput) {
                const bVal = student.date_of_birth || student.birth_date || student.dob || '';
                birthdateInput.value = bVal ? bVal.split('T')[0] : '';
            }
            if (genderSelect) genderSelect.value = student.gender || 'Male';
            if (emailInput) emailInput.value = student.email || '';

            const idNumberInput = document.getElementById('id_number');
            if (idNumberInput) idNumberInput.value = student.lrn || 'Pending Assignment';

            if (editStudentGradeLevel) {
                editStudentGradeLevel.value = student.grade_level || '';
                updateSectionDropdown(student.grade_level || '', student.section_id);
            }

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
            const selectedGrade = editStudentGradeLevel ? editStudentGradeLevel.value : null;
            const selectedSectionId = editStudentSection ? editStudentSection.value : null;
            const selectedSectionObj = allSections.find(s => s.id === selectedSectionId);
            const studentStrand = selectedSectionObj?.strand || currentStudent.strand || null;

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
                        gender: gender,
                        email: email,
                        grade_level: selectedGrade || null,
                        section_id: selectedSectionId || null,
                        strand: studentStrand,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', currentStudent.id);

                if (sErr) throw sErr;

                // 2. Sync corresponding enrollment if any
                try {
                    await supabase
                        .from('enrollments')
                        .update({
                            first_name: firstname,
                            middle_name: middlename || null,
                            last_name: lastname,
                            date_of_birth: birthdate || null,
                            gender: gender,
                            email: email,
                            grade_level: selectedGrade || null,
                            updated_at: new Date().toISOString()
                        })
                        .or(`student_id.eq.${currentStudent.id},email.eq.${email}`);
                } catch (enrSyncErr) {
                    console.warn('Enrollment sync notice:', enrSyncErr);
                }

                // 3. Update users table if user exists
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

                // Broadcast update so other tabs / views sync
                try {
                    localStorage.setItem('hes_student_updated', JSON.stringify({
                        id: currentStudent.id,
                        name: `${firstname} ${lastname}`.trim(),
                        timestamp: Date.now()
                    }));
                } catch (storageErr) {}

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

    if (editStudentGradeLevel) {
        editStudentGradeLevel.addEventListener('change', function() {
            updateSectionDropdown(this.value);
        });
    }

    if (editStudentSection) {
        editStudentSection.addEventListener('change', updatePreview);
    }

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