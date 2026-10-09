import { useLocation, useNavigate, useParams } from 'react-router';
import { ArrowLeft, MapPin, Clock, Phone, Cloud, Droplets, Wind, Waves, CloudRain, CloudLightning, Moon, Sun, LoaderCircle, AlertTriangle, Star, Sunrise, Banknote, Sparkles, Camera, Ship, Landmark, Leaf, Navigation, Lightbulb, ShieldAlert, Heart, Thermometer, Compass, CalendarDays } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchPlaceImages, lockThreeImages } from '../utils/placeImages';
import { fetchTatPlace, lockTatImages } from '../utils/tatApi';
import { fetchWindyWeather } from '../utils/windyApi';
import WeatherCard from './WeatherCard';
import { getWeatherTheme } from '../utils/weatherTheme';
import { getPlaceDetails, getPlacePhotoUrl, type PlaceDetails } from '../services/placesApi';
import { THAI_PROVINCES } from '../data/provinces';
import { useUserCoordinates } from '../context/UserLocationContext';
import { removeFavoritePlace, saveFavoritePlace } from '../utils/favorites';
import { describeWeatherCode, fetchTripForecast, type TripForecast } from '../utils/tripForecast';

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

function formatTripDate(dateValue?: string | null) {
  const match = dateValue?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    .toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AttractionDetail() {
  const navigate = useNavigate();
  const { id: attractionParam, placeId } = useParams();
  const id = attractionParam || (placeId ? `place-${placeId}` : undefined);
  const routeLocation = useLocation();
  const routeState = routeLocation.state as {
    placeId?: string;
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
    departureDate?: string;
    returnDate?: string;
  } | null;
  const [googlePlace, setGooglePlace] = useState<PlaceDetails | null>(null);
  const [googlePlaceError, setGooglePlaceError] = useState('');
  useEffect(() => {
    if (!id?.startsWith('place-') || routeState?.title) {
      setGooglePlace(null);
      setGooglePlaceError('');
      return;
    }
    const controller = new AbortController();
    setGooglePlaceError('');
    getPlaceDetails(id.slice('place-'.length), undefined, controller.signal)
      .then(setGooglePlace)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setGooglePlaceError(error instanceof Error ? error.message : 'ไม่สามารถโหลดรายละเอียดสถานที่ได้');
      });
    return () => controller.abort();
  }, [id, routeState?.title]);
  const googleProvince = googlePlace
    ? THAI_PROVINCES.find((province) => googlePlace.address.includes(province)) || 'ประเทศไทย'
    : undefined;
  const googleImages = googlePlace?.photos
    .map((photo) => getPlacePhotoUrl(photo))
    .filter((photo): photo is string => Boolean(photo));
  const locationState = routeState?.title
    ? routeState
    : googlePlace
      ? {
          ...routeState,
          placeId: googlePlace.id,
          title: googlePlace.name,
          location: googlePlace.address,
          province: googleProvince,
          category: 'สถานที่ท่องเที่ยว',
          description: googlePlace.description,
          mapUrl: googlePlace.googleMapsUri,
          image: googleImages?.[0],
          images: googleImages,
          lat: googlePlace.latitude === undefined ? undefined : String(googlePlace.latitude),
          lon: googlePlace.longitude === undefined ? undefined : String(googlePlace.longitude),
          rating: googlePlace.rating,
          reviewCount: googlePlace.userRatingCount,
          website: googlePlace.websiteUri,
          favoriteKey: `google-${googlePlace.id}`,
        }
      : routeState;
  const routeSearchParams = new URLSearchParams(routeLocation.search);
  const departureDate = locationState?.departureDate || routeSearchParams.get('departureDate');
  const returnDate = locationState?.returnDate || routeSearchParams.get('returnDate');
  const tripDateRange = departureDate && returnDate
    ? `${formatTripDate(departureDate)} – ${formatTripDate(returnDate)}`
    : '';
  const [tripForecast, setTripForecast] = useState<TripForecast | null>(null);
  const [tripForecastLoading, setTripForecastLoading] = useState(false);
  const [tripForecastError, setTripForecastError] = useState('');
  const [isTripForecastModalOpen, setIsTripForecastModalOpen] = useState(false);

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
  const savedAttraction = attractionData[id || '1'] || attractionData['1'];
  const attraction = (id?.startsWith('place-') || Boolean(exactImages.length)) && locationState?.title
    ? {
        ...(!id?.startsWith('place-') ? savedAttraction : {}),
        title: locationState.title,
        images: id?.startsWith('place-')
          ? exactImages
          : id === '3'
            ? exactImages
            : exactImages.length
              ? exactImages
              : savedAttraction.images,
        description: locationState.description || (id?.startsWith('place-') ? '' : savedAttraction.description),
        location: locationState.location || (id?.startsWith('place-') ? '' : savedAttraction.location || locationState.province || 'ประเทศไทย'),
        travelCaution: locationState.travelCaution || (id?.startsWith('place-') ? '' : savedAttraction.travelCaution || ''),
        hours: locationState.openingHours || (id?.startsWith('place-') ? '' : savedAttraction.hours || ''),
        phone: locationState.phone || (id?.startsWith('place-') ? '' : savedAttraction.phone || ''),
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
    weatherCode?: number | null;
    isDay?: number | null;
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
  const userCoordinates = useUserCoordinates();
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
  const toggleCurrentFavorite = () => {
    if (isFavorite) {
      removeFavoritePlace(favoriteKey);
      setFavoriteIds((current) => current.filter((key) => key !== favoriteKey));
      return;
    }
    const placeState = { ...locationState, title: attraction.title, images: placeImages, favoriteKey };
    saveFavoritePlace({
      key: favoriteKey,
      title: attraction.title,
      location: attraction.location || '',
      province: locationState?.province || '',
      category: locationState?.category || placeDetails.category || 'สถานที่ท่องเที่ยว',
      description: locationState?.description,
      images: placeImages,
      rating: locationState?.rating,
      reviewCount: locationState?.reviewCount,
      latitude: coordinates?.lat ? Number(coordinates.lat) : undefined,
      longitude: coordinates?.lon ? Number(coordinates.lon) : undefined,
      route: id?.startsWith('place-')
        ? `/place/${locationState?.placeId || id.slice('place-'.length)}`
        : `/attraction/${id}`,
      placeState,
    });
    setFavoriteIds((current) => current.includes(favoriteKey) ? current : [...current, favoriteKey]);
  };
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
    if (!tripDateRange || !departureDate || !returnDate || !coordinates?.lat || !coordinates.lon) {
      setTripForecast(null);
      setTripForecastLoading(false);
      setTripForecastError('');
      return;
    }

    const controller = new AbortController();
    setTripForecast(null);
    setTripForecastLoading(true);
    setTripForecastError('');
    fetchTripForecast(
      coordinates.lat,
      coordinates.lon,
      departureDate,
      returnDate,
      controller.signal,
      isSea,
    )
      .then(setTripForecast)
      .catch(() => {
        if (!controller.signal.aborted) setTripForecastError('ไม่สามารถโหลดพยากรณ์อากาศสำหรับวันเดินทางได้');
      })
      .finally(() => {
        if (!controller.signal.aborted) setTripForecastLoading(false);
      });

    return () => controller.abort();
  }, [tripDateRange, departureDate, returnDate, coordinates?.lat, coordinates?.lon, isSea]);

  useEffect(() => {
    setIsTripForecastModalOpen(Boolean(tripDateRange));
  }, [tripDateRange]);

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
  const weatherTheme = getWeatherTheme({
    weatherCode: weather?.weatherCode,
    isDay: weather?.isDay ?? (weather?.isNight ? 0 : null),
    precipitation: weather?.currentRain,
    condition: weather?.condition,
  });
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
  const tripForecastDays = tripForecast?.days || [];
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
  const hasCompleteTripForecast = Boolean(tripForecastDays.length)
    && tripForecastDays.every((day) => day.weatherCode !== null
      && day.precipitationProbability !== null
      && day.maxTemperature !== null
      && day.minTemperature !== null);
  const tripRiskLevel = hasSevereTripRisk ? 'danger' : hasCautionTripRisk ? 'warning' : hasCompleteTripForecast ? 'safe' : 'unknown';
  const tripRiskStyle = tripRiskLevel === 'danger'
    ? { panel: 'border-red-200 bg-red-50', text: 'text-red-800', label: 'พบความเสี่ยงสูง' }
    : tripRiskLevel === 'warning'
      ? { panel: 'border-amber-200 bg-amber-50', text: 'text-amber-900', label: 'ควรระวังสภาพอากาศ' }
      : tripRiskLevel === 'safe'
        ? { panel: 'border-emerald-200 bg-emerald-50', text: 'text-emerald-900', label: 'ไม่พบความเสี่ยงเด่นชัด' }
        : { panel: 'border-slate-200 bg-slate-50', text: 'text-slate-700', label: 'ข้อมูลพยากรณ์ไม่ครบ' };
  const tripRiskReasons = [
    tripForecastDays.some((day) => day.weatherCode !== null && day.weatherCode >= 95) ? 'อาจมีพายุฝนฟ้าคะนอง' : '',
    tripForecastDays.some((day) => day.precipitation !== null && day.precipitation >= 30) ? 'คาดว่าฝนตกหนัก' : '',
    tripForecastDays.some((day) => day.precipitationProbability !== null && day.precipitationProbability >= 50) ? 'มีโอกาสฝนตกสูง' : '',
    tripForecastDays.some((day) => day.maxWindSpeed !== null && day.maxWindSpeed >= 60) ? 'คาดว่าลมแรง' : '',
    tripForecastDays.some((day) => day.waveHeightMax !== null && day.waveHeightMax >= 2) ? 'คลื่นทะเลอาจสูง' : '',
    tripForecastDays.some((day) => day.maxTemperature !== null && day.maxTemperature >= 35) ? 'อากาศร้อนมาก' : '',
    tripForecastDays.some((day) => day.pm25 !== null && day.pm25 > 15) ? 'ค่าฝุ่น PM2.5 สูง' : '',
    tripForecastDays.some((day) => day.aqi !== null && day.aqi > 50) ? 'คุณภาพอากาศลดลง' : '',
  ].filter(Boolean);
  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <div className="app-shell shadow-xl lg:shadow-none">
        {isTripForecastModalOpen && tripDateRange && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6">
            <button
              type="button"
              aria-label="ปิดคำเตือนสภาพอากาศ"
              className="absolute inset-0 cursor-default bg-slate-950/55 backdrop-blur-sm"
              onClick={() => setIsTripForecastModalOpen(false)}
            />
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="place-trip-forecast-title"
              className={`relative z-[1] max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border p-5 shadow-2xl sm:p-6 ${tripRiskStyle.panel}`}
            >
              <button
                type="button"
                autoFocus
                aria-label="ปิดคำเตือนสภาพอากาศ"
                onClick={() => setIsTripForecastModalOpen(false)}
                className="absolute right-4 top-4 rounded-full bg-white/80 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#1F2E7A]"
              >
                ปิด
              </button>
              <h2 id="place-trip-forecast-title" className={`pr-14 text-lg font-bold ${tripRiskStyle.text}`}>
                {tripForecastLoading ? 'กำลังตรวจสอบสภาพอากาศ…' : 'สภาพอากาศและความเสี่ยงสำหรับวันเดินทาง'}
              </h2>
              <p className={`mt-1 text-sm ${tripRiskStyle.text}`}>
                {attraction.title} · {tripDateRange}
              </p>
              <p className={`mt-3 inline-flex rounded-full bg-white/80 px-3 py-1.5 text-sm font-semibold ${tripRiskStyle.text}`}>
                {tripRiskStyle.label}
              </p>
              {tripForecastLoading && (
                <p role="status" className="mt-4 flex items-center gap-2 text-sm text-slate-600">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  กำลังโหลดพยากรณ์ตามพิกัดสถานที่…
                </p>
              )}
              {!tripForecastLoading && tripForecastError && (
                <p role="alert" className="mt-4 rounded-xl bg-white/80 p-3 text-sm text-red-700">{tripForecastError}</p>
              )}
              {!tripForecastLoading && tripForecast && (
                <>
                  {tripRiskReasons.length > 0 ? (
                    <p className={`mt-3 text-sm font-medium ${tripRiskStyle.text}`}>{tripRiskReasons.join(' · ')}</p>
                  ) : (
                    <p className="mt-3 text-sm text-slate-700">
                      {hasCompleteTripForecast
                        ? 'พยากรณ์ไม่พบความเสี่ยงเด่นชัดตามเกณฑ์คัดกรองเบื้องต้น'
                        : 'ข้อมูลพยากรณ์บางช่วงไม่ครบ จึงยังประเมินความเสี่ยงได้ไม่ครบถ้วน'}
                    </p>
                  )}
                  <div className="mt-4 space-y-2">
                    {tripForecastDays.map((day) => (
                      <div key={day.date} className="rounded-xl bg-white/80 px-3 py-2.5 text-sm text-slate-700">
                        <p className="font-semibold">{formatTripDate(day.date)} · {describeWeatherCode(day.weatherCode)}</p>
                        <p className="mt-1 text-xs sm:text-sm">
                          {day.minTemperature !== null && day.maxTemperature !== null
                            ? `${Math.round(day.minTemperature)}–${Math.round(day.maxTemperature)}°C`
                            : 'ไม่มีข้อมูลอุณหภูมิ'}
                          {' · '}
                          {day.precipitationProbability !== null
                            ? `โอกาสฝน ${Math.round(day.precipitationProbability)}%`
                            : 'ไม่มีข้อมูลโอกาสฝน'}
                          {day.pm25 !== null ? ` · PM2.5 ${day.pm25.toFixed(1)} µg/m³` : ''}
                          {day.aqi !== null ? ` · AQI ${Math.round(day.aqi)}` : ''}
                          {day.waveHeightMax !== null ? ` · คลื่น ${day.waveHeightMax.toFixed(1)} ม.` : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                  {(!tripForecast.pm25Available || !tripForecast.aqiAvailable) && (
                    <p className="mt-3 text-xs text-slate-600">ข้อมูล PM2.5/AQI อาจไม่ครอบคลุมทุกวันที่เลือก</p>
                  )}
                </>
              )}
              <p className="mt-4 text-xs leading-relaxed text-slate-500">
                พยากรณ์ใช้ประกอบการตัดสินใจ โปรดตรวจประกาศปิดพื้นที่ สภาพเส้นทาง และคำแนะนำจากหน่วยงานท้องถิ่นก่อนเดินทาง
              </p>
            </section>
          </div>
        )}
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
          {googlePlaceError && !locationState?.title && (
            <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {googlePlaceError}
            </p>
          )}
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
                  {tripDateRange && (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4" />
                    เดินทาง {tripDateRange}
                  </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={toggleCurrentFavorite}
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

              {tripDateRange && (
                <section className={`rounded-2xl border p-4 shadow-sm sm:p-5 ${tripRiskStyle.panel}`} aria-live="polite">
                  <h3 className={`mb-2 flex items-center gap-2 font-bold ${tripRiskStyle.text}`}>
                    {tripForecastLoading
                      ? <LoaderCircle className="h-4 w-4 animate-spin" />
                      : tripRiskLevel === 'danger' || tripRiskLevel === 'warning'
                        ? <AlertTriangle className="h-4 w-4" />
                        : <Cloud className="h-4 w-4" />}
                    คำเตือนสภาพอากาศช่วงเดินทาง
                  </h3>
                  <p className={`text-sm font-semibold ${tripRiskStyle.text}`}>{tripRiskStyle.label} · {tripDateRange}</p>
                  {tripForecastLoading && <p className="mt-2 text-sm text-slate-600">กำลังตรวจสอบพยากรณ์ตามพิกัดสถานที่…</p>}
                  {!tripForecastLoading && tripForecastError && (
                    <p role="alert" className="mt-2 text-sm text-red-700">{tripForecastError}</p>
                  )}
                  {!tripForecastLoading && tripForecast && (
                    <>
                      {tripRiskReasons.length > 0 ? (
                        <p className="mt-2 text-sm">{tripRiskReasons.join(' · ')}</p>
                      ) : (
                        <p className="mt-2 text-sm">
                          {hasCompleteTripForecast
                            ? 'พยากรณ์ไม่พบความเสี่ยงด้านอากาศที่เกินเกณฑ์คัดกรองเบื้องต้น'
                            : 'ข้อมูลพยากรณ์บางช่วงไม่ครบ จึงยังสรุปความเสี่ยงตลอดการเดินทางไม่ได้'}
                        </p>
                      )}
                      <div className="mt-3 space-y-2">
                        {tripForecastDays.map((day) => {
                          const metrics = [
                              day.minTemperature !== null && day.maxTemperature !== null
                                ? `${Math.round(day.minTemperature)}–${Math.round(day.maxTemperature)}°C`
                                : '',
                              day.precipitationProbability !== null ? `โอกาสฝน ${Math.round(day.precipitationProbability)}%` : '',
                              day.pm25 !== null ? `PM2.5 ${day.pm25.toFixed(1)} µg/m³` : '',
                              day.aqi !== null ? `AQI ${Math.round(day.aqi)}` : '',
                              day.waveHeightMax !== null ? `คลื่น ${day.waveHeightMax.toFixed(1)} ม.` : '',
                            ].filter(Boolean);
                          return (
                            <div key={day.date} className="rounded-xl bg-white/75 px-3 py-2 text-xs text-slate-700">
                              <p className="font-semibold">
                                {formatTripDate(day.date)}
                                {day.weatherCode !== null ? ` · ${describeWeatherCode(day.weatherCode)}` : ''}
                              </p>
                              {metrics.length > 0 && (
                              <p className="mt-1">
                                {metrics.join(' · ')}
                              </p>
                            )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                  <p className="mt-3 text-xs text-slate-500">
                    ใช้พยากรณ์ตามพิกัดสถานที่เพื่อประกอบการตัดสินใจ โปรดตรวจประกาศปิดพื้นที่และคำแนะนำจากหน่วยงานท้องถิ่นก่อนเดินทาง
                  </p>
                </section>
              )}

              {weather ? (
                <WeatherCard weather={weather} theme={weatherTheme} forecastLabels={forecastLabels} placeTitle={attraction.title} />
              ) : (
                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                  <h3 className="mb-3 flex items-center gap-2 font-bold text-slate-800">
                    {weatherLoading && <LoaderCircle className="h-4 w-4 animate-spin" />}
                    พยากรณ์อากาศ ({attraction.title})
                  </h3>
                  <p className={`rounded-xl p-4 text-sm ${weatherLoading ? 'bg-white text-slate-600' : 'bg-amber-50 text-amber-800'}`}>
                    {weatherLoading
                      ? 'กำลังโหลดสภาพอากาศตามพิกัดของสถานที่…'
                      : weatherError
                        ? 'ไม่สามารถโหลดข้อมูลสภาพอากาศได้'
                        : 'ไม่พบข้อมูลสภาพอากาศ'}
                  </p>
                </section>
              )}

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
