// import * as gifEncoder from 'gifencoder';
import GIFEncoder from 'gifencoder';
import getPixels from 'get-pixels';
import * as fs from 'fs';

const file = fs.createWriteStream('test_output_2000.gif');
const pics = ['./src/cam_ex_1.jpg', './src/cam_ex_2.jpg'];

const gif = new GIFEncoder(704, 480);
gif.createReadStream().pipe(file);
gif.start();

gif.setDelay(1000);
gif.setQuality(2000);
gif.setRepeat(1);

// @ts-ignore
const addToGif = function (images, counter = 0) {
    getPixels(images[counter], function (err, pixels) {
        gif.addFrame(pixels.data);
        // READ?
        if (counter === images.length - 1) {
            gif.finish();
        } else {
            addToGif(images, ++counter);
        }
    });
};

addToGif(pics);
