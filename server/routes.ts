import type { Express } from "express";
import { createServer, type Server } from "http";

export async function registerRoutes(app: Express): Promise<Server> {
  // No local API routes - using external API only
  // This server only serves the frontend static files
  
  
  
  const httpServer = createServer(app);

  return httpServer;
}