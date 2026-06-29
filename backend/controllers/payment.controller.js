import User from '../models/User.js';
import Job from '../models/Job.js';
import Bid from '../models/Bid.js';
import Payment from '../models/Payment.js';
import Transaction from '../models/Transaction.js';
import Wallet from '../models/Wallet.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { sendPaymentNotificationEmail } from '../utils/mailer.js';
import { createNotification } from '../utils/notification.helper.js';

/**
 * GET /api/mock-payment/wallet
 * Returns current logged-in user's wallet metrics.
 */
export const getWallet = async (req, res) => {
  const userId = req.user.id;
  try {
    let wallet = await Wallet.findOne({ userId });
    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 'User record not found.', 404);
    }
    
    if (!wallet) {
      // Create wallet from current user balance
      wallet = await Wallet.create({
        userId,
        balance: user.balance,
        pendingBalance: 0,
        totalEarned: 0
      });
    } else {
      // Keep main balance synced with User model
      if (wallet.balance !== user.balance) {
        wallet.balance = user.balance;
        await wallet.save();
      }
    }

    return sendSuccess(res, 'Wallet details loaded successfully.', { wallet });
  } catch (err) {
    return sendError(res, `Failed retrieving wallet metrics: ${err.message}`, 500);
  }
};

/**
 * POST /api/mock-payment/create
 * Simulates a Buyer clicking "Pay Now". Charge buyer, increment freelancer "Pending Escrow".
 */
export const createMockPayment = async (req, res) => {
  const { jobId, freelancerId, amount } = req.body;
  const buyerId = req.user.id;

  if (!jobId || !freelancerId || !amount) {
    return sendError(res, 'Missing parameters. jobId, freelancerId, and amount are required.', 400);
  }

  try {
    const buyer = await User.findById(buyerId);
    if (!buyer) return sendError(res, 'Buyer account not found.', 404);

    const freelancer = await User.findById(freelancerId);
    if (!freelancer) return sendError(res, 'Freelancer account not found.', 404);

    const job = await Job.findById(jobId);
    if (!job) return sendError(res, 'Job record not found.', 404);

    const parsedAmount = Number(amount);
    if (buyer.balance < parsedAmount) {
      return sendError(res, `Insufficient balance. You need $${parsedAmount} but only have $${buyer.balance}.`, 400);
    }

    // Deduct cash from buyer main balance
    buyer.balance -= parsedAmount;
    await buyer.save();

    // Sync buyer wallet
    let buyerWallet = await Wallet.findOne({ userId: buyerId });
    if (!buyerWallet) {
      buyerWallet = await Wallet.create({ userId: buyerId, balance: buyer.balance });
    } else {
      buyerWallet.balance = buyer.balance;
      await buyerWallet.save();
    }

    // Increment freelancer pending Balance
    let freelancerWallet = await Wallet.findOne({ userId: freelancerId });
    if (!freelancerWallet) {
      freelancerWallet = await Wallet.create({
        userId: freelancerId,
        balance: freelancer.balance,
        pendingBalance: parsedAmount,
        totalEarned: 0
      });
    } else {
      freelancerWallet.pendingBalance += parsedAmount;
      await freelancerWallet.save();
    }

    // Generate readable transaction ID
    const randomHex = Math.floor(100000 + Math.random() * 900000).toString();
    const transactionId = `TXN-${Date.now().toString().slice(-4)}-${randomHex}`;

    // Create Transaction Log
    const transaction = await Transaction.create({
      transactionId,
      jobId,
      buyerId,
      freelancerId,
      amount: parsedAmount,
      status: 'in_escrow'
    });

    // Update job status to active
    job.status = 'active';
    job.hiredFreelancer = freelancerId;
    job.budget = parsedAmount;
    await job.save();

    // Record legacy Payment
    await Payment.create({
      job: jobId,
      payer: buyerId,
      receiver: freelancerId,
      amount: parsedAmount,
      status: 'escrow'
    });

    // Send Resend Payment Notifications
    try {
      // 1. To Buyer
      await sendPaymentNotificationEmail(
        buyer.email,
        buyer.name || buyer.username,
        `$${parsedAmount.toFixed(2)}`,
        'escrow_funded',
        'success',
        transactionId
      );

      // 2. To Freelancer
      await sendPaymentNotificationEmail(
        freelancer.email,
        freelancer.name || freelancer.username,
        `$${parsedAmount.toFixed(2)}`,
        'escrow_received',
        'success',
        transactionId
      );
    } catch (err) {
      console.error('Failed to send Resend escrow notifications:', err);
    }

    return sendSuccess(res, 'Payment successful. Funds locked in secure escrow.', {
      transaction,
      buyerBalance: buyer.balance
    }, 201);

  } catch (err) {
    return sendError(res, `Failed executing payment simulation: ${err.message}`, 500);
  }
};

