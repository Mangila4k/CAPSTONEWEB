// ===== HES TEACHER AVATAR & INITIALS SYNC =====
(function() {
    function getTeacherInitials(name) {
        if (!name || typeof name !== 'string') return 'T';
        const cleanName = name.replace(/^(mr\.?|mrs\.?|ms\.?|dr\.?|prof\.?|engr\.?|atty\.?)\s+/i, '').trim();
        const words = cleanName.split(/[\s,&-]+/).filter(w => w.length > 0 && !['and', 'the', 'of', '&'].includes(w.toLowerCase()));
        if (words.length === 0) return name.charAt(0).toUpperCase();
        if (words.length === 1) return words[0].substring(0, Math.min(2, words[0].length)).toUpperCase();
        return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
    }

    function syncTeacherAvatarAndName() {
        try {
            let savedName = localStorage.getItem('hes_teacher_name');
            const savedAvatar = localStorage.getItem('hes_teacher_avatar');

            if (!savedName) {
                const userStr = localStorage.getItem('currentUser');
                if (userStr) {
                    try {
                        const u = JSON.parse(userStr);
                        const first = u.firstName || u.first_name || '';
                        const last = u.lastName || u.last_name || '';
                        const uName = (first || last) ? `${first} ${last}`.trim() : (u.name || u.displayName || (u.email ? u.email.split('@')[0] : ''));
                        if (uName) savedName = uName;
                    } catch(e) {}
                }
            }

            // Fallback default teacher name if not set
            if (!savedName) {
                savedName = 'Teacher';
            }

            document.querySelectorAll('.teacher-name, #teacherName').forEach(el => {
                el.textContent = savedName;
            });

            const initials = getTeacherInitials(savedName);

            document.querySelectorAll('.teacher-avatar').forEach(avatar => {
                if (savedAvatar) {
                    avatar.innerHTML = `
                        <img src="${savedAvatar}" alt="Teacher" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">
                        <div class="online-dot"></div>
                    `;
                } else {
                    avatar.innerHTML = `
                        <div class="avatar-initial" id="teacherInitial">${initials}</div>
                        <div class="online-dot"></div>
                    `;
                }
            });
        } catch(e) {
            console.warn('Teacher avatar sync error:', e);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', syncTeacherAvatarAndName);
    } else {
        syncTeacherAvatarAndName();
    }

    window.syncTeacherAvatarAndName = syncTeacherAvatarAndName;
})();
