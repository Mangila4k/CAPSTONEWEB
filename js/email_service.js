function getPortalLoginUrl() {
    try {
        if (typeof window === 'undefined') return 'http://localhost:5500/auth/login.html';
        const origin = window.location.origin && window.location.origin !== 'null' ? window.location.origin : 'http://localhost:5500';
        const pathname = window.location.pathname || '';
        const rootIdx = pathname.indexOf('/finalcopstone');
        if (rootIdx !== -1) {
            const basePath = pathname.substring(0, rootIdx + '/finalcopstone'.length);
            return `${origin}${basePath}/auth/login.html`;
        }
        return `${origin}/auth/login.html`;
    } catch (e) {
        return `${window.location.origin || 'http://localhost:5500'}/auth/login.html`;
    }
}

export const EmailNotificationService = {
    /**
     * Constructs the official Welcome & Login Credentials email text
     */
    buildCredentialsEmail({ studentName, firstName, lastName, email, gradeLevel, strand, schoolYear }) {
        const cleanFirst = firstName || (studentName ? studentName.split(' ')[0] : 'Student');
        const cleanLast = lastName || '';
        const cleanGrade = gradeLevel || 'Junior/Senior High School';
        const cleanStrand = strand ? ` (${strand})` : '';
        const cleanSY = schoolYear || '2026-2027';

        const loginUrl = getPortalLoginUrl();
        const subject = `🎉 Enrollment Approved! Your Student Portal Login Credentials`;

        const body = `Dear ${studentName || cleanFirst},

Congratulations! Your enrollment application for ${cleanGrade}${cleanStrand} for School Year ${cleanSY} at Placido L. Señor National High School has been reviewed and officially APPROVED by the Registrar & Administration.

Your Student Portal account is now ready. Below are your official login credentials:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 STUDENT PORTAL LOGIN CREDENTIALS:
Login Portal: ${loginUrl}

📧 Username (Your Gmail):
${email}

🔑 Initial Password (Your Last Name):
${cleanLast}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HOW TO ACCESS YOUR ACCOUNT & UPDATE YOUR PASSWORD:
1. Open the Student Portal login page: ${loginUrl}
2. Enter your registered Gmail address as the Username: ${email}
3. Enter your Last Name as the Password: ${cleanLast} (Case-insensitive)
4. Click LOGIN to access your Student Dashboard.
5. SECURITY NOTICE: Upon your first login, please go to the "My Profile" tab to immediately update your password.

Once logged in, you can view your official Class Schedule, Subjects, Grades, Attendance, and Announcements.

If you have any questions or require assistance, please visit the Registrar's Office or Administration.

Welcome to the PLS-NSHS family!

Sincerely,
Office of the Registrar & Administration
Placido L. Señor National High School
Langtad, City of Naga, Cebu
`;

        return {
            subject,
            body,
            to: email,
            loginUrl
        };
    },

    /**
     * Constructs the official Enrollment Application Confirmation & Tracking Receipt email text
     */
        /**
     * Constructs official New Enrollment Alert email sent to Admin & Registrar
     */
    buildNewEnrollmentAdminRegistrarAlertEmail({ studentName, firstName, lastName, email, gradeLevel, strand, studentType, schoolYear, trackingId, createdAt, enrollmentId }) {
        const cleanName = studentName || `${firstName || ''} ${lastName || ''}`.trim() || 'Applicant';
        const cleanGrade = gradeLevel || 'Junior/Senior High School';
        const cleanStrand = strand ? ` (${strand})` : '';
        const cleanSY = schoolYear || '2026-2027';
        const cleanType = studentType || 'New Student';
        const refNumber = trackingId || `HES-ENR-${Date.now().toString().slice(-6)}`;
        const dateStr = createdAt ? new Date(createdAt).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : new Date().toLocaleString('en-US');
        const viewParam = enrollmentId ? `?id=${enrollmentId}` : '';

        const subject = `📋 [NEW ENROLLMENT] Application Received: ${cleanName} - Ref: ${refNumber}`;

        const body = `Attention: School Administrator & Office of the Registrar,

A new student enrollment application has just been submitted via the Hiraya Enrollment Portal.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 ENROLLMENT APPLICATION SUMMARY:
• Tracking / Ref ID: ${refNumber}
• Applicant Name: ${cleanName}
• Applicant Email: ${email}
• Grade Level & Strand: ${cleanGrade}${cleanStrand}
• Student Classification: ${cleanType}
• School Year: ${cleanSY}
• Submitted At: ${dateStr}
• Status: Pending Registrar Verification
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DIRECT LINKS TO VIEW FULL STUDENT INFORMATION & CREDENTIALS:
• Registrar Review Student Info: ${getPortalLoginUrl().replace('/auth/login.html', '/registrar/view_enrollment.html' + viewParam)}
• Admin Review Student Info: ${getPortalLoginUrl().replace('/auth/login.html', '/admin/view_enrollment.html' + viewParam)}
• Registrar Enrollments Queue: ${getPortalLoginUrl().replace('/auth/login.html', '/registrar/enrollments.html')}
• Admin Dashboard: ${getPortalLoginUrl().replace('/auth/login.html', '/admin/dashboard.html')}

REQUIRED ACTIONS:
1. Registrar: Review all student personal information, guardian details, and uploaded requirements (2x2 Picture, PSA Birth Certificate, Report Card, Good Moral) to verify and approve.
2. Administrator: Monitor enrollment admissions and manage school account allocations.

Sincerely,
Hiraya Enrollment System (HES) Automated Dispatch
Placido L. Señor National High School
Langtad, City of Naga, Cebu, Philippines
`;

        return {
            subject,
            body,
            to: 'admin@hiraya.edu.ph, registrar@hiraya.edu.ph, info@PLSNHS.edu.ph',
            refNumber
        };
    },

    buildEnrollmentConfirmationEmail({ studentName, firstName, lastName, email, gradeLevel, strand, studentType, schoolYear, trackingId }) {
        const cleanFirst = firstName || (studentName ? studentName.split(' ')[0] : 'Applicant');
        const cleanGrade = gradeLevel || 'Junior/Senior High School';
        const cleanStrand = strand ? ` (${strand})` : '';
        const cleanSY = schoolYear || '2026-2027';
        const cleanType = studentType || 'New Student';
        const refNumber = trackingId || `HES-ENR-${Date.now().toString().slice(-6)}`;
        const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

        const subject = `📑 Enrollment Application Confirmation - Ref: ${refNumber} (${cleanGrade})`;

        const body = `Dear ${studentName || cleanFirst},

Thank you for submitting your online enrollment application to Placido L. Señor National High School (PLS-NSHS).

We have successfully received your enrollment submission. Below are your official confirmation and tracking details:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 ENROLLMENT APPLICATION RECEIPT:
Reference / Tracking Number: ${refNumber}
Date Submitted: ${dateStr}
Student Name: ${studentName || cleanFirst + ' ' + (lastName || '')}
Applicant Email: ${email}
Student Classification: ${cleanType}
Grade Level & Strand: ${cleanGrade}${cleanStrand}
Academic School Year: ${cleanSY}
Status: PENDING REGISTRAR VERIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NEXT STEPS:
1. Document Evaluation: The Registrar's Office will inspect your submitted credentials (PSA Birth Certificate, Report Card, Good Moral Certificate).
2. Approval Notification: Once verified, you will receive an official approval email containing your Student Portal Login Credentials.
3. Track Application: You can log into your Student Dashboard at any time to monitor your submission status and requirement verification progress.

NEED ASSISTANCE?
If you need to update any submitted details or have inquiries, please contact the Office of the Registrar at (032) 123-4567 or email registrar@hes.edu.ph.

Sincerely,
Office of the Registrar
Placido L. Señor National High School
Langtad, City of Naga, Cebu, Philippines
`;

        return {
            subject,
            body,
            to: email,
            refNumber
        };
    },

    /**
     * Constructs the official Password Reset & OTP Confirmation email text
     */
    buildPasswordResetEmail({ name, email, resetCode }) {
        const userName = name || 'PLS-NSHS User';
        const code = resetCode || Math.floor(100000 + Math.random() * 900000);
        const loginUrl = `${window.location.origin}/auth/login.html`;

        const subject = `🔐 [${code}] PLS-NSHS Account Password Reset Confirmation Code`;

        const body = `Dear ${userName},

We received a request to reset the password for your Placido L. Señor National High School (PLS-NSHS) account associated with ${email}.

Your 6-digit confirmation security code is:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔑 YOUR CONFIRMATION CODE:
    ${code}
(Valid for 15 minutes)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HOW TO RESET YOUR PASSWORD:
1. Return to the Password Reset page on your browser.
2. Enter the 6-digit code above (${code}) when prompted.
3. Enter and confirm your new secure password.

⚠️ SECURITY NOTICE:
If you did not request a password reset, please disregard this email or contact the school administrator immediately to secure your account.

Sincerely,
Information & Technology Security Desk
Placido L. Señor National High School
Langtad, City of Naga, Cebu, Philippines
`;

        return {
            subject,
            body,
            to: email,
            resetCode: code
        };
    },

    /**
     * Constructs Missing Requirement Reminder email
     */
    buildMissingRequirementsEmail({ studentName, firstName, lastName, email, missingRequirement, gradeLevel }) {
        const cleanName = studentName || `${firstName || ''} ${lastName || ''}`.trim() || 'Student';
        const cleanLast = lastName || (studentName ? studentName.split(' ').pop() : 'Student');
        const reqDoc = missingRequirement || 'Mandatory Enrollment Document';
        const subject = `⚠️ Important: Missing Enrollment Requirement - ${reqDoc}`;
        const loginUrl = getPortalLoginUrl();

        const body = `Dear ${cleanName},

This is an official notice from the Placido L. Señor National High School (PLS-NSHS) Registrar's Office regarding your enrollment for ${gradeLevel || 'Junior/Senior High'}.

We noticed that the following mandatory requirement is still pending submission:
• Required Document: ${reqDoc}

Please upload a clear scan or photo of this document to complete your enrollment:
👉 Access Student Portal: ${loginUrl}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 STUDENT PORTAL LOGIN CREDENTIALS:
Login Page: ${loginUrl}
📧 Username (Registered Gmail): ${email}
🔑 Password (Your Last Name): ${cleanLast} (Case-insensitive)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HOW TO ACCESS YOUR DASHBOARD:
1. Visit the PLS-NSHS Student Portal: ${loginUrl}
2. Enter your registered Gmail as Username: ${email}
3. Enter your Last Name as Password: ${cleanLast}
4. Click LOGIN to upload documents and view your records.

If you have already submitted this physical document to the Registrar's Office, please allow 24-48 hours for our team to update your digital profile.

If you have any questions or require assistance, please visit the Registrar's Office or reply directly to this email.

Sincerely,
Office of the Registrar
Placido L. Señor National High School
Langtad, City of Naga, Cebu, Philippines
`;

        return {
            subject,
            body,
            to: email,
            loginUrl
        };
    },

    /**
     * Constructs official Registrar Notice email
     */
    buildRegistrarNoticeEmail({ studentName, firstName, lastName, email, messageTitle, messageBody, gradeLevel, includeCredentials = true }) {
        const cleanName = studentName || `${firstName || ''} ${lastName || ''}`.trim() || 'Student';
        const cleanLast = lastName || (studentName ? studentName.split(' ').pop() : '');
        const cleanTitle = messageTitle || 'Official Notice from Office of the Registrar';
        const subject = `📢 PLS-NSHS Registrar Notice: ${cleanTitle}`;
        const loginUrl = getPortalLoginUrl();

        let credentialsBlock = '';
        if (includeCredentials && (email || cleanLast)) {
            credentialsBlock = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 STUDENT PORTAL LOGIN CREDENTIALS:
Login Page: ${loginUrl}
📧 Username (Registered Gmail): ${email}
🔑 Password (Your Last Name): ${cleanLast} (Case-insensitive)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW TO ACCESS YOUR ACCOUNT:
1. Open the PLS-NSHS Student Portal: ${loginUrl}
2. Enter your registered Gmail as your Username: ${email}
3. Enter your Last Name as your Password: ${cleanLast}
4. Click LOGIN to view your Schedule, Grades, Attendance, and Requirements.
`;
        }

        const body = `Dear ${cleanName},

This is an official communication from the Placido L. Señor National High School (PLS-NSHS) Office of the Registrar.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 NOTICE DETAILS:
Subject: ${cleanTitle}
Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
Student: ${cleanName}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MESSAGE FROM THE REGISTRAR:
${messageBody}
${credentialsBlock}
If you have any questions or require clarification, please visit the Registrar's Office during official hours or reply directly to this email.

Sincerely,
Office of the Registrar
Placido L. Señor National High School
Dumanjug, Cebu, Philippines
`;

        return {
            subject,
            body,
            to: email,
            loginUrl
        };
    },

    /**
     * Constructs official Meeting Notice Email explaining what the meeting is for,
     * its urgency/necessity, agenda topics, schedule, and RSVP instructions.
     */
    buildMeetingAnnouncementEmail({
        title,
        content,
        category,
        target_audience,
        meeting_type,
        priority = 'normal',
        meeting_date,
        meeting_time,
        venue,
        meeting_link,
        agenda = [],
        author_name,
        requires_rsvp,
        toEmail = '',
        bccEmails = []
    }) {
        const isUrgent = priority === 'urgent';
        const priorityTag = isUrgent ? '🚨 [URGENT & ESSENTIAL]' : '📢 [OFFICIAL MEETING NOTICE]';
        const cleanTitle = title || 'Official School Meeting Notice';
        const subject = `${priorityTag} PLS-NSHS Meeting Notice: ${cleanTitle}`;
        const loginUrl = getPortalLoginUrl();

        // Target audience label
        let audienceLabel = 'Parents, Guardians, and Faculty Members';
        if (target_audience === 'parents') audienceLabel = 'Parents and Guardians (PTA)';
        else if (target_audience === 'teachers') audienceLabel = 'Faculty and Teaching Staff';
        else if (target_audience === 'parent_teacher_meeting') audienceLabel = 'Parents, Guardians, and Advisory Teachers';
        else if (target_audience === 'students') audienceLabel = 'Students and Guardians';

        // Meeting type label
        let typeLabel = 'Official School Meeting';
        if (meeting_type === 'pta_assembly') typeLabel = 'General Parent-Teacher Association (PTA) Assembly';
        else if (meeting_type === 'faculty_meeting') typeLabel = 'Faculty & Staff Departmental Meeting';
        else if (meeting_type === 'homeroom_meeting') typeLabel = 'Homeroom Parent-Teacher Consultation';
        else if (meeting_type === 'department_meeting') typeLabel = 'Departmental Academic Planning Session';
        else if (meeting_type === 'emergency_meeting') typeLabel = 'Emergency Institutional Council Meeting';

        // Format Date
        let dateDisplay = meeting_date || 'To be announced in portal';
        try {
            if (meeting_date && meeting_date.includes('-')) {
                const d = new Date(meeting_date);
                dateDisplay = d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            }
        } catch (e) { }

        // Agenda formatting
        let agendaBlock = '   • As detailed in the meeting description below';
        if (Array.isArray(agenda) && agenda.length > 0) {
            agendaBlock = agenda.map((item, idx) => `   ${idx + 1}. ${item}`).join('\n');
        }

        // Virtual link block
        let onlineLinkBlock = '';
        if (meeting_link) {
            onlineLinkBlock = `
🌐 Google Meet / Video Link:
   ${meeting_link}
`;
        }

        // RSVP Block
        let rsvpBlock = '';
        if (requires_rsvp) {
            rsvpBlock = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 ATTENDANCE CONFIRMATION (RSVP REQUIRED):
Your attendance confirmation is requested for seating and roll-call preparation.
Please log in to your portal to confirm your attendance:
👉 Portal Login: ${loginUrl}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
        }

        const body = `Dear ${audienceLabel},

This is an official notification from Placido L. Señor National High School (PLS-NSHS) regarding an upcoming ${typeLabel}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 WHAT THIS MEETING IS FOR (PURPOSE & OBJECTIVES):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Meeting Title: ${cleanTitle}
Meeting Classification: ${typeLabel}
Priority Level: ${priority.toUpperCase()} ${isUrgent ? '(Mandatory Attendance Requested)' : '(Important)'}
Convened By: ${author_name || 'School Administration'}

📌 MEETING PURPOSE & DETAILS:
${content || 'Please refer to the agenda below for the full discussion items.'}

📋 KEY AGENDA TOPICS TO BE DISCUSSED:
${agendaBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 SCHEDULE & VENUE DETAILS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Date: ${dateDisplay}
• Time: ${meeting_time || 'Refer to portal schedule'}
• Venue / Room: ${venue || 'School Campus (Assigned Room)'}
${onlineLinkBlock}
${rsvpBlock}
HOW TO ACCESS YOUR DASHBOARD:
1. Open the PLS-NSHS Portal: ${loginUrl}
2. Log in with your registered account credentials.
3. Access the "Announcements" section to view live notices, meeting notes, and confirm your attendance (RSVP).

If you have any questions or require special accommodation, please contact the School Administration or reply directly to this email.

Sincerely,
${author_name || 'Office of the School Administration'}
Placido L. Señor National High School (PLS-NSHS)
Langtad, City of Naga, Cebu, Philippines
`;

        const bccList = Array.isArray(bccEmails) ? bccEmails.filter(Boolean) : (typeof bccEmails === 'string' && bccEmails ? [bccEmails] : []);

        return {
            subject,
            body,
            to: toEmail || (bccList.length === 1 ? bccList[0] : ''),
            bcc: bccList.length > 1 ? bccList.join(',') : '',
            loginUrl
        };
    },

    /**
     * Opens Gmail Web Compose in a new tab with pre-filled To, BCC, Subject, and Body
     */
    sendViaGmailWeb(emailData) {
        if (!emailData) {
            console.error('❌ Missing email data for Gmail dispatch');
            return false;
        }

        const toParam = emailData.to ? `&to=${encodeURIComponent(emailData.to)}` : '';
        const bccParam = emailData.bcc ? `&bcc=${encodeURIComponent(emailData.bcc)}` : '';
        const suParam = `&su=${encodeURIComponent(emailData.subject || '')}`;
        const bodyParam = `&body=${encodeURIComponent(emailData.body || '')}`;

        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1${toParam}${bccParam}${suParam}${bodyParam}`;

        const win = window.open(gmailUrl, '_blank', 'noopener,noreferrer');
        if (!win) {
            // Fallback to mailto
            const mailtoUrl = `mailto:${encodeURIComponent(emailData.to || '')}?${emailData.bcc ? 'bcc=' + encodeURIComponent(emailData.bcc) + '&' : ''}subject=${encodeURIComponent(emailData.subject || '')}&body=${encodeURIComponent(emailData.body || '')}`;
            window.location.href = mailtoUrl;
        }
        return true;
    },

    /**
     * Opens default mail client (mailto:)
     */
    sendViaMailto(emailData) {
        if (!emailData || !emailData.to) return false;
        const mailtoUrl = `mailto:${encodeURIComponent(emailData.to)}?subject=${encodeURIComponent(emailData.subject)}&body=${encodeURIComponent(emailData.body)}`;
        window.location.href = mailtoUrl;
        return true;
    },

    /**
     * Copies full formatted email text to clipboard
     */
    async copyEmailText(emailData) {
        const fullText = `Subject: ${emailData.subject}\nTo: ${emailData.to}\n\n${emailData.body}`;
        try {
            await navigator.clipboard.writeText(fullText);
            return true;
        } catch (e) {
            console.warn('Clipboard write failed, fallback:', e);
            try {
                const ta = document.createElement('textarea');
                ta.value = fullText;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                return true;
            } catch (err2) {
                return false;
            }
        }
    },

    /**
     * Sends student approval credentials email via Supabase Edge Function and/or Gmail Web
     */
    async sendCredentialsEmail({ studentName, firstName, lastName, email, gradeLevel, strand, schoolYear, autoLaunchGmail = false }) {
        const emailData = this.buildCredentialsEmail({ studentName, firstName, lastName, email, gradeLevel, strand, schoolYear });
        let edgeSuccess = false;

        // 1. Try Supabase Edge Function: send-enrollment-email
        try {
            const client = (typeof window !== "undefined" && window.supabase) ? window.supabase : null;
            if (client && client.functions) {
                const fullName = studentName || ((firstName || "") + " " + (lastName || "")).trim() || "Student";
                const { data, error } = await client.functions.invoke("send-enrollment-email", {
                    body: {
                        to_email: email,
                        to_name: fullName,
                        status: "approved",
                        grade_level: gradeLevel || "N/A",
                        strand: strand || "N/A",
                        password: lastName || "Student"
                    }
                });

                if (!error && data && data.success) {
                    edgeSuccess = true;
                    console.log("✅ Edge function sent email successfully to:", email);
                } else if (error) {
                    console.warn("Edge function returned error (falling back to client mail):", error);
                }
            }
        } catch (err) {
            console.warn("Notice invoking send-enrollment-email edge function:", err);
        }

        // 2. If requested or if Edge Function didn't confirm delivery, open Gmail Web compose
        if (autoLaunchGmail || !edgeSuccess) {
            this.sendViaGmailWeb(emailData);
        }

        // 3. Always copy to clipboard for convenience
        await this.copyEmailText(emailData);

        return {
            success: true,
            edgeSuccess,
            emailData
        };
    },
};

// Also attach to window for non-module scripts
if (typeof window !== 'undefined') {
    window.EmailNotificationService = EmailNotificationService;
}
