/**
 * HES Login - Seamless Supabase Authentication & Session Management
 * HES, Hiraya Enrollment System
 */

import { supabase } from '../../supabase/config.js';

(function () {
    'use strict';

    console.log('🔐 Login page ready');

    // ============================================
    // DOM ELEMENTS
    // ============================================

    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const rememberCheck = document.getElementById('remember');
    const loginBtn = document.getElementById('loginBtn');
    const alertContainer = document.getElementById('alertContainer');
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    const togglePasswordBtn = document.getElementById('togglePassword');

    let isRedirecting = false;

    // ============================================
    // PASSWORD TOGGLE (Eye icon)
    // ============================================

    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            const icon = this.querySelector('i');
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                if (icon) icon.className = 'fas fa-eye-slash';
            } else {
                passwordInput.type = 'password';
                if (icon) icon.className = 'fas fa-eye';
            }
        });
    }

    // ============================================
    // REDIRECT BASED ON ROLE
    // ============================================

    function redirectToDashboard(role) {
        if (isRedirecting) return;
        isRedirecting = true;

        const roleLower = (role || 'student').toLowerCase();
        console.log('🔄 Redirecting with role:', roleLower);

        const roleRoutes = {
            'admin': '../admin/dashboard.html',
            'teacher': '../teacher/dashboard.html',
            'student': '../student/dashboard.html',
            'parent': '../parents/dashboard.html',
            'registrar': '../registrar/dashboard.html',
            'principal': '../principal/dashboard.html',
            'guidance': '../guidance/dashboard.html'
        };

        const targetRoute = roleRoutes[roleLower] || '../student/dashboard.html';
        window.location.replace(targetRoute);
    }

    // Clear any active session when visiting login page to enforce explicit login for all users
    try {
        localStorage.removeItem('currentUser');
    } catch (e) {
        console.warn('⚠️ Error resetting session on login page load', e);
    }

    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    const savedEmail = getCookie('user_email') || localStorage.getItem('hes_remembered_email');
    if (savedEmail && emailInput) {
        emailInput.value = savedEmail;
        if (rememberCheck) rememberCheck.checked = true;
    }

    const MAX_ATTEMPTS = 5;
    const LOCKOUT_SECONDS = 30;
    const LOCKOUT_KEY = 'hes_login_lockout_until';
    const ATTEMPTS_KEY = 'hes_login_failed_attempts';
    const LAST_FAIL_KEY = 'hes_login_last_failed_time';

    let lockoutInterval = null;
    let alertTimeout = null;

    function getFailedAttempts() {
        const stored = localStorage.getItem(ATTEMPTS_KEY);
        const lastFail = localStorage.getItem(LAST_FAIL_KEY);
        if (lastFail && (Date.now() - parseInt(lastFail, 10) > 15 * 60 * 1000)) {
            resetFailedAttempts();
            return 0;
        }
        return stored ? parseInt(stored, 10) : 0;
    }

    function resetFailedAttempts() {
        if (lockoutInterval) {
            clearInterval(lockoutInterval);
            lockoutInterval = null;
        }
        localStorage.removeItem(ATTEMPTS_KEY);
        localStorage.removeItem(LOCKOUT_KEY);
        localStorage.removeItem(LAST_FAIL_KEY);
    }

    function getLockoutSecondsRemaining() {
        const lockoutUntil = localStorage.getItem(LOCKOUT_KEY);
        if (!lockoutUntil) return 0;
        const remaining = Math.ceil((parseInt(lockoutUntil, 10) - Date.now()) / 1000);
        if (remaining <= 0) {
            resetFailedAttempts();
            return 0;
        }
        return remaining;
    }

    function recordFailedAttempt() {
        const nextAttempts = getFailedAttempts() + 1;
        localStorage.setItem(ATTEMPTS_KEY, nextAttempts.toString());
        localStorage.setItem(LAST_FAIL_KEY, Date.now().toString());

        if (nextAttempts >= MAX_ATTEMPTS) {
            const lockoutUntil = Date.now() + (LOCKOUT_SECONDS * 1000);
            localStorage.setItem(LOCKOUT_KEY, lockoutUntil.toString());
            startLockout(LOCKOUT_SECONDS);
            return { locked: true, attempts: nextAttempts, remaining: 0 };
        }

        return { locked: false, attempts: nextAttempts, remaining: MAX_ATTEMPTS - nextAttempts };
    }

    function startLockout(initialSeconds) {
        if (lockoutInterval) {
            clearInterval(lockoutInterval);
            lockoutInterval = null;
        }
        if (alertTimeout) {
            clearTimeout(alertTimeout);
            alertTimeout = null;
        }

        // Disable form inputs & login button
        if (emailInput) emailInput.disabled = true;
        if (passwordInput) passwordInput.disabled = true;
        if (rememberCheck) rememberCheck.disabled = true;
        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.classList.add('is-locked');
            // Mount locked button markup once — NEVER overwrite innerHTML in tick loop
            loginBtn.innerHTML = `<i class="fas fa-lock" style="margin-right: 6px;"></i> Locked (<span id="lockoutBtnCount">${initialSeconds}s</span>)`;
        }

        function renderLockoutTick(sec) {
            // Update button count in-place without touching innerHTML or icons
            const btnCount = document.getElementById('lockoutBtnCount');
            if (btnCount) {
                btnCount.textContent = `${sec}s`;
            }

            if (!alertContainer) return;

            const existingCard = document.getElementById('lockoutCard');
            if (existingCard) {
                // Update in place to eliminate any blinking or re-rendering
                const digitsEl = document.getElementById('lockoutDigits');
                if (digitsEl) {
                    digitsEl.textContent = `${sec}s`;
                }
            } else {
                // Mount card once
                alertContainer.innerHTML = `
                    <div class="lockout-card" id="lockoutCard">
                        <div class="lockout-card-header">
                            <div class="lockout-icon-wrapper">
                                <i class="fas fa-shield-halved"></i>
                            </div>
                            <div class="lockout-header-info">
                                <span class="lockout-badge">Security Cooldown</span>
                                <h4 class="lockout-title">Login Temporarily Paused</h4>
                            </div>
                        </div>
                        <div class="lockout-card-body">
                            <p class="lockout-desc">Too many unsuccessful attempts. For account security, access is temporarily paused. Please wait for the cooldown timer.</p>
                            <div class="lockout-timer-row">
                                <div class="lockout-time-digits" id="lockoutDigits">${sec}s</div>
                                <div class="lockout-time-label">seconds remaining</div>
                            </div>
                        </div>
                    </div>
                `;
            }
        }

        let sec = initialSeconds;
        renderLockoutTick(sec);

        lockoutInterval = setInterval(() => {
            sec--;
            const realSec = getLockoutSecondsRemaining();

            if (sec <= 0 || realSec <= 0) {
                clearInterval(lockoutInterval);
                lockoutInterval = null;
                resetFailedAttempts();

                // Re-enable form
                if (emailInput) emailInput.disabled = false;
                if (passwordInput) {
                    passwordInput.disabled = false;
                    passwordInput.value = '';
                    passwordInput.focus();
                }
                if (rememberCheck) rememberCheck.disabled = false;
                if (loginBtn) {
                    loginBtn.disabled = false;
                    loginBtn.classList.remove('is-locked');
                    loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> LOGIN';
                }

                showAlert('Security cooldown ended. You may now enter your login credentials.', 'success');
                showToast('Cooldown ended. You may now log in.', 'success');
                return;
            }

            // Sync with real-time if tab was backgrounded or computer slept
            if (Math.abs(sec - realSec) > 1) {
                sec = realSec;
            }

            renderLockoutTick(sec);
        }, 1000);
    }

    // Check for existing lockout on page load
    const existingLockout = getLockoutSecondsRemaining();
    if (existingLockout > 0) {
        console.log(`🔒 Active login lockout detected: ${existingLockout}s remaining`);
        startLockout(existingLockout);
    }

    // ============================================
    // ALERT & TOAST FEEDBACK
    // ============================================

    function showAlert(message, type = 'error') {
        if (!alertContainer) return;
        if (getLockoutSecondsRemaining() > 0 && type !== 'lockout') {
            return;
        }
        if (alertTimeout) {
            clearTimeout(alertTimeout);
            alertTimeout = null;
        }

        let icon = 'fa-exclamation-circle';
        if (type === 'success') icon = 'fa-check-circle';
        else if (type === 'warning') icon = 'fa-exclamation-triangle';
        else if (type === 'lockout') icon = 'fa-user-lock';

        alertContainer.innerHTML = `
            <div class="alert alert-${type}">
                <i class="fas ${icon}"></i>
                <span>${message}</span>
            </div>
        `;

        alertTimeout = setTimeout(() => {
            if (alertContainer && getLockoutSecondsRemaining() <= 0) {
                alertContainer.innerHTML = '';
            }
        }, 6000);
    }

    function showToast(message, type = 'success') {
        if (!toast || !toastMessage) return;
        const icon = toast.querySelector('i');
        toastMessage.textContent = message;

        if (type === 'error') {
            toast.style.background = '#e74c3c';
            if (icon) icon.className = 'fas fa-exclamation-circle';
        } else if (type === 'warning') {
            toast.style.background = '#f59e0b';
            if (icon) icon.className = 'fas fa-exclamation-triangle';
        } else {
            toast.style.background = '#0B4F2E';
            if (icon) icon.className = 'fas fa-check-circle';
        }

        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 4000);
    }

    function sanitizeStudentName(name, email) {
        if (!name && email) {
            return email.split('@')[0];
        }
        return (name || '').trim();
    }

    // ============================================
    // LOGIN FORM SUBMISSION
    // ============================================

    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            // Guard against submissions during active lockout
            const remainingLockout = getLockoutSecondsRemaining();
            if (remainingLockout > 0) {
                showAlert(`🔒 Account is temporarily locked. Please wait ${remainingLockout} seconds.`, 'warning');
                return;
            }

            const rawEmail = emailInput ? emailInput.value.trim() : '';
            const password = passwordInput ? passwordInput.value : '';
            const remember = rememberCheck ? rememberCheck.checked : false;

            if (!rawEmail || !password) {
                showAlert('Please enter both your email address and password.', 'error');
                return;
            }

            console.log('📝 Attempting login for:', rawEmail);

            if (loginBtn) {
                loginBtn.disabled = true;
                loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i> Logging in...';
            }

            try {
                // 1. Query Supabase 'users' table case-insensitively
                const { data: usersData, error: userError } = await supabase
                    .from('users')
                    .select('*')
                    .ilike('email', rawEmail);

                if (userError) {
                    console.error('❌ Supabase users query error:', userError);
                    throw new Error('Database connection issue: ' + userError.message);
                }

                let matchedUser = null;

                if (usersData && usersData.length > 0) {
                    // Try exact password match, trimmed match, case-insensitive match, or student name match
                    matchedUser = usersData.find(u => {
                        const inputPass = (password || '').trim();
                        const inputLower = inputPass.toLowerCase();
                        const uPass = (u.password || '').trim();
                        const uPassLower = uPass.toLowerCase();

                        if (uPass === inputPass || uPassLower === inputLower) return true;

                        // For students, also accept last_name or first_name as initial password
                        if (u.role === 'student') {
                            const uLast = (u.last_name || '').trim().toLowerCase();
                            const uFirst = (u.first_name || '').trim().toLowerCase();
                            if (uLast && uLast === inputLower) return true;
                            if (uFirst && uFirst === inputLower) return true;
                        }
                        return false;
                    });

                    if (!matchedUser) {
                        // User exists with this email, but password was wrong
                        throw new Error('INCORRECT_PASSWORD');
                    }
                } else {
                    // Check if email exists in 'students' or 'teachers' table as a fallback
                    try {
                        const { data: fallbackStudent } = await supabase
                            .from('students')
                            .select('*')
                            .ilike('email', rawEmail)
                            .maybeSingle();

                        if (fallbackStudent) {
                            const expectedPass = (fallbackStudent.last_name || '').trim().toLowerCase();
                            if (expectedPass && (expectedPass === password.trim().toLowerCase() || password === 'student123')) {
                                matchedUser = {
                                    id: fallbackStudent.id,
                                    email: fallbackStudent.email,
                                    role: 'student',
                                    first_name: fallbackStudent.first_name,
                                    last_name: fallbackStudent.last_name
                                };
                            }
                        }
                    } catch (fbErr) {
                        console.warn('Fallback student query warning:', fbErr);
                    }

                    if (!matchedUser) {
                        throw new Error('USER_NOT_FOUND');
                    }
                }

                console.log('✅ Authentication successful:', matchedUser.email, '| Role:', matchedUser.role);

                // 2. Prepare user role & name
                const userRole = (matchedUser.role || 'student').toLowerCase();
                let firstName = matchedUser.first_name || '';
                let lastName = matchedUser.last_name || '';
                let fullName = `${firstName} ${lastName}`.trim() || (matchedUser.email ? matchedUser.email.split('@')[0] : 'User');

                let studentLRN = '';
                let studentGrade = '';
                let studentStrand = '';
                let studentSection = '';
                let studentStatus = 'Enrolled';
                let schoolYear = '2026-2027';

                // 3. Hydrate Student details from 'students' and 'enrollments'
                let studentTableId = matchedUser.student_id || null;
                if (userRole === 'student') {
                    try {
                        const { data: sRows } = await supabase
                            .from('students')
                            .select('*')
                            .or(`email.ilike.${matchedUser.email},id.eq.${matchedUser.id}`);

                        if (sRows && sRows.length > 0) {
                            const s = sRows[0];
                            studentTableId = s.id;
                            if (s.first_name && !firstName) firstName = s.first_name;
                            if (s.last_name && !lastName) lastName = s.last_name;
                            if (s.lrn) studentLRN = s.lrn;
                            if (s.grade_level) studentGrade = s.grade_level;
                            if (s.strand) studentStrand = s.strand;
                            if (s.section) studentSection = s.section;
                        }
                    } catch (sErr) {
                        console.warn('Student details enrichment warning:', sErr);
                    }

                    try {
                        const { data: enrRows } = await supabase
                            .from('enrollments')
                            .select('*')
                            .or(`email.ilike.${matchedUser.email},student_id.eq.${matchedUser.id}`)
                            .order('created_at', { ascending: false })
                            .limit(1);

                        if (enrRows && enrRows.length > 0) {
                            const enr = enrRows[0];
                            if (enr.first_name && !firstName) firstName = enr.first_name;
                            if (enr.last_name && !lastName) lastName = enr.last_name;
                            if (enr.lrn) studentLRN = enr.lrn;
                            if (enr.grade_level || enr.grade) studentGrade = enr.grade_level || enr.grade;
                            if (enr.strand) studentStrand = enr.strand;
                            if (enr.section) studentSection = enr.section;
                            if (enr.school_year || enr.schoolYear) schoolYear = enr.school_year || enr.schoolYear;
                            if (enr.status) {
                                const rawSt = enr.status.toLowerCase();
                                studentStatus = (rawSt === 'enrolled' || rawSt === 'approved') ? 'Enrolled' : (rawSt === 'rejected' ? 'Rejected' : 'Pending');
                            }
                        }
                    } catch (enrErr) {
                        console.warn('Enrollment enrichment warning:', enrErr);
                    }

                    fullName = `${firstName} ${lastName}`.trim() || (matchedUser.email ? matchedUser.email.split('@')[0] : 'Student');
                }

                // 4. Save Hydrated Session to localStorage
                const sessionPayload = {
                    uid: matchedUser.id,
                    id: matchedUser.id,
                    student_id: studentTableId,
                    studentTableId: studentTableId,
                    email: matchedUser.email,
                    role: userRole,
                    firstName: firstName,
                    lastName: lastName,
                    displayName: fullName,
                    lrn: studentLRN,
                    grade: studentGrade,
                    grade_level: studentGrade,
                    strand: studentStrand,
                    section: studentSection,
                    status: studentStatus,
                    schoolYear: schoolYear,
                    school_year: schoolYear,
                    loginTimestamp: new Date().toISOString()
                };

                localStorage.setItem('currentUser', JSON.stringify(sessionPayload));

                // Save portal-specific display names
                if (userRole === 'student') {
                    localStorage.setItem('hes_student_name', fullName);
                } else if (userRole === 'admin') {
                    localStorage.setItem('hes_admin_name', fullName);
                } else if (userRole === 'teacher') {
                    localStorage.setItem('hes_teacher_name', fullName);
                } else if (userRole === 'registrar') {
                    localStorage.setItem('hes_registrar_name', fullName);
                } else if (userRole === 'parent') {
                    localStorage.setItem('hes_parent_name', fullName);
                } else if (userRole === 'guidance') {
                    localStorage.setItem('hes_guidance_name', fullName);
                }

                // 5. Handle Remember Me
                if (remember) {
                    document.cookie = `user_email=${rawEmail}; path=/; max-age=${60 * 60 * 24 * 30}`;
                    localStorage.setItem('hes_remembered_email', rawEmail);
                } else {
                    document.cookie = 'user_email=; path=/; max-age=0';
                    localStorage.removeItem('hes_remembered_email');
                }

                // 6. Reset failed attempts counter on successful login
                resetFailedAttempts();

                // 7. Provide Visual Feedback & Redirect
                showToast(`Welcome back, ${fullName}! Logging you in...`, 'success');
                showAlert(`✅ Login successful! Redirecting to ${userRole.toUpperCase()} portal...`, 'success');

                setTimeout(() => {
                    redirectToDashboard(userRole);
                }, 600);

            } catch (error) {
                console.error('❌ Login error:', error);

                if (error.message === 'INCORRECT_PASSWORD' || error.message === 'USER_NOT_FOUND') {
                    const attemptInfo = recordFailedAttempt();

                    if (attemptInfo.locked) {
                        showToast('Security cooldown active. Please wait 30 seconds.', 'warning');
                    } else {
                        const userFriendlyMessage = error.message === 'INCORRECT_PASSWORD'
                            ? 'Incorrect password. Please verify and try again.'
                            : 'No account found with this email address. Please check your spelling.';

                        showAlert(userFriendlyMessage, 'error');
                        showToast(userFriendlyMessage, 'error');

                        if (loginBtn) {
                            loginBtn.disabled = false;
                            loginBtn.innerHTML = '<i class="fas fa-sign-in-alt" style="margin-right: 8px;"></i> LOGIN';
                        }
                    }
                } else {
                    let userFriendlyMessage = 'Login failed. Please check your credentials and try again.';
                    if (error.message.includes('Database connection')) {
                        userFriendlyMessage = 'Unable to connect to Supabase server. Please check your network connection.';
                    }

                    showAlert('❌ ' + userFriendlyMessage, 'error');
                    showToast('❌ ' + userFriendlyMessage, 'error');

                    if (loginBtn) {
                        loginBtn.disabled = false;
                        loginBtn.innerHTML = '<i class="fas fa-sign-in-alt" style="margin-right: 8px;"></i> LOGIN';
                    }
                }
            }
        });
    }

    // ============================================
    // FORGOT PASSWORD LINK
    // ============================================

    const forgotLink = document.querySelector('.forgot-password a');
    if (forgotLink) {
        forgotLink.addEventListener('click', function (e) {
            // Allow default navigation to forgot_password.html
        });
    }

    console.log('✅ Login system initialized with Supabase');

})();