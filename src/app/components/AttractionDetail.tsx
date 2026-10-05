import { useLocation, useNavigate, useParams } from 'react-router';
import { ArrowLeft, MapPin, Clock, Phone, Cloud, Droplets, Wind, Waves, CloudRain, CloudLightning, Moon, Sun, LoaderCircle, AlertTriangle, Star, Sunrise, Banknote, Sparkles, Camera, Ship, Landmark, Leaf, Navigation, Lightbulb, ShieldAlert, Heart, Thermometer, Compass } from 'lucide-react';
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
    recommendedTime?: string;
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
    currentTemperature: number | null;
    wind: number;
    currentRain: number;
    humidity: number | null;
    updatedAt: string;
    condition: 'clear' | 'cloudy' | 'rain' | 'thunderstorm';
    isNight: boolean;
  } | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState(false);
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
    : 'ไม่มีราคาในข้อมูลสถานที่ · ค่าใช้จ่ายขึ้นกับกิจกรรม/ผู้ให้บริการ ควรตรวจสอบก่อนเดินทาง';
  const sourceRecommendedTime = locationState?.recommendedTime?.trim();
  const recommendedTime = sourceRecommendedTime && !/^(ไม่มีข้อมูล|ไม่มีข้อมูลช่วงเวลาที่แนะนำจากแหล่งข้อมูล)$/i.test(sourceRecommendedTime)
    ? sourceRecommendedTime
    : (displayHours && !/เปิดตลอด\s*24\s*ชั่วโมง/i.test(displayHours)
      ? `เวลาเปิดให้บริการ ${displayHours}`
      : isSea
        ? 'ช่วงเช้าหรือเย็น (คำแนะนำทั่วไป) · ตรวจสอบสภาพทะเลและรอบเรือก่อนเดินทาง'
        : isNature || isWaterRelatedNature
          ? 'ช่วงเช้า (คำแนะนำทั่วไป) · ตรวจสอบสภาพอากาศและประกาศพื้นที่'
          : 'ตรวจสอบเวลาเปิดทำการและช่วงเวลาที่เหมาะสมกับสถานที่ก่อนเดินทาง');
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
  const sourceTravelCaution = locationState?.travelCaution?.trim() || attraction.travelCaution?.trim();
  const travelCaution = sourceTravelCaution && !/^(ไม่มีข้อมูล|ไม่มีข้อมูลข้อควรระวัง)$/i.test(sourceTravelCaution)
    ? sourceTravelCaution
    : (isSea
      ? 'ตรวจสอบสภาพทะเลและรอบเรือกับผู้ให้บริการก่อนออกเดินทาง สวมเสื้อชูชีพเมื่อโดยสารเรือ และปฏิบัติตามคำแนะนำของเจ้าหน้าที่'
      : isWaterRelatedNature
        ? 'ตรวจสอบประกาศปิดพื้นที่และสภาพอากาศก่อนเดินทาง หลีกเลี่ยงลำธารหรือน้ำตกเมื่อฝนตกหนัก และใช้เส้นทางที่กำหนด'
        : isNature
          ? 'ตรวจสอบประกาศและเวลาเปิดของพื้นที่ สวมรองเท้าที่เหมาะสม และเตรียมน้ำดื่มให้เพียงพอ'
          : isTempleOrCulture
            ? 'แต่งกายสุภาพ ปฏิบัติตามกฎของสถานที่ และตรวจสอบเวลาเปิดทำการก่อนเดินทาง'
            : 'ตรวจสอบเวลาเปิดทำการและประกาศจากผู้ดูแลสถานที่ก่อนเดินทาง');
  const [marine, setMarine] = useState<{ wind: number | null; wave: number } | null>(null);

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
    let isCurrentRequest = true;
    setWeather(null);
    setWeatherError(false);
    setWeatherLoading(true);

    if (!coordinates?.lat || !coordinates.lon) {
      setWeatherError(true);
      setWeatherLoading(false);
      return () => { isCurrentRequest = false; };
    }

    fetchWindyWeather(coordinates.lat, coordinates.lon)
      .then((data) => {
        if (isCurrentRequest) setWeather(data);
      })
      .catch(() => {
        if (isCurrentRequest) setWeatherError(true);
      })
      .finally(() => {
        if (isCurrentRequest) setWeatherLoading(false);
      });

    return () => { isCurrentRequest = false; };
  }, [id, attraction.title, coordinates?.lat, coordinates?.lon]);

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
    setMarine(null);
    fetch(
      `https://marine-api.open-meteo.com/v1/marine?latitude=${coordinates.lat}&longitude=${coordinates.lon}&current=wave_height,wind_wave_height&hourly=wind_speed_10m&forecast_days=1&timezone=auto`,
      { signal: controller.signal },
    )
      .then((response) => response.json())
      .then((data: { current?: { wave_height?: number; wind_wave_height?: number }; hourly?: { wind_speed_10m?: number[] } }) => {
        const wave = data.current?.wave_height ?? data.current?.wind_wave_height;
        const wind = data.hourly?.wind_speed_10m?.find((value) => Number.isFinite(value));
        if (typeof wave === 'number') {
          setMarine({ wind: typeof wind === 'number' ? Math.round(wind) : null, wave: Number(wave.toFixed(1)) });
        }
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
    ? { card: 'from-sky-50 via-blue-50 to-indigo-100 text-sky-950', muted: 'text-sky-700', icon: LoaderCircle, label: 'กำลังโหลดข้อมูล' }
    : weather.condition === 'thunderstorm'
      ? { card: 'from-indigo-900 via-blue-950 to-slate-900 text-white', muted: 'text-white/75', icon: CloudLightning, label: 'ฝนฟ้าคะนอง' }
      : weather.condition === 'rain'
        ? { card: 'from-slate-600 via-blue-800 to-slate-700 text-white', muted: 'text-white/75', icon: CloudRain, label: 'ฝนตก' }
        : weather.isNight
          ? { card: 'from-slate-800 via-indigo-900 to-slate-900 text-white', muted: 'text-white/75', icon: Moon, label: 'กลางคืน' }
          : weather.condition === 'cloudy'
            ? { card: 'from-slate-200 via-sky-100 to-blue-200 text-slate-800', muted: 'text-slate-600', icon: Cloud, label: 'มีเมฆ' }
            : { card: 'from-sky-100 via-blue-50 to-cyan-100 text-sky-950', muted: 'text-sky-700', icon: Sun, label: 'อากาศดี' };
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
  const WeatherIcon = weatherTheme.icon;
  const weatherNeedsCaution = Boolean(
    weather && (
      weather.condition === 'thunderstorm'
      || airLevel === 'danger'
      || weather.currentRain >= 10
      || (weather.rain[0] ?? 0) >= 70
      || weather.wind >= 40
      || (isSea && (marine?.wave ?? 0) >= 2)
    ),
  );
  const weatherCautionText = weather?.condition === 'thunderstorm'
    ? 'คาดการณ์ฝนฟ้าคะนอง โปรดติดตามประกาศในพื้นที่และหลีกเลี่ยงกิจกรรมกลางแจ้ง'
    : isSea && (marine?.wave ?? 0) >= 2
      ? 'คลื่นค่อนข้างสูง ควรตรวจสอบประกาศจากผู้ให้บริการเรือและหลีกเลี่ยงกิจกรรมทางทะเลหากไม่ปลอดภัย'
      : (weather?.wind ?? 0) >= 40
        ? 'ลมแรง ควรระมัดระวังการเดินทางและกิจกรรมกลางแจ้ง'
        : (weather?.currentRain ?? 0) >= 10 || (weather?.rain[0] ?? 0) >= 70
          ? 'มีฝนตกหรือมีโอกาสฝนสูง ควรเตรียมอุปกรณ์กันฝนและตรวจสอบประกาศในพื้นที่'
          : airLevel === 'danger'
            ? `คุณภาพอากาศอยู่ในระดับอันตราย (${airQuality?.pm25 ?? '—'} µg/m³) ลดกิจกรรมกลางแจ้งและติดตามคำแนะนำด้านสุขภาพ`
          : '';
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

        <main className="app-content">
          <section
            className="relative mb-6 flex min-h-[300px] items-end overflow-hidden rounded-[22px] bg-slate-300 bg-cover bg-center shadow-sm sm:min-h-[360px] lg:min-h-[390px]"
            style={placeImages[0] ? { backgroundImage: `linear-gradient(90deg, rgba(10,37,86,.82), rgba(10,37,86,.36) 58%, rgba(10,37,86,.08)), url("${placeImages[0]}")` } : undefined}
          >
            {!placeImages[0] && <div className="absolute inset-0 bg-gradient-to-br from-[#1F2E7A] to-sky-600" />}
            <div className="absolute inset-0 bg-gradient-to-t from-[#08234f]/75 via-transparent to-transparent" />
            <div className="relative z-[1] flex w-full flex-col gap-6 p-5 text-white sm:p-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="mb-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100/95 px-3 py-1.5 text-xs font-semibold text-[#1F2E7A]">
                  {isSea ? <Waves className="h-3.5 w-3.5" /> : <Compass className="h-3.5 w-3.5" />}
                  {locationState?.category || placeDetails.category || 'สถานที่ท่องเที่ยว'}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/95 px-3 py-1.5 text-xs font-semibold text-emerald-800">
                  <MapPin className="h-3.5 w-3.5" />
                  {destinationProvince}
                  </span>
                </div>
                <h2 className="text-3xl font-black leading-tight sm:text-5xl">{attraction.title}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/90 sm:text-base">{attraction.description}</p>
                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium">
                  {typeof locationState?.rating === 'number' ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <strong>{locationState.rating.toFixed(1)}/5</strong>
                    {locationState.reviewCount !== undefined && <span className="text-white/80">({locationState.reviewCount.toLocaleString('th-TH')} รีวิว)</span>}
                  </span>
                  ) : <span className="text-white/80">ยังไม่มีข้อมูลคะแนนรีวิว</span>}
                  {destinationDistance !== null && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    {destinationDistance.toFixed(1)} กม. จากตำแหน่งของคุณ
                  </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFavoriteIds((current) => current.includes(favoriteKey) ? current.filter((key) => key !== favoriteKey) : [...current, favoriteKey])}
                  aria-pressed={isFavorite}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-[#1F2E7A] shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-50"
                >
                  <Heart className={`h-4 w-4 ${isFavorite ? 'fill-rose-500 text-rose-500' : ''}`} />
                  {isFavorite ? 'บันทึกแล้ว' : 'บันทึกสถานที่'}
                </button>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(coordinates?.lat && coordinates.lon ? `${coordinates.lat},${coordinates.lon}` : `${attraction.title} ${destinationProvince}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#1F2E7A] px-5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-900"
                >
                  <Navigation className="h-4 w-4" />
                  นำทาง
                </a>
              </div>
            </div>
          </section>

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.95fr)]">
            <div className="min-w-0 space-y-5">
              <section className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/70 to-white p-4 shadow-sm sm:p-5">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-[#1F2E7A]">
                  <Star className="h-5 w-5 fill-amber-400 text-amber-500" />
                  จุดเด่นของสถานที่
                </h3>
                {destinationHighlights.length ? (
                  <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {destinationHighlights.map((highlight, index) => {
                    const HighlightIcon = highlightIcons[index % highlightIcons.length];
                    return (
                      <li key={highlight} className="flex min-h-24 items-start gap-3 rounded-xl bg-white/90 p-3 ring-1 ring-blue-50">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                              <HighlightIcon className="h-5 w-5" />
                        </span>
                        <span className="text-xs font-medium leading-relaxed text-slate-700 sm:text-sm">{highlight}</span>
                      </li>
                    );
                  })}
                  </ul>
                ) : <p className="text-sm text-slate-500">ไม่มีข้อมูลจุดเด่นจากแหล่งข้อมูล</p>}
              </section>

              {destinationActivities.length > 0 && placeImages.length > 0 && (
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-[#1F2E7A]">
                  <Compass className="h-5 w-5" />
                  กิจกรรมที่น่าสนใจ
                  </h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {destinationActivities.slice(0, 4).map((activity, index) => {
                    const ActivityIcon = /ดำน้ำ|เล่นน้ำ/.test(activity)
                      ? Waves
                      : activity === 'ล่องเรือ'
                        ? Ship
                        : activity === 'เดินป่า' || activity === 'ชมธรรมชาติ'
                              ? Compass
                              : activity === 'ไหว้พระ' || activity === 'ชมสถาปัตยกรรม'
                            ? Landmark
                            : Camera;
                    const activityImage = placeImages[index % placeImages.length];
                    return (
                      <article key={activity} className="group overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:-translate-y-1 hover:shadow-md">
                        <div className="relative h-28 overflow-hidden sm:h-32">
                              <img src={activityImage} alt={`${attraction.title} - ${activity}`} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                              <span className="absolute bottom-2 left-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-[#1F2E7A] shadow-sm">
                            <ActivityIcon className="h-4 w-4" />
                              </span>
                        </div>
                        <div className="flex min-h-11 items-center justify-between gap-2 px-3 py-2">
                              <span className="text-xs font-semibold text-[#1F2E7A] sm:text-sm">{activity}</span>
                              <ArrowLeft className="h-4 w-4 rotate-180 text-blue-500" />
                        </div>
                      </article>
                    );
                  })}
                  </div>
                </section>
              )}

              <section className={`relative overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-br p-4 shadow-sm sm:p-5 ${weatherTheme.card}`}>
                <span className="weather-visual" aria-hidden="true">
                  {weather?.condition === 'clear' && !weather.isNight
                  ? <span className="weather-sun-graphic weather-sun" />
                  : weather?.condition === 'thunderstorm' || weather?.condition === 'rain'
                    ? <><span className="weather-cloud-graphic weather-cloud" /><span className="weather-rain-graphic weather-rain" />{weather.condition === 'thunderstorm' && <span className="weather-lightning-graphic weather-lightning" />}</>
                    : weather?.isNight
                      ? <><span className="weather-moon-graphic" /><span className="weather-stars-graphic weather-stars" /></>
                      : <span className="weather-cloud-graphic weather-cloud" />}
                </span>
                <div className="relative z-[1]">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-lg font-bold">
                    <WeatherIcon className="h-5 w-5" />
                    พยากรณ์อากาศ ({attraction.title})
                  </h3>
                  <span className="text-xs opacity-75">
                    {weather ? `อัปเดตล่าสุด ${new Date(weather.updatedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.` : ''}
                  </span>
                  </div>
                  {weather ? (
                  <>
                    <div className="mb-4 flex flex-wrap items-end gap-x-4 gap-y-1">
                      <p className="text-4xl font-black">{weather.currentTemperature != null ? `${weather.currentTemperature}°C` : '—'}</p>
                      <p className="pb-1 text-sm font-medium">{weatherTheme.label}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 border-y border-current/10 py-3 sm:grid-cols-4">
                      <div className="flex items-center gap-2"><CloudRain className="h-4 w-4 text-sky-500" /><span className="text-xs">ฝนวันนี้<br /><strong>{weather.rain[0] != null ? `${weather.rain[0]}%` : 'ไม่มีข้อมูล'}</strong></span></div>
                      <div className="flex items-center gap-2"><Wind className="h-4 w-4 text-blue-500" /><span className="text-xs">ความเร็วลม<br /><strong>{`${weather.wind} กม./ชม.`}</strong></span></div>
                      <div className="flex items-center gap-2"><Droplets className="h-4 w-4 text-cyan-600" /><span className="text-xs">ความชื้น<br /><strong>{weather.humidity != null ? `${weather.humidity}%` : 'ไม่มีข้อมูล'}</strong></span></div>
                      <div className="flex items-center gap-2"><Thermometer className="h-4 w-4 text-orange-500" /><span className="text-xs">ฝนปัจจุบัน<br /><strong>{weather.currentRain.toFixed(1)} มม.</strong></span></div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      {forecastLabels.map((label, index) => (
                        <div key={label} className="rounded-xl bg-white/55 p-2">
                              <p className={`text-xs ${weatherTheme.muted}`}>{label}</p>
                              <p className="text-lg font-bold">{weather.temperatures[index] != null ? `${weather.temperatures[index]}°` : '—'}</p>
                              <p className="text-[11px]">โอกาสฝน {weather.rain[index] != null ? `${weather.rain[index]}%` : '—'}</p>
                        </div>
                      ))}
                    </div>
                    {weatherNeedsCaution && (
                      <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-medium leading-relaxed text-amber-900">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                        <span><strong>ควรระวัง</strong> · {weatherCautionText}</span>
                      </div>
                    )}
                    {!weatherNeedsCaution && (
                      <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                        <Cloud className="h-4 w-4 shrink-0" />
                        เหมาะสำหรับการท่องเที่ยว
                      </div>
                    )}
                  </>
                  ) : weatherLoading ? (
                    <p className="rounded-xl border border-sky-100 bg-white/80 p-4 text-sm text-slate-600">กำลังโหลดสภาพอากาศตามพิกัดของสถานที่…</p>
                  ) : weatherError ? (
                    <p className="rounded-xl border border-amber-200 bg-white/80 p-4 text-sm text-amber-800">ไม่สามารถโหลดข้อมูลสภาพอากาศได้</p>
                  ) : <p className="rounded-xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-600">ไม่สามารถโหลดข้อมูลสภาพอากาศได้</p>}
                </div>
              </section>

            </div>

            <aside className="min-w-0 space-y-5">
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-[#1F2E7A]">รูปภาพเพิ่มเติม</h3>
                  {placeImages[1] && (
                  <a href={placeImages[1]} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-2 text-xs font-semibold text-[#1F2E7A] hover:bg-blue-100">
                    <Camera className="h-4 w-4" />
                    ดูรูปภาพเพิ่มเติม
                  </a>
                  )}
                </div>
                {placeImages.length > 1 ? (
                  <div className="grid grid-cols-2 gap-2">
                  {placeImages.slice(1).map((image, index) => (
                    <a key={image} href={image} target="_blank" rel="noreferrer" className="group relative block overflow-hidden rounded-xl">
                      <img src={image} alt={`${attraction.title} ภาพเพิ่มเติม ${index + 1}`} className="h-28 w-full object-cover transition-transform duration-300 group-hover:scale-105 sm:h-36" />
                    </a>
                  ))}
                  </div>
                ) : (
                  <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">{placeImages.length ? 'ไม่มีรูปภาพเพิ่มเติมจากแหล่งข้อมูล' : 'กำลังโหลดรูปภาพสถานที่'}</p>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-[#1F2E7A]">
                  <Landmark className="h-5 w-5" />
                  ข้อมูลสำคัญสำหรับการเดินทาง
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-[11px] text-slate-500"><Sunrise className="h-4 w-4 text-[#1F2E7A]" />ช่วงเวลาที่แนะนำ</p>
                  <p className="text-xs font-semibold text-slate-800">{recommendedTime || 'ไม่มีข้อมูล'}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-[11px] text-slate-500"><Banknote className="h-4 w-4 text-emerald-700" />ค่าใช้จ่าย</p>
                  <p className="text-xs font-semibold text-slate-800">{estimatedCost || 'ไม่มีข้อมูล'}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-[11px] text-slate-500"><Navigation className="h-4 w-4 text-[#1F2E7A]" />การเดินทาง</p>
                  <p className="text-xs font-semibold text-slate-800">{fullMapUrl ? 'เปิดแผนที่เพื่อคำนวณเส้นทาง' : 'ไม่มีข้อมูล'}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-[11px] text-slate-500"><MapPin className="h-4 w-4 text-[#1F2E7A]" />จังหวัด / ที่ตั้ง</p>
                  <p className="line-clamp-2 text-xs font-semibold text-slate-800">{destinationProvince || 'ไม่มีข้อมูล'}</p>
                  </div>
                </div>
                {fullMapUrl && (
                  <a href={fullMapUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1F2E7A] px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-900">
                  <Navigation className="h-4 w-4" />
                  นำทางไปสถานที่
                  </a>
                )}
              </section>

              {isSea && (
                <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-sm sm:p-5">
                  <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-sky-900">
                    <Waves className="h-5 w-5 text-sky-600" />
                    สภาพทะเลและลม
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white/85 p-3">
                      <p className="mb-1 flex items-center gap-2 text-xs text-sky-700"><Wind className="h-4 w-4" />ความเร็วลม</p>
                      <p className="text-lg font-bold text-sky-900">{marine?.wind != null ? `${marine.wind} กม./ชม.` : weather ? `${weather.wind} กม./ชม.` : 'ไม่มีข้อมูล'}</p>
                    </div>
                    <div className="rounded-xl bg-white/85 p-3">
                      <p className="mb-1 flex items-center gap-2 text-xs text-sky-700"><Waves className="h-4 w-4" />ความสูงคลื่น</p>
                      <p className="text-lg font-bold text-sky-900">{marine ? `${marine.wave} ม.` : 'ไม่มีข้อมูล'}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-sky-700">ข้อมูลตามพิกัดสถานที่จาก Marine API</p>
                </section>
              )}

              <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm sm:p-5">
                <h3 className="mb-2 flex items-center gap-2 text-base font-bold text-amber-900">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  ข้อควรรู้
                </h3>
                <p className="text-sm leading-relaxed text-amber-950">{travelCaution}</p>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-base font-bold text-[#1F2E7A]">
                  <MapPin className="h-5 w-5" />
                  ข้อมูลเพิ่มเติม
                  </h3>
                  {fullMapUrl && <a href={fullMapUrl} target="_blank" rel="noreferrer" aria-label="เปิดแผนที่" className="rounded-full p-2 text-[#1F2E7A] hover:bg-blue-50"><Navigation className="h-4 w-4" /></a>}
                </div>
                <div className="space-y-3 text-sm">
                  <div>
                  <p className="mb-1 text-xs text-slate-500">ที่อยู่</p>
                  <p className="leading-relaxed text-slate-700">{locationState?.location || verifiedLocation || attraction.location || formatAddress(detailedAddress) || 'ไม่มีข้อมูลที่อยู่'}</p>
                  </div>
                  {displayHours && (
                  <div>
                    <p className="mb-1 flex items-center gap-1.5 text-xs text-slate-500"><Clock className="h-4 w-4" />เวลาทำการ</p>
                    <p className="text-slate-700">{displayHours}</p>
                  </div>
                  )}
                  {(placeDetails.operator || attraction.phone || placeDetails.phone) && (
                  <div>
                    <p className="mb-1 flex items-center gap-1.5 text-xs text-slate-500"><Phone className="h-4 w-4" />ติดต่อ</p>
                    <p className="text-slate-700">{placeDetails.operator ? `${placeDetails.operator} · ` : ''}{placeDetails.phone || attraction.phone}</p>
                  </div>
                  )}
                  <div className="border-t border-slate-100 pt-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs text-slate-500"><Star className="h-4 w-4 text-amber-500" />รีวิวจากนักท่องเที่ยว</p>
                  {typeof locationState?.rating === 'number' ? (
                    <p className="font-semibold text-slate-800">{locationState.rating.toFixed(1)} / 5{locationState.reviewCount !== undefined ? ` · ${locationState.reviewCount.toLocaleString('th-TH')} รีวิว` : ''}</p>
                  ) : <p className="text-slate-500">ไม่มีข้อมูลรีวิวจากแหล่งข้อมูล</p>}
                  </div>
                </div>
                {mapUrl && (
                  <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                  <iframe title={`แผนที่ ${attraction.title}`} src={mapUrl} className="h-48 w-full" loading="lazy" />
                  </div>
                )}
                {nearbyPlaces.length > 0 && (
                  <div className="mt-4 border-t border-slate-100 pt-3">
                  <h4 className="mb-2 text-sm font-semibold text-[#1F2E7A]">สถานที่ใกล้เคียงจากแผนที่</h4>
                  <div className="space-y-2">
                    {nearbyPlaces.map((place) => (
                      <a key={place.id} href={`https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lon}`} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 text-sm transition hover:bg-blue-50">
                        <span className="min-w-0"><span className="block truncate font-semibold text-slate-800">{place.name}</span><span className="text-xs text-slate-500">{place.type}</span></span>
                        <Navigation className="h-4 w-4 shrink-0 text-[#1F2E7A]" />
                      </a>
                    ))}
                  </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => navigate(`/risk-alert/${id}`, { state: { ...locationState, title: attraction.title, pm25: airQuality?.pm25, aqi: airQuality?.aqi } })}
                  className={`mt-4 flex w-full items-center gap-3 rounded-xl border p-3 text-left transition hover:shadow-sm ${airCardStyle}`}
                >
                  <span className={`${airIconStyle} flex h-9 w-9 shrink-0 items-center justify-center rounded-full`}>
                  <AlertTriangle className="h-4 w-4 text-white" />
                  </span>
                  <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">คุณภาพอากาศ PM2.5</span>
                  <span className="block text-xs">{airQuality ? `${airStatusText} · ${airQuality.pm25} µg/m³ · AQI ${airQuality.aqi}` : 'ไม่พบข้อมูลคุณภาพอากาศ'}</span>
                  </span>
                  <ArrowLeft className="h-4 w-4 rotate-180" />
                </button>
              </section>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
