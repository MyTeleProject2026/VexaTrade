ALTER TABLE user_transfers ADD COLUMN IF NOT EXISTS request_hash CHAR(64) NULL;
SET @idx := (SELECT COUNT(1) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='user_transfers' AND index_name='idx_user_transfers_sender_request_hash');
SET @sql := IF(@idx=0,'CREATE INDEX idx_user_transfers_sender_request_hash ON user_transfers(sender_id,request_hash)','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
