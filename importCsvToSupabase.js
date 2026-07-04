// Importa Base_Ropa_-_Mujeres.csv y Base_Ropa_-_Hombres.csv a la tabla "clothes" de Supabase.
// Uso: node importCsvToSupabase.js
//
// Requiere que ya hayas corrido supabase-schema.sql en tu proyecto de Supabase
// y que tengas el archivo .env configurado (ver .env.example).

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { fileURLToPath } from 'url';
import { supabase } from './supabaseClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const files = [
  { path: path.join(__dirname, 'data-csv', 'Base_Ropa_-_Mujeres.csv'), gender: 'mujer' },
  { path: path.join(__dirname, 'data-csv', 'Base_Ropa_-_Hombres.csv'), gender: 'hombre' },
];

// Clasificador simple: infiere el tipo de prenda (category en tu schema) a partir del nombre.
// Revisa los resultados después de importar; esto es una aproximación, no es perfecto.
function inferCategory(nombre) {
  const n = nombre.toLowerCase();
  if (/jean|pantal[oó]n|short|falda|bermuda|leggin|jogger/.test(n)) return 'bottoms';
  if (/vestido|enterito|jumpsuit/.test(n)) return 'dresses';
  if (/chaqueta|abrigo|parka|poler[oó]n|hoodie|blazer|cazadora|campera/.test(n)) return 'jackets';
  if (/zapat|zapatilla|sneaker|bota|mocas[ií]n/.test(n)) return 'shoes';
  if (/cartera|mochila|bolso|tote|riñonera/.test(n)) return 'bags';
  if (/gorra|lentes|cintur[oó]n|bufanda|collar|reloj|gorro|accesorio/.test(n)) return 'accessories';
  if (/deportiv|running|training|legging deportiv|top deportivo/.test(n)) return 'sportswear';
  return 'tops'; // camisa, polera, camiseta, top, polo, blusa, etc. -> valor por defecto
}

// La columna "Categoría" del CSV en realidad describe el estilo/ocasión, no el tipo de prenda.
function inferStyle(categoriaCsv) {
  const c = (categoriaCsv || '').toLowerCase();
  if (c.includes('evento')) return 'Eventos de Ocasión';
  if (c.includes('sport') || c.includes('deportiv')) return 'Deportivo';
  if (c.includes('formal')) return 'Formal';
  return 'Casual';
}

function readCsvRecords(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return parse(raw, { columns: true, skip_empty_lines: true, trim: true });
}

async function importFile({ path: filePath, gender }) {
  if (!fs.existsSync(filePath)) {
    console.warn(`Aviso: no se encontró el archivo ${filePath}, se omite.`);
    return { inserted: 0, skipped: 0 };
  }

  const rows = readCsvRecords(filePath);

  const records = rows
    .filter(r => r['Producto'])
    .map(r => ({
      name: r['Producto'].trim(),
      brand: (r['Tienda'] || 'Sin marca').trim(),
      store: (r['Tienda'] || 'Sin marca').trim(),
      category: inferCategory(r['Producto']),
      color: 'Otro',
      gender,
      image_url: r['URL de Imagen'] || null,
      purchase_url: r['URL de Compra'] || null,
      price: null,
      style: inferStyle(r['Categoría']),
      status: 'clean',
      is_catalog: true,
    }));

  // Insertamos en lotes de 100 para evitar límites de payload
  const batchSize = 100;
  let inserted = 0;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { error } = await supabase.from('clothes').insert(batch);
    if (error) {
      console.error(`Error insertando lote ${i / batchSize + 1} de ${filePath}:`, error.message);
    } else {
      inserted += batch.length;
    }
  }

  return { inserted, skipped: rows.length - records.length };
}

async function run() {
  console.log('Iniciando importación de catálogo a Supabase...\n');
  let total = 0;
  for (const file of files) {
    const { inserted, skipped } = await importFile(file);
    console.log(`- ${path.basename(file.path)}: ${inserted} prendas importadas${skipped ? `, ${skipped} filas omitidas` : ''}.`);
    total += inserted;
  }
  console.log(`\nListo. Total de prendas importadas: ${total}`);
  console.log('Revisa la categoría (tipo de prenda) y estilo asignados en el dashboard de Supabase,');
  console.log('ya que se infirieron automáticamente a partir del nombre del producto.');
}

run().catch(err => {
  console.error('Error inesperado durante la importación:', err);
  process.exit(1);
});
