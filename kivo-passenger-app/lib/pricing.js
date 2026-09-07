import { supabase } from './supabase';
import { RIDE_TIERS } from './tiers';

const DEFAULT_PRICING = { baseFare: 500, perKm: 100, perMinute: 40, minimumFare: 700 };
const DEFAULT_MULTIPLIERS = RIDE_TIERS.reduce((a, t) => { a[t.value] = t.defaultMultiplier; return a; }, {});

export async function getPricingConfig() {
  try {
    const { data } = await supabase.from('platform_settings').select('key, value')
      .in('key', ['base_fare', 'per_km_rate', 'per_minute_rate', 'minimum_fare',
        'multiplier_shared', 'multiplier_moto', 'multiplier_economy',
        'multiplier_comfort', 'multiplier_comfort_plus', 'multiplier_business']);
    if (!data) return { pricing: DEFAULT_PRICING, multipliers: DEFAULT_MULTIPLIERS };
    const m = {};
    data.forEach(r => { m[r.key] = Number(r.value); });
    return {
      pricing: {
        baseFare: m.base_fare || DEFAULT_PRICING.baseFare,
        perKm: m.per_km_rate || DEFAULT_PRICING.perKm,
        perMinute: m.per_minute_rate || DEFAULT_PRICING.perMinute,
        minimumFare: m.minimum_fare || DEFAULT_PRICING.minimumFare,
      },
      multipliers: {
        shared: m.multiplier_shared || DEFAULT_MULTIPLIERS.shared,
        moto: m.multiplier_moto || DEFAULT_MULTIPLIERS.moto,
        economy: m.multiplier_economy || DEFAULT_MULTIPLIERS.economy,
        comfort: m.multiplier_comfort || DEFAULT_MULTIPLIERS.comfort,
        comfort_plus: m.multiplier_comfort_plus || DEFAULT_MULTIPLIERS.comfort_plus,
        business: m.multiplier_business || DEFAULT_MULTIPLIERS.business,
      },
    };
  } catch {
    return { pricing: DEFAULT_PRICING, multipliers: DEFAULT_MULTIPLIERS };
  }
}

export function calculateFare(distanceKm, durationMin, tierValue, pricing, multipliers) {
  const mult = multipliers?.[tierValue] || 1.0;
  const raw = pricing.baseFare + distanceKm * pricing.perKm + durationMin * pricing.perMinute;
  return Math.max(Math.round(raw * mult), pricing.minimumFare);
}
