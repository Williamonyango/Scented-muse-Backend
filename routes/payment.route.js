import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  lipaNaMpesa,
  lipaNaMpesaCallback,
} from "../controllers/payment.controller.js";
import { getAccessToken } from "../middleware/authorization.js";

const router = express.Router();

router.post("/lipa-na-mpesa", protectRoute, getAccessToken, lipaNaMpesa);
router.post("/mpesa/callback", lipaNaMpesaCallback);

export default router;
