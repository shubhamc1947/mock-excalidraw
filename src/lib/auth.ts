import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { db } from '@/lib/db';
import { backLinkInvitesForUser } from '@/lib/invites';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  providers: [Google],
  session: { strategy: 'database' },
  callbacks: {
    async session({ session, user }) {
      if (session.user) (session.user as { id?: string }).id = user.id;
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (user.id && user.email) {
        try {
          const linkedPageIds = await backLinkInvitesForUser(db, user.id, user.email);
          // For each newly-linked page, fire an INVITED notification.
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
