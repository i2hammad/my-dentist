require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');

const clearDatabase = async () => {
  try {
    await connectDB();
    console.log('\n🗑️  Starting database cleanup...\n');

    // Drop the entire database to ensure a completely clean slate
    await mongoose.connection.db.dropDatabase();
    
    console.log('✅ Database completely wiped!');
    console.log('✅ All users, doctors, and appointments deleted.');
    console.log('\nReady for you to enter real data!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    process.exit(1);
  }
};

clearDatabase();
