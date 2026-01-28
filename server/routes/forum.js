const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// @route   GET api/forum/posts
router.get('/posts', async (req, res) => {
    const db = req.app.get('db');
    try {
        const result = await db.query(`
            SELECT posts.*, users.username, users.avatar 
            FROM posts 
            JOIN users ON posts.user_id = users.id 
            ORDER BY posts.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST api/forum/posts
router.post('/posts', auth, async (req, res) => {
    const { title, content, category } = req.body;
    const db = req.app.get('db');
    try {
        const result = await db.query(
            'INSERT INTO posts (user_id, title, content, category) VALUES ($1, $2, $3, $4) RETURNING *',
            [req.user.id, title, content, category]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET api/forum/posts/:id
router.get('/posts/:id', async (req, res) => {
    const db = req.app.get('db');
    try {
        const result = await db.query(`
            SELECT posts.*, users.username, users.avatar 
            FROM posts 
            JOIN users ON posts.user_id = users.id 
            WHERE posts.id = $1
        `, [req.params.id]);

        if (result.rows.length === 0) return res.status(404).json({ msg: 'Post not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET api/forum/posts/:id/comments
router.get('/posts/:id/comments', async (req, res) => {
    const db = req.app.get('db');
    try {
        const result = await db.query(`
            SELECT comments.*, users.username, users.avatar 
            FROM comments 
            JOIN users ON comments.user_id = users.id 
            WHERE comments.post_id = $1 
            ORDER BY comments.created_at ASC
        `, [req.params.id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST api/forum/posts/:id/comments
router.post('/posts/:id/comments', auth, async (req, res) => {
    const { content } = req.body;
    const db = req.app.get('db');
    try {
        const result = await db.query(
            'INSERT INTO comments (post_id, user_id, content) VALUES ($1, $2, $3) RETURNING *',
            [req.params.id, req.user.id, content]
        );
        // Fetch user info for return
        const userRes = await db.query('SELECT username, avatar FROM users WHERE id = $1', [req.user.id]);
        res.json({ ...result.rows[0], ...userRes.rows[0] });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
