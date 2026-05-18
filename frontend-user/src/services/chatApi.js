import io from "socket.io-client";

let socket = null;
let isConnected = false;

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://vexatrade-server.onrender.com";

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
      socket = io(API_BASE_URL, { 
        transports: ["websocket", "polling"], 
        withCredentials: true,
        timeout: 10000
      });
      
      socket.on("connect", () => { 
        isConnected = true; 
        socket.emit("authenticate", { userId, role: "user", name, token }); 
      });
      
      socket.on("disconnect", () => { 
        isConnected = false; 
      });
      
      socket.on("connect_error", (err) => {
        console.error("Socket connection error:", err);
        isConnected = false;
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
    if (socket && isConnected) {
      socket.emit("send_message", { conversationId, message });
    }
    // Store in localStorage as fallback
    const convKey = `chat_messages_${conversationId}`;
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
  
  getMessages: (conversationId) => { 
    if (socket && isConnected) {
      socket.emit("get_messages", { conversationId });
    } else {
      // Load from localStorage
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
    // Mark messages as read in localStorage
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
    if (socket) socket.on("new_message", callback);
    chatApi._newMessageCallback = callback;
  },
  
  onMessagesLoaded: (callback) => { 
    if (socket) socket.on("messages_loaded", callback);
    chatApi._messagesCallback = callback;
  },
  
  onUserConversations: (callback) => { 
    if (socket) socket.on("user_conversations", callback);
  },
  
  off: (event) => { 
    if (socket) socket.off(event); 
  }
};
