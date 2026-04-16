import React from 'react';
import './FilterBar.css';
import { categories } from '../data/mockData';

const FilterBar = ({ activeCategory, setActiveCategory }) => {
  return (
    <div className="filter-container">
      <div className="filter-scroll">
        {categories.map((category) => (
          <button
            key={category}
            className={`filter-btn ${activeCategory === category ? 'active' : ''}`}
            onClick={() => setActiveCategory(category)}
          >
            {category}
          </button>
        ))}
      </div>
    </div>
  );
};

export default FilterBar;
