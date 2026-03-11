/**
 * dev-start.js
 * Starts an in-memory MongoDB, updates MONGODB_URI, then launches the server.
 * Run with: node dev-start.js
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const { spawn } = require('child_process');
const path = require('path');

(async () => {
  console.log('🍃 Starting in-memory MongoDB...');
  const mongod = await MongoMemoryServer.create({ instance: { dbName: 'gleuhr-app' } });
  const uri = mongod.getUri();
  console.log('✅ MongoDB running at:', uri);

  process.env.MONGODB_URI = uri;
  process.env.PORT = process.env.PORT || '5001';

  // Load rest of .env (but override MONGODB_URI)
  require('dotenv').config({ override: false });
  process.env.MONGODB_URI = uri;  // ensure our in-memory URI wins

  console.log('🚀 Starting Gleuhr server on port', process.env.PORT, '...');
  const server = spawn('node', ['server/index.js'], {
    cwd: path.resolve(__dirname),
    env: { ...process.env, MONGODB_URI: uri },
    stdio: 'inherit',
  });

  server.on('exit', async (code) => {
    console.log('Server exited with code', code);
    await mongod.stop();
    process.exit(code);
  });

  process.on('SIGINT', async () => {
    console.log('\nStopping...');
    server.kill();
    await mongod.stop();
    process.exit(0);
  });
})();
