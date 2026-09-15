// frontend-user/src/services/chatApi.js
import io from "socket.io-client";

let socket = null;
let connectionState = "disconnected";
let connectionGeneration = 0;
const listeners = new Map();

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://vexatrade-5ycu.onrender.com";

const isLive = () => !!socket && (connectionState === "connected" || connectionState === "authenticated");

const emitState = (state, extra = {}) => {
  connectionState = state;
  const callbacks = listeners.get("connection_state") || [];
  callbacks.forEach((callback) => {
    try {
      callback({
        state,
        connected: state === "connected" || state === "authenticated",
        ...extra,
      });
    } catch (_) {}
  });
};

const getLocalConversations = (userId) => {
  try {
    const stored = localStorage.getItem(`chat_user_${userId}_conversations`);
    return stored ? JSON.parse(stored) : [];
  } catch (_) { return []; }
};

const saveLocalConversation = (userId, conversationId, message) => {
  const convKey = `chat_user_${userId}_conversations`;
  const existing = getLocalConversations(userId);
  const existingConv = existing.find((c) => String(c.id) === String(conversationId));
  if (existingConv) {
    existingConv.last_message = message;
    existingConv.last_message_time = new Date().toISOString();
  } else {
    existing.push({
      id: conversationId,
      last_message: message,
      last_message_time: new Date().toISOString(),
      unread_user: 0,
    });
  }
  try { localStorage.setItem(convKey, JSON.stringify(existing)); } catch (_) {}
};

export const chatApi = {
  connect: (userId, name, token) => {
    if (socket && (connectionState === "connected" || connectionState === "authenticated" || connectionState === "connecting")) {
      return socket;
    }

    const generation = ++connectionGeneration;
    emitState("connecting");

    try {
      socket = io(API_BASE_URL, {
        transports: ["websocket", "polling"],
        withCredentials: true,
        timeout: 5000,
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 500,
        reconnectionDelayMax: 2000,
        randomizationFactor: 0.2,
        autoConnect: true,
      });

      socket.on("connect", () => {
        if (generation !== connectionGeneration || !socket) return;
        emitState("connected", { socketId: socket.id });
        socket.emit("authenticate", { userId, role: "user", name, token });
      });

      socket.on("authenticated", (data) => {
        if (generation !== connectionGeneration) return;
        emitState("authenticated", data || {});
      });

      socket.on("disconnect", (reason) => {
        if (generation !== connectionGeneration) return;
        emitState("disconnected", { reason });
      });

      socket.on("connect_error", (err) => {
        if (generation !== connectionGeneration) return;
        emitState("error", { message: err?.message || "Socket connection failed" });
        console.warn("[chatApi] Socket connection error:", err?.message || err);
      });

      socket.on("auth_error", (data) => {
        if (generation !== connectionGeneration) return;
        emitState("auth_error", data || {});
      });

      socket.on("error", (data) => {
        if (generation !== connectionGeneration) return;
        console.warn("[chatApi] Socket error:", data);
      });
    } catch (err) {
      emitState("error", { message: err?.message || "Failed to connect socket" });
      socket = null;
    }
    return socket;
  },

  disconnect: () => {
    connectionGeneration += 1;
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
    }
    emitState("disconnected");
  },

  getSocket: () => socket,
  isConnected: isLive,
  getConnectionState: () => connectionState,

  onConnectionState: (callback) => {
    const current = listeners.get("connection_state") || [];
    current.push(callback);
    listeners.set("connection_state", current);
    try {
      callback({
        state: connectionState,
        connected: connectionState === "connected" || connectionState === "authenticated",
      });
    } catch (_) {}
    return () => {
      const next = (listeners.get("connection_state") || []).filter((item) => item !== callback);
      listeners.set("connection_state", next);
    };
  },

  sendMessage: (conversationId, message, userId = null) => {
    const cleanMessage = String(message || "").trim();
    if (!cleanMessage) return false;

    if (isLive()) {
      // The server emits the authoritative new_message event back to the sender.
      // Do not also persist an optimistic copy here or messages appear twice.
      socket.emit("send_message", { conversationId, message: cleanMessage, userId });
      return true;
    }

    // Offline fallback: retain the message locally so the user does not lose it.
    const convKey = `chat_messages_${conversationId || "temp"}`;
    try {
      const existing = localStorage.getItem(convKey);
      const messages = existing ? JSON.parse(existing) : [];
      messages.push({
        id: `local-${Date.now()}`,
        message: cleanMessage,
        senderType: "user",
        createdAt: new Date().toISOString(),
        read: true,
        pending: true,
      });
      localStorage.setItem(convKey, JSON.stringify(messages));
      if (userId && conversationId) saveLocalConversation(userId, conversationId, cleanMessage);
    } catch (_) {}
    return false;
  },

  deleteMessage: (conversationId, messageId) => {
    if (isLive()) socket.emit("delete_message", { conversationId, messageId });
    const convKey = `chat_messages_${conversationId}`;
    try {
      const stored = localStorage.getItem(convKey);
      if (stored) localStorage.setItem(convKey, JSON.stringify(JSON.parse(stored).filter((msg) => msg.id !== messageId)));
    } catch (_) {}
  },

  getMessages: (conversationId) => {
    if (isLive()) {
      socket.emit("get_messages", { conversationId });
      return;
    }
    try {
      const stored = localStorage.getItem(`chat_messages_${conversationId}`);
      const messages = stored ? JSON.parse(stored) : [];
      if (chatApi._messagesCallback) chatApi._messagesCallback({ messages, conversationId });
    } catch (_) {}
  },

  markRead: (conversationId) => {
    if (isLive()) socket.emit("mark_read", { conversationId });
    try {
      const stored = localStorage.getItem(`chat_messages_${conversationId}`);
      if (stored) {
        const updated = JSON.parse(stored).map((msg) => msg.senderType === "admin" ? { ...msg, read: true } : msg);
        localStorage.setItem(`chat_messages_${conversationId}`, JSON.stringify(updated));
      }
    } catch (_) {}
  },

  getConversations: () => {
    if (isLive()) socket.emit("get_conversations");
  },

  onNewMessage: (callback) => {
    if (socket) socket.on("new_message", callback);
    chatApi._newMessageCallback = callback;
    return () => chatApi.off("new_message", callback);
  },
  onMessagesLoaded: (callback) => {
    if (socket) socket.on("messages_loaded", callback);
    chatApi._messagesCallback = callback;
    return () => chatApi.off("messages_loaded", callback);
  },
  onUserConversations: (callback) => {
    if (socket) socket.on("user_conversations", callback);
    return () => chatApi.off("user_conversations", callback);
  },
  onConversationCreated: (callback) => {
    if (socket) socket.on("conversation_created", callback);
    return () => chatApi.off("conversation_created", callback);
  },
  onMessageDeleted: (callback) => {
    if (socket) socket.on("message_deleted", callback);
    return () => chatApi.off("message_deleted", callback);
  },
  off: (event, callback) => {
    if (socket) {
      if (callback) socket.off(event, callback);
      else socket.off(event);
    }
  },
};
