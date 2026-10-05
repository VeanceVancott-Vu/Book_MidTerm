const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema({
    productCode: {
        type: String,
        required: true
    },

    name: {
        type: String,
        required: true
    },

    price: {
        type: Number,
        required: true
    },

    vatRate: {
        type: Number,
        required: true
    },

    finalPrice: {
        type: Number,
        required: true
    }
});

module.exports = mongoose.model("Book", bookSchema, "books");