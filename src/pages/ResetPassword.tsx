import type { FormEvent } from 'react';
import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AuthFrame } from './Login';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ResetPassword() { const [params] = useSearchParams(); const navigate = useNavigate(); const { resetPasswordWithCode } = useAuth(); const [email, setEmail] = useState(params.get('email') || ''); const [token, setToken] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const submit = async (event: FormEvent) => { event.preventDefault(); if (password.length < 8) { setError('Use at least 8 characters.'); return; } const result = await resetPasswordWithCode(email.trim(), token.trim(), password); if (result.error) setError(result.error.message); else navigate('/login'); }; return <AuthFrame title="Choose a new password" subtitle="Use the recovery code from your email."><form onSubmit={(event) => void submit(event)} className="space-y-5"><div><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2" /></div><div><Label htmlFor="token">Recovery code</Label><Input id="token" inputMode="numeric" maxLength={6} required value={token} onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))} className="mt-2 tracking-[0.4em]" /></div><div><Label htmlFor="password">New password</Label><Input id="password" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2" /></div>{error && <p className="text-sm text-rose-300">{error}</p>}<Button className="w-full bg-gradient-to-r from-violet-600 to-sky-600">Update password</Button></form></AuthFrame>; }
