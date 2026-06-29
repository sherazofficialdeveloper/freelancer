import Job from '../models/Job.js';
import User from '../models/User.js';
import Payment from '../models/Payment.js';
import Transaction from '../models/Transaction.js';
import Wallet from '../models/Wallet.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { sendEmail } from '../utils/email.js';
import { createNotification } from '../utils/notification.helper.js';

export const createJob = async (req, res) => {
  const { title, description, budget, category, deliverables, skills, deadline } = req.body;

  if (!title || !description || !budget) {
    return sendError(res, 'Title, description, and budget are required fields.', 400);
  }

  try {
    const clientUser = await User.findById(req.user.id);
    if (!clientUser) {
      return sendError(res, 'Client user not found.', 404);
    }

    if (clientUser.balance < Number(budget)) {
      return sendError(res, `Insufficient wallet balance. You need at least $${budget} to post this job. Your current balance is $${clientUser.balance}.`, 400);
    }

    // Escrow funds immediately upon job creation
    clientUser.balance -= Number(budget);
    await clientUser.save();

    const parsedSkills = Array.isArray(skills) 
      ? skills 
      : (typeof skills === 'string' ? skills.split(',').map(s => s.trim()).filter(Boolean) : []);

    const job = await Job.create({
      title,
      description,
      budget: Number(budget),
      category: category || 'General',
      skills: parsedSkills,
      deadline: deadline || '',
      client: req.user.id,
      status: 'open',
      deliverables: deliverables || ''
    });

    sendEmail(
      clientUser.email,
      'Job Posted & Escrow Funded!',
      `Your job "${title}" with budget $${budget} is live. $${budget} has been held in secure escrow.`
    );

    // Create system notification for client
    await createNotification(
      req.user.id,
      'job_posted',
      'Job Posted and Escrow Funded',
      `Your project contract "${title}" has been successfully broadcast to Farelancer. $${budget} is locked in safe escrow.`
    );

    return sendSuccess(res, 'Job posted successfully & escrow funded!', { job, clientBalance: clientUser.balance }, 201);
  } catch (err) {
    return sendError(res, `Error posting job: ${err.message}`, 500);
  }
};

