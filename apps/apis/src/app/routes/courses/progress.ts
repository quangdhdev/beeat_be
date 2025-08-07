import { FastifyPluginAsync } from 'fastify';
import { requireAuth, AuthenticatedRequest } from '@beeat/shared-lib';
import { ProgressService } from '../../../services/progress.service';

const progressService = new ProgressService();

const progress: FastifyPluginAsync = async (fastify): Promise<void> => {
  // GET /courses/:courseId/progress - Get course progress
  fastify.get<{
    Params: { courseId: string };
  }>(
    '/:courseId/progress',
    {
      preHandler: requireAuth(),
    },
    async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      try {
        const { courseId } = request.params as any;

        const result = await progressService.getCourseProgress(
          authRequest.user.id,
          courseId
        );

        reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Not enrolled in this course') {
            return reply.code(403).send({
              success: false,
              error: {
                code: 'COURSE_005',
                message: 'Not enrolled in this course',
              },
            });
          }

          if (error.message === 'Course not found') {
            return reply.code(404).send({
              success: false,
              error: {
                code: 'COURSE_001',
                message: 'Course not found',
              },
            });
          }
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

  // PUT /courses/:courseId/lessons/:lessonId/progress - Update lesson progress
  fastify.put<{
    Params: {
      courseId: string;
      lessonId: string;
    };
    Body: {
      completed: boolean;
      timeSpent?: number;
      watchedDuration?: number;
    };
  }>(
    '/:courseId/lessons/:lessonId/progress',
    {
      preHandler: requireAuth(),
    },
    async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      try {
        const { courseId, lessonId } = request.params as any;
        const { completed, timeSpent, watchedDuration } = request.body as any;

        if (typeof completed !== 'boolean') {
          return reply.code(400).send({
            success: false,
            error: {
              code: 'VALIDATION_001',
              message: 'Completed field is required and must be boolean',
            },
          });
        }

        const result = await progressService.updateLessonProgress(
          authRequest.user.id,
          courseId,
          lessonId,
          { completed, timeSpent, watchedDuration }
        );

        reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Not enrolled in this course') {
            return reply.code(403).send({
              success: false,
              error: {
                code: 'COURSE_005',
                message: 'Not enrolled in this course',
              },
            });
          }

          if (error.message === 'Lesson not found in this course') {
            return reply.code(404).send({
              success: false,
              error: {
                code: 'LESSON_001',
                message: 'Lesson not found',
              },
            });
          }
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

export default progress;
