import WebSocket from 'ws';
import codeList from './2_codeToLatLong.json';
import cameraList from './cameraData.json';
import * as turf from '@turf/turf';
import * as fs from 'fs';
import { Point } from '@turf/turf';

const codeMap = codeList.reduce((map, obj) => {
    const classNum = parseInt(obj.fclass);
    if (classNum >= 3 && classNum <= 5) map[obj.code] = obj;
    return map;
}, {} as any);

const stream = fs.createWriteStream('export_closestCamV2_70.json', {
    flags: 'a',
});
const SIG_THRESH = 0.7;

process.on('uncaughtException', function (err) {
    console.error(err.stack);
});

const ws = new WebSocket(
    'wss://streams.staging-smartos.com/socket/websocket',
    [],
    {
        headers: {
            'user-agent': 'node',
        },
    },
);

ws.on('open', function open() {
    console.log('Connected');
    ws.send(
        JSON.stringify({
            topic: 'streaming:inrix__inrix_traffic_speed_data',
            event: 'phx_join',
            payload: {},
            ref: '1',
        }),
    );
});

// Type as inrix event
// @ts-ignore
const isSig = (message: any) =>
    calcSig(message.payload.speed, message.payload.average) >= SIG_THRESH;

const calcSig = (speed: number, avg: number) => 1 - speed / avg;

const getDistanceInMetersFromCamera = (segment: any, camera: any): number =>
    turf.distance(segment, camera, { units: 'meters' });

const getClosestCamera = (segment: any, thresholdMiles: number) => {
    let closestCam: {
        image: string;
        latitude: string;
        location: string;
        longitude: string;
        distance: number;
    } | null = null;
    cameraList.forEach((cam) => {
        const distance = getDistanceInMetersFromCamera(
            segment,
            turf.point([parseFloat(cam.latitude), parseFloat(cam.longitude)]),
        );
        if (distance <= thresholdMiles) closestCam = { ...cam, distance };
    });
    return closestCam;
};

ws.on('message', function incoming(msg) {
    // process.stdout.write('.');
    const parsedMsg = JSON.parse(msg.toString());
    const map = codeMap[parsedMsg.payload.code as string];
    if (isSig(parsedMsg) && map) {
        const closestCam = getClosestCamera(
            turf.point([parseFloat(map.lat), parseFloat(map.lon)]),
            20,
        );
        const alert = JSON.stringify({
            lat: map.lat,
            long: map.lon,
            sig: calcSig(parsedMsg.payload.speed, parsedMsg.payload.average),
            avg: parsedMsg.payload.average,
            speed: parsedMsg.payload.speed,
            reference: parsedMsg.payload.reference,
            time: parsedMsg.payload.ingestion,
            functional_class: map.fclass,
            road_name: map.name,
            code: map.code,
            cam_name: closestCam?.location,
            cam_img: closestCam?.image,
            cam_distance: closestCam?.distance,
        });
        console.log(alert + '\n');
        // if (closestCam) {
        // stream.write(alert);
        // }
    }
});

ws.on('close', () => {
    console.log('\nclose');
});

ws.on('error', () => {
    console.log('\nerror');
});

setInterval(() => {
    console.log('\nstill goin');
    // ping the socket so the connection doesn't die
    ws.ping("i'm still here");
}, 5000);
