const GOOGLE_PLACES_BASE = 'https://places.googleapis.com/v1';
const REVIEW_CACHE_DURATION_MS = 24 * 60 * 60 * 1000;
const reviewCache = new Map();
const reviewRequests = new Map();

function sendJson(response, statusCode, value) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(value));
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 16_384) {
      const error = new Error('คำขอมีขนาดใหญ่เกินไป');
      error.statusCode = 413;
      throw error;
    }
  }
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    const error = new Error('รูปแบบ JSON ไม่ถูกต้อง');
    error.statusCode = 400;
    throw error;
  }
}

async function googleRequest(url, apiKey, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'X-Goog-Api-Key': apiKey,
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message || `Google Places API ตอบกลับ ${response.status}`;
    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }
  return payload;
}

function mapPlace(place) {
  return {
    id: place.id,
    name: place.displayName?.text || 'สถานที่ไม่ระบุชื่อ',
    address: place.formattedAddress || '',
    latitude: place.location?.latitude,
    longitude: place.location?.longitude,
    rating: place.rating,
    userRatingCount: place.userRatingCount,
    photoName: place.photos?.[0]?.name,
    types: place.types || [],
  };
}

function normalizePlaceName(value) {
  return value.toLocaleLowerCase('th').normalize('NFC').replace(/[\s\p{P}\p{S}]+/gu, '');
}

async function findGooglePlaceReview(name, province, apiKey) {
  const searchData = await googleRequest(`${GOOGLE_PLACES_BASE}/places:searchText`, apiKey, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-FieldMask': 'places.id',
    },
    body: JSON.stringify({
      textQuery: `${name}, ${province}, Thailand`,
      languageCode: 'th',
      regionCode: 'TH',
      maxResultCount: 5,
    }),
  });
  const match = searchData.places?.[0];
  if (!match?.id) return null;

  const detailsUrl = new URL(`${GOOGLE_PLACES_BASE}/places/${encodeURIComponent(match.id)}`);
  const details = await googleRequest(detailsUrl, apiKey, {
    headers: { 'X-Goog-FieldMask': 'rating,userRatingCount' },
  });
  if (typeof details.rating !== 'number' || typeof details.userRatingCount !== 'number') return null;
  return { rating: details.rating, reviewCount: details.userRatingCount };
}

