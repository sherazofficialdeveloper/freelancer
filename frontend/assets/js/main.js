/**
 * Farelanceru Central JS Utility Service
 */

// Safely configure global window.fetch to be configurable and writable
// This prevents "Cannot set property fetch of #<Window> which has only a getter"
// errors caused by standard browser extensions or integration frame proxy wrappers.
(function() {
  try {
    const originalFetch = window.fetch;
    let currentFetch = originalFetch;
    Object.defineProperty(window, 'fetch', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: originalFetch
    });
    // Fallback if writable/value definition has issues in some contexts
    const testDesc = Object.getOwnPropertyDescriptor(window, 'fetch');
    if (!testDesc || !testDesc.writable) {
      Object.defineProperty(window, 'fetch', {
        configurable: true,
        enumerable: true,
        get: () => currentFetch,
        set: (val) => { currentFetch = val; }
      });
    }
  } catch (e) {
    console.warn("Fetch property guard bypass: ", e);
  }
})();

// Global state holding
window.FarelanceruState = {
  token: null,
  user: null
};

// Simple Cookie Parsing Helper
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

// Global Alert Notification Service
function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'notification-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `notification-toast toast-${type}`;
  
  // Set icons based on alert type
  let icon = '📌';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '❌';
  if (type === 'warning') icon = '⚠️';

  toast.innerHTML = `
    <div style="font-size: 18px;">${icon}</div>
    <div style="flex-grow: 1;">
      <p style="font-size: 13px; font-weight: 600; color: #1e293b; margin: 0;">${message}</p>
    </div>
  `;

  container.appendChild(toast);

  // Auto-remove after 4 seconds
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse forwards';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4400);
}

// Instate Session Checks
function initializeAuth() {
  const localToken = localStorage.getItem('token') || getCookie('token');
  const localUserStr = localStorage.getItem('user');

  if (localToken && localUserStr) {
    window.FarelanceruState.token = localToken;
    try {
      window.FarelanceruState.user = JSON.parse(localUserStr);
      if (window.FarelanceruState.user && window.FarelanceruState.user.email) {
        const cleanEmail = window.FarelanceruState.user.email.trim().toLowerCase();
        if (cleanEmail === 'maqboolusama9@gmail.com' || cleanEmail === 'usamamaqboolassiii@gmail.com' || window.FarelanceruState.user.role === 'admin') {
          if (window.FarelanceruState.user.role !== 'admin') {
            window.FarelanceruState.user.role = 'admin';
            localStorage.setItem('user', JSON.stringify(window.FarelanceruState.user));
          }
        }
      }
    } catch (e) {
      window.FarelanceruState.user = null;
    }
  }
}

// Log Session Sign-out
function performLogout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  document.cookie = 'token=; Max-Age=0; path=/';
  showToast('Logged out successfully. Redirecting...', 'success');
  setTimeout(() => {
    window.location.href = '/';
  }, 1000);
}

// Load global structural layout components (Navbar, Footer)
async function bootstrapLayout() {
  initializeAuth();

  const path = window.location.pathname;
  const isAuthPage = path === '/login' || path === '/register';

  // 1. Inject Navbar
  const navPlaceholder = document.getElementById('navbar-placeholder');
  if (navPlaceholder) {
    if (isAuthPage) {
      // Inject Minimal Clean Header for Auth Pages with top-left Back Button
      navPlaceholder.innerHTML = `
        <header class="navbar-main auth-navbar" style="background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(12px); border-bottom: 1px solid var(--gray-200); position: sticky; top: 0; z-index: 1000; padding: 14px 0;">
          <div class="container navbar-p" style="display: flex; align-items: center; justify-content: space-between;">
            <!-- Top-left Back Button with Back Icon & Smooth Hover -->
            <a href="javascript:history.length > 2 ? history.back() : window.location.href='/'" class="btn-back-header" style="display: inline-flex; align-items: center; gap: 8px; font-weight: 600; font-size: 14px; color: var(--gray-700); transition: all 0.2s ease;">
              <i class="fa-solid fa-arrow-left" style="font-size: 15px;"></i> Back
            </a>
            
            <!-- Minimal Clean Logo -->
            <a href="/" class="logo-link" style="display: flex; align-items: center; gap: 8px; font-size: 20px; font-weight: 800; font-family: var(--font-heading);">
              <div class="logo-orb" style="width: 28px; height: 28px; border-radius: 50%; background: var(--gradient);"></div>
              <span class="text-gradient">Skillnest</span>
            </a>
            
            <!-- Right side spacer or minimal security icon -->
            <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--gray-600); font-weight: 600;">
              <i class="fa-solid fa-lock" style="color: var(--primary); font-size: 14px;"></i> Secure Gateway
            </div>
          </div>
        </header>
      `;
    } else {
      try {
        const resp = await fetch('/components/navbar.html');
        if (resp.ok) {
          navPlaceholder.innerHTML = await resp.text();
          
          // Setup active link highlight
          const currentPath = window.location.pathname;
          const urlParams = new URLSearchParams(window.location.search);
          const mode = urlParams.get('mode');
          
          if (currentPath.includes('/jobs')) {
            if (mode === 'services') {
              document.getElementById('nav-item-gigs')?.classList.add('active');
            } else {
              document.getElementById('nav-item-jobs')?.classList.add('active');
            }
          } else if (currentPath.includes('/freelancers')) {
            document.getElementById('nav-item-freelancers')?.classList.add('active');
          } else if (currentPath.includes('/blogs')) {
            document.getElementById('nav-item-blogs')?.classList.add('active');
          } else if (currentPath.includes('/contact')) {
            document.getElementById('nav-item-contact')?.classList.add('active');
          } else if (currentPath.includes('/about')) {
            document.getElementById('nav-item-about')?.classList.add('active');
          }

          // Setup Scroll effect
          window.addEventListener('scroll', () => {
            const header = document.getElementById('platform-navbar');
            if (header) {
              if (window.scrollY > 15) {
                header.classList.add('scrolled');
              } else {
                header.classList.remove('scrolled');
              }
            }
          });

          // Setup Mobile hamburger triggers and overlay selectors
          const hamburgerTrigger = document.getElementById('mobile-hamburger-trigger');
          const drawerClose = document.getElementById('mobile-drawer-close');
          const drawerOverlay = document.getElementById('mobile-drawer-overlay');
          const drawer = document.getElementById('mobile-drawer');

          const toggleDrawer = (open) => {
            if (open) {
              drawer?.classList.add('active');
              drawerOverlay?.classList.add('active');
              document.body.style.overflow = 'hidden';
            } else {
              drawer?.classList.remove('active');
              drawerOverlay?.classList.remove('active');
              document.body.style.overflow = '';
            }
          };

          hamburgerTrigger?.addEventListener('click', () => toggleDrawer(true));
          drawerClose?.addEventListener('click', () => toggleDrawer(false));
          drawerOverlay?.addEventListener('click', () => toggleDrawer(false));

          configureNavbarProfile();
        }
      } catch (err) {
        console.error('Navbar element inject failed: ', err);
      }
    }
  }

  // 2. Inject Footer
  if (!isAuthPage) {
    const footerPlaceholder = document.getElementById('footer-placeholder');
    if (footerPlaceholder) {
      try {
        const resp = await fetch('/components/footer.html');
        if (resp.ok) {
          footerPlaceholder.innerHTML = await resp.text();
        }
      } catch (err) {
        console.error('Footer element inject failed: ', err);
      }
    }
  }

  // 3. Initialize Lazy animations and Dynamic Button Ripple system post render
  if (typeof setupLazyAnimationObserver === 'function') {
    setupLazyAnimationObserver();
  }
  if (typeof setupButtonRipples === 'function') {
    setupButtonRipples();
  }

  // 4. Inject global premium Quick Message system modal elements
  if (typeof window.injectQuickMessageModal === 'function') {
    window.injectQuickMessageModal();
  }
}

