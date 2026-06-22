import React from 'react';

export default function WeatherCard({ weather }) {
  if (!weather) return null;

  const { currentTemp, maxTemp, minTemp, currentRain, rainProbability, isMock } = weather;

  const getRecommendation = () => {
    if (currentRain > 0 || rainProbability > 50) {
      return 'Día lluvioso en Santiago. Te recomiendo priorizar abrigos y calzado con resistencia al agua (rainFriendly).';
    }
    if (currentTemp < 12) {
      return 'Bajas temperaturas. Se sugiere vestir en capas y sumar obligatoriamente una parka o chaqueta abrigada.';
    }
    if (currentTemp > 24) {
      return 'Clima caluroso. Ideal para prendas ligeras, poleras de manga corta y vestidos frescos de verano.';
    }
    return 'Temperatura agradable en Santiago. Perfecto para un blazer clásico, zapatillas urbanas o combinaciones casuales.';
  };

  const getWeatherIcon = () => {
    if (currentRain > 0 || rainProbability > 50) {
      return <i className="weather-large-icon" data-lucide="cloud-rain" style={{ color: '#007aff' }}></i>;
    }
    if (currentTemp < 14) {
      return <i className="weather-large-icon" data-lucide="snowflake" style={{ color: '#8ec5fc' }}></i>;
    }
    if (currentTemp > 25) {
      return <i className="weather-large-icon" data-lucide="sun" style={{ color: '#ff9500' }}></i>;
    }
    return <i className="weather-large-icon" data-lucide="cloud-sun" style={{ color: '#ff9500' }}></i>;
  };

  // Re-inicializar iconos Lucide cada vez que el componente se renderice para asegurar que se muestre el icono
  React.useEffect(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }, [weather]);

  return (
    <div className="details-card weather-card-widget">
      <div className="card-header">
        <h3>
          <i data-lucide="cloud-sun"></i> Clima en Santiago
        </h3>
        <p>Santiago de Chile {isMock ? '(Datos Simulados)' : '(Tiempo Real)'}</p>
      </div>

      <div className="weather-body">
        <div className="weather-left">
          {getWeatherIcon()}
          <span className="weather-current-temp">{currentTemp.toFixed(1)}°C</span>
        </div>
        
        <div className="weather-right">
          <div className="weather-metric">
            <span className="metric-label">Max / Min:</span>
            <span className="metric-value">{maxTemp.toFixed(1)}° / {minTemp.toFixed(1)}°C</span>
          </div>
          <div className="weather-metric">
            <span className="metric-label">Prob. Lluvia:</span>
            <span className="metric-value">{rainProbability}%</span>
          </div>
          {currentRain > 0 && (
            <div className="weather-metric">
              <span className="metric-label">Precipitación:</span>
              <span className="metric-value">{currentRain} mm</span>
            </div>
          )}
        </div>
      </div>
      
      <hr className="weather-divider" />
      
      <div className="weather-recommendation">
        <span className="recommendation-badge">Recomendación de Aura:</span>
        <p className="recommendation-text">{getRecommendation()}</p>
      </div>
    </div>
  );
}
