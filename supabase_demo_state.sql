-- Shared demo state: one election time switch for every browser/device.
CREATE TABLE IF NOT EXISTS public.demo_election_state (
    event_type text PRIMARY KEY,
    election_time text NOT NULL DEFAULT 'open' CHECK (election_time IN ('open', 'closed')),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.demo_election_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS demo_election_state_public_read ON public.demo_election_state;
CREATE POLICY demo_election_state_public_read
    ON public.demo_election_state FOR SELECT
    USING (true);

DROP POLICY IF EXISTS demo_election_state_public_write ON public.demo_election_state;
CREATE POLICY demo_election_state_public_write
    ON public.demo_election_state FOR ALL
    USING (true)
    WITH CHECK (true);

INSERT INTO public.demo_election_state (event_type, election_time)
VALUES ('house-election-2569', 'open'), ('referendum-2569-03', 'open')
ON CONFLICT (event_type) DO NOTHING;

ALTER TABLE public.demo_election_state REPLICA IDENTITY FULL;

-- Enable realtime updates so already-open pages receive the switch immediately.
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.demo_election_state;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Reset all shared demo data through one server-side operation. This avoids
-- browser-side RLS failures when the Debug Panel is used with the anon key.
CREATE OR REPLACE FUNCTION public.demo_reset_state()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Keep an explicit predicate for Supabase/Postgres safety checks.
    DELETE FROM public.mp_final_box WHERE id IS NOT NULL;
    DELETE FROM public.referendum_final_box WHERE id IS NOT NULL;

    UPDATE public.mp_staging_box
       SET status = 'RESET', encrypted_ballot = NULL;
    UPDATE public.referendum_staging_box
       SET status = 'RESET', encrypted_ballot = NULL;

    UPDATE public.mock_citizens
       SET is_claimed = FALSE, claimed_at = NULL
     WHERE is_claimed = TRUE;

    DELETE FROM public.unlock_approvals
     WHERE event_type IN ('house-election-2569', 'referendum-2569-03');
    UPDATE public.key_ceremony_status
       SET approved = FALSE, status = 0
     WHERE event_type IN ('house-election-2569', 'referendum-2569-03');

    INSERT INTO public.demo_election_state (event_type, election_time, updated_at)
    VALUES
      ('house-election-2569', 'open', NOW()),
      ('referendum-2569-03', 'open', NOW())
    ON CONFLICT (event_type) DO UPDATE
      SET election_time = EXCLUDED.election_time,
          updated_at = EXCLUDED.updated_at;

    RETURN jsonb_build_object('success', TRUE, 'reset_at', NOW());
END;
$$;

GRANT EXECUTE ON FUNCTION public.demo_reset_state() TO anon, authenticated;
