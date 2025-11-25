'use client';

import { useState, useEffect } from 'react';
import { User } from '@/lib/types/user';
import UserTable from './UserTable';
import EditUserModal from './EditUserModal';
import { Container, Card, Alert, Spinner } from 'react-bootstrap';

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setShowModal(true);
  };

  const handleUpdate = async (updatedUser: User) => {
    try {
      const response = await fetch(`/api/users/${updatedUser.clientId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedUser),
      });

      if (!response.ok) throw new Error('Failed to update user');
      
      setUpdateStatus('success');
      setShowModal(false);
      fetchUsers(); // Refresh the list
      
      // Clear success message after 3 seconds
      setTimeout(() => setUpdateStatus('idle'), 3000);
    } catch (err) {
      setUpdateStatus('error');
      setError('Failed to update user');
    }
  };

  const handleDelete = async (clientId: string) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        const response = await fetch(`/api/users/${clientId}`, {
          method: 'DELETE',
        });

        if (!response.ok) throw new Error('Failed to delete user');
        
        fetchUsers(); // Refresh the list
      } catch (err) {
        setError('Failed to delete user');
      }
    }
  };

  if (loading) {
    return (
      <Container className="mt-5 text-center">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
        <div>Loading users...</div>
      </Container>
    );
  }

  if (error) return <Alert variant="danger">{error}</Alert>;

  return (
    <Container className="mt-5">
      <h2 className="text-center mb-4">👩‍💼 Admin Dashboard - User Trading</h2>
      
      {updateStatus === 'success' && (
        <Alert variant="success" className="mb-3">
          User updated successfully!
        </Alert>
      )}
      
      {updateStatus === 'error' && (
        <Alert variant="danger" className="mb-3">
          Failed to update user. Please try again.
        </Alert>
      )}

      <Card>
        <Card.Header className="bg-dark text-white">
          <i className="bi bi-table"></i> User Information
        </Card.Header>
        <Card.Body>
          <UserTable 
            users={users} 
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </Card.Body>
      </Card>

      <EditUserModal
        show={showModal}
        user={selectedUser}
        onHide={() => setShowModal(false)}
        onSave={handleUpdate}
      />
    </Container>
  );
}