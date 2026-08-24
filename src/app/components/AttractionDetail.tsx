import { useLocation, useNavigate, useParams } from 'react-router';
import { ArrowLeft, MapPin, Clock, Phone, Facebook, Cloud, Droplets, Wind, Waves, CloudRain, AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchPlaceImages } from '../utils/placeImages';

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
      location: 'เขตพระนคร กรุงเทพมหานคร 10200',
      hours: 'เปิดทุกวัน 08:00 - 17:00 น.',
      phone: '02-222-8334',
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
      location: 'ตำบลเกาะเต่า อำเภอเกาะพะงัน จังหวัดสุราษฎร์ธานี',
      hours: 'เปิดตลอด 24 ชั่วโมง',
      phone: '077-456-789',
      facebook: 'เกาะเต่าท่องเที่ยว',
    },
    3: {
      title: 'วัดพระแก้ว',
      images: [
        'https://images.unsplash.com/photo-1563492065599-3520f775eeed?w=400',
        'https://images.unsplash.com/photo-1528181304800-259b08848526?w=400',
        'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=400',
      ],
      description: 'วัดพระแก้วเป็นวัดที่สวยงามและมีความสำคัญทางประวัติศาสตร์ ตั้งอยู่ในพระบรมมหาราชวัง',
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
      phone: '02-224-3290',
      facebook: 'วัดพระแก้ว',
    },
    4: {
      title: 'เกาะพีพี',
      images: [
        'https://images.unsplash.com/photo-1537956965359-7573183d1f57?w=400',
        'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400',
        'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=400',
      ],
      description: 'เกาะพีพีมีหาดทรายขาวสะอาด น้ำทะเลใส เหมาะสำหรับการพักผ่อนและดำน้ำ',
      location: 'อำเภอเมือง จังหวัดกระบี่',
      hours: 'เปิดตลอด 24 ชั่วโมง',
      phone: '075-612-345',
      facebook: 'เกาะพีพีท่องเที่ยว',
    },
    5: {
      title: 'พัทยา',
      images: [
        'https://images.unsplash.com/photo-1598971639058-fab3c3109a00?w=400',
        'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400',
        'https://images.unsplash.com/photo-1537956965359-7573183d1f57?w=400',
      ],
      description: 'เมืองท่องเที่ยวชายทะเลที่มีชีวิตชีวา มีหาดสวย กิจกรรมทางน้ำมากมาย',
      location: 'บางละมุง ชลบุรี',
      hours: 'เปิดตลอด 24 ชั่วโมง',
      phone: '038-428-750',
      facebook: 'พัทยาท่องเที่ยว',
    },
    6: {
      title: 'ดอยสุเทพ',
      images: [
        'https://images.unsplash.com/photo-1589728894104-1cf1f8ae9eee?w=400',
        'https://images.unsplash.com/photo-1528181304800-259b08848526?w=400',
        'https://images.unsplash.com/photo-1563492065599-3520f775eeed?w=400',
      ],
      description: 'วัดพระธาตุดอยสุเทพ วัดที่สำคัญของเชียงใหม่ ตั้งอยู่บนยอดดอย',
      location: 'เมือง เชียงใหม่',
      hours: 'เปิดทุกวัน 06:00 - 18:00 น.',
      phone: '053-295-002',
      facebook: 'ดอยสุเทพ',
    },
    7: {
      title: 'หัวหิน',
      images: [
        'https://images.unsplash.com/photo-1552550049-db097c9480d1?w=400',
        'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400',
        'https://images.unsplash.com/photo-1598971639058-fab3c3109a00?w=400',
      ],
      description: 'เมืองพักผ่อนชายทะเลที่เงียบสงบ มีหาดสวย ตลาดน้ำ',
      location: 'หัวหิน ประจวบคีรีขันธ์',
      hours: 'เปิดตลอด 24 ชั่วโมง',
      phone: '032-511-047',
      facebook: 'หัวหินท่องเที่ยว',
    },
    8: {
      title: 'ดอยอินทนนท์',
      images: [
        'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400',
        'https://images.unsplash.com/photo-1589728894104-1cf1f8ae9eee?w=400',
        'https://images.unsplash.com/photo-1528181304800-259b08848526?w=400',
      ],
      description: 'ยอดเขาที่สูงที่สุดในประเทศไทย มีอากาศเย็น ธรรมชาติสวยงาม',
      location: 'จอมทอง เชียงใหม่',
      hours: 'เปิดทุกวัน 05:00 - 18:00 น.',
      phone: '053-286-729',
      facebook: 'ดอยอินทนนท์',
    },
  };

  const savedImages = id ? JSON.parse(localStorage.getItem(`destination-images-${id}`) || '[]') as string[] : [];
  const exactImages = locationState?.images?.length ? locationState.images : savedImages;
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
        images: exactImages.length ? exactImages : savedAttraction.images,
        description: id?.startsWith('place-') ? livePlaceDescription : savedAttraction.description,
        location: locationState.location || savedAttraction.location || locationState.province || 'ประเทศไทย',
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
  } | null>(null);
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
    : '');
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

  const [placeImages, setPlaceImages] = useState<string[]>(exactImages);

  useEffect(() => {
    if (placeImages.length || !coordinates?.lat || !coordinates.lon) return;
    fetchPlaceImages(attraction.title, coordinates.lat, coordinates.lon).then(setPlaceImages);
  }, [attraction.title, coordinates?.lat, coordinates?.lon, placeImages.length]);
  const [airQuality, setAirQuality] = useState<{ pm25: number; aqi: number } | null>(null);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const placeText = `${attraction.title} ${attraction.location} ${locationState?.category || ''}`.toLowerCase();
  const isSea = /ทะเล|เกาะ|ชายหาด|หาด|อ่าว|พัทยา|หัวหิน|พีพี|เต่า|beach|island/.test(placeText);
  const isWaterRelatedNature = /น้ำตก|แก่ง|ห้วย|ลำธาร|แม่น้ำ|ริมน้ำ|อ่างเก็บน้ำ|เขื่อน|waterfall|river|stream|reservoir|dam/.test(placeText);
  const isTempleOrCulture = /วัด|พระธาตุ|พระราชวัง|พิพิธภัณฑ์|เมืองเก่า|โบราณสถาน|temple|palace|museum|heritage/.test(placeText);
  const isNature = /อุทยาน|ภูเขา|ดอย|ป่า|เขา|ธรรมชาติ|national park|mountain|forest|nature/.test(placeText);
  const travelTips = isSea
    ? ['ตรวจสอบรอบเรือและสภาพทะเลก่อนออกเดินทาง', 'พกครีมกันแดด หมวก และน้ำดื่มให้เพียงพอ', 'สวมเสื้อชูชีพและปฏิบัติตามคำแนะนำของเจ้าหน้าที่']
    : isWaterRelatedNature
      ? ['สวมรองเท้ากันลื่นและหลีกเลี่ยงการเข้าใกล้กระแสน้ำเชี่ยว', 'ตรวจสอบฝนและประกาศเตือนภัยก่อนเดินทาง', 'เตรียมเสื้อผ้าสำรองและเก็บอุปกรณ์ให้กันน้ำ']
      : isTempleOrCulture
        ? ['แต่งกายสุภาพและปฏิบัติตามกฎของสถานที่', 'ไปช่วงเช้าหรือช่วงเย็นเพื่อหลีกเลี่ยงอากาศร้อน', 'ตรวจสอบเวลาเปิด-ปิดและวันหยุดก่อนเดินทาง']
        : isNature
          ? ['ตรวจสอบเส้นทางและประกาศของอุทยานก่อนเดินทาง', 'เตรียมรองเท้าที่เหมาะกับเส้นทางและยากันแมลง', 'พกน้ำดื่มและช่วยกันรักษาความสะอาดของธรรมชาติ']
          : ['ตรวจสอบเวลาเปิด-ปิดและการเดินทางก่อนออกจากที่พัก', 'พกน้ำดื่มและเตรียมอุปกรณ์ให้เหมาะกับสภาพอากาศ', 'เคารพชุมชนและช่วยกันรักษาความสะอาดของสถานที่'];
  const [marine, setMarine] = useState<{ wind: number; wave: number } | null>(null);

  useEffect(() => {
    if (!coordinates?.lat || !coordinates.lon) return;

    const controller = new AbortController();
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${coordinates.lat}&longitude=${coordinates.lon}&current=temperature_2m,wind_speed_10m,precipitation,rain&daily=temperature_2m_max,precipitation_probability_max&forecast_days=3&timezone=auto`,
      { signal: controller.signal },
    )
      .then((response) => response.json())
      .then((data: {
        current?: { wind_speed_10m?: number; precipitation?: number; rain?: number };
        daily?: { temperature_2m_max?: number[]; precipitation_probability_max?: number[] };
      }) => {
        if (data.daily?.temperature_2m_max && data.daily.precipitation_probability_max && data.current) {
          setWeather({
            temperatures: data.daily.temperature_2m_max,
            rain: data.daily.precipitation_probability_max,
            wind: data.current.wind_speed_10m ?? 0,
            currentRain: data.current.rain ?? data.current.precipitation ?? 0,
          });
        }
      })
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
  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <div className="mx-auto w-full max-w-[480px] lg:max-w-[1200px] min-h-screen bg-white lg:shadow-xl">
        {/* Header */}
        <div className="bg-white pt-12 pb-4 px-4 shadow-sm sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <a href="/" className="p-2 -ml-2" aria-label="ย้อนกลับ">
              <ArrowLeft className="w-6 h-6 text-[#1F2E7A]" />
            </a>
            <h1 className="font-semibold text-[#1F2E7A]">Thailand</h1>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-4">
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

          {/* Description Card */}
          <div className="bg-[#1F2E7A] text-white rounded-2xl p-4 mb-4">
            <h3 className="font-semibold mb-2">รายละเอียด</h3>
            <p className="text-sm leading-relaxed opacity-90">
              {attraction.description}
            </p>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 mb-4">
            <h3 className="font-semibold text-[#1F2E7A] mb-3">คำแนะนำสำหรับเที่ยวที่นี่</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              {travelTips.map((tip) => (
                <li key={tip} className="flex items-start gap-2">
                  <span className="mt-0.5 text-blue-600">✓</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>

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
          <div className="bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl p-4 mb-4 text-white">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Cloud className="w-5 h-5" />
              พยากรณ์อากาศ
            </h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              {forecastLabels.map((label, index) => (
                <div key={label}>
                  <p className="text-xs opacity-80 mb-1">{label}</p>
                  <p className="text-2xl font-bold">{weather?.temperatures[index] ?? [28, 30, 29][index]}°</p>
                  <div className="flex items-center justify-center gap-1 text-xs mt-1">
                    <Droplets className="w-3 h-3" />
                    <span>{weather?.rain[index] ?? [60, 40, 50][index]}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

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
