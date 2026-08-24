import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router';
import { ArrowLeft, Search, MapPin, Loader2, ExternalLink } from 'lucide-react';

type PlaceResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  category: string;
  image?: string;
  images?: string[];
  phone?: string;
  website?: string;
  facebook?: string;
  email?: string;
  openingHours?: string;
  extratags?: { phone?: string; website?: string; facebook?: string; 'contact:facebook'?: string; email?: string; opening_hours?: string };
  address?: {
    city?: string;
    town?: string;
    village?: string;
    province?: string;
    state?: string;
  };
};

async function searchOpenStreetMapNames(query: string, signal: AbortSignal): Promise<PlaceResult[]> {
  const escapedQuery = query.trim().replace(/[\\"']/g, '');
  const overpassQuery = `[out:json][timeout:20];area["ISO3166-1"="TH"][admin_level=2]->.th;(nwr["name"~"${escapedQuery}",i](area.th););out center tags;`;
  const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`, { signal });
  if (!response.ok) return [];
  const data = (await response.json()) as {
    elements?: Array<{
      id: number;
      type: string;
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
      tags?: { name?: string; amenity?: string; tourism?: string; shop?: string; phone?: string; website?: string; email?: string };
    }>;
  };
  return (data.elements || [])
    .filter((element) => element.tags?.name && (element.lat || element.center?.lat) && (element.lon || element.center?.lon))
    .slice(0, 50)
    .map((element) => ({
      place_id: element.id,
      display_name: element.tags?.name || query,
      lat: String(element.lat ?? element.center?.lat),
      lon: String(element.lon ?? element.center?.lon),
      category: element.tags?.amenity || element.tags?.tourism || element.tags?.shop || 'สถานที่',
      phone: element.tags?.phone,
      website: element.tags?.website,
      email: element.tags?.email,
    }));
}

async function searchPhoton(query: string, signal: AbortSignal): Promise<PlaceResult[]> {
  const response = await fetch(
    `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lang=th&limit=50`,
    { signal },
  );
  if (!response.ok) return [];
  const data = (await response.json()) as {
    features?: Array<{
      geometry?: { coordinates?: [number, number] };
      properties?: { name?: string; countrycode?: string; city?: string; state?: string; type?: string };
    }>;
  };
  return (data.features || [])
    .filter((feature) => feature.properties?.countrycode === 'TH' && feature.geometry?.coordinates?.length === 2)
    .map((feature, index) => {
      const [longitude, latitude] = feature.geometry!.coordinates!;
      const properties = feature.properties || {};
      return {
        place_id: -index - 1,
        display_name: [properties.name, properties.city, properties.state].filter(Boolean).join(', '),
        lat: String(latitude),
        lon: String(longitude),
        category: properties.type || 'สถานที่',
      };
    });
}

const popularSearches = ['ร้านอาหาร', 'โรงพยาบาล', 'โรงเรียน', 'โรงแรม', 'ห้างสรรพสินค้า', 'สถานีรถไฟ', 'ปั๊มน้ำมัน', 'ตลาด'];

function getLocation(place: PlaceResult) {
  const address = place.address;
  return address?.province || address?.state || address?.city || address?.town || address?.village || 'ประเทศไทย';
}

function getDetailedAddress(place: PlaceResult) {
  const address = place.address;
  if (!address) return place.display_name;
  return [
    address.house_number && `เลขที่ ${address.house_number}`,
    address.road && (address.road.startsWith('ถนน') ? address.road : `ถนน${address.road}`),
    address.neighbourhood && `หมู่บ้าน${address.neighbourhood}`,
    address.village && `หมู่ ${address.village}`,
    address.suburb && `ตำบล/แขวง ${address.suburb}`,
    address.city_district && `อำเภอ/เขต ${address.city_district}`,
    address.county && !address.city_district && `อำเภอ ${address.county}`,
    address.state && `จังหวัด${address.state}`,
    address.postcode && `รหัสไปรษณีย์ ${address.postcode}`,
  ].filter(Boolean).join(' ') || place.display_name;
}

function getPlaceTitle(place: PlaceResult) {
  return place.display_name.split(',')[0].trim() || 'สถานที่ไม่ระบุชื่อ';
}

function getMapUrl(place: PlaceResult) {
  return `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lon}`;
}

async function getPlaceImages(title: string, category: string, latitude: string, longitude: string) {
  try {
    const wikipediaResponse = await fetch(
      `https://th.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
    );
    let wikipediaImage = '';
    if (wikipediaResponse.ok) {
      const wikipediaData = (await wikipediaResponse.json()) as {
        originalimage?: { source?: string };
        thumbnail?: { source?: string };
      };
      wikipediaImage = wikipediaData.originalimage?.source || wikipediaData.thumbnail?.source || '';
    }

    const nearbyResponse = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(title)}&gsrnamespace=6&gsrlimit=6&prop=imageinfo&iiprop=url&iiurlwidth=900&format=json&origin=*`,
    );
    if (!nearbyResponse.ok) return wikipediaImage ? [wikipediaImage] : [];
    const data = (await nearbyResponse.json()) as {
      query?: { pages?: Record<string, { imageinfo?: Array<{ thumburl?: string; url?: string }> }> };
    };
    const nearbyImages = Object.values(data.query?.pages || {})
      .map((page) => page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url || '')
      .filter(Boolean);
    return [...new Set([wikipediaImage, ...nearbyImages].filter(Boolean))].slice(0, 3);
  } catch {
    return [];
  }
}

export default function SearchResults() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [searchInput, setSearchInput] = useState(query);
  const [places, setPlaces] = useState<PlaceResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!query.trim()) {
      setPlaces([]);
      setError('');
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError('');

    const normalizedQuery = query.trim().replace(/เกตุ่น/g, 'เกตุน').replace(/\s+/g, ' ');
    const withoutTypePrefix = normalizedQuery.replace(/^(โรงเรียน|รพ\.|โรงพยาบาล|ร้าน|วัด)\s*/i, '').trim();
    const searchVariants = [...new Set([
      query.trim(),
      normalizedQuery,
      withoutTypePrefix,
      `${query.trim()}, ประเทศไทย`,
      `${withoutTypePrefix}, ประเทศไทย`,
    ].filter(Boolean))];
    const fetchVariant = async (searchTerm: string) => {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&extratags=1&limit=50&countrycodes=th&accept-language=th&q=${encodeURIComponent(searchTerm)}`,
        { signal: controller.signal, headers: { Accept: 'application/json' } },
      );
      if (!response.ok) throw new Error('search-failed');
      return response.json() as Promise<PlaceResult[]>;
    };

    Promise.allSettled(searchVariants.map(fetchVariant))
      .then(async (settledResults) => {
        const resultSets = settledResults
          .filter((result): result is PromiseFulfilledResult<PlaceResult[]> => result.status === 'fulfilled')
          .map((result) => result.value);
        let results = [...new Map(resultSets.flat().map((place) => [place.place_id, place])).values()];
        if (results.length === 0) results = await searchOpenStreetMapNames(query, controller.signal);
        if (results.length === 0) results = await searchPhoton(query, controller.signal);
        const placesWithImages = await Promise.all(
          results.map(async (place) => {
            const images = await getPlaceImages(place.display_name.split(',')[0], place.category, place.lat, place.lon);
            return {
              ...place,
              phone: place.phone || place.extratags?.phone,
              website: place.website || place.extratags?.website,
              facebook: place.facebook || place.extratags?.facebook || place.extratags?.['contact:facebook'] || (place.website?.includes('facebook.com') ? place.website : undefined),
              email: place.email || place.extratags?.email,
              openingHours: place.openingHours || place.extratags?.opening_hours,
              image: images[0],
              images,
            };
          }),
        );
        setPlaces(placesWithImages);
      })
      .catch((requestError: Error) => {
        if (requestError.name !== 'AbortError') setError('ไม่สามารถเชื่อมต่อบริการค้นหาได้ กรุณาลองใหม่อีกครั้ง');
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchInput.trim())}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <div className="app-shell shadow-xl lg:shadow-none">
        {/* Header */}
        <div className="bg-white pt-12 pb-4 px-4 shadow-sm sticky top-0 z-10 md:pt-6">
          <div className="flex items-center gap-3 mb-4">
            <a href="/" className="p-2 -ml-2" aria-label="ย้อนกลับ">
              <ArrowLeft className="w-6 h-6 text-[#1F2E7A]" />
            </a>
            <h1 className="font-semibold text-[#1F2E7A]">Thailand</h1>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="ค้นหาสถานที่ใดก็ได้ในประเทศไทย"
              className="w-full pl-4 pr-10 py-3 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1F2E7A]"
            />
            <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2">
              <Search className="w-5 h-5 text-gray-400" />
            </button>
          </form>
        </div>

        {/* Content */}
        <div className="app-content">
          {/* Results Header */}
          <div className="mb-4">
            <h2 className="font-semibold text-[#1F2E7A] mb-1">
              ผลการค้นหา "{query}"
            </h2>
            <p className="text-sm text-gray-600">
              {isLoading ? 'กำลังค้นหา...' : `พบ ${places.length} สถานที่`}
            </p>
          </div>

          {/* Results */}
          {isLoading ? (
            <div className="flex flex-col items-center py-12 text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin mb-3 text-[#1F2E7A]" />
              <p className="text-sm">กำลังค้นหาสถานที่ทั่วประเทศไทย</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-sm text-red-600 mb-3">{error}</p>
              <button onClick={() => navigate(`/search?q=${encodeURIComponent(query)}`)} className="text-sm font-semibold text-[#1F2E7A]">
                ลองค้นหาอีกครั้ง
              </button>
            </div>
          ) : places.length > 0 ? (
            <div className="space-y-4">
              {places.map((place) => (
                <Link
                  key={place.place_id}
                  to={`/attraction/place-${place.place_id}`}
                  state={{
                    title: getPlaceTitle(place),
                    location: getDetailedAddress(place),
                    province: getLocation(place),
                    mapUrl: getMapUrl(place),
                    category: place.category,
                    image: place.image,
                    images: place.images,
                    lat: place.lat,
                    lon: place.lon,
                    phone: place.phone,
                    website: place.website,
                    facebook: place.facebook,
                    email: place.email,
                    openingHours: place.openingHours,
                  }}
                  className="block"
                >
                  <div className="bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="h-32 bg-gray-100">
                        <img src={place.image} alt={getPlaceTitle(place)} className="h-full w-full object-cover" />
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-semibold text-[#1F2E7A] mb-1">{getPlaceTitle(place)}</h3>
                        <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-500">{place.display_name}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <span className="text-xs bg-blue-50 text-[#1F2E7A] px-2 py-0.5 rounded-full">{place.category}</span>
                        <span className="text-xs bg-blue-50 text-[#1F2E7A] px-2 py-0.5 rounded-full">เปิดแผนที่</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">ไม่พบผลการค้นหา</h3>
              <p className="text-sm text-gray-600">
                ลองค้นหาชื่อสถานที่ ร้านอาหาร โรงพยาบาล โรงเรียน หรือจังหวัด
              </p>
            </div>
          )}

          {/* Search Suggestions */}
          {!isLoading && !error && places.length === 0 && (
            <div className="mt-6">
              <h3 className="font-semibold text-[#1F2E7A] mb-3">ค้นหาสถานที่ในประเทศไทย</h3>
              <div className="flex flex-wrap gap-2">
                {popularSearches.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      setSearchInput(tag);
                      navigate(`/search?q=${encodeURIComponent(tag)}`);
                    }}
                    className="px-4 py-2 bg-[#1F2E7A] text-white rounded-full text-sm hover:bg-[#162056] transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
