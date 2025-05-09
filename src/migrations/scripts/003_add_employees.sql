-- Create employees table
CREATE TABLE employees (
    id VARCHAR(10) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(15) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Add employee_code to orders table
ALTER TABLE orders ADD COLUMN employee_code VARCHAR(10) AFTER worker_phone;
ALTER TABLE orders ADD FOREIGN KEY (employee_code) REFERENCES employees(id); 