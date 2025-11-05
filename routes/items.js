// CRUD routes for items table: id, name, data(jsonb)
const express = require('express');

module.exports = (pool) => {
  const router = express.Router();

  // Create
  router.post('/', async (req, res) => {
    const { name, data } = req.body;
    const result = await pool.query(
      'INSERT INTO items (name, data) VALUES ($1, $2) RETURNING *',
      [name, data || null]
    );
    res.status(201).json(result.rows[0]);
  });

  // Read all
  router.get('/', async (req, res) => {
    const result = await pool.query('SELECT * FROM items ORDER BY id');
    res.json(result.rows);
  });

  // Read one
  router.get('/:id', async (req, res) => {
    const result = await pool.query('SELECT * FROM items WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.json(result.rows[0]);
  });

  // Update
  router.put('/:id', async (req, res) => {
    const { name, data } = req.body;
    const result = await pool.query('UPDATE items SET name=$1, data=$2 WHERE id=$3 RETURNING *', [name, data, req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.json(result.rows[0]);
  });

  // Delete
  router.delete('/:id', async (req, res) => {
    const result = await pool.query('DELETE FROM items WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.json({ deleted: true });
  });

  return router;
};

