/**
 * Smart Navigation and Search System for Wiki
 * Provides intelligent search, breadcrumbs, and navigation enhancements
 */

class WikiSmartNavigation {
    constructor() {
        this.searchIndex = new Map();
        this.searchHistory = [];
        this.bookmarks = new Set();
        this.currentPath = [];
        this.suggestions = [];
        
        // Search index with weighted content
        this.contentDatabase = new Map([
            // Ship Design Content
            ['ship-design', {
                title: 'Ship Design Guide',
                category: 'Ship Design',
                keywords: ['hull', 'component', 'stats', 'building', 'designing', 'fighter', 'cruiser', 'battleship'],
                content: 'Learn ship design, hull selection, component installation, and stat optimization',
                url: '/wiki/ship-design/index.html',
                weight: 10
            }],
            ['hull-selection', {
                title: 'Hull Selection Guide',
                category: 'Ship Design',
                keywords: ['hull', 'fighter', 'freighter', 'explorer', 'battleship', 'selection', 'choosing'],
                content: 'Choose the right hull for your ship design strategy',
                url: '/wiki/ship-design/hull-selection.html',
                weight: 8
            }],
            ['component-installation', {
                title: 'Component Installation',
                category: 'Ship Design', 
                keywords: ['components', 'weapons', 'engines', 'shields', 'installation', 'fitting'],
                content: 'Install and configure ship components for optimal performance',
                url: '/wiki/ship-design/component-installation.html',
                weight: 8
            }],
            
            // Combat Content
            ['combat-guide', {
                title: 'Combat Guide',
                category: 'Combat',
                keywords: ['combat', 'fighting', 'battle', 'weapons', 'tactics', 'strategy'],
                content: 'Master combat mechanics, tactics, and weapon systems',
                url: '/wiki/combat/index.html',
                weight: 10
            }],
            ['weapon-systems', {
                title: 'Weapon Systems',
                category: 'Combat',
                keywords: ['weapons', 'laser', 'plasma', 'missile', 'railgun', 'damage', 'accuracy'],
                content: 'Comprehensive guide to all weapon types and combat systems',
                url: '/wiki/combat/weapon-systems.html',
                weight: 9
            }],
            ['tactical-combat', {
                title: 'Tactical Combat',
                category: 'Combat',
                keywords: ['tactics', 'strategy', 'formations', 'maneuvers', 'positioning'],
                content: 'Advanced combat tactics and strategic positioning',
                url: '/wiki/combat/tactical-combat.html',
                weight: 7
            }],
            
            // Trading Content
            ['trading-guide', {
                title: 'Trading Guide',
                category: 'Trading',
                keywords: ['trading', 'commerce', 'profit', 'economics', 'market', 'commodities'],
                content: 'Economic systems, market mechanics, and profitable trading',
                url: '/wiki/trading/index.html',
                weight: 10
            }],
            ['market-mechanics', {
                title: 'Market Mechanics',
                category: 'Trading',
                keywords: ['market', 'supply', 'demand', 'prices', 'economics', 'fluctuation'],
                content: 'Understanding market dynamics and price movements',
                url: '/wiki/trading/market-mechanics.html',
                weight: 8
            }],
            ['route-planning', {
                title: 'Route Planning',
                category: 'Trading',
                keywords: ['routes', 'planning', 'optimization', 'travel', 'efficiency', 'fuel'],
                content: 'Plan efficient trade routes for maximum profit',
                url: '/wiki/trading/route-planning.html',
                weight: 7
            }],
            
            // Faction Content
            ['factions-guide', {
                title: 'Factions Guide',
                category: 'Factions',
                keywords: ['factions', 'terran', 'zynthian', 'nexus', 'pirates', 'diplomacy'],
                content: 'Complete guide to all factions, their strengths and cultures',
                url: '/wiki/factions/index.html',
                weight: 10
            }],
            ['terran-federation', {
                title: 'Terran Federation',
                category: 'Factions',
                keywords: ['terran', 'human', 'federation', 'balanced', 'military', 'democratic'],
                content: 'Human faction with balanced capabilities and democratic values',
                url: '/wiki/factions/terran-federation.html',
                weight: 6
            }],
            ['zynthian-collective', {
                title: 'Zynthian Collective',
                category: 'Factions',
                keywords: ['zynthian', 'alien', 'biotechnology', 'collective', 'advanced', 'organic'],
                content: 'Advanced alien civilization focused on biotechnology',
                url: '/wiki/factions/zynthian-collective.html',
                weight: 6
            }],
            
            // Strategy Content
            ['strategy-guide', {
                title: 'Strategy Guide',
                category: 'Strategy',
                keywords: ['strategy', 'tips', 'guide', 'beginner', 'advanced', 'tactics'],
                content: 'Strategic gameplay tips and advanced techniques',
                url: '/wiki/strategy/index.html',
                weight: 9
            }]
        ]);
        
        this.quickActions = [
            { name: 'Ship Calculator', icon: '🚀', url: '/wiki/ship-design/hull-selection.html', category: 'Tools' },
            { name: 'Trade Planner', icon: '📊', url: '/wiki/trading/market-mechanics.html', category: 'Tools' },
            { name: 'Combat Simulator', icon: '⚔️', url: '/wiki/combat/weapon-systems.html', category: 'Tools' },
            { name: 'Faction Comparison', icon: '⚖️', url: '/wiki/factions/index.html', category: 'Tools' },
            { name: 'Ship Design', icon: '🔧', url: '/wiki/ship-design/index.html', category: 'Guides' },
            { name: 'Combat Guide', icon: '💥', url: '/wiki/combat/index.html', category: 'Guides' },
            { name: 'Trading Guide', icon: '💰', url: '/wiki/trading/index.html', category: 'Guides' },
            { name: 'Factions', icon: '🏛️', url: '/wiki/factions/index.html', category: 'Guides' }
        ];
        
        this.init();
    }
    
