const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

const jwtVerify = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: "Error 401 - Unauthorized!" });
    }
    const token = authHeader.split(" ")[1];

    jwt.verify(token, process.env.JWT_ACCESS_TOKEN, async (err, decoded) => {
        if (err) {
            return res.status(403).send({ message: "Error 403 - Forbidden" });
        }
        req.decoded = decoded;
        await next();
    });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.ssehx4e.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

const run = async () => {
    try {
        await client.connect();

        // Inventory Collections
        const inventoriesCollection = client.db("easyStock").collection("inventories");

        // Feature Collections
        const featuresCollection = client.db("easyStock").collection("features");

        // Authentication by JWT

        app.post("/login", async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.JWT_ACCESS_TOKEN, {
                expiresIn: "1d",
            });
            res.send({ token });
        });

        // get inventories from mongo database
        app.get("/inventories", async (req, res) => {
            const page = parseInt(req.query.page);
            const size = parseInt(req.query.size);
            const cursor = inventoriesCollection.find({}).sort({ _id: -1 });

            let items;

            if (page || size) {
                items = await cursor
                    .skip(page * size)
                    .limit(size || 5)
                    .toArray();
            } else {
                items = await cursor.toArray();
            }

            res.send(items);
        });

        // counts total number of items
        app.get("/numberOfItems", async (req, res) => {
            const count = await inventoriesCollection.estimatedDocumentCount({});
            res.json({ count });
        });

        // get my inventories filter by email.
        app.get("/myInventories", jwtVerify, async (req, res) => {
            const decodedEmail = req.decoded.email;
            const email = req.query.email;

            try {
                const query = { email: decodedEmail };
                const cursor = inventoriesCollection.find(query).sort({ _id: -1 });
                const inventories = await cursor.toArray();
                res.send(inventories);
            } catch (error) {
                res.status(403).send({ message: "Error 403 - Forbidden" });
            }
        });

        // get inventory details by inventory _id
        app.get("/inventory/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const inventory = await inventoriesCollection.findOne(query);
            res.send(inventory);
        });

        // Update stock quantity
        app.put("/update-stock/:id", async (req, res) => {
            const id = req.params.id;
            const updatedInventory = req.body;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updateDoc = {
                $set: updatedInventory,
            };
            const result = await inventoriesCollection.updateOne(filter, updateDoc, options);
            res.send(result);
        });

        // Add Inventory
        app.post("/inventory", async (req, res) => {
            const inventory = req.body;
            const result = await inventoriesCollection.insertOne(inventory);
            res.send(result);
        });

        // Edit Inventory Item
        app.put("/inventory/:id", async (req, res) => {
            const id = req.params.id;

            const updatedInventory = req.body;

            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updateDoc = {
                $set: updatedInventory,
            };
            const result = await inventoriesCollection.updateOne(filter, updateDoc, options);
            res.send(result);
        });

        // Delete Item
        app.delete("/inventory/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await inventoriesCollection.deleteOne(query);
            res.send(result);
        });

        // get Features
        app.get("/features", async (req, res) => {
            const query = {};
            const cursor = featuresCollection.find(query);
            const features = await cursor.toArray();
            res.send(features);
        });
    } finally {
        // await client.close();
    }
};
run().catch(console.dir);

app.get("/", (req, res) => res.send("easyStock server is running.."));

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
