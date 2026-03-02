import { Skull, Crown, ShoppingCart, Shield, Crosshair } from 'lucide-react';

const NPC_ICONS = {
  PIRATE: { icon: Skull, color: 'text-accent-red', bg: 'bg-accent-red/20', border: 'border-accent-red/30' },
  PIRATE_LORD: { icon: Crown, color: 'text-accent-purple', bg: 'bg-accent-purple/20', border: 'border-accent-purple/30' },
  TRADER: { icon: ShoppingCart, color: 'text-accent-green', bg: 'bg-accent-green/20', border: 'border-accent-green/30' },
  PATROL: { icon: Shield, color: 'text-accent-cyan', bg: 'bg-accent-cyan/20', border: 'border-accent-cyan/30' },
  BOUNTY_HUNTER: { icon: Crosshair, color: 'text-accent-orange', bg: 'bg-accent-orange/20', border: 'border-accent-orange/30' },
};

const SIZES = {
  sm: { container: 'w-8 h-8', icon: 'w-4 h-4' },
  md: { container: 'w-10 h-10', icon: 'w-5 h-5' },
  lg: { container: 'w-14 h-14', icon: 'w-7 h-7' },
};

const NPCPortrait = ({ npcType, size = 'md' }) => {
  const config = NPC_ICONS[npcType] || NPC_ICONS.PIRATE;
  const sizeConfig = SIZES[size] || SIZES.md;
  const Icon = config.icon;

  return (
    <div className={`${sizeConfig.container} rounded-full ${config.bg} border ${config.border} flex items-center justify-center flex-shrink-0`}>
      <Icon className={`${sizeConfig.icon} ${config.color}`} />
    </div>
  );
};

export default NPCPortrait;
