import WebSocket from 'ws';
import codeList from './2_codeToLatLong.json';
import cameraList from './cameraData.json';
import * as turf from '@turf/turf';
import GIFEncoder from 'gifencoder';
import getPixels from 'get-pixels';
import * as fs from 'fs';
import { imageSize } from 'image-size';
import fetch from 'node-fetch';

const FUNCTIONAL_CLASS_RANGE = [3, 5];
const SIG_THRESH = 0.7;
const CAM_DIST = 0.1;

const codeMap = codeList.reduce((map, obj) => {
    const classNum = parseInt(obj.fclass);
    if (
        classNum >= FUNCTIONAL_CLASS_RANGE[0] &&
        classNum <= FUNCTIONAL_CLASS_RANGE[1]
    )
        map[obj.code] = obj;
    return map;
}, {} as any);

const stream = fs.createWriteStream('export_fridayNight_GifV1.json', {
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
    turf.distance(segment, camera, { units: 'kilometers' });

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
            CAM_DIST,
        );

        if (closestCam) {
            const gifName = `${map.code}_${Date.now()}.gif`;
            const alert = JSON.stringify({
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
                cam_name: closestCam?.location,
                cam_img: closestCam?.image,
                cam_distance: closestCam?.distance,
                cam_gif: gifName,
            });
            console.log(alert + '\n');

            const interval = setInterval(async () => {
                console.log(`fetching the img for: ${map.code}`);
                const response = await fetch(closestCam.image);
                const buffer = await response.buffer();
                await fs.writeFile(
                    `./tmp/${map.code}_${Date.now()}.jpg`,
                    buffer,
                    (err) => {
                        if (err) console.error('Err Writing Img:', err);
                        else console.log('finished downloading');
                    },
                );
            }, 5000);

            setTimeout(() => {
                console.log(`clearing img fetch for: ${map.code}`);
                clearInterval(interval);
                const files = fs
                    .readdirSync('./tmp')
                    .filter((fn) => fn.includes(map.code))
                    .map((file) => `./tmp/${file}`);
                filesToGif(files, gifName);
            }, 31000);
            // generate file name for gif, place that in alert, write / log alert
            // that interval saves an image
            // once the interval is completed, images are saved to a gif
            //   with the previously determined name
            // source images are deleted

            stream.write(alert);
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
        if (counter === images.length - 1) {
            gif.finish();
            // @ts-ignore
            images.forEach((file) => {
                fs.unlinkSync(file);
            });
        } else {
            addToGif(gif, images, ++counter);
        }
    });
};

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
