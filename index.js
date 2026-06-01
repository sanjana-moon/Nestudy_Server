const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require('express')
const dotenv = require('dotenv')
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { userInfo } = require("node:os");
const { log } = require("node:console");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
dotenv.config()

const app = express()
const port = process.env.PORT;
const uri = process.env.MONGO_URI;

app.use(cors())
app.use(express.json())

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const JWKS = createRemoteJWKSet(
    new URL("http://localhost:3000/api/auth/jwks")
)

const verifyToken = async (req, res, next) => {
    const authHeader = req?.headers.authorization
    if (!authHeader) {
        return res.status(401).json({ message: "Unauthorized" })
    }
    const token = authHeader.split(" ")[1]
    if (!token) {
        return res.status(401).json({ message: "Unauthorized" })
    }

    try {
        const { payload } = await jwtVerify(token, JWKS,)
        console.log(payload);
        next()
    } catch (error) {
        return res.status(403).json({ message: "Forbidden" })
    }
}

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const db = client.db("nestudy")
        const roomCollection = db.collection("rooms")
        const bookingCollection = db.collection("bookings")

        app.get('/room', async (req, res) => {
            const result = await roomCollection.find().toArray()
            res.json(result)
        })

        app.get('/featured-rooms', async (req, res) => {
            const result = await roomCollection.find().sort({ _id: -1 }).limit(6).toArray();

            res.json(result);
        });

        app.post('/room', async (req, res) => {
            const roomData = req.body;

            const result = await roomCollection.insertOne({
                ...roomData,
                bookedBy: []
            });

            res.json(result)
        });

        app.get('/room/:id', verifyToken, async (req, res) => {
            const { id } = req.params
            const result = await roomCollection.findOne({
                _id: new ObjectId(id)
            })

            res.json(result)
        });

        app.patch('/room/:id', async (req, res) => {
            const { id } = req.params
            const updatedData = req.body

            const result = await roomCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: updatedData }
            )
            res.json(result)
        });

        app.delete('/room/:id', async (req, res) => {
            const { id } = req.params;
            const result = await roomCollection.deleteOne({
                _id: new ObjectId(id)
            })
            res.json(result)
        });

        app.post('/booking', async (req, res) => {
            const bookingData = req.body;

            const existing = await bookingCollection.findOne({
                roomId: bookingData.roomId,
                bookingDate: bookingData.bookingDate,
                status: "confirmed",
                startHour: { $lt: bookingData.endHour },
                endHour: { $gt: bookingData.startHour }
            });

            if (existing) {
                return res.status(400).json({
                    message: "This time slot is already booked"
                });
            }

            const result = await bookingCollection.insertOne({
                ...bookingData,
                status: "confirmed",
                createdAt: new Date()
            });

            await roomCollection.updateOne(
                { _id: new ObjectId(bookingData.roomId) },
                {
                    $addToSet: {
                        bookedBy: bookingData.userId
                    }
                }
            );

            res.json(result);
        });

        app.get('/booking/:userId', async (req, res) => {
            const { userId } = req.params
            const result = await bookingCollection.find({ userId: userId }).toArray()
            res.json(result)
        });

        app.patch('/booking/:id/cancel', async (req, res) => {
            const { id } = req.params;
            const { userId } = req.body;

            const booking = await bookingCollection.findOne({
                _id: new ObjectId(id)
            });

            if (!booking) {
                return res.status(404).json({ error: "Booking not found" });
            }

            if (booking.userId !== userId) {
                return res.status(403).json({ error: "Unauthorized" });
            }

            if (booking.status === "cancelled") {
                return res.status(400).json({ error: "Already cancelled" });
            }

            await Promise.all([
                bookingCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { status: "cancelled" } }
                ),
                roomCollection.updateOne(
                    { _id: new ObjectId(booking.roomId) },
                    { $pull: { bookedBy: booking.userId } }
                )
            ]);

            res.json({ message: "Booking cancelled successfully" });
        });


        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Server running on port ${port}`)
})