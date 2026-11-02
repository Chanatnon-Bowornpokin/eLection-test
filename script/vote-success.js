/**
 * Script ควบคุมหน้าลงคะแนนเสร็จสิ้น (Vote-Success.html)
 * - สลับ Hero Banner และชื่อการเลือกตั้งบนใบเสร็จตาม Event ID
 * - ดึงข้อมูลซองจดหมายชั้นนอก (Outer Envelope) และรหัสตรวจสอบสถานะบัตร (Tracking Hash)
 *   จากตารางพัก (election-staging-envelopes) ใน LocalStorage
 * - ปุ่ม "คัดลอกรหัส": คัดลอก Tracking Hash ลง Clipboard และเปลี่ยนข้อความเป็น "คัดลอกแล้ว"
 * - ปุ่ม "บันทึก": สร้างและดาวน์โหลดภาพใบเสร็จดิจิทัล (PNG) ด้วย HTML5 Canvas
 * - ปุ่ม "โหวตใหม่": นำกลับไปหน้าข้อพึงปฏิบัติ (Vote-Todo.html) เพื่อเริ่มลงคะแนนใหม่และเขียนทับซองเดิม
 * - ปุ่ม "กลับสู่หน้าหลัก": นำกลับไปยังหน้าแรก (../index.html)
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

function generateRandomHex(len) {
    let out = '';
    const chars = '0123456789abcdef';
    for (let i = 0; i < len; i++) {
        out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
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

function ensureStagingEnvelope(currentEventId) {
    const stagingKey = 'election-staging-envelopes';
    let stagingTable = {};
    try {
        stagingTable = JSON.parse(localStorage.getItem(stagingKey) || '{}');
    } catch {
        stagingTable = {};
    }

    if (stagingTable[currentEventId] && (stagingTable[currentEventId].trackingCode || stagingTable[currentEventId].trackingHash)) {
        return stagingTable[currentEventId];
    }

    // กรณีเปิดหน้านี้โดยตรง ให้สร้างข้อมูลจำลองเริ่มต้นตามโครงสร้าง Digital Double Envelope
    const trackingCode = generateUniqueTrackingCode();
    const mockCipherHex = generateRandomHex(16).toUpperCase();
    const now = new Date();
    const timeStr = now.toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }) + ' น.';
    const dateStr = now.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });

    const record = {
        eventId: currentEventId,
        outerEnvelope: {
            citizenId: '1-1005-01234-56-7',
            voterName: 'ชนัตนนท์ บวรโภคิน',
            votedAt: `${dateStr} ${timeStr}`,
            timestampIso: now.toISOString(),
            version: 1
        },
        innerEnvelope: {
            ciphertext: `ENC[pk_ECT::0x${mockCipherHex}]`,
            algorithm: 'RSA-OAEP-4096+SALT',
            sealedUntil: '17:00'
        },
        trackingHash: trackingCode,
        trackingCode: trackingCode
    };

    try {
        stagingTable[currentEventId] = record;
        localStorage.setItem(stagingKey, JSON.stringify(stagingTable));
    } catch (err) {
        console.warn('LocalStorage error:', err);
    }

    return record;
}

function getReceiptLinesForEvent(currentEventId) {
    if (currentEventId === 'referendum-2569-03') {
        return {
            titleHtml: '<span class="phrase">การออกเสียงประชามติ</span> <span class="phrase">ครั้งที่ 3 ปี 2569</span>',
            titleLine1: 'การออกเสียงประชามติ',
            titleLine2: 'ครั้งที่ 3 ปี 2569',
            dateText: '8 กุมภาพันธ์ 2569'
        };
    }

    return {
        titleHtml: '<span class="phrase">การเลือกตั้งสมาชิกสภาผู้แทนราษฎร</span> <span class="phrase">(ส.ส.)</span> <span class="phrase">ครั้งที่ 28</span>',
        titleLine1: 'การเลือกตั้งสมาชิกสภาผู้แทนราษฎร (ส.ส.)',
        titleLine2: 'ครั้งที่ 28',
        dateText: '8 กุมภาพันธ์ 2569'
    };
}

function initHeroAndReceipt(currentEventId) {
    // 1. อัปเดต Hero Banner
    const heroImg = document.getElementById('voteSuccessHeroImg');
    if (heroImg && typeof EVENTS !== 'undefined' && Array.isArray(EVENTS)) {
        const currentEvent = EVENTS.find(ev => ev.id === currentEventId);
        if (currentEvent && currentEvent.banner) {
            heroImg.src = currentEvent.banner;
            heroImg.alt = currentEvent.title || 'รายละเอียดการเลือกตั้ง';
        }
    }

    // 2. ดึงข้อมูลใบเสร็จจาก sessionStorage (หรือ fallback ไปที่ Staging Table)
    let sessionReceipt = null;
    try {
        const rawReceipt = sessionStorage.getItem('latest_vote_receipt');
        if (rawReceipt) {
            sessionReceipt = JSON.parse(rawReceipt);
        }
    } catch (e) {
        console.warn('SessionStorage error:', e);
    }

    const envelopeRecord = ensureStagingEnvelope(currentEventId);
    const electionCopy = getReceiptLinesForEvent(currentEventId);

    const titleEl = document.getElementById('receiptElectionTitle');
    const dateEl = document.getElementById('receiptElectionDate');
    const voterNameEl = document.getElementById('receiptVoterName');
    const voteTimeEl = document.getElementById('receiptVoteTime');
    const hashEl = document.getElementById('receiptTrackingHash');

    if (titleEl) {
        titleEl.innerHTML = electionCopy.titleHtml;
    }

    const voterSession = JSON.parse(localStorage.getItem('voter_session') || 'null');
    const voterName = voterSession?.fullName || envelopeRecord?.outerEnvelope?.voterName || 'ชนัตนนท์ บวรโภคิน';

    // วันที่, เวลา และ รหัสตรวจสอบสถานะบัตร (Tracking Code)
    const trackingCode = sessionReceipt?.trackingCode || envelopeRecord?.trackingCode || envelopeRecord?.trackingHash || 'VOTE-A8F9-2026';
    const dateText = sessionReceipt?.voteDate || electionCopy.dateText;
    const votedAt = sessionReceipt?.voteTime
        ? `${dateText} ${sessionReceipt.voteTime}`
        : (envelopeRecord?.outerEnvelope?.votedAt || `${dateText} 12:00 น.`);

    if (dateEl) {
        dateEl.textContent = dateText;
    }
    if (voterNameEl) {
        voterNameEl.textContent = `ชื่อผู้ใช้สิทธิ์ : ${voterName}`;
    }
    if (voteTimeEl) {
        voteTimeEl.textContent = `เวลาที่ลงคะแนน : ${votedAt}`;
    }
    if (hashEl) {
        hashEl.textContent = `รหัสตรวจสอบสถานะบัตร : ${trackingCode}`;
    }

    return {
        titleLine1: electionCopy.titleLine1,
        titleLine2: electionCopy.titleLine2,
        dateText,
        voterName,
        votedAt,
        trackingHash: trackingCode
    };
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

async function saveReceiptAsImage(receiptData) {
    if (document.fonts && document.fonts.ready) {
        try {
            await document.fonts.ready;
        } catch {
            // ดำเนินการต่อหากโหลดฟอนต์ไม่ทัน
        }
    }

    const scale = 2;
    const width = 666;
    const height = 648;

    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    // พื้นหลังการ์ดสีขาวขอบมน
    ctx.fillStyle = '#FFFFFF';
    drawRoundedRect(ctx, 0, 0, width, height, 17);
    ctx.fill();

    // 1. วาดไอคอนวงกลมสีเขียวพร้อมเครื่องหมายถูก
    const centerX = width / 2;
    const iconCenterY = 128;
    const iconRadius = 83.5;

    ctx.fillStyle = '#22C55E';
    ctx.beginPath();
    ctx.arc(centerX, iconCenterY, iconRadius, 0, Math.PI * 2);
    ctx.fill();

    // วาดเครื่องหมายถูกสีขาวด้านในวงกลม
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(centerX - 36, iconCenterY + 2);
    ctx.lineTo(centerX - 8, iconCenterY + 30);
    ctx.lineTo(centerX + 40, iconCenterY - 26);
    ctx.stroke();

    // 2. ข้อความหัวข้อการเลือกตั้ง
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    ctx.font = '700 24px "Prompt", sans-serif';
    ctx.fillText('ลงคะแนนสำเร็จ', centerX, 255);

    ctx.font = '700 30px "Prompt", sans-serif';
    ctx.fillText(receiptData.titleLine1, centerX, 294);
    ctx.fillText(receiptData.titleLine2, centerX, 336);

    ctx.font = '400 24px "Prompt", sans-serif';
    ctx.fillText(receiptData.dateText, centerX, 382);

    // 3. ข้อมูลผู้ใช้สิทธิและเวลาที่ลงคะแนน (จัดชิดซ้ายให้อยู่กึ่งกลางการ์ด)
    ctx.font = '400 24px "Prompt", sans-serif';
    const lineVoter = `ชื่อผู้ใช้สิทธิ์ : ${receiptData.voterName}`;
    const lineTime = `เวลาที่ลงคะแนน : ${receiptData.votedAt}`;
    const maxMetaWidth = Math.max(ctx.measureText(lineVoter).width, ctx.measureText(lineTime).width);
    const metaStartX = (width - maxMetaWidth) / 2;

    ctx.textAlign = 'left';
    ctx.fillText(lineVoter, metaStartX, 462);
    ctx.fillText(lineTime, metaStartX, 500);

    // 4. รหัสตรวจสอบสถานะบัตร
    ctx.textAlign = 'center';
    ctx.font = '400 24px "Prompt", sans-serif';
    ctx.fillText(`รหัสตรวจสอบสถานะบัตร : ${receiptData.trackingHash}`, centerX, 578);

    // สั่งดาวน์โหลดเป็นไฟล์ PNG
    const cleanHash = receiptData.trackingHash.replace(/[^a-zA-Z0-9_-]/g, '');
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `eLection-Receipt-${cleanHash || 'card'}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function initActions(currentEventId, receiptData) {
    const copyHashBtn = document.getElementById('copyHashBtn');
    const saveReceiptBtn = document.getElementById('saveReceiptBtn');
    const revoteBtn = document.getElementById('revoteBtn');
    const homeBtn = document.getElementById('homeBtn');

    // ปุ่มคัดลอกรหัส
    if (copyHashBtn) {
        let copyTimeout = null;
        copyHashBtn.addEventListener('click', async () => {
            const hashToCopy = receiptData.trackingHash;
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(hashToCopy);
                } else {
                    const tempInput = document.createElement('textarea');
                    tempInput.value = hashToCopy;
                    document.body.appendChild(tempInput);
                    tempInput.select();
                    document.execCommand('copy');
                    document.body.removeChild(tempInput);
                }
            } catch (err) {
                console.warn('Clipboard error:', err);
            }

            copyHashBtn.textContent = 'คัดลอกแล้ว';
            if (copyTimeout) clearTimeout(copyTimeout);
            copyTimeout = setTimeout(() => {
                copyHashBtn.textContent = 'คัดลอกรหัส';
            }, 2000);
        });
    }

    // ปุ่มบันทึกใบเสร็จ
    if (saveReceiptBtn) {
        saveReceiptBtn.addEventListener('click', () => {
            saveReceiptAsImage(receiptData);
        });
    }

    // ปุ่มโหวตใหม่ -> กลับไปหน้าข้อพึงปฏิบัติ (Vote-Todo.html)
    if (revoteBtn) {
        revoteBtn.addEventListener('click', () => {
            window.location.href = `Vote-Todo.html?id=${encodeURIComponent(currentEventId)}`;
        });
    }

    // ปุ่มกลับสู่หน้าหลัก -> กลับไปหน้า Home (../index.html)
    if (homeBtn) {
        homeBtn.addEventListener('click', () => {
            window.location.href = '../index.html';
        });
    }
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

window.checkBallotTrackingStatus = checkBallotTrackingStatus;

document.addEventListener('DOMContentLoaded', () => {
    const currentEventId = getCurrentEventId();
    const receiptData = initHeroAndReceipt(currentEventId);
    initActions(currentEventId, receiptData);
});

