// Aura Closet - Servicio de Recomendación de Outfits Inteligente

// Helper para mezclar elementos y evitar recomendar siempre lo mismo
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function recommendOutfit(clothes, occasion, weather) {
  const { currentTemp, rainProbability, currentRain } = weather;
  const isRaining = currentRain > 0 || rainProbability > 50;

  // 1. Filtrar solo prendas disponibles (limpias)
  // Excluimos explícitamente las sucias ('dirty') y prestadas ('lent')
  const availableClothes = clothes.filter(c => c.status === 'clean');

  if (availableClothes.length === 0) {
    return {
      success: false,
      message: 'No tienes prendas limpias disponibles en tu clóset. ¡Es hora de lavar la ropa!',
      outfit: []
    };
  }

  // Clasificar la ocasión
  const occ = occasion.toLowerCase();
  let occasionType = 'casual'; // casual, entrevista, universidad, noche, deporte

  if (occ.includes('entrevista') || occ.includes('trabajo') || occ.includes('reunión') || occ.includes('reunion') || occ.includes('formal') || occ.includes('oficina')) {
    occasionType = 'entrevista';
  } else if (occ.includes('universidad') || occ.includes('clases') || occ.includes('u') || occ.includes('estudiar') || occ.includes('cómodo') || occ.includes('comodo') || occ.includes('colegio')) {
    occasionType = 'universidad';
  } else if (occ.includes('noche') || occ.includes('fiesta') || occ.includes('carrete') || occ.includes('salir') || occ.includes('cena') || occ.includes('club')) {
    occasionType = 'noche';
  } else if (occ.includes('deporte') || occ.includes('ejercicio') || occ.includes('gimnasio') || occ.includes('gym') || occ.includes('correr')) {
    occasionType = 'deporte';
  }

  // 2. Filtrar prendas elegibles por Ocasión (Formalidad / Estilos)
  let occasionClothes = [...availableClothes];

  if (occasionType === 'entrevista') {
    // Entrevista: Formalidad alta (nivel >= 3) y colores neutros
    const neutralColors = ['negro', 'blanco', 'gris', 'azul marino', 'beige', 'café', 'celeste'];
    occasionClothes = availableClothes.filter(c => 
      c.formalityLevel >= 3 && 
      (neutralColors.includes(c.color.toLowerCase()) || neutralColors.some(nc => c.name.toLowerCase().includes(nc)))
    );
    // Si queda muy poca ropa, relajar colores pero mantener formalidad
    if (occasionClothes.length < 5) {
      occasionClothes = availableClothes.filter(c => c.formalityLevel >= 3);
    }
  } else if (occasionType === 'universidad') {
    // Universidad: Comodidad (formalidad <= 2 o tag 'cómodo'/'deporte')
    occasionClothes = availableClothes.filter(c => 
      c.formalityLevel <= 2 || 
      c.tags.includes('cómodo') || 
      c.tags.includes('deporte')
    );
  } else if (occasionType === 'noche') {
    // Noche: Estilo Chic/Streetwear o formalidad media-alta (2 a 4)
    occasionClothes = availableClothes.filter(c => 
      c.style === 'Chic' || 
      c.style === 'Streetwear' || 
      (c.formalityLevel >= 2 && c.formalityLevel <= 4)
    );
  } else if (occasionType === 'deporte') {
    // Deporte: Estilo Deportivo o tag 'deporte'
    occasionClothes = availableClothes.filter(c => 
      c.style === 'Deportivo' || 
      c.tags.includes('deporte')
    );
  }

  // Si el filtro de ocasión nos deja sin suficientes prendas básicas, volvemos a toda la ropa disponible
  if (occasionClothes.length < 5) {
    occasionClothes = [...availableClothes];
  }

  // 3. Filtrar por Temperatura (Rango de tolerancia de temperatura de la prenda)
  // Permitimos una tolerancia de +- 4 grados para no quedarnos sin prendas si la temperatura es extrema
  const tolerance = 4;
  let weatherClothes = occasionClothes.filter(c => 
    c.temperatureMin - tolerance <= currentTemp && 
    c.temperatureMax + tolerance >= currentTemp
  );

  // Si el filtro de temperatura es demasiado restrictivo, relajamos la regla de clima
  if (weatherClothes.length < 5) {
    weatherClothes = [...occasionClothes];
  }

  // 4. Separar las prendas por categorías (Mezcladas aleatoriamente)
  const tops = shuffle(weatherClothes.filter(c => c.category === 'tops' || (c.category === 'sportswear' && (c.subcategory.toLowerCase().includes('top') || c.subcategory.toLowerCase().includes('polera')))));
  const bottoms = shuffle(weatherClothes.filter(c => c.category === 'bottoms' || (c.category === 'sportswear' && (c.subcategory.toLowerCase().includes('calza') || c.subcategory.toLowerCase().includes('short') || c.subcategory.toLowerCase().includes('pantalon') || c.subcategory.toLowerCase().includes('pantalón')))));
  const dresses = shuffle(weatherClothes.filter(c => c.category === 'dresses'));
  const jackets = shuffle(weatherClothes.filter(c => c.category === 'jackets'));
  const shoes = shuffle(weatherClothes.filter(c => c.category === 'shoes'));
  const bags = shuffle(weatherClothes.filter(c => c.category === 'bags'));
  const accessories = shuffle(weatherClothes.filter(c => c.category === 'accessories'));

  // Lógica de armado del Outfit
  let outfit = [];
  let explanation = '';

  // Determinar si usar Vestido (dresses) o la combinación clásica Top + Bottom
  // Se prefiere vestido si hace calor (>18°C), en ocasiones de noche, y si hay vestidos disponibles
  const canUseDress = dresses.length > 0 && (currentTemp > 18 || occasionType === 'noche') && Math.random() > 0.4;

  if (canUseDress) {
    // Outfit con vestido
    const selectedDress = dresses[0];
    outfit.push(selectedDress);
    explanation = `He seleccionado el **${selectedDress.name}** como prenda principal. `;
  } else {
    // Outfit clásico: Top + Bottom
    if (tops.length === 0 || bottoms.length === 0) {
      // Si nos quedamos sin tops o bottoms en el set de clima/ocasión, buscamos en el clóset general limpio
      const fallbackTops = shuffle(availableClothes.filter(c => c.category === 'tops' || (c.category === 'sportswear' && (c.subcategory.toLowerCase().includes('top') || c.subcategory.toLowerCase().includes('polera')))));
      const fallbackBottoms = shuffle(availableClothes.filter(c => c.category === 'bottoms' || (c.category === 'sportswear' && (c.subcategory.toLowerCase().includes('calza') || c.subcategory.toLowerCase().includes('short') || c.subcategory.toLowerCase().includes('pantalon') || c.subcategory.toLowerCase().includes('pantalón')))));
      
      if (fallbackTops.length === 0 || fallbackBottoms.length === 0) {
        return {
          success: false,
          message: 'Necesitas tener al menos una prenda superior (Top) y una inferior (Bottom) limpias en tu guardarropa para armar un outfit.',
          outfit: []
        };
      }
      
      const top = fallbackTops[0];
      const bottom = fallbackBottoms[0];
      outfit.push(top, bottom);
      explanation = `He combinado tu **${top.name}** con **${bottom.name}**. `;
    } else {
      const top = tops[0];
      const bottom = bottoms[0];
      outfit.push(top, bottom);
      explanation = `He combinado tu **${top.name}** con **${bottom.name}**. `;
    }
  }

  // Añadir Calzado
  if (shoes.length > 0) {
    let selectedShoes = shoes[0];
    
    // Si llueve, priorizar calzado rainFriendly
    if (isRaining) {
      const rainShoes = shoes.filter(s => s.rainFriendly);
      if (rainShoes.length > 0) {
        selectedShoes = rainShoes[0];
      }
    }
    outfit.push(selectedShoes);
    explanation += `Para los pies, he elegido las **${selectedShoes.name}**${isRaining && selectedShoes.rainFriendly ? ' (ideales para la lluvia)' : ''}. `;
  } else {
    // Fallback de calzado limpio
    const fallbackShoes = shuffle(availableClothes.filter(c => c.category === 'shoes'));
    if (fallbackShoes.length > 0) {
      outfit.push(fallbackShoes[0]);
      explanation += `Completé el calzado con **${fallbackShoes[0].name}**. `;
    }
  }

  // Regla de Frío / Lluvia: Agregar Chaqueta
  // Obligatorio si hace frío (< 16°C) o si llueve
  const needsJacket = currentTemp < 16 || isRaining;
  
  if (needsJacket) {
    if (jackets.length > 0) {
      let selectedJacket = jackets[0];
      
      // Si llueve, priorizar chaqueta impermeable/rainFriendly
      if (isRaining) {
        const rainJackets = jackets.filter(j => j.rainFriendly);
        if (rainJackets.length > 0) {
          selectedJacket = rainJackets[0];
        }
      }
      
      outfit.push(selectedJacket);
      explanation += `Dado que el clima indica ${currentTemp}°C ${isRaining ? 'con probabilidad de lluvia' : 'con bajas temperaturas'}, he sumado la chaqueta **${selectedJacket.name}** como abrigo principal${isRaining && selectedJacket.rainFriendly ? ' (impermeable)' : ''}. `;
    } else {
      // Intentar buscar abrigo en clóset limpio general
      const fallbackJackets = shuffle(availableClothes.filter(c => c.category === 'jackets'));
      if (fallbackJackets.length > 0) {
        outfit.push(fallbackJackets[0]);
        explanation += `Añadí el abrigo **${fallbackJackets[0].name}** para protegerte del clima. `;
      } else if (currentTemp < 12) {
        explanation += `⚠️ Nota: Hace frío (${currentTemp}°C) pero no tienes abrigos limpios disponibles en tu clóset. ¡Te sugiero lavar alguna chaqueta! `;
      }
    }
  } 
  // Si hace calor (> 22°C) no añadimos chaqueta, a menos que sea una ocasión formal y haya un blazer ultra-liviano
  else if (currentTemp >= 22 && occasionType === 'entrevista') {
    const lightBlazers = jackets.filter(j => j.subcategory === 'Blazer' || j.temperatureMax >= 25);
    if (lightBlazers.length > 0) {
      outfit.push(lightBlazers[0]);
      explanation += `Agregué el blazer liviano **${lightBlazers[0].name}** para mantener el toque profesional a pesar del calor. `;
    }
  }

  // Añadir Bolso (Opcional - 60% probabilidad)
  if (bags.length > 0 && Math.random() > 0.4) {
    const selectedBag = bags[0];
    outfit.push(selectedBag);
    explanation += `Como accesorio de carga, he sumado el bolso **${selectedBag.name}**. `;
  }

  // Añadir Accesorio (Opcional - 40% probabilidad, o gorro si hace frío / lentes si hace calor)
  let selectedAccessory = null;
  if (accessories.length > 0) {
    if (currentTemp < 10) {
      // Priorizar gorros de lana o bufandas
      const warmAcc = accessories.filter(a => a.subcategory === 'Bufanda' || a.subcategory === 'Gorro de Lana');
      if (warmAcc.length > 0) selectedAccessory = warmAcc[0];
    } else if (currentTemp > 24) {
      // Priorizar lentes de sol o gorras
      const sunAcc = accessories.filter(a => a.subcategory === 'Gafas de Sol' || a.subcategory === 'Gorra');
      if (sunAcc.length > 0) selectedAccessory = sunAcc[0];
    }

    if (!selectedAccessory && Math.random() > 0.6) {
      selectedAccessory = accessories[0];
    }

    if (selectedAccessory) {
      outfit.push(selectedAccessory);
      explanation += `Por último, el accesorio ideal: **${selectedAccessory.name}**. `;
    }
  }

  // Resumen del estilo
  let occasionName = 'Casual';
  if (occasionType === 'entrevista') occasionName = 'Formal / Entrevista';
  else if (occasionType === 'universidad') occasionName = 'Cómodo / Universitario';
  else if (occasionType === 'noche') occasionName = 'Sofisticado / Noche';
  else if (occasionType === 'deporte') occasionName = 'Deportivo / Funcional';

  return {
    success: true,
    style: occasionName,
    reply: `He diseñado esta combinación de estilo **${occasionName}** para hoy. ${explanation} ¡Espero que te guste!`,
    outfit: outfit
  };
}
