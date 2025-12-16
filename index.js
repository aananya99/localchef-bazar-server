const express = require("express");
require("dotenv").config();
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 3000;

// firebase admin sdk
const admin = require("firebase-admin");

const serviceAccount = require("./localchef-bazar-project-firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// middleware
app.use(express.json());
app.use(cors());

// verify token
const verifyFBToken = async (req, res, next) => {
  console.log("headers in the middleware", req.headers.authorization);
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  try {
    const idToken = token.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    console.log("decoded in the token", decoded);
    req.decoded_email = decoded.email;
    next();
  } catch {
    return res.status(401).send({ message: "unauthorized access" });
  }
};
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.0rghqsk.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const db = client.db("localchef_user");
    const mealsCollection = db.collection("meals");
    const reviewsCollection = db.collection("reviews");
    const ordersCollection = db.collection("orders");
    const favoriteCollection = db.collection("favorites");
    const usersCollection = db.collection("users");
    const requestsCollection = db.collection("requests");

    // --------users api--------
    // 11
    app.post("/users", async (req, res) => {
      const user = req.body;
      user.role = "user";
      user.status = "active";
      user.createdAt = new Date();

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
    // 12
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.findOne({ email });
      res.send(result);
    });
    // 16.
    app.get("/users/:email/role", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send({ role: user?.role || "user" });
    });
    // ------requests api-------
    // 13.
    app.post("/requests", async (req, res) => {
      const request = req.body;
      const result = await requestsCollection.insertOne(request);
      res.send(result);
    });
    // 14.
    app.get("/requests", async (req, res) => {
      const request = await requestsCollection.find().toArray();
      res.send(request);
    });
    // 15.
    app.patch("/requests/:id", async (req, res) => {
      const { requestStatus } = req.body;
      const id = req.params.id;

      // find request first
      const request = await requestsCollection.findOne({
        _id: new ObjectId(id),
      });

      if (!request) {
        return res.status(404).send({ message: "Request not found" });
      }

      // update request status
      await requestsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { requestStatus } }
      );

      // if approved → update user role
      if (requestStatus === "approved") {
        const updateUserDoc = {};

        if (request.requestType === "chef") {
          const chefId = `chef-${Math.floor(1000 + Math.random() * 9000)}`;
          updateUserDoc.role = "chef";
          updateUserDoc.chefId = chefId;
        }

        if (request.requestType === "admin") {
          updateUserDoc.role = "admin";
        }

        await usersCollection.updateOne(
          { email: request.userEmail },
          { $set: updateUserDoc }
        );
      }

      res.send({ success: true });
    });

    // --------meals api----------
    // 01.
    app.get("/meals", async (req, res) => {
      const result = await mealsCollection.find().toArray();
      res.send(result);
    });

    // 03.
    app.get("/meals/:id", async (req, res) => {
      const { id } = req.params;
      const objectId = new ObjectId(id);
      const result = await mealsCollection.findOne({ _id: objectId });
      res.send(result);
    });

    // 16.
    app.post("/meals", async (req, res) => {
      const meal = req.body;
      meal.createdAt = new Date();
      const result = await mealsCollection.insertOne(meal);
      res.send(result);
    });
    // 17.
    app.get("/meals/chef/:email", async (req, res) => {
      const email = req.params.email;
      const result = await mealsCollection.find({ userEmail: email }).toArray();
      res.send(result);
    });
    // 18
    app.delete("/meals/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await mealsCollection.deleteOne(query);
      res.send(result);
    });
    // 19.
    app.put("/meals/:id", async (req, res) => {
      const id = req.params.id;
      const updatedMeal = req.body;

      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          foodName: updatedMeal.foodName,
          price: updatedMeal.price,
          ingredients: updatedMeal.ingredients,
          estimatedDeliveryTime: updatedMeal.estimatedDeliveryTime,
          chefExperience: updatedMeal.chefExperience,
        },
      };

      const result = await mealsCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // ----------review api---------------
    // 02.
    app.get("/all-reviews", async (req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.send(result);
    });
    // 10.my reviews
    app.get("/reviews", async (req, res) => {
      const email = req.query.email;
      const result = await reviewsCollection
        .find({ userEmail: email })
        .toArray();
      res.send(result);
    });
    // 09.
    app.post("/reviews", async (req, res) => {
      const review = req.body;
      const result = await reviewsCollection.insertOne(review);
      res.send(result);
    });
    // -----------orders api---------
    // 04.
    app.post("/orders", async (req, res) => {
      const order = req.body;
      const result = await ordersCollection.insertOne(order);
      res.send(result);
    });
    // 05.
    app.get("/orders", verifyFBToken, async (req, res) => {
      const email = req.query.email;
      // console.log("headers", req.headers);
      const result = await ordersCollection
        .find({ userEmail: email })
        .toArray();
      res.send(result);
    });
    // ---- favorites api-----------
    // 06.
    app.post("/favorites", async (req, res) => {
      const { userEmail, mealId } = req.body;
      const exists = await favoriteCollection.findOne({
        userEmail,
        mealId,
      });
      if (exists) {
        return res.status(409).send({ message: "Meal already favourited" });
      }
      const favorite = req.body;

      const result = await favoriteCollection.insertOne(favorite);
      res.send(result);
    });

    // 07.
    app.get("/favorites", async (req, res) => {
      const email = req.query.email;
      if (!email) {
        return res.status(400).send({ message: "Email is required" });
      }
      const result = await favoriteCollection
        .find({ userEmail: email })
        .toArray();
      res.send(result);
    });

    // 08.
    app.delete("/favorites/:id", async (req, res) => {
      const id = req.params.id;
      const result = await favoriteCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("localchef bazar");
});

app.listen(port, () => {
  console.log(`localchef bazar server is running on port ${port}`);
});
