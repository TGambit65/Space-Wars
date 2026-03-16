import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { planets as planetsApi, colonies as coloniesApi } from '../../services/api';
import Starfield from './Starfield';
import PlanetSphere from './PlanetSphere';
import OrbitHUD from './OrbitHUD';

const PlanetOrbitView = () => {
  const { planetId } = useParams();
  const navigate = useNavigate();

  const [planet, setPlanet] = useState(null);
  const [colony, setColony] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [scanning, setScanning] = useState(false);

  // Fetch planet data
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    planetsApi.getDetails(planetId)
      .then(res => {
        if (cancelled) return;
        const data = res.data.data || res.data;
        setPlanet(data);
        // If planet has a colony, fetch colony details
        if (data.colony) {
          setColony(data.colony);
        }
      })
      .catch(err => {
        if (cancelled) return;
        setError(err.response?.data?.message || 'Failed to load planet');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [planetId]);

  // Mouse parallax tracking
  const handleMouseMove = useCallback((e) => {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    setMousePos({
      x: (e.clientX - centerX) / centerX,
      y: (e.clientY - centerY) / centerY,
    });
  }, []);

  // Escape key → back to system
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') navigate('/system');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [navigate]);

  // Scan action
  const handleScan = useCallback(async () => {
    if (!planet || scanning) return;
    setScanning(true);
    try {
      // Scan uses sector-based endpoint
      await planetsApi.scan(planet.sector_id);
      // Re-fetch planet to get updated data
      const res = await planetsApi.getDetails(planetId);
      const data = res.data.data || res.data;
      setPlanet(data);
      if (data.colony) setColony(data.colony);
    } catch (err) {
      // Ignore scan errors silently
    } finally {
      setScanning(false);
    }
  }, [planet, planetId, scanning]);

  // Parallax transform for planet container
  const parallaxStyle = useMemo(() => ({
    transform: `perspective(800px) rotateY(${mousePos.x * 5}deg) rotateX(${-mousePos.y * 5}deg)`,
    transition: 'transform 0.1s ease-out',
  }), [mousePos.x, mousePos.y]);

  // Responsive planet size
  const planetSize = useMemo(() => {
    if (typeof window === 'undefined') return 350;
    return Math.min(350, window.innerWidth * 0.4, window.innerHeight * 0.45);
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="relative w-full h-screen bg-black">
        <Starfield />
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="w-16 h-16 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400 text-sm">Entering orbit...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !planet) {
    return (
      <div className="relative w-full h-screen bg-black">
        <Starfield />
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="text-center bg-space-900/80 backdrop-blur-sm border border-space-700 rounded-lg p-8 max-w-sm">
            <p className="text-accent-red text-lg mb-2">Planet Not Found</p>
            <p className="text-gray-400 text-sm mb-4">{error || 'Unable to locate this planet.'}</p>
            <button
              onClick={() => navigate('/system')}
              className="btn btn-primary text-sm"
            >
              Return to System
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Unscanned planet — mysterious silhouette
  if (!planet.is_scanned) {
    return (
      <div className="relative w-full h-screen bg-black" onMouseMove={handleMouseMove}>
        <Starfield />
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div style={parallaxStyle}>
            <div
              className="rounded-full"
              style={{
                width: planetSize,
                height: planetSize,
                background: 'radial-gradient(circle at 35% 35%, #1a1a2e 0%, #0a0a15 60%, #000 100%)',
                boxShadow: '0 0 60px 10px rgba(100,100,200,0.1), inset 0 0 40px rgba(0,0,0,0.8)',
              }}
            />
          </div>
        </div>
        <OrbitHUD
          planet={{ ...planet, name: 'Unknown Body' }}
          colony={null}
          onScan={handleScan}
          scanning={scanning}
        />
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-black" onMouseMove={handleMouseMove}>
      <Starfield />

      {/* Centered planet with parallax */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div style={parallaxStyle}>
          <PlanetSphere planet={planet} size={planetSize} />
        </div>
      </div>

      {/* HUD overlay */}
      <OrbitHUD
        planet={planet}
        colony={colony}
        onScan={handleScan}
        scanning={scanning}
      />
    </div>
  );
};

export default PlanetOrbitView;
