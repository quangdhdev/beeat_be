import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import cors from '@fastify/cors';

/**
 * This plugin enables CORS (Cross-Origin Resource Sharing) for the API
 * 
 * @see https://github.com/fastify/fastify-cors
 */
export default fp(async function (fastify: FastifyInstance) {
  const isDevelopment = process.env.NODE_ENV !== 'production';

  await fastify.register(cors, {
    // Allow requests from any origin in development, restrict in production
    origin: isDevelopment 
      ? true // In development, reflect the origin of the request
      : [
          'http://localhost:3000',
          'http://localhost:3001', 
          'http://localhost:5173', // Vite dev server default
          'http://localhost:4200', // Angular dev server default
          // Add your production domains here
        ],
    
    // Allow common HTTP methods for REST API
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    
    // Allow credentials (cookies, authorization headers)
    credentials: true,
    
    // Allow common headers used in API requests
    allowedHeaders: [
      'Origin',
      'X-Requested-With', 
      'Content-Type',
      'Accept',
      'Authorization',
      'Cache-Control'
    ],
    
    // Expose common headers that the client may need
    exposedHeaders: [
      'X-Total-Count',
      'X-Page-Count', 
      'Link'
    ],
    
    // Cache preflight requests for better performance
    maxAge: isDevelopment ? undefined : 86400, // 24 hours in production
  });

  fastify.log.info(`CORS enabled for ${isDevelopment ? 'development' : 'production'} environment`);
});