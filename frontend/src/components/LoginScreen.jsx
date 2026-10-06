import { useState } from 'react';
import { ArrowRight, Leaf, ShieldCheck, Sprout, Store } from 'lucide-react';

const roleOptions = [
  { role: 'farmer', label: 'Farmer', icon: Sprout, email: 'farmer@oor.local', password: 'Farmer@123' },
  { role: 'seller', label: 'Seller', icon: Store, email: 'seller@oor.local', password: 'Seller@123' },
  { role: 'admin', label: 'Admin', icon: ShieldCheck, email: 'admin@oor.local', password: 'Admin@123' },
];

export default function LoginScreen({ onSignIn }) {
  const [selectedRole, setSelectedRole] = useState(roleOptions[0]);
  const [email, setEmail] = useState(roleOptions[0].email);
  const [password, setPassword] = useState(roleOptions[0].password);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await onSignIn(email, password);
    } catch (signInError) {
      setError(signInError.message);
    } finally {
      setSubmitting(false);
    }
  }

  function selectRole(option) {
    setSelectedRole(option);
    setEmail(option.email);
    setPassword(option.password);
    setError('');
  }

  return <main className="login-page">
    <section className="login-story">
      <a className="auth-brand" href="#login"><span><Leaf size={21} /></span><b>oor <small>market link</small></b></a>
      <div className="story-copy"><span className="story-kicker">A shorter route to market</span><h1>Good harvests<br />deserve a <em>fair price.</em></h1><p>Local farmers, nearby sellers, and better deals for the people who grow our food.</p></div>
      <div className="story-foot"><span className="story-dot" />Thanjavur district network<span className="story-foot-line" />4 local markets</div>
    </section>
    <section className="login-panel">
      <div className="login-card">
        <span className="login-eyebrow">WELCOME BACK</span>
        <h2>Sign in to your market</h2>
        <p className="login-subtitle">Choose your account type to continue.</p>
        <div className="role-picker" aria-label="Account type">
          {roleOptions.map((option) => {
            const Icon = option.icon;
            return <button type="button" key={option.role} className={selectedRole.role === option.role ? 'role-choice selected' : 'role-choice'} onClick={() => selectRole(option)}><Icon size={16} /><span>{option.label}</span></button>;
          })}
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          <label>Email address<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          {error && <div className="login-error" role="alert">{error}</div>}
          <button type="submit" className="login-submit" disabled={submitting}>{submitting ? 'Signing in…' : `Continue as ${selectedRole.label}`}<ArrowRight size={16} /></button>
        </form>
        <div className="demo-note"><span>DEMO ACCESS</span><p>Sample accounts are prefilled. Select a role above to switch accounts.</p></div>
        <div className="login-privacy"><ShieldCheck size={14} />Your account opens a private {selectedRole.label.toLowerCase()} workspace.</div>
      </div>
      <div className="login-copyright">Oor Market Link <span>·</span> Local produce, fair trade</div>
    </section>
  </main>;
}