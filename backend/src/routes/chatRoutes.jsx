const express = require('express');
const router = express.Router();
const pool = require('../../db.js');

// GET all conversations for admin
router.get('/conversations', async (req, res) => {
  try {
    // Get all users who have sent messages to admin
    const [conversations] = await pool.query(`
      SELECT 
        u.id as user_id,
        u.name,
        u.email,
        u.avatar_url,
        (
          SELECT message 
          FROM chat_messages 
          WHERE (sender_id = u.id OR receiver_id = u.id)
          ORDER BY created_at DESC 
          LIMIT 1
        ) as last_message,
        (
          SELECT created_at 
          FROM chat_messages 
          WHERE (sender_id = u.id OR receiver_id = u.id)
          ORDER BY created_at DESC 
          LIMIT 1
        ) as last_message_time,
        (
          SELECT COUNT(*) 
          FROM chat_messages 
          WHERE sender_id = u.id 
          AND receiver_id = ? 
          AND is_read = 0
        ) as unread_count
      FROM users u
      WHERE EXISTS (
        SELECT 1 
        FROM chat_messages 
        WHERE sender_id = u.id OR receiver_id = u.id
      )
      ORDER BY last_message_time DESC
    `, [req.user.id]);

    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// GET messages with a specific user
router.get('/messages/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user.id;

    const [messages] = await pool.query(`
      SELECT 
        m.*,
        u.name as sender_name,
        u.avatar_url as sender_avatar
      FROM chat_messages m
      JOIN users u ON m.sender_id = u.id
      WHERE (sender_id = ? AND receiver_id = ?)
         OR (sender_id = ? AND receiver_id = ?)
      ORDER BY created_at ASC
    `, [adminId, userId, userId, adminId]);

    // Mark messages as read
    await pool.query(`
      UPDATE chat_messages 
      SET is_read = 1 
      WHERE sender_id = ? AND receiver_id = ?
    `, [userId, adminId]);

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST send message
router.post('/messages', async (req, res) => {
  try {
    const { receiver_id, message } = req.body;
    const sender_id = req.user.id;

    const [result] = await pool.query(`
      INSERT INTO chat_messages (sender_id, receiver_id, message)
      VALUES (?, ?, ?)
    `, [sender_id, receiver_id, message]);

    res.status(201).json({
      id: result.insertId,
      sender_id,
      receiver_id,
      message,
      created_at: new Date()
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

module.exports = router;
