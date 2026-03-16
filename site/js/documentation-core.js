/**
 * ==========================================================================
 * Space Wars 3000 - Documentation Core Component System
 * Base class for all documentation components with event handling and state management
 * ==========================================================================
 */

/**
 * Base DocumentationComponent class that provides foundation for all documentation components
 */
class DocumentationComponent {
    constructor(element, options = {}) {
        this.element = element;
        this.options = {
            debug: false,
            autoInit: true,
            cssPrefix: 'doc-',
            ...options
        };
        
        this.state = new Map();
        this.eventHandlers = new Map();
        this.childComponents = new Set();
        this.isInitialized = false;
        this.isDestroyed = false;
        
        if (this.options.autoInit) {
            this.init();
        }
    }
    
    /**
     * Initialize the component
     */
    init() {
        if (this.isInitialized || this.isDestroyed) return;
        
        try {
            this.setupElement();
            this.bindEvents();
            this.render();
            this.isInitialized = true;
            
            this.emit('initialized', { component: this });
            this.log('Component initialized');
        } catch (error) {
            this.handleError('Initialization failed', error);
        }
    }
    
    /**
     * Setup element with required classes and attributes
     */
    setupElement() {
        if (!this.element) {
            throw new Error('Element is required');
        }
        
        // Add base component class
        this.element.classList.add(`${this.options.cssPrefix}component`);
        
        // Set up ARIA attributes for accessibility
        if (!this.element.getAttribute('role')) {
            this.element.setAttribute('role', 'region');
        }
        
        // Generate unique ID if not present
        if (!this.element.id) {
            this.element.id = this.generateId();
        }
    }
    
    /**
     * Event handling system
     */
    bindEvents() {
        // Override in subclasses to bind specific events
        this.on('click', this.handleClick.bind(this));
        this.on('keydown', this.handleKeydown.bind(this));
    }
    
    /**
     * Add event listener
     */
    on(eventType, handler, options = {}) {
        if (!this.eventHandlers.has(eventType)) {
            this.eventHandlers.set(eventType, []);
        }
        
        const wrappedHandler = (event) => {
            if (this.isDestroyed) return;
            
            try {
                handler.call(this, event);
            } catch (error) {
                this.handleError(`Event handler failed for ${eventType}`, error);
            }
        };
        
        this.eventHandlers.get(eventType).push({ handler, wrappedHandler, options });
        this.element.addEventListener(eventType, wrappedHandler, options);
        
        return this;
    }
    
    /**
     * Remove event listener
     */
    off(eventType, handler) {
        if (!this.eventHandlers.has(eventType)) return this;
        
        const handlers = this.eventHandlers.get(eventType);
        const index = handlers.findIndex(h => h.handler === handler);
        
        if (index > -1) {
            this.element.removeEventListener(eventType, handlers[index].wrappedHandler);
            handlers.splice(index, 1);
        }
        
        return this;
    }
    
    /**
     * Emit custom event
     */
    emit(eventType, detail = {}) {
        const event = new CustomEvent(eventType, {
            detail,
            bubbles: true,
            cancelable: true
        });
        
        this.element.dispatchEvent(event);
        return this;
    }
    
    /**
     * State management foundation
     */
    setState(key, value) {
        const oldValue = this.state.get(key);
        this.state.set(key, value);
        
        this.emit('stateChange', {
            key,
            oldValue,
            newValue: value
        });
        
        this.onStateChange(key, value, oldValue);
        return this;
    }
    
    getState(key, defaultValue = null) {
        return this.state.has(key) ? this.state.get(key) : defaultValue;
    }
    
    /**
     * Override in subclasses to handle state changes
     */
    onStateChange(key, newValue, oldValue) {
        // Override in subclasses
    }
    
    /**
     * Common utility methods
     */
    generateId() {
        return `${this.options.cssPrefix}${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    addClass(className) {
        this.element.classList.add(className);
        return this;
    }
    
    removeClass(className) {
        this.element.classList.remove(className);
        return this;
    }
    
    toggleClass(className, force) {
        this.element.classList.toggle(className, force);
        return this;
    }
    
    hasClass(className) {
        return this.element.classList.contains(className);
    }
    
    /**
     * Find elements within component
     */
    find(selector) {
        return this.element.querySelector(selector);
    }
    
    findAll(selector) {
        return Array.from(this.element.querySelectorAll(selector));
    }
    
    /**
     * Render method - override in subclasses
     */
    render() {
        // Override in subclasses to implement specific rendering
    }
    
    /**
     * Default event handlers
     */
    handleClick(event) {
        // Override in subclasses
    }
    
    handleKeydown(event) {
        // Handle common keyboard accessibility
        if (event.key === 'Escape') {
            this.handleEscape(event);
        }
    }
    
    handleEscape(event) {
        // Override in subclasses
    }
    
    /**
     * Child component management
     */
    addChild(component) {
        this.childComponents.add(component);
        return this;
    }
    
    removeChild(component) {
        this.childComponents.delete(component);
        return this;
    }
    
    /**
     * Error handling
     */
    handleError(message, error) {
        this.log(`Error: ${message}`, error, 'error');
        this.emit('error', { message, error });
    }
    
    /**
     * Logging utility
     */
    log(message, data = null, level = 'info') {
        if (!this.options.debug) return;
        
        const logMethod = console[level] || console.log;
        const componentName = this.constructor.name;
        
        if (data) {
            logMethod(`[${componentName}] ${message}`, data);
        } else {
            logMethod(`[${componentName}] ${message}`);
        }
    }
    
    /**
     * Cleanup and destruction
     */
    destroy() {
        if (this.isDestroyed) return;
        
        try {
            // Destroy child components
            this.childComponents.forEach(child => {
                if (child && typeof child.destroy === 'function') {
                    child.destroy();
                }
            });
            
            // Remove all event listeners
            this.eventHandlers.forEach((handlers, eventType) => {
                handlers.forEach(({ wrappedHandler }) => {
                    this.element.removeEventListener(eventType, wrappedHandler);
                });
            });
            
            // Clear references
            this.eventHandlers.clear();
            this.childComponents.clear();
            this.state.clear();
            
            // Emit destruction event
            this.emit('destroyed');
            
            this.isDestroyed = true;
            this.log('Component destroyed');
        } catch (error) {
            this.handleError('Destruction failed', error);
        }
    }
}

/**
 * Component factory for creating documentation components
 */
class DocumentationComponentFactory {
    static components = new Map();
    
    static register(name, componentClass) {
        this.components.set(name, componentClass);
    }
    
    static create(name, element, options = {}) {
        const ComponentClass = this.components.get(name);
        if (!ComponentClass) {
            throw new Error(`Component '${name}' is not registered`);
        }
        
        return new ComponentClass(element, options);
    }
    
    static createFromElement(element) {
        const componentType = element.dataset.component;
        if (!componentType) {
            throw new Error('Element must have data-component attribute');
        }
        
        const options = element.dataset.options ? JSON.parse(element.dataset.options) : {};
        return this.create(componentType, element, options);
    }
    
    static autoInit(container = document) {
        const elements = container.querySelectorAll('[data-component]');
        const components = [];
        
        elements.forEach(element => {
            try {
                const component = this.createFromElement(element);
                components.push(component);
            } catch (error) {
                console.error('Failed to auto-initialize component:', error);
            }
        });
        
        return components;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DocumentationComponent, DocumentationComponentFactory };
} else if (typeof window !== 'undefined') {
    window.DocumentationComponent = DocumentationComponent;
    window.DocumentationComponentFactory = DocumentationComponentFactory;
}