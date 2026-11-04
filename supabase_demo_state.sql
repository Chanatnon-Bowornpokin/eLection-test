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
