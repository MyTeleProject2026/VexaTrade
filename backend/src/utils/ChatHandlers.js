// backend/src/utils/ChatHandlers.js

const pool = require('../../db.js');

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
    
    // Get user details for the conversation
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
 * Helper: Load conversations for a regular user
 */
async function loadUserConversations(socket, userId) {
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
        u.name as admin_name,
        u.email as admin_email,
        u.avatar_url as admin_avatar
      FROM conversations c
      LEFT JOIN users u ON c.admin_id = u.id
      WHERE c.user_id = ? AND c.status = 'active'
      ORDER BY c.updated_at DESC`,
      [userId]
    );
    
    socket.emit('user_conversations', { 
      conversations: conversations || [] 
    });
    
    return conversations;
  } catch (error) {
    console.error('Error loading user conversations:', error);
    socket.emit('user_conversations', { conversations: [] });
    return [];
  }
}

/**
 * Main Socket.IO Chat Handlers Setup
 */
function setupChatHandlers(io) {
  io.on('connection', (socket) => {
    // Store user info in socket
    let currentUser = {
      id: null,
      name: null,
      role: null,
      token: null
    };

    // ============================================
    // EVENT: authenticate
    // ============================================
    socket.on('authenticate', async (data) => {
      try {
        const { userId, role, name, token } = data;
        
        if (!userId) {
          socket.emit('auth_error', { message: 'User ID is required' });
          return;
        }

        // Store user info
        currentUser.id = userId;
        currentUser.name = name || 'User';
        currentUser.role = role || 'user';
        currentUser.token = token;

        // Join user-specific room
        socket.join(`user_${userId}`);
        
        // Join role-specific room
        if (role === 'admin') {
          socket.join('admins');
        }

        console.log(`User authenticated: ${userId} (${role})`);

        // Send success
        socket.emit('authenticated', { 
          success: true, 
          userId, 
          role,
          message: 'Authentication successful'
        });

        // Load conversations based on role
        if (role === 'admin') {
          await loadAdminConversations(socket, userId);
        } else {
          await loadUserConversations(socket, userId);
        }

      } catch (error) {
        console.error('Authentication error:', error);
        socket.emit('auth_error', { 
          message: 'Authentication failed: ' + error.message 
        });
      }
    });

    // ============================================
    // EVENT: get_conversations
    // ============================================
    socket.on('get_conversations', async () => {
      try {
        if (!currentUser.id) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        if (currentUser.role === 'admin') {
          await loadAdminConversations(socket, currentUser.id);
        } else {
          await loadUserConversations(socket, currentUser.id);
        }
      } catch (error) {
        console.error('Error getting conversations:', error);
        socket.emit('error', { message: 'Failed to get conversations' });
      }
    });

    // ============================================
    // EVENT: get_messages
    // ============================================
    socket.on('get_messages', async (data) => {
      try {
        const { conversationId } = data;
        
        if (!currentUser.id) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        if (!conversationId) {
          socket.emit('error', { message: 'Conversation ID is required' });
          return;
        }

        // Verify user has access to this conversation
        const [conv] = await pool.query(
          `SELECT * FROM conversations 
           WHERE id = ? AND (user_id = ? OR admin_id = ?) AND status = 'active'`,
          [conversationId, currentUser.id, currentUser.id]
        );
        
        if (conv.length === 0) {
          socket.emit('error', { message: 'Conversation not found or access denied' });
          return;
        }

        // Get messages
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

        // Mark messages as read based on role
        const senderType = currentUser.role === 'admin' ? 'user' : 'admin';
        await pool.query(
          `UPDATE chat_messages 
           SET is_read = 1, read_at = NOW()
           WHERE conversation_id = ? AND sender_type = ? AND is_read = 0`,
          [conversationId, senderType]
        );

        // Update unread count in conversation
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

    // ============================================
    // EVENT: send_message
    // ============================================
    socket.on('send_message', async (data) => {
      try {
        const { conversationId, message, userId } = data;
        
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

        // If new conversation, create it
        if (!convId || convId === 'new' || convId === 'undefined') {
          if (!userId) {
            socket.emit('error', { message: 'User ID required for new conversation' });
            return;
          }

          const conv = await getOrCreateConversation(userId, currentUser.id);
          convId = conv.id;
        }

        // Verify access to conversation
        const [conv] = await pool.query(
          `SELECT * FROM conversations 
           WHERE id = ? AND (user_id = ? OR admin_id = ?) AND status = 'active'`,
          [convId, currentUser.id, currentUser.id]
        );

        if (conv.length === 0) {
          socket.emit('error', { message: 'Conversation not found or access denied' });
          return;
        }

        const conversation = conv[0];
        const senderType = currentUser.role === 'admin' ? 'admin' : 'user';
        
        // Determine recipient
        const recipientId = senderType === 'admin' 
          ? conversation.user_id 
          : conversation.admin_id;

        // Insert message
        const [result] = await pool.query(
          `INSERT INTO chat_messages 
           (conversation_id, sender_id, sender_type, message, is_read)
           VALUES (?, ?, ?, ?, 0)`,
          [convId, currentUser.id, senderType, trimmedMessage]
        );

        // Update conversation
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

        // Get the created message with sender info
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

        // Emit to recipient
        io.to(`user_${recipientId}`).emit('new_message', messageData);
        
        // Emit to sender (for confirmation)
        socket.emit('new_message', messageData);

        // If admin sent, update admin's conversation list
        if (senderType === 'admin') {
          await loadAdminConversations(socket, currentUser.id);
        } else {
          // Update user's conversation list
          await loadUserConversations(socket, currentUser.id);
        }

      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message: ' + error.message });
      }
    });

    // ============================================
    // EVENT: delete_message
    // ============================================
    socket.on('delete_message', async (data) => {
      try {
        const { conversationId, messageId } = data;
        
        if (!currentUser.id) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        if (!conversationId || !messageId) {
          socket.emit('error', { message: 'Conversation ID and Message ID are required' });
          return;
        }

        // Verify message exists and user has permission
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
        const isRecipient = (isAdmin && msg.sender_type === 'user') || 
                           (!isAdmin && msg.sender_type === 'admin');

        // Allow deletion if: sender, or admin can delete any message
        if (!isSender && !isAdmin) {
          socket.emit('error', { message: 'Unauthorized to delete this message' });
          return;
        }

        // Delete the message
        await pool.query(
          `DELETE FROM chat_messages WHERE id = ?`,
          [messageId]
        );

        // Get conversation to notify participants
        const [conv] = await pool.query(
          `SELECT user_id, admin_id FROM conversations WHERE id = ?`,
          [conversationId]
        );

        if (conv.length > 0) {
          const conversation = conv[0];
          
          // Notify both participants
          io.to(`user_${conversation.user_id}`).emit('message_deleted', {
            conversationId,
            messageId
          });
          io.to(`user_${conversation.admin_id}`).emit('message_deleted', {
            conversationId,
            messageId
          });
        }

        // Also emit to sender
        socket.emit('message_deleted', {
          conversationId,
          messageId
        });

        // Refresh conversations for admin
        if (currentUser.role === 'admin') {
          await loadAdminConversations(socket, currentUser.id);
        }

      } catch (error) {
        console.error('Error deleting message:', error);
        socket.emit('error', { message: 'Failed to delete message' });
      }
    });

    // ============================================
    // EVENT: mark_read
    // ============================================
    socket.on('mark_read', async (data) => {
      try {
        const { conversationId } = data;
        
        if (!currentUser.id) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        if (!conversationId) {
          socket.emit('error', { message: 'Conversation ID is required' });
          return;
        }

        // Verify access
        const [conv] = await pool.query(
          `SELECT * FROM conversations 
           WHERE id = ? AND (user_id = ? OR admin_id = ?)`,
          [conversationId, currentUser.id, currentUser.id]
        );

        if (conv.length === 0) {
          socket.emit('error', { message: 'Conversation not found' });
          return;
        }

        const field = currentUser.role === 'admin' ? 'unread_admin' : 'unread_user';
        const senderType = currentUser.role === 'admin' ? 'user' : 'admin';

        // Update unread count
        await pool.query(
          `UPDATE conversations 
           SET ${field} = 0 
           WHERE id = ?`,
          [conversationId]
        );

        // Mark messages as read
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

    // ============================================
    // EVENT: typing (optional - user is typing)
    // ============================================
    socket.on('typing', async (data) => {
      try {
        const { conversationId, isTyping } = data;
        
        if (!currentUser.id || !conversationId) return;

        // Get conversation to find recipient
        const [conv] = await pool.query(
          `SELECT user_id, admin_id FROM conversations WHERE id = ?`,
          [conversationId]
        );

        if (conv.length === 0) return;

        const conversation = conv[0];
        const recipientId = currentUser.role === 'admin' 
          ? conversation.user_id 
          : conversation.admin_id;

        io.to(`user_${recipientId}`).emit('user_typing', {
          conversationId,
          userId: currentUser.id,
          userName: currentUser.name,
          isTyping: isTyping || false
        });

      } catch (error) {
        console.error('Error handling typing:', error);
      }
    });

    // ============================================
    // EVENT: disconnect
    // ============================================
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${currentUser.id} (${currentUser.role})`);
      
      // Clean up any user-specific data
      if (currentUser.id) {
        socket.leave(`user_${currentUser.id}`);
        if (currentUser.role === 'admin') {
          socket.leave('admins');
        }
      }
    });

    // ============================================
    // EVENT: reconnect
    // ============================================
    socket.on('reconnect', () => {
      console.log(`User reconnecting: ${currentUser.id}`);
      if (currentUser.id) {
        // Re-authenticate
        socket.emit('authenticate', {
          userId: currentUser.id,
          role: currentUser.role,
          name: currentUser.name,
          token: currentUser.token
        });
      }
    });

  }); // end io.on('connection')

  console.log('✅ Chat handlers initialized');
}

module.exports = { 
  setupChatHandlers,
  getOrCreateConversation,
  loadAdminConversations,
  loadUserConversations
};
