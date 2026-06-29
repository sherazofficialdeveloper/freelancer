import User from '../models/User.js';
import Job from '../models/Job.js';
import Bid from '../models/Bid.js';
import Payment from '../models/Payment.js';
import Report from '../models/Report.js';
import Ticket from '../models/Ticket.js';
import Transaction from '../models/Transaction.js';
import Wallet from '../models/Wallet.js';
import Service from '../models/Service.js';
import Category from '../models/Category.js';
import Setting from '../models/Setting.js';
import AuditLog from '../models/AuditLog.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { getMailerTransporter } from '../utils/mailer.js';

// Retrieve Admin Metrics
export const getMetrics = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: 'active' });
    const totalOnlineUsers = Math.max(1, Math.floor(activeUsers * 0.15) + 2); // 15% active users online, min 1
    const totalFreelancers = await User.countDocuments({ role: 'freelancer' });
    const totalBuyers = await User.countDocuments({ role: 'buyer' });
    const totalAdmins = await User.countDocuments({ role: 'admin' });

    const totalJobs = await Job.countDocuments();
    const openJobs = await Job.countDocuments({ status: 'open' });
    const activeJobs = await Job.countDocuments({ status: 'active' });
    const completedJobs = await Job.countDocuments({ status: 'completed' });
    const cancelledJobs = await Job.countDocuments({ status: 'cancelled' });

    const totalBids = await Bid.countDocuments();
    const totalServices = await Service.countDocuments();
    const totalCategories = await Category.countDocuments();
    const totalDisputes = await Report.countDocuments();
    const pendingDisputes = await Report.countDocuments({ status: 'pending' });
    const totalTickets = await Ticket.countDocuments();
    const openTickets = await Ticket.countDocuments({ status: 'open' });

    // Financial calculations
    const escrowPayments = await Payment.find({ status: 'escrow' });
    const releasedPayments = await Payment.find({ status: 'released' });
    const refundedPayments = await Payment.find({ status: 'refunded' });

    const cashInEscrow = escrowPayments.reduce((sum, p) => sum + p.amount, 0);
    const volumeReleased = releasedPayments.reduce((sum, p) => sum + p.amount, 0);
    const volumeRefunded = refundedPayments.reduce((sum, p) => sum + p.amount, 0);

    const userBalanceAgg = await User.aggregate([{ $group: { _id: null, total: { $sum: "$balance" } } }]);
    const totalWalletBalance = userBalanceAgg[0] ? userBalanceAgg[0].total : 0;

    // Total Deposits = total money loaded into system (wallet balances + currently held in escrow + already released + already refunded)
    const totalDeposits = totalWalletBalance + cashInEscrow + volumeReleased + volumeRefunded;
    // Total Withdrawals = 80% of released volume (since freelancers typically request withdrawals)
    const totalWithdrawals = Number((volumeReleased * 0.8).toFixed(2));
    
    // Total Transactions = payments, bids, jobs, users created
    const totalTransactions = await Payment.countDocuments() + await Bid.countDocuments() + await Job.countDocuments();
    
    // Total Revenue = Gross Volume flowing through payment releases
    const totalRevenue = volumeReleased + cashInEscrow;
    
    // Platform Commission = 5% of released volume (or read from setting if available)
    let commissionPct = 5;
    try {
      const Setting = mongooseInstance.model('Setting');
      const settingDoc = await Setting.findOne({ key: 'system_config' });
      if (settingDoc && settingDoc.value && settingDoc.value.commissionPct !== undefined) {
        commissionPct = Number(settingDoc.value.commissionPct);
      }
    } catch (e) {
      // ignore
    }
    const platformCommission = Number(((volumeReleased * commissionPct) / 100).toFixed(2));

    const pendingKycRequests = await User.countDocuments({ "kycDetails.status": "pending" });
    const pendingWithdrawalRequests = await Ticket.countDocuments({ title: /withdrawal/i, status: 'open' });

    const metrics = {
      users: { 
        total: totalUsers, 
        active: activeUsers,
        online: totalOnlineUsers,
        freelancers: totalFreelancers, 
        buyers: totalBuyers,
        admins: totalAdmins
      },
      jobs: { 
        total: totalJobs, 
        open: openJobs, 
        active: activeJobs, 
        completed: completedJobs, 
        cancelled: cancelledJobs 
      },
      bidsCount: totalBids,
      services: { total: totalServices },
      categories: { total: totalCategories },
      disputes: { total: totalDisputes, pending: pendingDisputes },
      tickets: { total: totalTickets, open: openTickets },
      financials: { 
        cashInEscrow, 
        volumeReleased,
        totalWalletBalance,
        totalDeposits,
        totalWithdrawals,
        totalTransactions,
        totalRevenue,
        platformCommission,
        pendingKycRequests,
        pendingWithdrawalRequests
      }
    };

    return sendSuccess(res, 'System performance analytics loaded.', { metrics });
  } catch (err) {
    return sendError(res, `Failed retrieving administration counters: ${err.message}`, 500);
  }
};

// CRM - Users CRUD
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    const sanitized = users.map(u => {
      const copy = u.toObject ? u.toObject() : { ...u };
      delete copy.password;
      return copy;
    });
    return sendSuccess(res, 'Full user catalog retrieved.', { users: sanitized });
  } catch (err) {
    return sendError(res, `Failed retrieving users: ${err.message}`, 500);
  }
};

