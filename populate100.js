const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'closet.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error al conectar con la base de datos SQLite:', err.message);
    process.exit(1);
  }
  console.log('Conectado con éxito a la base de datos SQLite.');
  populateDatabase();
});

// Arreglos de metadatos para combinaciones realistas
const brands = [
  'Zara', 'H&M', 'Nike', 'Adidas', 'Levi\'s', 
  'Mango', 'Pull&Bear', 'Uniqlo', 'Patagonia', 'Lacoste',
  'Massimo Dutti', 'Diesel', 'ASOS', 'The North Face', 'Tommy Hilfiger'
];

const colors = [
  'Negro', 'Blanco', 'Azul Marino', 'Gris Oxford', 'Beige', 
  'Verde Oliva', 'Marrón Café', 'Rojo Burdeos', 'Rosa Pastel', 'Mostaza'
];

const stores = [
  'Zara Serrano', 'H&M Gran Vía', 'Nike Store Fuencarral', 'Adidas Flagship Store', 'El Corte Inglés Castellana', 
  'Mango Premium', 'Pull&Bear Portal de l\'Àngel', 'Uniqlo Passeig de Gràcia', 'Patagonia Madrid', 'Lacoste Outlet',
  'Massimo Dutti Online', 'Diesel Store', 'ASOS Web', 'The North Face Shop', 'Tommy Hilfiger Mall'
];

// Plantillas por categoría
const templates = {
  tops: {
    names: [
      'Camiseta de Algodón Orgánico', 'Camisa de Lino Casual', 'Polo Piqué Clásico', 'Sudadera con Capucha Sport', 
      'Jersey de Punto Trenzado', 'Top Corto de Canalé', 'Camisa Oxford Formal', 'Camiseta Estampada Vintage', 
      'Camiseta de Manga Larga', 'Jersey de Cuello Alto', 'Sudadera Crewneck Básica', 'Camisa Vaquera Denim',
      'Camiseta de Cuello V', 'Polo Modern Fit', 'Jersey de Cashmere Premium'
    ],
    images: [
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1603252109303-2751441dd157?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=600&auto=format&fit=crop&q=80'
    ]
  },
  bottoms: {
    names: [
      'Jeans Slim Fit Elásticos', 'Pantalón Chino Clásico', 'Pantalón de Lino Fresco', 'Bermudas de Gabardina', 
      'Pantalón de Chándal Active', 'Falda Plisada Midi', 'Jeans Rectos Clásicos', 'Shorts Vaqueros Desgastados', 
      'Pantalón Cargo Técnico', 'Pantalón de Vestir Regular', 'Joggers Slim de Felpa', 'Leggings Deportivos',
      'Shorts de Correr Ligeros', 'Bermudas Vaqueras', 'Pantalón Chino Slim Fit'
    ],
    images: [
      'https://images.unsplash.com/photo-1542272604-787c3835535d?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1582562124811-c09040d0a901?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1565079888546-55047b19669a?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1604176354204-9268737828e4?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1509551388413-e18d0ac5d495?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=600&auto=format&fit=crop&q=80'
    ]
  },
  jackets: {
    names: [
      'Cazadora Bomber Ligera', 'Chaqueta Vaquera Trucker', 'Abrigo de Lana Cruzado', 'Cortavientos Impermeable', 
      'Blazer Estructurado Casual', 'Parka con Capucha Térmica', 'Cazadora de Piel Sintética', 'Chaqueta de Plumón Ligera', 
      'Cardigan de Punto Grueso', 'Trench Clásico Elegante', 'Sobrecamisa de Pana', 'Chaleco Acolchado Técnico',
      'Chaqueta Blazer Formal', 'Abrigo Largo Minimalista', 'Cortavientos Deportivo'
    ],
    images: [
      'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1611312449412-6cefac5dc3e4?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1548883354-7622d03aca27?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1544923246-77307dd654cb?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1620331311520-246422fd82f9?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=600&auto=format&fit=crop&q=80'
    ]
  },
  shoes: {
    names: [
      'Zapatillas Deportivas Retro', 'Botas Chelsea de Cuero', 'Mocasines de Ante Casual', 'Zapatillas de Running Pro', 
      'Sandalias de Piel Cómodas', 'Zapatos Derby de Vestir', 'Zapatillas de Lona Clásicas', 'Botines de Cordones Rústicos', 
      'Zapatillas Altas de Baloncesto', 'Chanclas Deportivas Slip', 'Zapatillas de Skate Planas', 'Zapatos Náuticos de Piel',
      'Botas de Montaña Técnicas', 'Mocasines Elegantes de Piel', 'Zapatillas Urbanas Luminous'
    ],
    images: [
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1512374382149-433853003064?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1539185441755-769473a23570?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=600&auto=format&fit=crop&q=80'
    ]
  },
  accessories: {
    names: [
      'Gorra Deportiva Ajustable', 'Cinturón de Cuero Reversible', 'Gafas de Sol Polarizadas', 'Mochila Urbana Impermeable', 
      'Bufanda de Lana Suave', 'Bolso Bandolera de Piel', 'Gorro de Lana de Punto', 'Reloj de Pulsera Minimalista', 
      'Cartera de Cuero Slim', 'Sombrero de Paja Fedora', 'Gafas de Aviador Clásicas', 'Bolsa de Deporte Amplia',
      'Cinturón de Lona Sport', 'Mochila para Portátil Shield', 'Bufanda Estampada Ligera'
    ],
    images: [
      'https://images.unsplash.com/photo-1527719327859-c6ce80353573?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1513907707964-b4d4c5b1ea02?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1508296695146-257a814070b4?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1624222247344-550fb8ecfe7c?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1610418629166-4e58b10852e6?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1576243345690-4e4b79b63288?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1572111504021-40afd4d61ea0?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=600&auto=format&fit=crop&q=80'
    ]
  }
};

