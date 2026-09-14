export function createAvailabilityController(service) {
  return {
    get(req, res) {
      res.status(200).json({ data: service.get(req.auth, req.query) });
    },
  };
}
