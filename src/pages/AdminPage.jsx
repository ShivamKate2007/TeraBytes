import React, { useContext } from 'react';
import { DataContext } from '../context/DataContext';
import { Check, X, ShieldAlert } from 'lucide-react';
import './AdminPage.css';

const AdminPage = () => {
  const { submissions, approveSubmission, rejectSubmission } = useContext(DataContext);

  return (
    <div className="container admin-container fade-in">
      <div className="admin-header">
        <ShieldAlert size={32} className="admin-icon" />
        <div>
          <h2>Admin Dashboard</h2>
          <p className="admin-desc">Review and manage student submissions for the Wall of Fame.</p>
        </div>
      </div>

      <div className="admin-stats">
        <div className="admin-stat-card glass">
          <span className="stat-num">{submissions.length}</span>
          <span className="stat-label">Pending Reviews</span>
        </div>
      </div>

      <div className="admin-content glass-card">
        <h3>Pending Submissions</h3>
        
        {submissions.length === 0 ? (
          <div className="no-submissions">
            <p>All clear! No pending submissions to review.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Name & Info</th>
                  <th>Category</th>
                  <th>Achievements</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map(sub => (
                  <tr key={sub.id}>
                    <td>
                      <img src={sub.image} alt={sub.name} className="table-img" />
                    </td>
                    <td>
                      <strong>{sub.name}</strong>
                      <div className="table-subinfo">Class of {sub.year} • {sub.title}</div>
                      <div className="table-desc">{sub.description}</div>
                    </td>
                    <td>
                      <span className="table-category">{sub.category}</span>
                    </td>
                    <td>
                      <ul className="table-achievements">
                        {sub.achievements.map((ach, idx) => (
                          <li key={idx}>{ach}</li>
                        ))}
                      </ul>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button 
                          className="action-btn approve" 
                          onClick={() => approveSubmission(sub.id)}
                          title="Approve Submission"
                        >
                          <Check size={18} />
                        </button>
                        <button 
                          className="action-btn reject" 
                          onClick={() => rejectSubmission(sub.id)}
                          title="Reject Submission"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPage;
