import './App.css'
import WeightChart from './components/WeightChart';
  
const App = () => (
  <main className="App">
    <header className="app-header">
      <p className="eyebrow">Daily Body Metrics</p>
      <h1>おじさんのからだログ</h1>
    </header>
    <WeightChart />
  </main>
);

export default App;
