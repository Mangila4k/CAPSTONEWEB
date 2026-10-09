/**
 * Teacher Load & Section Class Programs Script
 * Dynamic Supabase Integration
 * Matches the mobile app teacher schedule fetching & rendering architecture
 */

import { supabase } from '../../supabase/config.js';

document.addEventListener('DOMContentLoaded', async function() {
    'use strict';

    console.log('📅 Teacher Load (Supabase) ready');

    // DOM Elements - Header & Profile
    const teacherName = document.getElementById('teacherName');
    const teacherInitial = document.getElementById('teacherInitial');
    const logoutBtn = document.getElementById('logoutBtn');
    const dateBadge = document.getElementById('dateBadge');
    const alertContainer = document.getElementById('alertContainer');
    const btnRefresh = document.getElementById('btnRefresh');

    // DOM Elements - Stats
    const totalClassesStat = document.getElementById('totalClasses');
    const totalSectionsStat = document.getElementById('totalSections');
    const totalSubjectsStat = document.getElementById('totalSubjects');
    const freePeriodsStat = document.getElementById('freePeriods');

    // DOM Elements - Views & Controls
    const scheduleContainer = document.getElementById('scheduleContainer');
    const timetableContainer = document.getElementById('timetableContainer');
    const searchInput = document.getElementById('searchScheduleInput');
    const dayFilterChips = document.querySelectorAll('.day-chip');
    const viewToggleBtns = document.querySelectorAll('.btn-view-toggle');

    // State
    let sessionUser = null;
    let teacherRecord = null;
    let schedules = [];
    let activeDayFilter = 'all';
    let currentViewMode = 'cards'; // 'cards' or 'grid'

    // ============================================
    // 1. AUTH & SESSION CHECK
    // ============================================
    try {
        const stored = localStorage.getItem('currentUser');
        if (stored) sessionUser = JSON.parse(stored);
    } catch(e) {
        console.error('Error reading currentUser:', e);
    }

    if (!sessionUser) {
        console.warn('⚠️ No active teacher session, redirecting...');
        window.location.replace('../auth/login.html');
        return;
    }

    const currentUserId = sessionUser.id || sessionUser.uid;
    const userEmail = sessionUser.email || '';
    const userFullName = sessionUser.firstName 
        ? `${sessionUser.firstName} ${sessionUser.lastName || ''}`.trim()
        : (sessionUser.displayName || sessionUser.name || 'Faculty Teacher');

    if (teacherName) teacherName.textContent = userFullName;
    if (typeof window.syncTeacherAvatarAndName === 'function') {
        window.syncTeacherAvatarAndName();
    } else if (teacherInitial) {
        teacherInitial.textContent = (userFullName || 'T').charAt(0).toUpperCase();
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            localStorage.removeItem('currentUser');
            try { await supabase.auth.signOut(); } catch(err) {}
            window.location.replace('../auth/login.html');
        });
    }

    // Set Live Header Date
    if (dateBadge) {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateBadge.innerHTML = `<i class="fas fa-calendar-alt"></i> ${now.toLocaleDateString('en-US', options)}`;
    }

    // Toast Alert Helper
    function showAlert(type, message, duration = 4000) {
        if (!alertContainer) return;
        const icon = type === 'success' ? 'fa-check-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-times-circle';
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 16px;
            border-radius: 10px;
            margin-bottom: 16px;
            font-size: 13.5px;
            font-weight: 500;
            background: ${type === 'success' ? '#dcfce7' : type === 'warning' ? '#fef3c7' : '#fee2e2'};
            color: ${type === 'success' ? '#166534' : type === 'warning' ? '#92400e' : '#991b1b'};
            border: 1px solid ${type === 'success' ? '#bbf7d0' : type === 'warning' ? '#fde68a' : '#fecaca'};
            box-shadow: 0 2px 6px rgba(0,0,0,0.04);
            animation: fadeIn 0.2s ease-out;
        `;
        alertDiv.innerHTML = `<i class="fas ${icon}"></i> <div style="flex:1;">${message}</div>`;
        alertContainer.prepend(alertDiv);

        setTimeout(() => {
            alertDiv.style.opacity = '0';
            alertDiv.style.transition = 'opacity 0.3s ease';
            setTimeout(() => alertDiv.remove(), 300);
        }, duration);
    }

    // ============================================
    // 2. TIME FORMATTER (Matches mobile formatTime)
    // ============================================
    const formatTime = (t) => {
        if (!t) return 'N/A';
        if (t.includes('AM') || t.includes('PM')) return t;
        const [h, m] = t.split(':');
        const hour = parseInt(h, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const h12 = hour % 12 || 12;
        return `${h12}:${m} ${ampm}`;
    };

    // Calculate duration in hours/minutes
    const getDurationText = (startStr, endStr) => {
        if (!startStr || !endStr) return '';
        try {
            const [sh, sm] = startStr.split(':').map(Number);
            const [eh, em] = endStr.split(':').map(Number);
            const totalMins = (eh * 60 + em) - (sh * 60 + sm);
            if (totalMins > 0) {
                const hrs = Math.floor(totalMins / 60);
                const mins = totalMins % 60;
                if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
                if (hrs > 0) return `${hrs} hr${hrs > 1 ? 's' : ''}`;
                return `${mins} mins`;
            }
        } catch(e) {}
        return '';
    };

    // ============================================
    // 3. LOAD SCHEDULE DATA (Matching Mobile App Flow)
    // ============================================
    async function loadSchedule() {
        if (scheduleContainer) {
            scheduleContainer.innerHTML = `
                <div style="text-align: center; padding: 48px 20px; color: #64748b;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 32px; color: #1B2A4A; margin-bottom: 12px;"></i>
                    <p style="font-size: 14px; margin: 0;">Loading class program schedules from database...</p>
                </div>
            `;
        }

        try {
            // 1. Fetch user & teacher record
            let targetUserId = currentUserId;
            if (userEmail) {
                const { data: userData } = await supabase
                    .from('users')
                    .select('*')
                    .eq('email', userEmail)
                    .maybeSingle();

                if (userData) targetUserId = userData.id;
            }

            // 2. Fetch teacher data
            const { data: teacherData, error: tErr } = await supabase
                .from('teachers')
                .select('*')
                .or(`user_id.eq.${targetUserId},id.eq.${targetUserId}`)
                .maybeSingle();

            if (!teacherData) {
                console.warn('Teacher record not found in database.');
                renderEmptyState('No teacher record found. Please ensure your teacher profile is registered.');
                return;
            }

            teacherRecord = teacherData;
            console.log('👨‍🏫 Teacher found:', teacherRecord.id);

            // 3. Fetch schedules for this teacher
            const { data: scheduleRows, error: sErr } = await supabase
                .from('schedules')
                .select('*')
                .eq('teacher_id', teacherRecord.id);

            if (sErr) throw sErr;

            if (!scheduleRows || scheduleRows.length === 0) {
                schedules = [];
                updateStats();
                renderScheduleCards();
                renderTimetableGrid();
                return;
            }

            // 4. Fetch related subjects & sections in parallel
            const subjectIds = [...new Set(scheduleRows.map(s => s.subject_id).filter(Boolean))];
            const sectionIds = [...new Set(scheduleRows.map(s => s.section_id).filter(Boolean))];

            const subjectMap = {};
            const sectionMap = {};

            const promises = [];

            if (subjectIds.length > 0) {
                promises.push(
                    supabase.from('subjects').select('id, name, code, grade_level').in('id', subjectIds)
                        .then(({ data: subs }) => {
                            (subs || []).forEach(s => { subjectMap[s.id] = s; });
                        })
                );
            }

            if (sectionIds.length > 0) {
                promises.push(
                    supabase.from('sections').select('id, name, grade_level, strand, room').in('id', sectionIds)
                        .then(({ data: secs }) => {
                            (secs || []).forEach(s => { sectionMap[s.id] = s; });
                        })
                );
            }

            await Promise.all(promises);

            // 5. Map & format schedules exactly like the mobile app
            schedules = scheduleRows.map(s => {
                const sub = subjectMap[s.subject_id] || {};
                const sec = sectionMap[s.section_id] || {};

                return {
                    id: s.id,
                    day: s.day || 'Monday',
                    time_start: formatTime(s.start_time),
                    time_end: formatTime(s.end_time),
                    start_raw: s.start_time || '00:00:00',
                    end_raw: s.end_time || '00:00:00',
                    duration: getDurationText(s.start_time, s.end_time),
                    subject_name: sub.name || 'Unknown Subject',
                    subject_code: sub.code || '',
                    section_name: sec.name || 'No Section',
                    grade_level: sec.grade_level || sub.grade_level || '',
                    room: s.room || sec.room || 'N/A'
                };
            });

            console.log(`✅ Loaded ${schedules.length} teacher load classes`);

            updateStats();
            renderScheduleCards();
            renderTimetableGrid();

        } catch (err) {
            console.error('❌ Error loading teacher load:', err);
            showAlert('error', `Failed to load teacher load: ${err.message || 'Unknown error'}`);
            renderEmptyState('Failed to load teacher load from database.');
        }
    }

    // ============================================
    // 4. GROUP & RENDER SCHEDULE CARDS (App Layout)
    // ============================================
    const groupByDay = (items) => {
        const grouped = {};
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        days.forEach(d => { grouped[d] = []; });
        
        items.forEach(s => {
            if (!grouped[s.day]) grouped[s.day] = [];
            grouped[s.day].push(s);
        });
        return grouped;
    };

    function renderScheduleCards() {
        if (!scheduleContainer) return;

        const search = (searchInput ? searchInput.value : '').toLowerCase().trim();

        let filtered = schedules.filter(s => {
            if (activeDayFilter !== 'all' && s.day.toLowerCase() !== activeDayFilter.toLowerCase()) {
                return false;
            }
            if (search) {
                const mSub = (s.subject_name || '').toLowerCase().includes(search);
                const mCode = (s.subject_code || '').toLowerCase().includes(search);
                const mSec = (s.section_name || '').toLowerCase().includes(search);
                const mRoom = (s.room || '').toLowerCase().includes(search);
                const mDay = (s.day || '').toLowerCase().includes(search);
                return mSub || mCode || mSec || mRoom || mDay;
            }
            return true;
        });

        if (filtered.length === 0) {
            renderEmptyState(search ? 'No classes matched your search filter.' : 'No teacher load assigned yet.');
            return;
        }

        const grouped = groupByDay(filtered);
        const daysWithClasses = Object.keys(grouped).filter(d => grouped[d].length > 0);

        if (daysWithClasses.length === 0) {
            renderEmptyState('No classes scheduled for the selected day.');
            return;
        }

        let html = '';

        daysWithClasses.forEach(day => {
            const classesForDay = grouped[day].sort((a, b) => (a.start_raw || '').localeCompare(b.start_raw || ''));
            const count = classesForDay.length;

            html += `
                <div class="day-section">
                    <div class="day-section-header">
                        <div class="day-section-title">
                            <i class="fas fa-calendar-day" style="color: #1B2A4A;"></i> ${day}
                        </div>
                        <span class="day-badge-count">
                            ${count} class${count !== 1 ? 'es' : ''}
                        </span>
                    </div>

                    <div class="schedule-cards-grid">
                        ${classesForDay.map(s => `
                            <div class="schedule-item-card">
                                <!-- Time block on left -->
                                <div class="time-container">
                                    <div class="time-start">${s.time_start}</div>
                                    <div class="time-end">${s.time_end}</div>
                                    ${s.duration ? `<span class="duration-pill">${s.duration}</span>` : ''}
                                </div>

                                <!-- Schedule info on right -->
                                <div class="schedule-info">
                                    <div class="subject-header-row">
                                        <h4 class="subject-name" title="${s.subject_name}">${s.subject_name}</h4>
                                        ${s.subject_code ? `<span class="subject-code-badge">${s.subject_code}</span>` : ''}
                                    </div>
                                    <div class="section-text">
                                        <i class="fas fa-graduation-cap"></i>
                                        <span>${s.section_name}${s.grade_level ? ` • ${s.grade_level}` : ''}</span>
                                    </div>
                                    ${s.room && s.room !== 'N/A' ? `
                                        <div class="room-text">
                                            <i class="fas fa-map-marker-alt"></i>
                                            <span>Room ${s.room}</span>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        });

        scheduleContainer.innerHTML = html;
    }

    // ============================================
    // 5. TIMETABLE GRID VIEW (Web View Mode)
    // ============================================
    function renderTimetableGrid() {
        if (!timetableContainer) return;

        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const grouped = groupByDay(schedules);

        let html = `
            <table class="timetable-table">
                <thead>
                    <tr>
                        ${days.map(d => `<th><i class="fas fa-calendar-day"></i> ${d}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        ${days.map(d => {
                            const dayClasses = grouped[d].sort((a, b) => (a.start_raw || '').localeCompare(b.start_raw || ''));
                            if (dayClasses.length === 0) {
                                return `
                                    <td>
                                        <div style="text-align: center; color: #cbd5e1; padding: 20px 0; font-size: 11px;">
                                            <i class="fas fa-coffee" style="font-size: 16px; margin-bottom: 4px;"></i>
                                            <div>No classes</div>
                                        </div>
                                    </td>
                                `;
                            }
                            return `
                                <td>
                                    ${dayClasses.map(c => `
                                        <div class="cell-class-block">
                                            <strong>${c.subject_name}</strong>
                                            <div style="font-size:10.5px; color:#475569;">${c.section_name} • Rm ${c.room}</div>
                                            <span class="cell-time-span"><i class="fas fa-clock"></i> ${c.time_start} - ${c.time_end}</span>
                                        </div>
                                    `).join('')}
                                </td>
                            `;
                        }).join('')}
                    </tr>
                </tbody>
            </table>
        `;

        timetableContainer.innerHTML = html;
    }

    function renderEmptyState(message = 'No class program schedules assigned yet.') {
        if (!scheduleContainer) return;
        scheduleContainer.innerHTML = `
            <div class="empty-schedule-card">
                <i class="fas fa-calendar-alt empty-icon"></i>
                <h3>No Class Program Schedules Assigned</h3>
                <p>${message}</p>
            </div>
        `;
    }

    // ============================================
    // 6. STATISTICS CALCULATOR
    // ============================================
    function updateStats() {
        const total = schedules.length;
        const uniqueSecs = new Set(schedules.map(s => s.section_name).filter(Boolean)).size;
        const uniqueSubs = new Set(schedules.map(s => s.subject_name).filter(Boolean)).size;
        
        // Approximate available free periods out of standard 30 slots/week (6 periods/day * 5 days)
        const freeSlots = Math.max(0, 30 - total);

        if (totalClassesStat) totalClassesStat.textContent = total;
        if (totalSectionsStat) totalSectionsStat.textContent = uniqueSecs;
        if (totalSubjectsStat) totalSubjectsStat.textContent = uniqueSubs;
        if (freePeriodsStat) freePeriodsStat.textContent = freeSlots;
    }

    // ============================================
    // 7. EVENT HANDLERS & FILTERS
    // ============================================

    // Day Filter Chips
    dayFilterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            dayFilterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            activeDayFilter = chip.dataset.day || 'all';
            renderScheduleCards();
        });
    });

    // View Mode Toggle (Cards vs Grid)
    viewToggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            viewToggleBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentViewMode = btn.dataset.view;

            if (currentViewMode === 'cards') {
                if (scheduleContainer) scheduleContainer.style.display = 'block';
                if (timetableContainer) timetableContainer.style.display = 'none';
            } else {
                if (scheduleContainer) scheduleContainer.style.display = 'none';
                if (timetableContainer) timetableContainer.style.display = 'block';
            }
        });
    });

    // Search Box
    if (searchInput) {
        searchInput.addEventListener('input', renderScheduleCards);
    }

    // Refresh Button
    if (btnRefresh) {
        btnRefresh.addEventListener('click', async () => {
            const icon = btnRefresh.querySelector('i');
            if (icon) icon.classList.add('fa-spin');
            await Promise.all([loadSchedule(), loadSectionSchedules()]);
            setTimeout(() => {
                if (icon) icon.classList.remove('fa-spin');
                showAlert('success', 'Teacher load updated successfully.');
            }, 500);
        });
    }

    // ============================================
    // 8. STUDENT SECTION SCHEDULES (PDF & GOOGLE DOCS)
    // ============================================

    let allSectionsList = [];
    let selectedFileToUpload = null;

    // Elements
    const sectionSchedulesList = document.getElementById('sectionSchedulesList');
    const btnUploadStudentSchedule = document.getElementById('btnUploadStudentSchedule');
    const btnQuickUploadDoc = document.getElementById('btnQuickUploadDoc');

    // Modal Elements
    const modalUpload = document.getElementById('modalUploadStudentSchedule');
    const btnCloseUploadModal = document.getElementById('btnCloseUploadModal');
    const modalSelectSection = document.getElementById('modalSelectSection');
    const modalCurrentDocBox = document.getElementById('modalCurrentDocBox');
    const modalCurrentDocBadge = document.getElementById('modalCurrentDocBadge');
    const modalCurrentDocName = document.getElementById('modalCurrentDocName');
    const modalCurrentDocMeta = document.getElementById('modalCurrentDocMeta');
    const btnModalPreviewDoc = document.getElementById('btnModalPreviewDoc');
    const btnModalDeleteDoc = document.getElementById('btnModalDeleteDoc');

    // Tabs & Panels
    const tabGDocsLink = document.getElementById('tabGDocsLink');
    const tabFileUpload = document.getElementById('tabFileUpload');
    const panelGDocsLink = document.getElementById('panelGDocsLink');
    const panelFileUpload = document.getElementById('panelFileUpload');
    const modalGDocsUrl = document.getElementById('modalGDocsUrl');
    const btnModalSaveGDoc = document.getElementById('btnModalSaveGDoc');

    // Dropzone & File Input
    const modalScheduleFileInput = document.getElementById('modalScheduleFileInput');
    const modalFileDropzone = document.getElementById('modalFileDropzone');
    const modalSelectedFileStatus = document.getElementById('modalSelectedFileStatus');
    const modalSelectedFileName = document.getElementById('modalSelectedFileName');
    const btnModalUploadFile = document.getElementById('btnModalUploadFile');

    // Viewer Modal Elements
    const modalDocViewer = document.getElementById('modalTeacherDocViewer');
    const docViewerTitle = document.getElementById('teacherDocViewerTitle');
    const docViewerContent = document.getElementById('teacherDocViewerContent');
    const btnDocViewerOpenExternal = document.getElementById('btnTeacherDocViewerOpenExternal');
    const btnCloseDocViewer = document.getElementById('btnCloseTeacherDocViewer');

    function getGoogleDocsEmbedUrl(url) {
        if (!url) return '';
        if (url.includes('/edit')) {
            return url.replace(/\/edit.*$/, '/preview');
        }
        if (url.includes('drive.google.com/file/d/')) {
            return url.replace(/\/view.*$/, '/preview');
        }
        if (url.includes('docs.google.com') && !url.includes('/preview')) {
            return url.replace(/\/?$/, '/preview');
        }
        return url;
    }

    async function loadSectionSchedules() {
        if (!sectionSchedulesList) return;

        try {
            const { data: secRows, error } = await supabase
                .from('sections')
                .select('*')
                .order('name');

            if (error) throw error;
            allSectionsList = secRows || [];

            // Populate Modal Section Dropdown
            if (modalSelectSection) {
                if (allSectionsList.length === 0) {
                    modalSelectSection.innerHTML = '<option value="">No sections available</option>';
                } else {
                    const currentVal = modalSelectSection.value;
                    modalSelectSection.innerHTML = '<option value="">-- Choose Target Section --</option>' +
                        allSectionsList.map(s => {
                            const desc = [s.name, s.grade_level ? `(Grade ${s.grade_level})` : '', s.strand || ''].filter(Boolean).join(' ');
                            return `<option value="${s.id}">${desc}</option>`;
                        }).join('');

                    if (currentVal && allSectionsList.some(s => s.id === currentVal)) {
                        modalSelectSection.value = currentVal;
                    }
                }
            }

            renderSectionCards();

        } catch (err) {
            console.error('Error loading sections for class program upload:', err);
            sectionSchedulesList.innerHTML = `
                <div style="grid-column: 1 / -1; padding: 18px; text-align: center; color: var(--danger); font-size: 0.88rem;">
                    <i class="fas fa-exclamation-triangle"></i> Failed to load section class program status.
                </div>
            `;
        }
    }

    function getSectionActiveDoc(sec) {
        if (sec.schedule_doc_url) {
            const isGDocs = sec.schedule_doc_type === 'google_docs' ||
                            (sec.schedule_doc_url || '').includes('docs.google.com') ||
                            (sec.schedule_doc_url || '').includes('drive.google.com');
            const isImg = (sec.schedule_doc_type || '').startsWith('image/') ||
                          /\.(png|jpe?g|webp|gif)$/i.test(sec.schedule_doc_name || '') ||
                          (sec.schedule_doc_url && sec.schedule_doc_url.startsWith('data:image/'));

            return {
                sectionId: sec.id,
                sectionName: sec.name,
                fileName: sec.schedule_doc_name || (isGDocs ? `${sec.name} Student Load (Google Docs)` : isImg ? `${sec.name}_Student_Load.png` : 'Student_Load.pdf'),
                fileType: sec.schedule_doc_type || (isGDocs ? 'google_docs' : isImg ? 'image/png' : 'application/pdf'),
                fileData: sec.schedule_doc_url,
                url: sec.schedule_doc_url,
                isGoogleDocs: isGDocs,
                isImage: isImg,
                uploadDate: sec.schedule_doc_updated_at || new Date().toISOString(),
                uploadedBy: sec.schedule_doc_uploaded_by || 'Teacher'
            };
        }

        // Fallback to localStorage
        const raw = localStorage.getItem('hes_section_schedule_' + sec.id) ||
                    (sec.name ? localStorage.getItem('hes_section_schedule_' + sec.name.trim().toUpperCase()) : null);
        if (raw) {
            try {
                return JSON.parse(raw);
            } catch(e) {}
        }
        return null;
    }

    function renderSectionCards() {
        if (!sectionSchedulesList) return;

        if (allSectionsList.length === 0) {
            sectionSchedulesList.innerHTML = `
                <div style="grid-column: 1 / -1; padding: 24px; text-align: center; color: var(--gray-500); font-size: 0.9rem;">
                    <i class="fas fa-layer-group"></i> No sections registered in the system yet.
                </div>
            `;
            return;
        }

        sectionSchedulesList.innerHTML = allSectionsList.map(sec => {
            const doc = getSectionActiveDoc(sec);
            const isGDocs = doc && (doc.isGoogleDocs || doc.fileType === 'google_docs' || (doc.url && (doc.url.includes('docs.google.com') || doc.url.includes('drive.google.com'))));
            const isImg = doc && (doc.isImage || (doc.fileType || '').startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(doc.fileName || '') || (doc.url && doc.url.startsWith('data:image/')));
            const hasDoc = !!doc;

            let badgeHtml = '';
            if (!hasDoc) {
                badgeHtml = `<span style="background: #fffbeb; color: #b45309; border: 1px solid #fde68a; font-size: 0.72rem; padding: 3px 8px; border-radius: 6px; font-weight: 600;"><i class="fas fa-exclamation-triangle"></i> No Student Load Sent</span>`;
            } else if (isGDocs) {
                badgeHtml = `<span style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; font-size: 0.72rem; padding: 3px 8px; border-radius: 6px; font-weight: 600;"><i class="fab fa-google-drive"></i> Active Google Doc</span>`;
            } else if (isImg) {
                badgeHtml = `<span style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-size: 0.72rem; padding: 3px 8px; border-radius: 6px; font-weight: 600;"><i class="fas fa-file-image"></i> Active Schedule Image</span>`;
            } else {
                badgeHtml = `<span style="background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; font-size: 0.72rem; padding: 3px 8px; border-radius: 6px; font-weight: 600;"><i class="fas fa-file-pdf"></i> Active PDF Document</span>`;
            }

            const docTitle = hasDoc ? (doc.fileName || (isGDocs ? 'Google Docs Student Load' : isImg ? 'Schedule_Image.png' : 'Student_Load.pdf')) : 'No schedule file or image sent';
            const dateText = hasDoc && doc.uploadDate ? new Date(doc.uploadDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
            const byText = hasDoc && doc.uploadedBy ? `by ${doc.uploadedBy}` : '';

            return `
                <div style="background: #f8fafc; border: 1px solid var(--gray-200); border-radius: 10px; padding: 14px 16px; display: flex; flex-direction: column; justify-content: space-between; gap: 12px; transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.06)'" onmouseout="this.style.boxShadow='none'">
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                            <div>
                                <h4 style="margin: 0; font-size: 0.98rem; font-weight: 700; color: var(--primary);">${sec.name}</h4>
                                <div style="font-size: 0.78rem; color: var(--gray-500); margin-top: 2px;">
                                    ${sec.grade_level ? `Grade ${sec.grade_level}` : ''} ${sec.strand ? `• ${sec.strand}` : ''} ${sec.room ? `• Rm ${sec.room}` : ''}
                                </div>
                            </div>
                            ${badgeHtml}
                        </div>

                        <div style="margin-top: 10px; padding: 8px 10px; background: #fff; border-radius: 6px; border: 1px solid var(--gray-200); font-size: 0.8rem;">
                            <div style="font-weight: 600; color: var(--primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 6px;">
                                <i class="${!hasDoc ? 'fas fa-file-circle-xmark text-danger' : isGDocs ? 'fab fa-google-drive text-primary' : isImg ? 'fas fa-file-image text-success' : 'fas fa-file-pdf text-danger'}"></i>
                                <span title="${docTitle}">${docTitle}</span>
                            </div>
                            ${hasDoc ? `<div style="font-size: 0.72rem; color: var(--gray-400); margin-top: 3px;">Sent ${dateText} ${byText}</div>` : `<div style="font-size: 0.72rem; color: #b45309; margin-top: 3px;">Students have not received their schedule image or file yet</div>`}
                        </div>
                    </div>

                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                        <button type="button" class="btn-card-upload-doc" data-sec-id="${sec.id}" style="flex: 1; min-width: 100px; padding: 7px 10px; background: #2563eb; color: #fff; border: none; border-radius: 6px; font-size: 0.78rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">
                            <i class="fas fa-paper-plane"></i> ${hasDoc ? 'Change Load' : 'Send Student Load'}
                        </button>
                        ${hasDoc ? `
                            <button type="button" class="btn-card-preview-doc" data-sec-id="${sec.id}" style="padding: 7px 10px; background: #fff; color: var(--primary); border: 1px solid var(--gray-300); border-radius: 6px; font-size: 0.78rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                                <i class="fas fa-eye"></i> View
                            </button>
                            <button type="button" class="btn-card-remove-doc" data-sec-id="${sec.id}" data-sec-name="${sec.name}" style="padding: 7px 8px; background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; border-radius: 6px; font-size: 0.78rem; cursor: pointer;" title="Remove Student Load">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

        // Wire click handlers on section cards
        sectionSchedulesList.querySelectorAll('.btn-card-upload-doc').forEach(btn => {
            btn.onclick = () => openUploadModalForSection(btn.dataset.secId);
        });

        sectionSchedulesList.querySelectorAll('.btn-card-preview-doc').forEach(btn => {
            btn.onclick = () => {
                const sec = allSectionsList.find(s => s.id === btn.dataset.secId);
                if (sec) {
                    const doc = getSectionActiveDoc(sec);
                    if (doc) openDocPreviewModal(doc);
                }
            };
        });

        sectionSchedulesList.querySelectorAll('.btn-card-remove-doc').forEach(btn => {
            btn.onclick = () => removeSectionSchedule(btn.dataset.secId, btn.dataset.secName);
        });
    }

    function openUploadModalForSection(secId = '') {
        if (!modalUpload) return;

        if (modalSelectSection && secId) {
            modalSelectSection.value = secId;
        }

        updateModalCurrentDocBox();

        // Default to Image / File Upload tab since teachers most commonly upload schedule images
        activateFileUploadTab();

        modalUpload.style.display = 'flex';
    }

    function updateModalCurrentDocBox() {
        if (!modalSelectSection || !modalCurrentDocBox) return;
        const secId = modalSelectSection.value;
        const sec = allSectionsList.find(s => s.id === secId);

        if (!sec) {
            modalCurrentDocBox.style.display = 'none';
            return;
        }

        const doc = getSectionActiveDoc(sec);
        if (doc) {
            modalCurrentDocBox.style.display = 'block';
            const isGDocs = doc.isGoogleDocs || doc.fileType === 'google_docs' || (doc.url && (doc.url.includes('docs.google.com') || doc.url.includes('drive.google.com')));
            const isImg = doc.isImage || (doc.fileType || '').startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(doc.fileName || '') || (doc.url && doc.url.startsWith('data:image/'));
            
            if (modalCurrentDocBadge) {
                modalCurrentDocBadge.textContent = isGDocs ? 'Active Google Doc' : isImg ? 'Active Schedule Image' : 'Active PDF File';
                modalCurrentDocBadge.style.background = isGDocs ? '#eff6ff' : isImg ? '#ecfdf5' : '#fef2f2';
                modalCurrentDocBadge.style.color = isGDocs ? '#1d4ed8' : isImg ? '#047857' : '#b91c1c';
            }

            if (modalCurrentDocName) {
                modalCurrentDocName.textContent = doc.fileName || (isGDocs ? 'Google Docs Student Load' : isImg ? 'Schedule_Image.png' : 'Student_Load.pdf');
            }

            if (modalCurrentDocMeta) {
                const dStr = doc.uploadDate ? new Date(doc.uploadDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently';
                modalCurrentDocMeta.textContent = `Assigned ${dStr} by ${doc.uploadedBy || 'Teacher'}`;
            }

            if (btnModalPreviewDoc) {
                btnModalPreviewDoc.onclick = () => openDocPreviewModal(doc);
            }

            if (btnModalDeleteDoc) {
                btnModalDeleteDoc.onclick = () => removeSectionSchedule(sec.id, sec.name);
            }
        } else {
            modalCurrentDocBox.style.display = 'none';
        }
    }

    function activateGDocsTab() {
        if (tabGDocsLink) {
            tabGDocsLink.style.fontWeight = '700';
            tabGDocsLink.style.color = '#2563eb';
            tabGDocsLink.style.borderBottom = '3px solid #2563eb';
        }
        if (tabFileUpload) {
            tabFileUpload.style.fontWeight = '600';
            tabFileUpload.style.color = 'var(--gray-500)';
            tabFileUpload.style.borderBottom = 'none';
        }
        if (panelGDocsLink) panelGDocsLink.style.display = 'block';
        if (panelFileUpload) panelFileUpload.style.display = 'none';
    }

    function activateFileUploadTab() {
        if (tabFileUpload) {
            tabFileUpload.style.fontWeight = '700';
            tabFileUpload.style.color = '#059669';
            tabFileUpload.style.borderBottom = '3px solid #059669';
        }
        if (tabGDocsLink) {
            tabGDocsLink.style.fontWeight = '600';
            tabGDocsLink.style.color = 'var(--gray-500)';
            tabGDocsLink.style.borderBottom = 'none';
        }
        if (panelFileUpload) panelFileUpload.style.display = 'block';
        if (panelGDocsLink) panelGDocsLink.style.display = 'none';
    }

    function openDocPreviewModal(doc) {
        if (!modalDocViewer || !docViewerContent) return;

        const isGDocs = doc.isGoogleDocs || doc.fileType === 'google_docs' || (doc.url && (doc.url.includes('docs.google.com') || doc.url.includes('drive.google.com')));
        const docUrl = doc.url || doc.fileData || '';

        if (docViewerTitle) {
            const isImg = doc.isImage || (doc.fileType || '').startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(doc.fileName || '') || (doc.url && doc.url.startsWith('data:image/'));
            docViewerTitle.innerHTML = isGDocs ? `<i class="fab fa-google-drive" style="color: #60a5fa;"></i> ${doc.fileName || 'Google Docs Student Load'}` : isImg ? `<i class="fas fa-file-image" style="color: #10b981;"></i> ${doc.fileName || 'Schedule Image'}` : `<i class="fas fa-file-pdf" style="color: #ef4444;"></i> ${doc.fileName || 'PDF Student Load'}`;
        }

        if (btnDocViewerOpenExternal) {
            btnDocViewerOpenExternal.href = docUrl;
            btnDocViewerOpenExternal.style.display = docUrl ? 'inline-flex' : 'none';
        }

        if (isGDocs) {
            const previewUrl = getGoogleDocsEmbedUrl(docUrl);
            docViewerContent.innerHTML = `<iframe src="${previewUrl}" style="width: 100%; height: 100%; border: none; border-radius: 8px;" allowfullscreen></iframe>`;
        } else {
            const isPdf = (doc.fileType || '').includes('pdf') || (doc.fileName || '').toLowerCase().endsWith('.pdf');
            if (isPdf) {
                docViewerContent.innerHTML = `<iframe src="${docUrl}" style="width: 100%; height: 100%; border: none; border-radius: 8px;"></iframe>`;
            } else {
                docViewerContent.innerHTML = `<img src="${docUrl}" alt="Student Load Schedule Preview" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px;">`;
            }
        }

        modalDocViewer.style.display = 'flex';
    }

    async function removeSectionSchedule(secId, secName) {
        if (!confirm(`Are you sure you want to remove the uploaded student load schedule for section "${secName}"?`)) {
            return;
        }

        try {
            await supabase.from('sections').update({
                schedule_doc_url: null,
                schedule_doc_name: null,
                schedule_doc_type: null,
                schedule_doc_uploaded_by: null,
                schedule_doc_updated_at: new Date().toISOString()
            }).eq('id', secId);

            localStorage.removeItem('hes_section_schedule_' + secId);
            if (secName) localStorage.removeItem('hes_section_schedule_' + secName.trim().toUpperCase());
            localStorage.setItem('hes_section_schedule_last_sync', Date.now().toString());

            showAlert('success', `Student load schedule removed for section "${secName}".`);
            await loadSectionSchedules();
            updateModalCurrentDocBox();

        } catch(err) {
            console.error('Error removing section student load:', err);
            showAlert('error', 'Failed to remove student load schedule: ' + err.message);
        }
    }

    // Modal Events Wiring
    if (btnUploadStudentSchedule) btnUploadStudentSchedule.onclick = () => openUploadModalForSection();
    if (btnQuickUploadDoc) btnQuickUploadDoc.onclick = () => openUploadModalForSection();
    if (btnCloseUploadModal && modalUpload) btnCloseUploadModal.onclick = () => { modalUpload.style.display = 'none'; };
    if (btnCloseDocViewer && modalDocViewer) btnCloseDocViewer.onclick = () => { modalDocViewer.style.display = 'none'; };

    if (modalSelectSection) {
        modalSelectSection.addEventListener('change', updateModalCurrentDocBox);
    }

    if (tabGDocsLink) tabGDocsLink.onclick = activateGDocsTab;
    if (tabFileUpload) tabFileUpload.onclick = activateFileUploadTab;

    // Save Google Docs Link
    if (btnModalSaveGDoc) {
        btnModalSaveGDoc.onclick = async () => {
            const secId = modalSelectSection?.value;
            if (!secId) {
                showAlert('warning', 'Please select a target section first.');
                return;
            }

            const sec = allSectionsList.find(s => s.id === secId);
            const secName = sec?.name || 'Section';
            const url = (modalGDocsUrl?.value || '').trim();

            if (!url) {
                showAlert('warning', 'Please enter a valid Google Docs or Google Drive URL.');
                return;
            }

            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                showAlert('warning', 'URL must start with https:// or http://');
                return;
            }

            btnModalSaveGDoc.disabled = true;
            btnModalSaveGDoc.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publishing...';

            const payload = {
                sectionId: secId,
                sectionName: secName,
                fileName: `${secName} Student Load (Google Docs)`,
                fileType: 'google_docs',
                fileData: url,
                url: url,
                isGoogleDocs: true,
                uploadDate: new Date().toISOString(),
                uploadedBy: userFullName
            };

            try {
                // 1. Supabase update
                await supabase.from('sections').update({
                    schedule_doc_url: url,
                    schedule_doc_name: `${secName} Student Load (Google Docs)`,
                    schedule_doc_type: 'google_docs',
                    schedule_doc_uploaded_by: userFullName,
                    schedule_doc_updated_at: new Date().toISOString()
                }).eq('id', secId);

                // 2. localStorage
                localStorage.setItem('hes_section_schedule_' + secId, JSON.stringify(payload));
                localStorage.setItem('hes_section_schedule_' + secName.trim().toUpperCase(), JSON.stringify(payload));
                localStorage.setItem('hes_section_schedule_last_sync', Date.now().toString());

                showAlert('success', `Google Docs student load published for "${secName}"! Students can access it now.`);
                if (modalGDocsUrl) modalGDocsUrl.value = '';
                if (modalUpload) modalUpload.style.display = 'none';

                await loadSectionSchedules();

            } catch(err) {
                console.error('Error saving Google Doc link:', err);
                showAlert('error', 'Failed to save Google Doc: ' + err.message);
            } finally {
                btnModalSaveGDoc.disabled = false;
                btnModalSaveGDoc.innerHTML = '<i class="fas fa-link"></i> Save & Publish Student Load Link';
            }
        };
    }

    // Dropzone & File Pickers
    if (modalFileDropzone && modalScheduleFileInput) {
        modalFileDropzone.onclick = () => modalScheduleFileInput.click();

        modalScheduleFileInput.onchange = (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) handleFileSelected(file);
        };

        modalFileDropzone.ondragover = (e) => {
            e.preventDefault();
            modalFileDropzone.style.borderColor = '#2563eb';
            modalFileDropzone.style.background = '#e0f2fe';
        };

        modalFileDropzone.ondragleave = () => {
            modalFileDropzone.style.borderColor = '#93c5fd';
            modalFileDropzone.style.background = '#f0f7ff';
        };

        modalFileDropzone.ondrop = (e) => {
            e.preventDefault();
            modalFileDropzone.style.borderColor = '#93c5fd';
            modalFileDropzone.style.background = '#f0f7ff';
            const file = e.dataTransfer.files && e.dataTransfer.files[0];
            if (file) handleFileSelected(file);
        };
    }

    function handleFileSelected(file) {
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            showAlert('warning', 'File is larger than 10MB. Please choose a smaller file.');
            return;
        }

        selectedFileToUpload = file;
        if (modalSelectedFileStatus) modalSelectedFileStatus.style.display = 'flex';
        if (modalSelectedFileName) modalSelectedFileName.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    }

    // Upload & Publish File
    if (btnModalUploadFile) {
        btnModalUploadFile.onclick = async () => {
            const secId = modalSelectSection?.value;
            if (!secId) {
                showAlert('warning', 'Please select a target section first.');
                return;
            }

            if (!selectedFileToUpload) {
                showAlert('warning', 'Please select a PDF or image file to upload.');
                return;
            }

            const sec = allSectionsList.find(s => s.id === secId);
            const secName = sec?.name || 'Section';

            btnModalUploadFile.disabled = true;
            btnModalUploadFile.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Reading & Uploading...';

            const reader = new FileReader();
            reader.onload = async function(evt) {
                const dataUrl = evt.target.result;
                const fileType = selectedFileToUpload.type || (selectedFileToUpload.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

                const payload = {
                    sectionId: secId,
                    sectionName: secName,
                    fileName: selectedFileToUpload.name,
                    fileType: fileType,
                    fileSize: selectedFileToUpload.size,
                    fileData: dataUrl,
                    url: dataUrl,
                    uploadDate: new Date().toISOString(),
                    uploadedBy: userFullName
                };

                try {
                    // 1. Supabase update
                    await supabase.from('sections').update({
                        schedule_doc_url: dataUrl,
                        schedule_doc_name: selectedFileToUpload.name,
                        schedule_doc_type: fileType,
                        schedule_doc_uploaded_by: userFullName,
                        schedule_doc_updated_at: new Date().toISOString()
                    }).eq('id', secId);

                    // 2. localStorage
                    localStorage.setItem('hes_section_schedule_' + secId, JSON.stringify(payload));
                    localStorage.setItem('hes_section_schedule_' + secName.trim().toUpperCase(), JSON.stringify(payload));
                    localStorage.setItem('hes_section_schedule_last_sync', Date.now().toString());

                    const isImg = (selectedFileToUpload.type || '').startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(selectedFileToUpload.name);
                    showAlert('success', `Official student load schedule ${isImg ? 'image' : 'file'} sent to "${secName}"!`);
                    selectedFileToUpload = null;
                    if (modalScheduleFileInput) modalScheduleFileInput.value = '';
                    if (modalSelectedFileStatus) modalSelectedFileStatus.style.display = 'none';
                    if (modalUpload) modalUpload.style.display = 'none';

                    await loadSectionSchedules();

                } catch(err) {
                    console.error('Error uploading student load file:', err);
                    showAlert('error', 'Failed to upload student load file: ' + err.message);
                } finally {
                    btnModalUploadFile.disabled = false;
                    btnModalUploadFile.innerHTML = '<i class="fas fa-paper-plane"></i> Send & Publish Student Load';
                }
            };

            reader.readAsDataURL(selectedFileToUpload);
        };
    }

    // Initialize
    await Promise.all([loadSchedule(), loadSectionSchedules()]);
});