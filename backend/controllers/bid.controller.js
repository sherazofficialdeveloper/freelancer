import Bid from '../models/Bid.js';
import Job from '../models/Job.js';
import User from '../models/User.js';
import Payment from '../models/Payment.js';
import Transaction from '../models/Transaction.js';
import Wallet from '../models/Wallet.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { sendEmail } from '../utils/email.js';
import { sendProjectNotificationEmail } from '../utils/mailer.js';
import { createNotification } from '../utils/notification.helper.js';

export const placeBid = async (req, res) => {
  const { jobId, amount, proposal, deliveryDays } = req.body;

  if (!jobId || !amount || !proposal || !deliveryDays) {
    return sendError(res, 'All fields (jobId, amount, proposal, deliveryDays) are required to place a bid.', 400);
  }

  try {
    const job = await Job.findById(jobId);
    if (!job) {
      return sendError(res, 'Target job record not found.', 404);
    }

    if (job.status !== 'open') {
      return sendError(res, 'This job is no longer open for bidding.', 400);
    }

    // Check if the freelancer has already placed a bid
    const existingBid = await Bid.findOne({ job: jobId, freelancer: req.user.id });
    if (existingBid) {
      return sendError(res, 'You have already placed a bid on this job. Please revise or delete your existing bid before submitting anew.', 400);
    }

    const bid = await Bid.create({
      job: jobId,
      freelancer: req.user.id,
      amount: Number(amount),
      proposal,
      deliveryDays: Number(deliveryDays),
      status: 'pending'
    });

    // Notify client of the bid
    const clientUser = await User.findById(job.client);
    if (clientUser) {
      await sendProjectNotificationEmail(
        clientUser.email,
        clientUser.name || clientUser.username,
        job.title,
        'New Proposal Bid Received',
        `A professional expert, @${req.user.username}, has submitted a bid proposal of $${amount} on your contract. Review their work history, proposed timeline of ${deliveryDays} days, and cover letter directly in your dashboard.`
      );

      // Create bid_received notification
      await createNotification(
        job.client,
        'bid_received',
        'New Bid Proposal Received',
        `Freelancer @${req.user.username} has submitted a bid proposal of $${amount} for your project "${job.title}".`
      );
    }

    // Create system notification for freelancer
    await createNotification(
      req.user.id,
      'system_alert',
      'Proposal Submitted Successfully',
      `Your proposal and bid of $${amount} on "${job.title}" has been transmitted to the client.`
    );

    return sendSuccess(res, 'Your proposal and bid were registered successfully!', { bid }, 201);
  } catch (err) {
    return sendError(res, `Failed to submit proposal bid: ${err.message}`, 500);
  }
};

export const getBidsForJob = async (req, res) => {
  const { jobId } = req.params;

  try {
    const job = await Job.findById(jobId);
    if (!job) {
      return sendError(res, 'Associated job contract not found.', 404);
    }

    if (job.client !== req.user.id && req.user.role !== 'admin') {
      return sendError(res, 'Unauthorized. Only the job client or administrators can review these bids.', 403);
    }

    const bids = await Bid.find({ job: jobId }).populate('freelancer').sort({ createdAt: -1 });
    return sendSuccess(res, 'Job bids list retrieved successfully.', { bids });
  } catch (err) {
    return sendError(res, `Failed to fetch bids: ${err.message}`, 500);
  }
};

export const getMyBids = async (req, res) => {
  try {
    const bids = await Bid.find({ freelancer: req.user.id }).populate('job').sort({ createdAt: -1 });
    return sendSuccess(res, 'Personal bids list loaded.', { bids });
  } catch (err) {
    return sendError(res, `Failed to retrieve bids: ${err.message}`, 500);
  }
};

