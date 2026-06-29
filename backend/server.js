import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { connectDB } from './config/db.js';
import config from './config/dotenv.config.js';
import fs from 'fs';
import multer from 'multer';

// Model Imports for socket database integration
import Job from './models/Job.js';
import Bid from './models/Bid.js';
import Chat from './models/Chat.js';
import User from './models/User.js';
import { createNotification } from './utils/notification.helper.js';
import { sendMessageNotificationEmail } from './utils/mailer.js';

// Route Imports
import authRoutes from './auth/auth.routes.js';
import jobRoutes from './routes/job.routes.js';
import bidRoutes from './routes/bid.routes.js';
import chatRoutes from './routes/chat.routes.js';
import adminRoutes from './routes/admin.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import serviceRoutes from './routes/service.routes.js';
import messageRoutes from './routes/message.routes.js';
import rateLimiter from './middleware/rateLimit.middleware.js';
import csrfProtection from './middleware/csrf.middleware.js';

// Create express app and wrap in HTTP server
const app = express();
const server = createServer(app);
const PORT = config.port || 3000;

// Connect Database
connectDB();

// Body Parser Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Custom robust CORS & preflight middleware
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-auth-token, x-requested-with');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Apply Rate Limiting and CSRF Protection
app.use(rateLimiter({ max: 120, message: 'Too many requests. Please check your network or try again later.' }));
app.use(csrfProtection);

// REST API mounting
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/bids', bidRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/mock-payment', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/messages', messageRoutes);

// Ensure upload folder exists
const UPLOADS_DIR = path.join(process.cwd(), 'backend', 'data', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer Storage Configuration
const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage: uploadStorage });

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded.' });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({
    success: true,
    message: 'File uploaded successfully.',
    fileUrl,
    filename: req.file.originalname,
    size: req.file.size
  });
});

app.use('/uploads', express.static(UPLOADS_DIR));

// Sandbox Google Account Choose screen retired in favor of official OAuth
app.get('/auth/google-sandbox', (req, res) => {
  res.redirect('/login?error=sandbox_retired');
});

// Sandbox Facebook Account Choose screen retired in favor of official OAuth
app.get('/auth/facebook-sandbox', (req, res) => {
  res.redirect('/login?error=sandbox_retired');
});

// Static Asset files serving
app.use('/assets', express.static(path.join(process.cwd(), 'frontend', 'assets')));
app.use('/components', express.static(path.join(process.cwd(), 'frontend', 'components')));

// Routing map for elegant frontend views
const getPage = (fileName) => path.join(process.cwd(), 'frontend', 'pages', fileName);

// Server-side page route protection for authenticated user views
const userPageGuard = (req, res, next) => {
  return next();
};

// Server-side page route protection for administrator views
const adminPageGuard = (req, res, next) => {
  return next();
};

app.get('/', (req, res) => res.sendFile(getPage('index.html')));
app.get('/about', (req, res) => res.sendFile(getPage('about.html')));
app.get('/jobs', (req, res) => res.sendFile(getPage('jobs.html')));
app.get('/freelancers', (req, res) => res.sendFile(getPage('freelancers.html')));
app.get('/login', (req, res) => res.sendFile(getPage('login.html')));
app.get('/register', (req, res) => res.sendFile(getPage('register.html')));
app.get('/forgot-password', (req, res) => res.sendFile(getPage('forgot-password.html')));
app.get('/verify-otp', (req, res) => res.sendFile(getPage('verify-otp.html')));
app.get('/reset-password', (req, res) => res.sendFile(getPage('reset-password.html')));
app.get('/dashboard', userPageGuard, (req, res) => res.sendFile(getPage('dashboard.html')));
app.get('/chat', userPageGuard, (req, res) => res.sendFile(getPage('chat.html')));
app.get('/messages', userPageGuard, (req, res) => res.sendFile(getPage('chat.html')));
app.get('/admin', adminPageGuard, (req, res) => res.sendFile(getPage('admin.html')));
app.get('/admin/dashboard', adminPageGuard, (req, res) => res.sendFile(getPage('admin.html')));
app.get('/admin/users', adminPageGuard, (req, res) => res.sendFile(getPage('admin.html')));
app.get('/admin/jobs', adminPageGuard, (req, res) => res.sendFile(getPage('admin.html')));
app.get('/admin/gigs', adminPageGuard, (req, res) => res.sendFile(getPage('admin.html')));
app.get('/admin/settings', adminPageGuard, (req, res) => res.sendFile(getPage('admin.html')));
app.get('/admin/notifications', adminPageGuard, (req, res) => res.sendFile(getPage('admin.html')));
app.get('/wallet', userPageGuard, (req, res) => res.sendFile(getPage('wallet.html')));
app.get('/notifications', userPageGuard, (req, res) => res.sendFile(getPage('notifications.html')));
app.get('/support', (req, res) => res.sendFile(getPage('faq.html')));
app.get('/terms', (req, res) => res.sendFile(getPage('faq.html')));
app.get('/faq', (req, res) => res.sendFile(getPage('faq.html')));
app.get('/contact', (req, res) => res.sendFile(getPage('contact.html')));
app.get('/blogs', (req, res) => res.sendFile(getPage('blogs.html')));
app.get('/500', (req, res) => res.status(500).sendFile(getPage('500.html')));
app.get('/access-denied', (req, res) => res.status(403).sendFile(getPage('access-denied.html')));

