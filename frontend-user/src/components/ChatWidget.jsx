// frontend-user/src/components/ChatWidget.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, X, Send, LogIn } from "lucide-react";
import { chatApi } from "../services/chatApi";

function formatTime(date) {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatWidget({ userId, userName, isOpen, onClose }) {
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [inputMessage, setInputMessage] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load messages from localStorage
  useEffect(() => {
    if (userId) loadLocalMessages();
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
          const unread = parsed.filter(msg => msg.senderType === "admin" && !msg.read).length;
          setUnreadCount(unread);
        } catch (e) {
          console.error("Error loading messages:", e);
        }
      }
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

  // Socket connection
  useEffect(() => {
    if (!userId) return;
    const token = localStorage.getItem("userToken") || localStorage.getItem("token") || "";
    
    if (chatApi && chatApi.connect) {
      chatApi.connect(userId, userName, token);
      setIsConnected(true);

      chatApi.onNewMessage((data) => {
        console.log("📩 [ChatWidget] New message received:", data);
        if (data.isAutoReply) console.log("🤖 AI auto-reply detected!");

        if (data.conversationId === conversationId) {
          setMessages(prev => {
            const newMsg = {
              id: data.id || Date.now(),
              message: data.message,
              senderType: data.senderType || "admin",
              createdAt: data.createdAt || new Date().toISOString(),
              read: false,
              isAutoReply: data.isAutoReply || false
            };
            const updated = [...prev, newMsg];
            saveMessages(updated);
            return updated;
          });
          scrollToBottom();
        } else if (data.senderType === "admin" && !isOpen) {
          setUnreadCount(prev => prev + 1);
        }
      });

      chatApi.onMessageDeleted?.((data) => {
        if (data.conversationId === conversationId) {
          setMessages(prev => {
            const updated = prev.filter(msg => msg.id !== data.messageId);
            saveMessages(updated);
            return updated;
          });
        }
      });

      chatApi.onMessagesLoaded((data) => {
        console.log("📚 Messages loaded:", data);
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
          saveMessages(data.messages);
        }
        setIsLoading(false);
      });
      
      chatApi.onConversationCreated?.((data) => {
        console.log("🆕 Conversation created:", data);
        if (data.conversationId && !conversationId) {
          setConversationId(data.conversationId);
          const storedKey = `chat_user_${userId}_conversation`;
          localStorage.setItem(storedKey, data.conversationId);
          const oldKey = `chat_messages_temp`;
          const tempMessages = localStorage.getItem(oldKey);
          if (tempMessages) {
            const newKey = `chat_messages_${data.conversationId}`;
            localStorage.setItem(newKey, tempMessages);
            localStorage.removeItem(oldKey);
          }
        }
      });
    }

    return () => {
      if (chatApi && chatApi.off) {
        chatApi.off("new_message");
        chatApi.off("messages_loaded");
        chatApi.off("message_deleted");
        chatApi.off("conversation_created");
      }
    };
  }, [userId, userName, conversationId, isOpen, saveMessages, scrollToBottom]);

  // ✅ handleSendMessage with debugging logs
  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;
    
    console.log(`📤 [ChatWidget] handleSendMessage: userId=${userId}, conversationId=${conversationId}, msg=${inputMessage.trim()}`);
    
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
    
    if (chatApi && chatApi.sendMessage) {
      if (!conversationId) {
        chatApi.sendMessage('new', inputMessage.trim(), userId);
      } else {
        chatApi.sendMessage(conversationId, inputMessage.trim());
      }
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

  const onCloseHandler = () => {
    if (onClose) onClose();
  };

  if (!isOpen) return null;

  const isLoggedIn = !!localStorage.getItem('userToken') || !!localStorage.getItem('token');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 md:p-4 overflow-hidden">
      {/* Outer container – full height, prevents scrolling */}
      <div className="flex w-full max-w-lg flex-col h-[100dvh] max-h-[100dvh] bg-[#0a0e1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header – fixed height */}
        <div className="flex items-center justify-between border-b border-white/10 bg-[#111111] px-4 py-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <MessageCircle size={18} className="text-lime-400" />
            <span className="font-semibold text-white">Support Chat</span>
            {isConnected && <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />}
          </div>
          <button onClick={onCloseHandler} className="rounded-lg p-1 text-slate-400 hover:text-white transition">
            <X size={20} />
          </button>
        </div>

        {/* Messages area – takes remaining space, scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
          {!isLoggedIn ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-sm text-slate-400">
              <LogIn size={48} className="mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium text-white">Login Required</p>
              <p className="mt-1 text-xs">Please log in to chat with our support team.</p>
              <button onClick={() => window.location.href = '/login'} className="mt-4 px-4 py-2 rounded-lg bg-cyan-500 text-black text-sm font-medium hover:bg-cyan-400 transition">
                Go to Login
              </button>
            </div>
          ) : isLoading ? (
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

        {/* Input area – fixed at bottom, never shrinks */}
        {isLoggedIn && (
          <div className="border-t border-white/10 bg-[#111111] p-3 flex-shrink-0">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Type your message..."
                className="flex-1 resize-none rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none focus:border-lime-400"
                rows={1}
                style={{ minHeight: "40px", maxHeight: "100px" }}
                onFocus={() => {
                  setTimeout(() => {
                    inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 300);
                }}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim()}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime-400 text-black transition hover:bg-lime-300 disabled:opacity-50 flex-shrink-0"
              >
                <Send size={18} />
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] text-slate-500">
              Our team typically responds within a few hours
            </p>
          </div>
        )}
      </div>