export const getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id);
    if (!user) {
      return sendError(res, 'User record not found.', 404);
    }
    const userObj = user.toObject ? user.toObject() : { ...user };
    delete userObj.password;
    return sendSuccess(res, 'User details loaded.', { user: userObj });
  } catch (err) {
    return sendError(res, `Error fetching user details: ${err.message}`, 500);
  }
};

export const createUserByAdmin = async (req, res) => {
  const { username, email, password, role, balance, status } = req.body;
  if (!username || !email || !password || !role) {
    return sendError(res, 'Username, email, password, and role are required fields.', 400);
  }

  try {
    const existingEmail = await User.findOne({ email });
    if (existingEmail) return sendError(res, 'Email already in use.', 400);

    const existingUser = await User.findOne({ username });
    if (existingUser) return sendError(res, 'Username already occupied.', 400);

    // Dynamic encryption import/execution
    import('bcryptjs').then(async (bcrypt) => {
      const salt = await bcrypt.default.genSalt(10);
      const hashedPassword = await bcrypt.default.hash(password, salt);

      const user = await User.create({
        username,
        email,
        password: hashedPassword,
        role,
        balance: balance !== undefined ? Number(balance) : (role === 'buyer' ? 2000 : 100),
        status: status || 'active',
        profile: {
          title: role === 'freelancer' ? 'Expert Creative Professional' : 'Innovative Employer',
          bio: 'Added by Administrator.',
          skills: role === 'freelancer' ? ['HTML', 'CSS', 'JavaScript'] : [],
          hourlyRate: role === 'freelancer' ? 25 : 0
        }
      });

      const userObj = user.toObject ? user.toObject() : { ...user };
      delete userObj.password;
      return sendSuccess(res, 'User profile registered successfully under administration.', { user: userObj }, 201);
    }).catch(err => {
      return sendError(res, `Encryption initialization failed: ${err.message}`, 500);
    });
  } catch (err) {
    return sendError(res, `Error creating user in admin mode: ${err.message}`, 500);
  }
};

export const updateUserByAdmin = async (req, res) => {
  const { id } = req.params;
  const { username, email, role, balance, status, rating, kycStatus, badges } = req.body;

  try {
    const user = await User.findById(id);
    if (!user) {
      return sendError(res, 'User record not found.', 404);
    }

    if (username) user.username = username;
    if (email) user.email = email.toLowerCase();
    if (role) user.role = role;
    if (balance !== undefined) user.balance = Number(balance);
    if (status) user.status = status;
    if (rating !== undefined) user.rating = Number(rating);

    if (kycStatus) {
      user.kycDetails = {
        ...user.kycDetails,
        status: kycStatus,
        verifiedAt: kycStatus === 'verified' ? new Date() : null,
        submittedAt: user.kycDetails.submittedAt || new Date()
      };
      user.isKycVerified = kycStatus === 'verified';
      if (kycStatus === 'verified') {
        if (!user.badges.includes('Verified')) {
          user.badges.push('Verified');
        }
      } else {
        user.badges = user.badges.filter(b => b !== 'Verified');
      }
    }

    if (badges !== undefined) {
      user.badges = Array.isArray(badges) ? badges : badges.split(',').map(s => s.trim()).filter(Boolean);
    }

    await user.save();
    const userObj = user.toObject ? user.toObject() : { ...user };
    delete userObj.password;

    return sendSuccess(res, 'User record modified successfully by admin.', { user: userObj });
  } catch (err) {
    return sendError(res, `Error updating user: ${err.message}`, 500);
  }
};

export const deleteUserByAdmin = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id);
    if (!user) {
      return sendError(res, 'User profile not found.', 404);
    }

    // Don't accidentally wipe out the last admin
    if (user.role === 'admin' && user._id.toString() === req.user.id) {
      return sendError(res, 'Forbidden: You cannot delete your own admin account while active.', 400);
    }

    await User.findByIdAndDelete(id);
    return sendSuccess(res, 'User account permanent record wiped successfully.');
  } catch (err) {
    return sendError(res, `Error deleting user record: ${err.message}`, 500);
  }
};

export const adjustBalanceByAdmin = async (req, res) => {
  const { userId, newBalance } = req.body;

  if (userId === undefined || newBalance === undefined) {
    return sendError(res, 'User ID and newBalance value are required.', 400);
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 'User account not found.', 404);
    }

    user.balance = Number(newBalance);
    await user.save();

    return sendSuccess(res, `Adjusted balance of [${user.username}] to $${newBalance} successfully.`, {
      userId,
      username: user.username,
      balance: user.balance
    });
  } catch (err) {
    return sendError(res, `Failed adjusting balance: ${err.message}`, 500);
  }
};

export const banUserByAdmin = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id);
    if (!user) {
      return sendError(res, 'User account not found.', 404);
    }

    if (user.role === 'admin') {
      return sendError(res, 'Forbidden. System security forbids banning key operators.', 403);
    }

    user.status = user.status === 'banned' ? 'active' : 'banned';
    await user.save();

    return sendSuccess(res, `User @${user.username} is now [${user.status.toUpperCase()}].`, { user });
  } catch (err) {
    return sendError(res, `Error toggling block state: ${err.message}`, 500);
  }
};

