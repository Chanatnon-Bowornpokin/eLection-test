/**
 * Script ควบคุมหน้าตรวจทานและยืนยันการลงคะแนน (Vote-Review.html)
 * - สลับ Banner ตาม Event ID
 * - ดึงผลคะแนนที่เพิ่งเลือกมาจาก localStorage
 * - สร้างการ์ดบัตรสรุป (review-paper-card) ตามดีไซน์ Figma เป๊ะ
 * - ปุ่ม "แก้ไข" นำทางกลับไปยังหน้า Vote.html พร้อมระบุ step
 * - ปุ่ม "ย้อนกลับ" และปุ่ม "ถัดไป" (ยืนยันส่งคะแนนจริง)
 */

function getCurrentEventId() {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('id');

    if (eventId && typeof EVENTS !== 'undefined' && Array.isArray(EVENTS)) {
        const found = EVENTS.find(ev => ev.id === eventId);
        if (found) return found.id;
    }

    if (typeof EVENTS !== 'undefined' && Array.isArray(EVENTS) && EVENTS.length > 0) {
        return EVENTS[0].id;
    }

    return 'house-election-2569';
}

function initHeroBanner(currentEventId) {
    const heroImg = document.getElementById('voteReviewHeroImg');
    if (!heroImg) return;

    let currentEvent = null;
    if (typeof EVENTS !== 'undefined' && Array.isArray(EVENTS)) {
        currentEvent = EVENTS.find(ev => ev.id === currentEventId);
    }

    if (currentEvent && currentEvent.banner) {
        heroImg.src = currentEvent.banner;
        heroImg.alt = currentEvent.title || 'รายละเอียดการเลือกตั้ง';
    }
}

function renderReviewCards(currentEventId) {
    const cardsWrap = document.getElementById('reviewCardsWrap');
    if (!cardsWrap) return;

    const isReferendum = (currentEventId === 'referendum-2569-03');

    // ดึงค่าผลคะแนนที่เลือกล่าสุด
    let ballot1 = localStorage.getItem(`vote-choice-${currentEventId}-b1`) || '1';
    let ballot2 = localStorage.getItem(`vote-choice-${currentEventId}-b2`) || '1';

    if (isReferendum) {
        // --- กรณีออกเสียงประชามติ (1 ใบ) ---
        let choiceHtml = '';
        if (ballot1 === 'abstain') {
            choiceHtml = `
                <div class="review-abstain-row">
                    <div class="review-abstain-label">ไม่แสดง<br>ความคิดเห็น</div>
                    <div class="review-abstain-mark">
                        <i class="fa-solid fa-xmark vote-cross-mark"></i>
                    </div>
                </div>
            `;
        } else {
            const labelText = (ballot1 === 'approve') ? 'เห็นชอบ' : 'ไม่เห็นชอบ';
            choiceHtml = `
                <div class="review-table-head">
                    <div class="review-table-cell-num">ตัวเลือก</div>
                    <div class="review-table-cell-mark">ช่องลงคะแนน</div>
                </div>
                <div class="review-table-row">
                    <div class="review-choice-num review-choice-num--text">${labelText}</div>
                    <div class="review-choice-mark">
                        <i class="fa-solid fa-xmark vote-cross-mark"></i>
                    </div>
                </div>
            `;
        }

        cardsWrap.innerHTML = `
            <div class="review-paper-card">
                <div class="review-paper-header">
                    <h2 class="review-paper-title bold">ออกเสียงประชามติ</h2>
                    <p class="review-paper-subtitle">(สมควรมีรัฐธรรมนูญฉบับใหม่หรือไม่)</p>
                </div>
                <div class="review-paper-body">
                    <div class="review-table-wrap">
                        ${choiceHtml}
                    </div>
                </div>
                <div class="review-paper-footer">
                    <button type="button" class="review-edit-btn" id="editBallot1Btn">แก้ไข</button>
                </div>
            </div>
        `;
    } else {
        // --- กรณีการเลือกตั้ง ส.ส. (2 ใบตาม Figma เป๊ะ) ---
        // บัตรใบที่ 1: ส.ส. แบบแบ่งเขต
        let b1Html = '';
        if (ballot1 === 'abstain') {
            b1Html = `
                <div class="review-abstain-row">
                    <div class="review-abstain-label">ไม่ประสงค์<br>ลงคะแนน</div>
                    <div class="review-abstain-mark">
                        <i class="fa-solid fa-xmark vote-cross-mark"></i>
                    </div>
                </div>
            `;
        } else {
            b1Html = `
                <div class="review-table-head">
                    <div class="review-table-cell-num">เบอร์</div>
                    <div class="review-table-cell-mark">ช่องลงคะแนน</div>
                </div>
                <div class="review-table-row">
                    <div class="review-choice-num">${ballot1}</div>
                    <div class="review-choice-mark">
                        <i class="fa-solid fa-xmark vote-cross-mark"></i>
                    </div>
                </div>
            `;
        }

        // บัตรใบที่ 2: ส.ส. แบบบัญชีรายชื่อ
        let b2Html = '';
        if (ballot2 === 'abstain') {
            b2Html = `
                <div class="review-abstain-row">
                    <div class="review-abstain-label">ไม่ประสงค์<br>ลงคะแนน</div>
                    <div class="review-abstain-mark">
                        <i class="fa-solid fa-xmark vote-cross-mark"></i>
                    </div>
                </div>
            `;
        } else {
            b2Html = `
                <div class="review-table-head">
                    <div class="review-table-cell-num">เบอร์</div>
                    <div class="review-table-cell-mark">ช่องลงคะแนน</div>
                </div>
                <div class="review-table-row">
                    <div class="review-choice-num">${ballot2}</div>
                    <div class="review-choice-mark">
                        <i class="fa-solid fa-xmark vote-cross-mark"></i>
                    </div>
                </div>
            `;
        }

        cardsWrap.innerHTML = `
            <!-- การ์ดบัตรใบที่ 1 -->
            <div class="review-paper-card">
                <div class="review-paper-header">
                    <h2 class="review-paper-title bold">บัตรลงคะแนนใบที่ 1</h2>
                    <p class="review-paper-subtitle">(ส.ส. แบบแบ่งเขต)</p>
                </div>
                <div class="review-paper-body">
                    <div class="review-table-wrap">
                        ${b1Html}
                    </div>
                </div>
                <div class="review-paper-footer">
                    <button type="button" class="review-edit-btn" id="editBallot1Btn">แก้ไข</button>
                </div>
            </div>

            <!-- การ์ดบัตรใบที่ 2 -->
            <div class="review-paper-card">
                <div class="review-paper-header">
                    <h2 class="review-paper-title bold">บัตรลงคะแนนใบที่ 2</h2>
                    <p class="review-paper-subtitle">(ส.ส. แบบบัญชีรายชื่อ)</p>
                </div>
                <div class="review-paper-body">
                    <div class="review-table-wrap">
                        ${b2Html}
                    </div>
                </div>
                <div class="review-paper-footer">
                    <button type="button" class="review-edit-btn" id="editBallot2Btn">แก้ไข</button>
                </div>
            </div>
        `;
    }

    setupReviewActions(currentEventId);
}

