/*
 * Space Wars 3000 - UI Components Library
 * Refactored to use modular architecture for better maintainability
 * 
 * This file now delegates to specialized modules:
 * - NavigationManager.js - Navigation component and mobile navigation
 * - NotificationSystem.js - Notification creation and management
 * - LoadingManager.js - Loading states and page transitions
 * - AccessibilityManager.js - Accessibility features and ARIA support
 * - APIHelpers.js - API request handling with error management
 * - index.js - Main coordinator that combines all modules
 */

// Function to dynamically load UI modules
async function loadUIModules() {
    const modules = [
        '/js/sw3-ui-components/NavigationManager.js',
        '/js/sw3-ui-components/NotificationSystem.js',
        '/js/sw3-ui-components/LoadingManager.js',
        '/js/sw3-ui-components/AccessibilityManager.js',
        '/js/sw3-ui-components/APIHelpers.js',
        '/js/sw3-ui-components/index.js'
    ];

    try {
        for (const modulePath of modules) {
            await loadScript(modulePath);
        }
        console.log('✅ All UI modules loaded successfully');
        return true;
    } catch (error) {
        console.warn('⚠️ Failed to load modular UI, using fallback:', error);
        return false;
    }
}

// Helper function to load scripts dynamically
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// SW3UI class for backwards compatibility
class SW3UI {
    constructor() {
        this.system = null;
        this.notifications = [];
        this.notificationId = 0;
        this.initializeSystem();
    }

    async initializeSystem() {
        try {
            // Try to use modular system
            const modulesLoaded = await loadUIModules();
            
            if (modulesLoaded && typeof SW3UISystem !== 'undefined') {
                this.system = new SW3UISystem();
                this.system.init();
                console.log('✅ Using modular UI system');
            } else {
                throw new Error('Modular system unavailable');
            }
        } catch (error) {
            console.warn('⚠️ Falling back to integrated UI system');
            this.initializeFallbackSystem();
        }
    }

    initializeFallbackSystem() {
        // Simplified fallback system
        this.init();
    }

    init() {
        if (this.system) {
            return this.system.init();
        }

        // Fallback initialization
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        if (this.system) {
            return this.system.setup();
        }

        // Basic fallback setup
        this.createBasicNotificationContainer();
        this.initializeBasicNavigation();
    }

    createBasicNotificationContainer() {
        const existingContainer = document.getElementById('sw3-notifications');
        if (existingContainer) return;

        const container = document.createElement('div');
        container.id = 'sw3-notifications';
        container.className = 'sw3-notifications';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1050;
            pointer-events: none;
            max-width: 350px;
        `;
        document.body.appendChild(container);
    }

    initializeBasicNavigation() {
        // Basic mobile navigation toggle
        const toggle = document.getElementById('nav-toggle');
        const menu = document.getElementById('nav-menu');
        
        if (toggle && menu) {
            toggle.addEventListener('click', () => {
                menu.classList.toggle('sw3-navbar__nav--open');
                toggle.classList.toggle('sw3-navbar__toggle--open');
            });
        }
    }

    // Core methods that delegate to system or provide fallback
    showNotification(message, type = 'info', title = null, duration = 5000) {
        if (this.system) {
            return this.system.showNotification(message, type, title, duration);
        } else {
            // Simple fallback notification
            console.log(`[${type.toUpperCase()}] ${title || 'Notification'}: ${message}`);
            return ++this.notificationId;
        }
    }

    closeNotification(id) {
        if (this.system) {
            return this.system.closeNotification(id);
        }
        // Fallback does nothing
    }

    showLoading(container, text = 'Loading...') {
        if (this.system) {
            return this.system.showLoading(container, text);
        }
        // Basic fallback
        if (typeof container === 'string') {
            container = document.querySelector(container);
        }
        if (container) {
            container.innerHTML = `<div style="text-align: center; padding: 20px;">${text}</div>`;
        }
    }

    hideLoading(container) {
        if (this.system) {
            return this.system.hideLoading(container);
        }
        // Fallback clears content
        if (typeof container === 'string') {
            container = document.querySelector(container);
        }
        if (container) {
            container.innerHTML = '';
        }
    }

    async fetchWithErrorHandling(url, options = {}) {
        if (this.system) {
            return this.system.fetchWithErrorHandling(url, options);
        }
        // Basic fallback
        return fetch(url, options).then(r => r.json());
    }

    showSettings() {
        this.showNotification('Settings panel coming soon!', 'info');
    }

    getCurrentPage() {
        if (this.system) {
            return this.system.getCurrentPage();
        }
        // Fallback
        const path = window.location.pathname;
        return path.split('/').pop().replace('.html', '') || 'index';
    }

    announceToScreenReader(message) {
        if (this.system) {
            return this.system.announceToScreenReader(message);
        }
        // Fallback to console
        console.log(`[Screen Reader] ${message}`);
    }
}

// Initialize SW3 UI system
const SW3 = new SW3UI();

// Make SW3 available globally
window.SW3 = SW3;

// Legacy support - maintain backward compatibility
window.showNotification = (message, type) => SW3.showNotification(message, type);

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SW3UI;
}