# Ink Server

Ink Server is a webserver that provides a runtime for the [ink](https://github.com/inkle/ink/) 
language accessable by a http interface.

It is mostly based off of [inkjs](https://github.com/y-lohse/inkjs/) 
extending the Story class with methods to use in an asyncronous methods

Instead of getting content with the `Continue` method the `getLine` method allows 
the client to get content at it's own pace and autimatically get new content.

An example client is provided as a html page with the `ink-client.js` script added
which updates the client whenever new content is added and keeps the selection of
story choices up to date.

## Setup
The server requires the node runtime to run.

Dependancies can be installed by running:

` npm install `

Edit the configuration file `config/default.yaml`, 
or write a new one with name `config/<hostname>.extension`,
and update the `story_path` field with the path to an ink file.
Then set the `save_path` fieds to the desired path to save the story
state and the log. 

Changing the `routes` will reqire the updating client's route table as well.

Then you can run the server with the command:

`node ink-server.js`

It will then print the URL used to access the server.
Going to that link will load the example page in the `public` directory.


