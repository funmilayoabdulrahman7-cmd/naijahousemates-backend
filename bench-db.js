const Datastore = require('nedb-promises');
const db = Datastore.create({ filename: 'clicks-bench.db', autoload: true });

async function runBenchmark(totalWrites = 500, concurrency = 50) {
    console.log(`Starting DB Write Benchmark: ${totalWrites} entries (${concurrency} concurrent batches)`);
    const startTime = Date.now();
    
    let completed = 0;
    while (completed < totalWrites) {
        const batch = [];
        for (let i = 0; i < concurrency && completed < totalWrites; i++) {
            batch.push(db.insert({
                timestamp: new Date(),
                action: 'public_link_click',
                meta: { userAgent: 'Mozilla/5.0...', mockIp: '192.168.1.' + (completed % 255) }
            }));
            completed++;
        }
        await Promise.all(batch);
    }

    const duration = Date.now() - startTime;
    console.log(`Finished ${totalWrites} writes in ${duration}ms`);
    console.log(`Average write speed: ${(totalWrites / (duration / 1000)).toFixed(2)} ops/sec`);
}

runBenchmark().catch(console.error);
