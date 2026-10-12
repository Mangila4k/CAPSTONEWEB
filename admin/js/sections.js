// ===== SECTIONS JAVASCRIPT (SUPABASE POWERED) =====
import { supabase } from '../../supabase/config.js';

document.addEventListener('DOMContentLoaded', async function() {
    // DOM Elements
    const alertContainer = document.getElementById('alertContainer');
    const tableBody = document.getElementById('tableBody');
    const recordCount = document.getElementById('recordCount');
    const gradeFilter = document.getElementById('gradeFilter');
    const adviserFilter = document.getElementById('adviserFilter');
    const searchInput = document.getElementById('searchInput');
    const gradeSummary = document.getElementById('gradeSummary');

    // Modal Elements
    const addModal = document.getElementById('addModal');
    const editModal = document.getElementById('editModal');
    const scheduleModal = document.getElementById('scheduleModal');
    const addForm = document.getElementById('addSectionForm');
    const editForm = document.getElementById('editSectionForm');
    const addAdviserSelect = document.getElementById('addAdviserId');
    const editAdviserSelect = document.getElementById('editAdviserId');

    // State
    let sections = [];
    let teachers = [];
    const gradeLevels = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];

    // ===== ALERT HELPER =====
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
                    name: name,
                    employee_id: t.employee_id
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

    async function loadSections() {
        try {
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="4" style="text-align: center; padding: 40px;">
                            <i class="fas fa-spinner fa-spin" style="font-size: 28px; color: #1B2A4A;"></i>
                            <p style="margin-top: 10px; color: #64748b;">Loading sections from database...</p>
                        </td>
                    </tr>
                `;
            }

            const { data, error } = await supabase
                .from('sections')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;

            sections = data || [];
            updateStats();
            renderGradeSummary();
            renderTable();
        } catch (err) {
            console.error('Error loading sections:', err);
            showAlert('Failed to load sections from database: ' + err.message, 'error');
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="4" style="text-align: center; padding: 30px; color: #ef4444;">
                            <i class="fas fa-exclamation-triangle" style="font-size: 24px;"></i>
                            <p style="margin-top: 8px;">Failed to load sections.</p>
                        </td>
                    </tr>
                `;
            }
        }
    }

    // ===== UI RENDERING =====
    function updateStats() {
        const total = sections.length;
        const withAdviser = sections.filter(s => !!s.adviser_id).length;
        const withoutAdviser = total - withAdviser;

        const totalElem = document.getElementById('totalSections');
        const withAdviserElem = document.getElementById('withAdviser');
        const withoutAdviserElem = document.getElementById('withoutAdviser');

        if (totalElem) totalElem.textContent = total;
        if (withAdviserElem) withAdviserElem.textContent = withAdviser;
        if (withoutAdviserElem) withoutAdviserElem.textContent = withoutAdviser;
    }

    function renderGradeSummary() {
        if (!gradeSummary) return;

        const counts = {};
        gradeLevels.forEach(grade => {
            counts[grade] = sections.filter(s => {
                const g = String(s.grade_level || '');
                return g === grade || g === grade.replace('Grade ', '') || `Grade ${g}` === grade;
            }).length;
        });

        let html = '';
        gradeLevels.forEach(grade => {
            html += `
                <div class="grade-summary-item">
                    <span class="grade-name">${grade}</span>
                    <span class="grade-count">${counts[grade] || 0} sections</span>
                </div>
            `;
        });

        gradeSummary.innerHTML = html;
    }

    function renderTable() {
        if (!tableBody) return;

        const grade = gradeFilter ? gradeFilter.value : '';
        const adviser = adviserFilter ? adviserFilter.value : '';
        const search = searchInput ? searchInput.value.toLowerCase().trim() : '';

        let filtered = [...sections];

        if (grade) {
            const cleanGradeNum = grade.replace('Grade ', '').trim();
            filtered = filtered.filter(s => {
                const sGrade = String(s.grade_level || '').trim();
                return sGrade === grade || sGrade === cleanGradeNum || `Grade ${sGrade}` === grade;
            });
        }

        if (adviser === 'assigned') {
            filtered = filtered.filter(s => !!s.adviser_id);
        } else if (adviser === 'unassigned') {
            filtered = filtered.filter(s => !s.adviser_id);
        }

        if (search) {
            filtered = filtered.filter(s => {
                const sName = (s.name || '').toLowerCase();
                const sGrade = (s.grade_level || '').toLowerCase();
                const sStrand = (s.strand || '').toLowerCase();
                const advName = (getAdviserName(s.adviser_id) || '').toLowerCase();
                return sName.includes(search) || sGrade.includes(search) || sStrand.includes(search) || advName.includes(search);
            });
        }

        if (recordCount) {
            recordCount.textContent = `Total: ${filtered.length} sections`;
        }

        if (filtered.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4">
                        <div class="no-data">
                            <i class="fas fa-layer-group"></i>
                            <h3>No Sections Found</h3>
                            <p>Click "Add New Section" to create one.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        filtered.forEach(section => {
            const adviserName = getAdviserName(section.adviser_id);
            const initial = adviserName ? adviserName.charAt(0).toUpperCase() : '?';
            const gradeDisplay = section.grade_level ? (section.grade_level.toString().startsWith('Grade') ? section.grade_level : `Grade ${section.grade_level}`) : 'Unspecified';
            
            html += `
                <tr>
                    <td>
                        <div class="section-info">
                            <div class="section-icon"><i class="fas fa-users"></i></div>
                            <div class="section-details">
                                <h4>${section.name}</h4>
                                <span>${section.room ? `Room: ${section.room}` : 'ID: ' + section.id.substring(0, 8)}</span>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="grade-tag">${gradeDisplay}</span>
                        ${section.strand ? `<span class="strand-tag" style="display:inline-block; font-size:11px; padding:2px 8px; background:#e0f2fe; color:#0369a1; border-radius:12px; margin-left:4px;">${section.strand}</span>` : ''}
                    </td>
                    <td>
                        ${adviserName ? `
                            <div class="adviser-info">
                                <div class="adviser-avatar">${initial}</div>
                                <span class="adviser-name">${adviserName}</span>
                            </div>
                        ` : `
                            <span class="no-adviser" style="color:#94a3b8; font-style:italic;">Not Assigned</span>
                        `}
                    </td>
                    <td class="cell-actions">
                        <div class="manage-dropdown">
                            <button type="button" class="btn-manage" aria-expanded="false" title="Manage Section">
                                <span>Manage</span>
                                <i class="fas fa-chevron-down"></i>
                            </button>
                            <div class="manage-menu">
                                <a href="view_section.html?id=${section.id}" class="manage-item view-item" title="View Section">
                                    <i class="fas fa-eye"></i>
                                    <span>View Section</span>
                                </a>
                                <a href="create_schedule.html?section_id=${section.id}" class="manage-item schedule-item" title="Manage Schedule">
                                    <i class="fas fa-calendar-alt"></i>
                                    <span>Manage Schedule</span>
                                </a>
                                <button type="button" class="manage-item edit-item" onclick="window.openEditModal('${section.id}')" title="Edit Section">
                                    <i class="fas fa-edit"></i>
                                    <span>Edit Section</span>
                                </button>
                                <div class="manage-divider"></div>
                                <button type="button" class="manage-item delete-item delete" onclick="window.deleteSection('${section.id}')" title="Delete Section">
                                    <i class="fas fa-trash"></i>
                                    <span>Delete Section</span>
                                </button>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        });

        tableBody.innerHTML = html;

        // Toggle Manage dropdown menu
        tableBody.querySelectorAll('.btn-manage').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const dropdown = this.closest('.manage-dropdown');
                const row = this.closest('tr');
                const isOpen = dropdown.classList.contains('show');

                // Close all other open dropdowns
                document.querySelectorAll('.manage-dropdown.show').forEach(d => {
                    d.classList.remove('show');
                    d.classList.remove('dropup');
                    const r = d.closest('tr');
                    if (r) r.classList.remove('dropdown-open');
                });

                if (!isOpen) {
                    const rect = this.getBoundingClientRect();
                    const spaceBelow = window.innerHeight - rect.bottom;
                    if (spaceBelow < 200) {
                        dropdown.classList.add('dropup');
                    } else {
                        dropdown.classList.remove('dropup');
                    }
                    dropdown.classList.add('show');
                    if (row) row.classList.add('dropdown-open');
                }
            });
        });
    }

    // ===== MODAL FUNCTIONS (EXPOSED GLOBALLY) =====

    window.openAddModal = function() {
        if (!addModal) return;
        addModal.classList.add('show');
        if (document.getElementById('addSectionName')) document.getElementById('addSectionName').value = '';
        if (document.getElementById('addGradeId')) document.getElementById('addGradeId').value = '';
        if (document.getElementById('addAdviserName')) document.getElementById('addAdviserName').value = '';
    };

    window.closeAddModal = function() {
        if (addModal) addModal.classList.remove('show');
    };

    window.openEditModal = function(id) {
        const section = sections.find(s => s.id === id);
        if (!section || !editModal) return;

        if (document.getElementById('editSectionId')) document.getElementById('editSectionId').value = section.id;
        if (document.getElementById('editSectionName')) document.getElementById('editSectionName').value = section.name || '';
        
        const rawGrade = String(section.grade_level || '').replace('Grade ', '').trim();
        if (document.getElementById('editGradeId')) document.getElementById('editGradeId').value = rawGrade;
        
        if (document.getElementById('editAdviserName')) {
            document.getElementById('editAdviserName').value = section.adviser_name || getAdviserName(section) || '';
        }
        
        editModal.classList.add('show');
    };

    window.closeEditModal = function() {
        if (editModal) editModal.classList.remove('show');
    };

    window.openScheduleModal = function(id, name) {
        window.location.href = `create_schedule.html?section_id=${id}`;
    };

    window.closeScheduleModal = function() {
        if (scheduleModal) scheduleModal.classList.remove('show');
    };

    // Delete Section
    window.deleteSection = async function(id) {
        const section = sections.find(s => s.id === id);
        if (!section) return;

        try {
            // Check if section has enrolled students
            const { count: studentCount, error: countErr } = await supabase
                .from('students')
                .select('*', { count: 'exact', head: true })
                .eq('section_id', id);

            if (studentCount && studentCount > 0) {
                showAlert(`Cannot delete section "${section.name}" because it has ${studentCount} enrolled student(s).`, 'error');
                return;
            }

            if (!confirm(`Are you sure you want to delete section "${section.name}"?`)) {
                return;
            }

            const { error: deleteErr } = await supabase
                .from('sections')
                .delete()
                .eq('id', id);

            if (deleteErr) throw deleteErr;

            showAlert(`✅ Section "${section.name}" deleted successfully!`, 'success');
            await loadSections();
        } catch (err) {
            console.error('Error deleting section:', err);
            showAlert('Failed to delete section: ' + err.message, 'error');
        }
    };

    // ===== FORM HANDLERS =====

    if (addForm) {
        addForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const sectionName = document.getElementById('addSectionName').value.trim();
            const gradeId = document.getElementById('addGradeId').value;
            const adviserName = document.getElementById('addAdviserName') ? document.getElementById('addAdviserName').value.trim() : '';

            if (!sectionName || !gradeId || !adviserName) {
                showAlert('Please fill in all required fields including Class Adviser.', 'error');
                return;
            }

            const gradeLevelStr = `Grade ${gradeId}`;
            const matchedTeacher = teachers.find(t => t.name.toLowerCase() === adviserName.toLowerCase());
            const adviserId = matchedTeacher ? matchedTeacher.id : null;

            try {
                const submitBtn = addForm.querySelector('button[type="submit"]');
                if (submitBtn) submitBtn.disabled = true;

                const { data, error } = await supabase
                    .from('sections')
                    .insert([{
                        name: sectionName,
                        grade_level: gradeLevelStr,
                        adviser_name: adviserName,
                        adviser_id: adviserId
                    }])
                    .select();

                if (error) throw error;

                showAlert(`✅ Section "${sectionName}" created successfully!`, 'success');
                window.closeAddModal();
                addForm.reset();
                await loadSections();
            } catch (err) {
                console.error('Error adding section:', err);
                showAlert('Failed to create section: ' + err.message, 'error');
            } finally {
                const submitBtn = addForm.querySelector('button[type="submit"]');
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }

    if (editForm) {
        editForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const id = document.getElementById('editSectionId').value;
            const sectionName = document.getElementById('editSectionName').value.trim();
            const gradeId = document.getElementById('editGradeId').value;
            const adviserName = document.getElementById('editAdviserName') ? document.getElementById('editAdviserName').value.trim() : '';

            if (!id || !sectionName || !gradeId || !adviserName) {
                showAlert('Please fill in all required fields including Class Adviser.', 'error');
                return;
            }

            const gradeLevelStr = `Grade ${gradeId}`;
            const matchedTeacher = teachers.find(t => t.name.toLowerCase() === adviserName.toLowerCase());
            const adviserId = matchedTeacher ? matchedTeacher.id : null;

            try {
                const submitBtn = editForm.querySelector('button[type="submit"]');
                if (submitBtn) submitBtn.disabled = true;

                const { error } = await supabase
                    .from('sections')
                    .update({
                        name: sectionName,
                        grade_level: gradeLevelStr,
                        adviser_name: adviserName,
                        adviser_id: adviserId,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', id);

                if (error) throw error;

                showAlert(`✅ Section "${sectionName}" updated successfully!`, 'success');
                window.closeEditModal();
                await loadSections();
            } catch (err) {
                console.error('Error updating section:', err);
                showAlert('Failed to update section: ' + err.message, 'error');
            } finally {
                const submitBtn = editForm.querySelector('button[type="submit"]');
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }

    // ===== EVENT LISTENERS =====

    if (gradeFilter) gradeFilter.addEventListener('change', renderTable);
    if (adviserFilter) adviserFilter.addEventListener('change', renderTable);
    if (searchInput) searchInput.addEventListener('input', renderTable);

    document.addEventListener('click', function(e) {
        if (e.target === addModal) window.closeAddModal();
        if (e.target === editModal) window.closeEditModal();
        if (e.target === scheduleModal) window.closeScheduleModal();
        if (!e.target.closest('.manage-dropdown')) {
            document.querySelectorAll('.manage-dropdown.show').forEach(d => {
                d.classList.remove('show');
                d.classList.remove('dropup');
                const r = d.closest('tr');
                if (r) r.classList.remove('dropdown-open');
            });
        }
    });

    // ===== MOBILE MENU =====
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');

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

    // ===== INIT =====
    await loadTeachers();
    await loadSections();
});