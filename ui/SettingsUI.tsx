import React from 'react';
import { CheckIcon, CaretDownIcon } from '@phosphor-icons/react';

// --- Generic Toggle Switch ---
interface ToggleProps {
    label: string;
    subLabel?: string;
    checked: boolean;
    onChange: () => void;
    icon?: React.ReactNode;
    darkTheme?: boolean;
}

export const SettingsToggle: React.FC<ToggleProps> = ({ label, subLabel, checked, onChange, icon, darkTheme = true }) => (
    <div
        onClick={onChange}
        className="group flex items-center justify-between py-3 cursor-pointer select-none"
    >
        <div className="flex items-center gap-4">
            {icon && (
                <span className={`transition-colors duration-300 ${checked ? (darkTheme ? 'text-white' : 'text-black') : (darkTheme ? 'text-white/60' : 'text-gray-400')}`}>{icon}</span>
            )}
            <div>
                <span className={`block text-sm font-bold transition-colors ${checked ? (darkTheme ? 'text-white' : 'text-black') : (darkTheme ? 'text-white/60 group-hover:text-white/80' : 'text-gray-500 group-hover:text-black')}`}>{label}</span>
                {subLabel && <span className={`block text-xs mt-0.5 ${darkTheme ? 'text-white/50' : 'text-gray-400 font-medium'}`}>{subLabel}</span>}
            </div>
        </div>

        {/* Netflix-style Checkbox */}
        <div className={`w-6 h-6 border flex items-center justify-center transition-all duration-200 rounded-sm ${checked ? (darkTheme ? 'bg-white border-white' : 'bg-red-600 border-red-600 shadow-md') : (darkTheme ? 'bg-transparent border-white/30 group-hover:border-white/60' : 'bg-white border-gray-300 group-hover:border-gray-500')}`}>
            <CheckIcon size={18} weight="bold" className={`${darkTheme ? 'text-black' : 'text-white'} transition-transform duration-300 ${checked ? 'scale-100' : 'scale-0'} stroke-[3px]`} />
        </div>
    </div>
);

// --- Generic Range Slider ---
interface SliderProps {
    label: string;
    value: number;
    min: number;
    max: number;
    unit?: string;
    onChange: (val: number) => void;
    disabled?: boolean;
    darkTheme?: boolean;
}

