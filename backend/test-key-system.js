const http = require('http');

console.log('🔍 Simple Server Test\n');

// Test 1: Basic HTTP request to your server
function testServer() {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 8000,
      path: '/',
      method: 'GET',
      timeout: 3000
    }, (res) => {
      console.log('✅ Server responded with status:', res.statusCode);
      resolve(true);
    });

    req.on('error', (error) => {
      console.log('❌ Server connection failed:', error.message);
      resolve(false);
    });

    req.on('timeout', () => {
      console.log('❌ Server connection timeout');
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

// Test 2: Check if port is in use
function checkPort() {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.listen(8000, () => {
      console.log('✅ Port 8000 is available');
      server.close();
      resolve(true);
    });
    
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.log('✅ Port 8000 is in use (server might be running)');
      } else {
        console.log('❌ Port check error:', error.message);
      }
      resolve(false);
    });
  });
}

async function runTests() {
  console.log('1. Checking port 8000...');
  await checkPort();
  
  console.log('\n2. Testing server connection...');
  const serverRunning = await testServer();
  
  if (!serverRunning) {
    console.log('\n💡 TROUBLESHOOTING TIPS:');
    console.log('   • Make sure you ran: npm run dev');
    console.log('   • Check if your server started without errors');
    console.log('   • Try a different port in your .env file');
    console.log('   • Check firewall/antivirus settings');
  }
}

runTests()