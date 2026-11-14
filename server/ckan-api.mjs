const CACHE_DURATION_MS = 15 * 60 * 1000;
const MAX_LIMIT = 100;
const MAX_OFFSET = 10_000;
const REQUEST_TIMEOUT_MS = 15_000;
const RESOURCE_URLS = {
  attractions: 'https://ckan.mots.go.th/dataset/b3ff2346-ee8e-4b38-8b4d-7c771a89b3ff/resource/0632ec7b-61d4-4d91-a3c1-0651b902a767/download/attraction_57.json',
  activities: 'https://ckan.mots.go.th/dataset/9c5de319-2d18-4e43-b809-345ce247fa8a/resource/04ef0f53-e3cb-4e5c-8c80-4927ffc46533/download/activities.json',
  accommodations: 'https://ckan.mots.go.th/dataset/13a25723-b8ca-4cf7-a83e-cb762721ec8d/resource/f31f82eb-e979-4944-97c7-5c05b1216f4a/download/accommodations.json',
  restaurants: 'https://ckan.mots.go.th/dataset/0f9f15a7-a6e9-4ce1-afd5-e7419dfa551e/resource/ffff24c5-3fc7-4324-ae58-026fa6a8e39d/download/restaurant.json',
};
const cache = new Map();
const pendingRequests = new Map();

function sendJson(response, statusCode, value) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(value));
}

function getResourceUrl(kind, env) {
  const variable = `CKAN_${kind.toUpperCase()}_RESOURCE_URL`;
  return env[variable] || RESOURCE_URLS[kind];
}

async function loadResource(kind, env) {
  const now = Date.now();
  const cached = cache.get(kind);
  if (cached && cached.expiresAt > now) return cached.value;

  const pending = pendingRequests.get(kind);
  if (pending) return pending;

  const request = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(getResourceUrl(kind, env), {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`CKAN Resource request failed: ${response.status}`);
      const payload = await response.json();
      if (!payload || !Array.isArray(payload.results) || typeof payload.count !== 'number') {
        throw new Error('CKAN Resource returned an unexpected JSON schema');
      }
      const value = {
        results: payload.results,
        reportedTotal: payload.count,
        fetchedAt: new Date().toISOString(),
      };
      cache.set(kind, { value, expiresAt: Date.now() + CACHE_DURATION_MS });
      return value;
    } finally {
      clearTimeout(timeout);
      pendingRequests.delete(kind);
    }
  })();
  pendingRequests.set(kind, request);
  return request;
}

function recordId(kind, record) {
  if (kind === 'attractions') return String(record.ID ?? '');
  const url = record.URL;
  return typeof url === 'string' ? url.split('/').filter(Boolean).at(-1) || '' : '';
}

function recordSearchText(kind, record) {
  const values = kind === 'attractions'
    ? [record.name, record.description, record.type, record.address?.streetAddress, record.address?.countrySubDivision]
    : [record.Name, record.Detail, record.Type, record.Province, record.District, record.Region];
  return values.flatMap((value) => Array.isArray(value) ? value : [value])
    .filter((value) => typeof value === 'string')
    .join(' ')
    .toLocaleLowerCase('th');
}

function recordProvince(kind, record) {
  if (kind === 'attractions') {
    const provinceCode = record.address?.countrySubDivision;
    return provinceCode === 'TH-57' ? 'เชียงราย' : '';
  }
  return typeof record.Province === 'string' ? record.Province.trim() : '';
}

function getRequestOptions(url) {
  const limitValue = Number(url.searchParams.get('limit') || 50);
  const offsetValue = Number(url.searchParams.get('offset') || 0);
  if (!Number.isInteger(limitValue) || limitValue < 1 || limitValue > MAX_LIMIT
    || !Number.isInteger(offsetValue) || offsetValue < 0 || offsetValue > MAX_OFFSET) {
    throw new Error(`limit ต้องอยู่ระหว่าง 1-${MAX_LIMIT} และ offset ต้องอยู่ระหว่าง 0-${MAX_OFFSET}`);
  }
  return {
    limit: limitValue,
    offset: offsetValue,
    query: (url.searchParams.get('q') || '').trim().toLocaleLowerCase('th'),
    province: (url.searchParams.get('province') || '').trim().replace(/^จังหวัด/, '').toLocaleLowerCase('th'),
  };
}

export async function handleCkanApi(request, response, env = process.env) {
  if (request.method !== 'GET') {
    sendJson(response, 405, { error: 'รองรับเฉพาะ GET request' });
    return;
  }

  let url;
  try {
    url = new URL(request.url || '/', 'http://localhost');
  } catch {
    sendJson(response, 400, { error: 'รูปแบบ URL ไม่ถูกต้อง' });
    return;
  }

  const route = url.pathname.slice('/api/ckan/'.length).split('/');
  const kind = route[0];
  if (!Object.hasOwn(RESOURCE_URLS, kind) || route.length > 2 || (route[1] && !/^[A-Za-z0-9_-]+$/.test(route[1]))) {
    sendJson(response, 404, { error: 'ไม่พบประเภทหรือรหัสข้อมูล CKAN ที่ร้องขอ' });
    return;
  }

  let options;
  try {
    options = getRequestOptions(url);
  } catch (error) {
    sendJson(response, 400, { error: error.message });
    return;
  }

  try {
    const resource = await loadResource(kind, env);
    const filtered = resource.results.filter((record) => {
      if (options.query && !recordSearchText(kind, record).includes(options.query)) return false;
      if (options.province && !recordProvince(kind, record).toLocaleLowerCase('th').includes(options.province)) return false;
      return true;
    });

    if (route[1]) {
      const record = filtered.find((item) => recordId(kind, item) === route[1]);
      if (!record) {
        sendJson(response, 404, { error: 'ไม่พบข้อมูลในระเบียน JSON ที่เผยแพร่' });
        return;
      }
      sendJson(response, 200, {
        kind,
        record,
        fetchedAt: resource.fetchedAt,
        sourceUrl: getResourceUrl(kind, env),
      });
      return;
    }

    const results = filtered.slice(options.offset, options.offset + options.limit);
    sendJson(response, 200, {
      kind,
      results,
      total: filtered.length,
      available: resource.results.length,
      reportedTotal: resource.reportedTotal,
      partial: resource.results.length < resource.reportedTotal,
      limit: options.limit,
      offset: options.offset,
      fetchedAt: resource.fetchedAt,
      sourceUrl: getResourceUrl(kind, env),
    });
  } catch (error) {
    const message = error.name === 'AbortError'
      ? 'CKAN Resource request timed out'
      : error instanceof Error ? error.message : 'Unable to load CKAN Resource';
    console.error(`Unable to load CKAN ${kind} resource:`, error);
    sendJson(response, 502, { error: message });
  }
}
