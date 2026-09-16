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

async function ensureFinancialSchema() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Multi-asset ledger buckets used by deposits, funds and withdrawals.
    if (await columnExists(connection, 'user_assets', 'balance')) {
      await addColumn(connection, 'user_assets', 'available_balance', 'DECIMAL(36,18) NOT NULL DEFAULT 0');
      await addColumn(connection, 'user_assets', 'reserved_balance', 'DECIMAL(36,18) NOT NULL DEFAULT 0');
      await addColumn(connection, 'user_assets', 'pending_balance', 'DECIMAL(36,18) NOT NULL DEFAULT 0');
      await connection.execute(`
        UPDATE user_assets
        SET available_balance = balance
        WHERE available_balance = 0 AND balance <> 0
      `);
    }

    // Deposit idempotency fields are required by POST /deposits/request.
    await addColumn(connection, 'deposits', 'idempotency_key', 'VARCHAR(128) NULL');
    await addColumn(connection, 'deposits', 'request_hash', 'CHAR(64) NULL');

    // Withdrawal idempotency/security fields are required by POST /withdrawals/request.
    await addColumn(connection, 'withdrawals', 'idempotency_key', 'VARCHAR(128) NULL');
    await addColumn(connection, 'withdrawals', 'request_hash', 'CHAR(64) NULL');
    await addColumn(connection, 'withdrawals', 'authorization_status', "VARCHAR(32) NOT NULL DEFAULT 'not_required'");
    await addColumn(connection, 'withdrawals', 'joint_authorization_id', 'BIGINT UNSIGNED NULL');
    await addColumn(connection, 'withdrawals', 'two_factor_verified_at', 'DATETIME NULL');

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
    console.log('[Schema] Financial compatibility schema is ready.');
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
