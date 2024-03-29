const APP_ID = "4ca19df909834e54b772cb84043812d3"
let uid = sessionStorage.getItem('uid')
if (!uid) {
  uid = String(Math.floor(Math.random() * 10000))
  sessionStorage.setItem('uid', uid)
}
let token = null;
let client;
let rtmClient;
let channel;

const queryString = window.location.search
const urlParams = new URLSearchParams(queryString)
let roomId = urlParams.get('room')

if (!roomId) {
  roomId = 'main'
}

let displayName = sessionStorage.getItem('display_name')
if(!displayName){
  window.location = 'lobby.html'
}
console.log(roomId)

let localTracks = []
let remoteUsers = {}
let localScreenTracks;
let sharingScreen = false;


let joinRoomInit = async () => {
  rtmClient = await AgoraRTM.createInstance(APP_ID)
  await rtmClient.login({uid,token})
  await rtmClient.addOrUpdateLocalUserAttributes({'name':displayName})
  channel = await rtmClient.createChannel(roomId)
  await channel.join()
  channel.on('ChannelMessage', handleChannelMessage)

  client = AgoraRTC.createClient({
    mode: 'rtc',
    codec: 'vp8'
  })

  addBotMessageToDom(`Welcome to the room ${displayName}! 👋`)
  await client.join(APP_ID, roomId, token, uid)
  client.on('user-published', handleUserPublished)
  client.on('user-left', handleUserLeft)
  joinStream()
}

let joinStream = async () => {
  localTracks = await AgoraRTC.createMicrophoneAndCameraTracks()
  let player = `<div class="video__container" id="user-container-${uid}">
                    <video class="video-player" id="user-${uid}"></video>
                 </div>`

  document.getElementById('streams__container').insertAdjacentHTML('beforeend', player)
  document.getElementById(`user-container-${uid}`).addEventListener('click', expandVideoFrame)
  localTracks[1].play(`user-${uid}`)
  await client.publish([localTracks[0], localTracks[1]])
}

let switchToCamera = async () => {
  console.log("------------------------------------------------------------------------------------------------------------------------------------")
  let player = `<div class="video__container" id="user-container-${uid}">
                    <video class="video-player" id="user-${uid}"></video>
                 </div>`
  document.getElementById('streams__container').insertAdjacentHTML('beforeend', player)
  await localTracks[0].setMuted(true)
  await localTracks[1].setMuted(true)
  document.getElementById('mic-btn').classList.remove('active')
  document.getElementById('screen-btn').classList.remove('active')

  let videoFrames = document.getElementsByClassName('video__container')
  for (let i = 0; i < videoFrames.length; i++) {
    videoFrames[i].addEventListener('click', expandVideoFrame)
    videoFrames[i].style.height = '400px'
    videoFrames[i].style.width = '400px'
    videoFrames[i].classList.remove('round')
  }

  localTracks[1].play(`user-${uid}`)
  await client.publish([localTracks[1]])
}


let handleUserPublished = async (user, mediaType) => {

  remoteUsers[user.uid] = user

  await client.subscribe(user, mediaType)

  let player = document.getElementById(`user-container-${user.uid}`)
  if (player === null) {
    player = `<div class="video__container" id="user-container-${user.uid}">
                <video class="video-player" id="user-${user.uid}"></video>
            </div>`

    document.getElementById('streams__container').insertAdjacentHTML('beforeend', player)
    document.getElementById(`user-container-${user.uid}`).addEventListener('click', expandVideoFrame)
  }
  if (displayFrame.style.display) {
    let videoFrame = document.getElementById(`user-container-${user.uid}`)
    videoFrame.style.height = '100px'
    videoFrame.style.width = '100px'
  }
  if (mediaType === 'video') {
    user.videoTrack.play(`user-${user.uid}`)
  }

  if (mediaType === 'audio') {
    user.audioTrack.play()
  }
}

let handleUserLeft = async (user) => {
  delete remoteUsers[user.uid]
  let item = document.getElementById(`user-container-${user.uid}`).remove()
}

