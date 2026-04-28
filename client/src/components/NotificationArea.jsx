import { useState, useEffect } from 'react';
import './NotificationArea.css';

const NotificationArea = ({ studentId}) => {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading ] = useState(true);


    useEffect(() => {
        const fetchAlerts = async () => {
            try {
                const cleanId = String(studentId).replace(':', '');
                const response = await fetch(`http://localhost:5000/api/alerts/${cleanId}`);
                const data = await response.json();
                setAlerts(data);
            }
            catch (error) {
                console.error("Error fetching alerts:", error);
            }
            finally {
                setLoading(false);
            }
        }
        fetchAlerts();
    }, [studentId]);

    const handleResolve = async (alertId) => {
        setAlerts(prev => prev.filter(a => a.id !== alertId));
    }

    return (
        <div className="notification-area">
            <h3>Academic Notifications</h3>
            {loading ? (
                <p>Checking for updates...</p>
            ) : alerts.length > 0 ? (
                alerts.map(alert => (
                    <div key={alert.id} className={`alert-card ${alert.is_resolved ? 'resolved' : 'active'}`}>
                        <p>{alert.message}</p>
                        {!alert.is_resolved && (
                            <button className="resolve-btn" onClick={() => handleResolve(alert.id)}>
                                Acknowledge 
                            </button>
                        )}
                    </div>
                ))
            ) : (
                <p className="no-alerts">Your're all caught up! No urgent actions needeed.</p>
            )}
        </div>
    )
}

export default NotificationArea;