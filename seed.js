const Datastore = require('nedb-promises');
const fs = require('fs');
const path = require('path');

async function seed() {
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)){
        fs.mkdirSync(dataDir);
    }

    const housematesDb = Datastore.create({ filename: path.join(dataDir, 'housemates.db'), autoload: true });
    const evictionsDb = Datastore.create({ filename: path.join(dataDir, 'evictions.db'), autoload: true });
    const votesDb = Datastore.create({ filename: path.join(dataDir, 'votes.db'), autoload: true });

    // Clear existing data
    await housematesDb.remove({}, { multi: true });
    await evictionsDb.remove({}, { multi: true });

    // Insert baseline contestants
    const initialHousemates = [
        { name: 'Chimezie', votes: 0 },
        { name: 'Funmi', votes: 0 },
        { name: 'Tunde', votes: 0 },
        { name: 'Amaka', votes: 0 }
    ];
    await housematesDb.insert(initialHousemates);
    console.log('✅ Housemates seeded successfully.');

    // Insert initial voting status (Open for Week 1)
    await evictionsDb.insert({ active: true, weekTitle: 'Eviction Week 1' });
    console.log('✅ Voting window initialized to OPEN for Week 1.');

    process.exit(0);
}

seed().catch(err => {
    console.error('Seeding failed:', err);
    process.exit(1);
});
