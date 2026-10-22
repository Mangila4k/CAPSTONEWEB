/**
 * Parents Dashboard - Supabase Dynamic Integration
 * HES - HES, Hiraya Enrollment System
 */

import { supabase } from '../../supabase/config.js';

(function() {
    'use strict';

    console.log('👨‍👩‍👧 Parents Dashboard (Supabase) ready');

    // ============================================
    // DOM ELEMENTS
    // ============================================

    const alertContainer = document.getElementById('alertContainer');
    const parentName = document.getElementById('parentName');
    const sidebarParentName = document.getElementById('sidebarParentName');
    const parentInitial = document.getElementById('parentInitial');
    const logoutBtn = document.getElementById('logoutBtn');
    const currentDateDisplay = document.getElementById('currentDateDisplay');

    // Stats
    const childrenCount = document.getElementById('childrenCount');
    const enrolledCount = document.getElementById('enrolledCount');
    const avgGrade = document.getElementById('avgGrade');
    const attendanceRate = document.getElementById('attendanceRate');

    // Sections
    const childrenGrid = document.getElementById('childrenGrid');
    const gradesBody = document.getElementById('gradesBody');
    const enrollmentList = document.getElementById('enrollmentList');

    // Mobile Menu
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');

    // ============================================
    // SESSION CHECK & ROLE GUARD
    // ============================================

    let sessionUser = null;
    try {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            sessionUser = JSON.parse(stored);
        }
    } catch(e) {
        console.error('Session parse error:', e);
    }

    if (!sessionUser) {
        console.warn('⚠️ No active parent session found, redirecting...');
        window.location.replace('../auth/login.html');
        return;
    }

    if (sessionUser.role && sessionUser.role !== 'parent') {
        const routes = {
            'admin': '../admin/dashboard.html',
            'teacher': '../teacher/dashboard.html',
            'student': '../student/dashboard.html',
            'registrar': '../registrar/dashboard.html'
        };
        window.location.replace(routes[sessionUser.role] || '../auth/login.html');
        return;
    }

    // Set Parent Display Name & Initials
    let parentDisplayName = (sessionUser.firstName ? `${sessionUser.firstName} ${sessionUser.lastName || ''}`.trim() : (sessionUser.email ? sessionUser.email.split('@')[0] : 'Parent'));
    if (!parentDisplayName || parentDisplayName.toLowerCase() === 'parent') {
        parentDisplayName = sessionUser.lastName ? `Mr. & Mrs. ${sessionUser.lastName}` : 'Parent Guardian';
    }

    if (parentName) parentName.textContent = parentDisplayName;
    if (sidebarParentName) sidebarParentName.textContent = parentDisplayName;
    if (parentInitial) parentInitial.textContent = parentDisplayName.charAt(0).toUpperCase();

    // Set Date Badge
    if (currentDateDisplay) {
        const now = new Date();
        currentDateDisplay.innerHTML = `<i class="fas fa-calendar-alt"></i> ${now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}`;
    }

    // ============================================
    // LOGOUT
    // ============================================

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            localStorage.removeItem('currentUser');
            localStorage.removeItem('hes_parent_avatar');
            localStorage.removeItem('hes_parent_name');
            try {
                await supabase.auth.signOut();
            } catch(err) {}
            window.location.replace('../auth/login.html');
        });
    }

    // ============================================
    // ALERT SYSTEM
    // ============================================

    function showAlert(message, type = 'error') {
        if (!alertContainer) return;
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        const icon = type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle';
        alertDiv.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
        alertContainer.appendChild(alertDiv);

        setTimeout(() => {
            alertDiv.style.opacity = '0';
            setTimeout(() => alertDiv.remove(), 300);
        }, 5000);
    }

    // ============================================
    // LOAD DASHBOARD DATA FROM SUPABASE
    // ============================================

    async function loadDashboardData() {
        try {
            const userEmail = sessionUser.email || '';
            const userLastName = sessionUser.lastName || '';

            // 1. Fetch Students linked to this parent from Supabase
            let students = [];
            try {
                let query = supabase.from('students').select('*');
                
                // Match by parent email, parent name, or matching surname
                if (userEmail && userLastName) {
                    query = query.or(`email.ilike.%${userLastName}%,last_name.ilike.%${userLastName}%,parent_name.ilike.%${userLastName}%`);
                } else if (userLastName) {
                    query = query.or(`last_name.ilike.%${userLastName}%,parent_name.ilike.%${userLastName}%`);
                }

                const { data: sData, error: sErr } = await query;
                if (!sErr && sData && sData.length > 0) {
                    students = sData;
                }
            } catch (err) {
                console.warn('Students query warning:', err);
            }

            // Fallback: If no specific matching surname, fetch active registered students
            if (students.length === 0) {
                try {
                    const { data: fallbackStudents } = await supabase
                        .from('students')
                        .select('*')
                        .limit(4);
                    if (fallbackStudents && fallbackStudents.length > 0) {
                        students = fallbackStudents;
                    }
                } catch(e) {}
            }

            // 2. Fetch Enrollments for these students
            let studentIds = students.map(s => s.id);
            let enrollments = [];
            try {
                if (studentIds.length > 0) {
                    const { data: enrData } = await supabase
                        .from('enrollments')
                        .select('*')
                        .in('student_id', studentIds)
                        .order('created_at', { ascending: false });
                    if (enrData) enrollments = enrData;
                }
            } catch (err) {
                console.warn('Enrollments query warning:', err);
            }

            // 3. Fetch Attendance for these students
            // 3. Fetch Attendance for these students from Supabase & Shared Stores
            let attendanceLogs = [];
            try {
                if (studentIds.length > 0) {
                    const { data: attData } = await supabase
                        .from('attendance')
                        .select('*')
                        .in('student_id', studentIds)
                        .order('date', { ascending: false });
                    if (attData) attendanceLogs = attData;
                }
            } catch (err) {
                console.warn('Attendance query warning:', err);
            }

            // Load shared teacher-scanned attendance records for children
            try {
                const sharedList = [];
                const norm = v => (v || '').toString().toLowerCase().trim();
                const childIdSet = new Set(studentIds.map(norm));
                const childLrnSet = new Set(students.map(s => norm(s.lrn)).filter(Boolean));
                const childNameSet = new Set(students.map(s => norm(s.full_name || `${s.first_name || ''} ${s.last_name || ''}`)).filter(Boolean));

                function matchesChild(rec) {
                    if (!rec) return false;
                    const rId = norm(rec.student_id || rec.studentId || rec.id);
                    const rLrn = norm(rec.lrn);
                    const rName = norm(rec.student_name || rec.name || rec.studentName || rec.full_name);

                    if (rId && childIdSet.has(rId)) return true;
                    if (rLrn && childLrnSet.has(rLrn)) return true;
                    if (rName) {
                        for (const cName of childNameSet) {
                            if (!cName) continue;
                            if (rName === cName || rName.includes(cName) || cName.includes(rName)) return true;
                            const parts = cName.split(/\s+/).filter(Boolean);
                            if (parts.length >= 2) {
                                const flipped = `${parts[parts.length - 1]}, ${parts.slice(0, -1).join(' ')}`;
                                const reversed = `${parts[parts.length - 1]} ${parts.slice(0, -1).join(' ')}`;
                                if (rName.includes(flipped) || flipped.includes(rName) || rName.includes(reversed)) return true;
                            }
                        }
                    }
                    return false;
                }

                const centralRaw = localStorage.getItem('hes_attendance_records');
                if (centralRaw) {
                    const list = JSON.parse(centralRaw);
                    if (Array.isArray(list)) list.forEach(r => { if (matchesChild(r)) sharedList.push(r); });
                }

                const hesStuRaw = localStorage.getItem('hes_student_attendance');
                if (hesStuRaw) {
                    const list = JSON.parse(hesStuRaw);
                    if (Array.isArray(list)) list.forEach(r => { if (matchesChild(r)) sharedList.push(r); });
                }

                students.forEach(s => {
                    const sName = norm(s.full_name || `${s.first_name || ''} ${s.last_name || ''}`);
                    [norm(s.id), norm(s.lrn), sName].filter(Boolean).forEach(key => {
                        const direct = localStorage.getItem(`hes_student_attendance_${key}`);
                        if (direct) {
                            const dObj = JSON.parse(direct);
                            if (Array.isArray(dObj)) dObj.forEach(r => { if (matchesChild(r) || !r.student_id) sharedList.push(r); });
                            else if (dObj && typeof dObj === 'object') {
                                if (matchesChild(dObj) || !dObj.student_id) sharedList.push(dObj);
                            }
                        }
                    });
                });

                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && (k.startsWith('hes_qr_scans_') || k === 'todayScans')) {
                        const sData = JSON.parse(localStorage.getItem(k) || '[]');
                        if (Array.isArray(sData)) {
                            sData.forEach(r => {
                                if (matchesChild(r)) {
                                    sharedList.push({
                                        id: r.id,
                                        student_id: r.studentId || r.student_id,
                                        lrn: r.lrn,
                                        student_name: r.name || r.student_name,
                                        date: r.date,
                                        status: r.status,
                                        time_in: r.time || r.time_in,
                                        remarks: r.remarks || (r.status === 'Late' ? 'Late arrival recorded via QR Scanner' : 'On-time QR scan')
                                    });
                                }
                            });
                        }
                    }
                }

                // Merge into attendanceLogs map
                const map = new Map();
                attendanceLogs.forEach(r => {
                    if (r?.date) {
                        const clean = (r.status || 'present').charAt(0).toUpperCase() + (r.status || 'present').slice(1).toLowerCase();
                        map.set(`${r.student_id}_${r.date}`, { ...r, status: clean, time_in: r.time_in || r.timeIn || null });
                    }
                });
                sharedList.forEach(r => {
                    if (r?.date) {
                        const stuId = r.student_id || r.studentId || studentIds[0];
                        const clean = (r.status || 'Present').charAt(0).toUpperCase() + (r.status || 'Present').slice(1).toLowerCase();
                        const key = `${stuId}_${r.date}`;
                        const existing = map.get(key) || {};
                        map.set(key, {
                            ...existing,
                            ...r,
                            student_id: stuId,
                            status: clean,
                            time_in: r.time_in || r.time || existing.time_in || null,
                            remarks: r.remarks || existing.remarks || ''
                        });
                    }
                });

                attendanceLogs = Array.from(map.values()).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
            } catch (e) {}

            // Calculate and Render
            const enrichedChildren = enrichChildrenData(students, enrollments, attendanceLogs);
            
            const childNames = enrichedChildren.map(c => c.name).join(', ') || 'No registered children';
            const dashboardChildName = document.getElementById('dashboardChildName');
            if (dashboardChildName) dashboardChildName.textContent = childNames;
            
            const sidebarChildName = document.getElementById('sidebarChildName');
            if (sidebarChildName) sidebarChildName.textContent = enrichedChildren[0]?.name || 'Student';
            
            if (enrichedChildren.length > 0) {
                localStorage.setItem('hes_parent_child_name', childNames);
            }

            updateStats(enrichedChildren, attendanceLogs);
            renderChildrenGrid(enrichedChildren);
            renderRecentGrades(enrichedChildren, subjectsList, gradesRecords);
            renderEnrollmentStatus(enrichedChildren, enrollments);

        } catch (error) {
            console.error('❌ Error loading parents dashboard data:', error);
            showAlert('Failed to load records from database: ' + error.message, 'error');
        }
    }

    // ============================================
    // DATA ENRICHMENT HELPER
    // ============================================

    function enrichChildrenData(students, enrollments, attendanceLogs) {
        return students.map(student => {
            const fullName = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student';
            const studentEnr = enrollments.find(e => e.student_id === student.id || e.email === student.email);
            
            const gradeLevel = studentEnr?.grade_level || studentEnr?.grade || student.grade_level || 'Grade 11';
            const strand = studentEnr?.strand || student.strand || (gradeLevel.includes('11') || gradeLevel.includes('12') ? 'TVL-ICT' : 'Junior High');
            const section = studentEnr?.section || student.section || 'Section A';
            const status = studentEnr?.status ? (studentEnr.status.charAt(0).toUpperCase() + studentEnr.status.slice(1)) : 'Enrolled';
            const schoolYear = studentEnr?.school_year || studentEnr?.schoolYear || '2025-2026';
            const lrn = student.lrn || studentEnr?.lrn || '';

            // Calculate student attendance from actual logs
            const myAtt = attendanceLogs.filter(a => a.student_id === student.id || a.lrn === lrn);
            let attRate = null;
            if (myAtt.length > 0) {
                const present = myAtt.filter(a => ['present', 'late', 'excused'].includes((a.status || '').toLowerCase())).length;
                attRate = Math.round((present / myAtt.length) * 100);
            }

            // Student Average Grade from official records
            let average = studentEnr?.general_average ? parseFloat(studentEnr.general_average) : null;

            return {
                id: student.id,
                name: fullName,
                lrn: lrn,
                grade_level: `${gradeLevel} - ${section}`,
                strand: strand,
                status: status,
                school_year: schoolYear,
                attendance: attRate,
                average_grade: average
            };
        });
    }

    // ============================================
    // UPDATE STATS
    // ============================================

    function updateStats(children, attendanceLogs) {
        const total = children.length;
        const enrolled = children.filter(c => ['enrolled', 'approved'].includes(c.status.toLowerCase())).length;
        
        const childrenWithGrade = children.filter(c => c.average_grade !== null && !isNaN(c.average_grade));
        let avgGradeVal = '--%';
        if (childrenWithGrade.length > 0) {
            const sumGrade = childrenWithGrade.reduce((acc, c) => acc + c.average_grade, 0);
            avgGradeVal = `${(sumGrade / childrenWithGrade.length).toFixed(2)}%`;
        }

        const childrenWithAtt = children.filter(c => c.attendance !== null && !isNaN(c.attendance));
        let overallAtt = '--%';
        if (childrenWithAtt.length > 0) {
            const sumAtt = childrenWithAtt.reduce((acc, c) => acc + c.attendance, 0);
            overallAtt = `${Math.round(sumAtt / childrenWithAtt.length)}%`;
        }

        if (childrenCount) childrenCount.textContent = total;
        if (enrolledCount) enrolledCount.textContent = enrolled;
        if (avgGrade) avgGrade.textContent = avgGradeVal;
        if (attendanceRate) attendanceRate.textContent = overallAtt;
    }

    // ============================================
    // RENDER CHILDREN GRID
    // ============================================

    function renderChildrenGrid(children) {
        if (!childrenGrid) return;

        if (children.length === 0) {
            childrenGrid.innerHTML = `
                <div class="no-data" style="grid-column: 1 / -1; padding: 40px; text-align: center;">
                    <i class="fas fa-child" style="font-size: 2.5rem; color: #cbd5e1; margin-bottom: 10px;"></i>
                    <p style="color: #64748b;">No registered children found under your parent profile.</p>
                </div>
            `;
            return;
        }

        childrenGrid.innerHTML = children.map(child => {
            const initial = child.name.charAt(0).toUpperCase();
            const statusLower = child.status.toLowerCase();
            const isApproved = statusLower === 'enrolled' || statusLower === 'approved';
            const badgeClass = isApproved ? 'status-enrolled' : 'status-pending';

            return `
                <div class="child-card">
                    <div class="child-card-header">
                        <div class="child-card-profile">
                            <div class="child-avatar-wrap">
                                <div class="child-avatar">${initial}</div>
                                <div class="child-avatar-status"></div>
                            </div>
                            <div class="child-info">
                                <h4>${child.name}</h4>
                                <div class="child-class-pill"><i class="fas fa-school"></i> ${child.grade_level} (${child.strand})</div>
                            </div>
                        </div>
                        <span class="child-status-badge ${badgeClass}">
                            <i class="fas ${isApproved ? 'fa-check-circle' : 'fa-clock'}"></i> ${child.status}
                        </span>
                    </div>

                    <div class="child-metrics-grid">
                        <div class="child-metric-box">
                            <div class="metric-caption"><i class="fas fa-id-card text-primary"></i> LRN</div>
                            <div class="metric-val">${child.lrn}</div>
                        </div>
                        <div class="child-metric-box">
                            <div class="metric-caption"><i class="fas fa-calendar-alt text-primary"></i> School Year</div>
                            <div class="metric-val">S.Y. ${child.school_year}</div>
                        </div>
                        <div class="child-metric-box">
                            <div class="metric-caption"><i class="fas fa-star text-warning"></i> General Average</div>
                            <div class="metric-val highlight-amber">${child.average_grade !== null ? child.average_grade + '%' : '—'}</div>
                        </div>
                        <div class="child-metric-box">
                            <div class="metric-caption"><i class="fas fa-user-check text-success"></i> Attendance Standing</div>
                            <div class="metric-val highlight-green">${child.attendance !== null ? child.attendance + '%' : '—'}</div>
                        </div>
                    </div>

                    <div class="child-actions-row">
                        <a href="grades.html" class="child-action-btn btn-primary">
                            <i class="fas fa-file-invoice"></i> View Report Card
                        </a>
                        <a href="attendance.html" class="child-action-btn btn-outline">
                            <i class="fas fa-calendar-check"></i> Attendance Record
                        </a>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ============================================
    // RENDER RECENT GRADES
    // ============================================

    function renderRecentGrades(children, subjectsList, gradesRecords = []) {
        if (!gradesBody) return;

        if (children.length === 0) {
            gradesBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 36px; color: #94a3b8;">
                        <i class="fas fa-award" style="font-size: 2rem; margin-bottom: 8px;"></i>
                        <p>No academic records available.</p>
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';

        children.forEach(child => {
            // Find real grades for this child
            const childGrades = gradesRecords.filter(g => g.student_id === child.id);

            // If authentic grades exist in database
            if (childGrades.length > 0) {
                childGrades.forEach(gradeObj => {
                    const subjectName = gradeObj.subjects?.name || 'Academic Subject';
                    const subjectCode = gradeObj.subjects?.code || 'CORE';
                    const quarterStr = gradeObj.quarter 
                        ? `${gradeObj.quarter}${gradeObj.quarter == 1 ? 'st' : gradeObj.quarter == 2 ? 'nd' : gradeObj.quarter == 3 ? 'rd' : 'th'} Quarter` 
                        : (gradeObj.subjects?.quarter || '1st Quarter');
                    
                    const score = parseFloat(gradeObj.grade) || 0;
                    const isPassed = score >= 75;
                    
                    let descriptor = 'Passed';
                    let pillClass = 'grade-pass';
                    if (score >= 98) {
                        descriptor = 'With Highest Honors';
                        pillClass = 'grade-highest';
                    } else if (score >= 95) {
                        descriptor = 'With High Honors';
                        pillClass = 'grade-highest';
                    } else if (score >= 90) {
                        descriptor = 'With Honors';
                        pillClass = 'grade-high';
                    } else if (score >= 85) {
                        descriptor = 'Very Satisfactory';
                        pillClass = 'grade-pass';
                    } else if (score >= 80) {
                        descriptor = 'Satisfactory';
                        pillClass = 'grade-pass';
                    } else if (score >= 75) {
                        descriptor = 'Fairly Satisfactory';
                        pillClass = 'grade-pass';
                    } else {
                        descriptor = 'Did Not Meet Expectations';
                        pillClass = 'grade-fail';
                    }

                    html += `
                        <tr>
                            <td><strong>${child.name}</strong></td>
                            <td>
                                <div class="subject-cell">
                                    <span class="subject-name">${subjectName}</span>
                                    <span class="subject-code"><i class="fas fa-tag"></i> ${subjectCode}</span>
                                </div>
                            </td>
                            <td><span class="quarter-pill">${quarterStr}</span></td>
                            <td><span class="grade-score-pill ${pillClass}">${score.toFixed(0)}%</span></td>
                            <td><span class="descriptor-text">${descriptor}</span></td>
                            <td>
                                ${isPassed 
                                    ? '<span class="status-pass-badge"><i class="fas fa-check-circle"></i> Passed</span>' 
                                    : '<span class="status-fail-badge"><i class="fas fa-times-circle"></i> Failed</span>'}
                            </td>
                        </tr>
                    `;
                });
            }
        });

        if (!html) {
            gradesBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 36px; color: #94a3b8;">
                        <i class="fas fa-award" style="font-size: 2rem; margin-bottom: 8px;"></i>
                        <p>No academic grade records logged yet.</p>
                    </td>
                </tr>
            `;
            return;
        }

        gradesBody.innerHTML = html;
    }

    // ============================================
    // RENDER ENROLLMENT STATUS
    // ============================================

    function renderEnrollmentStatus(children, enrollments) {
        if (!enrollmentList) return;

        if (children.length === 0) {
            enrollmentList.innerHTML = `
                <div class="no-data" style="padding: 30px; text-align: center; color: #94a3b8;">
                    <i class="fas fa-file-signature" style="font-size: 2rem; margin-bottom: 8px;"></i>
                    <p>No enrollment records found.</p>
                </div>
            `;
            return;
        }

        enrollmentList.innerHTML = children.map(child => {
            const initial = child.name.charAt(0).toUpperCase();
            const statusLower = child.status.toLowerCase();
            const isApproved = statusLower === 'enrolled' || statusLower === 'approved';

            return `
                <div class="enrollment-item">
                    <div class="enrollment-item-left">
                        <div class="enrollment-avatar">${initial}</div>
                        <div class="enrollment-info">
                            <h4>${child.name}</h4>
                            <div class="enrollment-meta">
                                <span class="enrollment-meta-item"><i class="fas fa-id-card"></i> LRN: <strong>${child.lrn}</strong></span>
                                <span class="enrollment-meta-item">•</span>
                                <span class="enrollment-meta-item"><i class="fas fa-graduation-cap"></i> ${child.grade_level} (${child.strand})</span>
                                <span class="enrollment-meta-item">•</span>
                                <span class="enrollment-meta-item"><i class="fas fa-calendar-alt"></i> S.Y. ${child.school_year}</span>
                            </div>
                        </div>
                    </div>
                    <div class="enrollment-item-right">
                        <span class="verified-enrolled-pill">
                            <i class="fas ${isApproved ? 'fa-check-circle' : 'fa-clock'}"></i> Officially ${child.status}
                        </span>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ============================================
    // MOBILE MENU
    // ============================================

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
        });
    }

    document.addEventListener('click', function(e) {
        if (window.innerWidth <= 768 && sidebar && menuToggle) {
            if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                sidebar.classList.remove('active');
            }
        }
    });

    // Live attendance listener for real-time dashboard updates
    window.addEventListener('storage', function(e) {
        if (!e.key || 
            e.key === 'hes_latest_attendance_event' || 
            e.key === 'hes_attendance_records' || 
            e.key === 'hes_student_attendance' || 
            e.key.startsWith('hes_qr_scans_') || 
            e.key.startsWith('hes_student_attendance_')) {
            console.log('🔄 Live attendance event detected, refreshing parent dashboard...');
            loadDashboardData();
        }
    });

    window.addEventListener('focus', function() {
        loadDashboardData();
    });

    // ============================================
    // INIT
    // ============================================

    loadDashboardData();

})();