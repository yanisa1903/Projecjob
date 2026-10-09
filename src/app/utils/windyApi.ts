export type WindyWeather = {
  temperatures: number[];
  rain: number[];
  currentTemperature: number | null;
  wind: number;
  currentRain: number;
  humidity: number | null;
  updatedAt: string;
  condition: 'clear' | 'cloudy' | 'rain' | 'thunderstorm';
  isNight: boolean;
  weatherCode?: number | null;
  isDay?: number | null;
};

type WindyForecast = {
  ts?: number[];
  'temp-surface'?: number[];
  'precip-surface'?: number[];
  'wind_u-surface'?: number[];
  'wind_v-surface'?: number[];
  'clouds-surface'?: number[];
  'cape-surface'?: number[];
};

function dayIndex(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function conditionFromWeatherCode(code?: number, rain = 0, cloudCover?: number, cape = 0): WindyWeather['condition'] {
  if (code !== undefined && code >= 95 || (rain > 0 && cape >= 500)) return 'thunderstorm';
  if ((code !== undefined && code >= 51 && code <= 82) || rain > 0) return 'rain';
  if ((code !== undefined && [1, 2, 3, 45, 48].includes(code)) || (cloudCover !== undefined && cloudCover >= 55)) return 'cloudy';
  return 'clear';
}

export async function fetchWindyWeather(latitude: string | number, longitude: string | number): Promise<WindyWeather> {
  const tmdWeather = await fetchTmdWeather(latitude, longitude).catch(() => null);
  if (tmdWeather) return tmdWeather;

  const apiKey = import.meta.env.VITE_WINDY_API_KEY;
  if (!apiKey) return fetchPublicWeather(latitude, longitude);

  const response = await fetch('https://api.windy.com/api/point-forecast/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lat: Number(latitude),
      lon: Number(longitude),
      model: 'ecmwf',
      parameters: ['temp', 'precip', 'wind', 'clouds', 'cape'],
      levels: ['surface'],
      key: apiKey,
    }),
  });
  if (!response.ok) return fetchPublicWeather(latitude, longitude);

  const data = await response.json() as WindyForecast;
  const timestamps = data.ts || [];
  const temperatures = data['temp-surface'] || [];
  const precipitation = data['precip-surface'] || [];
  const windU = data['wind_u-surface'] || [];
  const windV = data['wind_v-surface'] || [];
  const cloudCover = data['clouds-surface']?.[0];
  const cape = data['cape-surface']?.[0] || 0;
  if (!timestamps.length || !temperatures.length) return fetchPublicWeather(latitude, longitude);

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
    currentTemperature: temperatures[0] != null ? Math.round(temperatures[0] - 273.15) : null,
    wind: Math.round(windSpeed),
    currentRain: precipitation[0] || 0,
    humidity: null,
    updatedAt: new Date().toISOString(),
    condition: conditionFromWeatherCode(undefined, precipitation[0] || 0, cloudCover, cape),
    isNight: new Date().getHours() < 6 || new Date().getHours() >= 18,
    weatherCode: null,
    isDay: new Date().getHours() < 6 || new Date().getHours() >= 18 ? 0 : 1,
  };
}

