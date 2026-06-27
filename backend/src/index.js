require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());

app.use('/api/auth',       require('./routes/auth'));
app.use('/api/orgs',       require('./routes/organizations'));
app.use('/api/activities', require('./routes/activities'));
app.use('/api/reports',    require('./routes/reports'));
app.use('/api/equipment',  require('./routes/equipment'));
app.use('/api/catalog',    require('./routes/catalog'));
app.use('/api/prio',       require('./routes/prio'));
app.use('/api/inventory',  require('./routes/inventory'));
app.use('/api/personal',   require('./routes/personal'));
app.use('/api/news',       require('./routes/news'));

// Serve uploaded images
const uploadsPath = path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsPath));

// Serve built frontend
const staticPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(staticPath));
app.get('*', (_req, res) => res.sendFile(path.join(staticPath, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bataljonssystem på port ${PORT}`));
