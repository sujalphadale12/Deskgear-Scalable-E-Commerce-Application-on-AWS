require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) { console.error('JWT_SECRET missing in .env'); process.exit(1); }

const SEED = [
  ['Wireless Earbuds', 'Bluetooth 5.3, 24h battery with case', 1999, 50, '/images/earbuds.svg'],
  ['Mechanical Keyboard', 'Hot-swappable, tactile switches', 3499, 30, '/images/keyboard.svg'],
  ['USB-C Hub 7-in-1', 'HDMI, SD card, 3x USB-A, PD charging', 1499, 40, '/images/usb-hub.svg'],
  ['Laptop Stand', 'Foldable aluminium, six height levels', 899, 60, '/images/laptop-stand.svg'],
  ['Portable SSD 500GB', 'USB 3.2, pocket size', 4299, 25, '/images/ssd.svg'],
  ['Webcam 1080p', 'Auto light correction, built-in mic', 2299, 35, '/images/webcam.svg'],
];

async function initDb() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description VARCHAR(255),
    price DECIMAL(10,2) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    image_url VARCHAR(255))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    qty INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id))`);
  // Older databases: add the image column if it is missing
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'image_url'`);
  if (!cols.length) await pool.query('ALTER TABLE products ADD COLUMN image_url VARCHAR(255)');

  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM products');
  if (n === 0) {
    await pool.query('INSERT INTO products (name, description, price, stock, image_url) VALUES ?', [SEED]);
    console.log('Seeded products');
  }
  // Fill in photos for existing products that have none yet
  for (const [name, , , , img] of SEED)
    await pool.query('UPDATE products SET image_url = ? WHERE name = ? AND image_url IS NULL', [img, name]);
}

function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Please log in first' }); }
}

app.get('/health', async (req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok' }); }
  catch (e) { res.status(500).json({ status: 'error', detail: e.message }); }
});

app.get('/api/products', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM products ORDER BY id');
  res.json(rows);
});

// Add a new product to the catalog — any signed-in user may list one (this is a demo store,
// not a real marketplace with seller accounts; add a `role` check here before going live)
app.post('/api/products', auth, async (req, res) => {
  const { name, description, price, stock, image_url } = req.body;
  const priceNum = Number(price);
  const stockNum = Number(stock);
  if (!name || !name.trim()) return res.status(400).json({ error: 'Product name is required' });
  if (!(priceNum > 0)) return res.status(400).json({ error: 'Price must be a number greater than 0' });
  if (!Number.isInteger(stockNum) || stockNum < 0) return res.status(400).json({ error: 'Stock must be a whole number, 0 or more' });
  try {
    const [r] = await pool.query(
      'INSERT INTO products (name, description, price, stock, image_url) VALUES (?,?,?,?,?)',
      [name.trim(), (description || '').trim(), priceNum, stockNum, (image_url || '').trim() || null]
    );
    res.status(201).json({ id: r.insertId, name, description, price: priceNum, stock: stockNum, image_url: image_url || null });
  } catch (e) {
    res.status(500).json({ error: 'Could not add the product' });
  }
});

app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 6)
    return res.status(400).json({ error: 'Name, email and a password of 6+ characters are required' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const [r] = await pool.query('INSERT INTO users (name, email, password_hash) VALUES (?,?,?)', [name, email, hash]);
    const token = jwt.sign({ id: r.insertId, name }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, name });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email already registered' });
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const [[u]] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
  if (!u || !(await bcrypt.compare(password || '', u.password_hash)))
    return res.status(401).json({ error: 'Wrong email or password' });
  const token = jwt.sign({ id: u.id, name: u.name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, name: u.name });
});

// Place order: prices and stock are always read from the DB, never trusted from the browser
app.post('/api/orders', auth, async (req, res) => {
  const items = req.body.items;
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Cart is empty' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let total = 0;
    const lines = [];
    for (const it of items) {
      const qty = parseInt(it.qty, 10);
      const [[p]] = await conn.query('SELECT * FROM products WHERE id = ? FOR UPDATE', [it.product_id]);
      if (!p || !(qty > 0) || p.stock < qty) throw new Error(`Not enough stock for ${p ? p.name : 'item ' + it.product_id}`);
      total += Number(p.price) * qty;
      lines.push([p.id, qty, p.price]);
      await conn.query('UPDATE products SET stock = stock - ? WHERE id = ?', [qty, p.id]);
    }
    const [o] = await conn.query('INSERT INTO orders (user_id, total) VALUES (?,?)', [req.user.id, total]);
    await conn.query('INSERT INTO order_items (order_id, product_id, qty, price) VALUES ?',
      [lines.map(l => [o.insertId, ...l])]);
    await conn.commit();
    res.status(201).json({ orderId: o.insertId, total });
  } catch (e) {
    await conn.rollback();
    res.status(400).json({ error: e.message });
  } finally { conn.release(); }
});

app.get('/api/orders', auth, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT o.id, o.total, o.created_at, GROUP_CONCAT(CONCAT(p.name, ' x', i.qty) SEPARATOR ', ') AS items
     FROM orders o JOIN order_items i ON i.order_id = o.id JOIN products p ON p.id = i.product_id
     WHERE o.user_id = ? GROUP BY o.id ORDER BY o.id DESC`, [req.user.id]);
  res.json(rows);
});

const PORT = process.env.PORT || 3000;
initDb()
  .then(() => app.listen(PORT, '0.0.0.0', () => console.log(`Shop running on port ${PORT}`)))
  .catch(e => { console.error('DB init failed:', e.message); process.exit(1); });
