import { prisma } from '@beeat/shared-lib';
import { PaymentStatus, Prisma } from '../generated/prisma';

export interface CreatePaymentIntentData {
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
}

export interface ConfirmPaymentData {
  paymentIntentId: string;
  paymentMethodId: string;
}

export class PaymentService {
  async createPaymentIntent(userId: string, data: CreatePaymentIntentData) {
    const totalAmount = data.items.reduce(
      (sum: number, item: any) => sum + item.price * item.quantity,
      0
    );

    const payment = await prisma.payment.create({
      data: {
        userId,
        amount: totalAmount,
        currency: 'VND',
        status: PaymentStatus.PENDING,
        paymentMethod: data.paymentMethod,
        billingAddress: {
          create: data.billingAddress,
        },
        orderItems: {
          create: data.items.map((item: any) => ({
            courseId: item.courseId,
            price: item.price,
            quantity: item.quantity,
          })),
        },
      },
      include: {
        billingAddress: true,
        orderItems: true,
      },
    });

    // In a real implementation, you would integrate with a payment provider like Stripe
    const clientSecret = `pi_${payment.id}_secret_mock`;

    return {
      paymentIntent: {
        id: payment.id,
        clientSecret,
        amount: payment.amount,
        currency: payment.currency,
        status: 'requires_payment_method',
      },
      order: {
        id: payment.id,
        totalAmount: payment.amount,
        status: 'pending',
      },
    };
  }

  async confirmPayment(userId: string, data: ConfirmPaymentData) {
    const payment = await prisma.payment.findFirst({
      where: {
        id: data.paymentIntentId,
        userId,
      },
      include: {
        orderItems: true,
      },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new Error('Payment already processed');
    }

    // In a real implementation, you would confirm the payment with the payment provider
    // For now, we'll simulate a successful payment
    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.SUCCEEDED,
        paidAt: new Date(),
      },
      include: {
        orderItems: true,
      },
    });

    // Enroll user in all purchased courses
    const enrollmentPromises = payment.orderItems.map((item: any) =>
      prisma.courseEnrollment
        .create({
          data: {
            userId,
            courseId: item.courseId,
          },
        })
        .catch(() => {
          // Ignore if already enrolled
        })
    );

    await Promise.all(enrollmentPromises);

    // Clear cart after successful payment
    await prisma.cartItem.deleteMany({
      where: { userId },
    });

    return {
      payment: {
        id: updatedPayment.id,
        status: 'succeeded',
        amount: updatedPayment.amount,
        paidAt: updatedPayment.paidAt,
      },
      order: {
        id: updatedPayment.id,
        status: 'completed',
        courses: payment.orderItems.map((item: any) => item.courseId),
        completedAt: updatedPayment.paidAt,
      },
      message: 'Payment successful! You now have access to your courses.',
    };
  }

  async getPaymentHistory(
    userId: string,
    page = 1,
    limit = 10,
    status?: PaymentStatus
  ) {
    const skip = (page - 1) * limit;
    const where: Prisma.PaymentWhereInput = { userId };

    if (status) {
      where.status = status;
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          orderItems: {
            include: {
              // We'd need to join with Course here, but since we don't have a direct relation,
              // we'll handle this in a separate query or modify the schema
            },
          },
        },
      }),
      prisma.payment.count({ where }),
    ]);

    // Get course details for each payment
    const paymentsWithCourses = await Promise.all(
      payments.map(async (payment: any) => {
        const courses = await prisma.course.findMany({
          where: {
            id: {
              in: payment.orderItems.map((item: any) => item.courseId),
            },
          },
          select: {
            id: true,
            title: true,
            price: true,
          },
        });

        return {
          id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          paymentMethod: payment.paymentMethod,
          courses: courses.map((course: any) => ({
            id: course.id,
            title: course.title,
            price: course.price,
          })),
          createdAt: payment.createdAt,
          paidAt: payment.paidAt,
        };
      })
    );

    return {
      payments: paymentsWithCourses,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
      },
    };
  }
}
