/**
 * Farelanceru Platform - Wallet ledger and mock transaction sandbox
 */

document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');

  if (!token || !userStr) {
    showToast('Secure Alert: Please sign in to view your Wallet workspace.', 'error');
    setTimeout(() => {
      window.location.href = '/login';
    }, 1200);
    return;
  }

  const currentUser = JSON.parse(userStr);

  // Highlighting sidebar
  setTimeout(() => {
    const activeSidebarItem = document.getElementById('menu-dashboard-wallet');
    const overviewSidebarItem = document.getElementById('menu-dashboard-overview');
    if (activeSidebarItem) {
      activeSidebarItem.classList.add('active');
    }
    if (overviewSidebarItem) {
      overviewSidebarItem.classList.remove('active');
    }
  }, 300);

  // Visual text endpoints
  const availableBalText = document.getElementById('available-balance');
  const pendingEscrowText = document.getElementById('pending-escrow');
  const lifetimeRevenueText = document.getElementById('lifetime-revenue');
  const maxWithdrawableText = document.getElementById('modal-max-withdrawable');
  const txnTableBody = document.getElementById('txn-table-body');
  const escrowActionsBox = document.getElementById('escrow-actions-box');

  // Modal triggers
  const withdrawModal = document.getElementById('withdraw-modal');
  const depositModal = document.getElementById('deposit-modal');
  const checkoutModal = document.getElementById('checkout-modal');

  const btnWithdrawTrigger = document.getElementById('btn-withdraw-trigger');
  const btnDepositTrigger = document.getElementById('btn-deposit-trigger');

  const btnCloseWithdraw = document.getElementById('btn-close-withdraw');
  const btnCloseDeposit = document.getElementById('btn-close-deposit');
  const btnCloseCheckout = document.getElementById('btn-close-checkout');

  // Modal State Forms
  const payoutForm = document.getElementById('payout-simulation-form');
  const btnSubmitPayout = document.getElementById('btn-submit-payout');
  const payoutProcessing = document.getElementById('payout-processing');
  const payoutSuccess = document.getElementById('payout-success');

  const depositForm = document.getElementById('deposit-simulation-form');
  const btnSubmitDeposit = document.getElementById('btn-submit-deposit');
  const depositProcessing = document.getElementById('deposit-processing');
  const depositSuccess = document.getElementById('deposit-success');

  const btnCheckoutPay = document.getElementById('btn-checkout-pay');
  const checkoutProcessing = document.getElementById('checkout-processing');
  const checkoutSuccess = document.getElementById('checkout-success');

  // Loaded user balances
  let currentBalance = currentUser.balance || 0;

  // Init actions
  fetchWalletData();
  fetchTransactionsLedger();
  fetchEscrowSandbox();

  // Modal Actions
  btnWithdrawTrigger?.addEventListener('click', () => {
    if (withdrawModal) {
      // Setup text and limits
      if (maxWithdrawableText) {
        maxWithdrawableText.textContent = `Limit: Up to $${currentBalance.toFixed(2)} available.`;
      }
      payoutForm.style.display = 'block';
      payoutProcessing.style.display = 'none';
      payoutSuccess.style.display = 'none';
      withdrawModal.classList.add('active');
    }
  });

  btnDepositTrigger?.addEventListener('click', () => {
    if (depositModal) {
      depositForm.style.display = 'block';
      depositProcessing.style.display = 'none';
      depositSuccess.style.display = 'none';
      depositModal.classList.add('active');
    }
  });

  btnCloseWithdraw?.addEventListener('click', () => withdrawModal?.classList.remove('active'));
  btnCloseDeposit?.addEventListener('click', () => depositModal?.classList.remove('active'));
  btnCloseCheckout?.addEventListener('click', () => checkoutModal?.classList.remove('active'));

  document.getElementById('btn-payout-done')?.addEventListener('click', () => {
    withdrawModal?.classList.remove('active');
    refreshAllData();
  });

  document.getElementById('btn-deposit-done')?.addEventListener('click', () => {
    depositModal?.classList.remove('active');
    refreshAllData();
  });

  document.getElementById('btn-checkout-done')?.addEventListener('click', () => {
    checkoutModal?.classList.remove('active');
    refreshAllData();
  });

  // Handle Withdraw submit
  payoutForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payoutMethod = document.getElementById('payout-method').value;
    const payoutAmount = Number(document.getElementById('payout-amount').value);

    if (payoutAmount <= 0) {
      showToast('Amount must be positive.', 'error');
      return;
    }

    if (payoutAmount > currentBalance) {
      showToast('Insufficient wallet balance value.', 'error');
      return;
    }

    try {
      payoutForm.style.display = 'none';
      payoutProcessing.style.display = 'block';

      const response = await fetch('/api/mock-payment/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ amount: payoutAmount, method: payoutMethod })
      });
      const data = await response.json();

      setTimeout(() => {
        payoutProcessing.style.display = 'none';
        if (data.success) {
          payoutSuccess.style.display = 'block';
          const successText = document.getElementById('payout-success-text');
          if (successText) {
            successText.textContent = `$${payoutAmount.toFixed(2)} transfer dispatched successfully to your registered layout.`;
          }
          showToast(`Payout of $${payoutAmount.toFixed(2)} processed!`, 'success');
          
          // Update local User cache
          const cachedUser = JSON.parse(localStorage.getItem('user'));
          cachedUser.balance = data.data.balance;
          localStorage.setItem('user', JSON.stringify(cachedUser));
        } else {
          payoutForm.style.display = 'block';
          showToast(data.message || 'Withdrawal simulation failed.', 'error');
        }
      }, 1500); // realistic bank wire check delay

    } catch (err) {
      payoutProcessing.style.display = 'none';
      payoutForm.style.display = 'block';
      showToast('Connection error processing simulated payouts.', 'error');
    }
  });

  // Handle Deposit submit
  depositForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const depositAmount = Number(document.getElementById('deposit-amount').value);

    if (depositAmount <= 0) {
      showToast('Specify a valid amount.', 'error');
      return;
    }

    try {
      depositForm.style.display = 'none';
      depositProcessing.style.display = 'block';

      const response = await fetch('/api/mock-payment/deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ amount: depositAmount })
      });
      const data = await response.json();

      setTimeout(() => {
        depositProcessing.style.display = 'none';
        if (data.success) {
          depositSuccess.style.display = 'block';
          const successText = document.getElementById('deposit-success-text');
          if (successText) {
            successText.textContent = `A secured visa credit card top up of $${depositAmount.toFixed(2)} has been loaded to your mock wallet.`;
          }
          showToast(`Top up of $${depositAmount.toFixed(2)} loaded!`, 'success');

          // Update local User cache
          const cachedUser = JSON.parse(localStorage.getItem('user'));
          cachedUser.balance = data.data.balance;
          localStorage.setItem('user', JSON.stringify(cachedUser));
        } else {
          depositForm.style.display = 'block';
          showToast(data.message || 'Deposit top up failed.', 'error');
        }
      }, 1500); // Visa response delay

    } catch (err) {
      depositProcessing.style.display = 'none';
      depositForm.style.display = 'block';
      showToast('Connection error processing simulated card transactions.', 'error');
    }
  });

  // GET AND RENDER WALLET TELEMETRIES
  async function fetchWalletData() {
    try {
      const response = await fetch('/api/mock-payment/wallet', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();

      if (result.success) {
        const wallet = result.data.wallet;
        currentBalance = wallet.balance;

        if (availableBalText) availableBalText.textContent = `$${wallet.balance.toFixed(2)}`;
        if (pendingEscrowText) pendingEscrowText.textContent = `$${wallet.pendingBalance.toFixed(2)}`;
        if (lifetimeRevenueText) lifetimeRevenueText.textContent = `$${wallet.totalEarned.toFixed(2)}`;

        // Sync local sidebar wallet badge in real-time
        const sidebarWallet = document.getElementById('sidebar-wallet-balance');
        if (sidebarWallet) {
          sidebarWallet.textContent = `$${wallet.balance.toFixed(2)}`;
        }
      }
    } catch (err) {
      console.error('Wallet telemetry failed:', err);
    }
  }

  // GET AND BUILD TRANSACTIONS HISTORY TABLE
  async function fetchTransactionsLedger() {
    if (!txnTableBody) return;

    try {
      const response = await fetch('/api/mock-payment/transactions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();

      if (result.success) {
        const txns = result.data.transactions;
        if (txns.length === 0) {
          txnTableBody.innerHTML = `
            <tr>
              <td colspan="6" style="text-align: center; color: var(--gray-600); padding: 30px;">
                No transactions recorded in ledger history yet.
              </td>
            </tr>
          `;
          return;
        }

        txnTableBody.innerHTML = txns.map(txn => {
          const dateStr = new Date(txn.createdAt).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });

          // Determine direction and color formatting
          let directionClass = 'color: var(--dark); font-weight: 600;';
          let directionSymbol = '';
          
          if (txn.jobId === 'SYSTEM-DEPOSIT') {
            directionClass = 'color: var(--success); font-weight: 700;';
            directionSymbol = '+';
          } else if (txn.jobId === 'SYSTEM-CASH-OUT') {
            directionClass = 'color: var(--error); font-weight: 700;';
            directionSymbol = '-';
          } else {
            // Check roles
            if (txn.buyerId === currentUser._id) {
              directionClass = 'color: var(--error); font-weight: 700;';
              directionSymbol = '-';
            } else if (txn.freelancerId === currentUser._id) {
              directionClass = 'color: var(--success); font-weight: 700;';
              directionSymbol = '+';
            }
          }

          let pillClass = 'pill-pending';
          let statusText = txn.status;
          if (txn.status === 'in_escrow') {
            pillClass = 'pill-escrow';
            statusText = 'Escrow Held';
          }
          if (txn.status === 'released') {
            pillClass = 'pill-released';
            statusText = 'Cleared';
          }
          if (txn.status === 'cancelled') {
            pillClass = 'pill-cancelled';
            statusText = 'Cancelled';
          }

          // Inbound or Outbound Description
          let partnersCell = `
            <div style="font-size: 11px; color: var(--gray-600);">
              Payer: <b>@${txn.buyerUsername}</b><br>
              Beneficiary: <b>@${txn.freelancerUsername}</b>
            </div>
          `;

          return `
            <tr>
              <td>
                <span class="txn-id-badge" onclick="copyValue('${txn.transactionId}')" title="Click to copy Transaction ID">
                  ${txn.transactionId} <i class="fa-regular fa-copy" style="font-size: 10px;"></i>
                </span>
              </td>
              <td style="font-weight: 600;">
                ${txn.jobTitle}
              </td>
              <td>${partnersCell}</td>
              <td>
                <span style="${directionClass}">${directionSymbol}$${txn.amount.toFixed(2)}</span>
              </td>
              <td>
                <span class="pill ${pillClass}">${statusText}</span>
              </td>
              <td style="font-size: 12px; color: var(--gray-600);">${dateStr}</td>
            </tr>
          `;
        }).join('');

      } else {
        txnTableBody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align: center; color: var(--error); padding: 30px;">
              ${result.message || 'ledger load failure.'}
            </td>
          </tr>
        `;
      }
    } catch (err) {
      txnTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--error); padding: 30px;">
            Fatal connectivity lost.
          </td>
        </tr>
      `;
    }
  }

  // SEARCH AND RENDER ESCROW CONTROLLER ACTIVE ASSIGNMENTS
  async function fetchEscrowSandbox() {
    if (!escrowActionsBox) return;

    try {
      const response = await fetch('/api/jobs/my-jobs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();

      if (result.success) {
        const jobs = result.data.jobs;
        const activeEscrowContracts = jobs.filter(j => j.status === 'active' || (j.status === 'completed' && j.submission));

        if (activeEscrowContracts.length === 0) {
          escrowActionsBox.innerHTML = `
            <div style="text-align: center; color: var(--gray-600); padding: 30px 0; border: 1px dashed var(--gray-300); border-radius: 8px;">
              <i class="fa-solid fa-folder-open" style="font-size: 24px; color: var(--gray-300); margin-bottom: 8px; display: block;"></i>
              No active escrow contracts are linked to your profile right now.<br>
              <span style="font-size: 11px;">(You can hire experts or get hired to establish active escrow holdings here)</span>
            </div>
          `;
          return;
        }

        escrowActionsBox.innerHTML = activeEscrowContracts.map(job => {
          let actionMarkup = '';
          const hasSubmission = job.submission && job.submission.submittedAt;
          
          if (currentUser.role === 'buyer') {
            if (job.status === 'active') {
              if (hasSubmission) {
                actionMarkup = `
                  <div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
                    <div style="background-color: rgba(245, 158, 11, 0.08); border: 1px dashed var(--warning); padding: 10px; border-radius: 6px; font-size: 12px; margin-bottom: 6px;">
                      <b>Delivered Work:</b> "${job.submission.text}"
                    </div>
                    <button class="btn btn-success btn-release-action-on-wallet" data-jobid="${job._id}" style="width: 100%; font-size: 12px; padding: 6px 12px; font-weight: 700;">
                      <i class="fa-solid fa-circle-check"></i> Approve Deliverable &amp; Release Escrow
                    </button>
                  </div>
                `;
              } else {
                actionMarkup = `
                  <span style="font-size: 12px; color: var(--gray-600); font-style: italic;">
                    Waiting for Freelancer (@${job.hiredFreelancer?.username || 'expert'}) to submit deliverables. Funds locked: $${job.budget.toFixed(2)}
                  </span>
                `;
              }
            } else if (job.status === 'completed') {
              actionMarkup = `
                <span style="font-size: 12px; color: var(--success); font-weight: 700;">
                  <i class="fa-solid fa-check-double"></i> Escrow Funds Disbursed ($${job.budget.toFixed(2)})
                </span>
              `;
            }
          } else if (currentUser.role === 'freelancer') {
            if (job.status === 'active') {
              if (hasSubmission) {
                actionMarkup = `
                  <span style="font-size: 12px; color: var(--warning); font-weight: 600;">
                    ⌛ Deliverables submitted. Escrow Awaiting Buyer signing...
                  </span>
                `;
              } else {
                actionMarkup = `
                  <div style="font-size: 12px; color: var(--gray-600);">
                    Submit your gig deliverables on your <a href="/dashboard?tab=jobs" style="color: var(--primary); font-weight: 700; text-decoration: underline;">Contracts Board</a> to request payment release.
                  </div>
                `;
              }
            } else if (job.status === 'completed') {
              actionMarkup = `
                <span style="font-size: 12px; color: var(--success); font-weight: 700;">
                  💸 Payout Released! $${job.budget.toFixed(2)} credited on your available balance.
                </span>
              `;
            }
          }

          let badgeColor = 'background: rgba(245, 158, 11, 0.15); color: var(--warning);';
          if (job.status === 'completed') {
            badgeColor = 'background: rgba(16, 185, 129, 0.15); color: var(--success);';
          }

          return `
            <div style="background-color: var(--gray-100); border: 1px solid var(--gray-200); padding: 16px; border-radius: 8px; display: grid; grid-template-columns: 1fr 220px; gap: 20px; align-items: center;">
              <div>
                <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; ${badgeColor}">
                  ${job.status === 'active' ? 'Hold In Escrow' : 'Released'}
                </span>
                <h4 style="font-size: 15px; margin-top: 4px; margin-bottom: 2px;">${job.title}</h4>
                <p style="font-size: 12px; color: var(--gray-600); margin: 0;">
                  Partner: <b>@${currentUser.role === 'buyer' ? (job.hiredFreelancer?.username || 'expert') : (job.client?.username || 'employer')}</b> | Escrow: <b>$${job.budget.toFixed(2)}</b>
                </p>
              </div>
              <div style="display: flex; align-items: center; justify-content: flex-end;">
                ${actionMarkup}
              </div>
            </div>
          `;
        }).join('');

        // Attach action events
        document.querySelectorAll('.btn-release-action-on-wallet').forEach(btn => {
          btn.addEventListener('click', () => {
            approveEscrowMilestone(btn.dataset.jobid);
          });
        });

      }
    } catch (err) {
      console.error('Fetch escrow sandbox failed:', err);
    }
  }

  // Action: release payout
  async function approveEscrowMilestone(jobId) {
    try {
      showToast('Processing escrow payout dispatches...', 'info');
      const response = await fetch('/api/mock-payment/release', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ jobId })
      });
      const result = await response.json();

      if (result.success) {
        showToast('Payment released successfully to Freelancer!', 'success');
        refreshAllData();
      } else {
        showToast(result.message || 'Escrow release failed.', 'error');
      }
    } catch (err) {
      showToast('Connection error releasing funds.', 'error');
    }
  }

  function refreshAllData() {
    fetchWalletData();
    fetchTransactionsLedger();
    fetchEscrowSandbox();
  }
});

// Utility Copy func
window.copyValue = function(text) {
  navigator.clipboard.writeText(text);
  showToast('Copied to clipboard!', 'success');
};
