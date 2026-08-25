export type WindyWeather = {
  temperatures: number[];
  rain: number[];
  wind: number;
  currentRain: number;
};

type WindyForecast = {
  ts?: number[];
  'temp-surface'?: number[];
  'precip-surface'?: number[];
  'wind_u-surface'?: number[];
  'wind_v-surface'?: number[];
};

function dayIndex(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export async function fetchWindyWeather(latitude: string | number, longitude: string | number): Promise<WindyWeather> {
  const apiKey = import.meta.env.VITE_WINDY_API_KEY;
  if (!apiKey) return fetchPublicWeather(latitude, longitude);

  const response = await fetch('https://api.windy.com/api/point-forecast/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lat: Number(latitude),
      lon: Number(longitude),
      model: 'ecmwf',
      parameters: ['temp', 'precip', 'wind'],
      levels: ['surface'],
      key: apiKey,
    }),
  });
  if (!response.ok) throw new Error(`Windy API request failed: ${response.status}`);

  const data = await response.json() as WindyForecast;
  const timestamps = data.ts || [];
  const temperatures = data['temp-surface'] || [];
  const precipitation = data['precip-surface'] || [];
  const windU = data['wind_u-surface'] || [];
  const windV = data['wind_v-surface'] || [];
  if (!timestamps.length || !temperatures.length) throw new Error('Windy API returned no forecast');

  const today = dayIndex(Date.now());
  const daily = new Map<string, { max: number; rain: number }>();
  timestamps.forEach((timestamp, index) => {
    const key = dayIndex(timestamp);
    if (!daily.has(key)) daily.set(key, { max: -Infinity, rain: 0 });
    const value = daily.get(key)!;
    value.max = Math.max(value.max, temperatures[index] - 273.15);
    value.rain = Math.max(value.rain, (precipitation[index] || 0) > 0 ? 100 : 0);
  });
  const forecastDays = [...daily.entries()]
    .filter(([key]) => key >= today)
    .slice(0, 3)
    .map(([, value]) => ({ temperature: Math.round(value.max), rain: value.rain }));
  const windSpeed = Math.sqrt((windU[0] || 0) ** 2 + (windV[0] || 0) ** 2) * 3.6;

  return {
    temperatures: forecastDays.map((day) => day.temperature),
    rain: forecastDays.map((day) => day.rain),
    wind: Math.round(windSpeed),
    currentRain: precipitation[0] || 0,
  };
}

async function fetchPublicWeather(latitude: string | number, longitude: string | number): Promise<WindyWeather> {
  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,wind_speed_10m,precipitation&daily=temperature_2m_max,precipitation_probability_max&forecast_days=3&timezone=auto`,
  );
  if (!response.ok) throw new Error(`Public weather API request failed: ${response.status}`);

  const data = await response.json() as {
    current?: { wind_speed_10m?: number; precipitation?: number };
    daily?: { temperature_2m_max?: number[]; precipitation_probability_max?: number[] };
  };
  const temperatures = data.daily?.temperature_2m_max || [];
  const rain = data.daily?.precipitation_probability_max || [];
  if (temperatures.length === 0 || rain.length === 0) throw new Error('Public weather API returned no forecast');

  return {
    temperatures: temperatures.slice(0, 3).map(Math.round),
    rain: rain.slice(0, 3).map(Math.round),
    wind: Math.round(data.current?.wind_speed_10m || 0),
    currentRain: data.current?.precipitation || 0,
  };
}