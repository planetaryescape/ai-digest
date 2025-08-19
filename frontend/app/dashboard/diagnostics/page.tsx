"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle, RefreshCw, XCircle } from "lucide-react";

export default function DiagnosticsPage() {
  const {
    data: health,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await fetch("/api/health");
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Health check failed");
      }
      return res.json();
    },
    refetchInterval: 5000,
  });

  const { data: sendersTest } = useQuery({
    queryKey: ["senders-test"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/senders");
        const data = await res.json();
        return {
          status: res.ok ? "success" : "error",
          statusCode: res.status,
          data: res.ok ? data : null,
          error: !res.ok ? data : null,
        };
      } catch (err) {
        return {
          status: "error",
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
    },
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="space-y-4">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">System Diagnostics</h2>
          <p className="mt-1 text-sm text-gray-600">
            Check the health of your AI Digest system and troubleshoot issues
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <XCircle className="h-5 w-5 text-red-600 mr-2" />
            <div>
              <div className="font-semibold text-red-900">Health Check Failed</div>
              <div className="text-sm text-red-700">
                {error instanceof Error ? error.message : "Unknown error"}
              </div>
            </div>
          </div>
        </div>
      )}

      {health && (
        <>
          <div
            className={`rounded-lg p-6 ${
              health.status === "healthy"
                ? "bg-green-50 border border-green-200"
                : "bg-red-50 border border-red-200"
            }`}
          >
            <div className="flex items-center mb-4">
              {health.status === "healthy" ? (
                <>
                  <CheckCircle className="h-6 w-6 text-green-600 mr-2" />
                  <span className="text-lg font-semibold text-green-900">System Healthy</span>
                </>
              ) : (
                <>
                  <XCircle className="h-6 w-6 text-red-600 mr-2" />
                  <span className="text-lg font-semibold text-red-900">System Unhealthy</span>
                </>
              )}
            </div>
            <div className="text-sm text-gray-600">
              Last checked: {new Date(health.timestamp).toLocaleString()}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">Environment Variables</h3>
            </div>
            <div className="p-6 space-y-3">
              {Object.entries(health.checks.env).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">{key}</span>
                  <span className="flex items-center">
                    {typeof value === "boolean" ? (
                      value ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )
                    ) : (
                      <span
                        className={`text-sm ${value === "not set" ? "text-red-600" : "text-gray-900"}`}
                      >
                        {String(value)}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">DynamoDB Connection</h3>
            </div>
            <div className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Connection</span>
                {health.checks.dynamodb.connection ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Table Exists</span>
                {health.checks.dynamodb.tableExists ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
              </div>
              {health.checks.dynamodb.error && (
                <div className="mt-2 p-3 bg-red-50 rounded-lg">
                  <div className="text-sm text-red-700">{health.checks.dynamodb.error}</div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">Senders API Test</h3>
            </div>
            <div className="p-6">
              {sendersTest ? (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">API Status</span>
                    {sendersTest.status === "success" ? (
                      <div className="flex items-center">
                        <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                        <span className="text-sm text-green-600">
                          Working ({sendersTest.statusCode})
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <XCircle className="h-4 w-4 text-red-600 mr-2" />
                        <span className="text-sm text-red-600">
                          Failed {sendersTest.statusCode ? `(${sendersTest.statusCode})` : ""}
                        </span>
                      </div>
                    )}
                  </div>
                  {sendersTest.error && (
                    <div className="mt-2 p-3 bg-red-50 rounded-lg">
                      <div className="text-sm text-red-700 font-semibold">Error Details:</div>
                      <pre className="text-xs text-red-600 mt-1 overflow-x-auto">
                        {JSON.stringify(sendersTest.error, null, 2)}
                      </pre>
                    </div>
                  )}
                  {sendersTest.status === "success" && sendersTest.data && (
                    <div className="mt-2 text-sm text-gray-600">
                      Found {Array.isArray(sendersTest.data) ? sendersTest.data.length : 0} senders
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-500">Testing...</div>
              )}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-blue-600 mr-2 mt-0.5" />
              <div className="text-sm text-blue-900">
                <div className="font-semibold mb-1">Troubleshooting Tips:</div>
                <ul className="list-disc list-inside space-y-1">
                  <li>Ensure all AWS environment variables are set in your deployment</li>
                  <li>Verify the DynamoDB table name matches your AWS setup</li>
                  <li>Check that your AWS credentials have DynamoDB read/write permissions</li>
                  <li>Make sure the AWS region is correctly configured</li>
                  <li>For Vercel deployments, add environment variables in the Vercel dashboard</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
