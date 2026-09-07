export const DRIVER_CATEGORIES = {
  bike: { label: 'Bike Driver', tagline: 'Moto rides only', accepts: ['moto'] },
  economy: { label: 'Economy Driver', tagline: 'Shared and Economy rides', accepts: ['shared', 'economy'] },
  comfort: { label: 'Comfort Driver', tagline: 'Comfort, Comfort+ and Business rides', accepts: ['comfort', 'comfort_plus', 'business'] },
};

export function getAcceptedTiers(category) {
  return DRIVER_CATEGORIES[category]?.accepts || [];
}

export const TIER_LABELS = {
  moto: 'Moto', shared: 'Shared', economy: 'Economy',
  comfort: 'Comfort', comfort_plus: 'Comfort+', business: 'Business',
};
