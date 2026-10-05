
const { engine } = require("express-handlebars");
const express = require("express");
const { MongoClient } = require("mongodb");
const dotenv = require("dotenv");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;

// Load .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;


// ============================================
// HANDLEBARS CONFIGURATION
// ============================================

app.engine(
    "handlebars",
    engine({
        defaultLayout: "main"
    })
);

app.set("view engine", "handlebars");
app.set("views", "./src/views");

// ============================================
// EXPRESS MIDDLEWARE
// ============================================

app.use(express.urlencoded({ extended: true }));
app.use(express.json());


// ============================================
// MONGODB CONNECTIONS
// ============================================

// READ connection
const readClient = new MongoClient(
    process.env.MONGO_READ_URI
);

// WRITE connection
const writeClient = new MongoClient(
    process.env.MONGO_WRITE_URI
);


// ============================================
// SESSION CONFIGURATION
// ============================================

app.use(
    session({
        secret: process.env.SESSION_SECRET,

        resave: false,

        saveUninitialized: false,

        store: MongoStore.create({
            mongoUrl: process.env.MONGO_WRITE_URI,
            dbName: process.env.MONGO_DB_NAME,
            collectionName: "sessions"
        }),

        cookie: {
            maxAge: 1000 * 60 * 60
        }
    })
);


// ============================================
// PRODUCT CODE VALIDATION
// ============================================

function validateProductCode(productCode) {

    const mssv = process.env.MSSV;

    const requiredPrefix = mssv.slice(-3);

    return productCode.startsWith(requiredPrefix);
}


// ============================================
// DYNAMIC VAT CALCULATION
// ============================================

function calculateVAT() {

    const mssv = process.env.MSSV;

    const lastDigit = Number(
        mssv.slice(-1)
    );

    return lastDigit + 5;
}


// ============================================
// FINAL PRICE CALCULATION
// ============================================

function calculateFinalPrice(price, vatRate) {

    const vatAmount =
        price * (vatRate / 100);

    const finalPrice =
        price + vatAmount;

    return finalPrice;
}


// ============================================
// STEP 15
// HOME PAGE - READ FROM MONGODB
// ============================================

app.get("/", async (req, res) => {

    try {

        await readClient.connect();

        const db = readClient.db(
            process.env.MONGO_DB_NAME
        );

        const books = await db
            .collection("books")
            .find({})
            .sort({ createdAt: -1 })
            .toArray();

        const vatRate = calculateVAT();

        res.render("home", {
            books: books,
            vatRate: vatRate
        });

    } catch (error) {

        console.error("Error loading books:", error);

        res.status(500).send(
            "Unable to load books."
        );

    }

});
// ============================================
// ADD NEW BOOK
// WRITE OPERATION
// ============================================

app.post("/books", async (req, res) => {

    try {

        const {
            productCode,
            name,
            price
        } = req.body;


        // ------------------------------------
        // Check required fields
        // ------------------------------------

        if (
            !productCode ||
            !name ||
            !price
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Product code, name and price are required."

            });

        }


        // ------------------------------------
        // Validate product code
        // ------------------------------------

        if (
            !validateProductCode(productCode)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid product code. It must start with the last 3 digits of the MSSV."

            });

        }


        // ------------------------------------
        // Calculate VAT
        // ------------------------------------

        const vatRate =
            calculateVAT();


        // ------------------------------------
        // Calculate final price
        // ------------------------------------

        const finalPrice =
            calculateFinalPrice(
                Number(price),
                vatRate
            );


        // ------------------------------------
        // Connect using WRITE account
        // ------------------------------------

        await writeClient.connect();


        const db = writeClient.db(
            process.env.MONGO_DB_NAME
        );


        // ------------------------------------
        // Save book
        // ------------------------------------

        const result = await db
            .collection("books")
            .insertOne({

                productCode: productCode,

                name: name,

                originalPrice:
                    Number(price),

                vatRate: vatRate,

                finalPrice: finalPrice,

                createdAt: new Date()

            });


        // ------------------------------------
        // Return result
        // ------------------------------------

        res.status(201).json({

            success: true,

            message:
                "Book added successfully.",

            bookId:
                result.insertedId,

            productCode:
                productCode,

            originalPrice:
                Number(price),

            vatRate:
                vatRate,

            finalPrice:
                finalPrice

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

});


// ============================================
// TEST SESSION
// ============================================

app.get("/session-test", (req, res) => {

    if (!req.session.visits) {

        req.session.visits = 0;

    }

    req.session.visits++;


    res.json({

        message:
            "Session is working",

        sessionID:
            req.sessionID,

        visits:
            req.session.visits

    });

});


// ============================================
// TEST READ CONNECTION
// ============================================

app.get("/test-read", async (req, res) => {

    try {

        await readClient.connect();

        const db = readClient.db(
            process.env.MONGO_DB_NAME
        );

        const books = await db
            .collection("books")
            .find({})
            .toArray();


        res.json({

            success: true,

            account: "READ",

            books: books

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            error:
                error.message

        });

    }

});


// ============================================
// TEST WRITE CONNECTION
// ============================================

app.post("/test-write", async (req, res) => {

    try {

        await writeClient.connect();

        const db = writeClient.db(
            process.env.MONGO_DB_NAME
        );


        const result = await db
            .collection("books")
            .insertOne({

                name: "Test Book",

                createdAt:
                    new Date()

            });


        res.json({

            success: true,

            account: "WRITE",

            insertedId:
                result.insertedId

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            error:
                error.message

        });

    }

});


// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => { console.log(` ==================================== 
    Book Management Application ====================================
    Server running at: http://localhost:${PORT} `);
});

