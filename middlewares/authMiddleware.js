const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
  const token = req.cookies.accessToken;
  if (!token) {
    return res.status(401).json({ error: "No autenticado" });
  }

  try {
    // 🔹 Verifica el token antes de pasar al siguiente middleware
    const decoded = jwt.decode(token);
    if (!decoded) {
      return res.status(403).json({ error: "Token inválido" });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: "Error al validar el token" });
  }
}

module.exports = authMiddleware;
