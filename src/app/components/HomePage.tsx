import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import { Search, AlertCircle, AlertTriangle, Wind, Activity, Heart, MapPin, MapPinned, Banknote, Navigation, Compass, Trees, Waves, Mountain, Landmark, Sun, Cloud, CloudRain, Droplets, Thermometer, CloudLightning, LoaderCircle, X, Info, History, Coffee, LayoutGrid, Utensils, Eye, Flame, ChevronLeft, ChevronRight, Leaf, type LucideIcon } from 'lucide-react';
import DatePicker from './DatePicker';
import { PlaceSearchBox } from './PlaceSearchBox';
import AttractionCard from './AttractionCard';
import { useUserLocation } from '../context/UserLocationContext';
import { THAI_PROVINCES } from '../data/provinces';
import type { PlaceSearchOption } from '../hooks/usePlaceSearch';
import { getPlacePhotoUrl, searchPlaces, type PlaceDetails, type PlaceSearchResult } from '../services/placesApi';
import { getFavoriteIds, removeFavoritePlace, saveFavoritePlace, subscribeToFavorites } from '../utils/favorites';
import { fetchTatAttractions, type TatAttraction } from '../utils/tatApi';
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
import { describeWeatherCode, fetchTripForecast, getForecastLastDate, MAX_FORECAST_DAYS, type TripForecast } from '../utils/tripForecast';
import { fetchPlaceImages } from '../utils/placeImages';
import { fetchWindyWeather, type WindyWeather } from '../utils/windyApi';

const tourismCategories = ['ทั้งหมด', 'ทะเล', 'ภูเขา', 'ธรรมชาติ', 'น้ำตก', 'วัด', 'ประวัติศาสตร์', 'คาเฟ่', 'จุดชมวิว', 'อาหาร'] as const;
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
  const candidate = (apiProvince && apiProvince !== 'ประเทศไทย' ? apiProvince : undefined)
    || THAI_PROVINCES.find((province) => location.includes(province));
  return candidate?.replace(/^จังหวัด/, '') || '';
}

function getTourismCategory(type: string) {
  const value = type.toLocaleLowerCase('th');
  if (/ทะเล|ชายหาด|หาด|เกาะ|อ่าว|beach|island|bay/.test(value)) return 'ทะเล';
  if (/ภูเขา|ดอย|ยอดเขา|mountain|peak/.test(value)) return 'ภูเขา';
  if (/น้ำตก|waterfall/.test(value)) return 'น้ำตก';
  if (/ประวัติ|โบราณ|พิพิธภัณฑ์|historic|museum|archaeological/.test(value)) return 'ประวัติศาสตร์';
  if (/วัด|พระ|ศาสน|temple|worship/.test(value)) return 'วัด';
  if (/คาเฟ่|ร้านกาแฟ|cafe|coffee/.test(value)) return 'คาเฟ่';
  if (/จุดชมวิว|จุดชมทิวทัศน์|viewpoint|scenic overlook|lookout/.test(value)) return 'จุดชมวิว';
  if (/อาหาร|ร้านอาหาร|restaurant|food|dining/.test(value)) return 'อาหาร';
  if (/อุทยาน|ป่า|สวน|park|forest|nature|reserve/.test(value)) return 'ธรรมชาติ';
  return 'สถานที่ท่องเที่ยว';
}

type AirLevel = 'safe' | 'warning' | 'danger';

