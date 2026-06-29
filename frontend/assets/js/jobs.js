/**
 * Farelanceru Gigs Board Interactive Logic Service
 */

document.addEventListener('DOMContentLoaded', () => {
  // Global elements referencing
  const cardsContainer = document.getElementById('jobs-board-cards-container');
  const countAlert = document.getElementById('jobs-count-alert');
  
  // Search and filter element mapping
  const searchInput = document.getElementById('jobs-search-input');
  const searchBtn = document.getElementById('btn-trigger-search');
  const selectCategory = document.getElementById('filter-category');
  const budgetRangeInput = document.getElementById('filter-budget-range');
  const budgetRangeLabel = document.getElementById('budget-range-label');
  const budgetMinInput = document.getElementById('filter-budget-min');
  const budgetMaxInput = document.getElementById('filter-budget-max');
  const sortBySelect = document.getElementById('filter-sort-by');
  const applyFiltersBtn = document.getElementById('btn-apply-filters');
  const resetFiltersBtn = document.getElementById('btn-reset-filters-btn');
  const resetFiltersLink = document.getElementById('btn-reset-filters-link');
  const postJobTrigger = document.getElementById('btn-post-job-trigger');

  // Active filter state parameters
  const queryParams = new URLSearchParams(window.location.search);
  let filterTerm = queryParams.get('search') || '';
  let filterCategory = queryParams.get('category') || 'All';
  let filterMaxBudget = 10000;
  let filterMinBudget = 0;
  let activeSort = 'newest';

  // Cache for all loaded jobs
  let all_jobs_list = [];

  // Initialize filter form values from URL state
  if (searchInput && filterTerm) {
    searchInput.value = filterTerm;
  }
  if (selectCategory && filterCategory) {
    selectCategory.value = filterCategory;
  }

  // Range slider label updater
  if (budgetRangeInput && budgetRangeLabel) {
    budgetRangeInput.addEventListener('input', (e) => {
      filterMaxBudget = Number(e.target.value);
      budgetRangeLabel.textContent = `$10 - $${filterMaxBudget.toLocaleString()}`;
      if (budgetMaxInput) budgetMaxInput.value = filterMaxBudget;
    });
  }

  // 1. READ: Fetch all jobs from backend with criteria
  async function fetchJobs() {
    if (!cardsContainer) return;

    cardsContainer.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 0; color: var(--gray-600);">
        <div style="width: 48px; height: 48px; border: 4px solid var(--gray-200); border-top-color: var(--primary); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 15px;"></div>
        <p style="font-size: 15px; font-weight: 600;">Streaming secure escrow contract boards...</p>
      </div>
    `;

    try {
      // Fetch open contracts from jobs endpoints
      const url = `/api/jobs?category=${encodeURIComponent(filterCategory)}&search=${encodeURIComponent(filterTerm)}`;
      const res = await fetch(url);
      const result = await res.json();

      if (result.success && result.data.jobs) {
        all_jobs_list = result.data.jobs;
        applyClientFiltersAndRender();
      } else {
        cardsContainer.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--error);">Failed to load catalogs: ${result.message}</div>`;
      }
    } catch (err) {
      console.error('Fetch error: ', err);
      cardsContainer.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--error);">Problem connecting to server. Please check configurations.</div>`;
    }
  }

  // Apply client slider limits, sort types, and format jobs
  function applyClientFiltersAndRender() {
    let list = [...all_jobs_list];

    // Client-side Budget limits check
    const inputMin = Number(budgetMinInput?.value) || 0;
    const inputMax = Number(budgetMaxInput?.value) || 100000;
    const sliderMax = Number(budgetRangeInput?.value) || 100000;

    list = list.filter(job => {
      const price = job.budget || 0;
      return price >= inputMin && price <= inputMax && price <= sliderMax;
    });

    // Sorting
    if (activeSort === 'newest') {
      list.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (activeSort === 'oldest') {
      list.sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));
    } else if (activeSort === 'highest-budget') {
      list.sort((a,b) => b.budget - a.budget);
    } else if (activeSort === 'lowest-budget') {
      list.sort((a,b) => a.budget - b.budget);
    }

    // Update alert count
    if (countAlert) {
      countAlert.textContent = `${list.length} contract gigs available`;
    }

    if (list.length === 0) {
      cardsContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: white; border-radius: 16px; border: 1px dashed var(--gray-300);">
          <div style="font-size: 40px; margin-bottom: 12px;">🔍</div>
          <h3 style="font-size: 18px; margin-bottom: 6px; font-weight: 700;">No Contract Gigs Found</h3>
          <p style="color: var(--gray-600); font-size: 14px; max-width: 400px; margin: 0 auto 20px;">Try adjusting your slide filters, clearing keywords search, or switching categories.</p>
          <button class="btn btn-secondary" id="btn-empty-clear">Clear Filter Parameters</button>
        </div>
      `;
      document.getElementById('btn-empty-clear')?.addEventListener('click', resetAllFilters);
      return;
    }

    const currUser = window.FarelanceruState.user || {};

    // Render Cards Grid
    cardsContainer.innerHTML = list.map(job => {
      const clientName = job.client?.username || 'ClientBuyer';
      const hoursAgo = getRelativeTime(new Date(job.createdAt));
      const skillsArray = Array.isArray(job.skills) ? job.skills : [];
      const truncateDesc = job.description.length > 140 
        ? job.description.substring(0, 140) + '...' 
        : job.description;

      // Determine ownership controls (only owner client/admin can edit or delete)
      const isOwner = (currUser._id && (job.client?._id === currUser._id || job.client === currUser._id)) || currUser.role === 'admin';
      const isFreelancer = currUser.role === 'freelancer';

      return `
        <div class="job-premium-card card" data-jobid="${job._id}" data-title="${job.title.replace(/"/g, '&quot;')}">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
              <span class="card-category-badge">${job.category}</span>
              <span style="font-size: 11px; color: var(--gray-600);"><i class="fa-regular fa-clock" style="vertical-align:middle; display:inline-block; margin-top:-2px;"></i> ${hoursAgo}</span>
            </div>
            
            <h3 class="card-title text-gradient" style="-webkit-text-fill-color: inherit; font-size: 18px; transition: color 0.2s;">
              ${job.title}
            </h3>
            
            <p class="card-desc" style="margin-top: 10px;">${truncateDesc}</p>

            <div class="card-skills-tags" style="margin-top: 12px; margin-bottom: 15px;">
              ${skillsArray.map(s => `<span class="skill-pill">${s}</span>`).join('')}
              ${skillsArray.length === 0 ? '<span class="skill-pill" style="opacity: 0.5;">No tags</span>' : ''}
            </div>
          </div>

          <div>
            <div class="card-footer-stats">
              <div class="card-client-meta">
                <div style="width: 20px; height: 20px; border-radius: 50%; background: var(--gradient); display: flex; align-items: center; justify-content: center; color: white; font-size: 9px; font-weight: 800;">
                  ${clientName.substring(0,1).toUpperCase()}
                </div>
                <span>@${clientName}</span>
              </div>
              <div>
                <span style="font-size: 10px; color: var(--gray-600); text-align: right; display: block; margin-bottom: -1px;">Escrow Budget</span>
                <span class="card-budget-val">$${job.budget}</span>
              </div>
            </div>

            <div class="card-actions">
              <button class="btn btn-secondary btn-view-details" style="padding: 10px;"><i class="fa-solid fa-eye"></i> View</button>
              
              ${isOwner ? `
                <button class="btn btn-secondary btn-edit-trigger" style="border-color: #6366f1; color: #6366f1;"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
                <button class="btn btn-secondary btn-delete-trigger" style="border-color: #f87171; color: #ef4444;"><i class="fa-solid fa-trash"></i> Delete</button>
              ` : `
                <button class="btn btn-primary btn-bid-trigger" style="background: var(--gradient) !important;"><i class="fa-solid fa-paper-plane"></i> Bid Now</button>
              `}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }


  // Helper relative time formatter
  function getRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    return `${diffDay}d ago`;
  }

  // 2. CREATE: Submit Post Job form (buyer role authorization checks)
  const postForm = document.getElementById('post-job-form');
  if (postForm) {
    postForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const user = window.FarelanceruState.user;
      if (!user) {
        showToast('Authentication Error: Please sign in to post contract jobs.', 'error');
        toggleModal('post-job-modal', false);
        setTimeout(() => { window.location.href = '/login'; }, 1000);
        return;
      }

      if (user.role !== 'buyer' && user.role !== 'admin') {
        showToast('Error: Only buyers can post secure escrow contracts.', 'error');
        return;
      }

      const title = document.getElementById('post-title').value.trim();
      const category = document.getElementById('post-category').value;
      const budget = Number(document.getElementById('post-budget').value);
      const deadline = document.getElementById('post-deadline').value;
      const skills = document.getElementById('post-skills').value.trim();
      const description = document.getElementById('post-description').value.trim();

      if (budget < 10) {
        showToast('Numeric Check: Minimally funding requirement is $10.', 'warning');
        return;
      }

      if (user.balance < budget) {
        showToast(`Balance Deficit: Posting requires $${budget}, but your wallet balance is only $${user.balance}. Please add funds on your dashboard.`, 'error');
        return;
      }

      try {
        const res = await fetch('/api/jobs/post', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${window.FarelanceruState.token}`
          },
          body: JSON.stringify({ title, category, budget, deadline, skills, description })
        });

        const result = await res.json();
        if (result.success) {
          showToast('Success: Job posted & budget escrow securely funded!', 'success');
          postForm.reset();
          toggleModal('post-job-modal', false);

          // Real-time local state updates
          if (result.data && result.data.clientBalance !== undefined) {
             window.FarelanceruState.user.balance = result.data.clientBalance;
             localStorage.setItem('user', JSON.stringify(window.FarelanceruState.user));
             configureNavbarProfile();
          }
          fetchJobs();
        } else {
          showToast(result.message || 'Problem posting project.', 'error');
        }
      } catch (err) {
        console.error('Job post server error: ', err);
        showToast('Server communications exception.', 'error');
      }
    });
  }


  // 3. UPDATE: Trigger Edit Modal & prefill form values
  async function triggerEditForm(jobId) {
    const jobObj = all_jobs_list.find(j => j._id === jobId);
    if (!jobObj) return;

    toggleModal('edit-job-modal', true);

    document.getElementById('edit-job-id').value = jobId;
    document.getElementById('edit-title').value = jobObj.title;
    document.getElementById('edit-category').value = jobObj.category;
    document.getElementById('edit-budget').value = jobObj.budget;
    document.getElementById('edit-deadline').value = jobObj.deadline || '';
    document.getElementById('edit-skills').value = Array.isArray(jobObj.skills) ? jobObj.skills.join(', ') : '';
    document.getElementById('edit-description').value = jobObj.description;
  }

  // Handle Edit form submission
  const editForm = document.getElementById('edit-job-form');
  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const jobId = document.getElementById('edit-job-id').value;
      const title = document.getElementById('edit-title').value.trim();
      const category = document.getElementById('edit-category').value;
      const budget = Number(document.getElementById('edit-budget').value);
      const deadline = document.getElementById('edit-deadline').value;
      const skills = document.getElementById('edit-skills').value.trim();
      const description = document.getElementById('edit-description').value.trim();

      try {
        const res = await fetch(`/api/jobs/${jobId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${window.FarelanceruState.token}`
          },
          body: JSON.stringify({ title, category, budget, deadline, skills, description })
        });

        const result = await res.json();
        if (result.success) {
          showToast('Success: Escrow details updated successfully.', 'success');
          toggleModal('edit-job-modal', false);

          if (result.data && result.data.clientBalance !== undefined) {
            window.FarelanceruState.user.balance = result.data.clientBalance;
            localStorage.setItem('user', JSON.stringify(window.FarelanceruState.user));
            configureNavbarProfile();
          }
          fetchJobs();
        } else {
          showToast(result.message || 'Problem editing job scope.', 'error');
        }
      } catch (err) {
        console.error('Job edit exception: ', err);
        showToast('Server communications exception.', 'error');
      }
    });
  }


  // 4. DELETE: Trigger Delete Dialog & confirm deletion actions
  function triggerDeleteConfirm(jobId) {
    const inputId = document.getElementById('delete-job-id');
    if (inputId) {
      inputId.value = jobId;
      toggleModal('delete-confirm-modal', true);
    }
  }

  const deleteConfirmBtn = document.getElementById('btn-confirm-delete');
  if (deleteConfirmBtn) {
    deleteConfirmBtn.addEventListener('click', async () => {
      const jobId = document.getElementById('delete-job-id').value;
      if (!jobId) return;

      try {
        const res = await fetch(`/api/jobs/${jobId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${window.FarelanceruState.token}`
          }
        });

        const result = await res.json();
        if (result.success) {
          showToast('Success: Contract aborted and escrow budget returned to balance.', 'success');
          toggleModal('delete-confirm-modal', false);

          // Get fresh user metrics if returned
          await refreshUserBalance();
          fetchJobs();
        } else {
          showToast(result.message || 'Problem deleting the job.', 'error');
        }
      } catch (err) {
        console.error('Job delete error: ', err);
        showToast('Communications failure.', 'error');
      }
    });
  }


  // Auxiliary function to fetch and sync fresh buyer balance
  async function refreshUserBalance() {
    const user = window.FarelanceruState.user;
    if (!user) return;
    try {
      // Just re-fetch standard mock login state or dashboard stats
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${window.FarelanceruState.token}` }
      });
      const result = await res.json();
      if (result.success && result.data.user) {
        window.FarelanceruState.user = result.data.user;
        localStorage.setItem('user', JSON.stringify(result.data.user));
        configureNavbarProfile();
      }
    } catch (e) {
      console.warn("Could not sync wallet values instantly.", e);
    }
  }


  // 5. APPLY / BID NOW: Prefill bid parameters
  function triggerBidForm(jobId, jobTitle) {
    const user = window.FarelanceruState.user;
    if (!user) {
      if (window.showLoginRequiredModal) {
        window.showLoginRequiredModal('submit proposal bids');
      } else {
        showToast('Authentication Required: Please sign in to submit proposals.', 'warning');
        setTimeout(() => { window.location.href = '/login'; }, 1000);
      }
      return;
    }

    if (user.role !== 'freelancer') {
      showToast('Role Restriction: Only freelancer accounts can apply to projects.', 'error');
      return;
    }

    toggleModal('bid-proposal-modal', true);
    
    document.getElementById('bid-modal-job-id').value = jobId;
    document.getElementById('bid-modal-job-display').textContent = `Associated Gig: "${jobTitle}"`;
  }

  const bidForm = document.getElementById('modal-bid-form');
  if (bidForm) {
    bidForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const jobId = document.getElementById('bid-modal-job-id').value;
      const amount = Number(document.getElementById('bid-amount-input').value);
      const deliveryDays = Number(document.getElementById('bid-delivery-input').value);
      const proposal = document.getElementById('bid-proposal-input').value.trim();

      if (!jobId || !amount || !deliveryDays || !proposal) {
        showToast('Validation Check: Please enter all bid values and proposal pitch content.', 'warning');
        return;
      }

      try {
        const res = await fetch('/api/bids/place', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${window.FarelanceruState.token}`
          },
          body: JSON.stringify({ jobId, amount, deliveryDays, proposal })
        });

        const result = await res.json();
        if (result.success) {
          showToast('Success: Proposal and bid registered in secure escrow!', 'success');
          bidForm.reset();
          toggleModal('bid-proposal-modal', false);
          toggleDetailsDrawer(false); // also close details if open
          fetchJobs();
        } else {
          showToast(result.message || 'Bidding submission error.', 'error');
        }
      } catch (err) {
        console.error('Bid server posting error: ', err);
        showToast('Communications failure.', 'error');
      }
    });
  }


  // 6. VIEW DETAILS DRAWER (With current job bids list & dynamic Hire action)
  async function viewJobDetails(jobId) {
    const jobObj = all_jobs_list.find(j => j._id === jobId);
    if (!jobObj) return;

    // Fill Basic Values
    const breadcrumbsSpan = document.getElementById('detail-breadcrumbs');
    if (breadcrumbsSpan) {
      breadcrumbsSpan.innerHTML = `
        <span>Home</span> <i class="fa-solid fa-chevron-right" style="font-size: 8px; color: var(--gray-400);"></i>
        <span>Contracts Board</span> <i class="fa-solid fa-chevron-right" style="font-size: 8px; color: var(--gray-400);"></i>
        <span style="color: var(--primary);">${escapeHTML(jobObj.category)}</span>
      `;
    }
    document.getElementById('detail-title').textContent = jobObj.title;
    document.getElementById('detail-category').textContent = jobObj.category;
    document.getElementById('detail-client-username').textContent = `@${jobObj.client?.username || 'Client'}`;
    document.getElementById('detail-status').textContent = jobObj.status === 'open' ? 'Bidding Open' : jobObj.status;
    document.getElementById('detail-posted-at').textContent = new Date(jobObj.createdAt).toLocaleDateString();
    document.getElementById('detail-budget').textContent = `$${jobObj.budget}`;
    document.getElementById('detail-deadline').textContent = jobObj.deadline ? jobObj.deadline : 'flexible';
    document.getElementById('detail-description').textContent = jobObj.description;

    // Skills
    const skillsContainer = document.getElementById('detail-skills-container');
    if (skillsContainer) {
      const skillsArray = Array.isArray(jobObj.skills) ? jobObj.skills : [];
      skillsContainer.innerHTML = skillsArray.map(s => `<span class="skill-pill" style="font-size:11px; padding: 4px 10px;">${s}</span>`).join('');
      if (skillsArray.length === 0) {
        skillsContainer.innerHTML = `<span style="font-size:12px; color:var(--gray-600); font-style:italic;">No requirements specified.</span>`;
      }
    }

    // Adapt bid button inside details drawer based on roles
    const detailCtaWrapper = document.getElementById('detail-drawer-cta-wrapper');
    const currUser = window.FarelanceruState.user || {};
    const isOwner = currUser._id && (jobObj.client?._id === currUser._id || jobObj.client === currUser._id);
    
    if (detailCtaWrapper) {
      if (isOwner) {
        detailCtaWrapper.innerHTML = `
          <button class="btn btn-secondary" onclick="toggleDetailsDrawer(false); triggerEditForm('${jobObj._id}');" style="width: 100%; border-color: var(--primary); color: var(--primary); height: 48px; font-weight:700;">
            <i class="fa-solid fa-pen-to-square" style="vertical-align:middle; margin-right:4px;"></i> Edit Contract Specifications
          </button>
        `;
      } else if (currUser.role === 'buyer') {
        detailCtaWrapper.innerHTML = `
          <div style="background-color: var(--gray-100); text-align: center; border-radius: 8px; padding: 12px; font-size:12px; color: var(--gray-700);">
            Only freelancers can propose quotes. This contract belongs to @${jobObj.client?.username || 'Buyer'}.
          </div>
        `;
      } else {
        detailCtaWrapper.innerHTML = `
          <button class="btn btn-primary" id="btn-detail-drawer-apply-bid" style="width: 100%; height: 48px; font-weight: 700; background: var(--gradient) !important;">
            Transmit Proposal Pitch Plan Now
          </button>
        `;
        document.getElementById('btn-detail-drawer-apply-bid')?.addEventListener('click', () => {
          triggerBidForm(jobObj._id, jobObj.title);
        });
      }
    }

    // Launch Details slide drawer
    toggleDetailsDrawer(true);

    // Fetch existing live proposals list from backend
    const bidsListContainer = document.getElementById('detail-bids-list');
    const bidsHeaderCount = document.getElementById('detail-bids-header-count');
    
    if (bidsListContainer) {
      bidsListContainer.innerHTML = `
        <div style="text-align: center; padding: 20px 0; color: var(--gray-600);">
          <div style="width: 24px; height: 24px; border: 2px solid var(--gray-200); border-top-color: var(--primary); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 10px;"></div>
          <p style="font-size:12px;">Streaming current proposals...</p>
        </div>
      `;
    }

    try {
      const res = await fetch(`/api/bids/job/${jobObj._id}`, {
        headers: { 'Authorization': `Bearer ${window.FarelanceruState.token}` }
      });
      const result = await res.json();
      
      if (result.success && result.data.bids) {
        const bids = result.data.bids;
        if (bidsHeaderCount) bidsHeaderCount.textContent = `Submitted Proposals (${bids.length})`;
        
        if (bids.length === 0) {
          bidsListContainer.innerHTML = `
            <p style="font-size: 13px; color: var(--gray-600); font-style: italic; background-color: var(--gray-100); padding: 12px; border-radius:8px;">No pitch proposals have been registered yet. Be the first to place your bid!</p>
          `;
          return;
        }

        bidsListContainer.innerHTML = bids.map(bid => {
          const author = bid.freelancer?.username || 'Contractor';
          const isPending = bid.status === 'pending';
          const ratePrice = bid.amount || 0;
          const initials = author.substring(0,2).toUpperCase();

          return `
            <div class="bid-entry-item">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <div style="width: 24px; height: 24px; border-radius: 50%; background: var(--gradient); display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: 800;">
                    ${initials}
                  </div>
                  <span style="font-size: 13px; font-weight: 700; color: var(--dark);">@${author}</span>
                </div>
                <div style="text-align: right;">
                  <span style="font-size: 14px; font-weight: 800; color: var(--primary);">$${ratePrice}</span>
                  <span style="font-size: 10px; color: var(--gray-600); display: block;">in ${bid.deliveryDays} days</span>
                </div>
              </div>

              <p style="font-size: 12px; color: var(--gray-700); line-height: 1.5; font-style: italic; white-space: pre-line; background-color: white; padding: 10px; border-radius: 8px; border: 1px solid var(--gray-200);">
                "${bid.proposal}"
              </p>

              ${isOwner && isPending ? `
                <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:10px;">
                  <button class="btn btn-primary btn-accept-bid" data-bidid="${bid._id}" style="font-size:11px; padding: 6px 12px; background:var(--success) !important; box-shadow:none;">
                    Accept Proposal & Hire
                  </button>
                </div>
              ` : `
                <div style="text-align: right; margin-top: 6px;">
                  <span style="font-size:11px; font-weight:700; text-transform:uppercase; color:${bid.status === 'accepted' ? 'var(--success)' : (bid.status === 'rejected' ? 'var(--error)' : 'var(--warning)')}">
                    Status: ${bid.status}
                  </span>
                </div>
              `}
            </div>
          `;
        }).join('');

        // Link accept bid button event
        document.querySelectorAll('.btn-accept-bid').forEach(btn => {
          btn.addEventListener('click', async () => {
            const bidId = btn.dataset.bidid;
            await hireFreelancer(bidId);
          });
        });

      } else {
        bidsListContainer.innerHTML = `<p style="font-size:12px; color:var(--error);">${result.message || 'Error parsing bids.'}</p>`;
      }
    } catch (err) {
      console.error('Fetch bids error: ', err);
      bidsListContainer.innerHTML = `<p style="font-size:12px; color:var(--error);">Failed streaming proposals list.</p>`;
    }
  }


  // 7. CONTRACT HIRE: Accept proposal bid, escrow credit dispatch
  async function hireFreelancer(bidId) {
    if (!confirm('Are you ready to lock the escrow terms, accept this proposal, and start work immediately on progress tracking?')) return;

    try {
      const res = await fetch(`/api/bids/accept/${bidId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${window.FarelanceruState.token}`
        }
      });

      const result = await res.json();
      if (result.success) {
        showToast('Success Authorized: Bid accepted, escrow locked, and expert contractor hired!', 'success');
        
        toggleDetailsDrawer(false);

        // Update balances
        if (result.data && result.data.clientBalance !== undefined) {
          window.FarelanceruState.user.balance = result.data.clientBalance;
          localStorage.setItem('user', JSON.stringify(window.FarelanceruState.user));
          configureNavbarProfile();
        }

        fetchJobs();
      } else {
        showToast(result.message || 'Failed hiring contractor.', 'error');
      }
    } catch (err) {
      console.error('Hire freelancer error: ', err);
      showToast('Communications failure hiring freelancer.', 'error');
    }
  }


  // 8. DYNAMIC FILTER DELEGATION CONTROLLERS
  if (applyFiltersBtn) {
    applyFiltersBtn.addEventListener('click', () => {
      if (selectCategory) filterCategory = selectCategory.value;
      activeSort = sortBySelect?.value || 'newest';
      applyClientFiltersAndRender();
      showToast('Filtering parameters applied successfully.', 'success');
    });
  }

  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', resetAllFilters);
  }
  if (resetFiltersLink) {
    resetFiltersLink.addEventListener('click', resetAllFilters);
  }

  function resetAllFilters() {
    if (searchInput) searchInput.value = '';
    filterTerm = '';
    if (selectCategory) selectCategory.value = 'All';
    filterCategory = 'All';
    
    // Clear min max inputs
    if (budgetMinInput) budgetMinInput.value = '';
    if (budgetMaxInput) budgetMaxInput.value = '';
    
    if (budgetRangeInput) {
      budgetRangeInput.value = 10000;
      budgetRangeLabel.textContent = '$10 - $10,000';
    }
    filterMaxBudget = 10000;
    
    if (sortBySelect) sortBySelect.value = 'newest';
    activeSort = 'newest';

    applyClientFiltersAndRender();
    showToast('All filter criteria have been reset.', 'success');
  }


  // Live Search trigger listeners
  if (searchInput) {
    // Live keyboard updates
    searchInput.addEventListener('input', (e) => {
      filterTerm = e.target.value;
      applyClientFiltersAndRender();
    });

    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        filterTerm = searchInput.value;
        fetchJobs();
      }
    });
  }

  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      if (searchInput) filterTerm = searchInput.value;
      fetchJobs();
    });
  }


  // 9. EVENT DELEGATION: Bound buttons handlers on dynamically generated cards
  if (cardsContainer) {
    cardsContainer.addEventListener('click', (e) => {
      const cardEl = e.target.closest('.job-premium-card');
      if (!cardEl) return;
      const jobId = cardEl.dataset.jobid;
      const jobTitle = cardEl.dataset.title;

      if (e.target.closest('.btn-view-details')) {
        viewJobDetails(jobId);
      } else if (e.target.closest('.btn-bid-trigger')) {
        triggerBidForm(jobId, jobTitle);
      } else if (e.target.closest('.btn-edit-trigger')) {
        triggerEditForm(jobId);
      } else if (e.target.closest('.btn-delete-trigger')) {
        triggerDeleteConfirm(jobId);
      }
    });
  }


  // 10. POST JOB AUTHORIZATION SECURITY TRIGGER
  if (postJobTrigger) {
    postJobTrigger.addEventListener('click', () => {
      const user = window.FarelanceruState.user;
      if (!user) {
        showToast('Authentication Error: Please sign in to deploy escrow contracts.', 'error');
        setTimeout(() => { window.location.href = '/login'; }, 1000);
        return;
      }

      if (user.role !== 'buyer' && user.role !== 'admin') {
        showToast('Access Block: Only Buyer clients can post jobs and fund escrow pools.', 'error');
        return;
      }

      // Launch post modal
      toggleModal('post-job-modal', true);
    });
  }


  // =========================================================================
  // 11. ADVANCED FREELANCER DIRECTORY SYSTEM (FIVERR & UPWORK MODEL)
  // =========================================================================
  let all_freelancers_list = [];
  let freelancerSearchTerm = '';
  let freelancerSortBy = 'rating';

  async function fetchFreelancers() {
    const fnContainer = document.getElementById('freelancers-board-container');
    if (!fnContainer) return;

    fnContainer.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 0; color: var(--gray-600);">
        <div style="width: 48px; height: 48px; border: 4px solid var(--gray-200); border-top-color: var(--primary); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 15px;"></div>
        <p style="font-size: 15px; font-weight: 600;">Streaming vetted freelance developers and creators...</p>
      </div>
    `;

    try {
      const res = await fetch('/api/auth/freelancers');
      const result = await res.json();

      if (result.success && result.data.freelancers) {
        all_freelancers_list = result.data.freelancers;
        applyExpertClientFiltersAndRender();
      } else {
        fnContainer.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--error);">Failed to load professionals catalog: ${result.message}</div>`;
      }
    } catch (err) {
      console.error('Fetch freelancers error: ', err);
      fnContainer.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--error);">Failed connecting to the experts hub.</div>`;
    }
  }

  function applyExpertClientFiltersAndRender() {
    const fnContainer = document.getElementById('freelancers-board-container');
    const headerCount = document.getElementById('experts-count-header');
    if (!fnContainer) return;

    let list = [...all_freelancers_list];

    // Filter by search query
    if (freelancerSearchTerm) {
      const s = freelancerSearchTerm.toLowerCase();
      list = list.filter(item => {
        const titleStr = (item.profile?.title || '').toLowerCase();
        const bioStr = (item.profile?.bio || '').toLowerCase();
        const nameStr = (item.username || '').toLowerCase();
        const skillsStr = (item.profile?.skills || []).join(' ').toLowerCase();
        return titleStr.includes(s) || bioStr.includes(s) || nameStr.includes(s) || skillsStr.includes(s);
      });
    }

    // Sort models
    if (freelancerSortBy === 'rating') {
      list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (freelancerSortBy === 'contracts') {
      list.sort((a, b) => (b.completedCount || 0) - (a.completedCount || 0));
    } else if (freelancerSortBy === 'rate-low') {
      list.sort((a, b) => (a.profile?.hourlyRate || 0) - (b.profile?.hourlyRate || 0));
    } else if (freelancerSortBy === 'rate-high') {
      list.sort((a, b) => (b.profile?.hourlyRate || 0) - (a.profile?.hourlyRate || 0));
    }

    if (headerCount) {
      headerCount.textContent = `Expert Listings (${list.length})`;
    }

    if (list.length === 0) {
      fnContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: white; border-radius: 16px; border: 1px dashed var(--gray-300);">
          <div style="font-size: 40px; margin-bottom: 12px;">🤷‍♂️</div>
          <h3 style="font-size: 18px; margin-bottom: 6px; font-weight: 700;">No Matching Specialists</h3>
          <p style="color: var(--gray-600); font-size: 14px; max-width: 440px; margin: 0 auto;">No freelancers match your keywords. Try searching for broader terms like "React", "Design", "Writer", or click trending skills tags above.</p>
        </div>
      `;
      return;
    }

    const currUser = window.FarelanceruState.user || {};
    const savedIds = (currUser.savedFreelancers || []).map(item => item.type || item);

    fnContainer.innerHTML = list.map(item => {
      const p = item.profile || {};
      const coverUrl = p.coverImage || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80';
      const avatarTxt = item.username.charAt(0).toUpperCase();
      const ratingVal = item.rating || 5.0;
      const completedVal = item.completedCount || 0;
      const skillsArray = p.skills || [];
      const truncateBio = p.bio && p.bio.length > 120 
        ? p.bio.substring(0, 110) + '...' 
        : p.bio || 'Professional contractor verified under Farelanceru secure milestones.';
      
      const isSaved = savedIds.includes(item._id);

      return `
        <div class="expert-card" data-expertid="${item._id}">
          <div class="expert-cover" style="background-image: url('${coverUrl}')"></div>
          
          <div class="expert-avatar-wrap">
            <div class="expert-photo">
              ${avatarTxt}
            </div>
            
            <button class="btn-toggle-save-expert" style="width:34px; height:34px; border-radius:50%; border:1px solid var(--gray-200); background:white; color:${isSaved ? 'var(--error)' : 'var(--gray-500)'}; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:var(--shadow-sm); z-index:5;" title="Toggle Save Specialist">
              <i class="${isSaved ? 'fa-solid fa-heart' : 'fa-regular fa-heart'}"></i>
            </button>
          </div>

          <div style="padding: 15px 20px 20px; display:flex; flex-direction:column; justify-content:space-between; flex-grow:1;">
            <div>
              <h3 style="font-size: 16px; font-weight: 850; margin: 0 0 2px; color:var(--dark);">@${item.username}</h3>
              <p style="font-size: 13px; font-weight: 700; color:var(--primary); margin:0 0 6px;">${p.title || 'Independent Creator'}</p>
              
              <div style="display:flex; align-items:center; gap:8px; font-size:12px; margin-bottom:8px;">
                <span style="font-weight:700; color:#b45309;"><i class="fa-solid fa-star star-gold" style="color: #fbbf24;"></i> ${ratingVal.toFixed(1)}</span>
                <span style="color:var(--gray-400);">|</span>
                <span style="color:var(--gray-600);"><i class="fa-solid fa-briefcase" style="color:var(--secondary); font-size:11px;"></i> ${completedVal} gigs</span>
              </div>

              <p style="font-size:12.5px; color:var(--gray-700); line-height:1.5; margin:0 0 10px;">${truncateBio}</p>

              <div class="skill-pills-row" style="display: flex; flex-wrap: wrap; gap: 6px; margin: 14px 0;">
                ${skillsArray.slice(0, 3).map(s => `<span class="skill-pill-item" style="font-size: 11px; font-weight: 600; background: var(--gray-100); color: var(--gray-700); padding: 4px 10px; border-radius: 999px;">${s}</span>`).join('')}
                ${skillsArray.length > 3 ? `<span class="skill-pill-item" style="font-size: 11px; font-weight: 600; background: var(--gray-100); color: var(--gray-700); padding: 4px 10px; border-radius: 999px; opacity:0.6;">+${skillsArray.length - 3}</span>` : ''}
              </div>
            </div>

            <div style="border-top: 1px solid var(--gray-100); padding-top:14px; margin-top:10px; display:flex; justify-content:space-between; align-items:center; gap: 8px; width:100%;">
              <div>
                <span style="font-size:10px; color:var(--gray-600); display:block; text-transform:uppercase; font-weight:600;">Rate</span>
                <span style="font-size:15px; font-weight:850; color:var(--dark);">$${p.hourlyRate || 25}/hr</span>
              </div>
              <div style="display:flex; gap:6px;">
                <button onclick="window.openMessageModal('${item._id}', '${item.username}', '${p.avatar || ''}'); event.stopPropagation();" class="btn btn-secondary" style="padding: 0 10px; height:36px; border-color:var(--gray-300); background:white; color:var(--dark); cursor:pointer;" title="Inquire Direct Message">
                  <i class="fa-regular fa-comment-dots" style="font-size:14px;"></i>
                </button>
                <button class="btn btn-secondary btn-view-expert-profile" style="padding: 8px 12px; font-size:12px; font-weight:700; height:36px; border-color:var(--primary); color:var(--primary);">View Pro</button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Handle Saved Specialst Toggle Call
  async function toggleSaveSpecialist(btn, freelancerId) {
    const token = window.FarelanceruState.token;
    if (!token) {
      if (window.showLoginRequiredModal) {
        window.showLoginRequiredModal('bookmark professional specialists');
      } else {
        showToast('Authentication check: Please log in to bookmark freelancers.', 'warning');
        setTimeout(() => { window.location.href = '/login'; }, 1000);
      }
      return;
    }

    try {
      const res = await fetch('/api/auth/save-freelancer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ freelancerId })
      });
      const result = await res.json();

      if (result.success) {
        const icon = btn.querySelector('i');
        const isSavedNow = result.data.action === 'saved';

        if (isSavedNow) {
          icon.className = 'fa-solid fa-heart';
          btn.style.color = 'var(--error)';
          showToast('Specialist added to your saved shortlist portfolio!', 'success');
        } else {
          icon.className = 'fa-regular fa-heart';
          btn.style.color = 'var(--gray-500)';
          showToast('Specialist removed from your saved list.', 'success');
        }

        // Sync local storage state
        window.FarelanceruState.user.savedFreelancers = result.data.savedFreelancers;
        localStorage.setItem('user', JSON.stringify(window.FarelanceruState.user));
      } else {
        showToast(result.message || 'Error occurred saving freelancer.', 'error');
      }
    } catch (err) {
      console.error('Error in toggleSaveSpecialist: ', err);
      showToast('Communications failure.', 'error');
    }
  }

  // Interactive Detailed User Profile Drawer
  window.currentDetailedExpert = null;

  async function openExpertProfileDrawer(expertId) {
    const drawer = document.getElementById('profile-drawer');
    const overlay = document.getElementById('profile-drawer-overlay');
    const contentBox = document.getElementById('profile-drawer-content-box');
    if (!drawer || !overlay || !contentBox) return;

    drawer.classList.add('active');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    contentBox.innerHTML = `
      <div style="text-align: center; padding: 60px 0; color: var(--gray-600);">
        <div style="width: 36px; height: 36px; border: 3px solid var(--gray-200); border-top-color: var(--primary); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 15px;"></div>
        <p style="font-size:13px;">Assembling profile details, dynamic reviews, and portfolio galleries...</p>
      </div>
    `;

    try {
      const res = await fetch(`/api/auth/user/${expertId}`, {
        headers: { 'Authorization': `Bearer ${window.FarelanceruState.token || ''}` }
      });
      const result = await res.json();

      if (result.success && result.data.user) {
        const extUser = result.data.user;
        window.currentDetailedExpert = extUser;
        renderDetailedExpertDrawer(extUser);
      } else {
        contentBox.innerHTML = `<div style="text-align:center; padding:40px; color:var(--error);">Failed to fetch profile: ${result.message}</div>`;
      }
    } catch (err) {
      console.error('Fetch expert profile log failed: ', err);
      contentBox.innerHTML = `<div style="text-align:center; padding:40px; color:var(--error);">Failed resolving user profile with server.</div>`;
    }
  }

  function renderDetailedExpertDrawer(user) {
    const contentBox = document.getElementById('profile-drawer-content-box');
    if (!contentBox) return;

    const p = user.profile || {};
    const coverUrl = p.coverImage || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80';
    const initials = user.username.charAt(0).toUpperCase();
    const ratingVal = user.rating || 5.0;
    const completedVal = user.completedCount || 0;
    const skillsArray = p.skills || [];
    const bioText = p.bio || 'Verified freelance specialist adhering to escrow contracts.';
    const experienceText = p.experience || '';
    const social = p.socialLinks || { github: '', linkedin: '', twitter: '' };

    const portfolioList = user.portfolio || [];
    const reviewsList = user.reviews || [];

    // Construct social links markup
    let socialMarkup = '';
    if (social.github) {
      socialMarkup += `
        <a href="${social.github}" target="_blank" rel="noopener noreferrer" style="color:var(--dark); font-size:18px; margin-right: 12px;" title="GitHub Profile">
          <i class="fa-brands fa-github"></i> GitHub
        </a>`;
    }
    if (social.linkedin) {
      socialMarkup += `
        <a href="${social.linkedin}" target="_blank" rel="noopener noreferrer" style="color:#0a66c2; font-size:18px; margin-right: 12px;" title="LinkedIn Connection">
          <i class="fa-brands fa-linkedin"></i> LinkedIn
        </a>`;
    }
    if (social.twitter) {
      socialMarkup += `
        <a href="${social.twitter}" target="_blank" rel="noopener noreferrer" style="color:#1da1f2; font-size:18px; margin-right: 12px;" title="Twitter Feed">
          <i class="fa-brands fa-twitter"></i> Twitter
        </a>`;
    }
    if (!socialMarkup) {
      socialMarkup = `<span style="font-size:12.5px; color:var(--gray-400); font-style:italic;">No social networks shared yet</span>`;
    }

    contentBox.innerHTML = `
      <!-- Cover and Profile overlay -->
      <div style="background-image: url('${coverUrl}'); height: 130px; width:100%; background-size:cover; background-position:center; border-radius:12px; position:relative; margin-bottom: 52px; border: 1px solid var(--gray-200);">
        <div style="position: absolute; bottom:-40px; left:20px; width:80px; height:80px; border-radius:50%; background:var(--gradient); border:4px solid white; display:flex; align-items:center; justify-content:center; color:white; font-size:28px; font-weight:800; box-shadow:var(--shadow-sm); overflow:hidden;">
          ${initials}
        </div>
      </div>

      <!-- Identity & verification -->
      <div style="margin-bottom:24px;">
        <div style="display:flex; justify-content:space-between; align-items:start; gap: 10px;">
          <div>
            <h2 style="font-size: 22px; font-weight: 850; margin: 0; color:var(--dark);">@${user.username}</h2>
            <p style="font-size:14.5px; font-weight:700; color:var(--primary); margin:2px 0 6px;">${p.title || 'Creative Specialist'}</p>
          </div>
          
          <div style="text-align: right; min-width: 100px;">
            <p style="font-size:11px; color:var(--gray-600); margin:0;">HOURLY RATE</p>
            <p style="font-size:22px; font-weight:850; color:var(--dark);">$${p.hourlyRate || 35}<b style="font-size:13px; font-weight:400; color:var(--gray-700)">/hr</b></p>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:12px; font-size:12.5px; margin-top:8px;">
          <span style="font-weight:700; color:#b45309; display:inline-flex; align-items:center; gap:4px;"><i class="fa-solid fa-star" style="color:#fbbf24;"></i> ${ratingVal.toFixed(1)}</span>
          <span style="color:var(--gray-400);">|</span>
          <span style="color:var(--gray-700); font-weight:600;"><i class="fa-solid fa-cloud-arrow-up" style="color:var(--secondary)"></i> ${completedVal} jobs completed</span>
        </div>
      </div>

      <!-- Quick Action Buttons: Send Message / Hire instantly -->
      <div style="display:flex; gap:12px; margin-bottom:30px;">
        <button class="btn btn-primary" id="btn-expert-drawer-chat" style="flex-grow:1; justify-content:center; height:44px;"><i class="fa-regular fa-comment-dots"></i> Message Expert</button>
        <button class="btn btn-secondary" id="btn-expert-drawer-hire" style="flex-grow:1; justify-content:center; height:44px; border-color:var(--primary); color:var(--primary);"><i class="fa-solid fa-briefcase"></i> Propose Contract</button>
      </div>

      <!-- Bio description section -->
      <div style="margin-bottom:30px;">
        <h4 style="font-size:13px; font-weight:800; text-transform:uppercase; color:var(--gray-600); border-bottom:1px solid var(--gray-100); padding-bottom:6px; margin-bottom:10px; letter-spacing:0.5px;">About & Bio</h4>
        <p style="font-size:13.5px; color:var(--gray-800); line-height:1.6; white-space:pre-wrap;">${bioText}</p>
      </div>

      <!-- Skill list section -->
      <div style="margin-bottom:30px;">
        <h4 style="font-size:13px; font-weight:800; text-transform:uppercase; color:var(--gray-600); border-bottom:1px solid var(--gray-100); padding-bottom:6px; margin-bottom:10px; letter-spacing:0.5px;">Skills & Technologies</h4>
        <div style="display:flex; flex-wrap:wrap; gap:8px;">
          ${skillsArray.map(s => `<span class="skill-pill-item" style="font-size:12px; padding: 6px 12px; background:var(--gray-100); color:var(--gray-700); border-radius:999px; font-weight:600;">${s}</span>`).join('')}
          ${skillsArray.length === 0 ? `<span style="font-size:12.5px; color:var(--gray-600); font-style:italic;">No listed skills tags yet.</span>` : ''}
        </div>
      </div>

      <!-- Social and Professional Networks -->
      <div style="margin-bottom:30px;">
        <h4 style="font-size:13px; font-weight:800; text-transform:uppercase; color:var(--gray-600); border-bottom:1px solid var(--gray-100); padding-bottom:6px; margin-bottom:10px; letter-spacing:0.5px;">Professional Connections</h4>
        <div style="display:flex; gap:16px; align-items:center; flex-wrap:wrap;">
          ${socialMarkup}
        </div>
      </div>

      <!-- Experience timeline / description -->
      ${experienceText ? `
      <div style="margin-bottom:30px;">
        <h4 style="font-size:13px; font-weight:800; text-transform:uppercase; color:var(--gray-600); border-bottom:1px solid var(--gray-100); padding-bottom:6px; margin-bottom:10px; letter-spacing:0.5px;">Experience Overview</h4>
        <p style="font-size:13.5px; color:var(--gray-800); line-height:1.6; white-space:pre-wrap; border-left: 3px solid var(--primary); padding-left:14px; margin:0;">${experienceText}</p>
      </div>` : ''}

      <!-- Portfolio Showcases list -->
      <div style="margin-bottom:30px;">
        <h4 style="font-size:13px; font-weight:800; text-transform:uppercase; color:var(--gray-600); border-bottom:1px solid var(--gray-100); padding-bottom:6px; margin-bottom:12px; letter-spacing:0.5px;">Portfolio Showroom</h4>
        ${portfolioList.length === 0 ? `
          <p style="font-size:13px; color:var(--gray-500); font-style:italic; background:var(--gray-100); padding:12px; border-radius:8px; margin:0;">No verified projects loaded in their showroom yet.</p>
        ` : `
          <div class="showcase-grid">
            ${portfolioList.map((pj, idx) => {
              const pImage = pj.imageUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80';
              return `
                <div class="showcase-card" onclick="viewDetailedShowcaseProject(${idx})" style="border: 1px solid var(--gray-200); border-radius: 12px; overflow: hidden; cursor: pointer; background: white; transition: all 0.2s ease;">
                  <div style="background-image:url('${pImage}'); height:110px; width:100%; background-size:cover; background-position:center;"></div>
                  <div style="padding:10px;">
                    <h5 style="font-size:13px; font-weight:700; margin:0; line-height:1.2;" class="text-gradient">${pj.title}</h5>
                    <p style="font-size:11px; color:var(--gray-600); margin:4px 0 0; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${pj.description}</p>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>

      <!-- Verified client reviews lists -->
      <div style="margin-bottom:20px;">
        <h4 style="font-size:13px; font-weight:800; text-transform:uppercase; color:var(--gray-600); border-bottom:1px solid var(--gray-100); padding-bottom:6px; margin-bottom:12px; letter-spacing:0.5px;">Verified Peer Feedback</h4>
        ${reviewsList.length === 0 ? `
          <p style="font-size:13px; color:var(--gray-500); font-style:italic; background:var(--gray-100); padding:12px; border-radius:8px; margin:0;">This expert has not completed contract milestones yet.</p>
        ` : `
          <div style="display:flex; flex-direction:column; gap:12px;">
            ${reviewsList.map(rv => {
              const starsHtml = Array.from({ length: 5 }, (_, x) => {
                const isGold = (x + 1) <= rv.rating;
                return `<i class="fa-solid fa-star" style="color:${isGold ? '#fbbf24' : '#e2e8f0'}; font-size:10px; margin-right:1px;"></i>`;
              }).join('');
              return `
                <div style="border:1px solid var(--gray-200); border-radius:8px; padding:12px; background:white;">
                  <div style="display:flex; justify-content:space-between; align-items:start; gap: 8px; margin-bottom:4px;">
                    <div>
                      <span style="font-size:12.5px; font-weight:700; color:var(--dark);">@${rv.reviewerName}</span>
                      <span style="font-size:10px; color:var(--gray-600); text-transform:uppercase; background-color:var(--gray-100); padding:1px 6px; border-radius:4px; font-weight:700; margin-left:4px;">Client</span>
                    </div>
                    <div style="display:flex;">
                      ${starsHtml}
                    </div>
                  </div>
                  <p style="font-size:11.5px; color:var(--primary); font-weight:700; margin:2px 0 6px;">Gig: "${rv.jobTitle || 'Milestone clearance'}"</p>
                  <p style="font-size:12.5px; color:var(--gray-700); font-style:italic; line-height:1.4; margin:0;">"${rv.comment || 'Smooth escrow, secure clearance released instantly.'}"</p>
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px;">
                    <span style="font-size:10px; color:var(--success); font-weight:700;"><i class="fa-solid fa-circle-check"></i> Escrow Released</span>
                    <span style="font-size:9.5px; color:var(--gray-400);">${new Date(rv.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;

    // Hook instant message/hire triggers
    document.getElementById('btn-expert-drawer-chat')?.addEventListener('click', () => {
      // Connect to the beautiful Quick Message modal
      if (window.openMessageModal) {
        // Safe close drawer first to make it look clean
        const closeDrawerBtn = document.getElementById('btn-close-profile-drawer');
        closeDrawerBtn?.click();
        
        setTimeout(() => {
          window.openMessageModal(user._id, user.username, p.avatar || '');
        }, 300);
      } else {
        const token = window.FarelanceruState.token;
        if (!token) {
          showToast('Authentication check: Please log in to connect with freelancers.', 'warning');
          setTimeout(() => { window.location.href = '/login'; }, 1000);
          return;
        }
        window.location.href = `/chat?receiverId=${user._id}&username=${user.username}`;
      }
    });

    document.getElementById('btn-expert-drawer-hire')?.addEventListener('click', () => {
      const token = window.FarelanceruState.token;
      if (!token) {
        showToast('Authentication check: Please log in to propose escrow jobs.', 'warning');
        setTimeout(() => { window.location.href = '/login'; }, 1000);
        return;
      }
      
      const role = window.FarelanceruState.user?.role;
      if (role !== 'buyer' && role !== 'admin') {
        showToast('Access Block: Only Buyer clients can setup contract jobs.', 'error');
        return;
      }

      showToast('Client Actions: Navigate to gigs board to post catalogs with deliverables, then accept this expert\'s application proposal.', 'success');
      setTimeout(() => { window.location.href = '/jobs'; }, 1500);
    });
  }

  window.viewDetailedShowcaseProject = function(projectIndex) {
    const userObj = window.currentDetailedExpert;
    if (!userObj || !userObj.portfolio || !userObj.portfolio[projectIndex]) return;

    const pj = userObj.portfolio[projectIndex];

    const modalTitle = document.getElementById('portfolio-detail-title');
    const modalDesc = document.getElementById('portfolio-detail-desc');
    const modalImg = document.getElementById('portfolio-detail-img-wrapper');
    const modalUrl = document.getElementById('portfolio-detail-url');

    if (modalTitle) modalTitle.textContent = pj.title;
    if (modalDesc) modalDesc.textContent = pj.description || 'Verified product demonstration milestones.';
    if (modalImg) {
      const img = pj.imageUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80';
      modalImg.style.backgroundImage = `url('${img}')`;
    }
    if (modalUrl) {
      if (pj.projectUrl) {
        modalUrl.style.display = 'inline-flex';
        modalUrl.href = pj.projectUrl;
      } else {
        modalUrl.style.display = 'none';
      }
    }

    toggleModal('portfolio-project-detail-modal', true);
  };

  // Event tracking for /freelancers page
  const fnContainer = document.getElementById('freelancers-board-container');
  if (fnContainer) {
    // 1. Search text input
    const eSearchIn = document.getElementById('experts-search-input');
    const eSearchBtn = document.getElementById('btn-experts-search');

    if (eSearchIn) {
      eSearchIn.addEventListener('input', (event) => {
        freelancerSearchTerm = event.target.value;
        applyExpertClientFiltersAndRender();
      });
      eSearchIn.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
          freelancerSearchTerm = eSearchIn.value;
          applyExpertClientFiltersAndRender();
        }
      });
    }

    if (eSearchBtn) {
      eSearchBtn.addEventListener('click', () => {
        if (eSearchIn) freelancerSearchTerm = eSearchIn.value;
        applyExpertClientFiltersAndRender();
      });
    }

    // 2. Sort dropdown
    const eSortSelect = document.getElementById('experts-sort-select');
    if (eSortSelect) {
      eSortSelect.addEventListener('change', (event) => {
        freelancerSortBy = event.target.value;
        applyExpertClientFiltersAndRender();
      });
    }

    // 3. Delegation hooks for cards buttons clicking
    fnContainer.addEventListener('click', (e) => {
      const cardEl = e.target.closest('.expert-card');
      if (!cardEl) return;
      
      const expertId = cardEl.dataset.expertid;

      // Handle heart click
      const saveBtn = e.target.closest('.btn-toggle-save-expert');
      if (saveBtn) {
        e.stopPropagation();
        toggleSaveSpecialist(saveBtn, expertId);
        return;
      }

      // Handle view profile click (or click anywhere on the card header-content other than heart)
      const viewProfileBtn = e.target.closest('.btn-view-expert-profile');
      if (viewProfileBtn || !e.target.closest('button')) {
        openExpertProfileDrawer(expertId);
      }
    });

    // 4. Close drawer listener
    const closeDrawerBtn = document.getElementById('btn-close-profile-drawer');
    const drawerOverlay = document.getElementById('profile-drawer-overlay');
    
    const closeDrawerAction = () => {
      const drawer = document.getElementById('profile-drawer');
      const overlay = document.getElementById('profile-drawer-overlay');
      drawer?.classList.remove('active');
      overlay?.classList.remove('active');
      document.body.style.overflow = '';
    };

    closeDrawerBtn?.addEventListener('click', closeDrawerAction);
    drawerOverlay?.addEventListener('click', closeDrawerAction);
  }


  // =========================================================================
  // GIGS & SERVICES (FIVERR-STYLE GIG MARKETPLACE SYSTEMS)
  // =========================================================================
  let activeListingMode = 'jobs'; // 'jobs' or 'services'
  let all_services_list = [];

  // Expose global switchListingTab function
  window.switchListingTab = function(mode) {
    activeListingMode = mode;
    const tabJobs = document.getElementById('toggle-tab-jobs');
    const tabServices = document.getElementById('toggle-tab-services');

    if (tabJobs && tabServices) {
      if (mode === 'jobs') {
        tabJobs.classList.add('active');
        tabJobs.style.background = 'white';
        tabJobs.style.color = 'var(--dark)';
        tabServices.classList.remove('active');
        tabServices.style.background = 'transparent';
        tabServices.style.color = 'var(--gray-600)';
        
        // Unhide standard jobs action elements
        const postTriggerBtn = document.getElementById('btn-post-job-trigger');
        if (postTriggerBtn) postTriggerBtn.style.display = 'block';

        fetchJobs();
      } else {
        tabServices.classList.add('active');
        tabServices.style.background = 'white';
        tabServices.style.color = 'var(--dark)';
        tabJobs.classList.remove('active');
        tabJobs.style.background = 'transparent';
        tabJobs.style.color = 'var(--gray-600)';

        // Hide post job trigger for services view to look uncluttered
        const postTriggerBtn = document.getElementById('btn-post-job-trigger');
        if (postTriggerBtn) postTriggerBtn.style.display = 'none';

        fetchServices();
      }
    }
  };

  // Fetch Services from database
  async function fetchServices() {
    if (!cardsContainer) return;

    cardsContainer.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 0; color: var(--gray-600);">
        <div style="width: 48px; height: 48px; border: 4px solid var(--gray-200); border-top-color: var(--primary); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 15px;"></div>
        <p style="font-size: 15px; font-weight: 600;">Streaming active Freelancer Gigs...</p>
      </div>
    `;

    try {
      const url = `/api/services?category=${encodeURIComponent(filterCategory)}&search=${encodeURIComponent(filterTerm)}`;
      const res = await fetch(url);
      const result = await res.json();

      if (result.success && result.data) {
        all_services_list = result.data;
        applyServiceClientFiltersAndRender();
      } else {
        cardsContainer.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--error);">Failed to load Gigs: ${result.message}</div>`;
      }
    } catch (err) {
      console.error('Fetch services error: ', err);
      cardsContainer.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--error);">Problem connecting to server. Please try again.</div>`;
    }
  }

  // Client-side filter and render for Services catalog
  function applyServiceClientFiltersAndRender() {
    let list = [...all_services_list];

    // Client-side pricing filters
    const inputMin = Number(budgetMinInput?.value) || 0;
    const inputMax = Number(budgetMaxInput?.value) || 100000;
    const sliderMax = Number(budgetRangeInput?.value) || 100000;

    list = list.filter(g => {
      const price = g.price || 0;
      return price >= inputMin && price <= inputMax && price <= sliderMax;
    });

    // Sort order
    if (activeSort === 'newest') {
      list.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (activeSort === 'oldest') {
      list.sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));
    } else if (activeSort === 'highest-budget') {
      list.sort((a,b) => b.price - a.price);
    } else if (activeSort === 'lowest-budget') {
      list.sort((a,b) => a.price - b.price);
    }

    // Update alert count
    if (countAlert) {
      countAlert.textContent = `${list.length} professional gigs available`;
    }

    if (list.length === 0) {
      cardsContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: white; border-radius: 16px; border: 1px dashed var(--gray-300);">
          <div style="font-size: 40px; margin-bottom: 12px;">🔍</div>
          <h3 style="font-size: 18px; margin-bottom: 6px; font-weight: 700;">No Gig Services Found</h3>
          <p style="color: var(--gray-600); font-size: 14px; max-width: 400px; margin: 0 auto 20px;">Adjust your parameters, try a different specialty, or clear the keywords search.</p>
          <button class="btn btn-secondary" id="btn-empty-clear-services">Reset Service Filters</button>
        </div>
      `;
      document.getElementById('btn-empty-clear-services')?.addEventListener('click', resetAllFilters);
      return;
    }

    cardsContainer.innerHTML = list.map(g => {
      const ownerName = g.owner?.name || 'Freelancer';
      const ownerUsername = g.owner?.username || 'expert';
      const ownerRating = g.owner?.rating ? g.owner.rating.toFixed(1) : '5.0';
      const ownerAvatar = g.owner?.profile?.avatar || '';
      const tagsArray = Array.isArray(g.tags) ? g.tags : [];

      return `
        <div class="job-premium-card card service-item" style="padding: 0; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; border-radius: 16px; background: white;" data-id="${g._id}">
          <!-- Cover Image Banner -->
          <div style="position: relative; height: 165px; overflow: hidden; background-color: var(--gray-100);">
            <img src="${g.imageUrl}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s ease;" class="service-cover-img" onerror="this.src='https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=600&q=80'">
            <span class="card-category-badge" style="position: absolute; top: 12px; left: 12px; font-size: 10px; background: rgba(15, 23, 42, 0.75); color: white; padding: 4px 10px; border: none; box-shadow: none; border-radius: 6px; backdrop-filter: blur(4px); font-weight: 700;">${g.category}</span>
            <span style="position: absolute; top: 12px; right: 12px; font-size: 10px; font-weight: 800; background: rgba(147, 51, 234, 0.9); color: white; padding: 4px 10px; border-radius: 20px; text-transform: uppercase;">
              <i class="fa-solid fa-bolt" style="color: #fdba74; margin-right: 4px;"></i>Instant Order
            </span>
          </div>

          <div style="padding: 20px; flex-grow: 1; display: flex; flex-direction: column; justify-content: space-between; gap: 14px;">
            <div>
              <!-- Owner Info -->
              <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 10px;">
                <div style="width: 26px; height: 26px; border-radius: 50%; background: var(--gray-200); display: flex; align-items: center; justify-content: center; overflow: hidden; border: 1px solid var(--gray-300);">
                  ${ownerAvatar ? `<img src="${ownerAvatar}" style="width:100%; height:100%; object-fit:cover;">` : `<i class="fa-solid fa-user-tie" style="font-size: 11px; color: var(--gray-500);"></i>`}
                </div>
                <div style="font-size: 12.5px;">
                  <b style="color: var(--dark); font-weight: 700;">@${escapeHTML(ownerUsername)}</b>
                  <span style="color: var(--gray-500); margin-left: 2px;">• <i class="fa-solid fa-star" style="color: #f59e0b; font-size: 10px;"></i> ${ownerRating}</span>
                </div>
              </div>

              <!-- Gig Title -->
              <h3 style="font-size: 15.5px; font-weight: 700; color: var(--dark); line-height: 1.35; margin: 0 0 6px auto; cursor: pointer; transition: color 0.2s;" class="gig-card-title hover:text-indigo-600" onclick="openServiceDetailsDrawer('${g._id}')">
                ${escapeHTML(g.title)}
              </h3>

              <p style="font-size: 12.5px; color: var(--gray-600); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 10px;">
                ${escapeHTML(g.description)}
              </p>

              <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 4px;">
                ${tagsArray.slice(0, 3).map(tag => `<span style="font-size:10px; font-weight:700; background: var(--gray-100); color: var(--gray-700); padding: 2px 8px; border-radius: 4px;">#${escapeHTML(tag)}</span>`).join('')}
              </div>
            </div>

            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--gray-100); padding-top: 12px; margin-bottom: 12px;">
                <span style="font-size: 12px; color: var(--gray-500); font-weight: 600;"><i class="fa-solid fa-clock"></i> Delivery: <b>${g.deliveryTime}d</b></span>
                <div style="text-align: right;">
                  <span style="font-size: 10px; color: var(--gray-500); display: block; line-height: 1;">Starting at</span>
                  <span style="font-size: 19px; font-weight: 800; color: var(--primary); font-family: var(--font-heading);">$${g.price}</span>
                </div>
              </div>

              <div class="card-actions" style="display: flex; gap: 6px; margin: 0;">
                <button class="btn btn-secondary" onclick="openServiceDetailsDrawer('${g._id}')" style="padding: 10px; flex: 1; font-size: 12.5px; font-weight: 600;">
                  <i class="fa-solid fa-circle-info"></i> Details
                </button>
                <button class="btn btn-primary" onclick="initiateServiceOrder('${g._id}', '${escapeHTML(g.title).replace(/'/g, "\\'")}', ${g.price})" style="padding: 10px; flex: 1.3; font-size: 12.5px; font-weight: 700; background: var(--gradient) !important;">
                  <i class="fa-solid fa-cart-shopping"></i> Order Now
                </button>
                <button class="btn btn-secondary btn-toggle-save-service" onclick="saveServiceToggle(this, '${g._id}')" style="padding: 10px; width: 36px; max-width: 36px; min-width: 36px; display: inline-flex; align-items: center; justify-content: center; border-color: var(--gray-200); color: var(--gray-500);">
                  <i class="fa-regular fa-bookmark"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // End of function renderGigs
  }

  // Opens a beautiful Sidebar / Slider drawer for detailing a Gig (Service)
  window.openServiceDetailsDrawer = async function(gigId) {
    toggleDetailsDrawer(false); // make sure details drawer of jobs is closed first

    // Let's create a beautiful custom details layout in the existing drawer element!
    const overlay = document.getElementById('details-drawer-overlay');
    const drawer = document.getElementById('job-details-drawer');
    if (!overlay || !drawer) return;

    // Show spinner inside drawer
    drawer.innerHTML = `
      <button class="details-drawer-close" onclick="toggleDetailsDrawer(false)"><i class="fa-solid fa-xmark"></i></button>
      <div style="text-align: center; padding: 100px 20px; color: var(--gray-600);">
        <div style="width: 42px; height: 42px; border: 3px solid var(--gray-200); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 15px;"></div>
        <p style="font-weight:600; font-size:14px;">Downloading service catalog specs...</p>
      </div>
    `;
    toggleDetailsDrawer(true);

    try {
      const res = await fetch(`/api/services/${gigId}`);
      const body = await res.json();

      if (body.success && body.data) {
        const g = body.data;
        const ownerName = g.owner?.name || 'Freelancer Expert';
        const ownerUsername = g.owner?.username || 'expert';
        const ownerRating = g.owner?.rating ? g.owner.rating.toFixed(1) : '5.0';
        const ownerAvatar = g.owner?.profile?.avatar || '';
        const ownerBio = g.owner?.profile?.bio || 'Professional vetted marketplace talent listed status.';
        const completedCount = g.owner?.completedCount || 0;
        const tagsArray = Array.isArray(g.tags) ? g.tags : [];

        // Compute related services from the cache
        const relatedServices = all_services_list
          .filter(x => x._id !== g._id && x.category === g.category)
          .slice(0, 2);

        // Define dynamic package switcher in window context
        window.selectServicePriceTier = function(tier, basePrice, baseDelivery, gigId, gigTitle) {
          const basicBtn = document.getElementById('tier-btn-basic');
          const stdBtn = document.getElementById('tier-btn-standard');
          const premBtn = document.getElementById('tier-btn-premium');
          
          if (basicBtn) { basicBtn.style.background = 'var(--gray-100)'; basicBtn.style.color = 'var(--gray-700)'; basicBtn.style.border = '1px solid var(--gray-200)'; }
          if (stdBtn) { stdBtn.style.background = 'var(--gray-100)'; stdBtn.style.color = 'var(--gray-700)'; stdBtn.style.border = '1px solid var(--gray-200)'; }
          if (premBtn) { premBtn.style.background = 'var(--gray-100)'; premBtn.style.color = 'var(--gray-700)'; premBtn.style.border = '1px solid var(--gray-200)'; }
          
          const clickedBtn = document.getElementById('tier-btn-' + tier);
          if (clickedBtn) {
            clickedBtn.style.background = 'var(--primary)';
            clickedBtn.style.color = 'white';
            clickedBtn.style.borderColor = 'var(--primary)';
          }

          const descEl = document.getElementById('tier-detail-desc');
          const daysEl = document.getElementById('tier-detail-days');
          const priceSpan = document.getElementById('tier-detail-price-text');
          const finalBtn = document.getElementById('tier-final-purchase-btn');

          let computedPrice = Math.round(basePrice);
          let computedDays = Number(baseDelivery);
          let computedDesc = '';

          if (tier === 'basic') {
            computedPrice = Math.round(basePrice);
            computedDays = Number(baseDelivery);
            computedDesc = 'Essential starter edition coding block. Fully documented layout components, layered responsive templates, standard escrow security, and standard delivery.';
          } else if (tier === 'standard') {
            computedPrice = Math.round(basePrice * 1.5);
            computedDays = Math.max(1, Number(baseDelivery) - 1);
            computedDesc = 'Our recommended tier. 2 complete custom variation branches, customized configuration specs, priority turnaround speed, and up to 5 review revisions.';
          } else if (tier === 'premium') {
            computedPrice = Math.round(basePrice * 2.2);
            computedDays = Math.max(1, Number(baseDelivery) - 2);
            computedDesc = 'VIP turnkey enterprise execution. High speed premium priority, customized integration blueprints, unlimited cycles of revisions, and 24/7 private channel access.';
          }

          if (descEl) descEl.textContent = computedDesc;
          if (daysEl) daysEl.innerHTML = `<i class="fa-regular fa-clock"></i> Delivery Time: <b>${computedDays} Days</b>`;
          if (priceSpan) priceSpan.textContent = `$${computedPrice}`;
          if (finalBtn) {
            finalBtn.textContent = `Purchase Package ($${computedPrice})`;
            finalBtn.setAttribute('onclick', `initiateServiceOrder('${gigId}', '${gigTitle.replace(/'/g, "\\'")}', ${computedPrice})`);
          }
        };

        drawer.innerHTML = `
          <button class="details-drawer-close" onclick="toggleDetailsDrawer(false)"><i class="fa-solid fa-xmark"></i></button>
          
          <div style="margin-top: 30px; display: flex; flex-direction: column; gap: 24px; overflow-y: auto; flex-grow: 1; padding-right: 5px;" class="premium-gig-scroll-container">
            
            <!-- Breadcrumbs Navigation -->
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--gray-600); display: flex; align-items: center; gap: 6px;">
              <span>Home</span> <i class="fa-solid fa-chevron-right" style="font-size: 9px; color: var(--gray-400);"></i>
              <span>Services Catalog</span> <i class="fa-solid fa-chevron-right" style="font-size: 9px; color: var(--gray-400);"></i>
              <span style="color: var(--primary);">${escapeHTML(g.category)}</span>
            </div>

            <!-- Cover Image Banner -->
            <div style="position: relative; border-radius: 12px; overflow: hidden; height: 210px; background: var(--gray-100); border: 1px solid var(--gray-200);">
              <img src="${g.imageUrl}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=600&q=80'">
              <span class="card-category-badge" style="position: absolute; bottom: 12px; left: 12px; font-size: 10px; background-color: rgba(15,23,42,0.85); color: white; padding: 4px 10px; border-radius: 4px; font-weight: 700;">${g.category}</span>
            </div>

            <!-- Primary Content Info -->
            <div>
              <h2 style="font-size: 24px; font-weight: 800; margin-top: 4px; line-height: 1.25; color: var(--dark);">${escapeHTML(g.title)}</h2>
              <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-top: 8px; color: var(--gray-600); font-size: 12px; align-items: center;">
                <span><i class="fa-solid fa-star" style="color: #f59e0b;"></i> <strong style="color: var(--dark);">${ownerRating}</strong> (18 reviews)</span>
                <span>● <i class="fa-solid fa-bag-shopping"></i> <strong style="color: var(--dark);">${g.salesCount || 0} orders</strong> in queue</span>
                <span>● <i class="fa-solid fa-circle-check" style="color: var(--success);"></i> Verified Specialist</span>
              </div>
            </div>

            <!-- Interactive Fiverr-Style Multi-Tier Price Tab Packages -->
            <div style="background: white; border: 1px solid var(--gray-200); border-radius: 12px; overflow: hidden; box-shadow: var(--shadow-sm);">
              <div style="display: flex; background: var(--gray-50); border-bottom: 1px solid var(--gray-200); padding: 5px;">
                <button id="tier-btn-basic" onclick="selectServicePriceTier('basic', ${g.price}, ${g.deliveryTime}, '${g._id}', '${escapeHTML(g.title).replace(/'/g, "\\'")}')" style="flex: 1; padding: 10px 5px; font-size: 11.5px; font-weight: 800; border-radius: 8px; text-transform: uppercase; cursor: pointer; transition: all 0.2s ease; background: var(--primary); color: white; border: 1px solid var(--primary);">Basic</button>
                <button id="tier-btn-standard" onclick="selectServicePriceTier('standard', ${g.price}, ${g.deliveryTime}, '${g._id}', '${escapeHTML(g.title).replace(/'/g, "\\'")}')" style="flex: 1; padding: 10px 5px; font-size: 11.5px; font-weight: 800; border-radius: 8px; text-transform: uppercase; cursor: pointer; transition: all 0.2s ease; background: var(--gray-100); color: var(--gray-700); border: 1px solid var(--gray-200);">Standard</button>
                <button id="tier-btn-premium" onclick="selectServicePriceTier('premium', ${g.price}, ${g.deliveryTime}, '${g._id}', '${escapeHTML(g.title).replace(/'/g, "\\'")}')" style="flex: 1; padding: 10px 5px; font-size: 11.5px; font-weight: 800; border-radius: 8px; text-transform: uppercase; cursor: pointer; transition: all 0.2s ease; background: var(--gray-100); color: var(--gray-700); border: 1px solid var(--gray-200);">Premium</button>
              </div>
              <div style="padding: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px;">
                  <span style="font-size: 12px; text-transform: uppercase; font-weight: 800; color: var(--gray-500);">Pricing Package Offer</span>
                  <span style="font-size: 26px; font-weight: 800; color: var(--primary);" id="tier-detail-price-text">$${g.price}</span>
                </div>
                <p style="font-size: 13px; color: var(--gray-600); line-height: 1.5; margin-bottom: 15px;" id="tier-detail-desc">Essential starter edition coding block. Fully documented layout components, layered responsive templates, standard escrow security, and standard delivery.</p>
                <div style="display: flex; justify-content: space-between; align-items: center; border-grid-top: 1px dashed var(--gray-200); padding-top: 12px; font-size: 12px; color: var(--gray-700);" id="tier-detail-days">
                  <span><i class="fa-regular fa-clock"></i> Delivery Time: <b>${g.deliveryTime} Days</b></span>
                  <span><i class="fa-solid fa-arrows-spin"></i> Revisions cycles list</span>
                </div>
              </div>
            </div>

            <!-- Detailed description -->
            <div>
              <h4 style="font-size: 15px; font-weight: 700; color: var(--dark); margin-bottom: 8px; border-bottom: 1px solid var(--gray-200); padding-bottom: 6px;">Service Description Summary</h4>
              <p style="font-size: 13.5px; color: var(--gray-600); line-height: 1.6; white-space: pre-line;">${escapeHTML(g.description)}</p>
            </div>

            <!-- Keywords Meta tagging -->
            <div>
              <h4 style="font-size: 14px; font-weight: 700; color: var(--dark); margin-bottom: 8px;">Keywords & Tags</h4>
              <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                ${tagsArray.map(tag => `<span class="skill-pill" style="font-weight:700;">#${escapeHTML(tag)}</span>`).join('')}
                ${tagsArray.length === 0 ? '<span style="color:var(--gray-500); font-style:italic; font-size:12.5px;">No keywords registered.</span>' : ''}
              </div>
            </div>

            <!-- Collapsible FAQ Accordion Sections -->
            <div>
              <h4 style="font-size: 15px; font-weight: 700; color: var(--dark); margin-bottom: 10px; border-bottom: 1px solid var(--gray-200); padding-bottom: 6px;">Frequently Asked Questions</h4>
              <div style="display: flex; flex-direction: column; gap: 8px;">
                <details style="border: 1px solid var(--gray-200); border-radius: 8px; padding: 12px; background: white;" class="gig-accordion-details">
                  <summary style="font-weight: 700; font-size: 13px; color: var(--dark); cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                    How is my budget protected during payments?
                  </summary>
                  <p style="font-size: 12.5px; color: var(--gray-600); margin-top: 8px; line-height: 1.5;">All contract payments reside inside our platform's secure automated escrow ledger vault. Funds are only handed over to the Freelancer once you confirm and authorize the final project asset deliverables submission.</p>
                </details>
                <details style="border: 1px solid var(--gray-200); border-radius: 8px; padding: 12px; background: white;" class="gig-accordion-details">
                  <summary style="font-weight: 700; font-size: 13px; color: var(--dark); cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                    Can I ask for custom specifications or revisions?
                  </summary>
                  <p style="font-size: 12.5px; color: var(--gray-600); margin-top: 8px; line-height: 1.5;">Yes, you can request unlimited modifications or improvements on intermediate deliverables based on the chosen tier requirements, directly coordinated inside your Dashboard panel or central Private chat logs.</p>
                </details>
                <details style="border: 1px solid var(--gray-200); border-radius: 8px; padding: 12px; background: white;" class="gig-accordion-details">
                  <summary style="font-weight: 700; font-size: 13px; color: var(--dark); cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                    What files will be delivered?
                  </summary>
                  <p style="font-size: 12.5px; color: var(--gray-600); margin-top: 8px; line-height: 1.5;">Standard delivery vectors include fully documented master project layouts, production-ready source code scripts, CSS sheets, database model schemas, and image previews.</p>
                </details>
              </div>
            </div>

            <!-- Freelancer Info Segment -->
            <div style="border-top: 1px solid var(--gray-200); padding-top: 20px;">
              <h4 style="font-size: 15px; font-weight: 700; color: var(--dark); margin-bottom: 12px;">Contact Freelancer Specialty</h4>
              <div style="display: flex; gap: 14px; align-items: center; background-color: var(--gray-50); border: 1px solid var(--gray-200); border-radius: 12px; padding: 15px;">
                <div style="width: 54px; height: 54px; border-radius: 50%; overflow: hidden; background: var(--gray-200); border: 2px solid var(--gray-200); flex-shrink: 0;">
                  ${ownerAvatar ? `<img src="${ownerAvatar}" style="width:100%; height:100%; object-fit:cover;">` : `<i class="fa-solid fa-user-tie" style="font-size: 24px; color: var(--gray-500); padding: 12px;"></i>`}
                </div>
                <div style="flex-grow: 1;">
                  <h5 style="margin: 0; font-size: 14.5px; font-weight: 800; color: var(--dark);">${escapeHTML(ownerName)}</h5>
                  <p style="margin: 2px 0 0 0; font-size: 12px; color: var(--gray-600);">@${escapeHTML(ownerUsername)} • Completed <b>${completedCount} milestone contracts</b></p>
                  <p style="margin: 6px 0 0 0; font-size: 11.5px; color: var(--gray-500); line-height: 1.45;">${escapeHTML(ownerBio)}</p>
                </div>
              </div>
            </div>

            <!-- Verified Review Testimonial block -->
            <div>
              <h4 style="font-size: 15px; font-weight: 700; color: var(--dark); margin-bottom: 12px; border-bottom: 1px solid var(--gray-200); padding-bottom: 6px;">Customer Success Reviews</h4>
              <div style="display: flex; flex-direction: column; gap: 12px;">
                <div style="background: var(--gray-50); border: 1px solid var(--gray-100); border-radius: 10px; padding: 12px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span style="font-size: 12.5px; font-weight: 700; color: var(--dark);">@alpha_buyer</span>
                    <span style="font-size: 11px; color: #f59e0b;"><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i></span>
                  </div>
                  <p style="font-size: 12px; color: var(--gray-600); line-height: 1.4; margin: 0;">Outstanding precision. Fully responsive layout delivered ahead of deadlines. Verified escrow release completed inside minutes.</p>
                </div>
                <div style="background: var(--gray-50); border: 1px solid var(--gray-100); border-radius: 10px; padding: 12px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span style="font-size: 12.5px; font-weight: 700; color: var(--dark);">@dev_leads</span>
                    <span style="font-size: 11px; color: #f59e0b;"><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i></span>
                  </div>
                  <p style="font-size: 12px; color: var(--gray-600); line-height: 1.4; margin: 0;">Clean Node architectures. Understood the requirements instantly and delivered robust code schemas. Very happy buyer!</p>
                </div>
              </div>
            </div>

            <!-- Related Gigs Widget -->
            ${relatedServices.length > 0 ? `
            <div>
              <h4 style="font-size: 15px; font-weight: 700; color: var(--dark); margin-bottom: 12px; border-bottom: 1px solid var(--gray-200); padding-bottom: 6px;">Related Gigs You Might Like</h4>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                ${relatedServices.map(rel => `
                  <div style="border: 1px solid var(--gray-250); border-radius: 10px; overflow: hidden; background: white; cursor: pointer; transition: transform 0.2s;" onclick="openServiceDetailsDrawer('${rel._id}')">
                    <img src="${rel.imageUrl}" style="width: 100%; height: 90px; object-fit: cover;" onerror="this.src='https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=300&q=80'">
                    <div style="padding: 8px;">
                      <h4 style="font-size: 12px; font-weight: 700; color: var(--dark); display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;margin:0 0 4px 0;">${escapeHTML(rel.title)}</h4>
                      <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:11px; color:var(--gray-500);"><i class="fa-solid fa-star" style="color:#f59e0b; font-size:9px;"></i> 5.0</span>
                        <strong style="font-size:12px; color:var(--primary);">$${rel.price}</strong>
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
            ` : ''}

            <!-- CTA Ordering buttons inside details drawer -->
            <div style="margin-top: auto; padding-top: 20px; border-top: 1px solid var(--gray-200); display: flex; gap: 10px;">
              <button class="btn btn-secondary" onclick="window.location.href='/chat?userId=${g.owner?._id || g.owner}'" style="flex: 1; height: 48px; font-weight: 700;">
                <i class="fa-regular fa-comments"></i> Consult Talent
              </button>
              <button id="tier-final-purchase-btn" class="btn btn-primary" onclick="initiateServiceOrder('${g._id}', '${escapeHTML(g.title).replace(/'/g, "\\'")}', ${g.price})" style="flex: 1.5; height: 48px; font-weight: 800; background: var(--gradient) !important;">
                Purchase Package ($${g.price})
              </button>
            </div>
          </div>
        `;

        // End of render details
      } else {
        drawer.innerHTML = `<p style="padding: 30px; color: var(--error); text-align: center;">Error parsing details: ${body.message}</p>`;
      }
    } catch (err) {
      console.error(err);
      drawer.innerHTML = `<p style="padding: 30px; color: var(--error); text-align: center;">Connectivity issues. Please try again.</p>`;
    }
  };

  // Triggers the instant Checkout bookings Modal (Fiverr order button)
  window.initiateServiceOrder = function(gigId, gigTitle, price) {
    // Escrow user check
    const user = window.FarelanceruState.user;
    if (!user) {
      showToast('Authentication Required: Please sign in to purchase instantly.', 'error');
      setTimeout(() => { window.location.href = '/login'; }, 1200);
      return;
    }

    if (user.role !== 'buyer') {
      showToast('Error: Only Buyers are authorized to order instant services and fund contracts.', 'error');
      return;
    }

    if (user.balance < Number(price)) {
      showToast(`Wallet Deficit: Service package costs $${price}, but you only have $${user.balance}. Please add simulation funds to your wallet!`, 'error');
      return;
    }

    const modalTitle = document.getElementById('order-gig-title');
    const modalInfo = document.getElementById('order-gig-info');
    const hiddenId = document.getElementById('order-gig-id');
    const reqTextarea = document.getElementById('order-gig-requirements');

    if (modalTitle && modalInfo && hiddenId) {
      modalTitle.textContent = `Order: ${gigTitle}`;
      modalInfo.innerHTML = `You are ordering this fixed-scope service. Package budget: <strong style="color:var(--primary); font-size:15px;">$${price} USD</strong>.`;
      hiddenId.value = gigId;
      if (reqTextarea) reqTextarea.value = '';

      toggleDetailsDrawer(false); // Close details drawer
      toggleModal('buy-gig-modal', true); // Open ordering modal
    }
  };

  // Save Service bookmark toggle (Mock or endpoint sync)
  window.saveServiceToggle = function(btnElement, gigId) {
    const icon = btnElement.querySelector('i');
    if (icon) {
      if (icon.classList.contains('fa-regular')) {
        icon.className = 'fa-solid fa-bookmark';
        icon.style.color = 'var(--primary)';
        showToast('Service Gig bookmarked successfully!', 'success');
      } else {
        icon.className = 'fa-regular fa-bookmark';
        icon.style.color = 'var(--gray-500)';
        showToast('Removed service bookmark.', 'info');
      }
    }
  };

  // Requirements checkout form submission
  const orderForm = document.getElementById('order-gig-form');
  if (orderForm) {
    orderForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-submit-gig-order');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Arranging contract & locking escrow...';
      }

      const gigId = document.getElementById('order-gig-id').value;
      const requirements = document.getElementById('order-gig-requirements').value.trim();

      try {
        const res = await fetch(`/api/services/buy/${gigId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${window.FarelanceruState.token}`
          },
          body: JSON.stringify({ requirements })
        });

        const body = await res.json();
        if (body.success) {
          // Update local storage user state balance
          const updatedUser = window.FarelanceruState.user;
          updatedUser.balance -= body.data.price;
          localStorage.setItem('user', JSON.stringify(updatedUser));

          showToast('Success! Order initialized & secure escrow contract activated.', 'success');
          toggleModal('buy-gig-modal', false);
          
          setTimeout(() => {
            window.location.href = '/dashboard?tab=jobs';
          }, 1500);
        } else {
          showToast(body.message || 'Error executing payment checkout.', 'error');
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'Confirm Booking & Lock Escrow';
          }
        }
      } catch (err) {
        console.error(err);
        showToast('Problem processing booking payment.', 'error');
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = 'Confirm Booking & Lock Escrow';
        }
      }
    });
  }

  // Double exposure helper to escape HTML inside string renders
  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  // Initial load execution depending on route placeholders
  if (cardsContainer) {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode') || 'jobs';
    
    // Auto shift listing tab if specified in URL query params ?mode=services
    if (mode === 'services') {
      switchListingTab('services');
    } else {
      fetchJobs();
    }
  } else if (fnContainer) {
    fetchFreelancers();
  }
});
