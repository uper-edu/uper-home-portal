-- Internal IDs and all foreign keys remain unchanged. Business numbers are immutable.
LOCK TABLE portal_leads IN ACCESS EXCLUSIVE MODE;
ALTER TABLE portal_leads ADD COLUMN IF NOT EXISTS business_number text;
CREATE UNIQUE INDEX IF NOT EXISTS portal_leads_business_number ON portal_leads(business_number);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lead_daily_counters' AND column_name='jakarta_date') THEN
    ALTER TABLE lead_daily_counters RENAME COLUMN jakarta_date TO business_date;
  END IF;
END; $$;
CREATE TABLE IF NOT EXISTS lead_daily_counters (
  business_date text PRIMARY KEY CHECK (business_date ~ '^[0-9]{8}$'),
  last_value bigint NOT NULL CHECK (last_value > 0)
);

CREATE OR REPLACE FUNCTION portal_lead_submission_time(p jsonb, fallback_time timestamptz)
RETURNS timestamptz LANGUAGE plpgsql STABLE AS $$
BEGIN
  -- Only zoned ISO timestamps: parsing must not depend on the database timezone.
  IF p->>'submittedAt' ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$' THEN
    BEGIN
      RETURN (p->>'submittedAt')::timestamptz;
    EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
      RETURN fallback_time;
    END;
  END IF;
  RETURN fallback_time;
END;
$$;

CREATE OR REPLACE FUNCTION portal_lead_number_timezone()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    nullif((SELECT value->>'timezone' FROM portal_settings WHERE id='sla'),''),
    nullif((SELECT value#>>'{businessHours,timezone}' FROM portal_settings WHERE id='crm_policy'),''),
    '__DEFAULT_OPERATING_TIMEZONE__'
  );
$$;

CREATE OR REPLACE FUNCTION portal_next_lead_number(stamp timestamptz)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  day_key text := to_char(stamp AT TIME ZONE portal_lead_number_timezone(), 'YYYYMMDD');
  sequence_value bigint;
BEGIN
  INSERT INTO lead_daily_counters(business_date,last_value) VALUES(day_key,1)
  ON CONFLICT(business_date) DO UPDATE SET last_value=lead_daily_counters.last_value+1
  RETURNING last_value INTO sequence_value;
  RETURN day_key || '-' || lpad(sequence_value::text, greatest(3,length(sequence_value::text)), '0');
END;
$$;

-- Seed from already assigned numbers before filling missing ones (also on restart).
INSERT INTO lead_daily_counters(business_date,last_value)
SELECT split_part(business_number,'-',1),max(split_part(business_number,'-',2)::bigint)
FROM portal_leads WHERE business_number IS NOT NULL GROUP BY 1
ON CONFLICT(business_date) DO UPDATE SET last_value=greatest(lead_daily_counters.last_value,excluded.last_value);

DO $$
DECLARE lead_row record;
BEGIN
  FOR lead_row IN
    SELECT id,portal_lead_submission_time(profile,created_at) AS submitted
    FROM portal_leads WHERE business_number IS NULL
    ORDER BY portal_lead_submission_time(profile,created_at),created_at,id
  LOOP
    UPDATE portal_leads SET business_number=portal_next_lead_number(lead_row.submitted)
    WHERE id=lead_row.id;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION portal_assign_lead_number()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE existing_number text;
BEGIN
  IF TG_OP='UPDATE' AND OLD.business_number IS NOT NULL THEN
    -- Profile updates cannot change either identity or the business number.
    IF NEW.id IS DISTINCT FROM OLD.id THEN RAISE EXCEPTION 'Lead internal ID is immutable'; END IF;
    NEW.business_number := OLD.business_number;
  ELSIF TG_OP='INSERT' THEN
    -- ON CONFLICT retries must reuse the old number without consuming a counter.
    SELECT business_number INTO existing_number FROM portal_leads WHERE id=NEW.id;
    NEW.business_number := coalesce(existing_number,NEW.business_number);
  END IF;
  IF NEW.business_number IS NULL THEN
    NEW.business_number := portal_next_lead_number(portal_lead_submission_time(NEW.profile,NEW.created_at));
  ELSIF TG_OP='INSERT' THEN
    -- Explicit column values are used only by trusted backup restores, not contact input.
    IF NEW.business_number !~ '^[0-9]{8}-([0-9]{3}|[1-9][0-9]{3,})$' OR split_part(NEW.business_number,'-',2)::bigint < 1 THEN
      RAISE EXCEPTION 'Invalid lead business number';
    END IF;
    INSERT INTO lead_daily_counters(business_date,last_value)
    VALUES(split_part(NEW.business_number,'-',1),split_part(NEW.business_number,'-',2)::bigint)
    ON CONFLICT(business_date) DO UPDATE SET last_value=greatest(lead_daily_counters.last_value,excluded.last_value);
  END IF;
  NEW.profile := NEW.profile || jsonb_build_object('businessNumber',NEW.business_number);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS portal_lead_number ON portal_leads;
CREATE TRIGGER portal_lead_number BEFORE INSERT OR UPDATE ON portal_leads
FOR EACH ROW EXECUTE FUNCTION portal_assign_lead_number();
UPDATE portal_leads SET profile=profile || jsonb_build_object('businessNumber',business_number)
WHERE profile->>'businessNumber' IS DISTINCT FROM business_number;
ALTER TABLE portal_leads ALTER COLUMN business_number SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='portal_leads_number_format' AND conrelid='portal_leads'::regclass) THEN
    ALTER TABLE portal_leads ADD CONSTRAINT portal_leads_number_format
    CHECK(business_number ~ '^[0-9]{8}-([0-9]{3}|[1-9][0-9]{3,})$' AND split_part(business_number,'-',2)::bigint > 0);
  END IF;
END; $$;
