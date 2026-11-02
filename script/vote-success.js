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
    let eventId = urlParams.get('id');

    // ถ้าไม่มี id ใน URL ลองดูจาก latest_vote_receipt ใน sessionStorage
    if (!eventId) {
        try {
            const rawReceipt = sessionStorage.getItem('latest_vote_receipt');
            if (rawReceipt) {
                const parsed = JSON.parse(rawReceipt);
                if (parsed.eventId) eventId = parsed.eventId;
            }
        } catch {}
    }

    if (eventId && typeof EVENTS !== 'undefined' && Array.isArray(EVENTS)) {
        const found = EVENTS.find(ev => ev.id === eventId);
        if (found) return found.id;
    }

    if (eventId) return eventId;

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
 * สร้าง Unique Tracking Hash สุ่มเลขฐาน 16 จำนวน 4 ชุด คั่นด้วยขีด เช่น #a8f9-4c2e-991b-88ff
 */
function generateTrackingHash() {
    const hex = (len) => {
        if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
            const bytes = new Uint8Array(len);
            window.crypto.getRandomValues(bytes);
            return Array.from(bytes, b => (b % 16).toString(16)).join('');
        }
        let out = '';
        for (let i = 0; i < len; i++) {
            out += Math.floor(Math.random() * 16).toString(16);
        }
        return out;
    };
    return `#${hex(4)}-${hex(4)}-${hex(4)}-${hex(4)}`;
}

