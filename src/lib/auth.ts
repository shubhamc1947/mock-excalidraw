import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { db } from '@/lib/db';
import { backLinkInvitesForUser } from '@/lib/invites';
import authConfig from '@/auth.config';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        (session.user as { id?: string }).id = token.id as string;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (user.id && user.email) {
        try {
          const linkedPageIds = await backLinkInvitesForUser(db, user.id, user.email);
          for (const pageId of linkedPageIds) {
            const collab = await db.collaborator.findFirst({
              where: { pageId, userId: user.id },
              select: { invitedByUserId: true },
            });
            if (collab) {
              const { enqueueInviteNotification } = await import('@/lib/notifications');
              await enqueueInviteNotification(db, user.id, collab.invitedByUserId, pageId);
            }
          }
        } catch (e) {
          console.error('signIn event back-link error:', e);
        }
      }
    },
  },
});
