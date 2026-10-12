/**
 * Official Student ID Card Generator
 * Placido L. Señor National High School (PLSNHS)
 * Precision CR80 Layout matching the official reference ID card design.
 * Real-time QR code generation, 2x2 picture support, dual-sided SVG vectors,
 * and high-resolution print & PNG export.
 */

import { supabase } from '../supabase/config.js';

const DEFAULT_AVATAR = "";
const FALLBACK_SVG_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Ccircle cx='60' cy='60' r='60' fill='%23f1f5f9'/%3E%3Ccircle cx='60' cy='46' r='22' fill='%23cbd5e1'/%3E%3Cpath d='M 24,106 C 24,84 40,74 60,74 C 80,74 96,84 96,106 Z' fill='%23cbd5e1'/%3E%3C/svg%3E";

export class StudentIdGenerator {
    constructor(config = {}) {
        this.containerId = config.containerId || 'idGeneratorApp';
        this.defaultPrincipal = config.defaultPrincipal || 'Dr. Ryan R. Quiroga';
        this.defaultPrincipalSig = 'Dr. Ryan R. Quiroga';
        this.defaultSchoolYear = config.defaultSchoolYear || '2024-2025';
        this.students = [];
        this.selectedStudent = this.getDefaultStudent();
        this.qrCodeInstance = null;
        this.showLanyard = false;
        this.customPhotoUploaded = false;
        this.hasCustomFrontChanges = false;
        this.hasCustomBackChanges = false;

        this.init();
    }

    getDefaultStudent() {
        return {
            id: '',
            student_id: '',
            lrn: '000000000000',
            id_number: '2024-ST-00000',
            first_name: 'STUDENT',
            last_name: 'NAME',
            fullname: 'STUDENT NAME',
            grade_level: 'Grade Level',
            level_category: 'SENIOR HIGH',
            photo_url: '',
            parent_name: 'PARENT / GUARDIAN',
            parent_contact: '09XXXXXXXXX',
            principal_name: this.defaultPrincipal || 'Dr. Ryan R. Quiroga',
            principal_sig: this.defaultPrincipal || 'Dr. Ryan R. Quiroga',
            status: 'Unassigned'
        };
    }

