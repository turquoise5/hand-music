import React, { useEffect, useRef, useState } from "react";
import { Synth } from "tone/build/esm/instrument/Synth";
import { Destination } from "tone";
import { Hands } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";

function HandMusic() {
  const videoRef = useRef(null);
  const [trackingStarted, setTrackingStarted] = useState(false);

  useEffect(() => {
    if (!trackingStarted) return;

    // Initialize Tone.js Synth
    const synth = new Synth().connect(Destination);

    // MediaPipe Hands setup
    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    hands.onResults((results) => {
      if (results.multiHandLandmarks.length) {
        const landmarks = results.multiHandLandmarks[0];
        const yCoord = landmarks[8].y; // Index finger tip
        const pitch = Math.floor(60 + yCoord * 40);
        synth.triggerAttackRelease(`${pitch}Hz`, "8n");
      }
    });

    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        await hands.send({ image: videoRef.current });
      },
      width: 640,
      height: 480,
    });

    camera.start();

  }, [trackingStarted]);

  const handleStart = () => {
    setTrackingStarted(true);
  };

  return (
    <div className="hand-music-container text-center">
      {!trackingStarted ? (
        <button
          onClick={handleStart}
          className="bg-blue-500 text-white font-bold py-2 px-4 rounded mt-4"
        >
          Start Playing
        </button>
      ) : (
        <video ref={videoRef} className="w-full max-w-md mx-auto mt-4 rounded-md" />
      )}
    </div>
  );
}

export default HandMusic;
