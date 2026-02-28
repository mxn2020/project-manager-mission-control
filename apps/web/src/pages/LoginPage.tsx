import { useState } from 'react';
import type { useAuth } from '../hooks/useAuth';

type AuthActions = ReturnType<typeof useAuth>;

interface LoginPageProps {
    needsSetup: boolean;
    onLogin: AuthActions['login'];
    onRegister: AuthActions['register'];
}

export default function LoginPage({ needsSetup, onLogin, onRegister }: LoginPageProps) {
    const [isSetup, setIsSetup] = useState(needsSetup);
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            if (isSetup) {
                await onRegister(email, name, password);
            } else {
                await onLogin(email, password);
            }
        } catch (err: any) {
            setError(err.message || 'Authentication failed');
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

                    {error && <div className="login-error">{error}</div>}

                    <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
                        {loading ? '⏳ Please wait...' : isSetup ? '🚀 Create Account' : '🔓 Sign In'}
                    </button>
                </form>

                {!needsSetup && (
                    <div className="login-footer">
                        <button
                            className="login-toggle"
                            onClick={() => { setIsSetup(!isSetup); setError(''); }}
                        >
                            {isSetup ? 'Already have an account? Sign in' : ''}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
