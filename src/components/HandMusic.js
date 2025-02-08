import React, { useEffect, useRef, useState } from "react";
import { Camera } from "@mediapipe/camera_utils";
import { Hands } from "@mediapipe/hands";
import * as Tone from "tone";

function HandMusic() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [trackingStarted, setTrackingStarted] = useState(false);
  let volume = 50;
  let distortionAmount = 0;
  let reverbAmount = 0;
  

  useEffect(() => {
    if (!trackingStarted || !videoRef.current) return;

    // Create a polyphonic synth and wah effect
    const wah = new Tone.AutoWah({
      baseFrequency: 100,
      octaves: 6,
      sensitivity: 0,
      Q: 2,
      gain: 2,
      wet: 0.5
    }).toDestination();

    const distortion = new Tone.Distortion({
      distortion: 0,
      oversample: "none"
    }).toDestination();

    const synth = new Tone.Synth().connect(wah).connect(distortion);
    synth.volume.value = -12; // Set initial volume

    // Define pentatonic scale notes
    const pentatonicScale = [
      "A3", "C4", "D4", "E4", "G4",
      "A4", "C5", "D5", "E5", "G5",
      "A5"
    ];

    let currentNote = pentatonicScale[0];
    let isPlaying = false;
    // Define the key of C Scales in MIDI numbers
    const C_BLUES = [58, 60, 63, 65, 66, 67, 70, 72, 75];



    let bluesScale;
    // Function to transpose to any key
    let getTransposedScale = (rootNote) => {
        //scale is numerical value of x axis of right hand position
        let semitoneShift = rootNote - 60; // Root note relative to C4 (MIDI 60)
        bluesScale = C_BLUES.map(note => note + semitoneShift);
    };
    let root = 60;
    getTransposedScale(root);
    // Example: Change key to **A Blues** (A = MIDI 57)
    // A Blues Scale


    // MediaPipe Hands setup
    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    hands.onResults((results) => {
      const canvasCtx = canvasRef.current?.getContext("2d");
      if (!canvasCtx) return;

      // Fill with black background instead of clearing to white
      canvasCtx.fillStyle = 'black';
      canvasCtx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);

      if (results.multiHandLandmarks.length > 0 && !isPlaying) {
        isPlaying = true;
      }

      results.multiHandLandmarks.forEach((landmarks, index) => {
        const handedness = results.multiHandedness[index].label;

        function getDistance(index1, index2) {
          if (!landmarks.length) {
              return null;
          }
          
          const p1 = landmarks[index1];
          const p2 = landmarks[index2];
          
          return Math.sqrt(
              Math.pow(p1.x - p2.x, 2) +
              Math.pow(p1.y - p2.y, 2) +
              Math.pow(p1.z - p2.z, 2)
          );
        }
        
        if (handedness === 'Left') {
          // Volume control with left hand rotation
          const wristX = landmarks[0].x;
          const wristY = landmarks[0].y;
          const middleX = landmarks[9].x;
          const middleY = landmarks[9].y;
          
          
          // Get thumb distance for wah control
          const thumbDistance = getDistance(4, 17);
          // Map thumb distance: 0.2 -> 0 wah, 0 -> 1 wah
          reverbAmount = Math.min(Math.max((0.2 - thumbDistance) / 0.2, 0), 1);
          wah.sensitivity = reverbAmount * 10; // Scale to reasonable sensitivity values


          const mindexDistance = getDistance(12, 0);
          // Map mindexDistance: 0.3+ -> 0 distortion, 0.15 or less -> 1 distortion
          distortionAmount = Math.min(Math.max((0.3 - mindexDistance) / 0.15, 0), 1);
          distortion.distortion = distortionAmount;

          const palmVector = {
            x: middleX - wristX,
            y: middleY - wristY
          };
          
          // Calculate angle in radians
          const wristAngle = -Math.atan2(palmVector.y, palmVector.x);
          
          // Convert to degrees and normalize to 0-360
          let degrees = (wristAngle * 180 / Math.PI) % 360;
          
          // Smooth out volume changes by using a smaller range and adding an offset
          volume = Math.floor((degrees / 360) * 40); // Adjusted range and offset
          
          // Use a slower ramp time for smoother transitions
          synth.volume.rampTo(volume, 0.1);
        } else if (handedness === 'Right') {
          const yCoord = landmarks[0].y; // Get the y-coordinate of the wrist
          const xCoord = landmarks[0].x;
          const vertIndex = 9-Math.floor(yCoord*9);
          let note;
  
          const thumbTip = landmarks[4];
          const indexFingerBase = landmarks[5];
          const wrist = landmarks[0];
          const indexFingerTip = landmarks[7];
          const pinkyBase = landmarks[17];
  
          // Calculate distances between the base, middle, and tip of the index finger
          const distanceTipToWrist = Math.sqrt(
            Math.pow(wrist.x - indexFingerTip.x, 2) +
            Math.pow(wrist.y - indexFingerTip.y, 2)
          );
          const distanceThumbToPinkyBase = Math.sqrt(
            Math.pow(thumbTip.x - pinkyBase.x, 2) +
            Math.pow(thumbTip.y - pinkyBase.y, 2)
          );
          
          
          if (distanceTipToWrist > 0.26) {
            const chromScale = 74 - Math.floor(yCoord*12);
            note = Tone.Frequency(chromScale, "midi").toNote();
            synth.triggerAttack(note, '0.5');
          } else if (distanceThumbToPinkyBase > 0.17) {
            let currentScale = bluesScale;
            note = Tone.Frequency(currentScale[vertIndex], "midi").toNote();
            synth.triggerAttack(note, '0.5');
          } else {
            synth.triggerRelease();
          }
        }

        drawHandLandmarks(canvasCtx, landmarks, handedness, volume, getDistance(12, 0), getDistance(4, 17));
      });

      // If no hands are detected and notes are playing, stop them
      if (results.multiHandLandmarks.length === 0 && isPlaying) {
        synth.triggerRelease();
        isPlaying = false;
      }
    });

    // Initialize camera
    const initCamera = async () => {
      const camera = new Camera(videoRef.current, {
        onFrame: async () => {
          await hands.send({ image: videoRef.current });
        },
        width: 400,
        height: 350,
      });

      try {
        await camera.start();
      } catch (error) {
        console.error("Error starting camera:", error);
      }
    };

    initCamera();

    // Cleanup
    return () => {
      if (isPlaying) {
        synth.triggerRelease();
      }
      synth.dispose();
    };
  }, [trackingStarted]);

  // Updated function to draw landmarks with different colors
  const drawHandLandmarks = (ctx, landmarks, handedness, volume, distortionAmount, reverbAmount) => {
    // Set color based on handedness
    const color = handedness === 'Right' ? 'blue' : 'red';
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    
    ctx.scale(-1, 1);
    ctx.font = "48px serif";
    ctx.fillText(volume.toString() * 8, -60, 50);
    ctx.fillText((distortionAmount.toString()), -60, 100);
    ctx.fillText(reverbAmount.toString(), -60, 150);
    ctx.scale(-1, 1);
    landmarks.forEach((point) => {
      const x = point.x * canvasRef.current.width;
      const y = point.y * canvasRef.current.height;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, 2 * Math.PI);
      ctx.fill();
    });
  };

  // Add a button to explicitly start audio context
  const handleStart = async () => {
    await Tone.start();
    setTrackingStarted(true);
    document.body.style.background = "black";
  };

  return (
    <div className="min-h-screen bg-black">
      {!trackingStarted ? (
        <button
          id="startButton"
          onClick={handleStart}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded mt-4"
        >
          Start Playing
        </button>
      ) : (
        <div className="relative w-full h-screen">
          <select>
            <option value="Ionian">Ionian</option>
            <option value="Dorian">Dorian</option> 
            <option value="Phrygian">Phrygian</option>
            <option value="Lydian">Lydian</option>
            <option value="Mixolydian">Mixolydian</option>
            <option value="Aeolian">Aeolian</option>
            <option value="Locrian">Locrian</option>
            <option value="Blues">Blues</option>
          </select>
          <select>
            <option value="C">C</option>
            <option value="D">D</option>
            <option value="E">E</option>
            <option value="F">F</option>
            <option value="G">G</option>
            <option value="A">A</option>
            <option value="B">B</option>
          </select>
          <video 
            ref={videoRef} 
            className="w-1/3 rounded-md mx-auto" 
            autoPlay 
            style={{
              transform: 'scaleX(-1)',
              WebkitTransform: 'scaleX(-1)',
              mozTransform: 'scaleX(-1)',
              msTransform: 'scaleX(-1)'
            }}
          />
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full"
            width={window.innerWidth}
            height={window.innerHeight}
            style={{
              transform: 'scaleX(-1)',
              WebkitTransform: 'scaleX(-1)',
              mozTransform: 'scaleX(-1)',
              msTransform: 'scaleX(-1)'
            }}
          />
        </div>
      )}
    </div>
  );
}

export default HandMusic;