import React, { useState } from 'react';
import { InstagramLogoIcon, TwitterLogoIcon, YoutubeLogoIcon, GithubLogoIcon } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'TV Shows', path: '/tv' },
    { name: 'Movies', path: '/movies' },
    { name: 'New & Popular', path: '/new' },
    { name: 'My List', path: '/list' },
    { name: 'Settings', path: '/settings' },
    { name: 'Cookie Preferences', action: () => setShowPrivacyModal(true) },
    { name: 'Contact Us', path: '#' }
  ];

  return (
    <>
      <footer className="w-full bg-[#141414] text-[#808080] py-12 px-6 md:px-14 lg:px-20 text-sm mt-12">
        <div className="max-w-[1000px] mx-auto">

          {/* Social Icons */}
          <div className="flex space-x-6 mb-8">
            <InstagramLogoIcon size={24} weight="fill" className="hover:text-white cursor-pointer transition-colors duration-200" />
            <TwitterLogoIcon size={24} weight="fill" className="hover:text-white cursor-pointer transition-colors duration-200" />
            <YoutubeLogoIcon size={24} weight="fill" className="hover:text-white cursor-pointer transition-colors duration-200" />
            <a href="https://github.com" target="_blank" rel="noreferrer">
              <GithubLogoIcon size={24} weight="fill" className="hover:text-white cursor-pointer transition-colors duration-200" />
            </a>
          </div>

          {/* Links Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-8 mb-8">
            {navLinks.map((link) => (
              link.path ? (
                <Link
                  key={link.name}
                  to={link.path}
                  className="hover:underline hover:text-white transition-colors duration-200 text-xs md:text-sm"
                >
                  {link.name}
                </Link>
              ) : (
                <button
                  key={link.name}
                  onClick={link.action}
                  className="text-left hover:underline hover:text-white transition-colors duration-200 text-xs md:text-sm"
                >
                  {link.name}
                </button>
              )
            ))}
          </div>

          {/* Copyright */}
          <div className="text-xs mt-8">
            &copy; {new Date().getFullYear()} Pstream, Inc.
          </div>
        </div>
      </footer>

      {/* Basic Placeholder for Privacy Preference Center */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white text-black w-full max-w-2xl rounded-sm overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-gray-300 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-800">Privacy Preference Center</h2>
              <button onClick={() => setShowPrivacyModal(false)} className="text-3xl leading-none text-gray-500 hover:text-black">&times;</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-6">
               <div className="md:w-1/3 space-y-2 border-r pr-4 border-gray-200">
                  <div className="p-3 bg-red-600 text-white font-bold text-sm cursor-pointer border-l-4 border-red-800">General Description</div>
                  <div className="p-3 text-gray-600 font-bold text-sm hover:bg-gray-100 cursor-pointer">Essential Cookies</div>
                  <div className="p-3 text-gray-600 font-bold text-sm hover:bg-gray-100 cursor-pointer">Performance Cookies</div>
               </div>
               <div className="md:w-2/3 text-sm text-gray-700 space-y-4">
                  <h3 className="font-bold text-lg text-black">General Description</h3>
                  <p>This cookie tool will help you understand the use of cookies on the Pstream service, and how you can control the use of these cookies.</p>
                  <p>Privacy settings in most browsers allow you to prevent your browser from accepting some or all cookies, notify you when it receives a new cookie, or disable cookies altogether.</p>
               </div>
            </div>
            
            <div className="p-4 border-t border-gray-300 bg-gray-50 flex justify-start">
              <button onClick={() => setShowPrivacyModal(false)} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-sm transition-colors">
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Footer;