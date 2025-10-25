import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthContext } from '@/contexts/AuthContext';

const fetchUnreadCount = async (userId: string) => {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error('Error fetching unread notification count:', error);
    return 0;
  }
  return count || 0;
};

export const useUnreadNotifications = () => {
  const { user } = useAuthContext();

  const { data: count, ...rest } = useQuery({
    queryKey: ['unread-notifications-count', user?.id],
    queryFn: () => fetchUnreadCount(user!.id),
    enabled: !!user,
    refetchInterval: 60000, // Refetch every minute
  });

  return { count, ...rest };
};