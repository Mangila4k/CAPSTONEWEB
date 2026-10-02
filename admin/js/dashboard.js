// ===== DASHBOARD JAVASCRIPT (SUPABASE POWERED) =====
import { supabase } from '../../supabase/config.js';

document.addEventListener('DOMContentLoaded', async function() {
    'use strict';

    // ===== ROLE & SESSION GUARD =====
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

    // ===== STATE STORE =====
    const dashboardData = {
        stats: {
            totalStudents: 0,
            totalTeachers: 0,
            totalSections: 0,
            totalSubjects: 0,
            totalEnrollments: 0,
            enrolledCount: 0,
            pendingCount: 0,
            profileUpdates: 0,
            adminActions: 0,
            accountApprovals: 0,
            enrollmentActions: 0,
            totalUsers: 0
        },
        notifications: [],
        recentActivities: [],
        recentEnrollments: [],
        adminActions: [],
        accountApprovals: [],
        enrollmentApprovals: [],
        profileUpdates: [],
        allUsers: []
    };

    // ===== DOM ELEMENTS =====
    const notificationBtn = document.getElementById('notificationBtn');
    const notificationDropdown = document.getElementById('notificationDropdown');
    const notificationList = document.getElementById('notificationList');
    const markAllReadBtn = document.getElementById('markAllReadBtn');
    const notifCount = document.getElementById('notifCount');
    const unreadPill = document.getElementById('unreadPill');
    const triggerSimulatedNotifBtn = document.getElementById('triggerSimulatedNotifBtn');
    const clearAllNotifsBtn = document.getElementById('clearAllNotifsBtn');

    // Modal elements
    const notificationDetailModal = document.getElementById('notificationDetailModal');
    const closeNotifModalBtn = document.getElementById('closeNotifModalBtn');
    const dismissNotifModalBtn = document.getElementById('dismissNotifModalBtn');
    const modalNotifIcon = document.getElementById('modalNotifIcon');
    const modalNotifCategory = document.getElementById('modalNotifCategory');
    const modalNotifTitle = document.getElementById('modalNotifTitle');
    const modalNotifTime = document.getElementById('modalNotifTime');
    const modalNotifStatusBadge = document.getElementById('modalNotifStatusBadge');
    const modalNotifMessage = document.getElementById('modalNotifMessage');
    const modalNotifSender = document.getElementById('modalNotifSender');
    const modalNotifActionType = document.getElementById('modalNotifActionType');
    const modalNotifPriority = document.getElementById('modalNotifPriority');
    const modalNotifSystemId = document.getElementById('modalNotifSystemId');
    const modalNotifActionLink = document.getElementById('modalNotifActionLink');

    let currentNotifFilter = 'all';

    // Format relative time helper
    function getRelativeTimeString(dateString) {
        if (!dateString) return 'Just now';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (isNaN(diffMins) || diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    // Update stats counters
    function updateStats() {
        const stats = dashboardData.stats;
        const setTxt = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        setTxt('totalStudents', stats.totalStudents);
        setTxt('totalTeachers', stats.totalTeachers);
        setTxt('totalSections', stats.totalSections);
        setTxt('totalSubjects', stats.totalSubjects);
        setTxt('totalEnrollments', stats.totalEnrollments);
        setTxt('enrolledCount', stats.enrolledCount);
        setTxt('pendingCount', stats.pendingCount);
        setTxt('profileUpdates', stats.profileUpdates);
        setTxt('adminActions', stats.adminActions);
        setTxt('accountApprovals', stats.accountApprovals);
        setTxt('enrollmentActions', stats.enrollmentActions);
        setTxt('totalUsers', stats.totalUsers);
        
        setTxt('adminActionsCount', `${stats.adminActions} actions`);
        setTxt('accountApprovalsCount', `${stats.accountApprovals} approvals`);
        setTxt('enrollmentActionsCount', `${stats.enrollmentActions} actions`);
        setTxt('profileUpdatesCount', `${stats.profileUpdates} updates`);
        setTxt('usersCount', `${dashboardData.allUsers.length} users`);
    }

    // Render notifications dropdown
    function renderNotifications() {
        if (!notificationList) return;

        const notifications = dashboardData.notifications || [];
        const unreadCount = notifications.filter(n => !n.is_read).length;

        // Update badge counters
        if (notifCount) {
            notifCount.textContent = unreadCount;
            notifCount.classList.toggle('empty', unreadCount === 0);
        }
        if (unreadPill) {
            unreadPill.textContent = `${unreadCount} New`;
            unreadPill.style.display = unreadCount > 0 ? 'inline-block' : 'none';
        }

        let displayNotifs = [...notifications];
        if (currentNotifFilter === 'unread') {
            displayNotifs = displayNotifs.filter(n => !n.is_read);
        }

        if (displayNotifs.length === 0) {
            notificationList.innerHTML = `
                <div class="empty-notifications">
                    <i class="fas fa-bell-slash"></i>
                    <p>${currentNotifFilter === 'unread' ? 'No unread notifications' : 'No notifications yet'}</p>
                </div>
            `;
            return;
        }

        const icons = {
            update: 'fa-bullhorn',
            action: 'fa-check-circle',
            reminder: 'fa-clock',
            alert: 'fa-exclamation-triangle',
            warning: 'fa-exclamation-triangle',
            message: 'fa-envelope',
            grade: 'fa-star',
            requirement: 'fa-file-upload',
            profile: 'fa-user-edit',
            enrollment: 'fa-graduation-cap',
            account: 'fa-user-plus'
        };

        let html = '';
        displayNotifs.forEach(notif => {
            const icon = icons[notif.type] || 'fa-bell';
            const timeAgo = getRelativeTimeString(notif.created_at);
            
            html += `
                <div class="notif-item ${notif.is_read ? 'read' : 'unread'}" data-id="${notif.id}">
                    <div class="notif-icon notif-${notif.type || 'message'}">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="notif-content">
                        <div class="notif-title">
                            <span>${notif.title}</span>
                            <span class="notif-time">${timeAgo}</span>
                        </div>
                        <div class="notif-message">${notif.message || ''}</div>
                    </div>
                    <div class="notif-item-actions">
                        ${!notif.is_read ? `
                            <button type="button" class="mark-read-btn" data-id="${notif.id}" title="Mark as read">
                                <i class="fas fa-check"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        });

        notificationList.innerHTML = html;

        // Click on entire notification item to OPEN DETAIL MODAL
        notificationList.querySelectorAll('.notif-item').forEach(item => {
            item.addEventListener('click', function(e) {
                if (e.target.closest('.mark-read-btn')) return;
                const id = this.dataset.id;
                openNotificationDetailModal(id);
            });
        });

        // Click on checkmark button
        notificationList.querySelectorAll('.mark-read-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = this.dataset.id;
                markNotificationRead(id);
            });
        });
    }

    // Open Notification Detail Modal
    async function openNotificationDetailModal(id) {
        const notif = dashboardData.notifications.find(n => String(n.id) === String(id));
        if (!notif) return;

        // Mark as read in state and database
        if (!notif.is_read) {
            notif.is_read = true;
            try {
                await supabase.from('notifications').update({ read: true }).eq('id', notif.id);
            } catch(e) {
                console.warn('Could not update notification read status:', e);
            }
            renderNotifications();
        }

        // Close dropdown
        if (notificationDropdown) notificationDropdown.classList.remove('show');

        // Populate modal
        const icons = {
            update: 'fa-bullhorn',
            action: 'fa-check-circle',
            reminder: 'fa-clock',
            alert: 'fa-exclamation-triangle',
            warning: 'fa-exclamation-triangle',
            message: 'fa-envelope',
            grade: 'fa-star',
            requirement: 'fa-file-upload',
            profile: 'fa-user-edit',
            enrollment: 'fa-graduation-cap',
            account: 'fa-user-plus'
        };

        const iconClass = icons[notif.type] || 'fa-bell';
        if (modalNotifIcon) modalNotifIcon.innerHTML = `<i class="fas ${iconClass}"></i>`;
        if (modalNotifCategory) modalNotifCategory.textContent = (notif.type || 'System').toUpperCase();
        if (modalNotifTitle) modalNotifTitle.textContent = notif.title || 'Notification';
        
        const fullDate = new Date(notif.created_at).toLocaleString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
        });
        if (modalNotifTime) modalNotifTime.textContent = fullDate;
        
        if (modalNotifStatusBadge) {
            modalNotifStatusBadge.textContent = 'Read';
            modalNotifStatusBadge.className = 'notif-read-status';
        }

        if (modalNotifMessage) modalNotifMessage.textContent = notif.message || 'No description provided.';
        if (modalNotifSender) modalNotifSender.textContent = notif.sender || 'Hiraya Enrollment System';
        if (modalNotifActionType) modalNotifActionType.textContent = notif.actionType || notif.type || 'System Notification';
        if (modalNotifPriority) modalNotifPriority.textContent = notif.priority || 'Normal';
        if (modalNotifSystemId) modalNotifSystemId.textContent = `NOTIF-${String(notif.id).substring(0, 8)}`;

        // Link
        if (modalNotifActionLink) {
            let url = notif.actionUrl;
            let label = notif.actionLabel;
            if (!url) {
                if (notif.type === 'enrollment') { url = 'enrollments.html'; label = 'Go to Enrollments'; }
                else if (notif.type === 'account') { url = 'manage_accounts.html'; label = 'Go to Accounts'; }
                else if (notif.type === 'action') { url = 'sections.html'; label = 'Go to Sections'; }
                else if (notif.type === 'profile') { url = 'student.html'; label = 'Go to Students'; }
                else if (notif.type === 'attendance') { url = 'attendance.html'; label = 'Go to Attendance'; }
                else { url = 'dashboard.html'; label = 'Dashboard'; }
            }
            modalNotifActionLink.href = url;
            modalNotifActionLink.innerHTML = `<span>${label || 'Go to Related Page'}</span> <i class="fas fa-arrow-right"></i>`;
        }

        // Show modal
        if (notificationDetailModal) {
            notificationDetailModal.classList.add('active');
        }
    }

    // Mark single notification as read
    async function markNotificationRead(id) {
        const notif = dashboardData.notifications.find(n => String(n.id) === String(id));
        if (notif) {
            notif.is_read = true;
            try {
                await supabase.from('notifications').update({ read: true }).eq('id', notif.id);
            } catch (e) {
                console.warn('Error marking notification read in DB:', e);
            }
            renderNotifications();
        }
    }

    // Mark all notifications as read
    async function markAllRead() {
        dashboardData.notifications.forEach(n => n.is_read = true);
        renderNotifications();
        try {
            await supabase.from('notifications').update({ read: true }).eq('read', false);
        } catch(e) {
            console.warn('Error batch updating read status in DB:', e);
        }
    }

    // Filter notifications in dropdown
    document.querySelectorAll('.notif-filter-btn[data-filter]').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            document.querySelectorAll('.notif-filter-btn[data-filter]').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentNotifFilter = this.dataset.filter;
            renderNotifications();
        });
    });

    // Unread pill in dropdown header is also clickable to filter unread
    if (unreadPill) {
        unreadPill.style.cursor = 'pointer';
        unreadPill.setAttribute('title', 'Click to show unread notifications');
        unreadPill.addEventListener('click', function(e) {
            e.stopPropagation();
            document.querySelectorAll('.notif-filter-btn[data-filter]').forEach(b => {
                b.classList.toggle('active', b.dataset.filter === 'unread');
            });
            currentNotifFilter = 'unread';
            renderNotifications();
        });
    }

    // Clear read notifications
    if (clearAllNotifsBtn) {
        clearAllNotifsBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            dashboardData.notifications = dashboardData.notifications.filter(n => !n.is_read);
            renderNotifications();
        });
    }

    // Trigger test notification
    if (triggerSimulatedNotifBtn) {
        triggerSimulatedNotifBtn.addEventListener('click', async function(e) {
            e.stopPropagation();
            const sampleAlerts = [
                {
                    type: 'enrollment',
                    title: 'New Online Enrollment Form',
                    message: 'A student submitted enrollment documents for initial verification review.',
                    actionType: 'Enrollment Request',
                    priority: 'High'
                },
                {
                    type: 'account',
                    title: 'Account Verification Pending',
                    message: 'New faculty or registrar staff registration requires admin review.',
                    actionType: 'User Authorization',
                    priority: 'Medium'
                },
                {
                    type: 'alert',
                    title: 'Attendance Report Update',
                    message: 'Daily attendance logs compiled for today across junior and senior high school.',
                    actionType: 'Attendance Notice',
                    priority: 'Normal'
                }
            ];

            const alert = sampleAlerts[Math.floor(Math.random() * sampleAlerts.length)];
            try {
                const { data, error } = await supabase.from('notifications').insert([{
                    user_id: currentUser?.id,
                    role: 'admin',
                    title: alert.title,
                    message: alert.message,
                    type: alert.type,
                    read: false
                }]).select();

                if (!error && data && data.length > 0) {
                    const inserted = data[0];
                    dashboardData.notifications.unshift({
                        id: inserted.id,
                        type: inserted.type || 'message',
                        title: inserted.title,
                        message: inserted.message,
                        created_at: inserted.created_at || new Date().toISOString(),
                        is_read: false,
                        sender: 'System Admin',
                        actionType: alert.actionType,
                        priority: alert.priority
                    });
                    renderNotifications();
                }
            } catch (err) {
                console.warn('Error inserting test notification into Supabase:', err);
            }

            if (notificationBtn) {
                notificationBtn.style.transform = 'scale(1.18) rotate(12deg)';
                setTimeout(() => {
                    notificationBtn.style.transform = 'scale(1) rotate(0deg)';
                }, 250);
            }
        });
    }

    // Modal close handlers
    function closeDetailModal() {
        if (notificationDetailModal) {
            notificationDetailModal.classList.remove('active');
        }
    }

    if (closeNotifModalBtn) {
        closeNotifModalBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            closeDetailModal();
        });
    }

    if (dismissNotifModalBtn) {
        dismissNotifModalBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            closeDetailModal();
        });
    }

    window.addEventListener('click', function(e) {
        if (e.target === notificationDetailModal) {
            closeDetailModal();
        }
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeDetailModal();
            if (notificationDropdown) {
                notificationDropdown.classList.remove('show');
            }
        }
    });

    // Render recent activities
    function renderActivities() {
        const list = document.getElementById('activityList');
        if (!list) return;
        const activities = dashboardData.recentActivities;

        if (activities.length === 0) {
            list.innerHTML = `
                <li class="activity-item">
                    <div class="activity-icon"><i class="fas fa-bell"></i></div>
                    <div class="activity-content">
                        <div class="activity-text">No recent activities recorded</div>
                    </div>
                </li>
            `;
            return;
        }

        const icons = {
            enrollment: 'fa-user-graduate',
            requirement: 'fa-file-upload',
            profile: 'fa-user-edit',
            admin_action: 'fa-shield-alt',
            account_approval: 'fa-user-check',
            enrollment_approval: 'fa-file-signature',
            message: 'fa-envelope'
        };

        let html = '';
        activities.forEach(activity => {
            const icon = icons[activity.type] || 'fa-bell';
            const time = new Date(activity.date).toLocaleString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
            });
            
            html += `
                <li class="activity-item">
                    <div class="activity-icon"><i class="fas ${icon}"></i></div>
                    <div class="activity-content">
                        <div class="activity-text">${activity.description}</div>
                        <div class="activity-time"><i class="far fa-clock"></i> ${time}</div>
                    </div>
                </li>
            `;
        });

        list.innerHTML = html;
    }

    // Render recent enrollments
    function renderEnrollments() {
        const list = document.getElementById('enrollmentList');
        if (!list) return;
        const enrollments = dashboardData.recentEnrollments;

        if (enrollments.length === 0) {
            list.innerHTML = `
                <li class="enrollment-item">
                    <div class="enrollment-info">
                        <p>No recent enrollments recorded</p>
                    </div>
                </li>
            `;
            return;
        }

        let html = '';
        enrollments.forEach(enrollment => {
            const initial = enrollment.fullname.charAt(0).toUpperCase();
            const time = new Date(enrollment.created_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric'
            });
            
            html += `
                <li class="enrollment-item">
                    <div class="enrollment-avatar">${initial}</div>
                    <div class="enrollment-info">
                        <h4>${enrollment.fullname}</h4>
                        <div class="enrollment-meta">
                            <span>${enrollment.grade_name}</span>
                            <span class="status-badge status-${enrollment.status.toLowerCase()}">${enrollment.status}</span>
                        </div>
                        <div class="enrollment-date"><i class="far fa-calendar-alt"></i> ${time}</div>
                    </div>
                </li>
            `;
        });

        list.innerHTML = html;
    }

    // Render admin actions table
    function renderAdminActions() {
        const tbody = document.getElementById('adminActionsBody');
        if (!tbody) return;
        const actions = dashboardData.adminActions;

        if (actions.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="empty-state" style="text-align: center; padding: 24px; color: #64748b;"><p>No administrator actions logged yet</p></td></tr>`;
            return;
        }

        let html = '';
        actions.forEach(action => {
            const initial = action.fullname.charAt(0).toUpperCase();
            const time = new Date(action.created_at).toLocaleString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
            });

            html += `
                <tr>
                    <td>
                        <div class="user-info">
                            <div class="user-avatar">${initial}</div>
                            <div class="user-details">
                                <strong>${action.fullname}</strong>
                                <small>${action.role}</small>
                            </div>
                        </div>
                    </td>
                    <td><span class="action-badge"><i class="fas fa-check-circle"></i> ${action.title}</span></td>
                    <td>${action.message.substring(0, 80)}${action.message.length > 80 ? '...' : ''}</td>
                    <td>${time}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    // Render account approvals table
    function renderAccountApprovals() {
        const tbody = document.getElementById('accountApprovalsBody');
        if (!tbody) return;
        const approvals = dashboardData.accountApprovals;

        if (approvals.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="empty-state" style="text-align: center; padding: 24px; color: #64748b;"><p>No account activity recorded</p></td></tr>`;
            return;
        }

        let html = '';
        approvals.forEach(approval => {
            const initial = approval.fullname.charAt(0).toUpperCase();
            const time = new Date(approval.created_at).toLocaleString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
            });
            const isApproved = approval.title.includes('Approved') || approval.title.includes('Active');

            html += `
                <tr>
                    <td>
                        <div class="user-info">
                            <div class="user-avatar">${initial}</div>
                            <div class="user-details">
                                <strong>${approval.fullname}</strong>
                                <small>${approval.role}</small>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="action-badge ${isApproved ? 'badge-approved' : 'badge-rejected'}">
                            <i class="fas ${isApproved ? 'fa-check-circle' : 'fa-times-circle'}"></i> 
                            ${approval.title}
                        </span>
                    </td>
                    <td>${approval.message.substring(0, 80)}${approval.message.length > 80 ? '...' : ''}</td>
                    <td>${time}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    // Render enrollment approvals table
    function renderEnrollmentApprovals() {
        const tbody = document.getElementById('enrollmentApprovalsBody');
        if (!tbody) return;
        const approvals = dashboardData.enrollmentApprovals;

        if (approvals.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="empty-state" style="text-align: center; padding: 24px; color: #64748b;"><p>No approved enrollments recorded</p></td></tr>`;
            return;
        }

        let html = '';
        approvals.forEach(approval => {
            const initial = approval.fullname.charAt(0).toUpperCase();
            const time = new Date(approval.created_at).toLocaleString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
            });
            const isApproved = approval.title.includes('Approved');

            html += `
                <tr>
                    <td>
                        <div class="user-info">
                            <div class="user-avatar">${initial}</div>
                            <div class="user-details">
                                <strong>${approval.fullname}</strong>
                                <small>${approval.role}</small>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="action-badge ${isApproved ? 'badge-approved' : 'badge-rejected'}">
                            <i class="fas ${isApproved ? 'fa-check-circle' : 'fa-times-circle'}"></i> 
                            ${approval.title}
                        </span>
                    </td>
                    <td>${approval.message.substring(0, 80)}${approval.message.length > 80 ? '...' : ''}</td>
                    <td>${time}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    // Render profile updates table
    function renderProfileUpdates() {
        const tbody = document.getElementById('profileUpdatesBody');
        if (!tbody) return;
        const updates = dashboardData.profileUpdates;

        if (updates.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="empty-state" style="text-align: center; padding: 24px; color: #64748b;"><p>No profile changes logged yet</p></td></tr>`;
            return;
        }

        let html = '';
        updates.forEach(update => {
            const initial = update.fullname.charAt(0).toUpperCase();
            const time = new Date(update.created_at).toLocaleString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
            });

            html += `
                <tr>
                    <td>
                        <div class="user-info">
                            <div class="user-avatar">${initial}</div>
                            <div class="user-details">
                                <strong>${update.fullname}</strong>
                                <small>${update.email}</small>
                            </div>
                        </div>
                    </td>
                    <td><span class="role-badge ${update.role.toLowerCase()}">${update.role}</span></td>
                    <td><strong>${update.title}</strong></td>
                    <td>${update.message}</td>
                    <td>${time}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    // Render all users table
    function renderUsers() {
        const tbody = document.getElementById('usersBody');
        if (!tbody) return;
        const users = dashboardData.allUsers;

        if (users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="empty-state" style="text-align: center; padding: 24px; color: #64748b;"><p>No user accounts found in database</p></td></tr>`;
            return;
        }

        let html = '';
        users.forEach(user => {
            const initial = user.fullname.charAt(0).toUpperCase();
            const registeredDate = new Date(user.registered_date).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric'
            });
            const lastActivity = new Date(user.last_activity).toLocaleString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
            });

            html += `
                <tr>
                    <td>
                        <div class="user-info">
                            <div class="user-avatar">${initial}</div>
                            <div class="user-details">
                                <strong>${user.fullname}</strong>
                                <small>${user.email}</small>
                            </div>
                        </div>
                    </td>
                    <td><span class="role-badge ${(user.role || '').toLowerCase()}">${user.role}</span></td>
                    <td><span class="status-badge status-${user.status}">${user.status}</span></td>
                    <td>${registeredDate}</td>
                    <td><span class="notif-count-badge">${user.notification_count} notifications</span></td>
                    <td>${lastActivity}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    // Initialize enrollment chart
    let enrollmentChartInstance = null;

    function initChart(enrolledData = null, pendingData = null) {
        const ctx = document.getElementById('enrollmentChart');
        if (!ctx || typeof Chart === 'undefined') return;

        const defaultEnrolled = enrolledData || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        const defaultPending = pendingData || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

        if (enrollmentChartInstance) {
            enrollmentChartInstance.data.datasets[0].data = defaultEnrolled;
            enrollmentChartInstance.data.datasets[1].data = defaultPending;
            enrollmentChartInstance.update();
            return;
        }

        enrollmentChartInstance = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                datasets: [
                    {
                        label: 'Enrolled Students',
                        data: defaultEnrolled,
                        borderColor: '#1B2A4A',
                        backgroundColor: 'rgba(27, 42, 74, 0.05)',
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: '#1B2A4A',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    },
                    {
                        label: 'Pending Approvals',
                        data: defaultPending,
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.05)',
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: '#f59e0b',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            boxWidth: 8,
                            padding: 15,
                            font: {
                                family: "'Inter', sans-serif",
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#1B2A4A',
                        titleFont: { family: "'Inter', sans-serif", size: 13 },
                        bodyFont: { family: "'Inter', sans-serif", size: 12 },
                        padding: 10,
                        cornerRadius: 8
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#f1f5f9'
                        },
                        ticks: {
                            font: { family: "'Inter', sans-serif", size: 11 },
                            color: '#94a3b8',
                            precision: 0
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: { family: "'Inter', sans-serif", size: 11 },
                            color: '#94a3b8'
                        }
                    }
                }
            }
        });
    }

    // ===== NOTIFICATION DROPDOWN TOGGLE =====
    function toggleNotificationDropdown(e) {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        if (notificationDropdown) {
            notificationDropdown.classList.toggle('show');
        }
    }

    if (notificationBtn) {
        notificationBtn.addEventListener('click', toggleNotificationDropdown);
    }
    if (notifCount) {
        notifCount.addEventListener('click', toggleNotificationDropdown);
    }

    if (notificationDropdown) {
        notificationDropdown.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    }

    document.addEventListener('click', function(e) {
        if (notificationDropdown && notificationDropdown.classList.contains('show')) {
            const isClickInsideBtn = notificationBtn && notificationBtn.contains(e.target);
            const isClickInsideDropdown = notificationDropdown.contains(e.target);
            if (!isClickInsideBtn && !isClickInsideDropdown) {
                notificationDropdown.classList.remove('show');
            }
        }
    });

    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            markAllRead();
        });
    }

    // ===== MOBILE MENU =====
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
        });
    }

    document.addEventListener('click', function(e) {
        if (window.innerWidth <= 768 && sidebar && menuToggle) {
            if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                sidebar.classList.remove('active');
            }
        }
    });

    // ===== LIVE SUPABASE SYNC =====
    async function syncLiveDashboardData() {
        try {
            // Fetch live counts & records concurrently from Supabase
            const [
                { count: studentCount },
                { count: teacherCount },
                { count: sectionCount },
                { count: subjectCount },
                { count: userCount },
                { data: enrData },
                { data: sData },
                { data: uData },
                { data: actData },
                { data: notifsData }
            ] = await Promise.all([
                supabase.from('students').select('*', { count: 'exact', head: true }),
                supabase.from('teachers').select('*', { count: 'exact', head: true }),
                supabase.from('sections').select('*', { count: 'exact', head: true }),
                supabase.from('subjects').select('*', { count: 'exact', head: true }),
                supabase.from('users').select('*', { count: 'exact', head: true }),
                supabase.from('enrollments').select('*').order('created_at', { ascending: false }),
                supabase.from('students').select('*'),
                supabase.from('users').select('*').order('created_at', { ascending: false }),
                supabase.from('activity_logs').select('*').order('timestamp', { ascending: false }).limit(20),
                supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(30)
            ]);

            dashboardData.stats.totalStudents = studentCount ?? (sData ? sData.length : 0);
            dashboardData.stats.totalTeachers = teacherCount ?? 0;
            dashboardData.stats.totalSections = sectionCount ?? 0;
            dashboardData.stats.totalSubjects = subjectCount ?? 0;
            dashboardData.stats.totalUsers = userCount ?? (uData ? uData.length : 0);

            // Populate live notifications from Supabase
            if (notifsData && notifsData.length > 0) {
                dashboardData.notifications = notifsData.map(n => ({
                    id: n.id,
                    type: n.type || 'message',
                    title: n.title || 'Notification',
                    message: n.message || '',
                    created_at: n.created_at || new Date().toISOString(),
                    is_read: n.read === true || n.is_read === true,
                    sender: n.sender || 'Hiraya Enrollment System',
                    actionType: n.action_type || n.type || 'System Advisory',
                    priority: n.priority || 'Normal'
                }));
            } else {
                dashboardData.notifications = [];
            }

            // Populate allUsers dynamically
            if (uData && uData.length > 0) {
                dashboardData.allUsers = uData.map(u => {
                    const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim() || (u.email ? u.email.split('@')[0] : 'User');
                    return {
                        fullname: fullName,
                        email: u.email || '—',
                        role: (u.role || 'user').charAt(0).toUpperCase() + (u.role || 'user').slice(1),
                        profile_picture: null,
                        status: 'active',
                        registered_date: u.created_at || new Date().toISOString(),
                        notification_count: (notifsData || []).filter(n => n.user_id === u.id).length,
                        last_activity: u.updated_at || u.created_at || new Date().toISOString()
                    };
                });
            }

            // Populate enrollments and monthly distribution for chart
            const enrolledMonthly = new Array(12).fill(0);
            const pendingMonthly = new Array(12).fill(0);

            if (enrData && enrData.length > 0) {
                dashboardData.stats.totalEnrollments = enrData.length;
                const approvedList = enrData.filter(e => (e.status || '').toLowerCase() === 'approved' || (e.status || '').toLowerCase() === 'enrolled');
                const pendingList = enrData.filter(e => (e.status || '').toLowerCase() === 'pending');

                dashboardData.stats.enrolledCount = approvedList.length;
                dashboardData.stats.pendingCount = pendingList.length;

                // Tally months for Chart.js
                enrData.forEach(e => {
                    const d = new Date(e.created_at || Date.now());
                    const m = d.getMonth();
                    if (m >= 0 && m < 12) {
                        const st = (e.status || '').toLowerCase();
                        if (st === 'approved' || st === 'enrolled') {
                            enrolledMonthly[m]++;
                        } else if (st === 'pending') {
                            pendingMonthly[m]++;
                        }
                    }
                });

                dashboardData.recentEnrollments = enrData.slice(0, 6).map(e => {
                    const matchedStudent = (sData || []).find(s => s.id === e.student_id || s.email === e.email);
                    const fullName = `${e.first_name || matchedStudent?.first_name || ''} ${e.last_name || matchedStudent?.last_name || ''}`.trim() || 'Student';
                    const gradeName = `${e.grade_level || 'Grade 11'} ${e.strand ? '• ' + e.strand : ''}`;
                    const rawSt = (e.status || '').toLowerCase();
                    const status = (rawSt === 'approved' || rawSt === 'enrolled') ? 'Enrolled' : (rawSt === 'rejected' ? 'Rejected' : 'Pending');

                    return {
                        fullname: fullName,
                        grade_name: gradeName,
                        status: status,
                        created_at: e.created_at || new Date().toISOString()
                    };
                });

                // Populate enrollment approvals
                dashboardData.enrollmentApprovals = approvedList.slice(0, 5).map(e => {
                    const matchedStudent = (sData || []).find(s => s.id === e.student_id || s.email === e.email);
                    const fullName = `${e.first_name || matchedStudent?.first_name || ''} ${e.last_name || matchedStudent?.last_name || ''}`.trim() || 'Student';
                    return {
                        fullname: fullName,
                        role: 'Student',
                        profile_picture: null,
                        title: 'Enrollment Approved',
                        message: `Student enrolled in ${e.grade_level || 'Senior High'} ${e.strand ? '• ' + e.strand : ''}`,
                        created_at: e.updated_at || e.created_at || new Date().toISOString()
                    };
                });
                dashboardData.stats.enrollmentActions = approvedList.length;
            }

            // Populate account approvals from users table
            if (uData && uData.length > 0) {
                const teachersAndStaff = uData.filter(u => u.role === 'teacher' || u.role === 'registrar');
                dashboardData.accountApprovals = teachersAndStaff.slice(0, 5).map(u => {
                    const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email;
                    const roleLabel = (u.role || 'Staff').charAt(0).toUpperCase() + (u.role || 'Staff').slice(1);
                    return {
                        fullname: fullName,
                        role: roleLabel,
                        profile_picture: null,
                        title: 'Account Active',
                        message: `${roleLabel} account is verified and active in the system`,
                        created_at: u.created_at || new Date().toISOString()
                    };
                });
                dashboardData.stats.accountApprovals = teachersAndStaff.length;

                // Populate admin actions summary
                const adminUsers = uData.filter(u => u.role === 'admin' || u.role === 'registrar');
                dashboardData.adminActions = adminUsers.slice(0, 5).map(a => {
                    const fullName = `${a.first_name || ''} ${a.last_name || ''}`.trim() || 'Administrator';
                    const roleLabel = (a.role || 'Admin').charAt(0).toUpperCase() + (a.role || 'Admin').slice(1);
                    return {
                        fullname: fullName,
                        role: roleLabel,
                        profile_picture: null,
                        title: 'System Activity',
                        message: `Verified and authenticated ${roleLabel} session on the portal`,
                        created_at: a.updated_at || a.created_at || new Date().toISOString()
                    };
                });
                dashboardData.stats.adminActions = adminUsers.length + (enrData?.length || 0);
            }

            // Populate recent activities from activity_logs or live enrollments/accounts
            if (actData && actData.length > 0) {
                dashboardData.recentActivities = actData.map(log => ({
                    type: log.action ? log.action.toLowerCase().includes('enroll') ? 'enrollment' : 'admin_action' : 'admin_action',
                    description: log.details || log.action || 'System event recorded',
                    date: log.timestamp || new Date().toISOString()
                }));
            } else {
                const events = [];
                (enrData || []).slice(0, 4).forEach(e => {
                    const name = `${e.first_name || ''} ${e.last_name || ''}`.trim() || 'Student';
                    events.push({
                        type: 'enrollment',
                        description: `Enrollment application (${e.status || 'Pending'}): ${name} (${e.grade_level || 'Grade 11'})`,
                        date: e.created_at || new Date().toISOString()
                    });
                });
                (uData || []).slice(0, 3).forEach(u => {
                    const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email;
                    events.push({
                        type: 'account_approval',
                        description: `Account registered: ${name} (${u.role || 'User'})`,
                        date: u.created_at || new Date().toISOString()
                    });
                });
                events.sort((a, b) => new Date(b.date) - new Date(a.date));
                dashboardData.recentActivities = events;
            }

            // Render all UI components with live data
            updateStats();
            renderNotifications();
            renderActivities();
            renderEnrollments();
            renderAdminActions();
            renderAccountApprovals();
            renderEnrollmentApprovals();
            renderProfileUpdates();
            renderUsers();
            initChart(enrolledMonthly, pendingMonthly);
        } catch (err) {
            console.warn('Dashboard live sync warning:', err);
        }
    }

    // ===== INIT =====
    updateStats();
    renderNotifications();
    renderActivities();
    renderEnrollments();
    renderAdminActions();
    renderAccountApprovals();
    renderEnrollmentApprovals();
    renderProfileUpdates();
    renderUsers();
    initChart();
    await syncLiveDashboardData();
});