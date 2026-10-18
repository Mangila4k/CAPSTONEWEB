// ===== VIEW SECTION JAVASCRIPT (SUPABASE POWERED) =====
import { supabase } from '../../supabase/config.js';

document.addEventListener('DOMContentLoaded', async function() {
    // DOM Elements
    const alertContainer = document.getElementById('alertContainer');
    const sectionTitle = document.getElementById('sectionTitle');
    const sectionGrade = document.getElementById('sectionGrade');
    const sectionAdviser = document.getElementById('sectionAdviser');
    const totalStudentsElem = document.getElementById('totalStudents');
    const totalSubjectsElem = document.getElementById('totalSubjects');
    const statStudentsElem = document.getElementById('statStudents');
    const statSubjectsElem = document.getElementById('statSubjects');
    const statDaysElem = document.getElementById('statDays');
    const studentCountBadge = document.getElementById('studentCount');
    const studentsContainer = document.getElementById('studentsContainer');
    const scheduleContainer = document.getElementById('scheduleContainer');

    const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // State
    let sectionData = null;
    let enrolledStudents = [];
    let sectionSchedules = [];

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
        if (!timeString) return 'N/A';
        const date = new Date(`2000-01-01T${timeString}`);
        return isNaN(date.getTime()) ? timeString : date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }

    // ===== LOAD SECTION DATA =====
    async function init() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            let sectionId = urlParams.get('id');

            // If no ID in URL, get first section
            if (!sectionId) {
                const { data: firstSec, error: firstErr } = await supabase
                    .from('sections')
                    .select('id')
                    .limit(1)
                    .maybeSingle();

                if (firstSec) {
                    sectionId = firstSec.id;
                }
            }

            if (!sectionId) {
                if (studentsContainer) {
                    studentsContainer.innerHTML = `
                        <div class="no-data">
                            <i class="fas fa-layer-group"></i>
                            <h3>No Section Selected</h3>
                            <p>Please select a section from the <a href="sections.html">Sections List</a>.</p>
                        </div>
                    `;
                }
                return;
            }

            // 1. Fetch Section
            const { data: section, error: secError } = await supabase
                .from('sections')
                .select('*')
                .eq('id', sectionId)
                .single();

            if (secError || !section) throw new Error('Section not found');
            sectionData = section;

            // Resolve adviser name automatically
            let adviserName = (section.adviser_name || '').trim();

            if (section.adviser_id) {
                // Check teachers table
                const { data: teacher } = await supabase
                    .from('teachers')
                    .select(`
                        id,
                        user_id,
                        users:user_id (first_name, last_name, email)
                    `)
                    .or(`id.eq.${section.adviser_id},user_id.eq.${section.adviser_id}`)
                    .maybeSingle();

                if (teacher && teacher.users) {
                    const fullName = `${teacher.users.first_name || ''} ${teacher.users.last_name || ''}`.trim() || teacher.users.email;
                    if (fullName) adviserName = fullName;
                }
            } else if (adviserName && adviserName.toLowerCase() !== 'not assigned') {
                // If section has adviser_name stored (e.g., "Mrs. Tapasao"), try to auto-match and link to teachers/users
                try {
                    const cleanedSearch = adviserName.replace(/^(mr\.|mrs\.|ms\.|dr\.|prof\.)\s*/i, '').trim().toLowerCase();
                    if (cleanedSearch.length >= 2) {
                        const { data: allTeachers } = await supabase
                            .from('teachers')
                            .select(`
                                id,
                                user_id,
                                users:user_id (first_name, last_name, email)
                            `);

                        if (allTeachers && allTeachers.length > 0) {
                            const matched = allTeachers.find(t => {
                                if (!t.users) return false;
                                const fName = (t.users.first_name || '').toLowerCase();
                                const lName = (t.users.last_name || '').toLowerCase();
                                const fullName = `${fName} ${lName}`.trim();
                                return (lName && (lName.includes(cleanedSearch) || cleanedSearch.includes(lName))) ||
                                       (fullName && (fullName.includes(cleanedSearch) || cleanedSearch.includes(fullName)));
                            });

                            if (matched) {
                                // Auto-link adviser_id in background
                                supabase
                                    .from('sections')
                                    .update({ adviser_id: matched.id })
                                    .eq('id', section.id)
                                    .then(() => console.log('Auto-linked section adviser_id successfully'))
                                    .catch(err => console.warn('Could not auto-update section adviser_id:', err));

                                if (matched.users) {
                                    const matchedFullName = `${matched.users.first_name || ''} ${matched.users.last_name || ''}`.trim();
                                    if (matchedFullName) {
                                        const honorificMatch = adviserName.match(/^(mr\.|mrs\.|ms\.|dr\.|prof\.)\s*/i);
                                        const honorific = honorificMatch ? honorificMatch[0] : '';
                                        adviserName = honorific ? `${honorific}${matchedFullName}` : matchedFullName;
                                    }
                                }
                            }
                        }
                    }
                } catch (autoErr) {
                    console.warn('Teacher auto-match warning:', autoErr);
                }
            }

            if (!adviserName) {
                adviserName = 'Not Assigned';
            }
            sectionData.adviser_name = adviserName;

            // Link edit button if present
            const editBtn = document.getElementById('editSectionBtn');
            if (editBtn && section.id) {
                editBtn.href = `sections.html?edit=${section.id}`;
            }

            // 2. Fetch Enrolled Students
            const { data: students, error: stuError } = await supabase
                .from('students')
                .select('*')
                .eq('section_id', sectionId)
                .order('last_name', { ascending: true });

            enrolledStudents = students || [];

            // 3. Fetch Schedules
            const { data: schedules, error: schError } = await supabase
                .from('schedules')
                .select(`
                    *,
                    teachers:teacher_id (
                        id,
                        users:user_id (first_name, last_name, email)
                    )
                `)
                .eq('section_id', sectionId);

            sectionSchedules = (schedules || []).map(s => {
                let teacherName = 'Not assigned';
                if (s.teachers && s.teachers.users) {
                    const u = s.teachers.users;
                    teacherName = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email;
                }
                return {
                    ...s,
                    teacher_name: teacherName
                };
            });

            renderHeader();
            renderStudents();
            renderSchedule();
        } catch (err) {
            console.error('Error loading section details:', err);
            showAlert('Failed to load section details: ' + err.message, 'error');
        }
    }

    function renderHeader() {
        if (!sectionData) return;

        if (sectionTitle) sectionTitle.textContent = sectionData.name || 'Section';
        if (sectionGrade) sectionGrade.textContent = sectionData.grade_level || 'Grade Level';
        
        if (sectionAdviser) {
            const adv = (sectionData.adviser_name || '').trim();
            if (adv && adv.toLowerCase() !== 'not assigned' && adv !== '—') {
                sectionAdviser.innerHTML = `<span style="font-weight: 700; color: #1e3a8a;">${adv}</span>`;
            } else {
                sectionAdviser.innerHTML = `<span style="color: #94a3b8; font-style: italic;">Not Assigned</span>`;
            }
        }
        
        const totalStu = enrolledStudents.length;
        const totalSub = sectionSchedules.length;
        const uniqueDays = new Set(sectionSchedules.map(s => s.day)).size;

        if (totalStudentsElem) totalStudentsElem.textContent = totalStu;
        if (totalSubjectsElem) totalSubjectsElem.textContent = totalSub;
        if (statStudentsElem) statStudentsElem.textContent = totalStu;
        if (statSubjectsElem) statSubjectsElem.textContent = totalSub;
        if (statDaysElem) statDaysElem.textContent = uniqueDays;
    }

    function renderStudents() {
        if (!studentsContainer) return;

        if (studentCountBadge) {
            studentCountBadge.textContent = `${enrolledStudents.length} Students`;
        }

        if (enrolledStudents.length === 0) {
            studentsContainer.innerHTML = `
                <div class="no-data" style="text-align: center; padding: 40px;">
                    <i class="fas fa-users" style="font-size: 36px; color: #94a3b8;"></i>
                    <h3 style="margin-top: 12px;">No Students Enrolled</h3>
                    <p style="color: #64748b;">This section currently has no enrolled students.</p>
                </div>
            `;
            return;
        }

        let html = `
            <table class="students-table" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="border-bottom: 2px solid #e2e8f0; text-align: left;">
                        <th style="padding: 12px 16px;">LRN / ID Number</th>
                        <th style="padding: 12px 16px;">Full Name</th>
                        <th style="padding: 12px 16px;">Gender</th>
                        <th style="padding: 12px 16px;">Grade & Strand</th>
                        <th style="padding: 12px 16px;">Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        enrolledStudents.forEach(stu => {
            const fullName = `${stu.last_name || ''}, ${stu.first_name || ''} ${stu.middle_name || ''}`.trim() || 'Student';
            const lrn = stu.lrn || stu.id.substring(0, 8);
            const gradeDisplay = stu.grade_level || sectionData.grade_level || '—';
            const strandDisplay = stu.strand || sectionData.strand || '';

            html += `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 12px 16px; font-weight: 600; color: #1B2A4A;">${lrn}</td>
                    <td style="padding: 12px 16px;">${fullName}</td>
                    <td style="padding: 12px 16px;">${stu.gender || '—'}</td>
                    <td style="padding: 12px 16px;">
                        <span class="grade-tag" style="background:#f1f5f9; padding:3px 8px; border-radius:6px; font-size:12px;">${gradeDisplay}</span>
                        ${strandDisplay ? `<span style="background:#e0f2fe; color:#0369a1; padding:3px 8px; border-radius:6px; font-size:12px; margin-left:4px;">${strandDisplay}</span>` : ''}
                    </td>
                    <td style="padding: 12px 16px;">
                        <a href="view_student.html?id=${stu.id}" class="action-btn view-btn" title="View Student" style="display:inline-flex; align-items:center; justify-content:center; padding:6px 10px; background:#e2e8f0; border-radius:6px; color:#1B2A4A; text-decoration:none;">
                            <i class="fas fa-eye"></i>
                        </a>
                    </td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        `;

        studentsContainer.innerHTML = html;
    }

    function renderSchedule() {
        if (!scheduleContainer) return;

        if (sectionSchedules.length === 0) {
            scheduleContainer.innerHTML = `
                <div class="no-data" style="text-align: center; padding: 40px;">
                    <i class="fas fa-calendar-times" style="font-size: 36px; color: #94a3b8;"></i>
                    <h3 style="margin-top: 12px;">No Class Schedule</h3>
                    <p style="color: #64748b; margin-bottom: 16px;">No class schedule has been assigned to this section yet.</p>
                    <a href="create_schedule.html?section_id=${sectionData?.id || ''}" class="btn-primary" style="display:inline-flex; align-items:center; gap:8px; padding:8px 16px; background:#1B2A4A; color:#fff; border-radius:6px; text-decoration:none; font-weight:600;">
                        <i class="fas fa-calendar-plus"></i> Create Schedule
                    </a>
                </div>
            `;
            return;
        }

        // Group by day
        const scheduleByDay = {};
        daysOrder.forEach(d => scheduleByDay[d] = []);
        sectionSchedules.forEach(s => {
            const d = s.day || 'Monday';
            if (!scheduleByDay[d]) scheduleByDay[d] = [];
            scheduleByDay[d].push(s);
        });

        let html = `<div class="schedule-container">`;

        daysOrder.forEach(day => {
            const list = scheduleByDay[day] || [];
            if (list.length > 0) {
                html += `
                    <div class="day-schedule" style="margin-bottom: 24px;">
                        <h4 class="day-title" style="margin-bottom: 12px; color: #1B2A4A; display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-calendar-day"></i> ${day}
                        </h4>
                        <div class="schedule-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px;">
                `;

                list.forEach(item => {
                    html += `
                        <div class="schedule-card" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px;">
                            <div class="schedule-time" style="font-size: 12px; color: #64748b; margin-bottom: 6px;">
                                <i class="fas fa-clock"></i>
                                ${formatTime(item.start_time)} - ${formatTime(item.end_time)}
                            </div>
                            <h5 class="schedule-subject" style="font-size: 15px; font-weight: 700; color: #1B2A4A; margin-bottom: 8px;">
                                <i class="fas fa-book-open"></i> 
                                ${item.subject || 'Subject'}
                            </h5>
                            <div class="schedule-details" style="font-size: 12px; color: #475569; display: flex; flex-direction: column; gap: 4px;">
                                <span><i class="fas fa-chalkboard-user"></i> ${item.teacher_name || 'Teacher'}</span>
                                ${item.room ? `<span><i class="fas fa-door-open"></i> Room: ${item.room}</span>` : ''}
                            </div>
                        </div>
                    `;
                });

                html += `
                        </div>
                    </div>
                `;
            }
        });

        html += `</div>`;
        scheduleContainer.innerHTML = html;
    }

    // ===== TABS =====
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            this.classList.add('active');
            const tabId = this.dataset.tab;
            const target = document.getElementById(`${tabId}-tab`);
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

    // ===== INIT =====
    await init();
});