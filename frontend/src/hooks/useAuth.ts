/**
 * useAuth hook — provides current authenticated user state.
 *
 * Fetches from GET /api/auth/me/ and exposes:
 * - user: User | null
 * - loading: boolean (true while fetching)
 * - refetch: () => Promise<void>
 *
 * Note: is_approved is included in the User type so the router can
 * redirect unapproved users to /pending-approval (Pitfall 8 prevention).
 */
import { useState, useEffect, useCallback } from 'react';
import { getCurrentUser, type User } from '../api/auth';

interface AuthState {
  user: User | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    setLoading(true);
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return { user, loading, refetch: fetchUser };
}
