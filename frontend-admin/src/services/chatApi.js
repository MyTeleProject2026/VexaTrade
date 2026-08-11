// frontend-admin/src/services/chatApi.js
import io from "socket.io-client";

let socket = null;
let isConnected = false;

// ✅ FIXED: Use the correct API URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://vexatrade-5ycu.onrender.com";

// Local storage helpers for fallback
const getLocalConversations = (adminId) => {
  const stored = localStorage.getItem(`chat_admin_${adminId}_conversations`);
  return stored ? JSON.parse(stored) : [];
};

const saveLocalConversation = (adminId, conversationId, message) => {
  const convKey = `chat_admin_${adminId}_conversations`;
  const existing = getLocalConversations(adminId);
  const existingConv = existing.find(c => c.id === conversationId);
  
  if (existingConv) {
    existingConv.last_message = message;
    existingConv.last_message_time = new Date().toISOString();
    existingConv.unread_admin = (existingConv.unread_admin || 0) + 1;
  } else {
    existing.push({
      id: conversationId,
      last_message: message,
      last_message_time: new Date().toISOString(),
      unread_admin: 1
    });
  }
  
  localStorage.setItem(convKey, JSON.stringify(existing));
};

export const adminChatApi = {
  connect: (adminId, name, token) => {
    if (socket && isConnected) return socket;
    
    try {
      console.log(`🔌 Connecting to chat server: ${API_BASE_URL}`);
      
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
        console.log("✅ Chat socket connected");
        socket.emit("authenticate", { 
          userId: adminId, 
          role: "admin", 
          name, 
          token 
        });
      });
      
      socket.on("disconnect", () => { 
        isConnected = false;
        console.log("❌ Chat socket disconnected");
      });
      
      socket.on("connect_error", (err) => {
        console.error("❌ Socket connection error:", err.message);
        isConnected = false;
      });

      // ✅ Log authentication result
      socket.on("authenticated", (data) => {
        console.log("✅ Chat authenticated:", data);
      });

      socket.on("auth_error", (data) => {
        console.error("❌ Chat auth error:", data);
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
  
  sendMessage: (conversationId, message) => { 
    console.log(`📤 Sending message to ${conversationId}:`, message);
    
    if (socket && isConnected) {
      socket.emit("send_message", { conversationId, message });
    } else {
      console.warn("⚠️ Socket not connected, message stored locally only");
    }
    
    // Store in localStorage as fallback
    const convKey = `chat_messages_${conversationId}`;
    const existing = localStorage.getItem(convKey);
    const messages = existing ? JSON.parse(existing) : [];
    messages.push({
      id: Date.now(),
      message: message,
      senderType: "admin",
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
      if (adminChatApi._messagesCallback) {
        adminChatApi._messagesCallback({ messages, conversationId });
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
        msg.senderType === "user" ? { ...msg, read: true } : msg
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
        console.log("📩 New message received:", data);
        callback(data);
      });
    }
    adminChatApi._newMessageCallback = callback;
  },
  
  onMessagesLoaded: (callback) => { 
    if (socket) {
      socket.on("messages_loaded", (data) => {
        console.log("📚 Messages loaded:", data);
        callback(data);
      });
    }
    adminChatApi._messagesCallback = callback;
  },
  
  onAdminConversations: (callback) => { 
    if (socket) {
      socket.on("admin_conversations", (data) => {
        console.log("💬 Conversations loaded:", data);
        callback(data);
      });
    }
  },
  
  onMessageDeleted: (callback) => { 
    if (socket) {
      socket.on("message_deleted", (data) => {
        console.log("🗑️ Message deleted:", data);
        callback(data);
      });
    }
  },
  
  off: (event) => { 
    if (socket) socket.off(event); 
  }
};