function populateDatabase() {
  db.serialize(() => {
    // Vaciar tabla de prendas
    db.run('DELETE FROM clothes');
    db.run('DELETE FROM sqlite_sequence WHERE name="clothes"');
    
    console.log('Tabla de prendas vaciada. Generando 100 nuevas prendas...');

    const stmt = db.prepare(`
      INSERT INTO clothes (name, brand, store, category, color, price, image_url, purchase_url, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const categories = ['tops', 'bottoms', 'jackets', 'shoes', 'accessories'];
    const totalItems = 100;

    for (let i = 0; i < totalItems; i++) {
      // Distribución uniforme de categorías: 20 prendas de cada una
      const category = categories[i % 5];
      const categoryData = templates[category];

      // Seleccionar elementos programáticamente usando i para asegurar combinaciones variadas
      const nameTemplate = categoryData.names[Math.floor(i / 5) % categoryData.names.length];
      const brand = brands[i % brands.length];
      const color = colors[(i + Math.floor(i / brands.length)) % colors.length];
      const store = stores[i % stores.length];
      const imageUrl = categoryData.images[i % categoryData.images.length];

      // Nombre completo del producto
      const name = `${nameTemplate} ${brand} (${color})`;

      // Precio realista basado en la categoría
      let priceBase = 15;
      if (category === 'jackets') priceBase = 59;
      else if (category === 'shoes') priceBase = 49;
      else if (category === 'accessories') priceBase = 12;
      const price = parseFloat((priceBase + (i % 7) * 12 + Math.floor(i / 13) * 5 + 0.95).toFixed(2));

      // URL de compra ficticia
      const cleanBrand = brand.toLowerCase().replace(/\'/g, '').replace(' ', '');
      const cleanName = nameTemplate.toLowerCase().replace(/ /g, '-');
      const purchaseUrl = `https://www.${cleanBrand}.com/es/product/${cleanName}-${i}`;

      // Estado de lavandería (aproximadamente el 12% de las prendas estará en la lavandería/sucio)
      const status = (i % 8 === 0) ? 'dirty' : 'clean';

      stmt.run(name, brand, store, category, color, price, imageUrl, purchaseUrl, status);
    }

    stmt.finalize((err) => {
      if (err) {
        console.error('Error al insertar las prendas en la base de datos:', err.message);
      } else {
        console.log('¡Con éxito se han añadido 100 prendas variadas al clóset virtual!');
      }
      db.close(() => {
        console.log('Conexión con base de datos cerrada.');
      });
    });
  });
}
