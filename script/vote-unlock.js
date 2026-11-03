(function () {
    'use strict';

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
    const stateKey = `election_unlock_state_${eventKey}`;
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
            'ตัวแทนพรรคการเมือง',
            'ตัวแทนพรรคการเมือง',
            'ตัวแทนพรรคการเมือง',
            'ผู้แทนภาคประชาชนและผู้สังเกตการณ์',
        ];

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
        const saved = safeReadJson(window.localStorage, stateKey, {});
        const txRefs = saved.txRefs && typeof saved.txRefs === 'object' ? saved.txRefs : {};
        const usedIds = new Set(
            Object.values(txRefs)
                .map(reference => Number.parseInt(String(reference).replace(/^#TX-/, ''), 16))
                .filter(Number.isFinite)
        );

        for (let number = 1; number <= 4; number += 1) {
            if (!/^#TX-[0-9A-F]{4}$/.test(txRefs[number] || '')) {
                txRefs[number] = generateTxId(usedIds);
            }
        }
        if (saved.completed === true && !/^#TX-[0-9A-F]{4}$/.test(txRefs[5] || '')) {
            txRefs[5] = generateTxId(usedIds);
        }

        return {
            completed: saved.completed === true,
            txRefs,
        };
    }

    const state = loadState();

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
            return window.supabase.createClient(
                'https://nzobdkybbpufntionuze.supabase.co/',
                'sb_publishable_xBBzY0PXxUVWx4fINXBk3w_UwSEywAq'
            );
        }
        return null;
    }

    function partyNameFromRow(row) {
        const partyFields = ['party_name_th', 'party_name', 'partyname', 'party_th', 'party'];
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

    async function getRandomPartyNames() {
        const client = getSupabaseClient();
        if (!client) return [];

        try {
            const { data, error } = await client.from('party_candidates').select('*');
            if (error) throw error;

            const names = [...new Set((data || []).map(partyNameFromRow).filter(Boolean))];
            for (let index = names.length - 1; index > 0; index -= 1) {
                const swapIndex = Math.floor(Math.random() * (index + 1));
                [names[index], names[swapIndex]] = [names[swapIndex], names[index]];
            }
            return names.slice(0, 3);
        } catch (error) {
            console.warn('Cannot load parties from party_candidates', error);
            return [];
        }
    }

    function renderNames(partyNames) {
        if (!isReferendum) {
            stakeholderNames[1] = partyNames[0]
                ? `ตัวแทน${partyNames[0].startsWith('พรรค') ? '' : 'พรรค'}${partyNames[0]}`
                : 'ตัวแทนพรรคการเมือง';
            stakeholderNames[2] = partyNames[1]
                ? `ตัวแทน${partyNames[1].startsWith('พรรค') ? '' : 'พรรค'}${partyNames[1]}`
                : 'ตัวแทนพรรคการเมือง';
            stakeholderNames[3] = partyNames[2]
                ? `ตัวแทน${partyNames[2].startsWith('พรรค') ? '' : 'พรรค'}${partyNames[2]}`
                : 'ตัวแทนพรรคการเมือง';
        }

        stakeholderNames.forEach((name, index) => {
            const nameElement = document.getElementById(`name-${index + 1}`);
            if (nameElement) nameElement.textContent = `${index + 1}. ${name}`;
        });
    }

    function updateProgress() {
        const confirmedCount = state.completed ? 5 : 4;
        const percentage = confirmedCount * 20;
        const trackerLabel = document.getElementById('trackerLabel');
        const progressTrack = document.querySelector('.vu-main-progress-track');
        const progressFill = document.getElementById('mainProgressFill');

        if (trackerLabel) trackerLabel.textContent = `ส่งรหัสแล้ว ${confirmedCount} / 5 ฝ่าย`;
        if (progressTrack) progressTrack.setAttribute('aria-valuenow', String(percentage));
        if (progressFill) progressFill.style.width = `${percentage}%`;
    }

    function renderStatus() {
        for (let number = 1; number <= 4; number += 1) {
            const reference = document.getElementById(`ref-${number}`);
            if (reference) reference.textContent = `(รหัสอ้างอิง: ${state.txRefs[number]})`;
        }

        const card = document.getElementById('card-5');
        const iconWrap = document.getElementById('iconWrap-5');
        const statusMain = document.getElementById('statusMain-5');
        const reference = document.getElementById('ref-5');
        const actionRow = document.getElementById('actionRow-5');
        const button = document.getElementById('btnSubmitCode');

        if (state.completed) {
            if (card) card.classList.remove('vu-card--pending');
            if (iconWrap) {
                iconWrap.classList.remove('vu-card-icon-wrap--pending');
                iconWrap.innerHTML = '<i class="fa-solid fa-check vu-icon-check" aria-hidden="true"></i>';
            }
            if (statusMain) statusMain.textContent = 'สถานะ: ยืนยันรหัสปลดล็อกแล้ว';
            if (reference) {
                reference.textContent = `(รหัสอ้างอิง: ${state.txRefs[5]})`;
                reference.hidden = false;
            }
            if (actionRow) actionRow.style.display = 'none';
            if (button) button.hidden = true;

            const step3Tag = document.getElementById('step3Tag');
            const processProgressFill = document.getElementById('processProgressFill');
            if (step3Tag) step3Tag.textContent = '100%';
            if (processProgressFill) processProgressFill.style.width = '100%';
        } else {
            if (card) card.classList.add('vu-card--pending');
            if (iconWrap) {
                iconWrap.classList.add('vu-card-icon-wrap--pending');
                iconWrap.innerHTML = '<i class="fa-regular fa-circle vu-icon-circle" aria-hidden="true"></i>';
            }
            if (statusMain) statusMain.textContent = 'สถานะ: รอดำเนินการยืนยันรหัส';
            if (reference) {
                reference.textContent = '';
                reference.hidden = true;
            }
            if (actionRow) actionRow.style.display = '';
            if (button) button.hidden = false;
        }

        updateProgress();
    }

    async function decryptBallotChoice(value) {
        if (typeof value !== 'string' || !value.startsWith('ENC[AES-GCM::')) return value;

        const encoded = value.slice('ENC[AES-GCM::'.length).replace(/\]$/, '');
        try {
            const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
            const key = await window.crypto.subtle.importKey(
                'raw',
                new TextEncoder().encode('eLection-ECT-SecretKey-2026-BKK'.padEnd(32, '0')),
                { name: 'AES-GCM' },
                false,
                ['decrypt']
            );
            const plaintext = await window.crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: bytes.slice(0, 12) },
                key,
                bytes.slice(12)
            );
            return new TextDecoder().decode(plaintext);
        } catch {
            return null;
        }
    }

    function parseBallot(value) {
        if (value && typeof value === 'object') return value;
        if (typeof value === 'string') {
            try { return JSON.parse(value); } catch { return {}; }
        }
        return {};
    }

    function createBallotId() {
        if (window.crypto?.randomUUID) return `BLT-${window.crypto.randomUUID()}`;
        const bytes = new Uint8Array(16);
        window.crypto.getRandomValues(bytes);
        return `BLT-${Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('')}`;
    }

    async function processStagingBallots() {
        const client = getSupabaseClient();
        const step3Tag = document.getElementById('step3Tag');
        const processProgressFill = document.getElementById('processProgressFill');
        if (!client) {
            if (step3Tag) step3Tag.textContent = 'เชื่อมต่อฐานข้อมูลไม่ได้';
            return;
        }

        const stagingTable = isReferendum ? 'referendum_staging_box' : 'mp_staging_box';
        const finalTable = isReferendum ? 'referendum_final_box' : 'mp_final_box';
        const stagingColumns = isReferendum
            ? 'voter_id,encrypted_ballot,status'
            : 'voter_id,district_code,encrypted_ballot,status';

        try {
            const { data: ballots, error } = await client.from(stagingTable)
                .select(stagingColumns)
                .eq('status', 'ACTIVE');
            if (error) throw error;

            if (!ballots || ballots.length === 0) {
                if (step3Tag) step3Tag.textContent = 'ไม่มีบัตรรอประมวลผล';
                if (processProgressFill) processProgressFill.style.width = '0%';
                return;
            }

            let processed = 0;
            for (const ballot of ballots) {
                const envelope = parseBallot(ballot.encrypted_ballot);
                let payload;

                if (isReferendum) {
                    const decryptedVote = await decryptBallotChoice(envelope.ciphertext || envelope.choice);
                    if (!decryptedVote) continue;
                    payload = {
                        ballot_id: createBallotId(),
                        encrypted_ballot: ballot.encrypted_ballot,
                        decrypted_vote: decryptedVote,
                        counted_at: new Date().toISOString(),
                    };
                } else {
                    const [candidateChoice, partyChoice] = await Promise.all([
                        decryptBallotChoice(envelope.constituency),
                        decryptBallotChoice(envelope.partyList),
                    ]);
                    if (!candidateChoice || !partyChoice) continue;
                    payload = {
                        ballot_id: createBallotId(),
                        encrypted_ballot: { constituency: candidateChoice, partyList: partyChoice },
                        district_code: ballot.district_code,
                        counted_at: new Date().toISOString(),
                    };
                }

                const { error: insertError } = await client.from(finalTable).insert(payload);
                if (insertError) {
                    console.warn(`Could not insert ballot into ${finalTable}`, insertError);
                    continue;
                }

                const { error: updateError } = await client.from(stagingTable)
                    .update({ status: 'TALLIED' })
                    .eq('voter_id', ballot.voter_id);
                if (updateError) console.warn(`Could not update ${stagingTable} status`, updateError);

                processed += 1;
                const percentage = Math.round((processed / ballots.length) * 100);
                if (step3Tag) step3Tag.textContent = `${percentage}%`;
                if (processProgressFill) processProgressFill.style.width = `${percentage}%`;
            }

            if (processed === 0 && step3Tag) step3Tag.textContent = 'ไม่มีบัตรที่ถอดรหัสได้';
        } catch (error) {
            console.error(`Could not process ballots from ${stagingTable}`, error);
            if (step3Tag) step3Tag.textContent = 'ประมวลผลไม่สำเร็จ';
        }
    }

    async function submitUnlockCode() {
        if (state.completed) return;
        const usedIds = new Set(Object.values(state.txRefs).map(ref => Number.parseInt(ref.slice(-4), 16)));
        state.txRefs[5] = generateTxId(usedIds);
        state.completed = true;
        saveState();
        renderStatus();
        await processStagingBallots();
    }

    function init() {
        const backLink = document.getElementById('backLink');
        if (backLink) backLink.href = `Vote-Status.html?id=${encodeURIComponent(eventKey)}`;

        const button = document.getElementById('btnSubmitCode');
        if (button) button.addEventListener('click', submitUnlockCode);

        renderNames([]);
        renderStatus();
        saveState();

        if (!isReferendum) getRandomPartyNames().then(renderNames);
        if (state.completed) processStagingBallots();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();