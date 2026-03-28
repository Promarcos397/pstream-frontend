import React from 'react';
import { WarningCircleIcon } from '@phosphor-icons/react';

interface PlaceholderSectionProps {
    title: string;
    message: string;
    icon?: React.ReactNode;
}

const PlaceholderSection: React.FC<PlaceholderSectionProps> = ({ title, message, icon }) => {
    return (
        <div className="flex flex-col items-center justify-center p-12 text-center animate-fadeIn">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-6 ring-1 ring-white/10">
                {icon || <WarningCircleIcon size={32} className="text-gray-500" />}
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
            <p className="text-gray-400 max-w-sm mx-auto text-sm leading-relaxed">
                {message}
            </p>
        </div>
    );
};

export default PlaceholderSection;
