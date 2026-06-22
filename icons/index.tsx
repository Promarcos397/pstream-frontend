/**
 * Custom SVG icon library.
 * Export names match @phosphor-icons/react exactly — swap the import source,
 * nothing else changes in the consuming component.
 *
 * Usage:
 *   // before
 *   import { PlayIcon } from '@phosphor-icons/react';
 *   // after
 *   import { PlayIcon } from '../icons';
 *
 * Add new icons here whenever a phosphor icon needs a custom design.
 */

import React from 'react';

export interface IconProps {
    size?: number | string;
    weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
    color?: string;
    className?: string;
    style?: React.CSSProperties;
}

// ─── Play ────────────────────────────────────────────────────────────────────
export const PlayIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', className, style }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size} height={size}
        viewBox="0 0 256 256"
        fill={color}
        className={className}
        style={style}
        aria-hidden="true"
    >
        <path d="M240 128a15.74 15.74 0 0 1-7.6 13.71L88.32 229.65a16 16 0 0 1-16.2.3A15.86 15.86 0 0 1 64 216.13V39.87a15.86 15.86 0 0 1 8.12-13.82 16 16 0 0 1 16.2.3l144.08 87.94A15.74 15.74 0 0 1 240 128Z" />
    </svg>
);

// ─── Info (circle with i) ────────────────────────────────────────────────────
// Weights: thin · light · regular · bold · fill · duotone
// The "i" is drawn as filled geometry (dot circle + body pill), not as stroked text.
export const InfoIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', className, style, weight = 'regular' }) => {
    // Outer ring stroke widths
    const ringStroke: Record<string, number> = { thin: 8, light: 12, regular: 16, bold: 22, duotone: 16 };
    const sw = ringStroke[weight ?? 'regular'] ?? 16;

    // i-dot: filled circle above the body
    const dotCy = 82;
    const dotR: Record<string, number>  = { thin: 9, light: 11, regular: 12, bold: 14, fill: 14, duotone: 12 };
    const dot = dotR[weight ?? 'regular'] ?? 12;

    // i-body: filled pill (rounded rect), not a stroked line
    // Wider relative to height so it reads as a badge shape, not a text stem
    const bodyW: Record<string, number> = { thin: 18, light: 22, regular: 24, bold: 30, fill: 28, duotone: 24 };
    const bw = bodyW[weight ?? 'regular'] ?? 24;
    const bx = 128 - bw / 2;
    const bodyRx = 4;               // slight corner radius → rectangular bar

    // ── fill: solid circle, white i ─────────────────────────────────────────
    if (weight === 'fill') {
        return (
            <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 256 256" className={className} style={style} aria-hidden="true">
                <circle cx="128" cy="128" r="96" fill={color} />
                <circle cx="128" cy={dotCy} r={dot} fill="white" />
                <rect x={bx} y="112" width={bw} height="68" rx={bodyRx} fill="white" />
            </svg>
        );
    }

    // ── duotone: ghost fill + ring stroke + solid i ──────────────────────────
    if (weight === 'duotone') {
        return (
            <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 256 256" className={className} style={style} aria-hidden="true">
                <circle cx="128" cy="128" r="96" fill={color} fillOpacity="0.2" />
                <circle cx="128" cy="128" r="96" fill="none" stroke={color} strokeWidth={sw} />
                <circle cx="128" cy={dotCy} r={dot} fill={color} />
                <rect x={bx} y="112" width={bw} height="68" rx={bodyRx} fill={color} />
            </svg>
        );
    }

    // ── thin / light / regular / bold: outline ring + filled i ───────────────
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 256 256" className={className} style={style} aria-hidden="true">
            <circle cx="128" cy="128" r="96" fill="none" stroke={color} strokeWidth={sw} />
            <circle cx="128" cy={dotCy} r={dot} fill={color} />
            <rect x={bx} y="112" width={bw} height="68" rx={bodyRx} fill={color} />
        </svg>
    );
};

// ─── Speaker High (volume on) ────────────────────────────────────────────────
export const SpeakerHighIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', className, style, weight = 'regular' }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size} height={size}
        viewBox="0 0 256 256"
        fill="none"
        stroke={color}
        strokeWidth={weight === 'bold' ? 20 : weight === 'thin' ? 8 : 16}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={style}
        aria-hidden="true"
    >
        <path d="M80 168H32a8 8 0 0 1-8-8V96a8 8 0 0 1 8-8h48l72-56v192Z" />
        <path d="M172 112.5a32 32 0 0 1 0 31" />
        <path d="M192 97.05a64 64 0 0 1 0 61.9" />
        <path d="M221.67 80a96 96 0 0 1 0 96" />
    </svg>
);

// ─── Speaker Slash (muted) ───────────────────────────────────────────────────
export const SpeakerSlashIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', className, style, weight = 'regular' }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size} height={size}
        viewBox="0 0 256 256"
        fill="none"
        stroke={color}
        strokeWidth={weight === 'bold' ? 20 : weight === 'thin' ? 8 : 16}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={style}
        aria-hidden="true"
    >
        <line x1="48" y1="40" x2="208" y2="216" />
        <path d="M154.39 153.08 80 168H32a8 8 0 0 1-8-8V96a8 8 0 0 1 8-8h48l72-56v48.8" />
        <path d="M152 32v57.62" />
    </svg>
);

