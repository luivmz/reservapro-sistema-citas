export function createEmployeeOfferingController(service) {
  return {
    list(req, res) {
      res.status(200).json({ data: service.list(req.auth, req.params.id) });
    },
    replace(req, res) {
      res.status(200).json({ data: service.replace(req.auth, req.params.id, req.body ?? {}) });
    },
  };
}
