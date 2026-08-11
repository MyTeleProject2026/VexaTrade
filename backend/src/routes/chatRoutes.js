// backend/src/routes/chatRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../../db');

// ─── GET /api/chat/conversations ──────────────────────────────────
router.get('/conversations', async (req, res) => {
  try {
    const adminId = req.user.id;
    
    const [conversations] = await pool.query(`
      SELECT 
        c.*,
        u.name as user_name,
        u.email as user_email,
        u.uid as user_uid,
        u.avatar_url as user_avatar
      FROM conversations c
      JOIN users u ON c.user_id = u.id
      WHERE c.admin_id = ? AND c.status = 'active'
      ORDER BY c.updated_at DESC
    `, [adminId]);
    
    res.json({ conversations: conversations || [] });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// ─── GET /api/chat/messages/:conversationId ──────────────────────
router.get('/messages/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const adminId = req.user.id;
    
    const [conv] = await pool.query(
      `SELECT * FROM conversations 
       WHERE id = ? AND admin_id = ? AND status = 'active'`,
      [conversationId, adminId]
    );
    
    if (conv.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    const [messages] = await pool.query(`
      SELECT 
        m.*,
        u.name as sender_name,
        u.avatar_url as sender_avatar
      FROM chat_messages m
      LEFT JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = ?
      ORDER BY m.created_at ASC
    `, [conversationId]);
    
    res.json({ messages: messages || [] });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// ─── POST /api/chat/messages ──────────────────────────────────────
router.post('/messages', async (req, res) => {
  try {
    const { conversationId, message, userId } = req.body;
    const adminId = req.user.id;
    
    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    let convId = conversationId;
    const trimmedMessage = message.trim();
    
    // If new conversation, create it
    if (!convId || convId === 'new' || convId === 'undefined') {
      if (!userId) {
        return res.status(400).json({ error: 'User ID required for new conversation' });
      }
      
      // Check if conversation exists
      const [existing] = await pool.query(
        `SELECT * FROM conversations 
         WHERE user_id = ? AND admin_id = ? AND status = 'active'`,
        [userId, adminId]
      );
      
      if (existing.length > 0) {
        convId = existing[0].id;
      } else {
        // Get user details
        const [user] = await pool.query(
          `SELECT name, email, uid FROM users WHERE id = ?`,
          [userId]
        );
        
        const [result] = await pool.query(
          `INSERT INTO conversations 
           (user_id, admin_id, user_name, user_email, user_uid, status) 
           VALUES (?, ?, ?, ?, ?, 'active')`,
          [userId, adminId, user[0]?.name || null, user[0]?.email || null, user[0]?.uid || null]
        );
        convId = result.insertId;
      }
    }
    
    // Verify access
    const [conv] = await pool.query(
      `SELECT * FROM conversations 
       WHERE id = ? AND admin_id = ? AND status = 'active'`,
      [convId, adminId]
    );
    
    if (conv.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    // Insert message
    const [result] = await pool.query(
      `INSERT INTO chat_messages 
       (conversation_id, sender_id, sender_type, message) 
       VALUES (?, ?, 'admin', ?)`,
      [convId, adminId, trimmedMessage]
    );
    
    // Update conversation
    await pool.query(
      `UPDATE conversations 
       SET last_message = ?,
           last_message_id = ?,
           last_message_time = NOW(),
           updated_at = NOW(),
           unread_user = unread_user + 1
       WHERE id = ?`,
      [trimmedMessage, result.insertId, convId]
    );
    
    // Get the created message
    const [newMessage] = await pool.query(
      `SELECT 
        m.*,
        u.name as sender_name
      FROM chat_messages m
      LEFT JOIN users u ON m.sender_id = u.id
      WHERE m.id = ?`,
      [result.insertId]
    );
    
    // Get updated conversation
    const [conversation] = await pool.query(
      `SELECT * FROM conversations WHERE id = ?`,
      [convId]
    );
    
    // Emit via Socket.IO if available
    const io = req.app.get('io');
    if (io) {
      const convData = conversation[0];
      io.to(`user_${convData.user_id}`).emit('new_message', {
        conversationId: convId,
        ...newMessage[0],
        senderType: 'admin'
      });
    }
    
    res.status(201).json({
      message: newMessage[0],
      conversation: conversation[0]
    });
    
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message: ' + error.message });
  }
});

// ─── PUT /api/chat/read/:conversationId ──────────────────────────
router.put('/read/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const adminId = req.user.id;
    
    await pool.query(
      `UPDATE conversations 
       SET unread_admin = 0 
       WHERE id = ? AND admin_id = ?`,
      [conversationId, adminId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking read:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// ─── DELETE /api/chat/messages/:conversationId/:messageId ────────
router.delete('/messages/:conversationId/:messageId', async (req, res) => {
  try {
    const { conversationId, messageId } = req.params;
    const adminId = req.user.id;
    
    const [conv] = await pool.query(
      `SELECT * FROM conversations 
       WHERE id = ? AND admin_id = ? AND status = 'active'`,
      [conversationId, adminId]
    );
    
    if (conv.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    await pool.query(
      `DELETE FROM chat_messages WHERE id = ? AND conversation_id = ?`,
      [messageId, conversationId]
    );
    
    // Emit via Socket.IO
    const io = req.app.get('io');
    if (io) {
      const conv = await pool.query(
        `SELECT user_id, admin_id FROM conversations WHERE id = ?`,
        [conversationId]
      );
      if (conv[0].length > 0) {
        const data = conv[0][0];
        io.to(`user_${data.user_id}`).emit('message_deleted', {
          conversationId,
          messageId
        });
        io.to(`user_${data.admin_id}`).emit('message_deleted', {
          conversationId,
          messageId
        });
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

module.exports = router;