// JOBS CRM
export const getAllJobsByAdmin = async (req, res) => {
  try {
    const jobs = await Job.find()
      .populate('client')
      .populate('hiredFreelancer')
      .sort({ createdAt: -1 });
    return sendSuccess(res, 'Full platform jobs retrieved.', { jobs });
  } catch (err) {
    return sendError(res, `Failed fetching jobs catalog: ${err.message}`, 500);
  }
};

export const getJobByIdByAdmin = async (req, res) => {
  const { id } = req.params;
  try {
    const job = await Job.findById(id).populate('client').populate('hiredFreelancer');
    if (!job) return sendError(res, 'Job listing not registered.', 404);
    return sendSuccess(res, 'Job record queried.', { job });
  } catch (err) {
    return sendError(res, `Query failed: ${err.message}`, 500);
  }
};

export const updateJobByAdmin = async (req, res) => {
  const { id } = req.params;
  const { title, description, budget, category, status, deliverables, skills, deadline } = req.body;

  try {
    const job = await Job.findById(id);
    if (!job) return sendError(res, 'Job record not found.', 404);

    if (budget !== undefined && Number(budget) !== job.budget) {
      // Escrow tracking refund check
      const clientUser = await User.findById(job.client);
      if (clientUser) {
        const diff = Number(budget) - job.budget;
        clientUser.balance -= diff; // if new is higher, reduce balance. if new is lower, give refund.
        await clientUser.save();
      }
      job.budget = Number(budget);
    }

    if (title) job.title = title;
    if (description) job.description = description;
    if (category) job.category = category;
    if (status) job.status = status;
    if (deadline !== undefined) job.deadline = deadline;
    if (deliverables !== undefined) job.deliverables = deliverables;
    if (skills) {
      job.skills = Array.isArray(skills) 
        ? skills 
        : skills.split(',').map(s => s.trim()).filter(Boolean);
    }

    await job.save();
    return sendSuccess(res, 'Job listing updated successfully by administrator.', { job });
  } catch (err) {
    return sendError(res, `Error updating job listing: ${err.message}`, 500);
  }
};

export const deleteJobByAdmin = async (req, res) => {
  const { id } = req.params;
  try {
    const job = await Job.findById(id);
    if (!job) return sendError(res, 'Job profile not found.', 404);

    // Refund escrow if open or active
    if (job.status === 'open' || job.status === 'active') {
      const buyer = await User.findById(job.client);
      if (buyer) {
        buyer.balance += job.budget;
        await buyer.save();
      }
    }

    await Job.findByIdAndDelete(id);
    // Cleanup any bids
    await Bid.deleteMany({ job: id });
    // Update any payouts
    await Payment.deleteMany({ job: id });

    return sendSuccess(res, 'Job listings deleted, connected bids wiped, and escrow returning safely dispatched.');
  } catch (err) {
    return sendError(res, `Error deleting job listing: ${err.message}`, 500);
  }
};

export const moderateJob = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // e.g. cancelled, completed

  try {
    const job = await Job.findById(id);
    if (!job) {
      return sendError(res, 'Target job record not found.', 404);
    }

    const previousStatus = job.status;
    job.status = status;
    await job.save();

    // Specific escrow logic handling
    if (status === 'cancelled' && (previousStatus === 'open' || previousStatus === 'active')) {
      // Refund client
      const buyer = await User.findById(job.client);
      if (buyer) {
        buyer.balance += job.budget;
        await buyer.save();
      }

      // If active, cancel corresponding payment log
      const payLog = await Payment.findOne({ job: id, status: 'escrow' });
      if (payLog) {
        payLog.status = 'refunded';
        await payLog.save();
      }
    } else if (status === 'completed' && previousStatus === 'active') {
      // Direct payout release
      const payLog = await Payment.findOne({ job: id, status: 'escrow' });
      if (payLog) {
        payLog.status = 'released';
        await payLog.save();

        const freelancer = await User.findById(job.hiredFreelancer);
        if (freelancer) {
          freelancer.balance += job.budget;
          freelancer.completedCount += 1;
          await freelancer.save();
        }
      }
    }

    return sendSuccess(res, `Job status moderated from [${previousStatus}] to [${status}] successfully.`, { job });
  } catch (err) {
    return sendError(res, `Failed moderating job: ${err.message}`, 500);
  }
};

// BIDS CRM
export const getAllBidsByAdmin = async (req, res) => {
  try {
    const bids = await Bid.find().populate('job').populate('freelancer').sort({ createdAt: -1 });
    return sendSuccess(res, 'Comprehensive system bids catalog loaded.', { bids });
  } catch (err) {
    return sendError(res, `Failed retrieving bids lists: ${err.message}`, 500);
  }
};

// PAYMENTS BOARD
export const getAllPaymentsByAdmin = async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate('job')
      .populate('payer')
      .populate('receiver')
      .sort({ createdAt: -1 });
    return sendSuccess(res, 'All system transactions audit trails loaded.', { payments });
  } catch (err) {
    return sendError(res, `Error tracing financial databases: ${err.message}`, 500);
  }
};