// -------------------------------------------------------------
// GLOBAL PREMIUM QUICK MESSAGE SYSTEM
// -------------------------------------------------------------
let currentQuickReceiverId = null;

window.injectQuickMessageModal = function() {
  if (document.getElementById('quick-message-modal-container')) return;

  const modalHtml = `
    <!-- Floating docking Quick Message Box -->
    <div id="quick-message-modal-container" style="
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 360px;
      max-width: calc(100vw - 48px);
      background: white;
      border-radius: 16px;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
      border: 1px solid var(--gray-200);
      z-index: 10000;
      opacity: 0;
      transform: translateY(40px) scale(0.95);
      pointer-events: none;
      transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    ">
      <!-- Header -->
      <div style="background: var(--gradient); padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; color: white;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div id="quick-msg-avatar" style="width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; border: 1px solid rgba(255,255,255,0.4); overflow: hidden; background-size: cover; background-position: center; flex-shrink: 0;">
            FL
          </div>
          <div>
            <strong id="quick-msg-username" style="display: block; font-size: 14.5px; letter-spacing: -0.2px; font-weight: 700;">@freelancer</strong>
            <span id="quick-msg-title" style="font-size: 11px; opacity: 0.85; display: block; font-weight: 500;">Active Specialist</span>
          </div>
        </div>
        <button onclick="window.closeQuickMessageModal()" style="background: none; border: none; color: white; cursor: pointer; padding: 6px; border-radius: 50%; transition: background-color 0.2s; display: flex; align-items: center; justify-content: center;" onmouseover="this.style.backgroundColor='rgba(255,255,255,0.15)'" onmouseout="this.style.backgroundColor='transparent'">
          <i class="fa-solid fa-xmark" style="font-size: 15px;"></i>
        </button>
      </div>

      <!-- Messages Stream Preview window -->
      <div id="quick-msg-body" style="flex-grow: 1; min-height: 140px; max-height: 180px; padding: 16px; overflow-y: auto; background-color: var(--gray-50); display: flex; flex-direction: column; gap: 12px; scrollbar-width: thin;">
        <div style="padding: 10px 12px; background: rgba(168, 85, 247, 0.08); border-radius: 12px; text-align: center; border: 1px dashed rgba(168, 85, 247, 0.25);">
          <p style="font-size: 11.5px; color: var(--gray-600); margin: 0; line-height: 1.4;">
            <i class="fa-solid fa-shield-halved" style="color: var(--primary); margin-right: 4px;"></i> Use Skillnest secure direct escrow messaging to lock workspace details safely.
          </p>
        </div>
        <div id="quick-msg-history" style="display: flex; flex-direction: column; gap: 10px;"></div>
      </div>

      <!-- Footer Inputs Form -->
      <div style="padding: 12px 14px; border-top: 1px solid var(--gray-100); background: white;">
        <div style="display: flex; gap: 8px; align-items: center;">
          <input type="text" id="quick-msg-input" placeholder="Type a message detail..." style="
            flex-grow: 1;
            border: 1px solid var(--gray-200);
            border-radius: 20px;
            padding: 9px 15px;
            font-size: 13px;
            background: var(--gray-50);
            color: var(--dark);
            outline: none;
            transition: all 0.2s;
          " onfocus="this.style.borderColor='var(--primary)'; this.style.boxShadow='0 0 0 2px rgba(168, 85, 247, 0.15)'" onblur="this.style.borderColor='var(--gray-200)'; this.style.boxShadow='none'">
          <button id="quick-msg-submit-btn" onclick="window.sendQuickMessage()" style="
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: var(--gradient);
            color: white;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            cursor: pointer;
            border: none;
            transition: transform 0.2s;
          " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'" title="Send message">
            <i class="fa-solid fa-paper-plane" style="font-size: 11px;"></i>
          </button>
        </div>
      </div>
    </div>
  `;

  const div = document.createElement('div');
  div.innerHTML = modalHtml;
  document.body.appendChild(div.firstElementChild);

  // Wire Enter trigger
  document.getElementById('quick-msg-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      window.sendQuickMessage();
    }
  });
};

