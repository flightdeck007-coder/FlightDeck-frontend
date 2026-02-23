'use client';

import { Target, Users, TrendingUp, CheckCircle2 } from 'lucide-react';

export function About() {
  const features = [
    {
      icon: Target,
      title: 'Waypoints',
      description: '90-day priorities with milestone tracking and progress visualization',
    },
    {
      icon: TrendingUp,
      title: 'KPI Dashboard',
      description: 'Real-time metrics across revenue, operations, and team performance',
    },
    {
      icon: Users,
      title: 'Weekly Flight Reviews',
      description: 'Structured L10 meetings with agendas and accountability tracking',
    },
    {
      icon: CheckCircle2,
      title: 'Crew Management',
      description: 'Organizational chart with roles, responsibilities, and hierarchy',
    },
  ];

  return (
    <section id="about" className="py-20 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            Your Complete Operations Command Center
          </h2>
          <p className="text-xl text-foreground/70 max-w-3xl mx-auto">
            Everything you need to run your business at altitude, with the clarity of a glass cockpit.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-colors"
            >
              <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-foreground/70">{feature.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 bg-card border border-border rounded-lg p-8">
          <h3 className="text-2xl font-semibold text-foreground mb-4">
            What is a Weekly Flight Review?
          </h3>
          <p className="text-foreground/80 leading-relaxed mb-4">
            Weekly Flight Reviews are structured sessions designed to help crews operate at peak
            performance. Based on the Entrepreneurial Operating System (EOS) and Level 10 Meeting™
            format, these reviews follow a consistent agenda that keeps everyone aligned, accountable,
            and focused on waypoints (goals), clearances (to-dos), and resolving turbulence (issues).
          </p>
          <p className="text-foreground/80 leading-relaxed">
            FlightDeck brings this methodology to your fleet with digital tools that streamline
            flight reviews, track progress on the Instrument Panel, and maintain clarity across
            all levels of your organization.
          </p>
        </div>
      </div>
    </section>
  );
}
