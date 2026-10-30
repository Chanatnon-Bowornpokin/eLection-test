/**
 * Script ควบคุมหน้าลงคะแนน (Vote.html)
 * - รองรับ 2 เหตุการณ์:
 *   1. ประชามติ (referendum-2569-03): บัตรใบเดียว (เห็นชอบ / ไม่เห็นชอบ) -> ไม่มีปุ่มย้อนกลับ
 *   2. เลือกตั้ง ส.ส. (house-election-2569): บัตร 2 ใบ (แบ่งเขต 20 เบอร์ -> บัญชีรายชื่อ 20 เบอร์)
 *      - ใบที่ 1: ไม่มีปุ่มย้อนกลับ มีเฉพาะปุ่มถัดไป
 *      - ใบที่ 2: มีปุ่มย้อนกลับ (กลับไปแก้ใบที่ 1) และปุ่มถัดไป (ยืนยันส่งคะแนน)
 * - มีแถวหัวตาราง "เบอร์ / ช่องลงคะแนน" ตาม Figma
 * - เครื่องหมายกากบาทเป็น Guide สีเทาจาง เมื่อเลือกแถวจะกลายเป็นกากบาทสีแดงสด
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
    const heroImg = document.getElementById('voteHeroImg');
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

// ตัวแปรสถานะขั้นตอนการลงคะแนน (Step 1 หรือ Step 2)
let currentStep = 1;
let selectedBallot1 = null; // ผลเลือกบัตรใบที่ 1
let selectedBallot2 = null; // ผลเลือกบัตรใบที่ 2

function renderCurrentBallot(currentEventId) {
    const ballotBody = document.getElementById('ballotBody');
    const voteTitle = document.getElementById('voteTitle');
    const voteDesc = document.getElementById('voteDesc');
    const abstainLabel = document.getElementById('abstainLabel');
    const backBtn = document.getElementById('backBtn');
    const nextBtn = document.getElementById('nextBtn');
    if (!ballotBody) return;

    const isReferendum = (currentEventId === 'referendum-2569-03');

    if (isReferendum) {
        // --- 1. บัตรออกเสียงประชามติ (มีใบเดียว) ---
        voteTitle.innerHTML = '<span class="phrase">ออกเสียงประชามติ :</span> <span class="phrase">ท่านเห็นชอบว่า</span><span class="phrase">สมควรมีรัฐธรรมนูญฉบับใหม่หรือไม่</span>';
        voteDesc.innerHTML = 'โปรดเลือก "เห็นชอบ" หรือ "ไม่เห็นชอบ" เพียง 1 ตัวเลือก<br>หรือเลือกไม่แสดงความคิดเห็น';
        abstainLabel.innerHTML = 'ไม่แสดง<br>ความคิดเห็น';

        // ประชามติไม่มีปุ่มย้อนกลับ
        if (backBtn) backBtn.style.display = 'none';

        ballotBody.innerHTML = `
            <div class="referendum-table-grid" role="radiogroup" aria-label="ตัวเลือกการออกเสียงประชามติ">
                <!-- ฝั่งซ้าย: เห็นชอบ -->
                <div class="referendum-table-col">
                    <div class="referendum-col-header">เห็นชอบ</div>
                    <div class="referendum-col-box" data-value="approve" role="radio" aria-checked="false" tabindex="0">
                        <i class="fa-solid fa-xmark vote-cross-mark" aria-hidden="true"></i>
                    </div>
                </div>

                <!-- ฝั่งขวา: ไม่เห็นชอบ -->
                <div class="referendum-table-col">
                    <div class="referendum-col-header">ไม่เห็นชอบ</div>
                    <div class="referendum-col-box" data-value="disapprove" role="radio" aria-checked="false" tabindex="0">
                        <i class="fa-solid fa-xmark vote-cross-mark" aria-hidden="true"></i>
                    </div>
                </div>
            </div>
        `;
    } else {
        // --- 2. การเลือกตั้ง ส.ส. (2 ใบ) ---
        if (currentStep === 1) {
            // บัตรใบที่ 1: ส.ส. แบบแบ่งเขต
            voteTitle.innerHTML = '<span class="phrase">ลงคะแนน ใบที่ 1 :</span> <span class="phrase">เลือก ส.ส. แบบแบ่งเขต</span>';
            voteDesc.innerHTML = 'โปรดเลือกผู้สมัครที่ต้องการลงคะแนนเพียง 1 หมายเลข<br>หรือเลือกไม่ประสงค์ลงคะแนน';
            abstainLabel.innerHTML = 'ไม่ประสงค์<br>ลงคะแนน';

            // บัตรใบแรกไม่มีปุ่มย้อนกลับเด็ดขาด
            if (backBtn) backBtn.style.display = 'none';
        } else {
            // บัตรใบที่ 2: ส.ส. แบบบัญชีรายชื่อ
            voteTitle.innerHTML = '<span class="phrase">ลงคะแนน ใบที่ 2 :</span> <span class="phrase">เลือก ส.ส. แบบบัญชีรายชื่อ</span>';
            voteDesc.innerHTML = 'โปรดเลือกหมายเลขพรรคเพียง 1 หมายเลข<br>หรือ เลือกไม่ประสงค์ลงคะแนน';
            abstainLabel.innerHTML = 'ไม่ประสงค์<br>ลงคะแนน';

            // บัตรใบที่ 2 มีปุ่มย้อนกลับ
            if (backBtn) backBtn.style.display = 'inline-flex';
        }

        // สร้างตาราง 20 เบอร์ พร้อมหัวตาราง [เบอร์ | ช่องลงคะแนน]
        let colLeftHtml = `
            <div class="ballot-header-row">
                <div class="ballot-header-cell-num">เบอร์</div>
                <div class="ballot-header-cell-mark">ช่องลงคะแนน</div>
            </div>
        `;
        for (let i = 1; i <= 10; i++) {
            colLeftHtml += `
                <div class="ballot-row" data-value="${i}" role="radio" aria-checked="false" tabindex="0">
                    <div class="ballot-cell-num">${i}</div>
                    <div class="ballot-cell-mark">
                        <i class="fa-solid fa-xmark vote-cross-mark" aria-hidden="true"></i>
                    </div>
                </div>
            `;
        }

        let colRightHtml = `
            <div class="ballot-header-row">
                <div class="ballot-header-cell-num">เบอร์</div>
                <div class="ballot-header-cell-mark">ช่องลงคะแนน</div>
            </div>
        `;
        for (let i = 11; i <= 20; i++) {
            colRightHtml += `
                <div class="ballot-row" data-value="${i}" role="radio" aria-checked="false" tabindex="0">
                    <div class="ballot-cell-num">${i}</div>
                    <div class="ballot-cell-mark">
                        <i class="fa-solid fa-xmark vote-cross-mark" aria-hidden="true"></i>
                    </div>
                </div>
            `;
        }

        ballotBody.innerHTML = `
            <div class="mp-ballot-grid" role="radiogroup" aria-label="ตาราง 20 หมายเลข">
                <div class="mp-ballot-column">
                    ${colLeftHtml}
                </div>
                <div class="mp-ballot-column">
                    ${colRightHtml}
                </div>
            </div>
        `;
    }

    // ฟื้นฟูค่าที่เคยเลือกไว้ใน Step นี้ (ถ้ามี)
    const currentVal = (currentStep === 1) ? selectedBallot1 : selectedBallot2;
    applySelectionVisual(currentVal);

    setupSelectionEvents(currentEventId);
}

function applySelectionVisual(value) {
    const allSelectables = document.querySelectorAll('.ballot-row, .referendum-col-box, .vote-abstain-row');
    allSelectables.forEach(el => {
        const isMatch = (el.dataset.value === value) || (el.id === 'abstainRow' && value === 'abstain');
        el.classList.toggle('is-selected', Boolean(isMatch));
        el.setAttribute('aria-checked', isMatch ? 'true' : 'false');
    });

    const nextBtn = document.getElementById('nextBtn');
    if (nextBtn) {
        nextBtn.disabled = !value;
    }
}

function setSelection(value) {
    if (currentStep === 1) {
        selectedBallot1 = value;
    } else {
        selectedBallot2 = value;
    }
    applySelectionVisual(value);
}

function setupSelectionEvents(currentEventId) {
    const ballotItems = document.querySelectorAll('.ballot-row, .referendum-col-box');
    const abstainRow = document.getElementById('abstainRow');
    const backBtn = document.getElementById('backBtn');
    const nextBtn = document.getElementById('nextBtn');

    ballotItems.forEach(item => {
        const val = item.dataset.value;
        item.addEventListener('click', () => setSelection(val));
        item.addEventListener('keydown', (e) => {
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                setSelection(val);
            }
        });
    });

    if (abstainRow) {
        abstainRow.addEventListener('click', () => setSelection('abstain'));
        abstainRow.addEventListener('keydown', (e) => {
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                setSelection('abstain');
            }
        });
    }

    // ปุ่มย้อนกลับ (มีเฉพาะในใบที่ 2)
    if (backBtn) {
        backBtn.onclick = () => {
            if (currentStep === 2) {
                currentStep = 1;
                renderCurrentBallot(currentEventId);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        };
    }

    // ปุ่มถัดไป
    if (nextBtn) {
        nextBtn.onclick = () => {
            const isReferendum = (currentEventId === 'referendum-2569-03');

            if (isReferendum) {
                // บันทึกตัวเลือกประชามติ แล้วไปหน้าตรวจทานและยืนยันการส่งคะแนน
                try {
                    localStorage.setItem(`vote-choice-${currentEventId}-b1`, selectedBallot1 || 'approve');
                } catch (e) {}
                window.location.href = `Vote-Review.html?id=${encodeURIComponent(currentEventId)}`;
            } else {
                if (currentStep === 1) {
                    // จบใบที่ 1 บันทึกค่า แล้วสลับไปใบที่ 2
                    try {
                        localStorage.setItem(`vote-choice-${currentEventId}-b1`, selectedBallot1);
                    } catch (e) {}
                    currentStep = 2;
                    renderCurrentBallot(currentEventId);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                    // จบใบที่ 2 บันทึกค่า แล้วไปหน้าตรวจทานและยืนยันการส่งคะแนน
                    try {
                        localStorage.setItem(`vote-choice-${currentEventId}-b2`, selectedBallot2);
                    } catch (e) {}
                    window.location.href = `Vote-Review.html?id=${encodeURIComponent(currentEventId)}`;
                }
            }
        };
    }
}

function saveVoteAndFinish(currentEventId) {
    try {
        const statusKey = 'election-vote-status';
        const status = JSON.parse(localStorage.getItem(statusKey) || '{}');
        status[currentEventId] = true;
        localStorage.setItem(statusKey, JSON.stringify(status));
    } catch (err) {
        console.warn('LocalStorage error:', err);
    }

    const message = (currentEventId === 'referendum-2569-03')
        ? `บันทึกการออกเสียงประชามติเรียบร้อยแล้ว`
        : `บันทึกการลงคะแนน ส.ส. ทั้ง 2 ใบเรียบร้อยแล้ว\n(ใบที่ 1: เบอร์ ${selectedBallot1}, ใบที่ 2: เบอร์ ${selectedBallot2})`;

    alert(message);
    window.location.href = `Vote-Check.html?id=${encodeURIComponent(currentEventId)}`;
}

document.addEventListener('DOMContentLoaded', () => {
    const currentEventId = getCurrentEventId();

    // ตรวจสอบ query param step ว่าระบุกลับมาแก้ไขใบที่เท่าไหร่ เช่น &step=2
    const urlParams = new URLSearchParams(window.location.search);
    const stepParam = parseInt(urlParams.get('step'), 10);
    if (stepParam === 1 || stepParam === 2) {
        currentStep = stepParam;
    }

    // ดึงค่าที่เคยบันทึกไว้กลับมา (ถ้ามี)
    selectedBallot1 = localStorage.getItem(`vote-choice-${currentEventId}-b1`) || null;
    selectedBallot2 = localStorage.getItem(`vote-choice-${currentEventId}-b2`) || null;

    initHeroBanner(currentEventId);
    renderCurrentBallot(currentEventId);
});
