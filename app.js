require("dotenv").config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors({
  origin: [
    "http://127.0.0.1:3000",
    "http://localhost:3000"
  ],
  credentials: true,
}));


app.use(express.json());

// Serve static files from media directory
app.use('/media', express.static(path.join(__dirname, 'media')));

const routes = require('./routes');
app.use('/', routes);

app.get("/health", (req, res) => {
  res.json({ ok: true });
});


const PORT = process.env.PORT || 8000;

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Express running on http://127.0.0.1:${PORT}`);
});