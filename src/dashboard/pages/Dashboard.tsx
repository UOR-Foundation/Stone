import React, { useState, useEffect } from 'react';
import { MetricsChart } from '../components/MetricsChart';
import { StatusPanel } from '../components/StatusPanel';
import { IssuesList } from '../components/IssuesList';

export interface Metrics {
  rate: {
    used: number;
    limit: number;
  };
  batch: {
    queued: number;
    max: number;
  };
  timestamp: number;
}

export const Dashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [metricsHistory, setMetricsHistory] = useState<Metrics[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        const port = process.env.STONE_METRICS_PORT || '9000';
        const response = await fetch(`http://localhost:${port}/api/metrics`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch metrics: ${response.statusText}`);
        }
        
        const data = await response.json() as Metrics;
        setMetrics(data);
        setMetricsHistory(prev => {
          const newHistory = [...prev, data];
          return newHistory.length > 20 ? newHistory.slice(-20) : newHistory;
        });
        setError(null);
      } catch (err) {
        setError(`Error fetching metrics: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    
    const intervalId = setInterval(fetchMetrics, 30000);
    
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Stone Dashboard</h1>
        <div className="dashboard-subtitle">Performance Metrics & Status</div>
      </header>
      
      <main className="dashboard-content">
        {loading && !metrics && (
          <div className="loading-indicator">Loading metrics...</div>
        )}
        
        {error && (
          <div className="error-message">
            {error}
            <button onClick={() => window.location.reload()}>Retry</button>
          </div>
        )}
        
        {metrics && (
          <>
            <div className="metrics-section">
              <h2>Performance Metrics</h2>
              <div className="metrics-grid">
                <StatusPanel 
                  title="API Rate Limit" 
                  current={metrics.rate.used} 
                  max={metrics.rate.limit} 
                  unit="requests"
                />
                <StatusPanel 
                  title="Request Queue" 
                  current={metrics.batch.queued} 
                  max={metrics.batch.max} 
                  unit="requests"
                />
              </div>
              
              <div className="chart-container">
                <MetricsChart metrics={metricsHistory.length > 0 ? metricsHistory : [metrics]} />
              </div>
            </div>
            
            <div className="issues-section">
              <h2>Active Issues</h2>
              <IssuesList />
            </div>
          </>
        )}
      </main>
      
      <footer className="dashboard-footer">
        <p>Stone v{process.env.STONE_VERSION || '0.1.0'} | Last updated: {metrics ? new Date(metrics.timestamp).toLocaleString() : 'Never'}</p>
      </footer>
    </div>
  );
};
