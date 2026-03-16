import { useMemo } from 'react';

const STAR_COUNT = 200;

// Fixed seed so stars don't shuffle on re-render
function seededStars() {
  const stars = [];
  let s = 42;
  const next = () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
  for (let i = 0; i < STAR_COUNT; i++) {
    const tier = next();
    let size, baseOpacity;
    if (tier < 0.6) {
      size = 1;
      baseOpacity = 0.3 + next() * 0.3;
    } else if (tier < 0.85) {
      size = 2;
      baseOpacity = 0.4 + next() * 0.3;
    } else {
      size = 3;
      baseOpacity = 0.5 + next() * 0.4;
    }
    stars.push({
      x: next() * 100,
      y: next() * 100,
      size,
      opacity: baseOpacity,
      twinkleDelay: next() * 5,
      twinkleDuration: 2 + next() * 4,
      shouldTwinkle: next() > 0.6,
    });
  }
  return stars;
}

const Starfield = () => {
  const stars = useMemo(() => seededStars(), []);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-black">
      {stars.map((star, i) => (
        <div
          key={i}
          className={star.shouldTwinkle ? 'animate-twinkle' : ''}
          style={{
            position: 'absolute',
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            borderRadius: '50%',
            backgroundColor: 'white',
            opacity: star.opacity,
            animationDelay: star.shouldTwinkle ? `${star.twinkleDelay}s` : undefined,
            animationDuration: star.shouldTwinkle ? `${star.twinkleDuration}s` : undefined,
          }}
        />
      ))}
    </div>
  );
};

export default Starfield;
