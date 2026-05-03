import { useCallback, useEffect, useMemo, useState } from 'react';
import './AdvisorDashboard.css';

const priorityRank = { high: 1, medium: 2, low: 3 };

const formatDateTime = (value) => {
  if (!value) return 'Just now';

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
};

const AdvisorDashboard = ({ user, onLogout }) => {
  // Advisors can arrive with either the advisor profile id or the base user id.
  const advisorId = user?.advisor_id || user?.id;
  const [alerts, setAlerts] = useState([]);
  const [students, setStudents] = useState([]);
  const [expandedStudentId, setExpandedStudentId] = useState(null);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [notesByStudent, setNotesByStudent] = useState({});
  const [noteDrafts, setNoteDrafts] = useState({});
  const [savingNoteId, setSavingNoteId] = useState(null);
  const [deletingNoteId, setDeletingNoteId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const requestDashboardData = useCallback(async () => {
    if (!advisorId) {
      return { alerts: [], students: [] };
    }

    // Alerts and roster are independent, so load them together.
    const [alertsResponse, studentsResponse] = await Promise.all([
      fetch(`http://localhost:5000/api/advisors/${advisorId}/alerts`),
      fetch(`http://localhost:5000/api/advisors/${advisorId}/students`),
    ]);
    const [alertsData, studentsData] = await Promise.all([
      alertsResponse.json(),
      studentsResponse.json(),
    ]);

    if (!alertsResponse.ok) {
      throw new Error(alertsData.error || 'Could not load advisor alerts');
    }

    if (!studentsResponse.ok) {
      throw new Error(studentsData.error || 'Could not load advisor roster');
    }

    return {
      alerts: Array.isArray(alertsData) ? alertsData : [],
      students: Array.isArray(studentsData) ? studentsData : [],
    };
  }, [advisorId]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');

    try {
      const nextData = await requestDashboardData();
      setAlerts(nextData.alerts);
      setStudents(nextData.students);
    } catch {
      setError('Could not load advisor dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isCurrent = true;

    // isCurrent prevents setting state if the component unmounts mid-request.
    const loadInitialAlerts = async () => {
      try {
        const nextData = await requestDashboardData();

        if (isCurrent) {
          setAlerts(nextData.alerts);
          setStudents(nextData.students);
          setError('');
        }
      } catch {
        if (isCurrent) {
          setError('Could not load advisor dashboard.');
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
  }, [requestDashboardData]);

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
          // Resolved alerts leave the advisor's active queue immediately.
          return prev.filter(alert => alert.id !== alertId);
        }

        // Acknowledged alerts remain in the queue with an updated status.
        return prev.map(alert => alert.id === alertId ? updatedAlert : alert);
      });
    } catch {
      setError(`Could not ${action} alert.`);
    }
  };

  const loadStudentNotes = async (studentId) => {
    // Notes are cached per student so expanding the same panel is instant later.
    if (!advisorId || notesByStudent[studentId]) return;

    try {
      const response = await fetch(
        `http://localhost:5000/api/students/${studentId}/notes?advisorId=${advisorId}`,
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Could not load notes');
      }

      setNotesByStudent(prev => ({
        ...prev,
        [studentId]: Array.isArray(data) ? data : [],
      }));
    } catch {
      setError('Could not load student notes.');
    }
  };

  const toggleStudentNotes = (studentId) => {
    setExpandedStudentId(prev => {
      const nextStudentId = prev === studentId ? null : studentId;
      if (nextStudentId) {
        // Load notes only when the advisor actually opens the panel.
        loadStudentNotes(nextStudentId);
      }
      return nextStudentId;
    });
  };

  const selectStudent = (studentId) => {
    setSelectedStudentId(studentId);
    loadStudentNotes(studentId);
  };

  const saveStudentNote = async (studentId) => {
    const note = String(noteDrafts[studentId] || '').trim();
    if (!note || !advisorId) return;

    setSavingNoteId(studentId);
    setError('');

    try {
      const response = await fetch(`http://localhost:5000/api/students/${studentId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ advisor_id: advisorId, note }),
      });
      const savedNote = await response.json();

      if (!response.ok) {
        throw new Error(savedNote.error || 'Could not save note');
      }

      setNotesByStudent(prev => ({
        ...prev,
        [studentId]: [savedNote, ...(prev[studentId] || [])],
      }));
      setNoteDrafts(prev => ({ ...prev, [studentId]: '' }));
    } catch {
      setError('Could not save student note.');
    } finally {
      setSavingNoteId(null);
    }
  };

  const deleteStudentNote = async (studentId, noteId) => {
    if (!advisorId) return;

    setDeletingNoteId(noteId);
    setError('');

    try {
      const response = await fetch(
        `http://localhost:5000/api/notes/${noteId}?advisorId=${advisorId}`,
        { method: 'DELETE' },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Could not delete note');
      }

      setNotesByStudent(prev => ({
        ...prev,
        [studentId]: (prev[studentId] || []).filter(note => note.id !== noteId),
      }));
    } catch {
      setError('Could not delete student note.');
    } finally {
      setDeletingNoteId(null);
    }
  };

  const stats = useMemo(() => {
    // Dashboard cards are derived from the currently active alert list.
    const highPriority = alerts.filter(alert => alert.priority === 'high').length;
    const acknowledged = alerts.filter(alert => alert.status === 'acknowledged').length;

    return {
      activeAlerts: alerts.length,
      studentsFlagged: students.length,
      highPriority,
      acknowledged,
    };
  }, [alerts, students]);

  const sortedAlerts = useMemo(() => {
    return [...alerts].sort((a, b) => {
      // Sort by urgency first, then newest alert.
      const priorityDifference =
        (priorityRank[a.priority] || 4) - (priorityRank[b.priority] || 4);

      if (priorityDifference !== 0) return priorityDifference;

      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
  }, [alerts]);

  const selectedStudent = useMemo(() => {
    return students.find(student => student.id === selectedStudentId) || null;
  }, [selectedStudentId, students]);

  const selectedStudentAlerts = useMemo(() => {
    if (!selectedStudent) return [];
    // Detail view reuses the same sorted alert list, scoped to one student.
    return sortedAlerts.filter(alert => alert.student_id === selectedStudent.id);
  }, [selectedStudent, sortedAlerts]);

  const universityLabel = user?.university_name || user?.university_domain || 'University advising';

  return (
    <main className="advisor-dashboard">
      <header className="advisor-header">
        <div>
          <p className="advisor-kicker">Advisor Workspace</p>
          <h1>Welcome back, {user?.advisor_name || 'Advisor'}</h1>
          <p>{universityLabel}</p>
        </div>

        <div className="advisor-header-actions">
          <button className="advisor-refresh" onClick={fetchDashboardData} disabled={loading}>
            {loading ? 'Refreshing' : 'Refresh'}
          </button>
          <button className="advisor-logout" onClick={onLogout}>Logout</button>
        </div>
      </header>

      <section className="advisor-stats" aria-label="Advisor alert summary">
        <div>
          <span>{stats.activeAlerts}</span>
          <p>Active Alerts</p>
        </div>
        <div>
          <span>{stats.studentsFlagged}</span>
          <p>Assigned Students</p>
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

      <section className="advisor-roster">
        <div className="advisor-section-heading">
          <h2>Student Roster</h2>
          <p>All students currently assigned to you.</p>
        </div>

        {loading ? (
          <p className="advisor-empty">Loading student roster...</p>
        ) : students.length > 0 ? (
          <div className="advisor-roster-list">
            {students.map(student => (
              <article key={student.id} className="advisor-student-card">
                <div className="advisor-student-summary">
                  <div>
                    <h3>{student.name || 'Student'}</h3>
                    <p>{student.email}</p>
                  </div>
                  <div className="advisor-roster-metrics">
                    <span>GPA {student.gpa ?? 'N/A'}</span>
                    <span>{student.academic_standing || student.status || 'status pending'}</span>
                    <span>{student.completion_rate ?? 'No'}% complete</span>
                    <span>{student.active_alert_count || 0} active alerts</span>
                    <span>{student.high_priority_alert_count || 0} high priority</span>
                  </div>
                  <div className="advisor-roster-actions">
                    <button className="advisor-detail-button" onClick={() => selectStudent(student.id)}>
                      View Details
                    </button>
                    <button className="advisor-note-toggle" onClick={() => toggleStudentNotes(student.id)}>
                      {expandedStudentId === student.id ? 'Hide Notes' : 'Notes'}
                    </button>
                  </div>
                </div>

                {expandedStudentId === student.id && (
                  <div className="advisor-note-panel">
                    <textarea
                      value={noteDrafts[student.id] || ''}
                      maxLength={2000}
                      placeholder="Add a follow-up note for this student..."
                      onChange={(event) => setNoteDrafts(prev => ({
                        ...prev,
                        [student.id]: event.target.value,
                      }))}
                    />
                    <div className="advisor-note-actions">
                      <span>{(noteDrafts[student.id] || '').length}/2000</span>
                      <button
                        onClick={() => saveStudentNote(student.id)}
                        disabled={savingNoteId === student.id || !String(noteDrafts[student.id] || '').trim()}
                      >
                        {savingNoteId === student.id ? 'Saving' : 'Save Note'}
                      </button>
                    </div>

                    <div className="advisor-note-list">
                      {(notesByStudent[student.id] || []).length > 0 ? (
                        notesByStudent[student.id].map(note => (
                          <div key={note.id} className="advisor-note-item">
                            <div>
                              <p>{note.note}</p>
                              <span>{formatDateTime(note.created_at)}</span>
                            </div>
                            <button
                              onClick={() => deleteStudentNote(student.id, note.id)}
                              disabled={deletingNoteId === note.id}
                            >
                              {deletingNoteId === note.id ? 'Deleting' : 'Delete'}
                            </button>
                          </div>
                        ))
                      ) : (
                        <p className="advisor-note-empty">No notes yet.</p>
                      )}
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="advisor-empty">No students are assigned to you yet.</p>
        )}
      </section>

      {selectedStudent && (
        <section className="advisor-detail-view">
          <div className="advisor-section-heading">
            <div>
              <h2>{selectedStudent.name || 'Student'} Detail</h2>
              <p>{selectedStudent.email}</p>
            </div>
            <button className="advisor-detail-close" onClick={() => setSelectedStudentId(null)}>
              Close
            </button>
          </div>

          <div className="advisor-detail-grid">
            <div className="advisor-detail-card">
              <h3>Profile</h3>
              <div className="advisor-detail-metrics">
                <span>GPA {selectedStudent.gpa ?? 'N/A'}</span>
                <span>{selectedStudent.academic_standing || selectedStudent.status || 'status pending'}</span>
                <span>{selectedStudent.completion_rate ?? 'No'}% complete</span>
                <span>{selectedStudent.last_audit_uploaded_at ? `Audit ${formatDateTime(selectedStudent.last_audit_uploaded_at)}` : 'No audit uploaded'}</span>
              </div>
            </div>

            <div className="advisor-detail-card">
              <h3>Active Alerts</h3>
              {selectedStudentAlerts.length > 0 ? (
                <div className="advisor-detail-alerts">
                  {selectedStudentAlerts.map(alert => (
                    <div key={alert.id} className={`advisor-detail-alert ${alert.priority || 'medium'}`}>
                      <strong>{alert.title || 'Academic Alert'}</strong>
                      <p>{alert.message}</p>
                      {alert.recommended_action && <span>{alert.recommended_action}</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="advisor-note-empty">No active alerts for this student.</p>
              )}
            </div>

            <div className="advisor-detail-card advisor-detail-notes">
              <h3>Notes</h3>
              <textarea
                value={noteDrafts[selectedStudent.id] || ''}
                maxLength={2000}
                placeholder="Add a follow-up note for this student..."
                onChange={(event) => setNoteDrafts(prev => ({
                  ...prev,
                  [selectedStudent.id]: event.target.value,
                }))}
              />
              <div className="advisor-note-actions">
                <span>{(noteDrafts[selectedStudent.id] || '').length}/2000</span>
                <button
                  onClick={() => saveStudentNote(selectedStudent.id)}
                  disabled={savingNoteId === selectedStudent.id || !String(noteDrafts[selectedStudent.id] || '').trim()}
                >
                  {savingNoteId === selectedStudent.id ? 'Saving' : 'Save Note'}
                </button>
              </div>

              <div className="advisor-note-list">
                {(notesByStudent[selectedStudent.id] || []).length > 0 ? (
                  notesByStudent[selectedStudent.id].map(note => (
                    <div key={note.id} className="advisor-note-item">
                      <div>
                        <p>{note.note}</p>
                        <span>{formatDateTime(note.created_at)}</span>
                      </div>
                      <button
                        onClick={() => deleteStudentNote(selectedStudent.id, note.id)}
                        disabled={deletingNoteId === note.id}
                      >
                        {deletingNoteId === note.id ? 'Deleting' : 'Delete'}
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="advisor-note-empty">No notes yet.</p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

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
