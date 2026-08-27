import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';
import { db } from './db';

const isDemo = process.env.DEMO_MODE === 'true';

/**
 * Better Auth, email/password.
 *
 * Chosen over Auth.js because Auth.js's Credentials provider is JWT-only and
 * cannot do database sessions — which would mean a BLACKLISTED user keeps a
 * working session until their token expires. On an escrow platform whose top
 * threat is impersonation, sessions have to be revocable on the spot.
 * See docs/DECISIONS.md.
 *
 * Discord OAuth is deferred, not abandoned: add `socialProviders.discord` here
 * and the existing User.discordId / discordUsername columns fill in.
 */
export const auth = betterAuth({
  database: prismaAdapter(db, { provider: 'postgresql' }),

  emailAndPassword: {
    enabled: true,
    // No mail provider is wired up yet, so requiring verification would lock
    // every account out. Turn this on together with real email delivery.
    requireEmailVerification: false,
    minPasswordLength: 12,
    // Better Auth hashes with scrypt by default. Do not swap this for a fast
    // hash, and never store or log the plaintext.
    sendResetPassword: async ({ user, url }) => {
      // TODO: real delivery. Until then the link is logged so the flow is
      // demonstrable. Never log the token in a deployed environment.
      if (isDemo) console.log(`[DEMO] password reset for ${user.email}: ${url}`);
    },
  },

  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      if (isDemo) console.log(`[DEMO] verify ${user.email}: ${url}`);
    },
  },

  // Better Auth's core `name`/`image` map onto the columns the schema already
  // had, rather than duplicating them.
  user: {
    fields: {
      name: 'displayName',
      image: 'avatarUrl',
    },
    // Exposed on the session so proxy.ts can reject a blacklisted account
    // without a second query. `input: false` means a client can never set
    // them — role and status are server-controlled.
    additionalFields: {
      role: { type: 'string', input: false },
      status: { type: 'string', input: false },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh once a day
  },

  /**
   * CLAUDE.md requires rate limiting on auth. Stored in the database, not the
   * default in-memory store: on Vercel each serverless instance would keep its
   * own counter, so the limit would silently not apply.
   */
  rateLimit: {
    enabled: true, // on in dev too, so it actually gets exercised
    storage: 'database',
    window: 60,
    max: 100,
    customRules: {
      '/sign-in/email': { window: 60, max: 5 },
      '/sign-up/email': { window: 3600, max: 3 },
      '/forget-password': { window: 3600, max: 3 },
      '/reset-password': { window: 3600, max: 5 },
    },
  },

  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
