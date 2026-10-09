import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Heart, MapPin, Star } from 'lucide-react';
import {
  getFavoritePlaces,
  removeFavoritePlace,
  subscribeToFavorites,
  type FavoritePlace,
} from '../utils/favorites';

export default function FavoritesPage() {
  const [places, setPlaces] = useState<FavoritePlace[]>(getFavoritePlaces);

  useEffect(() => subscribeToFavorites(() => setPlaces(getFavoritePlaces())), []);

  const removeFavorite = (key: string) => {
    removeFavoritePlace(key);
    setPlaces(getFavoritePlaces());
  };

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <div className="app-shell shadow-xl lg:shadow-none">
        <header className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-4 pb-4 pt-12 shadow-sm backdrop-blur-sm sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link to="/" className="-ml-2 rounded-full p-2 transition hover:bg-slate-100" aria-label="กลับหน้าหลัก">
              <ArrowLeft className="h-6 w-6 text-[#1F2E7A]" />
            </Link>
            <div className="flex items-center gap-2">
              <Heart className="h-5 w-5 fill-rose-500 text-rose-500" />
              <h1 className="text-lg font-bold text-[#1F2E7A]">สถานที่ที่บันทึกไว้</h1>
            </div>
          </div>
        </header>

        <main className="app-content">
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-[#1F2E7A]">รายการโปรดของคุณ</h2>
              <p className="mt-1 text-sm text-slate-500">แสดงเฉพาะสถานที่ที่คุณกดบันทึกไว้</p>
            </div>
            <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-[#1F2E7A]">
              {places.length} สถานที่
            </span>
          </div>

          {places.length ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {places.map((place) => (
                <article
                  key={place.key}
                  className="group overflow-hidden rounded-[20px] border border-slate-100 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="relative">
                    <Link to={place.route} state={place.placeState} aria-label={`ดูรายละเอียด ${place.title}`}>
                      {place.images[0] ? (
                        <img
                          src={place.images[0]}
                          alt={place.title}
                          className="h-52 w-full bg-slate-100 object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                        />
                      ) : (
                        <div className="flex h-52 items-center justify-center bg-gradient-to-br from-sky-100 to-blue-200">
                          <MapPin className="h-10 w-10 text-blue-700/60" />
                        </div>
                      )}
                    </Link>
                    <button
                      type="button"
                      onClick={() => removeFavorite(place.key)}
                      aria-label={`นำ${place.title}ออกจากรายการโปรด`}
                      className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-rose-500 shadow-md transition hover:scale-105 hover:bg-rose-50"
                    >
                      <Heart className="h-5 w-5 fill-rose-500" />
                    </button>
                  </div>
                  <Link to={place.route} state={place.placeState} className="block p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-[#1F2E7A]">
                        {place.category || 'สถานที่ท่องเที่ยว'}
                      </span>
                      <span className="truncate text-xs font-medium text-slate-500">{place.province}</span>
                    </div>
                    <h3 className="line-clamp-1 text-base font-bold text-[#1F2E7A]">{place.title}</h3>
                    <p className="mt-1 line-clamp-2 min-h-10 text-sm text-slate-500">
                      {place.location || place.description || 'ไม่มีข้อมูลที่อยู่'}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-blue-700" />
                        {place.province || 'ประเทศไทย'}
                      </span>
                      {typeof place.rating === 'number' ? (
                        <span className="inline-flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                          {place.rating.toFixed(1)}
                          {place.reviewCount !== undefined && ` · ${place.reviewCount.toLocaleString('th-TH')} รีวิว`}
                        </span>
                      ) : <span>ยังไม่มีคะแนนรีวิว</span>}
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <section className="rounded-[24px] border border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-50">
                <Heart className="h-8 w-8 text-rose-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">ยังไม่มีสถานที่ที่บันทึกไว้</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
                กดไอคอนหัวใจบนการ์ดสถานที่หรือหน้า Place Detail เพื่อเก็บสถานที่ไว้ดูภายหลัง
              </p>
              <Link
                to="/"
                className="mt-5 inline-flex items-center justify-center rounded-xl bg-[#1F2E7A] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-900"
              >
                ค้นหาสถานที่
              </Link>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
