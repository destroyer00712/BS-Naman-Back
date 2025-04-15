-- Migration script to convert existing worker phone numbers to JSON format
START TRANSACTION;

-- Modify the existing phone_numbers column to JSON type
ALTER TABLE workers MODIFY COLUMN phone_numbers JSON;

-- Update workers table with phone numbers in JSON array format
UPDATE workers w
SET phone_numbers = JSON_ARRAY(phone_numbers)
WHERE phone_numbers IS NOT NULL;

COMMIT; 