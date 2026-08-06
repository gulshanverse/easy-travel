-- 1. Unified record store
CREATE TABLE IF NOT EXISTS public.persistence_records (
  collection  text NOT NULL,
  id          text NOT NULL,
  owner_id    uuid NULL,
  version     integer NOT NULL DEFAULT 1,
  data        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz NULL,
  created_by  uuid NULL,
  updated_by  uuid NULL,
  PRIMARY KEY (collection, id)
);
CREATE INDEX IF NOT EXISTS persistence_records_owner_idx ON public.persistence_records (collection, owner_id);
CREATE INDEX IF NOT EXISTS persistence_records_live_idx ON public.persistence_records (collection, deleted_at);
CREATE INDEX IF NOT EXISTS persistence_records_data_idx ON public.persistence_records USING gin (data);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.persistence_records TO authenticated;
GRANT ALL ON public.persistence_records TO service_role;
ALTER TABLE public.persistence_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own records" ON public.persistence_records
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- 2. Migration ledger
CREATE TABLE IF NOT EXISTS public.persistence_migrations (
  version    integer PRIMARY KEY,
  id         text NOT NULL,
  checksum   text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.persistence_migrations TO service_role;
ALTER TABLE public.persistence_migrations ENABLE ROW LEVEL SECURITY;

-- 3. Object metadata index
CREATE TABLE IF NOT EXISTS public.persistence_objects (
  key          text PRIMARY KEY,
  bucket       text NOT NULL,
  size_bytes   bigint NOT NULL,
  content_type text NOT NULL,
  etag         text NOT NULL,
  owner_id     uuid NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS persistence_objects_owner_idx ON public.persistence_objects (owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.persistence_objects TO authenticated;
GRANT ALL ON public.persistence_objects TO service_role;
ALTER TABLE public.persistence_objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own objects" ON public.persistence_objects
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- 4. Append-only event store
CREATE TABLE IF NOT EXISTS public.persistence_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream      text NOT NULL,
  sequence    bigint NOT NULL,
  event_type  text NOT NULL,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  owner_id    uuid NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stream, sequence)
);
CREATE INDEX IF NOT EXISTS persistence_events_stream_idx ON public.persistence_events (stream, sequence);
GRANT SELECT, INSERT ON public.persistence_events TO authenticated;
GRANT ALL ON public.persistence_events TO service_role;
ALTER TABLE public.persistence_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own events" ON public.persistence_events
  FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Users append their own events" ON public.persistence_events
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

-- 5. Append-only audit trail
CREATE TABLE IF NOT EXISTS public.persistence_audit (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid NULL,
  owner_id    uuid NULL,
  action      text NOT NULL,
  collection  text NOT NULL,
  record_id   text NOT NULL,
  before      jsonb NULL,
  after       jsonb NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS persistence_audit_record_idx ON public.persistence_audit (collection, record_id);
GRANT SELECT, INSERT ON public.persistence_audit TO authenticated;
GRANT ALL ON public.persistence_audit TO service_role;
ALTER TABLE public.persistence_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own audit entries" ON public.persistence_audit
  FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Users write their own audit entries" ON public.persistence_audit
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

-- 6. Transactional outbox (backend only)
CREATE TABLE IF NOT EXISTS public.persistence_outbox (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic        text NOT NULL,
  payload      jsonb NOT NULL DEFAULT '{}'::jsonb,
  status       text NOT NULL DEFAULT 'pending',
  attempts     integer NOT NULL DEFAULT 0,
  last_error   text NULL,
  available_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS persistence_outbox_pending_idx ON public.persistence_outbox (status, available_at);
GRANT ALL ON public.persistence_outbox TO service_role;
ALTER TABLE public.persistence_outbox ENABLE ROW LEVEL SECURITY;

-- updated_at triggers
CREATE TRIGGER persistence_records_set_updated_at BEFORE UPDATE ON public.persistence_records
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER persistence_objects_set_updated_at BEFORE UPDATE ON public.persistence_objects
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER persistence_outbox_set_updated_at BEFORE UPDATE ON public.persistence_outbox
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();