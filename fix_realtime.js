const fs = require('fs');
const path = require('path');

// 1. Rewrite Server with WebSocket Support
const serverCode = `const express = require('express');
const Datastore = require('nedb-promises');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const PORT = 3000;
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

server.listen(PORT, () => {
    console.log('[boot] Real-time Sync Server live on port ' + PORT);
});`;

// 2. Inject WebSocket connection script into index.html cleanly
let htmlContent = fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf8');
const wsClientScript = `
        // WebSocket Broadcast Receiver Setup
        const wsProtocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
        const socket = new WebSocket(wsProtocol + window.location.host);
        
        socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.type === 'VOTE_UPDATE') {
                // Instantly sync UI vote counters and leaderboard rankings
                message.housemates.forEach(hm => {
                    const countEl = document.getElementById('vote-count-' + hm._id);
                    if (countEl) countEl.innerText = 'Votes: ' + (hm.votes || 0);
                });
                updateLeaderboard(message.housemates);
            }
        };
`;

// Insert the socket initialization script right before the app init function block
htmlContent = htmlContent.replace('async function init()', wsClientScript + '\n        async function init()');

fs.writeFileSync(path.join(__dirname, 'server.js'), serverCode, 'utf8');
fs.writeFileSync(path.join(__dirname, 'public/index.html'), htmlContent, 'utf8');
console.log('✅ Server and Frontend successfully upgraded with Real-Time WebSocket layers.');