export const updateJob = async (req, res) => {
  const { id } = req.params;
  const { title, description, budget, category, skills, deadline, deliverables } = req.body;

  try {
    const job = await Job.findById(id);
    if (!job) {
      return sendError(res, 'Job profile not found.', 404);
    }

    // Only actual owner (client) can modify
    if (job.client !== req.user.id && req.user.role !== 'admin') {
      return sendError(res, 'Unauthorized. Only the owner can alter this job listing.', 403);
    }

    if (job.status !== 'open') {
      return sendError(res, `Cannot update job. Real-time contracts are currently ${job.status}.`, 400);
    }

    const clientUser = await User.findById(job.client);
    if (!clientUser) {
      return sendError(res, 'Client owner profile not found.', 404);
    }

    if (budget !== undefined && Number(budget) !== job.budget) {
      const budgetDiff = Number(budget) - job.budget;
      if (clientUser.balance < budgetDiff) {
        return sendError(res, `Insufficient balance. Changing budget requires extra $${budgetDiff}, but your balance is only $${clientUser.balance}.`, 400);
      }
      clientUser.balance -= budgetDiff;
      await clientUser.save();
      job.budget = Number(budget);
    }

    if (title) job.title = title;
    if (description) job.description = description;
    if (category) job.category = category;
    if (skills) {
      job.skills = Array.isArray(skills) 
        ? skills 
        : skills.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (deadline !== undefined) job.deadline = deadline;
    if (deliverables !== undefined) job.deliverables = deliverables;

    await job.save();

    return sendSuccess(res, 'Job modified successfully.', { job, clientBalance: clientUser.balance });
  } catch (err) {
    return sendError(res, `Error updating job: ${err.message}`, 500);
  }
};

export const deleteJob = async (req, res) => {
  const { id } = req.params;

  try {
    const job = await Job.findById(id);
    if (!job) {
      return sendError(res, 'Job listed not found.', 404);
    }

    if (job.client !== req.user.id && req.user.role !== 'admin') {
      return sendError(res, 'Unauthorized. Only the client owner can abort this post.', 403);
    }

    // Release escrow money if status was open
    if (job.status === 'open') {
      const clientUser = await User.findById(job.client);
      if (clientUser) {
        clientUser.balance += job.budget;
        await clientUser.save();
      }
    }

    await Job.findByIdAndDelete(id);

    return sendSuccess(res, 'Job post deleted and escrow funds returned securely to client wallet.');
  } catch (err) {
    return sendError(res, `Error deleting job listing: ${err.message}`, 500);
  }
};

export const getJobs = async (req, res) => {
  const { category, search } = req.query;
  const filter = { status: 'open' };

  if (category && category !== 'All') {
    filter.category = category;
  }

  try {
    const jobs = await Job.find(filter).populate('client').sort({ createdAt: -1 });
    
    // Manual search filtering if required
    let activeJobs = jobs;
    if (search && search.trim() !== '') {
      const term = search.toLowerCase();
      activeJobs = jobs.filter(j => 
        j.title.toLowerCase().includes(term) || 
        j.description.toLowerCase().includes(term)
      );
    }

    return sendSuccess(res, 'Jobs retrieved successfully.', { jobs: activeJobs });
  } catch (err) {
    return sendError(res, `Error loading jobs: ${err.message}`, 500);
  }
};

export const getJobById = async (req, res) => {
  const { id } = req.params;

  try {
    const job = await Job.findById(id).populate('client').populate('hiredFreelancer');
    if (!job) {
      return sendError(res, 'Request job record not found.', 404);
    }
    return sendSuccess(res, 'Job detail loaded.', { job });
  } catch (err) {
    return sendError(res, `Error fetching job info: ${err.message}`, 500);
  }
};

export const submitWork = async (req, res) => {
  const { id } = req.params;
  const { text, fileUrl } = req.body;

  if (!text) {
    return sendError(res, 'Please specify your submission details or deliverables description.', 400);
  }

  try {
    const job = await Job.findById(id);
    if (!job) {
      return sendError(res, 'Job record not found.', 404);
    }

    if (job.hiredFreelancer !== req.user.id) {
      return sendError(res, 'Unauthorized. Only the designated freelancer for this job can submit work.', 403);
    }

    if (job.status !== 'active') {
      return sendError(res, `This job is not currently active (Current status: ${job.status}).`, 400);
    }

    // Save work submission
    job.submission = {
      text,
      fileUrl: fileUrl || '',
      submittedAt: new Date().toISOString()
    };
    
    await job.save();

    // Send notification to buyer client
    const clientUser = await User.findById(job.client);
    if (clientUser) {
      sendEmail(
        clientUser.email,
        'Deliverable Submitted!',
        `Your freelancer has submitted deliverables for "${job.title}". Please review and approve on your dashboard.`
      );

      // System notification for Buyer client
      await createNotification(
        job.client,
        'system_alert',
        'Project Submission Awaiting Approval',
        `Freelancer @${req.user.username} has submitted deliverables for "${job.title}". Please review and sign.`
      );
    }

    // System notification for Freelancer
    await createNotification(
      req.user.id,
      'system_alert',
      'Deliverables Transmitted Successfully',
      `Your work for contract "${job.title}" has been submitted for employer evaluation.`
    );

    return sendSuccess(res, 'Deliverables submitted successfully! Waiting for client review.', { job });
  } catch (err) {
    return sendError(res, `Error submitting work: ${err.message}`, 500);
  }
};

export const approveWorkAndRelease = async (req, res) => {
  const { id } = req.params;

  try {
    const job = await Job.findById(id);
    if (!job) {
      return sendError(res, 'Job record not found.', 404);
    }

    if (job.client !== req.user.id) {
      return sendError(res, 'Forbidden. Only the job client can approve work and release escrow payments.', 403);
    }

    if (job.status !== 'active' || !job.submission || !job.submission.submittedAt) {
      return sendError(res, 'Cannot approve project. No submission is awaiting approval, or job is not active.', 400);
    }

    // Complete the job and pay the freelancer
    job.status = 'completed';
    await job.save();

    const freelancer = await User.findById(job.hiredFreelancer);
    if (!freelancer) {
      return sendError(res, 'Hired freelancer account not found.', 404);
    }

    // Release escrow budget to freelancer's balance
    freelancer.balance += job.budget;
    freelancer.completedCount = (freelancer.completedCount || 0) + 1;

    // Optional client feedback review registry
    const { rating, comment } = req.body;
    if (rating !== undefined && rating !== null) {
      freelancer.reviews = freelancer.reviews || [];
      freelancer.reviews.push({
        reviewerId: req.user.id,
        reviewerName: req.user.username,
        reviewerRole: req.user.role,
        rating: Number(rating),
        comment: comment || 'Excellent work deliverable!',
        jobTitle: job.title
      });

      // Recalculate average rating aggregate
      const totalStars = freelancer.reviews.reduce((acc, curr) => acc + curr.rating, 0);
      freelancer.rating = Number((totalStars / freelancer.reviews.length).toFixed(1));
    }

    await freelancer.save();

    // Sync Wallet and Transaction states
    const txn = await Transaction.findOne({ jobId: job._id, status: 'in_escrow' });
    if (txn) {
      txn.status = 'released';
      await txn.save();
    }

    let freelancerWallet = await Wallet.findOne({ userId: freelancer._id });
    if (!freelancerWallet) {
      freelancerWallet = await Wallet.create({
        userId: freelancer._id,
        balance: freelancer.balance,
        pendingBalance: 0,
        totalEarned: job.budget
      });
    } else {
      freelancerWallet.pendingBalance = Math.max(0, freelancerWallet.pendingBalance - job.budget);
      freelancerWallet.balance = freelancer.balance;
      freelancerWallet.totalEarned += job.budget;
      await freelancerWallet.save();
    }

    // Log the successful released payment trans
    await Payment.create({
      job: job._id,
      payer: job.client,
      receiver: freelancer._id,
      amount: job.budget,
      status: 'released'
    });

    sendEmail(
      freelancer.email,
      'Funds Released & Job Completed!',
      `Congratulations! The client has approved your submission for "${job.title}". $${job.budget} has been credited to your Farelancer balance!`
    );

    // Create payment_released notification for freelancer
    await createNotification(
      freelancer._id,
      'payment_released',
      'Escrow Released & Payment Disbursed',
      `Excellent! @${req.user.username} has approved your deliverables for "${job.title}". $${job.budget} is now available in your wallet balance.`
    );

    // Create payment_released notification for client
    await createNotification(
      req.user.id,
      'payment_released',
      'Milestone Payment Disbursed',
      `You successfully approved deliverables and released $${job.budget} to @${freelancer.username} for "${job.title}".`
    );

    return sendSuccess(res, 'Work approved successfully and escrow budget dispatched to freelancer!', { job, freelancerBalance: freelancer.balance });
  } catch (err) {
    return sendError(res, `Error releasing payment: ${err.message}`, 500);
  }
};

export const getMyJobs = async (req, res) => {
  try {
    const query = req.user.role === 'buyer' 
      ? { client: req.user.id } 
      : { hiredFreelancer: req.user.id };

    const jobs = await Job.find(query).populate('client').populate('hiredFreelancer').sort({ createdAt: -1 });
    return sendSuccess(res, 'My jobs collection retrieved.', { jobs });
  } catch (err) {
    return sendError(res, `Error loading personal active jobs: ${err.message}`, 500);
  }
};
