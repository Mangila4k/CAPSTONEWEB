/**
 * Student Guidance & Violations JS - Supabase Integration
 * Handles displaying disciplinary records, guidance purposes, and decisions/actions taken.
 */

import { supabase } from '../../supabase/config.js';

(function() {
    'use strict';

    console.log('🛡️ Student Violations & Guidance module ready');

    // DOM Elements
    const studentName = document.getElementById('studentName');
    const studentInitial = document.getElementById('studentInitial');
    const logoutBtn = document.getElementById('logoutBtn');
    const alertContainer = document.getElementById('alertContainer');
    const standingBanner = document.getElementById('standingBanner');
    const standingTitle = document.getElementById('standingTitle');
    const standingDesc = document.getElementById('standingDesc');
    const standingBadge = document.getElementById('standingBadge');
    const standingIcon = document.getElementById('standingIcon');

    // Stats
    const statTotalViolations = document.getElementById('statTotalViolations');
    const statPendingActions = document.getElementById('statPendingActions');
    const statCounselingSessions = document.getElementById('statCounselingSessions');
    const statResolvedCases = document.getElementById('statResolvedCases');

    // List & Filters
    const violationsList = document.getElementById('violationsList');
    const filterTabs = document.querySelectorAll('.filter-tabs .tab-btn');

    // Modal
    const caseModal = document.getElementById('caseModal');
    const caseModalBody = document.getElementById('caseModalBody');

    // State
    let sessionUser = null;
    let studentData = null;
    let violationsData = [];
    let currentFilter = 'all';

    // 1. Session Check
    try {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            sessionUser = JSON.parse(stored);
        }
    } catch(e) {}

    if (!sessionUser) {
        window.location.replace('../auth/login.html');
        return;
    }

    if (sessionUser.role && sessionUser.role !== 'student') {
        const routes = {
            'admin': '../admin/dashboard.html',
            'teacher': '../teacher/dashboard.html',
            'parent': '../parents/dashboard.html',
            'registrar': '../registrar/dashboard.html'
        };
        window.location.replace(routes[sessionUser.role] || '../auth/login.html');
        return;
    }

    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            localStorage.removeItem('currentUser');
            try { await supabase.auth.signOut(); } catch(err) {}
            window.location.replace('../auth/login.html');
        });
    }

    function getStudentInitials(name) {
        if (!name || typeof name !== 'string') return 'S';
        const cleanName = name.replace(/^(mr\.?|mrs\.?|ms\.?|dr\.?)\s+/i, '').trim();
        const words = cleanName.split(/[\s,&-]+/).filter(w => w.length > 0);
        if (words.length === 0) return 'S';
        if (words.length === 1) return words[0].charAt(0).toUpperCase();
        return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
    }

    // Filter Tabs
    filterTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            filterTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.getAttribute('data-filter') || 'all';
            renderViolationsList();
        });
    });

    // 2. Load Student & Violations Data
    async function init() {
        try {
            const userEmail = sessionUser.email || '';
            const userUid = sessionUser.uid || sessionUser.id || '';

            // Fetch Student Profile
            const { data: sRows } = await supabase
                .from('students')
                .select('*')
                .or(`email.eq.${userEmail},id.eq.${userUid}`);

            if (sRows && sRows.length > 0) {
                studentData = sRows[0];
            }

            const fullName = studentData?.first_name ? 
                `${studentData.first_name} ${studentData.last_name || ''}`.trim() : 
                (sessionUser.firstName ? `${sessionUser.firstName} ${sessionUser.lastName || ''}`.trim() : 'Student');
            
            if (studentName) studentName.textContent = fullName;
            if (studentInitial) studentInitial.textContent = getStudentInitials(fullName);

            const savedAvatar = localStorage.getItem('hes_student_avatar');
            if (savedAvatar) {
                const avatarEl = document.querySelector('.student-avatar');
                if (avatarEl) {
                    avatarEl.innerHTML = `
                        <img src="${savedAvatar}" alt="Student" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">
                        <div class="online-dot"></div>
                    `;
                }
            }

            // Fetch Violations for this student
            let query = supabase.from('student_violations').select('*');
            if (studentData?.id && studentData?.lrn) {
                query = query.or(`student_id.eq.${studentData.id},lrn.eq.${studentData.lrn}`);
            } else if (studentData?.id) {
                query = query.eq('student_id', studentData.id);
            } else if (studentData?.lrn) {
                query = query.eq('lrn', studentData.lrn);
            } else {
                query = query.ilike('student_name', `%${fullName}%`);
            }

            const { data: vData, error: vErr } = await query.order('incident_date', { ascending: false });

            if (vErr) {
                console.warn('Violations query error:', vErr);
                violationsData = [];
            } else {
                violationsData = vData || [];
            }

            // Update stats & banner
            updateStatsAndBanner();
            renderViolationsList();

        } catch (error) {
            console.error('Error loading student violations:', error);
            showAlert('Unable to load disciplinary records. Please contact guidance office.', 'error');
        }
    }

    // 3. Update Statistics & Standing Banner
    function updateStatsAndBanner() {
        const total = violationsData.length;
        const pending = violationsData.filter(v => {
            const st = (v.status || '').toLowerCase();
            return st === 'pending' || st === 'reported' || st === 'under investigation';
        }).length;
        const counseling = violationsData.filter(v => (v.status || '').toLowerCase().includes('counseling')).length;
        const resolved = violationsData.filter(v => {
            const st = (v.status || '').toLowerCase();
            return st === 'resolved' || st === 'dismissed' || st === 'completed';
        }).length;

        if (statTotalViolations) statTotalViolations.textContent = total;
        if (statPendingActions) statPendingActions.textContent = pending;
        if (statCounselingSessions) statCounselingSessions.textContent = counseling;
        if (statResolvedCases) statResolvedCases.textContent = resolved;

        if (standingBanner) {
            if (total === 0 || (pending === 0 && counseling === 0)) {
                standingBanner.className = 'standing-banner standing-good';
                if (standingIcon) standingIcon.className = 'fas fa-check-circle';
                if (standingTitle) standingTitle.textContent = 'Good Moral Standing';
                if (standingDesc) standingDesc.textContent = total === 0 ? 
                    'You currently have a clean disciplinary record with no offenses on file.' : 
                    'All previous recorded incidents have been resolved with completed guidance action plans.';
                if (standingBadge) {
                    standingBadge.className = 'standing-badge';
                    standingBadge.innerHTML = '<i class="fas fa-certificate"></i> Good Standing';
                }
            } else if (counseling > 0) {
                standingBanner.className = 'standing-banner standing-warning';
                if (standingIcon) standingIcon.className = 'fas fa-user-clock';
                if (standingTitle) standingTitle.textContent = 'Guidance Counseling In Progress';
                if (standingDesc) standingDesc.textContent = `You have ${counseling} active counseling case(s) scheduled. Please coordinate with the Guidance Office.`;
                if (standingBadge) {
                    standingBadge.className = 'standing-badge';
                    standingBadge.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Action Required';
                }
            } else {
                standingBanner.className = 'standing-banner standing-danger';
                if (standingIcon) standingIcon.className = 'fas fa-triangle-exclamation';
                if (standingTitle) standingTitle.textContent = 'Disciplinary Case Under Review';
                if (standingDesc) standingDesc.textContent = `You have ${pending} incident report(s) under investigation. An official guidance decision is pending.`;
                if (standingBadge) {
                    standingBadge.className = 'standing-badge';
                    standingBadge.innerHTML = '<i class="fas fa-clock"></i> Case Pending';
                }
            }
        }
    }

    // 4. Render Violations List
    function renderViolationsList() {
        if (!violationsList) return;

        let filtered = violationsData;
        if (currentFilter === 'pending') {
            filtered = violationsData.filter(v => {
                const st = (v.status || '').toLowerCase();
                return st === 'pending' || st === 'reported' || st === 'under investigation';
            });
        } else if (currentFilter === 'counseling') {
            filtered = violationsData.filter(v => (v.status || '').toLowerCase().includes('counseling'));
        } else if (currentFilter === 'resolved') {
            filtered = violationsData.filter(v => {
                const st = (v.status || '').toLowerCase();
                return st === 'resolved' || st === 'dismissed' || st === 'completed';
            });
        }

        if (filtered.length === 0) {
            violationsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-shield-heart"></i>
                    <h3>No Records Found</h3>
                    <p>${currentFilter === 'all' ? 'You have no disciplinary violations or incident reports on record. Keep up the exemplary conduct!' : 'No records match the selected filter category.'}</p>
                </div>
            `;
            return;
        }

        let html = '';
        filtered.forEach((v, index) => {
            const rawStatus = (v.status || 'Pending').toLowerCase();
            let statusPillClass = 'pill-status-pending';
            let statusIcon = 'fa-clock';
            if (rawStatus === 'resolved' || rawStatus === 'dismissed') {
                statusPillClass = 'pill-status-resolved';
                statusIcon = 'fa-check-circle';
            } else if (rawStatus.includes('counseling')) {
                statusPillClass = 'pill-status-counseling';
                statusIcon = 'fa-comments';
            } else if (rawStatus.includes('progress')) {
                statusPillClass = 'pill-status-progress';
                statusIcon = 'fa-spinner';
            }

            const offenseRaw = (v.offense_level || '1st Offense').toLowerCase();
            let offenseClass = 'pill-1st';
            let cardLevelClass = 'level-1st';
            if (offenseRaw.includes('2nd')) {
                offenseClass = 'pill-2nd';
                cardLevelClass = 'level-2nd';
            } else if (offenseRaw.includes('3rd') || offenseRaw.includes('habitual')) {
                offenseClass = 'pill-3rd';
                cardLevelClass = 'level-3rd';
            }
            if (rawStatus === 'resolved') {
                cardLevelClass = 'level-resolved';
            }

            const formattedDate = v.incident_date ? new Date(v.incident_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
            const actionTaken = v.action_taken || 'Pending Guidance Review';
            const sanction = v.sanction_details || 'No sanctions currently assigned';
            const location = v.incident_location || 'Campus Grounds';
            const reporter = v.reported_by || 'School Staff';

            html += `
                <div class="violation-item-card ${cardLevelClass}">
                    <div class="v-header">
                        <div class="v-title-group">
                            <h3>${escapeHtml(v.violation_title || 'Disciplinary Violation')}</h3>
                            <div class="v-meta">
                                <span><i class="fas fa-calendar-day"></i> ${formattedDate}</span>
                                <span><i class="fas fa-location-dot"></i> ${escapeHtml(location)}</span>
                                <span><i class="fas fa-user-pen"></i> Reported by: ${escapeHtml(reporter)}</span>
                            </div>
                        </div>
                        <div class="v-badges">
                            <span class="pill-badge ${offenseClass}">
                                <i class="fas fa-tag"></i> ${escapeHtml(v.offense_level || '1st Offense')}
                            </span>
                            <span class="pill-badge ${statusPillClass}">
                                <i class="fas ${statusIcon}"></i> ${escapeHtml(v.status || 'Pending')}
                            </span>
                        </div>
                    </div>

                    <div class="v-description">
                        <strong>Incident Summary:</strong> ${escapeHtml(v.description || 'No detailed statement recorded.')}
                    </div>

                    <!-- Guidance Decision or Action Box (Handwritten Requirement) -->
                    <div class="decision-action-box">
                        <div class="decision-action-item">
                            <div class="label"><i class="fas fa-gavel" style="color: #0b2b4a;"></i> Guidance Decision / Action Taken</div>
                            <div class="val" style="color: #0b2b4a;">${escapeHtml(actionTaken)}</div>
                        </div>
                        <div class="decision-action-item">
                            <div class="label"><i class="fas fa-clipboard-check" style="color: #f59e0b;"></i> Sanction / Corrective Task</div>
                            <div class="val" style="color: #334155;">${escapeHtml(sanction)}</div>
                        </div>
                    </div>

                    <div class="v-footer">
                        <div class="parent-notif-pill">
                            ${v.parent_notified ? 
                                `<i class="fas fa-check-circle notified"></i> <span>Parent / Guardian was officially notified</span>` : 
                                `<i class="fas fa-bell" style="color: #94a3b8;"></i> <span>Parent notification pending</span>`
                            }
                        </div>
                        <button type="button" class="btn-view-record" onclick="window.viewCaseDetails('${v.id || index}')">
                            <i class="fas fa-file-lines"></i> View Full Decision & Plan
                        </button>
                    </div>
                </div>
            `;
        });

        violationsList.innerHTML = html;
    }

    // 5. View Full Case Details Modal
    window.viewCaseDetails = function(idOrIndex) {
        const item = violationsData.find(v => v.id === idOrIndex) || violationsData[idOrIndex];
        if (!item || !caseModalBody || !caseModal) return;

        window.currentViewingCase = item;
        const formattedDate = item.incident_date ? new Date(item.incident_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A';

        caseModalBody.innerHTML = `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                    <div>
                        <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Case File</span>
                        <h2 style="font-size: 18px; color: #0b2b4a; margin: 2px 0 0;">${escapeHtml(item.violation_title || 'Incident Report')}</h2>
                    </div>
                    <span class="pill-badge pill-1st" style="font-size: 12px;">${escapeHtml(item.offense_level || '1st Offense')}</span>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px; color: #475569;">
                    <div><strong>Incident Date:</strong> ${formattedDate} ${item.incident_time ? `(${escapeHtml(item.incident_time)})` : ''}</div>
                    <div><strong>Location:</strong> ${escapeHtml(item.incident_location || 'Campus')}</div>
                    <div><strong>Reported By:</strong> ${escapeHtml(item.reported_by || 'Faculty/Staff')}</div>
                    <div><strong>Category:</strong> ${escapeHtml(item.violation_category || 'Conduct')}</div>
                </div>
            </div>

            <div style="margin-bottom: 18px;">
                <h4 style="font-size: 13px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 6px;">
                    <i class="fas fa-file-alt"></i> Incident Description & Facts
                </h4>
                <p style="font-size: 14px; color: #1e293b; background: #fff; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; line-height: 1.6;">
                    ${escapeHtml(item.description || 'No written statement recorded.')}
                </p>
            </div>

            <div style="background: #eef2ff; border-left: 4px solid #4f46e5; border-radius: 8px; padding: 14px; margin-bottom: 18px;">
                <h4 style="font-size: 13px; text-transform: uppercase; color: #3730a3; font-weight: 800; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                    <i class="fas fa-scale-balanced"></i> Official Guidance Decision & Action Taken
                </h4>
                <div style="font-size: 15px; font-weight: 700; color: #1e1b4b; margin-bottom: 6px;">
                    ${escapeHtml(item.action_taken || 'Under Administrative Consideration')}
                </div>
                <div style="font-size: 13.5px; color: #312e81;">
                    <strong>Sanction / Task Terms:</strong> ${escapeHtml(item.sanction_details || 'Standard warning and record filing')}
                </div>
            </div>

            ${item.counselor_notes ? `
                <div style="margin-bottom: 18px;">
                    <h4 style="font-size: 13px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 6px;">
                        <i class="fas fa-comment-dots"></i> Counselor Notes & Behavioral Agreement
                    </h4>
                    <p style="font-size: 13.5px; color: #1e293b; background: #fff; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; line-height: 1.5;">
                        ${escapeHtml(item.counselor_notes)}
                    </p>
                </div>
            ` : ''}

            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f8fafc; border-radius: 8px; font-size: 12.5px; color: #64748b;">
                <div><strong>Resolution Status:</strong> <span style="font-weight: 700; color: #0f172a;">${escapeHtml(item.status || 'Pending')}</span></div>
                <div><strong>Parent Notified:</strong> <span style="font-weight: 700; color: ${item.parent_notified ? '#10b981' : '#f59e0b'};">${item.parent_notified ? 'Yes (Notice Dispatched)' : 'Pending'}</span></div>
            </div>
        `;

        caseModal.style.display = 'flex';
    };

    window.closeCaseModal = function() {
        if (caseModal) caseModal.style.display = 'none';
    };

    window.printCaseRecord = function() {
        const item = window.currentViewingCase;
        if (!item) return;

        const sName = studentData?.first_name ? `${studentData.first_name} ${studentData.last_name || ''}`.trim() : 'Student';
        const lrn = studentData?.lrn || 'N/A';
        const grade = studentData?.grade_level || 'Grade 11';
        const printWin = window.open('', '_blank', 'width=750,height=800');

        printWin.document.write(`
            <html>
            <head>
                <title>Guidance Case Record - ${sName}</title>
                <style>
                    body { font-family: 'Times New Roman', Times, serif; padding: 40px; color: #000; line-height: 1.6; }
                    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 24px; }
                    .header h2 { margin: 0; font-size: 18px; text-transform: uppercase; }
                    .header p { margin: 4px 0 0; font-size: 13px; }
                    .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px; }
                    .meta-table td { padding: 6px 4px; vertical-align: top; }
                    .section-title { font-weight: bold; font-size: 14px; text-transform: uppercase; margin-top: 18px; margin-bottom: 6px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
                    .box { background: #fafafa; border: 1px solid #999; padding: 10px; font-size: 13px; margin-bottom: 12px; }
                    .signatures { margin-top: 50px; display: flex; justify-content: space-between; }
                    .sig-line { width: 200px; border-top: 1px solid #000; text-align: center; font-size: 12px; padding-top: 4px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>PLACIDO L. SEÑOR NATIONAL HIGH SCHOOL</h2>
                    <p style="font-weight: 600; font-size: 13px; color: #333; margin: 2px 0 0;">OFFICE OF THE GUIDANCE COUNSELOR & PREFECT OF DISCIPLINE</p>
                    <p style="font-size: 12px; margin-top: 4px; font-weight: bold; letter-spacing: 0.5px;">INDIVIDUAL STUDENT DISCIPLINARY & GUIDANCE REPORT (BY STUDENT)</p>
                </div>
                <table class="meta-table">
                    <tr>
                        <td width="50%"><strong>Student Name:</strong> ${escapeHtml(sName)}</td>
                        <td width="50%"><strong>LRN:</strong> ${escapeHtml(lrn)}</td>
                    </tr>
                    <tr>
                        <td><strong>Learner Classification:</strong> Officially Enrolled Student</td>
                        <td><strong>Report Type:</strong> By Student (Individual Learner Record)</td>
                    </tr>
                    <tr>
                        <td><strong>Grade & Section:</strong> ${escapeHtml(grade)}</td>
                        <td><strong>Incident Date:</strong> ${escapeHtml(item.incident_date || 'N/A')}</td>
                    </tr>
                    <tr>
                        <td><strong>Offense Level:</strong> ${escapeHtml(item.offense_level || '1st Offense')}</td>
                        <td><strong>Case Status:</strong> ${escapeHtml(item.status || 'Resolved')}</td>
                    </tr>
                </table>

                <div class="section-title">Incident Title & Category</div>
                <p><strong>${escapeHtml(item.violation_title || 'N/A')}</strong> (${escapeHtml(item.violation_category || 'Conduct')})</p>

                <div class="section-title">Description of Incident</div>
                <div class="box">${escapeHtml(item.description || 'No statement.')}</div>

                <div class="section-title">Guidance Decision & Action Taken</div>
                <div class="box">
                    <strong>Decision / Action:</strong> ${escapeHtml(item.action_taken || 'N/A')}<br>
                    <strong>Sanction Details:</strong> ${escapeHtml(item.sanction_details || 'N/A')}<br>
                    <strong>Counselor Notes:</strong> ${escapeHtml(item.counselor_notes || 'None')}
                </div>

                <div class="signatures">
                    <div class="sig-line">Guidance Counselor Signature</div>
                    <div class="sig-line">Parent / Guardian Signature</div>
                    <div class="sig-line">Student Signature</div>
                </div>
                <script>window.onload = function() { window.print(); }</script>
            </body>
            </html>
        `);
        printWin.document.close();
    };

    function showAlert(msg, type) {
        if (!alertContainer) return;
        alertContainer.innerHTML = `
            <div style="padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 13.5px; font-weight: 500; ${type === 'error' ? 'background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca;' : 'background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0;'}">
                ${msg}
            </div>
        `;
        setTimeout(() => {
            alertContainer.innerHTML = '';
        }, 5000);
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Initialize on load
    init();
})();
