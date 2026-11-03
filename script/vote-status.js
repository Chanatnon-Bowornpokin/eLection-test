/**
 * Vote-Status.html — ติดตามสถานะการเลือกตั้ง
 *
 * URL: Vote-Status.html?id=<electionId>&state=waiting|counting[&type=partylist|constituency]
 *  - waiting  : ก่อนนับคะแนน (สถิติผู้ใช้สิทธิรายภูมิภาค + เวลาที่เหลือ)
 *  - counting : ระหว่างนับคะแนน (ผลคะแนนเรียลไทม์ บัญชีรายชื่อ / แบ่งเขต)
 *
 * คะแนนและ progress มาจาก final box ของ Supabase และอัปเดตด้วย polling
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
    const isReferendum = eventId.toLowerCase().includes('ref');
    const requestedState = params.get('state');
    const state = isReferendum ? 'counting' : (requestedState === 'waiting' || requestedState === 'counting')
        ? requestedState
        : (STATE_BY_EVENT[eventId] || 'counting');
    let type = isReferendum ? 'referendum' : (state === 'counting' && params.get('type') === 'constituency') ? 'constituency' : 'partylist';

    main.dataset.state = state;
    main.dataset.type = type;

    // --------------------------------------------------------------- Helpers
    const POLL_MS = 5000;
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
    const totals = {
        submitted: 0,
        processed: 0,
    };

    function renderKpis() {
        const progress = pct(totals.processed, totals.submitted);
        const isDone = totals.submitted > 0 && totals.processed >= totals.submitted;
        const countingStatusText = isDone ? 'ปิดหีบแล้ว' : 'กำลัง<br>นับคะแนน';

        const statusEl = document.querySelector('.only-counting [data-bind="countingStatus"]');
        if (statusEl) {
            statusEl.innerHTML = countingStatusText;
        }

        if (isReferendum) {
            setBind('eligible', '—');
            setBind('used', fmt(totals.submitted));
            setBind('usedPct', progress);
            setBind('ballotReferendum', fmt(totals.submitted));
            setBind('ballotDistrict', fmt(totals.submitted));
            setBind('countedReferendum', fmt(totals.processed));
            setBind('countedDistrict', fmt(totals.processed));
            setBind('countedPct', progress);
        } else {
            setBind('eligible', '—');
            setBind('used', fmt(totals.submitted));
            setBind('usedPct', progress);
            setBind('ballotDistrict', fmt(totals.submitted));
            setBind('ballotParty', fmt(totals.submitted));
            setBind('countedDistrict', fmt(totals.processed));
            setBind('countedParty', fmt(totals.processed));
            setBind('countedPct', progress);
        }
    }

    // ------------------------------------------------ Waiting: รายภูมิภาค + เวลา
    function renderRegions() {
        const list = document.getElementById('regionList');
        if (!list) return;
        list.innerHTML = barRowHtml('', 'ยังไม่มีข้อมูลการใช้สิทธิแยกตามภูมิภาคจากฐานข้อมูล', '', 0);
    }

    const closeAt = new Date();
    closeAt.setHours(17, 0, 0, 0);

    function updateCountdown() {
        const remaining = Math.max(0, closeAt - Date.now());
        const minutes = Math.ceil(remaining / 60000);
        setBind('countdown', `${pad(Math.floor(minutes / 60))} ชม. ${pad(minutes % 60)} นาที`);
    }

    // ------------------------------------------ Counting: ผลคะแนนเรียลไทม์
    const db = typeof supabaseClient !== 'undefined' ? supabaseClient : null;
    const PAGE_SIZE = 1000;
    const votesByBallot = [];
    const referendumVotes = { approve: 0, disapprove: 0, abstain: 0 };
    const selected = { province: '', district: '' };
    let cachedFinalRows = [];
    let lastFinalCount = -1;
    let partyMetadata = [];
    let candidateMetadata = [];
    let areaSelectsInitialized = false;
    let scoreEls = [];

    async function fetchAllRows(table, columns = '*') {
        if (!db) throw new Error('Supabase client is unavailable');

        const rows = [];
        for (let offset = 0; ; offset += PAGE_SIZE) {
            const { data, error } = await db.from(table)
                .select(columns)
                .order('ballot_id', { ascending: true })
                .range(offset, offset + PAGE_SIZE - 1);
            if (error) throw error;
            rows.push(...(data || []));
            if (!data || data.length < PAGE_SIZE) break;
        }
        return rows;
    }

    async function fetchTableCount(table, column, filterStatus = null) {
        if (!db) throw new Error('Supabase client is unavailable');
        let query = db.from(table).select(column, { count: 'exact', head: true });
        if (filterStatus) {
            query = query.eq('status', filterStatus);
        }
        const { count, error } = await query;
        if (error) throw error;
        return count || 0;
    }

    async function loadMasterData() {
        if (candidateMetadata.length && partyMetadata.length) return;
        if (!db) throw new Error('Supabase client is unavailable');

        const [candidateResult, partyResult] = await Promise.all([
            db.from('mp_candidates').select('*'),
            db.from('party_candidates').select('*'),
        ]);
        if (candidateResult.error) throw candidateResult.error;
        if (partyResult.error) throw partyResult.error;

        candidateMetadata = (candidateResult.data || []).map(c => ({
            district_code: c.district_code || c.district || 'BKK-01',
            candidate_number: Number(c.candidate_number ?? c.number ?? c.id),
            candidate_name: c.candidate_name || c.full_name_th || c.full_name || c.name || '',
            party_name: c.party_name || c.party || '',
            party_number: Number(c.party_number ?? c.number ?? 0),
        }));

        partyMetadata = (partyResult.data || []).map(p => ({
            party_number: Number(p.party_number ?? p.number ?? p.id),
            party_name: p.party_name || p.name || '',
        }));
    }

    const DEFAULT_SHARED_SECRET = 'eLection-Threshold-Demo-Shared-Secret-2569';
    const FALLBACK_SHARED_SECRETS = [
        'eLection-Threshold-Demo-Shared-Secret-2569',
        'eLection-ECT-SecretKey-2026-BKK'
    ];

    function base64ToBytes(base64) {
        const clean = String(base64 || '').trim();
        const bin = atob(clean);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i += 1) {
            bytes[i] = bin.charCodeAt(i);
        }
        return bytes;
    }

    async function tryDecryptAesGcmBuffer(ivBytes, cipherBytes, secretStr) {
        const enc = new TextEncoder();
        try {
            const rawKeyBytes = enc.encode(String(secretStr).padEnd(32, '0')).slice(0, 32);
            const rawKey = await crypto.subtle.importKey('raw', rawKeyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
            const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, rawKey, cipherBytes);
            return new TextDecoder().decode(plainBuf);
        } catch {}

        try {
            const hashBuf = await crypto.subtle.digest('SHA-256', enc.encode(String(secretStr)));
            const shaKey = await crypto.subtle.importKey('raw', hashBuf, { name: 'AES-GCM' }, false, ['decrypt']);
            const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, shaKey, cipherBytes);
            return new TextDecoder().decode(plainBuf);
        } catch {}

        return null;
    }

    async function decryptVoteChoice(value, secret = DEFAULT_SHARED_SECRET) {
        if (value === null || value === undefined) return '';
        const secretsToTry = [secret, ...FALLBACK_SHARED_SECRETS.filter(s => s !== secret)];

        if (typeof value === 'object') {
            if (value.iv && value.ciphertext) {
                try {
                    const ivBytes = Array.isArray(value.iv) ? new Uint8Array(value.iv) : base64ToBytes(value.iv);
                    const cipherBytes = Array.isArray(value.ciphertext) ? new Uint8Array(value.ciphertext) : base64ToBytes(value.ciphertext);
                    for (const sec of secretsToTry) {
                        const res = await tryDecryptAesGcmBuffer(ivBytes, cipherBytes, sec);
                        if (res !== null) return res;
                    }
                } catch {}
            }
            if (typeof value.choice === 'string') return decryptVoteChoice(value.choice, secret);
            if (typeof value.ciphertext === 'string') return decryptVoteChoice(value.ciphertext, secret);
            return String(value);
        }

        const str = String(value).trim();
        if (!str) return '';

        if (str.startsWith('ENC[AES-GCM::')) {
            const encoded = str.slice('ENC[AES-GCM::'.length).replace(/\]$/, '');
            try {
                const bytes = base64ToBytes(encoded);
                const ivBytes = bytes.slice(0, 12);
                const cipherBytes = bytes.slice(12);
                for (const sec of secretsToTry) {
                    const res = await tryDecryptAesGcmBuffer(ivBytes, cipherBytes, sec);
                    if (res !== null) return res;
                }
            } catch {}
            return null;
        }

        if (str.startsWith('{') && str.endsWith('}')) {
            try {
                const parsed = JSON.parse(str);
                if (parsed && typeof parsed === 'object') {
                    return decryptVoteChoice(parsed, secret);
                }
            } catch {}
        }

        return str;
    }

    function parseEnvelope(value) {
        if (value && typeof value === 'object') return value;
        if (typeof value === 'string') {
            try { return JSON.parse(value); } catch { return {}; }
        }
        return {};
    }

    function choiceNumber(value) {
        if (value === null || value === undefined) return null;
        const raw = String(value).trim().toLowerCase();
        if (!raw) return null;
        if (raw === 'abstain' || raw === 'no_vote' || raw === 'ไม่ประสงค์ลงคะแนน' || raw === 'งดออกเสียง' || raw === '0') {
            return 'abstain';
        }
        const number = Number.parseInt(raw, 10);
        return Number.isInteger(number) && number > 0 ? number : null;
    }

    function referendumChoice(value) {
        if (value === null || value === undefined) return null;
        if (typeof value === 'object') {
            const inner = value.choice ?? value.vote ?? value.decrypted_vote ?? value.result ?? value.value ?? value.ciphertext;
            if (inner !== undefined) return referendumChoice(inner);
        }
        const str = String(value).trim();
        if (!str) return null;

        if (str.startsWith('{') && str.endsWith('}')) {
            try {
                const parsed = JSON.parse(str);
                if (parsed && typeof parsed === 'object') {
                    return referendumChoice(parsed);
                }
            } catch {}
        }

        const choice = str.toLowerCase();
        if (['approve', 'yes', 'agree', '1', 'เห็นชอบ'].includes(choice) || str === 'เห็นชอบ') return 'approve';
        if (['disapprove', 'no', 'disagree', '2', 'ไม่เห็นชอบ'].includes(choice) || str === 'ไม่เห็นชอบ') return 'disapprove';
        if (['abstain', 'no opinion', 'no_opinion', '0', '3', 'ไม่แสดงความคิดเห็น', 'งดออกเสียง', 'ไม่ประสงค์ลงคะแนน'].includes(choice) || str === 'ไม่แสดงความคิดเห็น' || str === 'งดออกเสียง') return 'abstain';
        return null;
    }

    /**
     * 1. การเลือกตั้ง ส.ส. (`loadMpResults()`):
     * รองรับการอ่านหมายเลขผู้สมัครและหมายเลขพรรคทั้งแบบแยก Column (`candidate_number` / `party_number`)
     * และแบบ JSON ใน `decrypted_vote` หรือ `encrypted_ballot` (`constituency` / `partyList`)
     * พร้อมเทียบชื่อผู้สมัครจาก `mp_candidates` และชื่อพรรคจาก `party_candidates` ให้ตรงกัน 100%
     */
    async function loadMpResults() {
        await loadMasterData();
        if (!areaSelectsInitialized) initAreaSelects();

        const [finalCount, activeStagingCount] = await Promise.all([
            fetchTableCount('mp_final_box', 'ballot_id'),
            fetchTableCount('mp_staging_box', 'voter_id', 'ACTIVE'),
        ]);

        if (finalCount !== lastFinalCount) {
            cachedFinalRows = await fetchAllRows('mp_final_box', '*');
            lastFinalCount = finalCount;
            votesByBallot.length = 0;

            for (const row of cachedFinalRows) {
                const decEnvelope = parseEnvelope(row.decrypted_vote);
                const encEnvelope = parseEnvelope(row.encrypted_ballot);

                const rawConstituency =
                    row.candidate_number ??
                    row.constituency_number ??
                    row.constituency ??
                    decEnvelope.constituency ??
                    decEnvelope.candidate_number ??
                    decEnvelope.candidateNumber ??
                    encEnvelope.constituency ??
                    encEnvelope.candidate_number ??
                    encEnvelope.candidateNumber ??
                    null;

                const rawPartyList =
                    row.party_number ??
                    row.partylist_number ??
                    row.party_list ??
                    row.partyList ??
                    decEnvelope.partyList ??
                    decEnvelope.party_list ??
                    decEnvelope.party_number ??
                    decEnvelope.partyNumber ??
                    encEnvelope.partyList ??
                    encEnvelope.party_list ??
                    encEnvelope.party_number ??
                    encEnvelope.partyNumber ??
                    null;

                const [candidateChoice, partyChoice] = await Promise.all([
                    decryptVoteChoice(rawConstituency),
                    decryptVoteChoice(rawPartyList),
                ]);

                const districtCode = row.district_code || decEnvelope.district_code || encEnvelope.district_code || 'BKK-01';

                votesByBallot.push({
                    districtCode,
                    candidateNumber: choiceNumber(candidateChoice),
                    partyNumber: choiceNumber(partyChoice),
                });
            }
        }

        totals.submitted = finalCount + activeStagingCount;
        totals.processed = finalCount;
        renderKpis();
        renderScores();
        return {
            submitted: totals.submitted,
            processed: totals.processed,
            votesByBallot,
        };
    }

    /**
     * 2. ประชามติ (`loadReferendumResults()`):
     * รองรับการอ่านค่า `row.decrypted_vote` ทั้งที่เป็น String (`'approve'`, `'disapprove'`, `'abstain'`, `'เห็นชอบ'`, ฯลฯ)
     * และ JSON เพื่อนำมาคำนวณผลรวมและเปอร์เซ็นต์อย่างแม่นยำ
     */
    async function loadReferendumResults() {
        const [finalCount, activeStagingCount] = await Promise.all([
            fetchTableCount('referendum_final_box', 'ballot_id'),
            fetchTableCount('referendum_staging_box', 'voter_id', 'ACTIVE'),
        ]);

        if (finalCount !== lastFinalCount) {
            cachedFinalRows = await fetchAllRows('referendum_final_box', '*');
            lastFinalCount = finalCount;
            referendumVotes.approve = 0;
            referendumVotes.disapprove = 0;
            referendumVotes.abstain = 0;

            for (const row of cachedFinalRows) {
                let rawVote = row.decrypted_vote ?? row.vote ?? row.choice ?? null;
                if (rawVote === null || rawVote === undefined || rawVote === '') {
                    const encObj = parseEnvelope(row.encrypted_ballot);
                    rawVote = encObj.decrypted_vote ?? encObj.choice ?? encObj.vote ?? encObj.ciphertext ?? row.encrypted_ballot ?? null;
                }

                if (typeof rawVote === 'object' && rawVote !== null) {
                    rawVote = rawVote.choice ?? rawVote.vote ?? rawVote.decrypted_vote ?? rawVote.value ?? rawVote.ciphertext ?? '';
                }

                if (typeof rawVote === 'string' && rawVote.startsWith('ENC[')) {
                    rawVote = await decryptVoteChoice(rawVote);
                } else if (typeof rawVote === 'string' && rawVote.trim().startsWith('{')) {
                    const parsed = parseEnvelope(rawVote);
                    const inner = parsed.choice ?? parsed.vote ?? parsed.decrypted_vote ?? parsed.value ?? parsed.ciphertext ?? '';
                    rawVote = (typeof inner === 'string' && inner.startsWith('ENC['))
                        ? await decryptVoteChoice(inner)
                        : (inner || rawVote);
                }

                const choice = referendumChoice(rawVote);
                if (choice && referendumVotes[choice] !== undefined) {
                    referendumVotes[choice] += 1;
                }
            }
        }

        totals.submitted = finalCount + activeStagingCount;
        totals.processed = finalCount;
        renderKpis();
        renderScores();
        return {
            submitted: totals.submitted,
            processed: totals.processed,
            referendumVotes: { ...referendumVotes },
        };
    }

    function scoreMessage(message) {
        const list = document.getElementById('scoreList');
        if (list) list.innerHTML = barRowHtml('', message, '', 0);
    }

    const scoreTypeSelect = document.getElementById('scoreTypeSelect');
    const scoreTypeLabel = document.getElementById('scoreTypeLabel');

    function currentScoreRows() {
        if (isReferendum) {
            return [
                { label: 'เห็นชอบ (Approve)', votes: referendumVotes.approve },
                { label: 'ไม่เห็นชอบ (Disapprove)', votes: referendumVotes.disapprove },
                { label: 'ไม่แสดงความคิดเห็น / งดออกเสียง (Abstain)', votes: referendumVotes.abstain },
            ];
        }

        const selectedBallots = type === 'constituency'
            ? votesByBallot.filter(ballot => ballot.districtCode === selected.district)
            : votesByBallot;
        const voteCounts = new Map();
        let abstainCount = 0;

        selectedBallots.forEach(ballot => {
            const vote = type === 'constituency' ? ballot.candidateNumber : ballot.partyNumber;
            if (vote === 'abstain') {
                abstainCount += 1;
            } else if (vote !== null) {
                voteCounts.set(vote, (voteCounts.get(vote) || 0) + 1);
            }
        });

        const rows = type === 'constituency'
            ? candidateMetadata
                .filter(candidate => candidate.district_code === selected.district)
                .map(candidate => ({
                    number: candidate.candidate_number,
                    label: `เบอร์ ${candidate.candidate_number} ${candidate.candidate_name} (${candidate.party_name})`,
                    votes: voteCounts.get(candidate.candidate_number) || 0,
                }))
            : partyMetadata.map(party => ({
                number: party.party_number,
                label: `${party.party_name} (เบอร์ ${party.party_number})`,
                votes: voteCounts.get(party.party_number) || 0,
            }));

        if (abstainCount > 0) rows.push({ number: Number.MAX_SAFE_INTEGER, label: 'ไม่ประสงค์ลงคะแนน', votes: abstainCount });
        return rows.sort((left, right) => right.votes - left.votes || left.number - right.number);
    }

    function renderScores() {
        const list = document.getElementById('scoreList');
        if (!list) return;

        if (scoreTypeSelect) scoreTypeSelect.value = type;
        if (scoreTypeLabel) {
            scoreTypeLabel.textContent = isReferendum
                ? 'ผลการออกเสียงประชามติ'
                : type === 'constituency' ? 'แบบแบ่งเขต' : 'แบบบัญชีรายชื่อ';
        }

        const rows = currentScoreRows();
        if (totals.processed === 0 || (type === 'constituency' && !rows.length)) {
            scoreMessage('ยังไม่มีบัตรที่ประมวลผลในฐานข้อมูล');
            return;
        }
        const total = isReferendum ? totals.processed : rows.reduce((sum, row) => sum + row.votes, 0);

        list.innerHTML = rows.map(row => {
            const share = Number(pct(row.votes, total));
            const sub = `${row.label} ${fmt(row.votes)} คะแนน`;
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

    function applyReferendumLabels() {
        if (!isReferendum) return;

        const cards = main.querySelectorAll('.only-counting .vs-kpi');
        if (cards.length >= 4) {
            // กล่องที่ 1: "สถานะการเลือกตั้ง" (หรือ สถานะการออกเสียง)
            const card0Title = cards[0].querySelector('.vs-kpi-title');
            if (card0Title) card0Title.innerHTML = 'สถานะ<br>การออกเสียง';

            // กล่องที่ 2: "ผู้มาใช้สิทธิสุทธิ"
            const card1Title = cards[1].querySelector('.vs-kpi-title');
            if (card1Title) card1Title.innerHTML = 'ผู้มาใช้สิทธิ<br>สุทธิ';
            const card1Body = cards[1].querySelector('.vs-kpi-body');
            if (card1Body) {
                card1Body.innerHTML = `
                    <div class="vs-kpi-lines">
                        <p class="vs-kpi-line"><b>ผู้มีสิทธิ :</b> <span data-bind="eligible">—</span> คน</p>
                        <p class="vs-kpi-line"><b>มาใช้สิทธิ :</b> <span data-bind="used">0</span> คน</p>
                    </div>
                    <p class="vs-kpi-big">คิดเป็น <span data-bind="usedPct">0.0</span>%</p>
                `;
            }

            // กล่องที่ 3: "บัตรในระบบสุทธิ"
            const card2Title = cards[2].querySelector('.vs-kpi-title');
            if (card2Title) card2Title.innerHTML = 'บัตรในระบบ<br>สุทธิ';
            const card2Body = cards[2].querySelector('.vs-kpi-body');
            if (card2Body) {
                card2Body.innerHTML = `
                    <div class="vs-kpi-lines">
                        <p class="vs-kpi-line"><b>บัตรประชามติ :</b> <span data-bind="ballotReferendum">0</span> ใบ</p>
                    </div>
                `;
            }

            // กล่องที่ 4: "นับคะแนนแล้ว"
            const card3Title = cards[3].querySelector('.vs-kpi-title');
            if (card3Title) card3Title.innerHTML = 'นับคะแนน<br>แล้ว';
            const card3Body = cards[3].querySelector('.vs-kpi-body');
            if (card3Body) {
                card3Body.innerHTML = `
                    <div class="vs-kpi-lines">
                        <p class="vs-kpi-line"><b>ประมวลผลแล้ว :</b> <span data-bind="countedReferendum">0</span> ใบ</p>
                    </div>
                    <p class="vs-kpi-big">คิดเป็น <span data-bind="countedPct">0.0</span>%</p>
                `;
            }
        }

        const waitingCards = main.querySelectorAll('.only-waiting .vs-kpi');
        if (waitingCards.length >= 4) {
            const wCard0Title = waitingCards[0].querySelector('.vs-kpi-title');
            if (wCard0Title) wCard0Title.innerHTML = 'สถานะ<br>การออกเสียง';

            const wCard2Title = waitingCards[2].querySelector('.vs-kpi-title');
            if (wCard2Title) wCard2Title.innerHTML = 'บัตรในระบบ<br>ขณะนี้';
            const wCard2Body = waitingCards[2].querySelector('.vs-kpi-body');
            if (wCard2Body) {
                wCard2Body.innerHTML = `
                    <div class="vs-kpi-lines">
                        <p class="vs-kpi-line"><b>บัตรประชามติ :</b> <span data-bind="ballotReferendum">0</span> ใบ</p>
                    </div>
                `;
            }
        }

        const scoreTitlePrefix = document.querySelector('.vs-score-title-prefix');
        if (scoreTitlePrefix) scoreTitlePrefix.textContent = 'ผลการออกเสียงประชามติแบบเรียลไทม์';
    }

    // ตัวสลับ บัญชีรายชื่อ / แบ่งเขต (ผ่าน dropdown สามเหลี่ยมตามดีไซน์)
    function setType(nextType) {
        if (isReferendum || !['partylist', 'constituency'].includes(nextType)) return;
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

        if (isReferendum) {
            if (wrap) wrap.hidden = true;
            if (scoreTypeLabel) scoreTypeLabel.textContent = 'ผลการออกเสียงประชามติ';
            return;
        }

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
        if (!provinceSelect || !districtSelect || isReferendum) return;

        const provinceNames = { BKK: 'กรุงเทพมหานคร', CMI: 'เชียงใหม่', PKT: 'ภูเก็ต' };
        const provinces = [...new Set(candidateMetadata
            .map(candidate => String(candidate.district_code || '').split('-')[0])
            .filter(Boolean))];
        if (!provinces.length) {
            provinceSelect.innerHTML = '<option value="">ไม่มีข้อมูลพื้นที่</option>';
            districtSelect.innerHTML = '<option value="">ไม่มีข้อมูลเขต</option>';
            return;
        }

        provinceSelect.innerHTML = provinces
            .map(code => `<option value="${escapeHtml(code)}">${escapeHtml(provinceNames[code] || code)}</option>`)
            .join('');
        selected.province = provinces.includes(selected.province) ? selected.province : provinces[0];

        function fillDistricts() {
            const districts = [...new Set(candidateMetadata
                .filter(candidate => String(candidate.district_code || '').startsWith(`${selected.province}-`))
                .map(candidate => candidate.district_code))];
            districtSelect.innerHTML = districts
                .map(code => `<option value="${escapeHtml(code)}">เขต ${escapeHtml(code)}</option>`)
                .join('');
            selected.district = districts.includes(selected.district) ? selected.district : (districts[0] || '');
            districtSelect.value = selected.district;
        }

        provinceSelect.value = selected.province;
        fillDistricts();
        areaSelectsInitialized = true;

        provinceSelect.addEventListener('change', () => {
            selected.province = provinceSelect.value;
            selected.district = 0;
            fillDistricts();
            renderScores();
        });

        districtSelect.addEventListener('change', () => {
            selected.district = districtSelect.value;
            renderScores();
        });
    }

    async function pollLiveResults() {
        try {
            if (isReferendum) {
                await loadReferendumResults();
            } else {
                await loadMpResults();
            }
        } catch (error) {
            console.warn('Unable to load live election results from Supabase', error);
            scoreMessage('ไม่สามารถโหลดผลคะแนนจากฐานข้อมูลได้');
        } finally {
            window.setTimeout(pollLiveResults, POLL_MS);
        }
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

    function formatRecordedTime(value) {
        const date = value ? new Date(value) : null;
        if (!date || Number.isNaN(date.getTime())) return '-';
        const day = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
        return `${day} | ${pad(date.getHours())}:${pad(date.getMinutes())} น.`;
    }

    function showResult(result) {
        if (!resultBox) return;
        resultBox.style.display = 'flex';
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
                        const isProcessed = record.status === 'COUNTED' || record.status === 'TALLIED' || record.status === 'PROCESSED';
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
        // 1. ค้นหาใน Supabase จริง (ทั้ง 4 ตาราง: mp_final_box, referendum_final_box, mp_staging_box, referendum_staging_box)
        const remote = await lookupSupabase(code);
        if (remote) return remote;

        // 2. ค้นหาใน Local Storage / Session Storage
        const local = lookupLocal(code);
        if (local) return local;

        // 3. กรณีค้นหาไม่พบรหัส
        return {
            ok: false,
            code: cleanWithHash,
            title: MSG_NOT_FOUND
        };
    }

    function initCheckForm() {
        if (resultBox) resultBox.style.display = 'none';

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
            const urlParams = new URLSearchParams(window.location.search);
            const eventId = urlParams.get('id') || 'house-election-2569';
            window.location.href = `Vote-Unlock.html?id=${encodeURIComponent(eventId)}`;
        });
    }

    // ---------------------------------------------------------------- Boot
    window.loadMpResults = loadMpResults;
    window.loadReferendumResults = loadReferendumResults;

    applyReferendumLabels();
    renderKpis();
    initCheckForm();

    if (state === 'waiting') {
        renderRegions();
        updateCountdown();
        window.setInterval(updateCountdown, 1000);
    } else {
        initSwitch();
    }

    pollLiveResults();
})();
