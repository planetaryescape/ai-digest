import type React from "react";

interface IconProps {
  className?: string;
  size?: number;
}

export const CostControlIcon: React.FC<IconProps> = ({ className = "", size = 24 }) => (
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
    <path d="M12 2L3.5 7v6c0 4.5 3 8.5 8.5 11 5.5-2.5 8.5-6.5 8.5-11V7L12 2z" />
    <path d="M12 7v10" />
    <path d="M15 9.5a1.5 1.5 0 0 0-3 0c0 .75.5 1.25 1.5 1.5 1 .25 1.5.75 1.5 1.5a1.5 1.5 0 0 1-3 0" />
  </svg>
);
