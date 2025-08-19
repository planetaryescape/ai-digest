"use client";

import { Clock } from "lucide-react";

const activities = [
  {
    id: 1,
    type: "digest",
    message: "Weekly digest generated successfully",
    time: "2 hours ago",
  },
  {
    id: 2,
    type: "sender",
    message: "New sender added: newsletter@openai.com",
    time: "5 hours ago",
  },
  {
    id: 3,
    type: "sender",
    message: "Sender confidence updated: updates@anthropic.com",
    time: "1 day ago",
  },
  {
    id: 4,
    type: "digest",
    message: "Cleanup digest completed (150 emails processed)",
    time: "3 days ago",
  },
  {
    id: 5,
    type: "sender",
    message: "Removed sender: spam@example.com",
    time: "1 week ago",
  },
];

export function RecentActivity() {
  return (
    <div className="px-6 py-4">
      <ul className="space-y-4">
        {activities.map((activity) => (
          <li key={activity.id} className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <Clock className="h-5 w-5 text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900">{activity.message}</p>
              <p className="text-xs text-gray-500">{activity.time}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
