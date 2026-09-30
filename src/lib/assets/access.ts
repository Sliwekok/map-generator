import type { AssetAccess, SessionUser } from "@/lib/types";

/**
 * Whether a user may use an asset group with the given access level.
 * The single place that maps access levels to users - extend here when adding a tier.
 */
export function canUseAccess(access: AssetAccess, user: SessionUser | null): boolean {
  switch (access) {
    case "free":
      return true;
    case "user":
      return !!user;
    default:
      return false;
  }
}
