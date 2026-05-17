import { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, Send, Users } from "lucide-react";
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

export default function AdminChatPanel({ adminId, adminName }) {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const messagesEndRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!adminId) return;

    const token = localStorage.getItem("adminToken") || localStorage.getItem("admin_token") || "";
    
    adminChatApi.connect(adminId, adminName, token);
    setIsConnected(true);

    adminChatApi.onNewMessage((data) => {
      setConversations(prev => {
        const updated = prev.map(conv => 
          conv.id === data.conversationId 
            ? { ...conv, last_message: data.message, last_message_time: new Date().toISOString(), unread_admin: (conv.unread_admin || 0) + 1 }
            : conv
        );
        const convIndex = updated.findIndex(c => c.id === data.conversationId);
        if (convIndex !== -1) {
          const [moved] = updated.splice(convIndex, 1);
          return [moved, ...updated];
        }
        return updated;
      });

      if (selectedConversation?.id === data.conversationId) {
        setMessages(prev => [...prev, {
          id: data.id,
          message: data.message,
          senderType: data.senderType,
          createdAt: data.createdAt,
          userName: data.userName
        }]);
        adminChatApi.markRead(data.conversationId);
        setConversations(prev => prev.map(conv => conv.id === data.conversationId ? { ...conv, unread_admin: 0 } : conv));
      } else {
        setConversations(prev => prev.map(conv => conv.id === data.conversationId ? { ...conv, unread_admin: (conv.unread_admin || 0) + 1 } : conv));
      }
    });

    adminChatApi.onAdminConversations((data) => {
      setConversations(data.conversations || []);
      setIsLoading(false);
    });

    adminChatApi.onMessagesLoaded((data) => {
      setMessages(data.messages || []);
      scrollToBottom();
    });

    return () => {
      adminChatApi.off("new_message");
      adminChatApi.off("admin_conversations");
      adminChatApi.off("messages_loaded");
    };
  }, [adminId, adminName]);

  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
    setMessages([]);
    adminChatApi.getMessages(conversation.id);
    adminChatApi.markRead(conversation.id);
    setConversations(prev => prev.map(conv => conv.id === conversation.id ? { ...conv, unread_admin: 0 } : conv));
  };

  const handleSendMessage = () => {
    if (!inputMessage.trim() || !selectedConversation) return;
    adminChatApi.sendMessage(selectedConversation.id, inputMessage.trim());
    setMessages(prev => [...prev, {
      id: Date.now(),
      message: inputMessage.trim(),
      senderType: "admin",
      createdAt: new Date().toISOString(),
      userName: adminName
    }]);
    setInputMessage("");
    scrollToBottom();
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const totalUnread = conversations.reduce((sum, conv) => sum + (conv.unread_admin || 0), 0);

  return (
    <div className="fixed bottom-0 right-0 z-50 flex h-[90vh] w-full max-w-4xl flex-col bg-[#0a0e1a] border border-white/10 rounded-t-2xl shadow-2xl md:bottom-4 md:right-4 md:rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/10 bg-[#111111] px-4 py-3">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-lime-400" />
          <span className="font-semibold text-white">Support Chat Panel</span>
          {isConnected && <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />}
          {totalUnread > 0 && <span className="ml-2 rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">{totalUnread} new</span>}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 border-r border-white/10 flex flex-col">
          <div className="p-3 border-b border-white/10">
            <h3 className="text-sm font-semibold text-white">Active Conversations</h3>
            <p className="text-xs text-slate-400 mt-1">{conversations.length} chat{conversations.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-slate-400">Loading...</div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-400">No active conversations</div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  className={`w-full p-3 text-left transition ${selectedConversation?.id === conv.id ? "bg-lime-500/10 border-l-2 border-lime-400" : "hover:bg-white/5"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white text-sm">{conv.user_name || `User #${conv.user_id}`}</span>
                    {conv.unread_admin > 0 && <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">{conv.unread_admin}</span>}
                  </div>
                  <div className="mt-1 text-xs text-slate-400 truncate">{conv.user_email || ""}</div>
                  <div className="mt-1 text-xs text-slate-500 truncate">UID: {conv.user_uid || "-"}</div>
                  {conv.last_message && <div className="mt-2 text-xs text-slate-500 truncate">{conv.last_message}</div>}
                  {conv.last_message_time && <div className="mt-1 text-[10px] text-slate-600">{formatDate(conv.last_message_time)} {formatTime(conv.last_message_time)}</div>}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              <div className="border-b border-white/10 p-3 bg-[#0f0f0f]">
                <div className="font-semibold text-white">{selectedConversation.user_name || `User #${selectedConversation.user_id}`}</div>
                <div className="text-xs text-slate-400">{selectedConversation.user_email || ""} • UID: {selectedConversation.user_uid || "-"}</div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-center text-sm text-slate-400">
                    <div>
                      <MessageCircle size={32} className="mx-auto mb-2 opacity-30" />
                      <p>No messages yet</p>
                      <p className="mt-1 text-xs">Send a message to start the conversation</p>
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.senderType === "admin" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${msg.senderType === "admin" ? "bg-lime-400 text-black" : "bg-[#1a1e2a] text-white"}`}>
                        {msg.senderType === "user" && <p className="mb-1 text-xs text-lime-400">{msg.userName || selectedConversation.user_name || "User"}</p>}
                        <p className="text-sm break-words">{msg.message}</p>
                        <p className={`mt-1 text-[10px] ${msg.senderType === "admin" ? "text-black/60" : "text-slate-400"}`}>{formatTime(msg.created_at || msg.createdAt)}</p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-white/10 bg-[#111111] p-3">
                <div className="flex gap-2">
                  <textarea
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Type your response..."
                    className="flex-1 resize-none rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none focus:border-lime-400"
                    rows={2}
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
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-center text-sm text-slate-400">
              <div>
                <MessageCircle size={32} className="mx-auto mb-2 opacity-30" />
                <p>Select a conversation</p>
                <p className="mt-1 text-xs">Choose a user from the left panel to start chatting</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
