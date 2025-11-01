require('dotenv').config();
const database = require('../src/utils/database');

async function checkSchema() {
  try {
    await database.connect();
    const result = await database.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'sessions' 
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Current sessions table columns:');
    result.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type}, ${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await database.close();
  }
}

checkSchema();