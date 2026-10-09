export type TripWeatherDay = {
  date: string;
  maxTemperature: number | null;
  minTemperature: number | null;
  precipitationProbability: number | null;
  precipitation: number | null;
  weatherCode: number | null;
  maxWindSpeed: number | null;
  waveHeightMax: number | null;
  pm25: number | null;
  aqi: number | null;
};

export type TripForecast = {
  days: TripWeatherDay[];
  pm25Available: boolean;
  aqiAvailable: boolean;
  waveHeightAvailable: boolean;
};

type WeatherResponse = {
  daily?: {
    time?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
    precipitation_sum?: number[];
    weather_code?: number[];
    wind_speed_10m_max?: number[];
  };
};

type AirQualityResponse = {
  hourly?: {
    time?: string[];
    pm2_5?: number[];
    us_aqi?: number[];
  };
};

type MarineResponse = {
  daily?: {
    time?: string[];
    wave_height_max?: number[];
  };
};

const getNumber = (values: number[] | undefined, index: number) => {
  const value = values?.[index];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Forecast request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

export async function fetchTripForecast(
  latitude: string | number,
  longitude: string | number,
  startDate: string,
  endDate: string,
  signal: AbortSignal,
  includeMarine = false,
): Promise<TripForecast> {
  const coordinates = `latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`;
  const dateRange = `start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?${coordinates}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,weather_code,wind_speed_10m_max&${dateRange}&timezone=auto`;
  const airQualityUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?${coordinates}&hourly=pm2_5,us_aqi&${dateRange}&timezone=auto`;
  const weather = await fetchJson<WeatherResponse>(weatherUrl, signal);
  const dates = weather.daily?.time;
  if (!dates?.length) throw new Error('No forecast data for selected dates');

  let wavesByDate = new Map<string, number>();
  if (includeMarine) {
    try {
      const marineUrl = `https://marine-api.open-meteo.com/v1/marine?${coordinates}&daily=wave_height_max&${dateRange}&timezone=auto`;
      const marine = await fetchJson<MarineResponse>(marineUrl, signal);
      const marineDates = marine.daily?.time || [];
      const waveHeights = marine.daily?.wave_height_max || [];
      wavesByDate = new Map(marineDates.flatMap((date, index) => {
        const waveHeight = getNumber(waveHeights, index);
        return waveHeight === null ? [] : [[date, waveHeight]];
      }));
    } catch (error) {
      if (signal.aborted) throw error;
    }
  }

  let airByDate = new Map<string, { pm25: number | null; aqi: number | null }>();
  let pm25Available = false;
  let aqiAvailable = false;
  try {
    const airQuality = await fetchJson<AirQualityResponse>(airQualityUrl, signal);
    const hourly = airQuality.hourly;
    if (hourly?.time?.length) {
      const grouped = new Map<string, { pm25: number[]; aqi: number[] }>();
      hourly.time.forEach((time, index) => {
        const date = time.slice(0, 10);
        const values = grouped.get(date) || { pm25: [], aqi: [] };
        const pm25 = getNumber(hourly.pm2_5, index);
        const aqi = getNumber(hourly.us_aqi, index);
        if (pm25 !== null) values.pm25.push(pm25);
        if (aqi !== null) values.aqi.push(aqi);
        grouped.set(date, values);
      });
      airByDate = new Map([...grouped].map(([date, values]) => [
        date,
        {
          pm25: values.pm25.length ? Math.max(...values.pm25) : null,
          aqi: values.aqi.length ? Math.max(...values.aqi) : null,
        },
      ]));
      pm25Available = dates.every((date) => airByDate.get(date)?.pm25 !== null && airByDate.get(date)?.pm25 !== undefined);
      aqiAvailable = dates.every((date) => airByDate.get(date)?.aqi !== null && airByDate.get(date)?.aqi !== undefined);
    }
  } catch (error) {
    if (signal.aborted) throw error;
  }

  const daily = weather.daily;
  return {
    days: dates.map((date, index) => ({
      date,
      maxTemperature: getNumber(daily.temperature_2m_max, index),
      minTemperature: getNumber(daily.temperature_2m_min, index),
      precipitationProbability: getNumber(daily.precipitation_probability_max, index),
      precipitation: getNumber(daily.precipitation_sum, index),
      weatherCode: getNumber(daily.weather_code, index),
      maxWindSpeed: getNumber(daily.wind_speed_10m_max, index),
      waveHeightMax: wavesByDate.get(date) ?? null,
      pm25: airByDate.get(date)?.pm25 ?? null,
      aqi: airByDate.get(date)?.aqi ?? null,
    })),
    pm25Available,
    aqiAvailable,
    waveHeightAvailable: includeMarine && dates.every((date) => wavesByDate.has(date)),
  };
}

export function describeWeatherCode(code: number | null) {
  if (code === null) return 'ไม่มีข้อมูลสภาพอากาศ';
  if (code === 0) return 'ท้องฟ้าแจ่มใส';
  if (code <= 3) return 'มีเมฆบางส่วน';
  if (code === 45 || code === 48) return 'มีหมอก';
  if (code >= 51 && code <= 57) return 'ฝนละออง';
  if (code >= 61 && code <= 67) return 'ฝนตก';
  if (code >= 71 && code <= 77) return 'หิมะตก';
  if (code >= 80 && code <= 82) return 'ฝนตกเป็นช่วง';
  if (code === 85 || code === 86) return 'หิมะตกเป็นช่วง';
  if (code >= 95) return 'พายุฝนฟ้าคะนอง';
  return 'สภาพอากาศแปรปรวน';
}
