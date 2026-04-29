import { useCallback, useEffect, useMemo, useState } from 'react';
import './AdvisorDashboard.css';

const priorityRank = { high: 1, medium: 2, low: 3 };

const AdvisorDashboard = ({ user }) => {
  const advisorId = user?.advisor_id || user?.id;
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const requestAlerts = useCallback(async () => {
    if (!advisorId) {
      return [];
    }

    const response = await fetch(`http://localhost:5000/api/advisors/${advisorId}/alerts`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Could not load advisor alerts');
    }

    return Array.isArray(data) ? data : [];
  }, [advisorId]);

  const fetchAlerts = async () => {
    setLoading(true);
    setError('');

    try {
      const nextAlerts = await requestAlerts();
      setAlerts(nextAlerts);
    } catch {
      setError('Could not load advisor alerts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isCurrent = true;

    const loadInitialAlerts = async () => {
      try {
        const nextAlerts = await requestAlerts();

        if (isCurrent) {
          setAlerts(nextAlerts);
          setError('');
        }
      } catch {
        if (isCurrent) {
          setError('Could not load advisor alerts.');
        }
      } finally {
        if (isCurrent) {
          setLoading(false);
        }
      }
    };

    loadInitialAlerts();

    return () => {
      isCurrent = false;
    };
  }, [requestAlerts]);

  const updateAlert = async (alertId, action) => {
    try {
      const response = await fetch(`http://localhost:5000/api/alerts/${alertId}/${action}`, {
        method: 'PATCH',
      });
      const updatedAlert = await response.json();

      if (!response.ok) {
        throw new Error(updatedAlert.error || `Could not ${action} alert`);
      }

      setAlerts(prev => {
        if (action === 'resolve') {
          return prev.filter(alert => alert.id !== alertId);
        }

        return prev.map(alert => alert.id === alertId ? updatedAlert : alert);
      });
    } catch {
      setError(`Could not ${action} alert.`);
    }
  };

  const stats = useMemo(() => {
    const studentIds = new Set(alerts.map(alert => alert.student_id).filter(Boolean));
    const highPriority = alerts.filter(alert => alert.priority === 'high').length;
    const acknowledged = alerts.filter(alert => alert.status === 'acknowledged').length;

    return {
      activeAlerts: alerts.length,
      studentsFlagged: studentIds.size,
      highPriority,
      acknowledged,
    };
  }, [alerts]);

  const sortedAlerts = useMemo(() => {
    return [...alerts].sort((a, b) => {
      const priorityDifference =
        (priorityRank[a.priority] || 4) - (priorityRank[b.priority] || 4);

      if (priorityDifference !== 0) return priorityDifference;

      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
  }, [alerts]);

  const universityLabel = user?.university_name || user?.university_domain || 'University advising';

  return (
    <main className="advisor-dashboard">
      <header className="advisor-header">
        <div>
          <p className="advisor-kicker">Advisor Workspace</p>
          <h1>Welcome back, {user?.advisor_name || 'Advisor'}</h1>
          <p>{universityLabel}</p>
        </div>

        <button className="advisor-refresh" onClick={fetchAlerts} disabled={loading}>
          {loading ? 'Refreshing' : 'Refresh'}
        </button>
      </header>

      <section className="advisor-stats" aria-label="Advisor alert summary">
        <div>
          <span>{stats.activeAlerts}</span>
          <p>Active Alerts</p>
        </div>
        <div>
          <span>{stats.studentsFlagged}</span>
          <p>Students Flagged</p>
        </div>
        <div>
          <span>{stats.highPriority}</span>
          <p>High Priority</p>
        </div>
        <div>
          <span>{stats.acknowledged}</span>
          <p>Acknowledged</p>
        </div>
      </section>

      <section className="advisor-alerts">
        <div className="advisor-section-heading">
          <h2>Advisee Alerts</h2>
          <p>Prioritized academic items that need advisor review.</p>
        </div>

        {error && <p className="advisor-error">{error}</p>}

        {loading ? (
          <p className="advisor-empty">Loading advisor alerts...</p>
        ) : sortedAlerts.length > 0 ? (
          <div className="advisor-alert-list">
            {sortedAlerts.map(alert => (
              <article
                key={alert.id}
                className={`advisor-alert-card ${alert.priority || 'medium'} ${alert.status || 'active'}`}
              >
                <div className="advisor-alert-main">
                  <div className="advisor-alert-meta">
                    <span>{alert.priority || 'medium'} priority</span>
                    <span>{alert.category || 'general'}</span>
                    <span>{alert.status || 'active'}</span>
                  </div>

                  <h3>{alert.title || 'Academic Alert'}</h3>
                  <p>{alert.message}</p>

                  {alert.recommended_action && (
                    <p className="advisor-action-note">{alert.recommended_action}</p>
                  )}
                </div>

                <aside className="advisor-student-panel">
                  <h4>{alert.student_name || 'Student'}</h4>
                  <p>{alert.student_email || 'No email available'}</p>
                  <div className="advisor-student-details">
                    <span>GPA {alert.student_gpa ?? 'N/A'}</span>
                    <span>{alert.student_status || 'status pending'}</span>
                  </div>

                  <div className="advisor-alert-actions">
                    {alert.status !== 'acknowledged' && (
                      <button onClick={() => updateAlert(alert.id, 'acknowledge')}>
                        Acknowledge
                      </button>
                    )}
                    <button className="resolve" onClick={() => updateAlert(alert.id, 'resolve')}>
                      Resolve
                    </button>
                  </div>
                </aside>
              </article>
            ))}
          </div>
        ) : (
          <p className="advisor-empty">No active advisee alerts right now.</p>
        )}
      </section>
    </main>
  );
};

export default AdvisorDashboard;
