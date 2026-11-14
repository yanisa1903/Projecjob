const NON_HIGHLIGHT_PREFIX = /^(?:ที่อยู่|ที่ตั้ง|ที่ตั้งอยู่|อำเภอ|ตำบล|แขวง|เขต|จังหวัด|ภูมิภาค|รหัสไปรษณีย์|เบอร์(?:โทร)?|โทรศัพท์|ติดต่อ|อีเมล|เว็บไซต์|เวลาเปิด|เวลาให้บริการ|พิกัด|latitude|longitude|phone|address|district|province|region|opening hours|contact|website|email|coordinates|รหัสข้อมูล|รหัสสถานที่)\s*[:：-]?/i;
const ADDRESS_TERMS = /(?:อำเภอ|ตำบล|แขวง|เขต|จังหวัด|รหัสไปรษณีย์)/g;
const OPERATIONAL_NOISE = /ประกาศ|แจ้งปิด|ปิดบริการ|เปิดบริการ|โปรดติดต่อ|รายละเอียดข้อมูล|ข้อมูลเพิ่มเติม|information only/i;

export function normalizePlaceHighlights(values: string[], limit = 4) {
  const highlights: string[] = [];
  const seen = new Set<string>();

  values.forEach((value) => {
    const text = value
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/^(?:จุดเด่น|ไฮไลต์|highlight|highlights)\s*[:：-]\s*/i, '')
      .trim();
    if (text.length < 8
      || NON_HIGHLIGHT_PREFIX.test(text)
      || OPERATIONAL_NOISE.test(text)
      || /\b\d{5}\b/.test(text)
      || (text.match(ADDRESS_TERMS) || []).length > 1) return;

    const normalized = text.toLocaleLowerCase('th').replace(/[\s\p{P}\p{S}]+/gu, '');
    if (seen.has(normalized)) return;
    seen.add(normalized);

    if (text.length <= 180) {
      highlights.push(text);
    } else {
      const excerpt = text.slice(0, 180);
      const lastSpace = excerpt.lastIndexOf(' ');
      highlights.push(`${(lastSpace > 120 ? excerpt.slice(0, lastSpace) : excerpt).trimEnd()}…`);
    }
  });

  return highlights.slice(0, limit);
}
