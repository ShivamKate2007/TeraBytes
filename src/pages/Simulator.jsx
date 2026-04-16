/* ============================================================
   Simulator Page — What-If Scenario Analysis
   ============================================================ */

import { useState, useCallback } from 'react';
import { Zap, BookOpen } from 'lucide-react';
import ScenarioPanel from '../components/simulator/ScenarioPanel';
import WhatIfMap from '../components/simulator/WhatIfMap';
import RouteComparison from '../components/simulator/RouteComparison';
import ImpactAnalysis from '../components/simulator/ImpactAnalysis';
import NarrativePanel from '../components/simulator/NarrativePanel';
import '../styles/simulator.css';

export default function Simulator() {
  const [isRunning, setIsRunning] = useState(false);
  const [hasResults, setHasResults] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [scenarioConfig, setScenarioConfig] = useState(null);

  const handleRunSimulation = useCallback(async (config) => {
    setIsRunning(true);
    setScenarioConfig(config);

    // Simulate async API call
    await new Promise((res) => setTimeout(res, 2200));

    setHasResults(true);
    setIsRunning(false);
  }, []);

  const handleReset = useCallback(() => {
    setHasResults(false);
    setSelectedRoute(null);
    setScenarioConfig(null);
  }, []);

  return (
    <>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <span className="glow-text">What-If</span> Simulator
          </h1>
          <p className="page-subtitle">
            Model disruption scenarios and analyze downstream impacts in real time
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary btn-sm" aria-label="View saved scenarios">
            <BookOpen size={13} />
            Saved Scenarios
          </button>
        </div>
      </div>

      {/* Main simulator layout */}
      <div className="simulator-layout">
        {/* Left panel — scenario configuration */}
        <div className="simulator-panel">
          <ScenarioPanel
            onRun={handleRunSimulation}
            isRunning={isRunning}
            onReset={handleReset}
          />
          <NarrativePanel hasResults={hasResults} />
        </div>

        {/* Map area */}
        <div className="simulator-map-area">
          <WhatIfMap simRunning={isRunning} />
        </div>

        {/* Bottom row */}
        <div className="simulator-bottom-area">
          <ImpactAnalysis hasResults={hasResults} />
          <RouteComparison
            selectedRouteId={selectedRoute}
            onSelectRoute={setSelectedRoute}
          />
        </div>
      </div>
    </>
  );
}
