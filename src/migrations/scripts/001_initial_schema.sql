CREATE DATABASE IF NOT EXISTS admin_BS_Gold;
USE admin_BS_Gold;

-- Workers table with ID as primary key
CREATE TABLE IF NOT EXISTS workers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Worker phone numbers table
CREATE TABLE IF NOT EXISTS worker_phones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    worker_id INT NOT NULL,
    phone_number VARCHAR(15) NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_phone (phone_number)
) ENGINE=InnoDB;

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
    phone_number VARCHAR(15) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    order_number BIGINT AUTO_INCREMENT,
    id VARCHAR(10) PRIMARY KEY,
    client_phone VARCHAR(15),
    jewellery_details JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (client_phone) REFERENCES clients(phone_number),
    UNIQUE KEY (order_number)
) ENGINE=InnoDB;

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    message_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(10) NOT NULL,
    content TEXT NOT NULL,
    media_id VARCHAR(100),
    sender_type ENUM('enterprise', 'client', 'worker') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id)
) ENGINE=InnoDB; 