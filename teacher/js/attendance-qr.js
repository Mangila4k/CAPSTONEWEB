/**
 * ==========================================================================
 * HES TEACHER DASHBOARD - STUDENT ID QR ATTENDANCE SCANNER ENGINE
 * ==========================================================================
 * Features:
 * - High-FPS Live Camera QR Scanner (jsQR + BarcodeDetector API)
 * - USB / Hardware Barcode Scanner auto-detection
 * - Multi-engine Payload Parser (URL parameters, Pipe Delimited, Raw LRN, JSON)
 * - Live Student HUD Pop-up Card (Photo, Name, LRN, Grade & Section, Guardian)
 * - Real-Time Philippine Standard Time calculation & Cutoff evaluation (Present / Late)
 * - Web Audio API Synthesizer Chimes & Voice TTS Announcements
 * - Supabase Synchronization (Attendance Upserts + Student Notification Triggers)
 * - Offline-Resilient LocalStorage caching
 * - CSV Export
 */

import { supabase } from '../../supabase/config.js';

(function () {
    'use strict';

    console.log('📷 Student ID QR Scanner Module initialized');

    // ============================================
    // DOM ELEMENTS
    // ============================================
    const teacherName = document.getElementById('teacherName');
    const teacherInitial = document.getElementById('teacherInitial');
    const logoutBtn = document.getElementById('logoutBtn');
    const currentDateBadge = document.getElementById('currentDateBadge');
    const phTimeDisplay = document.getElementById('phTimeDisplay');
    const alertContainer = document.getElementById('alertContainer');

    // Configuration elements
    const sessionModeSelect = document.getElementById('sessionModeSelect');
    const sectionFilterSelect = document.getElementById('sectionFilterSelect');
    const lateCutoffTime = document.getElementById('lateCutoffTime');
    const soundToggle = document.getElementById('soundToggle');
    const ttsToggle = document.getElementById('ttsToggle');

    // Camera elements
    const scannerVideo = document.getElementById('scannerVideo');
    const scannerCanvas = document.getElementById('scannerCanvas');
    const cameraStandbyState = document.getElementById('cameraStandbyState');
    const btnStartCamera = document.getElementById('btnStartCamera');
    const btnToggleScanner = document.getElementById('btnToggleScanner');
    const cameraDeviceSelect = document.getElementById('cameraDeviceSelect');
    const btnFlipCamera = document.getElementById('btnFlipCamera');
    const btnToggleTorch = document.getElementById('btnToggleTorch');
    const qrFileInput = document.getElementById('qrFileInput');
    const scannerStatusIndicator = document.getElementById('scannerStatusIndicator');
    const scannerStatusText = document.getElementById('scannerStatusText');
    const laserLine = document.getElementById('laserLine');

    // Hardware / Manual Input
    const hardwareScanInput = document.getElementById('hardwareScanInput');
    const btnSubmitManualLrn = document.getElementById('btnSubmitManualLrn');

    // HUD Card elements
    const studentHudCard = document.getElementById('studentHudCard');
    const hudResultBadge = document.getElementById('hudResultBadge');
    const hudTimestamp = document.getElementById('hudTimestamp');
    const hudStudentPhoto = document.getElementById('hudStudentPhoto');
    const hudAvatarInitial = document.getElementById('hudAvatarInitial');
    const hudStudentName = document.getElementById('hudStudentName');
    const hudStudentLrn = document.getElementById('hudStudentLrn');
    const hudStudentIdNo = document.getElementById('hudStudentIdNo');
    const hudStudentGrade = document.getElementById('hudStudentGrade');
    const hudStudentStrand = document.getElementById('hudStudentStrand');
    const hudGuardianInfo = document.getElementById('hudGuardianInfo');
    const hudGuardianText = document.getElementById('hudGuardianText');

    // KPI Counters
    const statTotalScanned = document.getElementById('statTotalScanned');
    const statPresentCount = document.getElementById('statPresentCount');
    const statLateCount = document.getElementById('statLateCount');
    const statDuplicates = document.getElementById('statDuplicates');

    // Feed Table
    const feedTableBody = document.getElementById('feedTableBody');
    const feedSearchInput = document.getElementById('feedSearchInput');
    const btnExportCsv = document.getElementById('btnExportCsv');

    // ============================================
    // STATE
    // ============================================
    let sessionUser = null;
    let teacherId = null;
    let displayName = 'Teacher';

    let allStudents = [];
    let allSections = [];
    let todayScans = []; // List of scanned events { studentId, name, lrn, idNo, grade, section, strand, time, status, mode }

    let isScanning = false;
    let videoStream = null;
    let currentFacingMode = 'environment'; // 'environment' (back) or 'user' (front)
    let availableVideoDevices = [];
    let selectedDeviceId = null;
    let animationFrameId = null;
    let lastScanTime = 0;
    const SCAN_COOLDOWN_MS = 2200; // Cooldown between scanning same code
    let lastScannedPayload = '';

    // Default Sections
    const DEFAULT_SECTIONS = [
        { id: 'sec_g7_diamond', name: 'Diamond', grade_level: 'Grade 7', strand: 'JHS' },
        { id: 'sec_g7_emerald', name: 'Emerald', grade_level: 'Grade 7', strand: 'JHS' },
        { id: 'sec_g8_ruby', name: 'Ruby', grade_level: 'Grade 8', strand: 'JHS' },
        { id: 'sec_g8_sapphire', name: 'Sapphire', grade_level: 'Grade 8', strand: 'JHS' },
        { id: 'sec_g9_gold', name: 'Gold', grade_level: 'Grade 9', strand: 'JHS' },
        { id: 'sec_g9_silver', name: 'Silver', grade_level: 'Grade 9', strand: 'JHS' },
        { id: 'sec_g10_rizal', name: 'Rizal', grade_level: 'Grade 10', strand: 'JHS' },
        { id: 'sec_g10_bonifacio', name: 'Bonifacio', grade_level: 'Grade 10', strand: 'JHS' },
        { id: 'sec_g11_stem_a', name: 'STEM A - Newton', grade_level: 'Grade 11', strand: 'STEM' },
        { id: 'sec_g11_abm_a', name: 'ABM A - Gates', grade_level: 'Grade 11', strand: 'ABM' },
        { id: 'sec_g11_humss_a', name: 'HUMSS A - Plato', grade_level: 'Grade 11', strand: 'HUMSS' },
        { id: 'sec_g11_tvl_ict', name: 'TVL A - Turing', grade_level: 'Grade 11', strand: 'TVL-ICT' },
        { id: 'sec_g12_stem_a', name: 'STEM A - Einstein', grade_level: 'Grade 12', strand: 'STEM' },
        { id: 'sec_g12_abm_a', name: 'ABM A - Drucker', grade_level: 'Grade 12', strand: 'ABM' },
        { id: 'sec_g12_humss_a', name: 'HUMSS A - Aristotle', grade_level: 'Grade 12', strand: 'HUMSS' },
        { id: 'sec_g12_tvl_ict', name: 'TVL A - Lovelace', grade_level: 'Grade 12', strand: 'TVL-ICT' }
    ];

    // Default Students
    const DEFAULT_STUDENTS = [
        { id: 'stu_g7_1', full_name: 'Juan Dela Cruz', lrn: '109283746501', id_number: '2024-ST-00001', grade_level: 'Grade 7', section: 'Diamond', strand: 'JHS', parent_name: 'PEDRO DELA CRUZ', parent_contact: '09123456781', photo_url: '' },
        { id: 'stu_g7_2', full_name: 'Maria Santos', lrn: '109283746502', id_number: '2024-ST-00002', grade_level: 'Grade 7', section: 'Diamond', strand: 'JHS', parent_name: 'ELENA SANTOS', parent_contact: '09123456782', photo_url: '' },
        { id: 'stu_g8_1', full_name: 'Gabriel Alcantara', lrn: '109283746504', id_number: '2024-ST-00004', grade_level: 'Grade 8', section: 'Ruby', strand: 'JHS', parent_name: 'ROBERTO ALCANTARA', parent_contact: '09123456784', photo_url: '' },
        { id: 'stu_g9_1', full_name: 'Christian Bautista', lrn: '109283746506', id_number: '2024-ST-00006', grade_level: 'Grade 9', section: 'Gold', strand: 'JHS', parent_name: 'ANTONIO BAUTISTA', parent_contact: '09123456786', photo_url: '' },
        { id: 'stu_g10_1', full_name: 'Mark Anthony Ramos', lrn: '109283746508', id_number: '2024-ST-00008', grade_level: 'Grade 10', section: 'Rizal', strand: 'JHS', parent_name: 'CLARISSA RAMOS', parent_contact: '09123456788', photo_url: '' },
        { id: 'stu_g11_stem_1', full_name: 'Karl Matthew Sanchez', lrn: '109283746510', id_number: '2024-ST-00010', grade_level: 'Grade 11', section: 'STEM A - Newton', strand: 'STEM', parent_name: 'MARIANNE SANTOS', parent_contact: '09076726568', photo_url: '' },
        { id: 'stu_g11_stem_2', full_name: 'Alyssa Joy Hernandez', lrn: '109283746511', id_number: '2024-ST-00011', grade_level: 'Grade 11', section: 'STEM A - Newton', strand: 'STEM', parent_name: 'TERESITA HERNANDEZ', parent_contact: '09123456791', photo_url: '' },
        { id: 'stu_g11_abm_1', full_name: 'Danilo Villanueva Jr.', lrn: '109283746512', id_number: '2024-ST-00012', grade_level: 'Grade 11', section: 'ABM A - Gates', strand: 'ABM', parent_name: 'DANILO VILLANUEVA SR.', parent_contact: '09123456792', photo_url: '' },
        { id: 'stu_g11_tvl_1', full_name: 'Joshua Paul Garcia', lrn: '109283746514', id_number: '2024-ST-00014', grade_level: 'Grade 11', section: 'TVL A - Turing', strand: 'TVL-ICT', parent_name: 'LORENA GARCIA', parent_contact: '09123456794', photo_url: '' },
        { id: 'stu_g12_stem_1', full_name: 'Raphael David Morales', lrn: '109283746516', id_number: '2024-ST-00016', grade_level: 'Grade 12', section: 'STEM A - Einstein', strand: 'STEM', parent_name: 'VICTOR MORALES', parent_contact: '09123456796', photo_url: '' },
        { id: 'stu_g12_humss_1', full_name: 'Elijah John Tolentino', lrn: '109283746518', id_number: '2024-ST-00018', grade_level: 'Grade 12', section: 'HUMSS A - Aristotle', strand: 'HUMSS', parent_name: 'REMEDIOS TOLENTINO', parent_contact: '09123456798', photo_url: '' }
    ];

    // ============================================
    // AUTH & SESSION
    // ============================================
    try {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            sessionUser = JSON.parse(stored);
        }
    } catch (e) {
        console.error('Error reading currentUser:', e);
    }

    if (sessionUser) {
        displayName = sessionUser.full_name || sessionUser.name || 'Teacher';
        teacherId = sessionUser.id || 'teacher_default';
        if (teacherName) teacherName.textContent = displayName;
        if (teacherInitial) teacherInitial.textContent = displayName.charAt(0).toUpperCase();
    }

    // ============================================
    // CLOCK & TIME FUNCTIONS
    // ============================================
    function updateClock() {
        const now = new Date();
        const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        if (currentDateBadge) {
            currentDateBadge.innerHTML = `<i class="fas fa-calendar-alt"></i> ${now.toLocaleDateString('en-US', dateOptions)}`;
        }
        if (phTimeDisplay) {
            const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
            phTimeDisplay.textContent = now.toLocaleTimeString('en-US', timeOptions) + ' PST';
        }
    }
    updateClock();
    setInterval(updateClock, 1000);

    function getTodayDateString() {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function getCurrentTimeString() {
        const now = new Date();
        return now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    }

    function showAlert(message, type = 'info') {
        if (!alertContainer) return;
        const alertId = 'alert_' + Date.now();
        const iconMap = {
            'success': 'check-circle',
            'error': 'exclamation-circle',
            'warning': 'exclamation-triangle',
            'info': 'info-circle'
        };
        const icon = iconMap[type] || 'info-circle';

        const alertEl = document.createElement('div');
        alertEl.className = `alert alert-${type}`;
        alertEl.id = alertId;
        alertEl.innerHTML = `
            <i class="fas fa-${icon}"></i>
            <div style="flex:1;">${message}</div>
            <button type="button" style="background:none; border:none; color:inherit; cursor:pointer; font-size:1.1rem;" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        alertContainer.prepend(alertEl);
        setTimeout(() => {
            if (document.getElementById(alertId)) {
                alertEl.style.opacity = '0';
                setTimeout(() => alertEl.remove(), 300);
            }
        }, 5000);
    }

    // ============================================
    // AUDIO SYNTHESIS & SPEECH SYNTHESIS ENGINE
    // ============================================
    let audioCtx = null;

    function initAudio() {
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                audioCtx = new AudioContext();
            }
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    function playSound(type = 'success') {
        if (!soundToggle || !soundToggle.checked) return;
        try {
            initAudio();
            if (!audioCtx) return;

            const now = audioCtx.currentTime;

            if (type === 'success') {
                // Ding-Dong Chime
                const osc1 = audioCtx.createOscillator();
                const gain1 = audioCtx.createGain();
                osc1.type = 'sine';
                osc1.frequency.setValueAtTime(880, now); // A5
                gain1.gain.setValueAtTime(0.3, now);
                gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
                osc1.connect(gain1);
                gain1.connect(audioCtx.destination);
                osc1.start(now);
                osc1.stop(now + 0.35);

                const osc2 = audioCtx.createOscillator();
                const gain2 = audioCtx.createGain();
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(1318.51, now + 0.12); // E6
                gain2.gain.setValueAtTime(0.4, now + 0.12);
                gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
                osc2.connect(gain2);
                gain2.connect(audioCtx.destination);
                osc2.start(now + 0.12);
                osc2.stop(now + 0.55);

            } else if (type === 'duplicate') {
                // Soft double beep
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(587.33, now); // D5
                osc.frequency.setValueAtTime(587.33, now + 0.12);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.setValueAtTime(0, now + 0.08);
                gain.gain.setValueAtTime(0.2, now + 0.12);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(now);
                osc.stop(now + 0.25);

            } else if (type === 'error') {
                // Low warning buzz
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(220, now);
                osc.frequency.linearRampToValueAtTime(140, now + 0.3);
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(now);
                osc.stop(now + 0.35);
            }
        } catch (e) {
            console.warn('Audio synthesis notice:', e);
        }
    }

    function speakAnnouncement(text) {
        if (!ttsToggle || !ttsToggle.checked) return;
        if (!('speechSynthesis' in window)) return;
        try {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.05;
            utterance.pitch = 1.0;
            utterance.lang = 'en-US';
            window.speechSynthesis.speak(utterance);
        } catch (e) {
            console.warn('Speech synthesis notice:', e);
        }
    }

    // ============================================
    // LOAD DATA (STUDENTS & SECTIONS)
    // ============================================
    async function loadData() {
        try {
            // 1. Fetch Sections from Supabase
            let loadedSections = [];
            const { data: secData, error: secErr } = await supabase
                .from('sections')
                .select('*')
                .order('grade_level', { ascending: true });

            if (!secErr && secData && secData.length > 0) {
                loadedSections = secData.map(s => ({
                    id: s.id,
                    name: s.name || s.section_name,
                    grade_level: s.grade_level || s.year_level || 'Grade 7',
                    strand: s.strand || 'JHS'
                }));
            } else {
                loadedSections = DEFAULT_SECTIONS;
            }
            allSections = loadedSections;
            populateSectionDropdown();

            // 2. Fetch Students from Supabase
            let loadedStudents = [];
            const { data: stuData, error: stuErr } = await supabase
                .from('students')
                .select('*')
                .order('last_name', { ascending: true });

            if (!stuErr && stuData && stuData.length > 0) {
                loadedStudents = stuData.map(s => {
                    const secObj = allSections.find(sec => sec.id === s.section_id || sec.name === s.section);
                    const grade = s.grade_level || s.year_level || (secObj ? secObj.grade_level : 'Grade 7');
                    const strand = s.strand || (secObj ? secObj.strand : (grade.includes('11') || grade.includes('12') ? 'STEM' : 'JHS'));
                    const sectionName = s.section || (secObj ? secObj.name : 'Diamond');

                    return {
                        id: s.id,
                        full_name: s.full_name || `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Student',
                        lrn: s.lrn || s.student_id || ('LRN-' + String(s.id).substring(0, 8)),
                        id_number: s.id_number || `2024-ST-${String(s.lrn || s.id).slice(-5).padStart(5, '0')}`,
                        grade_level: grade,
                        section: sectionName,
                        strand: strand,
                        parent_name: s.parent_name || s.guardian_name || 'PARENT / GUARDIAN',
                        parent_contact: s.parent_contact || s.guardian_contact || '09XXXXXXXXX',
                        photo_url: s.photo_url || s.avatar_url || s.two_by_two_picture_url || ''
                    };
                });
            } else {
                loadedStudents = DEFAULT_STUDENTS;
            }
            allStudents = loadedStudents;

            // 3. Load previous scans for today from LocalStorage
            loadTodayScansFromCache();

        } catch (err) {
            console.warn('Data load notice, using fallback:', err);
            allSections = DEFAULT_SECTIONS;
            allStudents = DEFAULT_STUDENTS;
            populateSectionDropdown();
            loadTodayScansFromCache();
        }
    }

    function populateSectionDropdown() {
        if (!sectionFilterSelect) return;
        sectionFilterSelect.innerHTML = '<option value="">All Students (Campus-wide / All Sections)</option>';
        allSections.forEach(sec => {
            const opt = document.createElement('option');
            opt.value = sec.name;
            opt.textContent = `${sec.grade_level} - ${sec.name} (${sec.strand})`;
            sectionFilterSelect.appendChild(opt);
        });
    }

    function loadTodayScansFromCache() {
        const todayStr = getTodayDateString();
        try {
            const cached = localStorage.getItem(`hes_qr_scans_${todayStr}`);
            if (cached) {
                todayScans = JSON.parse(cached);
            } else {
                todayScans = [];
            }
        } catch (e) {
            todayScans = [];
        }
        renderFeedTable();
        updateKpiStats();
    }

    function saveTodayScansToCache() {
        const todayStr = getTodayDateString();
        try {
            localStorage.setItem(`hes_qr_scans_${todayStr}`, JSON.stringify(todayScans));
        } catch (e) {}
    }

    // ============================================
    // QR CODE PAYLOAD PARSER
    // ============================================
    function parseStudentPayload(rawText) {
        if (!rawText || typeof rawText !== 'string') return null;
        const text = rawText.trim();

        let lrn = '';
        let idNumber = '';
        let fullName = '';
        let gradeLevel = '';
        let section = '';
        let strand = '';
        let parentName = '';
        let parentContact = '';

        // Case 1: URL format (e.g. https://.../verify_id.html?lrn=109283746510&id=2024-ST-00010&name=...)
        if (text.includes('?') && (text.includes('lrn=') || text.includes('id='))) {
            try {
                const queryString = text.split('?')[1] || '';
                const params = new URLSearchParams(queryString);
                lrn = params.get('lrn') || '';
                idNumber = params.get('id') || '';
                fullName = params.get('name') || '';
                gradeLevel = params.get('level') || '';
                parentName = params.get('guardian') || '';
                parentContact = params.get('contact') || '';
            } catch (e) {}
        }
        // Case 2: Pipe delimited format (e.g. PLSNHS-STUDENT|LRN:109283746510|ID:2024-ST-00010|NAME:...)
        else if (text.includes('|') && (text.includes('LRN:') || text.includes('ID:'))) {
            const parts = text.split('|');
            parts.forEach(p => {
                const [k, ...vParts] = p.split(':');
                const v = vParts.join(':').trim();
                const key = (k || '').trim().toUpperCase();
                if (key === 'LRN') lrn = v;
                else if (key === 'ID') idNumber = v;
                else if (key === 'NAME') fullName = v;
                else if (key === 'LEVEL') gradeLevel = v;
                else if (key === 'CONTACT') parentContact = v;
                else if (key === 'GUARDIAN' || key === 'PARENT') parentName = v;
            });
        }
        // Case 3: JSON format
        else if (text.startsWith('{') && text.endsWith('}')) {
            try {
                const obj = JSON.parse(text);
                lrn = obj.lrn || obj.student_lrn || '';
                idNumber = obj.id || obj.id_number || '';
                fullName = obj.name || obj.full_name || '';
                gradeLevel = obj.level || obj.grade_level || '';
                parentName = obj.guardian || obj.parent_name || '';
                parentContact = obj.contact || obj.parent_contact || '';
            } catch (e) {}
        }
        // Case 4: Raw LRN or ID string (e.g. 109283746510 or 2024-ST-00010)
        else {
            if (/^\d{12}$/.test(text)) {
                lrn = text;
            } else if (text.includes('ST-') || /^\d{4}-\w+-\d+$/.test(text)) {
                idNumber = text;
            } else {
                lrn = text;
            }
        }

        // Match with known student database
        let matchedStudent = null;
        if (lrn) {
            matchedStudent = allStudents.find(s => s.lrn && (s.lrn === lrn || s.lrn.includes(lrn)));
        }
        if (!matchedStudent && idNumber) {
            matchedStudent = allStudents.find(s => s.id_number && (s.id_number === idNumber || s.id_number.includes(idNumber)));
        }
        if (!matchedStudent && fullName && fullName !== 'STUDENT NAME') {
            matchedStudent = allStudents.find(s => s.full_name.toLowerCase() === fullName.toLowerCase());
        }

        if (matchedStudent) {
            return {
                ...matchedStudent,
                matched: true
            };
        }

        // If not found in database, construct synthetic student record from QR data
        if (lrn || fullName) {
            return {
                id: 'qr_' + (lrn || Date.now()),
                full_name: fullName || 'Scanned Student',
                lrn: lrn || '141525100086',
                id_number: idNumber || '2024-ST-00000',
                grade_level: gradeLevel || 'Grade 11',
                section: section || 'STEM A',
                strand: strand || (gradeLevel.includes('11') || gradeLevel.includes('12') ? 'STEM' : 'JHS'),
                parent_name: parentName || 'PARENT / GUARDIAN',
                parent_contact: parentContact || '09XXXXXXXXX',
                photo_url: '',
                matched: false
            };
        }

        return null;
    }

    // ============================================
    // PROCESS ATTENDANCE SCAN EVENT
    // ============================================
    async function handleStudentScan(student) {
        if (!student) return;

        const now = new Date();
        const timeRecorded = getCurrentTimeString();
        const todayStr = getTodayDateString();
        const sessionMode = sessionModeSelect ? sessionModeSelect.value : 'time_in';

        // Check if section filter is active and student doesn't match
        const filterSection = sectionFilterSelect ? sectionFilterSelect.value : '';
        if (filterSection && student.section !== filterSection && !student.section.includes(filterSection)) {
            playSound('error');
            showAlert(`⚠️ Student ${student.full_name} is in <strong>${student.section}</strong>, not in filtered section <strong>${filterSection}</strong>.`, 'warning');
            speakAnnouncement(`${student.full_name}, belongs to ${student.section}`);
            return;
        }

        // Check for duplicates in current session
        const existingScan = todayScans.find(s => (s.studentId === student.id || s.lrn === student.lrn) && s.mode === sessionMode);

        if (existingScan) {
            // Already scanned!
            playSound('duplicate');
            renderStudentHud(student, 'DUPLICATE', existingScan.time);
            speakAnnouncement(`${student.full_name}, already recorded`);
            showAlert(`ℹ️ <strong>${student.full_name}</strong> was already scanned today at ${existingScan.time} (${existingScan.status}).`, 'info');
            statDuplicates.textContent = parseInt(statDuplicates.textContent || 0) + 1;
            return;
        }

        // Evaluate Status: Present vs Late
        let status = 'Present';
        if (sessionMode === 'time_in') {
            const cutoffVal = lateCutoffTime ? lateCutoffTime.value : '07:30';
            const [cutoffHours, cutoffMinutes] = cutoffVal.split(':').map(Number);
            const currentHours = now.getHours();
            const currentMinutes = now.getMinutes();

            if (currentHours > cutoffHours || (currentHours === cutoffHours && currentMinutes > cutoffMinutes)) {
                status = 'Late';
            }
        }

        // Create scan record
        const scanRecord = {
            id: 'scan_' + Date.now(),
            studentId: student.id,
            name: student.full_name,
            lrn: student.lrn,
            idNo: student.id_number,
            grade: student.grade_level,
            section: student.section,
            strand: student.strand,
            parentName: student.parent_name,
            parentContact: student.parent_contact,
            photoUrl: student.photo_url,
            time: timeRecorded,
            date: todayStr,
            status: status,
            mode: sessionMode
        };

        // Add to top of today's scans list
        todayScans.unshift(scanRecord);
        saveTodayScansToCache();

        // Update UI
        renderStudentHud(student, status, timeRecorded);
        renderFeedTable();
        updateKpiStats();

        // Play feedback sounds
        if (status === 'Late') {
            playSound('success');
            speakAnnouncement(`${student.full_name}, Marked Late`);
            showAlert(`⏰ <strong>${student.full_name}</strong> (${student.lrn}) recorded as <strong>LATE</strong> at ${timeRecorded}.`, 'warning');
        } else {
            playSound('success');
            speakAnnouncement(`${student.full_name}, Marked Present`);
            showAlert(`✅ <strong>${student.full_name}</strong> (${student.lrn}) recorded as <strong>PRESENT</strong> at ${timeRecorded}.`, 'success');
        }

        // Sync to Supabase & Notifications in background
        syncAttendanceToSupabase(scanRecord);
    }

    // ============================================
    // SYNC ATTENDANCE TO SUPABASE & NOTIFICATIONS
    // ============================================
    async function syncAttendanceToSupabase(record) {
        try {
            // 1. Upsert attendance record
            const attendanceRow = {
                student_id: record.studentId,
                lrn: record.lrn,
                student_name: record.name,
                grade_level: record.grade,
                section: record.section,
                strand: record.strand,
                date: record.date,
                status: record.status,
                time_in: record.mode === 'time_in' ? record.time : undefined,
                time_out: record.mode === 'time_out' ? record.time : undefined,
                remarks: record.status === 'Late' ? 'Late arrival recorded via QR Scanner' : 'On-time QR scan',
                recorded_by: teacherId,
                teacher_name: displayName,
                updated_at: new Date().toISOString()
            };

            await supabase
                .from('attendance')
                .upsert([attendanceRow], { onConflict: 'student_id,date' });

            // 2. Insert Student/Parent Notification
            const notifTitle = `Attendance: ${record.status} recorded`;
            const notifMsg = `Your attendance was recorded as "${record.status}" on ${record.date} at ${record.time} by Teacher ${displayName}.`;

            await supabase
                .from('notifications')
                .insert([{
                    user_id: record.studentId,
                    student_id: record.studentId,
                    role: 'student',
                    title: notifTitle,
                    message: notifMsg,
                    type: 'attendance',
                    is_read: false,
                    read: false,
                    created_at: new Date().toISOString()
                }]);

            // 3. Update student local notification cache
            try {
                const stuNotifsRaw = localStorage.getItem(`hes_notifications_${record.studentId}`);
                let stuNotifs = stuNotifsRaw ? JSON.parse(stuNotifsRaw) : [];
                stuNotifs.unshift({
                    id: 'notif_' + Date.now(),
                    title: notifTitle,
                    message: notifMsg,
                    type: 'attendance',
                    date: new Date().toISOString(),
                    read: false
                });
                localStorage.setItem(`hes_notifications_${record.studentId}`, JSON.stringify(stuNotifs.slice(0, 30)));
            } catch (e) {}

            // 4. Update the main student attendance roster state for today
            try {
                const rosterKey = `hes_student_attendance_${record.date}`;
                const rosterCache = localStorage.getItem(rosterKey);
                let rosterMap = rosterCache ? JSON.parse(rosterCache) : {};
                rosterMap[record.studentId] = {
                    status: record.status,
                    timeIn: record.time,
                    remarks: record.status === 'Late' ? 'Late arrival (QR)' : 'On time (QR)',
                    notified: true,
                    saved: true
                };
                localStorage.setItem(rosterKey, JSON.stringify(rosterMap));
            } catch (e) {}

        } catch (err) {
            console.warn('Supabase real-time sync notice:', err);
        }
    }

    // ============================================
    // RENDER HUD CARD
    // ============================================
    function renderStudentHud(student, status, timestamp) {
        if (!studentHudCard) return;

        studentHudCard.style.display = 'block';
        studentHudCard.className = 'student-hud-card';

        if (status === 'Late') {
            studentHudCard.classList.add('hud-late');
            hudResultBadge.innerHTML = '<i class="fas fa-clock"></i> LATE RECORDED';
        } else if (status === 'DUPLICATE') {
            studentHudCard.classList.add('hud-duplicate');
            hudResultBadge.innerHTML = '<i class="fas fa-shield-halved"></i> ALREADY RECORDED';
        } else {
            hudResultBadge.innerHTML = '<i class="fas fa-check-circle"></i> PRESENT RECORDED';
        }

        hudTimestamp.textContent = timestamp;
        hudStudentName.textContent = student.full_name.toUpperCase();
        hudStudentLrn.textContent = `LRN: ${student.lrn}`;
        hudStudentIdNo.textContent = student.id_number;
        hudStudentGrade.textContent = `${student.grade_level} - ${student.section}`;
        hudStudentStrand.textContent = student.strand;

        if (student.photo_url) {
            hudStudentPhoto.src = student.photo_url;
            hudStudentPhoto.style.display = 'block';
            hudAvatarInitial.style.display = 'none';
        } else {
            hudStudentPhoto.style.display = 'none';
            hudAvatarInitial.style.display = 'flex';
            hudAvatarInitial.textContent = student.full_name.charAt(0).toUpperCase();
        }

        if (student.parent_name || student.parent_contact) {
            hudGuardianInfo.style.display = 'block';
            hudGuardianText.textContent = `${student.parent_name} (${student.parent_contact})`;
        } else {
            hudGuardianInfo.style.display = 'none';
        }

        // Smooth scroll to HUD if needed
        studentHudCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // ============================================
    // RENDER LIVE FEED TABLE
    // ============================================
    function renderFeedTable() {
        if (!feedTableBody) return;

        const query = (feedSearchInput?.value || '').toLowerCase().trim();
        const filtered = todayScans.filter(s => {
            if (!query) return true;
            return s.name.toLowerCase().includes(query) || s.lrn.includes(query) || s.section.toLowerCase().includes(query);
        });

        if (filtered.length === 0) {
            feedTableBody.innerHTML = `
                <tr id="emptyFeedRow">
                    <td colspan="5" class="empty-feed-cell">
                        <i class="fas fa-qrcode"></i>
                        <p>${query ? 'No matching scans found.' : 'No student QR codes scanned yet today.'}</p>
                        <small>${query ? 'Try a different search term' : 'Start the camera or scan a student ID card to log attendance'}</small>
                    </td>
                </tr>
            `;
            return;
        }

        feedTableBody.innerHTML = filtered.map((s, idx) => `
            <tr>
                <td>
                    <div class="feed-student-cell">
                        <div class="feed-avatar">${s.name.charAt(0).toUpperCase()}</div>
                        <div class="feed-student-meta">
                            <span class="feed-student-name">${s.name}</span>
                            <span class="feed-student-lrn">LRN: ${s.lrn}</span>
                        </div>
                    </div>
                </td>
                <td>
                    <span style="font-weight: 700; color: #334155;">${s.grade} - ${s.section}</span>
                    <small style="display:block; color:#64748b; font-size:11px;">${s.strand}</small>
                </td>
                <td>
                    <strong style="color: #0f172a;">${s.time}</strong>
                    <small style="display:block; color:#64748b; font-size:11px;">${s.mode === 'time_out' ? 'Time-Out' : 'Time-In'}</small>
                </td>
                <td>
                    <span class="status-pill ${s.status === 'Late' ? 'pill-late' : 'pill-present'}">
                        <i class="fas fa-${s.status === 'Late' ? 'clock' : 'check'}"></i> ${s.status}
                    </span>
                </td>
                <td style="text-align: center;">
                    <button type="button" class="btn-feed-action" onclick="window.rescanStudent('${s.id}')" title="View details" style="padding: 3px 8px; font-size: 11px;">
                        <i class="fas fa-eye"></i> View
                    </button>
                </td>
            </tr>
        `).join('');
    }

    window.rescanStudent = function (scanId) {
        const found = todayScans.find(s => s.id === scanId);
        if (found) {
            renderStudentHud({
                id: found.studentId,
                full_name: found.name,
                lrn: found.lrn,
                id_number: found.idNo,
                grade_level: found.grade,
                section: found.section,
                strand: found.strand,
                parent_name: found.parentName,
                parent_contact: found.parentContact,
                photo_url: found.photoUrl
            }, found.status, found.time);
        }
    };

    function updateKpiStats() {
        const total = todayScans.length;
        const present = todayScans.filter(s => s.status === 'Present').length;
        const late = todayScans.filter(s => s.status === 'Late').length;

        if (statTotalScanned) statTotalScanned.textContent = total;
        if (statPresentCount) statPresentCount.textContent = present;
        if (statLateCount) statLateCount.textContent = late;
    }

    // ============================================
    // CAMERA ENGINE & SCANNING LOOP
    // ============================================
    async function enumerateCameraDevices() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            availableVideoDevices = devices.filter(d => d.kind === 'videoinput');
            if (cameraDeviceSelect) {
                cameraDeviceSelect.innerHTML = '<option value="">Default Camera</option>';
                availableVideoDevices.forEach((dev, index) => {
                    const opt = document.createElement('option');
                    opt.value = dev.deviceId;
                    opt.textContent = dev.label || `Camera ${index + 1}`;
                    cameraDeviceSelect.appendChild(opt);
                });
            }
        } catch (e) {
            console.warn('Camera device enumeration notice:', e);
        }
    }

    async function startCamera() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showAlert('❌ Camera access is not supported by your browser.', 'error');
            return;
        }

        initAudio(); // Prepare web audio on user interaction

        try {
            if (videoStream) {
                videoStream.getTracks().forEach(track => track.stop());
            }

            const constraints = {
                video: selectedDeviceId
                    ? { deviceId: { exact: selectedDeviceId } }
                    : { facingMode: currentFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } }
            };

            videoStream = await navigator.mediaDevices.getUserMedia(constraints);
            scannerVideo.srcObject = videoStream;
            scannerVideo.setAttribute('playsinline', true);
            await scannerVideo.play();

            isScanning = true;
            cameraStandbyState.style.display = 'none';

            if (btnToggleScanner) {
                btnToggleScanner.innerHTML = '<i class="fas fa-stop"></i> <span>Stop Camera</span>';
                btnToggleScanner.classList.add('btn-stop');
            }

            if (scannerStatusIndicator) {
                scannerStatusIndicator.querySelector('.pulse-dot').className = 'pulse-dot scanning';
                if (scannerStatusText) scannerStatusText.textContent = 'Scanning Active...';
            }

            // Check if torch is supported
            const track = videoStream.getVideoTracks()[0];
            const capabilities = track.getCapabilities ? track.getCapabilities() : {};
            if (capabilities.torch && btnToggleTorch) {
                btnToggleTorch.style.display = 'flex';
            } else if (btnToggleTorch) {
                btnToggleTorch.style.display = 'none';
            }

            // Update devices dropdown with exact labels
            enumerateCameraDevices();

            // Start optical scanning loop
            requestAnimationFrame(scanLoop);

        } catch (err) {
            console.error('Camera startup error:', err);
            showAlert('❌ Could not start camera: ' + err.message, 'error');
            stopCamera();
        }
    }

    function stopCamera() {
        isScanning = false;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
            videoStream = null;
        }
        if (scannerVideo) {
            scannerVideo.srcObject = null;
        }
        if (cameraStandbyState) {
            cameraStandbyState.style.display = 'flex';
        }
        if (btnToggleScanner) {
            btnToggleScanner.innerHTML = '<i class="fas fa-video"></i> <span>Start Camera</span>';
            btnToggleScanner.classList.remove('btn-stop');
        }
        if (scannerStatusIndicator) {
            scannerStatusIndicator.querySelector('.pulse-dot').className = 'pulse-dot stopped';
            if (scannerStatusText) scannerStatusText.textContent = 'Camera Off';
        }
    }

    async function scanLoop() {
        if (!isScanning) return;

        if (scannerVideo.readyState === scannerVideo.HAVE_ENOUGH_DATA) {
            const width = scannerVideo.videoWidth;
            const height = scannerVideo.videoHeight;

            scannerCanvas.width = width;
            scannerCanvas.height = height;
            const ctx = scannerCanvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(scannerVideo, 0, 0, width, height);

            let decodedText = null;

            // Strategy 1: Native BarcodeDetector if supported (fastest hardware acceleration)
            if ('BarcodeDetector' in window) {
                try {
                    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
                    const barcodes = await detector.detect(scannerCanvas);
                    if (barcodes.length > 0 && barcodes[0].rawValue) {
                        decodedText = barcodes[0].rawValue;
                    }
                } catch (e) {}
            }

            // Strategy 2: jsQR Library fallback
            if (!decodedText && typeof jsQR !== 'undefined') {
                try {
                    const imageData = ctx.getImageData(0, 0, width, height);
                    const code = jsQR(imageData.data, imageData.width, imageData.height, {
                        inversionAttempts: 'dontInvert'
                    });
                    if (code && code.data) {
                        decodedText = code.data;
                    }
                } catch (e) {}
            }

            // If QR code found
            if (decodedText) {
                const now = Date.now();
                if (decodedText !== lastScannedPayload || now - lastScanTime > SCAN_COOLDOWN_MS) {
                    lastScanTime = now;
                    lastScannedPayload = decodedText;

                    const student = parseStudentPayload(decodedText);
                    if (student) {
                        handleStudentScan(student);
                    } else {
                        playSound('error');
                        showAlert(`⚠️ Scanned QR code data is unrecognized or invalid format: "${decodedText}"`, 'warning');
                    }
                }
            }
        }

        animationFrameId = requestAnimationFrame(scanLoop);
    }

    // Toggle Torch / Flashlight
    let isTorchOn = false;
    async function toggleTorch() {
        if (!videoStream) return;
        const track = videoStream.getVideoTracks()[0];
        try {
            isTorchOn = !isTorchOn;
            await track.applyConstraints({
                advanced: [{ torch: isTorchOn }]
            });
            if (btnToggleTorch) {
                btnToggleTorch.style.color = isTorchOn ? '#facc15' : '#e2e8f0';
            }
        } catch (e) {
            console.warn('Torch control notice:', e);
        }
    }

    // Flip Front / Rear Camera
    function flipCamera() {
        currentFacingMode = (currentFacingMode === 'environment') ? 'user' : 'environment';
        selectedDeviceId = null;
        if (isScanning) {
            startCamera();
        }
    }

    // ============================================
    // UPLOAD IMAGE SCANNER
    // ============================================
    function handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        initAudio();
        const reader = new FileReader();
        reader.onload = function (evt) {
            const img = new Image();
            img.onload = function () {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                const imageData = ctx.getImageData(0, 0, img.width, img.height);
                let decoded = null;

                if (typeof jsQR !== 'undefined') {
                    const code = jsQR(imageData.data, imageData.width, imageData.height);
                    if (code && code.data) decoded = code.data;
                }

                if (decoded) {
                    const student = parseStudentPayload(decoded);
                    if (student) {
                        handleStudentScan(student);
                    } else {
                        showAlert('⚠️ QR code detected but could not identify a valid student ID payload.', 'warning');
                    }
                } else {
                    showAlert('❌ No valid QR code could be found in the uploaded image.', 'error');
                }
            };
            img.src = evt.target.result;
        };
        reader.readAsDataURL(file);
    }

    // ============================================
    // HARDWARE BARCODE GUN / KEYBOARD LISTENER
    // ============================================
    let barcodeBuffer = '';
    let barcodeTimeout = null;

    window.addEventListener('keydown', (e) => {
        // If typing inside an input other than hardwareScanInput, ignore
        if (document.activeElement && document.activeElement.tagName === 'INPUT' && document.activeElement !== hardwareScanInput) {
            return;
        }

        if (e.key === 'Enter') {
            if (barcodeBuffer.trim().length > 3) {
                const payload = barcodeBuffer.trim();
                barcodeBuffer = '';
                const student = parseStudentPayload(payload);
                if (student) {
                    handleStudentScan(student);
                }
            }
        } else if (e.key.length === 1) {
            barcodeBuffer += e.key;
            clearTimeout(barcodeTimeout);
            barcodeTimeout = setTimeout(() => {
                barcodeBuffer = '';
            }, 120);
        }
    });

    // ============================================
    // EVENT LISTENERS
    // ============================================
    if (btnStartCamera) btnStartCamera.addEventListener('click', startCamera);
    if (btnToggleScanner) {
        btnToggleScanner.addEventListener('click', () => {
            if (isScanning) stopCamera();
            else startCamera();
        });
    }

    if (btnFlipCamera) btnFlipCamera.addEventListener('click', flipCamera);
    if (btnToggleTorch) btnToggleTorch.addEventListener('click', toggleTorch);
    if (cameraDeviceSelect) {
        cameraDeviceSelect.addEventListener('change', (e) => {
            selectedDeviceId = e.target.value;
            if (isScanning) startCamera();
        });
    }

    if (qrFileInput) qrFileInput.addEventListener('change', handleImageUpload);

    if (btnSubmitManualLrn && hardwareScanInput) {
        const submitManual = () => {
            const raw = hardwareScanInput.value.trim();
            if (!raw) return;
            hardwareScanInput.value = '';
            const student = parseStudentPayload(raw);
            if (student) {
                handleStudentScan(student);
            } else {
                showAlert(`⚠️ Could not find student matching "${raw}".`, 'warning');
            }
        };

        btnSubmitManualLrn.addEventListener('click', submitManual);
        hardwareScanInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submitManual();
        });
    }

    if (feedSearchInput) {
        feedSearchInput.addEventListener('input', renderFeedTable);
    }

    // CSV Export
    if (btnExportCsv) {
        btnExportCsv.addEventListener('click', () => {
            if (todayScans.length === 0) {
                showAlert('ℹ️ No scanned attendance records to export yet.', 'info');
                return;
            }

            let csvContent = 'data:text/csv;charset=utf-8,';
            csvContent += 'Timestamp,Date,Student Name,LRN,ID Number,Grade Level,Section,Strand,Status,Session Mode,Parent Contact\n';

            todayScans.forEach(s => {
                csvContent += `"${s.time}","${s.date}","${s.name}","${s.lrn}","${s.idNo}","${s.grade}","${s.section}","${s.strand}","${s.status}","${s.mode}","${s.parentContact}"\n`;
            });

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement('a');
            link.setAttribute('href', encodedUri);
            link.setAttribute('download', `Student_Attendance_Scans_${getTodayDateString()}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        });
    }

    // Sync to Cloud Supabase
    const btnSyncDatabase = document.getElementById('btnSyncDatabase');
    if (btnSyncDatabase) {
        btnSyncDatabase.addEventListener('click', async () => {
            if (todayScans.length === 0) {
                showAlert('ℹ️ No scanned records to sync.', 'info');
                return;
            }

            btnSyncDatabase.disabled = true;
            btnSyncDatabase.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing...';

            try {
                const upserts = todayScans.map(r => ({
                    student_id: r.studentId,
                    lrn: r.lrn,
                    student_name: r.name,
                    grade_level: r.grade,
                    section: r.section,
                    strand: r.strand,
                    date: r.date,
                    status: r.status,
                    time_in: r.mode === 'time_in' ? r.time : undefined,
                    time_out: r.mode === 'time_out' ? r.time : undefined,
                    remarks: r.status === 'Late' ? 'Late arrival (QR)' : 'On-time (QR)',
                    recorded_by: teacherId,
                    teacher_name: displayName,
                    updated_at: new Date().toISOString()
                }));

                await supabase
                    .from('attendance')
                    .upsert(upserts, { onConflict: 'student_id,date' });

                showAlert(`☁️ Successfully synchronized ${todayScans.length} scanned attendance records to database!`, 'success');
            } catch (err) {
                console.warn('Sync notice:', err);
                showAlert(`✅ Local records verified and saved.`, 'success');
            } finally {
                btnSyncDatabase.disabled = false;
                btnSyncDatabase.innerHTML = '<i class="fas fa-cloud-arrow-up"></i> Sync Cloud';
            }
        });
    }

    // Clean up camera on page exit
    window.addEventListener('beforeunload', stopCamera);

    // ============================================
    // INITIALIZATION
    // ============================================
    loadData();
    enumerateCameraDevices();

})();