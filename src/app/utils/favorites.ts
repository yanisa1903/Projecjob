export interface FavoritePlace {
  key: string;
  title: string;
  location: string;
  province: string;
  category: string;
  description?: string;
  images: string[];
  rating?: number;
  reviewCount?: number;
  latitude?: number;
  longitude?: number;
  route: string;
  placeState: Record<string, unknown>;
}

const FAVORITE_IDS_KEY = 'favorite-attractions';
const FAVORITE_DATA_KEY = 'favorite-attraction-data';
const FAVORITES_EVENT = 'favorite-attractions-change';

function readIds(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(FAVORITE_IDS_KEY) || '[]');
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function readData(): Record<string, FavoritePlace> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(FAVORITE_DATA_KEY) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, FavoritePlace>
      : {};
  } catch {
    return {};
  }
}

function notifyFavoritesChanged() {
  window.dispatchEvent(new Event(FAVORITES_EVENT));
}

export function saveFavoritePlace(place: FavoritePlace) {
  const ids = readIds();
  if (!ids.includes(place.key)) ids.push(place.key);
  const data = readData();
  data[place.key] = place;
  localStorage.setItem(FAVORITE_IDS_KEY, JSON.stringify(ids));
  localStorage.setItem(FAVORITE_DATA_KEY, JSON.stringify(data));
  notifyFavoritesChanged();
}

export function removeFavoritePlace(key: string) {
  const ids = readIds().filter((item) => item !== key);
  const data = readData();
  delete data[key];
  localStorage.setItem(FAVORITE_IDS_KEY, JSON.stringify(ids));
  localStorage.setItem(FAVORITE_DATA_KEY, JSON.stringify(data));
  notifyFavoritesChanged();
}

export function getFavoritePlaces(): FavoritePlace[] {
  const ids = readIds();
  const data = readData();
  return ids.map((key) => data[key]).filter((place): place is FavoritePlace => Boolean(place));
}

export function getFavoriteIds(): string[] {
  return readIds();
}

export function subscribeToFavorites(onChange: () => void) {
  window.addEventListener(FAVORITES_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(FAVORITES_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}
