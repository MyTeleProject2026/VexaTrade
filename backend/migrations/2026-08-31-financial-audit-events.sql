CREATE TABLE IF NOT EXISTS financial_audit_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NULL,
  actor_id BIGINT NULL,
  action VARCHAR(96) NOT NULL,
  coin VARCHAR(32) NULL,
  network VARCHAR(64) NULL,
  amount DECIMAL(36,18) NULL,
  reference_type VARCHAR(64) NULL,
  reference_id BIGINT NULL,
  request_hash CHAR(64) NULL,
  metadata JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_financial_audit_user_time (user_id,created_at),
  INDEX idx_financial_audit_reference (reference_type,reference_id),
  INDEX idx_financial_audit_action_time (action,created_at)
) ENGINE=InnoDB;
