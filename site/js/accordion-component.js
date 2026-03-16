/**
 * ==========================================================================
 * Space Wars 3000 - Accordion Component System
 * Reusable accordion components with smooth animations and accessibility
 * ==========================================================================
 */

/**
 * Accordion component for expandable content sections
 */
class AccordionComponent extends DocumentationComponent {
    constructor(element, options = {}) {
        super(element, {
            allowMultiple: false,
            animationDuration: 300,
            autoClose: true,
            expandIcon: '▼',
            collapseIcon: '▲',
            keyboardNavigation: true,
            ...options
        });
        
        this.accordionItems = [];
        this.activeItems = new Set();
    }
    
    /**
     * Setup accordion structure and find items
     */
    setupElement() {
        super.setupElement();
        
        this.element.classList.add('doc-accordion');
        this.element.setAttribute('role', 'tablist');
        
        // Find accordion items
        this.findAccordionItems();
        this.setupAccordionItems();
    }
    
    /**
     * Find and initialize accordion items
     */
    findAccordionItems() {
        const items = this.findAll('.doc-accordion-item');
        
        items.forEach((item, index) => {
            const header = item.querySelector('.doc-accordion-header');
            const content = item.querySelector('.doc-accordion-content');
            
            if (header && content) {
                this.accordionItems.push({
                    element: item,
                    header,
                    content,
                    index,
                    isExpanded: item.classList.contains('expanded')
                });
            }
        });
    }
    
    /**
     * Setup individual accordion items
     */
    setupAccordionItems() {
        this.accordionItems.forEach((item, index) => {
            this.setupAccordionItem(item, index);
        });
    }
    
    /**
     * Setup individual accordion item
     */
    setupAccordionItem(item, index) {
        const { element, header, content } = item;
        
        // Setup IDs and ARIA attributes
        const headerId = header.id || `${this.element.id}-header-${index}`;
        const contentId = content.id || `${this.element.id}-content-${index}`;
        
        header.id = headerId;
        content.id = contentId;
        
        // Setup header attributes
        header.setAttribute('role', 'tab');
        header.setAttribute('aria-controls', contentId);
        header.setAttribute('aria-expanded', item.isExpanded);
        header.setAttribute('tabindex', index === 0 ? '0' : '-1');
        header.classList.add('doc-accordion-header');
        
        // Setup content attributes
        content.setAttribute('role', 'tabpanel');
        content.setAttribute('aria-labelledby', headerId);
        content.classList.add('doc-accordion-content');
        
        // Add expand/collapse icon if not present
        if (!header.querySelector('.doc-accordion-icon')) {
            const icon = document.createElement('span');
            icon.className = 'doc-accordion-icon';
            icon.textContent = item.isExpanded ? this.options.collapseIcon : this.options.expandIcon;
            header.appendChild(icon);
        }
        
        // Set initial state
        if (item.isExpanded) {
            this.activeItems.add(index);
            element.classList.add('expanded');
        } else {
            content.style.maxHeight = '0';
            content.style.overflow = 'hidden';
        }
    }
    
    /**
     * Bind accordion events
     */
    bindEvents() {
        super.bindEvents();
        
        // Click events for headers
        this.accordionItems.forEach((item, index) => {
            item.header.addEventListener('click', (event) => {
                event.preventDefault();
                this.toggle(index);
            });
            
            // Keyboard navigation
            if (this.options.keyboardNavigation) {
                item.header.addEventListener('keydown', (event) => {
                    this.handleHeaderKeydown(event, index);
                });
            }
        });
    }
    
    /**
     * Handle keyboard navigation for headers
     */
    handleHeaderKeydown(event, index) {
        let newIndex = index;
        
        switch (event.key) {
            case 'Enter':
            case ' ':
                event.preventDefault();
                this.toggle(index);
                break;
                
            case 'ArrowDown':
                event.preventDefault();
                newIndex = (index + 1) % this.accordionItems.length;
                this.focusHeader(newIndex);
                break;
                
            case 'ArrowUp':
                event.preventDefault();
                newIndex = index > 0 ? index - 1 : this.accordionItems.length - 1;
                this.focusHeader(newIndex);
                break;
                
            case 'Home':
                event.preventDefault();
                this.focusHeader(0);
                break;
                
            case 'End':
                event.preventDefault();
                this.focusHeader(this.accordionItems.length - 1);
                break;
        }
    }
    
    /**
     * Focus specific header
     */
    focusHeader(index) {
        // Update tabindex
        this.accordionItems.forEach((item, i) => {
            item.header.setAttribute('tabindex', i === index ? '0' : '-1');
        });
        
        // Focus the header
        this.accordionItems[index].header.focus();
    }
    
    /**
     * Toggle accordion item
     */
    toggle(index) {
        const item = this.accordionItems[index];
        if (!item) return;
        
        const isExpanded = this.isExpanded(index);
        
        if (isExpanded) {
            this.collapse(index);
        } else {
            this.expand(index);
        }
    }
    
