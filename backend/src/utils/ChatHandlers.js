// backend/src/utils/ChatHandlers.js
const pool = require('../../db');
const { generateAutoResponse } = require('./autoResponses');

// Store connected users
const connectedUsers = new Map();

/**
 * Helper: Get or create a conversation between user and admin
 */
async function getOrCreateConversation(userId, adminId) {
  try {
    // Check if conversation exists
    const [existing] = await pool.query(
      `SELECT * FROM conversations 
       WHERE user_id = ? AND admin_id = ? AND status = 'active'`,
      [userId, adminId]
    );
    
    if (existing.length > 0) {
      return existing[0];
    }
    
    // Get user details
    const [user] = await pool.query(
      `SELECT id, name, email, uid FROM users WHERE id = ?`,
      [userId]
    );
    
    // Create new conversation
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

/**
 * Helper: Load conversations for an admin
 */
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
    
    socket.emit('admin_conversations', { 
      conversations: conversations || [] 
    });
    
    return conversations;
  } catch (error) {
    console.error('Error loading conversations:', error);
    socket.emit('admin_conversations', { conversations: [] });
    return [];
  }
}

/**
 * Main Socket.IO Chat Handlers Setup
 */
function setupChatHandlers(io) {
  io.on('connection', (socket) => {
    let currentUser = {
      id: null,
      name: null,
      role: null,
      token: null
    };

    console.log('🟢 New chat connection:', socket.id);

    // ─── authenticate ───
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
        
        if (role === 'admin') {
          socket.join('admins');
        }

        console.log(`✅ Chat authenticated: ${userId} (${role})`);

        socket.emit('authenticated', { 
          success: true, 
          userId, 
          role
        });

        if (role === 'admin') {
          await loadAdminConversations(socket, userId);
        }

      } catch (error) {
        console.error('Authentication error:', error);
        socket.emit('auth_error', { 
          message: 'Authentication failed: ' + error.message 
        });
      }
    });

    // ─── get_conversations ───
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

    // ─── get_messages ───
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
          `UPDATE conversations 
           SET ${field} = 0 
           WHERE id = ?`,
          [conversationId]
        );

        socket.emit('messages_loaded', { 
          messages: messages || [],
          conversationId
        });

      } catch (error) {
        console.error('Error getting messages:', error);
        socket.emit('error', { message: 'Failed to load messages' });
      }
    });

    // ─── send_message ─── ✅ WITH AI AUTO-RESPONSE + DEBUG LOGGING
    socket.on('send_message', async (data) => {
      try {
        const { conversationId, message, userId } = data;
        
        console.log(`📥 [send_message] conversationId=${conversationId}, userId=${userId}, message=${message}`);

        if (!currentUser.id) {
          console.error('❌ [send_message] Not authenticated');
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        if (!message || message.trim() === '') {
          console.error('❌ [send_message] Empty message');
          socket.emit('error', { message: 'Message is required' });
          return;
        }

        let convId = conversationId;
        const trimmedMessage = message.trim();
        const senderType = currentUser.role === 'admin' ? 'admin' : 'user';

        console.log(`📌 [send_message] senderType=${senderType}, currentUser.id=${currentUser.id}`);

        // Handle new conversation properly
        if (!convId || convId === 'new' || convId === 'null' || convId === 'undefined') {
          if (!userId) {
            console.error('❌ [send_message] No userId provided for new conversation');
            socket.emit('error', { message: 'User ID required for new conversation' });
            return;
          }
          
          console.log(`🆕 [send_message] Creating new conversation for user ${userId} with admin ${currentUser.id}`);
          const conv = await getOrCreateConversation(userId, currentUser.id);
          convId = conv.id;
          
          socket.emit('conversation_created', { 
            conversationId: convId,
            userId: userId 
          });
        }

        // Verify access to conversation
        const [conv] = await pool.query(
          `SELECT * FROM conversations 
           WHERE id = ? AND (user_id = ? OR admin_id = ?) AND status = 'active'`,
          [convId, currentUser.id, currentUser.id]
        );

        if (conv.length === 0) {
          console.error(`❌ [send_message] Conversation not found: ${convId}`);
          socket.emit('error', { message: 'Conversation not found or access denied' });
          return;
        }

        const conversation = conv[0];
        const recipientId = senderType === 'admin' ? conversation.user_id : conversation.admin_id;

        console.log(`📌 [send_message] conversationId=${convId}, recipientId=${recipientId}`);

        // ─── SAVE USER MESSAGE ───
        const [result] = await pool.query(
          `INSERT INTO chat_messages 
           (conversation_id, sender_id, sender_type, message)
           VALUES (?, ?, ?, ?)`,
          [convId, currentUser.id, senderType, trimmedMessage]
        );

        console.log(`✅ [send_message] User message saved with ID: ${result.insertId}`);

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
          WHERE m.id = ?`,
          [result.insertId]
        );

        const messageData = {
          conversationId: convId,
          ...newMessage[0],
          senderType: senderType
        };

        console.log(`📤 [send_message] Emitting user message to: user_${recipientId}`);

        // Emit to recipient
        io.to(`user_${recipientId}`).emit('new_message', messageData);
        
        // Emit to sender (for confirmation)
        socket.emit('new_message', messageData);

        // ─── ✅ AI AUTO-RESPONSE (Only if sender is NOT admin) ───
        if (senderType !== 'admin') {
          console.log(`🤖 [send_message] Generating AI auto-response for user ${currentUser.id}`);
          
          try {
            // Generate AI response based on user message
            const autoReply = generateAutoResponse(trimmedMessage);
            
            console.log(`📝 [send_message] Auto-reply generated: ${autoReply.substring(0, 100)}...`);

            // Save auto-reply to database as admin message
            const [autoResult] = await pool.query(
              `INSERT INTO chat_messages 
               (conversation_id, sender_id, sender_type, message)
               VALUES (?, ?, 'admin', ?)`,
              [convId, conversation.admin_id, autoReply]
            );

            console.log(`✅ [send_message] Auto-reply saved with ID: ${autoResult.insertId}`);

            // Update conversation with auto-reply
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

            // Get the auto-reply message
            const [autoMessage] = await pool.query(
              `SELECT 
                m.id,
                m.conversation_id,
                m.sender_id,
                m.sender_type,
                m.message,
                m.is_read,
                m.read_at,
                m.created_at,
                'Blockchain Ecosystem AI' as sender_name
              FROM chat_messages m
              WHERE m.id = ?`,
              [autoResult.insertId]
            );

            const autoData = {
              conversationId: convId,
              ...autoMessage[0],
              senderType: 'admin',
              isAutoReply: true  // ✅ Flag to identify auto-reply
            };

            console.log(`📤 [send_message] Emitting auto-reply to user_${conversation.user_id} with isAutoReply=true`);

            // ─── EMIT AUTO-REPLY TO USER ───
            io.to(`user_${conversation.user_id}`).emit('new_message', autoData);
            
            // ─── EMIT AUTO-REPLY TO ADMIN PANEL ───
            io.to(`user_${conversation.admin_id}`).emit('new_message', autoData);
            io.to('admins').emit('new_message', autoData);

            console.log(`✅ [send_message] Auto-reply sent to user ${conversation.user_id}`);
          } catch (autoError) {
            console.error('❌ [send_message] Error generating auto-response:', autoError);
            // Don't fail the whole operation if auto-response fails
          }
        } else {
          console.log(`ℹ️ [send_message] Sender is admin, skipping AI auto-response`);
        }

        // Update admin's conversation list if admin sent
        if (senderType === 'admin') {
          await loadAdminConversations(socket, currentUser.id);
        }

      } catch (error) {
        console.error('❌ [send_message] Error:', error);
        socket.emit('error', { message: 'Failed to send message: ' + error.message });
      }
    });

    // ─── delete_message ───
    socket.on('delete_message', async (data) => {
      try {
        const { conversationId, messageId } = data;
        
        if (!currentUser.id || !conversationId || !messageId) {
          socket.emit('error', { message: 'Invalid request' });
          return;
        }

        const [message] = await pool.query(
          `SELECT m.*, c.user_id, c.admin_id 
           FROM chat_messages m
           JOIN conversations c ON m.conversation_id = c.id
           WHERE m.id = ? AND m.conversation_id = ? AND c.status = 'active'`,
          [messageId, conversationId]
        );

        if (message.length === 0) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }

        const msg = message[0];
        const isAdmin = currentUser.role === 'admin';
        const isSender = msg.sender_id === currentUser.id;

        if (!isSender && !isAdmin) {
          socket.emit('error', { message: 'Unauthorized to delete this message' });
          return;
        }

        await pool.query(
          `DELETE FROM chat_messages WHERE id = ?`,
          [messageId]
        );

        const [conv] = await pool.query(
          `SELECT user_id, admin_id FROM conversations WHERE id = ?`,
          [conversationId]
        );

        if (conv.length > 0) {
          const conversation = conv[0];
          io.to(`user_${conversation.user_id}`).emit('message_deleted', {
            conversationId,
            messageId
          });
          io.to(`user_${conversation.admin_id}`).emit('message_deleted', {
            conversationId,
            messageId
          });
        }

        socket.emit('message_deleted', {
          conversationId,
          messageId
        });

        if (currentUser.role === 'admin') {
          await loadAdminConversations(socket, currentUser.id);
        }

      } catch (error) {
        console.error('Error deleting message:', error);
        socket.emit('error', { message: 'Failed to delete message' });
      }
    });

    // ─── mark_read ───
    socket.on('mark_read', async (data) => {
      try {
        const { conversationId } = data;
        
        if (!currentUser.id || !conversationId) {
          socket.emit('error', { message: 'Invalid request' });
          return;
        }

        const field = currentUser.role === 'admin' ? 'unread_admin' : 'unread_user';
        const senderType = currentUser.role === 'admin' ? 'user' : 'admin';

        await pool.query(
          `UPDATE conversations 
           SET ${field} = 0 
           WHERE id = ?`,
          [conversationId]
        );

        await pool.query(
          `UPDATE chat_messages 
           SET is_read = 1, read_at = NOW()
           WHERE conversation_id = ? AND sender_type = ? AND is_read = 0`,
          [conversationId, senderType]
        );

        socket.emit('read_updated', {
          conversationId,
          role: currentUser.role
        });

      } catch (error) {
        console.error('Error marking read:', error);
        socket.emit('error', { message: 'Failed to mark as read' });
      }
    });

    // ─── disconnect ───
    socket.on('disconnect', () => {
      console.log(`🔴 Chat disconnected: ${currentUser.id}`);
      if (currentUser.id) {
        connectedUsers.delete(currentUser.id);
      }
    });

  });

  console.log('✅ Chat handlers initialized with AI auto-response');
}

module.exports = { 
  setupChatHandlers,
  getOrCreateConversation,
  loadAdminConversations,
  connectedUsers
};
