const TAT_API_BASE = 'https://tatapi.tourismthailand.org/tatapi/v2/attraction';

function sendJson(response, statusCode, value) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(value));
}

export async function handleTatApi(request, response, apiKey) {
  if (request.method !== 'GET') {
    sendJson(response, 405, { error: 'รองรับเฉพาะ GET request' });
    return;
  }
  if (!apiKey) {
    sendJson(response, 503, { error: 'ยังไม่ได้ตั้งค่า TAT_API_KEY ในไฟล์ .env หรือ environment ของเซิร์ฟเวอร์' });
    return;
  }

  let url;
  try {
    url = new URL(request.url || '/', 'http://localhost');
  } catch {
    sendJson(response, 400, { error: 'รูปแบบ URL ไม่ถูกต้อง' });
    return;
  }

  const path = url.pathname.slice('/api/tat/attraction'.length);
  if (path && !/^\/[A-Za-z0-9_-]+$/.test(path)) {
    sendJson(response, 400, { error: 'รหัสสถานที่ไม่ถูกต้อง' });
    return;
  }

  const upstreamUrl = new URL(`${TAT_API_BASE}${path}`);
  if (!path) {
    const number = Number(url.searchParams.get('number') || 50);
    const offset = Number(url.searchParams.get('offset') || 0);
    if (!Number.isInteger(number) || number < 1 || number > 100
      || !Number.isInteger(offset) || offset < 0) {
      sendJson(response, 400, { error: 'number ต้องอยู่ระหว่าง 1 ถึง 100 และ offset ต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป' });
      return;
    }
    upstreamUrl.searchParams.set('number', String(number));
    upstreamUrl.searchParams.set('offset', String(offset));
  }

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'th',
        'x-api-key': apiKey,
      },
    });
    const body = await upstreamResponse.text();
    response.statusCode = upstreamResponse.status;
    response.setHeader('Content-Type', upstreamResponse.headers.get('content-type') || 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.end(body);
  } catch (error) {
    console.error('Unable to request TAT API:', error);
    sendJson(response, 502, { error: 'เชื่อมต่อ TAT API ไม่สำเร็จ กรุณาลองใหม่ภายหลัง' });
  }
}
