import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import { Search, AlertCircle, AlertTriangle, Wind, Activity, Heart, MapPinned, Star, Clock3, Banknote, LocateFixed, Navigation, Compass, Trees, Waves, Mountain, Landmark, Sun, Cloud, CloudRain, Droplets, Thermometer, CloudLightning, Sparkles, LoaderCircle, X, Info, type LucideIcon } from 'lucide-react';
import DatePicker from './DatePicker';
import { PlaceSearchBox } from './PlaceSearchBox';
import AttractionCard from './AttractionCard';
import { useUserLocation } from '../context/UserLocationContext';
import { THAI_PROVINCES } from '../data/provinces';
import type { PlaceSearchOption } from '../hooks/usePlaceSearch';
import { getPlacePhotoUrl, type PlaceDetails } from '../services/placesApi';
import { getFavoriteIds, removeFavoritePlace, saveFavoritePlace, subscribeToFavorites } from '../utils/favorites';
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
import { describeWeatherCode, fetchTripForecast, type TripForecast } from '../utils/tripForecast';

const tourismCategories = ['ทั้งหมด', 'อุทยาน', 'ทะเล', 'ภูเขา', 'วัด'] as const;
type TourismCategory = typeof tourismCategories[number];
type PlaceSuggestion = {
  key: string;
  routeId: string;
  placeId: string;
  title: string;
  province: string;
  category: string;
  location: string;
  description?: string;
  images?: string[];
  lat?: string;
  lon?: string;
  rating?: number;
  reviewCount?: number;
  entranceFee?: number;
  recommendedTime?: string;
  openingHours?: string;
  travelCaution?: string;
  favoriteKey?: string;
};

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
  const candidate = apiProvince || THAI_PROVINCES.find((province) => location.includes(province));
  return candidate?.replace(/^จังหวัด/, '') || '';
}

type AirLevel = 'safe' | 'warning' | 'danger';

