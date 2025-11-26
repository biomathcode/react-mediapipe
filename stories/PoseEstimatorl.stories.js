import { PoseEstimator } from '../src/index';

export default {
    title: 'AI/PoseEstimator',
    component: PoseEstimator,
    parameters: {
        layout: 'fullscreen',
    },
    tags: ['autodocs'],
    argTypes: {
        width: { control: 'text' },
        height: { control: 'text' },
        showDebug: { control: 'boolean' },
    },
    args: {
        width: 640,
        height: 480,
        showDebug: true,
    },
};



export const Default = {
    args: {
        width: 640,
        height: 480,
        showDebug: true,
    },
};

export const Small = {
    args: {
        width: 400,
        height: 300,
        showDebug: false,
    },
};

export const Large = {
    args: {
        width: 960,
        height: 720,
    },
};
