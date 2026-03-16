/**
 * ==========================================================================
 * Space Wars 3000 - Progress Indicator Components
 * Tutorial and content progress tracking with visual progress animations
 * ==========================================================================
 */

/**
 * Base Progress Indicator component
 */
class ProgressIndicator extends DocumentationComponent {
    constructor(element, options = {}) {
        super(element, {
            min: 0,
            max: 100,
            value: 0,
            animated: true,
            showPercentage: true,
            showLabel: true,
            colorTheme: 'primary', // primary, success, warning, danger
            ...options
        });
        
        this.currentValue = this.options.value;
    }
    
    setupElement() {
        super.setupElement();
        this.element.classList.add('doc-progress-indicator');
        this.element.setAttribute('role', 'progressbar');
        this.updateAriaAttributes();
    }
    
    render() {
        this.element.innerHTML = this.getTemplate();
        this.progressBar = this.find('.doc-progress-bar');
        this.progressFill = this.find('.doc-progress-fill');
        this.progressText = this.find('.doc-progress-text');
        this.progressLabel = this.find('.doc-progress-label');
        
        this.updateProgress(this.currentValue, false);
    }
    
    getTemplate() {
        return `
            <div class="doc-progress-container">
                ${this.options.showLabel ? '<div class="doc-progress-label">Progress</div>' : ''}
                <div class="doc-progress-bar ${this.options.colorTheme}">
                    <div class="doc-progress-fill"></div>
                </div>
                ${this.options.showPercentage ? '<div class="doc-progress-text">0%</div>' : ''}
            </div>
        `;
    }
    
    updateProgress(value, animate = true) {
        value = Math.max(this.options.min, Math.min(this.options.max, value));
        const percentage = ((value - this.options.min) / (this.options.max - this.options.min)) * 100;
        
        this.currentValue = value;
        
        if (animate && this.options.animated) {
            this.animateProgress(percentage);
        } else {
            this.setProgress(percentage);
        }
        
        this.updateAriaAttributes();
        this.emit('progress', { value, percentage });
    }
    
    animateProgress(targetPercentage) {
        const currentPercentage = parseFloat(this.progressFill.style.width) || 0;
        const duration = 300;
        const startTime = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const currentProgress = currentPercentage + (targetPercentage - currentPercentage) * easeOutQuart;
            
            this.setProgress(currentProgress);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }
    
    setProgress(percentage) {
        if (this.progressFill) {
            this.progressFill.style.width = `${percentage}%`;
        }
        
        if (this.progressText && this.options.showPercentage) {
            this.progressText.textContent = `${Math.round(percentage)}%`;
        }
    }
    
    updateAriaAttributes() {
        this.element.setAttribute('aria-valuenow', this.currentValue);
        this.element.setAttribute('aria-valuemin', this.options.min);
        this.element.setAttribute('aria-valuemax', this.options.max);
    }
    
    setValue(value) {
        this.updateProgress(value);
    }
    
    getValue() {
        return this.currentValue;
    }
    
    setLabel(label) {
        if (this.progressLabel) {
            this.progressLabel.textContent = label;
        }
    }
}

/**
 * Step Progress Indicator for multi-step processes
 */
class StepProgressIndicator extends DocumentationComponent {
    constructor(element, options = {}) {
        super(element, {
            steps: [],
            currentStep: 0,
            allowClickNavigation: false,
            showLabels: true,
            orientation: 'horizontal', // horizontal, vertical
            ...options
        });
        
        this.steps = this.options.steps;
        this.currentStepIndex = this.options.currentStep;
    }
    
    setupElement() {
        super.setupElement();
        this.element.classList.add('doc-step-progress');
        this.element.classList.add(`doc-step-progress-${this.options.orientation}`);
    }
    
    render() {
        this.element.innerHTML = this.getTemplate();
        this.bindStepEvents();
    }
    