function classifyAqi(aqi: number | null, pm25: number | null): { level: AirLevel; status: string } {
  if ((aqi !== null && aqi > 200) || (pm25 !== null && pm25 > 37.5)) return { level: 'danger', status: 'อันตราย' };
  if ((aqi !== null && aqi > 100) || (pm25 !== null && pm25 > 15)) return { level: 'warning', status: 'ไม่ดีต่อสุขภาพ' };
  if (aqi !== null && aqi <= 50 && (pm25 === null || pm25 <= 15)) return { level: 'safe', status: 'ดีมาก' };
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
  const latestForecastDate = getForecastLastDate();
  const [departureDate, setDepartureDate] = useState<Date | undefined>(undefined);
  const [returnDate, setReturnDate] = useState<Date | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null);
  const [searchFlowMessage, setSearchFlowMessage] = useState('');
  const [tripForecast, setTripForecast] = useState<TripForecast | null>(null);
  const [tripForecastLoading, setTripForecastLoading] = useState(false);
  const [tripForecastError, setTripForecastError] = useState('');
  const [tripTemperatureWeather, setTripTemperatureWeather] = useState<{ placeKey: string; weather: WindyWeather } | null>(null);
  const [isTripForecastModalOpen, setIsTripForecastModalOpen] = useState(false);
  const [tatPlaces, setTatPlaces] = useState<TatAttraction[]>([]);
  const [photonPlaces, setPhotonPlaces] = useState<PlaceSearchResult[]>([]);
  const [tatPlacesLoaded, setTatPlacesLoaded] = useState(false);
  const [attractionsLoading, setAttractionsLoading] = useState(true);
  const [attractionsError, setAttractionsError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TourismCategory>('ทั้งหมด');
  const { coordinates: gpsCoordinates, status: gpsStatus } = useUserLocation();
  const [selectedProvince, setSelectedProvince] = useState('');
  const [alertLocation, setAlertLocation] = useState<AlertLocation | null>(null);
  const [regionalAlert, setRegionalAlert] = useState<RegionalAlertData | null>(null);
  const [regionalAlertLoading, setRegionalAlertLoading] = useState(true);
  const [regionalAlertError, setRegionalAlertError] = useState('');
  const [heroRegionalAlert, setHeroRegionalAlert] = useState<RegionalAlertData | null>(null);
  const [heroRegionalAlertLoading, setHeroRegionalAlertLoading] = useState(false);
  const [heroRegionalAlertError, setHeroRegionalAlertError] = useState('');
  const [temperatureWeather, setTemperatureWeather] = useState<WindyWeather | null>(null);
  const [temperatureWeatherLoading, setTemperatureWeatherLoading] = useState(false);
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
  const [heroImage, setHeroImage] = useState('');
  const [destinationImages, setDestinationImages] = useState<Record<string, string>>({});
  const recommendedTrackRef = useRef<HTMLDivElement>(null);
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
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setTripForecastError(error instanceof Error ? error.message : 'ไม่สามารถโหลดพยากรณ์สำหรับวันที่เลือกได้');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setTripForecastLoading(false);
      });

    return () => controller.abort();
  }, [selectedPlace, departureDate, returnDate, isMarineTripDestination]);

  useEffect(() => {
    if (!selectedPlace || !departureDate || !returnDate) {
      setTripTemperatureWeather(null);
      return;
    }

    const latitude = Number(selectedPlace.lat);
    const longitude = Number(selectedPlace.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setTripTemperatureWeather(null);
      return;
    }

    let active = true;
    fetchWindyWeather(latitude, longitude)
      .then((weather) => {
        if (active) setTripTemperatureWeather({ placeKey: selectedPlace.key, weather });
      })
      .catch(() => {
        if (active) setTripTemperatureWeather(null);
      });
    return () => {
      active = false;
    };
  }, [selectedPlace, departureDate, returnDate]);

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
        if (selectedProvince) {
          const resolved = await findAlertLocation(`${selectedProvince}, Thailand`);
          location = { ...resolved, province: selectedProvince };
        } else if (gpsStatus === 'available' && gpsCoordinates) {
          const province = await getProvinceForCoordinates(gpsCoordinates.latitude, gpsCoordinates.longitude);
          location = { ...gpsCoordinates, province };
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
    let active = true;
    fetchTatAttractions(50)
      .then((places) => {
        if (active) setTatPlaces(places);
      })
      .catch(() => {
        if (active) setTatPlaces([]);
      })
      .finally(() => {
        if (active) setTatPlacesLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!tatPlacesLoaded) return;
    if (tatPlaces.length > 0) {
      setPhotonPlaces([]);
      setAttractionsError('');
      setAttractionsLoading(false);
      return;
    }

    const controller = new AbortController();
    const categoryQueries: Record<TourismCategory, string[]> = {
      ทั้งหมด: ['beach', 'waterfall', 'mountain', 'temple', 'national park', 'historic site', 'cafe', 'viewpoint', 'restaurant'],
      ทะเล: ['beach'],
      ภูเขา: ['mountain'],
      ธรรมชาติ: ['national park', 'forest', 'nature reserve'],
      น้ำตก: ['waterfall'],
      วัด: ['temple'],
      ประวัติศาสตร์: ['historic site', 'museum', 'archaeological site'],
      คาเฟ่: ['cafe'],
      จุดชมวิว: ['viewpoint'],
      อาหาร: ['restaurant'],
    };
    setAttractionsLoading(true);
    setAttractionsError('');
    const queries = categoryQueries[selectedCategory];
    Promise.allSettled(queries.map((query) => searchPlaces(query, controller.signal)))
      .then((results) => {
        if (controller.signal.aborted) return;
        const successful = results.filter(
          (result): result is PromiseFulfilledResult<PlaceSearchResult[]> => result.status === 'fulfilled',
        );
        const places = [...new Map(successful.flatMap((result) => result.value).map((place) => [place.id, place])).values()];
        setPhotonPlaces(places);
        if (places.length === 0 && successful.length === 0) {
          const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
          throw failure?.reason || new Error('ไม่สามารถโหลดสถานที่แนะนำได้');
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setPhotonPlaces([]);
        setAttractionsError(error instanceof Error ? error.message : 'ไม่สามารถโหลดสถานที่แนะนำได้');
      })
      .finally(() => {
        if (!controller.signal.aborted) setAttractionsLoading(false);
      });
    return () => controller.abort();
  }, [selectedCategory, tatPlaces.length, tatPlacesLoaded]);

  const attractions = [
    {
      id: 3,
      title: 'วัดพระศรีรัตนศาสดาราม',
      category: 'วัด' as const,
      latitude: 13.7516,
      longitude: 100.4927,
      description: 'วัดสำคัญในพระบรมมหาราชวัง โดดเด่นด้วยสถาปัตยกรรมไทยและพระแก้วมรกต ใจกลางกรุงเทพมหานคร',
      location: 'ถนนหน้าพระลาน แขวงพระบรมมหาราชวัง เขตพระนคร กรุงเทพมหานคร 10200',
      images: [],
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
  const apiAttractions = tatPlaces.length > 0
    ? tatPlaces.map((place, index) => ({
        id: place.id ?? `tat-${index}`,
        key: `tat-${place.id ?? index}`,
        routeId: undefined,
        title: place.name,
        province: getProvinceName(place.location || '', place.province),
        sourceType: place.type,
        category: getTourismCategory(place.type),
        latitude: place.latitude,
        longitude: place.longitude,
        description: place.description || '',
        location: place.location || '',
        images: place.images,
        rating: place.rating,
        reviewCount: place.reviewCount,
        entranceFee: place.entranceFee,
        recommendedTime: place.recommendedTime,
        openingHours: place.openingHours,
        travelCaution: place.travelCaution,
        suitableFor: place.suitableFor || [],
        createdAt: place.createdAt,
      }))
    : photonPlaces.map((place) => ({
        id: place.id,
        key: `place-${place.id}`,
        routeId: `place-${place.id}`,
        title: place.name,
        province: getProvinceName(place.address, place.province),
        sourceType: place.types?.[0] || '',
        category: getTourismCategory(`${place.osmKey || ''}:${place.osmValue || ''} ${place.types?.join(' ') || ''}`),
        latitude: place.latitude,
        longitude: place.longitude,
        description: '',
        location: place.address,
        images: [] as string[],
        rating: place.rating,
        reviewCount: place.userRatingCount,
        entranceFee: undefined,
        recommendedTime: undefined,
        openingHours: undefined,
        travelCaution: undefined,
        suitableFor: [] as string[],
        createdAt: undefined,
      }));
  const sourceAttractions = apiAttractions;

  const handlePlaceSelect = (place: PlaceDetails) => {
    const province = getProvinceName(place.address, place.province);
    const category = getTourismCategory(place.types?.join(' ') || '');
    const images = place.photos.map((photo) => getPlacePhotoUrl(photo)).filter((url): url is string => Boolean(url));
    const selected: PlaceSuggestion = {
      key: `place-${place.id}`,
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
      favoriteKey: `place-${place.id}`,
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

  const locationOrigin = gpsCoordinates;
  const activeTripWeather = tripTemperatureWeather && tripTemperatureWeather.placeKey === selectedPlace?.key
    ? tripTemperatureWeather.weather
    : null;
  const windyTemperaturesByDate = new Map(
    activeTripWeather?.source === 'Windy'
      ? activeTripWeather.dailyTemperatures.map(({ date, maxTemperature }) => [date, maxTemperature])
      : [],
  );
  const tripForecastDays = (tripForecast?.days || []).map((day) => ({
    ...day,
    maxTemperature: windyTemperaturesByDate.get(day.date) ?? day.maxTemperature,
  }));
  const maxForecastValue = (values: Array<number | null>) => {
    const valid = values.filter((value): value is number => value !== null && Number.isFinite(value));
    return valid.length ? Math.max(...valid) : null;
  };
  const minForecastValue = (values: Array<number | null>) => {
    const valid = values.filter((value): value is number => value !== null && Number.isFinite(value));
    return valid.length ? Math.min(...valid) : null;
  };
  const forecastMaxTemperature = maxForecastValue(tripForecastDays.map((day) => day.maxTemperature));
  const windyTemperatureDayCount = tripForecastDays.filter((day) => windyTemperaturesByDate.has(day.date)).length;
  const forecastTemperatureSource = windyTemperatureDayCount === tripForecastDays.length && windyTemperatureDayCount > 0
    ? 'Windy'
    : windyTemperatureDayCount > 0
      ? 'Windy (บางวัน) และ Open-Meteo'
      : 'Open-Meteo';
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
      || `${attraction.title} ${attraction.location} ${attraction.province} ${attraction.category} ${attraction.description}`.toLocaleLowerCase('th').includes(searchQuery.trim().toLocaleLowerCase('th')))
    .map((attraction) => ({
      ...attraction,
      distanceKm: locationOrigin && attraction.latitude !== undefined && attraction.longitude !== undefined
        ? distanceBetween(attraction.latitude, attraction.longitude, locationOrigin)
        : undefined,
    }));
  const selectedPlaceAttraction = selectedPlace
    ? {
        id: -1,
        key: selectedPlace.key,
        routeId: selectedPlace.routeId,
        title: selectedPlace.title,
        province: selectedPlace.province,
        sourceType: selectedPlace.category,
        category: selectedPlace.category,
        latitude: selectedPlace.lat ? Number(selectedPlace.lat) : undefined,
        longitude: selectedPlace.lon ? Number(selectedPlace.lon) : undefined,
        description: selectedPlace.description || '',
        location: selectedPlace.location,
        images: selectedPlace.images || [],
        rating: selectedPlace.rating,
        reviewCount: selectedPlace.reviewCount,
        entranceFee: selectedPlace.entranceFee,
        recommendedTime: selectedPlace.recommendedTime,
        openingHours: selectedPlace.openingHours,
        travelCaution: selectedPlace.travelCaution,
        suitableFor: [] as string[],
        createdAt: undefined,
        distanceKm: locationOrigin && selectedPlace.lat && selectedPlace.lon
          ? distanceBetween(Number(selectedPlace.lat), Number(selectedPlace.lon), locationOrigin)
          : undefined,
      }
    : null;
  const recommendationAttractions = selectedPlaceAttraction
    && (selectedCategory === 'ทั้งหมด' || selectedPlaceAttraction.category === selectedCategory)
    ? [selectedPlaceAttraction, ...filteredAttractions.filter((attraction) => attraction.key !== selectedPlaceAttraction.key)]
    : filteredAttractions;
  const displayedAttractions = [...recommendationAttractions];
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
  const recommendedAttractions = displayedAttractions.slice(0, 12);
  const recommendedKeys = new Set(
    recommendedAttractions
      .map((attraction) => attraction.key),
  );
  const nearbyAttractions = locationOrigin
    ? recommendationAttractions
        .filter((attraction) => attraction.distanceKm !== undefined
          && Number.isFinite(attraction.distanceKm)
          && !recommendedKeys.has(attraction.key))
        .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
    : [];
  const destinationGroups = new Map<string, { province: string; attraction: (typeof sourceAttractions)[number]; count: number }>();
  sourceAttractions.forEach((attraction) => {
    if (!attraction.province) return;
    const destination = destinationGroups.get(attraction.province);
    if (destination) {
      destination.count += 1;
      if (!destination.attraction.images?.[0] && attraction.images?.[0]) destination.attraction = attraction;
      return;
    }
    destinationGroups.set(attraction.province, { province: attraction.province, attraction, count: 1 });
  });
  useEffect(() => {
    let active = true;
    const destinations = [...destinationGroups.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
    Promise.all(destinations.map(async ({ province, attraction }) => {
      const image = attraction.images?.[0] || (
        await fetchPlaceImages(attraction.title, attraction.latitude, attraction.longitude)
      )[0] || '';
      return [province, image] as const;
    })).then((images) => {
      if (active) setDestinationImages(Object.fromEntries(images.filter(([, image]) => Boolean(image))));
    });
    return () => {
      active = false;
    };
  }, [tatPlaces, photonPlaces]);
  const popularDestinations = [...destinationGroups.values()]
    .filter(({ province, attraction }) => Boolean(attraction.images?.[0] || destinationImages[province]))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);
  const heroAttraction = selectedPlaceAttraction || displayedAttractions[0];
  const heroLatitude = heroAttraction?.latitude;
  const heroLongitude = heroAttraction?.longitude;

  useEffect(() => {
    const latitude = heroLatitude ?? alertLocation?.latitude;
    const longitude = heroLongitude ?? alertLocation?.longitude;
    if (latitude === undefined || longitude === undefined) {
      setTemperatureWeather(null);
      setTemperatureWeatherLoading(false);
      return;
    }

    let active = true;
    setTemperatureWeather(null);
    setTemperatureWeatherLoading(true);
    fetchWindyWeather(latitude, longitude)
      .then((weather) => {
        if (active) setTemperatureWeather(weather);
      })
      .catch(() => {
        if (active) setTemperatureWeather(null);
      })
      .finally(() => {
        if (active) setTemperatureWeatherLoading(false);
      });
    return () => {
      active = false;
    };
  }, [heroLatitude, heroLongitude, alertLocation?.latitude, alertLocation?.longitude]);

  useEffect(() => {
    const existingImage = heroAttraction?.images?.[0] || '';
    setHeroImage(existingImage);
    if (existingImage || !heroAttraction || heroLatitude === undefined || heroLongitude === undefined) return;

    let active = true;
    fetchPlaceImages(heroAttraction.title, heroLatitude, heroLongitude)
      .then((images) => {
        if (active) setHeroImage(images[0] || '');
      });
    return () => {
      active = false;
    };
  }, [heroAttraction?.key, heroAttraction?.title, heroAttraction?.images?.[0], heroLatitude, heroLongitude]);

  useEffect(() => {
    if (heroLatitude === undefined || heroLongitude === undefined) {
      setHeroRegionalAlert(null);
      setHeroRegionalAlertLoading(false);
      setHeroRegionalAlertError('');
      return;
    }

    let active = true;
    setHeroRegionalAlert(null);
    setHeroRegionalAlertLoading(true);
    setHeroRegionalAlertError('');
    fetchRegionalAlerts({ latitude: heroLatitude, longitude: heroLongitude })
      .then((data) => {
        if (active) setHeroRegionalAlert(data);
      })
      .catch(() => {
        if (active) setHeroRegionalAlertError('ไม่สามารถโหลดข้อมูลสภาพอากาศของสถานที่นี้ได้');
      })
      .finally(() => {
        if (active) setHeroRegionalAlertLoading(false);
      });
    return () => {
      active = false;
    };
  }, [heroAttraction?.key, heroLatitude, heroLongitude]);

  const displayedRegionalAlert = heroLatitude !== undefined && heroLongitude !== undefined
    ? heroRegionalAlert
    : regionalAlert;
  const displayedRegionalAlertLoading = heroLatitude !== undefined && heroLongitude !== undefined
    ? heroRegionalAlertLoading
    : regionalAlertLoading;
  const displayedRegionalAlertError = heroLatitude !== undefined && heroLongitude !== undefined
    ? heroRegionalAlertError
    : regionalAlertError;
  const regionalAirQuality = displayedRegionalAlert?.aqi != null || displayedRegionalAlert?.pm25 != null
    ? classifyAqi(displayedRegionalAlert?.aqi ?? null, displayedRegionalAlert?.pm25 ?? null)
    : null;
  const hasRegionalHeavyRain = displayedRegionalAlert ? hasHeavyRain(displayedRegionalAlert) : false;
  const hasRegionalFloodRisk = displayedRegionalAlert ? hasHighFloodRisk(displayedRegionalAlert) : false;
  const activeRegionalAlerts = displayedRegionalAlert
    ? [
        hasRegionalHeavyRain && {
          icon: CloudRain,
          title: hasRegionalFloodRisk ? 'ฝนหนัก เสี่ยงน้ำท่วมฉับพลัน/น้ำป่าไหลหลาก' : 'แจ้งเตือนฝนตกหนัก',
          detail: `ฝนขณะนี้ ${displayedRegionalAlert.currentRain?.toFixed(1) ?? '—'} มม. · คาดการณ์สูงสุด 3 ชม. ${displayedRegionalAlert.nextThreeHoursRain?.toFixed(1) ?? '—'} มม.`,
        },
        displayedRegionalAlert.rainProbability !== null
          && displayedRegionalAlert.rainProbability >= 70
          && !hasRegionalHeavyRain && {
            icon: CloudRain,
            title: 'คาดการณ์มีโอกาสฝนสูง',
            detail: `โอกาสฝนใน 3 ชม. ${Math.round(displayedRegionalAlert.rainProbability)}% · ฝนสูงสุด ${displayedRegionalAlert.nextThreeHoursRain?.toFixed(1) ?? '—'} มม.`,
          },
        hasRegionalFloodRisk && {
          icon: Waves,
          title: 'คาดการณ์พื้นที่เสี่ยงน้ำท่วม',
          detail: `ฝนสูงสุด ${displayedRegionalAlert.nextThreeDaysRain?.toFixed(1) ?? '—'} มม./วัน${
            displayedRegionalAlert.riverDischarge
              ? ` · คาดการณ์ปริมาณน้ำไหล ${displayedRegionalAlert.riverDischarge[0].toFixed(1)} ม³/วินาที`
              : ''
          }`,
        },
        hasHighPm25(displayedRegionalAlert) && {
          icon: Activity,
          title: 'แจ้งเตือนฝุ่น',
          detail: `PM2.5 ${displayedRegionalAlert.pm25?.toFixed(1) ?? '—'} µg/m³`,
        },
        regionalAirQuality?.level === 'warning' && !hasHighPm25(displayedRegionalAlert) && {
          icon: Activity,
          title: 'คุณภาพอากาศควรระวัง',
          detail: `PM2.5 ${displayedRegionalAlert.pm25?.toFixed(1) ?? '—'} µg/m³ · AQI ${displayedRegionalAlert.aqi ?? '—'}`,
        },
        typeof displayedRegionalAlert.temperature === 'number' && displayedRegionalAlert.temperature >= 35 && {
          icon: Thermometer,
          title: 'แจ้งเตือนอากาศร้อนจัด',
          detail: `${displayedRegionalAlert.temperature.toFixed(1)}°C`,
        },
        typeof displayedRegionalAlert.windGusts === 'number' && displayedRegionalAlert.windGusts >= 60 && {
          icon: Wind,
          title: 'แจ้งเตือนลมแรง',
          detail: `ลมกระโชก ${displayedRegionalAlert.windGusts.toFixed(0)} กม./ชม.`,
        },
        typeof displayedRegionalAlert.weatherCode === 'number' && displayedRegionalAlert.weatherCode >= 95 && {
          icon: CloudLightning,
          title: 'แจ้งเตือนพายุฝนฟ้าคะนอง',
          detail: `ลม ${displayedRegionalAlert.windSpeed?.toFixed(0) ?? '—'} กม./ชม.`,
        },
      ].filter((alert): alert is { icon: LucideIcon; title: string; detail: string } => Boolean(alert))
    : [];
  const regionalAlertHasIssues = activeRegionalAlerts.length > 0
    || Boolean(displayedRegionalAlert?.unavailableSources?.length)
    || regionalAirQuality?.level === 'warning'
    || regionalAirQuality?.level === 'danger';
  const regionalAlertIsDanger = regionalAirQuality?.level === 'danger'
    || hasRegionalHeavyRain
    || hasRegionalFloodRisk;
  const alertCardColors = regionalAlertIsDanger
    ? { card: 'border-red-500 bg-red-50', icon: 'bg-red-500', text: 'text-red-800', detail: 'text-red-700', badge: 'bg-red-500', advice: 'bg-red-100 text-red-800' }
    : regionalAlertHasIssues
      ? { card: 'border-amber-400 bg-amber-50', icon: 'bg-amber-400', text: 'text-amber-800', detail: 'text-amber-700', badge: 'bg-amber-400', advice: 'bg-amber-100 text-amber-800' }
      : displayedRegionalAlert
        ? { card: 'border-green-500 bg-green-50', icon: 'bg-green-500', text: 'text-green-800', detail: 'text-green-700', badge: 'bg-green-500', advice: 'bg-green-100 text-green-800' }
        : { card: 'border-slate-200 bg-slate-50', icon: 'bg-slate-500', text: 'text-slate-700', detail: 'text-slate-600', badge: 'bg-slate-500', advice: 'bg-slate-100 text-slate-700' };
  const CurrentWeatherIcon = !displayedRegionalAlert?.weatherCode
    ? Cloud
    : displayedRegionalAlert.weatherCode >= 95
      ? CloudLightning
      : [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(displayedRegionalAlert.weatherCode)
        ? CloudRain
        : displayedRegionalAlert.weatherCode === 0
          ? Sun
          : Cloud;
  const currentWeatherCard = (
    <section className={`w-full max-w-[320px] self-center overflow-hidden rounded-xl border p-3 text-slate-700 shadow-lg backdrop-blur-md lg:max-w-none lg:w-72 xl:absolute xl:right-8 xl:top-8 ${alertCardColors.card}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <MapPinned className={`h-3.5 w-3.5 shrink-0 ${alertCardColors.text}`} />
          <h2 className={`truncate text-[11px] font-bold ${alertCardColors.text}`}>
            {heroAttraction?.province
              ? `จังหวัด${heroAttraction.province} ตอนนี้`
              : alertLocation ? `จังหวัด${alertLocation.province} ตอนนี้` : 'สภาพอากาศตำแหน่งปัจจุบัน'}
          </h2>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[9px] font-bold text-white ${alertCardColors.icon}`}>
          {regionalAlertIsDanger ? <AlertTriangle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
          {displayedRegionalAlertLoading && !displayedRegionalAlert
            ? 'กำลังตรวจสอบ'
            : displayedRegionalAlertError || !displayedRegionalAlert
              ? 'ไม่มีข้อมูล'
              : regionalAlertIsDanger
                ? 'เสี่ยงสูง'
                : regionalAlertHasIssues ? 'ควรระวัง' : 'ปกติ'}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2.5">
        <CurrentWeatherIcon className={`h-7 w-7 shrink-0 text-sky-600 ${displayedRegionalAlertLoading && !displayedRegionalAlert ? 'animate-pulse' : ''}`} aria-hidden="true" />
        <p className={`text-2xl font-black leading-none ${alertCardColors.text}`}>
          {temperatureWeather?.currentTemperature != null
            ? `${temperatureWeather.currentTemperature}°C`
            : temperatureWeatherLoading ? '…' : 'ไม่มีข้อมูล'}
        </p>
        <div className="min-w-0 flex-1 text-right">
          <p className={`truncate text-[11px] font-medium ${alertCardColors.text}`}>
            {displayedRegionalAlert?.weatherDescription || (displayedRegionalAlertLoading ? 'กำลังโหลดข้อมูล' : 'ไม่มีข้อมูลสภาพอากาศ')}
          </p>
          <p className={`mt-0.5 text-[9px] ${alertCardColors.detail}`}>
            {temperatureWeather ? temperatureWeather.source : temperatureWeatherLoading ? 'กำลังโหลดอุณหภูมิ…' : 'ไม่มีข้อมูลอุณหภูมิ'}
          </p>
        </div>
      </div>

      <div className={`mt-2 grid grid-cols-2 gap-x-2 gap-y-1 border-t border-slate-300/50 pt-2 text-[10px] ${alertCardColors.detail}`}>
        <p className="inline-flex items-center gap-1"><CloudRain className="h-3 w-3 shrink-0" />ฝน {displayedRegionalAlert?.rainProbability != null ? `${Math.round(displayedRegionalAlert.rainProbability)}%` : 'ไม่มีข้อมูล'}</p>
        <p className="inline-flex items-center gap-1"><Activity className="h-3 w-3 shrink-0" />PM2.5 {displayedRegionalAlert?.pm25 != null ? `${displayedRegionalAlert.pm25.toFixed(1)} µg/m³` : 'ไม่มีข้อมูล'}</p>
        <p className="inline-flex items-center gap-1"><Wind className="h-3 w-3 shrink-0" />ลม {displayedRegionalAlert?.windSpeed != null ? `${Math.round(displayedRegionalAlert.windSpeed)} กม./ชม.` : 'ไม่มีข้อมูล'}</p>
        <p className="inline-flex items-center gap-1"><Droplets className="h-3 w-3 shrink-0" />ความชื้น {displayedRegionalAlert?.humidity != null ? `${Math.round(displayedRegionalAlert.humidity)}%` : 'ไม่มีข้อมูล'}</p>
      </div>

      <div className={`mt-2 flex items-start justify-between gap-2 border-t border-slate-300/50 pt-1.5 text-[9px] leading-snug ${alertCardColors.detail}`}>
        <p className="min-w-0">
          {displayedRegionalAlertLoading && !displayedRegionalAlert
            ? 'กำลังตรวจสอบข้อมูลล่าสุด…'
            : displayedRegionalAlertError
              ? displayedRegionalAlertError
              : activeRegionalAlerts[0]?.title
                || (displayedRegionalAlert?.unavailableSources?.length
                  ? `ตรวจสอบ${displayedRegionalAlert.unavailableSources.join(' และ ')}ไม่ได้`
                  : displayedRegionalAlert ? 'ไม่พบความเสี่ยงจากข้อมูลที่ตรวจสอบได้' : 'ยังไม่มีข้อมูลความเสี่ยง')}
          {activeRegionalAlerts[0]?.detail && ` · ${activeRegionalAlerts[0].detail}`}
        </p>
        <span className="shrink-0 font-bold">
          {displayedRegionalAlert?.aqi != null ? `AQI ${displayedRegionalAlert.aqi}` : ''}
          {displayedRegionalAlert?.updatedAt && ` · ${new Date(displayedRegionalAlert.updatedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`}
        </span>
      </div>
    </section>
  );

  const toggleAttractionFavorite = (attraction: (typeof filteredAttractions)[number]) => {
    const isSaved = favoriteIds.includes(attraction.key);
    if (isSaved) {
      removeFavoritePlace(attraction.key);
      setFavoriteIds((current) => current.filter((key) => key !== attraction.key));
      return;
    }
    const route = `/attraction/${attraction.routeId || attraction.id}`;
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
        <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/95 px-4 shadow-sm backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex min-h-[68px] w-full items-center justify-between gap-4">
            <a href="#home" className="flex shrink-0 items-center gap-2.5" aria-label="ไปไหนดี หน้าหลัก">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-[#1F2E7A]">
                <MapPinned className="h-5 w-5" />
              </span>
              <span className="text-lg font-extrabold tracking-tight text-[#1F2E7A] sm:text-xl">Thailand</span>
            </a>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <Link
                to="/favorites"
                aria-label={`รายการโปรด ${favoriteIds.length} สถานที่`}
                className="relative flex h-10 items-center justify-center gap-2 rounded-full px-2 text-[#1F2E7A] transition hover:bg-blue-50 sm:px-3"
              >
                <Heart className="h-4 w-4" />
                <span className="hidden text-sm font-medium xl:inline">รายการโปรด</span>
                {favoriteIds.length > 0 && (
                  <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                    {favoriteIds.length}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </header>

        {/* Content */}
        <div id="home" className="app-content mx-auto max-w-[1440px]">
          <section className="relative z-30 mb-6 -ml-3 w-screen overflow-visible md:-ml-[clamp(1rem,2.5vw,2.75rem)]">
            <div
              className="relative min-h-[440px] overflow-visible bg-cover bg-center sm:min-h-[430px] lg:min-h-[390px]"
              style={{ backgroundImage: `linear-gradient(90deg, rgba(5,31,75,.88) 0%, rgba(5,54,103,.62) 48%, rgba(3,57,91,.18) 100%), url("${heroImage || 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1800&q=85'}")` }}
            >
              <div className="relative z-30 flex min-h-[440px] flex-col justify-between gap-5 p-5 pb-6 sm:min-h-[430px] sm:p-7 lg:min-h-[390px] lg:p-9">
                <div className="w-full max-w-2xl lg:max-w-[calc(100%-34rem)]">
                  <a href="#home" className="inline-flex items-center gap-2 text-xs font-semibold text-blue-100/90 transition hover:text-white">
                  </a>
                  <h1 className="mt-3 text-[clamp(2.1rem,5vw,3.6rem)] font-black leading-tight tracking-tight text-white">
                    ประเทศไทย รอให้คุณออกไปค้นพบ
                  </h1>
                  <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/90 sm:text-base">
                   ให้ทุกวันหยุดกลายเป็นช่วงเวลาพิเศษ ด้วยการค้นพบสถานที่ใหม่ๆ ทั่วประเทศไทยวางแผนวันเดินทาง เช็กสภาพอากาศ แล้วออกไปสร้างความทรงจำดีๆ ในทุกเส้นทาง
                  </p>
                </div>

                {currentWeatherCard}

                <section id="place-search" aria-label="ค้นหาสถานที่และเลือกวันเดินทาง" className="mx-auto grid w-full max-w-[1280px] scroll-mt-24 gap-2 self-center rounded-2xl border border-white/70 bg-white p-2 shadow-xl sm:p-2.5 lg:grid-cols-[minmax(220px,1fr)_170px_170px_auto]">
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
                    inputClassName="h-11 w-full rounded-xl border-0 bg-slate-50 px-4 pr-12 text-sm text-slate-700 outline-none ring-1 ring-transparent placeholder:text-slate-400 focus:bg-white focus:ring-blue-200"
                    searchButtonClassName="flex h-9 w-9 items-center justify-center rounded-full bg-[#0754A5] p-0 text-white shadow-sm transition hover:bg-[#1F2E7A]"
                    dropdownClassName="max-h-72 rounded-2xl py-1"
                    containerClassName="min-w-0"
                  />
                  <DatePicker
                    placeholder="วันเดินทาง"
                    selected={departureDate}
                    onSelect={(date) => {
                      setDepartureDate(date);
                      if (!date || (returnDate && (returnDate < date || returnDate > latestForecastDate))) setReturnDate(undefined);
                      setSearchFlowMessage('');
                    }}
                    minDate={new Date()}
                    maxDate={latestForecastDate}
                  />
                  <DatePicker
                    placeholder="วันกลับ"
                    selected={returnDate}
                    disabled={!departureDate}
                    onSelect={(date) => {
                      setReturnDate(date);
                      setSearchFlowMessage('');
                    }}
                    minDate={departureDate || new Date()}
                    maxDate={latestForecastDate}
                  />
                  <button
                    type="button"
                    onClick={() => searchQuery.trim()
                      ? handleTextSearch(searchQuery)
                      : document.getElementById('recommended-attractions')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0754A5] px-5 text-sm font-bold text-white transition hover:bg-[#1F2E7A]"
                  >
                    <Search className="h-4 w-4" /> ค้นหา
                  </button>
                  {searchFlowMessage && (
                    <p role="status" className="px-3 pb-1 text-sm text-rose-600 lg:col-span-full">
                      {searchFlowMessage}
                    </p>
                  )}
                  {selectedPlace && (
                    <p className="px-3 pb-1 text-xs leading-relaxed text-slate-500 lg:col-span-full">
                      เลือกวันเดินทางและวันกลับเพื่อประเมินพยากรณ์ของ{selectedPlace.title}ตามพิกัดสถานที่
                    </p>
                  )}
                </section>
              </div>
            </div>
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
                      <p className="flex items-center gap-1.5 text-xs text-slate-500"><Thermometer className="h-4 w-4" />อุณหภูมิสูงสุด · {forecastTemperatureSource}</p>
                      {forecastMaxTemperature !== null && <p className="mt-1 font-semibold text-slate-800">{Math.round(forecastMaxTemperature)}°C</p>}
                      {forecastMinTemperature !== null && <p className="text-xs text-slate-500">ต่ำสุด {Math.round(forecastMinTemperature)}°C · Open-Meteo</p>}
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

          <div className="space-y-7">
          <section id="categories" className="scroll-mt-24">
            <div className="mb-3">
              <h2 className="text-lg font-bold text-[#1F2E7A] sm:text-xl">ประเภทสถานที่ท่องเที่ยว</h2>
              <p className="mt-1 text-sm text-slate-500"></p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5 2xl:grid-cols-10">
              {tourismCategories.map((category, index) => {
                const categoryIcons = [LayoutGrid, Waves, Mountain, Trees, CloudRain, Landmark, History, Coffee, Eye, Utensils];
                const categoryColors = [
                  'bg-blue-50 text-blue-700',
                  'bg-cyan-50 text-cyan-700',
                  'bg-violet-50 text-violet-700',
                  'bg-emerald-50 text-emerald-700',
                  'bg-sky-50 text-sky-700',
                  'bg-amber-50 text-amber-700',
                  'bg-orange-50 text-orange-700',
                  'bg-rose-50 text-rose-700',
                  'bg-indigo-50 text-indigo-700',
                  'bg-amber-50 text-amber-700',
                ];
                const CategoryIcon = categoryIcons[index];
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setSelectedCategory((current) => current === category ? 'ทั้งหมด' : category)}
                    aria-pressed={selectedCategory === category}
                    className={`flex min-h-[clamp(76px,8vw,94px)] min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl border bg-white px-1.5 py-2 text-xs font-semibold shadow-[0_3px_14px_rgba(31,46,122,0.06)] transition hover:-translate-y-0.5 hover:shadow-md sm:gap-2 sm:px-2 sm:py-3 sm:text-sm ${selectedCategory === category ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-100'}`}
                  >
                    <span className={`flex h-9 w-9 items-center justify-center rounded-xl sm:h-10 sm:w-10 ${categoryColors[index]}`}>
                      <CategoryIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </span>
                    <span className="truncate text-slate-700">{category}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section id="recommended-attractions" className="min-w-0 scroll-mt-24">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-start gap-2">
                <Flame className="mt-0.5 h-5 w-5 shrink-0 fill-blue-600 text-blue-600" />
                <div>
                  <h2 className="text-lg font-bold leading-tight text-[#1F2E7A] sm:text-xl">สถานที่แนะนำ</h2>
                  <p className="mt-1 text-xs text-slate-500 sm:text-sm"></p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="#categories"
                  className="hidden rounded-full px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 sm:inline-flex"
                >
                </a>
                <button
                  type="button"
                  aria-label="เลื่อนสถานที่แนะนำไปทางซ้าย"
                  onClick={() => recommendedTrackRef.current?.scrollBy({ left: -480, behavior: 'smooth' })}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-blue-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="เลื่อนสถานที่แนะนำไปทางขวา"
                  onClick={() => recommendedTrackRef.current?.scrollBy({ left: 480, behavior: 'smooth' })}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-blue-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div
              ref={recommendedTrackRef}
              className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-2"
              aria-label="รายการสถานที่แนะนำ"
            >
              {attractionsLoading ? (
                <p className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500" role="status">
                  กำลังโหลดสถานที่ท่องเที่ยวจากแหล่งข้อมูลจริง…
                </p>
              ) : attractionsError ? (
                <p className="w-full rounded-2xl border border-amber-200 bg-amber-50 px-5 py-8 text-center text-sm text-amber-800" role="alert">
                  {attractionsError}
                </p>
              ) : displayedAttractions.length === 0 ? (
                <p className="w-full rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
                  ไม่พบสถานที่จากข้อมูลที่เชื่อมต่อ ลองเลือกหมวดหมู่อื่นหรือค้นหาสถานที่
                </p>
              ) : recommendedAttractions.map((attraction) => (
                <div key={attraction.key} className="w-[min(78vw,220px)] shrink-0 snap-start sm:w-[clamp(220px,24vw,260px)]">
                  <AttractionCard
                    attraction={attraction}
                    isFavorite={favoriteIds.includes(attraction.key)}
                    onToggleFavorite={() => toggleAttractionFavorite(attraction)}
                    variant="recommended"
                  />
                </div>
              ))}
            </div>
          </section>

          <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
          <section id="popular-destinations" className="scroll-mt-24 rounded-2xl bg-gradient-to-br from-sky-50 to-blue-50 p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <Flame className="h-5 w-5 fill-blue-600 text-blue-600" />
              <h2 className="text-base font-bold tracking-tight text-[#1F2E7A] sm:text-lg">สถานที่ยอดนิยม</h2>
            </div>
            {popularDestinations.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {popularDestinations.map(({ province, attraction }) => (
                  <button
                    key={province}
                    type="button"
                    onClick={() => {
                      setSelectedPlace(null);
                      setSearchQuery(province);
                      setSearchFlowMessage('');
                      setSelectedCategory('ทั้งหมด');
                      setDiscoveryCategory('สถานที่ยอดนิยม');
                      document.getElementById('recommended-attractions')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="group min-w-0 overflow-hidden rounded-xl border border-white bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <img
                      src={attraction.images?.[0] || destinationImages[province]}
                      alt={attraction.title}
                      loading="lazy"
                      className="h-16 w-full object-cover transition duration-500 group-hover:scale-[1.03] sm:h-20"
                    />
                    <span className="block p-2">
                      <span className="block truncate text-xs font-bold text-[#1F2E7A] sm:text-sm">{province}</span>
                      <span className="mt-0.5 block truncate text-[10px] text-slate-500 sm:text-[11px]">
                        {attraction.category} · {attraction.title}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-center text-sm text-slate-500">
                ยังไม่มีข้อมูลจุดหมายยอดนิยม
              </p>
            )}
          </section>

          <section
            id="travel-inspiration"
            className="relative flex min-h-48 items-center overflow-hidden rounded-2xl bg-cover bg-center px-5 py-6 text-white shadow-[0_8px_28px_rgba(31,46,122,0.14)] sm:px-7"
            style={{
              backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,.98) 0%, rgba(238,248,255,.92) 45%, rgba(12,53,111,.08) 100%), url("https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=1200&q=85")',
            }}
          >
            <div className="relative z-10 max-w-[68%] text-[#1F2E7A] sm:max-w-[62%]">
              <div className="flex items-center gap-2">
                <Leaf className="h-5 w-5 fill-emerald-500 text-emerald-600" />
                <h2 className="text-base font-bold sm:text-lg">ทริปเที่ยวสบายใจ</h2>
              </div>
              <p className="mt-2 text-xs font-semibold sm:text-sm">เช็กสภาพอากาศ ก่อนออกเดินทาง</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-600 sm:text-xs">
                วางแผนเที่ยวได้ง่ายขึ้น ปลอดภัยทุกเส้นทางการเดินทาง
              </p>
              <button
                type="button"
                onClick={() => document.getElementById('place-search')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                className="mt-3 inline-flex items-center gap-1 rounded-full border border-blue-300 bg-white/80 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
              >
                ดูรายละเอียด <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </section>
          </div>

          <section id="nearby-attractions" className="scroll-mt-24">
            <div className="mb-3 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-[#1F2E7A] sm:text-xl">สถานที่ใกล้เคียง</h2>
                <p className="mt-1 text-sm text-slate-500"></p>
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5">
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
          </div>

        </div>
      </div>
      <footer className="mx-auto max-w-7xl px-4 py-4 text-center text-xs text-slate-500">
        © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap contributors</a>
      </footer>
    </div>
  );
}
