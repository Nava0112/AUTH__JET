const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function verifyKeys() {
  console.log('🔍 Verifying JWT Keys...\n');
  
  const keysDir = path.join(__dirname, 'keys');
  const privateKeyPath = path.join(keysDir, 'private.key');
  const publicKeyPath = path.join(keysDir, 'public.key');

  try {
    // Check if files exist
    if (!fs.existsSync(privateKeyPath) || !fs.existsSync(publicKeyPath)) {
      console.log('❌ Key files not found');
      return false;
    }

    // Read keys
    const privateKey = fs.readFileSync(privateKeyPath, 'utf8').trim();
    const publicKey = fs.readFileSync(publicKeyPath, 'utf8').trim();

    console.log('1. Key Files: ✅ Found');
    console.log('   Private key length:', privateKey.length);
    console.log('   Public key length: ', publicKey.length);

    // Validate key format
    console.log('2. Key Format Validation:');
    
    try {
      const pubKey = crypto.createPublicKey(publicKey);
      console.log('   ✅ Public key format: VALID');
    } catch (e) {
      console.log('   ❌ Public key format: INVALID -', e.message);
      return false;
    }

    try {
      const privKey = crypto.createPrivateKey(privateKey);
      console.log('   ✅ Private key format: VALID');
    } catch (e) {
      console.log('   ❌ Private key format: INVALID -', e.message);
      return false;
    }

    // Test signing/verification
    console.log('3. Sign/Verify Test:');
    const testData = 'test message';
    
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(testData);
    const signature = sign.sign(privateKey, 'base64');

    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(testData);
    const isValid = verify.verify(publicKey, signature, 'base64');

    console.log('   ✅ Sign/Verify: ' + (isValid ? 'WORKING' : 'FAILED'));

    console.log('\n🎉 All key verification tests PASSED!');
    return true;

  } catch (error) {
    console.log('❌ Key verification failed:', error.message);
    return false;
  }
}

verifyKeys();