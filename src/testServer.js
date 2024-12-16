const express = require('express');
const TestUser = require('./models/TestUser');
const creds = require("./creds.json");
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

//load environment variables
require('dotenv').config();

//Check if the secret key is defined in the environment variables
const secretKey = creds.web.client_secret;
if (!secretKey) {
    throw new Error('SECRET_KEY is not defined in the environment variables');
}

const connectDB = async () => {
    const db_uri = "mongodb://127.0.0.1:27017/tip";
    try {
        console.log(db_uri);
        await mongoose.connect(db_uri);
        console.log('MongoDB connected...');
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
};

const port = 4000;
const app = express();

// Routes
const TaskRouter = require("./routes/TaskRoute");

app.use(express.json());
app.use("/task", TaskRouter);

// Register route
app.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new TestUser({ name, email , password: hashedPassword });

        const oldUser = await TestUser.findOne({email: email});
        if (oldUser) {
            console.log('User already exists');
            return res.status(400).json({ error: 'User already exists' });
        }   
        await newUser.save();
        console.log('User registered successfully');
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ error: error.message });
    }
});

// Login route
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await TestUser.findOne({ email: email });
        if (!user) {
            console.log('Invalid credentials');
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log('Invalid credentials');
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        const token = jwt.sign({ userId: user._id }, creds.web.client_secret, { expiresIn: '1h' });
        console.log('Login Successful');
        res.json({ token });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ error: error.message });
    }
});

connectDB().then(() => {
    app.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
    });
}).catch((err) => {
    process.exit(1);
});