import { supabase } from './supabase';

export async function validateCoupon(code, passengerId, baseFare) {
  const clean = code.trim().toUpperCase();
  if (!clean) return { valid: false, reason: 'Please enter a code.' };

  const { data: promo, error } = await supabase.from('promotions')
    .select('*').eq('promo_code', clean).eq('status', 'active').maybeSingle();
  if (error || !promo) return { valid: false, reason: 'This code is not valid.' };

  const today = new Date().toISOString().split('T')[0];
  if (promo.end_date && promo.end_date < today) return { valid: false, reason: 'This code has expired.' };
  if (promo.start_date && promo.start_date > today) return { valid: false, reason: 'This code is not active yet.' };

  const { count } = await supabase.from('promo_usage')
    .select('*', { count: 'exact', head: true })
    .eq('promotion_id', promo.id).eq('passenger_id', passengerId);
  const maxUses = promo.max_uses_per_user || 1;
  if ((count || 0) >= maxUses) return { valid: false, reason: `You've already used this code.` };

  let discount = 0;
  if (promo.discount_type === 'percentage') discount = Math.round(baseFare * promo.discount_value / 100);
  else discount = Math.min(promo.discount_value, baseFare);

  return { valid: true, discount, finalFare: Math.max(baseFare - discount, 0), promotion: promo };
}

export async function recordCouponUsage(promotionId, passengerId, tripId, discountApplied) {
  return await supabase.from('promo_usage').insert({
    promotion_id: promotionId, passenger_id: passengerId, trip_id: tripId, discount_applied: discountApplied,
  });
}
