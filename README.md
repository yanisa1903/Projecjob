
  # Mobile Tourism App UI

  This is a code bundle for Mobile Tourism App UI. The original project is available at https://www.figma.com/design/GmLazzQEsjnY3cQejlGTT5/Mobile-Tourism-App-UI.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## Google Places Search

  The home-page place search uses the public Photon API backed by OpenStreetMap, filters results to Thailand, and does not require a Google API key. Photon requests are debounced, rate-limited, and cached in memory. `GOOGLE_PLACES_API_KEY` is only used by optional Google-backed detail, review, or photo features; do not add a `VITE_` prefix to a server key.

  Development uses the Vite middleware started by `npm run dev`. For production, run `npm run build` and then `npm start` to serve the built app and Places API proxy from the Node server. Configure `PORT` if the hosting platform requires a specific port.

  ## Tourism Authority of Thailand API

  Copy `.env.example` to `.env` and set `VITE_TAT_API_KEY` with a key from the TAT developer portal and `VITE_TMD_API_KEY` with a token from the Thai Meteorological Department NWP API. The attraction weather first uses the live TMD forecast by coordinates, then falls back to Windy/Open-Meteo if the TMD token is unavailable. Without a TAT key, the app uses its local demo data for attractions.
  