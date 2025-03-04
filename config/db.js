const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: "localhost",
  user: "tu_usuario_db",
  password: "tu_password_db",
  database: "tu_nombre_db",
});

module.exports = pool;
