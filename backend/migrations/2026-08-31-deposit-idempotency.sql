ALTER TABLE deposits ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128) NULL;
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS request_hash CHAR(64) NULL;
SET @idx1 := (SELECT COUNT(1) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='deposits' AND index_name='uq_deposits_user_idempotency');
SET @sql1 := IF(@idx1=0,'CREATE UNIQUE INDEX uq_deposits_user_idempotency ON deposits(user_id,idempotency_key)','SELECT 1');
PREPARE s1 FROM @sql1; EXECUTE s1; DEALLOCATE PREPARE s1;
CREATE INDEX idx_deposits_request_hash ON deposits(user_id,request_hash);
