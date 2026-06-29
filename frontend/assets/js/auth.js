/**
 * Farelanceru Frontend Authentication Flow Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');

  // --- AUTO LOGIN SECURITY ---
  // If the user already has a valid active token/session and is visiting login or register,
  // redirect them directly to their role-appropriate dashboard to prevent redundant logins.
  const currentPath = window.location.pathname;
  if (token && userStr && (currentPath === '/login' || currentPath === '/register' || currentPath.endsWith('login.html') || currentPath.endsWith('register.html'))) {
    try {
      window.location.href = '/dashboard';
      return;
    } catch (e) {
      // Clear corrupt state
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }

  // --- DETECT PASSWORD RESET SUCCESS ALERT ---
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('reset_success') === 'true') {
    const successDisplay = document.getElementById('login-success');
    if (successDisplay) {
      successDisplay.textContent = 'Password reset successfully! Please sign in with your new password.';
      successDisplay.style.display = 'block';
    }
  }

  // --- LOGIN SUBMIT WITH ROBUST FEEDBACK ---
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    const errorDisplay = document.getElementById('login-error');
    const submitBtn = document.getElementById('btn-login');

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Clear previous error messages
      if (errorDisplay) {
        errorDisplay.style.display = 'none';
        errorDisplay.textContent = '';
      }

      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      // 1. Validation
      if (!email || !password) {
        showErrorMsg(errorDisplay, 'Required fields missing: Please enter both email and password.');
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showErrorMsg(errorDisplay, 'Email Validation Error: Please enter a correct email structure (e.g. user@example.com).');
        return;
      }

      // 2. Set Loading State
      const originalBtnText = submitBtn ? submitBtn.textContent : 'Sign In to Workspace';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Verifying security credentials...';
        submitBtn.style.opacity = '0.7';
      }

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email, password })
        });

        const result = await res.json();

        if (result.success) {
          if (typeof showToast === 'function') {
            showToast('Sign in verification successful! Welcome back...', 'success');
          }
          
          // Persist token & user metadata in LocalStorage
          localStorage.setItem('token', result.data.token);
          localStorage.setItem('user', JSON.stringify(result.data.user));
          
          // Secure cookie for transparent backend middleware permissions check
          document.cookie = `token=${result.data.token}; path=/; max-age=${7 * 24 * 60 * 60}; Secure; SameSite=None;`;

          // Staggered redirect for satisfying user transition animation
          setTimeout(() => {
            window.location.href = result.data.redirectUrl || '/dashboard';
          }, 1000);
        } else {
          // Reset button state on failure
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
            submitBtn.style.opacity = '1';
          }
          if (result.requireVerification && result.email) {
            const redirectLink = `/verify-otp?email=${encodeURIComponent(result.email)}&flow=register`;
            showErrorMsg(errorDisplay, `${result.message} <a href="${redirectLink}" style="color: var(--primary); font-weight: 700; text-decoration: underline; margin-left: 5px;">Verify Now &rarr;</a>`);
          } else {
            showErrorMsg(errorDisplay, result.message || 'Log in failed. Double check your email and password.');
          }
        }
      } catch (err) {
        console.error('Login submit exception: ', err);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalBtnText;
          submitBtn.style.opacity = '1';
        }
        showErrorMsg(errorDisplay, 'Connection error. Unable to synchronize with the authentication servers.');
      }
    });
  }

  // --- REGISTER SUBMIT WITH ROBUST FEEDBACK ---
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    const errorDisplay = document.getElementById('register-error');
    const submitBtn = registerForm.querySelector('button[type="submit"]');

    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Clear previous error messages
      if (errorDisplay) {
        errorDisplay.style.display = 'none';
        errorDisplay.textContent = '';
      }

      const firstName = document.getElementById('reg-firstname').value.trim();
      const lastName = document.getElementById('reg-lastname').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;
      const confirmPassword = document.getElementById('reg-confirmpassword').value;
      const role = document.getElementById('reg-role').value;

      // 1. Client-Side Input Validations
      if (!firstName || !lastName || !email || !password || !confirmPassword || !role) {
        showErrorMsg(errorDisplay, 'Validation Failed: All registration credentials are required.');
        return;
      }

      if (password !== confirmPassword) {
        showErrorMsg(errorDisplay, 'Validation Failed: Passwords do not match.');
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showErrorMsg(errorDisplay, 'Validation Failed: Please specify a valid email syntax structure.');
        return;
      }

      if (password.length < 8) {
        showErrorMsg(errorDisplay, 'Validation Failed: Password is too weak! Must contain at least 8 characters.');
        return;
      }

      // 2. Set Button Loading State
      const originalBtnText = submitBtn ? submitBtn.textContent : 'Create Account';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Publishing credentials...';
        submitBtn.style.opacity = '0.7';
      }

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ firstName, lastName, email, password, confirmPassword, role })
        });

        const result = await res.json();

        if (result.success) {
          if (typeof showToast === 'function') {
            showToast('Account registered! OTP verification code has been sent.', 'success');
          }
          
          sessionStorage.setItem('reset_email', email);

          setTimeout(() => {
            window.location.href = `/verify-otp?email=${encodeURIComponent(email)}&flow=register`;
          }, 1500);
        } else {
          // Reset button state
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
            submitBtn.style.opacity = '1';
          }
          showErrorMsg(errorDisplay, result.message || 'Onboarding failed due to server rejection.');
        }
      } catch (err) {
        console.error('Register submit exception: ', err);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalBtnText;
          submitBtn.style.opacity = '1';
        }
        showErrorMsg(errorDisplay, 'Connection error. Unable to establish a secure link to the server.');
      }
    });
  }

  // Utility to display errors inline nicely
  function showErrorMsg(element, msg) {
    if (element) {
      element.innerHTML = msg;
      element.style.display = 'block';
    }
    if (typeof showToast === 'function') {
      showToast(msg, 'error');
    }
  }

  // --- FORGOT / RESET PASSWORD CODE HANDLING ---
  const forgotTrigger = document.getElementById('forgot-password-trigger');
  const forgotModal = document.getElementById('forgot-password-modal');
  const closeForgotBtn = document.getElementById('btn-close-forgot-modal');
  const forgotSendForm = document.getElementById('forgot-send-form');
  const forgotResetForm = document.getElementById('forgot-reset-form');
  
  const stepSend = document.getElementById('forgot-step-send');
  const stepReset = document.getElementById('forgot-step-reset');
  const sandboxPinDisplay = document.getElementById('sandbox-reset-pin');
  
  let registeredForgotEmail = '';

  if (forgotTrigger) {
    forgotTrigger.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = '/forgot-password';
    });
  }

  if (closeForgotBtn && forgotModal) {
    closeForgotBtn.addEventListener('click', () => {
      forgotModal.classList.remove('active');
    });
  }

  // Handle forgot PIN email submission
  if (forgotSendForm) {
    forgotSendForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('forgot-email-input').value.trim();
      if (!email) return;

      try {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const result = await res.json();
        
        if (result.success) {
          registeredForgotEmail = email;
          showToast('Security PIN generated successfully!', 'success');
          
          if (stepSend) stepSend.style.display = 'none';
          if (stepReset) stepReset.style.display = 'block';
          if (sandboxPinDisplay && result.data && result.data.testPin) {
            sandboxPinDisplay.textContent = result.data.testPin;
          }
        } else {
          showToast(result.message || 'Error executing forgot password lookup', 'error');
        }
      } catch (err) {
        console.error(err);
        showToast('Server communications timeout', 'error');
      }
    });
  }

  // Handle forgot reset submit
  if (forgotResetForm) {
    forgotResetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = document.getElementById('forgot-pin-input').value.trim();
      const newPassword = document.getElementById('forgot-new-password').value;

      if (!code || !newPassword) {
        showToast('All fields are required.', 'error');
        return;
      }

      try {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: registeredForgotEmail,
            resetCode: code,
            newPassword: newPassword
          })
        });
        const result = await res.json();

        if (result.success) {
          showToast('Password updated! Redirecting...', 'success');
          if (forgotModal) forgotModal.classList.remove('active');
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          showToast(result.message || 'Reset password action failed.', 'error');
        }
      } catch (err) {
        console.error(err);
        showToast('Server connection failed.', 'error');
      }
    });
  }

  // --- GOOGLE OAUTH POPUP FLOW ---
  const googleBtn = document.getElementById('btn-google-login');
  if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/auth/google/url');
        const data = await res.json();
        if (data.success && data.data.url) {
          // Open popup window
          const authWindow = window.open(
            data.data.url,
            'google_oauth_popup',
            'width=500,height=600,status=no,toolbar=no,menubar=no,location=no'
          );
          if (!authWindow) {
            alert('Popup was blocked by your browser. Please allow popups for this site.');
          }
        } else {
          alert('Failed to obtain Google login link.');
        }
      } catch (err) {
        console.error('Google oauth URL trigger error:', err);
        alert('Server connection error while starting Google Sign In.');
      }
    });
  }

  // --- FACEBOOK OAUTH POPUP FLOW ---
  const facebookBtn = document.getElementById('btn-facebook-login');
  if (facebookBtn) {
    facebookBtn.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/auth/facebook/url');
        const data = await res.json();
        if (data.success && data.data.url) {
          // Open popup window
          const authWindow = window.open(
            data.data.url,
            'facebook_oauth_popup',
            'width=500,height=600,status=no,toolbar=no,menubar=no,location=no'
          );
          if (!authWindow) {
            alert('Popup was blocked by your browser. Please allow popups for this site.');
          }
        } else {
          alert('Failed to obtain Facebook login link.');
        }
      } catch (err) {
        console.error('Facebook oauth URL trigger error:', err);
        alert('Server connection error while starting Facebook Sign In.');
      }
    });
  }

  // Listen for message event from Google or Facebook OAuth popup window
  window.addEventListener('message', (event) => {
    const origin = event.origin;
    if (!origin.endsWith('.run.app') && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
      return;
    }
    if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
      const token = event.data.token;
      const user = event.data.user;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      document.cookie = `token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; Secure; SameSite=None;`;

      if (typeof showToast === 'function') {
        showToast('Successfully signed in through secure OAuth!', 'success');
      }
      setTimeout(() => {
        window.location.href = user.role === 'admin' ? '/admin' : '/dashboard';
      }, 1000);
    }
  });
});

/**
 * Global Page Route Guard
 * Used to protect secure client-side pages (e.g. /dashboard or /admin).
 * Redirects unauthorized requests or expired user sessions back to /login safely.
 */
window.checkGuardAuth = function() {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');

  if (!token || !userStr) {
    if (typeof showToast === 'function') {
      showToast('Session cleared. Please sign in to access your workspace.', 'error');
    }
    setTimeout(() => {
      window.location.href = '/login';
    }, 1000);
    return false;
  }

  // Check if role has admin permissions on high-clearance routes
  try {
    const user = JSON.parse(userStr);
    const path = window.location.pathname;

    // Standard promotion of admin emails
    const cleanEmail = user && user.email ? user.email.trim().toLowerCase() : '';
    const isAdmin = cleanEmail === 'raisheraz7181@gmail.com' || cleanEmail === 'ficerdigitalagency@gmail.com' || (user && user.role === 'admin');
    if (isAdmin && user) {
      user.role = 'admin';
      localStorage.setItem('user', JSON.stringify(user));
    }

    if (path.includes('admin')) {
      if (!isAdmin) {
        if (typeof showToast === 'function') {
          showToast('Access Denied. Redirecting...', 'error');
        }
        setTimeout(() => {
          window.location.href = '/access-denied';
        }, 800);
        return false;
      }
    }
  } catch (e) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    return false;
  }

  return true;
};
