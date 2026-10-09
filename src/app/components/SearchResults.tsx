import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, ExternalLink, MapPin, Search } from 'lucide-react';
import { PlaceSearchBox } from './PlaceSearchBox';
import DatePicker from './DatePicker';
import { THAI_PROVINCES } from '../data/provinces';
import type { PlaceSearchOption } from '../hooks/usePlaceSearch';
import { useUserCoordinates } from '../context/UserLocationContext';
import {
  getCategoryOsmTag,
  getPlacePhotoUrl,
  searchPlaces,
  type PlaceDetails,
  type PlaceSearchResult,
} from '../services/placesApi';

function parseTripDate(value: string | null): Date | undefined {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return undefined;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatTripDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function distanceInKm(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const arc = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}

function categoryLabel(types: string[] = []) {
  if (types.some((type) => /beach|island/i.test(type))) return 'ทะเล';
  if (types.some((type) => /temple|church|mosque/i.test(type))) return 'วัด';
  if (types.some((type) => /park|national_park/i.test(type))) return 'อุทยาน';
  if (types.some((type) => /museum/i.test(type))) return 'พิพิธภัณฑ์';
  if (types.some((type) => /cafe/i.test(type))) return 'คาเฟ่';
  return 'สถานที่ท่องเที่ยว';
}

function toPlaceState(place: PlaceDetails | PlaceSearchResult) {
  const address = place.address || place.name;
  const province = THAI_PROVINCES.find((item) => address.includes(item)) || 'ประเทศไทย';
  const images = 'photos' in place
    ? place.photos.map((photo) => getPlacePhotoUrl(photo)).filter((url): url is string => Boolean(url))
    : [getPlacePhotoUrl(place.photoName)].filter((url): url is string => Boolean(url));
  const category = categoryLabel(place.types);
  return {
    placeId: place.id,
    title: place.name,
    location: address,
    province,
    mapUrl: 'googleMapsUri' in place ? place.googleMapsUri : undefined,
    category,
    image: images[0],
    images,
    lat: place.latitude === undefined ? undefined : String(place.latitude),
    lon: place.longitude === undefined ? undefined : String(place.longitude),
    rating: place.rating,
    reviewCount: place.userRatingCount,
    favoriteKey: `osm-${place.id}`,
  };
}

export default function SearchResults() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const mode = searchParams.get('mode') || 'text';
  const province = searchParams.get('province') || '';
  const category = searchParams.get('category') || '';
  const [departureDate, setDepartureDate] = useState<Date | undefined>(() => parseTripDate(searchParams.get('departureDate')));
  const [returnDate, setReturnDate] = useState<Date | undefined>(() => parseTripDate(searchParams.get('returnDate')));
  const [searchInput, setSearchInput] = useState(query);
  const [places, setPlaces] = useState<PlaceSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setSearchInput(query), [query]);

  useEffect(() => {
    if (!query.trim()) {
      setPlaces([]);
      setError('');
      return;
    }
    const controller = new AbortController();
    setIsLoading(true);
    setError('');
    const searchTerm = mode === 'province'
      ? province || query
      : mode === 'category'
        ? category || query
        : query;
    searchPlaces(searchTerm, controller.signal, {
      osmTag: mode === 'province' ? 'tourism:attraction' : mode === 'category' ? getCategoryOsmTag(category || query) : undefined,
    })
      .then((results) => {
        if (!controller.signal.aborted) setPlaces(results);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : 'ไม่สามารถเชื่อมต่อบริการค้นหาได้');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [category, mode, province, query]);

  const goToSearch = (value: string, nextMode = 'text', selection?: PlaceSearchOption) => {
    const params = new URLSearchParams({ q: value, mode: nextMode });
    if (selection?.kind === 'province') params.set('province', selection.label);
    if (selection?.kind === 'category') params.set('category', selection.label);
    if (departureDate) params.set('departureDate', formatTripDate(departureDate));
    if (returnDate) params.set('returnDate', formatTripDate(returnDate));
    navigate(`/search?${params.toString()}`);
  };

  const selectPlace = async (place: PlaceDetails) => {
    const params = new URLSearchParams({ q: place.name });
    if (place.latitude !== undefined) params.set('lat', String(place.latitude));
    if (place.longitude !== undefined) params.set('lon', String(place.longitude));
    if (departureDate) params.set('departureDate', formatTripDate(departureDate));
    if (returnDate) params.set('returnDate', formatTripDate(returnDate));
    navigate(`/place/${encodeURIComponent(place.id)}?${params.toString()}`, {
      state: {
        ...toPlaceState(place),
        departureDate: departureDate ? formatTripDate(departureDate) : undefined,
        returnDate: returnDate ? formatTripDate(returnDate) : undefined,
      },
    });
  };

  const selectResult = async (placeId: string) => {
    const place = places.find((item) => item.id === placeId);
    if (place) selectPlace({ ...place, photos: [] });
  };
  const userCoordinates = useUserCoordinates();

  return (
    <div className="min-h-screen bg-sky-50">
      <div className="app-shell shadow-xl lg:shadow-none">
        <div className="sticky top-0 z-10 border-b border-sky-100 bg-gradient-to-br from-white via-sky-50 to-blue-50 px-4 pb-5 pt-12 shadow-sm md:pt-6">
          <div className="mb-4 flex items-center gap-3">
            <button type="button" onClick={() => navigate(-1)} className="-ml-2 p-2" aria-label="ย้อนกลับ">
              <ArrowLeft className="h-6 w-6 text-[#1F2E7A]" />
            </button>
            <h1 className="font-semibold text-[#1F2E7A]">Thailand</h1>
          </div>
          <PlaceSearchBox
            value={searchInput}
            onChange={setSearchInput}
            onPlaceSelect={selectPlace}
            onExplore={(option) => goToSearch(option.label, option.kind, option)}
            onSearch={(text) => goToSearch(text)}
            placeholder="ค้นหาสถานที่ใดก็ได้ในประเทศไทย"
            inputClassName="w-full rounded-xl border border-sky-100 bg-white py-3 pl-4 pr-11 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            searchButtonClassName="right-2 p-1 text-gray-400 hover:bg-transparent hover:text-blue-700"
            dropdownClassName="rounded-xl"
          />
        </div>

        <main className="app-content">
          <div className="mb-5 rounded-2xl border border-sky-100 bg-white/80 p-4 shadow-sm">
            <h2 className="mb-1 font-semibold text-sky-950">ผลการค้นหา &quot;{query}&quot;</h2>
            <p className="text-sm text-sky-700">
              {isLoading ? 'กำลังค้นหา...' : `พบ ${places.length} สถานที่`}
            </p>
            <p className="mt-1 text-xs text-slate-500">
            © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap contributors</a>
            </p>
          </div>

          <section aria-label="เลือกวันเดินทาง" className="mb-5 grid grid-cols-2 gap-3">
            <DatePicker
              placeholder="เลือกวันเดินทาง"
              selected={departureDate}
              onSelect={(date) => {
                setDepartureDate(date);
                if (!date || (returnDate && returnDate < date)) setReturnDate(undefined);
              }}
              minDate={new Date()}
            />
            <DatePicker
              placeholder="เลือกวันกลับ"
              selected={returnDate}
              onSelect={setReturnDate}
              disabled={!departureDate}
              minDate={departureDate || new Date()}
            />
          </section>

          {isLoading ? (
            <div className="py-12 text-center text-sm text-gray-500" role="status">กำลังค้นหาสถานที่ทั่วประเทศไทย...</div>
          ) : error ? (
            <div className="py-12 text-center">
              <p className="mb-3 text-sm text-red-600">{error}</p>
              <button type="button" onClick={() => goToSearch(query, mode)} className="text-sm font-semibold text-[#1F2E7A]">
                ลองค้นหาอีกครั้ง
              </button>
            </div>
          ) : places.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {places.map((place) => {
                const distance = userCoordinates && place.latitude !== undefined && place.longitude !== undefined
                  ? distanceInKm(userCoordinates, { latitude: place.latitude, longitude: place.longitude })
                  : null;
                return (
                  <button
                    key={place.id}
                    type="button"
                    onClick={() => void selectResult(place.id)}
                    className="block overflow-hidden rounded-2xl border border-sky-100 bg-white text-left shadow-sm transition-shadow hover:shadow-lg"
                  >
                    <div className="h-40 bg-gradient-to-br from-sky-100 to-blue-100">
                      <div className="flex h-full items-center justify-center text-sky-300"><MapPin className="h-10 w-10" /></div>
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="mb-1 font-semibold text-sky-950">{place.name}</h3>
                        <ExternalLink className="h-4 w-4 shrink-0 text-gray-400" />
                      </div>
                      <div className="mb-2 flex items-center gap-2">
                        <MapPin className="h-3 w-3 shrink-0 text-gray-400" />
                        <span className="text-xs text-slate-500">{place.address}</span>
                      </div>
                      {distance !== null && (
                        <p className="mb-2 text-xs text-slate-500">
                          จากคุณ {distance < 1
                            ? `${Math.round(distance * 1000)} ม.`
                            : `${distance.toFixed(1)} กม.`}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700">{categoryLabel(place.types)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                <Search className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="mb-2 font-semibold text-gray-800">ไม่พบผลการค้นหา</h3>
              <p className="text-sm text-gray-600">ลองค้นหาชื่อสถานที่ท่องเที่ยว จังหวัด หรือประเภทสถานที่</p>
            </div>
          )}

          {!isLoading && !error && places.length === 0 && (
            <div className="mt-6">
              <h3 className="mb-3 font-semibold text-[#1F2E7A]">ค้นหาสถานที่ในประเทศไทย</h3>
              <div className="flex flex-wrap gap-2">
                {['ทะเล', 'วัด', 'น้ำตก', 'ภูเขา', 'คาเฟ่', 'อุทยาน'].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => goToSearch(item, 'category', { kind: 'category', id: item, label: item, subtitle: 'ประเภทสถานที่' })}
                    className="rounded-full bg-white px-3 py-1.5 text-sm text-sky-700 shadow-sm transition hover:bg-sky-100"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
