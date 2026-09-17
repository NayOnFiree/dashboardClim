"use server";

import { activateInvitationToken } from "@/lib/auth/invitations";

export async function activateInvitation(token: string) {
  return activateInvitationToken(token);
}
