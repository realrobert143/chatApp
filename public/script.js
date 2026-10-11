const signUpButton = document.getElementById('signUp');
const signInButton = document.getElementById('signIn');
const container = document.getElementById('container');

// Visual Sliding Transitions
signUpButton.addEventListener('click', () => {
    container.classList.add("right-panel-active");
});

signInButton.addEventListener('click', () => {
    container.classList.remove("right-panel-active");
});

// Automatically switch backend URL depending on environment
const BACKEND_URL = 'https://chatapp-hsyo.onrender.com' || 'http//localhost:5000'

// Handle Sign Up Submission
document.querySelector('.sign-up-container form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = e.target.querySelector('input[placeholder="Name"]').value;
    const email = e.target.querySelector('input[placeholder="Email"]').value;
    const password = e.target.querySelector('input[placeholder="Password"]').value;

    try {
        const response = await fetch(`${BACKEND_URL}/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();
        alert(data.message);
        
        if (response.ok) {
            e.target.reset();
            container.classList.remove("right-panel-active"); // Slide back to Sign In
        }
    } catch (error) {
        console.error('Error during sign up:', error);
        alert('Could not connect to the backend server.');
    }
});

// Handle Sign In Submission
document.querySelector('.sign-in-container form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = e.target.querySelector('input[placeholder="Email"]').value;
    const password = e.target.querySelector('input[placeholder="Password"]').value;

    try {
        const response = await fetch(`${BACKEND_URL}/signin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        alert(data.message);

        // Find your existing Sign In form submission event inside script.js and update this portion:
if (response.ok) {
    // 1. Save user info to the browser's local storage session layer
    localStorage.setItem('currentUser', JSON.stringify(data.user));
    
    // 2. Instantly redirect browser page routing context to the new dash view
    window.location.href = 'dashboard.html';
}

    } catch (error) {
        console.error('Error during sign in:', error);
        alert('Could not connect to the backend server.');
    }
});
