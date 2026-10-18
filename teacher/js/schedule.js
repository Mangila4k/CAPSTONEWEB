/**
 * Teacher Load & Section Class Programs Script
 * Dynamic Supabase Integration
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
    let currentViewMode = 'cards';
    let allSectionsList = [];
    let myAssignedSections = [];

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

    if (dateBadge) {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateBadge.innerHTML = `<i class="fas fa-calendar-alt"></i> ${now.toLocaleDateString('en-US', options)}`;
    }

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

    const formatTime = (t) => {
        if (!t) return 'N/A';
        if (t.includes('AM') || t.includes('PM')) return t;
        const [h, m] = t.split(':');
        const hour = parseInt(h, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const h12 = hour % 12 || 12;
        return `${h12}:${m} ${ampm}`;
    };

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
            let targetUserId = currentUserId;
            if (userEmail) {
                const { data: userData } = await supabase.from('users').select('*').eq('email', userEmail).maybeSingle();
                if (userData) targetUserId = userData.id;
            }

            const { data: teacherData, error: tErr } = await supabase
                .from('teachers')
                .select('*')
                .or(`user_id.eq.${targetUserId},id.eq.${targetUserId}`)
                .maybeSingle();

            if (!teacherData) {
                renderEmptyState('No teacher record found. Please ensure your teacher profile is registered.');
                return;
            }

            teacherRecord = teacherData;

            const { data: scheduleRows, error: sErr } = await supabase
                .from('schedules')
                .select('*')
                .eq('teacher_id', teacherRecord.id);

            if (sErr) throw sErr;

            const subjectIds = [...new Set((scheduleRows || []).map(s => s.subject_id).filter(Boolean))];
            const sectionIds = [...new Set((scheduleRows || []).map(s => s.section_id).filter(Boolean))];

            const subjectMap = {};
            const sectionMap = {};
            const promises = [];

            if (subjectIds.length > 0) {
                promises.push(
                    supabase.from('subjects').select('id, name, code, grade_level').in('id', subjectIds)
                        .then(({ data: subs }) => { (subs || []).forEach(s => { subjectMap[s.id] = s; }); })
                );
            }
            if (sectionIds.length > 0) {
                promises.push(
                    supabase.from('sections').select('*').in('id', sectionIds)
                        .then(({ data: secs }) => { (secs || []).forEach(s => { sectionMap[s.id] = s; }); })
                );
            }

            await Promise.all(promises);

            if (scheduleRows && scheduleRows.length > 0) {
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
            } else {
                schedules = [];
            }

            updateStats();
            renderScheduleCards();
            renderTimetableGrid();

        } catch (err) {
            console.error('❌ Error loading teacher load:', err);
            renderEmptyState('Failed to load teacher load from database.');
        }
    }

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
            if (activeDayFilter !== 'all' && s.day.toLowerCase() !== activeDayFilter.toLowerCase()) return false;
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
            html += `
                <div class="day-section">
                    <div class="day-section-header">
                        <div class="day-section-title"><i class="fas fa-calendar-day" style="color: #1B2A4A;"></i> ${day}</div>
                        <span class="day-badge-count">${classesForDay.length} class${classesForDay.length !== 1 ? 'es' : ''}</span>
                    </div>
                    <div class="schedule-cards-grid">
                        ${classesForDay.map(s => `
                            <div class="schedule-item-card">
                                <div class="time-container">
                                    <div class="time-start">${s.time_start}</div>
                                    <div class="time-end">${s.time_end}</div>
                                    ${s.duration ? `<span class="duration-pill">${s.duration}</span>` : ''}
                                </div>
                                <div class="schedule-info">
                                    <div class="subject-header-row">
                                        <h4 class="subject-name" title="${s.subject_name}">${s.subject_name}</h4>
                                        ${s.subject_code ? `<span class="subject-code-badge">${s.subject_code}</span>` : ''}
                                    </div>
                                    <div class="section-text"><i class="fas fa-graduation-cap"></i> <span>${s.section_name}${s.grade_level ? ` • ${s.grade_level}` : ''}</span></div>
                                    ${s.room && s.room !== 'N/A' ? `<div class="room-text"><i class="fas fa-map-marker-alt"></i> <span>Room ${s.room}</span></div>` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        });
        scheduleContainer.innerHTML = html;
    }

    function renderTimetableGrid() {
        if (!timetableContainer) return;
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const grouped = groupByDay(schedules);
        let html = `
            <table class="timetable-table">
                <thead><tr>${days.map(d => `<th><i class="fas fa-calendar-day"></i> ${d}</th>`).join('')}</tr></thead>
                <tbody>
                    <tr>
                        ${days.map(d => {
                            const dayClasses = grouped[d].sort((a, b) => (a.start_raw || '').localeCompare(b.start_raw || ''));
                            if (dayClasses.length === 0) {
                                return `<td><div style="text-align: center; color: #cbd5e1; padding: 20px 0; font-size: 11px;"><i class="fas fa-coffee" style="font-size: 16px; margin-bottom: 4px;"></i><div>No classes</div></div></td>`;
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

    function updateStats() {
        const total = schedules.length;
        const uniqueSecs = new Set(schedules.map(s => s.section_name).filter(Boolean)).size;
        const uniqueSubs = new Set(schedules.map(s => s.subject_name).filter(Boolean)).size;
        const freeSlots = Math.max(0, 30 - total);

        if (totalClassesStat) totalClassesStat.textContent = total;
        if (totalSectionsStat) totalSectionsStat.textContent = uniqueSecs;
        if (totalSubjectsStat) totalSubjectsStat.textContent = uniqueSubs;
        if (freePeriodsStat) freePeriodsStat.textContent = freeSlots;
    }

    dayFilterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            dayFilterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            activeDayFilter = chip.dataset.day || 'all';
            renderScheduleCards();
        });
    });

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

    if (searchInput) searchInput.addEventListener('input', renderScheduleCards);

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
    // 8. STUDENT SECTION SCHEDULES (FETCHED FROM ADMIN)
    // ============================================

    const sectionSchedulesList = document.getElementById('sectionSchedulesList');
    
    // Viewer Modal Elements
    const modalDocViewer = document.getElementById('modalTeacherDocViewer');
    const docViewerTitle = document.getElementById('teacherDocViewerTitle');
    const docViewerContent = document.getElementById('teacherDocViewerContent');
    const btnDocViewerOpenExternal = document.getElementById('btnTeacherDocViewerOpenExternal');
    const btnCloseDocViewer = document.getElementById('btnCloseTeacherDocViewer');

    function getGoogleDocsEmbedUrl(url) {
        if (!url) return '';
        if (url.includes('/edit')) return url.replace(/\/edit.*$/, '/preview');
        if (url.includes('drive.google.com/file/d/')) return url.replace(/\/view.*$/, '/preview');
        if (url.includes('docs.google.com') && !url.includes('/preview')) return url.replace(/\/?$/, '/preview');
        return url;
    }

    async function loadSectionSchedules() {
        if (!sectionSchedulesList) return;

        try {
            const { data: secRows, error } = await supabase.from('sections').select('*').order('name');
            if (error) throw error;
            allSectionsList = secRows || [];

            const teacherSecNames = new Set(schedules.map(s => s.section_name));
            myAssignedSections = allSectionsList.filter(sec => {
                if (sec.adviser_id === teacherRecord?.id || sec.adviser_name === userFullName) return true;
                if (teacherSecNames.has(sec.name)) return true;
                return false;
            });

            if (myAssignedSections.length === 0) myAssignedSections = allSectionsList;

            renderSectionCards();
        } catch (err) {
            console.error('Error loading sections:', err);
            sectionSchedulesList.innerHTML = `<div style="grid-column: 1 / -1; padding: 18px; text-align: center; color: var(--danger); font-size: 0.88rem;"><i class="fas fa-exclamation-triangle"></i> Failed to load section class program status.</div>`;
        }
    }

    function renderSectionCards() {
        if (!sectionSchedulesList) return;

        if (myAssignedSections.length === 0) {
            sectionSchedulesList.innerHTML = `<div style="grid-column: 1 / -1; padding: 24px; text-align: center; color: var(--gray-500); font-size: 0.9rem;"><i class="fas fa-layer-group"></i> No sections assigned to you yet.</div>`;
            return;
        }

        sectionSchedulesList.innerHTML = myAssignedSections.map(sec => {
            const hasDoc = !!sec.schedule_doc_url;
            const isGDocs = (sec.schedule_doc_type === 'google_docs') || (sec.schedule_doc_url || '').includes('docs.google.com') || (sec.schedule_doc_url || '').includes('drive.google.com');
            const isImg = (sec.schedule_doc_type || '').startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(sec.schedule_doc_name || '') || (sec.schedule_doc_url && sec.schedule_doc_url.startsWith('data:image/'));
            const isShared = !!sec.shared_at;
            
            let badgeHtml = '';
            if (!hasDoc) {
                badgeHtml = `<span style="background: #fffbeb; color: #b45309; border: 1px solid #fde68a; font-size: 0.72rem; padding: 3px 8px; border-radius: 6px; font-weight: 600;"><i class="fas fa-exclamation-triangle"></i> Waiting for Admin Upload</span>`;
            } else if (isShared) {
                badgeHtml = `<span style="background: #dcfce7; color: #047857; border: 1px solid #a7f3d0; font-size: 0.72rem; padding: 3px 8px; border-radius: 6px; font-weight: 600;"><i class="fas fa-check-circle"></i> Shared to Students</span>`;
            } else if (isGDocs) {
                badgeHtml = `<span style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; font-size: 0.72rem; padding: 3px 8px; border-radius: 6px; font-weight: 600;"><i class="fab fa-google-drive"></i> Ready to Share</span>`;
            } else if (isImg) {
                badgeHtml = `<span style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-size: 0.72rem; padding: 3px 8px; border-radius: 6px; font-weight: 600;"><i class="fas fa-file-image"></i> Ready to Share</span>`;
            } else {
                badgeHtml = `<span style="background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; font-size: 0.72rem; padding: 3px 8px; border-radius: 6px; font-weight: 600;"><i class="fas fa-file-pdf"></i> Ready to Share</span>`;
            }

            const docTitle = hasDoc ? (sec.schedule_doc_name || 'Official Section Workload') : 'No document uploaded yet';
            const uploaderName = sec.schedule_doc_uploaded_by || 'Admin';
            const dateText = hasDoc && sec.schedule_doc_updated_at ? new Date(sec.schedule_doc_updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
            
            let sharedText = '';
            if (isShared) {
                const sharedDate = new Date(sec.shared_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute:'2-digit' });
                sharedText = `<div style="font-size: 0.72rem; color: #047857; margin-top: 4px; font-weight: 600;"><i class="fas fa-paper-plane"></i> Shared by ${sec.shared_by || 'Teacher'} on ${sharedDate}</div>`;
            }

            return `
                <div style="background: #f8fafc; border: 1px solid var(--gray-200); border-radius: 10px; padding: 14px 16px; display: flex; flex-direction: column; justify-content: space-between; gap: 12px; transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.06)'" onmouseout="this.style.boxShadow='none'">
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                            <div>
                                <h4 style="margin: 0; font-size: 0.98rem; font-weight: 700; color: var(--primary);">${sec.name}</h4>
                                <div style="font-size: 0.78rem; color: var(--gray-500); margin-top: 2px;">
                                    ${sec.grade_level ? `Grade ${sec.grade_level}` : ''} ${sec.strand ? `• ${sec.strand}` : ''}
                                </div>
                            </div>
                            ${badgeHtml}
                        </div>

                        <div style="margin-top: 10px; padding: 8px 10px; background: #fff; border-radius: 6px; border: 1px solid var(--gray-200); font-size: 0.8rem;">
                            <div style="font-weight: 600; color: var(--primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 6px;">
                                <i class="${!hasDoc ? 'fas fa-file-circle-xmark text-danger' : isGDocs ? 'fab fa-google-drive text-primary' : isImg ? 'fas fa-file-image text-success' : 'fas fa-file-pdf text-danger'}"></i>
                                <span title="${docTitle}">${docTitle}</span>
                            </div>
                            ${hasDoc ? `<div style="font-size: 0.72rem; color: var(--gray-400); margin-top: 3px;">Uploaded by ${uploaderName} on ${dateText}</div>` : `<div style="font-size: 0.72rem; color: #b45309; margin-top: 3px;">Admin has not uploaded the workload for this section.</div>`}
                            ${sharedText}
                        </div>
                    </div>

                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                        ${hasDoc ? `
                            <button type="button" class="btn-card-preview-doc" data-sec-id="${sec.id}" style="flex: 1; padding: 7px 10px; background: #2563eb; color: #fff; border: none; border-radius: 6px; font-size: 0.78rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">
                                <i class="fas fa-eye"></i> View
                            </button>
                            ${!isShared ? `
                                <button type="button" class="btn-card-share-doc" data-sec-id="${sec.id}" style="flex: 1; padding: 7px 10px; background: #059669; color: #fff; border: none; border-radius: 6px; font-size: 0.78rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">
                                    <i class="fas fa-paper-plane"></i> Share
                                </button>
                            ` : `
                                <button type="button" style="flex: 1; padding: 7px 10px; background: #d1fae5; color: #047857; border: 1px solid #a7f3d0; border-radius: 6px; font-size: 0.78rem; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 4px; cursor: default;">
                                    <i class="fas fa-check-circle"></i> Shared
                                </button>
                            `}
                        ` : `
                            <div style="flex: 1; padding: 7px 10px; background: #f1f5f9; color: #94a3b8; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.78rem; font-weight: 600; text-align: center;">
                                <i class="fas fa-hourglass-half"></i> Waiting for Admin Upload
                            </div>
                        `}
                    </div>
                </div>
            `;
        }).join('');

        sectionSchedulesList.querySelectorAll('.btn-card-preview-doc').forEach(btn => {
            btn.onclick = () => {
                const sec = myAssignedSections.find(s => s.id === btn.dataset.secId);
                if (sec && sec.schedule_doc_url) openDocPreviewModal(sec);
            };
        });

        sectionSchedulesList.querySelectorAll('.btn-card-share-doc').forEach(btn => {
            btn.onclick = async () => {
                const secId = btn.dataset.secId;
                const sec = myAssignedSections.find(s => s.id === secId);
                if (!sec || !sec.schedule_doc_url) return;
                
                if (!confirm(`Share the official workload to all students in "${sec.name}"?`)) return;

                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sharing...';
                btn.disabled = true;

                try {
                    const timestamp = new Date().toISOString();
                    await supabase.from('sections').update({
                        shared_at: timestamp,
                        shared_by: userFullName
                    }).eq('id', secId);

                    showAlert('success', `Workload successfully shared to students in ${sec.name}!`);
                    await loadSectionSchedules();
                } catch(err) {
                    console.error('Error sharing workload:', err);
                    showAlert('error', 'Failed to share workload: ' + err.message);
                    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Share';
                    btn.disabled = false;
                }
            };
        });
    }

    function openDocPreviewModal(sec) {
        if (!modalDocViewer || !docViewerContent) return;

        const docUrl = sec.schedule_doc_url;
        const isGDocs = (sec.schedule_doc_type === 'google_docs') || docUrl.includes('docs.google.com') || docUrl.includes('drive.google.com');
        const isPdf = (sec.schedule_doc_type || '').includes('pdf') || (sec.schedule_doc_name || '').toLowerCase().endsWith('.pdf');
        
        if (docViewerTitle) {
            docViewerTitle.innerHTML = isGDocs 
                ? `<i class="fab fa-google-drive" style="color: #4285F4;"></i> ${sec.name} Workload`
                : isPdf 
                    ? `<i class="fas fa-file-pdf" style="color: #ef4444;"></i> ${sec.name} Workload`
                    : `<i class="fas fa-file-image" style="color: #10b981;"></i> ${sec.name} Workload`;
        }

        if (btnDocViewerOpenExternal) {
            btnDocViewerOpenExternal.href = docUrl;
            btnDocViewerOpenExternal.style.display = 'inline-flex';
        }

        if (isGDocs) {
            const previewUrl = getGoogleDocsEmbedUrl(docUrl);
            docViewerContent.innerHTML = `<iframe src="${previewUrl}" style="width: 100%; height: 100%; border: none; border-radius: 8px;" allowfullscreen></iframe>`;
        } else if (isPdf) {
            docViewerContent.innerHTML = `<iframe src="${docUrl}" style="width: 100%; height: 100%; border: none; border-radius: 8px;"></iframe>`;
        } else {
            docViewerContent.innerHTML = `<img src="${docUrl}" alt="Student Load Schedule Preview" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px;">`;
        }

        modalDocViewer.style.display = 'flex';
    }

    if (btnCloseDocViewer && modalDocViewer) {
        btnCloseDocViewer.onclick = () => { modalDocViewer.style.display = 'none'; };
    }

    // Initialize
    await loadSchedule();
    await loadSectionSchedules();
});