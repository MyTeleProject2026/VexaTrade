// frontend-user/src/components/DraggableChatButton.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, X, Send, Headphones } from "lucide-react";

export default function DraggableChatButton({ 
  onClick, 
  unreadCount = 0, 
  isOpen = false 
}) {
  const [position, setPosition] = useState(() => {
    // Load saved position from localStorage
    const saved = localStorage.getItem('chat_button_position');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return { x: 0, y: 50 };
      }
    }
    return { x: 0, y: 50 }; // Default position (50% from top)
  });
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [startPosition, setStartPosition] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);
  const buttonRef = useRef(null);
  const containerRef = useRef(null);

  // ─── Save position to localStorage when it changes ───
  useEffect(() => {
    localStorage.setItem('chat_button_position', JSON.stringify(position));
  }, [position]);

  // ─── Handle drag start ───
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
    setHasMoved(false);
    setDragStart({ x: e.clientX, y: e.clientY });
    setStartPosition({ ...position });
  }, [position]);

  const handleTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    setIsDragging(true);
    setHasMoved(false);
    setDragStart({ x: touch.clientX, y: touch.clientY });
    setStartPosition({ ...position });
  }, [position]);

  // ─── Handle drag move ───
  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    e.preventDefault();
    
    const deltaY = e.clientY - dragStart.y;
    const newY = startPosition.y + deltaY;
    
    // Get viewport height for bounds
    const viewportHeight = window.innerHeight;
    const buttonHeight = 70; // Approximate height of button
    const padding = 20;
    
    // Constrain Y position (10% to 90% of viewport)
    const minY = 10;
    const maxY = 90;
    const constrainedY = Math.max(minY, Math.min(maxY, newY));
    
    // Check if moved significantly
    if (Math.abs(deltaY) > 5) {
      setHasMoved(true);
    }
    
    setPosition({
      x: 0,
      y: constrainedY
    });
  }, [isDragging, dragStart.y, startPosition.y]);

  const handleTouchMove = useCallback((e) => {
    if (!isDragging) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    const deltaY = touch.clientY - dragStart.y;
    const newY = startPosition.y + deltaY;
    
    const viewportHeight = window.innerHeight;
    const minY = 10;
    const maxY = 90;
    const constrainedY = Math.max(minY, Math.min(maxY, newY));
    
    if (Math.abs(deltaY) > 5) {
      setHasMoved(true);
    }
    
    setPosition({
      x: 0,
      y: constrainedY
    });
  }, [isDragging, dragStart.y, startPosition.y]);

  // ─── Handle drag end ───
  const handleMouseUp = useCallback((e) => {
    setIsDragging(false);
    // Only trigger click if not dragged
    if (!hasMoved && onClick) {
      onClick();
    }
  }, [hasMoved, onClick]);

  const handleTouchEnd = useCallback((e) => {
    setIsDragging(false);
    // Only trigger click if not dragged
    if (!hasMoved && onClick) {
      onClick();
    }
  }, [hasMoved, onClick]);

  // ─── Add global event listeners ───
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
      
      // Prevent text selection during drag
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  // ─── Hide button when chat is open ───
  if (isOpen) return null;

  return (
    <div 
      ref={containerRef}
      className="fixed right-4 z-50 touch-none"
      style={{
        top: `${position.y}%`,
        transform: 'translateY(-50%)',
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
    >
      <div
        ref={buttonRef}
        className="relative group"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* ─── Drag indicator ─── */}
        <div className="absolute -right-1 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="w-1 h-4 rounded-full bg-white/20"></div>
          <div className="w-1 h-4 rounded-full bg-white/20"></div>
          <div className="w-1 h-4 rounded-full bg-white/20"></div>
        </div>

        {/* ─── Main Button ─── */}
        <button
          className={`
            relative flex items-center justify-center 
            w-14 h-14 rounded-full 
            bg-gradient-to-r from-lime-400 to-emerald-500 
            text-black shadow-xl 
            transition-all duration-200 
            hover:scale-105 hover:shadow-lime-500/30 
            active:scale-95
            ${isDragging ? 'scale-110 shadow-2xl' : ''}
          `}
          style={{
            touchAction: 'none',
          }}
        >
          {/* Chat Icon */}
          <MessageCircle size={24} className="relative z-10" />
          
          {/* Animated ring */}
          <div className="absolute inset-0 rounded-full bg-lime-400/20 animate-ping opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          
          {/* Glow effect */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-lime-400 to-emerald-500 blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-300"></div>

          {/* Unread Badge */}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-lg ring-2 ring-black/20 z-20 animate-bounce">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* ─── Drag hint tooltip ─── */}
        <div className="absolute -left-20 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          <div className="bg-black/80 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded-lg border border-white/10 whitespace-nowrap">
            Drag to move
          </div>
        </div>

        {/* ─── "Chat" label ─── */}
        <div className="absolute -right-16 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          <span className="text-[10px] font-medium text-white/60 tracking-wider">
            CHAT
          </span>
        </div>
      </div>
    </div>
  );
}
