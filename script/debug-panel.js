(function () {
    'use strict';
    const params = new URLSearchParams(window.location.search);
    const debugRequested = params.get('debug') === 'true';
    if (debugRequested) sessionStorage.setItem('election-debug-mode', 'true');
    const debugEnabled = debugRequested || sessionStorage.getItem('election-debug-mode') === 'true';
    const db = typeof supabaseClient !== 'undefined' ? supabaseClient : null;
    const eventId = params.get('id') || 'house-election-2569';
    const secret = 'eLection-Threshold-Demo-Shared-Secret-2569';
    const rightsKey = 'demo-voter-rights';
    const timeKey = 'demo-election-time';

    async function syncSharedElectionTime() {
        if (!db || typeof db.from !== 'function') return;
        try {
            const { data, error } = await db
                .from('demo_election_state')
                .select('election_time')
                .eq('event_type', eventId)
                .maybeSingle();
            if (!error && data?.election_time) {
                localStorage.setItem(timeKey, data.election_time);
                window.dispatchEvent(new CustomEvent('demo-time-changed', { detail: data.election_time }));
            }
        } catch (error) {
            console.warn('Shared demo election time is unavailable; using local fallback', error);
        }
    }

    if (db?.from) {
        syncSharedElectionTime();
        if (db.channel) {
            db.channel(`demo-election-time-${eventId}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'demo_election_state', filter: `event_type=eq.${eventId}` }, syncSharedElectionTime)
                .subscribe();
        }
    }

    if (!debugEnabled) return;

    const roles = ['กกต.', 'พรรค 1', 'พรรค 2', 'ประชาชน 1', 'ประชาชน 2'];
    const state = { rights: localStorage.getItem(rightsKey) || 'both', time: localStorage.getItem(timeKey) || 'open' };

    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `${location.pathname.includes('/pages/') ? '../' : ''}css/debug-panel.css`;
    document.head.appendChild(css);

    const el = (tag, attrs = {}, text = '') => {
        const node = document.createElement(tag);
        Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
        if (text) node.textContent = text;
        return node;
    };
    const button = (label, className, handler) => {
        const node = el('button', { type: 'button', class: className }, label);
        node.addEventListener('click', handler);
        return node;
    };

    const fab = button('⚙', 'debug-fab', () => drawer.classList.toggle('is-open'));
    fab.setAttribute('aria-label', 'เปิดแผง Debug Demo');
    document.body.appendChild(fab);

    const drawer = el('aside', { class: 'debug-drawer', 'aria-label': 'Demo Debug Panel' });
    drawer.innerHTML = '<div class="debug-drawer-head"><strong>Demo Debug Panel</strong><button type="button" class="debug-close" aria-label="ปิด">×</button></div>';
    drawer.querySelector('.debug-close').addEventListener('click', () => drawer.classList.remove('is-open'));
    const body = el('div', { class: 'debug-drawer-body' });
    drawer.appendChild(body);
    document.body.appendChild(drawer);

    const section = (title) => { const wrap = el('section', { class: 'debug-section' }); wrap.appendChild(el('h3', {}, title)); body.appendChild(wrap); return wrap; };

    const rights = section('Voter Rights Switcher');
    const rightsSelect = el('select', { class: 'debug-select' });
    [['both', 'มีสิทธิ์ ส.ส. + ประชามติ'], ['mp', 'มีเฉพาะ ส.ส.'], ['referendum', 'มีเฉพาะประชามติ']].forEach(([value, label]) => rightsSelect.appendChild(el('option', { value }, label)));
    rightsSelect.value = state.rights;
    rightsSelect.addEventListener('change', () => { state.rights = rightsSelect.value; localStorage.setItem(rightsKey, state.rights); applyRights(); });
    rights.appendChild(rightsSelect);
    function applyRights() {
        try {
            const voter = JSON.parse(localStorage.getItem('election_current_voter') || '{}');
            voter.eligible_mp = state.rights !== 'referendum';
            voter.eligible_referendum = state.rights !== 'mp';
            localStorage.setItem('election_current_voter', JSON.stringify(voter));
            window.dispatchEvent(new CustomEvent('demo-rights-changed', { detail: state.rights }));
        } catch { /* ignore storage errors in demo mode */ }
    }
    applyRights();

    const ballots = section('Batch Mock Ballots Generator');
    ballots.appendChild(button('+10 บัตร ส.ส.', 'debug-action', () => generateBallots('mp', 10)));
    ballots.appendChild(button('+20 บัตรประชามติ', 'debug-action', () => generateBallots('referendum', 20)));

    const time = section('Election Time Simulator');
    const timeButton = button('', 'debug-toggle', async () => {
        state.time = state.time === 'open' ? 'closed' : 'open';
        localStorage.setItem(timeKey, state.time);
        renderTime();
        window.dispatchEvent(new CustomEvent('demo-time-changed', { detail: state.time }));
        if (db?.from) {
            const updatedAt = new Date().toISOString();
            const { error } = await db.from('demo_election_state').upsert([
                { event_type: 'house-election-2569', election_time: state.time, updated_at: updatedAt },
                { event_type: 'referendum-2569-03', election_time: state.time, updated_at: updatedAt },
            ], { onConflict: 'event_type' });
            if (error) notify(`บันทึกเวลาจำลองแบบรวมศูนย์ไม่สำเร็จ ใช้ค่าเฉพาะเครื่องนี้: ${error.message}`);
        }
    });
    time.appendChild(timeButton);
    function renderTime() { timeButton.textContent = state.time === 'open' ? 'เปิดรับคะแนน (ก่อน 17:00)' : 'ปิดหีบเลือกตั้ง (หลัง 17:00)'; timeButton.classList.toggle('is-on', state.time === 'closed'); }
    renderTime();
    window.addEventListener('demo-time-changed', event => {
        if (event.detail === 'open' || event.detail === 'closed') {
            state.time = event.detail;
            renderTime();
        }
    });

    const ceremony = section('Key Ceremony Override');
    roles.forEach((role, index) => ceremony.appendChild(button(`ส่งรหัส: ${role}`, 'debug-action', () => submitKey(index + 1))));

    const reset = section('Reset Demo Data');
    reset.appendChild(button('ล้างคะแนน + ผู้มีสิทธิ์', 'debug-danger', resetVotesAndVoters));
    reset.appendChild(button('ล้างข้อมูลและเริ่มรอบใหม่', 'debug-danger', resetDemo));

    const badge = el('div', { class: 'debug-status-badge', role: 'status' });
    body.appendChild(badge);
    const notify = message => { badge.dataset.message = message; refresh(); };

    async function encrypt(text) {
        const encoder = new TextEncoder();
        const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
        const key = await crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt']);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(text));
        const bytes = new Uint8Array(iv.length + cipher.byteLength); bytes.set(iv); bytes.set(new Uint8Array(cipher), iv.length);
        return `ENC[AES-GCM::${btoa(String.fromCharCode(...bytes))}]`;
    }

    async function generateBallots(type, count) {
        if (!db) return notify('ไม่พบ Supabase client');
        const table = type === 'mp' ? 'mp_staging_box' : 'referendum_staging_box';
        const rows = [];
        for (let i = 0; i < count; i += 1) {
            const voterId = `demo-${type}-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`;
            const choice = type === 'mp' ? (Math.random() < 0.1 ? 'abstain' : String(1 + Math.floor(Math.random() * 20))) : ['approve', 'disapprove', 'abstain'][Math.floor(Math.random() * 3)];
            const encrypted = await encrypt(JSON.stringify(type === 'mp' ? { constituency: choice, partyList: choice } : { choice }));
            rows.push(type === 'mp' ? { voter_id: voterId, tracking_hash: voterId, district_code: 'BKK-01', encrypted_ballot: { ciphertext: encrypted }, status: 'ACTIVE' } : { voter_id: voterId, tracking_hash: voterId, encrypted_ballot: { choice: encrypted }, status: 'ACTIVE' });
        }
        const { error } = await db.from(table).insert(rows);
        notify(error ? `สร้างข้อมูลไม่สำเร็จ: ${error.message}` : `เพิ่ม ${count} บัตรแล้ว`);
    }

    async function submitKey(roleIndex) {
        if (!db) return notify('ไม่พบ Supabase client');
        let { error } = await db.rpc('submit_unlock_approval', { p_event_type: eventId, p_role_index: roleIndex });
        if (error) {
            const fallback = await db.from('unlock_approvals').upsert({ event_type: eventId, role_index: roleIndex }, { onConflict: 'event_type,role_index' });
            error = fallback.error;
        }
        {
            const key = `election_unlock_approvals_${eventId}`;
            const current = JSON.parse(localStorage.getItem(key) || '{"completed":false,"approved":[],"txRefs":{}}');
            current.approved = [...new Set([...(current.approved || []), roleIndex])];
            localStorage.setItem(key, JSON.stringify(current));
            notify(error ? `บันทึกรหัสฝ่าย ${roles[roleIndex - 1]} ในโหมด Demo แล้ว (รอเชื่อม RPC)` : `ส่งรหัสฝ่าย ${roles[roleIndex - 1]} แล้ว`);
            window.dispatchEvent(new StorageEvent('storage', { key }));
            window.dispatchEvent(new CustomEvent('demo-approval-changed', { detail: { roleIndex, eventId } }));
        }
    }

    async function resetDemo() {
        if (!db || !window.confirm('ล้างข้อมูล Demo ทั้งหมดและเริ่มรอบใหม่หรือไม่?')) return;
        const jobs = [
            ['mp_final_box', null], ['referendum_final_box', null],
            ['mp_staging_box', { status: 'RESET', encrypted_ballot: null }],
            ['referendum_staging_box', { status: 'RESET', encrypted_ballot: null }],
        ];
        for (const [table, values] of jobs) {
            const query = db.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
            if (values) await db.from(table).update(values).neq('id', '00000000-0000-0000-0000-000000000000'); else await query;
        }
        await db.from('unlock_approvals').delete().eq('event_type', eventId);
        await db.from('key_ceremony_status').update({ approved: false }).eq('event_type', eventId);
        await db.from('key_ceremony_status').update({ status: 0 }).eq('event_type', eventId);
        // Start every new demo round in the open state for all devices.
        const openedAt = new Date().toISOString();
        await db.from('demo_election_state').upsert([
            { event_type: 'house-election-2569', election_time: 'open', updated_at: openedAt },
            { event_type: 'referendum-2569-03', election_time: 'open', updated_at: openedAt },
        ], { onConflict: 'event_type' });
        state.time = 'open';
        localStorage.setItem(timeKey, 'open');
        renderTime();
        window.dispatchEvent(new CustomEvent('demo-time-changed', { detail: 'open' }));
        notify('รีเซ็ต Demo แล้ว');
    }

    async function resetVotesAndVoters() {
        if (!db || !window.confirm('Reset all votes and return every mock voter to unused?')) return;
        const jobs = [
            ['mp_final_box', null], ['referendum_final_box', null],
            ['mp_staging_box', { status: 'RESET', encrypted_ballot: null }],
            ['referendum_staging_box', { status: 'RESET', encrypted_ballot: null }],
        ];
        const errors = [];
        for (const [table, values] of jobs) {
            const result = values
                ? await db.from(table).update(values).neq('id', '00000000-0000-0000-0000-000000000000')
                : await db.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
            if (result.error) errors.push(`${table}: ${result.error.message}`);
        }
        const voterReset = await db.from('mock_citizens')
            .update({ is_claimed: false, claimed_at: null })
            .eq('is_claimed', true);
        if (voterReset.error) errors.push(`mock_citizens: ${voterReset.error.message}`);
        await db.from('unlock_approvals').delete().in('event_type', ['house-election-2569', 'referendum-2569-03']);
        await db.from('key_ceremony_status').update({ approved: false, status: 0 }).in('event_type', ['house-election-2569', 'referendum-2569-03']);
        await db.from('demo_election_state').upsert([
            { event_type: 'house-election-2569', election_time: 'open', updated_at: new Date().toISOString() },
            { event_type: 'referendum-2569-03', election_time: 'open', updated_at: new Date().toISOString() },
        ], { onConflict: 'event_type' });
        localStorage.removeItem('election_current_voter');
        localStorage.removeItem('voter_session');
        localStorage.removeItem('election_unlock_approvals_house-election-2569');
        localStorage.removeItem('election_unlock_approvals_referendum-2569-03');
        localStorage.setItem(timeKey, 'open');
        window.dispatchEvent(new CustomEvent('demo-time-changed', { detail: 'open' }));
        notify(errors.length ? `Reset completed with errors: ${errors.join(' | ')}` : 'Votes cleared and all mock voters reset');
    }

    async function count(table, filter) { const query = db.from(table).select('*', { count: 'exact', head: true }); if (filter) query.eq('status', filter); const result = await query; return result.count || 0; }
    async function refresh() {
        if (!db) { badge.textContent = 'Supabase: ไม่พร้อมใช้งาน'; return; }
        const [mpStage, refStage, mpFinal, refFinal, keys] = await Promise.all([count('mp_staging_box', 'ACTIVE'), count('referendum_staging_box', 'ACTIVE'), count('mp_final_box'), count('referendum_final_box'), db.from('unlock_approvals').select('role_index', { count: 'exact', head: true }).eq('event_type', eventId)]);
        badge.textContent = `${badge.dataset.message ? `${badge.dataset.message} · ` : ''}Staging ${mpStage + refStage} · Final ${mpFinal + refFinal} · กุญแจ ${keys.count || 0}/5`;
    }
    refresh();
    window.setInterval(refresh, 2000);
    if (db?.channel) db.channel('demo-debug-status').on('postgres_changes', { event: '*', schema: 'public' }, refresh).subscribe();
})();
