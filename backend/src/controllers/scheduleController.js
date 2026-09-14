export function createScheduleController(service) {
  return {
    list(req, res) {
      res.status(200).json({ data: service.list(req.auth, req.params.id) });
    },
    create(req, res) {
      res.status(201).json({ data: service.create(req.auth, req.params.id, req.body ?? {}) });
    },
    update(req, res) {
      res.status(200).json({
        data: service.update(req.auth, req.params.id, req.params.scheduleId, req.body ?? {}),
      });
    },
    remove(req, res) {
      service.remove(req.auth, req.params.id, req.params.scheduleId);
      res.status(204).send();
    },
  };
}
