/**
 * Script ควบคุมหน้ากรอกรหัส OTP (Vote-Verify-Otp.html)
 * - สลับ Banner ตาม Event ID (เลือกตั้ง / ลงประชามติ)
 * - แสดงและจัดการช่องกรอกรหัส 6 หลัก (Auto-tab, Backspace, Paste)
 * - แสดง Mock SMS Toast แจ้งเตือนรหัส OTP จำลอง พร้อมปุ่มกรอกอัตโนมัติ
 * - ระบบนับเวลาถอยหลัง (Countdown Timer) และปุ่มขอรหัสใหม่
 * - ปุ่ม "ย้อนกลับ", "ถัดไป" และลิงก์สลับไปยืนยันด้วย PIN
 */

// ดึง event id จาก URL query parameter เช่น ?id=house-election-2569
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

// 1. จัดการแสดงผล Hero Banner ตาม eventId ปัจจุบัน
function initHeroBanner(currentEventId) {
    const bannerImg = document.getElementById('voteVerifyHeroImg');
    if (!bannerImg) return;

    let currentEvent = null;
    if (typeof EVENTS !== 'undefined' && Array.isArray(EVENTS)) {
        currentEvent = EVENTS.find(ev => ev.id === currentEventId);
    }

    if (currentEvent && currentEvent.banner) {
        bannerImg.src = currentEvent.banner;
        bannerImg.alt = currentEvent.title || 'รายละเอียดการเลือกตั้ง';
    }
}

// สถานะของ OTP
let currentMockOtp = '';
let currentRefCode = 'AB12';
let countdownInterval = null;
let remainingSeconds = 90;
let toastAutoDismissTimer = null;

// สุ่มรหัส Ref Code 4 ตัวอักษร
function generateRefCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 4; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// สุ่มรหัส OTP 6 หลัก
function generateOtpCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function issueOtpCode() {
    currentMockOtp = generateOtpCode();
    try {
        sessionStorage.setItem('current_session_otp', currentMockOtp);
    } catch (error) {
        console.warn('Cannot store session OTP', error);
    }
}

function getCurrentSessionOtp() {
    try {
        return sessionStorage.getItem('current_session_otp') || '';
    } catch {
        return currentMockOtp;
    }
}

// อัปเดตรหัสอ้างอิงและรหัส OTP ในหน้าเว็บ
function updateOtpDisplay() {
    const refTextEl = document.getElementById('otpRefText');
    const smsRefEl = document.getElementById('mockSmsRef');
    const smsCodeEl = document.getElementById('mockSmsCode');

    if (refTextEl) refTextEl.textContent = `(รหัสอ้างอิง: ${currentRefCode})`;
    if (smsRefEl) smsRefEl.textContent = `(Ref: ${currentRefCode})`;
    if (smsCodeEl) smsCodeEl.textContent = currentMockOtp;
}

// แสดงการ์ด Mock SMS Notification พร้อมตั้งเวลาหายไปเองใน 10 วินาที
function showMockSmsToast() {
    const toast = document.getElementById('mockSmsToast');
    if (!toast) return;

    if (toastAutoDismissTimer) {
        clearTimeout(toastAutoDismissTimer);
        toastAutoDismissTimer = null;
    }

    updateOtpDisplay();
    toast.classList.add('show');

    // ค้างไว้ประมาณ 10 วินาทีแล้วค่อยซ่อนอัตโนมัติ
    toastAutoDismissTimer = setTimeout(() => {
        hideMockSmsToast();
    }, 10000);
}

// ซ่อนการ์ด Mock SMS
function hideMockSmsToast() {
    const toast = document.getElementById('mockSmsToast');
    if (toast) {
        toast.classList.remove('show');
    }
    if (toastAutoDismissTimer) {
        clearTimeout(toastAutoDismissTimer);
        toastAutoDismissTimer = null;
    }
}

// นับเวลาถอยหลัง (Countdown Timer)
function startCountdown() {
    const countdownEl = document.getElementById('countdown');

    if (countdownInterval) {
        clearInterval(countdownInterval);
    }

    remainingSeconds = 90;

    function renderTime() {
        const mins = Math.floor(remainingSeconds / 60).toString().padStart(2, '0');
        const secs = (remainingSeconds % 60).toString().padStart(2, '0');
        if (countdownEl) {
            countdownEl.textContent = `${mins}:${secs}`;
        }
    }

    renderTime();

    countdownInterval = setInterval(() => {
        remainingSeconds--;
        if (remainingSeconds <= 0) {
            remainingSeconds = 0;
            renderTime();
            clearInterval(countdownInterval);
            countdownInterval = null;
        } else {
            renderTime();
        }
    }, 1000);
}

// ดึงค่า OTP ที่กรอกทั้งหมด 6 ช่อง
function getEnteredOtp() {
    const inputs = document.querySelectorAll('.vote-digit-input');
    return Array.from(inputs).map(input => input.value.trim()).join('');
}

// ตรวจสอบความถูกต้องและปรับสถานะปุ่ม "ถัดไป"
function validateOtpInputs() {
    const entered = getEnteredOtp();
    const nextBtn = document.getElementById('nextBtn');
    if (!nextBtn) return;

    if (entered.length === 6) {
        nextBtn.disabled = false;
    } else {
        nextBtn.disabled = true;
    }
}

