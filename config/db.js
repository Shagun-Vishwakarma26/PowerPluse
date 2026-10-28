const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const connectDB = async () => {
  try {
    const connStr = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/powerpulse';
    console.log(`Connecting to MongoDB at: ${connStr}`);
    
    // Set connection timeout short so fallback triggers quickly if local mongodb is down
    await mongoose.connect(connStr, {
      serverSelectionTimeoutMS: 3000
    });
    console.log(`MongoDB Connected: ${mongoose.connection.host}`);
  } catch (error) {
    console.warn(`Primary MongoDB Connection Failed (${error.message}). Starting MongoMemoryServer fallback...`);
    try {
      const mongod = await MongoMemoryServer.create();
      const uri = mongod.getUri();
      await mongoose.connect(uri);
      console.log(`Fallback MongoMemoryServer Connected Successfully at: ${uri}`);
    } catch (memErr) {
      console.error(`Failed to start MongoMemoryServer fallback: ${memErr.message}`);
      process.exit(1);
    }
  }
};

module.exports = connectDB;
