import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

interface TitleContextType {
    pageTitle: string;
    setPageTitle: (title: string) => void;
}

const TitleContext = createContext<TitleContextType | undefined>(undefined);

export const TitleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [pageTitle, setPageTitleState] = useState('Home');

    const setPageTitle = useCallback((title: string) => {
        setPageTitleState(title);
        // Only show the page name, or fallback to "Pstream"
        document.title = title ? title : 'Pstream';
    }, []);

    useEffect(() => {
        // Keep it in sync if state changes
        document.title = pageTitle ? pageTitle : 'Pstream';
    }, [pageTitle]);

    return (
        <TitleContext.Provider value={{ pageTitle, setPageTitle }}>
            {children}
        </TitleContext.Provider>
    );
};

export const useTitle = () => {
    const context = useContext(TitleContext);
    if (!context) {
        throw new Error('useTitle must be used within a TitleProvider');
    }
    return context;
};

export default TitleContext;
