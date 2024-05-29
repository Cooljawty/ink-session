//Configuration
const config = require('config');

const fs = require('fs');
const inkjs = require('inkjs');
const express = require('express')

//Ink Story
class Story extends inkjs.Story {
	currentLine = 0;
	constructor(file) {
		super(file)

		this.log = [];
		this.currentLine = 0;
	}

	getLine(index){
		if(index <= this.currentLine) {
			return { 
				text: this.log[index-1], 
				currentLine: story.currentLine, 
			}
		} else {
			if ( this.canContinue ) {
				this.log.push(this.Continue())
				this.currentLine += 1

				if ( this.currentChoices.leng != 0 ){
					clients.forEach( client => client.response.write(`event: New choices\ndata:${this.currentChoices.length}\n\n`))
				}

				clients.forEach( client => client.response.write(`event: New content\ndata:${this.currentLine}\n\n`))
				return { 
					text: this.log[ this.log.length - 1], 
					currentLine: story.currentLine, 
				}
			}
		}
	}

	makeChoice(index){
		let choice = this.currentChoices[index]

		this.ChooseChoiceIndex(index)

		this.log.push(this.Continue())
		this.currentLine += 1
		clients.forEach( client => client.response.write(`event: New content\ndata:${this.currentLine}\n\n`))
		clients.forEach( client => client.response.write(`event: New choices\ndata:${this.currentChoices.length}\n\n`))
	}
}


var inkFile = fs.readFileSync(config.get('story_path'), {encoding: 'UTF-8'});
var inkJson = new inkjs.Compiler(inkFile).Compile().ToJson()
var story   = new Story(inkJson);
if ( fs.existsSync(config.get('save_path')) ) {
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

let clients = []

app.on('client disconnected', ()=>{
	if (clients.length === 0 ) {
		console.log("All clients disconnected")

		const stateSavePath = config.get('save_path.state')
		const logSavePath = config.get('save_path.log')
		fs.writeFileSync(stateSavePath, story.state.toJson())
		fs.writeFileSync(logSavePath, JSON.stringify({
			log: story.log,
			currentLine: story.currentLine
		}))
	}
})
app.get(route['eventStream'], (req, res) => {
	res.writeHead(200, {
		'Content-Type': "text/event-stream",
		'Connection': "keep-alive",
	})

	res.write("data: Subscribed!\n\n")

	//Save connection handel
	let clientId = Date.now();
	clients.push({id: clientId, response: res })
	console.log(`Client ${clientId} connected`)

	//Ping client to keep alive
	const heartbeat = setInterval(()=>{
		res.write(':ping\n\n');	
	}, config.get('heartbeatInterval'))

	req.on('close', () => {
		console.log(`${clientId} Connection closed`);
		clearInterval(heartbeat)
		clients = clients.filter(client => client.id !== clientId);

		setTimeout(()=>{app.emit('client disconnected')}, config.get('sessionTimeout'))
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
	res.send(choices);
});

app.post(route['sendChoice'], ( req, res) => {
	let index = req.body['index']
	if ( req.query != undefined ) {
		index = req.query['index']
	}

	story.makeChoice(index, story)

	res.send(res.send(story.canContinue));
});

const port = config.get('port')
const hostname = config.util.getEnv('HOSTNAME')
app.listen(port, hostname, () => {
	console.log(`Server running at http://${hostname}:${port}/`);
	
});
