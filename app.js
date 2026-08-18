require("dotenv").config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const licenseRoutes = require("./routes/licenseRoutes");


const app = express();

app.use(cors({
  origin: [
    "http://127.0.0.1:3000",
    "http://localhost:3000"
  ],
  credentials: true,
}));

app.use(express.json());

// Health check AVANT les middlewares protégés
app.get("/health", (req, res) => {
  res.status(200).json({ ok: true });
});

app.use("/licenses", licenseRoutes);

// Serve static files from media directory
app.use('/media', express.static(path.join(__dirname, 'media')));

const routes = require('./routes');
app.use('/', routes);

const PORT = process.env.PORT || 8000;
console.log("DATABASE_URL =", process.env.DATABASE_URL);

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Express running on http://127.0.0.1:${PORT}`);
});