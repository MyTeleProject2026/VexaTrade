// frontend-user/src/services/chatApi.js
import io from "socket.io-client";

let socket = null;
let isConnected = false;

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://vexatrade-5ycu.onrender.com";

// Local storage helpers for fallback
const getLocalConversations = (userId) => {
  const stored = localStorage.getItem(`chat_user_${userId}_conversations`);
  return stored ? JSON.parse(stored) : [];
};

const saveLocalConversation = (userId, conversationId, message) => {
  const convKey = `chat_user_${userId}_conversations`;
  const existing = getLocalConversations(userId);
  const existingConv = existing.find(c => c.id === conversationId);
  
  if (existingConv) {
    existingConv.last_message = message;
    existingConv.last_message_time = new Date().toISOString();
    existingConv.unread_user = (existingConv.unread_user || 0) + 1;
  } else {
    existing.push({
      id: conversationId,
      last_message: message,
      last_message_time: new Date().toISOString(),
      unread_user: 1
    });
  }
  
  localStorage.setItem(convKey, JSON.stringify(existing));
};

export const chatApi = {
  connect: (userId, name, token) => {
    if (socket && isConnected) return socket;
    
    try {
      console.log(`🔌 User chat connecting to: ${API_BASE_URL}`);
      
      socket = io(API_BASE_URL, { 
        transports: ["websocket", "polling"], 
        withCredentials: true,
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });
      
      socket.on("connect", () => { 
        isConnected = true; 
        console.log("✅ User chat socket connected");
        socket.emit("authenticate", { userId, role: "user", name, token }); 
      });
      
      socket.on("disconnect", () => { 
        isConnected = false;
        console.log("❌ User chat socket disconnected");
      });
      
      socket.on("connect_error", (err) => {
        console.error("❌ Socket connection error:", err.message);
        isConnected = false;
      });

      socket.on("authenticated", (data) => {
        console.log("✅ User chat authenticated:", data);
      });

      socket.on("auth_error", (data) => {
        console.error("❌ User chat auth error:", data);
      });
      
      socket.on("error", (data) => {
        console.error("❌ Socket error:", data);
      });
      
    } catch (err) {
      console.error("Failed to connect socket:", err);
      isConnected = false;
    }
    
    return socket;
  },
  
  disconnect: () => { 
    if (socket) { 
      socket.disconnect(); 
      socket = null; 
      isConnected = false; 
    } 
  },
  
  getSocket: () => socket,
  isConnected: () => isConnected,
  
  // ✅ FIXED: Send message with userId for new conversations + DEBUG LOGS
  sendMessage: (conversationId, message, userId = null) => { 
    console.log(`📤 [chatApi] sendMessage called: convId=${conversationId}, userId=${userId}, msg=${message}`);
    console.log(`📤 [chatApi] socket exists? ${!!socket}, isConnected? ${isConnected}`);
    
    if (socket && isConnected) {
      console.log(`📤 [chatApi] ✅ Emitting send_message to socket`);
      socket.emit("send_message", { 
        conversationId, 
        message,
        userId: userId // ✅ Include userId for new conversations
      });
    } else {
      console.warn(`⚠️ [chatApi] ❌ Socket not connected! Message stored locally only.`);
    }
    
    // Store in localStorage as fallback
    const convKey = `chat_messages_${conversationId || 'temp'}`;
    const existing = localStorage.getItem(convKey);
    const messages = existing ? JSON.parse(existing) : [];
    messages.push({
      id: Date.now(),
      message: message,
      senderType: "user",
      createdAt: new Date().toISOString(),
      read: true
    });
    localStorage.setItem(convKey, JSON.stringify(messages));
  },
  
  deleteMessage: (conversationId, messageId) => { 
    if (socket && isConnected) {
      socket.emit("delete_message", { conversationId, messageId });
    }
    const convKey = `chat_messages_${conversationId}`;
    const stored = localStorage.getItem(convKey);
    if (stored) {
      const messages = JSON.parse(stored);
      const updated = messages.filter(msg => msg.id !== messageId);
      localStorage.setItem(convKey, JSON.stringify(updated));
    }
  },
  
  getMessages: (conversationId) => { 
    if (socket && isConnected) {
      socket.emit("get_messages", { conversationId });
    } else {
      const convKey = `chat_messages_${conversationId}`;
      const stored = localStorage.getItem(convKey);
      const messages = stored ? JSON.parse(stored) : [];
      if (chatApi._messagesCallback) {
        chatApi._messagesCallback({ messages, conversationId });
      }
    }
  },
  
  markRead: (conversationId) => { 
    if (socket && isConnected) {
      socket.emit("mark_read", { conversationId });
    }
    const convKey = `chat_messages_${conversationId}`;
    const stored = localStorage.getItem(convKey);
    if (stored) {
      const messages = JSON.parse(stored);
      const updated = messages.map(msg => 
        msg.senderType === "admin" ? { ...msg, read: true } : msg
      );
      localStorage.setItem(convKey, JSON.stringify(updated));
    }
  },
  
  getConversations: () => { 
    if (socket && isConnected) {
      socket.emit("get_conversations"); 
    }
  },
  
  onNewMessage: (callback) => { 
    if (socket) {
      socket.on("new_message", (data) => {
        console.log("📩 User received new message:", data);
        callback(data);
      });
    }
    chatApi._newMessageCallback = callback;
  },
  
  onMessagesLoaded: (callback) => { 
    if (socket) {
      socket.on("messages_loaded", (data) => {
        console.log("📚 User messages loaded:", data);
        callback(data);
      });
    }
    chatApi._messagesCallback = callback;
  },
  
  onUserConversations: (callback) => { 
    if (socket) socket.on("user_conversations", callback);
  },

  onConversationCreated: (callback) => { 
    if (socket) {
      socket.on("conversation_created", (data) => {
        console.log("🆕 User conversation created:", data);
        callback(data);
      });
    }
  },
  
  onMessageDeleted: (callback) => { 
    if (socket) {
      socket.on("message_deleted", (data) => {
        console.log("🗑️ User message deleted:", data);
        callback(data);
      });
    }
  },
  
  off: (event) => { 
    if (socket) socket.off(event); 
  }
};
