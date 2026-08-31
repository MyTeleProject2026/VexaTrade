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

DROP TRIGGER IF EXISTS trg_user_funds_compound_pending;
DELIMITER $$
CREATE TRIGGER trg_user_funds_compound_pending
AFTER UPDATE ON user_funds
FOR EACH ROW
BEGIN
  DECLARE delta DECIMAL(36,18) DEFAULT 0;
  IF NEW.locked_principal > OLD.locked_principal AND NEW.status = 'active' THEN
    SET delta = NEW.locked_principal - OLD.locked_principal;
    UPDATE user_assets
      SET pending_balance = pending_balance + delta,
          balance = available_balance + reserved_balance + pending_balance
      WHERE user_id = NEW.user_id AND coin = 'USDT';
    INSERT INTO asset_ledger_entries
      (user_id,coin,network,bucket,entry_type,amount,reference_type,reference_id,note)
      VALUES (NEW.user_id,'USDT','INTERNAL','pending','fund_profit_compound',delta,'user_fund',NEW.id,'Compounded fund profit added to pending principal');
    INSERT INTO financial_audit_events
      (user_id,action,coin,network,amount,reference_type,reference_id,metadata)
      VALUES (NEW.user_id,'fund_profit_compound','USDT','INTERNAL',delta,'user_fund',NEW.id,JSON_OBJECT('previous_principal',OLD.locked_principal,'new_principal',NEW.locked_principal));
  END IF;
END$$
DELIMITER ;
