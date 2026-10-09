/**
 * HES Admin - Attendance Management (SUPABASE POWERED)
 */

import { supabase } from '../../supabase/config.js';

document.addEventListener('DOMContentLoaded', async function() {
    'use strict';

    // ============================================
    // DOM ELEMENTS
    // ============================================
    const alertContainer = document.getElementById('alertContainer');
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');

    // Tab switcher
    const tabStudentsBtn = document.getElementById('tabStudentsBtn');
    const tabTeachersBtn = document.getElementById('tabTeachersBtn');
    const studentAttendanceSection = document.getElementById('studentAttendanceSection');
    const teacherAttendanceSection = document.getElementById('teacherAttendanceSection');

    // Student controls & filters
    const gradeChips = document.getElementById('gradeChips');
    const currentGradeLabel = document.getElementById('currentGradeLabel');
    const studentGradeFilter = document.getElementById('studentGradeFilter');
    const studentSectionFilter = document.getElementById('studentSectionFilter');
    const studentDateFilter = document.getElementById('studentDateFilter');
    const studentStatusFilter = document.getElementById('studentStatusFilter');
    const studentSearchInput = document.getElementById('studentSearchInput');
    const studentAttendanceBody = document.getElementById('studentAttendanceBody');
    const currentSectionBadge = document.getElementById('currentSectionBadge');
    const studentCountBadge = document.getElementById('studentCountBadge');

    // Student stats
    const totalStudentsStat = document.getElementById('totalStudentsStat');
    const presentStudentsStat = document.getElementById('presentStudentsStat');
    const lateStudentsStat = document.getElementById('lateStudentsStat');
    const absentStudentsStat = document.getElementById('absentStudentsStat');
    const excusedStudentsStat = document.getElementById('excusedStudentsStat');
    const presentRate = document.getElementById('presentRate');

    // Chip counts
    const chipCountAll = document.getElementById('chipCountAll');
    const chipCountG7 = document.getElementById('chipCountG7');
    const chipCountG8 = document.getElementById('chipCountG8');
    const chipCountG9 = document.getElementById('chipCountG9');
    const chipCountG10 = document.getElementById('chipCountG10');
    const chipCountG11 = document.getElementById('chipCountG11');
    const chipCountG12 = document.getElementById('chipCountG12');

    // Quick action buttons
    const markAllPresentBtn = document.getElementById('markAllPresentBtn');
    const saveAllAttendanceBtn = document.getElementById('saveAllAttendanceBtn');
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');
    const exportBtn = document.getElementById('exportBtn');

    // Teacher controls & filters
    const teacherSelectFilter = document.getElementById('teacherSelectFilter');
    const teacherDateFilter = document.getElementById('teacherDateFilter');
    const teacherStatusFilter = document.getElementById('teacherStatusFilter');
    const teacherAttendanceBody = document.getElementById('teacherAttendanceBody');
    const teacherRecordBadge = document.getElementById('teacherRecordBadge');
    const totalTeachersStat = document.getElementById('totalTeachersStat');
    const presentTeachersStat = document.getElementById('presentTeachersStat');
    const lateTeachersStat = document.getElementById('lateTeachersStat');
    const absentTeachersStat = document.getElementById('absentTeachersStat');

    // Modal elements
    const openAddModalBtn = document.getElementById('openAddModalBtn');
    const attendanceModal = document.getElementById('attendanceModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelModalBtn = document.getElementById('cancelModalBtn');
    const attendanceModalForm = document.getElementById('attendanceModalForm');
    const modalTitle = document.getElementById('modalTitle');
    const editRecordId = document.getElementById('editRecordId');
    const modalType = document.getElementById('modalType');
    const studentModalFields = document.getElementById('studentModalFields');
    const teacherModalFields = document.getElementById('teacherModalFields');
    const modalGrade = document.getElementById('modalGrade');
    const modalSection = document.getElementById('modalSection');
    const modalStudentName = document.getElementById('modalStudentName');
    const modalStudentLRN = document.getElementById('modalStudentLRN');
    const modalTeacherSelect = document.getElementById('modalTeacherSelect');
    const modalDate = document.getElementById('modalDate');
    const modalStatus = document.getElementById('modalStatus');
    const modalTimeIn = document.getElementById('modalTimeIn');
    const modalTimeOut = document.getElementById('modalTimeOut');
    const modalRemarks = document.getElementById('modalRemarks');

    // ============================================
    // STATE
    // ============================================
    let allStudents = [];
    let allSections = [];
    let allTeachers = [];
    let studentAttendanceMap = {}; // student_id -> { id, status, time_in, time_out, date }
    let teacherAttendanceMap = {}; // teacher_id -> { id, status, time_in, time_out, date }
    let hasUnsavedChanges = false;

    // Default dates to today
    const todayStr = new Date().toISOString().split('T')[0];
    if (studentDateFilter) studentDateFilter.value = todayStr;
    if (teacherDateFilter) teacherDateFilter.value = todayStr;
    if (modalDate) modalDate.value = todayStr;

    // ============================================
    // ALERT HELPER
    // ============================================
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

    // ============================================
    // DATA FETCHING
    // ============================================
    async function loadData() {
        try {
            // 1. Fetch Students
            const { data: studentsData, error: stuErr } = await supabase
                .from('students')
                .select(`
                    *,
                    sections:section_id (id, name, grade_level, strand)
                `)
                .order('last_name', { ascending: true });

            if (stuErr) throw stuErr;
            allStudents = studentsData || [];

            // 2. Fetch Sections
            const { data: sectionsData, error: secErr } = await supabase
                .from('sections')
                .select('*')
                .order('name', { ascending: true });

            if (secErr) throw secErr;
            allSections = sectionsData || [];

            // 3. Fetch Teachers
            const { data: teachersData, error: tchErr } = await supabase
                .from('teachers')
                .select(`
                    id,
                    user_id,
                    employee_id,
                    specialization,
                    users:user_id (id, first_name, last_name, email)
                `);

            if (tchErr) throw tchErr;
            allTeachers = (teachersData || []).map(t => {
                const u = t.users || {};
                const name = (u.first_name || u.last_name)
                    ? `${u.first_name || ''} ${u.last_name || ''}`.trim()
                    : (u.email || t.employee_id || 'Teacher');
                return {
                    id: t.id,
                    user_id: t.user_id,
                    name: name,
                    employee_id: t.employee_id || 'TCH-' + t.id.substring(0, 5)
                };
            });

            // Populate UI dropdowns & chips
            populateSectionsDropdown();
            populateTeachersDropdown();
            updateGradeChipCounts();

            // Load Attendance Records for Selected Date
            await loadStudentAttendanceRecords();
            await loadTeacherAttendanceRecords();
        } catch (err) {
            console.error('Error loading attendance base data:', err);
            showAlert('Failed to load data: ' + err.message, 'error');
        }
    }

    function populateSectionsDropdown() {
        if (!studentSectionFilter) return;
        const currentGrade = studentGradeFilter ? studentGradeFilter.value : '';

        let sections = allSections;
        if (currentGrade) {
            const cleanGrade = currentGrade.replace('Grade ', '').trim();
            sections = sections.filter(s => {
                const g = String(s.grade_level || '').trim();
                return g === currentGrade || g === cleanGrade || `Grade ${g}` === currentGrade;
            });
        }

        let html = '<option value="">All Sections</option>';
        sections.forEach(sec => {
            html += `<option value="${sec.id}">${sec.name} (${sec.grade_level || ''})</option>`;
        });
        studentSectionFilter.innerHTML = html;

        if (modalSection) {
            modalSection.innerHTML = allSections.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        }
    }

    function populateTeachersDropdown() {
        if (teacherSelectFilter) {
            let html = '<option value="">All Teachers</option>';
            allTeachers.forEach(t => {
                html += `<option value="${t.id}">${t.name} (${t.employee_id})</option>`;
            });
            teacherSelectFilter.innerHTML = html;
        }

        if (modalTeacherSelect) {
            let html = '<option value="">Select Teacher</option>';
            allTeachers.forEach(t => {
                html += `<option value="${t.id}">${t.name}</option>`;
            });
            modalTeacherSelect.innerHTML = html;
        }
    }

    function updateGradeChipCounts() {
        const counts = { all: allStudents.length, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 };

        allStudents.forEach(stu => {
            let g = String(stu.grade_level || stu.sections?.grade_level || '').replace('Grade ', '').trim();
            const num = parseInt(g);
            if (num && counts[num] !== undefined) {
                counts[num]++;
            }
        });

        if (chipCountAll) chipCountAll.textContent = counts.all;
        if (chipCountG7) chipCountG7.textContent = counts[7];
        if (chipCountG8) chipCountG8.textContent = counts[8];
        if (chipCountG9) chipCountG9.textContent = counts[9];
        if (chipCountG10) chipCountG10.textContent = counts[10];
        if (chipCountG11) chipCountG11.textContent = counts[11];
        if (chipCountG12) chipCountG12.textContent = counts[12];
    }

    function isWeekend(dateStr) {
        if (!dateStr) return false;
        try {
            const d = new Date(dateStr + 'T00:00:00');
            const day = d.getDay();
            return day === 0 || day === 6;
        } catch {
            return false;
        }
    }

    async function loadStudentAttendanceRecords() {
        try {
            const date = studentDateFilter ? studentDateFilter.value : todayStr;
            const isWk = isWeekend(date);

            if (isWk) {
                const d = new Date(date + 'T00:00:00');
                const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
                showAlert(`📅 Notice: Selected date (${dayName}) is a weekend. School attendance is disabled on weekends (Monday - Friday only).`, 'warning');
                if (markAllPresentBtn) markAllPresentBtn.disabled = true;
                if (saveAllAttendanceBtn) saveAllAttendanceBtn.disabled = true;
            } else {
                if (markAllPresentBtn) markAllPresentBtn.disabled = false;
                if (saveAllAttendanceBtn) saveAllAttendanceBtn.disabled = false;
            }

            const { data, error } = await supabase
                .from('attendance')
                .select('*')
                .eq('date', date)
                .not('student_id', 'is', null);

            if (error) throw error;

            studentAttendanceMap = {};
            (data || []).forEach(rec => {
                if (rec.student_id) {
                    studentAttendanceMap[rec.student_id] = rec;
                }
            });

            renderStudentTable();
        } catch (err) {
            console.error('Error fetching student attendance:', err);
        }
    }

    async function loadTeacherAttendanceRecords() {
        try {
            const date = teacherDateFilter ? teacherDateFilter.value : todayStr;

            // Fetch from BOTH teacher_attendance and attendance tables
            const [tAttRes, genAttRes] = await Promise.all([
                supabase
                    .from('teacher_attendance')
                    .select('*')
                    .eq('date', date),
                supabase
                    .from('attendance')
                    .select('*')
                    .eq('date', date)
                    .not('teacher_id', 'is', null)
            ]);

            teacherAttendanceMap = {};

            // 1. Process general attendance table
            (genAttRes.data || []).forEach(rec => {
                if (rec.teacher_id) {
                    teacherAttendanceMap[rec.teacher_id] = {
                        ...rec,
                        status: rec.status || 'Present',
                        time_in: rec.time_in,
                        time_out: rec.time_out,
                        remarks: rec.remarks || ''
                    };
                }
            });

            // 2. Process primary teacher_attendance table (takes precedence for biometric/QR/direct validation!)
            (tAttRes.data || []).forEach(rec => {
                if (rec.teacher_id) {
                    let formattedIn = null;
                    if (rec.time_in) {
                        try {
                            const d = new Date(rec.time_in);
                            if (!isNaN(d.getTime())) {
                                formattedIn = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                            } else {
                                formattedIn = rec.time_in;
                            }
                        } catch {
                            formattedIn = rec.time_in;
                        }
                    }

                    let formattedOut = null;
                    if (rec.time_out) {
                        try {
                            const d = new Date(rec.time_out);
                            if (!isNaN(d.getTime())) {
                                formattedOut = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                            } else {
                                formattedOut = rec.time_out;
                            }
                        } catch {
                            formattedOut = rec.time_out;
                        }
                    }

                    const inStatus = rec.in_status || rec.status || (rec.time_in ? 'Present' : 'Absent');
                    const outStatus = rec.out_status || (rec.time_out ? 'Completed' : '');

                    let remarks = teacherAttendanceMap[rec.teacher_id]?.remarks || '';
                    if (!remarks) {
                        if (inStatus === 'Late') {
                            remarks = `Late Arrival (${formattedIn || 'Recorded'})`;
                        } else if (inStatus === 'Present') {
                            remarks = `On Time / Validated (${formattedIn || 'Recorded'})`;
                        } else {
                            remarks = 'No Record';
                        }
                        if (outStatus) {
                            remarks += ` • ${outStatus}`;
                        }
                    }

                    teacherAttendanceMap[rec.teacher_id] = {
                        id: rec.id,
                        teacher_id: rec.teacher_id,
                        date: rec.date,
                        time_in: formattedIn,
                        time_out: formattedOut,
                        status: inStatus,
                        in_status: inStatus,
                        out_status: outStatus,
                        remarks: remarks
                    };
                }
            });

            renderTeacherTable();
        } catch (err) {
            console.error('Error fetching teacher attendance:', err);
        }
    }

    // ============================================
    // RENDER STUDENT TABLE & STATS
    // ============================================
    function renderStudentTable() {
        if (!studentAttendanceBody) return;

        const gradeVal = studentGradeFilter ? studentGradeFilter.value : '';
        const sectionVal = studentSectionFilter ? studentSectionFilter.value : '';
        const statusVal = studentStatusFilter ? studentStatusFilter.value : '';
        const searchVal = studentSearchInput ? studentSearchInput.value.toLowerCase().trim() : '';

        let filtered = [...allStudents];

        // Filter by grade
        if (gradeVal) {
            const clean = gradeVal.replace('Grade ', '').trim();
            filtered = filtered.filter(s => {
                const g = String(s.grade_level || s.sections?.grade_level || '').trim();
                return g === gradeVal || g === clean || `Grade ${g}` === gradeVal;
            });
        }

        // Filter by section
        if (sectionVal) {
            filtered = filtered.filter(s => s.section_id === sectionVal || s.sections?.id === sectionVal);
        }

        // Filter by status
        if (statusVal) {
            filtered = filtered.filter(s => {
                const rec = studentAttendanceMap[s.id];
                const currentStatus = rec ? rec.status : 'Present';
                return currentStatus.toLowerCase() === statusVal.toLowerCase();
            });
        }

        // Filter by search
        if (searchVal) {
            filtered = filtered.filter(s => {
                const fullName = `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase();
                const lrn = (s.lrn || '').toLowerCase();
                const email = (s.email || '').toLowerCase();
                return fullName.includes(searchVal) || lrn.includes(searchVal) || email.includes(searchVal);
            });
        }

        // Update stats
        let presentCount = 0, lateCount = 0, absentCount = 0, excusedCount = 0;
        filtered.forEach(s => {
            const rec = studentAttendanceMap[s.id];
            const status = rec ? rec.status : 'Present';
            if (status === 'Present') presentCount++;
            else if (status === 'Late') lateCount++;
            else if (status === 'Absent') absentCount++;
            else if (status === 'Excused') excusedCount++;
        });

        const total = filtered.length;
        const rate = total > 0 ? Math.round(((presentCount + lateCount) / total) * 100) : 0;

        if (totalStudentsStat) totalStudentsStat.textContent = total;
        if (presentStudentsStat) presentStudentsStat.textContent = presentCount;
        if (lateStudentsStat) lateStudentsStat.textContent = lateCount;
        if (absentStudentsStat) absentStudentsStat.textContent = absentCount;
        if (excusedStudentsStat) excusedStudentsStat.textContent = excusedCount;
        if (presentRate) presentRate.textContent = `${rate}%`;

        if (studentCountBadge) {
            studentCountBadge.innerHTML = `<i class="fas fa-user-check"></i> Showing ${total} students`;
        }

        if (filtered.length === 0) {
            studentAttendanceBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 40px; color: #64748b;">
                        <i class="fas fa-users-slash" style="font-size: 32px; color: #94a3b8;"></i>
                        <h3 style="margin-top: 10px;">No Students Found</h3>
                        <p>No students match the selected filters or date.</p>
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        filtered.forEach((stu, index) => {
            const fullName = `${stu.last_name || ''}, ${stu.first_name || ''} ${stu.middle_name || ''}`.trim() || 'Student';
            const lrn = stu.lrn || stu.id.substring(0, 8);
            const sectionName = stu.sections?.name || 'Unassigned';
            const gradeDisplay = stu.grade_level || stu.sections?.grade_level || '—';

            const rec = studentAttendanceMap[stu.id];
            const status = rec ? rec.status : 'Present';
            const timeIn = rec?.time_in ? rec.time_in.substring(0, 5) : '07:30';
            const timeOut = rec?.time_out ? rec.time_out.substring(0, 5) : '16:30';

            const statusClass = status.toLowerCase();

            html += `
                <tr data-student-id="${stu.id}">
                    <td>${index + 1}</td>
                    <td>
                        <strong>${fullName}</strong>
                        <div style="font-size: 11px; color: #64748b;">LRN: ${lrn}</div>
                    </td>
                    <td>
                        <div>${sectionName}</div>
                        <span style="font-size: 11px; background:#f1f5f9; padding:2px 6px; border-radius:4px;">${gradeDisplay}</span>
                    </td>
                    <td>
                        <input type="time" class="time-in-input" value="${timeIn}" 
                               onchange="window.updateStudentTime('${stu.id}', 'time_in', this.value)"
                               style="padding: 4px 8px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 13px;">
                    </td>
                    <td>
                        <input type="time" class="time-out-input" value="${timeOut}" 
                               onchange="window.updateStudentTime('${stu.id}', 'time_out', this.value)"
                               style="padding: 4px 8px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 13px;">
                    </td>
                    <td>
                        <span class="legend-pill ${statusClass}" style="display:inline-block; font-size:12px; font-weight:600; padding:4px 10px; border-radius:12px;">
                            ${status}
                        </span>
                    </td>
                    <td>
                        <div class="quick-status-group" style="display: flex; gap: 4px;">
                            <button type="button" class="btn-qs ${status === 'Present' ? 'active' : ''}" onclick="window.setStudentStatus('${stu.id}', 'Present')" title="Present">P</button>
                            <button type="button" class="btn-qs ${status === 'Late' ? 'active' : ''}" onclick="window.setStudentStatus('${stu.id}', 'Late')" title="Late">L</button>
                            <button type="button" class="btn-qs ${status === 'Absent' ? 'active' : ''}" onclick="window.setStudentStatus('${stu.id}', 'Absent')" title="Absent">A</button>
                            <button type="button" class="btn-qs ${status === 'Excused' ? 'active' : ''}" onclick="window.setStudentStatus('${stu.id}', 'Excused')" title="Excused">E</button>
                        </div>
                    </td>
                    <td>
                        <button type="button" class="btn-save-single" onclick="window.saveSingleStudentAttendance('${stu.id}')" title="Save this record" style="background:#1B2A4A; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">
                            <i class="fas fa-save"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        studentAttendanceBody.innerHTML = html;
    }

    // ============================================
    // RENDER TEACHER TABLE & STATS
    // ============================================
    function renderTeacherTable() {
        if (!teacherAttendanceBody) return;

        const teacherVal = teacherSelectFilter ? teacherSelectFilter.value : '';
        const statusVal = teacherStatusFilter ? teacherStatusFilter.value : '';

        let filtered = [...allTeachers];

        if (teacherVal) {
            filtered = filtered.filter(t => t.id === teacherVal);
        }

        if (statusVal) {
            filtered = filtered.filter(t => {
                const rec = teacherAttendanceMap[t.id];
                const currentStatus = rec ? rec.status : 'Present';
                return currentStatus.toLowerCase() === statusVal.toLowerCase();
            });
        }

        // Accurately compute faculty statistics across all active teachers
        let presentCount = 0, lateCount = 0, absentCount = 0;
        allTeachers.forEach(t => {
            const rec = teacherAttendanceMap[t.id];
            if (!rec || !rec.time_in) {
                absentCount++;
            } else if (rec.status === 'Late' || rec.in_status === 'Late') {
                lateCount++;
            } else {
                presentCount++;
            }
        });

        if (totalTeachersStat) totalTeachersStat.textContent = allTeachers.length;
        if (presentTeachersStat) presentTeachersStat.textContent = presentCount;
        if (lateTeachersStat) lateTeachersStat.textContent = lateCount;
        if (absentTeachersStat) absentTeachersStat.textContent = absentCount;

        if (teacherRecordBadge) {
            teacherRecordBadge.textContent = `Showing ${filtered.length} of ${allTeachers.length} faculty`;
        }

        if (filtered.length === 0) {
            teacherAttendanceBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 30px; color: #64748b;">
                        <i class="fas fa-chalkboard-user" style="font-size: 28px; color: #94a3b8;"></i>
                        <p style="margin-top: 8px;">No teacher attendance records found.</p>
                    </td>
                </tr>
            `;
            return;
        }

        const date = teacherDateFilter ? teacherDateFilter.value : todayStr;
        let html = '';
        filtered.forEach(t => {
            const rec = teacherAttendanceMap[t.id];
            const hasRecord = !!(rec && rec.time_in);
            const status = hasRecord ? (rec.status || 'Present') : 'Absent';
            const timeIn = rec?.time_in ? rec.time_in : '—';
            const timeOut = rec?.time_out ? rec.time_out : '—';
            const remarks = hasRecord ? (rec.remarks || (status === 'Late' ? 'Late Arrival' : 'On Duty')) : 'No time-in logged today';

            const statusClass = status.toLowerCase() === 'late' ? 'late' : (hasRecord ? 'present' : 'absent');

            html += `
                <tr>
                    <td><strong>${t.name}</strong></td>
                    <td><span class="id-badge">${t.employee_id}</span></td>
                    <td><i class="far fa-calendar"></i> ${date}</td>
                    <td><strong style="color: ${status === 'Late' ? '#d97706' : '#0f172a'};">${timeIn}</strong></td>
                    <td><strong>${timeOut}</strong></td>
                    <td>
                        <span class="legend-pill ${statusClass}">${status}</span>
                    </td>
                    <td><span style="font-size: 12.5px; color: #475569;">${remarks}</span></td>
                    <td>
                        <button type="button" class="btn-edit-sm" onclick="window.openTeacherEditModal('${t.id}')" title="Edit Record" style="background:#e2e8f0; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">
                            <i class="fas fa-edit"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        teacherAttendanceBody.innerHTML = html;
    }

    // ============================================
    // ACTIONS & STATE MUTATIONS (GLOBALLY EXPOSED)
    // ============================================

    window.setStudentStatus = function(studentId, newStatus) {
        if (!studentAttendanceMap[studentId]) {
            studentAttendanceMap[studentId] = {
                student_id: studentId,
                date: studentDateFilter ? studentDateFilter.value : todayStr,
                status: newStatus,
                time_in: '07:30:00',
                time_out: '16:30:00'
            };
        } else {
            studentAttendanceMap[studentId].status = newStatus;
        }
        hasUnsavedChanges = true;
        renderStudentTable();
    };

    window.updateStudentTime = function(studentId, field, value) {
        if (!studentAttendanceMap[studentId]) {
            studentAttendanceMap[studentId] = {
                student_id: studentId,
                date: studentDateFilter ? studentDateFilter.value : todayStr,
                status: 'Present',
                time_in: '07:30:00',
                time_out: '16:30:00'
            };
        }
        const timeVal = value ? `${value}:00` : null;
        studentAttendanceMap[studentId][field] = timeVal;
        hasUnsavedChanges = true;
    };

    window.saveSingleStudentAttendance = async function(studentId) {
        const rec = studentAttendanceMap[studentId] || {
            student_id: studentId,
            date: studentDateFilter ? studentDateFilter.value : todayStr,
            status: 'Present',
            time_in: '07:30:00',
            time_out: '16:30:00'
        };

        try {
            // Check if record exists
            const { data: existing } = await supabase
                .from('attendance')
                .select('id')
                .eq('student_id', studentId)
                .eq('date', rec.date)
                .maybeSingle();

            if (existing) {
                await supabase
                    .from('attendance')
                    .update({
                        status: rec.status,
                        time_in: rec.time_in,
                        time_out: rec.time_out
                    })
                    .eq('id', existing.id);
            } else {
                await supabase
                    .from('attendance')
                    .insert([{
                        student_id: studentId,
                        date: rec.date,
                        status: rec.status,
                        time_in: rec.time_in,
                        time_out: rec.time_out
                    }]);
            }

            showAlert('✅ Attendance record saved successfully!', 'success');
            await loadStudentAttendanceRecords();
        } catch (err) {
            console.error('Error saving single attendance:', err);
            showAlert('Failed to save attendance: ' + err.message, 'error');
        }
    };

    // Mark All Present
    if (markAllPresentBtn) {
        markAllPresentBtn.addEventListener('click', function() {
            const date = studentDateFilter ? studentDateFilter.value : todayStr;
            if (isWeekend(date)) {
                showAlert('📅 Cannot mark attendance on weekends. Selected date is Saturday/Sunday.', 'warning');
                return;
            }

            allStudents.forEach(stu => {
                if (!studentAttendanceMap[stu.id]) {
                    studentAttendanceMap[stu.id] = {
                        student_id: stu.id,
                        date: date,
                        status: 'Present',
                        time_in: '07:30:00',
                        time_out: '16:30:00'
                    };
                } else {
                    studentAttendanceMap[stu.id].status = 'Present';
                }
            });
            hasUnsavedChanges = true;
            renderStudentTable();
            showAlert('All students marked as Present. Click "Save Changes" to commit.', 'info');
        });
    }

    // Save All Attendance
    if (saveAllAttendanceBtn) {
        saveAllAttendanceBtn.addEventListener('click', async function() {
            const date = studentDateFilter ? studentDateFilter.value : todayStr;
            if (isWeekend(date)) {
                showAlert('📅 Attendance recording is disabled on weekends (Saturday & Sunday).', 'warning');
                return;
            }
            const recordsToSave = allStudents.map(stu => {
                const rec = studentAttendanceMap[stu.id];
                return {
                    student_id: stu.id,
                    date: date,
                    status: rec ? rec.status : 'Present',
                    time_in: rec?.time_in || '07:30:00',
                    time_out: rec?.time_out || '16:30:00'
                };
            });

            try {
                saveAllAttendanceBtn.disabled = true;
                saveAllAttendanceBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

                // Delete existing for this date & re-insert bulk
                await supabase
                    .from('attendance')
                    .delete()
                    .eq('date', date)
                    .not('student_id', 'is', null);

                const { error } = await supabase
                    .from('attendance')
                    .insert(recordsToSave);

                if (error) throw error;

                hasUnsavedChanges = false;
                showAlert('✅ All student attendance records saved successfully!', 'success');
                await loadStudentAttendanceRecords();
            } catch (err) {
                console.error('Error saving all attendance:', err);
                showAlert('Failed to save attendance records: ' + err.message, 'error');
            } finally {
                saveAllAttendanceBtn.disabled = false;
                saveAllAttendanceBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
            }
        });
    }

    // Export Report
    if (exportBtn) {
        exportBtn.addEventListener('click', function() {
            const date = studentDateFilter ? studentDateFilter.value : todayStr;
            let csvContent = 'data:text/csv;charset=utf-8,';
            csvContent += 'LRN,Student Name,Grade Level,Section,Date,Time In,Time Out,Status\n';

            allStudents.forEach(stu => {
                const fullName = `"${stu.last_name || ''}, ${stu.first_name || ''}"`;
                const lrn = stu.lrn || stu.id.substring(0, 8);
                const grade = stu.grade_level || stu.sections?.grade_level || '';
                const section = stu.sections?.name || '';
                const rec = studentAttendanceMap[stu.id];
                const status = rec ? rec.status : 'Present';
                const timeIn = rec?.time_in || '07:30';
                const timeOut = rec?.time_out || '16:30';

                csvContent += `${lrn},${fullName},${grade},${section},${date},${timeIn},${timeOut},${status}\n`;
            });

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement('a');
            link.setAttribute('href', encodedUri);
            link.setAttribute('download', `HES_Attendance_${date}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    // ============================================
    // MODAL LOGIC
    // ============================================
    if (openAddModalBtn) {
        openAddModalBtn.addEventListener('click', function() {
            if (attendanceModal) attendanceModal.classList.add('show');
            if (modalTitle) modalTitle.innerHTML = '<i class="fas fa-plus-circle"></i> Add Attendance Record';
            if (editRecordId) editRecordId.value = '';
        });
    }

    function closeModal() {
        if (attendanceModal) attendanceModal.classList.remove('show');
    }

    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);

    if (modalType) {
        modalType.addEventListener('change', function() {
            if (this.value === 'teacher') {
                if (studentModalFields) studentModalFields.style.display = 'none';
                if (teacherModalFields) teacherModalFields.style.display = 'block';
            } else {
                if (studentModalFields) studentModalFields.style.display = 'block';
                if (teacherModalFields) teacherModalFields.style.display = 'none';
            }
        });
    }

    if (attendanceModalForm) {
        attendanceModalForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const type = modalType.value;
            const date = modalDate.value;
            const status = modalStatus.value;
            const timeIn = modalTimeIn.value ? `${modalTimeIn.value}:00` : '07:30:00';
            const timeOut = modalTimeOut.value ? `${modalTimeOut.value}:00` : '16:30:00';

            try {
                if (type === 'student') {
                    const lrn = modalStudentLRN.value.trim();
                    const name = modalStudentName.value.trim();

                    // Match student by LRN or Name
                    let stu = allStudents.find(s => s.lrn === lrn);
                    if (!stu && name) {
                        stu = allStudents.find(s => `${s.first_name} ${s.last_name}`.toLowerCase().includes(name.toLowerCase()));
                    }

                    if (!stu) {
                        showAlert('Student not found in database. Please check LRN or name.', 'error');
                        return;
                    }

                    await supabase
                        .from('attendance')
                        .insert([{
                            student_id: stu.id,
                            date: date,
                            status: status,
                            time_in: timeIn,
                            time_out: timeOut
                        }]);

                    showAlert(`✅ Attendance saved for student ${stu.first_name} ${stu.last_name}!`, 'success');
                    await loadStudentAttendanceRecords();
                } else {
                    const teacherId = modalTeacherSelect.value;
                    if (!teacherId) {
                        showAlert('Please select a teacher.', 'error');
                        return;
                    }

                    await supabase
                        .from('attendance')
                        .insert([{
                            teacher_id: teacherId,
                            date: date,
                            status: status,
                            time_in: timeIn,
                            time_out: timeOut
                        }]);

                    showAlert('✅ Teacher attendance record saved successfully!', 'success');
                    await loadTeacherAttendanceRecords();
                }

                closeModal();
                attendanceModalForm.reset();
            } catch (err) {
                console.error('Error submitting modal attendance:', err);
                showAlert('Failed to save record: ' + err.message, 'error');
            }
        });
    }

    // ============================================
    // FILTER EVENT LISTENERS
    // ============================================
    if (studentGradeFilter) {
        studentGradeFilter.addEventListener('change', function() {
            populateSectionsDropdown();
            renderStudentTable();
        });
    }

    if (studentSectionFilter) studentSectionFilter.addEventListener('change', renderStudentTable);
    if (studentDateFilter) studentDateFilter.addEventListener('change', loadStudentAttendanceRecords);
    if (studentStatusFilter) studentStatusFilter.addEventListener('change', renderStudentTable);
    if (studentSearchInput) studentSearchInput.addEventListener('input', renderStudentTable);

    if (teacherSelectFilter) teacherSelectFilter.addEventListener('change', renderTeacherTable);
    if (teacherDateFilter) teacherDateFilter.addEventListener('change', loadTeacherAttendanceRecords);
    if (teacherStatusFilter) teacherStatusFilter.addEventListener('change', renderTeacherTable);

    // Grade Chips Click
    if (gradeChips) {
        const chips = gradeChips.querySelectorAll('.grade-chip');
        chips.forEach(chip => {
            chip.addEventListener('click', function() {
                chips.forEach(c => c.classList.remove('active'));
                this.classList.add('active');

                const grade = this.dataset.grade;
                if (studentGradeFilter) {
                    studentGradeFilter.value = grade;
                    populateSectionsDropdown();
                }
                if (currentGradeLabel) {
                    currentGradeLabel.textContent = grade || 'All Grade Levels';
                }
                renderStudentTable();
            });
        });
    }

    // Reset Filters
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', function() {
            if (studentGradeFilter) studentGradeFilter.value = '';
            if (studentSectionFilter) studentSectionFilter.value = '';
            if (studentStatusFilter) studentStatusFilter.value = '';
            if (studentSearchInput) studentSearchInput.value = '';

            if (gradeChips) {
                const chips = gradeChips.querySelectorAll('.grade-chip');
                chips.forEach(c => {
                    if (c.dataset.grade === '') c.classList.add('active');
                    else c.classList.remove('active');
                });
            }
            if (currentGradeLabel) currentGradeLabel.textContent = 'All Grade Levels';

            populateSectionsDropdown();
            renderStudentTable();
        });
    }

    // Tab Switcher
    if (tabStudentsBtn && tabTeachersBtn) {
        tabStudentsBtn.addEventListener('click', function() {
            tabStudentsBtn.classList.add('active');
            tabTeachersBtn.classList.remove('active');
            if (studentAttendanceSection) studentAttendanceSection.classList.add('active');
            if (teacherAttendanceSection) teacherAttendanceSection.classList.remove('active');
        });

        tabTeachersBtn.addEventListener('click', function() {
            tabTeachersBtn.classList.add('active');
            tabStudentsBtn.classList.remove('active');
            if (teacherAttendanceSection) teacherAttendanceSection.classList.add('active');
            if (studentAttendanceSection) studentAttendanceSection.classList.remove('active');
        });
    }

    // Mobile Menu
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
        });
    }

    // Initial Load
    await loadData();
});