// -------------------------------------------------------------
// SECURE LOGIN ENFORCEMENT MODAL (Fiverr style conversion)
// -------------------------------------------------------------
window.showLoginRequiredModal = function(actionType = 'access this feature') {
  if (document.getElementById('login-required-modal-overlay')) {
    document.getElementById('login-required-modal-overlay').remove();
  }

  const modalHtml = `
    <div id="login-required-modal-overlay" style="
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 11000;
      opacity: 0;
      transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    ">
      <div style="
        background: white;
        width: 440px;
        max-width: calc(100vw - 32px);
        border-radius: 20px;
        border: 1px solid rgba(168, 85, 247, 0.2);
        box-shadow: 0 25px 50px -12px rgba(168, 85, 247, 0.25);
        padding: 32px;
        text-align: center;
        position: relative;
        transform: translateY(20px) scale(0.95);
        transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      " id="login-required-card">
        
        <!-- Large visual lock icon with pulsing glow -->
        <div style="
          width: 72px; height: 72px;
          background: rgba(168, 85, 247, 0.08);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          color: var(--primary);
          font-size: 28px;
          border: 1px solid rgba(168, 85, 247, 0.15);
          box-shadow: 0 0 15px rgba(168, 85, 247, 0.1);
        ">
          <i class="fa-solid fa-lock-open-transition fa-lock"></i>
        </div>

        <h3 style="font-size: 22px; font-weight: 800; color: var(--dark); margin-bottom: 8px; font-family: var(--font-heading); letter-spacing: -0.5px;">Login Required</h3>
        <p style="font-size: 14px; color: var(--gray-600); line-height: 1.5; margin-bottom: 24px;">
          You need an active Skillnest account to <strong>${actionType}</strong>. Join our secure escrow ecosystem instantly today.
        </p>

        <!-- CTA Buttons -->
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <a href="/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}" class="btn btn-primary" style="
            display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: bold; padding: 12px; border-radius: 12px; font-size: 14.5px;
          ">
            <i class="fa-solid fa-right-to-bracket"></i> Sign In to Skillnest
          </a>
          <a href="/register" class="btn btn-secondary" style="
            display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: bold; padding: 12px; border-radius: 12px; font-size: 14.5px; background: white; border-color: var(--gray-300); color: var(--dark);
          ">
            <i class="fa-solid fa-user-plus"></i> Join as Member (Free)
          </a>
        </div>

        <!-- Dismiss button link -->
        <button onclick="window.closeLoginRequiredModal()" style="
          background: none; border: none; color: var(--gray-500); font-weight: 600; font-size: 13px; margin-top: 18px; cursor: pointer; text-decoration: underline; transition: color 0.2s;
        " onmouseover="this.style.color='var(--dark)'" onmouseout="this.style.color='var(--gray-500)'">
          Inquire as Guest
        </button>

        <!-- Absolute Close button -->
        <button onclick="window.closeLoginRequiredModal()" style="
          position: absolute; top: 16px; right: 16px; background: none; border: none; font-size: 16px; color: var(--gray-400); cursor: pointer; transition: color 0.2s;
        " onmouseover="this.style.color='var(--dark)'" onmouseout="this.style.color='var(--gray-400)'">
          <i class="fa-solid fa-xmark"></i>
        </button>

      </div>
    </div>
  `;

  const container = document.createElement('div');
  container.innerHTML = modalHtml;
  document.body.appendChild(container.firstElementChild);

  const overlay = document.getElementById('login-required-modal-overlay');
  const card = document.getElementById('login-required-card');

  setTimeout(() => {
    if (overlay && card) {
      overlay.style.opacity = '1';
      card.style.transform = 'translateY(0) scale(1)';
    }
  }, 30);
};

window.closeLoginRequiredModal = function() {
  const overlay = document.getElementById('login-required-modal-overlay');
  const card = document.getElementById('login-required-card');
  if (!overlay) return;

  overlay.style.opacity = '0';
  if (card) {
    card.style.transform = 'translateY(20px) scale(0.95)';
  }
  setTimeout(() => {
    overlay.remove();
  }, 300);
};

window.openMessageModal = function(freelancerId, name = '', avatar = '') {
  // STRICT USER INTENT/GUEST FLOW CHECK
  const token = window.FarelanceruState?.token;
  if (!token) {
    window.showLoginRequiredModal('message this freelancer');
    return;
  }

  // Ensure DOM elements are created
  window.injectQuickMessageModal();
  
  currentQuickReceiverId = freelancerId;

  const modal = document.getElementById('quick-message-modal-container');
  if (!modal) return;

  // Set receiver details
  const displayUsername = name ? `@${name.replace(/^@/, '')}` : `@user_${freelancerId.substring(0, 5)}`;
  document.getElementById('quick-msg-username').textContent = displayUsername;

  const avatarEl = document.getElementById('quick-msg-avatar');
  if (avatarEl) {
    if (avatar && (avatar.startsWith('http') || avatar.startsWith('/'))) {
      avatarEl.style.backgroundImage = `url('${avatar}')`;
      avatarEl.textContent = '';
    } else {
      avatarEl.style.backgroundImage = 'none';
      avatarEl.textContent = (name || 'FL').substring(0, 2).toUpperCase();
    }
  }

  // Pure clean chat preview history reset
  const historyList = document.getElementById('quick-msg-history');
  if (historyList) {
    historyList.innerHTML = '';
  }

  // Reveal box
  modal.style.opacity = '1';
  modal.style.pointerEvents = 'auto';
  modal.style.transform = 'translateY(0) scale(1)';

  // Focus input
  setTimeout(() => {
    document.getElementById('quick-msg-input')?.focus();
  }, 150);
};

window.closeQuickMessageModal = function() {
  const modal = document.getElementById('quick-message-modal-container');
  if (!modal) return;

  modal.style.opacity = '0';
  modal.style.pointerEvents = 'none';
  modal.style.transform = 'translateY(40px) scale(0.95)';
};

