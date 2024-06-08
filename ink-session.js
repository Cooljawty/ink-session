//Configuration
const config = require('config')
const fs = require('fs');
const express = require('express');

const Story = require("./src/story").Story;

var inkFile = fs.readFileSync(config.get('story_path'), {encoding: 'UTF-8'});
var story   = new Story(inkFile);
if ( fs.existsSync(config.get('save_path.state')) ) {
	console.log("Restoring save state")
	var prevState = fs.readFileSync(config.get('save_path.state'), {encoding: 'UTF-8'});
	story.state.LoadJson(prevState)

	var prevLog = fs.readFileSync(config.get('save_path.log'), {encoding: 'UTF-8'});
	({log: story.log, currentLine: story.currentLine} = JSON.parse(prevLog))
}

//Server
const app = express()
const route = config.get('routes') //TODO: create sperate routes for each session

app.use(express.urlencoded({extended: true}))
app.use(express.static(route['pages']))

let clients = new Map;

app.on('client disconnected', ()=>{
	if (clients.length === 0 ) {
		console.log("All clients disconnected")

		story.save()

		process.exit()
	}
})
app.get(route['eventStream'], (req, res) => {

	//Set id from cookie, or set a new one
	let cookieId = req.get('Cookie')?.split(";")
		.find(item => item.startsWith('clientId'))
		?.split('=')[1]
	let clientId = cookieId ? cookieId : Date.now();
	if (!cookieId) {
		while(clients.get(clientId)) { clientId += 1 } //Iterate until unique id found
	}

	res.writeHead(200, {
		'Content-Type': "text/event-stream",
		'Connection': "keep-alive",
		'Set-Cookie': `clientId=${clientId}; SameSite=Strict`,
	})
	res.write("data: Subscribed!\n\n")

	clients.set(clientId, {response: res, tags})
	console.log(`Client ${clientId} connected`)

	const heartbeat = setInterval(()=>{
		res.write(':ping\n\n');	
	}, config.get('heartbeatInterval'))

	req.on('close', () => {
		console.log(`${clientId} Connection closed`)
		clearInterval(heartbeat)
		clients.delete(clientId)

		setTimeout(
			function(){ app.emit('client disconnected') }, 
			config.get('sessionTimeout')
		)
	})

	
});
app.get(route['updateLog'], ( req, res) => {
	let index = req.body['line']
	if ( req.query != undefined ) {
		index = req.query['line']
	}

	let nextLine = story.getLine(index)

	res.statusCode = nextLine === undefined ? 204 : 200;
	res.setHeader('Content-Type', 'text/plain');
	res.setHeader('Cache-Control', 'max-age=0, no-cache, no-store, must-revalidate');
	res.send(nextLine);
});

app.get(route['updateChoices'], ( req, res) => {
	let choices = story.currentChoices.map( choice => {
		return {
			index: choice.index,
			text: choice.text,
			tags: choice.tags,
		}
	})

	res.setHeader('Cache-Control', 'max-age=0, no-cache, no-store, must-revalidate');
	res.send(choices);
});

app.post(route['sendChoice'], ( req, res) => {
	let index = req.body['index']
	if ( req.query != undefined ) {
		index = req.query['index']
	}

	story.makeChoice(index, story)

	res.setHeader('Cache-Control', 'max-age=0, no-cache, no-store, must-revalidate');
	res.send(res.send(story.canContinue));
});

app.get(route['getMetadata'], (req, res) => {
	res.setHeader('Cache-Control', 'max-age=0, no-cache, no-store, must-revalidate');
	res.send(story.globalTags);
});


const port = config.get('port')
const hostname = config.util.getEnv('HOSTNAME')
const server = app.listen(port, hostname, () => {
	console.log(`Server running at http://${hostname}:${port}/`);
	
});

process.on('SIGTERM', () => {
  debug('SIGTERM signal received: closing HTTP server')
  server.close(() => {
	debug('Server closed')
  })
})

process.on('exit', () => {
	//story.save()

	server.close(() => {
	debug('Server closed')
	})
})
