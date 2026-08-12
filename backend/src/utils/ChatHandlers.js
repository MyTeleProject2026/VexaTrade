// backend/src/utils/ChatHandlers.js
const pool = require('../../db');
const { generateAutoResponse } = require('./autoResponses');

// ✅ DEFAULT ADMIN USER ID – change to your actual admin user ID
const DEFAULT_ADMIN_ID = 1;

const connectedUsers = new Map();

async function getOrCreateConversation(userId, adminId) {
  try {
    const [existing] = await pool.query(
      `SELECT * FROM conversations 
       WHERE user_id = ? AND admin_id = ? AND status = 'active'`,
      [userId, adminId]
    );
    if (existing.length > 0) return existing[0];
    
    const [user] = await pool.query(
      `SELECT id, name, email, uid FROM users WHERE id = ?`,
      [userId]
    );
    
    const [result] = await pool.query(
      `INSERT INTO conversations 
       (user_id, admin_id, user_name, user_email, user_uid, status) 
       VALUES (?, ?, ?, ?, ?, 'active')`,
      [userId, adminId, user[0]?.name || null, user[0]?.email || null, user[0]?.uid || null]
    );
    
    const [newConv] = await pool.query(
      `SELECT * FROM conversations WHERE id = ?`,
      [result.insertId]
    );
    return newConv[0];
  } catch (error) {
    console.error('Error in getOrCreateConversation:', error);
    throw error;
  }
}

async function loadAdminConversations(socket, adminId) {
  try {
    const [conversations] = await pool.query(
      `SELECT 
        c.id,
        c.user_id,
        c.admin_id,
        c.user_name,
        c.user_email,
        c.user_uid,
        c.last_message,
        c.last_message_id,
        c.last_message_time,
        c.unread_admin,
        c.unread_user,
        c.status,
        c.created_at,
        c.updated_at,
        u.avatar_url as user_avatar
      FROM conversations c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.admin_id = ? AND c.status = 'active'
      ORDER BY c.updated_at DESC`,
      [adminId]
    );
    socket.emit('admin_conversations', { conversations: conversations || [] });
    return conversations;
  } catch (error) {
    console.error('Error loading conversations:', error);
    socket.emit('admin_conversations', { conversations: [] });
    return [];
  }
}

