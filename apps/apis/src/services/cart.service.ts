import { prisma } from '@beeat/shared-lib';
import { Prisma } from '../generated/prisma';

export class CartService {
  async getCartItems(userId: string) {
    const items = await prisma.cartItem.findMany({
      where: { userId },
      include: {
        course: {
          include: {
            instructor: true,
          },
        },
      },
      orderBy: { addedAt: 'desc' },
    });

    const subtotal = items.reduce(
      (sum: number, item: any) => sum + item.course.price * item.quantity,
      0
    );
    const totalOriginalPrice = items.reduce(
      (sum: number, item: any) =>
        sum + (item.course.originalPrice || item.course.price) * item.quantity,
      0
    );
    const totalSavings = totalOriginalPrice - subtotal;

    return {
      items: items.map((item: any) => ({
        id: item.id,
        courseId: item.courseId,
        course: {
          id: item.course.id,
          title: item.course.title,
          instructor: item.course.instructor.name,
          thumbnail: item.course.thumbnail,
          price: item.course.price,
          originalPrice: item.course.originalPrice,
        },
        quantity: item.quantity,
        addedAt: item.addedAt,
      })),
      summary: {
        totalItems: items.length,
        subtotal,
        totalOriginalPrice,
        totalSavings,
        total: subtotal,
      },
    };
  }

  async addToCart(userId: string, courseId: string, quantity = 1) {
    try {
      const cartItem = await prisma.cartItem.create({
        data: {
          userId,
          courseId,
          quantity,
        },
      });

      return {
        message: 'Course added to cart successfully',
        cartItem: {
          id: cartItem.id,
          courseId: cartItem.courseId,
          quantity: cartItem.quantity,
          addedAt: cartItem.addedAt,
        },
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error('Course already in cart');
        }
      }
      throw error;
    }
  }

  async updateCartItemQuantity(
    userId: string,
    itemId: string,
    quantity: number
  ) {
    const cartItem = await prisma.cartItem.updateMany({
      where: {
        id: itemId,
        userId,
      },
      data: { quantity },
    });

    if (cartItem.count === 0) {
      throw new Error('Cart item not found');
    }

    return {
      message: 'Cart item updated successfully',
      cartItem: {
        id: itemId,
        quantity,
        updatedAt: new Date(),
      },
    };
  }

  async removeFromCart(userId: string, itemId: string) {
    const result = await prisma.cartItem.deleteMany({
      where: {
        id: itemId,
        userId,
      },
    });

    if (result.count === 0) {
      throw new Error('Cart item not found');
    }

    return {
      message: 'Item removed from cart successfully',
    };
  }

  async clearCart(userId: string) {
    await prisma.cartItem.deleteMany({
      where: { userId },
    });

    return {
      message: 'Cart cleared successfully',
    };
  }
}
