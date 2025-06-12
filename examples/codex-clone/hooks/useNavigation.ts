"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

export function useNavigation() {
  const router = useRouter();

  const navigateBack = useCallback((fallbackPath: string = "/") => {
    try {
      // Always navigate to the fallback path (home page) instead of using browser history
      // This ensures users stay within the application
      console.log(`Navigating to fallback path: ${fallbackPath}`);
      router.push(fallbackPath);

    } catch (error) {
      console.error("Navigation error:", error);
      // Final fallback
      router.push(fallbackPath);
    }
  }, [router]);

  const navigateTo = useCallback((path: string) => {
    try {
      router.push(path);
    } catch (error) {
      console.error("Navigation error:", error);
      // Try with window.location as fallback
      if (typeof window !== "undefined") {
        window.location.href = path;
      }
    }
  }, [router]);

  return {
    navigateBack,
    navigateTo,
    router,
  };
}
