// ===== SECTIONS JAVASCRIPT (SUPABASE POWERED) =====
import { supabase } from '../../supabase/config.js';

document.addEventListener('DOMContentLoaded', async function() {
    // DOM Elements
    const alertContainer = document.getElementById('alertContainer');
    const sectionsContainer = document.getElementById('sectionsContainer');
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
    const addGradeSelect = document.getElementById('addGradeId');
    const editGradeSelect = document.getElementById('editGradeId');
    const addStrandGroup = document.getElementById('addStrandGroup');
    const editStrandGroup = document.getElementById('editStrandGroup');
    const addStrandSelect = document.getElementById('addStrand');
    const editStrandSelect = document.getElementById('editStrand');
    const addAdviserSelect = document.getElementById('addAdviserName');
    const editAdviserSelect = document.getElementById('editAdviserName');

    // State
    let sections = [];
    let teachers = [];
    const gradeLevels = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];

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

    function toggleStrandField(gradeVal, groupElem, selectElem) {
        if (!groupElem) return;
        const num = parseInt(String(gradeVal).replace(/\D/g, ''), 10);
        if (num >= 11) {
            groupElem.classList.remove('hidden');
            groupElem.style.display = 'block';
            if (selectElem) selectElem.required = true;
        } else {
            groupElem.classList.add('hidden');
            groupElem.style.display = 'none';
            if (selectElem) {
                selectElem.required = false;
                selectElem.value = '';
            }
        }
    }

    if (addGradeSelect) {
        addGradeSelect.addEventListener('change', function() {
            toggleStrandField(this.value, addStrandGroup, addStrandSelect);
        });
    }

    if (editGradeSelect) {
        editGradeSelect.addEventListener('change', function() {
            toggleStrandField(this.value, editStrandGroup, editStrandSelect);
        });
    }

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

            // Populate dropdowns
            populateAdviserDropdown(addAdviserSelect);
            populateAdviserDropdown(editAdviserSelect);

        } catch (err) {
            console.error('Error loading teachers:', err);
        }
    }

    // Function to populate Adviser dropdowns and disable assigned teachers
    function populateAdviserDropdown(selectElement) {
        if (!selectElement) return;
        
        // Keep the default empty option
        const currentVal = selectElement.value;
        selectElement.innerHTML = '<option value="">Select a Teacher</option>';
        
        teachers.forEach(t => {
            // Check if teacher is already assigned to any section
            const isAssigned = sections.some(s => 
                s.adviser_id === t.id || 
                s.adviser_id === t.user_id || 
                (s.adviser_name && s.adviser_name.trim().toLowerCase() === t.name.toLowerCase())
            );

            const opt = document.createElement('option');
            opt.value = t.name; // Using name to match existing code structure
            opt.textContent = t.name + (isAssigned ? ' (Already Assigned)' : '');
            
            // If they are assigned, disable them so they can't be selected again
            if (isAssigned) {
                opt.disabled = true;
                opt.style.color = '#94a3b8'; // Gray out text
            }
            
            selectElement.appendChild(opt);
        });

        // Restore previous value if it exists and isn't disabled
        if (currentVal) {
            const options = Array.from(selectElement.options);
            const match = options.find(o => o.value === currentVal && !o.disabled);
            if (match) selectElement.value = currentVal;
        }
    }

    function getAdviserName(sectionOrId) {
        if (!sectionOrId) return null;
        if (typeof sectionOrId === 'object' && sectionOrId !== null) {
            if (sectionOrId.adviser_name && String(sectionOrId.adviser_name).trim() !== '') {
                return String(sectionOrId.adviser_name).trim();
            }
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
            if (sectionsContainer) {
                sectionsContainer.innerHTML = `
                    <div class="table-card" style="text-align: center; padding: 48px 20px;">
                        <i class="fas fa-spinner fa-spin" style="font-size: 32px; color: #1B2A4A;"></i>
                        <p style="margin-top: 14px; color: #64748b; font-size: 14px; font-weight: 500;">Loading sections by year level...</p>
                    </div>
                `;
            } else if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; padding: 40px;">
                            <i class="fas fa-spinner fa-spin" style="font-size: 28px; color: #1B2A4A;"></i>
                            <p style="margin-top: 10px; color: #64748b;">Loading sections from database...</p>
                        </td>
                    </tr>
                `;
            }

            const { data, error } = await supabase
                .from('sections')
                .select('*');

            if (error) throw error;

            sections = (data || []).sort(compareSections);
            updateStats();
            renderGradeSummary();
            renderTable();
            
            // Re-populate dropdowns now that sections are loaded (to disable assigned teachers)
            populateAdviserDropdown(addAdviserSelect);
            populateAdviserDropdown(editAdviserSelect);

        } catch (err) {
            console.error('Error loading sections:', err);
            showAlert('Failed to load sections from database: ' + err.message, 'error');
            if (sectionsContainer) {
                sectionsContainer.innerHTML = `
                    <div class="table-card" style="text-align: center; padding: 36px 20px; color: #ef4444;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 28px;"></i>
                        <p style="margin-top: 10px; font-weight: 600;">Failed to load sections.</p>
                        <p style="color: #64748b; font-size: 13px;">${err.message}</p>
                    </div>
                `;
            } else if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; padding: 30px; color: #ef4444;">
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
        const withAdviser = sections.filter(s => !!(s.adviser_name || s.adviser_id)).length;
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
            const isSelected = gradeFilter && gradeFilter.value === grade;
            html += `
                <div class="grade-summary-item ${isSelected ? 'active' : ''}" data-grade="${grade}" title="Click to filter / jump to ${grade}">
                    <span class="grade-name">${grade}</span>
                    <span class="grade-count">${counts[grade] || 0} sections</span>
                </div>
            `;
        });

        gradeSummary.innerHTML = html;

        gradeSummary.querySelectorAll('.grade-summary-item').forEach(item => {
            item.addEventListener('click', function() {
                const targetGrade = this.getAttribute('data-grade');
                if (gradeFilter) {
                    if (gradeFilter.value === targetGrade) {
                        gradeFilter.value = '';
                    } else {
                        gradeFilter.value = targetGrade;
                    }
                    renderGradeSummary();
                    renderTable();

                    if (gradeFilter.value) {
                        const slug = targetGrade.toLowerCase().replace(/\s+/g, '-');
                        const targetBox = document.getElementById(`box-${slug}`);
                        if (targetBox) {
                            targetBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }
                    }
                }
            });
        });
    }

    function renderTable() {
        const container = sectionsContainer || tableBody;
        if (!container) return;

        const grade = gradeFilter ? gradeFilter.value : '';
        const adviser = adviserFilter ? adviserFilter.value : '';
        const search = searchInput ? searchInput.value.toLowerCase().trim() : '';

        let filtered = [...sections].sort(compareSections);

        if (grade) {
            const cleanGradeNum = grade.replace('Grade ', '').trim();
            filtered = filtered.filter(s => {
                const sGrade = String(s.grade_level || '').trim();
                return sGrade === grade || sGrade === cleanGradeNum || `Grade ${sGrade}` === grade;
            });
        }

        if (adviser === 'assigned') {
            filtered = filtered.filter(s => !!(s.adviser_name || s.adviser_id));
        } else if (adviser === 'unassigned') {
            filtered = filtered.filter(s => !s.adviser_name && !s.adviser_id);
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

        if (recordCount) {
            recordCount.textContent = `Total: ${filtered.length} sections`;
        }

        if (filtered.length === 0) {
            const noDataHtml = `
                <div class="table-card no-data-box" style="padding: 20px;">
                    <div class="no-data">
                        <i class="fas fa-layer-group"></i>
                        <h3>No Sections Found</h3>
                        <p>No sections match your search or filter criteria.</p>
                    </div>
                </div>
            `;
            if (sectionsContainer) {
                sectionsContainer.innerHTML = noDataHtml;
            } else if (tableBody) {
                tableBody.innerHTML = `<tr><td colspan="5">${noDataHtml}</td></tr>`;
            }
            return;
        }

        const gradeConfigs = {
            'Grade 7': { sub: 'Junior High School', type: 'jhs', icon: 'fa-bookmark', colorClass: 'grade-7' },
            'Grade 8': { sub: 'Junior High School', type: 'jhs', icon: 'fa-layer-group', colorClass: 'grade-8' },
            'Grade 9': { sub: 'Junior High School', type: 'jhs', icon: 'fa-compass', colorClass: 'grade-9' },
            'Grade 10': { sub: 'Junior High School', type: 'jhs', icon: 'fa-medal', colorClass: 'grade-10' },
            'Grade 11': { sub: 'Senior High School', type: 'shs', icon: 'fa-graduation-cap', colorClass: 'grade-11' },
            'Grade 12': { sub: 'Senior High School', type: 'shs', icon: 'fa-award', colorClass: 'grade-12' }
        };

        const uniqueGradeKeys = [];
        gradeLevels.forEach(g => {
            const hasMatches = filtered.some(s => {
                const sGrade = String(s.grade_level || '').trim();
                const cleanNum = g.replace('Grade ', '').trim();
                return sGrade === g || sGrade === cleanNum || `Grade ${sGrade}` === g;
            });
            if (hasMatches) uniqueGradeKeys.push(g);
        });

        filtered.forEach(s => {
            const rawG = s.grade_level ? (s.grade_level.toString().startsWith('Grade') ? s.grade_level : `Grade ${s.grade_level}`) : 'Other';
            if (!uniqueGradeKeys.includes(rawG)) uniqueGradeKeys.push(rawG);
        });

        let containerHtml = '';

        uniqueGradeKeys.forEach(gradeKey => {
            const cleanNum = gradeKey.replace('Grade ', '').trim();
            const gradeSecs = filtered.filter(s => {
                const sGrade = String(s.grade_level || '').trim();
                return sGrade === gradeKey || sGrade === cleanNum || `Grade ${sGrade}` === gradeKey;
            }).sort(compareSections);

            if (gradeSecs.length === 0) return;

            const cfg = gradeConfigs[gradeKey] || {
                sub: getGradeOrder(gradeKey) >= 11 ? 'Senior High School' : 'Junior High School',
                type: getGradeOrder(gradeKey) >= 11 ? 'shs' : 'jhs',
                icon: 'fa-school',
                colorClass: 'grade-other'
            };

            const gradeSlug = gradeKey.toLowerCase().replace(/\s+/g, '-');

            let rowsHtml = '';
            gradeSecs.forEach(section => {
                const adviserName = getAdviserName(section);
                const initial = adviserName ? adviserName.charAt(0).toUpperCase() : '?';
                const gradeDisplay = section.grade_level ? (section.grade_level.toString().startsWith('Grade') ? section.grade_level : `Grade ${section.grade_level}`) : 'Unspecified';

                rowsHtml += `
                    <tr>
                        <td style="width: 28%;">
                            <div class="section-info">
                                <div class="section-icon"><i class="fas fa-users"></i></div>
                                <div class="section-details">
                                    <h4>${section.name}</h4>
                                    <span>${section.room ? `Room: ${section.room}` : 'ID: ' + section.id.substring(0, 8)}</span>
                                </div>
                            </div>
                        </td>
                        <td style="width: 15%;">
                            <span class="grade-tag">${gradeDisplay}</span>
                        </td>
                        <td style="width: 16%;">
                            ${section.strand ? `<span class="strand-tag">${section.strand}</span>` : `<span class="strand-na">Not Applicable</span>`}
                        </td>
                        <td style="width: 25%;">
                            ${adviserName ? `
                                <div class="adviser-info">
                                    <div class="adviser-avatar">${initial}</div>
                                    <span class="adviser-name">${adviserName}</span>
                                </div>
                            ` : `
                                <span class="no-adviser">Not Assigned</span>
                            `}
                        </td>
                        <td class="cell-actions" style="width: 16%;">
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

            containerHtml += `
                <div class="grade-box-card" id="box-${gradeSlug}">
                    <div class="grade-box-header">
                        <div class="grade-box-header-left">
                            <div class="grade-badge-icon ${cfg.colorClass}">
                                <i class="fas ${cfg.icon}"></i>
                            </div>
                            <div class="grade-title-group">
                                <div class="grade-title-row">
                                    <h3>${gradeKey}</h3>
                                    <span class="level-sub-tag ${cfg.type}">${cfg.sub}</span>
                                </div>
                                <span class="grade-subtext">${gradeSecs.length} ${gradeSecs.length === 1 ? 'class section' : 'class sections'}</span>
                            </div>
                        </div>
                        <div class="grade-box-header-right">
                            <span class="grade-count-badge"><i class="fas fa-users-rectangle"></i> ${gradeSecs.length} Sections</span>
                        </div>
                    </div>
                    <div class="table-container">
                        <table class="sections-table">
                            <thead>
                                <tr>
                                    <th>Section</th>
                                    <th>Grade Level</th>
                                    <th>Strand</th>
                                    <th>Adviser</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rowsHtml}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        });

        if (sectionsContainer) {
            sectionsContainer.innerHTML = containerHtml;
        } else if (tableBody) {
            tableBody.innerHTML = containerHtml;
        }

        const rootElem = sectionsContainer || tableBody;
        rootElem.querySelectorAll('.btn-manage').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const dropdown = this.closest('.manage-dropdown');
                const row = this.closest('tr');
                const isOpen = dropdown.classList.contains('show');

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
        
        // Reset Adviser Dropdown
        if (addAdviserSelect) {
            addAdviserSelect.value = '';
            populateAdviserDropdown(addAdviserSelect); 
        }

        if (document.getElementById('addStrand')) document.getElementById('addStrand').value = '';
        toggleStrandField('', addStrandGroup, addStrandSelect);
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
        
        toggleStrandField(rawGrade, editStrandGroup, editStrandSelect);
        if (document.getElementById('editStrand')) {
            document.getElementById('editStrand').value = section.strand || '';
        }
        
        // Populate Edit Adviser Dropdown (allow current adviser to be selected)
        if (editAdviserSelect) {
            const currentAdviserName = section.adviser_name || getAdviserName(section) || '';
            
            // Temporarily remove this section from the "assigned" check so its current adviser can be selected
            const originalSections = [...sections];
            sections = sections.filter(s => s.id !== section.id);
            
            populateAdviserDropdown(editAdviserSelect);
            
            // Restore sections
            sections = originalSections;
            
            // Set the value
            editAdviserSelect.value = currentAdviserName;
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
            const adviserName = addAdviserSelect ? addAdviserSelect.value.trim() : '';
            const strandVal = (parseInt(gradeId, 10) >= 11 && addStrandSelect) ? (addStrandSelect.value || null) : null;

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
                        adviser_id: adviserId,
                        strand: strandVal
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
            const adviserName = editAdviserSelect ? editAdviserSelect.value.trim() : '';
            const strandVal = (parseInt(gradeId, 10) >= 11 && editStrandSelect) ? (editStrandSelect.value || null) : null;

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
                        strand: strandVal,
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

    if (gradeFilter) {
        gradeFilter.addEventListener('change', () => {
            renderGradeSummary();
            renderTable();
        });
    }
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

    // Automatically open edit modal if arrived with ?edit=SECTION_ID
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const editId = urlParams.get('edit');
        if (editId && typeof window.openEditModal === 'function') {
            setTimeout(() => {
                window.openEditModal(editId);
            }, 100);
        }
    } catch (e) {
        console.warn('Could not auto-open edit modal:', e);
    }
});