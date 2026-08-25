
  # Mobile Tourism App UI

  This is a code bundle for Mobile Tourism App UI. The original project is available at https://www.figma.com/design/GmLazzQEsjnY3cQejlGTT5/Mobile-Tourism-App-UI.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## Tourism Authority of Thailand API

  Copy `.env.example` to `.env` and set `VITE_TAT_API_KEY` with a key from the TAT developer portal and `VITE_TMD_API_KEY` with a token from the Thai Meteorological Department NWP API. The attraction weather first uses the live TMD forecast by coordinates, then falls back to Windy/Open-Meteo if the TMD token is unavailable. Without a TAT key, the app uses its local demo data for attractions.
  