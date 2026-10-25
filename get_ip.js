const os = require('os');
const interfaces = os.networkInterfaces();
let found = false;

for (const name in interfaces) {
    for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
            console.log(`\n🔗 Shareable Voting Link: http://${iface.address}:3000`);
            console.log(`🛠️ Admin Dashboard Link: http://${iface.address}:3000/admin.html\n`);
            found = true;
        }
    }
}

if (!found) {
    console.log('\n❌ No external IP found. Ensure your phone Wi-Fi or Hotspot is turned ON.\n');
}
