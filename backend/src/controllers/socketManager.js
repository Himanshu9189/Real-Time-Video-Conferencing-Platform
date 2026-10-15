import { Server } from "socket.io";

let connections = {};
let messages = {};
let timeOnline = {};

export const connectToSocket = (server) => {

    const io = new Server(server, {

        cors: {
            origin: "*",
            methods: ["GET", "POST"],
            allowedHeaders: ["*"],
            credentials: true
        }

    });


    io.on("connection", (socket) => {

        console.log(
            "SOMETHING IS CONNECTED:",
            socket.id
        );


        // =================================================
        // USER JOIN CALL
        // =================================================

        socket.on(
            "join-call",
            (path) => {

                console.log(
                    "USER JOINING CALL:",
                    socket.id,
                    path
                );


                // Create room if it doesn't exist
                if (
                    connections[path] === undefined
                ) {

                    connections[path] = [];
                }


                // Add user to room
                if (
                    !connections[path].includes(
                        socket.id
                    )
                ) {

                    connections[path].push(
                        socket.id
                    );
                }


                // Save online time
                timeOnline[socket.id] =
                    new Date();


                console.log(
                    "ROOM:",
                    path
                );


                console.log(
                    "CLIENTS:",
                    connections[path]
                );


                // =========================================
                // SEND USER JOINED TO EVERYONE
                // =========================================

                connections[path].forEach(
                    (clientId) => {

                        io.to(clientId).emit(
                            "user-joined",

                            socket.id,

                            connections[path]
                        );

                    }
                );


                // =========================================
                // SEND OLD CHAT MESSAGES
                // =========================================

                if (
                    messages[path] !== undefined
                ) {

                    messages[path].forEach(
                        (msg) => {

                            io.to(socket.id).emit(
                                "chat-message",

                                msg.data,

                                msg.sender,

                                msg.socketIdSender
                            );

                        }
                    );
                }
            }
        );


        // =================================================
        // WEBRTC SIGNAL
        // =================================================

        socket.on(
            "signal",
            (
                toId,
                message
            ) => {

                console.log(
                    "SIGNAL:",
                    socket.id,
                    "→",
                    toId
                );


                // Send WebRTC signal directly
                // to the target user

                io.to(toId).emit(
                    "signal",

                    socket.id,

                    message
                );
            }
        );


        // =================================================
        // CHAT MESSAGE
        // =================================================

        socket.on(
            "chat-message",
            (
                data,
                sender
            ) => {

                console.log(
                    "CHAT MESSAGE:",
                    data,
                    sender
                );


                // Find user's room
                let matchingRoom = null;


                for (
                    const [room, clients]
                    of Object.entries(connections)
                ) {

                    if (
                        clients.includes(
                            socket.id
                        )
                    ) {

                        matchingRoom =
                            room;

                        break;
                    }
                }


                if (
                    matchingRoom === null
                ) {

                    return;
                }


                // Create messages array
                if (
                    messages[matchingRoom] ===
                    undefined
                ) {

                    messages[matchingRoom] =
                        [];
                }


                // Save message
                messages[matchingRoom].push({

                    data: data,

                    sender: sender,

                    socketIdSender:
                        socket.id

                });


                // Send message to everyone
                connections[
                    matchingRoom
                ].forEach(
                    (clientId) => {

                        io.to(clientId).emit(
                            "chat-message",

                            data,

                            sender,

                            socket.id
                        );

                    }
                );
            }
        );


        // =================================================
        // DISCONNECT
        // =================================================

        socket.on(
            "disconnect",
            () => {

                console.log(
                    "USER DISCONNECTED:",
                    socket.id
                );


                const startTime =
                    timeOnline[socket.id];


                if (
                    startTime
                ) {

                    const diffTime =
                        Math.abs(
                            startTime -
                            new Date()
                        );


                    console.log(
                        "User online time:",
                        diffTime
                    );
                }


                let roomToRemove = null;


                // Find user's room
                for (
                    const [room, clients]
                    of Object.entries(connections)
                ) {

                    if (
                        clients.includes(
                            socket.id
                        )
                    ) {

                        roomToRemove =
                            room;

                        break;
                    }
                }


                // User was not in a room
                if (
                    roomToRemove === null
                ) {

                    delete timeOnline[
                        socket.id
                    ];

                    return;
                }


                // =========================================
                // TELL OTHER USERS USER LEFT
                // =========================================

                connections[
                    roomToRemove
                ].forEach(
                    (clientId) => {

                        if (
                            clientId !==
                            socket.id
                        ) {

                            io.to(
                                clientId
                            ).emit(
                                "user-left",
                                socket.id
                            );
                        }

                    }
                );


                // =========================================
                // REMOVE USER
                // =========================================

                connections[
                    roomToRemove
                ] =
                    connections[
                        roomToRemove
                    ].filter(
                        (clientId) =>
                            clientId !==
                            socket.id
                    );


                // Delete empty room
                if (
                    connections[
                        roomToRemove
                    ].length === 0
                ) {

                    delete connections[
                        roomToRemove
                    ];

                    delete messages[
                        roomToRemove
                    ];
                }


                // Delete online time
                delete timeOnline[
                    socket.id
                ];


                console.log(
                    "REMAINING CLIENTS:",
                    connections[
                        roomToRemove
                    ] || []
                );
            }
        );

    });


    return io;
};