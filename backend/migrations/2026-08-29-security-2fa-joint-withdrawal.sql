-- VexaTrade security foundation: TOTP 2FA + joint-withdrawal authorization.
-- Run once against the VexaTrade database before enabling these features.
-- Secrets should be encrypted at the application layer before storage.

CREATE TABLE IF NOT EXISTS user_two_factor (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  secret_encrypted TEXT NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 0,
  verified_at DATETIME NULL,
  last_used_step BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_two_factor_user (user_id),
  KEY idx_user_two_factor_enabled (user_id, enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS two_factor_recovery_codes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_2fa_recovery_user (user_id, used_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS joint_withdrawal_authorizations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  withdrawal_id BIGINT UNSIGNED NOT NULL,
  requesting_user_id BIGINT UNSIGNED NOT NULL,
  required_user_id BIGINT UNSIGNED NOT NULL,
  otp_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  verified_at DATETIME NULL,
  consumed_at DATETIME NULL,
  attempts INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_joint_withdrawal (withdrawal_id),
  KEY idx_joint_auth_required_user (required_user_id, verified_at),
  KEY idx_joint_auth_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- These columns are intentionally additive. Existing withdrawal records remain compatible.
ALTER TABLE withdrawals ADD COLUMN joint_authorization_id BIGINT UNSIGNED NULL;
ALTER TABLE withdrawals ADD COLUMN authorization_status VARCHAR(32) NOT NULL DEFAULT 'not_required';
ALTER TABLE withdrawals ADD COLUMN two_factor_verified_at DATETIME NULL;
