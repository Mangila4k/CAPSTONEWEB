// ===== REGISTRAR SECTIONS JAVASCRIPT (SUPABASE POWERED) =====
import { supabase } from '../../supabase/config.js';

document.addEventListener('DOMContentLoaded', async function() {
    'use strict';

    console.log('📚 Registrar Sections Management ready (Supabase dynamic)');

    // DOM Elements
    const adminName = document.getElementById('adminName');
    const adminInitial = document.getElementById('adminInitial');
    const logoutBtn = document.getElementById('logoutBtn');
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const alertContainer = document.getElementById('alertContainer');

    // Stats
    const totalSections = document.getElementById('totalSections');
    const totalStudents = document.getElementById('totalStudents');
    const sectionsWithAdviser = document.getElementById('sectionsWithAdviser');
    const currentYear = document.getElementById('currentYear');

    // Filters
    const gradeFilter = document.getElementById('gradeFilter');
    const searchInput = document.getElementById('searchInput');
    const sectionsGrid = document.getElementById('sectionsGrid');

    // Add Modal
    const addModal = document.getElementById('addModal');
    const addSectionForm = document.getElementById('addSectionForm');
    const addSectionName = document.getElementById('addSectionName');
    const addGradeId = document.getElementById('addGradeId');
    const addAdviserName = document.getElementById('addAdviserName');

    // Edit Modal
    const editModal = document.getElementById('editModal');
    const editSectionForm = document.getElementById('editSectionForm');
    const editSectionId = document.getElementById('editSectionId');
    const editSectionName = document.getElementById('editSectionName');
    const editGradeId = document.getElementById('editGradeId');
    const editAdviserName = document.getElementById('editAdviserName');
    const editWarning = document.getElementById('editWarning');
    const editStudentCount = document.getElementById('editStudentCount');

    // State
    let sections = [];
    let teachers = [];
    let studentsCountMap = {};
    const gradeLevels = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];

    // ===== ALERT HELPER =====
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

    // ===== SET REGISTRAR NAME =====
    try {
        const currentUserStr = localStorage.getItem('currentUser');
        if (currentUserStr) {
            const user = JSON.parse(currentUserStr);
            const name = user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (user.displayName || (user.email ? user.email.split('@')[0] : 'Registrar'));
            if (adminName) adminName.textContent = name;
            if (adminInitial) adminInitial.textContent = name.charAt(0).toUpperCase();
        }
    } catch(e) {}

    // ===== LOGOUT =====
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            localStorage.removeItem('currentUser');
            try { await supabase.auth.signOut(); } catch(err) {}
            window.location.replace('../auth/login.html');
        });
    }

    // ===== MOBILE MENU TOGGLE =====
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
        });
    }

    // ===== DATA FETCHING =====
    async function loadTeachers() {
        try {
            const { data, error } = await supabase
                .from('teachers')
                .select(`
                    id,
                    user_id,
                    employee_id,
                    users:user_id (
                        id,
                        first_name,
                        last_name,
                        email
                    )
                `);

            if (error) throw error;

            teachers = (data || []).map(t => {
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
        } catch (err) {
            console.error('Error loading teachers:', err);
        }
    }

    function getAdviserName(sectionOrId) {
        if (!sectionOrId) return null;
        if (typeof sectionOrId === 'object' && sectionOrId !== null) {
            if (sectionOrId.adviser_name) return sectionOrId.adviser_name;
            if (sectionOrId.adviser_id) {
                const teacher = teachers.find(t => t.id === sectionOrId.adviser_id || t.user_id === sectionOrId.adviser_id);
                if (teacher) return teacher.name;
            }
            return null;
        }
        const teacher = teachers.find(t => t.id === sectionOrId || t.user_id === sectionOrId);
        return teacher ? teacher.name : null;
    }

    // ===== GRADE & SECTION SORTING HELPERS =====
    function getGradeOrder(gradeLevel) {
        if (!gradeLevel) return 999;
        const match = String(gradeLevel).match(/\d+/);
        return match ? parseInt(match[0], 10) : 999;
    }

    function compareSections(a, b) {
        const gradeA = getGradeOrder(a.grade_level);
        const gradeB = getGradeOrder(b.grade_level);
        if (gradeA !== gradeB) {
            return gradeA - gradeB;
        }
        const nameA = String(a.name || '').trim().toLowerCase();
        const nameB = String(b.name || '').trim().toLowerCase();
        return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    }

    function populateGradeFilter() {
        if (!gradeFilter) return;
        gradeFilter.innerHTML = '<option value="">All Grades</option>' +
            gradeLevels.map(g => `<option value="${g}">${g}</option>`).join('');
    }

    async function loadSections() {
        try {
            if (sectionsGrid) {
                sectionsGrid.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 40px;">
                        <i class="fas fa-spinner fa-spin" style="font-size: 32px; color: #0b2b4a;"></i>
                        <p style="margin-top: 12px; color: #64748b;">Loading sections from database...</p>
                    </div>
                `;
            }

            const { data: secData, error: secErr } = await supabase
                .from('sections')
                .select('*');

            if (secErr) throw secErr;
            sections = (secData || []).sort(compareSections);

            // Fetch student counts per section
            studentsCountMap = {};
            let totalStudentsCount = 0;
            try {
                const { data: stdData } = await supabase
                    .from('students')
                    .select('id, section_id');

                if (stdData) {
                    totalStudentsCount = stdData.length;
                    stdData.forEach(s => {
                        if (s.section_id) {
                            studentsCountMap[s.section_id] = (studentsCountMap[s.section_id] || 0) + 1;
                        }
                    });
                }
            } catch(e) {}

            updateStats(totalStudentsCount);
            renderSections();
        } catch (err) {
            console.error('Error loading sections:', err);
            showAlert('Failed to load sections: ' + err.message, 'error');
            if (sectionsGrid) {
                sectionsGrid.innerHTML = `
                    <div class="no-data">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h3>Failed to load sections</h3>
                        <p>${err.message}</p>
                    </div>
                `;
            }
        }
    }

    // ===== UI RENDERING =====
    function updateStats(studentCount = 0) {
        const total = sections.length;
        const withAdviser = sections.filter(s => !!(s.adviser_name || s.adviser_id)).length;

        if (totalSections) totalSections.textContent = total;
        if (totalStudents) totalStudents.textContent = studentCount;
        if (sectionsWithAdviser) sectionsWithAdviser.textContent = withAdviser;
        if (currentYear) currentYear.textContent = new Date().getFullYear();
    }

    function renderSections() {
        if (!sectionsGrid) return;

        const grade = gradeFilter ? gradeFilter.value : '';
        const search = searchInput ? searchInput.value.toLowerCase().trim() : '';

        let filtered = [...sections].sort(compareSections);

        if (grade) {
            const cleanGradeNum = grade.replace('Grade ', '').trim();
            filtered = filtered.filter(s => {
                const sGrade = String(s.grade_level || '').trim();
                return sGrade === grade || sGrade === cleanGradeNum || `Grade ${sGrade}` === grade;
            });
        }

        if (search) {
            filtered = filtered.filter(s => {
                const sName = (s.name || '').toLowerCase();
                const sGrade = (s.grade_level || '').toLowerCase();
                const sStrand = (s.strand || '').toLowerCase();
                const advName = (getAdviserName(s) || '').toLowerCase();
                return sName.includes(search) || sGrade.includes(search) || sStrand.includes(search) || advName.includes(search);
            });
        }

        if (filtered.length === 0) {
            sectionsGrid.innerHTML = `
                <div class="no-data" style="grid-column: 1 / -1;">
                    <i class="fas fa-layer-group"></i>
                    <h3>No Sections Found</h3>
                    <p>Click "Add New Section" to create one.</p>
                </div>
            `;
            return;
        }

        let html = '';
        filtered.forEach(section => {
            const adviser = getAdviserName(section) || 'Not Assigned';
            const initial = adviser !== 'Not Assigned' ? adviser.charAt(0).toUpperCase() : '?';
            const count = studentsCountMap[section.id] || 0;

            html += `
                <div class="section-card" data-grade="${section.grade_level || ''}">
                    <div class="section-header">
                        <div class="section-icon"><i class="fas fa-users"></i></div>
                        <span class="section-badge">${count} Students</span>
                    </div>
                    <div class="section-name">${section.name || 'Unnamed Section'}</div>
                    <div class="grade-level"><i class="fas fa-layer-group"></i> ${section.grade_level || 'N/A'} ${section.strand ? `• ${section.strand}` : ''}</div>
                    
                    <div class="adviser-info">
                        <div class="adviser-avatar">${initial}</div>
                        <div class="adviser-details">
                            <div class="adviser-label">Class Adviser</div>
                            <div class="adviser-name">${adviser}</div>
                        </div>
                    </div>

                    <div class="stats-row">
                        <div class="stat-item">
                            <div class="stat-value">${count}</div>
                            <div class="stat-label">Students</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${section.strand || 'General'}</div>
                            <div class="stat-label">Strand/Track</div>
                        </div>
                    </div>

                    <div class="action-buttons">
                        <a href="section_students.html?id=${section.id}" class="btn-action btn-students" title="View Students">
                            <i class="fas fa-users"></i> Students
                        </a>
                        <button class="btn-action btn-edit" onclick="window.openEditModalById('${section.id}')" title="Edit Section">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn-action btn-delete" onclick="window.deleteSection('${section.id}', '${section.name || ''}', ${count})" title="Delete Section">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `;
        });

        sectionsGrid.innerHTML = html;
    }

    // ===== MODAL FUNCTIONS (EXPOSED GLOBALLY) =====

    window.openAddModal = function() {
        if (!addModal) return;
        addModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        if (addSectionForm) addSectionForm.reset();
    };

    window.closeAddModal = function() {
        if (!addModal) return;
        addModal.classList.remove('active');
        document.body.style.overflow = 'auto';
    };

    window.openEditModalById = function(id) {
        const section = sections.find(s => s.id === id || String(s.id) === String(id));
        if (!section || !editModal) return;

        if (editSectionId) editSectionId.value = section.id;
        if (editSectionName) editSectionName.value = section.name || '';
        
        const rawGrade = String(section.grade_level || '').replace('Grade ', '').trim();
        if (editGradeId) editGradeId.value = rawGrade;
        if (editAdviserName) editAdviserName.value = section.adviser_name || getAdviserName(section) || '';

        const count = studentsCountMap[section.id] || 0;
        if (editStudentCount) editStudentCount.textContent = count;
        if (editWarning) editWarning.style.display = count > 0 ? 'flex' : 'none';

        editModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    window.closeEditModal = function() {
        if (!editModal) return;
        editModal.classList.remove('active');
        document.body.style.overflow = 'auto';
    };

    window.deleteSection = async function(id, name, count) {
        if (count > 0) {
            showAlert(`Cannot delete section "${name}" because it has ${count} enrolled student(s).`, 'error');
            return;
        }

        if (!confirm(`Are you sure you want to delete section "${name}"?`)) {
            return;
        }

        try {
            const { error: delErr } = await supabase
                .from('sections')
                .delete()
                .eq('id', id);

            if (delErr) throw delErr;

            showAlert(`✅ Section "${name}" deleted successfully!`, 'success');
            await loadSections();
        } catch(err) {
            console.error('Error deleting section:', err);
            showAlert('Failed to delete section: ' + err.message, 'error');
        }
    };

    // ===== FORM SUBMISSION =====

    if (addSectionForm) {
        addSectionForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const name = addSectionName.value.trim();
            const gradeId = addGradeId.value;
            const adviserName = addAdviserName ? addAdviserName.value.trim() : '';

            if (!name || !gradeId || !adviserName) {
                showAlert('Please fill in all required fields including Class Adviser.', 'error');
                return;
            }

            const gradeLevelStr = `Grade ${gradeId}`;
            const matchedTeacher = teachers.find(t => t.name.toLowerCase() === adviserName.toLowerCase());
            const adviserId = matchedTeacher ? matchedTeacher.id : null;

            // Determine strand
            let strand = null;
            const upper = name.toUpperCase();
            if (upper.includes('STEM')) strand = 'STEM';
            else if (upper.includes('TVL') || upper.includes('ICT')) strand = 'TVL';
            else if (upper.includes('HUMSS')) strand = 'HUMSS';
            else if (upper.includes('ABM')) strand = 'ABM';
            else if (upper.includes('GAS')) strand = 'GAS';

            const submitBtn = this.querySelector('button[type="submit"]');
            try {
                if (submitBtn) submitBtn.disabled = true;

                const { error } = await supabase
                    .from('sections')
                    .insert([{
                        name: name,
                        grade_level: gradeLevelStr,
                        strand: strand,
                        adviser_name: adviserName,
                        adviser_id: adviserId
                    }]);

                if (error) throw error;

                showAlert(`✅ Section "${name}" created successfully!`, 'success');
                window.closeAddModal();
                await loadSections();
            } catch(err) {
                console.error('Error creating section:', err);
                showAlert('Failed to create section: ' + err.message, 'error');
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }

    if (editSectionForm) {
        editSectionForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const id = editSectionId.value;
            const name = editSectionName.value.trim();
            const gradeId = editGradeId.value;
            const adviserName = editAdviserName ? editAdviserName.value.trim() : '';

            if (!id || !name || !gradeId || !adviserName) {
                showAlert('Please fill in all required fields including Class Adviser.', 'error');
                return;
            }

            const gradeLevelStr = `Grade ${gradeId}`;
            const matchedTeacher = teachers.find(t => t.name.toLowerCase() === adviserName.toLowerCase());
            const adviserId = matchedTeacher ? matchedTeacher.id : null;

            const submitBtn = this.querySelector('button[type="submit"]');
            try {
                if (submitBtn) submitBtn.disabled = true;

                const { error } = await supabase
                    .from('sections')
                    .update({
                        name: name,
                        grade_level: gradeLevelStr,
                        adviser_name: adviserName,
                        adviser_id: adviserId,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', id);

                if (error) throw error;

                showAlert(`✅ Section "${name}" updated successfully!`, 'success');
                window.closeEditModal();
                await loadSections();
            } catch(err) {
                console.error('Error updating section:', err);
                showAlert('Failed to update section: ' + err.message, 'error');
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }

    // ===== EVENT LISTENERS =====
    if (gradeFilter) gradeFilter.addEventListener('change', renderSections);
    if (searchInput) {
        let timer;
        searchInput.addEventListener('input', function() {
            clearTimeout(timer);
            timer = setTimeout(renderSections, 250);
        });
    }

    // ===== INIT =====
    populateGradeFilter();
    await loadTeachers();
    await loadSections();
});