    getTemplate() {
        return `
            <div class="doc-steps-container">
                ${this.steps.map((step, index) => `
                    <div class="doc-step ${this.getStepClass(index)}" data-step="${index}">
                        <div class="doc-step-indicator">
                            <span class="doc-step-number">${index + 1}</span>
                            <span class="doc-step-check">✓</span>
                        </div>
                        ${this.options.showLabels ? `
                            <div class="doc-step-label">${step.label || step}</div>
                        ` : ''}
                        ${index < this.steps.length - 1 ? '<div class="doc-step-connector"></div>' : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    getStepClass(index) {
        if (index < this.currentStepIndex) return 'completed';
        if (index === this.currentStepIndex) return 'active';
        return 'pending';
    }
    
    bindStepEvents() {
        if (this.options.allowClickNavigation) {
            this.findAll('.doc-step').forEach((stepElement, index) => {
                stepElement.addEventListener('click', () => {
                    this.goToStep(index);
                });
            });
        }
    }
    
    goToStep(index) {
        if (index < 0 || index >= this.steps.length) return;
        
        const oldStep = this.currentStepIndex;
        this.currentStepIndex = index;
        
        this.updateStepClasses();
        this.emit('stepChanged', { 
            oldStep, 
            newStep: index, 
            step: this.steps[index] 
        });
    }
    
    nextStep() {
        if (this.currentStepIndex < this.steps.length - 1) {
            this.goToStep(this.currentStepIndex + 1);
        }
    }
    
    previousStep() {
        if (this.currentStepIndex > 0) {
            this.goToStep(this.currentStepIndex - 1);
        }
    }
    
    updateStepClasses() {
        this.findAll('.doc-step').forEach((stepElement, index) => {
            stepElement.className = `doc-step ${this.getStepClass(index)}`;
        });
    }
    
    markStepCompleted(index) {
        if (index >= 0 && index < this.steps.length) {
            this.steps[index].completed = true;
            this.updateStepClasses();
        }
    }
    
    addStep(step, index = null) {
        if (index !== null) {
            this.steps.splice(index, 0, step);
        } else {
            this.steps.push(step);
        }
        this.render();
    }
    
    removeStep(index) {
        if (index >= 0 && index < this.steps.length) {
            this.steps.splice(index, 1);
            if (this.currentStepIndex >= index) {
                this.currentStepIndex = Math.max(0, this.currentStepIndex - 1);
            }
            this.render();
        }
    }
}

/**
 * Circular Progress Indicator
 */
class CircularProgressIndicator extends DocumentationComponent {
    constructor(element, options = {}) {
        super(element, {
            size: 120,
            strokeWidth: 8,
            value: 0,
            max: 100,
            animated: true,
            showPercentage: true,
            colorTheme: 'primary',
            ...options
        });
        
        this.currentValue = this.options.value;
        this.radius = (this.options.size - this.options.strokeWidth) / 2;
        this.circumference = 2 * Math.PI * this.radius;
    }
    
    setupElement() {
        super.setupElement();
        this.element.classList.add('doc-circular-progress');
        this.element.style.width = `${this.options.size}px`;
        this.element.style.height = `${this.options.size}px`;
    }
    
    render() {
        this.element.innerHTML = this.getTemplate();
        this.progressCircle = this.find('.doc-progress-circle');
        this.progressText = this.find('.doc-progress-percentage');
        
        this.progressCircle.style.strokeDasharray = this.circumference;
        this.updateProgress(this.currentValue, false);
    }
    
    getTemplate() {
        const center = this.options.size / 2;
        
        return `
            <svg width="${this.options.size}" height="${this.options.size}" class="doc-circular-svg">
                <circle
                    cx="${center}"
                    cy="${center}"
                    r="${this.radius}"
                    stroke="rgba(255, 255, 255, 0.1)"
                    stroke-width="${this.options.strokeWidth}"
                    fill="none"
                    class="doc-progress-bg"
                />
                <circle
                    cx="${center}"
                    cy="${center}"
                    r="${this.radius}"
                    stroke="var(--doc-primary-color)"
                    stroke-width="${this.options.strokeWidth}"
                    fill="none"
                    stroke-linecap="round"
                    transform="rotate(-90 ${center} ${center})"
                    class="doc-progress-circle ${this.options.colorTheme}"
                />
            </svg>
            ${this.options.showPercentage ? `
                <div class="doc-progress-percentage">0%</div>
            ` : ''}
        `;
    }
    
    updateProgress(value, animate = true) {
        value = Math.max(0, Math.min(this.options.max, value));
        const percentage = (value / this.options.max) * 100;
        const strokeDashoffset = this.circumference - (percentage / 100) * this.circumference;
        
        this.currentValue = value;
        
        if (animate && this.options.animated) {
            this.animateCircularProgress(strokeDashoffset, percentage);
        } else {
            this.setCircularProgress(strokeDashoffset, percentage);
        }
        
        this.emit('progress', { value, percentage });
    }
    
    animateCircularProgress(targetOffset, targetPercentage) {
        const currentOffset = parseFloat(this.progressCircle.style.strokeDashoffset) || this.circumference;
        const currentPercentage = parseFloat(this.progressText?.textContent) || 0;
        
        const duration = 500;
        const startTime = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const easeOutCubic = 1 - Math.pow(1 - progress, 3);
            const currentProgressOffset = currentOffset + (targetOffset - currentOffset) * easeOutCubic;
            const currentProgressPercentage = currentPercentage + (targetPercentage - currentPercentage) * easeOutCubic;
            
            this.setCircularProgress(currentProgressOffset, currentProgressPercentage);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }
    
    setCircularProgress(strokeDashoffset, percentage) {
        this.progressCircle.style.strokeDashoffset = strokeDashoffset;
        
        if (this.progressText && this.options.showPercentage) {
            this.progressText.textContent = `${Math.round(percentage)}%`;
        }
    }
    
    setValue(value) {
        this.updateProgress(value);
    }
    
    getValue() {
        return this.currentValue;
    }
}

// Register components
if (typeof DocumentationComponentFactory !== 'undefined') {
    DocumentationComponentFactory.register('progress', ProgressIndicator);
    DocumentationComponentFactory.register('step-progress', StepProgressIndicator);
    DocumentationComponentFactory.register('circular-progress', CircularProgressIndicator);
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        ProgressIndicator, 
        StepProgressIndicator, 
        CircularProgressIndicator 
    };
} else if (typeof window !== 'undefined') {
    window.ProgressIndicator = ProgressIndicator;
    window.StepProgressIndicator = StepProgressIndicator;
    window.CircularProgressIndicator = CircularProgressIndicator;
}