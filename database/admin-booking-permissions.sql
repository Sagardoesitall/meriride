-- Run once in MySQL Workbench as root/admin so the MeriRide API can update
-- booking statuses and delete a booking after an administrator confirms it.
USE meriride;

GRANT UPDATE, DELETE ON meriride.booking TO 'meriride_app'@'localhost';
FLUSH PRIVILEGES;
