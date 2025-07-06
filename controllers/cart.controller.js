import Product from "../models/product.model.js";

// Add product to cart
export const addToCart = async (req, res) => {
  try {
    const { productId } = req.body;
    const user = req.user;

    const existingItem = user.cartItems.find(
      (item) => item.product.toString() === productId
    );

    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      user.cartItems.push({ product: productId, quantity: 1 });
    }

    await user.save();
    res.json(user.cartItems);
  } catch (error) {
    console.error("Error adding to cart:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Remove product from cart or clear cart
export const removeAllFromCart = async (req, res) => {
  try {
    const { productId } = req.body;
    const user = req.user;

    if (!productId) {
      user.cartItems = [];
    } else {
      user.cartItems = user.cartItems.filter(
        (item) => item.product.toString() !== productId
      );
    }

    await user.save();
    res.json(user.cartItems);
  } catch (error) {
    console.error("Error removing items from cart:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update quantity of a product in cart
export const updateQuantity = async (req, res) => {
  try {
    const { id: productId } = req.params;
    const { quantity } = req.body;
    const user = req.user;

    const existingItem = user.cartItems.find(
      (item) => item.product.toString() === productId
    );

    if (!existingItem) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    if (quantity <= 0) {
      user.cartItems = user.cartItems.filter(
        (item) => item.product.toString() !== productId
      );
    } else {
      existingItem.quantity = quantity;
    }

    await user.save();
    res.json(user.cartItems);
  } catch (error) {
    console.error("Error updating cart quantity:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get full product details with quantity
export const getCartProducts = async (req, res) => {
  try {
    const user = req.user;

    const productIds = user.cartItems.map((item) => item.product);
    const products = await Product.find({ _id: { $in: productIds } });

    const cartProducts = products.map((product) => {
      const cartItem = user.cartItems.find(
        (item) => item.product.toString() === product._id.toString()
      );
      return {
        ...product.toObject(),
        quantity: cartItem ? cartItem.quantity : 1,
      };
    });

    res.json(cartProducts);
  } catch (error) {
    console.error("Error fetching cart products:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