    init() {
        this.createNavigationInterface();
        this.setupSearchIndex();
        this.loadUserPreferences();
        this.updateBreadcrumbs();
        this.bindEvents();
    }
    
    createNavigationInterface() {
        // Create search header
        const searchHeader = document.createElement('div');
        searchHeader.className = 'wiki-search-header';
        searchHeader.innerHTML = `
            <div class="search-container">
                <div class="search-input-group">
                    <input type="text" id="wikiSearchInput" placeholder="Search wiki content..." 
                           autocomplete="off" spellcheck="false">
                    <button class="search-btn" onclick="wikiNav.performSearch()">
                        🔍
                    </button>
                    <button class="clear-search-btn" onclick="wikiNav.clearSearch()" style="display: none;">
                        ✕
                    </button>
                </div>
                
                <div class="search-suggestions" id="searchSuggestions" style="display: none;">
                    <!-- Suggestions populated here -->
                </div>
                
                <div class="search-results" id="searchResults" style="display: none;">
                    <!-- Results populated here -->
                </div>
            </div>
            
            <div class="navigation-tools">
                <button class="nav-tool-btn" onclick="wikiNav.toggleQuickActions()" title="Quick Actions">
                    ⚡
                </button>
                <button class="nav-tool-btn" onclick="wikiNav.toggleBookmarks()" title="Bookmarks">
                    🔖
                </button>
                <button class="nav-tool-btn" onclick="wikiNav.toggleHistory()" title="Search History">
                    📜
                </button>
            </div>
        `;
        
        // Insert at the top of the page
        document.body.insertAdjacentElement('afterbegin', searchHeader);
        
        // Create breadcrumb navigation
        const breadcrumbNav = document.createElement('div');
        breadcrumbNav.className = 'wiki-breadcrumbs';
        breadcrumbNav.id = 'wikiBreadcrumbs';
        
        const docContent = document.querySelector('.doc-content');
        if (docContent) {
            docContent.insertAdjacentElement('beforebegin', breadcrumbNav);
        }
        
        // Create floating action panels
        this.createActionPanels();
    }
    
