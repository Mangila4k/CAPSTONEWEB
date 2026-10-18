// ===== LOG VIOLATION JAVASCRIPT =====
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
    const studentSelect = document.getElementById('studentSelect');
    const studentLRN = document.getElementById('studentLRN');
    const studentGrade = document.getElementById('studentGrade');
    const studentStrand = document.getElementById('studentStrand');
    const studentSection = document.getElementById('studentSection');
    const studentAdviser = document.getElementById('studentAdviser');
    const btnAttachAdviserAsReporter = document.getElementById('btnAttachAdviserAsReporter');
    const teacherSelector = document.getElementById('teacherSelector');
    const reporterId = document.getElementById('reporterId');
    const violationCategory = document.getElementById('violationCategory');
    const violationType = document.getElementById('violationType');
    const offenseLevel = document.getElementById('offenseLevel');
    const violationTitle = document.getElementById('violationTitle');
    const incidentDate = document.getElementById('incidentDate');
    const incidentTime = document.getElementById('incidentTime');
    const incidentLocation = document.getElementById('incidentLocation');
    const incidentDescription = document.getElementById('incidentDescription');
    const witnesses = document.getElementById('witnesses');
    const reportedByName = document.getElementById('reportedByName');
    const reporterRole = document.getElementById('reporterRole');
    const actionTaken = document.getElementById('actionTaken');
    const sanctionDetails = document.getElementById('sanctionDetails');
    const notifyParentCheck = document.getElementById('notifyParentCheck');
    const autoScheduleCounseling = document.getElementById('autoScheduleCounseling');
    const violationForm = document.getElementById('violationForm');
    const submitViolationBtn = document.getElementById('submitViolationBtn');
    const alertContainer = document.getElementById('alertContainer');

    // Pre-populate reporter name & today's date
    if (reportedByName) reportedByName.value = displayName;
    if (incidentDate) incidentDate.value = new Date().toISOString().split('T')[0];

    let studentsList = [];
    let sectionsList = [];
    let teachersList = [];

    const minorOptions = [
        'Dress Code / Improper Uniform / Haircut',
        'Tardiness / Truancy',
        'Cutting Classes / Unauthorized Absence',
        'Gadget / Mobile Phone Misuse during Class',
        'Littering / Disregard of Cleanliness',
        'Minor Classroom Disturbance / Noise',
        'Unauthorized Leaving of Campus Grounds',
        'Inappropriate Language / Minor Disrespect',
        'Other Minor Infraction'
    ];

    const majorOptions = [
        'Bullying / Cyberbullying / Intimidation',
        'Physical Altercation / Fighting / Assault',
        'Vandalism / Defacing School Property',
        'Academic Dishonesty / Cheating / Plagiarism',
        'Smoking / Vaping / E-Cigarettes on Campus',
        'Illegal Drugs / Prohibited Substance Possession',
        'Alcohol Possession / Intoxication',
        'Theft / Robbery / Extortion',
        'Forging Signatures / Tampering Official Documents',
        'Dangerous Object / Weapon Possession',
        'Severe Insubordination / Disrespect to Authority',
        'Gambling on Campus',
        'Sexual Harassment / Indecent Behavior',
        'Other Major Violation'
    ];

    function updateViolationTypes(category) {
        if (!violationType) return;
        const opts = (category === 'Major') ? majorOptions : minorOptions;
        violationType.innerHTML = opts.map(opt => `<option value="${opt}">${opt}</option>`).join('');
    }

    updateViolationTypes('Minor');

    if (violationCategory) {
        violationCategory.addEventListener('change', (e) => {
            updateViolationTypes(e.target.value);
        });
    }

    function showAlert(message, type = 'success') {
        if (!alertContainer) return;
        const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';
        alertContainer.innerHTML = `
            <div class="alert alert-${type}">
                <i class="fas ${icon}"></i>
                <span>${message}</span>
            </div>
        `;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // 2. Load Students, Sections, and Teachers from Supabase
    async function loadStudents() {
        try {
            // Fetch students, sections, and teachers concurrently
            const [studentsRes, sectionsRes, teachersRes] = await Promise.all([
                supabase.from('students').select('*').order('last_name', { ascending: true }),
                supabase.from('sections').select('*'),
                supabase.from('users').select('id, first_name, last_name, email').eq('role', 'teacher')
            ]);

            studentsList = studentsRes.data || [];
            sectionsList = sectionsRes.data || [];
            teachersList = teachersRes.data || [];

            // Map each student's section name and adviser name
            studentsList.forEach(s => {
                const sec = sectionsList.find(secItem => secItem.id === s.section_id);
                s.sectionName = sec ? sec.name : (s.section || '');
                s.adviserName = sec ? (sec.adviser_name || '') : '';
                s.adviserId = sec ? (sec.adviser_id || '') : '';
            });

            // Populate Student Directory Dropdown
            if (studentsList.length === 0) {
                studentSelect.innerHTML = `<option value="">No enrolled students found</option>`;
            } else {
                studentSelect.innerHTML = `
                    <option value="">-- Choose Student from Directory (${studentsList.length} students) --</option>
                    ${studentsList.map(s => {
                        const name = `${s.last_name || ''}, ${s.first_name || ''}`.trim() || 'Unnamed';
                        const gradeStr = s.grade_level || 'Grade 11';
                        const secStr = s.sectionName ? ` · ${s.sectionName}` : '';
                        const strandStr = s.strand ? ` (${s.strand})` : '';
                        return `<option value="${s.id}">${name} (LRN: ${s.lrn || 'N/A'}) - ${gradeStr}${secStr}${strandStr}</option>`;
                    }).join('')}
                `;
            }

            // Populate Teacher Selector Dropdown
            populateTeacherSelector();

            // Check URL query parameters for pre-selected student or reporting teacher
            const urlParams = new URLSearchParams(window.location.search);
            const preStudentId = urlParams.get('student_id');
            const preTeacherName = urlParams.get('teacher_name') || urlParams.get('reported_by');
            const preRole = urlParams.get('role');
            const preTeacherId = urlParams.get('teacher_id');

            if (preStudentId) {
                studentSelect.value = preStudentId;
                handleStudentChange(preStudentId);
            }

            if (preTeacherName) {
                if (reportedByName) reportedByName.value = preTeacherName;
                if (reporterRole) reporterRole.value = preRole || 'Teacher';
                if (reporterId && preTeacherId) reporterId.value = preTeacherId;
                if (teacherSelector) {
                    for (const opt of teacherSelector.options) {
                        if (opt.dataset && opt.dataset.name && opt.dataset.name.toLowerCase() === preTeacherName.toLowerCase()) {
                            opt.selected = true;
                            break;
                        }
                    }
                }
            }

        } catch (err) {
            console.error('Error loading directory data:', err);
            showAlert('Failed to load students and faculty directory: ' + err.message, 'error');
        }
    }

    function populateTeacherSelector() {
        if (!teacherSelector) return;

        let optionsHtml = `<option value="">-- Choose Teacher or Faculty Member to Attach --</option>`;

        // 1. Registered Teachers from Users
        if (teachersList.length > 0) {
            optionsHtml += `<optgroup label="Registered Teachers & Faculty">`;
            teachersList.forEach(t => {
                const tName = `${t.first_name || ''} ${t.last_name || ''}`.trim() || t.email;
                optionsHtml += `<option value="user_${t.id}" data-name="${tName}" data-id="${t.id}" data-role="Teacher">👩‍🏫 ${tName} (Faculty)</option>`;
            });
            optionsHtml += `</optgroup>`;
        }

        // 2. Section Advisers from Sections
        const uniqueAdvisers = [];
        sectionsList.forEach(sec => {
            if (sec.adviser_name && !uniqueAdvisers.some(a => a.name.toLowerCase() === sec.adviser_name.toLowerCase())) {
                uniqueAdvisers.push({
                    name: sec.adviser_name,
                    section: sec.name,
                    grade: sec.grade_level,
                    id: sec.adviser_id || ''
                });
            }
        });

        if (uniqueAdvisers.length > 0) {
            optionsHtml += `<optgroup label="Class Advisers (By Section)">`;
            uniqueAdvisers.forEach(adv => {
                optionsHtml += `<option value="adviser_${adv.name}" data-name="${adv.name}" data-id="${adv.id}" data-role="Adviser">📋 ${adv.name} (Adviser - ${adv.section})</option>`;
            });
            optionsHtml += `</optgroup>`;
        }

        // 3. Guidance Office
        optionsHtml += `
            <optgroup label="Guidance Office">
                <option value="guidance_self" data-name="${displayName}" data-role="Guidance Counselor" selected>🛡️ ${displayName} (Guidance Counselor)</option>
            </optgroup>
            <optgroup label="Other">
                <option value="custom" data-role="Staff">✏️ Other / Type Custom Name</option>
            </optgroup>
        `;

        teacherSelector.innerHTML = optionsHtml;
    }

    // Teacher Selector Event Binding
    if (teacherSelector) {
        teacherSelector.addEventListener('change', function() {
            const selectedOpt = teacherSelector.options[teacherSelector.selectedIndex];
            if (!selectedOpt) return;

            if (selectedOpt.value === 'custom') {
                if (reportedByName) {
                    reportedByName.value = '';
                    reportedByName.focus();
                }
                if (reporterRole) reporterRole.value = 'Teacher';
                if (reporterId) reporterId.value = '';
            } else if (selectedOpt.dataset && selectedOpt.dataset.name) {
                if (reportedByName) reportedByName.value = selectedOpt.dataset.name;
                if (reporterRole) reporterRole.value = selectedOpt.dataset.role || 'Teacher';
                if (reporterId) reporterId.value = selectedOpt.dataset.id || '';
            }
        });
    }

    function handleStudentChange(studentId) {
        const student = studentsList.find(s => s.id === studentId);
        if (student) {
            if (studentLRN) studentLRN.value = student.lrn || 'N/A';
            if (studentGrade) studentGrade.value = student.grade_level || 'Grade 11';
            if (studentStrand) studentStrand.value = student.strand || 'TVL-ICT';
            if (studentSection) studentSection.value = student.sectionName || 'General';
            if (studentAdviser) studentAdviser.value = student.adviserName || 'Not Assigned';

            // Show quick button to attach adviser if adviser exists
            if (btnAttachAdviserAsReporter) {
                if (student.adviserName) {
                    btnAttachAdviserAsReporter.style.display = 'inline-flex';
                    btnAttachAdviserAsReporter.innerHTML = `<i class="fas fa-paperclip"></i> Attach ${student.adviserName}`;
                    btnAttachAdviserAsReporter.onclick = () => {
                        if (reportedByName) reportedByName.value = student.adviserName;
                        if (reporterRole) reporterRole.value = 'Adviser';
                        if (reporterId) reporterId.value = student.adviserId || '';
                        if (teacherSelector) {
                            for (const opt of teacherSelector.options) {
                                if (opt.dataset && opt.dataset.name && opt.dataset.name.toLowerCase() === student.adviserName.toLowerCase()) {
                                    opt.selected = true;
                                    break;
                                }
                            }
                        }
                    };
                } else {
                    btnAttachAdviserAsReporter.style.display = 'none';
                }
            }
        } else {
            if (studentLRN) studentLRN.value = '';
            if (studentGrade) studentGrade.value = '';
            if (studentStrand) studentStrand.value = '';
            if (studentSection) studentSection.value = '';
            if (studentAdviser) studentAdviser.value = '';
            if (btnAttachAdviserAsReporter) btnAttachAdviserAsReporter.style.display = 'none';
        }
    }

    if (studentSelect) {
        studentSelect.addEventListener('change', (e) => {
            handleStudentChange(e.target.value);
        });
    }

    // 3. Form Submission
    if (violationForm) {
        violationForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const selectedStudentId = studentSelect.value;
            const student = studentsList.find(s => s.id === selectedStudentId);
            if (!student) {
                showAlert('Please select a valid student from the list.', 'error');
                return;
            }

            const fullName = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student';
            const cat = violationCategory.value;
            const type = violationType.value;
            const title = violationTitle.value.trim();
            const offLvl = offenseLevel.value;
            const dateVal = incidentDate.value;
            const timeVal = incidentTime.value;
            const locVal = incidentLocation.value;
            const descVal = incidentDescription.value.trim();
            const witVal = witnesses.value.trim();
            const repName = (reportedByName.value || '').trim() || displayName;
            const repRole = reporterRole.value || 'Teacher';
            const repId = reporterId ? reporterId.value : null;
            const actTaken = actionTaken.value;
            const sancDet = sanctionDetails.value.trim();
            const isParentNotified = notifyParentCheck.checked;
            const shouldAutoSchedule = autoScheduleCounseling.checked;

            // Resolved section name
            const resolvedSection = student.sectionName || (studentSection ? studentSection.value : '') || 'General';

            submitViolationBtn.disabled = true;
            submitViolationBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Submitting Incident Report...`;

            try {
                // 1. Insert Violation Record with Attached Teacher & Section
                const { data: newViolation, error: vError } = await supabase
                    .from('student_violations')
                    .insert([{
                        student_id: student.id,
                        lrn: student.lrn || '',
                        student_name: fullName,
                        grade_level: student.grade_level || 'Grade 11',
                        strand: student.strand || 'TVL',
                        section: resolvedSection,
                        violation_title: title,
                        violation_category: cat,
                        violation_type: type,
                        offense_level: offLvl,
                        incident_date: dateVal,
                        incident_time: timeVal,
                        incident_location: locVal,
                        reported_by: repName,
                        reporter_role: repRole,
                        reporter_id: repId,
                        description: descVal,
                        witnesses: witVal,
                        action_taken: actTaken,
                        sanction_details: sancDet,
                        status: 'Reported',
                        parent_notified: isParentNotified,
                        parent_notified_date: isParentNotified ? new Date().toISOString() : null,
                        counseling_required: shouldAutoSchedule
                    }])
                    .select()
                    .single();

                if (vError) throw vError;

                // 2. Notify Student regarding the incident report
                try {
                    let studentAuthId = null;
                    if (student.email) {
                        const { data: uData } = await supabase.from('users').select('id').eq('email', student.email.toLowerCase()).maybeSingle();
                        if (uData?.id) studentAuthId = uData.id;
                    }

                    const studentNotifs = [{
                        user_id: student.id,
                        role: 'student',
                        title: `⚠️ Guidance Incident Notice: ${type}`,
                        message: `An incident report (${cat} - ${offLvl}) has been logged by the Guidance Office. Action: ${actTaken || 'For review'}. Please coordinate with the Guidance Office.`,
                        type: 'guidance',
                        read: false,
                        is_read: false,
                        created_at: new Date().toISOString()
                    }];

                    if (studentAuthId && studentAuthId !== student.id) {
                        studentNotifs.push({
                            user_id: studentAuthId,
                            role: 'student',
                            title: `⚠️ Guidance Incident Notice: ${type}`,
                            message: `An incident report (${cat} - ${offLvl}) has been logged by the Guidance Office. Action: ${actTaken || 'For review'}. Please coordinate with the Guidance Office.`,
                            type: 'guidance',
                            read: false,
                            is_read: false,
                            created_at: new Date().toISOString()
                        });
                    }

                    await supabase.from('notifications').insert(studentNotifs);
                } catch (stNotifErr) {
                    console.warn('Student incident notification warning:', stNotifErr);
                }

                // If Parent Notification is checked, send notification to parent
                if (isParentNotified) {
                    try {
                        await supabase
                            .from('notifications')
                            .insert([{
                                role: 'parent',
                                title: `⚠️ Guidance Notice: Disciplinary Incident Report (${fullName})`,
                                message: `An official incident report has been logged regarding ${type} (${offLvl}). Prescribed action: ${actTaken}. Please check the Guidance portal for details.`,
                                type: 'violation_notice',
                                read: false,
                                is_read: false,
                                created_at: new Date().toISOString()
                            }]);
                    } catch (notifErr) {
                        console.warn('Parent notification warning:', notifErr);
                    }
                }

                // 3. If Auto Schedule Counseling is checked, insert into counseling_sessions and notify student
                if (shouldAutoSchedule) {
                    try {
                        const nextSessionDate = new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0];
                        await supabase
                            .from('counseling_sessions')
                            .insert([{
                                violation_id: newViolation.id,
                                student_id: student.id,
                                student_name: fullName,
                                lrn: student.lrn || '',
                                grade_level: student.grade_level || 'Grade 11',
                                counselor_name: displayName,
                                session_date: nextSessionDate,
                                session_time: '10:00 AM',
                                session_type: cat === 'Major' ? 'Parent-Student Conference' : 'Individual Counseling',
                                purpose: `Follow-up and guidance intervention for ${type} (${offLvl})`,
                                notes: `Incident description: ${descVal}`,
                                status: 'Scheduled'
                            }]);

                        // Notify student of counseling session
                        let studentAuthId = null;
                        if (student.email) {
                            const { data: uData } = await supabase.from('users').select('id').eq('email', student.email.toLowerCase()).maybeSingle();
                            if (uData?.id) studentAuthId = uData.id;
                        }
                        const counselNotifs = [{
                            user_id: student.id,
                            role: 'student',
                            title: `🗓️ Guidance Counseling Session Scheduled`,
                            message: `A counseling session has been scheduled with Counselor ${displayName} on ${nextSessionDate} at 10:00 AM regarding ${type}.`,
                            type: 'guidance',
                            read: false,
                            is_read: false,
                            created_at: new Date().toISOString()
                        }];
                        if (studentAuthId && studentAuthId !== student.id) {
                            counselNotifs.push({
                                user_id: studentAuthId,
                                role: 'student',
                                title: `🗓️ Guidance Counseling Session Scheduled`,
                                message: `A counseling session has been scheduled with Counselor ${displayName} on ${nextSessionDate} at 10:00 AM regarding ${type}.`,
                                type: 'guidance',
                                read: false,
                                is_read: false,
                                created_at: new Date().toISOString()
                            });
                        }
                        await supabase.from('notifications').insert(counselNotifs);
                    } catch (counselErr) {
                        console.warn('Auto counseling schedule warning:', counselErr);
                    }
                }

                showAlert(`✅ Incident report logged successfully for ${fullName}! Redirecting to case list...`, 'success');

                setTimeout(() => {
                    window.location.href = 'violations.html';
                }, 1200);

            } catch (err) {
                console.error('Error submitting violation:', err);
                showAlert('Failed to save violation: ' + err.message, 'error');
                submitViolationBtn.disabled = false;
                submitViolationBtn.innerHTML = `<i class="fas fa-check-circle"></i> Save & Submit Violation Report`;
            }
        });
    }

    // Initial Load
    await loadStudents();
});
