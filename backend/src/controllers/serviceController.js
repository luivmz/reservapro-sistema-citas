export function createServiceController(service) {
  return {
    list: (req, res) => res.status(200).json(service.list(req.auth, req.query)),
    get: (req, res) => res.status(200).json({ data: service.get(req.auth, req.params.id) }),
    create: (req, res) => res.status(201).json({ data: service.create(req.auth, req.body ?? {}) }),
    update: (req, res) => res.status(200).json({ data: service.update(req.auth, req.params.id, req.body ?? {}) }),
    deactivate(req, res) {
      service.deactivate(req.auth, req.params.id);
      res.status(204).send();
    },
  };
}
