import mysql from 'mysql2/promise';

/**
 * Run database migration: extend account_signup.PWD from char(100) to varchar(255)
 * to fix bcrypt hash truncation issue in password reset.
 * 
 * Usage: node scripts/migrate-pwd-column.mjs
 */

async function runMigration() {
  let conn;
  try {
    // Try common localhost MySQL configurations
    const configs = [
      { host: 'localhost', user: 'root', password: '', database: 'chaos_theta' },
      { host: '127.0.0.1', user: 'root', password: '', database: 'chaos_theta' },
      { host: 'localhost', user: 'root', password: 'root', database: 'chaos_theta' },
      { host: 'localhost', user: 'root', password: 'password', database: 'chaos_theta' },
    ];

    let connected = false;
    let lastError = null;

    for (const config of configs) {
      try {
        console.log(`\n📌 Trying connection: ${config.host}:3306 as ${config.user}...`);
        conn = await mysql.createConnection(config);
        console.log('✅ Connected successfully');
        connected = true;
        break;
      } catch (err) {
        lastError = err;
        console.log(`❌ Failed: ${err.message}`);
      }
    }

    if (!connected) {
      throw new Error(`Could not connect to MySQL. Last error: ${lastError?.message}`);
    }

    // Check current schema
    console.log('\n📋 Current PWD column info:');
    const [columnInfo] = await conn.query(
      "SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'account_signup' AND COLUMN_NAME = 'PWD'"
    );
    if (columnInfo.length > 0) {
      const col = columnInfo[0];
      console.log(`   Type: ${col.COLUMN_TYPE}, Default: ${col.COLUMN_DEFAULT}`);
    }

    // Apply migration
    console.log('\n🔧 Applying migration: ALTER TABLE account_signup MODIFY COLUMN PWD varchar(255)...');
    await conn.query('ALTER TABLE `account_signup` MODIFY COLUMN `PWD` varchar(255) NOT NULL DEFAULT \'NA\'');
    console.log('✅ Migration applied successfully!');

    // Verify
    console.log('\n📋 New PWD column info:');
    const [newColumnInfo] = await conn.query(
      "SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'account_signup' AND COLUMN_NAME = 'PWD'"
    );
    if (newColumnInfo.length > 0) {
      const col = newColumnInfo[0];
      console.log(`   Type: ${col.COLUMN_TYPE}, Default: ${col.COLUMN_DEFAULT}`);
    }

    console.log('\n✅ PASSWORD RESET FIX COMPLETE');
    console.log('   Restart Next.js server and try password reset again.');

  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) {
      await conn.end();
    }
  }
}

runMigration();
