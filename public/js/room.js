const socket = io();
const myVideo = document.querySelector("#vd1");
const roomId = new URLSearchParams(location.search).get("room");
let username;
const chatRoom = document.querySelector('.chat-cont');
const sendButton = document.querySelector('.chat-send');
const messageField = document.querySelector('.chat-input');
const videoContainer = document.querySelector('#vcont');
const overlayContainer = document.querySelector('#overlay');
const continueButton = document.querySelector('.continue-name');
const nameField = document.querySelector('#name-field');
const videoButton = document.querySelector('.novideo');
const audioButton = document.querySelector('.audio');
const cutCallButton = document.querySelector('.cutcall');
const screenShareButton = document.querySelector('.screenshare');
const whiteboardButton = document.querySelector('.board-icon');
const attendeesContainer = document.querySelector('.attendees-cont');
const tabButtons = document.querySelectorAll('.tab-button');
const mobileMenuButtons = document.querySelectorAll('.mobile-menu-button');

// Whiteboard elements and variables
const whiteboardContainer = document.querySelector('.whiteboard-cont');
const canvas = document.querySelector("#whiteboard");
const ctx = canvas.getContext('2d');
let isWhiteboardVisible = false;
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let currentColor = "black";
let currentSize = 3;
let remoteColor = "black";
let remoteSize = 3;

// Connection variables
const configuration = { iceServers: [{ urls: "stun:stun.stunprotocol.org" }] };
const mediaConstraints = { video: true, audio: true };
let connections = {};
let cName = {};
let micInfo = {};
let videoInfo = {};
let audioTrackSent = {};
let videoTrackSent = {};
let myStream, myScreenShare;
let videoAllowed = true;
let audioAllowed = true;
let currentView = 'video'; // Options: video, chat, attendees, whiteboard

// UI elements
const myMuteIcon = document.querySelector("#mymuteicon");
const myVideoOff = document.querySelector("#myvideooff");
myMuteIcon.style.visibility = 'hidden';
myVideoOff.style.visibility = 'hidden';

// Display room code
document.querySelector('.roomcode').innerHTML = roomId || 'Invalid Room';

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    initializeWhiteboard();
    setupEventListeners();
    checkMobileScreen();
    window.addEventListener('resize', checkMobileScreen);
});

// Initialize whiteboard
function initializeWhiteboard() {
    // Make sure the style is initially hidden but exists in the DOM flow
    whiteboardContainer.style.visibility = 'hidden';
    whiteboardContainer.style.display = 'none';
    
    // Set initial canvas properties
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = currentSize;
    ctx.strokeStyle = currentColor;
    
    // Whiteboard event listeners
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', stopDrawing);
    
    // Touch support for whiteboard
    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchmove', handleTouchMove);
    canvas.addEventListener('touchend', stopDrawing);
}

function fitCanvasToContainer(canvas) {
    // Get the container's computed dimensions
    const width = whiteboardContainer.clientWidth - 48; // Account for padding
    const height = whiteboardContainer.clientHeight - 48; // Account for padding
    
    // Set canvas display size (css pixels)
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    
    // Set canvas drawing buffer size (actual pixels)
    // Use a scale factor for higher resolution (optional)
    const scale = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * scale);
    canvas.height = Math.floor(height * scale);
    
    // Normalize coordinate system to use css pixels
    ctx.scale(scale, scale);
}

// Event listeners
function setupEventListeners() {
    // Name entry
    continueButton.addEventListener('click', handleNameSubmit);
    nameField.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleNameSubmit();
    });
    
    // Copy room code button
    document.querySelector('.copycode-button').addEventListener('click', copyRoomCode);
    
    // Control buttons
    audioButton.addEventListener('click', toggleAudio);
    videoButton.addEventListener('click', toggleVideo);
    screenShareButton.addEventListener('click', toggleScreenShare);
    whiteboardButton.addEventListener('click', toggleWhiteboard);
    cutCallButton.addEventListener('click', endCall);
    
    // Chat functions
    sendButton.addEventListener('click', sendMessage);
    messageField.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    
    // Tab navigation
    if (tabButtons) {
        tabButtons.forEach(button => {
            button.addEventListener('click', () => switchTab(button.dataset.target));
        });
    }
    
    // Mobile menu
    if (mobileMenuButtons) {
        mobileMenuButtons.forEach(button => {
            button.addEventListener('click', () => switchMobileView(button.dataset.target));
        });
    }
}

