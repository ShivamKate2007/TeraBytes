import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataContext } from '../context/DataContext';
import { categories } from '../data/mockData';
import { Send, CheckCircle } from 'lucide-react';
import './SubmitPage.css';

const SubmitPage = () => {
  const { addSubmission } = useContext(DataContext);
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    category: categories[1], // default to first valid category
    year: '',
    title: '',
    description: '',
    image: '',
    achievements: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Parse achievements from textarea
    const parsedAchievements = formData.achievements
      .split('\n')
      .map(a => a.trim())
      .filter(a => a.length > 0);

    const submissionData = {
      ...formData,
      achievements: parsedAchievements,
      image: formData.image || 'https://images.unsplash.com/photo-1511367461989-f85a21fda167?auto=format&fit=crop&q=80&w=600&h=600' // fallback silhouette
    };

    addSubmission(submissionData);
    setSubmitted(true);
    
    // Auto redirect after a few seconds
    setTimeout(() => {
      navigate('/');
    }, 4000);
  };

  if (submitted) {
    return (
      <div className="container success-container fade-in">
        <div className="success-card glass">
          <CheckCircle size={64} className="success-icon" />
          <h2>Submission Received!</h2>
          <p>Thank you for nominating an outstanding individual. An administrator will review your submission shortly.</p>
          <button className="primary-btn mt-4" onClick={() => navigate('/')}>
            Return to Wall of Fame
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container submit-container fade-in">
      <div className="section-header">
        <h2>Nominate a Candidate</h2>
        <div className="divider"></div>
        <p className="page-desc">Submit a profile for consideration to the College Wall of Fame.</p>
      </div>

      <div className="form-card glass-card">
        <form onSubmit={handleSubmit} className="submit-form">
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input 
              type="text" 
              id="name" 
              name="name" 
              value={formData.name} 
              onChange={handleChange} 
              required 
              placeholder="e.g., Jane Doe"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="category">Category</label>
              <select 
                id="category" 
                name="category" 
                value={formData.category} 
                onChange={handleChange}
              >
                {categories.filter(c => c !== 'All').map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="year">Class Year</label>
              <input 
                type="text" 
                id="year" 
                name="year" 
                value={formData.year} 
                onChange={handleChange} 
                required 
                placeholder="e.g., 2023"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="title">Professional Title / Role</label>
            <input 
              type="text" 
              id="title" 
              name="title" 
              value={formData.title} 
              onChange={handleChange} 
              required 
              placeholder="e.g., Software Engineer at Google"
            />
          </div>

          <div className="form-group">
            <label htmlFor="image">Image URL</label>
            <input 
              type="url" 
              id="image" 
              name="image" 
              value={formData.image} 
              onChange={handleChange} 
              placeholder="https://example.com/photo.jpg"
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Short Bio / Description</label>
            <textarea 
              id="description" 
              name="description" 
              value={formData.description} 
              onChange={handleChange} 
              required 
              rows="4"
              placeholder="Summarize their impact and background..."
            />
          </div>

          <div className="form-group">
            <label htmlFor="achievements">Key Achievements (One per line)</label>
            <textarea 
              id="achievements" 
              name="achievements" 
              value={formData.achievements} 
              onChange={handleChange} 
              required 
              rows="4"
              placeholder="Won National Championship 2021&#10;Published 3 papers&#10;Valedictorian"
            />
          </div>

          <button type="submit" className="submit-btn">
            <Send size={18} /> Submit Nomination
          </button>
        </form>
      </div>
    </div>
  );
};

export default SubmitPage;
