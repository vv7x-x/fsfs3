const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// @route   GET api/reels
router.get('/', async (req, res) => {
    const db = req.app.get('db');
    try {
        const result = await db.query(`
            SELECT reels.*, users.username, users.avatar 
            FROM reels 
            JOIN users ON reels.user_id = users.id 
            ORDER BY reels.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST api/reels
router.post('/', auth, async (req, res) => {
    const { url, caption } = req.body;
    const db = req.app.get('db');
    try {
        const result = await db.query(
            'INSERT INTO reels (user_id, url, caption) VALUES ($1, $2, $3) RETURNING *',
            [req.user.id, url, caption]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