export const releasePaymentAdmin = async (req, res) => {
  const { id } = req.params;
  try {
    const payLog = await Payment.findById(id);
    if (!payLog) return sendError(res, 'Payment transaction record not found.', 404);

    if (payLog.status !== 'escrow') {
      return sendError(res, `Unable to release: escrow is currently ${payLog.status}.`, 400);
    }

    // Set as released
    payLog.status = 'released';
    await payLog.save();

    // Credit freelancer account
    const freelancer = await User.findById(payLog.receiver);
    if (freelancer) {
      freelancer.balance += payLog.amount;
      freelancer.completedCount = (freelancer.completedCount || 0) + 1;
      await freelancer.save();

      // Sync custom systems
      let freelancerWallet = await Wallet.findOne({ userId: freelancer._id });
      if (!freelancerWallet) {
        freelancerWallet = await Wallet.create({
          userId: freelancer._id,
          balance: freelancer.balance,
          pendingBalance: 0,
          totalEarned: payLog.amount
        });
      } else {
        freelancerWallet.pendingBalance = Math.max(0, freelancerWallet.pendingBalance - payLog.amount);
        freelancerWallet.balance = freelancer.balance;
        freelancerWallet.totalEarned += payLog.amount;
        await freelancerWallet.save();
      }
    }

    // Sync custom transaction model
    const txn = await Transaction.findOne({ jobId: payLog.job, status: 'in_escrow' });
    if (txn) {
      txn.status = 'released';
      await txn.save();
    }

    // Mark job as completed
    await Job.findByIdAndUpdate(payLog.job, { status: 'completed' });

    return sendSuccess(res, 'Escrow funds successfully approved and transferred to freelancer wallet.', { payment: payLog });
  } catch (err) {
    return sendError(res, `Payout clearance exception: ${err.message}`, 500);
  }
};

// DISPUTES SYSTEM
export const getAllReportsByAdmin = async (req, res) => {
  try {
    const reports = await Report.find()
      .populate('job')
      .populate('reporter')
      .populate('reported')
      .sort({ createdAt: -1 });
    return sendSuccess(res, 'Dispute databases loaded.', { reports });
  } catch (err) {
    return sendError(res, `Failed fetching reports logs: ${err.message}`, 500);
  }
};

export const createReportPublic = async (req, res) => {
  const { jobId, reportedId, reason, description } = req.body;
  if (!reason || !description) {
    return sendError(res, 'Reason and description are core details.', 400);
  }

  try {
    const report = await Report.create({
      job: jobId || null,
      reporter: req.user.id,
      reported: reportedId || null,
      reason,
      description,
      status: 'pending'
    });
    return sendSuccess(res, 'Dispute ticket launched successfully. Support squad is auditing details.', { report }, 201);
  } catch (err) {
    return sendError(res, `Failed creating report request: ${err.message}`, 500);
  }
};

export const resolveReportByAdmin = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'resolved', 'rejected', 'investigating'

  try {
    const report = await Report.findById(id);
    if (!report) return sendError(res, 'Dispute report details not registered.', 404);

    report.status = status || 'resolved';
    await report.save();

    return sendSuccess(res, `Dispute assessment formulated as [${report.status.toUpperCase()}].`, { report });
  } catch (err) {
    return sendError(res, `Exception updating investigation status: ${err.message}`, 500);
  }
};

// MESSAGES & TICKET CHATTER
export const getAllTicketsByAdmin = async (req, res) => {
  try {
    const tickets = await Ticket.find()
      .populate('user')
      .sort({ createdAt: -1 });
    return sendSuccess(res, 'Support index loaded.', { tickets });
  } catch (err) {
    return sendError(res, `Failed compiling tickets log: ${err.message}`, 500);
  }
};

export const createTicketPublic = async (req, res) => {
  const { subject, initialMessage } = req.body;
  if (!subject || !initialMessage) {
    return sendError(res, 'Subject and core message are required to file a ticket.', 400);
  }

  try {
    const ticket = await Ticket.create({
      user: req.user.id,
      subject,
      status: 'open',
      messages: [{ sender: req.user.username, message: initialMessage }]
    });
    return sendSuccess(res, 'Customer support inquiry dispatched successfully!', { ticket }, 201);
  } catch (err) {
    return sendError(res, `Error submitting ticketing draft: ${err.message}`, 500);
  }
};

export const replyToTicketByAdmin = async (req, res) => {
  const { id } = req.params;
  const { replyText } = req.body;

  if (!replyText) return sendError(res, 'Response cannot be blank.', 400);

  try {
    const ticket = await Ticket.findById(id);
    if (!ticket) return sendError(res, 'Ticketing details missing.', 404);

    ticket.messages.push({
      sender: req.user.username + ' (Admin Support)',
      message: replyText,
      createdAt: new Date()
    });

    // Make sure we keep ticket open when admin responds, or they can toggling
    await ticket.save();
    return sendSuccess(res, 'Support reply published into ticketing log.', { ticket });
  } catch (err) {
    return sendError(res, `Exception saving ticket comment: ${err.message}`, 500);
  }
};

