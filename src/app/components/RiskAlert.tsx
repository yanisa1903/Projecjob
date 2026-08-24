import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, Link } from 'react-router';
import { ArrowLeft, AlertTriangle, Wind, Activity, MapPin } from 'lucide-react';
import { fetchPlaceImages } from '../utils/placeImages';

export default function RiskAlert() {
  const navigate = useNavigate();
  const { id } = useParams();
  const locationState = useLocation().state as {
    title?: string;
    image?: string;
    images?: string[];
    pm25?: number;
    aqi?: number;
    lat?: string;
    lon?: string;
  } | null;

  type NearbyPlace = {
    id: number;
    name: string;
    type: string;
    lat: number;
    lon: number;
    image?: string;
  };

  const getNearbyImage = async (name: string, latitude: number, longitude: number) => {
    try {
      const response = await fetch(`https://th.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`);
      if (response.ok) {
        const data = await response.json() as { thumbnail?: { source?: string } };
        if (data.thumbnail?.source) return data.thumbnail.source;
      }

      const commonsQuery = `https://commons.wikimedia.org/w/api.php?action=query&generator=geosearch&ggsprimary=all&ggsnamespace=6&ggsradius=1500&ggscoord=${latitude}|${longitude}&ggslimit=1&prop=imageinfo&iiprop=url&iiurlwidth=500&format=json&origin=*`;
      const commonsResponse = await fetch(commonsQuery);
      if (!commonsResponse.ok) return '';
      const commonsData = await commonsResponse.json() as {
        query?: { pages?: Record<string, { imageinfo?: Array<{ thumburl?: string; url?: string }> }> };
      };
      const page = Object.values(commonsData.query?.pages || {})[0];
      return page?.imageinfo?.[0]?.thumburl || page?.imageinfo?.[0]?.url || '';
    } catch {
      return '';
    }
  };

  const attractionData = {
    1: {
      title: 'ภูเขาทอง',
      images: [
        'https://images.unsplash.com/photo-1528181304800-259b08848526?w=400',
        'https://images.unsplash.com/photo-1563492065599-3520f775eeed?w=400',
        'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=400',
      ],
      pm25: 156,
      aqi: 206,
      status: 'อันตราย',
      color: 'red',
    },
    2: {
      title: 'เกาะเต่า',
      images: [
        'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400',
        'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=400',
        'https://images.unsplash.com/photo-1589208828261-e0c0c634e7b5?w=400',
      ],
      pm25: 142,
      aqi: 192,
      status: 'อันตราย',
      color: 'red',
    },
  };

  const savedAttraction = attractionData[id as keyof typeof attractionData] || attractionData[1];
  const attraction = locationState?.title
    ? {
        ...savedAttraction,
        title: locationState.title,
        images: locationState.images?.length
          ? locationState.images
          : locationState.image
            ? [locationState.image]
            : savedAttraction.images,
        pm25: locationState.pm25 ?? savedAttraction.pm25,
        aqi: locationState.aqi ?? savedAttraction.aqi,
      }
    : savedAttraction;

  const legacyCoordinates: Record<string, { lat: string; lon: string }> = {
    '1': { lat: '13.7539', lon: '100.5067' },
    '2': { lat: '10.0991', lon: '99.8381' },
  };
  const coordinates = locationState?.lat && locationState.lon ? locationState : legacyCoordinates[id || ''];
  const [placeImages, setPlaceImages] = useState<string[]>(locationState?.images?.length ? locationState.images : locationState?.image ? [locationState.image] : []);

  useEffect(() => {
    if (placeImages.length || !coordinates?.lat || !coordinates.lon) return;
    fetchPlaceImages(attraction.title, coordinates.lat, coordinates.lon).then(setPlaceImages);
  }, [attraction.title, coordinates?.lat, coordinates?.lon, placeImages.length]);

  const [airQuality, setAirQuality] = useState<{ pm25: number; aqi: number } | null>(
    locationState?.pm25 !== undefined && locationState.aqi !== undefined
      ? { pm25: locationState.pm25, aqi: locationState.aqi }
      : null,
  );

  useEffect(() => {
    if (!coordinates?.lat || !coordinates.lon || airQuality) return;

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
  }, [coordinates?.lat, coordinates?.lon, airQuality]);

  const currentAttraction = {
    ...attraction,
    pm25: airQuality?.pm25 ?? attraction.pm25,
    aqi: airQuality?.aqi ?? attraction.aqi,
  };
  const airLevel = currentAttraction.pm25 <= 15 && currentAttraction.aqi <= 50
    ? 'safe'
    : currentAttraction.pm25 <= 37.5 && currentAttraction.aqi <= 100
      ? 'moderate'
      : 'danger';
  const airCardStyle = airLevel === 'safe'
    ? 'from-green-100 to-green-200'
    : airLevel === 'moderate'
      ? 'from-yellow-100 to-yellow-200'
      : 'from-red-100 to-red-200';
  const airTextStyle = airLevel === 'safe' ? 'text-green-900' : airLevel === 'moderate' ? 'text-yellow-900' : 'text-red-900';
  const airStatus = airLevel === 'safe' ? 'ปลอดภัย' : airLevel === 'moderate' ? 'ปานกลาง' : 'อันตราย';

  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);

  useEffect(() => {
    if (!coordinates?.lat || !coordinates.lon) return;

    const controller = new AbortController();
    const query = `[out:json][timeout:20];(nwr(around:10000,${coordinates.lat},${coordinates.lon})[name][tourism];nwr(around:10000,${coordinates.lat},${coordinates.lon})[name][historic];nwr(around:10000,${coordinates.lat},${coordinates.lon})[name][natural];nwr(around:10000,${coordinates.lat},${coordinates.lon})[name][leisure~"park|nature_reserve|garden"];);out center tags;`;
    fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((data: { elements?: Array<{ id: number; type: string; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: { name?: string; tourism?: string; historic?: string; natural?: string; leisure?: string } }> }) => {
        const places = (data.elements || [])
          .map((place) => ({
            id: place.id,
            name: place.tags?.name || '',
            type: place.tags?.tourism || place.tags?.historic || place.tags?.natural || place.tags?.leisure || 'แหล่งท่องเที่ยว',
            lat: place.lat ?? place.center?.lat,
            lon: place.lon ?? place.center?.lon,
          }))
          .filter((place): place is NearbyPlace => Boolean(place.name && place.lat && place.lon))
          .filter((place) => place.name !== attraction.title)
          .slice(0, 2);
        Promise.all(places.map(async (place) => ({ ...place, image: await getNearbyImage(place.name, place.lat, place.lon) })))
          .then(setNearbyPlaces);
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [coordinates?.lat, coordinates?.lon, attraction.title]);

  const alternatives = nearbyPlaces;

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
          <h2 className="text-2xl font-bold text-[#1F2E7A] mb-4">{attraction.title}</h2>

          {/* Image Gallery */}
          <div className="grid grid-cols-3 gap-2 mb-4 lg:gap-3">
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

          {/* PM2.5 Danger Warning Card */}
          <div className={`bg-gradient-to-br ${airCardStyle} rounded-2xl p-5 mb-4 ${airTextStyle} shadow-lg`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-black/5 rounded-full p-3">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold">{airLevel === 'danger' ? 'เตือนภัย PM2.5' : 'คุณภาพอากาศ'}</h3>
                <p className="text-sm opacity-90">ระดับ{airStatus}</p>
              </div>
            </div>

            <div className="bg-black/5 rounded-xl p-4 mb-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Wind className="w-4 h-4" />
                    <p className="text-xs opacity-80">PM2.5</p>
                  </div>
                  <p className="text-3xl font-bold">{currentAttraction.pm25}</p>
                  <p className="text-xs opacity-80">µg/m³</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="w-4 h-4" />
                    <p className="text-xs opacity-80">AQI</p>
                  </div>
                  <p className="text-3xl font-bold">{currentAttraction.aqi}</p>
                  <p className="text-xs opacity-80">ดัชนีคุณภาพอากาศ</p>
                </div>
              </div>
            </div>

            {/* Status Indicator */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex gap-2">
                <div className={`w-12 h-3 bg-green-400 rounded ${airLevel === 'safe' ? 'border-2 border-white' : ''}`}></div>
                <div className={`w-12 h-3 bg-yellow-400 rounded ${airLevel === 'moderate' ? 'border-2 border-white' : ''}`}></div>
                <div className={`w-12 h-3 bg-red-400 rounded ${airLevel === 'danger' ? 'border-2 border-white' : ''}`}></div>
              </div>
              <span className="text-sm font-semibold">{airStatus}</span>
            </div>

            <p className="text-sm leading-relaxed opacity-90">
              {airLevel === 'safe'
                ? 'คำแนะนำ: สามารถเที่ยวและทำกิจกรรมกลางแจ้งได้ตามปกติ'
                : airLevel === 'moderate'
                ? 'คำแนะนำ: เที่ยวได้ แต่ควรลดกิจกรรมกลางแจ้งและสวมหน้ากากเมื่อจำเป็น'
                : 'คำแนะนำ: ควรเลื่อนกิจกรรมกลางแจ้งและสวมหน้ากาก N95 หากจำเป็นต้องออกไป'}
            </p>

          </div>

          {/* Alternative Destinations */}
          <div className="bg-[#1F2E7A] rounded-2xl p-4 mb-4">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              สถานที่ใกล้เคียงที่แนะนำ
            </h3>
            <p className="text-white/80 text-sm mb-4">
              สถานที่เหล่านี้อยู่ใกล้กับจุดที่คุณค้นหา
            </p>

            <div className="space-y-3">
              {alternatives.map((alt) => (
                <Link
                  key={alt.id}
                  to={`/attraction/place-near-${alt.id}`}
                  state={{
                    title: alt.name,
                    location: alt.name,
                    province: 'ประเทศไทย',
                    category: alt.type,
                    lat: String(alt.lat),
                    lon: String(alt.lon),
                    mapUrl: `https://www.google.com/maps/search/?api=1&query=${alt.lat},${alt.lon}`,
                    image: alt.image,
                  }}
                  className="block bg-white rounded-xl p-3 hover:shadow-lg transition-shadow"
                >
                  <div className="flex gap-3">
                    {alt.image ? (
                      <img src={alt.image} alt={alt.name} className="w-20 h-20 object-cover rounded-lg flex-shrink-0" />
                    ) : (
                      <div className="w-20 h-20 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <MapPin className="w-7 h-7 text-[#1F2E7A]" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h4 className="font-semibold text-[#1F2E7A] mb-1">{alt.name}</h4>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="bg-green-100 px-2 py-1 rounded-full">
                          <p className="text-xs font-semibold text-green-700">{alt.type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3 h-3 text-green-600" />
                        <p className="text-xs text-gray-600">อยู่ใกล้สถานที่ที่ค้นหา · เปิดแผนที่</p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Emergency Info */}
          <div className="bg-orange-50 border-l-4 border-orange-500 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="bg-orange-500 rounded-full p-2">
                <AlertTriangle className="w-4 h-4 text-white" />
              </div>
              <div>
                <h4 className="font-semibold text-orange-800 mb-1">คำแนะนำด้านสุขภาพ</h4>
                <ul className="text-xs text-orange-700 space-y-1">
                  <li>• สวมหน้ากากอนามัย N95 หากจำเป็นต้องออกไป</li>
                  <li>• หลีกเลี่ยงกิจกรรมกลางแจ้งที่หนักหน่วง</li>
                  <li>• ปิดหน้าต่างและประตูให้สนิท</li>
                  <li>• ผู้ป่วยโรคหายใจควรพักผ่อนในที่ร่ม</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
