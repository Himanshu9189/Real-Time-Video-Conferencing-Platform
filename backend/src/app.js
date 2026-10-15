import express, { urlencoded } from "express";
import {createServer} from "node:http";

import { Server } from "socket.io";
import mongoose, { mongo } from "mongoose";
import { connectToSocket } from "./controllers/socketManager.js";
import cors from "cors";
import { connect } from "node:http2";
import userRoutes from "./routes/users.routes.js";

const app = express();
const server = createServer(app);
const io = connectToSocket(server);

app.set("port",(process.env.PORT ||8000))
app.use(cors());
app.use(express.json({limit: "40kb"}));
app.use(express.urlencoded({limit:"40kb",extended:"true"}));
app.use("/api/v1/users",userRoutes);

const start = async () =>{
    app.set("mongo_user")
    const connectionDb = await mongoose.connect("mongodb+srv://hs8360182_db_user:wiVrTUunFpA4MBIj@cluster0.mdqdudc.mongodb.net/"); 
    console.log(`MONGO CONNECTED TO DB HOst: ${connectionDb.connection.host}`)
    server.listen(app.get("port"), ()=>{
        console.log("LISTENING ON PORT 8000")
    });
}
start();