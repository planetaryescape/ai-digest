import React from "react";

interface IconProps {
  className?: string;
  size?: number;
}

export const BeautifulEmailIcon: React.FC<IconProps> = ({ className = "", size = 24 }) => (
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
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-10 5L2 7" />
    <path d="M8 9l2 2 4-4" />
    <path d="M16 15l2 2" />
    <path d="M14 17l2-2" />
  </svg>
);