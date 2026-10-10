import { DefaultSession } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      role: string;
      merchantId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    username: string;
    role: string;
    merchantId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id?: string;
    username?: string;
    role?: string;
    merchantId?: string | null;
  }
}