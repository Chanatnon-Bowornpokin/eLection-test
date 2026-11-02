document.addEventListener('DOMContentLoaded', () => {
    // -------------------------------------------------------------------------
    // 1. Elements
    // -------------------------------------------------------------------------
    const tabStateWaiting = document.getElementById('tabStateWaiting');
    const tabStateCounting = document.getElementById('tabStateCounting');

    const viewWaitingState = document.getElementById('viewWaitingState');
    const viewCountingState = document.getElementById('viewCountingState');

    const heroElectionTitle = document.getElementById('heroElectionTitle');
    const pageElectionHeading = document.getElementById('pageElectionHeading');

    // KPI Elements
    const kpiLabel1 = document.getElementById('kpiLabel1');
    const kpiLabel2 = document.getElementById('kpiLabel2');
    const kpiLabel3 = document.getElementById('kpiLabel3');
    const kpiContent3 = document.getElementById('kpiContent3');
    const kpiStatusBox = document.getElementById('kpiStatusBox');
    const kpiStatusIndicator = document.getElementById('kpiStatusIndicator');
    const kpiStatusText = document.getElementById('kpiStatusText');

    // Counting Sub-Tabs
    const tabPartylist = document.getElementById('tabPartylist');
    const tabConstituency = document.getElementById('tabConstituency');
    const contentPartylist = document.getElementById('contentPartylist');
    const contentConstituency = document.getElementById('contentConstituency');

    // Ballot Verification
    const ballotCodeInput = document.getElementById('ballotCodeInput');
    const btnVerifyBallot = document.getElementById('btnVerifyBallot');
    const resBallotHash = document.getElementById('resBallotHash');
    const resBallotStatus = document.getElementById('resBallotStatus');
    const verifyResultBox = document.getElementById('verifyResultBox');

    // Ceremony button
    const btnWatchCeremony = document.getElementById('btnWatchCeremony');

    // -------------------------------------------------------------------------
    // 2. State & Data Handling
    // -------------------------------------------------------------------------
    const urlParams = new URLSearchParams(window.location.search);
    const electionParam = urlParams.get('election') || 'general';
    let currentStatus = urlParams.get('status') || 'counting'; // 'waiting' or 'counting'
    let currentTab = urlParams.get('tab') || 'partylist'; // 'partylist' or 'constituency'

    // Update Titles based on election type
    if (electionParam === 'referendum') {
        const titleText = 'การออกเสียงประชามติ ครั้งที่ 3 ปี 2569';
        if (heroElectionTitle) heroElectionTitle.textContent = titleText;
        if (pageElectionHeading) pageElectionHeading.textContent = titleText;
        document.title = 'ติดตามสถานะ - ' + titleText;
    } else {
        const titleText = 'การเลือกตั้งสมาชิกสภาผู้แทนราษฎร (ส.ส.) ครั้งที่ 28';
        if (heroElectionTitle) heroElectionTitle.textContent = titleText;
        if (pageElectionHeading) pageElectionHeading.textContent = titleText;
        document.title = 'ติดตามสถานะ - ' + titleText;
    }

    // Switch between Waiting & Counting States
    function applyState(state) {
        currentStatus = state;

        if (state === 'waiting') {
            // Update quick switcher tabs
            if (tabStateWaiting) tabStateWaiting.classList.add('active');
            if (tabStateCounting) tabStateCounting.classList.remove('active');

            // Show Waiting view, hide Counting view
            if (viewWaitingState) viewWaitingState.style.display = 'block';
            if (viewCountingState) viewCountingState.style.display = 'none';

            // Update KPI 1
            if (kpiLabel1) kpiLabel1.textContent = 'จำนวนผู้มีสิทธิ และ ผู้ใช้สิทธิแล้ว';

            // Update KPI 2
            if (kpiLabel2) kpiLabel2.textContent = 'บัตรในระบบขณะนี้';

            // Update KPI 3 (Time remaining)
            if (kpiLabel3) kpiLabel3.textContent = 'เวลาที่เหลือในการลงคะแนน';
            if (kpiContent3) {
                kpiContent3.innerHTML = `
                    <p class="kpi-value-row bold" style="font-size: 18px; color: #111;">03 ชม. 45 นาที</p>
                    <p class="kpi-value-row" style="color: #666; font-size: 13px;">ปิดหีบ : 17:00 น.</p>
                `;
            }

            // Update KPI 4 (Status)
            if (kpiStatusIndicator) {
                kpiStatusIndicator.className = 'kpi-status-indicator status-waiting';
                kpiStatusIndicator.innerHTML = `
                    <span class="status-dot"></span>
                    <span class="status-text bold">รอนับคะแนนหลังปิดหีบ</span>
                `;
            }

            // Update Ballot verification card status line (EXACT from user image!)
            if (resBallotStatus) {
                resBallotStatus.textContent = 'รอนับคะแนนหลังปิดหีบ';
            }

        } else {
            // state === 'counting'
            if (tabStateWaiting) tabStateWaiting.classList.remove('active');
            if (tabStateCounting) tabStateCounting.classList.add('active');

            if (viewWaitingState) viewWaitingState.style.display = 'none';
            if (viewCountingState) viewCountingState.style.display = 'block';

            // Update KPI 1
            if (kpiLabel1) kpiLabel1.textContent = 'ผู้มาใช้สิทธิสุทธิ';

            // Update KPI 2
            if (kpiLabel2) kpiLabel2.textContent = 'นับคะแนนแล้ว';

            // Update KPI 3 (Ballots in system)
            if (kpiLabel3) kpiLabel3.textContent = 'บัตรในระบบสุทธิ';
            if (kpiContent3) {
                kpiContent3.innerHTML = `
                    <p class="kpi-value-row"><span class="kpi-bold-text">ส.ส. เขต :</span> 34,120,450 ใบ</p>
                    <p class="kpi-value-row"><span class="kpi-bold-text">บัญชีรายชื่อ :</span> 34,120,450 ใบ</p>
                `;
            }

            // Update KPI 4 (Status Live)
            if (kpiStatusIndicator) {
                kpiStatusIndicator.className = 'kpi-status-indicator status-live';
                kpiStatusIndicator.innerHTML = `
                    <span class="status-dot pulsing"></span>
                    <span class="status-text bold">กำลังนับคะแนน</span>
                `;
            }

            // Update Ballot verification card status line
            if (resBallotStatus) {
                resBallotStatus.textContent = 'ประมวลผลแล้ว';
            }
        }
    }

    // Switch between Sub-Tabs in Counting View (Party List vs Constituency)
    function applySubTab(tab) {
        currentTab = tab;
        if (tab === 'constituency') {
            if (tabConstituency) tabConstituency.classList.add('active');
            if (tabPartylist) tabPartylist.classList.remove('active');

            if (contentConstituency) contentConstituency.style.display = 'block';
            if (contentPartylist) contentPartylist.style.display = 'none';
        } else {
            if (tabPartylist) tabPartylist.classList.add('active');
            if (tabConstituency) tabConstituency.classList.remove('active');

            if (contentPartylist) contentPartylist.style.display = 'block';
            if (contentConstituency) contentConstituency.style.display = 'none';
        }
    }

    // -------------------------------------------------------------------------
    // 3. Event Listeners
    // -------------------------------------------------------------------------
    if (tabStateWaiting) {
        tabStateWaiting.addEventListener('click', () => applyState('waiting'));
    }

    if (tabStateCounting) {
        tabStateCounting.addEventListener('click', () => applyState('counting'));
    }

    if (tabPartylist) {
        tabPartylist.addEventListener('click', () => applySubTab('partylist'));
    }

    if (tabConstituency) {
        tabConstituency.addEventListener('click', () => applySubTab('constituency'));
    }

    // Ballot Verification Button Click
    if (btnVerifyBallot && ballotCodeInput) {
        btnVerifyBallot.addEventListener('click', () => {
            const code = ballotCodeInput.value.trim();
            if (!code) {
                alert('กรุณากรอกรหัสตรวจสอบสถานะบัตร');
                ballotCodeInput.focus();
                return;
            }

            if (resBallotHash) {
                resBallotHash.textContent = code;
            }

            // Animate result box to indicate fresh verification
            if (verifyResultBox) {
                verifyResultBox.style.opacity = '0';
                verifyResultBox.style.transform = 'scale(0.98)';
                setTimeout(() => {
                    verifyResultBox.style.transition = 'all 0.3s ease';
                    verifyResultBox.style.opacity = '1';
                    verifyResultBox.style.transform = 'scale(1)';
                }, 50);
            }
        });

        // Allow pressing Enter in input
        ballotCodeInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                btnVerifyBallot.click();
            }
        });
    }

    // Ceremony CTA Button
    if (btnWatchCeremony) {
        btnWatchCeremony.addEventListener('click', () => {
            alert('ระบบถ่ายทอดสดพิธีส่งรหัสเปิดหีบบัตรดิจิทัล จะเปิดให้เข้าชมในเวลา 17:00 น.');
        });
    }

    // -------------------------------------------------------------------------
    // 4. Initial Execution
    // -------------------------------------------------------------------------
    applyState(currentStatus);
    applySubTab(currentTab);
});

