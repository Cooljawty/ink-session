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
app.get(route['eventStream'], subscribe);
app.on('client disconnected', ()=>{
	if (clients.length === 0 ) {
		console.log("All clients disconnected")

		story.save()

		process.exit()
	}
})

app.get(route['updateLog'], story.updateLog, (req, res, next)=>{
	clients.forEach( client => client.response.write(`event: New content\ndata:${story.currentLine}\n\n`))
});

function appendClientName(req, res, next) {
		let clientId = parseCookie(req, 'clientId');
		res.locals.clientName = clients.get(clientId)?.['name'];
		next()
}

app.get(route['updateChoices'], appendClientName, story.updateChoices);

app.post(route['sendChoice'], appendClientName, story.selectChoice, (req, res, next)=> {
	clients.forEach( client => client.response.write(`event: New content\ndata:${story.currentLine}\n\n`))
});


app.get(route['getMetadata'], (req, res) => {
	res.setHeader('Cache-Control', 'max-age=0, no-cache, no-store, must-revalidate');
	const pattern = /^(\w+): (.+)/
	let metadata = story.globalTags.reduce((map, pair) => {
		let [_, key, value] = pair.match(pattern)
		map[key] = value
		return map
	},{})
	res.send(metadata);
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
