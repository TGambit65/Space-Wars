// Space Wars 3000 - Standardized UI Components
// Refactored with clean delegation pattern

class SW3UIComponents {
    constructor() {
        // Component modules - will be loaded dynamically
        this.modules = {
            navigationBuilder: null,
            notificationManager: null,
            modalBuilder: null,
            tableBuilder: null,
            formBuilder: null,
            loaderBuilder: null
        };
        
        this.isModular = false;
        this.fallbackComponents = null;
        
        this.initializeModules();
    }

    /**
     * Initialize modular components with clean delegation
     */
    initializeModules() {
        try {
            // Try to load modular components
            if (typeof window !== 'undefined') {
                this.loadModularSystem(window);
            } else if (typeof require !== 'undefined') {
                this.loadModularSystem({
                    NavigationBuilder: require('./ui-components/NavigationBuilder'),
                    NotificationManager: require('./ui-components/NotificationManager'),
                    ModalBuilder: require('./ui-components/ModalBuilder'),
                    TableBuilder: require('./ui-components/TableBuilder'),
                    FormBuilder: require('./ui-components/FormBuilder'),
                    LoaderBuilder: require('./ui-components/LoaderBuilder')
                });
            }
        } catch (error) {
            console.warn('Failed to load modular components, using fallback:', error);
            this.loadFallbackComponents();
        }
    }

    /**
     * Load modular system with provided modules
     */
    loadModularSystem(moduleLoader) {
        const { 
            NavigationBuilder,
            NotificationManager,
            ModalBuilder,
            TableBuilder,
            FormBuilder,
            LoaderBuilder
        } = moduleLoader;
        
        if (NavigationBuilder) {
            this.modules.navigationBuilder = new NavigationBuilder();
            this.isModular = true;
        }
        if (NotificationManager) {
            this.modules.notificationManager = new NotificationManager();
            this.isModular = true;
        }
        if (ModalBuilder) {
            this.modules.modalBuilder = new ModalBuilder();
            this.isModular = true;
        }
        if (TableBuilder) {
            this.modules.tableBuilder = new TableBuilder();
            this.isModular = true;
        }
        if (FormBuilder) {
            this.modules.formBuilder = new FormBuilder();
            this.isModular = true;
        }
        if (LoaderBuilder) {
            this.modules.loaderBuilder = new LoaderBuilder();
            this.isModular = true;
        }
        
        if (!this.isModular) {
            this.loadFallbackComponents();
        }
    }

    /**
     * Load fallback components
     */
    loadFallbackComponents() {
        try {
            if (typeof window !== 'undefined' && window.SW3UIComponentsFallback) {
                this.fallbackComponents = new window.SW3UIComponentsFallback();
            } else if (typeof require !== 'undefined') {
                const FallbackComponents = require('./ui-components/fallback');
                this.fallbackComponents = new FallbackComponents();
            }
        } catch (error) {
            console.error('Failed to load fallback components:', error);
        }
    }

    /**
     * Create standardized navigation bar
     */
    static createNavigation(currentPage = '') {
        const instance = window.sw3UIComponentsInstance;
        
        if (instance?.modules.navigationBuilder) {
            return instance.modules.navigationBuilder.createNavigation(currentPage);
        } else if (instance?.fallbackComponents) {
            return instance.fallbackComponents.createNavigation(currentPage);
        }
        
        // Last resort fallback
        const nav = document.createElement('nav');
        nav.className = 'navbar navbar-expand-lg navbar-dark sw3-navbar';
        nav.innerHTML = '<div class="container">Navigation not available</div>';
        return nav;
    }

    /**
     * Create standardized notification
     */
    static createNotification(message, type = 'info', duration = 5000) {
        const instance = window.sw3UIComponentsInstance;
        
        if (instance?.modules.notificationManager) {
            return instance.modules.notificationManager.createNotification(message, type, duration);
        } else if (instance?.fallbackComponents) {
            return instance.fallbackComponents.createNotification(message, type, duration);
        }
        
        // Last resort fallback
        const notification = document.createElement('div');
        notification.className = `sw3-notification sw3-notification-${type}`;
        notification.textContent = message;
        return notification;
    }

    /**
     * Show notification in container
     */
    static showNotification(message, type = 'info', duration = 5000, containerId = 'notification-container') {
        const instance = window.sw3UIComponentsInstance;
        
        if (instance?.modules.notificationManager) {
            return instance.modules.notificationManager.showNotification(message, type, duration, containerId);
        } else if (instance?.fallbackComponents) {
            return instance.fallbackComponents.showNotification(message, type, duration, containerId);
        }
        
        // Last resort fallback
        const notification = this.createNotification(message, type, duration);
        const container = document.getElementById(containerId) || document.body;
        container.appendChild(notification);
        return notification;
    }

