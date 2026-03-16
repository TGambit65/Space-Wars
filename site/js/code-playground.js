/**
 * ==========================================================================
 * Space Wars 3000 - Code Playground Widget
 * Interactive code demonstration areas with syntax highlighting and execution simulation
 * ==========================================================================
 */

/**
 * Code Playground component for interactive code examples
 */
class CodePlayground extends DocumentationComponent {
    constructor(element, options = {}) {
        super(element, {
            language: 'javascript',
            theme: 'space-dark',
            editable: true,
            runnable: false,
            copyable: true,
            showLineNumbers: true,
            autoComplete: false,
            fontSize: '14px',
            tabSize: 2,
            ...options
        });
        
        this.code = '';
        this.output = '';
        this.isRunning = false;
    }
    
    setupElement() {
        super.setupElement();
        this.element.classList.add('doc-code-playground');
        this.element.classList.add(`language-${this.options.language}`);
        
        // Extract initial code if present
        const codeElement = this.find('code');
        if (codeElement) {
            this.code = codeElement.textContent.trim();
        }
    }
    
    render() {
        this.element.innerHTML = this.getTemplate();
        this.setupCodeEditor();
        this.setupControls();
        this.applySyntaxHighlighting();
    }
    
    getTemplate() {
        return `
            <div class="doc-playground-container">
                <div class="doc-playground-header">
                    <div class="doc-playground-title">
                        <span class="doc-playground-language">${this.options.language.toUpperCase()}</span>
                    </div>
                    <div class="doc-playground-controls">
                        ${this.options.copyable ? '<button class="doc-btn-copy" title="Copy to clipboard">📋</button>' : ''}
                        ${this.options.runnable ? '<button class="doc-btn-run" title="Run code">▶️</button>' : ''}
                        <button class="doc-btn-reset" title="Reset to original">🔄</button>
                    </div>
                </div>
                <div class="doc-playground-content">
                    <div class="doc-code-container">
                        ${this.options.showLineNumbers ? '<div class="doc-line-numbers"></div>' : ''}
                        <div class="doc-code-editor" contenteditable="${this.options.editable}" spellcheck="false">${this.escapeHtml(this.code)}</div>
                    </div>
                    ${this.options.runnable ? `
                        <div class="doc-output-container">
                            <div class="doc-output-header">Output:</div>
                            <div class="doc-output-content"></div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    setupCodeEditor() {
        this.codeEditor = this.find('.doc-code-editor');
        this.lineNumbers = this.find('.doc-line-numbers');
        this.outputContainer = this.find('.doc-output-container');
        this.outputContent = this.find('.doc-output-content');
        
        if (this.codeEditor) {
            this.codeEditor.style.fontSize = this.options.fontSize;
            this.codeEditor.style.tabSize = this.options.tabSize;
            
            // Update line numbers initially
            this.updateLineNumbers();
            
            // Bind editor events
            this.bindEditorEvents();
        }
    }
    
    bindEditorEvents() {
        if (!this.codeEditor) return;
        
        // Update on input
        this.codeEditor.addEventListener('input', () => {
            this.code = this.codeEditor.textContent;
            this.updateLineNumbers();
            this.applySyntaxHighlighting();
            this.emit('codeChanged', { code: this.code });
        });
        
        // Handle tab key for indentation
        this.codeEditor.addEventListener('keydown', (event) => {
            if (event.key === 'Tab') {
                event.preventDefault();
                this.insertTab();
            }
        });
        
        // Prevent paste formatting
        this.codeEditor.addEventListener('paste', (event) => {
            event.preventDefault();
            const text = event.clipboardData.getData('text/plain');
            this.insertText(text);
        });
    }
    
    setupControls() {
        const copyBtn = this.find('.doc-btn-copy');
        const runBtn = this.find('.doc-btn-run');
        const resetBtn = this.find('.doc-btn-reset');
        
        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.copyToClipboard());
        }
        