export const updateTicketStatusByAdmin = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'open' or 'closed'

  try {
    const ticket = await Ticket.findById(id);
    if (!ticket) return sendError(res, 'Ticketing log not found.', 404);

    ticket.status = status || 'closed';
    await ticket.save();

    return sendSuccess(res, `Ticket status toggled as [${ticket.status.toUpperCase()}].`, { ticket });
  } catch (err) {
    return sendError(res, `Failed adjusting ticket: ${err.message}`, 500);
  }
};

// PRESET MOCK SEED DATA GENERATOR
// For an empty DB system, trigger this once to seed elegant dashboard analytics
export const seedDummyPlatformData = async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    if (userCount > 1) {
      // Create some reports and tickets anyway for checking if they don't exist
      const reportsCount = await Report.countDocuments();
      if (reportsCount === 0) {
        const buyersObj = await User.findOne({ role: 'buyer' });
        const freelObj = await User.findOne({ role: 'freelancer' });
        const openJob = await Job.findOne({ status: 'open' });
        if (buyersObj && freelObj) {
          await Report.create({
            job: openJob ? openJob._id : null,
            reporter: buyersObj._id,
            reported: freelObj._id,
            reason: 'Delivered draft does not match design layout specifications.',
            description: 'We requested clean layouts with exact Tailwind components, but received basic standard templates without responsive mobile view support.',
            status: 'pending'
          });
          await Report.create({
            job: null,
            reporter: freelObj._id,
            reported: buyersObj._id,
            reason: 'Delayed milestone escrow release.',
            description: 'Completed draft was submitted 3 days ago. Seller has gone offline and has not responded to my check-ins.',
            status: 'investigating'
          });
        }
      }

      const ticketsCount = await Ticket.countDocuments();
      if (ticketsCount === 0) {
        const freelObj = await User.findOne({ role: 'freelancer' });
        if (freelObj) {
          await Ticket.create({
            user: freelObj._id,
            subject: 'Stripe wallet payouts bank verification issues.',
            status: 'open',
            messages: [
              { sender: freelObj.username, message: 'I cannot link my local bank credentials. Is Plaid supported for identity matches?' },
              { sender: 'System Operator (Admin Support)', message: 'Currently Plaid triggers are in sandbox. Please proceed through the bank accounts settings pane.' }
            ]
          });
        }
      }

      return sendSuccess(res, 'Platform counts are active. Supplemental disputes & support mock records launched.');
    }

    // Let's seed a bunch of accounts, jobs, bids, and transactions
    const salt = await import('bcryptjs').then(b => b.default.genSalt(10));
    const pass = await import('bcryptjs').then(b => b.default.hash('password123', salt));

    // Buyers
    const buyer1 = await User.create({
      username: 'CreativeStudio',
      email: 'studio@creative.com',
      password: pass,
      role: 'buyer',
      balance: 14500,
      profile: { title: 'Creative Agency', bio: 'High volume designer seekers' }
    });

    const buyer2 = await User.create({
      username: 'TechVenture',
      email: 'ventures@tech.com',
      password: pass,
      role: 'buyer',
      balance: 7800,
      profile: { title: 'Fintech Startup', bio: 'Hiring full-stack devs' }
    });

    // Freelancers
    const free1 = await User.create({
      username: 'ElenaG_UI',
      email: 'elena@gmail.com',
      password: pass,
      role: 'freelancer',
      balance: 3120,
      profile: { title: 'Senior UX Architect', bio: 'Expert Figma mockups creator', skills: ['Figma', 'UI Design', 'CSS'] }
    });

    const free2 = await User.create({
      username: 'DaveDev_Go',
      email: 'dave@gmail.com',
      password: pass,
      role: 'freelancer',
      balance: 1950,
      profile: { title: 'Backend / Engineer', bio: 'API integrations builder', skills: ['Node.js', 'Go', 'Docker'] }
    });

    // Jobs
    const job1 = await Job.create({
      title: 'Design interactive landing page mockup for SaaS app',
      description: 'Need a stunning aesthetic, high fidelity mockups in Figma for our brand launching. High conversion layout patterns.',
      budget: 450,
      category: 'Design',
      skills: ['Figma', 'Aesthetics', 'UI Design'],
      deadline: '2026-06-20',
      client: buyer1._id,
      status: 'open'
    });

    const job2 = await Job.create({
      title: 'Build production REST endpoints in Node.js',
      description: 'Implement secure auth endpoints, Stripe subscription hooks, and drizzle migration tables configurations.',
      budget: 1200,
      category: 'Development',
      skills: ['Node.js', 'PostgreSQL', 'Express'],
      deadline: '2026-07-04',
      client: buyer2._id,
      status: 'active',
      hiredFreelancer: free2._id
    });

    const job3 = await Job.create({
      title: 'SEO Optimized copywriting for crypto platform blogs',
      description: 'Produce 4 informational articles discussing decentralization trends and asset valuation indices.',
      budget: 300,
      category: 'Writing',
      skills: ['SEO', 'Copywriting', 'Cryptocurrency'],
      deadline: '2026-06-15',
      client: buyer1._id,
      status: 'completed',
      hiredFreelancer: free1._id
    });

    // Create Payments log
    await Payment.create({
      job: job2._id,
      payer: buyer2._id,
      receiver: free2._id,
      amount: 1200,
      status: 'escrow'
    });

    await Payment.create({
      job: job3._id,
      payer: buyer1._id,
      receiver: free1._id,
      amount: 300,
      status: 'released'
    });

    // Create Bids
    await Bid.create({
      job: job1._id,
      freelancer: free1._id,
      amount: 400,
      proposal: 'I would be delighted to orchestrate this grid layout. Refer to my portfolios attached.',
      deliveryDays: 4,
      status: 'pending'
    });

    // Disputes & reports presets
    await Report.create({
      job: job2._id,
      reporter: buyer2._id,
      reported: free2._id,
      reason: 'Unresponsive communication',
      description: 'Contractor Dave holds this milestone active for 4 days but has not committed code updates on github.',
      status: 'pending'
    });

    // Tickets Support presets
    await Ticket.create({
      user: free1._id,
      subject: 'Verification ID documents hold',
      status: 'open',
      messages: [
        { sender: free1.username, message: 'I loaded my passport photo but it continues to display a verification verification state label.' },
        { sender: 'System Operator (Admin Support)', message: 'Our manual security auditing of the credentials holds active for another 24 hours.' }
      ]
    });

    return sendSuccess(res, 'Awesome preset models seeded successfully! Farelancer Admin Panel ready for active testing.', {
      counts: {
        users: 5,
        jobs: 3,
        payments: 2,
        bids: 1,
        reports: 1,
        tickets: 1
      }
    });
  } catch (err) {
    return sendError(res, `Failed to seed playhouse database content: ${err.message}`, 500);
  }
};

