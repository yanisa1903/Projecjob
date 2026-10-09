import { RouterProvider } from 'react-router';
import { router } from './routes';
import { UserLocationProvider } from './context/UserLocationContext';

export default function App() {
  return (
    <UserLocationProvider>
      <RouterProvider router={router} />
    </UserLocationProvider>
  );
}