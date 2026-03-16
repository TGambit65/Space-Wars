// Mobile utilities and PWA features for Space Wars 3000

class MobileUtils {
  constructor() {
    this.isOnline = navigator.onLine;
    this.isInstalled = window.matchMedia('(display-mode: standalone)').matches;
    this.deferredPrompt = null;
    
    this.init();
  }
  
  init() {
    this.setupEventListeners();
    this.setupPWAInstallPrompt();
    this.setupOfflineDetection();
    this.setupViewportFix();
    this.setupTouchOptimizations();
  }
  
  setupEventListeners() {
    // PWA install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallPrompt();
    });
    
    // App installed
    window.addEventListener('appinstalled', () => {
      console.log('PWA was installed');
      this.hideInstallPrompt();
      this.deferredPrompt = null;
    });
    
    // Online/offline detection
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.hideOfflineIndicator();
      this.syncOfflineData();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.showOfflineIndicator();
    });
    
    // Orientation change
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.adjustLayoutForOrientation();
      }, 100);
    });
    
    // Resize for mobile keyboard
    window.addEventListener('resize', () => {
      this.handleKeyboardToggle();
    });
  }
  
  setupPWAInstallPrompt() {
    // Don't show install prompt if already installed
    if (this.isInstalled) return;
    
    // Create install prompt HTML
    const promptHtml = `
      <div class="pwa-install-prompt" id="pwa-install-prompt">
        <button class="close-btn" onclick="mobileUtils.hideInstallPrompt()">&times;</button>
        <div class="prompt-content">
          <strong>Install Space Wars 3000</strong>
          <p>Get the full experience with our mobile app!</p>
          <button class="btn btn-sm btn-light" onclick="mobileUtils.installPWA()">
            Install
          </button>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', promptHtml);
  }
  
  showInstallPrompt() {
    // Only show if user hasn't dismissed it recently
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    const dismissedTime = dismissed ? parseInt(dismissed) : 0;
    const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
    
    if (daysSinceDismissed < 7) return; // Don't show for 7 days after dismissal
    
    setTimeout(() => {
      const prompt = document.getElementById('pwa-install-prompt');
      if (prompt) {
        prompt.classList.add('show');
      }
    }, 3000); // Show after 3 seconds
  }
  
  hideInstallPrompt() {
    const prompt = document.getElementById('pwa-install-prompt');
    if (prompt) {
      prompt.classList.remove('show');
      localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    }
  }
  
  async installPWA() {
    if (!this.deferredPrompt) return;
    
    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    
    this.deferredPrompt = null;
    this.hideInstallPrompt();
  }
  
  setupOfflineDetection() {
    // Create offline indicator
    const indicatorHtml = `
      <div class="offline-indicator" id="offline-indicator">
        <span>You're offline. Some features may be limited.</span>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', indicatorHtml);
    
    // Show indicator if starting offline
    if (!this.isOnline) {
      this.showOfflineIndicator();
    }
  }
  
  showOfflineIndicator() {
    const indicator = document.getElementById('offline-indicator');
    if (indicator) {
      indicator.classList.add('show');
    }
  }
  
  hideOfflineIndicator() {
    const indicator = document.getElementById('offline-indicator');
    if (indicator) {
      indicator.classList.remove('show');
    }
  }
  
  setupViewportFix() {
    // Fix for iOS Safari viewport units
    const setViewportHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    
    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);
  }
  
  setupTouchOptimizations() {
    // Prevent double-tap zoom on buttons
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (event) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    }, false);
    
    // Add touch feedback to interactive elements
    const addTouchFeedback = (selector) => {
      document.addEventListener('touchstart', (e) => {
        if (e.target.closest(selector)) {
          e.target.closest(selector).classList.add('touching');
        }
      });
      
      document.addEventListener('touchend', (e) => {
        if (e.target.closest(selector)) {
          setTimeout(() => {
            e.target.closest(selector).classList.remove('touching');
          }, 100);
        }
      });
    };
    
    addTouchFeedback('.btn');
    addTouchFeedback('.card');
    addTouchFeedback('.hull-card');
    addTouchFeedback('.component-card');
  }
  
  adjustLayoutForOrientation() {
    const orientation = screen.orientation ? screen.orientation.angle : window.orientation;
    const isLandscape = Math.abs(orientation) === 90;
    
    document.body.classList.toggle('landscape-mode', isLandscape);
    document.body.classList.toggle('portrait-mode', !isLandscape);
    
    // Adjust navigation for landscape on small screens
    if (isLandscape && window.innerHeight < 500) {
      document.body.classList.add('compact-nav');
    } else {
      document.body.classList.remove('compact-nav');
    }
  }
  
  handleKeyboardToggle() {
    // Detect if virtual keyboard is open on mobile
    const initialHeight = window.innerHeight;
    const currentHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const heightDifference = initialHeight - currentHeight;
    
    if (heightDifference > 150) {
      document.body.classList.add('keyboard-open');
    } else {
      document.body.classList.remove('keyboard-open');
    }
  }
  
  async syncOfflineData() {
    if (!this.isOnline) return;
    
    try {
      // Try to sync any offline data
      if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('sync-feedback');
      }
      
      console.log('Offline data sync initiated');
    } catch (error) {
      console.error('Error syncing offline data:', error);
    }
  }
  
  // Utility functions for mobile-specific features
  
  isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }
  
  isAndroid() {
    return /Android/.test(navigator.userAgent);
  }
  
  isMobile() {
    return /Mobi|Android/i.test(navigator.userAgent);
  }
  
  getDeviceType() {
    if (this.isIOS()) return 'ios';
    if (this.isAndroid()) return 'android';
    if (this.isMobile()) return 'mobile';
    return 'desktop';
  }
  
  getScreenSize() {
    const width = window.innerWidth;
    if (width < 480) return 'xs';
    if (width < 768) return 'sm';
    if (width < 1024) return 'md';
    return 'lg';
  }
  
  hasNotchSupport() {
    return 'CSS' in window && CSS.supports('padding-top: env(safe-area-inset-top)');
  }
  
  // Storage utilities for offline functionality
  
  async storeOfflineData(key, data) {
    try {
      if ('indexedDB' in window) {
        // Use IndexedDB for complex data
        const db = await this.openDB();
        const transaction = db.transaction(['offline'], 'readwrite');
        const store = transaction.objectStore('offline');
        await store.put({ key, data, timestamp: Date.now() });
      } else {
        // Fallback to localStorage
        localStorage.setItem(`offline_${key}`, JSON.stringify({
          data,
          timestamp: Date.now()
        }));
      }
    } catch (error) {
      console.error('Error storing offline data:', error);
    }
  }
  
  async getOfflineData(key) {
    try {
      if ('indexedDB' in window) {
        const db = await this.openDB();
        const transaction = db.transaction(['offline'], 'readonly');
        const store = transaction.objectStore('offline');
        const result = await store.get(key);
        return result ? result.data : null;
      } else {
        const stored = localStorage.getItem(`offline_${key}`);
        return stored ? JSON.parse(stored).data : null;
      }
    } catch (error) {
      console.error('Error retrieving offline data:', error);
      return null;
    }
  }
  
  async openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('SpaceWars3000Offline', 1);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('offline')) {
          db.createObjectStore('offline', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('feedback')) {
          db.createObjectStore('feedback', { keyPath: 'id', autoIncrement: true });
        }
      };
      
      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(event.target.error);
    });
  }
  
  // Performance optimizations for mobile
  
  enableLazyLoading() {
    if ('IntersectionObserver' in window) {
      const lazyImages = document.querySelectorAll('img[data-src]');
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            img.classList.remove('lazy');
            imageObserver.unobserve(img);
          }
        });
      });
      
      lazyImages.forEach((img) => imageObserver.observe(img));
    }
  }
  
  reduceBandwidthUsage() {
    // Reduce image quality on slow connections
    if ('connection' in navigator) {
      const connection = navigator.connection;
      if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
        document.body.classList.add('low-bandwidth');
      }
    }
  }
}

// Initialize mobile utilities when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.mobileUtils = new MobileUtils();
});

// CSS classes for mobile states
const mobileCSS = `
.touching {
  opacity: 0.8;
  transform: scale(0.98);
}

.keyboard-open .footer {
  display: none;
}

.compact-nav .navbar {
  padding: 0.25rem 1rem;
}

.compact-nav .navbar-brand {
  font-size: 0.9rem;
}

.compact-nav .nav-link {
  padding: 0.25rem 0.5rem;
  font-size: 0.85rem;
}

.low-bandwidth img {
  filter: contrast(0.8) brightness(0.9);
}

.landscape-mode .modal-dialog {
  max-height: 90vh;
}

.portrait-mode .universe-grid {
  font-size: 0.7rem;
}

@media (max-width: 480px) {
  .text-truncate-mobile {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
`;

// Inject mobile CSS
const style = document.createElement('style');
style.textContent = mobileCSS;
document.head.appendChild(style);