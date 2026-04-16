import React, { useState, useContext } from 'react';
import Hero from '../components/Hero';
import FilterBar from '../components/FilterBar';
import ProfileCard from '../components/ProfileCard';
import { DataContext } from '../context/DataContext';

const HomePage = () => {
  const { honorees } = useContext(DataContext);
  const [activeCategory, setActiveCategory] = useState('All');

  const filteredHonorees = activeCategory === 'All' 
    ? honorees 
    : honorees.filter(h => h.category === activeCategory);

  return (
    <>
      <Hero />
      
      <main className="container main-content">
        <div className="wall-section fade-in">
          <div className="section-header">
            <h2>The Honorees</h2>
            <div className="divider"></div>
          </div>
          
          <FilterBar 
            activeCategory={activeCategory} 
            setActiveCategory={setActiveCategory} 
          />
          
          <div className="profiles-grid">
            {filteredHonorees.length > 0 ? (
              filteredHonorees.map((profile, index) => (
                <ProfileCard 
                  key={profile.id} 
                  profile={profile} 
                  index={index} 
                />
              ))
            ) : (
              <div className="no-results">
                No honorees found for this category.
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
};

export default HomePage;
