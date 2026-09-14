export function createAuthController(authService) {
  return {
    async register(req, res) {
      const result = await authService.register(req.body ?? {});
      res.status(201).json({ data: result });
    },
    async login(req, res) {
      const result = await authService.login(req.body ?? {});
      res.status(200).json({ data: result });
    },
    me(req, res) {
      res.status(200).json({ data: authService.me(req.auth) });
    },
  };
}
