// seeds/00-run-all-seeds.js
exports.seed = async function(knex) {
  // Run seeds in correct order to maintain foreign key constraints
  await require('./01-admins').seed(knex);
  await require('./02-clients').seed(knex);
  await require('./03-users').seed(knex);
  await require('./04-admin-requests').seed(knex);
  await require('./05-audit-logs').seed(knex);
};