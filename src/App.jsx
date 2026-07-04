import React, { useState, useEffect, useRef } from 'react';
import WeatherCard from './components/WeatherCard.jsx';
import Icon from './components/Icon.jsx';
import { fetchWeather } from './services/weatherService.js';
import { recommendOutfit } from './services/outfitService.js';

export default function App() {
  // ==========================================
  // ESTADOS GLOBALES DE LA APLICACIÓN
  // ==========================================
  const [activePanel, setActivePanel] = useState('dashboard');
  const [clothes, setClothes] = useState([]);
  const [calendar, setCalendar] = useState([]);
  const [stats, setStats] = useState({
    total_items: 0,
    dirty_items: 0,
    lent_items: 0,
    clean_items: 0,
    total_value: 0,
    top_brands: [],
    categories: []
  });
  const [weather, setWeather] = useState(null);
  
  const [profile, setProfile] = useState(() => {
    const saved = localStorage.getItem('user_profile');
    const defaultProfile = { name: '', gender: 'Sin especificar', email: '' };
    if (!saved) return defaultProfile;
    try {
      return { ...defaultProfile, ...JSON.parse(saved) };
    } catch (e) {
      return defaultProfile;
    }
  });
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileInput, setProfileInput] = useState(profile);
  
  // Asistente
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [chatMessages, setChatMessages] = useState([
    {
      text: '¡Hola! Soy Aura, tu estilista personal. Ya cargué el reporte de clima en Santiago. Dime, ¿para qué ocasión u evento quieres vestirte hoy? O si tienes una combinación en mente, dímelo y la complementaré.',
      sender: 'assistant'
    }
  ]);
  const [assistantInput, setAssistantInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentRecommendation, setCurrentRecommendation] = useState(null);
  const [outfitStyleBadge, setOutfitStyleBadge] = useState('Casual');
  const [saveCalendarDay, setSaveCalendarDay] = useState('lunes');

  // Modales
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [geminiKeyInput, setGeminiKeyInput] = useState(geminiKey);

  // Filtros de Clóset
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStyle, setSelectedStyle] = useState('all');
  const [selectedColor, setSelectedColor] = useState('all');
  const [selectedStore, setSelectedStore] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedGender, setSelectedGender] = useState('all');

  // Lista local para búsquedas de tags y subcategorías
  const [closetItemsPool, setClosetItemsPool] = useState([]);
  useEffect(() => {
    import('./data/realClosetProducts.json').then(module => {
      setClosetItemsPool(module.default || module);
    });
  }, []);

  // Agregar Prenda
  const [addTab, setAddTab] = useState('scan'); // scan, url, manual
  const [productUrl, setProductUrl] = useState('');
  const [scrapeLoading, setScrapeLoading] = useState(false);
  
  // Webcam e Imagenes
  const [videoActive, setVideoActive] = useState(false);
  const [tagImagePreview, setTagImagePreview] = useState('');
  const [scanOcrText, setScanOcrText] = useState('// Los datos brutos del escaneo de la etiqueta aparecerán aquí tras procesar la imagen...');
  const [scanStatus, setScanStatus] = useState('waiting'); // waiting, processing, success, error
  const [scrapeLoaderText, setScrapeLoaderText] = useState('Extrayendo metadatos de la tienda y foto oficial...');
  
  // Confirmación de prenda agregada (ahora incluye style)
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmData, setConfirmData] = useState({
    name: '',
    brand: '',
    store: '',
    category: 'tops',
    color: '',
    price: '',
    style: 'Casual',
    gender: 'unisex',
    image_url: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600',
    purchase_url: ''
  });

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // ==========================================
  // CARGA DE DATOS E INICIALIZACIÓN
  // ==========================================
  useEffect(() => {
    fetchStats();
    fetchClothes();
    fetchCalendar();
    
    // Obtener clima de Santiago de Chile
    fetchWeather().then(data => {
      setWeather(data);
    });

    // Mostrar onboarding si falta el perfil o campos obligatorios
    const saved = localStorage.getItem('user_profile');
    if (!saved) {
      setShowProfileModal(true);
    } else {
      try {
        const parsed = JSON.parse(saved);
        if (!parsed.name || !parsed.email || !parsed.gender) {
          setProfileInput({
            name: parsed.name || '',
            gender: parsed.gender || 'Sin especificar',
            email: parsed.email || ''
          });
          setShowProfileModal(true);
        }
      } catch (e) {
        setShowProfileModal(true);
      }
    }
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (e) {
      console.error('Error al consultar estadísticas:', e);
    }
  };

  const fetchClothes = async () => {
    try {
      const response = await fetch('/api/clothes');
      if (response.ok) {
        const data = await response.json();
        setClothes(data);
      }
    } catch (e) {
      console.error('Error al consultar prendas:', e);
    }
  };

  const fetchCalendar = async () => {
    try {
      const response = await fetch('/api/calendar');
      if (response.ok) {
        const data = await response.json();
        setCalendar(data);
      }
    } catch (e) {
      console.error('Error al consultar calendario:', e);
    }
  };

  const translateCategory = (cat) => {
    const translation = {
      'tops': 'Partes Superiores / Tops',
      'bottoms': 'Partes Inferiores / Pantalones',
      'dresses': 'Vestidos',
      'jackets': 'Abrigos',
      'shoes': 'Zapatos',
      'accessories': 'Accesorios',
      'bags': 'Bolsos',
      'sportswear': 'Ropa Deportiva'
    };
    return translation[cat] || cat;
  };

  // ==========================================
  // ACCIONES: MODIFICAR PRENDAS Y LAVANDERÍA
  // ==========================================
  const toggleGarmentStatus = async (id, currentStatus) => {
    // Rotar estados: clean -> dirty -> lent -> clean
    let nextStatus = 'clean';
    if (currentStatus === 'clean') nextStatus = 'dirty';
    else if (currentStatus === 'dirty') nextStatus = 'lent';

    try {
      const response = await fetch(`/api/clothes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      if (response.ok) {
        // Actualizar localmente
        setClothes(prev => prev.map(c => c.id === id ? { ...c, status: nextStatus } : c));
        fetchStats();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteGarment = async (id, name) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar "${name}" de tu clóset?`)) return;
    try {
      const response = await fetch(`/api/clothes/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setClothes(prev => prev.filter(c => c.id !== id));
        fetchStats();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const clearCalendarDay = async (day) => {
    try {
      const response = await fetch(`/api/calendar/${day}`, { method: 'DELETE' });
      if (response.ok) {
        fetchCalendar();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ==========================================
  // FILTRADO DEL CLÓSET
  // ==========================================
  const getUniqueValues = (key) => {
    const values = clothes.map(c => c[key]).filter(v => v);
    return ['all', ...new Set(values)];
  };

  const filteredClothes = clothes.filter(item => {
    // Filtro Categoría
    if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
    
    // Filtro Estado (lavandería)
    if (selectedStatus !== 'all' && item.status !== selectedStatus) return false;
    
    // Filtro Tienda (ej. Falabella, H&M)
    if (selectedStore !== 'all' && !item.store.toLowerCase().includes(selectedStore.toLowerCase())) return false;
    
    // Filtro Color
    if (selectedColor !== 'all' && item.color !== selectedColor) return false;

    // Filtro Estilo/Ocasión
    if (selectedStyle !== 'all' && item.style !== selectedStyle) return false;

    // Filtro Género
    if (selectedGender !== 'all') {
      const itemGender = (item.gender || 'unisex').toLowerCase();
      if (selectedGender === 'mujer' && itemGender === 'hombre') return false;
      if (selectedGender === 'hombre' && itemGender === 'mujer') return false;
      if (selectedGender === 'unisex' && itemGender !== 'unisex') return false;
    }

    // Filtro de Texto (Buscador: nombre, marca, tienda, color o tags)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const name = (item.name || '').toLowerCase();
      const brand = (item.brand || '').toLowerCase();
      const store = (item.store || '').toLowerCase();
      const color = (item.color || '').toLowerCase();
      const matchesText = name.includes(query) || brand.includes(query) || store.includes(query) || color.includes(query);
      
      // Buscar también en los closetItems locales si coincide la tag o subcategory
      const localItem = closetItemsPool.find(p => {
        const pNumId = parseInt(String(p.id).replace(/[^\d]/g, ''));
        return pNumId === item.id;
      });
      const matchesTags = localItem && (
        (localItem.occasionTags || localItem.tags || []).some(t => t.toLowerCase().includes(query)) ||
        localItem.subcategory.toLowerCase().includes(query) ||
        (Array.isArray(localItem.style)
          ? localItem.style.some(s => s.toLowerCase().includes(query))
          : localItem.style.toLowerCase().includes(query))
      );

      return matchesText || matchesTags;
    }

    return true;
  });

  // Lista local para búsquedas de tags y subcategorías cargada al inicio

  // ==========================================
  // INTEGRACIÓN DEL ASISTENTE DE OUTFITS
  // ==========================================
  const handleSendAssistant = async () => {
    const text = assistantInput.trim();
    if (!text) return;

    // Agregar mensaje de usuario
    setChatMessages(prev => [...prev, { text, sender: 'user' }]);
    setAssistantInput('');
    setIsTyping(true);

    try {
      // 1. Obtener clima actual (o mock si no ha cargado)
      const currentWeather = weather || { currentTemp: 15, rainProbability: 0, currentRain: 0 };

      // 2. Si hay Gemini Key, podemos hacer el desvío al backend
      if (geminiKey && geminiKey.length > 10) {
        const response = await fetch('/api/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            prompt: text, 
            gemini_key: geminiKey,
            weather: currentWeather,
            profile: profile
          })
        });
        if (response.ok) {
          const data = await response.json();
          setIsTyping(false);
          setChatMessages(prev => [...prev, { text: data.reply, sender: 'assistant' }]);
          if (data.outfit && data.outfit.length > 0) {
            setCurrentRecommendation(data.outfit);
            guessStyleBadge(data.outfit);
          }
          return;
        }
      }

      // 3. Fallback: Usar el Outfit Service en el cliente (motor inteligente)
      // Buscamos detalles más ricos de cada prenda mapeándolo al pool estático o infiriendo del nombre si es catálogo
      const enrichedClothes = clothes.map(c => {
        const poolItem = closetItemsPool.find(p => {
          const pNumId = parseInt(String(p.id).replace(/[^\d]/g, ''));
          return pNumId === c.id;
        });

        let subcategory = '';
        let season = 'Todo el año';
        let formalityLevel = 2;
        let temperatureMin = 10;
        let temperatureMax = 25;
        let rainFriendly = false;
        let tags = [];

        let itemStyle = c.style || 'Casual';
        const nameLower = (c.name || '').toLowerCase();

        // Inferir formalidad y etiquetas
        if (itemStyle === 'Formal') {
          formalityLevel = 4;
          tags.push('formal', 'trabajo', 'oficina');
        } else if (itemStyle === 'Deportivo') {
          formalityLevel = 1;
          tags.push('deporte', 'ejercicio', 'gym');
        } else if (itemStyle === 'Eventos de Ocasión') {
          formalityLevel = 4;
          tags.push('noche', 'fiesta', 'evento');
        } else {
          formalityLevel = 2;
          tags.push('casual', 'cómodo');
        }

        if (nameLower.includes('lana') || nameLower.includes('abrigo') || nameLower.includes('parka') || nameLower.includes('polerón') || nameLower.includes('polar') || nameLower.includes('invierno') || nameLower.includes('chaleco')) {
          temperatureMin = 0;
          temperatureMax = 15;
          season = 'Invierno';
        } else if (nameLower.includes('corto') || nameLower.includes('vestido') || nameLower.includes('short') || nameLower.includes('falda') || nameLower.includes('polera') || nameLower.includes('verano') || nameLower.includes('sandalia') || nameLower.includes('tirantes')) {
          temperatureMin = 18;
          temperatureMax = 35;
          season = 'Verano';
        }

        if (nameLower.includes('impermeable') || nameLower.includes('parka') || nameLower.includes('cortaviento') || nameLower.includes('bota')) {
          rainFriendly = true;
        }

        // Subcategorías comunes para lógica fina
        if (nameLower.includes('jean')) subcategory = 'Jeans';
        else if (nameLower.includes('pantal')) subcategory = 'Pantalón';
        else if (nameLower.includes('short')) subcategory = 'Shorts';
        else if (nameLower.includes('falda')) subcategory = 'Falda';
        else if (nameLower.includes('polera') || nameLower.includes('camiseta')) subcategory = 'Polera';
        else if (nameLower.includes('camisa')) subcategory = 'Camisa';
        else if (nameLower.includes('blusa')) subcategory = 'Blusa';
        else if (nameLower.includes('sweater') || nameLower.includes('chaleco')) subcategory = 'Sweater';
        else if (nameLower.includes('chaqueta')) subcategory = 'Chaqueta';
        else if (nameLower.includes('abrigo')) subcategory = 'Abrigo';
        else if (nameLower.includes('zapatilla')) subcategory = 'Zapatillas';
        else if (nameLower.includes('bota')) subcategory = 'Botas';

        return {
          ...c,
          subcategory: poolItem ? poolItem.subcategory : subcategory,
          season: poolItem ? poolItem.season : season,
          style: itemStyle,
          formalityLevel: poolItem ? poolItem.formalityLevel : formalityLevel,
          temperatureMin: poolItem ? poolItem.temperatureMin : temperatureMin,
          temperatureMax: poolItem ? poolItem.temperatureMax : temperatureMax,
          rainFriendly: poolItem ? poolItem.rainFriendly : rainFriendly,
          tags: poolItem ? (poolItem.occasionTags || poolItem.tags || []) : tags
        };
      });

      const recommendation = recommendOutfit(enrichedClothes, text, currentWeather, profile);
      
      // Simular delay para dar realismo tecnológico
      setTimeout(() => {
        setIsTyping(false);
        setChatMessages(prev => [...prev, { text: recommendation.reply, sender: 'assistant' }]);
        if (recommendation.success) {
          setCurrentRecommendation(recommendation.outfit);
          setOutfitStyleBadge(recommendation.style);
        }
      }, 1000);

    } catch (e) {
      setIsTyping(false);
      setChatMessages(prev => [...prev, { 
        text: 'Error del asistente de estilo. Asegúrate de tener prendas limpias y de estar conectado.', 
        sender: 'assistant' 
      }]);
      console.error(e);
    }
  };

  const guessStyleBadge = (items) => {
    const text = items.map(i => i.name).join(' ').toLowerCase();
    if (text.includes('deportivo') || text.includes('running') || text.includes('chándal')) {
      setOutfitStyleBadge('Deportivo');
    } else if (text.includes('vestir') || text.includes('sastrero') || text.includes('blazer')) {
      setOutfitStyleBadge('Formal');
    } else {
      setOutfitStyleBadge('Casual');
    }
  };

  const saveOutfitToCalendar = async () => {
    if (!currentRecommendation || currentRecommendation.length === 0) return;
    const itemsIds = currentRecommendation.map(i => i.id);
    const outfitName = `Outfit ${outfitStyleBadge} (${saveCalendarDay.charAt(0).toUpperCase() + saveCalendarDay.slice(1)})`;

    try {
      const response = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day_of_week: saveCalendarDay,
          outfit_name: outfitName,
          items_ids: itemsIds,
          description: `Sugerido por Aura para el día ${saveCalendarDay}`
        })
      });
      if (response.ok) {
        alert(`¡Outfit asignado al ${saveCalendarDay} con éxito!`);
        switchPanel('dashboard');
      }
    } catch (e) {
      console.error(e);
      alert('Fallo al guardar en el calendario.');
    }
  };

  // ==========================================
  // ESCÁNER OCR Y SCRAPING POR ENLACE
  // ==========================================
  
  // Activar cámara
  const startCamera = async () => {
    try {
      setVideoActive(true);
      setTagImagePreview('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (e) {
      alert('No se pudo acceder a la cámara. Prueba cargando una imagen.');
      setVideoActive(false);
      console.error(e);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setVideoActive(false);
  };

  // Capturar foto y simular escaneo
  const captureAndScan = async () => {
    if (!videoRef.current) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    
    stopCamera();

    canvas.toBlob(async (blob) => {
      const file = new File([blob], "tag-scan.jpg", { type: "image/jpeg" });
      setTagImagePreview(URL.createObjectURL(blob));
      await uploadAndProcessTag(file);
    }, 'image/jpeg');
  };

  const handleTagUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setTagImagePreview(URL.createObjectURL(file));
    stopCamera();
    await uploadAndProcessTag(file);
  };

  const uploadAndProcessTag = async (file) => {
    setScanStatus('processing');
    setScanOcrText('// Iniciando módulo de Visión Artificial...\n// Analizando etiqueta del producto...');
    
    const formData = new FormData();
    formData.append('tag_image', file);

    try {
      const response = await fetch('/api/scan-tag', { method: 'POST', body: formData });
      if (!response.ok) throw new Error('Error en escaneo');
      const data = await response.json();
      
      setScanStatus('success');
      setScanOcrText(`// OCR COMPLETADO CON ÉXITO\n// TEXTO DETECTADO:\n\n${data.raw_ocr}`);
      
      // Auto prellenar formulario de confirmación
      setTimeout(() => {
        setConfirmData({ style: 'Casual', ...data.detected_details });
        setIsConfirming(true);
      }, 800);
    } catch (e) {
      setScanStatus('error');
      setScanOcrText('// ERROR EN ESCANEO: No se pudo conectar con el motor de IA.');
      console.error(e);
    }
  };

  // Buscar por enlace (Scraper)
  const handleScrapeProduct = async () => {
    if (!productUrl || !productUrl.startsWith('http')) {
      alert('Pega un enlace de tienda válido.');
      return;
    }
    setScrapeLoading(true);
    setIsConfirming(false);

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: productUrl })
      });
      if (!response.ok) throw new Error('Fallo en búsqueda');
      const data = await response.json();
      setConfirmData({ style: 'Casual', ...data });
      setIsConfirming(true);
    } catch (e) {
      alert('No pudimos extraer datos automáticamente. Se abrió el formulario manual.');
      setConfirmData({
        name: 'Prenda Importada',
        brand: '',
        store: 'Online',
        category: 'tops',
        color: '',
        price: '',
        style: 'Casual',
        image_url: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600',
        purchase_url: productUrl
      });
      setIsConfirming(true);
    } finally {
      setScrapeLoading(false);
    }
  };

  // Subir imagen en formulario de confirmación
  const handleConfirmImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      if (response.ok) {
        const data = await response.json();
        setConfirmData(prev => ({ ...prev, image_url: data.image_url }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveGarment = async () => {
    if (!confirmData.name || !confirmData.store) {
      alert('Nombre y tienda son obligatorios.');
      return;
    }
    try {
      const response = await fetch('/api/clothes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(confirmData)
      });
      if (response.ok) {
        alert('¡Prenda guardada con éxito!');
        setIsConfirming(false);
        setProductUrl('');
        setTagImagePreview('');
        setScanStatus('waiting');
        setScanOcrText('// Los datos brutos del escaneo de la etiqueta aparecerán aquí tras procesar la imagen...');
        
        fetchClothes();
        fetchStats();
        switchPanel('closet');
      }
    } catch (e) {
      console.error(e);
      alert('Fallo al guardar.');
    }
  };

  // ==========================================
  // CONFIGURACIÓN DE GEMINI KEY
  // ==========================================
  const handleSaveGeminiKey = () => {
    const key = geminiKeyInput.trim();
    if (!key) return;
    setGeminiKey(key);
    localStorage.setItem('gemini_api_key', key);
    setShowKeyModal(false);
    alert('Clave de Gemini API guardada.');
  };

  const handleClearGeminiKey = () => {
    setGeminiKey('');
    setGeminiKeyInput('');
    localStorage.removeItem('gemini_api_key');
    setShowKeyModal(false);
    alert('Clave de Gemini API de-registrada.');
  };

  const handleSaveProfile = () => {
    const { name, gender, email } = profileInput;
    if (!name || !name.trim() || !email || !email.trim()) {
      alert('El nombre y correo electrónico son obligatorios.');
      return;
    }
    if (!gender || gender === 'Sin especificar' || gender === '') {
      alert('Por favor, selecciona tu género (Femenino, Masculino o Ambos / Unisex) para adaptar las recomendaciones de tu clóset.');
      return;
    }
    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      alert('Por favor introduce un correo electrónico válido.');
      return;
    }

    const updatedProfile = {
      name: name.trim(),
      gender: gender,
      email: email.trim()
    };

    setProfile(updatedProfile);
    localStorage.setItem('user_profile', JSON.stringify(updatedProfile));
    setShowProfileModal(false);
    alert('Perfil guardado correctamente.');
  };

  return (
    <div className="mac-app-container">
      
      {/* BARRA LATERAL (サイドバー) */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="window-controls">
            <span className="control close"></span>
            <span className="control minimize"></span>
            <span className="control maximize"></span>
          </div>
          <div className="brand-title">
            <div className="brand-logo">
              <Icon name="sparkles" />
            </div>
            <h2>Aura Closet</h2>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-group-title">Navegación</div>
          <a href="#dashboard" 
             className={`nav-item ${activePanel === 'dashboard' ? 'active' : ''}`}
             onClick={(e) => { e.preventDefault(); switchPanel('dashboard'); }}>
            <Icon name="layout-dashboard" />
            <span>Dashboard</span>
          </a>
          <a href="#closet" 
             className={`nav-item ${activePanel === 'closet' ? 'active' : ''}`}
             onClick={(e) => { e.preventDefault(); switchPanel('closet'); }}>
            <Icon name="shirt" />
            <span>Mi Clóset</span>
          </a>
          <a href="#add-item" 
             className={`nav-item ${activePanel === 'add-item' ? 'active' : ''}`}
             onClick={(e) => { e.preventDefault(); switchPanel('add-item'); }}>
            <Icon name="plus-circle" />
            <span>Añadir Prenda</span>
          </a>
          <a href="#assistant" 
             className={`nav-item ${activePanel === 'assistant' ? 'active' : ''}`}
             onClick={(e) => { e.preventDefault(); switchPanel('assistant'); }}>
            <Icon name="sparkles" />
            <span>Asistente de Outfits</span>
          </a>
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile" onClick={() => { setProfileInput(profile); setShowProfileModal(true); }} style={{ cursor: 'pointer' }} title="Hacer clic para editar perfil">
            <div className="avatar">
              {profile.name ? profile.name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'JG'}
            </div>
            <div className="user-info">
              <span className="user-name">{profile.name || 'Usuario'}</span>
              <span className="user-status">{profile.email || 'Editar Perfil'}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ÁREA DE CONTENIDO PRINCIPAL */}
      <main className="main-content">
        
        {/* ================= PANEL: DASHBOARD ================= */}
        {activePanel === 'dashboard' && (
          <section className="content-panel active">
            <header className="panel-header">
              <div>
                <h1>Hola, {profile.name ? profile.name.split(' ')[0] : 'Usuario'}</h1>
                <p className="subtitle">Este es el estado actual de tu guardarropa virtual.</p>
              </div>
              <div className="header-actions">
                <span className="date-badge" id="current-date">Santiago, Chile</span>
              </div>
            </header>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon purple"><Icon name="shirt" /></div>
                <div className="stat-data">
                  <span className="stat-value">{stats.total_items}</span>
                  <span className="stat-label">Prendas Totales</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon green"><Icon name="droplet" /></div>
                <div className="stat-data">
                  <span className="stat-value">{stats.clean_items}</span>
                  <span className="stat-label">Prendas Limpias</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon orange"><Icon name="flame-kindling" /></div>
                <div className="stat-data">
                  <span className="stat-value">{stats.dirty_items}</span>
                  <span className="stat-label">En Lavadora</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon blue"><Icon name="gem" /></div>
                <div className="stat-data">
                  <span className="stat-value">{stats.lent_items}</span>
                  <span className="stat-label">Prestadas</span>
                </div>
              </div>
            </div>

            <div className="dashboard-details-grid">
              <div className="details-card calendar-section">
                <div className="card-header">
                  <h3><Icon name="calendar" /> Planificador Semanal de Outfits</h3>
                  <p>Organiza tus outfits recomendados para cada día</p>
                </div>
                <div className="weekly-calendar">
                  <div className="calendar-days-container">
                    {['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'].map(day => {
                      const calData = calendar.find(c => c.day_of_week === day);
                      return (
                        <div key={day} className="cal-day-column">
                          <span className="cal-day-name">{day}</span>
                          <div className="cal-outfit-box">
                            {calData && calData.outfit_id ? (
                              <div className="cal-filled-outfit">
                                <button className="btn-delete-cal" onClick={() => clearCalendarDay(day)}>×</button>
                                <div className="cal-outfit-images">
                                  {calData.items && calData.items.slice(0, 4).map(item => (
                                    <img key={item.id} src={item.image_url} alt={item.name} />
                                  ))}
                                </div>
                                <span className="cal-outfit-title" title={calData.outfit_name}>{calData.outfit_name}</span>
                              </div>
                            ) : (
                              <div className="cal-empty-slot" onClick={() => {
                                switchPanel('assistant');
                                setSaveCalendarDay(day);
                              }}>
                                <Icon name="sparkles" />
                                <span>Sugerir</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* CLIMA DE SANTIAGO */}
              <div className="dashboard-details-sidebar">
                <WeatherCard weather={weather} />
              </div>
            </div>
          </section>
        )}

        {/* ================= PANEL: MI CLÓSET ================= */}
        {activePanel === 'closet' && (
          <section className="content-panel active">
            <header className="panel-header">
              <div>
                <h1>Mi Clóset Virtual</h1>
                <p className="subtitle">Explora y gestiona tus prendas guardadas ({filteredClothes.length} visibles).</p>
              </div>
              <div className="header-actions">
                <button className="btn btn-primary btn-mac" onClick={() => { switchPanel('add-item'); setAddTab('manual'); }}>
                  <Icon name="plus" /> Nueva Prenda
                </button>
              </div>
            </header>

            {/* Barra de Filtros Avanzados */}
            <div className="filter-bar" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
              <div className="search-input-wrapper" style={{ gridColumn: 'span 2' }}>
                <Icon name="search" className="search-icon" />
                <input type="text" placeholder="Buscar por nombre, marca, color o tag..." 
                       value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <div className="filter-group">
                <select className="mac-select" value={selectedStyle} onChange={(e) => setSelectedStyle(e.target.value)}>
                  <option value="all">Todos los Estilos</option>
                  <option value="Casual">Casual</option>
                  <option value="Formal">Formal</option>
                  <option value="Deportivo">Deportivo</option>
                  <option value="Eventos de Ocasión">Eventos de Ocasión</option>
                </select>
              </div>
              <div className="filter-group">
                <select className="mac-select" value={selectedColor} onChange={(e) => setSelectedColor(e.target.value)}>
                  <option value="all">Todos los Colores</option>
                  {getUniqueValues('color').filter(c => c !== 'all').map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <select className="mac-select" value={selectedStore} onChange={(e) => setSelectedStore(e.target.value)}>
                  <option value="all">Todas las Tiendas</option>
                  <option value="Falabella">Falabella</option>
                  <option value="Zara">Zara</option>
                  <option value="Paris">Paris</option>
                  <option value="Ripley">Ripley</option>
                  <option value="H&M">H&M</option>
                  <option value="Nike">Nike</option>
                  <option value="Adidas">Adidas</option>
                  <option value="Under Armour">Under Armour</option>
                  <option value="De Moda">De Moda</option>
                  <option value="Arrow">Arrow</option>
                  <option value="Mango">Mango</option>
                </select>
              </div>
              <div className="filter-group">
                <select className="mac-select" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
                  <option value="all">Todos los Estados</option>
                  <option value="clean">Limpio</option>
                  <option value="dirty">En Lavadora</option>
                  <option value="lent">Prestado</option>
                </select>
              </div>
              <div className="filter-group">
                <select className="mac-select" value={selectedGender} onChange={(e) => setSelectedGender(e.target.value)}>
                  <option value="all">Género: Todos</option>
                  <option value="mujer">Género: Mujer</option>
                  <option value="hombre">Género: Hombre</option>
                  <option value="unisex">Género: Unisex</option>
                </select>
              </div>
            </div>

            {/* Píldoras de Categoría */}
            <div className="category-pills">
              {['all', 'tops', 'bottoms', 'dresses', 'jackets', 'shoes', 'accessories', 'bags', 'sportswear'].map(cat => (
                <button key={cat} 
                        className={`pill ${selectedCategory === cat ? 'active' : ''}`}
                        onClick={() => setSelectedCategory(cat)}>
                  {cat === 'all' ? 'Todos' : translateCategory(cat)}
                </button>
              ))}
            </div>

            {/* Grid de Ropa */}
            <div className="garment-grid">
              {filteredClothes.map(item => (
                <div key={item.id} className={`garment-card ${item.status}`}>
                  <div className="card-img-wrapper">
                    <img src={item.image_url} alt={item.name} onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600'; }} />
                    <span className="category-tag">{translateCategory(item.category)}</span>
                    <span className="style-tag" style={{
                      position: 'absolute',
                      top: '10px',
                      left: '10px',
                      background: 'rgba(255, 255, 255, 0.85)',
                      backdropFilter: 'blur(4px)',
                      color: '#4f46e5',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontSize: '0.65rem',
                      fontWeight: '700',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      zIndex: 2
                    }}>{item.style || 'Casual'}</span>
                    <button className="btn-delete-garment" onClick={() => deleteGarment(item.id, item.name)} title="Eliminar Prenda">
                      <Icon name="trash-2" />
                    </button>
                  </div>
                  <div className="card-details">
                    <div className="card-title-row">
                      <h4>{item.name}</h4>
                      <div className="card-brand">
                        <span>{item.brand || 'Sin Marca'}</span>
                        <span className={`status-text ${item.status}`}>
                          {item.status === 'clean' ? 'Limpio' : item.status === 'dirty' ? 'Sucio' : 'Prestado'}
                        </span>
                      </div>
                    </div>
                    <div className="card-meta-row" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn btn-secondary" 
                              onClick={() => toggleGarmentStatus(item.id, item.status)}
                              style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                        Cambiar Estado
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              
              {filteredClothes.length === 0 && (
                <div className="empty-state-closet">
                  <Icon name="package-open" className="empty-icon" />
                  <h3>Tu clóset no tiene prendas para mostrar</h3>
                  <p>Prueba ajustando los filtros superiores.</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ================= PANEL: AÑADIR PRENDA ================= */}
        {activePanel === 'add-item' && (
          <section className="content-panel active">
            <header className="panel-header">
              <div>
                <h1>Añadir Nueva Prenda</h1>
                <p className="subtitle">Elige tu método favorito para registrar ropa en tu guardarropa.</p>
              </div>
            </header>

            <div className="add-methods-tabs">
              <button className={`tab-btn ${addTab === 'scan' ? 'active' : ''}`} onClick={() => { setAddTab('scan'); stopCamera(); }}>
                <Icon name="scan" /> Escanear Etiqueta
              </button>
              <button className={`tab-btn ${addTab === 'url' ? 'active' : ''}`} onClick={() => { setAddTab('url'); stopCamera(); }}>
                <Icon name="link" /> Importar por Enlace
              </button>
              <button className={`tab-btn ${addTab === 'manual' ? 'active' : ''}`} onClick={() => {
                setAddTab('manual');
                stopCamera();
                setConfirmData({
                  name: '', brand: '', store: '', category: 'tops', color: '', price: '',
                  image_url: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600', purchase_url: ''
                });
                setIsConfirming(true);
              }}>
                <Icon name="edit-3" /> Registro Manual
              </button>
            </div>

            <div className="add-content-container">
              
              {/* SCAN TAB */}
              {addTab === 'scan' && (
                <div className="scanner-layout">
                  <div className="scanner-camera-box">
                    <div className="camera-preview-wrapper">
                      {videoActive ? (
                        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }}></video>
                      ) : tagImagePreview ? (
                        <img src={tagImagePreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Vista previa de etiqueta" />
                      ) : (
                        <div className="camera-placeholder">
                          <Icon name="camera" className="placeholder-icon" />
                          <p>Usa la cámara trasera o sube una imagen de la etiqueta de tu prenda</p>
                          <div className="camera-placeholder-actions">
                            <button className="btn btn-primary" onClick={startCamera}><Icon name="video" /> Activar Cámara</button>
                            <label className="btn btn-secondary cursor-pointer">
                              <Icon name="upload" /> Subir Foto
                              <input type="file" accept="image/*" onChange={handleTagUpload} style={{ display: 'none' }} />
                            </label>
                          </div>
                        </div>
                      )}

                      {scanStatus === 'processing' && (
                        <div className="scanner-overlay">
                          <div className="scan-line"></div>
                          <span className="scan-text">Procesando etiqueta por IA...</span>
                        </div>
                      )}
                    </div>

                    {videoActive && (
                      <div className="camera-controls">
                        <button className="btn btn-capture" onClick={captureAndScan}><Icon name="circle-dot" /> Capturar</button>
                        <button className="btn btn-danger" onClick={stopCamera}>Cancelar</button>
                      </div>
                    )}
                  </div>

                  <div className="scanner-results-box">
                    <div className="results-header">
                      <h3><Icon name="terminal" /> Resultados del Escaneo OCR</h3>
                      <span className={`status-indicator ${scanStatus}`}>{scanStatus.toUpperCase()}</span>
                    </div>
                    <pre className="ocr-terminal">{scanOcrText}</pre>
                  </div>
                </div>
              )}

              {/* URL TAB */}
              {addTab === 'url' && (
                <div className="tab-content active">
                  <div className="url-import-box">
                    <div className="input-action-row">
                      <div className="input-with-icon-lg">
                        <Icon name="link-2" />
                        <input type="url" placeholder="Pega el enlace del producto (ej: Falabella, Zara, H&M...)"
                               value={productUrl} onChange={(e) => setProductUrl(e.target.value)} />
                      </div>
                      <button className="btn btn-primary btn-lg" onClick={handleScrapeProduct} disabled={scrapeLoading}>
                        {scrapeLoading ? 'Buscando...' : 'Buscar Prenda'}
                      </button>
                    </div>
                    <p className="help-text">Nuestra IA buscará la prenda en la tienda indicada y extraerá la imagen oficial y los detalles.</p>
                    
                    {scrapeLoading && (
                      <div className="scrape-loader">
                        <div className="spinner"></div>
                        <p>{scrapeLoaderText}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* FORMULARIO DE CONFIRMACIÓN */}
              {isConfirming && (
                <div className="garment-confirmation-box">
                  <h3><Icon name="check-circle-2" /> Confirmar Detalles del Producto</h3>
                  <hr className="form-divider" />
                  
                  <div className="confirmation-layout">
                    <div className="preview-photo-section">
                      <div className="garment-image-frame">
                        <img src={confirmData.image_url} alt="Prenda" />
                        <label className="change-photo-badge">
                          <Icon name="camera" /> Cambiar Foto
                          <input type="file" accept="image/*" onChange={handleConfirmImageUpload} style={{ display: 'none' }} />
                        </label>
                      </div>
                      <p className="image-tip">Esta foto identificará la prenda en tu clóset. Puedes subir una foto de cuerpo completo.</p>
                    </div>

                    <div className="form-fields-section">
                      <div className="form-grid">
                        <div className="form-group">
                          <label>Nombre de la Prenda *</label>
                          <input type="text" value={confirmData.name} onChange={(e) => setConfirmData({ ...confirmData, name: e.target.value })} />
                        </div>
                        <div className="form-group">
                          <label>Marca</label>
                          <input type="text" value={confirmData.brand} onChange={(e) => setConfirmData({ ...confirmData, brand: e.target.value })} />
                        </div>
                        <div className="form-group">
                          <label>Tienda (Lugar de Compra) *</label>
                          <input type="text" value={confirmData.store} onChange={(e) => setConfirmData({ ...confirmData, store: e.target.value })} />
                        </div>
                        <div className="form-group">
                          <label>Categoría *</label>
                          <select className="mac-select" value={confirmData.category} onChange={(e) => setConfirmData({ ...confirmData, category: e.target.value })}>
                            <option value="tops">Tops</option>
                            <option value="bottoms">Bottoms</option>
                            <option value="dresses">Vestidos</option>
                            <option value="jackets">Abrigos</option>
                            <option value="shoes">Zapatos</option>
                            <option value="accessories">Accesorios</option>
                            <option value="bags">Bolsos</option>
                            <option value="sportswear">Ropa Deportiva</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Estilo / Ocasión *</label>
                          <select className="mac-select" value={confirmData.style} onChange={(e) => setConfirmData({ ...confirmData, style: e.target.value })}>
                            <option value="Casual">Casual</option>
                            <option value="Formal">Formal</option>
                            <option value="Deportivo">Deportivo</option>
                            <option value="Eventos de Ocasión">Eventos de Ocasión</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Color Predominante</label>
                          <input type="text" value={confirmData.color} onChange={(e) => setConfirmData({ ...confirmData, color: e.target.value })} />
                        </div>
                        <div className="form-group">
                          <label>Género de la Prenda *</label>
                          <select className="mac-select" value={confirmData.gender} onChange={(e) => setConfirmData({ ...confirmData, gender: e.target.value })}>
                            <option value="unisex">Unisex</option>
                            <option value="mujer">Mujer</option>
                            <option value="hombre">Hombre</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="form-actions">
                        <button className="btn btn-secondary btn-lg" onClick={() => setIsConfirming(false)}>Descartar</button>
                        <button className="btn btn-primary btn-lg" onClick={handleSaveGarment}>Guardar en Clóset</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </section>
        )}

        {/* ================= PANEL: ASISTENTE DE OUTFITS ================= */}
        {activePanel === 'assistant' && (
          <section className="content-panel active">
            <header className="panel-header">
              <div>
                <h1>Aura - Asistente de Estilo</h1>
                <p className="subtitle">Describe un evento u ocasión y Aura buscará tu outfit idóneo adaptado al clima actual.</p>
              </div>
              <div className="header-actions">
                <button className="btn btn-secondary btn-mac" onClick={() => setShowKeyModal(true)}>
                  <Icon name="key" /> Configurar API Key
                </button>
              </div>
            </header>

            <div className="assistant-layout">
              {/* Chat del Asistente */}
              <div className="chat-container">
                <div className="chat-header">
                  <div className="assistant-avatar"><Icon name="sparkles" /></div>
                  <div className="assistant-info">
                    <h3>Aura</h3>
                    <span>Estilista Virtual con Inteligencia Artificial</span>
                  </div>
                </div>
                
                <div className="chat-messages">
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`message ${msg.sender}`}>
                      <p dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}></p>
                    </div>
                  ))}
                  
                  {isTyping && (
                    <div className="message assistant">
                      <p><span className="loading-dots">Aura está diseñando tu combinación...</span></p>
                    </div>
                  )}
                </div>

                <div className="quick-prompts">
                  <button className="quick-prompt-btn" onClick={() => setAssistantInput('Clases en la universidad')}>Ir a la universidad</button>
                  <button className="quick-prompt-btn" onClick={() => setAssistantInput('Entrevista de trabajo')}>Entrevista formal</button>
                  <button className="quick-prompt-btn" onClick={() => setAssistantInput('Salida a comer de noche')}>Salida de noche</button>
                  <button className="quick-prompt-btn" onClick={() => setAssistantInput('Look deportivo para correr')}>Deporte al aire libre</button>
                </div>

                <div className="chat-input-area">
                  <input type="text" placeholder="Escribe tu evento aquí..." 
                         value={assistantInput} onChange={(e) => setAssistantInput(e.target.value)}
                         onKeyPress={(e) => { if (e.key === 'Enter') handleSendAssistant(); }} />
                  <button className="btn-send" onClick={handleSendAssistant}><Icon name="send" /></button>
                </div>
              </div>

              {/* Visualizador de Outfit Recomendado */}
              <div className="outfit-recommendation-box">
                {currentRecommendation ? (
                  <div className="recommendation-content">
                    <div className="recommendation-header">
                      <h3><Icon name="check-square" /> Outfit Recomendado</h3>
                      <div className="badge-row" style={{ display: 'flex', gap: '8px' }}>
                        <span className="badge-style">{outfitStyleBadge}</span>
                        {currentRecommendation && currentRecommendation.length > 0 && (
                          <span className="badge-style" style={{ backgroundColor: '#007aff', color: 'white' }}>
                            {(() => {
                              const genders = currentRecommendation.map(i => i.gender || 'unisex');
                              if (genders.every(g => g === 'hombre')) return 'Outfit Masculino';
                              if (genders.every(g => g === 'mujer')) return 'Outfit Femenino';
                              if (genders.some(g => g === 'hombre') && genders.some(g => g === 'mujer')) return 'Outfit Mixto';
                              return 'Outfit Unisex';
                            })()}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="outfit-collage" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
                      {currentRecommendation.map(item => (
                        <div key={item.id} className="collage-item">
                          <img src={item.image_url} className="collage-item-img" alt={item.name} />
                          <div className="collage-item-details">
                            <span className="collage-item-name">{item.name}</span>
                            <span className="collage-item-cat">{translateCategory(item.category)}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="outfit-save-section">
                      <h4>Reservar para el Calendario</h4>
                      <p>Agrega esta combinación a tu planificación semanal:</p>
                      <div className="calendar-save-row">
                        <select className="mac-select" value={saveCalendarDay} onChange={(e) => setSaveCalendarDay(e.target.value)}>
                          <option value="lunes">Lunes</option>
                          <option value="martes">Martes</option>
                          <option value="miércoles">Miércoles</option>
                          <option value="jueves">Jueves</option>
                          <option value="viernes">Viernes</option>
                          <option value="sábado">Sábado</option>
                          <option value="domingo">Domingo</option>
                        </select>
                        <button className="btn btn-primary" onClick={saveOutfitToCalendar}>Asignar Outfit</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="empty-recommendation">
                    <Icon name="sparkles" className="pulsing-icon" />
                    <h3>Visualizador de Outfit</h3>
                    <p>Describe tu evento en el chat y Aura presentará aquí la selección idónea.</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

      </main>

      {/* MODAL CONFIGURACIÓN GEMINI KEY */}
      {showKeyModal && (
        <div className="mac-modal-backdrop">
          <div className="mac-modal-window">
            <div className="modal-header">
              <h3><Icon name="key" /> Configurar API Key de Gemini</h3>
              <button className="btn-close-modal" onClick={() => setShowKeyModal(false)}><Icon name="x" /></button>
            </div>
            <div className="modal-body">
              <p>Introduce tu clave de API de Google Gemini para habilitar el asistente de estilo inteligente basado en visión artificial y moda en tiempo real.</p>
              <p className="warning-text"><Icon name="shield-alert" /> Tu clave se almacena exclusivamente en tu navegador de forma local.</p>
              <div className="form-group margin-top-lg">
                <label>Gemini API Key</label>
                <input type="password" value={geminiKeyInput} onChange={(e) => setGeminiKeyInput(e.target.value)} placeholder="AIzaSy..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handleClearGeminiKey}>Eliminar Clave</button>
              <button className="btn btn-primary" onClick={handleSaveGeminiKey}>Guardar Clave</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIGURACIÓN PERFIL / ONBOARDING */}
      {showProfileModal && (
        <div className="mac-modal-backdrop" style={{ zIndex: 1000 }}>
          <div className="mac-modal-window">
            <div className="modal-header">
              <h3>
                <Icon name="user" /> {profile.name ? 'Editar Perfil de Estilo' : '¡Bienvenido a Aura Closet!'}
              </h3>
              {profile.name && (
                <button className="btn-close-modal" onClick={() => setShowProfileModal(false)}>
                  <Icon name="x" />
                </button>
              )}
            </div>
            <div className="modal-body">
              <p>
                {profile.name 
                  ? 'Actualiza tus datos para personalizar las recomendaciones y el saludo de la aplicación.'
                  : 'Para comenzar a gestionar tu clóset inteligente y recibir outfits adaptados a ti, dinos quién eres:'}
              </p>
              
              <div className="form-group margin-top-lg">
                <label>Nombre Completo *</label>
                <input 
                  type="text" 
                  value={profileInput.name} 
                  onChange={(e) => setProfileInput({ ...profileInput, name: e.target.value })} 
                  placeholder="Ej: Javi Gonzalez" 
                />
              </div>

              <div className="form-group margin-top-md">
                <label>Género *</label>
                <select 
                  className="mac-select" 
                  value={profileInput.gender} 
                  onChange={(e) => setProfileInput({ ...profileInput, gender: e.target.value })}
                >
                  <option value="">Selecciona tu género...</option>
                  <option value="Femenino">Femenino (Ropa de Mujer)</option>
                  <option value="Masculino">Masculino (Ropa de Hombre)</option>
                  <option value="Ambos">Ambos / Unisex</option>
                </select>
              </div>

              <div className="form-group margin-top-md">
                <label>Correo Electrónico *</label>
                <input 
                  type="email" 
                  value={profileInput.email} 
                  onChange={(e) => setProfileInput({ ...profileInput, email: e.target.value })} 
                  placeholder="Ej: javi@example.com" 
                />
              </div>
            </div>
            <div className="modal-footer">
              {profile.name && (
                <button className="btn btn-secondary" onClick={() => setShowProfileModal(false)}>
                  Cancelar
                </button>
              )}
              <button className="btn btn-primary" onClick={handleSaveProfile}>
                Guardar Perfil
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );

  function switchPanel(panelId) {
    setActivePanel(panelId);
    if (panelId !== 'add-item') {
      stopCamera();
    }
  }
}
