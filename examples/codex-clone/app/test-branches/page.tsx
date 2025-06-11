"use client";

import { useState } from "react";
import { BranchSelector } from "@/components/branch-selector";

export default function TestBranchesPage() {
  const [selectedBranch, setSelectedBranch] = useState("");
  const [repository, setRepository] = useState("superagent-ai/vibekit"); // Default test repo

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Branch Selector Test</h1>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Repository (format: owner/repo)
          </label>
          <input
            type="text"
            value={repository}
            onChange={(e) => setRepository(e.target.value)}
            placeholder="owner/repo"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Selected Branch
          </label>
          <BranchSelector
            repository={repository}
            value={selectedBranch}
            onValueChange={setSelectedBranch}
            placeholder="Choose a branch..."
          />
        </div>

        {selectedBranch && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-md">
            <p className="text-green-800">
              <strong>Selected:</strong> {selectedBranch}
            </p>
          </div>
        )}

        <div className="text-sm text-gray-600">
          <p><strong>Instructions:</strong></p>
          <ul className="list-disc list-inside space-y-1">
            <li>Enter a repository in the format "owner/repo" (e.g., "facebook/react")</li>
            <li>Click the branch selector to see all available branches</li>
            <li>Use the search box to filter branches</li>
            <li>The default branch will be marked and sorted first</li>
            <li>Up to 600 branches will be loaded automatically</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
