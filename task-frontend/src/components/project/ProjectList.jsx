import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ProjectCard } from './ProjectCard';
import { ProjectFormModal } from './ProjectFormModal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Spinner } from '../ui/Spinner';
import { EmptyState } from '../ui/EmptyState';
import { useToast } from '../../context/ToastContext';
import { jwtDecode } from 'jwt-decode';
import { API_BASE } from '../../config';

/**
 * ProjectList Component (M4.2)
 * Main responsive Projects list page with search, status filters, and project creation flow
 */
export const ProjectList = ({ apiBase = API_BASE }) => {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [projects, setProjects] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
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
        console.error('Failed to decode token in ProjectList:', err);
      }
    }
  }, [token]);

  const fetchProjectsAndTeams = useCallback(async () => {
    if (!token) {
      navigate('/login');
      return;
    }

    setLoading(true);
    try {
      const [projRes, teamsRes, tasksRes] = await Promise.all([
        authAxios.get('/projects'),
        authAxios.get('/teams'),
        authAxios.get('/tasks/all'),
      ]);

      const rawProjects = projRes.data || [];
      const allTasks = tasksRes.data || [];

      // Calculate tasks & milestones counts for each project
      const enrichedProjects = await Promise.all(
        rawProjects.map(async (p) => {
          const projId = p._id || p.id;
          const projTasks = allTasks.filter((t) => (t.projectId?._id || t.projectId) === projId);
          const completedTasks = projTasks.filter((t) => t.status === 'Done').length;

          let milestoneCount = 0;
          try {
            const milesRes = await authAxios.get(`/milestones/project/${projId}`);
            milestoneCount = (milesRes.data || []).length;
          } catch {
            milestoneCount = 0;
          }

          return {
            ...p,
            totalTasks: projTasks.length,
            completedTasks,
            milestoneCount,
          };
        })
      );

      setProjects(enrichedProjects);
      setTeams(teamsRes.data || []);
    } catch (err) {
      console.error('Failed to fetch projects list:', err);
      if (err.response?.status === 401) {
        navigate('/login');
      } else {
        addToast('Failed to load projects.', { type: 'error' });
      }
    } finally {
      setLoading(false);
    }
  }, [token, navigate]);

  useEffect(() => {
    fetchProjectsAndTeams();
  }, [fetchProjectsAndTeams]);

  // Handle Project Creation & Update
  const handleSaveProject = async (payload, existingId) => {
    try {
      if (existingId) {
        await authAxios.put(`/projects/${existingId}`, payload);
        addToast('Project updated.', { type: 'success' });
      } else {
        await authAxios.post('/projects', payload);
        addToast('Project created successfully.', { type: 'success' });
      }
      fetchProjectsAndTeams();
    } catch (err) {
      console.error('Failed to save project:', err);
      addToast(err.response?.data?.error || 'Failed to save project', { type: 'error' });
      throw err;
    }
  };

  // Handle Project Archive
  const handleArchiveProject = async (projectId) => {
    try {
      await authAxios.delete(`/projects/${projectId}`);
      addToast('Project archived.', { type: 'info' });
      fetchProjectsAndTeams();
    } catch (err) {
      console.error('Failed to archive project:', err);
      addToast(err.response?.data?.error || 'Failed to archive project', { type: 'error' });
    }
  };

  // Client-side filtering by Search & Status
  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      !searchQuery.trim() ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="projects-list-page" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)', width: '100%' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: '700', color: 'var(--color-primary)', margin: 0 }}>
            📁 Projects Directory
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
            Manage target project hierarchies, milestones, and task execution across personal and team workspaces.
          </p>
        </div>

        <Button variant="primary" size="md" onClick={() => setCreateModalOpen(true)}>
          + Create Project
        </Button>
      </div>

      {/* Filter Controls Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 200px',
          gap: 'var(--space-md)',
          backgroundColor: 'var(--color-surface)',
          padding: 'var(--space-md)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-subtle)',
        }}
      >
        <Input
          placeholder="Search projects by title or description..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="ALL">All Statuses</option>
          <option value="ACTIVE">Active Only</option>
          <option value="COMPLETED">Completed Only</option>
          <option value="ARCHIVED">Archived Only</option>
        </Select>
      </div>

      {/* Content Section */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
          <Spinner size="xl" label="Loading projects..." />
        </div>
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          title={searchQuery || statusFilter !== 'ALL' ? 'No Matching Projects' : 'No Projects Found'}
          description={
            searchQuery || statusFilter !== 'ALL'
              ? 'Try adjusting your search query or status filter.'
              : 'Create your first project to organize target milestones and tasks!'
          }
          icon="📁"
          action={
            <Button variant="primary" onClick={() => setCreateModalOpen(true)}>
              + Create First Project
            </Button>
          }
        />
      ) : (
        <div
          className="projects-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: 'var(--space-lg)',
          }}
        >
          {filteredProjects.map((p) => (
            <ProjectCard
              key={p._id || p.id}
              project={p}
              onSelect={(id) => navigate(`/projects/${id}`)}
              onEdit={(proj) => setEditingProject(proj)}
              onArchive={(proj) => handleArchiveProject(proj._id || proj.id)}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <ProjectFormModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={handleSaveProject}
        teams={teams}
        currentUserId={currentUserId}
      />

      {/* Edit Modal */}
      {editingProject && (
        <ProjectFormModal
          isOpen={Boolean(editingProject)}
          onClose={() => setEditingProject(null)}
          onSubmit={handleSaveProject}
          initialData={editingProject}
          teams={teams}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
};
