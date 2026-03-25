const mongoose = require('mongoose');

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

// Cache connection across serverless invocations
let connectionPromise = null;

const connectDB = async () => {
  // Reuse existing connection (important for Vercel serverless warm invocations)
  if (connectionPromise && mongoose.connection.readyState === 1) {
    return connectionPromise;
  }

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('MONGODB_URI is not set in environment variables.');
    console.error('Please create a .env file with MONGODB_URI (see .env.example).');
    return;
  }

  connectionPromise = (async () => {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const conn = await mongoose.connect(uri, {
          serverSelectionTimeoutMS: 5000
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        return;
      } catch (error) {
        console.error(`MongoDB connection attempt ${attempt}/${MAX_RETRIES} failed: ${error.message}`);
        if (attempt < MAX_RETRIES) {
          console.log(`Retrying in ${RETRY_DELAY_MS / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        }
      }
    }
    console.error('All MongoDB connection attempts failed. Server will start but DB features will be unavailable.');
    connectionPromise = null;
  })();

  return connectionPromise;
};

module.exports = connectDB;
