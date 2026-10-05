import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Wind, Cloud, CloudRain, CloudLightning, Moon, Sun, LoaderCircle, Droplets, Waves, CheckCircle, MapPin, TrendingDown, AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchPlaceImages, lockThreeImages } from '../utils/placeImages';
import { fetchTatPlace, lockTatImages } from '../utils/tatApi';
import { fetchWindyWeather, type WindyWeather } from '../utils/windyApi';

export default function SafeDestination() {
  const navigate = useNavigate();
  const { id } = useParams();

  const destinationData = {
    3: {
      title: 'วัดพระศรีรัตนศาสดาราม',
      images: [],
      pm25: 32,
      aqi: 95,
      status: 'ปลอดภัย',
      description: 'วัดพระศรีรัตนศาสดารามเป็นวัดสำคัญในพระบรมมหาราชวัง อากาศดีเหมาะสำหรับการท่องเที่ยว',
    },
    4: {
      title: 'เกาะพีพี',
      images: [
        'https://images.unsplash.com/photo-1537956965359-7573183d1f57?w=400',
        'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400',
        'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=400',
      ],
      pm25: 28,
      aqi: 88,
      status: 'ปลอดภัย',
      description: 'เกาะพีพีมีหาดทรายขาวสะอาด น้ำทะเลใส คุณภาพอากาศดีเยี่ยม เหมาะสำหรับการพักผ่อน',
    },
  };

  const destination = id === '4' ? destinationData[4] : destinationData[3];
  const destinationCoordinates = {
    3: { lat: '13.7516', lon: '100.4927' },
    4: { lat: '7.7407', lon: '98.7784' },
  }[id as '3' | '4'] || { lat: '13.7516', lon: '100.4927' };
  const [placeImages, setPlaceImages] = useState<string[]>([]);
  const [weather, setWeather] = useState<WindyWeather | null>(null);
  const [showWeatherDetails, setShowWeatherDetails] = useState(false);
  const weatherTheme = !weather
    ? { card: 'from-sky-50 via-blue-50 to-indigo-100 text-sky-950', muted: 'text-sky-700', icon: LoaderCircle }
    : weather.condition === 'thunderstorm'
      ? { card: 'from-indigo-900 via-blue-950 to-slate-900 text-white', muted: 'text-white/75', icon: CloudLightning }
      : weather.condition === 'rain'
        ? { card: 'from-slate-600 via-blue-800 to-slate-700 text-white', muted: 'text-white/75', icon: CloudRain }
        : weather.isNight
          ? { card: 'from-slate-800 via-indigo-900 to-slate-900 text-white', muted: 'text-white/75', icon: Moon }
          : weather.condition === 'cloudy'
            ? { card: 'from-slate-200 via-sky-100 to-blue-200 text-slate-800', muted: 'text-slate-600', icon: Cloud }
            : { card: 'from-sky-100 via-blue-50 to-cyan-100 text-sky-950', muted: 'text-sky-700', icon: Sun };
  const WeatherIcon = weatherTheme.icon;

  useEffect(() => {
    if (destination.title === 'วัดพระศรีรัตนศาสดาราม') {
      fetchTatPlace(destination.title)
        .then((place) => setPlaceImages(lockThreeImages(lockTatImages(destination.title, place?.images || []))))
        .catch(() => undefined);
      return;
    }
    fetchPlaceImages(destination.title, destinationCoordinates.lat, destinationCoordinates.lon).then((images) => setPlaceImages(lockThreeImages(images)));
  }, [destination.title, destinationCoordinates.lat, destinationCoordinates.lon]);

  useEffect(() => {
    fetchWindyWeather(destinationCoordinates.lat, destinationCoordinates.lon)
      .then(setWeather)
      .catch(() => undefined);
  }, [destinationCoordinates.lat, destinationCoordinates.lon]);

  const nearbyAttractions = [
    {
      name: 'พระบรมมหาราชวัง',
      distance: '0.5 กม.',
      lat: '13.7500',
      lon: '100.4913',
    },
    {
      name: 'วัดโพธิ์',
      distance: '1.2 กม.',
      lat: '13.7465',
      lon: '100.4930',
    },
  ];
  const [nearbyImages, setNearbyImages] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all(
      nearbyAttractions.map(async (place) => [
        place.name,
        (await fetchPlaceImages(place.name, place.lat, place.lon))[0] || '',
      ] as const),
    ).then((images) => setNearbyImages(Object.fromEntries(images)));
  }, []);

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <div className="app-shell shadow-xl lg:shadow-none">
        {/* Header */}
        <div className="bg-white pt-12 pb-4 px-4 shadow-sm sticky top-0 z-10 md:pt-6">
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
          <h2 className="text-2xl font-bold text-[#1F2E7A] mb-4">{destination.title}</h2>

          {/* Image Gallery */}
          <div className="grid grid-cols-3 gap-2 mb-4 lg:gap-3">
            {placeImages.length > 0 ? placeImages.map((img, idx) => (
              <img
                key={img}
                src={img}
                alt={`${destination.title} ${idx + 1}`}
                className="w-full aspect-[4/3] object-cover rounded-xl"
              />
            )) : (
              <div className="col-span-3 aspect-[4/3] rounded-xl bg-gray-100 flex items-center justify-center text-sm text-gray-400">
                กำลังโหลดรูปสถานที่
              </div>
            )}
          </div>

          {/* PM2.5 Safe Status Card */}
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-5 mb-4 text-white shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-white/20 rounded-full p-3">
                <CheckCircle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold">คุณภาพอากาศดี</h3>
                <p className="text-sm opacity-90">ปลอดภัยสำหรับการท่องเที่ยว</p>
              </div>
            </div>

            <div className="bg-white/10 rounded-xl p-4 mb-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Wind className="w-4 h-4" />
                    <p className="text-xs opacity-80">PM2.5</p>
                  </div>
                  <p className="text-3xl font-bold">{destination.pm25}</p>
                  <p className="text-xs opacity-80">µg/m³</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-4 h-4" />
                    <p className="text-xs opacity-80">AQI</p>
                  </div>
                  <p className="text-3xl font-bold">{destination.aqi}</p>
                  <p className="text-xs opacity-80">ดัชนีคุณภาพอากาศ</p>
                </div>
              </div>
            </div>

            {/* Status Indicator */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex gap-2">
                <div className="w-12 h-3 bg-green-300 rounded border-2 border-white"></div>
                <div className="w-12 h-3 bg-white/30 rounded"></div>
                <div className="w-12 h-3 bg-white/30 rounded"></div>
              </div>
              <span className="text-sm font-semibold">{destination.status}</span>
            </div>

            <div className="bg-white/20 rounded-lg p-3">
              <p className="font-semibold text-center">
                <CheckCircle className="mr-2 inline h-4 w-4" />แนะนำให้ท่องเที่ยวในพื้นที่นี้
              </p>
              <p className="text-xs text-center mt-1 opacity-90">
                คุณภาพอากาศอยู่ในเกณฑ์ที่ดีและปลอดภัย
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="bg-[#1F2E7A] text-white rounded-2xl p-4 mb-4">
            <h3 className="font-semibold mb-2">รายละเอียด</h3>
            <p className="text-sm leading-relaxed opacity-90">
              {destination.description}
            </p>
          </div>

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
            <div className="relative z-10">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <WeatherIcon className={`h-5 w-5 ${!weather ? 'animate-spin' : ''}`} aria-hidden="true" />
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
              <div>
                <p className={`text-xs mb-1 ${weatherTheme.muted}`}>วันนี้</p>
                <p className="text-2xl font-bold">{weather ? `${weather.temperatures[0]}°` : '--'}</p>
                <div className="flex items-center justify-center gap-1 text-xs mt-1">
                  <Droplets className="w-3 h-3" />
                  <span>{weather ? `${weather.rain[0]}%` : '--'}</span>
                </div>
              </div>
              <div>
                <p className={`text-xs mb-1 ${weatherTheme.muted}`}>พรุ่งนี้</p>
                <p className="text-2xl font-bold">{weather ? `${weather.temperatures[1]}°` : '--'}</p>
                <div className="flex items-center justify-center gap-1 text-xs mt-1">
                  <Droplets className="w-3 h-3" />
                  <span>{weather ? `${weather.rain[1]}%` : '--'}</span>
                </div>
              </div>
              <div>
                <p className={`text-xs mb-1 ${weatherTheme.muted}`}>มะรืน</p>
                <p className="text-2xl font-bold">{weather ? `${weather.temperatures[2]}°` : '--'}</p>
                <div className="flex items-center justify-center gap-1 text-xs mt-1">
                  <Droplets className="w-3 h-3" />
                  <span>{weather ? `${weather.rain[2]}%` : '--'}</span>
                </div>
              </div>
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

          {/* Wave Height / Environmental Info */}
          <div className="bg-white rounded-2xl shadow-md p-4 mb-4">
            <h3 className="font-semibold text-[#1F2E7A] mb-3">ข้อมูลสภาพแวดล้อม</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Waves className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">ความสูงคลื่น</p>
                    <p className="text-xs text-gray-600">คลื่นสงบ</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-blue-600">0.5 ม.</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <TrendingDown className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">ความเสี่ยงน้ำท่วม</p>
                    <p className="text-xs text-gray-600">ไม่มีความเสี่ยง</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-green-600">ต่ำ</span>
              </div>
            </div>
          </div>

          {/* Safety Recommendation */}
          <div className="bg-green-50 border-l-4 border-green-500 rounded-2xl p-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="bg-green-500 rounded-full p-2">
                <CheckCircle className="w-4 h-4 text-white" />
              </div>
              <div>
                <h4 className="font-semibold text-green-800 mb-1">คำแนะนำการท่องเที่ยว</h4>
                <ul className="text-xs text-green-700 space-y-1">
                  <li>• สภาพอากาศเหมาะสมสำหรับกิจกรรมกลางแจ้ง</li>
                  <li>• ควรใช้ครีมกันแดด SPF 30 ขึ้นไป</li>
                  <li>• เตรียมน้ำดื่มเพียงพอสำหรับท่องเที่ยว</li>
                  <li>• สวมใส่เสื้อผ้าที่สบายและระบายอากาศได้ดี</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Nearby Attractions */}
          <div className="bg-white rounded-2xl shadow-md p-4">
            <h3 className="font-semibold text-[#1F2E7A] mb-3 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              สถานที่ท่องเที่ยวใกล้เคียง
            </h3>
            <div className="space-y-3">
              {nearbyAttractions.map((place, idx) => (
                <div key={idx} className="flex gap-3 items-center p-3 bg-gray-50 rounded-lg">
                  {nearbyImages[place.name] ? (
                    <img
                      src={nearbyImages[place.name]}
                      alt={place.name}
                      className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1">
                    <h4 className="font-semibold text-[#1F2E7A] text-sm">{place.name}</h4>
                    <p className="text-xs text-gray-600">ระยะทาง: {place.distance}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