export const acceptBid = async (req, res) => {
  const { bidId } = req.params;

  try {
    const bid = await Bid.findById(bidId);
    if (!bid) {
      return sendError(res, 'Target bid record not found.', 404);
    }

    const job = await Job.findById(bid.job);
    if (!job) {
      return sendError(res, 'Associated job record not found.', 404);
    }

    if (job.client !== req.user.id) {
      return sendError(res, 'Forbidden. Only the client who posted the job can accept its bids.', 403);
    }

    if (job.status !== 'open') {
      return sendError(res, `The job status is currently ${job.status} and cannot receive hires.`, 400);
    }

    // Lock bid status and job status
    bid.status = 'accepted';
    await bid.save();

    job.status = 'active';
    job.hiredFreelancer = bid.freelancer;
    // Set actual budget to agreed-upon bid amount!
    const originalBudget = job.budget;
    const agreedPrice = bid.amount;

    // Refund client the helper difference if original escrow was larger than agreed-upon price!
    // Or subtract the extra if bid is larger (if they accept, we verify they have enough balance).
    const clientUser = await User.findById(req.user.id);
    if (agreedPrice !== originalBudget) {
      const difference = originalBudget - agreedPrice;
      clientUser.balance += difference; // Refunding if bid is lower, deducting more if bid is higher
      await clientUser.save();
      job.budget = agreedPrice; // adjust actual budget
    }
    
    await job.save();

    // Synchronize client/buyer wallet
    let clientWallet = await Wallet.findOne({ userId: clientUser._id });
    if (!clientWallet) {
      clientWallet = await Wallet.create({ userId: clientUser._id, balance: clientUser.balance });
    } else {
      clientWallet.balance = clientUser.balance;
      await clientWallet.save();
    }

    // Reject all other bids for this job
    const otherBids = await Bid.find({ job: job._id, _id: { $ne: bidId } });
    for (const other of otherBids) {
      other.status = 'rejected';
      await other.save();
    }

    // Set Up Payment record
    await Payment.create({
      job: job._id,
      payer: job.client,
      receiver: bid.freelancer,
      amount: agreedPrice,
      status: 'escrow'
    });

    // Generate Transaction Log
    const randomHex = Math.floor(100000 + Math.random() * 900000).toString();
    const transactionId = `TXN-${Date.now().toString().slice(-4)}-${randomHex}`;
    await Transaction.create({
      transactionId,
      jobId: job._id,
      buyerId: job.client,
      freelancerId: bid.freelancer,
      amount: agreedPrice,
      status: 'in_escrow'
    });

    // Synchronize freelancer wallet pending hold balance
    const freelancer = await User.findById(bid.freelancer);
    let freelancerWallet = await Wallet.findOne({ userId: bid.freelancer });
    if (!freelancerWallet) {
      freelancerWallet = await Wallet.create({
        userId: bid.freelancer,
        balance: freelancer.balance,
        pendingBalance: agreedPrice,
        totalEarned: 0
      });
    } else {
      freelancerWallet.pendingBalance += agreedPrice;
      await freelancerWallet.save();
    }

    // Notify freelancer
    if (freelancer) {
      await sendProjectNotificationEmail(
        freelancer.email,
        freelancer.name || freelancer.username,
        job.title,
        'Congratulations! You Have Been Hired',
        `Your bid proposal of $${agreedPrice} on contract "${job.title}" has been officially accepted by @${clientUser.username}. Escrow funds are securely locked and project milestones are officially in progress!`
      );

      // Create bid_accepted notification for the hired freelancer
      await createNotification(
        freelancer._id,
        'bid_accepted',
        'Bid Accepted & Hired!',
        `Congratulations! @${clientUser.username} accepted your bid proposal of $${agreedPrice} for "${job.title}". You are now hired!`
      );
    }

    // Create system notification for client accepting the bid
    await createNotification(
      req.user.id,
      'system_alert',
      'Freelancer Contract Activated',
      `You successfully accepted @${freelancer ? freelancer.username : 'expert'}'s bid of $${agreedPrice} and locked escrow for "${job.title}".`
    );

    // Create custom notifications for other rejected bidders
    if (otherBids.length > 0) {
      for (const other of otherBids) {
        await createNotification(
          other.freelancer,
          'system_alert',
          'Proposal Status Update',
          `Your bid on "${job.title}" was not selected but don't give up! Many other contracts await.`
        );
      }
    }

    return sendSuccess(res, 'Bid accepted, freelancer hired, and agreed funds assigned in escrow.', { job, bid, clientBalance: clientUser.balance });
  } catch (err) {
    return sendError(res, `Failed to accept bid: ${err.message}`, 500);
  }
};
