const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// Automatically switch backend URL depending on environment
const BACKEND_URL = process.env.BACKEND_URL || 'http//localhost:5000'


// Middleware configurations
app.use(cors());
app.use(bodyParser.json());

// Serve uploaded assets statically so the front-end dashboard can load them
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure target uploads folder directory exists safely on initialization
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer Storage Engine parameters
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// PostgreSQL Database Connection configuration matrix
// const pool = new Pool({
//     user: 'postgres',
//     host: 'localhost',
//     database: 'user_auth',
//     password: 'Xangars@123', // !!! UPDATE THIS WITH YOUR SYSTEM'S ACTUAL POSTGRES PASSWORD !!!
//     port: 5432,
// });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Required by cloud databases like Render/Heroku
    }
});


// Automatically create the users table if it doesn't exist
const initializeDatabase = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        profile_pic TEXT DEFAULT 'resource/default_profile_pic.png',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Database tables verified/created successfully.');
  } catch (err) {
    console.error('Error initializing database tables:', err);
  }
};

initializeDatabase();

// ==========================================
// 1. REGISTRATION ENDPOINT (SIGN UP)
// ==========================================
app.post('/api/signup', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const userExist = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userExist.rows.length > 0) {
            return res.status(400).json({ message: 'Email already registered!' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        // POINT THIS TO YOUR LOCAL DEFAULT PROFILE PICTURE PATH
        // Ensure you match your actual file extension (e.g., .png, .jpg)
        const defaultPic = 'resource/default_profile_pic.png'; 
        
        const newUser = await pool.query(
            'INSERT INTO users (name, password, email, profile_pic) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, hashedPassword, email, defaultPic]
        );
        res.status(201).json({ message: 'User registered successfully!', user: newUser.rows[0] });
    } catch (err) {
        console.error("SIGNUP ERROR:", err.message);
        res.status(500).json({ message: 'Server error during signup execution.' });
    }
});

// ==========================================
// 2. AUTHENTICATION ENDPOINT (SIGN IN)
// ==========================================
app.post('/api/signin', async (req, res) => {
    const { email, password } = req.body;
    try {
        const userResult = await pool.query('SELECT * FROM users WHERE email = \$1', [email]);
        if (userResult.rows.length === 0) {
            return res.status(400).json({ message: 'Invalid email or password!' });
        }

        const user = userResult.rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid email or password!' });
        }

        res.status(200).json({ 
            message: 'Login successful!', 
            user: { id: user.id, name: user.name, email: user.email, profile_pic: user.profile_pic } 
        });
    } catch (err) {
        console.error("SIGNIN ERROR:", err.message);
        res.status(500).json({ message: 'Server error during validation.' });
    }
});

// ==========================================
// 3. RETRIEVE ALL ACTIVE SYSTEM CONTACTS
// ==========================================
app.get('/api/users', async (req, res) => {
    try {
        const allUsers = await pool.query('SELECT id, name, email, profile_pic FROM users ORDER BY name ASC');
        res.status(200).json(allUsers.rows);
    } catch (err) {
        console.error("FETCH USERS ERROR:", err.message);
        res.status(500).json({ message: 'Failed to retrieve directory.' });
    }
});

// ==========================================
// 4. UPDATE USER PROFILE PICTURE FILE
// ==========================================
app.post('/api/users/profile-pic', upload.single('profile_pic'), async (req, res) => {
    const { userId } = req.body;
    if (!req.file) return res.status(400).json({ message: 'No image asset submitted' });
    
    const fileUrl = `${BACKEND_URL}${req.file.filename}`;
    try {
        const updateResult = await pool.query(
            'UPDATE users SET profile_pic = \$1 WHERE id = \$2 RETURNING id, name, email, profile_pic',
            [fileUrl, userId]
        );
        res.status(200).json({ message: 'Profile photo updated successfully!', user: updateResult.rows[0] });
    } catch (err) {
        console.error("PROFILE PIC ERROR:", err.message);
        res.status(500).json({ message: 'Failed to update user profile image.' });
    }
});

// ==========================================
// 5. SEND MESSAGE (SUPPORTS TEXT AND IMAGES)
// ==========================================
app.post('/api/messages', upload.single('image_file'), async (req, res) => {
    const { sender_id, receiver_id, message_text, message_type } = req.body;
    let fileUrl = null;

    if (req.file) {
        const getFileUrl = (req, filename) => {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        return `${protocol}://${req.get('host')}/uploads/${filename}`;
};
    }

    try {
        const newMessage = await pool.query(
            'INSERT INTO messages (sender_id, receiver_id, message_text, message_type, file_url) VALUES (\$1, \$2, \$3, \$4, \$5) RETURNING *',
            [sender_id, receiver_id, message_text || '', message_type || 'text', fileUrl]
        );
        res.status(201).json(newMessage.rows[0]);
    } catch (err) {
        console.error("SEND MESSAGE ERROR:", err.message);
        res.status(500).json({ message: 'Failed to send message.' });
    }
});

// ==========================================
// 6. RETRIEVE CHAT HISTORY LOGS
// ==========================================
app.get('/api/messages/:user1/:user2', async (req, res) => {
    const { user1, user2 } = req.params;
    try {
        const history = await pool.query(
            `SELECT id, sender_id, receiver_id, message_text, message_type, file_url,
                    TO_CHAR(created_at, 'HH:MI AM') as formatted_time 
             FROM messages 
             WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1) 
             ORDER BY created_at ASC`,
            [user1, user2]
        );
        res.status(200).json(history.rows);
    } catch (err) {
        console.error("FETCH HISTORY ERROR:", err.message);
        res.status(500).json({ message: 'Failed to load conversation log history.' });
    }
});

// Run Backend Engine Application Server process
app.listen(PORT, () => console.log(`Server executing cleanly on HTTP endpoint: ${BACKEND_URL}${PORT}`));
