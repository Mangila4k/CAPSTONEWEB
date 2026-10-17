// ===== ACCOUNTS JAVASCRIPT (SUPABASE POWERED) =====
import { supabase } from '../../supabase/config.js';

document.addEventListener('DOMContentLoaded', async function() {
    // DOM Elements
    const alertContainer = document.getElementById('alertContainer');
    const filterForm = document.getElementById('filterForm');
    const searchInput = document.getElementById('searchInput');
    const roleFilter = document.getElementById('roleFilter');
    const statusFilter = document.getElementById('statusFilter');
    const usersTableBody = document.getElementById('usersTableBody');
    const pendingTableBody = document.getElementById('pendingTableBody');

    // Modal Elements
    const rejectModal = document.getElementById('rejectModal');
    const rejectForm = document.getElementById('rejectForm');
    const rejectUserId = document.getElementById('rejectUserId');
    const rejectUserName = document.getElementById('rejectUserName');
    const rejectionReason = document.getElementById('rejectionReason');

    // State
    let users = [];
    let currentUserSession = null;

    try {
        const stored = localStorage.getItem('currentUser');
        if (stored) currentUserSession = JSON.parse(stored);
    } catch(e) {}

    // Alert helper
    function showAlert(message, type = 'error') {
        if (!alertContainer) return;
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        const icon = type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle';
        alertDiv.innerHTML = `<i class="fas ${icon}"></i> <div>${message}</div>`;
        alertContainer.appendChild(alertDiv);

        setTimeout(() => {
            alertDiv.style.opacity = '0';
            setTimeout(() => {
                alertDiv.remove();
            }, 300);
        }, 5000);
    }

    function formatDate(dateString) {
        if (!dateString) return '—';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function getRoleColor(role) {
        switch((role || '').toLowerCase()) {
            case 'admin': return '#dc3545';
            case 'registrar': return '#fd7e14';
            case 'guidance': return '#1D4ED8';
            case 'teacher': return '#28a745';
            case 'student': return '#007bff';
            case 'parent': return '#8b5cf6';
            default: return '#6c757d';
        }
    }

    // ===== DATA FETCHING =====
    async function loadAccounts() {
        try {
            if (usersTableBody) {
                usersTableBody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 40px;">
                            <i class="fas fa-spinner fa-spin" style="font-size: 28px; color: #1B2A4A;"></i>
                            <p style="margin-top: 10px; color: #64748b;">Loading accounts from database...</p>
                        </td>
                    </tr>
                `;
            }

            // 1. Fetch all users from Supabase
            const { data: usersData, error: usersErr } = await supabase
                .from('users')
                .select('*')
                .order('created_at', { ascending: false });

            if (usersErr) throw usersErr;

            // 2. Fetch teachers & students to map ID numbers
            const [teachersRes, studentsRes] = await Promise.all([
                supabase.from('teachers').select('id, user_id, employee_id'),
                supabase.from('students').select('id, lrn, email')
            ]);

            const teacherMap = new Map();
            (teachersRes.data || []).forEach(t => {
                if (t.user_id) teacherMap.set(t.user_id, t.employee_id);
            });

            const studentMap = new Map();
            (studentsRes.data || []).forEach(s => {
                if (s.email) studentMap.set(s.email.toLowerCase(), s.lrn);
            });

            // Map and enrich users
            users = (usersData || []).map(u => {
                const fullName = (u.first_name || u.last_name) 
                    ? `${u.first_name || ''} ${u.last_name || ''}`.trim() 
                    : (u.email ? u.email.split('@')[0] : 'User');

                let idNumber = null;
                const roleLower = (u.role || '').toLowerCase();
                if (roleLower === 'teacher') {
                    idNumber = teacherMap.get(u.id) || `HES-TCH-${u.id.substring(0, 5).toUpperCase()}`;
                } else if (roleLower === 'student') {
                    idNumber = (u.email ? studentMap.get(u.email.toLowerCase()) : null) || `HES-STU-${u.id.substring(0, 5).toUpperCase()}`;
                } else if (roleLower === 'admin') {
                    idNumber = `HES-ADM-${u.id.substring(0, 5).toUpperCase()}`;
                } else if (roleLower === 'registrar') {
                    idNumber = `HES-RGR-${u.id.substring(0, 5).toUpperCase()}`;
                } else if (roleLower === 'guidance') {
                    idNumber = `HES-GDC-${u.id.substring(0, 5).toUpperCase()}`;
                } else if (roleLower === 'parent') {
                    idNumber = `HES-PAR-${u.id.substring(0, 5).toUpperCase()}`;
                } else if (roleLower === 'principal') {
                    idNumber = `HES-PRN-${u.id.substring(0, 5).toUpperCase()}`;
                } else {
                    idNumber = `HES-${(u.role || 'USR').substring(0, 3).toUpperCase()}-${u.id.substring(0, 5).toUpperCase()}`;
                }

                // Status logic: active users are 'approved' by default
                const status = 'approved';

                return {
                    id: u.id,
                    id_number: idNumber,
                    fullname: fullName,
                    email: u.email || '—',
                    role: (u.role ? u.role.charAt(0).toUpperCase() + u.role.slice(1) : 'User'),
                    status: status,
                    created_at: u.created_at,
                    rejection_reason: null
                };
            });

            updateStats();
            renderPendingUsers();
            renderUsers();
        } catch (err) {
            console.error('Error loading accounts:', err);
            showAlert('Failed to load accounts: ' + err.message, 'error');
            if (usersTableBody) {
                usersTableBody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 30px; color: #ef4444;">
                            <i class="fas fa-exclamation-triangle" style="font-size: 24px;"></i>
                            <p style="margin-top: 8px;">Failed to load accounts from database.</p>
                        </td>
                    </tr>
                `;
            }
        }
    }

    // ===== UI RENDERING =====
    function updateStats() {
        const total = users.length;
        const pending = users.filter(u => u.status === 'pending').length;
        const approved = users.filter(u => u.status === 'approved').length;
        const rejected = users.filter(u => u.status === 'rejected').length;

        const totalEl = document.getElementById('totalUsers');
        const pendingEl = document.getElementById('pendingCount');
        const approvedEl = document.getElementById('approvedCount');
        const rejectedEl = document.getElementById('rejectedCount');
        const pendingBadge = document.getElementById('pendingBadge');

        if (totalEl) totalEl.textContent = total;
        if (pendingEl) pendingEl.textContent = pending;
        if (approvedEl) approvedEl.textContent = approved;
        if (rejectedEl) rejectedEl.textContent = rejected;
        if (pendingBadge) pendingBadge.innerHTML = `<i class="fas fa-users"></i> ${pending} pending`;
    }

    function renderPendingUsers() {
        if (!pendingTableBody) return;
        const pendingUsers = users.filter(u => u.status === 'pending');

        if (pendingUsers.length === 0) {
            pendingTableBody.innerHTML = `
                <tr>
                    <td colspan="6">
                        <div class="no-pending" style="text-align: center; padding: 24px; color: #64748b;">
                            <i class="fas fa-check-circle" style="font-size: 24px; color: #10b981;"></i>
                            <p style="margin-top: 8px;">No pending account approvals at the moment.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        pendingUsers.forEach(user => {
            const roleColor = getRoleColor(user.role);
            html += `
                <tr>
                    <td><span class="id-badge">${user.id_number || 'N/A'}</span></td>
                    <td><strong>${user.fullname}</strong></td>
                    <td>${user.email}</td>
                    <td>
                        <span class="role-badge ${user.role.toLowerCase()}" style="background: ${roleColor} !important;">
                            ${user.role}
                        </span>
                    </td>
                    <td><i class="far fa-calendar"></i> ${formatDate(user.created_at)}</td>
                    <td class="cell-center cell-actions">
                        <div class="manage-dropdown">
                            <button type="button" class="btn-manage" aria-expanded="false" title="Manage Pending Account">
                                <span>Manage</span>
                                <i class="fas fa-chevron-down"></i>
                            </button>
                            <div class="manage-menu">
                                <button type="button" class="manage-item approve-item" onclick="window.approveUser('${user.id}')" title="Approve Account">
                                    <i class="fas fa-check-circle" style="color: #10b981;"></i>
                                    <span>Approve Account</span>
                                </button>
                                <button type="button" class="manage-item reject-item" onclick="window.openRejectModal('${user.id}', '${user.fullname.replace(/'/g, "\\'")}')" title="Reject Account">
                                    <i class="fas fa-times-circle" style="color: #ef4444;"></i>
                                    <span>Reject Account</span>
                                </button>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        });

        pendingTableBody.innerHTML = html;
        bindManageDropdowns(pendingTableBody);
    }

    function renderUsers() {
        if (!usersTableBody) return;

        const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const role = roleFilter ? roleFilter.value : '';
        const status = statusFilter ? statusFilter.value : '';

        let filtered = [...users];

        if (search) {
            filtered = filtered.filter(u => 
                u.fullname.toLowerCase().includes(search) ||
                u.email.toLowerCase().includes(search) ||
                (u.id_number && u.id_number.toLowerCase().includes(search))
            );
        }
        if (role) {
            filtered = filtered.filter(u => u.role.toLowerCase() === role.toLowerCase());
        }
        if (status) {
            filtered = filtered.filter(u => u.status.toLowerCase() === status.toLowerCase());
        }

        if (filtered.length === 0) {
            usersTableBody.innerHTML = `
                <tr>
                    <td colspan="7">
                        <div class="no-data" style="text-align:center; padding:30px; color:#64748b;">
                            <i class="fas fa-users" style="font-size:28px;"></i>
                            <h3 style="margin-top:8px;">No Users Found</h3>
                            <p>No user accounts match your search criteria.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        filtered.forEach(user => {
            const roleColor = getRoleColor(user.role);
            const statusClass = `status-${user.status}`;
            const isSelf = currentUserSession && currentUserSession.email && currentUserSession.email.toLowerCase() === user.email.toLowerCase();

            html += `
                <tr>
                    <td><span class="id-badge">${user.id_number || 'N/A'}</span></td>
                    <td><strong>${user.fullname}</strong> ${isSelf ? '<span style="font-size:11px; background:#e0e7ff; color:#3730a3; padding:2px 6px; border-radius:4px; margin-left:4px;">You</span>' : ''}</td>
                    <td>${user.email}</td>
                    <td>
                        <span class="role-badge ${user.role.toLowerCase()}" style="background: ${roleColor} !important;">
                            ${user.role}
                        </span>
                    </td>
                    <td><span class="status-badge ${statusClass}">${user.status.charAt(0).toUpperCase() + user.status.slice(1)}</span></td>
                    <td><span class="activity-time"><i class="far fa-calendar"></i> ${formatDate(user.created_at)}</span></td>
                    <td class="cell-center cell-actions">
                        <div class="manage-dropdown">
                            <button type="button" class="btn-manage" aria-expanded="false" title="Manage Account">
                                <span>Manage</span>
                                <i class="fas fa-chevron-down"></i>
                            </button>
                            <div class="manage-menu">
                                <a href="view_account.html?id=${user.id}" class="manage-item view-item" title="View Account">
                                    <i class="fas fa-eye" style="color: #2563eb;"></i>
                                    <span>View Account</span>
                                </a>
                                <a href="edit_account.html?id=${user.id}" class="manage-item edit-item" title="Edit Account">
                                    <i class="fas fa-edit" style="color: #d97706;"></i>
                                    <span>Edit Account</span>
                                </a>
                                ${!isSelf ? `
                                    <div class="manage-divider"></div>
                                    <button type="button" class="manage-item delete-item" onclick="window.deleteUser('${user.id}')" title="Delete Account">
                                        <i class="fas fa-trash-alt" style="color: #dc2626;"></i>
                                        <span>Delete Account</span>
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        });

        usersTableBody.innerHTML = html;
        bindManageDropdowns(usersTableBody);
    }

    function bindManageDropdowns(container) {
        if (!container) return;
        container.querySelectorAll('.btn-manage').forEach(btn => {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                const dropdown = this.closest('.manage-dropdown');
                const row = this.closest('tr');
                const isOpen = dropdown.classList.contains('show');

                document.querySelectorAll('.manage-dropdown.show').forEach(d => {
                    d.classList.remove('show');
                    d.classList.remove('dropup');
                    const r = d.closest('tr');
                    if (r) r.classList.remove('dropdown-open');
                });

                if (!isOpen) {
                    const rect = this.getBoundingClientRect();
                    const spaceBelow = window.innerHeight - rect.bottom;
                    if (spaceBelow < 200) {
                        dropdown.classList.add('dropup');
                    } else {
                        dropdown.classList.remove('dropup');
                    }
                    dropdown.classList.add('show');
                    if (row) row.classList.add('dropdown-open');
                }
            });
        });
    }

    // ===== GLOBALLY EXPOSED ACTIONS =====

    window.deleteUser = async function(id) {
        const user = users.find(u => u.id === id);
        if (!user) return;

        if (currentUserSession && currentUserSession.email && currentUserSession.email.toLowerCase() === user.email.toLowerCase()) {
            showAlert('You cannot delete your own account!', 'error');
            return;
        }

        if (!confirm(`Are you sure you want to permanently delete account for "${user.fullname}" (${user.email})?`)) {
            return;
        }

        try {
            // Cleanup related records if any
            if (user.role.toLowerCase() === 'teacher') {
                await supabase.from('teachers').delete().eq('user_id', id);
            }

            const { error } = await supabase
                .from('users')
                .delete()
                .eq('id', id);

            if (error) throw error;

            showAlert(`✅ Account for "${user.fullname}" deleted successfully!`, 'success');
            await loadAccounts();
        } catch (err) {
            console.error('Error deleting account:', err);
            showAlert('Failed to delete account: ' + err.message, 'error');
        }
    };

    window.approveUser = function(id) {
        showAlert('User is active and approved.', 'success');
    };

    window.openRejectModal = function(id, name) {
        if (rejectUserId) rejectUserId.value = id;
        if (rejectUserName) rejectUserName.textContent = name;
        if (rejectionReason) rejectionReason.value = '';
        if (rejectModal) rejectModal.classList.add('active');
    };

    window.closeRejectModal = function() {
        if (rejectModal) rejectModal.classList.remove('active');
    };

    window.resetFilters = function() {
        if (searchInput) searchInput.value = '';
        if (roleFilter) roleFilter.value = '';
        if (statusFilter) statusFilter.value = '';
        renderUsers();
    };

    // ===== EVENT LISTENERS =====
    if (filterForm) {
        filterForm.addEventListener('submit', function(e) {
            e.preventDefault();
            renderUsers();
        });
    }

    if (searchInput) searchInput.addEventListener('input', renderUsers);
    if (roleFilter) roleFilter.addEventListener('change', renderUsers);
    if (statusFilter) statusFilter.addEventListener('change', renderUsers);

    document.addEventListener('click', function(e) {
        if (e.target === rejectModal) window.closeRejectModal();

        // Close open manage dropdowns when clicking outside
        if (!e.target.closest('.manage-dropdown')) {
            document.querySelectorAll('.manage-dropdown.show').forEach(d => {
                d.classList.remove('show');
                d.classList.remove('dropup');
                const r = d.closest('tr');
                if (r) r.classList.remove('dropdown-open');
            });
        }
    });

    // ===== MOBILE MENU =====
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
        });
    }

    // Initial load
    await loadAccounts();
});