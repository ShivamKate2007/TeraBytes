/* ============================================================
   ScenarioPanel — Left panel for configuring what-if scenarios
   ============================================================ */

import { useState } from 'react';
import { Zap, RotateCcw } from 'lucide-react';
import { DISRUPTION_TYPES } from '../../utils/constants';

const PRESETS = [
  { id: 'suez_closure', label: 'Suez Closure', icon: '⚓' },
  { id: 'covid_lockdown', label: 'Port Lockdown', icon: '🔒' },
  { id: 'typhoon', label: 'Typhoon Season', icon: '🌀' },
  { id: 'strike', label: 'Labor Strike', icon: '✊' },
  { id: 'rate_spike', label: 'Rate Spike', icon: '📈' },
  { id: 'blank_sailing', label: 'Blank Sailing', icon: '🚢' },
];

const DEFAULT_CONFIG = {
  disruptionType: 'port_closure',
  region: 'Asia Pacific',
  severity: 70,
  duration: 14,
  affectedRoutes: 'all',
};

/**
 * @param {object} props
 * @param {function} [props.onRun] — called with scenario config when running
 * @param {boolean} [props.isRunning]
 * @param {function} [props.onReset]
 */
export default function ScenarioPanel({ onRun, isRunning = false, onReset }) {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [activePreset, setActivePreset] = useState(null);

  const update = (field, value) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
    setActivePreset(null);
  };

  const applyPreset = (preset) => {
    setActivePreset(preset.id);
    const presetConfigs = {
      suez_closure: { disruptionType: 'port_closure', region: 'Middle East', severity: 95, duration: 21 },
      covid_lockdown: { disruptionType: 'port_closure', region: 'Asia Pacific', severity: 85, duration: 30 },
      typhoon: { disruptionType: 'weather_event', region: 'Asia Pacific', severity: 80, duration: 7 },
      strike: { disruptionType: 'labor_strike', region: 'Europe', severity: 60, duration: 10 },
      rate_spike: { disruptionType: 'capacity_crunch', region: 'Global', severity: 70, duration: 60 },
      blank_sailing: { disruptionType: 'carrier_failure', region: 'Trans-Pacific', severity: 50, duration: 14 },
    };
    setConfig({ ...DEFAULT_CONFIG, ...presetConfigs[preset.id] });
  };

  const handleRun = () => {
    onRun?.(config);
  };

  const handleReset = () => {
    setConfig(DEFAULT_CONFIG);
    setActivePreset(null);
    onReset?.();
  };

  return (
    <div className="scenario-panel-card">
      {/* Header */}
      <div className="scenario-panel-header">
        <div className="scenario-panel-title">
          <Zap size={15} color="var(--color-accent-primary)" aria-hidden="true" />
          What-If Scenario
        </div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
          Configure a disruption and run simulation
        </div>
      </div>

      <div className="scenario-panel-body">
        {/* Presets */}
        <div className="scenario-field">
          <label>Quick Presets</label>
          <div className="scenario-presets">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                className={`scenario-preset-btn ${activePreset === preset.id ? 'active' : ''}`}
                onClick={() => applyPreset(preset)}
                aria-pressed={activePreset === preset.id}
              >
                {preset.icon} {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Disruption Type */}
        <div className="scenario-field">
          <label htmlFor="disruption-type">Disruption Type</label>
          <select
            id="disruption-type"
            className="scenario-select"
            value={config.disruptionType}
            onChange={(e) => update('disruptionType', e.target.value)}
          >
            {DISRUPTION_TYPES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Region */}
        <div className="scenario-field">
          <label htmlFor="region">Affected Region</label>
          <select
            id="region"
            className="scenario-select"
            value={config.region}
            onChange={(e) => update('region', e.target.value)}
          >
            {['Global', 'Asia Pacific', 'Europe', 'Americas', 'Middle East', 'Africa', 'Trans-Pacific', 'Asia-Europe'].map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* Severity Slider */}
        <div className="scenario-field">
          <div className="scenario-slider-group">
            <div className="scenario-slider-header">
              <label htmlFor="severity-slider">Severity</label>
              <span className="scenario-slider-value">{config.severity}/100</span>
            </div>
            <input
              id="severity-slider"
              type="range"
              className="scenario-slider"
              min={10}
              max={100}
              step={5}
              value={config.severity}
              onChange={(e) => update('severity', Number(e.target.value))}
              aria-label={`Severity: ${config.severity} out of 100`}
              style={{
                background: `linear-gradient(to right, var(--color-accent-primary) ${config.severity}%, var(--color-bg-tertiary) ${config.severity}%)`
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--color-text-muted)' }}>
              <span>Low</span><span>Critical</span>
            </div>
          </div>
        </div>

        {/* Duration Slider */}
        <div className="scenario-field">
          <div className="scenario-slider-group">
            <div className="scenario-slider-header">
              <label htmlFor="duration-slider">Duration</label>
              <span className="scenario-slider-value">{config.duration}d</span>
            </div>
            <input
              id="duration-slider"
              type="range"
              className="scenario-slider"
              min={1}
              max={90}
              step={1}
              value={config.duration}
              onChange={(e) => update('duration', Number(e.target.value))}
              aria-label={`Duration: ${config.duration} days`}
              style={{
                background: `linear-gradient(to right, var(--color-accent-secondary) ${(config.duration / 90) * 100}%, var(--color-bg-tertiary) ${(config.duration / 90) * 100}%)`
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--color-text-muted)' }}>
              <span>1 day</span><span>90 days</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className={`run-simulation-btn ${isRunning ? 'loading' : ''}`}
            onClick={handleRun}
            disabled={isRunning}
            aria-label="Run simulation"
            aria-busy={isRunning}
          >
            {isRunning ? (
              <>
                <span className="spinner sm" aria-hidden="true" />
                Running…
              </>
            ) : (
              <>
                <Zap size={14} aria-hidden="true" />
                Run Simulation
              </>
            )}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleReset}
            aria-label="Reset scenario configuration"
            style={{ flexShrink: 0 }}
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
