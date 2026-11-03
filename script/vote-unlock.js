(function () {
    'use strict';

    const SUPABASE_URL = (typeof window.SUPABASE_URL !== 'undefined' && window.SUPABASE_URL)
        ? window.SUPABASE_URL
        : 'https://nzobdkybbpufntionuze.supabase.co/';
    const SUPABASE_ANON_KEY = (typeof window.SUPABASE_ANON_KEY !== 'undefined' && window.SUPABASE_ANON_KEY)
        ? window.SUPABASE_ANON_KEY
        : 'sb_publishable_xBBzY0PXxUVWx4fINXBk3w_UwSEywAq';

    // Shared Secret สำหรับถอดรหัส AES-GCM ตามข้อกำหนด (พร้อมรองรับคีย์เดิมเป็น Fallback)
    const SHARED_SECRET = 'eLection-Threshold-Demo-Shared-Secret-2569';
    const LEGACY_SECRET = 'eLection-ECT-SecretKey-2026-BKK';

    const urlParams = new URLSearchParams(window.location.search);
    const eventValue = urlParams.get('event') || urlParams.get('id') || '';

    function safeReadJson(storage, key, fallback) {
        try {
            return JSON.parse(storage.getItem(key) || 'null') || fallback;
        } catch {
            return fallback;
        }
    }

    function getStoredEventValue() {
        const receipt = safeReadJson(window.sessionStorage, 'latest_vote_receipt', null);
        if (receipt && (receipt.eventId || receipt.eventType)) {
            return receipt.eventId || receipt.eventType;
        }

        const remembered = [
            'election_current_event',
            'currentEventId',
            'selectedEventId',
            'election_event_id',
        ].map(key => {
            try {
                return window.localStorage.getItem(key);
            } catch {
                return null;
            }
        }).find(Boolean);
        if (remembered) return remembered;

        const staging = safeReadJson(window.localStorage, 'election-staging-envelopes', {});
        const latest = Object.values(staging)
            .filter(record => record && record.eventId)
            .sort((left, right) => {
                const leftTime = Date.parse(left.outerEnvelope?.timestampIso || '') || 0;
                const rightTime = Date.parse(right.outerEnvelope?.timestampIso || '') || 0;
                return rightTime - leftTime;
            })[0];
        return latest?.eventId || '';
    }

    function detectEventType(value) {
        const normalized = String(value || '').toLowerCase().replace(/[^a-z]/g, '');
        return normalized.includes('ref') ? 'referendum' : 'mp';
    }

    const eventId = eventValue || getStoredEventValue() || 'house-election-2569';
    const eventType = detectEventType(eventId);
    const isReferendum = eventType === 'referendum';
    const eventKey = isReferendum ? 'referendum-2569-03' : 'house-election-2569';
    const stateKey = `election_unlock_state_${eventKey}`;

    const stakeholderNames = isReferendum
        ? [
            'ผู้แทนสำนักงาน กกต.',
            'ผู้แทนรัฐสภา',
            'ผู้แทนภาคประชาชนและผู้สังเกตการณ์ 1',
            'ผู้แทนภาคประชาชนและผู้สังเกตการณ์ 2',
            'ผู้แทนภาคประชาชนและผู้สังเกตการณ์ 3',
        ]
        : [
            'ผู้แทนสำนักงาน กกต.',
            'ตัวแทนพรรค ก',
            'ตัวแทนพรรค ข',
            'ตัวแทนพรรค ค',
            'ผู้แทนภาคประชาชนและผู้สังเกตการณ์',
        ];

    /**
     * 1. ปลดล็อกสิทธิ์การกดปุ่ม Demo:
     * คืนค่า true เป็นค่าเริ่มต้น เพื่อให้กดปุ่ม "ส่งรหัส" ทดสอบได้ทันทีโดยไม่ต้องพึ่ง ?role=citizen_key
     */
    function hasCitizenKeyAccess() {
        return true;
    }

    function generateTxId(usedIds) {
        let value;
        do {
            const bytes = new Uint16Array(1);
            if (window.crypto?.getRandomValues) {
                window.crypto.getRandomValues(bytes);
                value = bytes[0];
            } else {
                value = Math.floor(Math.random() * 0x10000);
            }
        } while (usedIds.has(value));

        usedIds.add(value);
        return `#TX-${value.toString(16).padStart(4, '0').toUpperCase()}`;
    }

    function loadState() {
        const saved = safeReadJson(window.localStorage, stateKey, {});
        const txRefs = saved.txRefs && typeof saved.txRefs === 'object' ? saved.txRefs : {};
        const usedIds = new Set(
            Object.values(txRefs)
                .map(reference => Number.parseInt(String(reference).replace(/^#TX-/, ''), 16))
                .filter(Number.isFinite)
        );

        for (let number = 1; number <= 4; number += 1) {
            if (!/^#TX-[0-9A-F]{4}$/.test(txRefs[number] || '')) {
                txRefs[number] = generateTxId(usedIds);
            }
        }

        // เริ่มต้นในสถานะพร้อมกดปุ่ม "ส่งรหัส" สำหรับการทดสอบ Demo เสมอ
        return {
            completed: false,
            txRefs,
        };
    }

    const state = loadState();
    let isDecrypting = false;

    function saveState() {
        try {
            window.localStorage.setItem(stateKey, JSON.stringify(state));
        } catch (error) {
            console.warn('Cannot save unlock state', error);
        }
    }

    function getSupabaseClient() {
        if (typeof supabaseClient !== 'undefined' && supabaseClient) return supabaseClient;
        if (window.supabaseClient) return window.supabaseClient;
        if (window.supabase && typeof window.supabase.createClient === 'function') {
            window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            return window.supabaseClient;
        }
        return null;
    }

    function partyNameFromRow(row) {
        if (!row || typeof row !== 'object') return '';
        const partyFields = ['party_name_th', 'party_name', 'partyname', 'party_th', 'party', 'name_th', 'name'];
        const nestedFields = ['name_th', 'party_name_th', 'party_name', 'name'];
        for (const field of partyFields) {
            const key = Object.keys(row).find(candidate => candidate.toLowerCase() === field);
            if (!key) continue;
            const value = row[key];
            if (typeof value === 'string' && value.trim()) return value.trim();
            if (value && typeof value === 'object') {
                for (const nestedField of nestedFields) {
                    const nestedKey = Object.keys(value).find(candidate => candidate.toLowerCase() === nestedField);
                    if (nestedKey && typeof value[nestedKey] === 'string' && value[nestedKey].trim()) {
                        return value[nestedKey].trim();
                    }
                }
            }
        }
        return '';
    }

    async function getRandomPartyNames() {
        const client = getSupabaseClient();
        if (!client) return [];

        try {
            const { data, error } = await client.from('party_candidates').select('*');
            if (error) throw error;

            const names = [...new Set((data || []).map(partyNameFromRow).filter(Boolean))];
            for (let index = names.length - 1; index > 0; index -= 1) {
                const swapIndex = Math.floor(Math.random() * (index + 1));
                [names[index], names[swapIndex]] = [names[swapIndex], names[index]];
            }
            return names.slice(0, 3);
        } catch (error) {
            console.warn('Cannot load parties from party_candidates', error);
            return [];
        }
    }

    function renderNames(partyNames) {
        if (!isReferendum && Array.isArray(partyNames) && partyNames.length > 0) {
            if (partyNames[0]) {
                stakeholderNames[1] = `ตัวแทน${partyNames[0].startsWith('พรรค') ? '' : 'พรรค'}${partyNames[0]}`;
            }
            if (partyNames[1]) {
                stakeholderNames[2] = `ตัวแทน${partyNames[1].startsWith('พรรค') ? '' : 'พรรค'}${partyNames[1]}`;
            }
            if (partyNames[2]) {
                stakeholderNames[3] = `ตัวแทน${partyNames[2].startsWith('พรรค') ? '' : 'พรรค'}${partyNames[2]}`;
            }
        }

        stakeholderNames.forEach((name, index) => {
            const nameElement = document.getElementById(`name-${index + 1}`);
            if (nameElement) nameElement.textContent = `${index + 1}. ${name}`;
        });
    }

    function updateProgress() {
        const confirmedCount = state.completed ? 5 : 4;
        const percentage = confirmedCount * 20;
        const trackerLabel = document.getElementById('trackerLabel');
        const progressTrack = document.querySelector('.vu-main-progress-track');
        const progressFill = document.getElementById('mainProgressFill');

        if (trackerLabel) trackerLabel.textContent = `ส่งรหัสแล้ว ${confirmedCount} / 5 ฝ่าย`;
        if (progressTrack) progressTrack.setAttribute('aria-valuenow', String(percentage));
        if (progressFill) progressFill.style.width = `${percentage}%`;
    }

    function updateProcessProgressUI(percentage, statusText) {
        const clamped = Math.max(0, Math.min(100, Math.round(Number(percentage) || 0)));
        const step1Tag = document.getElementById('step1Tag');
        const step2Tag = document.getElementById('step2Tag');
        const step3Tag = document.getElementById('step3Tag');
        const processProgressTrack = document.querySelector('.vu-process-progress-track');
        const processProgressFill = document.getElementById('processProgressFill');

        if (step1Tag) step1Tag.textContent = 'สำเร็จ';
        if (step2Tag) step2Tag.textContent = 'สำเร็จ';
        if (step3Tag) step3Tag.textContent = statusText || `${clamped}%`;
        if (processProgressTrack) processProgressTrack.setAttribute('aria-valuenow', String(clamped));
        if (processProgressFill) processProgressFill.style.width = `${clamped}%`;
    }

    function renderStatus() {
        for (let number = 1; number <= 4; number += 1) {
            const reference = document.getElementById(`ref-${number}`);
            if (reference) reference.textContent = `(รหัสอ้างอิง: ${state.txRefs[number]})`;
        }

        const card = document.getElementById('card-5');
        const iconWrap = document.getElementById('iconWrap-5');
        const statusMain = document.getElementById('statusMain-5');
        const reference = document.getElementById('ref-5');
        const actionRow = document.getElementById('actionRow-5');
        const button = document.getElementById('btnSubmitCode');
        const canAccess = hasCitizenKeyAccess();

        if (state.completed) {
            if (card) card.classList.remove('vu-card--pending');
            if (iconWrap) {
                iconWrap.classList.remove('vu-card-icon-wrap--pending');
                iconWrap.innerHTML = '<i class="fa-solid fa-check vu-icon-check" aria-hidden="true"></i>';
            }
            if (statusMain) statusMain.textContent = 'สถานะ: ยืนยันรหัสปลดล็อกแล้ว';
            if (reference) {
                reference.textContent = `(รหัสอ้างอิง: ${state.txRefs[5]})`;
                reference.hidden = false;
            }
            if (actionRow) actionRow.style.display = 'none';
            if (button) button.hidden = true;
        } else {
            if (card) card.classList.add('vu-card--pending');
            if (iconWrap) {
                iconWrap.classList.add('vu-card-icon-wrap--pending');
                iconWrap.innerHTML = '<i class="fa-regular fa-circle vu-icon-circle" aria-hidden="true"></i>';
            }
            if (statusMain) statusMain.textContent = 'สถานะ: รอดำเนินการยืนยันรหัส';
            if (reference) {
                reference.textContent = '';
                reference.hidden = true;
            }
            if (actionRow) actionRow.style.display = canAccess ? '' : 'none';
            if (button) {
                button.hidden = !canAccess;
                button.disabled = !canAccess;
            }
        }

        updateProgress();
    }

    // =========================================================================
    // ขั้นที่ 1 & 2: Fisher-Yates Shuffle (Mixnet Shuffle)
    // =========================================================================
    function fisherYatesShuffle(items) {
        const array = Array.isArray(items) ? [...items] : [];
        for (let i = array.length - 1; i > 0; i -= 1) {
            let randomIndex;
            if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
                const randomBuffer = new Uint32Array(1);
                window.crypto.getRandomValues(randomBuffer);
                randomIndex = randomBuffer[0] % (i + 1);
            } else {
                randomIndex = Math.floor(Math.random() * (i + 1));
            }
            [array[i], array[randomIndex]] = [array[randomIndex], array[i]];
        }
        return array;
    }

    // =========================================================================
    // ขั้นที่ 3: ฟังก์ชันถอดรหัส AES-GCM (decryptTextWithAesGcm)
    // รองรับ Secret 'eLection-Threshold-Demo-Shared-Secret-2569' และ Legacy Key
    // =========================================================================
    async function buildAesKeys(secretString) {
        const encoder = new TextEncoder();
        const secrets = [...new Set([
            secretString || SHARED_SECRET,
            SHARED_SECRET,
            LEGACY_SECRET,
        ].filter(Boolean))];

        const keys = [];
        for (const sec of secrets) {
            // รูปแบบที่ 1: Raw 32-byte key (padEnd 32 ตัวอักษรแล้วตัด 32 bytes)
            try {
                const rawBytes = encoder.encode(String(sec).padEnd(32, '0')).slice(0, 32);
                const rawKey = await window.crypto.subtle.importKey(
                    'raw',
                    rawBytes,
                    { name: 'AES-GCM' },
                    false,
                    ['decrypt']
                );
                keys.push(rawKey);
            } catch {
                // Ignore key import error
            }

            // รูปแบบที่ 2: SHA-256 Digest ของ Secret
            try {
                const hashBuffer = await window.crypto.subtle.digest('SHA-256', encoder.encode(String(sec)));
                const shaKey = await window.crypto.subtle.importKey(
                    'raw',
                    hashBuffer,
                    { name: 'AES-GCM' },
                    false,
                    ['decrypt']
                );
                keys.push(shaKey);
            } catch {
                // Ignore key import error
            }
        }
        return keys;
    }

    function base64ToBytes(b64) {
        const binary = atob(String(b64).trim());
        return Uint8Array.from(binary, ch => ch.charCodeAt(0));
    }

    async function decryptTextWithAesGcm(value, secret = SHARED_SECRET) {
        if (value === null || value === undefined) return null;
        if (typeof value === 'number') return String(value);

        // กรณีเป็น Object ที่มี iv และ ciphertext แยกกัน
        if (typeof value === 'object') {
            if (value.iv && (value.ciphertext || value.data || value.encrypted)) {
                try {
                    const ivBytes = Array.isArray(value.iv)
                        ? new Uint8Array(value.iv)
                        : base64ToBytes(value.iv);
                    const cipherBytes = Array.isArray(value.ciphertext || value.data || value.encrypted)
                        ? new Uint8Array(value.ciphertext || value.data || value.encrypted)
                        : base64ToBytes(value.ciphertext || value.data || value.encrypted);
                    const keys = await buildAesKeys(secret);
                    for (const key of keys) {
                        try {
                            const decrypted = await window.crypto.subtle.decrypt(
                                { name: 'AES-GCM', iv: ivBytes },
                                key,
                                cipherBytes
                            );
                            return new TextDecoder().decode(decrypted);
                        } catch {
                            // ลองคีย์ถัดไป
                        }
                    }
                } catch {
                    return null;
                }
            }
            return null;
        }

        const str = String(value).trim();
        if (!str) return null;

        // กรณีเป็นรูปแบบ ENC[AES-GCM::<base64>]
        if (str.startsWith('ENC[AES-GCM::')) {
            const encoded = str.slice('ENC[AES-GCM::'.length).replace(/\]$/, '');
            try {
                const bytes = base64ToBytes(encoded);
                const iv = bytes.slice(0, 12);
                const ciphertext = bytes.slice(12);
                const keys = await buildAesKeys(secret);
                for (const key of keys) {
                    try {
                        const plaintext = await window.crypto.subtle.decrypt(
                            { name: 'AES-GCM', iv },
                            key,
                            ciphertext
                        );
                        return new TextDecoder().decode(plaintext);
                    } catch {
                        // ลองคีย์ถัดไป
                    }
                }
            } catch {
                return null;
            }
            return null;
        }

        // กรณีเป็นรูปแบบ ivBase64:cipherBase64
        if (str.includes(':') && !str.startsWith('{') && !str.startsWith('ENC[')) {
            const parts = str.split(':');
            if (parts.length === 2 && parts[0].length >= 12 && parts[1].length >= 16) {
                try {
                    const iv = base64ToBytes(parts[0]);
                    const ciphertext = base64ToBytes(parts[1]);
                    const keys = await buildAesKeys(secret);
                    for (const key of keys) {
                        try {
                            const plaintext = await window.crypto.subtle.decrypt(
                                { name: 'AES-GCM', iv },
                                key,
                                ciphertext
                            );
                            return new TextDecoder().decode(plaintext);
                        } catch {
                            // ลองคีย์ถัดไป
                        }
                    }
                } catch {
                    // ไม่ใช่ base64 คืนค่าปกติ
                }
            }
        }

        // กรณีเป็นค่าที่ถอดรหัสแล้ว หรือ Plaintext (เช่น '1', '2', 'abstain', 'approve', 'disapprove')
        return str;
    }

    const decryptBallotChoice = decryptTextWithAesGcm;

    function parseBallot(value) {
        if (value && typeof value === 'object') return value;
        if (typeof value === 'string') {
            try {
                return JSON.parse(value);
            } catch {
                return {};
            }
        }
        return {};
    }

    function createBallotId() {
        if (window.crypto?.randomUUID) return `BLT-${window.crypto.randomUUID()}`;
        const bytes = new Uint8Array(16);
        window.crypto.getRandomValues(bytes);
        return `BLT-${Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('')}`;
    }

    function normalizeMpChoiceValue(raw) {
        if (raw === null || raw === undefined) return null;
        const text = String(raw).trim();
        if (!text) return null;
        const lower = text.toLowerCase();
        if (lower === 'abstain' || lower === 'no_vote' || lower === 'ไม่ประสงค์ลงคะแนน' || lower === '0') {
            return 'abstain';
        }
        const parsed = Number.parseInt(text.replace(/[^0-9]/g, ''), 10);
        if (Number.isInteger(parsed) && parsed > 0) {
            return String(parsed);
        }
        return text;
    }

    function normalizeReferendumChoiceValue(raw) {
        if (raw === null || raw === undefined) return null;
        const text = String(raw).trim();
        if (!text) return null;

        if (text.startsWith('{')) {
            try {
                const parsed = JSON.parse(text);
                return normalizeReferendumChoiceValue(
                    parsed.decrypted_vote ?? parsed.choice ?? parsed.vote ?? parsed.value ?? parsed.ciphertext
                );
            } catch {
                // Ignore JSON parse error
            }
        }

        const lower = text.toLowerCase();
        if (['approve', 'yes', 'เห็นชอบ', '1', 'agree'].includes(lower)) return 'approve';
        if (['disapprove', 'no', 'ไม่เห็นชอบ', '2', 'disagree'].includes(lower)) return 'disapprove';
        if (['abstain', 'no opinion', 'no_opinion', 'ไม่แสดงความคิดเห็น', 'งดออกเสียง', 'ไม่ประสงค์ลงคะแนน', '0', '3'].includes(lower)) {
            return 'abstain';
        }
        return null;
    }

    // ตรวจสอบคอลัมน์ที่มีอยู่จริงของตาราง final_box และทำ Fallback ป้องกัน Error หากบางคอลัมน์ไม่มีใน DB
    const tableColumnCache = new Map();

    async function inspectTableColumns(client, tableName) {
        if (tableColumnCache.has(tableName)) {
            return tableColumnCache.get(tableName);
        }
        const info = {
            knownColumns: null,
            unsupportedColumns: new Set(),
        };
        try {
            const { data, error } = await client.from(tableName).select('*').limit(1);
            if (!error && Array.isArray(data) && data.length > 0 && data[0] && typeof data[0] === 'object') {
                info.knownColumns = new Set(Object.keys(data[0]));
            }
        } catch {
            // Ignore inspection error
        }
        tableColumnCache.set(tableName, info);
        return info;
    }

    function filterPayloadBySchema(payload, schemaInfo) {
        const result = {};
        for (const [key, value] of Object.entries(payload)) {
            if (value === undefined) continue;
            if (schemaInfo.unsupportedColumns.has(key)) continue;
            if (schemaInfo.knownColumns && !schemaInfo.knownColumns.has(key)) continue;
            result[key] = value;
        }
        return result;
    }

    function extractMissingColumnFromError(error) {
        const message = String(error?.message || error?.details || error?.hint || '');
        const match1 = message.match(/Could not find the '([^']+)' column/i);
        if (match1) return match1[1];
        const match2 = message.match(/column "([^"]+)" of relation/i);
        if (match2) return match2[1];
        const match3 = message.match(/column ([\w_]+) does not exist/i);
        if (match3) return match3[1];
        return null;
    }

    async function insertRowWithSchemaFallback(client, tableName, fullPayload, fallbackPayloads) {
        const schemaInfo = await inspectTableColumns(client, tableName);

        // พยายามบันทึกด้วย Adaptive Column Filtering (ตัดคอลัมน์ที่ไม่มีใน DB ออกอัตโนมัติ)
        for (let attempt = 0; attempt < 8; attempt += 1) {
            const candidatePayload = filterPayloadBySchema(fullPayload, schemaInfo);
            if (Object.keys(candidatePayload).length === 0) break;

            const { error } = await client.from(tableName).insert(candidatePayload);
            if (!error) return true;

            const missingCol = extractMissingColumnFromError(error);
            if (missingCol && !schemaInfo.unsupportedColumns.has(missingCol)) {
                schemaInfo.unsupportedColumns.add(missingCol);
                continue;
            }
            break;
        }

        // Fallback Payloads กรณีตารางมี Schema เฉพาะเจาะจง
        for (const fallback of fallbackPayloads) {
            const filtered = filterPayloadBySchema(fallback, schemaInfo);
            if (Object.keys(filtered).length === 0) continue;
            const { error } = await client.from(tableName).insert(filtered);
            if (!error) return true;

            const missingCol = extractMissingColumnFromError(error);
            if (missingCol) {
                schemaInfo.unsupportedColumns.add(missingCol);
            }
        }

        return false;
    }

    async function updateStagingStatusToCounted(client, stagingTable, stagingRef) {
        if (!stagingRef) return;

        const matchColumn = stagingRef.id !== undefined && stagingRef.id !== null
            ? 'id'
            : stagingRef.voter_id
                ? 'voter_id'
                : stagingRef.tracking_hash
                    ? 'tracking_hash'
                    : null;
        const matchValue = matchColumn ? stagingRef[matchColumn] : null;
        if (!matchColumn || matchValue === null || matchValue === undefined) return;

        // อัปเดต status เป็น 'COUNTED' ตามข้อกำหนด
        const { error } = await client
            .from(stagingTable)
            .update({ status: 'COUNTED' })
            .eq(matchColumn, matchValue);

        if (error) {
            // Fallback กรณี Database มี Constraint กำหนดค่า status
            await client
                .from(stagingTable)
                .update({ status: 'TALLIED' })
                .eq(matchColumn, matchValue);
        }
    }

    // =========================================================================
    // ฟังก์ชันหลัก: startDecryptionProcess()
    // ดึงบัตร ACTIVE -> ตัด voter_id -> Fisher-Yates Shuffle -> ถอดรหัส AES-GCM
    // -> ทยอย INSERT ลง final_box ตามหลอด Progress Bar -> อัปเดต status = 'COUNTED'
    // =========================================================================
    async function startDecryptionProcess() {
        if (isDecrypting) return;
        isDecrypting = true;

        const client = getSupabaseClient();
        updateProcessProgressUI(0, '0%');

        if (!client) {
            updateProcessProgressUI(0, 'เชื่อมต่อฐานข้อมูลไม่ได้');
            isDecrypting = false;
            return;
        }

        const stagingTable = isReferendum ? 'referendum_staging_box' : 'mp_staging_box';
        const finalTable = isReferendum ? 'referendum_final_box' : 'mp_final_box';

        try {
            // 2. ดึงข้อมูลที่ status = 'ACTIVE' จาก Staging Box
            const { data: activeBallots, error: fetchError } = await client
                .from(stagingTable)
                .select('*')
                .eq('status', 'ACTIVE');

            if (fetchError) throw fetchError;

            if (!activeBallots || activeBallots.length === 0) {
                // กรณีไม่มีบัตรค้างใน staging_box (หรือถูกนับเป็น COUNTED ครบหมดแล้ว) ให้วิ่งหลอดจนครบ 100%
                const steps = [25, 60, 100];
                for (const pct of steps) {
                    await new Promise(resolve => window.setTimeout(resolve, 180));
                    updateProcessProgressUI(pct, `${pct}%`);
                }
                isDecrypting = false;
                return;
            }

            // 3. ขั้นที่ 1 (ตัดข้อมูลตัวตน voter_id ทิ้ง) & ขั้นที่ 2 (Mixnet Fisher-Yates Shuffle)
            const stagingRefMap = new Map();
            const strippedBallots = activeBallots.map((row, index) => {
                const refToken = `stg_${index}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                stagingRefMap.set(refToken, {
                    id: row.id,
                    voter_id: row.voter_id,
                    tracking_hash: row.tracking_hash || row.tracking_code || null,
                });

                // ตัด voter_id ออกอย่างเด็ดขาด ไม่นำติดไปใน Payload
                return {
                    _refToken: refToken,
                    encrypted_ballot: row.encrypted_ballot,
                    district_code: row.district_code || 'BKK-01',
                    tracking_hash: row.tracking_hash || row.tracking_code || null,
                };
            });

            const shuffledBallots = fisherYatesShuffle(strippedBallots);

            // 4. ขั้นที่ 3: ถอดรหัสด้วย AES-GCM และทยอย INSERT ลง final_box เป็นชุดๆ ตามหลอด Progress Bar
            const totalBallots = shuffledBallots.length;
            const batchSize = totalBallots <= 12 ? 1 : Math.max(1, Math.ceil(totalBallots / 10));
            let processedCount = 0;
            let insertedCount = 0;

            for (let startIdx = 0; startIdx < totalBallots; startIdx += batchSize) {
                const batch = shuffledBallots.slice(startIdx, startIdx + batchSize);

                for (const ballot of batch) {
                    const stagingRef = stagingRefMap.get(ballot._refToken);
                    let envelope = parseBallot(ballot.encrypted_ballot);

                    // กรณี encrypted_ballot ทั้งก้อนเป็นสตริงเข้ารหัส AES-GCM
                    if (typeof ballot.encrypted_ballot === 'string' && ballot.encrypted_ballot.startsWith('ENC[AES-GCM::')) {
                        const decryptedWhole = await decryptTextWithAesGcm(ballot.encrypted_ballot, SHARED_SECRET);
                        const parsedWhole = parseBallot(decryptedWhole);
                        if (Object.keys(parsedWhole).length > 0) {
                            envelope = parsedWhole;
                        } else if (isReferendum && decryptedWhole) {
                            envelope = { choice: decryptedWhole };
                        }
                    }

                    const ballotId = createBallotId();
                    const countedAt = new Date().toISOString();
                    let inserted = false;

                    if (isReferendum) {
                        // กรณีประชามติ (referendum_final_box)
                        const rawCipher = envelope.ciphertext ?? envelope.choice ?? envelope.vote ?? envelope.decrypted_vote ?? ballot.encrypted_ballot;
                        const decryptedText = await decryptTextWithAesGcm(rawCipher, SHARED_SECRET);
                        const normalizedChoice = normalizeReferendumChoiceValue(decryptedText);

                        if (normalizedChoice) {
                            const fullRefPayload = {
                                ballot_id: ballotId,
                                decrypted_vote: normalizedChoice,
                                encrypted_ballot: ballot.encrypted_ballot,
                                tracking_hash: ballot.tracking_hash || undefined,
                                counted_at: countedAt,
                            };
                            const refFallbacks = [
                                {
                                    ballot_id: ballotId,
                                    decrypted_vote: normalizedChoice,
                                    encrypted_ballot: ballot.encrypted_ballot,
                                    counted_at: countedAt,
                                },
                                {
                                    decrypted_vote: normalizedChoice,
                                    encrypted_ballot: ballot.encrypted_ballot,
                                },
                            ];
                            inserted = await insertRowWithSchemaFallback(client, finalTable, fullRefPayload, refFallbacks);
                        }
                    } else {
                        // กรณีเลือกตั้ง ส.ส. (mp_final_box)
                        const rawConstituency = envelope.constituency ?? envelope.candidate_number ?? envelope.candidate ?? envelope.b1;
                        const rawPartyList = envelope.partyList ?? envelope.party_list ?? envelope.party_number ?? envelope.party ?? envelope.b2;

                        const [decryptedConstituency, decryptedPartyList] = await Promise.all([
                            decryptTextWithAesGcm(rawConstituency, SHARED_SECRET),
                            decryptTextWithAesGcm(rawPartyList, SHARED_SECRET),
                        ]);

                        const constituencyChoice = normalizeMpChoiceValue(decryptedConstituency);
                        const partyListChoice = normalizeMpChoiceValue(decryptedPartyList);

                        if (constituencyChoice && partyListChoice) {
                            const candidateNumInt = constituencyChoice === 'abstain'
                                ? null
                                : Number.parseInt(constituencyChoice, 10);
                            const partyNumInt = partyListChoice === 'abstain'
                                ? null
                                : Number.parseInt(partyListChoice, 10);

                            const decryptedBallotData = {
                                constituency: constituencyChoice,
                                partyList: partyListChoice,
                            };

                            const fullMpPayload = {
                                ballot_id: ballotId,
                                district_code: ballot.district_code || 'BKK-01',
                                candidate_number: Number.isInteger(candidateNumInt) ? candidateNumInt : undefined,
                                party_number: Number.isInteger(partyNumInt) ? partyNumInt : undefined,
                                decrypted_vote: JSON.stringify(decryptedBallotData),
                                encrypted_ballot: decryptedBallotData,
                                tracking_hash: ballot.tracking_hash || undefined,
                                counted_at: countedAt,
                            };

                            const mpFallbacks = [
                                {
                                    ballot_id: ballotId,
                                    district_code: ballot.district_code || 'BKK-01',
                                    decrypted_vote: decryptedBallotData,
                                    encrypted_ballot: decryptedBallotData,
                                    counted_at: countedAt,
                                },
                                {
                                    ballot_id: ballotId,
                                    district_code: ballot.district_code || 'BKK-01',
                                    encrypted_ballot: decryptedBallotData,
                                    counted_at: countedAt,
                                },
                                {
                                    district_code: ballot.district_code || 'BKK-01',
                                    encrypted_ballot: decryptedBallotData,
                                },
                            ];

                            inserted = await insertRowWithSchemaFallback(client, finalTable, fullMpPayload, mpFallbacks);
                        }
                    }

                    if (inserted) {
                        insertedCount += 1;
                        await updateStagingStatusToCounted(client, stagingTable, stagingRef);
                    }

                    processedCount += 1;
                }

                const percentage = Math.min(100, Math.round((processedCount / totalBallots) * 100));
                updateProcessProgressUI(percentage, `${percentage}%`);

                if (processedCount < totalBallots) {
                    await new Promise(resolve => window.setTimeout(resolve, 300));
                }
            }

            updateProcessProgressUI(100, '100%');
            console.log(`[VoteUnlock] ถอดรหัสและย้ายบัตรเข้า ${finalTable} สำเร็จ ${insertedCount}/${totalBallots} ใบ`);
        } catch (error) {
            console.error(`Could not process ballots from ${stagingTable}`, error);
            updateProcessProgressUI(0, 'ประมวลผลไม่สำเร็จ');
        } finally {
            isDecrypting = false;
        }
    }

    const processStagingBallots = startDecryptionProcess;

    async function submitUnlockCode() {
        if (!hasCitizenKeyAccess() || isDecrypting) return;

        const usedIds = new Set(
            Object.values(state.txRefs)
                .map(ref => Number.parseInt(String(ref).slice(-4), 16))
                .filter(Number.isFinite)
        );
        state.txRefs[5] = generateTxId(usedIds);
        state.completed = true;
        saveState();
        renderStatus();
        await startDecryptionProcess();
    }

    function init() {
        const backLink = document.getElementById('backLink');
        if (backLink) backLink.href = `Vote-Status.html?id=${encodeURIComponent(eventKey)}`;

        const button = document.getElementById('btnSubmitCode');
        if (button) button.addEventListener('click', submitUnlockCode);

        renderNames([]);
        renderStatus();
        updateProcessProgressUI(0, '0%');

        if (!isReferendum) {
            getRandomPartyNames().then(renderNames);
        }
    }

    // Export ฟังก์ชันสำหรับเรียกใช้งานหรือทดสอบผ่าน Console
    window.hasCitizenKeyAccess = hasCitizenKeyAccess;
    window.decryptTextWithAesGcm = decryptTextWithAesGcm;
    window.startDecryptionProcess = startDecryptionProcess;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
