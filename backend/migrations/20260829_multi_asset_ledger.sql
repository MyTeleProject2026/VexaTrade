-- VexaTrade multi-asset ledger migration
-- Apply once after backing up the production database.

ALTER TABLE user_assets
  ADD COLUMN IF NOT EXISTS available_balance DECIMAL(36,18) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reserved_balance DECIMAL(36,18) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_balance DECIMAL(36,18) NOT NULL DEFAULT 0;

-- Preserve existing per-asset holdings.
UPDATE user_assets
SET available_balance = balance
WHERE available_balance = 0 AND balance <> 0;

-- One-time compatibility migration: move legacy universal USDT balance into
-- the authoritative user_assets model without overwriting an existing USDT row.
INSERT INTO user_assets (user_id, coin, balance, avg_price, available_balance, reserved_balance, pending_balance)
SELECT u.id, 'USDT', u.balance, 1, u.balance, 0, 0
FROM users u
LEFT JOIN user_assets a ON a.user_id = u.id AND a.coin = 'USDT'
WHERE a.user_id IS NULL AND u.balance <> 0;

CREATE TABLE IF NOT EXISTS asset_ledger_entries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  coin VARCHAR(32) NOT NULL,
  network VARCHAR(64) NOT NULL DEFAULT 'INTERNAL',
  bucket VARCHAR(16) NOT NULL,
  entry_type VARCHAR(64) NOT NULL,
  amount DECIMAL(36,18) NOT NULL,
  reference_type VARCHAR(64) NULL,
  reference_id BIGINT NULL,
  note VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_asset_ledger_user_asset (user_id, coin, network, created_at),
  INDEX idx_asset_ledger_reference (reference_type, reference_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS asset_registry (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  symbol VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  decimals INT NOT NULL DEFAULT 8,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS asset_networks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  asset_id BIGINT UNSIGNED NOT NULL,
  network VARCHAR(64) NOT NULL,
  deposit_enabled TINYINT(1) NOT NULL DEFAULT 1,
  withdrawal_enabled TINYINT(1) NOT NULL DEFAULT 1,
  min_withdrawal DECIMAL(36,18) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_asset_network (asset_id, network),
  CONSTRAINT fk_asset_network_asset FOREIGN KEY (asset_id) REFERENCES asset_registry(id) ON DELETE CASCADE
) ENGINE=InnoDB;
