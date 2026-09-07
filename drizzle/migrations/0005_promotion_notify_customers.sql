ALTER TABLE promotions ADD COLUMN notify_customers integer NOT NULL DEFAULT 0;
ALTER TABLE promotions ADD COLUMN notification_sent_at integer;

CREATE INDEX promotions_notify_pending_idx
ON promotions (business_id, active, notify_customers, notification_sent_at, start_at, end_at);
