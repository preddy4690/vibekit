"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

export function useNavigation() {
  const router = useRouter();

  const navigateBack = useCallback((fallbackPath: string = "/") => {
    try {
      // Check if we can go back in browser history
      if (typeof window !== "undefined") {
        // Check if there's a referrer and it's from the same origin
        const referrer = document.referrer;
        const currentOrigin = window.location.origin;
        
        if (referrer && referrer.startsWith(currentOrigin)) {
          // We came from within the app, safe to go back
          console.log("Navigating back using browser history");
          router.back();
          return;
        }
        
        // Check if history length suggests we can go back
        if (window.history.length > 1) {
          console.log("Navigating back using router.back()");
          router.back();
          return;
        }
      }
      
      // Fallback to specified path
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
