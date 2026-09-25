// Supabase Edge Function: notify-drivers
// Triggered by a database webhook when a new trip is inserted.
// Finds drivers whose category matches the trip's ride_tier and sends them a push notification.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Which driver categories accept which ride tiers
const CATEGORY_ACCEPTS: Record<string, string[]> = {
  bike: ['moto'],
  economy: ['shared', 'economy'],
  comfort: ['comfort', 'comfort_plus', 'business'],
};

// Given a ride tier, which driver categories should be notified?
function categoriesForTier(tier: string): string[] {
  const result: string[] = [];
  for (const [cat, tiers] of Object.entries(CATEGORY_ACCEPTS)) {
    if (tiers.includes(tier)) result.push(cat);
  }
  return result;
}

serve(async (req) => {
  try {
    const payload = await req.json();
    // The webhook sends the new row under `record`
    const trip = payload.record;
    if (!trip || trip.trip_status !== 'requested' || !trip.ride_tier) {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Which categories can take this ride?
    const cats = categoriesForTier(trip.ride_tier);
    if (cats.length === 0) {
      return new Response(JSON.stringify({ skipped: 'no matching categories' }), { status: 200 });
    }

    // Find approved, active drivers in those categories with a push token
    const { data: drivers } = await supabase
      .from('drivers')
      .select('push_token')
      .in('driver_category', cats)
      .eq('approval_status', 'approved')
      .eq('driver_status', 'active')
      .not('push_token', 'is', null);

    const tokens = (drivers || []).map((d: any) => d.push_token).filter(Boolean);
    if (tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
    }

    // Build the notification messages
    const messages = tokens.map((token: string) => ({
      to: token,
      sound: 'default',
      title: 'New ride request! 🚗',
      body: `${trip.pickup_location} → ${trip.dropoff_location} · ${Number(trip.fare || 0).toLocaleString()} FCFA`,
      channelId: 'rides',
      priority: 'high',
      data: { tripId: trip.id },
    }));

    // Send to Expo's push service (batches of 100)
    const chunks = [];
    for (let i = 0; i < messages.length; i += 100) chunks.push(messages.slice(i, i + 100));

    for (const chunk of chunks) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk),
      });
    }

    return new Response(JSON.stringify({ sent: tokens.length }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
