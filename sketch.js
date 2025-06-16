// 📷 비디오 위치와 크기 전역 변수로 선언
let videoWidth = 640;
let videoHeight = 480;
let videoX, videoY;
// 💬 자막 관련 변수
let textBoxWidth = 500;
let allLines = [];
let maxLines = 20;
let wordCounts = {}; // 단어 등장 횟수 저장
let cmykColors = ["#00BFFF", "#FF00FF", "#FFFF00", "#000000"]; // C, M, Y, K
let emojiMap = {
  "행복해요": "😊",
  "사랑": "❤️",
  "슬퍼": "😢",
  "화나": "😡",
  "말": "🐎",
  "말이나 못해야지":"😶",
  "오늘": "📅",
  "고양이": "🐱",
  "아름다운": "🌸",
  "날이에요": "🌞",
};
let emojiReplacedWords = new Set();
let emojiDelayQueue = []; // 
let mic;                // 오디오 입력 (음성인식 & 볼륨 감지)
let fft;                // FFT 분석
let recognition;        // 웹 SpeechRecognition
let capture;            // p5 video 캡처 (좌우반전용)

let video;              // 웹캠 비디오 (MediaPipe, FaceAPI 공용)
// 🔊 볼륨 분석용 변수
let vol = 0;
let smoothVol = 0;
let threshold = 0.03;
let lastSmoothVol = 0;
let canvasSize;
let centerY;

// ✋ 손 추적용 변수
let hands;
let camera;
let predictions = [];

// 👀 얼굴 감지용 변수
let faceapi;
let detections;
let eyeLeft = { x: 0, y: 0 };
let eyeRight = { x: 0, y: 0 };
let blinkProgress = 1;
let blinkThreshold = 10; // 눈 감김 임계값 (조절 가능)

const detectionOptions = {
  withLandmarks: true,
  withExpressions: false,
  withDescriptors: false,
};


// 2번 스케치 전용 변수
let waveCanvasSize = 300;
let waveCenterY = waveCanvasSize / 2;
let waveMic;
let waveFFT;
let waveVol = 0;
let waveSmoothVol = 0;

//클릭해서 캡쳐하는 변수
let screenshots = [];

// 클릭 시 전체 캔버스 이미지를 캡쳐하고 축소해서 저장
function mousePressed() {
  // 1. 현재 캔버스 전체 픽셀 캡쳐
  let snapshot = get(); // p5.js 전체 캔버스 복사

  // 2. 원하는 축소 크기 지정 (예: 너비 150px)
  let targetWidth = 400;
  let scaleFactor = targetWidth / width;
  let targetHeight = height * scaleFactor;

  // 3. 새 이미지 생성 및 복사
  let resized = createImage(targetWidth, targetHeight);
  resized.copy(snapshot, 0, 0, width, height, 0, 0, targetWidth, targetHeight);

  // 4. 저장 (마우스 클릭 위치 기준으로 표시)
  screenshots.push({
    img: resized,
    x: mouseX,
    y: mouseY
  });
}

function onResults(results) {
  if (results.multiHandLandmarks) {
    predictions = results.multiHandLandmarks;
  } else {
    predictions = [];
  }
}

function setup() {
  createCanvas(1920, 1200);

  // 1. capture 먼저 초기화
  capture = createCapture(VIDEO);
  capture.size(videoWidth, videoHeight);
  capture.hide();

  // 2. 이제 faceapi에 capture 넘기기
  faceapi = ml5.faceApi(capture, detectionOptions, modelReady);

  // 마이크, FFT
  mic = new p5.AudioIn();
  mic.start();

  fft = new p5.FFT();
  fft.setInput(mic);

  // setup() 내

// waveMic 대신 기존 mic 사용
waveMic = mic;  // mic 객체를 그대로 참조
waveFFT = new p5.FFT();
waveFFT.setInput(waveMic);


  // 비디오 위치
  videoX = (width - videoWidth) / 2;
  videoY = (height - videoHeight) / 2;

  textFont("AppleGothic");
  textSize(40);
  textAlign(CENTER, TOP);

  startSpeechRecognition();

  // 3번: Mediapipe Hands
  hands = new Hands({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
  });

  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.5
  });

  hands.onResults(onResults);

  camera = new Camera(capture.elt, {
    onFrame: async () => {
      await hands.send({ image: capture.elt });
    },
    width: videoWidth,
    height: videoHeight
  });
  camera.start();
}