/**
 * POST /api/mock-payment/release
 * Release active escrow. Increment freelancer wallet, subtract from pending, mark job complete.
 */
export const releaseMockPayment = async (req, res) => {
  const { transactionId, jobId } = req.body;
  const currentUserId = req.user.id;

  try {
    let query = {};
    if (transactionId) {
      query = { transactionId };
    } else if (jobId) {
      query = { jobId, status: 'in_escrow' };
    } else {
      return sendError(res, 'Please provide either transactionId or jobId to release funds.', 400);
    }

    const txn = await Transaction.findOne(query);
    if (!txn) {
      return sendError(res, 'Escrow transaction not found or already released.', 404);
    }

    // Permission check: only buyer or admin
    if (txn.buyerId !== currentUserId && req.user.role !== 'admin') {
      return sendError(res, 'Forbidden. Only the project buyer can release this payment.', 403);
    }

    if (txn.status !== 'in_escrow') {
      return sendError(res, `Transaction status is currently: ${txn.status}. Cannot release.`, 400);
    }

    // Update Transaction State
    txn.status = 'released';
    await txn.save();

    // Disburse to Freelancer
    const freelancer = await User.findById(txn.freelancerId);
    if (freelancer) {
      freelancer.balance += txn.amount;
      freelancer.completedCount = (freelancer.completedCount || 0) + 1;
      await freelancer.save();

      let freelancerWallet = await Wallet.findOne({ userId: txn.freelancerId });
      if (!freelancerWallet) {
        freelancerWallet = await Wallet.create({
          userId: txn.freelancerId,
          balance: freelancer.balance,
          pendingBalance: 0,
          totalEarned: txn.amount
        });
      } else {
        freelancerWallet.pendingBalance = Math.max(0, freelancerWallet.pendingBalance - txn.amount);
        freelancerWallet.balance = freelancer.balance;
        freelancerWallet.totalEarned += txn.amount;
        await freelancerWallet.save();
      }
    }

    // Update job status to completed
    const job = await Job.findById(txn.jobId);
    if (job) {
      job.status = 'completed';
      await job.save();
    }

    // Sync legacy Payment database entry
    const payment = await Payment.findOne({ job: txn.jobId, payer: txn.buyerId });
    if (payment) {
      payment.status = 'released';
      await payment.save();
    }

    // Send Resend Payment Notifications
    try {
      const buyerUser = await User.findById(txn.buyerId);
      const freelancerUser = await User.findById(txn.freelancerId);

      if (buyerUser) {
        await sendPaymentNotificationEmail(
          buyerUser.email,
          buyerUser.name || buyerUser.username,
          `$${txn.amount.toFixed(2)}`,
          'escrow_released',
          'success',
          txn.transactionId
        );
      }

      if (freelancerUser) {
        await sendPaymentNotificationEmail(
          freelancerUser.email,
          freelancerUser.name || freelancerUser.username,
          `$${txn.amount.toFixed(2)}`,
          'payment_cleared',
          'success',
          txn.transactionId
        );
      }
    } catch (err) {
      console.error('Failed to send Resend escrow release notifications:', err);
    }

    return sendSuccess(res, 'Escrow payout dispatched successfully.', {
      transactionId: txn.transactionId,
      status: txn.status,
      amount: txn.amount
    });

  } catch (err) {
    return sendError(res, `Failed releasing payment: ${err.message}`, 500);
  }
};

/**
 * GET /api/mock-payment/transactions
 * Retrieve transaction history logs (buyer, freelancer, or admin)
 */
