import { supabase } from '../supabase/config.js';

export class StudentIdGenerator {
    constructor(config = {}) {
        this.containerId = config.containerId || 'idGeneratorApp';
        this.defaultPrincipal = config.defaultPrincipal || 'Dr. Ryan R. Quiroga';
        this.defaultSchoolYear = config.defaultSchoolYear || '2026-2027';
        this.students = [];
        this.selectedStudent = this.getDefaultStudent();
        this.qrCodeInstance = null;
        this.customPhotoUploaded = false;

        this.init();
    }

    getDefaultStudent() {
        return {
            id: '1167c85a-09c5-4a3f-9c07-dd21da0dc16c',
            student_id: '1167c85a-09c5-4a3f-9c07-dd21da0dc16c',
            lrn: '141525872196',
            id_number: '1167c85a-09c5-4a3f-9c07-dd21da0dc16c',
            first_name: 'Janrey',
            last_name: 'Baylocon',
            fullname: 'Janrey Baylocon',
            grade_level: 'Grade 10',
            level_category: 'Grade 10',
            strand: '',
            school_year: this.defaultSchoolYear || '2026-2027',
            photo_url: '',
            parent_name: 'MARIANNE E. SANTOS',
            parent_contact: '09076726568',
            principal_name: this.defaultPrincipal || 'Dr. Ryan R. Quiroga',
            principal_sig: this.defaultPrincipal || 'Dr. Ryan R. Quiroga',
            status: 'Active'
        };
    }

    init() {
        console.log('🎓 Initializing PLSNHS Official Student ID Generator...');
        this.renderInterface();
        this.setupEvents();
        this.selectStudent(this.selectedStudent);
        this.loadStudentsAsync();
    }

    async loadStudentsAsync() {
        if (!supabase) return;

        try {
            const { data: studentsData, error: stErr } = await supabase
                .from('students')
                .select('*')
                .order('last_name', { ascending: true });

            if (stErr) {
                console.warn('Notice loading students:', stErr);
                return;
            }

            const { data: enrData } = await supabase
                .from('enrollments')
                .select('*')
                .order('created_at', { ascending: false });

            const sList = studentsData || [];
            const eList = enrData || [];

            if (sList.length > 0) {
                const loaded = sList.map(st => {
                    const enr = eList.find(e => e.student_id === st.id || (e.email && st.email && e.email.toLowerCase() === st.email.toLowerCase())) || {};

                    const fName = (st.first_name || enr.first_name || '').trim();
                    const lName = (st.last_name || enr.last_name || '').trim();
                    let fullName = `${fName} ${lName}`.trim() || st.fullname || 'Student';
                    fullName = this.formatTitleCase(fullName);

                    let grade = st.grade_level || enr.grade_level || 'Grade 10';
                    const numMatch = String(grade).match(/\d+/);
                    if (numMatch) {
                        grade = `Grade ${numMatch[0]}`;
                    }

                    const strand = (st.strand || enr.strand || st.track || enr.track || '').trim();
                    const lrn = st.lrn || enr.lrn || '141525872196';
                    const photo = st.two_by_two_picture_url || enr.two_by_two_picture_url || st.avatar_url || '';
                    const parentName = st.parent_name || enr.guardian_name || enr.mother_name || enr.father_name || 'MARIANNE E. SANTOS';
                    const parentContact = st.parent_contact || enr.guardian_contact || enr.contact_number || '09076726568';
                    const idNumber = st.id || st.student_id || st.id_number || '1167c85a-09c5-4a3f-9c07-dd21da0dc16c';

                    return {
                        id: st.id,
                        student_id: st.id,
                        enrollment_id: enr.id || st.enrollment_id,
                        lrn: lrn,
                        id_number: idNumber,
                        first_name: fName,
                        last_name: lName,
                        fullname: fullName,
                        grade_level: grade,
                        level_category: grade,
                        strand: strand,
                        photo_url: photo,
                        parent_name: parentName,
                        parent_contact: parentContact,
                        principal_name: this.defaultPrincipal || 'Dr. Ryan R. Quiroga',
                        principal_sig: this.defaultPrincipal || 'Dr. Ryan R. Quiroga',
                        school_year: this.defaultSchoolYear || '2026-2027',
                        status: st.status || enr.status || 'Active'
                    };
                });

                this.students = loaded;
                this.updateSelectDropdown();

                const params = new URLSearchParams(window.location.search);
                const targetId = params.get('id') || params.get('student_id');
                const enrId = params.get('enrollment_id');

                if (targetId) {
                    const found = this.students.find(s => s.id === targetId || s.student_id === targetId);
                    if (found) this.selectStudent(found);
                } else if (enrId) {
                    const found = this.students.find(s => s.enrollment_id === enrId);
                    if (found) this.selectStudent(found);
                }
            }
        } catch (err) {
            console.warn('Notice during student fetch:', err);
        }
    }

