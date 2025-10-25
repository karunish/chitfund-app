import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthContext } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Bell, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type Notification = {
  id: number;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

const fetchNotifications = async (userId: string): Promise<Notification[]> => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
};

const NotificationsPage = () => {
  const { user } = useAuthContext();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => fetchNotifications(user!.id),
    enabled: !!user,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['unread-notifications-count', user?.id] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['unread-notifications-count', user?.id] });
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsReadMutation.mutate(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const hasUnread = notifications?.some(n => !n.is_read);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Notifications</h2>
        {hasUnread && (
          <Button variant="outline" size="sm" onClick={() => markAllAsReadMutation.mutate()} disabled={markAllAsReadMutation.isPending}>
            <Check className="mr-2 h-4 w-4" />
            Mark all as read
          </Button>
        )}
      </div>
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : notifications && notifications.length > 0 ? (
            <ul className="divide-y">
              {notifications.map(notification => (
                <li
                  key={notification.id}
                  className={`p-4 flex items-start gap-4 transition-colors ${notification.link ? 'cursor-pointer hover:bg-muted/50' : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  {!notification.is_read && (
                    <div className="h-2 w-2 rounded-full bg-primary mt-2" aria-label="Unread" />
                  )}
                  <div className={`flex-grow ${notification.is_read ? 'pl-4' : ''}`}>
                    <p className="font-semibold">{notification.title}</p>
                    <p className="text-sm text-muted-foreground">{notification.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="mx-auto h-12 w-12" />
              <p className="mt-4">You have no notifications.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationsPage;