// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { startOfDay, addDays, format } from "https://esm.sh/date-fns@2.30.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationPayload {
  user_id: string;
  title: string;
  message: string;
  link?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const notificationsToCreate: NotificationPayload[] = [];
    const today = startOfDay(new Date());
    const dayOfMonth = today.getDate();

    // --- 1. Loan Reminders ---
    const oneDayFromNow = addDays(today, 1);
    const sevenDaysFromNow = addDays(today, 7);
    const eightDaysFromNow = addDays(today, 8);

    const { data: loans, error: loansError } = await supabaseAdmin
      .from('loan_requests')
      .select('id, due_date, amount, user_id, guarantor_id')
      .in('status', ['in-process', 'approved'])
      .not('due_date', 'is', null) // <-- Important fix: Ignore loans without a due date
      .or(
        `and(due_date.gte.${today.toISOString()},due_date.lt.${oneDayFromNow.toISOString()}),` +
        `and(due_date.gte.${sevenDaysFromNow.toISOString()},due_date.lt.${eightDaysFromNow.toISOString()})`
      );

    if (loansError) throw new Error(`Failed to fetch loans: ${loansError.message}`);

    if (loans && loans.length > 0) {
      const userIds = new Set<string>();
      loans.forEach(loan => {
        if (loan.user_id) userIds.add(loan.user_id);
        if (loan.guarantor_id) userIds.add(loan.guarantor_id);
      });

      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', Array.from(userIds));
      if (profilesError) throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
      
      const profilesMap = new Map(profiles.map(p => [p.id, p]));

      const { data: adminProfiles, error: adminError } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('role', 'admin');
      if (adminError) throw new Error(`Failed to fetch admins: ${adminError.message}`);
      const adminIds = adminProfiles.map(p => p.id);

      for (const loan of loans) {
        const dueDate = new Date(loan.due_date);
        const isDueInOneDay = dueDate >= today && dueDate < oneDayFromNow;
        const timeText = isDueInOneDay ? "tomorrow" : "in one week";
        const formattedDueDate = format(dueDate, 'PPP');
        
        const loaneeProfile = profilesMap.get(loan.user_id);
        const loaneeName = `${loaneeProfile?.first_name || ''} ${loaneeProfile?.last_name || ''}`.trim() || 'A user';

        // To Loanee
        notificationsToCreate.push({
          user_id: loan.user_id,
          title: 'Loan Repayment Reminder',
          message: `Your loan of $${loan.amount.toLocaleString('en-IN')} is due ${timeText} on ${formattedDueDate}.`,
          link: '/loan-request'
        });

        // To Guarantor
        if (loan.guarantor_id) {
          notificationsToCreate.push({
            user_id: loan.guarantor_id,
            title: 'Guaranteed Loan Reminder',
            message: `The loan for ${loaneeName} that you guaranteed is due ${timeText} on ${formattedDueDate}.`,
            link: '/loan-request'
          });
        }

        // To Admins
        if (adminIds.length > 0) {
          for (const adminId of adminIds) {
              notificationsToCreate.push({
                  user_id: adminId,
                  title: 'Loan Due Soon',
                  message: `Reminder: ${loaneeName}'s loan of $${loan.amount.toLocaleString('en-IN')} is due ${timeText} on ${formattedDueDate}.`,
                  link: `/admin/loans`
              });
          }
        }
      }
    }

    // --- 2. General Contribution Reminders (for all users) ---
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const currentMonthName = format(today, 'MMMM yyyy');

    if (dayOfMonth === 1 || dayOfMonth === lastDayOfMonth) {
        const title = "Monthly Contribution Reminder";
        const message = `This is a friendly reminder to submit your monthly contribution of $500 for ${currentMonthName}. If you have already paid, please ignore this message.`;

        const { data: allUsers, error: usersError } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('role', 'user');
        
        if (usersError) throw usersError;

        for (const user of allUsers) {
            notificationsToCreate.push({
                user_id: user.id,
                title: title,
                message: message,
                link: '/contribute'
            });
        }
    }

    // --- 3. Missed Contribution Reminders (for Admins) ---
    if (dayOfMonth === 4) {
      const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const formattedMonth = format(startOfLastMonth, 'MMMM yyyy');

      const { data: allUsers, error: usersError } = await supabaseAdmin.from('profiles').select('id, role');
      if (usersError) throw usersError;

      const { data: contributors, error: contributorsError } = await supabaseAdmin
        .from('payment_proofs')
        .select('user_id')
        .eq('status', 'approved')
        .gte('contribution_month', startOfLastMonth.toISOString())
        .lt('contribution_month', new Date(today.getFullYear(), today.getMonth(), 1).toISOString());
      if (contributorsError) throw contributorsError;

      const contributorIds = new Set(contributors.map(c => c.user_id));
      const nonContributors = allUsers.filter(u => u.role === 'user' && !contributorIds.has(u.id));
      
      const { data: adminProfiles, error: adminError } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('role', 'admin');
      if (adminError) throw adminError;
      const adminIds = adminProfiles.map(p => p.id);
      
      if (nonContributors.length > 0 && adminIds.length > 0) {
        for (const adminId of adminIds) {
          notificationsToCreate.push({
            user_id: adminId,
            title: 'Missed Contributions Alert',
            message: `${nonContributors.length} member(s) have not submitted their contribution for ${formattedMonth}.`,
            link: '/admin/contributions'
          });
        }
      }
    }

    // --- Insert notifications into DB ---
    if (notificationsToCreate.length > 0) {
      const { error: insertError } = await supabaseAdmin.from('notifications').insert(notificationsToCreate);
      if (insertError) throw insertError;
    }

    return new Response(JSON.stringify({ message: `Processed ${notificationsToCreate.length} in-app notifications.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in notification-cron function:', error);
    return new Response(JSON.stringify({ error: error.message, details: error }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})