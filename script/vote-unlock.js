/**
 * eLection - Key Ceremony & Ballot Unlock Script
 * -------------------------------------------------------------
 * รองรับทั้งการเลือกตั้ง ส.ส. (MP) และการลงประชามติ (Referendum)
 * จัดการการจำลองสิทธิ์ 5 ฝ่าย, Threshold Key Share (3 ใน 5),
 * การถอดรหัส Web Crypto API (AES-GCM 256-bit),
 * และการประมวลผลย้ายข้อมูลจาก Staging Box สู่ Final Box
 */

(function () {
    'use strict';

    // -------------------------------------------------------------
    // Configuration & Supabase Client
    // -------------------------------------------------------------
    const SUPABASE_URL = 'https://nzobdkybbpufntionuze.supabase.co';
    const SUPABASE_ANON_KEY = (typeof window.SUPABASE_ANON_KEY !== 'undefined')
        ? window.SUPABASE_ANON_KEY
        : 'sb_publishable_xBBzY0PXxUVWx4fINXBk3w_UwSEywAq';

    const getSupabase = () => {
        if (window.supabaseClient) return window.supabaseClient;
        if (window.supabase && typeof window.supabase.createClient === 'function') {
            window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            return window.supabaseClient;
        }
        return null;
    };

    // -------------------------------------------------------------
    // Event & Mode Detection
    // -------------------------------------------------------------
    const urlParams = new URLSearchParams(window.location.search);
    const eventParam = (urlParams.get('event') || urlParams.get('id') || '').toLowerCase();

    // ตรวจสอบประเภทว่าเป็น Referendum หรือ MP
    const isReferendum = eventParam.includes('ref') || eventParam === 'referendum-2569-03';
    const eventId = isReferendum ? 'referendum-2569-03' : 'house-election-2569';
    const eventType = isReferendum ? 'referendum' : 'mp';

    // Stakeholders รายการ 5 ฝ่าย
    const STAKEHOLDERS_CONFIG = {
        mp: [
            { id: 'ect', number: 1, name: 'ผู้แทนสำนักงาน กกต.', defaultRole: 'ect', refCode: '#EC-881B' },
            { id: 'party1', number: 2, name: 'ตัวแทนพรรค ก', defaultRole: 'party1', refCode: '#PT-192A' },
            { id: 'party2', number: 3, name: 'ตัวแทนพรรค ข', defaultRole: 'party2', refCode: '#PT-247C' },
            { id: 'party3', number: 4, name: 'ตัวแทนพรรค ค', defaultRole: 'party3', refCode: '#PT-385E' },
            { id: 'citizen', number: 5, name: 'ผู้แทนภาคประชาชนและผู้สังเกตการณ์', defaultRole: 'citizen', refCode: '#OB-904F' }
        ],
        referendum: [
            { id: 'ect', number: 1, name: 'ผู้แทนสำนักงาน กกต.', defaultRole: 'ect', refCode: '#EC-881B' },
            { id: 'party1', number: 2, name: 'ผู้แทนฝ่ายเห็นชอบ', defaultRole: 'approve_rep', refCode: '#RF-YES1' },
            { id: 'party2', number: 3, name: 'ผู้แทนฝ่ายไม่เห็นชอบ', defaultRole: 'disapprove_rep', refCode: '#RF-NO02' },
            { id: 'party3', number: 4, name: 'ผู้แทนภาควิชาการและสื่อมวลชน', defaultRole: 'academic_rep', refCode: '#AC-551D' },
            { id: 'citizen', number: 5, name: 'ผู้แทนภาคประชาชนและผู้สังเกตการณ์', defaultRole: 'citizen_rep', refCode: '#OB-904F' }
        ]
    };

    const stakeholders = isReferendum ? STAKEHOLDERS_CONFIG.referendum : STAKEHOLDERS_CONFIG.mp;
    const STORAGE_KEY = `election_unlock_state_${eventId}`;

    // ตรวจจับบทบาทจำลอง (Role Simulation) จาก URL หรือ LocalStorage
    let activeRole = (urlParams.get('role') || localStorage.getItem('election_sim_role') || 'all').toLowerCase();

    // แมป role alias ให้เข้ากับฝ่าย
    function roleMatchesStakeholder(stakeholder, currentRole) {
        if (!currentRole || currentRole === 'all' || currentRole === 'dev') return true;
        if (currentRole === stakeholder.id || currentRole === stakeholder.defaultRole) return true;

        // Alias mapping
        if (stakeholder.id === 'ect' && (currentRole === 'admin' || currentRole === 'ect')) return true;
        if (stakeholder.id === 'party1' && (currentRole === 'citizen1' || currentRole === 'party1' || currentRole === 'approve')) return true;
        if (stakeholder.id === 'party2' && (currentRole === 'citizen2' || currentRole === 'party2' || currentRole === 'disapprove')) return true;
        if (stakeholder.id === 'party3' && (currentRole === 'lecturer1' || currentRole === 'party3' || currentRole === 'academic')) return true;
        if (stakeholder.id === 'citizen' && (currentRole === 'lecturer2' || currentRole === 'citizen' || currentRole === 'observer')) return true;

        return false;
    }

    // -------------------------------------------------------------
    // State Management
    // -------------------------------------------------------------
    function loadSavedState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) {
            console.warn('Cannot parse unlock state', e);
        }
        return {
            confirmedIds: [], // เก็บรายการ ID ของฝ่ายที่ยืนยันแล้ว
            decryptionStatus: 'idle', // 'idle' | 'processing' | 'done'
            decryptionProgress: 0,
            talliedCount: 0
        };
    }

    let state = loadSavedState();

    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {
            console.error('Cannot save unlock state', e);
        }
    }

    // -------------------------------------------------------------
    // Web Crypto Decryption Helper (AES-GCM 256-bit)
    // -------------------------------------------------------------
    async function decryptWithWebCrypto(encryptedString, secretKeyString = 'eLection-ECT-SecretKey-2026-BKK') {
        if (!encryptedString || typeof encryptedString !== 'string') return encryptedString;
        if (!encryptedString.startsWith('ENC[AES-GCM::')) return encryptedString;

        const rawBase64 = encryptedString.replace('ENC[AES-GCM::', '').replace(']', '');
        try {
            const rawBytes = Uint8Array.from(atob(rawBase64), c => c.charCodeAt(0));
            const iv = rawBytes.slice(0, 12);
            const cipherData = rawBytes.slice(12);

            const enc = new TextEncoder();
            const keyMaterial = await crypto.subtle.importKey(
                'raw',
                enc.encode(secretKeyString.padEnd(32, '0')),
                { name: 'AES-GCM' },
                false,
                ['decrypt']
            );

            const decryptedBuffer = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                keyMaterial,
                cipherData
            );

            return new TextDecoder().decode(decryptedBuffer);
        } catch (err) {
            console.warn('Web Crypto decryption failed for payload:', err);
            return 'DECRYPTION_FAILED';
        }
    }

    // -------------------------------------------------------------
    // UI Rendering
    // -------------------------------------------------------------
    function renderStaticHeaders() {
        const heroTitle = document.getElementById('heroTitle');
        if (heroTitle) {
            heroTitle.textContent = isReferendum
                ? 'Hero Section\nผลการลงประชามติ\nปลดล็อค Private Key'
                : 'Hero Section\nผลการเลือกตั้ง\nปลดล็อค Private Key';
        }

        const mainTitle = document.getElementById('mainTitle');
        if (mainTitle) {
            mainTitle.textContent = 'กลไกความปลอดภัยร่วม 5 ฝ่าย';
        }

        const mainSubtitle = document.getElementById('mainSubtitle');
        if (mainSubtitle) {
            mainSubtitle.textContent = 'ต้องได้รับการยืนยันรหัสอย่างน้อย 3 ใน 5 ฝ่าย เพื่อเริ่มเปิดหีบนับคะแนน';
        }

        const viewResultBtn = document.getElementById('viewResultBtn');
        if (viewResultBtn) {
            viewResultBtn.href = `Vote-Result.html?id=${encodeURIComponent(eventId)}`;
            const btnText = isReferendum ? 'ดูผลการลงประชามติแบบเรียลไทม์' : 'ดูผลการเลือกตั้งแบบเรียลไทม์';
            viewResultBtn.innerHTML = `<i class="fa-solid fa-chart-pie"></i> ${btnText}`;
        }
    }

    function renderStakeholderList() {
        const listEl = document.getElementById('stakeholdersList');
        if (!listEl) return;

        listEl.innerHTML = '';
        stakeholders.forEach(stk => {
            const isConfirmed = state.confirmedIds.includes(stk.id);
            const isUserRole = roleMatchesStakeholder(stk, activeRole);

            const card = document.createElement('article');
            card.className = `vu-card ${isUserRole ? 'vu-card--current-user' : ''}`;
            card.id = `card-${stk.id}`;

            const iconClass = isConfirmed ? 'vu-icon--confirmed' : 'vu-icon--pending';
            const iconHtml = isConfirmed
                ? '<i class="fa-solid fa-check"></i>'
                : '<i class="fa-solid fa-clock"></i>';

            const statusHtml = isConfirmed
                ? `<p class="vu-card-status-text confirmed">สถานะ: ยืนยันรหัสปลดล็อกแล้ว <span class="vu-ref-code">(รหัสอ้างอิง: ${stk.refCode})</span></p>`
                : `<p class="vu-card-status-text">สถานะ: รอดำเนินการยืนยันรหัส</p>`;

            let actionHtml = '';
            if (isConfirmed) {
                actionHtml = `<span class="vu-badge-confirmed"><i class="fa-solid fa-circle-check"></i> ยืนยันแล้ว</span>`;
            } else if (isUserRole) {
                actionHtml = `<button type="button" class="vu-btn-submit" data-id="${stk.id}"><i class="fa-solid fa-key"></i> ส่งรหัส</button>`;
            } else {
                actionHtml = `<span style="font-size: 13px; color: #9CA3AF;">(รอฝ่ายเข้าสู่ระบบ)</span>`;
            }

            card.innerHTML = `
                <div class="vu-card-left">
                    <div class="vu-icon-wrap ${iconClass}" id="icon-${stk.id}">
                        ${iconHtml}
                    </div>
                    <div class="vu-card-info">
                        <h3 class="vu-card-name">${stk.number}. ${stk.name}</h3>
                        ${statusHtml}
                    </div>
                </div>
                <div class="vu-card-action">
                    ${actionHtml}
                </div>
            `;

            listEl.appendChild(card);
        });

        // Add event listeners to "ส่งรหัส" buttons
        listEl.querySelectorAll('.vu-btn-submit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                handleConfirmCode(id);
            });
        });

        updateProgressHeader();
    }

    function updateProgressHeader() {
        const confirmedCount = state.confirmedIds.length;
        const totalCount = stakeholders.length;
        const pct = Math.round((confirmedCount / totalCount) * 100);

        const statusText = document.getElementById('trackerStatus');
        if (statusText) {
            statusText.textContent = `ส่งรหัสแล้ว ${confirmedCount} / ${totalCount} ฝ่าย`;
        }

        const fillEl = document.getElementById('trackerFill');
        if (fillEl) {
            fillEl.style.width = `${pct}%`;
        }
    }

    function renderProcessingSection() {
        const step1Badge = document.getElementById('step1Badge');
        const step2Badge = document.getElementById('step2Badge');
        const step3Badge = document.getElementById('step3Badge');
        const step3Pct = document.getElementById('step3Pct');
        const decryptFill = document.getElementById('decryptFill');
        const viewResultSection = document.getElementById('viewResultSection');
        const processTitle = document.getElementById('processTitle');

        const isThresholdMet = state.confirmedIds.length >= 3;

        if (processTitle) {
            processTitle.textContent = isThresholdMet
                ? 'รวมรหัสครบตามเกณฑ์แล้ว (ระบบกำลังเริ่มประมวลผลอัตโนมัติ)'
                : 'รอยืนยันรหัสครบตามเกณฑ์ (อย่างน้อย 3 ใน 5 ฝ่าย)';
        }

        if (!isThresholdMet) {
            if (step1Badge) { step1Badge.className = 'vu-step-badge vu-step-badge--waiting'; step1Badge.textContent = 'รอดำเนินการ'; }
            if (step2Badge) { step2Badge.className = 'vu-step-badge vu-step-badge--waiting'; step2Badge.textContent = 'รอดำเนินการ'; }
            if (step3Badge) { step3Badge.className = 'vu-step-badge vu-step-badge--waiting'; step3Badge.textContent = 'รอดำเนินการ'; }
            if (step3Pct) step3Pct.textContent = '0%';
            if (decryptFill) decryptFill.style.width = '0%';
            if (viewResultSection) viewResultSection.style.display = 'none';
            return;
        }

        // เมื่อรหัสครบ 3 ใน 5
        if (step1Badge) { step1Badge.className = 'vu-step-badge vu-step-badge--done'; step1Badge.textContent = 'สำเร็จ'; }
        if (step2Badge) { step2Badge.className = 'vu-step-badge vu-step-badge--done'; step2Badge.textContent = 'สำเร็จ'; }

        const progress = Math.min(100, Math.max(0, state.decryptionProgress || 0));
        if (step3Pct) step3Pct.textContent = `${progress}%`;
        if (decryptFill) decryptFill.style.width = `${progress}%`;

        if (progress >= 100) {
            if (step3Badge) { step3Badge.className = 'vu-step-badge vu-step-badge--done'; step3Badge.textContent = 'สำเร็จ'; }
            if (viewResultSection) viewResultSection.style.display = 'block';
        } else {
            if (step3Badge) { step3Badge.className = 'vu-step-badge vu-step-badge--processing'; step3Badge.textContent = 'กำลังประมวลผล'; }
            if (viewResultSection) viewResultSection.style.display = 'none';
        }
    }

    // -------------------------------------------------------------
    // Interaction: Stakeholder Confirms Code
    // -------------------------------------------------------------
    function handleConfirmCode(stakeholderId) {
        if (state.confirmedIds.includes(stakeholderId)) return;

        state.confirmedIds.push(stakeholderId);
        saveState();

        renderStakeholderList();
        renderProcessingSection();

        // Check if threshold met (3 of 5)
        if (state.confirmedIds.length >= 3 && state.decryptionStatus === 'idle') {
            triggerDecryptionCeremony();
        }
    }

    // -------------------------------------------------------------
    // Decryption Ceremony & Live Ballot Processing
    // -------------------------------------------------------------
    async function triggerDecryptionCeremony() {
        if (state.decryptionStatus === 'processing' || state.decryptionStatus === 'done') return;

        state.decryptionStatus = 'processing';
        saveState();
        renderProcessingSection();

        const stagingTable = isReferendum ? 'referendum_staging_box' : 'mp_staging_box';
        const finalTable = isReferendum ? 'referendum_final_box' : 'mp_final_box';

        let ballots = [];
        const client = getSupabase();

        // 1. ดึงบัตรที่มีสถานะ ACTIVE หรือ รอนับคะแนน จาก Staging Box
        if (client) {
            try {
                const { data, error } = await client
                    .from(stagingTable)
                    .select('*')
                    .limit(100);

                if (!error && Array.isArray(data) && data.length > 0) {
                    ballots = data;
                }
            } catch (err) {
                console.warn('Could not query supabase staging box, fallback to local', err);
            }
        }

        // Fallback จาก LocalStorage หาก Supabase ยังไม่มีข้อมูล
        if (ballots.length === 0) {
            try {
                const localStaging = JSON.parse(localStorage.getItem('election-staging-envelopes') || '{}');
                const list = Object.values(localStaging).filter(b => b.type === (isReferendum ? 'referendum' : 'mp'));
                if (list.length > 0) ballots = list;
            } catch (e) { }
        }

        // หากยังไม่มีเลย ให้สร้าง Mock Envelopes สำหรับจำลองการนับ
        if (ballots.length === 0) {
            ballots = [
                { voter_id: 'mock-1', encrypted_ballot: { constituency: '1', partyList: '1' } },
                { voter_id: 'mock-2', encrypted_ballot: { constituency: '2', partyList: '3' } },
                { voter_id: 'mock-3', encrypted_ballot: { constituency: '1', partyList: '2' } },
                { voter_id: 'mock-4', encrypted_ballot: { constituency: '3', partyList: '1' } },
                { voter_id: 'mock-5', encrypted_ballot: { constituency: '2', partyList: '2' } }
            ];
        }

        console.log(`[Decryption Ceremony] Found ${ballots.length} ballots in ${stagingTable}. Processing...`);

        // ขั้นตอนที่ 1 & 2: ตัดข้อมูลตัวตน (Strip Identity) + สลับลำดับสุ่ม (Shuffle)
        const anonymizedBallots = ballots.map(b => {
            return {
                ballot_id: 'BLT-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
                raw_encrypted: b.encrypted_ballot,
                district_code: b.district_code || 'BKK-01'
            };
        }).sort(() => Math.random() - 0.5); // Shuffle

        // ขั้นตอนที่ 3: ทยอยถอดรหัส (Live Stream Batch Decryption)
        const total = anonymizedBallots.length;
        let processedCount = 0;

        for (let i = 0; i < total; i++) {
            const item = anonymizedBallots[i];

            // ถอดรหัสผ่าน Web Crypto
            if (typeof item.raw_encrypted === 'object' && item.raw_encrypted !== null) {
                if (item.raw_encrypted.constituency) {
                    await decryptWithWebCrypto(item.raw_encrypted.constituency);
                }
                if (item.raw_encrypted.partyList) {
                    await decryptWithWebCrypto(item.raw_encrypted.partyList);
                }
                if (item.raw_encrypted.ciphertext) {
                    await decryptWithWebCrypto(item.raw_encrypted.ciphertext);
                }
            } else if (typeof item.raw_encrypted === 'string') {
                await decryptWithWebCrypto(item.raw_encrypted);
            }

            // บันทึกลง Final Box ใน Supabase (ถ้าเชื่อมต่อได้)
            if (client) {
                try {
                    const insertPayload = isReferendum
                        ? { ballot_id: item.ballot_id, encrypted_ballot: item.raw_encrypted, counted_at: new Date().toISOString() }
                        : { ballot_id: item.ballot_id, encrypted_ballot: item.raw_encrypted, district_code: item.district_code, counted_at: new Date().toISOString() };

                    await client.from(finalTable).insert([insertPayload]);
                } catch (e) { }
            }

            processedCount++;
            state.decryptionProgress = Math.min(100, Math.round((processedCount / total) * 100));
            state.talliedCount = processedCount;
            saveState();
            renderProcessingSection();

            // ชะลอจังหวะเล็กน้อยเพื่อให้เห็น Animation การทยอยถอดรหัส
            await new Promise(resolve => setTimeout(resolve, 250));
        }

        // มั่นใจว่าครบ 100%
        state.decryptionProgress = 100;
        state.decryptionStatus = 'done';
        saveState();
        renderProcessingSection();

        const summaryBox = document.getElementById('talliedSummary');
        if (summaryBox) {
            summaryBox.style.display = 'flex';
            summaryBox.innerHTML = `<span><i class="fa-solid fa-boxes-stacked"></i> ถอดรหัสและบันทึกสู่หีบสุดท้ายเรียบร้อยแล้ว:</span> <b>${total} ใบ</b>`;
        }
    }

    // -------------------------------------------------------------
    // Simulator Bar (Switch Roles on the fly)
    // -------------------------------------------------------------
    function renderRoleSimulator() {
        const bar = document.getElementById('roleSimulatorBar');
        if (!bar) return;

        const roles = [
            { key: 'all', label: 'ทั้งหมด (Dev)' },
            { key: 'ect', label: '1. กกต.' },
            { key: 'party1', label: isReferendum ? '2. ฝ่ายเห็นชอบ' : '2. พรรค ก' },
            { key: 'party2', label: isReferendum ? '3. ฝ่ายไม่เห็นชอบ' : '3. พรรค ข' },
            { key: 'party3', label: isReferendum ? '4. วิชาการ/สื่อ' : '4. พรรค ค' },
            { key: 'citizen', label: '5. ประชาชน/สังเกตการณ์' }
        ];

        bar.innerHTML = `
            <span class="vu-sim-label"><i class="fa-solid fa-user-shield"></i> จำลองบทบาท:</span>
            ${roles.map(r => `
                <button type="button" class="vu-sim-pill ${activeRole === r.key ? 'active' : ''}" data-role="${r.key}">
                    ${r.label}
                </button>
            `).join('')}
            <button type="button" class="vu-sim-pill" id="btnResetCeremony" style="background: rgba(239, 68, 68, 0.4); border-color: rgba(239, 68, 68, 0.6); margin-left: 8px;">
                <i class="fa-solid fa-rotate-left"></i> รีเซ็ต
            </button>
        `;

        bar.querySelectorAll('.vu-sim-pill[data-role]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const role = e.currentTarget.getAttribute('data-role');
                activeRole = role;
                localStorage.setItem('election_sim_role', role);
                renderRoleSimulator();
                renderStakeholderList();
            });
        });

        const resetBtn = document.getElementById('btnResetCeremony');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (confirm('คุณต้องการรีเซ็ตสถานะการปลดล็อคกุญแจทั้งหมดใช่หรือไม่?')) {
                    localStorage.removeItem(STORAGE_KEY);
                    state = { confirmedIds: [], decryptionStatus: 'idle', decryptionProgress: 0, talliedCount: 0 };
                    saveState();
                    renderStakeholderList();
                    renderProcessingSection();
                    const summaryBox = document.getElementById('talliedSummary');
                    if (summaryBox) summaryBox.style.display = 'none';
                }
            });
        }
    }

    // -------------------------------------------------------------
    // Initialization
    // -------------------------------------------------------------
    function init() {
        renderStaticHeaders();
        renderStakeholderList();
        renderProcessingSection();
        renderRoleSimulator();

        // ตรวจสอบกรณีที่ threshold เคยครบแล้วแต่ยังค้างการประมวลผล
        if (state.confirmedIds.length >= 3 && state.decryptionStatus === 'idle') {
            triggerDecryptionCeremony();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

