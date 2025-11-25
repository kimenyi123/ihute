import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './TableCommandUI.css';

/**
 * ✅ TABLE COMMAND UI - Complete Frontend Component
 *
 * Features:
 * - Create new table with payment mode selection
 * - View active tables at location
 * - Join existing table
 * - Send table order (aggregates all child orders)
 * - Close table after payment
 * - Reactivate closed table
 * - View table history
 *
 * @author Gilbert (Frontend Integration)
 */

const API_BASE = '/Ihute/OrdersServlet';

export default function TableCommandUI({ userEmail, supplierAccount, supplierName }) {
    // State management
    const [tableName, setTableName] = useState('');
    const [paymentMode, setPaymentMode] = useState('SPLIT');
    const [unifiedPaymentMethod, setUnifiedPaymentMethod] = useState('');
    const [activeTables, setActiveTables] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    const [showHistory, setShowHistory] = useState(false);
    const [tableHistory, setTableHistory] = useState(null);

    // Fetch active tables on component mount and every 30 seconds
    useEffect(() => {
        fetchActiveTables();
        const interval = setInterval(fetchActiveTables, 30000);
        return () => clearInterval(interval);
    }, [supplierAccount]);

    // API: Fetch active tables
    const fetchActiveTables = async () => {
        try {
            const res = await axios.get(API_BASE, {
                params: {
                    action: 'getActiveTables',
                    locationId: supplierAccount
                }
            });

            if (res.data.ok) {
                setActiveTables(res.data.tables || []);
            }
        } catch (err) {
            console.error('Failed to fetch active tables:', err);
        }
    };

    // API: Create new table
    const createTable = async () => {
        if (!tableName.trim()) {
            setError('Please enter a table name');
            return;
        }

        if (paymentMode === 'UNIFIED' && !unifiedPaymentMethod) {
            setError('Please select a payment method for UNIFIED mode');
            return;
        }

        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const res = await axios.post(API_BASE, new URLSearchParams({
                action: 'createTableCommand',
                tableName: tableName.trim(),
                locationId: supplierAccount,
                locationName: supplierName,
                userEmail,
                paymentMode,
                unifiedPaymentMethod: paymentMode === 'UNIFIED' ? unifiedPaymentMethod : ''
            }));

            if (res.data.ok) {
                setSuccessMessage(`✅ Table "${tableName}" created successfully!`);
                setTableName('');
                setPaymentMode('SPLIT');
                setUnifiedPaymentMethod('');
                fetchActiveTables();
            } else {
                setError(res.data.error || 'Failed to create table');

                // If duplicate error, suggest alternative
                if (res.data.error && res.data.error.includes('already exists')) {
                    const suggestion = res.data.suggestion || `Try "${tableName}-2"`;
                    setError(res.data.error + '\n' + suggestion);
                }
            }
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Network error');
        } finally {
            setLoading(false);
        }
    };

    // API: Join existing table
    const joinTable = async (table) => {
        setLoading(true);
        setError(null);

        try {
            const res = await axios.post(API_BASE, new URLSearchParams({
                action: 'joinTable',
                tableName: table.tableName,
                locationId: supplierAccount,
                userEmail
            }));

            if (res.data.ok) {
                setSuccessMessage(`✅ Joined table "${table.tableName}"!`);
                // Redirect to order page with table context
                const encodedTable = encodeURIComponent(table.tableName);
                const encodedLocation = encodeURIComponent(supplierAccount);
                window.location.href = `/order?table=${encodedTable}&location=${encodedLocation}`;
            } else {
                setError(res.data.error || 'Failed to join table');
            }
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Network error');
        } finally {
            setLoading(false);
        }
    };

    // API: Send table order (create master order)
    const sendTableOrder = async (table) => {
        if (!confirm(`Send complete order for table "${table.tableName}"?\n\nThis will aggregate all ${table.orderCount} child orders into one master order for the kitchen.`)) {
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const res = await axios.post(API_BASE, new URLSearchParams({
                action: 'sendTableOrder',
                tableName: table.tableName,
                locationId: supplierAccount,
                userEmail
            }));

            if (res.data.ok) {
                setSuccessMessage(
                    `✅ Order sent!\n\n` +
                    `Master Order ID: ${res.data.masterOrderId}\n` +
                    `Child Orders: ${res.data.childOrderCount}\n` +
                    `Total Amount: ${res.data.totalAmount.toFixed(2)} ${table.currency || 'RWF'}`
                );
                fetchActiveTables();
            } else {
                setError(res.data.error || 'Failed to send order');
            }
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Network error');
        } finally {
            setLoading(false);
        }
    };

    // API: Close table (final step after payment)
    const closeTable = async (table) => {
        if (!confirm(`Close table "${table.tableName}"?\n\nThis marks the table as fully completed and paid. This action cannot be undone.`)) {
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const res = await axios.post(API_BASE, new URLSearchParams({
                action: 'closeTable',
                tableName: table.tableName,
                locationId: supplierAccount,
                userEmail
            }));

            if (res.data.ok) {
                setSuccessMessage(`✅ Table "${table.tableName}" closed successfully!`);
                fetchActiveTables();
            } else {
                setError(res.data.error || 'Failed to close table');
            }
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Network error');
        } finally {
            setLoading(false);
        }
    };

    // API: Reactivate closed table
    const reactivateTable = async (table) => {
        if (!confirm(`Reactivate table "${table.tableName}"?\n\nThis will start a new session for this table.`)) {
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const res = await axios.post(API_BASE, new URLSearchParams({
                action: 'reactivateTable',
                tableName: table.tableName,
                locationId: supplierAccount,
                userEmail,
                paymentMode: 'SPLIT' // Default, can be changed later
            }));

            if (res.data.ok) {
                setSuccessMessage(
                    `✅ Table "${table.tableName}" reactivated!\n\n` +
                    `Session #${res.data.sessionNumber}\n` +
                    `Status: ${res.data.status}`
                );
                fetchActiveTables();
            } else {
                setError(res.data.error || 'Failed to reactivate table');
            }
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Network error');
        } finally {
            setLoading(false);
        }
    };

    // API: Get table history
    const viewHistory = async (table) => {
        setLoading(true);
        setError(null);

        try {
            const res = await axios.get(API_BASE, {
                params: {
                    action: 'getTableHistory',
                    tableName: table.tableName,
                    locationId: supplierAccount
                }
            });

            if (res.data.ok) {
                setTableHistory(res.data);
                setShowHistory(true);
            } else {
                setError(res.data.error || 'Failed to get history');
            }
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Network error');
        } finally {
            setLoading(false);
        }
    };

    // Dismiss messages
    const dismissMessage = () => {
        setError(null);
        setSuccessMessage(null);
    };

    // Get status badge color
    const getStatusBadge = (status) => {
        const badges = {
            'ACTIVE': { class: 'status-active', text: 'Active' },
            'SENT': { class: 'status-sent', text: 'Sent' },
            'CLOSED': { class: 'status-closed', text: 'Closed' },
            'EXPIRED': { class: 'status-expired', text: 'Expired' }
        };
        return badges[status] || { class: 'status-unknown', text: status };
    };

    // Get payment mode icon
    const getPaymentModeIcon = (mode) => {
        const icons = {
            'SPLIT': '🔀',
            'UNIFIED': '🔗',
            'OWNER_PAYS': '👑'
        };
        return icons[mode] || '💳';
    };

    return (
        <div className="table-command-ui">
            {/* Header */}
            <div className="ui-header">
                <h2>🍽️ Table Commands @ {supplierName}</h2>
                <p className="user-info">Logged in as: <strong>{userEmail}</strong></p>
            </div>

            {/* Messages */}
            {error && (
                <div className="message message-error">
                    <span>{error}</span>
                    <button onClick={dismissMessage}>✕</button>
                </div>
            )}

            {successMessage && (
                <div className="message message-success">
                    <span>{successMessage}</span>
                    <button onClick={dismissMessage}>✕</button>
                </div>
            )}

            {/* Create New Table Section */}
            <div className="section create-table-section">
                <h3>➕ Create New Table</h3>

                <div className="form-group">
                    <label htmlFor="tableName">Table Name:</label>
                    <input
                        id="tableName"
                        type="text"
                        placeholder="e.g., Table A, Terrace-3, Room 101"
                        value={tableName}
                        onChange={(e) => setTableName(e.target.value)}
                        disabled={loading}
                        maxLength={255}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="paymentMode">Payment Mode:</label>
                    <select
                        id="paymentMode"
                        value={paymentMode}
                        onChange={(e) => setPaymentMode(e.target.value)}
                        disabled={loading}
                    >
                        <option value="SPLIT">🔀 Split Payment (each pays own)</option>
                        <option value="UNIFIED">🔗 Unified Payment (one person pays all)</option>
                        <option value="OWNER_PAYS">👑 Owner Pays (creator pays all)</option>
                    </select>
                </div>

                {paymentMode === 'UNIFIED' && (
                    <div className="form-group">
                        <label htmlFor="unifiedPaymentMethod">Required Payment Method:</label>
                        <select
                            id="unifiedPaymentMethod"
                            value={unifiedPaymentMethod}
                            onChange={(e) => setUnifiedPaymentMethod(e.target.value)}
                            disabled={loading}
                        >
                            <option value="">Select payment method...</option>
                            <option value="MOMO_MTN">MTN Mobile Money</option>
                            <option value="MOMO_AIRTEL">Airtel Money</option>
                            <option value="CARD">Credit/Debit Card</option>
                            <option value="CASH">Cash</option>
                        </select>
                    </div>
                )}

                <button
                    className="btn btn-primary"
                    onClick={createTable}
                    disabled={loading || !tableName.trim()}
                >
                    {loading ? '⏳ Creating...' : '➕ Create Table'}
                </button>
            </div>

            {/* Active Tables Section */}
            <div className="section active-tables-section">
                <h3>📋 Active Tables ({activeTables.length})</h3>

                {loading && <p className="loading">⏳ Loading tables...</p>}

                {!loading && activeTables.length === 0 && (
                    <p className="empty-state">
                        No active tables at this location. Create one to get started!
                    </p>
                )}

                {!loading && activeTables.length > 0 && (
                    <div className="table-grid">
                        {activeTables.map((table) => {
                            const badge = getStatusBadge(table.status);
                            const icon = getPaymentModeIcon(table.paymentMode);

                            return (
                                <div key={table.id} className="table-card">
                                    <div className="card-header">
                                        <h4>{table.tableName}</h4>
                                        <span className={`badge ${badge.class}`}>{badge.text}</span>
                                    </div>

                                    <div className="card-body">
                                        <div className="card-info">
                                            <span>💳 Payment: {icon} {table.paymentMode}</span>
                                            <span>👥 Participants: {table.participantCount || 0}</span>
                                            <span>🛒 Orders: {table.orderCount || 0}</span>
                                        </div>

                                        {table.createdBy && (
                                            <div className="card-meta">
                                                <small>Created by: {table.createdBy}</small>
                                            </div>
                                        )}
                                    </div>

                                    <div className="card-actions">
                                        {table.status === 'ACTIVE' && (
                                            <>
                                                <button
                                                    className="btn btn-sm btn-secondary"
                                                    onClick={() => joinTable(table)}
                                                    disabled={loading}
                                                >
                                                    🚪 Join
                                                </button>

                                                <button
                                                    className="btn btn-sm btn-primary"
                                                    onClick={() => sendTableOrder(table)}
                                                    disabled={loading || (table.orderCount || 0) === 0}
                                                >
                                                    📤 Send Order
                                                </button>
                                            </>
                                        )}

                                        {table.status === 'SENT' && (
                                            <button
                                                className="btn btn-sm btn-success"
                                                onClick={() => closeTable(table)}
                                                disabled={loading}
                                            >
                                                ✅ Close Table
                                            </button>
                                        )}

                                        {table.status === 'CLOSED' && (
                                            <button
                                                className="btn btn-sm btn-warning"
                                                onClick={() => reactivateTable(table)}
                                                disabled={loading}
                                            >
                                                🔄 Reactivate
                                            </button>
                                        )}

                                        <button
                                            className="btn btn-sm btn-info"
                                            onClick={() => viewHistory(table)}
                                            disabled={loading}
                                        >
                                            📜 History
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Table History Modal */}
            {showHistory && tableHistory && (
                <div className="modal-overlay" onClick={() => setShowHistory(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>📜 Table History: {tableHistory.tableName}</h3>
                            <button className="btn-close" onClick={() => setShowHistory(false)}>✕</button>
                        </div>

                        <div className="modal-body">
                            <p>Total Sessions: <strong>{tableHistory.totalSessions}</strong></p>

                            {tableHistory.sessions && tableHistory.sessions.map((session, idx) => (
                                <div key={idx} className="history-session">
                                    <h4>Session #{session.reactivationCount + 1}</h4>
                                    <div className="session-details">
                                        <p>Status: <span className={`badge ${getStatusBadge(session.status).class}`}>
                                            {session.status}
                                        </span></p>
                                        <p>Created by: {session.createdBy}</p>
                                        <p>Payment Mode: {session.paymentMode}</p>
                                        <p>Participants: {session.totalParticipants}</p>
                                    </div>

                                    {session.participants && session.participants.length > 0 && (
                                        <div className="participants-list">
                                            <h5>Participants:</h5>
                                            <ul>
                                                {session.participants.map((p, pidx) => (
                                                    <li key={pidx}>
                                                        {p.userName || p.userEmail} -
                                                        {p.orderCount} orders,
                                                        {p.totalAmount.toFixed(2)} RWF
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
