import express, { type Express } from "express";
import type { EstimateService } from "../services/EstimateService.js";
import { createErrorHandler, notFoundHandler, type Logger } from "./errorHandler.js";
import { createEstimateRouter } from "./routes.js";

export interface AppDependencies {
  estimateService: EstimateService;
  /** Receives unexpected (5xx) errors. Defaults to the console; tests pass a silent one. */
  logger?: Logger;
}

/**
 * Builds the Express app from its dependencies without starting a server, so tests
 * can plug in their own service and drive it with supertest.
 */
export function createApp({ estimateService, logger = console }: AppDependencies): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "10kb" }));

  app.use("/estimates", createEstimateRouter(estimateService));

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
}
