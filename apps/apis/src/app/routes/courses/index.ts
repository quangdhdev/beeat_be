import { FastifyPluginAsync } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth, AuthenticatedRequest } from '@beeat/shared-lib';
import { CourseService } from '../../../services/course.service';
import {
  CourseQuerySchema,
  CourseIdParamSchema,
  EnrolledCoursesQuerySchema,
  SuccessResponseSchema,
  ErrorResponseSchema,
} from '@beeat/shared-lib';

const courseService = new CourseService();

const courses: FastifyPluginAsync = async (fastify): Promise<void> => {
  // GET /courses - Get all courses with pagination and filters
  fastify.withTypeProvider<ZodTypeProvider>().get(
    '/',
    {
      schema: {
        tags: ['Courses'],
        summary: 'Get all courses',
        description:
          'Retrieve all available courses with pagination and filtering options',
        querystring: CourseQuerySchema,
        response: {
          200: SuccessResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const query = request.query;

        const result = await courseService.getCourses({
          page: query.page,
          limit: query.limit,
          category: query.category,
          level: query.level,
          sortBy: query.sortBy,
          sortOrder: query.sortOrder,
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

  // GET /courses/:courseId - Get course by ID
  fastify.withTypeProvider<ZodTypeProvider>().get(
    '/:courseId',
    {
      schema: {
        tags: ['Courses'],
        summary: 'Get course by ID',
        description: 'Get detailed information about a specific course',
        params: CourseIdParamSchema,
        response: {
          200: SuccessResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const { courseId } = request.params;
        const authHeader = request.headers.authorization;
        let userId: string | undefined;

        if (authHeader?.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          try {
            const {
              data: { user },
            } = await fastify.supabase.auth.getUser(token);
            userId = user?.id;
          } catch (error) {
            // Continue without user context
          }
        }

        const course = await courseService.getCourseById(courseId, userId);

        if (!course) {
          return reply.code(404).send({
            success: false,
            error: {
              code: 'COURSE_001',
              message: 'Course not found',
            },
          });
        }

        reply.send({
          success: true,
          data: { course },
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

  // GET /courses/enrolled - Get user's enrolled courses
  fastify.withTypeProvider<ZodTypeProvider>().get(
    '/enrolled',
    {
      schema: {
        tags: ['Courses'],
        summary: 'Get enrolled courses',
        description: 'Get courses that the authenticated user is enrolled in',
        security: [{ bearerAuth: [] }],
        querystring: EnrolledCoursesQuerySchema,
        response: {
          200: SuccessResponseSchema,
          500: ErrorResponseSchema,
        },
      },
      preHandler: requireAuth(),
    },
    async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      try {
        const query = request.query;

        const result = await courseService.getEnrolledCourses(
          authRequest.user.id,
          query.status
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

  // POST /courses/:courseId/enroll - Enroll in a course
  fastify.withTypeProvider<ZodTypeProvider>().post(
    '/:courseId/enroll',
    {
      schema: {
        tags: ['Courses'],
        summary: 'Enroll in a course',
        description: 'Enroll the authenticated user in a specific course',
        security: [{ bearerAuth: [] }],
        params: CourseIdParamSchema,
        response: {
          201: SuccessResponseSchema,
          401: ErrorResponseSchema,
          409: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
      preHandler: requireAuth(),
    },
    async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      try {
        const { courseId } = request.params;

        const enrollment = await courseService.enrollUserInCourse(
          authRequest.user.id,
          courseId
        );

        reply.code(201).send({
          success: true,
          data: {
            message: 'Successfully enrolled in course',
            enrollment: {
              id: enrollment.id,
              courseId: enrollment.courseId,
              userId: enrollment.userId,
              enrolledAt: enrollment.enrolledAt.toISOString(),
              progress: 0,
            },
          },
        });
      } catch (error) {
        if (error instanceof Error && error.message === 'COURSE_003') {
          return reply.code(409).send({
            success: false,
            error: {
              code: 'COURSE_003',
              message: 'Already enrolled in this course',
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

export default courses;
