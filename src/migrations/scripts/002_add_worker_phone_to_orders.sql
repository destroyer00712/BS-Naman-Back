USE admin_BS_Gold;

-- Add worker_phone column to orders table
ALTER TABLE orders 
ADD COLUMN worker_phone VARCHAR(15) NULL,
ADD CONSTRAINT fk_worker_phone FOREIGN KEY (worker_phone) REFERENCES worker_phones(phone_number) ON DELETE SET NULL ON UPDATE CASCADE; 