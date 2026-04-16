import React, { createContext, useState, useEffect } from 'react';
import { honorees as initialHonorees } from '../data/mockData';

export const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const [honorees, setHonorees] = useState(() => {
    const saved = localStorage.getItem('wallOfFame_honorees');
    if (saved) {
      return JSON.parse(saved);
    }
    return initialHonorees;
  });

  const [submissions, setSubmissions] = useState(() => {
    const saved = localStorage.getItem('wallOfFame_submissions');
    if (saved) {
      return JSON.parse(saved);
    }
    return [];
  });

  // Save to localStorage whenever honorees or submissions change
  useEffect(() => {
    localStorage.setItem('wallOfFame_honorees', JSON.stringify(honorees));
  }, [honorees]);

  useEffect(() => {
    localStorage.setItem('wallOfFame_submissions', JSON.stringify(submissions));
  }, [submissions]);

  const addSubmission = (submission) => {
    const newSubmission = {
      ...submission,
      id: Date.now(), // Generate unique simple ID
      status: 'pending'
    };
    setSubmissions([newSubmission, ...submissions]);
  };

  const approveSubmission = (id) => {
    const submissionToApprove = submissions.find(s => s.id === id);
    if (submissionToApprove) {
      // Remove status parameter and add to honorees
      const { status, ...approvedProfile } = submissionToApprove;
      setHonorees([approvedProfile, ...honorees]);
      
      // Remove from submissions
      setSubmissions(submissions.filter(s => s.id !== id));
    }
  };

  const rejectSubmission = (id) => {
    setSubmissions(submissions.filter(s => s.id !== id));
  };

  return (
    <DataContext.Provider value={{
      honorees,
      submissions,
      addSubmission,
      approveSubmission,
      rejectSubmission
    }}>
      {children}
    </DataContext.Provider>
  );
};
