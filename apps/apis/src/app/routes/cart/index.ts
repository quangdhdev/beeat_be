import { FastifyPluginAsync } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth, AuthenticatedRequest } from '@beeat/shared-lib';
import { CartService } from '../../../services/cart.service';
import {
  AddToCartSchema,
  UpdateCartItemSchema,
  CartItemParamSchema,
  SuccessResponseSchema,
  ErrorResponseSchema,
} from '@beeat/shared-lib';

const cartService = new CartService();

const cart: FastifyPluginAsync = async (fastify): Promise<void> => {
  // GET /cart - Get cart items
  fastify.withTypeProvider<ZodTypeProvider>().get(
    '/',
    {
      schema: {
        tags: ['Cart'],
        summary: 'Get cart items',
        description: "Get all items in the authenticated user's shopping cart",
        security: [{ bearerAuth: [] }],
        response: {
          200: SuccessResponseSchema,
          401: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
      preHandler: requireAuth(),
    },
    async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      try {
        const result = await cartService.getCartItems(authRequest.user.id);

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

  // POST /cart/add - Add course to cart
  fastify.withTypeProvider<ZodTypeProvider>().post(
    '/add',
    {
      schema: {
        tags: ['Cart'],
        summary: 'Add course to cart',
        description: "Add a course to the authenticated user's shopping cart",
        security: [{ bearerAuth: [] }],
        body: AddToCartSchema,
        response: {
          201: SuccessResponseSchema,
          400: ErrorResponseSchema,
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
        const { courseId, quantity = 1 } = request.body;

        if (!courseId) {
          return reply.code(400).send({
            success: false,
            error: {
              code: 'VALIDATION_001',
              message: 'Course ID is required',
            },
          });
        }

        const result = await cartService.addToCart(
          authRequest.user.id,
          courseId,
          quantity
        );

        reply.code(201).send({
          success: true,
          data: result,
        });
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === 'Course already in cart'
        ) {
          return reply.code(409).send({
            success: false,
            error: {
              code: 'CART_001',
              message: 'Course already in cart',
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

  // PUT /cart/items/:itemId - Update cart item quantity
  fastify.withTypeProvider<ZodTypeProvider>().put(
    '/items/:itemId',
    {
      schema: {
        tags: ['Cart'],
        summary: 'Update cart item quantity',
        description: 'Update the quantity of an item in the cart',
        security: [{ bearerAuth: [] }],
        params: CartItemParamSchema,
        body: UpdateCartItemSchema,
        response: {
          200: SuccessResponseSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
      preHandler: requireAuth(),
    },
    async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      try {
        const { itemId } = request.params;
        const { quantity } = request.body;

        if (!quantity || quantity < 1) {
          return reply.code(400).send({
            success: false,
            error: {
              code: 'VALIDATION_001',
              message: 'Quantity must be at least 1',
            },
          });
        }

        const result = await cartService.updateCartItemQuantity(
          authRequest.user.id,
          itemId,
          quantity
        );

        reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        if (error instanceof Error && error.message === 'Cart item not found') {
          return reply.code(404).send({
            success: false,
            error: {
              code: 'CART_002',
              message: 'Cart item not found',
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

  // DELETE /cart/items/:itemId - Remove item from cart
  fastify.withTypeProvider<ZodTypeProvider>().delete(
    '/items/:itemId',
    {
      schema: {
        tags: ['Cart'],
        summary: 'Remove item from cart',
        description: 'Remove an item from the cart',
        security: [{ bearerAuth: [] }],
        params: CartItemParamSchema,
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
        const { itemId } = request.params;

        const result = await cartService.removeFromCart(
          authRequest.user.id,
          itemId
        );

        reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        if (error instanceof Error && error.message === 'Cart item not found') {
          return reply.code(404).send({
            success: false,
            error: {
              code: 'CART_002',
              message: 'Cart item not found',
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

  // DELETE /cart/clear - Clear cart
  fastify.withTypeProvider<ZodTypeProvider>().delete(
    '/clear',
    {
      schema: {
        tags: ['Cart'],
        summary: 'Clear cart',
        description: 'Remove all items from the cart',
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
        const result = await cartService.clearCart(authRequest.user.id);

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
};

export default cart;
