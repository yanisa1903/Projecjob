import { ChevronRight, Heart, MapPin, Star } from 'lucide-react';
import { Link } from 'react-router';
import { formatUserDistance, useUserDistance } from '../hooks/useUserDistance';
import { usePlaceReviews } from '../hooks/usePlaceReviews';

interface AttractionCardPlace {
  id: string | number;
  key: string;
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
  const { review, isLoading: reviewsLoading } = usePlaceReviews(attraction.title, attraction.province);
  const distanceKm = useUserDistance(
    attraction.latitude !== undefined && attraction.longitude !== undefined
      ? { latitude: attraction.latitude, longitude: attraction.longitude }
      : null,
  );
  const route = `/attraction/${attraction.id}`;
  const placeState = {
    title: attraction.title,
    location: attraction.location,
    province: attraction.province,
    category: attraction.category,
    description: attraction.description,
    rating: attraction.rating,
    images: attraction.images,
    lat: attraction.latitude !== undefined ? String(attraction.latitude) : undefined,
    lon: attraction.longitude !== undefined ? String(attraction.longitude) : undefined,
    openingHours: attraction.openingHours,
    recommendedTime: attraction.recommendedTime,
    entranceFee: attraction.entranceFee,
    reviewCount: attraction.reviewCount,
    travelCaution: attraction.travelCaution,
    favoriteKey: attraction.key,
  };
  const isRecommended = variant === 'recommended';
  const cardClassName = isRecommended
    ? 'overflow-hidden rounded-[20px] border border-slate-100 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg'
    : 'group overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_18px_rgba(31,46,122,0.07)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(31,46,122,0.14)]';

  return (
    <article className={cardClassName}>
      <div className={`relative ${isRecommended ? '' : 'overflow-hidden'}`}>
        <Link to={route} state={placeState} aria-label={`ดูรายละเอียด ${attraction.title}`}>
          <img
            src={attraction.images[0]}
            alt={attraction.title}
            className={`h-52 w-full object-cover sm:h-56 ${isRecommended ? '' : 'transition-transform duration-500 group-hover:scale-105'}`}
          />
        </Link>
        <button
          type="button"
          onClick={onToggleFavorite}
          className={`absolute right-3 top-3 flex items-center justify-center rounded-full bg-white/95 text-slate-600 shadow-md transition hover:scale-105 hover:text-rose-500 ${
            isRecommended ? 'h-9 w-9' : 'h-10 w-10'
          }`}
          aria-label={isFavorite ? `นำ${attraction.title}ออกจากรายการโปรด` : `บันทึก${attraction.title}เป็นรายการโปรด`}
          aria-pressed={isFavorite}
        >
          <Heart className={`${isRecommended ? 'h-4 w-4' : 'h-5 w-5'} ${isFavorite ? 'fill-rose-500 text-rose-500' : ''}`} />
        </button>
      </div>
      <Link to={route} state={placeState} className={`block ${isRecommended ? 'min-h-28 p-2.5 sm:p-3' : 'min-h-28 p-4'}`}>
        <div className="flex items-center justify-between gap-2">
          <h3 className={`line-clamp-1 min-w-0 font-bold text-[#1F2E7A] ${isRecommended ? 'text-sm' : 'text-base transition-colors group-hover:text-blue-700'}`}>
            {attraction.title}
          </h3>
          <ChevronRight className="h-4 w-4 shrink-0 text-[#1F2E7A]" aria-hidden="true" />
        </div>
        {attraction.province && (
          <p className={`mt-1 inline-flex items-center gap-1.5 ${isRecommended ? 'text-[10px]' : 'text-xs'} text-slate-500`}>
            <MapPin className="h-3.5 w-3.5 shrink-0 text-[#1F2E7A]" />
            {attraction.province}
          </p>
        )}
        {reviewsLoading ? (
          <div className="mt-1 h-3.5 w-32 animate-pulse rounded bg-slate-100" aria-label="กำลังโหลดรีวิว" />
        ) : review && (
          <p className={`mt-1 inline-flex items-center gap-1.5 ${isRecommended ? 'text-[10px]' : 'text-xs'} text-slate-600`}>
            <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500" />
            <span>{review.rating.toFixed(1)}</span>
            <span>({review.reviewCount.toLocaleString('th-TH')} รีวิว)</span>
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
