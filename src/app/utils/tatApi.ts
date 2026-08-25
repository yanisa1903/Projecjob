export type TatAttraction = {
  id?: string | number;
  name: string;
  province: string;
  type: string;
  description?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  images: string[];
};

export function lockTatImages(title: string, images: string[]) {
  const storageKey = `tat-images-v1-${title.replace(/[^a-z0-9ก-๙]+/gi, '-').toLowerCase()}`;
  try {
    const savedImages = JSON.parse(localStorage.getItem(storageKey) || '[]') as string[];
    if (savedImages.length >= 3) return savedImages.slice(0, 3);
    const uniqueImages = [...new Set(images.filter(Boolean))].slice(0, 3);
    if (uniqueImages.length >= 3) localStorage.setItem(storageKey, JSON.stringify(uniqueImages));
    return uniqueImages;
  } catch {
    return [...new Set(images.filter(Boolean))].slice(0, 3);
  }
}

type TatRecord = Record<string, unknown>;

function firstString(record: TatRecord, keys: string[]) {
  for (const key of keys) {
    if (typeof record[key] === 'string' && record[key]) return record[key] as string;
  }
  return '';
}

function firstNumber(record: TatRecord, keys: string[]) {
  for (const key of keys) {
    const value = Number(record[key]);
    if (Number.isFinite(value)) return value;
  }
  return undefined;
}

function firstIdentifier(record: TatRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' || typeof value === 'number') return value;
  }
  return undefined;
}

function imageUrls(record: TatRecord) {
  const urls: string[] = [];
  const collect = (value: unknown, fieldName = '') => {
    if (typeof value === 'string' && /^https?:\/\//i.test(value)) {
      if (fieldName || /\.(jpg|jpeg|png|webp)(\?|$)/i.test(value)) urls.push(value);
    } else if (Array.isArray(value)) {
      value.forEach((item) => collect(item, fieldName));
    } else if (value && typeof value === 'object') {
      const image = value as TatRecord;
      Object.entries(image).forEach(([key, item]) => {
        const imageField = /image|photo|picture|gallery|thumbnail|url|src/i.test(key) ? key : fieldName;
        collect(item, imageField);
      });
    }
  };

  Object.entries(record).forEach(([key, value]) => {
    if (/image|photo|picture|gallery|thumbnail|cover/i.test(key)) collect(value, key);
  });
  return [...new Set(urls)].slice(0, 3);
}

function toAttraction(record: TatRecord): TatAttraction | null {
  const name = firstString(record, ['placeName', 'place_name', 'name', 'title']);
  if (!name) return null;

  return {
    id: firstIdentifier(record, ['placeId', 'place_id', 'id']),
    name,
    province: firstString(record, ['province', 'province_name', 'destination', 'region']) || 'ประเทศไทย',
    type: firstString(record, ['category', 'placeType', 'place_type', 'type']) || 'สถานที่ท่องเที่ยว',
    description: firstString(record, ['detail', 'description', 'intro', 'short_description']),
    location: firstString(record, ['location', 'address', 'address_name']),
    latitude: firstNumber(record, ['latitude', 'lat']),
    longitude: firstNumber(record, ['longitude', 'lon', 'lng']),
    images: imageUrls(record),
  };
}

export async function fetchTatAttractions(limit = 50): Promise<TatAttraction[]> {
  const apiKey = import.meta.env.VITE_TAT_API_KEY;
  if (!apiKey) return [];

  const response = await fetch(
    `https://tatapi.tourismthailand.org/tatapi/v2/attraction?number=${limit}&offset=0`,
    {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'th',
        'x-api-key': apiKey,
      },
    },
  );
  if (!response.ok) throw new Error(`TAT API request failed: ${response.status}`);

  const data = await response.json() as { result?: TatRecord[]; data?: TatRecord[] };
  const places = (data.result || data.data || [])
    .map(toAttraction)
    .filter((place): place is TatAttraction => Boolean(place));
  return Promise.all(places.map(async (place) => {
    if (place.images.length >= 3 || place.id === undefined) return place;
    try {
      const detailResponse = await fetch(`https://tatapi.tourismthailand.org/tatapi/v2/attraction/${place.id}`, {
        headers: { Accept: 'application/json', 'Accept-Language': 'th', 'x-api-key': apiKey },
      });
      if (!detailResponse.ok) return place;
      const detail = await detailResponse.json() as { result?: TatRecord | TatRecord[]; data?: TatRecord | TatRecord[] };
      const detailRecord = Array.isArray(detail.result) ? detail.result[0] : detail.result || (Array.isArray(detail.data) ? detail.data[0] : detail.data);
      return detailRecord ? { ...place, images: imageUrls(detailRecord) } : place;
    } catch {
      return place;
    }
  }));
}

export async function fetchTatPlace(title: string): Promise<TatAttraction | null> {
  const places = await fetchTatAttractions(100);
  const normalizedTitle = title.replace(/\s+/g, '').toLowerCase();
  return places.find((place) => {
    const normalizedName = place.name.replace(/\s+/g, '').toLowerCase();
    return normalizedName.includes(normalizedTitle) || normalizedTitle.includes(normalizedName);
  }) || null;
}