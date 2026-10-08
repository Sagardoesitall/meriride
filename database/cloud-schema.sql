-- Create an empty MeriRide database schema in the currently selected MySQL
-- database. This contains no users, bookings, or vehicle inventory.
-- Select the Railway MySQL database (MYSQLDATABASE) before running this file.

CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(255) NOT NULL,
  `name` VARCHAR(255) DEFAULT NULL,
  `password` VARCHAR(255) DEFAULT NULL,
  `phone` VARCHAR(255) DEFAULT NULL,
  `role` VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `vehicle` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `available` BIT(1) NOT NULL,
  `brand` VARCHAR(255) NOT NULL,
  `fuel` VARCHAR(255) DEFAULT NULL,
  `name` VARCHAR(255) NOT NULL,
  `price_per_day` DECIMAL(38,2) NOT NULL,
  `seats` INT NOT NULL,
  `type` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `booking` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `created_at` DATETIME(6) DEFAULT NULL,
  `end_date` DATE DEFAULT NULL,
  `start_date` DATE DEFAULT NULL,
  `status` VARCHAR(255) DEFAULT NULL,
  `total_amount` DECIMAL(38,2) DEFAULT NULL,
  `user_id` BIGINT NOT NULL,
  `vehicle_id` BIGINT NOT NULL,
  `pickup_location` VARCHAR(255) DEFAULT NULL,
  `dropoff_location` VARCHAR(255) DEFAULT NULL,
  `pickup_time` TIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `booking_user_id_idx` (`user_id`),
  KEY `booking_vehicle_id_idx` (`vehicle_id`),
  CONSTRAINT `booking_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `booking_vehicle_fk` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicle` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
