import type { FormEvent } from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AuthFrame } from './Login';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ForgotPassword() { const { requestPasswordReset } = useAuth(); const [email, setEmail] = useState(''); const [message, setMessage] = useState(''); const [error, setError] = useState(''); const submit = async (event: FormEvent) => { event.preventDefault(); const result = await requestPasswordReset(email.trim()); if (result.error) setError(result.error.message); else setMessage('If an account exists, a recovery code has been sent.'); }; return <AuthFrame title="Reset your password" subtitle="We will send a recovery code to your email."><form onSubmit={(event) => void submit(event)} className="space-y-5"><div><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2" /></div>{error && <p className="text-sm text-rose-300">{error}</p>}{message && <p className="text-sm text-emerald-300">{message} <Link className="underline" to={`/reset-password?email=${encodeURIComponent(email)}`}>Enter it here.</Link></p>}<Button className="w-full bg-gradient-to-r from-violet-600 to-sky-600">Send recovery code</Button></form></AuthFrame>; }
