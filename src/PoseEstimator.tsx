// mediapipe-pose-estimator.tsx
// React + TypeScript single-file library component + hook for MediaPipe Pose Landmarker
// - Exports a `PoseEstimator` default React component you can drop in your app
// - Also exports `usePoseLandmarker` hook for more control
// - Designed to be library-friendly: minimal styling (Tailwind), callbacks, and SSR-safe
//
// Install (peer deps):
//   npm i @mediapipe/tasks-vision
//   or use CDN at runtime if you prefer dynamic import (example uses npm package import names)
//
// Example usage:
// <PoseEstimator
//   modelUrl="https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
//   onResults={(res) => console.log(res)}
//   showCanvas={true}
///>

import React, { useCallback, useEffect, useRef, useState } from "react";

// NOTE: We import types from the package path but keep creation dynamic to avoid SSR problems.
// If you bundle this as a library, keep @mediapipe/tasks-vision as a peer dependency.

type Delegate = "GPU" | "CPU" | "AUTO";

type PoseEstimatorOptions = {
    modelUrl?: string; // model task file URL
    delegate?: Delegate;
    numPoses?: number;
    runningMode?: "IMAGE" | "VIDEO";
    showCanvas?: boolean;
    drawSkeleton?: boolean;
    onResults?: (results: any) => void;
    className?: string;
};

// Hook: manages model lifecycle and provides refs for video + canvas
export function usePoseLandmarker(opts: PoseEstimatorOptions = {}) {
    const {
        modelUrl =
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
        delegate = "GPU",
        numPoses = 1,
        runningMode = "IMAGE",
        drawSkeleton = true
    } = opts;

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const poseRef = useRef<any | null>(null);
    const runningRef = useRef<boolean>(false);
    const [ready, setReady] = useState(false);

    // initialize model (async)
    useEffect(() => {
        let cancelled = false;

        async function init() {
            // dynamic import to avoid SSR errors and to allow bundlers to treat package as peer dep
            const tasks = await import("@mediapipe/tasks-vision");
            const { FilesetResolver, PoseLandmarker, DrawingUtils } = tasks;

            const vision = await FilesetResolver.forVisionTasks(
                // wasm path (will be loaded by the package) — keep same major version when bundling
                // If you host your own, change this URL accordingly.
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
            );

            const pose = await PoseLandmarker.createFromOptions(vision, {
                baseOptions: { modelAssetPath: modelUrl, delegate },
                runningMode: runningMode,
                numPoses
            });

            if (cancelled) {
                pose.close?.();
                return;
            }

            poseRef.current = { pose, DrawingUtils };
            setReady(true);
        }

        init().catch((err) => {
            // expose error in console — library consumers can catch using try/catch around hook usage
            // eslint-disable-next-line no-console
            console.error("Failed to initialize PoseLandmarker:", err);
        });

        return () => {
            cancelled = true;
            if (poseRef.current) {
                try {
                    poseRef.current.pose?.close();
                } catch (e) { }
            }
        };
    }, [modelUrl, delegate, numPoses, runningMode]);

    // function to run detection on an image or the video frame
    const detectImage = useCallback(
        async (input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement) => {
            if (!poseRef.current) return null;
            const { pose } = poseRef.current;
            if (!pose) return null;
            try {
                if (runningMode === "VIDEO") {
                    // detectForVideo requires timestamp
                    const now = performance.now();
                    return await new Promise((resolve) => {
                        pose.detectForVideo(input as HTMLVideoElement, now, (res: any) => resolve(res));
                    });
                } else {
                    return await new Promise((resolve) => {
                        pose.detect(input as HTMLImageElement, (res: any) => resolve(res));
                    });
                }
            } catch (e) {
                // eslint-disable-next-line no-console
                console.error("Pose detection error:", e);
                return null;
            }
        },
        [runningMode]
    );

    // start webcam stream
    const startCamera = useCallback(async () => {
        if (!videoRef.current || !navigator.mediaDevices?.getUserMedia) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn("Error accessing camera:", e);
        }
    }, []);

    // stop webcam
    const stopCamera = useCallback(() => {
        const stream = videoRef.current?.srcObject as MediaStream | null;
        if (stream) {
            stream.getTracks().forEach((t) => t.stop());
            videoRef.current!.srcObject = null;
        }
    }, []);

    // start detection loop for video
    const startLoop = useCallback((onResults?: (r: any) => void) => {
        runningRef.current = true;

        async function frame() {
            if (!runningRef.current) return;
            const video = videoRef.current;
            const canvas = canvasRef.current;
            if (video && canvas && poseRef.current) {
                // ensure canvas matches video size
                canvas.width = video.videoWidth || 640;
                canvas.height = video.videoHeight || 480;

                const result = await detectImage(video);
                if (result && poseRef.current && poseRef.current.DrawingUtils && canvas.getContext) {
                    const ctx = canvas.getContext("2d")!;
                    ctx.clearRect(0, 0, canvas.width, canvas.height);

                    // draw current video frame as background
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                    if (result.landmarks && drawSkeleton) {
                        for (const landmark of result.landmarks) {
                            const drawingUtils = new poseRef.current.DrawingUtils(ctx);
                            drawingUtils.drawLandmarks(landmark, {
                                radius: (data: any) =>
                                    poseRef.current.DrawingUtils.lerp(data.from!.z, -0.15, 0.1, 5, 1)
                            });
                            drawingUtils.drawConnectors(landmark, poseRef.current.pose.POSE_CONNECTIONS);
                        }
                    }
                }

                if (onResults) onResults(result);
            }
            if (runningRef.current) window.requestAnimationFrame(frame);
        }

        window.requestAnimationFrame(frame);
    }, [detectImage, drawSkeleton]);

    const stopLoop = useCallback(() => {
        runningRef.current = false;
    }, []);

    return {
        ready,
        videoRef,
        canvasRef,
        startCamera,
        stopCamera,
        startLoop,
        stopLoop,
        detectImage,
        stopCamera
    };
}

