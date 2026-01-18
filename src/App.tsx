import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import './styles.css';

function App() {
  const location = useLocation();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="app">
      {!isOnline && (
        <div style={{
          backgroundColor: '#ff9800',
          color: 'white',
          padding: '0.5rem',
          textAlign: 'center',
          fontSize: '0.9rem',
          fontWeight: 'bold',
        }}>
          Offline: Calendar sync disabled
        </div>
      )}
      <nav className="nav">
        <div className="nav-brand">Grooming CRM</div>
        <div className="nav-links">
          <Link 
            to="/today" 
            className={isActive('/today') ? 'active' : ''}
          >
            Today
          </Link>
          <Link 
            to="/dogs" 
            className={isActive('/dogs') ? 'active' : ''}
          >
            Dogs
          </Link>
          <Link 
            to="/settings" 
            className={isActive('/settings') ? 'active' : ''}
          >
            Settings
          </Link>
        </div>
      </nav>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

export default App;