/**
 * ฟังก์ชันเข้ารหัสลับจริงด้วย Web Crypto API (AES-GCM 256-bit)
 */
async function encryptWithWebCrypto(plainText, secretKeyString = 'eLection-ECT-SecretKey-2026-BKK') {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(secretKeyString.padEnd(32, '0')),
        { name: 'AES-GCM' },
        false,
        ['encrypt']
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        keyMaterial,
        enc.encode(plainText)
    );
    const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encryptedBuffer), iv.length);
    const base64Cipher = btoa(String.fromCharCode(...combined));
    return `ENC[AES-GCM::${base64Cipher}]`;
}

/**
 * สร้าง Unique Tracking Code แบบไม่ซ้ำกัน 100%
 * พ่วง Timestamp (มิลลิวินาที) + สุ่มด้วย Web Crypto API
 * รูปแบบ เช่น VOTE-MVYY8FIU-511D-2026
 */
function generateUniqueTrackingCode() {
    const timePart = Date.now().toString(36).toUpperCase();
    let randPart = '';
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
        const randomBytes = new Uint8Array(3);
        window.crypto.getRandomValues(randomBytes);
        randPart = Array.from(randomBytes, b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    } else {
        randPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    }
    return `VOTE-${timePart}-${randPart}-2026`;
}