// Default React component — single-file integration for quick start
export default function PoseEstimator(props: PoseEstimatorOptions) {
    const {
        modelUrl,
        onResults,
        showCanvas = true,
        className = "",
        runningMode = "VIDEO",
        numPoses = 1,
        drawSkeleton = true
    } = props || {};

    const {
        ready,
        videoRef,
        canvasRef,
        startCamera,
        stopCamera,
        startLoop,
        stopLoop
    } = usePoseLandmarker({ modelUrl, runningMode, numPoses, drawSkeleton });

    const [streaming, setStreaming] = useState(false);

    useEffect(() => {
        // Start/stop loop whenever streaming state changes
        if (streaming && ready) {
            startLoop(onResults);
        } else {
            stopLoop();
        }
        // keep deps minimal
    }, [streaming, ready]);

    const toggleCamera = async () => {
        if (streaming) {
            stopCamera();
            setStreaming(false);
        } else {
            await startCamera();
            setStreaming(true);
        }
    };

    return (
        <div className={`mediapipe-pose-estimator ${className} p-2`}>

            <div className="flex-row">

                <button
                    className="btn"
                    onClick={toggleCamera}
                    aria-pressed={streaming}
                >
                    {streaming ? "Stop Camera" : "Start Camera"}
                </button>
                <span className="status">{ready ? "Model ready" : "Loading model..."}</span>
            </div>

            <div className="grid">
                <div style={{
                    position: 'relative'
                }}>
                    {/* VIDEO (BOTTOM) */}
                    <video
                        ref={videoRef}

                        autoPlay
                        playsInline
                        muted
                        style={{
                            opacity: streaming ? 1 : 0,

                            position: 'absolute',
                            top: "0px",
                            zIndex: -1
                        }}
                    />

                    {/* CANVAS (MIDDLE) */}
                    {showCanvas && (
                        <canvas
                            ref={canvasRef}
                            style={{
                                position: 'absolute',
                                top: "0px",
                                zIndex: 4
                            }}
                        />
                    )}

                    {/* DIV OVERLAY (TOP) */}
                    {!streaming && (
                        <div className="overlay">
                            Camera is off — press Start Camera
                        </div>
                    )}
                </div>

                <div className="p-2">
                    <div className="text-sm">Controls / Info</div>
                    <ul className="text-xs mt-2">
                        <li>Model: {modelUrl ? new URL(modelUrl).pathname.split("/").pop() : "default"}</li>
                        <li>Mode: {runningMode}</li>
                        <li>Poses: {numPoses}</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
