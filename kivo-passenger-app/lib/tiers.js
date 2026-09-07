export const RIDE_TIERS = [
  { value: 'shared', label: 'Shared', icon: 'people', tagline: 'Cheapest · driver may pick others', defaultMultiplier: 0.7 },
  { value: 'moto', label: 'Moto', icon: 'bicycle', tagline: 'Fastest · beats traffic', defaultMultiplier: 0.85 },
  { value: 'economy', label: 'Economy', icon: 'car', tagline: 'Regular car · you get all seats', defaultMultiplier: 1.0 },
  { value: 'comfort', label: 'Comfort', icon: 'car-sport', tagline: 'Nicer car · AC · more space', defaultMultiplier: 1.4 },
  { value: 'comfort_plus', label: 'Comfort+', icon: 'car-sport', tagline: 'Premium comfort', defaultMultiplier: 1.8 },
  { value: 'business', label: 'Business', icon: 'briefcase', tagline: 'Executive · top tier', defaultMultiplier: 2.5 },
];

export function getTier(value) {
  return RIDE_TIERS.find(t => t.value === value);
}