window.sendQuickMessage = async function() {
  const input = document.getElementById('quick-msg-input');
  if (!input) return;

  const text = input.value.trim();
  if (!text) return;

  const historyList = document.getElementById('quick-msg-history');
  if (!historyList) return;

  // Append user message immediately (client side preview)
  const userBubble = document.createElement('div');
  userBubble.style.cssText = `
    align-self: flex-end;
    background: var(--gradient);
    color: white;
    padding: 8px 12px;
    border-radius: 12px 12px 0 12px;
    max-width: 80%;
    font-size: 12.5px;
    line-height: 1.4;
    box-shadow: var(--shadow-sm);
  `;
  userBubble.textContent = text;
  historyList.appendChild(userBubble);
  input.value = '';

  const body = document.getElementById('quick-msg-body');
  if (body) body.scrollTop = body.scrollHeight;

  // Let's attempt an API call if authenticated
  const token = window.FarelanceruState?.token;
  if (token) {
    try {
      const response = await fetch('/api/messages/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          receiverId: currentQuickReceiverId,
          message: text
        })
      });

      const resJson = await response.json();
      if (resJson.success) {
        // Successful message delivery mock response
        setTimeout(() => {
          const sysBubble = document.createElement('div');
          sysBubble.style.cssText = `
            align-self: flex-start;
            background: white;
            color: var(--dark);
            padding: 8px 12px;
            border-radius: 12px 12px 12px 0;
            max-width: 80%;
            font-size: 12.5px;
            line-height: 1.4;
            border: 1px solid var(--gray-200);
            box-shadow: var(--shadow-sm);
          `;
          sysBubble.innerHTML = `<span style="font-size:10px; color:var(--success); display:block; margin-bottom: 2px;"><i class="fa-solid fa-circle-check"></i> Routed and locked</span> ${text ? 'Message stored safely. Contractor notified.' : 'Under analysis by contractor'}`;
          historyList.appendChild(sysBubble);
          if (body) body.scrollTop = body.scrollHeight;
        }, 800);
      } else {
        showToast(resJson.message || 'Direct route lock failed.', 'warning');
      }
    } catch (err) {
      console.warn("Direct API send fails. Falling back to quick offline simulation: ", err);
      simulateOfflineResponse(text, historyList, body);
    }
  } else {
    // Guest fallback/ offline message simulation
    simulateOfflineResponse(text, historyList, body);
  }
};

function simulateOfflineResponse(originalText, historyList, body) {
  setTimeout(() => {
    const sysBubble = document.createElement('div');
    sysBubble.style.cssText = `
      align-self: flex-start;
      background: white;
      color: var(--dark);
      padding: 8px 12px;
      border-radius: 12px 12px 12px 0;
      max-width: 80%;
      font-size: 12.5px;
      line-height: 1.4;
      border: 1px solid var(--gray-200);
      box-shadow: var(--shadow-sm);
    `;
    sysBubble.innerHTML = `<span style="font-size: 10px; color: var(--primary); font-weight: 700; display: block; margin-bottom: 3px;"><i class="fa-solid fa-robot"></i> System auto-response</span> Thanks for reaching out! Escrow chat routing active. For real-time workspace integrations, please log in.`;
    historyList.appendChild(sysBubble);
    if (body) body.scrollTop = body.scrollHeight;
  }, 1000);
}

