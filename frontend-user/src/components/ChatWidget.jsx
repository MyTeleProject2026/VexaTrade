// frontend-user/src/components/ChatWidget.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, X, Send, LogIn, WifiOff } from "lucide-react";
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
  const [connectionState, setConnectionState] = useState(chatApi.getConnectionState?.() || "disconnected");
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const conversationIdRef = useRef(null);
  const isOpenRef = useRef(isOpen);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const loadLocalMessages = useCallback(() => {
    if (!userId) return;
    const storedKey = `chat_user_${userId}_conversation`;
    const storedConvId = localStorage.getItem(storedKey);
    if (!storedConvId) {
      setConversationId(null);
      setMessages([]);
      setIsLoading(false);
      return;
    }

    setConversationId(storedConvId);
    try {
      const storedMessages = localStorage.getItem(`chat_messages_${storedConvId}`);
      const parsed = storedMessages ? JSON.parse(storedMessages) : [];
      setMessages(Array.isArray(parsed) ? parsed : []);
      setUnreadCount(Array.isArray(parsed) ? parsed.filter((msg) => msg.senderType === "admin" && !msg.read).length : 0);
    } catch (_) {
      setMessages([]);
    }
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    loadLocalMessages();
  }, [loadLocalMessages]);

  const saveMessages = useCallback((msgs) => {
    const id = conversationIdRef.current;
    if (!id) return;
    try { localStorage.setItem(`chat_messages_${id}`, JSON.stringify(msgs)); } catch (_) {}
  }, []);

  // Socket is an auxiliary real-time channel. It never blocks the user platform.
  // Keep one connection lifecycle and do not reconnect just because the modal opens/closes.
  useEffect(() => {
    if (!userId) return undefined;
    const token = localStorage.getItem("userToken") || localStorage.getItem("accessToken") || localStorage.getItem("token") || "";
    if (!token) return undefined;

    chatApi.connect(userId, userName, token);
    const unsubscribeState = chatApi.onConnectionState?.((state) => {
      setConnectionState(state?.state || "disconnected");
    });

    const unsubscribeNew = chatApi.onNewMessage((data) => {
      const incomingConversationId = data?.conversationId;
      if (!incomingConversationId) return;

      if (String(incomingConversationId) === String(conversationIdRef.current)) {
        setMessages((prev) => {
          const incomingId = data?.id;
          if (incomingId && prev.some((msg) => String(msg.id) === String(incomingId))) return prev;
          const next = [...prev, {
            id: incomingId || `remote-${Date.now()}`,
            message: data.message,
            senderType: data.senderType || "admin",
            createdAt: data.createdAt || data.created_at || new Date().toISOString(),
            read: data.senderType === "user" || isOpenRef.current,
            isAutoReply: !!data.isAutoReply,
          }];
          saveMessages(next);
          return next;
        });
        if (isOpenRef.current && data.senderType === "admin") chatApi.markRead(incomingConversationId);
      } else if (data.senderType === "admin") {
        setUnreadCount((count) => count + 1);
      }
    });

    const unsubscribeDeleted = chatApi.onMessageDeleted?.((data) => {
      if (String(data?.conversationId) !== String(conversationIdRef.current)) return;
      setMessages((prev) => {
        const next = prev.filter((msg) => String(msg.id) !== String(data.messageId));
        saveMessages(next);
        return next;
      });
    });

    const unsubscribeLoaded = chatApi.onMessagesLoaded((data) => {
      if (String(data?.conversationId) !== String(conversationIdRef.current)) return;
      const next = Array.isArray(data?.messages) ? data.messages : [];
      setMessages(next);
      saveMessages(next);
      setIsLoading(false);
      if (isOpenRef.current) {
        setUnreadCount(0);
        chatApi.markRead(data.conversationId);
      }
    });

    const unsubscribeCreated = chatApi.onConversationCreated?.((data) => {
      if (!data?.conversationId) return;
      setConversationId(String(data.conversationId));
      conversationIdRef.current = String(data.conversationId);
      localStorage.setItem(`chat_user_${userId}_conversation`, String(data.conversationId));
    });

    return () => {
      unsubscribeState?.();
      unsubscribeNew?.();
      unsubscribeDeleted?.();
      unsubscribeLoaded?.();
      unsubscribeCreated?.();
      // Do not disconnect the shared socket here; another mounted chat control may use it.
    };
  }, [userId, userName, saveMessages]);

  // Fetch conversation history only when a real socket is authenticated.
  useEffect(() => {
    if (!conversationId || connectionState !== "authenticated") return;
    setIsLoading(true);
    chatApi.getMessages(conversationId);
    const timer = window.setTimeout(() => setIsLoading(false), 4500);
    return () => window.clearTimeout(timer);
  }, [conversationId, connectionState]);

  useEffect(() => {
    if (isOpen && conversationId) {
      setUnreadCount(0);
      chatApi.markRead(conversationId);
    }
  }, [isOpen, conversationId]);

  const handleSendMessage = () => {
    const cleanMessage = inputMessage.trim();
    if (!cleanMessage || !userId) return;

    const targetConversation = conversationId || "new";
    const sent = chatApi.sendMessage(targetConversation, cleanMessage, userId);

    // Only create a local pending message when the socket is unavailable.
    // When connected, the server's authoritative new_message event owns the message.
    if (!sent) {
      const localMessage = {
        id: `local-${Date.now()}`,
        message: cleanMessage,
        senderType: "user",
        createdAt: new Date().toISOString(),
        read: true,
        pending: true,
      };
      setMessages((prev) => {
        const next = [...prev, localMessage];
        if (conversationId) saveMessages(next);
        return next;
      });
    }

    setInputMessage("");
    requestAnimationFrame(scrollToBottom);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) return null;

  const isLoggedIn = !!localStorage.getItem("userToken") || !!localStorage.getItem("accessToken") || !!localStorage.getItem("token");
  const socketLive = connectionState === "connected" || connectionState === "authenticated";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/70 p-2 backdrop-blur-sm md:p-4">
      <div className="flex h-[100dvh] max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a0e1a] shadow-2xl">
        <div className="flex flex-shrink-0 items-center justify-between border-b border-white/10 bg-[#111111] px-4 py-3">
          <div className="flex items-center gap-2">
            <MessageCircle size={18} className="text-lime-400" />
            <span className="font-semibold text-white">Support Chat</span>
            <span className={`h-2 w-2 rounded-full ${socketLive ? "bg-emerald-400" : "bg-slate-500"}`} />
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 transition hover:text-white" aria-label="Close support chat">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4 scrollbar-hide">
          {!isLoggedIn ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-sm text-slate-400">
              <LogIn size={48} className="mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium text-white">Login Required</p>
              <p className="mt-1 text-xs">Please log in to chat with our support team.</p>
              <button onClick={() => { window.location.href = "/login"; }} className="mt-4 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-black transition hover:bg-cyan-400">Go to Login</button>
            </div>
          ) : isLoading ? (
            <div className="flex h-full items-center justify-center text-center text-sm text-slate-400">
              <div className="animate-pulse">Loading messages…</div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center text-sm text-slate-400">
              <div>
                <MessageCircle size={32} className="mx-auto mb-2 opacity-30" />
                <p>No messages yet.</p>
                <p className="mt-1 text-xs">Send a message to our support team!</p>
                {!socketLive && <p className="mt-2 inline-flex items-center gap-1 text-[10px] text-amber-300"><WifiOff size={11} /> Real-time chat is reconnecting; the platform remains available.</p>}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.senderType === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${msg.senderType === "user" ? "bg-lime-400 text-black" : "bg-[#1a1e2a] text-white"}`}>
                  {msg.senderType === "admin" && <p className="mb-1 text-xs text-lime-400">Support Team</p>}
                  <p className="break-words text-sm">{msg.message}</p>
                  <p className={`mt-1 text-[10px] ${msg.senderType === "user" ? "text-black/60" : "text-slate-400"}`}>{formatTime(msg.created_at || msg.createdAt)}</p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {isLoggedIn && (
          <div className="flex-shrink-0 border-t border-white/10 bg-[#111111] p-3">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Type your message..."
                className="min-h-10 max-h-24 flex-1 resize-none rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none focus:border-lime-400"
                rows={1}
              />
              <button onClick={handleSendMessage} disabled={!inputMessage.trim()} className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-lime-400 text-black transition hover:bg-lime-300 disabled:opacity-50" aria-label="Send message">
                <Send size={18} />
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] text-slate-500">Our team typically responds within a few hours</p>
          </div>
        )}
      </div>
    </div>
  );
}
