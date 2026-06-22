// Aura Closet - Servicio de Clima (Open-Meteo)
// Ubicación por defecto: Santiago de Chile (latitud -33.4489, longitud -70.6693)

const DEFAULT_LAT = -33.4489;
const DEFAULT_LON = -70.6693;

export async function fetchWeather(lat = DEFAULT_LAT, lon = DEFAULT_LON) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,rain&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=America/Santiago`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Open-Meteo API respondió con estado: ${response.status}`);
    }
    const data = await response.json();

    return {
      currentTemp: data.current.temperature_2m,
      maxTemp: data.daily.temperature_2m_max[0],
      minTemp: data.daily.temperature_2m_min[0],
      currentRain: data.current.rain,
      rainProbability: data.daily.precipitation_probability_max[0],
      isMock: false
    };
  } catch (err) {
    console.warn('Fallo al obtener clima real de Open-Meteo. Usando datos mock de contingencia:', err.message);
    
    // Fallback inteligente: datos mock basados en la temporada real del año
    const month = new Date().getMonth(); // 0: Ene, 11: Dic
    let mockData = {
      currentTemp: 18.5,
      maxTemp: 22.0,
      minTemp: 9.5,
      currentRain: 0.0,
      rainProbability: 10,
      isMock: true
    };

    // Meses de invierno en Santiago (Junio, Julio, Agosto)
    if (month >= 5 && month <= 7) {
      mockData = {
        currentTemp: 11.2,
        maxTemp: 14.5,
        minTemp: 4.1,
        currentRain: 0.5, // Simular llovizna
        rainProbability: 65,
        isMock: true
      };
    } 
    // Meses de verano en Santiago (Diciembre, Enero, Febrero)
    else if (month === 11 || month === 0 || month === 1) {
      mockData = {
        currentTemp: 29.0,
        maxTemp: 32.5,
        minTemp: 14.0,
        currentRain: 0.0,
        rainProbability: 0,
        isMock: true
      };
    }

    return mockData;
  }
}
