const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(express.json());
app.use(cors());

// Serve static files from media directory
app.use('/media', express.static(path.join(__dirname, 'media')));

const routes = require('./routes');
app.use('/', routes);

app.listen(8000, () => {
  console.log('Server running on http://localhost:8000');
});