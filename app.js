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

if (!process.env.GOOGLE_CLIENT_ID || !process.env.JWT_SECRET) {
  console.error("❌ Faltan variables de entorno en .env");
  process.exit(1);
}

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function generateJWT(userId, role) {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
}

// Autenticación con Google y validación en BD
app.post("/auth/google-login", async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ success: false, error: "Token requerido" });
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const userEmail = payload.email;
    if (!userEmail) {
      return res
        .status(400)
        .json({ success: false, error: "Usuario inválido" });
    }

    const [rows] = await pool.query("SELECT * FROM usuarios WHERE email = ?", [
      userEmail,
    ]);
    if (rows.length === 0) {
      return res
        .status(403)
        .json({ success: false, error: "Usuario no autorizado" });
    }

    const jwtToken = generateJWT(rows[0].id, rows[0].rol);

    res.cookie("accessToken", jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 3600000,
    });

    return res
      .status(200)
      .json({ success: true, token: jwtToken, rol: rows[0].rol });
  } catch (error) {
    console.error("❌ Error en la autenticación con Google:", error.message);
    return res
      .status(500)
      .json({ success: false, error: "Error en la autenticación" });
  }
});

// Configuración de Google Drive
const auth = new google.auth.GoogleAuth({
  keyFile: "./aguas-servicio-drive.json",
  scopes: ["https://www.googleapis.com/auth/drive.readonly"],
});
const drive = google.drive({ version: "v3", auth });

async function getImagesByClientId(clientId) {
  const folderId = "1amVmSFsv-BoSGec_3jXmuoNtMcezV--U";
  const query = `'${folderId}' in parents and name contains '${clientId}_'`;

  const res = await drive.files.list({
    q: query,
    fields: "files(id, name)",
  });

  return res.data.files.map((file) => ({
    id: file.id,
    name: file.name,
    url: `https://drive.google.com/uc?id=${file.id}`,
  }));
}

// Endpoint protegido para obtener imágenes
app.get("/get-images", authMiddleware, async (req, res) => {
  try {
    const clientId = req.query.clientId;
    if (!clientId) return res.status(400).json({ error: "Falta el clientId" });

    const [user] = await pool.query("SELECT * FROM usuarios WHERE id = ?", [
      req.user.userId,
    ]);
    if (user.length === 0) {
      return res.status(403).json({ error: "Usuario no autorizado" });
    }

    const images = await getImagesByClientId(clientId);
    res.json(images);
  } catch (error) {
    console.error("❌ Error obteniendo imágenes:", error);
    res.status(500).json({ error: "Error al obtener imágenes" });
  }
});

// Endpoint protegido para obtener el archivo de Google Drive
app.get("/api/drive-file", authMiddleware, async (req, res) => {
  const fileId = req.query.fileId;
  if (!fileId) {
    return res.status(400).json({ error: "Falta el fileId" });
  }

  try {
    // Verificar que el usuario autenticado exista en la DB
    const [user] = await pool.query("SELECT * FROM usuarios WHERE id = ?", [
      req.user.userId,
    ]);
    if (user.length === 0) {
      return res.status(403).json({ error: "Usuario no autorizado" });
    }

    // Solicitar el archivo desde Google Drive
    const driveResponse = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "stream" }
    );

    // Transmitir el archivo al cliente
    driveResponse.data
      .on("error", (err) => {
        console.error("Error al transmitir el archivo:", err);
        res.status(500).send("Error en la transmisión del archivo");
      })
      .pipe(res);
  } catch (error) {
    console.error("Error al obtener el archivo de Drive:", error);
    res.status(500).json({ error: "Error al obtener el archivo de Drive" });
  }
});

// Endpoint para obtener el rol del usuario
app.get("/auth/get-role", authMiddleware, (req, res) => {
  const userRole = req.cookies.userRole;
  if (!userRole) {
    return res.status(401).json({ error: "No autenticado" });
  }
  res.json({ role: userRole });
});

app.use("/users", authMiddleware, userRoutes);

app.listen(5000, () => console.log("🚀 Servidor en http://localhost:5000"));