// Handle name submission
function handleNameSubmit() {
    if (nameField.value.trim() === '') return;
    
    username = nameField.value.trim();
    overlayContainer.style.visibility = 'hidden';
    document.querySelector("#myname").innerHTML = `${username} (You)`;
    
    // Join room
    socket.emit("join room", roomId, username);
    
    // Update attendees list with current user
    updateAttendeesView();
}

// Copy room code to clipboard
function copyRoomCode() {
    const textToCopy = document.querySelector('.roomcode');
    let currentRange;
    
    if (document.getSelection().rangeCount > 0) {
        currentRange = document.getSelection().getRangeAt(0);
        window.getSelection().removeRange(currentRange);
    } else {
        currentRange = false;
    }

    const copyRange = document.createRange();
    copyRange.selectNode(textToCopy);
    window.getSelection().addRange(copyRange);
    document.execCommand("copy");

    window.getSelection().removeRange(copyRange);
    if (currentRange) {
        window.getSelection().addRange(currentRange);
    }

    const copyButton = document.querySelector(".copycode-button");
    copyButton.textContent = "Copied!";
    setTimeout(() => {
        copyButton.textContent = "Copy Code";
    }, 3000);
}

// Check if screen is mobile and adjust UI
function checkMobileScreen() {
    const isMobile = window.innerWidth <= 768;
    document.body.classList.toggle('mobile-view', isMobile);
    
    if (isMobile) {
        // Default to video view on mobile
        switchMobileView('video');
    }
}

// Switch between views on mobile
function switchMobileView(targetView) {
    currentView = targetView;
    
    // Hide all containers
    document.querySelectorAll('.view-container').forEach(container => {
        container.style.display = 'none';
    });
    
    // Show selected container
    const targetContainer = document.querySelector(`.${targetView}-container`);
    if (targetContainer) {
        targetContainer.style.display = 'flex';
    }
    
    // Update active button
    mobileMenuButtons.forEach(button => {
        button.classList.toggle('active', button.dataset.target === targetView);
    });
}

// Switch between tabs
function switchTab(targetTab) {
    tabButtons.forEach(button => {
        button.classList.toggle('active', button.dataset.target === targetTab);
    });
    
    // Update content based on selected tab
    if (targetTab === 'chat') {
        document.querySelector('.chat-section').style.display = 'flex';
        document.querySelector('.attendees-section').style.display = 'none';
    } else if (targetTab === 'attendees') {
        document.querySelector('.chat-section').style.display = 'none';
        document.querySelector('.attendees-section').style.display = 'flex';
        updateAttendeesView();
    }
}

// Update the attendees list view
function updateAttendeesView() {
    if (!attendeesContainer) return;
    
    attendeesContainer.innerHTML = '';
    
    // Add current user first
    const currentUserElement = document.createElement('div');
    currentUserElement.className = 'attendee-item';
    currentUserElement.innerHTML = `
        <div class="attendee-name">${username} (You)</div>
        <div class="attendee-status">
            <span class="host-badge">Host</span>
        </div>
    `;
    attendeesContainer.appendChild(currentUserElement);
    
    // Add all other connected users
    for (let sid in cName) {
        if (cName[sid]) {
            const userElement = document.createElement('div');
            userElement.className = 'attendee-item';
            userElement.innerHTML = `
                <div class="attendee-name">${cName[sid]}</div>
                <div class="attendee-status">
                    <i class="fas fa-${micInfo[sid] === 'on' ? 'microphone' : 'microphone-slash'}"></i>
                    <i class="fas fa-${videoInfo[sid] === 'on' ? 'video' : 'video-slash'}"></i>
                </div>
            `;
            attendeesContainer.appendChild(userElement);
        }
    }
}

// Send chat message
function sendMessage() {
    const msg = messageField.value.trim();
    if (!msg) return;
    
    messageField.value = '';
    socket.emit('message', msg, username, roomId);
}