    createActionPanels() {
        // Quick Actions Panel
        const quickActionsPanel = document.createElement('div');
        quickActionsPanel.className = 'quick-actions-panel';
        quickActionsPanel.id = 'quickActionsPanel';
        quickActionsPanel.style.display = 'none';
        quickActionsPanel.innerHTML = `
            <div class="panel-header">
                <h4>Quick Actions</h4>
                <button class="close-panel" onclick="wikiNav.toggleQuickActions()">✕</button>
            </div>
            <div class="panel-content">
                <div class="action-categories">
                    <div class="action-category">
                        <h5>🛠️ Interactive Tools</h5>
                        <div class="action-grid">
                            ${this.quickActions.filter(a => a.category === 'Tools').map(action => `
                                <a href="${action.url}" class="action-item">
                                    <span class="action-icon">${action.icon}</span>
                                    <span class="action-name">${action.name}</span>
                                </a>
                            `).join('')}
                        </div>
                    </div>
                    <div class="action-category">
                        <h5>📚 Essential Guides</h5>
                        <div class="action-grid">
                            ${this.quickActions.filter(a => a.category === 'Guides').map(action => `
                                <a href="${action.url}" class="action-item">
                                    <span class="action-icon">${action.icon}</span>
                                    <span class="action-name">${action.name}</span>
                                </a>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Bookmarks Panel
        const bookmarksPanel = document.createElement('div');
        bookmarksPanel.className = 'bookmarks-panel';
        bookmarksPanel.id = 'bookmarksPanel';
        bookmarksPanel.style.display = 'none';
        bookmarksPanel.innerHTML = `
            <div class="panel-header">
                <h4>Bookmarks</h4>
                <button class="bookmark-current" onclick="wikiNav.bookmarkCurrentPage()" title="Bookmark this page">
                    ⭐
                </button>
                <button class="close-panel" onclick="wikiNav.toggleBookmarks()">✕</button>
            </div>
            <div class="panel-content">
                <div class="bookmarks-list" id="bookmarksList">
                    <!-- Bookmarks populated here -->
                </div>
            </div>
        `;
        
        // History Panel
        const historyPanel = document.createElement('div');
        historyPanel.className = 'history-panel';
        historyPanel.id = 'historyPanel';
        historyPanel.style.display = 'none';
        historyPanel.innerHTML = `
            <div class="panel-header">
                <h4>Search History</h4>
                <button class="clear-history" onclick="wikiNav.clearHistory()" title="Clear history">
                    🗑️
                </button>
                <button class="close-panel" onclick="wikiNav.toggleHistory()">✕</button>
            </div>
            <div class="panel-content">
                <div class="history-list" id="historyList">
                    <!-- History populated here -->
                </div>
            </div>
        `;
        
        // Add panels to page
        document.body.appendChild(quickActionsPanel);
        document.body.appendChild(bookmarksPanel);
        document.body.appendChild(historyPanel);
    }
    
    setupSearchIndex() {
        // Build search index with content weighting
        this.contentDatabase.forEach((content, id) => {
            const searchTerms = [
                ...content.title.toLowerCase().split(' '),
                ...content.keywords,
                ...content.content.toLowerCase().split(' '),
                content.category.toLowerCase()
            ];
            
            searchTerms.forEach(term => {
                if (term.length > 2) { // Ignore very short terms
                    if (!this.searchIndex.has(term)) {
                        this.searchIndex.set(term, []);
                    }
                    this.searchIndex.get(term).push({
                        id,
                        ...content,
                        relevance: this.calculateRelevance(term, content)
                    });
                }
            });
        });
    }
    
    calculateRelevance(term, content) {
        let relevance = content.weight;
        
        // Boost relevance for title matches
        if (content.title.toLowerCase().includes(term)) {
            relevance += 20;
        }
        
        // Boost for keyword matches
        if (content.keywords.some(keyword => keyword.includes(term))) {
            relevance += 15;
        }
        
        // Boost for category matches
        if (content.category.toLowerCase().includes(term)) {
            relevance += 10;
        }
        
        return relevance;
    }
    
