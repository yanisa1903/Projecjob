import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import { Search, Menu, User, AlertCircle, AlertTriangle, Wind, Activity, X, Shield, Loader2, RefreshCw } from 'lucide-react';
import DatePicker from './DatePicker';

const popularPlaces = [
  { name: 'เกาะพีพี', province: 'กระบี่', type: 'เกาะ' },
  { name: 'เกาะสมุย', province: 'สุราษฎร์ธานี', type: 'เกาะ' },
  { name: 'เกาะเต่า', province: 'สุราษฎร์ธานี', type: 'เกาะ' },
  { name: 'เกาะช้าง', province: 'ตราด', type: 'เกาะ' },
  { name: 'เกาะหลีเป๊ะ', province: 'สตูล', type: 'เกาะ' },
  { name: 'วัดพระแก้ว', province: 'กรุงเทพมหานคร', type: 'วัด' },
  { name: 'อุทยานแห่งชาติเขาใหญ่', province: 'นครราชสีมา', type: 'อุทยาน' },
  { name: 'ดอยสุเทพ', province: 'เชียงใหม่', type: 'ภูเขา' },
  { name: 'โรงพยาบาลศิริราช', province: 'กรุงเทพมหานคร', type: 'โรงพยาบาล' },
  { name: 'โรงเรียนวัดหนองเกตุน้อย', province: 'ชลบุรี', type: 'โรงเรียน' },
  { name: 'ตลาดนัดจตุจักร', province: 'กรุงเทพมหานคร', type: 'ตลาด' },
  { name: 'เซ็นทรัลเวิลด์', province: 'กรุงเทพมหานคร', type: 'ห้างสรรพสินค้า' },
];

