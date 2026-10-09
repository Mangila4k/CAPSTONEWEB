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

    // 2. Load Students from Supabase
    async function loadStudents() {
        try {
            const { data, error } = await supabase
                .from('students')
                .select('*')
                .order('last_name', { ascending: true });

            if (error) throw error;
            studentsList = data || [];

            if (studentsList.length === 0) {
                studentSelect.innerHTML = `<option value="">No enrolled students found</option>`;
                return;
            }

            studentSelect.innerHTML = `
                <option value="">-- Choose Student from Directory (${studentsList.length} students) --</option>
                ${studentsList.map(s => {
                    const name = `${s.last_name || ''}, ${s.first_name || ''}`.trim() || 'Unnamed';
                    const gradeStr = s.grade_level || 'Grade 11';
                    const strandStr = s.strand || 'TVL';
                    return `<option value="${s.id}">${name} (LRN: ${s.lrn || 'N/A'}) - ${gradeStr} ${strandStr}</option>`;
                }).join('')}
            `;

            // Check URL query parameters for pre-selected student
            const urlParams = new URLSearchParams(window.location.search);
            const preStudentId = urlParams.get('student_id');
            if (preStudentId) {
                studentSelect.value = preStudentId;
                handleStudentChange(preStudentId);
            }

        } catch (err) {
            console.error('Error loading students:', err);
            showAlert('Failed to load students directory: ' + err.message, 'error');
        }
    }

    function handleStudentChange(studentId) {
        const student = studentsList.find(s => s.id === studentId);
        if (student) {
            studentLRN.value = student.lrn || 'N/A';
            studentGrade.value = student.grade_level || 'Grade 11';
            studentStrand.value = student.strand || 'TVL-ICT';
        } else {
            studentLRN.value = '';
            studentGrade.value = '';
            studentStrand.value = '';
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
            const repName = reportedByName.value.trim();
            const repRole = reporterRole.value;
            const actTaken = actionTaken.value;
            const sancDet = sanctionDetails.value.trim();
            const isParentNotified = notifyParentCheck.checked;
            const shouldAutoSchedule = autoScheduleCounseling.checked;

            submitViolationBtn.disabled = true;
            submitViolationBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Submitting Incident Report...`;

            try {
                // 1. Insert Violation Record
                const { data: newViolation, error: vError } = await supabase
                    .from('student_violations')
                    .insert([{
                        student_id: student.id,
                        lrn: student.lrn || '',
                        student_name: fullName,
                        grade_level: student.grade_level || 'Grade 11',
                        strand: student.strand || 'TVL',
                        section: student.section_id || 'Section 1',
                        violation_title: title,
                        violation_category: cat,
                        violation_type: type,
                        offense_level: offLvl,
                        incident_date: dateVal,
                        incident_time: timeVal,
                        incident_location: locVal,
                        reported_by: repName,
                        reporter_role: repRole,
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

                // 2. If Parent Notification is checked, send notification
                if (isParentNotified) {
                    try {
                        await supabase
                            .from('notifications')
                            .insert([{
                                role: 'parent',
                                title: `⚠️ Guidance Notice: Disciplinary Incident Report (${fullName})`,
                                message: `An official incident report has been logged regarding ${type} (${offLvl}). Prescribed action: ${actTaken}. Please check the Guidance portal for details.`,
                                type: 'violation_notice',
                                is_read: false
                            }]);
                    } catch (notifErr) {
                        console.warn('Parent notification warning:', notifErr);
                    }
                }

                // 3. If Auto Schedule Counseling is checked, insert into counseling_sessions
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
