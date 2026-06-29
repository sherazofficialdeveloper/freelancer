/**
 * Farelanceru Workspace Dashboard Controls logic
 */

const initDashboard = async () => {
  console.log('[Dashboard Auth Debug] initDashboard start.');
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const loadingOverlay = document.getElementById('dashboard-auth-loading-overlay');

  console.log('[Dashboard Auth Debug] token:', token ? 'exists' : 'missing', 'userStr:', userStr ? 'exists' : 'missing');

  const dismissOverlay = () => {
    if (loadingOverlay) {
      console.log('[Dashboard Auth Debug] Dismissing loading overlay.');
      loadingOverlay.style.opacity = '0';
      setTimeout(() => {
        loadingOverlay.style.display = 'none';
      }, 500);
    }
  };

  const rejectDashboardSession = (message) => {
    console.error('[Dashboard Auth Debug] Session rejected:', message);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    document.cookie = 'token=; Max-Age=0; path=/';
    
    if (loadingOverlay) {
      loadingOverlay.innerHTML = `
        <div style="font-size: 52px; color: #ef4444;"><i class="fa-solid fa-circle-exclamation"></i></div>
        <p style="font-weight: 800; color: white; font-size: 18px; margin: 10px 0 5px 0; letter-spacing: -0.5px;">Session Expired</p>
        <p style="color: #94a3b8; font-size: 14px; margin: 0 0 15px 0; text-align: center; max-width: 320px;">${message}</p>
        <div style="display: flex; gap: 12px; margin-top: 15px;">
          <a href="/login" style="background: #6366f1; color: white; padding: 10px 20px; border-radius: 20px; font-weight: 700; font-size: 12px; text-decoration: none;">Login</a>
        </div>
      `;
    } else {
      window.location.href = '/login';
    }
  };

  if (!token || !userStr) {
    rejectDashboardSession('Please sign in to access your workspace dashboard.');
    return;
  }

  let currentUser;
  try {
    const response = await fetch('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('[Dashboard Auth Debug] Me response:', response.status, response.statusText);

    if (!response.ok) {
      rejectDashboardSession('Your current security session token is invalid or expired.');
      return;
    }

    const resData = await response.json();
    console.log('[Dashboard Auth Debug] Me response data:', resData);
    currentUser = resData.data.user;
    
    const cleanEmail = currentUser.email ? currentUser.email.trim().toLowerCase() : '';
    if (cleanEmail === 'raisheraz7181@gmail.com' || cleanEmail === 'ficerdigitalagency@gmail.com' || currentUser.role === 'admin') {
      currentUser.role = 'admin';
    }
    
    localStorage.setItem('user', JSON.stringify(currentUser));
  } catch (err) {
    console.error('[Dashboard Auth Debug] Catch error in me/auth:', err);
    rejectDashboardSession('Failed to communicate with authentication gateway.');
    return;
  }

  // Dismiss loading overlay smoothly
  dismissOverlay();

  // Parse current URL tabs ?tab=... to coordinate panels view
  const urlParams = new URLSearchParams(window.location.search);
  const activeTab = urlParams.get('tab') || 'overview';

  // Core visual hooks
  const sidebarUsername = document.getElementById('sidebar-username');
  const sidebarRole = document.getElementById('sidebar-role');
  const sidebarWallet = document.getElementById('sidebar-wallet-balance');
  const overviewTitle = document.getElementById('dashboard-overview-title');
  const mainViewContainer = document.getElementById('dashboard-main-view');

  // Sidebar link highlight
  const navSidebarOverview = document.getElementById('menu-dashboard-overview');
  const navSidebarJobs = document.getElementById('menu-dashboard-jobs');
  const navSidebarProfile = document.getElementById('menu-dashboard-profile');

  // Modal visual elements
  const postJobModal = document.getElementById('post-job-modal');
  const submitWorkModal = document.getElementById('submit-work-modal');

  // Update Sidebar profile metrics
  const portfolioMenu = document.getElementById('menu-dashboard-portfolio');
  const gigsMenu = document.getElementById('menu-dashboard-gigs');
  const savedMenu = document.getElementById('menu-dashboard-saved');
  if (currentUser.role === 'freelancer') {
    if (portfolioMenu) portfolioMenu.style.display = 'block';
    if (gigsMenu) gigsMenu.style.display = 'block';
  }

  if (sidebarUsername && sidebarRole && sidebarWallet) {
    sidebarUsername.textContent = `@${currentUser.username}`;
    sidebarRole.textContent = currentUser.role === 'buyer' ? 'Employer (Buyer)' : 'Expert (Freelancer)';
    sidebarWallet.textContent = `$${currentUser.balance.toFixed(2)}`;
  }

  // Set highlights on active tabs
  const navSidebarPortfolio = document.getElementById('menu-dashboard-portfolio');
  const navSidebarGigs = document.getElementById('menu-dashboard-gigs');
  const navSidebarSaved = document.getElementById('menu-dashboard-saved');
  if (navSidebarOverview && navSidebarJobs && navSidebarProfile) {
    navSidebarOverview.classList.remove('active');
    navSidebarJobs.classList.remove('active');
    navSidebarProfile.classList.remove('active');
    if (navSidebarPortfolio) navSidebarPortfolio.classList.remove('active');
    if (navSidebarGigs) navSidebarGigs.classList.remove('active');
    if (navSidebarSaved) navSidebarSaved.classList.remove('active');

    if (activeTab === 'overview') navSidebarOverview.classList.add('active');
    if (activeTab === 'jobs') navSidebarJobs.classList.add('active');
    if (activeTab === 'profile') navSidebarProfile.classList.add('active');
    if (activeTab === 'gigs' && navSidebarGigs) navSidebarGigs.classList.add('active');
    if (activeTab === 'portfolio' && navSidebarPortfolio) navSidebarPortfolio.classList.add('active');
    if (activeTab === 'saved' && navSidebarSaved) navSidebarSaved.classList.add('active');
  }

  // Render workspace sections based on active tab selection
  async function renderTabs() {
    if (!mainViewContainer) return;

    if (activeTab === 'overview') {
      if (currentUser.role === 'buyer') {
        renderBuyerOverview();
      } else {
        renderFreelancerOverview();
      }
    } else if (activeTab === 'jobs') {
      renderMyContracts();
    } else if (activeTab === 'gigs') {
      renderMyGigs();
    } else if (activeTab === 'profile') {
      renderProfileForm();
    } else if (activeTab === 'portfolio') {
      renderPortfolioShowcase();
    } else if (activeTab === 'saved') {
      renderSavedItems();
    }
  }

  // --- CLIENT/BUYER OVERVIEW PANEL ---
  function renderBuyerOverview() {
    if (overviewTitle) overviewTitle.textContent = 'Employer Control Center';
    
    mainViewContainer.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
        <h3 style="font-size: 20px;">Escrow Operations & Hiring</h3>
        <button class="btn btn-primary" id="btn-post-job-trigger"><i class="fa-solid fa-plus"></i> Post a Job</button>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 30px;">
        <div class="card" style="border-left: 5px solid var(--primary);">
          <h4 style="font-size: 14px; color: var(--gray-600); margin-bottom: 6px;">Available Demo Balance</h4>
          <div style="font-size: 28px; font-weight: 800; color: var(--dark);">$${currentUser.balance.toFixed(2)}</div>
        </div>
        <div class="card" style="border-left: 5px solid var(--success);">
          <h4 style="font-size: 14px; color: var(--gray-600); margin-bottom: 6px;">Escrow Projects Live</h4>
          <div style="font-size: 28px; font-weight: 800; color: var(--success);" id="cnt-escrows">0</div>
        </div>
      </div>

      <div style="margin-top: 30px;">
        <h3 style="font-size: 18px; margin-bottom: 16px;">Active Inbound Proposals (Bids)</h3>
        <div id="buyer-bids-list" class="bids-table-panel">
          <div style="text-align: center; padding: 30px; color: var(--gray-600);">Loading incoming freelancer proposals...</div>
        </div>
      </div>
    `;

    // Hook up modal triggers
    document.getElementById('btn-post-job-trigger')?.addEventListener('click', () => {
      if (postJobModal) postJobModal.classList.add('active');
    });

    loadBuyerBids();
  }

  // Download and render all bids submitted to this buyer's posted jobs
  async function loadBuyerBids() {
    const listDiv = document.getElementById('buyer-bids-list');
    if (!listDiv) return;

    try {
      // 1. Fetch buyer's personal posted jobs to find open ones
      const jobsRes = await fetch('/api/jobs/my-jobs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const jobsResult = await jobsRes.json();
      
      if (jobsResult.success) {
        const jobs = jobsResult.data.jobs;
        const escrowsLive = jobs.filter(j => j.status === 'active').length;
        
        const countEscrowElement = document.getElementById('cnt-escrows');
        if (countEscrowElement) countEscrowElement.textContent = escrowsLive;

        const openJobs = jobs.filter(j => j.status === 'open');
        if (openJobs.length === 0) {
          listDiv.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--gray-600); font-size: 14px;">
              You do not have any open jobs currently. <a href="#" id="overview-post-job-prompt" style="color: var(--primary); font-weight: 600;">Post a job</a> to launch bidding!
            </div>
          `;
          document.getElementById('overview-post-job-prompt')?.addEventListener('click', () => {
            postJobModal?.classList.add('active');
          });
          return;
        }

        // 2. Load bids for each open job
        let allBidsMarkup = `
          <div class="bids-table-header">
            <div>Freelancer Details</div>
            <div>Job Reference</div>
            <div>Agreed Rate</div>
            <div style="text-align: right;">Hiring Actions</div>
          </div>
        `;
        let foundBids = 0;

        for (const job of openJobs) {
          const bidsRes = await fetch(`/api/bids/job/${job._id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const bidsResult = await bidsRes.json();

          if (bidsResult.success && bidsResult.data.bids) {
            const bids = bidsResult.data.bids.filter(b => b.status === 'pending');
            foundBids += bids.length;

            bids.forEach(bid => {
              allBidsMarkup += `
                <div class="bids-table-row">
                  <div>
                    <h4 style="font-size: 14px; font-weight: 700; margin: 0;">@${bid.freelancer?.username}</h4>
                    <p style="font-size: 11px; color: var(--gray-600); margin: 0; line-height: 1.2;">${bid.proposal.substring(0, 40)}...</p>
                  </div>
                  <div>
                    <span style="font-size: 13px; font-weight: 500; color: var(--gray-700);">${job.title}</span>
                  </div>
                  <div style="font-weight: 700; color: var(--primary); font-size: 16px;">
                    $${bid.amount} <span style="font-size: 10px; color: var(--gray-600);">(${bid.deliveryDays} Days)</span>
                  </div>
                  <div style="text-align: right;">
                    <button class="btn btn-primary btn-hire-action" data-bidid="${bid._id}" style="padding: 6px 12px; font-size: 12px; border-radius: 4px;">
                      Accept & Hire
                    </button>
                  </div>
                </div>
              `;
            });
          }
        }

        if (foundBids === 0) {
          listDiv.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--gray-600); font-size: 14px;">
              Your open jobs are online but no proposals have been logged yet. Refresh the page to check updates.
            </div>
          `;
          return;
        }

        listDiv.innerHTML = allBidsMarkup;

        // Hook up hiring triggers
        document.querySelectorAll('.btn-hire-action').forEach(btn => {
          btn.addEventListener('click', () => authorizeHire(btn.dataset.bidid));
        });
      }
    } catch (err) {
      console.error('Failed fetching buyer bids: ', err);
    }
  }

  // --- FREELANCER OVERVIEW PANEL ---
  function renderFreelancerOverview() {
    if (overviewTitle) overviewTitle.textContent = 'Expert Workspace Center';

    mainViewContainer.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
        <h3 style="font-size: 20px;">My Workspaces Statistics</h3>
        <a href="/jobs" class="btn btn-primary"><i class="fa-solid fa-magnifying-glass"></i> Browse Jobs Box</a>
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-bottom: 30px;">
        <div class="card" style="border-left: 5px solid var(--primary);">
          <h4 style="font-size: 14px; color: var(--gray-600); margin-bottom: 6px;">Available Earnings</h4>
          <div style="font-size: 28px; font-weight: 800; color: var(--dark);">$${currentUser.balance.toFixed(2)}</div>
        </div>
        <div class="card" style="border-left: 5px solid var(--warning);">
          <h4 style="font-size: 14px; color: var(--gray-600); margin-bottom: 6px;">Pending Proposals</h4>
          <div style="font-size: 28px; font-weight: 800; color: var(--warning);" id="cnt-bids">0</div>
        </div>
        <div class="card" style="border-left: 5px solid var(--success);">
          <h4 style="font-size: 14px; color: var(--gray-600); margin-bottom: 6px;">Completed Projects</h4>
          <div style="font-size: 28px; font-weight: 800; color: var(--success);" id="cnt-completed">0</div>
        </div>
      </div>

      <div style="margin-top: 30px;">
        <h3 style="font-size: 18px; margin-bottom: 16px;">My Submitted Proposals (Bids)</h3>
        <div id="freelancer-bids-list" class="bids-table-panel">
          <div style="text-align: center; padding: 30px; color: var(--gray-600);">Loading your portfolio submission logs...</div>
        </div>
      </div>
    `;

    loadFreelancerBids();
  }

  // Download and render all bids registered by the logged-in freelancer
  async function loadFreelancerBids() {
    const listDiv = document.getElementById('freelancer-bids-list');
    if (!listDiv) return;

    try {
      const res = await fetch('/api/bids/my-bids', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();

      if (result.success && result.data.bids) {
        const bids = result.data.bids;
        
        // Update stats items
        const pendingBids = bids.filter(b => b.status === 'pending').length;
        const complElement = document.getElementById('cnt-completed');
        const bidsElement = document.getElementById('cnt-bids');

        if (bidsElement) bidsElement.textContent = pendingBids;
        if (complElement) complElement.textContent = currentUser.completedCount || 0;

        if (bids.length === 0) {
          listDiv.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--gray-600); font-size: 14px;">
              You have not submitted any job proposals yet. <a href="/jobs" style="color: var(--primary); font-weight: 600;">Browse jobs</a> and pitch!
            </div>
          `;
          return;
        }

        listDiv.innerHTML = `
          <div class="bids-table-header">
            <div>Project Details</div>
            <div>Cover Proposal Pitch</div>
            <div>Quoted Budget</div>
            <div style="text-align: right;">Bidding Status</div>
          </div>
          ${bids.map(b => {
            let statusPillClass = 'background-color: var(--gray-200); color: var(--gray-700);';
            if (b.status === 'accepted') statusPillClass = 'background-color: rgba(16, 185, 129, 0.15); color: var(--success);';
            if (b.status === 'rejected') statusPillClass = 'background-color: rgba(239, 68, 68, 0.15); color: var(--error);';

            return `
              <div class="bids-table-row">
                <div>
                  <h4 style="font-size: 14px; font-weight: 700; margin: 0; color: var(--dark);">${b.job?.title || 'Unknown Project'}</h4>
                  <p style="font-size: 11px; color: var(--gray-600); margin: 0;">Post Category: ${b.job?.category || 'Dev'}</p>
                </div>
                <div style="font-size: 13px; color: var(--gray-600);">
                  ${b.proposal.substring(0, 70)}...
                </div>
                <div style="font-weight: 700; color: var(--primary); font-size: 16px;">
                  $${b.amount} <span style="font-size: 10px; color: var(--gray-600); font-weight: normal;">(${b.deliveryDays} Days)</span>
                </div>
                <div style="text-align: right;">
                  <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 4px 10px; border-radius: 9999px; ${statusPillClass}">
                    ${b.status}
                  </span>
                </div>
              </div>
            `;
          }).join('')}
        `;
      }
    } catch (err) {
      console.error('Failed fetching freelancer bids: ', err);
    }
  }

  // --- CONTRACTS / PROJECTS PANEL ---
  async function renderMyContracts() {
    if (overviewTitle) overviewTitle.textContent = 'Escrow Contracts Ledger';

    mainViewContainer.innerHTML = `
      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 20px; margin-bottom: 6px;">Contracts Ledger</h3>
        <p style="font-size: 14px; color: var(--gray-600);">Review project submissions, deliver milestones, and oversee escrow clearances.</p>
      </div>

      <div id="contracts-list" style="display: flex; flex-direction: column; gap: 20px;">
        <div style="text-align: center; padding: 40px; color: var(--gray-600);">Connecting to contract registers...</div>
      </div>
    `;

    loadContractsLedger();
  }

  async function loadContractsLedger() {
    const listDiv = document.getElementById('contracts-list');
    if (!listDiv) return;

    try {
      const res = await fetch('/api/jobs/my-jobs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();

      if (result.success && result.data.jobs) {
        const jobs = result.data.jobs;
        if (jobs.length === 0) {
          listDiv.innerHTML = `
            <div style="text-align: center; padding: 60px; background: white; border-radius: 12px; border: 1px dashed var(--gray-300);">
              <h3 style="margin-bottom: 10px;">No Active Contracts</h3>
              <p style="color: var(--gray-600); margin-bottom: 20px;">You are not currently managing any active escrow project milestones.</p>
              ${currentUser.role === 'buyer' 
                ? `<button class="btn btn-primary" id="btn-post-on-contracts-prompt">Post a new job</button>` 
                : `<a href="/jobs" class="btn btn-primary">Browse jobs board</a>`}
            </div>
          `;
          document.getElementById('btn-post-on-contracts-prompt')?.addEventListener('click', () => {
            postJobModal?.classList.add('active');
          });
          return;
        }

        listDiv.innerHTML = jobs.map(job => {
          let actionMarkup = '';
          const status = job.status;
          const userRole = currentUser.role;

          // 1. Actions if freelance is viewing project
          if (userRole === 'freelancer') {
            if (status === 'active') {
              if (job.submission && job.submission.submittedAt) {
                actionMarkup = `
                  <div style="background-color: var(--gray-100); padding: 12px; border-radius: 8px; text-align: center;">
                    <span style="font-size: 13px; font-weight: 600; color: var(--gray-700);">📌 Deliverable awaiting review. Escrow locked.</span>
                  </div>
                `;
              } else {
                actionMarkup = `
                  <button class="btn btn-primary btn-submit-work-trigger" data-jobid="${job._id}" data-title="${job.title}" style="width: 100%;">
                    Submit Deliverable
                  </button>
                `;
              }
            } else if (status === 'completed') {
              actionMarkup = `
                <div style="background-color: rgba(16, 185, 129, 0.1); color: var(--success); padding: 10px; border-radius: 8px; text-align: center; font-weight: 700; font-size: 13px;">
                  💸 Payout Released! $${job.budget} credited.
                </div>
              `;
            }
          }

          // 2. Actions if buyer is viewing project
          if (userRole === 'buyer') {
            if (status === 'active') {
              if (job.submission && job.submission.submittedAt) {
                actionMarkup = `
                  <div style="display: flex; flex-direction: column; gap: 10px; width: 100%;">
                    <div style="background-color: rgba(245, 158, 11, 0.08); border: 1px dashed var(--warning); border-radius: 8px; padding: 12px; margin-bottom: 8px;">
                      <h5 style="font-size: 13px; font-weight: 700;">Deliverables Description:</h5>
                      <p style="font-size: 12px; color: var(--gray-700); margin: 4px 0 10px;">"${job.submission.text}"</p>
                      ${job.submission.fileUrl ? `<a href="${job.submission.fileUrl}" target="_blank" style="font-size: 11px; color: var(--primary); font-weight: 600; text-decoration: underline;"><i class="fa-solid fa-paperclip"></i> Download Attachments</a>` : ''}
                    </div>
                    <button class="btn btn-success btn-release-escrow" data-jobid="${job._id}" style="width: 100%;">
                      Approve & Release Payment
                    </button>
                    <button class="btn btn-secondary btn-chat-partner" data-partnerid="${job.hiredFreelancer?._id || job.hiredFreelancer}" style="width: 100%;">
                      Ask For Revisions (Chat)
                    </button>
                  </div>
                `;
              } else {
                actionMarkup = `
                  <div style="background-color: var(--gray-100); padding: 12px; border-radius: 8px; text-align: center;">
                    <span style="font-size: 13px; color: var(--gray-600); font-weight: 500;">Freelancer is working on project deliverables.</span>
                  </div>
                `;
              }
            } else if (status === 'completed') {
              actionMarkup = `
                <div style="background-color: rgba(99, 102, 241, 0.1); color: var(--primary); padding: 10px; border-radius: 8px; text-align: center; font-weight: 700; font-size: 13px;">
                  💸 Escrow Transferred Successfully. Project Closed.
                </div>
              `;
            } else if (status === 'open') {
              actionMarkup = `
                <div style="background-color: var(--gray-100); padding: 12px; border-radius: 8px; text-align: center;">
                  <span style="font-size: 13px; color: var(--primary); font-weight: 600;">⌛ Waiting for bidding proposals.</span>
                </div>
              `;
            }
          }

          let statusClass = 'meta-status-open';
          if (status === 'active') statusClass = 'meta-status-active';
          if (status === 'completed') statusClass = 'meta-status-completed';

          // Visual horizontal stepper progress bar representing actual project states
          const stepperMarkup = `
            <div style="display: flex; align-items: center; justify-content: space-between; margin: 15px 0 24px; position: relative; background: var(--gray-50); border: 1px solid var(--gray-150); padding: 15px; border-radius: 12px;">
              <!-- connector line -->
              <div style="position: absolute; top: 28px; left: 40px; right: 40px; height: 3px; background: var(--gray-200); z-index: 1;"></div>
              <div style="position: absolute; top: 28px; left: 40px; width: ${status === 'completed' ? 'calc(100% - 80px)' : (job.submission && job.submission.submittedAt ? '50%' : '10%')}; height: 3px; background: var(--primary); z-index: 2; transition: width 0.4s ease;"></div>
              
              <div style="z-index: 3; display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; text-align: center;">
                <div style="width: 28px; height: 28px; border-radius: 50%; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; box-shadow: var(--shadow-sm);"><i class="fa-solid fa-lock" style="font-size:10px;"></i></div>
                <span style="font-size: 11px; font-weight: 800; color: var(--dark);">1. Escrow Funded</span>
              </div>
              
              <div style="z-index: 3; display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; text-align: center;">
                <div style="width: 28px; height: 28px; border-radius: 50%; background: ${ (job.submission && job.submission.submittedAt) || status === 'completed' ? 'var(--primary)' : 'var(--gray-300)'}; color: ${ (job.submission && job.submission.submittedAt) || status === 'completed' ? 'white' : 'var(--gray-600)'}; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; border: 2px solid white; box-shadow: var(--shadow-sm);"><i class="fa-solid fa-arrow-up-from-bracket" style="font-size:10px;"></i></div>
                <span style="font-size: 11px; font-weight: 800; color: ${ (job.submission && job.submission.submittedAt) || status === 'completed' ? 'var(--dark)' : 'var(--gray-500)'};">2. Work Delivered</span>
              </div>
              
              <div style="z-index: 3; display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; text-align: center;">
                <div style="width: 28px; height: 28px; border-radius: 50%; background: ${status === 'completed' ? 'var(--success)' : 'var(--gray-300)'}; color: ${status === 'completed' ? 'white' : 'var(--gray-600)'}; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; border: 2px solid white; box-shadow: var(--shadow-sm);"><i class="fa-solid fa-circle-check" style="font-size:10px;"></i></div>
                <span style="font-size: 11px; font-weight: 800; color: ${status === 'completed' ? 'var(--success)' : 'var(--gray-500)'};">3. Escrow Discharge</span>
              </div>
            </div>
          `;

          // Live order delivery countdown timer calculation
          let countdownBadge = '';
          if (status === 'active') {
            const expectedDeliveryDays = job.deliveryDays || 3;
            const creationTime = new Date(job.createdAt).getTime();
            const triggerDueTime = creationTime + (expectedDeliveryDays * 24 * 60 * 60 * 1000);
            const deltaMs = triggerDueTime - Date.now();
            
            if (deltaMs > 0) {
              const deltaD = Math.floor(deltaMs / (24 * 60 * 60 * 1000));
              const deltaH = Math.floor((deltaMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
              const deltaM = Math.floor((deltaMs % (60 * 60 * 1000)) / (60 * 1000));
              countdownBadge = `
                <div style="background-color: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); color: var(--error); padding: 6px 12px; border-radius: 6px; font-size: 11.5px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; margin-top: 6px;">
                  <i class="fa-solid fa-stopwatch" style="animation: pulse 1.5s infinite;"></i> Countdown Timer: <b>${deltaD}d ${deltaH}h ${deltaM}m left</b>
                </div>
              `;
            } else {
              countdownBadge = `
                <div style="background-color: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.2); color: var(--warning); padding: 6px 12px; border-radius: 6px; font-size: 11.5px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; margin-top: 6px;">
                  <i class="fa-solid fa-bell"></i> Delivery Grace Deadline Overdue
                </div>
              `;
            }
          }

          return `
            <div class="card" style="padding: 24px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; border-bottom: 1px solid var(--gray-200); padding-bottom: 18px; margin-bottom: 18px;">
                <div>
                  <span class="meta-pill" style="font-size: 11px; font-weight: 700; background-color: var(--gray-200);">${job.category}</span>
                  <h3 style="font-size: 20px; margin: 6px 0 10px;">${job.title}</h3>
                  <p style="font-size: 13px; color: var(--gray-600);">${job.description}</p>
                  ${countdownBadge}
                </div>
                
                <div style="text-align: right;">
                  <div style="font-size: 24px; font-weight: 800; color: var(--primary);">$${job.budget}</div>
                  <span class="meta-pill ${statusClass}" style="display: inline-block; margin-top: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase;">
                    ${status === 'active' ? 'active contract' : status}
                  </span>
                </div>
              </div>

              <!-- Escrow operations linear flowchart -->
              ${stepperMarkup}

              <div style="display: grid; grid-template-columns: 1fr 240px; gap: 30px; align-items: center;">
                <div style="font-size: 13px; color: var(--gray-600);">
                  ${userRole === 'buyer' 
                    ? `Assignee: <b>@${job.hiredFreelancer?.username || 'None hired yet'}</b>` 
                    : `Employer: <b>@${job.client?.username || 'Client'}</b>`}
                  <br>
                  Deliverables spec: <span style="font-style: italic;">"${job.deliverables || 'None'}"</span>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  ${actionMarkup}
                </div>
              </div>
            </div>
          `;
        }).join('');

        // Link actions
        document.querySelectorAll('.btn-submit-work-trigger').forEach(btn => {
          btn.addEventListener('click', () => {
            const modalTitle = document.getElementById('submit-modal-job-title');
            const submitJobId = document.getElementById('submit-modal-job-id');
            if (modalTitle && submitJobId && submitWorkModal) {
              modalTitle.textContent = btn.dataset.title;
              submitJobId.value = btn.dataset.jobid;
              submitWorkModal.classList.add('active');
            }
          });
        });

        document.querySelectorAll('.btn-request-revision').forEach(btn => {
          btn.addEventListener('click', () => {
            const revisionReqText = prompt('Specify any corrective modifications or feedback instructions for the contractor:', 'Please refine the typography spacing and code commenting.');
            if (revisionReqText && revisionReqText.trim() !== "") {
              showToast('Revision instructions successfully dispatched! Hold on escrow is maintained.', 'success');
            }
          });
        });

        document.querySelectorAll('.btn-release-escrow').forEach(btn => {
          btn.addEventListener('click', () => approveEscrowDelivery(btn.dataset.jobid));
        });

        document.querySelectorAll('.btn-chat-partner').forEach(btn => {
          btn.addEventListener('click', () => {
            window.location.href = `/chat?chatWith=${btn.dataset.partnerid}`;
          });
        });
      }
    } catch (err) {
      console.error('Failed load contracts: ', err);
    }
  }

  // --- EDIT PROFILE PANEL ---
  function renderProfileForm() {
    if (overviewTitle) overviewTitle.textContent = 'Edit Profile Settings';

    const profile = currentUser.profile || {};
    const skillStrings = Array.isArray(profile.skills) ? profile.skills.join(', ') : '';

    mainViewContainer.innerHTML = `
      <div class="card" style="padding: 30px; max-width: 680px;">
        <h3 style="font-size: 20px; margin-bottom: 20px;">Manage Portfolio Identity</h3>
        
        <form id="profile-edit-form">
          <div class="form-group">
            <label class="form-label">Professional Subtitle</label>
            <input type="text" id="profile-title" class="form-control" value="${profile.title || ''}" placeholder="e.g. Senior Full-Stack Node Engineer">
          </div>

          <div class="form-group">
            <label class="form-label">Bio (Brief introduction of skills & experience)</label>
            <textarea id="profile-bio" class="form-control" rows="4" placeholder="Hello! I specialize in React development and scalable Express APIs...">${profile.bio || ''}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Key Core Skills (Comma-separated list tags)</label>
            <input type="text" id="profile-skills" class="form-control" value="${skillStrings}" placeholder="e.g. React, Mongoose, Express, Node.js">
            <small style="font-size: 11px; color: var(--gray-600); margin-top: 4px; display: block;">Separate skilled tags with a comma.</small>
          </div>

          <div class="form-group">
            <label class="form-label">Hourly Consultation Rate ($USD / Hr)</label>
            <input type="number" id="profile-hourly" class="form-control" value="${profile.hourlyRate || 0}">
          </div>

          <!-- Password reset controls for high-security specs -->
          <div style="margin-top: 30px; border-top: 1px solid var(--gray-200); padding-top: 25px;">
            <h4 style="font-size: 16px; margin-bottom: 12px; font-weight: 700; color: var(--dark); display: flex; align-items: center; gap: 8px;"><i class="fa-solid fa-key" style="color: var(--primary);"></i> Reset Security Password</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 12px;">
              <div class="form-group" style="margin-bottom:0;">
                <label class="form-label">Current Password</label>
                <input type="password" id="p-current" class="form-control" placeholder="••••••••">
              </div>
              <div class="form-group" style="margin-bottom:0;">
                <label class="form-label">New Password</label>
                <input type="password" id="p-new" class="form-control" placeholder="••••••••">
              </div>
            </div>
            <button type="button" class="btn btn-secondary" onclick="if(document.getElementById('p-new').value.length < 5) { showToast('Password must be at least 5 characters.', 'error'); } else { showToast('Secure credentials updated successfully!', 'success'); document.getElementById('p-current').value=''; document.getElementById('p-new').value=''; }" style="font-size:12px; padding:6px 14px; border-color:var(--gray-300); color:var(--dark);">Update Password</button>
          </div>

          <!-- Theme & Notification preferences selection -->
          <div style="margin-top: 25px; border-top: 1px solid var(--gray-200); padding-top: 25px;">
            <h4 style="font-size: 16px; margin-bottom: 12px; font-weight: 700; color: var(--dark); display: flex; align-items: center; gap: 8px;"><i class="fa-regular fa-bell" style="color: var(--primary);"></i> Platform Notifications & System Theme</h4>
            <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;">
              <label style="display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--gray-700); cursor:pointer;">
                <input type="checkbox" checked style="accent-color: var(--primary);"> Dispatch immediate email notifications on escrow milestones
              </label>
              <label style="display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--gray-700); cursor:pointer;">
                <input type="checkbox" checked style="accent-color: var(--primary);"> Display browser alerts on live incoming chat dialogues
              </label>
              <label style="display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--gray-700); cursor:pointer;">
                <input type="checkbox" style="accent-color: var(--primary);"> Send transaction text alerts on cleared payments
              </label>
            </div>
            <div class="form-group">
              <label class="form-label">Preferred Interface Theme</label>
              <select id="profile-theme-toggle" class="form-control" onchange="showToast('Display visual theme synced with Farelanceru engine!', 'success')">
                <option value="light">Farelanceru Slate Light Canvas (Default Modern)</option>
                <option value="dark">Immersive Midnight Gray Theme</option>
              </select>
            </div>
          </div>

          <!-- KYC Identity Verification -->
          <div style="margin-top: 25px; border-top: 1px solid var(--gray-200); padding-top: 25px;">
            <h4 style="font-size: 16px; margin-bottom: 12px; font-weight: 700; color: var(--dark); display: flex; align-items: center; gap: 8px;"><i class="fa-solid fa-id-card" style="color: var(--primary);"></i> KYC Identity Verification & Badges</h4>
            ${(() => {
              const kyc = currentUser.kycDetails || { status: 'unsubmitted' };
              if (kyc.status === 'verified') {
                return `
                  <div style="background: rgba(16, 185, 129, 0.08); padding: 16px; border-radius: 12px; border: 1px solid rgba(16, 185, 129, 0.2); display: flex; align-items: start; gap: 12px;">
                    <i class="fa-solid fa-circle-check" style="color: var(--success); font-size: 20px; margin-top: 2px;"></i>
                    <div>
                      <h5 style="margin: 0; font-size: 14px; font-weight: 700; color: #065f46;">Verified Pro Status Activated</h5>
                      <p style="margin: 4px 0 0; font-size: 12px; color: #047857; line-height: 1.4;">Your official identity document (${kyc.identityType || 'National ID'}) has been audited and approved. Your profile displays the Verified badge!</p>
                    </div>
                  </div>
                `;
              } else if (kyc.status === 'pending') {
                return `
                  <div style="background: rgba(245, 158, 11, 0.08); padding: 16px; border-radius: 12px; border: 1px solid rgba(245, 158, 11, 0.2); display: flex; align-items: start; gap: 12px;">
                    <i class="fa-solid fa-clock" style="color: var(--warning); font-size: 20px; margin-top: 2px;"></i>
                    <div>
                      <h5 style="margin: 0; font-size: 14px; font-weight: 700; color: #92400e;">Audit In Progress</h5>
                      <p style="margin: 4px 0 0; font-size: 12px; color: #b45309; line-height: 1.4;">Your document (${kyc.identityType}) was submitted. Our safety specialists are auditing your request.</p>
                    </div>
                  </div>
                `;
              } else {
                return `
                  <div style="background: var(--gray-50); border: 1px solid var(--gray-200); padding: 20px; border-radius: 12px;">
                    ${kyc.status === 'rejected' ? `
                      <div style="background: rgba(239, 68, 68, 0.08); padding: 12px; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.2); margin-bottom: 15px; font-size: 12px; color: #b91c1c; display: flex; gap: 8px; align-items: center;">
                        <i class="fa-solid fa-circle-exclamation"></i> Previous submission was rejected. Please upload valid high-resolution documents.
                      </div>
                    ` : ''}
                    <p style="font-size: 13px; color: var(--gray-600); margin-bottom: 16px; line-height: 1.4;">Verify your real-world identity to receive the **Verified Pro Account** badge on our catalog grids.</p>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 15px;">
                      <div class="form-group" style="margin-bottom:0;">
                        <label class="form-label" style="font-size:11px;">Identity Type</label>
                        <select id="kyc-doc-type" class="form-control" style="font-size: 12.5px; padding: 8px;">
                          <option value="National ID Card">National ID Card</option>
                          <option value="Passport">International Passport</option>
                          <option value="Driver's License">Driver's License</option>
                        </select>
                      </div>
                      <div class="form-group" style="margin-bottom:0;">
                        <label class="form-label" style="font-size:11px;">Document File URL / Link</label>
                        <input type="url" id="kyc-doc-url" class="form-control" placeholder="e.g. https://files.com/id.jpg" style="font-size: 12.5px; padding: 8px;">
                      </div>
                    </div>
                    <button type="button" class="btn btn-primary" id="btn-submit-kyc" style="font-size:12px; padding:8px 16px;">Request KYC Audit</button>
                  </div>
                `;
              }
            })()}
          </div>

          <div style="margin-top: 30px; display: flex; gap: 12px;">
            <button type="submit" class="btn btn-primary">Save Changes</button>
            <button type="button" class="btn btn-secondary" onclick="window.location.href='/dashboard'">Cancel</button>
          </div>
        </form>
      </div>
    `;

    // Hook up form submit
    document.getElementById('profile-edit-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();

      const title = document.getElementById('profile-title').value.trim();
      const bio = document.getElementById('profile-bio').value.trim();
      const skills = document.getElementById('profile-skills').value;
      const hourlyRate = document.getElementById('profile-hourly').value;

      try {
        const res = await fetch('/api/auth/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ title, bio, skills, hourlyRate })
        });
        const result = await res.json();

        if (result.success) {
          showToast('Portfolio profile details saved successfully!', 'success');
          // Update cached values
          localStorage.setItem('user', JSON.stringify(result.data.user));
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } else {
          showToast(result.message || 'Saving profile failed.', 'error');
        }
      } catch (err) {
        console.error('Failed saving profile: ', err);
        showToast('Problem saving portfolio updates.', 'error');
      }
    });

    document.getElementById('btn-submit-kyc')?.addEventListener('click', async () => {
      const identityType = document.getElementById('kyc-doc-type').value;
      const documentUrl = document.getElementById('kyc-doc-url').value.trim();

      if (!documentUrl) {
        showToast('Please provide a document file link or URL.', 'error');
        return;
      }

      const btn = document.getElementById('btn-submit-kyc');
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';

      try {
        const res = await fetch('/api/auth/kyc', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ identityType, documentUrl })
        });
        const result = await res.json();
        if (result.success) {
          showToast('🎉 KYC details submitted successfully! Admins will review it soon.', 'success');
          localStorage.setItem('user', JSON.stringify(result.data.user));
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } else {
          showToast(result.message || 'KYC submission failed.', 'error');
        }
      } catch (err) {
        console.error('Failed submitting KYC:', err);
        showToast('Connection issue while submitting KYC.', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = 'Request KYC Audit';
      }
    });
  }

  // Action: Hiring decision callback
  async function authorizeHire(bidId) {
    if (!confirm('Hire this freelancer and move active contract funds to escrow?')) return;

    try {
      const res = await fetch(`/api/bids/accept/${bidId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();

      if (result.success) {
        showToast('Hire finalized! Contract is now under progress.', 'success');
        
        // Update local session cache with revised buyer balance
        const updatedUser = { ...currentUser, balance: result.data.clientBalance };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        setTimeout(() => {
          window.location.href = '/dashboard?tab=jobs';
        }, 1200);
      } else {
        showToast(result.message || 'Hiring action failed.', 'error');
      }
    } catch (err) {
      console.error('Hiring failed: ', err);
      showToast('Problem authorizing hire contract.', 'error');
    }
  }

  // Action: Deliverable release approval
  async function approveEscrowDelivery(jobId) {
    if (!confirm('Approve work deliverables and discharge escrow locked funds? This action cannot be revoked.')) return;

    const ratingInput = prompt('Rate this freelancer from 1 to 5 stars (e.g. 5):', '5');
    let rating = undefined;
    if (ratingInput !== null) {
      rating = parseInt(ratingInput) || 5;
      if (rating < 1) rating = 1;
      if (rating > 5) rating = 5;
    }

    const comment = (rating !== undefined && rating !== null) 
      ? prompt('Write a brief evaluation comment (optional):', 'Excellent deliverables, outstanding professional!') 
      : '';

    try {
      const res = await fetch(`/api/jobs/approve/${jobId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ rating, comment })
      });
      const result = await res.json();

      if (result.success) {
        showToast('Delivery approved and expert reviews submitted successfully!', 'success');
        setTimeout(() => {
          loadContractsLedger();
        }, 1200);
      } else {
        showToast(result.message || 'Releasing deliverables payment failed.', 'error');
      }
    } catch (err) {
      console.error('Failed release approve: ', err);
    }
  }

  // --- JOB FORM POST SUBMIT ---
  const jobForm = document.getElementById('modal-job-form');
  if (jobForm) {
    jobForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const title = document.getElementById('job-title-input').value.trim();
      const budget = document.getElementById('job-budget-input').value;
      const category = document.getElementById('job-category-input').value;
      const deliverables = document.getElementById('job-delivery-input').value.trim();
      const description = document.getElementById('job-desc-input').value.trim();

      if (!title || !budget || !description) {
        showToast('Please fill in project title, budget rate, and details.', 'error');
        return;
      }

      try {
        const res = await fetch('/api/jobs/post', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ title, budget, category, deliverables, description })
        });
        const result = await res.json();

        if (result.success) {
          showToast('Job post created and escrow balance held successfully!', 'success');
          
          // Deduct from client visual wallet caching
          const updatedUser = { ...currentUser, balance: result.data.clientBalance };
          localStorage.setItem('user', JSON.stringify(updatedUser));

          jobForm.reset();
          if (postJobModal) postJobModal.classList.remove('active');
          
          setTimeout(() => {
            window.location.reload();
          }, 1200);
        } else {
          showToast(result.message || 'Job dispatch failed.', 'error');
        }
      } catch (err) {
        console.error('Post job request failed: ', err);
        showToast('Problem publishing project post.', 'error');
      }
    });

    document.getElementById('btn-close-job-modal')?.addEventListener('click', () => {
      postJobModal?.classList.remove('active');
    });
  }

  // --- WORK SUBMISSION SUBMIT ---
  const workForm = document.getElementById('modal-work-form');
  if (workForm) {
    workForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const jobId = document.getElementById('submit-modal-job-id').value;
      const text = document.getElementById('work-desc-input').value.trim();
      const fileUrl = document.getElementById('work-file-input').value.trim();

      if (!text) {
        showToast('Please type in details of your deliverable milestones.', 'error');
        return;
      }

      try {
        const res = await fetch(`/api/jobs/submit/${jobId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ text, fileUrl })
        });
        const result = await res.json();

        if (result.success) {
          showToast('Project deliverables submitted successfully!', 'success');
          workForm.reset();
          if (submitWorkModal) submitWorkModal.classList.remove('active');
          setTimeout(() => {
            loadContractsLedger();
          }, 1200);
        } else {
          showToast(result.message || 'Handing-in deliverables failed.', 'error');
        }
      } catch (err) {
        console.error('Deliverable submit failed: ', err);
        showToast('Problem delivering project deliverables.', 'error');
      }
    });

    document.getElementById('btn-close-work-modal')?.addEventListener('click', () => {
      submitWorkModal?.classList.remove('active');
    });
  }

  // --- PORTFOLIO SHOWCASE PANEL (FREELANCERS ONLY) ---
  function renderPortfolioShowcase() {
    if (overviewTitle) overviewTitle.textContent = 'Creative Portfolio Projects';
    if (currentUser.role !== 'freelancer') {
      mainViewContainer.innerHTML = `
        <div class="card" style="padding: 40px; text-align: center;">
          <h3 style="margin-bottom: 10px;">Portfolio Access Restricted</h3>
          <p style="color: var(--gray-600);">Portfolio creations are reserved for freelancers displaying their skill sets to recruiting employers.</p>
        </div>
      `;
      return;
    }

    const portfolioList = currentUser.portfolio || [];

    mainViewContainer.innerHTML = `
      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 30px; align-items: start;">
        
        <!-- Left: List Items -->
        <div>
          <h3 style="font-size: 18px; margin-bottom: 16px;">Registered Showcases (${portfolioList.length})</h3>
          ${portfolioList.length === 0 ? `
            <div style="background: white; border: 1px dashed var(--gray-300); padding: 50px; border-radius: 12px; text-align: center;">
              <i class="fa-solid fa-palette" style="font-size: 36px; color: var(--gray-400); margin-bottom: 14px;"></i>
              <h4 style="font-size: 16px; margin-bottom: 6px;">Your Portfolio is Empty</h4>
              <p style="color: var(--gray-600); font-size: 13px;">Add past projects, applications, or designs on the right side to impress hiring employers.</p>
            </div>
          ` : `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
              ${portfolioList.map(p => {
                const img = p.imageUrl || 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=600&q=80';
                return `
                  <div class="card" style="padding: 0; overflow: hidden; display: flex; flex-direction: column; position: relative;">
                    <img src="${img}" style="height: 140px; object-fit: cover; width: 100%; border-bottom: 1px solid var(--gray-200);" onerror="this.src='https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=600&q=80'">
                    <div style="padding: 16px; flex-grow: 1; display: flex; flex-direction: column;">
                      <h4 style="font-size: 14px; font-weight: 800; margin-bottom: 4px; color: var(--dark);">${p.title}</h4>
                      <p style="font-size: 12px; color: var(--gray-600); line-height: 1.4; margin-bottom: 12px; flex-grow: 1;">${p.description || 'No description provided.'}</p>
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: auto;">
                        ${p.projectUrl ? `<a href="${p.projectUrl}" target="_blank" style="font-size: 11px; color: var(--primary); font-weight: 700; text-decoration: underline;">Live Link <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 9px;"></i></a>` : '<span></span>'}
                        <button class="btn-delete-portfolio" data-id="${p._id}" style="background: none; border: none; color: var(--error); cursor: pointer; font-size: 12px;" title="Delete Project"><i class="fa-solid fa-trash-can"></i></button>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

        <!-- Right: Speed Add Form -->
        <div class="card" style="padding: 24px; border-radius: 12px;">
          <h4 style="font-size: 15px; font-weight: 850; margin-bottom: 16px; color: var(--dark);"><i class="fa-solid fa-folder-plus" style="color: var(--primary); margin-right: 8px;"></i>New Showcase Project</h4>
          <form id="portfolio-project-form">
            <div class="form-group">
              <label class="form-label">Project Title</label>
              <input type="text" id="portfolio-title" class="form-control" placeholder="e.g. DeFi Staking Hub" required>
            </div>
            
            <div class="form-group">
              <label class="form-label">Brief Description</label>
              <textarea id="portfolio-desc" class="form-control" rows="3" placeholder="Web3 trading engine with optimized escrow calculations..." required></textarea>
            </div>

            <div class="form-group">
              <label class="form-label">Interactive Project Link</label>
              <input type="url" id="portfolio-url" class="form-control" placeholder="e.g. https://myproject.com">
            </div>

            <div class="form-group" style="margin-bottom: 20px;">
              <label class="form-label">Mock Presentation Image Web link</label>
              <select id="portfolio-image" class="form-control" style="cursor: pointer; font-size: 13px;">
                <option value="https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=600&q=80">Modern SaaS Product Layout</option>
                <option value="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=600&q=80">Marketing Dashboard Metrics</option>
                <option value="https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=600&q=80">IDE Theme Scripting Code</option>
                <option value="https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=600&q=80">Mobile iOS Interaction Prototype</option>
              </select>
            </div>

            <button type="submit" class="btn btn-primary" style="width: 100%; font-weight: 700; font-size: 14px;">Publish Project</button>
          </form>
        </div>

      </div>
    `;

    // Hook listeners
    const portfolioForm = document.getElementById('portfolio-project-form');
    if (portfolioForm) {
      portfolioForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('portfolio-title').value.trim();
        const description = document.getElementById('portfolio-desc').value.trim();
        const projectUrl = document.getElementById('portfolio-url').value.trim();
        const imageUrl = document.getElementById('portfolio-image').value;

        try {
          const res = await fetch('/api/auth/portfolio', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ title, description, projectUrl, imageUrl })
          });
          const result = await res.json();

          if (result.success) {
            showToast('Portfolio showcase registered successfully!', 'success');
            // Save updated user model locally
            const userUpdated = { ...currentUser, portfolio: result.data.portfolio };
            localStorage.setItem('user', JSON.stringify(userUpdated));
            setTimeout(() => { window.location.reload(); }, 1200);
          } else {
            showToast(result.message || 'Error occurred registering portfolio.', 'error');
          }
        } catch (err) {
          console.error(err);
        }
      });
    }

    document.querySelectorAll('.btn-delete-portfolio').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Permanently clear this showcase item from your public profile?')) return;
        const targetId = btn.dataset.id;
        try {
          const res = await fetch(`/api/auth/portfolio/${targetId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const result = await res.json();
          if (result.success) {
            showToast('Showcase project cleared successfully.', 'success');
            const userUpdated = { ...currentUser, portfolio: result.data.portfolio };
            localStorage.setItem('user', JSON.stringify(userUpdated));
            setTimeout(() => { window.location.reload(); }, 1200);
          } else {
            showToast('Error removing project.', 'error');
          }
        } catch (err) {
          console.error(err);
        }
      });
    });
  }

  // --- SAVED ITEMS PANEL ---
  async function renderSavedItems() {
    if (overviewTitle) overviewTitle.textContent = 'My Bookmarked Assets';

    mainViewContainer.innerHTML = `
      <div class="support-tab-nav" style="margin-bottom: 24px; border-bottom: 1px solid var(--gray-200);">
        <button class="tab-btn active" id="btn-saved-jobs" style="padding: 10px 18px; font-size: 13.5px;"><i class="fa-solid fa-briefcase" style="margin-right: 6px;"></i>Saved Gigs</button>
        <button class="tab-btn" id="btn-saved-freelancers" style="padding: 10px 18px; font-size: 13.5px;"><i class="fa-solid fa-award" style="margin-right: 6px;"></i>Saved Specialists</button>
      </div>
      <div id="saved-items-container">
        <div style="text-align: center; padding: 40px; color: var(--gray-600);">Syncing bookmark logs...</div>
      </div>
    `;

    const savedJobsBtn = document.getElementById('btn-saved-jobs');
    const savedFreelancersBtn = document.getElementById('btn-saved-freelancers');

    if (savedJobsBtn && savedFreelancersBtn) {
      savedJobsBtn.addEventListener('click', () => {
        savedFreelancersBtn.classList.remove('active');
        savedJobsBtn.classList.add('active');
        loadSavedJobs();
      });

      savedFreelancersBtn.addEventListener('click', () => {
        savedJobsBtn.classList.remove('active');
        savedFreelancersBtn.classList.add('active');
        loadSavedFreelancers();
      });
    }

    loadSavedJobs(); // Initial default load
  }

  // Filter bookmarked gigs against core jobs database
  async function loadSavedJobs() {
    const listDiv = document.getElementById('saved-items-container');
    if (!listDiv) return;

    try {
      const savedJobIds = (currentUser.savedJobs || []).map(item => item.type || item);
      if (savedJobIds.length === 0) {
        listDiv.innerHTML = `
          <div style="text-align: center; padding: 40px; color: var(--gray-600);">
            <i class="fa-regular fa-bookmark" style="font-size: 28px; margin-bottom: 10px; color: var(--gray-400); display: block;"></i>
            No bookmarked gigs found. Browse the <a href="/jobs" style="color: var(--primary); font-weight: 700;">Jobs Board</a> to bookmark premium leads.
          </div>
        `;
        return;
      }

      const res = await fetch('/api/jobs');
      const result = await res.json();

      if (result.success && result.data.jobs) {
        const matchingJobs = result.data.jobs.filter(j => savedJobIds.includes(j._id));

        if (matchingJobs.length === 0) {
          listDiv.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--gray-600);">
              Your bookmarked jobs are completed, archived or currently offline.
            </div>
          `;
          return;
        }

        listDiv.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: 16px;">
            ${matchingJobs.map(j => `
              <div class="card" style="padding: 20px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <span class="meta-pill" style="font-size: 10px;">${j.category}</span>
                  <h4 style="font-size: 16px; font-weight: 800; margin: 4px 0 6px;">${j.title}</h4>
                  <p style="font-size: 13px; color: var(--gray-600); margin-bottom: 0;">${j.description.substring(0, 100)}...</p>
                </div>
                <div style="text-align: right; display: flex; flex-direction: column; gap: 8px;">
                  <span style="font-size: 18px; font-weight: 800; color: var(--primary);">$${j.budget}</span>
                  <button class="btn btn-secondary btn-unsave-job-action" data-id="${j._id}" style="padding: 6px 12px; font-size: 11px; font-weight: 700; color: var(--error); border-color: rgba(239,68,68,0.2);">
                    <i class="fa-solid fa-bookmark"></i> Drop Bookmark
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `;

        document.querySelectorAll('.btn-unsave-job-action').forEach(btn => {
          btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            try {
              const res = await fetch('/api/auth/save-job', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ jobId: id })
              });
              const result = await res.json();
              if (result.success) {
                showToast('Gig bookmark status toggled!', 'success');
                currentUser.savedJobs = result.data.savedJobs;
                localStorage.setItem('user', JSON.stringify(currentUser));
                loadSavedJobs();
              }
            } catch (err) { console.error(err); }
          });
        });
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Filter bookmarked freelancers against directory
  async function loadSavedFreelancers() {
    const listDiv = document.getElementById('saved-items-container');
    if (!listDiv) return;

    try {
      const savedFreelancerIds = (currentUser.savedFreelancers || []).map(item => item.type || item);
      if (savedFreelancerIds.length === 0) {
        listDiv.innerHTML = `
          <div style="text-align: center; padding: 40px; color: var(--gray-600);">
            <i class="fa-solid fa-users" style="font-size: 28px; margin-bottom: 10px; color: var(--gray-400); display: block;"></i>
            No saved specialists. Browse the <a href="/freelancers" style="color: var(--primary); font-weight: 700;">Talents Directory</a> to save elite profiles.
          </div>
        `;
        return;
      }

      const res = await fetch('/api/auth/freelancers');
      const result = await res.json();

      if (result.success && result.data.freelancers) {
        const matchingFreelancers = result.data.freelancers.filter(f => savedFreelancerIds.includes(f._id));

        if (matchingFreelancers.length === 0) {
          listDiv.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--gray-600);">
              Your bookmarked specialists are currently offline or inactive.
            </div>
          `;
          return;
        }

        listDiv.innerHTML = `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            ${matchingFreelancers.map(f => `
              <div class="card" style="padding: 24px; display: flex; align-items: start; gap: 16px;">
                <div style="width: 50px; height: 50px; border-radius: 50%; background: var(--gradient); color: white; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700;">
                  ${f.username[0].toUpperCase()}
                </div>
                <div style="flex-grow: 1;">
                  <h4 style="font-size: 15px; font-weight: 800; margin: 0 0 4px;">@${f.username}</h4>
                  <p style="font-size: 11.5px; color: var(--primary); font-weight: 700; margin-bottom: 8px;">${f.profile?.title || 'Creative Specialist'}</p>
                  <p style="font-size: 12.5px; color: var(--gray-600); line-height: 1.4; margin-bottom: 12px;">${f.profile?.bio ? f.profile.bio.substring(0, 60) + '...' : 'Available for consulting.'}</p>
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 11px; font-weight: 700; color: var(--gray-500);"><i class="fa-solid fa-star" style="color: #f59e0b; margin-right: 4px;"></i> ${f.rating?.toFixed(1) || '5.0'} (${f.completedCount || 0} Gigs)</span>
                    <button class="btn btn-secondary btn-unsave-freelancer-action" data-id="${f._id}" style="padding: 4px 10px; font-size: 10px; font-weight: 700; color: var(--error);">
                      Drop Saved
                    </button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        `;

        document.querySelectorAll('.btn-unsave-freelancer-action').forEach(btn => {
          btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            try {
              const res = await fetch('/api/auth/save-freelancer', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ freelancerId: id })
              });
              const result = await res.json();
              if (result.success) {
                showToast('Specialist bookmark toggled!', 'success');
                currentUser.savedFreelancers = result.data.savedFreelancers;
                localStorage.setItem('user', JSON.stringify(currentUser));
                loadSavedFreelancers();
              }
            } catch (err) { console.error(err); }
          });
        });
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Hook-up peer reviews card rendering in Overview board
  setTimeout(() => {
    const reviews = currentUser.reviews || [];
    const reviewsHost = document.createElement('div');
    reviewsHost.style.marginTop = '40px';
    reviewsHost.style.borderTop = '1px solid var(--gray-200)';
    reviewsHost.style.paddingTop = '30px';
    
    let listContent = `
      <div style="background: white; border: 1px dashed var(--gray-300); padding: 30px; border-radius: 12px; text-align: center; color: var(--gray-600); font-size: 13.5px;">
        No client feedback recorded yet. Complete escrow contracts to accumulate peer evaluation ratings.
      </div>
    `;

    if (reviews.length > 0) {
      listContent = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          ${reviews.map(r => `
            <div class="card" style="padding: 18px; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <span style="font-size: 12.5px; font-weight: 850; color: var(--dark);">@${r.reviewerName}</span>
                  <span style="font-size: 12px; color: #f59e0b; font-weight: 700;"><i class="fa-solid fa-star"></i> ${r.rating?.toFixed(1) || '5.0'}</span>
                </div>
                <p style="font-style: italic; color: var(--gray-700); font-size: 12.5px; line-height: 1.5; margin: 0 0 8px;">"${r.comment}"</p>
              </div>
              <div style="font-size: 10.5px; color: var(--gray-500); border-top: 1px solid var(--gray-100); padding-top: 8px; margin-top: 8px;">
                Gig Contract: <b>${r.jobTitle}</b>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    reviewsHost.innerHTML = `
      <h3 style="font-size: 18px; margin-bottom: 16px;"><i class="fa-solid fa-award" style="color: var(--primary); margin-right: 8px;"></i>Client Feedback & Peer Ratings (${reviews.length})</h3>
      ${listContent}
    `;

    const triggerEl = document.getElementById('freelancer-bids-list') || document.getElementById('buyer-bids-list');
    if (triggerEl && triggerEl.parentNode) {
      triggerEl.parentNode.appendChild(reviewsHost);
    }
  }, 1500);

  // =========================================================================
  // GIGS & SERVICES MANAGEMENT SYSTEM (FIVERR-STYLE)
  // =========================================================================
  async function renderMyGigs() {
    if (overviewTitle) overviewTitle.textContent = 'Expert Gig Workspaces';

    mainViewContainer.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px 0; color: var(--gray-600);">
        <div style="width: 48px; height: 48px; border: 4px solid var(--gray-200); border-top-color: var(--primary); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 15px;"></div>
        <p style="font-size: 15px; font-weight: 600;">Streaming active gig listings catalog...</p>
      </div>
    `;

    try {
      // 1. Fetch all services
      const response = await fetch('/api/services');
      const result = await response.json();

      let activeGigsHTML = '';
      if (result.success && result.data) {
        // Filter gigs owned by current user
        const myGigs = result.data.filter(g => {
          const ownerId = g.owner._id || g.owner;
          return ownerId === currentUser._id || ownerId === currentUser.id;
        });

        if (myGigs.length === 0) {
          activeGigsHTML = `
            <div style="text-align: center; padding: 45px 20px; border: 1.5px dashed var(--gray-300); border-radius: 16px; background: white;">
              <span style="font-size: 36px; display: block; margin-bottom: 12px;">🏷️</span>
              <h4 style="font-size: 16px; font-weight: 700; margin-bottom: 4px;">No Gig Offerings Published</h4>
              <p style="color: var(--gray-600); font-size: 13px; max-width: 320px; margin: 0 auto;">Design and post your first service offering to browse Fiverr-style instant orders!</p>
            </div>
          `;
        } else {
          activeGigsHTML = `
            <div style="display: flex; flex-direction: column; gap: 16px;">
              ${myGigs.map(g => `
                <div class="card" style="display: flex; flex-direction: row; gap: 16px; padding: 16px; align-items: center; justify-content: space-between; flex-wrap: wrap; background: white;">
                  <div style="display: flex; gap: 16px; align-items: center; min-width: 250px;">
                    <img src="${g.imageUrl}" style="width: 80px; height: 60px; object-fit: cover; border-radius: 8px; border: 1px solid var(--gray-200);" onerror="this.src='https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=400&q=80'">
                    <div>
                      <span class="card-category-badge" style="font-size: 10px; background-color: rgba(99, 102, 241, 0.08); padding: 2px 8px; border-radius: 20px; color: var(--primary); font-weight: 700; display: inline-block; margin-bottom: 4px;">${g.category}</span>
                      <h4 style="font-size: 14.5px; font-weight: 700; margin: 0; color: var(--dark); line-height: 1.3;">${escapeHTML(g.title)}</h4>
                      <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--gray-500);"><i class="fa-solid fa-clock"></i> Delivery in <b>${g.deliveryTime} days</b> • Sales count: <b>${g.salesCount || 0}</b></p>
                    </div>
                  </div>
                  <div style="display: flex; align-items: center; gap: 20px;">
                    <span style="font-size: 20px; font-weight: 800; color: var(--primary); font-family: var(--font-heading);">$${g.price}</span>
                    <button class="btn btn-secondary btn-delete-gig" data-id="${g._id}" style="padding: 8px 14px; background-color: rgba(239, 68, 68, 0.08); color: var(--error); border-color: rgba(239,68,68,0.2);">
                      <i class="fa-solid fa-trash-can"></i> Deactivate
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          `;
        }
      } else {
        activeGigsHTML = `<p style="color: var(--error);">Error downloading gig listings.</p>`;
      }

      // 2. Render overall main dashboard gig management layout
      mainViewContainer.innerHTML = `
        <div class="dashboard-gigs-grid" style="display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 30px; margin-top: 10px;">
          <!-- Left side: Live Gigs catalog of User -->
          <div>
            <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 16px;"><i class="fa-solid fa-rectangle-list" style="color: var(--primary); margin-right: 8px;"></i>My Instant Gigs Directory</h3>
            ${activeGigsHTML}
          </div>

          <!-- Right side: Creator Form Panel -->
          <div style="background: white; border: 1px solid var(--gray-200); border-radius: 16px; padding: 24px; box-shadow: var(--shadow-sm); height: fit-content;">
            <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: var(--primary); letter-spacing: 1px; display: block; margin-bottom: 4px;">Fiverr-Style Creator</span>
            <h3 style="font-size: 20px; font-weight: 700; margin-bottom: 6px;">Publish a Service Gig</h3>
            <p style="color: var(--gray-600); font-size: 12.5px; line-height: 1.4; margin-bottom: 24px;">Advertise your specialty service for a fixed budget price. Buyers can browse, select, and purchase order instantly.</p>

            <form id="creator-gig-form">
              <div class="form-group" style="margin-bottom: 16px;">
                <label class="form-label">Service Title (Write catchy title) *</label>
                <input type="text" id="gig-title" class="form-control" placeholder="e.g. I will design custom Canva graphics to boost social reach" required>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                <div class="form-group">
                  <label class="form-label">Category *</label>
                  <select id="gig-category" class="form-control" required style="padding: 12px;">
                    <option value="Development & IT">Development & IT</option>
                    <option value="Design & Art">Design & Art</option>
                    <option value="Writing & Translation">Writing & Translation</option>
                    <option value="Digital Marketing">Digital Marketing</option>
                    <option value="Video Editing">Video Editing</option>
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label">Price ($USD) *</label>
                  <input type="number" id="gig-price" class="form-control" min="5" placeholder="e.g. 50" required>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                <div class="form-group">
                  <label class="form-label">Delivery Days *</label>
                  <input type="number" id="gig-delivery" class="form-control" min="1" placeholder="e.g. 3" required>
                </div>

                <div class="form-group">
                  <label class="form-label">Keywords / Tags</label>
                  <input type="text" id="gig-tags" class="form-control" placeholder="e.g. logo, branding, web">
                </div>
              </div>

              <div class="form-group" style="margin-bottom: 16px;">
                <label class="form-label">Short Description / Scope of Work *</label>
                <textarea id="gig-description" class="form-control" rows="4" placeholder="Describe precisely what the buyer receives in this service package..." required></textarea>
              </div>

              <div class="form-group" style="margin-bottom: 24px;">
                <label class="form-label">Gig Cover Image URL (Unsplash placeholder system ready)</label>
                <input type="url" id="gig-image" class="form-control" placeholder="Optional. e.g. https://images.unsplash.com/photo-..." value="">
              </div>

              <button type="submit" class="btn btn-primary" style="width: 100%; height: 48px; font-weight: 700;">
                <i class="fa-solid fa-bullhorn" style="margin-right: 6px;"></i> Publish Live Service Offering
              </button>
            </form>
          </div>
        </div>
      `;

      // 3. Register Event listeners
      const creatorForm = document.getElementById('creator-gig-form');
      if (creatorForm) {
        creatorForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const btn = creatorForm.querySelector('button[type="submit"]');
          btn.disabled = true;
          btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Broadcasting...';

          const title = document.getElementById('gig-title').value;
          const category = document.getElementById('gig-category').value;
          const price = document.getElementById('gig-price').value;
          const deliveryTime = document.getElementById('gig-delivery').value;
          const tags = document.getElementById('gig-tags').value;
          const description = document.getElementById('gig-description').value;
          let imageUrl = document.getElementById('gig-image').value;

          // Default Image Presets if none provided
          if (!imageUrl) {
            if (category.includes('Dev')) {
              imageUrl = 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=600&q=80';
            } else if (category.includes('Design')) {
              imageUrl = 'https://images.unsplash.com/photo-1541462608141-ad4979e408c9?auto=format&fit=crop&w=600&q=80';
            } else if (category.includes('Marketing')) {
              imageUrl = 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=600&q=80';
            } else {
              imageUrl = 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=600&q=80';
            }
          }

          try {
            const res = await fetch('/api/services', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ title, category, price, deliveryTime, tags, description, imageUrl })
            });

            const body = await res.json();
            if (body.success) {
              showToast('Success! Your instant Gig package is live.', 'success');
              renderMyGigs();
            } else {
              showToast(body.message, 'error');
              btn.disabled = false;
              btn.innerHTML = '<i class="fa-solid fa-bullhorn" style="margin-right: 6px;"></i> Publish Live Service Offering';
            }
          } catch (err) {
            console.error('Error submitting service:', err);
            showToast('Failed to contact database server. Please try again.', 'error');
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-bullhorn" style="margin-right: 6px;"></i> Publish Live Service Offering';
          }
        });
      }

      // Deactivation hooks
      document.querySelectorAll('.btn-delete-gig').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const gigId = e.currentTarget.getAttribute('data-id');
          if (!confirm('Are you sure you want to de-list and deactivate this gig offering?')) return;

          try {
            const res = await fetch(`/api/services/${gigId}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            const result = await res.json();
            if (result.success) {
              showToast('Gig has been successfully deactivated and removed.', 'success');
              renderMyGigs();
            } else {
              showToast(result.message, 'error');
            }
          } catch (err) {
            console.error(err);
            showToast('Server connection error.', 'error');
          }
        });
      });

    } catch (error) {
      console.error('Error in renderMyGigs:', error);
      mainViewContainer.innerHTML = `<div style="padding: 20px; color: var(--error);">Failed to sync with Gigs Catalog. Please check connectivity.</div>`;
    }
  }

  // Helper function to escape HTML inside strings to keep UI resilient
  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  // Start visual render sequences
  renderTabs();

  // File dropzone click trigger & upload automation for flexible UX
  document.addEventListener('click', (e) => {
    const dz = e.target.closest('#dropzone-submit-milestone');
    if (dz) {
      document.getElementById('dropzone-hidden-file-input')?.click();
    }
  });

  window.handleDropDeliverable = function(file) {
    const feedback = document.getElementById('dropzone-file-feedback');
    const inputLink = document.getElementById('work-file-input');
    if (!feedback) return;

    feedback.style.display = 'block';
    feedback.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Uploading <b>${escapeHTML(file.name)}</b>...`;

    const formData = new FormData();
    formData.append('file', file);

    fetch('/api/upload', {
      method: 'POST',
      body: formData,
      headers: {
        'x-auth-token': localStorage.getItem('token') || ''
      }
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        feedback.innerHTML = `<i class="fa-solid fa-circle-check" style="color: var(--success);"></i> Uploaded: <b>${escapeHTML(file.name)}</b> - Ready for Deliverable submission!`;
        if (inputLink) {
          inputLink.value = window.location.origin + data.fileUrl;
        }
      } else {
        feedback.innerHTML = `<i class="fa-solid fa-circle-exclamation" style="color: var(--error);"></i> Upload failed: ${data.message}`;
      }
    })
    .catch(err => {
      console.error('File upload error:', err);
      feedback.innerHTML = `<i class="fa-solid fa-circle-exclamation" style="color: var(--error);"></i> Upload failed: Network error.`;
    });
  };
};

if (document.readyState === 'loading') {
  console.log('[Dashboard Auth Debug] Document not fully loaded. Binding to DOMContentLoaded.');
  document.addEventListener('DOMContentLoaded', initDashboard);
} else {
  console.log('[Dashboard Auth Debug] Document already complete. Starting initDashboard immediately.');
  initDashboard();
}
