/*
File to mock urban os
Ingest inrix dataset with hardcoded secrets, provide it to a websocket for
index.ts to utilize. index.ts doesn't know it's not coming from urban os
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

const tokenURL = `http://na.api.inrix.com/Traffic/Inrix.ashx?Action=GetSecurityToken&Vendorid=${process.env.VENDORID}&Consumerid=${process.env.CONSUMERID}&format=json`;

let token = '';

const getToken = async () => {
    const r = await fetch(tokenURL);
    const j = await r.json();
    return j.result.token;
};

const main = async () => {
    log('Starting up the mock urban os!');

    // Get a new token to use for requesting inrix data every 30 minutes
    setInterval(async () => {
        token = await getToken();
        log('New token set');
    }, 30 * 60000);
};

// Done this way so that it gets around top level await
main()
    .then(() => {})
    .catch((err) => log('ERR:' + err));
