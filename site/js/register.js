// Space Wars 3000 Registration System

document.addEventListener('DOMContentLoaded', function() {
    // Check if user is already authenticated
    const isAuthenticated = localStorage.getItem('sw3000_authenticated') === 'true';
    if (isAuthenticated) {
        window.location.href = 'index.html';
        return;
    }
    
    // Registration form submission
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const username = document.getElementById('register-username').value;
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;
            const confirmPassword = document.getElementById('register-confirm-password').value;
            const errorElement = document.getElementById('register-error');
            
            // Basic validation
            if (password !== confirmPassword) {
                errorElement.textContent = 'Passwords do not match';
                return;
            }
            
            if (password.length < 6) {
                errorElement.textContent = 'Password must be at least 6 characters long';
                return;
            }
            
            // In a real application, we would make an API call to register the user
            // For this demo, we'll simulate a successful registration
            try {
                // Simulate API call
                setTimeout(function() {
                    // Store user info
                    const userInfo = {
                        username: username,
                        email: email,
                        role: 'player',
                        lastLogin: new Date().toISOString()
                    };
                    
                    localStorage.setItem('userInfo', JSON.stringify(userInfo));
                    localStorage.setItem('token', 'demo_token_' + Math.random().toString(36).substring(2, 15));
                    
                    // Set as authenticated
                    localStorage.setItem('sw3000_authenticated', 'true');
                    
                    // Show success message
                    alert('Registration successful! Welcome aboard, ' + username + '!');
                    
                    // Check if there's a redirect target stored
                    const redirectTarget = localStorage.getItem('loginRedirect');
                    if (redirectTarget) {
                        localStorage.removeItem('loginRedirect'); // Clear the redirect
                        window.location.href = redirectTarget;
                    } else {
                        window.location.href = 'index.html';
                    }
                }, 1000);
            } catch (error) {
                console.error('Registration error:', error);
                errorElement.textContent = 'Registration failed. Please try again.';
            }
        });
    }
});
