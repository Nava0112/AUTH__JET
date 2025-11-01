const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');

async function fixPrivateKey() {
  console.log('🔧 Fixing Missing Private Key...\n');
  
  const keysDir = path.join(__dirname, 'keys');
  const privateKeyPath = path.join(keysDir, 'private.key');
  const publicKeyPath = path.join(keysDir, 'public.key');

  // Step 1: Check current state
  console.log('1. Checking current key files...');
  const privateKeyExists = fs.existsSync(privateKeyPath);
  const publicKeyExists = fs.existsSync(publicKeyPath);
  
  console.log('   Private key exists:', privateKeyExists);
  console.log('   Public key exists: ', publicKeyExists);

  if (!privateKeyExists) {
    console.log('   ❌ Private key is MISSING - this is the problem!');
  }
  console.log('');

  // Step 2: Generate new key pair
  console.log('2. Generating new RSA key pair...');
  const generateKeyPair = promisify(crypto.generateKeyPair);
  
  try {
    const { privateKey, publicKey } = await generateKeyPair('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8', 
        format: 'pem',
      },
    });

    // Step 3: Save both keys
    console.log('3. Saving new keys...');
    if (!fs.existsSync(keysDir)) {
      fs.mkdirSync(keysDir, { recursive: true });
    }

    fs.writeFileSync(privateKeyPath, privateKey);
    fs.writeFileSync(publicKeyPath, publicKey); // Overwrite public key to match
    console.log('   ✅ New key pair saved successfully');

    // Step 4: Verify the keys
    console.log('4. Verifying new keys...');
    const savedPrivateKey = fs.readFileSync(privateKeyPath, 'utf8').trim();
    const savedPublicKey = fs.readFileSync(publicKeyPath, 'utf8').trim();

    console.log('   Private key format:', 
      savedPrivateKey.includes('BEGIN PRIVATE KEY') ? '✅ Valid PEM' : '❌ Invalid');
    console.log('   Public key format: ', 
      savedPublicKey.includes('BEGIN PUBLIC KEY') ? '✅ Valid PEM' : '❌ Invalid');
    console.log('   Private key length:', savedPrivateKey.length);
    console.log('   Public key length: ', savedPublicKey.length);

    console.log('\n🎉 Private key fix completed successfully!');
    console.log('\n📋 New Key Files:');
    console.log('   Private: backend/keys/private.key');
    console.log('   Public:  backend/keys/public.key');

  } catch (error) {
    console.error('❌ Failed to generate new keys:', error.message);
    process.exit(1);
  }
}

fixPrivateKey();