        if (runBtn) {
            runBtn.addEventListener('click', () => this.runCode());
        }
        
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetCode());
        }
    }
    
    updateLineNumbers() {
        if (!this.lineNumbers || !this.codeEditor) return;
        
        const lines = this.code.split('\n');
        const lineNumbersHtml = lines.map((_, index) => 
            `<span class="doc-line-number">${index + 1}</span>`
        ).join('');
        
        this.lineNumbers.innerHTML = lineNumbersHtml;
    }
    
    applySyntaxHighlighting() {
        if (!this.codeEditor) return;
        
        // Simple syntax highlighting for common languages
        let highlightedCode = this.escapeHtml(this.code);
        
        switch (this.options.language) {
            case 'javascript':
                highlightedCode = this.highlightJavaScript(highlightedCode);
                break;
            case 'css':
                highlightedCode = this.highlightCSS(highlightedCode);
                break;
            case 'html':
                highlightedCode = this.highlightHTML(highlightedCode);
                break;
            case 'json':
                highlightedCode = this.highlightJSON(highlightedCode);
                break;
        }
        
        // Only update if content changed to avoid cursor issues
        if (this.codeEditor.innerHTML !== highlightedCode) {
            const selection = this.saveSelection();
            this.codeEditor.innerHTML = highlightedCode;
            this.restoreSelection(selection);
        }
    }
    
    highlightJavaScript(code) {
        const keywords = /\b(const|let|var|function|return|if|else|for|while|class|extends|import|export|async|await|try|catch|throw|new|typeof|instanceof)\b/g;
        const strings = /(["'`])((?:\\.|(?!\1)[^\\])*?)\1/g;
        const comments = /(\/\/.*?$|\/\*[\s\S]*?\*\/)/gm;
        const numbers = /\b\d+(\.\d+)?\b/g;
        
        return code
            .replace(comments, '<span class="comment">$1</span>')
            .replace(strings, '<span class="string">$1$2$1</span>')
            .replace(keywords, '<span class="keyword">$1</span>')
            .replace(numbers, '<span class="number">$1</span>');
    }
    
    highlightCSS(code) {
        const selectors = /([.#]?[a-zA-Z][\w-]*(?:\([^)]*\))?(?:::?[a-zA-Z][\w-]*)?)\s*{/g;
        const properties = /([a-zA-Z-]+)\s*:/g;
        const values = /:(.+?);/g;
        const comments = /(\/\*[\s\S]*?\*\/)/g;
        
        return code
            .replace(comments, '<span class="comment">$1</span>')
            .replace(selectors, '<span class="selector">$1</span>{')
            .replace(properties, '<span class="property">$1</span>:')
            .replace(values, ':<span class="value">$1</span>;');
    }
    
    highlightHTML(code) {
        const tags = /(&lt;\/?[a-zA-Z][\w-]*(?:\s[^&]*?)?&gt;)/g;
        const attributes = /(\w+)=["']([^"']*)["']/g;
        const comments = /(&lt;!--[\s\S]*?--&gt;)/g;
        
        return code
            .replace(comments, '<span class="comment">$1</span>')
            .replace(tags, '<span class="tag">$1</span>')
            .replace(attributes, '<span class="attribute">$1</span>=<span class="string">"$2"</span>');
    }
    
    highlightJSON(code) {
        const strings = /(")([^"\\]|\\.)*(")/g;
        const numbers = /\b-?\d+(\.\d+)?([eE][+-]?\d+)?\b/g;
        const booleans = /\b(true|false|null)\b/g;
        const keys = /(")([^"\\]|\\.)*(")\s*:/g;
        
        return code
            .replace(keys, '<span class="key">$1$2$3</span>:')
            .replace(strings, '<span class="string">$1$2$3</span>')
            .replace(booleans, '<span class="boolean">$1</span>')
            .replace(numbers, '<span class="number">$1</span>');
    }
    
    insertTab() {
        const spaces = ' '.repeat(this.options.tabSize);
        this.insertText(spaces);
    }
    
    insertText(text) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            range.insertNode(document.createTextNode(text));
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }
    
    saveSelection() {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            return {
                startOffset: selection.getRangeAt(0).startOffset,
                endOffset: selection.getRangeAt(0).endOffset,
                startContainer: selection.getRangeAt(0).startContainer,
                endContainer: selection.getRangeAt(0).endContainer
            };
        }
        return null;
    }
    
    restoreSelection(savedSelection) {
        if (!savedSelection) return;
        
        try {
            const selection = window.getSelection();
            const range = document.createRange();
            
            range.setStart(savedSelection.startContainer, savedSelection.startOffset);
            range.setEnd(savedSelection.endContainer, savedSelection.endOffset);
            
            selection.removeAllRanges();
            selection.addRange(range);
        } catch (error) {
            // Selection restoration failed, ignore
        }
    }
    
    async copyToClipboard() {
        try {
            await navigator.clipboard.writeText(this.code);
            this.showFeedback('Copied to clipboard!', 'success');
        } catch (error) {
            // Fallback for older browsers
            this.fallbackCopyToClipboard();
        }
    }
    
    fallbackCopyToClipboard() {
        const textArea = document.createElement('textarea');
        textArea.value = this.code;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
            document.execCommand('copy');
            this.showFeedback('Copied to clipboard!', 'success');
        } catch (error) {
            this.showFeedback('Copy failed', 'error');
        }
        
        document.body.removeChild(textArea);
    }
    
    async runCode() {
        if (this.isRunning || !this.options.runnable) return;
        
        this.isRunning = true;
        this.showFeedback('Running code...', 'info');
        
        try {
            const result = await this.executeCode();
            this.displayOutput(result);
            this.emit('codeExecuted', { code: this.code, result });
        } catch (error) {
            this.displayOutput(`Error: ${error.message}`, 'error');
            this.emit('codeError', { code: this.code, error });
        } finally {
            this.isRunning = false;
        }
    }
    
    async executeCode() {
        // This is a simulation - in a real implementation, 
        // you'd want to use a sandboxed environment
        switch (this.options.language) {
            case 'javascript':
                return this.simulateJavaScriptExecution();
            default:
                return 'Code execution simulation not implemented for this language';
        }
    }
    
    simulateJavaScriptExecution() {
        // Simple JavaScript simulation
        try {
            // Create a safe execution context
            const logs = [];
            const mockConsole = {
                log: (...args) => logs.push(args.join(' ')),
                error: (...args) => logs.push(`ERROR: ${args.join(' ')}`),
                warn: (...args) => logs.push(`WARN: ${args.join(' ')}`)
            };
            
            // Very basic evaluation - in production, use a proper sandbox
            const safeCode = this.code.replace(/console\./g, 'mockConsole.');
            const func = new Function('mockConsole', safeCode);
            func(mockConsole);
            
            return logs.length > 0 ? logs.join('\n') : 'Code executed successfully (no output)';
        } catch (error) {
            throw new Error(`Execution failed: ${error.message}`);
        }
    }
    
    displayOutput(content, type = 'info') {
        if (!this.outputContent) return;
        
        this.outputContent.innerHTML = `
            <div class="doc-output-line ${type}">
                <span class="doc-output-timestamp">[${new Date().toLocaleTimeString()}]</span>
                <pre>${this.escapeHtml(content)}</pre>
            </div>
        `;
        
        if (this.outputContainer) {
            this.outputContainer.style.display = 'block';
        }
    }
    
    resetCode() {
        const originalCode = this.element.dataset.originalCode || this.code;
        this.setCode(originalCode);
        this.showFeedback('Code reset', 'info');
    }
    
    setCode(code) {
        this.code = code;
        if (this.codeEditor) {
            this.codeEditor.textContent = code;
            this.updateLineNumbers();
            this.applySyntaxHighlighting();
        }
    }
    
    getCode() {
        return this.code;
    }
    
    showFeedback(message, type = 'info') {
        // Create temporary feedback element
        const feedback = document.createElement('div');
        feedback.className = `doc-feedback ${type}`;
        feedback.textContent = message;
        feedback.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: var(--doc-bg-surface);
            color: var(--doc-text-primary);
            padding: 8px 12px;
            border-radius: 4px;
            border: 1px solid var(--doc-primary-color);
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        
        this.element.style.position = 'relative';
        this.element.appendChild(feedback);
        
        // Animate in
        setTimeout(() => feedback.style.opacity = '1', 10);
        
        // Remove after delay
        setTimeout(() => {
            feedback.style.opacity = '0';
            setTimeout(() => {
                if (feedback.parentNode) {
                    feedback.parentNode.removeChild(feedback);
                }
            }, 300);
        }, 2000);
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Register the component
if (typeof DocumentationComponentFactory !== 'undefined') {
    DocumentationComponentFactory.register('code-playground', CodePlayground);
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CodePlayground;
} else if (typeof window !== 'undefined') {
    window.CodePlayground = CodePlayground;
}