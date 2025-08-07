import { z } from 'zod';

// Common response schemas
export const SuccessResponseSchema = z.object({
  success: z.literal(true),
  data: z.any(),
  message: z.string().optional(),
});

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }),
});

export const PaginationSchema = z.object({
  currentPage: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
  totalItems: z.number().int().nonnegative(),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
});

// Course schemas
export const CourseLevelSchema = z.enum([
  'BEGINNER',
  'INTERMEDIATE',
  'ADVANCED',
]);

export const InstructorSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  bio: z.string(),
  avatar: z.string().url().nullable(),
  rating: z.number().min(0).max(5),
  studentsCount: z.number().int().nonnegative(),
});

export const CourseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  longDescription: z.string().optional(),
  thumbnail: z.string().url().nullable(),
  price: z.number().nonnegative(),
  originalPrice: z.number().nonnegative().nullable(),
  rating: z.number().min(0).max(5),
  studentsCount: z.number().int().nonnegative(),
  duration: z.string(),
  level: CourseLevelSchema,
  category: z.string(),
  language: z.string(),
  lastUpdated: z.string().datetime(),
  instructor: InstructorSchema,
  skills: z.array(z.string()),
  requirements: z.array(z.string()),
  isEnrolled: z.boolean().optional(),
});

// User schemas
export const UserPreferencesSchema = z.object({
  language: z.string().default('en'),
  timezone: z.string().default('UTC'),
  notifications: z.object({
    email: z.boolean().default(true),
    courseUpdates: z.boolean().default(true),
    promotions: z.boolean().default(false),
    weeklyDigest: z.boolean().default(true),
  }),
});

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string(),
  phone: z.string().nullable(),
  bio: z.string().nullable(),
  avatar: z.string().url().nullable(),
  createdAt: z.string().datetime(),
  lastLoginAt: z.string().datetime().nullable(),
  preferences: UserPreferencesSchema.optional(),
});

export const UpdateUserProfileSchema = z.object({
  fullName: z.string().min(1).optional(),
  phone: z.string().optional(),
  bio: z.string().optional(),
  preferences: z
    .object({
      language: z.string().optional(),
      timezone: z.string().optional(),
      notifications: z
        .object({
          email: z.boolean().optional(),
          courseUpdates: z.boolean().optional(),
          promotions: z.boolean().optional(),
          weeklyDigest: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
});

// User service response schemas
export const UserProfileResponseSchema = z.object({
  user: UserSchema,
});

export const UpdateUserProfileResponseSchema = z.object({
  message: z.string(),
  user: UserSchema.pick({
    id: true,
    email: true,
    fullName: true,
    phone: true,
    bio: true,
    avatar: true,
  }).extend({
    updatedAt: z.string().datetime(),
  }),
});

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(6),
    confirmPassword: z.string().min(6),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

// Cart schemas
export const CartItemSchema = z.object({
  id: z.string().uuid(),
  courseId: z.string().uuid(),
  course: z.object({
    id: z.string().uuid(),
    title: z.string(),
    instructor: z.string(),
    thumbnail: z.string().url().nullable(),
    price: z.number().nonnegative(),
    originalPrice: z.number().nonnegative().nullable(),
  }),
  quantity: z.number().int().positive().default(1),
  addedAt: z.string().datetime(),
});

export const AddToCartSchema = z.object({
  courseId: z.string().uuid(),
  quantity: z.number().int().positive().default(1).optional(),
});

export const UpdateCartItemSchema = z.object({
  quantity: z.number().int().positive(),
});

// Analytics schemas
export const TrackCourseViewSchema = z.object({
  courseId: z.string().uuid(),
  source: z.string().optional(),
  referrer: z.string().optional(),
});

export const TrackLessonCompletionSchema = z.object({
  courseId: z.string().uuid(),
  lessonId: z.string().uuid(),
  timeSpent: z.number().nonnegative(),
  completionRate: z.number().min(0).max(100),
});

// Course progress schemas
export const UpdateLessonProgressSchema = z.object({
  completed: z.boolean(),
  timeSpent: z.number().nonnegative().optional(),
  watchedDuration: z.number().nonnegative().optional(),
});

// Query parameter schemas
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(12),
});

export const CourseQuerySchema = PaginationQuerySchema.extend({
  category: z.string().optional(),
  level: CourseLevelSchema.optional(),
  sortBy: z
    .enum(['newest', 'popular', 'rating', 'price', 'relevance'])
    .default('newest'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Course response schemas
export const CoursesListResponseSchema = z.object({
  courses: z.array(CourseSchema),
  pagination: PaginationSchema,
});

export const CourseResponseSchema = z.object({
  course: CourseSchema,
});

export const EnrollmentResponseSchema = z.object({
  message: z.string(),
  enrollment: z.object({
    id: z.string().uuid(),
    courseId: z.string().uuid(),
    userId: z.string().uuid(),
    enrolledAt: z.string().datetime(),
    progress: z.number().int().min(0).max(100),
  }),
});

export const EnrolledCoursesQuerySchema = z.object({
  status: z.string().optional(),
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(50).default(12).optional(),
});

export const AnalyticsQuerySchema = z.object({
  period: z.enum(['day', 'week', 'month', 'year']).default('month'),
});

// Payment schemas
export const PaymentStatusSchema = z.enum([
  'PENDING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
]);

export const BillingAddressSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  address: z.string().min(1),
  city: z.string().min(1),
  zipCode: z.string().min(1),
});

export const PaymentItemSchema = z.object({
  courseId: z.string().uuid(),
  quantity: z.number().int().positive(),
  price: z.number().nonnegative(),
});

export const CreatePaymentIntentSchema = z.object({
  items: z.array(PaymentItemSchema).min(1),
  paymentMethod: z.string().min(1),
  billingAddress: BillingAddressSchema,
});

export const ConfirmPaymentSchema = z.object({
  paymentIntentId: z.string().min(1),
});

export const PaymentSchema = z.object({
  id: z.string().uuid(),
  amount: z.number().nonnegative(),
  currency: z.string(),
  status: PaymentStatusSchema,
  paymentMethod: z.string(),
  courses: z.array(
    z.object({
      id: z.string().uuid(),
      title: z.string(),
      price: z.number().nonnegative(),
    })
  ),
  createdAt: z.string().datetime(),
  paidAt: z.string().datetime().nullable(),
});

export const PaymentHistoryQuerySchema = PaginationQuerySchema;

// Common param schemas
export const UuidParamSchema = z.object({
  id: z.string().uuid(),
});

export const CourseIdParamSchema = z.object({
  courseId: z.string().uuid(),
});

export const LessonProgressParamSchema = z.object({
  courseId: z.string().uuid(),
  lessonId: z.string().uuid(),
});

export const CartItemParamSchema = z.object({
  itemId: z.string().uuid(),
});

// Search schemas
export const SearchCoursesQuerySchema = z.object({
  q: z.string().min(1, 'Search query is required'),
  category: z.string().optional(),
  level: CourseLevelSchema.optional(),
  priceMin: z.coerce.number().nonnegative().optional(),
  priceMax: z.coerce.number().nonnegative().optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  duration: z.enum(['short', 'medium', 'long']).optional(),
  language: z.string().optional(),
  sortBy: z
    .enum(['relevance', 'rating', 'price', 'newest', 'popular'])
    .default('relevance'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(12),
});

// Progress schemas
export const ProgressParamSchema = z.object({
  courseId: z.string().uuid(),
});