// Whiteboard functions
function startDrawing(e) {
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    lastX = e.clientX - rect.left;
    lastY = e.clientY - rect.top;
}

function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    lastX = touch.clientX - rect.left;
    lastY = touch.clientY - rect.top;
    isDrawing = true;
}

function handleTouchMove(e) {
    if (!isDrawing) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const currX = touch.clientX - rect.left;
    const currY = touch.clientY - rect.top;
    
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentSize;
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(currX, currY);
    ctx.stroke();
    
    // Send drawing data to others
    socket.emit('draw', currX, currY, lastX, lastY, currentColor, currentSize);
    
    [lastX, lastY] = [currX, currY];
    
    // Store canvas state for new joiners
    socket.emit('store canvas', canvas.toDataURL());
}

function draw(e) {
    if (!isDrawing) return;
    
    const rect = canvas.getBoundingClientRect();
    const currX = e.clientX - rect.left;
    const currY = e.clientY - rect.top;
    
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(currX, currY);
    ctx.stroke();
    
    // Send drawing data to others
    socket.emit('draw', currX, currY, lastX, lastY, currentColor, currentSize);
    
    [lastX, lastY] = [currX, currY];
}

function stopDrawing() {
    isDrawing = false;
}

function setColor(newColor) {
    currentColor = newColor;
    currentSize = 3;
}

function setEraser() {
    currentColor = "white";
    currentSize = 10;
}

function clearBoard() {
    if (window.confirm('Are you sure you want to clear the whiteboard? This cannot be undone.')) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        socket.emit('store canvas', canvas.toDataURL());
        socket.emit('clearBoard');
    }
}

// Toggle whiteboard visibility
function toggleWhiteboard() {
    isWhiteboardVisible = !isWhiteboardVisible;
    
    if (isWhiteboardVisible) {
        whiteboardContainer.style.visibility = 'visible';
        whiteboardContainer.style.display = 'block'; // Add display block
        fitCanvasToContainer(canvas);
    } else {
        whiteboardContainer.style.visibility = 'hidden';
        whiteboardContainer.style.display = 'none'; // Hide display
    }
}

// Toggle audio
function toggleAudio() {
    audioAllowed = !audioAllowed;
    
    // Update UI
    if (audioAllowed) {
        audioButton.innerHTML = `<i class="fas fa-microphone"></i>`;
        audioButton.style.backgroundColor = "#4ECCA3";
        myMuteIcon.style.visibility = 'hidden';
        socket.emit('action', 'unmute');
    } else {
        audioButton.innerHTML = `<i class="fas fa-microphone-slash"></i>`;
        audioButton.style.backgroundColor = "#b12c2c";
        myMuteIcon.style.visibility = 'visible';
        socket.emit('action', 'mute');
    }
    
    // Update audio tracks
    for (let key in audioTrackSent) {
        audioTrackSent[key].enabled = audioAllowed;
    }
    
    if (myStream) {
        myStream.getTracks().forEach(track => {
            if (track.kind === 'audio') {
                track.enabled = audioAllowed;
            }
        });
    }
    
    // Update attendees list
    updateAttendeesView();
}

// Toggle video
function toggleVideo() {
    videoAllowed = !videoAllowed;
    
    // Update UI
    if (videoAllowed) {
        videoButton.innerHTML = `<i class="fas fa-video"></i>`;
        videoButton.style.backgroundColor = "#4ECCA3";
        myVideoOff.style.visibility = 'hidden';
        socket.emit('action', 'videoon');
    } else {
        videoButton.innerHTML = `<i class="fas fa-video-slash"></i>`;
        videoButton.style.backgroundColor = "#b12c2c";
        myVideoOff.style.visibility = 'visible';
        socket.emit('action', 'videooff');
    }
    
    // Update video tracks
    for (let key in videoTrackSent) {
        videoTrackSent[key].enabled = videoAllowed;
    }
    
    if (myStream) {
        myStream.getTracks().forEach(track => {
            if (track.kind === 'video') {
                track.enabled = videoAllowed;
            }
        });
    }
    
    // Reapply the mirrored effect if video is toggled back on
    if (videoAllowed) {
        myVideo.classList.add('mirrored-video');
    }
    
    // Update attendees list
    updateAttendeesView();
}   

