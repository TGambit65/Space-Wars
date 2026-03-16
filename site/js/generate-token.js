// Script to generate a token for authenticated users
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is authenticated
    const isAuthenticated = localStorage.getItem('sw3000_authenticated') === 'true';
    
    // If authenticated but no token exists, generate one
    if (isAuthenticated && !localStorage.getItem('token')) {
        const token = 'demo_token_' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('token', token);
        console.log('Generated token for authenticated user');
    }
});
