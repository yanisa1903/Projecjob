import { useEffect, useState } from 'react';

export interface PlaceReviewSummary {
  rating: number;
  reviewCount: number;
}

interface CachedReview {
  expiresAt: number;
  value: PlaceReviewSummary | null;
}

const REVIEW_CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

function cacheKey(name: string, province: string) {
  return `place-review-v1:${name.trim().toLocaleLowerCase('th')}:${province.trim().toLocaleLowerCase('th')}`;
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

export function usePlaceReviews(name: string, province: string) {
  const key = cacheKey(name, province);
  const [review, setReview] = useState<PlaceReviewSummary | null>(() => readCachedReview(key) ?? null);
  const [isLoading, setIsLoading] = useState(() => readCachedReview(key) === undefined);

  useEffect(() => {
    const cachedReview = readCachedReview(key);
    if (cachedReview !== undefined) {
      setReview(cachedReview);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setReview(null);
    setIsLoading(true);
    const params = new URLSearchParams({ name: name.trim(), province: province.trim() });
    fetch(`/api/places/reviews?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`รีวิวไม่พร้อมใช้งาน (${response.status})`);
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
      .catch(() => {
        if (!controller.signal.aborted) setReview(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [key, name, province]);

  return { review, isLoading };
}
