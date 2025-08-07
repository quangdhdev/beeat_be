# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BeeAt Backend is a Node.js/TypeScript automation testing learning platform API built with Fastify and managed using Nx monorepo structure.

## Development Commands

### Core Development
```bash
# Start development server
npx nx serve apis

# Build for production  
npx nx build apis

# Run tests
npx nx test

# Run E2E tests
npx nx test apis-e2e

# View all available commands for a project
npx nx show project apis

# Docker build
npx nx docker-build apis
```

### Code Quality
```bash
# Lint code
npx nx lint

# Format code
npx nx format
```

### Shared Library Development
```bash
# Build shared library
npx nx build shared-lib

# Test shared library
npx nx test shared-lib

# Lint shared library
npx nx lint shared-lib
```

## Architecture Overview

### Monorepo Structure (Nx Workspace)
- **Main API**: `/apps/apis/` - Fastify-based REST API
- **E2E Tests**: `/apps/apis-e2e/` - End-to-end testing with Jest + axios
- **Shared Libraries**: `/packages/shared-lib/` - Shared utilities and types
- **Documentation**: `/docs/api-reference.md` - Comprehensive API specifications

### Tech Stack
- **Framework**: Fastify with autoloading plugins and routes
- **Language**: TypeScript (ES2022, strict mode)
- **Build Tool**: ESBuild via Nx
- **Testing**: Jest for unit tests, separate E2E app
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Supabase Auth
- **Storage**: Supabase (for file uploads)

### Key Directories
- **`/apps/apis/src/app/plugins/`** - Fastify plugins (sensible.ts, database.ts)
- **`/apps/apis/src/app/routes/`** - API route handlers (autoloaded by Fastify)
- **`/apps/apis/src/services/`** - Business logic services
- **`/apps/apis/src/generated/prisma/`** - Generated Prisma client
- **`/apps/apis/src/main.ts`** - Application entry point
- **`/packages/shared-lib/src/lib/`** - Shared utilities (@beeat/shared-lib)
  - `auth.ts` - Authentication functions and middleware
  - `database.ts` - Prisma database client setup
  - `logger.ts` - Pino logging configuration
  - `schemas.ts` - Zod validation schemas
  - `supabase.ts` - Supabase client configuration
- **`/prisma/`** - Database schema and migrations

### Current Implementation State
- ✅ Basic Fastify server with plugin autoloading
- ✅ Nx monorepo setup with build/test pipelines
- ✅ Docker containerization
- ✅ TypeScript strict configuration
- ✅ Comprehensive API documentation
- ✅ Prisma database schema with full data models
- ✅ Supabase authentication integration
- ✅ Database service layer (courses, users, cart)
- ✅ Authentication middleware
- ✅ Shared library with core utilities (@beeat/shared-lib)
- ❌ API endpoints implementation (in progress)
- ❌ Database migrations not run

### Database Commands
```bash
# Generate Prisma client
npx prisma generate

# Create and run migrations
npx prisma migrate dev

# Reset database
npx prisma migrate reset

# View database in Prisma Studio
npx prisma studio
```

### Environment Setup
1. Copy `.env.example` to `.env`
2. Set up PostgreSQL database and update `DATABASE_URL`
3. Create Supabase project and update Supabase environment variables
4. Run `npx prisma migrate dev` to set up database schema
5. Run `npx prisma generate` to generate Prisma client

### API Documentation
- **Swagger UI**: Available at `http://localhost:3000/docs` (development only)
- **Health Check**: `GET /health` - Shows API status and Swagger URL
- **Authentication**: Bearer JWT tokens via Supabase Auth

### Development Notes
- Server runs on `localhost:3000` by default (configurable via HOST/PORT env vars)
- Uses Fastify's autoload system for plugin and route discovery
- Nx handles all build, test, and development workflows
- Docker image uses Node.js Alpine with non-root user `beeat-be-apis`
- Authentication uses Supabase JWT tokens in Authorization header
- Database access through Prisma ORM with generated types
- Swagger documentation automatically disabled in production environment