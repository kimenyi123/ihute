'use client';

import { useState } from 'react';
import { Bell, Send, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function TestInAppNotificationsPage() {
  const [email, setEmail] = useState('');
  const [title, setTitle] = useState('Test Notification 🎉');
  const [message, setMessage] = useState('This is a test in-app notification!');
  const [actionUrl, setActionUrl] = useState('/');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const createTestNotification = async () => {
    if (!email.trim()) {
      setErrorMsg('Please enter your email address');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setErrorMsg('');

    try {
      const response = await fetch('/api/test-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: email,
          title,
          message,
          actionUrl,
          notificationType: 'test'
        })
      });

      const data = await response.json();

      if (data.ok) {
        setStatus('success');
        setTimeout(() => setStatus('idle'), 3000);
      } else {
        setStatus('error');
        setErrorMsg(data.error || 'Failed to create notification');
      }
    } catch (error) {
      setStatus('error');
      setErrorMsg('Network error: ' + (error as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-6 h-6" />
              Test In-App Notifications
            </CardTitle>
            <CardDescription>
              Create a test notification to verify the in-app notification system is working
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Create Test Notification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Your Email (User ID)</Label>
              <Input
                id="email"
                type="email"
                placeholder="your-email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Enter the email you use to login to the website
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Notification Title</Label>
              <Input
                id="title"
                placeholder="Test Notification 🎉"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Notification Message</Label>
              <Textarea
                id="message"
                placeholder="This is a test notification!"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="actionUrl">Action URL (where to navigate when clicked)</Label>
              <Input
                id="actionUrl"
                placeholder="/"
                value={actionUrl}
                onChange={(e) => setActionUrl(e.target.value)}
              />
            </div>

            <Button
              onClick={createTestNotification}
              disabled={status === 'loading'}
              className="w-full"
            >
              {status === 'loading' ? (
                'Creating...'
              ) : status === 'success' ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Notification Created!
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Create Test Notification
                </>
              )}
            </Button>

            {status === 'error' && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {errorMsg}
              </div>
            )}

            {status === 'success' && (
              <div className="p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
                ✅ Notification created! Check the bell icon in the header (may take up to 30 seconds to appear)
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">How to Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ol className="list-decimal list-inside space-y-2">
              <li>Enter your login email in the form above</li>
              <li>Customize the notification title and message (optional)</li>
              <li>Click "Create Test Notification"</li>
              <li>Look at the bell icon in the header - you should see a red badge</li>
              <li>Click the bell to open the notification panel</li>
              <li>Click the notification to mark it as read</li>
            </ol>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="font-medium text-blue-900 mb-1">💡 Note:</p>
              <p className="text-blue-700">
                The notification bell auto-refreshes every 30 seconds. If you don't see the badge immediately, 
                wait a moment or refresh the page.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Test Scenarios</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                setTitle('Order Confirmed! 🎉');
                setMessage('Your order #12345 has been confirmed. Amount: 5000 RWF');
                setActionUrl('/orders/12345');
              }}
            >
              Order Confirmed Notification
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                setTitle('Order Delivered! 📦');
                setMessage('Your order #12345 has been delivered. Please rate your experience!');
                setActionUrl('/orders/12345/rate');
              }}
            >
              Order Delivered Notification
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                setTitle('Table Order Sent! 🍽️');
                setMessage("Table 'My Table' order with 5 items has been sent to the kitchen");
                setActionUrl('/tables/my-table');
              }}
            >
              Table Order Notification
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                setTitle('Price Drop Alert! 💰');
                setMessage('Product XYZ is now 3000 RWF (25% off!)');
                setActionUrl('/products/xyz');
              }}
            >
              Price Drop Notification
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
