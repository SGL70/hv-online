require('dotenv').config();
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }, // HTTP ok — byt till true om HTTPS aktiveras
}));

app.use('/api/auth',        require('./routes/auth'));
app.use('/api/auth/bankid', require('./routes/bankid'));
app.use('/api/orgs',       require('./routes/organizations'));
app.use('/api/activities', require('./routes/activities'));
app.use('/api/reports',    require('./routes/reports'));
app.use('/api/equipment',  require('./routes/equipment'));
app.use('/api/catalog',    require('./routes/catalog'));
app.use('/api/prio',       require('./routes/prio'));
app.use('/api/inventory',  require('./routes/inventory'));
app.use('/api/personal',   require('./routes/personal'));
app.use('/api/news',       require('./routes/news'));

// Serve uploaded images (legacy uploads folder)
const uploadsPath = path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsPath));

// Serve user-uploaded images from public/img (uploaded after build, not in dist)
const publicImgPath = path.join(__dirname, '../../frontend/public/img');
app.use('/img', express.static(publicImgPath));

// Serve built frontend
const staticPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(staticPath));
app.get('*', (_req, res) => res.sendFile(path.join(staticPath, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bataljonssystem på port ${PORT}`));
