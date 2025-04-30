import React, { useState, useEffect } from 'react';

interface Issue {
  number: number;
  title: string;
  labels: string[];
  state: string;
  created_at: string;
  updated_at: string;
  html_url: string;
}

export const IssuesList: React.FC = () => {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchIssues = async () => {
      try {
        setLoading(true);
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const mockIssues: Issue[] = [
          {
            number: 42,
            title: "Implement dashboard metrics endpoint",
            labels: ["stone-feature", "dashboard"],
            state: "open",
            created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
            updated_at: new Date(Date.now() - 3600000).toISOString(),
            html_url: "https://github.com/UOR-Foundation/Stone/issues/42"
          },
          {
            number: 43,
            title: "Add secret redaction to Claude responses",
            labels: ["stone-security", "stone-audit"],
            state: "open",
            created_at: new Date(Date.now() - 86400000).toISOString(),
            updated_at: new Date(Date.now() - 7200000).toISOString(),
            html_url: "https://github.com/UOR-Foundation/Stone/issues/43"
          },
          {
            number: 44,
            title: "Implement auto-rebase for PRs",
            labels: ["stone-workflow", "stone-feature"],
            state: "open",
            created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
            updated_at: new Date(Date.now() - 43200000).toISOString(),
            html_url: "https://github.com/UOR-Foundation/Stone/issues/44"
          }
        ];
        
        setIssues(mockIssues);
        setError(null);
      } catch (err) {
        setError(`Error fetching issues: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setLoading(false);
      }
    };

    fetchIssues();
  }, []);

  if (loading) {
    return <div className="loading-indicator">Loading issues...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (issues.length === 0) {
    return <div className="no-issues">No active issues found.</div>;
  }

  return (
    <ul className="issues-list">
      {issues.map(issue => (
        <li key={issue.number} className="issue-item">
          <div className="issue-header">
            <span className="issue-title">
              <a href={issue.html_url} target="_blank" rel="noopener noreferrer">
                {issue.title}
              </a>
            </span>
            <span className="issue-number">#{issue.number}</span>
          </div>
          <div className="issue-meta">
            <span>Created: {new Date(issue.created_at).toLocaleDateString()}</span>
            <span>Updated: {new Date(issue.updated_at).toLocaleDateString()}</span>
          </div>
          <div className="issue-labels">
            {issue.labels.map(label => (
              <span key={label} className="issue-label">{label}</span>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
};
