import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export interface UserCoordinates {
  latitude: number;
  longitude: number;
}

type UserLocationStatus = 'pending' | 'available' | 'unavailable';
interface UserLocationValue {
  coordinates: UserCoordinates | null;
  status: UserLocationStatus;
}

const UserLocationContext = createContext<UserLocationValue>({
  coordinates: null,
  status: 'pending',
});

export function UserLocationProvider({ children }: { children: ReactNode }) {
  const [coordinates, setCoordinates] = useState<UserCoordinates | null>(null);
  const [status, setStatus] = useState<UserLocationStatus>('pending');

  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus('unavailable');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setCoordinates({ latitude: coords.latitude, longitude: coords.longitude });
        setStatus('available');
      },
      () => setStatus('unavailable'),
      { enableHighAccuracy: false, maximumAge: 10 * 60 * 1000, timeout: 10000 },
    );
  }, []);

  return (
    <UserLocationContext.Provider value={{ coordinates, status }}>
      {children}
    </UserLocationContext.Provider>
  );
}

export function useUserLocation() {
  return useContext(UserLocationContext);
}

export function useUserCoordinates() {
  return useUserLocation().coordinates;
}
