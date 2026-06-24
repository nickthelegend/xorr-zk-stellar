import type { LucideIcon } from 'lucide-react';

export type AppNavItem = {
  name: string;
  url: string;
  icon: LucideIcon;
  disabled?: boolean;
};

// Header nav intentionally empty — logo + Launch App only.
export const APP_NAV_ITEMS: AppNavItem[] = [];
