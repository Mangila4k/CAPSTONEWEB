

(function () {
    'use strict';
    if (window.HESChatbotInitialized) return;
    window.HESChatbotInitialized = true;
    function detectActor() {
        if (window.HES_CHATBOT_ROLE) return window.HES_CHATBOT_ROLE;
        if (document.body && document.body.dataset && document.body.dataset.role) {
            return document.body.dataset.role.toLowerCase();
        }

        const path = window.location.pathname.toLowerCase();
        if (path.includes('/admin/')) return 'admin';
        if (path.includes('/registrar/')) return 'registrar';
        if (path.includes('/teacher/')) return 'teacher';
        if (path.includes('/parents/')) return 'parent';
        if (path.includes('/student/')) return 'student';
        if (path.includes('/auth/') || path.endsWith('homepage.html') || path.endsWith('index.html') || path === '/' || path === '') return 'guest';

        const storedRole = localStorage.getItem('user_role') || localStorage.getItem('role');
        if (storedRole) {
            const r = storedRole.toLowerCase();
            if (['admin', 'registrar', 'teacher', 'parent', 'student', 'guest'].includes(r)) return r;
        }

        return 'guest';
    }

    const currentActor = detectActor();

    // ==========================================================================
    // 2. ACTOR PERSONAS & QUICK PROMPTS CONFIG
    // ==========================================================================
    const ACTOR_CONFIGS = {
        guest: {
            name: "Hiraya Admission Guide",
            roleBadge: "Public & Admission Guide",
            avatarIcon: "fa-graduation-cap",
            welcomeHeadline: "Welcome to Hiraya Enrollment System!",
            welcomeDesc: "I can assess your eligibility, guide your enrollment, recommend Senior High strands, and generate your custom requirements checklist.",
            storageKey: "hes_chat_history_guest",
            quickChips: [
                { label: "🎯 Assess Requirements", query: "Assess my enrollment requirements" },
                { label: "How to Enroll?", query: "How do I enroll in Hiraya?" },
                { label: "💡 Strand Advisor", query: "Help me assess which strand fits me best" },
                { label: "Requirements", query: "What are the enrollment requirements?" },
                { label: "School Location", query: "Where is the school located?" },
                { label: "How to Login?", query: "How do I login to my account?" }
            ]
        },
        student: {
            name: "Student Copilot",
            roleBadge: "Student Assistant",
            avatarIcon: "fa-user-graduate",
            welcomeHeadline: "Hello Student!",
            welcomeDesc: "I am your Student Assistant. I can assess your requirements status, check grades, attendance rates, class schedules, or guide profile updates.",
            storageKey: "hes_chat_history_student",
            quickChips: [
                { label: "📋 Requirements Status", query: "How to view requirement status?" },
                { label: "Check Grades", query: "How do I view my grades?" },
                { label: "Attendance Record", query: "How to check my attendance?" },
                { label: "Class Schedule", query: "Where is my class schedule?" },
                { label: "Update Profile", query: "How to update my profile information?" }
            ]
        },
        teacher: {
            name: "Faculty Copilot",
            roleBadge: "Faculty Assistant",
            avatarIcon: "fa-chalkboard-user",
            welcomeHeadline: "Greetings Teacher!",
            welcomeDesc: "I am your Faculty Assistant. I can help you with QR attendance scanning, encoding quarterly grades, managing classes, and schedules.",
            storageKey: "hes_chat_history_teacher",
            quickChips: [
                { label: "QR Attendance", query: "How do I use QR attendance?" },
                { label: "Encode Grades", query: "How do I enter student grades?" },
                { label: "My Classes", query: "How to view my classes and sections?" },
                { label: "Teaching Schedule", query: "Where is my teaching schedule?" },
                { label: "Student List", query: "How to view students in my advisory section?" }
            ]
        },
        parent: {
            name: "Parent Portal Guide",
            roleBadge: "Parent Portal Assistant",
            avatarIcon: "fa-user-friends",
            welcomeHeadline: "Welcome Parent / Guardian!",
            welcomeDesc: "I can assist you in assessing your child's academic performance, monitoring daily attendance records, and school announcements.",
            storageKey: "hes_chat_history_parent",
            quickChips: [
                { label: "Child's Grades", query: "How do I view my child's grades?" },
                { label: "Child's Attendance", query: "How do I check my child's attendance?" },
                { label: "Contact School", query: "How can I contact the school or teachers?" },
                { label: "Update Profile", query: "How to edit parent contact details?" }
            ]
        },
        registrar: {
            name: "Registrar Operations Copilot",
            roleBadge: "Registrar Assistant",
            avatarIcon: "fa-user-tie",
            welcomeHeadline: "Registrar Operations Center",
            welcomeDesc: "I can help guide you through verifying student enrollments, assessing submitted requirements, creating sections, and exporting reports.",
            storageKey: "hes_chat_history_registrar",
            quickChips: [
                { label: "Pending Enrollments", query: "How do I approve or verify enrollments?" },
                { label: "Sectioning", query: "How to create and manage sections?" },
                { label: "Master Student List", query: "How to search students in master list?" },
                { label: "Generate Reports", query: "How to export enrollment reports?" },
                { label: "Email Verification", query: "How to verify student email?" }
            ]
        },
        admin: {
            name: "Admin System Copilot",
            roleBadge: "System Administrator Assistant",
            avatarIcon: "fa-shield-alt",
            welcomeHeadline: "Administrator Command Center",
            welcomeDesc: "I assist in managing user accounts, teachers, subjects, master schedules, sections, and overall school system analytics.",
            storageKey: "hes_chat_history_admin",
            quickChips: [
                { label: "Manage Accounts", query: "How to add or edit user accounts?" },
                { label: "Manage Teachers", query: "How do I assign teachers to subjects?" },
                { label: "Manage Subjects", query: "How to add new subjects?" },
                { label: "Master Schedule", query: "How to create class schedules?" },
                { label: "School Analytics", query: "Where to view school enrollment statistics?" }
            ]
        }
    };

    const config = ACTOR_CONFIGS[currentActor] || ACTOR_CONFIGS.guest;

    // ==========================================================================
    // 3. AUTO-LOAD DEPENDENCIES (CSS & FontAwesome)
    // ==========================================================================
    function ensureStyles() {
        if (!document.querySelector('link[href*="chatbot.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';

            let relPrefix = './';
            if (window.location.pathname.includes('/student/') ||
                window.location.pathname.includes('/teacher/') ||
                window.location.pathname.includes('/parents/') ||
                window.location.pathname.includes('/registrar/') ||
                window.location.pathname.includes('/admin/') ||
                window.location.pathname.includes('/auth/')) {
                relPrefix = '../';
            }
            link.href = relPrefix + 'css/chatbot.css';
            document.head.appendChild(link);
        }

        if (!document.querySelector('link[href*="font-awesome"]') && !document.querySelector('link[href*="fontawesome"]')) {
            const fa = document.createElement('link');
            fa.rel = 'stylesheet';
            fa.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css';
            document.head.appendChild(fa);
        }
    }

    ensureStyles();

    // ==========================================================================
    // 4. SYNTHESIZED SOUND EFFECTS & TEXT-TO-SPEECH
    // ==========================================================================
    let soundEnabled = localStorage.getItem('hes_cb_sound') !== 'false';
    let ttsEnabled = localStorage.getItem('hes_cb_tts') === 'true';

    function playAudio(type) {
        if (!soundEnabled) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();

            if (type === 'sent') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(440, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);
                gain.gain.setValueAtTime(0.06, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.08);
            } else if (type === 'received') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(587.33, ctx.currentTime);
                osc.frequency.setValueAtTime(880, ctx.currentTime + 0.07);
                gain.gain.setValueAtTime(0.08, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.16);
            }
        } catch (e) {
            // Silently ignored
        }
    }

    function speakText(text) {
        if (!ttsEnabled || !window.speechSynthesis) return;
        try {
            window.speechSynthesis.cancel();
            const cleanText = text.replace(/<[^>]*>?/gm, '').replace(/[*_#`[\]()]/g, '');
            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.rate = 1.05;
            utterance.pitch = 1.0;
            window.speechSynthesis.speak(utterance);
        } catch (e) {
            console.warn('TTS error:', e);
        }
    }

    // ==========================================================================
    // 5. INTERACTIVE ASSESSMENT & MULTI-ACTOR KNOWLEDGE BASE
    // ==========================================================================

    function getContextualKnowledge(userMsg) {
        const query = userMsg.toLowerCase().trim();
        const role = currentActor;

        const inSubfolder = window.location.pathname.includes('/student/') ||
            window.location.pathname.includes('/teacher/') ||
            window.location.pathname.includes('/parents/') ||
            window.location.pathname.includes('/registrar/') ||
            window.location.pathname.includes('/admin/') ||
            window.location.pathname.includes('/auth/');
        const rootPrefix = inSubfolder ? '../' : './';
        const rolePrefix = inSubfolder ? '' : (role === 'guest' ? 'auth/' : `${role}/`);

        // -------------------------------------------------------------
        // 0. ENROLLMENT & REQUIREMENTS ASSESSMENT ENGINE (Interactive Wizard)
        // -------------------------------------------------------------

        // A. General Assessment / How to Enroll / Requirements Entry Point
        if (query.match(/\b(assess|assessment|assess me|how to enroll|how do i enroll|how can i enroll|how to register|what need the requirements|what are the requirements|requirements needed|what do i need to enroll|check my requirements|evaluate|eligibility|evaluate me|checklist|how to apply|enrollment process|admission process)\b/) &&
            !query.includes('grade 7') && !query.includes('grade 11') && !query.includes('transferee') && !query.includes('transfer') && !query.includes('returning') && !query.includes('balik-aral') && !query.includes('about stem') && !query.includes('about abm') && !query.includes('about humss') && !query.includes('about tvl') && !query.includes('strand advisor') && !query.includes('fits me best')) {
            return `🎯 **Interactive Enrollment & Requirements Assessment**\n\n` +
                `Welcome! I can instantly assess your eligibility, provide your personalized requirements checklist, and guide your enrollment step-by-step.\n\n` +
                `Please select your **Student Category** to begin the assessment:` +
                `<div class="hes-cb-choice-group">` +
                `  <button type="button" class="hes-cb-choice-btn" data-query="Assess for Incoming Grade 7 (Junior High)">` +
                `    <span>🎒 <strong>Incoming Grade 7</strong> (Elementary Graduate)</span> <i class="fas fa-chevron-right"></i>` +
                `  </button>` +
                `  <button type="button" class="hes-cb-choice-btn" data-query="Assess for Incoming Grade 11 (Senior High)">` +
                `    <span>🎓 <strong>Incoming Grade 11</strong> (JHS Completer / SHS)</span> <i class="fas fa-chevron-right"></i>` +
                `  </button>` +
                `  <button type="button" class="hes-cb-choice-btn" data-query="Assess for Transferee Student">` +
                `    <span>🔄 <strong>Transferee</strong> (From another School)</span> <i class="fas fa-chevron-right"></i>` +
                `  </button>` +
                `  <button type="button" class="hes-cb-choice-btn" data-query="Assess for Returning Student (Balik-Aral)">` +
                `    <span>🔁 <strong>Returning Student</strong> (Balik-Aral)</span> <i class="fas fa-chevron-right"></i>` +
                `  </button>` +
                `  <button type="button" class="hes-cb-choice-btn" data-query="Help me assess which strand fits me best">` +
                `    <span>💡 <strong>Strand Advisor Quiz</strong> (STEM / ABM / HUMSS / TVL)</span> <i class="fas fa-chevron-right"></i>` +
                `  </button>` +
                `</div>\n` +
                `📝 **Quick 4-Step Online Enrollment Flow:**\n` +
                `1️⃣ **Prepare Documents** (PSA Birth Cert, SF9/SF10 Report Card, Good Moral)\n` +
                `2️⃣ **Fill Online Form** (Select Grade/Strand & enter Learner Info)\n` +
                `3️⃣ **Upload Requirements** (Clear photos or PDF copies)\n` +
                `4️⃣ **Registrar Approval** (Section assignment & official enrollment!)\n\n` +
                `<a href="${rootPrefix}student/enrollment.html" class="hes-cb-action-btn"><i class="fas fa-pen-fancy"></i> Open Online Enrollment Form</a>`;
        }

        // B. Assessment: Incoming Grade 7 / Junior High
        if (query.includes('grade 7') || query.includes('junior high') || query.includes('elementary graduate') || query.includes('grade 7 requirements')) {
            return `🎯 **Assessment Result: Incoming Grade 7 (Junior High School)**\n\n` +
                `<div class="hes-cb-assessment-card">` +
                `  <h5><i class="fas fa-user-check" style="color:#10b981;"></i> Eligibility Status: <strong>100% ELIGIBLE</strong></h5>` +
                `  <p>Eligible for admission in <strong>HES, Hiraya Enrollment System</strong> with <strong>FREE DepEd Public School Education (No Tuition Fee)</strong>.</p>` +
                `</div>\n` +
                `📋 **Your Mandatory Requirements Checklist:**\n` +
                `<div class="hes-cb-check-item"><i class="fas fa-check-circle"></i> <strong>SF9 / Form 138:</strong> Original Grade 6 Report Card with Learner Reference Number (LRN).</div>` +
                `<div class="hes-cb-check-item"><i class="fas fa-check-circle"></i> <strong>PSA Birth Certificate:</strong> Original copy + 1 clear photocopy.</div>` +
                `<div class="hes-cb-check-item"><i class="fas fa-check-circle"></i> <strong>Certificate of Good Moral Character:</strong> Issued by Elementary School Principal.</div>\n\n` +
                `📝 **Step-by-Step Enrollment Guide for Grade 7:**\n` +
                `1. Take clear photos or PDF scans of your documents above.\n` +
                `2. Click **Start Grade 7 Enrollment** below.\n` +
                `3. Select **New Student / Grade 7** and enter your 12-digit LRN.\n` +
                `4. Fill in Student & Parent/Guardian contact information.\n` +
                `5. Upload your Form 138 and PSA Birth Certificate, then submit.\n` +
                `6. The Registrar will verify and assign your JHS advisory section!\n\n` +
                `<div class="hes-cb-choice-group">` +
                `  <button type="button" class="hes-cb-choice-btn" data-query="Assess my enrollment requirements">` +
                `    <span>🔄 <strong>Assess Another Category</strong></span> <i class="fas fa-arrow-left"></i>` +
                `  </button>` +
                `</div>\n` +
                `<a href="${rootPrefix}student/enrollment.html" class="hes-cb-action-btn"><i class="fas fa-pen-fancy"></i> Start Grade 7 Enrollment Now</a>`;
        }

        // C. Assessment: Incoming Grade 11 / Senior High
        if (query.includes('grade 11') || query.includes('senior high') || query.includes('jhs completer') || query.includes('shs') || query.includes('grade 11 requirements')) {
            return `🎯 **Assessment Result: Incoming Grade 11 (Senior High School)**\n\n` +
                `<div class="hes-cb-assessment-card">` +
                `  <h5><i class="fas fa-graduation-cap" style="color:#2563eb;"></i> Eligibility Status: <strong>ELIGIBLE FOR SENIOR HIGH</strong></h5>` +
                `  <p>Eligible for DepEd Senior High School Voucher & Free Public Education. You may choose between <strong>Academic</strong> and <strong>TVL Tracks</strong>.</p>` +
                `</div>\n` +
                `📋 **Your Mandatory Requirements Checklist:**\n` +
                `<div class="hes-cb-check-item"><i class="fas fa-check-circle"></i> <strong>SF10 / Form 137:</strong> Junior High School Permanent Record / Transcript.</div>` +
                `<div class="hes-cb-check-item"><i class="fas fa-check-circle"></i> <strong>SF9 / Form 138:</strong> Grade 10 Report Card with 12-digit LRN.</div>` +
                `<div class="hes-cb-check-item"><i class="fas fa-check-circle"></i> <strong>Certificate of JHS Completion:</strong> Signed by previous School Principal.</div>` +
                `<div class="hes-cb-check-item"><i class="fas fa-check-circle"></i> <strong>PSA Birth Certificate & Certificate of Good Moral Character</strong>.</div>` +
                `<div class="hes-cb-check-item"><i class="fas fa-check-circle"></i> <strong>NCAE Result / Strand Assessment:</strong> (Optional / Recommended).</div>\n\n` +
                `🎓 **Available Strands at HES (Hiraya Enrollment System):**\n` +
                `• <span class="hes-cb-badge-highlight">STEM</span> Science, Technology, Engineering & Mathematics\n` +
                `• <span class="hes-cb-badge-highlight">ABM</span> Accountancy, Business & Management\n` +
                `• <span class="hes-cb-badge-highlight">HUMSS</span> Humanities and Social Sciences\n` +
                `• <span class="hes-cb-badge-highlight">TVL</span> ICT (Programming) & Home Economics (Cookery/Hospitality)\n\n` +
                `<div class="hes-cb-choice-group">` +
                `  <button type="button" class="hes-cb-choice-btn" data-query="Help me assess which strand fits me best">` +
                `    <span>💡 <strong>Take the Strand Recommendation Quiz</strong></span> <i class="fas fa-chevron-right"></i>` +
                `  </button>` +
                `  <button type="button" class="hes-cb-choice-btn" data-query="Assess my enrollment requirements">` +
                `    <span>🔄 <strong>Assess Another Category</strong></span> <i class="fas fa-arrow-left"></i>` +
                `  </button>` +
                `</div>\n` +
                `<a href="${rootPrefix}student/enrollment.html" class="hes-cb-action-btn"><i class="fas fa-pen-fancy"></i> Enroll in Senior High Now</a>`;
        }

        // D. Assessment: Transferee Student
        if (query.includes('transferee') || query.includes('transfer') || query.includes('moving school') || query.includes('transferee requirements')) {
            return `🎯 **Assessment Result: Transferee Student (From Another School)**\n\n` +
                `<div class="hes-cb-assessment-card">` +
                `  <h5><i class="fas fa-exchange-alt" style="color:#f59e0b;"></i> Transfer Assessment: <strong>ELIGIBLE FOR ADMISSION</strong></h5>` +
                `  <p>Transferees from recognized DepEd private or public schools are welcome. Subject credits will be officially credited and verified by our Registrar.</p>` +
                `</div>\n` +
                `📋 **Your Mandatory Requirements Checklist:**\n` +
                `<div class="hes-cb-check-item"><i class="fas fa-check-circle"></i> <strong>Certificate of Transfer / Honorable Dismissal:</strong> Issued by previous school.</div>` +
                `<div class="hes-cb-check-item"><i class="fas fa-check-circle"></i> <strong>Official Form 137 (SF10):</strong> Complete scholastic transcript records.</div>` +
                `<div class="hes-cb-check-item"><i class="fas fa-check-circle"></i> <strong>Latest Report Card (SF9):</strong> Showing passing quarterly grades.</div>` +
                `<div class="hes-cb-check-item"><i class="fas fa-check-circle"></i> <strong>PSA Birth Certificate & Certificate of Good Moral Character</strong>.</div>\n\n` +
                `📝 **How to Enroll as a Transferee:**\n` +
                `1. Secure clearance and transfer credentials from your previous school.\n` +
                `2. Click **Start Transferee Enrollment** below.\n` +
                `3. Select <span class="hes-cb-badge-highlight">Transferee</span> as Student Type.\n` +
                `4. Provide your previous school name, address, and upload transfer credentials.\n\n` +
                `<div class="hes-cb-choice-group">` +
                `  <button type="button" class="hes-cb-choice-btn" data-query="Assess my enrollment requirements">` +
                `    <span>🔄 <strong>Assess Another Category</strong></span> <i class="fas fa-arrow-left"></i>` +
                `  </button>` +
                `</div>\n` +
                `<a href="${rootPrefix}student/enrollment.html" class="hes-cb-action-btn"><i class="fas fa-pen-fancy"></i> Start Transferee Enrollment</a>`;
        }

        // E. Assessment: Returning Student / Balik-Aral
        if (query.includes('returning') || query.includes('balik-aral') || query.includes('stopped') || query.includes('resume studies')) {
            return `🎯 **Assessment Result: Returning Student (Balik-Aral)**\n\n` +
                `<div class="hes-cb-assessment-card">` +
                `  <h5><i class="fas fa-redo-alt" style="color:#10b981;"></i> Balik-Aral Assessment: <strong>WELCOME BACK TO SCHOOL</strong></h5>` +
                `  <p>Students resuming basic education are fully supported under DepEd's inclusive education initiative. We will assess your last grade level completed.</p>` +
                `</div>\n` +
                `📋 **Your Requirements Checklist:**\n` +
                `<div class="hes-cb-check-item"><i class="fas fa-check-circle"></i> <strong>Last School Record / SF9:</strong> Showing the last grade level attended.</div>` +
                `<div class="hes-cb-check-item"><i class="fas fa-check-circle"></i> <strong>Learner Reference Number (LRN):</strong> (12-digit number).</div>` +
                `<div class="hes-cb-check-item"><i class="fas fa-check-circle"></i> <strong>PSA Birth Certificate</strong> (Original + Photocopy).</div>` +
                `<div class="hes-cb-check-item"><i class="fas fa-check-circle"></i> <strong>Letter of Intent:</strong> Simple letter stating your intention to resume studies.</div>\n\n` +
                `<div class="hes-cb-choice-group">` +
                `  <button type="button" class="hes-cb-choice-btn" data-query="Assess my enrollment requirements">` +
                `    <span>🔄 <strong>Assess Another Category</strong></span> <i class="fas fa-arrow-left"></i>` +
                `  </button>` +
                `</div>\n` +
                `<a href="${rootPrefix}student/enrollment.html" class="hes-cb-action-btn"><i class="fas fa-pen-fancy"></i> Continue Balik-Aral Enrollment</a>`;
        }

        // F. Assessment: Strand Advisor / Recommendation Quiz
        if (query.includes('strand advisor') || query.includes('fits me best') || query.includes('which strand') || query.includes('choose strand') || query.includes('recommend strand') || query.includes('strand quiz')) {
            return `💡 **Senior High Strand Advisor & Career Assessment**\n\n` +
                `Discover which Senior High School strand aligns best with your passions and college ambitions:\n\n` +
                `Select your primary interest below:` +
                `<div class="hes-cb-choice-group">` +
                `  <button type="button" class="hes-cb-choice-btn" data-query="Tell me more about STEM Strand">` +
                `    <span>🔬 <strong>STEM:</strong> Math, Science, Medicine, Engineering, IT</span> <i class="fas fa-chevron-right"></i>` +
                `  </button>` +
                `  <button type="button" class="hes-cb-choice-btn" data-query="Tell me more about ABM Strand">` +
                `    <span>💼 <strong>ABM:</strong> Business, Accountancy, Marketing, Finance</span> <i class="fas fa-chevron-right"></i>` +
                `  </button>` +
                `  <button type="button" class="hes-cb-choice-btn" data-query="Tell me more about HUMSS Strand">` +
                `    <span>📖 <strong>HUMSS:</strong> Law, Psychology, Journalism, Teaching, Politics</span> <i class="fas fa-chevron-right"></i>` +
                `  </button>` +
                `  <button type="button" class="hes-cb-choice-btn" data-query="Tell me more about TVL Strand">` +
                `    <span>🛠️ <strong>TVL:</strong> Computer Programming & Culinary / Hospitality</span> <i class="fas fa-chevron-right"></i>` +
                `  </button>` +
                `</div>`;
        }

        // G. Detailed Strand Assessments
        if (query.includes('about stem') || query.includes('stem strand')) {
            return `🔬 **Strand Assessment: Science, Technology, Engineering & Mathematics (STEM)**\n\n` +
                `<div class="hes-cb-assessment-card">` +
                `  <h5>🎯 Recommended For:</h5>` +
                `  <p>Students who excel in Mathematics, Physics, Chemistry, Biology, Robotics, and Software Development.</p>` +
                `</div>\n` +
                `🎓 **Top College Degree Pathways:**\n` +
                `• BS Computer Science / Information Technology / Software Engineering\n` +
                `• BS Civil, Mechanical, Electrical, Chemical Engineering\n` +
                `• BS Nursing, Pharmacy, Medical Technology, Medicine\n` +
                `• BS Architecture & Applied Sciences\n\n` +
                `📋 **Requirements:** SF9/SF10 showing strong performance in Math & Science (85%+ grade recommended).\n\n` +
                `<div class="hes-cb-choice-group">` +
                `  <button type="button" class="hes-cb-choice-btn" data-query="Help me assess which strand fits me best">` +
                `    <span>💡 <strong>Compare Other Strands</strong></span> <i class="fas fa-arrow-left"></i>` +
                `  </button>` +
                `</div>\n` +
                `<a href="${rootPrefix}student/enrollment.html" class="hes-cb-action-btn"><i class="fas fa-pen-fancy"></i> Enroll in STEM Strand</a>`;
        }

        if (query.includes('about abm') || query.includes('abm strand')) {
            return `💼 **Strand Assessment: Accountancy, Business & Management (ABM)**\n\n` +
                `<div class="hes-cb-assessment-card">` +
                `  <h5>🎯 Recommended For:</h5>` +
                `  <p>Students interested in corporate leadership, financial analytics, banking, entrepreneurship, marketing, and economics.</p>` +
                `</div>\n` +
                `🎓 **Top College Degree Pathways:**\n` +
                `• BS Accountancy (CPA) / Management Accounting / Internal Auditing\n` +
                `• BS Business Administration (Marketing / Financial Management / HR)\n` +
                `• BS Entrepreneurship & Real Estate Management\n` +
                `• BS Hospitality & Tourism Management\n\n` +
                `<div class="hes-cb-choice-group">` +
                `  <button type="button" class="hes-cb-choice-btn" data-query="Help me assess which strand fits me best">` +
                `    <span>💡 <strong>Compare Other Strands</strong></span> <i class="fas fa-arrow-left"></i>` +
                `  </button>` +
                `</div>\n` +
                `<a href="${rootPrefix}student/enrollment.html" class="hes-cb-action-btn"><i class="fas fa-pen-fancy"></i> Enroll in ABM Strand</a>`;
        }

        if (query.includes('about humss') || query.includes('humss strand')) {
            return `📖 **Strand Assessment: Humanities & Social Sciences (HUMSS)**\n\n` +
                `<div class="hes-cb-assessment-card">` +
                `  <h5>🎯 Recommended For:</h5>` +
                `  <p>Students passionate about social dynamics, law, public policy, creative writing, journalism, psychology, philosophy, and public service.</p>` +
                `</div>\n` +
                `🎓 **Top College Degree Pathways:**\n` +
                `• BA Political Science & Pre-Law Juris Doctor\n` +
                `• BS / BA Psychology & Guidance Counseling\n` +
                `• Bachelor of Secondary / Elementary Education\n` +
                `• BA Mass Communication, Journalism & Broadcasting\n` +
                `• BS Criminology & Public Administration\n\n` +
                `<div class="hes-cb-choice-group">` +
                `  <button type="button" class="hes-cb-choice-btn" data-query="Help me assess which strand fits me best">` +
                `    <span>💡 <strong>Compare Other Strands</strong></span> <i class="fas fa-arrow-left"></i>` +
                `  </button>` +
                `</div>\n` +
                `<a href="${rootPrefix}student/enrollment.html" class="hes-cb-action-btn"><i class="fas fa-pen-fancy"></i> Enroll in HUMSS Strand</a>`;
        }

        if (query.includes('about tvl') || query.includes('tvl strand') || query.includes('ict')) {
            return `🛠️ **Strand Assessment: Technical-Vocational-Livelihood (TVL)**\n\n` +
                `<div class="hes-cb-assessment-card">` +
                `  <h5>🎯 Recommended For:</h5>` +
                `  <p>Students who prefer hands-on technical training, national certifications (TESDA NC II / NC III), and rapid workforce readiness.</p>` +
                `</div>\n` +
                `🔧 **Specializations Offered at HES (Hiraya Enrollment System):**\n` +
                `• **TVL-ICT:** Web Development, Computer Systems Servicing, Programming.\n` +
                `• **TVL-HE:** Cookery, Bread & Pastry Production, Food & Beverage Services.\n\n` +
                `<div class="hes-cb-choice-group">` +
                `  <button type="button" class="hes-cb-choice-btn" data-query="Help me assess which strand fits me best">` +
                `    <span>💡 <strong>Compare Other Strands</strong></span> <i class="fas fa-arrow-left"></i>` +
                `  </button>` +
                `</div>\n` +
                `<a href="${rootPrefix}student/enrollment.html" class="hes-cb-action-btn"><i class="fas fa-pen-fancy"></i> Enroll in TVL Strand</a>`;
        }

        // Check if asking about logged in user / who am I
        if (query.match(/\b(who am i|my name|my profile|my account|logged in as)\b/)) {
            let sessionName = document.getElementById('studentName')?.textContent ||
                document.getElementById('teacherName')?.textContent ||
                document.getElementById('adminName')?.textContent ||
                document.getElementById('sidebarParentName')?.textContent ||
                localStorage.getItem('userName') || 'User';
            return `You are currently logged in as **${sessionName}** (${config.roleBadge}).\n\nYou can manage your account settings in your profile page:\n<a href="${rolePrefix}profile.html" class="hes-cb-action-btn"><i class="fas fa-user-circle"></i> Open My Profile</a>`;
        }

        // -------------------------------------------------------------
        // G. COMPREHENSIVE SCHOOL KNOWLEDGE BASE & FAQS (Answering Any Other Questions)
        // -------------------------------------------------------------

        // 1. Directory of Other Questions / FAQs / Help
        if (query.match(/\b(other question|other questions|any other question|any other questions|what else can i ask|what else|more questions|another question|ask another|browse questions|faq|faqs|topics|help directory)\b/)) {
            return `📚 **Hiraya Knowledge & FAQ Directory**\n\n` +
                `I can answer questions regarding any aspect of **HES, Hiraya Enrollment System**. Please choose a category below or ask directly:\n\n` +
                `<div class="hes-cb-choice-group">` +
                `  <button type="button" class="hes-cb-choice-btn" data-query="How does the grading system and honors work?">` +
                `    <span>📊 <strong>Grading & Honors Criteria</strong> (DepEd Order 8 / GWA)</span> <i class="fas fa-chevron-right"></i>` +
                `  </button>` +
                `  <button type="button" class="hes-cb-choice-btn" data-query="What is the uniform policy and dress code?">` +
                `    <span>👔 <strong>Uniforms & Dress Code</strong> (P.E. & Wash Day Rules)</span> <i class="fas fa-chevron-right"></i>` +
                `  </button>` +
                `  <button type="button" class="hes-cb-choice-btn" data-query="What are the school hours and gate schedule?">` +
                `    <span>⏰ <strong>School Hours & Gate Schedule</strong> (Weekdays / Weekends)</span> <i class="fas fa-chevron-right"></i>` +
                `  </button>` +
                `  <button type="button" class="hes-cb-choice-btn" data-query="What if I lost my Form 137 or School ID?">` +
                `    <span>📄 <strong>Lost Documents & ID Replacement</strong> (Affidavit / Form 138)</span> <i class="fas fa-chevron-right"></i>` +
                `  </button>` +
                `  <button type="button" class="hes-cb-choice-btn" data-query="Tell me about Senior High Vouchers and Work Immersion">` +
                `    <span>🎓 <strong>SHS Vouchers & Work Immersion</strong> (OJT / TESDA NC II)</span> <i class="fas fa-chevron-right"></i>` +
                `  </button>` +
                `  <button type="button" class="hes-cb-choice-btn" data-query="What student services and facilities are available?">` +
                `    <span>🏥 <strong>Guidance, Clinic, Library & Clubs</strong> (SSLGO / Sports)</span> <i class="fas fa-chevron-right"></i>` +
                `  </button>` +
                `</div>\n` +
                `💬 *You can also type any specific question in the box below!*`;
        }

        // 2. Grading System, Computations & Honors (DepEd K-12)
        if (query.match(/\b(grading system|grading|gwa|passing grade|passing mark|honors|honor roll|with honors|highest honors|high honors|grades computed|deped order 8|failed grade|remedial|summer class|summer classes)\b/)) {
            return `📊 **DepEd Grading System & Academic Honors Policy**\n\n` +
                `<div class="hes-cb-assessment-card">` +
                `  <h5><i class="fas fa-chart-line" style="color:#2563eb;"></i> Standard DepEd K-12 Grading Rubrics:</h5>` +
                `  <p>Under <strong>DepEd Order No. 8, s. 2015</strong>, quarterly grades are computed from:</p>` +
                `  • <strong>Written Works (WW):</strong> 30% - 40% (Quizzes, unit tests, essays)<br>` +
                `  • <strong>Performance Tasks (PT):</strong> 40% - 60% (Projects, lab work, recitations)<br>` +
                `  • <strong>Quarterly Assessment (QA):</strong> 20% (Periodical exams)` +
                `</div>\n` +
                `🎯 **Key Academic Rules:**\n` +
                `• **Passing Grade:** Minimum final grade of **75** in every subject.\n` +
                `• **Academic Honors Criteria (End of School Year):**\n` +
                `  - 🥇 **With Highest Honors:** General Average of **98.00 – 100.00** (no grade below 85 in any quarter)\n` +
                `  - 🥈 **With High Honors:** General Average of **95.00 – 97.99** (no grade below 85 in any quarter)\n` +
                `  - 🥉 **With Honors:** General Average of **90.00 – 94.99** (no grade below 85 in any quarter)\n` +
                `• **Remedial Classes:** Students with a final grade below 75 in 1 or 2 subjects must take remedial/summer classes to obtain passing credit before moving up.`;
        }

        // 3. Uniform Policy, Dress Code & Grooming
        if (query.match(/\b(uniform|uniforms|dress code|what to wear|pe uniform|p.e.|wash day|haircut|attire|clothes)\b/)) {
            return `👔 **School Uniform & Dress Code Guidelines:**\n\n` +
                `Students are expected to adhere to the official school uniform policy:\n\n` +
                `👦 **Male Students (Type A Daily Uniform):**\n` +
                `• Plain white polo shirt with official HES school chest patch/seal\n` +
                `• Dark navy blue slacks (formal trousers)\n` +
                `• Black leather or closed formal school shoes with black/white socks\n\n` +
                `👧 **Female Students (Type A Daily Uniform):**\n` +
                `• White blouse with school collar necktie and official chest patch\n` +
                `• Pleated navy blue skirt (hemline below the knee)\n` +
                `• Black closed school shoes with white socks\n\n` +
                `🏃 **P.E. & Wash Day Policy:**\n` +
                `• **P.E. Days:** Official HES Physical Education t-shirt and jogging pants.\n` +
                `• **Wash Days (Designated Fridays):** Modest and decent casual wear (strictly no sleeveless shirts, crop tops, short shorts, or ripped jeans).`;
        }

        // 4. School Hours, Gate Opening/Closing & Weekend Rules
        if (query.match(/\b(school hours|time|schedule of classes|gate|gate hours|open|close|closing|weekend|saturday|sunday|office hours|what time)\b/)) {
            return `⏰ **School Schedule, Gate Hours & Operating Days:**\n\n` +
                `📍 **HES, Hiraya Enrollment System** operates on the following schedule:\n\n` +
                `• **Class Hours (Monday to Friday):** 7:00 AM – 5:00 PM\n` +
                `• **Main Gate Schedule:**\n` +
                `  - Gate Opens for Entry: **6:30 AM**\n` +
                `  - Gate Closes for Day: **5:30 PM**\n` +
                `• **Administrative & Registrar Offices:** 8:00 AM – 5:00 PM (Monday to Friday)\n` +
                `• 🚫 **Weekend Policy:** Campus, faculty, and registrar offices are **CLOSED on Saturdays and Sundays**. Online applications submitted over the weekend are processed on the next business day (Monday).`;
        }

        // 5. Lost Documents, Form 137/138 & ID Replacement
        if (query.match(/\b(lost id|lost form 137|lost form 138|lost report card|lost document|replace id|replacement|affidavit of loss|request form 137|diploma|good moral certificate|request good moral)\b/)) {
            return `📄 **Lost Documents & Credential Replacement Procedures:**\n\n` +
                `📋 **1. How to Replace a Lost Student ID & QR Code:**\n` +
                `• Visit the **Guidance Office** or **Registrar** to secure an ID Replacement Slip.\n` +
                `• Proceed to the Registrar for student badge photo verification and reprinting.\n` +
                `• The system will automatically generate and print your new QR student badge.\n\n` +
                `📋 **2. Lost Form 137 (SF10) or Form 138 (SF9):**\n` +
                `• Provide an **Affidavit of Loss** executed by parent/guardian.\n` +
                `• The Registrar's Office will issue a **Certified True Copy (CTC)** of your scholastic records.\n\n` +
                `📋 **3. Requesting Certificate of Good Moral Character / Diploma:**\n` +
                `• File a document request at the Registrar's counter or through student services.\n` +
                `• Processing time is typically 1 to 3 school days.`;
        }

        // 6. Senior High Vouchers, Work Immersion & TESDA NC II
        if (query.match(/\b(voucher|vouchers|shs voucher|esc|work immersion|immersion|ojt|practicum|tesda|nc ii|nc 2|national certificate|certification)\b/)) {
            return `🎓 **Senior High Voucher Program, Work Immersion & TESDA:**\n\n` +
                `<div class="hes-cb-assessment-card">` +
                `  <h5><i class="fas fa-hand-holding-dollar" style="color:#10b981;"></i> DepEd Senior High Voucher Program:</h5>` +
                `  <p>All graduates from public Junior High Schools automatically receive a <strong>100% DepEd SHS Voucher</strong>. Private school ESC grantees receive 80% coverage. <strong>No top-up fees at HES, Hiraya Enrollment System</strong>.</p>` +
                `</div>\n` +
                `🛠️ **Senior High Work Immersion (Grade 12):**\n` +
                `• Grade 12 students undergo **80 hours** of industry hands-on internship in partner enterprises and technology laboratories.\n\n` +
                `🏆 **TESDA National Certification (NC II):**\n` +
                `• **TVL-ICT students** are prepared for *Computer Systems Servicing NC II*.\n` +
                `• **TVL-HE students** are prepared for *Cookery & Bread/Pastry Production NC II*.`;
        }

        // 7. Shifting Strands in Senior High School
        if (query.match(/\b(shift strand|shifting|change strand|change track|switch strand|transfer strand)\b/)) {
            return `🔄 **Strand Shifting Guidelines in Senior High School:**\n\n` +
                `• **When is shifting allowed?** Students may request to shift strands before the start of **Grade 11, Semester 2** or before **Grade 12, Semester 1**.\n` +
                `• **Requirements for Shifting:**\n` +
                `  1. Parent / Guardian consent letter.\n` +
                `  2. Interview with the Guidance Counselor and Registrar.\n` +
                `  3. Completion of bridging subjects if specialized subjects differ significantly.\n` +
                `• **How to apply:** Visit the Registrar's Office during the enrollment and sectioning period.`;
        }

        // 8. Guidance, Clinic, Library, SSG / SSLGO & Campus Facilities
        if (query.match(/\b(guidance|counseling|counselor|mental health|bullying|clinic|nurse|first aid|medical|library|books|wifi|canteen|cafeteria|club|clubs|ssg|sslgo|student government|sports|varsity)\b/)) {
            return `🏫 **Campus Services & Student Facilities at HES (Hiraya Enrollment System):**\n\n` +
                `• 🕊️ **Guidance & Counseling Office:** Confidential mental health guidance, career advising, peer support, and anti-bullying assistance.\n` +
                `• 🩺 **School Clinic:** Licensed school nurses provide daily first aid, health monitoring, and emergency response.\n` +
                `• 📖 **School Library:** Open 8:00 AM - 4:30 PM with study carrels, DepEd textbooks, reference materials, and digital terminals.\n` +
                `• 🥗 **School Canteen:** Nutritious meals following DepEd food safety and nutritional standards.\n` +
                `• 🏛️ **SSLGO & Student Clubs:** Supreme Secondary Learner Government, YES-O Science Club, Math Club, Arts Guild, School Paper Journalism (*The Hiraya Gazette*), and Volleyball/Basketball Varsity.`;
        }

        // 9. Late Enrollment & Transferees Mid-Year / 2nd Semester
        if (query.match(/\b(late enrollment|late enrollee|missed deadline|grace period|second semester|mid-year|mid year)\b/)) {
            return `📅 **Late Enrollment & Mid-Year Admission Policy:**\n\n` +
                `• **Late Enrollment Window:** DepEd grants a **30-calendar-day grace period** from the official opening of classes for valid justifiable reasons (medical, relocation, document delay).\n` +
                `• **Second Semester Admission:** Transferees seeking admission in the 2nd semester must present their 1st-semester grades (SF9) and transfer clearance from their previous institution.\n` +
                `• Please proceed to the Registrar's Office for an expedited credential evaluation.`;
        }

        // 10. ALS (Alternative Learning System) Completers
        if (query.match(/\b(als|alternative learning system|als completer|als passer)\b/)) {
            return `🎓 **ALS (Alternative Learning System) Enrollment:**\n\n` +
                `• **ALS Elementary Passers:** Eligible for direct admission to **Grade 7 Junior High School**.\n` +
                `• **ALS JHS Completers:** Eligible for direct admission to **Grade 11 Senior High School** in any track (STEM, ABM, HUMSS, TVL).\n` +
                `• **Mandatory Requirement:** Official ALS Certificate of Rating / Completion signed by the DepEd Division Superintendent.`;
        }

        // 11. Parent-Teacher Consultations & Card Giving
        if (query.match(/\b(pta|parent teacher|card giving|report card release|consultation|parent meeting|homeroom)\b/)) {
            return `👨‍👩‍👧 **Parent-Teacher Consultations & Report Card Distribution:**\n\n` +
                `• **Quarterly Card-Giving Day:** Held at the end of each quarter on scheduled Saturdays/Fridays for parents to receive report cards and discuss academic progress with class advisers.\n` +
                `• **Individual Consultations:** Parents may book an appointment with teachers during vacant advisory periods by contacting the school office at **(032) 123-4567** or messaging via the Parent Portal.`;
        }

        // 12. Password Reset & Account Recovery
        if (query.match(/\b(password reset|change password|forgot my password|account locked|cant login|can't login|reset password)\b/)) {
            return `🔐 **Account Recovery & Password Reset Instructions:**\n\n` +
                `1. Go to the **Forgot Password** page (` + `<a href="${rootPrefix}auth/forgot_password.html" class="hes-cb-chip-link">Click here</a>).\n` +
                `2. Enter your registered email address.\n` +
                `3. Follow the security instructions or contact your School Registrar / System Administrator to generate a temporary recovery passcode.\n\n` +
                `<a href="${rootPrefix}auth/forgot_password.html" class="hes-cb-action-btn"><i class="fas fa-key"></i> Go to Password Reset</a>`;
        }

        // 13. System Information / About Hiraya H.E.S
        if (query.match(/\b(what is hes|about hes|about hiraya|who made this|who built this|capstone|system features|about the school|hiraya enrollment system)\b/)) {
            return `🏛️ **About Hiraya Enrollment System (H.E.S):**\n\n` +
                `The **Hiraya Enrollment System (H.E.S)** is the official next-generation digital academic and enrollment platform in Langtad, City of Naga, Cebu.\n\n` +
                `🌟 **Core System Capabilities:**\n` +
                `• 24/7 AI-Assisted Assessment & Document Checklists\n` +
                `• Multi-Role Dashboards (Students, Teachers, Parents, Registrars, Admins)\n` +
                `• QR Code Daily Attendance & Real-Time Tracking\n` +
                `• Online Grade Encoding & GWA Automation\n` +
                `• Cloud Enrollment Verification & Section Capacity Balancing`;
        }

        // -------------------------------------------------------------
        // H. SMART SEMANTIC MATCHING & INTELLIGENT FALLBACK ENGINE
        // -------------------------------------------------------------

        // Intelligent semantic keyword scoring across school concepts
        const KNOWLEDGE_ARTICLES = [
            {
                keywords: ['grade', 'grades', 'score', 'quarter', 'average', 'gwa', 'failing', 'passed', 'failed', 'honors', 'ranking', 'card', 'report card'],
                title: "Academic Grading & Honors",
                response: `Under DepEd Order No. 8, s. 2015, the passing grade is **75**. General Weighted Average (GWA) of 90+ qualifies for Academic Honors.\n\nYou can review your grades in the student portal: <a href="${rootPrefix}student/grades.html" class="hes-cb-action-btn"><i class="fas fa-star"></i> View Grades</a>`
            },
            {
                keywords: ['enroll', 'admission', 'register', 'apply', 'start', 'student type', 'new student', 'shs', 'jhs', 'grade 7', 'grade 11'],
                title: "Online Enrollment Assessment",
                response: `You can complete your enrollment online in a few minutes! We assess requirements for Grade 7, Grade 11, Transferees, and Balik-Aral.\n\n<a href="${rootPrefix}student/enrollment.html" class="hes-cb-action-btn"><i class="fas fa-pen-fancy"></i> Open Online Enrollment Form</a>`
            },
            {
                keywords: ['requirement', 'document', 'psa', 'birth', 'certificate', 'form 137', 'form 138', 'sf9', 'sf10', 'good moral', 'picture', 'upload', 'submit'],
                title: "Document Requirements & Submission",
                response: `Key mandatory requirements include your **PSA Birth Certificate**, **Form 138 / SF9 Report Card**, and **Certificate of Good Moral Character**.\n\n<a href="${rootPrefix}student/requirements.html" class="hes-cb-action-btn"><i class="fas fa-file-alt"></i> Check Requirements</a>`
            },
            {
                keywords: ['strand', 'stem', 'abm', 'humss', 'tvl', 'track', 'senior high', 'ict', 'cookery', 'programming', 'college', 'career'],
                title: "Senior High Strands & Career Pathways",
                response: `HES offers **STEM** (Science/Tech/Engineering/Math), **ABM** (Business/Accountancy), **HUMSS** (Humanities/Law/Teaching), and **TVL** (ICT Programming & Home Economics).\n\n<button type="button" class="hes-cb-choice-btn" data-query="Help me assess which strand fits me best"><span>💡 <strong>Take Strand Advisor Quiz</strong></span> <i class="fas fa-chevron-right"></i></button>`
            },
            {
                keywords: ['attendance', 'face', 'qr', 'scan', 'scanner', 'biometric', 'absent', 'present', 'tardy', 'late', 'rate', 'record'],
                title: "Daily Attendance & Biometric Face Tracking",
                response: `Faculty attendance is logged in real-time through AI biometric facial recognition. Student attendance is managed under section attendance logs.\n\n<a href="${role === 'teacher' ? 'attendance-face.html' : (role === 'student' ? 'attendance.html' : `${rootPrefix}auth/login.html`)}" class="hes-cb-action-btn"><i class="fas fa-camera"></i> Open Attendance</a>`
            },
            {
                keywords: ['uniform', 'dress', 'clothes', 'pe', 'shoes', 'polo', 'skirt', 'slacks', 'haircut', 'wash day'],
                title: "Dress Code & School Uniforms",
                response: `Official uniforms: White polo & navy slacks for boys; white blouse with necktie & pleated navy skirt for girls. P.E. uniforms on gym days. Modest casual attire on designated wash days.`
            },
            {
                keywords: ['hours', 'time', 'open', 'close', 'gate', 'schedule', 'weekend', 'saturday', 'sunday'],
                title: "School Operating Hours",
                response: `Classes and administrative offices run **Monday to Friday, 7:00 AM – 5:00 PM**. Gates open at 6:30 AM. Campus is closed on Saturdays and Sundays.`
            },
            {
                keywords: ['account', 'login', 'password', 'reset', 'forgot', 'email', 'sign in', 'access', 'profile', 'change'],
                title: "Account & Password Help",
                response: `To manage your profile or recover your password, visit the login or profile section:\n\n<a href="${rootPrefix}auth/forgot_password.html" class="hes-cb-action-btn"><i class="fas fa-key"></i> Reset Password</a>`
            },
            {
                keywords: ['contact', 'phone', 'email', 'address', 'location', 'where', 'map', 'principal', 'office', 'naga', 'cebu', 'langtad'],
                title: "Contact & Location",
                response: `📍 **HES, Hiraya Enrollment System**, Langtad, City of Naga, Cebu 6037\n📞 Phone: (032) 123-4567\n✉️ Email: info@HES.edu.ph\n\n<a href="https://www.google.com/maps/place/City+of+Naga,+Cebu" target="_blank" class="hes-cb-action-btn"><i class="fas fa-map-location-dot"></i> View on Google Maps</a>`
            }
        ];

        // Scoring algorithm
        const userTokens = query.split(/\s+/).filter(t => t.length > 2);
        let bestArticle = null;
        let bestScore = 0;

        for (const article of KNOWLEDGE_ARTICLES) {
            let score = 0;
            for (const token of userTokens) {
                if (article.keywords.some(k => k.includes(token) || token.includes(k))) {
                    score += 1;
                }
            }
            if (score > bestScore) {
                bestScore = score;
                bestArticle = article;
            }
        }

        if (bestScore >= 1 && bestArticle) {
            return `💡 **${bestArticle.title}**\n\n` +
                `${bestArticle.response}\n\n` +
                `---\n` +
                `*Do you have any other questions? Select a topic below or type anything:*` +
                `<div class="hes-cb-choice-group">` +
                `  <button type="button" class="hes-cb-choice-btn" data-query="Assess my enrollment requirements"><span>🎯 <strong>Assess Requirements</strong></span> <i class="fas fa-chevron-right"></i></button>` +
                `  <button type="button" class="hes-cb-choice-btn" data-query="Browse all frequently asked questions"><span>📚 <strong>Browse All School Topics</strong></span> <i class="fas fa-chevron-right"></i></button>` +
                `</div>`;
        }

        // Comprehensive Conversational Fallback with Helpful Next Topics
        return `I am here to assist with any questions regarding **HES, Hiraya Enrollment System**!\n\n` +
            `Here are popular questions you can ask me right now:\n\n` +
            `<div class="hes-cb-choice-group">` +
            `  <button type="button" class="hes-cb-choice-btn" data-query="Assess my enrollment requirements">` +
            `    <span>🎯 <strong>How to Enroll & Requirements Assessment</strong></span> <i class="fas fa-chevron-right"></i>` +
            `  </button>` +
            `  <button type="button" class="hes-cb-choice-btn" data-query="Help me assess which strand fits me best">` +
            `    <span>💡 <strong>Senior High Strand Advisor</strong> (STEM / ABM / HUMSS / TVL)</span> <i class="fas fa-chevron-right"></i>` +
            `  </button>` +
            `  <button type="button" class="hes-cb-choice-btn" data-query="How does the grading system and honors work?">` +
            `    <span>📊 <strong>DepEd Grading System & Honors Criteria</strong></span> <i class="fas fa-chevron-right"></i>` +
            `  </button>` +
            `  <button type="button" class="hes-cb-choice-btn" data-query="What is the uniform policy and dress code?">` +
            `    <span>👔 <strong>Uniform Policy & School Schedule</strong></span> <i class="fas fa-chevron-right"></i>` +
            `  </button>` +
            `  <button type="button" class="hes-cb-choice-btn" data-query="Browse all frequently asked questions">` +
            `    <span>📚 <strong>Browse Complete FAQ Directory</strong></span> <i class="fas fa-chevron-right"></i>` +
            `  </button>` +
            `</div>\n` +
            `💬 *Or simply type your question in your own words!*`;
    }

    function createChatbotDOM() {
        if (document.getElementById('hesChatbotContainer')) return;

        const container = document.createElement('div');
        container.id = 'hesChatbotContainer';
        container.innerHTML = `
            <!-- Floating Launcher -->
            <div class="hes-chatbot-launcher" id="hesChatbotLauncher">
                <div class="hes-chatbot-teaser" id="hesChatbotTeaser">
                    <span class="wave">👋</span> Need help? Ask <strong>Hiraya AI</strong>!
                    <button class="hes-chatbot-teaser-close" id="hesChatbotTeaserClose" title="Dismiss">&times;</button>
                </div>
                <button class="hes-chatbot-launcher-btn" id="hesChatbotToggleBtn" aria-label="Open AI Chatbot">
                    <div class="hes-chatbot-pulse-ring"></div>
                    <i class="fas fa-comments" id="hesChatbotLauncherIcon"></i>
                    <div class="hes-chatbot-badge-indicator"></div>
                </button>
            </div>

            <!-- Chatbot Window -->
            <div class="hes-chatbot-window" id="hesChatbotWindow" role="dialog" aria-modal="true" aria-hidden="true">
                <!-- Header -->
                <div class="hes-chatbot-header">
                    <div class="hes-chatbot-header-info">
                        <div class="hes-chatbot-avatar-wrap">
                            <i class="fas ${config.avatarIcon} hes-chatbot-avatar-icon"></i>
                            <div class="hes-chatbot-status-dot"></div>
                        </div>
                        <div class="hes-chatbot-titles">
                            <h3>${config.name}</h3>
                            <span class="hes-chatbot-role-badge">${config.roleBadge}</span>
                        </div>
                    </div>
                    <div class="hes-chatbot-header-actions">
                        <button class="hes-chatbot-icon-btn ${ttsEnabled ? 'active' : ''}" id="hesChatbotTtsBtn" title="Toggle Voice Readout (TTS)">
                            <i class="fas fa-volume-${ttsEnabled ? 'high' : 'xmark'}"></i>
                        </button>
                        <button class="hes-chatbot-icon-btn ${soundEnabled ? 'active' : ''}" id="hesChatbotSoundBtn" title="Toggle Sound Effects">
                            <i class="fas fa-bell${soundEnabled ? '' : '-slash'}"></i>
                        </button>
                        <button class="hes-chatbot-icon-btn" id="hesChatbotClearBtn" title="Clear Chat History">
                            <i class="fas fa-trash-can"></i>
                        </button>
                        <button class="hes-chatbot-icon-btn" id="hesChatbotCloseBtn" title="Close Chatbot">
                            <i class="fas fa-xmark"></i>
                        </button>
                    </div>
                </div>

                <!-- Quick Prompts Chips -->
                <div class="hes-chatbot-quick-chips" id="hesChatbotQuickChips">
                    ${config.quickChips.map(chip => `
                        <button class="hes-chatbot-chip" data-query="${chip.query}">
                            <i class="fas fa-sparkles"></i> ${chip.label}
                        </button>
                    `).join('')}
                </div>

                <!-- Messages Container -->
                <div class="hes-chatbot-messages" id="hesChatbotMessages">
                    <div class="hes-chatbot-welcome-card">
                        <div class="hes-chatbot-welcome-icon">
                            <i class="fas ${config.avatarIcon}"></i>
                        </div>
                        <h4>${config.welcomeHeadline}</h4>
                        <p>${config.welcomeDesc}</p>
                    </div>
                </div>

                <!-- Input Form -->
                <div class="hes-chatbot-input-area">
                    <form id="hesChatbotForm" class="hes-chatbot-input-box" onsubmit="return false;">
                        <input type="text" id="hesChatbotInput" class="hes-chatbot-input" placeholder="Ask questions or type 'Assess me'..." autocomplete="off" />
                        <button type="submit" id="hesChatbotSendBtn" class="hes-chatbot-send-btn" title="Send message">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </form>
                    <p class="hes-chatbot-footer-caption">Hiraya Enrollment System · 24/7 AI Assessment & Assistant</p>
                </div>
            </div>
        `;

        document.body.appendChild(container);
        setupChatbotEvents();
        loadSavedHistory();
    }
    function setupChatbotEvents() {
        const toggleBtn = document.getElementById('hesChatbotToggleBtn');
        const closeBtn = document.getElementById('hesChatbotCloseBtn');
        const teaserClose = document.getElementById('hesChatbotTeaserClose');
        const teaser = document.getElementById('hesChatbotTeaser');
        const windowEl = document.getElementById('hesChatbotWindow');
        const launcherIcon = document.getElementById('hesChatbotLauncherIcon');
        const form = document.getElementById('hesChatbotForm');
        const input = document.getElementById('hesChatbotInput');
        const clearBtn = document.getElementById('hesChatbotClearBtn');
        const soundBtn = document.getElementById('hesChatbotSoundBtn');
        const ttsBtn = document.getElementById('hesChatbotTtsBtn');
        const quickChips = document.getElementById('hesChatbotQuickChips');
        const messagesContainer = document.getElementById('hesChatbotMessages');

        function toggleChat() {
            const isOpen = windowEl.classList.toggle('open');
            windowEl.setAttribute('aria-hidden', !isOpen);
            if (isOpen) {
                launcherIcon.className = 'fas fa-xmark';
                if (teaser) teaser.style.display = 'none';
                input.focus();
                scrollBottom();
            } else {
                launcherIcon.className = 'fas fa-comments';
            }
        }

        toggleBtn.addEventListener('click', toggleChat);
        closeBtn.addEventListener('click', toggleChat);

        if (teaserClose && teaser) {
            teaserClose.addEventListener('click', (e) => {
                e.stopPropagation();
                teaser.style.display = 'none';
            });
        }

        soundBtn.addEventListener('click', () => {
            soundEnabled = !soundEnabled;
            localStorage.setItem('hes_cb_sound', soundEnabled);
            soundBtn.classList.toggle('active', soundEnabled);
            soundBtn.innerHTML = `<i class="fas fa-bell${soundEnabled ? '' : '-slash'}"></i>`;
            if (soundEnabled) playAudio('sent');
        });

        ttsBtn.addEventListener('click', () => {
            ttsEnabled = !ttsEnabled;
            localStorage.setItem('hes_cb_tts', ttsEnabled);
            ttsBtn.classList.toggle('active', ttsEnabled);
            ttsBtn.innerHTML = `<i class="fas fa-volume-${ttsEnabled ? 'high' : 'xmark'}"></i>`;
            if (ttsEnabled) speakText("Voice read out enabled.");
        });

        clearBtn.addEventListener('click', () => {
            if (confirm("Clear chat history?")) {
                localStorage.removeItem(config.storageKey);
                const welcomeCard = messagesContainer.querySelector('.hes-chatbot-welcome-card');
                messagesContainer.innerHTML = '';
                if (welcomeCard) messagesContainer.appendChild(welcomeCard);
            }
        });

        quickChips.addEventListener('click', (e) => {
            const chip = e.target.closest('.hes-chatbot-chip');
            if (chip) {
                const q = chip.dataset.query;
                handleUserMessage(q);
            }
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = input.value.trim();
            if (!text) return;
            input.value = '';
            handleUserMessage(text);
        });

        // Dynamic interactive choice button click handler & chip links
        messagesContainer.addEventListener('click', (e) => {
            const choiceBtn = e.target.closest('.hes-cb-choice-btn');
            if (choiceBtn) {
                e.preventDefault();
                const q = choiceBtn.dataset.query;
                if (q) handleUserMessage(q);
                return;
            }

            const chipLink = e.target.closest('.hes-cb-chip-link');
            if (chipLink) {
                e.preventDefault();
                const q = chipLink.dataset.q;
                if (q) handleUserMessage(q);
            }
        });
    }

    function scrollBottom() {
        const messagesContainer = document.getElementById('hesChatbotMessages');
        if (messagesContainer) {
            setTimeout(() => {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }, 50);
        }
    }

    function appendMessage(sender, htmlContent, save = true) {
        const messagesContainer = document.getElementById('hesChatbotMessages');
        if (!messagesContainer) return;

        const row = document.createElement('div');
        row.className = `hes-cb-msg-row ${sender}`;
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (sender === 'bot') {
            row.innerHTML = `
                <div class="hes-cb-bot-avatar">
                    <i class="fas ${config.avatarIcon}"></i>
                </div>
                <div class="hes-cb-bubble">
                    ${formatMarkdown(htmlContent)}
                    <span class="hes-cb-time">${timeStr}</span>
                </div>
            `;
        } else {
            row.innerHTML = `
                <div class="hes-cb-bubble">
                    <p>${escapeHtml(htmlContent)}</p>
                    <span class="hes-cb-time">${timeStr}</span>
                </div>
            `;
        }

        messagesContainer.appendChild(row);
        scrollBottom();

        if (save) {
            saveMessageToHistory(sender, htmlContent, timeStr);
        }
    }

    function handleUserMessage(userText) {
        appendMessage('user', userText, true);
        playAudio('sent');
        showTypingIndicator();

        const delay = Math.min(1000, 350 + userText.length * 8);
        setTimeout(() => {
            removeTypingIndicator();
            const reply = getContextualKnowledge(userText);
            appendMessage('bot', reply, true);
            playAudio('received');
            speakText(reply);
        }, delay);
    }

    function showTypingIndicator() {
        const messagesContainer = document.getElementById('hesChatbotMessages');
        if (!messagesContainer) return;
        removeTypingIndicator();

        const row = document.createElement('div');
        row.id = 'hesCbTypingIndicator';
        row.className = 'hes-cb-msg-row bot';
        row.innerHTML = `
            <div class="hes-cb-bot-avatar">
                <i class="fas ${config.avatarIcon}"></i>
            </div>
            <div class="hes-cb-typing">
                <div class="hes-cb-typing-dot"></div>
                <div class="hes-cb-typing-dot"></div>
                <div class="hes-cb-typing-dot"></div>
            </div>
        `;
        messagesContainer.appendChild(row);
        scrollBottom();
    }

    function removeTypingIndicator() {
        const el = document.getElementById('hesCbTypingIndicator');
        if (el) el.remove();
    }

    function formatMarkdown(text) {
        if (!text) return '';
        let parsed = text;

        parsed = parsed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        parsed = parsed.replace(/\*(.*?)\*/g, '<em>$1</em>');
        parsed = parsed.replace(/\n\n/g, '</p><p>');
        parsed = parsed.replace(/\n/g, '<br>');

        return `<p>${parsed}</p>`;
    }

    function escapeHtml(str) {
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function saveMessageToHistory(sender, content, time) {
        try {
            const raw = localStorage.getItem(config.storageKey);
            const history = raw ? JSON.parse(raw) : [];
            history.push({ sender, content, time });
            if (history.length > 30) history.shift();
            localStorage.setItem(config.storageKey, JSON.stringify(history));
        } catch (e) {
            console.warn('Could not save chat history:', e);
        }
    }

    function loadSavedHistory() {
        try {
            const raw = localStorage.getItem(config.storageKey);
            if (!raw) return;
            const history = JSON.parse(raw);
            if (Array.isArray(history)) {
                history.forEach(item => {
                    appendMessage(item.sender, item.content, false);
                });
            }
        } catch (e) {
            console.warn('Could not load chat history:', e);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createChatbotDOM);
    } else {
        createChatbotDOM();
    }
    (function initUniversalSidebarScroll() {
        if (window.HESSidebarScrollInitialized) return;
        window.HESSidebarScrollInitialized = true;

        const path = window.location.pathname.toLowerCase();
        let role = 'guest';
        if (path.includes('/admin/')) role = 'admin';
        else if (path.includes('/teacher/')) role = 'teacher';
        else if (path.includes('/student/')) role = 'student';
        else if (path.includes('/registrar/')) role = 'registrar';
        else if (path.includes('/parents/')) role = 'parent';
        else if (path.includes('/guidance/')) role = 'guidance';

        const STORAGE_KEY = `hes_sidebar_scroll_${role}`;

        function restoreSidebarScroll() {
            const navMenu = document.querySelector('.sidebar .nav-menu') || document.querySelector('.nav-menu');
            if (!navMenu) return;

            const savedPos = sessionStorage.getItem(STORAGE_KEY);
            if (savedPos !== null) {
                const pos = parseInt(savedPos, 10);
                if (!isNaN(pos) && pos >= 0) {
                    navMenu.style.scrollBehavior = 'auto';
                    navMenu.scrollTop = pos;
                }
            }

            let debounceTimer;
            navMenu.addEventListener('scroll', function () {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    sessionStorage.setItem(STORAGE_KEY, navMenu.scrollTop);
                }, 60);
            }, { passive: true });

            // Ensure every link is 100% clickable and remembers scroll position
            navMenu.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', function () {
                    sessionStorage.setItem(STORAGE_KEY, navMenu.scrollTop);
                }, { passive: true });
            });

        }

        restoreSidebarScroll();

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', restoreSidebarScroll, { once: true });
        }

        window.addEventListener('pageshow', restoreSidebarScroll, { once: true });
    })();

})();
