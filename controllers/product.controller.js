import { redis } from "../lib/redis.js";
import cloudinary from "../lib/cloudinary.js";
import Product from "../models/product.model.js";

export const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find({});
    res.status(200).json(products);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching products", details: error.message });
  }
};

export const getFeaturedProducts = async (req, res) => {
  try {
    let featuredProducts = await redis.get("featured_products");
    if (featuredProducts) {
      featuredProducts = JSON.parse(featuredProducts);
      return res.status(200).json(featuredProducts);
    }

    // if not found in cache, fetch from database
    // lean to get plain JavaScript objects
    featuredProducts = await Product.find({ isFeatured: true }).lean();
    if (featuredProducts.length === 0) {
      return res.status(404).json({ message: "No featured products found" });
    }
    // Store in cache for future requests
    await redis.set("featured_products", JSON.stringify(featuredProducts));
    res.status(200).json(featuredProducts);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching featured products",
      details: error.message,
    });
  }
};
export const createProduct = async (req, res) => {
  try {
    const { name, description, price, image, category } = req.body;

    if (!name || !description || !price || !category) {
      return res.status(400).json({ message: "All fields are required" });
    }

    let cloudinaryResponse;
    if (image) {
      cloudinaryResponse = await cloudinary.uploader.upload(image, {
        folder: "products",
      });
    }

    const newProduct = new Product({
      name,
      description,
      price,
      image: cloudinaryResponse ? cloudinaryResponse.secure_url : "", // Use Cloudinary URL if uploaded
      category,
    });

    const savedProduct = await newProduct.save();
    res.status(201).json(savedProduct);
  } catch (error) {
    res.status(500).json({
      message: "Error creating product",
      details: error.message,
    });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    if (product.image) {
      // If the product has an image, delete it from Cloudinary
      const publicId = product.image.split("/").pop().split(".")[0]; // Extract public ID from URL
      try {
        await cloudinary.uploader.destroy(`products/${publicId}`);
      } catch (error) {
        console.error("Error deleting image from Cloudinary:", error.message);
        return res.status(500).json({
          message: "Error deleting product image",
          details: error.message,
        });
      }
    }

    // delete form database
    await Product.findByIdAndDelete(req.params.id);

    res.status(200).json({
      message: "Product deleted successfully",
      product,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error deleting product",
      details: error.message,
    });
  }
};
export const getRecommendedProducts = async (req, res) => {
  try {
    const products = await Product.aggregate([
      {
        $sample: { size: 3 }, // Randomly select 3 products
      },
      {
        $project: {
          _id: 1,
          name: 1,
          description: 1,
          price: 1,
          image: 1,
        },
      },
    ]);
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching recommended products",
      details: error.message,
    });
  }
};

export const getProductsByCategory = async (req, res) => {
  const { category } = req.params;
  try {
    const products = await Product.find({ category: category });
    if (products.length === 0) {
      return res
        .status(404)
        .json({ message: "No products found in this category" });
    }
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching products by category",
      details: error.message,
    });
  }
};

export const toggleFeaturedProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (product) {
      product.isFeatured = !product.isFeatured;
      const updatedProduct = await product.save();
      //   update cache
      await updatedteFeaturedProductsCache();
      res.status(200).json(updatedProduct);
    } else {
      res.status(404).json({ message: "Product not found" });
    }
  } catch (error) {
    res.status(500).json({
      message: "Error toggling featured status",
      details: error.message,
    });
  }
};
async function updatedteFeaturedProductsCache() {
  try {
    const featuredProducts = await Product.find({ isFeatured: true }).lean();
    await redis.set("featured_products", JSON.stringify(featuredProducts));
  } catch (error) {
    console.error("Error updating featured products cache:", error.message);
  }
}
