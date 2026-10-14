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
  province?: string;
  osmKey?: string;
  osmValue?: string;
}

const TOURIST_OSM_TYPES = new Set([
  'tourism:attraction', 'tourism:artwork', 'tourism:museum', 'tourism:theme_park',
  'tourism:viewpoint', 'tourism:zoo', 'tourism:aquarium', 'tourism:gallery',
  'historic:archaeological_site', 'historic:castle', 'historic:fort', 'historic:memorial',
  'historic:monument', 'historic:ruins', 'historic:city_gate', 'natural:beach',
  'natural:cave_entrance', 'natural:peak', 'natural:hot_spring', 'natural:waterfall',
  'natural:bay', 'natural:cliff', 'natural:mountain_range', 'natural:water', 'natural:volcano',
  'place:island', 'waterway:waterfall', 'building:temple', 'boundary:national_park', 'boundary:protected_area',
  'leisure:nature_reserve', 'leisure:park',   'amenity:place_of_worship', 'building:temple', 'amenity:cafe',
]);
const GOOGLE_TOURISM_TYPES = new Set([
  'tourist_attraction', 'national_park', 'park', 'museum', 'art_gallery', 'zoo',
  'aquarium', 'hindu_temple', 'buddhist_temple', 'church', 'mosque',
]);

function normalizeSearchText(value: string) {
  return value.toLocaleLowerCase('th').normalize('NFC').replace(/\s+/g, ' ').trim();
}

