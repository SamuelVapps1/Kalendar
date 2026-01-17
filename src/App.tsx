import { Outlet, Link, useLocation } from 'react-router-dom';
import './styles.css';

function App() {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="app">
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
