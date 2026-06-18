import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TooltipWrapper: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className }) => {
  const [show, setShow] = useState(false);
  return (
    <div
      className={`relative flex items-center justify-center${className ? ' ' + className : ''}`}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.9, x: '-50%' }}
            animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
            exit={{ opacity: 0, y: 2, scale: 0.95, x: '-50%' }}
            transition={{ duration: 0.1 }}
            className="absolute bottom-full left-1/2 mb-3 flex flex-col items-center z-[110] pointer-events-none"
            style={{ transformOrigin: 'bottom center' }}
          >
            <div className="bg-[#e6e6e6] text-[#141414] text-[15px] font-extrabold px-5 py-3 rounded-[1px] shadow-[0_8px_24px_rgba(0,0,0,0.5)] whitespace-nowrap leading-none select-none">
              {label}
            </div>
            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[#e6e6e6] -mt-[1px]" />
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </div>
  );
};

export default TooltipWrapper;