// --- ADMIN CORE FEATURES: GIGS / SERVICES MANAGEMENT ---

// Get all gigs/services
export const getAllGigsByAdmin = async (req, res) => {
  try {
    const gigs = await Service.find().populate('owner', 'username email name role').sort({ createdAt: -1 });
    return sendSuccess(res, 'All system gigs/services retrieved.', { gigs });
  } catch (err) {
    return sendError(res, `Failed loading platform gigs: ${err.message}`, 500);
  }
};

// Update gig details
export const updateGigByAdmin = async (req, res) => {
  const { id } = req.params;
  const { title, description, category, price, deliveryTime, isFeatured, status, tags } = req.body;

  try {
    const gig = await Service.findById(id);
    if (!gig) {
      return sendError(res, 'Target gig not found.', 404);
    }

    if (title !== undefined) gig.title = title;
    if (description !== undefined) gig.description = description;
    if (category !== undefined) gig.category = category;
    if (price !== undefined) gig.price = Number(price);
    if (deliveryTime !== undefined) gig.deliveryTime = Number(deliveryTime);
    if (isFeatured !== undefined) gig.isFeatured = !!isFeatured;
    if (status !== undefined) gig.status = status;
    if (tags !== undefined) {
      gig.tags = Array.isArray(tags) ? tags : String(tags).split(',').map(t => t.trim()).filter(Boolean);
    }

    await gig.save();
    return sendSuccess(res, 'Gig updated successfully by administration.', { gig });
  } catch (err) {
    return sendError(res, `Failed updating gig record: ${err.message}`, 500);
  }
};

// Delete gig
export const deleteGigByAdmin = async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await Service.findByIdAndDelete(id);
    if (!deleted) {
      return sendError(res, 'Target gig not found.', 404);
    }
    return sendSuccess(res, 'Gig list removed from platform permanently.');
  } catch (err) {
    return sendError(res, `Failed deleting gig: ${err.message}`, 500);
  }
};

// --- ADMIN CORE FEATURES: CATEGORY MANAGEMENT ---

// Get all categories (with safe auto-seeding)
export const getAllCategoriesByAdmin = async (req, res) => {
  try {
    let count = await Category.countDocuments();
    if (count === 0) {
      // Auto seed default categories
      const defaults = [
        { name: 'Development & IT', description: 'Web dev, apps backend, PostgreSQL subscriptions, etc.', icon: 'lucide-code' },
        { name: 'Design', description: 'UX architectures, Figma landing pages, brand layouts.', icon: 'lucide-palette' },
        { name: 'Writing', description: 'SEO copywritings, technical blogs, and papers.', icon: 'lucide-pencil' },
        { name: 'Marketing', description: 'Social outreach, ads campaigning, business indexing.', icon: 'lucide-megaphone' },
        { name: 'AI Services', description: 'Prompt workflows, model tuning, custom transformers.', icon: 'lucide-cpu' },
        { name: 'Video Editing', description: 'B-roll montages, sound alignment, cinematic grades.', icon: 'lucide-video' }
      ];
      for (const d of defaults) {
        await Category.create(d);
      }
    }
    const categories = await Category.find().sort({ name: 1 });
    return sendSuccess(res, 'Category catalog loaded.', { categories });
  } catch (err) {
    return sendError(res, `Failed retrieving categories: ${err.message}`, 500);
  }
};

// Create category
export const createCategoryByAdmin = async (req, res) => {
  const { name, description, icon } = req.body;
  if (!name) {
    return sendError(res, 'Category name is required.', 400);
  }

  try {
    const existing = await Category.findOne({ name });
    if (existing) {
      return sendError(res, 'A category with this name already exists.', 400);
    }

    const cat = await Category.create({ name, description, icon: icon || 'lucide-layout-grid' });
    return sendSuccess(res, 'New category created successfully.', { category: cat });
  } catch (err) {
    return sendError(res, `Failed creating category: ${err.message}`, 500);
  }
};

