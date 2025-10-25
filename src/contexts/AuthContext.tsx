import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type Profile = {
  role: 'admin' | 'user';
  first_name: string | null;
  last_name: string | null;
  reference_name: string | null;
  outstanding_amount: number;
  membership_start_date: string | null;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const setData = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Error getting session:', error);
        setLoading(false);
        return;
      }
      
      setSession(session);
      if (session?.user) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('role, first_name, last_name, reference_name, outstanding_amount, membership_start_date')
          .eq('id', session.user.id)
          .single();

        if (profileError) {
          console.error('Error fetching profile:', profileError);
        } else {
          setProfile(profileData as Profile);
        }
      }
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        supabase
          .from('profiles')
          .select('role, first_name, last_name, reference_name, outstanding_amount, membership_start_date')
          .eq('id', session.user.id)
          .single()
          .then(({ data, error }) => {
            if (error) {
              console.error('Error fetching profile on auth change:', error);
              setProfile(null);
            } else {
              setProfile(data as Profile);
            }
          });
      } else {
        setProfile(null);
      }
    });

    setData();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};