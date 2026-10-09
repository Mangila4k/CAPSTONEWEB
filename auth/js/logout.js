/**
 * HES Logout - Clear session and redirect to login page
 */

(function() {
    'use strict';

    console.log('🚪 Logout page ready');

    // ============================================
    // DOM ELEMENTS
    // ============================================

    const logoutBtn = document.getElementById('logoutBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');
    const userEmail = document.getElementById('userEmail');
    const userRole = document.getElementById('userRole');

    // ============================================
    // LOAD USER INFO FROM SESSION
    // ============================================

    const currentUserStr = localStorage.getItem('currentUser');

    if (currentUserStr) {
        try {
            const user = JSON.parse(currentUserStr);
            console.log('👤 Current user:', user);

            const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
            const initial = (user.firstName || user.email || 'U').charAt(0).toUpperCase();

            userAvatar.textContent = initial;
            userName.textContent = fullName;
            userEmail.textContent = user.email;
            userRole.innerHTML = `<i class="fas fa-user"></i> ${user.role}`;

        } catch (error) {
            console.error('❌ Error parsing user:', error);
        }
    }

    // ============================================
    // ROLE ROUTES (para sa Cancel button)
    // ============================================

    function getDashboardRoute(role) {
        const roleRoutes = {
            'admin': '../admin/dashboard.html',
            'teacher': '../teacher/dashboard.html',
            'student': '../student/dashboard.html',
            'parent': '../parents/dashboard.html',
            'registrar': '../registrar/dashboard.html',
            'principal': '../principal/dashboard.html',
            'guidance': '../guidance/dashboard.html'
        };
        return roleRoutes[role] || '../student/dashboard.html';
    }

    // ============================================
    // LOGOUT FUNCTION
    // ============================================

    let isLoggingOut = false;

    function performLogout() {
        if (isLoggingOut) return;
        isLoggingOut = true;

        console.log('🚪 Performing logout...');

        // Disable button
        logoutBtn.disabled = true;
        logoutBtn.innerHTML = '<span class="spinner"></span> Logging out...';

        // 1. Clear localStorage
        localStorage.removeItem('currentUser');
        localStorage.removeItem('hes_admin_name');
        localStorage.removeItem('hes_student_name');
        localStorage.removeItem('hes_teacher_name');
        localStorage.removeItem('hes_registrar_name');
        localStorage.removeItem('hes_parent_name');
        localStorage.removeItem('hes_admin_avatar');
        localStorage.removeItem('hes_student_avatar');
        localStorage.removeItem('hes_teacher_avatar');
        localStorage.removeItem('hes_registrar_avatar');
        localStorage.removeItem('hes_parent_avatar');
        console.log('✅ localStorage cleared');

        // 2. Clear sessionStorage
        sessionStorage.clear();
        console.log('✅ sessionStorage cleared');

        // 3. Clear cookies
        document.cookie = 'user_email=; path=/; max-age=0';
        console.log('✅ Cookies cleared');

        // 4. Redirect to login page
        setTimeout(function() {
            console.log('🔄 Redirecting to login...');
            window.location.replace('login.html');
        }, 800);
    }

    // ============================================
    // CANCEL - Balik sa dashboard
    // ============================================

    function cancelLogout() {
        console.log('↩️ Cancel logout');

        if (currentUserStr) {
            try {
                const user = JSON.parse(currentUserStr);
                const route = getDashboardRoute(user.role);
                console.log('↩️ Returning to:', route);
                window.location.replace(route);
                return;
            } catch (e) {
                console.error('❌ Error:', e);
            }
        }

        // Fallback
        window.location.replace('login.html');
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================

    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            performLogout();
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', function(e) {
            e.preventDefault();
            cancelLogout();
        });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            cancelLogout();
        }
        if (e.key === 'Enter') {
            performLogout();
        }
    });

    // ============================================
    // INIT
    // ============================================

    console.log('✅ Logout ready');

})();