// AUTH PLACEHOLDER — the ONLY file to change when real login is added.
// Everything else reads `req.user.id`, and every query is already scoped by owner_id.
// Later: verify a JWT / session cookie here and set req.user from it.
const DEFAULT_USER = { id: 'default-user', name: 'Priya', role: 'user' };

export function requireUser(req, _res, next) {
  req.user = DEFAULT_USER;
  next();
}
