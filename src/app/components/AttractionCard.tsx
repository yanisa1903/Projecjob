import { Compass, ChevronRight, Heart, MapPin, Star } from 'lucide-react';
import { Link } from 'react-router';
import { useEffect, useState } from 'react';
import { formatUserDistance, useUserDistance } from '../hooks/useUserDistance';
import { usePlaceReviews } from '../hooks/usePlaceReviews';
import { fetchPlaceImages, lockThreeImages } from '../utils/placeImages';

interface AttractionCardPlace {
  id: string | number;
  key: string;
  routeId?: string;
  title: string;
  province: string;
  category: string;
  description?: string;
  images: string[];
  latitude?: number;
  longitude?: number;
  location?: string;
  rating?: number;
  reviewCount?: number;
  openingHours?: string;
  recommendedTime?: string;
  entranceFee?: number;
  travelCaution?: string;
}

interface AttractionCardProps {
  attraction: AttractionCardPlace;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  variant: 'recommended' | 'nearby';
}

export default function AttractionCard({
  attraction,
  isFavorite,
  onToggleFavorite,
  variant,
}: AttractionCardProps) {
  const [placeImages, setPlaceImages] = useState(attraction.images);
  const firstImage = attraction.images[0] || '';
  const imageListKey = attraction.images.join('|');
  const { review, isLoading: reviewsLoading } = usePlaceReviews(attraction.title, attraction.province, {
    latitude: attraction.latitude,
    longitude: attraction.longitude,
  });
  const distanceKm = useUserDistance(
    attraction.latitude !== undefined && attraction.longitude !== undefined
      ? { latitude: attraction.latitude, longitude: attraction.longitude }
      : null,
  );
  const route = `/attraction/${attraction.routeId || attraction.id}`;
  const placeState = {
    title: attraction.title,
    location: attraction.location,
    province: attraction.province,
    category: attraction.category,
    description: attraction.description,
    rating: attraction.rating,
    images: placeImages,
    lat: attraction.latitude !== undefined ? String(attraction.latitude) : undefined,
    lon: attraction.longitude !== undefined ? String(attraction.longitude) : undefined,
    openingHours: attraction.openingHours,
    recommendedTime: attraction.recommendedTime,
    entranceFee: attraction.entranceFee,
    reviewCount: attraction.reviewCount,
    travelCaution: attraction.travelCaution,
    favoriteKey: attraction.key,
  };
  useEffect(() => {
    setPlaceImages(attraction.images);
    if (firstImage || attraction.latitude === undefined || attraction.longitude === undefined) return;
    let active = true;
    fetchPlaceImages(attraction.title, attraction.latitude, attraction.longitude)
      .then((images) => {
        if (active) setPlaceImages(lockThreeImages(images));
      });
    return () => {
      active = false;
    };
  }, [attraction.latitude, attraction.longitude, attraction.title, firstImage, imageListKey]);
  const isRecommended = variant === 'recommended';
  const cardClassName = isRecommended
    ? 'group overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_16px_rgba(31,46,122,0.08)] transition-all hover:-translate-y-0.5 hover:shadow-lg'
    : 'group flex min-h-24 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_3px_12px_rgba(31,46,122,0.07)] transition-all hover:-translate-y-0.5 hover:shadow-md';

  return (
    <article className={cardClassName}>
      <div className={`relative ${isRecommended ? 'h-28 overflow-hidden sm:h-32' : 'h-24 w-28 shrink-0 overflow-hidden sm:w-32'}`}>
        <Link to={route} state={placeState} aria-label={`ดูรายละเอียด ${attraction.title}`}>
          {placeImages[0] ? (
            <img
              src={placeImages[0]}
              alt={attraction.title}
              className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-105`}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-sky-50 to-blue-100 text-blue-300" aria-label={`ไม่มีรูปภาพสำหรับ${attraction.title}`}>
              <Compass className="h-8 w-8" aria-hidden="true" />
            </div>
          )}
        </Link>
        {isRecommended && (
          <span className="absolute left-2 top-2 max-w-[calc(100%-3rem)] truncate rounded-full bg-[#1F2E7A]/80 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
            {attraction.category}
          </span>
        )}
        <button
          type="button"
          onClick={onToggleFavorite}
          className={`absolute right-3 top-3 flex items-center justify-center rounded-full bg-white/95 text-slate-600 shadow-md transition hover:scale-105 hover:text-rose-500 ${
            isRecommended ? 'h-8 w-8' : 'right-2 top-2 h-7 w-7'
          }`}
          aria-label={isFavorite ? `นำ${attraction.title}ออกจากรายการโปรด` : `บันทึก${attraction.title}เป็นรายการโปรด`}
          aria-pressed={isFavorite}
        >
          <Heart className={`${isRecommended ? 'h-4 w-4' : 'h-3.5 w-3.5'} ${isFavorite ? 'fill-rose-500 text-rose-500' : ''}`} />
        </button>
      </div>
      <Link to={route} state={placeState} className={`block min-w-0 ${isRecommended ? 'min-h-[92px] p-3' : 'flex-1 p-2.5'}`}>
        <div className="flex items-center justify-between gap-2">
          <h3 className={`line-clamp-1 min-w-0 font-bold text-[#1F2E7A] ${isRecommended ? 'text-sm' : 'text-xs transition-colors group-hover:text-blue-700'}`}>
            {attraction.title}
          </h3>
          <ChevronRight className="h-4 w-4 shrink-0 text-[#1F2E7A]" aria-hidden="true" />
        </div>
        {attraction.province && (
          <p className={`mt-1 inline-flex min-w-0 items-center gap-1 ${isRecommended ? 'text-[10px]' : 'text-[10px]'} text-slate-500`}>
            <MapPin className="h-3.5 w-3.5 shrink-0 text-[#1F2E7A]" />
            <span className="truncate">{attraction.province}</span>
          </p>
        )}
        {reviewsLoading ? (
          <div className="mt-1 h-3.5 w-32 animate-pulse rounded bg-slate-100" aria-label="กำลังโหลดรีวิว" />
        ) : (typeof review?.rating === 'number' || typeof attraction.rating === 'number') && (
          <p className={`mt-1 inline-flex items-center gap-1.5 ${isRecommended ? 'text-[10px]' : 'text-xs'} text-slate-600`}>
            <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500" />
            <span>{(review?.rating ?? attraction.rating)?.toFixed(1)}</span>
            {(review?.reviewCount ?? attraction.reviewCount) !== undefined
              && <span>({(review?.reviewCount ?? attraction.reviewCount)?.toLocaleString('th-TH')} รีวิว)</span>}
          </p>
        )}
        {distanceKm !== null && (
          <p className={`mt-1 inline-flex items-center gap-1.5 ${isRecommended ? 'text-[10px]' : 'text-xs font-semibold'} text-slate-600`}>
            <MapPin className="h-3.5 w-3.5 shrink-0 text-[#1F2E7A]" />
            {formatUserDistance(distanceKm)}
          </p>
        )}
      </Link>
    </article>
  );
}
