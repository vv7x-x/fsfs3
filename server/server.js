const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Database Connection
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for Supabase external connections
});

pool.on('connect', () => {
    console.log('🐘 Connected to PostgreSQL Successfully!');
});

pool.on('error', (err) => {
    console.error('❌ Unexpected DB Error:', err.message);
});

// Pass dependencies to routes/sockets if needed
app.set('db', pool);
app.set('io', io);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/radio', require('./routes/radio'));
app.use('/api/reels', require('./routes/reels'));
app.use('/api/forum', require('./routes/forum'));
app.use('/api/profile', require('./routes/profile'));

// Socket.io Logic
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return next(new Error('Authentication error'));
        socket.user = decoded.user;
        next();
    });
});

io.on('connection', async (socket) => {
    console.log('👤 User connected:', socket.user.id);

    // Fetch user details once
    const uRes = await pool.query('SELECT username FROM users WHERE id = $1', [socket.user.id]);
    const username = uRes.rows[0]?.username || 'User';

    socket.on('join_chat', () => {
        socket.join('global_chat');
    });

    socket.on('join_graffiti', () => {
        socket.join('graffiti_room');
    });

    socket.on('draw', (data) => {
        socket.to('graffiti_room').emit('draw', data);
    });

    socket.on('clear_graffiti', () => {
        socket.to('graffiti_room').emit('clear_graffiti');
    });

    socket.on('send_message', async (data) => {
        try {
            const result = await pool.query(
                'INSERT INTO messages (user_id, content) VALUES ($1, $2) RETURNING *',
                [socket.user.id, data.content]
            );
            const newMessage = result.rows[0];
            const userRes = await pool.query('SELECT username, avatar FROM users WHERE id = $1', [socket.user.id]);
            const broadcastMsg = { ...newMessage, username: userRes.rows[0].username, avatar: userRes.rows[0].avatar };
            io.to('global_chat').emit('receive_message', broadcastMsg);
        } catch (err) { console.error(err); }
    });

    socket.on('typing', () => {
        socket.to('global_chat').emit('user_typing', { userId: socket.user.id, username });
    });

    socket.on('send_buzz', () => {
        socket.to('global_chat').emit('user_buzz', { userId: socket.user.id, username });
    });

    socket.on('update_radio', async (data) => {
        try {
            await pool.query(
                'UPDATE radio_state SET youtube_id = $1, started_at = CURRENT_TIMESTAMP, updated_by = $2 WHERE id = 1',
                [data.youtube_id, socket.user.id]
            );
            io.emit('radio_updated', {
                youtube_id: data.youtube_id,
                started_at: new Date()
            });
        } catch (err) { console.error(err); }
    });

    socket.on('disconnect', () => {
        console.log('👤 User disconnected:', socket.user.id);
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 Server listening on port ${PORT}`);
});
