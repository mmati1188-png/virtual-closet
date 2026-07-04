import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { fileURLToPath } from 'url';
import { dbQuery } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Servir la build de producción de React (dist) y las subidas
app.use(express.static(path.join(__dirname, 'dist')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Asegurarse de que el directorio de subidas exista
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuración de Multer para almacenar imágenes de prendas
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'garment-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Mapeador de imágenes por defecto si falla el scraping
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
  return 'https://images.unsplash.com/photo-1527719327859-c6ce80353573?w=600&auto=format&fit=crop&q=80';
}

// ==========================================
// ENDPOINTS DE LA API
// ==========================================

// 1. Obtener todas las prendas
app.get('/api/clothes', async (req, res) => {
  try {
    const clothes = await dbQuery.all('SELECT * FROM clothes ORDER BY created_at DESC');
    res.json(clothes);
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar las prendas: ' + err.message });
  }
});

// 2. Agregar una prenda
app.post('/api/clothes', async (req, res) => {
  const { name, brand, store, category, color, image_url, purchase_url, price, style, gender } = req.body;
  if (!name || !category) {
    return res.status(400).json({ error: 'El nombre y la categoría son requeridos.' });
  }

  // Soporte para las nuevas categorías, incluyendo sportswear
  const validCategories = ['tops', 'bottoms', 'dresses', 'jackets', 'shoes', 'accessories', 'bags', 'sportswear'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: 'Categoría no válida.' });
  }

  // Validación de estilo oficial
  const validStyles = ['Formal', 'Casual', 'Deportivo', 'Eventos de Ocasión'];
  const dbStyle = validStyles.includes(style) ? style : 'Casual';
  const dbGender = (gender && ['mujer', 'hombre', 'unisex'].includes(gender)) ? gender : 'unisex';

  try {
    const result = await dbQuery.run(`
      INSERT INTO clothes (name, brand, store, category, color, gender, image_url, purchase_url, price, status, style)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'clean', ?)
    `, [name, brand, store, category, color, dbGender, image_url, purchase_url, price, dbStyle]);
    
    const newGarment = await dbQuery.get('SELECT * FROM clothes WHERE id = ?', [result.id]);
    res.status(201).json(newGarment);
  } catch (err) {
    res.status(500).json({ error: 'Error al agregar la prenda: ' + err.message });
  }
});

// 3. Modificar prenda (incluido estado clean/dirty/lent y estilo)
app.put('/api/clothes/:id', async (req, res) => {
  const { id } = req.params;
  const { name, brand, store, category, color, status, price, style, gender } = req.body;

  const validStyles = ['Formal', 'Casual', 'Deportivo', 'Eventos de Ocasión'];

  try {
    const existing = await dbQuery.get('SELECT * FROM clothes WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Prenda no encontrada.' });
    }

    const updatedName = name !== undefined ? name : existing.name;
    const updatedBrand = brand !== undefined ? brand : existing.brand;
    const updatedStore = store !== undefined ? store : existing.store;
    const updatedCategory = category !== undefined ? category : existing.category;
    const updatedColor = color !== undefined ? color : existing.color;
    const updatedStatus = status !== undefined ? status : existing.status;
    const updatedPrice = price !== undefined ? price : existing.price;
    const updatedStyle = (style !== undefined && validStyles.includes(style)) ? style : existing.style;
    const updatedGender = (gender !== undefined && ['mujer', 'hombre', 'unisex'].includes(gender)) ? gender : existing.gender;

    await dbQuery.run(`
      UPDATE clothes 
      SET name = ?, brand = ?, store = ?, category = ?, color = ?, status = ?, price = ?, style = ?, gender = ?
      WHERE id = ?
    `, [updatedName, updatedBrand, updatedStore, updatedCategory, updatedColor, updatedStatus, updatedPrice, updatedStyle, updatedGender, id]);

    const updatedGarment = await dbQuery.get('SELECT * FROM clothes WHERE id = ?', [id]);
    res.json(updatedGarment);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar la prenda: ' + err.message });
  }
});

// 4. Eliminar una prenda
app.delete('/api/clothes/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await dbQuery.get('SELECT * FROM clothes WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Prenda no encontrada.' });
    }

    await dbQuery.run('DELETE FROM clothes WHERE id = ?', [id]);
    res.json({ message: 'Prenda eliminada correctamente.', id });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar la prenda: ' + err.message });
  }
});

// 5. Cargar imagen
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se subió ninguna imagen.' });
  }
  const relativePath = `/uploads/${req.file.filename}`;
  res.json({ image_url: relativePath });
});