function modelReady() {
  console.log("FaceAPI 모델 준비 완료!");
  faceapi.detect(gotResults);
}

function gotResults(err, result) {
  if (err) {
    console.error(err);
    return;
  }
  detections = result;

  if (detections && detections.length > 0) {
    const parts = detections[0].parts;
    eyeLeft = getCenter(parts.leftEye);
    eyeRight = getCenter(parts.rightEye);

    let leftEyeHeight = dist(parts.leftEye[1]._x, parts.leftEye[1]._y, parts.leftEye[5]._x, parts.leftEye[5]._y);
    let rightEyeHeight = dist(parts.rightEye[1]._x, parts.rightEye[1]._y, parts.rightEye[5]._x, parts.rightEye[5]._y);
    let avgEyeHeight = (leftEyeHeight + rightEyeHeight) / 2;

    if (avgEyeHeight < blinkThreshold) {
      blinkProgress = lerp(blinkProgress, 0, 1.1);
    } else {
      blinkProgress = lerp(blinkProgress, 1, 0.9);
    }
  } else {
    blinkProgress = lerp(blinkProgress, 1, 0.3);
  }

  faceapi.detect(gotResults);
}


function drawEyeTrackingBox() {
  let boxWidth = 427;
  let boxHeight = 180;

  fill('#E3F2FD');
  noStroke();
  rect(0, 0, boxWidth, boxHeight);

  let eyeWidth = 60;
  let eyeHeight = 60 * blinkProgress;

  let boxCenterY = boxHeight / 2;
  let leftEyeCenterX = boxWidth * 0.3;
  let rightEyeCenterX = boxWidth * 0.7;

  let leftMappedX = map(videoWidth - eyeLeft.x, 0, videoWidth, leftEyeCenterX - 20, leftEyeCenterX + 20);
  let leftMappedY = map(eyeLeft.y, 0, videoHeight, boxCenterY - 20, boxCenterY + 20);

  let rightMappedX = map(videoWidth - eyeRight.x, 0, videoWidth, rightEyeCenterX - 20, rightEyeCenterX + 20);
  let rightMappedY = map(eyeRight.y, 0, videoHeight, boxCenterY - 20, boxCenterY + 20);

  fill('#90CAF9');
  noStroke();
  ellipse(leftMappedX, leftMappedY, eyeWidth, eyeHeight);
  ellipse(rightMappedX, rightMappedY, eyeWidth, eyeHeight);
}

function getCenter(points) {
  let sumX = 0;
  let sumY = 0;
  for (let pt of points) {
    sumX += pt._x;
    sumY += pt._y;
  }
  return {
    x: sumX / points.length,
    y: sumY / points.length,
  };
}

function draw() {
  background(0);
  centerY = height / 2;

  for (let shot of screenshots) {
    image(shot.img, shot.x, shot.y);
  }

  videoX = (width - videoWidth) / 2;
  videoY = (height - videoHeight) / 2;

  push();
  translate(videoX, videoY);
  scale(-1, 1);
  image(capture, -videoWidth, 0, videoWidth, videoHeight);
  pop();

  // 2번 스케치 그리기
  push();
  translate(380, 700);
  drawWaveformAndEmotion();
  pop();

  // 자막 관련 업데이트 및 그리기
  updateEmojiReplacements();
  drawSubtitles();

  // 3번 스케치 그리기
  push();
  translate(width - 900, height - 1150); // 오른쪽 아래로 위치 조정
  fill('#FCE4EC');
  noStroke();
  rect(0, 0, 480, 360); // 배경 사각형

  push();
  translate(0, 0);
  scale(0.7); // 손 위치 조정 시 scale도 고려
  drawHandSketch();
  pop();

  pop();

  // 4번 스케치 그리기 (눈 트래킹 박스)
  push();
  translate(1250, 500); // 원하는 위치로 이동 (왼쪽 아래 등)
  drawEyeTrackingBox(); // 👀 눈동자 스케치 함수 호출
  pop();
}


