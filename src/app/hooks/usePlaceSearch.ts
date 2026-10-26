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
      province?: string;
      rating?: number;
      reviewCount?: number;
    };

function normalizePlace(item: PlaceAutocompleteResult): PlaceSearchOption {
  const rawPlaceType = item.types?.find((type) => type.includes(':'))?.split(':').at(-1)?.replaceAll('_', ' ');
  const placeType = rawPlaceType ? PLACE_TYPE_LABELS[rawPlaceType] || rawPlaceType : undefined;
  const location = item.province && !item.address.includes(item.province)
    ? [item.address, item.province].filter(Boolean).join(', ')
    : item.address;
  return {
    kind: 'place',
    id: item.placeId,
    label: item.name,
    subtitle: [location, placeType].filter((part): part is string => Boolean(part)).join(' · '),
    latitude: item.latitude,
    longitude: item.longitude,
    types: item.types,
    province: item.province,
    rating: item.rating,
    reviewCount: item.userRatingCount,
  };
}

const CATEGORY_ALIASES: Record<string, string[]> = {
  'ทะเล': ['ชายหาด', 'beach', 'beaches', 'sea'],
  'เกาะ': ['island', 'islands'],
  'ภูเขา': ['mountain', 'mountains'],
  'น้ำตก': ['waterfall', 'waterfalls'],
  'จุดชมวิว': ['viewpoint', 'viewpoints', 'scenic view'],
  'ธรรมชาติ': ['nature', 'national park', 'forest', 'natural reserve'],
  'ประวัติศาสตร์': ['historic', 'historical site', 'archaeological site'],
  'วัด': ['temple', 'temples'],
  'อุทยาน': ['national park', 'national parks'],
  'คาเฟ่': ['cafe', 'cafes', 'coffee shop'],
  'ตลาด': ['market', 'markets'],
  'พิพิธภัณฑ์': ['museum', 'museums'],
};

const PROVINCE_ALIASES: Record<string, string[]> = {
  'กรุงเทพมหานคร': ['bangkok'],
  'กระบี่': ['krabi'],
  'กาญจนบุรี': ['kanchanaburi'],
  'ชลบุรี': ['chonburi'],
  'เชียงราย': ['chiang rai'],
  'เชียงใหม่': ['chiang mai'],
  'พระนครศรีอยุธยา': ['ayutthaya'],
  'พังงา': ['phang nga'],
  'ภูเก็ต': ['phuket'],
  'สุราษฎร์ธานี': ['surat thani'],
};

const PLACE_TYPE_LABELS: Record<string, string> = {
  beach: 'ชายหาด',
  bay: 'อ่าว',
  island: 'เกาะ',
  waterfall: 'น้ำตก',
  peak: 'ภูเขา / ยอดเขา',
  mountain_range: 'แนวเทือกเขา',
  viewpoint: 'จุดชมวิว',
  place_of_worship: 'ศาสนสถาน',
  cafe: 'คาเฟ่',
  museum: 'พิพิธภัณฑ์',
  national_park: 'อุทยานแห่งชาติ',
};

export function usePlaceSearch(query: string, isOpen: boolean) {
  const [places, setPlaces] = useState<PlaceSearchOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const quickOptions = useMemo<PlaceSearchOption[]>(() => {
    const normalized = query.trim().toLocaleLowerCase('th').normalize('NFC');
    if (normalized.length < 2) return [];
    const provinces = THAI_PROVINCES
      .filter((province) => [province, ...(PROVINCE_ALIASES[province] || [])]
        .some((alias) => alias.toLocaleLowerCase('th').normalize('NFC').includes(normalized)
          || normalized.includes(alias.toLocaleLowerCase('th').normalize('NFC'))))
      .slice(0, 5)
      .map((province) => ({
        kind: 'province' as const,
        id: province,
        label: province,
        subtitle: 'จังหวัด',
      }));
    const categories = PLACE_CATEGORIES
      .filter((category) => [category, ...(CATEGORY_ALIASES[category] || [])]
        .some((alias) => alias.toLocaleLowerCase('th').normalize('NFC').includes(normalized)
          || normalized.includes(alias.toLocaleLowerCase('th').normalize('NFC'))))
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
