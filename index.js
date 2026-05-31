const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require('express')
const dotenv = require('dotenv')
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { userInfo } = require("node:os");
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
            console.log(roomData);
            const result = await roomCollection.insertOne(roomData)

            res.json(result)
        })

        app.get('/room/:id', async (req, res) => {
            const { id } = req.params
            const result = await roomCollection.findOne({ _id: new ObjectId(id) })
            res.json(result)
        })

        app.patch('/room/:id', async (req, res) => {
            const { id } = req.params
            const updatedData = req.body

            const result = await roomCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: updatedData }
            )
            res.json(result)
        })

        app.delete('/room/:id', async (req, res) => {
            const { id } = req.params;
            const result = await roomCollection.deleteOne({
                _id: new ObjectId(id)
            })
            res.json(result)
        })

        app.post('/booking', async (req, res) => {
            const bookingData = req.body;
            const result = await bookingCollection.insertOne(bookingData)

            res.json(result)
        })

        app.get('/booking/:userId', async (req, res) => {
            const { userId } = req.params
            const result = await bookingCollection.find({ userId: userId }).toArray()
            res.json(result)
        })

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