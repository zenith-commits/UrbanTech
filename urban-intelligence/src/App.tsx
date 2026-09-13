import { Dashboard } from './components/Dashboard';
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  return (
    <div className="min-h-screen bg-navy-900">
      <ErrorBoundary>
        <Dashboard />
      </ErrorBoundary>
    </div>
  );
}

export default App;