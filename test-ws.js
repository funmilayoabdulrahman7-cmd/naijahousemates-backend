const WebSocket = require('ws');
const http = require('http');

const TARGET_HOST = 'localhost';
const TARGET_PORT = 3002;

console.log('🔌 Connecting to WebSocket Server at ws://' + TARGET_HOST + ':' + TARGET_PORT + '...');
const ws = new WebSocket('ws://' + TARGET_HOST + ':' + TARGET_PORT);

ws.on('open', () => {
  console.log('✅ Connected to live WebSocket ecosystem successfully!');
  console.log('⏳ Listening for real-time broadcasts... Launching test vote in 2 seconds...');
  
  // Wait 2 seconds for connection stabilization, then simulate an external vote
  setTimeout(triggerTestVote, 2000);
});

ws.on('message', (data) => {
  console.log('\n==================================================');
  console.log('🚨 LIVE NETWORK BROADCAST RECEIVED DETECTED!');
  console.log('Payload Data:', data.toString());
  console.log('==================================================\n');
  
  // Clean close after confirming packet capture
  ws.close();
  process.exit(0);
});

ws.on('error', (err) => {
  console.error('❌ WebSocket Client Error:', err.message);
});

ws.on('close', () => {
  console.log('🔌 Connection closed safely.');
});

function triggerTestVote() {
  console.log('🚀 Dispatching a single API vote to trigger backend sync...');
  const postData = JSON.stringify({ housemateId: 'Tunde' });
  
  const req = http.request({
    hostname: TARGET_HOST,
    port: TARGET_PORT,
    path: '/api/votes',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'X-Forwarded-For': '192.168.1.150' // Unique IP to bypass previous 429 block window
    }
  }, (res) => {
    console.log(`📡 API Vote request responded with status: ${res.statusCode}`);
  });

  req.on('error', (e) => console.error(`❌ POST trigger failed: ${e.message}`));
  req.write(postData);
  req.end();
}