    init() {
        console.log('🎓 Initializing PLSNHS Official Student ID Generator...');

        // 1. Render interface immediately
        this.renderInterface();
        this.setupEvents();
        this.selectStudent(this.selectedStudent);

        // 2. Asynchronously load students from Supabase in background
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
                    const fullName = `${fName} ${lName}`.trim() || st.fullname || 'Student';
                    const grade = st.grade_level || enr.grade_level || 'Grade 11';
                    const isSHS = String(grade).includes('11') || String(grade).includes('12') || String(grade).toUpperCase().includes('SENIOR');
                    const levelCat = isSHS ? 'SENIOR HIGH' : 'JUNIOR HIGH';
                    const lrn = st.lrn || enr.lrn || '141525100086';

                    const photo = st.two_by_two_picture_url || enr.two_by_two_picture_url || st.avatar_url || '';
                    const parentName = st.parent_name || enr.guardian_name || enr.mother_name || enr.father_name || 'MARIANNE E. SANTOS';
                    const parentContact = st.parent_contact || enr.guardian_contact || enr.contact_number || '09076726568';

                    const rawNum = st.lrn ? st.lrn.slice(-5) : (st.id ? st.id.replace(/[^0-9]/g, '').slice(-5) : '00123');
                    const idNumber = st.id_number || `2024-ST-${rawNum.padStart(5, '0')}`;

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
                        level_category: levelCat,
                        photo_url: photo,
                        parent_name: parentName,
                        parent_contact: parentContact,
                        principal_name: 'Dr. Ryan R. Quiroga',
                        principal_sig: 'Dr. Ryan R. Quiroga',
                        status: st.status || enr.status || 'Active'
                    };
                });

                this.students = loaded;
                this.updateSelectDropdown();

                // Check URL params for target student
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
            console.warn('Notice during background student fetch:', err);
        }
    }

    updateSelectDropdown() {
        const sel = document.getElementById('studentSelect');
        if (!sel) return;

        const currentVal = sel.value;
        const studentOptions = this.students.map(s => `
            <option value="${s.id}">
                ${s.fullname} (${s.lrn}) - ${s.level_category || s.grade_level}
            </option>
        `).join('');

        sel.innerHTML = `
            <option value="">-- Select Student / Blank ID --</option>
            ${studentOptions}
        `;

        if (currentVal && this.students.some(s => s.id === currentVal)) {
            sel.value = currentVal;
        } else if (this.selectedStudent && this.selectedStudent.id) {
            sel.value = this.selectedStudent.id;
        } else {
            sel.value = "";
        }
    }

    // Helper: Split name into 2 impactful uppercase lines
    formatNameLines(fullName) {
        if (!fullName) return ['STUDENT', 'NAME'];
        const parts = fullName.trim().toUpperCase().split(/\s+/);
        if (parts.length === 1) return [parts[0], ''];
        if (parts.length === 2) return [parts[0], parts[1]];
        const mid = Math.ceil(parts.length / 2);
        return [
            parts.slice(0, mid).join(' '),
            parts.slice(mid).join(' ')
        ];
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
                        <h3><i class="fas fa-id-badge" style="color: #c89b27;"></i> Official Student ID Card Preview</h3>
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
                            <!-- ACTUAL FRONT CARD (CR80 EXACT RATIO: 318px x 485px) -->
                            <div class="student-id-card id-card-front" id="cardFrontElement">
                                <!-- Header -->
                                <div class="id-front-header">
                                    <h2>PLACIDO L. SEÑOR<br>NATIONAL HIGH SCHOOL</h2>
                                    <div class="id-school-id-tag">SCHOOL ID: 303035</div>
                                </div>
                                <img class="id-front-logo" src="../pictures/logo sa skwelahan.png" alt="School Seal" onerror="this.src='../pictures/logo sa skwelahan.jpg'">

                                <!-- Background Curves SVG -->
                                <svg class="id-card-bg-svg" viewBox="0 0 320 500" preserveAspectRatio="none">
                                    <defs>
                                        <linearGradient id="goldGradFront" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stop-color="#f5d77f" />
                                            <stop offset="35%" stop-color="#b8861d" />
                                            <stop offset="70%" stop-color="#8c6109" />
                                            <stop offset="100%" stop-color="#e8bf54" />
                                        </linearGradient>
                                        <linearGradient id="blueGradFront" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stop-color="#0b2255" />
                                            <stop offset="50%" stop-color="#12408c" />
                                            <stop offset="100%" stop-color="#081738" />
                                        </linearGradient>
                                    </defs>
                                    <!-- Gold Sweeping Arch across top, behind 2x2 photo, and across both Left & Right flanks -->
                                    <path d="M 0,85 C 45,115 90,165 160,165 C 230,165 275,115 320,85 L 320,295 C 255,270 210,240 160,240 C 95,240 45,325 0,430 L 0,85 Z" fill="url(#goldGradFront)" />
                                    <!-- Left Navy Blue Wave with Gold Trim Accent -->
                                    <path d="M 0,235 C 35,270 60,320 60,380 C 60,420 35,450 0,465 L 0,235 Z" fill="url(#blueGradFront)" />
                                    <path d="M 0,235 C 35,270 60,320 60,380 C 60,420 35,450 0,465" fill="none" stroke="url(#goldGradFront)" stroke-width="2.5" />
                                    <!-- Right Navy Blue Wave with Metallic Gold Trim -->
                                    <path d="M 320,95 C 265,135 225,175 225,215 C 225,255 265,275 320,295 L 320,95 Z" fill="url(#blueGradFront)" />
                                    <path d="M 320,95 C 265,135 225,175 225,215 C 225,255 265,275 320,295" fill="none" stroke="url(#goldGradFront)" stroke-width="3.5" stroke-linecap="round" />
                                </svg>

                                <!-- Subtle Official School Logo Watermark in Center Background -->
                                <div class="id-watermark-logo">
                                    <img src="../pictures/logo sa skwelahan.png" alt="School Seal Watermark" onerror="this.src='../pictures/logo sa skwelahan.jpg'">
                                </div>

                                <!-- Student 2x2 Photo Frame (Gold Box) -->
                                <div class="id-photo-custom-wrap">
                                    <img id="previewPhoto" src="" alt="Student Photo" style="display: none;">
                                    <div id="photoEmptyPlaceholder" class="photo-empty-placeholder">
                                        <i class="fas fa-camera"></i>
                                        <span>2x2 Photo</span>
                                    </div>
                                </div>

                                <!-- Student Name (Centered Bold Navy) -->
                                <div class="id-name-custom-wrap">
                                    <div id="previewStudentName">
                                        <span class="id-name-line">STUDENT</span>
                                        <span class="id-name-line">NAME</span>
                                    </div>
                                </div>

                                <!-- Student Level Category -->
                                <div class="id-level-custom-wrap">
                                    <span id="previewStudentLevel">SENIOR HIGH</span>
                                </div>

                                <!-- Gold Horizontal Divider -->
                                <div class="id-front-gold-divider"></div>

                                <!-- ID Number & LRN -->
                                <div class="id-meta-grid">
                                    <span class="meta-lbl">ID NO</span>
                                    <span class="meta-col">:</span>
                                    <span class="meta-val" id="previewIdNumber">2024-ST-00000</span>

                                    <span class="meta-lbl">LRN</span>
                                    <span class="meta-col">:</span>
                                    <span class="meta-val" id="previewLrn">000000000000</span>
                                </div>
                            </div>
                            <span class="card-face-tag">Front Side</span>
                        </div>

                        <!-- BACK CARD UNIT -->
                        <div class="id-badge-unit" id="unitBack">
                            <!-- ACTUAL BACK CARD (CR80 EXACT RATIO: 318px x 485px) -->
                            <div class="student-id-card id-card-back" id="cardBackElement">
                                <!-- Background Wave SVG (Clean corner accents, leaving all text/signatures 100% crisp and readable) -->
                                <svg class="id-card-bg-svg" viewBox="0 0 320 500" preserveAspectRatio="none">
                                    <defs>
                                        <linearGradient id="backBlueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stop-color="#0a1d48" />
                                            <stop offset="50%" stop-color="#12408c" />
                                            <stop offset="100%" stop-color="#081738" />
                                        </linearGradient>
                                        <linearGradient id="backGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stop-color="#f5d77f" />
                                            <stop offset="50%" stop-color="#b8861d" />
                                            <stop offset="100%" stop-color="#e8bf54" />
                                        </linearGradient>
                                    </defs>
                                    <!-- Top Right Blue Corner Accent -->
                                    <path d="M 320,0 L 250,0 C 270,35 295,70 320,100 Z" fill="url(#backBlueGrad)" />
                                    <path d="M 250,0 C 270,35 295,70 320,100" fill="none" stroke="url(#backGoldGrad)" stroke-width="3" />
                                    <!-- Bottom Left Decorative Corner Accent -->
                                    <path d="M 0,400 C 20,425 38,460 45,500 L 0,500 Z" fill="url(#backBlueGrad)" />
                                    <path d="M 0,400 C 20,425 38,460 45,500" fill="none" stroke="url(#backGoldGrad)" stroke-width="2.5" />
                                </svg>

                                <!-- Subtle Official School Logo Watermark on Back -->
                                <div class="id-watermark-logo back-watermark">
                                    <img src="../pictures/logo sa skwelahan.png" alt="School Seal Watermark" onerror="this.src='../pictures/logo sa skwelahan.jpg'">
                                </div>

                                <!-- Emergency Info -->
                                <div class="id-back-emergency">
                                    <div class="emergency-sub">Please contact in case of emergency</div>
                                    <div class="emergency-title">NAME OF PARENT OR GUARDIAN</div>
                                    <div class="emergency-guardian">
                                        <span class="guardian-lbl">Parent / Guardian:</span>
                                        <div class="guardian-val">
                                            <span id="previewParentName">[PARENT / GUARDIAN,</span>
                                            <span id="previewParentPhone">09XXXXXXXXX]</span>
                                        </div>
                                    </div>
                                </div>

                                <!-- Student Attendance QR Code Section (Centered & Clean) -->
                                <div class="id-attendance-qr-section">
                                    <div class="id-qr-custom-wrap">
                                        <div class="qr-corner qr-tl"></div>
                                        <div class="qr-corner qr-tr"></div>
                                        <div class="qr-corner qr-bl"></div>
                                        <div class="qr-corner qr-br"></div>
                                        <div id="qrCodeContainer" class="id-qr-code-box"></div>
                                    </div>
                                    <div class="qr-attendance-badge"><i class="fas fa-qrcode"></i> FOR STUDENT ATTENDANCE</div>
                                </div>

                                <!-- Official Rules List -->
                                <div class="id-back-rules">
                                    <div class="rules-header">IMPORTANT REMINDERS & REGULATIONS</div>
                                    <ol class="rules-list">
                                        <li>This card is for official school identification and daily attendance.</li>
                                        <li>Always wear this ID visibly while inside school grounds.</li>
                                        <li>Report a lost ID immediately to the Principal's Office:
                                            <div class="rules-contact-row">
                                                <span><strong>Phone:</strong> 09123456789</span>
                                                <span><strong>Email:</strong> info@placidosenornhs.com</span>
                                            </div>
                                        </li>
                                        <li>If found, please return to PLSNHS, Langtad, City of Naga, Cebu.</li>
                                    </ol>
                                </div>

                                <!-- Dual Signatures Grid (Left: Student Name | Right: Principal Name) -->
                                <div class="id-signatures-grid">
                                    <div class="sig-col">
                                        <div class="sig-label-name" id="previewStudentSigName">STUDENT NAME</div>
                                        <div class="sig-line"></div>
                                        <div class="sig-role-label">Student Signature</div>
                                    </div>
                                    <div class="sig-col">
                                        <div class="sig-label-name" id="previewPrincipalName">DR. RYAN R. QUIROGA</div>
                                        <div class="sig-line"></div>
                                        <div class="sig-role-label">School Principal</div>
                                    </div>
                                </div>
                            </div>
                            <span class="card-face-tag">Back Side</span>
                        </div>

                    </div>
                </div>

                <!-- RIGHT COLUMN: SELECTION & CUSTOMIZATION CONTROLS -->
                <div class="id-controls-pane">
                    <h3 style="font-size: 16px; font-weight: 800; color: #0f172a; margin-bottom: 16px;">
                        <i class="fas fa-sliders-h" style="color: #2563eb;"></i> Student ID Controls
                    </h3>

                    <!-- Quick Student Search / Select -->
                    <div class="id-form-group">
                        <label><i class="fas fa-search"></i> Select Student</label>
                        <select id="studentSelect">
                            <option value="">-- Select Student / Blank ID --</option>
                            ${this.students.map(s => `
                                <option value="${s.id}">
                                    ${s.fullname} (${s.lrn}) - ${s.level_category || s.grade_level}
                                </option>
                            `).join('')}
                        </select>
                    </div>

                    <!-- Photo Upload / Replace -->
                    <div class="id-form-group">
                        <label><i class="fas fa-camera"></i> 2x2 Student Photo</label>
                        <input type="file" id="idPhotoUpload" accept="image/*" style="padding: 8px;">
                        <small style="font-size: 11px; color: #64748b; margin-top: 4px; display: block;">
                            Uploaded 2x2 picture from enrollment is automatically loaded. You can also upload a new high-res photo.
                        </small>
                    </div>

                    <!-- Student Name -->
                    <div class="id-form-group">
                        <label>Student Full Name</label>
                        <input type="text" id="inputStudentName" placeholder="e.g. STUDENT NAME">
                    </div>

                    <!-- Level Category -->
                    <div class="id-form-group">
                        <label>Level Category</label>
                        <select id="inputLevelCategory">
                            <option value="SENIOR HIGH">SENIOR HIGH</option>
                            <option value="JUNIOR HIGH">JUNIOR HIGH</option>
                        </select>
                    </div>

                    <!-- ID Number & LRN -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div class="id-form-group">
                            <label>ID Number</label>
                            <input type="text" id="inputIdNumber" placeholder="2024-ST-00000">
                        </div>
                        <div class="id-form-group">
                            <label>LRN</label>
                            <input type="text" id="inputLrn" placeholder="000000000000">
                        </div>
                    </div>

                    <!-- Emergency Guardian & Contact -->
                    <div class="id-form-group">
                        <label>Emergency Parent / Guardian</label>
                        <input type="text" id="inputGuardianName" placeholder="PARENT / GUARDIAN NAME">
                    </div>

                    <div class="id-form-group">
                        <label>Emergency Contact Phone</label>
                        <input type="text" id="inputGuardianPhone" placeholder="09XXXXXXXXX">
                    </div>

                    <!-- Principal Name -->
                    <div class="id-form-group">
                        <label>School Principal Name</label>
                        <input type="text" id="inputPrincipal" value="${this.defaultPrincipal}">
                    </div>

                    <!-- Automatic QR Code Identification Mode -->
                    <div class="id-form-group">
                        <label><i class="fas fa-qrcode" style="color: #2563eb;"></i> QR Code Identification Mode</label>
                        <select id="selectQrMode">
                            <option value="url" selected>📱 Automatic Mobile Verification (Opens Student Profile)</option>
                            <option value="raw">🏢 Hardware Gate Scanner (Raw Barcode Text)</option>
                        </select>
                        <small style="font-size: 11px; color: #64748b; margin-top: 4px; display: block;">
                            <i class="fas fa-check-circle" style="color: #10b981;"></i> <strong>Automatic Identification:</strong> Instantly encodes student record into the QR code in real-time.
                        </small>
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
                    <div style="margin-top: 20px; padding: 14px; background: #eff6ff; border-left: 4px solid #0b1a3d; border-radius: 8px; font-size: 11.5px; color: #1e3a8a; line-height: 1.5;">
                        <i class="fas fa-shield-alt" style="margin-right: 4px; color: #c89b27;"></i>
                        <strong>Official PLSNHS QR ID Verification:</strong> This is the official school ID design equipped with a real-time QR security code for gate attendance, library tracking, and emergency parent contact.
                    </div>
                </div>
            </div>
        `;
    }

    setupEvents() {
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

        // Real-time input updates
        const bindInput = (id, callback) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', callback);
        };

        bindInput('inputStudentName', (e) => {
            const raw = e.target.value.trim();
            this.updateStudentNameDisplay(raw);
            this.hasCustomFrontChanges = true;
            this.syncOverlays();
            this.generateQrCode();
        });

        bindInput('inputLevelCategory', (e) => {
            document.getElementById('previewStudentLevel').textContent = e.target.value;
            this.hasCustomFrontChanges = true;
            this.syncOverlays();
            this.generateQrCode();
        });

        bindInput('inputIdNumber', (e) => {
            const val = e.target.value.trim() || '2024-ST-00000';
            document.getElementById('previewIdNumber').textContent = val;
            this.hasCustomFrontChanges = true;
            this.syncOverlays();
            this.generateQrCode();
        });

        bindInput('inputLrn', (e) => {
            const val = e.target.value.trim() || '000000000000';
            document.getElementById('previewLrn').textContent = val;
            this.hasCustomFrontChanges = true;
            this.syncOverlays();
            this.generateQrCode();
        });

        const updateEmergencyInfo = () => {
            const name = document.getElementById('inputGuardianName')?.value.trim().toUpperCase() || 'PARENT / GUARDIAN';
            const phone = document.getElementById('inputGuardianPhone')?.value.trim() || '09XXXXXXXXX';
            const nameEl = document.getElementById('previewParentName');
            if (nameEl) nameEl.textContent = `[${name},`;
            const phoneEl = document.getElementById('previewParentPhone');
            if (phoneEl) phoneEl.textContent = `${phone}]`;
            this.hasCustomBackChanges = true;
            this.syncOverlays();
            this.generateQrCode();
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
            this.updatePrincipalDisplay(val);
            this.hasCustomBackChanges = (val !== this.defaultPrincipal);
            this.syncOverlays();
        });

        // 2x2 Photo Upload Preview
        const photoUpload = document.getElementById('idPhotoUpload');
        if (photoUpload) {
            photoUpload.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                        const dataUrl = evt.target.result;
                        const photoEl = document.getElementById('previewPhoto');
                        const emptyPlaceholder = document.getElementById('photoEmptyPlaceholder');
                        if (photoEl) {
                            photoEl.src = dataUrl;
                            photoEl.style.display = 'block';
                        }
                        if (emptyPlaceholder) {
                            emptyPlaceholder.style.display = 'none';
                        }
                        this.customPhotoUploaded = true;
                        if (this.selectedStudent) {
                            this.selectedStudent.photo_url = dataUrl;
                        }
                        this.syncOverlays();
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
                // Ensure both Front and Back are visible in side-by-side print layout
                const front = document.getElementById('unitFront');
                const back = document.getElementById('unitBack');
                if (front) {
                    front.style.display = 'block';
                    front.style.order = '0';
                }
                if (back) {
                    back.style.display = 'block';
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

    // Helper: update student name on card front and signatures
    updateStudentNameDisplay(fullName) {
        const displayName = (fullName && fullName.trim()) ? fullName.trim().toUpperCase() : 'STUDENT NAME';
        const [line1, line2] = this.formatNameLines(displayName);
        const nameContainer = document.getElementById('previewStudentName');
        if (nameContainer) {
            const maxLen = Math.max((line1 || '').length, (line2 || '').length);
            let fontSize = '24px';
            if (maxLen > 18) fontSize = '17px';
            else if (maxLen > 14) fontSize = '20px';
            else if (maxLen > 11) fontSize = '22px';

            nameContainer.style.display = 'flex';
            nameContainer.style.flexDirection = 'column';
            nameContainer.style.alignItems = 'center';
            nameContainer.style.textAlign = 'center';
            nameContainer.style.width = '100%';

            nameContainer.innerHTML = `
                <span class="id-name-line" style="font-size: ${fontSize}; text-align: center;">${line1}</span>
                ${line2 ? `<span class="id-name-line" style="font-size: ${fontSize}; text-align: center;">${line2}</span>` : ''}
            `;
        }

        const sigName = document.getElementById('previewStudentSigName');
        if (sigName) sigName.textContent = displayName;
    }

    // Helper: update principal signature and printed name on card back
    updatePrincipalDisplay(principalName) {
        const val = (principalName || this.defaultPrincipal || 'Dr. J. Ramos').trim();
        const principalNameEl = document.getElementById('previewPrincipalName');
        if (principalNameEl) {
            principalNameEl.textContent = val.toUpperCase();
        }
    }

    // Seamless sync: Keeps all dynamic elements active with crisp transparent rendering
    syncOverlays() {
        // All elements are rendered directly onto the clean template with transparent backgrounds
    }

    // ============================================
    // 4. SELECT STUDENT & POPULATE FIELDS
    // ============================================
    selectStudent(student) {
        if (!student) student = this.getDefaultStudent();
        this.selectedStudent = student;

        const isUnassigned = !student.id || student.fullname === 'STUDENT NAME';
        this.customPhotoUploaded = !isUnassigned && (student.photo_url && student.photo_url !== DEFAULT_AVATAR);
        this.hasCustomFrontChanges = !isUnassigned;
        this.hasCustomBackChanges = !isUnassigned;

        const studentSelect = document.getElementById('studentSelect');
        if (studentSelect) studentSelect.value = student.id || '';

        const isSHS = String(student.grade_level || '').includes('11') || String(student.grade_level || '').includes('12') || String(student.level_category || '').toUpperCase().includes('SENIOR');
        const levelCategory = isSHS ? 'SENIOR HIGH' : 'JUNIOR HIGH';

        // Update inputs
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        };

        setVal('inputStudentName', isUnassigned ? '' : student.fullname);
        setVal('inputLevelCategory', levelCategory);
        setVal('inputIdNumber', isUnassigned ? '' : student.id_number);
        setVal('inputLrn', isUnassigned ? '' : student.lrn);
        setVal('inputGuardianName', isUnassigned ? '' : student.parent_name);
        setVal('inputGuardianPhone', isUnassigned ? '' : student.parent_contact);
        setVal('inputPrincipal', student.principal_name || this.defaultPrincipal);

        // Update Preview Card Front
        this.updateStudentNameDisplay(student.fullname);

        const previewLevel = document.getElementById('previewStudentLevel');
        if (previewLevel) previewLevel.textContent = levelCategory;

        const previewId = document.getElementById('previewIdNumber');
        if (previewId) previewId.textContent = student.id_number || '2024-ST-00000';

        const previewLrn = document.getElementById('previewLrn');
        if (previewLrn) previewLrn.textContent = student.lrn || '000000000000';

        // Photo Handling: Remains empty if no picture has been uploaded/registered yet
        const photoEl = document.getElementById('previewPhoto');
        const emptyPlaceholder = document.getElementById('photoEmptyPlaceholder');
        const hasPhoto = !!(student.photo_url && typeof student.photo_url === 'string' && student.photo_url.trim().length > 0);

        if (hasPhoto) {
            if (photoEl) {
                photoEl.src = student.photo_url;
                photoEl.style.display = 'block';
                photoEl.onerror = () => {
                    photoEl.style.display = 'none';
                    if (emptyPlaceholder) emptyPlaceholder.style.display = 'flex';
                };
            }
            if (emptyPlaceholder) emptyPlaceholder.style.display = 'none';
        } else {
            if (photoEl) {
                photoEl.src = '';
                photoEl.style.display = 'none';
            }
            if (emptyPlaceholder) emptyPlaceholder.style.display = 'flex';
        }

        // Update Preview Card Back
        const previewParentName = document.getElementById('previewParentName');
        if (previewParentName) previewParentName.textContent = `[${student.parent_name || 'PARENT / GUARDIAN'},`;

        const previewParentPhone = document.getElementById('previewParentPhone');
        if (previewParentPhone) previewParentPhone.textContent = `${student.parent_contact || '09XXXXXXXXX'}]`;

        this.updatePrincipalDisplay(student.principal_name || this.defaultPrincipal);

        // Sync overlays visibility
        this.syncOverlays();

        // Generate Scannable QR Code
        this.generateQrCode();
    }

    // ============================================
    // 5. QR CODE GENERATION (AUTOMATIC IDENTIFICATION)
    // ============================================
    generateQrCode() {
        const qrContainer = document.getElementById('qrCodeContainer');
        if (!qrContainer) return;

        qrContainer.innerHTML = '';

        const name = (this.selectedStudent?.fullname && this.selectedStudent.fullname !== 'STUDENT NAME')
            ? this.selectedStudent.fullname.toUpperCase()
            : (document.getElementById('inputStudentName')?.value.trim().toUpperCase() || 'STUDENT NAME');

        const lrn = document.getElementById('previewLrn')?.textContent || '000000000000';
        const idNo = document.getElementById('previewIdNumber')?.textContent || '2024-ST-00000';
        const level = document.getElementById('previewStudentLevel')?.textContent || 'SENIOR HIGH';
        const contact = document.getElementById('inputGuardianPhone')?.value || '09XXXXXXXXX';
        const guardian = document.getElementById('inputGuardianName')?.value || 'PARENT / GUARDIAN';
        const mode = document.getElementById('selectQrMode')?.value || 'url';

        let qrPayload = '';
        if (mode === 'raw') {
            // Raw structured format for hardware barcode scanners
            qrPayload = `PLSNHS-STUDENT|LRN:${lrn}|ID:${idNo}|NAME:${name}|LEVEL:${level}|CONTACT:${contact}|STATUS:OFFICIAL_ENROLLED`;
        } else {
            // Automatic mobile phone verification URL: scanning instantly opens student's digital record
            const origin = window.location.origin;
            const isSubPath = window.location.pathname.includes('/CAPSTONEWEB');
            const verifyPath = isSubPath ? '/CAPSTONEWEB/verify_id.html' : '/verify_id.html';
            qrPayload = `${origin}${verifyPath}?lrn=${encodeURIComponent(lrn)}&id=${encodeURIComponent(idNo)}&name=${encodeURIComponent(name)}&level=${encodeURIComponent(level)}&guardian=${encodeURIComponent(guardian)}&contact=${encodeURIComponent(contact)}`;
        }

        if (typeof QRCode !== 'undefined') {
            try {
                this.qrCodeInstance = new QRCode(qrContainer, {
                    text: qrPayload,
                    width: 112,
                    height: 112,
                    colorDark: '#0c1a3a',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.M
                });
                return;
            } catch (qrErr) {
                console.warn('QRCode.js render notice:', qrErr);
            }
        }

        // Robust Fallback via image
        const encoded = encodeURIComponent(qrPayload);
        const img = document.createElement('img');
        img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encoded}`;
        img.alt = 'Student QR Code';
        img.style.width = '100%';
        img.style.height = '100%';
        qrContainer.appendChild(img);
    }

    formatSignature(name) {
        if (!name) return 'Student';
        return name.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
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
                    backgroundColor: '#ffffff',
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
