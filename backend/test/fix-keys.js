const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');

async function fixKeys() {
  console.log('🔧 Fixing JWT Keys...\n');
  
  const keysDir = path.join(__dirname, 'keys');
  const privateKeyPath = path.join(keysDir, 'private.key');
  const publicKeyPath = path.join(keysDir, 'public.key');

  // Step 1: Backup and remove corrupted keys
  console.log('1. Removing corrupted keys...');
  if (fs.existsSync(privateKeyPath)) {
    const backupPath = privateKeyPath + '.backup';
    fs.copyFileSync(privateKeyPath, backupPath);
    fs.unlinkSync(privateKeyPath);
    console.log('   ✅ Private key backed up and removed');
  }

  if (fs.existsSync(publicKeyPath)) {
    const backupPath = publicKeyPath + '.backup';
    fs.copyFileSync(publicKeyPath, backupPath);
    fs.unlinkSync(publicKeyPath);
    console.log('   ✅ Public key backed up and removed');
  }

  // Step 2: Generate new RSA key pair
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

    // Step 3: Save new keys
    console.log('3. Saving new keys...');
    if (!fs.existsSync(keysDir)) {
      fs.mkdirSync(keysDir, { recursive: true });
    }

    fs.writeFileSync(privateKeyPath, privateKey);
    fs.writeFileSync(publicKeyPath, publicKey);
    console.log('   ✅ New keys saved successfully');

    // Step 4: Verify the new keys work
    console.log('4. Verifying new keys...');
    const testPublicKey = crypto.createPublicKey(publicKey);
    const testPrivateKey = crypto.createPrivateKey(privateKey);
    console.log('   ✅ New keys are valid and working');

    console.log('\n🎉 Key fix completed successfully!');
    console.log('\n📋 New Key Info:');
    console.log('   Private Key:', privateKeyPath);
    console.log('   Public Key: ', publicKeyPath);
    console.log('   Key Size:   2048 bits');
    console.log('   Algorithm:  RS256');

  } catch (error) {
    console.error('❌ Failed to generate new keys:', error.message);
    process.exit(1);
  }
}

fixKeys();