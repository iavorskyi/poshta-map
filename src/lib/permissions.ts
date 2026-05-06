import type { SessionUser } from "@/lib/auth";

export type Me = Pick<SessionUser, "id" | "isAdmin">;

export function canEditPensioner(
  me: Me,
  p: { postmanId: number | null }
): boolean {
  if (me.isAdmin) return true;
  return p.postmanId === me.id || p.postmanId === null;
}

export function canEditRound(
  me: Me,
  r: { postmanId: number | null }
): boolean {
  if (me.isAdmin) return true;
  return r.postmanId === me.id;
}

export function canEditAddressRound(
  me: Me,
  r: { postmanId: number | null }
): boolean {
  if (me.isAdmin) return true;
  return r.postmanId === me.id;
}

export function canEditCurrentPayment(
  me: Me,
  cp: {
    round: { postmanId: number | null } | null;
    pensioner: { postmanId: number | null };
  }
): boolean {
  if (me.isAdmin) return true;
  if (cp.round) {
    return cp.round.postmanId === me.id;
  }
  return canEditPensioner(me, cp.pensioner);
}

export function canManageDistrict(me: Me): boolean {
  return me.isAdmin;
}

export function canManagePayments(me: Me): boolean {
  return me.isAdmin;
}

export function canManagePostmen(me: Me): boolean {
  return me.isAdmin;
}

export function canImport(me: Me): boolean {
  return me.isAdmin;
}

export class ForbiddenError extends Error {
  constructor(message = "Недостатньо прав") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function assert(
  cond: boolean,
  message = "Недостатньо прав"
): asserts cond {
  if (!cond) throw new ForbiddenError(message);
}
