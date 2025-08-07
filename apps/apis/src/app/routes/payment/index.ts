import { FastifyPluginAsync } from 'fastify';
import { requireAuth, AuthenticatedRequest } from '@beeat/shared-lib';
import { PaymentService } from '../../../services/payment.service';
import { PaymentStatus } from '../../../generated/prisma';

const paymentService = new PaymentService();

const payment: FastifyPluginAsync = async (fastify): Promise<void> => {
  // POST /payment/create-intent - Create payment intent
  fastify.post<{
    Body: {
      items: {
        courseId: string;
        quantity: number;
        price: number;
      }[];
      paymentMethod: string;
      billingAddress: {
        fullName: string;
        email: string;
        address: string;
        city: string;
        zipCode: string;
      };
    };
  }>(
    '/create-intent',
    {
      preHandler: requireAuth(),
    },
    async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      try {
        const { items, paymentMethod, billingAddress } = request.body as any;

        if (!items || !Array.isArray(items) || items.length === 0) {
          return reply.code(400).send({
            success: false,
            error: {
              code: 'VALIDATION_001',
              message: 'Items are required',
            },
          });
        }

        if (!paymentMethod || !billingAddress) {
          return reply.code(400).send({
            success: false,
            error: {
              code: 'VALIDATION_001',
              message: 'Payment method and billing address are required',
            },
          });
        }

        const result = await paymentService.createPaymentIntent(
          authRequest.user.id,
          { items, paymentMethod, billingAddress }
        );

        reply.code(201).send({
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

  // POST /payment/confirm - Confirm payment
  fastify.post<{
    Body: {
      paymentIntentId: string;
      paymentMethodId: string;
    };
  }>(
    '/confirm',
    {
      preHandler: requireAuth(),
    },
    async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      try {
        const { paymentIntentId, paymentMethodId } = request.body as any;

        if (!paymentIntentId || !paymentMethodId) {
          return reply.code(400).send({
            success: false,
            error: {
              code: 'VALIDATION_001',
              message: 'Payment intent ID and payment method ID are required',
            },
          });
        }

        const result = await paymentService.confirmPayment(
          authRequest.user.id,
          { paymentIntentId, paymentMethodId }
        );

        reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Payment not found') {
            return reply.code(404).send({
              success: false,
              error: {
                code: 'PAYMENT_001',
                message: 'Payment not found',
              },
            });
          }

          if (error.message === 'Payment already processed') {
            return reply.code(409).send({
              success: false,
              error: {
                code: 'PAYMENT_004',
                message: 'Payment already processed',
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

  // GET /payment/history - Get payment history
  fastify.get<{
    Querystring: {
      page?: string;
      limit?: string;
      status?: string;
    };
  }>(
    '/history',
    {
      preHandler: requireAuth(),
    },
    async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      try {
        const query = request.query as any;
        const page = query.page ? parseInt(query.page) : 1;
        const limit = query.limit ? parseInt(query.limit) : 10;
        const status = query.status as PaymentStatus | undefined;

        const result = await paymentService.getPaymentHistory(
          authRequest.user.id,
          page,
          limit,
          status
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
};

export default payment;
