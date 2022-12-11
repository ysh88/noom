const socket = io();

const myFace = document.getElementById('myFace');
const muteBtn = document.getElementById('mute');
const camBtn = document.getElementById('camera');
const camSel = document.getElementById('cameras');

const welcome = document.getElementById('welcome');
const call = document.getElementById('call');
call.hidden = true;

let myStream;
let isMuted = false;
let isCamOff = false;
let myPeerConnection;

async function getCameras() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cams = devices.filter(device => device.kind === 'videoinput');
  const currentCam = myStream.getVideoTracks()[0];
  cams.forEach(cam => {
    const opt = document.createElement('option');
    opt.value = cam.deviceId;
    opt.innerText = cam.label;
    if (currentCam.label === cam.label) {
      opt.selected = true;
    }
    camSel.appendChild(opt);
  });
}

async function getMedia(deviceId) {
  const initConstraints = {
    audio: true,
    video: { facingMode: 'user' },
  };
  const camConstraints = {
    audio: true,
    video: {
      deviceId: { exact: deviceId },
    },
  };

  try {
    myStream = await navigator.mediaDevices.getUserMedia(
      deviceId ? camConstraints : initConstraints
    );
    myFace.srcObject = myStream;
    if (!deviceId) {
      await getCameras();
    }
  } catch (err) {
    console.log(err);
  }
}

function handleMuteClick() {
  myStream.getAudioTracks().forEach(track => (track.enabled = !track.enabled));
  isMuted = !isMuted;
  if (isMuted) {
    muteBtn.innerText = 'Unmute';
  } else {
    muteBtn.innerText = 'Mute';
  }
}
function handleCamClick() {
  myStream.getVideoTracks().forEach(track => (track.enabled = !track.enabled));
  isCamOff = !isCamOff;
  if (isCamOff) {
    camBtn.innerText = 'Cam On';
  } else {
    camBtn.innerText = 'Cam Off';
  }
}

async function handleCamChange() {
  await getMedia(camSel.value);
  if (myPeerConnection) {
    const videoTrack = myStream.getVideoTracks()[0];
    const videoSender = myPeerConnection
      .getSenders()
      .find(sender.track.kind === 'video');
    videoSender.replaceTrack(videoTrack);
  }
}

muteBtn.addEventListener('click', handleMuteClick);
camBtn.addEventListener('click', handleCamClick);
camSel.addEventListener('input', handleCamChange);

// welcome form
const welcomeForm = welcome.querySelector('form');

async function initCall() {
  welcome.hidden = true;
  call.hidden = false;
  await getMedia();
  makeConnection();
}

let roomName = '';
async function handleWelcomeSubmit(e) {
  e.preventDefault();
  const input = document.querySelector('input');
  await initCall();
  socket.emit('join_room', input.value);
  roomName = input.value;
  input.value = '';
}
welcomeForm.addEventListener('submit', handleWelcomeSubmit);

// Socket code
socket.on('welcome', async () => {
  // Peer A
  const offer = await myPeerConnection.createOffer();
  myPeerConnection.setLocalDescription(offer);
  console.log('sent the offer');
  socket.emit('offer', offer, roomName);
});

// Peer B
socket.on('offer', async offer => {
  console.log('received the offer');
  myPeerConnection.setRemoteDescription(offer);
  const answer = await myPeerConnection.createAnswer();
  myPeerConnection.setLocalDescription(answer);
  socket.emit('answer', answer, roomName);
  console.log('sent the offer');
});
socket.on('answer', answer => {
  console.log('received the answer');
  myPeerConnection.setRemoteDescription(answer);
});
socket.on('ice', ice => {
  console.log('received candidate');
  myPeerConnection.addIceCandidate(ice);
});

// RTC code
function makeConnection() {
  myPeerConnection = new RTCPeerConnection({
    //다른 네트워크에서 화면전송 안 됨
    iceServers:[{
      urls:[
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
        "stun:stun3.l.google.com:19302",
        "stun:stun4.l.google.com:19302",
      ]
    }]
  });
  myPeerConnection.addEventListener('icecandidate', handleIce);
  myPeerConnection.addEventListener('addstream', handleAddStream);
  myStream
    .getTracks()
    .forEach(track => myPeerConnection.addTrack(track, myStream));
}

function handleIce(data) {
  console.log('sent candidate');
  socket.emit('ice', data.candidate, roomName);
}
function handleAddStream(data) {
  const peerFace = document.getElementById('peerFace');
  peerFace.srcObject = data.stream;
}
