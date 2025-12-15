// =====================================================
// auth.js - Authentication Module
// =====================================================

// Check if user is authenticated
function checkAuth() {
    if (!isLoggedIn()) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// Check login status
function isLoggedIn() {
    const session = localStorage.getItem('atl_session');
    if (!session) return false;
    
    try {
        const sessionData = JSON.parse(session);
        const now = new Date().getTime();
        
        if (sessionData.expiry && now < sessionData.expiry) {
            return true;
        } else {
            localStorage.removeItem('atl_session');
            return false;
        }
    } catch (e) {
        localStorage.removeItem('atl_session');
        return false;
    }
}

// Get session data
function getSession() {
    const session = localStorage.getItem('atl_session');
    if (!session) return null;
    
    try {
        return JSON.parse(session);
    } catch (e) {
        return null;
    }
}

// Update session info display
function updateSessionInfo() {
    const sessionInfo = document.getElementById('sessionInfo');
    if (!sessionInfo) return;
    
    const session = getSession();
    if (session && session.loginTime) {
        const loginDate = new Date(session.loginTime);
        const expiryDate = new Date(session.expiry);
        const now = new Date();
        
        const timeRemaining = expiryDate - now;
        const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));
        const daysRemaining = Math.floor(hoursRemaining / 24);
        
        let remainingText = '';
        if (daysRemaining > 0) {
            remainingText = `${daysRemaining} day${daysRemaining > 1 ? 's' : ''} remaining`;
        } else if (hoursRemaining > 0) {
            remainingText = `${hoursRemaining} hour${hoursRemaining > 1 ? 's' : ''} remaining`;
        } else {
            remainingText = 'Session expiring soon';
        }
        
        sessionInfo.textContent = `Logged in ${formatTimeAgo(loginDate)} • ${remainingText}`;
    }
}

// Format time ago
function formatTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

// Logout function
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('atl_session');
        window.location.href = 'login.html';
    }
}

// Force logout (without confirmation)
function forceLogout() {
    localStorage.removeItem('atl_session');
    window.location.href = 'login.html';
}

// Show change password modal
function showChangePasswordModal() {
    document.getElementById('changePasswordModal').classList.add('show');
    document.getElementById('currentPassword').focus();
}

// Close change password modal
function closeChangePasswordModal() {
    document.getElementById('changePasswordModal').classList.remove('show');
    document.getElementById('changePasswordForm').reset();
    document.getElementById('passwordError').textContent = '';
}

// Handle password change
async function handleChangePassword(event) {
    event.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const errorDiv = document.getElementById('passwordError');
    
    // Validate
    if (newPassword !== confirmPassword) {
        errorDiv.textContent = '❌ New passwords do not match';
        errorDiv.style.color = '#dc2626';
        return;
    }
    
    if (newPassword.length < 4) {
        errorDiv.textContent = '❌ Password must be at least 4 characters';
        errorDiv.style.color = '#dc2626';
        return;
    }
    
    if (newPassword === currentPassword) {
        errorDiv.textContent = '❌ New password must be different from current password';
        errorDiv.style.color = '#dc2626';
        return;
    }
    
    errorDiv.textContent = '⏳ Changing password...';
    errorDiv.style.color = '#6b7280';
    
    try {
        const url = new URL(API_URL);
        url.searchParams.append('action', 'changePassword');
        url.searchParams.append('currentPassword', currentPassword);
        url.searchParams.append('newPassword', newPassword);
        
        const response = await fetch(url.toString());
        const result = await response.json();
        
        if (result.success) {
            errorDiv.textContent = '✅ Password changed successfully! Please login again.';
            errorDiv.style.color = '#16a34a';
            
            setTimeout(() => {
                forceLogout();
            }, 2000);
        } else {
            errorDiv.textContent = '❌ ' + (result.error || 'Failed to change password');
            errorDiv.style.color = '#dc2626';
        }
    } catch (error) {
        console.error('Error changing password:', error);
        errorDiv.textContent = '❌ Connection error. Please try again.';
        errorDiv.style.color = '#dc2626';
    }
}

// Auto-logout when session expires
function startSessionMonitor() {
    setInterval(() => {
        if (!isLoggedIn()) {
            alert('Your session has expired. Please login again.');
            forceLogout();
        }
    }, 60000); // Check every minute
}

// Start session monitor
if (typeof window !== 'undefined') {
    startSessionMonitor();
}
