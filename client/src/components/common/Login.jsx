import { useState } from 'react';
import { auth } from '../../services/api';
import { Rocket, LogIn, UserPlus, AlertCircle } from 'lucide-react';

function Login({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        const res = await auth.register(formData);
        // API returns { success: true, data: { user, token, ... } }
        const { user, token } = res.data.data;
        onLogin(user, token);
      } else {
        const res = await auth.login(formData.username, formData.password);
        // API returns { success: true, data: { user, token } }
        const { user, token } = res.data.data;
        onLogin(user, token);
      }
    } catch (err) {
      const data = err.response?.data;
      // Handle validation errors array
      if (data?.errors && Array.isArray(data.errors)) {
        setError(data.errors.map(e => e.msg).join(', '));
      } else {
        setError(data?.message || data?.error || 'An error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-space-700 border-2 border-accent-cyan mb-4 animate-pulse-slow">
            <Rocket className="w-10 h-10 text-accent-cyan" />
          </div>
          <h1 className="text-3xl font-bold text-white">Space Wars 3000</h1>
          <p className="text-gray-400 mt-2">Explore. Trade. Conquer.</p>
        </div>

        {/* Form Card */}
        <div className="card">
          <h2 className="text-xl font-semibold text-center mb-6">
            {isRegister ? 'Create Account' : 'Welcome Back'}
          </h2>

          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-accent-red/10 border border-accent-red/30 text-accent-red">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm text-gray-400 mb-1">Username</label>
              <input
                id="username"
                type="text"
                className="input w-full"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
              />
            </div>

            {isRegister && (
              <div>
                <label htmlFor="email" className="block text-sm text-gray-400 mb-1">Email</label>
                <input
                  id="email"
                  type="email"
                  className="input w-full"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
            )}

            <div>
              <label htmlFor="password" className="block text-sm text-gray-400 mb-1">Password</label>
              <input
                id="password"
                type="password"
                className="input w-full"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary w-full flex items-center justify-center gap-2" disabled={loading}>
              {loading ? (
                <div className="w-5 h-5 border-2 border-space-900 border-t-transparent rounded-full animate-spin" />
              ) : isRegister ? (
                <><UserPlus className="w-5 h-5" /> Create Account</>
              ) : (
                <><LogIn className="w-5 h-5" /> Login</>
              )}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => { setIsRegister(!isRegister); setError(''); }}
              className="text-accent-cyan hover:underline text-sm"
            >
              {isRegister ? 'Already have an account? Login' : "Don't have an account? Register"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;

