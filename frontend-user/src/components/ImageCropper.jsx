import { useEffect, useRef, useState } from "react";

export default function ImageCropper({ imageFile, onCropComplete, onCancel }) {
  const [zoom, setZoom] = useState(1);
  const [imageSrc, setImageSrc] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  
  const imageRef = useRef(null);
  const containerRef = useRef(null);
  const cropSize = 200;

  // Load image from file
  useEffect(() => {
    if (imageFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImageSrc(e.target.result);
      };
      reader.readAsDataURL(imageFile);
    }
  }, [imageFile]);

  // Calculate crop position when image loads
  useEffect(() => {
    if (imageRef.current && imageLoaded) {
      const img = imageRef.current;
      const naturalWidth = img.naturalWidth;
      const naturalHeight = img.naturalHeight;
      
      setImageDimensions({
        width: naturalWidth,
        height: naturalHeight
      });
      
      // Center the crop area
      setCropPosition({
        x: Math.max(0, (naturalWidth - cropSize) / 2),
        y: Math.max(0, (naturalHeight - cropSize) / 2)
      });
    }
  }, [imageLoaded, cropSize]);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !imageRef.current || !imageDimensions.width) return;
    
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    
    // Calculate movement based on zoom
    const scale = zoom;
    const moveX = dx / scale;
    const moveY = dy / scale;
    
    const newX = Math.min(
      Math.max(0, cropPosition.x - moveX),
      imageDimensions.width - cropSize
    );
    const newY = Math.min(
      Math.max(0, cropPosition.y - moveY),
      imageDimensions.height - cropSize
    );
    
    setCropPosition({ x: newX, y: newY });
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleCrop = () => {
    if (!imageLoaded || !imageRef.current) {
      alert("Please wait for image to load");
      return;
    }
    
    const image = imageRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = cropSize;
    canvas.height = cropSize;
    
    ctx.drawImage(
      image,
      cropPosition.x, cropPosition.y, cropSize, cropSize,
      0, 0, cropSize, cropSize
    );
    
    canvas.toBlob((blob) => {
      const file = new File([blob], "cropped-avatar.jpg", { type: "image/jpeg" });
      onCropComplete(file);
    }, "image/jpeg", 0.9);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0e1a] p-5 shadow-2xl">
        <h3 className="mb-4 text-xl font-bold text-white">Crop Avatar</h3>
        
        <div className="relative">
          <div 
            ref={containerRef}
            className="relative w-full h-80 overflow-hidden rounded-xl bg-[#1a1a1a] cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {imageSrc && (
              <img
                ref={imageRef}
                src={imageSrc}
                alt="Crop preview"
                className="absolute max-w-none"
                style={{
                  top: '50%',
                  left: '50%',
                  transform: `translate(-50%, -50%) scale(${zoom})`,
                  transformOrigin: 'center',
                }}
                draggable={false}
                onLoad={() => setImageLoaded(true)}
              />
            )}
          </div>
          {/* Crop overlay mask */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="w-[200px] h-[200px] border-2 border-white rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.7)]" />
            </div>
          </div>
        </div>
        
        <div className="mt-4">
          <label className="mb-2 block text-sm text-slate-400">Zoom</label>
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-full accent-cyan-500"
          />
          <p className="mt-2 text-xs text-slate-500">Drag image to position, use zoom to adjust size</p>
        </div>
        
        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-white transition hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            onClick={handleCrop}
            disabled={!imageLoaded}
            className="flex-1 rounded-xl bg-cyan-500 py-2.5 font-semibold text-black transition hover:bg-cyan-400 disabled:opacity-50"
          >
            Apply Crop
          </button>
        </div>
      </div>
    </div>
  );
}