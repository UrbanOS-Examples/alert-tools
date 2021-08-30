import WebSocket from 'ws';
import codeList from './2_codeToLatLong.json';
// import cameraList from './cameraData.json';
import camAndIntList from './cameras_and_intersections_v2.json';
import * as turf from '@turf/turf';
import GIFEncoder from 'gifencoder';
import getPixels from 'get-pixels';
import * as fs from 'fs';
import { imageSize } from 'image-size';
import fetch from 'node-fetch';
import moment from 'moment';

const FUNCTIONAL_CLASS_RANGE = [3, 5];
const SIG_THRESH = 0.7;
const CAM_DIST = 0.1;
const EXPORT_FILE = 'wan_meeting.json';
let lastAlert = moment();

const codeMap = codeList.reduce((map, obj) => {
    const classNum = parseInt(obj.fclass);
    if (
        classNum >= FUNCTIONAL_CLASS_RANGE[0] &&
        classNum <= FUNCTIONAL_CLASS_RANGE[1]
    )
        map[obj.code] = obj;
    return map;
}, {} as any);

const stream = fs.createWriteStream(EXPORT_FILE, {
    flags: 'a',
});

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
    log('Connected');
    ws.send(
        JSON.stringify({
            topic: 'streaming:inrix__inrix_traffic_speed_data',
            event: 'phx_join',
            payload: {},
            ref: '1',
        }),
    );
    log('Listening for alerts');
});

// Type as inrix event
// @ts-ignore
const isSig = (message: any) =>
    calcSig(message.payload.speed, message.payload.average) >= SIG_THRESH;

const calcSig = (speed: number, avg: number) => 1 - speed / avg;

const getDistanceInMetersFromCamera = (segment: any, camera: any): number =>
    turf.distance(segment, camera, { units: 'kilometers' });

const getClosestInter = (segment: any, thresholdMiles: number) => {
    let closestInter: {
        camera_description: string;
        camera_image: string;
        camera_lat: string;
        camera_lon: string;
        cm_pwrsrc: string;
        signal_lat: number;
        signal_lon: number;
        distance: number;
    } | null = null;
    camAndIntList.forEach((inter) => {
        const distance = getDistanceInMetersFromCamera(
            segment,
            turf.point([inter.signal_lat, inter.signal_lon]),
        );
        if (distance <= thresholdMiles) closestInter = { ...inter, distance };
    });
    return closestInter;
};

const lastAlertMsg = setInterval(() => {
    log(`No Alerts Since ${lastAlert.format('hh:mm:ss')}`);
}, 30000);

ws.on('message', function incoming(msg) {
    // process.stdout.write('.');
    const parsedMsg = JSON.parse(msg.toString());
    const map = codeMap[parsedMsg.payload.code as string];
    if (isSig(parsedMsg) && map) {
        const closestInter = getClosestInter(
            turf.point([parseFloat(map.lat), parseFloat(map.lon)]),
            CAM_DIST,
        );

        if (closestInter) {
            const id = `${map.code}_${Date.now()}`;
            const gifName = `${id}.gif`;
            const alert = {
                id,
                lat: map.lat,
                long: map.lon,
                sig: calcSig(
                    parsedMsg.payload.speed,
                    parsedMsg.payload.average,
                ),
                avg: parsedMsg.payload.average,
                speed: parsedMsg.payload.speed,
                reference: parsedMsg.payload.reference,
                time: parsedMsg.payload.ingestion,
                functional_class: map.fclass,
                road_name: map.name,
                code: map.code,
                ...closestInter,
                cam_gif: closestInter.camera_image ? gifName : null,
            };

            if (closestInter.camera_image) {
                const interval = setInterval(async () => {
                    // log(`fetching the img for: ${map.code}`);
                    const response = await fetch(closestInter.camera_image);
                    const buffer = await response.buffer();
                    await fs.writeFile(
                        `./tmp/${map.code}_${Date.now()}.jpg`,
                        buffer,
                        (err) => {
                            if (err) console.error('Err Writing Img:', err);
                            // else log('finished downloading');
                        },
                    );
                }, 5000);

                setTimeout(() => {
                    // log(`clearing img fetch for: ${map.code}`);
                    clearInterval(interval);
                    const files = fs
                        .readdirSync('./tmp')
                        .filter((fn) => fn.includes(map.code))
                        .map((file) => `./tmp/${file}`);
                    filesToGif(files, gifName);
                }, 31000);
            }

            // generate file name for gif, place that in alert, write / log alert
            // that interval saves an image
            // once the interval is completed, images are saved to a gif
            //   with the previously determined name
            // source images are deleted

            lastAlert = moment();
            log(
                `Alert Triggered:\nRoad Name: ${alert.road_name}\nCamera: ${alert.cm_pwrsrc}\nid:${alert.id}\n`,
            );
            // log(alert)
            stream.write(JSON.stringify(alert));
        }
    }
});

const filesToGif = (images: string[], gifFileName: string) => {
    const { width, height } = imageSize(images[0]);
    const gif = new GIFEncoder(width, height);
    gif.createReadStream().pipe(fs.createWriteStream(`./gifs/${gifFileName}`));
    gif.start();

    gif.setDelay(1000);
    gif.setQuality(2000);
    gif.setRepeat(1);

    addToGif(gif, images);
    // delete source
};

// @ts-ignore
const addToGif = function (gif, images, counter = 0) {
    getPixels(images[counter], function (err, pixels) {
        gif.addFrame(pixels.data);
        // @ts-ignore
        fs.unlinkSync(images[counter]);
        if (counter === images.length - 1) {
            gif.finish();
        } else {
            addToGif(gif, images, ++counter);
        }
    });
};

ws.on('close', () => {
    log('\nSocket was closed, please restart the program');
});

ws.on('error', (err) => {
    console.log('\nerror: ', err);
    log('Consider restarting the program');
});

setInterval(() => {
    // log('\nstill goin');
    // ping the socket so the connection doesn't die
    ws.ping("i'm still here");
}, 5000);

const log = (msg: string): void => {
    const time = moment();
    console.log(`[${time.format('hh:mm:ss')}] ${msg}`);
};
