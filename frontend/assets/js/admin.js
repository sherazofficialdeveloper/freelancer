/**
 * Skillnest Enterprise Administration Control Panel Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
  // --- SESSION AUTH SECURITIES & DYNAMIC LOADING HANDLER ---
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const loadingOverlay = document.getElementById('admin-auth-loading-overlay');

  const rejectSession = (message) => {
    if (loadingOverlay) {
      loadingOverlay.innerHTML = `
        <div style="font-size: 52px; color: #ef4444;"><i class="fa-solid fa-circle-exclamation"></i></div>
        <p style="font-weight: 800; color: white; font-size: 18px; margin: 10px 0 5px 0; letter-spacing: -0.5px;">Access Denied</p>
        <p style="color: #94a3b8; font-size: 14px; margin: 0 0 15px 0; text-align: center; max-width: 320px;">${message}</p>
        <div style="display: flex; gap: 12px; margin-top: 15px;">
          <a href="/" style="background: rgba(255, 255, 255, 0.1); color: white; padding: 10px 20px; border-radius: 20px; font-weight: 700; font-size: 12px; text-decoration: none;">Home Gateway</a>
          <a href="/login" style="background: #6366f1; color: white; padding: 10px 20px; border-radius: 20px; font-weight: 700; font-size: 12px; text-decoration: none;">Login</a>
        </div>
      `;
    } else {
      window.location.href = '/access-denied.html';
    }
  };

  if (!token || !userStr) {
    rejectSession('Secure session token or active profile was not found.');
    return;
  }

  let currentUser;
  try {
    const response = await fetch('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      rejectSession('Your current security session token is invalid or expired.');
      return;
    }

    const resData = await response.json();
    const freshUser = resData.data.user;

    const freshEmail = freshUser && freshUser.email ? freshUser.email.trim().toLowerCase() : '';
    const isOwnerAdmin = freshEmail === 'maqboolusama9@gmail.com' || freshEmail === 'usamamaqboolassiii@gmail.com' || (freshUser && freshUser.role === 'admin');

    if (!isOwnerAdmin) {
      rejectSession('You do not have administrative privilege clearance.');
      return;
    }

    if (isOwnerAdmin && freshUser && freshUser.role !== 'admin') {
      freshUser.role = 'admin';
    }
    
    localStorage.setItem('user', JSON.stringify(freshUser));
    currentUser = freshUser;

  } catch (err) {
    rejectSession('Failed to communicate with authentication gateway.');
    return;
  }

  // Set Profile Avatar Details
  const adminUsername = document.getElementById('adminUsername');
  const adminAvatarText = document.getElementById('adminAvatarText');
  
  if (adminUsername) adminUsername.textContent = `@${currentUser.username}`;
  if (adminAvatarText) {
    adminAvatarText.textContent = currentUser.username.substring(0, 2).toUpperCase();
  }

  // Dismiss loading overlay smoothly
  if (loadingOverlay) {
    loadingOverlay.style.opacity = '0';
    setTimeout(() => {
      loadingOverlay.style.display = 'none';
    }, 500);
  }

  // Mobile sidebar toggler handler
  const btnSidebarToggler = document.getElementById('btnSidebarToggler');
  const adminSidebar = document.getElementById('adminSidebar');
  
  if (btnSidebarToggler && adminSidebar) {
    btnSidebarToggler.addEventListener('click', (e) => {
      e.stopPropagation();
      adminSidebar.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (!adminSidebar.contains(e.target) && e.target !== btnSidebarToggler && !btnSidebarToggler.contains(e.target)) {
        adminSidebar.classList.remove('open');
      }
    });

    // Close when clicking a menu item on small screens
    const menuItems = adminSidebar.querySelectorAll('.admin-menu-item');
    menuItems.forEach(item => {
      item.addEventListener('click', () => {
        if (window.innerWidth <= 1024) {
          adminSidebar.classList.remove('open');
        }
      });
    });
  }

  // --- STATE BAGS ---
  let cachedMetrics = null;
  let cachedUsers = [];
  let cachedJobs = [];
  let cachedBids = [];
  let cachedPayments = [];
  let cachedDisputes = [];
  let cachedTickets = [];
  let selectedTicketId = null;
  let incidenceLogs = []; // System log incident notifications

  // Charts references to prevent overlay collision
  let chartInstanceRevenue = null;
  let chartInstanceCategories = null;
  let chartInstanceUsers = null;
  let chartInstanceFinancials = null;

  // --- NAVIGATION ROUTING ---
  const sidebarMenu = document.getElementById('sidebarMenu');
  const sections = document.querySelectorAll('.admin-page-section');

  if (sidebarMenu) {
    sidebarMenu.addEventListener('click', (e) => {
      const item = e.target.closest('.admin-menu-item');
      if (!item) return;

      // Active state styling toggle
      document.querySelectorAll('.admin-menu-item').forEach(m => m.classList.remove('active'));
      item.classList.add('active');

      // Swap workspace section
      const targetId = item.dataset.target;
      sections.forEach(sec => {
        if (sec.id === targetId) {
          sec.classList.add('active');
        } else {
          sec.classList.remove('active');
        }
      });

      // Lazy load view databases
      triggerLazyLoad(targetId);
    });
  }

  // Redirect Exit Portal Control
  const btnExitPortal = document.getElementById('btnExitPortal');
  if (btnExitPortal) {
    btnExitPortal.addEventListener('click', () => {
      if (confirm('Verify exit from secure administration zone?')) {
        window.location.href = '/';
      }
    });
  }

  // Navigation direct links
  const btnDashToJobs = document.getElementById('btnDashToJobs');
  if (btnDashToJobs) {
    btnDashToJobs.addEventListener('click', () => {
      document.getElementById('menu-jobs').click();
    });
  }

  // --- GLOBAL LIVE SEARCH ENGINE ---
  const adminGlobalSearch = document.getElementById('adminGlobalSearch');
  if (adminGlobalSearch) {
    adminGlobalSearch.addEventListener('keyup', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const activeSec = document.querySelector('.admin-page-section.active');
      if (!activeSec) return;

      // Filter rows dynamically based on whichever column in current active table is matches
      const rows = activeSec.querySelectorAll('tbody tr');
      rows.forEach(row => {
        if (row.cells.length <= 1 && row.cells[0].textContent.includes('No')) return; // skip placeholders
        const text = row.textContent.toLowerCase();
        if (text.includes(q)) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      });

      // Special handling for dashboard recent users cards
      const userCards = activeSec.querySelectorAll('#dash-recent-users-list > div');
      userCards.forEach(card => {
        if (card.textContent.toLowerCase().includes(q)) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });
  }

  // --- NOTIFICATIONS DROPDOWN CHANGER ---
  const btnNotifications = document.getElementById('btnNotifications');
  const alertsDropdown = document.getElementById('alertsDropdown');
  const alertPulse = document.getElementById('alertPulse');
  const alertsListContainer = document.getElementById('alertsListContainer');
  const btnClearAlerts = document.getElementById('btnClearAlerts');

  if (btnNotifications && alertsDropdown) {
    btnNotifications.addEventListener('click', (e) => {
      e.stopPropagation();
      alertsDropdown.classList.toggle('show');
    });

    document.addEventListener('click', () => {
      alertsDropdown.classList.remove('show');
    });

    alertsDropdown.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  if (btnClearAlerts) {
    btnClearAlerts.addEventListener('click', async () => {
      // In production, we don't wipe all audit logs from the database immediately, but we can clear local view
      incidenceLogs = [];
      renderSystemLogs();
    });
  }

  async function loadAuditLogs() {
    try {
      const res = await fetch('/api/admin/audit-logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success && result.data && result.data.logs) {
        incidenceLogs = result.data.logs.map(l => ({
          id: l._id,
          label: l.action,
          msg: l.details,
          type: l.type,
          time: new Date(l.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }));
        renderSystemLogs();
      }
    } catch (err) {
      console.error('Failed loading audit logs:', err);
    }
  }

  async function pushSystemIncident(label, msg, type = 'warning') {
    try {
      await fetch('/api/admin/audit-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: label, details: msg, type })
      });
      loadAuditLogs();
    } catch (err) {
      console.error('Failed saving audit log:', err);
      incidenceLogs.unshift({
        id: Date.now(),
        label,
        msg,
        type,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      renderSystemLogs();
    }
  }

  function renderSystemLogs() {
    if (!alertsListContainer) return;
    if (incidenceLogs.length === 0) {
      if (alertPulse) alertPulse.style.display = 'none';
      alertsListContainer.innerHTML = `
        <div style="padding: 20px; text-align: center; color: var(--gray-600); font-size: 12px;">No technical logs reported.</div>
      `;
      return;
    }

    if (alertPulse) alertPulse.style.display = 'block';
    alertsListContainer.innerHTML = incidenceLogs.map(log => {
      const orbColor = log.type === 'error' ? 'var(--error)' : (log.type === 'success' ? 'var(--success)' : 'var(--warning)');
      return `
        <div style="padding: 12px 16px; border-bottom: 1px solid var(--gray-100); font-size: 13px; display: flex; gap: 10px; align-items: flex-start; background: #fffdf9;">
          <div style="width: 8px; height: 8px; border-radius: 50%; background: ${orbColor}; margin-top: 5px; flex-shrink: 0;"></div>
          <div style="flex: 1;">
            <p style="margin: 0; font-weight: 700; color: var(--dark);">${log.label}</p>
            <p style="margin: 2px 0; color: var(--gray-600); font-size: 11px;">${log.msg}</p>
            <span style="font-size: 9px; color: var(--gray-600); font-family: monospace;">${log.time}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // --- DYNAMIC VIEW LOADING TRIPS ---
  function triggerLazyLoad(secId) {
    console.log(`Administration lazy routing to: ${secId}`);
    switch(secId) {
      case 'section-dashboard':
        loadMetrics();
        break;
      case 'section-users':
        loadUsers();
        break;
      case 'section-freelancers':
        loadFreelancers();
        break;
      case 'section-jobs':
        loadJobs();
        break;
      case 'section-bids':
        loadBids();
        break;
      case 'section-payments':
        loadPayments();
        break;
      case 'section-disputes':
        loadDisputes();
        break;
      case 'section-tickets':
        loadTickets();
        break;
      case 'section-gigs':
        loadGigs();
        break;
      case 'section-categories':
        loadCategories();
        break;
      case 'section-analytics':
        loadAnalytics();
        break;
      case 'section-settings':
        loadLocalSettings();
        break;
      case 'section-emails':
        renderEmailLivePreview();
        break;
    }
  }

  // --- SYSTEM LOGS SEEDING HANDLERS ---
  const btnQuickSeed = document.getElementById('btnQuickSeed');
  const btnBannerSeed = document.getElementById('btnBannerSeed');

  if (btnQuickSeed) btnQuickSeed.addEventListener('click', triggerDatabaseSeeding);
  if (btnBannerSeed) btnBannerSeed.addEventListener('click', triggerDatabaseSeeding);

  async function triggerDatabaseSeeding() {
    if (!confirm('Warning: Seed Skillnest sandbox with curated mock database profiles, active jobs, escrows and disputes?')) return;
    
    try {
      const res = await fetch('/api/admin/seed', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();

      if (result.success) {
        showToast('Database curated sandbox loaded successfully!', 'success');
        
        // Hide banner
        const banner = document.getElementById('sandboxSeedingBanner');
        if (banner) banner.style.display = 'none';

        pushSystemIncident('SANDBOX SEEDED', 'Database has been pre-populated with curated profiles.', 'success');

        // Reload current view
        const activeSec = document.querySelector('.admin-page-section.active');
        if (activeSec) triggerLazyLoad(activeSec.id);
      } else {
        showToast(result.message || 'Seeding sandbox execution failed.', 'error');
      }
    } catch (err) {
      console.error('Failed seeding platform:', err);
      showToast('Sandbox seeder failed. Verify connection status.', 'error');
    }
  }

  // Hide seeder banner if users already exist (prevents annoying ui block)
  async function checkForDismissSeederBanner() {
    try {
      const res = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success && result.data.users && result.data.users.length > 1) {
        const banner = document.getElementById('sandboxSeedingBanner');
        if (banner) banner.style.display = 'none';
      }
    } catch (err) {
      // safe bypass
    }
  }

  // --- CORE VIEW 1: METRICS DISPLAY --->
  async function loadMetrics() {
    try {
      const res = await fetch('/api/admin/metrics', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();

      if (result.success && result.data.metrics) {
        cachedMetrics = result.data.metrics;
        const m = cachedMetrics;

        // Render counters safely across 20 parameters
        const setVal = (id, val) => {
          const el = document.getElementById(id);
          if (el) el.textContent = val;
        };

        setVal('dash-m-users', m.users.total);
        setVal('dash-m-act-users', m.users.active);
        setVal('dash-m-on-users', m.users.online);
        setVal('dash-m-adm-users', m.users.admins);

        setVal('dash-m-free-users', m.users.freelancers);
        setVal('dash-m-buy-users', m.users.buyers);
        setVal('dash-m-gigs', m.services.total);
        setVal('dash-m-bids', m.bidsCount);

        setVal('dash-m-jobs-total', m.jobs.total);
        setVal('dash-m-jobs-active', m.jobs.active);
        setVal('dash-m-jobs-completed', m.jobs.completed);
        setVal('dash-m-jobs-pending', m.jobs.open);

        setVal('dash-m-wallet-balance', `$${m.financials.totalWalletBalance.toFixed(2)}`);
        setVal('dash-m-deposits', `$${m.financials.totalDeposits.toFixed(2)}`);
        setVal('dash-m-withdrawals', `$${m.financials.totalWithdrawals.toFixed(2)}`);
        setVal('dash-m-transactions', m.financials.totalTransactions);

        setVal('dash-m-revenue', `$${m.financials.totalRevenue.toFixed(2)}`);
        setVal('dash-m-commission', `$${m.financials.platformCommission.toFixed(2)}`);
        setVal('dash-m-kyc', m.financials.pendingKycRequests);
        setVal('dash-m-withdrawal-reqs', m.financials.pendingWithdrawalRequests);

        // Keep legacy backward compatibility fields
        setVal('dash-m-jobs', m.jobs.total);
        setVal('dash-m-active-jobs', `${m.jobs.active} Active Contracts`);
        setVal('dash-m-escrow', `$${m.financials.cashInEscrow.toFixed(2)}`);
        setVal('dash-m-payouts', `$${m.financials.volumeReleased.toFixed(2)}`);

        // Toggles sidebar action counters
        const bdCount = document.getElementById('badge-disputes-count');
        const tixCount = document.getElementById('badge-tickets-count');

        if (bdCount) {
          if (m.disputes.pending > 0) {
            bdCount.style.display = 'inline-block';
            bdCount.textContent = m.disputes.pending;
          } else {
            bdCount.style.display = 'none';
          }
        }

        if (tixCount) {
          if (m.tickets.open > 0) {
            tixCount.style.display = 'inline-block';
            tixCount.textContent = m.tickets.open;
          } else {
            tixCount.style.display = 'none';
          }
        }

        // Render dashboard tables
        loadRecentDashboardLists();
        renderDashboardRevenueChart();
      }
    } catch (err) {
      console.error('Failed reading operational metrics:', err);
    }
  }

  async function loadRecentDashboardLists() {
    // Recent Users
    try {
      const res = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const r = await res.json();
      if (r.success && r.data.users) {
        cachedUsers = r.data.users;
        const recentUsers = cachedUsers.slice(0, 5);
        const divRecentLog = document.getElementById('dash-recent-users-list');
        
        if (divRecentLog) {
          if (recentUsers.length === 0) {
            divRecentLog.innerHTML = `
              <div style="text-align: center; color: var(--gray-600); font-size: 12px; padding: 40px 0;">No active users logged. Let's seed DB sandbox!</div>
            `;
            return;
          }

          divRecentLog.innerHTML = recentUsers.map(u => {
            const initials = u.username.substring(0, 2).toUpperCase();
            const badgeColor = u.role === 'admin' ? 'admin-badge-active' : (u.role === 'buyer' ? 'admin-badge-pending' : 'admin-badge-open');
            return `
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: var(--light); border-radius: 10px; border: 1px solid var(--gray-200);">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--gradient); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; color: white;">
                    ${initials}
                  </div>
                  <div>
                    <h5 style="margin: 0; font-size: 13px; color: var(--dark);">@${u.username}</h5>
                    <span style="font-size: 10px; color: var(--gray-600);">${u.email}</span>
                  </div>
                </div>
                <span class="admin-badge ${badgeColor}" style="font-size: 9px; padding: 2px 6px;">${u.role}</span>
              </div>
            `;
          }).join('');
        }
      }
    } catch (err) {
      console.error(err);
    }

    // Recent Jobs
    try {
      const res = await fetch('/api/admin/jobs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const r = await res.json();
      if (r.success && r.data.jobs) {
        cachedJobs = r.data.jobs;
        const recentJobs = cachedJobs.slice(0, 4);
        const tblRecentJobs = document.getElementById('dash-recent-jobs-table');
        
        if (tblRecentJobs) {
          if (recentJobs.length === 0) {
            tblRecentJobs.innerHTML = `
              <tr>
                <td colspan="5" style="text-align: center; color: var(--gray-600); padding: 30px;">No public jobs currently submitted.</td>
              </tr>
            `;
            return;
          }

          tblRecentJobs.innerHTML = recentJobs.map(j => {
            const clientName = j.client ? `@${j.client.username}` : 'Anonymous';
            const badgeClass = j.status === 'open' ? 'admin-badge-open' : (j.status === 'active' ? 'admin-badge-pending' : (j.status === 'completed' ? 'admin-badge-active' : 'admin-badge-banned'));
            return `
              <tr>
                <td style="font-weight: 700;">${j.title}</td>
                <td>${j.category}</td>
                <td style="font-weight: 800;">$${j.budget}</td>
                <td>${clientName}</td>
                <td><span class="admin-badge ${badgeClass}">${j.status}</span></td>
              </tr>
            `;
          }).join('');
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  // --- CORE VIEW 2: USERS CRM COMPILING --->
  async function loadUsers() {
    try {
      const res = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();

      if (result.success && result.data.users) {
        cachedUsers = result.data.users;
        const body = document.getElementById('tblUsersBody');
        if (!body) return;

        if (cachedUsers.length === 0) {
          body.innerHTML = `
            <tr>
              <td colspan="7" style="text-align: center; color: var(--gray-600); padding: 40px;">No platform users found. Proceed with DB Sandbox seed.</td>
            </tr>
          `;
          return;
        }

        body.innerHTML = cachedUsers.map(u => {
          const initials = u.username.substring(0, 2).toUpperCase();
          const badgeClass = u.status === 'active' ? 'admin-badge-active' : 'admin-badge-banned';
          const rClass = u.role === 'admin' ? 'background: #334155; color: white;' : (u.role === 'buyer' ? 'background: #e2e8f0; color: #334155;' : 'background: rgba(99,102,241,0.1); color: var(--primary);');
          const registeredDate = new Date(u.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
          
          return `
            <tr id="user-tbl-row-${u._id}">
              <td>
                <div style="display: flex; align-items: center; gap: 12px;">
                  <div style="width: 38px; height: 38px; border-radius: 50%; background: var(--gradient); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; color: white;">
                    ${initials}
                  </div>
                  <div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <h4 style="margin: 0; font-size: 14px; color: var(--dark);">@${u.username}</h4>
                      ${u.isKycVerified ? `<span style="color: var(--success); font-size: 11px;" title="KYC Verified Pro"><i class="fa-solid fa-circle-check"></i></span>` : (u.kycDetails && u.kycDetails.status === 'pending' ? `<span style="color: var(--warning); font-size: 11px;" title="KYC Verification Pending"><i class="fa-solid fa-circle-exclamation"></i></span>` : '')}
                    </div>
                    <p style="margin: 0; font-size: 11px; color: var(--gray-600);">${u.email}</p>
                    ${u.badges && u.badges.length > 0 ? `<div style="display: flex; gap: 4px; margin-top: 4px; flex-wrap: wrap;">${u.badges.map(b => `<span style="font-size: 9px; padding: 2px 6px; border-radius: 4px; background: rgba(245, 158, 11, 0.1); color: #d97706; font-weight: 700;">${b}</span>`).join('')}</div>` : ''}
                  </div>
                </div>
              </td>
              <td>
                <span class="admin-badge" style="${rClass}">${u.role}</span>
              </td>
              <td style="font-weight: 800; font-family: monospace; font-size: 15px;">
                $${u.balance.toFixed(2)}
              </td>
              <td style="font-weight: 700;">
                ⭐ ${u.rating ? u.rating.toFixed(1) : '5.0'}
              </td>
              <td>
                <span class="admin-badge ${badgeClass}">${u.status}</span>
              </td>
              <td style="font-size: 13px; color: var(--gray-600);">
                ${registeredDate}
              </td>
              <td>
                <div style="display: flex; gap: 8px; justify-content: flex-end;">
                  <button class="btn btn-secondary btn-user-edit" data-id="${u._id}" style="padding: 6px 10px; font-size: 12px;">Edit</button>
                  <button class="btn btn-secondary btn-user-ban" data-id="${u._id}" style="padding: 6px 10px; font-size: 12px; color: var(--warning); border-color: var(--warning);">${u.status === 'banned' ? 'Unban' : 'Ban'}</button>
                  <button class="btn btn-secondary btn-user-delete" data-id="${u._id}" style="padding: 6px 10px; font-size: 12px; color: var(--error); border-color: var(--error);">Delete</button>
                </div>
              </td>
            </tr>
          `;
        }).join('');

        // Attach listeners using delegation or query triggers
        attachUsersEventListeners();
      }
    } catch (err) {
      console.error(err);
    }
  }

  function attachUsersEventListeners() {
    // Edit User Modal Load Trigger
    document.querySelectorAll('.btn-user-edit').forEach(btn => {
      btn.addEventListener('click', async () => {
        const uId = btn.dataset.id;
        try {
          const res = await fetch(`/api/admin/users/${uId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const result = await res.json();
          if (result.success && result.data.user) {
            const u = result.data.user;
            
            document.getElementById('edit_user_id').value = u._id;
            document.getElementById('edit_user_name').value = u.username;
            document.getElementById('edit_user_email').value = u.email;
            document.getElementById('edit_user_role').value = u.role;
            document.getElementById('edit_user_bal').value = u.balance;
            document.getElementById('edit_user_status').value = u.status;
            document.getElementById('edit_user_rate').value = u.rating || 5;
            document.getElementById('edit_user_kyc').value = (u.kycDetails && u.kycDetails.status) || 'unsubmitted';
            document.getElementById('edit_user_badges').value = (u.badges || []).join(', ');

            openModal('modalEditUser');
          }
        } catch (err) {
          console.error(err);
        }
      });
    });

    // Ban Toggle trigger
    document.querySelectorAll('.btn-user-ban').forEach(btn => {
      btn.addEventListener('click', async () => {
        const uId = btn.dataset.id;
        if (!confirm('Toggle status ban lock on target user profile?')) return;

        try {
          const res = await fetch(`/api/admin/users/ban/${uId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const result = await res.json();
          if (result.success) {
            showToast(result.message, 'success');
            pushSystemIncident('BAN STATE UPDATE', `User toggled block status: ${result.data.user.username}`, 'warning');
            loadUsers();
          } else {
            showToast(result.message || 'Error occurred.', 'error');
          }
        } catch (err) {
          console.error(err);
        }
      });
    });

    // Wipe profile permanently
    document.querySelectorAll('.btn-user-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const uId = btn.dataset.id;
        if (!confirm('Permanent Record Removal: Delete this user and refund their active jobs? Actions are irreversible!')) return;

        try {
          const res = await fetch(`/api/admin/users/${uId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const result = await res.json();
          if (result.success) {
            showToast('User record successfully deleted from MongoDB registry.', 'success');
            pushSystemIncident('PROFILE WIPE', 'Admin permanently purged user entry.', 'error');
            loadUsers();
          } else {
            showToast(result.message || 'purging record failed.', 'error');
          }
        } catch (err) {
          console.error(err);
        }
      });
    });
  }

  // --- CORE VIEW 3: FREELANCERS DIRECTORY BOARD --->
  async function loadFreelancers() {
    try {
      const res = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();

      if (result.success && result.data.users) {
        const freelancers = result.data.users.filter(u => u.role === 'freelancer');
        const body = document.getElementById('tblFreelancersBody');
        if (!body) return;

        if (freelancers.length === 0) {
          body.innerHTML = `
            <tr>
              <td colspan="6" style="text-align: center; color: var(--gray-600); padding: 40px;">No registered Freelancers found on Skillnest.</td>
            </tr>
          `;
          return;
        }

        body.innerHTML = freelancers.map(f => {
          const initials = f.username.substring(0, 2).toUpperCase();
          const skillsTags = (f.profile && f.profile.skills && f.profile.skills.length > 0)
            ? f.profile.skills.map(s => `<span class="admin-badge" style="background: var(--gray-100); color: var(--gray-700); font-size: 9px; padding: 2px 6px; margin-right: 4px;">${s}</span>`).join('')
            : '<span style="color: var(--gray-600); font-size: 11px;">No skills added.</span>';
          
          const profileTitle = f.profile && f.profile.title ? f.profile.title : 'Creative Freelance Professional';
          const hourlyRate = f.profile && f.profile.hourlyRate ? f.profile.hourlyRate : 0;
          const completedGigs = f.completedCount || 0;
          const joinedOn = new Date(f.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

          return `
            <tr>
              <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                  <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--gradient); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; color: white;">
                    ${initials}
                  </div>
                  <div>
                    <h4 style="margin: 0; font-size: 13px; color: var(--dark);">@${f.username}</h4>
                    <span style="font-size: 10px; color: var(--gray-600);">${f.email}</span>
                  </div>
                </div>
              </td>
              <td>
                <div style="font-weight: 700; font-size: 13px; margin-bottom: 4px;">${profileTitle}</div>
                <div style="display: flex; flex-wrap: wrap; gap: 2px;">${skillsTags}</div>
              </td>
              <td style="font-weight: 800; font-size: 14px;">
                $${hourlyRate}/hr
              </td>
              <td style="font-weight: 700;">
                ⭐ ${f.rating ? f.rating.toFixed(1) : '5.0'}
              </td>
              <td style="font-weight: 600; color: var(--success);">
                ${completedGigs} jobs
              </td>
              <td style="font-size: 12px; color: var(--gray-600);">
                ${joinedOn}
              </td>
            </tr>
          `;
        }).join('');
      }
    } catch (err) {
      console.error(err);
    }
  }

  // --- CORE VIEW 4: JOBS BOARD MODERATION --->
  async function loadJobs() {
    try {
      const res = await fetch('/api/admin/jobs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();

      if (result.success && result.data.jobs) {
        cachedJobs = result.data.jobs;
        const body = document.getElementById('tblJobsBody');
        if (!body) return;

        if (cachedJobs.length === 0) {
          body.innerHTML = `
            <tr>
              <td colspan="7" style="text-align: center; color: var(--gray-600); padding: 40px;">No public job contracts queried.</td>
            </tr>
          `;
          return;
        }

        body.innerHTML = cachedJobs.map(j => {
          const clientUsername = j.client ? `@${j.client.username}` : 'Deleted Account';
          const hiredUsername = j.hiredFreelancer ? `@${j.hiredFreelancer.username}` : '<p style="color: var(--gray-600); font-style: italic;">No Hire</p>';
          
          const badgeClass = j.status === 'open' ? 'admin-badge-open' : (j.status === 'active' ? 'admin-badge-pending' : (j.status === 'completed' ? 'admin-badge-active' : 'admin-badge-banned'));
          const limitDate = j.deadline ? j.deadline : 'flexible';

          return `
            <tr id="job-tbl-row-${j._id}">
              <td style="font-weight: 700; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${j.title}">
                ${j.title}
                <div style="font-weight: normal; font-size: 11px; color: var(--gray-600);">${j.category}</div>
              </td>
              <td style="font-size: 13px;">${clientUsername}</td>
              <td style="font-size: 13px;">${hiredUsername}</td>
              <td style="font-weight: 800; font-family: monospace; font-size: 14px;">$${j.budget.toFixed(2)}</td>
              <td><span class="admin-badge ${badgeClass}">${j.status}</span></td>
              <td style="font-size: 12px; color: var(--gray-600);">${limitDate}</td>
              <td>
                <div style="display: flex; gap: 6px; justify-content: flex-end;">
                  <button class="btn btn-secondary btn-job-edit" data-id="${j._id}" style="padding: 4px 8px; font-size: 11px;">Edit</button>
                  <button class="btn btn-secondary btn-job-cxl" data-id="${j._id}" style="padding: 4px 8px; font-size: 11px; color: var(--error); border-color: var(--error);" ${j.status === 'cancelled' || j.status === 'completed' ? 'disabled' : ''}>Force Cancel</button>
                  <button class="btn btn-secondary btn-job-force-release" data-id="${j._id}" style="padding: 4px 8px; font-size: 11px; color: var(--success); border-color: var(--success);" ${j.status !== 'active' ? 'disabled' : ''}>Complete & Release</button>
                  <button class="btn btn-secondary btn-job-del" data-id="${j._id}" style="padding: 4px 8px; font-size: 11px; background: rgba(239, 68, 68, 0.05); color: var(--error); border-color: transparent;"><i class="fa-solid fa-trash" style="font-size: 11px;"></i></button>
                </div>
              </td>
            </tr>
          `;
        }).join('');

        attachJobsEventListeners();
      }
    } catch(err) {
      console.error(err);
    }
  }

  function attachJobsEventListeners() {
    // Edit Job Details Modal Trigger
    document.querySelectorAll('.btn-job-edit').forEach(btn => {
      btn.addEventListener('click', async () => {
        const jId = btn.dataset.id;
        try {
          const res = await fetch(`/api/admin/jobs/${jId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const result = await res.json();
          if (result.success && result.data.job) {
            const j = result.data.job;
            
            document.getElementById('edit_job_id').value = j._id;
            document.getElementById('edit_job_title').value = j.title;
            document.getElementById('edit_job_description').value = j.description;
            document.getElementById('edit_job_category').value = j.category;
            document.getElementById('edit_job_budget').value = j.budget;
            document.getElementById('edit_job_status').value = j.status;
            document.getElementById('edit_job_deadline').value = j.deadline || '';
            document.getElementById('edit_job_skills').value = j.skills ? j.skills.join(', ') : '';

            openModal('modalEditJob');
          }
        } catch (err) {
          console.error(err);
        }
      });
    });

    // Cancel Job with prompt
    document.querySelectorAll('.btn-job-cxl').forEach(btn => {
      btn.addEventListener('click', () => {
        moderateJobStatus(btn.dataset.id, 'cancelled');
      });
    });

    // Complete active job and release funds directly
    document.querySelectorAll('.btn-job-force-release').forEach(btn => {
      btn.addEventListener('click', () => {
        moderateJobStatus(btn.dataset.id, 'completed');
      });
    });

    // Purge/Delete entirely
    document.querySelectorAll('.btn-job-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        const jId = btn.dataset.id;
        if (!confirm('Purge Job Listing: Delete job and return secure escrow budgets safely?')) return;
        
        try {
          const res = await fetch(`/api/admin/jobs/${jId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const result = await res.json();
          if (result.success) {
            showToast(result.message, 'success');
            pushSystemIncident('CONTRACT PURGE', 'Entire project posting deleted and wiped.', 'error');
            loadJobs();
          } else {
            showToast(result.message || 'Purging failed.', 'error');
          }
        } catch (err) {
          console.error(err);
        }
      });
    });
  }

  async function moderateJobStatus(jobId, targetStatus) {
    const confirmationMsg = targetStatus === 'cancelled' 
      ? 'Perform Admin Forced Cancellation? Escrow funds will automatically dispatch return refunds to employer wallet balance!'
      : 'Perform Admin Forced Milestone Clearance? Locked escrow balance will immediately disburse into hired freelancer wallet account!';
      
    if (!confirm(confirmationMsg)) return;

    try {
      const res = await fetch(`/api/admin/moderate-job/${jobId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: targetStatus })
      });
      const result = await res.json();

      if (result.success) {
        showToast(`Job listings state forced updated to [${targetStatus.toUpperCase()}] successfully.`, 'success');
        pushSystemIncident('CONTRACT MODERATED', `Job milestone transitioned status to matches: ${targetStatus.toUpperCase()}`, 'success');
        loadJobs();
      } else {
        showToast(result.message || 'Moderation edit failed.', 'error');
      }
    } catch (err) {
      console.error(err);
    }
  }

  // --- CORE VIEW 5: BIDS OVERSIGHT BOARD --->
  async function loadBids() {
    try {
      const res = await fetch('/api/admin/bids', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();

      if (result.success && result.data.bids) {
        cachedBids = result.data.bids;
        const body = document.getElementById('tblBidsBody');
        if (!body) return;

        if (cachedBids.length === 0) {
          body.innerHTML = `
            <tr>
              <td colspan="6" style="text-align: center; color: var(--gray-600); padding: 40px;">No freelancer proposals recorded.</td>
            </tr>
          `;
          return;
        }

        body.innerHTML = cachedBids.map(b => {
          const jobTitle = b.job ? b.job.title : 'Deleted Project';
          const freeName = b.freelancer ? `@${b.freelancer.username}` : 'Purple Contractor';
          const bStatus = b.status || 'pending';
          const bClass = bStatus === 'pending' ? 'admin-badge-pending' : (bStatus === 'accepted' ? 'admin-badge-active' : 'admin-badge-banned');

          return `
            <tr>
              <td style="font-weight: 700; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${jobTitle}">${jobTitle}</td>
              <td style="font-size: 13px;">${freeName}</td>
              <td style="font-weight: 800; font-family: monospace;">$${b.amount}</td>
              <td style="font-size: 13px;">${b.deliveryDays} estimated days</td>
              <td style="font-size: 12px; color: var(--gray-600); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${b.proposal}">
                ${b.proposal}
              </td>
              <td><span class="admin-badge ${bClass}">${bStatus}</span></td>
            </tr>
          `;
        }).join('');
      }
    } catch (err) {
      console.error(err);
    }
  }

  // --- CORE VIEW 6: ESCROW PAYMENTS MANUAL DISPENSERS --->
  async function loadPayments() {
    try {
      const res = await fetch('/api/admin/payments', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();

      if (result.success && result.data.payments) {
        cachedPayments = result.data.payments;
        const body = document.getElementById('tblPaymentsBody');
        if (!body) return;

        if (cachedPayments.length === 0) {
          body.innerHTML = `
            <tr>
              <td colspan="7" style="text-align: center; color: var(--gray-600); padding: 40px;">No platform payment history filed.</td>
            </tr>
          `;
          return;
        }

        body.innerHTML = cachedPayments.map(p => {
          const clientUsername = p.payer ? `@${p.payer.username}` : 'Deleted Account';
          const hiredUsername = p.receiver ? `@${p.receiver.username}` : 'Purple contractor';
          const jTitle = p.job ? p.job.title : 'Unknown Project';
          const pStatusClass = p.status === 'escrow' ? 'admin-badge-escrow' : (p.status === 'released' ? 'admin-badge-active' : 'admin-badge-banned');
          const transacDate = new Date(p.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

          const operationBtn = p.status === 'escrow'
            ? `<button class="btn btn-secondary btn-release-payout" data-id="${p._id}" style="padding: 6px 12px; font-size: 12px; background: rgba(16,185,129,0.05); color: var(--success); border-color: var(--success);">Disburse Escrow</button>`
            : `<button class="btn btn-secondary btn-view-invoice" data-id="${p._id}" style="padding: 6px 12px; font-size: 12px;">Invoice Receipt</button>`;

          return `
            <tr>
              <td>
                <span style="font-family: monospace; font-size: 12px;" class="text-gradient">TXN-${p._id.substring(18).toUpperCase()}</span>
                <div style="font-size: 11px; color: var(--gray-600); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${jTitle}">Job ID: ${p.job ? p.job._id : 'N/A'}</div>
              </td>
              <td style="font-weight: 800; font-family: monospace; font-size: 15px;">$${p.amount.toFixed(2)}</td>
              <td style="font-size: 13px;">${clientUsername}</td>
              <td style="font-size: 13px;">${hiredUsername}</td>
              <td><span class="admin-badge ${pStatusClass}">${p.status}</span></td>
              <td style="font-size: 12px; color: var(--gray-600);">${transacDate}</td>
              <td style="text-align: right;">${operationBtn}</td>
            </tr>
          `;
        }).join('');

        attachPaymentsEventListeners();
      }
    } catch(err) {
      console.error(err);
    }
  }

  function attachPaymentsEventListeners() {
    // Release payout
    document.querySelectorAll('.btn-release-payout').forEach(btn => {
      btn.addEventListener('click', async () => {
        const transacId = btn.dataset.id;
        if (!confirm('FORCED FINANCIAL RESOLUTION: Disburse and clear this transaction milestone escrow funds immediately into freelancer wallet profile?')) return;

        try {
          const res = await fetch(`/api/admin/payments/release/${transacId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const result = await res.json();
          if (result.success) {
            showToast('Milestone Escrow assigned directly. Funds successfully released!', 'success');
            pushSystemIncident('ESCROW CONCLUDED', `Cleared virtual payout amount of $${result.data.payment.amount}`, 'success');
            loadPayments();
          } else {
            showToast(result.message || 'Payment release failed.', 'error');
          }
        } catch (err) {
          console.error(err);
        }
      });
    });

    // View Invoice Modal
    document.querySelectorAll('.btn-view-invoice').forEach(btn => {
      btn.addEventListener('click', () => {
        const transacId = btn.dataset.id;
        const p = cachedPayments.find(item => item._id === transacId);
        if (!p) return;

        const customer = p.payer ? p.payer.username : 'Anonymous Buyer';
        const merchant = p.receiver ? p.receiver.username : 'Contractor';
        const project = p.job ? p.job.title : 'Wiped Platform Gig Listing';
        const clearingDate = new Date(p.updatedAt).toLocaleString();

        const contentHtml = `
          <div style="background: var(--light); padding: 16px; border-radius: 8px; border: 1px solid var(--gray-200); margin-bottom: 12px;">
            <p style="margin: 0; font-size: 11px; text-transform: uppercase; color: var(--gray-600); letter-spacing: 0.05em;">Transaction Invoice</p>
            <h4 style="margin: 4px 0 0; color: var(--primary); font-family: monospace; font-size: 18px;">TXN-${p._id.toUpperCase()}</h4>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div><b>Associated Job:</b> ${project}</div>
            <div><b>Billed Employer:</b> @${customer} (${p.payer ? p.payer.email : 'No email'})</div>
            <div><b>Remit Contractor:</b> @${merchant} (${p.receiver ? p.receiver.email : 'No email'})</div>
            <div><b>Settlement Value:</b> <span style="font-weight: 800; font-family: monospace;">$${p.amount.toFixed(2)} USD</span></div>
            <div><b>Skillnest Tax (3% commission):</b> $${(p.amount * 0.03).toFixed(2)}</div>
            <div><b>Ledger Status:</b> <span style="color: var(--success); font-weight: 700; text-transform: uppercase;">${p.status}</span></div>
            <div><b>Final Clearance Timestamp:</b> ${clearingDate}</div>
          </div>
        `;

        document.getElementById('lblDetailModalTitle').textContent = 'Audit Escrow Invoice Receipt';
        document.getElementById('divDetailModalBox').innerHTML = contentHtml;
        openModal('modalGeneralDetails');
      });
    });
  }

  // --- CORE VIEW 7: COMMUNITY DISPUTES MODERATOR INCIDENTS --->
  async function loadDisputes() {
    try {
      const res = await fetch('/api/admin/reports', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();

      if (result.success && result.data.reports) {
        cachedDisputes = result.data.reports;
        const body = document.getElementById('tblDisputesBody');
        if (!body) return;

        if (cachedDisputes.length === 0) {
          body.innerHTML = `
            <tr>
              <td colspan="7" style="text-align: center; color: var(--gray-600); padding: 40px;">No dispute logs returned. Let's seed DB sandbox!</td>
            </tr>
          `;
          return;
        }

        body.innerHTML = cachedDisputes.map(r => {
          const reporterUsername = r.reporter ? `@${r.reporter.username}` : 'Deleted Account';
          const reportedUsername = r.reported ? `@${r.reported.username}` : 'Unidentified Party';
          const projectTitle = r.job ? r.job.title : 'Independent Account Dispute';
          
          const badgeClass = r.status === 'pending' ? 'admin-badge-pending' : (r.status === 'investigating' ? 'admin-badge-escrow' : (r.status === 'resolved' ? 'admin-badge-active' : 'admin-badge-banned'));
          const filedDate = new Date(r.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

          return `
            <tr>
              <td style="font-weight: 700; color: var(--error);">${r.reason}</td>
              <td style="font-size: 13px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${r.description}">
                ${r.description}
              </td>
              <td style="font-size: 12px; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${projectTitle}">
                ${r.job ? projectTitle : '<i style="color: var(--gray-600);">Independent</i>'}
              </td>
              <td style="font-size: 13px;">
                <span class="text-gradient">${reporterUsername}</span> vs <span>${reportedUsername}</span>
              </td>
              <td><span class="admin-badge ${badgeClass}">${r.status}</span></td>
              <td style="font-size: 12px; color: var(--gray-600);">${filedDate}</td>
              <td style="text-align: right;">
                <div style="display: flex; gap: 4px; justify-content: flex-end;">
                  <button class="btn btn-secondary btn-dispute-resolve" data-id="${r._id}" data-action="resolved" style="padding: 4px 8px; font-size: 11px; background: rgba(16,185,129,0.05); color: var(--success); border-color: var(--success);" ${r.status === 'resolved' ? 'disabled' : ''}>Resolve</button>
                  <button class="btn btn-secondary btn-dispute-resolve" data-id="${r._id}" data-action="investigating" style="padding: 4px 8px; font-size: 11px; color: var(--primary); border-color: var(--primary);" ${r.status === 'investigating' || r.status === 'resolved' ? 'disabled' : ''}>Audit</button>
                  <button class="btn btn-secondary btn-dispute-resolve" data-id="${r._id}" data-action="rejected" style="padding: 4px 8px; font-size: 11px; color: var(--gray-600); border-color: var(--gray-600);" ${r.status === 'rejected' || r.status === 'resolved' ? 'disabled' : ''}>Dismiss</button>
                </div>
              </td>
            </tr>
          `;
        }).join('');

        attachDisputesEventListeners();
      }
    } catch (err) {
      console.error(err);
    }
  }

  function attachDisputesEventListeners() {
    document.querySelectorAll('.btn-dispute-resolve').forEach(btn => {
      btn.addEventListener('click', async () => {
        const disputeId = btn.dataset.id;
        const targetActionStatus = btn.dataset.action;
        
        if (!confirm(`Confirm dispute assessment: Toggling conflict ticket state to [${targetActionStatus.toUpperCase()}] status?`)) return;

        try {
          const res = await fetch(`/api/admin/reports/resolve/${disputeId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: targetActionStatus })
          });
          const result = await res.json();
          if (result.success) {
            showToast(`Incident classification edited successfully to ${targetActionStatus.toUpperCase()}.`, 'success');
            pushSystemIncident('INCIDENT UPDATE', `Dispute toggled status action: ${targetActionStatus.toUpperCase()}`, 'success');
            loadDisputes();
            loadMetrics(); // refresh counters!
          } else {
            showToast(result.message || 'Updating dispute state failed.', 'error');
          }
        } catch (err) {
          console.error(err);
        }
      });
    });
  }

  // --- CORE VIEW 8: HELPDESK TICKETS & MESSAGES ---
  async function loadTickets() {
    try {
      const res = await fetch('/api/admin/tickets', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();

      if (result.success && result.data.tickets) {
        cachedTickets = result.data.tickets;
        const listContainer = document.getElementById('ticketScrollList');
        if (!listContainer) return;

        if (cachedTickets.length === 0) {
          listContainer.innerHTML = `
            <div style="padding: 30px; text-align: center; color: var(--gray-600); font-size: 12px;">No active support tickets.</div>
          `;
          return;
        }

        listContainer.innerHTML = cachedTickets.map(t => {
          const authorName = t.user ? `@${t.user.username}` : 'Purple Account';
          const latestMsg = t.messages && t.messages.length > 0 ? t.messages[t.messages.length - 1].message : 'No message recorded.';
          const tColor = t.status === 'open' ? 'var(--primary)' : 'var(--gray-600)';
          const activeClassState = t._id === selectedTicketId ? 'active' : '';

          return `
            <div class="support-ticket-item ${activeClassState}" id="support-item-id-${t._id}" data-id="${t._id}">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 4px;">
                <span class="text-gradient" style="font-weight: 700; font-size: 13px;">${authorName}</span>
                <span class="admin-badge" style="background: ${t.status === 'open' ? 'rgba(99,102,241,0.1)' : 'rgba(100,116,139,0.1)'}; color: ${tColor}; font-size: 9px; padding: 2px 6px;">${t.status}</span>
              </div>
              <h5 style="margin: 0 0 4px; font-size: 12px; color: var(--dark);">${t.subject}</h5>
              <p style="margin: 0; font-size: 11px; color: var(--gray-600); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${latestMsg}</p>
            </div>
          `;
        }).join('');

        attachTicketsListListeners();
      }
    } catch (err) {
      console.error(err);
    }
  }

  function attachTicketsListListeners() {
    document.querySelectorAll('.support-ticket-item').forEach(item => {
      item.addEventListener('click', () => {
        selectedTicketId = item.dataset.id;
        document.querySelectorAll('.support-ticket-item').forEach(inner => inner.classList.remove('active'));
        item.classList.add('active');

        const activeTix = cachedTickets.find(sub => sub._id === selectedTicketId);
        if (activeTix) {
          renderActiveTicketChatSpace(activeTix);
        }
      });
    });
  }

  function renderActiveTicketChatSpace(ticket) {
    // Reveal chat areas
    document.getElementById('chatDefaultPrompt').style.display = 'none';
    document.getElementById('chatInputArea').style.display = 'flex';
    
    // Header Info
    const authorUsername = ticket.user ? `@${ticket.user.username}` : 'Platform Member';
    document.getElementById('lblSelectedTicketSubject').textContent = ticket.subject;
    document.getElementById('lblSelectedTicketAuthor').textContent = `Fled by: ${authorUsername} (${ticket.user ? ticket.user.email : 'no email'})`;

    // Status action toggler
    const toggleBtn = document.getElementById('btnToggleTicketStatus');
    if (toggleBtn) {
      toggleBtn.style.display = 'inline-block';
      toggleBtn.textContent = ticket.status === 'open' ? 'Close Ticket' : 'Reopen Ticket';
      toggleBtn.className = ticket.status === 'open' ? 'btn btn-secondary' : 'btn bg-gradient';
      
      // Remove old listener
      const clonedBtn = toggleBtn.cloneNode(true);
      toggleBtn.parentNode.replaceChild(clonedBtn, toggleBtn);
      
      clonedBtn.addEventListener('click', async () => {
        const toggleTarget = ticket.status === 'open' ? 'closed' : 'open';
        if (!confirm(`Swap ticketing resolution state to [${toggleTarget.toUpperCase()}]?`)) return;

        try {
          const res = await fetch(`/api/admin/tickets/status/${ticket._id}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: toggleTarget })
          });
          const result = await res.json();
          if (result.success) {
            showToast(`Support Ticket state formulated to ${toggleTarget.toUpperCase()}.`, 'success');
            pushSystemIncident('SUPPORT RESOLVED', `Formulated support ticket resolution: ${ticket.subject}`, 'success');
            loadTickets();
            
            // Re-render
            const revisedTicket = result.data.ticket;
            renderActiveTicketChatSpace(revisedTicket);
          }
        } catch (err) {
          console.error(err);
        }
      });
    }

    // Messages Bubble box
    const bubbleBox = document.getElementById('chatBubbleBox');
    if (bubbleBox && ticket.messages) {
      bubbleBox.innerHTML = ticket.messages.map(msg => {
        const isAdminReplied = msg.sender.includes('(Admin');
        const bubbleTypeClass = isAdminReplied ? 'admin' : 'user';
        const senderBadgeColor = isAdminReplied ? '#cbd5e1' : '#4f46e5';
        
        return `
          <div class="support-bubble ${bubbleTypeClass}">
            <span style="font-size: 10px; font-weight: 700; display: block; margin-bottom: 2px; color: ${senderBadgeColor};">${msg.sender}</span>
            <div>${msg.message}</div>
            <span style="font-size: 9px; display: block; text-align: right; margin-top: 4px; color: rgba(0,0,0,0.3); font-family: monospace;">${new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        `;
      }).join('');

      // Auto-Scroll to bottom
      bubbleBox.scrollTop = bubbleBox.scrollHeight;
    }
  }

  // Submit Admin Support Chat message reply trigger
  const btnSendAdminReply = document.getElementById('btnSendAdminReply');
  const txtAdminReplySource = document.getElementById('txtAdminReplySource');

  if (btnSendAdminReply && txtAdminReplySource) {
    btnSendAdminReply.addEventListener('click', submitAdminTicketChatReply);
    txtAdminReplySource.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') submitAdminTicketChatReply();
    });
  }

  async function submitAdminTicketChatReply() {
    const replyText = txtAdminReplySource.value.trim();
    if (!replyText || !selectedTicketId) return;

    try {
      const res = await fetch(`/api/admin/tickets/reply/${selectedTicketId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ replyText })
      });
      const result = await res.json();
      if (result.success) {
        txtAdminReplySource.value = '';
        renderActiveTicketChatSpace(result.data.ticket);
        loadTickets();
      } else {
        showToast(result.message || 'Failed publishing support reply.', 'error');
      }
    } catch (err) {
      console.error(err);
    }
  }

  // --- CORE VIEW 9: INTERACTIVE CHARTS & ANALYTICS ---
  function loadAnalytics() {
    // Generate gorgeous responsive charts using Chart.js
    renderAnalyticsCategoriesChart();
    renderAnalyticsUsersChart();
    renderAnalyticsFinancialsChart();
  }

  // Chart Rendering helpers
  function renderDashboardRevenueChart() {
    const canvas = document.getElementById('chartDashboardRevenue');
    if (!canvas) return;

    if (chartInstanceRevenue) chartInstanceRevenue.destroy();
    
    // Read cached financials metrics or generate default mock points
    const escrowAmt = cachedMetrics ? cachedMetrics.financials.cashInEscrow : 1200;
    const releasedAmt = cachedMetrics ? cachedMetrics.financials.volumeReleased : 300;

    const ctx = canvas.getContext('2d');
    chartInstanceRevenue = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Locked in Escrow', 'Disbursed volume'],
        datasets: [{
          data: [escrowAmt, releasedAmt],
          backgroundColor: ['#f59e0b', '#10b981'],
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 12, font: { family: 'Inter', size: 12 } }
          }
        }
      }
    });
  }

  function renderAnalyticsCategoriesChart() {
    const canvas = document.getElementById('chartAnalyticsCategories');
    if (!canvas) return;

    if (chartInstanceCategories) chartInstanceCategories.destroy();

    // Map categories count dynamically
    const categoriesCountMap = {
      'Development & IT': 0,
      'Design': 0,
      'Writing': 0,
      'Marketing': 0,
      'Business': 0
    };

    cachedJobs.forEach(job => {
      const cat = job.category;
      if (categoriesCountMap[cat] !== undefined) {
        categoriesCountMap[cat]++;
      } else {
        categoriesCountMap['Development & IT']++;
      }
    });

    const datasetValues = Object.values(categoriesCountMap);
    const ctx = canvas.getContext('2d');
    chartInstanceCategories = new Chart(ctx, {
      type: 'polarArea',
      data: {
        labels: ['IT & Devs', 'Designs', 'Copywritings', 'Marketings', 'Business consults'],
        datasets: [{
          label: 'Gigs category count',
          data: datasetValues.every(v => v === 0) ? [4, 2, 1, 0, 1] : datasetValues,
          backgroundColor: [
            'rgba(99, 102, 241, 0.7)',
            'rgba(168, 85, 247, 0.7)',
            'rgba(16, 185, 129, 0.7)',
            'rgba(245, 158, 11, 0.7)',
            'rgba(239, 68, 68, 0.7)'
          ],
          borderColor: '#ffffff',
          borderWidth: 1.5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 10, font: { size: 11 } } }
        }
      }
    });
  }

  function renderAnalyticsUsersChart() {
    const canvas = document.getElementById('chartAnalyticsUsers');
    if (!canvas) return;

    if (chartInstanceUsers) chartInstanceUsers.destroy();

    // Sum users dynamic roles count
    let freelancersVal = cachedUsers.filter(u => u.role === 'freelancer').length;
    let buyersVal = cachedUsers.filter(u => u.role === 'buyer').length;
    let adminsVal = cachedUsers.filter(u => u.role === 'admin').length;

    if (freelancersVal === 0 && buyersVal === 0) {
      freelancersVal = 5;
      buyersVal = 4;
      adminsVal = 1;
    }

    const ctx = canvas.getContext('2d');
    chartInstanceUsers = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Freelancers', 'Buyers / Employers', 'Admins'],
        datasets: [{
          label: 'Registered profiles count',
          data: [freelancersVal, buyersVal, adminsVal],
          backgroundColor: ['#6366f1', '#a855f7', '#475569'],
          borderRadius: 8,
          borderWidth: 0,
          barThickness: 25
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, grid: { borderDash: [5, 5] } },
          x: { grid: { display: false } }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }

  function renderAnalyticsFinancialsChart() {
    const canvas = document.getElementById('chartAnalyticsFinancials');
    if (!canvas) return;

    if (chartInstanceFinancials) chartInstanceFinancials.destroy();

    // Core financial trends over time
    const ctx = canvas.getContext('2d');
    chartInstanceFinancials = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [
          {
            label: 'Total Platform Volume Disbursed ($)',
            data: [150, 420, 850, 1400, 2100, cachedMetrics ? cachedMetrics.financials.volumeReleased : 300],
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.05)',
            tension: 0.4,
            fill: true
          },
          {
            label: 'Locked in Escrow Balance ($)',
            data: [300, 500, 450, 600, 900, cachedMetrics ? cachedMetrics.financials.cashInEscrow : 1200],
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.05)',
            tension: 0.4,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { grid: { borderDash: [4, 4] } },
          x: { grid: { display: false } }
        },
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12 } }
        }
      }
    });
  }

  // --- CORE VIEW 10: SITES CONFIG SESSIONS CONFIG --->
  async function loadLocalSettings() {
    try {
       const res = await fetch('/api/admin/settings', {
         headers: { 'Authorization': `Bearer ${token}` }
       });
       const result = await res.json();
       if (result.success && result.data && result.data.config) {
         const cfg = result.data.config;
         document.getElementById('cfg_siteName').value = cfg.siteName || 'Skillnest Platform';
         document.getElementById('cfg_commissionPct').value = cfg.commissionPct || 5;
         document.getElementById('cfg_supportEmail').value = cfg.supportEmail || 'support@Skillnest.com';
         document.getElementById('cfg_sandboxMode').checked = !!cfg.sandboxMode;
         document.getElementById('cfg_stripeKey').value = cfg.stripeKey || '••••••••••••••••••••••••••••••••••••';
         document.getElementById('cfg_auditMode').value = cfg.auditMode || 'permissive';
         
         // Injected SMTP, OAuth & Redis
         document.getElementById('cfg_smtpHost').value = cfg.smtpHost || '';
         document.getElementById('cfg_smtpPort').value = cfg.smtpPort || '';
         document.getElementById('cfg_smtpUser').value = cfg.smtpUser || '';
         document.getElementById('cfg_smtpPass').value = cfg.smtpPass || '';
         document.getElementById('cfg_googleClientId').value = cfg.googleClientId || '';
         document.getElementById('cfg_googleClientSecret').value = cfg.googleClientSecret || '';
         document.getElementById('cfg_facebookAppId').value = cfg.facebookAppId || '';
         document.getElementById('cfg_facebookAppSecret').value = cfg.facebookAppSecret || '';
         document.getElementById('cfg_redisHost').value = cfg.redisHost || '';
         document.getElementById('cfg_redisPort').value = cfg.redisPort || '';
         document.getElementById('cfg_maintenanceMode').checked = !!cfg.maintenanceMode;

         // Also sync local storage for client-side templates that consume this
         localStorage.setItem('Skillnest_sys_cfg', JSON.stringify(cfg));
       }
    } catch (err) {
       console.error('Failed fetching settings from API:', err);
    }
  }

  const btnSaveConfig = document.getElementById('btnSaveConfig');
  if (btnSaveConfig) {
    btnSaveConfig.addEventListener('click', async () => {
       const cfgBag = {
         siteName: document.getElementById('cfg_siteName').value.trim(),
         commissionPct: Number(document.getElementById('cfg_commissionPct').value),
         supportEmail: document.getElementById('cfg_supportEmail').value.trim(),
         sandboxMode: document.getElementById('cfg_sandboxMode').checked,
         stripeKey: document.getElementById('cfg_stripeKey').value.trim(),
         auditMode: document.getElementById('cfg_auditMode').value,
         // SMTP, OAuth & Redis
         smtpHost: document.getElementById('cfg_smtpHost').value.trim(),
         smtpPort: Number(document.getElementById('cfg_smtpPort').value) || 465,
         smtpUser: document.getElementById('cfg_smtpUser').value.trim(),
         smtpPass: document.getElementById('cfg_smtpPass').value,
         googleClientId: document.getElementById('cfg_googleClientId').value.trim(),
         googleClientSecret: document.getElementById('cfg_googleClientSecret').value,
         facebookAppId: document.getElementById('cfg_facebookAppId').value.trim(),
         facebookAppSecret: document.getElementById('cfg_facebookAppSecret').value,
         redisHost: document.getElementById('cfg_redisHost').value.trim(),
         redisPort: Number(document.getElementById('cfg_redisPort').value) || 6379,
         maintenanceMode: document.getElementById('cfg_maintenanceMode').checked
       };

       try {
         const res = await fetch('/api/admin/settings', {
           method: 'POST',
           headers: {
             'Content-Type': 'application/json',
             'Authorization': `Bearer ${token}`
           },
           body: JSON.stringify({ config: cfgBag })
         });
         const result = await res.json();
         if (result.success) {
           localStorage.setItem('Skillnest_sys_cfg', JSON.stringify(cfgBag));
           showToast('Platform administrative presets saved securely on the server!', 'success');
           pushSystemIncident('CONFIG MODERNIZED', 'Platform administrative presets modernized successfully.', 'success');
         } else {
           showToast(result.message || 'Failed to save configuration settings.', 'error');
         }
      } catch (err) {
        console.error('Failed saving system configurations:', err);
        showToast('Server connection error while saving configurations.', 'error');
      }
    });
  }

  // --- INTERACTIVE MODAL SUBMISSIONS ---
  
  // Register Account Admin submission
  const btnSubmitCreateUser = document.getElementById('btnSubmitCreateUser');
  if (btnSubmitCreateUser) {
    btnSubmitCreateUser.addEventListener('click', async () => {
      const username = document.getElementById('m_user_name').value.trim();
      const email = document.getElementById('m_user_email').value.trim();
      const password = document.getElementById('m_user_password').value.trim();
      const role = document.getElementById('m_user_role').value;
      const balance = Number(document.getElementById('m_user_bal').value);

      if (!username || !email || !password) {
        showToast('Required fields username, email and pass missing.', 'error');
        return;
      }

      try {
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ username, email, password, role, balance })
        });
        const result = await res.json();
        if (result.success) {
          showToast(`Account @${username} was onboarded successfully!`, 'success');
          
          // Clear inputs
          document.getElementById('m_user_name').value = '';
          document.getElementById('m_user_email').value = '';
          document.getElementById('m_user_password').value = '';
          
          closeModal('modalCreateUser');
          loadUsers();
          loadMetrics();
        } else {
          showToast(result.message || 'Onboarding account failed.', 'error');
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  // Edit User Registry submission
  const btnSubmitEditUser = document.getElementById('btnSubmitEditUser');
  if (btnSubmitEditUser) {
    btnSubmitEditUser.addEventListener('click', async () => {
      const uId = document.getElementById('edit_user_id').value;
      const username = document.getElementById('edit_user_name').value.trim();
      const email = document.getElementById('edit_user_email').value.trim();
      const role = document.getElementById('edit_user_role').value;
      const balance = Number(document.getElementById('edit_user_bal').value);
      const status = document.getElementById('edit_user_status').value;
      const rating = Number(document.getElementById('edit_user_rate').value);
      const kycStatus = document.getElementById('edit_user_kyc').value;
      const badges = document.getElementById('edit_user_badges').value.trim();

      try {
        const res = await fetch(`/api/admin/users/${uId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ username, email, role, balance, status, rating, kycStatus, badges })
        });
        const result = await res.json();
        if (result.success) {
          showToast('User record modified successfully by administration.', 'success');
          closeModal('modalEditUser');
          loadUsers();
          loadMetrics();
        } else {
          showToast(result.message || 'Edits submission failed.', 'error');
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  // Edit Job details submission
  const btnSubmitEditJob = document.getElementById('btnSubmitEditJob');
  if (btnSubmitEditJob) {
    btnSubmitEditJob.addEventListener('click', async () => {
      const jId = document.getElementById('edit_job_id').value;
      const title = document.getElementById('edit_job_title').value.trim();
      const description = document.getElementById('edit_job_description').value.trim();
      const category = document.getElementById('edit_job_category').value;
      const budget = Number(document.getElementById('edit_job_budget').value);
      const status = document.getElementById('edit_job_status').value;
      const deadline = document.getElementById('edit_job_deadline').value;
      const skills = document.getElementById('edit_job_skills').value.trim();

      try {
        const res = await fetch(`/api/admin/jobs/${jId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ title, description, category, budget, status, deadline, skills })
        });
        const result = await res.json();
        if (result.success) {
          showToast('Job posting listings modified successfully.', 'success');
          closeModal('modalEditJob');
          loadJobs();
          loadMetrics();
        } else {
          showToast(result.message || 'Gigs edits failed.', 'error');
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  // Launch report modal submission
  const btnSubmitLaunchReport = document.getElementById('btnSubmitLaunchReport');
  if (btnSubmitLaunchReport) {
    btnSubmitLaunchReport.addEventListener('click', async () => {
      const reason = document.getElementById('m_rep_reason').value;
      const description = document.getElementById('m_rep_desc').value.trim();
      const jobId = document.getElementById('m_rep_job').value.trim();
      const reportedId = document.getElementById('m_rep_reported').value.trim();

      if (!description) {
        showToast('Describe the incident before launching.', 'error');
        return;
      }

      try {
        const res = await fetch('/api/admin/public-reports', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ reason, description, jobId, reportedId })
        });
        const result = await res.json();
        if (result.success) {
          showToast('Conflict incident filed successfully into support squad audits.', 'success');
          document.getElementById('m_rep_desc').value = '';
          document.getElementById('m_rep_job').value = '';
          document.getElementById('m_rep_reported').value = '';
          
          closeModal('modalLaunchReport');
          loadDisputes();
          loadMetrics();
        } else {
          showToast(result.message || 'Failed launching report.', 'error');
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  // Create demo ticket support submission
  const btnSubmitLaunchTicket = document.getElementById('btnSubmitLaunchTicket');
  if (btnSubmitLaunchTicket) {
    btnSubmitLaunchTicket.addEventListener('click', async () => {
      const subject = document.getElementById('m_tix_subject').value.trim();
      const initialMessage = document.getElementById('m_tix_message').value.trim();

      if (!subject || !initialMessage) {
        showToast('Subject & inquiry descriptions are required core details.', 'error');
        return;
      }

      try {
        const res = await fetch('/api/admin/public-tickets', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ subject, initialMessage })
        });
        const result = await res.json();
        if (result.success) {
          showToast('Demonstration customer care ticket submitted!', 'success');
          document.getElementById('m_tix_subject').value = '';
          document.getElementById('m_tix_message').value = '';

          closeModal('modalLaunchTicket');
          loadTickets();
          loadMetrics();
        } else {
          showToast(result.message || 'Inquiry submission failed.', 'error');
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  // --- GENERAL POPUP TOGGLERS HELPERS ---
  const btnCreateUser = document.getElementById('btnCreateUser');
  if (btnCreateUser) {
    btnCreateUser.addEventListener('click', () => openModal('modalCreateUser'));
  }

  const btnLaunchReportModal = document.getElementById('btnLaunchReportModal');
  if (btnLaunchReportModal) {
    btnLaunchReportModal.addEventListener('click', () => openModal('modalLaunchReport'));
  }

  const btnLaunchTicketModal = document.getElementById('btnLaunchTicketModal');
  if (btnLaunchTicketModal) {
    btnLaunchTicketModal.addEventListener('click', () => openModal('modalLaunchTicket'));
  }

  // Handle generic dismiss class tags
  document.querySelectorAll('.btn-close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-modal-overlay').forEach(overlay => {
        overlay.classList.remove('show');
      });
    });
  });

  // Global overlay click dismiss safety
  document.querySelectorAll('.admin-modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('show');
    });
  });

  function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('show');
  }

  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('show');
  }

  // --- CORE VIEW 11: GIGS / SERVICES MANAGEMENT CATALOG ---
  let cachedGigs = [];
  async function loadGigs() {
    try {
      const res = await fetch('/api/admin/gigs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();

      if (result.success && result.data.gigs) {
        cachedGigs = result.data.gigs;
        renderGigsTable(cachedGigs);
      }
    } catch (err) {
      console.error('Error loading gigs catalog: ', err);
    }
  }

  function renderGigsTable(gigs) {
    const listContainer = document.getElementById('tblGigsBody');
    if (!listContainer) return;

    if (gigs.length === 0) {
      listContainer.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--gray-600); padding: 40px;">No freelance gigs or services listed.</td>
        </tr>
      `;
      return;
    }

    listContainer.innerHTML = gigs.map(g => {
      const ownerName = g.owner ? `@${g.owner.username}` : 'Platform Member';
      const isFeatChecked = g.isFeatured ? 'admin-badge-active' : 'admin-badge-pending';
      const isFeatLabel = g.isFeatured ? 'Featured' : 'Standard';
      const gStatusStyle = g.status === 'active' ? 'admin-badge-active' : (g.status === 'hidden' ? 'admin-badge-pending' : 'admin-badge-banned');
      const gStatusLabel = g.status || 'active';

      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <img src="${g.imageUrl || 'https://images.unsplash.com/photo-1542744094-3a31f103e35f?w=120&auto=format&fit=crop&q=60'}" style="width: 44px; height: 32px; border-radius: 4px; object-fit: cover; border: 1px solid var(--gray-200);" alt="" referrerPolicy="no-referrer">
              <div style="overflow: hidden; max-width: 250px;">
                <div style="font-weight: 700; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;" title="${g.title}">${g.title}</div>
                <div style="font-size: 11px; color: var(--gray-600); text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">Tags: ${g.tags ? g.tags.join(', ') : 'None'}</div>
              </div>
            </div>
          </td>
          <td style="font-size: 13px;">${ownerName}</td>
          <td style="font-size: 13px;"><span style="background: rgba(99,102,241,0.06); color: var(--primary); padding: 3px 8px; border-radius: 12px; font-weight: 500;">${g.category}</span></td>
          <td style="font-weight: 800; font-family: monospace; font-size: 14px;">$${g.price}</td>
          <td style="font-size: 12px;">${g.salesCount || 0} sales</td>
          <td>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <span class="admin-badge ${gStatusStyle}">${gStatusLabel}</span>
              <span class="admin-badge ${isFeatChecked}">${isFeatLabel}</span>
            </div>
          </td>
          <td>
            <div style="display: flex; gap: 4px; justify-content: flex-end;">
              <button class="btn btn-secondary btn-gig-edit" data-id="${g._id}" style="padding: 4px 8px; font-size: 11px; font-weight: 600;">Edit</button>
              <button class="btn btn-secondary btn-gig-feature" data-id="${g._id}" style="padding: 4px 8px; font-size: 11px; background: rgba(245,158,11,0.06); color: #d97706; border-color: #f59e0b;">Feature</button>
              <button class="btn btn-secondary btn-gig-delete" data-id="${g._id}" style="padding: 4px 8px; font-size: 11px; color: var(--error); border-color: rgba(239, 68, 68, 0.45);">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    attachGigsTableListeners();
  }

  function attachGigsTableListeners() {
    // Edit Gig details Clicked
    document.querySelectorAll('.btn-gig-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const gigId = btn.dataset.id;
        const g = cachedGigs.find(item => item._id === gigId);
        if (!g) return;

        document.getElementById('edit_gig_id').value = g._id;
        document.getElementById('edit_gig_title').value = g.title;
        document.getElementById('edit_gig_description').value = g.description;
        document.getElementById('edit_gig_category').value = g.category || 'Development & IT';
        document.getElementById('edit_gig_price').value = g.price;
        document.getElementById('edit_gig_delivery').value = g.deliveryTime || 3;
        document.getElementById('edit_gig_tags').value = g.tags ? g.tags.join(', ') : '';
        document.getElementById('edit_gig_status').value = g.status || 'active';
        document.getElementById('edit_gig_featured').checked = !!g.isFeatured;

        openModal('modalEditGig');
      });
    });

    // Toggle Feature dynamic
    document.querySelectorAll('.btn-gig-feature').forEach(btn => {
      btn.addEventListener('click', async () => {
        const gigId = btn.dataset.id;
        const g = cachedGigs.find(item => item._id === gigId);
        if (!g) return;

        const targetFeat = !g.isFeatured;
        
        try {
          const res = await fetch(`/api/admin/gigs/${gigId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ isFeatured: targetFeat })
          });
          const result = await res.json();
          if (result.success) {
            showToast(targetFeat ? 'Gig featured beautifully on homepage listings!' : 'Featured status cleared from gig offer.', 'success');
            pushSystemIncident('GIG MODERNIZED', `Featured flag toggled on gig: "${g.title}"`, 'success');
            loadGigs();
            loadMetrics();
          } else {
            showToast('Unable to adjust featured status.', 'error');
          }
        } catch (err) {
          console.error(err);
        }
      });
    });

    // Delete Gig Clicked
    document.querySelectorAll('.btn-gig-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const gigId = btn.dataset.id;
        if (!confirm('FORCED REMOVAL: Delete this freelancer gig offer listed on the marketplace permanently?')) return;

        try {
          const res = await fetch(`/api/admin/gigs/${gigId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const result = await res.json();
          if (result.success) {
            showToast('Gig catalog listing removed from the platform.', 'success');
            pushSystemIncident('GIG DELETED', 'Listed service offer deleted permanently.', 'warning');
            loadGigs();
            loadMetrics();
          } else {
            showToast('Failed to delete gig.', 'error');
          }
        } catch (err) {
          console.error(err);
        }
      });
    });
  }

  // Submit Edit Gig details form
  const btnSubmitEditGig = document.getElementById('btnSubmitEditGig');
  if (btnSubmitEditGig) {
    btnSubmitEditGig.addEventListener('click', async () => {
      const gigId = document.getElementById('edit_gig_id').value;
      const title = document.getElementById('edit_gig_title').value.trim();
      const description = document.getElementById('edit_gig_description').value.trim();
      const category = document.getElementById('edit_gig_category').value;
      const price = Number(document.getElementById('edit_gig_price').value);
      const deliveryTime = Number(document.getElementById('edit_gig_delivery').value);
      const tagsString = document.getElementById('edit_gig_tags').value.trim();
      const status = document.getElementById('edit_gig_status').value;
      const isFeatured = document.getElementById('edit_gig_featured').checked;

      if (!title || !description || isNaN(price) || isNaN(deliveryTime)) {
        showToast('Required details missing or invalid.', 'error');
        return;
      }

      const tags = tagsString ? tagsString.split(',').map(t => t.trim()).filter(Boolean) : [];

      try {
        const res = await fetch(`/api/admin/gigs/${gigId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ title, description, category, price, deliveryTime, tags, status, isFeatured })
        });
        const result = await res.json();
        if (result.success) {
          showToast('Gig listing updated successfully!', 'success');
          closeModal('modalEditGig');
          loadGigs();
          loadMetrics();
        } else {
          showToast(result.message || 'Gig update failed.', 'error');
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  // --- REGULAR GIG FILTER EVENT LISTENERS ---
  const adminGigsSearch = document.getElementById('adminGigsSearch');
  const adminGigsCategoryFilter = document.getElementById('adminGigsCategoryFilter');
  const adminGigsStatusFilter = document.getElementById('adminGigsStatusFilter');

  function filterGigsCollection() {
    if (!cachedGigs || cachedGigs.length === 0) return;
    const searchVal = adminGigsSearch ? adminGigsSearch.value.toLowerCase().trim() : '';
    const categoryVal = adminGigsCategoryFilter ? adminGigsCategoryFilter.value : 'All';
    const statusVal = adminGigsStatusFilter ? adminGigsStatusFilter.value : 'All';

    const filtered = cachedGigs.filter(g => {
      const matchesSearch = !searchVal || g.title.toLowerCase().includes(searchVal) || 
                            (g.owner && g.owner.username.toLowerCase().includes(searchVal)) ||
                            (g.description && g.description.toLowerCase().includes(searchVal));
      const matchesCategory = categoryVal === 'All' || g.category === categoryVal;
      const matchesStatus = statusVal === 'All' || g.status === statusVal;

      return matchesSearch && matchesCategory && matchesStatus;
    });

    renderGigsTable(filtered);
  }

  if (adminGigsSearch) adminGigsSearch.addEventListener('keyup', filterGigsCollection);
  if (adminGigsCategoryFilter) adminGigsCategoryFilter.addEventListener('change', filterGigsCollection);
  if (adminGigsStatusFilter) adminGigsStatusFilter.addEventListener('change', filterGigsCollection);


  // --- CORE VIEW 12: CATEGORY MANAGEMENT ---
  let cachedCategories = [];
  async function loadCategories() {
    try {
      const res = await fetch('/api/admin/categories', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();

      if (result.success && result.data.categories) {
        cachedCategories = result.data.categories;
        renderCategoriesTable(cachedCategories);

        // Dynamically sync category filter dropdown options!
        if (adminGigsCategoryFilter) {
          const currentVal = adminGigsCategoryFilter.value;
          let filterHtml = '<option value="All">All Categories</option>';
          cachedCategories.forEach(c => {
            filterHtml += `<option value="${c.name}">${c.name}</option>`;
          });
          adminGigsCategoryFilter.innerHTML = filterHtml;
          adminGigsCategoryFilter.value = currentVal;
        }

        // Dynamically sync edit gig popup dropdown options!
        const editGigCategorySelect = document.getElementById('edit_gig_category');
        if (editGigCategorySelect) {
          let selectHtml = '';
          cachedCategories.forEach(c => {
            selectHtml += `<option value="${c.name}">${c.name}</option>`;
          });
          editGigCategorySelect.innerHTML = selectHtml;
        }

        // Dynamically sync job post category options!
        const editJobCategorySelect = document.getElementById('edit_job_category');
        if (editJobCategorySelect) {
          let selectHtml = '';
          cachedCategories.forEach(c => {
            selectHtml += `<option value="${c.name}">${c.name}</option>`;
          });
          editJobCategorySelect.innerHTML = selectHtml;
        }

      }
    } catch (err) {
      console.error('Error loading categories: ', err);
    }
  }

  function renderCategoriesTable(categories) {
    const listContainer = document.getElementById('tblCategoriesBody');
    if (!listContainer) return;

    if (categories.length === 0) {
      listContainer.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--gray-600); padding: 40px;">No platform business categories configured.</td>
        </tr>
      `;
      return;
    }

    listContainer.innerHTML = categories.map(c => {
      const regDate = new Date(c.createdAt || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

      return `
        <tr>
          <td>
            <div style="font-weight: 700; color: var(--dark); font-size: 14px;">${c.name}</div>
          </td>
          <td>
            <div style="font-family: monospace; font-size: 12px; background: rgba(0,0,0,0.05); padding: 2px 6px; border-radius: 4px; display: inline-block;">
              <i class="${c.icon || 'fa-solid fa-tag'}" style="font-size: 14px; margin-right: 4px; display: inline-block; vertical-align: middle;"></i>
              <span style="vertical-align: middle;">${c.icon || 'fa-solid fa-tag'}</span>
            </div>
          </td>
          <td style="font-size: 12px; color: var(--gray-600); max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${c.description || ''}">
            ${c.description || 'No description added.'}
          </td>
          <td style="font-size: 12px; color: var(--gray-600);">${regDate}</td>
          <td>
            <div style="display: flex; gap: 4px; justify-content: flex-end;">
              <button class="btn btn-secondary btn-cat-edit" data-id="${c._id}" style="padding: 4px 8px; font-size: 11px;">Edit</button>
              <button class="btn btn-secondary btn-cat-delete" data-id="${c._id}" style="padding: 4px 8px; font-size: 11px; color: var(--error); border-color: rgba(239, 68, 68, 0.455);">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    attachCategoriesTableListeners();
  }

  function attachCategoriesTableListeners() {
    // Edit Category click
    document.querySelectorAll('.btn-cat-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const catId = btn.dataset.id;
        const c = cachedCategories.find(item => item._id === catId);
        if (!c) return;

        document.getElementById('edit_cat_id').value = c._id;
        document.getElementById('edit_cat_name').value = c.name;
        document.getElementById('edit_cat_icon').value = c.icon || 'fa-solid fa-tag';
        document.getElementById('edit_cat_description').value = c.description || '';

        document.getElementById('lblCategoryModalTitle').textContent = 'Configure Category Details';
        openModal('modalCategory');
      });
    });

    // Delete category click
    document.querySelectorAll('.btn-cat-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const catId = btn.dataset.id;
        if (!confirm('FORCED REMOVAL: Deleting this category will remove its record from administration databases. Continue?')) return;

        try {
          const res = await fetch(`/api/admin/categories/${catId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const result = await res.json();
          if (result.success) {
            showToast('Category deleted from platform directories!', 'success');
            pushSystemIncident('CATEGORY DELETED', 'Platform business domain deleted.', 'warning');
            loadCategories();
            loadMetrics();
          } else {
            showToast(result.message || 'Failed deleting category.', 'error');
          }
        } catch (err) {
          console.error(err);
        }
      });
    });
  }

  // Launch Create Category Dialog
  const btnCreateCategory = document.getElementById('btnCreateCategory');
  if (btnCreateCategory) {
    btnCreateCategory.addEventListener('click', () => {
      document.getElementById('edit_cat_id').value = '';
      document.getElementById('edit_cat_name').value = '';
      document.getElementById('edit_cat_icon').value = 'fa-solid fa-tag';
      document.getElementById('edit_cat_description').value = '';

      document.getElementById('lblCategoryModalTitle').textContent = 'Create New Business Category';
      openModal('modalCategory');
    });
  }

  // Submit Category Create / Edit Form
  const btnSubmitCategory = document.getElementById('btnSubmitCategory');
  if (btnSubmitCategory) {
    btnSubmitCategory.addEventListener('click', async () => {
      const catId = document.getElementById('edit_cat_id').value;
      const name = document.getElementById('edit_cat_name').value.trim();
      const icon = document.getElementById('edit_cat_icon').value.trim();
      const description = document.getElementById('edit_cat_description').value.trim();

      if (!name) {
        showToast('Domain name key is dynamic and required.', 'error');
        return;
      }

      const isEditing = !!catId;
      const targetUrl = isEditing ? `/api/admin/categories/${catId}` : '/api/admin/categories';
      const targetMethod = isEditing ? 'PUT' : 'POST';

      try {
        const res = await fetch(targetUrl, {
          method: targetMethod,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ name, icon, description })
        });
        const result = await res.json();
        if (result.success) {
          showToast(isEditing ? 'Category details updated.' : 'New category published successfully!', 'success');
          closeModal('modalCategory');
          loadCategories();
          loadMetrics();
        } else {
          showToast(result.message || 'Operation failed.', 'error');
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  // ==========================================
  // --- CORE VIEW: EMAIL CAMPAIGN CONSOLE ---
  // ==========================================
  const emailTarget = document.getElementById('email_target');
  const groupEmailIndividual = document.getElementById('group_email_individual');
  const emailIndividualList = document.getElementById('email_individual_list');
  const emailSubject = document.getElementById('email_subject');
  const emailTemplateSelector = document.getElementById('email_template_selector');
  const emailBody = document.getElementById('email_body');
  const btnPreviewEmail = document.getElementById('btnPreviewEmail');
  const btnDispatchEmail = document.getElementById('btnDispatchEmail');

  const previewHeaderLogoArea = document.getElementById('preview_header_logo_area');
  const previewHeaderType = document.getElementById('preview_header_type');
  const previewBodyText = document.getElementById('preview_body_text');

  if (emailTarget) {
    emailTarget.addEventListener('change', () => {
      if (emailTarget.value === 'selected') {
        groupEmailIndividual.style.display = 'block';
      } else {
        groupEmailIndividual.style.display = 'none';
      }
    });
  }

  const templatesStyleMap = {
    general: {
      title: 'Official Platform Announcement',
      logoStyle: 'color: #4f46e5;',
      bodyWrap: 'border-left: 4px solid #4f46e5; padding-left: 12px;'
    },
    security: {
      title: 'Urgent Security Incident Warning',
      logoStyle: 'color: #ef4444;',
      bodyWrap: 'border-left: 4px solid #ef4444; padding-left: 12px; background: #fff5f5;'
    },
    welcome: {
      title: 'Welcome to the Skillnest Family!',
      logoStyle: 'color: #f59e0b;',
      bodyWrap: 'border-left: 4px solid #f59e0b; padding-left: 12px; font-style: italic;'
    },
    marketing: {
      title: 'Trending Gigs & Hot Opportunities',
      logoStyle: 'color: #10b981;',
      bodyWrap: 'border-left: 4px solid #10b981; padding-left: 12px;'
    }
  };

  function renderEmailLivePreview() {
    if (!previewBodyText) return;
    const subjVal = emailSubject ? emailSubject.value.trim() : '';
    const bodyVal = emailBody ? emailBody.value.trim() : '';
    const selectedTemplate = emailTemplateSelector ? emailTemplateSelector.value : 'general';
    const config = templatesStyleMap[selectedTemplate] || templatesStyleMap.general;

    if (previewHeaderType) {
      previewHeaderType.textContent = config.title;
    }
    if (previewHeaderLogoArea) {
      previewHeaderLogoArea.querySelector('h2').style.cssText = config.logoStyle + ' margin: 0; font-size: 20px;';
    }

    const textToRender = bodyVal || `Type message body in the composer panel to preview output styling instantly.
    
    Subject Line Target: ${subjVal || '(Not set)'}`;

    previewBodyText.innerHTML = `<div style="${config.bodyWrap}">${textToRender.replace(/\n/g, '<br>')}</div>`;
  }

  if (btnPreviewEmail) {
    btnPreviewEmail.addEventListener('click', renderEmailLivePreview);
  }
  if (emailBody) {
    emailBody.addEventListener('input', renderEmailLivePreview);
  }
  if (emailSubject) {
    emailSubject.addEventListener('input', renderEmailLivePreview);
  }
  if (emailTemplateSelector) {
    emailTemplateSelector.addEventListener('change', renderEmailLivePreview);
  }

  if (btnDispatchEmail) {
    btnDispatchEmail.addEventListener('click', async () => {
      const target = emailTarget.value;
      const individuals = emailIndividualList ? emailIndividualList.value.trim() : '';
      const subject = emailSubject ? emailSubject.value.trim() : '';
      const template = emailTemplateSelector ? emailTemplateSelector.value : 'general';
      const body = emailBody ? emailBody.value.trim() : '';

      if (!subject) {
        showToast('Please type a subject line for the email campaign.', 'error');
        return;
      }
      if (!body) {
        showToast('Please type the email announcement body message.', 'error');
        return;
      }
      if (target === 'selected' && !individuals) {
        showToast('Please specify comma separated emails for individual target group.', 'error');
        return;
      }

      btnDispatchEmail.disabled = true;
      const originalText = btnDispatchEmail.innerHTML;
      btnDispatchEmail.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 6px;"></i> Dispatching Mail...';

      try {
        const res = await fetch('/api/admin/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ target, individuals, subject, template, body })
        });
        const result = await res.json();
        
        if (result.success) {
          showToast(`Success! Campaign successfully sent to ${result.data.sentCount} recipient(s).`, 'success');
          pushSystemIncident('EMAIL BROADCAST', `Dispatched campaign "${subject}" to ${target} target group (${result.data.sentCount} users).`, 'success');
          
          // Clear inputs
          if (emailSubject) emailSubject.value = '';
          if (emailBody) emailBody.value = '';
          if (emailIndividualList) emailIndividualList.value = '';
          renderEmailLivePreview();
        } else {
          showToast(result.message || 'Failed to dispatch email campaign.', 'error');
        }
      } catch (err) {
        console.error('Email dispatcher error:', err);
        showToast('An error occurred during SMTP transaction.', 'error');
      } finally {
        btnDispatchEmail.disabled = false;
        btnDispatchEmail.innerHTML = originalText;
      }
    });
  }

  // --- INITIAL INITIATOR LAUNCHES ---
  loadMetrics();
  loadAuditLogs();
  checkForDismissSeederBanner();
});
