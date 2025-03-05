const express = require("express");
const cookieParser = require("cookie-parser");
const { google } = require("googleapis");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const userRoutes = require("./routes/userRoutes");
const authMiddleware = require("./middlewares/authMiddleware");
const { OAuth2Client } = require("google-auth-library");

const app = express();

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// Configuración de autenticación para Google Drive
const auth = new google.auth.GoogleAuth({
  keyFile: "./aguas-servicio-drive.json",
  scopes: ["https://www.googleapis.com/auth/drive.readonly"],
});

const drive = google.drive({ version: "v3", auth });

// Inicializar el cliente de OAuth2 para verificar tokens de Google
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Función para generar JWT
function generateJWT(userId) {
  return jwt.sign({ userId }, "tu-clave-secreta", { expiresIn: "1h" });
}

// Función para obtener imágenes por clientId
async function getImagesByClientId(clientId) {
  const folderId = "1amVmSFsv-BoSGec_3jXmuoNtMcezV--U";
  const query = `'${folderId}' in parents and name contains '${clientId}_'`;

  const res = await drive.files.list({
    q: query,
    fields: "files(id, name, createdTime, modifiedTime, mimeType)",
  });

  return res.data.files.map((file) => ({
    id: file.id,
    name: file.name,
    createdTime: file.createdTime,
    modifiedTime: file.modifiedTime,
    mimeType: file.mimeType,
  }));
}

// Endpoint de autenticación: Login (no usado en el frontend actual)
app.post("/auth/login", (req, res) => {
  const { token, email } = req.body;
  if (!token || !email) {
    return res.status(400).json({ error: "Token y email son requeridos" });
  }

  try {
    const decoded = jwt.decode(token);
    if (!decoded) {
      return res.status(401).json({ error: "Token inválido" });
    }

    res.cookie("accessToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 3600000,
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Error al procesar el token" });
  }
});

// Endpoint de logout: Borra la cookie
app.post("/auth/logout", (req, res) => {
  res.clearCookie("accessToken");
  res.json({ success: true });
});

// Endpoint de imágenes (protegidos)
app.get("/get-images", authMiddleware, async (req, res) => {
  const clientId = req.query.clientId;
  if (!clientId) return res.status(400).json({ error: "Falta el clientId" });

  try {
    const images = await getImagesByClientId(clientId);
    res.json(images);
  } catch (error) {
    console.error("Error obteniendo imágenes:", error);
    res.status(500).json({ error: "Error al obtener imágenes" });
  }
});

// Endpoint de login con Google
app.post("/auth/google-login", async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, error: "Token requerido" });
  }

  try {
    // Verificar el token con Google
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const userId = payload.sub;

    // Generar token de sesión (JWT)
    const jwtToken = generateJWT(userId);

    // Establecer cookie HttpOnly
    res.cookie("accessToken", jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 3600000,
    });

    return res.status(200).json({ success: true, token: jwtToken });
  } catch (error) {
    console.error("Error en la autenticación:", error);
    return res
      .status(500)
      .json({ success: false, error: "Error en la autenticación" });
  }
});

app.get("/api/drive-file", authMiddleware, async (req, res) => {
  const fileId = req.query.fileId;
  if (!fileId) {
    return res.status(400).send("Falta el parámetro fileId");
  }

  try {
    const file = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" }
    );
    res.setHeader("Content-Type", "image/jpeg");
    return res.send(Buffer.from(file.data));
  } catch (error) {
    console.error("Error al obtener archivo de Drive:", error);
    return res.status(500).send("No se pudo obtener el archivo de Drive");
  }
});

app.use("/users", authMiddleware, userRoutes);

app.listen(5000, () => console.log("Servidor en http://localhost:5000"));
