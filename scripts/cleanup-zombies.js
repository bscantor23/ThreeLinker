import RedisManager from '../server/managers/RedisManager.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Configurar entorno
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


async function main() {
    console.log('🧟 ThreeLinker Zombie Room Cleaner 🧹');
    console.log('=====================================');

    const redisManager = new RedisManager();

    // Esperar conexión
    console.log('Connecting to Redis...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (!redisManager.isConnected) {
        console.error('❌ Could not connect to Redis. Check your configuration.');
        process.exit(1);
    }

    console.log('✅ Connected.');

    // Ejecutar limpieza
    try {
        const count = await redisManager.cleanZombieRooms();
        console.log(`\n🎉 Cleanup complete. Removed ${count} zombie rooms.`);
    } catch (error) {
        console.error('❌ Error executing cleanup:', error);
    } finally {
        await redisManager.shutdown();
        process.exit(0);
    }
}

main();