function drawEyeTrackingBox() {
  // 박스 크기 정의
  let boxWidth = 427;
  let boxHeight = 180;

  fill('#E3F2FD');
  noStroke();
  rect(0, 0, boxWidth, boxHeight);

  // 눈 크기
  let eyeWidth = 60;
  let eyeHeight = 60 * blinkProgress;

  let boxCenterY = boxHeight / 2;

  // 좌우 눈 중심 X 좌표 (좌우 여백 확보)
  let leftEyeCenterX = boxWidth * 0.3;
  let rightEyeCenterX = boxWidth * 0.7;

  // 눈 좌표 매핑 범위 좁히기
  let leftMappedX = map(videoWidth - eyeLeft.x, 0, videoWidth, leftEyeCenterX - 20, leftEyeCenterX + 20);
  let leftMappedY = map(eyeLeft.y, 0, videoHeight, boxCenterY - 20, boxCenterY + 20);

  let rightMappedX = map(videoWidth - eyeRight.x, 0, videoWidth, rightEyeCenterX - 20, rightEyeCenterX + 20);
  let rightMappedY = map(eyeRight.y, 0, videoHeight, boxCenterY - 20, boxCenterY + 20);

  fill('#90CAF9');
  noStroke();
  ellipse(leftMappedX, leftMappedY, eyeWidth, eyeHeight);
  ellipse(rightMappedX, rightMappedY, eyeWidth, eyeHeight);
}


function getWordColorByCount(word) {
  let count = wordCounts[word] || 0;
  let colorIndex = constrain(count - 1, 0, cmykColors.length - 1);
  return cmykColors[colorIndex];
}

function handleFinalTranscript(sentence) {
  let words = sentence.trim().split(/\s+/);
  let lines = [];
  let currentLine = "";

  for (let word of words) {
    if (word in wordCounts) {
      wordCounts[word]++;
    } else {
      wordCounts[word] = 1;
    }

    // 4번째 등장 시 이모지로 전환 예정
    if (
      wordCounts[word] === 4 &&
      emojiMap[word] &&
      !emojiReplacedWords.has(word)
    ) {
      emojiDelayQueue.push({ word: word, startTime: millis() });
    }

    let testLine = currentLine ? currentLine + " " + word : word;
    if (textWidth(testLine) < textBoxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) lines.push(currentLine);
  allLines = allLines.concat(lines);

  if (allLines.length > 100) {
    allLines.splice(0, allLines.length - 100);
  }
}

function updateEmojiReplacements() {
  let now = millis();
  for (let i = emojiDelayQueue.length - 1; i >= 0; i--) {
    let entry = emojiDelayQueue[i];
    if (now - entry.startTime > 500) {
      emojiReplacedWords.add(entry.word);
      emojiDelayQueue.splice(i, 1);
    }
  }
}

function startSpeechRecognition() {
  recognition = new webkitSpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "ko-KR";

  recognition.onresult = function (event) {
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        let transcript = event.results[i][0].transcript;
        console.log("🎙️ 인식:", transcript);
        handleFinalTranscript(transcript);
      }
    }
  };

  recognition.start();
}

function keyPressed() {
  handleFinalTranscript("말이나 못해야지");
}

  // 자막 업데이트 및 출력
  updateEmojiReplacements();
  drawSubtitles();

  // 1. 자막 배경 레이어 그리기 (너가 만든 자막 배경)

