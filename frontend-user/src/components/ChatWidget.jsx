import { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, X, Send, Minimize2, Maximize2, ChevronLeft } from "lucide-react";
import { chatApi } from "../services/chatApi";

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

export default function ChatWidget({ userId, userName }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [inputMessage, setInputMessage] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load messages from localStorage on mount
  useEffect(() => {
    if (userId) {
      loadLocalMessages();
    }
  }, [userId]);

  const loadLocalMessages = () => {
    const storedKey = `chat_user_${userId}_conversation`;
    const storedConvId = localStorage.getItem(storedKey);
    if (storedConvId) {
      setConversationId(storedConvId);
      const messagesKey = `chat_messages_${storedConvId}`;
      const storedMessages = localStorage.getItem(messagesKey);
      if (storedMessages) {
        try {
          const parsed = JSON.parse(storedMessages);
          setMessages(parsed);
          // Count unread messages from admin
          const unread = parsed.filter(msg => msg.senderType === "admin" && !msg.read).length;
          setUnreadCount(unread);
        } catch (e) {
          console.error("Error loading messages:", e);
        }
      }
    } else {
      // Create new conversation ID
      const newConvId = `conv_${userId}_${Date.now()}`;
      setConversationId(newConvId);
      localStorage.setItem(storedKey, newConvId);
      
      // Add welcome message
      const welcomeMsg = [{
        id: Date.now(),
        message: "Hello! Welcome to VexaTrade Support. How can we help you today?",
        senderType: "admin",
        createdAt: new Date().toISOString(),
        read: false
      }];
      setMessages(welcomeMsg);
      localStorage.setItem(`chat_messages_${newConvId}`, JSON.stringify(welcomeMsg));
      setUnreadCount(1);
    }
  };

  const saveMessages = useCallback((msgs) => {
    if (conversationId) {
      localStorage.setItem(`chat_messages_${conversationId}`, JSON.stringify(msgs));
    }
  }, [conversationId]);

  useEffect(() => {
    if (conversationId && messages.length > 0) {
      saveMessages(messages);
    }
  }, [messages, conversationId, saveMessages]);

  // Socket connection for real-time
  useEffect(() => {
    if (!userId) return;

    const token = localStorage.getItem("userToken") || localStorage.getItem("token") || "";
    
    if (chatApi && chatApi.connect) {
      chatApi.connect(userId, userName, token);
      setIsConnected(true);

      chatApi.onNewMessage((data) => {
        if (data.conversationId === conversationId) {
          setMessages(prev => {
            const newMsg = {
              id: data.id,
              message: data.message,
              senderType: data.senderType,
              createdAt: data.createdAt || new Date().toISOString(),
              read: false
            };
            const updated = [...prev, newMsg];
            saveMessages(updated);
            
            if (data.senderType === "admin" && !isOpen) {
              setUnreadCount(prevCount => prevCount + 1);
            }
            
            return updated;
          });
          scrollToBottom();
        } else if (data.senderType === "admin" && !isOpen) {
          setUnreadCount(prev => prev + 1);
        }
      });

      chatApi.onMessagesLoaded((data) => {
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
          saveMessages(data.messages);
        }
        setIsLoading(false);
      });
    }

    return () => {
      if (chatApi && chatApi.off) {
        chatApi.off("new_message");
        chatApi.off("messages_loaded");
      }
    };
  }, [userId, userName, conversationId, isOpen, saveMessages, scrollToBottom]);

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;
    
    const newMessage = {
      id: Date.now(),
      message: inputMessage.trim(),
      senderType: "user",
      createdAt: new Date().toISOString(),
      read: true
    };
    
    setMessages(prev => {
      const updated = [...prev, newMessage];
      saveMessages(updated);
      return updated;
    });
    
    // Send via socket if connected
    if (chatApi && chatApi.sendMessage && conversationId) {
      chatApi.sendMessage(conversationId, inputMessage.trim());
    }
    
    setInputMessage("");
    scrollToBottom();
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    // Mark messages as read when opening
    setMessages(prev => {
      const updated = prev.map(msg => 
        msg.senderType === "admin" ? { ...msg, read: true } : msg
      );
      saveMessages(updated);
      return updated;
    });
    setUnreadCount(0);
    
    // Mark as read via API
    if (chatApi && chatApi.markRead && conversationId) {
      chatApi.markRead(conversationId);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <button
        onClick={handleOpen}
        className="fixed bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-lime-400 to-green-500 text-black shadow-lg transition hover:scale-105 hover:shadow-lime-500/25 md:bottom-6"
      >
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
        <MessageCircle size={24} />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="flex h-[85vh] w-full max-w-lg flex-col bg-[#0a0e1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-[#111111] px-4 py-3">
          <div className="flex items-center gap-2">
            <MessageCircle size={18} className="text-lime-400" />
            <span className="font-semibold text-white">Support Chat</span>
            {isConnected && <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />}
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1 text-slate-400 hover:text-white transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Messages Area */}
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-center text-sm text-slate-400">
              <div className="animate-pulse">Loading messages...</div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center text-sm text-slate-400">
              <div>
                <MessageCircle size={32} className="mx-auto mb-2 opacity-30" />
                <p>No messages yet.</p>
                <p className="mt-1 text-xs">Send a message to our support team!</p>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.senderType === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                  msg.senderType === "user" 
                    ? "bg-lime-400 text-black" 
                    : "bg-[#1a1e2a] text-white"
                }`}>
                  {msg.senderType === "admin" && (
                    <p className="mb-1 text-xs text-lime-400">Support Team</p>
                  )}
                  <p className="text-sm break-words">{msg.message}</p>
                  <p className={`mt-1 text-[10px] ${
                    msg.senderType === "user" ? "text-black/60" : "text-slate-400"
                  }`}>
                    {formatTime(msg.created_at || msg.createdAt)}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-white/10 bg-[#111111] p-3">
          <div className="flex gap-2">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type your message..."
              className="flex-1 resize-none rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none focus:border-lime-400"
              rows={1}
              style={{ minHeight: "40px", maxHeight: "100px" }}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim()}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime-400 text-black transition hover:bg-lime-300 disabled:opacity-50"
            >
              <Send size={18} />
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-slate-500">
            Our team typically responds within a few hours
          </p>
        </div>
      </div>
    </div>
  );
}
