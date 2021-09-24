/*
File to mock urban os
Ingest inrix dataset with hardcoded secrets, provide it to a websocket for
index.ts to utilize. index.ts doesn't know it's not coming from urban os

This must be started before starting index.ts, and restarted if client 
disconnects and connects again
*/

/* 
- retrieve initial token
- set timeout for every 30 min to refresh token

- open local websocket

- every 2 min 120000 (configurable)
- call inrix endpoint
- print "pushing x entries to endpoint"
- iterate through entries received, push each to the websocket
- print "done pushing x entries to endpoint"
*/

/*
Requires 
export VENDORID=
export CONSUMERID=

Ben has these or they're in staging vault
*/

import { log } from './shared';
import fetch from 'node-fetch';
// @ts-ignore
import { WebSocketServer } from 'ws';

const tokenURL = `http://na.api.inrix.com/Traffic/Inrix.ashx?Action=GetSecurityToken&Vendorid=${process.env.VENDORID}&Consumerid=${process.env.CONSUMERID}&format=json`;
const inrixURL =
    'http://na.api.INRIX.com/traffic/Inrix.ashx?Action=GetSegmentSpeedInBox&Corner1=40.1255678864668|-82.76221584235948&Corner2=39.81278590756092|-83.24321102058161&Duration=0&Resolution=0&RoadSegmentType=TMC,XDS&Units=0&format=json&token=';

let token = '';
let client = undefined as any;

const refreshToken = async () => {
    await fetch(tokenURL)
        .then(async (r) => {
            const j = await r.json();
            token = j.result.token;
            log('New token set');
        })
        .catch((err) => log('ERR: Refreshing Token - ' + err));
};

const fetchInrixData = async (): Promise<Array<any>> => {
    return fetch(inrixURL + token)
        .then(async (r) => {
            const j = await r.json();
            const time = j.result?.segmentSpeeds[0]?.timestamp;
            return j.result?.segmentSpeeds[0]?.segments.map((seg: any) => {
                return { payload: { ...seg, ingestion: time } };
            });
        })
        .catch((err) => {
            log('ERR: Requesting inrix data - ' + err);
            return [];
        });
};

const main = async () => {
    log('Starting up the mock urban os!');

    // Get a new token to use for requesting inrix data every 30 minutes
    await refreshToken();
    setInterval(refreshToken, 30 * 60000); // 30 minutes

    const wss = new WebSocketServer({ port: 1234 });
    wss.on('connection', function connection(ws: any) {
        log('New client connected');
        client = ws;
    });

    setInterval(async () => {
        if (client) {
            const inrixData = await fetchInrixData();
            if (inrixData && inrixData.length) {
                log(`Pushing ${inrixData.length} segments to client`);
                inrixData.forEach((data: any) => sendJsonToClient(data));
                log(`Done`);
            }
        }
        // }, 2 * 60000); // 2 minutes
    }, 2 * 60000); // 2 minutes
};

const sendJsonToClient = (obj: any) => {
    client.send(JSON.stringify(obj));
};

// Done this way so that it gets around top level await
main()
    .then(() => {})
    .catch((err) => log('ERR:' + err));
