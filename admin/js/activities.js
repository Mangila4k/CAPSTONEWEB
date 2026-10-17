// ===== SYSTEM ACTIVITIES & AUDIT LOGS JAVASCRIPT =====
import { supabase } from '../../supabase/config.js';

document.addEventListener('DOMContentLoaded', async function() {
    'use strict';

    const alertContainer = document.getElementById('alertContainer');

    // Helper function to show toast
    function showAlert(message, type = 'info') {
        if (!alertContainer) return;
        const div = document.createElement('div');
        div.className = `alert alert-${type}`;
        div.style.cssText = `
            padding: 12px 18px; border-radius: 10px; margin-bottom: 18px;
            display: flex; align-items: center; gap: 10px; font-size: 14px;
            background: ${type === 'error' ? '#fee2e2' : type === 'success' ? '#dcfce7' : '#eff6ff'};
            color: ${type === 'error' ? '#991b1b' : type === 'success' ? '#166534' : '#1e40af'};
            border: 1px solid ${type === 'error' ? '#fecaca' : type === 'success' ? '#bbf7d0' : '#bfdbfe'};
            transition: all 0.3s ease;
        `;
        const icon = type === 'error' ? 'fa-exclamation-circle' : type === 'success' ? 'fa-check-circle' : 'fa-info-circle';
        div.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
        alertContainer.appendChild(div);
        setTimeout(() => {
            div.style.opacity = '0';
            setTimeout(() => div.remove(), 300);
        }, 4000);
    }

    // ==========================================
    // 1. POSTED SCHOOL ACTIVITIES GALLERY
    // ==========================================
    const postedGrid = document.getElementById('postedActivitiesGrid');
    const postedCount = document.getElementById('postedActivitiesCount');
    
    // Add/Edit Modal Elements
    const addActivityModal = document.getElementById('addActivityModal');
    const btnOpenAddActivity = document.getElementById('btnOpenAddActivity');
    const btnCloseAddModal = document.getElementById('btnCloseAddModal');
    const btnCancelAddModal = document.getElementById('btnCancelAddModal');
    const btnSubmitActivity = document.getElementById('btnSubmitActivity');
    const activityModalTitle = document.getElementById('activityModalTitle');

    // Image Viewer Elements
    const imageViewerModal = document.getElementById('imageViewerModal');
    const fullImageDisplay = document.getElementById('fullImageDisplay');
    const fullImageTitle = document.getElementById('fullImageTitle');

    // Global functions for viewer
    window.closeImageViewer = () => { imageViewerModal.style.display = 'none'; };

    window.viewSchoolActivity = (url, title) => {
        fullImageDisplay.src = url;
        fullImageTitle.textContent = title;
        imageViewerModal.style.display = 'flex';
    };

    async function loadSchoolActivities() {
        if (!postedGrid) return;
        
        postedGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 20px; color: #94a3b8;"><i class="fas fa-spinner fa-spin"></i> Loading activities...</div>`;

        const { data, error } = await supabase
            .from('activities')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            postedGrid.innerHTML = `<p style="color: #ef4444; text-align: center;">Failed to load activities.</p>`;
            return;
        }

        if (postedCount) postedCount.textContent = `${data.length} Activities`;

        if (data.length === 0) {
            postedGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #94a3b8; background: #f8fafc; border-radius: 12px; border: 1.5px dashed #e2e8f0;">
                <i class="fas fa-camera" style="font-size: 32px; margin-bottom: 10px; color: #cbd5e1;"></i>
                <p style="margin: 0; font-size: 14px;">No school activities posted yet. Click "Add Activity" to start.</p>
            </div>`;
            return;
        }

        postedGrid.innerHTML = data.map(act => `
            <div style="background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 2px 4px rgba(0,0,0,0.02); transition: transform 0.2s;">
                <div style="position: relative; height: 160px; background: #f1f5f9;">
                    <img src="${act.image_url}" alt="${act.title}" style="width: 100%; height: 100%; object-fit: cover;">
                    <div style="position: absolute; top: 8px; right: 8px; display: flex; gap: 6px;">
                        <button type="button" onclick="window.deleteSchoolActivity('${act.id}')" style="background: #ef4444; color: white; border: none; width: 28px; height: 28px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.2);" title="Delete">
                            <i class="fas fa-trash" style="font-size: 12px;"></i>
                        </button>
                        <button type="button" onclick="window.editSchoolActivity('${act.id}', '${act.title.replace(/'/g, "\\'")}', '${(act.description || '').replace(/'/g, "\\'")}')" style="background: #f59e0b; color: white; border: none; width: 28px; height: 28px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.2);" title="Edit">
                            <i class="fas fa-pen" style="font-size: 12px;"></i>
                        </button>
                    </div>
                </div>
                <div style="padding: 14px; flex: 1; display: flex; flex-direction: column;">
                    <h3 style="margin: 0 0 6px 0; font-size: 15px; font-weight: 700; color: #0f172a; line-height: 1.3;">${act.title}</h3>
                    <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.4; flex: 1;">${act.description || 'No description provided.'}</p>
                    <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 11px; color: #94a3b8;"><i class="far fa-calendar"></i> ${new Date(act.created_at).toLocaleDateString()}</span>
                        <button type="button" onclick="window.viewSchoolActivity('${act.image_url}', '${act.title.replace(/'/g, "\\'")}')" style="background: #e0f2fe; color: #0284c7; border: none; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600;">
                            <i class="fas fa-eye"></i> View
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Add Activity
    if (btnOpenAddActivity) {
        btnOpenAddActivity.addEventListener('click', () => {
            document.getElementById('editActivityId').value = '';
            document.getElementById('actTitle').value = '';
            document.getElementById('actDesc').value = '';
            document.getElementById('actImage').value = '';
            activityModalTitle.innerHTML = '<i class="fas fa-plus-circle"></i> Post New Activity';
            addActivityModal.classList.add('active');
        });
    }

    // Close Modals
    if (btnCloseAddModal) btnCloseAddModal.addEventListener('click', () => addActivityModal.classList.remove('active'));
    if (btnCancelAddModal) btnCancelAddModal.addEventListener('click', () => addActivityModal.classList.remove('active'));

    // Edit Activity
    window.editSchoolActivity = (id, title, desc) => {
        document.getElementById('editActivityId').value = id;
        document.getElementById('actTitle').value = title;
        document.getElementById('actDesc').value = desc;
        document.getElementById('actImage').value = ''; // Reset file input
        activityModalTitle.innerHTML = '<i class="fas fa-pen"></i> Edit Activity';
        addActivityModal.classList.add('active');
    };

    // Delete Activity
    window.deleteSchoolActivity = async (id) => {
        if (!confirm('Are you sure you want to delete this activity?')) return;
        const { error } = await supabase.from('activities').delete().eq('id', id);
        if (error) {
            showAlert('Failed to delete activity.', 'error');
        } else {
            showAlert('Activity deleted successfully.', 'success');
            loadSchoolActivities();
        }
    };

    // Submit Add/Edit
    if (btnSubmitActivity) {
        btnSubmitActivity.addEventListener('click', async () => {
            const id = document.getElementById('editActivityId').value;
            const title = document.getElementById('actTitle').value.trim();
            const desc = document.getElementById('actDesc').value.trim();
            const fileInput = document.getElementById('actImage');
            const file = fileInput.files[0];

            if (!title) return showAlert('Please enter a title.', 'error');

            btnSubmitActivity.disabled = true;
            btnSubmitActivity.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

            try {
                let imageUrl = null;

                // Upload new image if provided
                if (file) {
                    const fileExt = file.name.split('.').pop();
                    const fileName = `activity_${Date.now()}.${fileExt}`;
                    
                    const { error: upErr } = await supabase.storage.from('activity_images').upload(fileName, file);
                    if (upErr) throw upErr;

                    const { data: urlData } = supabase.storage.from('activity_images').getPublicUrl(fileName);
                    imageUrl = urlData.publicUrl;
                }

                if (id) {
                    // EDIT MODE
                    const updateData = { title, description: desc };
                    if (imageUrl) updateData.image_url = imageUrl; // Only update image if a new one was uploaded
                    
                    const { error: dbErr } = await supabase.from('activities').update(updateData).eq('id', id);
                    if (dbErr) throw dbErr;
                    showAlert('Activity updated successfully!', 'success');
                } else {
                    // ADD MODE
                    if (!file) throw new Error('Please select an image for the new activity.');
                    
                    const { error: dbErr } = await supabase.from('activities').insert({
                        title, description: desc, image_url: imageUrl
                    });
                    if (dbErr) throw dbErr;
                    showAlert('Activity posted successfully!', 'success');
                }

                addActivityModal.classList.remove('active');
                loadSchoolActivities();
                if (typeof loadActivities === 'function') loadActivities(); // Refresh audit logs

            } catch (err) {
                console.error(err);
                showAlert('Error: ' + err.message, 'error');
            } finally {
                btnSubmitActivity.disabled = false;
                btnSubmitActivity.innerHTML = '<i class="fas fa-paper-plane"></i> Save Activity';
            }
        });
    }


    // ==========================================
    // 2. AUDIT LOGS & TIMELINE
    // ==========================================
    const refreshBtn = document.getElementById('refreshActivitiesBtn');
    const exportBtn = document.getElementById('exportActivitiesBtn');
    const searchInput = document.getElementById('activitySearchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const roleFilter = document.getElementById('roleFilterSelect');
    const dateFilter = document.getElementById('dateFilterSelect');
    const categoryChips = document.querySelectorAll('.category-chip');
    const streamContainer = document.getElementById('activityStreamContainer');
    const visibleCountBadge = document.getElementById('visibleCountBadge');
    const loadMoreWrap = document.getElementById('loadMoreWrap');
    const loadMoreBtn = document.getElementById('loadMoreBtn');

    const statTotalEl = document.getElementById('statTotalActivities');
    const statEnrollEl = document.getElementById('statEnrollmentActivities');
    const statAccountEl = document.getElementById('statAccountActivities');
    const statSecurityEl = document.getElementById('statSecurityActivities');

    const chipAllCount = document.getElementById('chipAllCount');
    const chipEnrollCount = document.getElementById('chipEnrollCount');
    const chipAccountCount = document.getElementById('chipAccountCount');
    const chipAttendanceCount = document.getElementById('chipAttendanceCount');
    const chipAdminCount = document.getElementById('chipAdminCount');
    const chipSecurityCount = document.getElementById('chipSecurityCount');

    const detailModal = document.getElementById('activityDetailModal');
    const modalBody = document.getElementById('activityModalBody');
    const closeDetailModalBtn = document.getElementById('closeDetailModalBtn');
    const closeDetailModalBtn2 = document.getElementById('closeDetailModalBtn2');

    let allActivities = [];
    let filteredActivities = [];
    let currentCategory = 'all';
    let searchQuery = '';
    let selectedRole = '';
    let selectedDateRange = 'all';
    let displayLimit = 15;
    const PAGE_SIZE = 15;

    function getRelativeTime(dateString) {
        if (!dateString) return 'Just now';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffSecs < 60) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function formatExactDateTime(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true
        });
    }

    function getDateGroupKey(dateString) {
        if (!dateString) return 'Recent';
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return 'Today';
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }

    async function loadActivities() {
        if (streamContainer) {
            streamContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-circle-notch fa-spin"></i>
                    <h4>Loading Activities...</h4>
                    <p>Fetching real-time audit logs from the database.</p>
                </div>
            `;
        }

        try {
            const activities = [];

            // 1. Activity Logs
            try {
                const { data: logData, error: logErr } = await supabase
                    .from('activity_logs').select('*').order('timestamp', { ascending: false }).limit(100);

                if (!logErr && logData && logData.length > 0) {
                    logData.forEach(l => {
                        const isTeacherAttendance = (l.role === 'teacher') || 
                            (l.action && (l.action.toUpperCase().includes('TIME IN') || l.action.toUpperCase().includes('TIME OUT') || l.action.toLowerCase().includes('attendance')));

                        let actType = l.type;
                        if (!actType) {
                            if (isTeacherAttendance) actType = 'attendance';
                            else if (l.action?.toLowerCase().includes('enroll')) actType = 'enrollment';
                            else if (l.action?.toLowerCase().includes('account') || l.action?.toLowerCase().includes('user')) actType = 'account';
                            else if (l.action?.toLowerCase().includes('security') || l.action?.toLowerCase().includes('auth')) actType = 'security';
                            else actType = 'admin_action';
                        }

                        let actorName = l.user_name || l.fullname || '';
                        if (!actorName && l.details && l.details.includes(' validated ')) actorName = l.details.split(' validated ')[0].trim();
                        if (!actorName) actorName = (l.role === 'teacher' || isTeacherAttendance) ? 'Faculty Member' : 'Administrator';

                        const role = (isTeacherAttendance ? 'teacher' : (l.role || l.user_role || 'admin')).toLowerCase();

                        activities.push({
                            id: `log-${l.id}`, type: actType,
                            title: l.action || (isTeacherAttendance ? 'Teacher Attendance Activity' : 'System Action Logged'),
                            description: l.details || l.description || l.message || 'Administrative operation recorded in the system audit log.',
                            actorName: actorName, actorRole: role, actorEmail: l.user_email || l.email || '',
                            date: l.timestamp || l.created_at || new Date().toISOString(),
                            actionLink: role === 'teacher' ? '../teacher/attendance-face.html' : null,
                            actionText: role === 'teacher' ? 'Faculty Portal' : null,
                            metadata: { 'Activity Type': isTeacherAttendance ? 'Faculty Attendance' : 'System Audit Log', 'Action': l.action || 'N/A', 'Actor Role': role.toUpperCase(), 'Details': l.details || '-', 'Timestamp': l.timestamp || 'N/A' }
                        });
                    });
                }
            } catch(e) { console.warn(e); }

            // 2. Enrollments
            const { data: enrData } = await supabase.from('enrollments').select('*').order('created_at', { ascending: false }).limit(60);
            if (enrData && enrData.length > 0) {
                const seen = new Set();
                enrData.forEach(e => {
                    const studentName = `${e.first_name || ''} ${e.last_name || ''}`.trim() || 'Student Applicant';
                    const email = (e.email || '').toLowerCase().trim();
                    const key = email || (e.student_id ? `sid_${e.student_id}` : studentName.toLowerCase());
                    if (key) { if (seen.has(key)) return; seen.add(key); }

                    const gradeStr = e.grade_level || 'Grade Level Not Specified';
                    const strandStr = e.strand ? ` • ${e.strand}` : '';
                    const status = (e.status || 'Pending').toLowerCase();

                    let actTitle = 'Enrollment Application Submitted';
                    if (status === 'approved' || status === 'enrolled') actTitle = 'Enrollment Application Approved';
                    else if (status === 'rejected') actTitle = 'Enrollment Application Rejected';

                    activities.push({
                        id: `enr-${e.id}`, type: 'enrollment', title: actTitle,
                        description: `Student <strong>${studentName}</strong> registered for <strong>${gradeStr}${strandStr}</strong>. Status is currently marked as <strong>${status.toUpperCase()}</strong>.`,
                        actorName: studentName, actorRole: 'student', actorEmail: e.email || '',
                        date: e.updated_at || e.created_at || new Date().toISOString(),
                        actionLink: `view_enrollment.html?id=${e.id}`, actionText: 'View Enrollment',
                        metadata: { 'Reference Number': e.tracking_number || `HES-ENR-${e.id}`, 'Grade & Strand': `${gradeStr}${strandStr}`, 'Enrollment Status': status.toUpperCase(), 'Contact Phone': e.phone || 'N/A' }
                    });
                });
            }

            // 3. Users
            const { data: uData } = await supabase.from('users').select('*').order('created_at', { ascending: false }).limit(50);
            if (uData && uData.length > 0) {
                uData.forEach(u => {
                    const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || 'System User';
                    const role = (u.role || 'user').toLowerCase();
                    const isApproved = u.status === 'approved' || u.is_verified === true || !u.status;
                    activities.push({
                        id: `usr-${u.id}`, type: 'account',
                        title: isApproved ? `User Account Active (${role.toUpperCase()})` : `New ${role.toUpperCase()} Account Registered`,
                        description: `Account for <strong>${fullName}</strong> registered with email <code>${u.email}</code> and role <strong>${role.toUpperCase()}</strong>.`,
                        actorName: fullName, actorRole: role, actorEmail: u.email,
                        date: u.created_at || new Date().toISOString(),
                        actionLink: `view_account.html?id=${u.id}`, actionText: 'View Account',
                        metadata: { 'Account Role': role.toUpperCase(), 'Email': u.email, 'Employee / Student ID': u.id_number || 'N/A', 'Status': isApproved ? 'ACTIVE' : 'PENDING' }
                    });
                });
            }

            // 4. Attendance
            try {
                const { data: attData } = await supabase.from('attendance').select('*').order('created_at', { ascending: false }).limit(30);
                if (attData && attData.length > 0) {
                    attData.forEach(a => {
                        const status = (a.status || 'Present').toUpperCase();
                        activities.push({
                            id: `att-${a.id}`, type: 'attendance', title: `Student Attendance Recorded: ${status}`,
                            description: `Attendance entry logged with status <strong>${status}</strong> on date <strong>${a.date || 'Today'}</strong>.`,
                            actorName: a.student_name || 'Student Attendance', actorRole: 'teacher', actorEmail: '',
                            date: a.created_at || a.date || new Date().toISOString(),
                            actionLink: 'attendance.html', actionText: 'Open Attendance',
                            metadata: { 'Status': status, 'Date': a.date || 'N/A', 'Time Logged': a.time || 'N/A' }
                        });
                    });
                }
            } catch(e) { console.warn(e); }

            // 5. Teacher Attendance
            try {
                const { data: tAttData, error: tAttErr } = await supabase.from('teacher_attendance').select(`id, date, time_in, time_out, status, created_at, teachers ( id, employee_id, specialization, users ( first_name, last_name, email ) )`).order('date', { ascending: false }).limit(60);
                if (!tAttErr && tAttData && tAttData.length > 0) {
                    tAttData.forEach(ta => {
                        const tUser = ta.teachers?.users;
                        const teacherName = tUser ? `${tUser.first_name || ''} ${tUser.last_name || ''}`.trim() : 'Faculty Member';
                        const empId = ta.teachers?.employee_id || 'N/A';
                        const spec = ta.teachers?.specialization || 'Academic Staff';
                        const attStatus = (ta.status || 'Present').toUpperCase();

                        if (ta.time_in) {
                            activities.push({
                                id: `t-att-in-${ta.id}`, type: 'attendance', title: `Teacher Time-In: ${teacherName}`,
                                description: `Faculty member <strong>${teacherName}</strong> recorded <strong>Time-In</strong> at <strong>${ta.time_in}</strong> on <strong>${ta.date}</strong>.`,
                                actorName: teacherName, actorRole: 'teacher', actorEmail: tUser?.email || '',
                                date: ta.created_at || `${ta.date}T${ta.time_in.length === 5 ? ta.time_in + ':00' : ta.time_in}`,
                                actionLink: '../teacher/attendance-face.html', actionText: 'Faculty Attendance',
                                metadata: { 'Faculty Member': teacherName, 'Employee ID': empId, 'Department / Specialization': spec, 'Date': ta.date, 'Time-In': ta.time_in, 'Evaluation Status': attStatus }
                            });
                        }
                        if (ta.time_out) {
                            activities.push({
                                id: `t-att-out-${ta.id}`, type: 'attendance', title: `Teacher Time-Out: ${teacherName}`,
                                description: `Faculty member <strong>${teacherName}</strong> completed <strong>Time-Out</strong> validation at <strong>${ta.time_out}</strong> on <strong>${ta.date}</strong>.`,
                                actorName: teacherName, actorRole: 'teacher', actorEmail: tUser?.email || '',
                                date: `${ta.date}T${ta.time_out.length === 5 ? ta.time_out + ':00' : ta.time_out}`,
                                actionLink: '../teacher/attendance-face.html', actionText: 'Faculty Attendance',
                                metadata: { 'Faculty Member': teacherName, 'Employee ID': empId, 'Department / Specialization': spec, 'Date': ta.date, 'Time-Out': ta.time_out }
                            });
                        }
                    });
                }
            } catch(tAttEx) { console.warn(tAttEx); }

            const seenAttKeys = new Set();
            const uniqueActivities = [];
            for (const act of activities) {
                if (act.type === 'attendance') {
                    const normActor = (act.actorName || '').toLowerCase().trim();
                    const isTimeIn = (act.title || '').toLowerCase().includes('in');
                    const isTimeOut = (act.title || '').toLowerCase().includes('out');
                    const actionTag = isTimeIn ? 'in' : (isTimeOut ? 'out' : 'att');
                    const dateTag = (act.date || '').slice(0, 10);
                    const key = `${normActor}_${actionTag}_${dateTag}`;
                    if (seenAttKeys.has(key)) continue;
                    seenAttKeys.add(key);
                }
                uniqueActivities.push(act);
            }

            uniqueActivities.sort((a, b) => new Date(b.date) - new Date(a.date));
            allActivities = uniqueActivities;

            updateKpiStats();
            applyFilters();
        } catch (err) {
            console.error(err);
            showAlert('Failed to load some activity logs. Please refresh.', 'error');
            if (streamContainer) {
                streamContainer.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle" style="color: #ef4444;"></i><h4>Unable to Load Activities</h4><p>${err.message || 'Database connection error'}</p><button type="button" class="btn-primary" onclick="window.location.reload()"><i class="fas fa-redo"></i> Try Again</button></div>`;
            }
        }
    }

    function updateKpiStats() {
        const total = allActivities.length;
        const enrollCount = allActivities.filter(a => a.type === 'enrollment').length;
        const accountCount = allActivities.filter(a => a.type === 'account').length;
        const attendanceCount = allActivities.filter(a => a.type === 'attendance').length;
        const adminCount = allActivities.filter(a => a.type === 'admin_action').length;
        const securityCount = allActivities.filter(a => a.type === 'security').length;

        if (statTotalEl) statTotalEl.textContent = total;
        if (statEnrollEl) statEnrollEl.textContent = enrollCount;
        if (statAccountEl) statAccountEl.textContent = accountCount;
        if (statSecurityEl) statSecurityEl.textContent = attendanceCount + adminCount + securityCount;

        if (chipAllCount) chipAllCount.textContent = total;
        if (chipEnrollCount) chipEnrollCount.textContent = enrollCount;
        if (chipAccountCount) chipAccountCount.textContent = accountCount;
        if (chipAttendanceCount) chipAttendanceCount.textContent = attendanceCount;
        if (chipAdminCount) chipAdminCount.textContent = adminCount;
        if (chipSecurityCount) chipSecurityCount.textContent = securityCount;
    }

    function applyFilters() {
        const query = (searchQuery || '').toLowerCase().trim();
        const role = (selectedRole || '').toLowerCase();
        const dateRange = selectedDateRange;
        const category = currentCategory;

        const now = new Date();
        const todayStr = now.toDateString();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toDateString();
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        filteredActivities = allActivities.filter(act => {
            if (category !== 'all') {
                if (category === 'security' && (act.type === 'security' || act.type === 'admin_action')) {
                    // Match
                } else if (act.type !== category) return false;
            }
            if (role && act.actorRole !== role) return false;
            if (dateRange !== 'all') {
                const actDate = new Date(act.date);
                if (dateRange === 'today' && actDate.toDateString() !== todayStr) return false;
                if (dateRange === 'yesterday' && actDate.toDateString() !== yesterdayStr) return false;
                if (dateRange === 'week' && actDate < oneWeekAgo) return false;
                if (dateRange === 'month' && actDate < firstDayOfMonth) return false;
            }
            if (query) {
                const combined = `${act.title} ${act.description} ${act.actorName} ${act.actorEmail} ${act.actorRole} ${JSON.stringify(act.metadata || {})}`.toLowerCase();
                if (!combined.includes(query)) return false;
            }
            return true;
        });

        displayLimit = PAGE_SIZE;
        renderActivityStream();
    }

    function renderActivityStream() {
        if (!streamContainer) return;

        if (visibleCountBadge) visibleCountBadge.textContent = `Showing ${Math.min(displayLimit, filteredActivities.length)} of ${filteredActivities.length} activities`;

        if (filteredActivities.length === 0) {
            streamContainer.innerHTML = `<div class="empty-state"><i class="fas fa-search-minus"></i><h4>No Activities Found</h4><p>No recorded activities matched your search criteria or active filters.</p><button type="button" class="btn-secondary" id="resetFiltersBtn"><i class="fas fa-undo"></i> Reset Filters</button></div>`;
            const resetBtn = document.getElementById('resetFiltersBtn');
            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    if (searchInput) searchInput.value = '';
                    if (clearSearchBtn) clearSearchBtn.style.display = 'none';
                    if (roleFilter) roleFilter.value = '';
                    if (dateFilter) dateFilter.value = 'all';
                    categoryChips.forEach(c => c.classList.toggle('active', c.dataset.category === 'all'));
                    currentCategory = 'all'; searchQuery = ''; selectedRole = ''; selectedDateRange = 'all';
                    applyFilters();
                });
            }
            if (loadMoreWrap) loadMoreWrap.style.display = 'none';
            return;
        }

        const itemsToShow = filteredActivities.slice(0, displayLimit);
        let html = ''; let lastGroup = null;

        const iconMap = {
            enrollment: { icon: 'fa-file-signature', class: 'enrollment' },
            account: { icon: 'fa-user-plus', class: 'account' },
            approval: { icon: 'fa-user-check', class: 'approval' },
            attendance: { icon: 'fa-calendar-check', class: 'attendance' },
            admin_action: { icon: 'fa-shield-alt', class: 'system' },
            security: { icon: 'fa-lock', class: 'security' },
            system: { icon: 'fa-history', class: 'system' }
        };

        itemsToShow.forEach((act, index) => {
            const groupKey = getDateGroupKey(act.date);
            if (groupKey !== lastGroup) { html += `<div class="activity-date-divider">${groupKey}</div>`; lastGroup = groupKey; }

            const iconInfo = iconMap[act.type] || iconMap.system;
            const actorInitial = (act.actorName || 'U').charAt(0).toUpperCase();
            const relTime = getRelativeTime(act.date);
            const exactTime = formatExactDateTime(act.date);

            html += `
                <div class="activity-item-card" data-index="${index}">
                    <div class="activity-item-icon-box ${iconInfo.class}"><i class="fas ${iconInfo.icon}"></i></div>
                    <div class="activity-item-body">
                        <div class="activity-item-top">
                            <span class="activity-item-title">${act.title}</span>
                            <span class="activity-item-time" title="${exactTime}"><i class="far fa-clock"></i> ${relTime}</span>
                        </div>
                        <div class="activity-item-desc">${act.description}</div>
                        <div class="activity-item-meta">
                            <span class="activity-user-pill"><span class="activity-user-avatar">${actorInitial}</span><span>${act.actorName}</span></span>
                            <span class="activity-role-badge ${act.actorRole}">${act.actorRole}</span>
                            ${act.actionLink ? `<a href="${act.actionLink}" class="activity-action-btn"><i class="fas fa-arrow-up-right-from-square"></i> ${act.actionText || 'View'}</a>` : ''}
                        </div>
                    </div>
                </div>
            `;
        });

        streamContainer.innerHTML = html;

        const cards = streamContainer.querySelectorAll('.activity-item-card');
        cards.forEach(card => {
            card.addEventListener('click', function(e) {
                if (e.target.closest('.activity-action-btn')) return;
                const idx = parseInt(this.dataset.index, 10);
                const act = itemsToShow[idx];
                if (act) showActivityDetailModal(act);
            });
        });

        if (loadMoreWrap) loadMoreWrap.style.display = displayLimit < filteredActivities.length ? 'block' : 'none';
    }

    function showActivityDetailModal(act) {
        if (!detailModal || !modalBody) return;
        let metaHtml = '';
        if (act.metadata && Object.keys(act.metadata).length > 0) {
            for (const [k, v] of Object.entries(act.metadata)) {
                metaHtml += `<div class="detail-item"><span class="detail-label">${k}</span><span class="detail-value">${v}</span></div>`;
            }
        }
        modalBody.innerHTML = `
            <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 20px; padding: 14px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
                <div style="width: 44px; height: 44px; border-radius: 12px; background: #1B2A4A; color: #FFD700; display: flex; align-items: center; justify-content: center; font-size: 18px;"><i class="fas fa-history"></i></div>
                <div><h4 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 700; color: #0f172a;">${act.title}</h4><span class="activity-role-badge ${act.actorRole}">${act.actorRole}</span></div>
            </div>
            <div style="margin-bottom: 20px; font-size: 14px; line-height: 1.6; color: #334155; padding: 12px 14px; background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 10px;">${act.description}</div>
            <div class="activity-detail-grid">
                <div class="detail-item"><span class="detail-label">Actor / Initiator</span><span class="detail-value">${act.actorName}</span></div>
                <div class="detail-item"><span class="detail-label">Email Address</span><span class="detail-value">${act.actorEmail || 'N/A'}</span></div>
                <div class="detail-item"><span class="detail-label">Exact Timestamp</span><span class="detail-value">${formatExactDateTime(act.date)}</span></div>
                <div class="detail-item"><span class="detail-label">Event Category</span><span class="detail-value" style="text-transform: capitalize;">${act.type}</span></div>
                ${metaHtml}
            </div>
            ${act.actionLink ? `<div style="text-align: right; margin-top: 10px;"><a href="${act.actionLink}" class="btn-primary" style="text-decoration: none;"><i class="fas fa-external-link-alt"></i> Navigate to ${act.actionText || 'Details'}</a></div>` : ''}
        `;
        detailModal.style.display = 'flex';
    }

    function closeDetailModal() { if (detailModal) detailModal.style.display = 'none'; }
    if (closeDetailModalBtn) closeDetailModalBtn.addEventListener('click', closeDetailModal);
    if (closeDetailModalBtn2) closeDetailModalBtn2.addEventListener('click', closeDetailModal);
    window.addEventListener('click', (e) => { if (e.target === detailModal) closeDetailModal(); });

    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            refreshBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Refreshing...';
            refreshBtn.disabled = true;
            await loadActivities();
            refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
            refreshBtn.disabled = false;
            showAlert('System activities synchronized successfully!', 'success');
        });
    }

    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            if (filteredActivities.length === 0) return showAlert('No activities to export.', 'error');
            const headers = ['Timestamp', 'Type', 'Title', 'Description', 'Actor Name', 'Role', 'Email'];
            const rows = filteredActivities.map(a => [
                `"${formatExactDateTime(a.date)}"`, `"${a.type}"`, `"${(a.title || '').replace(/"/g, '""')}"`,
                `"${(a.description || '').replace(/<[^>]*>/g, '').replace(/"/g, '""')}"`, `"${(a.actorName || '').replace(/"/g, '""')}"`,
                `"${a.actorRole}"`, `"${a.actorEmail || ''}"`
            ]);
            const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            const link = document.createElement('a');
            link.setAttribute('href', encodeURI(csvContent));
            link.setAttribute('download', `HES_Activities_Log_${new Date().toISOString().slice(0, 10)}.csv`);
            document.body.appendChild(link); link.click(); document.body.removeChild(link);
            showAlert('Activities exported to CSV successfully!', 'success');
        });
    }

    if (searchInput) searchInput.addEventListener('input', function() { searchQuery = this.value; if (clearSearchBtn) clearSearchBtn.style.display = searchQuery ? 'block' : 'none'; applyFilters(); });
    if (clearSearchBtn) clearSearchBtn.addEventListener('click', function() { if (searchInput) searchInput.value = ''; searchQuery = ''; this.style.display = 'none'; applyFilters(); });
    if (roleFilter) roleFilter.addEventListener('change', function() { selectedRole = this.value; applyFilters(); });
    if (dateFilter) dateFilter.addEventListener('change', function() { selectedDateRange = this.value; applyFilters(); });
    categoryChips.forEach(chip => chip.addEventListener('click', function() { categoryChips.forEach(c => c.classList.remove('active')); this.classList.add('active'); currentCategory = this.dataset.category || 'all'; applyFilters(); }));
    if (loadMoreBtn) loadMoreBtn.addEventListener('click', function() { displayLimit += PAGE_SIZE; renderActivityStream(); });

    // Initial Load
    await loadSchoolActivities();
    await loadActivities();
});