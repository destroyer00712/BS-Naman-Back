USE admin_BS_Gold;

-- Add forwarding columns to messages table
ALTER TABLE messages 
ADD COLUMN forwarded_from VARCHAR(50) NULL COMMENT 'Indicates the sender type of the original message when forwarded',
ADD COLUMN original_message_id BIGINT NULL COMMENT 'Reference to the original message if this is a forwarded message',
ADD CONSTRAINT fk_original_message FOREIGN KEY (original_message_id) REFERENCES messages(message_id) ON DELETE SET NULL;

-- Add index for better performance on forwarded message queries
CREATE INDEX idx_messages_forwarded_from ON messages(forwarded_from);
CREATE INDEX idx_messages_original_message_id ON messages(original_message_id); 