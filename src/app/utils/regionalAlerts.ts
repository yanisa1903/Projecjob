export type AlertCoordinates = {
  latitude: number;
  longitude: number;
};

export type AlertLocation = AlertCoordinates & {
  province: string;
};

export type RegionalAlertData = {
  pm25: number | null;
  aqi: number | null;
  currentRain: number | null;
  rainProbability: number | null;
  temperature: number | null;
  humidity: number | null;
  windSpeed: number | null;
  windGusts: number | null;
  weatherCode: number | null;
  weatherDescription: string | null;
  nextThreeHoursRain: number | null;
  nextThreeDaysRain: number | null;
  riverDischarge: number[] | null;
  unavailableSources: string[];
  updatedAt: string;
};

const HEAVY_RAIN_MM = 10;
const HIGH_FLOOD_RAINFALL_MM_PER_DAY = 100;
const HIGH_RIVER_DISCHARGE_MINIMUM = 100;
const HIGH_RIVER_DISCHARGE_RISE_RATIO = 1.5;
const HIGH_PM25_UG_PER_M3 = 37.5;

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`API request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

export async function getProvinceForCoordinates(
  latitude: number,
  longitude: number,
): Promise<string> {
  try {
    const data = await fetchJson<{
      address?: { province?: string; state?: string; city?: string };
    }>(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1&accept-language=th`,
    );
    const province = data.address?.province || data.address?.state || data.address?.city;
    if (province) return province.replace(/^จังหวัด/, '');
  } catch {
    // Try the alternate geocoder if the primary reverse lookup is unavailable.
  }

  const fallback = await fetchJson<{
    features?: Array<{ properties?: { state?: string; city?: string } }>;
  }>(`https://photon.komoot.io/reverse?lon=${longitude}&lat=${latitude}`);
  const province = fallback.features?.[0]?.properties?.state || fallback.features?.[0]?.properties?.city;
  if (!province) throw new Error('Reverse geocoding did not return a province');
  return province.replace(/^จังหวัด/, '');
}

export async function findAlertLocation(query: string): Promise<AlertLocation> {
  try {
    const results = await fetchJson<Array<{
      lat?: string;
      lon?: string;
      state?: string;
      county?: string;
      city?: string;
      country?: string;
    }>>(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&country=Thailand&q=${encodeURIComponent(query)}`,
    );
    const result = results[0];
    const latitude = Number(result?.lat);
    const longitude = Number(result?.lon);
    const province = result?.state || result?.county || result?.city;
    if (Number.isFinite(latitude) && Number.isFinite(longitude) && province) {
      return { latitude, longitude, province: province.replace(/^จังหวัด/, '') };
    }
  } catch {
    // Try the alternate geocoder if the primary search is unavailable.
  }

  const fallback = await fetchJson<{
    features?: Array<{
      geometry?: { coordinates?: [number, number] };
      properties?: { countrycode?: string; state?: string; city?: string; name?: string };
    }>;
  }>(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&countrycode=TH`);
  const result = fallback.features?.find((feature) => feature.properties?.countrycode === 'TH'
    && feature.geometry?.coordinates?.length === 2
    && (feature.properties.state || feature.properties.city));
  const coordinates = result?.geometry?.coordinates;
  const province = result?.properties?.state || result?.properties?.city;
  if (!coordinates || !province) throw new Error('Could not find a province for the selected location');
  return { longitude: coordinates[0], latitude: coordinates[1], province: province.replace(/^จังหวัด/, '') };
}

async function fetchWeather(coordinates: AlertCoordinates) {
  const data = await fetchJson<{
    current?: {
      precipitation?: number;
      temperature_2m?: number;
      relative_humidity_2m?: number;
      wind_speed_10m?: number;
      wind_gusts_10m?: number;
      weather_code?: number;
    };
    hourly?: { time?: string[]; precipitation?: number[]; precipitation_probability?: number[] };
    daily?: { precipitation_sum?: number[] };
  }>(
    `https://api.open-meteo.com/v1/forecast?latitude=${coordinates.latitude}&longitude=${coordinates.longitude}&current=precipitation,temperature_2m,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,weather_code&hourly=precipitation,precipitation_probability&daily=precipitation_sum&forecast_days=3&timezone=Asia%2FBangkok`,
  );
  const currentRain = data.current?.precipitation;
  const hourlyTimes = data.hourly?.time;
  const hourlyRain = data.hourly?.precipitation;
  const hourlyRainProbability = data.hourly?.precipitation_probability;
  const dailyRainValues = data.daily?.precipitation_sum;
  if (
    typeof currentRain !== 'number'
    || !hourlyTimes?.length
    || !hourlyRain?.some((value) => Number.isFinite(value))
    || !dailyRainValues?.some((value) => Number.isFinite(value))
  ) {
    throw new Error('Weather API returned incomplete data');
  }
  const now = Date.now();
  const nextThreeHoursIndexes = hourlyTimes.reduce<number[]>((indexes, time, index) => {
    const timestamp = new Date(`${time}:00+07:00`).getTime();
    if (timestamp >= now && timestamp <= now + 3 * 60 * 60 * 1000) indexes.push(index);
    return indexes;
  }, []);
  const nextThreeHoursRain = nextThreeHoursIndexes.reduce(
    (maximum, index) => Math.max(maximum, hourlyRain[index] || 0),
    0,
  );
  const rainProbability = hourlyRainProbability
    ? nextThreeHoursIndexes.reduce<number | null>((maximum, index) => {
        const probability = hourlyRainProbability[index];
        return typeof probability === 'number'
          ? Math.max(maximum ?? 0, probability)
          : maximum;
      }, null)
    : null;
  const dailyRain = dailyRainValues.filter((value) => Number.isFinite(value));
  const weatherCode = data.current?.weather_code ?? null;
  return {
    currentRain,
    temperature: data.current?.temperature_2m ?? null,
    humidity: data.current?.relative_humidity_2m ?? null,
    rainProbability,
    windSpeed: data.current?.wind_speed_10m ?? null,
    windGusts: data.current?.wind_gusts_10m ?? null,
    weatherCode,
    weatherDescription: describeWeather(weatherCode),
    nextThreeHoursRain,
    nextThreeDaysRain: Math.max(0, ...dailyRain),
  };
}

function describeWeather(code: number | null) {
  if (code === null) return null;
  if (code === 0) return 'ท้องฟ้าแจ่มใส';
  if (code === 1) return 'มีเมฆเล็กน้อย';
  if (code === 2) return 'มีเมฆบางส่วน';
  if (code === 3) return 'มีเมฆมาก';
  if (code === 45 || code === 48) return 'มีหมอก';
  if ([51, 53, 55, 56, 57].includes(code)) return 'มีฝนละออง';
  if ([61, 63, 66, 80, 81].includes(code)) return 'ฝนตก';
  if ([65, 67, 82].includes(code)) return 'ฝนตกหนัก';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'หิมะตก';
  if (code === 95) return 'พายุฝนฟ้าคะนอง';
  if (code === 96 || code === 99) return 'พายุฝนฟ้าคะนองและลูกเห็บ';
  return 'ไม่ทราบสภาพอากาศ';
}

async function fetchAirQuality(coordinates: AlertCoordinates) {
  const data = await fetchJson<{ current?: { pm2_5?: number; us_aqi?: number } }>(
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${coordinates.latitude}&longitude=${coordinates.longitude}&current=pm2_5,us_aqi&timezone=auto`,
  );
  if (typeof data.current?.pm2_5 !== 'number' || typeof data.current.us_aqi !== 'number') {
    throw new Error('Air quality API returned incomplete measurements');
  }
  return { pm25: data.current.pm2_5, aqi: Math.round(data.current.us_aqi) };
}

async function fetchRiverDischarge(coordinates: AlertCoordinates) {
  const data = await fetchJson<{ daily?: { river_discharge?: number[] } }>(
    `https://flood-api.open-meteo.com/v1/flood?latitude=${coordinates.latitude}&longitude=${coordinates.longitude}&daily=river_discharge&forecast_days=7`,
  );
  const discharge = data.daily?.river_discharge?.filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value),
  );
  if (!discharge?.length) throw new Error('Flood forecast API returned no river discharge data');
  return discharge;
}

