import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { ProjectHeader } from './ProjectHeader';
import { ProjectProgress } from './ProjectProgress';
import { MilestoneSection } from './MilestoneSection';
import { ProjectFormModal } from './ProjectFormModal';
import { KanbanBoard } from '../task/KanbanBoard';
import ProjectRecommendationsWidget from '../recommendations/ProjectRecommendationsWidget';
import { Card, CardBody } from '../ui/Card';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { EmptyState } from '../ui/EmptyState';
import { useToast } from '../../context/ToastContext';
import { jwtDecode } from 'jwt-decode';
import { API_BASE } from '../../config';

/**
 * ProjectOverview Component (M4.3)
 * Full project detail screen with Project -> Milestone -> Task -> Subtask hierarchy and Kanban Board
 */
export const ProjectOverview = ({ apiBase = API_BASE }) => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [project, setProject] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  const token = localStorage.getItem('token');
  const authAxios = axios.create({
    baseURL: apiBase,
    headers: { Authorization: `Bearer ${token}` },
  });

  useEffect(() => {
    if (token) {
      try {
        const decoded = jwtDecode(token);
        const normalizedId = decoded._id ?? decoded.id ?? decoded.userId;
        setCurrentUserId(normalizedId);
      } catch (err) {
        console.error('Failed to decode token:', err);
      }
    }
  }, [token]);

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

  // Project handlers
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

  // Milestone handlers
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

  // Task handlers for Kanban
  const handleTaskCreate = async (payload) => {
    try {
      await authAxios.post('/tasks', { ...payload, projectId });
      addToast('Task created.', { type: 'success' });
      const taskRes = await authAxios.get(`/tasks/project/${projectId}`);
      setTasks(taskRes.data || []);
    } catch (err) {
      console.error('Failed to create task:', err);
      addToast(err.response?.data?.error || 'Failed to create task', { type: 'error' });
      throw err;
    }
  };

  const handleTaskUpdate = async (taskId, payload) => {
    try {
      await authAxios.put(`/tasks/${taskId}`, payload);
      addToast('Task updated.', { type: 'success', duration: 2000 });
      const taskRes = await authAxios.get(`/tasks/project/${projectId}`);
      setTasks(taskRes.data || []);
    } catch (err) {
      console.error('Failed to update task:', err);
      addToast(err.response?.data?.error || 'Failed to update task', { type: 'error' });
      throw err;
    }
  };

  const handleTaskDelete = async (taskId) => {
    try {
      await authAxios.delete(`/tasks/${taskId}`);
      addToast('Task deleted.', { type: 'info' });
      setTasks((prev) => prev.filter((t) => (t._id || t.id) !== taskId));
    } catch (err) {
      console.error('Failed to delete task:', err);
      addToast(err.response?.data?.error || 'Failed to delete task', { type: 'error' });
    }
  };

  const handleAddComment = async (taskId, content) => {
    try {
      const res = await authAxios.post(`/tasks/${taskId}/comments`, { content });
      addToast('Comment added.', { type: 'success' });
      setTasks((prev) => prev.map((t) => ((t._id || t.id) === taskId ? res.data : t)));
    } catch (err) {
      console.error('Failed to add comment:', err);
      addToast(err.response?.data?.error || 'Failed to add comment', { type: 'error' });
      throw err;
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
      {/* Breadcrumb & Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <Link to="/projects" className="btn-back-header">← Back to Projects</Link>
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
      </div>

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

      {/* Advisory Project Recommendations */}
      <ProjectRecommendationsWidget projectId={projectId} authAxios={authAxios} />

      {/* Milestones Section */}
      <MilestoneSection
        projectId={projectId}
        milestones={milestones}
        tasks={tasks}
        onCreateMilestone={handleCreateMilestone}
        onUpdateMilestone={handleUpdateMilestone}
        onDeleteMilestone={handleDeleteMilestone}
      />

      {/* Kanban Task Board Section */}
      <KanbanBoard
        tasks={tasks}
        projects={[project]}
        milestones={milestones}
        teamMembers={teams.flatMap((t) => t.members || [])}
        currentUserId={currentUserId}
        currentProjectId={projectId}
        authAxios={authAxios}
        onTaskCreate={handleTaskCreate}
        onTaskUpdate={handleTaskUpdate}
        onTaskDelete={handleTaskDelete}
        onAddComment={handleAddComment}
      />

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
