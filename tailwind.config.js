/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./settings/**/*.{js,ts,jsx,tsx}",
        "./pages/**/*.{js,ts,jsx,tsx}",
        "./context/**/*.{js,ts,jsx,tsx}",
        "./*.{js,ts,jsx,tsx}"
    ],
    theme: {
        extend: {
            colors: {
                netflix: {
                    red: '#E50914',
                    black: '#141414',
                    dark: '#181818',
                    gray: '#e5e5e5'
                }
            },
            fontFamily: {
                sans: ['"Harmonia Sans"', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
                bebas: ['"Bebas Neue"', 'sans-serif'],
                alfa: ['"Alfa Slab One"', 'cursive'],
                leaner: ['"Leaner Bold"', 'sans-serif'],
                'harmonia-mono': ['"Harmonia Sans Mono"', 'monospace'],
                'harmonia-condensed': ['"Harmonia Sans Condensed"', 'sans-serif'],
                'harmonia-black': ['"Harmonia Sans Black Italic"', 'sans-serif'],
            },
            keyframes: {
                fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
                slideUp: { '0%': { transform: 'translateY(50px)', opacity: 0 }, '100%': { transform: 'translateY(0)', opacity: 1 } },
                scaleIn: { '0%': { transform: 'scale(0.9)', opacity: 0 }, '100%': { transform: 'scale(1)', opacity: 1 } },
                popIn: { '0%': { transform: 'scale(0.8) translateY(20px)', opacity: 0 }, '100%': { transform: 'scale(1) translateY(0)', opacity: 1 } },
                shimmer: { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(100%)' } }
            },
            animation: {
                fadeIn: 'fadeIn 0.5s ease-out',
                slideUp: 'slideUp 0.5s ease-out',
                scaleIn: 'scaleIn 0.3s ease-out',
                popIn: 'popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                shimmer: 'shimmer 1.5s infinite',
            }
        }
    },
    plugins: [],
}
