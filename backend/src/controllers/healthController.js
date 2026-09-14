export function createHealthController(db) {
  return {
    getHealth(_req, res) {
      db.prepare('SELECT 1 AS healthy').get();
      res.status(200).json({
        data: {
          status: 'ok',
          database: 'ok',
          timestamp: new Date().toISOString(),
        },
      });
    },
  };
}
