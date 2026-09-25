// backend/schemaBootstrap.js
//
// Render does not execute SQL files in backend/migrations automatically.
// This bootstrap applies only additive, idempotent schema changes required by
// the current financial API. It never rewrites balances or deletes data.
const pool = require('./db');

async function columnExists(connection, table, column) {
  const [rows] = await connection.execute(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
     LIMIT 1`,
    [table, column]
  );
  return rows.length > 0;
}

async function addColumn(connection, table, column, definition) {
  if (!(await tableExists(connection, table))) {
    throw new Error(`Required table ${table} does not exist; schema bootstrap cannot safely continue.`);
  }
  if (!(await columnExists(connection, table, column))) {
    await connection.execute(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    console.log(`[Schema] Added ${table}.${column}`);
  }
}

async function tableExists(connection, table) {
  const [rows] = await connection.execute(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
     LIMIT 1`,
    [table]
  );
  return rows.length > 0;
}

async function indexExists(connection, table, indexName) {
  const [rows] = await connection.execute(
    `SELECT 1 FROM information_schema.statistics
     WHERE table_schema=DATABASE() AND table_name=? AND index_name=? LIMIT 1`,
    [table, indexName]
  );
  return rows.length > 0;
}

async function ensureUniqueIndex(connection, table, indexName, columns) {
  if (!(await tableExists(connection, table))) {
    throw new Error(`Required table ${table} does not exist; cannot create index ${indexName} safely.`);
  }
  if (!(await indexExists(connection, table, indexName))) {
    await connection.execute(`CREATE UNIQUE INDEX \`${indexName}\` ON \`${table}\` (${columns.map(columnName => "`" + columnName + "`").join(',')})`);
    console.log(`[Schema] Added unique index ${table}.${indexName}`);
  }
}

async function ensureIndex(connection, table, indexName, columns) {
  if (!(await tableExists(connection, table))) {
    throw new Error(`Required table ${table} does not exist; cannot create index ${indexName} safely.`);
  }
  if (!(await indexExists(connection, table, indexName))) {
    const quotedColumns = columns.map(columnName => "`" + columnName + "`").join(',');
    await connection.execute(`CREATE INDEX \`${indexName}\` ON \`${table}\` (${quotedColumns})`);
    console.log(`[Schema] Added index ${table}.${indexName}`);
  }
}

