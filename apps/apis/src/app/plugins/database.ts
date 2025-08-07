import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { prisma, supabase } from '@beeat/shared-lib';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: typeof prisma;
    supabase: typeof supabase;
  }
}

const databasePlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('prisma', prisma);
  fastify.decorate('supabase', supabase);

  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
};

export default fp(databasePlugin);
