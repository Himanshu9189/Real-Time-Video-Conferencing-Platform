import React, { useEffect, useRef, useState} from "react";
import { useNavigate } from "react-router-dom";
import {
    TextField,
    IconButton,
    Badge
} from "@mui/material";

import { Button } from "@mui/material";

import { io } from "socket.io-client";

import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import CallEndIcon from "@mui/icons-material/CallEnd";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import ChatIcon from "@mui/icons-material/Chat";

import styles from "../styles/videoComponent.module.css";

import server from "../environment";


// =====================================================
// SERVER
// =====================================================

const server_url = server;


// =====================================================
// PEER CONNECTIONS
// =====================================================

let connections = {};


// =====================================================
// WEBRTC CONFIGURATION
// =====================================================

const peerConfigConnections = {

    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        }
    ]

};


// =====================================================
// COMPONENT
// =====================================================

export default function VideoMeetComponent() {
    const navigate = useNavigate();


    // =================================================
    // SOCKET
    // =================================================

    const socketRef = useRef(null);

    const socketIdRef = useRef(null);


    // =================================================
    // LOCAL VIDEO
    // =================================================

    const localVideoref = useRef(null);

    // Reference for every remote video element
    const remoteVideoRefs = useRef({});


    // =================================================
    // STATES
    // =================================================

    const [videoAvailable, setVideoAvailable] =
        useState(true);

    const [audioAvailable, setAudioAvailable] =
        useState(true);


    // IMPORTANT
    // These are BOOLEAN values

    const [video, setVideo] =
        useState(true);

    const [audio, setAudio] =
        useState(true);

    const [screen, setScreen] =
        useState(false);


    const [showModal, setModal] =
        useState(true);


    const [screenAvailable, setScreenAvailable] =
        useState(false);


    // =================================================
    // CHAT
    // =================================================

    const [messages, setMessages] =
        useState([]);

    const [message, setMessage] =
        useState("");

    const [newMessages, setNewMessages] =
        useState(0);


    // =================================================
    // USERNAME
    // =================================================

    const [askForUsername, setAskForUsername] =
        useState(true);

    const [username, setUsername] =
        useState("");


    // =================================================
    // REMOTE VIDEOS
    // =================================================

    const [videos, setVideos] =
        useState([]);


    // =================================================
    // ATTACH REMOTE STREAMS AFTER RENDER
    // =================================================

    useEffect(() => {
        videos.forEach((remoteVideo) => {
            const videoElement =
                remoteVideoRefs.current[remoteVideo.socketId];

            if (
                videoElement &&
                remoteVideo.stream &&
                videoElement.srcObject !== remoteVideo.stream
            ) {
                videoElement.srcObject = remoteVideo.stream;

                videoElement.play().catch((error) => {
                    console.log(
                        "Remote video play error:",
                        error
                    );
                });
            }
        });
    }, [videos]);


    // =================================================
    // GET PERMISSIONS
    // =================================================

    const getPermissions = async () => {

        // ---------------------------------------------
        // CAMERA + MICROPHONE
        // ---------------------------------------------

        try {

            const stream =
                await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true
                });

            if (stream) {

                console.log(
                    "Camera and microphone permission granted"
                );

                setVideoAvailable(true);
                setAudioAvailable(true);

                // Keep the stream so the lobby can show
                // the live camera preview.
                window.localStream = stream;

                if (localVideoref.current) {

                    localVideoref.current.srcObject =
                        stream;

                }
            }

        } catch (error) {

            console.log(
                "Camera/Microphone permission denied:",
                error
            );

            setVideoAvailable(false);
            setAudioAvailable(false);
        }


        // ---------------------------------------------
        // SCREEN SHARE
        // ---------------------------------------------

        if (
            navigator.mediaDevices &&
            navigator.mediaDevices.getDisplayMedia
        ) {

            setScreenAvailable(true);

        } else {

            setScreenAvailable(false);
        }
    };

    // =================================================
    // RUN PERMISSIONS ONCE
    // =================================================

    useEffect(() => {

        getPermissions();

    }, []);


    // =================================================
    // CONNECT BUTTON
    // =================================================

    const getMedia = () => {

        if (
            username.trim() === ""
        ) {

            alert(
                "Please enter your username"
            );

            return;
        }


        console.log(
            "Connecting to meeting..."
        );


        setAskForUsername(false);


        connectToSocketServer();
    };


    // =================================================
    // GET CAMERA + MIC AFTER JOINING
    // =================================================

    useEffect(() => {

        if (
            askForUsername === false
        ) {

            getUserMedia();
        }

    }, [askForUsername]);


    // =================================================
    // GET USER MEDIA
    // =================================================

    const getUserMedia = async () => {

        try {

            console.log(
                "Getting camera and microphone..."
            );


            const stream =
                await navigator.mediaDevices.getUserMedia({

                    video:
                        videoAvailable,

                    audio:
                        audioAvailable
                });


            getUserMediaSuccess(
                stream
            );

        } catch (error) {

            console.log(
                "getUserMedia error:",
                error
            );


            createBlackSilenceStream();
        }
    };
    


    // =================================================
    // USER MEDIA SUCCESS
    // =================================================

    const getUserMediaSuccess = (
        stream
    ) => {

        console.log(
            "LOCAL STREAM:",
            stream
        );


        // ---------------------------------------------
        // STOP OLD CAMERA/MIC STREAM
        // ---------------------------------------------

        try {

            if (
                window.localStream
            ) {

                window.localStream
                    .getTracks()
                    .forEach(
                        (track) => {
                            track.stop();
                        }
                    );
            }

        } catch (error) {

            console.log(
                "Error stopping old stream:",
                error
            );
        }


        // ---------------------------------------------
        // SAVE NEW CAMERA/MIC STREAM
        // ---------------------------------------------

        window.localStream =
            stream;


        // ---------------------------------------------
        // SHOW LOCAL VIDEO
        // ---------------------------------------------

        if (
            localVideoref.current
        ) {

            localVideoref.current.srcObject =
                stream;

            localVideoref.current
                .play()
                .catch(
                    (error) =>
                        console.log(
                            "Local video play error:",
                            error
                        )
                );
        }


        // ---------------------------------------------
        // UPDATE ALL PEERS
        // ---------------------------------------------

        for (
            let id in connections
        ) {

            if (
                id ===
                socketIdRef.current
            ) {

                continue;
            }


            const connection =
                connections[id];


            const senders =
                connection.getSenders();


            let needsRenegotiation =
                false;


            stream
                .getTracks()
                .forEach(
                    (track) => {

                        const sender =
                            senders.find(
                                (sender) =>
                                    sender.track &&
                                    sender.track.kind ===
                                        track.kind
                            );


                        if (
                            sender
                        ) {

                            // replaceTrack() does not require
                            // a new SDP offer.
                            console.log(
                                "Replacing",
                                track.kind,
                                "track for:",
                                id
                            );

                            sender
                                .replaceTrack(
                                    track
                                )
                                .catch(
                                    (error) =>
                                        console.log(
                                            "replaceTrack error:",
                                            error
                                        )
                                );

                        } else {

                            console.log(
                                "Adding new",
                                track.kind,
                                "track for:",
                                id
                            );

                            connection.addTrack(
                                track,
                                stream
                            );

                            needsRenegotiation =
                                true;
                        }

                    }
                );


            // Only addTrack() requires renegotiation.
            if (
                needsRenegotiation
            ) {

                createOffer(id);
            }
        }
    };


    // =================================================
    // SILENCE AUDIO TRACK
    // =================================================

    const silence = () => {

        const audioContext =
            new AudioContext();


        const oscillator =
            audioContext.createOscillator();


        const destination =
            oscillator.connect(
                audioContext
                    .createMediaStreamDestination()
            );


        oscillator.start();


        return Object.assign(

            destination
                .stream
                .getAudioTracks()[0],

            {
                enabled: false
            }

        );
    };


    // =================================================
    // BLACK VIDEO TRACK
    // =================================================

    const black = ({
        width = 640,
        height = 480
    } = {}) => {

        const canvas =
            document.createElement(
                "canvas"
            );


        canvas.width =
            width;

        canvas.height =
            height;


        const context =
            canvas.getContext(
                "2d"
            );


        context.fillRect(
            0,
            0,
            width,
            height
        );


        const stream =
            canvas.captureStream();


        return Object.assign(

            stream
                .getVideoTracks()[0],

            {
                enabled: false
            }

        );
    };


    // =================================================
    // CREATE BLACK + SILENCE STREAM
    // =================================================

    const createBlackSilenceStream = () => {

        const stream =
            new MediaStream([
                black(),
                silence()
            ]);


        window.localStream =
            stream;


        if (
            localVideoref.current
        ) {

            localVideoref.current.srcObject =
                stream;
        }
    };


    // =================================================
    // CREATE PEER CONNECTION
    // =================================================

    const createPeerConnection = (
        socketListId
    ) => {

        // ---------------------------------------------
        // DON'T CONNECT TO OURSELF
        // ---------------------------------------------

        if (
            socketListId ===
            socketIdRef.current
        ) {

            return null;
        }


        // ---------------------------------------------
        // DON'T CREATE DUPLICATE CONNECTION
        // ---------------------------------------------

        if (
            connections[socketListId]
        ) {

            console.log(
                "Peer already exists:",
                socketListId
            );

            return connections[
                socketListId
            ];
        }


        console.log(
            "CREATING PEER CONNECTION:",
            socketListId
        );


        // ---------------------------------------------
        // CREATE CONNECTION
        // ---------------------------------------------

        const connection =
            new RTCPeerConnection(
                peerConfigConnections
            );


        connections[socketListId] =
            connection;


        // ---------------------------------------------
        // ICE CANDIDATE
        // ---------------------------------------------

        connection.onicecandidate =
            (event) => {

                if (
                    event.candidate
                ) {

                    socketRef.current.emit(
                        "signal",
                        socketListId,

                        JSON.stringify({
                            ice:
                                event.candidate
                        })
                    );
                }
            };


        // ---------------------------------------------
        // REMOTE VIDEO
        // ---------------------------------------------

        connection.ontrack = (event) => {
            console.log(
                "REMOTE TRACK RECEIVED:",
                socketListId
            );

            const remoteStream =
                event.streams && event.streams[0];

            if (!remoteStream) {
                console.log(
                    "No remote stream received from:",
                    socketListId
                );
                return;
            }

            setVideos((oldVideos) => {
                const existingVideo = oldVideos.find(
                    (video) =>
                        video.socketId === socketListId
                );

                if (existingVideo) {
                    return oldVideos.map((video) =>
                        video.socketId === socketListId
                            ? {
                                ...video,
                                stream: remoteStream
                            }
                            : video
                    );
                }

                console.log(
                    "ADDING REMOTE VIDEO:",
                    socketListId
                );

                return [
                    ...oldVideos,
                    {
                        socketId: socketListId,
                        stream: remoteStream
                    }
                ];
            });
        };


        // ---------------------------------------------
        // ADD LOCAL TRACKS
        // ---------------------------------------------

        if (
            window.localStream
        ) {

            window.localStream
                .getTracks()
                .forEach(
                    (track) => {

                        connection.addTrack(
                            track,
                            window.localStream
                        );
                    }
                );

        } else {

            createBlackSilenceStream();


            if (
                window.localStream
            ) {

                window.localStream
                    .getTracks()
                    .forEach(
                        (track) => {

                            connection.addTrack(
                                track,
                                window.localStream
                            );
                        }
                    );
            }
        }


        return connection;
    };


    // =================================================
    // CREATE OFFER
    // =================================================

    const createOffer = (
        socketListId
    ) => {

        const connection =
            connections[socketListId];


        if (
            !connection
        ) {

            console.log(
                "No connection:",
                socketListId
            );

            return;
        }


        console.log(
            "CREATING OFFER:",
            socketListId
        );


        connection
            .createOffer()
            .then(
                (description) => {

                    return connection
                        .setLocalDescription(
                            description
                        );
                }
            )
            .then(
                () => {

                    socketRef.current.emit(
                        "signal",
                        socketListId,

                        JSON.stringify({
                            sdp:
                                connection.localDescription
                        })
                    );
                }
            )
            .catch(
                (error) => {

                    console.log(
                        "Offer error:",
                        error
                    );
                }
            );
    };


    // =================================================
    // RECEIVE SIGNAL
    // =================================================

    const gotMessageFromServer = async (
        fromId,
        message
    ) => {

        try {

            const signal =
                JSON.parse(message);


            // Don't process our own signal
            if (
                fromId ===
                socketIdRef.current
            ) {

                return;
            }


            const connection =
                connections[fromId];


            if (
                !connection
            ) {

                console.log(
                    "No peer connection for:",
                    fromId
                );

                return;
            }


            // ---------------------------------------------
            // SDP
            // ---------------------------------------------

            if (
                signal.sdp
            ) {

                await connection
                    .setRemoteDescription(
                        new RTCSessionDescription(
                            signal.sdp
                        )
                    );


                // -----------------------------------------
                // RECEIVED OFFER
                // -----------------------------------------

                if (
                    signal.sdp.type ===
                    "offer"
                ) {

                    console.log(
                        "OFFER RECEIVED FROM:",
                        fromId
                    );


                    const answer =
                        await connection
                            .createAnswer();


                    await connection
                        .setLocalDescription(
                            answer
                        );


                    socketRef.current.emit(
                        "signal",
                        fromId,

                        JSON.stringify({
                            sdp:
                                connection.localDescription
                        })
                    );


                    console.log(
                        "ANSWER SENT TO:",
                        fromId
                    );
                }


                // If it is an answer,
                // DON'T send another offer/answer.
            }


            // ---------------------------------------------
            // ICE
            // ---------------------------------------------

            if (
                signal.ice
            ) {

                try {

                    await connection
                        .addIceCandidate(
                            new RTCIceCandidate(
                                signal.ice
                            )
                        );

                } catch (error) {

                    console.log(
                        "ICE candidate error:",
                        error
                    );
                }
            }

        } catch (error) {

            console.log(
                "Signal handling error:",
                error
            );
        }
    };


    // =================================================
    // CHAT
    // =================================================

    let addMessage = ( data,sender, socketIdSender ) => {

        setMessages(
            (oldMessages) => [
                ...oldMessages,
                {
                    data: data,
                    sender: sender
                }

            ]
        );


        if (
            socketIdSender !==
            socketIdRef.current
        ) {

            setNewMessages(
                (old) =>
                    old + 1
            );
        }
    };


    // =================================================
    // CONNECT TO SOCKET SERVER
    // =================================================

    const connectToSocketServer = () => {

        // Don't create second socket
        if (
            socketRef.current
        ) {

            return;
        }


        console.log(
            "Connecting to socket server..."
        );


        socketRef.current =
            io.connect(
                server_url,
                {
                    secure: false
                }
            );


        // ---------------------------------------------
        // SIGNAL LISTENER
        // ---------------------------------------------

        socketRef.current.on(
            "signal",
            gotMessageFromServer
        );


        // ---------------------------------------------
        // SOCKET CONNECTED
        // ---------------------------------------------

        socketRef.current.on(
            "connect",
            () => {

                console.log(
                    "SOCKET CONNECTED:",
                    socketRef.current.id
                );


                // Save our ID
                socketIdRef.current =
                    socketRef.current.id;


                // =====================================
                // USER JOINED
                // =====================================

                socketRef.current.on(
                    "user-joined",
                    (id, clients) => {
                        console.log("USER JOINED:", id);
                        console.log("CLIENTS:", clients);

                        const uniqueClients = [
                            ...new Set(clients)
                        ];

                        // Create a peer connection to every other
                        // participant in this meeting.
                        uniqueClients.forEach((socketListId) => {
                            if (
                                socketListId ===
                                socketIdRef.current
                            ) {
                                return;
                            }

                            createPeerConnection(
                                socketListId
                            );
                        });

                        // The existing participants create an offer
                        // to the newly joined participant.
                        //
                        // If "id" is the new participant's socket id,
                        // the new participant itself does NOT create
                        // the initial offer. This avoids offer collisions.
                        if (
                            id !==
                            socketIdRef.current
                        ) {

                            console.log(
                                "Creating offer for newly joined user:",
                                id
                            );

                            createOffer(
                                id
                            );
                        }
                    }
                );


                // =====================================
                // USER LEFT
                // =====================================

                socketRef.current.on(
                    "user-left",
                    (id) => {

                        console.log(
                            "USER LEFT:",
                            id
                        );


                        // Remove remote video
                        setVideos(
                            (oldVideos) => {

                                return oldVideos.filter(
                                    (video) =>
                                        video.socketId !==
                                        id
                                );
                            }
                        );


                        // Close connection
                        if (
                            connections[id]
                        ) {

                            try {

                                connections[id]
                                    .close();

                            } catch (error) {

                                console.log(
                                    error
                                );
                            }


                            delete connections[id];
                        }
                    }
                );


                // =====================================
                // CHAT
                // =====================================

                socketRef.current.on(
                    "chat-message",
                    addMessage
                );


                // =====================================
                // JOIN CALL
                // =====================================
                //
                // IMPORTANT:
                // THIS MUST BE LAST
                //

                console.log(
                    "JOINING CALL:",
                    window.location.href
                );


                socketRef.current.emit(
                    "join-call",
                    window.location.href
                );
            }
        );
    };


    // =================================================
    // VIDEO ON/OFF
    // =================================================

    const handleVideo = () => {

        const newVideoState =
            !video;


        setVideo(
            newVideoState
        );


        if (
            window.localStream
        ) {

            window.localStream
                .getVideoTracks()
                .forEach(
                    (track) => {

                        track.enabled =
                            newVideoState;
                    }
                );
        }
    };


    // =================================================
    // AUDIO ON/OFF
    // =================================================

    const handleAudio = () => {

        const newAudioState =
            !audio;


        setAudio(
            newAudioState
        );


        if (
            window.localStream
        ) {

            window.localStream
                .getAudioTracks()
                .forEach(
                    (track) => {

                        track.enabled =
                            newAudioState;
                    }
                );
        }
    };


    // =================================================
    // SCREEN SHARE
    // =================================================

    const handleScreen = async () => {

        if (
            !screenAvailable
        ) {

            alert(
                "Screen sharing is not available"
            );

            return;
        }


        // ---------------------------------------------
        // STOP SCREEN SHARE
        // ---------------------------------------------

        if (
            screen
        ) {

            console.log(
                "Stopping screen share..."
            );

            setScreen(false);


            if (
                window.screenStream
            ) {

                window.screenStream
                    .getTracks()
                    .forEach(
                        (track) => {
                            track.stop();
                        }
                    );

                window.screenStream =
                    null;
            }


            // Replace screen track with camera track.
            await getUserMedia();

            return;
        }


        // ---------------------------------------------
        // START SCREEN SHARE
        // ---------------------------------------------

        try {

            console.log(
                "Starting screen share..."
            );


            const screenStream =
                await navigator.mediaDevices
                    .getDisplayMedia({
                        video: true,
                        audio: false
                    });


            const screenTrack =
                screenStream
                    .getVideoTracks()[0];


            if (
                !screenTrack
            ) {

                console.log(
                    "No screen track found"
                );

                return;
            }


            window.screenStream =
                screenStream;


            // -----------------------------------------
            // SHOW SCREEN LOCALLY
            // -----------------------------------------

            if (
                localVideoref.current
            ) {

                localVideoref.current.srcObject =
                    screenStream;

                localVideoref.current
                    .play()
                    .catch(
                        (error) =>
                            console.log(
                                "Local screen play error:",
                                error
                            )
                    );
            }


            // -----------------------------------------
            // SEND SCREEN TO EVERY REMOTE PEER
            // -----------------------------------------

            for (
                let id in connections
            ) {

                if (
                    id ===
                    socketIdRef.current
                ) {

                    continue;
                }


                const connection =
                    connections[id];


                const sender =
                    connection
                        .getSenders()
                        .find(
                            (sender) =>
                                sender.track &&
                                sender.track.kind ===
                                    "video"
                        );


                console.log(
                    "Connection:",
                    id
                );

                console.log(
                    "Video sender:",
                    sender
                );


                if (
                    sender
                ) {

                    console.log(
                        "Replacing camera track with screen track for:",
                        id
                    );


                    await sender
                        .replaceTrack(
                            screenTrack
                        );


                    console.log(
                        "SUCCESS: Screen track sent to:",
                        id
                    );

                } else {

                    console.log(
                        "ERROR: Video sender not found for:",
                        id
                    );
                }
            }


            setScreen(true);


            // -----------------------------------------
            // CHROME'S "STOP SHARING" BUTTON
            // -----------------------------------------

            screenTrack.onended =
                async () => {

                    console.log(
                        "Screen sharing stopped from browser"
                    );


                    setScreen(false);


                    if (
                        window.screenStream
                    ) {

                        window.screenStream =
                            null;
                    }


                    // Restore camera.
                    await getUserMedia();
                };

        } catch (error) {

            console.log(
                "Screen share error:",
                error
            );

            setScreen(false);
        }
    };


    // =================================================
    // SEND CHAT
    // =================================================

    let sendMessage = () => {
        socketRef.current.emit( "chat-message", message,  username
        );


        setMessage("");
    };


    // =================================================
    // END CALL
    // =================================================

    let  handleEndCall = () => {
        try{
            let tracks = localVideoref.current.srcObject.getTracks();
            tracks.forEach(track => track.stop())
        } catch(e){ }

    
    
        // ---------------------------------------------
        // STOP LOCAL STREAM
        // ---------------------------------------------

        try {

            if (
                window.localStream
            ) {

                window.localStream
                    .getTracks()
                    .forEach(
                        (track) => {
                            track.stop();
                        }
                    );
            }


            if (
                window.screenStream
            ) {

                window.screenStream
                    .getTracks()
                    .forEach(
                        (track) => {
                            track.stop();
                        }
                    );
            }

        } catch (error) {

            console.log(error);
        }


        // ---------------------------------------------
        // CLOSE PEERS
        // ---------------------------------------------

        for (
            let id in connections
        ) {

            try {

                connections[id]
                    .close();

            } catch (error) {

                console.log(error);
            }
        }


        connections = {};


        // ---------------------------------------------
        // REMOVE REMOTE VIDEOS
        // ---------------------------------------------

        setVideos([]);


        // ---------------------------------------------
        // DISCONNECT SOCKET
        // ---------------------------------------------

        if (
            socketRef.current
        ) {

            socketRef.current.disconnect();

            socketRef.current =
                null;
        }


        socketIdRef.current =
            null;
            console.log("TOKEN BEFORE NAVIGATE:", localStorage.getItem("token"));
            // ⭐ GO TO HOME
    navigate("/home");
};



    // =================================================
    // CLEANUP
    // =================================================

    useEffect(() => {

        return () => {

            try {

                if (
                    window.localStream
                ) {

                    window.localStream
                        .getTracks()
                        .forEach(
                            (track) => {
                                track.stop();
                            }
                        );
                }


                for (
                    let id in connections
                ) {

                    try {

                        connections[id]
                            .close();

                    } catch (error) {

                        console.log(error);
                    }
                }


                connections = {};
                remoteVideoRefs.current = {};
                setVideos([]);


                if (
                    socketRef.current
                )

                    socketRef.current
                        .disconnect();
                

            } catch (error) {

                console.log(error);
            }
        };

    }, []);


    // =================================================
    // JSX
    // =================================================

    return (

        <div>

            {/* =========================================
                USERNAME SCREEN
            ========================================== */}

            {
                askForUsername
                    ?

                    <div>

                        <h2>
                            Enter into Lobby
                        </h2>


                        <TextField
                            id="outlined-basic"
                            label="Username"
                            variant="outlined"

                            value={
                                username
                            }

                            onChange={
                                (e) =>
                                    setUsername(
                                        e.target.value
                                    )
                            }
                        />


                        <Button
                            variant="contained"
                            onClick={
                                getMedia
                            }
                        >
                            Connect
                        </Button>


                        <div>

                            <video
                                ref={localVideoref}
                                autoPlay
                                muted
                                playsInline
                                style={{
                                    width: "400px",
                                    height: "300px",
                                    objectFit: "cover",
                                    
                                    borderRadius: "10px"
                                }}
                            />

                        </div>

                    </div>

                    :

                    /* =================================
                       MEETING SCREEN
                    ================================== */

                    <div
                        className={styles.meetVideoContainer  } >
                            
                            {showModal ? <div className={styles.chatRoom}>
                                <div className={styles.chatContainer}>
                                    <h1>Chat</h1>
                                    <div className={styles.chattingDisplay}>
                                        {messages.map((item,index)=>{
                                            return(
                                                <div style={{margin:"bottom"}} key={index}>
                                                    <p style={{fontWeight:"bold"}}>{item.sender}</p>
                                                    <p>{item.data}</p>
                                                </div>
                                            )
                                        })}

                                    </div>

                                    <div className={styles.chattingArea}>
                                    <TextField value={message} onChange={e => setMessage(e.target.value)} id="outlined-basic" label="Enter your Chat" variant="outlined" />
                                    <Button variant='contained' onClick={sendMessage}>Send</Button>
                                    </div>
                                    </div>
                                </div> :<></> }
                    

                    
                    

                        {/* =================================
                            BUTTONS
                        ================================== */}

                        <div
                            className={
                                styles.buttonContainers
                            }
                        >

                            {/* VIDEO */}

                            <IconButton
                                onClick={
                                    handleVideo
                                }

                                style={{
                                    color:
                                        "white"
                                }}
                            >

                                {
                                    video
                                        ?

                                        <VideocamIcon />

                                        :

                                        <VideocamOffIcon />
                                }

                            </IconButton>


                            {/* END CALL */}

                            <IconButton
                                onClick={
                                    handleEndCall
                                }

                                style={{
                                    color:
                                        "red"
                                }}
                            >

                                <CallEndIcon />

                            </IconButton>


                            {/* AUDIO */}

                            <IconButton
                                onClick={
                                    handleAudio
                                }

                                style={{
                                    color:
                                        "white"
                                }}
                            >

                                {
                                    audio
                                        ?

                                        <MicIcon />

                                        :

                                        <MicOffIcon />
                                }

                            </IconButton>


                            {/* SCREEN SHARE */}

                            {
                                screenAvailable
                                    ?

                                    <IconButton
                                        onClick={
                                            handleScreen
                                        }

                                        style={{
                                            color:
                                                "white"
                                        }}
                                    >

                                        {
                                            screen
                                                ?

                                                <StopScreenShareIcon />

                                                :

                                                <ScreenShareIcon />
                                        }

                                    </IconButton>

                                    :

                                    null
                            }


                            {/* CHAT */}

                            <Badge
                                badgeContent={
                                    newMessages
                                }

                                max={
                                    999
                                }

                                color="secondary"
                            >

                                <IconButton
                                    onClick={() => {

                                        setModal(
                                            !showModal
                                        );

                                        setNewMessages(
                                            0
                                        );

                                    }}

                                    style={{
                                        color:
                                            "white"
                                    }}
                                >

                                    <ChatIcon />

                                </IconButton>

                            </Badge>

                        </div>


                        {/* =================================
                            YOUR LOCAL VIDEO
                        ================================== */}

                        <video
                            className={
                                styles.meetUserVideo
                            }

                            ref={
                                localVideoref
                            }

                            autoPlay
                            muted
                            playsInline
                        />


                        {/* =================================
                            REMOTE VIDEOS
                        ================================== */}

                        <div
                            className={
                                styles.conferenceView
                            }
                        >

                            {
                                videos.map(
                                    (remoteVideo) => (

                                        <div
                                            key={
                                                remoteVideo.socketId
                                            }

                                            className={
                                                styles.remoteVideoContainer
                                            }
                                        >

                                            <video
                                                className={
                                                    styles.remoteVideo
                                                }

                                                data-socket={
                                                    remoteVideo.socketId
                                                }

                                                ref={
                                                    (element) => {

                                                        if (element) {

                                                            remoteVideoRefs.current[
                                                                remoteVideo.socketId
                                                            ] = element;

                                                        } else {

                                                            delete remoteVideoRefs.current[
                                                                remoteVideo.socketId
                                                            ];

                                                        }

                                                    }
                                                }

                                                autoPlay
                                                playsInline
                                            />

                                        </div>

                                    )
                                )
                            }

                        </div>
                    </div>                  
 
                        }
            
</div>
    );
    }
