import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Metrics } from '../pages/Dashboard';

interface MetricsChartProps {
  metrics: Metrics[];
}

export const MetricsChart: React.FC<MetricsChartProps> = ({ metrics }) => {
  const chartData = metrics.map(metric => ({
    time: new Date(metric.timestamp).toLocaleTimeString(),
    rateUsed: metric.rate.used,
    rateLimit: metric.rate.limit,
    queueSize: metric.batch.queued,
    queueMax: metric.batch.max,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={chartData}
        margin={{
          top: 5,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line 
          type="monotone" 
          dataKey="rateUsed" 
          name="API Rate Used" 
          stroke="#3b82f6" 
          activeDot={{ r: 8 }} 
        />
        <Line 
          type="monotone" 
          dataKey="rateLimit" 
          name="API Rate Limit" 
          stroke="#10b981" 
          strokeDasharray="5 5" 
        />
        <Line 
          type="monotone" 
          dataKey="queueSize" 
          name="Queue Size" 
          stroke="#f59e0b" 
        />
        <Line 
          type="monotone" 
          dataKey="queueMax" 
          name="Queue Max" 
          stroke="#ef4444" 
          strokeDasharray="5 5" 
        />
      </LineChart>
    </ResponsiveContainer>
  );
};
