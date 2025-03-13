// Select DOM elements
const createButton = document.querySelector("#createroom");
const videoCont = document.querySelector('.video-self');
const codeCont = document.querySelector('#roomcode');
const joinBut = document.querySelector('#joinroom');
const mic = document.querySelector('#mic');
const cam = document.querySelector('#webcam');

// Track microphone and camera states
let micAllowed = true;
let camAllowed = true;
let localStream;

// Function to start the camera and microphone
async function startMedia() {
    try {
        const constraints = { video: camAllowed, audio: micAllowed };
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        videoCont.srcObject = localStream;
    } catch (error) {
        console.error("Error accessing media devices:", error);
        alert("Unable to access camera or microphone. Please allow permissions.");
    }
}

// Initialize media
startMedia();

// Function to generate a unique room ID
function uuidv4() {
    return 'xxyxyxxyx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Handle create room button click
createButton.addEventListener('click', (e) => {
    e.preventDefault();
    createButton.disabled = true;
    createButton.innerHTML = 'Creating Room';
    createButton.classList.add('createroom-clicked');

    const createroomtext = 'Creating Room...';
    let interval = setInterval(() => {
        if (createButton.innerHTML.length < createroomtext.length) {
            createButton.innerHTML = createroomtext.substring(0, createButton.innerHTML.length + 1);
        } else {
            createButton.innerHTML = createroomtext.substring(0, createButton.innerHTML.length - 3);
        }
    }, 500);

    // Simulate a delay for creating the room
    setTimeout(() => {
        clearInterval(interval);
        location.href = `/room.html?room=${uuidv4()}`;
    }, 2000);
});

// Handle join room button click
joinBut.addEventListener('click', (e) => {
    e.preventDefault();
    if (codeCont.value.trim() === "") {
        codeCont.classList.add('roomcode-error');
        return;
    }
    const code = codeCont.value;
    location.href = `/room.html?room=${code}`;
});

// Clear error when room code is entered
codeCont.addEventListener('input', (e) => {
    if (codeCont.value.trim() !== "") {
        codeCont.classList.remove('roomcode-error');
    }
});

// Toggle camera
cam.addEventListener('click', async () => {
    camAllowed = !camAllowed;
    if (localStream) {
        localStream.getVideoTracks().forEach(track => track.enabled = camAllowed);
    }
    cam.classList.toggle("nodevice", !camAllowed);
    cam.innerHTML = camAllowed ? `<i class="fas fa-video"></i>` : `<i class="fas fa-video-slash"></i>`;
});

// Toggle microphone
mic.addEventListener('click', async () => {
    micAllowed = !micAllowed;
    if (localStream) {
        localStream.getAudioTracks().forEach(track => track.enabled = micAllowed);
    }
    mic.classList.toggle("nodevice", !micAllowed);
    mic.innerHTML = micAllowed ? `<i class="fas fa-microphone"></i>` : `<i class="fas fa-microphone-slash"></i>`;
});