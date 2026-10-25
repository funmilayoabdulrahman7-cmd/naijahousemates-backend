const Datastore = require('nedb-promises');
const path = require('path');

const dataDir = path.join(__dirname, 'data');
const evictionsDb = Datastore.create({ filename: path.join(dataDir, 'evictions.db'), autoload: true });

async function handleCommand() {
    const args = process.argv.slice(2);
    const command = args[0];
    const title = args[1];

    if (command === 'open') {
        if (!title) {
            console.log('❌ Error: Please specify a week title. Example: node admin.js open "Week 1"');
            process.exit(1);
        }
        await evictionsDb.remove({}, { multi: true });
        await evictionsDb.insert({ active: true, weekTitle: title });
        console.log(`✅ Voting window is now OPEN for: "${title}"`);
    } else if (command === 'close') {
        await evictionsDb.remove({}, { multi: true });
        await evictionsDb.insert({ active: false, weekTitle: 'Voting Window Closed' });
        console.log('🔒 Voting window has been CLOSED successfully.');
    } else {
        console.log('📋 Usage Commands:\n  node admin.js open "Week Title"\n  node admin.js close');
    }
    process.exit(0);
}

handleCommand().catch(err => {
    console.error('Admin control execution failed:', err);
    process.exit(1);
});