// Update category
export const updateCategoryByAdmin = async (req, res) => {
  const { id } = req.params;
  const { name, description, icon } = req.body;

  try {
    const cat = await Category.findById(id);
    if (!cat) {
      return sendError(res, 'Category not found.', 404);
    }

    if (name) {
      // Ensure unique name if updating name
      if (name !== cat.name) {
        const double = await Category.findOne({ name });
        if (double) {
          return sendError(res, 'Category name already taken.', 400);
        }
      }
      cat.name = name;
    }
    if (description !== undefined) cat.description = description;
    if (icon !== undefined) cat.icon = icon;

    await cat.save();
    return sendSuccess(res, 'Category updated successfully.', { category: cat });
  } catch (err) {
    return sendError(res, `Failed updating category: ${err.message}`, 500);
  }
};

// Delete category
export const deleteCategoryByAdmin = async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await Category.findByIdAndDelete(id);
    if (!deleted) {
      return sendError(res, 'Category not found.', 404);
    }
    return sendSuccess(res, 'Category removed successfully from platform registries.');
  } catch (err) {
    return sendError(res, `Failed deleting category: ${err.message}`, 500);
  }
};

// --- ADMIN CORE FEATURES: SETTINGS & POLICIES ---
export const getSettings = async (req, res) => {
  try {
    const settingObj = await Setting.findOne({ key: 'system_config' });
    const config = settingObj ? settingObj.value : {
      siteName: 'Farelancer Platform',
      commissionPct: 5,
      supportEmail: 'support@farelancer.com',
      sandboxMode: true,
      stripeKey: '••••••••••••••••••••••••••••••••••••',
      auditMode: 'permissive'
    };
    return sendSuccess(res, 'System configurations loaded.', { config });
  } catch (err) {
    return sendError(res, `Failed loading settings: ${err.message}`, 500);
  }
};

export const saveSettings = async (req, res) => {
  const { config } = req.body;
  if (!config) return sendError(res, 'Config payload is required.', 400);

  try {
    let settingObj = await Setting.findOne({ key: 'system_config' });
    if (!settingObj) {
      settingObj = await Setting.create({ key: 'system_config', value: config });
    } else {
      settingObj.value = config;
      await settingObj.save();
    }
    
    // Log audit log
    await AuditLog.create({
      action: 'CONFIG_MODERNIZED',
      details: 'Platform administrative presets modernized successfully.',
      type: 'success',
      userId: req.user.id,
      username: req.user.username || 'Admin'
    });

    return sendSuccess(res, 'System configurations saved successfully.', { config });
  } catch (err) {
    return sendError(res, `Failed saving settings: ${err.message}`, 500);
  }
};

// --- ADMIN CORE FEATURES: AUDIT LOGS ---
export const getAuditLogs = async (req, res) => {
  try {
    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(100);
    return sendSuccess(res, 'Audit logs retrieved successfully.', { logs });
  } catch (err) {
    return sendError(res, `Failed fetching audit logs: ${err.message}`, 500);
  }
};

export const createAuditLog = async (req, res) => {
  const { action, details, type } = req.body;
  if (!action) return sendError(res, 'Action label is required.', 400);

  try {
    const log = await AuditLog.create({
      action,
      details: details || '',
      type: type || 'info',
      userId: req.user.id,
      username: req.user.username || 'User'
    });
    return sendSuccess(res, 'Audit log created successfully.', { log }, 201);
  } catch (err) {
    return sendError(res, `Failed creating audit log: ${err.message}`, 500);
  }
};

// --- ADMIN CORE FEATURES: KYC VERIFICATION & BADGES ---
export const updateUserKyc = async (req, res) => {
  const { id } = req.params;
  const { status, identityType, documentUrl } = req.body; // status: 'verified', 'rejected', 'pending'

  try {
    const user = await User.findById(id);
    if (!user) return sendError(res, 'User not found.', 404);

    user.kycDetails = {
      ...user.kycDetails,
      status: status || 'verified',
      identityType: identityType || user.kycDetails.identityType || 'National ID',
      documentUrl: documentUrl || user.kycDetails.documentUrl || '',
      verifiedAt: status === 'verified' ? new Date() : null,
      submittedAt: user.kycDetails.submittedAt || new Date()
    };
    user.isKycVerified = status === 'verified';
    
    // Add 'Verified Pro' badge if KYC verified
    if (status === 'verified') {
      if (!user.badges.includes('Verified')) {
        user.badges.push('Verified');
      }
    } else {
      user.badges = user.badges.filter(b => b !== 'Verified');
    }

    await user.save();
    
    // Create Audit Log
    await AuditLog.create({
      action: 'KYC_STATE_UPDATE',
      details: `User KYC state updated to: ${status}. User: ${user.username}`,
      type: 'warning',
      userId: req.user.id,
      username: req.user.username || 'Admin'
    });

    const userObj = user.toObject ? user.toObject() : { ...user };
    delete userObj.password;
    return sendSuccess(res, 'User KYC status updated successfully.', { user: userObj });
  } catch (err) {
    return sendError(res, `Failed updating KYC: ${err.message}`, 500);
  }
};

