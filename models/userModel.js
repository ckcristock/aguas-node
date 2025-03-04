const pool = require("../config/db");

const User = {
  async getAll() {
    const [rows] = await pool.query("SELECT * FROM users");
    return rows;
  },

  async getById(id) {
    const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [id]);
    return rows[0];
  },

  async create(user) {
    const { name, email, role, status } = user;
    const [result] = await pool.query(
      "INSERT INTO users (name, email, role, status) VALUES (?, ?, ?, ?)",
      [name, email, role, status]
    );
    return { id: result.insertId, ...user };
  },

  async update(id, user) {
    const { name, email, role, status } = user;
    await pool.query(
      "UPDATE users SET name = ?, email = ?, role = ?, status = ? WHERE id = ?",
      [name, email, role, status, id]
    );
    return { id, ...user };
  },

  async delete(id) {
    await pool.query("DELETE FROM users WHERE id = ?", [id]);
  },
};

module.exports = User;
