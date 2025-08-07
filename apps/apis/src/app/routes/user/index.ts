import { FastifyPluginAsync } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth, AuthenticatedRequest } from '@beeat/shared-lib';
import { UserService } from '../../../services/user.service';
import {
  UpdateUserProfileSchema,
  ChangePasswordSchema,
  SuccessResponseSchema,
  ErrorResponseSchema,
} from '@beeat/shared-lib';

const userService = new UserService();

const user: FastifyPluginAsync = async (fastify): Promise<void> => {
  // GET /user/profile - Get user profile
  fastify.withTypeProvider<ZodTypeProvider>().get(
    '/profile',
    {
      schema: {
        tags: ['User'],
        summary: 'Get user profile',
        description: "Get the authenticated user's profile information",
        security: [{ bearerAuth: [] }],
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
        const profile = await userService.getUserProfile(authRequest.user.id);

        if (!profile) {
          return reply.code(404).send({
            success: false,
            error: {
              code: 'USER_001',
              message: 'User profile not found',
            },
          });
        }

        reply.send({
          success: true,
          data: profile,
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

  // PUT /user/profile - Update user profile
  fastify.withTypeProvider<ZodTypeProvider>().put(
    '/profile',
    {
      schema: {
        tags: ['User'],
        summary: 'Update user profile',
        description: "Update the authenticated user's profile information",
        security: [{ bearerAuth: [] }],
        body: UpdateUserProfileSchema,
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
        const result = await userService.updateUserProfile(
          authRequest.user.id,
          request.body as any
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

  // POST /user/avatar - Upload user avatar
  fastify.withTypeProvider<ZodTypeProvider>().post(
    '/avatar',
    {
      schema: {
        tags: ['User'],
        summary: 'Upload user avatar',
        description: "Upload and update the authenticated user's avatar",
        security: [{ bearerAuth: [] }],
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
        // This would typically handle file upload to Supabase Storage
        // For now, returning a placeholder implementation

        const avatarUrl = 'https://example.com/avatar.jpg'; // Placeholder

        const result = await userService.updateAvatar(
          authRequest.user.id,
          avatarUrl
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

  // PUT /user/password - Change password
  fastify.withTypeProvider<ZodTypeProvider>().put(
    '/password',
    {
      schema: {
        tags: ['User'],
        summary: 'Change password',
        description: "Change the authenticated user's password",
        security: [{ bearerAuth: [] }],
        body: ChangePasswordSchema,
        response: {
          200: SuccessResponseSchema,
          400: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
      preHandler: requireAuth(),
    },
    async (request, reply) => {
      try {
        const { currentPassword, newPassword, confirmPassword } = request.body;

        if (!currentPassword || !newPassword || !confirmPassword) {
          return reply.code(400).send({
            success: false,
            error: {
              code: 'VALIDATION_001',
              message: 'All password fields are required',
            },
          });
        }

        if (newPassword !== confirmPassword) {
          return reply.code(400).send({
            success: false,
            error: {
              code: 'VALIDATION_002',
              message: 'New passwords do not match',
            },
          });
        }

        if (newPassword.length < 6) {
          return reply.code(400).send({
            success: false,
            error: {
              code: 'AUTH_006',
              message: 'Password must be at least 6 characters long',
            },
          });
        }

        const { error } = await fastify.supabase.auth.updateUser({
          password: newPassword,
        });

        if (error) {
          return reply.code(400).send({
            success: false,
            error: {
              code: 'AUTH_001',
              message: 'Failed to update password',
            },
          });
        }

        reply.send({
          success: true,
          data: {
            message: 'Password changed successfully',
          },
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
};

export default user;