function setupChatHandlers(io) {
  io.on('connection', (socket) => {
    let currentUser = {
      id: null,
      name: null,
      role: null,
      token: null
    };

    console.log('🟢 New chat connection:', socket.id);

    socket.on('authenticate', async (data) => {
      try {
        const { userId, role, name, token } = data;
        if (!userId) {
          socket.emit('auth_error', { message: 'User ID is required' });
          return;
        }
        currentUser.id = userId;
        currentUser.name = name || 'User';
        currentUser.role = role || 'user';
        currentUser.token = token;

        connectedUsers.set(userId, {
          socketId: socket.id,
          role: role || 'user',
          name: name || 'User'
        });

        socket.join(`user_${userId}`);
        if (role === 'admin') socket.join('admins');

        console.log(`✅ Chat authenticated: ${userId} (${role})`);
        socket.emit('authenticated', { success: true, userId, role });

        if (role === 'admin') {
          await loadAdminConversations(socket, userId);
        }
      } catch (error) {
        console.error('Authentication error:', error);
        socket.emit('auth_error', { message: 'Authentication failed: ' + error.message });
      }
    });

    socket.on('get_conversations', async () => {
      try {
        if (!currentUser.id) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }
        if (currentUser.role === 'admin') {
          await loadAdminConversations(socket, currentUser.id);
        }
      } catch (error) {
        console.error('Error getting conversations:', error);
        socket.emit('error', { message: 'Failed to get conversations' });
      }
    });

    socket.on('get_messages', async (data) => {
      try {
        const { conversationId } = data;
        if (!currentUser.id || !conversationId) {
          socket.emit('error', { message: 'Invalid request' });
          return;
        }

        const [conv] = await pool.query(
          `SELECT * FROM conversations 
           WHERE id = ? AND (user_id = ? OR admin_id = ?) AND status = 'active'`,
          [conversationId, currentUser.id, currentUser.id]
        );
        if (conv.length === 0) {
          socket.emit('error', { message: 'Conversation not found' });
          return;
        }

        const [messages] = await pool.query(
          `SELECT 
            m.id,
            m.conversation_id,
            m.sender_id,
            m.sender_type,
            m.message,
            m.is_read,
            m.read_at,
            m.created_at,
            u.name as sender_name,
            u.avatar_url as sender_avatar
          FROM chat_messages m
          LEFT JOIN users u ON m.sender_id = u.id
          WHERE m.conversation_id = ?
          ORDER BY m.created_at ASC`,
          [conversationId]
        );

        const senderType = currentUser.role === 'admin' ? 'user' : 'admin';
        await pool.query(
          `UPDATE chat_messages 
           SET is_read = 1, read_at = NOW()
           WHERE conversation_id = ? AND sender_type = ? AND is_read = 0`,
          [conversationId, senderType]
        );

        const field = currentUser.role === 'admin' ? 'unread_admin' : 'unread_user';
        await pool.query(
          `UPDATE conversations SET ${field} = 0 WHERE id = ?`,
          [conversationId]
        );

        socket.emit('messages_loaded', { messages: messages || [], conversationId });
      } catch (error) {
        console.error('Error getting messages:', error);
        socket.emit('error', { message: 'Failed to load messages' });
      }
    });

    // ─── send_message ─── FIXED ADMIN ID + AUTO‑RESPONSE ───
    socket.on('send_message', async (data) => {
      try {
        const { conversationId, message, userId } = data;
        console.log(`📥 [send_message] START: convId=${conversationId}, userId=${userId}, msg=${message}`);

        if (!currentUser.id) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }
        if (!message || message.trim() === '') {
          socket.emit('error', { message: 'Message is required' });
          return;
        }

        let convId = conversationId;
        const trimmedMessage = message.trim();
        const senderType = currentUser.role === 'admin' ? 'admin' : 'user';

        // Determine admin ID for new conversations
        let adminId;
        if (senderType === 'user') {
          adminId = DEFAULT_ADMIN_ID;   // ✅ fixed admin for user-initiated chats
        } else {
          adminId = currentUser.id;      // admin is the sender themselves
        }

        // Handle new conversation
        if (!convId || convId === 'new' || convId === 'null' || convId === 'undefined') {
          if (!userId) {
            console.error('❌ No userId provided for new conversation');
            socket.emit('error', { message: 'User ID required for new conversation' });
            return;
          }
          console.log(`🆕 Creating new conversation for user ${userId} with admin ${adminId}`);
          const conv = await getOrCreateConversation(userId, adminId);
          convId = conv.id;
          socket.emit('conversation_created', { conversationId: convId, userId });
        }

        // Verify access
        const [conv] = await pool.query(
          `SELECT * FROM conversations 
           WHERE id = ? AND (user_id = ? OR admin_id = ?) AND status = 'active'`,
          [convId, currentUser.id, currentUser.id]
        );
        if (conv.length === 0) {
          console.error(`❌ Conversation not found: ${convId}`);
          socket.emit('error', { message: 'Conversation not found or access denied' });
          return;
        }

        const conversation = conv[0];
        const recipientId = senderType === 'admin' ? conversation.user_id : conversation.admin_id;

        // ─── SAVE USER MESSAGE ───
        const [result] = await pool.query(
          `INSERT INTO chat_messages (conversation_id, sender_id, sender_type, message)
           VALUES (?, ?, ?, ?)`,
          [convId, currentUser.id, senderType, trimmedMessage]
        );
        console.log(`✅ User message saved ID: ${result.insertId}`);

        const unreadField = senderType === 'admin' ? 'unread_user' : 'unread_admin';
        await pool.query(
          `UPDATE conversations 
           SET last_message = ?,
               last_message_id = ?,
               last_message_time = NOW(),
               updated_at = NOW(),
               ${unreadField} = ${unreadField} + 1
           WHERE id = ?`,
          [trimmedMessage, result.insertId, convId]
        );

        const [newMessage] = await pool.query(
          `SELECT m.*, u.name as sender_name, u.avatar_url as sender_avatar
           FROM chat_messages m
           LEFT JOIN users u ON m.sender_id = u.id
           WHERE m.id = ?`,
          [result.insertId]
        );

        const messageData = {
          conversationId: convId,
          ...newMessage[0],
          senderType: senderType
        };

        console.log(`📤 Emitting user message to user_${recipientId}`);
        io.to(`user_${recipientId}`).emit('new_message', messageData);
        socket.emit('new_message', messageData);

        // ─── AI AUTO-RESPONSE (only if user sent) ───
        if (senderType === 'user') {
          console.log(`🤖 Generating AI auto‑reply for user ${currentUser.id}`);
          try {
            // Generate response (or use hardcoded test)
            const autoReply = generateAutoResponse(trimmedMessage);
            // For testing, you can uncomment the next line to force a known reply:
            // const autoReply = "🔧 This is a TEST auto-reply from the backend. Your message was: " + trimmedMessage;

            console.log(`📝 Auto-reply generated (${autoReply.length} chars)`);

            // ─── SAVE AUTO-REPLY ───
            const [autoResult] = await pool.query(
              `INSERT INTO chat_messages (conversation_id, sender_id, sender_type, message)
               VALUES (?, ?, 'admin', ?)`,
              [convId, conversation.admin_id, autoReply]
            );
            console.log(`✅ Auto-reply saved ID: ${autoResult.insertId}`);

            await pool.query(
              `UPDATE conversations 
               SET last_message = ?,
                   last_message_id = ?,
                   last_message_time = NOW(),
                   updated_at = NOW(),
                   unread_user = unread_user + 1
               WHERE id = ?`,
              [autoReply, autoResult.insertId, convId]
            );

            const [autoMessage] = await pool.query(
              `SELECT m.*, 'Blockchain Ecosystem AI' as sender_name
               FROM chat_messages m
               WHERE m.id = ?`,
              [autoResult.insertId]
            );

            const autoData = {
              conversationId: convId,
              ...autoMessage[0],
              senderType: 'admin',
              isAutoReply: true
            };

            console.log(`📤 Emitting auto‑reply to user_${conversation.user_id}`);
            io.to(`user_${conversation.user_id}`).emit('new_message', autoData);
            io.to(`user_${conversation.admin_id}`).emit('new_message', autoData);
            io.to('admins').emit('new_message', autoData);

            console.log(`✅ Auto-reply sent successfully!`);
          } catch (autoError) {
            console.error('❌ Auto-response error:', autoError);
          }
        } else {
          console.log(`ℹ️ Sender is admin, skipping auto‑reply`);
        }

        // Update admin conversations if admin sent
        if (senderType === 'admin') {
          await loadAdminConversations(socket, currentUser.id);
        }
      } catch (error) {
        console.error('❌ send_message error:', error);
        socket.emit('error', { message: 'Failed to send message: ' + error.message });
      }
    });

    // ─── delete_message, mark_read, disconnect (unchanged) ───
    // ... (keep your existing delete, mark_read, disconnect handlers)
    // I'll omit them here for brevity, but you should keep them.
  });
  console.log('✅ Chat handlers initialized with AI auto-response');
}

module.exports = { 
  setupChatHandlers,
  getOrCreateConversation,
  loadAdminConversations,
  connectedUsers
};
