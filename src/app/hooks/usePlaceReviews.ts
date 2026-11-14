import { useEffect, useState } from 'react';

export interface PlaceReview {
  rating?: number;
  text: string;
  publishTime?: string;
  relativePublishTimeDescription?: string;
  authorName: string;
  authorUri?: string;
  authorPhotoUri?: string;
  googleMapsUri?: string;
}

export interface PlaceReviewSummary {
  rating?: number;
  reviewCount?: number;
  reviews: PlaceReview[];
  googleMapsUri?: string;
}

interface CachedReview {
  expiresAt: number;
  value: PlaceReviewSummary | null;
}

interface ReviewLookup {
  placeId?: string;
  latitude?: number;
  longitude?: number;
  enabled?: boolean;
}

const REVIEW_CACHE_DURATION_MS = 24 * 60 * 60 * 1000;
const MAX_CONCURRENT_REVIEW_LOOKUPS = 4;
let activeReviewLookups = 0;
const queuedReviewLookups: Array<() => void> = [];

async function fetchReviewWithLimit(url: string, signal: AbortSignal) {
  if (activeReviewLookups >= MAX_CONCURRENT_REVIEW_LOOKUPS) {
    await new Promise<void>((resolve) => queuedReviewLookups.push(resolve));
  }
  if (signal.aborted) {
    queuedReviewLookups.shift()?.();
    throw new DOMException('The request was aborted', 'AbortError');
  }
  activeReviewLookups += 1;
  try {
    return await fetch(url, { signal });
  } finally {
    activeReviewLookups -= 1;
    queuedReviewLookups.shift()?.();
  }
}

function cacheKey(name: string, province: string, lookup: ReviewLookup) {
  return `place-review-v2:${lookup.placeId || ''}:${name.trim().toLocaleLowerCase('th')}:${province.trim().toLocaleLowerCase('th')}:${lookup.latitude ?? ''}:${lookup.longitude ?? ''}`;
}

function readCachedReview(key: string): PlaceReviewSummary | null | undefined {
  try {
    const value = localStorage.getItem(key);
    if (!value) return undefined;
    const cached = JSON.parse(value) as CachedReview;
    if (cached.expiresAt <= Date.now()) {
      localStorage.removeItem(key);
      return undefined;
    }
    return cached.value;
  } catch {
    return undefined;
  }
}

export function usePlaceReviews(name: string, province: string, lookup: ReviewLookup = {}) {
  const key = cacheKey(name, province, lookup);
  const enabled = lookup.enabled !== false;
  const [review, setReview] = useState<PlaceReviewSummary | null>(() => enabled ? readCachedReview(key) ?? null : null);
  const [isLoading, setIsLoading] = useState(() => enabled && readCachedReview(key) === undefined);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled) {
      setReview(null);
      setIsLoading(false);
      setError('');
      return;
    }

    const cachedReview = readCachedReview(key);
    if (cachedReview !== undefined) {
      setReview(cachedReview);
      setIsLoading(false);
      setError('');
      return;
    }

    const controller = new AbortController();
    setReview(null);
    setError('');
    setIsLoading(true);
    const params = new URLSearchParams({ name: name.trim() });
    if (province.trim()) params.set('province', province.trim());
    if (lookup.placeId) params.set('placeId', lookup.placeId);
    if (lookup.latitude !== undefined) params.set('lat', String(lookup.latitude));
    if (lookup.longitude !== undefined) params.set('lon', String(lookup.longitude));
    fetchReviewWithLimit(`/api/places/reviews?${params.toString()}`, controller.signal)
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => null) as { error?: string } | null;
          throw new Error(payload?.error || `รีวิวไม่พร้อมใช้งาน (${response.status})`);
        }
        return response.json() as Promise<{ review: PlaceReviewSummary | null }>;
      })
      .then(({ review: result }) => {
        if (controller.signal.aborted) return;
        setReview(result);
        try {
          localStorage.setItem(key, JSON.stringify({
            expiresAt: Date.now() + REVIEW_CACHE_DURATION_MS,
            value: result,
          } satisfies CachedReview));
        } catch {
          // Browser storage may be unavailable; keep the result in component state.
        }
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : 'ไม่สามารถโหลดรีวิวสถานที่ได้');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [enabled, key, lookup.latitude, lookup.longitude, lookup.placeId, name, province]);

  return { review, isLoading, error };
}
