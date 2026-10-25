const fs = require('fs');
const path = require('path');

const fileContent = `const express = require('express');
const Datastore = require('nedb-promises');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const dataDir = path.join(__dirname, 'data');
const housematesDb = Datastore.create({ filename: path.join(dataDir, 'housemates.db'), autoload: true });
const evictionsDb = Datastore.create({ filename: path.join(dataDir, 'evictions.db'), autoload: true });
const votesDb = Datastore.create({ filename: path.join(dataDir, 'votes.db'), autoload: true });

const voteTracker = {}; 
setInterval(() => {
    for (const ip in voteTracker) delete voteTracker[ip];
}, 60000);

app.get('/api/evictions/active', async (req, res) => {
    try {
        const status = await evictionsDb.findOne({});
        res.json(status || { active: false, weekTitle: "Voting Window Closed" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/housemates', async (req, res) => {
    try {
        const housemates = await housematesDb.find({});
        res.json(housemates);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/votes', async (req, res) => {
    try {
        const activeStatus = await evictionsDb.findOne({});
        if (!activeStatus || !activeStatus.active) {
            return res.status(403).json({ error: "Voting window is closed." });
        }

        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        if (!voteTracker[clientIp]) voteTracker[clientIp] = 0;
        
        if (voteTracker[clientIp] >= 3) {
            return res.status(429).json({ error: "Too many requests" });
        }

        const { housemateId } = req.body;
        if (!housemateId) return res.status(400).json({ error: "Missing housemate ID" });

        await housematesDb.update({ _id: housemateId }, { $inc: { votes: 1 } });
        await votesDb.insert({ housemateId, ip: clientIp, timestamp: new Date() });
        
        voteTracker[clientIp]++;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log('[boot] Naija Housemates server live on port ' + PORT);
});`;

fs.writeFileSync(path.join(__dirname, 'server.js'), fileContent, 'utf8');
console.log('✅ server.js rewritten successfully with clean syntax.');
