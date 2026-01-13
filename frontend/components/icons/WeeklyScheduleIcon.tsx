import type React from "react";

interface IconProps {
  className?: string;
  size?: number;
}

export const WeeklyScheduleIcon: React.FC<IconProps> = ({ className = "", size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <path d="M7 14h.01" />
    <path d="M12 14h.01" />
    <path d="M17 14h.01" />
    <path d="M7 18h.01" />
    <path d="M12 18h.01" />
    <circle cx="17" cy="18" r="2" />
    <path d="M17 16.5v1.5l1 1" />
  </svg>
);
