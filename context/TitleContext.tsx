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
        // Also update the actual window title
        document.title = `P-Stream${title ? ' - ' + title : ''}`;
    }, []);

    useEffect(() => {
        document.title = `P-Stream${pageTitle ? ' - ' + pageTitle : ''}`;
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
