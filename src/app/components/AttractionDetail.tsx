import { useLocation, useNavigate, useParams } from 'react-router';
import { ArrowLeft, MapPin, Clock, Phone, Cloud, Droplets, Wind, Waves, LoaderCircle, AlertTriangle, Star, Sunrise, Banknote, Sparkles, Camera, Ship, Landmark, Leaf, Navigation, Heart, Compass, CalendarDays, Share2, X, Image as ImageIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchPlaceImages, lockThreeImages } from '../utils/placeImages';
import { fetchWindyWeather } from '../utils/windyApi';
import WeatherCard from './WeatherCard';
import { getWeatherTheme } from '../utils/weatherTheme';
import { getPlaceDetails, getPlacePhotoUrl, type PlaceDetails } from '../services/placesApi';
import { THAI_PROVINCES } from '../data/provinces';
import { useUserCoordinates } from '../context/UserLocationContext';
import { removeFavoritePlace, saveFavoritePlace } from '../utils/favorites';
import { describeWeatherCode, fetchTripForecast, getForecastLastDateString, MAX_FORECAST_DAYS, type TripForecast } from '../utils/tripForecast';
import { usePlaceReviews } from '../hooks/usePlaceReviews';

type NearbyPlace = {
  id: number;
  name: string;
  type: string;
  lat: number;
  lon: number;
  image?: string;
};

const OPENING_DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const OPENING_DAY_LABELS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
const FULL_OPENING_DAY_LABELS: Record<string, string> = {
  monday: 'จันทร์',
  tuesday: 'อังคาร',
  wednesday: 'พุธ',
  thursday: 'พฤหัสบดี',
  friday: 'ศุกร์',
  saturday: 'เสาร์',
  sunday: 'อาทิตย์',
};

