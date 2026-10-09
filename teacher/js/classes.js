/**
 * Teacher My Classes - Firebase Integration
 */

import { auth, db } from '../../firebase/config.js';
import { 
    onAuthStateChanged,
    signOut 
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import {
    collection,
    query,
    where,
    getDocs,
    orderBy,
    doc,
    getDoc,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

(function() {
    'use strict';

    console.log('📚 My Classes ready');

    // ============================================
    // DOM ELEMENTS
    // ============================================

    const teacherName = document.getElementById('teacherName');
    const teacherInitial = document.getElementById('teacherInitial');
    const logoutBtn = document.getElementById('logoutBtn');

    // Stats
    const totalSections = document.getElementById('totalSections');
    const totalSubjects = document.getElementById('totalSubjects');
    const totalStudents = document.getElementById('totalStudents');

    // Containers
    const advisoryContainer = document.getElementById('advisoryContainer');
    const subjectsContainer = document.getElementById('subjectsContainer');
    const scheduleContainer = document.getElementById('scheduleContainer');

    // Alert container
    const alertContainer = document.getElementById('alertContainer');

    // ============================================
    // STATE
    // ============================================

    let currentUser = null;
    let userData = null;
    let sections = [];
    let subjects = [];
    let schedules = [];
    let students = {};

    // Grade order
    const gradeOrder = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];
    const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    // ============================================
    // SESSION CHECK & AUTH
    // ============================================

    let sessionUser = null;
    try {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            sessionUser = JSON.parse(stored);
        }
    } catch(e) {}

    if (!sessionUser) {
        console.warn('⚠️ No active teacher session, redirecting...');
        window.location.replace('../auth/login.html');
        return;
    }

    if (sessionUser.role && sessionUser.role !== 'teacher') {
        const routes = {
            'admin': '../admin/dashboard.html',
            'student': '../student/dashboard.html',
            'parent': '../parents/dashboard.html',
            'registrar': '../registrar/dashboard.html'
        };
        window.location.replace(routes[sessionUser.role] || '../auth/login.html');
        return;
    }

    currentUser = { uid: sessionUser.uid, email: sessionUser.email };
    const displayName = (sessionUser.firstName ? `${sessionUser.firstName} ${sessionUser.lastName || ''}`.trim() : (sessionUser.email ? sessionUser.email.split('@')[0] : 'Teacher'));
    if (teacherName) teacherName.textContent = displayName;
    if (teacherInitial) teacherInitial.textContent = displayName.charAt(0).toUpperCase();

    // ============================================
    // LOGOUT
    // ============================================

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            console.log('🚪 Teacher logging out...');
            localStorage.removeItem('currentUser');
            localStorage.removeItem('hes_teacher_avatar');
            localStorage.removeItem('hes_teacher_name');
            window.location.replace('../auth/login.html');
        });
    }

    // ============================================
    // LOAD USER DATA
    // ============================================

    async function loadUserData(userId) {
        try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
                userData = userDoc.data();
                console.log('📋 User data loaded:', userData);
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    // ============================================
    // LOAD ALL DATA
    // ============================================

    async function loadAllData(userId) {
        try {
            // Load sections (adviser)
            await loadSections(userId);
            
            // Load subjects (from class schedules)
            await loadSubjects(userId);
            
            // Load schedule
            await loadSchedule(userId);
            
            // Load students per section
            await loadStudents();
            
            // Update UI
            updateStats();
            renderSections();
            renderSubjects();
            renderSchedule();
            
        } catch (error) {
            console.error('Error loading data:', error);
            showAlert('❌ Error loading classes: ' + error.message, 'error');
        }
    }

    // ============================================
    // LOAD SECTIONS
    // ============================================

    async function loadSections(userId) {
        try {
            const sectionsRef = collection(db, 'sections');
            const q = query(
                sectionsRef, 
                where('adviserId', '==', userId)
            );
            const snapshot = await getDocs(q);
            
            sections = [];
            snapshot.forEach((doc) => {
                sections.push({ id: doc.id, ...doc.data() });
            });
            
            console.log('📋 Sections loaded:', sections.length);
            
            // Listen for real-time updates
            onSnapshot(q, (snap) => {
                sections = [];
                snap.forEach((doc) => {
                    sections.push({ id: doc.id, ...doc.data() });
                });
                updateStats();
                renderSections();
            });
            
        } catch (error) {
            console.error('Error loading sections:', error);
            sections = [];
        }
    }

    // ============================================
    // LOAD SUBJECTS
    // ============================================

    async function loadSubjects(userId) {
        try {
            const classSchedulesRef = collection(db, 'classSchedules');
            const q = query(
                classSchedulesRef,
                where('teacherId', '==', userId),
                where('status', '==', 'active')
            );
            const snapshot = await getDocs(q);
            
            const subjectIds = new Set();
            const subjectData = {};
            
            snapshot.forEach((doc) => {
                const data = doc.data();
                if (data.subjectId) {
                    subjectIds.add(data.subjectId);
                    subjectData[data.subjectId] = {
                        subjectId: data.subjectId,
                        subjectName: data.subjectName || 'Unknown Subject',
                        gradeName: data.gradeName || 'N/A',
                        gradeId: data.gradeId
                    };
                }
            });
            
            subjects = Object.values(subjectData);
            console.log('📚 Subjects loaded:', subjects.length);
            
        } catch (error) {
            console.error('Error loading subjects:', error);
            subjects = [];
        }
    }

    // ============================================
    // LOAD SCHEDULE
    // ============================================

    async function loadSchedule(userId) {
        try {
            const classSchedulesRef = collection(db, 'classSchedules');
            const q = query(
                classSchedulesRef,
                where('teacherId', '==', userId),
                where('status', '==', 'active')
            );
            const snapshot = await getDocs(q);
            
            schedules = [];
            snapshot.forEach((doc) => {
                schedules.push({ id: doc.id, ...doc.data() });
            });
            
            console.log('📅 Schedule loaded:', schedules.length);
            
        } catch (error) {
            console.error('Error loading schedule:', error);
            schedules = [];
        }
    }

    // ============================================
    // LOAD STUDENTS
    // ============================================

    async function loadStudents() {
        try {
            const enrollmentsRef = collection(db, 'enrollments');
            const q = query(
                enrollmentsRef,
                where('status', '==', 'Enrolled')
            );
            const snapshot = await getDocs(q);
            
            students = {};
            snapshot.forEach((doc) => {
                const data = doc.data();
                const gradeId = data.gradeId || data.grade;
                if (gradeId) {
                    if (!students[gradeId]) {
                        students[gradeId] = [];
                    }
                    students[gradeId].push({
                        id: data.userId,
                        name: data.name || 'Unknown Student',
                        idNumber: data.idNumber || 'N/A'
                    });
                }
            });
            
            console.log('👨‍🎓 Students loaded:', Object.keys(students).length);
            
        } catch (error) {
            console.error('Error loading students:', error);
            students = {};
        }
    }

    // ============================================
    // UPDATE STATS
    // ============================================

    function updateStats() {
        totalSections.textContent = sections.length;
        totalSubjects.textContent = subjects.length;
        
        let studentCount = 0;
        Object.values(students).forEach((studentList) => {
            studentCount += studentList.length;
        });
        totalStudents.textContent = studentCount || sections.length * 20;
    }

    // ============================================
    // RENDER SECTIONS
    // ============================================

    function renderSections() {
        if (sections.length === 0) {
            advisoryContainer.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-users"></i>
                    <h3>No Advisory Classes</h3>
                    <p>You are not assigned as adviser to any section yet.</p>
                </div>
            `;
            return;
        }

        advisoryContainer.innerHTML = sections.map(section => {
            const studentCount = students[section.gradeId]?.length || section.studentCount || 0;
            const studentList = students[section.gradeId]?.slice(0, 5) || [];

            return `
                <div class="class-card">
                    <div class="class-header">
                        <h3><i class="fas fa-users"></i> ${section.sectionName || section.name || 'Unknown Section'}</h3>
                        <span class="class-badge">Adviser</span>
                    </div>
                    <div class="class-body">
                        <div class="class-info">
                            <div class="class-info-item">
                                <div class="class-info-value">${section.gradeName || section.grade || 'N/A'}</div>
                                <div class="class-info-label">Grade Level</div>
                            </div>
                            <div class="class-info-item">
                                <div class="class-info-value">${studentCount}</div>
                                <div class="class-info-label">Students</div>
                            </div>
                        </div>

                        <div class="student-list">
                            <h4>Recent Students</h4>
                            ${studentList.length > 0 ? studentList.map(student => `
                                <div class="student-item">
                                    <div class="student-avatar">${student.name.charAt(0).toUpperCase()}</div>
                                    <div class="student-name">${student.name}</div>
                                    <div class="student-id">${student.idNumber}</div>
                                </div>
                            `).join('') : '<p class="no-students">No students enrolled yet</p>'}
                            ${studentList.length > 0 ? `
                                <a href="view-section.html?id=${section.id || ''}" class="view-all-link">View All Students & Attendance <i class="fas fa-arrow-right"></i></a>
                            ` : ''}
                        </div>

                        <div class="class-actions">
                            <a href="grades.html" class="class-action-btn btn-grades"><i class="fas fa-star"></i> Grades</a>
                            <a href="view-section.html?id=${section.id || ''}" class="class-action-btn btn-students"><i class="fas fa-clipboard-check"></i> Attendance & Section</a>
                            <a href="class-program.html" class="class-action-btn btn-schedule"><i class="fas fa-calendar-alt"></i> Class Program</a>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ============================================
    // RENDER SUBJECTS
    // ============================================

    function renderSubjects() {
        if (subjects.length === 0) {
            subjectsContainer.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-book"></i>
                    <h3>No Subjects Assigned</h3>
                    <p>You are not assigned to teach any subjects yet.</p>
                    <p style="font-size: 13px; margin-top: 10px;">Subjects will appear here once you have class schedules.</p>
                </div>
            `;
            return;
        }

        // Group subjects by grade
        const subjectsByGrade = {};
        subjects.forEach(subject => {
            const grade = subject.gradeName || 'Unknown';
            if (!subjectsByGrade[grade]) {
                subjectsByGrade[grade] = [];
            }
            subjectsByGrade[grade].push(subject);
        });

        let html = '<div class="subjects-accordion">';
        
        gradeOrder.forEach(gradeName => {
            const subjectList = subjectsByGrade[gradeName] || [];
            if (subjectList.length === 0) return;

            const gradeId = gradeName.replace(/\s/g, '_');

            html += `
                <div class="grade-section">
                    <div class="grade-header" onclick="window.toggleGrade('${gradeId}')">
                        <div class="grade-title">
                            <i class="fas fa-graduation-cap"></i>
                            <span>${gradeName}</span>
                            <span class="subject-count">(${subjectList.length} subjects)</span>
                        </div>
                        <i class="fas fa-chevron-down toggle-icon" id="icon_${gradeId}"></i>
                    </div>
                    <div class="grade-content" id="content_${gradeId}">
                        <div class="subject-list">
                            ${subjectList.map(subject => `
                                <div class="subject-item">
                                    <div class="subject-info">
                                        <h4>${subject.subjectName || subject.name || 'Unknown Subject'}</h4>
                                        <p><i class="fas fa-layer-group"></i> Grade: ${subject.gradeName || 'N/A'}</p>
                                    </div>
                                    <div class="subject-actions">
                                        <a href="#" class="subject-action-btn grades"><i class="fas fa-star"></i> Grades</a>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        subjectsContainer.innerHTML = html;
    }

    // ============================================
    // RENDER SCHEDULE
    // ============================================

    function renderSchedule() {
        if (schedules.length === 0) {
            scheduleContainer.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-calendar-alt"></i>
                    <h3>No Schedule Found</h3>
                    <p>You don't have any class schedule assigned yet.</p>
                    <p style="font-size: 13px; margin-top: 10px;">Please contact the administrator to set up your teaching schedule.</p>
                </div>
            `;
            return;
        }

        // Organize schedule by day
        const scheduleByDay = {};
        daysOrder.forEach(day => {
            scheduleByDay[day] = schedules.filter(s => s.dayName === day);
        });

        // Sort schedules by time
        Object.keys(scheduleByDay).forEach(day => {
            scheduleByDay[day].sort((a, b) => {
                return (a.startTime || '').localeCompare(b.startTime || '');
            });
        });

        let html = `
            <div class="schedule-grid">
                ${daysOrder.map(day => `
                    <div class="day-column">
                        <div class="day-header">${day}</div>
                        ${scheduleByDay[day] && scheduleByDay[day].length > 0 ? 
                            scheduleByDay[day].map(schedule => `
                                <div class="time-slot">
                                    <div class="time">${formatTime(schedule.startTime)} - ${formatTime(schedule.endTime)}</div>
                                    <div class="class-name">${schedule.subjectName || 'Unknown Subject'}</div>
                                    <div class="section-name"><i class="fas fa-users"></i> ${schedule.sectionName || 'N/A'}</div>
                                    <div class="grade-name"><i class="fas fa-graduation-cap"></i> ${schedule.gradeName || 'N/A'}</div>
                                    ${schedule.room ? `<div class="room-name"><i class="fas fa-door-open"></i> ${schedule.room}</div>` : ''}
                                </div>
                            `).join('') 
                            : `<div class="empty-slot">No classes scheduled</div>`
                        }
                    </div>
                `).join('')}
            </div>
        `;

        scheduleContainer.innerHTML = html;
    }

    // ============================================
    // TOGGLE GRADE SECTION
    // ============================================

    window.toggleGrade = function(gradeId) {
        const content = document.getElementById('content_' + gradeId);
        const icon = document.getElementById('icon_' + gradeId);

        if (content) {
            content.classList.toggle('active');
            if (icon) icon.classList.toggle('rotated');
        }
    };

    // ============================================
    // HELPERS
    // ============================================

    function formatTime(timeStr) {
        if (!timeStr) return 'N/A';
        try {
            const [hours, minutes] = timeStr.split(':');
            const h = parseInt(hours);
            const ampm = h >= 12 ? 'PM' : 'AM';
            const h12 = h % 12 || 12;
            return `${h12}:${minutes} ${ampm}`;
        } catch {
            return timeStr;
        }
    }

    // ============================================
    // TAB SWITCHING
    // ============================================

    document.addEventListener('DOMContentLoaded', function() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const tabId = this.getAttribute('data-tab');

                tabBtns.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active-tab'));

                this.classList.add('active');
                document.getElementById(tabId).classList.add('active-tab');
            });
        });
    });

    // ============================================
    // SET CURRENT DATE
    // ============================================

    const dateBadge = document.querySelector('.date-badge');
    if (dateBadge) {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateBadge.innerHTML = `<i class="fas fa-calendar-alt"></i> ${now.toLocaleDateString('en-US', options)}`;
    }

    // ============================================
    // ALERT SYSTEM
    // ============================================

    function showAlert(message, type = 'success') {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            ${message}
        `;
        alertContainer.appendChild(alertDiv);

        setTimeout(() => {
            alertDiv.style.opacity = '0';
            setTimeout(() => alertDiv.remove(), 300);
        }, 5000);
    }

    console.log('✅ My Classes ready!');

})();