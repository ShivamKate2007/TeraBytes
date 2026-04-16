import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { GraduationCap, Shield, PlusCircle } from 'lucide-react';
import './Navbar.css';

const Navbar = () => {
  const location = useLocation();

  const isActive = (path) => {
    return location.pathname === path ? 'active' : '';
  };

  return (
    <nav className="navbar glass">
      <div className="container navbar-container">
        <Link to="/" className="navbar-logo">
          <GraduationCap className="logo-icon" size={28} />
          <span className="logo-text">Wall of Fame</span>
        </Link>
        
        <div className="navbar-links">
          <Link to="/" className={`nav-link ${isActive('/')}`}>
            Home
          </Link>
          <Link to="/submit" className={`nav-link submit-link ${isActive('/submit')}`}>
            <PlusCircle size={18} />
            <span>Submit</span>
          </Link>
          <Link to="/admin" className={`nav-link admin-link ${isActive('/admin')}`}>
            <Shield size={18} />
            <span>Admin</span>
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
