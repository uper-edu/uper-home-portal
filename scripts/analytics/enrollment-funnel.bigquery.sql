-- Replace ANALYTICS_DATASET with the project and GA4 dataset, e.g. project.analytics_561827503.
-- Parameters: from/to DATE (inclusive WIB cohort dates), streamId STRING, environment STRING.
-- Pick from on or after the first full day with verified enrollment tracking.
WITH coverage AS (
  SELECT day
  FROM UNNEST(GENERATE_DATE_ARRAY(@from, @to)) AS day
  WHERE day < DATE_SUB(CURRENT_DATE('Asia/Jakarta'), INTERVAL 1 DAY)
    AND FORMAT_DATE('events_%Y%m%d', day) IN (
      SELECT table_name FROM `ANALYTICS_DATASET.INFORMATION_SCHEMA.TABLES`
    )
    AND FORMAT_DATE('events_%Y%m%d', DATE_ADD(day, INTERVAL 1 DAY)) IN (
      SELECT table_name FROM `ANALYTICS_DATASET.INFORMATION_SCHEMA.TABLES`
    )
),
events AS (
  SELECT
    user_pseudo_id,
    (SELECT ANY_VALUE(value.int_value) FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS session_id,
    event_name, event_timestamp, batch_page_id, batch_ordering_id, batch_event_index,
    DATE(TIMESTAMP_MICROS(event_timestamp), 'Asia/Jakarta') AS event_day,
    REGEXP_EXTRACT((SELECT ANY_VALUE(value.string_value) FROM UNNEST(event_params) WHERE key = 'page_location'),
      r'^https?://[^/]+(/[^?#]*)') AS page_path,
    COALESCE(
      IF(EXISTS(SELECT 1 FROM UNNEST(event_params) WHERE key = 'source_basis' AND value.string_value = 'verified_promotion'),
        (SELECT ANY_VALUE(value.string_value) FROM UNNEST(event_params) WHERE key = 'campaign_source'), NULL),
      session_traffic_source_last_click.cross_channel_campaign.source,
      session_traffic_source_last_click.manual_campaign.source,
      (SELECT ANY_VALUE(value.string_value) FROM UNNEST(event_params) WHERE key = 'campaign_source')) AS source,
    COALESCE(
      IF(EXISTS(SELECT 1 FROM UNNEST(event_params) WHERE key = 'source_basis' AND value.string_value = 'verified_promotion'),
        (SELECT ANY_VALUE(value.string_value) FROM UNNEST(event_params) WHERE key = 'campaign_medium'), NULL),
      session_traffic_source_last_click.cross_channel_campaign.medium,
      session_traffic_source_last_click.manual_campaign.medium,
      (SELECT ANY_VALUE(value.string_value) FROM UNNEST(event_params) WHERE key = 'campaign_medium')) AS medium,
    COALESCE((SELECT ANY_VALUE(value.string_value) FROM UNNEST(event_params) WHERE key = 'campaign_id'),
      session_traffic_source_last_click.cross_channel_campaign.campaign_id,
      session_traffic_source_last_click.manual_campaign.campaign_id) AS campaign_id,
    COALESCE((SELECT ANY_VALUE(value.string_value) FROM UNNEST(event_params) WHERE key = 'campaign_name'),
      session_traffic_source_last_click.cross_channel_campaign.campaign_name,
      session_traffic_source_last_click.manual_campaign.campaign_name) AS campaign
  FROM `ANALYTICS_DATASET.events_20*`
  WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%y%m%d', @from) AND FORMAT_DATE('%y%m%d', DATE_ADD(@to, INTERVAL 1 DAY))
    AND stream_id = @streamId
    AND event_name IN ('page_view', 'enrollment_class_view', 'enrollment_application_start', 'enrollment_seat_reserved', 'enrollment_proof_saved')
    AND EXISTS(SELECT 1 FROM UNNEST(event_params) WHERE key = 'environment' AND value.string_value =
      CASE @environment WHEN 'dev' THEN 'development' WHEN 'test' THEN 'test' WHEN 'prod' THEN 'production' END)
    AND EXISTS(SELECT 1 FROM UNNEST(event_params) WHERE key = 'workspace' AND value.string_value = 'public')
    AND EXISTS(SELECT 1 FROM UNNEST(event_params) WHERE key = 'traffic_category' AND value.string_value =
      IF(@environment = 'prod', 'customer', 'internal_test'))
    AND NOT EXISTS(SELECT 1 FROM UNNEST(event_params) WHERE key = 'validation_mode' AND value.string_value = 'simulated')
),
unmatched AS (
  SELECT event_day AS day, COUNT(*) AS views
  FROM events
  WHERE event_name = 'page_view' AND page_path IN ('/enrollment', '/enrollment/:class')
    AND (NULLIF(user_pseudo_id, '') IS NULL OR session_id IS NULL)
  GROUP BY day
),
ordered AS (
  SELECT
    *,
    DATE(TIMESTAMP_SECONDS(session_id), 'Asia/Jakarta') AS day,
    DENSE_RANK() OVER (PARTITION BY user_pseudo_id, session_id
      ORDER BY event_timestamp, batch_page_id, batch_ordering_id, batch_event_index) AS event_order
  FROM events
  WHERE NULLIF(user_pseudo_id, '') IS NOT NULL
    AND session_id BETWEEN UNIX_SECONDS(TIMESTAMP(@from, 'Asia/Jakarta'))
                       AND UNIX_SECONDS(TIMESTAMP(DATE_ADD(@to, INTERVAL 1 DAY), 'Asia/Jakarta')) - 1
    AND DIV(event_timestamp, 1000000) BETWEEN session_id AND session_id + 86399
),
first_pages AS (
  SELECT * FROM ordered
  WHERE event_name = 'page_view'
  QUALIFY ROW_NUMBER() OVER (PARTITION BY user_pseudo_id, session_id ORDER BY event_order,
    IF(page_path IN ('/enrollment', '/enrollment/:class'), 1, 0), page_path, source, medium, campaign_id, campaign) = 1
),
milestones AS (
  SELECT
    landing.day, landing.user_pseudo_id, landing.session_id,
    IF(REGEXP_CONTAINS(LOWER(landing.source), r'^(\(direct\)|\(not set\)|\(other\)|[a-z0-9][a-z0-9_.-]{0,79})$'),
      LOWER(landing.source), '(not set)') AS source,
    IF(REGEXP_CONTAINS(LOWER(landing.medium), r'^(\(none\)|\(not set\)|\(other\)|[a-z0-9][a-z0-9_.-]{0,79})$'),
      LOWER(landing.medium), '(not set)') AS medium,
    IF(REGEXP_CONTAINS(LOWER(landing.campaign_id), r'^[a-z0-9][a-z0-9_.-]{0,79}$'), LOWER(landing.campaign_id), '') AS campaignId,
    IF(REGEXP_CONTAINS(LOWER(landing.campaign), r'^[a-z0-9][a-z0-9_.-]{0,79}$'), LOWER(landing.campaign), '') AS campaign,
    MIN(IF(step.event_name = 'enrollment_class_view', step.event_order, NULL)) AS class_view,
    MIN(IF(step.event_name = 'enrollment_application_start', step.event_order, NULL)) AS started
  FROM first_pages AS landing
  JOIN coverage USING(day)
  LEFT JOIN ordered AS step ON step.user_pseudo_id = landing.user_pseudo_id AND step.session_id = landing.session_id
    AND step.event_order > landing.event_order
  WHERE landing.page_path IN ('/enrollment', '/enrollment/:class')
  GROUP BY 1, 2, 3, 4, 5, 6, 7
),
reservations AS (
  SELECT base.*,
    MIN(step.event_order) AS reserved
  FROM milestones AS base
  LEFT JOIN ordered AS step ON step.user_pseudo_id = base.user_pseudo_id AND step.session_id = base.session_id
    AND step.event_order > base.started AND step.event_name = 'enrollment_seat_reserved'
  GROUP BY base.day, base.user_pseudo_id, base.session_id, base.source, base.medium, base.campaignId, base.campaign,
    base.class_view, base.started
),
proofs AS (
  SELECT base.*,
    MIN(step.event_order) AS saved_proof
  FROM reservations AS base
  LEFT JOIN ordered AS step ON step.user_pseudo_id = base.user_pseudo_id AND step.session_id = base.session_id
    AND step.event_order > base.reserved AND step.event_name = 'enrollment_proof_saved'
  GROUP BY base.day, base.user_pseudo_id, base.session_id, base.source, base.medium, base.campaignId, base.campaign,
    base.class_view, base.started, base.reserved
),
daily AS (
  SELECT day, source, medium, campaignId, campaign,
    COUNT(*) AS landed, COUNTIF(class_view IS NOT NULL) AS viewedClass, COUNTIF(started IS NOT NULL) AS started,
    COUNTIF(reserved IS NOT NULL) AS reserved, COUNTIF(saved_proof IS NOT NULL) AS savedProof
  FROM proofs
  GROUP BY 1, 2, 3, 4, 5
),
daily_campaigns AS (
  SELECT day, ARRAY_AGG(STRUCT(source, medium, campaignId, campaign, landed, viewedClass, started, reserved, savedProof)
    ORDER BY landed DESC, source, medium, campaignId, campaign) AS campaigns
  FROM daily
  GROUP BY day
)
SELECT 1 AS version, @environment AS environment, @streamId AS streamId,
  FORMAT_DATE('%F', coverage.day) AS date, FORMAT_TIMESTAMP('%FT%H:%M:%E3SZ', CURRENT_TIMESTAMP(), 'UTC') AS fetchedAt,
  COALESCE(unmatched.views, 0) AS missingSessionViews,
  IFNULL(daily_campaigns.campaigns, []) AS campaigns
FROM coverage LEFT JOIN unmatched USING(day) LEFT JOIN daily_campaigns USING(day)
ORDER BY date;
