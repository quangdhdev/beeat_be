import { FastifyPluginAsync } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth, AuthenticatedRequest } from '@beeat/shared-lib';
import { AnalyticsService } from '../../../services/analytics.service';
import {
  TrackCourseViewSchema,
  TrackLessonCompletionSchema,
  AnalyticsQuerySchema,
  SuccessResponseSchema,
  ErrorResponseSchema,
} from '@beeat/shared-lib';

const analyticsService = new AnalyticsService();

const analytics: FastifyPluginAsync = async (fastify): Promise<void> => {
  // POST /analytics/course-view - Track course view
  fastify.withTypeProvider<ZodTypeProvider>().post(
    '/course-view',
    {
      schema: {
        tags: ['Analytics'],
        summary: 'Track course view',
        description: 'Track when a user views a course',
        body: TrackCourseViewSchema,
        response: {
          200: SuccessResponseSchema,
          400: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const { courseId, source, referrer } = request.body;
        const authHeader = request.headers.authorization;
        let userId: string | null = null;

        if (authHeader?.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          try {
            const {
              data: { user },
            } = await fastify.supabase.auth.getUser(token);
            userId = user?.id || null;
          } catch (error) {
            // Continue without user context
          }
        }

        // courseId validation is now handled by Zod

        const ipAddress = request.ip;

        const result = await analyticsService.trackCourseView(userId, {
          courseId,
          source,
          referrer,
          ipAddress,
        });

        reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        reply.code(500).send({
          success: false,
          error: {
            code: 'SYSTEM_001',
            message: 'Internal server error',
          },
        });
      }
    }
  );

  // POST /analytics/lesson-completion - Track lesson completion
  fastify.withTypeProvider<ZodTypeProvider>().post(
    '/lesson-completion',
    {
      schema: {
        tags: ['Analytics'],
        summary: 'Track lesson completion',
        description: 'Track when a user completes a lesson',
        security: [{ bearerAuth: [] }],
        body: TrackLessonCompletionSchema,
        response: {
          200: SuccessResponseSchema,
          400: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
      preHandler: requireAuth(),
    },
    async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      try {
        const { courseId, lessonId, timeSpent, completionRate } = request.body;

        // Validation is now handled by Zod

        const result = await analyticsService.trackLessonCompletion(
          authRequest.user.id,
          {
            courseId,
            lessonId,
            timeSpent,
            completionRate,
          }
        );

        reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        reply.code(500).send({
          success: false,
          error: {
            code: 'SYSTEM_001',
            message: 'Internal server error',
          },
        });
      }
    }
  );

  // GET /analytics/learning - Get learning analytics
  fastify.withTypeProvider<ZodTypeProvider>().get(
    '/learning',
    {
      schema: {
        tags: ['Analytics'],
        summary: 'Get learning analytics',
        description: 'Get learning analytics for the authenticated user',
        security: [{ bearerAuth: [] }],
        querystring: AnalyticsQuerySchema,
        response: {
          200: SuccessResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
      preHandler: requireAuth(),
    },
    async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      try {
        const { period } = request.query;

        const result = await analyticsService.getLearningAnalytics(
          authRequest.user.id,
          period
        );

        reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        if (error instanceof Error && error.message === 'User not found') {
          return reply.code(404).send({
            success: false,
            error: {
              code: 'USER_001',
              message: 'User not found',
            },
          });
        }

        reply.code(500).send({
          success: false,
          error: {
            code: 'SYSTEM_001',
            message: 'Internal server error',
          },
        });
      }
    }
  );
};

export default analytics;
