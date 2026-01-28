const express = require('express');
const router = express.Router();

// @route   GET api/radio
router.get('/state', async (req, res) => {
    const db = req.app.get('db');
    try {
        const result = await db.query('SELECT * FROM radio_state WHERE id = 1');
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
