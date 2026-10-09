import { useEffect, useMemo, useState } from 'react';
import { PLACE_CATEGORIES, THAI_PROVINCES } from '../data/provinces';
import { autocompletePlaces, type PlaceAutocompleteResult } from '../services/placesApi';

export type PlaceSearchOption =
  | { kind: 'province'; id: string; label: string; subtitle: string }
  | { kind: 'category'; id: string; label: string; subtitle: string }
  | {
      kind: 'place';
      id: string;
      label: string;
      subtitle: string;
      latitude?: number;
      longitude?: number;
      types?: string[];
      rating?: number;
      reviewCount?: number;
    };

function normalizePlace(item: PlaceAutocompleteResult): PlaceSearchOption {
  return {
    kind: 'place',
    id: item.placeId,
    label: item.name,
    subtitle: item.address,
    latitude: item.latitude,
    longitude: item.longitude,
    types: item.types,
    rating: item.rating,
    reviewCount: item.userRatingCount,
  };
}

export function usePlaceSearch(query: string, isOpen: boolean) {
  const [places, setPlaces] = useState<PlaceSearchOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const quickOptions = useMemo<PlaceSearchOption[]>(() => {
    const normalized = query.trim().toLocaleLowerCase('th');
    if (normalized.length < 2) return [];
    const provinces = THAI_PROVINCES
      .filter((province) => province.toLocaleLowerCase('th').includes(normalized))
      .slice(0, 5)
      .map((province) => ({
        kind: 'province' as const,
        id: province,
        label: province,
        subtitle: 'จังหวัด',
      }));
    const categories = PLACE_CATEGORIES
      .filter((category) => category.toLocaleLowerCase('th').includes(normalized))
      .slice(0, 5)
      .map((category) => ({
        kind: 'category' as const,
        id: category,
        label: category,
        subtitle: 'ประเภทสถานที่',
      }));
    return [...provinces, ...categories];
  }, [query]);

  useEffect(() => {
    const term = query.trim();
    if (!isOpen || term.length < 2) {
      setPlaces([]);
      setIsLoading(false);
      setError('');
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError('');
    setPlaces([]);
    const timer = window.setTimeout(() => {
      void autocompletePlaces(term, controller.signal)
        .then((results) => {
        if (controller.signal.aborted) return;
        setPlaces(results.map(normalizePlace));
        setIsLoading(false);
      })
        .catch((cause: unknown) => {
          if (controller.signal.aborted) return;
          setError(cause instanceof Error ? cause.message : 'เกิดข้อผิดพลาดในการค้นหาสถานที่');
          setIsLoading(false);
      });
    }, 400);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, isOpen]);

  const options = useMemo(
    () => [...quickOptions, ...places].filter((option, index, all) =>
      all.findIndex((candidate) => candidate.kind === option.kind && candidate.id === option.id) === index),
    [places, quickOptions],
  );

  return {
    options,
    isLoading,
    error,
  };
}
