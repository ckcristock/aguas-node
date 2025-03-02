require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();

// Configurar middleware
app.use(cors());
app.use(express.json()); // Permite recibir JSON en las peticiones

// Ruta de prueba
app.get("/", (req, res) => {
  res.send("Servidor funcionando 🚀");
});

// Definir el puerto
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
