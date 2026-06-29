/**
 * Farelanceru Frontend Real-Time Chat System Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Guard logged-in session context
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');

  if (!token || !userStr) {
    const chatContainer = document.getElementById('chat-channels-container');
    if (chatContainer) {
      chatContainer.innerHTML = `
        <div style="grid-column: span 12; text-align: center; padding: 80px 20px; background: white; border-radius: 12px; max-width: 600px; margin: 40px auto; box-shadow: var(--shadow);">
          <div style="width: 64px; height: 64px; border-radius: 50%; background: rgba(79, 70, 229, 0.1); color: var(--primary); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto;">
            <i class="fa-solid fa-triangle-exclamation" style="font-size: 32px;"></i>
          </div>
          <h2 style="margin-bottom: 12px; font-weight: 800; font-size: 22px;">Secure Messaging</h2>
          <p style="color: var(--gray-600); margin-bottom: 24px; font-size: 14px;">Sign in to check your workspace chats, coordinate jobs with active freelancers, or review deliverables.</p>
          <a href="/login" class="btn btn-primary" style="padding: 12px 30px; font-weight: 700;">Sign In to Account</a>
        </div>
      `;
    }
    return;
  }

  let currentUser = {};
  try {
    currentUser = JSON.parse(userStr);
  } catch (e) {
    console.error('Core user parsing failed', e);
  }

  // Visual layout query components
  const contactsList = document.getElementById('chat-contacts-list');
  const messagesBox = document.getElementById('chat-messages-scroll');
  const chatTitle = document.getElementById('chat-partner-name');
  const chatRoomInfo = document.getElementById('chat-room-info');
  const partnerStatusDot = document.getElementById('partner-status-dot');
  const chatForm = document.getElementById('chat-send-form');
  const messageInput = document.getElementById('chat-message-input');
  const typingIndicator = document.getElementById('typing-indicator');

  // Multi-room state configuration
  let activeChatId = null;
  let activeJobId = null;
  let activeReceiverId = null;
  let onlineUserIds = [];
  let socket = null;
  let typingTimeout = null;
  let currentAttachment = null;

  // Read URL query params: "/chat?chatWith=RECEIVER_ID&jobId=JOB_ID"
  const urlParams = new URLSearchParams(window.location.search);
  const queryChatWith = urlParams.get('chatWith') || urlParams.get('receiverId') || urlParams.get('userId');
  const queryJobId = urlParams.get('jobId');

  // ==========================================
  // SOCKET.IO REAL-TIME CONNECTIVITY
  // ==========================================
  function initializeSocket() {
    // Standard secure connection passing JWT inside handshake
    socket = io({
      auth: {
        token: token
      }
    });

    socket.on('connect', () => {
      console.log('🔌 Secure WebSocket Connection established successfully!');
    });

    // Handle online statuses updates
    socket.on('onlineUsersList', (userIds) => {
      onlineUserIds = userIds;
      updateOnlineStatusIndicators();
    });

    // Receive message real-time handler
    socket.on('receiveMessage', (chat) => {
      if (chat.chatId === activeChatId) {
        appendMessageBubble(chat);
        scrollToNewestMessages();
      }
      // Re-fetch inbox so that left panels display the newest snippets and sorts properly
      loadInbox();
      // Sync top bell badge
      if (typeof window.loadNavbarBellList === 'function') {
        window.loadNavbarBellList();
      }
    });

    // Real-time typing indicators
    socket.on('typing', ({ userId, username, isTyping }) => {
      if (userId === activeReceiverId && isTyping && typingIndicator) {
        typingIndicator.textContent = `${username} is typing...`;
        typingIndicator.style.display = 'block';
      } else if (userId === activeReceiverId && typingIndicator) {
        typingIndicator.style.display = 'none';
      }
    });

    // Handle read receipt updates in real-time
    socket.on('messagesRead', ({ chatId }) => {
      if (chatId === activeChatId) {
        document.querySelectorAll('.message-status-tick').forEach(el => {
          el.innerHTML = '<i class="fa-solid fa-check-double" style="color: #3b82f6; font-size: 11px;"></i>';
        });
      }
    });

    socket.on('errorMsg', (errStr) => {
      if (typeof showToast === 'function') {
        showToast(errStr, 'error');
      } else {
        alert(errStr);
      }
    });

    socket.on('disconnect1', () => {
      console.log('❌ Socket disconnected.');
    });
  }

  // ==========================================
  // VIEW RENDERERS & DATA FETCHING
  // ==========================================

  // Populate active inbox from Database (GET /api/chat/inbox)
  async function loadInbox() {
    if (!contactsList) return;
    try {
      const res = await fetch('/api/chat/inbox', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();

      if (result.success && result.data.inbox) {
        let inbox = result.data.inbox;

        // If query parameters define a new conversation not yet in the database, fetch and prepend as manual draft
        if (queryChatWith && !inbox.some(item => item.otherUser.id === queryChatWith && (queryJobId ? item.job.id === queryJobId : true))) {
          const draftItem = await createDraftInboxItem(queryChatWith, queryJobId);
          if (draftItem) {
            inbox.unshift(draftItem);
          }
        }

        if (inbox.length === 0) {
          contactsList.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--gray-600); font-size: 13px;">
              <i class="fa-solid fa-comments" style="font-size: 32px; margin: 0 auto 12px auto; opacity: 0.5; display: block;"></i>
              <p style="font-weight: 500; margin: 0;">No active threads.</p>
              <span style="font-size: 11px; color: var(--gray-500);">Coordinate on jobs to trigger conversation escrow templates!</span>
            </div>
          `;
          return;
        }

        // Generate and render inbox HTML list (Fiverr-Style UI)
        contactsList.innerHTML = inbox.map(item => {
          const counterparty = item.otherUser;
          const counterpartRole = counterparty.role.toUpperCase();
          const initials = (counterparty.name || counterparty.username).substring(0, 2).toUpperCase();
          const jobTitle = item.job ? item.job.title : 'Direct Conversation';
          const latestText = item.lastMessage ? item.lastMessage.text : 'Click to send first message...';
          const isSenderMe = item.lastMessage && item.lastMessage.senderId === currentUser._id;
          const displayMsg = isSenderMe ? `You: ${latestText}` : latestText;

          // Compute formatting timestamps
          let dateStr = '';
          if (item.lastMessage?.timestamp) {
            const date = new Date(item.lastMessage.timestamp);
            const today = new Date();
            if (date.toDateString() === today.toDateString()) {
              dateStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else {
              dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
            }
          }

          const isActive = (item.chatId === activeChatId) ? 'background-color: var(--gray-100); border-left: 4px solid var(--primary);' : '';
          const isOnline = onlineUserIds.includes(counterparty.id);
          const dotColor = isOnline ? '#10b981' : '#cbd5e1';

          const unreadBadge = item.unreadCount > 0 
            ? `<span style="background-color: #ef4444; color: white; border-radius: 9999px; font-size: 10px; font-weight: 700; padding: 2px 6px; min-width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 1px 2px rgba(0,0,0,0.1); margin-top: 4px;">${item.unreadCount}</span>` 
            : '';

          return `
            <div class="chat-inbox-item" 
                 data-chat-id="${item.chatId}" 
                 data-job-id="${item.job?.id || 'general'}"
                 data-job-title="${jobTitle}"
                 data-job-budget="${item.job?.budget || 'open'}"
                 data-receiver-id="${counterparty.id}"
                 data-username="${counterparty.username}"
                 data-name="${counterparty.name}"
                 data-role="${counterparty.role}"
                 style="display: flex; gap: 12px; padding: 15px 20px; border-bottom: 1px solid var(--gray-100); cursor: pointer; transition: all 0.2s ease; ${isActive}">
              
              <!-- Avatar Stack with Live Indicator Dot -->
              <div style="position: relative; flex-shrink: 0;">
                <div style="width: 44px; height: 44px; border-radius: 50%; background: var(--gradient); color: white; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 700; box-shadow: var(--shadow-sm);">
                  ${initials}
                </div>
                <div class="avatar-status-dot" data-user-id="${counterparty.id}" 
                     style="position: absolute; bottom: 0; right: 0; width: 11px; height: 11px; border-radius: 50%; background-color: ${dotColor}; border: 2px solid white; transition: background-color 0.3s ease;">
                </div>
              </div>

              <!-- Message Text Block -->
              <div style="flex-grow: 1; min-width: 0;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px;">
                  <h4 style="font-size: 14px; font-weight: 700; color: var(--dark); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px;">
                    ${counterparty.name || '@' + counterparty.username}
                  </h4>
                  <div style="display: flex; flex-direction: column; align-items: flex-end;">
                    <span style="font-size: 10px; color: var(--gray-500);">${dateStr}</span>
                    ${unreadBadge}
                  </div>
                </div>
                
                <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; margin: 0 0 3px 0; color: var(--primary);">
                  ${counterpartRole}
                </p>

                <p style="font-size: 11px; font-weight: 700; color: var(--gray-700); margin: 0 0 2px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  💼 ${jobTitle}
                </p>

                <p style="font-size: 12px; color: var(--gray-600); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${displayMsg}
                </p>
              </div>

            </div>
          `;
        }).join('');

        // Sum and update the unread count header badge
        const unreadBadgeEl = document.getElementById('inbox-unread-badge');
        if (unreadBadgeEl) {
          const totalUnread = inbox.reduce((total, item) => total + (item.unreadCount || 0), 0);
          if (totalUnread > 0) {
            unreadBadgeEl.textContent = totalUnread;
            unreadBadgeEl.style.display = 'inline-block';
          } else {
            unreadBadgeEl.style.display = 'none';
          }
        }

        // Attach click listeners to inbox threads
        document.querySelectorAll('.chat-inbox-item').forEach(item => {
          item.addEventListener('click', () => {
            selectConversation({
              chatId: item.dataset.chatId,
              jobId: item.dataset.jobId,
              jobTitle: item.dataset.jobTitle,
              jobBudget: item.dataset.jobBudget,
              receiverId: item.dataset.receiverId,
              username: item.dataset.username,
              name: item.dataset.name,
              role: item.dataset.role
            });
          });
        });

        // Auto select thread if specified in URL or default to the first thread
        if (queryChatWith) {
          const matchingItem = Array.from(document.querySelectorAll('.chat-inbox-item')).find(el => {
            return el.dataset.receiverId === queryChatWith && (queryJobId ? el.dataset.jobId === queryJobId : true);
          });
          if (matchingItem) {
            matchingItem.click();
          }
        } else if (!activeChatId && inbox.length > 0) {
          // Default to clicking the very first element
          document.querySelector('.chat-inbox-item').click();
        }

        // Trigger reactive DOT matching
        updateOnlineStatusIndicators();
      }
    } catch (err) {
      console.error('Core inbox sync failed: ', err);
    }
  }

  // Pre-selected conversation draft logic for seamless clicks (Fiverr-smooth UX)
  async function createDraftInboxItem(userId, jobId) {
    try {
      // 1. Fetch user profile
      const userRes = await fetch(`/api/auth/user/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const userResult = await userRes.json();
      if (!userResult.success) return null;

      let job = null;
      if (jobId && jobId !== 'general') {
        const jobRes = await fetch(`/api/jobs/info/${jobId}`);
        const jobResult = await jobRes.json();
        if (jobResult.success) {
          job = {
            id: jobResult.data._id,
            title: jobResult.data.title,
            budget: jobResult.data.budget,
            status: jobResult.data.status
          };
        }
      }

      const counterparty = userResult.data.user;
      const buyerId = (counterparty.role === 'buyer') ? counterparty._id : currentUser._id;
      const freelancerId = (counterparty.role === 'freelancer') ? counterparty._id : currentUser._id;
      const generatedChatId = `${jobId || 'general'}_${buyerId}_${freelancerId}`;

      return {
        chatId: generatedChatId,
        job: job || { id: 'general', title: 'Direct Discussion', status: 'active' },
        otherUser: {
          id: counterparty._id,
          username: counterparty.username,
          name: counterparty.name || counterparty.username,
          role: counterparty.role,
          avatarUrl: counterparty.profile?.avatar || '',
          status: counterparty.status
        },
        lastMessage: null
      };

    } catch (err) {
      console.error('Error prepopulating preselected chat draft', err);
      return null;
    }
  }

  // Choose, Join and Activate a Conversation Thread
  function selectConversation(config) {
    activeChatId = config.chatId;
    activeJobId = config.jobId;
    activeReceiverId = config.receiverId;

    // Join room instantly via Sockets
    socket.emit('joinRoom', { chatId: activeChatId });
    socket.emit('markAsRead', { chatId: activeChatId });

    // Update Top Recipient Info Panel
    if (chatTitle) {
      chatTitle.textContent = `${config.name || '@' + config.username}`;
    }
    if (chatRoomInfo) {
      const budgetText = config.jobBudget && config.jobBudget !== 'open' ? `$${config.jobBudget}` : 'N/A';
      chatRoomInfo.textContent = `Role: ${config.role.toUpperCase()} | Job: ${config.jobTitle || 'Direct Message'} (Est. ${budgetText})`;
    }

    // Highlight selected side panel and clear non-selected highlights
    document.querySelectorAll('.chat-inbox-item').forEach(el => {
      el.removeAttribute('style');
      if (el.dataset.chatId === activeChatId) {
        el.setAttribute('style', 'display: flex; gap: 12px; padding: 15px 20px; border-bottom: 1px solid var(--gray-100); cursor: pointer; background-color: var(--gray-100); border-left: 4px solid var(--primary);');
      } else {
        el.setAttribute('style', 'display: flex; gap: 12px; padding: 15px 20px; border-bottom: 1px solid var(--gray-100); cursor: pointer; transition: all 0.2s ease;');
      }
    });

    // Populate Messages History Block
    fetchMessageHistory(config.jobId, config.receiverId);
    
    // Clear typing status on navigation
    if (typingIndicator) {
      typingIndicator.style.display = 'none';
    }

    // Advanced Mobile Layout Toggling (Ensures responsive viewport coverage on widths <= 768px)
    if (window.innerWidth <= 768) {
      const sidebar = document.querySelector('.chat-sidebar');
      const viewport = document.querySelector('.chat-conversations-viewport');
      if (sidebar) sidebar.style.setProperty('display', 'none', 'important');
      if (viewport) viewport.style.setProperty('display', 'flex', 'important');

      let backBtn = document.getElementById('chat-mobile-back');
      if (!backBtn) {
        backBtn = document.createElement('button');
        backBtn.id = 'chat-mobile-back';
        backBtn.className = 'btn btn-secondary';
        backBtn.innerHTML = '<i class="fa-solid fa-arrow-left"></i>';
        backBtn.style.cssText = 'display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; min-width: 34px; padding: 0; border-radius: 50%; border: 1px solid var(--gray-200); background: white; margin-right: 12px; cursor: pointer; transition: background 0.2s;';
        
        backBtn.addEventListener('click', () => {
          activeChatId = null; // Clear active state
          if (sidebar) sidebar.style.setProperty('display', 'flex', 'important');
          if (viewport) viewport.style.setProperty('display', 'none', 'important');
          
          // Reset highlights in sidebar
          document.querySelectorAll('.chat-inbox-item').forEach(el => {
            el.removeAttribute('style');
            el.setAttribute('style', 'display: flex; gap: 12px; padding: 15px 20px; border-bottom: 1px solid var(--gray-100); cursor: pointer; transition: all 0.2s ease;');
          });
        });

        const partnerWrap = document.querySelector('.chat-conversations-viewport > div');
        if (partnerWrap) {
          const innerFlex = partnerWrap.querySelector('div');
          if (innerFlex) {
            innerFlex.insertBefore(backBtn, innerFlex.firstChild);
          }
        }
      } else {
        backBtn.style.display = 'inline-flex';
      }
    }
  }

  // Helper to render message text and attachments nicely
  function renderMessageContent(chat, isSenderMe) {
    let fileHtml = '';
    if (chat.fileUrl) {
      const isImg = /\.(jpg|jpeg|png|gif|webp)$/i.test(chat.fileUrl);
      if (isImg) {
        fileHtml = `
          <img src="${chat.fileUrl}" referrerPolicy="no-referrer" style="max-width: 100%; max-height: 220px; border-radius: 8px; display: block; margin-bottom: 8px; cursor: pointer; object-fit: contain; background: rgba(0,0,0,0.03);" onclick="window.open('${chat.fileUrl}')">
        `;
      } else {
        const sizeText = chat.fileSize ? `${(chat.fileSize / 1024).toFixed(1)} KB` : 'Attachment';
        const linkColor = isSenderMe ? 'color: white; background: rgba(255,255,255,0.15);' : 'color: var(--dark); background: rgba(0,0,0,0.05);';
        fileHtml = `
          <a href="${chat.fileUrl}" target="_blank" download="${chat.fileName || 'file'}" 
             style="display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-bottom: 8px; font-size: 13px; max-width: 280px; min-width: 180px; transition: opacity 0.2s; ${linkColor}"
             onmouseover="this.style.opacity=0.8" onmouseout="this.style.opacity=1">
            <i class="fa-solid fa-file-arrow-down" style="font-size: 20px;"></i>
            <div style="min-width: 0; flex-grow: 1;">
              <p style="margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${chat.fileName || 'Download File'}</p>
              <p style="margin: 0; font-size: 10px; opacity: 0.8; font-weight: normal;">${sizeText}</p>
            </div>
          </a>
        `;
      }
    }

    const textHtml = chat.message && chat.message.trim() !== '' ? `<div>${chat.message}</div>` : '';
    return fileHtml + textHtml;
  }

  // Load chat messages list from Backend
  async function fetchMessageHistory(jobId, withUserId) {
    if (!messagesBox) return;

    messagesBox.innerHTML = `
      <div style="text-align: center; padding: 60px 0; color: var(--gray-500);">
        <div style="border: 3px solid #f3f3f3; border-top: 3px solid var(--primary); border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; margin: 0 auto 10px auto;"></div>
        <span style="font-size: 13px;">Retrieving messaging ledger...</span>
      </div>
      <style>
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      </style>
    `;

    try {
      let endpoint = `/api/chat/${jobId}?withUserId=${withUserId}`;
      let fallbackUsingDirect = false;

      // Fallback to legacy/direct conversation endpoint if jobId is null or 'general'
      if (!jobId || jobId === 'general' || jobId === null) {
        endpoint = `/api/chat/history/${withUserId}`;
        fallbackUsingDirect = true;
      }

      const res = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();

      if (result.success) {
        const chats = fallbackUsingDirect ? result.data.chats : result.data.chats;
        
        if (!chats || chats.length === 0) {
          messagesBox.innerHTML = `
            <div style="text-align: center; padding: 80px 20px; color: var(--gray-600);">
              <i class="fa-solid fa-handshake" style="font-size: 40px; margin: 0 auto 12px auto; opacity: 0.6; color: var(--primary); display: block;"></i>
              <p style="font-size: 16px; font-weight: 700; margin-bottom: 4px;">Secure Project Chat Channel Active</p>
              <p style="font-size: 13px; max-width: 320px; margin: 0 auto;">Review bids, milestones and delivery logs here safely. Type your greeting message below to kickstart!</p>
            </div>
          `;
          return;
        }

        // Render conversation log loops
        messagesBox.innerHTML = chats.map(chat => {
          const sender = chat.senderId || chat.sender;
          const isSenderMe = sender === currentUser._id;

          const wrapperStyle = isSenderMe 
            ? 'display: flex; flex-direction: column; align-items: flex-end; margin-bottom: 15px;' 
            : 'display: flex; flex-direction: column; align-items: flex-start; margin-bottom: 15px;';
            
          const msgStyle = isSenderMe 
            ? 'background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; border-bottom-right-radius: 4px;' 
            : 'background-color: var(--gray-100); color: var(--dark); border-bottom-left-radius: 4px; border: 1px solid var(--gray-200);';

          let stamp = '';
          const msgTime = chat.timestamp || chat.createdAt;
          if (msgTime) {
            stamp = new Date(msgTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          }

          let ticks = '';
          if (isSenderMe) {
            const tickIcon = chat.isRead 
              ? '<i class="fa-solid fa-check-double" style="color: #3b82f6; font-size: 11px;"></i>' 
              : '<i class="fa-solid fa-check" style="color: #9ca3af; font-size: 11px;"></i>';
            ticks = `<span class="message-status-tick" style="margin-left: 4px;">${tickIcon}</span>`;
          }

          return `
            <div class="chat-message-bubble-wrapper animate-message" style="${wrapperStyle}">
              <div style="padding: 10px 16px; border-radius: 14px; max-width: 70%; font-size: 14px; line-height: 1.4; box-shadow: var(--shadow-sm); word-break: break-word; font-weight: 500; ${msgStyle}">
                ${renderMessageContent(chat, isSenderMe)}
              </div>
              <span style="font-size: 10px; color: var(--gray-500); margin-top: 4px; padding: 0 6px; display: flex; align-items: center; gap: 4px;">
                ${stamp} ${ticks}
              </span>
            </div>
          `;
        }).join('');

        scrollToNewestMessages();
      }

    } catch (err) {
      console.error('Failed fetching messages history log: ', err);
    }
  }

  // Appends individual messages on live emit broadcasts
  function appendMessageBubble(chat) {
    if (!messagesBox) return;

    // Remove placeholder empty state if present
    const emptyState = messagesBox.querySelector('.fa-handshake');
    if (emptyState || messagesBox.innerHTML.includes('Secure Project Chat Channel Active')) {
      messagesBox.innerHTML = '';
    }

    const sender = chat.senderId || chat.sender;
    const isSenderMe = sender === currentUser._id;

    // Trigger read sync if receiving message in active room
    if (!isSenderMe && activeChatId === chat.chatId) {
      socket.emit('markAsRead', { chatId: activeChatId });
    }

    const wrapperStyle = isSenderMe 
      ? 'display: flex; flex-direction: column; align-items: flex-end; margin-bottom: 15px;' 
      : 'display: flex; flex-direction: column; align-items: flex-start; margin-bottom: 15px;';
      
    const msgStyle = isSenderMe 
      ? 'background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; border-bottom-right-radius: 4px;' 
      : 'background-color: var(--gray-100); color: var(--dark); border-bottom-left-radius: 4px; border: 1px solid var(--gray-200);';

    let stamp = '';
    const msgTime = chat.timestamp || chat.createdAt || new Date();
    if (msgTime) {
      stamp = new Date(msgTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    let ticks = '';
    if (isSenderMe) {
      const tickIcon = chat.isRead 
        ? '<i class="fa-solid fa-check-double" style="color: #3b82f6; font-size: 11px;"></i>' 
        : '<i class="fa-solid fa-check" style="color: #9ca3af; font-size: 11px;"></i>';
      ticks = `<span class="message-status-tick" style="margin-left: 4px;">${tickIcon}</span>`;
    }

    const bubbleHtml = `
      <div class="chat-message-bubble-wrapper animate-message" style="${wrapperStyle} opacity: 0; transform: translateY(10px); transition: all 0.2s ease;">
        <div style="padding: 10px 16px; border-radius: 14px; max-width: 70%; font-size: 14px; line-height: 1.4; box-shadow: var(--shadow-sm); word-break: break-word; font-weight: 500; ${msgStyle}">
          ${renderMessageContent(chat, isSenderMe)}
        </div>
        <span style="font-size: 10px; color: var(--gray-500); margin-top: 4px; padding: 0 6px; display: flex; align-items: center; gap: 4px;">
          ${stamp} ${ticks}
        </span>
      </div>
    `;

    messagesBox.insertAdjacentHTML('beforeend', bubbleHtml);

    // Apply animation frame
    const element = messagesBox.lastElementChild;
    requestAnimationFrame(() => {
      element.style.opacity = '1';
      element.style.transform = 'translateY(0)';
    });
  }

  // Helper targeting scrollbars
  function scrollToNewestMessages() {
    if (messagesBox) {
      messagesBox.scrollTop = messagesBox.scrollHeight;
    }
  }

  // Reactive online indicators mapping
  function updateOnlineStatusIndicators() {
    // 1. Update list dots
    document.querySelectorAll('.avatar-status-dot').forEach(el => {
      const uId = el.dataset.userId;
      if (onlineUserIds.includes(uId)) {
        el.style.backgroundColor = '#10b981'; // Green
      } else {
        el.style.backgroundColor = '#cbd5e1'; // Gray
      }
    });

    // 2. Update top recipient bar dot
    if (partnerStatusDot && activeReceiverId) {
      if (onlineUserIds.includes(activeReceiverId)) {
        partnerStatusDot.style.backgroundColor = '#10b981';
      } else {
        partnerStatusDot.style.backgroundColor = '#cbd5e1';
      }
    }
  }

  // ==========================================
  // ACTION EVENT HANDLERS
  // ==========================================

  // Submit Text Message Form logic
  if (chatForm) {
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const text = messageInput.value.trim();
      
      // Check if we have an attachment or text message
      if ((!text && !currentAttachment) || !activeChatId) return;

      const payload = {
        chatId: activeChatId,
        jobId: activeJobId,
        message: text,
        receiverId: activeReceiverId
      };

      if (currentAttachment) {
        payload.fileUrl = currentAttachment.fileUrl;
        payload.fileName = currentAttachment.fileName;
        payload.fileSize = currentAttachment.fileSize;
      }

      // 1. Send via WebSocket (Real-Time emit)
      socket.emit('sendMessage', payload);

      // 2. Form & Attachment cleanup
      messageInput.value = '';
      currentAttachment = null;
      const uploadPreview = document.getElementById('chat-upload-preview');
      if (uploadPreview) {
        uploadPreview.style.display = 'none';
      }
      
      // Stop typing indicators on message submission
      if (typingTimeout) {
        clearTimeout(typingTimeout);
        socket.emit('typing', { chatId: activeChatId, isTyping: false });
      }
    });
  }

  // Real-time typing indicators triggers
  if (messageInput) {
    messageInput.addEventListener('input', () => {
      if (!activeChatId) return;

      // Emit keypress typing trigger online
      socket.emit('typing', { chatId: activeChatId, isTyping: true });

      // Debounce stop typing notifications
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        socket.emit('typing', { chatId: activeChatId, isTyping: false });
      }, 1500);
    });
  }

  // Emoji button logic
  const emojiBtn = document.getElementById('chat-emoji-btn');
  const emojiPopover = document.getElementById('emoji-popover');
  if (emojiBtn && emojiPopover) {
    emojiBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = emojiPopover.style.display === 'none' || !emojiPopover.style.display;
      emojiPopover.style.display = isHidden ? 'grid' : 'none';
    });

    document.querySelectorAll('.emoji-opt').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        if (messageInput) {
          messageInput.value += opt.textContent;
          messageInput.focus();
        }
        emojiPopover.style.display = 'none';
      });
    });

    document.addEventListener('click', () => {
      emojiPopover.style.display = 'none';
    });
  }

  // File Upload Logic
  const attachmentBtn = document.getElementById('chat-attachment-btn');
  const fileInput = document.getElementById('chat-file-input');
  const uploadPreview = document.getElementById('chat-upload-preview');
  const previewFilename = document.getElementById('preview-filename');
  const previewFilesize = document.getElementById('preview-filesize');
  const cancelUploadBtn = document.getElementById('cancel-upload-btn');

  if (attachmentBtn && fileInput) {
    attachmentBtn.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Show temporary uploading state
      if (uploadPreview && previewFilename && previewFilesize) {
        previewFilename.textContent = 'Uploading: ' + file.name;
        previewFilesize.textContent = 'Please wait...';
        uploadPreview.style.display = 'flex';
      }

      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        const result = await res.json();

        if (result.success) {
          currentAttachment = {
            fileUrl: result.fileUrl,
            fileName: result.filename,
            fileSize: result.size
          };
          if (previewFilename && previewFilesize) {
            previewFilename.textContent = result.filename;
            previewFilesize.textContent = (result.size / 1024).toFixed(1) + ' KB';
          }
        } else {
          throw new Error(result.message || 'Upload failed');
        }
      } catch (err) {
        console.error('File upload error:', err);
        if (uploadPreview) {
          uploadPreview.style.display = 'none';
        }
        alert('Upload failed: ' + err.message);
      } finally {
        fileInput.value = ''; // Reset input
      }
    });
  }

  if (cancelUploadBtn && uploadPreview) {
    cancelUploadBtn.addEventListener('click', () => {
      currentAttachment = null;
      uploadPreview.style.display = 'none';
    });
  }

  // Handle layout safety on responsive browser resize events
  window.addEventListener('resize', () => {
    const sidebar = document.querySelector('.chat-sidebar');
    const viewport = document.querySelector('.chat-conversations-viewport');
    const backBtn = document.getElementById('chat-mobile-back');
    
    if (window.innerWidth > 768) {
      if (sidebar) sidebar.style.removeProperty('display');
      if (viewport) viewport.style.removeProperty('display');
      if (backBtn) backBtn.style.display = 'none';
    } else {
      // On mobile view, align display according to active selection state
      if (activeChatId) {
        if (sidebar) sidebar.style.setProperty('display', 'none', 'important');
        if (viewport) viewport.style.setProperty('display', 'flex', 'important');
        if (backBtn) backBtn.style.display = 'inline-flex';
      } else {
        if (sidebar) sidebar.style.setProperty('display', 'flex', 'important');
        if (viewport) viewport.style.setProperty('display', 'none', 'important');
        if (backBtn) backBtn.style.display = 'none';
      }
    }
  });

  // ==========================================
  // RUN SYSTEM LOOPS
  // ==========================================
  initializeSocket();
  loadInbox();

});
