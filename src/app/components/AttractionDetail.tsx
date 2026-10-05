import { useLocation, useNavigate, useParams } from 'react-router';
import { ArrowLeft, MapPin, Clock, Phone, Facebook, Cloud, Droplets, Wind, Waves, CloudRain, AlertTriangle, Star, Sunrise, Banknote, Sparkles, Camera, Ship, Landmark, Leaf, Navigation, Lightbulb, ShieldAlert, Heart, Thermometer, Compass } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchPlaceImages, lockThreeImages } from '../utils/placeImages';
import { fetchTatPlace, lockTatImages } from '../utils/tatApi';
import { fetchWindyWeather } from '../utils/windyApi';

type NearbyPlace = {
  id: number;
  name: string;
  type: string;
  lat: number;
  lon: number;
};

function getHolidayInfo(openingHours: string) {
  if (/\bPH\s+off\b|\bPH\s+closed\b/i.test(openingHours)) {
    return 'หยุดวันหยุดนักขัตฤกษ์';
  }
  if (/\bPH\s+(open|\d)/i.test(openingHours)) {
    return 'เปิดตามเวลาที่ระบุในวันหยุดนักขัตฤกษ์';
  }
  return 'ไม่มีข้อมูลวันหยุดจากแหล่งข้อมูล';
}

const weekDays = [
  ['Mo', 'วันจันทร์'], ['Tu', 'วันอังคาร'], ['We', 'วันพุธ'], ['Th', 'วันพฤหัสบดี'],
  ['Fr', 'วันศุกร์'], ['Sa', 'วันเสาร์'], ['Su', 'วันอาทิตย์'],
] as const;

function getDailyHours(openingHours: string) {
  const schedule = new Map<string, string>();
  const everyDay = openingHours.match(/เปิดทุกวัน\s+(.+)/i);
  const allDay = /เปิดตลอด\s*24\s*ชั่วโมง/i.test(openingHours);
  if (everyDay || allDay) {
    weekDays.forEach(([code]) => schedule.set(code, allDay ? 'เปิดตลอด 24 ชั่วโมง' : everyDay![1]));
    return schedule;
  }
  openingHours.split(';').forEach((part) => {
    const match = part.trim().match(/^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?\s+(.+)$/i);
    if (!match) return;
    const start = weekDays.findIndex(([code]) => code.toLowerCase() === match[1].toLowerCase());
    const end = match[2]
      ? weekDays.findIndex(([code]) => code.toLowerCase() === match[2].toLowerCase())
      : start;
    if (start < 0 || end < 0) return;
    for (let index = start; index <= end; index += 1) schedule.set(weekDays[index][0], match[3]);
  });
  return schedule;
}

function formatAddress(address?: Record<string, string>) {
  if (!address) return '';
  return [
    address.house_number && `เลขที่ ${address.house_number}`,
    address.road && (address.road.startsWith('ถนน') ? address.road : `ถนน${address.road}`),
    address.neighbourhood && `หมู่บ้าน ${address.neighbourhood}`,
    address.village && `หมู่ ${address.village}`,
    address.suburb && `${/^(ตำบล|แขวง)\s/.test(address.suburb) ? '' : 'ตำบล/แขวง '}${address.suburb}`,
    address.city_district && `${/^(อำเภอ|เขต)\s/.test(address.city_district) ? '' : 'อำเภอ/เขต '}${address.city_district}`,
    address.county && !address.city_district && `อำเภอ ${address.county}`,
    (address.state || address.city) && `${/^(จังหวัด)\s/.test(address.state || address.city || '') ? '' : 'จังหวัด'}${address.state || address.city}`,
    address.postcode && `รหัสไปรษณีย์ ${address.postcode}`,
  ].filter(Boolean).join(' ');
}

function getProvince(location: string, providedProvince?: string) {
  if (providedProvince) return providedProvince.replace(/^จังหวัด/, '');
  const provinceMatch = location.match(/จังหวัด\s*([^,\d]+)/);
  return provinceMatch?.[1]?.trim() || 'ไม่พบข้อมูลจังหวัด';
}

function distanceInKm(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const arc = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}