async function ensureFinancialSchema() {
  const connection = await pool.getConnection();
  try {
    // TiDB DDL is not transactionally rolled back. Do not wrap the bootstrap
    // in one giant transaction: if a later DDL statement fails, earlier safe
    // schema changes must remain available for the next startup attempt.
    // Financial data changes below remain narrowly scoped and idempotent.

    if (await tableExists(connection, 'user_assets') && await columnExists(connection, 'user_assets', 'balance')) {
      await addColumn(connection, 'user_assets', 'available_balance', 'DECIMAL(36,18) NOT NULL DEFAULT 0');
      await addColumn(connection, 'user_assets', 'reserved_balance', 'DECIMAL(36,18) NOT NULL DEFAULT 0');
      await addColumn(connection, 'user_assets', 'pending_balance', 'DECIMAL(36,18) NOT NULL DEFAULT 0');

      // One-time, non-destructive compatibility migration from the legacy
      // universal users.balance field into the authoritative USDT asset row.
      // Existing USDT holdings are never overwritten.
      if (await tableExists(connection, 'users')) {
        await connection.execute(`
          INSERT INTO user_assets
            (user_id, coin, balance, avg_price, available_balance, reserved_balance, pending_balance)
          SELECT u.id, 'USDT', u.balance, 1, u.balance, 0, 0
          FROM users u
          LEFT JOIN user_assets a ON a.user_id = u.id AND UPPER(a.coin) = 'USDT'
          WHERE a.user_id IS NULL AND u.balance > 0
        `);
      }

      await connection.execute(`
        UPDATE user_assets
        SET available_balance = balance
        WHERE available_balance = 0
          AND reserved_balance = 0
          AND pending_balance = 0
          AND balance <> 0
      `);
    }

    // Security migrations are SQL files and are not run automatically by Render.
    // Keep their required additive schema in the startup bootstrap as well.
    await addColumn(connection, 'users', 'passcode', 'VARCHAR(255) NULL');
    await addColumn(connection, 'users', 'twofa_enabled', 'TINYINT(1) NOT NULL DEFAULT 0');
    await addColumn(connection, 'users', 'passcode_failed_attempts', 'INT NOT NULL DEFAULT 0');
    await addColumn(connection, 'users', 'passcode_locked_until', 'DATETIME NULL');
    await addColumn(connection, 'users', 'passcode_verified_at', 'DATETIME NULL');

    await connection.execute(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS two_factor_recovery_codes (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        code_hash VARCHAR(255) NOT NULL,
        used_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_2fa_recovery_user (user_id, used_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS security_events (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        event_type VARCHAR(64) NOT NULL,
        success TINYINT(1) NOT NULL DEFAULT 0,
        ip_address VARCHAR(64) NULL,
        user_agent VARCHAR(500) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_security_events_user_created (user_id, created_at),
        KEY idx_security_events_type_created (event_type, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await addColumn(connection, 'security_events', 'metadata', 'JSON NULL');

    // Deposit review/settlement uses these fields across the worker, admin review
    // route and user history endpoint. Older Render/TiDB databases may have the
    // original deposits table without the newer review columns, so reconcile them
    // here before any approval request can touch the table.
    await addColumn(connection, 'deposits', 'approved_at', 'DATETIME NULL');
    await addColumn(connection, 'deposits', 'admin_note', 'TEXT NULL');
    await addColumn(connection, 'deposits', 'updated_at', 'DATETIME NULL');
    await addColumn(connection, 'deposits', 'idempotency_key', 'VARCHAR(128) NULL');
    await addColumn(connection, 'deposits', 'request_hash', 'CHAR(64) NULL');
    await ensureUniqueIndex(connection, 'deposits', 'uq_deposits_user_idempotency', ['user_id', 'idempotency_key']);
    await ensureIndex(connection, 'deposits', 'idx_deposits_request_hash', ['user_id', 'request_hash']);

    await addColumn(connection, 'withdrawals', 'idempotency_key', 'VARCHAR(128) NULL');
    await addColumn(connection, 'withdrawals', 'request_hash', 'CHAR(64) NULL');
    await addColumn(connection, 'withdrawals', 'authorization_status', "VARCHAR(32) NOT NULL DEFAULT 'not_required'");
    await addColumn(connection, 'withdrawals', 'joint_authorization_id', 'BIGINT UNSIGNED NULL');
    await addColumn(connection, 'withdrawals', 'two_factor_verified_at', 'DATETIME NULL');
    await ensureUniqueIndex(connection, 'withdrawals', 'uq_withdrawals_user_idempotency', ['user_id', 'idempotency_key']);
    await ensureIndex(connection, 'withdrawals', 'idx_withdrawals_request_hash', ['user_id', 'request_hash']);
    await ensureIndex(connection, 'withdrawals', 'idx_withdrawals_user_id_id', ['user_id', 'id']);

    await addColumn(connection, 'convert_transactions', 'idempotency_key', 'VARCHAR(128) NULL');
    await addColumn(connection, 'convert_transactions', 'request_hash', 'CHAR(64) NULL');
    await ensureUniqueIndex(connection, 'convert_transactions', 'uq_convert_user_idempotency', ['user_id', 'idempotency_key']);
    await ensureIndex(connection, 'convert_transactions', 'idx_convert_request_hash', ['user_id', 'request_hash']);

    await addColumn(connection, 'user_transfers', 'idempotency_key', 'VARCHAR(128) NULL');
    await addColumn(connection, 'user_transfers', 'request_hash', 'CHAR(64) NULL');
    await ensureUniqueIndex(connection, 'user_transfers', 'uq_user_transfers_sender_idempotency', ['sender_id', 'idempotency_key']);
    await ensureIndex(connection, 'user_transfers', 'idx_user_transfers_sender_request_hash', ['sender_id', 'request_hash']);

    await addColumn(connection, 'trades', 'idempotency_key', 'VARCHAR(128) NULL');
    await addColumn(connection, 'trades', 'request_hash', 'CHAR(64) NULL');
    await ensureUniqueIndex(connection, 'trades', 'uq_trades_user_idempotency', ['user_id', 'idempotency_key']);

    await addColumn(connection, 'user_funds', 'idempotency_key', 'VARCHAR(128) NULL');
    await addColumn(connection, 'user_funds', 'request_hash', 'CHAR(64) NULL');
    await ensureUniqueIndex(connection, 'user_funds', 'uq_user_funds_user_idempotency', ['user_id', 'idempotency_key']);

    // Fund settlement is service-owned. Remove the legacy database trigger that
    // also credited compound profit to pending, which would double-apply ledger movement.
    // TiDB does not accept MySQL's DROP TRIGGER IF EXISTS form, so check
    // INFORMATION_SCHEMA first and only issue DROP TRIGGER when it exists.
    const [fundTriggerRows] = await connection.execute(
      `SELECT TRIGGER_NAME
       FROM information_schema.TRIGGERS
       WHERE TRIGGER_SCHEMA = DATABASE()
         AND TRIGGER_NAME = ?
       LIMIT 1`,
      ['trg_user_funds_compound_pending']
    );
    if (fundTriggerRows.length > 0) {
      await connection.execute('DROP TRIGGER trg_user_funds_compound_pending');
      console.log('[Schema] Removed legacy trg_user_funds_compound_pending trigger.');
    }

    await addColumn(connection, 'loans', 'idempotency_key', 'VARCHAR(128) NULL');
    await addColumn(connection, 'loans', 'request_hash', 'CHAR(64) NULL');
    await ensureUniqueIndex(connection, 'loans', 'uq_loans_user_idempotency', ['user_id', 'idempotency_key']);

    // Short-Term trade rules are part of the runtime API and must exist on
    // fresh Render/TiDB deployments. Older environments may already have this
    // table from a migration; CREATE IF NOT EXISTS is intentionally additive.
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS trade_rules (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        timer_seconds INT NOT NULL,
        min_amount DECIMAL(36,18) NOT NULL DEFAULT 0,
        max_amount DECIMAL(36,18) NOT NULL DEFAULT 0,
        payout_percent DECIMAL(18,8) NOT NULL DEFAULT 0,
        status VARCHAR(16) NOT NULL DEFAULT 'active',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_trade_rules_timer (timer_seconds),
        KEY idx_trade_rules_status_timer (status,timer_seconds)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Existing Render/TiDB installations may already have an older trade_rules table.
    // CREATE TABLE IF NOT EXISTS does not add columns to that table, so explicitly
    // reconcile every column used by the current Short-Term rules API before seeding.
    await addColumn(connection, 'trade_rules', 'timer_seconds', 'INT NOT NULL DEFAULT 60');
    await addColumn(connection, 'trade_rules', 'min_amount', 'DECIMAL(36,18) NOT NULL DEFAULT 0');
    await addColumn(connection, 'trade_rules', 'max_amount', 'DECIMAL(36,18) NOT NULL DEFAULT 0');
    await addColumn(connection, 'trade_rules', 'payout_percent', 'DECIMAL(18,8) NOT NULL DEFAULT 0');
    await addColumn(connection, 'trade_rules', 'status', "VARCHAR(16) NOT NULL DEFAULT 'active'");
    await addColumn(connection, 'trade_rules', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');
    await addColumn(connection, 'trade_rules', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

    // Keep the requested Short-Term durations available on a fresh deployment.
    // Existing rows are never overwritten.
    await connection.execute(`
      INSERT INTO trade_rules(timer_seconds,min_amount,max_amount,payout_percent,status)
      VALUES
        (60,0,0,0,'active'),
        (180,0,0,0,'active'),
        (300,0,0,0,'active')
      ON DUPLICATE KEY UPDATE timer_seconds=VALUES(timer_seconds)
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS spot_orders (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, user_id BIGINT UNSIGNED NOT NULL,
        symbol VARCHAR(32) NOT NULL, side VARCHAR(8) NOT NULL, order_type VARCHAR(16) NOT NULL DEFAULT 'market',
        quantity DECIMAL(36,18) NOT NULL, requested_price DECIMAL(36,18) NULL, execution_price DECIMAL(36,18) NULL,
        quote_amount DECIMAL(36,18) NULL, status VARCHAR(24) NOT NULL DEFAULT 'pending',
        idempotency_key VARCHAR(128) NOT NULL, request_hash CHAR(64) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        filled_at DATETIME NULL, PRIMARY KEY (id), UNIQUE KEY uq_spot_orders_user_idempotency (user_id,idempotency_key),
        KEY idx_spot_orders_user_status (user_id,status,created_at), KEY idx_spot_orders_symbol_status (symbol,status,created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await addColumn(connection, 'spot_orders', 'cost_basis_price', 'DECIMAL(36,18) NULL');
    await addColumn(connection, 'spot_orders', 'realized_pnl', 'DECIMAL(36,18) NULL');
    await addColumn(connection, 'spot_orders', 'realized_pnl_pct', 'DECIMAL(18,8) NULL');
    await addColumn(connection, 'spot_orders', 'outcome', "VARCHAR(16) NULL");

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS spot_trade_settings (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, setting_key VARCHAR(64) NOT NULL, setting_value VARCHAR(255) NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'active', updated_by BIGINT UNSIGNED NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (id),
        UNIQUE KEY uq_spot_trade_setting_key (setting_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Safe defaults for Spot / Long-Term execution and settlement policy.
    // Spot orders are market executions, not win/loss contracts. Any outcome
    // must be derived from the objective execution/market price; per-user
    // forced WIN/LOSS overrides are deliberately not supported.
    await connection.execute(`
      INSERT INTO spot_trade_settings(setting_key,setting_value,status)
      VALUES
        ('trading_enabled','true','active'),
        ('max_order_usdt','100000','active'),
        ('min_order_usdt','10','active'),
        ('max_slippage_bps','100','active'),
        ('trading_fee_bps','0','active'),
        ('quote_ttl_seconds','15','active'),
        ('max_orders_per_day','0','active'),
        ('buy_enabled','true','active'),
        ('sell_enabled','true','active'),
        ('supported_pairs','BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,XRPUSDT,DOGEUSDT,ADAUSDT,AVAXUSDT,LINKUSDT','active'),
        ('maintenance_message','','active'),
        ('settlement_model','market_execution','active'),
        ('settlement_price_source','binance_public_market','active'),
        ('settlement_receipt_required','true','active'),
        ('pnl_enabled','true','active'),
        ('pnl_reference','live_market','active'),
        ('pnl_refresh_seconds','5','active'),
        ('realized_pnl_on_sell','true','active'),
        ('win_threshold_bps','1','active'),
        ('loss_threshold_bps','1','active'),
        ('manual_outcome_override','false','active')
      ON DUPLICATE KEY UPDATE setting_key=VALUES(setting_key)
    `);
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS spot_trade_settlement_profiles (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        name VARCHAR(120) NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'draft',
        settlement_model VARCHAR(64) NOT NULL DEFAULT 'market_execution',
        price_source VARCHAR(64) NOT NULL DEFAULT 'binance_public_market',
        min_order_usdt DECIMAL(36,18) NOT NULL DEFAULT 10,
        max_order_usdt DECIMAL(36,18) NOT NULL DEFAULT 100000,
        max_slippage_bps DECIMAL(18,6) NOT NULL DEFAULT 100,
        trading_fee_bps DECIMAL(18,6) NOT NULL DEFAULT 0,
        quote_ttl_seconds INT NOT NULL DEFAULT 15,
        max_orders_per_day INT NOT NULL DEFAULT 0,
        pnl_enabled TINYINT(1) NOT NULL DEFAULT 1,
        pnl_reference VARCHAR(32) NOT NULL DEFAULT 'live_market',
        pnl_refresh_seconds INT NOT NULL DEFAULT 5,
        realized_pnl_on_sell TINYINT(1) NOT NULL DEFAULT 1,
        win_threshold_bps DECIMAL(18,6) NOT NULL DEFAULT 1,
        loss_threshold_bps DECIMAL(18,6) NOT NULL DEFAULT 1,
        settlement_receipt_required TINYINT(1) NOT NULL DEFAULT 1,
        created_by BIGINT UNSIGNED NULL,
        updated_by BIGINT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_spot_settlement_profile_name (name),
        KEY idx_spot_settlement_profile_status (status, updated_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await addColumn(connection, 'spot_trade_settlement_profiles', 'win_threshold_bps', 'DECIMAL(18,6) NOT NULL DEFAULT 1');
    await addColumn(connection, 'spot_trade_settlement_profiles', 'loss_threshold_bps', 'DECIMAL(18,6) NOT NULL DEFAULT 1');

    await connection.execute(`
      INSERT INTO spot_trade_settlement_profiles
        (name,status,settlement_model,price_source,min_order_usdt,max_order_usdt,max_slippage_bps,trading_fee_bps,quote_ttl_seconds,max_orders_per_day,pnl_enabled,pnl_reference,pnl_refresh_seconds,realized_pnl_on_sell,settlement_receipt_required)
      VALUES ('Default Market Settlement','active','market_execution','binance_public_market',10,100000,100,0,15,0,1,'live_market',5,1,1)
      ON DUPLICATE KEY UPDATE name=VALUES(name)
    `);

    await connection.execute(`
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
      ) ENGINE=InnoDB
    `);

    // Asset catalog/network tables are part of the multi-asset migration and
    // must also be available on fresh deployments where SQL migrations are not
    // executed separately. No existing rows are removed or rewritten.
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS asset_registry (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        symbol VARCHAR(32) NOT NULL UNIQUE,
        name VARCHAR(120) NOT NULL,
        decimals INT NOT NULL DEFAULT 8,
        enabled TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS asset_networks (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        asset_id BIGINT UNSIGNED NOT NULL,
        network VARCHAR(64) NOT NULL,
        deposit_enabled TINYINT(1) NOT NULL DEFAULT 1,
        withdrawal_enabled TINYINT(1) NOT NULL DEFAULT 1,
        min_withdrawal DECIMAL(36,18) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_asset_network (asset_id, network),
        KEY idx_asset_network_asset (asset_id),
        CONSTRAINT fk_asset_network_asset FOREIGN KEY (asset_id) REFERENCES asset_registry(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);    // Deposit verification/admin-control tables are also required at runtime because
    // Render does not execute backend/migrations automatically.
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS network_verification_settings (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        network VARCHAR(64) NOT NULL,
        explorer_api_url VARCHAR(500) NOT NULL,
        api_key VARCHAR(255) NULL,
        address_prefix VARCHAR(128) NOT NULL,
        address_suffix VARCHAR(128) NOT NULL,
        token_type VARCHAR(64) NOT NULL DEFAULT 'token',
        contract_address VARCHAR(255) NULL,
        tolerance_percent DECIMAL(18,8) NOT NULL DEFAULT 10,
        minimum_deposit DECIMAL(36,18) NOT NULL DEFAULT 0.01,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_network_verification_network (network),
        KEY idx_network_verification_active (is_active, network)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await addColumn(connection, 'network_verification_settings', 'api_key', 'VARCHAR(255) NULL');
    await addColumn(connection, 'network_verification_settings', 'contract_address', 'VARCHAR(255) NULL');
    await addColumn(connection, 'network_verification_settings', 'tolerance_percent', 'DECIMAL(18,8) NOT NULL DEFAULT 10');
    await addColumn(connection, 'network_verification_settings', 'minimum_deposit', 'DECIMAL(36,18) NOT NULL DEFAULT 0.01');

    // Repair legacy USDT rows once the availability buckets exist. balance is
    // the aggregate of available/reserved/pending, so a row with zero in all
    // buckets and a positive aggregate is safe to materialize into available.
    await connection.execute(
      `UPDATE user_assets
       SET available_balance = balance
       WHERE available_balance = 0
         AND reserved_balance = 0
         AND pending_balance = 0
         AND balance > 0`
    );

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS user_notifications (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(64) NOT NULL DEFAULT 'general',
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_user_notifications_user_created (user_id, created_at),
        KEY idx_user_notifications_user_read (user_id, is_read, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS notification_email_logs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        notification_id BIGINT UNSIGNED NOT NULL,
        user_id BIGINT UNSIGNED NOT NULL,
        email VARCHAR(320) NOT NULL,
        status VARCHAR(24) NOT NULL,
        error_message TEXT NULL,
        sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_notification_email_notification (notification_id),
        KEY idx_notification_email_user_time (user_id, sent_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS transaction_security_challenges (
        id CHAR(36) NOT NULL,
        user_id BIGINT UNSIGNED NOT NULL,
        action VARCHAR(64) NOT NULL,
        idempotency_key VARCHAR(128) NOT NULL,
        otp_hash CHAR(64) NOT NULL,
        otp_verified TINYINT(1) NOT NULL DEFAULT 0,
        two_factor_required TINYINT(1) NOT NULL DEFAULT 0,
        two_factor_verified TINYINT(1) NOT NULL DEFAULT 0,
        passcode_verified TINYINT(1) NOT NULL DEFAULT 0,
        attempts INT NOT NULL DEFAULT 0,
        expires_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_tsc_user_created (user_id, created_at),
        KEY idx_tsc_user_key (user_id, idempotency_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Keep the repository-defined security/preferences/audit foundations
    // available on deployments where Render does not run SQL migration files.
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS two_factor_recovery_codes (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        code_hash VARCHAR(255) NOT NULL,
        used_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_2fa_recovery_user (user_id, used_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await connection.execute(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await addColumn(connection, 'withdrawals', 'joint_authorization_id', 'BIGINT UNSIGNED NULL');
    await addColumn(connection, 'withdrawals', 'authorization_status', "VARCHAR(32) NOT NULL DEFAULT 'not_required'");
    await addColumn(connection, 'withdrawals', 'two_factor_verified_at', 'DATETIME NULL');

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        user_id BIGINT NOT NULL PRIMARY KEY,
        language VARCHAR(16) NOT NULL DEFAULT 'en',
        timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
        appearance ENUM('light','dark','system') NOT NULL DEFAULT 'system',
        notifications_enabled TINYINT(1) NOT NULL DEFAULT 1,
        haptics_enabled TINYINT(1) NOT NULL DEFAULT 1,
        sounds_enabled TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_preferences_updated (updated_at)
      ) ENGINE=InnoDB
    `);

    await connection.execute(`
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
      ) ENGINE=InnoDB
    `);


    await connection.execute("CREATE TABLE IF NOT EXISTS digital_options_settings (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, setting_key VARCHAR(64) NOT NULL, setting_value VARCHAR(255) NOT NULL, status VARCHAR(16) NOT NULL DEFAULT 'active', updated_by BIGINT UNSIGNED NULL, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY(id), UNIQUE KEY uq_digital_option_setting(setting_key)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    await connection.execute("CREATE TABLE IF NOT EXISTS digital_options_trades (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, user_id BIGINT UNSIGNED NOT NULL, asset_pair VARCHAR(32) NOT NULL, direction VARCHAR(8) NOT NULL, entry_spot_price DECIMAL(36,18) NOT NULL, strike_price DECIMAL(36,18) NOT NULL, stake_amount DECIMAL(36,18) NOT NULL, payout_rate DECIMAL(18,8) NOT NULL, implied_volatility DECIMAL(18,8) NOT NULL, timeframe_code VARCHAR(8) NOT NULL, duration_seconds INT NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, expiration_time DATETIME NOT NULL, status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE', settlement_price DECIMAL(36,18) NULL, payout_amount DECIMAL(36,18) NULL, settlement_mode VARCHAR(24) NULL, settled_by_admin_id BIGINT UNSIGNED NULL, settlement_note VARCHAR(500) NULL, settled_at DATETIME NULL, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, idempotency_key VARCHAR(128) NOT NULL, PRIMARY KEY(id), UNIQUE KEY uq_digital_trade_user_idempotency(user_id,idempotency_key), KEY idx_digital_trade_active_expiry(status,expiration_time), KEY idx_digital_trade_user_status(user_id,status,created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    await connection.execute("CREATE TABLE IF NOT EXISTS digital_options_audit (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, user_id BIGINT UNSIGNED NULL, actor_id BIGINT UNSIGNED NULL, action VARCHAR(96) NOT NULL, trade_id BIGINT UNSIGNED NULL, amount DECIMAL(36,18) NULL, metadata JSON NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(id), KEY idx_digital_audit_trade(trade_id,created_at), KEY idx_digital_audit_user(user_id,created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    await connection.execute("INSERT INTO digital_options_settings(setting_key,setting_value,status) VALUES ('enabled','true','active'),('payout_rate','88','active'),('platform_spread_fee','0.03','active'),('risk_free_rate','0.04','active'),('implied_volatility','0.60','active'),('max_stake_usdt','50000','active'),('cashout_enabled','true','active'),('auto_settlement_enabled','true','active'),('manual_outcome_override','false','active'),('supported_pairs','BTCUSDT,ETHUSDT','active') ON DUPLICATE KEY UPDATE setting_key=VALUES(setting_key)");

    console.log('[Schema] Financial and security compatibility schema is ready.');
  } catch (error) {
    console.error('[Schema] Financial schema bootstrap failed:', error.message);
    throw error;
  } finally {
    connection.release();
  }
}

ensureFinancialSchema()
  .catch(() => process.exitCode = 1)
  .finally(async () => {
    try { await pool.end(); } catch (_) {}
  });