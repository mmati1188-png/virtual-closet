import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar dinámicamente realClosetProducts.json si existe
const realProductsPath = path.join(__dirname, 'src/data/realClosetProducts.json');
let realClosetProducts = [];
try {
  if (fs.existsSync(realProductsPath)) {
    realClosetProducts = JSON.parse(fs.readFileSync(realProductsPath, 'utf-8'));
  }
} catch (e) {
  console.warn('Advertencia al leer realClosetProducts.json:', e.message);
}

const dbPath = path.join(__dirname, 'closet.db');
const sqlite = sqlite3.verbose();
const db = new sqlite.Database(dbPath, (err) => {
  if (err) {
    console.error('Error al conectar con la base de datos SQLite:', err.message);
  } else {
    console.log('Conectado con éxito a la base de datos SQLite closet.db');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    // 1. Tabla de prendas con las nuevas categorías (dresses y bags)
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

    // 2. Tabla de outfits (conjuntos)
    db.run(`
      CREATE TABLE IF NOT EXISTS outfits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. Tabla de relación prenda-outfit
    db.run(`
      CREATE TABLE IF NOT EXISTS outfit_items (
        outfit_id INTEGER,
        clothing_id INTEGER,
        PRIMARY KEY (outfit_id, clothing_id),
        FOREIGN KEY (outfit_id) REFERENCES outfits(id) ON DELETE CASCADE,
        FOREIGN KEY (clothing_id) REFERENCES clothes(id) ON DELETE CASCADE
      )
    `);

    // 4. Tabla de calendario de planificación semanal
    db.run(`
      CREATE TABLE IF NOT EXISTS calendar (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        day_of_week TEXT UNIQUE NOT NULL CHECK(day_of_week IN ('lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo')),
        outfit_id INTEGER,
        FOREIGN KEY (outfit_id) REFERENCES outfits(id) ON DELETE SET NULL
      )
    `, () => {
      // Inicializar los días de la semana en la tabla calendar si no existen
      const days = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
      const stmt = db.prepare('INSERT OR IGNORE INTO calendar (day_of_week, outfit_id) VALUES (?, NULL)');
      days.forEach(day => stmt.run(day));
      stmt.finalize();

      // Cargar prendas iniciales desde closetItems.js si está vacío o si necesitamos actualizar
      checkAndPopulateClothes();
    });

    console.log('Tablas inicializadas correctamente.');
  });
}

function checkAndPopulateClothes() {
  db.get('SELECT COUNT(*) as count FROM clothes', (err, row) => {
    if (err) {
      console.error('Error al contar prendas para popolar:', err.message);
      return;
    }

    if (realClosetProducts.length === 0) {
      console.log('Advertencia: El archivo realClosetProducts.json está vacío o no se ha creado aún. Se requiere ejecutar primero el scraper.');
      return;
    }

    // Si hay menos de 100 prendas en la base de datos, repoblamos
    if (row.count < 100) {
      console.log(`Base de datos incompleta (${row.count} prendas). Poblando con las ${realClosetProducts.length} prendas de realClosetProducts.json...`);
      
      db.serialize(() => {
        db.run('DELETE FROM clothes');
        db.run('DELETE FROM sqlite_sequence WHERE name="clothes"');
        
        const stmt = db.prepare(`
          INSERT INTO clothes (id, name, brand, store, category, color, price, image_url, purchase_url, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        realClosetProducts.forEach(c => {
          // Extraer número de ID
          const numId = parseInt(String(c.id).replace(/[^\d]/g, '')) || null;

          // Mapeamos status a los estados soportados por la DB (clean, dirty, lent)
          let dbStatus = 'clean';
          if (c.status === 'sucio' || c.status === 'dirty') dbStatus = 'dirty';
          else if (c.status === 'prestado' || c.status === 'lent') dbStatus = 'lent';

          const price = c.priceCLP || c.price || 19990;
          const color = c.color || 'Otro';

          stmt.run(numId, c.name, c.brand, c.store, c.category, color, price, c.imageUrl, c.productUrl, dbStatus);
        });

        stmt.finalize((err2) => {
          if (err2) {
            console.error('Error al insertar prendas de realClosetProducts:', err2.message);
          } else {
            console.log('Base de datos SQLite poblada con éxito con las prendas de realClosetProducts.json.');
          }
        });
      });
    }
  });
}

// Helpers asíncronos para DB en Promesas
export const dbQuery = {
  db,
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  },
  exec(sql) {
    return new Promise((resolve, reject) => {
      db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
};

export default db;
