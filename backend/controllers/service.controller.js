import Service from '../models/Service.js';
import User from '../models/User.js';
import Job from '../models/Job.js';
import Payment from '../models/Payment.js';
import Transaction from '../models/Transaction.js';
import Wallet from '../models/Wallet.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { createNotification } from '../utils/notification.helper.js';

// Create a new Service (Freelancer Gig)
export const createService = async (req, res) => {
  const { title, description, price, deliveryTime, category, tags, imageUrl } = req.body;

  if (!title || !description || !price || !deliveryTime) {
    return sendError(res, 'Title, description, price, and delivery time are required.', 400);
  }

  try {
    const parsedTags = Array.isArray(tags)
      ? tags
      : (typeof tags === 'string' ? tags.split(',').map(t => t.trim()).filter(Boolean) : []);

    const service = await Service.create({
      owner: req.user.id,
      title,
      description,
      price: Number(price),
      deliveryTime: Number(deliveryTime),
      category: category || 'Development & IT',
      tags: parsedTags,
      imageUrl: imageUrl || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80'
    });

    await createNotification(
      req.user.id,
      'service_created',
      'Service Active',
      `Your service "${title}" has been successfully published to Farelancer!`
    );

    sendSuccess(res, 'Service published successfully.', service, 201);
  } catch (error) {
    console.error('Error in createService:', error);
    sendError(res, 'Internal server error while publishing service.', 500);
  }
};

// Search & Browse Services (Gigs)
export const getServices = async (req, res) => {
  const { search, category, minBudget, maxBudget, maxDelivery } = req.query;

  try {
    const query = {};

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }

    if (category && category !== 'All Categories' && category !== 'All') {
      query.category = category;
    }

    if (minBudget || maxBudget) {
      query.price = {};
      if (minBudget) query.price.$gte = Number(minBudget);
      if (maxBudget) query.price.$lte = Number(maxBudget);
    }

    if (maxDelivery) {
      query.deliveryTime = { $lte: Number(maxDelivery) };
    }

    const services = await Service.find(query)
      .populate('owner', 'name username profile rating completedCount')
      .sort({ createdAt: -1 });

    sendSuccess(res, 'Services fetched successfully.', services);
  } catch (error) {
    console.error('Error in getServices:', error);
    sendError(res, 'Internal server error while fetching services.', 500);
  }
};

// Get Single Service Details
export const getServiceById = async (req, res) => {
  const { id } = req.params;

  try {
    const service = await Service.findById(id).populate('owner', 'name username profile rating completedCount email portfolio reviews');
    if (!service) {
      return sendError(res, 'Service not found.', 404);
    }
    sendSuccess(res, 'Service details fetched.', service);
  } catch (error) {
    console.error('Error in getServiceById:', error);
    sendError(res, 'Internal server error.', 500);
  }
};

// Update Service
export const updateService = async (req, res) => {
  const { id } = req.params;
  const { title, description, price, deliveryTime, category, tags, imageUrl } = req.body;

  try {
    const service = await Service.findById(id);
    if (!service) {
      return sendError(res, 'Service not found.', 404);
    }

    if (service.owner !== req.user.id && req.user.role !== 'admin') {
      return sendError(res, 'Unauthorized action.', 403);
    }

    if (title) service.title = title;
    if (description) service.description = description;
    if (price) service.price = Number(price);
    if (deliveryTime) service.deliveryTime = Number(deliveryTime);
    if (category) service.category = category;
    if (imageUrl) service.imageUrl = imageUrl;
    if (tags) {
      service.tags = Array.isArray(tags)
        ? tags
        : (typeof tags === 'string' ? tags.split(',').map(t => t.trim()).filter(Boolean) : []);
    }

    await service.save();
    sendSuccess(res, 'Service updated successfully.', service);
  } catch (error) {
    console.error('Error in updateService:', error);
    sendError(res, 'Internal server error.', 500);
  }
};

// Delete Service
export const deleteService = async (req, res) => {
  const { id } = req.params;

  try {
    const service = await Service.findById(id);
    if (!service) {
      return sendError(res, 'Service not found.', 404);
    }

    if (service.owner !== req.user.id && req.user.role !== 'admin') {
      return sendError(res, 'Unauthorized action.', 403);
    }

    await Service.deleteOne({ _id: id });
    sendSuccess(res, 'Service removed successfully.');
  } catch (error) {
    console.error('Error in deleteService:', error);
    sendError(res, 'Internal server error.', 500);
  }
};

// Order / Buy Service (Instant Escrow Booking)
export const buyService = async (req, res) => {
  const { id } = req.params;
  const { requirements } = req.body; // Requirements text for the freelancer

  try {
    const service = await Service.findById(id).populate('owner');
    if (!service) {
      return sendError(res, 'Service not found.', 404);
    }

    if (service.owner._id.toString() === req.user.id) {
      return sendError(res, 'You cannot buy your own service.', 400);
    }

    const buyer = await User.findById(req.user.id);
    if (!buyer) {
      return sendError(res, 'Buyer account not found.', 444);
    }

    if (buyer.balance < service.price) {
      return sendError(res, `Insufficient wallet balance. This service costs $${service.price}, but your balance is $${buyer.balance}. Please deposit simulation funds.`, 400);
    }

    // 1. Escrow funds instantly from buyer's account
    buyer.balance -= service.price;
    await buyer.save();

    // 2. Create Job contract representing the Service Order
    const jobOrder = await Job.create({
      title: `Service Order: ${service.title}`,
      description: `Instant contract created for service "${service.title}".\n\n**Buyer Requirements**:\n${requirements || 'No custom requirements specified by client.'}`,
      budget: service.price,
      category: service.category,
      deadline: `${service.deliveryTime} days`,
      client: req.user.id,
      hiredFreelancer: service.owner._id.toString(),
      status: 'active', // Live / In Progress directly!
      deliverables: 'Please deliver the work as requested by the service specification.'
    });

    // 3. Set up Escrow Payment
    await Payment.create({
      job: jobOrder._id,
      payer: req.user.id,
      receiver: service.owner._id.toString(),
      amount: service.price,
      status: 'escrow'
    });

    // 4. Generate Transaction Log
    const randomHex = Math.floor(100000 + Math.random() * 900000).toString();
    const transactionId = `TXN-${Date.now().toString().slice(-4)}-${randomHex}`;
    await Transaction.create({
      transactionId,
      jobId: jobOrder._id,
      buyerId: req.user.id,
      freelancerId: service.owner._id.toString(),
      amount: service.price,
      status: 'in_escrow'
    });

    // 5. Increment Service Sales Metrics
    service.salesCount += 1;
    await service.save();

    // 6. Create Mutual Notifications
    await createNotification(
      req.user.id,
      'service_ordered',
      'Service Ordered',
      `You ordered "${service.title}" from ${service.owner.name}. $${service.price} is locked in secure Escrow.`
    );

    await createNotification(
      service.owner._id.toString(),
      'service_booked',
      'New Service Booking!',
      `Great news! ${buyer.name} ordered your gig: "${service.title}". Direct contract created & $${service.price} held in escrow.`
    );

    sendSuccess(res, 'Service ordered successfully! Project contract is active on your dashboard.', {
      jobId: jobOrder._id,
      price: service.price
    });
  } catch (error) {
    console.error('Error in buyService:', error);
    sendError(res, 'Internal server error while ordering service.', 500);
  }
};
