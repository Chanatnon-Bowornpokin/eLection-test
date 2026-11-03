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
    const stateKey = `election_unlock_approvals_${eventKey}`;

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
     * การจัดการสิทธิ์ผ่าน URL Parameter:
     * - หากเข้าหน้าเว็บโดยไม่มี ?role=... หรือไม่ตรง ให้เป็น Observer Mode (ผู้สังเกตการณ์) ดูสถานะได้อย่างเดียว ไม่มีปุ่มกดส่งรหัส
     * - หากระบุ ?role=... ที่ถูกต้อง ให้แสดงบทบาทของตนเองพร้อมปุ่ม [ ส่งรหัส ] เฉพาะฝ่ายนั้น
     */
    function resolveUserRole(rawRole, isRef) {
        if (!rawRole) return null;
        const r = String(rawRole).trim().toLowerCase();
        if (!r) return null;

        if (r === '1' || r === 'ect' || r === 'role1' || r === 'party1' || r === 'กกต') return 1;

        if (isRef) {
            if (r === '2' || r === 'parliament' || r === 'parliament_rep' || r === 'role2' || r === 'party2' || r === 'รัฐสภา') return 2;
            if (r === '3' || r === 'citizen_1' || r === 'citizen1' || r === 'role3' || r === 'party3' || r === 'observer_1') return 3;
            if (r === '4' || r === 'citizen_2' || r === 'citizen2' || r === 'role4' || r === 'party4' || r === 'observer_2') return 4;
            if (r === '5' || r === 'citizen_3' || r === 'citizen3' || r === 'citizen' || r === 'citizen_key' || r === 'role5' || r === 'party5' || r === 'observer_3') return 5;
        } else {
            if (r === '2' || r === 'party_a' || r === 'partya' || r === 'role2' || r === 'party2' || r === 'party_1') return 2;
            if (r === '3' || r === 'party_b' || r === 'partyb' || r === 'role3' || r === 'party3' || r === 'party_2') return 3;
            if (r === '4' || r === 'party_c' || r === 'partyc' || r === 'role4' || r === 'party4' || r === 'party_3') return 4;
            if (r === '5' || r === 'citizen' || r === 'citizen_key' || r === 'observer' || r === 'people' || r === 'role5' || r === 'party5') return 5;
        }
        return null;
    }

    const userRoleIndex = resolveUserRole(urlParams.get('role'), isReferendum);

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
        const saved = safeReadJson(window.localStorage, stateKey, null);
        if (saved && Array.isArray(saved.approved) && saved.txRefs) {
            return {
                completed: !!saved.completed,
                approved: saved.approved,
                txRefs: saved.txRefs,
            };
        }

        // สถานะเริ่มต้น: ฝ่ายที่ 1 (กกต.) และฝ่ายที่ 3 (พรรค ข / ผู้แทนประชาชน 1) ยืนยันรหัสแล้ว (2/5 ฝ่าย = 40%)
        // รอการยืนยันเพิ่มจากฝ่ายที่ 2, 4 หรือ 5 เพื่อให้ครบเกณฑ์อย่างน้อย 3 ใน 5 ฝ่าย (>= 60%)
        const usedIds = new Set();
        const txRefs = {
            1: generateTxId(usedIds),
            3: generateTxId(usedIds),
        };

        return {
            completed: false,
            approved: [1, 3],
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

    /**
     * ดึงชื่อพรรคการเมือง 3 พรรคแบบ Deterministic จาก party_candidates (Shared State เรียงตาม party_number)
     * ห้ามใช้ Math.random() สุ่มในเบราว์เซอร์
     */
    async function getDeterministicPartyNames() {
        const client = getSupabaseClient();
        if (!client) return [];

        try {
            const { data, error } = await client
                .from('party_candidates')
                .select('*')
                .order('party_number', { ascending: true });
            if (error) throw error;

            const names = [...new Set((data || []).map(partyNameFromRow).filter(Boolean))];
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
            const roleNum = index + 1;
            const nameElement = document.getElementById(`name-${roleNum}`);
            if (nameElement) {
                const isUserRole = userRoleIndex === roleNum;
                nameElement.textContent = `${roleNum}. ${name}${isUserRole ? ' (บทบาทของคุณ)' : ''}`;
            }
        });
    }

    function updateProgress() {
        const confirmedCount = state.approved.length;
        const percentage = Math.min(100, confirmedCount * 20);
        const trackerLabel = document.getElementById('trackerLabel');
        const progressTrack = document.querySelector('.vu-main-progress-track');
        const progressFill = document.getElementById('mainProgressFill');

        if (trackerLabel) trackerLabel.textContent = `ส่งรหัสแล้ว ${confirmedCount} / 5 ฝ่าย`;
        if (progressTrack) progressTrack.setAttribute('aria-valuenow', String(percentage));
        if (progressFill) progressFill.style.width = `${percentage}%`;
    }

    /**
     * รีเซ็ตสถานะ Standby ของกล่องล่าง:
     * - หัวข้อ: "รอการรวมรหัสเพื่อเริ่มประมวลผล"
     * - ขั้นตอนที่ 1, 2, 3: "รอดำเนินการ" ตัวหนังสือสีเทา #6B7280
     * - แถบความคืบหน้า: 0%
     */
    function resetStandbyUI() {
        const processHeader = document.getElementById('processHeader');
        if (processHeader) {
            processHeader.innerHTML = 'รอการรวมรหัสเพื่อเริ่มประมวลผล';
        }

        const step1Tag = document.getElementById('step1Tag');
        if (step1Tag) {
            step1Tag.textContent = 'รอดำเนินการ';
            step1Tag.style.color = '#6B7280';
            step1Tag.style.fontWeight = '400';
            step1Tag.style.width = 'auto';
        }

        const step2Tag = document.getElementById('step2Tag');
        if (step2Tag) {
            step2Tag.textContent = 'รอดำเนินการ';
            step2Tag.style.color = '#6B7280';
            step2Tag.style.fontWeight = '400';
            step2Tag.style.width = 'auto';
        }

        const step3Tag = document.getElementById('step3Tag');
        if (step3Tag) {
            step3Tag.textContent = 'รอดำเนินการ';
            step3Tag.style.color = '#6B7280';
            step3Tag.style.fontWeight = '400';
            step3Tag.style.width = 'auto';
        }

        const processProgressTrack = document.querySelector('.vu-process-progress-track');
        if (processProgressTrack) processProgressTrack.setAttribute('aria-valuenow', '0');

        const processProgressFill = document.getElementById('processProgressFill');
        if (processProgressFill) processProgressFill.style.width = '0%';
    }

    // ฟังก์ชันอัปเดตสถานะขั้นตอนล่าง โดยใช้สีระบบมาตรฐาน #000000 (ตัดสีเขียว #16A34A / #10B981 ออกทั้งหมด)
    function updateStep1UI(statusText, color = '#000000') {
        const step1Tag = document.getElementById('step1Tag');
        if (step1Tag) {
            step1Tag.textContent = statusText;
            step1Tag.style.color = color;
            step1Tag.style.fontWeight = statusText === 'สำเร็จ' ? '600' : '400';
            step1Tag.style.width = 'auto';
        }
    }

    function updateStep2UI(statusText, color = '#000000') {
        const step2Tag = document.getElementById('step2Tag');
        if (step2Tag) {
            step2Tag.textContent = statusText;
            step2Tag.style.color = color;
            step2Tag.style.fontWeight = statusText === 'สำเร็จ' ? '600' : '400';
            step2Tag.style.width = 'auto';
        }
    }

    function updateStep3UI(percentage, statusText, color = '#000000') {
        const clamped = Math.max(0, Math.min(100, Math.round(Number(percentage) || 0)));
        const step3Tag = document.getElementById('step3Tag');
        const processProgressTrack = document.querySelector('.vu-process-progress-track');
        const processProgressFill = document.getElementById('processProgressFill');

        if (step3Tag) {
            step3Tag.textContent = statusText || `${clamped}%`;
            step3Tag.style.color = color;
            step3Tag.style.fontWeight = clamped >= 100 ? '600' : '400';
            step3Tag.style.width = 'auto';
        }
        if (processProgressTrack) processProgressTrack.setAttribute('aria-valuenow', String(clamped));
        if (processProgressFill) processProgressFill.style.width = `${clamped}%`;
    }

    /**
     * เรนเดอร์การ์ดทั้ง 5 ฝ่ายตามสถานะการส่งรหัส และ URL role
     */
    function renderStatus() {
        for (let i = 1; i <= 5; i += 1) {
            const isApproved = state.approved.includes(i);
            const isMyRole = userRoleIndex === i;

            const card = document.getElementById(`card-${i}`);
            const iconWrap = document.getElementById(`iconWrap-${i}`);
            const statusRow = document.getElementById(`statusRow-${i}`);
            const statusMain = document.getElementById(`statusMain-${i}`);
            const ref = document.getElementById(`ref-${i}`);
            const actionRow = document.getElementById(`actionRow-${i}`);
            const button = document.getElementById(`btnSubmitCode-${i}`);

            if (isApproved) {
                if (card) card.classList.remove('vu-card--pending');
                if (iconWrap) {
                    iconWrap.classList.remove('vu-card-icon-wrap--pending');
                    iconWrap.innerHTML = '<i class="fa-solid fa-check vu-icon-check" aria-hidden="true"></i>';
                }
                if (statusRow) statusRow.classList.remove('vu-card-status-row--pending');
                if (statusMain) statusMain.textContent = 'สถานะ: ยืนยันรหัสปลดล็อกแล้ว';
                if (ref) {
                    ref.textContent = `(รหัสอ้างอิง: ${state.txRefs[i] || ''})`;
                    ref.hidden = false;
                }
                if (actionRow) actionRow.style.display = 'none';
                if (button) {
                    button.hidden = true;
                    button.disabled = true;
                }
            } else {
                if (card) card.classList.add('vu-card--pending');
                if (iconWrap) {
                    iconWrap.classList.add('vu-card-icon-wrap--pending');
                    iconWrap.innerHTML = '<i class="fa-regular fa-circle vu-icon-circle" aria-hidden="true"></i>';
                }
                if (statusRow) statusRow.classList.add('vu-card-status-row--pending');
                if (statusMain) statusMain.textContent = 'สถานะ: รอดำเนินการยืนยันรหัส';
                if (ref) {
                    ref.textContent = '';
                    ref.hidden = true;
                }

                // แสดงปุ่ม [ ส่งรหัส ] เฉพาะฝ่ายที่เป็นบทบาทของผู้ใช้เท่านั้น (หากเป็น Observer หรือบทบาทอื่นให้ซ่อน)
                if (isMyRole) {
                    if (actionRow) actionRow.style.display = '';
                    if (button) {
                        button.hidden = false;
                        button.disabled = isDecrypting || state.completed;
                        button.textContent = 'ส่งรหัส';
                    }
                } else {
                    if (actionRow) actionRow.style.display = 'none';
                    if (button) {
                        button.hidden = true;
                        button.disabled = true;
                    }
                }
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
    // ขั้นที่ 3: ฟังก์ชันถอดรหัส AES-GCM
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
                            // Try next key
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
                        // Try next key
                    }
                }
            } catch {
                return null;
            }
            return null;
        }

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
                            // Try next key
                        }
                    }
                } catch {
                    // Not base64
                }
            }
        }

        return str;
    }

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
        if (lower === 'abstain' || lower === 'no_vote' || lower === 'ไม่ประสงค์ลงคะแนน' || lower === 'งดออกเสียง' || lower === '0') {
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
        if (!client || !stagingRef) return;

        const matchColumn = stagingRef.id !== undefined && stagingRef.id !== null
            ? 'id'
            : stagingRef.voter_id
                ? 'voter_id'
                : stagingRef.tracking_hash
                    ? 'tracking_hash'
                    : null;
        const matchValue = matchColumn ? stagingRef[matchColumn] : null;
        if (!matchColumn || matchValue === null || matchValue === undefined) return;

        try {
            const { error } = await client
                .from(stagingTable)
                .update({
                    status: 'COUNTED',
                    encrypted_ballot: null // Purge ก้อนบัตรออกจาก staging box ทันที
                })
                .eq(matchColumn, matchValue);

            if (error) {
                await client
                    .from(stagingTable)
                    .update({ status: 'COUNTED' })
                    .eq(matchColumn, matchValue);
            }
        } catch (err) {
            console.warn('Update staging status error:', err);
        }
    }

    // =========================================================================
    // ฟังก์ชันหลัก: startDecryptionProcess()
    // ดำเนินการเมื่อยืนยันรหัสครบตามเกณฑ์ (>= 3 ใน 5 ฝ่าย หรือ 60%)
    // พยายามเรียก Database RPC บน Supabase ก่อน หากไม่พบค่อย Fallback ไปยัง Direct Queries
    // =========================================================================
    async function startDecryptionProcess() {
        if (isDecrypting) return;
        if (state.approved.length < 3) {
            console.warn('[VoteUnlock] เกณฑ์การปลดล็อกยังไม่ครบ (ต้องการอย่างน้อย 3 ใน 5 ฝ่าย)');
            return;
        }
        isDecrypting = true;

        const client = getSupabaseClient();
        const stagingTable = isReferendum ? 'referendum_staging_box' : 'mp_staging_box';
        const finalTable = isReferendum ? 'referendum_final_box' : 'mp_final_box';

        try {
            // Step 1: แสดงสถานะ "กำลังตัดข้อมูลตัวตน..."
            updateStep1UI('กำลังตัดข้อมูลตัวตน...', '#2563EB');
            await new Promise(resolve => window.setTimeout(resolve, 600));

            // พยายามเรียก Supabase RPC ฟังก์ชัน server-side process_decryption_threshold ก่อน
            let rpcSucceeded = false;
            if (client) {
                try {
                    const rpcApprovals = state.approved.map(idx => stakeholderNames[idx - 1] || `Party-${idx}`);
                    const { data: rpcData, error: rpcError } = await client.rpc('process_decryption_threshold', {
                        p_event_type: eventId,
                        p_approvals: rpcApprovals
                    });
                    if (!rpcError && rpcData && rpcData.success) {
                        rpcSucceeded = true;
                        console.log('[VoteUnlock] Server-side RPC process_decryption_threshold completed:', rpcData);
                    }
                } catch (rpcErr) {
                    console.info('[VoteUnlock] Fallback to direct client-side database query flow:', rpcErr);
                }
            }

            // ตัดข้อมูลตัวตน (voter_id) ออกอย่างเด็ดขาด
            updateStep1UI('สำเร็จ', '#000000');
            await new Promise(resolve => window.setTimeout(resolve, 400));

            // Step 2: แสดงสถานะ "กำลังสลับลำดับบัตร..."
            updateStep2UI('กำลังสลับลำดับบัตร...', '#2563EB');
            await new Promise(resolve => window.setTimeout(resolve, 600));

            // หาก RPC ยังไม่ได้ทำงานบน Server ให้ดึงบัตร ACTIVE และรันกระบวนการย้ายเข้า final_box
            let activeBallots = [];
            if (!rpcSucceeded && client) {
                const { data, error: fetchError } = await client
                    .from(stagingTable)
                    .select('*')
                    .eq('status', 'ACTIVE');
                if (!fetchError && Array.isArray(data)) {
                    activeBallots = data;
                }
            }

            const stagingRefMap = new Map();
            const strippedBallots = activeBallots.map((row, index) => {
                const refToken = `stg_${index}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                stagingRefMap.set(refToken, {
                    id: row.id,
                    voter_id: row.voter_id,
                    tracking_hash: row.tracking_hash || row.tracking_code || null,
                });

                return {
                    _refToken: refToken,
                    encrypted_ballot: row.encrypted_ballot,
                    district_code: row.district_code || 'BKK-01',
                    tracking_hash: row.tracking_hash || row.tracking_code || null,
                };
            });

            const shuffledBallots = fisherYatesShuffle(strippedBallots);
            updateStep2UI('สำเร็จ', '#000000');
            await new Promise(resolve => window.setTimeout(resolve, 400));

            // Step 3: ถอดรหัสบัตรลงคะแนนและทยอยนำเข้า final_box พร้อมปรับ Progress Bar
            updateStep3UI(0, '0%', '#000000');

            if (rpcSucceeded || shuffledBallots.length === 0) {
                // อนิเมชันจำลองการขยับของหลอดความคืบหน้าอย่างนุ่มนวล
                const steps = [20, 45, 75, 95, 100];
                for (const pct of steps) {
                    await new Promise(resolve => window.setTimeout(resolve, 250));
                    updateStep3UI(pct, `${pct}%`, '#000000');
                }
            } else {
                const totalBallots = shuffledBallots.length;
                let processedCount = 0;
                let insertedCount = 0;
                const batchSize = totalBallots <= 12 ? 1 : Math.max(1, Math.ceil(totalBallots / 10));

                for (let startIdx = 0; startIdx < totalBallots; startIdx += batchSize) {
                    const batch = shuffledBallots.slice(startIdx, startIdx + batchSize);

                    for (const ballot of batch) {
                        const stagingRef = stagingRefMap.get(ballot._refToken);
                        let envelope = parseBallot(ballot.encrypted_ballot);

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
                                if (client) {
                                    inserted = await insertRowWithSchemaFallback(client, finalTable, fullRefPayload, refFallbacks);
                                }
                            }
                        } else {
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

                                if (client) {
                                    inserted = await insertRowWithSchemaFallback(client, finalTable, fullMpPayload, mpFallbacks);
                                }
                            }
                        }

                        if (inserted) {
                            insertedCount += 1;
                            if (client) {
                                await updateStagingStatusToCounted(client, stagingTable, stagingRef);
                            }
                        }

                        processedCount += 1;
                    }

                    const percentage = Math.min(100, Math.round((processedCount / totalBallots) * 100));
                    updateStep3UI(percentage, `${percentage}%`, '#000000');

                    if (processedCount < totalBallots) {
                        await new Promise(resolve => window.setTimeout(resolve, 200));
                    }
                }

                console.log(`[VoteUnlock] บันทึกคะแนนลง ${finalTable} สำเร็จ ${insertedCount}/${totalBallots} ใบ (Purged in Staging Box)`);
            }

            updateStep3UI(100, '100%', '#000000');
            state.completed = true;
            saveState();

            const processHeader = document.getElementById('processHeader');
            if (processHeader) {
                processHeader.innerHTML = 'ประมวลผลและเปิดหีบสำเร็จ<br class="vu-br-mobile"> (นำเข้าสู่การนับคะแนนสดแล้ว)';
            }
        } catch (error) {
            console.error(`Could not process ballots from ${stagingTable}`, error);
            updateStep3UI(0, 'ประมวลผลไม่สำเร็จ', '#EF4444');
        } finally {
            isDecrypting = false;
        }
    }

    /**
     * ดำเนินการเมื่อผู้ใช้กดปุ่ม [ ส่งรหัส ] ในบทบาทของตนเอง
     */
    async function submitUnlockCodeForRole(roleIndex) {
        if (state.approved.includes(roleIndex) || isDecrypting || state.completed) return;

        // ล็อกปุ่มและเปลี่ยนข้อความทันที
        const button = document.getElementById(`btnSubmitCode-${roleIndex}`);
        if (button) {
            button.disabled = true;
            button.textContent = 'ส่งรหัสแล้ว';
        }

        const usedIds = new Set(
            Object.values(state.txRefs)
                .map(ref => Number.parseInt(String(ref).replace(/^#TX-/, ''), 16))
                .filter(Number.isFinite)
        );
        state.txRefs[roleIndex] = generateTxId(usedIds);
        if (!state.approved.includes(roleIndex)) {
            state.approved.push(roleIndex);
        }
        saveState();

        renderStatus();

        // ตรวจสอบเกณฑ์ปลดล็อก: เมื่อยืนยันรหัสครบอย่างน้อย 3 ใน 5 ฝ่าย (>= 60%)
        if (state.approved.length >= 3) {
            const processHeader = document.getElementById('processHeader');
            if (processHeader) {
                processHeader.innerHTML = 'รวมรหัสครบตามเกณฑ์แล้ว<br class="vu-br-mobile"> (ระบบกำลังเริ่มประมวลผลอัตโนมัติ)';
            }
            await startDecryptionProcess();
        }
    }

    function init() {
        const backLink = document.getElementById('backLink');
        if (backLink) backLink.href = `Vote-Status.html?id=${encodeURIComponent(eventKey)}`;

        // ผูก Event Listener ปุ่มส่งรหัสของแต่ละการ์ด (1 ถึง 5)
        for (let i = 1; i <= 5; i += 1) {
            const button = document.getElementById(`btnSubmitCode-${i}`);
            if (button) {
                button.addEventListener('click', () => submitUnlockCodeForRole(i));
            }
        }

        // Backward compatibility สำหรับโค้ดที่ query #btnSubmitCode
        const legacyBtn = document.getElementById('btnSubmitCode');
        if (legacyBtn && !legacyBtn.id.includes('-')) {
            legacyBtn.addEventListener('click', () => {
                if (userRoleIndex) submitUnlockCodeForRole(userRoleIndex);
                else submitUnlockCodeForRole(5);
            });
        }

        renderNames([]);
        renderStatus();

        if (state.completed) {
            updateStep1UI('สำเร็จ', '#000000');
            updateStep2UI('สำเร็จ', '#000000');
            updateStep3UI(100, '100%', '#000000');
            const processHeader = document.getElementById('processHeader');
            if (processHeader) {
                processHeader.innerHTML = 'ประมวลผลและเปิดหีบสำเร็จ<br class="vu-br-mobile"> (นำเข้าสู่การนับคะแนนสดแล้ว)';
            }
        } else if (state.approved.length >= 3) {
            startDecryptionProcess();
        } else {
            resetStandbyUI();
        }

        if (!isReferendum) {
            getDeterministicPartyNames().then(renderNames);
        }
    }

    // Export สำหรับทดสอบหรือเรียกผ่าน Console
    window.hasCitizenKeyAccess = () => Boolean(userRoleIndex);
    window.decryptTextWithAesGcm = decryptTextWithAesGcm;
    window.startDecryptionProcess = startDecryptionProcess;
    window.submitUnlockCodeForRole = submitUnlockCodeForRole;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
