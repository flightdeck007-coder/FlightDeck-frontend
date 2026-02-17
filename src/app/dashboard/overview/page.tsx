'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, CheckCircle2, AlertCircle } from 'lucide-react';

// Demo data
const weeklyData = [
  { week: 'Week 1', todos: 12, issues: 5, rocks: 3 },
  { week: 'Week 2', todos: 15, issues: 7, rocks: 4 },
  { week: 'Week 3', todos: 18, issues: 4, rocks: 3 },
  { week: 'Week 4', todos: 14, issues: 6, rocks: 5 },
];

const scorecardData = [
  { name: 'Revenue', value: 125000, target: 100000 },
  { name: 'Customers', value: 240, target: 200 },
  { name: 'Satisfaction', value: 8.5, target: 8.0 },
];

const statusData = [
  { name: 'Completed', value: 45, color: '#10b981' },
  { name: 'In Progress', value: 30, color: '#f59e0b' },
  { name: 'Pending', value: 25, color: '#ef4444' },
];

export default function OverviewPage() {
  return (
    <DashboardLayout>
      <div className="p-8">
        <h1 className="text-2xl font-semibold text-foreground mb-6">Overview</h1>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground/70 mb-1">Total To-Dos</p>
                <p className="text-2xl font-bold text-foreground">45</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground/70 mb-1">Open Issues</p>
                <p className="text-2xl font-bold text-foreground">12</p>
              </div>
              <AlertCircle className="w-8 h-8 text-orange-500" />
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground/70 mb-1">Active Rocks</p>
                <p className="text-2xl font-bold text-foreground">8</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground/70 mb-1">Team Members</p>
                <p className="text-2xl font-bold text-foreground">24</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Weekly Activity */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Weekly Activity</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis dataKey="week" stroke="#666" />
                <YAxis stroke="#666" />
                <Tooltip />
                <Legend />
                <Bar dataKey="todos" fill="#C47F19" name="To-Dos" />
                <Bar dataKey="issues" fill="#f59e0b" name="Issues" />
                <Bar dataKey="rocks" fill="#10b981" name="Rocks" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Status Distribution */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Status Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Scorecard Trends */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Scorecard Trends</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={scorecardData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="name" stroke="#666" />
              <YAxis stroke="#666" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="value" stroke="#C47F19" name="Current" />
              <Line type="monotone" dataKey="target" stroke="#94a3b8" name="Target" strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </DashboardLayout>
  );
}
