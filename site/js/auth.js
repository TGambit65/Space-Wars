// Space Wars 3000 Authentication UI System
// SECURITY: Client-side authentication logic removed - UI only

document.addEventListener('DOMContentLoaded', function() {
    // Check for logout parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('logout') === 'true') {
        // Clear client-side data only - server handles session invalidation
        clearClientAuthData();
        // Remove the logout parameter from URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // Check if user has valid token and update UI
    checkAuthStatus();

    // Login form submission
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const username = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;

            // Perform server-side authentication
            performLogin(username, password);
        });
    }

    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            performLogout();
        });
    }
});

// Clear client-side authentication data
function clearClientAuthData() {
    localStorage.removeItem('sw3000_authenticated');
    localStorage.removeItem('userInfo');
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('sessionId');
}

// Perform server-side login
async function performLogin(username, password) {
    const loginError = document.getElementById('login-error');
    const loginForm = document.getElementById('login-form');
    
    try {
        // Show loading state
        if (loginForm) {
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Logging in...';
            }
        }

        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            // Store authentication data securely
            localStorage.setItem('token', data.token);
            localStorage.setItem('userInfo', JSON.stringify(data.user));
            
            // Store session data if provided
            if (data.session) {
                if (data.session.refreshToken) {
                    localStorage.setItem('refreshToken', data.session.refreshToken);
                }
                if (data.session.sessionId) {
                    localStorage.setItem('sessionId', data.session.sessionId);
                }
            }

            // Redirect to intended page or dashboard
            const redirectTarget = localStorage.getItem('loginRedirect');
            if (redirectTarget) {
                localStorage.removeItem('loginRedirect');
                window.location.href = redirectTarget;
            } else {
                window.location.href = '/play';
            }
        } else {
            if (loginError) {
                loginError.textContent = data.error || 'Login failed';
            }
        }
    } catch (error) {
        console.error('Login error:', error);
        if (loginError) {
            loginError.textContent = 'Network error. Please try again.';
        }
    } finally {
        // Reset loading state
        if (loginForm) {
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Login';
            }
        }
    }
}

// Check authentication status and update UI
function checkAuthStatus() {
    const token = localStorage.getItem('token');
    const isLoginPage = window.location.pathname.includes('login.html');
    const isRegisterPage = window.location.pathname.includes('register.html');

    // Don't redirect on login or register pages
    if (!token && !isLoginPage && !isRegisterPage) {
        // Store current page for redirect after login
        localStorage.setItem('loginRedirect', window.location.pathname.split('/').pop());
        window.location.href = 'login.html';
        return false;
    }

    // Redirect to main page if authenticated and on login page
    if (token && (isLoginPage || isRegisterPage)) {
        window.location.href = '/play';
        return true;
    }

    // Update UI based on authentication status
    if (token) {
        // Verify token with server
        verifyTokenWithServer(token).then(valid => {
            if (valid) {
                updateAuthUI();
            } else {
                // Token invalid, clear data and redirect to login
                clearClientAuthData();
                if (!isLoginPage && !isRegisterPage) {
                    window.location.href = 'login.html';
                }
            }
        }).catch(error => {
            console.error('Token verification error:', error);
            // On error, clear data and redirect to login
            clearClientAuthData();
            if (!isLoginPage && !isRegisterPage) {
                window.location.href = 'login.html';
            }
        });
        return true;
    }
    
    return false;
}

// Verify token with server
async function verifyTokenWithServer(token) {
    try {
        const response = await fetch('/api/auth/verify', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            // Update user info if provided
            if (data.user) {
                localStorage.setItem('userInfo', JSON.stringify(data.user));
            }
            return true;
        }
        return false;
    } catch (error) {
        console.error('Token verification error:', error);
        return false;
    }
}

// Update UI based on authentication status
function updateAuthUI() {
    const token = localStorage.getItem('token');
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{"username":"User"}');
    
    if (token && userInfo) {
        const authStatus = document.getElementById('auth-status');
        if (authStatus) {
            authStatus.innerHTML = `
                <span class="me-2">Welcome, ${userInfo.username}</span>
                <button id="logout-btn" class="btn btn-outline-light">Logout</button>
            `;
            
            // Add logout functionality
            const logoutBtn = document.getElementById('logout-btn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', function() {
                    performLogout();
                });
            }
        }
    }
}

// Perform server-side logout
async function performLogout() {
    try {
        const token = localStorage.getItem('token');
        
        if (token) {
            // Notify server of logout for session invalidation
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
        }
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        // Clear all client-side authentication data
        clearClientAuthData();
        window.location.href = 'login.html';
    }
}

// Utility function to get authentication token
function getToken() {
    return localStorage.getItem('token');
}

// Utility function to check if user is authenticated
function isAuthenticated() {
    const token = getToken();
    return token !== null && token !== undefined && token.trim() !== '';
}

// Utility function to get user information
function getUserInfo() {
    const userInfo = localStorage.getItem('userInfo');
    try {
        return userInfo ? JSON.parse(userInfo) : null;
    } catch (error) {
        console.error('Error parsing user info:', error);
        return null;
    }
}

// Utility function to get authorization headers
function getAuthHeaders() {
    const token = getToken();
    if (!token) {
        return {};
    }
    
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

// Utility function to make authenticated API requests
async function authenticatedFetch(url, options = {}) {
    if (!isAuthenticated()) {
        throw new Error('No authentication token available');
    }
    
    const defaultOptions = {
        headers: getAuthHeaders()
    };
    
    // Merge provided options with defaults
    const mergedOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...(options.headers || {})
        }
    };
    
    try {
        const response = await fetch(url, mergedOptions);
        
        // Handle 401 responses by redirecting to login
        if (response.status === 401) {
            console.warn('Authentication failed, redirecting to login');
            clearClientAuthData();
            window.location.href = 'login.html';
            throw new Error('Authentication required');
        }
        
        return response;
    } catch (error) {
        // If it's a network error or other issue, rethrow
        throw error;
    }
}

// Export functions for use in other modules
if (typeof window !== 'undefined') {
    window.getToken = getToken;
    window.isAuthenticated = isAuthenticated;
    window.getUserInfo = getUserInfo;
    window.getAuthHeaders = getAuthHeaders;
    window.authenticatedFetch = authenticatedFetch;
    window.clearClientAuthData = clearClientAuthData;
}