// -------------------------------mic and camera toggling------------------------------------------
let toggleMic = async (e) => {
  let button = e.currentTarget

  if (localTracks[0].muted) {
    await localTracks[0].setMuted(false)
    button.classList.add('active')
  } else {
    await localTracks[0].setMuted(true)
    button.classList.remove('active')
  }
}

let toggleCamera = async (e) => {
  let button = e.currentTarget

  if (localTracks[1].muted) {
    await localTracks[1].setMuted(false)
    button.classList.add('active')
  } else {
    await localTracks[1].setMuted(true)
    button.classList.remove('active')
  }
}

let toggleScreen = async (e) => {
  let screenButton = e.currentTarget
  let cameraButton = document.getElementById('camera-btn')

  if (!sharingScreen) {
    sharingScreen = true

    screenButton.classList.add('active')
    cameraButton.classList.remove('active')
    cameraButton.style.display = 'none'

    localScreenTracks = await AgoraRTC.createScreenVideoTrack()

    document.getElementById(`user-container-${uid}`).remove()
    displayFrame.style.display = 'block'

    let player = `<div class="video__container" id="user-container-${uid}">
                <video class="video-player" id="user-${uid}"></video>
            </div>`

    displayFrame.insertAdjacentHTML('beforeend', player)
    document.getElementById(`user-container-${uid}`).addEventListener('click', expandVideoFrame)

    userIdInDisplayFrame = `user-container-${uid}`
    localScreenTracks.play(`user-${uid}`)

    await client.unpublish([localTracks[1]])
    await client.publish([localScreenTracks])

    let videoFrames = document.getElementsByClassName('video__container')
    for (let i = 0; i < videoFrames.length; i++) {
      if (videoFrames[i].id != userIdInDisplayFrame) {
        videoFrames[i].style.height = '100px'
        videoFrames[i].style.width = '100px'
      }
    }


  } else {
    sharingScreen = false
    cameraButton.style.display = 'block'
    screenButton.classList.remove('active')
    document.getElementById(`user-container-${uid}`).remove()
    await client.unpublish([localScreenTracks])
    displayFrame.style.display = 'none'
    switchToCamera()
  }
}


let leaveStream = async (e) => {
  e.preventDefault()
  sendpatientdata();
  // document.getElementById('join-btn').style.display = 'block'
  // document.getElementsByClassName('stream__actions')[0].style.display = 'none'

  for (let i = 0; localTracks.length > i; i++) {
    localTracks[i].stop()
    localTracks[i].close()
  }

  await client.unpublish([localTracks[0], localTracks[1]])

  if (localScreenTracks) {
    await client.unpublish([localScreenTracks])
  }

  document.getElementById(`user-container-${uid}`).remove()

  if (userIdInDisplayFrame === `user-container-${uid}`) {
    displayFrame.style.display = null

    for (let i = 0; videoFrames.length > i; i++) {
      videoFrames[i].style.height = '500px'
      videoFrames[i].style.width = '500px'
    }
  }

  channel.sendMessage({
    text: JSON.stringify({
      'type': 'user_left',
      'uid': uid
    })
  })
  console.log("video frames:",videoFrames.length)
  console.log("sending data");
  var room=urlParams.get('room')
  var url="/viewdata/";
  url=url.concat(room);
  window.location=url;
  
}

let sendData=async(e)=>{
  
}


var data=document.getElementById("status");
var frequency=new Map([
    ["happy",0],
    ["sad",0],
    ["angry",0],
    ["disgust",0],
    ["fear",0],
    ["neutral",0],
])
var calling = setInterval(store, 5000);
function store(){
    var value=data.innerHTML;
    frequency.set(value, frequency.get(value) + 1 || 1);
    // frequency.get(value)+=1;
    // console.log(frequency);
}

async function sendpatientdata(){
    console.log("sending patients data!!!");
}





document.getElementById('camera-btn').addEventListener('click', toggleCamera)
document.getElementById('mic-btn').addEventListener('click', toggleMic)
document.getElementById('screen-btn').addEventListener('click', toggleScreen)
document.getElementById('leave-btn').addEventListener('click', leaveStream)
document.getElementById('senddata-btn').addEventListener('click', sendData)
joinRoomInit()
