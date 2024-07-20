//Configuration
const config = require('config')
const express = require('express');

const Story = require("./src/story").Story;

const clients = new Map;

function parseCookie(req, key){
	return req.get('Cookie')?.split(";")
		.find(item => item.startsWith(key))
		?.split('=')[1]
}

function subscribe(req, res, next){
	let cookieId = parseCookie(req, 'clientId');
	let clientId = cookieId ? cookieId : Date.now();
	if (!cookieId) {
		while(clients.get(clientId)) { clientId += 1 } //Iterate until unique id found
	}

	let clientName = story.castClient(clientId);
	clients.set(clientId, {response: res, name: clientName})
	console.log(`Client ${clientId} connected`)

	res.writeHead(200, {
		'Content-Type': "text/event-stream",
		'Connection': "keep-alive",
		'Set-Cookie': [
			`clientId=${clientId}; SameSite=Strict`,
			`name=${clientName}; SameSite=Strict`, 
		],
	})
	res.write("data: Subscribed!\n\n")

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

	next()
}

function updateClients(req, res, next){
	clients.forEach( client => client.response.write(`event: New content\ndata:${story.currentLine}\n\n`))
}

function appendClientName(req, res, next) {
		let clientId = parseCookie(req, 'clientId');
		res.locals.clientName = clients.get(clientId)?.['name'];
		next()
}

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

app.get(route['eventStream'], subscribe);
app.get(route['updateLog'], story.updateLog, updateClients);
app.get(route['updateChoices'], appendClientName, story.updateChoices);
app.get(route['getMetadata'], story.getMetadata);
app.post(route['sendChoice'], appendClientName, story.selectChoice, updateClients);

app.on('client disconnected', ()=>{
	if (clients.length === 0 ) {
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
