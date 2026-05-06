import React, { useState } from 'react';
import { FacebookLogoIcon, InstagramLogoIcon, TwitterLogoIcon, YoutubeLogoIcon } from '@phosphor-icons/react';

const Footer: React.FC = () => {
  const [showServiceCode, setShowServiceCode] = useState(false);
  const serviceCode = "072-491"; // Example service code

  const socialIcons = [
    { name: 'facebook', path: 'M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z' },
    { name: 'instagram', path: 'M12.31 2C16.82 2 17.36 2.02 19.13 2.1c1.64.08 2.53.37 3.06.58.7.27 1.2.6 1.7 1.1.5.5.83 1.01 1.1 1.7.21.53.5 1.42.58 3.06.08 1.77.1 2.31.1 6.82 0 4.51-.02 5.05-.1 6.82-.08 1.64-.37 2.53-.58 3.06-.27.7-.6 1.2-1.1 1.7-.5.5-1.01.83-1.7 1.1-.53.21-1.42.5-3.06.58-1.77.08-2.31.1-6.82.1-4.51 0-5.05-.02-6.82-.1-1.64-.08-2.53-.37-3.06-.58-.7-.27-1.2-.6-1.7-1.1-.5-.5-.83-1.01-1.1-1.7-.21-.53-.5-1.42-.58-3.06C2.02 17.05 2 16.51 2 12c0-4.51.02-5.05.1-6.82.08-1.64.37-2.53.58-3.06.27-.7.6-1.2 1.1-1.7.5-.5 1.01-.83 1.7-1.1.53-.21 1.42-.5 3.06-.58C7.26 2.02 7.8 2 12.31 2zm-1.67 1.8c-3.9 0-4.36.02-5.89.09-1.53.07-2.36.32-2.91.54-.73.28-1.26.61-1.81 1.16-.55.55-.88 1.08-1.16 1.81-.22.55-.47 1.38-.54 2.91C-1.76 11.96 0 12 0 12c0 0 1.78.04 1.85 1.57.07 1.53.32 2.36.54 2.91.28.73.61 1.26 1.16 1.81.55.55 1.08.88 1.81 1.16.55.22 1.38.47 2.91.54 1.53.07 1.99.09 5.89.09 3.9 0 4.36-.02 5.89-.09 1.53-.07 2.36-.32 2.91-.54.73-.28 1.26-.61 1.81-1.16.55-.55.88-1.08 1.16-1.81.22-.55.47-1.38.54-2.91.07-1.53.09-1.99.09-5.89 0-3.9-.02-4.36-.09-5.89-.07-1.53-.32-2.36-.54-2.91-.28-.73-.61-1.26-1.16-1.81-.55-.55-1.08-.88-1.81-1.16-.55-.22-1.38-.47-2.91-.54-1.53-.07-2-1.99.09-5.89.09zm1.67 3.55c2.62 0 4.75 2.13 4.75 4.75s-2.13 4.75-4.75 4.75S7.55 14.62 7.55 12 9.68 7.35 12.31 7.35zm0 1.8c-1.63 0-2.95 1.32-2.95 2.95s1.32 2.95 2.95 2.95 2.95-1.32 2.95-2.95-1.32-2.95-2.95-2.95zm5.34-3.55c.66 0 1.2.54 1.2 1.2 0 .66-.54 1.2-1.2 1.2-.66 0-1.2-.54-1.2-1.2 0-.66.54-1.2 1.2-1.2z' },
    { name: 'twitter', path: 'M22.162 5.656a8.384 8.384 0 0 1-2.402.658A4.196 4.196 0 0 0 21.6 4c-.82.488-1.719.83-2.656 1.015a4.182 4.182 0 0 0-7.126 3.814 11.874 11.874 0 0 1-8.62-4.37 4.168 4.168 0 0 0-.566 2.103c0 1.45.738 2.731 1.86 3.481a4.168 4.168 0 0 1-1.894-.523v.052a4.185 4.185 0 0 0 3.355 4.101 4.21 4.21 0 0 1-1.89.072A4.185 4.185 0 0 0 7.97 16.65a8.394 8.394 0 0 1-6.191 1.732 11.83 11.83 0 0 0 6.41 1.88c7.693 0 11.9-6.373 11.9-11.9 0-.18-.005-.362-.013-.54a8.496 8.496 0 0 0 2.087-2.165z' },
    { name: 'youtube', path: 'M21.582,5.188c-0.236-0.89-0.93-1.593-1.808-1.831C18.17,3,12,3,12,3S5.83,3,4.226,3.356c-0.878,0.239-1.572,0.941-1.808,1.831C2,6.776,2,10.094,2,10.094s0,3.318,0.418,4.906c0.236,0.89,0.93,1.593,1.808,1.831C5.83,17.188,12,17.188,12,17.188s6.17,0,7.774-0.356c0.878-0.239,1.572-0.941,1.808-1.831C22,13.412,22,10.094,22,10.094S22,6.776,21.582,5.188z M10,12.719V7.469l4.5,2.625L10,12.719z' }
  ];

  const links = [
    'Audio Description', 'Help Center', 'Gift Cards', 'Media Center',
    'Investor Relations', 'Jobs', 'Terms of Use', 'Privacy',
    'Legal Notices', 'Cookie Preferences', 'Corporate Information', 'Contact Us'
  ];

  return (
    <footer className="w-full bg-[#141414] text-[#808080] py-12 px-6 md:px-14 lg:px-20 text-sm mt-12 border-t border-gray-800/30">
      <div className="max-w-[1000px] mx-auto">

        {/* Social Icons */}
        <div className="flex space-x-6 mb-8">
          <FacebookLogoIcon size={24} weight="fill" className="hover:text-white cursor-pointer transition-colors duration-200" />
          <InstagramLogoIcon size={24} weight="fill" className="hover:text-white cursor-pointer transition-colors duration-200" />
          <TwitterLogoIcon size={24} weight="fill" className="hover:text-white cursor-pointer transition-colors duration-200" />
          <YoutubeLogoIcon size={24} weight="fill" className="hover:text-white cursor-pointer transition-colors duration-200" />
        </div>

        {/* Links Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-8 mb-8">
          {links.map((link) => (
            <a
              key={link}
              href="#"
              className="hover:underline hover:text-white transition-colors duration-200 text-xs md:text-sm"
              onClick={(e) => e.preventDefault()}
            >
              {link}
            </a>
          ))}
        </div>

        {/* Service Code Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowServiceCode(!showServiceCode)}
            className="border border-[#808080] px-4 py-1.5 hover:text-white hover:border-white transition-colors duration-200 text-xs tracking-wide uppercase"
          >
            {showServiceCode ? serviceCode : 'Service Code'}
          </button>
        </div>

        {/* Copyright */}
        <div className="text-xs">
          &copy; 2024 Pstream, Inc.
        </div>
      </div>
    </footer>
  );
};

export default Footer;