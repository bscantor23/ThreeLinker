import Redis from 'ioredis';

const config = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || null,
    db: process.env.REDIS_DB || 0
};

console.log('🧹 Starting cleanup script...');
console.log('🔌 Connecting to Redis with config:', config);

const redis = new Redis(config);

redis.on('connect', async () => {
    console.log('✅ Connected to Redis!');

    try {
        const dbsize = await redis.dbsize();
        console.log(`📊 Current DB Size: ${dbsize} keys`);

        const keys = await redis.keys('*');
        console.log('🔑 Keys found:', keys);

        console.log('💥 Executing FLUSHALL...');
        await redis.flushall();
        console.log('✨ FLUSHALL complete.');

        const newSize = await redis.dbsize();
        console.log(`📊 New DB Size: ${newSize} keys`);

        if (newSize === 0) {
            console.log('✅ CLEANUP SUCCESSFUL: Redis is empty.');
        } else {
            console.error('⚠️ WARNING: Redis is NOT empty after flush.');
        }

    } catch (err) {
        console.error('❌ Error during cleanup:', err);
    } finally {
        redis.disconnect();
        console.log('👋 Disconnected.');
    }
});

redis.on('error', (err) => {
    console.error('❌ Redis Connection Error:', err.message);
    process.exit(1);
});