function drawSubtitles() {
  let lineHeight = 40;
  let maxVisibleLines = floor((videoHeight - 40) / lineHeight); // 자막 가능한 최대 줄 수

  // 🔥 오래된 자막 잘라내기 (누적 방지)
  if (allLines.length > maxVisibleLines) {
    allLines.splice(0, allLines.length - maxVisibleLines);
  }

  let startY = videoY + videoHeight - (lineHeight * allLines.length) - 20;
  let startX = videoX + (videoWidth - textBoxWidth) / 2;

  for (let i = 0; i < allLines.length; i++) {
    let y = startY + i * lineHeight;
    let line = allLines[i];
    let words = line.split(/\s+/);
    let x = startX;

    for (let word of words) {
      let displayWord = emojiReplacedWords.has(word) ? emojiMap[word] : word;
      let fillColor = getWordColorByCount(word);

      fill(fillColor);
      stroke(0, 100);
      strokeWeight(4);
      textAlign(LEFT, TOP);
      text(displayWord, x, y);
      x += textWidth(displayWord + " ");
    }
  }
}



 // 2번 스케치 그리는 함수 (크기 300x300에 맞춤)
// 2번 스케치 그리는 함수 (크기 300x300에 맞춤)
function drawWaveformAndEmotion() {
  noStroke();
  fill('#FAF3E0');
  rect(0, 0, waveCanvasSize, waveCanvasSize);

  waveCenterY = waveCanvasSize / 2;

  if (waveMic) {
    waveVol = waveMic.getLevel();
    waveSmoothVol = lerp(waveSmoothVol, waveVol, 0.2);

    let waveformVals = waveFFT.waveform();

    stroke(180);
    strokeWeight(2);
    noFill();
    beginShape();
    for (let i = 0; i < waveformVals.length; i++) {
      let x = map(i, 0, waveformVals.length, 0, waveCanvasSize);
      let y = map(waveformVals[i], -1, 1, waveCenterY + 30, waveCenterY - 30);
      vertex(x, y);
    }
    endShape();

    let baseRadius = 50;
    let radius = baseRadius + waveSmoothVol * 300;

    let emotionIntensity = map(waveSmoothVol, 0, 0.2, 0, 1);
    emotionIntensity = constrain(emotionIntensity, 0, 1);

    let c = lerpColor(
      color('#D7E9F7'),  // calm
      color('#E63946'),  // intense
      emotionIntensity
    );

    noStroke();
    fill(c);
    ellipse(waveCanvasSize / 2, waveCanvasSize / 2, radius * 2, radius * 2);
  }
}

//3번 스케치 그리는 함수
function drawHandSketch() {
  noStroke();
  for (let hand of predictions) {
    let isGood = isThumbsUp(hand);
    if (isGood) {
      fill(255, 255, 0, 150); // 노란색
    } else {
      fill('#F8BBD0');
    }

    beginShape();
    for (let landmark of hand) {
      let x = videoWidth - landmark.x * videoWidth; // 좌우 반전
      let y = landmark.y * videoHeight;
      vertex(x, y);
    }
    endShape(CLOSE);
  }
}

function isThumbsUp(hand) {
  // 손가락 랜드마크 인덱스
  const THUMB_TIP = 4;
  const INDEX_TIP = 8;
  const MIDDLE_TIP = 12;
  const RING_TIP = 16;
  const PINKY_TIP = 20;

  let thumb = hand[THUMB_TIP];
  let index = hand[INDEX_TIP];
  let middle = hand[MIDDLE_TIP];
  let ring = hand[RING_TIP];
  let pinky = hand[PINKY_TIP];

  // y가 작을수록 위쪽 → 엄지손가락이 다른 손가락들보다 위에 있으면 엄지척
  return (
    thumb.y < index.y &&
    thumb.y < middle.y &&
    thumb.y < ring.y &&
    thumb.y < pinky.y
  );
}