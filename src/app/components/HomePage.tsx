import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import { Search, Menu, User, AlertCircle, AlertTriangle, Wind, Activity, X, Shield, Loader2, RefreshCw, Heart, MapPinned, Star, Clock3, Banknote, LocateFixed, Navigation } from 'lucide-react';
import DatePicker from './DatePicker';
import { fetchTatAttractions, fetchTatPlace, lockTatImages, type TatAttraction } from '../utils/tatApi';
import {
  fetchRegionalAlerts,
  findAlertLocation,
  getProvinceForCoordinates,
  hasHeavyRain,
  hasHighFloodRisk,
  hasHighPm25,
  type AlertCoordinates,
  type AlertLocation,
  type RegionalAlertData,
} from '../utils/regionalAlerts';

const fallbackPopularPlaces = [
  { name: 'เกาะพีพี', province: 'กระบี่', type: 'เกาะ' },
  { name: 'เกาะสมุย', province: 'สุราษฎร์ธานี', type: 'เกาะ' },
  { name: 'เกาะหลีเป๊ะ', province: 'สตูล', type: 'เกาะ' },
  { name: 'วัดพระศรีรัตนศาสดาราม', province: 'กรุงเทพมหานคร', type: 'วัด' },
  { name: 'อุทยานแห่งชาติเขาใหญ่', province: 'นครราชสีมา', type: 'อุทยาน' },
  { name: 'ดอยสุเทพ', province: 'เชียงใหม่', type: 'ภูเขา' },
  { name: 'เซ็นทรัลเวิลด์', province: 'กรุงเทพมหานคร', type: 'ห้างสรรพสินค้า' },
];

const tourismCategories = ['ทั้งหมด', 'อุทยาน', 'ทะเล', 'ภูเขา', 'วัด'] as const;
type TourismCategory = typeof tourismCategories[number];
const thaiProvinces = [
  'กรุงเทพมหานคร', 'กระบี่', 'กาญจนบุรี', 'กาฬสินธุ์', 'กำแพงเพชร', 'ขอนแก่น', 'จันทบุรี', 'ฉะเชิงเทรา', 'ชลบุรี', 'ชัยนาท',
  'ชัยภูมิ', 'ชุมพร', 'เชียงราย', 'เชียงใหม่', 'ตรัง', 'ตราด', 'ตาก', 'นครนายก', 'นครปฐม', 'นครพนม', 'นครราชสีมา', 'นครศรีธรรมราช',
  'นครสวรรค์', 'นนทบุรี', 'นราธิวาส', 'น่าน', 'บึงกาฬ', 'บุรีรัมย์', 'ปทุมธานี', 'ประจวบคีรีขันธ์', 'ปราจีนบุรี', 'ปัตตานี',
  'พระนครศรีอยุธยา', 'พะเยา', 'พังงา', 'พัทลุง', 'พิจิตร', 'พิษณุโลก', 'เพชรบุรี', 'เพชรบูรณ์', 'แพร่', 'ภูเก็ต', 'มหาสารคาม',
  'มุกดาหาร', 'แม่ฮ่องสอน', 'ยโสธร', 'ยะลา', 'ร้อยเอ็ด', 'ระนอง', 'ระยอง', 'ราชบุรี', 'ลพบุรี', 'ลำปาง', 'ลำพูน', 'เลย',
  'ศรีสะเกษ', 'สกลนคร', 'สงขลา', 'สตูล', 'สมุทรปราการ', 'สมุทรสงคราม', 'สมุทรสาคร', 'สระแก้ว', 'สระบุรี', 'สิงห์บุรี',
  'สุโขทัย', 'สุพรรณบุรี', 'สุราษฎร์ธานี', 'สุรินทร์', 'หนองคาย', 'หนองบัวลำภู', 'อ่างทอง', 'อำนาจเจริญ', 'อุดรธานี',
  'อุตรดิตถ์', 'อุทัยธานี', 'อุบลราชธานี',
];
const discoveryCategories = [
  'สถานที่ยอดนิยม', 'คะแนนสูง', 'ใกล้คุณ', 'เหมาะกับสภาพอากาศวันนี้', 'รายการโปรด',
] as const;
type DiscoveryCategory = typeof discoveryCategories[number];

function distanceBetween(latitude: number, longitude: number, origin: AlertCoordinates) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latitudeDelta = radians(latitude - origin.latitude);
  const longitudeDelta = radians(longitude - origin.longitude);
  const arc = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(origin.latitude)) * Math.cos(radians(latitude))
    * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}

function getProvinceName(location: string, apiProvince?: string) {
  const candidate = apiProvince || thaiProvinces.find((province) => location.includes(province));
  return candidate?.replace(/^จังหวัด/, '') || '';
}