// กรอกรหัสลงในช่อง 6 หลักอัตโนมัติ
function autofillOtp(code) {
    const inputs = document.querySelectorAll('.vote-digit-input');
    const digits = code.split('');

    inputs.forEach((input, index) => {
        input.value = digits[index] || '';
        if (input.value) {
            input.classList.add('has-value');
        } else {
            input.classList.remove('has-value');
        }
    });

    if (inputs.length > 0) {
        inputs[inputs.length - 1].focus();
    }

    validateOtpInputs();
    hideMockSmsToast();
}

// จัดการ Keyboard Navigation ของช่องกรอก 6 หลัก
function initDigitInputs() {
    const inputs = Array.from(document.querySelectorAll('.vote-digit-input'));
    if (inputs.length === 0) return;

    inputs.forEach((input, index) => {
        // เมื่อพิมพ์ตัวเลข
        input.addEventListener('input', (e) => {
            const val = input.value.replace(/[^0-9]/g, '');
            input.value = val ? val[val.length - 1] : '';

            if (input.value) {
                input.classList.add('has-value');
                if (index < inputs.length - 1) {
                    inputs[index + 1].focus();
                }
            } else {
                input.classList.remove('has-value');
            }

            validateOtpInputs();
        });

        // เมื่อกดปุ่ม Backspace หรือ Arrow
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace') {
                if (!input.value && index > 0) {
                    inputs[index - 1].focus();
                    inputs[index - 1].value = '';
                    inputs[index - 1].classList.remove('has-value');
                    validateOtpInputs();
                } else {
                    input.value = '';
                    input.classList.remove('has-value');
                    validateOtpInputs();
                }
            } else if (e.key === 'ArrowLeft' && index > 0) {
                inputs[index - 1].focus();
            } else if (e.key === 'ArrowRight' && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }
        });

        // รองรับการ Paste รหัส 6 หลัก
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pastedData = (e.clipboardData || window.clipboardData).getData('text');
            const cleanDigits = pastedData.replace(/[^0-9]/g, '').slice(0, 6);

            if (cleanDigits.length > 0) {
                autofillOtp(cleanDigits);
            }
        });
    });

    // โฟกัสช่องแรกเมื่อโหลดหน้า
    setTimeout(() => {
        inputs[0].focus();
    }, 400);
}

// จัดการปุ่มต่างๆ ในหน้า
function initActions(currentEventId) {
    const backBtn = document.getElementById('backBtn');
    const nextBtn = document.getElementById('nextBtn');
    const resendBtn = document.getElementById('resendOtpBtn');
    const switchToPinLink = document.getElementById('switchToPinLink');
    const smsCloseBtn = document.getElementById('mockSmsClose');
    const smsAutofillBtn = document.getElementById('mockSmsAutofill');

    // ปุ่มย้อนกลับ
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = `Vote-Verify.html?id=${encodeURIComponent(currentEventId)}`;
        });
    }

    // ลิงก์สลับไปใช้ PIN
    if (switchToPinLink) {
        switchToPinLink.href = `Vote-Verify-Pin.html?id=${encodeURIComponent(currentEventId)}`;
    }

    // ปุ่มขอรหัส OTP อีกครั้ง (กดได้ตลอดเวลาเพื่อสุ่มรหัสใหม่และรีเซ็ตเวลา)
    if (resendBtn) {
        resendBtn.addEventListener('click', () => {
            issueOtpCode();
            currentRefCode = generateRefCode();
            startCountdown();
            showMockSmsToast();

            // ล้างช่องเดิมและโฟกัสช่องแรก
            const inputs = document.querySelectorAll('.vote-digit-input');
            inputs.forEach(input => {
                input.value = '';
                input.classList.remove('has-value');
            });
            if (inputs.length > 0) {
                inputs[0].focus();
            }
            validateOtpInputs();
        });
    }

    // ปิดการ์ด SMS
    if (smsCloseBtn) {
        smsCloseBtn.addEventListener('click', hideMockSmsToast);
    }

    // กรอกรหัสอัตโนมัติจากการ์ด SMS
    if (smsAutofillBtn) {
        smsAutofillBtn.addEventListener('click', () => {
            autofillOtp(currentMockOtp);
        });
    }

    // ปุ่มถัดไป
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const entered = getEnteredOtp();
            if (entered.length !== 6) return;

            // ตรวจสอบรหัส (ยอมรับรหัสจำลอง หรือถ้ากรอกครบ 6 หลัก)
            const expectedOtp = getCurrentSessionOtp();
            if (!expectedOtp || entered !== expectedOtp) {
                alert(`รหัส OTP ไม่ถูกต้อง โปรดตรวจสอบรหัสใน SMS จำลอง (${expectedOtp || 'ไม่มีรหัสที่ใช้งาน'})`);
                return;
            }

            // เมื่อยืนยันสำเร็จ ไปยังขั้นตอนลงคะแนนใบที่ 1
            window.location.href = `Vote.html?id=${encodeURIComponent(currentEventId)}`;
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const currentEventId = getCurrentEventId();
    issueOtpCode();
    currentRefCode = generateRefCode();
    updateOtpDisplay();
    initHeroBanner(currentEventId);
    initDigitInputs();
    initActions(currentEventId);
    startCountdown();

    // แสดง Mock SMS Card หลังเปิดหน้าเว็บ 1 วินาที
    setTimeout(() => {
        showMockSmsToast();
    }, 900);
});

