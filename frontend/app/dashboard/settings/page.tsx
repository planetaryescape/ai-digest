"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Check, ChevronDown, Code, Info, Save, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DigestPrompt {
  promptId: string;
  name: string;
  description?: string;
  template: string;
  variables: string[];
  category: "analysis" | "criticism" | "research" | "summary";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
}

const categoryColors = {
  analysis: "bg-blue-100 text-blue-800",
  criticism: "bg-red-100 text-red-800",
  research: "bg-green-100 text-green-800",
  summary: "bg-purple-100 text-purple-800",
};

export default function SettingsPage() {
  const [selectedPrompt, setSelectedPrompt] = useState<DigestPrompt | null>(null);
  const [editedTemplate, setEditedTemplate] = useState("");
  const [showVariables, setShowVariables] = useState(true);
  const queryClient = useQueryClient();

  const {
    data: promptsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["prompts"],
    queryFn: async () => {
      const res = await fetch("/api/prompts");
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to fetch prompts");
      }
      const data = await res.json();
      return data;
    },
  });

  const prompts: DigestPrompt[] = promptsData?._demoMode
    ? promptsData.prompts
    : Array.isArray(promptsData)
      ? promptsData
      : promptsData?.prompts || [];
  const isDemoMode = promptsData?._demoMode || false;

  const savePromptMutation = useMutation({
    mutationFn: async (prompt: DigestPrompt) => {
      const res = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prompt),
      });
      if (!res.ok) throw new Error("Failed to save prompt");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Prompt saved successfully!");
      queryClient.invalidateQueries({ queryKey: ["prompts"] });
    },
    onError: () => {
      toast.error("Failed to save prompt");
    },
  });

  const handleSelectPrompt = (prompt: DigestPrompt) => {
    setSelectedPrompt(prompt);
    setEditedTemplate(prompt.template);
  };

  const handleSave = () => {
    if (!selectedPrompt) return;

    if (isDemoMode) {
      toast.info(
        "Demo Mode: Changes won't be persisted. Configure AWS credentials to save prompts."
      );
      return;
    }

    const updatedPrompt = {
      ...selectedPrompt,
      template: editedTemplate,
      variables: extractVariables(editedTemplate),
    };

    savePromptMutation.mutate(updatedPrompt);
  };

  const extractVariables = (template: string): string[] => {
    const regex = /\{\{\s*(\w+)\s*\}\}/g;
    const variables = new Set<string>();
    let match = regex.exec(template);

    while (match !== null) {
      variables.add(match[1]);
      match = regex.exec(template);
    }

    return Array.from(variables);
  };

  const renderTemplateWithHighlight = (template: string) => {
    return template.split(/(\{\{[^}]+\}\})/g).map((part, index) => {
      if (part.match(/\{\{[^}]+\}\}/)) {
        return (
          <span
            key={index}
            className="bg-yellow-200 text-yellow-900 px-1 rounded font-mono text-sm"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 font-medium">Failed to load prompts</p>
          <p className="text-gray-500 text-sm mt-2">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
        <p className="mt-1 text-sm text-gray-600">Manage AI digest prompts and configuration</p>
      </div>

      {/* Prompts Section */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              <h3 className="text-lg font-medium">AI Digest Prompts</h3>
            </div>
            <div className="flex items-center space-x-3">
              <div className="text-sm text-gray-500">{prompts?.length || 0} prompts configured</div>
              {isDemoMode && (
                <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                  Demo Mode - Configure AWS credentials to save changes
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 divide-x">
          {/* Prompt List */}
          <div className="col-span-1 p-4">
            <div className="space-y-2">
              {!prompts || prompts.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No prompts available</p>
                  <p className="text-sm text-gray-400 mt-2">Prompts will be loaded from the API</p>
                </div>
              ) : (
                prompts.map((prompt) => (
                  <button
                    key={prompt.promptId}
                    onClick={() => handleSelectPrompt(prompt)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg border transition-colors",
                      selectedPrompt?.promptId === prompt.promptId
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:bg-gray-50"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{prompt.name}</div>
                        {prompt.description && (
                          <div className="text-sm text-gray-500 mt-1">{prompt.description}</div>
                        )}
                      </div>
                      <span
                        className={cn(
                          "px-2 py-1 text-xs font-medium rounded-full",
                          categoryColors[prompt.category]
                        )}
                      >
                        {prompt.category}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 mt-2">
                      {prompt.isActive ? (
                        <div className="flex items-center text-green-600">
                          <Check className="h-3 w-3 mr-1" />
                          <span className="text-xs">Active</span>
                        </div>
                      ) : (
                        <div className="flex items-center text-gray-400">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          <span className="text-xs">Inactive</span>
                        </div>
                      )}
                      <span className="text-xs text-gray-400">v{prompt.version}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Prompt Editor */}
          <div className="col-span-2 p-6">
            {selectedPrompt ? (
              <div className="space-y-6">
                {/* Header */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900">{selectedPrompt.name}</h4>
                  {selectedPrompt.description && (
                    <p className="text-sm text-gray-500 mt-1">{selectedPrompt.description}</p>
                  )}
                </div>

                {/* Variables Info */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <button
                    onClick={() => setShowVariables(!showVariables)}
                    className="flex items-center justify-between w-full text-left"
                  >
                    <div className="flex items-center space-x-2">
                      <Info className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">Template Variables</span>
                    </div>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-blue-600 transition-transform",
                        showVariables && "rotate-180"
                      )}
                    />
                  </button>

                  {showVariables && (
                    <div className="mt-3 space-y-2">
                      <p className="text-sm text-blue-800">
                        Use double curly braces to define variables that will be replaced at
                        runtime:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {extractVariables(editedTemplate).map((variable) => (
                          <code
                            key={variable}
                            className="px-2 py-1 bg-white text-blue-700 rounded text-xs font-mono"
                          >
                            {`{{${variable}}}`}
                          </code>
                        ))}
                      </div>
                      {extractVariables(editedTemplate).length === 0 && (
                        <p className="text-sm text-blue-600 italic">No variables defined yet</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Template Editor */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prompt Template
                  </label>
                  <div className="relative">
                    <textarea
                      value={editedTemplate}
                      onChange={(e) => setEditedTemplate(e.target.value)}
                      className="w-full h-64 p-4 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter your prompt template here..."
                    />
                    <div className="absolute top-2 right-2">
                      <Code className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {editedTemplate.length} characters • {extractVariables(editedTemplate).length}{" "}
                    variables
                  </p>
                </div>

                {/* Preview */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Preview</label>
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono">
                      {renderTemplateWithHighlight(editedTemplate)}
                    </pre>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    Last updated: {new Date(selectedPrompt.updatedAt).toLocaleDateString()}
                  </div>
                  <button
                    onClick={handleSave}
                    disabled={
                      savePromptMutation.isPending || editedTemplate === selectedPrompt.template
                    }
                    className={cn(
                      "flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg",
                      "hover:bg-blue-700 transition-colors",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {savePromptMutation.isPending ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <Sparkles className="h-12 w-12 mb-4" />
                <p className="text-lg font-medium">Select a prompt to edit</p>
                <p className="text-sm mt-1">Choose from the list on the left</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Configuration Section (placeholder for future settings) */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-medium">Configuration</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Target Role</label>
              <input
                type="text"
                placeholder="e.g., Product Manager, Developer"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                disabled
              />
              <p className="text-xs text-gray-500 mt-1">
                Coming soon: Customize digest for specific roles
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Target Industry</label>
              <input
                type="text"
                placeholder="e.g., FinTech, Healthcare"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                disabled
              />
              <p className="text-xs text-gray-500 mt-1">Coming soon: Industry-specific insights</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