export const getMyTransactions = async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    let txns = [];
    if (userRole === 'admin') {
      txns = await Transaction.find().sort({ createdAt: -1 });
    } else {
      txns = await Transaction.find({
        $or: [
          { buyerId: userId },
          { freelancerId: userId }
        ]
      }).sort({ createdAt: -1 });
    }

    const hydrated = [];
    for (const txn of txns) {
      const [buyer, freelancer, job] = await Promise.all([
        User.findById(txn.buyerId).select('username name'),
        User.findById(txn.freelancerId).select('username name'),
        Job.findById(txn.jobId).select('title')
      ]);

      hydrated.push({
        _id: txn._id,
        transactionId: txn.transactionId,
        jobId: txn.jobId,
        jobTitle: job ? job.title : 'External Assignment',
        buyerId: txn.buyerId,
        buyerUsername: buyer ? buyer.username : 'Deleted Buyer',
        freelancerId: txn.freelancerId,
        freelancerUsername: freelancer ? freelancer.username : 'Deleted Freelancer',
        amount: txn.amount,
        status: txn.status,
        createdAt: txn.createdAt
      });
    }

    return sendSuccess(res, 'Mock transactions list retrieved.', { transactions: hydrated });
  } catch (err) {
    return sendError(res, `Failed tracking transactions history: ${err.message}`, 500);
  }
};

/**
 * POST /api/mock-payment/admin/update-status
 * Allows administrator to manually transition payment logs, adjusting balances if cancelled/released.
 */
export const adminUpdateTransaction = async (req, res) => {
  const { transactionId, status } = req.body;

  if (req.user.role !== 'admin') {
    return sendError(res, 'Forbidden. Only system admins can alter ledger accounts manually.', 403);
  }

  if (!transactionId || !status) {
    return sendError(res, 'Transaction ID and status parameter are required.', 400);
  }

  try {
    const txn = await Transaction.findOne({ transactionId });
    if (!txn) {
      return sendError(res, 'Target transaction log not found.', 404);
    }

    const previousStatus = txn.status;
    if (previousStatus === status) {
      return sendSuccess(res, 'State was unchanged (already matches destination status).');
    }

    txn.status = status;
    await txn.save();

    // side-effects of changing status manually
    if (status === 'released' && previousStatus !== 'released') {
      const freelancer = await User.findById(txn.freelancerId);
      if (freelancer) {
        freelancer.balance += txn.amount;
        await freelancer.save();

        let fw = await Wallet.findOne({ userId: txn.freelancerId });
        if (fw) {
          if (previousStatus === 'in_escrow') {
            fw.pendingBalance = Math.max(0, fw.pendingBalance - txn.amount);
          }
          fw.balance = freelancer.balance;
          fw.totalEarned += txn.amount;
          await fw.save();
        }
      }

      // Sync job status to completed
      const job = await Job.findById(txn.jobId);
      if (job) {
        job.status = 'completed';
        await job.save();
      }
    }

    if (status === 'cancelled') {
      const buyer = await User.findById(txn.buyerId);
      if (buyer) {
        buyer.balance += txn.amount;
        await buyer.save();

        let bw = await Wallet.findOne({ userId: txn.buyerId });
        if (bw) {
          bw.balance = buyer.balance;
          await bw.save();
        }
      }

      // If previousStatus was 'in_escrow', decrement freelancer's pending balance
      if (previousStatus === 'in_escrow') {
        const freelancer = await User.findById(txn.freelancerId);
        let fw = await Wallet.findOne({ userId: txn.freelancerId });
        if (fw) {
          fw.pendingBalance = Math.max(0, fw.pendingBalance - txn.amount);
          await fw.save();
        }
      }

      // Cancel contract on active job, restore back to open
      const job = await Job.findById(txn.jobId);
      if (job) {
        job.status = 'open';
        job.hiredFreelancer = null;
        await job.save();
      }
    }

    return sendSuccess(res, `Transaction state manually set to ${status}. Accounts synchronized successfully.`, {
      transaction: txn
    });

  } catch (err) {
    return sendError(res, `Administrative transaction rewrite failed: ${err.message}`, 500);
  }
};

