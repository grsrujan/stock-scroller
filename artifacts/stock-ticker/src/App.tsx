import { Route, Switch } from "wouter";
import TickerPage from "@/pages/TickerPage";
import WatchlistPage from "@/pages/WatchlistPage";

function App() {
  return (
    <Switch>
      <Route path="/" component={TickerPage} />
      <Route path="/watchlist" component={WatchlistPage} />
      <Route>404 Not Found</Route>
    </Switch>
  );
}

export default App;