// Toggle screen sharing
function toggleScreenShare() {
    if (!screenshareEnabled) {
        startScreenShare();
    } else {
        stopScreenShare();
    }
}

let screenshareEnabled = false;

function startScreenShare() {
    let screenMediaPromise;
    
    if (navigator.getDisplayMedia) {
        screenMediaPromise = navigator.getDisplayMedia({ video: true });
    } else if (navigator.mediaDevices.getDisplayMedia) {
        screenMediaPromise = navigator.mediaDevices.getDisplayMedia({ video: true });
    } else {
        screenMediaPromise = navigator.mediaDevices.getUserMedia({
            video: { mediaSource: "screen" },
        });
    }
    
    screenMediaPromise
        .then((screenStream) => {
            screenshareEnabled = true;
            myScreenShare = screenStream;
            
            // Replace video tracks
            for (let key in connections) {
                const sender = connections[key]
                    .getSenders()
                    .find((s) => (s.track ? s.track.kind === "video" : false));
                
                if (sender) {
                    sender.replaceTrack(screenStream.getVideoTracks()[0]);
                }
            }
            
            // Update local video display
            screenStream.getVideoTracks()[0].enabled = true;
            const newStream = new MediaStream([
                screenStream.getVideoTracks()[0],
            ]);
            myVideo.srcObject = newStream;
            myVideo.muted = true;
            
            // Update UI
            screenShareButton.innerHTML = `<i class="fas fa-desktop"></i><span class="tooltiptext">Stop Share Screen</span>`;
            
            // Handle stream ending
            screenStream.getVideoTracks()[0].onended = function() {
                if (screenshareEnabled) stopScreenShare();
            };
        })
        .catch((e) => {
            alert("Unable to share screen: " + e.message);
            console.error(e);
        });
}

function stopScreenShare() {
    screenshareEnabled = false;
    
    // Restore video from camera
    navigator.mediaDevices.getUserMedia({ video: true })
        .then((cameraStream) => {
            // Replace video tracks back to camera
            for (let key in connections) {
                const sender = connections[key]
                    .getSenders()
                    .find((s) => (s.track ? s.track.kind === "video" : false));
                
                if (sender) {
                    sender.replaceTrack(cameraStream.getVideoTracks()[0]);
                }
            }
            
            // Update local video display
            cameraStream.getVideoTracks()[0].enabled = videoAllowed;
            const newStream = new MediaStream([
                cameraStream.getVideoTracks()[0],
            ]);
            myVideo.srcObject = newStream;
            myVideo.muted = true;
            myStream = newStream;
            
            // Update UI
            screenShareButton.innerHTML = `<i class="fas fa-desktop"></i><span class="tooltiptext">Share Screen</span>`;
            
            // Clean up
            if (myScreenShare) {
                myScreenShare.getTracks().forEach(track => track.stop());
            }
        })
        .catch((e) => {
            console.error('Error switching back to camera:', e);
        });
}

// End call and redirect to home
function endCall() {
    if (confirm('Are you sure you want to leave the meeting?')) {
        // Stop all tracks
        if (myStream) {
            myStream.getTracks().forEach(track => track.stop());
        }
        
        if (myScreenShare) {
            myScreenShare.getTracks().forEach(track => track.stop());
        }
        
        // Close connections
        for (let key in connections) {
            connections[key].close();
        }
        
        // Redirect to home
        window.location.href = '/';
    }
}

// WebRTC connection handling
function startCall() {
    navigator.mediaDevices.getUserMedia(mediaConstraints)
        .then(localStream => {
            myStream = localStream;
            myVideo.srcObject = localStream;
            myVideo.muted = true;

            // Add the mirrored class to your local video element
            myVideo.classList.add('mirrored-video');

            localStream.getTracks().forEach(track => {
                for (let key in connections) {
                    connections[key].addTrack(track, localStream);
                    if (track.kind === 'audio') {
                        audioTrackSent[key] = track;
                    } else {
                        videoTrackSent[key] = track;
                    }
                }
            });
        })
        .catch(error => {
            console.error('Error accessing media devices:', error);
            alert('Could not access your camera or microphone. Please check your permissions.');
        });
}

