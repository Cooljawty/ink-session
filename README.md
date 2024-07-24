# Ink Session

Ink Session is a webserver that provides a runtime for the [ink](https://github.com/inkle/ink/) 
language via a http interface.

It is mostly based off of [inkjs](https://github.com/y-lohse/inkjs/) 
extending the Story class with methods to use in an asynchronous methods

Instead of getting content with the `Continue` method the `getLine` method allows 
the client to get content at it's own pace and automatically get new content.

An example client is provided as a html page with the `ink-client.js` script added
which updates the client whenever new content is added and keeps the selection of
story choices up to date.

## Setup
The server requires the node runtime to run.

Dependencies can be installed by running:

` npm install `

Edit the configuration file `config/default.yaml`, 
or write a new one with name `config/<hostname>.extension`,
and update the `story_path` field with the path to an ink file.
Then set the `save_path` fields to the desired path to save the story
state and the log. 

Changing the `routes` will require the updating client's route table as well.

Then you can run the server with the command:

`node ink-session.js`

It will then print the URL used to access the server.
Going to that link will load the example page in the `public` directory.

## Turns

Implements methods to handle turn, so that all clients to just share control at the same time.

The turn is defined in the ink file itself, with a tag with the format: 
`turn: name` 
Where `name` indicates who can make a choice selection.

Each client is assigned a name from a global cast variable, named cast, which is a ink list type with the name of each cast member.

The name for the turn tag and cast variable can be set in the config file.

### Example
```
LIST cast = Alice, Bob
Enter Alice and Bob

# turn: Alice
Alice had a pair of <>
* red
* blue
- <> boots.

# turn: Bob
And Bob had a <>
* small
* big
- <> hat.
```
