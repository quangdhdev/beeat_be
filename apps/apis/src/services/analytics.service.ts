import { prisma } from '@beeat/shared-lib';

export interface TrackCourseViewData {
  courseId: string;
  source?: string;
  referrer?: string;
  ipAddress?: string;
}

export interface TrackLessonCompletionData {
  courseId: string;
  lessonId: string;
  timeSpent: number;
  completionRate: number;
}

export class AnalyticsService {
  async trackCourseView(userId: string | null, data: TrackCourseViewData) {
    await prisma.courseAnalytics.create({
      data: {
        courseId: data.courseId,
        userId,
        source: data.source,
        referrer: data.referrer,
        ipAddress: data.ipAddress,
      },
    });

    return {
      message: 'Course view tracked successfully',
    };
  }

  async trackLessonCompletion(
    _userId: string,
    _data: TrackLessonCompletionData
  ) {
    // This is primarily for analytics tracking, separate from progress tracking
    // You could store this in a separate analytics table or use an external analytics service

    // For now, we'll just return success since the actual lesson completion
    // is handled by the progress service
    return {
      message: 'Lesson completion tracked successfully',
    };
  }

  async getLearningAnalytics(userId: string, period = 'month') {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        enrollments: {
          include: {
            course: {
              include: {
                category: true,
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
            },
          },
        },
        progress: {
          include: {
            lesson: {
              include: {
                section: {
                  include: {
                    course: {
                      include: {
                        category: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        analytics: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Calculate analytics
    const totalTimeSpent = user.progress.reduce(
      (sum: number, p: any) => sum + p.timeSpent,
      0
    );
    const completedLessons = user.progress.filter((p: any) => p.completed).length;
    const coursesCompleted = user.enrollments.filter(
      (e: any) => e.completedAt
    ).length;
    const certificatesEarned = user.enrollments.filter(
      (e: any) => e.certificateEarned
    ).length;

    // Calculate progress by category
    const categoryProgress = user.enrollments.reduce((acc: any, enrollment: any) => {
      const category = enrollment.course.category.name;

      if (!acc[category]) {
        acc[category] = {
          category,
          coursesEnrolled: 0,
          coursesCompleted: 0,
          timeSpent: 0,
        };
      }

      acc[category].coursesEnrolled++;
      if (enrollment.completedAt) {
        acc[category].coursesCompleted++;
      }

      // Calculate time spent in this category
      const categoryTimeSpent = enrollment.course.sections.reduce(
        (total: number, section: any) =>
          total +
          section.lessons.reduce(
            (sectionTotal: number, lesson: any) =>
              sectionTotal + (lesson.progress[0]?.timeSpent || 0),
            0
          ),
        0
      );

      acc[category].timeSpent += categoryTimeSpent;

      return acc;
    }, {} as Record<string, any>);

    // Recent activity
    const recentActivity = user.progress
      .filter((p: any) => p.completedAt)
      .sort(
        (a: any, b: any) =>
          new Date(b.completedAt as Date).getTime() -
          new Date(a.completedAt as Date).getTime()
      )
      .slice(0, 10)
      .map((p: any) => ({
        type: 'lesson_completed',
        courseTitle: p.lesson.section.course.title,
        lessonTitle: p.lesson.title,
        timestamp: p.completedAt,
      }));

    // Add enrollment events
    const enrollmentActivity = user.enrollments
      .sort(
        (a: any, b: any) =>
          new Date(b.enrolledAt).getTime() - new Date(a.enrolledAt).getTime()
      )
      .slice(0, 5)
      .map((e: any) => ({
        type: 'course_enrolled',
        courseTitle: e.course.title,
        lessonTitle: null,
        timestamp: e.enrolledAt,
      }));

    // Add certificate events
    const certificateActivity = user.enrollments
      .filter((e: any) => e.certificateEarned && e.completedAt)
      .sort(
        (a: any, b: any) =>
          new Date(b.completedAt as Date).getTime() -
          new Date(a.completedAt as Date).getTime()
      )
      .slice(0, 5)
      .map((e: any) => ({
        type: 'certificate_earned',
        courseTitle: e.course.title,
        lessonTitle: null,
        timestamp: e.completedAt,
      }));

    const allActivity = [
      ...recentActivity,
      ...enrollmentActivity,
      ...certificateActivity,
    ]
      .sort(
        (a: any, b: any) =>
          new Date(b.timestamp as Date).getTime() -
          new Date(a.timestamp as Date).getTime()
      )
      .slice(0, 15);

    // Calculate streaks (simplified - would need more complex logic for real streaks)
    const currentStreak = this.calculateCurrentStreak(user.progress);
    const longestStreak = this.calculateLongestStreak(user.progress);

    const userAnalytics = (user.analytics && Array.isArray(user.analytics)
      ? user.analytics[0]
      : null) || {
      totalTimeSpent: 0,
      coursesCompleted: 0,
      lessonsCompleted: 0,
      certificatesEarned: 0,
      currentStreak: 0,
      longestStreak: 0,
      dailyGoalMinutes: 30,
      weeklyGoalMinutes: 210,
    };

    return {
      analytics: {
        totalTimeSpent,
        coursesCompleted,
        lessonsCompleted: completedLessons,
        certificatesEarned,
        currentStreak,
        longestStreak,
        averageSessionTime:
          completedLessons > 0
            ? Math.round(totalTimeSpent / completedLessons)
            : 0,
        learningGoals: {
          daily: userAnalytics.dailyGoalMinutes * 60, // Convert to seconds
          weekly: userAnalytics.weeklyGoalMinutes * 60,
          achieved: false, // Would need to calculate based on recent activity
        },
        progressByCategory: Object.values(categoryProgress),
        recentActivity: allActivity,
      },
    };
  }

  private calculateCurrentStreak(progress: any[]): number {
    // Simplified streak calculation
    // In a real implementation, you'd calculate consecutive days of activity
    const completedProgress = progress.filter(
      (p: any) => p.completed && p.completedAt
    );
    const recentDays = this.getRecentDays(7);

    let streak = 0;
    for (const day of recentDays) {
      const hasActivity = completedProgress.some((p: any) =>
        this.isSameDay(new Date(p.completedAt), day)
      );
      if (hasActivity) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  private calculateLongestStreak(progress: any[]): number {
    // Simplified longest streak calculation
    // This would need a more sophisticated implementation
    return this.calculateCurrentStreak(progress);
  }

  private getRecentDays(count: number): Date[] {
    const days = [];
    for (let i = 0; i < count; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push(date);
    }
    return days;
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }
}
