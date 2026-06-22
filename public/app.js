// ==========================================================================
// APP.JS: CLIENT SIDE LOGIC FOR AURA CLOSET
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Inicializar Iconos Lucide
  lucide.createIcons();

  // ==========================================
  // CONFIGURACIÓN DE ESTADO GLOBAL CLIENTE
  // ==========================================
  const state = {
    activePanel: 'dashboard',
    clothes: [],
    calendar: [],
    stats: {},
    currentRecommendation: null, // Outfit recomendado actual
    geminiKey: localStorage.getItem('gemini_api_key') || '',
    selectedCategory: 'all',
    searchQuery: '',
    statusFilter: 'all',
    videoStream: null
  };

  // Actualizar campo de Gemini Key en el modal si existe guardado
  if (state.geminiKey) {
    document.getElementById('gemini-key-input').value = state.geminiKey;
  }

  // Poner fecha de hoy en el Dashboard
  updateDashboardDate();

  // Cargar datos iniciales
  fetchStats();
  fetchClothes();
  fetchCalendar();

  // ==========================================
  // NAVEGACIÓN ENTRE PANELES
  // ==========================================
  const navItems = document.querySelectorAll('.nav-item');
  const panels = document.querySelectorAll('.content-panel');

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetPanel = item.getAttribute('data-panel');
      switchPanel(targetPanel);
    });
  });

  function switchPanel(panelId) {
    state.activePanel = panelId;

    // Desactivar nav items y activar el correcto
    navItems.forEach(nav => {
      if (nav.getAttribute('data-panel') === panelId) {
        nav.classList.add('active');
      } else {
        nav.classList.remove('active');
      }
    });

    // Ocultar todos los paneles y mostrar el activo
    panels.forEach(panel => {
      if (panel.id === `panel-${panelId}`) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    // Detener la cámara si salimos del panel de añadir prendas
    if (panelId !== 'add-item') {
      stopCamera();
    }

    // Refrescar datos según el panel
    if (panelId === 'dashboard') {
      fetchStats();
      fetchCalendar();
    } else if (panelId === 'closet') {
      fetchClothes();
      fetchStats();
    }
  }

  function updateDashboardDate() {
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    const today = new Date();
    let dateStr = today.toLocaleDateString('es-ES', options);
    // Capitalizar primera letra
    dateStr = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
    document.getElementById('current-date').innerText = dateStr;
  }

  // ==========================================
  // SOLICITUDES API (FETCHING DATA)
  // ==========================================

  // 1. Obtener estadísticas del armario
  async function fetchStats() {
    try {
      const response = await fetch('/api/stats');
      if (!response.ok) throw new Error('Error al obtener estadísticas');
      const stats = await response.json();
      state.stats = stats;

      // Actualizar widgets
      document.getElementById('stat-total-items').innerText = stats.total_items;
      document.getElementById('stat-clean-items').innerText = stats.clean_items;
      document.getElementById('stat-dirty-items').innerText = stats.dirty_items;
      document.getElementById('stat-closet-value').innerText = `$${stats.total_value.toFixed(2)}`;

      // Renderizar marcas favoritas
      const brandsList = document.getElementById('top-brands-list');
      brandsList.innerHTML = '';
      if (stats.top_brands && stats.top_brands.length > 0) {
        stats.top_brands.forEach(b => {
          if (b.brand) {
            const li = document.createElement('li');
            li.innerHTML = `${b.brand} <span class="brand-count">${b.count}</span>`;
            brandsList.appendChild(li);
          }
        });
      } else {
        brandsList.innerHTML = '<li class="empty-state-text">No hay suficientes marcas.</li>';
      }

      // Renderizar distribución por tipo de prenda
      const barsList = document.getElementById('category-bars-list');
      barsList.innerHTML = '';
      if (stats.categories && stats.categories.length > 0) {
        // Encontrar el valor máximo para calcular porcentajes proporcionales
        const maxVal = Math.max(...stats.categories.map(c => c.count));
        
        stats.categories.forEach(c => {
          const percent = (c.count / maxVal) * 100;
          const barItem = document.createElement('div');
          barItem.className = 'cat-bar-item';
          barItem.innerHTML = `
            <div class="cat-bar-header">
              <span>${translateCategory(c.category)}</span>
              <span>${c.count}</span>
            </div>
            <div class="cat-bar-track">
              <div class="cat-bar-fill" style="width: ${percent}%"></div>
            </div>
          `;
          barsList.appendChild(barItem);
        });
      } else {
        barsList.innerHTML = '<div class="empty-state-text">Sin datos disponibles.</div>';
      }

    } catch (err) {
      console.error(err);
    }
  }

  // 2. Obtener todas las prendas del clóset
  async function fetchClothes() {
    try {
      const response = await fetch('/api/clothes');
      if (!response.ok) throw new Error('Error al obtener prendas');
      const clothes = await response.json();
      state.clothes = clothes;
      renderCloset();
    } catch (err) {
      console.error(err);
    }
  }

  // 3. Obtener calendario planificador
  async function fetchCalendar() {
    try {
      const response = await fetch('/api/calendar');
      if (!response.ok) throw new Error('Error al obtener calendario');
      const calendar = await response.json();
      state.calendar = calendar;
      renderCalendar();
    } catch (err) {
      console.error(err);
    }
  }

  // Traducir categoría para etiquetas legibles
  function translateCategory(cat) {
    const translation = {
      'tops': 'Tops',
      'bottoms': 'Partes de Abajo',
      'jackets': 'Abrigos / Chaquetas',
      'shoes': 'Calzado',
      'accessories': 'Accesorios'
    };
    return translation[cat] || cat;
  }

  // ==========================================
  // CLÓSET RENDER Y FILTROS
  // ==========================================
  const searchInput = document.getElementById('closet-search');
  const statusFilterSelect = document.getElementById('closet-filter-status');
  const categoryPills = document.querySelectorAll('.category-pills .pill');

  // Eventos filtros
  searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.toLowerCase();
    renderCloset();
  });

  statusFilterSelect.addEventListener('change', (e) => {
    state.statusFilter = e.target.value;
    renderCloset();
  });

  categoryPills.forEach(pill => {
    pill.addEventListener('click', () => {
      categoryPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.selectedCategory = pill.getAttribute('data-category');
      renderCloset();
    });
  });

  function renderCloset() {
    const container = document.getElementById('garment-grid-container');
    container.innerHTML = '';

    // Filtrar prendas
    const filtered = state.clothes.filter(item => {
      // Filtro de categoría
      if (state.selectedCategory !== 'all' && item.category !== state.selectedCategory) {
        return false;
      }
      // Filtro de estado (limpio/sucio)
      if (state.statusFilter !== 'all' && item.status !== state.statusFilter) {
        return false;
      }
      // Filtro de texto de búsqueda
      if (state.searchQuery) {
        const name = (item.name || '').toLowerCase();
        const brand = (item.brand || '').toLowerCase();
        const color = (item.color || '').toLowerCase();
        const store = (item.store || '').toLowerCase();
        if (!name.includes(state.searchQuery) && 
            !brand.includes(state.searchQuery) && 
            !color.includes(state.searchQuery) &&
            !store.includes(state.searchQuery)) {
          return false;
        }
      }
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state-closet">
          <i data-lucide="package-open" class="empty-icon"></i>
          <h3>Ninguna prenda coincide</h3>
          <p>Prueba a cambiar tus filtros de búsqueda o añade nuevas prendas.</p>
        </div>
      `;
      lucide.createIcons();
      return;
    }

    filtered.forEach(item => {
      const card = document.createElement('div');
      card.className = `garment-card ${item.status === 'dirty' ? 'dirty' : ''}`;
      
      const isClean = item.status === 'clean';
      
      card.innerHTML = `
        <div class="card-img-wrapper">
          <img src="${item.image_url}" alt="${item.name}" onerror="this.src='https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600'">
          <span class="category-tag">${translateCategory(item.category)}</span>
          <button class="btn-delete-garment" data-id="${item.id}" title="Eliminar prenda">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
        <div class="card-details">
          <div class="card-title-row">
            <h4>${item.name}</h4>
            <div class="card-brand">
              <span>${item.brand || 'Sin Marca'}</span>
              <span class="switch-label-tooltip">${isClean ? 'Limpio' : 'Lavadora'}</span>
            </div>
          </div>
          <div class="card-meta-row">
            <span class="card-price">$${(item.price || 0).toFixed(2)}</span>
            <label class="laundry-switch">
              <input type="checkbox" class="toggle-status" data-id="${item.id}" ${isClean ? 'checked' : ''}>
              <span class="slider-switch"></span>
            </label>
          </div>
        </div>
      `;

      // Evento de eliminar prenda
      card.querySelector('.btn-delete-garment').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`¿Estás seguro de eliminar "${item.name}"?`)) {
          await deleteGarment(item.id);
        }
      });

      // Evento de cambiar estado limpio/sucio
      card.querySelector('.toggle-status').addEventListener('change', async (e) => {
        const newStatus = e.target.checked ? 'clean' : 'dirty';
        await updateGarmentStatus(item.id, newStatus);
      });

      container.appendChild(card);
    });

    lucide.createIcons();
  }

  // API Call: Cambiar estado
  async function updateGarmentStatus(id, status) {
    try {
      const response = await fetch(`/api/clothes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!response.ok) throw new Error('Error al actualizar estado');
      
      // Actualizar estado local
      const idx = state.clothes.findIndex(c => c.id == id);
      if (idx !== -1) {
        state.clothes[idx].status = status;
      }
      
      // Actualizar UI
      renderCloset();
      fetchStats();
    } catch (e) {
      console.error(e);
    }
  }

  // API Call: Eliminar
  async function deleteGarment(id) {
    try {
      const response = await fetch(`/api/clothes/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Error al eliminar prenda');
      
      // Quitar de local
      state.clothes = state.clothes.filter(c => c.id != id);
      renderCloset();
      fetchStats();
    } catch (e) {
      console.error(e);
    }
  }

  // ==========================================
  // CALENDARIO PLANIFICADOR SEMANAL RENDER
  // ==========================================
  function renderCalendar() {
    const container = document.getElementById('calendar-days');
    container.innerHTML = '';

    const daysList = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

    daysList.forEach(day => {
      const calData = state.calendar.find(c => c.day_of_week === day) || { day_of_week: day, outfit_id: null, items: [] };
      const col = document.createElement('div');
      col.className = 'cal-day-column';

      let innerContent = '';

      if (calData.outfit_id && calData.items && calData.items.length > 0) {
        // Outfit asignado
        const imagesHTML = calData.items.map(item => `
          <img src="${item.image_url}" alt="${item.name}" onerror="this.src='https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=100'">
        `).slice(0, 4).join(''); // Limitar a 4 imágenes en collage

        innerContent = `
          <span class="cal-day-name">${day}</span>
          <div class="cal-filled-outfit">
            <button class="btn-delete-cal" data-day="${day}" title="Eliminar del calendario">×</button>
            <div class="cal-outfit-images">
              ${imagesHTML}
            </div>
            <span class="cal-outfit-title" title="${calData.outfit_name}">${calData.outfit_name}</span>
          </div>
        `;
      } else {
        // Ranura vacía
        innerContent = `
          <span class="cal-day-name">${day}</span>
          <div class="cal-outfit-box">
            <div class="cal-empty-slot" data-day="${day}">
              <i data-lucide="sparkles"></i>
              <span>Sugerir Outfit</span>
            </div>
          </div>
        `;
      }

      col.innerHTML = innerContent;

      // Evento para limpiar ranura del día
      if (calData.outfit_id) {
        col.querySelector('.btn-delete-cal').addEventListener('click', async (e) => {
          e.stopPropagation();
          await clearCalendarDay(day);
        });
      } else {
        // Evento para abrir asistente y planificar para ese día
        col.querySelector('.cal-empty-slot').addEventListener('click', () => {
          switchPanel('assistant');
          document.getElementById('select-calendar-day').value = day;
          
          // Enviar un mensaje introductorio de Aura para ese día
          const chatMsgContainer = document.getElementById('chat-messages-container');
          chatMsgContainer.innerHTML += `
            <div class="message assistant">
              <p>¡Hola! Veo que quieres planificar un outfit para el <strong>${day}</strong>. ¿Qué plan o evento tienes para ese día? Cuéntame y te daré mi recomendación.</p>
            </div>
          `;
          chatMsgContainer.scrollTop = chatMsgContainer.scrollHeight;
        });
      }

      container.appendChild(col);
    });

    lucide.createIcons();
  }

  // API Call: Limpiar ranura del calendario
  async function clearCalendarDay(day) {
    try {
      const response = await fetch(`/api/calendar/${day}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Error al limpiar ranura');
      fetchCalendar();
    } catch (e) {
      console.error(e);
    }
  }

  // ==========================================
  // PESTAÑAS Y FUNCIONALIDAD DE AÑADIR PRENDA
  // ==========================================
  const tabScan = document.getElementById('tab-scan');
  const tabUrl = document.getElementById('tab-url');
  const tabManual = document.getElementById('tab-manual');

  const contentScan = document.getElementById('content-scan');
  const contentUrl = document.getElementById('content-url');
  const contentManual = document.getElementById('content-manual');

  const confirmationForm = document.getElementById('garment-confirmation-form');

  tabScan.addEventListener('click', () => {
    setActiveTab(tabScan, contentScan);
  });
  
  tabUrl.addEventListener('click', () => {
    setActiveTab(tabUrl, contentUrl);
    stopCamera();
  });
  
  tabManual.addEventListener('click', () => {
    setActiveTab(tabManual, contentManual);
    stopCamera();
    
    // Rellenar formulario de confirmación en blanco para añadir manual
    showConfirmationForm({
      name: '',
      brand: '',
      store: '',
      category: 'tops',
      color: '',
      price: '',
      image_url: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600',
      purchase_url: ''
    });
  });

  function setActiveTab(activeTabBtn, activeContentDiv) {
    [tabScan, tabUrl, tabManual].forEach(btn => btn.classList.remove('active'));
    [contentScan, contentUrl, contentManual].forEach(div => div.classList.remove('active'));
    
    activeTabBtn.classList.add('active');
    activeContentDiv.classList.add('active');
    
    // Ocultar confirmación si el usuario cambió de pestaña (excepto manual que la fuerza)
    if (activeTabBtn !== tabManual) {
      confirmationForm.classList.add('hidden');
    }
  }

  // --- SUBIDA / CAMBIO DE FOTOS EN CONFIRMACIÓN ---
  const fileGarmentUpload = document.getElementById('file-garment-upload');
  const confirmedImagePreview = document.getElementById('confirmed-image-preview');
  const confImageUrl = document.getElementById('conf-image-url');

  fileGarmentUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      confirmedImagePreview.src = URL.createObjectURL(file); // Vista previa local rápida
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      if (!response.ok) throw new Error('Error al subir imagen');
      const data = await response.json();
      
      confImageUrl.value = data.image_url;
      confirmedImagePreview.src = data.image_url; // Imagen real del servidor
    } catch (err) {
      alert('Error al guardar la foto en el servidor.');
      console.error(err);
    }
  });

  // --- BUSCADOR POR URL / SCRAPER ---
  const btnScrapeUrl = document.getElementById('btn-scrape-url');
  const productUrlInput = document.getElementById('product-url-input');
  const scrapeLoader = document.getElementById('scrape-loader');

  btnScrapeUrl.addEventListener('click', async () => {
    const url = productUrlInput.value.trim();
    if (!url || !url.startsWith('http')) {
      alert('Por favor introduce una URL válida que empiece por http:// o https://');
      return;
    }

    scrapeLoader.classList.remove('hidden');
    confirmationForm.classList.add('hidden');

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      if (!response.ok) throw new Error('Error al extraer datos');
      const garmentData = await response.json();
      
      showConfirmationForm(garmentData);
    } catch (err) {
      console.error(err);
      alert('No se pudo extraer la prenda automáticamente, pero puedes rellenar los datos manualmente.');
      // Abrir manual
      showConfirmationForm({
        name: 'Prenda Importada',
        brand: '',
        store: 'Internet',
        category: 'tops',
        color: '',
        price: '',
        image_url: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600',
        purchase_url: url
      });
    } finally {
      scrapeLoader.classList.add('hidden');
    }
  });

  // --- CÁMARA Y ESCÁNER DE ETIQUETA ---
  const btnActivateCamera = document.getElementById('btn-activate-camera');
  const btnCaptureTag = document.getElementById('btn-capture-tag');
  const btnCancelCamera = document.getElementById('btn-cancel-camera');
  const fileTagUpload = document.getElementById('file-tag-upload');
  
  const videoElement = document.getElementById('webcam-video');
  const tagPreviewImg = document.getElementById('tag-preview-img');
  const cameraPlaceholder = document.getElementById('camera-placeholder');
  const cameraControls = document.getElementById('camera-controls');
  const scannerOverlay = document.getElementById('scanner-overlay');
  const ocrTerminal = document.getElementById('ocr-terminal-text');
  const ocrStatus = document.getElementById('ocr-status');

  // 1. Activar stream de cámara real
  btnActivateCamera.addEventListener('click', async () => {
    try {
      state.videoStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // Cámara trasera si es móvil
        audio: false
      });
      
      videoElement.srcObject = state.videoStream;
      videoElement.classList.remove('hidden');
      tagPreviewImg.classList.add('hidden');
      cameraPlaceholder.classList.add('hidden');
      cameraControls.classList.remove('hidden');
    } catch (err) {
      alert('No se pudo acceder a la cámara. Prueba subiendo una foto directamente.');
      console.error(err);
    }
  });

  // 2. Detener stream de cámara
  function stopCamera() {
    if (state.videoStream) {
      state.videoStream.getTracks().forEach(track => track.stop());
      state.videoStream = null;
    }
    videoElement.classList.add('hidden');
    cameraPlaceholder.classList.remove('hidden');
    cameraControls.classList.add('hidden');
  }

  btnCancelCamera.addEventListener('click', stopCamera);

  // 3. Capturar frame de la webcam y simular/escanear
  btnCaptureTag.addEventListener('click', async () => {
    if (!state.videoStream) return;

    // Capturar una imagen fija del video
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    
    // Detener cámara
    stopCamera();

    // Convertir canvas a Blob/File
    canvas.toBlob(async (blob) => {
      const file = new File([blob], "tag-captured.jpg", { type: "image/jpeg" });
      await processTagImage(file);
    }, 'image/jpeg');
  });

  // 4. Carga de foto de etiqueta desde archivo
  fileTagUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await processTagImage(file);
  });

  // 5. Procesar la imagen de la etiqueta con OCR inteligente
  async function processTagImage(file) {
    // Mostrar vista previa en la caja
    tagPreviewImg.src = URL.createObjectURL(file);
    tagPreviewImg.classList.remove('hidden');
    cameraPlaceholder.classList.add('hidden');
    
    // Activar overlays de escaneo
    scannerOverlay.classList.remove('hidden');
    ocrStatus.innerText = 'PROCESANDO...';
    ocrStatus.className = 'status-indicator processing';
    ocrTerminal.innerHTML = '// Inicializando módulo de Visión Artificial...\n// Procesando imagen de etiqueta...\n';

    const formData = new FormData();
    formData.append('tag_image', file);

    try {
      const response = await fetch('/api/scan-tag', {
        method: 'POST',
        body: formData
      });
      if (!response.ok) throw new Error('Error al procesar etiqueta');
      const result = await response.json();

      // Mostrar resultados en la consola OCR
      ocrStatus.innerText = 'CON ÉXITO';
      ocrStatus.className = 'status-indicator success';
      ocrTerminal.innerHTML = `// OCR COMPLETADO CON ÉXITO\n// TEXTO DETECTADO:\n\n${result.raw_ocr}\n\n// Mapeando prenda en la tienda...`;

      // Cargar los detalles detectados en el formulario de confirmación tras un pequeño delay
      setTimeout(() => {
        showConfirmationForm(result.detected_details);
      }, 1000);

    } catch (err) {
      ocrStatus.innerText = 'FALLIDO';
      ocrStatus.className = 'status-indicator error';
      ocrTerminal.innerHTML = `// ERROR DE ESCANEO: No se pudo conectar con el motor de IA.\n// Por favor, rellena los datos manualmente.`;
      console.error(err);
      alert('Error en el escaneo de etiqueta. Puedes introducirla manualmente.');
      // Mostrar manual
      showConfirmationForm({
        name: 'Prenda Escaneada',
        brand: '',
        store: '',
        category: 'tops',
        color: '',
        price: '',
        image_url: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600',
        purchase_url: ''
      });
    } finally {
      scannerOverlay.classList.add('hidden');
    }
  }

  // --- PRELLENAR Y MOSTRAR FORMULARIO DE CONFIRMACIÓN ---
  function showConfirmationForm(data) {
    document.getElementById('conf-name').value = data.name || '';
    document.getElementById('conf-brand').value = data.brand || '';
    document.getElementById('conf-store').value = data.store || '';
    document.getElementById('conf-category').value = data.category || 'tops';
    document.getElementById('conf-color').value = data.color || '';
    document.getElementById('conf-price').value = data.price || '';
    
    confImageUrl.value = data.image_url || '';
    document.getElementById('conf-purchase-url').value = data.purchase_url || '';
    confirmedImagePreview.src = data.image_url || 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600';

    confirmationForm.classList.remove('hidden');
    
    // Hacer scroll automático al formulario
    confirmationForm.scrollIntoView({ behavior: 'smooth' });
  }

  // Descartar/Resetear Formulario
  const btnResetForm = document.getElementById('btn-reset-form');
  btnResetForm.addEventListener('click', () => {
    if (confirm('¿Deseas descartar esta prenda?')) {
      confirmationForm.classList.add('hidden');
      productUrlInput.value = '';
      tagPreviewImg.classList.add('hidden');
      cameraPlaceholder.classList.remove('hidden');
      ocrTerminal.innerHTML = '// Los datos brutos del escaneo de la etiqueta aparecerán aquí tras procesar la imagen...';
      ocrStatus.innerText = 'Esperando escaneo...';
      ocrStatus.className = 'status-indicator waiting';
    }
  });

  // Enviar / Guardar prenda en base de datos
  const btnSaveGarment = document.getElementById('btn-save-garment');
  btnSaveGarment.addEventListener('click', async () => {
    const name = document.getElementById('conf-name').value.trim();
    const category = document.getElementById('conf-category').value;
    const store = document.getElementById('conf-store').value.trim();

    if (!name || !store || !category) {
      alert('Nombre, Categoría y Lugar de compra son campos requeridos.');
      return;
    }

    const payload = {
      name,
      brand: document.getElementById('conf-brand').value.trim(),
      store,
      category,
      color: document.getElementById('conf-color').value.trim(),
      image_url: confImageUrl.value || 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600',
      purchase_url: document.getElementById('conf-purchase-url').value,
      price: parseFloat(document.getElementById('conf-price').value) || 0
    };

    try {
      const response = await fetch('/api/clothes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Error al guardar prenda');
      
      alert('¡Prenda guardada con éxito en tu Clóset Virtual!');
      
      // Resetear formulario y redirigir
      confirmationForm.classList.add('hidden');
      productUrlInput.value = '';
      tagPreviewImg.classList.add('hidden');
      cameraPlaceholder.classList.remove('hidden');
      ocrTerminal.innerHTML = '// Los datos brutos del escaneo de la etiqueta aparecerán aquí tras procesar la imagen...';
      ocrStatus.innerText = 'Esperando escaneo...';
      ocrStatus.className = 'status-indicator waiting';
      
      // Ir a la sección del clóset
      switchPanel('closet');
    } catch (err) {
      console.error(err);
      alert('Error al añadir la prenda.');
    }
  });

  // Botón rápido en Clóset para añadir prenda
  const btnQuickAdd = document.getElementById('btn-quick-add');
  if (btnQuickAdd) {
    btnQuickAdd.addEventListener('click', () => {
      switchPanel('add-item');
      tabManual.click();
    });
  }


  // ==========================================
  // ASISTENTE DE OUTFITS POR IA
  // ==========================================
  const btnSendMessage = document.getElementById('btn-send-message');
  const assistantInput = document.getElementById('assistant-input');
  const chatMessagesContainer = document.getElementById('chat-messages-container');
  const quickPromptBtns = document.querySelectorAll('.quick-prompt-btn');

  // Enviar mensaje al hacer enter
  assistantInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendAssistantMessage();
    }
  });

  btnSendMessage.addEventListener('click', sendAssistantMessage);

  // Sugerencias de prompt rápidas
  quickPromptBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      assistantInput.value = btn.innerText;
      sendAssistantMessage();
    });
  });

  async function sendAssistantMessage() {
    const text = assistantInput.value.trim();
    if (!text) return;

    // 1. Agregar mensaje del usuario a la burbuja
    appendMessage(text, 'user');
    assistantInput.value = '';

    // Agregar indicador de carga "Aura está escribiendo..."
    const typingId = 'aura-typing-' + Date.now();
    const typingMsg = document.createElement('div');
    typingMsg.className = 'message assistant';
    typingMsg.id = typingId;
    typingMsg.innerHTML = '<span class="loading-dots">Aura está pensando el outfit...</span>';
    chatMessagesContainer.appendChild(typingMsg);
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          gemini_key: state.geminiKey
        })
      });

      if (!response.ok) throw new Error('Error al conectar con el asistente');
      const data = await response.json();

      // Quitar cargador
      document.getElementById(typingId).remove();

      // 2. Agregar respuesta de Aura
      appendMessage(data.reply, 'assistant');

      // 3. Renderizar outfit recomendado si lo hay
      if (data.outfit && data.outfit.length > 0) {
        state.currentRecommendation = data.outfit;
        renderRecommendation(data.outfit);
      }

    } catch (err) {
      document.getElementById(typingId).remove();
      appendMessage('Lo siento, he tenido un problema analizando tu armario. Por favor, asegúrate de tener prendas en tu clóset marcadas como "Limpio".', 'assistant');
      console.error(err);
    }
  }

  function appendMessage(text, sender) {
    const msg = document.createElement('div');
    msg.className = `message ${sender}`;
    // Reemplazar saltos de línea por <br> y formato de negrita simple
    const formattedText = text
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      
    msg.innerHTML = `<p>${formattedText}</p>`;
    chatMessagesContainer.appendChild(msg);
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
  }

  // Renderizar las prendas en la caja de recomendados (Derecha)
  function renderRecommendation(items) {
    const emptyView = document.getElementById('empty-recommendation-view');
    const contentView = document.getElementById('recommendation-content-view');
    const collageGrid = document.getElementById('outfit-collage-grid');

    emptyView.classList.add('hidden');
    contentView.classList.remove('hidden');
    collageGrid.innerHTML = '';

    items.forEach(item => {
      const cItem = document.createElement('div');
      cItem.className = 'collage-item';
      cItem.innerHTML = `
        <img src="${item.image_url}" class="collage-item-img" onerror="this.src='https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=300'">
        <div class="collage-item-details">
          <div class="collage-item-name">${item.name}</div>
          <div class="collage-item-cat">${translateCategory(item.category)}</div>
        </div>
      `;
      collageGrid.appendChild(cItem);
    });

    // Adivinar/Asignar un estilo badge decorativo
    const categoriesText = items.map(i => i.name).join(' ').toLowerCase();
    const styleBadge = document.getElementById('outfit-style-badge');
    if (categoriesText.includes('deporte') || categoriesText.includes('nike') || categoriesText.includes('sudadera')) {
      styleBadge.innerText = 'Deportivo';
    } else if (categoriesText.includes('camisa') || categoriesText.includes('blazer') || categoriesText.includes('vestido')) {
      styleBadge.innerText = 'Formal';
    } else {
      styleBadge.innerText = 'Casual';
    }
  }

  // --- ASIGNAR RECOMENDACIÓN AL CALENDARIO ---
  const btnSaveToCalendar = document.getElementById('btn-save-to-calendar');
  const selectCalendarDay = document.getElementById('select-calendar-day');

  btnSaveToCalendar.addEventListener('click', async () => {
    if (!state.currentRecommendation || state.currentRecommendation.length === 0) {
      alert('No hay ninguna recomendación de outfit activa para guardar.');
      return;
    }

    const day = selectCalendarDay.value;
    const itemsIds = state.currentRecommendation.map(i => i.id);
    const styleName = document.getElementById('outfit-style-badge').innerText;
    
    // Nombre del outfit
    const outfitName = `Outfit ${styleName} (${day.charAt(0).toUpperCase() + day.slice(1)})`;

    try {
      const response = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day_of_week: day,
          outfit_name: outfitName,
          items_ids: itemsIds,
          description: `Propuesto por Aura`
        })
      });

      if (!response.ok) throw new Error('Error al guardar outfit');
      
      alert(`¡Outfit guardado correctamente para el ${day}!`);
      
      // Opcional: Redirigir al dashboard para verlo
      switchPanel('dashboard');
    } catch (err) {
      console.error(err);
      alert('Error al guardar en el planificador.');
    }
  });


  // ==========================================
  // CONFIGURACIÓN DE GEMINI KEY (MODAL)
  // ==========================================
  const btnGeminiKey = document.getElementById('btn-gemini-key');
  const modalGemini = document.getElementById('modal-gemini-key');
  const btnCloseGemini = document.getElementById('btn-close-gemini-modal');
  const btnSaveGemini = document.getElementById('btn-save-gemini-key');
  const btnClearGemini = document.getElementById('btn-clear-gemini-key');
  const geminiInput = document.getElementById('gemini-key-input');

  // Abrir Modal
  btnGeminiKey.addEventListener('click', () => {
    modalGemini.classList.remove('hidden');
  });

  // Cerrar Modal
  btnCloseGemini.addEventListener('click', () => {
    modalGemini.classList.add('hidden');
  });

  // Guardar clave
  btnSaveGemini.addEventListener('click', () => {
    const key = geminiInput.value.trim();
    if (!key) {
      alert('Por favor introduce una API Key.');
      return;
    }
    state.geminiKey = key;
    localStorage.setItem('gemini_api_key', key);
    modalGemini.classList.add('hidden');
    alert('Clave de Gemini API configurada con éxito.');
  });

  // Limpiar clave
  btnClearGemini.addEventListener('click', () => {
    state.geminiKey = '';
    geminiInput.value = '';
    localStorage.removeItem('gemini_api_key');
    modalGemini.classList.add('hidden');
    alert('Clave de Gemini API eliminada. Se usará el motor local por defecto.');
  });

});
