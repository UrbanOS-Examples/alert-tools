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

import { log } from './shared';

const getToken = (): string => 'test';

log(getToken());
