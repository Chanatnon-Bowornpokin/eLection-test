/**
 * voter-identity.js
 * ระบบตัวตนประชาชน (Mock Voter Onboarding), การแสดงผลการ์ด Profile, และการกรองสิทธิ์หน้าบ้าน
 * - เชื่อมต่อ Supabase ตาราง mock_citizens เพื่อแจกสิทธิ์ตัวตนประจำเครื่องอัตโนมัติ
 * - บันทึกลง localStorage: election_current_voter
 * - ควบคุมการเปิด-ปิดการ์ด Profile Dropdown ที่ปุ่ม .userIcon มุมขวาบน
 * - มี Helper ตรวจสอบสิทธิ์ (eligible_mp, eligible_referendum) สำหรับหน้าบ้าน
 */

(function (window) {
    'use strict';

    const STORAGE_KEY = 'election_current_voter';
    const SESSION_KEY = 'voter_session';

    const SUPABASE_URL = (typeof window.SUPABASE_URL !== 'undefined')
        ? window.SUPABASE_URL
        : 'https://nzobdkybbpufntionuze.supabase.co/';

    const SUPABASE_ANON_KEY = (typeof window.SUPABASE_ANON_KEY !== 'undefined')
        ? window.SUPABASE_ANON_KEY
        : 'sb_publishable_xBBzY0PXxUVWx4fINXBk3w_UwSEywAq';

    // Mock Fallback กรณีออฟไลน์หรือเกิดข้อผิดพลาดในการเชื่อมต่อ
    const FALLBACK_VOTER = {
        id: 1,
        citizen_id: '9-1001-50001-01-1',
        full_name_th: 'นายกิตติศักดิ์ เพิ่มมงคล',
        district_code: 'BKK-01',
        district_info: 'เขต 1 (พระนคร) กรุงเทพมหานคร',
        eligible_mp: true,
        eligible_referendum: true,
        is_claimed: true,
        claimed_at: new Date().toISOString()
    };

    let claimPromise = null;

    /**
     * ดึงข้อมูลผู้โหวตปัจจุบันจาก LocalStorage (Synchronous)
     */
    function getVoter() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            console.warn('[VoterIdentity] Failed to read localStorage:', e);
            return null;
        }
    }

    /**
     * ดึงข้อมูลผู้โหวต หรือหากยังไม่มีให้ Query และ Claim สิทธิ์จาก Supabase (Asynchronous)
     */
    async function getOrClaimVoter() {
        const existing = getVoter();
        if (existing) {
            syncVoterSession(existing);
            return existing;
        }

        if (claimPromise) {
            return claimPromise;
        }

        claimPromise = (async () => {
            try {
                let voter = null;

                // 1. ลองใช้ Supabase Client หากมี
                if (typeof window.supabaseClient !== 'undefined' && window.supabaseClient) {
                    const { data, error } = await window.supabaseClient
                        .from('mock_citizens')
                        .select('*')
                        .eq('is_claimed', false)
                        .order('id', { ascending: true })
                        .limit(1)
                        .maybeSingle();

                    if (!error && data) {
                        voter = data;
                        await window.supabaseClient
                            .from('mock_citizens')
                            .update({
                                is_claimed: true,
                                claimed_at: new Date().toISOString()
                            })
                            .eq('id', voter.id);
                    }
                }

                // 2. หากยังไม่ได้ ให้ใช้ Supabase REST API ผ่าน fetch โดยตรง
                if (!voter && typeof window.fetch === 'function') {
                    const getRes = await fetch(`${SUPABASE_URL}rest/v1/mock_citizens?is_claimed=eq.false&order=id.asc&limit=1`, {
                        method: 'GET',
                        headers: {
                            'apikey': SUPABASE_ANON_KEY,
                            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                            'Accept': 'application/json'
                        }
                    });

                    if (getRes.ok) {
                        const list = await getRes.json();
                        if (Array.isArray(list) && list.length > 0) {
                            voter = list[0];
                            const patchRes = await fetch(`${SUPABASE_URL}rest/v1/mock_citizens?id=eq.${voter.id}`, {
                                method: 'PATCH',
                                headers: {
                                    'apikey': SUPABASE_ANON_KEY,
                                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                                    'Content-Type': 'application/json',
                                    'Prefer': 'return=representation'
                                },
                                body: JSON.stringify({
                                    is_claimed: true,
                                    claimed_at: new Date().toISOString()
                                })
                            });

                            if (patchRes.ok) {
                                const patched = await patchRes.json();
                                if (Array.isArray(patched) && patched.length > 0) {
                                    voter = patched[0];
                                } else {
                                    voter.is_claimed = true;
                                    voter.claimed_at = new Date().toISOString();
                                }
                            }
                        }
                    }
                }

                // 3. หากดึงไม่ได้จริง ๆ ให้ใช้ Fallback
                if (!voter) {
                    console.warn('[VoterIdentity] Unable to claim from Supabase, applying fallback voter.');
                    voter = FALLBACK_VOTER;
                }

                // บันทึกผลลัพธ์ลง LocalStorage
                localStorage.setItem(STORAGE_KEY, JSON.stringify(voter));
                syncVoterSession(voter);

                // แจ้งเตือน Event ทั่วทั้งหน้าเว็บ
                window.dispatchEvent(new CustomEvent('voter-claimed', { detail: voter }));
                return voter;
            } catch (err) {
                console.error('[VoterIdentity] Error during voter claim flow:', err);
                const fallback = FALLBACK_VOTER;
                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback));
                    syncVoterSession(fallback);
                } catch (_) {}
                window.dispatchEvent(new CustomEvent('voter-claimed', { detail: fallback }));
                return fallback;
            } finally {
                claimPromise = null;
            }
        })();

        return claimPromise;
    }

    /**
     * ซิงค์ข้อมูลกับ voter_session เพื่อให้ Flow การลงคะแนนเชื่อมโยงกันอย่างสมบูรณ์
     */
    function syncVoterSession(voter) {
        if (!voter) return;
        try {
            const session = {
                citizenId: voter.citizen_id,
                fullName: voter.full_name_th || voter.full_name || voter.name || voter.fullName || '',
                districtCode: voter.district_code || 'BKK-01',
                districtInfo: voter.district_info || voter.districtInfo || voter.district || ''
            };
            localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        } catch (_) {}
    }

    /**
     * ตรวจสอบสิทธิ์การลงคะแนนสำหรับอีเวนต์ที่ระบุ
     */
    function isEligibleFor(eventId, voter) {
        const v = voter || getVoter();
        if (!v) return true; // ถ้ายังไม่มีข้อมูล ให้แสดงตามปกติ

        if (eventId === 'house-election-2569') {
            return v.eligible_mp !== false;
        }
        if (eventId === 'referendum-2569-03') {
            return v.eligible_referendum !== false;
        }
        return true;
    }

    /**
     * สลับไปยังตัวตนผู้มีสิทธิเลือกตั้งคนถัดไปในฐานข้อมูล
     */
    async function nextVoter() {
        const current = getVoter();
        const currentId = (current && current.id) ? Number(current.id) : 0;
        let nextCitizen = null;

        try {
            // 1. ลองค้นหาคนถัดไปที่ยังไม่ถูกเคลม (id > currentId)
            const res = await fetch(`${SUPABASE_URL}rest/v1/mock_citizens?is_claimed=eq.false&id=gt.${currentId}&order=id.asc&limit=1`, {
                method: 'GET',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Accept': 'application/json'
                }
            });
            if (res.ok) {
                const list = await res.json();
                if (Array.isArray(list) && list.length > 0) {
                    nextCitizen = list[0];
                }
            }
        } catch (e) {
            console.warn('[VoterIdentity] Error querying next citizen:', e);
        }

        // 2. ถ้าไม่มีคนว่างที่มี id มากกว่า ให้วนหาคนว่างแรกในระบบ
        if (!nextCitizen) {
            try {
                const res = await fetch(`${SUPABASE_URL}rest/v1/mock_citizens?is_claimed=eq.false&order=id.asc&limit=1`, {
                    method: 'GET',
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                        'Accept': 'application/json'
                    }
                });
                if (res.ok) {
                    const list = await res.json();
                    if (Array.isArray(list) && list.length > 0) {
                        nextCitizen = list[0];
                    }
                }
            } catch (e) {
                console.warn('[VoterIdentity] Error querying any unclaimed:', e);
            }
        }

        // 3. ถ้าไม่มีคนว่างเหลือเลยจริง ๆ ให้รีเซ็ตทั้งระบบแล้วเริ่มใหม่ที่คนแรก
        if (!nextCitizen) {
            await resetAllVoters();
            return;
        }

        // อัปเดตสถานะของคนใหม่ใน Supabase เป็น is_claimed = true
        try {
            await fetch(`${SUPABASE_URL}rest/v1/mock_citizens?id=eq.${nextCitizen.id}`, {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({
                    is_claimed: true,
                    claimed_at: new Date().toISOString()
                })
            });
        } catch (e) {
            console.warn('[VoterIdentity] Error updating claimed status in DB:', e);
        }

        nextCitizen.is_claimed = true;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextCitizen));
        syncVoterSession(nextCitizen);

        console.log(`✅ สลับไปยังตัวตนใหม่สำเร็จ: ID ${nextCitizen.id} (${nextCitizen.full_name_th})`);
        window.location.reload();
    }

    /**
     * รีเซ็ตฐานข้อมูล mock_citizens ใน Supabase ทั้งหมดให้กลับมาเป็นสถานะว่าง (is_claimed = false) และเริ่มใหม่ที่คนแรก
     */
    async function resetAllVoters() {
        try {
            await fetch(`${SUPABASE_URL}rest/v1/mock_citizens?is_claimed=eq.true`, {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ is_claimed: false, claimed_at: null })
            });
        } catch (e) {
            console.error('[VoterIdentity] Failed to reset all voters in Supabase:', e);
        }
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(SESSION_KEY);
        console.log('✅ รีเซ็ตตาราง mock_citizens ใน Supabase ทั้งหมดเรียบร้อย กำลังรีโหลดเพื่อเริ่มที่คนแรก...');
        window.location.reload();
    }

    /**
     * สร้างและควบคุม Navbar Profile Dropdown Card
     */
    function initProfileDropdown() {
        const userIcon = document.querySelector('.userIcon');
        if (!userIcon) return;

        userIcon.setAttribute('role', 'button');
        userIcon.setAttribute('tabindex', '0');
        userIcon.setAttribute('aria-haspopup', 'dialog');
        userIcon.setAttribute('aria-expanded', 'false');
        userIcon.setAttribute('aria-label', 'โปรไฟล์ผู้มีสิทธิเลือกตั้ง');

        let dropdown = userIcon.querySelector('.user-profile-dropdown');
        if (!dropdown) {
            dropdown = document.createElement('div');
            dropdown.className = 'user-profile-dropdown';
            dropdown.id = 'userProfileDropdown';
            dropdown.setAttribute('role', 'dialog');
            dropdown.setAttribute('aria-label', 'ข้อมูลผู้มีสิทธิเลือกตั้ง');

            dropdown.innerHTML = `
                <div class="user-profile-avatar" aria-hidden="true">
                    <span class="material-symbols-outlined user-profile-avatar-icon">person</span>
                </div>
                <div class="user-profile-name" id="userProfileName">กำลังดึงข้อมูล...</div>
                <div class="user-profile-district" id="userProfileDistrict"></div>
            `;
            userIcon.appendChild(dropdown);
        }

        function updateProfileView(voter) {
            const nameEl = dropdown.querySelector('#userProfileName');
            const distEl = dropdown.querySelector('#userProfileDistrict');

            if (voter) {
                const name = voter.full_name_th || voter.full_name || voter.name || voter.fullName || 'ผู้มีสิทธิเลือกตั้ง';
                if (nameEl) nameEl.textContent = name;
                if (distEl) distEl.textContent = voter.district_info || voter.districtInfo || voter.district || '';
            } else {
                if (nameEl) nameEl.textContent = 'กำลังดึงข้อมูล...';
                if (distEl) distEl.textContent = '';
            }
        }

        // แสดงข้อมูลเบื้องต้น
        updateProfileView(getVoter());

        // ฟังก์ชัน Toggle การแสดงผล
        function toggleDropdown(event) {
            if (event) {
                event.stopPropagation();
            }
            const willOpen = !dropdown.classList.contains('is-open');
            dropdown.classList.toggle('is-open', willOpen);
            userIcon.setAttribute('aria-expanded', String(willOpen));

            if (willOpen) {
                const current = getVoter();
                const hasName = current && (current.full_name_th || current.full_name || current.name || current.fullName);
                if (hasName) {
                    updateProfileView(current);
                } else {
                    // Recover from stale/incomplete localStorage records by
                    // claiming a complete voter record from Supabase.
                    if (current) localStorage.removeItem(STORAGE_KEY);
                    getOrClaimVoter().then(updateProfileView);
                }
            }
        }

        userIcon.addEventListener('click', toggleDropdown);

        userIcon.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleDropdown(event);
            }
        });

        // ป้องกันคลิกข้างในการ์ดแล้วปิด
        dropdown.addEventListener('click', (event) => {
            event.stopPropagation();
        });

        // คลิกนอกพื้นที่ ให้ปิดการ์ด
        document.addEventListener('click', (event) => {
            if (!userIcon.contains(event.target)) {
                dropdown.classList.remove('is-open');
                userIcon.setAttribute('aria-expanded', 'false');
            }
        });

        // กด Escape ให้ปิดการ์ด
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && dropdown.classList.contains('is-open')) {
                dropdown.classList.remove('is-open');
                userIcon.setAttribute('aria-expanded', 'false');
            }
        });

        // อัปเดตข้อมูลเมื่อมีการ Claim สิทธิ์สำเร็จ
        window.addEventListener('voter-claimed', (e) => {
            updateProfileView(e.detail);
        });
    }

    // Export API
    window.VoterIdentity = {
        getVoter,
        getOrClaimVoter,
        isEligibleFor,
        nextVoter,
        resetVoter: nextVoter,
        resetAllVoters,
        initProfileDropdown
    };
    window.getVoter = getVoter;
    window.getOrClaimVoter = getOrClaimVoter;
    window.isEligibleFor = isEligibleFor;
    window.nextVoter = nextVoter;
    window.resetVoter = nextVoter;
    window.resetAllVoters = resetAllVoters;

    // Boot อัตโนมัติเมื่อเอกสารพร้อม
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initProfileDropdown();
            getOrClaimVoter();
        });
    } else {
        initProfileDropdown();
        getOrClaimVoter();
    }

})(typeof window !== 'undefined' ? window : this);
