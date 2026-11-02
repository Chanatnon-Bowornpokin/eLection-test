/**
 * Vote-Status.html — ติดตามสถานะการเลือกตั้ง
 *
 * URL: Vote-Status.html?id=<electionId>&state=waiting|counting[&type=partylist|constituency]
 *  - waiting  : ก่อนนับคะแนน (สถิติผู้ใช้สิทธิรายภูมิภาค + เวลาที่เหลือ)
 *  - counting : ระหว่างนับคะแนน (ผลคะแนนเรียลไทม์ บัญชีรายชื่อ / แบ่งเขต)
 *
 * ตัวเลขทั้งหมดเป็นข้อมูลจำลอง (simulation) ที่ขยับเองเพื่อให้เห็น progress bar เคลื่อนไหว
 * แทนการรอข้อมูลจริงจากระบบนับคะแนน
 */
(function () {
    'use strict';

    const main = document.getElementById('statusMain');
    if (!main) return;

    // ---------------------------------------------------------------- Params
    const params = new URLSearchParams(window.location.search);
    const STATE_BY_EVENT = {
        'referendum-2569-03': 'waiting',
        'house-election-2569': 'counting',
    };
    const eventId = params.get('id') || 'house-election-2569';
    const requestedState = params.get('state');
    const state = (requestedState === 'waiting' || requestedState === 'counting')
        ? requestedState
        : (STATE_BY_EVENT[eventId] || 'counting');
    let type = (state === 'counting' && params.get('type') === 'constituency') ? 'constituency' : 'partylist';

    main.dataset.state = state;
    main.dataset.type = type;

    // --------------------------------------------------------------- Helpers
    const TICK_MS = 1400;
    const fmt = value => Math.round(value).toLocaleString('en-US');
    const pct = (part, total, digits = 1) => (total > 0 ? (part / total) * 100 : 0).toFixed(digits);
    const pad = value => String(value).padStart(2, '0');
    const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));

    if (typeof EVENTS !== 'undefined' && Array.isArray(EVENTS)) {
        const current = EVENTS.find(item => item.id === eventId);
        if (current) {
            const holder = document.createElement('div');
            holder.innerHTML = current.title;
            const plainTitle = (holder.textContent || '').trim();
            document.title = `ติดตามสถานะ - ${plainTitle}`;
            const heroText = document.querySelector('.vote-status-hero-text');
            if (heroText) {
                heroText.innerHTML = `Hero Section<br>ติดตามสถานะ<br>${escapeHtml(plainTitle)}`;
            }
        }
    }

    function setBind(name, value) {
        document.querySelectorAll(`[data-bind="${name}"]`).forEach(el => {
            el.textContent = value;
        });
    }

    // ดีเลย์ 2 เฟรม เพื่อให้ transition ของแถบเริ่มจากความกว้าง 0 ได้
    function afterPaint(callback) {
        requestAnimationFrame(() => requestAnimationFrame(callback));
    }

    function barRowHtml(nameHtml, subText, percentText, widthPct = 0) {
        const cleanSub = String(subText).replace(/^[•\s-]+/, '').trim();
        return `
            <div class="vs-bar-row">
                ${nameHtml}
                <div class="vs-bar-meta">
                    <span class="vs-bar-sub"><span class="vs-bullet" aria-hidden="true">•</span><span class="vs-bar-text">${escapeHtml(cleanSub)}</span></span>
                    <span class="vs-bar-pct">${escapeHtml(percentText)}</span>
                </div>
                <div class="vs-bar-track vs-bar"><div class="vs-bar-fill" style="width: ${widthPct}%;"></div></div>
            </div>
        `;
    }

    // -------------------------------------------------------------- Base data
    const ELIGIBLE = 51354679;
    const BALLOTS_IN_SYSTEM = 34120450;

    const totals = {
        used: 34120450,
        countedDistrict: 30000000,
        countedParty: 30000000,
    };

    function renderKpis() {
        setBind('eligible', fmt(ELIGIBLE));
        setBind('used', fmt(totals.used));
        setBind('usedPct', pct(totals.used, ELIGIBLE));

        if (state === 'waiting') {
            setBind('ballotDistrict', fmt(totals.used));
            setBind('ballotParty', fmt(totals.used));
        } else {
            setBind('ballotDistrict', fmt(BALLOTS_IN_SYSTEM));
            setBind('ballotParty', fmt(BALLOTS_IN_SYSTEM));
            setBind('countedDistrict', fmt(totals.countedDistrict));
            setBind('countedParty', fmt(totals.countedParty));
            setBind(
                'countedPct',
                pct(totals.countedDistrict + totals.countedParty, BALLOTS_IN_SYSTEM * 2)
            );
        }
    }

    // ------------------------------------------------ Waiting: รายภูมิภาค + เวลา
    const regions = [
        { name: 'ภาคกลาง', used: 11270000, total: 16190000 },
        { name: 'ภาคเหนือ', used: 5460000, total: 8400000 },
        { name: 'ภาคตะวันออกเฉียงเหนือ', used: 10850000, total: 17010000 },
        { name: 'ภาคใต้', used: 6000000, total: 9800000 },
    ];
    let regionEls = [];

    function renderRegions() {
        const list = document.getElementById('regionList');
        if (!list) return;

        list.innerHTML = regions.map(region => {
            const share = pct(region.used, region.total);
            const sub = `• ใช้สิทธิแล้ว ${fmt(region.used)} / ${fmt(region.total)} คน`;
            const pctStr = `คิดเป็น ${share}%`;
            return barRowHtml(
                `<h3 class="vs-bar-name">${escapeHtml(region.name)}</h3>`,
                sub,
                pctStr,
                share
            );
        }).join('');

        regionEls = Array.from(list.querySelectorAll('.vs-bar-row')).map(row => ({
            sub: row.querySelector('.vs-bar-sub'),
            text: row.querySelector('.vs-bar-text'),
            pct: row.querySelector('.vs-bar-pct'),
            fill: row.querySelector('.vs-bar-fill'),
        }));
    }

    function updateRegions() {
        regions.forEach((region, index) => {
            const els = regionEls[index];
            if (!els) return;
            const share = pct(region.used, region.total);
            const label = `ใช้สิทธิแล้ว ${fmt(region.used)} / ${fmt(region.total)} คน`;
            if (els.text) {
                els.text.textContent = label;
            } else if (els.sub) {
                els.sub.textContent = `• ${label}`;
            }
            els.pct.textContent = `คิดเป็น ${share}%`;
            els.fill.style.width = `${share}%`;
        });
    }

    const closeAt = Date.now() + (3 * 60 + 45) * 60 * 1000;

    function updateCountdown() {
        const remaining = Math.max(0, closeAt - Date.now());
        const minutes = Math.ceil(remaining / 60000);
        setBind('countdown', `${pad(Math.floor(minutes / 60))} ชม. ${pad(minutes % 60)} นาที`);
    }

    function tickWaiting() {
        let added = 0;
        regions.forEach(region => {
            const before = region.used;
            region.used = Math.min(region.total, region.used + region.total * (0.001 + Math.random() * 0.003));
            added += region.used - before;
        });
        totals.used = Math.min(ELIGIBLE, totals.used + added);
        renderKpis();
        updateRegions();
    }

    // ------------------------------------------ Counting: ผลคะแนนเรียลไทม์
    const partyRows = [
        { label: 'พรรค ก. (เบอร์ 1)', votes: 10000000 },
        { label: 'พรรค ข. (เบอร์ 4)', votes: 8400000 },
        { label: 'พรรค ค. (เบอร์ 2)', votes: 10000000 },
        { label: 'พรรค ง. (เบอร์ 3)', votes: 10000000 },
    ];

    const candidate = (no, name, party, votes) => ({ label: `เบอร์ ${no} ${name} (พรรค ${party})`, votes });
    const abstain = votes => ({ label: 'ไม่ประสงค์ลงคะแนน', votes, hideVotes: true });

    const AREAS = {
        bkk: {
            name: 'กรุงเทพมหานคร',
            districts: [
                {
                    label: 'เขตที่ 1 (พระนคร, ป้อมปราบฯ)', rows: [
                        candidate(1, 'นายสมชาย มุ่งมั่น', 'ก.', 45210),
                        candidate(4, 'น.ส.วิภา สดใส', 'ข.', 38150),
                        candidate(2, 'ดร.เอกชัย รักถิ่น', 'ค.', 15420),
                        abstain(3200),
                    ],
                },
                {
                    label: 'เขตที่ 2 (ดุสิต, พญาไท)', rows: [
                        candidate(3, 'นายปกรณ์ ใจดี', 'ง.', 41880),
                        candidate(1, 'น.ส.รัตนา ศรีสุข', 'ก.', 39260),
                        candidate(4, 'นายธนา พัฒนผล', 'ข.', 18040),
                        abstain(2900),
                    ],
                },
            ],
        },
        cmi: {
            name: 'เชียงใหม่',
            districts: [
                {
                    label: 'เขตที่ 1 (เมืองเชียงใหม่)', rows: [
                        candidate(2, 'นายสุรชัย ดอยสูง', 'ค.', 36700),
                        candidate(1, 'น.ส.ศิริพร ล้านนา', 'ก.', 35120),
                        candidate(4, 'นายวีระ เมฆา', 'ข.', 12980),
                        abstain(2400),
                    ],
                },
                {
                    label: 'เขตที่ 2 (สารภี, ดอยสะเก็ด)', rows: [
                        candidate(1, 'นายอนันต์ ภูผา', 'ก.', 33540),
                        candidate(3, 'น.ส.กมลา พิงค์', 'ง.', 30210),
                        candidate(2, 'นายประเสริฐ ขุนเขา', 'ค.', 14650),
                        abstain(2100),
                    ],
                },
            ],
        },
        pkt: {
            name: 'ภูเก็ต',
            districts: [
                {
                    label: 'เขตที่ 1 (เมืองภูเก็ต)', rows: [
                        candidate(4, 'น.ส.ทะเล คลื่นใส', 'ข.', 28430),
                        candidate(1, 'นายอันดา วารี', 'ก.', 26990),
                        candidate(2, 'นายชัยวัฒน์ หาดทอง', 'ค.', 9870),
                        abstain(1800),
                    ],
                },
            ],
        },
    };

    // เก็บข้อมูลที่ขยับแล้วของแต่ละเขต เพื่อให้ตัวเลขต่อเนื่องเมื่อสลับเขตไปมา
    const areaRows = {};
    const areaKey = (province, district) => `${province}:${district}`;

    function rowsForArea(province, districtIndex) {
        const key = areaKey(province, districtIndex);
        if (!areaRows[key]) {
            areaRows[key] = AREAS[province].districts[districtIndex].rows.map(row => ({ ...row }));
        }
        return areaRows[key];
    }

    const selected = { province: 'bkk', district: 0 };
    let scoreEls = [];

    function currentRows() {
        return type === 'constituency'
            ? rowsForArea(selected.province, selected.district)
            : partyRows;
    }

    // น้ำหนักเริ่มต้น ใช้กำหนดทิศทางที่คะแนนจะไหลเข้าในแต่ละรอบ
    function ensureWeights(rows) {
        if (rows.every(row => row.weight)) return;
        const sum = rows.reduce((acc, row) => acc + row.votes, 0);
        rows.forEach(row => { row.weight = row.votes / sum; });
    }

    const scoreTypeSelect = document.getElementById('scoreTypeSelect');
    const scoreTypeLabel = document.getElementById('scoreTypeLabel');

    function renderScores() {
        const list = document.getElementById('scoreList');
        if (!list) return;

        if (scoreTypeSelect) scoreTypeSelect.value = type;
        if (scoreTypeLabel) {
            scoreTypeLabel.textContent = type === 'constituency' ? 'แบบแบ่งเขต' : 'แบบบัญชีรายชื่อ';
        }

        const rows = currentRows();
        ensureWeights(rows);
        const total = rows.reduce((acc, row) => acc + row.votes, 0);

        list.innerHTML = rows.map(row => {
            const share = pct(row.votes, total);
            const sub = row.hideVotes
                ? `• ${row.label}`
                : `• ${row.label} ${fmt(row.votes)} คะแนน`;
            const pctStr = `คิดเป็น ${share}%`;
            return barRowHtml('', sub, pctStr, share);
        }).join('');

        scoreEls = Array.from(list.querySelectorAll('.vs-bar-row')).map(row => ({
            sub: row.querySelector('.vs-bar-sub'),
            text: row.querySelector('.vs-bar-text'),
            pct: row.querySelector('.vs-bar-pct'),
            fill: row.querySelector('.vs-bar-fill'),
        }));
    }

    function updateScores(intro) {
        const rows = currentRows();
        const total = rows.reduce((acc, row) => acc + row.votes, 0);

        rows.forEach((row, index) => {
            const els = scoreEls[index];
            if (!els) return;
            const share = pct(row.votes, total);
            const label = row.hideVotes
                ? row.label
                : `${row.label} ${fmt(row.votes)} คะแนน`;
            if (els.text) {
                els.text.textContent = label;
            } else if (els.sub) {
                els.sub.textContent = `• ${label}`;
            }
            els.pct.textContent = `คิดเป็น ${share}%`;
            els.fill.style.width = `${share}%`;
        });
    }

    function tickCounting() {
        const step = () => 40000 + Math.random() * 100000;
        totals.countedDistrict = Math.min(BALLOTS_IN_SYSTEM, totals.countedDistrict + step());
        totals.countedParty = Math.min(BALLOTS_IN_SYSTEM, totals.countedParty + step());

        const rows = currentRows();
        const total = rows.reduce((acc, row) => acc + row.votes, 0);
        const chunk = total * 0.004;
        rows.forEach(row => {
            row.votes += chunk * (row.weight || 0.25) * (0.4 + Math.random() * 1.2);
        });

        renderKpis();
        updateScores(false);

        if (totals.countedDistrict >= BALLOTS_IN_SYSTEM && totals.countedParty >= BALLOTS_IN_SYSTEM) {
            setBind('countingStatus', 'นับคะแนน');
            document.querySelectorAll('[data-bind="countingStatus"]').forEach(el => {
                el.innerHTML = 'นับคะแนน<br>ครบแล้ว';
            });
        }
    }

    // ตัวสลับ บัญชีรายชื่อ / แบ่งเขต (ผ่าน dropdown สามเหลี่ยมตามดีไซน์)
    function setType(nextType) {
        type = nextType;
        main.dataset.type = type;
        if (scoreTypeSelect) scoreTypeSelect.value = type;
        if (scoreTypeLabel) {
            scoreTypeLabel.textContent = type === 'constituency' ? 'แบบแบ่งเขต' : 'แบบบัญชีรายชื่อ';
        }

        try {
            const url = new URL(window.location.href);
            url.searchParams.set('type', type);
            window.history.replaceState({}, '', url.toString());
        } catch (error) {
            // Ignore URL state error in restricted iframe or local file
        }

        const optParty = document.getElementById('optPartylist');
        const optConst = document.getElementById('optConstituency');
        if (optParty) optParty.classList.toggle('is-selected', type === 'partylist');
        if (optConst) optConst.classList.toggle('is-selected', type === 'constituency');

        renderScores();
    }

    function initSwitch() {
        const wrap = document.getElementById('scoreDropdownWrap');
        const btn = document.getElementById('scoreTypeBtn');
        const menu = document.getElementById('scoreDropdownMenu');

        if (scoreTypeSelect) {
            scoreTypeSelect.value = type;
            scoreTypeSelect.addEventListener('change', () => {
                setType(scoreTypeSelect.value);
            });
        }

        if (scoreTypeLabel) {
            scoreTypeLabel.textContent = type === 'constituency' ? 'แบบแบ่งเขต' : 'แบบบัญชีรายชื่อ';
        }

        const optParty = document.getElementById('optPartylist');
        const optConst = document.getElementById('optConstituency');
        if (optParty) optParty.classList.toggle('is-selected', type === 'partylist');
        if (optConst) optConst.classList.toggle('is-selected', type === 'constituency');

        if (btn && menu) {
            const toggleMenu = (open) => {
                const shouldOpen = typeof open === 'boolean' ? open : !menu.classList.contains('is-open');
                menu.classList.toggle('is-open', shouldOpen);
                btn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
            };

            btn.addEventListener('click', (event) => {
                event.stopPropagation();
                toggleMenu();
            });

            menu.querySelectorAll('.vs-score-opt').forEach(opt => {
                opt.addEventListener('click', (event) => {
                    event.stopPropagation();
                    const val = opt.getAttribute('data-value');
                    if (val) {
                        setType(val);
                        toggleMenu(false);
                    }
                });
            });

            document.addEventListener('click', (event) => {
                if (wrap && !wrap.contains(event.target)) {
                    toggleMenu(false);
                }
            });

            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' && menu.classList.contains('is-open')) {
                    toggleMenu(false);
                    btn.focus();
                }
            });
        }
    }

    // ตัวเลือกจังหวัด / เขตเลือกตั้ง
    function initAreaSelects() {
        const provinceSelect = document.getElementById('provinceSelect');
        const districtSelect = document.getElementById('districtSelect');
        if (!provinceSelect || !districtSelect) return;

        provinceSelect.innerHTML = Object.entries(AREAS)
            .map(([key, area]) => `<option value="${key}">${escapeHtml(area.name)}</option>`)
            .join('');

        function fillDistricts() {
            districtSelect.innerHTML = AREAS[selected.province].districts
                .map((district, index) => `<option value="${index}">${escapeHtml(district.label)}</option>`)
                .join('');
            districtSelect.value = String(selected.district);
        }

        provinceSelect.value = selected.province;
        fillDistricts();

        provinceSelect.addEventListener('change', () => {
            selected.province = provinceSelect.value;
            selected.district = 0;
            fillDistricts();
            renderScores();
        });

        districtSelect.addEventListener('change', () => {
            selected.district = Number(districtSelect.value);
            renderScores();
        });
    }

    // ------------------------------------------------ ตรวจสอบสถานะบัตร
    const form = document.getElementById('ballotForm');
    const input = document.getElementById('ballotCodeInput');
    const resultBox = document.getElementById('ballotResult');
    const resultTitle = document.getElementById('ballotResultTitle');
    const resultCode = document.getElementById('ballotResultCode');
    const resultTime = document.getElementById('ballotResultTime');
    const resultStatus = document.getElementById('ballotResultStatus');
    const resultIcon = document.getElementById('ballotResultIcon');

    // ข้อความสถานะ 3 แบบตามข้อกำหนดอย่างเคร่งครัด
    const STATUS_BEFORE_17 = 'รอนับคะแนนหลังปิดหีบ'; // กรณีที่ 1 (ก่อน 17:00 น. พบใน staging_box)
    const STATUS_PENDING   = 'รอการประมวลผล';       // กรณีที่ 2 (หลัง 17:00 น. ยังไม่ประมวลผล)
    const STATUS_PROCESSED = 'ประมวลผลแล้ว';         // กรณีที่ 3 (หลัง 17:00 น. นับคะแนนแล้ว พบใน final_box)
    const MSG_NOT_FOUND    = 'ไม่พบบัตรลงคะแนนรหัสนี้ในระบบ';

    // ตรวจสอบว่าขณะนี้หลัง 17:00 น. หรือไม่ (อ้างอิงจาก state ของหน้า หรือเวลาจริง)
    function isAfter17() {
        if (main && main.dataset.state === 'counting') return true;
        if (main && main.dataset.state === 'waiting') return false;
        const now = new Date();
        return now.getHours() >= 17;
    }

    // รหัสตัวอย่างตามดีไซน์ Figma
    const SAMPLE = {
        code: '#a8f9-4c2e-991b-88ff',
        time: '14 ม.ค. 2569 | 14:37 น.',
        status: isAfter17() ? STATUS_PROCESSED : STATUS_BEFORE_17
    };

    function formatRecordedTime(value) {
        const date = value ? new Date(value) : null;
        if (!date || Number.isNaN(date.getTime())) return '-';
        const day = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
        return `${day} | ${pad(date.getHours())}:${pad(date.getMinutes())} น.`;
    }

    function showResult(result) {
        if (!resultBox) return;
        const ok = Boolean(result && result.ok);
        resultBox.classList.toggle('is-error', !ok);
        if (resultIcon) {
            resultIcon.classList.toggle('fa-check', ok);
            resultIcon.classList.toggle('fa-xmark', !ok);
        }
        if (resultTitle) {
            resultTitle.textContent = ok ? 'บัตรอยู่ในระบบเรียบร้อย' : (result.title || MSG_NOT_FOUND);
        }
        if (resultCode) {
            resultCode.textContent = `รหัสตรวจสอบสถานะบัตร : ${result.code}`;
        }
        if (resultTime) {
            if (ok && result.time) {
                resultTime.textContent = `เวลาที่บันทึก : ${result.time}`;
                resultTime.hidden = false;
                resultTime.style.display = '';
            } else {
                resultTime.textContent = '';
                resultTime.hidden = true;
                resultTime.style.display = 'none';
            }
        }
        if (resultStatus) {
            if (ok && result.status) {
                resultStatus.textContent = `สถานะ : ${result.status}`;
                resultStatus.hidden = false;
                resultStatus.style.display = '';
            } else {
                resultStatus.textContent = '';
                resultStatus.hidden = true;
                resultStatus.style.display = 'none';
            }
        }
    }

    function lookupLocal(code) {
        const cleanWithHash = code.startsWith('#') ? code : `#${code}`;
        const target = cleanWithHash.toLowerCase();

        // ตรวจสอบใน sessionStorage (ใบเสร็จล่าสุดของการโหวตในเซสชันนี้)
        try {
            const rawReceipt = sessionStorage.getItem('latest_vote_receipt');
            if (rawReceipt) {
                const receipt = JSON.parse(rawReceipt);
                const rCode = (receipt.trackingHash || receipt.trackingCode || '').toLowerCase();
                if (rCode === target || `#${rCode}` === target || rCode === target.replace(/^#/, '')) {
                    const determinedStatus = !isAfter17() ? STATUS_BEFORE_17 : STATUS_PENDING;
                    return {
                        ok: true,
                        code: cleanWithHash,
                        time: receipt.voteTime ? formatRecordedTime(new Date()) : '-',
                        status: determinedStatus
                    };
                }
            }
        } catch (e) {}

        // ตรวจสอบใน localStorage (election-staging-envelopes)
        try {
            const table = JSON.parse(localStorage.getItem('election-staging-envelopes') || '{}');
            for (const record of Object.values(table)) {
                const c = record && (record.trackingCode || record.trackingHash || '');
                if (c && (c.toLowerCase() === target || `#${c.toLowerCase()}` === target)) {
                    const iso = record.outerEnvelope && record.outerEnvelope.timestampIso;
                    const determinedStatus = !isAfter17() ? STATUS_BEFORE_17 : STATUS_PENDING;
                    return {
                        ok: true,
                        code: cleanWithHash,
                        time: iso ? formatRecordedTime(iso) : ((record.outerEnvelope && record.outerEnvelope.votedAt) || '-'),
                        status: determinedStatus
                    };
                }
            }
        } catch (e) {}

        return null;
    }

    async function lookupSupabase(code) {
        const cleanWithHash = code.startsWith('#') ? code : `#${code}`;
        const cleanWithoutHash = code.replace(/^#/, '');
        const codeVariants = [cleanWithHash, cleanWithoutHash];

        const SUPABASE_CONFIG = {
            url: (typeof SUPABASE_URL !== 'undefined') ? SUPABASE_URL : 'https://nzobdkybbpufntionuze.supabase.co/',
            key: (typeof SUPABASE_ANON_KEY !== 'undefined') ? SUPABASE_ANON_KEY : 'sb_publishable_xBBzY0PXxUVWx4fINXBk3w_UwSEywAq'
        };

        const client = (typeof supabaseClient !== 'undefined' && supabaseClient) ? supabaseClient : null;

        // 1. ค้นหาใน final_box: mp_final_box และ referendum_final_box (กรณีที่ 3)
        // โครงสร้างตาราง final_box ใช้คอลัมน์ ballot_id ในการระบุรหัสบัตร
        const finalTables = [
            { name: 'mp_final_box', col: 'ballot_id' },
            { name: 'referendum_final_box', col: 'ballot_id' }
        ];

        for (const target of finalTables) {
            for (const val of codeVariants) {
                try {
                    let record = null;
                    if (client) {
                        const { data, error } = await client
                            .from(target.name)
                            .select('*')
                            .eq(target.col, val)
                            .maybeSingle();
                        if (!error && data) record = data;
                    }
                    if (!record) {
                        const res = await fetch(`${SUPABASE_CONFIG.url}rest/v1/${target.name}?${target.col}=eq.${encodeURIComponent(val)}&select=*`, {
                            headers: {
                                'apikey': SUPABASE_CONFIG.key,
                                'Authorization': `Bearer ${SUPABASE_CONFIG.key}`
                            }
                        });
                        if (res.ok) {
                            const rows = await res.json();
                            if (Array.isArray(rows) && rows.length > 0) record = rows[0];
                        }
                    }

                    if (record) {
                        return {
                            ok: true,
                            code: cleanWithHash,
                            time: formatRecordedTime(record.counted_at || record.created_at),
                            status: STATUS_PROCESSED // กรณีที่ 3: นับคะแนนแล้ว -> ประมวลผลแล้ว
                        };
                    }
                } catch (err) {
                    console.warn(`Query ${target.name} error:`, err);
                }
            }
        }

        // 2. ค้นหาใน staging_box: mp_staging_box และ referendum_staging_box
        // โครงสร้างตาราง staging_box ใช้คอลัมน์ tracking_hash ในการระบุรหัสบัตร
        const stagingTables = [
            { name: 'mp_staging_box', col: 'tracking_hash' },
            { name: 'referendum_staging_box', col: 'tracking_hash' }
        ];

        for (const target of stagingTables) {
            for (const val of codeVariants) {
                try {
                    let record = null;
                    if (client) {
                        const { data, error } = await client
                            .from(target.name)
                            .select('*')
                            .eq(target.col, val)
                            .maybeSingle();
                        if (!error && data) record = data;
                    }
                    if (!record) {
                        const res = await fetch(`${SUPABASE_CONFIG.url}rest/v1/${target.name}?${target.col}=eq.${encodeURIComponent(val)}&select=*`, {
                            headers: {
                                'apikey': SUPABASE_CONFIG.key,
                                'Authorization': `Bearer ${SUPABASE_CONFIG.key}`
                            }
                        });
                        if (res.ok) {
                            const rows = await res.json();
                            if (Array.isArray(rows) && rows.length > 0) record = rows[0];
                        }
                    }

                    if (record) {
                        // หากพบใน staging_box:
                        // ตรวจสอบสถานะของแถวข้อมูล หรือเวลา
                        const isProcessed = record.status === 'TALLIED' || record.status === 'PROCESSED';
                        let determinedStatus;
                        if (isProcessed) {
                            determinedStatus = STATUS_PROCESSED; // ประมวลผลแล้ว
                        } else if (!isAfter17()) {
                            determinedStatus = STATUS_BEFORE_17; // กรณีที่ 1: ก่อน 17:00 น. -> รอนับคะแนนหลังปิดหีบ
                        } else {
                            determinedStatus = STATUS_PENDING;   // กรณีที่ 2: หลัง 17:00 น. ยังไม่ประมวลผล -> รอการประมวลผล
                        }

                        return {
                            ok: true,
                            code: cleanWithHash,
                            time: formatRecordedTime(record.submitted_at || record.created_at),
                            status: determinedStatus
                        };
                    }
                } catch (err) {
                    console.warn(`Query ${target.name} error:`, err);
                }
            }
        }

        return null;
    }

    async function lookupBallot(rawCode) {
        const code = (rawCode || '').trim();
        if (!code) {
            return {
                ok: false,
                code: '',
                title: MSG_NOT_FOUND
            };
        }

        const cleanWithHash = code.startsWith('#') ? code : `#${code}`;
        const target = cleanWithHash.toLowerCase();

        // 1. ค้นหาใน Supabase จริง (ทั้ง 4 ตาราง: mp_final_box, referendum_final_box, mp_staging_box, referendum_staging_box)
        const remote = await lookupSupabase(code);
        if (remote) return remote;

        // 2. ค้นหาใน Local Storage / Session Storage
        const local = lookupLocal(code);
        if (local) return local;

        // 3. กรณีทดสอบรหัสตัวอย่าง Figma (#a8f9-4c2e-991b-88ff)
        if (target === SAMPLE.code.toLowerCase()) {
            return {
                ok: true,
                code: SAMPLE.code,
                time: SAMPLE.time,
                status: isAfter17() ? STATUS_PROCESSED : STATUS_BEFORE_17
            };
        }

        // 4. กรณีค้นหาไม่พบรหัส
        return {
            ok: false,
            code: cleanWithHash,
            title: MSG_NOT_FOUND
        };
    }

    function initCheckForm() {
        // แสดงตัวอย่างตามดีไซน์ก่อนที่ผู้ใช้จะค้นหา
        showResult({
            ok: true,
            code: SAMPLE.code,
            time: SAMPLE.time,
            status: isAfter17() ? STATUS_PROCESSED : STATUS_BEFORE_17
        });

        // ตรวจสอบว่ามีพารามิเตอร์รหัสส่งมาใน URL หรือไม่ (เช่น ?code=... หรือ ?hash=...)
        const urlParams = new URLSearchParams(window.location.search);
        const autoCode = urlParams.get('code') || urlParams.get('hash') || urlParams.get('tracking');
        if (autoCode && input) {
            input.value = autoCode;
            setTimeout(() => {
                if (form) form.dispatchEvent(new Event('submit', { cancelable: true }));
            }, 100);
        }

        if (!form || !input) return;
        form.addEventListener('submit', async event => {
            event.preventDefault();
            const val = input.value.trim();
            if (!val) {
                input.focus();
                return;
            }
            const button = form.querySelector('button[type="submit"]');
            if (button) {
                button.disabled = true;
                button.textContent = 'กำลังตรวจ...';
            }
            const result = await lookupBallot(val);
            showResult(result);
            if (button) {
                button.disabled = false;
                button.textContent = 'ตรวจสอบ';
            }
        });
    }

    // ------------------------------------------------------------ Ceremony
    const ceremonyBtn = document.getElementById('ceremonyBtn');
    if (ceremonyBtn) {
        ceremonyBtn.addEventListener('click', () => {
            window.alert('ระบบเปิดให้เข้าชมการเปิดหีบบัตรดิจิทัลหลังการปิดหีบ 17:00 น.');
        });
    }

    // ---------------------------------------------------------------- Boot
    renderKpis();
    initCheckForm();

    if (state === 'waiting') {
        renderRegions();
        afterPaint(() => { /* ให้แถบภูมิภาคเลื่อนจาก 0 ไปยังค่าปัจจุบัน */ });
        regionEls.forEach(els => {
            const target = els.fill.style.width;
            els.fill.style.width = '0';
            afterPaint(() => { els.fill.style.width = target; });
        });
        updateCountdown();
        window.setInterval(updateCountdown, 1000);
        window.setInterval(tickWaiting, TICK_MS);
    } else {
        initSwitch();
        initAreaSelects();
        renderScores();
        window.setInterval(tickCounting, TICK_MS);
    }
})();
