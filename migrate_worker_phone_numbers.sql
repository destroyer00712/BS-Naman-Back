-- Migration script to convert existing worker phone numbers to JSON format
START TRANSACTION;

-- Modify the existing phone_numbers column to JSON type
ALTER TABLE workers MODIFY COLUMN phone_numbers JSON;

-- Update workers table with phone numbers in JSON format
UPDATE workers w
SET phone_numbers = JSON_ARRAY(
    JSON_OBJECT(
        'id', 1,
        'phone_number', phone_numbers,
        'is_primary', TRUE
    )
)
WHERE phone_numbers IS NOT NULL;

COMMIT; 