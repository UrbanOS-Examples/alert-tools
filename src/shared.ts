import moment from 'moment';

export const log = (msg: string): void => {
    const time = moment();
    console.log(`[${time.format('hh:mm:ss')}] ${msg}`);
};
