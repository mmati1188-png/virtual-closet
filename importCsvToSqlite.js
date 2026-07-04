// Importa Base_Ropa_-_Mujeres.csv y Base_Ropa_-_Hombres.csv a la tabla "clothes" de SQLite closet.db.
// Uso: node importCsvToSqlite.js

import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { parse } from 'csv-parse/sync';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'closet.db');
const db = new sqlite3.Database(dbPath);

const files = [
  { path: path.join(__dirname, 'data-csv', 'Base_Ropa_-_Mujeres.csv'), gender: 'mujer' },
  { path: path.join(__dirname, 'data-csv', 'Base_Ropa_-_Hombres.csv'), gender: 'hombre' },
];

function inferCategory(nombre) {
  const n = nombre.toLowerCase();
  if (/jean|pantal[oó]n|short|falda|bermuda|leggin|jogger/.test(n)) return 'bottoms';
  if (/vestido|enterito|jumpsuit/.test(n)) return 'dresses';
  if (/chaqueta|abrigo|parka|poler[oó]n|hoodie|blazer|cazadora|campera/.test(n)) return 'jackets';
  if (/zapat|zapatilla|sneaker|bota|mocas[ií]n/.test(n)) return 'shoes';
  if (/cartera|mochila|bolso|tote|riñonera/.test(n)) return 'bags';
  if (/gorra|lentes|cintur[oó]n|bufanda|collar|reloj|gorro|accesorio/.test(n)) return 'accessories';
  if (/deportiv|running|training|legging deportiv|top deportivo/.test(n)) return 'sportswear';
  return 'tops';
}

function inferStyle(categoriaCsv) {
  const c = (categoriaCsv || '').toLowerCase();
  if (c.includes('evento')) return 'Eventos de Ocasión';
  if (c.includes('sport') || c.includes('deportiv')) return 'Deportivo';
  if (c.includes('formal')) return 'Formal';
  return 'Casual';
}

function getStockImage(text, category) {
  const t = text.toLowerCase();
  if (t.includes('vestido') || t.includes('dress') || category === 'dresses') {
    return 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&auto=format&fit=crop&q=80';
  }
  if (t.includes('cartera') || t.includes('bolso') || t.includes('backpack') || category === 'bags') {
    return 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&auto=format&fit=crop&q=80';
  }
  if (t.includes('camiseta') || t.includes('t-shirt') || t.includes('tshirt') || t.includes('top') || category === 'tops') {
    return 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80';
  }
  if (t.includes('jeans') || t.includes('pantalón') || t.includes('pantalon') || t.includes('shorts') || category === 'bottoms') {
    return 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=600&auto=format&fit=crop&q=80';
  }
  if (t.includes('chaqueta') || t.includes('abrigo') || t.includes('jacket') || category === 'jackets') {
    return 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&auto=format&fit=crop&q=80';
  }
  if (t.includes('zapatos') || t.includes('zapatillas') || t.includes('sneakers') || category === 'shoes') {
    return 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80';
  }
  if (category === 'sportswear') {
    return 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=600&auto=format&fit=crop&q=80';
  }
  if (category === 'accessories') {
    return 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600&auto=format&fit=crop&q=80';
  }
  return 'https://images.unsplash.com/photo-1527719327859-c6ce80353573?w=600&auto=format&fit=crop&q=80';
}

function resolveImageUrl(imageUrl, store, category, name) {
  // Limpiar sufijos de resolución como (1000×1500) o (800x1120)
  const cleaned = (imageUrl || '').replace(/\s*\(\d+[\s×x]*\d+\)\s*/gi, '').trim();
  if (!cleaned) {
    return getStockImage(name, category);
  }
  if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
    return cleaned;
  }

  const st = store.toLowerCase();
  if (st.includes('lolita') || st.includes('lpk')) {
    return `https://www.lpk.cl/cdn/shop/files/${cleaned}`;
  }
  if (st.includes('nautica')) {
    return `https://www.nautica.cl/cdn/shop/files/${cleaned}`;
  }
  if (st.includes('cycorecords') || st.includes('cyco')) {
    return `https://www.cycorecords.cl/cdn/shop/files/${cleaned}`;
  }
  if (st.includes('dockers')) {
    return `https://www.dockers.cl/cdn/shop/files/${cleaned}`;
  }
  if (st.includes('arrow')) {
    return `https://www.arrow.cl/cdn/shop/files/${cleaned}`;
  }

  // Fallback si es de otra marca y no tiene URL absoluta
  return getStockImage(name, category);
}

function readCsvRecords(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return parse(raw, { columns: true, skip_empty_lines: true, trim: true });
}

async function run() {
  console.log('Abriendo base de datos SQLite y limpiando la tabla clothes...');
  
  await new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('DELETE FROM clothes', (err) => {
        if (err) reject(err);
        else {
          db.run('DELETE FROM sqlite_sequence WHERE name="clothes"', (err2) => {
            if (err2) reject(err2);
            else resolve();
          });
        }
      });
    });
  });

  console.log('Iniciando importación del catálogo CSV a SQLite...');
  let totalImported = 0;

  for (const file of files) {
    if (!fs.existsSync(file.path)) {
      console.warn(`Aviso: no se encontró el archivo ${file.path}, se omite.`);
      continue;
    }

    const rows = readCsvRecords(file.path);
    console.log(`Procesando ${rows.length} filas de ${path.basename(file.path)}...`);

    await new Promise((resolve, reject) => {
      db.serialize(() => {
        const stmt = db.prepare(`
          INSERT INTO clothes (name, brand, store, category, color, gender, image_url, purchase_url, price, status, style, is_catalog)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'clean', ?, 1)
        `);

        let count = 0;
        rows.forEach(r => {
          if (!r['Producto']) return;
          const name = r['Producto'].trim();
          const store = (r['Tienda'] || 'Sin marca').trim();
          const brand = (r['Tienda'] || 'Sin marca').trim();
          const category = inferCategory(name);
          const color = 'Otro';
          const imageUrl = (r['URL de Imagen'] || '').trim();
          const purchaseUrl = r['URL de Compra'] || null;
          const price = 19990; // Precio por defecto
          const style = inferStyle(r['Categoría']);

          const finalImageUrl = resolveImageUrl(imageUrl, store, category, name);

          stmt.run(name, brand, store, category, color, file.gender, finalImageUrl, purchaseUrl, price, style);
          count++;
        });

        stmt.finalize((err) => {
          if (err) reject(err);
          else {
            console.log(`- ${path.basename(file.path)}: ${count} prendas importadas.`);
            totalImported += count;
            resolve();
          }
        });
      });
    });
  }

  console.log(`\nImportación completada con éxito. Total: ${totalImported} prendas.`);
  db.close();
}

run().catch(err => {
  console.error('Error inesperado durante la importación:', err);
  db.close();
  process.exit(1);
});
