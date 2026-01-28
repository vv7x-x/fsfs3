const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// @route   GET api/profile
router.get('/', auth, async (req, res) => {
    const db = req.app.get('db');
    try {
        const userRes = await db.query('SELECT username, email, avatar, created_at FROM users WHERE id = $1', [req.user.id]);
        const postsRes = await db.query('SELECT COUNT(*) FROM posts WHERE user_id = $1', [req.user.id]);
        const commentsRes = await db.query('SELECT COUNT(*) FROM comments WHERE user_id = $1', [req.user.id]);

        const profile = {
            ...userRes.rows[0],
            stats: {
                posts: postsRes.rows[0].count,
                comments: commentsRes.rows[0].count
            }
        };
        res.json(profile);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT api/profile
router.put('/', auth, async (req, res) => {
    const { username, avatar } = req.body;
    const db = req.app.get('db');
    try {
        await db.query(
            'UPDATE users SET username = $1, avatar = $2 WHERE id = $3',
            [username, avatar, req.user.id]
        );
        res.json({ msg: 'Profile updated' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
