import express from "express";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();
const app = express();

const url =
  "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";
const auth = Buffer.from(
  `${process.env.CONSUMER_KEY}:${process.env.CONSUMER_SECRET}`
).toString("base64");

export const getAccessToken = async (req, res, next) => {
  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });
    req.token = response.data.access_token;
    next();
  } catch (error) {
    console.error("Error fetching access token:", error);
    throw error;
  }
};