/**
 * POST /api/mock-payment/deposit
 * Top up player balance instantly for testing.
 */
export const depositMockFunds = async (req, res) => {
  const { amount } = req.body;
  const userId = req.user.id;

  if (!amount || Number(amount) <= 0) {
    return sendError(res, 'Please provide a valid deposit amount greater than $0.', 400);
  }

  try {
    const user = await User.findById(userId);
    if (!user) return sendError(res, 'User not found.', 404);

    const parsedAmount = Number(amount);
    user.balance += parsedAmount;
    await user.save();

    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = await Wallet.create({ userId, balance: user.balance });
    } else {
      wallet.balance = user.balance;
      await wallet.save();
    }

    // Record as completed transaction entry
    const randomHex = Math.floor(100000 + Math.random() * 900000).toString();
    const transactionId = `DEP-${Date.now().toString().slice(-4)}-${randomHex}`;
    await Transaction.create({
      transactionId,
      jobId: 'SYSTEM-DEPOSIT',
      buyerId: userId,
      freelancerId: userId, // Self-transfer representation
      amount: parsedAmount,
      status: 'released'
    });

    // Send payment_released deposit notification
    await createNotification(
      userId,
      'payment_released',
      'Mock Balance Deposited',
      `Successfully loaded $${parsedAmount.toFixed(2)} mock funds from your simulated card.`
    );

    // Send Resend Payment Receipt Email
    try {
      await sendPaymentNotificationEmail(
        user.email,
        user.name || user.username,
        `$${parsedAmount.toFixed(2)}`,
        'wallet_deposit',
        'success',
        transactionId
      );
    } catch (err) {
      console.error('Failed to send Resend deposit notification email:', err);
    }

    return sendSuccess(res, `Successfully deposited $${parsedAmount.toFixed(2)} mock funds.`, {
      balance: user.balance,
      wallet
    });

  } catch (err) {
    return sendError(res, `Deposit system error: ${err.message}`, 500);
  }
};

/**
 * POST /api/mock-payment/withdraw
 * simulated cashout to bank transfer, paypal, payoneer
 */
export const withdrawMockFunds = async (req, res) => {
  const { amount, method } = req.body;
  const userId = req.user.id;

  if (!amount || Number(amount) <= 0) {
    return sendError(res, 'Please specify a withdrawal value greater than $0.', 400);
  }

  try {
    const user = await User.findById(userId);
    if (!user) return sendError(res, 'User record not found.', 404);

    const parsedAmount = Number(amount);
    if (user.balance < parsedAmount) {
      return sendError(res, `Insufficient funds. Your available balance is $${user.balance.toFixed(2)}.`, 400);
    }

    user.balance -= parsedAmount;
    await user.save();

    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = await Wallet.create({ userId, balance: user.balance });
    } else {
      wallet.balance = user.balance;
      await wallet.save();
    }

    // Record as cashout transaction entry
    const randomHex = Math.floor(100000 + Math.random() * 900000).toString();
    const transactionId = `WTH-${Date.now().toString().slice(-4)}-${randomHex}`;
    await Transaction.create({
      transactionId,
      jobId: 'SYSTEM-CASH-OUT',
      buyerId: userId, // Buyer refers to self
      freelancerId: userId,
      amount: parsedAmount,
      status: 'released'
    });

    // Send payment_released cashout notification
    await createNotification(
       userId,
       'payment_released',
       'Mock Cashout Initiated',
       `Your cashout of $${parsedAmount.toFixed(2)} via simulated ${method || 'transfer'} has been initiated.`
    );

    // Send Resend Payment Withdrawal Email
    try {
      await sendPaymentNotificationEmail(
        user.email,
        user.name || user.username,
        `$${parsedAmount.toFixed(2)}`,
        `wallet_withdrawal (${method || 'wire'})`,
        'success',
        transactionId
      );
    } catch (err) {
      console.error('Failed to send Resend withdrawal notification email:', err);
    }

    return sendSuccess(res, `Simulated cashout of $${parsedAmount.toFixed(2)} via ${method || 'wire'} initiated.`, {
      balance: user.balance,
      wallet
    });

  } catch (err) {
    return sendError(res, `Withdrawal system error: ${err.message}`, 500);
  }
};
