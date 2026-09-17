import type { DefaultSession } from "next-auth";
import type { AppRole } from "@/lib/auth/session";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & { id: string; organizationId: string; role: AppRole };
  }
}