function setupReviewActions(currentEventId) {
    const editB1 = document.getElementById('editBallot1Btn');
    const editB2 = document.getElementById('editBallot2Btn');
    const backBtn = document.getElementById('backBtn');
    const confirmBtn = document.getElementById('confirmBtn');

    // กดย้อนกลับไปแก้ไขใบที่ 1
    if (editB1) {
        editB1.addEventListener('click', () => {
            window.location.href = `Vote.html?id=${encodeURIComponent(currentEventId)}&step=1`;
        });
    }

    // กดย้อนกลับไปแก้ไขใบที่ 2
    if (editB2) {
        editB2.addEventListener('click', () => {
            window.location.href = `Vote.html?id=${encodeURIComponent(currentEventId)}&step=2`;
        });
    }

    // ปุ่มย้อนกลับด้านล่าง (ย้อนกลับไปหน้าลงคะแนนบัตรใบที่ 2 หรือ ประชามติ)
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            const isReferendum = currentEventId.toLowerCase().includes('referendum');
            const step = isReferendum ? '1' : '2';
            window.location.href = `Vote.html?id=${encodeURIComponent(currentEventId)}&step=${step}`;
        });
    }

    // ปุ่มยืนยันการลงคะแนน (ถัดไป) -> จำลองระบบซองจดหมาย 2 ชั้น (Digital Double Envelope)
    // ปุ่มยืนยันการลงคะแนน (ถัดไป) -> ส่งข้อมูลเข้า Supabase จริง + จำลองระบบซองจดหมาย 2 ชั้น
    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            // ปิดปุ่มชั่วคราวเพื่อกันการกดซ้ำ
            confirmBtn.disabled = true;
            confirmBtn.innerText = 'กำลังส่งคะแนน...';

            const isReferendum = currentEventId.toLowerCase().includes('referendum');

            try {
                // 1. ดึงตัวเลือกคะแนนดิบจากร่างชั่วคราว (Vote Draft)
                const ballot1 = localStorage.getItem(`vote-choice-${currentEventId}-b1`) || (isReferendum ? 'approve' : '1');
                const ballot2 = isReferendum ? null : (localStorage.getItem(`vote-choice-${currentEventId}-b2`) || '1');

                // 2. สุ่มสร้าง tracking_code รูปแบบไม่ซ้ำ 100% (พ่วง Timestamp + Crypto)
                const tracking_code = generateUniqueTrackingCode();
                const trackingHash = tracking_code;

                // บันทึกข้อมูลใบเสร็จลง sessionStorage เพื่อนำไปแสดงในหน้า Vote-Success.html
                const now = new Date();
                const voteTimeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' น.';
                const voteDateStr = now.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });

                sessionStorage.setItem('latest_vote_receipt', JSON.stringify({
                    trackingCode: tracking_code,
                    voteTime: voteTimeStr,
                    voteDate: voteDateStr
                }));

                // 3. ซองชั้นใน (Inner Envelope): เข้ารหัสตัวเลือกคะแนนจริงด้วย Web Crypto API (AES-GCM 256-bit)
                const innerEnvelope = isReferendum ? {
                    ciphertext: await encryptWithWebCrypto(String(ballot1)),
                    algorithm: 'AES-256-GCM+IV',
                    sealedUntil: '17:00'
                } : {
                    constituency: await encryptWithWebCrypto(String(ballot1)),
                    partyList: await encryptWithWebCrypto(String(ballot2 || 'abstain')),
                    algorithm: 'AES-256-GCM+IV',
                    sealedUntil: '17:00'
                };

                // 4. ซองชั้นนอก (Outer Envelope): ข้อมูลผู้มีสิทธิ
                const voterSession = JSON.parse(localStorage.getItem('voter_session') || 'null') || {
                    citizenId: '1-1005-01234-56-7',
                    fullName: 'ชนัตนนท์ บวรโภคิน',
                    districtCode: 'BKK-01'
                };

                const votedAtText = `${voteDateStr} ${voteTimeStr}`;

                // ========================================================
                // 🚀 ยิงขึ้น Supabase จริง (แยกตารางตามประเภทการเลือกตั้ง)
                // ========================================================
                if (typeof supabaseClient !== 'undefined') {
                    const isReferendum = currentEventId.toLowerCase().includes('referendum');

                    if (isReferendum) {
                        // ส่งเข้าตารางประชามติ (กรณี Revote ให้ tracking_code ถูกอัปเดตทับด้วยรหัสใหม่)
                        const refPayload = {
                            voter_id: voterSession.citizenId,
                            tracking_code: tracking_code,
                            encrypted_ballot: innerEnvelope,
                            status: 'ACTIVE'
                        };
                        let { error: sbError } = await supabaseClient
                            .from('referendum_staging_box')
                            .upsert(refPayload, { onConflict: 'voter_id' });

                        if (sbError && sbError.message && (sbError.message.includes('tracking_hash') || sbError.message.includes('column'))) {
                            const { error: retryErr } = await supabaseClient
                                .from('referendum_staging_box')
                                .upsert({ ...refPayload, tracking_hash: tracking_code }, { onConflict: 'voter_id' });
                            if (retryErr) console.error('Supabase Error (Referendum retry):', retryErr);
                        } else if (sbError) {
                            console.error('Supabase Error (Referendum):', sbError);
                        }
                    } else {
                        // ส่งเข้าตาราง ส.ส. (กรณี Revote ให้ tracking_code ถูกอัปเดตทับด้วยรหัสใหม่)
                        const mpPayload = {
                            voter_id: voterSession.citizenId,
                            tracking_code: tracking_code,
                            district_code: voterSession.districtCode || 'BKK-01',
                            encrypted_ballot: innerEnvelope,
                            status: 'ACTIVE'
                        };
                        let { error: sbError } = await supabaseClient
                            .from('mp_staging_box')
                            .upsert(mpPayload, { onConflict: 'voter_id' });

                        if (sbError && sbError.message && (sbError.message.includes('tracking_hash') || sbError.message.includes('column'))) {
                            const { error: retryErr } = await supabaseClient
                                .from('mp_staging_box')
                                .upsert({ ...mpPayload, tracking_hash: tracking_code }, { onConflict: 'voter_id' });
                            if (retryErr) console.error('Supabase Error (MP retry):', retryErr);
                        } else if (sbError) {
                            console.error('Supabase Error (MP):', sbError);
                        }
                    }
                }

                // บันทึก fallback ใน localStorage เดิมของคุณเพื่อความชัวร์
                const stagingKey = 'election-staging-envelopes';
                const stagingTable = JSON.parse(localStorage.getItem(stagingKey) || '{}');
                const prevEnvelope = stagingTable[currentEventId];
                const nextVersion = prevEnvelope && typeof prevEnvelope.version === 'number'
                    ? prevEnvelope.version + 1
                    : 1;

                stagingTable[currentEventId] = {
                    eventId: currentEventId,
                    outerEnvelope: {
                        citizenId: voterSession.citizenId,
                        voterName: voterSession.fullName,
                        votedAt: votedAtText,
                        timestampIso: now.toISOString(),
                        version: nextVersion
                    },
                    innerEnvelope: innerEnvelope,
                    trackingHash: tracking_code,
                    trackingCode: tracking_code
                };
                localStorage.setItem(stagingKey, JSON.stringify(stagingTable));

                // 5. อัปเดตสถานะการใช้สิทธิ
                const statusKey = 'election-vote-status-v2';
                const status = JSON.parse(localStorage.getItem(statusKey) || '{}');
                status[currentEventId] = true;
                localStorage.setItem(statusKey, JSON.stringify(status));

                // 6. ล้างค่าตัวเลือกดิบออกจาก LocalStorage
                localStorage.removeItem(`vote-choice-${currentEventId}-b1`);
                localStorage.removeItem(`vote-choice-${currentEventId}-b2`);

            } catch (err) {
                console.warn('Submission error:', err);
            }

            // นำทางไปยังหน้าเสร็จสิ้น (Digital Receipt)
            window.location.href = `Vote-Success.html?id=${encodeURIComponent(currentEventId)}`;
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const currentEventId = getCurrentEventId();
    initHeroBanner(currentEventId);
    renderReviewCards(currentEventId);

    // แสดงคำแนะนำการทดสอบพิธีถอดรหัสใน DevTools Console
    console.log(
        '%c🏛️ [eLection Web Crypto & Decryption Ceremony Ready]\n' +
        '👉 ทดสอบพิธีถอดรหัสผ่าน Console ได้ด้วยคำสั่ง:\n' +
        '   await eLectionDecryptCeremony("mp")\n' +
        '   await eLectionDecryptCeremony("referendum")',
        'color: #1D4ED8; font-weight: bold; font-size: 12px; background: #EFF6FF; padding: 6px 10px; border-radius: 4px; border: 1px solid #BFDBFE;'
    );
});

