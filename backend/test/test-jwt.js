const jwt = require('../src/services/jwt.service');

console.log('=== JWT Service Info ===');
console.log('Algorithm:', jwt.algorithm);
console.log('Service file:', require.resolve('./src/services/jwt.service'));
console.log('Has getPublicJwk:', typeof jwt.getPublicJwk === 'function');
console.log('====================');