function handleVideoOffer(offer, sid, cname, micinf, vidinf) {
    cName[sid] = cname;
    micInfo[sid] = micinf;
    videoInfo[sid] = vidinf;
    connections[sid] = new RTCPeerConnection(configuration);

    connections[sid].onicecandidate = function(event) {
        if (event.candidate) {
            socket.emit('new icecandidate', event.candidate, sid);
        }
    };

    connections[sid].ontrack = function(event) {
        if (!document.getElementById(sid)) {
            createVideoElement(sid, event.streams[0]);
        }
    };

    connections[sid].onremovetrack = function() {
        if (document.getElementById(sid)) {
            document.getElementById(sid).remove();
        }
    };

    connections[sid].onnegotiationneeded = function() {
        connections[sid].createOffer()
            .then(function(offer) {
                return connections[sid].setLocalDescription(offer);
            })
            .then(function() {
                socket.emit('video-offer', connections[sid].localDescription, sid);
            })
            .catch(error => console.error('Error creating offer:', error));
    };

    let desc = new RTCSessionDescription(offer);

    connections[sid].setRemoteDescription(desc)
        .then(() => { return navigator.mediaDevices.getUserMedia(mediaConstraints); })
        .then((localStream) => {
            localStream.getTracks().forEach(track => {
                connections[sid].addTrack(track, localStream);
                if (track.kind === 'audio') {
                    audioTrackSent[sid] = track;
                    if (!audioAllowed) {
                        audioTrackSent[sid].enabled = false;
                    }
                } else {
                    videoTrackSent[sid] = track;
                    if (!videoAllowed) {
                        videoTrackSent[sid].enabled = false;
                    }
                }
            });
        })
        .then(() => {
            return connections[sid].createAnswer();
        })
        .then(answer => {
            return connections[sid].setLocalDescription(answer);
        })
        .then(() => {
            socket.emit('video-answer', connections[sid].localDescription, sid);
        })
        .catch(error => console.error('Error handling video offer:', error));
}

function createVideoElement(sid, stream) {
    let vidCont = document.createElement('div');
    let newVideo = document.createElement('video');
    let nameTag = document.createElement('div');
    let muteIcon = document.createElement('div');
    let videoOff = document.createElement('div');
    
    videoOff.classList.add('video-off');
    muteIcon.classList.add('mute-icon');
    nameTag.classList.add('nametag');
    nameTag.innerHTML = `${cName[sid]}`;
    vidCont.id = sid;
    muteIcon.id = `mute${sid}`;
    videoOff.id = `vidoff${sid}`;
    muteIcon.innerHTML = `<i class="fas fa-microphone-slash"></i>`;
    videoOff.innerHTML = 'Video Off';
    vidCont.classList.add('video-box');
    newVideo.classList.add('video-frame');
    newVideo.autoplay = true;
    newVideo.playsinline = true;
    newVideo.id = `video${sid}`;
    newVideo.srcObject = stream;

    // Only apply the mirrored effect to the local video element
    if (sid === 'local') {
        newVideo.classList.add('mirrored-video');
    }

    muteIcon.style.visibility = micInfo[sid] === 'on' ? 'hidden' : 'visible';
    videoOff.style.visibility = videoInfo[sid] === 'on' ? 'hidden' : 'visible';

    vidCont.appendChild(newVideo);
    vidCont.appendChild(nameTag);
    vidCont.appendChild(muteIcon);
    vidCont.appendChild(videoOff);

    videoContainer.appendChild(vidCont);
    
    // Update attendees list
    updateAttendeesView();
}

function handleNewIceCandidate(candidate, sid) {
    var newCandidate = new RTCIceCandidate(candidate);
    connections[sid].addIceCandidate(newCandidate)
        .catch(error => console.error('Error adding ICE candidate:', error));
}

function handleVideoAnswer(answer, sid) {
    const ans = new RTCSessionDescription(answer);
    connections[sid].setRemoteDescription(ans);
}

// Socket events
socket.on('video-offer', handleVideoOffer);
socket.on('new icecandidate', handleNewIceCandidate);
socket.on('video-answer', handleVideoAnswer);

