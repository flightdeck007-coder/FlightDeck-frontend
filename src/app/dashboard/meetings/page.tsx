'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/lib/constants/routes';
import { meetingsService, Meeting } from '@/lib/api/meetings.service';
import { Calendar, Users, Clock } from 'lucide-react';

export default function MeetingsPage() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // For now, use a demo organizationId - in real app, get from user context
  const organizationId = 'demo-org-id';

  useEffect(() => {
    loadMeetings();
  }, []);

  const loadMeetings = async () => {
    try {
      setIsLoading(true);
      // For demo, we'll use sample data if API fails
      try {
        const data = await meetingsService.findAll(organizationId);
        setMeetings(data);
      } catch (error) {
        // Use demo meetings if API not ready
        setMeetings([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartMeeting = () => {
    // For now, navigate to a sample meeting
    // In real app, create meeting first then navigate
    router.push(ROUTES.MEETING('sample-123'));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground">Meetings</h1>
          <button
            onClick={handleStartMeeting}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <Calendar className="w-4 h-4" />
            Start a Meeting
          </button>
        </div>

        {isLoading ? (
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-foreground/70 text-center">Loading meetings...</p>
          </div>
        ) : meetings.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-foreground/70 text-center py-8">
              No meetings yet. Click "Start a Meeting" to begin an L10-style meeting.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {meetings.map((meeting) => (
              <div
                key={meeting.id}
                className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => router.push(ROUTES.MEETING(meeting.id))}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {meeting.series.name} - {meeting.team.name}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-foreground/70">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(meeting.scheduledAt)}</span>
                      </div>
                      {meeting.startedAt && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>Started: {formatDate(meeting.startedAt)}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>{meeting.attendances.length} attendees</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    {meeting.endedAt ? (
                      <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md text-sm">
                        Completed
                      </span>
                    ) : meeting.startedAt ? (
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-md text-sm">
                        In Progress
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md text-sm">
                        Scheduled
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
