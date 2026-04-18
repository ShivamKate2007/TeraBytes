import React from 'react';
import { NavLink } from 'react-router-dom';
import './Navbar.css';

const Navbar = () => {
  return (
    <nav className="navbar glass-panel">
      <div className="nav-brand">
        <div className="brand-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="var(--accent-cyan)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="var(--accent-purple)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="var(--accent-cyan)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <span className="brand-text text-gradient">Smart Supply</span>
      </div>
      
      <div className="nav-links">
        <NavLink to="/" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
          <span className="nav-icon">📊</span>
          Dashboard
        </NavLink>
        <NavLink to="/simulator" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
          <span className="nav-icon">⚡</span>
          What-If Simulator
        </NavLink>
        <NavLink to="/analytics" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
          <span className="nav-icon">📈</span>
          Analytics
        </NavLink>
      </div>
      
      <div className="nav-pulse">
        <span className="status-indicator safe"></span>
        <span className="system-status">System Online</span>
      </div>
    </nav>
  );
};

export default Navbar;