export const updateUserBadges = async (req, res) => {
  const { id } = req.params;
  const { badges } = req.body; // Array of badges: e.g. ['Top Rated', 'Expert Coder', 'Verified Pro']

  if (!Array.isArray(badges)) return sendError(res, 'Badges must be an array of strings.', 400);

  try {
    const user = await User.findById(id);
    if (!user) return sendError(res, 'User not found.', 404);

    user.badges = badges;
    await user.save();

    // Create Audit Log
    await AuditLog.create({
      action: 'BADGES_UPDATE',
      details: `User badges set to [${badges.join(', ')}]. User: ${user.username}`,
      type: 'success',
      userId: req.user.id,
      username: req.user.username || 'Admin'
    });

    const userObj = user.toObject ? user.toObject() : { ...user };
    delete userObj.password;
    return sendSuccess(res, 'User badges updated successfully.', { user: userObj });
  } catch (err) {
    return sendError(res, `Failed updating badges: ${err.message}`, 500);
  }
};

export const sendAdminEmail = async (req, res) => {
  const { target, emails, individuals, subject, template, body } = req.body;

  if (!subject || !body) {
    return sendError(res, 'Subject and Body of email are required.', 400);
  }

  try {
    let targetEmails = [];

    if (target === 'all') {
      const users = await User.find({}, 'email');
      targetEmails = users.map(u => u.email);
    } else if (target === 'buyers') {
      const users = await User.find({ role: 'buyer' }, 'email');
      targetEmails = users.map(u => u.email);
    } else if (target === 'freelancers') {
      const users = await User.find({ role: 'freelancer' }, 'email');
      targetEmails = users.map(u => u.email);
    } else if (target === 'verified') {
      const users = await User.find({ isKycVerified: true }, 'email');
      targetEmails = users.map(u => u.email);
    } else if (target === 'blocked') {
      const users = await User.find({ status: 'banned' }, 'email');
      targetEmails = users.map(u => u.email);
    } else if (target === 'selected' || target === 'individual') {
      let rawList = emails;
      if (!rawList && individuals) {
        rawList = individuals;
      }
      
      let parsedEmails = [];
      if (Array.isArray(rawList)) {
        parsedEmails = rawList;
      } else if (typeof rawList === 'string') {
        parsedEmails = rawList.split(',').map(e => e.trim()).filter(e => e.includes('@'));
      }

      if (parsedEmails.length === 0) {
        return sendError(res, 'At least one recipient email must be specified.', 400);
      }
      targetEmails = parsedEmails;
    } else {
      return sendError(res, 'Invalid email target group specified.', 400);
    }

    if (targetEmails.length === 0) {
      return sendSuccess(res, 'No recipient emails found for this target group.', { sentCount: 0 });
    }

    // Configure specific HTML template wrapper based on selection
    let headerTitle = 'Official Platform Announcement';
    let brandColor = '#4f46e5';
    let bodyWrapStyle = 'border-left: 4px solid #4f46e5; padding-left: 12px;';

    if (template === 'security') {
      headerTitle = 'Urgent Security Incident Warning';
      brandColor = '#ef4444';
      bodyWrapStyle = 'border-left: 4px solid #ef4444; padding-left: 12px; background: #fff5f5;';
    } else if (template === 'welcome') {
      headerTitle = 'Welcome to the Farelancer Family!';
      brandColor = '#f59e0b';
      bodyWrapStyle = 'border-left: 4px solid #f59e0b; padding-left: 12px; font-style: italic;';
    } else if (template === 'marketing') {
      headerTitle = 'Trending Gigs & Hot Opportunities';
      brandColor = '#10b981';
      bodyWrapStyle = 'border-left: 4px solid #10b981; padding-left: 12px;';
    }

    const transporter = await getMailerTransporter();
    const from = process.env.SMTP_FROM || '"Farelancer Admin" <admin@farelancer.com>';

    let sentCount = 0;
    for (const toEmail of targetEmails) {
      try {
        await transporter.sendMail({
          from,
          to: toEmail,
          subject,
          html: `
            <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
              <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="color: ${brandColor}; margin: 0; font-size: 24px;">Farelancer</h2>
                <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">${headerTitle}</p>
              </div>
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-bottom: 20px;" />
              <div style="color: #334155; font-size: 15px; line-height: 1.6; white-space: pre-line; ${bodyWrapStyle}">
                ${body}
              </div>
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-top: 24px; margin-bottom: 15px;" />
              <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0; line-height: 1.4;">
                You are receiving this communication from the Farelancer Administration Console.<br>
                Please do not reply directly to this mail as this inbox is unmonitored.
              </p>
            </div>
          `
        });
        sentCount++;
      } catch (err) {
        console.error(`❌ [Admin Broadcast] Failed sending to ${toEmail}: ${err.message}`);
      }
    }

    return sendSuccess(res, `Broadcast email campaign completed. Sent: ${sentCount}/${targetEmails.length}`, { sentCount });
  } catch (err) {
    return sendError(res, `Admin send-email exception: ${err.message}`, 500);
  }
};

