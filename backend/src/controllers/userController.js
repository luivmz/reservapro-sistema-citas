export function createUserController(userService) {
  return {
    list(req, res) {
      res.status(200).json(userService.list(req.auth, req.query));
    },
    get(req, res) {
      res.status(200).json({ data: userService.get(req.auth, req.params.id) });
    },
    async create(req, res) {
      const user = await userService.create(req.auth, req.body ?? {});
      res.status(201).json({ data: user });
    },
    async update(req, res) {
      const user = await userService.update(req.auth, req.params.id, req.body ?? {});
      res.status(200).json({ data: user });
    },
    deactivate(req, res) {
      userService.deactivate(req.auth, req.params.id);
      res.status(204).send();
    },
  };
}