async function fetchPublicWeather(latitude: string | number, longitude: string | number): Promise<WindyWeather> {
  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code,is_day&daily=temperature_2m_max,precipitation_probability_max&forecast_days=3&timezone=auto`,
  );
  if (!response.ok) throw new Error(`Public weather API request failed: ${response.status}`);

  const data = await response.json() as {
    current?: { time?: string; temperature_2m?: number; relative_humidity_2m?: number; wind_speed_10m?: number; precipitation?: number; weather_code?: number; is_day?: number };
    daily?: { temperature_2m_max?: number[]; precipitation_probability_max?: number[] };
  };
  const temperatures = data.daily?.temperature_2m_max || [];
  const rain = data.daily?.precipitation_probability_max || [];
  if (temperatures.length === 0 || rain.length === 0) throw new Error('Public weather API returned no forecast');

  return {
    temperatures: temperatures.slice(0, 3).map(Math.round),
    rain: rain.slice(0, 3).map(Math.round),
    currentTemperature: typeof data.current?.temperature_2m === 'number' ? Math.round(data.current.temperature_2m) : null,
    wind: Math.round(data.current?.wind_speed_10m || 0),
    currentRain: data.current?.precipitation || 0,
    humidity: typeof data.current?.relative_humidity_2m === 'number' ? data.current.relative_humidity_2m : null,
    updatedAt: data.current?.time || new Date().toISOString(),
    condition: conditionFromWeatherCode(data.current?.weather_code, data.current?.precipitation || 0),
    isNight: data.current?.is_day === 0,
    weatherCode: typeof data.current?.weather_code === 'number' ? data.current.weather_code : null,
    isDay: typeof data.current?.is_day === 'number' ? data.current.is_day : null,
  };
}

async function fetchTmdWeather(latitude: string | number, longitude: string | number): Promise<WindyWeather | null> {
  const apiKey = import.meta.env.VITE_TMD_API_KEY;
  if (!apiKey) return null;

  const response = await fetch(
    `https://data.tmd.go.th/nwpapi/v1/forecast/location/hourly?lat=${latitude}&lon=${longitude}&fields=tc,rain,cond,ws,rh&duration=72`,
    { headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey}` } },
  );
  if (!response.ok) return null;

  const payload = await response.json() as Record<string, unknown>;
  const records = findForecastRecords(payload);
  if (records.length === 0) return null;

  const temperatures = records.map((record) => firstRecordNumber(record, ['tc', 'temp', 'temperature'])).filter(isNumber);
  const rain = records.map((record) => firstRecordNumber(record, ['rain', 'rain_probability', 'rain_prob', 'precipitation'])).filter(isNumber);
  if (temperatures.length === 0) return null;

  const current = records[0];
  const rainNow = firstRecordNumber(current, ['rain', 'precipitation']) || 0;
  const wind = firstRecordNumber(current, ['ws', 'wind_speed', 'wind']) || 0;
  const conditionText = firstRecordString(current, ['cond_en', 'condition', 'cond']).toLowerCase();
  const condition = conditionText.includes('thunder')
    ? 'thunderstorm'
    : conditionText.includes('rain') || rainNow > 0
      ? 'rain'
      : conditionText.includes('cloud')
        ? 'cloudy'
        : 'clear';
  return {
    temperatures: temperatures.slice(0, 3).map(Math.round),
    rain: rain.slice(0, 3).map(Math.round),
    currentTemperature: temperatures[0] != null ? Math.round(temperatures[0]) : null,
    wind: Math.round(wind),
    currentRain: rainNow,
    humidity: firstRecordNumber(current, ['rh', 'humidity', 'relative_humidity']) ?? null,
    updatedAt: new Date().toISOString(),
    condition,
    isNight: new Date().getHours() < 6 || new Date().getHours() >= 18,
    weatherCode: null,
    isDay: new Date().getHours() < 6 || new Date().getHours() >= 18 ? 0 : 1,
  };
}

function findForecastRecords(payload: Record<string, unknown>): TatForecastRecord[] {
  const candidates = [payload.forecasts, payload.forecast, payload.data, payload.results, payload.result];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.filter(isRecord);
    if (candidate && typeof candidate === 'object') {
      const nested = Object.values(candidate).find(Array.isArray);
      if (Array.isArray(nested)) return nested.filter(isRecord);
    }
  }
  return [];
}

type TatForecastRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is TatForecastRecord => Boolean(value && typeof value === 'object');
const isNumber = (value: number | undefined): value is number => typeof value === 'number' && Number.isFinite(value);
function firstRecordNumber(record: TatForecastRecord, keys: string[]) {
  for (const key of keys) {
    const value = Number(record[key]);
    if (Number.isFinite(value)) return value;
  }
  return undefined;
}
function firstRecordString(record: TatForecastRecord, keys: string[]) {
  return keys.map((key) => record[key]).find((value): value is string => typeof value === 'string') || '';
}