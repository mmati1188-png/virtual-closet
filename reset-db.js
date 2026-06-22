import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'closet.db');
const jsonPath = path.join(__dirname, 'src/data/realClosetProducts.json');

// Delete old database if exists
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('Deleted old closet.db');
}

const sqlite = sqlite3.verbose();
const db = new sqlite.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    process.exit(1);
  }
  console.log('Connected to database closet.db');
  runSeeding();
});

function runSeeding() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS clothes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        brand TEXT,
        store TEXT,
        category TEXT CHECK(category IN ('tops', 'bottoms', 'jackets', 'shoes', 'accessories', 'dresses', 'bags', 'sportswear')) NOT NULL,
        color TEXT,
        image_url TEXT,
        status TEXT DEFAULT 'clean' CHECK(status IN ('clean', 'dirty', 'lent')),
        purchase_url TEXT,
        price REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS outfits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS outfit_items (
        outfit_id INTEGER,
        clothing_id INTEGER,
        PRIMARY KEY (outfit_id, clothing_id),
        FOREIGN KEY (outfit_id) REFERENCES outfits(id) ON DELETE CASCADE,
        FOREIGN KEY (clothing_id) REFERENCES clothes(id) ON DELETE CASCADE
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS calendar (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        day_of_week TEXT UNIQUE NOT NULL CHECK(day_of_week IN ('lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo')),
        outfit_id INTEGER,
        FOREIGN KEY (outfit_id) REFERENCES outfits(id) ON DELETE SET NULL
      )
    `);

    // Insert calendar days
    const days = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
    const stmtCal = db.prepare('INSERT OR IGNORE INTO calendar (day_of_week, outfit_id) VALUES (?, NULL)');
    days.forEach(day => stmtCal.run(day));
    stmtCal.finalize();

    // Load products
    const products = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    console.log(`Loading ${products.length} products into database...`);

    const stmt = db.prepare(`
      INSERT INTO clothes (id, name, brand, store, category, color, price, image_url, purchase_url, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    products.forEach(c => {
      const numId = parseInt(String(c.id).replace(/[^\d]/g, '')) || null;
      let dbStatus = 'clean';
      if (c.status === 'sucio' || c.status === 'dirty') dbStatus = 'dirty';
      else if (c.status === 'prestado' || c.status === 'lent') dbStatus = 'lent';
      const price = c.priceCLP || c.price || 19990;
      const color = c.color || 'Otro';

      stmt.run(numId, c.name, c.brand, c.store, c.category, color, price, c.imageUrl, c.productUrl, dbStatus);
    });

    stmt.finalize((err) => {
      if (err) {
        console.error('Error inserting clothes:', err);
      } else {
        console.log('Seeded database successfully!');
      }
      db.close();
    });
  });
}
