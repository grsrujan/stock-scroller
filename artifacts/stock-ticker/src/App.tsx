import { Route, Switch } from "wouter";
import TickerPage from "@/pages/TickerPage";
import WatchlistPage from "@/pages/WatchlistPage";
import HeatmapPage from "@/pages/HeatmapPage";

function App() {
  return (
    <Switch>
      <Route path="/" component={TickerPage} />
      <Route path="/watchlist" component={WatchlistPage} />
      <Route path="/heatmap" component={HeatmapPage} />
      <Route>404 Not Found</Route>
    </Switch>
  );
}

export default App;
