import { useMemo } from 'react';
import { useUserCoordinates } from '../context/UserLocationContext';
import { haversineKm, type Coordinates } from '../utils/geo';

export function useUserDistance(destination?: Coordinates | null): number | null {
  const origin = useUserCoordinates();
  return useMemo(() => {
    if (!origin || !destination
      || !Number.isFinite(destination.latitude)
      || !Number.isFinite(destination.longitude)) return null;
    return haversineKm(origin, destination);
  }, [destination?.latitude, destination?.longitude, origin]);
}

export function formatUserDistance(distanceKm: number): string {
  return distanceKm < 1
    ? `${Math.round(distanceKm * 1000).toLocaleString('th-TH')} ม. จากคุณ`
    : `${Math.round(distanceKm).toLocaleString('th-TH')} กม. จากคุณ`;
}
