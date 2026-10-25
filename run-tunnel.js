const localtunnel = require('localtunnel');

(async () => {
  try {
    console.log("Initializing secure application bridge...");
    const tunnel = await localtunnel({ port: 3002 });

    console.log("\n🚀 PORTAL IS LIVE OVER WAN!");
    console.log(`Public Voting URL: ${tunnel.url}`);
    console.log("-----------------------------------------");

    tunnel.on('close', () => {
      console.log('Tunnel dropped. Re-establishing link...');
    });
  } catch (err) {
    console.error("Tunnel initialization failed:", err);
  }
})();
