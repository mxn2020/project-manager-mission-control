import { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@mission-control/backend/convex/_generated/api';
import type { AuthUser } from '../lib/types';

const TOKEN_KEY = 'mc_auth_token';

export function useAuth() {
    const [token, setToken] = useState<string | null>(() => {
        // Check URL for agent_token first
        const params = new URLSearchParams(window.location.search);
        const agentToken = params.get('agent_token');
        if (agentToken) {
            // Store it temporarily — will be validated via agentLogin
            return null; // Don't set token yet, let the effect handle it
        }
        return localStorage.getItem(TOKEN_KEY);
    });
    const [agentLoginPending, setAgentLoginPending] = useState(() => {
        return new URLSearchParams(window.location.search).has('agent_token');
    });
    // Capture agent_token once so it survives URL cleaning and StrictMode re-mounts
    const agentTokenRef = useRef<string | null>(
        new URLSearchParams(window.location.search).get('agent_token')
    );
    const hasStartedAgentLogin = useRef(false);

    const user = useQuery(api.auth.me, token ? { token } : "skip") as AuthUser | null | undefined;
    const needsSetup = useQuery(api.auth.needsSetup);

    const loginMutation = useMutation(api.auth.login);
    const registerMutation = useMutation(api.auth.register);
    const logoutMutation = useMutation(api.auth.logout);
    const agentLoginMutation = useMutation(api.auth.agentLogin);

    // Handle agent_token URL parameter
    useEffect(() => {
        const agentToken = agentTokenRef.current;
        if (agentToken && agentLoginPending && !hasStartedAgentLogin.current) {
            hasStartedAgentLogin.current = true;
            agentLoginMutation({ agentSecret: agentToken })
                .then((result) => {
                    localStorage.setItem(TOKEN_KEY, result.token);
                    setToken(result.token);
                    // Clean URL
                    window.history.replaceState({}, '', window.location.pathname);
                    agentTokenRef.current = null;
                })
                .catch((err) => {
                    console.error('[Mission Control] Agent login failed:', err);
                    hasStartedAgentLogin.current = false;
                })
                .finally(() => setAgentLoginPending(false));
        }
    }, [agentLoginPending, agentLoginMutation]);

    const login = useCallback(async (email: string, password: string) => {
        const result = await loginMutation({ email, password });
        localStorage.setItem(TOKEN_KEY, result.token);
        setToken(result.token);
        return result;
    }, [loginMutation]);

    const register = useCallback(async (email: string, name: string, password: string, orgName?: string) => {
        const result = await registerMutation({ email, name, password, orgName });
        localStorage.setItem(TOKEN_KEY, result.token);
        setToken(result.token);
        return result;
    }, [registerMutation]);

    const logout = useCallback(async () => {
        if (token) {
            try { await logoutMutation({ token }); } catch { /* ignore */ }
        }
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
    }, [token, logoutMutation]);

    const orgId = user?.orgId;

    return {
        user,
        orgId,
        token,
        needsSetup: needsSetup === true,
        isSetupLoading: needsSetup === undefined || agentLoginPending,
        isLoading: (user === undefined && token !== null) || agentLoginPending,
        isAuthenticated: !!user,
        login,
        register,
        logout,
    };
}
