import React, { useState, useRef } from 'react';

const TooltipWrapper: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className }) => {
  const [show, setShow] = useState(false);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = () => {
    if (showTimerRef.current) return;
    showTimerRef.current = setTimeout(() => {
      showTimerRef.current = null;
      setShow(true);
    }, 300);
  };

  const handleLeave = () => {
    if (showTimerRef.current) { clearTimeout(showTimerRef.current); showTimerRef.current = null; }
    setShow(false);
  };

  return (
    <div
      className={`relative flex items-center justify-center${className ? ' ' + className : ''}`}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <div
        className="absolute bottom-full left-1/2 mb-3 flex flex-col items-center z-[110] pointer-events-none"
        style={{
          transform: `translateX(-50%) translateY(${show ? '0px' : '4px'}) scale(${show ? 1 : 0.9})`,
          opacity: show ? 1 : 0,
          visibility: show ? 'visible' : 'hidden',
          transition: show
            ? 'opacity 0.08s ease-out, transform 0.08s ease-out'
            : 'opacity 0.06s ease-in, transform 0.06s ease-in, visibility 0s linear 0.06s',
          transformOrigin: 'bottom center',
        }}
      >
        <div className="bg-[#e6e6e6] text-[#141414] text-[15px] font-extrabold px-5 py-3 rounded-[1px] shadow-[0_8px_24px_rgba(0,0,0,0.5)] whitespace-nowrap leading-none select-none">
          {label}
        </div>
        <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[#e6e6e6] -mt-[1px]" />
      </div>
      {children}
    </div>
  );
};

export default TooltipWrapper;
