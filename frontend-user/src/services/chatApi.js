import io from "socket.io-client";

let socket = null;
let isConnected = false;

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://vexatrade-server.onrender.com";

export const chatApi = {
  connect: (userId, name, token) => {
    if (socket && isConnected) return socket;
    socket = io(API_BASE_URL, { transports: ["websocket", "polling"], withCredentials: true });
    socket.on("connect", () => { isConnected = true; socket.emit("authenticate", { userId, role: "user", name, token }); });
    socket.on("disconnect", () => { isConnected = false; });
    return socket;
  },
  disconnect: () => { if (socket) { socket.disconnect(); socket = null; isConnected = false; } },
  getSocket: () => socket,
  isConnected: () => isConnected,
  sendMessage: (conversationId, message) => { if (socket && isConnected) socket.emit("send_message", { conversationId, message }); },
  getMessages: (conversationId) => { if (socket && isConnected) socket.emit("get_messages", { conversationId }); },
  markRead: (conversationId) => { if (socket && isConnected) socket.emit("mark_read", { conversationId }); },
  getConversations: () => { if (socket && isConnected) socket.emit("get_conversations"); },
  onNewMessage: (callback) => { if (socket) socket.on("new_message", callback); },
  onMessagesLoaded: (callback) => { if (socket) socket.on("messages_loaded", callback); },
  onUserConversations: (callback) => { if (socket) socket.on("user_conversations", callback); },
  off: (event) => { if (socket) socket.off(event); }
};