export default function AttractionDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const locationState = useLocation().state as {
    title?: string;
    location?: string;
    province?: string;
    mapUrl?: string;
    category?: string;
    image?: string;
    images?: string[];
    lat?: string;
    lon?: string;
    phone?: string;
    website?: string;
    facebook?: string;
    email?: string;
    openingHours?: string;
    description?: string;
    rating?: number;
    entranceFee?: number;
    reviewCount?: number;
    travelCaution?: string;
    favoriteKey?: string;
  } | null;

  const attractionData: Record<string, any> = {
    1: {
      title: 'ภูเขาทอง',
      images: [
        'https://images.unsplash.com/photo-1528181304800-259b08848526?w=400',
        'https://images.unsplash.com/photo-1563492065599-3520f775eeed?w=400',
        'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=400',
      ],
      description: 'วัดภูเขาทองเป็นวัดเก่าแก่และมีชื่อเสียงในกรุงเทพมหานคร สร้างขึ้นในสมัยอยุธยา บนยอดเจดีย์สามารถมองเห็นทิวทัศน์กรุงเทพมหานครได้รอบทิศ',
      location: 'ตั้งอยู่ที่ 344 ถนนจักรพรรดิพงษ์ แขวงบ้านบาตร เขตป้อมปราบศัตรูพ่าย กรุงเทพมหานคร 10100',
      hours: 'เปิดบริการทุกวัน 07:00 - 19:00 น.',
      phone: '-',
      facebook: 'วัดภูเขาทอง',
    },
    2: {
      title: 'เกาะเต่า',
      images: [
        'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400',
        'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=400',
        'https://images.unsplash.com/photo-1589208828261-e0c0c634e7b5?w=400',
      ],
      description: 'เกาะเต่าเป็นสวรรค์สำหรับนักดำน้ำ มีแนวปะการังที่สวยงามและสัตว์ทะเลหลากหลายชนิด น้ำทะเลใสสะอาด เหมาะสำหรับการพักผ่อน',
      location: 'ตั้งอยู่ในตำบลเกาะเต่า อำเภอพะงัน (หรืออำเภอเกาะพะงัน) จังหวัดสุราษฎร์ธานี',
      hours: 'เปิดตลอด 24 ชั่วโมง',
      phone: '-',
      facebook: 'เกาะเต่าท่องเที่ยว',
    },
    3: {
      title: 'วัดพระศรีรัตนศาสดาราม',
      images: [],
      description: 'วัดพระศรีรัตนศาสดารามเป็นวัดสำคัญในพระบรมมหาราชวัง โดดเด่นด้วยสถาปัตยกรรมไทยและพระแก้วมรกต',
      location: 'พระนคร กรุงเทพมหานคร',
      address: {
        house_number: '1',
        road: 'ถนนหน้าพระลาน',
        neighbourhood: 'พระบรมมหาราชวัง',
        suburb: 'พระบรมมหาราชวัง',
        city_district: 'พระนคร',
        city: 'กรุงเทพมหานคร',
        postcode: '10200',
      },
      hours: 'เปิดทุกวัน 08:30 - 15:30 น.',
      phone: '-',
      facebook: '-',
    },
    4: {
      title: 'เกาะพีพี',
      images: [
        'https://images.unsplash.com/photo-1537956965359-7573183d1f57?w=400',
        'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400',
        'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=400',
      ],
      description: 'เกาะพีพีมีหาดทรายขาวสะอาด น้ำทะเลใส เหมาะสำหรับการพักผ่อนและดำน้ำ',
      location: 'ตำบลอ่าวนาง อำเภอเมืองกระบี่ จังหวัดกระบี่',
      hours: 'เปิดตลอด 24 ชั่วโมง',
      phone: '-',
      facebook: '-',
    },
    5: {
      title: 'พัทยา',
      images: [
        'https://images.unsplash.com/photo-1598971639058-fab3c3109a00?w=400',
        'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400',
        'https://images.unsplash.com/photo-1537956965359-7573183d1f57?w=400',
      ],
      description: 'เมืองท่องเที่ยวชายทะเลที่มีชีวิตชีวา มีหาดสวย กิจกรรมทางน้ำมากมาย',
      location: 'อำเภอบางละมุง จังหวัดชลบุรี 20150',
      hours: 'เปิดตลอด 24 ชั่วโมง',
      phone: '-',
      facebook: 'PRPATTAYA (ประชาสัมพันธ์ เมืองพัทยา)',
    },
    6: {
      title: 'ดอยสุเทพ',
      images: [
        'https://images.unsplash.com/photo-1589728894104-1cf1f8ae9eee?w=400',
        'https://images.unsplash.com/photo-1528181304800-259b08848526?w=400',
        'https://images.unsplash.com/photo-1563492065599-3520f775eeed?w=400',
      ],
      description: 'วัดพระธาตุดอยสุเทพ วัดที่สำคัญของเชียงใหม่ ตั้งอยู่บนยอดดอย',
      location: 'ตำบลสุเทพ อำเภอเมืองเชียงใหม่ จังหวัดเชียงใหม่ 50200',
      hours: 'เปิดทุกวัน 06:00 - 20:00 น.',
      phone: '-',
      facebook: '-',
    },
    7: {
      title: 'หัวหิน',
      images: [
        'https://images.unsplash.com/photo-1552550049-db097c9480d1?w=400',
        'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400',
        'https://images.unsplash.com/photo-1598971639058-fab3c3109a00?w=400',
      ],
      description: 'เมืองพักผ่อนชายทะเลที่เงียบสงบ มีหาดสวย ตลาดน้ำ',
      location: 'อำเภอหัวหิน จังหวัดประจวบคีรีขันธ์ 77110',
      hours: 'เปิดตลอด 24 ชั่วโมง',
      phone: '-',
      facebook: '-',
    },
    8: {
      title: 'ดอยอินทนนท์',
      images: [
        'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400',
        'https://images.unsplash.com/photo-1589728894104-1cf1f8ae9eee?w=400',
        'https://images.unsplash.com/photo-1528181304800-259b08848526?w=400',
      ],
      description: 'ยอดเขาที่สูงที่สุดในประเทศไทย มีอากาศเย็น ธรรมชาติสวยงาม',
      location: 'ตำบลบ้านหลวง อำเภอจอมทอง จังหวัดเชียงใหม่ 50160',
      hours: 'เปิดทุกวัน 05:00 - 18:00 น.',
      phone: '053-286-729 (เบอร์ติดต่ออุทยานแห่งชาติดอยอินทนนท์)',
      facebook: 'อุทยานแห่งชาติดอยอินทนนท์ - Doi Inthanon National Park',
    },
  };

  const savedImages = id ? JSON.parse(localStorage.getItem(`destination-images-${id}`) || '[]') as string[] : [];
  const exactImages = id === '3' ? [] : locationState?.images?.length ? locationState.images : savedImages;
  const livePlaceText = `${locationState?.title || ''} ${locationState?.category || ''}`;
  const livePlaceDescription = /ทะเล|เกาะ|หาด|ชายหาด|อ่าว|beach|island/i.test(livePlaceText)
    ? `${locationState?.title} เป็นจุดหมายริมทะเลใน${locationState?.province || 'ประเทศไทย'} เหมาะสำหรับชมวิว พักผ่อน ถ่ายภาพ และสัมผัสบรรยากาศชายฝั่งอย่างใกล้ชิด ควรตรวจสอบสภาพอากาศและรอบเรือก่อนเดินทาง`
    : /วัด|พระ|temple|palace|museum|heritage/i.test(livePlaceText)
      ? `${locationState?.title} เป็นสถานที่สำคัญด้านวัฒนธรรมใน${locationState?.province || 'ประเทศไทย'} มีสถาปัตยกรรมและเรื่องราวท้องถิ่นที่น่าสนใจ เหมาะสำหรับเดินชม เรียนรู้ประวัติศาสตร์ และเก็บภาพความประทับใจ`
      : /อุทยาน|ภูเขา|ดอย|น้ำตก|ป่า|mountain|park|waterfall|forest/i.test(livePlaceText)
        ? `${locationState?.title} เป็นแหล่งธรรมชาติใน${locationState?.province || 'ประเทศไทย'} เหมาะสำหรับชมวิว สูดอากาศบริสุทธิ์ และใช้เวลากับเส้นทางธรรมชาติ ควรเตรียมรองเท้าที่เหมาะสมและตรวจสอบประกาศก่อนเดินทาง`
        : `${locationState?.title} เป็นสถานที่น่าสนใจใน${locationState?.province || 'ประเทศไทย'} เหมาะสำหรับแวะสำรวจและสัมผัสบรรยากาศจริงของพื้นที่ แนะนำให้ตรวจสอบเวลาเปิดทำการและการเดินทางก่อนออกไป`;
  const savedAttraction = attractionData[id || '1'] || attractionData['1'];
  const attraction = (id?.startsWith('place-') || Boolean(exactImages.length)) && locationState?.title
    ? {
        ...(!id?.startsWith('place-') ? savedAttraction : {}),
        title: locationState.title,
        images: id === '3' ? exactImages : exactImages.length ? exactImages : savedAttraction.images,
        description: locationState.description || (id?.startsWith('place-') ? livePlaceDescription : savedAttraction.description),
        location: locationState.location || savedAttraction.location || locationState.province || 'ประเทศไทย',
        travelCaution: locationState.travelCaution || savedAttraction.travelCaution || '',
        hours: locationState.openingHours || savedAttraction.hours || '',
        phone: locationState.phone || savedAttraction.phone || '',
        facebook: locationState.facebook || '',
        mapUrl: locationState.mapUrl,
      }
    : { ...savedAttraction, images: [] };

  const [weather, setWeather] = useState<{
    temperatures: number[];
    rain: number[];
    wind: number;
    currentRain: number;
    condition: 'clear' | 'rain' | 'thunderstorm';
    isNight: boolean;
  } | null>(null);
  const [showWeatherDetails, setShowWeatherDetails] = useState(false);
  const legacyCoordinates: Record<string, { lat: string; lon: string }> = {
    '1': { lat: '13.7539', lon: '100.5067' },
    '2': { lat: '10.0991', lon: '99.8381' },
    '3': { lat: '13.7516', lon: '100.4927' },
    '4': { lat: '7.7407', lon: '98.7784' },
    '5': { lat: '12.9236', lon: '100.8825' },
    '6': { lat: '18.8048', lon: '98.9216' },
    '7': { lat: '12.5684', lon: '99.9577' },
    '8': { lat: '18.5883', lon: '98.4878' },
  };
  const coordinates = locationState?.lat && locationState.lon ? locationState : legacyCoordinates[id || ''];
  const mapUrl = coordinates?.lat && coordinates.lon
    ? `https://www.google.com/maps?q=${coordinates.lat},${coordinates.lon}&output=embed`
    : '';
  const fullMapUrl = attraction.mapUrl || (coordinates?.lat && coordinates.lon
    ? `https://www.google.com/maps/search/?api=1&query=${coordinates.lat},${coordinates.lon}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${attraction.title} ${locationState?.province || ''}`.trim())}`);
  const [verifiedHours, setVerifiedHours] = useState('');
  const [verifiedLocation, setVerifiedLocation] = useState('');
  const [placeDetails, setPlaceDetails] = useState<{
    address?: Record<string, string>;
    operator?: string;
    phone?: string;
    category?: string;
  }>({});
  const displayHours = verifiedHours || attraction.hours;
  const dailyHours = getDailyHours(displayHours);
  const detailedAddress = { ...savedAttraction.address, ...placeDetails.address };
  if (savedAttraction.address?.suburb && placeDetails.address?.suburb?.startsWith('เขต')) {
    detailedAddress.suburb = savedAttraction.address.suburb;
  }

  useEffect(() => {
    if (!coordinates?.lat || !coordinates.lon || locationState?.openingHours) return;
    fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coordinates.lat}&lon=${coordinates.lon}&extratags=1&accept-language=th`)
      .then((response) => response.json() as Promise<{
        display_name?: string;
        address?: Record<string, string>;
        extratags?: { opening_hours?: string; operator?: string; phone?: string; tourism?: string; amenity?: string };
      }>)
      .then((data) => {
        if (data.extratags?.opening_hours) setVerifiedHours(data.extratags.opening_hours);
        if (data.display_name) setVerifiedLocation(data.display_name);
        setPlaceDetails({ address: data.address, operator: data.extratags?.operator, phone: data.extratags?.phone, category: data.extratags?.tourism || data.extratags?.amenity });
      })
      .catch(() => undefined);
  }, [coordinates?.lat, coordinates?.lon, locationState?.openingHours]);

  const [placeImages, setPlaceImages] = useState<string[]>(lockThreeImages(exactImages));

  useEffect(() => {
    if (placeImages.length || !coordinates?.lat || !coordinates.lon) return;
    if (id === '3') {
      fetchTatPlace('วัดพระศรีรัตนศาสดาราม')
        .then((place) => setPlaceImages(lockThreeImages(lockTatImages('วัดพระศรีรัตนศาสดาราม', place?.images || []))))
        .catch(() => undefined);
      return;
    }
    fetchPlaceImages(attraction.title, coordinates.lat, coordinates.lon).then((images) => setPlaceImages(lockThreeImages(images)));
  }, [attraction.title, coordinates?.lat, coordinates?.lon, placeImages.length]);
  const [airQuality, setAirQuality] = useState<{ pm25: number; aqi: number } | null>(null);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [userCoordinates, setUserCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem('favorite-attractions') || '[]');
      return Array.isArray(stored) ? stored.filter((value): value is string => typeof value === 'string') : [];
    } catch {
      return [];
    }
  });
  const favoriteKey = locationState?.favoriteKey || `local-${id}`;
  const isFavorite = favoriteIds.includes(favoriteKey);
  const destinationDistance = userCoordinates && coordinates?.lat && coordinates.lon
    ? distanceInKm(userCoordinates, { latitude: Number(coordinates.lat), longitude: Number(coordinates.lon) })
    : null;
  const placeText = `${attraction.title} ${attraction.location} ${locationState?.category || ''}`.toLowerCase();
  const isSea = /ทะเล|เกาะ|ชายหาด|หาด|อ่าว|พัทยา|หัวหิน|พีพี|เต่า|beach|island/.test(placeText);
  const isWaterRelatedNature = /น้ำตก|แก่ง|ห้วย|ลำธาร|แม่น้ำ|ริมน้ำ|อ่างเก็บน้ำ|เขื่อน|waterfall|river|stream|reservoir|dam/.test(placeText);
  const isTempleOrCulture = /วัด|พระธาตุ|พระราชวัง|พิพิธภัณฑ์|เมืองเก่า|โบราณสถาน|temple|palace|museum|heritage/.test(placeText);
  const isNature = /อุทยาน|ภูเขา|ดอย|ป่า|เขา|ธรรมชาติ|national park|mountain|forest|nature/.test(placeText);
  const descriptionHighlights = attraction.description
    .split(/[.!?。\n;；]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const destinationHighlights = (descriptionHighlights.length > 1
    ? descriptionHighlights
    : attraction.description.split(/[,，]/).map((item) => item.trim()).filter(Boolean))
    .slice(0, 4);
  const activityOptions = [
    ['ดำน้ำ', /ดำน้ำ|ดำน้ำตื้น|ดำน้ำลึก/],
    ['ล่องเรือ', /ล่องเรือ|นั่งเรือ|เดินทางทางเรือ/],
    ['เล่นน้ำ', /เล่นน้ำ|ว่ายน้ำ|น้ำทะเล|น้ำตก/],
    ['เดินป่า', /เดินป่า|เดินเขา|เส้นทางเดิน/],
    ['ชมธรรมชาติ', /ธรรมชาติ|ป่า|น้ำตก|ภูเขา|ดอย/],
    ['ไหว้พระ', /วัด|พระธาตุ|พระพุทธ/],
    ['ชมสถาปัตยกรรม', /สถาปัตยกรรม|เจดีย์|โบราณสถาน/],
    ['ถ่ายภาพ', /ถ่ายภาพ|ถ่ายรูป|จุดชมวิว|ทิวทัศน์/],
  ] as const;
  const destinationActivities = activityOptions
    .filter(([, pattern]) => pattern.test(`${attraction.title} ${attraction.description}`))
    .map(([activity]) => activity);
  const estimatedCost = typeof locationState?.entranceFee === 'number'
    ? (locationState.entranceFee === 0 ? 'ไม่มีค่าเข้า' : `${locationState.entranceFee.toLocaleString('th-TH')} บาท`)
    : 'ไม่มีข้อมูลค่าใช้จ่ายจากแหล่งข้อมูล';
  const recommendedTime = 'ไม่มีข้อมูลช่วงเวลาที่แนะนำจากแหล่งข้อมูล';
  const destinationProvince = getProvince(
    attraction.location || formatAddress(detailedAddress) || verifiedLocation,
    locationState?.province,
  );
  const highlightIcons = isSea
    ? [Waves, Ship, Camera]
    : isWaterRelatedNature
      ? [Droplets, Leaf, Camera]
      : isTempleOrCulture
        ? [Landmark, Sparkles, Camera]
        : isNature
          ? [Leaf, Sunrise, Camera]
          : [Sparkles, MapPin, Camera];
  const travelKnow = [
    displayHours ? `เวลาเปิด-ปิด: ${displayHours}` : '',
    locationState?.phone || placeDetails.phone ? `โทรสอบถาม: ${placeDetails.phone || locationState?.phone}` : '',
    locationState?.website ? `เว็บไซต์: ${locationState.website}` : '',
  ].filter(Boolean);
  const travelCaution = locationState?.travelCaution || attraction.travelCaution || 'ไม่มีข้อมูลข้อควรระวัง';
  const [marine, setMarine] = useState<{ wind: number; wave: number } | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setUserCoordinates({ latitude: coords.latitude, longitude: coords.longitude }),
      () => setUserCoordinates(null),
      { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000, timeout: 10 * 1000 },
    );
  }, []);

  useEffect(() => {
    localStorage.setItem('favorite-attractions', JSON.stringify(favoriteIds));
  }, [favoriteIds]);

  useEffect(() => {
    if (!coordinates?.lat || !coordinates.lon) return;

    const controller = new AbortController();
    fetchWindyWeather(coordinates.lat, coordinates.lon)
      .then(setWeather)
      .catch(() => undefined);

    return () => controller.abort();
  }, [coordinates?.lat, coordinates?.lon]);

  useEffect(() => {
    if (!coordinates?.lat || !coordinates.lon) return;

    const controller = new AbortController();
    const query = `[out:json][timeout:20];(nwr(around:10000,${coordinates.lat},${coordinates.lon})[name][tourism];nwr(around:10000,${coordinates.lat},${coordinates.lon})[name][historic];nwr(around:10000,${coordinates.lat},${coordinates.lon})[name][natural];nwr(around:10000,${coordinates.lat},${coordinates.lon})[name][leisure~"park|nature_reserve|garden"];);out center tags;`;
    fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((data: { elements?: Array<{ id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: { name?: string; tourism?: string; historic?: string; natural?: string; leisure?: string } }> }) => {
        setNearbyPlaces((data.elements || [])
          .map((place) => ({
            id: place.id,
            name: place.tags?.name || '',
            type: place.tags?.tourism || place.tags?.historic || place.tags?.natural || place.tags?.leisure || 'แหล่งท่องเที่ยว',
            lat: place.lat ?? place.center?.lat,
            lon: place.lon ?? place.center?.lon,
          }))
          .filter((place): place is NearbyPlace => Boolean(place.name && place.lat && place.lon))
          .filter((place) => place.name !== attraction.title)
          .slice(0, 3));
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [coordinates?.lat, coordinates?.lon, attraction.title]);

  useEffect(() => {
    if (!isSea || !coordinates?.lat || !coordinates.lon) return;

    const controller = new AbortController();
    fetch(
      `https://marine-api.open-meteo.com/v1/marine?latitude=${coordinates.lat}&longitude=${coordinates.lon}&current=wave_height,wind_wave_height&hourly=wind_speed_10m&forecast_days=1&timezone=auto`,
      { signal: controller.signal },
    )
      .then((response) => response.json())
      .then((data: { current?: { wave_height?: number; wind_wave_height?: number }; hourly?: { wind_speed_10m?: number[] } }) => {
        const wave = data.current?.wave_height ?? data.current?.wind_wave_height;
        if (typeof wave === 'number') setMarine({ wind: 0, wave: Number(wave.toFixed(1)) });
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [coordinates?.lat, coordinates?.lon, isSea]);

  useEffect(() => {
    if (!coordinates?.lat || !coordinates.lon) return;

    const controller = new AbortController();
    fetch(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${coordinates.lat}&longitude=${coordinates.lon}&current=pm2_5,us_aqi&timezone=auto`,
      { signal: controller.signal },
    )
      .then((response) => response.json())
      .then((data: { current?: { pm2_5?: number; us_aqi?: number } }) => {
        if (typeof data.current?.pm2_5 === 'number' && typeof data.current.us_aqi === 'number') {
          setAirQuality({ pm25: Math.round(data.current.pm2_5), aqi: Math.round(data.current.us_aqi) });
        }
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [coordinates?.lat, coordinates?.lon]);

  const forecastLabels = ['วันนี้', 'พรุ่งนี้', 'มะรืน'];
  const weatherTheme = !weather
    ? { card: 'from-sky-50 via-blue-50 to-indigo-100 text-sky-950', muted: 'text-sky-700', icon: '⏳', label: 'กำลังโหลดข้อมูล' }
    : weather.condition === 'thunderstorm'
      ? { card: 'from-indigo-900 via-blue-950 to-slate-900 text-white', muted: 'text-white/75', icon: '⛈️', label: 'ฝนฟ้าคะนอง' }
      : weather.condition === 'rain'
        ? { card: 'from-slate-600 via-blue-800 to-slate-700 text-white', muted: 'text-white/75', icon: '🌧️', label: 'ฝนตก' }
        : weather.isNight
          ? { card: 'from-slate-800 via-indigo-900 to-slate-900 text-white', muted: 'text-white/75', icon: '🌙', label: 'กลางคืน' }
          : weather.condition === 'cloudy'
            ? { card: 'from-slate-200 via-sky-100 to-blue-200 text-slate-800', muted: 'text-slate-600', icon: '☁️', label: 'มีเมฆ' }
            : { card: 'from-sky-100 via-blue-50 to-cyan-100 text-sky-950', muted: 'text-sky-700', icon: '☀️', label: 'อากาศดี' };
  const airLevel = !airQuality
    ? 'loading'
    : airQuality.pm25 <= 15 && airQuality.aqi <= 50
      ? 'safe'
      : airQuality.pm25 <= 37.5 && airQuality.aqi <= 100
        ? 'moderate'
        : 'danger';
  const airCardStyle = airLevel === 'safe'
    ? 'bg-green-50 border-green-500 text-green-800'
    : airLevel === 'danger'
      ? 'bg-red-50 border-red-500 text-red-800'
      : 'bg-yellow-50 border-yellow-400 text-yellow-800';
  const airIconStyle = airLevel === 'safe'
    ? 'bg-green-500'
    : airLevel === 'danger'
      ? 'bg-red-500'
      : 'bg-yellow-400';
  const airStatusText = airLevel === 'safe' ? 'อยู่ในระดับดี' : airLevel === 'danger' ? 'อยู่ในระดับอันตราย' : 'อยู่ในระดับปานกลาง';
  const travelStatus = !weather
    ? { label: 'กำลังตรวจสอบสภาพอากาศ', style: 'border-slate-200 bg-slate-50 text-slate-700', icon: Cloud }
    : weather.condition === 'thunderstorm' || airLevel === 'danger'
      ? { label: 'ไม่แนะนำ', style: 'border-red-200 bg-red-50 text-red-800', icon: AlertTriangle }
      : weather.condition === 'rain' || weather.currentRain > 0 || weather.rain[0] > 50 || airLevel === 'moderate'
        ? { label: 'ควรระวัง', style: 'border-amber-200 bg-amber-50 text-amber-800', icon: AlertTriangle }
        : { label: 'เหมาะเที่ยว', style: 'border-emerald-200 bg-emerald-50 text-emerald-800', icon: Cloud };
  const TravelStatusIcon = travelStatus.icon;
  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <div className="app-shell shadow-xl lg:shadow-none">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white px-4 pb-4 pt-12 shadow-sm sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <a href="/" className="p-2 -ml-2" aria-label="ย้อนกลับ">
              <ArrowLeft className="w-6 h-6 text-[#1F2E7A]" />
            </a>
            <h1 className="font-semibold text-[#1F2E7A]">Thailand</h1>
          </div>
        </div>

        {/* Content */}
        <div className="app-content">
          {/* Title */}
          <h2 className="text-2xl font-bold text-[#1F2E7A] mb-4">{attraction.title}</h2>

          {/* Image Gallery */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {placeImages.length > 0 ? placeImages.map((img, idx) => (
              <img
                key={img}
                src={img}
                alt={`${attraction.title} ${idx + 1}`}
                className="w-full aspect-[4/3] object-cover rounded-xl"
              />
            )) : (
              <div className="col-span-3 aspect-[4/3] rounded-xl bg-gray-100 flex items-center justify-center text-sm text-gray-400">
                กำลังโหลดรูปสถานที่
              </div>
            )}
          </div>

          {/* Travel Information Card */}
          <section className="mb-4 overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-6">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-[#1F2E7A]">
                  {locationState?.category || placeDetails.category || 'สถานที่ท่องเที่ยว'}
                </span>
                <span className="flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                  <MapPin className="h-3.5 w-3.5" />
                  {destinationProvince}
                </span>
              </div>
              <h2 className="text-xl font-bold leading-tight text-slate-900 sm:text-2xl">{attraction.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">{attraction.description}</p>
            </div>

            <div className="mb-6">
              <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-[#1F2E7A]">
                <Sparkles className="h-4 w-4 text-amber-500" />
                จุดเด่น
              </h3>
              <ul className="grid gap-3 sm:grid-cols-2">
                {destinationHighlights.map((highlight, index) => {
                  const HighlightIcon = highlightIcons[index];
                  return (
                    <li key={highlight} className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3">
                      <span className="rounded-xl bg-blue-50 p-2 text-[#1F2E7A]">
                        <HighlightIcon className="h-4 w-4" />
                      </span>
                      <span className="pt-1 text-sm leading-relaxed text-slate-700">{highlight}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-100 p-3">
                <div className="mb-2 flex items-center gap-2 text-amber-600">
                  <Star className="h-4 w-4 fill-current" />
                  <span className="text-xs font-medium text-slate-500">คะแนนรีวิว</span>
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  {typeof locationState?.rating === 'number'
                    ? `${locationState.rating.toFixed(1)} / 5${locationState.reviewCount !== undefined ? ` (${locationState.reviewCount.toLocaleString('th-TH')} รีวิว)` : ''}`
                    : 'ยังไม่มีข้อมูล'}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-100 p-3">
                <div className="mb-2 flex items-center gap-2 text-[#1F2E7A]">
                  <Sunrise className="h-4 w-4" />
                  <span className="text-xs font-medium text-slate-500">ช่วงเวลาที่แนะนำ</span>
                </div>
                <p className="text-sm font-semibold leading-relaxed text-slate-800">{recommendedTime}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 p-3">
                <div className="mb-2 flex items-center gap-2 text-emerald-700">
                  <Banknote className="h-4 w-4" />
                  <span className="text-xs font-medium text-slate-500">ค่าใช้จ่ายโดยประมาณ</span>
                </div>
                <p className="text-sm font-semibold leading-relaxed text-slate-800">{estimatedCost}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 p-3">
                <div className="mb-2 flex items-center gap-2 text-[#1F2E7A]">
                  <MapPin className="h-4 w-4" />
                  <span className="text-xs font-medium text-slate-500">จังหวัด</span>
                </div>
                <p className="text-sm font-semibold text-slate-800">{destinationProvince}</p>
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-base font-bold text-[#1F2E7A]">กิจกรรมที่น่าสนใจ</h3>
              <div className="flex flex-wrap gap-2">
                {destinationActivities.map((activity) => (
                  <span key={activity} className="rounded-full bg-blue-50 px-3 py-2 text-xs font-medium text-[#1F2E7A] sm:text-sm">
                    {activity}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
              <div>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-[#1F2E7A]">
                  <Navigation className="h-4 w-4" />
                  ข้อมูลสำหรับการเดินทาง
                </h3>
                <p className="text-sm leading-relaxed text-slate-600">
                  วิธีเดินทางและเวลาเดินทางขึ้นอยู่กับจุดเริ่มต้น กรุณาเปิดแผนที่เพื่อคำนวณเส้นทางล่าสุด
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  เวลาเปิด-ปิด: {displayHours || 'ไม่มีข้อมูลจากแหล่งข้อมูล'}
                </p>
                {fullMapUrl && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a href={fullMapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-[#1F2E7A] hover:bg-blue-100">
                      <MapPin className="h-4 w-4" />
                      ดูบนแผนที่
                    </a>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(coordinates?.lat && coordinates.lon ? `${coordinates.lat},${coordinates.lon}` : `${attraction.title} ${destinationProvince}`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl bg-[#1F2E7A] px-3 py-2 text-xs font-semibold text-white hover:bg-[#162056]"
                    >
                      <Navigation className="h-4 w-4" />
                      นำทาง
                    </a>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <div>
                  <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-[#1F2E7A]">
                    <Lightbulb className="h-4 w-4 text-amber-500" />
                    สิ่งที่ควรรู้
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-600">{travelKnow}</p>
                </div>
                <div>
                  <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-[#1F2E7A]">
                    <ShieldAlert className="h-4 w-4 text-orange-500" />
                    ข้อควรระวัง
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-600">{travelCaution}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Location Info */}
          <div className="bg-white rounded-2xl shadow-md p-4 mb-4 space-y-3">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-[#1F2E7A] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500 mb-1">ที่ตั้ง</p>
                <p className="text-sm text-gray-800">{formatAddress(detailedAddress) || verifiedLocation || attraction.location}</p>
              </div>
            </div>
            {(locationState?.category || placeDetails.category) && (
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-[#1F2E7A] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500 mb-1">ประเภทสถานที่</p>
                  <p className="text-sm text-gray-800">{locationState?.category || placeDetails.category}</p>
                </div>
              </div>
            )}
            {(placeDetails.operator || attraction.phone || placeDetails.phone) && (
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-[#1F2E7A] mt-0.5 flex-shrink-0" />
                <div>
                  {placeDetails.operator && <><p className="text-xs text-gray-500 mb-1">ผู้ดูแล</p><p className="text-sm text-gray-800">{placeDetails.operator}</p></>}
                  {(attraction.phone || placeDetails.phone) && <><p className="text-xs text-gray-500 mb-1 mt-2">โทรศัพท์</p><p className="text-sm text-gray-800">{placeDetails.phone || attraction.phone}</p></>}
                </div>
              </div>
            )}
            {displayHours && (
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-[#1F2E7A] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500 mb-1">เวลาทำการ</p>
                  <p className="text-sm text-gray-800">{displayHours}</p>
                  <p className="text-xs text-gray-500 mt-1">วันหยุด: {getHolidayInfo(displayHours)}</p>
                  {dailyHours.size > 0 && (
                    <div className="mt-2 space-y-1 text-sm text-gray-700">
                      {weekDays.map(([code, label]) => (
                        <div key={code} className="grid grid-cols-[7rem_1fr] gap-2">
                          <span>{label}</span><span>{dailyHours.get(code) || 'ไม่ระบุ'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            {locationState?.facebook && <div className="flex items-start gap-3">
              <Facebook className="w-5 h-5 text-[#1F2E7A] mt-0.5 flex-shrink-0" />
              <div><p className="text-xs text-gray-500 mb-1">เพจ Facebook</p><a href={locationState.facebook} target="_blank" rel="noreferrer" className="text-sm text-blue-600 break-all">{locationState.facebook}</a></div>
            </div>}
            {mapUrl && (
              <div className="overflow-hidden rounded-xl border border-gray-200">
                <iframe
                  title={`แผนที่ ${attraction.title}`}
                  src={mapUrl}
                  className="h-56 w-full"
                  loading="lazy"
                />
                {fullMapUrl && (
                  <a
                    href={fullMapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center bg-blue-50 py-3 text-sm font-semibold text-blue-700"
                  >
                    กดเพื่อดูแผนที่แบบเต็ม
                  </a>
                )}
              </div>
            )}
          </div>

          {nearbyPlaces.length > 0 && (
            <div className="bg-[#1F2E7A] rounded-2xl p-4 mb-4">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                สถานที่ใกล้เคียงที่แนะนำ
              </h3>
              <p className="text-white/80 text-sm mb-3">จุดที่อยู่ใกล้กับสถานที่นี้จากข้อมูลแผนที่จริง</p>
              <div className="space-y-2">
                {nearbyPlaces.map((place) => (
                  <a
                    key={place.id}
                    href={`https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lon}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-xl bg-white p-3"
                  >
                    <p className="font-semibold text-[#1F2E7A]">{place.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{place.type} · เปิดแผนที่</p>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Weather Forecast */}
          <button
            type="button"
            onClick={() => setShowWeatherDetails((isOpen) => !isOpen)}
            aria-expanded={showWeatherDetails}
            className={`relative w-full overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-br p-4 mb-4 text-left shadow-sm ${weatherTheme.card}`}
          >
            <span className="weather-visual" aria-hidden="true">
              {weather?.condition === 'clear' && !weather.isNight ? <span className="weather-sun-graphic weather-sun" /> : weather?.condition === 'thunderstorm' || weather?.condition === 'rain' ? <><span className="weather-cloud-graphic weather-cloud" /><span className="weather-rain-graphic weather-rain" />{weather.condition === 'thunderstorm' && <span className="weather-lightning-graphic weather-lightning" />}</> : weather?.isNight ? <><span className="weather-moon-graphic" /><span className="weather-stars-graphic weather-stars" /></> : <span className="weather-cloud-graphic weather-cloud" />}
            </span>
            {weather?.condition === 'cloudy' && <span className="weather-cloud pointer-events-none absolute right-14 top-14 text-3xl opacity-25" aria-hidden="true">☁︎</span>}
            <div className="relative z-10">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <span className="text-xl" aria-hidden="true">{weatherTheme.icon}</span>
              <span className="flex-1">พยากรณ์อากาศ</span>
              <span className="text-xs font-normal opacity-80">{showWeatherDetails ? 'ซ่อนรายละเอียด' : 'แตะเพื่อดูรายละเอียด'}</span>
            </h3>
            {!weather ? (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">ไม่พบข้อมูลสภาพอากาศแบบเรียลไทม์</div>
            ) : weather.condition === 'thunderstorm' ? (
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-100 px-3 py-2 text-xs font-semibold text-red-800">
                <AlertTriangle className="h-4 w-4 text-red-600" /> ไม่แนะนำให้เดินทาง คาดว่าจะมีฝนฟ้าคะนอง
              </div>
            ) : (weather.currentRain > 0 || weather.rain[0] > 0) ? (
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900">
                <AlertTriangle className="h-4 w-4 text-amber-600" /> ควรระวัง คาดว่าจะมีฝนตกวันนี้ เตรียมร่มก่อนเดินทาง
              </div>
            ) : (
              <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-800">อากาศดี เหมาะสำหรับการเดินทาง</div>
            )}
            <div className="grid grid-cols-3 gap-3 text-center">
              {forecastLabels.map((label, index) => (
                <div key={label}>
                  <p className={`text-xs mb-1 ${weatherTheme.muted}`}>{label}</p>
                  <p className="text-2xl font-bold">{weather?.temperatures[index] ?? '--'}{weather ? '°' : ''}</p>
                  <div className="flex items-center justify-center gap-1 text-xs mt-1">
                    <Droplets className="w-3 h-3" />
                    <span>{weather?.rain[index] ?? '--'}{weather ? '%' : ''}</span>
                  </div>
                </div>
              ))}
            </div>
            {showWeatherDetails && (
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-sky-200 pt-3 text-sm">
                <div>
                  <p className="text-xs text-sky-700">ฝนที่กำลังตก</p>
                  <p className="font-semibold">{weather ? `${weather.currentRain.toFixed(1)} มม.` : 'กำลังโหลด...'}</p>
                </div>
                <div>
                  <p className="text-xs text-sky-700">ความเร็วลม</p>
                  <p className="font-semibold">{weather ? `${weather.wind} กม./ชม.` : 'กำลังโหลด...'}</p>
                </div>
              </div>
            )}
            </div>
          </button>

          {isSea && (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 mb-4">
              <h3 className="font-semibold text-sky-900 mb-3 flex items-center gap-2">
                <Waves className="w-5 h-5 text-sky-600" />
                สภาพทะเลและลม
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white/80 p-3">
                  <div className="flex items-center gap-2 text-sky-700 mb-1"><Wind className="w-4 h-4" /><span className="text-xs">ความเร็วลม</span></div>
                  <p className="text-xl font-bold text-sky-900">{weather?.wind ?? '--'} <span className="text-xs font-normal">กม./ชม.</span></p>
                </div>
                <div className="rounded-xl bg-white/80 p-3">
                  <div className="flex items-center gap-2 text-sky-700 mb-1"><Waves className="w-4 h-4" /><span className="text-xs">ความสูงคลื่น</span></div>
                  <p className="text-xl font-bold text-sky-900">{marine?.wave ?? '--'} <span className="text-xs font-normal">ม.</span></p>
                </div>
              </div>
              <p className="text-xs text-sky-700 mt-3">ข้อมูลตามพิกัดสถานที่จาก Marine API</p>
            </div>
          )}

              {isWaterRelatedNature && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 mb-4">
              <h3 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
                <CloudRain className="w-5 h-5 text-amber-600" />
                เฝ้าระวังน้ำป่าไหลหลาก
              </h3>
              <p className="text-sm text-amber-800 leading-relaxed">
                ฝนที่กำลังตกในพื้นที่ {weather ? `${weather.currentRain.toFixed(1)} มม.` : '--'} · โอกาสฝนวันนี้ {weather ? `${weather.rain[0]}%` : '--'} ควรตรวจสอบประกาศของอุทยานก่อนเดินทาง และหลีกเลี่ยงลำห้วยเมื่อฝนตกหนัก
              </p>
            </div>
          )}

          {/* PM2.5 Warning Card - Clickable */}
          <button
            onClick={() => navigate(`/risk-alert/${id}`, { state: { ...locationState, title: attraction.title, pm25: airQuality?.pm25, aqi: airQuality?.aqi } })}
            className={`w-full border-2 rounded-2xl p-4 text-left transition-colors ${airCardStyle}`}
          >
            <div className="flex items-start gap-3">
              <div className={`${airIconStyle} rounded-full p-2`}>
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">ค่า PM2.5</h3>
                <p className="text-sm mb-2">
                  ค่า PM2.5 {airQuality ? `${airStatusText} ${airQuality.pm25} µg/m³` : 'กำลังโหลดข้อมูล...'}
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-black/10 rounded-full h-2">
                    <div className="bg-current h-2 rounded-full" style={{ width: `${Math.min(100, airQuality?.pm25 ?? 0)}%` }}></div>
                  </div>
                  <span className="text-xs font-semibold">{airQuality?.pm25 ?? '--'}</span>
                </div>
                <p className="text-xs mt-2">แตะเพื่อดูรายละเอียด</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
