ALTER TABLE cms_media
  MODIFY COLUMN content MEDIUMBLOB NULL,
  ADD COLUMN storage_type VARCHAR(16) NOT NULL DEFAULT 'database',
  ADD COLUMN cos_url VARCHAR(1024) NULL,
  ADD COLUMN object_key VARCHAR(255) NULL,
  ADD COLUMN byte_size BIGINT UNSIGNED NULL,
  ADD INDEX idx_cms_media_storage (storage_type);
