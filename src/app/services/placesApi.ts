export interface PlaceSearchResult {
  id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  userRatingCount?: number;
  photoName?: string;
  types?: string[];
  osmKey?: string;
  osmValue?: string;
}

const TOURIST_OSM_TYPES = new Set([
  'tourism:attraction', 'tourism:artwork', 'tourism:museum', 'tourism:theme_park',
  'tourism:viewpoint', 'tourism:zoo', 'tourism:aquarium', 'tourism:gallery',
  'historic:archaeological_site', 'historic:castle', 'historic:fort', 'historic:memorial',
  'historic:monument', 'historic:ruins', 'historic:city_gate', 'natural:beach',
  'natural:cave_entrance', 'natural:peak', 'natural:hot_spring', 'natural:waterfall',
  'natural:bay', 'natural:cliff', 'natural:mountain_range', 'natural:water',
  'place:island', 'waterway:waterfall', 'boundary:national_park', 'boundary:protected_area',
  'leisure:nature_reserve', 'leisure:park', 'amenity:place_of_worship',
]);
const GOOGLE_TOURISM_TYPES = new Set([
  'tourist_attraction', 'national_park', 'park', 'museum', 'art_gallery', 'zoo',
  'aquarium', 'hindu_temple', 'buddhist_temple', 'church', 'mosque',
]);

function normalizeSearchText(value: string) {
  return value.toLocaleLowerCase('th').normalize('NFC').replace(/\s+/g, ' ').trim();
}

export function rankPlaceSearchResults(query: string, places: PlaceSearchResult[]): PlaceSearchResult[] {
  const term = normalizeSearchText(query)
    .replace(/^สถานที่ท่องเที่ยว\s*/i, '')
    .replace(/\s*ในประเทศไทย\s*$/i, '')
    .trim();
  const score = (place: PlaceSearchResult) => {
    const name = normalizeSearchText(place.name);
    const exact = name === term ? 1200 : 0;
    const startsWith = name.startsWith(term) ? 700 : 0;
    const contains = name.includes(term) ? 350 : 0;
    const osmType = `${place.osmKey || ''}:${place.osmValue || ''}`;
    const tourist = !isTouristPlace(place)
      ? 0
      : osmType === 'tourism:artwork'
        ? 100
        : osmType === 'leisure:park'
          ? 400
          : 700;
    const rating = place.rating ? place.rating * 20 : 0;
    const reviewPopularity = place.userRatingCount ? Math.log10(place.userRatingCount + 1) * 45 : 0;
    return exact + startsWith + contains + tourist + rating + reviewPopularity;
  };
  return [...places].sort((left, right) => score(right) - score(left));
}

export function isTouristPlace(place: Pick<PlaceSearchResult, 'types' | 'osmKey' | 'osmValue'>): boolean {
  if (place.osmKey && place.osmValue) return TOURIST_OSM_TYPES.has(`${place.osmKey}:${place.osmValue}`);
  return (place.types || []).some((type) => GOOGLE_TOURISM_TYPES.has(type));
}

export function isTouristAutocompleteResult(place: PlaceAutocompleteResult): boolean {
  return (place.types || []).some((type) => GOOGLE_TOURISM_TYPES.has(type));
}

export interface PlaceDetails extends PlaceSearchResult {
  description?: string;
  photos: string[];
  websiteUri?: string;
  googleMapsUri?: string;
}

export interface PlaceAutocompleteResult {
  placeId: string;
  name: string;
  address: string;
  types?: string[];
  latitude?: number;
  longitude?: number;
  rating?: number;
  userRatingCount?: number;
}

export function getCategoryOsmTag(category: string): string | undefined {
  const normalized = category.trim();
  const exact = CATEGORY_OSM_TAGS[normalized];
  if (exact) return exact;
  const prefix = Object.keys(CATEGORY_OSM_TAGS)
    .filter((label) => label.length > 1 && normalized.startsWith(label))
    .sort((left, right) => right.length - left.length)[0];
  return prefix ? CATEGORY_OSM_TAGS[prefix] : undefined;
}

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

const CACHE_DURATION_MS = 10 * 60 * 1000;
const cache = new Map<string, CacheEntry<unknown>>();
const photonCache = new Map<string, CacheEntry<PlaceSearchResult[]>>();
let lastPhotonRequestAt = 0;
let photonQueue: Promise<void> = Promise.resolve();
const PHOTON_BBOX = '97.3,5.6,105.7,20.5';
const CATEGORY_OSM_TAGS: Record<string, string> = {
  'ทะเล': 'natural:beach',
  'ชายหาด': 'natural:beach',
  'ภูเขา': 'natural:peak',
  'น้ำตก': 'waterway:waterfall',
  'วัด': 'amenity:place_of_worship',
  'อุทยาน': 'boundary:national_park',
  'คาเฟ่': 'amenity:cafe',
  'ตลาด': 'amenity:marketplace',
  'พิพิธภัณฑ์': 'tourism:museum',
  'ที่เที่ยวทั่วไป': 'tourism:attraction',
  'สถานที่ท่องเที่ยว': 'tourism:attraction',
};

class PlacesApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function cached<T>(key: string): T | undefined {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCached<T>(key: string, value: T): T {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_DURATION_MS });
  return value;
}

async function request<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new PlacesApiError(payload?.error || `ค้นหาสถานที่ไม่สำเร็จ (${response.status})`, response.status);
  }
  return response.json() as Promise<T>;
}

