import { prisma } from '@beeat/shared-lib';
import { CourseLevel, Prisma } from '../generated/prisma';

export interface GetCoursesQuery {
  page?: number;
  limit?: number;
  category?: string;
  level?: CourseLevel;
  sortBy?: 'newest' | 'popular' | 'rating' | 'price' | 'relevance';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchCoursesQuery extends GetCoursesQuery {
  q: string;
  priceMin?: number;
  priceMax?: number;
  rating?: number;
  duration?: 'short' | 'medium' | 'long';
  language?: string;
}

export class CourseService {
  async getCourses(query: GetCoursesQuery) {
    const {
      page = 1,
      limit = 12,
      category,
      level,
      sortBy = 'newest',
      sortOrder = 'desc',
    } = query;

    const skip = (page - 1) * Math.min(limit, 50);
    const take = Math.min(limit, 50);

    const where: Prisma.CourseWhereInput = {};

    if (category) {
      where.category = { slug: category };
    }

    if (level) {
      where.level = level;
    }

    const orderBy: Prisma.CourseOrderByWithRelationInput = {};

    switch (sortBy) {
      case 'newest':
        orderBy.createdAt = sortOrder;
        break;
      case 'popular':
        orderBy.studentsCount = sortOrder;
        break;
      case 'rating':
        orderBy.rating = sortOrder;
        break;
      case 'price':
        orderBy.price = sortOrder;
        break;
    }

    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          instructor: true,
          category: true,
          skills: true,
          requirements: true,
          _count: {
            select: { enrollments: true },
          },
        },
      }),
      prisma.course.count({ where }),
    ]);

    return {
      courses: courses.map((course: any) => ({
        ...course,
        studentsCount: course._count.enrollments,
      })),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / take),
        totalItems: total,
        hasNext: page < Math.ceil(total / take),
        hasPrev: page > 1,
      },
    };
  }

  async getCourseById(courseId: string, userId?: string) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        instructor: true,
        category: true,
        sections: {
          include: {
            lessons: {
              include: {
                resources: true,
              },
            },
          },
        },
        skills: true,
        requirements: true,
        enrollments: userId
          ? {
              where: { userId },
            }
          : false,
        _count: {
          select: { enrollments: true },
        },
      },
    });

    if (!course) {
      return null;
    }

    const isEnrolled = userId ? course.enrollments.length > 0 : false;

    return {
      ...course,
      isEnrolled,
      studentsCount: course._count.enrollments,
      curriculum: course.sections.map((section: any) => ({
        id: section.id,
        title: section.title,
        lessons: section.lessons.map((lesson: any) => ({
          id: lesson.id,
          title: lesson.title,
          duration: lesson.duration,
          isPreview: lesson.isPreview,
          videoUrl: lesson.videoUrl,
          resources: lesson.resources.map((r: any) => r.url),
        })),
      })),
      totalLessons: course.sections.reduce(
        (total: number, section: any) => total + section.lessons.length,
        0
      ),
    };
  }

  async searchCourses(query: SearchCoursesQuery) {
    const {
      q,
      page = 1,
      limit = 12,
      category,
      level,
      priceMin,
      priceMax,
      rating,
      language,
      sortBy = 'relevance',
    } = query;

    const skip = (page - 1) * Math.min(limit, 50);
    const take = Math.min(limit, 50);

    const where: Prisma.CourseWhereInput = {
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { skills: { some: { skill: { contains: q, mode: 'insensitive' } } } },
      ],
    };

    if (category) where.category = { slug: category };
    if (level) where.level = level;
    if (priceMin || priceMax) {
      where.price = {};
      if (priceMin) where.price.gte = priceMin;
      if (priceMax) where.price.lte = priceMax;
    }
    if (rating) where.rating = { gte: rating };
    if (language) where.language = language;

    let orderBy: Prisma.CourseOrderByWithRelationInput = {};

    if (sortBy === 'relevance') {
      orderBy = { rating: 'desc' };
    } else {
      switch (sortBy) {
        case 'rating':
          orderBy = { rating: 'desc' };
          break;
        case 'price':
          orderBy = { price: 'asc' };
          break;
        case 'newest':
          orderBy = { createdAt: 'desc' };
          break;
        case 'popular':
          orderBy = { studentsCount: 'desc' };
          break;
      }
    }

    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          instructor: true,
          category: true,
          _count: {
            select: { enrollments: true },
          },
        },
      }),
      prisma.course.count({ where }),
    ]);

    return {
      courses: courses.map((course: any) => ({
        ...course,
        studentsCount: course._count.enrollments,
        relevanceScore: 1.0,
      })),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / take),
        totalItems: total,
      },
    };
  }

  async enrollUserInCourse(userId: string, courseId: string) {
    try {
      const enrollment = await prisma.courseEnrollment.create({
        data: {
          userId,
          courseId,
        },
      });
      return enrollment;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error('COURSE_003');
        }
      }
      throw error;
    }
  }

  async getEnrolledCourses(userId: string, _status?: string) {
    const where: Prisma.CourseEnrollmentWhereInput = { userId };

    // Add status filtering logic here based on progress completion

    const enrollments = await prisma.courseEnrollment.findMany({
      where,
      include: {
        course: {
          include: {
            instructor: true,
            category: true,
            sections: {
              include: {
                lessons: true,
              },
            },
          },
        },
      },
    });

    return {
      courses: enrollments.map((enrollment: any) => ({
        ...enrollment.course,
        progress: 0, // Calculate actual progress
        totalLessons: enrollment.course.sections.reduce(
          (total: number, section: any) => total + section.lessons.length,
          0
        ),
        completedLessons: 0, // Calculate actual completed lessons
        lastAccessed: enrollment.enrolledAt,
        enrolledDate: enrollment.enrolledAt,
        certificateEarned: enrollment.certificateEarned,
        certificateUrl: enrollment.certificateUrl,
      })),
      stats: {
        totalCourses: enrollments.length,
        inProgress: enrollments.filter((e: any) => !e.completedAt).length,
        completed: enrollments.filter((e: any) => e.completedAt).length,
        certificatesEarned: enrollments.filter((e: any) => e.certificateEarned)
          .length,
      },
    };
  }
}