// ─── Arrow Counter-Clockwise (replay) ────────────────────────────────────────
export const ArrowCounterClockwiseIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', className, style, weight = 'regular' }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size} height={size}
        viewBox="0 0 256 256"
        fill="none"
        stroke={color}
        strokeWidth={weight === 'bold' ? 20 : weight === 'thin' ? 8 : 16}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={style}
        aria-hidden="true"
    >
        <path d="M79.93 199.85A88 88 0 1 0 40 128v16" />
        <polyline points="24 128 40 144 56 128" />
    </svg>
);

// ─── X / Close ───────────────────────────────────────────────────────────────
export const XIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', className, style, weight = 'regular' }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size} height={size}
        viewBox="0 0 256 256"
        fill="none"
        stroke={color}
        strokeWidth={weight === 'bold' ? 24 : weight === 'thin' ? 8 : 16}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={style}
        aria-hidden="true"
    >
        <line x1="200" y1="56" x2="56" y2="200" />
        <line x1="56" y1="56" x2="200" y2="200" />
    </svg>
);

// ─── Plus ────────────────────────────────────────────────────────────────────
export const PlusIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', className, style, weight = 'regular' }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size} height={size}
        viewBox="0 0 256 256"
        fill="none"
        stroke={color}
        strokeWidth={weight === 'bold' ? 24 : weight === 'thin' ? 8 : 16}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={style}
        aria-hidden="true"
    >
        <line x1="40" y1="128" x2="216" y2="128" />
        <line x1="128" y1="40" x2="128" y2="216" />
    </svg>
);

// ─── Check ───────────────────────────────────────────────────────────────────
export const CheckIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', className, style, weight = 'regular' }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size} height={size}
        viewBox="0 0 256 256"
        fill="none"
        stroke={color}
        strokeWidth={weight === 'bold' ? 24 : weight === 'thin' ? 8 : 16}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={style}
        aria-hidden="true"
    >
        <polyline points="40 144 96 200 216 72" />
    </svg>
);

// ─── Caret Down ──────────────────────────────────────────────────────────────
export const CaretDownIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', className, style, weight = 'regular' }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size} height={size}
        viewBox="0 0 256 256"
        fill={weight === 'fill' ? color : 'none'}
        stroke={weight === 'fill' ? 'none' : color}
        strokeWidth={weight === 'bold' ? 24 : 16}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={style}
        aria-hidden="true"
    >
        {weight === 'fill'
            ? <path d="m213.66 101.66-80 80a8 8 0 0 1-11.32 0l-80-80A8 8 0 0 1 53.66 90.34L128 164.69l74.34-74.35a8 8 0 0 1 11.32 11.32Z" />
            : <polyline points="208 96 128 176 48 96" />
        }
    </svg>
);

// ─── Caret Right ─────────────────────────────────────────────────────────────
export const CaretRightIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', className, style, weight = 'regular' }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size} height={size}
        viewBox="0 0 256 256"
        fill={weight === 'fill' ? color : 'none'}
        stroke={weight === 'fill' ? 'none' : color}
        strokeWidth={weight === 'bold' ? 24 : 16}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={style}
        aria-hidden="true"
    >
        {weight === 'fill'
            ? <path d="m181.66 133.66-80 80A8 8 0 0 1 88 208V48a8 8 0 0 1 13.66-5.66l80 80a8 8 0 0 1 0 11.32Z" />
            : <polyline points="96 48 176 128 96 208" />
        }
    </svg>
);

// ─── Caret Left ──────────────────────────────────────────────────────────────
export const CaretLeftIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', className, style, weight = 'regular' }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size} height={size}
        viewBox="0 0 256 256"
        fill={weight === 'fill' ? color : 'none'}
        stroke={weight === 'fill' ? 'none' : color}
        strokeWidth={weight === 'bold' ? 24 : 16}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={style}
        aria-hidden="true"
    >
        {weight === 'fill'
            ? <path d="M165.66 202.34a8 8 0 0 1-11.32 11.32l-80-80a8 8 0 0 1 0-11.32l80-80a8 8 0 0 1 11.32 11.32L91.31 128Z" />
            : <polyline points="160 208 80 128 160 48" />
        }
    </svg>
);

// ─── Magnifying Glass (search) ───────────────────────────────────────────────
export const MagnifyingGlassIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', className, style, weight = 'regular' }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size} height={size}
        viewBox="0 0 256 256"
        fill="none"
        stroke={color}
        strokeWidth={weight === 'bold' ? 20 : weight === 'thin' ? 8 : 16}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={style}
        aria-hidden="true"
    >
        <circle cx="112" cy="112" r="80" />
        <line x1="168.57" y1="168.57" x2="224" y2="224" />
    </svg>
);