    /**
     * Expand accordion item
     */
    expand(index) {
        const item = this.accordionItems[index];
        if (!item || this.isExpanded(index)) return;
        
        // Close other items if not allowing multiple
        if (!this.options.allowMultiple && this.options.autoClose) {
            this.collapseAll();
        }
        
        const { element, header, content } = item;
        
        // Update state
        this.activeItems.add(index);
        item.isExpanded = true;
        
        // Update ARIA attributes
        header.setAttribute('aria-expanded', 'true');
        
        // Update icon
        const icon = header.querySelector('.doc-accordion-icon');
        if (icon) {
            icon.textContent = this.options.collapseIcon;
        }
        
        // Add expanded class
        element.classList.add('expanded');
        
        // Animate content
        this.animateExpand(content);
        
        // Emit event
        this.emit('expanded', { index, item: element });
        
        this.log(`Expanded item ${index}`);
    }
    
    /**
     * Collapse accordion item
     */
    collapse(index) {
        const item = this.accordionItems[index];
        if (!item || !this.isExpanded(index)) return;
        
        const { element, header, content } = item;
        
        // Update state
        this.activeItems.delete(index);
        item.isExpanded = false;
        
        // Update ARIA attributes
        header.setAttribute('aria-expanded', 'false');
        
        // Update icon
        const icon = header.querySelector('.doc-accordion-icon');
        if (icon) {
            icon.textContent = this.options.expandIcon;
        }
        
        // Animate content
        this.animateCollapse(content, () => {
            element.classList.remove('expanded');
        });
        
        // Emit event
        this.emit('collapsed', { index, item: element });
        
        this.log(`Collapsed item ${index}`);
    }
    
    /**
     * Expand all items
     */
    expandAll() {
        if (!this.options.allowMultiple) return;
        
        this.accordionItems.forEach((item, index) => {
            if (!this.isExpanded(index)) {
                this.expand(index);
            }
        });
    }
    
    /**
     * Collapse all items
     */
    collapseAll() {
        Array.from(this.activeItems).forEach(index => {
            this.collapse(index);
        });
    }
    
    /**
     * Check if item is expanded
     */
    isExpanded(index) {
        return this.activeItems.has(index);
    }
    
    /**
     * Animate content expansion
     */
    animateExpand(content) {
        // Get the natural height
        content.style.maxHeight = 'none';
        const height = content.scrollHeight;
        content.style.maxHeight = '0';
        
        // Force reflow
        content.offsetHeight;
        
        // Set transition and animate
        content.style.transition = `max-height ${this.options.animationDuration}ms ease`;
        content.style.maxHeight = `${height}px`;
        
        // Clean up after animation
        setTimeout(() => {
            content.style.maxHeight = 'none';
            content.style.transition = '';
        }, this.options.animationDuration);
    }
    
    /**
     * Animate content collapse
     */
    animateCollapse(content, onComplete) {
        const height = content.scrollHeight;
        
        // Set explicit height
        content.style.maxHeight = `${height}px`;
        content.style.transition = '';
        
        // Force reflow
        content.offsetHeight;
        
        // Set transition and animate
        content.style.transition = `max-height ${this.options.animationDuration}ms ease`;
        content.style.maxHeight = '0';
        
        // Call completion callback
        setTimeout(() => {
            content.style.overflow = 'hidden';
            if (onComplete) onComplete();
        }, this.options.animationDuration);
    }
    
    /**
     * Add new accordion item
     */
    addItem(headerText, contentHTML, index = null) {
        const item = document.createElement('div');
        item.className = 'doc-accordion-item';
        
        const header = document.createElement('div');
        header.className = 'doc-accordion-header';
        header.textContent = headerText;
        
        const content = document.createElement('div');
        content.className = 'doc-accordion-content';
        content.innerHTML = contentHTML;
        
        item.appendChild(header);
        item.appendChild(content);
        
        // Insert at specified index or append
        if (index !== null && index < this.accordionItems.length) {
            this.element.insertBefore(item, this.accordionItems[index].element);
        } else {
            this.element.appendChild(item);
        }
        
        // Reinitialize
        this.accordionItems = [];
        this.activeItems.clear();
        this.findAccordionItems();
        this.setupAccordionItems();
        
        return item;
    }
    
    /**
     * Remove accordion item
     */
    removeItem(index) {
        const item = this.accordionItems[index];
        if (!item) return;
        
        item.element.remove();
        
        // Reinitialize
        this.accordionItems = [];
        this.activeItems.clear();
        this.findAccordionItems();
        this.setupAccordionItems();
    }
    
    /**
     * Get accordion state
     */
    getState() {
        return {
            expandedItems: Array.from(this.activeItems),
            totalItems: this.accordionItems.length
        };
    }
    
    /**
     * Set accordion state
     */
    restoreState(state) {
        this.collapseAll();
        
        if (state.expandedItems) {
            state.expandedItems.forEach(index => {
                this.expand(index);
            });
        }
    }
}

// Register the component
if (typeof DocumentationComponentFactory !== 'undefined') {
    DocumentationComponentFactory.register('accordion', AccordionComponent);
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AccordionComponent;
} else if (typeof window !== 'undefined') {
    window.AccordionComponent = AccordionComponent;
}