const jwt = require('jsonwebtoken');
const accessSECRET = process.env.ACCESS_SECRET;

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

  let token = authHeader;
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (authHeader.startsWith('Token ')) {
    token = authHeader.slice(6);
  }
  
  try {
    req.user = jwt.verify(token, accessSECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};