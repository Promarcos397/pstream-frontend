import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translations
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import pt from './locales/pt.json';
import ja from './locales/ja.json';
import it from './locales/it.json';
import ko from './locales/ko.json';
import zh from './locales/zh.json';
import ru from './locales/ru.json';
import nl from './locales/nl.json';
import tr from './locales/tr.json';
import pl from './locales/pl.json';
import sv from './locales/sv.json';
import ar from './locales/ar.json';
import hi from './locales/hi.json';

// Get saved language from localStorage
const getSavedLanguage = (): string => {
    try {
        const settings = localStorage.getItem('pstream-settings');
        if (settings) {
            const parsed = JSON.parse(settings);
            // Extract language code (e.g., 'en' from 'en-US')
            return parsed.displayLanguage?.split('-')[0] || 'en';
        }
    } catch { }
    return 'en';
};

const resources = {
    en: { translation: en },
    es: { translation: es },
    fr: { translation: fr },
    de: { translation: de },
    pt: { translation: pt },
    ja: { translation: ja },
    it: { translation: it },
    ko: { translation: ko },
    zh: { translation: zh },
    ru: { translation: ru },
    nl: { translation: nl },
    tr: { translation: tr },
    pl: { translation: pl },
    sv: { translation: sv },
    ar: { translation: ar },
    hi: { translation: hi },
};

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: getSavedLanguage(),
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false, // React already escapes
        },
    });

export default i18n;
