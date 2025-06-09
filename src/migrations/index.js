const pool = require('../config/db');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

// Helper to validate database structure
const validateDatabaseSchema = async (connection) => {
  logger.info('Validating database schema...');
  
  try {
    // Check if all required tables exist
    const [tables] = await connection.execute(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE()
    `);
    
    const tableNames = tables.map(t => t.table_name);
    const requiredTables = ['workers', 'worker_phones', 'clients', 'orders', 'messages'];
    
    for (const table of requiredTables) {
      if (!tableNames.includes(table)) {
        throw new Error(`Required table '${table}' is missing`);
      }
    }
    
    // Check if worker_phones has the correct columns
    const [workerPhoneColumns] = await connection.execute(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = DATABASE() AND table_name = 'worker_phones'
    `);
    
    const columnNames = workerPhoneColumns.map(c => c.column_name);
    const requiredColumns = ['id', 'worker_id', 'phone_number', 'is_primary'];
    
    for (const column of requiredColumns) {
      if (!columnNames.includes(column)) {
        throw new Error(`Required column '${column}' is missing from worker_phones table`);
      }
    }
    
    logger.info('Database schema validation successful');
    return true;
  } catch (error) {
    logger.error('Database schema validation failed:', error);
    return false;
  }
};

// Run migrations
const runMigrations = async () => {
  const connection = await pool.getConnection();
  
  try {
    // Create migrations table if it doesn't exist
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Get list of applied migrations
    const [appliedMigrations] = await connection.execute('SELECT name FROM migrations');
    const appliedMigrationNames = appliedMigrations.map(m => m.name);
    
    // Get list of migration files
    const migrationsDir = path.join(__dirname, 'scripts');
    if (!fs.existsSync(migrationsDir)) {
      fs.mkdirSync(migrationsDir, { recursive: true });
    }
    
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    if (migrationFiles.length === 0) {
      logger.info('No migration files found');
      
      // Create initial migration
      const initialMigration = path.join(migrationsDir, '001_initial_schema.sql');
      fs.writeFileSync(initialMigration, getInitialMigration());
      migrationFiles.push('001_initial_schema.sql');
      
      logger.info('Created initial migration script');
    }
    
    // Apply pending migrations
    for (const file of migrationFiles) {
      if (!appliedMigrationNames.includes(file)) {
        const migrationPath = path.join(migrationsDir, file);
        const migration = fs.readFileSync(migrationPath, 'utf8');
        
        // Split migration into individual statements
        const statements = migration.split(';').filter(stmt => stmt.trim());
        
        logger.info(`Applying migration: ${file}`);
        
        try {
          // Handle database creation statements first
          for (const statement of statements) {
            const trimmedStmt = statement.trim();
            if (trimmedStmt.toUpperCase().startsWith('CREATE DATABASE') || 
                trimmedStmt.toUpperCase().startsWith('USE ')) {
              await connection.execute(trimmedStmt);
            }
          }
          
          // Begin transaction for table operations
          await connection.beginTransaction();
          
          // Execute all non-database statements
          for (const statement of statements) {
            const trimmedStmt = statement.trim();
            if (!trimmedStmt.toUpperCase().startsWith('CREATE DATABASE') && 
                !trimmedStmt.toUpperCase().startsWith('USE ') && 
                trimmedStmt) {
              try {
                await connection.execute(trimmedStmt);
              } catch (error) {
                logger.error(`Error executing statement: ${trimmedStmt}`);
                throw error;
              }
            }
          }
          
          // Record migration
          await connection.execute(
            'INSERT INTO migrations (name) VALUES (?)',
            [file]
          );
          
          // Commit transaction
          await connection.commit();
          logger.info(`Migration applied successfully: ${file}`);
        } catch (error) {
          // Rollback on error
          if (connection.inTransaction) {
            await connection.rollback();
          }
          logger.error(`Migration failed: ${file}`, error);
          throw error;
        }
      }
    }
    
    // Validate database schema
    const isValid = await validateDatabaseSchema(connection);
    
    if (!isValid) {
      throw new Error('Database schema validation failed');
    }
    
    return true;
  } finally {
    connection.release();
  }
};

// Initial migration SQL
const getInitialMigration = () => {
  return `
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
  `;
};

module.exports = {
  runMigrations,
  validateDatabaseSchema
}; 