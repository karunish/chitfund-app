import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';

const Index = () => {
  const { session, loading } = useAuthContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (session) {
        navigate('/dashboard');
      } else {
        navigate('/login');
      }
    }
  }, [session, loading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p>Loading...</p>
    </div>
  );
};

export default Index;