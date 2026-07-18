import { useState, useEffect } from 'react';
import { api } from '../api';
import './NotificationArea.css';

const NotificationArea = ({ studentId, refreshKey = 0 }) => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAlerts = async () => {
      if (!studentId) {
        setAlerts([]);
        setError('');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const cleanId = String(studentId).replace(':', '');
        const data = await api.get(`/students/${cleanId}/alerts`);
        setAlerts(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Error fetching alerts:", error);
        setAlerts([]);
        setError("We couldn't load your academic notifications.");
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
  }, [studentId, refreshKey]);

  const updateAlert = async (alertId, action) => {
    try {
      const updatedAlert = await api.patch(`/alerts/${alertId}/${action}`);

      setAlerts(prev => {
        if (action === 'resolve') {
          // Resolved alerts should disappear from the active notification list.
          return prev.filter(alert => alert.id !== alertId);
        }

        // Acknowledged alerts remain visible but show their new status.
        return prev.map(alert => alert.id === alertId ? updatedAlert : alert);
      });
    } catch (error) {
      console.error(`Error updating alert:`, error);
    }
  };

  return (
    <div className="notification-area">
      <h3>Academic Notifications</h3>
      {loading ? (
        <p>Checking for updates...</p>
      ) : error ? (
        <p className="no-alerts">{error}</p>
      ) : alerts.length > 0 ? (
        alerts.map(alert => (
          <div key={alert.id} className={`alert-card ${alert.priority || 'medium'} ${alert.status || 'active'}`}>
            <div className="alert-content">
              <div className="alert-meta">
                <span>{alert.category || 'general'}</span>
                <span>{alert.priority || 'medium'} priority</span>
                <span>{alert.status || 'active'}</span>
              </div>
              <h4>{alert.title || 'Academic Alert'}</h4>
              <p>{alert.message}</p>
              {alert.recommended_action && (
                <p className="recommended-action">{alert.recommended_action}</p>
              )}
            </div>

            <div className="alert-actions">
              {alert.status !== 'acknowledged' && (
                <button className="resolve-btn" onClick={() => updateAlert(alert.id, 'acknowledge')}>
                  Acknowledge
                </button>
              )}
            </div>
          </div>
        ))
      ) : (
        <p className="no-alerts">You're all caught up. No urgent actions needed.</p>
      )}
    </div>
  );
};

export default NotificationArea;
