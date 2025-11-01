// scripts/generate-keys-for-existing-clients.js
const ClientKeyService = require('../src/services/clientKey.service');
const database = require('../src/utils/database');

async function generateKeysForExistingClients() {
  try {
    const clients = await database.query('SELECT id FROM clients');
    
    for (const client of clients.rows) {
      try {
        const keyPair = await ClientKeyService.generateKeyPair(client.id);
        console.log(`Generated key pair for client ${client.id}: ${keyPair.keyId}`);
      } catch (error) {
        console.error(`Failed to generate key for client ${client.id}:`, error.message);
      }
    }
  } catch (error) {
    console.error('Script failed:', error);
  }
}

generateKeysForExistingClients();