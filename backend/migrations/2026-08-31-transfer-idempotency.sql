ALTER TABLE transfers ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128) NULL;
SET @idx := (SELECT COUNT(1) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='transfers' AND index_name='uq_transfers_user_idempotency');
SET @sql := IF(@idx=0,'CREATE UNIQUE INDEX uq_transfers_user_idempotency ON transfers(sender_user_id,idempotency_key)','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
