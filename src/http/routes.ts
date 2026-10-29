import { Router } from "express";
import type { EstimateService } from "../services/EstimateService.js";
import { parseCreateEstimateRequest } from "./validation.js";

/**
 * Thin handlers: parse, call the service, answer. No business rules live here.
 * Express 5 forwards errors thrown (or promises rejected) in a handler to the
 * error middleware by itself, so there is no try/catch.
 */
export function createEstimateRouter(service: EstimateService): Router {
  const router = Router();

  router.post("/", async (req, res) => {
    const input = parseCreateEstimateRequest(req.body);
    const estimate = await service.create(input);
    res.status(201).location(`/estimates/${encodeURIComponent(estimate.id)}`).json(estimate);
  });

  router.get("/:id", async (req, res) => {
    const estimate = await service.get(req.params.id);
    res.status(200).json(estimate);
  });

  return router;
}
