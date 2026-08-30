ALTER TABLE user_transfers ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128) NULL;
SET @idx := (SELECT COUNT(1) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='user_transfers' AND index_name='uq_user_transfers_sender_idempotency');
SET @sql := IF(@idx=0,'CREATE UNIQUE INDEX uq_user_transfers_sender_idempotency ON user_transfers(sender_id,idempotency_key)','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
