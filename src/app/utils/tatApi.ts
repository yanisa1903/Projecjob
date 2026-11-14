import { normalizePlaceHighlights } from './placeHighlights';

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
  rating?: number;
  reviewCount?: number;
  entranceFee?: number;
  cost?: string;
  recommendedTime?: string;
  openingHours?: string;
  contactPhone?: string;
  travelCaution?: string;
  highlights?: string[];
  suitableFor?: string[];
  createdAt?: string;
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
    if (typeof record[key] === 'number' && Number.isFinite(record[key])) return String(record[key]);
  }
  return '';
}

function firstTextList(record: TatRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.split(/[\n;|]+/).map((item) => item.trim()).filter(Boolean);
    }
    if (Array.isArray(value)) {
      const items = value.flatMap((item) => {
        if (typeof item === 'string' && item.trim()) return [item.trim()];
        if (item && typeof item === 'object') {
          const text = firstString(item as TatRecord, ['name', 'title', 'detail', 'description', 'value']);
          return text ? [text] : [];
        }
        return [];
      });
      if (items.length) return items;
    }
  }
  return undefined;
}

function firstNumber(record: TatRecord, keys: string[]) {
  for (const key of keys) {
    const rawValue = record[key];
    if (typeof rawValue !== 'number' && (typeof rawValue !== 'string' || !rawValue.trim())) continue;
    const value = Number(rawValue);
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
    province: firstString(record, ['province', 'province_name', 'placeProvince', 'place_province', 'destination', 'region']) || 'ประเทศไทย',
    type: firstString(record, ['category', 'placeType', 'place_type', 'type']) || 'สถานที่ท่องเที่ยว',
    description: firstString(record, ['detail', 'placeDetail', 'place_detail', 'description', 'placeDescription', 'place_description', 'intro', 'short_description']),
    location: firstString(record, ['location', 'placeLocation', 'place_location', 'address', 'placeAddress', 'place_address', 'address_name']),
    latitude: firstNumber(record, ['latitude', 'placeLatitude', 'place_latitude', 'place_lat', 'lat']),
    longitude: firstNumber(record, ['longitude', 'placeLongitude', 'place_longitude', 'place_lng', 'lon', 'lng']),
    images: imageUrls(record),
    rating: firstNumber(record, ['rating', 'average_rating', 'review_score']),
    reviewCount: firstNumber(record, ['review_count', 'reviews_count', 'number_of_reviews']),
    entranceFee: firstNumber(record, ['entrance_fee', 'place_fee', 'place_entrance_fee', 'admission_fee', 'ticket_price']),
    cost: firstString(record, ['cost', 'placeCost', 'place_cost', 'expense', 'expenses', 'price', 'fee', 'place_fee', 'place_entrance_fee', 'admission_fee', 'entrance_fee', 'ticket_price']),
    recommendedTime: firstString(record, ['recommended_time', 'recommendedTime', 'recommendedVisitTime', 'recommended_visit_time', 'best_time_to_visit', 'bestTimeToVisit', 'visit_time']),
    openingHours: firstString(record, ['opening_hours', 'placeOpeningHours', 'place_opening_hours', 'openingHours', 'open_time', 'business_hours', 'operating_hours']),
    contactPhone: firstString(record, ['contact_phone', 'contactPhone', 'place_phone', 'place_tel', 'phone_number', 'phone', 'telephone', 'tel']),
    travelCaution: firstString(record, ['travel_caution', 'travelCaution', 'place_caution', 'caution', 'warning', 'safety_tips', 'tips']),
    highlights: normalizePlaceHighlights(firstTextList(record, ['highlights', 'highlight', 'place_highlights', 'place_highlight', 'main_features', 'feature']) || []),
    suitableFor: firstTextList(record, ['suitable_for', 'suitableFor', 'tags', 'tag']),
    createdAt: firstString(record, ['created_at', 'createdAt', 'date_created']),
  };
}

type TatApiResponse = { result?: TatRecord | TatRecord[]; data?: TatRecord | TatRecord[] };

function recordsFromResponse(data: TatApiResponse) {
  const records = data.result ?? data.data;
  return Array.isArray(records) ? records : records && typeof records === 'object' ? [records] : [];
}

async function fetchTatRecords(limit: number): Promise<TatRecord[]> {
  const response = await fetch(`/api/tat/attraction?number=${limit}&offset=0`);
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error || `TAT API request failed: ${response.status}`);
  }
  return recordsFromResponse(await response.json() as TatApiResponse);
}

async function fetchTatDetail(id: string | number): Promise<TatRecord | null> {
  const response = await fetch(`/api/tat/attraction/${encodeURIComponent(String(id))}`);
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error || `TAT API detail request failed: ${response.status}`);
  }
  return recordsFromResponse(await response.json() as TatApiResponse)[0] || null;
}

export async function fetchTatAttractions(limit = 50): Promise<TatAttraction[]> {
  const places = (await fetchTatRecords(limit))
    .map(toAttraction)
    .filter((place): place is TatAttraction => Boolean(place));
  return Promise.all(places.map(async (place) => {
    if (place.images.length >= 3 || place.id === undefined) return place;
    try {
      const detailRecord = await fetchTatDetail(place.id);
      return detailRecord ? { ...place, images: imageUrls(detailRecord) } : place;
    } catch {
      return place;
    }
  }));
}

export async function fetchTatPlace(title?: string, id?: string | number): Promise<TatAttraction | null> {
  if (!title && id === undefined) return null;

  if (id !== undefined) {
    const detailRecord = await fetchTatDetail(id);
    return detailRecord ? toAttraction(detailRecord) : null;
  }

  const records = await fetchTatRecords(100);
  const normalizedTitle = title?.replace(/\s+/g, '').toLocaleLowerCase('th');
  const matchedRecord = records.find((record) => {
    const name = firstString(record, ['placeName', 'place_name', 'name', 'title']);
    const normalizedName = name.replace(/\s+/g, '').toLocaleLowerCase('th');
    return normalizedName && normalizedTitle
      && (normalizedName === normalizedTitle || normalizedName.includes(normalizedTitle) || normalizedTitle.includes(normalizedName));
  });
  if (title && !matchedRecord) return null;
  const recordId = matchedRecord ? firstIdentifier(matchedRecord, ['placeId', 'place_id', 'id']) : id;
  if (!matchedRecord && recordId === undefined) return null;

  const detailRecord = recordId === undefined ? null : await fetchTatDetail(recordId);
  const mergedRecord = matchedRecord && detailRecord
    ? { ...matchedRecord, ...detailRecord }
    : matchedRecord || detailRecord;
  if (!mergedRecord) return null;

  return toAttraction(mergedRecord);
}