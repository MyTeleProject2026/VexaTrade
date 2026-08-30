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
) ENGINE=InnoDB;
