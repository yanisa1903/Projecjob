import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, Clock, ExternalLink, MapPin, Phone, Search } from 'lucide-react';
import { PlaceSearchBox } from './PlaceSearchBox';
import DatePicker from './DatePicker';
import { THAI_PROVINCES } from '../data/provinces';
import type { PlaceSearchOption } from '../hooks/usePlaceSearch';
import { useUserCoordinates } from '../context/UserLocationContext';
import {
  getCategoryOsmTags,
  getPlaceDetailsBatch,
  getPlacePhotoUrl,
  searchPlaces,
  type PlaceDetails,
  type PlaceSearchResult,
} from '../services/placesApi';
import { fetchCkanRecords, type CkanPlace, type CkanResourceKind } from '../services/ckanApi';

const CKAN_KINDS: CkanResourceKind[] = ['attractions', 'activities', 'accommodations', 'restaurants'];
const CKAN_KIND_LABELS: Record<CkanResourceKind, string> = {
  attractions: 'แหล่งท่องเที่ยว',
  activities: 'กิจกรรมท่องเที่ยว',
  accommodations: 'ที่พัก',
  restaurants: 'ร้านอาหาร',
};

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
  if (types.some((type) => /beach|island|bay/i.test(type))) return 'ทะเล / เกาะ';
  if (types.some((type) => /waterfall/i.test(type))) return 'น้ำตก';
  if (types.some((type) => /viewpoint/i.test(type))) return 'จุดชมวิว';
  if (types.some((type) => /mountain|peak/i.test(type))) return 'ภูเขา';
  if (types.some((type) => /historic|archaeological|museum/i.test(type))) return 'ประวัติศาสตร์';
  if (types.some((type) => /temple|place_of_worship|church|mosque/i.test(type))) return 'วัด';
  if (types.some((type) => /park|national_park|nature_reserve|forest/i.test(type))) return 'ธรรมชาติ';
  if (types.some((type) => /cafe/i.test(type))) return 'คาเฟ่';
  return 'สถานที่ท่องเที่ยว';
}

function toPlaceState(place: PlaceDetails | PlaceSearchResult) {
  const address = place.address || place.name;
  const province = place.province || THAI_PROVINCES.find((item) => address.includes(item)) || '';
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
    openingHours: 'openingHours' in place ? place.openingHours : undefined,
    phone: 'phone' in place ? place.phone : undefined,
    favoriteKey: `osm-${place.id}`,
  };
}

function PlaceSearchCard({
  place,
  details,
  distance,
  onSelect,
}: {
  place: PlaceSearchResult;
  details?: PlaceDetails;
  distance: number | null;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
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
            จากคุณ {distance < 1 ? `${Math.round(distance * 1000)} ม.` : `${distance.toFixed(1)} กม.`}
          </p>
        )}
        {details?.openingHours && (
          <p className="mb-2 inline-flex items-center gap-1 text-xs text-slate-600">
            <Clock className="h-3 w-3 shrink-0" />
            <span className="line-clamp-1">{details.openingHours.replace(/\s*;\s*/g, ' · ')}</span>
          </p>
        )}
        {details?.phone && (
          <p className="mb-2 inline-flex items-center gap-1 text-xs text-slate-600">
            <Phone className="h-3 w-3 shrink-0" />
            <span>{details.phone}</span>
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700">{categoryLabel(place.types)}</span>
        </div>
      </div>
    </button>
  );
}

