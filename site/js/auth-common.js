// Check login status and update UI accordingly (UI only, no redirects)
function updateAuthUI() {
    const isAuthenticated = localStorage.getItem('sw3000_authenticated') === 'true';
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    
    // Update login/logout link
    const loginLink = document.getElementById('loginLink');
    if (loginLink) {
        if (isAuthenticated) {
            loginLink.textContent = 'Logout';
            loginLink.href = '#';
            loginLink.addEventListener('click', function(e) {
                e.preventDefault();
                localStorage.removeItem('sw3000_authenticated');
                localStorage.removeItem('userInfo');
                window.location.href = 'index.html';
            });
        } else {
            loginLink.textContent = 'Login';
            loginLink.href = 'login.html';
        }
    }
    
    // Show/hide user-specific elements
    const userElements = document.querySelectorAll('.user-only');
    const guestElements = document.querySelectorAll('.guest-only');
    const adminElements = document.querySelectorAll('.admin-only');
    
    userElements.forEach(el => {
        el.style.display = isAuthenticated ? 'block' : 'none';
    });
    
    guestElements.forEach(el => {
        el.style.display = isAuthenticated ? 'none' : 'block';
    });
    
    adminElements.forEach(el => {
        el.style.display = (isAuthenticated && userInfo.role === 'admin') ? 'block' : 'none';
    });
    
    return isAuthenticated;
}

// Set authentication state
function setAuthenticated(value) {
    localStorage.setItem('sw3000_authenticated', value);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    updateAuthUI();
});
