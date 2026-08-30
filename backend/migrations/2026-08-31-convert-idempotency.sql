ALTER TABLE convert_transactions ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128) NULL;
ALTER TABLE convert_transactions ADD COLUMN IF NOT EXISTS request_hash CHAR(64) NULL;
SET @idx := (SELECT COUNT(1) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='convert_transactions' AND index_name='uq_convert_user_idempotency');
SET @sql := IF(@idx=0,'CREATE UNIQUE INDEX uq_convert_user_idempotency ON convert_transactions(user_id,idempotency_key)','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
CREATE INDEX idx_convert_request_hash ON convert_transactions(user_id,request_hash);
