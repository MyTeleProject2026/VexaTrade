CREATE TABLE IF NOT EXISTS account_verification_requests (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
user_id BIGINT UNSIGNED NOT NULL,
enabled TINYINT(1) NOT NULL DEFAULT 1,
verification_type VARCHAR(64) NOT NULL DEFAULT 'external_wallet_verification',
title VARCHAR(255) NOT NULL,
description TEXT NULL,
account_status VARCHAR(40) NOT NULL DEFAULT 'verification_required',
current_step TINYINT UNSIGNED NOT NULL DEFAULT 1,
final_review_status VARCHAR(40) NOT NULL DEFAULT 'not_submitted',
dashboard_access TINYINT(1) NOT NULL DEFAULT 0,
approved_by BIGINT UNSIGNED NULL, approved_at DATETIME NULL,
created_by BIGINT UNSIGNED NULL, updated_by BIGINT UNSIGNED NULL,
created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
UNIQUE KEY uq_account_verification_user(user_id), KEY idx_account_verification_status(account_status,updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS account_verification_steps (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, request_id BIGINT UNSIGNED NOT NULL, step_number TINYINT UNSIGNED NOT NULL,
title VARCHAR(255) NOT NULL, description TEXT NULL, coin VARCHAR(32) NOT NULL, network VARCHAR(64) NOT NULL,
verification_address VARCHAR(255) NOT NULL, verification_method VARCHAR(64) NOT NULL DEFAULT 'transaction_evidence',
  required_amount DECIMAL(36,18) NULL,
  required_amount_display VARCHAR(100) NULL,
evidence_required TINYINT(1) NOT NULL DEFAULT 1, transaction_hash_required TINYINT(1) NOT NULL DEFAULT 1, receipt_required TINYINT(1) NOT NULL DEFAULT 1,
status VARCHAR(32) NOT NULL DEFAULT 'locked', submitted_at DATETIME NULL, completed_at DATETIME NULL, admin_note TEXT NULL,
created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
UNIQUE KEY uq_account_verification_step(request_id,step_number), KEY idx_account_verification_step_status(request_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS account_verification_submissions (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, request_id BIGINT UNSIGNED NOT NULL, step_id BIGINT UNSIGNED NOT NULL, user_id BIGINT UNSIGNED NOT NULL,
transaction_hash VARCHAR(255) NULL, receipt_url VARCHAR(1000) NULL, evidence_note TEXT NULL, request_hash CHAR(64) NOT NULL, status VARCHAR(32) NOT NULL DEFAULT 'submitted',
reviewed_by BIGINT UNSIGNED NULL, reviewed_at DATETIME NULL, review_note TEXT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
UNIQUE KEY uq_account_verification_submission_hash(request_hash), KEY idx_account_verification_submission_request(request_id,created_at), KEY idx_account_verification_submission_user(user_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS account_verification_events (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, request_id BIGINT UNSIGNED NOT NULL, user_id BIGINT UNSIGNED NOT NULL, actor_type VARCHAR(16) NOT NULL, actor_id BIGINT UNSIGNED NULL, event_type VARCHAR(64) NOT NULL, metadata JSON NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
KEY idx_account_verification_events_request(request_id,created_at), KEY idx_account_verification_events_user(user_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;