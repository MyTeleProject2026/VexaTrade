-- VexaTrade Long-Horizon Digital Options
CREATE TABLE IF NOT EXISTS digital_options_settings (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, platform_spread_fee DECIMAL(5,2) NOT NULL DEFAULT 3.00,
 risk_neutral_rate DECIMAL(5,2) NOT NULL DEFAULT 4.00, max_stake_limit DECIMAL(18,2) NOT NULL DEFAULT 50000.00,
 auto_settlement_enabled TINYINT(1) NOT NULL DEFAULT 1, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS digital_options_trades (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, user_id BIGINT UNSIGNED NOT NULL, asset_pair VARCHAR(20) NOT NULL DEFAULT 'BTC/USDT',
 direction ENUM('CALL','PUT') NOT NULL, entry_spot_price DECIMAL(36,18) NOT NULL, strike_barrier_price DECIMAL(36,18) NOT NULL,
 stake_amount DECIMAL(36,18) NOT NULL, payout_rate DECIMAL(18,8) NOT NULL DEFAULT 88.00, implied_volatility DECIMAL(18,8) NOT NULL DEFAULT 60.00,
 timeframe_code VARCHAR(10) NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, expiration_time DATETIME NOT NULL,
 status ENUM('ACTIVE','SETTLED_WIN','SETTLED_LOSS','CASHOUT','VOIDED') NOT NULL DEFAULT 'ACTIVE',
 settlement_price DECIMAL(36,18) NULL, payout_amount DECIMAL(36,18) NOT NULL DEFAULT 0,
 settlement_mode ENUM('AUTO_ORACLE','MANUAL_ADMIN') NULL, settled_by_admin_id BIGINT UNSIGNED NULL, settled_at DATETIME NULL,
 idempotency_key VARCHAR(128) NULL, request_hash CHAR(64) NULL, PRIMARY KEY(id),
 UNIQUE KEY uq_digital_options_user_idempotency(user_id,idempotency_key),
 KEY idx_digital_options_user_status_expiry(user_id,status,expiration_time), KEY idx_digital_options_status_expiry(status,expiration_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS digital_options_audit (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, trade_id BIGINT UNSIGNED NOT NULL, user_id BIGINT UNSIGNED NOT NULL,
 admin_id BIGINT UNSIGNED NULL, action VARCHAR(64) NOT NULL, settlement_mode VARCHAR(32) NULL, status_from VARCHAR(32) NULL,
 status_to VARCHAR(32) NULL, settlement_price DECIMAL(36,18) NULL, amount DECIMAL(36,18) NULL, note VARCHAR(1000) NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(id),
 KEY idx_digital_options_audit_trade(trade_id,created_at), KEY idx_digital_options_audit_user(user_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO digital_options_settings(id,platform_spread_fee,risk_neutral_rate,max_stake_limit,auto_settlement_enabled)
VALUES(1,3.00,4.00,50000.00,1) ON DUPLICATE KEY UPDATE id=id;