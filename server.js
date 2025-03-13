const path = require('path');
const express = require('express');
const http = require('http');
const moment = require('moment');
const socketio = require('socket.io');
const cors = require('cors');

const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Middleware
app.use(cors({ origin: '*' })); // Allow all origins
app.use(express.static(path.join(__dirname, 'public')));

// Data structures to manage rooms and sockets
let rooms = {}; // Stores socket IDs in each room
let socketroom = {}; // Maps socket ID to room ID
let socketname = {}; // Maps socket ID to username
let micSocket = {}; // Maps socket ID to mic status
let videoSocket = {}; // Maps socket ID to video status
let roomBoard = {}; // Stores canvas data for each room

io.on('connect', socket => {
    console.log(`New connection: ${socket.id}`);

    // Event: Join Room
    socket.on('join room', (roomid, username) => {
        if (!roomid || !username) {
            console.error('Invalid room ID or username');
            return;
        }

        socket.join(roomid);
        socketroom[socket.id] = roomid;
        socketname[socket.id] = username;
        micSocket[socket.id] = 'on';
        videoSocket[socket.id] = 'on';

        if (rooms[roomid] && rooms[roomid].length > 0) {
            rooms[roomid].push(socket.id);
            socket.to(roomid).emit('message', `${username} joined the room.`, 'Bot', moment().format('h:mm a'));
            io.to(socket.id).emit('join room', rooms[roomid].filter(pid => pid !== socket.id), socketname, micSocket, videoSocket);
        } else {
            rooms[roomid] = [socket.id];
            io.to(socket.id).emit('join room', null, null, null, null);
        }

        io.to(roomid).emit('user count', rooms[roomid].length);
    });

    // Event: Handle Actions (mute/unmute, video on/off)
    socket.on('action', msg => {
        const roomid = socketroom[socket.id];
        if (!roomid) return;

        if (msg === 'mute') micSocket[socket.id] = 'off';
        else if (msg === 'unmute') micSocket[socket.id] = 'on';
        else if (msg === 'videoon') videoSocket[socket.id] = 'on';
        else if (msg === 'videooff') videoSocket[socket.id] = 'off';

        socket.to(roomid).emit('action', msg, socket.id);
    });

    // Event: Video Offer
    socket.on('video-offer', (offer, sid) => {
        socket.to(sid).emit('video-offer', offer, socket.id, socketname[socket.id], micSocket[socket.id], videoSocket[socket.id]);
    });

    // Event: Video Answer
    socket.on('video-answer', (answer, sid) => {
        socket.to(sid).emit('video-answer', answer, socket.id);
    });

    // Event: New ICE Candidate
    socket.on('new icecandidate', (candidate, sid) => {
        socket.to(sid).emit('new icecandidate', candidate, socket.id);
    });

    // Event: Send Message
    socket.on('message', (msg, username, roomid) => {
        io.to(roomid).emit('message', msg, username, moment().format('h:mm a'));
    });

    // Event: Get Canvas Data
    socket.on('getCanvas', () => {
        const roomid = socketroom[socket.id];
        if (roomBoard[roomid]) {
            socket.emit('getCanvas', roomBoard[roomid]);
        }
    });

    // Event: Draw on Canvas
    socket.on('draw', (newx, newy, prevx, prevy, color, size) => {
        const roomid = socketroom[socket.id];
        if (roomid) {
            socket.to(roomid).emit('draw', newx, newy, prevx, prevy, color, size);
        }
    });

    // Event: Clear Canvas
    socket.on('clearBoard', () => {
        const roomid = socketroom[socket.id];
        if (roomid) {
            socket.to(roomid).emit('clearBoard');
        }
    });

    // Event: Store Canvas Data
    socket.on('store canvas', url => {
        const roomid = socketroom[socket.id];
        if (roomid) {
            roomBoard[roomid] = url;
        }
    });

    // Event: Disconnect
    socket.on('disconnect', () => {
        const roomid = socketroom[socket.id];
        if (!roomid) return;

        // Notify room that the user left
        socket.to(roomid).emit('message', `${socketname[socket.id]} left the chat.`, 'Bot', moment().format('h:mm a'));
        socket.to(roomid).emit('remove peer', socket.id);

        // Remove socket from the room
        if (rooms[roomid]) {
            rooms[roomid] = rooms[roomid].filter(id => id !== socket.id);
            io.to(roomid).emit('user count', rooms[roomid].length);

            // Clean up room if empty
            if (rooms[roomid].length === 0) {
                delete rooms[roomid];
                delete roomBoard[roomid];
            }
        }

        // Clean up socket data
        delete socketroom[socket.id];
        delete socketname[socket.id];
        delete micSocket[socket.id];
        delete videoSocket[socket.id];

        console.log(`User disconnected: ${socket.id}`);
    });
});

// Start the server
server.listen(PORT, () => console.log(`Server is up and running on port ${PORT}`));