import { useMemo } from 'react';
import { generateSurfaceSVG, generateCloudSVG, hasAtmosphere, PLANET_VISUALS } from './planetSVGPatterns';

const PlanetSphere = ({ planet, size = 350 }) => {
  const type = planet.type || 'Barren';
  const visuals = PLANET_VISUALS[type] || PLANET_VISUALS['Barren'];

  const surfaceSVG = useMemo(
    () => generateSurfaceSVG(type, planet.planet_id),
    [type, planet.planet_id]
  );

  const cloudSVG = useMemo(
    () => hasAtmosphere(type) ? generateCloudSVG(type, planet.planet_id) : null,
    [type, planet.planet_id]
  );

  const surfaceDataUrl = useMemo(
    () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(surfaceSVG)}`,
    [surfaceSVG]
  );

  const cloudDataUrl = useMemo(
    () => cloudSVG ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cloudSVG)}` : null,
    [cloudSVG]
  );

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Atmosphere glow (outer ring) */}
      <div
        className="absolute inset-0 rounded-full animate-atmo-pulse"
        style={{
          boxShadow: `0 0 ${size * 0.15}px ${size * 0.05}px ${visuals.glow}${Math.round(visuals.glowIntensity * 255).toString(16).padStart(2, '0')},
                      0 0 ${size * 0.3}px ${size * 0.1}px ${visuals.glow}33`,
        }}
      />

      {/* Atmosphere rim gradient */}
      <div
        className="absolute rounded-full"
        style={{
          inset: -size * 0.04,
          background: `radial-gradient(circle at 50% 50%, transparent 46%, ${visuals.glow}40 50%, ${visuals.glow}20 53%, transparent 56%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Planet disc (clipping container) */}
      <div
        className="absolute inset-0 rounded-full overflow-hidden"
        style={{ width: size, height: size }}
      >
        {/* Surface layer - scrolling SVG */}
        <div
          className="absolute inset-0 animate-planet-rotate"
          style={{
            width: size * 2,
            height: size,
            backgroundImage: `url("${surfaceDataUrl}")`,
            backgroundSize: `${size * 2}px ${size}px`,
            backgroundRepeat: 'repeat-x',
            animationDuration: `${visuals.surfaceSpeed}s`,
          }}
        />

        {/* Cloud layer */}
        {cloudDataUrl && (
          <div
            className="absolute inset-0 animate-cloud-rotate"
            style={{
              width: size * 2,
              height: size,
              backgroundImage: `url("${cloudDataUrl}")`,
              backgroundSize: `${size * 2}px ${size}px`,
              backgroundRepeat: 'repeat-x',
              animationDuration: `${visuals.cloudSpeed}s`,
            }}
          />
        )}

        {/* Day/night terminator */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0.55) 75%, rgba(0,0,0,0.65) 100%)',
            mixBlendMode: 'multiply',
          }}
        />

        {/* Spherical shading (makes flat disc look 3D) */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.1) 0%, transparent 40%, rgba(0,0,0,0.3) 80%, rgba(0,0,0,0.6) 100%)',
          }}
        />
      </div>
    </div>
  );
};

export default PlanetSphere;