    bindEvents() {
        const searchInput = document.getElementById('wikiSearchInput');
        
        // Search input events
        searchInput.addEventListener('input', (e) => {
            this.handleSearchInput(e.target.value);
        });
        
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            } else if (e.key === 'Escape') {
                this.clearSearch();
            }
        });
        
        searchInput.addEventListener('focus', () => {
            this.showSuggestions();
        });
        
        // Click outside to close panels
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.wiki-search-header') && 
                !e.target.closest('.quick-actions-panel') &&
                !e.target.closest('.bookmarks-panel') &&
                !e.target.closest('.history-panel')) {
                this.closeAllPanels();
            }
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl+K or Cmd+K to focus search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                searchInput.focus();
            }
            
            // Ctrl+B or Cmd+B to toggle bookmarks
            if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
                e.preventDefault();
                this.toggleBookmarks();
            }
        });
    }
    
    handleSearchInput(query) {
        const clearBtn = document.querySelector('.clear-search-btn');
        
        if (query.length > 0) {
            clearBtn.style.display = 'block';
            if (query.length >= 2) {
                this.showSuggestions(query);
            }
        } else {
            clearBtn.style.display = 'none';
            this.hideSuggestions();
        }
    }
    
    showSuggestions(query = '') {
        const suggestionsDiv = document.getElementById('searchSuggestions');
        
        if (query.length >= 2) {
            const suggestions = this.getSuggestions(query);
            
            if (suggestions.length > 0) {
                suggestionsDiv.innerHTML = `
                    <div class="suggestions-header">Suggestions</div>
                    <div class="suggestions-list">
                        ${suggestions.slice(0, 6).map(suggestion => `
                            <div class="suggestion-item" onclick="wikiNav.selectSuggestion('${suggestion.id}', '${suggestion.title}')">
                                <div class="suggestion-title">${this.highlightMatch(suggestion.title, query)}</div>
                                <div class="suggestion-category">${suggestion.category}</div>
                                <div class="suggestion-content">${this.highlightMatch(suggestion.content.substring(0, 100) + '...', query)}</div>
                            </div>
                        `).join('')}
                    </div>
                `;
                suggestionsDiv.style.display = 'block';
            } else {
                this.hideSuggestions();
            }
        } else {
            // Show recent searches and popular pages
            const recentSearches = this.searchHistory.slice(-4);
            const popularPages = Array.from(this.contentDatabase.values())
                .sort((a, b) => b.weight - a.weight)
                .slice(0, 4);
            
            suggestionsDiv.innerHTML = `
                ${recentSearches.length > 0 ? `
                    <div class="suggestions-section">
                        <div class="suggestions-header">Recent Searches</div>
                        <div class="recent-searches">
                            ${recentSearches.map(search => `
                                <div class="recent-search-item" onclick="wikiNav.setSearchQuery('${search}')">
                                    ${search}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <div class="suggestions-section">
                    <div class="suggestions-header">Popular Pages</div>
                    <div class="suggestions-list">
                        ${popularPages.map(page => `
                            <div class="suggestion-item" onclick="window.location.href='${page.url}'">
                                <div class="suggestion-title">${page.title}</div>
                                <div class="suggestion-category">${page.category}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            suggestionsDiv.style.display = 'block';
        }
    }
    
    hideSuggestions() {
        document.getElementById('searchSuggestions').style.display = 'none';
    }
    
    getSuggestions(query) {
        const terms = query.toLowerCase().split(' ').filter(term => term.length > 1);
        const results = new Map();
        
        terms.forEach(term => {
            // Find partial matches
            this.searchIndex.forEach((entries, indexTerm) => {
                if (indexTerm.includes(term)) {
                    entries.forEach(entry => {
                        if (results.has(entry.id)) {
                            results.get(entry.id).relevance += entry.relevance;
                        } else {
                            results.set(entry.id, { ...entry });
                        }
                    });
                }
            });
        });
        
        return Array.from(results.values())
            .sort((a, b) => b.relevance - a.relevance);
    }
    
    performSearch() {
        const query = document.getElementById('wikiSearchInput').value.trim();
        
        if (query.length < 2) {
            return;
        }
        
        // Add to search history
        if (!this.searchHistory.includes(query)) {
            this.searchHistory.unshift(query);
            if (this.searchHistory.length > 20) {
                this.searchHistory.pop();
            }
            this.saveUserPreferences();
        }
        
        const results = this.getSuggestions(query);
        this.displaySearchResults(results, query);
    }
    
    displaySearchResults(results, query) {
        const resultsDiv = document.getElementById('searchResults');
        const suggestionsDiv = document.getElementById('searchSuggestions');
        
        suggestionsDiv.style.display = 'none';
        
        if (results.length > 0) {
            resultsDiv.innerHTML = `
                <div class="results-header">
                    Found ${results.length} result${results.length !== 1 ? 's' : ''} for "${query}"
                    <button class="close-results" onclick="wikiNav.closeSearchResults()">✕</button>
                </div>
                <div class="results-list">
                    ${results.map(result => `
                        <div class="result-item" onclick="wikiNav.navigateToResult('${result.url}')">
                            <div class="result-title">${this.highlightMatch(result.title, query)}</div>
                            <div class="result-category">${result.category}</div>
                            <div class="result-content">${this.highlightMatch(result.content, query)}</div>
                            <div class="result-url">${result.url}</div>
                        </div>
                    `).join('')}
                </div>
            `;
            resultsDiv.style.display = 'block';
        } else {
            resultsDiv.innerHTML = `
                <div class="results-header">
                    No results found for "${query}"
                    <button class="close-results" onclick="wikiNav.closeSearchResults()">✕</button>
                </div>
                <div class="no-results">
                    <p>Try:</p>
                    <ul>
                        <li>Using different keywords</li>
                        <li>Checking for typos</li>
                        <li>Using more general terms</li>
                    </ul>
                    
                    <div class="suggested-searches">
                        <h6>Popular searches:</h6>
                        <div class="search-tags">
                            ${['ship design', 'combat', 'trading', 'factions', 'weapons', 'strategy'].map(tag => `
                                <button class="search-tag" onclick="wikiNav.setSearchQuery('${tag}')">${tag}</button>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
            resultsDiv.style.display = 'block';
        }
    }
    
    highlightMatch(text, query) {
        if (!query) return text;
        
        const terms = query.toLowerCase().split(' ').filter(term => term.length > 1);
        let highlighted = text;
        
        terms.forEach(term => {
            const regex = new RegExp(`(${term})`, 'gi');
            highlighted = highlighted.replace(regex, '<mark>$1</mark>');
        });
        
        return highlighted;
    }
    
    selectSuggestion(id, title) {
        const content = this.contentDatabase.get(id);
        if (content) {
            this.navigateToResult(content.url);
        }
    }
    
    navigateToResult(url) {
        window.location.href = url;
    }
    
    setSearchQuery(query) {
        document.getElementById('wikiSearchInput').value = query;
        this.performSearch();
    }
    
    clearSearch() {
        document.getElementById('wikiSearchInput').value = '';
        document.querySelector('.clear-search-btn').style.display = 'none';
        this.hideSuggestions();
        this.closeSearchResults();
    }
    
    closeSearchResults() {
        document.getElementById('searchResults').style.display = 'none';
    }
    
    updateBreadcrumbs() {
        const breadcrumbsDiv = document.getElementById('wikiBreadcrumbs');
        if (!breadcrumbsDiv) return;
        
        const path = window.location.pathname;
        const pathParts = path.split('/').filter(part => part);
        
        // Build breadcrumb trail
        const breadcrumbs = ['Wiki'];
        let currentPath = '';
        
        pathParts.forEach((part, index) => {
            if (part === 'wiki' || part.endsWith('.html')) return;
            
            currentPath += '/' + part;
            const displayName = this.formatBreadcrumbName(part);
            breadcrumbs.push(displayName);
        });
        
        // Add current page title
        const pageTitle = document.querySelector('h1')?.textContent;
        if (pageTitle && !breadcrumbs.includes(pageTitle)) {
            breadcrumbs.push(pageTitle);
        }
        
        breadcrumbsDiv.innerHTML = `
            <div class="breadcrumb-trail">
                ${breadcrumbs.map((crumb, index) => `
                    <span class="breadcrumb-item ${index === breadcrumbs.length - 1 ? 'current' : ''}">
                        ${index > 0 ? '<span class="breadcrumb-separator">›</span>' : ''}
                        ${crumb}
                    </span>
                `).join('')}
            </div>
        `;
    }
    
    formatBreadcrumbName(name) {
        return name
            .replace(/-/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }
    
    toggleQuickActions() {
        const panel = document.getElementById('quickActionsPanel');
        const isVisible = panel.style.display !== 'none';
        
        this.closeAllPanels();
        
        if (!isVisible) {
            panel.style.display = 'block';
        }
    }
    
    toggleBookmarks() {
        const panel = document.getElementById('bookmarksPanel');
        const isVisible = panel.style.display !== 'none';
        
        this.closeAllPanels();
        
        if (!isVisible) {
            this.updateBookmarksList();
            panel.style.display = 'block';
        }
    }
    
    toggleHistory() {
        const panel = document.getElementById('historyPanel');
        const isVisible = panel.style.display !== 'none';
        
        this.closeAllPanels();
        
        if (!isVisible) {
            this.updateHistoryList();
            panel.style.display = 'block';
        }
    }
    
    closeAllPanels() {
        document.getElementById('quickActionsPanel').style.display = 'none';
        document.getElementById('bookmarksPanel').style.display = 'none';
        document.getElementById('historyPanel').style.display = 'none';
        this.hideSuggestions();
        this.closeSearchResults();
    }
    
    bookmarkCurrentPage() {
        const title = document.querySelector('h1')?.textContent || document.title;
        const url = window.location.pathname;
        
        const bookmark = { title, url, timestamp: Date.now() };
        
        // Check if already bookmarked
        const existingBookmark = Array.from(this.bookmarks).find(b => b.url === url);
        if (existingBookmark) {
            this.bookmarks.delete(existingBookmark);
            alert('Bookmark removed');
        } else {
            this.bookmarks.add(bookmark);
            alert('Page bookmarked');
        }
        
        this.saveUserPreferences();
        this.updateBookmarksList();
    }
    
    updateBookmarksList() {
        const bookmarksList = document.getElementById('bookmarksList');
        const bookmarksArray = Array.from(this.bookmarks).sort((a, b) => b.timestamp - a.timestamp);
        
        if (bookmarksArray.length === 0) {
            bookmarksList.innerHTML = '<div class="empty-state">No bookmarks yet</div>';
            return;
        }
        
        bookmarksList.innerHTML = bookmarksArray.map(bookmark => `
            <div class="bookmark-item">
                <a href="${bookmark.url}" class="bookmark-link">
                    <div class="bookmark-title">${bookmark.title}</div>
                    <div class="bookmark-url">${bookmark.url}</div>
                </a>
                <button class="remove-bookmark" onclick="wikiNav.removeBookmark('${bookmark.url}')" title="Remove bookmark">
                    🗑️
                </button>
            </div>
        `).join('');
    }
    
    removeBookmark(url) {
        const bookmark = Array.from(this.bookmarks).find(b => b.url === url);
        if (bookmark) {
            this.bookmarks.delete(bookmark);
            this.saveUserPreferences();
            this.updateBookmarksList();
        }
    }
    
    updateHistoryList() {
        const historyList = document.getElementById('historyList');
        
        if (this.searchHistory.length === 0) {
            historyList.innerHTML = '<div class="empty-state">No search history</div>';
            return;
        }
        
        historyList.innerHTML = this.searchHistory.map(search => `
            <div class="history-item" onclick="wikiNav.setSearchQuery('${search}')">
                <span class="history-query">${search}</span>
                <button class="remove-history" onclick="event.stopPropagation(); wikiNav.removeFromHistory('${search}')" title="Remove">
                    ✕
                </button>
            </div>
        `).join('');
    }
    
    removeFromHistory(query) {
        const index = this.searchHistory.indexOf(query);
        if (index > -1) {
            this.searchHistory.splice(index, 1);
            this.saveUserPreferences();
            this.updateHistoryList();
        }
    }
    
    clearHistory() {
        this.searchHistory = [];
        this.saveUserPreferences();
        this.updateHistoryList();
    }
    
    loadUserPreferences() {
        try {
            const prefs = localStorage.getItem('wikiNavPreferences');
            if (prefs) {
                const data = JSON.parse(prefs);
                this.searchHistory = data.searchHistory || [];
                this.bookmarks = new Set(data.bookmarks || []);
            }
        } catch (e) {
            console.warn('Failed to load navigation preferences:', e);
        }
    }
    
    saveUserPreferences() {
        try {
            const prefs = {
                searchHistory: this.searchHistory,
                bookmarks: Array.from(this.bookmarks)
            };
            localStorage.setItem('wikiNavPreferences', JSON.stringify(prefs));
        } catch (e) {
            console.warn('Failed to save navigation preferences:', e);
        }
    }
}

// Initialize smart navigation when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.wikiNav = new WikiSmartNavigation();
});

