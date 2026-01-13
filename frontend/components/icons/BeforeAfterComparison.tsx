export const BeforeAfterComparison = ({ className = "" }: { className?: string }) => {
  return (
    <svg
      className={className}
      viewBox="0 0 1200 600"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="1200" height="600" fill="#F9FAFB" />

      {/* Left Side - Before: Cluttered Inbox */}
      <g id="before-side">
        <rect x="0" y="0" width="600" height="600" fill="#ffffff" />

        {/* Gmail-like header */}
        <rect x="0" y="0" width="600" height="60" fill="#F3F4F6" />
        <text x="30" y="38" fontSize="20" fontWeight="600" fill="#111827">
          Inbox (127 unread)
        </text>

        {/* Overwhelming email list */}
        <g id="email-list">
          {/* Email 1 - Unread */}
          <rect
            x="20"
            y="80"
            width="560"
            height="65"
            fill="#FEF3C7"
            stroke="#FCD34D"
            strokeWidth="1"
          />
          <circle cx="40" cy="112" r="4" fill="#F59E0B" />
          <text x="60" y="100" fontSize="13" fontWeight="600" fill="#1F2937">
            🤖 The AI Revolution Weekly
          </text>
          <text x="60" y="118" fontSize="12" fill="#6B7280">
            GPT-5 rumors, new startups, funding rounds...
          </text>
          <text x="520" y="100" fontSize="11" fill="#9CA3AF">
            2 hours ago
          </text>

          {/* Email 2 - Unread */}
          <rect
            x="20"
            y="150"
            width="560"
            height="65"
            fill="#FEF3C7"
            stroke="#FCD34D"
            strokeWidth="1"
          />
          <circle cx="40" cy="182" r="4" fill="#F59E0B" />
          <text x="60" y="170" fontSize="13" fontWeight="600" fill="#1F2937">
            💡 TLDR AI
          </text>
          <text x="60" y="188" fontSize="12" fill="#6B7280">
            Today&apos;s AI news, tools, research papers...
          </text>
          <text x="520" y="170" fontSize="11" fill="#9CA3AF">
            3 hours ago
          </text>

          {/* Email 3 - Unread */}
          <rect
            x="20"
            y="220"
            width="560"
            height="65"
            fill="#FEF3C7"
            stroke="#FCD34D"
            strokeWidth="1"
          />
          <circle cx="40" cy="252" r="4" fill="#F59E0B" />
          <text x="60" y="240" fontSize="13" fontWeight="600" fill="#1F2937">
            🧠 The Neuron
          </text>
          <text x="60" y="258" fontSize="12" fill="#6B7280">
            AI tools you need to know about...
          </text>
          <text x="520" y="240" fontSize="11" fill="#9CA3AF">
            5 hours ago
          </text>

          {/* Email 4 */}
          <rect
            x="20"
            y="290"
            width="560"
            height="65"
            fill="#ffffff"
            stroke="#E5E7EB"
            strokeWidth="1"
          />
          <text x="60" y="310" fontSize="13" fill="#6B7280">
            🚀 AI Founders Newsletter
          </text>
          <text x="60" y="328" fontSize="12" fill="#9CA3AF">
            Building AI products that users love...
          </text>
          <text x="520" y="310" fontSize="11" fill="#9CA3AF">
            Yesterday
          </text>

          {/* Email 5 */}
          <rect
            x="20"
            y="360"
            width="560"
            height="65"
            fill="#ffffff"
            stroke="#E5E7EB"
            strokeWidth="1"
          />
          <text x="60" y="380" fontSize="13" fill="#6B7280">
            📊 Data Science Weekly
          </text>
          <text x="60" y="398" fontSize="12" fill="#9CA3AF">
            Latest ML models and techniques...
          </text>
          <text x="520" y="380" fontSize="11" fill="#9CA3AF">
            2 days ago
          </text>

          {/* Email 6 - Partially visible */}
          <rect
            x="20"
            y="430"
            width="560"
            height="65"
            fill="#ffffff"
            stroke="#E5E7EB"
            strokeWidth="1"
          />
          <text x="60" y="450" fontSize="13" fill="#6B7280">
            🎯 Product Hunt AI
          </text>
          <text x="60" y="468" fontSize="12" fill="#9CA3AF">
            Top AI launches this week...
          </text>
          <text x="520" y="450" fontSize="11" fill="#9CA3AF">
            2 days ago
          </text>

          {/* More emails indicator */}
          <rect
            x="20"
            y="500"
            width="560"
            height="65"
            fill="#ffffff"
            stroke="#E5E7EB"
            strokeWidth="1"
          />
          <text x="60" y="520" fontSize="13" fill="#6B7280">
            📰 MIT Technology Review
          </text>
          <text x="60" y="538" fontSize="12" fill="#9CA3AF">
            The future of artificial intelligence...
          </text>
          <text x="520" y="520" fontSize="11" fill="#9CA3AF">
            3 days ago
          </text>
        </g>

        {/* Stress indicators */}
        <text x="30" y="590" fontSize="14" fontWeight="500" fill="#EF4444">
          😰 Newsletter anxiety
        </text>
        <text x="200" y="590" fontSize="14" fontWeight="500" fill="#EF4444">
          ⏰ 3+ hours/week
        </text>
        <text x="380" y="590" fontSize="14" fontWeight="500" fill="#EF4444">
          💔 FOMO
        </text>
      </g>

      {/* Center divider with transformation arrow */}
      <g id="transformation">
        <line x1="600" y1="0" x2="600" y2="600" stroke="#E5E7EB" strokeWidth="2" />

        {/* Arrow background circle */}
        <circle cx="600" cy="300" r="35" fill="#ffffff" stroke="#E5E7EB" strokeWidth="2" />

        {/* Arrow */}
        <path
          d="M 580 300 L 620 300 M 610 290 L 620 300 L 610 310"
          stroke="#3B82F6"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* AI Digest label */}
        <rect x="550" y="350" width="100" height="30" rx="15" fill="#3B82F6" />
        <text x="600" y="370" fontSize="12" fontWeight="600" fill="white" textAnchor="middle">
          AI DIGEST
        </text>
      </g>

      {/* Right Side - After: Clean Digest */}
      <g id="after-side">
        <rect x="600" y="0" width="600" height="600" fill="#ffffff" />

        {/* Email header */}
        <rect x="600" y="0" width="600" height="60" fill="#F3F4F6" />
        <text x="630" y="38" fontSize="20" fontWeight="600" fill="#111827">
          Your Weekly AI Digest
        </text>
        <text x="1070" y="38" fontSize="14" fill="#6B7280">
          Sunday 8:00 AM
        </text>

        {/* Beautiful digest email */}
        <rect
          x="650"
          y="90"
          width="500"
          height="460"
          fill="#ffffff"
          stroke="#E5E7EB"
          strokeWidth="1"
          rx="8"
        />

        {/* Digest header */}
        <rect x="650" y="90" width="500" height="80" fill="url(#gradient)" rx="8" />
        <text x="900" y="125" fontSize="24" fontWeight="700" fill="white" textAnchor="middle">
          AI Digest
        </text>
        <text x="900" y="150" fontSize="14" fill="white" textAnchor="middle">
          Your personalized weekly AI insights
        </text>

        {/* Executive Summary */}
        <text x="680" y="200" fontSize="16" fontWeight="600" fill="#1F2937">
          📊 Executive Summary
        </text>
        <rect x="680" y="210" width="440" height="3" fill="#E5E7EB" rx="1.5" />
        <text x="680" y="230" fontSize="12" fill="#4B5563">
          This week saw major advances in multimodal AI with Google&apos;s
        </text>
        <text x="680" y="246" fontSize="12" fill="#4B5563">
          Gemini 2.0 and OpenAI&apos;s new reasoning models...
        </text>

        {/* Key Insights */}
        <text x="680" y="280" fontSize="16" fontWeight="600" fill="#1F2937">
          💡 Key Insights for You
        </text>
        <rect x="680" y="290" width="440" height="3" fill="#E5E7EB" rx="1.5" />

        {/* Insight pills */}
        <rect x="680" y="305" width="120" height="28" rx="14" fill="#DBEAFE" />
        <text x="740" y="323" fontSize="11" fontWeight="500" fill="#1E40AF" textAnchor="middle">
          New AI APIs
        </text>

        <rect x="810" y="305" width="140" height="28" rx="14" fill="#FEE2E2" />
        <text x="880" y="323" fontSize="11" fontWeight="500" fill="#991B1B" textAnchor="middle">
          Cost optimization tips
        </text>

        <rect x="960" y="305" width="100" height="28" rx="14" fill="#D1FAE5" />
        <text x="1010" y="323" fontSize="11" fontWeight="500" fill="#065F46" textAnchor="middle">
          3 tool ideas
        </text>

        {/* Product Opportunities */}
        <text x="680" y="365" fontSize="16" fontWeight="600" fill="#1F2937">
          🚀 Product Opportunities
        </text>
        <rect x="680" y="375" width="440" height="3" fill="#E5E7EB" rx="1.5" />

        <g>
          <circle cx="690" cy="395" r="3" fill="#10B981" />
          <text x="705" y="400" fontSize="12" fill="#4B5563">
            AI writing assistant for technical documentation
          </text>
        </g>

        <g>
          <circle cx="690" cy="420" r="3" fill="#10B981" />
          <text x="705" y="425" fontSize="12" fill="#4B5563">
            Voice-to-code IDE plugin using Whisper API
          </text>
        </g>

        <g>
          <circle cx="690" cy="445" r="3" fill="#10B981" />
          <text x="705" y="450" fontSize="12" fill="#4B5563">
            Automated PR review bot with GPT-4
          </text>
        </g>

        {/* Read full digest button */}
        <rect x="750" y="480" width="300" height="40" rx="6" fill="#3B82F6" />
        <text x="900" y="504" fontSize="14" fontWeight="600" fill="white" textAnchor="middle">
          Read Full Digest →
        </text>

        {/* Benefits */}
        <text x="630" y="590" fontSize="14" fontWeight="500" fill="#10B981">
          ✅ Clarity achieved
        </text>
        <text x="780" y="590" fontSize="14" fontWeight="500" fill="#10B981">
          ⚡ 10 min read
        </text>
        <text x="920" y="590" fontSize="14" fontWeight="500" fill="#10B981">
          🎯 Actionable
        </text>
      </g>

      {/* Time saved indicator */}
      <g id="time-saved">
        <rect x="480" y="20" width="240" height="40" rx="20" fill="#10B981" />
        <text x="600" y="45" fontSize="16" fontWeight="600" fill="white" textAnchor="middle">
          Save 3+ hours/week
        </text>
      </g>

      {/* Gradient definition */}
      <defs>
        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
    </svg>
  );
};