socket.on('join room', async (conc, cnames, micinfo, videoinfo) => {
    socket.emit('getCanvas');
    
    if (cnames) cName = cnames;
    if (micinfo) micInfo = micinfo;
    if (videoinfo) videoInfo = videoinfo;

    if (conc) {
        await conc.forEach(sid => {
            connections[sid] = new RTCPeerConnection(configuration);

            connections[sid].onicecandidate = function(event) {
                if (event.candidate) {
                    socket.emit('new icecandidate', event.candidate, sid);
                }
            };

            connections[sid].ontrack = function(event) {
                if (!document.getElementById(sid)) {
                    createVideoElement(sid, event.streams[0]);
                }
            };

            connections[sid].onremovetrack = function() {
                if (document.getElementById(sid)) {
                    document.getElementById(sid).remove();
                }
            };

            connections[sid].onnegotiationneeded = function() {
                connections[sid].createOffer()
                    .then(function(offer) {
                        return connections[sid].setLocalDescription(offer);
                    })
                    .then(function() {
                        socket.emit('video-offer', connections[sid].localDescription, sid);
                    })
                    .catch(error => console.error('Error creating offer:', error));
            };
        });

        startCall();
    } else {
        // If no one else is in the room, just setup local video
        navigator.mediaDevices.getUserMedia(mediaConstraints)
            .then(localStream => {
                myStream = localStream;
                myVideo.srcObject = localStream;
                myVideo.muted = true;
            })
            .catch(error => console.error('Error accessing media devices:', error));
    }
    
    // Update room UI
    if (conc && conc.length > 0) {
        videoContainer.className = 'video-cont';
    } else {
        videoContainer.className = 'video-cont-single';
    }
    
    // Update attendees list
    updateAttendeesView();
});

socket.on('remove peer', sid => {
    if (document.getElementById(sid)) {
        document.getElementById(sid).remove();
    }
    
    delete connections[sid];
    delete cName[sid];
    delete micInfo[sid];
    delete videoInfo[sid];
    
    // Update attendees list
    updateAttendeesView();
});

socket.on('action', (msg, sid) => {
    if (msg === 'mute') {
        document.querySelector(`#mute${sid}`).style.visibility = 'visible';
        micInfo[sid] = 'off';
    } else if (msg === 'unmute') {
        document.querySelector(`#mute${sid}`).style.visibility = 'hidden';
        micInfo[sid] = 'on';
    } else if (msg === 'videooff') {
        document.querySelector(`#vidoff${sid}`).style.visibility = 'visible';
        videoInfo[sid] = 'off';
    } else if (msg === 'videoon') {
        document.querySelector(`#vidoff${sid}`).style.visibility = 'hidden';
        videoInfo[sid] = 'on';
    }
    
    // Update attendees list
    updateAttendeesView();
});