// Fallback all unhandled frontend navigations to 404 Page
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'API Endpoint not found.' });
  }
  res.status(404).sendFile(getPage('404.html'));
});

// ==========================================
// SOCKET.IO REAL-TIME INTEGRATION
// ==========================================
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Save to global scope to allow triggering real-time system notifications
global.io = io;

// Guard WebSocket connections with JWT authentication
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) {
    console.log(`[WS Authentication Error] Token is missing from handshake`);
    return next(new Error('Access denied. Security session token is missing.'));
  }
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    socket.user = decoded; // Holds property: id, name, username, email, role
    next();
  } catch (err) {
    console.log(`[WS Authentication Error] Invalid token provided: ${err.message}`);
    return next(new Error('Access denied. Security session token is invalid or expired.'));
  }
});

// Keep track of online users mapping (UserId -> Set of SocketIds)
const onlineUsers = new Map();

io.on('connection', (socket) => {
  const userId = socket.user.id;
  console.log(`🟢 User connected: @${socket.user.username} (${userId}) | SF: ${socket.id}`);

  // Register user as online
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }
  onlineUsers.get(userId).add(socket.id);

  // Join a private, multi-tab user room for standard push notifications
  socket.join(`user:${userId}`);

  // Broadcast current online users array to update indicators
  io.emit('onlineUsersList', Array.from(onlineUsers.keys()));

  // 1. joinRoom event
  socket.on('joinRoom', ({ chatId }) => {
    if (!chatId) return;
    socket.join(chatId);
    console.log(`🛡️  Socket ${socket.id} joined ChatRoom: ${chatId}`);
  });

  // 2. sendMessage event
  socket.on('sendMessage', async (data) => {
    const { chatId, jobId, message, receiverId, fileUrl, fileName, fileSize } = data;
    const senderId = socket.user.id;

    let finalMessage = message ? message.trim() : '';
    if (fileUrl && !finalMessage) {
      finalMessage = `Shared a file: ${fileName || 'Attachment'}`;
    }

    if (!finalMessage && !fileUrl) return;

    try {
      const keyJobId = (jobId && jobId !== 'general' && jobId !== 'direct') ? jobId : 'direct';
      let solvedReceiverId = receiverId;

      if (keyJobId !== 'direct') {
        // Find the associated job
        const job = await Job.findById(keyJobId);
        if (!job) return;

        // Double-check permission
        let isAuthorized = false;
        if (socket.user.role === 'admin') {
          isAuthorized = true;
        } else if (job.client === senderId) {
          isAuthorized = true;
        } else if (job.hiredFreelancer === senderId) {
          isAuthorized = true;
        } else {
          const hasBid = await Bid.findOne({ job: keyJobId, freelancer: senderId });
          if (hasBid) {
            isAuthorized = true;
          }
        }

        if (!isAuthorized) {
          return socket.emit('errorMsg', 'Permission denied. You cannot message in this room.');
        }

        // Resolve final receiver ID
        if (!solvedReceiverId) {
          solvedReceiverId = (senderId === job.client) ? job.hiredFreelancer : job.client;
        }
      }

      if (!solvedReceiverId) return;

      // Generate symmetrical chatId: sorted user IDs
      const sorted = [senderId.toString(), solvedReceiverId.toString()].sort();
      const finalChatId = `${keyJobId}_${sorted[0]}_${sorted[1]}`;

      // Save message to MongoDB
      const savedChat = await Chat.create({
        chatId: finalChatId,
        jobId: keyJobId,
        senderId,
        receiverId: solvedReceiverId,
        sender: senderId,       // Legacy compat
        receiver: solvedReceiverId, // Legacy compat
        message: finalMessage,
        fileUrl: fileUrl || '',
        fileName: fileName || '',
        fileSize: fileSize || 0,
        timestamp: new Date(),
        isRead: false
      });

      console.log(`💬 [Message Created - WS] ID: "${savedChat._id}" on Thread: "${finalChatId}". Content: "${finalMessage}"`);

      const messagePayload = {
        _id: savedChat._id,
        chatId: finalChatId,
        jobId: keyJobId,
        senderId,
        receiverId: solvedReceiverId,
        sender: senderId,
        receiver: solvedReceiverId,
        message: finalMessage,
        fileUrl: fileUrl || '',
        fileName: fileName || '',
        fileSize: fileSize || 0,
        timestamp: savedChat.timestamp,
        createdAt: savedChat.createdAt
      };

      // Broadcast back to the room of finalChatId (and any custom room the client requested)
      io.to(finalChatId).emit('receiveMessage', messagePayload);
      if (chatId && chatId !== finalChatId) {
        io.to(chatId).emit('receiveMessage', messagePayload);
      }
      console.log(`✉️  [Room ${finalChatId}] Broadcasted message from @${socket.user.username}`);

      // Create message_received notification for the recipient
      await createNotification(
        solvedReceiverId,
        'message_received',
        'New Message Received',
        `@${socket.user.username} sent you a message: "${finalMessage.slice(0, 60)}${finalMessage.length > 60 ? '...' : ''}"`
      );
      console.log(`🔔 [Notification Created - WS] Type: "message_received" for Recipient: "${solvedReceiverId}"`);

      // Retrieve recipient details and dispatch a notification email
      try {
        const recipientUser = await User.findById(solvedReceiverId);
        if (recipientUser && recipientUser.email) {
          await sendMessageNotificationEmail(
            recipientUser.email,
            recipientUser.name || recipientUser.username,
            socket.user.username,
            finalMessage.slice(0, 150)
          );
          console.log(`📬 [Email Dispatched - WS] Sent message notification to: ${recipientUser.email}`);
        }
      } catch (err) {
        console.error('Failed to send email message notification via socket:', err);
      }

    } catch (err) {
      console.error('Error handling WebSocket sendMessage: ', err);
    }
  });

  // 2b. markAsRead event
  socket.on('markAsRead', async ({ chatId }) => {
    if (!chatId) return;
    try {
      const currentUserId = socket.user.id;
      await Chat.updateMany(
        { chatId, receiverId: currentUserId, isRead: false },
        { $set: { isRead: true } }
      );
      // Notify other user in thread that messages are read
      socket.to(chatId).emit('messagesRead', { chatId, readerId: currentUserId });
    } catch (err) {
      console.error('Error marking messages as read via socket:', err);
    }
  });

  // 3. typing event
  socket.on('typing', ({ chatId, isTyping }) => {
    if (!chatId) return;
    socket.to(chatId).emit('typing', {
      userId: socket.user.id,
      username: socket.user.username,
      isTyping
    });
  });

  // 4. disconnect event
  socket.on('disconnect', () => {
    console.log(`🔴 User disconnected: @${socket.user.username} (${userId}) | SF: ${socket.id}`);
    
    // Remove socket from user record
    if (onlineUsers.has(userId)) {
      const socketSet = onlineUsers.get(userId);
      socketSet.delete(socket.id);
      if (socketSet.size === 0) {
        onlineUsers.delete(userId);
      }
    }

    // Broadcast updated online list
    io.emit('onlineUsersList', Array.from(onlineUsers.keys()));
  });
});

// Listener bound to server wrapper
server.listen(PORT, '0.0.0.0', () => {
  console.log(`======================================================`);
  console.log(`🚀 Farelanceru Platform live on: http://localhost:${PORT}`);
  console.log(`======================================================`);
});