// Add CSS for smart navigation
const smartNavigationCSS = `
<style>
.wiki-search-header {
    position: sticky;
    top: 0;
    z-index: 1000;
    background: linear-gradient(135deg, #0d1421 0%, #1a1a2e 100%);
    border-bottom: 2px solid #00d4ff;
    padding: 1rem;
    box-shadow: 0 2px 10px rgba(0, 212, 255, 0.2);
}

.search-container {
    max-width: 800px;
    margin: 0 auto;
    position: relative;
}

.search-input-group {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
}

#wikiSearchInput {
    flex-grow: 1;
    padding: 0.75rem 1rem;
    background: rgba(255, 255, 255, 0.1);
    border: 2px solid transparent;
    border-radius: 8px;
    color: #fff;
    font-size: 1rem;
    transition: all 0.3s;
}

#wikiSearchInput:focus {
    outline: none;
    border-color: #00d4ff;
    background: rgba(255, 255, 255, 0.15);
}

#wikiSearchInput::placeholder {
    color: #888;
}

.search-btn, .clear-search-btn {
    padding: 0.75rem 1rem;
    background: #00d4ff;
    border: none;
    border-radius: 6px;
    color: #000;
    cursor: pointer;
    font-weight: bold;
    transition: all 0.3s;
}

.search-btn:hover, .clear-search-btn:hover {
    background: #00bfef;
    transform: translateY(-1px);
}

.clear-search-btn {
    background: #ff6b6b;
    color: #fff;
}

.navigation-tools {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
    margin-top: 0.5rem;
}

.nav-tool-btn {
    padding: 0.5rem 1rem;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid #00d4ff;
    border-radius: 6px;
    color: #fff;
    cursor: pointer;
    transition: all 0.3s;
    font-size: 1.1rem;
}

.nav-tool-btn:hover {
    background: rgba(0, 212, 255, 0.2);
    transform: translateY(-1px);
}

.search-suggestions, .search-results {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: #1a1a2e;
    border: 2px solid #00d4ff;
    border-radius: 8px;
    max-height: 400px;
    overflow-y: auto;
    z-index: 1001;
    box-shadow: 0 4px 20px rgba(0, 212, 255, 0.3);
}

.suggestions-header, .results-header {
    padding: 0.75rem 1rem;
    background: rgba(0, 212, 255, 0.1);
    border-bottom: 1px solid #00d4ff;
    font-weight: bold;
    color: #00d4ff;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.close-results {
    background: none;
    border: none;
    color: #ff6b6b;
    cursor: pointer;
    font-size: 1.2rem;
}

.suggestions-list, .results-list {
    padding: 0.5rem 0;
}

.suggestion-item, .result-item {
    padding: 0.75rem 1rem;
    cursor: pointer;
    transition: background 0.2s;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.suggestion-item:hover, .result-item:hover {
    background: rgba(0, 212, 255, 0.1);
}

.suggestion-title, .result-title {
    font-weight: bold;
    color: #fff;
    margin-bottom: 0.25rem;
}

.suggestion-category, .result-category {
    font-size: 0.8rem;
    color: #00d4ff;
    margin-bottom: 0.25rem;
}

.suggestion-content, .result-content {
    font-size: 0.9rem;
    color: #ccc;
    line-height: 1.4;
}

.result-url {
    font-size: 0.8rem;
    color: #888;
    margin-top: 0.25rem;
}

.suggestions-section {
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding: 0.5rem 0;
}

.recent-searches {
    padding: 0.5rem 1rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.recent-search-item {
    padding: 0.25rem 0.75rem;
    background: rgba(0, 212, 255, 0.1);
    border: 1px solid #00d4ff;
    border-radius: 20px;
    font-size: 0.9rem;
    color: #00d4ff;
    cursor: pointer;
    transition: all 0.2s;
}

.recent-search-item:hover {
    background: rgba(0, 212, 255, 0.2);
}

.no-results {
    padding: 1rem;
    text-align: center;
    color: #ccc;
}

.no-results ul {
    text-align: left;
    max-width: 300px;
    margin: 1rem auto;
}

.suggested-searches {
    margin-top: 1.5rem;
}

.search-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: center;
    margin-top: 0.5rem;
}

.search-tag {
    padding: 0.5rem 1rem;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid #00d4ff;
    border-radius: 20px;
    color: #fff;
    cursor: pointer;
    transition: all 0.2s;
}

.search-tag:hover {
    background: rgba(0, 212, 255, 0.2);
}

.wiki-breadcrumbs {
    background: rgba(0, 212, 255, 0.05);
    padding: 0.75rem 1rem;
    border-bottom: 1px solid rgba(0, 212, 255, 0.2);
    margin-bottom: 1rem;
}

.breadcrumb-trail {
    max-width: 800px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.breadcrumb-item {
    color: #00d4ff;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.breadcrumb-item.current {
    color: #fff;
    font-weight: bold;
}

.breadcrumb-separator {
    color: #666;
}

.quick-actions-panel, .bookmarks-panel, .history-panel {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    background: #1a1a2e;
    border: 2px solid #00d4ff;
    border-radius: 12px;
    z-index: 1002;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    overflow: hidden;
}

.panel-header {
    background: rgba(0, 212, 255, 0.1);
    padding: 1rem;
    border-bottom: 1px solid #00d4ff;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.panel-header h4 {
    color: #00d4ff;
    margin: 0;
}

.close-panel, .bookmark-current, .clear-history {
    background: none;
    border: none;
    color: #fff;
    cursor: pointer;
    font-size: 1.2rem;
    padding: 0.25rem;
}

.close-panel:hover, .bookmark-current:hover, .clear-history:hover {
    color: #00d4ff;
}

.panel-content {
    padding: 1rem;
    max-height: 60vh;
    overflow-y: auto;
}

.action-categories {
    display: grid;
    gap: 2rem;
}

.action-category h5 {
    color: #00d4ff;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.action-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 1rem;
}

.action-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.05);
    border: 2px solid transparent;
    border-radius: 8px;
    text-decoration: none;
    color: #fff;
    transition: all 0.3s;
}

.action-item:hover {
    border-color: #00d4ff;
    background: rgba(0, 212, 255, 0.1);
    transform: translateY(-2px);
}

.action-icon {
    font-size: 2rem;
    margin-bottom: 0.5rem;
}

.action-name {
    font-size: 0.9rem;
    text-align: center;
}

.bookmarks-list, .history-list {
    display: grid;
    gap: 0.5rem;
}

.bookmark-item, .history-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 6px;
    transition: background 0.2s;
}

.bookmark-item:hover, .history-item:hover {
    background: rgba(255, 255, 255, 0.1);
}

.bookmark-link {
    flex-grow: 1;
    text-decoration: none;
    color: #fff;
}

.bookmark-title, .history-query {
    font-weight: bold;
    margin-bottom: 0.25rem;
}

.bookmark-url {
    font-size: 0.8rem;
    color: #888;
}

.remove-bookmark, .remove-history {
    background: none;
    border: none;
    color: #ff6b6b;
    cursor: pointer;
    padding: 0.25rem;
}

.remove-bookmark:hover, .remove-history:hover {
    color: #ff5252;
}

.empty-state {
    text-align: center;
    color: #888;
    padding: 2rem;
}

mark {
    background: #ffa726;
    color: #000;
    padding: 0.1rem 0.2rem;
    border-radius: 2px;
}

@media (max-width: 768px) {
    .wiki-search-header {
        padding: 0.75rem;
    }
    
    .search-input-group {
        flex-direction: column;
    }
    
    .navigation-tools {
        flex-wrap: wrap;
    }
    
    .quick-actions-panel, .bookmarks-panel, .history-panel {
        width: 95%;
        max-height: 90vh;
    }
    
    .action-grid {
        grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    }
    
    .breadcrumb-trail {
        font-size: 0.9rem;
    }
}
</style>
`;

// Inject CSS
document.head.insertAdjacentHTML('beforeend', smartNavigationCSS);