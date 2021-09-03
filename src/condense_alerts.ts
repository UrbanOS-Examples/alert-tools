import data from './demo_50_no_tag_no_condense.json';
import moment from 'moment';
import * as fs from 'fs';

interface CondensedAlert {
    lat: number;
    long: number;
    sig: number;
    avg: number;
    speed: number;
    reference: number;
    alert_start: string;
    alert_end: string;
    functional_class: string;
    road_name: string;
    code: string;
    cam_name: string;
    cam_img: string;
    cam_distance: number;
    gifs: string[];
}

const condensedAlerts: Array<CondensedAlert> = [];

const alertsAreWithinTwoMinutes = (
    timeOne: string,
    timeTwo: string,
): boolean => {
    const m1 = moment(timeOne);
    const m2 = moment(timeTwo);

    return m1.add('2.1', 'minutes') > m2;
};

const alertAlreadyCondensed = (gifName: string): boolean => {
    return !!condensedAlerts.find((alert) => alert.gifs.includes(gifName));
};

// only look forward
data.forEach((alert, i) => {
    // if the alert hasn't already been accounted for in "condensedAlerts"
    if (!alertAlreadyCondensed(alert.cam_gif)) {
        const condensedAlert = {
            ...alert,
            gifs: [alert.cam_gif],
            alert_start: alert.time,
            alert_end: alert.time,
        };
        // look ahead index = next alert with same code
        let alertsAhead = data.slice(i + 1);
        let nextAlertIndex = alertsAhead.findIndex(
            (next) => next.code === alert.code,
        );
        // while next alert of same code happens within 2.5 min
        while (
            nextAlertIndex != -1 &&
            alertsAreWithinTwoMinutes(
                condensedAlert.alert_end,
                alertsAhead[nextAlertIndex].time,
            )
        ) {
            // add the next alert to condensedAlert
            //   add the gif (id) to the condensed alert + update alert_end
            condensedAlert.alert_end = alertsAhead[nextAlertIndex].time;
            condensedAlert.gifs.push(alertsAhead[nextAlertIndex].cam_gif);

            //   advance the look ahead
            alertsAhead = alertsAhead.slice(nextAlertIndex + 1);
            nextAlertIndex = alertsAhead.findIndex(
                (next) => next.code === alert.code,
            );
        }
        condensedAlerts.push(condensedAlert);
    }
    // push the condensed alert
});

// export condensed alerts
console.log('Alerts pre condense:', data.length);
console.log('Alerts post condense:', condensedAlerts.length);
fs.writeFileSync('demo_50_no_tag.json', JSON.stringify(condensedAlerts));
