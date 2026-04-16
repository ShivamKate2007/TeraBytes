import React from 'react';
import { Award, Calendar, ChevronRight } from 'lucide-react';
import './ProfileCard.css';

const ProfileCard = ({ profile, index }) => {
  return (
    <div 
      className="profile-card glass-card fade-in" 
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      <div className="profile-image-container">
        <img src={profile.image} alt={profile.name} className="profile-image" />
        <div className="profile-category-badge">
          {profile.category}
        </div>
      </div>
      
      <div className="profile-content">
        <div className="profile-header">
          <h3 className="profile-name">{profile.name}</h3>
          <span className="profile-year">
            <Calendar size={14} /> Class of {profile.year}
          </span>
        </div>
        
        <p className="profile-title">{profile.title}</p>
        
        <p className="profile-description">
          {profile.description}
        </p>
        
        <div className="profile-achievements">
          <div className="achievements-title">
            <Award size={16} className="achievement-icon" />
            Key Achievements
          </div>
          <ul className="achievements-list">
            {profile.achievements.map((ach, idx) => (
              <li key={idx}>{ach}</li>
            ))}
          </ul>
        </div>
        
        <button className="read-more-btn">
          Full Profile <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default ProfileCard;
