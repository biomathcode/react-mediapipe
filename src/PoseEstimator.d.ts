type Delegate = "GPU" | "CPU" | "AUTO";
type PoseEstimatorOptions = {
    modelUrl?: string;
    delegate?: Delegate;
    numPoses?: number;
    runningMode?: "IMAGE" | "VIDEO";
    showCanvas?: boolean;
    drawSkeleton?: boolean;
    onResults?: (results: any) => void;
    className?: string;
};
export declare function usePoseLandmarker(opts?: PoseEstimatorOptions): {
    ready: boolean;
    videoRef: import("react").RefObject<HTMLVideoElement | null>;
    canvasRef: import("react").RefObject<HTMLCanvasElement | null>;
    startCamera: () => Promise<void>;
    startLoop: (onResults?: (r: any) => void) => void;
    stopLoop: () => void;
    detectImage: (input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement) => Promise<unknown>;
    stopCamera: () => void;
};
export default function PoseEstimator(props: PoseEstimatorOptions): import("react/jsx-runtime").JSX.Element;
export {};
