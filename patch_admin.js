const fs = require('fs');
const path = require('path');

// 1. Append the new Admin Endpoints right above the server listener in server.js
let serverCode = fs.readFileSync('server.js', 'utf8');

const adminRoutes = `
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
`;

if (!serverCode.includes('/api/admin/open')) {
    serverCode = serverCode.replace("app.listen(PORT", adminRoutes + "\napp.listen(PORT");
    serverCode = serverCode.replace("server.listen(PORT", adminRoutes + "\nserver.listen(PORT");
    fs.writeFileSync('server.js', serverCode, 'utf8');
    console.log('✅ server.js patched successfully.');
}

// 2. Build the public/admin.html dashboard panel view cleanly
const adminHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Naija Voting - Admin Panel</title>
    <style>
        :root { --bg-color: #0d0f12; --card-bg: #161a22; --accent-color: #00e676; --text-color: #ffffff; --text-muted: #8b949e; --danger-color: #ff1744; --warn-color: #ff9100; }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, sans-serif; }
        body { background-color: var(--bg-color); color: var(--text-color); padding: 16px; }
        header { text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #21262d; }
        h1 { color: var(--accent-color); font-size: 1.4rem; }
        .panel { background: var(--card-bg); border-radius: 12px; padding: 16px; border: 1px solid #21262d; margin-bottom: 20px; }
        .title { font-size: 1.1rem; font-weight: bold; margin-bottom: 12px; color: var(--accent-color); }
        .status-badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 0.85rem; margin-top: 4px; }
        .status-badge.open { background: rgba(0, 230, 118, 0.15); color: var(--accent-color); }
        .status-badge.closed { background: rgba(255, 23, 68, 0.15); color: var(--danger-color); }
        input { width: 100%; padding: 10px; background: #30363d; border: 1px solid #21262d; color: #fff; border-radius: 6px; font-size: 0.9rem; margin-bottom: 12px; }
        button { width: 100%; padding: 12px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; color: #000; font-size: 0.95rem; margin-bottom: 10px; }
        .btn-open { background: var(--accent-color); }
        .btn-close { background: var(--warn-color); }
        .btn-reset { background: var(--danger-color); color: #fff; }
    </style>
</head>
<body>
    <header>
        <h1>Naija Control Panel</h1>
        <div id="live-status">Loading Status...</div>
    </header>
    <div class="panel">
        <div class="title">Toggle Window Status</div>
        <input type="text" id="open-title" placeholder="e.g. Eviction Week 3">
        <button class="btn-open" onclick="openVoting()">OPEN VOTING WINDOW</button>
        <button class="btn-close" onclick="closeVoting()">CLOSE VOTING WINDOW</button>
    </div>
    <div class="panel">
        <div class="title">Weekly Rollover Reset</div>
        <input type="text" id="next-title" placeholder="e.g. Eviction Week 4">
        <button class="btn-reset" onclick="resetVoting()">ARCHIVE & ROLLOVER PORTAL</button>
    </div>
    <script>
        async function getStatus() {
            const res = await fetch('/api/evictions/active');
            const data = await res.json();
            const statusEl = document.getElementById('live-status');
            if(data.active) {
                statusEl.innerHTML = 'Active Window: <strong>' + data.weekTitle + '</strong> <span class="status-badge open">OPEN</span>';
            } else {
                statusEl.innerHTML = 'Active Window: <strong>' + data.weekTitle + '</strong> <span class="status-badge closed">CLOSED</span>';
            }
        }
        async function openVoting() {
            const title = document.getElementById('open-title').value;
            if(!title) return alert('Enter a week title');
            await fetch('/api/admin/open', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ title }) });
            getStatus();
        }
        async function closeVoting() {
            await fetch('/api/admin/close', { method: 'POST' });
            getStatus();
        }
        async function resetVoting() {
            const nextTitle = document.getElementById('next-title').value;
            if(!nextTitle) return alert('Enter the next week title');
            if(!confirm('Are you sure you want to wipe live counters and rollover?')) return;
            await fetch('/api/admin/reset', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ nextTitle }) });
            document.getElementById('next-title').value = '';
            getStatus();
        }
        window.onload = getStatus;
    </script>
</body>
</html>`;
fs.writeFileSync(path.join('public', 'admin.html'), adminHtml, 'utf8');
console.log('✅ admin.html written successfully.');

// 3. Update public/index.html to handle STATUS_CHANGE live events safely
let indexHtml = fs.readFileSync(path.join('public', 'index.html'), 'utf8');
if (!indexHtml.includes('STATUS_CHANGE')) {
    indexHtml = indexHtml.replace(
        "const message = JSON.parse(event.data);",
        "const message = JSON.parse(event.data);\n            if (message.type === 'STATUS_CHANGE') { checkLockdownStatus(); loadHousemates(); }"
    );
    fs.writeFileSync(path.join('public', 'index.html'), indexHtml, 'utf8');
    console.log('✅ public/index.html updated for live listening.');
}