export const SettingsSlider: React.FC<SliderProps> = ({ label, value, min, max, unit, onChange, disabled, darkTheme = true }) => (
    <div className={`space-y-4 transition-opacity duration-300 ${disabled ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
        <div className={`flex justify-between text-xs uppercase font-black tracking-widest ${darkTheme ? 'text-white/60' : 'text-gray-400'}`}>
            <span>{label}</span>
            <span className={`${darkTheme ? 'text-white' : 'text-black'} font-bold`}>{value}{unit}</span>
        </div>
        <div className={`relative h-1.5 rounded-full group cursor-pointer ${darkTheme ? 'bg-white/10' : 'bg-gray-100'}`}>
            <div
                className={`absolute top-0 left-0 h-full rounded-full transition-all duration-150 ${darkTheme ? 'bg-white' : 'bg-red-600'}`}
                style={{ width: `${((value - min) / (max - min)) * 100}%` }}
            />
            {/* Thumb */}
            <div
                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full shadow-xl transition-all ${darkTheme ? 'bg-white scale-100' : 'bg-white border-2 border-red-600 scale-100 shadow-md'}`}
                style={{ left: `${((value - min) / (max - min)) * 100}%`, transform: 'translate(-50%, -50%)' }}
            />
            <input
                type="range"
                min={min} max={max}
                value={value}
                onChange={(e) => onChange(parseInt(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer touch-none"
            />
        </div>
    </div>
);

// --- Selection Button Group ---
interface Option {
    id: string;
    label?: string;
    value?: string; // For colors
    icon?: React.ReactNode;
}

interface SelectGroupProps {
    label: string;
    options: Option[];
    selectedId: string;
    onChange: (id: any) => void;
    type?: 'text' | 'color' | 'icon';
    darkTheme?: boolean;
}

export const SettingsSelectGroup: React.FC<SelectGroupProps> = ({ label, options, selectedId, onChange, type = 'text', darkTheme = true }) => {

    if (type === 'text') {
        return (
            <div className="space-y-3">
                <label className={`text-xs uppercase font-black tracking-widest ${darkTheme ? 'text-white/60' : 'text-gray-400'}`}>{label}</label>
                <div className="relative group">
                    <select
                        value={selectedId}
                        onChange={(e) => onChange(e.target.value)}
                        className={`w-full appearance-none border-2 rounded-sm pl-4 pr-10 py-3.5 focus:outline-none cursor-pointer transition-all text-sm font-bold shadow-sm ${darkTheme ? 'bg-[#222] border-white/10 text-white hover:bg-[#333] focus:border-white/30' : 'bg-white border-gray-100 text-black hover:border-gray-300 focus:border-red-500'}`}
                    >
                        {options.map((opt) => (
                            <option key={opt.id} value={opt.id} className={darkTheme ? 'bg-[#222] text-white/80' : 'bg-white text-black'}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                        <CaretDownIcon size={18} className={darkTheme ? 'text-white/60' : 'text-gray-400'} weight="bold" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 pb-2">
            <label className={`text-xs uppercase font-black tracking-widest ${darkTheme ? 'text-white/60' : 'text-gray-400'}`}>{label}</label>
            <div className="flex gap-4 flex-wrap">
                {options.map((opt) => {
                    const isSelected = selectedId === opt.id;

                    if (type === 'color') {
                        return (
                            <button
                                key={opt.id}
                                onClick={() => onChange(opt.id)}
                                className={`w-12 h-12 rounded-sm shadow-lg border-2 transition-all duration-300 ${isSelected ? (darkTheme ? 'border-white scale-110' : 'border-red-600 scale-110 ring-4 ring-red-50') : 'border-transparent opacity-60 hover:opacity-100 hover:scale-105'}`}
                                style={{ backgroundColor: opt.value }}
                                title={opt.label || opt.id}
                            />
                        );
                    }

                    if (type === 'icon') {
                        return (
                            <button
                                key={opt.id}
                                onClick={() => onChange(opt.id)}
                                className={`px-5 py-2.5 rounded-sm text-sm font-bold transition-all duration-200 border-2 flex items-center gap-2 ${isSelected ? (darkTheme ? 'border-white text-white bg-white/10 shadow-lg' : 'border-red-600 text-red-600 bg-red-50 shadow-md') : (darkTheme ? 'border-transparent text-white/50 hover:text-white/70 hover:bg-white/5' : 'border-gray-100 text-gray-500 hover:text-black hover:border-gray-300 bg-gray-50/30')}`}
                            >
                                {opt.icon}
                                {opt.label && <span className="text-[10px] uppercase font-black">{opt.label}</span>}
                            </button>
                        );
                    }
                    return null;
                })}
            </div>
        </div>
    );
};

// --- Generic Text Input ---
interface InputProps {
    label: string;
    subLabel?: string;
    value: string;
    placeholder?: string;
    onChange: (val: string) => void;
    darkTheme?: boolean;
    type?: 'text' | 'password';
}

export const SettingsInput: React.FC<InputProps> = ({ label, subLabel, value, placeholder, onChange, darkTheme = true, type = 'text' }) => (
    <div className="space-y-3">
        <div>
            <label className={`block text-xs uppercase font-black tracking-widest ${darkTheme ? 'text-white/60' : 'text-gray-400'}`}>{label}</label>
            {subLabel && <span className={`block text-[10px] mt-0.5 ${darkTheme ? 'text-white/40' : 'text-gray-400 font-medium italic'}`}>{subLabel}</span>}
        </div>
        <input
            type={type}
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full appearance-none border-2 rounded-sm px-4 py-3.5 focus:outline-none transition-all text-sm font-bold shadow-sm ${darkTheme ? 'bg-[#222] border-white/10 text-white placeholder:text-white/20 hover:bg-[#333] focus:border-white/30' : 'bg-white border-gray-100 text-black placeholder:text-gray-300 hover:border-gray-300 focus:border-red-500'}`}
        />
    </div>
);