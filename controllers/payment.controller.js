import axios from "axios";
import Coupon from "../models/coupon.model.js";
import Order from "../models/order.model.js";
import { getCurrentTimestamp } from "../utils/timestamp.js";

// Temporary in-memory store to hold session data (use Redis in production)
const pendingPayments = new Map();

export const lipaNaMpesa = async (req, res) => {
  try {
    const phone = req.body.phone.replace(/^0/, "");
    const amount = req.body.amount;
    const products = req.body.products;
    const couponCode = req.body.couponCode || null;

    const phoneNumber = `254${phone}`;
    const timestamp = getCurrentTimestamp();
    const token = req.token;

    let totalAmount = Math.round(amount); // ensure it's an integer in KES
    let appliedCoupon = null;

    if (couponCode) {
      appliedCoupon = await Coupon.findOne({
        code: couponCode,
        userId: req.user._id,
        isActive: true,
      });

      if (appliedCoupon) {
        totalAmount -= Math.round(
          (totalAmount * appliedCoupon.discountPercentage) / 100
        );
      }
    }

    // Save session data in temporary store
    pendingPayments.set(phoneNumber, {
      userId: req.user._id,
      products,
      amount: totalAmount,
      couponCode: appliedCoupon ? appliedCoupon.code : null,
    });

    const password = Buffer.from(
      `${process.env.BUSINESS_SHORT_CODE}${process.env.MPESA_PASSKEY}${timestamp}`
    ).toString("base64");

    const stkPushRequest = {
      BusinessShortCode: process.env.BUSINESS_SHORT_CODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: totalAmount,
      PartyA: phoneNumber,
      PartyB: process.env.BUSINESS_SHORT_CODE,
      PhoneNumber: phoneNumber,
      CallBackURL: `${process.env.SERVER_URL}/mpesa/callback`,
      AccountReference: `order_${req.user._id}`,
      TransactionDesc: "Purchase from store",
    };

    const response = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      stkPushRequest,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.status(200).json({
      message: "STK push initiated successfully",
      phone: phoneNumber,
      amount: totalAmount,
      response: response.data,
    });
  } catch (error) {
    console.error("STK Push Error:", error.response?.data || error.message);
    res.status(500).json({
      message: "Failed to initiate STK push",
      error: error.response?.data || error.message,
    });
  }
};

export const lipaNaMpesaCallback = async (req, res) => {
  console.log("M-Pesa Callback:", req.body);

  const stkCallback = req.body.Body?.stkCallback;

  if (!stkCallback?.CallbackMetadata) {
    return res.status(200).json({ message: "STK push failed or canceled" });
  }

  try {
    const metadata = stkCallback.CallbackMetadata;
    const items = metadata.Item;

    const amount = items.find((item) => item.Name === "Amount")?.Value;
    const mpesaReceipt = items.find(
      (item) => item.Name === "MpesaReceiptNumber"
    )?.Value;
    const phone = items.find((item) => item.Name === "PhoneNumber")?.Value;
    const phoneNumber = phone.toString();

    const sessionData = pendingPayments.get(phoneNumber);

    if (!sessionData) {
      return res
        .status(404)
        .json({ message: "No payment session found for this number." });
    }

    const { userId, products, couponCode } = sessionData;

    const newOrder = new Order({
      user: userId,
      products: products.map((p) => ({
        product: p._id,
        quantity: p.quantity,
        price: p.price,
      })),
      totalAmount: amount,
      transactionId: mpesaReceipt,
      phoneNumber,
    });

    await newOrder.save();

    // Deactivate coupon if used
    if (couponCode) {
      await Coupon.findOneAndUpdate(
        { code: couponCode, userId },
        { isActive: false }
      );
    }

    // Reward user with new coupon if amount >= 200
    if (amount >= 200) {
      await createNewCoupon(userId);
    }

    // Clean up session
    pendingPayments.delete(phoneNumber);

    res.status(200).json({
      success: true,
      message: "Order created successfully after M-Pesa payment",
      orderId: newOrder._id,
    });
  } catch (error) {
    console.error("Callback Error:", error.message);
    res.status(500).json({
      message: "Failed to process M-Pesa payment",
      error: error.message,
    });
  }
};

async function createNewCoupon(userId) {
  await Coupon.findOneAndDelete({ userId });

  const newCoupon = new Coupon({
    code: "GIFT" + Math.random().toString(36).substring(2, 8).toUpperCase(),
    discountPercentage: 10,
    expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    userId,
  });

  await newCoupon.save();

  return newCoupon;
}