function matchesSearchAlias(query: string, alias: string) {
  if (!/^[\x00-\x7F]+$/.test(alias)) return query.includes(alias);
  const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z])${escapedAlias}(?=$|[^a-z])`, 'i').test(query);
}

export function rankPlaceSearchResults(query: string, places: PlaceSearchResult[]): PlaceSearchResult[] {
  const term = normalizeSearchText(query)
    .replace(/^สถานที่ท่องเที่ยว\s*/i, '')
    .replace(/\s*ในประเทศไทย\s*$/i, '')
    .trim();
  const search = getPhotonSearch(query);
  const searchTerm = normalizeSearchText(search.query);
  const score = (place: PlaceSearchResult) => {
    const name = normalizeSearchText(place.name);
    const exact = name === term ? 800 : 0;
    const startsWith = name.startsWith(term) ? 450 : 0;
    const contains = name.includes(term) ? 220 : 0;
    const searchNameMatch = searchTerm !== term
      ? name === searchTerm ? 700 : name.startsWith(searchTerm) ? 400 : name.includes(searchTerm) ? 180 : 0
      : 0;
    const osmType = `${place.osmKey || ''}:${place.osmValue || ''}`;
    const categoryMatch = search.osmTags.includes(osmType) ? 1000 : 0;
    const tourist = isTouristPlace(place) ? 1500 : 0;
    const rating = place.rating ? place.rating * 20 : 0;
    const reviewPopularity = place.userRatingCount ? Math.log10(place.userRatingCount + 1) * 45 : 0;
    return exact + startsWith + contains + searchNameMatch + categoryMatch + tourist + rating + reviewPopularity;
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
  province?: string;
}

export function getCategoryOsmTag(category: string): string | undefined {
  return getCategoryOsmTags(category)[0];
}

export function getCategoryOsmTags(query: string): string[] {
  return getPhotonSearch(query).osmTags;
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
const CATEGORY_SEARCHES: Array<{ aliases: string[]; searchTerm: string; osmTags: string[] }> = [
  { aliases: ['ชายหาด', 'ทะเล', 'beaches', 'beach', 'sea'], searchTerm: 'beach', osmTags: ['natural:beach', 'natural:bay', 'place:island'] },
  { aliases: ['น้ำตก', 'waterfalls', 'waterfall'], searchTerm: 'waterfall', osmTags: ['natural:waterfall', 'waterway:waterfall'] },
  { aliases: ['จุดชมวิว', 'วิว', 'viewpoints', 'viewpoint', 'scenic view'], searchTerm: 'viewpoint', osmTags: ['tourism:viewpoint'] },
  { aliases: ['ภูเขา', 'ภูดอย', 'mountains', 'mountain'], searchTerm: 'mountain', osmTags: ['natural:peak', 'natural:mountain_range'] },
  { aliases: ['เกาะ', 'islands', 'island'], searchTerm: 'island', osmTags: ['place:island'] },
  { aliases: ['วัด', 'temples', 'temple'], searchTerm: 'temple', osmTags: ['amenity:place_of_worship', 'building:temple'] },
  { aliases: ['คาเฟ่', 'ร้านกาแฟ', 'cafes', 'cafe', 'coffee shop'], searchTerm: 'cafe', osmTags: ['amenity:cafe'] },
  { aliases: ['ตลาด', 'markets', 'market'], searchTerm: 'market', osmTags: ['amenity:marketplace'] },
  { aliases: ['อุทยาน', 'national parks', 'national park'], searchTerm: 'national park', osmTags: ['boundary:national_park', 'boundary:protected_area', 'leisure:nature_reserve'] },
  { aliases: ['พิพิธภัณฑ์', 'museums', 'museum'], searchTerm: 'museum', osmTags: ['tourism:museum'] },
  { aliases: ['ที่เที่ยวทั่วไป', 'สถานที่ท่องเที่ยว', 'attractions', 'attraction'], searchTerm: 'tourist attraction', osmTags: ['tourism:attraction'] },
];

function getPhotonSearch(query: string) {
  let searchTerm = normalizeSearchText(query);
  const normalizedQuery = searchTerm;
  const osmTags = CATEGORY_SEARCHES
    .filter(({ aliases }) => aliases.some((alias) => matchesSearchAlias(normalizedQuery, normalizeSearchText(alias))))
    .flatMap(({ osmTags: tags }) => tags);
  for (const category of CATEGORY_SEARCHES) {
    const alias = category.aliases
      .map(normalizeSearchText)
      .sort((left, right) => right.length - left.length)
      .find((candidate) => matchesSearchAlias(searchTerm, candidate));
    if (alias) {
      searchTerm = normalizeSearchText(searchTerm.replace(alias, ` ${category.searchTerm} `));
      break;
    }
  }
  return { query: searchTerm, osmTags: [...new Set(osmTags)] };
}

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
  if (!coordinates || !properties || !Number.isInteger(properties.osm_id) || (properties.osm_id || 0) <= 0
    || !['N', 'W', 'R'].includes((properties.osm_type || '').toUpperCase())
    || properties.countrycode?.toUpperCase() !== 'TH') return null;
  const [longitude, latitude] = coordinates;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
    || latitude < 5.6 || latitude > 20.5 || longitude < 97.3 || longitude > 105.7) return null;
  const name = properties.name?.trim();
  if (!name) return null;
  const address = [properties.city, properties.county, properties.district, properties.locality, properties.state]
    .filter((part, index, all): part is string => Boolean(part) && all.indexOf(part) === index)
    .join(', ');
  return {
    id: `osm:${(properties.osm_type || 'R').toUpperCase()}:${properties.osm_id}`,
    name,
    address,
    latitude,
    longitude,
    types: [...new Set([
      properties.osm_key && properties.osm_value ? `${properties.osm_key}:${properties.osm_value}` : '',
      properties.type || '',
    ].filter(Boolean))],
    province: properties.state,
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
  osmTags: string[] = [],
): Promise<PlaceSearchResult[]> {
  const search = getPhotonSearch(query);
  const searchTerm = search.query;
  const effectiveOsmTags = [...new Set([...search.osmTags, ...osmTags])];
  const cacheKey = `${searchTerm.toLocaleLowerCase('th')}|${effectiveOsmTags.slice().sort().join(',')}`;
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
    effectiveOsmTags.forEach((osmTag) => url.searchParams.append('osm_tag', osmTag));
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
    province: place.province,
    latitude: place.latitude,
    longitude: place.longitude,
    rating: place.rating,
    userRatingCount: place.userRatingCount,
  })));
}

export function searchPlaces(
  query: string,
  signal?: AbortSignal,
  options: { osmTag?: string; osmTags?: string[] } = {},
): Promise<PlaceSearchResult[]> {
  return searchPhoton(query, signal, [...(options.osmTags || []), ...(options.osmTag ? [options.osmTag] : [])]);
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
