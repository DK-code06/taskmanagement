import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { ProjectHeader } from './ProjectHeader';
import { ProjectProgress } from './ProjectProgress';
import { MilestoneSection } from './MilestoneSection';
import { ProjectFormModal } from './ProjectFormModal';
import { SubtaskList } from './SubtaskList';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { EmptyState } from '../ui/EmptyState';
import { useToast } from '../../context/ToastContext';

/**
 * ProjectOverview Component (M4.2)
 * Full project detail screen exposing Project -> Milestone -> Task -> Subtask hierarchy
 */
export const ProjectOverview = ({ apiBase = 'http://localhost:5000/api' }) => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [project, setProject] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState(null); // { status: 403 | 404 | 500, message: string }
  const [editModalOpen, setEditModalOpen] = useState(false);

  const token = localStorage.getItem('token');
  const authAxios = axios.create({
    baseURL: apiBase,
    headers: { Authorization: `Bearer ${token}` },
  });

  const fetchData = useCallback(async () => {
    if (!token || !projectId) return;
    setLoading(true);
    setErrorState(null);

    try {
      const [projRes, mileRes, taskRes, teamsRes] = await Promise.all([
        authAxios.get(`/projects/${projectId}`),
        authAxios.get(`/milestones/project/${projectId}`),
        authAxios.get(`/tasks/project/${projectId}`),
        authAxios.get(`/teams`),
      ]);

      setProject(projRes.data);
      setMilestones(mileRes.data || []);
      setTasks(taskRes.data || []);
      setTeams(teamsRes.data || []);
    } catch (err) {
      console.error('Error fetching project overview:', err);
      const status = err.response?.status;
      if (status === 401) {
        navigate('/login');
        return;
      }
      if (status === 403) {
        setErrorState({ status: 403, message: 'You do not have authorization to view this project.' });
      } else if (status === 404) {
        setErrorState({ status: 404, message: 'The requested project could not be found.' });
      } else {
        setErrorState({ status: 500, message: err.response?.data?.error || 'Failed to load project details.' });
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Project update handler
  const handleUpdateProject = async (payload) => {
    try {
      const res = await authAxios.put(`/projects/${projectId}`, payload);
      setProject(res.data);
      addToast('Project updated successfully.', { type: 'success' });
      fetchData();
    } catch (err) {
      console.error('Failed to update project:', err);
      addToast(err.response?.data?.error || 'Failed to update project', { type: 'error' });
      throw err;
    }
  };

  // Project archive handler
  const handleArchiveProject = async () => {
    try {
      await authAxios.delete(`/projects/${projectId}`);
      addToast('Project archived successfully.', { type: 'info' });
      navigate('/projects');
    } catch (err) {
      console.error('Failed to archive project:', err);
      addToast(err.response?.data?.error || 'Failed to archive project', { type: 'error' });
    }
  };

  // Milestone creation handler
  const handleCreateMilestone = async (payload) => {
    try {
      await authAxios.post('/milestones', payload);
      addToast('Milestone created.', { type: 'success' });
      const mileRes = await authAxios.get(`/milestones/project/${projectId}`);
      setMilestones(mileRes.data || []);
    } catch (err) {
      console.error('Failed to create milestone:', err);
      addToast(err.response?.data?.error || 'Failed to create milestone', { type: 'error' });
      throw err;
    }
  };

  // Milestone update handler
  const handleUpdateMilestone = async (payload, milestoneId) => {
    try {
      await authAxios.put(`/milestones/${milestoneId}`, payload);
      addToast('Milestone updated.', { type: 'success' });
      const mileRes = await authAxios.get(`/milestones/project/${projectId}`);
      setMilestones(mileRes.data || []);
    } catch (err) {
      console.error('Failed to update milestone:', err);
      addToast(err.response?.data?.error || 'Failed to update milestone', { type: 'error' });
      throw err;
    }
  };

  // Milestone delete handler
  const handleDeleteMilestone = async (milestoneId) => {
    try {
      await authAxios.delete(`/milestones/${milestoneId}`);
      addToast('Milestone deleted.', { type: 'info' });
      setMilestones((prev) => prev.filter((m) => (m._id || m.id) !== milestoneId));
    } catch (err) {
      console.error('Failed to delete milestone:', err);
      addToast(err.response?.data?.error || 'Failed to delete milestone', { type: 'error' });
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
        <Spinner size="xl" label="Loading project overview..." />
      </div>
    );
  }

  if (errorState) {
    return (
      <div style={{ maxWidth: '600px', margin: 'var(--space-2xl) auto', padding: '0 var(--space-md)' }}>
        <EmptyState
          title={errorState.status === 403 ? '403 - Permission Denied' : errorState.status === 404 ? '404 - Project Not Found' : 'Error'}
          description={errorState.message}
          icon={errorState.status === 403 ? '🔒' : '🔎'}
          action={
            <Button variant="primary" onClick={() => navigate('/projects')}>
              Back to Projects List
            </Button>
          }
        />
      </div>
    );
  }

  const completedTasks = tasks.filter((t) => t.status === 'Done').length;
  const totalTasks = tasks.length;

  return (
    <div className="project-overview-page" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)', width: '100%' }}>
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
        <ol style={{ display: 'flex', gap: '0.5rem', listStyle: 'none', padding: 0, margin: 0 }}>
          <li>
            <Link to="/projects" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
              Projects
            </Link>
          </li>
          <li>/</li>
          <li style={{ color: 'var(--color-text-primary)', fontWeight: '600' }}>{project.name}</li>
        </ol>
      </nav>

      {/* Project Header */}
      <ProjectHeader
        project={{ ...project, milestoneCount: milestones.length, completedTasks, totalTasks }}
        onEdit={() => setEditModalOpen(true)}
        onArchive={handleArchiveProject}
        onBack={() => navigate('/projects')}
      />

      {/* Overall Project Progress */}
      <Card variant="bordered">
        <CardBody>
          <ProjectProgress completedTasks={completedTasks} totalTasks={totalTasks} size="lg" />
        </CardBody>
      </Card>

      {/* Milestones Section */}
      <MilestoneSection
        projectId={projectId}
        milestones={milestones}
        tasks={tasks}
        onCreateMilestone={handleCreateMilestone}
        onUpdateMilestone={handleUpdateMilestone}
        onDeleteMilestone={handleDeleteMilestone}
      />

      {/* Project Tasks Summary Section */}
      <div className="project-tasks-section" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        <h3 style={{ fontSize: 'var(--font-size-xl)', fontWeight: '600', color: 'var(--color-text-primary)', margin: 0 }}>
          📋 Project Tasks ({totalTasks})
        </h3>

        {tasks.length === 0 ? (
          <EmptyState
            title="No Tasks in this Project"
            description="Tasks assigned to this project will appear here alongside milestone progress."
            icon="📋"
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {tasks.map((t) => {
              const priorityColors = {
                High: 'danger',
                Medium: 'warning',
                Low: 'success',
                'No Priority': 'neutral',
              };

              return (
                <Card key={t._id} variant="default" style={{ padding: '0.75rem 1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span>{t.status === 'Done' ? '✅' : '📌'}</span>
                      <strong style={{ fontSize: 'var(--font-size-md)', textDecoration: t.status === 'Done' ? 'line-through' : 'none' }}>
                        {t.title}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {t.assignedTo && <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>👤 {t.assignedTo.username}</span>}
                      <Badge variant={priorityColors[t.priority] || 'neutral'} size="sm">
                        {t.priority || 'No Priority'}
                      </Badge>
                      <Badge variant={t.status === 'Done' ? 'success' : t.status === 'In Progress' ? 'warning' : 'neutral'} size="sm">
                        {t.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Subtasks Visibility */}
                  <SubtaskList parentTaskId={t._id} authAxios={authAxios} />
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Project Edit Modal */}
      {editModalOpen && (
        <ProjectFormModal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          onSubmit={handleUpdateProject}
          initialData={project}
          teams={teams}
        />
      )}
    </div>
  );
};
