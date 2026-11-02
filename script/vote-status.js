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

    const STATUS_WAITING = 'รอนับคะแนนหลังปิดหีบ';
    const STATUS_PROCESSED = 'ประมวลผลแล้ว';
    const stateStatusText = state === 'waiting' ? STATUS_WAITING : STATUS_PROCESSED;

    // รหัสตัวอย่างตามดีไซน์ Figma
    const SAMPLE = { code: '#a8f9-4c2e-991b-88ff', time: '14 ม.ค. 2569 | 14:37 น.' };

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
        if (resultTitle) resultTitle.textContent = ok ? 'บัตรอยู่ในระบบเรียบร้อย' : (result.title || 'ไม่พบบัตรในระบบ');
        if (resultCode) resultCode.textContent = `รหัสตรวจสอบสถานะบัตร : ${result.code}`;
        if (resultTime) resultTime.textContent = ok ? `เวลาที่บันทึก : ${result.time}` : (result.hint || '');
        if (resultTime) resultTime.hidden = !resultTime.textContent;
        if (resultStatus) {
            resultStatus.textContent = ok ? `สถานะ : ${result.status}` : '';
            resultStatus.hidden = !ok;
        }
    }

    function lookupLocal(target) {
        try {
            const table = JSON.parse(localStorage.getItem('election-staging-envelopes') || '{}');
            for (const record of Object.values(table)) {
                const code = record && (record.trackingCode || record.trackingHash);
                if (code && code.toLowerCase() === target) {
                    const iso = record.outerEnvelope && record.outerEnvelope.timestampIso;
                    return {
                        ok: true,
                        code,
                        time: iso ? formatRecordedTime(iso) : (record.outerEnvelope && record.outerEnvelope.votedAt) || '-',
                        status: stateStatusText,
                    };
                }
            }
        } catch (error) {
            // ใช้ผลลัพธ์จากแหล่งอื่นต่อ
        }
        return null;
    }

    async function lookupSupabase(code) {
        if (typeof supabaseClient === 'undefined') return null;

        const tables = ['mp_staging_box', 'referendum_staging_box'];
        const columns = ['tracking_code', 'tracking_hash'];

        for (const table of tables) {
            for (const column of columns) {
                try {
                    const { data } = await supabaseClient.from(table).select('*').eq(column, code).maybeSingle();
                    if (data) {
                        const processed = data.status === 'TALLIED' || data.status === 'PROCESSED';
                        return {
                            ok: true,
                            code,
                            time: formatRecordedTime(data.created_at || data.voted_at),
                            status: processed ? STATUS_PROCESSED : (data.status === 'ACTIVE' ? STATUS_WAITING : String(data.status || stateStatusText)),
                        };
                    }
                } catch (error) {
                    // ตารางหรือคอลัมน์นี้ไม่มี ลองรายการถัดไป
                }
            }
        }
        return null;
    }

    async function lookupBallot(rawCode) {
        const code = rawCode.trim();
        const target = code.toLowerCase();

        const local = lookupLocal(target);
        if (local) return local;

        if (target === SAMPLE.code.toLowerCase() || `#${target}` === SAMPLE.code.toLowerCase()) {
            return { ok: true, code: SAMPLE.code, time: SAMPLE.time, status: stateStatusText };
        }

        const remote = await lookupSupabase(code);
        if (remote) return remote;

        return {
            ok: false,
            code,
            title: 'ไม่พบบัตรในระบบ',
            hint: 'กรุณาตรวจสอบรหัสแล้วลองใหม่อีกครั้ง',
        };
    }

    function initCheckForm() {
        // แสดงตัวอย่างตามดีไซน์ก่อนที่ผู้ใช้จะค้นหา
        showResult({ ok: true, code: SAMPLE.code, time: SAMPLE.time, status: stateStatusText });

        if (!form || !input) return;
        form.addEventListener('submit', async event => {
            event.preventDefault();
            if (!input.value.trim()) {
                input.focus();
                return;
            }
            const button = form.querySelector('button[type="submit"]');
            if (button) button.disabled = true;
            showResult(await lookupBallot(input.value));
            if (button) button.disabled = false;
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