function formatThaiDateTime(date = new Date()) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}:${seconds} น.`;

    const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const day = date.getDate();
    const month = thaiMonths[date.getMonth()];
    const year = date.getFullYear() + 543;

    return `${timeStr} วันที่ ${day} ${month} ${year}`;
}

function ensureStagingEnvelope(currentEventId) {
    const stagingKey = 'election-staging-envelopes';
    let stagingTable = {};
    try {
        stagingTable = JSON.parse(localStorage.getItem(stagingKey) || '{}');
    } catch {
        stagingTable = {};
    }

    if (stagingTable[currentEventId] && (stagingTable[currentEventId].trackingHash || stagingTable[currentEventId].trackingCode)) {
        return stagingTable[currentEventId];
    }

    // กรณีเปิดหน้านี้โดยตรง ให้ดึงตัวตนจาก election_current_voter หรือ fallback
    const voter = JSON.parse(localStorage.getItem('election_current_voter') || 'null') ||
                  JSON.parse(localStorage.getItem('voter_session') || 'null') || {
        citizen_id: '9-1001-50001-01-1',
        full_name_th: 'นายกิตติศักดิ์ เพิ่มมงคล',
        district_info: 'เขต 1 (พระนคร) กรุงเทพมหานคร'
    };

    const trackingHash = generateTrackingHash();
    const mockCipherHex = generateRandomHex(16).toUpperCase();
    const now = new Date();
    const votedAtText = formatThaiDateTime(now);

    const record = {
        eventId: currentEventId,
        outerEnvelope: {
            citizenId: voter.citizen_id || voter.citizenId || '9-1001-50001-01-1',
            voterName: voter.full_name_th || voter.fullName || 'นายกิตติศักดิ์ เพิ่มมงคล',
            districtInfo: voter.district_info || voter.districtInfo || 'เขต 1 (พระนคร) กรุงเทพมหานคร',
            votedAt: votedAtText,
            timestampIso: now.toISOString(),
            version: 1
        },
        innerEnvelope: {
            ciphertext: `ENC[pk_ECT::0x${mockCipherHex}]`,
            algorithm: 'RSA-OAEP-4096+SALT',
            sealedUntil: '17:00'
        },
        trackingHash: trackingHash,
        trackingCode: trackingHash
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
    const event = (typeof EVENTS !== 'undefined' && Array.isArray(EVENTS))
        ? EVENTS.find(ev => ev.id === currentEventId)
        : null;

    const isReferendum = (event?.type === 'referendum') ||
                         currentEventId.toLowerCase().includes('referendum') ||
                         currentEventId.toLowerCase().includes('ref');

    if (isReferendum) {
        return {
            titleHtml: '<span class="phrase">การออกเสียงประชามติ</span> <span class="phrase">ครั้งที่ 3 ปี 2569</span>',
            titleLine1: 'การออกเสียงประชามติ',
            titleLine2: 'ครั้งที่ 3 ปี 2569',
            dateText: '8 กุมภาพันธ์ 2569',
            isReferendum: true,
            eventType: 'referendum'
        };
    }

    return {
        titleHtml: '<span class="phrase">การเลือกตั้งสมาชิกสภาผู้แทนราษฎร</span> <span class="phrase">(ส.ส.)</span> <span class="phrase">ครั้งที่ 28</span>',
        titleLine1: 'การเลือกตั้งสมาชิกสภาผู้แทนราษฎร (ส.ส.)',
        titleLine2: 'ครั้งที่ 28',
        dateText: '8 กุมภาพันธ์ 2569',
        isReferendum: false,
        eventType: 'general-election'
    };
}

function initHeroAndReceipt(currentEventId) {
    const currentEvent = (typeof EVENTS !== 'undefined' && Array.isArray(EVENTS))
        ? EVENTS.find(ev => ev.id === currentEventId)
        : null;

    // 1. อัปเดต Hero Banner
    const heroImg = document.getElementById('voteSuccessHeroImg');
    if (heroImg && currentEvent && currentEvent.banner) {
        heroImg.src = currentEvent.banner;
        heroImg.alt = currentEvent.title || 'รายละเอียดการเลือกตั้ง';
    }

    // 2. ดึงข้อมูลใบเสร็จจาก sessionStorage (หรือ fallback ไปที่ localStorage)
    let sessionReceipt = null;
    try {
        const rawReceipt = sessionStorage.getItem('latest_vote_receipt');
        if (rawReceipt) {
            sessionReceipt = JSON.parse(rawReceipt);
        }
    } catch (e) {
        console.warn('SessionStorage error:', e);
    }

    const currentVoter = JSON.parse(localStorage.getItem('election_current_voter') || 'null') ||
                         JSON.parse(localStorage.getItem('voter_session') || 'null') || {
        citizen_id: '9-1001-50001-01-1',
        full_name_th: 'นายกิตติศักดิ์ เพิ่มมงคล',
        district_info: 'เขต 1 (พระนคร) กรุงเทพมหานคร'
    };

    const envelopeRecord = ensureStagingEnvelope(currentEventId);
    const electionCopy = getReceiptLinesForEvent(currentEventId);

    const isReferendum = (sessionReceipt?.eventType === 'referendum') ||
                         (sessionReceipt?.isReferendum === true) ||
                         (currentEvent?.type === 'referendum') ||
                         electionCopy.isReferendum;

    const titleEl = document.getElementById('receiptElectionTitle');
    const dateEl = document.getElementById('receiptElectionDate');
    const voterNameEl = document.getElementById('receiptVoterName');
    const districtRowEl = document.getElementById('receiptDistrictRow');
    const districtInfoEl = document.getElementById('receiptDistrictInfo');
    const voteTimeEl = document.getElementById('receiptVoteTime');
    const hashEl = document.getElementById('receiptTrackingHash');

    if (titleEl) {
        titleEl.innerHTML = electionCopy.titleHtml;
    }
    if (dateEl) {
        dateEl.textContent = electionCopy.dateText;
    }

    const voterName = sessionReceipt?.fullName || currentVoter?.full_name_th || currentVoter?.fullName || envelopeRecord?.outerEnvelope?.voterName || 'นายกิตติศักดิ์ เพิ่มมงคล';
    const districtInfo = sessionReceipt?.districtInfo || currentVoter?.district_info || currentVoter?.districtInfo || envelopeRecord?.outerEnvelope?.districtInfo || 'เขต 1 (พระนคร) กรุงเทพมหานคร';
    const trackingHash = sessionReceipt?.trackingHash || sessionReceipt?.trackingCode || envelopeRecord?.trackingHash || envelopeRecord?.trackingCode || generateTrackingHash();
    const voteTime = sessionReceipt?.voteTime || envelopeRecord?.outerEnvelope?.votedAt || formatThaiDateTime(new Date());

    if (voterNameEl) {
        voterNameEl.textContent = `ชื่อผู้ใช้สิทธิ์ : ${voterName}`;
    }

    // จัดการแถวเขตเลือกตั้ง: หากเป็นประชามติ ให้ซ่อนแถวเขตเลือกตั้งทันที
    if (isReferendum) {
        if (districtRowEl) {
            districtRowEl.style.display = 'none';
        } else if (districtInfoEl) {
            districtInfoEl.style.display = 'none';
            if (districtInfoEl.nextElementSibling && districtInfoEl.nextElementSibling.tagName === 'BR') {
                districtInfoEl.nextElementSibling.style.display = 'none';
            }
        }
    } else {
        if (districtRowEl) {
            districtRowEl.style.display = '';
        } else if (districtInfoEl) {
            districtInfoEl.style.display = '';
            if (districtInfoEl.nextElementSibling && districtInfoEl.nextElementSibling.tagName === 'BR') {
                districtInfoEl.nextElementSibling.style.display = '';
            }
        }
        if (districtInfoEl) {
            districtInfoEl.textContent = `เขตเลือกตั้ง : ${districtInfo}`;
        }
    }

    if (voteTimeEl) {
        voteTimeEl.textContent = `เวลาที่ลงคะแนน : ${voteTime}`;
    }
    if (hashEl) {
        hashEl.textContent = `รหัสตรวจสอบสถานะบัตร : ${trackingHash}`;
    }

    return {
        titleLine1: electionCopy.titleLine1,
        titleLine2: electionCopy.titleLine2,
        dateText: electionCopy.dateText,
        voterName,
        districtInfo,
        votedAt: voteTime,
        trackingHash,
        isReferendum
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

    // 3. ข้อมูลผู้ใช้สิทธิ เขตเลือกตั้ง และเวลาที่ลงคะแนน (จัดชิดซ้ายให้อยู่กึ่งกลางการ์ด)
    ctx.font = '400 24px "Prompt", sans-serif';
    const lineVoter = `ชื่อผู้ใช้สิทธิ์ : ${receiptData.voterName}`;
    const lineDistrict = `เขตเลือกตั้ง : ${receiptData.districtInfo || '-'}`;
    const lineTime = `เวลาที่ลงคะแนน : ${receiptData.votedAt}`;

    ctx.textAlign = 'left';
    if (receiptData.isReferendum) {
        // ประชามติไม่มีการแบ่งเขต -> วาดเฉพาะชื่อผู้ใช้สิทธิและเวลาที่ลงคะแนน
        const maxMetaWidth = Math.max(
            ctx.measureText(lineVoter).width,
            ctx.measureText(lineTime).width
        );
        const metaStartX = (width - maxMetaWidth) / 2;
        ctx.fillText(lineVoter, metaStartX, 452);
        ctx.fillText(lineTime, metaStartX, 496);
    } else {
        // การเลือกตั้ง ส.ส. -> แสดงครบทั้งชื่อผู้ใช้สิทธิ์ เขตเลือกตั้ง และเวลา
        const maxMetaWidth = Math.max(
            ctx.measureText(lineVoter).width,
            ctx.measureText(lineDistrict).width,
            ctx.measureText(lineTime).width
        );
        const metaStartX = (width - maxMetaWidth) / 2;
        ctx.fillText(lineVoter, metaStartX, 436);
        ctx.fillText(lineDistrict, metaStartX, 474);
        ctx.fillText(lineTime, metaStartX, 512);
    }

    // 4. รหัสตรวจสอบสถานะบัตร
    ctx.textAlign = 'center';
    ctx.font = '400 24px "Prompt", sans-serif';
    ctx.fillText(`รหัสตรวจสอบสถานะบัตร : ${receiptData.trackingHash}`, centerX, 580);

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

