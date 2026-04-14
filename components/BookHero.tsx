/**
 * BookHero — stub component (Comics not yet supported)
 * ReadsPage imports this but the page itself is not registered in any route.
 * Replace when comic/manga reading is implemented.
 */
import React from 'react';
import { Movie } from '../types';

interface BookHeroProps {
    onSelect: (book: Movie) => void;
}

const BookHero: React.FC<BookHeroProps> = () => null;

export default BookHero;
