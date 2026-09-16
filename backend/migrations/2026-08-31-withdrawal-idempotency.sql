-- Withdrawal idempotency/security compatibility migration.
-- Safe to run repeatedly on MySQL/TiDB versions supporting ADD COLUMN IF NOT EXISTS.
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128) NULL;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS request_hash CHAR(64) NULL;

-- The unique idempotency index is intentionally scoped to the user.
SET @idx_exists := (SELECT COUNT(1) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'withdrawals' AND index_name = 'uq_withdrawals_user_idempotency');
SET @idx_sql := IF(@idx_exists = 0, 'CREATE UNIQUE INDEX uq_withdrawals_user_idempotency ON withdrawals(user_id,idempotency_key)', 'SELECT 1');
PREPARE stmt FROM @idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE INDEX IF NOT EXISTS idx_withdrawals_request_hash ON withdrawals(user_id,request_hash);
