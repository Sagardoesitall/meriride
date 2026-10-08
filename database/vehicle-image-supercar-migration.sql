-- Run once in each existing MeriRide database before using the admin add-car form.
-- Existing vehicles are categorized as standard and keep their current image fallback.
USE meriride;

ALTER TABLE vehicle
  ADD COLUMN category VARCHAR(32) NOT NULL DEFAULT 'standard',
  ADD COLUMN image_data MEDIUMTEXT NULL;

-- The local API account needs permission to create inventory records.
GRANT INSERT ON meriride.vehicle TO 'meriride_app'@'localhost';
FLUSH PRIVILEGES;
