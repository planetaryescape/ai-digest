import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    <div
      style={{
        fontSize: 128,
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px",
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: "32px",
          padding: "60px 80px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.1)",
          maxWidth: "1000px",
        }}
      >
        {/* Logo/Brand */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "40px",
          }}
        >
          <div
            style={{
              width: "60px",
              height: "60px",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              borderRadius: "12px",
              marginRight: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="9" y1="9" x2="15" y2="9"></line>
              <line x1="9" y1="13" x2="15" y2="13"></line>
              <line x1="9" y1="17" x2="11" y2="17"></line>
            </svg>
          </div>
          <span
            style={{
              fontSize: "48px",
              fontWeight: "bold",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            AI Digest
          </span>
        </div>

        {/* Main Message */}
        <div
          style={{
            fontSize: "56px",
            fontWeight: "bold",
            textAlign: "center",
            color: "#1a202c",
            lineHeight: 1.2,
            marginBottom: "30px",
          }}
        >
          Turn 50+ AI Newsletters Into
          <br />
          <span
            style={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            One Weekly Summary
          </span>
        </div>

        {/* Value Proposition */}
        <div
          style={{
            fontSize: "28px",
            color: "#4a5568",
            textAlign: "center",
            marginBottom: "40px",
          }}
        >
          Save 3+ hours every week with intelligent AI-powered summaries
        </div>

        {/* Visual Elements - Before/After */}
        <div
          style={{
            display: "flex",
            gap: "40px",
            alignItems: "center",
            marginTop: "20px",
          }}
        >
          {/* Before - Chaos */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: "200px",
                height: "140px",
                background: "#f7fafc",
                borderRadius: "12px",
                border: "2px solid #e2e8f0",
                display: "flex",
                flexDirection: "column",
                padding: "12px",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Multiple email lines to show chaos */}
              <div
                style={{
                  width: "100%",
                  height: "8px",
                  background: "#fc8181",
                  borderRadius: "4px",
                  marginBottom: "6px",
                }}
              />
              <div
                style={{
                  width: "90%",
                  height: "8px",
                  background: "#f6ad55",
                  borderRadius: "4px",
                  marginBottom: "6px",
                }}
              />
              <div
                style={{
                  width: "95%",
                  height: "8px",
                  background: "#fc8181",
                  borderRadius: "4px",
                  marginBottom: "6px",
                }}
              />
              <div
                style={{
                  width: "85%",
                  height: "8px",
                  background: "#f6ad55",
                  borderRadius: "4px",
                  marginBottom: "6px",
                }}
              />
              <div
                style={{
                  width: "92%",
                  height: "8px",
                  background: "#fc8181",
                  borderRadius: "4px",
                  marginBottom: "6px",
                }}
              />
              <div
                style={{
                  width: "88%",
                  height: "8px",
                  background: "#f6ad55",
                  borderRadius: "4px",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: "8px",
                  right: "8px",
                  background: "#fc8181",
                  color: "white",
                  borderRadius: "12px",
                  padding: "2px 8px",
                  fontSize: "14px",
                  fontWeight: "bold",
                }}
              >
                100+
              </div>
            </div>
            <span
              style={{
                fontSize: "20px",
                color: "#718096",
                marginTop: "12px",
              }}
            >
              Before
            </span>
          </div>

          {/* Arrow */}
          <svg width="60" height="24" viewBox="0 0 60 24" fill="none" style={{ opacity: 0.6 }}>
            <path
              d="M0 12H50M50 12L40 2M50 12L40 22"
              stroke="#667eea"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          {/* After - Clean */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: "200px",
                height: "140px",
                background: "linear-gradient(135deg, #667eea15 0%, #764ba215 100%)",
                borderRadius: "12px",
                border: "2px solid #667eea",
                display: "flex",
                flexDirection: "column",
                padding: "16px",
                gap: "8px",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "20px",
                  background: "#667eea",
                  borderRadius: "6px",
                }}
              />
              <div
                style={{
                  width: "100%",
                  height: "40px",
                  background: "#667eea25",
                  borderRadius: "6px",
                }}
              />
              <div
                style={{
                  width: "100%",
                  height: "40px",
                  background: "#667eea25",
                  borderRadius: "6px",
                }}
              />
            </div>
            <span
              style={{
                fontSize: "20px",
                color: "#718096",
                marginTop: "12px",
              }}
            >
              After
            </span>
          </div>
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
    }
  );
}
