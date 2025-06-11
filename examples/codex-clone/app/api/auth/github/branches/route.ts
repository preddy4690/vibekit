import { NextRequest, NextResponse } from "next/server";

interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

export async function GET(request: NextRequest) {
  try {
    // Get the access token from the httpOnly cookie
    const accessToken = request.cookies.get("github_access_token")?.value;

    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get repository from query parameters
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get("owner");
    const repo = searchParams.get("repo");

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "Owner and repo parameters are required" },
        { status: 400 }
      );
    }

    // First fetch repository info to get the default branch
    const repoResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    if (!repoResponse.ok) {
      if (repoResponse.status === 404) {
        return NextResponse.json(
          { error: "Repository not found" },
          { status: 404 }
        );
      }
      throw new Error(`Failed to fetch repository: ${repoResponse.statusText}`);
    }

    const repoData = await repoResponse.json();
    const defaultBranch = repoData.default_branch;

    // Get pagination and search parameters
    const page = parseInt(searchParams.get("page") || "1");
    const perPage = parseInt(searchParams.get("per_page") || "100"); // Increase default to 100
    const search = searchParams.get("search") || "";

    // Fetch branches from GitHub API with pagination
    const branchesUrl = new URL(`https://api.github.com/repos/${owner}/${repo}/branches`);
    branchesUrl.searchParams.set("page", page.toString());
    branchesUrl.searchParams.set("per_page", Math.min(perPage, 100).toString()); // GitHub max is 100

    const response = await fetch(branchesUrl.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: "Repository not found" },
          { status: 404 }
        );
      }
      throw new Error(`Failed to fetch branches: ${response.statusText}`);
    }

    const branches: GitHubBranch[] = await response.json();

    // Filter branches based on search query if provided
    let filteredBranches = branches;
    if (search) {
      filteredBranches = branches.filter(branch =>
        branch.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Get pagination info from response headers
    const linkHeader = response.headers.get('link');
    const hasNextPage = linkHeader?.includes('rel="next"') || false;
    const hasPrevPage = page > 1;

    return NextResponse.json({
      branches: filteredBranches.map((branch: GitHubBranch) => ({
        name: branch.name,
        commit: {
          sha: branch.commit.sha,
          url: branch.commit.url,
        },
        protected: branch.protected || false,
        isDefault: branch.name === defaultBranch,
      })),
      pagination: {
        page,
        perPage,
        hasNextPage,
        hasPrevPage,
        totalReturned: filteredBranches.length,
      },
    });
  } catch (error) {
    console.error("Error fetching branches:", error);
    return NextResponse.json(
      { error: "Failed to fetch branches" },
      { status: 500 }
    );
  }
}
