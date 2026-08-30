ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128) NULL;

-- MySQL-safe unique index creation (the deployment migration runner should execute
-- this only once after the column is added).
SET @idx_exists := (SELECT COUNT(1) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'withdrawals' AND index_name = 'uq_withdrawals_user_idempotency');
SET @idx_sql := IF(@idx_exists = 0, 'CREATE UNIQUE INDEX uq_withdrawals_user_idempotency ON withdrawals(user_id,idempotency_key)', 'SELECT 1');
PREPARE stmt FROM @idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
