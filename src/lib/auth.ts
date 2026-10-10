import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: {
          label: "Username",
          type: "text",
        },
        password: {
          label: "Password",
          type: "password",
        },
      },
      async authorize(credentials) {
        const username = credentials?.username;
        const password = credentials?.password;

        if (!username || !password) {
          return null;
        }

        // IMPORTANT:
        // Load Prisma lazily inside the request handler.
        // This prevents the MariaDB adapter from being initialized while
        // Next.js/Railway is collecting route/page data during `next build`.
        const { prisma } = await import("@/lib/prisma");

        const user = await prisma.user.findUnique({
          where: {
            username,
          },
          include: {
            merchant: {
              select: { id: true },
            },
          },
        });

        if (!user || !user.status) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          password,
          user.password
        );

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: null,
          username: user.username,
          role: user.role,
          merchantId: user.merchant?.id || null,
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = (user as { username: string }).username;
        token.role = (user as { role: string }).role;
        token.merchantId =
          (user as { merchantId?: string | null }).merchantId || null;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.role = token.role as string;
        session.user.merchantId = (token.merchantId as string | null) || null;
      }

      return session;
    },
  },
};
