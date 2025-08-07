import { prisma } from '@beeat/shared-lib';

export interface UpdateLessonProgressData {
  completed: boolean;
  timeSpent?: number;
  watchedDuration?: number;
}

export class ProgressService {
  async getCourseProgress(userId: string, courseId: string) {
    const enrollment = await prisma.courseEnrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
    });

    if (!enrollment) {
      throw new Error('Not enrolled in this course');
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        sections: {
          include: {
            lessons: {
              include: {
                progress: {
                  where: { userId },
                },
              },
            },
          },
        },
      },
    });

    if (!course) {
      throw new Error('Course not found');
    }

    const allLessons = course.sections.flatMap((section: any) => section.lessons);
    const completedLessons = allLessons.filter(
      (lesson: any) => lesson.progress.length > 0 && lesson.progress[0].completed
    );

    const totalTimeSpent = allLessons.reduce(
      (total: number, lesson: any) => total + (lesson.progress[0]?.timeSpent || 0),
      0
    );

    const overallProgress =
      allLessons.length > 0
        ? Math.round((completedLessons.length / allLessons.length) * 100)
        : 0;

    const currentLesson = allLessons.find(
      (lesson: any) => !lesson.progress[0]?.completed
    );

    const lastAccessedProgress = await prisma.lessonProgress.findFirst({
      where: { userId },
      orderBy: { lastAccessedAt: 'desc' },
    });

    return {
      progress: {
        courseId,
        userId,
        overallProgress,
        completedLessons: completedLessons.map((lesson: any) => lesson.id),
        currentLesson: currentLesson?.id || null,
        timeSpent: totalTimeSpent,
        lastAccessedAt:
          lastAccessedProgress?.lastAccessedAt || enrollment.enrolledAt,
        startedAt: enrollment.enrolledAt,
        completedAt: enrollment.completedAt,
        certificateEarned: enrollment.certificateEarned,
        certificateUrl: enrollment.certificateUrl,
      },
      lessons: allLessons.map((lesson: any) => ({
        id: lesson.id,
        title: lesson.title,
        duration: lesson.duration,
        completed: lesson.progress[0]?.completed || false,
        completedAt: lesson.progress[0]?.completedAt || null,
        timeSpent: lesson.progress[0]?.timeSpent || 0,
      })),
    };
  }

  async updateLessonProgress(
    userId: string,
    courseId: string,
    lessonId: string,
    data: UpdateLessonProgressData
  ) {
    // Verify user is enrolled in the course
    const enrollment = await prisma.courseEnrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
    });

    if (!enrollment) {
      throw new Error('Not enrolled in this course');
    }

    // Verify lesson belongs to the course
    const lesson = await prisma.lesson.findFirst({
      where: {
        id: lessonId,
        section: {
          courseId,
        },
      },
    });

    if (!lesson) {
      throw new Error('Lesson not found in this course');
    }

    // Update lesson progress
    const progressData = {
      completed: data.completed,
      completedAt: data.completed ? new Date() : null,
      timeSpent: data.timeSpent || 0,
      watchedDuration: data.watchedDuration || 0,
      lastAccessedAt: new Date(),
    };

    const lessonProgress = await prisma.lessonProgress.upsert({
      where: {
        userId_lessonId: {
          userId,
          lessonId,
        },
      },
      create: {
        userId,
        lessonId,
        ...progressData,
      },
      update: progressData,
    });

    // Calculate updated course progress
    const courseProgress = await this.calculateCourseProgress(userId, courseId);

    // Update course enrollment if course is completed
    if (courseProgress.overallProgress === 100 && !enrollment.completedAt) {
      await prisma.courseEnrollment.update({
        where: { id: enrollment.id },
        data: {
          completedAt: new Date(),
          certificateEarned: true,
          certificateUrl: `https://certificates.beeat.com/course/${courseId}/user/${userId}`,
        },
      });
    }

    return {
      message: 'Lesson progress updated successfully',
      lessonProgress: {
        lessonId: lessonProgress.lessonId,
        completed: lessonProgress.completed,
        completedAt: lessonProgress.completedAt,
        timeSpent: lessonProgress.timeSpent,
      },
      courseProgress: {
        overallProgress: courseProgress.overallProgress,
        completedLessons: courseProgress.completedLessons,
        totalLessons: courseProgress.totalLessons,
      },
    };
  }

  private async calculateCourseProgress(userId: string, courseId: string) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        sections: {
          include: {
            lessons: {
              include: {
                progress: {
                  where: { userId },
                },
              },
            },
          },
        },
      },
    });

    if (!course) {
      throw new Error('Course not found');
    }

    const allLessons = course.sections.flatMap((section: any) => section.lessons);
    const completedLessons = allLessons.filter(
      (lesson: any) => lesson.progress.length > 0 && lesson.progress[0].completed
    );

    const overallProgress =
      allLessons.length > 0
        ? Math.round((completedLessons.length / allLessons.length) * 100)
        : 0;

    return {
      overallProgress,
      completedLessons: completedLessons.length,
      totalLessons: allLessons.length,
    };
  }
}
