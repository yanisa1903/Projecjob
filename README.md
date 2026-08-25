
  # Mobile Tourism App UI

  This is a code bundle for Mobile Tourism App UI. The original project is available at https://www.figma.com/design/GmLazzQEsjnY3cQejlGTT5/Mobile-Tourism-App-UI.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## Tourism Authority of Thailand API

  Copy `.env.example` to `.env` and set `VITE_TAT_API_KEY` with a key from the TAT developer portal and `VITE_WINDY_API_KEY` with a key from the Windy developer portal. The homepage then loads domestic attractions and their image URLs from TAT; attraction weather uses the live Windy point forecast. When no Windy key is configured, the app uses the public Open-Meteo forecast so weather still appears. Wikipedia and Wikimedia Commons are used when an attraction has no image. Without a TAT key, the app uses its local demo data for attractions.
  