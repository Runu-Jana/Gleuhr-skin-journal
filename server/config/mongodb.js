const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gleuhr-app');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    console.log('Application will continue without MongoDB. Features requiring MongoDB will be disabled.');
    // Don't exit the process, just continue without MongoDB
  }
};

module.exports = connectDB;
