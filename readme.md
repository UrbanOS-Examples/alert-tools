## Purpose

This repo is a series of scripts written in typescript. It was originally
created as a tool to assist in a spike, but is growing in scope and relevance
to additional team members.

## Usage / Description

The following scripts were written with typescript and node v14.17.5.

Before running any scripts, you'll need to run `npm install` to install the
required dependencies

-   `npm run capture-alerts` runs the "capture-alerts" tool.
    -   This tool listens to a websocket for inrix data, generates alerts,
        and saves those alerts to a json file
    -   The json file is meant to be imported into tableau to analyze the
        results
    -   The alert generator stores corresponding gifs in a `gifs` directory,
        with the filename format `{inrix_road_segment_id}_{unix_timestamp}`
    -   Required: in the root directory (next to `src` and the `package.json`)
        a `tmp` and `gifs` folder must exist. temporary images and gifs are
        placed there during script execution. If removed, the folders need to
        be manually created.
-   `npm run ingest-inrix` will query inrix every 2 minutes and send the
    responses to `ws://localhost:1234` as if it was discovery streams.

    -   This tool should only be used if the inrix dataset isn't available on
        UrbanOS, or if discovery-streams is down.
    -   This must be started before running `npm run capture-alerts`, and
        restarted if that capture-alerts tool ever disconnects
    -   Requires `VENDORID` and `CONSUMERID` environment variables to be set,
        they're variables required to talk to inrix. These are in the bitwarden
        folder `Dataset Credentials` in the secure note `Inrix Credentials`

-   `npm run giftest` was to learn how to generate gifs.

-   `npm run build_tmc_demo` will build a capture-alerts into an executable
    binary.
    -   This exists so that team members can run the script at the TMC without
        worrying about node.
    -   You'll need to run various commands to tell an accenture mac that this
        built binary is okay to run. Aka: "Unidentified Developer"
    -   The binary should be run in a location that has a `tmp` and `gif` folder
        next to the binary

## Todo

Priority order

-   [ ] Make JSON export work without manual find replace `}{`
-   [ ] Commit vscode setting that hides js / jsmap
-   [ ] Prompt for staging or local port
-   [ ] Prompt for export name
-   [ ] Document the json file attributes
-   [ ] Document tunable algorithm parameters
-   [ ] Generate sidecar file describing the params used to export the data
    -   [ ] Put that in the JSON? Would that mess with tableau?
-   [ ] Add alert tagging web tool here as well (helps look at captured alerts)
-   [ ] Find a way to build the web tool for the alerts export

## Notes

-   There's a weird OSX thing where if you have the "tmp" or "gif" folders open in
    finder, while the tool is placing files there, image capture gets messed up.
    You **have** to have any finder windows that are looking at "tmp" or "gif" closed
    or the tool will not save images correctly, which really messes up the gifs