function classifyAqi(aqi: number, pm25: number | null): { level: AirLevel; status: string } {
  if (aqi > 200 || (pm25 !== null && pm25 > 37.5)) return { level: 'danger', status: 'อันตราย' };
  if (aqi > 100 || (pm25 !== null && pm25 > 15)) return { level: 'warning', status: 'ไม่ดีต่อสุขภาพ' };
  if (aqi <= 50 && (pm25 === null || pm25 <= 15)) return { level: 'safe', status: 'ดีมาก' };
  return { level: 'safe', status: 'ดี' };
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

function formatDateForRoute(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTripDateLabel(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function HomePage() {
  const navigate = useNavigate();
  const [departureDate, setDepartureDate] = useState<Date | undefined>(undefined);
  const [returnDate, setReturnDate] = useState<Date | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null);
  const [searchFlowMessage, setSearchFlowMessage] = useState('');
  const [tripForecast, setTripForecast] = useState<TripForecast | null>(null);
  const [tripForecastLoading, setTripForecastLoading] = useState(false);
  const [tripForecastError, setTripForecastError] = useState('');
  const [isTripForecastModalOpen, setIsTripForecastModalOpen] = useState(false);
  const [destinationImages, setDestinationImages] = useState<Record<number, string[]>>({});
  const [tatPlaces, setTatPlaces] = useState<TatAttraction[]>([]);
  const [tatTempleImages, setTatTempleImages] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<TourismCategory>('ทั้งหมด');
  const { coordinates: gpsCoordinates, status: gpsStatus } = useUserLocation();
  const [selectedProvince, setSelectedProvince] = useState('');
  const [alertLocation, setAlertLocation] = useState<AlertLocation | null>(null);
  const [regionalAlert, setRegionalAlert] = useState<RegionalAlertData | null>(null);
  const [regionalAlertLoading, setRegionalAlertLoading] = useState(true);
  const [regionalAlertError, setRegionalAlertError] = useState('');
  const [discoveryCategory, setDiscoveryCategory] = useState<DiscoveryCategory>('สถานที่ยอดนิยม');
  const [showAllNearby, setShowAllNearby] = useState(false);
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
  const isMarineTripDestination = Boolean(selectedPlace
    && /ทะเล|เกาะ|ชายหาด|หาด|อ่าว|พัทยา|หัวหิน|พีพี|เต่า|beach|island/i
      .test(`${selectedPlace.title} ${selectedPlace.category} ${selectedPlace.location}`));

  useEffect(() => {
    if (!selectedPlace || !departureDate || !returnDate) {
      setTripForecast(null);
      setTripForecastLoading(false);
      setTripForecastError('');
      return;
    }

    const latitude = Number(selectedPlace.lat);
    const longitude = Number(selectedPlace.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setTripForecast(null);
      setTripForecastLoading(false);
      setTripForecastError('ไม่มีพิกัดของสถานที่ จึงไม่สามารถตรวจสอบพยากรณ์ได้');
      return;
    }

    const controller = new AbortController();
    const startDate = formatDateForRoute(departureDate);
    const endDate = formatDateForRoute(returnDate);
    setTripForecast(null);
    setTripForecastLoading(true);
    setTripForecastError('');

    fetchTripForecast(latitude, longitude, startDate, endDate, controller.signal, isMarineTripDestination)
      .then((forecast) => {
        setTripForecast(forecast);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setTripForecastError('ไม่สามารถโหลดพยากรณ์สำหรับวันที่เลือกได้');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setTripForecastLoading(false);
      });

    return () => controller.abort();
  }, [selectedPlace, departureDate, returnDate, isMarineTripDestination]);

  useEffect(() => {
    setIsTripForecastModalOpen(Boolean(selectedPlace && departureDate && returnDate));
  }, [selectedPlace, departureDate, returnDate]);

  useEffect(() => {
    if (!isTripForecastModalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsTripForecastModalOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isTripForecastModalOpen]);

  const fallbackSearch = gpsStatus === 'unavailable' && !selectedProvince ? searchQuery.trim() : '';

  useEffect(() => {
    localStorage.setItem('favorite-attractions', JSON.stringify(favoriteIds));
  }, [favoriteIds]);

  useEffect(() => subscribeToFavorites(() => setFavoriteIds(getFavoriteIds())), []);

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
          if (!cancelled) {
            setAlertLocation(null);
            setRegionalAlert(null);
            setRegionalAlertLoading(false);
            setRegionalAlertError('เปิดการเข้าถึงตำแหน่ง หรือค้นหาจังหวัดเพื่อดูสภาพอากาศและการแจ้งเตือนในพื้นที่');
          }
          return;
        }
        if (cancelled) return;
        setAlertLocation(location);
        setRegionalAlert(null);
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
    recommendedTime: place.recommendedTime,
    openingHours: place.openingHours,
    travelCaution: place.travelCaution,
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

  const handlePlaceSelect = (place: PlaceDetails) => {
    const province = THAI_PROVINCES.find((item) => place.address.includes(item)) || 'ประเทศไทย';
    const category = place.types?.some((type) => /beach|island|island/i.test(type))
      ? 'ทะเล'
      : place.types?.some((type) => /park|national_park/i.test(type))
        ? 'อุทยาน'
        : place.types?.some((type) => /temple|church|mosque/i.test(type))
          ? 'วัด'
          : 'สถานที่ท่องเที่ยว';
    const images = place.photos.map((photo) => getPlacePhotoUrl(photo)).filter((url): url is string => Boolean(url));
    const selected: PlaceSuggestion = {
      key: `google-${place.id}`,
      routeId: `place-${place.id}`,
      placeId: place.id,
      title: place.name,
      province,
      category,
      location: place.address || place.name,
      description: place.description,
      images,
      lat: place.latitude === undefined ? undefined : String(place.latitude),
      lon: place.longitude === undefined ? undefined : String(place.longitude),
      rating: place.rating,
      reviewCount: place.userRatingCount,
      favoriteKey: `google-${place.id}`,
    };
    setSelectedPlace(selected);
    setSelectedProvince(province);
    setSearchQuery(place.name);
    setSearchFlowMessage('');
  };

  const handleExploreOption = (option: PlaceSearchOption) => {
    const params = new URLSearchParams({ q: option.label });
    if (option.kind === 'province') {
      params.set('mode', 'province');
      params.set('province', option.label);
    } else {
      params.set('mode', 'category');
      params.set('category', option.label);
    }
    navigate(`/search?${params.toString()}`);
  };

  const handleTextSearch = (query: string) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;
    navigate(`/search?${new URLSearchParams({ q: trimmedQuery, mode: 'text' }).toString()}`);
  };

  const locationOrigin = gpsCoordinates
    || (gpsStatus === 'unavailable' && (selectedProvince || fallbackSearch) ? alertLocation : null);
  const tripForecastDays = tripForecast?.days || [];
  const maxForecastValue = (values: Array<number | null>) => {
    const valid = values.filter((value): value is number => value !== null && Number.isFinite(value));
    return valid.length ? Math.max(...valid) : null;
  };
  const minForecastValue = (values: Array<number | null>) => {
    const valid = values.filter((value): value is number => value !== null && Number.isFinite(value));
    return valid.length ? Math.min(...valid) : null;
  };
  const forecastMaxTemperature = maxForecastValue(tripForecastDays.map((day) => day.maxTemperature));
  const forecastMinTemperature = minForecastValue(tripForecastDays.map((day) => day.minTemperature));
  const forecastRainProbability = maxForecastValue(tripForecastDays.map((day) => day.precipitationProbability));
  const forecastRainTotal = tripForecastDays.length > 0
    && tripForecastDays.every((day) => day.precipitation !== null)
    ? tripForecastDays.reduce((total, day) => total + (day.precipitation ?? 0), 0)
    : null;
  const forecastPm25 = maxForecastValue(tripForecastDays.map((day) => day.pm25));
  const forecastAqi = maxForecastValue(tripForecastDays.map((day) => day.aqi));
  const forecastWind = maxForecastValue(tripForecastDays.map((day) => day.maxWindSpeed));
  const forecastWaveHeight = maxForecastValue(tripForecastDays.map((day) => day.waveHeightMax));
  const forecastWeatherCode = maxForecastValue(tripForecastDays.map((day) => day.weatherCode));
  const expectedForecastDayCount = departureDate && returnDate
    ? Math.round((Date.UTC(returnDate.getFullYear(), returnDate.getMonth(), returnDate.getDate())
      - Date.UTC(departureDate.getFullYear(), departureDate.getMonth(), departureDate.getDate())) / 86_400_000) + 1
    : 0;
  const hasCompleteWeatherForecast = tripForecastDays.length === expectedForecastDayCount
    && tripForecastDays.every((day) => day.weatherCode !== null
      && day.precipitationProbability !== null
      && day.maxTemperature !== null
      && day.minTemperature !== null);
  const hasSevereTripRisk = tripForecastDays.some((day) => (day.weatherCode !== null && day.weatherCode >= 95)
    || (day.precipitation !== null && day.precipitation >= 30)
    || (day.maxWindSpeed !== null && day.maxWindSpeed >= 60)
    || (day.waveHeightMax !== null && day.waveHeightMax >= 3)
    || (day.maxTemperature !== null && day.maxTemperature >= 40)
    || (day.pm25 !== null && day.pm25 >= 55)
    || (day.aqi !== null && day.aqi >= 151));
  const hasCautionTripRisk = tripForecastDays.some((day) => (day.precipitationProbability !== null && day.precipitationProbability >= 50)
    || (day.precipitation !== null && day.precipitation >= 10)
    || (day.weatherCode !== null && day.weatherCode >= 51 && day.weatherCode < 95)
    || (day.maxWindSpeed !== null && day.maxWindSpeed >= 35)
    || (day.waveHeightMax !== null && day.waveHeightMax >= 2)
    || (day.maxTemperature !== null && day.maxTemperature >= 35)
    || (day.pm25 !== null && day.pm25 > 15)
    || (day.aqi !== null && day.aqi > 50));
  const tripRiskLevel = hasSevereTripRisk
    ? 'danger'
    : hasCautionTripRisk
      ? 'warning'
      : hasCompleteWeatherForecast
        ? 'safe'
        : 'unknown';
  const tripRiskCopy = tripRiskLevel === 'danger'
    ? tripForecastDays.some((day) => day.weatherCode !== null && day.weatherCode >= 95)
      ? 'พยากรณ์พบพายุฝนฟ้าคะนองในช่วงวันที่เลือก'
      : tripForecastDays.some((day) => day.precipitation !== null && day.precipitation >= 30)
        ? 'พยากรณ์พบปริมาณฝนรายวันสูงในช่วงวันที่เลือก'
        : tripForecastDays.some((day) => day.waveHeightMax !== null && day.waveHeightMax >= 3)
          ? 'พยากรณ์คลื่นทะเลสูง ควรหลีกเลี่ยงกิจกรรมทางน้ำและตรวจสอบประกาศจากผู้ให้บริการ'
        : tripForecastDays.some((day) => day.maxTemperature !== null && day.maxTemperature >= 40)
          ? 'พยากรณ์อุณหภูมิสูงมาก ควรหลีกเลี่ยงกิจกรรมกลางแจ้งเป็นเวลานานและเตรียมน้ำดื่ม'
        : tripForecastDays.some((day) => day.pm25 !== null && day.pm25 >= 55)
          ? 'ค่าฝุ่น PM2.5 ที่พยากรณ์สูงในช่วงวันที่เลือก'
          : tripForecastDays.some((day) => day.aqi !== null && day.aqi >= 151)
            ? 'ค่าดัชนีคุณภาพอากาศที่พยากรณ์อยู่ในระดับไม่ดีต่อสุขภาพ'
            : 'พยากรณ์พบความเร็วลมสูงในช่วงวันที่เลือก'
    : tripRiskLevel === 'warning'
      ? [
          forecastRainProbability !== null && forecastRainProbability >= 50 ? `โอกาสฝนสูงสุด ${Math.round(forecastRainProbability)}%` : '',
          forecastPm25 !== null && forecastPm25 > 15 ? `PM2.5 สูงสุด ${forecastPm25.toFixed(1)} µg/m³` : '',
          forecastAqi !== null && forecastAqi > 50 ? `AQI สูงสุด ${Math.round(forecastAqi)}` : '',
          forecastWind !== null && forecastWind >= 35 ? `ลมสูงสุด ${Math.round(forecastWind)} กม./ชม.` : '',
          forecastWaveHeight !== null && forecastWaveHeight >= 2 ? `คลื่นสูงสุด ${forecastWaveHeight.toFixed(1)} ม.` : '',
          forecastMaxTemperature !== null && forecastMaxTemperature >= 35 ? `อุณหภูมิสูงสุด ${Math.round(forecastMaxTemperature)}°C` : '',
        ].filter(Boolean).join(' · ')
      : tripRiskLevel === 'safe'
        ? 'พยากรณ์อากาศไม่พบความเสี่ยงที่เกินเกณฑ์คัดกรองเบื้องต้นในช่วงวันที่เลือก'
        : !hasCompleteWeatherForecast
          ? 'ข้อมูลพยากรณ์บางวันไม่ครบ จึงยังประเมินความเสี่ยงตลอดช่วงเดินทางไม่ได้'
          : 'พยากรณ์อากาศไม่พบความเสี่ยงที่เกินเกณฑ์คัดกรองเบื้องต้นในช่วงวันที่เลือก';
  const tripRiskStyle = tripRiskLevel === 'danger'
    ? { panel: 'border-red-200 bg-red-50', text: 'text-red-800', badge: 'bg-red-600 text-white', label: 'ไม่แนะนำให้เดินทาง' }
    : tripRiskLevel === 'warning'
      ? { panel: 'border-amber-200 bg-amber-50', text: 'text-amber-900', badge: 'bg-amber-500 text-white', label: 'ควรระวัง' }
      : tripRiskLevel === 'safe'
        ? { panel: 'border-emerald-200 bg-emerald-50', text: 'text-emerald-900', badge: 'bg-emerald-600 text-white', label: 'เหมาะสำหรับเดินทาง' }
        : { panel: 'border-slate-200 bg-slate-50', text: 'text-slate-700', badge: 'bg-slate-500 text-white', label: 'ประเมินไม่ได้ครบถ้วน' };
  const dayRiskScore = (day: TripForecast['days'][number]) => {
    if ((day.weatherCode !== null && day.weatherCode >= 95)
      || (day.precipitation !== null && day.precipitation >= 30)
      || (day.maxWindSpeed !== null && day.maxWindSpeed >= 60)
      || (day.waveHeightMax !== null && day.waveHeightMax >= 3)
      || (day.maxTemperature !== null && day.maxTemperature >= 40)
      || (day.pm25 !== null && day.pm25 >= 55)
      || (day.aqi !== null && day.aqi >= 151)) return 3;
    if ((day.precipitationProbability !== null && day.precipitationProbability >= 50)
      || (day.precipitation !== null && day.precipitation >= 10)
      || (day.weatherCode !== null && day.weatherCode >= 51 && day.weatherCode < 95)
      || (day.maxWindSpeed !== null && day.maxWindSpeed >= 35)
      || (day.waveHeightMax !== null && day.waveHeightMax >= 2)
      || (day.maxTemperature !== null && day.maxTemperature >= 35)
      || (day.pm25 !== null && day.pm25 > 15)
      || (day.aqi !== null && day.aqi > 50)) return 2;
    return 1;
  };
  const highestRiskScore = Math.max(0, ...tripForecastDays.map(dayRiskScore));
  const highestRiskDates = tripForecastDays
    .filter((day) => dayRiskScore(day) === highestRiskScore)
    .map((day) => formatTripDateLabel(day.date));
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
  const nearbyAttractions = locationOrigin
    ? [...filteredAttractions]
        .filter((attraction) => attraction.distanceKm !== undefined && Number.isFinite(attraction.distanceKm))
        .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
    : [];
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
  const regionalAirQuality = regionalAlert?.aqi !== null && regionalAlert?.aqi !== undefined
    ? classifyAqi(regionalAlert.aqi, regionalAlert.pm25)
    : null;
  const hasRegionalHeavyRain = regionalAlert ? hasHeavyRain(regionalAlert) : false;
  const hasRegionalFloodRisk = regionalAlert ? hasHighFloodRisk(regionalAlert) : false;
  const activeRegionalAlerts = regionalAlert
    ? [
        hasRegionalHeavyRain && {
          icon: CloudRain,
          title: hasRegionalFloodRisk ? 'ฝนหนัก เสี่ยงน้ำท่วมฉับพลัน/น้ำป่าไหลหลาก' : 'แจ้งเตือนฝนตกหนัก',
          detail: `ฝนขณะนี้ ${regionalAlert.currentRain?.toFixed(1) ?? '—'} มม. · คาดการณ์สูงสุด 3 ชม. ${regionalAlert.nextThreeHoursRain?.toFixed(1) ?? '—'} มม.`,
        },
        regionalAlert.rainProbability !== null
          && regionalAlert.rainProbability >= 70
          && !hasRegionalHeavyRain && {
            icon: CloudRain,
            title: 'คาดการณ์มีโอกาสฝนสูง',
            detail: `โอกาสฝนใน 3 ชม. ${Math.round(regionalAlert.rainProbability)}% · ฝนสูงสุด ${regionalAlert.nextThreeHoursRain?.toFixed(1) ?? '—'} มม.`,
          },
        hasRegionalFloodRisk && {
          icon: Waves,
          title: 'คาดการณ์พื้นที่เสี่ยงน้ำท่วม',
          detail: `ฝนสูงสุด ${regionalAlert.nextThreeDaysRain?.toFixed(1) ?? '—'} มม./วัน${
            regionalAlert.riverDischarge
              ? ` · คาดการณ์ปริมาณน้ำไหล ${regionalAlert.riverDischarge[0].toFixed(1)} ม³/วินาที`
              : ''
          }`,
        },
        hasHighPm25(regionalAlert) && {
          icon: Activity,
          title: 'แจ้งเตือนฝุ่น',
          detail: `PM2.5 ${regionalAlert.pm25?.toFixed(1) ?? '—'} µg/m³`,
        },
        regionalAirQuality?.level === 'warning' && !hasHighPm25(regionalAlert) && {
          icon: Activity,
          title: 'คุณภาพอากาศควรระวัง',
          detail: `PM2.5 ${regionalAlert.pm25?.toFixed(1) ?? '—'} µg/m³ · AQI ${regionalAlert.aqi ?? '—'}`,
        },
        typeof regionalAlert.temperature === 'number' && regionalAlert.temperature >= 35 && {
          icon: Thermometer,
          title: 'แจ้งเตือนอากาศร้อนจัด',
          detail: `${regionalAlert.temperature.toFixed(1)}°C`,
        },
        typeof regionalAlert.windGusts === 'number' && regionalAlert.windGusts >= 60 && {
          icon: Wind,
          title: 'แจ้งเตือนลมแรง',
          detail: `ลมกระโชก ${regionalAlert.windGusts.toFixed(0)} กม./ชม.`,
        },
        typeof regionalAlert.weatherCode === 'number' && regionalAlert.weatherCode >= 95 && {
          icon: CloudLightning,
          title: 'แจ้งเตือนพายุฝนฟ้าคะนอง',
          detail: `ลม ${regionalAlert.windSpeed?.toFixed(0) ?? '—'} กม./ชม.`,
        },
      ].filter((alert): alert is { icon: LucideIcon; title: string; detail: string } => Boolean(alert))
    : [];
  const regionalAlertHasIssues = activeRegionalAlerts.length > 0
    || Boolean(regionalAlert?.unavailableSources?.length)
    || regionalAirQuality?.level === 'warning'
    || regionalAirQuality?.level === 'danger';
  const regionalAlertIsDanger = regionalAirQuality?.level === 'danger'
    || hasRegionalHeavyRain
    || hasRegionalFloodRisk;
  const alertCardColors = regionalAlertIsDanger
    ? { card: 'border-red-500 bg-red-50', icon: 'bg-red-500', text: 'text-red-800', detail: 'text-red-700', badge: 'bg-red-500', advice: 'bg-red-100 text-red-800' }
    : regionalAlertHasIssues
      ? { card: 'border-orange-400 bg-orange-50', icon: 'bg-orange-400', text: 'text-orange-800', detail: 'text-orange-700', badge: 'bg-orange-400', advice: 'bg-orange-100 text-orange-800' }
      : { card: 'border-green-500 bg-green-50', icon: 'bg-green-500', text: 'text-green-800', detail: 'text-green-700', badge: 'bg-green-500', advice: 'bg-green-100 text-green-800' };
  const CurrentWeatherIcon = !regionalAlert?.weatherCode
    ? Cloud
    : regionalAlert.weatherCode >= 95
      ? CloudLightning
      : [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(regionalAlert.weatherCode)
        ? CloudRain
        : regionalAlert.weatherCode === 0
          ? Sun
          : Cloud;
  const currentWeatherCard = (
    <section className="rounded-2xl border border-white/70 bg-white/95 p-4 text-slate-700 shadow-lg backdrop-blur-md">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <MapPinned className="h-4 w-4 shrink-0 text-[#1F2E7A]" />
          <h2 className="truncate text-xs font-bold text-[#1F2E7A]">
            {alertLocation ? `จังหวัด${alertLocation.province} ตอนนี้` : 'สภาพอากาศตำแหน่งปัจจุบัน'}
          </h2>
        </div>
        <CurrentWeatherIcon className={`h-6 w-6 shrink-0 text-sky-600 ${regionalAlertLoading && !regionalAlert ? 'animate-pulse' : ''}`} aria-hidden="true" />
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-3xl font-black leading-none text-[#1F2E7A]">
          {regionalAlert?.temperature != null
            ? `${regionalAlert.temperature.toFixed(1)}°C`
            : regionalAlertLoading ? '…' : '—'}
        </p>
        <p className="text-right text-xs font-medium text-slate-600">
          {regionalAlert?.weatherDescription || (regionalAlertLoading ? 'กำลังโหลดข้อมูล' : 'ไม่มีข้อมูลสภาพอากาศ')}
        </p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-slate-100 pt-3 text-[11px] text-slate-600">
        <p className="inline-flex items-center gap-1.5"><CloudRain className="h-3.5 w-3.5 text-sky-600" />ฝน {regionalAlert?.rainProbability != null ? `${Math.round(regionalAlert.rainProbability)}%` : '—'}</p>
        <p className="inline-flex items-center gap-1.5"><Wind className="h-3.5 w-3.5 text-sky-600" />ลม {regionalAlert?.windSpeed != null ? `${Math.round(regionalAlert.windSpeed)} กม./ชม.` : '—'}</p>
        <p className="inline-flex items-center gap-1.5"><Droplets className="h-3.5 w-3.5 text-sky-600" />ความชื้น {regionalAlert?.humidity != null ? `${Math.round(regionalAlert.humidity)}%` : '—'}</p>
        <p className="inline-flex items-center gap-1.5"><Activity className="h-3.5 w-3.5 text-sky-600" />PM2.5 {regionalAlert?.pm25 != null ? `${regionalAlert.pm25.toFixed(1)} µg/m³` : '—'}</p>
      </div>
      {regionalAlert?.updatedAt && (
        <p className="mt-2 text-right text-[10px] text-slate-400">
          อัปเดต {new Date(regionalAlert.updatedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </section>
  );

  const toggleAttractionFavorite = (attraction: (typeof filteredAttractions)[number]) => {
    const isSaved = favoriteIds.includes(attraction.key);
    if (isSaved) {
      removeFavoritePlace(attraction.key);
      setFavoriteIds((current) => current.filter((key) => key !== attraction.key));
      return;
    }
    const route = `/attraction/${attraction.id}`;
    const placeState = {
      title: attraction.title,
      location: attraction.location,
      province: attraction.province,
      category: attraction.category,
      description: attraction.description,
      rating: attraction.rating,
      images: attraction.images,
      lat: attraction.latitude !== undefined ? String(attraction.latitude) : undefined,
      lon: attraction.longitude !== undefined ? String(attraction.longitude) : undefined,
      openingHours: attraction.openingHours,
      recommendedTime: attraction.recommendedTime,
      entranceFee: attraction.entranceFee,
      reviewCount: attraction.reviewCount,
      travelCaution: attraction.travelCaution,
      favoriteKey: attraction.key,
    };
    saveFavoritePlace({
      key: attraction.key,
      title: attraction.title,
      location: attraction.location || '',
      province: attraction.province || '',
      category: attraction.category || 'สถานที่ท่องเที่ยว',
      description: attraction.description,
      images: attraction.images,
      rating: attraction.rating,
      reviewCount: attraction.reviewCount,
      latitude: attraction.latitude,
      longitude: attraction.longitude,
      route,
      placeState,
    });
    setFavoriteIds((current) => current.includes(attraction.key) ? current : [...current, attraction.key]);
  };

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      {/* Mobile Frame */}
      <div className="app-shell shadow-xl lg:shadow-none">
        {/* Header */}
        <header className="border-b border-slate-100 bg-white/95 px-4 pb-3 pt-12 shadow-sm backdrop-blur-sm sm:px-6 lg:px-8">
          <div className="flex w-full items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-[#1F2E7A]">
                  <MapPinned className="h-4 w-4" />
                </div>
                <h1 className="text-xl font-bold text-[#1F2E7A]">Thailand</h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 sm:flex">
                <LocateFixed className="h-3.5 w-3.5 text-[#1F2E7A]" />
                {alertLocation ? `จังหวัด${alertLocation.province}` : selectedProvince || 'เลือกจังหวัด'}
              </div>
              <Link
                to="/favorites"
                aria-label={`รายการโปรด ${favoriteIds.length} สถานที่`}
                className="relative flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-[#1F2E7A] transition hover:bg-slate-200"
              >
                <Heart className="h-4 w-4" />
                {favoriteIds.length > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                    {favoriteIds.length}
                  </span>
                )}
              </Link>
            </div>
          </div>

        </header>

        {/* Content */}
        <div className="app-content">
          <section className="relative z-30 mb-6 overflow-visible rounded-[28px] bg-slate-100 shadow-sm ring-1 ring-slate-200">
            <div className="relative min-h-[260px] rounded-[28px] bg-cover bg-center sm:min-h-[310px]" style={{ backgroundImage: `linear-gradient(90deg, rgba(10,37,86,0.72), rgba(12,74,110,0.28)), url(${displayedAttractions[0]?.images?.[0] || 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80'})` }}>
              <div className="relative z-30 flex min-h-[260px] flex-col justify-between p-4 sm:min-h-[310px] sm:p-6 lg:p-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
                    <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    {alertLocation
                      ? `จังหวัด${alertLocation.province}`
                      : selectedProvince || (gpsStatus === 'pending' ? 'กำลังระบุตำแหน่ง' : 'ยังไม่ระบุตำแหน่ง')}
                  </div>
                  <Link to="/favorites" className="hidden items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm sm:flex lg:hidden">
                    <Heart className="h-3.5 w-3.5" />
                    รายการโปรด
                  </Link>
                </div>

                <div className="max-w-xl lg:pr-72">
                  <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-blue-100">Let&apos;s Explore</p>
                  <h1 className="text-3xl font-black leading-tight text-white sm:text-5xl">เที่ยวไทย ไปได้ทุกที่</h1>
                  <p className="mt-3 max-w-md text-sm text-blue-50/90 sm:text-base">
                    ค้นหาสถานที่ท่องเที่ยวที่เหมาะกับการเดินทางของคุณ พร้อมข้อมูลสภาพอากาศและความปลอดภัยแบบเรียลไทม์
                  </p>
                </div>

                <PlaceSearchBox
                  value={searchQuery}
                  onChange={(value) => {
                    setSearchQuery(value);
                    setSelectedProvince('');
                    setSelectedPlace(null);
                    setSearchFlowMessage('');
                  }}
                  onPlaceSelect={handlePlaceSelect}
                  onExplore={handleExploreOption}
                  onSearch={handleTextSearch}
                  inputClassName="h-14 w-full rounded-2xl border border-white/70 bg-white px-5 pr-14 text-sm text-slate-700 shadow-lg outline-none ring-0 placeholder:text-slate-400 focus:border-white"
                  searchButtonClassName="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1F2E7A] p-0 text-white shadow-md transition hover:bg-[#162056]"
                  dropdownClassName="max-h-72 rounded-2xl py-1"
                  containerClassName="max-w-[760px]"
                />
              </div>

              <div className="absolute right-5 top-5 z-20 hidden w-72 lg:block">
                {currentWeatherCard}
              </div>
              <div className="absolute bottom-4 right-4 z-10 rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
                <span className="inline-flex items-center gap-1.5"><MapPinned className="h-3.5 w-3.5" />{alertLocation ? alertLocation.province : 'ประเทศไทย'}</span>
              </div>
            </div>
          </section>

          <section className="mb-5 lg:hidden">
            {currentWeatherCard}
          </section>

          <section id="trip-dates" aria-label="เลือกวันเดินทาง" className="mb-5 grid grid-cols-2 gap-3 scroll-mt-24">
            <DatePicker
              placeholder="เลือกวันเดินทาง"
              selected={departureDate}
              onSelect={(date) => {
                setDepartureDate(date);
                if (!date || (returnDate && returnDate < date)) setReturnDate(undefined);
                setSearchFlowMessage('');
              }}
              minDate={new Date()}
            />
            <DatePicker
              placeholder="เลือกวันกลับ"
              selected={returnDate}
              disabled={!departureDate}
              onSelect={(date) => {
                setReturnDate(date);
                setSearchFlowMessage('');
              }}
              minDate={departureDate || new Date()}
            />
            {searchFlowMessage && (
              <p role="status" className="col-span-2 -mt-1 text-sm text-rose-600">
                {searchFlowMessage}
              </p>
            )}
            <p className="col-span-2 -mt-1 text-xs leading-relaxed text-slate-500">
              {selectedPlace
                ? `เลือกวันเดินทางและวันกลับเพื่อประเมินพยากรณ์ของ${selectedPlace.title}ตามพิกัดสถานที่`
                : 'เลือกวันเดินทางและวันกลับได้เลย เมื่อเลือกสถานที่จากรายการ ระบบจะประเมินพยากรณ์ตามพิกัดให้อัตโนมัติ'}
            </p>
          </section>

          {selectedPlace && departureDate && returnDate && (
            isTripForecastModalOpen && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6">
                <button
                  type="button"
                  aria-label="ปิดหน้าต่างพยากรณ์อากาศ"
                  className="absolute inset-0 cursor-default bg-slate-950/55 backdrop-blur-sm"
                  onClick={() => setIsTripForecastModalOpen(false)}
                />
                <section
                  role="dialog"
                  aria-modal="true"
                  aria-live="polite"
                  aria-labelledby="trip-forecast-title"
                  className={`relative z-[1] max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[20px] border p-5 shadow-2xl sm:p-6 ${tripRiskStyle.panel}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 pr-10">
                    <div>
                      <h2 id="trip-forecast-title" className={`flex items-center gap-2 text-base font-bold sm:text-lg ${tripRiskStyle.text}`}>
                        {tripForecastLoading
                          ? <LoaderCircle className="h-5 w-5 animate-spin" />
                          : tripRiskLevel === 'danger'
                            ? <AlertTriangle className="h-5 w-5" />
                            : tripRiskLevel === 'warning'
                              ? <AlertCircle className="h-5 w-5" />
                              : <Cloud className="h-5 w-5" />}
                        สภาพอากาศและความเสี่ยงสำหรับวันเดินทาง
                      </h2>
                      <p className={`mt-1 text-sm ${tripRiskStyle.text}`}>
                        {selectedPlace.title} · {formatTripDateLabel(formatDateForRoute(departureDate))} – {formatTripDateLabel(formatDateForRoute(returnDate))}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${tripRiskStyle.badge}`}>
                      {tripForecastLoading ? 'กำลังตรวจสอบพยากรณ์…' : tripRiskStyle.label}
                    </span>
                  </div>
                  <button
                    type="button"
                    autoFocus
                    aria-label="ปิดหน้าต่างพยากรณ์อากาศ"
                    onClick={() => setIsTripForecastModalOpen(false)}
                    className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-slate-600 transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#1F2E7A]"
                  >
                    <X className="h-4 w-4" />
                  </button>

                  {tripForecastLoading && (
                    <p className={`mt-4 text-sm ${tripRiskStyle.text}`}>
                      กำลังโหลดข้อมูลพยากรณ์ตามพิกัดของสถานที่และวันที่เลือก
                    </p>
                  )}
                  {!tripForecastLoading && tripForecastError && (
                    <p role="status" className="mt-4 text-sm text-red-700">{tripForecastError}</p>
                  )}
                  {!tripForecastLoading && tripForecast && (
                    <>
                      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {(forecastMaxTemperature !== null || forecastMinTemperature !== null) && <div className="rounded-xl border border-white/80 bg-white/80 p-3">
                      <p className="flex items-center gap-1.5 text-xs text-slate-500"><Thermometer className="h-4 w-4" />อุณหภูมิสูงสุด</p>
                      {forecastMaxTemperature !== null && <p className="mt-1 font-semibold text-slate-800">{Math.round(forecastMaxTemperature)}°C</p>}
                      {forecastMinTemperature !== null && <p className="text-xs text-slate-500">ต่ำสุด {Math.round(forecastMinTemperature)}°C</p>}
                    </div>}
                    {(forecastRainProbability !== null || forecastRainTotal !== null) && <div className="rounded-xl border border-white/80 bg-white/80 p-3">
                      <p className="flex items-center gap-1.5 text-xs text-slate-500"><CloudRain className="h-4 w-4" />โอกาสฝนสูงสุด</p>
                      {forecastRainProbability !== null && <p className="mt-1 font-semibold text-slate-800">{Math.round(forecastRainProbability)}%</p>}
                      {forecastRainTotal !== null && <p className="text-xs text-slate-500">ฝนรวม {forecastRainTotal.toFixed(1)} มม.</p>}
                    </div>}
                    {(tripForecast.pm25Available || tripForecast.aqiAvailable) && (
                      <div className="rounded-xl border border-white/80 bg-white/80 p-3">
                        <p className="flex items-center gap-1.5 text-xs text-slate-500"><Activity className="h-4 w-4" />PM2.5 / AQI</p>
                        {tripForecast.pm25Available && forecastPm25 !== null && (
                          <p className="mt-1 font-semibold text-slate-800">PM2.5 {forecastPm25.toFixed(1)} µg/m³</p>
                        )}
                        {tripForecast.aqiAvailable && forecastAqi !== null && (
                          <p className="text-xs text-slate-600">AQI สูงสุด {Math.round(forecastAqi)}</p>
                        )}
                      </div>
                    )}
                    {forecastWind !== null && <div className="rounded-xl border border-white/80 bg-white/80 p-3">
                      <p className="flex items-center gap-1.5 text-xs text-slate-500"><Wind className="h-4 w-4" />ความเร็วลมสูงสุด</p>
                      <p className="mt-1 font-semibold text-slate-800">{Math.round(forecastWind)} กม./ชม.</p>
                    </div>}
                    {forecastWeatherCode !== null && <div className="rounded-xl border border-white/80 bg-white/80 p-3">
                      <p className="flex items-center gap-1.5 text-xs text-slate-500"><Cloud className="h-4 w-4" />สภาพอากาศโดยรวม</p>
                      <p className="mt-1 font-semibold text-slate-800">{describeWeatherCode(forecastWeatherCode)}</p>
                    </div>}
                    {isMarineTripDestination && (
                      tripForecast.waveHeightAvailable && forecastWaveHeight !== null && <div className="rounded-xl border border-white/80 bg-white/80 p-3">
                        <p className="flex items-center gap-1.5 text-xs text-slate-500"><Waves className="h-4 w-4" />คลื่นทะเลสูงสุด</p>
                        <p className="mt-1 font-semibold text-slate-800">{forecastWaveHeight.toFixed(1)} ม.</p>
                      </div>
                    )}
                      </div>
                      <div className={`mt-4 rounded-xl bg-white/70 p-3 text-sm ${tripRiskStyle.text}`}>
                        <p className="font-semibold">{tripRiskCopy}</p>
                        {!hasCompleteWeatherForecast && (
                          <p className="mt-1 text-xs">
                            พยากรณ์ครอบคลุม {tripForecastDays.length} จาก {expectedForecastDayCount} วัน จึงยังสรุปความเสี่ยงได้ไม่ครบทุกวัน
                          </p>
                        )}
                        {highestRiskScore > 1 && highestRiskDates.length > 0 && (
                          <p className="mt-1 text-xs">วันที่มีความเสี่ยงสูงสุด: {highestRiskDates.join(', ')}</p>
                        )}
                      </div>
                      <div className="mt-3 flex items-start gap-2 rounded-xl border border-slate-200 bg-white/80 p-3 text-xs leading-relaxed text-slate-600">
                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                        <p>
                          การประเมินนี้อิงพยากรณ์อากาศและคุณภาพอากาศตามพิกัด ไม่ใช่ประกาศยืนยันการเปิด-ปิดสถานที่ ถนน หรือรอบเรือ
                          โปรดตรวจสอบประกาศจากอุทยานและผู้ให้บริการก่อนออกเดินทาง
                        </p>
                      </div>
                    </>
                  )}
                </section>
              </div>
            )
          )}

          <aside className="mb-6 w-full">
            <section className={`rounded-[20px] border p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5 ${alertCardColors.card}`}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${alertCardColors.icon}`}>
                    {regionalAlertIsDanger
                      ? <AlertTriangle className="h-4 w-4" />
                      : <AlertCircle className="h-4 w-4" />}
                  </span>
                  <h2 className={`text-sm font-bold sm:text-base ${alertCardColors.text}`}>
                    สภาพอากาศและความเสี่ยง {alertLocation ? `จังหวัด${alertLocation.province}` : ''}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                    regionalAlertLoading && !regionalAlert
                      ? 'bg-slate-200 text-slate-600'
                      : regionalAlertError
                        ? 'bg-slate-200 text-slate-600'
                        : regionalAlertIsDanger
                          ? 'bg-red-600 text-white'
                          : regionalAlertHasIssues
                            ? 'bg-orange-500 text-white'
                            : 'bg-emerald-600 text-white'
                  }`}>
                    {regionalAlertLoading && !regionalAlert
                      ? 'กำลังตรวจสอบ'
                      : regionalAlertError
                        ? 'ข้อมูลไม่พร้อม'
                        : regionalAlertIsDanger
                          ? 'ความเสี่ยงสูง'
                          : regionalAlertHasIssues
                            ? 'ควรระวัง'
                            : 'สถานการณ์ปกติ'}
                  </span>
                  {regionalAlert?.aqi != null && (
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold text-white ${alertCardColors.badge}`}>
                      AQI {regionalAlert.aqi}
                    </span>
                  )}
                </div>
              </div>
              {regionalAlertLoading && !regionalAlert ? (
                <p className="text-xs text-slate-600">กำลังตรวจสอบข้อมูลล่าสุด…</p>
              ) : regionalAlertError ? (
                <p className="text-xs leading-relaxed text-orange-800">{regionalAlertError}</p>
              ) : activeRegionalAlerts.length > 0 ? (
                <div className="space-y-2">
                  {activeRegionalAlerts.map((alert) => (
                    <div key={alert.title} className={`flex items-start gap-2 text-xs ${alertCardColors.text}`}>
                      <alert.icon className="mt-0.5 h-4 w-4 shrink-0" />
                      <p><span className="font-semibold">{alert.title}</span><span className="ml-1">{alert.detail}</span></p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={`text-xs leading-relaxed ${alertCardColors.text}`}>
                  {regionalAlert?.unavailableSources?.length
                    ? `ไม่สามารถตรวจสอบ${regionalAlert.unavailableSources.join(' และ ')}ได้`
                      : 'สถานการณ์ปกติ เหมาะกับการเดินทาง'}
                </p>
              )}
              {regionalAlert && (
                <div className={`mt-3 rounded-xl p-3 text-xs leading-relaxed sm:text-sm ${alertCardColors.advice}`}>
                  {hasRegionalHeavyRain || hasRegionalFloodRisk
                      ? 'คำแนะนำ: หลีกเลี่ยงพื้นที่ลุ่มต่ำ ริมลำธาร และพื้นที่ลาดชันเมื่อมีฝนหนัก ติดตามประกาศจากหน่วยงานในพื้นที่ และออกจากบริเวณทันทีหากระดับน้ำเพิ่มสูง'
                      : regionalAirQuality?.level === 'warning' || regionalAirQuality?.level === 'danger'
                        ? 'คำแนะนำ: ลดกิจกรรมกลางแจ้ง สวมหน้ากากที่เหมาะสม และติดตามคุณภาพอากาศก่อนเดินทาง'
                        : 'คำแนะนำ: ยังไม่พบสัญญาณอากาศรุนแรงจากข้อมูลที่ตรวจสอบได้ โปรดติดตามประกาศในพื้นที่'}
                </div>
              )}
              {regionalAlert && (
                <p className={`mt-3 border-t border-current/10 pt-2 text-[10px] leading-relaxed ${alertCardColors.detail}`}>
                  ประเมินจากพยากรณ์ฝนและข้อมูลคาดการณ์น้ำ ไม่ใช่ประกาศเตือนภัยจากหน่วยงาน
                  {regionalAlert.updatedAt && <> · อัปเดต {new Date(regionalAlert.updatedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</>}
                </p>
              )}
            </section>
          </aside>

          <section className="mb-5">
            <div className="mb-2">
              <h2 className="text-base font-bold text-[#1F2E7A]">คุณอยากเที่ยวแบบไหน?</h2>
              <p className="text-xs text-slate-500">เลือกประเภทสถานที่ที่คุณสนใจ</p>
            </div>
            <div className="grid grid-cols-5 gap-2 sm:flex sm:gap-3">
              {tourismCategories.map((category, index) => {
                const categoryIcons = [Compass, Trees, Waves, Mountain, Landmark];
                const categoryColors = [
                  'bg-blue-50 text-blue-700',
                  'bg-emerald-50 text-emerald-700',
                  'bg-sky-50 text-sky-700',
                  'bg-orange-50 text-orange-700',
                  'bg-violet-50 text-violet-700',
                ];
                const CategoryIcon = categoryIcons[index];
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setSelectedCategory((current) => current === category ? 'ทั้งหมด' : category)}
                    aria-pressed={selectedCategory === category}
                    className={`flex min-w-0 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-xs transition hover:-translate-y-0.5 ${selectedCategory === category ? 'ring-2 ring-[#1F2E7A]' : ''} ${categoryColors[index]}`}
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80"><CategoryIcon className="h-5 w-5" /></span>
                    <span className="font-semibold">{category}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="mb-6">
          <section id="recommended-attractions" className="min-w-0 scroll-mt-24">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-[#1F2E7A]">สถานที่แนะนำสำหรับคุณ</h2>
                <p className="mt-1 text-xs text-slate-500">พบ {displayedAttractions.length} สถานที่</p>
              </div>
              <button type="button" className="text-sm font-medium text-[#1F2E7A] hover:text-blue-700">ดูทั้งหมด →</button>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {displayedAttractions.slice(0, 4).map((attraction) => (
                <AttractionCard
                  key={attraction.key}
                  attraction={attraction}
                  isFavorite={favoriteIds.includes(attraction.key)}
                  onToggleFavorite={() => toggleAttractionFavorite(attraction)}
                  variant="recommended"
                />
              ))}
            </div>
          </section>
          </div>

          <section className="mb-10 border-t border-slate-100 pt-8">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-[#1F2E7A] sm:text-2xl">สถานที่ใกล้เคียง</h2>
                <p className="mt-1 text-sm text-slate-500">สถานที่ท่องเที่ยวใกล้ตำแหน่งปัจจุบันของคุณ</p>
              </div>
              {nearbyAttractions.length > 4 && (
                <button
                  type="button"
                  onClick={() => setShowAllNearby((current) => !current)}
                  className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-[#1F2E7A] transition-colors hover:bg-blue-50"
                >
                  {showAllNearby ? 'ดูน้อยลง ↑' : 'ดูทั้งหมด →'}
                </button>
              )}
            </div>
            {nearbyAttractions.length > 0 ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {(showAllNearby ? nearbyAttractions : nearbyAttractions.slice(0, 4)).map((attraction) => (
                  <AttractionCard
                    key={`nearby-${attraction.key}`}
                    attraction={attraction}
                    isFavorite={favoriteIds.includes(attraction.key)}
                    onToggleFavorite={() => toggleAttractionFavorite(attraction)}
                    variant="nearby"
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
                <MapPinned className="mx-auto h-6 w-6 text-slate-400" />
                <p className="mt-2 text-sm font-medium text-slate-700">ยังไม่มีข้อมูลสถานที่ใกล้เคียง</p>
                <p className="mt-1 text-xs text-slate-500">อนุญาตการเข้าถึงตำแหน่งเพื่อค้นหาสถานที่รอบตัวคุณ</p>
              </div>
            )}
          </section>

          <section
            className="relative mb-2 min-h-52 overflow-hidden rounded-2xl bg-cover bg-center px-6 py-8 text-white shadow-[0_8px_28px_rgba(31,46,122,0.18)] sm:px-10 sm:py-10"
            style={{
              backgroundImage: `linear-gradient(90deg, rgba(8,31,78,.84) 0%, rgba(10,65,125,.6) 55%, rgba(10,65,125,.16) 100%), url("${displayedAttractions[0]?.images[0] || filteredAttractions[0]?.images[0] || ''}")`,
            }}
          >
            <div className="relative z-10 flex min-h-36 flex-wrap items-center justify-between gap-6">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-amber-300" />
                  <h2 className="text-xl font-bold sm:text-2xl">สถานที่น่าไปช่วงนี้</h2>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-blue-50 sm:text-base">
                  {displayedAttractions[0] || filteredAttractions[0]
                    ? `รวมไอเดียเที่ยวไทยให้ทุกทริปของคุณพิเศษยิ่งขึ้น เริ่มต้นที่${(displayedAttractions[0] || filteredAttractions[0]).title}${(displayedAttractions[0] || filteredAttractions[0]).province ? ` จังหวัด${(displayedAttractions[0] || filteredAttractions[0]).province}` : ''}`
                    : 'รวมไอเดียเที่ยวไทยให้ทุกทริปของคุณพิเศษยิ่งขึ้น'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDiscoveryCategory('สถานที่ยอดนิยม');
                  setSelectedCategory('ทั้งหมด');
                  document.getElementById('recommended-attractions')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-[#1F2E7A] shadow-lg transition-all hover:-translate-y-0.5 hover:bg-blue-50"
              >
                ดูสถานที่แนะนำ →
              </button>
            </div>
          </section>
        </div>
      </div>
      <footer className="mx-auto max-w-7xl px-4 py-4 text-center text-xs text-slate-500">
        © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap contributors</a>
      </footer>
    </div>
  );
}
