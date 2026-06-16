import { useEffect, useState } from 'react';
import Home from './pages/Home.jsx';
import { Terms, Privacy, Support } from './pages/Legal.jsx';

// Tiny hash router — no dependency. Routes: #/ , #/terms , #/privacy , #/support
function useHashRoute() {
  const [route, setRoute] = useState(window.location.hash || '#/');
  useEffect(() => {
    const onChange = () => {
      setRoute(window.location.hash || '#/');
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export default function App() {
  const route = useHashRoute();
  const path = route.replace(/^#/, '').split('?')[0];

  if (path === '/terms') return <Terms />;
  if (path === '/privacy') return <Privacy />;
  if (path === '/support') return <Support />;
  return <Home />;
}
