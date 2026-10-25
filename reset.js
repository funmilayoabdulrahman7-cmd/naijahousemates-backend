const Datastore = require('nedb-promises');
const path = require('path');

const dataDir = path.join(__dirname, 'data');
const housematesDb = Datastore.create({ filename: path.join(dataDir, 'housemates.db'), autoload: true });
const evictionsDb = Datastore.create({ filename: path.join(dataDir, 'evictions.db'), autoload: true });
const votesDb = Datastore.create({ filename: path.join(dataDir, 'votes.db'), autoload: true });

async function runReset() {
    const args = process.argv.slice(2);
    const nextWeekTitle = args[0];

    if (!nextWeekTitle) {
        console.log('❌ Error: Please specify the new week title.\nExample: node reset.js "Eviction Week 2"');
        process.exit(1);
    }

    try {
        const finalStandings = await housematesDb.find({});
        const compactStandings = finalStandings.map(hm => ({ name: hm.name, finalVotes: hm.votes || 0 }));
        
        const currentActive = await evictionsDb.findOne({ active: true });
        const concludedTitle = currentActive ? currentActive.weekTitle : "Concluded Week";
        
        await evictionsDb.insert({
            active: false,
            weekTitle: concludedTitle,
            archivedAt: new Date(),
            standings: compactStandings,
            isArchive: true
        });
        console.log(`📦 Archived final results for: "${concludedTitle}"`);

        await votesDb.remove({}, { multi: true });

        await housematesDb.update({}, { $set: { votes: 0 } }, { multi: true });
        console.log('🧹 Live vote metrics reset to 0 for all contestants.');

        await evictionsDb.remove({ isArchive: { $exists: false } }, { multi: true });
        await evictionsDb.insert({ active: true, weekTitle: nextWeekTitle });
        
        console.log(`🚀 Portal successfully rolled over! Now active: "${nextWeekTitle}"`);
        process.exit(0);
    } catch (err) {
        console.error('Reset rollover operation failed:', err);
        process.exit(1);
    }
}

runReset();