socket.on('message', (msg, sendername, time) => {
    // Remove empty chat state if present
    const emptyChat = document.querySelector('.empty-chat');
    if (emptyChat) {
        emptyChat.remove();
    }
    
    // Create message element
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sendername === username ? 'self' : ''}`;
    
    messageDiv.innerHTML = `
        <div class="chat-name">${sendername}</div>
        <div class="message">${msg}</div>
        <div class="message-time"><i class="far fa-clock"></i> ${time}</div>
    `;
    
    const chatRoom = document.querySelector('.chat-cont');
    chatRoom.appendChild(messageDiv);
    
    // Smooth scroll to bottom
    chatRoom.scrollTo({
        top: chatRoom.scrollHeight,
        behavior: 'smooth'
    });
    
    // Show notification badge if chat is hidden
    if (!document.querySelector('.right-cont').classList.contains('show-chat')) {
        const notificationBadge = document.querySelector('.notification-badge');
        if (notificationBadge) {
            notificationBadge.classList.add('has-notifications');
            
            // Update count if it exists
            const currentCount = parseInt(notificationBadge.textContent || '0');
            notificationBadge.textContent = currentCount + 1;
        }
    }
    
    // Add notification sound
    playNotificationSound();
});

socket.on('getCanvas', url => {
    if (!url) return;
    
    let img = new Image();
    img.onload = () => {
        ctx.drawImage(img, 0, 0);
    };
    img.src = url;
});

socket.on('draw', (newX, newY, prevX, prevY, color, size) => {
    remoteColor = color;
    remoteSize = size;
    
    ctx.strokeStyle = remoteColor;
    ctx.lineWidth = remoteSize;
    ctx.beginPath();
    ctx.moveTo(prevX, prevY);
    ctx.lineTo(newX, newY);
    ctx.stroke();
    ctx.closePath();
});

socket.on('clearBoard', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});

// User count update
socket.on('user count', count => {
    if (count > 1) {
        videoContainer.className = 'video-cont';
    } else {
        videoContainer.className = 'video-cont-single';
    }
});

// Add the following code to your room.js file, ideally near the beginning 
// after your existing variable declarations



document.querySelector('.hamburger-menu').addEventListener('click', function() {
    document.querySelector('.right-cont').classList.toggle('show-chat');
});
document.querySelector('.close-chat').addEventListener('click', function() {
    document.querySelector('.right-cont').classList.toggle('show-chat');
});

document.addEventListener('DOMContentLoaded', function() {
    // Create notification icon for desktop
    const notificationIcon = document.createElement('div');
    notificationIcon.className = 'notification-icon';
    notificationIcon.innerHTML = '<i class="fas fa-bell"></i>';
    
    // Add badge for unread notifications
    const badge = document.createElement('span');
    badge.className = 'notification-badge';
    badge.textContent = '0';
    notificationIcon.appendChild(badge);
    
    // Add to the left container
    document.querySelector('.left-cont').appendChild(notificationIcon);
    
    // Event listener for desktop notification icon
    notificationIcon.addEventListener('click', function() {
        document.querySelector('.right-cont').classList.toggle('show-notification');
        // Reset badge count on click
        badge.textContent = '0';
        badge.classList.remove('has-notifications');
    });
    
    // Close notification panel when clicking outside
    document.querySelector('.left-cont').addEventListener('click', function(e) {
        if (!e.target.closest('.notification-icon') && 
            !e.target.closest('.right-cont') && 
            document.querySelector('.right-cont').classList.contains('show-notification')) {
            document.querySelector('.right-cont').classList.remove('show-notification');
        }
    });
    
    // Close button functionality - work for both mobile and desktop
    document.querySelector('.close-chat').addEventListener('click', function() {
        // For mobile view
        document.querySelector('.right-cont').classList.remove('show-chat');
        // For desktop view
        document.querySelector('.right-cont').classList.remove('show-notification');
    });
});
function updateNotificationBadge(count) {
    const badge = document.querySelector('.notification-badge');
    if (!badge) return;
    
    const currentCount = parseInt(badge.textContent);
    const newCount = currentCount + count;
    
    badge.textContent = newCount;
    
    if (newCount > 0) {
        badge.classList.add('has-notifications');
    } else {
        badge.classList.remove('has-notifications');
    }
}

// Example: Call this when a new message/notification arrives
// updateNotificationBadge(1);

// Example: Simulate a new notification every 30 seconds
// For testing purposes only - remove in production
setInterval(() => {
    if (!document.querySelector('.right-cont').classList.contains('show-notification')) {
        updateNotificationBadge(1);
    }
}, 30000);

function addSystemNotification(message, icon = 'fas fa-info-circle') {
    const chatRoom = document.querySelector('.chat-cont');
    const notificationDiv = document.createElement('div');
    notificationDiv.className = 'chat-notification';
    notificationDiv.innerHTML = `<i class="${icon} mr-1"></i> ${message}`;
    
    chatRoom.appendChild(notificationDiv);
    chatRoom.scrollTo({
        top: chatRoom.scrollHeight,
        behavior: 'smooth'
    });
}

// Function to play notification sound
function playNotificationSound() {
    const audio = new Audio('/sounds/notification.mp3');
    audio.volume = 0.5;
    audio.play().catch(err => console.log('Audio play failed:', err));
}

// Send message when Enter key is pressed
document.querySelector('.chat-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && this.value.trim()) {
        sendMessage(this.value.trim());
        this.value = '';
    }
});

// Send message on button click
document.querySelector('.chat-send').addEventListener('click', function() {
    const input = document.querySelector('.chat-input');
    if (input.value.trim()) {
        sendMessage(input.value.trim());
        input.value = '';
    }
});

