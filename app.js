// server.js
const express = require("express");
const cookieParser = require("cookie-parser");
const { google } = require("googleapis");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const userRoutes = require("./routes/userRoutes");
const authMiddleware = require("./middlewares/authMiddleware");
const { OAuth2Client } = require("google-auth-library");
const pool = require("./config/db"); // Conexión a la DB
require("dotenv").config();

const app = express();

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// Verificar que las variables de entorno están definidas
if (!process.env.GOOGLE_CLIENT_ID || !process.env.JWT_SECRET) {
  console.error("❌ Faltan variables de entorno en .env");
  process.exit(1);
}

// Inicializar cliente OAuth2
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Generar JWT seguro
function generateJWT(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "1h" });
}

// Login con Google
app.post("/auth/google-login", async (req, res) => {
  const { token } = req.body;
  console.log("🔹 Recibí token de frontend:", token);

  if (!token) {
    return res.status(400).json({ success: false, error: "Token requerido" });
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    console.log("🔹 Payload decodificado:", payload);

    const userEmail = payload.email; // Email del usuario desde Google
    if (!userEmail) {
      return res
        .status(400)
        .json({ success: false, error: "Usuario inválido" });
    }

    // 🔹 Verificar si el usuario existe en la base de datos
    const [rows] = await pool.query("SELECT * FROM usuarios WHERE email = ?", [
      userEmail,
    ]);

    if (rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: "Acceso denegado: usuario no autorizado xxxxxxxx",
      });
    }

    // Si el usuario existe, generar un JWT
    const jwtToken = generateJWT(rows[0].id);

    res.cookie("accessToken", jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 3600000,
    });

    return res.status(200).json({ success: true, token: jwtToken });
  } catch (error) {
    console.error("❌ Error en la autenticación con Google:", error.message);
    return res
      .status(500)
      .json({ success: false, error: "Error en la autenticación" });
  }
});

app.use("/users", authMiddleware, userRoutes);

app.listen(5000, () => console.log("🚀 Servidor en http://localhost:5000"));
