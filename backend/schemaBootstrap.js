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
  if (!(await columnExists(connection, table, column))) {
    await connection.execute(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    console.log(`[Schema] Added ${table}.${column}`);
  }
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
  if (!(await indexExists(connection, table, indexName))) {
    await connection.execute(`CREATE UNIQUE INDEX \`${indexName}\` ON \`${table}\` (${columns.map(c => `\`${c}\``).join(',')})`);
    console.log(`[Schema] Added unique index ${table}.${indexName}`);
  }
}

async function ensureFinancialSchema() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    if (await columnExists(connection, 'user_assets', 'balance')) {
      await addColumn(connection, 'user_assets', 'available_balance', 'DECIMAL(36,18) NOT NULL DEFAULT 0');
      await addColumn(connection, 'user_assets', 'reserved_balance', 'DECIMAL(36,18) NOT NULL DEFAULT 0');
      await addColumn(connection, 'user_assets', 'pending_balance', 'DECIMAL(36,18) NOT NULL DEFAULT 0');
      await connection.execute(`UPDATE user_assets SET available_balance = balance WHERE available_balance = 0 AND balance <> 0`);
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

    await addColumn(connection, 'deposits', 'idempotency_key', 'VARCHAR(128) NULL');
    await addColumn(connection, 'deposits', 'request_hash', 'CHAR(64) NULL');
    await ensureUniqueIndex(connection, 'deposits', 'uq_deposits_user_idempotency', ['user_id', 'idempotency_key']);

    await addColumn(connection, 'withdrawals', 'idempotency_key', 'VARCHAR(128) NULL');
    await addColumn(connection, 'withdrawals', 'request_hash', 'CHAR(64) NULL');
    await addColumn(connection, 'withdrawals', 'authorization_status', "VARCHAR(32) NOT NULL DEFAULT 'not_required'");
    await addColumn(connection, 'withdrawals', 'joint_authorization_id', 'BIGINT UNSIGNED NULL');
    await addColumn(connection, 'withdrawals', 'two_factor_verified_at', 'DATETIME NULL');
    await ensureUniqueIndex(connection, 'withdrawals', 'uq_withdrawals_user_idempotency', ['user_id', 'idempotency_key']);

    await addColumn(connection, 'convert_transactions', 'idempotency_key', 'VARCHAR(128) NULL');
    await addColumn(connection, 'convert_transactions', 'request_hash', 'CHAR(64) NULL');
    await ensureUniqueIndex(connection, 'convert_transactions', 'uq_convert_user_idempotency', ['user_id', 'idempotency_key']);

    await addColumn(connection, 'user_transfers', 'idempotency_key', 'VARCHAR(128) NULL');
    await addColumn(connection, 'user_transfers', 'request_hash', 'CHAR(64) NULL');
    await ensureUniqueIndex(connection, 'user_transfers', 'uq_transfer_user_idempotency', ['sender_id', 'idempotency_key']);

    await addColumn(connection, 'trades', 'idempotency_key', 'VARCHAR(128) NULL');
    await addColumn(connection, 'trades', 'request_hash', 'CHAR(64) NULL');
    await ensureUniqueIndex(connection, 'trades', 'uq_trades_user_idempotency', ['user_id', 'idempotency_key']);

    await addColumn(connection, 'user_funds', 'idempotency_key', 'VARCHAR(128) NULL');
    await addColumn(connection, 'user_funds', 'request_hash', 'CHAR(64) NULL');
    await ensureUniqueIndex(connection, 'user_funds', 'uq_user_funds_user_idempotency', ['user_id', 'idempotency_key']);

    await addColumn(connection, 'loans', 'idempotency_key', 'VARCHAR(128) NULL');
    await addColumn(connection, 'loans', 'request_hash', 'CHAR(64) NULL');
    await ensureUniqueIndex(connection, 'loans', 'uq_loans_user_idempotency', ['user_id', 'idempotency_key']);

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
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS spot_trade_settings (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, setting_key VARCHAR(64) NOT NULL, setting_value VARCHAR(255) NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'active', updated_by BIGINT UNSIGNED NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (id),
        UNIQUE KEY uq_spot_trade_setting_key (setting_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
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

    await connection.commit();
    console.log('[Schema] Financial and security compatibility schema is ready.');
  } catch (error) {
    try { await connection.rollback(); } catch (_) {}
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