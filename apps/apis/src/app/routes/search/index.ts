import { FastifyPluginAsync } from 'fastify';
import { CourseService } from '../../../services/course.service';
import { prisma } from '@beeat/shared-lib';
import { CourseLevel } from '../../../generated/prisma';

const courseService = new CourseService();

const search: FastifyPluginAsync = async (fastify): Promise<void> => {
  // GET /search/courses - Search courses
  fastify.get<{
    Querystring: {
      q: string;
      category?: string;
      level?: CourseLevel;
      priceMin?: string;
      priceMax?: string;
      rating?: string;
      duration?: 'short' | 'medium' | 'long';
      language?: string;
      sortBy?: 'relevance' | 'rating' | 'price' | 'newest' | 'popular';
      page?: string;
      limit?: string;
    };
  }>('/courses', async (request, reply) => {
    try {
      const query = request.query;

      if (!query.q) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'VALIDATION_001',
            message: 'Search query is required',
          },
        });
      }

      const searchParams = {
        q: query.q,
        page: query.page ? parseInt(query.page) : 1,
        limit: query.limit ? parseInt(query.limit) : 12,
        category: query.category,
        level: query.level,
        priceMin: query.priceMin ? parseFloat(query.priceMin) : undefined,
        priceMax: query.priceMax ? parseFloat(query.priceMax) : undefined,
        rating: query.rating ? parseFloat(query.rating) : undefined,
        duration: query.duration,
        language: query.language,
        sortBy: query.sortBy || 'relevance',
      };

      const result = await courseService.searchCourses(searchParams);

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
  });

  // GET /search/suggestions - Get search suggestions
  fastify.get<{
    Querystring: {
      q: string;
      limit?: string;
    };
  }>('/suggestions', async (request, reply) => {
    try {
      const { q, limit = '5' } = request.query;

      if (!q || q.length < 2) {
        return reply.send({
          success: true,
          data: {
            suggestions: [],
          },
        });
      }

      const limitNum = Math.min(parseInt(limit), 10);

      // Get course title suggestions
      const courseSuggestions = await prisma.course.findMany({
        where: {
          title: {
            contains: q,
            mode: 'insensitive',
          },
        },
        select: {
          title: true,
        },
        take: limitNum,
        distinct: ['title'],
      });

      // Get instructor name suggestions
      const instructorSuggestions = await prisma.instructor.findMany({
        where: {
          name: {
            contains: q,
            mode: 'insensitive',
          },
        },
        select: {
          name: true,
          _count: {
            select: {
              courses: true,
            },
          },
        },
        take: limitNum,
        distinct: ['name'],
      });

      // Get category suggestions
      const categorySuggestions = await prisma.category.findMany({
        where: {
          name: {
            contains: q,
            mode: 'insensitive',
          },
        },
        select: {
          name: true,
          _count: {
            select: {
              courses: true,
            },
          },
        },
        take: limitNum,
        distinct: ['name'],
      });

      // Get skill suggestions
      const skillSuggestions = await prisma.courseSkill.findMany({
        where: {
          skill: {
            contains: q,
            mode: 'insensitive',
          },
        },
        select: {
          skill: true,
        },
        take: limitNum,
        distinct: ['skill'],
      });

      const suggestions = [
        ...courseSuggestions.map((c: { title: string }) => ({
          text: c.title,
          type: 'course',
          count: 1,
        })),
        ...instructorSuggestions.map((i: { name: string; _count: { courses: number } }) => ({
          text: i.name,
          type: 'instructor',
          count: i._count.courses,
        })),
        ...categorySuggestions.map((c: { name: string; _count: { courses: number } }) => ({
          text: c.name,
          type: 'category',
          count: c._count.courses,
        })),
        ...skillSuggestions.map((s: { skill: string }) => ({
          text: s.skill,
          type: 'skill',
          count: 1,
        })),
      ].slice(0, limitNum);

      reply.send({
        success: true,
        data: {
          suggestions,
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
  });

  // async function getSearchFilters() {
  //   const [categories, levels, priceRange] = await Promise.all([
  //     prisma.category.findMany({
  //       select: {
  //         name: true,
  //         slug: true
  //       }
  //     }),
  //     Object.values(CourseLevel),
  //     prisma.course.aggregate({
  //       _min: { price: true },
  //       _max: { price: true }
  //     })
  //   ])

  //   return {
  //     categories: categories.map(c => c.slug),
  //     levels: levels,
  //     priceRange: {
  //       min: priceRange._min.price || 0,
  //       max: priceRange._max.price || 1000000
  //     }
  //   }
  // }
};

export default search;