    updateSelectDropdown(gradeFilter = null) {
        const sel = document.getElementById('studentSelect');
        if (!sel) return;

        const filterGradeEl = document.getElementById('filterStudentGrade');
        const activeFilter = gradeFilter !== null ? gradeFilter : (filterGradeEl ? filterGradeEl.value : 'all');

        let filtered = [...this.students];
        if (activeFilter && activeFilter !== 'all') {
            const cleanFilterNum = activeFilter.replace(/\D/g, '');
            filtered = filtered.filter(s => {
                const sGrade = String(s.grade_level || '');
                const sNum = sGrade.replace(/\D/g, '');
                if (cleanFilterNum && sNum) {
                    return sNum === cleanFilterNum;
                }
                return sGrade.toLowerCase() === activeFilter.toLowerCase();
            });
        }

        const gradesOrder = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];
        const groups = {};
        gradesOrder.forEach(g => groups[g] = []);
        groups['Other'] = [];

        filtered.forEach(s => {
            const rawG = String(s.grade_level || '');
            const numMatch = rawG.match(/\d+/);
            if (numMatch && Number(numMatch[0]) >= 7 && Number(numMatch[0]) <= 12) {
                const gKey = `Grade ${numMatch[0]}`;
                groups[gKey].push(s);
            } else {
                groups['Other'].push(s);
            }
        });

        let optgroupsHtml = '';
        gradesOrder.forEach(g => {
            const list = groups[g] || [];
            if (list.length > 0) {
                const isSHS = g.includes('11') || g.includes('12');
                const catLabel = isSHS ? 'Senior High' : 'Junior High';
                optgroupsHtml += `
                    <optgroup label="${g} (${catLabel}) - ${list.length} student${list.length === 1 ? '' : 's'}">
                        ${list.map(s => `
                            <option value="${s.id}">
                                ${s.fullname} (${s.lrn}) - ${g}
                            </option>
                        `).join('')}
                    </optgroup>
                `;
            }
        });

        if (groups['Other'] && groups['Other'].length > 0) {
            optgroupsHtml += `
                <optgroup label="Other Students - ${groups['Other'].length}">
                    ${groups['Other'].map(s => `
                        <option value="${s.id}">
                            ${s.fullname} (${s.lrn}) - ${s.grade_level || 'General'}
                        </option>
                    `).join('')}
                </optgroup>
            `;
        }

        const currentVal = sel.value;
        sel.innerHTML = `
            <option value="">-- Select Student / Default Template --</option>
            ${optgroupsHtml}
        `;

