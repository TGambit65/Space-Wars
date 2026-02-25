import { Sparkles, Zap, Shield, Navigation, FlaskConical, Fuel, Crosshair, Timer, Gift } from 'lucide-react';

const bonusIcons = {
  navigation: Navigation,
  energy: Zap,
  science: FlaskConical,
  shields: Shield,
  crew: Gift,
  speed: Navigation,
  special: Timer,
  damage: Crosshair,
  piloting: Navigation,
  fuel: Fuel,
};

const rarityColors = {
  common: 'border-gray-500 bg-gray-500/10',
  uncommon: 'border-accent-green bg-accent-green/10',
  rare: 'border-accent-cyan bg-accent-cyan/10',
  epic: 'border-accent-purple bg-accent-purple/10',
  legendary: 'border-accent-orange bg-accent-orange/10',
};

function getRarity(name) {
  if (name.includes('Temporal') || name.includes('Void')) return 'legendary';
  if (name.includes('Quantum') || name.includes('Neural') || name.includes('Gravity')) return 'epic';
  if (name.includes('Alien') || name.includes('Precursor')) return 'rare';
  if (name.includes('Fusion') || name.includes('Bio')) return 'uncommon';
  return 'common';
}

function ArtifactsList({ artifacts, onClaim }) {
  const claimedArtifacts = artifacts.filter(a => a.owner_user_id);
  const unclaimedArtifacts = artifacts.filter(a => !a.owner_user_id && a.is_discovered);

  return (
    <div className="space-y-6">
      {/* Unclaimed Artifacts */}
      {unclaimedArtifacts.length > 0 && (
        <div className="card">
          <h2 className="card-header">
            <Sparkles className="w-5 h-5" /> Discovered Artifacts (Unclaimed)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {unclaimedArtifacts.map(artifact => (
              <ArtifactCard key={artifact.artifact_id} artifact={artifact} onClaim={onClaim} />
            ))}
          </div>
        </div>
      )}

      {/* Owned Artifacts */}
      <div className="card">
        <h2 className="card-header">
          <Sparkles className="w-5 h-5" /> Your Collection ({claimedArtifacts.length})
        </h2>
        {claimedArtifacts.length === 0 ? (
          <p className="text-gray-400 text-center py-8">
            No artifacts in your collection. Explore planets to discover artifacts!
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {claimedArtifacts.map(artifact => (
              <ArtifactCard key={artifact.artifact_id} artifact={artifact} owned />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ArtifactCard({ artifact, onClaim, owned }) {
  const Icon = bonusIcons[artifact.bonus_type] || Sparkles;
  const rarity = getRarity(artifact.name);
  const rarityStyle = rarityColors[rarity];

  return (
    <div className={`p-4 rounded-lg border ${rarityStyle} transition-all hover:scale-[1.02]`}>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-space-700">
          <Icon className="w-6 h-6 text-accent-purple" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate">{artifact.name}</h3>
          <p className="text-sm text-gray-400 mt-1 line-clamp-2">{artifact.description}</p>
          
          <div className="flex items-center gap-2 mt-2">
            <span className="badge badge-purple capitalize">{artifact.bonus_type}</span>
            <span className="badge capitalize" style={{ 
              backgroundColor: `${rarityColors[rarity].split(' ')[1].replace('bg-', 'var(--')}`,
            }}>
              {rarity}
            </span>
          </div>
        </div>
      </div>

      {!owned && onClaim && (
        <button
          onClick={() => onClaim(artifact.artifact_id)}
          className="btn btn-success w-full mt-3"
        >
          Claim Artifact
        </button>
      )}

      {owned && artifact.bonus_value > 0 && (
        <div className="mt-3 pt-3 border-t border-space-600">
          <p className="text-xs text-gray-500">Bonus Effect</p>
          <p className="text-sm text-accent-green">+{artifact.bonus_value}% {artifact.bonus_type}</p>
        </div>
      )}
    </div>
  );
}

export default ArtifactsList;

