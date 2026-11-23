-- Midnight crossing K4 delay: original medication occurrence date must be retained.
-- Tested on isolated Neon branch; applied to production 2026-11-24.
CREATE OR REPLACE FUNCTION public.complete_medication_from_device(p_sync_group_id uuid, p_medication_id text)
 RETURNS TABLE(applied boolean, completed_date text, new_version bigint)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_day date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_time text;
  v_days jsonb;
  v_completed jsonb;
  v_version bigint;
  v_scheduled timestamptz;
  v_weekday text;
  v_previous_delay_date date;
BEGIN
  -- Serialize modifications within the sync group using its version row.
  SELECT last_version INTO v_version
  FROM medication_group_sync_versions
  WHERE sync_group_id = p_sync_group_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SYNC_GROUP_NOT_FOUND';
  END IF;

  SELECT s.time, s.days, s.completed_dates
    INTO v_time, v_days, v_completed
  FROM medication_group_schedules s
  WHERE s.sync_group_id = p_sync_group_id AND s.medication_id = p_medication_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEDICATION_NOT_FOUND';
  END IF;

  -- Attribute a just-delayed previous-day dose to its original occurrence.
  SELECT d.scheduled_date INTO v_previous_delay_date
  FROM medication_delays d
  WHERE d.sync_group_id = p_sync_group_id
    AND d.medication_id = p_medication_id
    AND d.scheduled_date = v_day - 1
    AND d.delayed_until BETWEEN now() - INTERVAL '5 minutes'
                            AND now() + INTERVAL '5 minutes'
    AND (v_days ? (ARRAY['월','화','수','목','금','토','일'])[EXTRACT(ISODOW FROM d.scheduled_date)::integer])
  ORDER BY d.delayed_until DESC
  LIMIT 1;
  IF v_previous_delay_date IS NOT NULL THEN
    v_day := v_previous_delay_date;
  END IF;

  v_weekday := (ARRAY['월','화','수','목','금','토','일'])[EXTRACT(ISODOW FROM v_day)::integer];
  IF NOT (v_days ? v_weekday) THEN
    RAISE EXCEPTION 'NOT_SCHEDULED_TODAY';
  END IF;

  IF COALESCE(v_completed, '[]'::jsonb) ? v_day::text THEN
    RETURN QUERY SELECT false, v_day::text, v_version;
    RETURN;
  END IF;

  v_scheduled := ((v_day::text || ' ' || v_time)::timestamp AT TIME ZONE 'Asia/Seoul');

  INSERT INTO medication_history (
    sync_group_id, medication_id, scheduled_at, taken_at, status, source
  ) VALUES (
    p_sync_group_id, p_medication_id, v_scheduled, now(), 'completed', 'pillbox'
  )
  ON CONFLICT (sync_group_id, medication_id, scheduled_at)
  DO UPDATE SET
    status = 'completed',
    taken_at = COALESCE(medication_history.taken_at, now()),
    source = 'pillbox',
    updated_at = now();

  UPDATE medication_group_schedules
  SET completed_dates = COALESCE(completed_dates, '[]'::jsonb) || to_jsonb(v_day::text),
      updated_at = now()
  WHERE sync_group_id = p_sync_group_id AND medication_id = p_medication_id;

  UPDATE medication_group_sync_versions
  SET last_version = last_version + 1, updated_at = now()
  WHERE sync_group_id = p_sync_group_id
  RETURNING last_version INTO v_version;

  RETURN QUERY SELECT true, v_day::text, v_version;
END;
$function$

