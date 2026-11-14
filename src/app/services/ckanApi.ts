import { normalizePlaceHighlights } from '../utils/placeHighlights';

export type CkanResourceKind = 'attractions' | 'activities' | 'accommodations' | 'restaurants';

type CkanRawRecord = Record<string, unknown>;

export type CkanPlace = {
  id: string;
  kind: CkanResourceKind;
  name: string;
  description: string;
  category: string;
  images: string[];
  latitude?: number;
  longitude?: number;
  province: string;
  district: string;
  region: string;
  address: string;
  phone: string;
  email: string;
  websites: string[];
  openingHours: string;
  isOpen: boolean | null;
  freeEntry: boolean | null;
  prices: string[];
  createdAt: string;
  updatedAt: string;
  url: string;
  resourceUrl: string;
  highlights: string[];
};

export type CkanPage = {
  records: CkanPlace[];
  total: number;
  available: number;
  reportedTotal: number;
  partial: boolean;
  truncated: boolean;
  returnedCount: number;
  limit: number;
  offset: number;
  sourceUrl: string;
};

type CkanPageResponse = {
  kind: CkanResourceKind;
  results: CkanRawRecord[];
  total: number;
  available: number;
  reportedTotal: number;
  partial: boolean;
  limit: number;
  offset: number;
  sourceUrl: string;
};

type CkanRecordResponse = {
  kind: CkanResourceKind;
  record: CkanRawRecord;
  sourceUrl: string;
};

function firstText(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) {
    return value.find((item): item is string => typeof item === 'string' && Boolean(item.trim()))?.trim() || '';
  }
  return '';
}

function toNumber(value: unknown) {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;
  return null;
}

function getId(kind: CkanResourceKind, record: CkanRawRecord) {
  if (kind === 'attractions') {
    const id = record.ID;
    return typeof id === 'string' || typeof id === 'number' ? String(id) : '';
  }
  const url = firstText(record.URL);
  return url.split('/').filter(Boolean).at(-1) || '';
}

function openingHours(record: CkanRawRecord) {
  if (!Array.isArray(record.openingHoursSpecification)) return '';
  return record.openingHoursSpecification.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const hours = item as Record<string, unknown>;
    const day = firstText(hours.dayOfWeek);
    const opens = firstText(hours.opens);
    const closes = firstText(hours.closes);
    if (!day || !opens || !closes) return [];
    return [`${day}: ${opens.slice(0, 5)}-${closes.slice(0, 5)}`];
  }).join('; ');
}

function getAddress(kind: CkanResourceKind, record: CkanRawRecord, province: string, district: string) {
  if (kind !== 'attractions') {
    return [firstText(record.District) && `อำเภอ${firstText(record.District)}`, province && `จังหวัด${province}`]
      .filter(Boolean)
      .join(' ');
  }
  const address = record.address && typeof record.address === 'object'
    ? record.address as Record<string, unknown>
    : {};
  const streetAddress = firstText(address.streetAddress);
  const placeNames = [streetAddress, district && `อำเภอ${district}`, province && `จังหวัด${province}`].filter(Boolean);
  return [...new Set(placeNames)].join(' ');
}

function getHighlights(record: CkanRawRecord) {
  const result: string[] = [];
  const directHighlights = record.highlights || record.highlight || record.mainFeatures || record.main_features;
  if (Array.isArray(directHighlights)) {
    result.push(...directHighlights.map(firstText).filter(Boolean));
  } else if (typeof directHighlights === 'string') {
    result.push(...directHighlights.split(/[\n;|]+/).map((item) => item.trim()).filter(Boolean));
  }
  if (Array.isArray(record.specialAnnouncement)) {
    result.push(...record.specialAnnouncement.map(firstText).filter(Boolean));
  }
  if (Array.isArray(record.additionalProperty)) {
    result.push(...record.additionalProperty.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const property = item as Record<string, unknown>;
      const name = firstText(property.name);
      const value = firstText(property.value);
      if (!/จุดเด่น|ไฮไลต์|ลักษณะเด่น|ความน่าสนใจ|สิ่งที่น่าสนใจ|highlight|feature|attraction/i.test(name)) return [];
      return [value || name].filter(Boolean);
    }));
  }
  return normalizePlaceHighlights(result);
}

