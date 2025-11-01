const fs = require('fs');
const path = require('path');

function checkKeys() {
  console.log('🔑 Checking JWT Key Files...\n');
  
  const keysDir = path.join(__dirname, 'keys');
  const privateKeyPath = path.join(keysDir, 'private.key');
  const publicKeyPath = path.join(keysDir, 'public.key');

  console.log('1. File Existence:');
  console.log('   Private Key:', fs.existsSync(privateKeyPath) ? '✅ EXISTS' : '❌ MISSING');
  console.log('   Public Key: ', fs.existsSync(publicKeyPath) ? '✅ EXISTS' : '❌ MISSING');
  console.log('');

  if (fs.existsSync(privateKeyPath)) {
    const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
    console.log('2. Private Key Analysis:');
    console.log('   Length:', privateKey.length, 'characters');
    console.log('   Format:', 
      privateKey.includes('BEGIN PRIVATE KEY') ? '✅ PEM Format' : '❌ Not PEM');
    console.log('   Preview:', privateKey.substring(0, 50) + '...');
    console.log('');
  }

  if (fs.existsSync(publicKeyPath)) {
    const publicKey = fs.readFileSync(publicKeyPath, 'utf8');
    console.log('3. Public Key Analysis:');
    console.log('   Length:', publicKey.length, 'characters');
    console.log('   Format:', 
      publicKey.includes('BEGIN PUBLIC KEY') ? '✅ PEM Format' : '❌ Not PEM');
    console.log('   Preview:', publicKey.substring(0, 50) + '...');
    console.log('');
  }

  console.log('4. Recommendation:');
  if (!fs.existsSync(privateKeyPath)) {
    console.log('   ❌ RUN: node fix-private-key.js to generate missing private key');
  } else if (!fs.existsSync(publicKeyPath)) {
    console.log('   ❌ RUN: node fix-private-key.js to generate missing public key');
  } else {
    console.log('   ✅ Key files look good! Run: node test-jwt-fix.js');
  }
}

checkKeys();