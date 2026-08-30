ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128) NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_withdrawals_user_idempotency ON withdrawals(user_id,idempotency_key);