function isPlaceOpen(openingHours?: string) {
  if (!openingHours) return null;
  if (/เปิดตลอด\s*24\s*ชั่วโมง|24\/7/i.test(openingHours)) return true;
  const dayCodes = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const today = dayCodes[new Date().getDay()];
  const todayHours = openingHours.split(';').find((segment) => {
    const days = segment.trim().match(/^([A-Za-z]{2})(?:-([A-Za-z]{2}))?\s+/);
    if (!days) return false;
    const dayOrder = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
    const start = dayOrder.indexOf(days[1]);
    const end = days[2] ? dayOrder.indexOf(days[2]) : start;
    const current = dayOrder.indexOf(today);
    return start >= 0 && end >= start && current >= start && current <= end;
  });
  if (!todayHours) return null;
  if (/\boff\b|ปิด/i.test(todayHours)) return false;
  const hours = todayHours.match(/(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/);
  if (!hours) return null;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = Number(hours[1]) * 60 + Number(hours[2]);
  const endMinutes = Number(hours[3]) * 60 + Number(hours[4]);
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}
const fallbackDestinationImages = [
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400',
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400',
  'https://images.unsplash.com/photo-1500534623283-312aade485b7?w=400',
];

const additionalAttractions = [
  { id: 17, title: 'วัดร่องขุ่น', category: 'วัด' as const, latitude: 19.8242, longitude: 99.7636, location: 'อำเภอเมืองเชียงราย จังหวัดเชียงราย', description: 'วัดสีขาวอันโดดเด่นของเชียงราย สร้างสรรค์ด้วยศิลปะร่วมสมัย' },
  { id: 18, title: 'วัดพระธาตุลำปางหลวง', category: 'วัด' as const, latitude: 18.2150, longitude: 99.3925, location: 'อำเภอเกาะคา จังหวัดลำปาง', description: 'วัดสำคัญคู่เมืองลำปาง มีสถาปัตยกรรมล้านนาอันงดงาม' },
  { id: 19, title: 'อุทยานประวัติศาสตร์สุโขทัย', category: 'วัด' as const, latitude: 17.0168, longitude: 99.7036, location: 'อำเภอเมืองสุโขทัย จังหวัดสุโขทัย', description: 'เมืองโบราณและโบราณสถานสำคัญของอาณาจักรสุโขทัย' },
  { id: 20, title: 'วัดไชยวัฒนาราม', category: 'วัด' as const, latitude: 14.3450, longitude: 100.5433, location: 'อำเภอพระนครศรีอยุธยา จังหวัดพระนครศรีอยุธยา', description: 'โบราณสถานริมแม่น้ำเจ้าพระยาในอุทยานประวัติศาสตร์อยุธยา' },
  { id: 21, title: 'วัดเบญจมบพิตร', category: 'วัด' as const, latitude: 13.7669, longitude: 100.5148, location: 'เขตดุสิต กรุงเทพมหานคร', description: 'วัดหินอ่อนชื่อดังที่มีสถาปัตยกรรมไทยอันประณีต' },
  { id: 22, title: 'วัดร่องเสือเต้น', category: 'วัด' as const, latitude: 19.9219, longitude: 99.8406, location: 'อำเภอเมืองเชียงราย จังหวัดเชียงราย', description: 'วัดสีน้ำเงินร่วมสมัยที่มีลวดลายพุทธศิลป์โดดเด่น' },
  { id: 23, title: 'วัดพระธาตุหริภุญชัย', category: 'วัด' as const, latitude: 18.5761, longitude: 99.0088, location: 'อำเภอเมืองลำพูน จังหวัดลำพูน', description: 'วัดพระธาตุสำคัญใจกลางเมืองลำพูนและศูนย์รวมศรัทธาล้านนา' },
  { id: 24, title: 'เกาะช้าง', category: 'ทะเล' as const, latitude: 12.1030, longitude: 102.3510, location: 'อำเภอเกาะช้าง จังหวัดตราด', description: 'เกาะขนาดใหญ่ในอ่าวไทย มีป่าฝน น้ำตก และชายหาดสวยงาม' },
  { id: 25, title: 'เกาะหลีเป๊ะ', category: 'ทะเล' as const, latitude: 6.4880, longitude: 99.3050, location: 'อำเภอละงู จังหวัดสตูล', description: 'เกาะเล็กในทะเลอันดามันที่มีน้ำใสและแนวปะการังสวยงาม' },
  { id: 26, title: 'เกาะลันตา', category: 'ทะเล' as const, latitude: 7.5336, longitude: 99.0880, location: 'อำเภอเกาะลันตา จังหวัดกระบี่', description: 'เกาะพักผ่อนบรรยากาศสงบ มีชายหาดและชุมชนท้องถิ่นน่าสนใจ' },
  { id: 27, title: 'หาดไร่เลย์', category: 'ทะเล' as const, latitude: 8.0114, longitude: 98.8370, location: 'อำเภอเมืองกระบี่ จังหวัดกระบี่', description: 'ชายหาดชื่อดังล้อมด้วยหน้าผาหินปูน เดินทางถึงได้ทางเรือ' },
  { id: 28, title: 'หาดป่าตอง', category: 'ทะเล' as const, latitude: 7.8966, longitude: 98.2965, location: 'อำเภอกะทู้ จังหวัดภูเก็ต', description: 'ชายหาดยอดนิยมของภูเก็ต มีร้านอาหารและกิจกรรมทางน้ำหลากหลาย' },
  { id: 29, title: 'ดอยอ่างขาง', category: 'ภูเข' as const, latitude: 19.9000, longitude: 99.0500, location: 'อำเภอฝาง จังหวัดเชียงใหม่', description: 'ยอดดอยอากาศเย็น มีแปลงไม้ดอกและทิวทัศน์ภูเขาสวยงาม' },
  { id: 30, title: 'ดอยแม่สลอง', category: 'ภูเข' as const, latitude: 20.1667, longitude: 99.6333, location: 'อำเภอแม่ฟ้าหลวง จังหวัดเชียงราย', description: 'ภูเขาและชุมชนชาวเขาชื่อดัง มีไร่ชาและทะเลหมอก' },
  { id: 31, title: 'เขาค้อ', category: 'ภูเข' as const, latitude: 16.9960, longitude: 100.9940, location: 'อำเภอเขาค้อ จังหวัดเพชรบูรณ์', description: 'แหล่งชมทะเลหมอกยอดนิยมของเพชรบูรณ์ อากาศเย็นตลอดปี' },
  { id: 32, title: 'ภูทับเบิก', category: 'ภูเข' as const, latitude: 16.9000, longitude: 101.1000, location: 'อำเภอหล่มเก่า จังหวัดเพชรบูรณ์', description: 'ยอดเขาสูงที่มีไร่กะหล่ำปลี ทะเลหมอก และอากาศหนาว' },
  { id: 33, title: 'เขาหลวงสุโขทัย', category: 'ภูเข' as const, latitude: 16.8500, longitude: 99.6500, location: 'อำเภอคีรีมาศ จังหวัดสุโขทัย', description: 'เส้นทางเดินป่าขึ้นยอดเขาที่มีจุดชมวิวธรรมชาติของสุโขทัย' },
  { id: 42, title: 'ดอยเสมอดาว', category: 'ภูเข' as const, latitude: 18.3833, longitude: 100.8333, location: 'อำเภอนาน้อย จังหวัดน่าน', description: 'จุดชมทะเลหมอกและดาวบนสันเขาในบรรยากาศธรรมชาติของจังหวัดน่าน' },
  { id: 34, title: 'อุทยานแห่งชาติแก่งกระจาน', category: 'อุทยาน' as const, latitude: 12.8000, longitude: 99.4500, location: 'อำเภอแก่งกระจาน จังหวัดเพชรบุรี', description: 'อุทยานแห่งชาติขนาดใหญ่ มีป่า ทะเลหมอก และเขื่อนแก่งกระจาน' },
  { id: 35, title: 'อุทยานแห่งชาติหมู่เกาะสิมิลัน', category: 'อุทยาน' as const, latitude: 8.6500, longitude: 97.6500, location: 'อำเภอคุระบุรี จังหวัดพังงา', description: 'หมู่เกาะทะเลอันดามันที่มีน้ำใสและแหล่งดำน้ำระดับโลก' },
  { id: 36, title: 'อุทยานแห่งชาติเขาสก', category: 'อุทยาน' as const, latitude: 8.9360, longitude: 98.5300, location: 'อำเภอบ้านตาขุน จังหวัดสุราษฎร์ธานี', description: 'ป่าฝนเก่าแก่และภูเขาหินปูนรอบทะเลสาบเชี่ยวหลาน' },
  { id: 37, title: 'อุทยานแห่งชาติดอยอินทนนท์', category: 'อุทยาน' as const, latitude: 18.5883, longitude: 98.4878, location: 'อำเภอจอมทอง จังหวัดเชียงใหม่', description: 'อุทยานบนยอดเขาสูงที่สุดของไทย มีน้ำตกและเส้นทางธรรมชาติ' },
  { id: 38, title: 'อุทยานแห่งชาติหมู่เกาะอ่างทอง', category: 'อุทยาน' as const, latitude: 9.6200, longitude: 99.6800, location: 'อำเภอเกาะสมุย จังหวัดสุราษฎร์ธานี', description: 'หมู่เกาะหินปูนกลางอ่าวไทย มีทะเลสาบมรกตและจุดชมวิว' },
  { id: 39, title: 'อุทยานแห่งชาติทับลาน', category: 'อุทยาน' as const, latitude: 14.3500, longitude: 101.9000, location: 'อำเภอนาดี จังหวัดปราจีนบุรี', description: 'ผืนป่าลานธรรมชาติขนาดใหญ่ เหมาะสำหรับชมธรรมชาติและพักผ่อน' },
  { id: 40, title: 'อุทยานแห่งชาติหมู่เกาะช้าง', category: 'อุทยาน' as const, latitude: 12.1000, longitude: 102.3500, location: 'อำเภอเกาะช้าง จังหวัดตราด', description: 'อุทยานทางทะเลที่รวมเกาะและระบบนิเวศชายฝั่งอ่าวไทย' },
  { id: 41, title: 'อุทยานแห่งชาติน้ำตกพลิ้ว', category: 'อุทยาน' as const, latitude: 12.9890, longitude: 102.1650, location: 'อำเภอแหลมสิงห์ จังหวัดจันทบุรี', description: 'อุทยานที่มีน้ำตกพลิ้วและธรรมชาติอุดมสมบูรณ์ใกล้เมืองจันทบุรี' },
].map((attraction) => ({ ...attraction, images: fallbackDestinationImages }));

// Map Thai keywords to a real location in Thailand for current air-quality data.
const CITY_MAP: [string, string][] = [
  ['กรุงเทพ', 'bangkok'],
  ['ภูเขาทอง', 'bangkok'],
  ['วัดพระศรีรัตนศาสดาราม', 'bangkok'],
  ['วัด', 'bangkok'],
  ['เชียงใหม่', 'chiang-mai'],
  ['ดอยสุเทพ', 'chiang-mai'],
  ['ดอยอินทนนท์', 'chiang-mai'],
  ['ภูเขา', 'chiang-mai'],
  ['ภูเก็ต', 'phuket'],
  ['ทะเล', 'phuket'],
  ['หาด', 'phuket'],
  ['พัทยา', 'pattaya'],
  ['หัวหิน', 'hua-hin'],
  ['กระบี่', 'krabi'],
  ['พีพี', 'krabi'],
  ['เกาะ', 'samui'],
  ['สุราษฎร์', 'surat-thani'],
  ['เกาะเต่า', 'surat-thani'],
  ['นครราชสีมา', 'nakhon-ratchasima'],
  ['โคราช', 'nakhon-ratchasima'],
  ['ขอนแก่น', 'khon-kaen'],
  ['อุดร', 'udon-thani'],
];

const AIR_LOCATIONS: Record<string, { latitude: number; longitude: number; label: string }> = {
  bangkok: { latitude: 13.7563, longitude: 100.5018, label: 'กรุงเทพมหานคร' },
  'chiang-mai': { latitude: 18.7883, longitude: 98.9853, label: 'เชียงใหม่' },
  phuket: { latitude: 7.8804, longitude: 98.3923, label: 'ภูเก็ต' },
  pattaya: { latitude: 12.9236, longitude: 100.8825, label: 'ชลบุรี' },
  'hua-hin': { latitude: 12.5684, longitude: 99.9577, label: 'ประจวบคีรีขันธ์' },
  krabi: { latitude: 8.0863, longitude: 98.9063, label: 'กระบี่' },
  samui: { latitude: 9.5120, longitude: 100.0136, label: 'สุราษฎร์ธานี' },
  'surat-thani': { latitude: 9.1382, longitude: 99.3217, label: 'สุราษฎร์ธานี' },
  'nakhon-ratchasima': { latitude: 14.9799, longitude: 102.0978, label: 'นครราชสีมา' },
  'khon-kaen': { latitude: 16.4322, longitude: 102.8236, label: 'ขอนแก่น' },
  'udon-thani': { latitude: 17.4138, longitude: 102.7875, label: 'อุดรธานี' },
};

function cityForQuery(query: string): string {
  const q = query.toLowerCase();
  for (const [key, city] of CITY_MAP) {
    if (q.includes(key.toLowerCase())) return city;
  }
  return 'bangkok';
}

type AirLevel = 'safe' | 'warning' | 'danger';

interface AirData {
  aqi: number;
  pm25: number | null;
  city: string;
  level: AirLevel;
  status: string;
  updatedAt: string;
}

function classifyAqi(aqi: number, pm25: number | null): { level: AirLevel; status: string } {
  if (aqi > 200 || (pm25 !== null && pm25 > 37.5)) return { level: 'danger', status: 'อันตราย' };
  if (aqi > 100 || (pm25 !== null && pm25 > 15)) return { level: 'warning', status: 'ไม่ดีต่อสุขภาพ' };
  if (aqi <= 50 && (pm25 === null || pm25 <= 15)) return { level: 'safe', status: 'ดีมาก' };
  return { level: 'safe', status: 'ดี' };
}

const cache = new Map<string, { data: AirData; fetchedAt: number }>();

async function fetchAirData(city: string): Promise<AirData> {
  const cached = cache.get(city);
  if (cached && Date.now() - cached.fetchedAt < 5 * 60 * 1000) return cached.data;
  const location = AIR_LOCATIONS[city] || AIR_LOCATIONS.bangkok;
  const res = await fetch(
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${location.latitude}&longitude=${location.longitude}&current=pm2_5,us_aqi&timezone=auto`,
  );
  if (!res.ok) throw new Error('Network error');
  const json = await res.json() as { current?: { pm2_5?: number; us_aqi?: number; time?: string } };
  if (typeof json.current?.us_aqi !== 'number') throw new Error('API error');
  const aqi = Math.round(json.current.us_aqi);
  const pm25 = typeof json.current.pm2_5 === 'number' ? json.current.pm2_5 : null;
  const { level, status } = classifyAqi(aqi, pm25);
  const updatedAt = json.current.time || new Date().toISOString();
  const result: AirData = { aqi, pm25, city: location.label, level, status, updatedAt };
  cache.set(city, { data: result, fetchedAt: Date.now() });
  return result;
}

async function fetchDestinationImages(title: string, latitude: number, longitude: number) {
  try {
    const articleResponse = await fetch(`https://th.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    let articleImage = '';
    if (articleResponse.ok) {
      const article = await articleResponse.json() as { originalimage?: { source?: string }; thumbnail?: { source?: string } };
      articleImage = article.originalimage?.source || article.thumbnail?.source || '';
    }
    const commonsResponse = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(title)}&gsrnamespace=6&gsrlimit=6&prop=imageinfo&iiprop=url&iiurlwidth=900&format=json&origin=*`,
    );
    const commonsData = commonsResponse.ok
      ? await commonsResponse.json() as { query?: { pages?: Record<string, { imageinfo?: Array<{ thumburl?: string; url?: string }> }> } }
      : {};
    const commonsImages = Object.values(commonsData.query?.pages || {})
      .map((page) => page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url || '')
      .filter(Boolean);
    return [...new Set([articleImage, ...commonsImages].filter(Boolean))].slice(0, 3);
  } catch {
    return [];
  }
}

export default function HomePage() {
  const navigate = useNavigate();
  const [departureDate, setDepartureDate] = useState<Date | undefined>(undefined);
  const [returnDate, setReturnDate] = useState<Date | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [showIslandSuggestions, setShowIslandSuggestions] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [airData, setAirData] = useState<AirData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [destinationImages, setDestinationImages] = useState<Record<number, string[]>>({});
  const [tatPlaces, setTatPlaces] = useState<TatAttraction[]>([]);
  const [tatTempleImages, setTatTempleImages] = useState<string[]>([]);
  const [popularPlaces, setPopularPlaces] = useState([...fallbackPopularPlaces]);
  const [selectedCategory, setSelectedCategory] = useState<TourismCategory>('ทั้งหมด');
  const [gpsStatus, setGpsStatus] = useState<'pending' | 'available' | 'unavailable'>('pending');
  const [gpsCoordinates, setGpsCoordinates] = useState<AlertCoordinates | null>(null);
  const [selectedProvince, setSelectedProvince] = useState('');
  const [alertLocation, setAlertLocation] = useState<AlertLocation | null>(null);
  const [regionalAlert, setRegionalAlert] = useState<RegionalAlertData | null>(null);
  const [regionalAlertLoading, setRegionalAlertLoading] = useState(true);
  const [regionalAlertError, setRegionalAlertError] = useState('');
  const [discoveryCategory, setDiscoveryCategory] = useState<DiscoveryCategory>('สถานที่ยอดนิยม');
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('favorite-attractions');
      const parsed: unknown = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
    } catch {
      return [];
    }
  });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus('unavailable');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setGpsCoordinates({ latitude: coords.latitude, longitude: coords.longitude });
        setGpsStatus('available');
      },
      () => setGpsStatus('unavailable'),
      { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000, timeout: 10 * 1000 },
    );
  }, []);

  const fallbackSearch = gpsStatus === 'unavailable' && !selectedProvince ? searchQuery.trim() : '';

  useEffect(() => {
    localStorage.setItem('favorite-attractions', JSON.stringify(favoriteIds));
  }, [favoriteIds]);

  useEffect(() => {
    if (gpsStatus === 'pending') return;
    let cancelled = false;
    let refreshing = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    const loadAlerts = async (location: AlertLocation) => {
      if (refreshing || cancelled) return;
      refreshing = true;
      setRegionalAlertLoading(true);
      setRegionalAlertError('');
      try {
        const data = await fetchRegionalAlerts(location);
        if (!cancelled) setRegionalAlert(data);
      } catch {
        if (!cancelled) setRegionalAlertError('ไม่สามารถโหลดข้อมูลแจ้งเตือนได้ กรุณาลองใหม่');
      } finally {
        refreshing = false;
        if (!cancelled) setRegionalAlertLoading(false);
      }
    };

    const resolveLocation = async () => {
      try {
        let location: AlertLocation;
        if (gpsStatus === 'available' && gpsCoordinates) {
          const province = await getProvinceForCoordinates(gpsCoordinates.latitude, gpsCoordinates.longitude);
          location = { ...gpsCoordinates, province };
        } else if (selectedProvince) {
          const resolved = await findAlertLocation(`${selectedProvince}, Thailand`);
          location = { ...resolved, province: selectedProvince };
        } else if (fallbackSearch.length >= 2) {
          location = await findAlertLocation(`${fallbackSearch}, Thailand`);
        } else {
          location = { latitude: 13.7563, longitude: 100.5018, province: 'กรุงเทพมหานคร' };
        }
        if (cancelled) return;
        setAlertLocation(location);
        await loadAlerts(location);
        interval = setInterval(() => void loadAlerts(location), 8 * 60 * 1000);
      } catch {
        if (!cancelled) {
          setRegionalAlertLoading(false);
          setRegionalAlertError('ไม่พบจังหวัดจากตำแหน่งนี้ กรุณาค้นหาจังหวัดเพื่อดูการแจ้งเตือน');
        }
      }
    };

    const debounce = setTimeout(() => void resolveLocation(), fallbackSearch ? 500 : 0);
    return () => {
      cancelled = true;
      clearTimeout(debounce);
      if (interval) clearInterval(interval);
    };
  }, [gpsStatus, gpsCoordinates, selectedProvince, fallbackSearch]);

  useEffect(() => {
    fetchTatPlace('วัดพระศรีรัตนศาสดาราม')
      .then((place) => setTatTempleImages(lockTatImages('วัดพระศรีรัตนศาสดาราม', place?.images || [])))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    fetchTatAttractions(50)
      .then(async (places) => {
        if (places.length === 0) return;
        setTatPlaces(places);
        setPopularPlaces(places.slice(0, 7).map((place) => ({
          name: place.name,
          province: place.province,
          type: place.type,
        })));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const loadImages = async () => {
      const loaded = await Promise.all(
        attractions.map(async (attraction) => {
          const images = attraction.id === 3
            ? tatTempleImages
            : await fetchDestinationImages(attraction.title, attraction.latitude, attraction.longitude);
          return [attraction.id, attraction.id === 3 ? images : images.length > 0 ? images : attraction.images] as const;
        }),
      );
      const imageMap = Object.fromEntries(loaded);
      setDestinationImages(imageMap);
      Object.entries(imageMap).forEach(([id, images]) => {
        if (images.length) localStorage.setItem(`destination-images-${id}`, JSON.stringify(images));
      });
    };
    loadImages();
  }, []);

  // Trigger modal + fetch when query + both dates are set
  useEffect(() => {
    if (!searchQuery.trim() || !departureDate || !returnDate) {
      setShowAlert(false);
      return;
    }
    const timer = setTimeout(async () => {
      setShowAlert(true);
      setLoading(true);
      setFetchError('');
      setAirData(null);
      const city = cityForQuery(searchQuery);
      try {
        const data = await fetchAirData(city);
        setAirData(data);
      } catch {
        setFetchError('ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่');
      } finally {
        setLoading(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, departureDate, returnDate]);

  const retryFetch = async () => {
    setLoading(true);
    setFetchError('');
    const city = cityForQuery(searchQuery);
    cache.delete(city);
    try {
      const data = await fetchAirData(city);
      setAirData(data);
    } catch {
      setFetchError('ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่');
    } finally {
      setLoading(false);
    }
  };

  const level = airData?.level ?? 'warning';

  const levelColors = {
    danger: {
      bar: 'from-red-500 to-red-700',
      icon: 'bg-red-100',
      iconText: 'text-red-600',
      card: 'bg-red-50 border-red-200',
      value: 'text-red-600',
      wind: 'text-red-500',
      badge: 'bg-red-500',
    },
    warning: {
      bar: 'from-yellow-400 to-orange-500',
      icon: 'bg-orange-100',
      iconText: 'text-orange-500',
      card: 'bg-orange-50 border-orange-200',
      value: 'text-orange-600',
      wind: 'text-orange-500',
      badge: 'bg-orange-400',
    },
    safe: {
      bar: 'from-green-400 to-teal-500',
      icon: 'bg-green-100',
      iconText: 'text-green-600',
      card: 'bg-green-50 border-green-200',
      value: 'text-green-700',
      wind: 'text-green-600',
      badge: 'bg-green-500',
    },
  };

  const c = levelColors[level];

  const formatDate = (d: Date) =>
    d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });

  const attractions = [
    {
      id: 3,
      title: 'วัดพระศรีรัตนศาสดาราม',
      category: 'วัด' as const,
      latitude: 13.7516,
      longitude: 100.4927,
      description: 'วัดสำคัญในพระบรมมหาราชวัง โดดเด่นด้วยสถาปัตยกรรมไทยและพระแก้วมรกต ใจกลางกรุงเทพมหานคร',
      location: 'ถนนหน้าพระลาน แขวงพระบรมมหาราชวัง เขตพระนคร กรุงเทพมหานคร 10200',
      images: tatTempleImages,
    },
    {
      id: 4,
      title: 'เกาะพีพี',
      category: 'ทะเล' as const,
      latitude: 7.7407,
      longitude: 98.7784,
      description: 'หมู่เกาะยอดนิยมในทะเลอันดามัน จังหวัดกระบี่ มีอ่าวมาหยา น้ำทะเลใส และหาดทรายสวย',
      location: 'ตำบลอ่าวนาง อำเภอเมืองกระบี่ จังหวัดกระบี่',
      images: [
        'https://images.unsplash.com/photo-1537956965359-7573183d1f57?w=400',
        'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=400',
        'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400',
      ],
    },
    {
      id: 6,
      title: 'ดอยสุเทพ',
      category: 'ภูเขา' as const,
      latitude: 18.8048,
      longitude: 98.9216,
      description: 'วัดพระธาตุดอยสุเทพ สถานที่คู่เมืองเชียงใหม่ ตั้งอยู่บนยอดดอยพร้อมวิวเมืองและภูเขา',
      location: 'ตำบลสุเทพ อำเภอเมืองเชียงใหม่ จังหวัดเชียงใหม่ 50200',
      images: [
        'https://images.unsplash.com/photo-1589728894104-1cf1f8ae9eee?w=400',
        'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400',
        'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400',
      ],
    },
    {
      id: 5,
      title: 'พัทยา',
      category: 'ทะเล' as const,
      latitude: 12.9236,
      longitude: 100.8825,
      description: 'เมืองชายทะเลยอดนิยมของชลบุรี มีหาดพัทยา จุดชมวิว และกิจกรรมทางน้ำหลากหลาย',
      location: 'อำเภอบางละมุง จังหวัดชลบุรี 20150',
      images: [
        'https://images.unsplash.com/photo-1598971639058-fab3c3109a00?w=400',
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400',
        'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400',
      ],
    },
    {
      id: 7,
      title: 'หัวหิน',
      category: 'ทะเล' as const,
      latitude: 12.5684,
      longitude: 99.9577,
      description: 'เมืองพักผ่อนริมทะเลในประจวบคีรีขันธ์ มีชายหาด ตลาดกลางคืน และสถานที่ท่องเที่ยวสำหรับครอบครัว',
      location: 'อำเภอหัวหิน จังหวัดประจวบคีรีขันธ์ 77110',
      images: [
        'https://images.unsplash.com/photo-1552550049-db097c9480d1?w=400',
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400',
        'https://images.unsplash.com/photo-1598971639058-fab3c3109a00?w=400',
      ],
    },
    {
      id: 8,
      title: 'ดอยอินทนนท์',
      category: 'ภูเขา' as const,
      latitude: 18.5883,
      longitude: 98.4878,
      description: 'ยอดเขาที่สูงที่สุดในประเทศไทย มีธรรมชาติ น้ำตก และอากาศเย็นตลอดปี',
      location: 'ตำบลบ้านหลวง อำเภอจอมทอง จังหวัดเชียงใหม่ 50160',
      images: [
        'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400',
        'https://images.unsplash.com/photo-1589728894104-1cf1f8ae9eee?w=400',
        'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400',
      ],
    },
    {
      id: 9,
      title: 'อุทยานแห่งชาติเขาใหญ่',
      category: 'อุทยาน' as const,
      latitude: 14.4382,
      longitude: 101.3727,
      description: 'อุทยานแห่งชาติแห่งแรกของประเทศไทย มีป่าดิบ น้ำตก และเส้นทางธรรมชาติที่อุดมสมบูรณ์',
      location: 'ตำบลหมูสี อำเภอปากช่อง จังหวัดนครราชสีมา 30130',
      images: [
        'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400',
        'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400',
        'https://images.unsplash.com/photo-1500534623283-312aade485b7?w=400',
      ],
    },
    {
      id: 10,
      title: 'วัดโพธิ์',
      category: 'วัด' as const,
      latitude: 13.7465,
      longitude: 100.4930,
      description: 'วัดเก่าแก่ริมแม่น้ำเจ้าพระยา โดดเด่นด้วยพระพุทธไสยาสน์และศิลาจารึกวัดโพธิ์',
      location: '2 ถนนสนามไชย แขวงพระบรมมหาราชวัง เขตพระนคร กรุงเทพมหานคร 10200',
      images: ['https://images.unsplash.com/photo-1528181304800-259b08848526?w=400'],
    },
    {
      id: 11,
      title: 'วัดอรุณราชวราราม',
      category: 'วัด' as const,
      latitude: 13.7437,
      longitude: 100.4889,
      description: 'พระปรางค์ริมแม่น้ำเจ้าพระยา แลนด์มาร์กสำคัญของกรุงเทพมหานคร',
      location: '158 ถนนวังเดิม แขวงวัดอรุณ เขตบางกอกใหญ่ กรุงเทพมหานคร 10600',
      images: ['https://images.unsplash.com/photo-1583499871880-de841d1ace2a?w=400'],
    },
    {
      id: 12,
      title: 'เกาะสมุย',
      category: 'ทะเล' as const,
      latitude: 9.5120,
      longitude: 100.0136,
      description: 'เกาะท่องเที่ยวยอดนิยมของสุราษฎร์ธานี มีชายหาดสวยและธรรมชาติริมทะเล',
      location: 'อำเภอเกาะสมุย จังหวัดสุราษฎร์ธานี 84320',
      images: ['https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=400'],
    },
    {
      id: 13,
      title: 'ภูเก็ต',
      category: 'ทะเล' as const,
      latitude: 7.8804,
      longitude: 98.3923,
      description: 'จังหวัดท่องเที่ยวริมทะเลอันดามัน มีชายหาด จุดชมวิว และเกาะใกล้เคียง',
      location: 'อำเภอเมืองภูเก็ต จังหวัดภูเก็ต 83000',
      images: ['https://images.unsplash.com/photo-1589394815804-964eed0db9b2?w=400'],
    },
    {
      id: 14,
      title: 'ภูชี้ฟ้า',
      category: 'ภูเข' as const,
      latitude: 19.8520,
      longitude: 100.4500,
      description: 'ยอดเขาชื่อดังของเชียงราย จุดชมทะเลหมอกและพระอาทิตย์ขึ้นเหนือขอบฟ้า',
      location: 'หมู่ที่ 10 ตำบลปอ อำเภอเวียงแก่น จังหวัดเชียงราย 57310',
      images: ['https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400'],
    },
    {
      id: 15,
      title: 'ภูกระดึง',
      category: 'ภูเข' as const,
      latitude: 16.8857,
      longitude: 101.8200,
      description: 'ภูเขายอดนิยมของจังหวัดเลย มีเส้นทางเดินป่า หน้าผา และทะเลหมอก',
      location: 'ตำบลศรีฐาน อำเภอภูกระดึง จังหวัดเลย 42180',
      images: ['https://images.unsplash.com/photo-1500534623283-312aade485b7?w=400'],
    },
    {
      id: 16,
      title: 'อุทยานแห่งชาติเอราวัณ',
      category: 'อุทยาน' as const,
      latitude: 14.3750,
      longitude: 99.1447,
      description: 'อุทยานแห่งชาติชื่อดังของกาญจนบุรี มีน้ำตกเอราวัณเจ็ดชั้นและเส้นทางธรรมชาติ',
      location: 'ตำบลท่ากระดาน อำเภอศรีสวัสดิ์ จังหวัดกาญจนบุรี 71250',
      images: ['https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=400'],
    },
    ...additionalAttractions,
  ];
  const apiAttractions = tatPlaces.map((place, index) => ({
    id: 1000 + index,
    key: `tat-${place.id ?? index}`,
    title: place.name,
    province: place.province,
    sourceType: place.type,
    category: (/ทะเล|เกาะ|ชายหาด/i.test(place.type) ? 'ทะเล' : /ภูเขา|ดอย/i.test(place.type) ? 'ภูเข' : /วัด|พระ/i.test(place.type) ? 'วัด' : /อุทยาน|park/i.test(place.type) ? 'อุทยาน' : place.type) as string,
    latitude: place.latitude,
    longitude: place.longitude,
    description: place.description || `${place.name} สถานที่ท่องเที่ยวใน${place.province}`,
    location: place.location || place.province,
    images: place.images,
    rating: place.rating,
    reviewCount: place.reviewCount,
    entranceFee: place.entranceFee,
    openingHours: place.openingHours,
    suitableFor: place.suitableFor || [],
    createdAt: place.createdAt,
  }));
  const sourceAttractions = apiAttractions.length > 0 ? apiAttractions : attractions.map((place) => ({
    ...place,
    key: `local-${place.id}`,
    province: getProvinceName(place.location),
    sourceType: place.category,
    rating: undefined,
    reviewCount: undefined,
    entranceFee: undefined,
    openingHours: undefined,
    suitableFor: [] as string[],
    createdAt: undefined,
  }));
  const locationOrigin = gpsCoordinates
    || (gpsStatus === 'unavailable' && (selectedProvince || fallbackSearch) ? alertLocation : null);
  const weatherSuitable = regionalAlert
    ? !hasHeavyRain(regionalAlert)
      && (regionalAlert.weatherCode === null || regionalAlert.weatherCode < 95)
      && (regionalAlert.windGusts === null || regionalAlert.windGusts < 60)
      && (regionalAlert.temperature === null || regionalAlert.temperature < 35)
    : null;
  const filteredAttractions = sourceAttractions
    .filter((attraction) => (selectedCategory === 'ทั้งหมด' || attraction.category === selectedCategory))
    .filter((attraction) => !searchQuery.trim()
      || `${attraction.title} ${attraction.location} ${attraction.province} ${attraction.category} ${attraction.description}`.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    .map((attraction) => ({
      ...attraction,
      distanceKm: locationOrigin && attraction.latitude !== undefined && attraction.longitude !== undefined
        ? distanceBetween(attraction.latitude, attraction.longitude, locationOrigin)
        : undefined,
    }))
    .map((attraction) => ({
      ...attraction,
      images: (() => {
        const sourceImages = destinationImages[attraction.id]?.length
          ? destinationImages[attraction.id]
          : attraction.images;
        return [...new Set(sourceImages)].filter(Boolean) as string[];
      })(),
    }))
    .filter((attraction) => attraction.images.length > 0);
  const displayedAttractions = [...filteredAttractions];
  if (discoveryCategory === 'คะแนนสูง') {
    for (let index = displayedAttractions.length - 1; index >= 0; index -= 1) {
      if (displayedAttractions[index].rating === undefined) displayedAttractions.splice(index, 1);
    }
    displayedAttractions.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
  } else if (discoveryCategory === 'ใกล้คุณ') {
    for (let index = displayedAttractions.length - 1; index >= 0; index -= 1) {
      if (displayedAttractions[index].distanceKm === undefined) displayedAttractions.splice(index, 1);
    }
    displayedAttractions.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  } else if (discoveryCategory === 'เหมาะกับสภาพอากาศวันนี้') {
    if (weatherSuitable !== true) displayedAttractions.splice(0);
  } else if (discoveryCategory === 'รายการโปรด') {
    for (let index = displayedAttractions.length - 1; index >= 0; index -= 1) {
      if (!favoriteIds.includes(displayedAttractions[index].key)) displayedAttractions.splice(index, 1);
    }
  } else if (discoveryCategory.startsWith('เหมาะสำหรับ ')) {
    const target = discoveryCategory.replace('เหมาะสำหรับ', '').trim();
    for (let index = displayedAttractions.length - 1; index >= 0; index -= 1) {
      if (!displayedAttractions[index].suitableFor.some((value) => value.toLowerCase().includes(target.toLowerCase()))) {
        displayedAttractions.splice(index, 1);
      }
    }
  }
  if (discoveryCategory === 'ใกล้คุณ') {
    displayedAttractions.splice(10);
  }
  const activeRegionalAlerts = regionalAlert
    ? [
        hasHeavyRain(regionalAlert) && {
          icon: '🌧️',
          title: 'แจ้งเตือนฝนตกหนัก',
          detail: `ฝนปัจจุบัน ${regionalAlert.currentRain?.toFixed(1) ?? '—'} มม.`,
        },
        hasHighFloodRisk(regionalAlert) && {
          icon: '🌊',
          title: 'แจ้งเตือนน้ำท่วม',
          detail: `ฝนสูงสุด ${regionalAlert.nextThreeDaysRain?.toFixed(1) ?? '—'} มม./วัน${
            regionalAlert.riverDischarge
              ? ` · ปริมาณน้ำไหล ${regionalAlert.riverDischarge[0].toFixed(1)} ม³/วินาที`
              : ''
          }`,
        },
        hasHighPm25(regionalAlert) && {
          icon: '😷',
          title: 'แจ้งเตือนฝุ่น',
          detail: `PM2.5 ${regionalAlert.pm25?.toFixed(1) ?? '—'} µg/m³`,
        },
        typeof regionalAlert.temperature === 'number' && regionalAlert.temperature >= 35 && {
          icon: '🥵',
          title: 'แจ้งเตือนอากาศร้อนจัด',
          detail: `${regionalAlert.temperature.toFixed(1)}°C`,
        },
        typeof regionalAlert.windGusts === 'number' && regionalAlert.windGusts >= 60 && {
          icon: '💨',
          title: 'แจ้งเตือนลมแรง',
          detail: `ลมกระโชก ${regionalAlert.windGusts.toFixed(0)} กม./ชม.`,
        },
        typeof regionalAlert.weatherCode === 'number' && regionalAlert.weatherCode >= 95 && {
          icon: '⛈️',
          title: 'แจ้งเตือนพายุฝนฟ้าคะนอง',
          detail: `ลม ${regionalAlert.windSpeed?.toFixed(0) ?? '—'} กม./ชม.`,
        },
      ].filter((alert): alert is { icon: string; title: string; detail: string } => Boolean(alert))
    : [];
  const regionalAirQuality = regionalAlert?.aqi !== null && regionalAlert?.aqi !== undefined
    ? classifyAqi(regionalAlert.aqi, regionalAlert.pm25)
    : null;
  const regionalAlertHasIssues = activeRegionalAlerts.length > 0
    || Boolean(regionalAlert?.unavailableSources?.length)
    || regionalAirQuality?.level === 'warning'
    || regionalAirQuality?.level === 'danger';
  const regionalAlertIsDanger = regionalAirQuality?.level === 'danger';
  const alertCardColors = regionalAlertIsDanger
    ? { card: 'border-red-500 bg-red-50', icon: 'bg-red-500', text: 'text-red-800', detail: 'text-red-700', badge: 'bg-red-500', advice: 'bg-red-100 text-red-800' }
    : regionalAlertHasIssues
      ? { card: 'border-orange-400 bg-orange-50', icon: 'bg-orange-400', text: 'text-orange-800', detail: 'text-orange-700', badge: 'bg-orange-400', advice: 'bg-orange-100 text-orange-800' }
      : { card: 'border-green-500 bg-green-50', icon: 'bg-green-500', text: 'text-green-800', detail: 'text-green-700', badge: 'bg-green-500', advice: 'bg-green-100 text-green-800' };

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      {/* PM2.5 Modal */}
      {showAlert && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAlert(false)} />
          <div className="relative w-full max-w-[480px] bg-white rounded-t-3xl shadow-2xl overflow-hidden">
            <div className={`h-2 bg-gradient-to-r ${c.bar}`} />

            <div className="px-5 pt-5 pb-8">
              {/* Header row */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`rounded-full p-2.5 ${c.icon}`}>
                    {loading ? (
                      <Loader2 className={`w-6 h-6 ${c.iconText} animate-spin`} />
                    ) : level === 'danger' ? (
                      <AlertTriangle className={`w-6 h-6 ${c.iconText}`} />
                    ) : level === 'warning' ? (
                      <AlertCircle className={`w-6 h-6 ${c.iconText}`} />
                    ) : (
                      <Shield className={`w-6 h-6 ${c.iconText}`} />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base leading-tight">
                      {loading
                        ? 'กำลังตรวจสอบคุณภาพอากาศ…'
                        : level === 'danger'
                        ? 'แจ้งเตือน! ระดับอันตราย'
                        : level === 'warning'
                        ? 'แจ้งเตือน! ควรระวัง'
                        : 'อากาศดี สามารถเดินทางได้'}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {searchQuery} · {departureDate && formatDate(departureDate)} – {returnDate && formatDate(returnDate)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAlert(false)}
                  className="p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              {/* Loading skeleton */}
              {loading && (
                <div className="space-y-3 animate-pulse">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-24 bg-gray-100 rounded-2xl" />
                    <div className="h-24 bg-gray-100 rounded-2xl" />
                  </div>
                  <div className="h-4 bg-gray-100 rounded-full" />
                  <div className="h-14 bg-gray-100 rounded-xl" />
                  <div className="h-12 bg-gray-100 rounded-2xl" />
                </div>
              )}

              {/* Error state */}
              {!loading && fetchError && (
                <div className="text-center py-6">
                  <p className="text-gray-600 text-sm mb-4">{fetchError}</p>
                  <button
                    onClick={retryFetch}
                    className="flex items-center gap-2 mx-auto px-5 py-2.5 bg-[#1F2E7A] text-white rounded-2xl text-sm font-medium"
                  >
                    <RefreshCw className="w-4 h-4" />
                    ลองใหม่
                  </button>
                </div>
              )}

              {/* Real data */}
              {!loading && airData && (
                <>
                  {/* Station name + updated time */}
                  <p className="text-xs text-gray-400 mb-3">
                    สถานี: <span className="font-medium text-gray-600">{airData.city}</span>
                    {airData.updatedAt && (
                      <> · อัปเดต {new Date(airData.updatedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</>
                    )}
                  </p>

                  {/* PM2.5 / AQI cards */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className={`rounded-2xl p-4 border ${c.card}`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Wind className={`w-3.5 h-3.5 ${c.wind}`} />
                        <span className="text-xs text-gray-500">PM2.5</span>
                      </div>
                      <p className={`text-3xl font-bold ${c.value}`}>
                        {airData.pm25 !== null ? airData.pm25.toFixed(1) : '—'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">µg/m³</p>
                    </div>
                    <div className={`rounded-2xl p-4 border ${c.card}`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Activity className={`w-3.5 h-3.5 ${c.wind}`} />
                        <span className="text-xs text-gray-500">AQI</span>
                      </div>
                      <p className={`text-3xl font-bold ${c.value}`}>{airData.aqi}</p>
                      <p className="text-xs text-gray-400 mt-0.5">ดัชนีคุณภาพอากาศ</p>
                    </div>
                  </div>

                  {/* AQI color bar with marker */}
                  <div className="mb-4">
                    <div className="relative mb-1">
                      <div className="flex rounded-full overflow-hidden h-3">
                        <div className="flex-1 bg-green-400" />
                        <div className="flex-1 bg-yellow-400" />
                        <div className="flex-1 bg-orange-400" />
                        <div className="flex-1 bg-red-500" />
                        <div className="flex-1 bg-red-800" />
                        <div className="flex-1 bg-purple-900" />
                      </div>
                      {/* Marker */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white border-2 border-gray-700 rounded-full shadow"
                        style={{ left: `${Math.min((airData.aqi / 500) * 100, 96)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-400 px-0.5">
                      <span>ดี (0)</span>
                      <span>ปานกลาง (100)</span>
                      <span>อันตราย (200+)</span>
                    </div>
                  </div>

                  {/* Status badge */}
                  <div className={`rounded-xl px-4 py-3 mb-5 text-center text-white ${c.badge}`}>
                    <p className="font-bold text-sm">
                      {level === 'danger'
                        ? `❌ ไม่แนะนำให้เดินทางไป "${searchQuery}"`
                        : level === 'warning'
                        ? '⚠️ ควรระวัง – สวมหน้ากาก N95 เมื่อออกนอก'
                        : '🌤️ อากาศดี เหมาะสมสำหรับการท่องเที่ยว'}
                    </p>
                    <p className="text-xs mt-0.5 opacity-90">
                      สถานะ: <span className="font-semibold">{airData.status}</span>
                    </p>
                  </div>

                  {/* Buttons */}
                  <div className="flex flex-col gap-3">
                    {level !== 'safe' && (
                      <button
                        onClick={() => { setShowAlert(false); navigate('/risk-alert/1'); }}
                        className="w-full py-3.5 bg-[#1F2E7A] text-white rounded-2xl font-semibold text-sm hover:bg-[#162056] transition-colors"
                      >
                        ดูสถานที่ทางเลือกที่ปลอดภัย
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setShowAlert(false);
                        if (searchQuery.trim()) navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                      }}
                      className={`w-full py-3.5 rounded-2xl font-semibold text-sm transition-colors border ${
                        level === 'safe'
                          ? 'bg-green-500 text-white border-green-500 hover:bg-green-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {level === 'safe' ? 'ดูผลการค้นหา' : 'ยังจะไปอยู่ – ดูผลการค้นหา'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Frame */}
      <div className="app-shell shadow-xl lg:shadow-none">
        {/* Header */}
        <header className="border-b border-slate-100 bg-white/95 px-4 pb-3 pt-12 shadow-sm backdrop-blur-sm sm:px-6 lg:px-8">
          <div className="flex w-full items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-[#1F2E7A] transition hover:bg-slate-200">
                <Menu className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-[#1F2E7A]">
                  <MapPinned className="h-4 w-4" />
                </div>
                <h1 className="text-xl font-bold text-[#1F2E7A]">Thailand</h1>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (searchQuery.trim()) navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
              }}
              className="hidden flex-1 justify-center md:flex"
            >
              <div className="relative w-full max-w-[540px]">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSelectedProvince('');
                    setShowIslandSuggestions(true);
                  }}
                  onFocus={() => setShowIslandSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowIslandSuggestions(false), 150)}
                  placeholder="ค้นหาสถานที่ จังหวัด หรือประเภทสถานที่"
                  className="h-11 w-full rounded-full border border-slate-200 bg-slate-50 pl-4 pr-12 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white"
                />
                <button type="submit" className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-[#1F2E7A] text-white hover:bg-[#162056]">
                  <Search className="h-4 w-4" />
                </button>
                {showIslandSuggestions && (
                  <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                    <p className="px-4 py-2 text-xs font-semibold text-slate-500">สถานที่ท่องเที่ยวยอดนิยมในประเทศไทย</p>
                    {popularPlaces
                      .filter((place) => !searchQuery.trim() || `${place.name} ${place.province} ${place.type}`.includes(searchQuery.trim()))
                      .map((place) => (
                        <button
                          key={place.name}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setSearchQuery(place.name);
                            setSelectedProvince(place.province);
                            setShowIslandSuggestions(false);
                          }}
                          className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-blue-50"
                        >
                          <span className="font-medium text-[#1F2E7A]">{place.name}</span>
                          <span className="text-xs text-slate-500">{place.type} · {place.province}</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </form>

            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 sm:flex">
                <LocateFixed className="h-3.5 w-3.5 text-[#1F2E7A]" />
                {alertLocation ? `จังหวัด${alertLocation.province}` : selectedProvince || 'เลือกจังหวัด'}
              </div>
              <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-[#1F2E7A] transition hover:bg-slate-200">
                <Heart className="h-4 w-4" />
              </button>
              <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-[#1F2E7A] transition hover:bg-slate-200">
                <User className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-3 w-full md:hidden">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (searchQuery.trim()) navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
              }}
              className="relative"
            >
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedProvince('');
                  setShowIslandSuggestions(true);
                }}
                onFocus={() => setShowIslandSuggestions(true)}
                onBlur={() => setTimeout(() => setShowIslandSuggestions(false), 150)}
                placeholder="ค้นหาสถานที่ จังหวัด หรือประเภทสถานที่"
                className="h-11 w-full rounded-full border border-slate-200 bg-slate-50 pl-4 pr-12 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white"
              />
              <button type="submit" className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-[#1F2E7A] text-white">
                <Search className="h-4 w-4" />
              </button>
            </form>
          </div>

        </header>

        {/* Content */}
        <div className="app-content">
          <section className="mb-6 overflow-hidden rounded-[28px] bg-slate-100 shadow-sm ring-1 ring-slate-200">
            <div className="relative min-h-[260px] bg-cover bg-center sm:min-h-[310px]" style={{ backgroundImage: `linear-gradient(90deg, rgba(10,37,86,0.72), rgba(12,74,110,0.28)), url(${displayedAttractions[0]?.images?.[0] || 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80'})` }}>
              <div className="relative z-10 flex min-h-[260px] flex-col justify-between p-4 sm:min-h-[310px] sm:p-6 lg:p-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
                    <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    {alertLocation ? `จังหวัด${alertLocation.province}` : 'ตำแหน่งของคุณ'}
                  </div>
                  <button type="button" className="flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
                    <Heart className="h-3.5 w-3.5" />
                    Favorite
                  </button>
                </div>

                <div className="max-w-xl">
                  <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-blue-100">Let&apos;s Explore</p>
                  <h1 className="text-3xl font-black leading-tight text-white sm:text-5xl">เที่ยวไทย ไปได้ทุกที่</h1>
                  <p className="mt-3 max-w-md text-sm text-blue-50/90 sm:text-base">
                    ค้นหาสถานที่ท่องเที่ยวที่เหมาะกับการเดินทางของคุณ พร้อมข้อมูลสภาพอากาศและความปลอดภัยแบบเรียลไทม์
                  </p>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (searchQuery.trim()) navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                  }}
                  className="relative w-full max-w-[760px]"
                >
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSelectedProvince('');
                      setShowIslandSuggestions(true);
                    }}
                    onFocus={() => setShowIslandSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowIslandSuggestions(false), 150)}
                    placeholder="ค้นหาสถานที่ จังหวัด หรือประเภทสถานที่"
                    className="h-14 w-full rounded-2xl border border-white/70 bg-white px-5 pr-14 text-sm text-slate-700 shadow-lg outline-none ring-0 placeholder:text-slate-400 focus:border-white"
                  />
                  <button type="submit" className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl bg-[#1F2E7A] text-white shadow-md transition hover:bg-[#162056]">
                    <Search className="h-4 w-4" />
                  </button>

                  {showIslandSuggestions && (
                    <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                      <p className="px-4 py-2 text-xs font-semibold text-slate-500">สถานที่ท่องเที่ยวยอดนิยมในประเทศไทย</p>
                      {popularPlaces
                        .filter((place) => !searchQuery.trim() || `${place.name} ${place.province} ${place.type}`.includes(searchQuery.trim()))
                        .map((place) => (
                          <button
                            key={place.name}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setSearchQuery(place.name);
                              setSelectedProvince(place.province);
                              setShowIslandSuggestions(false);
                            }}
                            className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-blue-50"
                          >
                            <span className="font-medium text-[#1F2E7A]">{place.name}</span>
                            <span className="text-xs text-slate-500">{place.type} · {place.province}</span>
                          </button>
                        ))}
                    </div>
                  )}
                </form>
              </div>

              <div className="absolute bottom-4 right-4 z-10 rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
                <span className="inline-flex items-center gap-1.5"><MapPinned className="h-3.5 w-3.5" /> ภูเก็ต</span>
              </div>
            </div>
          </section>

          <section aria-label="เลือกวันเดินทาง" className="mb-5 grid grid-cols-2 gap-3">
            <DatePicker
              placeholder="วันเดินทาง"
              selected={departureDate}
              onSelect={setDepartureDate}
              minDate={new Date()}
            />
            <DatePicker
              placeholder="วันกลับ"
              selected={returnDate}
              onSelect={setReturnDate}
              minDate={departureDate || new Date()}
            />
          </section>

          <section className="mb-5">
            <div className="mb-2">
              <h2 className="text-base font-bold text-[#1F2E7A]">คุณอยากเที่ยวแบบไหน?</h2>
              <p className="text-xs text-slate-500">เลือกประเภทสถานที่ที่คุณสนใจ</p>
            </div>
            <div className="grid grid-cols-5 gap-2 sm:flex sm:gap-3">
              {tourismCategories.map((category, index) => {
                const categoryIcons = ['🧭', '🌲', '🌊', '⛰️', '🛕'];
                const categoryColors = [
                  'bg-blue-50 text-blue-700',
                  'bg-emerald-50 text-emerald-700',
                  'bg-sky-50 text-sky-700',
                  'bg-orange-50 text-orange-700',
                  'bg-violet-50 text-violet-700',
                ];
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setSelectedCategory((current) => current === category ? 'ทั้งหมด' : category)}
                    aria-pressed={selectedCategory === category}
                    className={`flex min-w-0 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-xs transition hover:-translate-y-0.5 ${selectedCategory === category ? 'ring-2 ring-[#1F2E7A]' : ''} ${categoryColors[index]}`}
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-xl">{categoryIcons[index]}</span>
                    <span className="font-semibold">{category}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="mb-6 grid items-start gap-4 md:grid-cols-[minmax(0,2fr)_minmax(220px,0.9fr)]">
          <section className="min-w-0">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-[#1F2E7A]">สถานที่แนะนำสำหรับคุณ</h2>
                <p className="mt-1 text-xs text-slate-500">พบ {displayedAttractions.length} สถานที่</p>
              </div>
              <button type="button" className="text-sm font-medium text-[#1F2E7A] hover:text-blue-700">ดูทั้งหมด →</button>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {displayedAttractions.slice(0, 4).map((attraction) => (
                <article key={attraction.key} className="overflow-hidden rounded-[20px] border border-slate-100 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
                  <Link to={`/attraction/${attraction.id}`} state={{ title: attraction.title, location: attraction.location, province: attraction.province, category: attraction.category, description: attraction.description, rating: attraction.rating, images: attraction.images, lat: attraction.latitude !== undefined ? String(attraction.latitude) : undefined, lon: attraction.longitude !== undefined ? String(attraction.longitude) : undefined, openingHours: attraction.openingHours, entranceFee: attraction.entranceFee, reviewCount: attraction.reviewCount, favoriteKey: attraction.key }} className="block">
                    <div className="relative">
                      <img src={attraction.images[0]} alt={attraction.title} className="h-28 w-full object-cover sm:h-36" />
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); setFavoriteIds((current) => current.includes(attraction.key) ? current.filter((key) => key !== attraction.key) : [...current, attraction.key]); }}
                        className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow-sm transition hover:text-rose-500"
                        aria-label={favoriteIds.includes(attraction.key) ? `นำ${attraction.title}ออกจากรายการโปรด` : `บันทึก${attraction.title}เป็นรายการโปรด`}
                      >
                        <Heart className={`h-4 w-4 ${favoriteIds.includes(attraction.key) ? 'fill-rose-500 text-rose-500' : ''}`} />
                      </button>
                    </div>
                    <div className="min-h-28 p-2.5 sm:p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-semibold text-[#1F2E7A]">{attraction.category}</span>
                        <span className="text-[10px] font-medium text-slate-500">{attraction.province}</span>
                      </div>
                      <h3 className="line-clamp-1 text-sm font-bold text-[#1F2E7A]">{attraction.title}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-600">
                        <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-amber-400 text-amber-500" /> {attraction.rating?.toFixed(1) ?? '—'}</span>
                        <span className="inline-flex items-center gap-1"><MapPinned className="h-3 w-3 text-[#1F2E7A]" /> {attraction.province}</span>
                      </div>
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          </section>

          <aside className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
            <section className="rounded-[20px] border border-blue-100 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-[#1F2E7A]">อากาศวันนี้</h2>
                <span className="text-2xl" aria-hidden="true">☀️</span>
              </div>
              <div className="mt-1 flex items-end justify-between">
                <p className="text-3xl font-black text-[#1F2E7A]">{regionalAlert?.temperature != null ? `${regionalAlert.temperature.toFixed(1)}°C` : '29°C'}</p>
                <p className="pb-1 text-xs text-slate-500">{alertLocation ? `จังหวัด${alertLocation.province}` : 'ตามตำแหน่งของคุณ'}</p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                <p>ฝน <span className="font-semibold text-[#1F2E7A]">{regionalAlert?.rainChance != null ? `${regionalAlert.rainChance}%` : '10%'}</span></p>
                <p>ลม <span className="font-semibold text-[#1F2E7A]">{regionalAlert?.windSpeed != null ? `${regionalAlert.windSpeed.toFixed(0)} กม./ชม.` : '8 กม./ชม.'}</span></p>
              </div>
            </section>

            <section className={`rounded-[20px] border p-4 shadow-sm ${alertCardColors.card}`}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className={`text-sm font-bold ${alertCardColors.text}`}>แจ้งเตือนวันนี้</h2>
                {regionalAlert?.aqi != null && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${alertCardColors.badge}`}>AQI {regionalAlert.aqi}</span>
                )}
              </div>
              {regionalAlertLoading && !regionalAlert ? (
                <p className="text-xs text-slate-600">กำลังตรวจสอบข้อมูลล่าสุด…</p>
              ) : regionalAlertError ? (
                <p className="text-xs leading-relaxed text-orange-800">{regionalAlertError}</p>
              ) : activeRegionalAlerts.length > 0 ? (
                <div className="space-y-2">
                  {activeRegionalAlerts.map((alert) => (
                    <p key={alert.title} className={`text-xs ${alertCardColors.text}`}>
                      <span className="font-semibold">{alert.icon} {alert.title}</span>
                      <span className="ml-1">{alert.detail}</span>
                    </p>
                  ))}
                </div>
              ) : (
                <p className={`text-xs leading-relaxed ${alertCardColors.text}`}>
                  {regionalAlert?.unavailableSources?.length
                    ? `ไม่สามารถตรวจสอบ${regionalAlert.unavailableSources.join(' และ ')}ได้`
                    : regionalAirQuality?.level === 'warning'
                      ? 'คุณภาพอากาศอยู่ในระดับที่ควรระวัง'
                      : 'สถานการณ์ปกติ เหมาะกับการเดินทาง'}
                </p>
              )}
              {regionalAlert && (
                <p className={`mt-2 border-t border-current/10 pt-2 text-[10px] ${alertCardColors.detail}`}>
                  PM2.5 {regionalAlert.pm25 != null ? `${regionalAlert.pm25.toFixed(1)} µg/m³` : '—'}
                  {regionalAlert.updatedAt && ` · อัปเดต ${new Date(regionalAlert.updatedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`}
                </p>
              )}
            </section>
          </aside>
          </div>

          <section className="mb-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#1F2E7A]">สถานที่ยอดนิยม</h2>
                <p className="mt-1 text-xs text-slate-500">แนะนำสำหรับการเดินทางในช่วงนี้</p>
              </div>
              <button type="button" className="text-xs font-medium text-[#1F2E7A] hover:text-blue-700">ดูทั้งหมด →</button>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {displayedAttractions.slice(0, 4).map((attraction) => (
                <article key={`popular-${attraction.key}`} className="overflow-hidden rounded-[18px] border border-blue-100 bg-white shadow-sm">
                  <img src={attraction.images[0]} alt={attraction.title} className="h-24 w-full object-cover sm:h-28" />
                  <div className="p-2.5">
                    <h3 className="line-clamp-1 text-xs font-bold text-[#1F2E7A]">{attraction.title}</h3>
                    <p className="mt-1 text-[10px] text-slate-500">{attraction.province}</p>
                    <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-600"><Star className="h-3 w-3 fill-amber-400 text-amber-500" /> {attraction.rating?.toFixed(1) ?? '—'}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="mb-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#1F2E7A]">สถานที่ใกล้เคียง</h2>
                <p className="mt-1 text-xs text-slate-500">ค้นพบสถานที่ท่องเที่ยวรอบตัวคุณ</p>
              </div>
              <button type="button" className="text-xs font-medium text-[#1F2E7A] hover:text-blue-700">ดูทั้งหมด →</button>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {displayedAttractions.slice(0, 4).map((attraction) => (
                <article key={`nearby-${attraction.key}`} className="overflow-hidden rounded-[18px] border border-blue-100 bg-white shadow-sm">
                  <img src={attraction.images[0]} alt={attraction.title} className="h-20 w-full object-cover sm:h-24" />
                  <div className="p-2.5">
                    <h3 className="line-clamp-1 text-xs font-bold text-[#1F2E7A]">{attraction.title}</h3>
                    <p className="mt-1 text-[10px] text-slate-500">{attraction.province}</p>
                    <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-600"><MapPinned className="h-3 w-3 text-[#1F2E7A]" /> {attraction.distanceKm !== undefined ? `${attraction.distanceKm.toFixed(1)} กม.` : 'ระยะทางไม่ทราบ'}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="relative mb-2 overflow-hidden rounded-[20px] bg-cover bg-center px-5 py-6 text-white shadow-sm sm:px-8" style={{ backgroundImage: "linear-gradient(90deg, rgba(12,62,130,.82), rgba(14,165,190,.3)), url('https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1400&q=85')" }}>
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-lg font-bold">✨ สถานที่น่าไปช่วงนี้</p>
                <p className="mt-1 text-xs text-blue-50">รวมไอเดียเที่ยวไทย ให้ทุกทริปของคุณพิเศษยิ่งขึ้น</p>
              </div>
              <button type="button" onClick={() => setSelectedCategory('ทั้งหมด')} className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#1F2E7A] transition hover:bg-blue-50">
                ดูสถานที่แนะนำ →
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
