const express = require("express");
const { google } = require("googleapis");
const cors = require("cors");

const app = express();
app.use(cors());

// Autenticación con la cuenta de servicio
const auth = new google.auth.GoogleAuth({
  keyFile: "./aguas-servicio-drive.json", // Reemplaza con el archivo JSON de la cuenta de servicio
  scopes: ["https://www.googleapis.com/auth/drive.readonly"],
});

const drive = google.drive({ version: "v3", auth });

// Función para buscar imágenes por ID de cliente
async function getImagesByClientId(clientId) {
  const folderId = "1amVmSFsv-BoSGec_3jXmuoNtMcezV--U"; // Reemplaza con el ID de la carpeta en Drive
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

// Endpoint para recibir solicitudes desde React
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

app.listen(5000, () => console.log("Servidor en http://localhost:5000"));
