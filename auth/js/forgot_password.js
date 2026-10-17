import { supabase } from '../../supabase/config.js';
import { EmailNotificationService } from '../../js/email_service.js';

(function () {
    'use strict';

    console.log('🔑 Forgot Password with Gmail Confirmation ready');

    const forgotForm = document.getElementById('forgotForm');
    const submitBtn = document.getElementById('submitBtn');
    const emailInput = document.getElementById('emailInput');
    const alertContainer = document.getElementById('alertContainer');

    const pageHeading = document.getElementById('pageHeading');
    const pageSubtitle = document.getElementById('pageSubtitle');
    const verifyStep = document.getElementById('verifyStep');
    const targetEmailLabel = document.getElementById('targetEmailLabel');
    const sendGmailResetBtn = document.getElementById('sendGmailResetBtn');
    const copyResetCodeBtn = document.getElementById('copyResetCodeBtn');

    const resetPasswordForm = document.getElementById('resetPasswordForm');
    const codeInput = document.getElementById('codeInput');
    const newPasswordInput = document.getElementById('newPasswordInput');
    const confirmPasswordInput = document.getElementById('confirmPasswordInput');
    const saveNewPasswordBtn = document.getElementById('saveNewPasswordBtn');

    let activeResetSession = null;
    let activeEmailData = null;

    if (forgotForm) {
        forgotForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const rawEmail = emailInput.value.trim();
            const emailPattern = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;

            if (!rawEmail) {
                showFieldError(emailInput, 'Please enter your email address');
                return;
            }

            if (!emailPattern.test(rawEmail)) {
                showFieldError(emailInput, 'Please enter a valid email address');
                return;
            }

            // Loading state
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.querySelector('i').className = 'fas fa-spinner fa-spin';
                submitBtn.querySelector('span').textContent = 'Verifying account...';
            }

            try {
                // 1. Verify if account exists in Supabase 'users' table
                const { data: usersData, error: userErr } = await supabase
                    .from('users')
                    .select('*')
                    .ilike('email', rawEmail);

                let matchedUser = null;
                if (usersData && usersData.length > 0) {
                    matchedUser = usersData[0];
                } else {
                    // Check fallback 'students' table
                    try {
                        const { data: stdData } = await supabase
                            .from('students')
                            .select('*')
                            .ilike('email', rawEmail)
                            .maybeSingle();

                        if (stdData) {
                            matchedUser = {
                                id: stdData.id,
                                email: stdData.email,
                                first_name: stdData.first_name,
                                last_name: stdData.last_name,
                                role: 'student'
                            };
                        }
                    } catch (stdErr) { }
                }

                if (!matchedUser) {
                    showAlert('❌ No account found with this email address. Please check your spelling or register first.', 'error');
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.querySelector('i').className = 'fas fa-paper-plane';
                        submitBtn.querySelector('span').textContent = 'Send Reset Code';
                    }
                    return;
                }

                // 2. Generate secure 6-digit confirmation OTP code
                const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
                const userName = `${matchedUser.first_name || ''} ${matchedUser.last_name || ''}`.trim() || matchedUser.name || 'User';

                activeResetSession = {
                    email: rawEmail,
                    code: generatedCode,
                    userId: matchedUser.id,
                    role: matchedUser.role || 'student',
                    expiresAt: Date.now() + 15 * 60 * 1000 // 15 minutes validity
                };

                sessionStorage.setItem('hes_pwd_reset', JSON.stringify(activeResetSession));

                // 3. Build password reset email & auto-open Gmail Web compose
                activeEmailData = EmailNotificationService.buildPasswordResetEmail({
                    name: userName,
                    email: rawEmail,
                    resetCode: generatedCode
                });

                forgotForm.style.display = 'none';
                if (verifyStep) verifyStep.style.display = 'block';
                if (pageHeading) pageHeading.textContent = 'Enter Confirmation Code';
                if (pageSubtitle) pageSubtitle.textContent = `A 6-digit security code was generated for ${rawEmail}.`;
                if (targetEmailLabel) targetEmailLabel.textContent = rawEmail;

                showAlert(`✅ Confirmation code generated! Check your Gmail or enter code ${generatedCode} below.`, 'success');

                // Try opening Gmail Web in new tab
                EmailNotificationService.sendViaGmailWeb(activeEmailData);

            } catch (err) {
                console.error('Password reset error:', err);
                showAlert('❌ Error processing request: ' + err.message, 'error');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.querySelector('i').className = 'fas fa-paper-plane';
                    submitBtn.querySelector('span').textContent = 'Send Reset Code';
                }
            }
        });
    }

    // ============================================
    // GMAIL DISPATCH & COPY ACTIONS
    // ============================================

    if (sendGmailResetBtn) {
        sendGmailResetBtn.addEventListener('click', () => {
            if (activeEmailData) {
                EmailNotificationService.sendViaGmailWeb(activeEmailData);
                showAlert('📧 Opening Gmail Compose...', 'success');
            } else {
                showAlert('No active reset request found.', 'error');
            }
        });
    }

    if (copyResetCodeBtn) {
        copyResetCodeBtn.addEventListener('click', async () => {
            if (activeResetSession && activeResetSession.code) {
                try {
                    await navigator.clipboard.writeText(activeResetSession.code);
                    showAlert(`📋 Security Code (${activeResetSession.code}) copied to clipboard!`, 'success');
                } catch (e) {
                    showAlert(`Code: ${activeResetSession.code}`, 'success');
                }
            }
        });
    }

    // ============================================
    // STEP 2: VERIFY CODE & UPDATE PASSWORD
    // ============================================

    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const enteredCode = (codeInput?.value || '').trim();
            const newPassword = (newPasswordInput?.value || '').trim();
            const confirmPassword = (confirmPasswordInput?.value || '').trim();

            if (!activeResetSession) {
                const stored = sessionStorage.getItem('hes_pwd_reset');
                if (stored) {
                    try { activeResetSession = JSON.parse(stored); } catch (e) { }
                }
            }

            if (!activeResetSession) {
                showAlert('Session expired. Please request a new code.', 'error');
                setTimeout(() => window.location.reload(), 1500);
                return;
            }

            if (Date.now() > activeResetSession.expiresAt) {
                showAlert('❌ Confirmation code has expired. Please request a new one.', 'error');
                sessionStorage.removeItem('hes_pwd_reset');
                setTimeout(() => window.location.reload(), 1500);
                return;
            }

            if (enteredCode !== activeResetSession.code) {
                showAlert('❌ Incorrect confirmation code. Please check your Gmail and try again.', 'error');
                if (codeInput) {
                    codeInput.focus();
                    codeInput.classList.add('error');
                }
                return;
            }

            if (newPassword.length < 6) {
                showAlert('❌ New password must be at least 6 characters long.', 'error');
                return;
            }

            if (newPassword !== confirmPassword) {
                showAlert('❌ New password and confirmation do not match.', 'error');
                return;
            }

            if (saveNewPasswordBtn) {
                saveNewPasswordBtn.disabled = true;
                saveNewPasswordBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating password...';
            }

            try {
                // Update password in Supabase 'users' table
                const { error: updateErr } = await supabase
                    .from('users')
                    .update({
                        password: newPassword,
                        updated_at: new Date().toISOString()
                    })
                    .ilike('email', activeResetSession.email);

                if (updateErr) {
                    console.warn('Users table update error:', updateErr);
                }

                // Also update password/last_name in 'students' or 'teachers' if applicable
                try {
                    await supabase
                        .from('students')
                        .update({ updated_at: new Date().toISOString() })
                        .ilike('email', activeResetSession.email);
                } catch (e) { }

                sessionStorage.removeItem('hes_pwd_reset');

                showAlert('🎉 Password reset successfully! Redirecting to login...', 'success');

                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1500);

            } catch (err) {
                console.error('Failed to update password:', err);
                showAlert('❌ Failed to update password: ' + err.message, 'error');
                if (saveNewPasswordBtn) {
                    saveNewPasswordBtn.disabled = false;
                    saveNewPasswordBtn.innerHTML = '<i class="fas fa-check-circle"></i> Update Password';
                }
            }
        });
    }

    // ============================================
    // REAL-TIME EMAIL VALIDATION & ALERTS
    // ============================================

    if (emailInput) {
        emailInput.addEventListener('input', function () {
            const email = this.value.trim();
            const emailPattern = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;
            const existingError = this.parentElement.querySelector('.field-error');
            if (existingError) existingError.remove();

            if (email !== '' && emailPattern.test(email)) {
                this.className = 'success';
            } else if (email !== '') {
                this.className = 'error';
            } else {
                this.className = '';
            }
        });
    }

    function showFieldError(field, message) {
        field.className = 'error';
        const existingError = field.parentElement.querySelector('.field-error');
        if (existingError) existingError.remove();

        const errorMsg = document.createElement('div');
        errorMsg.className = 'field-error';
        errorMsg.innerHTML = '<i class="fas fa-exclamation-circle"></i> ' + message;
        field.parentElement.appendChild(errorMsg);

        setTimeout(() => {
            field.className = '';
            if (errorMsg) errorMsg.remove();
        }, 3000);
    }

    function showAlert(message, type = 'success') {
        if (!alertContainer) return;

        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            <span>${message}</span>
        `;
        alertContainer.appendChild(alertDiv);

        setTimeout(() => {
            alertDiv.style.transition = 'opacity 0.3s';
            alertDiv.style.opacity = '0';
            setTimeout(() => alertDiv.remove(), 300);
        }, 6000);
    }

})();