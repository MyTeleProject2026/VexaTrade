-- Speed up the user-facing withdrawal history query:
-- WHERE user_id=? ORDER BY id DESC LIMIT 100
SET @idx_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'withdrawals'
    AND index_name = 'idx_withdrawals_user_id_id'
);
SET @idx_sql := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_withdrawals_user_id_id ON withdrawals(user_id,id)',
  'SELECT 1'
);
PREPARE stmt FROM @idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