export function normalizeCkanRecord(kind: CkanResourceKind, record: CkanRawRecord): CkanPlace {
  const isAttraction = kind === 'attractions';
  const address = isAttraction && record.address && typeof record.address === 'object'
    ? record.address as Record<string, unknown>
    : {};
  const provinceCode = firstText(address.countrySubDivision);
  const province = isAttraction
    ? provinceCode === 'TH-57' ? 'เชียงราย' : ''
    : firstText(record.Province);
  const districtCode = firstText(address.city);
  const districtNames: Record<string, string> = {
    '5701': 'เมืองเชียงราย',
    '5705': 'พาน',
    '5706': 'ป่าแดด',
    '5709': 'แม่สาย',
    '5711': 'เวียงป่าเป้า',
    '5716': 'แม่ลาว',
  };
  const street = firstText(address.streetAddress);
  const districtFromAddress = street.match(/(?:อำเภอ|เขต)\s*([^\s,]+)/)?.[1] || '';
  const district = isAttraction
    ? districtNames[districtCode] || districtFromAddress
    : firstText(record.District);
  const photos = isAttraction ? record.photo : record.IntroImage;
  const imageValues = Array.isArray(photos) ? photos : [photos];
  const websiteValues = isAttraction ? record.url : [];
  const websites = (Array.isArray(websiteValues) ? websiteValues : [websiteValues])
    .filter((value): value is string => typeof value === 'string' && /^https?:\/\//i.test(value));
  const prices = Array.isArray(record.priceSpecification)
    ? record.priceSpecification.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const price = item as Record<string, unknown>;
      const amount = firstText(price.price);
      const currency = firstText(price.priceCurrency);
      return amount ? [`${amount}${currency ? ` ${currency}` : ''}`] : [];
    })
    : [];
  const name = firstText(isAttraction ? record.name : record.Name);
  const description = firstText(isAttraction ? record.description : record.Detail);
  const id = getId(kind, record);
  const entityUrl = firstText(record.URL);

  return {
    id,
    kind,
    name,
    description,
    category: firstText(isAttraction ? record.type : record.Type),
    images: [...new Set(imageValues.filter((value): value is string => typeof value === 'string' && /^https?:\/\//i.test(value)))].slice(0, 3),
    latitude: toNumber(isAttraction ? record.latitude : record.Latitude),
    longitude: toNumber(isAttraction ? record.longitude : record.Longitude),
    province,
    district,
    region: isAttraction ? '' : firstText(record.Region),
    address: getAddress(kind, record, province, district),
    phone: isAttraction ? firstText(record.telephone) : '',
    email: isAttraction ? firstText(record.email) : '',
    websites,
    openingHours: openingHours(record),
    isOpen: toBoolean(isAttraction ? null : record.IsOpen),
    freeEntry: toBoolean(record.isAccessibleForFree),
    prices,
    createdAt: isAttraction ? firstText(record.dateCreated) : '',
    updatedAt: isAttraction ? firstText(record.dateModified) : '',
    url: /^https?:\/\//i.test(entityUrl) ? entityUrl : '',
    resourceUrl: '',
    highlights: getHighlights(record),
  };
}

async function requestJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  const payload = await response.json().catch(() => null) as ({ error?: string } & object) | null;
  if (!response.ok) {
    throw new Error(payload && 'error' in payload && typeof payload.error === 'string'
      ? payload.error
      : `CKAN API request failed: ${response.status}`);
  }
  if (!payload) throw new Error('CKAN API returned invalid JSON');
  return payload as T;
}

export async function fetchCkanPage(
  kind: CkanResourceKind,
  options: { limit?: number; offset?: number; query?: string; province?: string; signal?: AbortSignal } = {},
): Promise<CkanPage> {
  const params = new URLSearchParams({
    limit: String(options.limit ?? 50),
    offset: String(options.offset ?? 0),
  });
  if (options.query) params.set('q', options.query);
  if (options.province) params.set('province', options.province);
  const response = await requestJson<CkanPageResponse>(`/api/ckan/${kind}?${params.toString()}`, options.signal);
  return {
    records: response.results
      .map((record) => ({ ...normalizeCkanRecord(kind, record), resourceUrl: response.sourceUrl }))
      .filter((record) => record.id && record.name),
    total: response.total,
    available: response.available,
    reportedTotal: response.reportedTotal,
    partial: response.partial,
    truncated: response.total > response.offset + response.results.length,
    returnedCount: response.results.length,
    limit: response.limit,
    offset: response.offset,
    sourceUrl: response.sourceUrl,
  };
}

export async function fetchCkanRecords(
  kind: CkanResourceKind,
  options: { query?: string; province?: string; signal?: AbortSignal } = {},
): Promise<CkanPage> {
  const limit = 100;
  const maxOffset = 10_000;
  const records: CkanPlace[] = [];
  let firstPage: CkanPage | undefined;
  let offset = 0;
  let consumed = 0;

  while (offset <= maxOffset) {
    const page = await fetchCkanPage(kind, { ...options, limit, offset });
    firstPage ||= page;
    records.push(...page.records);
    consumed += page.returnedCount;
    if (offset + page.returnedCount >= page.total || page.returnedCount === 0) break;
    offset += page.limit;
  }

  if (!firstPage) throw new Error('ไม่สามารถโหลดข้อมูล CKAN ได้');
  return {
    ...firstPage,
    records,
    truncated: consumed < firstPage.total,
    returnedCount: consumed,
  };
}

export async function fetchCkanRecord(kind: CkanResourceKind, id: string, signal?: AbortSignal) {
  const response = await requestJson<CkanRecordResponse>(
    `/api/ckan/${kind}/${encodeURIComponent(id)}`,
    signal,
  );
  return { ...normalizeCkanRecord(kind, response.record), resourceUrl: response.sourceUrl };
}
