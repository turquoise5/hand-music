import React, { useEffect, useRef, useState } from "react";
import { Camera } from "@mediapipe/camera_utils";
import { Hands } from "@mediapipe/hands";
import * as Tone from "tone";

function HandMusic() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [trackingStarted, setTrackingStarted] = useState(false);
  const [instrument, setInstrument] = useState("sine");
  let volume = 50;
  let distortionAmount = 0;
  let reverbAmount = 0;
  let tremoloAmount = 0;
  
  // Move scales outside useEffect and make them constants
  const SCALES = {
    blues: [58, 60, 63, 65, 66, 67, 70, 72, 75],
    ionian: [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84], // C Major
    dorian: [62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84, 86], // D Dorian
    phrygian: [64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84, 86, 88], // E Phrygian
    lydian: [65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84, 86, 88, 89], // F Lydian
    mixolydian: [67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84, 86, 88, 89, 91], // G Mixolydian
    aeolian: [69, 71, 72, 74, 76, 77, 79, 81, 83, 84, 86, 88, 89, 91, 93], // A Aeolian
    locrian: [71, 72, 74, 76, 77, 79, 81, 83, 84, 86, 88, 89, 91, 93, 95]  // B Locrian
  };

  // Initialize mode state with SCALES.ionian
  const [mode, setMode] = useState(SCALES.ionian);

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


    var tremolo = new Tone.Tremolo(0, 1).toDestination().start();
    const panner = new Tone.Panner(0).toDestination();
    
    const distortion = new Tone.Distortion({
      distortion: 0,
      oversample: "none"
    }).toDestination();

    const synth = new Tone.Synth().connect(wah).connect(distortion).connect(tremolo).connect(panner);
    synth.oscillator.type = instrument;
    synth.volume.value = -12; // Set initial volume
    synth.set({
      envelope: {
        attack: 0,   // No attack (instant sound)
        decay: 0,  // Set the decay (optional)
        sustain: 0.5,  // Sustain level (optional)
        release: 0,  // Release time (optional)
      }
    });

    const chordSynth = new Tone.PolySynth().toDestination();
    chordSynth.set({
      envelope: {
        attack: 0,   // No attack (instant sound)
        decay: 0,  // Set the decay (optional)
        sustain: 0.5,  // Sustain level (optional)
        release: 0,  // Release time (optional)
      }
    });
    chordSynth.volume.value = -15;
    synth.volume.value = -10;

    let isPlaying = false;

    let globalScale;

    // Function to transpose to any key
    let getTransposedScale = (scale, shift) => {
        globalScale = scale.map(note => note + shift);
    };
    
    let shift = 0;
    getTransposedScale(mode, shift);

    function dist(x0,y0,x1,y1) {
      return Math.sqrt(
        Math.pow(x0 - x1, 2) +
        Math.pow(y0 - y1, 2)
      );
    }

    let rootIndex = null;
    let currChord = [];


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
          // Check if second hand exists before accessing its landmarks
          // if (results.multiHandLandmarks.length < 2) return;
          
          // const landmarks = results.multiHandLandmarks[1];
          // if (!landmarks) return;

          const wristX = landmarks[0].x;
          const wristY = landmarks[0].y;
          const middleX = landmarks[9].x;
          const middleY = landmarks[9].y;
          const pinkyDistance = getDistance(20, 0);
          // Get thumb distance for wah control
          const thumbDistance = getDistance(4, 17);
          const mid_index_Distance = getDistance(8, 4);

          // Map thumb distance: 0.2 -> 0 wah, 0 -> 1 wah
          reverbAmount = Math.min(Math.max((0.2 - thumbDistance) / 0.2, 0), 1);
          wah.sensitivity = reverbAmount * 10; // Scale to reasonable sensitivity values

          tremoloAmount = Math.floor(mid_index_Distance*20);
          tremolo.frequency.value = tremoloAmount;
          if (pinkyDistance < 0.20) {
            synth.portamento = 0.07;
          } else {
            synth.portamento = 0;
          }
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
          
          // Update volume variable but don't apply it directly to the synth
          volume = Math.floor((degrees / 360) * 30 - 10);
        } else if (handedness === 'Right') {
          // const landmarks = results.multiHandLandmarks[0];
          const xCoord = Math.min(Math.max(landmarks[0].x, 0), 1);
          const panValue = ((xCoord * 2) - 1) * (-1);
          console.log("xCoord: ", xCoord);
          console.log("panValue: ", panValue);
          panner.pan.value = panValue;
          // Apply the current volume only when using the right hand
          synth.volume.rampTo(volume, 0.1);
          
          const yCoord = landmarks[0].y; // Get the y-coordinate of the wrist
  
          const thumbTip = landmarks[4];
          const wrist = landmarks[0];
          const indexFingerTip = landmarks[7];   // Landmark 7
          const pinkyBase = landmarks[17];
          const middleTip = landmarks[12];
          const ringTip = landmarks[16];
          const pinkyTip = landmarks[20]
  
          // Calculate distances between the base, middle, and tip of the index finger
          if (wrist.x > 0 && wrist.y > 0 && wrist.x < 1.0 && wrist.y < 1.0 ) {
            let note;
            let chord = [];
            const distanceIndexTipToWrist = dist(indexFingerTip.x, indexFingerTip.y, wrist.x, wrist.y);
            const distanceThumbToPinkyBase = dist(thumbTip.x, thumbTip.y, pinkyBase.x, pinkyBase.y);
            const distanceMiddleTipToWrist = dist(middleTip.x, middleTip.y, wrist.x, wrist.y);
            const distanceRingTipToWrist = dist(ringTip.x, ringTip.y, wrist.x, wrist.y);
            
            //melody
            
            if (distanceIndexTipToWrist > 0.25) {
              const chromScale = globalScale[globalScale.length-1] - Math.floor(yCoord*12);
              note = Tone.Frequency(chromScale, "midi").toNote();
            } else if (distanceThumbToPinkyBase > 0.18) {
              const vertIndex = (globalScale.length-1) - Math.floor(yCoord*9);
              note = Tone.Frequency(globalScale[vertIndex], "midi").toNote();
            } else {
              synth.triggerRelease();
            }
            synth.triggerAttack(note);
          
  
            //chords
            if (distanceMiddleTipToWrist > 0.14 && distanceRingTipToWrist > 0.14) {
              let currRootIndex = 8 - Math.floor(yCoord*8);
              if (rootIndex == null) {
                rootIndex = currRootIndex;
              } else if (rootIndex != currRootIndex) {
                rootIndex = currRootIndex;
                chordSynth.triggerRelease(currChord);
                for (let i = 0; i < 4; i++) {
                  let currIndex = rootIndex + (2*i);
                  while (currIndex > (globalScale.length-1)) {
                    currIndex = currIndex - (globalScale.length-1);
                  }
                  const currNote = Tone.Frequency(globalScale[currIndex], "midi").toNote();
                  chord.push(currNote);
                }
                chordSynth.triggerAttack(chord);
                currChord = chord
              }
            } 
          }
        }

        drawHandLandmarks(canvasCtx, landmarks, handedness, volume, getDistance(12, 0), getDistance(4, 17));
      });

      // If no hands are detected and notes are playing, stop them
      if (results.multiHandLandmarks.length === 0 && isPlaying) {
        synth.triggerRelease();
        chordSynth.triggerRelease(currChord);
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
  }, [trackingStarted, mode, instrument]);

  // Updated function to draw landmarks with different colors
  const drawHandLandmarks = (ctx, landmarks, handedness, volume, distortionAmount, reverbAmount) => {
    // Set color based on handedness
    const color = handedness === 'Right' ? 'blue' : 'red';
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    
    ctx.scale(-1, 1);
    ctx.font = "48px serif";
    if (100 - (volume.toString()) ** 2 > 0)
    {
      ctx.fillText(100 - (volume.toString()) ** 2, -80, 50);
    }
    else
    {
      ctx.fillText(0, -80, 50);
    }
    ctx.fillText((distortionAmount.toString()), -90, 100);
    ctx.fillText(reverbAmount.toString(), -90, 150);
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
  };

  return (
    <div className="min-h-screen bg-black">
      {!trackingStarted ? (
        <button
          onClick={handleStart}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded mt-4"
        >
          Start Playing
        </button>
      ) : (
        <div className="relative w-full h-screen">
          <select>
            <option value={0}>C</option>
            <option value={1}>Db</option>
            <option value={2}>E</option>
            <option value={3}>Eb</option>
            <option value={4}>F</option>
            <option value={5}>Gb</option>
            <option value={6}>G</option>
            <option value={7}>Ab</option>
            <option value={8}>A</option>
            <option value={9}>Bb</option>
            <option value={10}>B</option>  
          </select>
          <select onChange={(e) => setMode(SCALES[e.target.value])}>
            <option value="ionian">Ionian</option>
            <option value="dorian">Dorian</option>
            <option value="phrygian">Phrygian</option>
            <option value="lydian">Lydian</option>
            <option value="mixolydian">Mixolydian</option>
            <option value="aeolian">Aeolian</option>
            <option value="locrian">Locrian</option>
          </select>
          <select onChange={(e) => setInstrument(e.target.value)}>
            <option value="sine">Sine</option>
            <option value="square">Square</option>
            <option value="sawtooth">Sawtooth</option>
            <option value="triangle">Triangle</option>
            <option value="fmsine">FMSine</option>
            <option value="fmsquare">FMSSquare</option>
            <option value="fmsawtooth">FMSSawtooth</option>  
            <option value="fmtriangle">FMTriangle</option>
            <option value="amsine">AMSine</option>
            <option value="amsquare">AMSquare</option>
            <option value="amsawtooth">AMSawtooth</option>
            <option value="amtriangle">AMTriangle</option>
            <option value="fatsine">FatSine</option>
            <option value="fatsquare">FatSquare</option>
            <option value="fatsawtooth">FatSawtooth</option>
            <option value="fattriangle">FatTriangle</option>
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