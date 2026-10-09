import { handlePlacesApi } from './places-api.mjs';

function middleware(apiKey) {
  return (request, response, next) => {
    if (!request.url?.startsWith('/api/places/')) {
      next();
      return;
    }
    void handlePlacesApi(request, response, apiKey);
  };
}

export function placesProxyPlugin(apiKey) {
  return {
    name: 'google-places-server-proxy',
    configureServer(server) {
      server.middlewares.use(middleware(apiKey));
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware(apiKey));
    },
  };
}
