-- Transaction passcode security hardening. Apply once.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS passcode_failed_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS passcode_locked_until DATETIME NULL,
  ADD COLUMN IF NOT EXISTS passcode_verified_at DATETIME NULL;

CREATE TABLE IF NOT EXISTS security_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  success TINYINT(1) NOT NULL DEFAULT 0,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(500) NULL,
  metadata JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_security_events_user_time (user_id, created_at),
  INDEX idx_security_events_type_time (event_type, created_at)
) ENGINE=InnoDB;