// 6. Scraper de URL
app.post('/api/scrape', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'La URL es requerida.' });
  }

  let storeName = 'Tienda Online';
  try {
    const domain = new URL(url).hostname;
    storeName = domain.replace('www.', '').split('.')[0];
    storeName = storeName.charAt(0).toUpperCase() + storeName.slice(1);
  } catch (e) {
    // URL inválida
  }

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 6000
    });

    const $ = cheerio.load(response.data);
    const ogTitle = $('meta[property="og:title"]').attr('content') || $('title').text();
    const ogImage = $('meta[property="og:image"]').attr('content');
    const ogBrand = $('meta[property="product:brand"]').attr('content') || storeName;

    let category = 'tops';
    const checkText = (ogTitle + ' ' + url).toLowerCase();
    if (checkText.includes('pantalón') || checkText.includes('pantalon') || checkText.includes('jeans') || checkText.includes('short') || checkText.includes('falda')) {
      category = 'bottoms';
    } else if (checkText.includes('vestido') || checkText.includes('dress') || checkText.includes('enterito')) {
      category = 'dresses';
    } else if (checkText.includes('chaqueta') || checkText.includes('abrigo') || checkText.includes('cazadora') || checkText.includes('parka')) {
      category = 'jackets';
    } else if (checkText.includes('zapato') || checkText.includes('zapatilla') || checkText.includes('sneaker') || checkText.includes('bota')) {
      category = 'shoes';
    } else if (checkText.includes('cartera') || checkText.includes('mochila') || checkText.includes('bolso') || checkText.includes('tote')) {
      category = 'bags';
    } else if (checkText.includes('gorra') || checkText.includes('lentes') || checkText.includes('cinturón') || checkText.includes('bufanda')) {
      category = 'accessories';
    }

    res.json({
      name: ogTitle ? ogTitle.trim().substring(0, 100) : 'Prenda Encontrada',
      brand: ogBrand ? ogBrand.trim() : storeName,
      store: storeName,
      price: 29990,
      category: category,
      color: 'Otro',
      image_url: ogImage || getStockImage(ogTitle || url, category),
      purchase_url: url
    });
  } catch (err) {
    let category = 'tops';
    if (url.includes('pantalon') || url.includes('jeans') || url.includes('short')) category = 'bottoms';
    else if (url.includes('vestido') || url.includes('dress')) category = 'dresses';
    else if (url.includes('abrigo') || url.includes('chaqueta')) category = 'jackets';
    else if (url.includes('zapato') || url.includes('zapatilla') || url.includes('sneaker')) category = 'shoes';
    else if (url.includes('cartera') || url.includes('bolso')) category = 'bags';

    res.json({
      name: 'Prenda Encontrada en ' + storeName,
      brand: storeName,
      store: storeName,
      price: 19990,
      category: category,
      color: 'Multicolor',
      image_url: getStockImage(url, category),
      purchase_url: url
    });
  }
});

// 7. Simular Escáner de Etiquetas
app.post('/api/scan-tag', upload.single('tag_image'), async (req, res) => {
  const originalName = req.file ? req.file.originalname.toLowerCase() : '';
  const brands = ['Zara', 'H&M', 'Nike', 'Adidas', 'Mango', 'Falabella', 'Ripley', 'Paris'];
  const colors = ['Negro', 'Blanco', 'Azul Marino', 'Rojo', 'Gris', 'Verde Oliva'];
  
  let brand = brands[Math.floor(Math.random() * brands.length)];
  let color = colors[Math.floor(Math.random() * colors.length)];
  
  setTimeout(() => {
    res.json({
      success: true,
      raw_ocr: `RN 77302 / CA 34221\n${brand.toUpperCase()} CLOTHING\n100% COTTON\nMADE IN CHILE\nSTYLE: ${Math.floor(Math.random()*90000+10000)}\nCOLOR: ${color.toUpperCase()}`,
      detected_details: {
        name: `Prenda Básica de Algodón ${brand}`,
        brand: brand,
        store: `${brand} Store`,
        category: 'tops',
        color: color,
        price: 14990,
        image_url: getStockImage('camiseta', 'tops')
      }
    });
  }, 1200);
});

