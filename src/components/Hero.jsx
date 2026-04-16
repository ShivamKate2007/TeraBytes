import React from 'react';
import { Award, Star } from 'lucide-react';
import './Hero.css';

const Hero = () => {
  return (
    <section className="hero-section">
      <div className="hero-background">
        <div className="glow-orb orb-1"></div>
        <div className="glow-orb orb-2"></div>
        <div className="glow-orb orb-3"></div>
      </div>
      
      <div className="container hero-content">
        <div className="hero-badge fade-in" style={{ animationDelay: '0.1s' }}>
          <Star className="badge-icon" size={16} />
          <span>Celebrating Excellence</span>
        </div>
        
        <h1 className="hero-title fade-in" style={{ animationDelay: '0.3s' }}>
          College <span className="text-gradient">Wall of Fame</span>
        </h1>
        
        <p className="hero-description fade-in" style={{ animationDelay: '0.5s' }}>
          Honoring the extraordinary individuals whose achievements, leadership, and dedication have left an indelible mark on our institution and the world.
        </p>
        
        <div className="hero-stats fade-in" style={{ animationDelay: '0.7s' }}>
          <div className="stat-card glass">
            <Award className="stat-icon" size={24} />
            <div className="stat-info">
              <span className="stat-value">500+</span>
              <span className="stat-label">Honorees</span>
            </div>
          </div>
          <div className="stat-card glass">
            <Star className="stat-icon" size={24} />
            <div className="stat-info">
              <span className="stat-value">12</span>
              <span className="stat-label">Categories</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
