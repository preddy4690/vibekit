"use client";

import { useState, useEffect, useMemo } from "react";
import { Check, ChevronDown, Search, Split, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { GitHubBranch } from "@/lib/github";

interface BranchSelectorProps {
  repository: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function BranchSelector({
  repository,
  value,
  onValueChange,
  placeholder = "Select branch...",
  disabled = false,
}: BranchSelectorProps) {
  const [open, setOpen] = useState(false);
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch branches when repository changes
  useEffect(() => {
    if (!repository) {
      setBranches([]);
      return;
    }

    const fetchBranches = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [owner, repo] = repository.split("/");
        if (!owner || !repo) {
          throw new Error('Repository must be in format "owner/repo"');
        }

        // Fetch first page with higher limit
        const response = await fetch(
          `/api/auth/github/branches?owner=${encodeURIComponent(
            owner
          )}&repo=${encodeURIComponent(repo)}&per_page=100`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch branches");
        }

        const data = await response.json();
        setBranches(data.branches || []);

        // If we have pagination and no branches found yet, try to fetch more
        if (data.pagination?.hasNextPage && data.branches.length === 100) {
          // Fetch additional pages to get more branches
          const additionalBranches = await fetchAdditionalBranches(owner, repo, 2);
          setBranches(prev => [...prev, ...additionalBranches]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch branches");
        setBranches([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBranches();
  }, [repository]);

  // Function to fetch additional pages of branches
  const fetchAdditionalBranches = async (
    owner: string,
    repo: string,
    startPage: number
  ): Promise<GitHubBranch[]> => {
    const allBranches: GitHubBranch[] = [];
    let page = startPage;
    let hasMore = true;

    // Fetch up to 5 additional pages (500 more branches)
    while (hasMore && page <= 6) {
      try {
        const response = await fetch(
          `/api/auth/github/branches?owner=${encodeURIComponent(
            owner
          )}&repo=${encodeURIComponent(repo)}&per_page=100&page=${page}`
        );

        if (!response.ok) break;

        const data = await response.json();
        if (data.branches && data.branches.length > 0) {
          allBranches.push(...data.branches);
          hasMore = data.pagination?.hasNextPage || false;
          page++;
        } else {
          hasMore = false;
        }
      } catch {
        hasMore = false;
      }
    }

    return allBranches;
  };

  // Filter branches based on search query
  const filteredBranches = useMemo(() => {
    if (!searchQuery) return branches;
    return branches.filter(branch =>
      branch.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [branches, searchQuery]);

  // Sort branches: default first, then alphabetically
  const sortedBranches = useMemo(() => {
    return [...filteredBranches].sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [filteredBranches]);

  const selectedBranch = branches.find(branch => branch.name === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="justify-between"
          disabled={disabled || isLoading}
        >
          <div className="flex items-center gap-2">
            <Split className="h-4 w-4" />
            {selectedBranch ? (
              <span className="flex items-center gap-2">
                {selectedBranch.name}
                {selectedBranch.isDefault && (
                  <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                    default
                  </span>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          {isLoading ? (
            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
          ) : (
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              placeholder="Search branches..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 border-0 focus:ring-0"
            />
          </div>
          <div className="max-h-[300px] overflow-y-auto overflow-x-hidden">
            {error ? (
              <div className="p-4 text-sm text-red-600">
                {error}
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm text-muted-foreground">Loading branches...</span>
              </div>
            ) : sortedBranches.length === 0 ? (
              <div className="py-6 text-center text-sm">
                {searchQuery ? "No branches found matching your search." : "No branches found."}
              </div>
            ) : (
              <>
                <div className="overflow-hidden p-1 text-foreground">
                  {sortedBranches.map((branch) => (
                    <div
                      key={branch.name}
                      onClick={() => {
                        onValueChange(branch.name);
                        setOpen(false);
                      }}
                      className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${
                          value === branch.name ? "opacity-100" : "opacity-0"
                        }`}
                      />
                      <div className="flex items-center justify-between w-full">
                        <span>{branch.name}</span>
                        {branch.isDefault && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded ml-2">
                            default
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {branches.length >= 100 && (
                  <div className="p-2 text-xs text-muted-foreground border-t">
                    Showing {branches.length} branches. Use search to find specific branches.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
