import { useNotifications } from '../../contexts/NotificationContext';
import { X, CheckCircle, Info, AlertTriangle, AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

const TYPE_CONFIG = {
  success: {
    icon: CheckCircle,
    border: 'rgba(76, 175, 80, 0.4)',
    bg: 'rgba(76, 175, 80, 0.08)',
    glow: 'rgba(76, 175, 80, 0.15)',
    color: '#4caf50',
  },
  info: {
    icon: Info,
    border: 'rgba(0, 255, 255, 0.4)',
    bg: 'rgba(0, 255, 255, 0.06)',
    glow: 'rgba(0, 255, 255, 0.15)',
    color: '#00ffff',
  },
  warning: {
    icon: AlertTriangle,
    border: 'rgba(255, 193, 7, 0.4)',
    bg: 'rgba(255, 193, 7, 0.08)',
    glow: 'rgba(255, 193, 7, 0.15)',
    color: '#ffc107',
  },
  error: {
    icon: AlertCircle,
    border: 'rgba(244, 67, 54, 0.4)',
    bg: 'rgba(244, 67, 54, 0.08)',
    glow: 'rgba(244, 67, 54, 0.15)',
    color: '#f44336',
  },
};

function Toast({ notification, onDismiss }) {
  const [visible, setVisible] = useState(false);
  const cfg = TYPE_CONFIG[notification.type] || TYPE_CONFIG.info;
  const Icon = cfg.icon;

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => onDismiss(notification.id), 200);
  };

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-lg backdrop-blur-md transition-all duration-200 max-w-sm"
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        boxShadow: `0 0 20px ${cfg.glow}, 0 4px 12px rgba(0,0,0,0.3)`,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
      }}
    >
      <Icon className="w-4 h-4 flex-shrink-0" style={{ color: cfg.color }} />
      <span className="text-sm text-gray-200 flex-1">{notification.message}</span>
      <button
        onClick={handleDismiss}
        className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const { notifications, dismiss } = useNotifications();

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {notifications.map(n => (
        <div key={n.id} className="pointer-events-auto">
          <Toast notification={n} onDismiss={dismiss} />
        </div>
      ))}
    </div>
  );
}
