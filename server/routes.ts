import type { Express } from "express";
import { createServer, type Server } from "http";

export async function registerRoutes(app: Express): Promise<Server> {
  // No local API routes - using external API only
  // This server only serves the frontend static files
  
  console.log('🌐 Server configured to use external API:', process.env.VITE_API_BASE_URL || 'https://kl85uizp68.execute-api.us-west-2.amazonaws.com/api');
  
  const httpServer = createServer(app);

  return httpServer;
}