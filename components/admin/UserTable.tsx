'use client';

import { useState, useMemo } from 'react';
import { User } from '@/lib/types/user';
import { Table, Form, Button } from 'react-bootstrap';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';

interface UserTableProps {
  users: User[];
  onEdit: (user: User) => void;
  onDelete: (clientId: string) => void;
}

export default function UserTable({ users, onEdit, onDelete }: UserTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const filteredUsers = useMemo(() => {
    const filtered = users.filter(user =>
      Object.values(user).some(value =>
        value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    );

    if (sortConfig) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key as keyof User];
        const bValue = b[sortConfig.key as keyof User];
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [users, searchTerm, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig(current => ({
      key,
      direction: current?.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredUsers.map(user => ({
      'CLIENT_ID': user.clientId,
      'Email': user.email,
      'Name': user.Lname,
      'Phone': user.phone,
      'Momo': user.momo,
      'TIN': user.tin,
      'Owner': user.owner,
      'Type': user.userType,
      'Language': user.language,
      'Preferred Categories': user.preferredCategories,
      'Status': user.status,
      'Department': user.department,
      'Description': user.description,
      'Currency': user.currency,
      'Country': user.country,
      'Location': user.hqLocation,
      'Preferred Currency': user.preferredCurrency,
      'Discount': user.discount,
      'Preferred Pay': user.preferredPay,
      'Province': user.locProvince,
      'District': user.locDistrict,
      'Cell': user.locCell,
      'Nick name': user.nickName,
      'Assigned By': user.assignedBy,
      'Published By': user.publishedBy,
      'Profile': user.completionPercentage.toFixed(2)
    })));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');
    
    const today = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `users_export_${today}.xlsx`);

    Swal.fire({
      icon: 'success',
      title: 'Export Successful!',
      text: `${filteredUsers.length} records exported to Excel successfully!`,
      showConfirmButton: false,
      timer: 2000
    });
  };

  return (
    <>
      <div className="table-controls">
        <Form.Control
          type="text"
          placeholder="🔍 Search user..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ maxWidth: '300px', marginBottom: '10px' }}
        />
        <Button 
          className="export-btn"
          onClick={exportToExcel}
        >
          <i className="bi bi-file-earmark-excel"></i> Export to Excel
        </Button>
      </div>

      <div className="table-responsive" style={{ maxHeight: '500px', overflowY: 'auto' }}>
        <Table striped bordered hover className="text-center align-middle">
          <thead className="bg-dark text-white">
            <tr>
              <th>CLIENT_ID</th>
              <th>Email</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Momo</th>
              <th>TIN</th>
              <th>Owner</th>
              <th>Type</th>
              <th>Language</th>
              <th>Preferred Categories</th>
              <th>Status</th>
              <th>Department</th>
              <th>Description</th>
              <th>Currency</th>
              <th>Country</th>
              <th>Location</th>
              <th>Preferred Currency</th>
              <th>Discount</th>
              <th>Preferred Pay</th>
              <th>Province</th>
              <th>District</th>
              <th>Cell</th>
              <th>Nick name</th>
              <th>Assigned By</th>
              <th>Published By</th>
              <th 
                style={{ cursor: 'pointer' }}
                onClick={() => handleSort('completionPercentage')}
              >
                Profile {sortConfig?.key === 'completionPercentage' ? 
                  (sortConfig.direction === 'asc' ? '⬆️' : '⬇️') : '⬍'}
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user, index) => (
              <tr key={index}>
                <td>{user.clientId}</td>
                <td>{user.email}</td>
                <td>{user.Lname}</td>
                <td>{user.phone}</td>
                <td>{user.momo}</td>
                <td>{user.tin}</td>
                <td>{user.owner}</td>
                <td>{user.userType}</td>
                <td>{user.language}</td>
                <td>{user.preferredCategories}</td>
                <td>{user.status}</td>
                <td>{user.department}</td>
                <td>{user.description}</td>
                <td>{user.currency}</td>
                <td>{user.country}</td>
                <td>{user.hqLocation}</td>
                <td>{user.preferredCurrency}</td>
                <td>{user.discount}</td>
                <td>{user.preferredPay}</td>
                <td>{user.locProvince}</td>
                <td>{user.locDistrict}</td>
                <td>{user.locCell}</td>
                <td>{user.nickName}</td>
                <td>{user.assignedBy}</td>
                <td>{user.publishedBy}</td>
                <td>{user.completionPercentage.toFixed(2)}</td>
                <td>
                  <Button
                    variant="dark"
                    size="sm"
                    className="me-2"
                    onClick={() => onEdit(user)}
                  >
                    ✏️
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => onDelete(user.clientId)}
                  >
                    🗑️
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </>
  );
}