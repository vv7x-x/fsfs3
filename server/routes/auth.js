const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');

// @route   POST api/auth/register
router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    const db = req.app.get('db');

    try {
        let userResult = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userResult.rows.length > 0) {
            return res.status(400).json({ msg: 'المستخدم موجود بالفعل' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = await db.query(
            'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email, avatar',
            [username, email, hashedPassword]
        );

        const payload = { user: { id: newUser.rows[0].id } };
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
            if (err) throw err;
            res.json({ token, user: newUser.rows[0] });
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST api/auth/login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const db = req.app.get('db');

    try {
        let userResult = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            return res.status(400).json({ msg: 'بيانات الاعتماد غير صالحة' });
        }

        const isMatch = await bcrypt.compare(password, userResult.rows[0].password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'بيانات الاعتماد غير صالحة' });
        }

        const payload = { user: { id: userResult.rows[0].id } };
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
            if (err) throw err;
            const user = userResult.rows[0];
            delete user.password;
            res.json({ token, user });
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET api/auth/me
router.get('/me', auth, async (req, res) => {
    const db = req.app.get('db');
    try {
        const userResult = await db.query('SELECT id, username, email, avatar FROM users WHERE id = $1', [req.user.id]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ msg: 'المستخدم غير موجود' });
        }
        res.json(userResult.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