function toPhotonResult(feature: {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_id?: number;
    osm_type?: string;
    name?: string;
    countrycode?: string;
    city?: string;
    county?: string;
    district?: string;
    locality?: string;
    state?: string;
    type?: string;
    osm_key?: string;
    osm_value?: string;
  };
}): PlaceSearchResult | null {
  const coordinates = feature.geometry?.coordinates;
  const properties = feature.properties;
  if (!coordinates || !properties?.osm_id || properties.countrycode?.toUpperCase() !== 'TH') return null;
  const [longitude, latitude] = coordinates;
  const name = properties.name?.trim();
  if (!name) return null;
  const address = [properties.city, properties.county, properties.district, properties.locality, properties.state]
    .filter((part, index, all): part is string => Boolean(part) && all.indexOf(part) === index)
    .join(', ') || 'ประเทศไทย';
  return {
    id: `osm:${(properties.osm_type || 'R').toUpperCase()}:${properties.osm_id}`,
    name,
    address,
    latitude,
    longitude,
    types: [properties.osm_value, properties.type].filter((value): value is string => Boolean(value)),
    osmKey: properties.osm_key,
    osmValue: properties.osm_value,
  };
}

async function waitForPhotonSlot(signal?: AbortSignal) {
  const previous = photonQueue;
  let release!: () => void;
  photonQueue = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try {
    if (signal?.aborted) throw signal.reason || new DOMException('คำขอถูกยกเลิก', 'AbortError');
    const delay = Math.max(0, lastPhotonRequestAt + 1000 - Date.now());
    if (delay > 0) {
      await new Promise<void>((resolve, reject) => {
        const finish = () => {
          signal?.removeEventListener('abort', onAbort);
          resolve();
        };
        const onAbort = () => {
          window.clearTimeout(timeoutId);
          signal?.removeEventListener('abort', onAbort);
          reject(signal?.reason || new DOMException('คำขอถูกยกเลิก', 'AbortError'));
        };
        const timeoutId = window.setTimeout(finish, delay);
        signal?.addEventListener('abort', onAbort, { once: true });
      });
    }
    if (signal?.aborted) throw signal.reason || new DOMException('คำขอถูกยกเลิก', 'AbortError');
    lastPhotonRequestAt = Date.now();
  } finally {
    release();
  }
}

async function searchPhoton(
  query: string,
  signal?: AbortSignal,
  osmTag?: string,
): Promise<PlaceSearchResult[]> {
  const searchTerm = query.trim();
  const cacheKey = `${searchTerm.toLocaleLowerCase('th')}|${osmTag || ''}`;
  const cachedResults = photonCache.get(cacheKey);
  if (cachedResults && cachedResults.expiresAt > Date.now()) return cachedResults.value;
  if (cachedResults) photonCache.delete(cacheKey);

  const fetchPhoton = async (candidate: string) => {
    await waitForPhotonSlot(signal);
    const url = new URL('https://photon.komoot.io/api/');
    url.searchParams.set('q', candidate);
    url.searchParams.set('limit', '50');
    url.searchParams.set('lang', 'default');
    url.searchParams.set('bbox', PHOTON_BBOX);
    if (osmTag) url.searchParams.append('osm_tag', osmTag);
    const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`ค้นหาสถานที่ไม่สำเร็จ (${response.status})`);
    return response.json() as Promise<{
    features?: Array<{
      geometry?: { coordinates?: [number, number] };
      properties?: {
        osm_id?: number;
        osm_type?: string;
        name?: string;
        countrycode?: string;
        city?: string;
        county?: string;
        district?: string;
        locality?: string;
        state?: string;
        type?: string;
        osm_key?: string;
        osm_value?: string;
      };
    }>;
    }>;
  };
  const touristResults = (features: NonNullable<Awaited<ReturnType<typeof fetchPhoton>>['features']>) => features
    .map(toPhotonResult)
    .filter((result): result is PlaceSearchResult => Boolean(result));
  const features = (await fetchPhoton(searchTerm)).features || [];
  const results = touristResults(features);
  const uniqueResults = [...new Map(results.map((place) => [place.id, place])).values()];
  const rankedResults = rankPlaceSearchResults(searchTerm, uniqueResults).slice(0, 50);
  photonCache.set(cacheKey, { value: rankedResults, expiresAt: Date.now() + CACHE_DURATION_MS });
  return rankedResults;
}

export function autocompletePlaces(
  input: string,
  signal?: AbortSignal,
): Promise<PlaceAutocompleteResult[]> {
  return searchPhoton(input, signal).then((results) => results.map((place) => ({
    placeId: place.id,
    name: place.name,
    address: place.address,
    types: place.types,
    latitude: place.latitude,
    longitude: place.longitude,
    rating: place.rating,
    userRatingCount: place.userRatingCount,
  })));
}

export function searchPlaces(
  query: string,
  signal?: AbortSignal,
  options: { osmTag?: string } = {},
): Promise<PlaceSearchResult[]> {
  return searchPhoton(query, signal, options.osmTag);
}

export async function getPlaceDetails(
  placeId: string,
  sessionToken?: string,
  signal?: AbortSignal,
): Promise<PlaceDetails> {
  const osmId = placeId.match(/^osm:([NRW]):(\d+)$/);
  if (osmId) {
    const response = await fetch(`/api/places/osm-details?id=${encodeURIComponent(placeId)}`, { signal });
    if (!response.ok) throw new Error(`โหลดรายละเอียดสถานที่ไม่สำเร็จ (${response.status})`);
    return response.json() as Promise<PlaceDetails>;
  }
  return request<PlaceDetails>('/api/places/details', { placeId, sessionToken }, signal);
}

export function getPlacePhotoUrl(photoName?: string): string | undefined {
  if (!photoName) return undefined;
  return `/api/places/photo?name=${encodeURIComponent(photoName)}`;
}
