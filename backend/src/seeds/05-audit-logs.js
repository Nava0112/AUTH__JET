// seeds/05-audit-logs.js
exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('audit_logs').del();

  // Insert audit logs
  await knex('audit_logs').insert([
    {
      id: 1,
      admin_id: 1,
      action: 'login',
      resource_type: 'admin',
      resource_id: 1,
      metadata: JSON.stringify({
        user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        location: 'New York, US'
      }),
      ip_address: '192.168.1.100',
      user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      created_at: new Date('2024-01-20 09:00:00')
    },
    {
      id: 2,
      admin_id: 1,
      action: 'create_client',
      resource_type: 'client',
      resource_id: 1,
      metadata: JSON.stringify({
        client_name: 'Tech Corp Inc',
        organization: 'Tech Corporation'
      }),
      ip_address: '192.168.1.100',
      user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      created_at: new Date('2024-01-20 09:15:00')
    },
    {
      id: 3,
      client_id: 1,
      action: 'login',
      resource_type: 'client',
      resource_id: 1,
      metadata: JSON.stringify({
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        location: 'San Francisco, US'
      }),
      ip_address: '10.0.0.50',
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      created_at: new Date('2024-01-20 10:30:00')
    },
    {
      id: 4,
      user_id: 1,
      action: 'register',
      resource_type: 'user',
      resource_id: 1,
      metadata: JSON.stringify({
        application: 'Tech Corp Web App',
        role: 'admin'
      }),
      ip_address: '172.16.1.200',
      user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
      created_at: new Date('2024-01-20 11:00:00')
    },
    {
      id: 5,
      admin_id: 2,
      action: 'review_admin_request',
      resource_type: 'admin_request',
      resource_id: 2,
      metadata: JSON.stringify({
        request_email: 'reviewed.admin@org.com',
        decision: 'approved',
        reason: 'Valid business need'
      }),
      ip_address: '192.168.1.101',
      user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      created_at: new Date('2024-01-12 09:15:00')
    }
  ]);
};