const http = require('http');

const TARGET_HOST = 'localhost'; 
const TARGET_PORT = 3002;

function fireVote(voteIndex) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({ housemateId: 'Chimezie' });
    
    const req = http.request({
      hostname: TARGET_HOST,
      port: TARGET_PORT,
      path: '/api/votes', // Updated to match standard REST collection plurals
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'X-Forwarded-For': '192.168.1.100'
      }
    }, (res) => {
      console.log(`[Vote #${voteIndex}] Response Status: ${res.statusCode}`);
      resolve(res.statusCode);
    });

    req.on('error', (e) => {
      console.error(`[Vote #${voteIndex}] Failed: ${e.message}`);
      resolve(null);
    });

    req.write(postData);
    req.end();
  });
}

async function runAntiSpamTest() {
  console.log('🚀 Triggering Anti-Spam Stress Test (Targeting 5 votes/min limit)...');
  for (let i = 1; i <= 5; i++) {
    await fireVote(i);
  }
}

runAntiSpamTest();
