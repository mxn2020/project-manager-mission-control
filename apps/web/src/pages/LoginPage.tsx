import { useState } from 'react';
import type { useAuth } from '../hooks/useAuth';

type AuthActions = ReturnType<typeof useAuth>;

interface LoginPageProps {
    needsSetup: boolean;
    onLogin: AuthActions['login'];
    onRegister: AuthActions['register'];
}

/**
 * Parse Convex error messages to extract the user-friendly part.
 * Convex errors look like:
 *   "[CONVEX M(auth:login)] [Request ID: xxx] Server Error Uncaught Error: Invalid email or password."
 * We strip the prefix and return just "Invalid email or password."
 */
function parseErrorMessage(err: unknown): string {
    const raw = err?.message || err?.data?.message || 'Authentication failed';

    // Try to extract message after "Uncaught Error: " or "Server Error: "
    const uncaughtMatch = raw.match(/Uncaught Error:\s*(.+)/);
    if (uncaughtMatch) return uncaughtMatch[1].trim();

    const serverMatch = raw.match(/Server Error:\s*(.+)/);
    if (serverMatch) return serverMatch[1].trim();

    // If it starts with [CONVEX ...], strip everything up to the last ]: or :]
    if (raw.startsWith('[CONVEX')) {
        const lastBracket = raw.lastIndexOf('] ');
        if (lastBracket !== -1) return raw.slice(lastBracket + 2).trim();
    }

    return raw;
}

export default function LoginPage({ needsSetup, onLogin, onRegister }: LoginPageProps) {
    const [isSetup, setIsSetup] = useState(needsSetup);
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [orgName, setOrgName] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            if (isSetup) {
                // Determine if onRegister takes an optional 4th parameter based on type, but we pass it anyway
                await onRegister(email, name, password, orgName || undefined);
            } else {
                await onLogin(email, password);
            }
        } catch (err: unknown) {
            setError(parseErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <div className="login-logo">🚀</div>
                    <h1 className="login-title">Mission Control</h1>
                    <p className="login-subtitle">
                        {isSetup ? 'Create your admin account' : 'Sign in to continue'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    {isSetup && (
                        <>
                            <div className="form-group">
                                <label className="form-label">Name</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Your name"
                                    required
                                    autoFocus
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Organization Name (Optional)</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={orgName}
                                    onChange={e => setOrgName(e.target.value)}
                                    placeholder="My Team Workspace"
                                />
                            </div>
                        </>
                    )}

                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <input
                            type="email"
                            className="form-input"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                            autoFocus={!isSetup}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input
                            type="password"
                            className="form-input"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            minLength={6}
                        />
                    </div>

                    {error && <div className="login-error" key={error}>⚠️ {error}</div>}

                    <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
                        {loading ? '⏳ Please wait...' : isSetup ? '🚀 Create Account' : '🔓 Sign In'}
                    </button>
                </form>

                {!needsSetup && (
                    <div className="login-footer">
                        <button
                            type="button"
                            className="login-toggle"
                            onClick={() => { setIsSetup(!isSetup); setError(''); }}
                        >
                            {isSetup ? 'Already have an account? Sign in' : 'No account? Create one'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