        if (currentVal && filtered.some(s => s.id === currentVal)) {
            sel.value = currentVal;
        } else if (this.selectedStudent && this.selectedStudent.id && filtered.some(s => s.id === this.selectedStudent.id)) {
            sel.value = this.selectedStudent.id;
        } else {
            sel.value = "";
        }
    }

    formatTitleCase(str) {
        if (!str) return '';
        if (str !== str.toUpperCase() && str !== str.toLowerCase()) {
            return str;
        }
        return str.toLowerCase().replace(/(?:^|\s|-)\S/g, (char) => char.toUpperCase());
    }

    getStudentInitial(name) {
        if (!name) return 'J';
        const clean = name.trim().replace(/^[^a-zA-Z0-9]+/, '');
        return clean ? clean.charAt(0).toUpperCase() : 'J';
    }

    // ============================================
    // 2. RENDER MAIN INTERFACE
    // ============================================
    renderInterface() {
        const root = document.getElementById(this.containerId);
        if (!root) {
            console.error(`Container element #${this.containerId} not found.`);
            return;
        }

        root.innerHTML = `
            <div class="id-generator-layout">
                <!-- LEFT COLUMN: LIVE PREVIEW AREA -->
                <div class="id-preview-pane">
                    <div class="id-preview-header">
                        <h3><i class="fas fa-id-badge" style="color: #f3b723;"></i> Official Student ID Card Preview</h3>
                        <div style="display:flex; gap:8px; align-items:center;">
                            <button type="button" id="btnFlipPreview" class="btn-id-action btn-id-download" style="padding: 6px 14px; font-size: 12px;">
                                <i class="fas fa-sync-alt"></i> Flip View
                            </button>
                        </div>
                    </div>

                    <!-- SHOWCASE AREA WITH PRINTABLE CLASS -->
                    <div class="printable-id-card-area id-showcase-container" id="idShowcaseContainer">
                        
                        <!-- FRONT CARD UNIT -->
                        <div class="id-badge-unit" id="unitFront">
                            <div class="student-id-card id-card-front" id="cardFrontElement">
                                <!-- Top Header -->
                                <div class="id-front-header-row">
                                    <img class="id-school-logo" src="../pictures/logo sa skwelahan.png" alt="School Seal" onerror="this.src='../pictures/logo sa skwelahan.jpg'">
                                    <div class="id-school-info">
                                        <div class="id-school-title">Placido L. Señor National High School</div>
                                        <div class="id-school-subtitle">OFFICIAL STUDENT ID</div>
                                        <div class="id-school-year">S.Y. <span id="previewSchoolYear">${this.defaultSchoolYear}</span></div>
                                    </div>
                                </div>

                                <!-- Gold Horizontal Divider -->
                                <div class="id-gold-divider"></div>

                                <!-- Body Row: Photo / Initial & Student Info -->
                                <div class="id-card-body-row">
                                    <!-- Photo Box with Gold Border -->
                                    <div class="id-photo-box">
                                        <img id="previewPhoto" src="" alt="Student Photo" style="display: none;">
                                        <div id="photoInitial" class="id-photo-initial">J</div>
                                    </div>

                                    <!-- Student Metadata -->
                                    <div class="id-student-info">
                                        <div id="previewStudentName" class="id-student-fullname">Janrey Baylocon</div>
                                        <div class="id-student-role">STUDENT</div>

                                        <div class="id-meta-list">
                                            <div class="id-meta-item">
                                                <span class="id-meta-lbl">LRN:</span>
                                                <span class="id-meta-val" id="previewLrn">141525872196</span>
                                            </div>
                                            <span id="previewStudentLevel" style="display: none;">Grade 10</span>
                                            <span id="previewIdNumber" style="display: none;">1167c85a-09c5-4a3f-9c07-dd21da0dc16c</span>
                                        </div>
                                    </div>
                                </div>

                                <!-- Bottom Row: Signature & QR Code -->
                                <div class="id-card-bottom-row">
                                    <div class="id-principal-wrap">
                                        <div class="id-principal-sig" id="previewPrincipalSig">${this.defaultPrincipal}</div>
                                        <div class="id-principal-title">SCHOOL PRINCIPAL</div>
                                    </div>

                                    <div class="id-qr-box-wrap">
                                        <div id="qrCodeContainer" class="id-qr-code-box"></div>
                                    </div>
                                </div>
                            </div>
                            <span class="card-face-tag">Front Side</span>
                        </div>

                        <!-- BACK CARD UNIT -->
                        <div class="id-badge-unit" id="unitBack">
                            <div class="student-id-card id-card-back" id="cardBackElement">
                                <div class="id-back-header">
                                    <div class="id-back-header-left">
                                        <img class="id-back-logo" src="../pictures/logo sa skwelahan.png" alt="School Seal" onerror="this.src='../pictures/logo sa skwelahan.jpg'">
                                        <div>
                                            <div class="id-back-school-name">PLACIDO L. SEÑOR NATIONAL HIGH SCHOOL</div>
                                            <div class="id-back-school-sub">Langtad, City of Naga, Cebu • School ID: 303035</div>
                                        </div>
                                    </div>
                                    <div class="id-back-badge-wrap">
                                        <div class="id-back-dept-tag" id="previewBackDeptTag">JUNIOR HIGH SCHOOL</div>
                                        <div class="id-back-grade-tag" id="previewBackGradeTag">GRADE 10</div>
                                    </div>
                                </div>

                                <div class="id-gold-divider" style="margin: 8px 0 10px 0;"></div>

                                <div class="id-back-body-grid">
                                    <!-- Left Column: Academic & Emergency Info -->
                                    <div class="id-back-col">
                                        <div class="id-back-level-card">
                                            <div class="id-back-level-hdr">
                                                <i class="fas fa-graduation-cap"></i> ACADEMIC CLASSIFICATION
                                            </div>
                                            <div class="id-back-level-row">
                                                <span class="id-back-level-main" id="previewBackLevelVal">Grade 10</span>
                                                <span class="id-back-level-pill" id="previewBackDeptPill">Junior High</span>
                                            </div>
                                        </div>

                                        <div class="id-back-section-title">
                                            <i class="fas fa-phone-alt"></i> IN CASE OF EMERGENCY
                                        </div>
                                        <div class="id-back-field">
                                            <span class="id-back-field-lbl">Parent / Guardian:</span>
                                            <span class="id-back-field-val" id="previewParentName">MARIANNE E. SANTOS</span>
                                        </div>
                                        <div class="id-back-field">
                                            <span class="id-back-field-lbl">Emergency Contact:</span>
                                            <span class="id-back-field-val" id="previewParentPhone">09076726568</span>
                                        </div>

                                        <!-- Student Signature Block -->
                                        <div class="id-back-sig-box">
                                            <div class="id-back-sig-line"></div>
                                            <div class="id-back-sig-name" id="previewStudentSigName">JANREY BAYLOCON</div>
                                            <div class="id-back-sig-role">STUDENT SIGNATURE</div>
                                        </div>
                                    </div>

                                    <!-- Reminders Column -->
                                    <div class="id-back-col">
                                        <div class="id-back-section-title">
                                            <i class="fas fa-shield-alt"></i> IMPORTANT REMINDERS
                                        </div>
                                        <ul class="id-back-rules-list">
                                            <li>This card is official school property and non-transferable.</li>
                                            <li>Must be worn visibly at all times within school grounds.</li>
                                            <li>Use QR code on front for gate attendance tracking.</li>
                                            <li>Report immediately to the Principal's Office if lost.</li>
                                            <li>If found, return to PLSNHS, Langtad, Naga, Cebu.</li>
                                        </ul>
                                    </div>
                                </div>

                                <!-- Back Footer -->
                                <div class="id-back-footer">
                                    <span>PROPERTY OF PLSNHS • OFFICIAL STUDENT IDENTIFICATION</span>
                                    <span>VALID S.Y. <span id="previewBackSchoolYear">${this.defaultSchoolYear}</span></span>
                                </div>
                            </div>
                            <span class="card-face-tag">Back Side</span>
                        </div>

                    </div>
                </div>

                <!-- RIGHT COLUMN: SELECTION & CUSTOMIZATION CONTROLS -->
                <div class="id-controls-pane">
                    <h3 style="font-size: 16px; font-weight: 800; color: #0f172a; margin-bottom: 14px; min-height: 32px; display: flex; align-items: center;">
                        <i class="fas fa-sliders-h" style="color: #162d6b;"></i> Student ID Controls
                    </h3>

                    <!-- Quick Student Search / Select by Year Level -->
                    <div class="id-form-group">
                        <label><i class="fas fa-filter" style="color: #162d6b;"></i> Filter by Year Level</label>
                        <select id="filterStudentGrade">
                            <option value="all">All Year Levels</option>
                            <option value="Grade 7">Grade 7 (Junior High)</option>
                            <option value="Grade 8">Grade 8 (Junior High)</option>
                            <option value="Grade 9">Grade 9 (Junior High)</option>
                            <option value="Grade 10">Grade 10 (Junior High)</option>
                            <option value="Grade 11">Grade 11 (Senior High)</option>
                            <option value="Grade 12">Grade 12 (Senior High)</option>
                        </select>
                    </div>

                    <div class="id-form-group">
                        <label><i class="fas fa-search" style="color: #162d6b;"></i> Select Student</label>
                        <select id="studentSelect">
                            <option value="">-- Select Student / Default Template --</option>
                        </select>
                    </div>

                    <!-- School Year -->
                    <div class="id-form-group">
                        <label><i class="fas fa-calendar-alt" style="color: #162d6b;"></i> School Year (S.Y.)</label>
                        <input type="text" id="inputSchoolYear" value="${this.defaultSchoolYear}" placeholder="e.g. 2026-2027">
                    </div>

                    <!-- Photo Upload / Replace -->
                    <div class="id-form-group">
                        <label><i class="fas fa-camera"></i> Student Photo (2x2 / ID Picture)</label>
                        <input type="file" id="idPhotoUpload" accept="image/*" style="padding: 8px;">
                        <small style="font-size: 11px; color: #64748b; margin-top: 4px; display: block;">
                            If no photo is provided, the card displays the student's initial letter in school gold automatically.
                        </small>
                    </div>

                    <!-- Student Name -->
                    <div class="id-form-group">
                        <label>Student Full Name</label>
                        <input type="text" id="inputStudentName" placeholder="e.g. Janrey Baylocon" value="Janrey Baylocon">
                    </div>

                    <!-- Year Level -->
                    <div class="id-form-group">
                        <label><i class="fas fa-layer-group" style="color: #162d6b;"></i> Grade / Year Level</label>
                        <select id="inputLevelCategory">
                            <option value="Grade 7">Grade 7</option>
                            <option value="Grade 8">Grade 8</option>
                            <option value="Grade 9">Grade 9</option>
                            <option value="Grade 10" selected>Grade 10</option>
                            <option value="Grade 11">Grade 11</option>
                            <option value="Grade 12">Grade 12</option>
                            <option value="Junior High">Junior High</option>
                            <option value="Senior High">Senior High</option>
                        </select>
                    </div>

                    <!-- ID Number & LRN -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div class="id-form-group">
                            <label>LRN</label>
                            <input type="text" id="inputLrn" placeholder="141525872196" value="141525872196">
                        </div>
                        <div class="id-form-group">
                            <label>Student ID</label>
                            <input type="text" id="inputIdNumber" placeholder="1167c85a-09c5-4a3f-9c07-dd21da0dc16c" value="1167c85a-09c5-4a3f-9c07-dd21da0dc16c">
                        </div>
                    </div>

                    <!-- Emergency Guardian & Contact -->
                    <div class="id-form-group">
                        <label>Emergency Parent / Guardian</label>
                        <input type="text" id="inputGuardianName" placeholder="MARIANNE E. SANTOS" value="MARIANNE E. SANTOS">
                    </div>

                    <div class="id-form-group">
                        <label>Emergency Contact Phone</label>
                        <input type="text" id="inputGuardianPhone" placeholder="09076726568" value="09076726568">
                    </div>

                    <!-- Principal Name -->
                    <div class="id-form-group">
                        <label>School Principal Name</label>
                        <input type="text" id="inputPrincipal" value="${this.defaultPrincipal}">
                    </div>

                    <!-- QR Code Identification Mode -->
                    <div class="id-form-group">
                        <label><i class="fas fa-qrcode" style="color: #162d6b;"></i> QR Code Identification Mode</label>
                        <select id="selectQrMode">
                            <option value="url" selected>📱 Mobile Verification (Opens Student Profile)</option>
                            <option value="raw">🏢 Hardware Gate Scanner (Raw Barcode Text)</option>
                        </select>
                    </div>

                    <!-- Action Buttons -->
                    <div class="id-btn-group">
                        <button type="button" id="btnPrintId" class="btn-id-action btn-id-print">
                            <i class="fas fa-print"></i> Print Official ID
                        </button>
                    </div>
                    <div style="display: flex; gap: 8px; margin-top: 10px;">
                        <button type="button" id="btnDownloadFront" class="btn-id-action btn-id-download">
                            <i class="fas fa-download"></i> Front (PNG)
                        </button>
                        <button type="button" id="btnDownloadBack" class="btn-id-action btn-id-download">
                            <i class="fas fa-download"></i> Back (PNG)
                        </button>
                    </div>

                    <!-- Official Verification Note -->
                    <div style="margin-top: auto; padding: 14px; background: #eff6ff; border-left: 4px solid #162d6b; border-radius: 8px; font-size: 11.5px; color: #1e3a8a; line-height: 1.5;">
                        <i class="fas fa-shield-alt" style="margin-right: 4px; color: #f3b723;"></i>
                        <strong>Official PLSNHS Student ID:</strong> Generates landscape CR80 high-resolution student IDs with scannable QR security for gate attendance and official school verification.
                    </div>
                </div>
            </div>
        `;
    }

    setupEvents() {
        const filterGradeEl = document.getElementById('filterStudentGrade');
        if (filterGradeEl) {
            filterGradeEl.addEventListener('change', (e) => {
                const val = e.target.value;
                this.updateSelectDropdown(val);
                const sel = document.getElementById('studentSelect');
                if (sel && sel.options.length > 1 && !sel.value) {
                    sel.selectedIndex = 1;
                    const newId = sel.value;
                    const found = this.students.find(s => s.id === newId);
                    if (found) this.selectStudent(found);
                }
            });
        }

        const studentSelect = document.getElementById('studentSelect');
        if (studentSelect) {
            studentSelect.addEventListener('change', (e) => {
                const sId = e.target.value;
                if (!sId) {
                    this.selectStudent(this.getDefaultStudent());
                    return;
                }
                const found = this.students.find(s => s.id === sId);
                if (found) this.selectStudent(found);
                else this.selectStudent(this.getDefaultStudent());
            });
        }

        const bindInput = (id, callback) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', callback);
        };

        bindInput('inputStudentName', (e) => {
            const raw = e.target.value.trim();
            this.updateStudentNameDisplay(raw);
            this.generateQrCode();
        });

        bindInput('inputSchoolYear', (e) => {
            const val = e.target.value.trim() || this.defaultSchoolYear;
            const syEl = document.getElementById('previewSchoolYear');
            if (syEl) syEl.textContent = val;
            const bsyEl = document.getElementById('previewBackSchoolYear');
            if (bsyEl) bsyEl.textContent = val;
        });

        bindInput('inputLevelCategory', (e) => {
            const val = e.target.value;
            const strand = this.selectedStudent?.strand || '';
            this.updateGradeDisplay(val, strand);
            this.generateQrCode();
        });

        bindInput('inputIdNumber', (e) => {
            const val = e.target.value.trim() || '1167c85a-09c5-4a3f-9c07-dd21da0dc16c';
            const idEl = document.getElementById('previewIdNumber');
            if (idEl) idEl.textContent = val;
            this.generateQrCode();
        });

        bindInput('inputLrn', (e) => {
            const val = e.target.value.trim() || '141525872196';
            const lrnEl = document.getElementById('previewLrn');
            if (lrnEl) lrnEl.textContent = val;
            this.generateQrCode();
        });

        const updateEmergencyInfo = () => {
            const name = document.getElementById('inputGuardianName')?.value.trim().toUpperCase() || 'MARIANNE E. SANTOS';
            const phone = document.getElementById('inputGuardianPhone')?.value.trim() || '09076726568';
            const nameEl = document.getElementById('previewParentName');
            if (nameEl) nameEl.textContent = name;
            const phoneEl = document.getElementById('previewParentPhone');
            if (phoneEl) phoneEl.textContent = phone;
        };

        bindInput('inputGuardianName', updateEmergencyInfo);
        bindInput('inputGuardianPhone', updateEmergencyInfo);

        const selectQrMode = document.getElementById('selectQrMode');
        if (selectQrMode) {
            selectQrMode.addEventListener('change', () => {
                this.generateQrCode();
            });
        }

        bindInput('inputPrincipal', (e) => {
            const val = e.target.value || this.defaultPrincipal;
            const pSigEl = document.getElementById('previewPrincipalSig');
            if (pSigEl) pSigEl.textContent = val;
        });

        // 2x2 Photo Upload Preview
        const photoUpload = document.getElementById('idPhotoUpload');
        const uploadFileNameEl = document.getElementById('uploadFileName');
        if (photoUpload) {
            photoUpload.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                        const dataUrl = evt.target.result;
                        const photoEl = document.getElementById('previewPhoto');
                        const initialEl = document.getElementById('photoInitial');
                        if (photoEl) {
                            photoEl.src = dataUrl;
                            photoEl.style.display = 'block';
                        }
                        if (initialEl) {
                            initialEl.style.display = 'none';
                        }
                        this.customPhotoUploaded = true;
                        if (this.selectedStudent) {
                            this.selectedStudent.photo_url = dataUrl;
                        }
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        // Toggle Flip Preview
        const btnFlipPreview = document.getElementById('btnFlipPreview');
        if (btnFlipPreview) {
            btnFlipPreview.addEventListener('click', () => {
                const front = document.getElementById('unitFront');
                const back = document.getElementById('unitBack');
                if (front && back) {
                    const isBackFirst = back.style.order === '-1';
                    back.style.order = isBackFirst ? '0' : '-1';
                }
            });
        }

        // Print Official ID
        const btnPrint = document.getElementById('btnPrintId');
        if (btnPrint) {
            btnPrint.addEventListener('click', () => {
                const front = document.getElementById('unitFront');
                const back = document.getElementById('unitBack');
                if (front) {
                    front.style.display = 'flex';
                    front.style.order = '0';
                }
                if (back) {
                    back.style.display = 'flex';
                    back.style.order = '1';
                }
                setTimeout(() => {
                    window.print();
                }, 100);
            });
        }

        // Download PNGs
        const btnDlFront = document.getElementById('btnDownloadFront');
        if (btnDlFront) {
            btnDlFront.addEventListener('click', () => {
                this.exportCardAsImage('cardFrontElement', `${this.selectedStudent?.fullname || 'Student'}_ID_Front.png`);
            });
        }

        const btnDlBack = document.getElementById('btnDownloadBack');
        if (btnDlBack) {
            btnDlBack.addEventListener('click', () => {
                this.exportCardAsImage('cardBackElement', `${this.selectedStudent?.fullname || 'Student'}_ID_Back.png`);
            });
        }
    }

    updateStudentNameDisplay(fullName) {
        const displayName = fullName && fullName.trim() ? fullName.trim() : 'Janrey Baylocon';
        const nameEl = document.getElementById('previewStudentName');
        if (nameEl) {
            nameEl.textContent = displayName;
        }

        const sigName = document.getElementById('previewStudentSigName');
        if (sigName) {
            sigName.textContent = displayName.toUpperCase();
        }

        // If no custom uploaded photo or student photo, update the initial letter in the photo box
        const photoEl = document.getElementById('previewPhoto');
        const initialEl = document.getElementById('photoInitial');
        const hasPhoto = !!(this.selectedStudent?.photo_url && this.selectedStudent.photo_url.trim().length > 0);

        if (!hasPhoto && !this.customPhotoUploaded && initialEl) {
            initialEl.textContent = this.getStudentInitial(displayName);
            initialEl.style.display = 'flex';
            if (photoEl) photoEl.style.display = 'none';
        }
    }

    getGradeDetails(gradeStr, strandStr = '') {
        const raw = String(gradeStr || 'Grade 10').trim();
        const numMatch = raw.match(/\d+/);
        const num = numMatch ? parseInt(numMatch[0], 10) : null;

        let isSenior = false;
        if (num !== null) {
            isSenior = num >= 11;
        } else {
            isSenior = raw.toLowerCase().includes('senior') || raw.toLowerCase().includes('shs');
        }

        const dept = isSenior ? 'Senior High School' : 'Junior High School';
        const deptTag = isSenior ? 'SENIOR HIGH SCHOOL' : 'JUNIOR HIGH SCHOOL';
        const deptPill = isSenior ? 'Senior High' : 'Junior High';

        let cleanStrand = String(strandStr || '').trim();
        if (!cleanStrand && this.selectedStudent && this.selectedStudent.strand) {
            cleanStrand = String(this.selectedStudent.strand).trim();
        }
        if (cleanStrand.toUpperCase() === 'N/A' || cleanStrand.toUpperCase() === 'JHS') {
            cleanStrand = '';
        }

        let gradeLabel = num !== null ? `Grade ${num}` : raw;
        let gradeTag = num !== null ? `GRADE ${num}` : raw.toUpperCase();
        let levelVal = gradeLabel;

        if (isSenior && cleanStrand) {
            gradeTag = `${gradeTag} • ${cleanStrand.toUpperCase()}`;
            levelVal = `${gradeLabel} (${cleanStrand.toUpperCase()})`;
        }

        return {
            num,
            isSenior,
            dept,
            deptTag,
            deptPill,
            gradeLabel,
            gradeTag,
            levelVal,
            strand: cleanStrand
        };
    }

    updateGradeDisplay(gradeValue, strandValue = '') {
        const details = this.getGradeDetails(gradeValue, strandValue);

        // Hidden front element for QR generator & external references
        const previewLvl = document.getElementById('previewStudentLevel');
        if (previewLvl) {
            previewLvl.textContent = details.levelVal;
        }

        // Back card header badge
        const backDeptTag = document.getElementById('previewBackDeptTag');
        if (backDeptTag) {
            backDeptTag.textContent = details.deptTag;
        }

        const backGradeTag = document.getElementById('previewBackGradeTag');
        if (backGradeTag) {
            backGradeTag.textContent = details.gradeTag;
        }

        // Back card body level card
        const backLevelVal = document.getElementById('previewBackLevelVal');
        if (backLevelVal) {
            backLevelVal.textContent = details.levelVal;
        }

        const backDeptPill = document.getElementById('previewBackDeptPill');
        if (backDeptPill) {
            backDeptPill.textContent = details.deptPill;
        }
    }

    // ============================================
    // 4. SELECT STUDENT & POPULATE FIELDS
    // ============================================
    selectStudent(student) {
        if (!student) student = this.getDefaultStudent();
        this.selectedStudent = student;
        this.customPhotoUploaded = false;

        const studentSelect = document.getElementById('studentSelect');
        if (studentSelect) studentSelect.value = student.id || '';

        const rawGrade = student.grade_level || 'Grade 10';
        let gradeVal = 'Grade 10';
        const numMatch = String(rawGrade).match(/\d+/);
        if (numMatch) {
            gradeVal = `Grade ${numMatch[0]}`;
        }

        const syVal = student.school_year || this.defaultSchoolYear || '2026-2027';

        // Update inputs
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        };

        setVal('inputStudentName', student.fullname);
        setVal('inputLevelCategory', gradeVal);
        setVal('inputIdNumber', student.id_number || student.id || '1167c85a-09c5-4a3f-9c07-dd21da0dc16c');
        setVal('inputLrn', student.lrn || '141525872196');
        setVal('inputSchoolYear', syVal);
        setVal('inputGuardianName', student.parent_name || 'MARIANNE E. SANTOS');
        setVal('inputGuardianPhone', student.parent_contact || '09076726568');
        setVal('inputPrincipal', student.principal_name || this.defaultPrincipal);

        // Update Front Preview Card
        this.updateStudentNameDisplay(student.fullname);

        // Update Grade & Classification on Back Preview Card
        this.updateGradeDisplay(gradeVal, student.strand);

        const previewId = document.getElementById('previewIdNumber');
        if (previewId) previewId.textContent = student.id_number || student.id || '1167c85a-09c5-4a3f-9c07-dd21da0dc16c';

        const previewLrn = document.getElementById('previewLrn');
        if (previewLrn) previewLrn.textContent = student.lrn || '141525872196';

        const previewSy = document.getElementById('previewSchoolYear');
        if (previewSy) previewSy.textContent = syVal;

        const previewBackSy = document.getElementById('previewBackSchoolYear');
        if (previewBackSy) previewBackSy.textContent = syVal;

        const previewSig = document.getElementById('previewPrincipalSig');
        if (previewSig) previewSig.textContent = student.principal_name || this.defaultPrincipal;

        // Photo / Initial Handling
        const photoEl = document.getElementById('previewPhoto');
        const initialEl = document.getElementById('photoInitial');
        const hasPhoto = !!(student.photo_url && typeof student.photo_url === 'string' && student.photo_url.trim().length > 0);

        if (hasPhoto) {
            if (photoEl) {
                photoEl.src = student.photo_url;
                photoEl.style.display = 'block';
                photoEl.onerror = () => {
                    photoEl.style.display = 'none';
                    if (initialEl) {
                        initialEl.textContent = this.getStudentInitial(student.fullname);
                        initialEl.style.display = 'flex';
                    }
                };
            }
            if (initialEl) initialEl.style.display = 'none';
        } else {
            if (photoEl) {
                photoEl.src = '';
                photoEl.style.display = 'none';
            }
            if (initialEl) {
                initialEl.textContent = this.getStudentInitial(student.fullname);
                initialEl.style.display = 'flex';
            }
        }

        // Update Back Preview Card
        const previewParentName = document.getElementById('previewParentName');
        if (previewParentName) previewParentName.textContent = student.parent_name || 'MARIANNE E. SANTOS';

        const previewParentPhone = document.getElementById('previewParentPhone');
        if (previewParentPhone) previewParentPhone.textContent = student.parent_contact || '09076726568';

        const previewStudentSig = document.getElementById('previewStudentSigName');
        if (previewStudentSig) previewStudentSig.textContent = (student.fullname || 'JANREY BAYLOCON').toUpperCase();

        // Generate Scannable QR Code
        this.generateQrCode();
    }

    // ============================================
    // 5. QR CODE GENERATION
    // ============================================
    generateQrCode() {
        const qrContainer = document.getElementById('qrCodeContainer');
        if (!qrContainer) return;

        qrContainer.innerHTML = '';

        const name = document.getElementById('previewStudentName')?.textContent || 'Janrey Baylocon';
        const lrn = document.getElementById('previewLrn')?.textContent || '141525872196';
        const idNo = document.getElementById('previewIdNumber')?.textContent || '1167c85a-09c5-4a3f-9c07-dd21da0dc16c';
        const level = document.getElementById('previewStudentLevel')?.textContent || 'Grade 10';
        const contact = document.getElementById('inputGuardianPhone')?.value || '09076726568';
        const guardian = document.getElementById('inputGuardianName')?.value || 'MARIANNE E. SANTOS';
        const mode = document.getElementById('selectQrMode')?.value || 'url';

        let qrPayload = '';
        if (mode === 'raw') {
            qrPayload = `PLSNHS-STUDENT|LRN:${lrn}|ID:${idNo}|NAME:${name}|GRADE:${level}|CONTACT:${contact}|STATUS:OFFICIAL_ENROLLED`;
        } else {
            const origin = window.location.origin;
            const isSubPath = window.location.pathname.includes('/CAPSTONEWEB');
            const verifyPath = isSubPath ? '/CAPSTONEWEB/verify_id.html' : '/verify_id.html';
            qrPayload = `${origin}${verifyPath}?lrn=${encodeURIComponent(lrn)}&id=${encodeURIComponent(idNo)}&name=${encodeURIComponent(name)}&grade=${encodeURIComponent(level)}&guardian=${encodeURIComponent(guardian)}&contact=${encodeURIComponent(contact)}`;
        }

        if (typeof QRCode !== 'undefined') {
            try {
                this.qrCodeInstance = new QRCode(qrContainer, {
                    text: qrPayload,
                    width: 108,
                    height: 108,
                    colorDark: '#162d6b',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.M
                });
                return;
            } catch (qrErr) {
                console.warn('QRCode.js render notice:', qrErr);
            }
        }

        // Fallback via high-res API image
        const encoded = encodeURIComponent(qrPayload);
        const img = document.createElement('img');
        img.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encoded}&color=16-45-107`;
        img.alt = 'Student QR Code';
        img.style.width = '100%';
        img.style.height = '100%';
        qrContainer.appendChild(img);

        // Optionally persist generated QR code to Supabase
        if (supabase && (this.selectedStudent?.id || lrn)) {
            const studentId = this.selectedStudent?.id;
            const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(studentId || '');

            if (isValidUUID) {
                supabase
                    .from('students')
                    .update({ qr_code: qrPayload })
                    .eq('id', studentId)
                    .then(({ error }) => {
                        if (error) console.warn('Could not save QR code to student profile:', error);
                    })
                    .catch(e => console.warn('Student QR update notice:', e));
            } else if (lrn && lrn !== '000000000000') {
                supabase
                    .from('students')
                    .update({ qr_code: qrPayload })
                    .eq('lrn', lrn)
                    .then(({ error }) => {
                        if (error) console.warn('Could not save QR code by LRN:', error);
                    })
                    .catch(e => console.warn('Student QR update by LRN notice:', e));
            }
        }
    }

    async exportCardAsImage(elementId, filename) {
        const el = document.getElementById(elementId);
        if (!el) return;

        if (typeof html2canvas !== 'undefined') {
            try {
                const canvas = await html2canvas(el, {
                    scale: 3,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: null,
                    logging: false,
                    scrollX: 0,
                    scrollY: 0
                });
                const link = document.createElement('a');
                link.download = filename;
                link.href = canvas.toDataURL('image/png');
                link.click();
            } catch (e) {
                console.error('Error exporting card:', e);
                window.print();
            }
        } else {
            window.print();
        }
    }
}
