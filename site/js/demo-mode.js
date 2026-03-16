// Demo mode functionality for Space Wars 3000 frontend
// Automatically handles demo authentication and provides easy access

// Demo mode configuration
const DEMO_CONFIG = {
  enabled: true,
  autoLogin: true,
  defaultUser: 'demo-player',
  users: {
    'demo-admin': {
      name: 'Demo Admin',
      description: 'Full admin access with all features',
      credits: 1000000
    },
    'demo-player': {
      name: 'Demo Player', 
      description: 'Regular player with starter ship and credits',
      credits: 50000
    },
    'demo-trader': {
      name: 'Demo Trader',
      description: 'Trading-focused player with moderate credits',
      credits: 25000
    }
  }
};

// Check if we're in demo mode
function isDemoMode() {
  return DEMO_CONFIG.enabled || window.location.search.includes('demo=true');
}

// Auto-login with demo user if no authentication exists
async function autoLoginDemo() {
  if (!isDemoMode()) return false;
  
  // Check if already authenticated
  const existingToken = localStorage.getItem('token');
  if (existingToken && !existingToken.startsWith('demo_token_')) {
    return false; // Real authentication exists
  }
  
  try {
    // Auto-login with default demo user
    const response = await fetch(`/api/demo/login/${DEMO_CONFIG.defaultUser}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Store demo authentication
      localStorage.setItem('token', data.token);
      localStorage.setItem('sw3000_authenticated', 'true');
      localStorage.setItem('userInfo', JSON.stringify(data.user));
      localStorage.setItem('demoMode', 'true');
      
      console.log('Demo mode: Auto-logged in as', data.user.username);
      return true;
    }
  } catch (error) {
    console.warn('Demo auto-login failed:', error);
  }
  
  return false;
}

// Switch demo user
async function switchDemoUser(userType) {
  if (!isDemoMode()) return false;
  
  try {
    const response = await fetch(`/api/demo/login/${userType}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Update authentication
      localStorage.setItem('token', data.token);
      localStorage.setItem('userInfo', JSON.stringify(data.user));
      
      // Refresh page to apply new user context
      window.location.reload();
      return true;
    }
  } catch (error) {
    console.error('Failed to switch demo user:', error);
  }
  
  return false;
}

// Create demo user switcher UI
function createDemoSwitcher() {
  if (!isDemoMode()) return;
  
  // Check if switcher already exists
  if (document.getElementById('demo-switcher')) return;
  
  // Hide demo switcher on login page or if user chose non-demo login
  if (window.location.pathname.includes('login.html')) {
    const loginForm = document.querySelector('form');
    if (loginForm) {
      loginForm.addEventListener('submit', function() {
        hideDemoSwitcher();
      });
    }
  }
  
  const switcher = document.createElement('div');
  switcher.id = 'demo-switcher';
  switcher.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: rgba(26, 35, 126, 0.95);
    color: white;
    padding: 10px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    font-family: 'Orbitron', monospace;
    font-size: 12px;
    z-index: 10000;
    border: 1px solid #3f51b5;
    display: block;
  `;
  
  const currentUser = JSON.parse(localStorage.getItem('userInfo') || '{}');
  
  switcher.innerHTML = `
    <div style="margin-bottom: 8px; font-weight: bold; color: #ff9800;">
      🚀 DEMO MODE
    </div>
    <div style="margin-bottom: 8px; font-size: 11px;">
      Current: ${currentUser.username || 'Not logged in'}
    </div>
    <select id="demo-user-select" style="width: 100%; padding: 4px; margin-bottom: 8px; background: #1a237e; color: white; border: 1px solid #3f51b5; border-radius: 4px;">
      ${Object.entries(DEMO_CONFIG.users).map(([key, user]) => `
        <option value="${key}" ${currentUser.username === key.replace('demo-', '') ? 'selected' : ''}>
          ${user.name}
        </option>
      `).join('')}
    </select>
    <button id="switch-demo-user" style="width: 100%; padding: 4px 8px; background: #3f51b5; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">
      Switch User
    </button>
    <div style="margin-top: 8px; font-size: 10px; opacity: 0.8;">
      Demo users have full access to all features without registration.
    </div>
  `;
  
  // Add event listener for user switching
  switcher.querySelector('#switch-demo-user').addEventListener('click', () => {
    const selectedUser = switcher.querySelector('#demo-user-select').value;
    switchDemoUser(selectedUser);
  });
    document.body.appendChild(switcher);
}

// Hide demo switcher 
function hideDemoSwitcher() {
  const switcher = document.getElementById('demo-switcher');
  if (switcher) {
    switcher.style.display = 'none';
  }
}

// Show demo switcher
function showDemoSwitcher() {
  const switcher = document.getElementById('demo-switcher');
  if (switcher) {
    switcher.style.display = 'block';
  }
}

// Override authentication checks for demo mode
function overrideAuthChecks() {
  if (!isDemoMode()) return;
  
  // Override any auth redirect functions
  window.originalCheckAuth = window.checkAuth;
  window.checkAuth = function() {
    if (isDemoMode() && localStorage.getItem('demoMode') === 'true') {
      return true; // Always pass auth in demo mode
    }
    return window.originalCheckAuth ? window.originalCheckAuth() : true;
  };
  
  // Make API calls include demo headers
  const originalFetch = window.fetch;
  window.fetch = function(url, options = {}) {
    if (isDemoMode() && url.startsWith('/api/')) {
      options.headers = options.headers || {};
      
      // Add demo mode header
      options.headers['x-demo-mode'] = 'true';
      
      // Add demo user header if available
      const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
      if (userInfo.username && userInfo.username.startsWith('demo-')) {
        options.headers['x-demo-user'] = userInfo.username;
      }
    }
    
    return originalFetch(url, options);
  };
}

// Initialize demo mode
async function initializeDemoMode() {
  if (!isDemoMode()) return;
  
  console.log('🚀 Space Wars 3000 - Demo Mode Enabled');
  
  // Auto-login if configured
  if (DEMO_CONFIG.autoLogin) {
    await autoLoginDemo();
  }
  
  // Override authentication
  overrideAuthChecks();
  
  // Create UI switcher when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createDemoSwitcher);
  } else {
    createDemoSwitcher();
  }
  
  // Add demo mode indicators to the page
  setTimeout(() => {
    const title = document.title;
    if (!title.includes('DEMO')) {
      document.title = `${title} - DEMO MODE`;
    }
  }, 1000);
}

// Auto-initialize when script loads
initializeDemoMode();

// Export functions for manual use
window.DemoMode = {
  isDemoMode,
  autoLoginDemo,
  switchDemoUser,
  createDemoSwitcher,
  hideDemoSwitcher,
  showDemoSwitcher,
  config: DEMO_CONFIG
};
