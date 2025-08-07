import { prisma } from '@beeat/shared-lib';
import { Prisma } from '../generated/prisma';
import { loggers } from '@beeat/shared-lib';

export interface UpdateUserProfileData {
  fullName?: string;
  phone?: string;
  bio?: string;
  preferences?: {
    language?: string;
    timezone?: string;
    notifications?: {
      email?: boolean;
      courseUpdates?: boolean;
      promotions?: boolean;
      weeklyDigest?: boolean;
    };
  };
}

export class UserService {
  async getUserProfile(userId: string) {
    loggers.service.debug({ userId }, 'Getting user profile');

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        preferences: true,
      },
    });

    if (!user) {
      return null;
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        bio: user.bio,
        avatar: user.avatar,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        preferences: user.preferences
          ? {
              language: user.preferences.language,
              timezone: user.preferences.timezone,
              notifications: {
                email: user.preferences.emailNotifications,
                courseUpdates: user.preferences.courseUpdateNotifications,
                promotions: user.preferences.promotionNotifications,
                weeklyDigest: user.preferences.weeklyDigestNotifications,
              },
            }
          : {
              language: 'en',
              timezone: 'UTC',
              notifications: {
                email: true,
                courseUpdates: true,
                promotions: false,
                weeklyDigest: true,
              },
            },
      },
    };
  }

  async updateUserProfile(userId: string, data: UpdateUserProfileData) {
    const updateData: Prisma.UserUpdateInput = {};

    if (data.fullName) updateData.fullName = data.fullName;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.bio !== undefined) updateData.bio = data.bio;

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    if (data.preferences) {
      const preferencesData: Prisma.UserPreferencesUpsertArgs['create'] = {
        userId,
        language: data.preferences.language || 'en',
        timezone: data.preferences.timezone || 'UTC',
        emailNotifications: data.preferences.notifications?.email ?? true,
        courseUpdateNotifications:
          data.preferences.notifications?.courseUpdates ?? true,
        promotionNotifications:
          data.preferences.notifications?.promotions ?? false,
        weeklyDigestNotifications:
          data.preferences.notifications?.weeklyDigest ?? true,
      };

      await prisma.userPreferences.upsert({
        where: { userId },
        create: preferencesData,
        update: {
          language: data.preferences.language,
          timezone: data.preferences.timezone,
          emailNotifications: data.preferences.notifications?.email,
          courseUpdateNotifications:
            data.preferences.notifications?.courseUpdates,
          promotionNotifications: data.preferences.notifications?.promotions,
          weeklyDigestNotifications:
            data.preferences.notifications?.weeklyDigest,
        },
      });
    }

    return {
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        bio: user.bio,
        avatar: user.avatar,
        updatedAt: user.updatedAt,
      },
    };
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { avatar: avatarUrl },
    });

    return {
      message: 'Avatar uploaded successfully',
      avatarUrl: user.avatar,
    };
  }

  async createOrUpdateUser(supabaseUser: {
    id: string;
    email: string;
    user_metadata?: { full_name?: string };
  }) {
    const userData = {
      id: supabaseUser.id,
      email: supabaseUser.email,
      fullName:
        supabaseUser.user_metadata?.full_name ||
        supabaseUser.email.split('@')[0],
      lastLoginAt: new Date(),
    };

    const user = await prisma.user.upsert({
      where: { id: supabaseUser.id },
      create: userData,
      update: {
        lastLoginAt: userData.lastLoginAt,
        fullName: userData.fullName,
      },
    });

    return user;
  }
}