export async function fetchRegionalAlerts(
  coordinates: AlertCoordinates,
): Promise<RegionalAlertData> {
  const sources = await Promise.allSettled([
    fetchWeather(coordinates),
    fetchAirQuality(coordinates),
    fetchRiverDischarge(coordinates),
  ]);
  const [weather, airQuality, flood] = sources;
  const unavailableSources: string[] = [];
  if (weather.status === 'rejected') unavailableSources.push('สภาพอากาศ');
  if (airQuality.status === 'rejected') unavailableSources.push('คุณภาพอากาศ');
  if (flood.status === 'rejected') unavailableSources.push('ข้อมูลแม่น้ำ');
  if (unavailableSources.length === sources.length) {
    throw new Error('All regional alert data sources are unavailable');
  }

  return {
    currentRain: weather.status === 'fulfilled' ? weather.value.currentRain : null,
    rainProbability: weather.status === 'fulfilled' ? weather.value.rainProbability : null,
    temperature: weather.status === 'fulfilled' ? weather.value.temperature : null,
    humidity: weather.status === 'fulfilled' ? weather.value.humidity : null,
    windSpeed: weather.status === 'fulfilled' ? weather.value.windSpeed : null,
    windGusts: weather.status === 'fulfilled' ? weather.value.windGusts : null,
    weatherCode: weather.status === 'fulfilled' ? weather.value.weatherCode : null,
    weatherDescription: weather.status === 'fulfilled' ? weather.value.weatherDescription : null,
    nextThreeHoursRain: weather.status === 'fulfilled' ? weather.value.nextThreeHoursRain : null,
    nextThreeDaysRain: weather.status === 'fulfilled' ? weather.value.nextThreeDaysRain : null,
    pm25: airQuality.status === 'fulfilled' ? airQuality.value.pm25 : null,
    aqi: airQuality.status === 'fulfilled' ? airQuality.value.aqi : null,
    riverDischarge: flood.status === 'fulfilled' ? flood.value : null,
    unavailableSources,
    updatedAt: new Date().toISOString(),
  };
}

export function hasHeavyRain(data: RegionalAlertData) {
  return (data.currentRain ?? 0) >= HEAVY_RAIN_MM || (data.nextThreeHoursRain ?? 0) >= HEAVY_RAIN_MM;
}

export function hasHighFloodRisk(data: RegionalAlertData) {
  const discharge = data.riverDischarge;
  const riverIsRising = Boolean(
    discharge
    && discharge.length >= 2
    && discharge[0] >= HIGH_RIVER_DISCHARGE_MINIMUM
    && discharge[1] >= discharge[0] * HIGH_RIVER_DISCHARGE_RISE_RATIO,
  );
  return (data.nextThreeDaysRain ?? 0) >= HIGH_FLOOD_RAINFALL_MM_PER_DAY || riverIsRising;
}

export function hasHighPm25(data: RegionalAlertData) {
  return (data.pm25 ?? 0) > HIGH_PM25_UG_PER_M3;
}
