// ===== CREATE SCHEDULE JAVASCRIPT (SUPABASE POWERED) =====
import { supabase } from '../../supabase/config.js';

document.addEventListener('DOMContentLoaded', async function() {
    // DOM Elements
    const alertContainer = document.getElementById('alertContainer');
    const scheduleForm = document.getElementById('scheduleForm');
    const dayTabs = document.querySelectorAll('.day-tab');
    const daySchedules = document.querySelectorAll('.day-schedule');
    const scheduleCount = document.getElementById('scheduleCount');
    const weeklyBody = document.getElementById('weeklyBody');
    const weeklyCount = document.getElementById('weeklyCount');
    const conflictWarning = document.getElementById('conflictWarning');
    const conflictMessage = document.getElementById('conflictMessage');

    const subjectSelect = document.getElementById('subject_id');
    const teacherSelect = document.getElementById('teacher_id');
    const daySelect = document.getElementById('day_id');
    const timeSlotSelect = document.getElementById('time_slot_id');

    // Standard days & slots
    const days = [
        { id: 1, name: 'Monday' },
        { id: 2, name: 'Tuesday' },
        { id: 3, name: 'Wednesday' },
        { id: 4, name: 'Thursday' },
        { id: 5, name: 'Friday' }
    ];

    const timeSlots = [
        { id: 1, start: '07:00:00', end: '08:00:00', label: '7:00 AM - 8:00 AM' },
        { id: 2, start: '08:00:00', end: '09:00:00', label: '8:00 AM - 9:00 AM' },
        { id: 3, start: '09:00:00', end: '10:00:00', label: '9:00 AM - 10:00 AM' },
        { id: 4, start: '10:00:00', end: '11:00:00', label: '10:00 AM - 11:00 AM' },
        { id: 5, start: '11:00:00', end: '12:00:00', label: '11:00 AM - 12:00 PM' },
        { id: 6, start: '13:00:00', end: '14:00:00', label: '1:00 PM - 2:00 PM' },
        { id: 7, start: '14:00:00', end: '15:00:00', label: '2:00 PM - 3:00 PM' },
        { id: 8, start: '15:00:00', end: '16:00:00', label: '3:00 PM - 4:00 PM' },
        { id: 9, start: '16:00:00', end: '17:00:00', label: '4:00 PM - 5:00 PM' }
    ];

    // State
    let sectionData = null;
    let subjects = [];
    let teachers = [];
    let sectionSchedules = [];
    let allSchedules = [];

    // Alert helper
    function showAlert(message, type = 'error') {
        if (!alertContainer) return;
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        const icon = type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle';
        alertDiv.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
        alertContainer.appendChild(alertDiv);

        setTimeout(() => {
            alertDiv.style.opacity = '0';
            setTimeout(() => {
                alertDiv.remove();
            }, 300);
        }, 5000);
    }

    function formatTime(timeString) {
        if (!timeString) return '';
        const date = new Date(`2000-01-01T${timeString}`);
        return isNaN(date.getTime()) ? timeString : date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }

    // ===== INIT =====
    async function init() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            let sectionId = urlParams.get('section_id') || urlParams.get('id');

            // 1. If no section_id, grab the first section
            if (!sectionId) {
                const { data: firstSec } = await supabase
                    .from('sections')
                    .select('id')
                    .limit(1)
                    .maybeSingle();

                if (firstSec) {
                    sectionId = firstSec.id;
                }
            }

            if (!sectionId) {
                showAlert('No sections found in database. Please create a section first.', 'error');
                return;
            }

            // 2. Fetch section info
            const { data: sec, error: secErr } = await supabase
                .from('sections')
                .select('*')
                .eq('id', sectionId)
                .single();

            if (secErr || !sec) throw new Error('Section not found');
            sectionData = sec;

            // Resolve adviser
            let adviserName = (sec.adviser_name || '').trim();
            if (sec.adviser_id) {
                const { data: tData } = await supabase
                    .from('teachers')
                    .select('id, user_id, users:user_id(first_name, last_name, email)')
                    .or(`id.eq.${sec.adviser_id},user_id.eq.${sec.adviser_id}`)
                    .maybeSingle();

                if (tData && tData.users) {
                    const resolved = `${tData.users.first_name || ''} ${tData.users.last_name || ''}`.trim() || tData.users.email;
                    if (resolved) adviserName = resolved;
                }
            }
            if (!adviserName) {
                adviserName = 'Not Assigned';
            }
            sectionData.adviser_name = adviserName;

            updateSectionInfo();

            // 3. Load Subjects
            const { data: subData } = await supabase
                .from('subjects')
                .select('*')
                .order('name', { ascending: true });

            subjects = subData || [];
            if (subjectSelect) {
                subjectSelect.innerHTML = '<option value="">Select Subject</option>' +
                    subjects.map(s => `<option value="${s.id}">${s.name} (${s.code || s.grade_level || 'Core'})</option>`).join('');
            }

            // 4. Load Teachers
            const { data: tchData } = await supabase
                .from('teachers')
                .select(`
                    id,
                    user_id,
                    employee_id,
                    users:user_id (id, first_name, last_name, email)
                `);

            teachers = (tchData || []).map(t => {
                const u = t.users || {};
                const name = (u.first_name || u.last_name)
                    ? `${u.first_name || ''} ${u.last_name || ''}`.trim()
                    : (u.email || t.employee_id || 'Teacher');
                return {
                    id: t.id,
                    user_id: t.user_id,
                    name: name
                };
            });

            if (teacherSelect) {
                teacherSelect.innerHTML = '<option value="">Select Teacher</option>' +
                    teachers.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
            }

            // 5. Populate Days & TimeSlots dropdowns
            if (daySelect) {
                daySelect.innerHTML = '<option value="">Select Day</option>' +
                    days.map(d => `<option value="${d.name}">${d.name}</option>`).join('');
            }

            if (timeSlotSelect) {
                timeSlotSelect.innerHTML = '<option value="">Select Time Slot</option>' +
                    timeSlots.map(ts => `<option value="${ts.id}">${ts.label}</option>`).join('');
            }

            // 6. Load Schedules
            await loadSchedules();
        } catch (err) {
            console.error('Error initializing schedule page:', err);
            showAlert('Failed to load schedule data: ' + err.message, 'error');
        }
    }

    function updateSectionInfo() {
        if (!sectionData) return;
        const nameDisp = document.getElementById('sectionNameDisplay');
        const titleDisp = document.getElementById('sectionTitle');
        const gradeDisp = document.getElementById('gradeName');
        const advDisp = document.getElementById('adviserName');
        const syDisp = document.getElementById('schoolYearDisplay');

        if (nameDisp) nameDisp.textContent = sectionData.name;
        if (titleDisp) titleDisp.textContent = sectionData.name;
        if (gradeDisp) gradeDisp.textContent = sectionData.grade_level || 'Grade Level';
        if (advDisp) advDisp.textContent = sectionData.adviser_name || 'Not Assigned';
        if (syDisp) syDisp.textContent = '2026-2027';
    }

    async function loadSchedules() {
        try {
            // Load all schedules for conflict checking
            const { data: allData, error: allErr } = await supabase
                .from('schedules')
                .select('*');

            allSchedules = allData || [];

            // Filter for current section
            sectionSchedules = allSchedules.filter(s => s.section_id === sectionData.id);

            renderDaySchedules();
            renderWeeklySchedule();
        } catch (err) {
            console.error('Error loading schedules:', err);
        }
    }

    function getTeacherName(teacherId) {
        if (!teacherId) return 'Not assigned';
        const t = teachers.find(item => item.id === teacherId || item.user_id === teacherId);
        return t ? t.name : 'Teacher';
    }

    function renderDaySchedules() {
        const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        let totalSchedules = 0;

        dayNames.forEach(dayName => {
            const container = document.getElementById(`${dayName.toLowerCase()}-schedule`);
            if (!container) return;

            const list = sectionSchedules.filter(s => (s.day || '').toLowerCase() === dayName.toLowerCase());
            totalSchedules += list.length;

            if (list.length === 0) {
                container.innerHTML = `
                    <div class="no-data">
                        <i class="fas fa-calendar-day"></i>
                        <p>No classes scheduled on ${dayName}</p>
                    </div>
                `;
            } else {
                let html = `<div class="schedule-list">`;
                list.forEach(sch => {
                    const timeDisp = `${formatTime(sch.start_time)} - ${formatTime(sch.end_time)}`;
                    const tName = getTeacherName(sch.teacher_id);
                    html += `
                        <div class="schedule-item ${dayName.toLowerCase()}">
                            <div class="schedule-info">
                                <h4>${sch.subject || 'Subject'}</h4>
                                <p>
                                    <span><i class="fas fa-user"></i> ${tName}</span>
                                    <span><i class="fas fa-clock"></i> ${timeDisp}</span>
                                    ${sch.room ? `<span><i class="fas fa-door-open"></i> ${sch.room}</span>` : ''}
                                </p>
                            </div>
                            <button class="delete-btn" onclick="window.deleteSchedule('${sch.id}')" title="Delete Schedule">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    `;
                });
                html += `</div>`;
                container.innerHTML = html;
            }
        });

        if (scheduleCount) scheduleCount.textContent = `${totalSchedules} classes`;
        if (weeklyCount) weeklyCount.textContent = `${totalSchedules} classes`;
    }

    function renderWeeklySchedule() {
        if (!weeklyBody) return;

        // Group section schedules by day & start_time
        const scheduleMap = {};
        sectionSchedules.forEach(sch => {
            const d = sch.day;
            if (!scheduleMap[d]) scheduleMap[d] = {};
            // Match timeSlot by start_time
            const matchedSlot = timeSlots.find(ts => ts.start === sch.start_time || ts.start.startsWith(sch.start_time?.substring(0, 5)));
            if (matchedSlot) {
                scheduleMap[d][matchedSlot.id] = sch;
            }
        });

        let html = '';
        timeSlots.forEach(slot => {
            html += `
                <tr>
                    <td class="time-cell">${slot.label}</td>
            `;

            days.forEach(day => {
                const sch = scheduleMap[day.name]?.[slot.id];
                if (sch) {
                    const tName = getTeacherName(sch.teacher_id);
                    html += `
                        <td class="schedule-cell">
                            <div class="subject-name"><strong>${sch.subject}</strong></div>
                            <div class="teacher-name"><i class="fas fa-user"></i> ${tName}</div>
                            ${sch.room ? `<div class="room-badge"><i class="fas fa-door-open"></i> ${sch.room}</div>` : ''}
                        </td>
                    `;
                } else {
                    html += `<td class="empty-cell">—</td>`;
                }
            });

            html += `</tr>`;
        });

        weeklyBody.innerHTML = html;
    }

    // ===== CONFLICT CHECK =====
    function checkConflicts(teacherId, dayName, startTime, endTime, room) {
        // Teacher conflict across ALL sections
        const teacherConflict = allSchedules.find(s => 
            s.teacher_id === teacherId &&
            s.day === dayName &&
            s.start_time === startTime
        );

        if (teacherConflict) {
            const tName = getTeacherName(teacherId);
            return {
                hasConflict: true,
                message: `Teacher conflict! ${tName} is already assigned on ${dayName} at ${formatTime(startTime)}.`
            };
        }

        // Room conflict
        if (room && room.trim()) {
            const roomConflict = allSchedules.find(s => 
                s.room && s.room.toLowerCase().trim() === room.toLowerCase().trim() &&
                s.day === dayName &&
                s.start_time === startTime
            );

            if (roomConflict) {
                return {
                    hasConflict: true,
                    message: `Room conflict! ${room} is already booked on ${dayName} at ${formatTime(startTime)}.`
                };
            }
        }

        return { hasConflict: false };
    }

    // ===== DELETE SCHEDULE =====
    window.deleteSchedule = async function(id) {
        if (!confirm('Are you sure you want to delete this schedule?')) return;

        try {
            const { error } = await supabase
                .from('schedules')
                .delete()
                .eq('id', id);

            if (error) throw error;

            showAlert('✅ Schedule deleted successfully!', 'success');
            await loadSchedules();
        } catch (err) {
            console.error('Error deleting schedule:', err);
            showAlert('Failed to delete schedule: ' + err.message, 'error');
        }
    };

    // ===== FORM SUBMISSION =====
    if (scheduleForm) {
        scheduleForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const subjectId = subjectSelect.value;
            const teacherId = teacherSelect.value;
            const dayName = daySelect.value;
            const timeSlotId = parseInt(timeSlotSelect.value);
            const room = document.getElementById('room')?.value?.trim() || '';

            if (!subjectId || !teacherId || !dayName || !timeSlotId) {
                showAlert('Please fill in all required fields.', 'error');
                return;
            }

            const slot = timeSlots.find(ts => ts.id === timeSlotId);
            if (!slot) return;

            // Find subject name
            const chosenSubject = subjects.find(s => s.id === subjectId);
            const subjectTitle = chosenSubject ? chosenSubject.name : 'Subject';

            // Check conflicts
            const conflict = checkConflicts(teacherId, dayName, slot.start, slot.end, room);
            if (conflict.hasConflict) {
                if (conflictWarning) {
                    conflictWarning.style.display = 'flex';
                    if (conflictMessage) conflictMessage.textContent = conflict.message;
                }
                showAlert(conflict.message, 'error');
                return;
            } else {
                if (conflictWarning) conflictWarning.style.display = 'none';
            }

            const submitBtn = scheduleForm.querySelector('button[type="submit"]');
            try {
                if (submitBtn) submitBtn.disabled = true;

                const { data, error } = await supabase
                    .from('schedules')
                    .insert([{
                        section_id: sectionData.id,
                        teacher_id: teacherId,
                        subject: subjectTitle,
                        day: dayName,
                        start_time: slot.start,
                        end_time: slot.end,
                        room: room || null
                    }])
                    .select();

                if (error) throw error;

                showAlert(`✅ Added ${subjectTitle} on ${dayName} (${slot.label})!`, 'success');
                scheduleForm.reset();
                if (timeSlotSelect) timeSlotSelect.value = '';
                if (daySelect) daySelect.value = '';
                await loadSchedules();
            } catch (err) {
                console.error('Error adding schedule:', err);
                showAlert('Failed to add schedule: ' + err.message, 'error');
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }

    // ===== DAY TABS =====
    dayTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            dayTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            daySchedules.forEach(s => s.classList.remove('active'));
            const day = this.dataset.day;
            const target = document.getElementById(`${day}-schedule`);
            if (target) target.classList.add('active');
        });
    });

    // ===== MOBILE MENU =====
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
        });
    }

    // Initialize
    await init();
});