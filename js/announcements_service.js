/**
 * Announcements & Meeting Notices Service
 * Manages announcements for Admin, Teachers, Parents, and Students with Supabase sync & localStorage resilience
 */

import { supabase } from '../supabase/config.js';

export const AnnouncementsService = {
    STORAGE_KEY: 'hes_announcements',
    RSVP_STORAGE_KEY: 'hes_meeting_rsvps',

    // Default Seed Data
    getDefaultAnnouncements() {
        return [
            {
                id: 'anc-001',
                title: 'General Parent-Teacher Association (PTA) Assembly',
                content: 'We invite all parents and guardians to our 1st General PTA Assembly. We will discuss academic guidelines, school safety policies, upcoming institutional events, and student welfare initiatives.',
                category: 'meeting',
                target_audience: 'parents',
                meeting_type: 'pta_assembly',
                priority: 'important',
                date_created: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                meeting_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                meeting_time: '09:00 AM - 11:30 AM',
                venue: 'School Gymnasium / Auditorium (and via Google Meet)',
                meeting_link: 'https://meet.google.com/hes-pta-assembly',
                author_name: 'School Administration & PTA Board',
                author_role: 'admin',
                requires_rsvp: true,
                agenda: [
                    'Welcome Remarks & Principal Address',
                    'Curriculum & Academic Calendar Briefing',
                    'Safety Protocols & Biometric Attendance Implementation',
                    'Open Forum & Q&A Session'
                ]
            },
            {
                id: 'anc-002',
                title: 'Quarterly Faculty & Departmental Planning Meeting',
                content: 'All teaching personnel and subject coordinators are required to attend the Faculty Alignment Session. Please prepare your grade sheets, instructional plans, and attendance summary reports.',
                category: 'meeting',
                target_audience: 'teachers',
                meeting_type: 'faculty_meeting',
                priority: 'important',
                date_created: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
                meeting_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                meeting_time: '02:00 PM - 04:30 PM',
                venue: 'Faculty Conference Hall, 2nd Floor',
                meeting_link: 'https://meet.google.com/hes-faculty-meet',
                author_name: 'Academic Affairs Office',
                author_role: 'admin',
                requires_rsvp: true,
                agenda: [
                    'Review of Grading Deadlines & DepEd Guidelines',
                    'Class Schedule Adjustments for Next Quarter',
                    'Teacher Attendance & Biometric Scanning Verification',
                    'Advisory Homeroom Updates'
                ]
            },
            {
                id: 'anc-003',
                title: 'Homeroom Parent-Teacher Conference (1-on-1 Consultation)',
                content: 'Dear Parents, our class advisers are opening schedules for individual consultations regarding your child\'s academic standing, classroom performance, and quarterly grades.',
                category: 'meeting',
                target_audience: 'parent_teacher_meeting',
                meeting_type: 'homeroom_meeting',
                priority: 'normal',
                date_created: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
                meeting_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                meeting_time: '01:00 PM - 05:00 PM',
                venue: 'Designated Homeroom Classrooms',
                meeting_link: '',
                author_name: 'Grade Level Advisers & Faculty',
                author_role: 'teacher',
                requires_rsvp: true,
                agenda: [
                    'Distribution and Review of Report Cards',
                    'Student Progress and Behavior Feedback',
                    'Remediation and Enrichment Plan Consultation'
                ]
            },
            {
                id: 'anc-004',
                title: 'Implementation of Biometric & QR Attendance System',
                content: 'Please be advised that the school now actively logs daily entry and exit timestamps using facial biometrics and QR scanners. Parents will receive immediate attendance notifications in the portal.',
                category: 'general',
                target_audience: 'all',
                meeting_type: 'none',
                priority: 'normal',
                date_created: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                meeting_date: '',
                meeting_time: '',
                venue: 'Campus Gates & Classrooms',
                meeting_link: '',
                author_name: 'Hiraya IT & Registrar Office',
                author_role: 'admin',
                requires_rsvp: false,
                agenda: []
            }
        ];
    },

    // Get all announcements from Supabase or LocalStorage
    async getAnnouncements(filters = {}) {
        let list = [];

        try {
            // 1. Try querying Supabase announcements table
            const { data, error } = await supabase
                .from('announcements')
                .select('*')
                .order('created_at', { ascending: false });

            if (!error && data && data.length > 0) {
                list = data.map(item => ({
                    id: String(item.id),
                    title: item.title || 'Announcement',
                    content: item.content || item.description || item.message || '',
                    category: item.category || 'general',
                    target_audience: item.target_audience || item.audience || 'all',
                    meeting_type: item.meeting_type || 'none',
                    priority: item.priority || 'normal',
                    date_created: item.created_at || new Date().toISOString(),
                    meeting_date: item.meeting_date || '',
                    meeting_time: item.meeting_time || '',
                    venue: item.venue || '',
                    meeting_link: item.meeting_link || '',
                    author_name: item.author_name || item.created_by || 'Administration',
                    author_role: item.author_role || 'admin',
                    requires_rsvp: item.requires_rsvp ?? (item.category === 'meeting'),
                    agenda: Array.isArray(item.agenda) ? item.agenda : (typeof item.agenda === 'string' ? JSON.parse(item.agenda || '[]') : [])
                }));
            }
        } catch (e) {
            console.warn('Supabase announcements query note:', e);
        }

        // 2. Fetch from LocalStorage fallback if needed
        const localRaw = localStorage.getItem(this.STORAGE_KEY);
        let localList = [];
        if (localRaw) {
            try {
                localList = JSON.parse(localRaw);
            } catch (e) {}
        }

        if (localList.length === 0 && list.length === 0) {
            localList = this.getDefaultAnnouncements();
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(localList));
        }

        // Combine Supabase and Local (avoid duplicates by ID)
        localList.forEach(loc => {
            if (!list.some(s => String(s.id) === String(loc.id))) {
                list.push(loc);
            }
        });

        // Apply Target Audience & Category Filtering
        if (filters.targetRole) {
            const role = filters.targetRole.toLowerCase();
            list = list.filter(item => {
                const aud = (item.target_audience || 'all').toLowerCase();
                if (aud === 'all') return true;
                if (role === 'admin') return true;
                if (role === 'teacher') {
                    return aud === 'teachers' || aud === 'teacher' || aud === 'parent_teacher_meeting' || aud === 'parents' || aud === 'all' || item.author_role === 'teacher';
                }
                if (role === 'parent' || role === 'parents') {
                    return aud === 'parents' || aud === 'parent' || aud === 'parent_teacher_meeting' || aud === 'all';
                }
                if (role === 'student') {
                    return aud === 'students' || aud === 'student' || aud === 'all';
                }
                return true;
            });
        }

        if (filters.targetAudience && filters.targetAudience !== 'all') {
            list = list.filter(item => (item.target_audience || 'all').toLowerCase() === filters.targetAudience.toLowerCase());
        }

        if (filters.category && filters.category !== 'all') {
            list = list.filter(item => item.category === filters.category);
        }

        if (filters.meetingType && filters.meetingType !== 'all') {
            list = list.filter(item => item.meeting_type === filters.meetingType);
        }

        if (filters.priority && filters.priority !== 'all') {
            list = list.filter(item => (item.priority || 'normal').toLowerCase() === filters.priority.toLowerCase());
        }

        if (filters.search) {
            const q = filters.search.toLowerCase().trim();
            list = list.filter(item => 
                (item.title || '').toLowerCase().includes(q) ||
                (item.content || '').toLowerCase().includes(q) ||
                (item.venue || '').toLowerCase().includes(q) ||
                (item.author_name || '').toLowerCase().includes(q) ||
                (item.meeting_type || '').toLowerCase().includes(q) ||
                (Array.isArray(item.agenda) && item.agenda.some(ag => ag.toLowerCase().includes(q)))
            );
        }

        // Sort descending (latest created first)
        list.sort((a, b) => new Date(b.date_created || 0) - new Date(a.date_created || 0));

        return list;
    },

    // Create a new announcement
    async createAnnouncement(payload) {
        const id = `anc-${Date.now()}`;
        const newAnnouncement = {
            id,
            title: payload.title || 'New Announcement',
            content: payload.content || '',
            category: payload.category || (payload.meeting_type && payload.meeting_type !== 'none' ? 'meeting' : 'general'),
            target_audience: payload.target_audience || 'all',
            meeting_type: payload.meeting_type || 'none',
            priority: payload.priority || 'normal',
            date_created: new Date().toISOString(),
            meeting_date: payload.meeting_date || '',
            meeting_time: payload.meeting_time || '',
            venue: payload.venue || '',
            meeting_link: payload.meeting_link || '',
            author_name: payload.author_name || 'Administrator',
            author_role: payload.author_role || 'admin',
            section_or_child: payload.section_or_child || '',
            requires_rsvp: Boolean(payload.requires_rsvp),
            agenda: Array.isArray(payload.agenda) ? payload.agenda : []
        };

        // 1. Try Supabase Insert
        try {
            await supabase.from('announcements').insert([{
                id: newAnnouncement.id,
                title: newAnnouncement.title,
                content: newAnnouncement.content,
                category: newAnnouncement.category,
                target_audience: newAnnouncement.target_audience,
                meeting_type: newAnnouncement.meeting_type,
                priority: newAnnouncement.priority,
                meeting_date: newAnnouncement.meeting_date || null,
                meeting_time: newAnnouncement.meeting_time || null,
                venue: newAnnouncement.venue || null,
                meeting_link: newAnnouncement.meeting_link || null,
                author_name: newAnnouncement.author_name,
                author_role: newAnnouncement.author_role,
                requires_rsvp: newAnnouncement.requires_rsvp,
                agenda: newAnnouncement.agenda,
                created_at: newAnnouncement.date_created
            }]);
        } catch (e) {
            console.warn('Supabase announcement insert note:', e);
        }

        // 2. Save in LocalStorage
        const localRaw = localStorage.getItem(this.STORAGE_KEY);
        let list = [];
        try {
            list = localRaw ? JSON.parse(localRaw) : this.getDefaultAnnouncements();
        } catch (e) {
            list = this.getDefaultAnnouncements();
        }
        list.unshift(newAnnouncement);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));

        // 3. Dispatch notifications for the target audience
        try {
            let targetRole = null;
            if (newAnnouncement.target_audience === 'teachers') targetRole = 'teacher';
            else if (newAnnouncement.target_audience === 'parents') targetRole = 'parent';
            else if (newAnnouncement.target_audience === 'students') targetRole = 'student';

            await supabase.from('notifications').insert([{
                title: `📢 ${newAnnouncement.title}`,
                message: newAnnouncement.content.substring(0, 180),
                type: newAnnouncement.category === 'meeting' ? 'meeting' : 'announcement',
                role: targetRole,
                announcement_id: String(newAnnouncement.id),
                priority: newAnnouncement.priority || 'normal',
                read: false,
                is_read: false,
                created_at: newAnnouncement.date_created
            }]);
        } catch(e) {}

        // 4. Log in activity logs
        this.logActivity(
            `Published ${newAnnouncement.category === 'meeting' ? 'Meeting Notice' : 'Announcement'}: ${newAnnouncement.title}`,
            `Audience: ${newAnnouncement.target_audience}, Priority: ${newAnnouncement.priority}`,
            newAnnouncement.author_role,
            payload.author_id || null
        );

        return newAnnouncement;
    },

    // Update an existing announcement
    async updateAnnouncement(id, payload) {
        const updateData = {
            title: payload.title,
            content: payload.content,
            category: payload.category || (payload.meeting_type && payload.meeting_type !== 'none' ? 'meeting' : 'general'),
            target_audience: payload.target_audience || 'all',
            meeting_type: payload.meeting_type || 'none',
            priority: payload.priority || 'normal',
            meeting_date: payload.meeting_date || '',
            meeting_time: payload.meeting_time || '',
            venue: payload.venue || '',
            meeting_link: payload.meeting_link || '',
            requires_rsvp: Boolean(payload.requires_rsvp),
            agenda: Array.isArray(payload.agenda) ? payload.agenda : []
        };

        // 1. Update in Supabase
        try {
            await supabase.from('announcements').update({
                title: updateData.title,
                content: updateData.content,
                category: updateData.category,
                target_audience: updateData.target_audience,
                meeting_type: updateData.meeting_type,
                priority: updateData.priority,
                meeting_date: updateData.meeting_date || null,
                meeting_time: updateData.meeting_time || null,
                venue: updateData.venue || null,
                meeting_link: updateData.meeting_link || null,
                requires_rsvp: updateData.requires_rsvp,
                agenda: updateData.agenda
            }).eq('id', id);
        } catch (e) {
            console.warn('Supabase update announcement error:', e);
        }

        // 2. Update in LocalStorage
        const localRaw = localStorage.getItem(this.STORAGE_KEY);
        if (localRaw) {
            try {
                let list = JSON.parse(localRaw);
                const idx = list.findIndex(item => String(item.id) === String(id));
                if (idx >= 0) {
                    list[idx] = { ...list[idx], ...updateData };
                    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
                }
            } catch (e) {}
        }

        this.logActivity(
            `Updated Announcement / Meeting: ${updateData.title}`,
            `ID: ${id}, Target: ${updateData.target_audience}`,
            'admin'
        );

        return true;
    },

    // Delete announcement
    async deleteAnnouncement(id) {
        try {
            await supabase.from('announcements').delete().eq('id', id);
            await supabase.from('meeting_rsvps').delete().eq('announcement_id', id);
        } catch (e) {}

        const localRaw = localStorage.getItem(this.STORAGE_KEY);
        if (localRaw) {
            try {
                let list = JSON.parse(localRaw);
                list = list.filter(item => String(item.id) !== String(id));
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
            } catch(e) {}
        }

        this.logActivity(
            `Deleted Announcement / Meeting Notice`,
            `Announcement ID: ${id}`,
            'admin'
        );

        return true;
    },

    // Submit RSVP for a meeting
    async submitRSVP(announcementId, userPayload, status = 'attending') {
        const key = this.RSVP_STORAGE_KEY;
        let rsvps = {};
        try {
            const raw = localStorage.getItem(key);
            if (raw) rsvps = JSON.parse(raw);
        } catch(e) {}

        if (!rsvps[announcementId]) {
            rsvps[announcementId] = [];
        }

        const userId = userPayload.id || `usr-${Date.now()}`;
        const userName = userPayload.displayName || userPayload.firstName || userPayload.fullname || 'User';
        const userRole = userPayload.role || 'parent';
        const userEmail = userPayload.email || '';

        const existingIdx = rsvps[announcementId].findIndex(r => 
            (userEmail && r.email === userEmail) || (userId && r.userId === userId)
        );

        const rsvpEntry = {
            userId,
            userName,
            userRole,
            email: userEmail,
            status, // 'attending', 'declined', 'acknowledged'
            timestamp: new Date().toISOString()
        };

        if (existingIdx >= 0) {
            rsvps[announcementId][existingIdx] = rsvpEntry;
        } else {
            rsvps[announcementId].push(rsvpEntry);
        }

        localStorage.setItem(key, JSON.stringify(rsvps));

        // Sync to Supabase
        try {
            await supabase.from('meeting_rsvps').insert([{
                announcement_id: String(announcementId),
                user_id: String(userId),
                user_name: userName,
                user_role: userRole,
                email: userEmail,
                status,
                created_at: rsvpEntry.timestamp,
                updated_at: rsvpEntry.timestamp
            }]);
        } catch (e) {
            console.warn('Supabase RSVP insert note:', e);
        }

        return rsvpEntry;
    },

    // Get RSVP list (attendees roster) for an announcement
    async getRSVPList(announcementId) {
        let list = [];

        // 1. Try Supabase
        try {
            const { data, error } = await supabase
                .from('meeting_rsvps')
                .select('*')
                .eq('announcement_id', String(announcementId))
                .order('created_at', { ascending: false });

            if (!error && data && data.length > 0) {
                list = data.map(r => ({
                    userId: r.user_id,
                    userName: r.user_name || 'Anonymous User',
                    userRole: r.user_role || 'Attendee',
                    email: r.email || '',
                    status: r.status || 'attending',
                    timestamp: r.created_at || r.updated_at || new Date().toISOString()
                }));
            }
        } catch(e) {}

        // 2. Combine with LocalStorage
        const key = this.RSVP_STORAGE_KEY;
        try {
            const raw = localStorage.getItem(key);
            if (raw) {
                const rsvps = JSON.parse(raw);
                const localList = rsvps[announcementId] || [];
                localList.forEach(loc => {
                    if (!list.some(s => (s.email && s.email === loc.email) || (s.userId && s.userId === loc.userId))) {
                        list.push(loc);
                    }
                });
            }
        } catch(e) {}

        return list;
    },

    // Get RSVP status for current user on an announcement
    getUserRSVP(announcementId, userPayload) {
        if (!userPayload) return null;
        const key = this.RSVP_STORAGE_KEY;
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            const rsvps = JSON.parse(raw);
            const list = rsvps[announcementId] || [];
            return list.find(r => 
                (userPayload.email && r.email === userPayload.email) || 
                (userPayload.id && r.userId === userPayload.id) ||
                (userPayload.displayName && r.userName === userPayload.displayName)
            ) || null;
        } catch(e) {
            return null;
        }
    },

    // Get total RSVPs count for an announcement
    getRSVPCounts(announcementId) {
        const key = this.RSVP_STORAGE_KEY;
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return { attending: 0, declined: 0, acknowledged: 0, total: 0 };
            const rsvps = JSON.parse(raw);
            const list = rsvps[announcementId] || [];
            return {
                attending: list.filter(r => r.status === 'attending').length,
                declined: list.filter(r => r.status === 'declined').length,
                acknowledged: list.filter(r => r.status === 'acknowledged').length,
                total: list.length
            };
        } catch(e) {
            return { attending: 0, declined: 0, acknowledged: 0, total: 0 };
        }
    },

    // Helper to log activities
    async logActivity(action, details = '', role = 'admin', userId = null) {
        const timestamp = new Date().toISOString();
        
        // 1. LocalStorage log
        try {
            const actKey = 'hes_activities';
            const raw = localStorage.getItem(actKey);
            const activities = raw ? JSON.parse(raw) : [];
            activities.unshift({
                id: `act-${Date.now()}`,
                action,
                details,
                role,
                timestamp
            });
            localStorage.setItem(actKey, JSON.stringify(activities.slice(0, 100)));
        } catch(e) {}

        // 2. Supabase log
        try {
            await supabase.from('activity_logs').insert([{
                action,
                details,
                role,
                user_id: userId,
                timestamp
            }]);
        } catch(e) {}
    }
};
