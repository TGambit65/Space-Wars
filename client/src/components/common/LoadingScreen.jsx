import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

const LOADING_MESSAGES = {
  default: ['Initializing systems...', 'Calibrating sensors...', 'Synchronizing data...'],
  trading: ['Accessing Trade Network...', 'Querying port manifests...', 'Securing data channel...'],
  ship: ['Establishing link with ship computer...', 'Running diagnostics...', 'Syncing telemetry...'],
  crafting: ['Loading fabrication matrices...', 'Scanning blueprint archives...', 'Initializing assemblers...'],
  events: ['Connecting to galactic event feed...', 'Retrieving community data...'],
  combat: ['Charging weapon systems...', 'Calculating trajectories...', 'Locking sensors...'],
  navigation: ['Plotting course...', 'Analyzing hyperlane data...', 'Syncing stellar charts...'],
  planet: ['Entering orbit...', 'Analyzing planetary composition...', 'Scanning surface...'],
  progression: ['Loading commander profile...', 'Compiling service record...'],
  colonies: ['Connecting to colonial network...', 'Downloading infrastructure data...'],
  missions: ['Scanning mission boards...', 'Decrypting intelligence briefs...'],
};

const LoadingScreen = ({ variant = 'default', className = '' }) => {
  const msgs = LOADING_MESSAGES[variant] || LOADING_MESSAGES.default;
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    if (msgs.length <= 1) return;
    const interval = setInterval(() => {
      setMsgIndex(i => (i + 1) % msgs.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [msgs.length]);

  return (
    <div className={`flex items-center justify-center h-64 ${className}`}>
      <div className="text-center">
        <RefreshCw className="w-10 h-10 text-accent-cyan animate-spin mx-auto mb-3" />
        <p className="text-sm text-accent-cyan transition-opacity duration-300">{msgs[msgIndex]}</p>
      </div>
    </div>
  );
};

export default LoadingScreen;
