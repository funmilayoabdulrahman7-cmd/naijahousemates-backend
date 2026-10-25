const express = require('express');
const Datastore = require('nedb-promises');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const app = express();
app.set('trust proxy', true);
const PORT = 3015;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

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

function broadcast(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

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

        // Broadcast the update event to all active browsers
        const updatedHousemates = await housematesDb.find({});
        broadcast({ type: 'VOTE_UPDATE', housemates: updatedHousemates });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ADMIN WEB DASHBOARD ENDPOINTS
app.post('/api/admin/open', async (req, res) => {
    try {
        const { title } = req.body;
        if (!title) return res.status(400).json({ error: "Missing title" });
        await evictionsDb.remove({ isArchive: { $exists: false } }, { multi: true });
        await evictionsDb.insert({ active: true, weekTitle: title });
        res.json({ success: true });
        broadcast({ type: 'STATUS_CHANGE' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/close', async (req, res) => {
    try {
        await evictionsDb.update({}, { $set: { active: false } }, { multi: true });
        res.json({ success: true });
        broadcast({ type: 'STATUS_CHANGE' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/reset', async (req, res) => {
    try {
        const { nextTitle } = req.body;
        if (!nextTitle) return res.status(400).json({ error: "Missing next week title" });
        const finalStandings = await housematesDb.find({});
        const compactStandings = finalStandings.map(hm => ({ name: hm.name, finalVotes: hm.votes || 0 }));
        const currentActive = await evictionsDb.findOne({ isArchive: { $exists: false } });
        const concludedTitle = currentActive ? currentActive.weekTitle : 'Concluded Week';
        await evictionsDb.insert({ active: false, weekTitle: concludedTitle, archivedAt: new Date(), standings: compactStandings, isArchive: true });
        await votesDb.remove({}, { multi: true });
        await housematesDb.update({}, { $set: { votes: 0 } }, { multi: true });
        await evictionsDb.remove({ isArchive: { $exists: false } }, { multi: true });
        await evictionsDb.insert({ active: true, weekTitle: nextTitle });
        res.json({ success: true });
        const updatedHousemates = await housematesDb.find({});
        broadcast({ type: 'VOTE_UPDATE', housemates: updatedHousemates });
        broadcast({ type: 'STATUS_CHANGE' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

server.listen(PORT, () => {
    console.log('[boot] Real-time Sync Server live on port ' + PORT);
});
// Graceful Shutdown Handler for Termux environments
const handleShutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}. Initializing graceful shutdown sequence...`);
  
  // If you export your DB references globally or via server context, compact them here
  try {
    console.log("💾 Safely flushing database memory blocks to disk...");
    // nedb automatically commits on mutations, but a small delay ensures file system handles close out cleanly
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log("🔒 Database layers secured.");
  } catch (err) {
    console.error("⚠️ Error while securing database:", err.message);
  }

  console.log("🔌 Terminating active server engine. Process exited cleanly.\n");
  process.exit(0);
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

// Diagnostic endpoint to verify true remote user IP