// 8. Endpoint de Estadísticas
app.get('/api/stats', async (req, res) => {
  try {
    const totalClothes = await dbQuery.get('SELECT COUNT(*) as count FROM clothes');
    const dirtyClothes = await dbQuery.get("SELECT COUNT(*) as count FROM clothes WHERE status = 'dirty'");
    const lentClothes = await dbQuery.get("SELECT COUNT(*) as count FROM clothes WHERE status = 'lent'");
    const totalValue = await dbQuery.get('SELECT SUM(price) as total FROM clothes');
    
    const brandCounts = await dbQuery.all('SELECT brand, COUNT(*) as count FROM clothes GROUP BY brand ORDER BY count DESC LIMIT 5');
    const categoryCounts = await dbQuery.all('SELECT category, COUNT(*) as count FROM clothes GROUP BY category');

    res.json({
      total_items: totalClothes.count,
      dirty_items: dirtyClothes.count,
      lent_items: lentClothes.count,
      clean_items: totalClothes.count - dirtyClothes.count - lentClothes.count,
      total_value: Math.round((totalValue.total || 0) * 100) / 100,
      top_brands: brandCounts,
      categories: categoryCounts
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al calcular estadísticas: ' + err.message });
  }
});

// 9. CRUD del Calendario Semanal
app.get('/api/calendar', async (req, res) => {
  try {
    const calendar = await dbQuery.all(`
      SELECT c.day_of_week, c.outfit_id, o.name as outfit_name, o.description as outfit_description
      FROM calendar c
      LEFT JOIN outfits o ON c.outfit_id = o.id
    `);
    
    for (let day of calendar) {
      if (day.outfit_id) {
        day.items = await dbQuery.all(`
          SELECT cl.* FROM outfit_items oi
          JOIN clothes cl ON oi.clothing_id = cl.id
          WHERE oi.outfit_id = ?
        `, [day.outfit_id]);
      } else {
        day.items = [];
      }
    }
    res.json(calendar);
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar el calendario: ' + err.message });
  }
});

app.post('/api/calendar', async (req, res) => {
  const { day_of_week, outfit_name, items_ids, description } = req.body;
  if (!day_of_week || !outfit_name || !items_ids || !Array.isArray(items_ids)) {
    return res.status(400).json({ error: 'Faltan parámetros requeridos (day_of_week, outfit_name, items_ids).' });
  }

  try {
    const outfitResult = await dbQuery.run(
      'INSERT INTO outfits (name, description) VALUES (?, ?)',
      [outfit_name, description || 'Sugerido por el Asistente']
    );
    const outfitId = outfitResult.id;

    const stmt = dbQuery.db.prepare('INSERT INTO outfit_items (outfit_id, clothing_id) VALUES (?, ?)');
    items_ids.forEach(cid => stmt.run(outfitId, cid));
    stmt.finalize();

    await dbQuery.run(
      'UPDATE calendar SET outfit_id = ? WHERE day_of_week = ?',
      [outfitId, day_of_week.toLowerCase()]
    );

    res.json({ success: true, message: `Outfit guardado para el ${day_of_week}` });
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar en el calendario: ' + err.message });
  }
});

app.delete('/api/calendar/:day', async (req, res) => {
  const { day } = req.params;
  try {
    const cal = await dbQuery.get('SELECT outfit_id FROM calendar WHERE day_of_week = ?', [day.toLowerCase()]);
    if (cal && cal.outfit_id) {
      await dbQuery.run('DELETE FROM outfits WHERE id = ?', [cal.outfit_id]);
    }
    await dbQuery.run('UPDATE calendar SET outfit_id = NULL WHERE day_of_week = ?', [day.toLowerCase()]);
    res.json({ success: true, message: `Calendario del día ${day} limpiado.` });
  } catch (err) {
    res.status(500).json({ error: 'Error al limpiar el día del calendario: ' + err.message });
  }
});

// 10. Asistente inteligente con la API de Gemini (ruteado por Edge Function con fallback)
app.post('/api/assistant', async (req, res) => {
  const { prompt, gemini_key, weather, profile } = req.body;
  if (!gemini_key) {
    return res.status(400).json({ error: 'La clave de API de Gemini es requerida.' });
  }

  // Intentar llamar a la nueva Supabase Edge Function
  try {
    // Intentar leer URL de Supabase del archivo .env local
    let supabaseUrl = process.env.SUPABASE_URL;
    let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    try {
      const envPath = path.join(__dirname, '.env');
      if (fs.existsSync(envPath)) {
        const envLines = fs.readFileSync(envPath, 'utf-8').split('\n');
        for (const line of envLines) {
          if (line.startsWith('SUPABASE_URL=')) {
            supabaseUrl = line.split('=')[1].trim();
          }
          if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
            serviceKey = line.split('=')[1].trim();
          }
        }
      }
    } catch (e) {
      // Ignorar fallos de lectura manual de .env
    }

    // Si no está configurada o es la de por defecto, apuntamos a la local
    const useLocal = !supabaseUrl || supabaseUrl.includes('tu-proyecto');
    const edgeUrl = useLocal 
      ? 'http://localhost:54321/functions/v1/fashion-agent' 
      : `${supabaseUrl}/functions/v1/fashion-agent`;

    console.log(`[Assistant] Intentando conectar con Supabase Edge Function en: ${edgeUrl}`);

    const edgeResponse = await axios.post(edgeUrl, {
      query: prompt,
      userEmail: profile?.email || 'test@example.com'
    }, {
      headers: {
        'Authorization': `Bearer ${serviceKey || 'YOUR_SERVICE_ROLE_KEY'}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    const edgeData = edgeResponse.data;
    const outfitIds = edgeData.suggestedIds || [];
    
    // Obtener los objetos de prendas desde SQLite usando los IDs recomendados
    let recommendedClothes = [];
    if (outfitIds.length > 0) {
      const placeholders = outfitIds.map(() => '?').join(',');
      recommendedClothes = await dbQuery.all(`SELECT * FROM clothes WHERE id IN (${placeholders})`, outfitIds);
    }

    console.log(`[Assistant] Edge Function respondió con éxito. ${recommendedClothes.length} prendas recomendadas.`);
    return res.json({
      reply: edgeData.text,
      outfit: recommendedClothes
    });

  } catch (edgeError) {
    console.warn(`[Assistant] Edge Function no disponible (${edgeError.message}). Usando fallback directo de Gemini.`);
    
    // Fallback original si no está levantado Supabase
    try {
      let query = "SELECT * FROM clothes WHERE status = 'clean'";
      let params = [];
      if (profile?.gender === 'Masculino') {
        query += " AND gender IN ('hombre', 'unisex')";
      } else if (profile?.gender === 'Femenino') {
        query += " AND gender IN ('mujer', 'unisex')";
      }
      const clothes = await dbQuery.all(query, params);

      const clothesInfo = clothes.map(c => `ID: ${c.id}, Nombre: ${c.name}, Categoría: ${c.category}, Color: ${c.color}, Estilo: ${c.style}, Marca: ${c.brand}`).join('\n');
      
      const userName = profile?.name || 'Usuario';
      const userGender = profile?.gender || 'Sin especificar';
      const temp = weather?.currentTemp !== undefined ? weather.currentTemp : 15;
      const rainProb = weather?.rainProbability !== undefined ? weather.rainProbability : 0;

      const systemPrompt = `Eres Aura, una estilista personal inteligente para un clóset virtual. 
Tu usuario se llama ${userName} y su género es ${userGender}.
El clima actual en su ciudad es de ${temp}°C con una probabilidad de lluvia del ${rainProb}%.

El usuario te ha pedido: "${prompt}"

Tu tarea es seleccionar el outfit perfecto de entre las siguientes prendas limpias de su clóset:
${clothesInfo}

Instrucciones obligatorias:
1. Selecciona un conjunto coherente (típicamente 1 Top + 1 Bottom + 1 Calzado, o bien 1 Vestido + 1 Calzado. Añade abrigo (jacket) si la temperatura es menor a 16°C o si llueve).
2. Si el género del usuario es "Masculino", NO incluyas vestidos (categoría 'dresses'), a menos que el usuario lo solicite explícitamente en su mensaje.
3. El outfit sugerido debe ceñirse a las prendas reales listadas arriba (usa los IDs numéricos exactos de las prendas proporcionadas).
4. Devuelve un objeto JSON estrictamente válido con la siguiente estructura:
{
  "reply": "Tu recomendación explicada de manera profesional y amigable en español, detallando por qué combina bien para el clima y la ocasión.",
  "outfit_ids": [id1, id2, ...]
}`;

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${gemini_key}`;
      const response = await axios.post(geminiUrl, {
        contents: [{ parts: [{ text: systemPrompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      }, { timeout: 10000 });

      const responseText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!responseText) {
        throw new Error('Respuesta vacía de Gemini');
      }

      const result = JSON.parse(responseText.trim());
      const outfitIds = result.outfit_ids || [];
      const recommendedClothes = clothes.filter(c => outfitIds.includes(c.id));

      return res.json({
        reply: result.reply,
        outfit: recommendedClothes
      });

    } catch (err) {
      console.error('Error en fallback directo de Gemini:', err);
      return res.status(500).json({ error: 'Error al procesar la sugerencia con Gemini: ' + err.message });
    }
  }
});

// Catch-all para servir la app de React en producción
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor virtual-closet corriendo en http://localhost:${PORT}`);
});
