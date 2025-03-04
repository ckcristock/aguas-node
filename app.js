const express = require("express");
const { google } = require("googleapis");
const cors = require("cors");
const userRoutes = require("./routes/userRoutes");

const app = express();
app.use(cors());
app.use(express.json()); // Para parsear JSON en las peticiones

// Configuración de autenticación para Google Drive
const auth = new google.auth.GoogleAuth({
  keyFile: "./aguas-servicio-drive.json",
  scopes: ["https://www.googleapis.com/auth/drive.readonly"],
});

const drive = google.drive({ version: "v3", auth });

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

// Endpoints de imágenes
app.get("/get-images", async (req, res) => {
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

app.get("/api/drive-file", async (req, res) => {
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

// Rutas para el CRUD de usuarios
app.use("/users", userRoutes);

app.listen(5000, () => console.log("Servidor en http://localhost:5000"));
