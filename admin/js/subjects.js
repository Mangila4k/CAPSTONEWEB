/**
 * HES Admin - Subjects Management (SUPABASE POWERED)
 */

import { supabase } from '../../supabase/config.js';

document.addEventListener('DOMContentLoaded', async function() {
    'use strict';

    console.log('📚 Admin Subjects page ready (Supabase)');

    // ============================================
    // DOM ELEMENTS
    // ============================================

    const alertContainer = document.getElementById('alertContainer');
    const totalSubjectsEl = document.getElementById('totalSubjects');
    const jhsSubjectsEl = document.getElementById('jhsSubjects');
    const shsSubjectsEl = document.getElementById('shsSubjects');
    const totalStrandsEl = document.getElementById('totalStrands');

    const gradeCardsContainer = document.getElementById('gradeCards');
    const strandFilterWrapper = document.getElementById('strandFilterWrapper');
    const strandFilter = document.getElementById('strandFilter');
    const searchInput = document.getElementById('searchInput');
    const resetBtn = document.getElementById('resetBtn');
    const subjectsContainer = document.getElementById('subjectsContainer');

    const editModal = document.getElementById('editModal');
    const closeEditModal = document.getElementById('closeEditModal');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const editSubjectForm = document.getElementById('editSubjectForm');
    const editSubjectId = document.getElementById('editSubjectId');
    const editSubjectName = document.getElementById('editSubjectName');
    const editGradeId = document.getElementById('editGradeId');
    const editStrandGroup = document.getElementById('editStrandGroup');
    const editStrand = document.getElementById('editStrand');
    const editDescription = document.getElementById('editDescription');

    // ============================================
    // STATE
    // ============================================

    let subjects = [];
    let currentActiveGrade = 'all'; // 'all', 7, 8, 9, 10, 11, 12
    let currentActiveStrand = '';

    // ============================================
    // ALERT HELPER
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
            setTimeout(() => {
                alertDiv.remove();
            }, 300);
        }, 5000);
    }

    // ============================================
    // SUBJECT DOMAIN ICON HELPER
    // ============================================
    function getSubjectIcon(name) {
        const n = (name || '').toLowerCase();
        if (n.includes('computer') || n.includes('programming') || n.includes('servicing') || n.includes('ict')) return 'fa-laptop-code';
        if (n.includes('tle') || n.includes('technology and livelihood') || n.includes('vocational') || n.includes('technical')) return 'fa-tools';
        if (n.includes('science') || n.includes('biology') || n.includes('chemistry') || n.includes('physics') || n.includes('earth')) return 'fa-flask';
        if (n.includes('math') || n.includes('algebra') || n.includes('geometry') || n.includes('calculus') || n.includes('statistics')) return 'fa-calculator';
        if (n.includes('english') || n.includes('reading') || n.includes('literature') || n.includes('writing') || n.includes('purposes')) return 'fa-book-open';
        if (n.includes('filipino') || n.includes('komunikasyon') || n.includes('panitikan')) return 'fa-language';
        if (n.includes('history') || n.includes('society') || n.includes('politics') || n.includes('araling') || n.includes('humss')) return 'fa-landmark';
        if (n.includes('mapeh')) return 'fa-icons';
        if (n.includes('pe') || n.includes('physical') || n.includes('hope') || n.includes('health')) return 'fa-running';
        if (n.includes('art') || n.includes('music')) return 'fa-palette';
        if (n.includes('cookery') || n.includes('bread') || n.includes('pastry') || n.includes('food')) return 'fa-utensils';
        if (n.includes('values') || n.includes('esp') || n.includes('pagpapakatao') || n.includes('ethics') || n.includes('philosophy')) return 'fa-heart';
        return 'fa-book';
    }

    // ============================================
    // LOAD FROM SUPABASE
    // ============================================

    async function loadSubjects() {
        try {
            if (subjectsContainer) {
                subjectsContainer.innerHTML = `
                    <div style="text-align: center; padding: 50px;">
                        <i class="fas fa-spinner fa-spin" style="font-size: 32px; color: #1B2A4A;"></i>
                        <p style="margin-top: 12px; color: #64748b; font-weight: 500;">Loading curriculum subjects...</p>
                    </div>
                `;
            }

            const { data, error } = await supabase
                .from('subjects')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;

            subjects = (data || []).map(s => {
                let gradeNum = parseInt(String(s.grade_level || '').replace('Grade ', '').trim());
                if (isNaN(gradeNum)) gradeNum = 7;

                // Category detection
                let category = s.subject_type;
                if (!category) {
                    if (s.strand) {
                        const nameLower = (s.name || '').toLowerCase();
                        if (nameLower.includes('empowerment') || nameLower.includes('english for academic') || nameLower.includes('research') || nameLower.includes('filipino sa')) {
                            category = 'Applied';
                        } else if (nameLower.includes('programming') || nameLower.includes('servicing') || nameLower.includes('cookery') || nameLower.includes('bread') || nameLower.includes('pre-calculus') || nameLower.includes('biology')) {
                            category = 'Specialized';
                        } else {
                            category = 'Specialized';
                        }
                    } else {
                        category = 'Core';
                    }
                }

                return {
                    id: s.id,
                    name: s.name,
                    code: s.code || '',
                    grade: gradeNum,
                    strand: s.strand || null,
                    category: category,
                    description: s.description || `Grade ${gradeNum} Curriculum Subject`
                };
            });

            updateStats();
            renderSubjects();
        } catch (err) {
            console.error('Error loading subjects:', err);
            showAlert('Failed to load subjects from database: ' + err.message, 'error');
            if (subjectsContainer) {
                subjectsContainer.innerHTML = `
                    <div class="no-subjects-card" style="text-align:center; padding: 40px;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 36px; color: #ef4444;"></i>
                        <h3 style="margin-top: 12px;">Failed to load subjects</h3>
                        <p style="color: #64748b;">${err.message}</p>
                    </div>
                `;
            }
        }
    }

    // ============================================
    // STATS
    // ============================================

    function updateStats() {
        const total = subjects.length;
        const jhsCount = subjects.filter(s => s.grade >= 7 && s.grade <= 10).length;
        const shsCount = subjects.filter(s => s.grade === 11 || s.grade === 12).length;

        const strandsSet = new Set();
        subjects.forEach(s => {
            if (s.strand && (s.grade === 11 || s.grade === 12)) {
                strandsSet.add(s.strand.toUpperCase());
            }
        });
        const strandsCount = strandsSet.size > 0 ? strandsSet.size : 4;

        if (totalSubjectsEl) totalSubjectsEl.textContent = total;
        if (jhsSubjectsEl) jhsSubjectsEl.textContent = jhsCount;
        if (shsSubjectsEl) shsSubjectsEl.textContent = shsCount;
        if (totalStrandsEl) totalStrandsEl.textContent = strandsCount;
    }

    // ============================================
    // RENDER SUBJECTS
    // ============================================

    function renderSubjects() {
        if (!subjectsContainer) return;

        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

        // Filter subjects
        let filtered = subjects.filter(sub => {
            // Grade filter
            if (currentActiveGrade !== 'all') {
                if (sub.grade !== parseInt(currentActiveGrade)) return false;
            }

            // Strand filter (only applies to SHS or if set)
            if (currentActiveStrand) {
                if (sub.grade === 11 || sub.grade === 12) {
                    if (sub.strand && sub.strand.toUpperCase() !== currentActiveStrand.toUpperCase()) {
                        return false;
                    }
                }
            }

            // Search filter
            if (searchTerm) {
                const matchName = sub.name.toLowerCase().includes(searchTerm);
                const matchDesc = (sub.description || '').toLowerCase().includes(searchTerm);
                const matchStrand = (sub.strand || '').toLowerCase().includes(searchTerm);
                const matchCat = (sub.category || '').toLowerCase().includes(searchTerm);
                if (!matchName && !matchDesc && !matchStrand && !matchCat) return false;
            }

            return true;
        });

        if (filtered.length === 0) {
            subjectsContainer.innerHTML = `
                <div class="no-subjects-card">
                    <i class="fas fa-book-open"></i>
                    <h3>No subjects found</h3>
                    <p>Try adjusting your search query, grade level, or strand filter.</p>
                </div>
            `;
            return;
        }

        // Group filtered subjects by grade
        const groupedByGrade = {};
        filtered.forEach(sub => {
            if (!groupedByGrade[sub.grade]) groupedByGrade[sub.grade] = [];
            groupedByGrade[sub.grade].push(sub);
        });

        const sortedGrades = Object.keys(groupedByGrade).map(Number).sort((a, b) => a - b);

        let html = '';
        sortedGrades.forEach(grade => {
            let gradeSubs = groupedByGrade[grade];
            const isSHS = grade === 11 || grade === 12;
            const levelLabel = isSHS ? 'Senior High School' : 'Junior High School';

            // DepEd Junior High School standard sequence
            if (!isSHS) {
                const jhsOrder = [
                    'filipino',
                    'english',
                    'mathematics',
                    'science',
                    'araling panlipunan',
                    'mapeh',
                    'edukasyon sa pagpapakatao',
                    'esp',
                    'technology and livelihood education',
                    'tle'
                ];
                const getJhsOrder = (name) => {
                    const lower = (name || '').toLowerCase();
                    const idx = jhsOrder.findIndex(keyword => lower.includes(keyword));
                    return idx === -1 ? 999 : idx;
                };
                gradeSubs = [...gradeSubs].sort((a, b) => getJhsOrder(a.name) - getJhsOrder(b.name));
            }

            html += `
                <div class="grade-section-block">
                    <div class="grade-section-header">
                        <div class="grade-section-title">
                            <span class="grade-badge">Grade ${grade}</span>
                            <h3>Grade ${grade} Curriculum</h3>
                            <span class="level-tag ${isSHS ? 'shs' : 'jhs'}">${levelLabel}</span>
                        </div>
                        <span class="count-badge">${gradeSubs.length} Subject${gradeSubs.length > 1 ? 's' : ''}</span>
                    </div>
                    <div class="subjects-grid">
            `;

            gradeSubs.forEach(sub => {
                const categoryClass = (sub.category || 'Core').toLowerCase();
                const icon = getSubjectIcon(sub.name);
                const strandDisplay = sub.strand ? `<span class="strand-pill">${sub.strand}</span>` : '';

                // Special MAPEH sub-components display
                const isMAPEH = (sub.name || '').toUpperCase().includes('MAPEH') || (sub.code || '').toUpperCase().includes('MAPEH');
                const mapehComponentsHtml = isMAPEH ? `
                    <div class="mapeh-components-list">
                        <span class="mapeh-subtag"><i class="fas fa-music"></i> Music</span>
                        <span class="mapeh-subtag"><i class="fas fa-palette"></i> Arts</span>
                        <span class="mapeh-subtag"><i class="fas fa-running"></i> Physical Education (PE)</span>
                        <span class="mapeh-subtag"><i class="fas fa-heartbeat"></i> Health</span>
                    </div>
                ` : '';

                html += `
                    <div class="subject-card" data-id="${sub.id}">
                        <div class="subject-card-header">
                            <div class="subject-tags">
                                <span class="category-pill ${categoryClass}"><i class="fas ${icon}"></i> ${sub.category || 'Core'}</span>
                                ${strandDisplay}
                            </div>
                            <div class="subject-card-actions">
                                <button class="action-btn-sm edit" onclick="window.openEditSubjectModal('${sub.id}')" title="Edit Subject">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="action-btn-sm delete" onclick="window.deleteSubjectPrompt('${sub.id}')" title="Delete Subject">
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                            </div>
                        </div>
                        <h4 class="subject-title">${sub.name}</h4>
                        <p class="subject-desc">${sub.description || 'No description provided.'}</p>
                        ${mapehComponentsHtml}
                        <div class="subject-card-footer">
                            <span class="subject-code-tag"><i class="fas fa-graduation-cap"></i> ${sub.code ? sub.code : 'Grade ' + sub.grade}</span>
                            <span>${sub.strand ? sub.strand + ' Track' : 'General Curriculum'}</span>
                        </div>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        });

        subjectsContainer.innerHTML = html;
    }

    // ============================================
    // EDIT & DELETE ACTIONS (EXPOSED GLOBALLY)
    // ============================================

    window.openEditSubjectModal = function(id) {
        const sub = subjects.find(s => s.id === id);
        if (!sub || !editModal) return;

        if (editSubjectId) editSubjectId.value = sub.id;
        if (editSubjectName) editSubjectName.value = sub.name;
        if (editGradeId) editGradeId.value = sub.grade;
        if (editDescription) editDescription.value = sub.description || '';

        // Show/hide strand input
        if (editStrandGroup && editStrand) {
            if (sub.grade === 11 || sub.grade === 12) {
                editStrandGroup.style.display = 'block';
                editStrand.value = sub.strand || '';
            } else {
                editStrandGroup.style.display = 'none';
                editStrand.value = '';
            }
        }

        editModal.classList.add('show');
    };

    function closeEditModalFn() {
        if (editModal) editModal.classList.remove('show');
    }

    if (closeEditModal) closeEditModal.addEventListener('click', closeEditModalFn);
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeEditModalFn);

    if (editGradeId) {
        editGradeId.addEventListener('change', function() {
            const val = parseInt(this.value);
            if (editStrandGroup) {
                editStrandGroup.style.display = (val === 11 || val === 12) ? 'block' : 'none';
            }
        });
    }

    if (editSubjectForm) {
        editSubjectForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const id = editSubjectId.value;
            const name = editSubjectName.value.trim();
            const grade = parseInt(editGradeId.value);
            const strand = (grade === 11 || grade === 12) ? (editStrand.value || null) : null;
            const desc = editDescription.value.trim();

            if (!name) {
                showAlert('Subject name is required', 'error');
                return;
            }

            const submitBtn = editSubjectForm.querySelector('button[type="submit"]');
            try {
                if (submitBtn) submitBtn.disabled = true;

                const { error } = await supabase
                    .from('subjects')
                    .update({
                        name: name,
                        grade_level: String(grade),
                        strand: strand,
                        description: desc,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', id);

                if (error) throw error;

                showAlert('✅ Subject updated successfully!', 'success');
                closeEditModalFn();
                await loadSubjects();
            } catch (err) {
                console.error('Error updating subject:', err);
                showAlert('Failed to update subject: ' + err.message, 'error');
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }

    window.deleteSubjectPrompt = async function(id) {
        const sub = subjects.find(s => s.id === id);
        if (!sub) return;

        if (!confirm(`Are you sure you want to delete "${sub.name}" from the curriculum?`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('subjects')
                .delete()
                .eq('id', id);

            if (error) throw error;

            showAlert(`✅ Deleted "${sub.name}" successfully!`, 'success');
            await loadSubjects();
        } catch (err) {
            console.error('Error deleting subject:', err);
            showAlert('Failed to delete subject: ' + err.message, 'error');
        }
    };

    // ============================================
    // FILTER CONTROLS
    // ============================================

    // Grade Cards Click
    if (gradeCardsContainer) {
        const cards = gradeCardsContainer.querySelectorAll('.grade-card');
        cards.forEach(card => {
            card.addEventListener('click', function(e) {
                e.preventDefault();
                cards.forEach(c => c.classList.remove('active'));
                this.classList.add('active');

                currentActiveGrade = this.dataset.grade; // 'all', '7', ...

                // Handle strand filter visibility
                if (strandFilterWrapper) {
                    const isSHS = currentActiveGrade === '11' || currentActiveGrade === '12';
                    strandFilterWrapper.style.display = (currentActiveGrade === 'all' || isSHS) ? 'block' : 'none';
                }

                renderSubjects();
            });
        });
    }



    // Strand Filter
    if (strandFilter) {
        strandFilter.addEventListener('change', function() {
            currentActiveStrand = this.value;
            renderSubjects();
        });
    }

    // Search Input
    if (searchInput) {
        searchInput.addEventListener('input', renderSubjects);
    }

    // Reset Button
    if (resetBtn) {
        resetBtn.addEventListener('click', function() {
            currentActiveGrade = 'all';
            currentActiveStrand = '';

            if (strandFilter) strandFilter.value = '';
            if (searchInput) searchInput.value = '';

            if (gradeCardsContainer) {
                const cards = gradeCardsContainer.querySelectorAll('.grade-card');
                cards.forEach(c => {
                    if (c.dataset.grade === 'all') c.classList.add('active');
                    else c.classList.remove('active');
                });
            }

            if (strandFilterWrapper) strandFilterWrapper.style.display = 'block';

            renderSubjects();
        });
    }

    // Close modal on background click
    document.addEventListener('click', function(e) {
        if (e.target === editModal) closeEditModalFn();
    });

    // Mobile menu toggle
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
        });
    }

    // Initial load
    await loadSubjects();
});