export async function handlePlacesApi(request, response, apiKey) {
  const requestUrl = new URL(request.url, 'http://localhost');
  if (!requestUrl.pathname.startsWith('/api/places/')) return false;
  if (requestUrl.pathname === '/api/places/reviews' && request.method === 'GET') {
    const name = requestUrl.searchParams.get('name')?.trim() || '';
    const province = requestUrl.searchParams.get('province')?.trim() || '';
    if (!name || !province || name.length > 200 || province.length > 100) {
      sendJson(response, 400, { error: 'ต้องระบุชื่อสถานที่และจังหวัดให้ถูกต้อง' });
      return true;
    }
    if (!apiKey) {
      sendJson(response, 503, { error: 'ยังไม่ได้กำหนด GOOGLE_PLACES_API_KEY บนเซิร์ฟเวอร์' });
      return true;
    }
    const cacheKey = `${normalizePlaceName(name)}:${normalizePlaceName(province)}`;
    const cachedReview = reviewCache.get(cacheKey);
    if (cachedReview && cachedReview.expiresAt > Date.now()) {
      sendJson(response, 200, { review: cachedReview.value });
      return true;
    }
    if (cachedReview) reviewCache.delete(cacheKey);
    try {
      let reviewRequest = reviewRequests.get(cacheKey);
      if (!reviewRequest) {
        reviewRequest = findGooglePlaceReview(name, province, apiKey)
          .then((value) => {
            reviewCache.set(cacheKey, { value, expiresAt: Date.now() + REVIEW_CACHE_DURATION_MS });
            return value;
          })
          .finally(() => reviewRequests.delete(cacheKey));
        reviewRequests.set(cacheKey, reviewRequest);
      }
      sendJson(response, 200, { review: await reviewRequest });
      return true;
    } catch (error) {
      sendJson(response, Number.isInteger(error?.statusCode) ? error.statusCode : 502, {
        error: error instanceof Error ? error.message : 'ไม่สามารถโหลดรีวิวสถานที่ได้',
      });
      return true;
    }
  }
  if (requestUrl.pathname === '/api/places/osm-details' && request.method === 'GET') {
    const osmId = requestUrl.searchParams.get('id')?.match(/^osm:([NRW]):(\d+)$/);
    if (!osmId) {
      sendJson(response, 400, { error: 'รหัสสถานที่ OpenStreetMap ไม่ถูกต้อง' });
      return true;
    }
    try {
      const lookupUrl = new URL('https://nominatim.openstreetmap.org/lookup');
      lookupUrl.searchParams.set('format', 'jsonv2');
      lookupUrl.searchParams.set('addressdetails', '1');
      lookupUrl.searchParams.set('extratags', '1');
      lookupUrl.searchParams.set('osm_ids', `${osmId[1]}${osmId[2]}`);
      const lookup = await fetch(lookupUrl, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'MobileTourismApp/1.0 (place detail lookup)',
        },
      });
      if (!lookup.ok) {
        sendJson(response, lookup.status, { error: `โหลดรายละเอียดสถานที่ไม่สำเร็จ (${lookup.status})` });
        return true;
      }
      const [place] = await lookup.json();
      if (!place) {
        sendJson(response, 404, { error: 'ไม่พบรายละเอียดสถานที่' });
        return true;
      }
      const latitude = Number(place.lat);
      const longitude = Number(place.lon);
      sendJson(response, 200, {
        id: requestUrl.searchParams.get('id'),
        name: place.name || place.display_name?.split(',')[0]?.trim() || 'สถานที่ไม่ระบุชื่อ',
        address: place.display_name || '',
        latitude: Number.isFinite(latitude) ? latitude : undefined,
        longitude: Number.isFinite(longitude) ? longitude : undefined,
        types: [place.class, place.type].filter(Boolean),
        photos: [],
      });
      return true;
    } catch (error) {
      sendJson(response, 502, {
        error: error instanceof Error ? error.message : 'ไม่สามารถโหลดรายละเอียด OpenStreetMap ได้',
      });
      return true;
    }
  }
  if (!apiKey) {
    sendJson(response, 503, { error: 'ยังไม่ได้กำหนด GOOGLE_PLACES_API_KEY บนเซิร์ฟเวอร์' });
    return true;
  }

  try {
    if (requestUrl.pathname === '/api/places/photo' && request.method === 'GET') {
      const photoName = requestUrl.searchParams.get('name') || '';
      if (!/^places\/[^/]+\/photos\/[^/?]+$/.test(photoName)) {
        sendJson(response, 400, { error: 'ชื่อรูปภาพไม่ถูกต้อง' });
        return true;
      }
      const photoUrl = new URL(`${GOOGLE_PLACES_BASE}/${photoName}/media`);
      photoUrl.searchParams.set('maxWidthPx', '1200');
      const photoResponse = await fetch(photoUrl, {
        headers: { 'X-Goog-Api-Key': apiKey },
        redirect: 'follow',
      });
      if (!photoResponse.ok) {
        sendJson(response, photoResponse.status, { error: 'ไม่สามารถโหลดรูปสถานที่ได้' });
        return true;
      }
      response.statusCode = 200;
      response.setHeader('Content-Type', photoResponse.headers.get('content-type') || 'image/jpeg');
      response.setHeader('Cache-Control', 'public, max-age=600');
      response.end(Buffer.from(await photoResponse.arrayBuffer()));
      return true;
    }

    if (request.method !== 'POST') {
      sendJson(response, 405, { error: 'รองรับเฉพาะคำขอ POST' });
      return true;
    }
    const body = await readJson(request);

    if (requestUrl.pathname === '/api/places/autocomplete') {
      const input = typeof body.input === 'string' ? body.input.trim() : '';
      const sessionToken = typeof body.sessionToken === 'string' ? body.sessionToken.trim() : '';
      if (input.length < 2) {
        sendJson(response, 200, { results: [] });
        return true;
      }
      if (input.length > 200) {
        sendJson(response, 400, { error: 'คำค้นหายาวเกินไป' });
        return true;
      }
      const data = await googleRequest(`${GOOGLE_PLACES_BASE}/places:autocomplete`, apiKey, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-FieldMask': [
            'suggestions.placePrediction.placeId',
            'suggestions.placePrediction.text.text',
            'suggestions.placePrediction.structuredFormat.mainText.text',
            'suggestions.placePrediction.structuredFormat.secondaryText.text',
            'suggestions.placePrediction.types',
          ].join(','),
        },
        body: JSON.stringify({
          input,
          includedRegionCodes: ['th'],
          languageCode: 'th',
          ...(sessionToken ? { sessionToken } : {}),
        }),
      });
      const results = (data.suggestions || [])
        .map((item) => item.placePrediction)
        .filter((place) => place?.placeId)
        .map((place) => ({
          placeId: place.placeId,
          name: place.structuredFormat?.mainText?.text || place.text?.text || '',
          address: place.structuredFormat?.secondaryText?.text || '',
          types: place.types || [],
        }));
      sendJson(response, 200, { results });
      return true;
    }

    if (requestUrl.pathname === '/api/places/search') {
      const query = typeof body.query === 'string' ? body.query.trim() : '';
      if (!query) {
        sendJson(response, 200, { results: [] });
        return true;
      }
      const results = [];
      let pageToken;
      for (let page = 0; page < 5; page += 1) {
        const data = await googleRequest(`${GOOGLE_PLACES_BASE}/places:searchText`, apiKey, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-FieldMask': [
              'places.id', 'places.displayName', 'places.formattedAddress', 'places.location',
              'places.rating', 'places.userRatingCount', 'places.photos', 'places.types', 'nextPageToken',
            ].join(','),
          },
          body: JSON.stringify({
            textQuery: query,
            languageCode: 'th',
            regionCode: 'TH',
            maxResultCount: 20,
            includedType: 'tourist_attraction',
            strictTypeFiltering: true,
            ...(pageToken ? { pageToken } : {}),
          }),
        });
        results.push(...(data.places || []).map(mapPlace));
        pageToken = data.nextPageToken;
        if (!pageToken) break;
      }
      const uniqueResults = [...new Map(results.map((place) => [place.id, place])).values()];
      const sortedResults = uniqueResults
        .sort((left, right) => (right.rating || 0) - (left.rating || 0)
          || (right.userRatingCount || 0) - (left.userRatingCount || 0));
      sendJson(response, 200, { results: sortedResults });
      return true;
    }

    if (requestUrl.pathname === '/api/places/details') {
      const placeId = typeof body.placeId === 'string' ? body.placeId.trim() : '';
      if (!placeId || placeId.length > 256) {
        sendJson(response, 400, { error: 'รหัสสถานที่ไม่ถูกต้อง' });
        return true;
      }
      const detailsUrl = new URL(`${GOOGLE_PLACES_BASE}/places/${encodeURIComponent(placeId)}`);
      if (typeof body.sessionToken === 'string') {
        detailsUrl.searchParams.set('sessionToken', body.sessionToken);
      }
      const data = await googleRequest(detailsUrl, apiKey, {
        headers: {
          'X-Goog-FieldMask': [
            'id', 'displayName', 'formattedAddress', 'location', 'rating', 'userRatingCount',
            'photos', 'types', 'websiteUri', 'googleMapsUri', 'editorialSummary',
          ].join(','),
        },
      });
      const place = mapPlace(data);
      sendJson(response, 200, {
        ...place,
        description: data.editorialSummary?.text,
        photos: (data.photos || []).map((photo) => photo.name).filter(Boolean),
        websiteUri: data.websiteUri,
        googleMapsUri: data.googleMapsUri,
      });
      return true;
    }

    sendJson(response, 404, { error: 'ไม่พบ API ที่ร้องขอ' });
    return true;
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    sendJson(response, statusCode, {
      error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการเรียก Google Places API',
    });
    return true;
  }
}
