
  # Mobile Tourism App UI

  This is a code bundle for Mobile Tourism App UI. The original project is available at https://www.figma.com/design/GmLazzQEsjnY3cQejlGTT5/Mobile-Tourism-App-UI.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## Google Places Search

  The home-page place search uses the public Photon API backed by OpenStreetMap, filters results to Thailand, and does not require a Google API key. Photon requests are debounced, rate-limited, and cached in memory. `GOOGLE_PLACES_API_KEY` is only used by optional Google-backed detail, review, or photo features; do not add a `VITE_` prefix to a server key.

  Development uses the Vite middleware started by `npm run dev`. For production, run `npm run build` and then `npm start` to serve the built app and Places API proxy from the Node server. Configure `PORT` if the hosting platform requires a specific port.

  ## Tourism Authority of Thailand API

  Copy `.env.example` to `.env` and set `TAT_API_KEY` with a key from the TAT developer portal and `VITE_TMD_API_KEY` with a token from the Thai Meteorological Department NWP API. Keep `TAT_API_KEY` server-side (do not use a `VITE_` prefix). Attraction detail requests go through the app server and fetch available descriptions, address, coordinates, images, contact and visitor information from TAT; fields not returned by the API remain unavailable or use existing fallback data. The attraction weather first uses the live TMD forecast by coordinates, then falls back to Windy/Open-Meteo if the TMD token is unavailable. Without a TAT key, the app uses its local demo data for attractions and shows a configuration notice on detail pages.

  ## Ministry of Tourism and Sports CKAN

  The app reads the ministry's published JSON Resources through a server-side proxy, not by scraping `mots.go.th`. Resource URLs can be overridden with `CKAN_ATTRACTIONS_RESOURCE_URL`, `CKAN_ACTIVITIES_RESOURCE_URL`, `CKAN_ACCOMMODATIONS_RESOURCE_URL`, and `CKAN_RESTAURANTS_RESOURCE_URL`; otherwise the defaults point to the CKAN dataset files. Responses are cached for 15 minutes, limited to 100 records per request, and support pagination and filtering over the records actually present in each downloaded file.

  These files are partial snapshots, not the full dataset or a live DataStore API: the checked resources contained 10 attraction rows (89 reported), 2 activity rows, 10 accommodation rows (354 reported), and 10 restaurant rows (127 reported). DataStore queries for these resources were unavailable. Some fields such as contact details, opening hours, coordinates, and images may be absent; the UI labels missing values instead of generating them. Snapshot dates may lag the update frequency stated in CKAN metadata. Check the [CKAN API documentation](https://docs.ckan.org/en/2.10/api/) and the ministry's [Open API access information](https://www.thailandtourismdirectory.go.th/th/openapi) for current access requirements and licensing before redistributing data.

  Search results backed by OpenStreetMap can also show the exact OSM record's description, opening hours, contact, fee, and website when those tags are present. These community-maintained fields are labeled separately and are not represented as ministry data; see [OpenStreetMap's copyright and attribution requirements](https://www.openstreetmap.org/copyright).

  Place details can supplement missing descriptions and images with the Thai or English Wikipedia API, only when the article title matches the place name and its coordinates are nearby when available. The server caches results for six hours and does not scrape article pages. Wikipedia descriptions link to the source article and CC BY-SA 4.0; an image is shown only when Wikimedia Commons supplies creator, license, and source metadata, which the UI displays as attribution. Wikipedia/Commons data is supplemental and does not replace CKAN, TAT, or exact OpenStreetMap fields. The "จุดเด่นของสถานที่" section shows up to four concise highlights and filters out address, contact, opening-hours, and operational notice data.

  The home-page "สถานที่แนะนำ" list uses CKAN attraction records as its base and supplements them with Thailand-bounded OpenStreetMap search results so a partial CKAN snapshot does not limit the list. Google Places ratings and review counts are looked up for recommendation candidates and used to rank popularity when available; notable Thai destinations provide a fallback order if review data is unavailable. Missing reviews or photos do not hide a place. The list shows up to 10 places, with no more than two per province, ordered by popularity and then distance for close scores. Opening hours and phone numbers are shown on cards and search results when CKAN provides them or when the matching OpenStreetMap record has the relevant `opening_hours` or `phone` tag. OSM details for search results are requested in batches of up to 50 records and cached for 24 hours; batches are queued at one request per second. Festival labels are limited to known Loy Krathong venues during October-November; other seasonal recommendations use labels such as "แนะนำฤดูหนาว" or "ยอดนิยม". These are seasonal recommendations, not live event listings. If CKAN and OSM both return no places, the existing local sample places keep the section populated.
  