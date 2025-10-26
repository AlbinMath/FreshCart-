
import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import EmailVerification from '../components/EmailVerification';

export default function SellerSchedule() {
  const { currentUser, getUserProfile } = useAuth();
  const navigate = useNavigate();
  const profile = useMemo(() => getUserProfile() || {}, [getUserProfile]);

  // Check if seller needs email verification
  const needsEmailVerification = useMemo(() => {
    return profile?.role === 'seller' && 
           profile?.provider === 'email' && 
           !currentUser?.emailVerified;
  }, [profile, currentUser]);

  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Form state
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    startTime: '09:00',
    endTime: '17:00',
    note: ''
  });

  // Generate next 7 days
  const weekDays = useMemo(() => {
    const days = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      days.push({
        date: date.toISOString().slice(0, 10),
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
        dayNumber: date.getDate(),
        monthName: date.toLocaleDateString('en-US', { month: 'short' }),
        isToday: i === 0
      });
    }
    return days;
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    loadSchedules();
  }, [currentUser]);

  async function loadSchedules() {
    if (!currentUser) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`http://localhost:5000/api/users/${currentUser.uid}/schedules`, {
        headers: { 'x-uid': currentUser.uid }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to load schedules');
      setSchedules(Array.isArray(data.schedules) ? data.schedules : []);
    } catch (e) {
      setError(e.message || 'Failed to load schedules');
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }

  function onChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  async function addSchedule(e) {
    e.preventDefault();
    setError('');
    setMessage('');

    // Check email verification
    if (needsEmailVerification) {
      alert('Please verify your email address before managing schedules.');
      return;
    }

    if (!form.date || !form.startTime || !form.endTime) {
      setError('Date, start time, and end time are required');
      return;
    }

    if (form.startTime >= form.endTime) {
      setError('End time must be after start time');
      return;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/users/${currentUser.uid}/schedules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-uid': currentUser.uid
        },
        body: JSON.stringify({
          date: form.date,
          startTime: form.startTime,
          endTime: form.endTime,
          note: form.note.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to add schedule');
      
      setMessage('Schedule added successfully');
      setForm({
        date: new Date().toISOString().slice(0, 10),
        startTime: '09:00',
        endTime: '17:00',
        note: ''
      });
      await loadSchedules();
    } catch (e) {
      setError(e.message || 'Failed to add schedule');
    }
  }

  async function removeSchedule(scheduleId) {
    if (needsEmailVerification) {
      alert('Please verify your email address before managing schedules.');
      return;
    }

    if (!window.confirm('Remove this schedule?')) return;

    try {
      const res = await fetch(`http://localhost:5000/api/users/${currentUser.uid}/schedules/${scheduleId}`, {
        method: 'DELETE',
        headers: { 'x-uid': currentUser.uid }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to remove schedule');
      
      setMessage('Schedule removed');
      await loadSchedules();
    } catch (e) {
      setError(e.message || 'Failed to remove schedule');
    }
  }

  function getSchedulesForDate(date) {
    return schedules.filter(s => s.date === date);
  }

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todaySchedules = getSchedulesForDate(today);
    const activeDays = new Set(schedules.map(s => s.date)).size;
    
    return {
      total: schedules.length,
      today: todaySchedules.length,
      activeDays
    };
  }, [schedules]);

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">7-Day Schedule Management</h1>
          <button 
            onClick={() => navigate('/seller')} 
            className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"
          >
            Back to Dashboard
          </button>
        </div>

        {/* Email Verification Banner */}
        {needsEmailVerification && (
          <div className="mb-6">
            <EmailVerification />
          </div>
        )}

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 p-3 rounded">
            {message}
          </div>
        )}

        {/* Add New Schedule Form */}
        <div className={`bg-white rounded-xl shadow p-6 mb-6 ${
          needsEmailVerification ? 'opacity-60 pointer-events-none' : ''
        }`}>
          <h2 className="text-lg font-semibold mb-4">Add New Schedule</h2>
          <form onSubmit={addSchedule} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Select Date</label>
              <select 
                name="date" 
                value={form.date} 
                onChange={onChange}
                className="w-full p-3 border rounded-lg"
                disabled={needsEmailVerification}
              >
                <option value="">Choose a date</option>
                {weekDays.map(day => (
                  <option key={day.date} value={day.date}>
                    {day.isToday ? 'Today' : `${day.dayName}`} - {day.monthName} {day.dayNumber}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm text-gray-700 mb-1">Start Time</label>
              <input 
                type="time" 
                name="startTime" 
                value={form.startTime} 
                onChange={onChange}
                className="w-full p-3 border rounded-lg"
                disabled={needsEmailVerification}
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-700 mb-1">End Time</label>
              <input 
                type="time" 
                name="endTime" 
                value={form.endTime} 
                onChange={onChange}
                className="w-full p-3 border rounded-lg"
                disabled={needsEmailVerification}
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-700 mb-1">Note (optional)</label>
              <input 
                type="text" 
                name="note" 
                value={form.note} 
                onChange={onChange}
                placeholder="e.g., Busy hours"
                className="w-full p-3 border rounded-lg"
                disabled={needsEmailVerification}
              />
            </div>
            
            <div className="md:col-span-2 lg:col-span-4 flex justify-end">
              <button 
                type="submit"
                disabled={needsEmailVerification}
                className={`px-6 py-2 rounded-lg ${
                  needsEmailVerification 
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed' 
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
                title={needsEmailVerification ? 'Please verify your email to add schedules' : ''}
              >
                Add Schedule
              </button>
            </div>
          </form>
          {needsEmailVerification && (
            <div className="text-xs text-gray-500 mt-2">
              Please verify your email to manage schedules.
            </div>
          )}
        </div>

        {/* 7-Day Schedule Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4 mb-6">
          {weekDays.map(day => {
            const daySchedules = getSchedulesForDate(day.date);
            return (
              <div key={day.date} className="bg-white rounded-lg shadow p-4">
                <div className="text-center mb-3">
                  <div className={`text-xs font-medium ${
                    day.isToday ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    {day.isToday ? 'TODAY' : day.dayName}
                  </div>
                  <div className={`text-2xl font-bold ${
                    day.isToday ? 'text-green-600' : 'text-gray-900'
                  }`}>
                    {day.dayNumber}
                  </div>
                  <div className="text-xs text-gray-500">{day.monthName}</div>
                  {day.isToday && (
                    <div className="text-xs text-green-600 font-medium mt-1">Current Day</div>
                  )}
                </div>

                <div className="space-y-2">
                  {daySchedules.length === 0 ? (
                    <div className="text-center py-4">
                      <div className="text-sm text-gray-500 mb-2">No schedules</div>
                      <button 
                        onClick={() => setForm(prev => ({ ...prev, date: day.date }))}
                        disabled={needsEmailVerification}
                        className={`text-xs px-3 py-1 rounded border ${
                          needsEmailVerification 
                            ? 'text-gray-400 border-gray-300 cursor-not-allowed' 
                            : 'text-green-600 border-green-300 hover:bg-green-50'
                        }`}
                      >
                        + Add Schedule
                      </button>
                    </div>
                  ) : (
                    daySchedules.map(schedule => (
                      <div key={schedule._id} className="border rounded p-2 text-xs">
                        <div className="font-medium">
                          {schedule.startTime} - {schedule.endTime}
                        </div>
                        {schedule.note && (
                          <div className="text-gray-500 mt-1">{schedule.note}</div>
                        )}
                        <button 
                          onClick={() => removeSchedule(schedule._id)}
                          disabled={needsEmailVerification}
                          className={`mt-1 text-xs ${
                            needsEmailVerification 
                              ? 'text-gray-400 cursor-not-allowed' 
                              : 'text-red-600 hover:text-red-800'
                          }`}
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Schedule Summary */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Schedule Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-sm text-gray-500">Total Schedules</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{stats.today}</div>
              <div className="text-sm text-gray-500">Today's Schedules</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">{stats.activeDays}</div>
              <div className="text-sm text-gray-500">Active Days</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-500 mt-8">
          © 2025 FreshCart. All rights reserved.
        </div>
      </div>
    </div>
  );
}
