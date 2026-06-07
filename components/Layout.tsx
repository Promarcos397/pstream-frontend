import React, { ReactNode } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';

import useScroll from '../hooks/useScroll';
import { useIsMobile } from '../hooks/useIsMobile';

interface LayoutProps {
  children: ReactNode;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  showFooter?: boolean;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  searchQuery,
  setSearchQuery,
  activeTab,
  setActiveTab,
  showFooter = true
}) => {
  const isScrolled = useScroll(0);
  const isMobile = useIsMobile();

  return (
    <div className="bg-black md:bg-[#141414] min-h-screen font-sans text-white selection:bg-red-600 selection:text-white">
      {/* Navbar is fixed at top-0 */}
      <Navbar
        isScrolled={isScrolled}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Content Area — dynamically applies padding depending on touch/sidebar state */}
      <div 
        className={`min-h-screen transition-all duration-300 ${
          isMobile 
            ? 'pb-[calc(76px+env(safe-area-inset-bottom))] sm:pb-0 sm:pl-[72px]' 
            : 'pb-0 pl-0'
        }`}
      >
        {children}
      </div>

      {showFooter && <Footer />}
    </div>
  );
};

export default Layout;