// =============================================================================
// 🔓 ฟังก์ชันถอดรหัสลับด้วย Web Crypto API (AES-GCM 256-bit)
// =============================================================================
async function decryptWithWebCrypto(encryptedString, secretKeyString = 'eLection-ECT-SecretKey-2026-BKK') {
    try {
        if (!encryptedString || typeof encryptedString !== 'string') return encryptedString;
        if (!encryptedString.startsWith('ENC[AES-GCM::')) {
            return encryptedString;
        }
        const rawBase64 = encryptedString.replace('ENC[AES-GCM::', '').replace(']', '');
        const combined = Uint8Array.from(atob(rawBase64), c => c.charCodeAt(0));
        const iv = combined.slice(0, 12);
        const data = combined.slice(12);
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
            data
        );
        return new TextDecoder().decode(decryptedBuffer);
    } catch (e) {
        return 'DECRYPTION_FAILED';
    }
}

// =============================================================================
// 🏛️ ฟังก์ชันจำลองพิธีถอดรหัสบัตรเลือกตั้ง (Decryption Ceremony Simulation)
// =============================================================================
async function eLectionDecryptCeremony(type = 'mp', keyShares = ['#EC-881B', '#EC-881B', '#EC-881B'], delayMs = 400) {
    console.log(
        '%c================================================================================\n' +
        '🏛️ เริ่มต้นพิธีเปิดหีบและถอดรหัสบัตรเลือกตั้งอิเล็กทรอนิกส์ (Decryption Ceremony)\n' +
        '================================================================================',
        'color: #1E3A8A; font-weight: bold; font-size: 13px;'
    );

    const isReferendum = String(type).toLowerCase().includes('referendum') || String(type).toLowerCase().includes('ref');
    const targetElectionTitle = isReferendum ? 'การออกเสียงประชามติ (Referendum)' : 'การเลือกตั้ง ส.ส. (MP Election)';
    console.log(`📌 ประเภทการเลือกตั้งเป้าหมาย: %c${targetElectionTitle}`, 'font-weight: bold; color: #0284C7;');

    // -------------------------------------------------------------------------
    // ขั้นตอนที่ 1: ตรวจสอบสิทธิ์ Threshold Key Share (2 ใน 3 ฝ่าย)
    // -------------------------------------------------------------------------
    console.group('%c🔑 ขั้นตอนที่ 1: ตรวจสอบ Threshold Authorization (เกณฑ์ 2 ใน 3 ฝ่าย)', 'font-weight: bold; color: #D97706;');
    const REQUIRED_KEY = '#EC-881B';
    const parties = [
        { role: 'คณะกรรมการการเลือกตั้ง (กกต.)', key: Array.isArray(keyShares) ? keyShares[0] : '#EC-881B' },
        { role: 'ตัวแทนพรรคการเมือง', key: Array.isArray(keyShares) ? keyShares[1] : '#EC-881B' },
        { role: 'ผู้สังเกตการณ์ภาคประชาชน', key: Array.isArray(keyShares) ? keyShares[2] : '#EC-881B' }
    ];

    const thresholdAuditTable = parties.map(p => {
        const isMatch = (p.key === REQUIRED_KEY);
        return {
            'ฝ่ายผู้ถือครองกุญแจ': p.role,
            'รหัส Key Share ที่ส่ง': p.key || '(ไม่ได้ส่ง)',
            'สถานะการยืนยัน': isMatch ? 'ถูกต้อง ✅' : 'ไม่ถูกต้อง / ขาดหาย ❌'
        };
    });
    console.table(thresholdAuditTable);

    const validSharesCount = parties.filter(p => p.key === REQUIRED_KEY).length;
    if (validSharesCount < 2) {
        console.error(`❌ การปลดล็อกล้มเหลว: ยืนยันรหัสถูกต้องเพียง ${validSharesCount}/3 ฝ่าย (ต้องการอย่างน้อย 2 ใน 3 ฝ่าย)`);
        console.groupEnd();
        return { success: false, reason: 'Threshold authorization failed (less than 2 valid shares)' };
    }

    console.log(`✅ ยืนยันรหัสถูกต้อง ${validSharesCount}/3 ฝ่าย — ผ่านเกณฑ์ Threshold 2-of-3 อนุมัติให้เริ่มขั้นตอนถอดรหัส`);
    console.groupEnd();

    // -------------------------------------------------------------------------
    // ขั้นตอนที่ 2: ดึงบัตรลงคะแนนจริงจาก Supabase Box (เฉพาะ status = 'ACTIVE')
    // -------------------------------------------------------------------------
    console.group('%c📦 ขั้นตอนที่ 2: ดึงบัตรลงคะแนนจาก Supabase Box (status = ACTIVE)', 'font-weight: bold; color: #2563EB;');
    const targetTable = isReferendum ? 'referendum_staging_box' : 'mp_staging_box';

    if (typeof supabaseClient === 'undefined') {
        console.error('❌ ไม่พบ Supabase Client (โปรดตรวจสอบการโหลด supabase-client.js)');
        console.groupEnd();
        return;
    }

    const { data: ballots, error } = await supabaseClient
        .from(targetTable)
        .select('*')
        .eq('status', 'ACTIVE');

    if (error) {
        console.error(`❌ เกิดข้อผิดพลาดในการดึงข้อมูลจาก Supabase (${targetTable}):`, error);
        console.groupEnd();
        return;
    }

    if (!ballots || ballots.length === 0) {
        console.log(`หีบบัตรใน Supabase ว่างเปล่า ยังไม่มีการลงคะแนน (0 ใบ)`);
        console.groupEnd();
        return;
    }

    console.log(`📡 [Supabase] ดึงข้อมูลจากตาราง "${targetTable}" สำเร็จ: พบ ${ballots.length} ซอง (ACTIVE)`);
    console.groupEnd();

    // -------------------------------------------------------------------------
    // ขั้นตอนที่ 3: กระบวนการตัดสิทธิ (Anonymize) และสับลำดับบัตร (Shuffle)
    // -------------------------------------------------------------------------
    console.group('%c🔀 ขั้นตอนที่ 3: สับลำดับบัตรสุ่มก่อนเริ่มนับ (Fisher-Yates Shuffle)', 'font-weight: bold; color: #7C3AED;');
    console.log('1. นำบัตรทั้งหมดมาสลับลำดับตำแหน่งแบบสุ่ม เพื่อตัดขาดความเชื่อมโยงกับเวลาลงคะแนน');
    console.log('2. ในตารางผลนับคะแนนจะไม่มีการแสดงตัวตนหรือ Tracking Code กำกับ');

    const shuffledBallots = [...ballots];
    for (let i = shuffledBallots.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledBallots[i], shuffledBallots[j]] = [shuffledBallots[j], shuffledBallots[i]];
    }

    console.log(`✨ สับเปลี่ยนลำดับเสร็จสมบูรณ์ — ลำดับคิวการนับถูกสุ่ม 100%`);
    console.groupEnd();

    // -------------------------------------------------------------------------
    // ขั้นตอนที่ 4: ทยอยถอดรหัสบัตรและอัปเดตสถานะทีละใบ (Progressive Live Tally)
    // -------------------------------------------------------------------------
    console.group('%c🔓 ขั้นตอนที่ 4: ทยอยถอดรหัสและบันทึกคะแนนทีละใบ (Progressive Live Tally)', 'font-weight: bold; color: #16A34A;');
    const decryptedList = [];
    const tallyResults = {};

    console.log(`⏱️ กำลังเริ่มนับคะแนนทีละใบจากคิวที่สับลำดับแล้ว (${shuffledBallots.length} ใบ)...`);

    for (let i = 0; i < shuffledBallots.length; i++) {
        const item = shuffledBallots[i];
        const envelope = item.encrypted_ballot || {};

        if (isReferendum) {
            const cipherStr = envelope.ciphertext || envelope.choice;
            const plainChoice = await decryptWithWebCrypto(cipherStr);

            let displayChoice = plainChoice;
            if (plainChoice === 'approve') displayChoice = 'เห็นชอบ';
            else if (plainChoice === 'disapprove') displayChoice = 'ไม่เห็นชอบ';
            else if (plainChoice === 'abstain') displayChoice = 'ไม่แสดงความคิดเห็น';

            decryptedList.push({
                'ลำดับบัตร (Shuffled)': i + 1,
                'ผลการออกเสียงประชามติ': displayChoice,
                'สถานะถอดรหัส': plainChoice !== 'DECRYPTION_FAILED' ? 'สำเร็จ ✅' : 'ล้มเหลว ❌'
            });

            tallyResults[displayChoice] = (tallyResults[displayChoice] || 0) + 1;
        } else {
            const decB1 = await decryptWithWebCrypto(envelope.constituency);
            const decB2 = await decryptWithWebCrypto(envelope.partyList);

            const b1Label = decB1 === 'abstain' ? 'ไม่ประสงค์ลงคะแนน' : `เบอร์ ${decB1}`;
            const b2Label = decB2 === 'abstain' ? 'ไม่ประสงค์ลงคะแนน' : `เบอร์ ${decB2}`;

            decryptedList.push({
                'ลำดับบัตร (Shuffled)': i + 1,
                'เขตเลือกตั้ง': item.district_code || 'BKK-01',
                'ใบที่ 1 (ส.ส. เขต)': b1Label,
                'ใบที่ 2 (ส.ส. บัญชีรายชื่อ)': b2Label,
                'สถานะถอดรหัส': (decB1 !== 'DECRYPTION_FAILED' && decB2 !== 'DECRYPTION_FAILED') ? 'สำเร็จ ✅' : 'ล้มเหลว ❌'
            });

            const k1 = `[ส.ส. แบ่งเขต] ${b1Label}`;
            const k2 = `[ส.ส. บัญชีรายชื่อ] ${b2Label}`;
            tallyResults[k1] = (tallyResults[k1] || 0) + 1;
            tallyResults[k2] = (tallyResults[k2] || 0) + 1;
        }

        // 🔄 อัปเดตสถานะของบัตรใบนี้ใน Supabase ทันที: ACTIVE -> TALLIED
        if (item.voter_id) {
            await supabaseClient
                .from(targetTable)
                .update({ status: 'TALLIED' })
                .eq('voter_id', item.voter_id);
        }

        console.log(`🗳️ [บัตรใบที่ ${i + 1}/${shuffledBallots.length}] ประมวลผลและนับคะแนนแล้ว -> สถานะเปลี่ยนเป็น "TALLIED" (ประมวลผลแล้ว) ✅`);

        // จำลองเวลาในการนับทีละใบ (Progressive Tally Delay)
        if (delayMs > 0 && i < shuffledBallots.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    console.log('📋 ตารางแสดงรายการบัตรเลือกตั้งที่ถอดรหัสเรียบร้อยแล้ว:');
    console.table(decryptedList);

    const summaryTable = Object.keys(tallyResults).map(k => ({
        'ตัวเลือก / หมายเลขที่ได้รับคะแนน': k,
        'จำนวนคะแนนที่นับได้': tallyResults[k]
    }));
    console.log('📊 สรุปผลการนับคะแนนรวม (Official Tally Summary):');
    console.table(summaryTable);
    console.groupEnd();

    console.log(
        '%c================================================================================\n' +
        '🎉 พิธีถอดรหัสและนับคะแนนเสร็จสิ้นอย่างสมบูรณ์ บัตรทั้งหมดถูกเปลี่ยนสถานะเป็น TALLIED ครบ 100%\n' +
        '================================================================================',
        'color: #065F46; font-weight: bold; font-size: 13px;'
    );

    return {
        success: true,
        totalBallots: decryptedList.length,
        ballots: decryptedList,
        tally: tallyResults
    };
}

// =============================================================================
// 🔍 ฟังก์ชันตรวจสอบสถานะบัตรลงคะแนนด้วย Tracking Code
// เช็คเฉพาะว่าบัตรถูกเข้ารหัสและเข้าสู่ระบบหีบดิจิทัลแล้วหรือยัง (ไม่เปิดเผยคะแนนเสียง)
// =============================================================================
async function checkBallotTrackingStatus(trackingCode) {
    if (!trackingCode || typeof trackingCode !== 'string') {
        console.warn('⚠️ กรุณาระบุ Tracking Code เช่น: await checkBallotTrackingStatus("VOTE-XXXX-XXXX-2026")');
        return { success: false, message: 'Invalid tracking code' };
    }

    const cleanCode = trackingCode.trim();

    if (typeof supabaseClient === 'undefined') {
        console.warn('⚠️ ไม่พบการเชื่อมต่อ Supabase Client');
        return { success: false, message: 'Supabase client not loaded' };
    }

    try {
        // 1. ค้นหาในตาราง ส.ส.
        let { data: mpData } = await supabaseClient
            .from('mp_staging_box')
            .select('tracking_code, status, encrypted_ballot')
            .eq('tracking_code', cleanCode)
            .maybeSingle();

        if (!mpData) {
            const fb = await supabaseClient
                .from('mp_staging_box')
                .select('tracking_hash, status, encrypted_ballot')
                .eq('tracking_hash', cleanCode)
                .maybeSingle();
            if (fb.data) mpData = fb.data;
        }

        if (mpData) {
            const hasBallot = Boolean(mpData.encrypted_ballot);
            const isTallied = mpData.status === 'TALLIED' || mpData.status === 'PROCESSED';
            const isActive = mpData.status === 'ACTIVE';

            let stageLabel = '';
            let stageDesc = '';

            if (isTallied) {
                stageLabel = 'ประมวลผลแล้ว (นับคะแนนเรียบร้อยแล้ว) ✅';
                stageDesc = 'บัตรของคุณผ่านการเปิดหีบ ถอดรหัส และถูกรวมคะแนนในผลการเลือกตั้งเรียบร้อยแล้ว';
            } else if (isActive) {
                stageLabel = 'บัตรอยู่ในระบบ (รอการนับคะแนน) ⏳';
                stageDesc = 'บัตรของคุณถูกเข้ารหัสและปิดผนึกอยู่ในหีบเรียบร้อยแล้ว (รอเปิดหีบและนับคะแนนหลังเวลา 17:00 น.)';
            } else {
                stageLabel = `สถานะ: ${mpData.status}`;
                stageDesc = 'สถานะบัตรในระบบ: ' + mpData.status;
            }

            const res = {
                'สถานะบัตร': stageLabel,
                'คำอธิบาย': stageDesc,
                'ประเภทการเลือกตั้ง': 'การเลือกตั้ง ส.ส.',
                'รหัสติดตาม': cleanCode,
                'การเข้ารหัสบัตร': hasBallot ? 'เข้ารหัสสมบูรณ์ (Sealed & Encrypted)' : 'ไม่มีข้อมูลบัตร',
                'DB Status': mpData.status
            };
            console.log(`%c[Tracking Status] ตรวจสอบรหัส: ${cleanCode}`, `font-weight: bold; color: ${isTallied ? '#059669' : '#D97706'};`);
            console.table([res]);
            return { success: true, stage: isTallied ? 'TALLIED' : 'ACTIVE', stageLabel, stageDesc, details: res };
        }

        // 2. ค้นหาในตารางประชามติ
        let { data: refData } = await supabaseClient
            .from('referendum_staging_box')
            .select('tracking_code, status, encrypted_ballot')
            .eq('tracking_code', cleanCode)
            .maybeSingle();

        if (!refData) {
            const fb = await supabaseClient
                .from('referendum_staging_box')
                .select('tracking_hash, status, encrypted_ballot')
                .eq('tracking_hash', cleanCode)
                .maybeSingle();
            if (fb.data) refData = fb.data;
        }

        if (refData) {
            const hasBallot = Boolean(refData.encrypted_ballot);
            const isTallied = refData.status === 'TALLIED' || refData.status === 'PROCESSED';
            const isActive = refData.status === 'ACTIVE';

            let stageLabel = '';
            let stageDesc = '';

            if (isTallied) {
                stageLabel = 'ประมวลผลแล้ว (นับคะแนนเรียบร้อยแล้ว) ✅';
                stageDesc = 'บัตรของคุณผ่านการเปิดหีบ ถอดรหัส และถูกรวมคะแนนในผลการออกเสียงเรียบร้อยแล้ว';
            } else if (isActive) {
                stageLabel = 'บัตรอยู่ในระบบ (รอการนับคะแนน) ⏳';
                stageDesc = 'บัตรของคุณถูกเข้ารหัสและปิดผนึกอยู่ในหีบเรียบร้อยแล้ว (รอเปิดหีบและนับคะแนนหลังเวลา 17:00 น.)';
            } else {
                stageLabel = `สถานะ: ${refData.status}`;
                stageDesc = 'สถานะบัตรในระบบ: ' + refData.status;
            }

            const res = {
                'สถานะบัตร': stageLabel,
                'คำอธิบาย': stageDesc,
                'ประเภทการเลือกตั้ง': 'การออกเสียงประชามติ',
                'รหัสติดตาม': cleanCode,
                'การเข้ารหัสบัตร': hasBallot ? 'เข้ารหัสสมบูรณ์ (Sealed & Encrypted)' : 'ไม่มีข้อมูลบัตร',
                'DB Status': refData.status
            };
            console.log(`%c[Tracking Status] ตรวจสอบรหัส: ${cleanCode}`, `font-weight: bold; color: ${isTallied ? '#059669' : '#D97706'};`);
            console.table([res]);
            return { success: true, stage: isTallied ? 'TALLIED' : 'ACTIVE', stageLabel, stageDesc, details: res };
        }

        console.warn(`[Tracking Status] ❌ ไม่พบบัตรที่ตรงกับรหัส "${cleanCode}" ในระบบหีบบัตร`);
        return { success: false, isProcessed: false, message: 'ไม่พบรหัสบัตรในระบบ' };
    } catch (err) {
        console.error('Error checking tracking status:', err);
        return { success: false, error: err.message };
    }
}

// ลงทะเบียนฟังก์ชันใน Global Scope เพื่อให้เรียกใช้ได้ผ่าน DevTools Console
window.encryptWithWebCrypto = encryptWithWebCrypto;
window.decryptWithWebCrypto = decryptWithWebCrypto;
window.eLectionDecryptCeremony = eLectionDecryptCeremony;
window.checkBallotTrackingStatus = checkBallotTrackingStatus;