function formatOpeningHours(hours: string) {
  const segments = hours.split(/[;\n]/).map((segment) => segment.trim()).filter(Boolean);
  const entries = segments.flatMap((segment) => {
    const fullDay = segment.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday):\s*(.+)$/i);
    if (fullDay) return [[FULL_OPENING_DAY_LABELS[fullDay[1].toLowerCase()], fullDay[2]] as const];
    const match = segment.match(/^((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?(?:,(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)*)\s+(.+)$/);
    if (!match) return [];
    const days = match[1].split(',').flatMap((range) => {
      const [start, end] = range.split('-');
      const startIndex = OPENING_DAYS.indexOf(start);
      const endIndex = end ? OPENING_DAYS.indexOf(end) : startIndex;
      if (startIndex < 0 || endIndex < startIndex) return [];
      return OPENING_DAYS.slice(startIndex, endIndex + 1);
    });
    return days.map((day) => [OPENING_DAY_LABELS[OPENING_DAYS.indexOf(day)], match[3]] as const);
  });

  if (!entries.length) return null;
  return Object.fromEntries(entries);
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
  return provinceMatch?.[1]?.trim() || 'ไม่มีข้อมูล';
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

function countTripDays(startDate?: string | null, endDate?: string | null) {
  const start = startDate?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const end = endDate?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!start || !end) return 0;
  const startTime = Date.UTC(Number(start[1]), Number(start[2]) - 1, Number(start[3]));
  const endTime = Date.UTC(Number(end[1]), Number(end[2]) - 1, Number(end[3]));
  return Math.floor((endTime - startTime) / 86_400_000) + 1;
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
    if (!id?.startsWith('place-')) {
      setGooglePlace(null);
      setGooglePlaceError('');
      return;
    }
    setGooglePlace(null);
    const controller = new AbortController();
    setGooglePlaceError('');
    getPlaceDetails(id.slice('place-'.length), undefined, controller.signal)
      .then(setGooglePlace)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setGooglePlaceError(error instanceof Error ? error.message : 'ไม่สามารถโหลดรายละเอียดสถานที่ได้');
      });
    return () => controller.abort();
  }, [id]);
  const activeGooglePlace = id?.startsWith('place-') && googlePlace?.id === id.slice('place-'.length)
    ? googlePlace
    : null;
  const googleProvince = activeGooglePlace
    ? THAI_PROVINCES.find((province) => activeGooglePlace.address.includes(province))
    : undefined;
  const googleImages = activeGooglePlace?.photos
    .map((photo) => getPlacePhotoUrl(photo))
    .filter((photo): photo is string => Boolean(photo));
  const locationState = routeState?.title
    ? routeState
    : activeGooglePlace
      ? {
          ...routeState,
          placeId: activeGooglePlace.id,
          title: activeGooglePlace.name,
          location: activeGooglePlace.address,
          province: googleProvince,
          category: 'สถานที่ท่องเที่ยว',
          description: activeGooglePlace.description,
          mapUrl: activeGooglePlace.googleMapsUri,
          image: googleImages?.[0],
          images: googleImages,
          lat: activeGooglePlace.latitude === undefined ? undefined : String(activeGooglePlace.latitude),
          lon: activeGooglePlace.longitude === undefined ? undefined : String(activeGooglePlace.longitude),
          rating: activeGooglePlace.rating,
          reviewCount: activeGooglePlace.userRatingCount,
          website: activeGooglePlace.websiteUri,
          favoriteKey: `google-${activeGooglePlace.id}`,
        }
      : routeState;
  const routeSearchParams = new URLSearchParams(routeLocation.search);
  const departureDate = locationState?.departureDate || routeSearchParams.get('departureDate');
  const returnDate = locationState?.returnDate || routeSearchParams.get('returnDate');
  const tripDateRange = departureDate && returnDate
    ? `${formatTripDate(departureDate)} – ${formatTripDate(returnDate)}`
    : '';
  const forecastLimitDate = getForecastLastDateString();
  const selectedDateOutOfForecastRange = Boolean(returnDate && returnDate > forecastLimitDate);
  const [tripForecast, setTripForecast] = useState<TripForecast | null>(null);
  const [tripForecastLoading, setTripForecastLoading] = useState(false);
  const [tripForecastError, setTripForecastError] = useState('');
  const [isTripForecastModalOpen, setIsTripForecastModalOpen] = useState(false);

  const exactImages = locationState?.images?.length ? locationState.images : googleImages || [];
  const attraction = {
    title: locationState?.title || activeGooglePlace?.name || 'ไม่พบข้อมูลสถานที่',
    images: exactImages,
    description: locationState?.description || activeGooglePlace?.description || '',
    location: locationState?.location || activeGooglePlace?.address || '',
    travelCaution: locationState?.travelCaution || '',
    hours: locationState?.openingHours || '',
    phone: locationState?.phone || '',
    mapUrl: locationState?.mapUrl,
  };
  const reviewProvince = locationState?.province
    || (getProvince(attraction.location) !== 'ไม่มีข้อมูล' ? getProvince(attraction.location) : '');

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
  const coordinates = locationState?.lat && locationState.lon
    ? locationState
    : typeof activeGooglePlace?.latitude === 'number' && typeof activeGooglePlace.longitude === 'number'
      ? { lat: String(activeGooglePlace.latitude), lon: String(activeGooglePlace.longitude) }
      : undefined;
  const { review: placeReview, isLoading: isReviewLoading, error: reviewError } = usePlaceReviews(
    attraction.title,
    reviewProvince,
    {
      placeId: locationState?.placeId || (id?.startsWith('place-') ? id.slice('place-'.length) : undefined),
      latitude: coordinates?.lat ? Number(coordinates.lat) : undefined,
      longitude: coordinates?.lon ? Number(coordinates.lon) : undefined,
    },
  );
  const mapUrl = coordinates?.lat && coordinates.lon
    ? `https://www.google.com/maps?q=${coordinates.lat},${coordinates.lon}&output=embed`
    : '';
  const fullMapUrl = attraction.mapUrl || activeGooglePlace?.googleMapsUri || (coordinates?.lat && coordinates.lon
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
  const displayHours = verifiedHours || attraction.hours || activeGooglePlace?.openingHours;
  const hoursByDay = displayHours ? formatOpeningHours(displayHours) : null;
  const contactPhone = placeDetails.phone || attraction.phone || activeGooglePlace?.phone || '';
  const detailedAddress = { ...placeDetails.address };

  useEffect(() => {
    if (!coordinates?.lat || !coordinates.lon) {
      setVerifiedHours('');
      setVerifiedLocation('');
      setPlaceDetails({});
      return;
    }
    const controller = new AbortController();
    setVerifiedHours('');
    setVerifiedLocation('');
    setPlaceDetails({});
    fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coordinates.lat}&lon=${coordinates.lon}&extratags=1&accept-language=th`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Place information request failed: ${response.status}`);
        return response.json();
      })
      .then((data: {
        display_name?: string;
        address?: Record<string, string>;
        extratags?: { opening_hours?: string; operator?: string; phone?: string; 'contact:phone'?: string; tourism?: string; amenity?: string };
      }) => {
        if (data.extratags?.opening_hours) setVerifiedHours(data.extratags.opening_hours);
        if (data.display_name) setVerifiedLocation(data.display_name);
        setPlaceDetails({ address: data.address, operator: data.extratags?.operator, phone: data.extratags?.phone || data.extratags?.['contact:phone'], category: data.extratags?.tourism || data.extratags?.amenity });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) console.error('Unable to load place information', error);
      });
    return () => controller.abort();
  }, [coordinates?.lat, coordinates?.lon]);

  const [placeImages, setPlaceImages] = useState<string[]>(lockThreeImages(exactImages));

  useEffect(() => {
    setPlaceImages(lockThreeImages(exactImages));
  }, [id, exactImages.join('|')]);

  useEffect(() => {
    if (placeImages.length || !coordinates?.lat || !coordinates.lon) return;
    let active = true;
    fetchPlaceImages(attraction.title, coordinates.lat, coordinates.lon).then((images) => {
      if (active) setPlaceImages(lockThreeImages(images));
    });
    return () => {
      active = false;
    };
  }, [attraction.title, coordinates?.lat, coordinates?.lon, placeImages.length]);
  const [airQuality, setAirQuality] = useState<{ pm25: number; aqi: number } | null>(null);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [nearbyPlacesLoading, setNearbyPlacesLoading] = useState(false);
  const [nearbyPlacesError, setNearbyPlacesError] = useState(false);
  const userCoordinates = useUserCoordinates();
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem('favorite-attractions') || '[]');
      return Array.isArray(stored) ? stored.filter((value): value is string => typeof value === 'string') : [];
    } catch {
      return [];
    }
  });
  const [shareMessage, setShareMessage] = useState('');
  const [galleryImage, setGalleryImage] = useState<string | null>(null);
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
  const sharePlace = async () => {
    try {
      const shareData = { title: attraction.title, text: attraction.description, url: window.location.href };
      if (navigator.share) {
        await navigator.share(shareData);
        setShareMessage('แชร์สถานที่แล้ว');
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
        setShareMessage('คัดลอกลิงก์สถานที่แล้ว');
      } else {
        setShareMessage('เบราว์เซอร์นี้ไม่รองรับการแชร์ลิงก์');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.error('Unable to share place', error);
      setShareMessage('ไม่สามารถแชร์สถานที่ได้');
    }
  };
  useEffect(() => {
    if (!galleryImage) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setGalleryImage(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [galleryImage]);
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
    : 'ไม่มีข้อมูล';
  const recommendedTime = locationState?.recommendedTime?.trim() || 'ไม่มีข้อมูล';
  const destinationProvince = getProvince(
    attraction.location || formatAddress(detailedAddress) || verifiedLocation,
    locationState?.province || googleProvince,
  );
  const displayRating = locationState?.rating ?? activeGooglePlace?.rating;
  const displayReviewCount = locationState?.reviewCount ?? activeGooglePlace?.userRatingCount;
  const highlightIcons = isSea
    ? [Waves, Ship, Camera]
    : isWaterRelatedNature
      ? [Droplets, Leaf, Camera]
      : isTempleOrCulture
        ? [Landmark, Sparkles, Camera]
        : isNature
          ? [Leaf, Sunrise, Camera]
          : [Sparkles, MapPin, Camera];
  const travelCaution = locationState?.travelCaution?.trim() || attraction.travelCaution || 'ไม่มีข้อมูล';
  const [marine, setMarine] = useState<{ wind: number | null; wave: number } | null>(null);

  useEffect(() => {
    if (!tripDateRange || !departureDate || !returnDate) {
      setTripForecast(null);
      setTripForecastLoading(false);
      setTripForecastError('');
      return;
    }

    if (!coordinates?.lat || !coordinates.lon) {
      setTripForecast(null);
      setTripForecastLoading(false);
      setTripForecastError('ไม่มีพิกัดของสถานที่ จึงไม่สามารถตรวจพยากรณ์ตามวันเดินทางได้');
      return;
    }

    if (selectedDateOutOfForecastRange) {
      setTripForecast(null);
      setTripForecastLoading(false);
      setTripForecastError(`พยากรณ์อากาศรองรับล่วงหน้าไม่เกิน ${MAX_FORECAST_DAYS} วัน ข้อมูลวันที่เลือกอยู่นอกช่วงที่ API ให้บริการ`);
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
  }, [tripDateRange, departureDate, returnDate, coordinates?.lat, coordinates?.lon, isSea, selectedDateOutOfForecastRange]);

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
    if (!coordinates?.lat || !coordinates.lon) {
      setNearbyPlaces([]);
      setNearbyPlacesLoading(false);
      setNearbyPlacesError(false);
      return;
    }

    const controller = new AbortController();
    setNearbyPlaces([]);
    setNearbyPlacesLoading(true);
    setNearbyPlacesError(false);
    const query = `[out:json][timeout:20];(nwr(around:10000,${coordinates.lat},${coordinates.lon})[name][tourism];nwr(around:10000,${coordinates.lat},${coordinates.lon})[name][historic];nwr(around:10000,${coordinates.lat},${coordinates.lon})[name][natural];nwr(around:10000,${coordinates.lat},${coordinates.lon})[name][leisure~"park|nature_reserve|garden"];);out center tags;`;
    fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Nearby places request failed: ${response.status}`);
        return response.json();
      })
      .then((data: { elements?: Array<{ id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: { name?: string; tourism?: string; historic?: string; natural?: string; leisure?: string; image?: string } }> }) => {
        setNearbyPlaces((data.elements || [])
          .map((place) => ({
            id: place.id,
            name: place.tags?.name || '',
            type: place.tags?.tourism || place.tags?.historic || place.tags?.natural || place.tags?.leisure || 'แหล่งท่องเที่ยว',
            lat: place.lat ?? place.center?.lat,
            lon: place.lon ?? place.center?.lon,
            image: place.tags?.image?.startsWith('https://') ? place.tags.image : undefined,
          }))
          .filter((place): place is NearbyPlace => Boolean(place.name && place.lat !== undefined && place.lon !== undefined))
          .filter((place) => place.name !== attraction.title)
          .sort((left, right) => {
            if (!coordinates?.lat || !coordinates.lon) return 0;
            const origin = { latitude: Number(coordinates.lat), longitude: Number(coordinates.lon) };
            return distanceInKm(origin, { latitude: left.lat, longitude: left.lon })
              - distanceInKm(origin, { latitude: right.lat, longitude: right.lon });
          })
          .slice(0, 3));
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          console.error('Unable to load nearby places', error);
          setNearbyPlacesError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setNearbyPlacesLoading(false);
      });

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
    setAirQuality(null);
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
    && tripForecastDays.length === countTripDays(departureDate, returnDate)
    && tripForecastDays.every((day) => day.weatherCode !== null
      && day.precipitationProbability !== null
      && day.maxTemperature !== null
      && day.minTemperature !== null);
  const tripRiskLevel = hasSevereTripRisk ? 'danger' : hasCautionTripRisk ? 'warning' : hasCompleteTripForecast ? 'safe' : 'unknown';
  const tripRiskStyle = tripRiskLevel === 'danger'
    ? { panel: 'border-red-200 bg-red-50', text: 'text-red-800', badge: 'bg-red-600 text-white', label: 'เสี่ยงสูง · ควรหลีกเลี่ยง' }
    : tripRiskLevel === 'warning'
      ? { panel: 'border-amber-200 bg-amber-50', text: 'text-amber-900', badge: 'bg-amber-500 text-white', label: 'ควรระวัง' }
      : tripRiskLevel === 'safe'
        ? { panel: 'border-emerald-200 bg-emerald-50', text: 'text-emerald-900', badge: 'bg-emerald-600 text-white', label: 'ความเสี่ยงต่ำ' }
        : { panel: 'border-amber-200 bg-amber-50', text: 'text-amber-900', badge: 'bg-amber-500 text-white', label: 'ข้อมูลไม่ครบ · ควรตรวจสอบ' };
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
              <p className={`mt-3 inline-flex rounded-full px-3 py-1.5 text-sm font-semibold ${tripRiskStyle.badge}`}>
                {tripRiskStyle.label}
              </p>
              {tripForecastLoading && (
                <p role="status" className="mt-4 flex items-center gap-2 text-sm text-slate-600">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  กำลังโหลดพยากรณ์ตามพิกัดสถานที่…
                </p>
              )}
              {!tripForecastLoading && tripForecastError && (
                <p role="alert" className={`mt-4 rounded-xl bg-white/80 p-3 text-sm ${tripRiskStyle.text}`}>{tripForecastError}</p>
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
        {galleryImage && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/90 p-4" role="dialog" aria-modal="true" aria-label={`ภาพขนาดใหญ่ของ${attraction.title}`} onClick={() => setGalleryImage(null)}>
            <button type="button" onClick={() => setGalleryImage(null)} className="absolute right-4 top-4 z-[1] rounded-full bg-white/15 p-3 text-white hover:bg-white/25" aria-label="ปิดภาพ">
              <X className="h-6 w-6" />
            </button>
            <img src={galleryImage} alt={attraction.title} className="max-h-[88vh] max-w-full rounded-xl object-contain shadow-2xl" onClick={(event) => event.stopPropagation()} />
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

        <main className="app-content mx-auto max-w-[1440px]">
          {googlePlaceError && !locationState?.title && (
            <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {googlePlaceError}
            </p>
          )}
          <section
            className="relative mb-6 flex min-h-[300px] items-end overflow-hidden rounded-[22px] bg-slate-300 bg-cover bg-center shadow-sm sm:min-h-[360px] lg:min-h-[390px]"
            style={placeImages[0] ? { backgroundImage: `linear-gradient(90deg, rgba(10,37,86,.82), rgba(10,37,86,.36) 58%, rgba(10,37,86,.08)), url("${placeImages[0]}")` } : undefined}
          >
            {placeImages[0] && (
              <button type="button" onClick={() => setGalleryImage(placeImages[0])} className="absolute right-4 top-4 z-[2] inline-flex items-center gap-2 rounded-full bg-slate-950/45 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-slate-950/65" aria-label="ขยายภาพปก">
                <ImageIcon className="h-4 w-4" />
                ดูภาพขนาดใหญ่
              </button>
            )}
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
                {attraction.description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/90 sm:text-base">{attraction.description}</p>}
                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium">
                  {typeof displayRating === 'number' ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <strong>{displayRating.toFixed(1)}/5</strong>
                    {displayReviewCount !== undefined && <span className="text-white/80">({displayReviewCount.toLocaleString('th-TH')} รีวิว)</span>}
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
                <button
                  type="button"
                  onClick={sharePlace}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-[#1F2E7A] shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-50"
                >
                  <Share2 className="h-4 w-4" />
                  แชร์
                </button>
                <a
                  href={coordinates?.lat && coordinates.lon ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${coordinates.lat},${coordinates.lon}`)}` : fullMapUrl || undefined}
                  target="_blank"
                  rel="noreferrer"
                  aria-disabled={!coordinates?.lat && !fullMapUrl}
                  className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 ${coordinates?.lat || fullMapUrl ? 'bg-[#1F2E7A] hover:bg-blue-900' : 'cursor-not-allowed bg-slate-400'}`}
                >
                  <Navigation className="h-4 w-4" />
                  {coordinates?.lat || fullMapUrl ? 'นำทาง' : 'ไม่มีพิกัด'}
                </a>
              </div>
              {shareMessage && <p aria-live="polite" className="text-right text-xs text-white/90">{shareMessage}</p>}
            </div>
          </section>

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.95fr)]">
            <div className="min-w-0 space-y-5">
              <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
                <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-[#1F2E7A]">
                  <Landmark className="h-5 w-5" />
                  เกี่ยวกับสถานที่
                </h3>
                <p className="text-sm leading-7 text-slate-700">
                  {attraction.description || 'ไม่มีข้อมูลแนะนำสถานที่จากแหล่งข้อมูล'}
                </p>
                <p className="mt-3 flex items-start gap-2 text-sm text-slate-600">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                  {locationState?.location || verifiedLocation || attraction.location || formatAddress(detailedAddress) || 'ไม่มีข้อมูลที่อยู่'}
                </p>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="flex items-center gap-2 text-lg font-bold text-[#1F2E7A]">
                    <Camera className="h-5 w-5" />
                    รูปภาพเพิ่มเติม
                  </h3>
                  <span className="text-xs text-slate-500">{placeImages.length} ภาพ</span>
                </div>
                {placeImages.length ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {placeImages.map((image, index) => (
                      <button key={image} type="button" className="group relative h-32 overflow-hidden rounded-xl bg-slate-100 text-left sm:h-40" onClick={() => setGalleryImage(image)} aria-label={`ดูภาพที่ ${index + 1} ขนาดใหญ่`}>
                        <img src={image} alt={`${attraction.title} ภาพที่ ${index + 1}`} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                        <span className="absolute bottom-2 right-2 rounded-full bg-slate-950/55 p-2 text-white">
                          <ImageIcon className="h-4 w-4" />
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">{coordinates?.lat ? 'ไม่พบรูปภาพจากแหล่งข้อมูล' : 'ไม่มีข้อมูลรูปภาพหรือพิกัดสำหรับค้นหารูป'}</p>
                )}
              </section>

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
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${tripRiskStyle.badge}`}>{tripRiskStyle.label}</span>
                    <p className={`text-sm font-semibold ${tripRiskStyle.text}`}>{tripDateRange}</p>
                  </div>
                  {tripForecastLoading && <p className="mt-2 text-sm text-slate-600">กำลังตรวจสอบพยากรณ์ตามพิกัดสถานที่…</p>}
                  {!tripForecastLoading && tripForecastError && (
                    <p role="alert" className={`mt-2 text-sm ${tripRiskStyle.text}`}>{tripForecastError}</p>
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
                <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-[#1F2E7A]">
                  <Landmark className="h-5 w-5" />
                  ข้อมูลทั่วไป
                </h3>
                <div className="divide-y divide-slate-100">
                  <div className="flex items-start gap-3 py-3 first:pt-0">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                    <div>
                      <p className="text-xs text-slate-500">ที่อยู่</p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-800">{locationState?.location || verifiedLocation || attraction.location || formatAddress(detailedAddress) || 'ไม่มีข้อมูล'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 py-3">
                    <Compass className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                    <div>
                      <p className="text-xs text-slate-500">ประเภท / จังหวัด</p>
                      <p className="mt-1 text-sm font-medium text-slate-800">{locationState?.category || placeDetails.category || 'ไม่มีข้อมูล'} · {destinationProvince}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 py-3">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                    <div className="w-full">
                      <p className="text-xs text-slate-500">เวลาเปิด-ปิด</p>
                      {hoursByDay ? (
                        <dl className="mt-2 space-y-1.5 text-sm">
                          {Object.entries(hoursByDay).map(([day, hours]) => (
                            <div key={day} className="flex justify-between gap-3">
                              <dt className="text-slate-600">{day}</dt>
                              <dd className="text-right font-medium text-slate-800">{hours}</dd>
                            </div>
                          ))}
                        </dl>
                      ) : <p className="mt-1 text-sm text-slate-800">{displayHours || 'ไม่มีข้อมูล'}</p>}
                      {hoursByDay && <p className="mt-2 text-xs text-slate-500">ข้อมูลจากแหล่งที่มา: {displayHours}</p>}
                    </div>
                  </div>
                  <div className="flex items-start gap-3 py-3">
                    <Phone className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                    <div>
                      <p className="text-xs text-slate-500">เบอร์ติดต่อ</p>
                      {contactPhone ? (
                        <a href={`tel:${contactPhone.replace(/[^\d+]/g, '')}`} className="mt-1 inline-block text-sm font-semibold text-blue-700 underline-offset-2 hover:underline">{contactPhone}</a>
                      ) : <p className="mt-1 text-sm text-slate-800">ไม่มีข้อมูล</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 py-3">
                    <div>
                      <p className="flex items-center gap-1.5 text-xs text-slate-500"><Sunrise className="h-4 w-4 text-blue-600" />ช่วงเวลาที่แนะนำ</p>
                      <p className="mt-1 text-sm font-medium text-slate-800">{recommendedTime}</p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1.5 text-xs text-slate-500"><Banknote className="h-4 w-4 text-emerald-700" />ค่าใช้จ่าย</p>
                      <p className="mt-1 text-sm font-medium text-slate-800">{estimatedCost}</p>
                    </div>
                  </div>
                </div>
                {fullMapUrl && (
                  <a href={fullMapUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1F2E7A] px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-900">
                    <Navigation className="h-4 w-4" />
                    เปิด Google Maps
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
                  แผนที่และรีวิว
                  </h3>
                  {fullMapUrl && <a href={fullMapUrl} target="_blank" rel="noreferrer" aria-label="เปิดแผนที่" className="rounded-full p-2 text-[#1F2E7A] hover:bg-blue-50"><Navigation className="h-4 w-4" /></a>}
                </div>
                <div className="space-y-3 text-sm">
                  <p className="text-xs leading-relaxed text-slate-500">
                    {coordinates?.lat && coordinates.lon ? `พิกัด ${coordinates.lat}, ${coordinates.lon}` : 'ไม่มีข้อมูลพิกัด'}
                  </p>
                  <div className="border-t border-slate-100 pt-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs text-slate-500"><Star className="h-4 w-4 text-amber-500" />รีวิวจากนักท่องเที่ยว</p>
                  {isReviewLoading ? (
                    <p className="text-slate-500" role="status">กำลังโหลดรีวิวจาก Google Maps...</p>
                  ) : reviewError ? null : placeReview ? (
                    <div className="space-y-3">
                      {typeof placeReview.rating === 'number' && (
                        <p className="font-semibold text-slate-800">
                          {placeReview.rating.toFixed(1)} / 5
                          {placeReview.reviewCount !== undefined ? ` · ${placeReview.reviewCount.toLocaleString('th-TH')} รีวิว` : ''}
                        </p>
                      )}
                      {placeReview.reviews.length > 0 ? placeReview.reviews.map((review, index) => (
                        <article key={`${review.authorName}-${review.publishTime || index}`} className="rounded-xl bg-slate-50 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            {review.authorUri ? (
                              <a href={review.authorUri} target="_blank" rel="noreferrer" className="font-semibold text-slate-800 underline">
                                {review.authorName}
                              </a>
                            ) : (
                              <p className="font-semibold text-slate-800">{review.authorName}</p>
                            )}
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              {typeof review.rating === 'number' && <span className="font-semibold text-amber-700">★ {review.rating}/5</span>}
                              {review.relativePublishTimeDescription && <span>{review.relativePublishTimeDescription}</span>}
                            </div>
                          </div>
                          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{review.text}</p>
                          {review.googleMapsUri && (
                            <a href={review.googleMapsUri} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-blue-700 underline">
                              ดูรีวิวนี้บน Google Maps
                            </a>
                          )}
                        </article>
                      )) : (
                        <p className="text-sm text-slate-500">Google Maps ยังไม่มีข้อความรีวิวสำหรับสถานที่นี้</p>
                      )}
                      {placeReview.googleMapsUri && (
                        <a href={placeReview.googleMapsUri} target="_blank" rel="noreferrer" className="inline-block text-xs text-blue-700 underline">
                          ที่มา: Google Maps
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="text-slate-500">ไม่พบรีวิวจาก Google Maps สำหรับสถานที่นี้</p>
                  )}
                  </div>
                </div>
                {mapUrl && (
                  <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                  <iframe title={`แผนที่ ${attraction.title}`} src={mapUrl} className="h-48 w-full" loading="lazy" />
                  </div>
                )}
                {!mapUrl && <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">ไม่มีข้อมูลตำแหน่งสำหรับแสดงแผนที่</p>}
                <section className="mt-4 border-t border-slate-100 pt-3">
                  <h4 className="mb-2 text-sm font-semibold text-[#1F2E7A]">สถานที่ใกล้เคียง</h4>
                  {nearbyPlacesLoading ? (
                    <p role="status" className="text-sm text-slate-500">กำลังค้นหาสถานที่ใกล้เคียง…</p>
                  ) : nearbyPlaces.length ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                    {nearbyPlaces.map((place) => (
                      <a key={place.id} href={`https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lon}`} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-xl border border-slate-100 bg-white text-sm transition hover:border-blue-200 hover:shadow-sm">
                        {place.image ? <img src={place.image} alt={place.name} className="h-24 w-full object-cover" /> : <div className="flex h-24 items-center justify-center bg-slate-50 text-slate-300"><MapPin className="h-6 w-6" /></div>}
                        <span className="block min-w-0 p-3">
                          <span className="block truncate font-semibold text-slate-800">{place.name}</span>
                          <span className="mt-1 block text-xs text-slate-500">{place.type}</span>
                          <span className="mt-2 flex items-center justify-between text-xs text-blue-700">
                            {coordinates?.lat && coordinates.lon
                              ? `${distanceInKm({ latitude: Number(coordinates.lat), longitude: Number(coordinates.lon) }, { latitude: place.lat, longitude: place.lon }).toFixed(1)} กม.`
                              : 'ระยะทางไม่มีข้อมูล'}
                            <Navigation className="h-4 w-4" />
                          </span>
                        </span>
                      </a>
                    ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">{nearbyPlacesError ? 'ไม่สามารถโหลดสถานที่ใกล้เคียงได้' : 'ไม่มีข้อมูลสถานที่ใกล้เคียง'}</p>
                  )}
                </section>
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
