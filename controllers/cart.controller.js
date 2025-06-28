import e from "express";
import Product from "../models/product.model.js";

export const addToCart = async (req, res) => {
  try {
    const { productId } = req.body;
    const user = req.user;

    const existingItem = user.cart.find((item) => item.productId === productId);
    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      user.cart.push({ productId });
    }
    await user.save();
    res.json(user.cartItems);
  } catch (error) {
    console.error("Error adding to cart:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const removeAllFromCart = async (req, res) => {
  try {
    const { productId } = req.body;
    const user = req.user;
    if (!productId) {
      user.cartItems = [];
    } else {
      user.cartItems = user.cartItems.filter((item) => item.id !== productId);
    }
    await user.save();
    res.json(user.cartItems);
  } catch (error) {
    console.error("Error removing items from cart:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
export const updateQuantity = async (req, res) => {
  try {
    const { id: productId } = req.params;
    const { quantity } = req.body;
    const user = req.user;

    const existingItem = user.cartItems.find(
      (item) => item.productId === productId
    );
    if (existingItem) {
      if (quantity <= 0) {
        user.cart = user.cartItems.filter(
          (item) => item.productId !== productId
        );
        await user.save();
        return res.json(user.cartItems);
      } else {
        existingItem.quantity = quantity;
        await user.save();
        return res.json(user.cartItems);
      }
    } else {
      return res.status(404).json({ message: "Item not found in cart" });
    }
  } catch (error) {
    console.error("Error updating cart quantity:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
export const getCartProducts = async (req, res) => {
  try {
    const product = Product.find({
      _id: { $in: req.user.cartItems },
    });
    // add quantity to each product
    const cartProducts = (await product).map((product) => {
      const cartItem = req.user.cartItems.find(
        (item) => item.productId.toString() === product._id
      );
      return {
        ...product.JSON(), // convert Mongoose document to plain object
        quantity: cartItem ? cartItem.quantity : 1, // Default to 1 if not found
      };
    });
    res.json(cartProducts);
  } catch (error) {
    console.error("Error fetching cart products:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
