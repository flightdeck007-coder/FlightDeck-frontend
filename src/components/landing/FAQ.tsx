'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: 'What is FlightDeck?',
      answer:
        'FlightDeck is a comprehensive operations platform designed for Level 10 Meetings™. It helps teams run structured weekly meetings, track KPIs, manage priorities (Rocks), handle issues, and maintain accountability across your organization.',
    },
    {
      question: 'How do Level 10 Meetings work?',
      answer:
        'Level 10 Meetings follow a structured agenda with timed sections: Segue (5 min), Scorecard/Data (5 min), Rock Review (10 min), To-Do List (10 min), Issues/IDS™ (20 min), and Conclude (5 min). This consistent format keeps meetings focused and productive.',
    },
    {
      question: 'Can I invite team members?',
      answer:
        'Yes! When you create an organization, you receive a unique invite code. Share this code with team members during signup, and they will automatically join your organization. Organization admins can also manage member roles and permissions.',
    },
    {
      question: 'Is there a free trial?',
      answer:
        'Yes, FlightDeck offers a free trial so you can experience the full platform. Sign up to get started and explore all features without any commitment.',
    },
    {
      question: 'How secure is my data?',
      answer:
        'FlightDeck uses multi-tenant architecture with strict data isolation. Each organization\'s data is completely separate, and role-based access control ensures team members only see what they should.',
    },
  ];

  return (
    <section id="faq" className="py-20 bg-accent/30">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-foreground mb-4">Frequently Asked Questions</h2>
          <p className="text-xl text-foreground/70">
            Everything you need to know about FlightDeck
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-card border border-border rounded-lg overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-accent transition-colors"
              >
                <span className="font-semibold text-foreground">{faq.question}</span>
                <ChevronDown
                  className={`w-5 h-5 text-foreground/70 transition-transform ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {openIndex === index && (
                <div className="px-6 py-4 border-t border-border">
                  <p className="text-foreground/80 leading-relaxed">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
