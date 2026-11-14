import { handlePlacesApi } from './places-api.mjs';
import { handleTatApi } from './tat-api.mjs';
import { handleCkanApi } from './ckan-api.mjs';

function middleware(googlePlacesApiKey, tatApiKey, env) {
  return (request, response, next) => {
    if (request.url?.startsWith('/api/ckan/')) {
      void handleCkanApi(request, response, env);
    } else if (request.url?.startsWith('/api/tat/attraction')) {
      void handleTatApi(request, response, tatApiKey);
    } else if (request.url?.startsWith('/api/places/')) {
      void handlePlacesApi(request, response, googlePlacesApiKey);
    } else {
      next();
    }
  };
}

export function placesProxyPlugin(googlePlacesApiKey, tatApiKey, env) {
  return {
    name: 'google-places-server-proxy',
    configureServer(server) {
      server.middlewares.use(middleware(googlePlacesApiKey, tatApiKey, env));
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware(googlePlacesApiKey, tatApiKey, env));
    },
  };
}