    /**
     * Create notification container if it doesn't exist
     */
    static createNotificationContainer() {
        const instance = window.sw3UIComponentsInstance;
        
        if (instance?.modules.notificationManager) {
            return instance.modules.notificationManager.getOrCreateContainer();
        } else if (instance?.fallbackComponents) {
            return instance.fallbackComponents.createNotificationContainer();
        }
        
        // Last resort fallback
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.style.cssText = 'position: fixed; top: 80px; right: 20px; z-index: 1050;';
            document.body.appendChild(container);
        }
        return container;
    }

    /**
     * Create standardized modal
     */
    static createModal(title, content, options = {}) {
        const instance = window.sw3UIComponentsInstance;
        
        if (instance?.modules.modalBuilder) {
            return instance.modules.modalBuilder.createModal(title, content, options);
        } else if (instance?.fallbackComponents) {
            return instance.fallbackComponents.createModal(title, content, options);
        }
        
        // Last resort fallback
        const overlay = document.createElement('div');
        overlay.className = 'sw3-modal-overlay';
        overlay.innerHTML = `
            <div class="sw3-modal">
                <div class="sw3-modal-header">
                    <h5>${title}</h5>
                    <button onclick="this.closest('.sw3-modal-overlay').remove()">×</button>
                </div>
                <div class="sw3-modal-body">${content}</div>
            </div>
        `;
        document.body.appendChild(overlay);
        return overlay;
    }

    /**
     * Close modal
     */
    static closeModal(overlay, onClose = null) {
        const instance = window.sw3UIComponentsInstance;
        
        if (instance?.modules.modalBuilder && typeof overlay === 'string') {
            return instance.modules.modalBuilder.closeModal(overlay);
        } else if (instance?.fallbackComponents) {
            return instance.fallbackComponents.closeModal(overlay, onClose);
        }
        
        // Last resort fallback
        if (onClose && typeof onClose === 'function') {
            onClose();
        }
        if (overlay && overlay.remove) {
            overlay.remove();
        }
    }

    /**
     * Create standardized loading spinner
     */
    static createLoader(text = 'Loading...') {
        const instance = window.sw3UIComponentsInstance;
        
        if (instance?.modules.loaderBuilder) {
            return instance.modules.loaderBuilder.createLoader(text);
        } else if (instance?.fallbackComponents) {
            return instance.fallbackComponents.createLoader(text);
        }
        
        // Last resort fallback
        const loader = document.createElement('div');
        loader.className = 'sw3-flex-center';
        loader.innerHTML = `<div class="sw3-loading"></div><span>${text}</span>`;
        return loader;
    }

    /**
     * Create standardized table
     */
    static createTable(headers, rows, options = {}) {
        const instance = window.sw3UIComponentsInstance;
        
        if (instance?.modules.tableBuilder) {
            return instance.modules.tableBuilder.createTable(headers, rows, options);
        } else if (instance?.fallbackComponents) {
            return instance.fallbackComponents.createTable(headers, rows, options);
        }
        
        // Last resort fallback
        const table = document.createElement('table');
        table.className = 'sw3-table';
        table.innerHTML = `
            <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
        `;
        return table;
    }

    /**
     * Sort table by column
     */
    static sortTable(table, column) {
        const instance = window.sw3UIComponentsInstance;
        
        if (instance?.modules.tableBuilder) {
            const tableId = typeof table === 'string' ? table : table.id;
            return instance.modules.tableBuilder.sortTable(tableId, column);
        } else if (instance?.fallbackComponents) {
            return instance.fallbackComponents.sortTable(table, column);
        }
    }

    /**
     * Create standardized form field
     */
    static createFormField(type, label, id, options = {}) {
        const instance = window.sw3UIComponentsInstance;
        
        if (instance?.modules.formBuilder) {
            return instance.modules.formBuilder.createFormField(type, label, id, options);
        } else if (instance?.fallbackComponents) {
            return instance.fallbackComponents.createFormField(type, label, id, options);
        }
        
        // Last resort fallback
        const fieldGroup = document.createElement('div');
        fieldGroup.className = 'sw3-form-group';
        fieldGroup.innerHTML = `
            <label for="${id}">${label}</label>
            <input type="${type}" id="${id}" name="${id}" class="sw3-input">
        `;
        return fieldGroup;
    }

    /**
     * Initialize standard UI components on page load
     */
    static initializeStandardUI(currentPage = '') {
        // Replace existing navigation if it exists
        const existingNav = document.querySelector('nav');
        if (existingNav) {
            const newNav = this.createNavigation(currentPage);
            existingNav.parentNode.replaceChild(newNav, existingNav);
        }

        // Create notification container
        this.createNotificationContainer();

        // Initialize auth status updates
        this.updateAuthStatus();

        // Initialize responsive handlers
        this.initializeResponsiveHandlers();
    }

    /**
     * Update authentication status in navigation
     */
    static updateAuthStatus() {
        const token = localStorage.getItem('token');
        const loginLink = document.getElementById('loginLink');
        const logoutLink = document.getElementById('logoutLink');
        const creditsDisplay = document.getElementById('credits-amount');

        if (token) {
            if (loginLink) loginLink.style.display = 'none';
            if (logoutLink) logoutLink.style.display = 'block';
            
            // Update credits display
            this.updateCreditsDisplay();
        } else {
            if (loginLink) loginLink.style.display = 'block';
            if (logoutLink) logoutLink.style.display = 'none';
            if (creditsDisplay) creditsDisplay.textContent = '--';
        }
    }

    /**
     * Update credits display in navigation
     */
    static async updateCreditsDisplay() {
        const token = localStorage.getItem('token');
        const creditsDisplay = document.getElementById('credits-amount');
        
        if (!token || !creditsDisplay) return;

        try {
            const response = await fetch('/api/auth/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                const credits = data.user?.credits || 0;
                creditsDisplay.textContent = credits.toLocaleString();
            }
        } catch (error) {
            console.error('Error updating credits display:', error);
        }
    }

    /**
     * Initialize responsive handlers
     */
    static initializeResponsiveHandlers() {
        // Mobile navigation toggle
        const navToggle = document.querySelector('.navbar-toggler');
        const navCollapse = document.querySelector('.navbar-collapse');

        if (navToggle && navCollapse) {
            navToggle.addEventListener('click', () => {
                navCollapse.classList.toggle('show');
            });

            // Close mobile nav when clicking links
            navCollapse.querySelectorAll('.nav-link').forEach(link => {
                link.addEventListener('click', () => {
                    navCollapse.classList.remove('show');
                });
            });
        }

        // Handle window resize
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.handleResize();
            }, 250);
        });
    }

    /**
     * Handle window resize events
     */
    static handleResize() {
        // Add responsive behavior
        const modals = document.querySelectorAll('.sw3-modal');
        modals.forEach(modal => {
            if (window.innerWidth < 768) {
                modal.style.margin = '1rem';
                modal.style.maxWidth = 'calc(100vw - 2rem)';
            } else {
                modal.style.margin = '';
                modal.style.maxWidth = '';
            }
        });
    }

    /**
     * Create standardized page layout
     */
    static createPageLayout(title, content, options = {}) {
        const {
            sidebar = null,
            breadcrumbs = null,
            actions = null
        } = options;

        const main = document.createElement('main');
        main.className = 'container mt-4';

        let layoutHtml = '';

        if (breadcrumbs) {
            layoutHtml += `
                <nav aria-label="breadcrumb" class="mb-4">
                    <ol class="breadcrumb">
                        ${breadcrumbs.map(crumb => `
                            <li class="breadcrumb-item ${crumb.active ? 'active' : ''}">
                                ${crumb.active ? crumb.text : `<a href="${crumb.href}">${crumb.text}</a>`}
                            </li>
                        `).join('')}
                    </ol>
                </nav>
            `;
        }

        layoutHtml += `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h1 class="sw3-text-primary mb-0">${title}</h1>
                ${actions ? `<div class="page-actions">${actions}</div>` : ''}
            </div>
        `;

        if (sidebar) {
            layoutHtml += `
                <div class="row">
                    <div class="col-lg-3 mb-4">
                        <div class="sw3-card">${sidebar}</div>
                    </div>
                    <div class="col-lg-9">
                        ${content}
                    </div>
                </div>
            `;
        } else {
            layoutHtml += content;
        }

        main.innerHTML = layoutHtml;
        return main;
    }
}

// Global logout function
function logout() {
    localStorage.removeItem('token');
    window.location.href = 'login.html';
}

// Initialize UI when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Create global instance
    window.sw3UIComponentsInstance = new SW3UIComponents();
    
    // Get current page for navigation highlighting
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    SW3UIComponents.initializeStandardUI(currentPage);
});

// Export for use in other modules
window.SW3UIComponents = SW3UIComponents;