function OfficialDataCard({
  place,
  departureDate,
  returnDate,
}: {
  place: CkanPlace;
  departureDate?: Date;
  returnDate?: Date;
}) {
  const placeState = {
    ckanKind: place.kind,
    ckanId: place.id,
    ckanResourceUrl: place.resourceUrl,
    ckanEntityUrl: place.url,
    title: place.name,
    location: place.address,
    province: place.province,
    category: place.category,
    description: place.description,
    images: place.images,
    lat: place.latitude === undefined ? undefined : String(place.latitude),
    lon: place.longitude === undefined ? undefined : String(place.longitude),
    openingHours: place.openingHours,
    phone: place.phone,
    email: place.email,
    websites: place.websites,
    entranceFee: place.freeEntry ? 0 : undefined,
    sourceUrl: place.url,
    departureDate: departureDate ? formatTripDate(departureDate) : undefined,
    returnDate: returnDate ? formatTripDate(returnDate) : undefined,
  };
  const route = `/attraction/ckan-${place.kind}-${place.id}`;

  return (
    <Link
      to={route}
      state={placeState}
      className="block overflow-hidden rounded-2xl border border-sky-100 bg-white text-left shadow-sm transition-shadow hover:shadow-lg"
    >
      <div className="h-40 bg-sky-50">
        {place.images[0]
          ? <img src={place.images[0]} alt={place.name} className="h-full w-full object-cover" />
          : <div className="flex h-full items-center justify-center text-sky-300"><MapPin className="h-10 w-10" /></div>}
      </div>
      <div className="p-4">
        <div className="mb-2 flex items-start justify-between gap-3">
          <h3 className="font-semibold text-sky-950">{place.name}</h3>
          <ExternalLink className="h-4 w-4 shrink-0 text-gray-400" />
        </div>
        <p className="line-clamp-2 min-h-10 text-sm text-slate-600">{place.description || 'ไม่มีข้อมูลรายละเอียด'}</p>
        <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
          <MapPin className="h-3 w-3 shrink-0" />
          {[place.district && `อำเภอ${place.district}`, place.province && `จังหวัด${place.province}`].filter(Boolean).join(' ') || 'ไม่มีข้อมูลจังหวัด/อำเภอ'}
        </p>
        {place.openingHours && (
          <p className="mt-2 flex items-center gap-1 text-xs text-slate-600">
            <Clock className="h-3 w-3 shrink-0" />
            <span className="line-clamp-1">{place.openingHours.replace(/\s*;\s*/g, ' · ')}</span>
          </p>
        )}
        {place.phone && (
          <p className="mt-2 flex items-center gap-1 text-xs text-slate-600">
            <Phone className="h-3 w-3 shrink-0" />
            <span>{place.phone}</span>
          </p>
        )}
        <span className="mt-3 inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-xs text-sky-700">
          {place.category || CKAN_KIND_LABELS[place.kind]}
        </span>
      </div>
    </Link>
  );
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
  const [placeDetails, setPlaceDetails] = useState<Record<string, PlaceDetails>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [officialPlaces, setOfficialPlaces] = useState<CkanPlace[]>([]);
  const [officialDataLoading, setOfficialDataLoading] = useState(false);
  const [officialDataError, setOfficialDataError] = useState('');
  const [officialDataNotice, setOfficialDataNotice] = useState('');

  useEffect(() => setSearchInput(query), [query]);

  useEffect(() => {
    if (places.length === 0) {
      setPlaceDetails({});
      return;
    }
    const controller = new AbortController();
    getPlaceDetailsBatch(places.map((place) => place.id), controller.signal)
      .then((details) => {
        if (!controller.signal.aborted) setPlaceDetails(details);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setPlaceDetails({});
          console.warn('ไม่สามารถโหลดเวลาเปิด-ปิดและเบอร์ติดต่อของผลค้นหาบางรายการได้', cause);
        }
      });
    return () => controller.abort();
  }, [places]);

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
      osmTag: mode === 'province' ? 'tourism:attraction' : undefined,
      osmTags: mode === 'category' ? getCategoryOsmTags(category || query) : undefined,
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

  useEffect(() => {
    if (!query.trim()) {
      setOfficialPlaces([]);
      setOfficialDataLoading(false);
      setOfficialDataError('');
      setOfficialDataNotice('');
      return;
    }

    const controller = new AbortController();
    const searchTerm = mode === 'province'
      ? ''
      : mode === 'category'
        ? category || query
        : query;
    setOfficialDataLoading(true);
    setOfficialDataError('');
    setOfficialDataNotice('');
    Promise.allSettled(CKAN_KINDS.map((kind) => fetchCkanRecords(kind, {
      query: searchTerm,
      province: mode === 'province' ? province || query : undefined,
      signal: controller.signal,
    })))
      .then((results) => {
        if (controller.signal.aborted) return;
        const successful = results.flatMap((result, index) => result.status === 'fulfilled'
          ? [{ kind: CKAN_KINDS[index], page: result.value }]
          : []);
        setOfficialPlaces(successful.flatMap(({ page }) => page.records));
        if (successful.length === 0) {
          const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
          setOfficialDataError(failure?.reason instanceof Error ? failure.reason.message : 'ไม่สามารถโหลดข้อมูลจาก CKAN ได้');
          return;
        }
        const partialPages = successful.filter(({ page }) => page.partial || page.truncated);
        if (partialPages.length) {
          setOfficialDataNotice(partialPages.map(({ kind, page }) => {
            const label = CKAN_KIND_LABELS[kind];
            return page.truncated
              ? `${label} โหลดได้ ${page.records.length} จาก ${page.total} รายการในไฟล์`
              : `${label} มี ${page.available} จาก ${page.reportedTotal} รายการตามยอดรายงาน`;
          }).join(' · '));
        }
        const failures = results.filter((result) => result.status === 'rejected').length;
        if (failures) setOfficialDataError(`โหลดข้อมูล CKAN ไม่สำเร็จ ${failures} ประเภท`);
      })
      .finally(() => {
        if (!controller.signal.aborted) setOfficialDataLoading(false);
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
    if (place) selectPlace({ ...place, ...placeDetails[placeId], photos: [] });
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
              {isLoading || officialDataLoading ? 'กำลังค้นหา...' : `พบ ${places.length + officialPlaces.length} รายการ`}
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
                  <PlaceSearchCard
                    key={place.id}
                    place={place}
                    details={placeDetails[place.id]}
                    distance={distance}
                    onSelect={() => void selectResult(place.id)}
                  />
                );
              })}
            </div>
          ) : officialPlaces.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                <Search className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="mb-2 font-semibold text-gray-800">ไม่พบผลการค้นหา</h3>
              <p className="text-sm text-gray-600">ลองค้นหาชื่อสถานที่ท่องเที่ยว จังหวัด หรือประเภทสถานที่</p>
            </div>
          ) : null}

          {(officialPlaces.length > 0 || officialDataLoading || officialDataError) && (
            <section className="mt-8" aria-label="ข้อมูลจากกระทรวงการท่องเที่ยวและกีฬา">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-[#1F2E7A]">ข้อมูลจากกระทรวงการท่องเที่ยวและกีฬา</h2>
                <p className="mt-1 text-xs text-slate-500">ข้อมูลจาก CKAN JSON Resource ทางการ · แสดงระเบียนที่ Resource เปิดให้ดาวน์โหลด</p>
                {officialDataLoading && <p className="mt-1 text-xs text-sky-700" role="status">กำลังโหลดข้อมูล JSON…</p>}
                {officialDataNotice && <p className="mt-1 text-xs text-amber-700">Resource ส่งกลับเพียงบางส่วน: {officialDataNotice}</p>}
                {officialDataError && <p className="mt-1 text-xs text-amber-700" role="status">{officialDataError}</p>}
              </div>
              {CKAN_KINDS.map((kind) => {
                const results = officialPlaces.filter((place) => place.kind === kind);
                if (!results.length) return null;
                return (
                  <div key={kind} className="mb-7">
                    <h3 className="mb-3 font-semibold text-sky-950">{CKAN_KIND_LABELS[kind]} ({results.length})</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {results.map((place) => (
                        <OfficialDataCard key={`${kind}-${place.id}`} place={place} departureDate={departureDate} returnDate={returnDate} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {!isLoading && !error && !officialDataLoading && places.length === 0 && officialPlaces.length === 0 && (
            <div className="mt-6">
              <h3 className="mb-3 font-semibold text-[#1F2E7A]">ค้นหาสถานที่ในประเทศไทย</h3>
              <div className="flex flex-wrap gap-2">
                {['ทะเล', 'ภูเขา', 'ธรรมชาติ', 'น้ำตก', 'วัด', 'ประวัติศาสตร์', 'คาเฟ่'].map((item) => (
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