// Map Thai keywords to a real location in Thailand for current air-quality data.
const CITY_MAP: [string, string][] = [
  ['กรุงเทพ', 'bangkok'],
  ['ภูเขาทอง', 'bangkok'],
  ['วัดพระแก้ว', 'bangkok'],
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
      `https://commons.wikimedia.org/w/api.php?action=query&generator=geosearch&ggsprimary=all&ggsnamespace=6&ggsradius=1000&ggscoord=${latitude}|${longitude}&ggslimit=6&prop=imageinfo&iiprop=url&iiurlwidth=900&format=json&origin=*`,
    );
    const commonsData = commonsResponse.ok
      ? await commonsResponse.json() as { query?: { pages?: Record<string, { imageinfo?: Array<{ thumburl?: string; url?: string }> }> } }
      : {};
    const commonsImages = Object.values(commonsData.query?.pages || {})
      .map((page) => page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url || '')
      .filter(Boolean);
    return [...new Set([...commonsImages, articleImage].filter(Boolean))].slice(0, 3);
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
  const [bangkokAir, setBangkokAir] = useState<AirData | null>(null);
  const [destinationImages, setDestinationImages] = useState<Record<number, string[]>>({});
  const abortRef = useRef<AbortController | null>(null);

  // Fetch Bangkok AQI for homepage card
  useEffect(() => {
    fetchAirData('bangkok').then(setBangkokAir).catch(() => null);
  }, []);

  useEffect(() => {
    const loadImages = async () => {
      const loaded = await Promise.all(
        attractions.map(async (attraction) => [
          attraction.id,
          await fetchDestinationImages(attraction.title, attraction.latitude, attraction.longitude),
        ] as const),
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
      title: 'วัดพระแก้ว',
      latitude: 13.7516,
      longitude: 100.4927,
      description: 'วัดสำคัญในพระบรมมหาราชวัง โดดเด่นด้วยสถาปัตยกรรมไทยและพระแก้วมรกต ใจกลางกรุงเทพมหานคร',
      location: 'พระนคร กรุงเทพมหานคร',
      images: [
        'https://images.unsplash.com/photo-1563492065599-3520f775eeed?w=400',
        'https://images.unsplash.com/photo-1528181304800-259b08848526?w=400',
        'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=400',
      ],
    },
    {
      id: 4,
      title: 'เกาะพีพี',
      latitude: 7.7407,
      longitude: 98.7784,
      description: 'หมู่เกาะยอดนิยมในทะเลอันดามัน จังหวัดกระบี่ มีอ่าวมาหยา น้ำทะเลใส และหาดทรายสวย',
      location: 'อำเภอเมืองกระบี่ จังหวัดกระบี่',
      images: [
        'https://images.unsplash.com/photo-1537956965359-7573183d1f57?w=400',
        'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=400',
        'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400',
      ],
    },
    {
      id: 6,
      title: 'ดอยสุเทพ',
      latitude: 18.8048,
      longitude: 98.9216,
      description: 'วัดพระธาตุดอยสุเทพ สถานที่คู่เมืองเชียงใหม่ ตั้งอยู่บนยอดดอยพร้อมวิวเมืองและภูเขา',
      location: 'อำเภอเมืองเชียงใหม่ จังหวัดเชียงใหม่',
      images: [
        'https://images.unsplash.com/photo-1589728894104-1cf1f8ae9eee?w=400',
        'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400',
        'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400',
      ],
    },
    {
      id: 5,
      title: 'พัทยา',
      latitude: 12.9236,
      longitude: 100.8825,
      description: 'เมืองชายทะเลยอดนิยมของชลบุรี มีหาดพัทยา จุดชมวิว และกิจกรรมทางน้ำหลากหลาย',
      location: 'อำเภอบางละมุง จังหวัดชลบุรี',
      images: [
        'https://images.unsplash.com/photo-1598971639058-fab3c3109a00?w=400',
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400',
        'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400',
      ],
    },
    {
      id: 7,
      title: 'หัวหิน',
      latitude: 12.5684,
      longitude: 99.9577,
      description: 'เมืองพักผ่อนริมทะเลในประจวบคีรีขันธ์ มีชายหาด ตลาดกลางคืน และสถานที่ท่องเที่ยวสำหรับครอบครัว',
      location: 'อำเภอหัวหิน จังหวัดประจวบคีรีขันธ์',
      images: [
        'https://images.unsplash.com/photo-1552550049-db097c9480d1?w=400',
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400',
        'https://images.unsplash.com/photo-1598971639058-fab3c3109a00?w=400',
      ],
    },
    {
      id: 8,
      title: 'ดอยอินทนนท์',
      latitude: 18.5883,
      longitude: 98.4878,
      description: 'ยอดเขาที่สูงที่สุดในประเทศไทย มีธรรมชาติ น้ำตก และอากาศเย็นตลอดปี',
      location: 'อำเภอจอมทอง จังหวัดเชียงใหม่',
      images: [
        'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400',
        'https://images.unsplash.com/photo-1589728894104-1cf1f8ae9eee?w=400',
        'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400',
      ],
    },
  ];
  const displayedAttractions = attractions
    .filter((attraction) => (destinationImages[attraction.id]?.length || 0) > 0)
    .slice(0, 6)
    .map((attraction) => ({
      ...attraction,
      images: destinationImages[attraction.id] || [],
    }))
    .filter((attraction) => attraction.images.length > 0);

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
                        : 'อากาศดี เดินทางได้'}
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
                        ? `⚠️ ไม่แนะนำให้เดินทางไป "${searchQuery}"`
                        : level === 'warning'
                        ? '⚡ ควรระวัง – สวมหน้ากาก N95 เมื่อออกนอก'
                        : '✅ อากาศดี เหมาะสมสำหรับการท่องเที่ยว'}
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
      <div className="mx-auto w-full max-w-[480px] lg:max-w-[1200px] min-h-screen bg-white shadow-xl">
        {/* Header */}
        <div className="bg-white pt-12 pb-4 px-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <button className="p-2">
              <Menu className="w-6 h-6 text-[#1F2E7A]" />
            </button>
            <h1 className="font-semibold text-[#1F2E7A]">Thailand</h1>
            <button className="p-2">
              <User className="w-6 h-6 text-[#1F2E7A]" />
            </button>
          </div>

          {/* Skyline illustration */}
          <div className="h-20 bg-gradient-to-r from-blue-100 to-purple-100 rounded-lg mb-4 flex items-end justify-center overflow-hidden">
            <div className="flex items-end gap-1 pb-2">
              <div className="w-12 h-16 bg-[#1F2E7A] rounded-t-full opacity-80"></div>
              <div className="w-8 h-12 bg-[#FF6B6B] rounded-t-full opacity-80"></div>
              <div className="w-10 h-14 bg-[#FFA500] rounded-t-full opacity-80"></div>
              <div className="w-14 h-18 bg-[#1F2E7A] rounded-t-full opacity-90"></div>
              <div className="w-8 h-10 bg-[#FF6B6B] rounded-t-full opacity-80"></div>
              <div className="w-12 h-14 bg-[#4CAF50] rounded-t-full opacity-80"></div>
              <div className="w-10 h-12 bg-[#9C27B0] rounded-t-full opacity-80"></div>
            </div>
          </div>

          {/* Search */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (searchQuery.trim()) navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
            }}
            className="relative mb-3"
          >
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowIslandSuggestions(true);
              }}
              onFocus={() => setShowIslandSuggestions(true)}
              onBlur={() => setTimeout(() => setShowIslandSuggestions(false), 150)}
              placeholder="ค้นหาสถานที่ในประเทศไทย เช่น ร้านอาหาร โรงพยาบาล หรือห้าง"
              className="w-full pl-4 pr-10 py-3 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1F2E7A]"
            />
            <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2">
              <Search className="w-5 h-5 text-gray-400 hover:text-[#1F2E7A] transition-colors" />
            </button>
            {showIslandSuggestions && (
              <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                <p className="px-4 py-2 text-xs font-semibold text-gray-500">สถานที่ยอดนิยมในประเทศไทย</p>
                {popularPlaces
                  .filter((place) => !searchQuery.trim() || `${place.name} ${place.province} ${place.type}`.includes(searchQuery.trim()))
                  .map((place) => (
                    <button
                      key={place.name}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setSearchQuery(place.name);
                        setShowIslandSuggestions(false);
                      }}
                      className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-blue-50"
                    >
                      <span className="font-medium text-[#1F2E7A]">{place.name}</span>
                      <span className="text-xs text-gray-500">{place.type} · {place.province}</span>
                    </button>
                  ))}
              </div>
            )}
          </form>

          {/* Date Pickers */}
          <div className="grid grid-cols-2 gap-3">
            <DatePicker
              placeholder="วันไปเที่ยว"
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
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-4">
          {/* Live Bangkok AQI card */}
          {bangkokAir ? (
            <div
              className={`border-l-4 rounded-2xl p-4 mb-6 ${
                bangkokAir.level === 'danger'
                  ? 'bg-red-50 border-red-500'
                  : bangkokAir.level === 'warning'
                  ? 'bg-orange-50 border-orange-400'
                  : 'bg-green-50 border-green-500'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`rounded-full p-2 mt-0.5 ${
                    bangkokAir.level === 'danger'
                      ? 'bg-red-500'
                      : bangkokAir.level === 'warning'
                      ? 'bg-orange-400'
                      : 'bg-green-500'
                  }`}
                >
                  <AlertCircle className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3
                      className={`font-semibold text-sm ${
                        bangkokAir.level === 'danger'
                          ? 'text-red-800'
                          : bangkokAir.level === 'warning'
                          ? 'text-orange-800'
                          : 'text-green-800'
                      }`}
                    >
                      {bangkokAir.level === 'danger' ? `คุณภาพอากาศ ${bangkokAir.city} อันตราย` : `คุณภาพอากาศ ${bangkokAir.city} ตอนนี้`}
                    </h3>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        bangkokAir.level === 'danger'
                          ? 'bg-red-500 text-white'
                          : bangkokAir.level === 'warning'
                          ? 'bg-orange-400 text-white'
                          : 'bg-green-500 text-white'
                      }`}
                    >
                      AQI {bangkokAir.aqi}
                    </span>
                  </div>
                  <p
                    className={`text-xs leading-relaxed ${
                      bangkokAir.level === 'danger'
                        ? 'text-red-700'
                        : bangkokAir.level === 'warning'
                        ? 'text-orange-700'
                        : 'text-green-700'
                    }`}
                  >
                    PM2.5: {bangkokAir.pm25 !== null ? `${bangkokAir.pm25.toFixed(1)} µg/m³` : '—'} · สถานะ: {bangkokAir.status}
                    {bangkokAir.updatedAt && ` · อัปเดต ${new Date(bangkokAir.updatedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`}
                    {bangkokAir.level === 'danger' && ' · ไม่ควรออกนอกบ้านโดยไม่จำเป็น'}
                    {bangkokAir.level === 'warning' && ' · ควรสวมหน้ากากเมื่อออกนอก'}
                    {bangkokAir.level === 'safe' && ' · อากาศดี เหมาะสำหรับกิจกรรมกลางแจ้ง'}
                  </p>
                </div>
              </div>
              <div
                className={`mt-3 rounded-xl px-3 py-2 text-xs leading-relaxed font-medium ${
                  bangkokAir.level === 'danger'
                    ? 'bg-red-100 text-red-800'
                    : bangkokAir.level === 'warning'
                    ? 'bg-orange-100 text-orange-800'
                    : 'bg-green-100 text-green-800'
                }`}
              >
                {bangkokAir.level === 'danger'
                  ? 'คำแนะนำ: ควรเลื่อนกิจกรรมกลางแจ้ง สวมหน้ากาก N95 หากจำเป็นต้องออกจากอาคาร และดูแลกลุ่มเสี่ยงเป็นพิเศษ'
                  : bangkokAir.level === 'warning'
                  ? 'คำแนะนำ: เที่ยวได้ แต่ควรลดกิจกรรมกลางแจ้ง สวมหน้ากากเมื่ออยู่กลางแจ้ง และพักในพื้นที่อากาศสะอาด'
                  : 'คำแนะนำ: สามารถเดินทางและทำกิจกรรมกลางแจ้งได้ตามปกติ'}
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-2xl p-4 mb-6 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin flex-shrink-0" />
              <p className="text-xs text-gray-500">กำลังโหลดข้อมูลคุณภาพอากาศ…</p>
            </div>
          )}

          {/* Recommended */}
          <h2 className="font-semibold text-[#1F2E7A] mb-3">สถานที่แนะนำสำหรับการท่องเที่ยว</h2>

          <div className="space-y-4">
            {displayedAttractions.map((attraction) => (
              <Link
                key={attraction.id}
                to={`/attraction/${attraction.id}`}
                state={{
                  title: attraction.title,
                  location: attraction.location,
                  images: attraction.images,
                }}
                className="block"
              >
                <div className="bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="grid grid-cols-3 gap-3 p-3">
                    {attraction.images.map((image) => (
                      <img
                        key={image}
                        src={image}
                        alt={attraction.title}
                        className={`w-full aspect-[4/3] object-cover rounded-xl ${attraction.images.length === 1 ? 'col-span-3' : ''}`}
                      />
                    ))}
                  </div>
                  <div className="px-3 pb-3">
                    <h3 className="font-semibold text-[#1F2E7A] mb-1">{attraction.title}</h3>
                    <p className="text-xs text-gray-500 mb-1">{attraction.location}</p>
                    <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">{attraction.description}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
