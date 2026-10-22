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
    let currentViewingNotifId = null;

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
            if (unreadCount > 0) {
                notifCount.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
                notifCount.classList.remove('empty');
                notifCount.style.display = 'flex';
                if (notificationBtn) notificationBtn.classList.add('has-unread');
            } else {
                notifCount.textContent = '';
                notifCount.classList.add('empty');
                notifCount.style.display = 'none';
                if (notificationBtn) notificationBtn.classList.remove('has-unread');
            }
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
            new_enrollment: 'fa-file-signature',
            account: 'fa-user-plus'
        };

        let html = '';
        displayNotifs.forEach(notif => {
            const icon = icons[notif.type] || 'fa-bell';
            const timeAgo = getRelativeTimeString(notif.created_at);
            
            const isClosed = Boolean(notif.is_read);
            const enrollmentLink = (notif.enrollment_id || notif.enrollmentId) ? `view_enrollment.html?id=${notif.enrollment_id || notif.enrollmentId}` : null;
            html += `
                <div class="notif-item ${isClosed ? 'read closed' : 'unread'}" data-id="${notif.id}">
                    <div class="notif-icon notif-${notif.type || 'message'}">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="notif-content">
                        <div class="notif-title">
                            <span>${notif.title}</span>
                            <span class="notif-time">${timeAgo}</span>
                        </div>
                        <div class="notif-message">${notif.message || ''}</div>
                        <div class="notif-meta-status" style="margin-top: 6px; display: flex; align-items: center; gap: 8px;">
                            <span class="notif-status-pill" style="font-size: 10.5px; font-weight: 700; padding: 2px 8px; border-radius: 10px; background: ${isClosed ? '#dcfce7' : '#fee2e2'}; color: ${isClosed ? '#15803d' : '#b91c1c'}; display: inline-flex; align-items: center; gap: 4px;">
                                <i class="fas ${isClosed ? 'fa-check-circle' : 'fa-bell'}"></i> ${isClosed ? 'Closed' : 'Unread'}
                            </span>
                            ${enrollmentLink ? `
                                <a href="${enrollmentLink}" class="notif-view-student-link" style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; color: #1B2A4A; background: #e0e7ff; padding: 2px 8px; border-radius: 6px; text-decoration: none;">
                                    <i class="fas fa-eye"></i> View Student
                                </a>
                            ` : ''}
                        </div>
                    </div>
                    <div class="notif-item-actions">
                        ${!isClosed ? `
                            <button type="button" class="mark-read-btn" data-id="${notif.id}" title="Mark as closed">
                                <i class="fas fa-check"></i>
                            </button>
                        ` : `
                            <button type="button" class="mark-unread-btn" data-id="${notif.id}" title="Return to unread" style="background: none; border: 1px solid #cbd5e1; border-radius: 6px; padding: 3px 6px; color: #64748b; cursor: pointer; font-size: 11px;">
                                <i class="fas fa-arrow-rotate-left"></i>
                            </button>
                        `}
                    </div>
                </div>
            `;
        });

        notificationList.innerHTML = html;

        // Click on entire notification item to OPEN DETAIL MODAL
        notificationList.querySelectorAll('.notif-item').forEach(item => {
            item.addEventListener('click', function(e) {
                if (e.target.closest('.mark-read-btn') || e.target.closest('.mark-unread-btn')) return;
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

        // Click on return to unread button
        notificationList.querySelectorAll('.mark-unread-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = this.dataset.id;
                markNotificationUnread(id);
            });
        });
    }

    // Open Notification Detail Modal
    async function openNotificationDetailModal(id) {
        const notif = dashboardData.notifications.find(n => String(n.id) === String(id));
        if (!notif) return;

        currentViewingNotifId = id;

        // Mark as read/closed in state and database
        if (!notif.is_read) {
            notif.is_read = true;
            try {
                await supabase.from('notifications').update({ read: true, is_read: true }).eq('id', notif.id);
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
            modalNotifStatusBadge.innerHTML = '<i class="fas fa-check-circle"></i> Closed';
            modalNotifStatusBadge.className = 'notif-read-status closed';
        }

        if (modalNotifMessage) modalNotifMessage.textContent = notif.message || 'No description provided.';
        
        const rawSender = (notif.sender || '').trim();
        const displaySender = (!rawSender || rawSender === 'Hiraya Enrollment System')
            ? 'Placido L. Señor National High School'
            : rawSender;
        if (modalNotifSender) modalNotifSender.textContent = displaySender;

        if (modalNotifActionType) modalNotifActionType.textContent = notif.actionType || notif.type || 'System Notification';
        if (modalNotifPriority) modalNotifPriority.textContent = notif.priority || 'Normal';
        if (modalNotifSystemId) modalNotifSystemId.textContent = `NOTIF-${String(notif.id).substring(0, 8)}`;

        // Link
        if (modalNotifActionLink) {
            let url = notif.actionUrl;
            let label = notif.actionLabel;
            if (!url) {
                if (notif.type === 'enrollment' || notif.type === 'new_enrollment') {
                    url = (notif.enrollment_id || notif.enrollmentId) ? `view_enrollment.html?id=${notif.enrollment_id || notif.enrollmentId}` : 'enrollments.html';
                    label = (notif.enrollment_id || notif.enrollmentId) ? 'View Full Student Information' : 'Go to Enrollments';
                }
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
            notificationDetailModal.style.display = 'flex';
            notificationDetailModal.classList.add('active');

            const modalToggleUnreadBtn = document.getElementById('modalToggleUnreadBtn');
            if (modalToggleUnreadBtn) {
                modalToggleUnreadBtn.innerHTML = '<i class="fas fa-envelope"></i> <span>Mark as Unread</span>';
                modalToggleUnreadBtn.onclick = async () => {
                    const wasClosed = Boolean(notif.is_read || notif.read);
                    if (wasClosed) {
                        await markNotificationUnread(notif.id);
                        if (modalNotifStatusBadge) {
                            modalNotifStatusBadge.innerHTML = '<i class="fas fa-bell"></i> Unread';
                            modalNotifStatusBadge.className = 'notif-read-status';
                        }
                        modalToggleUnreadBtn.innerHTML = '<i class="fas fa-check"></i> <span>Mark as Closed</span>';
                    } else {
                        await markNotificationRead(notif.id);
                        if (modalNotifStatusBadge) {
                            modalNotifStatusBadge.innerHTML = '<i class="fas fa-check-circle"></i> Closed';
                            modalNotifStatusBadge.className = 'notif-read-status closed';
                        }
                        modalToggleUnreadBtn.innerHTML = '<i class="fas fa-envelope"></i> <span>Mark as Unread</span>';
                    }
                };
            }
        }
    }

    // Mark single notification as read/closed
    async function markNotificationRead(id) {
        const notif = dashboardData.notifications.find(n => String(n.id) === String(id));
        if (notif) {
            notif.is_read = true;
            notif.read = true;
            renderNotifications();
            try {
                await supabase.from('notifications').update({ read: true, is_read: true }).eq('id', notif.id);
            } catch (e) {
                console.warn('Error marking notification read in DB:', e);
            }
        }
    }

    // Mark single notification as unread
    async function markNotificationUnread(id) {
        const notif = dashboardData.notifications.find(n => String(n.id) === String(id));
        if (notif) {
            notif.is_read = false;
            notif.read = false;
            renderNotifications();
            try {
                await supabase.from('notifications').update({ read: false, is_read: false }).eq('id', notif.id);
            } catch (e) {
                console.warn('Error marking notification unread in DB:', e);
            }
        }
    }

    // Mark all notifications as read
    async function markAllRead() {
        dashboardData.notifications.forEach(n => n.is_read = true);
        renderNotifications();
        try {
            await supabase.from('notifications').update({ read: true, is_read: true }).or('role.eq.admin,role.is.null').or('read.eq.false,is_read.eq.false');
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
            notificationDetailModal.classList.remove('active', 'show');
            notificationDetailModal.style.display = 'none';
        }
        if (currentViewingNotifId) {
            markNotificationRead(currentViewingNotifId);
            currentViewingNotifId = null;
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

    // Helper to calculate relative time
    function getRelativeTimeStr(dateStr) {
        if (!dateStr) return 'Just now';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return 'Recently';
        const diffMs = Date.now() - d.getTime();
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffSecs < 60) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    // Parse unstructured activity text into structured data
    function parseActivityItem(activity) {
        const text = activity.description || '';
        const rawAction = activity.action || activity.type || '';
        let actor = activity.actor || '';
        let actionLabel = 'Activity';
        let actionType = 'system';
        let status = '';
        let lateInfo = '';
        let validation = '';
        let schedule = '';
        let summary = text;

        const lower = text.toLowerCase();

        // 1. Extract Actor
        if (!actor) {
            if (text.includes(' recorded ')) {
                actor = text.split(' recorded ')[0].trim();
            } else if (text.includes(' validated ')) {
                actor = text.split(' validated ')[0].trim();
            } else if (text.startsWith('Account registered: ')) {
                actor = text.replace('Account registered: ', '').split('(')[0].trim();
            } else if (text.startsWith('Enrollment application')) {
                const parts = text.split(':');
                actor = parts[1] ? parts[1].split('(')[0].trim() : 'Student';
            } else {
                actor = 'System User';
            }
        }

        // 2. Classify action type & label
        if (lower.includes('time in') || lower.includes('time-in')) {
            actionLabel = 'Time In';
            actionType = 'time_in';
        } else if (lower.includes('time out') || lower.includes('time-out')) {
            actionLabel = 'Time Out';
            actionType = 'time_out';
        } else if (lower.includes('enroll')) {
            actionLabel = 'Admissions';
            actionType = 'enrollment';
        } else if (lower.includes('account') || lower.includes('user') || lower.includes('register')) {
            actionLabel = 'Account';
            actionType = 'account';
        } else if (lower.includes('security') || lower.includes('password') || lower.includes('auth')) {
            actionLabel = 'Security';
            actionType = 'security';
        } else {
            actionLabel = rawAction ? rawAction.replace(/_/g, ' ') : 'System Log';
            actionType = 'system';
        }

        // 3. Extract time recorded
        let timeRecorded = "";
        const timeMatch = text.match(/(?:recorded\s+(?:Time\s+In|Time\s+Out)\s+at\s+)(\d{1,2}:\d{2}\s*[AP]M)/i);
        if (timeMatch) {
            timeRecorded = timeMatch[1].trim();
        } else {
            const timeAtMatch = text.match(/(?:at\s+)(\d{1,2}:\d{2}\s*[AP]M)/i);
            if (timeAtMatch) {
                timeRecorded = timeAtMatch[1].trim();
            } else {
                const genericTime = text.match(/(\d{1,2}:\d{2}\s*[AP]M)/i);
                if (genericTime) timeRecorded = genericTime[1].trim();
            }
        }

        // 4. Status determination (attendance is purely Time In or Time Out, no late penalties)
        if (actionType === "time_in") {
            status = "Time In";
        } else if (actionType === "time_out") {
            status = "Time Out";
        } else if (lower.includes("completed")) {
            status = "Completed";
        } else if (lower.includes("approved")) {
            status = "Approved";
        } else if (lower.includes("pending")) {
            status = "Pending";
        } else {
            const statusMatch = text.match(/Status:\s*([A-Za-z]+)/i);
            if (statusMatch) status = statusMatch[1];
        }

        // 5. Craft clean summary
        if (actionType === "time_in") {
            summary = timeRecorded ? `Recorded Time In at ${timeRecorded}` : "Recorded Time In";
        } else if (actionType === "time_out") {
            summary = timeRecorded ? `Recorded Time Out at ${timeRecorded}` : "Recorded Time Out";
        } else {
            summary = text;
        }

        return { actor, actionLabel, actionType, status, timeRecorded, summary };
    }

    // Render recent activities
    function renderActivities() {
        const list = document.getElementById('activityList');
        if (!list) return;
        const activities = (dashboardData.recentActivities || []).slice(0, 5);

        const countBadge = document.getElementById('recentActivitiesCount');
        if (countBadge) {
            countBadge.textContent = `${activities.length} Recorded`;
        }

        if (activities.length === 0) {
            list.innerHTML = `
                <li class="activity-empty-state">
                    <div class="empty-icon-circle"><i class="fas fa-clock-rotate-left"></i></div>
                    <h4>No Recent Activities</h4>
                    <p>Live events, attendance, and audit logs will appear here in real-time.</p>
                </li>
            `;
            return;
        }

        const typeConfig = {
            time_in: {
                icon: 'fa-arrow-right-to-bracket',
                gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
            },
            time_out: {
                icon: 'fa-arrow-right-from-bracket',
                gradient: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)'
            },
            enrollment: {
                icon: 'fa-file-signature',
                gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
            },
            account: {
                icon: 'fa-user-check',
                gradient: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
            },
            security: {
                icon: 'fa-shield-halved',
                gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
            },
            system: {
                icon: 'fa-clock-rotate-left',
                gradient: 'linear-gradient(135deg, #0b2b4a 0%, #1e3a5f 100%)'
            }
        };

        let html = '';
        activities.forEach(activity => {
            const parsed = parseActivityItem(activity);
            const cfg = typeConfig[parsed.actionType] || typeConfig.system;
            const dObj = new Date(activity.date);
            const dateStr = dObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

            // Determine badge and pulse dot
            let statusLabel = 'Logged';
            let badgeClass = 'status-pill-system';
            let pulseClass = 'pulse-blue';

            if (parsed.actionType === "time_in") {
                statusLabel = "Time In";
                badgeClass = "status-pill-timein";
                pulseClass = "pulse-green";
            } else if (parsed.actionType === "time_out") {
                statusLabel = "Time Out";
                badgeClass = "status-pill-timeout";
                pulseClass = "pulse-blue";
            } else if (parsed.status && (parsed.status.toLowerCase() === 'completed' || parsed.status.toLowerCase() === 'approved')) {
                statusLabel = parsed.status;
                badgeClass = 'status-pill-enrolled';
                pulseClass = 'pulse-green';
            } else if (parsed.status && parsed.status.toLowerCase() === 'pending') {
                statusLabel = 'Pending';
                badgeClass = 'status-pill-pending';
                pulseClass = 'pulse-amber';
            } else if (parsed.actionLabel) {
                statusLabel = parsed.actionLabel;
                badgeClass = 'status-pill-system';
                pulseClass = 'pulse-blue';
            }

            // Determine sub-row chip (Icon + concise detail)
            let subIcon = 'fa-circle-info';
            let subText = 'Activity record';
            if (parsed.actionType === 'time_in' || parsed.actionType === 'time_out') {
                subIcon = 'fa-chalkboard-user';
                subIcon = 'fa-clock';
                subText = parsed.timeRecorded || dObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            } else if (parsed.actionType === 'enrollment') {
                subIcon = 'fa-file-signature';
                subText = 'Admissions';
            } else if (parsed.actionType === 'account') {
                subIcon = 'fa-user-check';
                subText = 'Account update';
            } else if (parsed.actionType === 'security') {
                subIcon = 'fa-shield-halved';
                subText = 'Security audit';
            } else {
                subIcon = 'fa-clock-rotate-left';
                subText = parsed.summary ? (parsed.summary.length > 28 ? parsed.summary.substring(0, 26) + '...' : parsed.summary) : 'System Log';
            }

            html += `
                <li class="enrollment-card-row activity-card-row" onclick="window.location.href='activities.html'" style="cursor: pointer;">
                    <div class="enrollment-avatar-wrap">
                        <div class="enrollment-avatar-gradient" style="background: ${cfg.gradient}; font-size: 16px;">
                            <i class="fas ${cfg.icon}"></i>
                        </div>
                    </div>
                    <div class="enrollment-main-col">
                        <div class="enrollment-title-row">
                            <h4 class="enrollment-student-name" title="${parsed.actor}">${parsed.actor}</h4>
                            <span class="status-pill ${badgeClass}">
                                <span class="status-dot ${pulseClass}"></span>
                                ${statusLabel}
                            </span>
                        </div>
                        <div class="enrollment-sub-row">
                            <span class="enrollment-grade-chip" title="${subText}">
                                <i class="fas ${subIcon}"></i> ${subText}
                            </span>
                            <span class="enrollment-date-chip" title="${dObj.toLocaleString()}">
                                <i class="far fa-calendar-alt"></i> ${dateStr}
                            </span>
                        </div>
                    </div>
                    <div class="enrollment-arrow-col">
                        <div class="enrollment-action-btn" title="View Details">
                            <i class="fas fa-chevron-right"></i>
                        </div>
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
        const enrollments = dashboardData.recentEnrollments || [];

        const countBadge = document.getElementById('recentEnrollmentsCount');
        if (countBadge) countBadge.textContent = `${enrollments.length} Recent`;

        if (enrollments.length === 0) {
            list.innerHTML = `
                <li class="enrollment-empty-state">
                    <div class="empty-icon-wrap">
                        <i class="fas fa-user-graduate"></i>
                    </div>
                    <h4>No Recent Enrollments</h4>
                    <p>New student applications will appear here in real-time.</p>
                </li>
            `;
            return;
        }

        // Curated harmonious gradients for dynamic avatar generation
        const gradientPalette = [
            'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', // Indigo-Violet
            'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)', // Sky-Blue
            'linear-gradient(135deg, #059669 0%, #10b981 100%)', // Emerald
            'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)', // Amber
            'linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)', // Rose
            'linear-gradient(135deg, #7c3aed 0%, #c026d3 100%)', // Purple-Fuchsia
            'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)'  // Teal
        ];

        let html = '';
        enrollments.forEach((enrollment, index) => {
            const initial = (enrollment.fullname || 'S').charAt(0).toUpperCase();
            const bgGradient = gradientPalette[index % gradientPalette.length];
            const dateObj = new Date(enrollment.created_at || Date.now());
            const dateStr = dateObj.toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric'
            });
            const statusLower = (enrollment.status || 'enrolled').toLowerCase();
            const isEnrolled = statusLower === 'enrolled' || statusLower === 'approved';
            const isPending = statusLower === 'pending';
            const pulseClass = isEnrolled ? 'pulse-green' : (isPending ? 'pulse-amber' : 'pulse-red');
            const badgeClass = isEnrolled ? 'status-pill-enrolled' : (isPending ? 'status-pill-pending' : 'status-pill-rejected');
            const statusLabel = isEnrolled ? 'Enrolled' : (isPending ? 'Pending' : enrollment.status);

            html += `
                <li class="enrollment-card-row" data-name="${encodeURIComponent(enrollment.fullname || '')}">
                    <div class="enrollment-avatar-wrap">
                        <div class="enrollment-avatar-gradient" style="background: ${bgGradient};">
                            ${initial}
                        </div>
                    </div>
                    <div class="enrollment-main-col">
                        <div class="enrollment-title-row">
                            <h4 class="enrollment-student-name">${enrollment.fullname}</h4>
                            <span class="status-pill ${badgeClass}">
                                <span class="status-dot ${pulseClass}"></span>
                                ${statusLabel}
                            </span>
                        </div>
                        <div class="enrollment-sub-row">
                            <span class="enrollment-grade-chip">
                                <i class="fas fa-graduation-cap"></i> ${enrollment.grade_name || 'Junior/Senior High'}
                            </span>
                            <span class="enrollment-date-chip">
                                <i class="far fa-calendar-alt"></i> ${dateStr}
                            </span>
                        </div>
                    </div>
                    <div class="enrollment-arrow-col">
                        <div class="enrollment-action-btn" title="View Student in Enrollments">
                            <i class="fas fa-chevron-right"></i>
                        </div>
                    </div>
                </li>
            `;
        });

        list.innerHTML = html;

        // Interactive row click handler
        list.querySelectorAll('.enrollment-card-row').forEach(row => {
            row.style.cursor = 'pointer';
            row.addEventListener('click', function() {
                const sName = this.dataset.name;
                window.location.href = sName ? `enrollments.html?search=${sName}` : 'enrollments.html';
            });
        });
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

    // ===== ALL USERS ACTIVITY (BY ROLE) =====
    let activeUsersRole = 'all';
    let usersSearchQuery = '';
    let usersListenersAttached = false;

    const roleDefinitions = {
        student: {
            title: 'Students',
            singular: 'Student',
            icon: 'fa-user-graduate',
            colorClass: 'role-student',
            accentColor: '#2563eb',
            gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
        },
        teacher: {
            title: 'Teachers',
            singular: 'Teacher',
            icon: 'fa-chalkboard-user',
            colorClass: 'role-teacher',
            accentColor: '#059669',
            gradient: 'linear-gradient(135deg, #10b981 0%, #047857 100%)'
        },
        guidance: {
            title: 'Guidance Counselors',
            singular: 'Guidance',
            icon: 'fa-compass',
            colorClass: 'role-guidance',
            accentColor: '#7c3aed',
            gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)'
        },
        admin: {
            title: 'Administrators',
            singular: 'Admin',
            icon: 'fa-shield-alt',
            colorClass: 'role-admin',
            accentColor: '#dc2626',
            gradient: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)'
        },
        registrar: {
            title: 'Registrars',
            singular: 'Registrar',
            icon: 'fa-file-invoice',
            colorClass: 'role-registrar',
            accentColor: '#d97706',
            gradient: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)'
        },
        parent: {
            title: 'Parents & Guardians',
            singular: 'Parent',
            icon: 'fa-hands-holding-child',
            colorClass: 'role-parent',
            accentColor: '#ea580c',
            gradient: 'linear-gradient(135deg, #f97316 0%, #c2410c 100%)'
        }
    };

    const roleOrder = ['student', 'teacher', 'guidance', 'admin', 'registrar', 'parent'];

    function setupUsersRoleListeners() {
        if (usersListenersAttached) return;
        usersListenersAttached = true;

        const rolePills = document.querySelectorAll('.role-pill');
        rolePills.forEach(pill => {
            pill.addEventListener('click', function() {
                rolePills.forEach(p => p.classList.remove('active'));
                this.classList.add('active');
                activeUsersRole = this.dataset.role || 'all';
                renderUsers();
            });
        });

        const searchInput = document.getElementById('usersSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', function(e) {
                usersSearchQuery = e.target.value;
                renderUsers();
            });
        }
    }

    function updateRolePillCounts() {
        const users = dashboardData.allUsers || [];
        const setPill = (id, count) => {
            const el = document.getElementById(id);
            if (el) el.textContent = count;
        };

        setPill('countAllRoles', users.length);
        setPill('countStudents', users.filter(u => (u.role || '').toLowerCase() === 'student').length);
        setPill('countTeachers', users.filter(u => (u.role || '').toLowerCase() === 'teacher').length);
        setPill('countGuidance', users.filter(u => (u.role || '').toLowerCase() === 'guidance').length);
        setPill('countAdmins', users.filter(u => (u.role || '').toLowerCase() === 'admin').length);
        setPill('countRegistrar', users.filter(u => (u.role || '').toLowerCase() === 'registrar').length);
        setPill('countParents', users.filter(u => (u.role || '').toLowerCase() === 'parent').length);
    }

    // Render users organized by role
    function renderUsers() {
        setupUsersRoleListeners();
        updateRolePillCounts();

        const container = document.getElementById('usersContainer');
        const countBadge = document.getElementById('usersCount');
        if (!container) return;

        const allUsers = dashboardData.allUsers || [];
        if (allUsers.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 36px 20px; color: #64748b;">
                    <i class="fas fa-users-slash" style="font-size: 36px; color: #cbd5e1; margin-bottom: 10px;"></i>
                    <p style="font-weight: 500;">No user accounts found in database</p>
                </div>
            `;
            if (countBadge) countBadge.textContent = '0 users';
            return;
        }

        // Filter users
        const q = (usersSearchQuery || '').trim().toLowerCase();
        const filteredUsers = allUsers.filter(u => {
            const roleKey = (u.role || '').toLowerCase();
            const matchesRole = activeUsersRole === 'all' || roleKey === activeUsersRole;
            if (!matchesRole) return false;

            if (q) {
                const name = (u.fullname || '').toLowerCase();
                const email = (u.email || '').toLowerCase();
                const role = (u.role || '').toLowerCase();
                return name.includes(q) || email.includes(q) || role.includes(q);
            }
            return true;
        });

        // Update count badge
        if (countBadge) {
            if (activeUsersRole === 'all') {
                countBadge.textContent = q ? `${filteredUsers.length} of ${allUsers.length} users` : `${allUsers.length} users`;
            } else {
                const cfg = roleDefinitions[activeUsersRole];
                const label = cfg ? cfg.title : activeUsersRole;
                countBadge.textContent = `${filteredUsers.length} ${label}`;
            }
        }

        if (filteredUsers.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 36px 20px; color: #64748b;">
                    <i class="fas fa-search" style="font-size: 32px; color: #cbd5e1; margin-bottom: 10px;"></i>
                    <p style="font-weight: 500;">No users found matching "${usersSearchQuery || activeUsersRole}"</p>
                </div>
            `;
            return;
        }

        const renderUserRow = (user) => {
            const roleKey = (user.role || '').toLowerCase();
            const cfg = roleDefinitions[roleKey] || {
                colorClass: `role-${roleKey}`,
                gradient: 'linear-gradient(135deg, #1B2A4A, #334155)',
                accentColor: '#1B2A4A'
            };
            const initial = (user.fullname || 'U').charAt(0).toUpperCase();
            const registeredDate = user.registered_date ? new Date(user.registered_date).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric'
            }) : '—';
            const lastActivity = user.last_activity ? new Date(user.last_activity).toLocaleString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
            }) : '—';
            const notifCount = user.notification_count || 0;

            return `
                <tr>
                    <td>
                        <div class="user-info">
                            <div class="user-avatar" style="background: ${cfg.gradient}; color: #fff; font-weight: 700;">${initial}</div>
                            <div class="user-details">
                                <strong>${user.fullname}</strong>
                                <small>${user.email}</small>
                            </div>
                        </div>
                    </td>
                    <td><span class="role-badge ${cfg.colorClass || ('role-' + roleKey)}">${user.role}</span></td>
                    <td><span class="status-badge status-${user.status || 'active'}">${user.status || 'active'}</span></td>
                    <td>${registeredDate}</td>
                    <td><span class="notif-count-badge">${notifCount} ${notifCount === 1 ? 'notification' : 'notifications'}</span></td>
                    <td>${lastActivity}</td>
                </tr>
            `;
        };

        // Specific Role Selected
        if (activeUsersRole !== 'all') {
            const cfg = roleDefinitions[activeUsersRole] || {
                title: activeUsersRole.charAt(0).toUpperCase() + activeUsersRole.slice(1),
                icon: 'fa-user',
                gradient: 'linear-gradient(135deg, #1B2A4A, #334155)',
                accentColor: '#1B2A4A'
            };

            container.innerHTML = `
                <div class="role-group-section">
                    <div class="role-group-header">
                        <div class="role-group-title-wrap">
                            <div class="role-group-icon" style="background: ${cfg.gradient};">
                                <i class="fas ${cfg.icon}"></i>
                            </div>
                            <h4 class="role-group-name">${cfg.title}</h4>
                            <span class="role-group-count">${filteredUsers.length} ${filteredUsers.length === 1 ? 'user' : 'users'}</span>
                        </div>
                    </div>
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>User</th>
                                    <th>Role</th>
                                    <th>Status</th>
                                    <th>Registered</th>
                                    <th>Notifications</th>
                                    <th>Last Activity</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filteredUsers.map(renderUserRow).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            return;
        }

        // VIEWING ALL ROLES: Grouped by Role
        const groupedMap = new Map();
        roleOrder.forEach(r => groupedMap.set(r, []));

        filteredUsers.forEach(u => {
            const r = (u.role || 'other').toLowerCase();
            if (!groupedMap.has(r)) {
                groupedMap.set(r, []);
            }
            groupedMap.get(r).push(u);
        });

        let html = '';
        for (const [roleKey, groupUsers] of groupedMap.entries()) {
            if (groupUsers.length === 0) continue;

            const cfg = roleDefinitions[roleKey] || {
                title: roleKey.charAt(0).toUpperCase() + roleKey.slice(1) + 's',
                icon: 'fa-users',
                gradient: 'linear-gradient(135deg, #1B2A4A, #334155)',
                accentColor: '#1B2A4A'
            };

            html += `
                <div class="role-group-section">
                    <div class="role-group-header">
                        <div class="role-group-title-wrap">
                            <div class="role-group-icon" style="background: ${cfg.gradient};">
                                <i class="fas ${cfg.icon}"></i>
                            </div>
                            <h4 class="role-group-name">${cfg.title}</h4>
                            <span class="role-group-count">${groupUsers.length} ${groupUsers.length === 1 ? 'user' : 'users'}</span>
                        </div>
                        <button type="button" class="btn-focus-role" data-target-role="${roleKey}" style="background: none; border: none; font-size: 12px; color: ${cfg.accentColor}; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                            <span>Filter Only ${cfg.title}</span> <i class="fas fa-arrow-right"></i>
                        </button>
                    </div>
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>User</th>
                                    <th>Role</th>
                                    <th>Status</th>
                                    <th>Registered</th>
                                    <th>Notifications</th>
                                    <th>Last Activity</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${groupUsers.map(renderUserRow).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;

        // Attach "Filter Only [Role]" click handlers
        container.querySelectorAll('.btn-focus-role').forEach(btn => {
            btn.addEventListener('click', function() {
                const target = this.dataset.targetRole;
                if (target) {
                    activeUsersRole = target;
                    document.querySelectorAll('.role-pill').forEach(p => {
                        p.classList.toggle('active', p.dataset.role === target);
                    });
                    renderUsers();
                }
            });
        });
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
                supabase.from('notifications').select('*').or('role.eq.admin,role.is.null').order('created_at', { ascending: false }).limit(30)
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
                    sender: (!n.sender || n.sender === 'Hiraya Enrollment System') ? 'Placido L. Señor National High School' : n.sender,
                    actionType: n.action_type || n.type || 'System Advisory',
                    priority: n.priority || 'Normal',
                    enrollment_id: n.enrollment_id,
                    enrollmentId: n.enrollment_id
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
                    type: log.action ? (log.action.toLowerCase().includes('enroll') ? 'enrollment' : (log.action.toLowerCase().includes('time') ? 'attendance' : 'admin_action')) : 'admin_action',
                    action: log.action || '',
                    actor: log.user_name || log.fullname || '',
                    description: log.details || log.action || 'System event recorded',
                    date: log.timestamp || log.created_at || new Date().toISOString()
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
            renderUsers();
            initChart(enrolledMonthly, pendingMonthly);
        } catch (err) {
            console.warn('Dashboard live sync warning:', err);
        }
    }



    // ===== CHIME & TOAST ALERTS =====
    function playNotificationChime() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, ctx.currentTime);
            osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.12);
            
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.5);
        } catch(e) {}
    }

    function showNotificationToast(notif) {
        let container = document.getElementById('alertContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'alertContainer';
            container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 99999; display: flex; flex-direction: column; gap: 10px; max-width: 420px;';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = 'notif-toast-banner';
        toast.style.cssText = 'background: #ffffff; border-radius: 12px; padding: 14px 16px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1); border-left: 5px solid #1B2A4A; cursor: pointer; transition: all 0.3s ease; display: flex; align-items: center; justify-content: space-between; gap: 12px;';
        
        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
                <div style="width: 38px; height: 38px; border-radius: 50%; background: #e0e7ff; color: #4338ca; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0;">
                    <i class="fas fa-graduation-cap"></i>
                </div>
                <div style="min-width: 0;">
                    <strong style="display: block; font-size: 13.5px; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${notif.title || 'New Enrollment Notification'}</strong>
                    <span style="font-size: 12px; color: #475569; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${notif.message || ''}</span>
                </div>
            </div>
            <button type="button" style="background: #1B2A4A; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; flex-shrink: 0;">
                View
            </button>
        `;

        toast.addEventListener('click', () => {
            if (notif.enrollment_id || notif.enrollmentId) {
                window.location.href = `view_enrollment.html?id=${notif.enrollment_id || notif.enrollmentId}`;
            } else {
                window.location.href = 'enrollments.html';
            }
        });

        container.prepend(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px)';
            setTimeout(() => toast.remove(), 300);
        }, 7000);
    }

    // ===== REALTIME & CROSS-TAB NOTIFICATIONS =====
    function setupRealtimeNotifications() {
        try {
            supabase
                .channel('admin_notifications_realtime')
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications'
                }, (payload) => {
                    if (!payload || !payload.new) return;
                    const newNotif = payload.new;
                    if (!newNotif.role || newNotif.role === 'admin' || newNotif.role === 'all') {
                        syncLiveDashboardData();
                        showNotificationToast(newNotif);
                        playNotificationChime();
                    }
                })
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'enrollments'
                }, () => {
                    syncLiveDashboardData();
                })
                .subscribe();
        } catch (err) {
            console.warn('Admin realtime subscription error:', err);
        }

        // Cross-tab immediate sync
        window.addEventListener('storage', (e) => {
            if ((e.key === 'hes_latest_notification' || e.key === 'hes_admin_latest_notification' || e.key === 'hes_enrollment_updated') && e.newValue) {
                try {
                    syncLiveDashboardData();
                    if (e.key !== 'hes_enrollment_updated') {
                        const data = JSON.parse(e.newValue);
                        if (!data.role || data.role === 'admin' || data.role === 'all' || (data.roles && data.roles.includes('admin'))) {
                            showNotificationToast(data);
                            playNotificationChime();
                        }
                    }
                } catch(err) {}
            }
        });
    }

    // ===== INIT =====
    updateStats();
    renderNotifications();
    renderActivities();
    renderEnrollments();
    renderAdminActions();
    renderAccountApprovals();
    renderEnrollmentApprovals();
    renderUsers();
    initChart();
    await syncLiveDashboardData();
    setupRealtimeNotifications();
});