// Customise Navbar profile metrics based on session states
function configureNavbarProfile() {
  const authBox = document.getElementById('navbar-auth-section');
  if (!authBox) return;

  const mobileProfileSpot = document.getElementById('mobile-drawer-profile-panel');
  const mobileDrawerActions = document.getElementById('mobile-drawer-actions');

  const user = window.FarelanceruState.user;
  if (user) {
    // All users (including admin) get separate standard dashboard
    const dashboardLink = '/dashboard';
    const displayRole = user.role === 'buyer' ? 'Employer' : user.role === 'admin' ? 'Platform Administrator' : 'Expert Specialist';

    authBox.innerHTML = `
      <!-- Search Core Catalog Navigation Icon -->
      <a href="/jobs" class="nav-action-btn" title="Browse Catalog" style="position: relative;">
        <i class="fa-solid fa-magnifying-glass"></i>
      </a>

      <!-- Messages/Chat Navigation Icon -->
      <a href="/chat" class="nav-action-btn" title="Conversations Hub" style="position: relative;">
        <i class="fa-regular fa-comment-dots"></i>
      </a>

      <!-- Wallet system Navigation Icon -->
      <a href="/wallet" class="nav-action-btn" title="My Escrow Balance" style="position: relative;">
        <i class="fa-solid fa-wallet"></i>
      </a>

      <!-- Notification Bell Dropdown Container -->
      <div class="nav-bell-container" id="nav-bell-wrapper">
        <button class="nav-bell-btn" id="nav-bell-button" aria-label="Notification Center">
          <i class="fa-regular fa-bell"></i>
          <span class="bell-badge" id="bell-unread-count" style="display: none;">0</span>
        </button>
        <!-- Bell Dropdown Panel -->
        <div class="bell-dropdown-card" id="bell-dropdown-panel">
          <div class="bell-dropdown-header">
            <h3>Notifications</h3>
            <button id="btn-bell-mark-all" class="btn-text-action">Mark all read</button>
          </div>
          <div class="bell-dropdown-body" id="bell-dropdown-list">
            <div class="bell-empty">No new notifications</div>
          </div>
          <div class="bell-dropdown-footer">
            <a href="/notifications" style="display: block; width: 100%; text-align: center;">See All Notifications</a>
          </div>
        </div>
      </div>

      <!-- Avatar Dropdown Container -->
      <div class="nav-avatar-dropdown-wrap">
        <div class="avatar-trigger" id="avatar-trigger-btn">
          <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--gradient); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; color: white; border: 2px solid white; box-shadow: var(--shadow-sm);">
            ${user.username.charAt(0).toUpperCase()}
          </div>
          <span style="font-size: 13.5px; font-weight: 700; color: var(--gray-700)">@${user.username}</span>
          <i class="fa-solid fa-chevron-down" style="font-size: 9px; color: var(--gray-600); transition: transform 0.2s ease;"></i>
        </div>
        
        <!-- Avatar Panel -->
        <div class="avatar-dropdown-panel" id="avatar-dropdown-panel">
          <div class="dropdown-user-header">
            <h4>@${user.username}</h4>
            <p style="margin: 4px 0;"><span style="background-color: rgba(99,102,241,0.1); color: var(--primary); padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; display: inline-block;">${displayRole}</span></p>
            <p style="color: var(--success); font-weight: 700; font-size: 12.5px; margin-top: 4px;"><i class="fa-solid fa-coins" style="margin-right: 4px;"></i>$${Number(user.balance).toFixed(2)}</p>
          </div>
          
          <a href="${dashboardLink}" class="dropdown-menu-link"><i class="fa-solid fa-chart-line"></i> Dashboard</a>
          <a href="/wallet" class="dropdown-menu-link"><i class="fa-solid fa-wallet"></i> My Wallet Balance</a>
          <a href="/chat" class="dropdown-menu-link"><i class="fa-regular fa-comment-dots"></i> Private Messages</a>
          <a href="/notifications" class="dropdown-menu-link"><i class="fa-regular fa-bell"></i> Alerts Center</a>
          
          <div style="border-top: 1px solid var(--gray-100); margin: 6px 0;"></div>
          <a href="#" id="id-btn-avatar-logout" class="dropdown-menu-link" style="color: var(--error);"><i class="fa-solid fa-right-from-bracket" style="color: var(--error);"></i> Sign Out</a>
        </div>
      </div>
    `;

    // Dropdown handlers (Toggle)
    const avatarBtn = document.getElementById('avatar-trigger-btn');
    const avatarPanel = document.getElementById('avatar-dropdown-panel');
    const arrowIcon = avatarBtn?.querySelector('.fa-chevron-down');

    avatarBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isActive = avatarPanel?.classList.contains('active');
      avatarPanel?.classList.toggle('active');
      if (arrowIcon) {
        arrowIcon.style.transform = isActive ? 'rotate(0deg)' : 'rotate(180deg)';
      }
    });

    document.addEventListener('click', () => {
      avatarPanel?.classList.remove('active');
      if (arrowIcon) arrowIcon.style.transform = 'rotate(0deg)';
    });

    document.getElementById('id-btn-avatar-logout')?.addEventListener('click', (e) => {
      e.preventDefault();
      performLogout();
    });

    // Populate Mobile Drawer Profile panel & actions
    if (mobileProfileSpot && mobileDrawerActions) {
      mobileProfileSpot.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 44px; height: 44px; border-radius: 50%; background: var(--gradient); display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 850; color: white;">
            ${user.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <h4 style="font-size: 14px; font-weight: 800; margin: 0; color: var(--dark);">@${user.username}</h4>
            <p style="font-size: 11px; color: var(--gray-600); margin-top: 2px;">${displayRole}</p>
            <p style="font-size: 12px; color: var(--success); font-weight: 700; margin-top: 2px;">Balance: $${Number(user.balance).toFixed(2)}</p>
          </div>
        </div>
      `;
      mobileDrawerActions.innerHTML = `
        <a href="${dashboardLink}" class="btn btn-secondary" style="width: 100%; margin-bottom: 8px; justify-content: center;"><i class="fa-solid fa-chart-line"></i> Dashboard Workspace</a>
        <button class="btn btn-primary" id="btn-logout-mobile" style="width: 100%; background: var(--dark); color: white; justify-content: center;"><i class="fa-solid fa-sign-out-alt"></i> Sign Out</button>
      `;
      document.getElementById('btn-logout-mobile')?.addEventListener('click', performLogout);
    }
    
    // Initialize notification features
    initializeNotificationBell();
  } else {
    // If logged out, populate Mobile Drawer actions with login/register
    if (mobileProfileSpot) {
      mobileProfileSpot.innerHTML = `
        <p style="font-size: 12px; color: var(--gray-600); line-height: 1.5; text-align: center; margin: 0;">Connect and collaborate with certified service experts under secure milestones.</p>
      `;
    }
    if (mobileDrawerActions) {
      mobileDrawerActions.innerHTML = `
        <a href="/login" class="btn btn-secondary" style="width: 100%; margin-bottom: 8px; justify-content: center;"><i class="fa-solid fa-arrow-right-to-bracket"></i> Sign In</a>
        <a href="/register" class="btn btn-primary" style="width: 100%; justify-content: center;"><i class="fa-solid fa-user-plus"></i> Join Platform</a>
      `;
    }
  }
}

// Global notifications arrays
window.FarelanceruState.notifications = [];

// Helper time formatting
function formatNotificationTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  if (isNaN(diffMs) || diffMs < 0) return 'Just now';
  
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Get Icon based on type
function getNotificationIcon(type) {
  switch (type) {
    case 'job_posted':
      return `<div class="bell-icon-wrap grad-job"><i class="fa-solid fa-briefcase"></i></div>`;
    case 'bid_received':
      return `<div class="bell-icon-wrap grad-bid"><i class="fa-solid fa-gavel"></i></div>`;
    case 'bid_accepted':
      return `<div class="bell-icon-wrap grad-bid"><i class="fa-solid fa-check-double"></i></div>`;
    case 'message_received':
      return `<div class="bell-icon-wrap grad-msg"><i class="fa-solid fa-comment-dots"></i></div>`;
    case 'payment_released':
      return `<div class="bell-icon-wrap grad-pay"><i class="fa-solid fa-wallet"></i></div>`;
    case 'system_alert':
      return `<div class="bell-icon-wrap grad-alert"><i class="fa-solid fa-triangle-exclamation"></i></div>`;
    default:
      return `<div class="bell-icon-wrap grad-job"><i class="fa-solid fa-bell"></i></div>`;
  }
}

// Initialize Notification Bell logic
function initializeNotificationBell() {
  const bellBtn = document.getElementById('nav-bell-button');
  const bellPanel = document.getElementById('bell-dropdown-panel');
  const markAllBtn = document.getElementById('btn-bell-mark-all');
  
  if (!bellBtn || !bellPanel) return;

  // Toggle dropdown on click
  bellBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    bellPanel.classList.toggle('active');
    if (bellPanel.classList.contains('active')) {
      loadNavbarBellList();
    }
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#nav-bell-wrapper')) {
      bellPanel.classList.remove('active');
    }
  });

  // Mark all read listener
  if (markAllBtn) {
    markAllBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await triggerMarkAllAsRead();
    });
  }

  // Load initial notification listing
  loadNavbarBellList();

  // Setup dynamic script injection for secure instant Socket.io real-time
  injectSocketForNotifications();
}

// REST Api callers
async function loadNavbarBellList() {
  const token = window.FarelanceruState.token;
  if (!token || token === 'null' || token === 'undefined') return;

  try {
    const res = await fetch('/api/notifications', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const result = await res.json();
      if (result.success && result.data) {
        window.FarelanceruState.notifications = Array.isArray(result.data) ? result.data : (result.data.notifications || []);
        renderNavbarDropdownList();
        updateNavbarBellBadge();
      }
    }
  } catch (err) {
    console.error('Error loading bell notification list: ', err);
  }
}

function updateNavbarBellBadge() {
  const badge = document.getElementById('bell-unread-count');
  if (!badge) return;

  const unreadCount = window.FarelanceruState.notifications.filter(n => !n.isRead).length;
  if (unreadCount > 0) {
    badge.innerText = unreadCount > 9 ? '9+' : unreadCount;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }

  // If we also have full page results, let's sync them beautifully!
  if (window.syncNotificationCounts) {
    window.syncNotificationCounts(unreadCount, window.FarelanceruState.notifications);
  }
}

function renderNavbarDropdownList() {
  const listContainer = document.getElementById('bell-dropdown-list');
  if (!listContainer) return;

  // Render top 5 notifications only in dropdown to preserve clean layout
  const topNotifications = window.FarelanceruState.notifications.slice(0, 5);
  
  if (topNotifications.length === 0) {
    listContainer.innerHTML = '<div class="bell-empty">No new notifications</div>';
    return;
  }

  listContainer.innerHTML = topNotifications.map(item => {
    return `
      <div class="bell-item-card ${item.isRead ? '' : 'unread'}" data-id="${item._id}">
        ${getNotificationIcon(item.type)}
        <div class="bell-info">
          <div class="bell-title-row">
            <h4 class="bell-title">${item.title}</h4>
            <span class="bell-time">${formatNotificationTime(item.createdAt)}</span>
          </div>
          <p class="bell-desc">${item.message}</p>
          <div class="bell-item-actions">
            ${!item.isRead ? `<span class="bell-mark-read-btn" onclick="triggerMarkAsRead('${item._id}', event)">Mark read</span>` : ''}
            <span class="bell-delete-btn" onclick="triggerDeleteNotification('${item._id}', event)">Delete</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Global scope triggers for inline onclicks in generated items
async function triggerMarkAsRead(id, event) {
  if (event) event.stopPropagation();
  const token = window.FarelanceruState.token;
  if (!token) return;

  try {
    const res = await fetch(`/api/notifications/${id}/read`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      // update state
      window.FarelanceruState.notifications = window.FarelanceruState.notifications.map(n => {
        if (n._id === id) n.isRead = true;
        return n;
      });
      renderNavbarDropdownList();
      updateNavbarBellBadge();
      showToast('Notification marked as read', 'success');

      // Sync with full notifications list if displayed
      if (window.syncNotificationsFullList) {
        window.syncNotificationsFullList();
      }
    }
  } catch (err) {
    console.error('Error marking read: ', err);
  }
}

async function triggerMarkAllAsRead() {
  const token = window.FarelanceruState.token;
  if (!token) return;

  const unreadPresent = window.FarelanceruState.notifications.some(n => !n.isRead);
  if (!unreadPresent) {
    showToast('All notifications are already read.', 'warning');
    return;
  }

  try {
    const res = await fetch('/api/notifications/mark-all-read', {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      window.FarelanceruState.notifications = window.FarelanceruState.notifications.map(n => {
        n.isRead = true;
        return n;
      });
      renderNavbarDropdownList();
      updateNavbarBellBadge();
      showToast('All notifications marked as read', 'success');

      if (window.syncNotificationsFullList) {
        window.syncNotificationsFullList();
      }
    }
  } catch (err) {
    console.error('Error marking all read: ', err);
  }
}

async function triggerDeleteNotification(id, event) {
  if (event) event.stopPropagation();
  const token = window.FarelanceruState.token;
  if (!token) return;

  if (!confirm('Are you sure you want to delete this notification card?')) return;

  try {
    const res = await fetch(`/api/notifications/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      window.FarelanceruState.notifications = window.FarelanceruState.notifications.filter(n => n._id !== id);
      renderNavbarDropdownList();
      updateNavbarBellBadge();
      showToast('Notification deleted', 'success');

      if (window.syncNotificationsFullList) {
        window.syncNotificationsFullList();
      }
    }
  } catch (err) {
    console.error('Error deleting notification: ', err);
  }
}

// Expose these helper functions globally so index.html and other templates can trigger them via onclick="..."
window.triggerMarkAsRead = triggerMarkAsRead;
window.triggerDeleteNotification = triggerDeleteNotification;
window.triggerMarkAllAsRead = triggerMarkAllAsRead;

// Auto-inject and bootstrap Socket connection for genuine instant events
function injectSocketForNotifications() {
  if (typeof io !== 'undefined') {
    setupSocketListeners();
    return;
  }

  const script = document.createElement('script');
  script.src = '/socket.io/socket.io.js';
  script.onload = () => {
    setupSocketListeners();
  };
  script.onerror = () => {
    // Fallback: poll every 10 seconds to satisfy instant-like simulation under connection failure
    setInterval(loadNavbarBellList, 10000);
  };
  document.head.appendChild(script);
}

function setupSocketListeners() {
  try {
    const token = window.FarelanceruState.token;
    if (!token || token === 'null' || token === 'undefined') return; // Do not establish WS connection for guest users to prevent handshake auth errors

    const socket = io({
      auth: {
        token: token
      }
    });
    const user = window.FarelanceruState.user;
    if (!user) return;

    socket.on('connect', () => {
      // Register with user individual private room
      socket.emit('joinRoom', { chatId: `user:${user.id || user._id}` });
      console.log(`🔌 Registered notifications channel room: user:${user.id || user._id}`);
    });

    socket.on('connect_error', () => {
      console.warn('Real-time notifications socket disconnected. Moving to HTTP polling fallbacks.');
    });

    // Real-time notification receive listener!
    socket.on('new_notification', (notification) => {
      console.log('🔔 [ SOCKET ] Received dynamic fresh notification!', notification);
      
      // Deduplicate
      const alreadyExists = window.FarelanceruState.notifications.some(n => n._id === notification._id);
      if (!alreadyExists) {
        window.FarelanceruState.notifications.unshift(notification);
        renderNavbarDropdownList();
        updateNavbarBellBadge();
        
        // Show interactive user toast in top right corners!
        showToast(`🔔 ${notification.title}: ${notification.message.slice(0, 48)}...`, 'success');
        
        if (window.syncNotificationsFullList) {
          window.syncNotificationsFullList();
        }
      }
    });
  } catch (err) {
    console.warn('Could not launch socket listeners: ', err);
  }
}

// Setup listeners during script load
document.addEventListener('DOMContentLoaded', () => {
  bootstrapLayout();
});

// Setup active Lazy Animation observer system for SaaS premium feel
function setupLazyAnimationObserver() {
  const elements = document.querySelectorAll('.lazy-animate, .card, .category-card, .job-item-horizontal, .expert-card, .showcase-card, .stats-card, .admin-card, .notify-card-item, .bell-item-card');
  
  elements.forEach(el => {
    if (!el.classList.contains('lazy-loaded')) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(16px)';
      el.style.transition = 'opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1), transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
      el.style.willChange = 'opacity, transform';
    }
  });

  const observerOptions = {
    root: null,
    rootMargin: '0px 0px -10px 0px',
    threshold: 0.05
  };

  const observer = new IntersectionObserver((entries, selfObserver) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
        el.classList.add('lazy-loaded');
        selfObserver.unobserve(el);
      }
    });
  }, observerOptions);

  elements.forEach(el => observer.observe(el));
}

// Ripple click effect initializer
function setupButtonRipples() {
  document.addEventListener('mousedown', (e) => {
    const btn = e.target.closest('.btn, .btn-primary, .btn-secondary, .btn-outline, .btn-ripple, .search-toggle-btn');
    if (!btn) return;

    // Create a physical ripple circle
    const circle = document.createElement('span');
    const diameter = Math.max(btn.clientWidth, btn.clientHeight);
    const radius = diameter / 2;

    const rect = btn.getBoundingClientRect();
    
    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${e.clientX - rect.left - radius}px`;
    circle.style.top = `${e.clientY - rect.top - radius}px`;
    circle.classList.add('btn-ripple-circle');

    // Remove existing ripples to be tidy
    const existing = btn.querySelector('.btn-ripple-circle');
    if (existing) {
      existing.remove();
    }

    // Append new circle
    btn.appendChild(circle);
    
    // Add simple relative position safety
    if (getComputedStyle(btn).position === 'static') {
      btn.style.position = 'relative';
    }
    btn.style.overflow = 'hidden';
  });
}

// Expose animation hooks
window.setupLazyAnimationObserver = setupLazyAnimationObserver;
window.setupButtonRipples = setupButtonRipples;

// Direct global exposing of modal and drawer controllers to prevent Uncaught ReferenceError
window.toggleModal = function(modalId, showFlag) {
  const modal = document.getElementById(modalId);
  if (modal) {
    if (showFlag) {
      modal.classList.add('active');
    } else {
      modal.classList.remove('active');
    }
  }
};

window.toggleDetailsDrawer = function(showFlag) {
  const overlay = document.getElementById('details-drawer-overlay');
  const drawer = document.getElementById('job-details-drawer');
  if (overlay && drawer) {
    if (showFlag) {
      overlay.classList.add('active');
      drawer.classList.add('active');
    } else {
      overlay.classList.remove('active');
      drawer.classList.remove('active');
    }
  }
};

// Global Search bar suggestions and enter-press navigation
const defaultCategories = [
  { name: 'Web Development', classIcon: 'fa-solid fa-laptop-code', search: 'web' },
  { name: 'Logo Design', classIcon: 'fa-solid fa-wand-magic-sparkles', search: 'logo' },
  { name: 'Graphic Design', classIcon: 'fa-solid fa-palette', search: 'graphic' },
  { name: 'Mobile App Development', classIcon: 'fa-solid fa-mobile-screen-button', search: 'mobile' },
  { name: 'SEO Services', classIcon: 'fa-solid fa-chart-line', search: 'seo' },
  { name: 'AI Development', classIcon: 'fa-solid fa-robot', search: 'ai' },
  { name: 'Content Writing', classIcon: 'fa-solid fa-pen-nib', search: 'writing' },
  { name: 'Video Editing', classIcon: 'fa-solid fa-clapperboard', search: 'video' }
];

window.searchActiveIndex = -1;

window.toggleMobileSearch = function(expandFlag) {
  const searchBox = document.getElementById('nav-global-search-box');
  if (searchBox) {
    if (expandFlag) {
      searchBox.classList.add('mobile-expanded');
      const input = document.getElementById('nav-global-search-input');
      if (input) {
        input.focus();
        window.showGlobalSearchDropdown(true);
      }
    } else {
      searchBox.classList.remove('mobile-expanded');
      window.showGlobalSearchDropdown(false);
    }
  }
};

function updateActiveSuggestion() {
  const list = document.getElementById('nav-search-suggestions-list');
  if (!list) return;
  const items = list.querySelectorAll('.search-suggestion-item');
  items.forEach((item, index) => {
    if (index === window.searchActiveIndex) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
  const input = document.getElementById('nav-global-search-input');
  if (input) input.focus();
}

function saveRecentSearch(q) {
  if (!q) return;
  const cleanQ = q.trim();
  const recents = JSON.parse(localStorage.getItem('recentSearches') || '[]');
  if (!recents.includes(cleanQ)) {
    recents.unshift(cleanQ);
    localStorage.setItem('recentSearches', JSON.stringify(recents.slice(0, 5)));
  }
}

window.showGlobalSearchDropdown = function(showFlag) {
  const panel = document.getElementById('nav-search-dropdown');
  if (panel) {
    if (showFlag) {
      panel.classList.add('active');
      panel.style.display = 'block';
      
      const recentsList = document.getElementById('nav-search-recents-list');
      const recents = JSON.parse(localStorage.getItem('recentSearches') || '[]');
      if (recentsList) {
        if (recents.length === 0) {
          recentsList.innerHTML = `
            <span class="badge-pill-item" onclick="document.getElementById('nav-global-search-input').value='Web'; window.handleGlobalSearchInput('Web')"><i class="fa-solid fa-laptop-code" style="font-size: 11px;"></i> Web Platform</span>
            <span class="badge-pill-item" onclick="document.getElementById('nav-global-search-input').value='Logo'; window.handleGlobalSearchInput('Logo')"><i class="fa-solid fa-wand-magic-sparkles" style="font-size: 11px;"></i> Logo Design</span>
          `;
        } else {
          recentsList.innerHTML = recents.map(q => `
            <span class="badge-pill-item" onclick="document.getElementById('nav-global-search-input').value='${q}'; window.handleGlobalSearchInput('${q}')"><i class="fa-solid fa-history" style="font-size: 10px; color: var(--gray-400);"></i> ${q}</span>
          `).join('');
        }
      }
      
      window.handleGlobalSearchInput(document.getElementById('nav-global-search-input').value);
    } else {
      panel.classList.remove('active');
      setTimeout(() => {
        if (!panel.classList.contains('active')) {
          panel.style.display = 'none';
        }
      }, 220);
    }
  }
};

window.handleGlobalSearchInput = function(query) {
  const list = document.getElementById('nav-search-suggestions-list');
  const headerTitle = document.getElementById('suggestions-header-title');
  if (!list) return;

  window.searchActiveIndex = -1;

  if (!query || query.trim() === "") {
    if (headerTitle) {
      headerTitle.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> Popular Categories`;
    }
    list.innerHTML = defaultCategories.map(cat => `
      <a href="/jobs?search=${encodeURIComponent(cat.search)}" class="search-suggestion-item">
        <i class="${cat.classIcon}"></i>
        <span>${cat.name}</span>
      </a>
    `).join('');
    return;
  }

  if (headerTitle) {
    headerTitle.innerHTML = `<i class="fa-solid fa-hourglass-start"></i> Recommended Matches`;
  }

  const matchedCategories = defaultCategories.filter(cat => cat.name.toLowerCase().includes(query.toLowerCase()));
  const escapedQuery = query.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  let itemsHtml = matchedCategories.map(cat => `
    <a href="/jobs?search=${encodeURIComponent(cat.search)}" class="search-suggestion-item">
      <i class="${cat.classIcon}"></i>
      <span>${cat.name}</span>
    </a>
  `).join('');

  if (matchedCategories.length === 0) {
    itemsHtml += `
      <a href="/jobs?search=${encodeURIComponent(query)}" class="search-suggestion-item" style="color: var(--primary) !important;">
        <i class="fa-solid fa-magnifying-glass" style="color: var(--primary);"></i>
        <span>Search for "${escapedQuery}"</span>
      </a>
    `;
  } else {
    itemsHtml += `
      <a href="/jobs?search=${encodeURIComponent(query)}" class="search-suggestion-item" style="border-top: 1px dashed var(--gray-200); margin-top: 6px; padding-top: 10px;">
        <i class="fa-solid fa-globe"></i>
        <span>Search everywhere for "${escapedQuery}"</span>
      </a>
    `;
  }

  list.innerHTML = itemsHtml;
};

// Wire up keyboard arrow keys, escape and enter on the input field
document.addEventListener('keydown', (e) => {
  if (e.target && e.target.id === 'nav-global-search-input') {
    const list = document.getElementById('nav-search-suggestions-list');
    const items = list ? list.querySelectorAll('.search-suggestion-item') : [];
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (items.length > 0) {
        window.searchActiveIndex = (window.searchActiveIndex + 1) % items.length;
        updateActiveSuggestion();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (items.length > 0) {
        window.searchActiveIndex = (window.searchActiveIndex - 1 + items.length) % items.length;
        updateActiveSuggestion();
      }
    } else if (e.key === 'Enter') {
      if (window.searchActiveIndex >= 0 && window.searchActiveIndex < items.length) {
        e.preventDefault();
        const activeItem = items[window.searchActiveIndex];
        const targetHref = activeItem.getAttribute('href');
        if (targetHref) {
          const q = activeItem.querySelector('span:last-child')?.textContent || activeItem.textContent;
          saveRecentSearch(q);
          window.location.href = targetHref;
        }
      } else {
        const q = e.target.value.trim();
        if (q) {
          e.preventDefault();
          saveRecentSearch(q);
          window.location.href = `/jobs?search=${encodeURIComponent(q)}`;
        }
      }
    } else if (e.key === 'Escape') {
      window.showGlobalSearchDropdown(false);
      window.toggleMobileSearch(false);
      e.target.blur();
    }
  }
});


