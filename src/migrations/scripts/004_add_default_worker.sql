USE admin_BS_Gold;

-- Insert default worker
INSERT IGNORE INTO workers (id, name) VALUES (1, 'Default Worker');

-- Insert default phone number for the default worker
INSERT IGNORE INTO worker_phones (worker_id, phone_number, is_primary) 
VALUES (1, 'DEFAULT_WORKER_PHONE', true);

-- Insert default employee if employees table exists
INSERT IGNORE INTO employees (id, name, phone_number, password)
VALUES ('DEFAULT', 'Default Employee', 'DEFAULT_EMPLOYEE_PHONE', 'default_password'); 