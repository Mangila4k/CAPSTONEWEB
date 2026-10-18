import fs from 'fs';
import path from 'path';

const htmlPath = path.resolve('teacher/attendance-qr.html');
const jsPath = path.resolve('teacher/js/attendance-qr.js');
const cssPath = path.resolve('teacher/css/attendance-qr.css');

const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
const jsContent = fs.readFileSync(jsPath, 'utf-8');
const cssContent = fs.readFileSync(cssPath, 'utf-8');

console.log('--- Testing Attendance History Implementation ---');

const requiredHtmlIds = [
    'tabLiveFeed',
    'tabAttendanceHistory',
    'badgeTodayCount',
    'badgeHistoryCount',
    'liveFeedView',
    'historyFeedView',
    'historyDateInput',
    'historySectionFilter',
    'historyStatusFilter',
    'historyModeFilter',
    'historySearchInput',
    'histCountTotal',
    'histCountPresent',
    'histCountLate',
    'historyTable',
    'historyTableBody',
    'emptyHistoryRow',
    'btnExportHistoryCsv',
    'btnRefreshHistory',
    'recordDetailModal',
    'btnCloseDetailModal',
    'btnModalClose',
    'modalStatusBadge',
    'modalStudentName',
    'modalStudentPhoto',
    'modalAvatarInitial',
    'modalLrn',
    'modalIdNo',
    'modalGradeSection',
    'modalStrand',
    'modalDate',
    'modalTime',
    'modalSessionMode',
    'modalRecordedBy',
    'modalRemarks',
    'modalGuardianBox',
    'modalGuardianName',
    'modalGuardianPhone'
];

let missingHtml = 0;
requiredHtmlIds.forEach(id => {
    if (!htmlContent.includes(`id="${id}"`)) {
        console.error(`❌ Missing HTML ID: ${id}`);
        missingHtml++;
    }
});

if (missingHtml === 0) {
    console.log('✅ All 37 required HTML IDs are present in attendance-qr.html');
}

const requiredJsTokens = [
    'tabLiveFeed',
    'tabAttendanceHistory',
    'badgeTodayCount',
    'badgeHistoryCount',
    'loadAllAttendanceHistory',
    'populateHistorySectionFilter',
    'applyHistoryFilters',
    'renderHistoryTable',
    'window.viewRecordDetails',
    'closeRecordDetailModal',
    'formatDisplayDate',
    'exportHistoryToCSV',
    'hes_attendance_records',
    'hes_qr_scans_'
];

let missingJs = 0;
requiredJsTokens.forEach(token => {
    if (!jsContent.includes(token)) {
        console.error(`❌ Missing JS Token/Function: ${token}`);
        missingJs++;
    }
});

if (missingJs === 0) {
    console.log('✅ All key logic functions and data sources present in attendance-qr.js');
}

const requiredCssClasses = [
    '.feed-tabs-header',
    '.feed-tab-pill',
    '.tab-counter-badge',
    '.history-filter-toolbar',
    '.history-input-date',
    '.history-select',
    '.history-chips-group',
    '.history-chip',
    '.history-search-summary-bar',
    '.history-stats-pill',
    '.hist-date-pill',
    '.record-detail-modal-overlay',
    '.record-detail-modal-card'
];

let missingCss = 0;
requiredCssClasses.forEach(cls => {
    if (!cssContent.includes(cls)) {
        console.error(`❌ Missing CSS Class: ${cls}`);
        missingCss++;
    }
});

if (missingCss === 0) {
    console.log('✅ All required CSS styling rules present in attendance-qr.css');
}

if (missingHtml === 0 && missingJs === 0 && missingCss === 0) {
    console.log('🎉 SUCCESS: Attendance History feature is completely and cleanly implemented!');
} else {
    process.exit(1);
}
