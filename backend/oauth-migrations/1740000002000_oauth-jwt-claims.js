exports.up = (pgm) => {
  pgm.addColumn('client_applications', {
    oauth_jwt_claims: {
      type: 'jsonb',
      notNull: true,
      default: pgm.func("'[]'::jsonb")
    }
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('client_applications', 'oauth_jwt_claims');
};
