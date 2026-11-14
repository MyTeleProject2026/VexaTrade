-- VexaTrade Long-Horizon Digital Options schema.
-- Render/TiDB deployments also receive the same schema from schemaBootstrap.js.
CREATE TABLE IF NOT EXISTS digital_options_settings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  setting_key VARCHAR(64) NOT NULL,
  setting_value VARCHAR(255) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  updated_by BIGINT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(id),
  UNIQUE KEY uq_digital_option_setting(setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS digital_options_trades (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  asset_pair VARCHAR(32) NOT NULL,
  direction VARCHAR(8) NOT NULL,
  entry_spot_price DECIMAL(36,18) NOT NULL,
  strike_price DECIMAL(36,18) NOT NULL,
  stake_amount DECIMAL(36,18) NOT NULL,
  payout_rate DECIMAL(18,8) NOT NULL,
  implied_volatility DECIMAL(18,8) NOT NULL,
  timeframe_code VARCHAR(8) NOT NULL,
  duration_seconds INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expiration_time DATETIME NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  settlement_price DECIMAL(36,18) NULL,
  payout_amount DECIMAL(36,18) NULL,
  settlement_mode VARCHAR(24) NULL,
  settled_by_admin_id BIGINT UNSIGNED NULL,
  settlement_note VARCHAR(500) NULL,
  settled_at DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  idempotency_key VARCHAR(128) NOT NULL,
  PRIMARY KEY(id),
  UNIQUE KEY uq_digital_trade_user_idempotency(user_id,idempotency_key),
  KEY idx_digital_trade_active_expiry(status,expiration_time),
  KEY idx_digital_trade_user_status(user_id,status,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS digital_options_audit (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  actor_id BIGINT UNSIGNED NULL,
  action VARCHAR(96) NOT NULL,
  trade_id BIGINT UNSIGNED NULL,
  amount DECIMAL(36,18) NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(id),
  KEY idx_digital_audit_trade(trade_id,created_at),
  KEY idx_digital_audit_user(user_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO digital_options_settings(setting_key,setting_value,status)
VALUES
('enabled','true','active'),
('payout_rate','88','active'),
('platform_spread_fee','0.03','active'),
('risk_free_rate','0.04','active'),
('implied_volatility','0.60','active'),
('max_stake_usdt','50000','active'),
('cashout_enabled','true','active'),
('auto_settlement_enabled','true','active'),
('manual_outcome_override','false','active'),
('supported_pairs','BTCUSDT,ETHUSDT','active')
ON DUPLICATE KEY UPDATE setting_key=VALUES(setting_key);