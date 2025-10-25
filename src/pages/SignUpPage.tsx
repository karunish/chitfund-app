import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { showError, showSuccess } from '@/utils/toast';

const SignUpPage = () => {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [referenceName, setReferenceName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          reference_name: referenceName,
        },
      },
    });

    setLoading(false);
    if (error) {
      showError(error.message);
    } else {
      showSuccess('Sign up successful! Please check your email to confirm your account.');
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <Card className="w-full max-w-md p-4">
        <div className="flex justify-center mb-4">
          
        </div>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Sign Up</CardTitle>
          <CardDescription>Create an account to join My App.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp}>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="first-name">First Name</Label>
                  <Input id="first-name" placeholder="First Name" required value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={loading} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="last-name">Last Name</Label>
                  <Input id="last-name" placeholder="Last Name" required value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={loading} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reference-name">Reference Name (Optional)</Label>
                <Input 
                  id="reference-name" 
                  placeholder="Name of introducer" 
                  value={referenceName} 
                  onChange={(e) => setReferenceName(e.target.value)} 
                  disabled={loading} 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="your@email.com" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" placeholder="••••••••" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating account...' : 'Create Account'}
              </Button>
            </div>
          </form>
          <div className="mt-4 text-center text-sm">
            Already have an account?{' '}
            <Link to="/login" className="underline">
              Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SignUpPage;