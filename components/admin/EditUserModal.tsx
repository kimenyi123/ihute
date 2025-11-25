'use client';

import { useState, useEffect } from 'react';
import { User } from '@/lib/types/user';
import { Modal, Button, Form, Row, Col, Tab, Tabs } from 'react-bootstrap';

interface EditUserModalProps {
  show: boolean;
  user: User | null;
  onHide: () => void;
  onSave: (user: User) => void;
}

export default function EditUserModal({ show, user, onHide, onSave }: EditUserModalProps) {
  const [formData, setFormData] = useState<Partial<User>>({});

  useEffect(() => {
    if (user) {
      setFormData(user);
    }
  }, [user]);

  const handleChange = (field: keyof User, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (user) {
      onSave({ ...user, ...formData } as User);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="xl" scrollable>
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton className="bg-dark text-white">
          <Modal.Title>✏️ Update User</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Tabs defaultActiveKey="basic" className="mb-3">
            {/* Basic Information Tab */}
            <Tab eventKey="basic" title="📋 Basic Info">
              <Row className="mb-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Email *</Form.Label>
                    <Form.Control
                      type="email"
                      value={formData.email || ''}
                      onChange={(e) => handleChange('email', e.target.value)}
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Client ID</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.clientId || ''}
                      readOnly
                      className="bg-light"
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row className="mb-3">
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>First Name</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.firstName || ''}
                      onChange={(e) => handleChange('firstName', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Last Name</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.lastName || ''}
                      onChange={(e) => handleChange('lastName', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Name (Lname)</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.Lname || ''}
                      onChange={(e) => handleChange('Lname', e.target.value)}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row className="mb-3">
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Phone (tel)</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.tel || ''}
                      onChange={(e) => handleChange('tel', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Phone</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.phone || ''}
                      onChange={(e) => handleChange('phone', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Mobile Money (MoMo)</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.momo || ''}
                      onChange={(e) => handleChange('momo', e.target.value)}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row className="mb-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Nickname</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.nickname || ''}
                      onChange={(e) => handleChange('nickname', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Nick Name (Alternative)</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.nickName || ''}
                      onChange={(e) => handleChange('nickName', e.target.value)}
                    />
                  </Form.Group>
                </Col>
              </Row>
            </Tab>

            {/* Business Information Tab */}
            <Tab eventKey="business" title="🏢 Business Info">
              <Row className="mb-3">
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>TIN</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.tin || ''}
                      onChange={(e) => handleChange('tin', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Owner</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.owner || ''}
                      onChange={(e) => handleChange('owner', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Ishyiga Account</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.ishyigaAccount || ''}
                      onChange={(e) => handleChange('ishyigaAccount', e.target.value)}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row className="mb-3">
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>User Type</Form.Label>
                    <Form.Select
                      value={formData.type || 'BUYER'}
                      onChange={(e) => handleChange('type', e.target.value as 'BUYER' | 'SELLER' | 'ADMIN')}
                    >
                      <option value="BUYER">BUYER</option>
                      <option value="SELLER">SELLER</option>
                      <option value="ADMIN">ADMIN</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Status</Form.Label>
                    <Form.Select
                      value={formData.status || 'PENDING'}
                      onChange={(e) => handleChange('status', e.target.value as 'LIVE' | 'SLEEPING' | 'PENDING')}
                    >
                      <option value="LIVE">LIVE</option>
                      <option value="SLEEPING">SLEEPING</option>
                      <option value="PENDING">PENDING</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Department</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.department || ''}
                      onChange={(e) => handleChange('department', e.target.value)}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row className="mb-3">
                <Col md={12}>
                  <Form.Group>
                    <Form.Label>Description</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={formData.description || ''}
                      onChange={(e) => handleChange('description', e.target.value)}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row className="mb-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Certificate</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.certificate || ''}
                      onChange={(e) => handleChange('certificate', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Photo URL</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.photo || ''}
                      onChange={(e) => handleChange('photo', e.target.value)}
                    />
                  </Form.Group>
                </Col>
              </Row>
            </Tab>

            {/* Location Tab */}
            <Tab eventKey="location" title="📍 Location">
              <Row className="mb-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>HQ Location</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.hqLocation || ''}
                      onChange={(e) => handleChange('hqLocation', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Country</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.country || ''}
                      onChange={(e) => handleChange('country', e.target.value)}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row className="mb-3">
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Province</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.locProvince || ''}
                      onChange={(e) => handleChange('locProvince', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>District</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.locDistrict || ''}
                      onChange={(e) => handleChange('locDistrict', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Cell</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.locCell || ''}
                      onChange={(e) => handleChange('locCell', e.target.value)}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row className="mb-3">
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Latitude</Form.Label>
                    <Form.Control
                      type="number"
                      step="any"
                      value={formData.supplierLatitude || ''}
                      onChange={(e) => handleChange('supplierLatitude', parseFloat(e.target.value))}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Longitude</Form.Label>
                    <Form.Control
                      type="number"
                      step="any"
                      value={formData.supplierLongitude || ''}
                      onChange={(e) => handleChange('supplierLongitude', parseFloat(e.target.value))}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>GPS Accuracy</Form.Label>
                    <Form.Control
                      type="number"
                      value={formData.gpsAccuracy || ''}
                      onChange={(e) => handleChange('gpsAccuracy', parseFloat(e.target.value))}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row className="mb-3">
                <Col md={12}>
                  <Form.Group>
                    <Form.Label>GPS Last Updated</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.gpsLastUpdated || ''}
                      onChange={(e) => handleChange('gpsLastUpdated', e.target.value)}
                      readOnly
                      className="bg-light"
                    />
                  </Form.Group>
                </Col>
              </Row>
            </Tab>

            {/* Preferences Tab */}
            <Tab eventKey="preferences" title="⚙️ Preferences">
              <Row className="mb-3">
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Language</Form.Label>
                    <Form.Select
                      value={formData.language || 'ENG'}
                      onChange={(e) => handleChange('language', e.target.value as 'KIN' | 'SWA' | 'ENG' | 'FRA' | 'POR')}
                    >
                      <option value="KIN">Kinyarwanda</option>
                      <option value="SWA">Swahili</option>
                      <option value="ENG">English</option>
                      <option value="FRA">French</option>
                      <option value="POR">Portuguese</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Currency</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.currency || ''}
                      onChange={(e) => handleChange('currency', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Preferred Currency</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.preferredCurrency || ''}
                      onChange={(e) => handleChange('preferredCurrency', e.target.value)}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row className="mb-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Preferred Categories</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.preferredCategories || ''}
                      onChange={(e) => handleChange('preferredCategories', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Preferred Payment</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.preferredPay || ''}
                      onChange={(e) => handleChange('preferredPay', e.target.value)}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row className="mb-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Preferred Seller Nickname</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.preferredSellerNickname || ''}
                      onChange={(e) => handleChange('preferredSellerNickname', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Use Ishyiga</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.useIshyiga || ''}
                      onChange={(e) => handleChange('useIshyiga', e.target.value)}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row className="mb-3">
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Discount (%)</Form.Label>
                    <Form.Control
                      type="number"
                      step="0.01"
                      value={formData.discount || 0}
                      onChange={(e) => handleChange('discount', parseFloat(e.target.value))}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Rating Star</Form.Label>
                    <Form.Control
                      type="number"
                      step="0.1"
                      max="5"
                      value={formData.ratingStar || 0}
                      onChange={(e) => handleChange('ratingStar', parseFloat(e.target.value))}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Completion %</Form.Label>
                    <Form.Control
                      type="number"
                      step="0.01"
                      value={formData.completionPercentage || 0}
                      onChange={(e) => handleChange('completionPercentage', parseFloat(e.target.value))}
                      readOnly
                      className="bg-light"
                    />
                  </Form.Group>
                </Col>
              </Row>
            </Tab>

            {/* System Info Tab */}
            <Tab eventKey="system" title="🔧 System">
              <Row className="mb-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>User Token</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.userToken || ''}
                      readOnly
                      className="bg-light"
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Quick Entry ID</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.quickEntryId || ''}
                      onChange={(e) => handleChange('quickEntryId', e.target.value)}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row className="mb-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Assigned By</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.assignedBy || ''}
                      onChange={(e) => handleChange('assignedBy', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Published By</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.publishedBy || ''}
                      onChange={(e) => handleChange('publishedBy', e.target.value)}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row className="mb-3">
                <Col md={12}>
                  <Form.Group>
                    <Form.Label>OTP</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.otp || ''}
                      readOnly
                      className="bg-light"
                    />
                  </Form.Group>
                </Col>
              </Row>
            </Tab>
          </Tabs>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            Cancel
          </Button>
          <Button variant="success" type="submit">
            ✅ Update User
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
