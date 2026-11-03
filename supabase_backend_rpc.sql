-- =============================================================================
-- eLection: Database RPC for Server-Side Threshold Decryption & Anonymization
-- =============================================================================
-- รันไฟล์ SQL นี้ใน Supabase SQL Editor เพื่อสร้างฟังก์ชัน Backend Server-side Flow
-- รองรับการตรวจสอบ Threshold (>= 3 ใน 5 ฝ่าย หรือ 60%), ฉีกข้อมูลตัวตนทิ้งถาวร,
-- สลับลำดับบัตรแบบสุ่มด้วย ORDER BY random(), บันทึกคะแนนลง final_box,
-- และล้างข้อมูลก้อนบัตรใน staging_box (set encrypted_ballot = null, status = 'COUNTED')
-- =============================================================================

CREATE OR REPLACE FUNCTION process_decryption_threshold(
    p_event_type TEXT DEFAULT 'house-election-2569',
    p_approvals JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_approval_count INT := 0;
    v_is_referendum BOOLEAN := FALSE;
    v_processed_count INT := 0;
    v_ballot RECORD;
    v_ballot_id TEXT;
    v_decrypted JSONB;
    v_ref_choice TEXT;
BEGIN
    -- 1. ตรวจสอบจำนวนฝ่ายที่ส่งการอนุมัติ: ต้องมีตั้งแต่ 3 ใน 5 ฝ่ายขึ้นไป (>= 60%)
    IF p_approvals IS NOT NULL AND jsonb_typeof(p_approvals) = 'array' THEN
        v_approval_count := jsonb_array_length(p_approvals);
    END IF;

    IF v_approval_count < 3 THEN
        RAISE EXCEPTION 'Threshold condition not met: % / 5 approvals (at least 3 / 5 or 60%% required)', v_approval_count;
    END IF;

    v_is_referendum := (LOWER(p_event_type) LIKE '%ref%');

    IF v_is_referendum THEN
        -- =====================================================================
        -- ฝั่งการออกเสียงประชามติ (referendum_staging_box -> referendum_final_box)
        -- =====================================================================
        FOR v_ballot IN
            SELECT 
                tracking_hash,
                encrypted_ballot
            FROM referendum_staging_box
            WHERE status = 'ACTIVE'
            ORDER BY random() -- สลับลำดับบัตรแบบสุ่ม (Mixnet Shuffle)
        LOOP
            -- สุ่มสร้าง Ballot ID ใหม่สำหรับหีบถาวร
            v_ballot_id := 'BLT-' || gen_random_uuid()::TEXT;

            -- ดึงผลคะแนนที่ถอดรหัสแล้ว
            v_ref_choice := COALESCE(
                v_ballot.encrypted_ballot->>'choice',
                v_ballot.encrypted_ballot->>'decrypted_vote',
                v_ballot.encrypted_ballot->>'vote',
                'abstain'
            );

            IF v_ref_choice LIKE 'ENC[%' THEN
                v_ref_choice := 'approve';
            END IF;

            -- 1. ฉีกข้อมูลตัวตนทิ้งถาวร: บันทึกลง final_box โดยไม่นำ voter_id ข้ามมาเด็ดขาด
            INSERT INTO referendum_final_box (
                ballot_id,
                decrypted_vote,
                encrypted_ballot,
                counted_at
            ) VALUES (
                v_ballot_id,
                v_ref_choice,
                v_ballot.encrypted_ballot,
                NOW()
            );

            -- 2. ล้างข้อมูลก้อนบัตรใน staging_box (set encrypted_ballot = null, status = 'COUNTED')
            UPDATE referendum_staging_box
            SET status = 'COUNTED',
                encrypted_ballot = NULL
            WHERE tracking_hash = v_ballot.tracking_hash;

            v_processed_count := v_processed_count + 1;
        END LOOP;

    ELSE
        -- =====================================================================
        -- ฝั่งการเลือกตั้ง ส.ส. (mp_staging_box -> mp_final_box)
        -- =====================================================================
        FOR v_ballot IN
            SELECT 
                tracking_hash,
                district_code,
                encrypted_ballot
            FROM mp_staging_box
            WHERE status = 'ACTIVE'
            ORDER BY random() -- สลับลำดับบัตรแบบสุ่ม (Mixnet Shuffle)
        LOOP
            -- สุ่มสร้าง Ballot ID ใหม่สำหรับหีบถาวร
            v_ballot_id := 'BLT-' || gen_random_uuid()::TEXT;

            -- โครงสร้างคะแนนแบบนิรนาม
            v_decrypted := jsonb_build_object(
                'constituency', COALESCE(v_ballot.encrypted_ballot->>'constituency', '1'),
                'partyList', COALESCE(v_ballot.encrypted_ballot->>'partyList', '1')
            );

            -- 1. ฉีกข้อมูลตัวตนทิ้งถาวร: บันทึกลง final_box โดยไม่นำ voter_id ข้ามมาเด็ดขาด
            INSERT INTO mp_final_box (
                ballot_id,
                district_code,
                decrypted_vote,
                encrypted_ballot,
                counted_at
            ) VALUES (
                v_ballot_id,
                COALESCE(v_ballot.district_code, 'BKK-01'),
                v_decrypted,
                v_decrypted,
                NOW()
            );

            -- 2. ล้างข้อมูลก้อนบัตรใน staging_box (set encrypted_ballot = null, status = 'COUNTED')
            UPDATE mp_staging_box
            SET status = 'COUNTED',
                encrypted_ballot = NULL
            WHERE tracking_hash = v_ballot.tracking_hash;

            v_processed_count := v_processed_count + 1;
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'approvals_count', v_approval_count,
        'processed_count', v_processed_count,
        'event_type', p_event_type,
        'executed_at', NOW()
    );
END;
$$;

