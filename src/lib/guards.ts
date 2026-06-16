/**
 * Reusable Elysia route guards.
 * Use with `.onBeforeHandle(requireAdmin)` at the router or route level.
 */

export function requireAuth({ user, set }: { user: any; set: any }) {
  if (user?.banned) {
    set.status = 403;
    throw new Error("Account suspended");
  }
}

export function requireAdmin({ user, set }: { user: any; set: any }) {
  if (user?.banned) {
    set.status = 403;
    throw new Error("Account suspended");
  }
  if (user?.role !== "admin") {
    set.status = 403;
    throw new Error("Forbidden");
  }
}
