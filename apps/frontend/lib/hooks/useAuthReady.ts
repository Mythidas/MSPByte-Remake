"use client";

import { useAuth, useAccessToken } from "@workos-inc/authkit-nextjs/components";

/**
 * Hook to check if authentication is ready and stable
 * Use this to conditionally skip queries that require authentication
 *
 * @returns {object} Auth state
 * @returns {boolean} isLoading - True if auth is still initializing
 * @returns {boolean} isReady - True if auth is fully loaded and ready (user may or may not be authenticated)
 * @returns {boolean} isAuthenticated - True if user is authenticated with valid token
 */
export function useAuthReady() {
  const { user, loading: userLoading } = useAuth();
  const {
    accessToken,
    loading: tokenLoading,
    error: tokenError,
  } = useAccessToken();

  // Auth is loading if either user or token is loading
  const isLoading = (userLoading ?? false) || (tokenLoading ?? false);

  // Auth is ready when loading is complete (regardless of whether user is authenticated)
  const isReady = !isLoading;

  // User is authenticated if they have both user and valid access token
  const isAuthenticated = !!user && !!accessToken && !tokenError && isReady;

  return {
    isLoading,
    isReady,
    isAuthenticated,
    user,
    accessToken,
    error: tokenError,
  };
}
