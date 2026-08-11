// frontend-admin/src/components/AdminChatPanel.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, Send, Users, X, ChevronLeft, Trash2, Phone, Video, Check, CheckCheck, Bot } from "lucide-react";
import { adminChatApi } from "../services/chatApi";

function formatTime(date) {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(date) {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleDateString();
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AdminChatPanel({ adminId, adminName, isOpen, onClose }) {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteMenu, setShowDeleteMenu] = useState(null);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load conversations from localStorage as fallback
  const loadLocalConversations = useCallback(() => {
    try {
      const stored = localStorage.getItem("chat_conversations_admin");
      if (stored) {
        const convs = JSON.parse(stored);
        setConversations(convs);
        const totalUnread = convs.reduce((sum, conv) => sum + (conv.unread_admin || 0), 0);
        setChatUnreadCount(totalUnread);
      }
      setIsLoading(false);
    } catch (e) {
      console.error("Error loading local conversations:", e);
      setIsLoading(false);
    }
  }, []);

  const saveConversations = useCallback((convs) => {
    try {
      localStorage.setItem("chat_conversations_admin", JSON.stringify(convs));
      const totalUnread = convs.reduce((sum, conv) => sum + (conv.unread_admin || 0), 0);
      setChatUnreadCount(totalUnread);
    } catch (e) {
      console.error("Error saving conversations:", e);
    }
  }, []);

  const loadLocalMessages = useCallback((conversationId) => {
    try {
      const stored = localStorage.getItem(`chat_messages_${conversationId}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error("Error loading local messages:", e);
    }
    return [];
  }, []);

  const saveLocalMessages = useCallback((conversationId, msgs) => {
    try {
      localStorage.setItem(`chat_messages_${conversationId}`, JSON.stringify(msgs));
    } catch (e) {
      console.error("Error saving messages:", e);
    }
  }, []);

  const handleDeleteMessage = useCallback((messageId) => {
    if (!selectedConversation) return;
    setMessages(prev => {
      const updated = prev.filter(msg => msg.id !== messageId);
      saveLocalMessages(selectedConversation.id, updated);
      return updated;
    });
    if (adminChatApi && adminChatApi.deleteMessage) {
      adminChatApi.deleteMessage(selectedConversation.id, messageId);
    }
    setShowDeleteMenu(null);
  }, [selectedConversation, saveLocalMessages]);

  const createDemoConversations = useCallback(() => {
    const demoConversations = [
      {
        id: 1,
        user_id: 101,
        user_name: "Alice Johnson",
        user_email: "alice@example.com",
        user_uid: "USR001",
        last_message: "Need help with my deposit",
        last_message_time: new Date().toISOString(),
        unread_admin: 0
      },
      {
        id: 2,
        user_id: 102,
        user_name: "Bob Miller",
        user_email: "bob@example.com",
        user_uid: "USR002",
        last_message: "When will my withdrawal be processed?",
        last_message_time: new Date(Date.now() - 3600000).toISOString(),
        unread_admin: 1
      },
      {
        id: 3,
        user_id: 103,
        user_name: "Charlie Chen",
        user_email: "charlie@example.com",
        user_uid: "USR003",
        last_message: "KYC verification status?",
        last_message_time: new Date(Date.now() - 7200000).toISOString(),
        unread_admin: 0
      }
    ];
    setConversations(demoConversations);
    saveConversations(demoConversations);
    setIsLoading(false);
  }, [saveConversations]);

  useEffect(() => {
    if (!adminId || !isOpen) return;

    const token = localStorage.getItem("adminToken") || localStorage.getItem("admin_token") || "";
    
    if (adminChatApi && adminChatApi.connect) {
      adminChatApi.connect(adminId, adminName, token);
      setIsConnected(true);

      adminChatApi.onNewMessage((data) => {
        // Update conversation list
        setConversations(prev => {
          const updated = prev.map(conv => 
            conv.id === data.conversationId 
              ? { ...conv, last_message: data.message, last_message_time: new Date().toISOString(), unread_admin: (conv.unread_admin || 0) + 1 }
              : conv
          );
          const convIndex = updated.findIndex(c => c.id === data.conversationId);
          if (convIndex !== -1) {
            const [moved] = updated.splice(convIndex, 1);
            saveConversations([moved, ...updated]);
            return [moved, ...updated];
          }
          saveConversations(updated);
          return updated;
        });

        // If this is the selected conversation, add message to chat
        if (selectedConversation?.id === data.conversationId) {
          setMessages(prev => {
            const newMsg = {
              id: data.id || Date.now(),
              message: data.message,
              senderType: data.senderType || "user",
              createdAt: data.createdAt || new Date().toISOString(),
              userName: data.userName || "User",
              read: false,
              isAutoReply: data.isAutoReply || false
            };
            const newMsgs = [...prev, newMsg];
            saveLocalMessages(data.conversationId, newMsgs);
            return newMsgs;
          });
          adminChatApi.markRead?.(data.conversationId);
          setConversations(prev => {
            const updated = prev.map(conv => conv.id === data.conversationId ? { ...conv, unread_admin: 0 } : conv);
            saveConversations(updated);
            return updated;
          });
        }
      });

      adminChatApi.onAdminConversations((data) => {
        const convs = data.conversations || [];
        if (convs.length > 0) {
          setConversations(convs);
          saveConversations(convs);
        } else {
          createDemoConversations();
        }
        setIsLoading(false);
      });

      adminChatApi.onMessagesLoaded((data) => {
        const msgs = data.messages || [];
        setMessages(msgs);
        if (selectedConversation) {
          saveLocalMessages(selectedConversation.id, msgs);
        }
        scrollToBottom();
      });

      adminChatApi.onMessageDeleted?.((data) => {
        if (selectedConversation?.id === data.conversationId) {
          setMessages(prev => {
            const updated = prev.filter(msg => msg.id !== data.messageId);
            saveLocalMessages(data.conversationId, updated);
            return updated;
          });
        }
        setConversations(prev => {
          const updated = prev.map(conv => 
            conv.id === data.conversationId && conv.last_message_id === data.messageId
              ? { ...conv, last_message: "Message deleted", last_message_id: null }
              : conv
          );
          saveConversations(updated);
          return updated;
        });
      });

      if (adminChatApi.getConversations) {
        adminChatApi.getConversations();
      }

      setTimeout(() => {
        loadLocalConversations();
        setTimeout(() => {
          if (conversations.length === 0 && isLoading) {
            createDemoConversations();
          }
        }, 2000);
      }, 1000);
    } else {
      loadLocalConversations();
      setTimeout(() => {
        if (conversations.length === 0) {
          createDemoConversations();
        }
      }, 500);
      setIsConnected(true);
    }

    return () => {
      if (adminChatApi && adminChatApi.off) {
        adminChatApi.off("new_message");
        adminChatApi.off("admin_conversations");
        adminChatApi.off("messages_loaded");
        adminChatApi.off("message_deleted");
      }
    };
  }, [adminId, adminName, selectedConversation, isOpen, saveConversations, loadLocalConversations, saveLocalMessages, scrollToBottom, createDemoConversations, conversations.length, isLoading]);

  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
    setShowDeleteMenu(null);
    const localMsgs = loadLocalMessages(conversation.id);
    if (localMsgs.length > 0) {
      setMessages(localMsgs);
    }
    if (adminChatApi && adminChatApi.getMessages) {
      setMessages([]);
      adminChatApi.getMessages(conversation.id);
      adminChatApi.markRead?.(conversation.id);
    }
    setConversations(prev => {
      const updated = prev.map(conv => conv.id === conversation.id ? { ...conv, unread_admin: 0 } : conv);
      saveConversations(updated);
      return updated;
    });
  };

  const handleSendMessage = () => {
    if (!inputMessage.trim() || !selectedConversation) return;
    const newMessage = {
      id: Date.now(),
      message: inputMessage.trim(),
      senderType: "admin",
      createdAt: new Date().toISOString(),
      userName: adminName || "Admin",
      read: true,
      isAutoReply: false
    };
    setMessages(prev => {
      const newMsgs = [...prev, newMessage];
      saveLocalMessages(selectedConversation.id, newMsgs);
      return newMsgs;
    });
    setConversations(prev => {
      const updated = prev.map(conv => 
        conv.id === selectedConversation.id 
          ? { ...conv, last_message: inputMessage.trim(), last_message_time: new Date().toISOString(), last_message_id: newMessage.id }
          : conv
      );
      saveConversations(updated);
      return updated;
    });
    if (adminChatApi && adminChatApi.sendMessage) {
      adminChatApi.sendMessage(selectedConversation.id, inputMessage.trim());
    }
    setInputMessage("");
    setTimeout(scrollToBottom, 100);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.user_uid?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 animate-fadeIn">
      <div className="flex h-[92vh] w-full max-w-6xl flex-col bg-[#0a0e1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between border-b border-white/10 bg-[#111111] px-4 py-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-lime-400/20 to-emerald-500/20 border border-lime-400/20">
              <Users size={18} className="text-lime-400" />
            </div>
            <div>
              <span className="font-semibold text-white text-sm">Support Chat</span>
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] text-emerald-400">Online</span>
                  </>
                ) : (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    <span className="text-[10px] text-amber-400">Connecting...</span>
                  </>
                )}
                {chatUnreadCount > 0 && (
                  <span className="ml-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] text-white">
                    {chatUnreadCount} new
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition">
              <Phone size={16} />
            </button>
            <button className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition">
              <Video size={16} />
            </button>
            <button
              onClick={() => onClose?.()}
              className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ─── Back Button (Mobile) ─── */}
        {selectedConversation && (
          <button
            onClick={() => setSelectedConversation(null)}
            className="lg:hidden flex items-center gap-2 p-3 border-b border-white/10 bg-[#0f0f0f] text-white hover:bg-white/5 transition flex-shrink-0"
          >
            <ChevronLeft size={18} />
            <span className="text-sm">Back to conversations</span>
          </button>
        )}

        {/* ─── Main Chat Area ─── */}
        <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">
          {/* ─── User List Panel ─── */}
          <div className={`${selectedConversation ? "hidden lg:flex" : "flex"} lg:w-80 w-full border-r border-white/10 flex-col bg-[#0a0e1a]/50`}>
            <div className="p-3 border-b border-white/10 flex-shrink-0">
              <h3 className="text-sm font-semibold text-white">Active Conversations</h3>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-slate-400">{conversations.length} chat{conversations.length !== 1 ? "s" : ""}</p>
                {chatUnreadCount > 0 && (
                  <span className="text-xs text-red-400">{chatUnreadCount} unread</span>
                )}
              </div>
              <div className="relative mt-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search users..."
                  className="w-full rounded-xl border border-white/10 bg-[#050812]/60 px-3 py-1.5 text-sm text-white outline-none focus:border-lime-400 placeholder:text-slate-500"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="p-4 text-center text-sm text-slate-400">
                  <div className="spinner-small mx-auto mb-2" />
                  Loading conversations...
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center p-4 text-center text-sm text-slate-400">
                  <MessageCircle size={32} className="mx-auto mb-2 opacity-30" />
                  <p>No conversations</p>
                  <p className="mt-1 text-xs">Users will appear here when they start a chat</p>
                </div>
              ) : (
                filteredConversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv)}
                    className={`w-full p-3 text-left transition border-b border-white/5 ${
                      selectedConversation?.id === conv.id 
                        ? "bg-lime-500/10 border-l-2 border-lime-400" 
                        : "hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-lime-400/30 to-emerald-500/30 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-lime-300">
                            {conv.user_name?.charAt(0).toUpperCase() || "U"}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-white text-sm truncate">
                            {conv.user_name || `User #${conv.user_id}`}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {conv.user_email || ""}
                          </div>
                        </div>
                      </div>
                      {conv.unread_admin > 0 && (
                        <span className="ml-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] text-white flex-shrink-0">
                          {conv.unread_admin}
                        </span>
                      )}
                    </div>
                    {conv.last_message && (
                      <div className="mt-1.5 text-xs text-slate-500 truncate">
                        {conv.last_message}
                      </div>
                    )}
                    {conv.last_message_time && (
                      <div className="mt-0.5 text-[10px] text-slate-600">
                        {getTimeAgo(conv.last_message_time)}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* ─── Chat Messages Area ─── */}
          <div className="flex-1 flex flex-col bg-[#050812]/30">
            {selectedConversation ? (
              <>
                {/* ─── Chat Header ─── */}
                <div className="border-b border-white/10 p-3 bg-[#0f0f0f] flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-lime-400/30 to-emerald-500/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-lime-300">
                        {selectedConversation.user_name?.charAt(0).toUpperCase() || "U"}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-white text-sm truncate">
                        {selectedConversation.user_name || `User #${selectedConversation.user_id}`}
                      </div>
                      <div className="text-xs text-slate-400 truncate">
                        {selectedConversation.user_email || ""} • UID: {selectedConversation.user_uid || "-"}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedConversation(null)}
                    className="lg:hidden p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* ─── Messages ─── */}
                <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-center text-sm text-slate-400">
                      <div>
                        <MessageCircle size={32} className="mx-auto mb-2 opacity-30" />
                        <p>No messages yet</p>
                        <p className="mt-1 text-xs">Send a message to start the conversation</p>
                      </div>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isAdmin = msg.senderType === "admin";
                      const isAutoReply = msg.isAutoReply === true;
                      
                      return (
                        <div key={msg.id} className={`group relative flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                            isAdmin 
                              ? isAutoReply
                                ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white" 
                                : "bg-gradient-to-r from-lime-400 to-emerald-400 text-black"
                              : "bg-[#1a1e2a] text-white"
                          }`}>
                            {!isAdmin && (
                              <p className="mb-0.5 text-xs text-lime-400">
                                {msg.userName || selectedConversation.user_name || "User"}
                              </p>
                            )}
                            {isAutoReply && (
                              <div className="flex items-center gap-1 mb-1">
                                <Bot size={12} className="text-cyan-300" />
                                <span className="text-[9px] font-semibold text-cyan-300 uppercase tracking-wider">Blockchain Ecosystem AI</span>
                              </div>
                            )}
                            <p className="text-sm break-words leading-relaxed">{msg.message}</p>
                            <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                              isAdmin ? "text-white/60" : "text-slate-400"
                            }`}>
                              <span>{formatTime(msg.created_at || msg.createdAt)}</span>
                              {isAdmin && !isAutoReply && (
                                <span>{msg.read ? <CheckCheck size={12} /> : <Check size={12} />}</span>
                              )}
                              {isAutoReply && (
                                <span className="text-[8px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded-full ml-1">
                                  AI
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="absolute -right-8 top-2 opacity-0 group-hover:opacity-100 transition">
                            <button
                              onClick={() => setShowDeleteMenu(showDeleteMenu === msg.id ? null : msg.id)}
                              className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30"
                            >
                              <Trash2 size={14} />
                            </button>
                            {showDeleteMenu === msg.id && (
                              <div className="absolute right-0 mt-1 bg-[#1a1e2a] border border-white/10 rounded-lg shadow-lg z-10 min-w-[150px]">
                                <button
                                  onClick={() => handleDeleteMessage(msg.id)}
                                  className="flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded-lg w-full"
                                >
                                  <Trash2 size={12} />
                                  Delete this message
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* ─── Input Area ─── */}
                <div className="border-t border-white/10 bg-[#111111] p-3 flex-shrink-0">
                  <div className="flex gap-2">
                    <textarea
                      ref={inputRef}
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder="Type your response..."
                      className="flex-1 resize-none rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none focus:border-lime-400 placeholder:text-slate-500"
                      rows={2}
                      style={{ minHeight: "40px", maxHeight: "100px" }}
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!inputMessage.trim()}
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-lime-400 to-emerald-400 text-black transition hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="text-[10px] text-slate-500">
                      Press Enter to send, Shift+Enter for new line
                    </div>
                    <div className="flex items-center gap-1 text-[9px] text-cyan-400">
                      <Bot size={10} />
                      <span>AI responses are auto-generated by the Blockchain Ecosystem</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-center text-sm text-slate-400">
                <div>
                  <MessageCircle size={48} className="mx-auto mb-3 opacity-20" />
                  <p className="text-lg font-medium text-slate-300">Select a conversation</p>
                  <p className="mt-1 text-xs">Choose a user from the left panel to start chatting</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
