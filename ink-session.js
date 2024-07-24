//Configuration
const config = require('config')
const express = require('express');

const Story = require("./src/story").Story;
const Session = require("./src/session").Session;

//Server
const app = express()
const route = config.get('routes') //TODO: create sperate routes for each session

app.use(express.urlencoded({extended: true}))
app.use(express.static(route['pages']))

const port = config.get('port')
const hostname = config.util.getEnv('HOSTNAME')
const server = app.listen(port, hostname, () => {
	console.log(`Server running at http://${hostname}:${port}/`);
	
});

//Ink-Session setup
const story = Story.load(config.get('story_path'));
const session = new Session(story);
//todo create sperate routes for each session

app.get(route['eventStream'], session.assignId, story.castClient, session.subscribe);

app.get(route['updateLog'], story.updateLog, session.updateClients);
app.get(route['updateChoices'], session.appendClientName, story.updateChoices);
app.get(route['getMetadata'], story.getMetadata);
app.post(route['sendChoice'], session.appendClientName, story.selectChoice, session.updateClients);

app.on('client disconnected', ()=>{
	if (session.clients.length === 0 ) {
		console.log("All clients disconnected")

		story.save()

		process.exit()
	}
})

process.on('SIGTERM', () => {
  debug('SIGTERM signal received: closing server')
  server.close(() => {
	debug('Server closed')
  })
})

process.on('exit', () => {
	story.save()

	server.close(() => {
	debug('Server closed')
	})
})
