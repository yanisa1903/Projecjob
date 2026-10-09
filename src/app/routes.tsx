import { createBrowserRouter } from "react-router";
import HomePage from "./components/HomePage";
import AttractionDetail from "./components/AttractionDetail";
import RiskAlert from "./components/RiskAlert";
import SafeDestination from "./components/SafeDestination";
import SearchResults from "./components/SearchResults";
import FavoritesPage from "./components/FavoritesPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: HomePage,
  },
  {
    path: "/search",
    Component: SearchResults,
  },
  {
    path: "/favorites",
    Component: FavoritesPage,
  },
  {
    path: "/attraction/:id",
    Component: AttractionDetail,
  },
  {
    path: "/place/:placeId",
    Component: AttractionDetail,
  },
  {
    path: "/risk-alert/:id",
    Component: RiskAlert,
  },
  {
    path: "/safe-destination/:id",
    Component: SafeDestination,
  },
]);
