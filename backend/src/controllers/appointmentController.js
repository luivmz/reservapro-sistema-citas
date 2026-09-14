export function createAppointmentController(service) {
  return {
    list(req, res) {
      res.status(200).json(service.list(req.auth, req.query));
    },
    get(req, res) {
      res.status(200).json({ data: service.get(req.auth, req.params.id) });
    },
    create(req, res) {
      res.status(201).json({ data: service.create(req.auth, req.body ?? {}) });
    },
    update(req, res) {
      res.status(200).json({ data: service.updateDetails(req.auth, req.params.id, req.body ?? {}) });
    },
    reschedule(req, res) {
      res.status(200).json({ data: service.reschedule(req.auth, req.params.id, req.body ?? {}) });
    },
    cancel(req, res) {
      res.status(200).json({ data: service.cancel(req.auth, req.params.id) });
    },
    changeStatus(req, res) {
      res.status(200).json({ data: service.changeStatus(req.auth, req.params.id, req.body?.status) });
    },
  };
}
