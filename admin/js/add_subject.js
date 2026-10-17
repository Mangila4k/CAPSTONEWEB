// ===== ADD SUBJECT JAVASCRIPT (SUPABASE POWERED) =====
import { supabase } from '../../supabase/config.js';

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const subjectNameInput = document.getElementById('subject_name');
    const gradeSelect = document.getElementById('grade_id');
    const previewName = document.getElementById('previewName');
    const previewGrade = document.getElementById('previewGrade');
    const quickButtons = document.getElementById('quickButtons');
    const categoryTags = document.getElementById('categoryTags');
    const subjectForm = document.getElementById('subjectForm');
    const alertContainer = document.getElementById('alertContainer');

    // State
    let currentCategory = null;
    let isPrefixProtected = false;
    let currentPrefix = '';

    // Subject lists by grade level
    const juniorHighSubjects = [
        'Filipino',
        'English',
        'Mathematics',
        'Science',
        'Araling Panlipunan (AP / Social Studies)',
        'MAPEH',
        'Edukasyon sa Pagpapakatao (EsP / Values Education)',
        'Technology and Livelihood Education (TLE)'
    ];
    
    const seniorHighSubjects = [
        'General Mathematics', 'Statistics and Probability', 'Earth Science', 'Physical Science',
        '21st Century Literature', 'Oral Communication', 'Reading and Writing Skills',
        'Personal Development', 'Understanding Culture, Society and Politics',
        'Introduction to Philosophy', 'Physical Education and Health'
    ];

    const gradeOptions = {
        7: 'Grade 7',
        8: 'Grade 8',
        9: 'Grade 9',
        10: 'Grade 10',
        11: 'Grade 11',
        12: 'Grade 12'
    };

    // Show alert
    function showAlert(message, type = 'error') {
        if (!alertContainer) return;
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        const icon = type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle';
        alertDiv.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
        alertContainer.appendChild(alertDiv);

        setTimeout(function() {
            alertDiv.style.opacity = '0';
            setTimeout(() => {
                alertDiv.remove();
            }, 300);
        }, 5000);
    }

    // Select category
    window.selectCategory = function(category) {
        const gradeId = parseInt(gradeSelect.value);
        
        if (!gradeId) {
            showAlert('Please select a grade level first', 'error');
            return;
        }
        
        const isSeniorHigh = gradeId === 11 || gradeId === 12;
        if (isSeniorHigh) {
            showAlert('For Senior High, you can choose Major or Core.', 'info');
        }
        
        currentCategory = category;
        const prefix = category + ':';
        
        // Remove existing prefix
        const prefixes = ['Core:', 'Major:', 'Elective:'];
        let currentValue = subjectNameInput.value;
        for (let p of prefixes) {
            if (currentValue.startsWith(p)) {
                currentValue = currentValue.substring(p.length).trim();
                break;
            }
        }
        
        if (currentValue === 'Enter Subject Name' || currentValue === '' || currentValue === 'Enter subject name') {
            subjectNameInput.value = prefix + ' Enter Subject Name';
        } else {
            subjectNameInput.value = prefix + ' ' + currentValue;
        }
        
        isPrefixProtected = true;
        currentPrefix = prefix;
        
        document.querySelectorAll('.category-tag').forEach(tag => {
            tag.classList.remove('active-category');
        });
        const activeTag = document.querySelector(`.category-tag[data-category="${category}"]`);
        if (activeTag) activeTag.classList.add('active-category');
        
        updatePreview();
    };

    window.selectMajorCategory = function() {
        const gradeId = parseInt(gradeSelect.value);
        const isSeniorHigh = gradeId === 11 || gradeId === 12;
        
        if (!isSeniorHigh) {
            showAlert('Major category is typically for Senior High (Grades 11-12)', 'error');
            return;
        }
        
        currentCategory = 'Major';
        currentPrefix = 'Major:';
        
        let currentValue = subjectNameInput.value;
        if (currentValue === 'Enter Subject Name' || currentValue === '' || 
            currentValue === 'Core:' || currentValue === 'Elective:' || 
            currentValue === 'Core: Enter Subject Name' || currentValue === 'Elective: Enter Subject Name') {
            subjectNameInput.value = currentPrefix + ' Enter Subject Name';
        } else {
            const prefixes = ['Core:', 'Major:', 'Elective:'];
            for (let p of prefixes) {
                if (currentValue.startsWith(p)) {
                    currentValue = currentValue.substring(p.length).trim();
                    break;
                }
            }
            subjectNameInput.value = currentPrefix + ' ' + currentValue;
        }
        
        isPrefixProtected = true;
        
        document.querySelectorAll('.category-tag').forEach(tag => {
            tag.classList.remove('active-category');
        });
        const activeTag = document.querySelector('.category-tag.major');
        if (activeTag) activeTag.classList.add('active-category');
        
        updatePreview();
    };

    window.setSubjectName = function(name) {
        let currentValue = subjectNameInput.value;
        
        if (isPrefixProtected && currentPrefix) {
            const cleanValue = currentValue.substring(currentPrefix.length).trim();
            if (cleanValue === 'Enter Subject Name' || cleanValue === '') {
                subjectNameInput.value = currentPrefix + ' ' + name;
            } else if (!cleanValue.includes(name)) {
                subjectNameInput.value = currentPrefix + ' ' + cleanValue + ', ' + name;
            } else {
                showAlert('This subject is already in the list', 'error');
            }
        } else {
            if (currentValue === 'Enter Subject Name' || currentValue === '') {
                subjectNameInput.value = name;
            } else if (!currentValue.includes(name)) {
                subjectNameInput.value = currentValue + ', ' + name;
            } else {
                showAlert('This subject is already in the list', 'error');
            }
        }
        
        updatePreview();
        subjectNameInput.focus();
    };

    function protectPrefix(e) {
        if (!isPrefixProtected || !currentPrefix) return true;
        
        const start = this.selectionStart;
        const end = this.selectionEnd;
        const prefixLength = currentPrefix.length;
        
        if (start < prefixLength && end > 0) {
            e.preventDefault();
            showAlert(`The "${currentPrefix}" prefix is protected and cannot be erased.`, 'error');
            return false;
        }
        return true;
    }

    function handleInput() {
        if (!isPrefixProtected || !currentPrefix) return;
        
        let newValue = this.value;
        
        if (!newValue.startsWith(currentPrefix)) {
            if (newValue === '' || newValue === 'Enter Subject Name' || newValue === 'Enter subject name') {
                this.value = currentPrefix + ' Enter Subject Name';
            } else {
                this.value = currentPrefix + ' ' + newValue;
            }
        }
        
        if (newValue === currentPrefix) {
            this.value = currentPrefix + ' Enter Subject Name';
        }
        
        updatePreview();
    }

    function updateCategoryTags() {
        const gradeId = parseInt(gradeSelect.value);
        const isSeniorHigh = gradeId === 11 || gradeId === 12;
        
        if (isSeniorHigh) {
            categoryTags.innerHTML = `
                <button type="button" class="category-tag major active-category" onclick="selectMajorCategory()">
                    <i class="fas fa-star"></i> Major Subject
                </button>
                <button type="button" class="category-tag core" data-category="Core" onclick="selectCategory('Core')">
                    <i class="fas fa-book-open"></i> Core Subject
                </button>
            `;
            selectMajorCategory();
        } else if (gradeId) {
            categoryTags.innerHTML = `
                <button type="button" class="category-tag core" data-category="Core" onclick="selectCategory('Core')">
                    <i class="fas fa-book-open"></i> Core Subject
                </button>
                <button type="button" class="category-tag elective" data-category="Elective" onclick="selectCategory('Elective')">
                    <i class="fas fa-star"></i> Elective
                </button>
            `;
        } else {
            categoryTags.innerHTML = `
                <button type="button" class="category-tag core" data-category="Core" onclick="selectCategory('Core')">
                    <i class="fas fa-book-open"></i> Core Subject
                </button>
                <button type="button" class="category-tag elective" data-category="Elective" onclick="selectCategory('Elective')">
                    <i class="fas fa-star"></i> Elective
                </button>
            `;
        }
    }

    function updateQuickButtons() {
        const gradeId = parseInt(gradeSelect.value);
        const isSeniorHigh = gradeId === 11 || gradeId === 12;
        
        if (!gradeId) {
            quickButtons.innerHTML = '<p class="quick-placeholder">Select a grade level to see quick add options</p>';
            return;
        }
        
        const subjects = isSeniorHigh ? seniorHighSubjects : juniorHighSubjects;
        
        quickButtons.innerHTML = subjects.map(subject => 
            `<button type="button" class="quick-btn" onclick="setSubjectName('${subject.replace(/'/g, "\\'")}')">${subject}</button>`
        ).join('');
    }

    function updatePreview() {
        let subjectName = subjectNameInput.value.trim();
        if (!subjectName || subjectName === '') {
            subjectName = 'Enter Subject Name';
        }
        previewName.textContent = subjectName;

        const gradeId = gradeSelect.value;
        if (gradeId && gradeOptions[gradeId]) {
            previewGrade.textContent = gradeOptions[gradeId];
        } else {
            previewGrade.textContent = 'Grade Level';
        }
    }

    function resetCategory() {
        const gradeId = parseInt(gradeSelect.value);
        const isSeniorHigh = gradeId === 11 || gradeId === 12;
        
        if (isSeniorHigh && gradeId) {
            selectMajorCategory();
        } else if (gradeId) {
            currentCategory = null;
            isPrefixProtected = false;
            currentPrefix = '';
            
            let currentValue = subjectNameInput.value;
            const prefixes = ['Core:', 'Major:', 'Elective:'];
            for (let p of prefixes) {
                if (currentValue.startsWith(p)) {
                    currentValue = currentValue.substring(p.length).trim();
                    subjectNameInput.value = currentValue;
                    break;
                }
            }
            
            document.querySelectorAll('.category-tag').forEach(tag => {
                tag.classList.remove('active-category');
            });
        }
        updatePreview();
    }

    // ===== EVENT LISTENERS =====
    if (subjectNameInput) {
        subjectNameInput.addEventListener('keydown', protectPrefix);
        subjectNameInput.addEventListener('input', handleInput);
    }

    if (gradeSelect) {
        gradeSelect.addEventListener('change', function() {
            resetCategory();
            updateCategoryTags();
            updateQuickButtons();
            updatePreview();
        });
    }

    // ===== FORM SUBMIT =====
    if (subjectForm) {
        subjectForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            let subjectName = subjectNameInput.value.trim();
            const gradeId = gradeSelect.value;
            let errors = [];

            if (!gradeId) {
                errors.push('Please select a grade level');
            }

            if (!subjectName || subjectName === '' || subjectName === 'Enter Subject Name' || subjectName === 'Enter subject name') {
                errors.push('Please enter a valid subject name');
            }

            if (errors.length > 0) {
                showAlert(errors.join('<br>'), 'error');
                return;
            }

            const gradeNum = parseInt(gradeId);
            const isSHS = gradeNum === 11 || gradeNum === 12;
            
            // Determine strand and subject_type
            let strand = null;
            let subjectType = 'Core';

            if (subjectName.startsWith('Major:')) {
                subjectType = 'Applied';
                subjectName = subjectName.replace('Major:', '').trim();
                strand = isSHS ? 'STEM' : null;
            } else if (subjectName.startsWith('Core:')) {
                subjectType = 'Core';
                subjectName = subjectName.replace('Core:', '').trim();
            } else if (subjectName.startsWith('Elective:')) {
                subjectType = 'Elective';
                subjectName = subjectName.replace('Elective:', '').trim();
            }

            // Generate standard code & description if not present
            let autoCode = '';
            const nLower = subjectName.toLowerCase();
            if (nLower.includes('filipino')) autoCode = `FIL-${gradeNum}`;
            else if (nLower.includes('english')) autoCode = `ENG-${gradeNum}`;
            else if (nLower.includes('math')) autoCode = `MATH-${gradeNum}`;
            else if (nLower.includes('science')) autoCode = `SCI-${gradeNum}`;
            else if (nLower.includes('araling') || nLower.includes('panlipunan')) autoCode = `AP-${gradeNum}`;
            else if (nLower.includes('mapeh')) autoCode = `MAPEH-${gradeNum}`;
            else if (nLower.includes('esp') || nLower.includes('pagpapakatao')) autoCode = `ESP-${gradeNum}`;
            else if (nLower.includes('tle') || nLower.includes('technology and livelihood')) autoCode = `TLE-${gradeNum}`;

            let subjectDesc = `Grade ${gradeNum} ${subjectType} subject`;
            if (nLower.includes('mapeh')) {
                subjectDesc = 'Music, Arts, Physical Education (PE), and Health';
            }

            const submitBtn = subjectForm.querySelector('button[type="submit"]');
            try {
                if (submitBtn) submitBtn.disabled = true;

                const { data, error } = await supabase
                    .from('subjects')
                    .insert([{
                        name: subjectName,
                        code: autoCode || null,
                        grade_level: String(gradeNum),
                        strand: strand,
                        subject_type: subjectType,
                        description: subjectDesc
                    }])
                    .select();

                if (error) throw error;

                showAlert('✅ Subject added successfully! Redirecting to subjects list...', 'success');
                setTimeout(() => {
                    window.location.href = 'subjects.html';
                }, 1200);
            } catch (err) {
                console.error('Error adding subject:', err);
                showAlert('Failed to save subject to database: ' + err.message, 'error');
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }

    // ===== INIT =====
    updateCategoryTags();
    updateQuickButtons();
    updatePreview();
});