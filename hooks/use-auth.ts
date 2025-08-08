import { useSession, signOut } from '@/lib/auth-client';

interface AuthStatus {
  isAuthenticated: boolean;
  provider: string | null;
  email: string | null;
  loading: boolean;
  user?: {
    id: string;
    name: string | null;
    email: string;
    image?: string | null;
  } | null;
}

export function useAuth(): AuthStatus & {
  refreshAuth: () => void;
  logout: () => Promise<void>;
} {
  const { data: session, isPending, refetch } = useSession();

  const logout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const refreshAuth = () => {
    refetch();
  };

  return {
    isAuthenticated: !!session?.user,
    provider: session?.user ? 'better-auth' : null,
    email: session?.user?.email || null,
    loading: isPending,
    user: session?.user || null,
    refreshAuth,
    logout,
  };
}