"use client"

import { useState, useEffect } from 'react'
import { Bell, Send, Mail, MessageSquare, Clock } from 'lucide-react'

interface NotificationHistory {
  id: number
  type: string
  title: string
  message: string
  target: string
  sentAt: string
  status: string
}

export default function NotificationsPage() {
  const [history, setHistory] = useState<NotificationHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [notificationType, setNotificationType] = useState<'push' | 'sms' | 'email'>('push')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [target, setTarget] = useState('all')

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getNotificationHistory' })
      })
      const data = await res.json()
      if (data.ok) {
        setHistory(data.history || [])
      }
    } catch (error) {
      console.error('Error loading notification history:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async () => {
    try {
      let action = 'sendPushNotification'
      if (notificationType === 'sms') action = 'sendSMSBroadcast'
      if (notificationType === 'email') action = 'sendEmailCampaign'

      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          title: notificationType === 'email' ? title : undefined,
          subject: notificationType === 'email' ? title : undefined,
          message,
          body: notificationType === 'email' ? message : undefined,
          target
        })
      })
      const data = await res.json()
      if (data.ok) {
        alert('Notification sent successfully')
        setTitle('')
        setMessage('')
        loadHistory()
      }
    } catch (error) {
      console.error('Error sending notification:', error)
      alert('Failed to send notification')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Notification Center</h1>
        <p className="text-gray-600 mt-1">Send notifications to users and manage campaigns</p>
      </div>

      {/* Send Notification */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Send Notification</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notification Type</label>
            <div className="flex gap-4">
              <button
                onClick={() => setNotificationType('push')}
                className={`px-4 py-2 rounded-lg ${
                  notificationType === 'push' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                Push Notification
              </button>
              <button
                onClick={() => setNotificationType('sms')}
                className={`px-4 py-2 rounded-lg ${
                  notificationType === 'sms' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                SMS Broadcast
              </button>
              <button
                onClick={() => setNotificationType('email')}
                className={`px-4 py-2 rounded-lg ${
                  notificationType === 'email' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                Email Campaign
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {notificationType === 'email' ? 'Subject' : 'Title'}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              placeholder={notificationType === 'email' ? 'Email subject' : 'Notification title'}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              placeholder="Enter your message"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience</label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">All Users</option>
              <option value="sellers">Sellers Only</option>
              <option value="buyers">Buyers Only</option>
            </select>
          </div>
          <button
            onClick={handleSend}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Send size={16} />
            Send Notification
          </button>
        </div>
      </div>

      {/* Notification History */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="text-gray-600" size={24} />
          <h2 className="text-xl font-semibold text-gray-900">Notification History</h2>
        </div>
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading history...</div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No notification history</div>
        ) : (
          <div className="space-y-4">
            {history.map((item) => (
              <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{item.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{item.message}</p>
                    <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                      <span>Type: {item.type}</span>
                      <span>Target: {item.target}</span>
                      <span>{item.sentAt}</span>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    item.status === 'sent' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


