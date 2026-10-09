/**
 * Teacher Schedule & Attendance Validation Helper
 * Provides shared utilities for:
 * 1. Fetching teacher profile and dynamic adjusted schedules for today
 * 2. Evaluating On-Time vs Late status dynamically against adjusted schedules
 * 3. Recording Time-In and Time-Out in teacher_attendance, attendance, and activity_logs
 * 4. Syncing attendance state across Teacher and Admin portals
 */

export function formatTime(timeStr) {
    if (!timeStr || timeStr === '—' || timeStr === '--:--' || timeStr === '--:-- --') return '—';
    try {
        if (typeof timeStr === 'string' && (timeStr.includes('AM') || timeStr.includes('PM'))) return timeStr;
        if (typeof timeStr === 'string' && (timeStr.includes('T') || timeStr.includes('-'))) {
            const d = new Date(timeStr);
            if (!isNaN(d.getTime())) {
                return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            }
        }
        const parts = String(timeStr).split(':');
        const h = parseInt(parts[0], 10);
        const m = parts[1] || '00';
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}:${m} ${ampm}`;
    } catch {
        return timeStr;
    }
}


export function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    try {
        const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
        return dateStr;
    }
}

export function getTodayDateString() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function getLocalTimeString() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

/**
 * Fetch teacher record and resolve today's adjusted schedule
 */
export async function getTeacherProfileAndSchedule(supabase, sessionUser) {
    const currentUserId = sessionUser.id || sessionUser.uid;
    const userEmail = sessionUser.email || '';
    let teacherRecord = null;

    try {
        // 1. Try finding teacher by user_id or id
        let { data: tData } = await supabase
            .from('teachers')
            .select('*')
            .or(`user_id.eq.${currentUserId},id.eq.${currentUserId}`)
            .maybeSingle();

        // If not found and email exists, check via users table
        if (!tData && userEmail) {
            const { data: uData } = await supabase
                .from('users')
                .select('id')
                .eq('email', userEmail)
                .maybeSingle();

            if (uData) {
                const { data: matchedT } = await supabase
                    .from('teachers')
                    .select('*')
                    .eq('user_id', uData.id)
                    .maybeSingle();
                tData = matchedT;
            }
        }

        if (!tData) {
            teacherRecord = {
                id: currentUserId,
                user_id: currentUserId,
                employee_id: sessionUser.employee_id || 'HES-TCH-001',
                specialization: sessionUser.specialization || 'Faculty'
            };
        } else {
            teacherRecord = tData;
        }

        // 2. Fetch today's classes from schedules
        const todayDate = new Date();
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDayName = dayNames[todayDate.getDay()];
        const isWeekend = todayDate.getDay() === 0 || todayDate.getDay() === 6;

        let scheduleRows = [];
        try {
            const { data: sData, error: sErr } = await supabase
                .from('schedules')
                .select(`
                    id, day, start_time, end_time, room,
                    subjects(id, name, code),
                    sections(id, name, grade_level)
                `)
                .eq('teacher_id', teacherRecord.id);

            if (!sErr && sData) {
                scheduleRows = sData;
            }
        } catch (e) {
            console.warn('Could not query schedules with joins:', e);
        }

        // Filter classes for today
        const todayClasses = scheduleRows.filter(s => 
            (s.day || '').toLowerCase() === currentDayName.toLowerCase()
        ).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

        let adjustedSchedule = null;

        if (todayClasses.length > 0) {
            const earliest = todayClasses[0].start_time;
            const latest = todayClasses[todayClasses.length - 1].end_time;
            adjustedSchedule = {
                day: currentDayName,
                dayName: currentDayName,
                hasClasses: true,
                classesCount: todayClasses.length,
                classes: todayClasses,
                startTime: formatTime(earliest),
                endTime: formatTime(latest),
                earliestStartTime: earliest,
                latestEndTime: latest,
                scheduleType: 'Assigned Teaching Classes',
                summary: `${formatTime(earliest)} - ${formatTime(latest)} (${todayClasses.length} period${todayClasses.length > 1 ? 's' : ''})`,
                isDefaultFallback: false,
                isWeekend: isWeekend
            };
        } else {
            // Flexible / Adjusted Faculty Duty
            const isWk = isWeekend;
            adjustedSchedule = {
                day: currentDayName,
                dayName: currentDayName,
                hasClasses: false,
                classesCount: 0,
                classes: [],
                startTime: '',
                endTime: '',
                earliestStartTime: '00:00:00',
                latestEndTime: '23:59:59',
                scheduleType: isWk ? 'Weekend Faculty Duty' : 'Official Faculty Duty',
                summary: isWk ? 'Weekend Faculty Duty' : 'Official Faculty Duty',
                isDefaultFallback: true,
                isWeekend: isWk
            };
        }

        // 3. Fetch today's attendance record for this teacher
        const todayStr = getTodayDateString();
        let todayAttendance = null;
        try {
            // Query teacher_attendance table
            let attQuery = supabase
                .from('teacher_attendance')
                .select('*')
                .eq('date', todayStr);

            if (teacherRecord.user_id && teacherRecord.user_id !== teacherRecord.id) {
                attQuery = attQuery.or(`teacher_id.eq.${teacherRecord.id},teacher_id.eq.${teacherRecord.user_id}`);
            } else {
                attQuery = attQuery.eq('teacher_id', teacherRecord.id);
            }

            const { data: tAttList, error: tErr } = await attQuery.order('created_at', { ascending: false }).limit(1);

            if (!tErr && tAttList && tAttList.length > 0) {
                todayAttendance = tAttList[0];
            } else {
                // Fallback to general attendance table
                let genQuery = supabase
                    .from('attendance')
                    .select('*')
                    .eq('date', todayStr);

                if (teacherRecord.user_id && teacherRecord.user_id !== teacherRecord.id) {
                    genQuery = genQuery.or(`teacher_id.eq.${teacherRecord.id},user_id.eq.${teacherRecord.user_id}`);
                } else {
                    genQuery = genQuery.or(`teacher_id.eq.${teacherRecord.id},user_id.eq.${teacherRecord.id}`);
                }

                const { data: gAttList, error: gErr } = await genQuery.order('created_at', { ascending: false }).limit(1);
                if (!gErr && gAttList && gAttList.length > 0) {
                    todayAttendance = gAttList[0];
                }
            }

            // Merge with local storage cache to ensure the very latest local state is reflected
            if (typeof localStorage !== 'undefined') {
                try {
                    const cacheKey = 'hes_teacher_attendance_' + teacherRecord.id;
                    const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
                    const match = cached.find(r => r.date === todayStr);
                    if (match) {
                        if (!todayAttendance) {
                            todayAttendance = match;
                        } else {
                            if (!todayAttendance.time_in && match.time_in) todayAttendance.time_in = match.time_in;
                            if (!todayAttendance.time_out && match.time_out) todayAttendance.time_out = match.time_out;
                            if (match.validationMethod && !todayAttendance.verification_mode) {
                                todayAttendance.verification_mode = match.validationMethod;
                            }
                        }
                    }
                } catch (e) {}
            }
        } catch (attQueryErr) {
            console.warn('Attendance query notice in schedule-helper:', attQueryErr);
        }

        return {
            teacherRecord,
            teacherProfile: teacherRecord,
            todaySchedule: adjustedSchedule,
            adjustedSchedule: adjustedSchedule,
            todayAttendance
        };

    } catch (err) {
        console.error('Error fetching teacher profile and schedule:', err);
        const fallbackSched = {
            day: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
            dayName: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
            hasClasses: false,
            classesCount: 0,
            classes: [],
            startTime: '',
            endTime: '',
            earliestStartTime: '00:00:00',
            latestEndTime: '23:59:59',
            scheduleType: 'Faculty Attendance Record',
            summary: 'Daily Attendance',
            isDefaultFallback: true,
            isWeekend: false
        };
        return {
            teacherRecord: { id: currentUserId, user_id: currentUserId },
            teacherProfile: { id: currentUserId, user_id: currentUserId },
            todaySchedule: fallbackSched,
            adjustedSchedule: fallbackSched,
            todayAttendance: null
        };
    }
}

/**
 * Evaluate attendance status against adjusted schedule
 * Note: Teachers are never marked as Late; system records their actual clock-in/out times.
 */
export function evaluateAttendanceStatus(timeStr, adjustedSchedule) {
    const now = new Date();
    let currentHours = now.getHours();
    let currentMinutes = now.getMinutes();

    if (timeStr && timeStr.includes(':')) {
        const parts = timeStr.split(':');
        currentHours = parseInt(parts[0], 10);
        currentMinutes = parseInt(parts[1], 10);
    }

    const timeFormatted = formatTime(`${String(currentHours).padStart(2, '0')}:${String(currentMinutes).padStart(2, '0')}`);

    return {
        status: 'Present',
        isLate: false,
        lateMinutes: 0,
        note: `Time-In recorded at ${timeFormatted}`,
        cutoffFormatted: '',
        currentTimeFormatted: timeFormatted
    };
}

/**
 * Record Time-In or Time-Out across teacher_attendance, attendance, and activity_logs
 * Records actual arrival and departure without late penalties.
 */
export async function recordTeacherAttendance(supabase, params) {
    const teacherRecord = params.teacherRecord || params.teacherProfile || {};
    const user = params.user || {};
    const displayName = params.displayName || 
        (user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (teacherRecord?.name || 'Teacher'));
    const actionType = params.actionType;
    const validationMethod = params.validationMethod || 'Direct Validation';
    const adjustedSchedule = params.adjustedSchedule || params.todaySchedule || {
        earliestStartTime: '00:00:00',
        latestEndTime: '23:59:59',
        summary: 'Daily Attendance'
    };
    const confidence = params.confidence || null;

    const todayStr = getTodayDateString();
    const timeStr = getLocalTimeString();
    const nowIso = new Date().toISOString();
    const evaluation = evaluateAttendanceStatus(timeStr, adjustedSchedule);
    const status = (actionType === 'time_in') ? 'Present' : 'Completed';
    const isLate = false;
    const actionLabel = actionType === 'time_in' ? 'Time In' : 'Time Out';
    const timeFormatted = formatTime(timeStr);

    console.log(`📝 Recording ${actionLabel} for ${displayName}: status=${status}, actual_time=${timeFormatted}`);

    let recordResult = {
        date: todayStr,
        time_in: actionType === 'time_in' ? timeFormatted : null,
        time_out: actionType === 'time_out' ? timeFormatted : null,
        status: status,
        isLate: false,
        lateMinutes: 0,
        timeFormatted: timeFormatted,
        actionLabel: actionLabel,
        evaluation: evaluation,
        raw: null
    };

    // 1. Upsert / Update 'teacher_attendance'
    try {
        let { data: existingRow } = await supabase
            .from('teacher_attendance')
            .select('*')
            .eq('teacher_id', teacherRecord.id)
            .eq('date', todayStr)
            .maybeSingle();

        if (actionType === 'time_in') {
            const payload = {
                teacher_id: teacherRecord.id,
                date: todayStr,
                time_in: nowIso,
                in_status: 'Present',
                status: 'Present',
                verification_mode: validationMethod
            };
            if (existingRow && existingRow.time_out) {
                payload.time_out = existingRow.time_out;
                payload.out_status = existingRow.out_status || 'Completed';
            }
            const { data: tAtt, error: tErr } = await supabase
                .from('teacher_attendance')
                .upsert(payload, { onConflict: 'teacher_id,date' })
                .select();

            if (tErr) console.error('teacher_attendance upsert error:', tErr);
            if (!tErr && tAtt && tAtt.length > 0) {
                recordResult.raw = tAtt[0];
            }
        } else {
            const payload = {
                teacher_id: teacherRecord.id,
                date: todayStr,
                time_out: nowIso,
                out_status: 'Completed',
                status: 'Present',
                verification_mode: validationMethod
            };
            if (existingRow && existingRow.time_in) {
                payload.time_in = existingRow.time_in;
                payload.in_status = existingRow.in_status || 'Present';
            }
            const { data: tAtt, error: tErr } = await supabase
                .from('teacher_attendance')
                .upsert(payload, { onConflict: 'teacher_id,date' })
                .select();

            if (tErr) console.error('teacher_attendance time_out error:', tErr);
            if (!tErr && tAtt && tAtt.length > 0) {
                recordResult.raw = tAtt[0];
            }
        }
    } catch (err) {
        console.warn('teacher_attendance table sync notice:', err);
    }

    // 2. Upsert / Update general 'attendance' table
    try {
        const { data: existingGen } = await supabase
            .from('attendance')
            .select('id, time_in, time_out')
            .eq('teacher_id', teacherRecord.id)
            .eq('date', todayStr)
            .maybeSingle();

        if (actionType === 'time_in') {
            const remarksText = `Time In: ${timeFormatted}. Validated via ${validationMethod}.`;
            if (existingGen) {
                await supabase
                    .from('attendance')
                    .update({
                        time_in: timeStr,
                        status: 'present',
                        remarks: remarksText
                    })
                    .eq('id', existingGen.id);
            } else {
                await supabase
                    .from('attendance')
                    .insert({
                        teacher_id: teacherRecord.id,
                        date: todayStr,
                        time_in: timeStr,
                        status: 'present',
                        remarks: remarksText
                    });
            }
        } else {
            const remarksText = `Time Out: ${timeFormatted}. Validated via ${validationMethod}.`;
            if (existingGen) {
                await supabase
                    .from('attendance')
                    .update({
                        time_out: timeStr,
                        remarks: remarksText
                    })
                    .eq('id', existingGen.id);
            } else {
                await supabase
                    .from('attendance')
                    .insert({
                        teacher_id: teacherRecord.id,
                        date: todayStr,
                        time_out: timeStr,
                        status: 'present',
                        remarks: remarksText
                    });
            }
        }
    } catch (err) {
        console.warn('attendance table sync notice:', err);
    }

    // 3. Insert into 'activity_logs' for full admin and faculty audit visibility
    try {
        const confText = confidence ? ` (${confidence}% biometric confidence)` : '';
        const actionTitle = `Teacher ${actionLabel} (${status})`;
        const logDetails = `Teacher ${displayName} recorded ${actionLabel} at ${timeFormatted} on ${formatDate(todayStr)}. Validated via ${validationMethod}${confText}. Status: ${status}.`;

        await supabase
            .from('activity_logs')
            .insert([{
                user_id: teacherRecord.user_id || teacherRecord.id,
                role: 'teacher',
                action: actionTitle,
                details: logDetails,
                timestamp: nowIso
            }]);
        console.log('✅ Activity log entry recorded successfully');
    } catch (err) {
        console.warn('activity_logs insert notice:', err);
    }

    // 4. Update Local Storage Caches
    try {
        const cacheKey = 'hes_teacher_attendance_' + teacherRecord.id;
        const rawCache = localStorage.getItem(cacheKey);
        let history = rawCache ? JSON.parse(rawCache) : [];
        const existingIdx = history.findIndex(r => r.date === todayStr);

        const currentEntry = {
            id: recordResult.raw?.id || Date.now(),
            teacher_id: teacherRecord.id,
            date: todayStr,
            time_in: actionType === 'time_in' ? timeFormatted : (history[existingIdx]?.time_in || timeFormatted),
            time_out: actionType === 'time_out' ? timeFormatted : (history[existingIdx]?.time_out || null),
            status: actionType === 'time_in' ? status : (history[existingIdx]?.status || 'Present'),
            scheduleSummary: adjustedSchedule.summary,
            validationMethod: validationMethod,
            timestamp: nowIso
        };

        if (existingIdx >= 0) {
            history[existingIdx] = { ...history[existingIdx], ...currentEntry };
        } else {
            history.unshift(currentEntry);
        }
        localStorage.setItem(cacheKey, JSON.stringify(history));

        // Global admin cache
        const globalRaw = localStorage.getItem('hes_teacher_attendance');
        let globalList = globalRaw ? JSON.parse(globalRaw) : [];
        const gIdx = globalList.findIndex(r => (r.name === displayName || r.teacher_id === teacherRecord.id) && r.date === todayStr);
        const globalEntry = {
            id: currentEntry.id,
            name: displayName,
            teacher_id: teacherRecord.id,
            id_number: teacherRecord.employee_id || 'HES-TCH-001',
            dept: teacherRecord.specialization || 'Faculty',
            date: todayStr,
            timeIn: currentEntry.time_in ? formatTime(currentEntry.time_in) : '—',
            timeOut: currentEntry.time_out ? formatTime(currentEntry.time_out) : '—',
            status: currentEntry.status,
            schedule: adjustedSchedule.summary,
            validation: validationMethod
        };
        if (gIdx >= 0) {
            globalList[gIdx] = globalEntry;
        } else {
            globalList.unshift(globalEntry);
        }
        localStorage.setItem('hes_teacher_attendance', JSON.stringify(globalList));

        // Signal cross-tab / cross-window update
        localStorage.setItem('hes_teacher_attendance_last_sync', Date.now().toString());
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('teacher-attendance-updated', { detail: currentEntry }));
        }

    } catch (e) {
        console.warn('Local storage cache update failed:', e);
    }

    return {
        success: true,
        actionLabel,
        timeFormatted,
        status,
        evaluation,
        todayStr,
        lateMinutes: evaluation.lateMinutes || 0,
        record: recordResult.raw || {
            teacher_id: teacherRecord.id,
            date: todayStr,
            time_in: actionType === 'time_in' ? nowIso : null,
            time_out: actionType === 'time_out' ? nowIso : null,
            status: status
        }
    };
}

// Global browser window attachment for compatibility
if (typeof window !== 'undefined') {
    window.TeacherScheduleHelper = {
        formatTime,
        formatDate,
        getTodayDateString,
        getLocalTimeString,
        getTeacherProfileAndSchedule,
        evaluateAttendanceStatus,
        recordTeacherAttendance
    };
}
